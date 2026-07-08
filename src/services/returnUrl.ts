/**
 * Resolves a store name to the web page where you actually start a return.
 *
 * Known retailers map to their returns/returns-help landing page. Anything we
 * don't recognize falls back to a web search scoped to that store's returns,
 * so typing any store name always takes you somewhere useful.
 */

interface StoreReturnSite {
  /** Lowercased fragments matched against the typed store name */
  match: string[];
  url: string;
  /** Friendly label for the button, e.g. "Target" */
  label: string;
}

// Curated return/returns-help pages for major US retailers.
const STORE_RETURN_SITES: StoreReturnSite[] = [
  { match: ['amazon'], label: 'Amazon', url: 'https://www.amazon.com/returns' },
  { match: ['target'], label: 'Target', url: 'https://www.target.com/returns' },
  { match: ['walmart'], label: 'Walmart', url: 'https://www.walmart.com/returns' },
  { match: ['best buy', 'bestbuy'], label: 'Best Buy', url: 'https://www.bestbuy.com/returns' },
  { match: ['costco'], label: 'Costco', url: 'https://www.costco.com/returns-and-exchanges.html' },
  { match: ['home depot', 'homedepot'], label: 'The Home Depot', url: 'https://www.homedepot.com/c/Return_Policy' },
  { match: ["lowe's", 'lowes'], label: "Lowe's", url: 'https://www.lowes.com/l/help/returns-policy' },
  { match: ['ikea'], label: 'IKEA', url: 'https://www.ikea.com/us/en/customer-service/returns-claims/' },
  { match: ['apple'], label: 'Apple', url: 'https://www.apple.com/shop/help/returns_refund' },
  { match: ['nordstrom'], label: 'Nordstrom', url: 'https://www.nordstrom.com/browse/customer-service/returns' },
  { match: ["macy's", 'macy'], label: "Macy's", url: 'https://www.macys.com/service/returns/' },
  { match: ["kohl's", 'kohls'], label: "Kohl's", url: 'https://cs.kohls.com/app/answers/detail/a_id/247' },
  { match: ['tj maxx', 'tjmaxx'], label: 'TJ Maxx', url: 'https://www.tjmaxx.tjx.com/store/jump/topic/return-policy/2600006' },
  { match: ['marshalls'], label: 'Marshalls', url: 'https://www.marshalls.com/us/store/jump/topic/returns/2400013' },
  { match: ['rei'], label: 'REI', url: 'https://www.rei.com/help/returns' },
  { match: ['sephora'], label: 'Sephora', url: 'https://www.sephora.com/beauty/returns-exchanges' },
  { match: ['ulta'], label: 'Ulta', url: 'https://www.ulta.com/company/return-policy' },
  { match: ['gamestop'], label: 'GameStop', url: 'https://www.gamestop.com/returns' },
  { match: ["dick's", 'dicks sporting'], label: "Dick's Sporting Goods", url: 'https://www.dickssportinggoods.com/s/return-policy' },
  { match: ['staples'], label: 'Staples', url: 'https://www.staples.com/hc/returns' },
  { match: ['office depot', 'officemax'], label: 'Office Depot', url: 'https://www.officedepot.com/cm/help/returns' },
  { match: ['wayfair'], label: 'Wayfair', url: 'https://www.wayfair.com/help/article/return_policy/6' },
  { match: ['nike'], label: 'Nike', url: 'https://www.nike.com/orders/return-policy' },
  { match: ['h&m', 'h & m'], label: 'H&M', url: 'https://www2.hm.com/en_us/customer-service/returns.html' },
  { match: ['zara'], label: 'Zara', url: 'https://www.zara.com/us/en/help-center/returns' },
  { match: ['old navy'], label: 'Old Navy', url: 'https://oldnavy.gap.com/customerService/info.do?cid=81346' },
  { match: ['gap'], label: 'Gap', url: 'https://www.gap.com/customerService/info.do?cid=81352' },
  { match: ['cvs'], label: 'CVS', url: 'https://www.cvs.com/help/help_subtopic_details.jsp?subtopicName=Returns' },
  { match: ['walgreens', 'walgreen'], label: 'Walgreens', url: 'https://www.walgreens.com/topic/help/returnpolicy.jsp' },
  { match: ['petco'], label: 'Petco', url: 'https://www.petco.com/shop/en/petcostore/content/return-policy' },
  { match: ['petsmart'], label: 'PetSmart', url: 'https://www.petsmart.com/help/return-policy-H000029.html' },
  { match: ['michaels'], label: 'Michaels', url: 'https://www.michaels.com/returns' },
  { match: ['target optical'], label: 'Target', url: 'https://www.target.com/returns' },
];

/**
 * Whole-word match so "macy" doesn't match inside "pharmacy". Mirrors the
 * matcher used by the policy knowledge base.
 */
function containsWord(haystack: string, fragment: string): boolean {
  const esc = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'i');
  return re.test(haystack);
}

/** A web search that reliably surfaces a store's returns page. */
export function returnSearchUrl(storeName: string): string {
  const q = `${storeName.trim()} start a return returns policy`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export interface ResolvedReturnPage {
  url: string;
  /** True when we matched a known retailer's actual returns page. */
  known: boolean;
  label: string;
}

/**
 * Resolve where to return something bought at `storeName`. Known stores link
 * straight to their returns page; everything else gets a scoped web search.
 */
export function resolveReturnPage(storeName: string): ResolvedReturnPage {
  const s = storeName.trim().toLowerCase();
  if (s.length >= 2) {
    for (const site of STORE_RETURN_SITES) {
      if (site.match.some((m) => containsWord(s, m))) {
        return { url: site.url, known: true, label: site.label };
      }
    }
  }
  return { url: returnSearchUrl(storeName), known: false, label: storeName.trim() };
}
