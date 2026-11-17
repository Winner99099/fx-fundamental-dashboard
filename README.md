# MacroPulse V3 — Eight-Currency FX Intelligence

A static GitHub Pages research dashboard with a transparent official-source news pipeline.

## Current live-update behaviour
- GitHub Actions target schedule: every 5 minutes (`*/5 * * * *` UTC), plus manual workflow dispatch.
- Browser polling: every five minutes while the dashboard is open. It fetches `data/latest.json` with a cache-busting query and `cache: no-store`.
- GitHub scheduled workflows are best-effort and may be delayed or skipped; a five-minute cron is a target, not a guaranteed real-time SLA.
- The collector refreshes official central-bank RSS/news feeds and retrieves annual inflation, GDP growth and unemployment series from the World Bank API for USD, EUR, GBP, JPY, CHF, CAD, AUD and NZD. It imports the Forex Factory weekly calendar's actual, forecast and previous values. Numeric released actual-versus-forecast surprises are scored by indicator category and High/Medium/Low impact, then decay with a 36-hour half-life. It does not fetch live FX spot prices or market-implied policy-rate expectations.

## Data integrity
This is a working dashboard shell and official central-bank news collector, **not yet a complete institutional FX model**. Numerical currency scores and macro indicators must not be treated as verified trading signals. The current free-source collector uses neutral placeholder scores until comparable official macro series, historical standardisation and rate-expectation inputs are connected. Official RSS is not a complete economic calendar.

Market-implied policy-rate expectations, two-year yield differentials, qualitative central-bank communication scoring, CFTC positioning and FX spot-price confirmation are not yet integrated. The event overlay is rule-based and only scores releases when both actual and forecast are numeric. EUR inflation uses Eurostat's euro-area HICP aggregate; CHF inflation uses the Swiss HICP series. Annual unemployment remains a World Bank fallback and may lag current conditions. Do not interpret a five-minute refresh interval as five-minute changes in economic fundamentals.

Journal entries use browser `localStorage` and remain on that device/browser.

## Deployment
GitHub Pages remains configured to publish from `main` / root. The workflow writes `data/latest.json`; the dashboard reads that file.

## Data schema
`data/latest.json` includes `schema_version`, `generated_at`, `scoring`, `currencies`, `events`, `sources`, and `limitations`. Each currency contains raw indicator values, observation years, source links and component scores. Missing numerical macro fields remain unavailable rather than fabricated.


## Event-driven scoring (V5)
- Structural score: slower-moving relative macro backdrop; current available components are renormalised when inputs are missing.
- Event score: numeric actual-versus-consensus releases only; release direction is category-aware (policy rates and inflation are treated as short-term hawkish repricing when above forecast; unemployment/claims use the opposite direction).
- High / Medium / Low calendar impact weights: 1.5 / 1.0 / 0.5.
- Event influence decays with a 36-hour half-life and is ignored after seven days.
- Short-term score: 60% structural + 40% event score, shown only when at least one verified event surprise exists for that currency.
- This is not yet a live market-pricing model: no two-year yield repricing or post-release FX confirmation is included. Qualitative central-bank statements are displayed but not numerically scored.
