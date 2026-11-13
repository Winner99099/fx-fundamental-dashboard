#!/usr/bin/env python3
"""US macro snapshot using public BLS, Treasury, FXMacroData and ECB feeds."""
import csv, datetime as dt, io, json, urllib.request, urllib.parse, xml.etree.ElementTree as ET
from pathlib import Path

UTC=dt.timezone.utc
NOW=dt.datetime.now(UTC)
OUT=Path("data/us_macro.json")
UA="Mozilla/5.0 (compatible; MacroPulseFXDashboard/2.1)"

def request(url, data=None, headers=None, timeout=30):
    h={"User-Agent":UA, "Accept":"application/json,text/csv,application/xml,text/html,*/*", **(headers or {})}
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
        else:
            value=r["value"]
        if value is not None:
            history.append({"date":r["date"],"value":round(value,4)})
    latest=history[-1] if history else None
    prior=history[-2] if len(history)>1 else None
    return {"value":latest["value"] if latest else None,
            "date":latest["date"] if latest else rows[-1]["date"],
            "change":round(latest["value"]-prior["value"],4) if latest and prior else None,
            "history":history[-24:]}

def direct_metric(rows):
    rows=sorted(rows,key=lambda x:x["date"])
    if not rows: return empty()
    hist=[{"date":r["date"],"value":round(float(r["value"]),4)} for r in rows]
    return {"value":hist[-1]["value"],"date":hist[-1]["date"],
            "change":round(hist[-1]["value"]-hist[-2]["value"],4) if len(hist)>1 else None,
            "history":hist[-24:]}

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
            try: rows.append({"date":f'{p["year"]}-{int(period[1:]):02d}-01',"value":float(p["value"])})
            except (ValueError,KeyError): pass
        out[s.get("seriesID")]=sorted(rows,key=lambda x:x["date"])
    return out

def treasury_series():
    rows=[]
    for year in range(NOW.year-1,NOW.year+1):
        url=("https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml"
             f"?data=daily_treasury_yield_curve&field_tdr_date_value={year}")
        root=ET.fromstring(request(url,timeout=30))
        for props in root.iter():
            if not props.tag.endswith("properties"): continue
            fields={child.tag.split("}")[-1]:child.text for child in list(props)}
            date=fields.get("NEW_DATE") or fields.get("NEW_DATE1")
            if not date: continue
            try:
                y2=float(fields.get("BC_2YEAR") or "")
                y10=float(fields.get("BC_10YEAR") or "")
                rows.append({"date":date[:10],"y2":y2,"y10":y10})
            except (TypeError,ValueError,KeyError):
                continue
    unique={r["date"]:r for r in rows}
    result=[unique[k] for k in sorted(unique)]
    if not result:
        raise RuntimeError("Treasury nominal-yield feed returned no valid BC_2YEAR / BC_10YEAR observations")
    return result

def treasury_real_10y_series():
    """Official US Treasury daily 10-year par real yield (TIPS) curve."""
    rows=[]
    for year in range(NOW.year-1,NOW.year+1):
        url=("https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml"
             f"?data=daily_treasury_real_yield_curve&field_tdr_date_value={year}")
        root=ET.fromstring(request(url,timeout=30))
        for props in root.iter():
            if not props.tag.endswith("properties"): continue
            fields={child.tag.split("}")[-1]:child.text for child in list(props)}
            date=fields.get("NEW_DATE") or fields.get("NEW_DATE1")
            if not date: continue
            try: rows.append({"date":date[:10],"value":float(fields["TC_10YEAR"])})
            except (TypeError,ValueError,KeyError): continue
    unique={r["date"]:r for r in rows}
    if not unique: raise RuntimeError("Treasury real-yield feed returned no 10-year observations")
    return metric([{"date":k,"value":v["value"]} for k,v in sorted(unique.items())])

def core_pce_series():
    # USD Core PCE official BEA series, via the no-key public 90-day endpoint.
    url="https://api.fxmacrodata.com/v1/announcements/usd/core_pce?frequency=yoy&limit=20"
    doc=json.loads(request(url,timeout=30))
    rows=[]
    for item in doc.get("data",[]):
        try:
            val=item.get("val")
            if val is None: continue
            rows.append({"date":item["date"],"value":float(val)})
        except (KeyError,TypeError,ValueError): continue
    if not rows:
        raise RuntimeError("Core PCE endpoint returned no observations: "+str(doc.get("no_data") or doc.get("message") or "empty data"))
    return direct_metric(rows)

