# MacroPulseFX Android / Google Play preparation

## Current approach
The existing GitHub Pages dashboard remains the data and web application. The Android release will use a Trusted Web Activity (TWA) wrapper so the same responsive web app can be distributed as an Android App Bundle (AAB) on Google Play without maintaining a separate data engine.

## PWA foundation added on branch
- `manifest.json`: app name, standalone display mode, theme, scope and icon declaration.
- `sw.js`: caches the application shell for offline launch; economic data under `/data/` is always fetched from the network to avoid presenting stale macro snapshots as current.
- `icons/macropulse.svg`: initial scalable app mark.
- `index.html`: manifest metadata, mobile web-app metadata and service-worker registration.

## Before producing the Play Store AAB
1. Verify the PWA on the deployed HTTPS origin and test installability on Android.
2. Produce final 192x192 and 512x512 PNG app icons and Play Store listing graphics/screenshots.
3. Confirm responsive behaviour and test all views on real Android devices.
4. Choose a permanent Android application ID (package name); it cannot be changed after publishing.
5. Generate the TWA project with Bubblewrap / PWABuilder and build a signed Android App Bundle.
6. Publish the Digital Asset Links file at `/.well-known/assetlinks.json` using the SHA-256 fingerprint of the release signing certificate. This establishes the trusted relationship between the Android package and the website.
7. Upload the AAB to Play Console internal testing, fix issues, then complete the required testing and declarations before production.

## Google Play account and policy checks
- Google Play Console registration currently has a US$25 one-time fee and requires identity verification.
- Google Play's current policy says developers providing financial products/services (examples include stock trading and investment products) must use an Organization developer account. MacroPulseFX is currently a market-research / FX-analysis dashboard and does not execute trades or hold funds. Confirm the correct account classification with Google Play before registration; do not describe the app as a broker or execution platform.
- For personal developer accounts created after 13 November 2023, Google currently requires a closed test with at least 12 testers opted in continuously for 14 days before applying for production access.
- New apps and app updates submitted from 31 August 2026 must target Android 16 (API 36) or higher, subject to Google's published exceptions.
- Complete the Data safety form, privacy policy, financial-features declarations, content rating, target audience and store listing accurately.

## Important product limitations
- The app is a research and educational tool, not investment advice, brokerage, trade execution or a guarantee of market outcomes.
- Do not show provisional or missing macro inputs as live trading signals.
- The trading journal is currently browser-local storage. It does not sync between devices.
- Offline mode caches only the app shell. Macro/news data requires an internet connection.
- Google Play approval is determined by Google; a valid AAB does not guarantee approval.

## Current status
PWA foundation committed to the `android-playstore-pwa` development branch. It has not yet been merged into `main`, deployed to the public site, built into an AAB, or submitted to Google Play.
