# MacroPulse V3 — Eight-Currency FX Intelligence

A static GitHub Pages research dashboard with a transparent official-source news pipeline.

## What's repaired / rebuilt
- Removed the incomplete embedded script and the hardcoded geopolitical narratives / sample macro numbers.
- Replaced the invalid Tailwind CDN and malformed font import with a self-contained responsive stylesheet.
- Added a robust `app.js` that fetches `data/latest.json` using a cache-busting URL and validates the response.
- Added navigation for overview, currency fundamentals, pair analysis, news, event watch, CFTC positioning and a browser-local trading journal.
- Added empty/error/stale-data states so a failed feed cannot look like a live signal.
- Added official central-bank RSS ingestion for all eight currencies.
- Changed GitHub Actions to a four-hour target schedule (`7 */4 * * *` UTC) and manual dispatch.
- Writes both `data/latest.json` (dashboard source) and root `latest.json` (download convenience).

## Important data integrity notes
This is a working dashboard shell and official central-bank news collector, **not yet a complete institutional FX model**. Numerical currency scores and macro indicators are deliberately `null` rather than fabricated. A credible score requires comparable official time series (policy rates, CPI, GDP, labour), historical standardisation, rate expectations / yield differentials, CFTC data and preferably market confirmation. Official RSS does not provide a complete calendar with consensus, actual and revisions.

CFTC module and economic calendar are clearly marked pending; no fake values or trade signals are displayed. Journal entries use browser `localStorage` and remain on that device/browser.

## Deploy to your existing GitHub Pages repository
1. Extract this ZIP.
2. Upload/replace the repository-root contents with the contents of this folder (not the containing folder itself). Keep `.github/workflows/refresh.yml`.
3. Commit to the existing `main` branch.
4. In GitHub, open **Actions** and enable workflows if prompted.
5. Run **Refresh FX macro dashboard** once using **Run workflow**.
6. Confirm **Settings → Pages** still deploys from `main` / root. Wait for deployment, then open the existing Pages URL.

## Update timing
- GitHub Actions target: every four hours at minute 7 UTC (03:07, 07:07, 11:07, 15:07, 19:07, 23:07 Singapore time).
- GitHub schedule is best-effort and may be delayed.
- Browser polling: every five minutes while the page is open. This only reloads the latest snapshot; it does not trigger the data collector.

## Data schema
`data/latest.json` includes `schema_version`, `generated_at`, `currencies`, `events`, `sources`, and `limitations`. Numerical macro fields and scores are nullable. The UI treats null as unavailable.
