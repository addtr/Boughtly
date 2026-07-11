/**
 * Resolves an item to the manufacturer's warranty/support page so a claim is
 * one tap away. Warranties are honored by the maker, so we match a brand in
 * the item name first; if we don't recognize a brand, we fall back to a web
 * search for that item's warranty — so it always leads somewhere useful.
 *
 * Direct `warrantyUrl` is set ONLY when live-verified (HTTP 200 at that
 * address — last pass 2026-07-11); everything else opens a site-pinned search
 * whose top result is the brand's current warranty page and can never 404.
 * Same verify-before-promote rule as returnUrl.ts.
 */

interface BrandWarranty {
  /** Lowercased brand fragments matched (whole-word) against the item name */
  match: string[];
  label: string;
  /** Official domain — the claim search is pinned to this site (never 404s) */
  domain: string;
  /** Direct warranty/support page — ONLY set when live-verified (see header). */
  warrantyUrl?: string;
}

function siteSearch(domain: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`warranty claim support site:${domain}`)}`;
}

// Order: multi-word/more-specific brands before shorter ones they contain.
const BRAND_WARRANTIES: BrandWarranty[] = [
  { match: ['apple', 'macbook', 'iphone', 'ipad', 'airpods', 'imac'], label: 'Apple', domain: 'support.apple.com' },
  { match: ['samsung', 'galaxy'], label: 'Samsung', domain: 'samsung.com', warrantyUrl: 'https://www.samsung.com/us/support/warranty/' },
  { match: ['sony', 'playstation', 'ps5', 'ps4'], label: 'Sony', domain: 'sony.com' },
  { match: ['lg'], label: 'LG', domain: 'lg.com', warrantyUrl: 'https://www.lg.com/us/support' },
  { match: ['dyson'], label: 'Dyson', domain: 'dyson.com', warrantyUrl: 'https://www.dyson.com/inside-dyson/terms/the-dyson-limited-warranty' },
  { match: ['bose'], label: 'Bose', domain: 'bose.com', warrantyUrl: 'https://www.bose.com/legal/product-warranty' },
  { match: ['sonos'], label: 'Sonos', domain: 'sonos.com', warrantyUrl: 'https://support.sonos.com/en-us/article/the-sonos-warranty' },
  { match: ['jbl'], label: 'JBL', domain: 'jbl.com' },
  { match: ['beats'], label: 'Beats', domain: 'beatsbydre.com' },
  { match: ['anker', 'soundcore', 'eufy'], label: 'Anker', domain: 'anker.com', warrantyUrl: 'https://service.anker.com/article-description/Anker-Warranty-Policy' },
  { match: ['logitech'], label: 'Logitech', domain: 'logitech.com', warrantyUrl: 'https://www.logitech.com/en-us/tos/limited-hardware-warranty' },
  { match: ['gopro'], label: 'GoPro', domain: 'gopro.com' },
  { match: ['garmin'], label: 'Garmin', domain: 'garmin.com', warrantyUrl: 'https://support.garmin.com/en-US/warranty/' },
  { match: ['fitbit'], label: 'Fitbit', domain: 'fitbit.com', warrantyUrl: 'https://support.google.com/product-documentation/answer/14815834' },
  { match: ['nintendo', 'switch'], label: 'Nintendo', domain: 'nintendo.com', warrantyUrl: 'https://en-americas-support.nintendo.com/app/answers/detail/a_id/50404/~/warranty-and-service-information' },
  { match: ['xbox', 'microsoft', 'surface'], label: 'Microsoft', domain: 'microsoft.com' },
  { match: ['dell', 'alienware'], label: 'Dell', domain: 'dell.com' },
  { match: ['hp', 'hewlett'], label: 'HP', domain: 'hp.com', warrantyUrl: 'https://support.hp.com/us-en/warranty' },
  { match: ['lenovo', 'thinkpad'], label: 'Lenovo', domain: 'lenovo.com' },
  { match: ['asus'], label: 'ASUS', domain: 'asus.com' },
  { match: ['acer'], label: 'Acer', domain: 'acer.com' },
  { match: ['razer'], label: 'Razer', domain: 'razer.com', warrantyUrl: 'https://www.razer.com/warranty' },
  { match: ['kitchenaid'], label: 'KitchenAid', domain: 'kitchenaid.com' },
  { match: ['cuisinart'], label: 'Cuisinart', domain: 'cuisinart.com' },
  { match: ['ninja', 'nutri ninja'], label: 'Ninja', domain: 'ninjakitchen.com' },
  { match: ['instant pot', 'instant'], label: 'Instant', domain: 'instanthome.com' },
  { match: ['keurig'], label: 'Keurig', domain: 'keurig.com' },
  { match: ['nespresso'], label: 'Nespresso', domain: 'nespresso.com' },
  { match: ['vitamix'], label: 'Vitamix', domain: 'vitamix.com' },
  { match: ['breville'], label: 'Breville', domain: 'breville.com' },
  { match: ['irobot', 'roomba'], label: 'iRobot', domain: 'irobot.com' },
  { match: ['shark'], label: 'Shark', domain: 'sharkclean.com' },
  { match: ['bissell'], label: 'Bissell', domain: 'bissell.com' },
  { match: ['philips'], label: 'Philips', domain: 'philips.com' },
  { match: ['braun'], label: 'Braun', domain: 'braun.com' },
  { match: ['dewalt'], label: 'DeWalt', domain: 'dewalt.com' },
  { match: ['milwaukee'], label: 'Milwaukee', domain: 'milwaukeetool.com' },
  { match: ['makita'], label: 'Makita', domain: 'makitatools.com' },
  { match: ['ryobi'], label: 'Ryobi', domain: 'ryobitools.com' },
  { match: ['bosch'], label: 'Bosch', domain: 'boschtools.com' },
  { match: ['black+decker', 'black & decker', 'black and decker'], label: 'Black+Decker', domain: 'blackanddecker.com' },
  { match: ['craftsman'], label: 'Craftsman', domain: 'craftsman.com' },
  { match: ['weber'], label: 'Weber', domain: 'weber.com' },
  { match: ['traeger'], label: 'Traeger', domain: 'traeger.com' },
  { match: ['ring'], label: 'Ring', domain: 'ring.com' },
  { match: ['nest', 'google'], label: 'Google', domain: 'store.google.com' },
  { match: ['whirlpool'], label: 'Whirlpool', domain: 'whirlpool.com' },
  { match: ['ge appliances', 'ge appliance'], label: 'GE Appliances', domain: 'geappliances.com' },
  { match: ['samsonite'], label: 'Samsonite', domain: 'samsonite.com' },
  { match: ['yeti'], label: 'YETI', domain: 'yeti.com' },
];

function containsWord(haystack: string, fragment: string): boolean {
  const esc = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'i');
  return re.test(haystack);
}

export interface ResolvedWarrantyPage {
  url: string;
  /** True when a known manufacturer matched */
  known: boolean;
  label: string;
}

/** A web search that surfaces an item's warranty/support page. */
export function warrantySearchUrl(itemName: string): string {
  const q = `${itemName.trim()} warranty claim support`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/**
 * Resolve where to file a warranty claim for an item. Matches a known brand in
 * the item name; otherwise returns a warranty search for the item.
 */
export function resolveWarrantyPage(itemName: string): ResolvedWarrantyPage {
  const s = itemName.trim().toLowerCase();
  if (s.length >= 2) {
    for (const b of BRAND_WARRANTIES) {
      if (b.match.some((m) => containsWord(s, m))) {
        return { url: b.warrantyUrl ?? siteSearch(b.domain), known: true, label: b.label };
      }
    }
  }
  return { url: warrantySearchUrl(itemName), known: false, label: itemName.trim() };
}

/**
 * Resolve where to REGISTER a product with its maker. Same brand matching as
 * claims, but pointed at the manufacturer's product-registration page — via a
 * site-pinned search, so it never 404s as makers move their forms around.
 */
export function resolveRegistrationPage(itemName: string): ResolvedWarrantyPage {
  const s = itemName.trim().toLowerCase();
  if (s.length >= 2) {
    for (const b of BRAND_WARRANTIES) {
      if (b.match.some((m) => containsWord(s, m))) {
        return {
          url: `https://www.google.com/search?q=${encodeURIComponent(
            `product registration site:${b.domain}`
          )}`,
          known: true,
          label: b.label,
        };
      }
    }
  }
  return {
    url: `https://www.google.com/search?q=${encodeURIComponent(
      `${itemName.trim()} product registration`
    )}`,
    known: false,
    label: itemName.trim(),
  };
}
