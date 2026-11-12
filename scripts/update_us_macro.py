#!/usr/bin/env python3
"""US macro snapshot using BLS and US Treasury public feeds; no API keys required.
FRED is deliberately not used here because GitHub-hosted runners timed out against it.
"""
import csv, datetime as dt, io, json, urllib.request, urllib.parse, xml.etree.ElementTree as ET
from pathlib import Path

UTC=dt.timezone.utc
NOW=dt.datetime.now(UTC)
OUT=Path("data/us_macro.json")
UA="Mozilla/5.0 (compatible; MacroPulseFXDashboard/2.0)"

def request(url, data=None, headers=None, timeout=25):
    h={"User-Agent":UA, **(headers or {})}
    req=urllib.request.Request(url, data=data, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def empty():
    return {"value":None,"date":None,"change":None,"history":[]}

def metric(rows, kind="level"):
    rows=sorted(rows,key=lambda x:x["date"])
    if not rows: return empty()
    history=[]
    for i,r in enumerate(rows):
        value=None
        if kind=="yoy":
            if i>=12 and rows[i-12]["value"]:
                value=(r["value"]/rows[i-12]["value"]-1)*100
        elif kind=="nfp":
            if i>=1: value=r["value"]-rows[i-1]["value"]
        else: value=r["value"]
        if value is not None:
            history.append({"date":r["date"],"value":round(value,4)})
    latest=history[-1] if history else None
    prior=history[-2] if len(history)>1 else None
    return {
      "value":latest["value"] if latest else None,
      "date":latest["date"] if latest else rows[-1]["date"],
      "change":round(latest["value"]-prior["value"],4) if latest and prior else None,
      "history":history[-24:]
    }

def bls_series():
    start=max(2018,NOW.year-8)
    payload=json.dumps({"seriesid":["CUSR0000SA0L1E","CES0000000001"],"startyear":str(start),"endyear":str(NOW.year)}).encode()
    raw=request("https://api.bls.gov/publicAPI/v1/timeseries/data/",payload,{"Content-Type":"application/json"})
    doc=json.loads(raw)
    if doc.get("status")!="REQUEST_SUCCEEDED":
        raise RuntimeError("BLS API: "+str(doc.get("message") or doc.get("status")))
    out={}
    for s in doc.get("Results",{}).get("series",[]):
        rows=[]
        for p in s.get("data",[]):
            period=p.get("period","")
            if not period.startswith("M") or period=="M13": continue
            try:
                date=f'{p["year"]}-{int(period[1:]):02d}-01'
                rows.append({"date":date,"value":float(p["value"])})
            except (ValueError,KeyError): pass
        out[s.get("seriesID")]=sorted(rows,key=lambda x:x["date"])
    return out

def treasury_series():
    rows=[]
    years=range(NOW.year-1,NOW.year+1)
    for year in years:
        url=("https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml"
             f"?data=daily_treasury_yield_curve&field_tdr_date_value={year}")
        root=ET.fromstring(request(url,timeout=30))
        for props in root.iter():
            if not props.tag.endswith("properties"): continue
            fields={}
            for child in list(props):
                name=child.tag.split("}")[-1]
                fields[name]=child.text
            date=fields.get("NEW_DATE") or fields.get("NEW_DATE1")
            y2=fields.get("BC_2YEAR")
            y10=fields.get("BC_10YEAR")
            if not date: continue
            date=date[:10]
            try:
                row={"date":date,"y2":float(y2),"y10":float(y10)}
                rows.append(row)
            except (TypeError,ValueError): continue
    unique={r["date"]:r for r in rows}
    return [unique[k] for k in sorted(unique)]

def stooq_dxy():
    # Stooq's daily continuous DXY futures series; if unavailable, leave DXY explicitly N/A.
    url="https://stooq.com/q/d/l/?s=dx.f&i=d"
    raw=request(url,timeout=20).decode("utf-8-sig")
    rows=[]
    for row in csv.DictReader(io.StringIO(raw)):
        try:
            rows.append({"date":row["Date"],"value":float(row["Close"])})
        except (ValueError,KeyError): continue
    return sorted(rows,key=lambda x:x["date"])

def main():
    indicators={k:empty() for k in ["core_cpi","core_pce","nfp","treasury_2y","treasury_10y","dxy","yield_spread"]}
    errors={}
    sources={
      "core_cpi":"BLS series CUSR0000SA0L1E (seasonally adjusted CPI less food and energy)",
      "nfp":"BLS series CES0000000001 (total nonfarm payrolls, thousands)",
      "treasury":"US Treasury daily par yield curve XML feed",
      "dxy":"Stooq DX.F continuous DXY futures proxy; may be delayed",
      "core_pce":"Not loaded: public BEA/FRED source unavailable from GitHub runner"
    }
    try:
        b=bls_series()
        if b.get("CUSR0000SA0L1E"):
            indicators["core_cpi"]=metric(b["CUSR0000SA0L1E"],"yoy")
        else: errors["core_cpi"]="BLS returned no CPI observations"
        if b.get("CES0000000001"):
            indicators["nfp"]=metric(b["CES0000000001"],"nfp")
        else: errors["nfp"]="BLS returned no payroll observations"
    except Exception as e:
        errors["bls"]=str(e)[:200]
    try:
        rates=treasury_series()
        indicators["treasury_2y"]=metric([{"date":r["date"],"value":r["y2"]} for r in rates])
        indicators["treasury_10y"]=metric([{"date":r["date"],"value":r["y10"]} for r in rates])
        indicators["yield_spread"]=metric([{"date":r["date"],"value":r["y10"]-r["y2"]} for r in rates])
    except Exception as e:
        errors["treasury"]=str(e)[:200]
    try:
        indicators["dxy"]=metric(stooq_dxy())
    except Exception as e:
        errors["dxy"]=str(e)[:200]
    errors["core_pce"]="Not yet connected to a reliable no-key source; left blank rather than substituting CPI."
    required=["core_cpi","nfp","treasury_2y","treasury_10y","yield_spread"]
    good=sum(indicators[k]["value"] is not None for k in required)
    status="OK" if good==len(required) and indicators["dxy"]["value"] is not None else ("PARTIAL" if good else "ERROR")
    data={"schema_version":2,"generated_at":NOW.isoformat(),"source_status":status,
          "available_indicators":sum(v["value"] is not None for v in indicators.values()),
          "indicators":indicators,"errors":errors,"sources":sources}
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(data,indent=2),encoding="utf-8")
    print("US macro snapshot:",status,"available",data["available_indicators"],"/",len(indicators))
    print("Source errors:",json.dumps(errors))
    if good<3: raise SystemExit("Insufficient core US macro data; refusing to publish an empty snapshot.")

if __name__=="__main__": main()
