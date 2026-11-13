# MacroPulseFX — private Android test build

This is a lightweight Android WebView wrapper for the existing hosted dashboard. It is intended for private testing on the Honor 400, not for Google Play publication.

- Start page: https://winner99099.github.io/fx-fundamental-dashboard/
- App ID (provisional): `com.winner99099.macropulsefx`
- Debug APK application ID: `com.winner99099.macropulsefx.debug`
- Minimum Android: 6.0 (API 23)
- No advertising SDK, analytics SDK, account login, broker connection or trade execution is included.

The app loads the live GitHub Pages website. It therefore requires an internet connection for current macro/news data. The wrapper does not bundle or change the website data engine.

## Build

The GitHub Actions workflow builds a debug APK and uploads it as an artifact. Debug APKs are for private testing only and are not suitable for Play Store release. The package ID and signing configuration must be reviewed before any public release.

## Test checklist

1. Install on the Honor 400.
2. Confirm the app launches and stays in the app for dashboard pages.
3. Check Overview, Currency Strength, FX Pair Analysis, News Intelligence, Event Watch, US Macro and the journal.
4. Test Refresh and confirm the displayed snapshot timestamp.
5. Tap source links and confirm they open in the external browser.
6. Test Android Back navigation, screen rotation, and returning after the app is backgrounded.
7. Test on Wi-Fi and mobile data; macro snapshots require internet access.
8. Report screenshots and any error text before changes are made to the live site.

## Known limitations

- This first wrapper displays the currently deployed website, not unpublished branch-only web changes.
- It is a web wrapper, not a native data application.
- The journal uses browser-local storage and does not sync between devices.
- Offline launch and background refresh behaviour need real-device validation.
- This debug package uses Android's debug signing key and is not the release package.
