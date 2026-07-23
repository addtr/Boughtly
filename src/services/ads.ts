/**
 * Ads scaffold (Google AdMob).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * STATUS: skeleton, OFF by default. Nothing here shows an ad or collects any
 * data yet. The whole system is gated behind `ADS_ENABLED` so the app keeps
 * running in Expo Go, where the AdMob native module CANNOT load.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * To turn ads on later (in a dev/production build, NOT Expo Go), see
 * dev-notes/ADS_SETUP.md. In short:
 *   1. `npx expo install react-native-google-mobile-ads`
 *   2. Add the config plugin + your AdMob app IDs to app.json.
 *   3. Fill in REAL_* ad unit IDs below from your AdMob console.
 *   4. Uncomment the two marked SDK blocks (here and in BannerAdSlot.tsx).
 *   5. Flip `ADS_ENABLED` to true and make an EAS dev build to test.
 *   6. Update the Privacy Policy + App Store data disclosures + add the ATT
 *      prompt — AdMob collects device/ad identifiers, so "nothing leaves your
 *      device" is no longer true once this is on.
 */

import { Platform } from 'react-native';

/** Master switch. Keep false until the native SDK is installed in a real build. */
export const ADS_ENABLED = false;

/**
 * Google's public TEST ad unit IDs — they serve fake ads and never earn or
 * spend money. We use these automatically in development (__DEV__) so real
 * impressions are never counted while testing. Replace the REAL_* values with
 * your own unit IDs from the AdMob console before shipping ads to production.
 */
const TEST_BANNER = 'ca-app-pub-3940256099942544/2934735716';
const TEST_INTERSTITIAL = 'ca-app-pub-3940256099942544/4411468910';

// TODO: paste your real AdMob unit IDs here (iOS). Android can differ.
const REAL_BANNER = 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX';
const REAL_INTERSTITIAL = 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX';

export function bannerAdUnitId(): string {
  return __DEV__ ? TEST_BANNER : REAL_BANNER;
}
export function interstitialAdUnitId(): string {
  return __DEV__ ? TEST_INTERSTITIAL : REAL_INTERSTITIAL;
}

/** True only when ads should actually run (enabled + a platform that supports them). */
export function adsActive(): boolean {
  return ADS_ENABLED && Platform.OS !== 'web';
}

/**
 * Ask for App Tracking Transparency permission (iOS) before any personalized
 * ads. If the user declines, we fall back to non-personalized ads. No-op until
 * expo-tracking-transparency is installed (see dev-notes/ADS_SETUP.md).
 * Returns true if personalized-ad tracking is allowed.
 */
export async function requestTrackingPermission(): Promise<boolean> {
  if (!adsActive() || Platform.OS !== 'ios') return false;
  // ── UNCOMMENT WHEN expo-tracking-transparency IS INSTALLED ────────────────
  // const { requestTrackingPermissionsAsync } = require('expo-tracking-transparency');
  // const { status } = await requestTrackingPermissionsAsync();
  // return status === 'granted';
  // ─────────────────────────────────────────────────────────────────────────
  return false;
}

/**
 * Initialize the ad SDK once at startup. No-op until the SDK is wired.
 * Call from App.tsx — it's safe to call when ads are off.
 */
export async function initAds(): Promise<void> {
  if (!adsActive()) return;
  // Ask for tracking first so the SDK knows whether it may personalize.
  await requestTrackingPermission();
  // ── UNCOMMENT WHEN THE SDK IS INSTALLED ──────────────────────────────────
  // const mobileAds = require('react-native-google-mobile-ads').default;
  // await mobileAds().initialize();
  // ─────────────────────────────────────────────────────────────────────────
}

/**
 * Interstitial (full-screen) ads, with a frequency cap so we never spam.
 * Show one only at natural "done" moments (finished a return, saved an item),
 * and never more than once per MIN_INTERSTITIAL_GAP_MS.
 */
const MIN_INTERSTITIAL_GAP_MS = 3 * 60 * 1000; // at most one every 3 minutes
let lastInterstitialAt = 0;

/** Returns true if enough time has passed to show another interstitial. */
export function canShowInterstitial(now = Date.now()): boolean {
  return adsActive() && now - lastInterstitialAt >= MIN_INTERSTITIAL_GAP_MS;
}

/**
 * Show an interstitial if the frequency cap allows. Resolves to whether one was
 * shown. No-op (returns false) until the SDK is wired or when ads are off.
 */
export async function maybeShowInterstitial(): Promise<boolean> {
  if (!canShowInterstitial()) return false;
  lastInterstitialAt = Date.now();
  // ── UNCOMMENT WHEN THE SDK IS INSTALLED ──────────────────────────────────
  // const { InterstitialAd, AdEventType } = require('react-native-google-mobile-ads');
  // const ad = InterstitialAd.createForAdRequest(interstitialAdUnitId());
  // return await new Promise<boolean>((resolve) => {
  //   const loaded = ad.addAdEventListener(AdEventType.LOADED, () => ad.show());
  //   const closed = ad.addAdEventListener(AdEventType.CLOSED, () => {
  //     loaded(); closed(); resolve(true);
  //   });
  //   const errored = ad.addAdEventListener(AdEventType.ERROR, () => {
  //     loaded(); closed(); errored(); resolve(false);
  //   });
  //   ad.load();
  // });
  // ─────────────────────────────────────────────────────────────────────────
  return false;
}
