import React from 'react';
import { View } from 'react-native';
import { adsActive, bannerAdUnitId } from '../services/ads';
import { useAppState } from '../store/AppStateContext';

/**
 * A banner ad slot. Renders NOTHING until ads are enabled (see ads.ts), so it's
 * safe to mount anywhere today — including in Expo Go, where the AdMob native
 * module can't load. Also hidden for Boughtly Plus members. Drop it where a
 * banner should live (e.g. anchored at the bottom of the Home screen).
 */
export function BannerAdSlot() {
  const { settings } = useAppState();
  if (!adsActive() || settings.isPlus) return null;

  // ── UNCOMMENT WHEN THE SDK IS INSTALLED (see dev-notes/ADS_SETUP.md) ───────────
  // const { BannerAd, BannerAdSize } = require('react-native-google-mobile-ads');
  // return (
  //   <View style={{ alignItems: 'center' }}>
  //     <BannerAd
  //       unitId={bannerAdUnitId()}
  //       size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
  //       requestOptions={{ requestNonPersonalizedAdsOnly: true }}
  //     />
  //   </View>
  // );
  // ─────────────────────────────────────────────────────────────────────────

  // Placeholder height reserve while the real banner is staged (never reached
  // today because adsActive() is false; kept so the reference is obvious).
  void bannerAdUnitId;
  return <View />;
}
