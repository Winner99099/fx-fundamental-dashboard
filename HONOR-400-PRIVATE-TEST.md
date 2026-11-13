# MacroPulseFX — Honor 400 private test

## First milestone

Build a privately installable debug APK that wraps the existing MacroPulseFX GitHub Pages dashboard. No Play Store account, company registration, ad network or public release is needed for this test.

## Build workflow

GitHub Actions workflow: `.github/workflows/android-debug-apk.yml`

After a successful run, download the artifact named `macropulsefx-honor400-debug-apk` from the workflow run's Artifacts section. Extract the ZIP to obtain `app-debug.apk`.

## Install on Honor 400

1. Download the APK to the phone or transfer it from the computer.
2. Open the APK from Files / Downloads.
3. If Android asks, allow the Files app or browser to install unknown apps for this installation.
4. Confirm Install, then open MacroPulseFX.
5. After testing, you can disable the unknown-app installation permission again.

Only install the APK built by this repository's workflow. Do not share this debug APK as a public release.

## Current scope

- Loads the currently deployed dashboard at the existing GitHub Pages URL.
- Uses network access for the latest macro/news snapshot.
- External source links are handed to the phone's browser.
- No ad or analytics SDKs are included.
- The private test build is not a Play Store-ready release.
