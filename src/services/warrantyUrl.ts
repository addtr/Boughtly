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
  { match: ['apple', 'macbook', 'iphone', 'ipad', 'airpods', 'imac'], label: 'Apple', domain: 'support.apple.com', warrantyUrl: 'https://support.apple.com/en-us/102865' },
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
  { match: ['gopro'], label: 'GoPro', domain: 'gopro.com', warrantyUrl: 'https://community.gopro.com/s/article/Warranty-Information?language=en_US' },
  { match: ['garmin'], label: 'Garmin', domain: 'garmin.com', warrantyUrl: 'https://support.garmin.com/en-US/warranty/' },
  { match: ['fitbit'], label: 'Fitbit', domain: 'fitbit.com', warrantyUrl: 'https://support.google.com/product-documentation/answer/14815834' },
  { match: ['nintendo', 'switch'], label: 'Nintendo', domain: 'nintendo.com', warrantyUrl: 'https://en-americas-support.nintendo.com/app/answers/detail/a_id/50404/~/warranty-and-service-information' },
  { match: ['xbox', 'microsoft', 'surface'], label: 'Microsoft', domain: 'microsoft.com', warrantyUrl: 'https://support.microsoft.com/en-us/surface/hardware-warranty/' },
  { match: ['dell', 'alienware'], label: 'Dell', domain: 'dell.com' },
  { match: ['hp', 'hewlett'], label: 'HP', domain: 'hp.com', warrantyUrl: 'https://support.hp.com/us-en/warranty' },
  { match: ['lenovo', 'thinkpad'], label: 'Lenovo', domain: 'lenovo.com', warrantyUrl: 'https://pcsupport.lenovo.com/us/en/warrantylookup' },
  { match: ['asus'], label: 'ASUS', domain: 'asus.com', warrantyUrl: 'https://www.asus.com/us/support/warranty-status-inquiry/' },
  { match: ['acer'], label: 'Acer', domain: 'acer.com' },
  { match: ['razer'], label: 'Razer', domain: 'razer.com', warrantyUrl: 'https://www.razer.com/warranty' },
  { match: ['kitchenaid'], label: 'KitchenAid', domain: 'kitchenaid.com' },
  { match: ['cuisinart'], label: 'Cuisinart', domain: 'cuisinart.com', warrantyUrl: 'https://www.cuisinart.com/support/warranty.html' },
  { match: ['ninja', 'nutri ninja'], label: 'Ninja', domain: 'ninjakitchen.com', warrantyUrl: 'https://support.sharkninja.com/article/Ninja-2-Year-Limited-Warranty' },
  { match: ['instant pot', 'instant'], label: 'Instant', domain: 'instanthome.com' },
  { match: ['keurig'], label: 'Keurig', domain: 'keurig.com' },
  { match: ['nespresso'], label: 'Nespresso', domain: 'nespresso.com', warrantyUrl: 'https://www.nespresso.com/us/en/service-customer-care' },
  { match: ['vitamix'], label: 'Vitamix', domain: 'vitamix.com', warrantyUrl: 'https://www.vitamix.com/us/en_us/vitamix-advantage/warranty/' },
  { match: ['breville'], label: 'Breville', domain: 'breville.com', warrantyUrl: 'https://www.breville.com/us/en/support/warranty.html' },
  { match: ['irobot', 'roomba'], label: 'iRobot', domain: 'irobot.com', warrantyUrl: 'https://homesupport.irobot.com/s/article/3096' },
  { match: ['shark'], label: 'Shark', domain: 'sharkclean.com', warrantyUrl: 'https://support.sharkninja.com/article/Shark-5-Year-Limited-Warranty' },
  { match: ['bissell'], label: 'Bissell', domain: 'bissell.com', warrantyUrl: 'https://www.bissell.com/en-us/warranty-information/' },
  { match: ['philips'], label: 'Philips', domain: 'philips.com', warrantyUrl: 'https://www.usa.philips.com/c-s/support/warranty' },
  { match: ['braun'], label: 'Braun', domain: 'braun.com' },
  { match: ['dewalt'], label: 'DeWalt', domain: 'dewalt.com', warrantyUrl: 'https://www.dewalt.com/en-us/support/warranty' },
  { match: ['milwaukee'], label: 'Milwaukee', domain: 'milwaukeetool.com', warrantyUrl: 'https://www.milwaukeetool.com/support/registration-and-warranty' },
  { match: ['makita'], label: 'Makita', domain: 'makitatools.com' },
  { match: ['ryobi'], label: 'Ryobi', domain: 'ryobitools.com' },
  { match: ['bosch'], label: 'Bosch', domain: 'boschtools.com' },
  { match: ['black+decker', 'black & decker', 'black and decker'], label: 'Black+Decker', domain: 'blackanddecker.com' },
  { match: ['craftsman'], label: 'Craftsman', domain: 'craftsman.com', warrantyUrl: 'https://www.craftsman.com/en-us/support/customer-support/warranty' },
  { match: ['weber'], label: 'Weber', domain: 'weber.com', warrantyUrl: 'https://www.weber.com/US/en/warranties.html' },
  { match: ['traeger'], label: 'Traeger', domain: 'traeger.com', warrantyUrl: 'https://www.traeger.com/service-warranty' },
  { match: ['ring'], label: 'Ring', domain: 'ring.com', warrantyUrl: 'https://ring.com/warranty' },
  { match: ['nest', 'google'], label: 'Google', domain: 'store.google.com' },
  { match: ['whirlpool'], label: 'Whirlpool', domain: 'whirlpool.com' },
  { match: ['ge appliances', 'ge appliance'], label: 'GE Appliances', domain: 'geappliances.com' },
  { match: ['samsonite'], label: 'Samsonite', domain: 'samsonite.com' },
  { match: ['yeti'], label: 'YETI', domain: 'yeti.com' },

  // ── Verified direct pages — batch 8 (2026-07-11) ──
  { match: ['hisense'], label: 'Hisense', domain: 'hisense-usa.com', warrantyUrl: 'https://www.hisense-usa.com/support/warranty' },
  { match: ['nikon'], label: 'Nikon', domain: 'nikonusa.com', warrantyUrl: 'https://www.nikonusa.com/learn-and-explore/warranty' },
  { match: ['seiko'], label: 'Seiko', domain: 'seikousa.com', warrantyUrl: 'https://seikousa.com/pages/warranty' },
  { match: ['herschel'], label: 'Herschel', domain: 'herschel.com', warrantyUrl: 'https://herschel.com/pages/warranty' },
  { match: ['patagonia'], label: 'Patagonia', domain: 'patagonia.com' },

  // ── Verified direct pages — batch 9 (2026-07-23) ──
  { match: ['greenworks'], label: 'Greenworks', domain: 'greenworkstools.com', warrantyUrl: 'https://greenworkstools.com/pages/warranty' },
  { match: ['le creuset'], label: 'Le Creuset', domain: 'lecreuset.com', warrantyUrl: 'https://www.lecreuset.com/warranty.html' },
  { match: ['simplehuman'], label: 'simplehuman', domain: 'simplehuman.com', warrantyUrl: 'https://www.simplehuman.com/pages/warranty' },

  // ── Added brands — site-pinned warranty search (never 404s) — 2026-07-23 ──
  { match: ['canon'], label: 'Canon', domain: 'usa.canon.com' },
  { match: ['epson'], label: 'Epson', domain: 'epson.com' },
  { match: ['vizio'], label: 'Vizio', domain: 'vizio.com' },
  { match: ['tcl'], label: 'TCL', domain: 'tcl.com' },
  { match: ['roku'], label: 'Roku', domain: 'roku.com' },
  { match: ['panasonic'], label: 'Panasonic', domain: 'panasonic.com' },
  { match: ['toshiba'], label: 'Toshiba', domain: 'toshiba.com' },
  { match: ['oxo'], label: 'OXO', domain: 'oxo.com' },
  { match: ['solo stove', 'solostove'], label: 'Solo Stove', domain: 'solostove.com' },
  { match: ['therabody', 'theragun'], label: 'Therabody', domain: 'therabody.com' },
  { match: ['oakley'], label: 'Oakley', domain: 'oakley.com' },
  { match: ['ray-ban', 'rayban', 'ray ban'], label: 'Ray-Ban', domain: 'ray-ban.com' },
  { match: ['simplisafe'], label: 'SimpliSafe', domain: 'simplisafe.com' },
  { match: ['arlo'], label: 'Arlo', domain: 'arlo.com' },
  { match: ['wyze'], label: 'Wyze', domain: 'wyze.com' },
  { match: ['ridgid'], label: 'RIDGID', domain: 'ridgid.com' },
  { match: ['ego power', 'ego'], label: 'EGO Power+', domain: 'egopowerplus.com' },
  { match: ['husqvarna'], label: 'Husqvarna', domain: 'husqvarna.com' },
  { match: ['brother'], label: 'Brother', domain: 'brother-usa.com' },
  { match: ['fossil'], label: 'Fossil', domain: 'fossil.com' },
  { match: ['casio', 'g-shock'], label: 'Casio', domain: 'casio.com' },
  { match: ['citizen'], label: 'Citizen', domain: 'citizenwatch.com' },
  { match: ['stanley'], label: 'Stanley', domain: 'stanley1913.com' },
  { match: ['hydro flask', 'hydroflask'], label: 'Hydro Flask', domain: 'hydroflask.com' },
  { match: ['owala'], label: 'Owala', domain: 'owala.com' },
  { match: ['lodge'], label: 'Lodge', domain: 'lodgecastiron.com' },
  { match: ['all-clad', 'all clad'], label: 'All-Clad', domain: 'all-clad.com' },
  { match: ['zwilling', 'henckels'], label: 'Zwilling', domain: 'zwilling.com' },
  { match: ['roborock'], label: 'Roborock', domain: 'roborock.com' },
  { match: ['ecovacs', 'deebot'], label: 'Ecovacs', domain: 'ecovacs.com' },
  { match: ['sennheiser'], label: 'Sennheiser', domain: 'sennheiser.com' },
  { match: ['skullcandy'], label: 'Skullcandy', domain: 'skullcandy.com' },
  { match: ['oura'], label: 'Oura', domain: 'ouraring.com' },

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
