# MacroPulseFX advertising & sponsorship implementation plan

**Status:** Planning only — no advertising code or tracking SDK is active in the current build.

## Business model
Free app, supported by display advertising and direct sponsorships / clearly identified partner placements.

## Recommended technical route
The first Android build uses a Trusted Web Activity (TWA) around the existing GitHub Pages website. Google documents Chrome Custom Tabs and Trusted Web Activities as supported viewing frames for AdSense / Ad Manager web advertising in apps. This makes website-side ad placements the least-complex first route; a separate native AdMob SDK is not required just to show website ads in the TWA.

Initial sequence:
1. Keep the app ad-free during development and policy classification.
2. Complete the website's content, navigation, mobile layout and privacy pages.
3. Apply to AdSense or Ad Manager using genuine publisher/business details.
4. Only after approval, integrate the actual ad tag and publisher identifiers supplied by Google.
5. Test ad rendering inside the live website and Android TWA.
6. Add Play Console "Contains ads" declaration and update Data safety/privacy disclosures before release.
7. Add a simple, labelled sponsor card/banner for direct sponsors. No sponsor may influence data, scores, news selection or pair analysis.

## Initial ad policy
- Use contextual/non-personalised ads where possible.
- Do not target users using sensitive financial status, account balances, debt, portfolio holdings or inferred trading losses.
- No pop-up/interstitial ads in the first release.
- Do not place ads beside controls where accidental clicks could occur.
- Direct sponsor placements must say "Sponsored" and identify the sponsor.
- No sponsored article should be presented as independent research.

## Privacy and consent
Advertising may involve cookies, IP addresses, device identifiers, ad measurement and data sharing by the ad provider. Update the privacy policy and Data safety declaration based on the actual provider and configuration before enabling ads. Implement consent and privacy-choice controls wherever required by the ad provider and applicable law. Do not claim the app is ad-free once ads are enabled.

## Required inputs before implementation
- Registered publisher entity and verified D-U-N-S record, if Organization Play Console route is used.
- AdSense / Ad Manager approval and actual publisher/ad-unit IDs.
- Dedicated support/privacy email.
- Final ad provider list and consent configuration.

## Google Play
- Declare "Contains ads = Yes" once ads or ad placements are active.
- Complete Financial features declaration accurately.
- Complete Data safety form for the actual ad/analytics SDKs and website ad code.
- The publisher remains responsible for third-party SDK and ad provider compliance.
