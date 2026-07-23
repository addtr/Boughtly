# Enabling AdMob ads

The ad system ships as an **off-by-default skeleton** so the app keeps running
in Expo Go (where AdMob's native module can't load). Nothing shows an ad or
collects any data until you complete the steps below in a **dev/production
build** — never Expo Go.

Files involved:
- `src/services/ads.ts` — master flag, ad unit IDs, init + interstitial logic.
- `src/components/BannerAdSlot.tsx` — the banner (mounted at the bottom of Home).
- `App.tsx` — calls `initAds()` at startup.

## Steps

1. **Install the SDK** (leaves Expo Go behind — you'll test in an EAS/dev build):
   ```
   npx expo install react-native-google-mobile-ads
   ```

2. **Create an AdMob account** at admob.google.com. Register the iOS app, and
   create ad units: one **Banner** and one **Interstitial**. Copy their IDs.

3. **Add the config plugin + app IDs** to `app.json` under `plugins`:
   ```json
   ["react-native-google-mobile-ads", {
     "iosAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX",
     "androidAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX"
   }]
   ```
   Also set `SKAdNetworkItems` per AdMob's docs for iOS attribution.

4. **Fill in the real unit IDs** in `src/services/ads.ts` (`REAL_BANNER`,
   `REAL_INTERSTITIAL`). Test IDs are used automatically in `__DEV__`.

5. **Uncomment the two SDK blocks** marked "UNCOMMENT WHEN THE SDK IS INSTALLED"
   in `ads.ts` (init + interstitial) and `BannerAdSlot.tsx` (banner).

6. **Flip the switch**: set `ADS_ENABLED = true` in `ads.ts`.

7. **Build & test**:
   ```
   eas build --profile development --platform ios
   ```
   Confirm the test banner shows on Home and interstitials respect the cap.

## Showing an interstitial at a "done" moment

Call it sparingly, only after a task completes (it self-limits to one every few
minutes via `canShowInterstitial`):
```ts
import { maybeShowInterstitial } from '../services/ads';
// after a return is marked refunded, or an item is saved:
await maybeShowInterstitial();
```

## Before you ship ads (required)

AdMob sends device/advertising identifiers to Google, so the current
"nothing leaves your device" promise no longer holds. Most of this is already
staged and switches on with `ADS_ENABLED`:

- **Privacy Policy** — DONE. `src/content/legal.ts` has an "Advertising"
  section gated behind `ADS_ENABLED`; it appears automatically when you flip
  the flag. If you host a public copy, re-export it after enabling.
- **App Tracking Transparency** — mostly staged:
  - `NSUserTrackingUsageDescription` is already in `app.json`.
  - Install the module: `npx expo install expo-tracking-transparency`.
  - Uncomment the block in `requestTrackingPermission()` in `ads.ts`
    (already called from `initAds()` before the SDK starts).
  - When requesting ads, pass `requestNonPersonalizedAdsOnly: true` if the
    user declined tracking (the BannerAdSlot request already does this).

- **App Store privacy labels** — you fill these in App Store Connect at
  submission (can't be done in code). With AdMob on, declare:
  - Data type **Identifiers → Device ID** and **Usage Data → Advertising
    Data / Product Interaction**.
  - Purpose: **Third-Party Advertising** (and Analytics if you add it).
  - **Used to Track You: Yes** (the advertising identifier links to Google).
  - Everything else (receipts, items, profile) stays **not collected** —
    it never leaves the device.
