#!/usr/bin/env python3
import datetime as dt, hashlib, json, os, urllib.error, urllib.parse, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SNAP=ROOT/"data/latest.json"; OUT=ROOT/"data/ai_review.json"
CC=["USD","EUR","GBP","JPY","CHF","CAD","AUD","NZD"]
PAIR_ORDER=["EUR","GBP","AUD","NZD","USD","CAD","CHF","JPY"]
PAIRS=[PAIR_ORDER[i]+"/"+PAIR_ORDER[j] for i in range(8) for j in range(i+1,8)]
NOW=dt.datetime.now(dt.timezone.utc)
PROMPT="""Analyze all 8 currencies and 28 FX pairs using only supplied data. Never invent facts. Separate fundamental bias from short-term momentum and explain divergence. Infer D1 only from daily indicators; no H4 data is supplied, so say what to watch for, not that a setup exists. Missing or stale inputs lower confidence. Not a trade instruction. Return ONLY JSON with currency_reviews and pair_reviews. Currency items: bias (BULLISH/BEARISH/NEUTRAL/INSUFFICIENT), confidence, summary, drivers array, risks array. Pair items: same fields plus fundamental_view, momentum_view, d1_view, h4_watch, key_catalysts array. Include all 8 currency codes and all 28 pair keys."""
def read(p,d):
 try:return json.loads(p.read_text(encoding="utf-8"))
 except Exception:return d
def payload(s):
 cs=[]
 for c in s.get("currencies",[]):
  cs.append({k:c.get(k) for k in ("code","score","short_term_score","fundamental_trend_score","fundamental_trend_persistence","fundamental_trend_detail","policy_rate","policy_rate_display","policy_rate_as_of","inflation","inflation_period","gdp_growth","gdp_growth_period","unemployment","unemployment_period","data_status","confidence","metrics")})
 ev=[{k:e.get(k) for k in ("currency","title","time","impact","actual","forecast","previous","summary","source","url")} for e in s.get("events",[])][-40:]
 tech=s.get("pair_technical",{})
 return {"snapshot_generated_at":s.get("generated_at"),"currencies":cs,"recent_events":ev,"pair_d1_technical":{p:tech.get(p,{"status":"unavailable"}) for p in PAIRS}}
def parse(t):
 t=(t or "").strip(); a,b=t.find("{"),t.rfind("}")
 if a<0 or b<=a:raise ValueError("No JSON object returned")
 return json.loads(t[a:b+1])
def valid(o):
 cr=o.get("currency_reviews",{}); pr=o.get("pair_reviews",{})
 if not isinstance(cr,dict) or not isinstance(pr,dict):raise ValueError("Missing review maps")
 allowed={"BULLISH","BEARISH","NEUTRAL","INSUFFICIENT"}
 def clean(x,pair=False):
  x=x if isinstance(x,dict) else {}; bias=str(x.get("bias","INSUFFICIENT")).upper()
  if bias not in allowed:bias="INSUFFICIENT"
  def v(k):
   z=x.get(k,"")
   return [str(y)[:200] for y in z[:5]] if isinstance(z,list) else str(z or "")[:650]
  r={"bias":bias,"confidence":str(x.get("confidence","Low"))[:20],"summary":v("summary"),"drivers":v("drivers"),"risks":v("risks")}
  if pair:
   for k in ("fundamental_view","momentum_view","d1_view","h4_watch","key_catalysts"):r[k]=v(k)
  return r
 c={k:clean(cr[k]) for k in CC if k in cr}; p={k:clean(pr[k],True) for k in PAIRS if k in pr}
 if len(c)<6 or len(p)<20:raise ValueError("Incomplete reviews: "+str(len(c))+" currencies / "+str(len(p))+" pairs")
 return {"currency_reviews":c,"pair_reviews":p}
def openai(key,data):
 body={"model":"gpt-6-luna","reasoning":{"effort":"low"},"instructions":PROMPT,"input":json.dumps(data,ensure_ascii=False),"max_output_tokens":12000}
 req=urllib.request.Request("https://api.openai.com/v1/responses",data=json.dumps(body).encode(),headers={"Authorization":"Bearer "+key,"Content-Type":"application/json"},method="POST")
 with urllib.request.urlopen(req,timeout=180) as r:d=json.loads(r.read().decode())
 texts=[p.get("text","") for x in d.get("output",[]) for p in x.get("content",[]) if p.get("type")=="output_text"]
 return valid(parse("\n".join(texts) or d.get("output_text","")))
