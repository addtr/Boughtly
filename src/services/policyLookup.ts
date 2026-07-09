/**
 * Built-in knowledge base: retailer return policies + typical manufacturer
 * warranties by product category. Receipts never print these, so after a
 * scan (or manual entry) Boughtly fills them in automatically — clearly
 * labeled as typical policy the user can override.
 *
 * Data is intentionally conservative and editable in one place.
 */

export interface PolicySuggestion {
  returnDays?: number;
  returnNote?: string;
  warrantyDays?: number;
  warrantyNote?: string;
}

interface StorePolicy {
  /** Lowercased fragments matched against the store name */
  match: string[];
  days: number;
  note?: string;
}

// Standard return windows for major US retailers (base policy, no membership perks)
const STORE_RETURN_POLICIES: StorePolicy[] = [
  { match: ['target'], days: 90 },
  { match: ['walmart'], days: 90 },
  { match: ['best buy', 'bestbuy'], days: 15, note: 'short window — act fast' },
  { match: ['amazon'], days: 30 },
  { match: ['costco'], days: 90, note: '90 days for electronics; most else is flexible' },
  { match: ['home depot'], days: 90 },
  { match: ["lowe's", 'lowes'], days: 90 },
  { match: ['ikea'], days: 365 },
  { match: ['apple'], days: 14 },
  { match: ['nordstrom'], days: 90 },
  { match: ['macy'], days: 30 },
  { match: ["kohl's", 'kohls'], days: 180 },
  { match: ['tj maxx', 'tjmaxx', 'marshalls', 'homegoods'], days: 30 },
  { match: ['rei'], days: 365 },
  { match: ['sephora'], days: 30 },
  { match: ['ulta'], days: 60 },
  { match: ['gamestop'], days: 30 },
  { match: ["dick's", 'dicks sporting'], days: 90 },
  { match: ['staples'], days: 30 },
  { match: ['office depot', 'officemax'], days: 30 },
  { match: ['wayfair'], days: 30 },
  { match: ['nike'], days: 60 },
  { match: ['h&m', 'h & m'], days: 30 },
  { match: ['zara'], days: 30 },
  { match: ['old navy', 'gap', 'banana republic'], days: 30 },
  { match: ['williams sonoma', 'williams-sonoma'], days: 30 },
  { match: ['crate & barrel', 'crate and barrel'], days: 30 },
  { match: ['trader joe', 'whole foods', 'kroger', 'safeway', 'aldi'], days: 30, note: 'groceries are usually easy to return with a receipt' },
  { match: ['cvs'], days: 60, note: 'CVS: 60 days with receipt' },
  { match: ['walgreens', 'walgreen'], days: 30 },
  { match: ['rite aid', 'riteaid'], days: 30 },
  { match: ['petco', 'petsmart'], days: 60 },
  { match: ['bath & body', 'bath and body'], days: 90 },
  { match: ['michaels', 'joann', "jo-ann", 'hobby lobby'], days: 60 },
  { match: ['autozone', "o'reilly", 'advance auto'], days: 90 },
  { match: ['ace hardware'], days: 30 },
];

interface WarrantyCategory {
  keywords: string[];
  days: number;
  label: string;
}

// Typical *manufacturer* warranties by category. 0 days = no warranty beyond
// the return window (textiles, basics) — we mirror the return window instead.
const WARRANTY_CATEGORIES: WarrantyCategory[] = [
  {
    keywords: ['coffee', 'espresso', 'blender', 'toaster', 'kettle', 'mixer', 'air fryer', 'fryer', 'instant pot', 'grinder', 'juicer', 'microwave', 'vacuum', 'purifier', 'humidifier', 'fan', 'heater', 'iron'],
    days: 365,
    label: 'small appliances usually carry a 1-year manufacturer warranty',
  },
  {
    keywords: ['drill', 'saw', 'sander', 'impact driver', 'power tool', 'dewalt', 'makita', 'milwaukee', 'ryobi'],
    days: 1095,
    label: 'power tools usually carry a 3-year manufacturer warranty',
  },
  {
    keywords: ['tv', 'television', 'laptop', 'macbook', 'computer', 'monitor', 'phone', 'iphone', 'tablet', 'ipad', 'camera', 'headphone', 'earbud', 'airpod', 'speaker', 'soundbar', 'console', 'playstation', 'xbox', 'nintendo', 'router', 'printer', 'keyboard', 'mouse', 'watch', 'kindle', 'drone'],
    days: 365,
    label: 'electronics usually carry a 1-year manufacturer warranty',
  },
  {
    keywords: ['refrigerator', 'fridge', 'washer', 'dryer', 'dishwasher', 'oven', 'range', 'freezer'],
    days: 365,
    label: 'major appliances usually carry a 1-year manufacturer warranty',
  },
  {
    keywords: ['mattress'],
    days: 3650,
    label: 'mattresses usually carry a 10-year warranty',
  },
  {
    keywords: ['sofa', 'couch', 'chair', 'desk', 'table', 'dresser', 'bookshelf', 'cabinet', 'bed frame'],
    days: 365,
    label: 'furniture usually carries a 1-year warranty',
  },
  {
    keywords: ['towel', 'sheet', 'blanket', 'pillow', 'curtain', 'rug', 'shirt', 't-shirt', 'pants', 'jeans', 'jacket', 'hoodie', 'dress', 'sock', 'shoe', 'sneaker', 'boot', 'sandal', 'hat', 'glove', 'scarf', 'swimsuit', 'underwear'],
    days: 0,
    label: 'clothing & textiles have no manufacturer warranty — the return window is your protection',
  },
  {
    keywords: ['toy', 'lego', 'board game', 'puzzle', 'doll'],
    days: 90,
    label: 'toys usually carry a 90-day warranty',
  },
];

