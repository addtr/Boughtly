/**
 * Resolves an item to the manufacturer's warranty/support page so a claim is
 * one tap away. Warranties are honored by the maker, so we match a brand in
 * the item name first; if we don't recognize a brand, we fall back to a web
 * search for that item's warranty — so it always leads somewhere useful.
 */

interface BrandWarranty {
  /** Lowercased brand fragments matched (whole-word) against the item name */
  match: string[];
  label: string;
  /** Official domain — the claim search is pinned to this site (never 404s) */
  domain: string;
}

function siteSearch(domain: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`warranty claim support site:${domain}`)}`;
}

// Order: multi-word/more-specific brands before shorter ones they contain.
const BRAND_WARRANTIES: BrandWarranty[] = [
  { match: ['apple', 'macbook', 'iphone', 'ipad', 'airpods', 'imac'], label: 'Apple', domain: 'support.apple.com' },
  { match: ['samsung', 'galaxy'], label: 'Samsung', domain: 'samsung.com' },
  { match: ['sony', 'playstation', 'ps5', 'ps4'], label: 'Sony', domain: 'sony.com' },
  { match: ['lg'], label: 'LG', domain: 'lg.com' },
  { match: ['dyson'], label: 'Dyson', domain: 'dyson.com' },
  { match: ['bose'], label: 'Bose', domain: 'bose.com' },
  { match: ['sonos'], label: 'Sonos', domain: 'sonos.com' },
  { match: ['jbl'], label: 'JBL', domain: 'jbl.com' },
  { match: ['beats'], label: 'Beats', domain: 'beatsbydre.com' },
  { match: ['anker', 'soundcore', 'eufy'], label: 'Anker', domain: 'anker.com' },
  { match: ['logitech'], label: 'Logitech', domain: 'logitech.com' },
  { match: ['gopro'], label: 'GoPro', domain: 'gopro.com' },
  { match: ['garmin'], label: 'Garmin', domain: 'garmin.com' },
  { match: ['fitbit'], label: 'Fitbit', domain: 'fitbit.com' },
  { match: ['nintendo', 'switch'], label: 'Nintendo', domain: 'nintendo.com' },
  { match: ['xbox', 'microsoft', 'surface'], label: 'Microsoft', domain: 'microsoft.com' },
  { match: ['dell', 'alienware'], label: 'Dell', domain: 'dell.com' },
  { match: ['hp', 'hewlett'], label: 'HP', domain: 'hp.com' },
  { match: ['lenovo', 'thinkpad'], label: 'Lenovo', domain: 'lenovo.com' },
  { match: ['asus'], label: 'ASUS', domain: 'asus.com' },
  { match: ['acer'], label: 'Acer', domain: 'acer.com' },
  { match: ['razer'], label: 'Razer', domain: 'razer.com' },
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
        return { url: siteSearch(b.domain), known: true, label: b.label };
      }
    }
  }
  return { url: warrantySearchUrl(itemName), known: false, label: itemName.trim() };
}
