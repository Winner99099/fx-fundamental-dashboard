#!/usr/bin/env python3
"""Currency momentum + user-selected pair review, using ChatGPT only."""
import datetime as dt, hashlib, json, os, re, urllib.error, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SNAP,OUT=ROOT/"data/latest.json",ROOT/"data/ai_review.json"
CC=["USD","EUR","GBP","JPY","CHF","CAD","AUD","NZD"]
ORDER=["EUR","GBP","AUD","NZD","USD","CAD","CHF","JPY"]
ALL_PAIRS=[ORDER[i]+"/"+ORDER[j] for i in range(8) for j in range(i+1,8)]
MODEL="gpt-6-luna"; NOW=dt.datetime.now(dt.timezone.utc)
def read(path,default):
    try:return json.loads(path.read_text(encoding="utf-8"))
    except Exception:return default
def requested_pairs():
    raw=os.getenv("AI_PAIRS","").upper().strip()
    pairs=[x for x in re.split(r"[,;\\s]+",raw) if x]
    bad=[x for x in pairs if x not in ALL_PAIRS]
    if bad:raise SystemExit("Invalid pair(s): "+", ".join(bad))
    return list(dict.fromkeys(pairs))
def compact(snapshot,pairs):
    fields=("code","score","short_term_score","fundamental_trend_score","fundamental_trend_persistence","fundamental_trend_detail","policy_rate_display","inflation","inflation_period","gdp_growth","gdp_growth_period","unemployment","unemployment_period","data_status","confidence")
    currencies=[{k:c.get(k) for k in fields}|{"latest_release":c.get("last_release_reference")} for c in snapshot.get("currencies",[])]
    event_fields=("currency","title","time","impact","actual","forecast","previous","summary","source")
    events=[{k:e.get(k) for k in event_fields} for e in snapshot.get("events",[])[-24:]]
    technical=snapshot.get("pair_technical",{}); pair_data={}
    for pair in pairs:
        t=technical.get(pair) or {}
        pair_data[pair]={k:t.get(k) for k in ("status","source","symbol","updated_at","price","change_1d_pct","change_5d_pct","change_20d_pct","sma20","sma50","rsi14","macd","macd_signal","support_20d","resistance_20d")} if t else {"status":"unavailable"}
    return {"snapshot_generated_at":snapshot.get("generated_at"),"currencies":currencies,"recent_events":events,"selected_pair_d1_technical":pair_data}
def prompt_for(pairs):
    p="""You are an FX momentum analyst. Use ONLY the supplied dashboard snapshot. Return ONLY valid JSON with exactly two maps: currency_reviews (all 8 currency codes) and pair_reviews (only requested pair keys; empty map if none).
For each currency return bias (BULLISH/BEARISH/NEUTRAL/INSUFFICIENT), confidence, summary (max 2 concise sentences), drivers (max 3), risks (max 2). Distinguish macro trend from confirmed recent release momentum. Do not claim spot momentum without pair-price evidence."""
    if pairs:
        p+="""
For each requested pair return bias, confidence, and ONLY four analysis sections: fundamental_view (relative macro bias of base vs quote), momentum_view (short-term momentum), chatgpt_assessment (integrated assessment), overall_conclusion (clear direction and confidence, or WAIT/INSUFFICIENT). Pair direction is determined primarily by its own D1 data: 1d/5d/20d returns, price vs SMA20/SMA50, RSI14 and MACD vs signal. Macro scores NEVER override contradictory price action. Missing/unavailable or older-than-36h technical data means INSUFFICIENT. Conflicting signals mean NEUTRAL. Upcoming events are pending, never results. No H4 data is supplied; do not claim H4 confirmation. Do not invent facts."""
    else:p+="\nNo pair review requested; return an empty pair_reviews map."
    return p+"\nKeep concise. Research commentary, not a trade instruction."
def parse(text):
    text=(text or "").strip(); a,b=text.find("{"),text.rfind("}")
    if a<0 or b<=a:raise ValueError("No JSON object returned")
    return json.loads(text[a:b+1])
