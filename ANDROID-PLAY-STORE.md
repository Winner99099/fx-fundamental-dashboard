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

Singapore ACRA's published fees are S$15 to reserve a name plus S$100 for one year of sole-proprietorship registration, or S$15 plus S$300 for a company. These are government filing fees only and exclude other operating/compliance costs. See the latest ACRA fee schedule before registering.

## Project hosting correction
This is a GitHub Pages project site hosted under `/fx-fundamental-dashboard/`, not the domain root. Manifest scope/start URL, icon URL and service-worker registration/cache paths must therefore be relative to the project subpath. The PWA paths were corrected on this branch to avoid registering `/sw.js` at the wrong origin root.

## App scope / disclosure
The dashboard displays general relative macro comparisons. Pair score differences are descriptive comparisons, not personalised trade recommendations. The app does not connect to a broker, execute trades, hold assets or manage a user's portfolio. Reassess this wording if future features add recommendations, paid signals, account aggregation, execution or portfolio management.


## Advertising and sponsorship model (13 November 2026)
The publisher's chosen model is a free application supported by advertising and direct sponsorship. Monetisation is planned but is **not active in the current build**.

### Recommended first release monetisation
1. Start with clearly labelled, limited display placements on the existing website. The Android Trusted Web Activity (TWA) presents the same hosted web content. Google documents Chrome Custom Tabs and Trusted Web Activities as supported viewing frames for AdSense / Ad Manager web advertising in apps.
2. Apply to Google AdSense / Ad Manager only after the website meets the relevant publisher eligibility and content requirements. Do not insert placeholder publisher IDs or load ad scripts before approval.
3. Add direct sponsor placements as separate, clearly labelled "Sponsored" cards or banners. Keep sponsorship separate from macro data, news ranking, currency scores, editorial analysis and pair calculations.
4. Prefer contextual/non-personalised ads initially. Do not use inferred personal financial status, debt, portfolio or trading behaviour to target ads. Review the ad provider's sensitive-category restrictions.
5. Do not add a native AdMob SDK to the TWA by default. Reassess native AdMob only if a future native Android feature genuinely requires in-app ad units.

### Release declarations and privacy
- In Play Console, declare **Contains ads = Yes** once ad delivery or sponsored advertising is present. Google's ads declaration covers third-party ad SDKs, display, native and banner ads.
- Update the privacy policy before enabling ads. Disclose the ad provider, cookies/local identifiers, IP/device data, data sharing, personalisation choices, retention and contact route based on the actual configuration.
- Complete Data safety answers against the actual ad SDK / web ad code. SDK data handling is the publisher's responsibility.
- Implement and test required consent messaging and privacy-choice controls for applicable regions before serving personalised ads. Provide a way to revisit privacy choices where required.
- Add `ads.txt` only when the chosen ad platform instructs the publisher to do so, using the exact publisher ID supplied by that platform.
- No ad network, analytics SDK, consent SDK or sponsor tracking pixel is included in this development branch yet.

### Ad placement principles
- One restrained banner placement in overview and one optional in-feed sponsor card; avoid interstitials, pop-ups, deceptive controls or ads adjacent to trading/journal buttons.
- Keep ads visually distinct from data and news. Label direct sponsor content "Sponsored" and identify the sponsor.
- Do not imply sponsor content is independent research. No sponsor may influence macro scores, data sourcing, news summaries or pair calculations.
- Monitor layout shift, page performance and mobile readability.

### Commercial publisher structure
Because the owner has chosen an advertising/sponsorship business model, the intended route is a genuine Singapore business registration followed by a Google Play Organization account, subject to Google's confirmation that the chosen entity type and its D-U-N-S record are accepted. A sole proprietorship may be a lower-cost ACRA registration option than a Pte. Ltd., but it is not automatically equivalent to a company and Google/Dun & Bradstreet acceptance must be checked before registration. Do not use an invented entity or personal account to disguise a business publisher.

### Outstanding monetisation inputs
- Confirm Singapore entity type and registered business name.
- Obtain/verify the D-U-N-S record for the exact entity before creating Play Console.
- Apply for the selected advertising platform using the verified publisher details.
- Supply actual publisher/ad-unit identifiers only after approval.
- Supply a dedicated privacy/support email address.
