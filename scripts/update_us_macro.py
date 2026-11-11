#!/usr/bin/env python3
"""Collect public FRED macro series and a third-party DXY quote for the US dashboard."""
import csv, io, json, datetime, urllib.request, urllib.parse, math
from pathlib import Path

UTC=datetime.timezone.utc
NOW=datetime.datetime.now(UTC)
OUT=Path("data/us_macro.json")
UA="Mozilla/5.0 (compatible; MacroPulseUSMonitor/1.0)"
SERIES={
 "CPILFESL":"core_cpi","PCEPILFE":"core_pce","PAYEMS":"payems",
 "DGS2":"treasury_2y","DGS10":"treasury_10y"
}
def get(url,headers=None):
 req=urllib.request.Request(url,headers={"User-Agent":UA,**(headers or {})})
 with urllib.request.urlopen(req,timeout=35) as r:return r.read()
def fred_series(series):
 url="https://fred.stlouisfed.org/graph/fredgraph.csv?id="+urllib.parse.quote(series)+"&cosd=2018-01-01"
 raw=get(url).decode("utf-8-sig")
 rows=[]
 for row in csv.DictReader(io.StringIO(raw)):
  date=row.get("observation_date") or row.get("DATE") or row.get("observation_date")
  val=row.get(series)
  if date and val and val not in (".",""):
   try: rows.append({"date":date,"value":float(val)})
   except ValueError: pass
 return rows
def pct_change(a,b):
 return None if b in (None,0) else (a/b-1)*100
def change(a,b):
 return None if a is None or b is None else a-b
def make_metric(series,kind):
 rows=fred_series(series)
 if not rows:return {"value":None,"date":None,"change":None,"history":[]}
 latest=rows[-1]; prev=rows[-2] if len(rows)>1 else None
 if kind in ("yoy","nfp"):
  lag=rows[-13] if len(rows)>=13 else None
  value=pct_change(latest["value"],lag["value"]) if kind=="yoy" and lag else (latest["value"]-prev["value"] if kind=="nfp" and prev else None)
  prev_value=(pct_change(prev["value"],rows[-14]["value"]) if kind=="yoy" and len(rows)>=14 else (prev["value"]-rows[-3]["value"] if kind=="nfp" and len(rows)>=3 else None))
  delta=change(value,prev_value)
 elif kind=="level":
  value=latest["value"];delta=change(value,prev["value"] if prev else None)
 else:value=latest["value"];delta=None
 hist=[]
 for i,row in enumerate(rows[-24:]):
  if kind=="yoy":
   idx=len(rows)-24+i-12
   v=pct_change(row["value"],rows[idx]["value"]) if idx>=0 else None
  elif kind=="nfp":
   idx=len(rows)-24+i-1
   v=row["value"]-rows[idx]["value"] if idx>=0 else None
  else:v=row["value"]
  if v is not None:hist.append({"date":row["date"],"value":round(v,4)})
 return {"value":round(value,4) if value is not None else None,"date":latest["date"],"change":round(delta,4) if delta is not None else None,"history":hist}
def dxy_data():
 # Yahoo Finance chart endpoint for ^DXY; quote is indicative and may be delayed.
 url="https://query1.finance.yahoo.com/v8/finance/chart/%5EDXY?range=1y&interval=1d"
 try:
  payload=json.loads(get(url).decode())
  result=payload["chart"]["result"][0];q=result["indicators"]["quote"][0]
  points=[]
  for ts,close in zip(result.get("timestamp",[]),q.get("close",[])):
   if close is not None:
    points.append({"date":datetime.datetime.fromtimestamp(ts,UTC).date().isoformat(),"value":float(close)})
  if not points:return {"value":None,"date":None,"change":None,"history":[]}
  last=points[-1];prev=points[-2] if len(points)>1 else None
  return {"value":round(last["value"],4),"date":last["date"],"change":round(last["value"]-prev["value"],4) if prev else None,"history":[{"date":x["date"],"value":round(x["value"],4)} for x in points[-24:]],"provider":"Yahoo Finance chart API","delayed":True}
 except Exception as e:
  return {"value":None,"date":None,"change":None,"history":[],"error":str(e)[:180],"provider":"Yahoo Finance chart API"}
def main():
 indicators={}
 for sid,key in SERIES.items():
  kind="yoy" if sid in ("CPILFESL","PCEPILFE") else "nfp" if sid=="PAYEMS" else "level"
  indicators[key]=make_metric(sid,kind)
 indicators["dxy"]=dxy_data()
 a=indicators["treasury_2y"];b=indicators["treasury_10y"]
 spread=None
 if a["value"] is not None and b["value"] is not None:
  common=a["date"] if a["date"]==b["date"] else min(a["date"],b["date"])
  spread={"value":round(b["value"]-a["value"],4),"date":common}
 indicators["yield_spread"]=spread
 statuses=[v["value"] is not None for k,v in indicators.items() if k!="yield_spread"]
 status="OK" if all(statuses) else "PARTIAL"
 data={"schema_version":1,"generated_at":NOW.isoformat(),"source_status":status,"indicators":indicators,"sources":{"fred":"https://fred.stlouisfed.org/","dxy":"Yahoo Finance chart endpoint; delayed/indicative; ICE DXY is the benchmark"}}
 OUT.parent.mkdir(parents=True,exist_ok=True)
 OUT.write_text(json.dumps(data,indent=2),encoding="utf-8")
 print("Wrote",OUT,"status",status)
if __name__=="__main__":main()