#!/usr/bin/env python3
"""Single-provider ChatGPT FX review with compact input and safe cache handling."""
import datetime as dt
import hashlib
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAP = ROOT / "data/latest.json"
OUT = ROOT / "data/ai_review.json"
CC = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"]
PAIR_ORDER = ["EUR", "GBP", "AUD", "NZD", "USD", "CAD", "CHF", "JPY"]
PAIRS = [PAIR_ORDER[i] + "/" + PAIR_ORDER[j] for i in range(8) for j in range(i + 1, 8)]
MODEL = "gpt-6-luna"
NOW = dt.datetime.now(dt.timezone.utc)

PROMPT = """You are an FX momentum analyst. Use ONLY the supplied dashboard snapshot. Return ONLY valid JSON with exactly two maps: currency_reviews (all 8 currency codes) and pair_reviews (all 28 pair keys).
For each currency return: bias (BULLISH/BEARISH/NEUTRAL/INSUFFICIENT), confidence, summary (max 2 concise sentences), drivers (max 3 short strings), risks (max 2 short strings). Distinguish macro trend from confirmed recent release momentum. Do not claim spot momentum without direct pair-price evidence.
For each pair return: bias (same values; SHORT-TERM PRICE MOMENTUM ONLY), confidence, summary (max 2 concise sentences), drivers (max 3), risks (max 2), fundamental_view, momentum_view, d1_view, h4_watch, key_catalysts (max 2). Determine pair bias primarily from its own daily price data: 1d/5d/20d returns, price vs SMA20/SMA50, RSI14 and MACD vs signal. Macro scores/rates/CPI/GDP must NEVER override contradictory pair price action. Technical data older than 36 hours, missing or unavailable means INSUFFICIENT; do not infer pair direction from currency scores. Conflicting technical signals mean NEUTRAL. Treat upcoming calendar events as pending, never as results. Use only supplied facts; do not invent news, prices or catalysts. No H4 data is supplied: provide watch conditions only. State the technical timestamp in d1_view. Keep all text concise. This is research commentary, not a trade instruction."""

