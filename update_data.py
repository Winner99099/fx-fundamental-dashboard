#!/usr/bin/env python3
"""Build a transparent FX macro/news snapshot from official central-bank RSS feeds.

No API keys or fabricated macro values. This collector intentionally leaves numerical
fundamental scores and macro indicators null until comparable, sourced series are integrated.
"""
import datetime as dt
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

UTC=dt.timezone.utc
NOW=dt.datetime.now(UTC)
CURRENCIES=["USD","EUR","GBP","JPY","CHF","CAD","AUD","NZD"]
FEEDS=[
 ("Federal Reserve","https://www.federalreserve.gov/feeds/press_all.xml","USD"),
 ("European Central Bank","https://www.ecb.europa.eu/rss/press.html","EUR"),
 ("Bank of England","https://www.bankofengland.co.uk/rss/news","GBP"),
 ("Bank of Japan","https://www.boj.or.jp/en/rss/whatsnew.xml","JPY"),
 ("Swiss National Bank","https://www.snb.ch/public/en/rss/news","CHF"),
 ("Bank of Canada","https://www.bankofcanada.ca/content_type/press-releases/feed/","CAD"),
 ("Reserve Bank of Australia","https://www.rba.gov.au/rss/rss-cb-media-releases.xml","AUD"),
 ("Reserve Bank of New Zealand","https://www.rbnz.govt.nz/feeds/news","NZD"),
]
ATOM="{http://www.w3.org/2005/Atom}"
def clean(s):
    return re.sub(r"\s+"," ",re.sub(r"<[^>]*>"," ",s or "")).strip()
def fetch_feed(name,url,ccy):
    checked=NOW.isoformat()
    try:
        req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 MacroPulseFX/3.0"})
        with urllib.request.urlopen(req,timeout=20) as response:
            raw=response.read()
        root=ET.fromstring(raw)
        items=root.findall(".//item") or root.findall(f".//{ATOM}entry")
        events=[]
        for item in items[:12]:
            title=clean(item.findtext("title") or item.findtext(f"{ATOM}title"))
            if not title: continue
            link=item.findtext("link") or ""
            atom_link=item.find(f"{ATOM}link")
            if atom_link is not None: link=atom_link.attrib.get("href",link)
            summary=item.findtext("description") or item.findtext(f"{ATOM}summary") or item.findtext(f"{ATOM}content") or ""
            when=item.findtext("pubDate") or item.findtext(f"{ATOM}updated") or item.findtext(f"{ATOM}published") or ""
            events.append({"currency":ccy,"source":name,"title":title[:240],"summary":clean(summary)[:420],
                           "url":link or url,"time":clean(when),"impact":"Unclassified"})
        return events,{"name":name,"url":url,"status":"ok","checked_at":checked,"items_found":len(events)}
    except Exception as exc:
        return [],{"name":name,"url":url,"status":"error: "+str(exc)[:160],"checked_at":checked,"items_found":0}

events=[]; sources=[]
for name,url,ccy in FEEDS:
    found,source=fetch_feed(name,url,ccy)
    events.extend(found);sources.append(source)
events.sort(key=lambda e:e.get("time",""),reverse=True)
currencies=[{"code":c,"score":None,"bias":"UNRANKED","policy_rate":None,"inflation":None,
             "gdp_growth":None,"unemployment":None,"confidence":"Low","data_status":"Macro series not connected",
             "summary":"No comparable, current official macro series loaded; directional score withheld."} for c in CURRENCIES]
out={"schema_version":3,"generated_at":NOW.isoformat(),"timezone":"UTC (display in SGT)",
     "model":"v3-official-rss-transparent","refresh_target_hours":4,"currencies":currencies,
     "events":events[:100],"sources":sources,
     "limitations":[
       "Numerical currency scores are intentionally null; no comparable macro series or rate-expectation model is connected.",
       "Official central-bank RSS feeds are news sources, not a complete economic calendar or consensus/actual release database.",
       "CFTC positioning, yield curves, FX spot prices and market confirmation are not yet integrated.",
       "GitHub Actions scheduled runs are best-effort and may be delayed; browser polling does not trigger a new data build."
     ]}
Path("data/latest.json").write_text(json.dumps(out,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
Path("latest.json").write_text(json.dumps(out,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
print(f"Snapshot built: {len(events)} official releases; {sum(s['status']=='ok' for s in sources)}/{len(sources)} feeds responding.")