def gemini(key,data):
 url="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
 body={"systemInstruction":{"parts":[{"text":PROMPT}]},"contents":[{"role":"user","parts":[{"text":json.dumps(data,ensure_ascii=False)}]}],"generationConfig":{"temperature":0.2,"maxOutputTokens":12000,"responseMimeType":"application/json"}}
 req=urllib.request.Request(url,data=json.dumps(body).encode(),headers={"Content-Type":"application/json","x-goog-api-key":key},method="POST")
 with urllib.request.urlopen(req,timeout=180) as r:d=json.loads(r.read().decode())
 parts=d.get("candidates",[{}])[0].get("content",{}).get("parts",[])
 return valid(parse("\n".join(x.get("text","") for x in parts)))
def provider(name,key,fn,data,old):
 if not key:return old,{"status":"not_configured","model":name,"message":"Add this API key as a GitHub Actions secret."}
 try:return fn(key,data),{"status":"ok","model":name,"message":"Review completed."}
 except urllib.error.HTTPError as e:return old,{"status":"error","model":name,"message":"HTTP "+str(e.code)+": "+e.read().decode("utf-8","replace")[:300]}
 except Exception as e:return old,{"status":"error","model":name,"message":str(e)[:300]}
def consensus(a,b):
 if a and b:
  if a==b and a!="INSUFFICIENT":return {"status":"AGREE","bias":a}
  if a==b:return {"status":"BOTH_INSUFFICIENT","bias":a}
  return {"status":"DISAGREE","bias":"MIXED"}
 return {"status":"ONE_MODEL_ONLY" if (a or b) else "NO_REVIEW","bias":a or b or "INSUFFICIENT"}
def main():
 s=read(SNAP,{})
 if not s.get("currencies"):raise SystemExit("No currency snapshot found.")
 data=payload(s); fp=hashlib.sha256(json.dumps(data,sort_keys=True,ensure_ascii=False).encode()).hexdigest(); old=read(OUT,{})
 try:age=(NOW-dt.datetime.fromisoformat(old["generated_at"].replace("Z","+00:00"))).total_seconds()
 except Exception:age=999999
 if old.get("input_fingerprint")==fp and age<14400 and old.get("pair_reviews"):
  print("AI review skipped: unchanged inputs and review younger than four hours.");return
 oldp=old.get("providers",{})
 a,ast=provider("gpt-6-luna",os.getenv("OPENAI_API_KEY"),openai,data,(oldp.get("chatgpt") or {}).get("review"))
 b,bst=provider("gemini-2.5-flash",os.getenv("GEMINI_API_KEY"),gemini,data,(oldp.get("gemini") or {}).get("review"))
 ca=a.get("currency_reviews",{}) if a else {}; cb=b.get("currency_reviews",{}) if b else {}; pa=a.get("pair_reviews",{}) if a else {}; pb=b.get("pair_reviews",{}) if b else {}
 cc={k:consensus(ca.get(k,{}).get("bias"),cb.get(k,{}).get("bias")) for k in CC}; pc={k:consensus(pa.get(k,{}).get("bias"),pb.get(k,{}).get("bias")) for k in PAIRS}
 primary=a or b or {}; n=int(bool(a))+int(bool(b))
 out={"schema_version":1,"generated_at":NOW.isoformat(),"input_snapshot_generated_at":s.get("generated_at"),"input_fingerprint":fp,"status":"ok" if n==2 else "partial" if n==1 else "awaiting_api_keys","providers":{"chatgpt":dict(ast,review=a),"gemini":dict(bst,review=b)},"currency_consensus":cc,"pair_consensus":pc,"currency_reviews":primary.get("currency_reviews",{}),"pair_reviews":primary.get("pair_reviews",{}),"methodology":"Independent qualitative overlays on the same frozen data snapshot. Consensus is categorical agreement, not probability or a validated trading signal."}
 OUT.parent.mkdir(exist_ok=True); OUT.write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding="utf-8")
 print("AI review:",out["status"],"ChatGPT:",ast["status"],"Gemini:",bst["status"])
if __name__=="__main__":main()
