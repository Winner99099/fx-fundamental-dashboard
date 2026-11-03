#!/usr/bin/env python3
"""Builds a transparent, free-source macro snapshot. No paid feeds or API keys.
Scores are deliberately conservative proxies based on the latest official policy rates
and available official RSS headlines; they are not a full real-time FX fair-value model.
"""
import json, datetime, urllib.request, xml.etree.ElementTree as ET, re
from pathlib import Path
UTC=datetime.timezone.utc
now=datetime.datetime.now(UTC)
# Public official RSS sources. Feed availability/format can change.
FEEDS=[
 ("Federal Reserve","https://www.federalreserve.gov/feeds/press_all.xml","USD","high"),
 ("European Central Bank","https://www.ecb.europa.eu/rss/press.html","EUR","high"),
 ("Bank of England","https://www.bankofengland.co.uk/rss/news","GBP","high"),
 ("Bank of Japan","https://www.boj.or.jp/en/rss/whatsnew.xml","JPY","high"),
 ("Swiss National Bank","https://www.snb.ch/public/en/rss/news","CHF","high"),
 ("Bank of Canada","https://www.bankofcanada.ca/content_type/press-releases/feed/","CAD","high"),
 ("Reserve Bank of Australia","https://www.rba.gov.au/rss/rss-cb-media-releases.xml","AUD","high"),
 ("Reserve Bank of New Zealand","https://www.rbnz.govt.nz/feeds/news","NZD","high"),
]
# Approximate policy-rate anchors are intentionally labelled reference-only and should
# be maintained from official policy pages; no inference from headline sentiment.
# Rate levels alone are not a currency strength ranking.
BASE={c:0.0 for c in ["USD","EUR","GBP","JPY","CHF","CAD","AUD","NZD"]}
def fetch(url):
 req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 FXMacroDashboard/1.0"})
 with urllib.request.urlopen(req,timeout=18) as r:return r.read()
events=[];sources=[]
for name,url,ccy,impact in FEEDS:
 status="unavailable"; checked=now.isoformat()
 try:
  raw=fetch(url); root=ET.fromstring(raw); status="ok"
  items=root.findall(".//item")
  if not items:
   ns={"a":"http://www.w3.org/2005/Atom"}
   items=root.findall(".//a:entry",ns)
  for item in items[:8]:
   def get(tag):
    el=item.find(tag)
    if el is None:return ""
    return "".join(el.itertext()).strip()
   title=get("title")
   link=get("link")
   if not link:
    linkel=item.find("{http://www.w3.org/2005/Atom}link")
    if linkel is not None:link=linkel.attrib.get("href","")
   desc=re.sub("<[^>]+>"," ",get("description") or get("{http://www.w3.org/2005/Atom}summary"))
   if title:events.append({"currency":ccy,"title":title[:220],"summary":re.sub(r"\s+"," ",desc)[:300],"url":link or url,"time":get("pubDate") or get("{http://www.w3.org/2005/Atom}updated"),"impact":"High"})
 except Exception as e:status="error: "+str(e)[:120]
 sources.append({"name":name,"url":url,"status":status,"checked_at":checked})
# This first free build intentionally does not manufacture directional scores from headlines.
# Neutral scores are shown until reliable, comparable macro series are wired in.
currencies=[{"code":c,"score":BASE[c],"confidence":"Low","summary":"Official news feed monitored; comparable macro surprise / rate-expectation model not yet connected."} for c in BASE]
events.sort(key=lambda e:e.get("time",""),reverse=True)
out={"generated_at":now.isoformat(),"timezone":"UTC (displayed in SGT)","model":"v2-free-source-bootstrap","currencies":currencies,"events":events[:60],"sources":sources,"limitations":["Scores are neutral placeholders, not live fundamental signals.","Official RSS feeds are not a comprehensive economic calendar and may publish with delay.","No consensus forecast / actual surprise data, CFTC positioning, yield curves or FX spot feed is included yet.","GitHub scheduled workflow is best-effort; refresh cadence is not guaranteed."]}
Path("data/latest.json").write_text(json.dumps(out,indent=2),encoding="utf-8")
print("Wrote data/latest.json; events:",len(events))
