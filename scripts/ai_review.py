#!/usr/bin/env python3
"""Currency momentum + user-selected pair review, using ChatGPT only."""
import datetime as dt, hashlib, json, os, re, urllib.error, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SNAP,OUT=ROOT/"data/latest.json",ROOT/"data/ai_review.json"
CC=["USD","EUR","GBP","JPY","CHF","CAD","AUD","NZD"]
ORDER=["EUR","GBP","AUD","NZD","USD","CAD","CHF","JPY"]
ALL_PAIRS=[ORDER[i]+"/"+ORDER[j] for i in range(8) for j in range(i+1,8)]
MODEL="gpt-6.2-sol"; NOW=dt.datetime.now(dt.timezone.utc)
def read(path,default):
    try:return json.loads(path.read_text(encoding="utf-8"))
    except Exception:return default
def requested_currencies():
    raw=os.getenv("AI_CURRENCIES","").upper().strip()
    currencies=[x for x in re.split(r"[,;\\s]+",raw) if x]
    bad=[x for x in currencies if x not in CC]
    if bad: raise SystemExit("Invalid currency code(s): "+", ".join(bad))
    return list(dict.fromkeys(currencies)) if currencies else CC.copy()
def requested_pairs():
    raw=os.getenv("AI_PAIRS","").upper().strip()
    pairs=[x for x in re.split(r"[,;\s]+",raw) if x]
    bad=[x for x in pairs if x not in ALL_PAIRS]
    if bad:raise SystemExit("Invalid pair(s): "+", ".join(bad))
    return list(dict.fromkeys(pairs))
def compact(snapshot,pairs,currencies):
    fields=("code","score","short_term_score","short_term_score_status","fundamental_trend_score","fundamental_trend_status","fundamental_trend_persistence","fundamental_trend_detail","score_components","policy_rate_display","policy_rate_as_of","inflation","inflation_period","gdp_growth","gdp_growth_period","unemployment","unemployment_period","data_status","confidence","last_release_reference","release_tracker")
    selected=[]
    for c in snapshot.get("currencies",[]):
        if c.get("code") not in currencies: continue
        row={k:c.get(k) for k in fields}
        metrics=c.get("metrics") or {}
        row["metrics"]={name:{"value":v.get("value"),"period":v.get("period"),"history":(v.get("history") or [])[:8],"score":v.get("score"),"label":v.get("label"),"source":v.get("source"),"url":v.get("url")} for name,v in metrics.items() if isinstance(v,dict)}
        selected.append(row)
    event_fields=("currency","title","time","impact","actual","forecast","previous","summary","source","url","bias","direction")
    events=[{k:e.get(k) for k in event_fields} for e in snapshot.get("events",[]) if e.get("currency") in currencies][-40:]
    technical=snapshot.get("pair_technical",{}); pair_data={}
    for pair in pairs:
        t=technical.get(pair) or {}
        pair_data[pair]={k:t.get(k) for k in ("status","source","symbol","updated_at","price","change_1d_pct","change_5d_pct","change_20d_pct","sma20","sma50","rsi14","macd","macd_signal","support_20d","resistance_20d")} if t else {"status":"unavailable"}
    return {"snapshot_generated_at":snapshot.get("generated_at"),"currencies":selected,"recent_events":events,"selected_pair_d1_technical":pair_data}
