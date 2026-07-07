import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

/** Live cross-retailer shopping search for a product, cheapest listings first. */
export function priceScanUrl(productName: string): string {
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(productName)}`;
}

/**
 * Opens the price scan. Native: in-app browser sheet (resolves when closed).
 * Web: plain window.open — must stay synchronous to keep the click gesture,
 * or the popup gets blocked.
 */
export async function openPriceScan(productName: string): Promise<void> {
  const url = priceScanUrl(productName);
  if (Platform.OS === 'web') {
    Linking.openURL(url).catch(() => {});
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await Linking.openURL(url).catch(() => {});
  }
}
