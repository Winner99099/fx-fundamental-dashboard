#!/usr/bin/env python3
"""Collect and retain a rolling 90-day archive of official central-bank releases.

The collector uses public RSS/Atom feeds, merges each run with the previous
snapshot, and retains dated releases for 90 days. RSS archives differ by bank;
this is a rolling archive of releases exposed by each feed, not a guarantee
that every bank's complete 90-day website archive is exposed by RSS.
"""
import json
import datetime
import urllib.request
import xml.etree.ElementTree as ET
import re
import hashlib
from email.utils import parsedate_to_datetime
from pathlib import Path
from html import unescape

UTC = datetime.timezone.utc
now = datetime.datetime.now(UTC)
WINDOW_DAYS = 90
cutoff = now - datetime.timedelta(days=WINDOW_DAYS)
DATA_PATH = Path("data/latest.json")

FEEDS = [
    ("Federal Reserve", "https://www.federalreserve.gov/feeds/press_all.xml", "USD"),
    ("European Central Bank", "https://www.ecb.europa.eu/rss/press.html", "EUR"),
    ("Bank of England", "https://www.bankofengland.co.uk/rss/news", "GBP"),
    ("Bank of Japan", "https://www.boj.or.jp/en/rss/whatsnew.xml", "JPY"),
    ("Swiss National Bank", "https://www.snb.ch/public/en/rss/news", "CHF"),
    ("Bank of Canada", "https://www.bankofcanada.ca/content_type/press-releases/feed/", "CAD"),
    ("Reserve Bank of Australia", "https://www.rba.gov.au/rss/rss-cb-media-releases.xml", "AUD"),
    ("Reserve Bank of New Zealand", "https://www.rbnz.govt.nz/feeds/news", "NZD"),
]
CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"]


def fetch(url):
    req = urllib.request.Request(
        url, headers={"User-Agent": "Mozilla/5.0 FXMacroDashboard/1.0"}
    )
    with urllib.request.urlopen(req, timeout=25) as response:
        return response.read()


def parse_date(value):
    if not value:
        return None
    value = value.strip()
    try:
        dt = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        try:
            dt = parsedate_to_datetime(value)
        except (TypeError, ValueError, OverflowError):
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def clean_text(value, limit):
    value = unescape(re.sub(r"<[^>]+>", " ", value or ""))
    return re.sub(r"\s+", " ", value).strip()[:limit]


def event_key(currency, link, title, published_at):
    identity = link.strip() or (title.strip() + "|" + published_at)
    return hashlib.sha256((currency + "|" + identity).encode("utf-8")).hexdigest()[:24]


# Load the previous snapshot first so old releases are not lost when a feed
# rotates its RSS window or becomes temporarily unavailable.
previous_events = []
if DATA_PATH.exists():
    try:
        previous = json.loads(DATA_PATH.read_text(encoding="utf-8"))
        previous_events = previous.get("events", [])
    except Exception:
        previous_events = []

events_by_id = {}
for event in previous_events:
    published = parse_date(event.get("published_at") or event.get("time"))
    if published and cutoff <= published <= now + datetime.timedelta(days=1):
        event["published_at"] = published.isoformat()
        event["time"] = published.isoformat()
        event.setdefault(
            "event_id",
            event_key(
                event.get("currency", ""),
                event.get("url", ""),
                event.get("title", ""),
                published.isoformat(),
            ),
        )
        events_by_id[event["event_id"]] = event

sources = []
for name, url, currency in FEEDS:
    status = "unavailable"
    checked_at = now.isoformat()
    feed_count = 0
    added_count = 0
    try:
        root = ET.fromstring(fetch(url))
        status = "ok"
        items = root.findall(".//item")
        atom = False
        if not items:
            ns = {"a": "http://www.w3.org/2005/Atom"}
            items = root.findall(".//a:entry", ns)
            atom = True

        for item in items:
            def get(tag):
                element = item.find(tag)
                if element is None:
                    return ""
                return "".join(element.itertext()).strip()

            title = get("title")
            if atom:
                published_raw = (
                    get("{http://www.w3.org/2005/Atom}published")
                    or get("{http://www.w3.org/2005/Atom}updated")
                )
                link_element = item.find("{http://www.w3.org/2005/Atom}link")
                link = link_element.attrib.get("href", "") if link_element is not None else ""
                description = get("{http://www.w3.org/2005/Atom}summary")
            else:
                published_raw = get("pubDate") or get("published") or get("date")
                link = get("link")
                description = get("description") or get("summary")

            published = parse_date(published_raw)
            if not title or not published or not (cutoff <= published <= now + datetime.timedelta(days=1)):
                continue

            feed_count += 1
            published_iso = published.isoformat()
            eid = event_key(currency, link, title, published_iso)
            if eid in events_by_id:
                continue

            events_by_id[eid] = {
                "event_id": eid,
                "currency": currency,
                "title": clean_text(title, 220),
                "summary": clean_text(description, 500),
                "url": link or url,
                "time": published_iso,
                "published_at": published_iso,
                "source": name,
                "impact": "High",
            }
            added_count += 1

    except Exception as error:
        status = "error: " + str(error)[:160]

    sources.append({
        "name": name,
        "url": url,
        "status": status,
        "checked_at": checked_at,
        "dated_releases_in_feed_90d": feed_count,
        "new_releases_added": added_count,
    })

events = list(events_by_id.values())
events.sort(key=lambda event: event.get("published_at", ""), reverse=True)

# Scores remain neutral until comparable official macro series and surprise
# data are integrated; news headlines are not converted into invented signals.
currencies = [
    {
        "code": code,
        "score": 0.0,
        "confidence": "Low",
        "summary": "Historical central-bank releases collected; comparable macro surprise / rate-expectation model not yet connected.",
    }
    for code in CURRENCIES
]

output = {
    "generated_at": now.isoformat(),
    "timezone": "UTC (displayed in SGT)",
    "model": "v3.2-90d-central-bank-history",
    "history_window_days": WINDOW_DAYS,
    "currencies": currencies,
    "events": events,
    "sources": sources,
    "limitations": [
        "Events are dated official central-bank RSS/Atom releases retained for a rolling 90-day window.",
        "RSS archive depth varies by central bank; the first run cannot recover older releases that a feed no longer exposes.",
        "Historical records already collected are retained between workflow runs and removed after 90 days.",
        "Scores are neutral placeholders, not trading signals; comparable macro surprises and rate expectations are not yet connected.",
        "Official RSS feeds are not a complete economic calendar and may publish with delay.",
        "GitHub scheduled workflows are best-effort; a five-minute schedule is a target, not a guaranteed interval.",
    ],
}
DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
DATA_PATH.write_text(json.dumps(output, indent=2), encoding="utf-8")
print("Wrote data/latest.json; retained 90-day dated releases:", len(events))
print("Newly discovered releases:", sum(s["new_releases_added"] for s in sources))