def prompt_for(currencies,pairs):
    p="""You are ChatGPT acting as a disciplined, evidence-led FX macro and momentum analyst. Use ONLY the supplied dashboard snapshot; do not invent live prices, news, forecasts or market expectations. Return ONLY valid JSON with exactly two maps: currency_reviews (every requested currency) and pair_reviews (only requested pairs; empty map if none).
For each requested currency return bias (BULLISH/BEARISH/NEUTRAL/INSUFFICIENT), confidence, summary (2-3 sentences), drivers (up to 4), risks (up to 3), and exactly four detailed Markdown string sections:
fundamental_view: explain the current macro backdrop using policy rate, inflation versus target where supplied, GDP, labour data and structural score. Distinguish the level of a rate from the expected future policy path; never infer rate expectations without evidence.
momentum_view: directly state whether underlying fundamental momentum is improving, deteriorating, mixed or unavailable. Compare the dated historical series for inflation, GDP and unemployment; cite the actual periods and values that support the direction. Incorporate recent completed releases and actual-versus-forecast only when actual is supplied. Upcoming/pending releases are not results. Do not describe macro trend as spot-price momentum.
chatgpt_assessment: weigh the strongest positive and negative evidence, identify conflicts and data limitations, and explain what matters most over the next several weeks.
overall_conclusion: give a clear BULLISH/BEARISH/NEUTRAL/WAIT/INSUFFICIENT conclusion, confidence, what would strengthen the view, and the principal risk or invalidation condition.
Be specific and analytical, not generic. Do not claim that a currency has risen or fallen in the FX market unless price data is explicitly supplied."""
    if pairs:
        p+="""
For EACH requested pair return bias, confidence, summary, and exactly these four detailed Markdown string sections:
fundamental_view: 2-3 concise paragraphs comparing base versus quote macro conditions, policy, inflation, growth, labour trends and relevant recent events. Explicitly distinguish structural backdrop from fresh momentum.
momentum_view: start with a direct sentence such as "My assessment is that [PAIR] currently has a bearish short-term price momentum bias." Then explain the pair's own D1 evidence in 3 numbered observations where data permits: (a) quote exact 1d/5d/20d percentage changes; (b) compare latest price with SMA20 and SMA50 and quantify distance in percent where possible; (c) quote RSI14 and whether MACD is above/below its signal. Explain what each observation means. Missing metrics must be called unavailable, never estimated.
chatgpt_assessment: 2-3 paragraphs weighing pair price action against the relative fundamental picture. Explicitly identify disagreement and explain which evidence currently carries more weight.
overall_conclusion: concise BULLISH/BEARISH/NEUTRAL/WAIT/INSUFFICIENT conclusion, confidence, what would strengthen the view, and the key risk or invalidation condition. Do not present an entry signal.
PAIR DIRECTION MUST be based primarily on that pair's own D1 price evidence. Macro scores NEVER override contradictory price action. Technical data missing or older than 36 hours means INSUFFICIENT for technical direction; explicitly flag stale data. Conflicting D1 signals mean NEUTRAL/WAIT. No H4 data is supplied; do not claim H4 confirmation."""
    else:
        p+="\\nNo pair review requested; return an empty pair_reviews map."
    return p+"\\nKeep the assessment practical and evidence-led. Research commentary only, not a trade instruction."
def parse(text):
    text=(text or "").strip(); a,b=text.find("{"),text.rfind("}")
    if a<0 or b<=a:raise ValueError("No JSON object returned")
    return json.loads(text[a:b+1])
def validate(review,currencies,pairs):
    cr,pr=review.get("currency_reviews",{}),review.get("pair_reviews",{})
    if not isinstance(cr,dict) or not isinstance(pr,dict) or not all(c in cr for c in currencies) or not all(p in pr for p in pairs): raise ValueError("Incomplete AI response")
    allowed={"BULLISH","BEARISH","NEUTRAL","INSUFFICIENT","WAIT"}
    def clean(x,pair=False):
        x=x if isinstance(x,dict) else {}; bias=str(x.get("bias","INSUFFICIENT")).upper()
        if bias not in allowed: bias="INSUFFICIENT"
        out={"bias":bias,"confidence":str(x.get("confidence","Low"))[:20],"summary":str(x.get("summary",""))[:700],"drivers":[str(v)[:300] for v in x.get("drivers",[])[:4]] if isinstance(x.get("drivers",[]),list) else [],"risks":[str(v)[:300] for v in x.get("risks",[])[:3]] if isinstance(x.get("risks",[]),list) else []}
        if True:
            limits={"fundamental_view":2400,"momentum_view":3200,"chatgpt_assessment":2400,"overall_conclusion":1600}
            for k,limit in limits.items():
                value=x.get(k,"")
                if not isinstance(value,str) or not value.strip(): raise ValueError("Missing required analysis section: "+k)
                out[k]=value[:limit]
        return out
    return {"currency_reviews":{c:clean(cr[c]) for c in currencies},"pair_reviews":{p:clean(pr[p],True) for p in pairs}}
