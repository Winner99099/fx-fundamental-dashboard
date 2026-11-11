#!/usr/bin/env python3
"""Collect public FRED macro series and an indicative Yahoo Finance DXY quote."""
import csv, io, json, datetime, urllib.request, urllib.parse
from pathlib import Path

UTC = datetime.timezone.utc
NOW = datetime.datetime.now(UTC)
OUT = Path("data/us_macro.json")
UA = "Mozilla/5.0 (compatible; MacroPulseUSMonitor/1.1)"
SERIES = {
    "CPILFESL": "core_cpi",
    "PCEPILFE": "core_pce",
    "PAYEMS": "nfp",
    "DGS2": "treasury_2y",
    "DGS10": "treasury_10y",
}

def get(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=35) as response:
        return response.read()

def fred_series(series):
    url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=" + urllib.parse.quote(series) + "&cosd=2018-01-01"
    raw = get(url).decode("utf-8-sig")
    rows = []
    for row in csv.DictReader(io.StringIO(raw)):
        date = row.get("observation_date") or row.get("DATE")
        value = row.get(series)
        if date and value and value not in (".", ""):
            try:
                rows.append({"date": date, "value": float(value)})
            except ValueError:
                continue
    return rows

def pct_change(current, base):
    return None if base in (None, 0) else (current / base - 1) * 100

def make_metric(series, kind):
    rows = fred_series(series)
    if not rows:
        raise RuntimeError("FRED returned no observations for " + series)
    latest = rows[-1]
    previous = rows[-2] if len(rows) > 1 else None

    if kind == "yoy":
        base = rows[-13] if len(rows) >= 13 else None
        value = pct_change(latest["value"], base["value"]) if base else None
        previous_yoy = pct_change(previous["value"], rows[-14]["value"]) if previous and len(rows) >= 14 else None
        delta = value - previous_yoy if value is not None and previous_yoy is not None else None
    elif kind == "nfp":
        value = latest["value"] - previous["value"] if previous else None
        previous_change = rows[-2]["value"] - rows[-3]["value"] if len(rows) >= 3 else None
        delta = value - previous_change if value is not None and previous_change is not None else None
    else:
        value = latest["value"]
        delta = latest["value"] - previous["value"] if previous else None

    history = []
    for index, row in enumerate(rows):
        if kind == "yoy":
            base_index = index - 12
            point = pct_change(row["value"], rows[base_index]["value"]) if base_index >= 0 else None
        elif kind == "nfp":
            point = row["value"] - rows[index - 1]["value"] if index > 0 else None
        else:
            point = row["value"]
        if point is not None:
            history.append({"date": row["date"], "value": round(point, 4)})

    return {
        "value": round(value, 4) if value is not None else None,
        "date": latest["date"],
        "change": round(delta, 4) if delta is not None else None,
        "history": history[-24:],
    }

def dxy_data():
    url = "https://query1.finance.yahoo.com/v8/finance/chart/%5EDXY?range=1y&interval=1d"
    try:
        payload = json.loads(get(url).decode("utf-8"))
        result = payload["chart"]["result"][0]
        quote = result["indicators"]["quote"][0]
        points = []
        for timestamp, close in zip(result.get("timestamp", []), quote.get("close", [])):
            if close is not None:
                points.append({
                    "date": datetime.datetime.fromtimestamp(timestamp, UTC).date().isoformat(),
                    "value": float(close),
                })
        if not points:
            raise RuntimeError("Yahoo Finance returned no DXY observations")
        latest = points[-1]
        previous = points[-2] if len(points) > 1 else None
        return {
            "value": round(latest["value"], 4),
            "date": latest["date"],
            "change": round(latest["value"] - previous["value"], 4) if previous else None,
            "history": [{"date": p["date"], "value": round(p["value"], 4)} for p in points[-24:]],
            "provider": "Yahoo Finance chart API",
            "delayed": True,
        }
    except Exception as error:
        return {
            "value": None, "date": None, "change": None, "history": [],
            "error": str(error)[:180], "provider": "Yahoo Finance chart API",
        }

def main():
    indicators = {}
    errors = {}
    for series, key in SERIES.items():
        kind = "yoy" if series in ("CPILFESL", "PCEPILFE") else "nfp" if series == "PAYEMS" else "level"
        try:
            indicators[key] = make_metric(series, kind)
        except Exception as error:
            errors[key] = str(error)[:180]
            indicators[key] = {"value": None, "date": None, "change": None, "history": []}

    indicators["dxy"] = dxy_data()
    if indicators["dxy"]["value"] is None:
        errors["dxy"] = indicators["dxy"].get("error", "DXY unavailable")

    # Calculate the spread from the latest date common to both Treasury series.
    try:
        two_year_rows = fred_series("DGS2")
        ten_year_rows = fred_series("DGS10")
        two_year = {row["date"]: row["value"] for row in two_year_rows}
        ten_year = {row["date"]: row["value"] for row in ten_year_rows}
        common_dates = sorted(set(two_year).intersection(ten_year))
        if common_dates:
            date = common_dates[-1]
            indicators["yield_spread"] = {
                "value": round(ten_year[date] - two_year[date], 4),
                "date": date,
            }
        else:
            indicators["yield_spread"] = None
            errors["yield_spread"] = "No common Treasury observation date"
    except Exception as error:
        indicators["yield_spread"] = None
        errors["yield_spread"] = str(error)[:180]

    required = ("core_cpi", "core_pce", "nfp", "treasury_2y", "treasury_10y", "dxy", "yield_spread")
    status = "OK" if all(indicators.get(key) and indicators[key].get("value") is not None for key in required) else "PARTIAL"
    data = {
        "schema_version": 1,
        "generated_at": NOW.isoformat(),
        "source_status": status,
        "indicators": indicators,
        "errors": errors,
        "sources": {
            "fred": "https://fred.stlouisfed.org/",
            "dxy": "Yahoo Finance chart endpoint; delayed/indicative; ICE DXY is the benchmark",
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print("Wrote", OUT, "status", status, "errors", json.dumps(errors))

if __name__ == "__main__":
    main()
