# Enabling Boughtly Plus billing

The Plus **entitlement** is already live: `settings.isPlus` unlocks perks, hides
ads, and lifts the free item limit (`FREE_ITEM_LIMIT`). What's stubbed is the
**payment** — real App Store in-app purchases can't run in Expo Go, so
`PLUS_IAP_ENABLED` is false until you wire a billing library in a real build.

While it's off:
- The paywall (`PlusScreen`) shows the full value prop and prices.
- "Start Boughtly Plus" explains billing isn't live yet.
- In development (`__DEV__`) there's a "Dev: unlock Plus" button so you can
  test every gated feature.

## Steps to turn on real billing

1. **Pick a library.** Easiest is **RevenueCat** (`react-native-purchases`) —
   it handles receipts, restores, and renewals. Raw `react-native-iap` also
   works; the stubs in `plus.ts` are written against its API.

2. **Install it** (leaves Expo Go behind — test in an EAS/dev build):
   ```
   npx expo install react-native-purchases   # or react-native-iap
   ```
   Add its config plugin to `app.json` if required.

3. **Create the products** in App Store Connect (and Google Play):
   - `com.addtr.boughtly.plus.monthly`
   - `com.addtr.boughtly.plus.yearly`
   Match the IDs in `PLUS_PRODUCT_IDS` and the prices in `PLUS_PRICE_*`.

4. **Wire the stubs** in `src/services/plus.ts`: uncomment the marked blocks in
   `purchasePlus()` and `restorePlus()` (or swap in RevenueCat's `purchasePackage`
   / `restorePurchases`). On success the screen already calls
   `updateSettings({ isPlus: true })`.

5. **Flip the switch**: set `PLUS_IAP_ENABLED = true` and build:
   ```
   eas build --profile development --platform ios
   ```
   Test purchase + restore with a sandbox App Store account.

## App Store requirements (don't skip)

- A visible **Restore Purchases** button (already on the paywall).
- Subscription terms + links to Terms and Privacy (already on the paywall).
- Fill the subscription's **localized description and price** in App Store
  Connect; Apple reviews the paywall wording.

## Gating more features later

Gate any feature with a simple check:
```ts
const { settings } = useAppState();
if (!settings.isPlus) { navigation.navigate('Plus'); return; }
```
Good next candidates: unlimited receipt photos, insurance PDF / CSV export,
AI receipt scanning, and cloud sync (once a backend exists).
