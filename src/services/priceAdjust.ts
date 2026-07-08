/**
 * Store price-adjustment (a.k.a. price-protection) windows.
 *
 * Many retailers will refund the difference if an item you already bought
 * drops in price within a short window. Almost nobody claims it — so if we
 * know a purchase's store has a window, we surface it and remind the user to
 * check before it closes. This bridges the receipt side (what you paid) and
 * the price-watch side (is it cheaper now).
 *
 * Windows are the store's own published policy, kept conservative. If we don't
 * recognize the store, we simply don't claim a window exists.
 */

interface PriceAdjustPolicy {
  /** Lowercased fragments matched (whole-word) against the store name */
  match: string[];
  /** Days after purchase the store will adjust the price */
  days: number;
  /** Short human note shown to the user */
  note?: string;
}

const PRICE_ADJUST_POLICIES: PriceAdjustPolicy[] = [
  { match: ['target'], days: 14 },
  { match: ['best buy', 'bestbuy'], days: 15 },
  { match: ['costco'], days: 30, note: 'Costco adjusts within 30 days of purchase' },
  { match: ["kohl's", 'kohls'], days: 14 },
  { match: ["macy's", 'macy'], days: 10 },
  { match: ['nordstrom'], days: 14 },
  { match: ["bloomingdale's", 'bloomingdales'], days: 14 },
  { match: ['staples'], days: 14 },
  { match: ['office depot', 'officemax'], days: 14 },
  { match: ['nike'], days: 14 },
  { match: ['gap'], days: 14 },
  { match: ['old navy'], days: 14 },
  { match: ['banana republic'], days: 14 },
  { match: ['athleta'], days: 14 },
  { match: ['anthropologie'], days: 14 },
  { match: ['urban outfitters'], days: 14 },
  { match: ['j.crew', 'j crew', 'jcrew'], days: 14 },
  { match: ['crate & barrel', 'crate and barrel'], days: 14 },
  { match: ['home depot', 'homedepot'], days: 30, note: 'Home Depot may adjust within 30 days with your receipt' },
];

/** Whole-word match so "macy" doesn't match inside "pharmacy". */
function containsWord(haystack: string, fragment: string): boolean {
  const esc = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'i');
  return re.test(haystack);
}

export function lookupPriceAdjustment(
  storeName: string
): { days: number; note?: string } | null {
  const s = storeName.trim().toLowerCase();
  if (s.length < 2) return null;
  for (const p of PRICE_ADJUST_POLICIES) {
    if (p.match.some((m) => containsWord(s, m))) {
      return { days: p.days, note: p.note };
    }
  }
  return null;
}
