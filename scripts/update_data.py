#!/usr/bin/env python3
"""MacroPulse V3.3: official news archive + comparable World Bank macro indicators.

The macro score is deliberately a partial score until policy-rate expectations
and release-surprise data are connected. Missing inputs are null, never zero.
"""
import json
import csv
import io
import datetime
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import re
import hashlib
import math
from email.utils import parsedate_to_datetime
from pathlib import Path
from html import unescape
import statistics

UTC = datetime.timezone.utc
now = datetime.datetime.now(UTC)
WINDOW_DAYS = 90
cutoff = now - datetime.timedelta(days=WINDOW_DAYS)
DATA_PATH = Path("data/latest.json")
CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"]

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

# Currency area / country proxy. EUR uses the World Bank euro-area aggregate.
WB_COUNTRIES = {
    "USD": ("USA", "United States"),
    "EUR": ("EMU", "Euro area"),
    "GBP": ("GBR", "United Kingdom"),
    "JPY": ("JPN", "Japan"),
    "CHF": ("CHE", "Switzerland"),
    "CAD": ("CAN", "Canada"),
    "AUD": ("AUS", "Australia"),
    "NZD": ("NZL", "New Zealand"),
}
INDICATORS = {
    "inflation": ("FP.CPI.TOTL.ZG", "Inflation, consumer prices (annual %)"),
    "gdp_growth": ("NY.GDP.MKTP.KD.ZG", "GDP growth (annual %)"),
    "unemployment": ("SL.UEM.TOTL.ZS", "Unemployment, total (% of labour force)"),
}
WEIGHTS = {"inflation": 25.0, "gdp_growth": 20.0, "unemployment": 15.0}

# Headline policy rates verified against central-bank publications on 10 Nov 2026.
# USD uses the upper end of the Fed target range for numeric comparisons; the
# display label preserves the full target range. Recheck after each policy decision.
POLICY_RATES = {
    "USD": {"value": 4.00, "display": "3.75–4.00%", "basis": "Fed target range", "as_of": "2026-10-29", "url": "https://www.federalreserve.gov/economy-at-a-glance-policy-rate.htm"},
    "EUR": {"value": 2.50, "display": "2.50%", "basis": "ECB deposit facility", "as_of": "2026-09-16", "url": "https://www.ecb.europa.eu/press/pr/date/2026/html/index.en.html"},
    "GBP": {"value": 4.00, "display": "4.00%", "basis": "BoE Bank Rate", "as_of": "2026-11-05", "url": "https://www.bankofengland.co.uk/monetary-policy-summary-and-minutes/2026/november-2026"},
    "JPY": {"value": 1.25, "display": "1.25%", "basis": "BoJ short-term policy rate", "as_of": "2026-10-30", "url": "https://www.boj.or.jp/en/"},
    "CHF": {"value": 0.00, "display": "0.00%", "basis": "SNB policy rate", "as_of": "2026-09-24", "url": "https://www.snb.ch/en/"},
    "CAD": {"value": 2.50, "display": "2.50%", "basis": "BoC overnight rate target", "as_of": "2026-10-28", "url": "https://www.bankofcanada.ca/2026/10/fad-press-release-2026-10-28/"},
    "AUD": {"value": 4.85, "display": "4.85%", "basis": "RBA cash rate target", "as_of": "2026-11-04", "url": "https://www.rba.gov.au/"},
    "NZD": {"value": 2.75, "display": "2.75%", "basis": "RBNZ official cash rate", "as_of": "2026-10-28", "url": "https://www.rbnz.govt.nz/"},
}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "MacroPulseFXDashboard/3.3 (public-data research)"})
    with urllib.request.urlopen(req, timeout=30) as response:
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


def fetch_world_bank(country, indicator):
    url = (
        "https://api.worldbank.org/v2/country/"
        + urllib.parse.quote(country)
        + "/indicator/"
        + urllib.parse.quote(indicator)
        + "?format=json&per_page=20"
    )
    payload = json.loads(fetch(url).decode("utf-8"))
    if not isinstance(payload, list) or len(payload) < 2 or not payload[1]:
        return []
    values = []
    for row in payload[1]:
        value = row.get("value")
        year = row.get("date")
        if value is not None and year:
            try:
                values.append({"year": int(year), "value": float(value)})
            except (TypeError, ValueError):
                pass
    return sorted(values, key=lambda x: x["year"], reverse=True)


def clamp(value, low=-5.0, high=5.0):
    return max(low, min(high, value))