def call(api_key,data,prompt,currencies,pairs):
    body={"model":MODEL,"reasoning":{"effort":"medium"},"instructions":prompt,"input":json.dumps(data,ensure_ascii=False,separators=(",",":")),"max_output_tokens":min(30000,4500+1100*len(currencies)+1350*len(pairs))}
    req=urllib.request.Request("https://api.openai.com/v1/responses",data=json.dumps(body).encode(),headers={"Authorization":"Bearer "+api_key,"Content-Type":"application/json"},method="POST")
    with urllib.request.urlopen(req,timeout=180) as r:payload=json.loads(r.read().decode())
    chunks=[v.get("text","") for item in payload.get("output",[]) for v in item.get("content",[]) if v.get("type")=="output_text"]
    return validate(parse("\n".join(chunks) or payload.get("output_text","")),pairs)
def main():
    snap=read(SNAP,{})
    if not snap.get("currencies"): raise SystemExit("No currency snapshot found")
    currencies=requested_currencies(); pairs=requested_pairs()
    if not currencies: raise SystemExit("Select at least one currency")
    data=compact(snap,pairs,currencies); prompt=prompt_for(currencies,pairs)
    fp=hashlib.sha256(json.dumps({"data":data,"prompt":prompt,"model":MODEL,"currencies":currencies,"pairs":pairs},sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    old=read(OUT,{})
    provider=(old.get("providers") or {}).get("chatgpt") or {}
    oldrev=provider.get("review") or {"currency_reviews":old.get("currency_reviews",{}),"pair_reviews":old.get("pair_reviews",{})}
    try: age=(NOW-dt.datetime.fromisoformat(old.get("generated_at","").replace("Z","+00:00"))).total_seconds()/3600
    except Exception: age=999999
    if os.getenv("AI_FORCE","").lower() not in ("1","true","yes") and old.get("input_fingerprint")==fp and age<4 and old.get("status")=="ok":
        print("Skipped: unchanged successful inputs younger than four hours"); return
    key=os.getenv("OPENAI_API_KEY")
    if not key: raise SystemExit("OPENAI_API_KEY is not configured")
    try:
        fresh=call(key,data,prompt,currencies,pairs)
        merged_currencies=dict(oldrev.get("currency_reviews") or {}); merged_currencies.update(fresh["currency_reviews"])
        merged_pairs=dict(oldrev.get("pair_reviews") or {}); merged_pairs.update(fresh["pair_reviews"])
        merged={"currency_reviews":merged_currencies,"pair_reviews":merged_pairs}
        out={"schema_version":4,"status":"ok","generated_at":NOW.isoformat(),"last_attempt_at":NOW.isoformat(),"input_snapshot_generated_at":snap.get("generated_at"),"input_fingerprint":fp,"last_requested_currencies":currencies,"last_requested_pairs":pairs,"model":MODEL,"providers":{"chatgpt":{"status":"ok","model":MODEL,"message":str(len(currencies))+" currency momentum review(s) refreshed"+(" · "+str(len(pairs))+" selected pair(s) reviewed" if pairs else " · currency-only analysis"),"review":merged}},"currency_reviews":merged_currencies,"pair_reviews":merged_pairs,"methodology":"Currency reviews use dated macro history and verified completed releases. Pair direction additionally requires fresh pair-specific D1 price evidence; macro scores do not override price action."}
        OUT.write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding="utf-8")
        print("Completed:",len(currencies),"currencies and",len(pairs),"pairs")
    except Exception as e:
        message=("ChatGPT HTTP "+str(e.code)+": "+e.read().decode("utf-8","replace")[:700]) if isinstance(e,urllib.error.HTTPError) else str(e)
        failed=dict(old)
        failed.update({"schema_version":4,"status":"error","last_attempt_at":NOW.isoformat(),"last_error":message,"last_requested_currencies":currencies,"last_requested_pairs":pairs})
        providers=dict(failed.get("providers") or {})
        providers["chatgpt"]={"status":"error","model":MODEL,"message":message,"review":oldrev}
        failed["providers"]=providers
        OUT.write_text(json.dumps(failed,indent=2,ensure_ascii=False),encoding="utf-8")
        raise SystemExit(message)
if __name__=="__main__":main()