def ecb_dxy_series():
    # Calculate the classic six-currency DXY basket from same-day ECB EUR reference rates.
    # This is a daily ECB-fix proxy, not the live ICE futures quote.
    start=(NOW-dt.timedelta(days=550)).date().isoformat()
    key="D.USD+GBP+JPY+CAD+SEK+CHF.EUR.SP00.A"
    url="https://data-api.ecb.europa.eu/service/data/EXR/"+key+"?"+urllib.parse.urlencode({"startPeriod":start,"format":"csvdata"})
    raw=request(url,timeout=40).decode("utf-8-sig")
    rates={}
    for row in csv.DictReader(io.StringIO(raw)):
        try:
            ccy=row.get("CURRENCY") or row.get("CURRENCY_DENOM")
            date=row["TIME_PERIOD"]
            value=float(row["OBS_VALUE"])
            if ccy in {"USD","GBP","JPY","CAD","SEK","CHF"}:
                rates.setdefault(date,{})[ccy]=value
        except (KeyError,TypeError,ValueError): continue
    rows=[]
    for date,r in rates.items():
        if not all(k in r for k in ("USD","GBP","JPY","CAD","SEK","CHF")): continue
        eurusd=r["USD"]
        usdjpy=r["JPY"]/eurusd
        gbpusd=eurusd/r["GBP"]
        usdcad=r["CAD"]/eurusd
        usdsek=r["SEK"]/eurusd
        usdchf=r["CHF"]/eurusd
        dxy=50.14348112*(eurusd**-0.576)*(usdjpy**0.136)*(gbpusd**-0.119)*(usdcad**0.091)*(usdsek**0.042)*(usdchf**0.036)
        rows.append({"date":date,"value":dxy})
    if not rows: raise RuntimeError("ECB returned no complete six-currency observations")
    return direct_metric(rows)

def main():
    indicators={k:empty() for k in ["core_cpi","core_pce","nfp","treasury_2y","treasury_10y","treasury_10y_real","dxy","yield_spread"]}
    errors={}
    sources={
      "core_cpi":"BLS series CUSR0000SA0L1E (seasonally adjusted CPI less food and energy)",
      "core_pce":"BEA Core PCE via FXMacroData public USD endpoint; no API key, latest 90 days, 15-minute release delay",
      "nfp":"BLS series CES0000000001 (total nonfarm payrolls, thousands)",
      "treasury":"US Treasury daily par nominal and real yield curve XML feeds; 10-year real yield is the TIPS par real yield",
      "dxy":"Calculated six-currency DXY basket using same-day ECB euro reference rates; daily fix proxy, not live ICE futures quote"
    }
    try:
        b=bls_series()
        if b.get("CUSR0000SA0L1E"): indicators["core_cpi"]=metric(b["CUSR0000SA0L1E"],"yoy")
        else: errors["core_cpi"]="BLS returned no CPI observations"
        if b.get("CES0000000001"): indicators["nfp"]=metric(b["CES0000000001"],"nfp")
        else: errors["nfp"]="BLS returned no payroll observations"
    except Exception as e: errors["bls"]=str(e)[:250]
    try:
        rates=treasury_series()
        indicators["treasury_2y"]=metric([{"date":r["date"],"value":r["y2"]} for r in rates])
        indicators["treasury_10y"]=metric([{"date":r["date"],"value":r["y10"]} for r in rates])
        indicators["yield_spread"]=metric([{"date":r["date"],"value":r["y10"]-r["y2"]} for r in rates])
        indicators["treasury_10y_real"]=treasury_real_10y_series()
    except Exception as e: errors["treasury"]=str(e)[:250]
    try: indicators["core_pce"]=core_pce_series()
    except Exception as e: errors["core_pce"]=str(e)[:250]
    try: indicators["dxy"]=ecb_dxy_series()
    except Exception as e: errors["dxy"]=str(e)[:250]
    required=["core_cpi","nfp","treasury_2y","treasury_10y","treasury_10y_real","yield_spread","core_pce","dxy"]
    good=sum(indicators[k]["value"] is not None for k in required)
    status="OK" if good==len(required) else ("PARTIAL" if good else "ERROR")
    # Fed target range and next scheduled decision. Market-implied probabilities
    # are shown through the CME FedWatch embed; no probability is hard-coded.
    fed_policy={
      "target_lower":3.75,
      "target_upper":4.00,
      "target_range":"3.75–4.00%",
      "as_of":"2026-10-29",
      "next_meeting_start":"2026-12-08",
      "next_decision_date":"2026-12-09",
      "next_meeting_label":"8–9 December 2026",
      "source_url":"https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
      "probability_source":"CME FedWatch · 30-Day Fed Funds futures",
      "probability_url":"https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html"
    }
    data={"schema_version":4,"generated_at":NOW.isoformat(),"source_status":status,
          "available_indicators":good,"indicators":indicators,"fed_policy":fed_policy,
          "errors":errors,"sources":sources}
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(data,indent=2),encoding="utf-8")
    print("US macro snapshot:",status,"available",good,"/",len(indicators))
    print("Indicator dates:",json.dumps({k:v["date"] for k,v in indicators.items()}))
    print("Source errors:",json.dumps(errors))
    if good<5: raise SystemExit("Insufficient US macro data; refusing to publish a mostly empty snapshot.")

if __name__=="__main__": main()