def component_score(values, direction):
    # Compare the latest annual reading with the preceding five observations.
    if len(values) < 3:
        return None
    latest = values[0]["value"]
    history = [x["value"] for x in values[1:6]]
    if len(history) < 2:
        return None
    baseline = statistics.median(history)
    dispersion = statistics.pstdev(history)
    if dispersion < 0.05:
        dispersion = max(abs(baseline) * 0.05, 0.25)
    delta = (latest - baseline) / dispersion
    if direction == "lower_is_better":
        delta = -delta
    # Smooth and cap extreme annual observations; output is a -5 to +5 component.
    return round(clamp(5.0 * math.tanh(delta / 2.0)), 2)



OECD_AREAS = {
    "USD": "USA", "EUR": "EA20", "GBP": "GBR", "JPY": "JPN",
    "CHF": "CHE", "CAD": "CAN", "AUD": "AUS", "NZD": "NZL",
}

def fetch_oecd_csv(url):
    raw = fetch(url).decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(raw)))

def latest_oecd_rows(rows):
    grouped = {}
    for row in rows:
        area = (row.get("REF_AREA") or row.get("Reference area") or "").strip()
        period = (row.get("TIME_PERIOD") or row.get("Time period") or "").strip()
        raw_value = row.get("OBS_VALUE") or row.get("Observation value") or ""
        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            continue
        if not area or not period:
            continue
        grouped.setdefault(area, []).append({"period": period, "value": value})
    return {
        area: sorted(values, key=lambda x: x["period"])[-6:][::-1]
        for area, values in grouped.items()
    }

OECD_HIGH_FREQUENCY_CACHE = None

def fetch_oecd_high_frequency():
    """Return latest comparable monthly/quarterly CPI and quarterly real GDP YoY."""
    global OECD_HIGH_FREQUENCY_CACHE
    if OECD_HIGH_FREQUENCY_CACHE is not None:
        return OECD_HIGH_FREQUENCY_CACHE
    base = "https://sdmx.oecd.org/public/rest/data/"
    monthly_areas = "+".join(OECD_AREAS[c] for c in CURRENCIES if c not in ("AUD", "NZD", "EUR", "JPY"))
    quarterly_areas = "+".join(OECD_AREAS[c] for c in ("AUD", "NZD"))
    cpi_monthly_url = (
        base + "OECD.SDD.TPS,DSD_PRICES@DF_PRICES_ALL,1.0/"
        + monthly_areas + ".M.N.CPI.PA._T.N.GY"
        + "?startPeriod=2024-01&dimensionAtObservation=AllDimensions&format=csvfilewithlabels"
    )
    cpi_quarterly_url = (
        base + "OECD.SDD.TPS,DSD_PRICES@DF_PRICES_ALL,1.0/"
        + quarterly_areas + ".Q.N.CPI.PA._T.N.GY"
        + "?startPeriod=2024-Q1&dimensionAtObservation=AllDimensions&format=csvfilewithlabels"
    )
    japan_cpi_url = (
        base + "OECD.SDD.TPS,DSD_PRICES_COICOP2018@DF_PRICES_C2018_ALL,1.0/"
        + "JPN.M.N.CPI.PA._T.N.GY"
        + "?startPeriod=2024-01&dimensionAtObservation=AllDimensions&format=csvfilewithlabels"
    )
    euro_cpi_url = (
        base + "OECD.SDD.TPS,DSD_PRICES@DF_PRICES_HICP,/"
        + "EA21.M.HICP.CPI.PA._T.N.GY"
        + "?startPeriod=2024-01&dimensionAtObservation=AllDimensions&format=csvfilewithlabels"
    )
    gdp_url = (
        base + "OECD.SDD.NAD,DSD_NAMAIN1@DF_QNA_EXPENDITURE_GROWTH_OECD,1.1/"
        + "Q.....B1GQ......GY."
        + "?startPeriod=2024-Q1&dimensionAtObservation=AllDimensions&format=csvfilewithlabels"
    )
    result = {"inflation": {}, "gdp_growth": {}, "errors": []}
    for label, url in (("monthly CPI", cpi_monthly_url), ("quarterly CPI", cpi_quarterly_url), ("Japan CPI", japan_cpi_url), ("Euro area CPI", euro_cpi_url), ("quarterly GDP", gdp_url)):
        try:
            rows = fetch_oecd_csv(url)
            parsed = latest_oecd_rows(rows)
            if label.endswith("CPI"):
                result["inflation"].update(parsed)
            else:
                result["gdp_growth"].update(parsed)
            print("OECD", label, "rows:", len(rows), "areas:", len(parsed))
        except Exception as error:
            result["errors"].append(label + ": " + str(error)[:180])
            print("OECD", label, "unavailable:", str(error)[:180])
    OECD_HIGH_FREQUENCY_CACHE = result
    return result

