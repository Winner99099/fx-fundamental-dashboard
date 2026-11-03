# 8-Currency Fundamental FX Dashboard — Version 2 (free-source starter)

## What this version does
- Static responsive dashboard suitable for GitHub Pages.
- Displays eight currency rows and a relative-strength pair ranking.
- Refreshes the browser view every 5 minutes.
- GitHub Actions attempts to rebuild the data snapshot every 15 minutes.
- Pulls public official central-bank RSS/news feeds where available.
- Exports the latest snapshot as JSON; journal is stored in the browser's local storage.

## Important limitations (please read)
This is a free-source starter, **not yet a complete live fundamental trading system**.
The first data builder deliberately leaves currency scores neutral with Low confidence. It does
not infer bullish/bearish scores from headline wording. It does not include a proper economic
calendar with consensus/actual/revisions, real-time FX prices, OIS/forward curves, bond yields,
or CFTC positioning. Official RSS feed availability and publication timing can vary.
GitHub Actions cron is best-effort, not a guaranteed event-triggered alert service. The browser
refreshes every 5 minutes only while the page is open.

## Deploy online free with GitHub Pages
1. Create a new public GitHub repository, e.g. `fx-fundamental-dashboard`.
2. Upload the contents of this folder to the repository root (keep `.github` and `scripts`).
3. In repository Settings → Pages, choose **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. In Actions, enable workflows if prompted; run **Refresh macro dashboard data** once manually.
5. Wait for Pages deployment, then open the GitHub Pages URL shown in Settings → Pages.

## How the updates work
- GitHub Actions attempts to run at minutes 7, 22, 37 and 52 each hour (UTC).
- The workflow fetches official central-bank RSS feeds and commits `data/latest.json`.
- Open dashboard clients fetch that JSON every five minutes.
- A post-release reaction model is **not activated** until consensus/actual release data and market
  confirmation feeds are integrated. Do not treat RSS headlines as release surprises.

## Next technical step for a credible scoring model
Add comparable free macro series per currency (inflation, labour market, growth, policy rate),
standardise each series by its own history, incorporate revisions and rate expectations, and
require price/yield confirmation before changing the directional score. A true rapid event trigger
needs a dependable release calendar/API or push/webhook source; free official sources may not
provide a uniform low-latency feed across all eight economies.