def read(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default

def compact_payload(snapshot):
    currencies = []
    for c in snapshot.get("currencies", []):
        currencies.append({
            k: c.get(k) for k in (
                "code", "score", "short_term_score", "fundamental_trend_score",
                "fundamental_trend_persistence", "fundamental_trend_detail",
                "policy_rate_display", "inflation", "inflation_period",
                "gdp_growth", "gdp_growth_period", "unemployment",
                "unemployment_period", "data_status", "confidence"
            )
        } | {"latest_release": c.get("last_release_reference")})
    events = []
    for e in snapshot.get("events", [])[-24:]:
        events.append({k: e.get(k) for k in (
            "currency", "title", "time", "impact", "actual", "forecast",
            "previous", "summary", "source"
        )})
    technical = snapshot.get("pair_technical", {})
    pair_data = {}
    for pair in PAIRS:
        t = technical.get(pair) or {}
        pair_data[pair] = {k: t.get(k) for k in (
            "status", "source", "symbol", "updated_at", "price",
            "change_1d_pct", "change_5d_pct", "change_20d_pct",
            "sma20", "sma50", "rsi14", "macd", "macd_signal",
            "support_20d", "resistance_20d"
        )}
        if not t:
            pair_data[pair] = {"status": "unavailable"}
    return {
        "snapshot_generated_at": snapshot.get("generated_at"),
        "currencies": currencies,
        "recent_events": events,
        "pair_d1_technical": pair_data
    }

def parse_json(text):
    text = (text or "").strip()
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("No JSON object returned by ChatGPT")
    return json.loads(text[start:end + 1])

def validate(review):
    cr = review.get("currency_reviews", {})
    pr = review.get("pair_reviews", {})
    if not isinstance(cr, dict) or not isinstance(pr, dict):
        raise ValueError("Response is missing currency_reviews or pair_reviews")
    allowed = {"BULLISH", "BEARISH", "NEUTRAL", "INSUFFICIENT"}

    def clean(item, pair=False):
        if not isinstance(item, dict):
            item = {}
        bias = str(item.get("bias", "INSUFFICIENT")).upper()
        if bias not in allowed:
            bias = "INSUFFICIENT"

        def short_list(key, limit, max_len=260):
            value = item.get(key, [])
            if isinstance(value, list):
                return [str(x)[:max_len] for x in value[:limit]]
            return [str(value)[:max_len]] if value else []

        result = {
            "bias": bias,
            "confidence": str(item.get("confidence", "Low"))[:20],
            "summary": str(item.get("summary", ""))[:650],
            "drivers": short_list("drivers", 3),
            "risks": short_list("risks", 2)
        }
        if pair:
            for key in ("fundamental_view", "momentum_view", "d1_view", "h4_watch"):
                result[key] = str(item.get(key, ""))[:650]
            result["key_catalysts"] = short_list("key_catalysts", 2)
        return result

    currencies = {code: clean(cr.get(code)) for code in CC}
    pairs = {pair: clean(pr.get(pair), True) for pair in PAIRS}
    if len(cr) < 8 or len(pr) < 28:
        raise ValueError("Incomplete review: expected all 8 currencies and 28 pairs")
    return {"currency_reviews": currencies, "pair_reviews": pairs}

def call_chatgpt(api_key, data):
    body = {
        "model": MODEL,
        "reasoning": {"effort": "low"},
        "instructions": PROMPT,
        "input": json.dumps(data, ensure_ascii=False, separators=(",", ":")),
        "max_output_tokens": 10000
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        payload = json.loads(response.read().decode("utf-8"))
    chunks = [
        part.get("text", "")
        for item in payload.get("output", [])
        for part in item.get("content", [])
        if part.get("type") == "output_text"
    ]
    return validate(parse_json("\n".join(chunks) or payload.get("output_text", "")))

def main():
    snapshot = read(SNAP, {})
    if not snapshot.get("currencies"):
        raise SystemExit("No currency snapshot found.")

    data = compact_payload(snapshot)
    fingerprint = hashlib.sha256(json.dumps(
        {"data": data, "prompt": PROMPT, "model": MODEL},
        sort_keys=True, ensure_ascii=False
    ).encode("utf-8")).hexdigest()
    old = read(OUT, {})
    old_provider = (old.get("providers") or {}).get("chatgpt") or {}
    old_review = old_provider.get("review") or {
        "currency_reviews": old.get("currency_reviews", {}),
        "pair_reviews": old.get("pair_reviews", {})
    }
    try:
        previous_generated = dt.datetime.fromisoformat(
            old.get("generated_at", "").replace("Z", "+00:00")
        )
        age_hours = (NOW - previous_generated).total_seconds() / 3600
    except Exception:
        age_hours = 999999

    if (old.get("input_fingerprint") == fingerprint
            and age_hours < 4
            and old.get("status") == "ok"
            and old.get("pair_reviews")):
        print("AI review skipped: unchanged inputs and successful review younger than four hours.")
        return

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        error_message = "OPENAI_API_KEY is not configured in GitHub Actions secrets."
        error_status = "not_configured"
    else:
        try:
            review = call_chatgpt(api_key, data)
            OUT.parent.mkdir(exist_ok=True)
            out = {
                "schema_version": 2,
                "status": "ok",
                "generated_at": NOW.isoformat(),
                "last_attempt_at": NOW.isoformat(),
                "input_snapshot_generated_at": snapshot.get("generated_at"),
                "input_fingerprint": fingerprint,
                "model": MODEL,
                "providers": {
                    "chatgpt": {
                        "status": "ok",
                        "model": MODEL,
                        "message": "Review completed.",
                        "review": review
                    }
                },
                "currency_reviews": review["currency_reviews"],
                "pair_reviews": review["pair_reviews"],
                "methodology": "Single-provider ChatGPT review of a compact frozen dashboard snapshot. Pair momentum is determined from pair-specific D1 price data; macro scores do not override price action."
            }
            OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
            print("AI review: ok · ChatGPT:", MODEL, "· 8 currencies / 28 pairs")
            return
        except urllib.error.HTTPError as error:
            error_status = "error"
            try:
                detail = error.read().decode("utf-8", "replace")
            except Exception:
                detail = str(error)
            error_message = "HTTP " + str(error.code) + ": " + detail[:500]
        except Exception as error:
            error_status = "error"
            error_message = str(error)[:500]

    # Preserve the last successful review and its original generated_at timestamp.
    # A failed attempt must never make old analysis look newly generated.
    stale_age = old.get("generated_at")
    out = dict(old) if old else {
        "schema_version": 2,
        "generated_at": None,
        "input_snapshot_generated_at": None,
        "currency_reviews": {},
        "pair_reviews": {}
    }
    out["status"] = "error" if old_review and old_review.get("pair_reviews") else "awaiting_api"
    out["last_attempt_at"] = NOW.isoformat()
    out["last_error"] = error_message
    out["providers"] = {
        "chatgpt": {
            "status": error_status,
            "model": MODEL,
            "message": error_message,
            "review": old_review
        }
    }
    out["cache_is_stale"] = True
    out["cache_generated_at"] = stale_age
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print("AI review failed · ChatGPT:", error_message)
    if error_status == "not_configured":
        raise SystemExit(1)

if __name__ == "__main__":
    main()