def build_currency(code, country, country_name):
    metrics = {}
    indicator_sources = []
    errors = []
    for key, (indicator, label) in INDICATORS.items():
        try:
            observations = fetch_world_bank(country, indicator)
            metrics[key] = {
                "value": observations[0]["value"] if observations else None,
                "year": observations[0]["year"] if observations else None,
                "history": observations[:6],
                "score": component_score(
                    observations,
                    "lower_is_better" if key in ("inflation", "unemployment") else "higher_is_better",
                ),
                "label": label,
                "source": "World Bank",
                "url": f"https://data.worldbank.org/indicator/{indicator}?locations={country}",
            }
            if not observations:
                errors.append(key + ": no observations")
        except Exception as error:
            metrics[key] = {
                "value": None, "year": None, "history": [], "score": None,
                "label": label, "source": "World Bank",
                "url": f"https://data.worldbank.org/indicator/{indicator}?locations={country}",
            }
            errors.append(key + ": " + str(error)[:120])

    # Prefer current OECD high-frequency readings. Retain World Bank annual series only
    # as a clearly dated fallback when OECD does not yet publish an observation.
    high_frequency = fetch_oecd_high_frequency()
    area = OECD_AREAS[code]
    for key in ("inflation", "gdp_growth"):
        lookup_area = "EA21" if key == "inflation" and code == "EUR" else area
        observations = high_frequency[key].get(lookup_area, [])
        if key == "gdp_growth" and code == "EUR" and not observations:
            observations = high_frequency[key].get("EA21", [])
        if observations:
            latest = observations[0]
            metrics[key] = {
                "value": latest["value"],
                "period": latest["period"],
                "year": int(latest["period"][:4]),
                "history": observations,
                "score": component_score(observations, "lower_is_better" if key == "inflation" else "higher_is_better"),
                "label": "CPI inflation, year-on-year (%)" if key == "inflation" else "Real GDP growth, year-on-year (%)",
                "source": "OECD",
                "url": "https://data-explorer.oecd.org/",
            }

    available = [(key, metrics[key]["score"], WEIGHTS[key]) for key in WEIGHTS if metrics[key]["score"] is not None]
    score = None
    if available:
        score = round(sum(s * w for _, s, w in available) / sum(w for _, _, w in available), 2)

    years = [m["year"] for m in metrics.values() if m["year"] is not None]
    latest_year = min(years) if years else None
    if len(available) == 3 and latest_year is not None:
        confidence = "Medium"
    elif len(available) >= 2:
        confidence = "Low"
    else:
        confidence = "Low"

    return {
        "code": code,
        "score": score,
        "confidence": confidence,
        "data_status": f"Partial · {len(available)}/3 macro series · mixed monthly/quarterly/annual data",
        "country_proxy": country_name,
        "data_year": latest_year,
        "policy_rate": POLICY_RATES[code]["value"],
        "policy_rate_display": POLICY_RATES[code]["display"],
        "policy_rate_basis": POLICY_RATES[code]["basis"],
        "policy_rate_as_of": POLICY_RATES[code]["as_of"],
        "policy_rate_source": POLICY_RATES[code]["url"],
        "inflation": metrics["inflation"]["value"],
        "inflation_year": metrics["inflation"]["year"],
        "inflation_period": metrics["inflation"].get("period", str(metrics["inflation"]["year"]) if metrics["inflation"]["year"] else None),
        "gdp_growth": metrics["gdp_growth"]["value"],
        "gdp_growth_year": metrics["gdp_growth"]["year"],
        "gdp_growth_period": metrics["gdp_growth"].get("period", str(metrics["gdp_growth"]["year"]) if metrics["gdp_growth"]["year"] else None),
        "unemployment": metrics["unemployment"]["value"],
        "unemployment_year": metrics["unemployment"]["year"],
        "metrics": metrics,
        "component_weights_available": {key: WEIGHTS[key] for key, _, _ in available},
        "available_weight_pct": sum(w for _, _, w in available),
        "summary": (
            f"Partial macro score based on {len(available)} of 3 macro indicators; "
            "policy-rate outlook and market expectations are not yet included."
        ),
        "errors": errors,
    }


# Preserve prior 90-day releases when RSS feeds rotate or fail.
previous_events = []
if DATA_PATH.exists():
    try:
        previous_events = json.loads(DATA_PATH.read_text(encoding="utf-8")).get("events", [])
    except Exception:
        previous_events = []

events_by_id = {}
for event in previous_events:
    published = parse_date(event.get("published_at") or event.get("time"))
    if published and cutoff <= published <= now + datetime.timedelta(days=1):
        event["published_at"] = published.isoformat()
        event["time"] = published.isoformat()
        event.setdefault("event_id", event_key(event.get("currency", ""), event.get("url", ""), event.get("title", ""), published.isoformat()))
        events_by_id[event["event_id"]] = event