def validate(review,pairs):
    cr,pr=review.get("currency_reviews",{}),review.get("pair_reviews",{})
    if not isinstance(cr,dict) or not isinstance(pr,dict) or not all(c in cr for c in CC) or not all(p in pr for p in pairs):raise ValueError("Incomplete AI response")
    allowed={"BULLISH","BEARISH","NEUTRAL","INSUFFICIENT"}
    def clean(x,pair=False):
        x=x if isinstance(x,dict) else {}; bias=str(x.get("bias","INSUFFICIENT")).upper()
        if bias not in allowed:bias="INSUFFICIENT"
        out={"bias":bias,"confidence":str(x.get("confidence","Low"))[:20],"summary":str(x.get("summary",""))[:500],"drivers":[str(v)[:260] for v in x.get("drivers",[])[:3]] if isinstance(x.get("drivers",[]),list) else [],"risks":[str(v)[:260] for v in x.get("risks",[])[:2]] if isinstance(x.get("risks",[]),list) else []}
        if pair:
            for k in ("fundamental_view","momentum_view","chatgpt_assessment","overall_conclusion"):out[k]=str(x.get(k,""))[:650]
        return out
    return {"currency_reviews":{c:clean(cr[c]) for c in CC},"pair_reviews":{p:clean(pr[p],True) for p in pairs}}
def call(api_key,data,prompt,pairs):
    body={"model":MODEL,"reasoning":{"effort":"low"},"instructions":prompt,"input":json.dumps(data,ensure_ascii=False,separators=(",",":")),"max_output_tokens":min(10000,2600+950*len(pairs))}
    req=urllib.request.Request("https://api.openai.com/v1/responses",data=json.dumps(body).encode(),headers={"Authorization":"Bearer "+api_key,"Content-Type":"application/json"},method="POST")
    with urllib.request.urlopen(req,timeout=180) as r:payload=json.loads(r.read().decode())
    chunks=[v.get("text","") for item in payload.get("output",[]) for v in item.get("content",[]) if v.get("type")=="output_text"]
    return validate(parse("\\n".join(chunks) or payload.get("output_text","")),pairs)
def main():
    snap=read(SNAP,{})
    if not snap.get("currencies"):raise SystemExit("No currency snapshot found")
    pairs=requested_pairs(); data=compact(snap,pairs); prompt=prompt_for(pairs)
    fp=hashlib.sha256(json.dumps({"data":data,"prompt":prompt,"model":MODEL},sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    old=read(OUT,{}); provider=(old.get("providers") or {}).get("chatgpt") or {}
    oldrev=provider.get("review") or {"currency_reviews":old.get("currency_reviews",{}),"pair_reviews":old.get("pair_reviews",{})}
    try:age=(NOW-dt.datetime.fromisoformat(old.get("generated_at","").replace("Z","+00:00"))).total_seconds()/3600
    except Exception:age=999999
    if old.get("input_fingerprint")==fp and age<4 and old.get("status")=="ok":
        print("Skipped: unchanged successful inputs younger than four hours");return
    key=os.getenv("OPENAI_API_KEY")
    if not key:raise SystemExit("OPENAI_API_KEY is not configured")
    try:
        fresh=call(key,data,prompt,pairs); merged_pairs=dict(oldrev.get("pair_reviews") or {}); merged_pairs.update(fresh["pair_reviews"])
        merged={"currency_reviews":fresh["currency_reviews"],"pair_reviews":merged_pairs}
        out={"schema_version":3,"status":"ok","generated_at":NOW.isoformat(),"last_attempt_at":NOW.isoformat(),"input_snapshot_generated_at":snap.get("generated_at"),"input_fingerprint":fp,"last_requested_pairs":pairs,"model":MODEL,"providers":{"chatgpt":{"status":"ok","model":MODEL,"message":"Eight currencies refreshed"+(" · "+str(len(pairs))+" selected pairs reviewed" if pairs else " · currency-only run"),"review":merged}},"currency_reviews":merged["currency_reviews"],"pair_reviews":merged_pairs,"methodology":"Eight-currency momentum refreshed on schedule; pair analysis is generated only for selected pairs using pair-specific D1 evidence."}
        OUT.write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding="utf-8")
        print("Completed: 8 currencies and",len(pairs),"selected pairs")
    except urllib.error.HTTPError as e:raise SystemExit("ChatGPT HTTP "+str(e.code)+": "+e.read().decode("utf-8","replace")[:500])
if __name__=="__main__":main()
