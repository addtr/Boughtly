/**
 * Boughtly Plus — premium tier scaffold.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * STATUS: entitlement + limits are LIVE (isPlus in settings). Real billing is
 * a skeleton, OFF by default (PLUS_IAP_ENABLED = false) because App Store
 * in-app purchases can't run in Expo Go. While billing is off, the paywall
 * explains it isn't live yet, and in development a manual unlock lets you test
 * every Plus-gated feature.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * To wire real billing later (in a dev/production build), see
 * dev-notes/PLUS_SETUP.md.
 */

import { Platform } from 'react-native';

/** Master switch for real in-app-purchase billing. Keep false until wired. */
export const PLUS_IAP_ENABLED = false;

/** Free-tier item cap. Plus removes it. */
export const FREE_ITEM_LIMIT = 15;

/** Free-tier cap on photos + attached files per item. Plus removes it. */
export const FREE_FILES_PER_ITEM = 1;

/** Free-tier cap on watched prices (the Prices tab). Plus removes it. */
export const FREE_WATCH_LIMIT = 4;

/** Display prices (App Store is the source of truth once billing is wired). */
export const PLUS_PRICE_MONTHLY = '$4.99';
export const PLUS_PRICE_YEARLY = '$49.99';

/** App Store product IDs — create these in App Store Connect. */
export const PLUS_PRODUCT_IDS = {
  monthly: 'com.addtr.boughtly.plus.monthly',
  yearly: 'com.addtr.boughtly.plus.yearly',
} as const;
export type PlusPlan = keyof typeof PLUS_PRODUCT_IDS;

export interface PlusPerk {
  icon: string;
  title: string;
  body: string;
  /** True when this perk is actually enforced today (vs. advertised/coming). */
  live?: boolean;
}

/** The value prop shown on the paywall. `live` ones are enforced now. */
export const PLUS_PERKS: PlusPerk[] = [
  { icon: 'ban-outline', title: 'No ads, ever', body: 'A clean, focused app with zero ads.', live: true },
  { icon: 'infinite-outline', title: 'Unlimited items', body: `Track more than the free ${FREE_ITEM_LIMIT}-item limit.`, live: true },
  { icon: 'pricetags-outline', title: 'Unlimited price watches', body: `Watch more than ${FREE_WATCH_LIMIT} items in the Prices tab.`, live: true },
  { icon: 'shield-checkmark-outline', title: 'Recall safety alerts', body: 'Boughtly checks your items against official recalls and warns you.', live: true },
  { icon: 'images-outline', title: 'Unlimited photos & files', body: 'Add every receipt page, product photo, and warranty doc.', live: true },
  { icon: 'document-text-outline', title: 'Insurance & CSV exports', body: 'Pro home-inventory PDF and spreadsheet exports.', live: true },
  { icon: 'sparkles-outline', title: 'Smart receipt scanning', body: 'AI reads messy receipts and fills in the details for you.' },
  { icon: 'cloud-upload-outline', title: 'Cloud backup & sync', body: 'Your data safe on every device (coming soon).' },
];

/** Whether a free user can add another item, or has hit the cap. */
export function canAddItem(currentItemCount: number, isPlus: boolean): boolean {
  return isPlus || currentItemCount < FREE_ITEM_LIMIT;
}

/** Whether a free user can add another photo/file to an item, or has hit the cap. */
export function canAddFile(currentFileCount: number, isPlus: boolean): boolean {
  return isPlus || currentFileCount < FREE_FILES_PER_ITEM;
}

/** Whether a free user can watch another price, or has hit the cap. */
export function canAddWatch(currentWatchCount: number, isPlus: boolean): boolean {
  return isPlus || currentWatchCount < FREE_WATCH_LIMIT;
}

/**
 * Start a purchase. Resolves true if the user is now entitled to Plus. The
 * caller persists isPlus via updateSettings on success. No-op (false) until
 * billing is wired — the paywall handles the "not live yet" messaging.
 */
export async function purchasePlus(_plan: PlusPlan): Promise<boolean> {
  if (!PLUS_IAP_ENABLED || Platform.OS === 'web') return false;
  // ── UNCOMMENT WHEN AN IAP LIBRARY IS INSTALLED (see dev-notes/PLUS_SETUP.md) ───
  // const { requestSubscription } = require('react-native-iap');
  // const productId = PLUS_PRODUCT_IDS[_plan];
  // const purchase = await requestSubscription({ sku: productId });
  // return !!purchase; // then finish/acknowledge the transaction
  // ─────────────────────────────────────────────────────────────────────────
  return false;
}

/** Restore a previous Plus purchase (App Store requires a Restore button). */
export async function restorePlus(): Promise<boolean> {
  if (!PLUS_IAP_ENABLED || Platform.OS === 'web') return false;
  // ── UNCOMMENT WHEN AN IAP LIBRARY IS INSTALLED ───────────────────────────
  // const { getAvailablePurchases } = require('react-native-iap');
  // const purchases = await getAvailablePurchases();
  // return purchases.some((p) => Object.values(PLUS_PRODUCT_IDS).includes(p.productId));
  // ─────────────────────────────────────────────────────────────────────────
  return false;
}