news_sources = []
for name, url, currency in FEEDS:
    status, feed_count, added_count = "unavailable", 0, 0
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
                return "".join(element.itertext()).strip() if element is not None else ""
            title = get("title")
            if atom:
                published_raw = get("{http://www.w3.org/2005/Atom}published") or get("{http://www.w3.org/2005/Atom}updated")
                link_element = item.find("{http://www.w3.org/2005/Atom}link")
                link = link_element.attrib.get("href", "") if link_element is not None else ""
                description = get("{http://www.w3.org/2005/Atom}summary")
            else:
                published_raw = get("pubDate") or get("published") or get("date")
                link, description = get("link"), get("description") or get("summary")
            published = parse_date(published_raw)
            if not title or not published or not (cutoff <= published <= now + datetime.timedelta(days=1)):
                continue
            feed_count += 1
            published_iso = published.isoformat()
            eid = event_key(currency, link, title, published_iso)
            if eid not in events_by_id:
                events_by_id[eid] = {
                    "event_id": eid, "currency": currency, "title": clean_text(title, 220),
                    "summary": clean_text(description, 500), "url": link or url,
                    "time": published_iso, "published_at": published_iso, "source": name, "impact": "High",
                }
                added_count += 1
    except Exception as error:
        status = "error: " + str(error)[:160]
    news_sources.append({
        "name": name, "url": url, "status": status, "checked_at": now.isoformat(),
        "dated_releases_in_feed_90d": feed_count, "new_releases_added": added_count,
    })

macro_sources = []
currencies = []
for code in CURRENCIES:
    country, country_name = WB_COUNTRIES[code]
    item = build_currency(code, country, country_name)
    currencies.append(item)
    macro_sources.append({
        "name": f"OECD / World Bank · {country_name}",
        "url": f"https://data.worldbank.org/country/{country.lower()}",
        "status": "ok" if len([k for k in INDICATORS if item["metrics"][k]["value"] is not None]) else "partial",
        "checked_at": now.isoformat(),
        "data_year": item["data_year"],
        "indicators_available": sum(1 for k in INDICATORS if item["metrics"][k]["value"] is not None),
    })

events = list(events_by_id.values())
events.sort(key=lambda event: event.get("published_at", ""), reverse=True)

output = {
    "schema_version": 3,
    "generated_at": now.isoformat(),
    "timezone": "UTC (displayed in SGT)",
    "model": "v3.5-monthly-cpi-quarterly-gdp",
    "history_window_days": WINDOW_DAYS,
    "scoring": {
        "scale": "-5 to +5",
        "method": "Latest annual indicator versus the preceding up to five annual observations; standardised by historical dispersion and smoothed with tanh.",
        "weights": WEIGHTS,
        "direction": {
            "inflation": "Lower than own recent history scores positively; this is a momentum proxy, not an inflation-target assessment.",
            "gdp_growth": "Higher than own recent history scores positively.",
            "unemployment": "Lower than own recent history scores positively.",
        },
        "excluded_until_integrated": ["policy-rate level and expected path (30%)", "central-bank communication (10%)", "market consensus-versus-actual surprises"],
        "important": "Scores are partial macro context, not standalone FX trading signals. Available component weights are renormalised; no missing input is treated as zero.",
    },
    "currencies": currencies,
    "events": events,
    "sources": news_sources + macro_sources,
    "limitations": [
        "Inflation and GDP prefer OECD monthly/quarterly observations; World Bank annual values remain as dated fallbacks when OECD coverage is unavailable.",
        "EUR uses the World Bank euro-area aggregate; other currencies use the corresponding national economy.",
        "Inflation is scored as a change relative to the economy's own recent history, not as distance from its central-bank target.",
        "Policy-rate expectations, central-bank communication scoring, CFTC positioning and market confirmation are not yet included in the numerical score.",
        "Central-bank news items are context only and are not mechanically converted into bullish or bearish scores.",
        "Events are dated official central-bank RSS/Atom releases retained for a rolling 90-day window; RSS archive depth varies.",
        "GitHub scheduled workflows are best-effort; a five-minute schedule is a target, not a guaranteed interval.",
    ],
}
DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
DATA_PATH.write_text(json.dumps(output, indent=2), encoding="utf-8")
print("Wrote V3.5 higher-frequency macro snapshot for", len(currencies), "currencies and", len(events), "news events.")
print("Macro series available:", sum(1 for c in currencies for k in INDICATORS if c["metrics"][k]["value"] is not None), "of", len(currencies) * len(INDICATORS))
