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


## Account-type recommendation (13 November 2026)
MacroPulseFX includes FX fundamental comparisons and may later rank directional currency pairs. Google Play's account requirements say developers providing financial products or services must register as an Organization. Google's Financial features declaration also includes "Financial advice" and requires every published app, including test-track apps, to complete the declaration.

**Recommended route:** plan for an Organization developer account if the submitted feature set is classified by Google as financial advice / a financial service. This requires a genuine registered legal entity, consistent organization details, a linked Google Payments profile, organization website and a D-U-N-S number. Google says D-U-N-S registration through Dun & Bradstreet is free and may take up to 30 days.

Do not create a Personal account simply to bypass the Organization requirement, and do not create an Organization profile using a company that the publisher is not authorized to represent. The app's final functionality and Google Play's classification must be confirmed before registration. If the publisher has no registered entity, pause Play Console registration until the account route is clarified with Google or the product scope is adjusted and re-reviewed.

## Privacy policy draft
A first privacy-policy page has been added at `privacy-policy.html` and linked from the dashboard footer. It describes the current local-only journal, public data requests, hosting/font providers, and the absence of analytics/ad SDKs in the current build. This is a draft: verify every statement against the final Android package and update the contact, Data safety form and policy if analytics, ads, crash reporting, accounts, cloud sync or other SDKs are added.


## Publisher has no registered company (Singapore)
The owner has confirmed that there is currently no registered company in Singapore. Do not create an Organization Play Console account using an unregistered or fictitious entity, and do not incorporate a company solely on the assumption that Google will require it before the app's feature classification is reviewed.

Google distinguishes Personal accounts (for personal use, hobbyists and individual developers) from Organization accounts (for organizations/businesses and specified service categories). Personal accounts can monetize apps, but the account type must truthfully reflect the publisher's activity. Google specifically requires an Organization account for developers providing financial products/services, including investment-related services. Its Financial features declaration includes a "Financial advice" category and must be completed by all apps, including testing tracks.

**Practical route for this project:**
1. Keep building and testing the app without registering Play Console yet.
2. Keep the product limited to general, non-personalised market information and educational research; no portfolio management, personal trade recommendations, brokerage, execution or custody.
3. Ask Google Play support to confirm whether this exact app scope and proposed publisher model qualify for a Personal developer account. Keep the written response.
4. If Google classifies the service as a financial service, or the owner intends to operate MacroPulseFX as a business, establish a genuine eligible business entity first and use an Organization account. Do not treat a sole proprietorship or a private limited company as interchangeable for Google verification; confirm that the exact entity is accepted and can obtain the required D-U-N-S record.
5. Complete the Financial features declaration accurately. Do not simply select "no financial features" if Google considers the app's analytical or advice functionality a financial feature.

Singapore ACRA currently lists S$15 for a company name application and S$300 to register a local company (S$315 government filing fees in total), plus ongoing corporate compliance obligations. These fees exclude corporate secretary, registered office, accounting/tax services and any corporate-service-provider charges. Incorporation is a business decision, not a Google Play technical prerequisite for every app.

## Project hosting correction
This is a GitHub Pages project site hosted under `/fx-fundamental-dashboard/`, not the domain root. Manifest scope/start URL, icon URL and service-worker registration/cache paths must therefore be relative to the project subpath. The PWA paths were corrected on this branch to avoid registering `/sw.js` at the wrong origin root.

## App scope / disclosure
The dashboard displays general relative macro comparisons. Pair score differences are descriptive comparisons, not personalised trade recommendations. The app does not connect to a broker, execute trades, hold assets or manage a user's portfolio. Reassess this wording if future features add recommendations, paid signals, account aggregation, execution or portfolio management.