/**
 * Whole-word (not naive substring) match, so "macy" doesn't match inside
 * "phar-macy" and "gap" doesn't match inside "gap-filler". A fragment matches
 * when it appears bounded by non-letters (or string edges). Fragments may
 * contain spaces/punctuation (e.g. "tj maxx", "h&m") — those match literally.
 */
function containsWord(haystack: string, fragment: string): boolean {
  const esc = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // \b is unreliable around & and ' — bound with "not a letter/digit".
  // Allow a plural suffix so "headphones"/"toys" match the singular keyword.
  const re = new RegExp(`(^|[^a-z0-9])${esc}(s|es)?([^a-z0-9]|$)`, 'i');
  return re.test(haystack);
}

export function lookupStoreReturnPolicy(storeName: string): { days: number; note?: string } | null {
  const s = storeName.trim().toLowerCase();
  if (s.length < 2) return null;
  for (const policy of STORE_RETURN_POLICIES) {
    if (policy.match.some((m) => containsWord(s, m))) {
      return { days: policy.days, note: policy.note };
    }
  }
  return null;
}

export function lookupWarrantyByCategory(itemName: string): { days: number; label: string } | null {
  const s = itemName.trim().toLowerCase();
  if (s.length < 3) return null;
  for (const cat of WARRANTY_CATEGORIES) {
    if (cat.keywords.some((k) => containsWord(s, k))) {
      return { days: cat.days, label: cat.label };
    }
  }
  return null;
}

/**
 * Combined suggestion for an item+store pair.
 *
 * Warranty rule (the important one): a real manufacturer warranty is only
 * suggested when we recognize the product category. Otherwise — and for
 * categories with no manufacturer warranty, like textiles or groceries —
 * the warranty mirrors the return window, so we never invent a bogus
 * "1 year" for a snack or a T-shirt.
 */
export function suggestPolicies(
  itemName: string,
  storeName: string,
  /** Authoritative return window (e.g. printed on the receipt) to mirror for
   *  items with no manufacturer warranty. Overrides the store-policy guess. */
  knownReturnDays?: number
): PolicySuggestion {
  const out: PolicySuggestion = {};
  const store = lookupStoreReturnPolicy(storeName);
  if (store) {
    out.returnDays = store.days;
    out.returnNote = `${storeName.trim()} returns are typically ${store.days} days${
      store.note ? ` (${store.note})` : ''
    }`;
  }

  const warranty = lookupWarrantyByCategory(itemName);
  // Prefer the authoritative (receipt) window for mirroring; else store policy
  const mirror = knownReturnDays ?? out.returnDays;

  if (warranty && warranty.days > 0) {
    // Known product category with a genuine manufacturer warranty
    out.warrantyDays = warranty.days;
    out.warrantyNote = warranty.label;
  } else if (warranty && warranty.days === 0) {
    // Known category that has NO manufacturer warranty (textiles, etc.)
    if (mirror !== undefined) {
      out.warrantyDays = mirror;
      out.warrantyNote = warranty.label;
    }
  } else if (mirror !== undefined) {
    // Unknown product — don't invent a warranty; track the return window
    out.warrantyDays = mirror;
    out.warrantyNote =
      'No manufacturer warranty found for this item — tracking the return window instead. Edit if it came with one.';
  }
  return out;
}
