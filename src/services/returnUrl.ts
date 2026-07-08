/**
 * Resolves a store name to the web page where you actually start a return.
 *
 * ~100 major US retailers are preloaded. Each entry has either a direct
 * `url` (a stable returns page we're confident about) or a `domain` — for
 * which we build a site-scoped returns search that reliably lands on that
 * store's returns page without risking a dead link. Anything we don't
 * recognize falls back to a plain returns search, so typing any store name
 * always takes you somewhere useful.
 */

interface StoreReturnSite {
  /** Lowercased fragments matched against the typed store name */
  match: string[];
  /** Friendly label for the button, e.g. "Target" */
  label: string;
  /** A stable, known returns page. Preferred when present. */
  url?: string;
  /** Official domain — used to build a site-scoped returns search. */
  domain?: string;
}

/** A returns search scoped to one store's own site — reliable, never 404s. */
function siteSearch(domain: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`return policy start a return site:${domain}`)}`;
}

// Order matters: put more specific fragments before the general ones they
// contain (e.g. "nordstrom rack" before "nordstrom", "old navy" before "gap").
const STORE_RETURN_SITES: StoreReturnSite[] = [
  // ── Big box / general merchandise ──────────────────────────────────────
  { match: ['amazon'], label: 'Amazon', url: 'https://www.amazon.com/returns' },
  { match: ['walmart'], label: 'Walmart', url: 'https://www.walmart.com/returns' },
  { match: ['target optical'], label: 'Target', url: 'https://www.target.com/returns' },
  { match: ['target'], label: 'Target', url: 'https://www.target.com/returns' },
  { match: ['best buy', 'bestbuy'], label: 'Best Buy', url: 'https://www.bestbuy.com/returns' },
  { match: ['costco'], label: 'Costco', url: 'https://www.costco.com/returns-and-exchanges.html' },
  { match: ["sam's club", 'sams club', 'samsclub'], label: "Sam's Club", domain: 'samsclub.com' },
  { match: ["bj's", 'bjs wholesale', 'bjs'], label: "BJ's", domain: 'bjs.com' },
  { match: ['dollar general'], label: 'Dollar General', domain: 'dollargeneral.com' },
  { match: ['dollar tree'], label: 'Dollar Tree', domain: 'dollartree.com' },
  { match: ['family dollar'], label: 'Family Dollar', domain: 'familydollar.com' },
  { match: ['five below'], label: 'Five Below', domain: 'fivebelow.com' },
  { match: ['big lots'], label: 'Big Lots', domain: 'biglots.com' },
  { match: ["ollie's", 'ollies bargain'], label: "Ollie's", domain: 'ollies.us' },

  // ── Department stores ──────────────────────────────────────────────────
  { match: ['jcpenney', 'jc penney', 'penney'], label: 'JCPenney', domain: 'jcpenney.com' },
  { match: ["dillard's", 'dillards'], label: "Dillard's", domain: 'dillards.com' },
  { match: ['belk'], label: 'Belk', domain: 'belk.com' },
  { match: ["bloomingdale's", 'bloomingdales'], label: "Bloomingdale's", url: 'https://www.bloomingdales.com/customer-service/returns' },
  { match: ['saks off', 'saks fifth', 'saks'], label: 'Saks', domain: 'saksfifthavenue.com' },
  { match: ['neiman marcus'], label: 'Neiman Marcus', domain: 'neimanmarcus.com' },
  { match: ['nordstrom rack'], label: 'Nordstrom Rack', domain: 'nordstromrack.com' },
  { match: ['nordstrom'], label: 'Nordstrom', url: 'https://www.nordstrom.com/browse/customer-service/returns' },
  { match: ["macy's", 'macy'], label: "Macy's", url: 'https://www.macys.com/service/returns/' },
  { match: ["kohl's", 'kohls'], label: "Kohl's", domain: 'kohls.com' },
  { match: ['ross dress', 'ross stores'], label: 'Ross', domain: 'rossstores.com' },
  { match: ['burlington'], label: 'Burlington', domain: 'burlington.com' },

  // ── Off-price / TJX ────────────────────────────────────────────────────
  { match: ['tj maxx', 'tjmaxx'], label: 'TJ Maxx', url: 'https://www.tjmaxx.tjx.com/store/jump/topic/return-policy/2600006' },
  { match: ['marshalls'], label: 'Marshalls', domain: 'marshalls.com' },
  { match: ['homegoods', 'home goods'], label: 'HomeGoods', domain: 'homegoods.com' },
  { match: ['sierra trading', 'sierra'], label: 'Sierra', domain: 'sierra.com' },

  // ── Electronics & tech ─────────────────────────────────────────────────
  { match: ['apple'], label: 'Apple', url: 'https://www.apple.com/shop/help/returns_refund' },
  { match: ['microsoft store', 'microsoft'], label: 'Microsoft', domain: 'microsoft.com' },
  { match: ['micro center', 'microcenter'], label: 'Micro Center', domain: 'microcenter.com' },
  { match: ['b&h photo', 'b & h', 'bhphoto'], label: 'B&H Photo', domain: 'bhphotovideo.com' },
  { match: ['newegg'], label: 'Newegg', domain: 'newegg.com' },
  { match: ['gamestop'], label: 'GameStop', url: 'https://www.gamestop.com/returns' },
  { match: ['samsung'], label: 'Samsung', domain: 'samsung.com' },
  { match: ['dell'], label: 'Dell', domain: 'dell.com' },
  { match: ['hp store', 'hewlett'], label: 'HP', domain: 'hp.com' },
  { match: ['lenovo'], label: 'Lenovo', domain: 'lenovo.com' },
  { match: ['sony'], label: 'Sony', domain: 'sony.com' },

  // ── Home improvement / hardware / auto ─────────────────────────────────
  { match: ['home depot', 'homedepot'], label: 'The Home Depot', url: 'https://www.homedepot.com/c/Return_Policy' },
  { match: ["lowe's", 'lowes'], label: "Lowe's", url: 'https://www.lowes.com/l/help/returns-policy' },
  { match: ['menards'], label: 'Menards', domain: 'menards.com' },
  { match: ['ace hardware'], label: 'Ace Hardware', domain: 'acehardware.com' },
  { match: ['harbor freight'], label: 'Harbor Freight', domain: 'harborfreight.com' },
  { match: ['tractor supply'], label: 'Tractor Supply', domain: 'tractorsupply.com' },
  { match: ['autozone'], label: 'AutoZone', domain: 'autozone.com' },
  { match: ["o'reilly", 'oreilly auto'], label: "O'Reilly Auto Parts", domain: 'oreillyauto.com' },
  { match: ['advance auto'], label: 'Advance Auto Parts', domain: 'advanceautoparts.com' },
  { match: ['napa auto', 'napa'], label: 'NAPA', domain: 'napaonline.com' },
  { match: ['pep boys'], label: 'Pep Boys', domain: 'pepboys.com' },

  // ── Furniture & home ───────────────────────────────────────────────────
  { match: ['ikea'], label: 'IKEA', url: 'https://www.ikea.com/us/en/customer-service/returns-claims/' },
  { match: ['wayfair'], label: 'Wayfair', url: 'https://www.wayfair.com/help/article/return_policy/6' },
  { match: ['west elm'], label: 'West Elm', domain: 'westelm.com' },
  { match: ['pottery barn'], label: 'Pottery Barn', domain: 'potterybarn.com' },
  { match: ['williams sonoma', 'williams-sonoma'], label: 'Williams Sonoma', domain: 'williams-sonoma.com' },
  { match: ['crate & barrel', 'crate and barrel'], label: 'Crate & Barrel', url: 'https://www.crateandbarrel.com/returns' },
  { match: ['cb2'], label: 'CB2', domain: 'cb2.com' },
  { match: ['ashley furniture', 'ashley homestore'], label: 'Ashley', domain: 'ashleyfurniture.com' },
  { match: ['container store'], label: 'The Container Store', domain: 'containerstore.com' },
  { match: ['at home'], label: 'At Home', domain: 'athome.com' },
  { match: ['bed bath & beyond', 'bed bath and beyond', 'bed bath'], label: 'Bed Bath & Beyond', domain: 'bedbathandbeyond.com' },
  { match: ['overstock', 'beyond'], label: 'Overstock', domain: 'overstock.com' },
  { match: ['mattress firm'], label: 'Mattress Firm', domain: 'mattressfirm.com' },
  { match: ['casper'], label: 'Casper', domain: 'casper.com' },
  { match: ['purple'], label: 'Purple', domain: 'purple.com' },

  // ── Apparel & shoes ────────────────────────────────────────────────────
  { match: ['nike'], label: 'Nike', url: 'https://www.nike.com/orders/return-policy' },
  { match: ['adidas'], label: 'adidas', domain: 'adidas.com' },
  { match: ['under armour'], label: 'Under Armour', domain: 'underarmour.com' },
  { match: ['lululemon'], label: 'lululemon', domain: 'lululemon.com' },
  { match: ['old navy'], label: 'Old Navy', domain: 'oldnavy.gap.com' },
  { match: ['banana republic'], label: 'Banana Republic', domain: 'bananarepublic.gap.com' },
  { match: ['athleta'], label: 'Athleta', domain: 'athleta.gap.com' },
  { match: ['gap'], label: 'Gap', domain: 'gap.com' },
  { match: ['h&m', 'h & m'], label: 'H&M', domain: 'hm.com' },
  { match: ['zara'], label: 'Zara', domain: 'zara.com' },
  { match: ['uniqlo'], label: 'Uniqlo', domain: 'uniqlo.com' },
  { match: ['forever 21', 'forever21'], label: 'Forever 21', domain: 'forever21.com' },
  { match: ['american eagle', 'aerie'], label: 'American Eagle', domain: 'ae.com' },
  { match: ['abercrombie'], label: 'Abercrombie & Fitch', domain: 'abercrombie.com' },
  { match: ['hollister'], label: 'Hollister', domain: 'hollisterco.com' },
  { match: ['urban outfitters'], label: 'Urban Outfitters', domain: 'urbanoutfitters.com' },
  { match: ['anthropologie'], label: 'Anthropologie', domain: 'anthropologie.com' },
  { match: ['j.crew', 'j crew', 'jcrew'], label: 'J.Crew', domain: 'jcrew.com' },
  { match: ['madewell'], label: 'Madewell', domain: 'madewell.com' },
  { match: ['express'], label: 'Express', domain: 'express.com' },
  { match: ["levi's", 'levis', 'levi strauss'], label: "Levi's", domain: 'levi.com' },
  { match: ["victoria's secret", 'victorias secret'], label: "Victoria's Secret", domain: 'victoriassecret.com' },
  { match: ['patagonia'], label: 'Patagonia', url: 'https://www.patagonia.com/returns.html' },
  { match: ['columbia'], label: 'Columbia', domain: 'columbia.com' },
  { match: ['north face'], label: 'The North Face', domain: 'thenorthface.com' },
  { match: ['vans'], label: 'Vans', domain: 'vans.com' },
  { match: ['crocs'], label: 'Crocs', domain: 'crocs.com' },
  { match: ['foot locker', 'footlocker'], label: 'Foot Locker', domain: 'footlocker.com' },
  { match: ['dsw'], label: 'DSW', domain: 'dsw.com' },
  { match: ['zappos'], label: 'Zappos', domain: 'zappos.com' },
  { match: ['shein'], label: 'SHEIN', domain: 'shein.com' },
  { match: ['asos'], label: 'ASOS', domain: 'asos.com' },

  // ── Beauty & health ────────────────────────────────────────────────────
  { match: ['sephora'], label: 'Sephora', url: 'https://www.sephora.com/beauty/returns-exchanges' },
  { match: ['ulta'], label: 'Ulta', url: 'https://www.ulta.com/company/return-policy' },
  { match: ['bath & body', 'bath and body'], label: 'Bath & Body Works', domain: 'bathandbodyworks.com' },
  { match: ['cvs'], label: 'CVS', domain: 'cvs.com' },
  { match: ['walgreens', 'walgreen'], label: 'Walgreens', domain: 'walgreens.com' },
  { match: ['rite aid', 'riteaid'], label: 'Rite Aid', domain: 'riteaid.com' },
  { match: ['gnc'], label: 'GNC', domain: 'gnc.com' },
  { match: ['vitamin shoppe'], label: 'The Vitamin Shoppe', domain: 'vitaminshoppe.com' },

  // ── Sporting goods & outdoor ───────────────────────────────────────────
  { match: ["dick's", 'dicks sporting'], label: "Dick's Sporting Goods", domain: 'dickssportinggoods.com' },
  { match: ['rei'], label: 'REI', url: 'https://www.rei.com/help/returns' },
  { match: ['academy sports', 'academy'], label: 'Academy Sports', domain: 'academy.com' },
  { match: ['bass pro'], label: 'Bass Pro Shops', domain: 'basspro.com' },
  { match: ["cabela's", 'cabelas'], label: "Cabela's", domain: 'cabelas.com' },

  // ── Office & books ─────────────────────────────────────────────────────
  { match: ['staples'], label: 'Staples', domain: 'staples.com' },
  { match: ['office depot', 'officemax'], label: 'Office Depot', domain: 'officedepot.com' },
  { match: ['barnes & noble', 'barnes and noble', 'barnesandnoble'], label: 'Barnes & Noble', domain: 'barnesandnoble.com' },
  { match: ['books-a-million', 'books a million'], label: 'Books-A-Million', domain: 'booksamillion.com' },

  // ── Craft, toys & hobby ────────────────────────────────────────────────
  { match: ['michaels'], label: 'Michaels', url: 'https://www.michaels.com/returns' },
  { match: ['joann', "jo-ann", 'jo ann'], label: 'JOANN', domain: 'joann.com' },
  { match: ['hobby lobby'], label: 'Hobby Lobby', domain: 'hobbylobby.com' },
  { match: ['lego'], label: 'LEGO', domain: 'lego.com' },
  { match: ['build-a-bear', 'build a bear'], label: 'Build-A-Bear', domain: 'buildabear.com' },

  // ── Pets ───────────────────────────────────────────────────────────────
  { match: ['petco'], label: 'Petco', domain: 'petco.com' },
  { match: ['petsmart'], label: 'PetSmart', domain: 'petsmart.com' },
  { match: ['chewy'], label: 'Chewy', domain: 'chewy.com' },

  // ── Grocery & pharmacy ─────────────────────────────────────────────────
  { match: ['kroger'], label: 'Kroger', domain: 'kroger.com' },
  { match: ['publix'], label: 'Publix', domain: 'publix.com' },
  { match: ['albertsons', 'safeway'], label: 'Albertsons', domain: 'albertsons.com' },
  { match: ['whole foods'], label: 'Whole Foods', domain: 'wholefoodsmarket.com' },
  { match: ['trader joe'], label: "Trader Joe's", domain: 'traderjoes.com' },
  { match: ['aldi'], label: 'ALDI', domain: 'aldi.us' },

  // ── Online marketplaces ────────────────────────────────────────────────
  { match: ['ebay'], label: 'eBay', domain: 'ebay.com' },
  { match: ['etsy'], label: 'Etsy', domain: 'etsy.com' },
  { match: ['temu'], label: 'Temu', domain: 'temu.com' },
  { match: ['qvc'], label: 'QVC', domain: 'qvc.com' },
  { match: ['hsn'], label: 'HSN', domain: 'hsn.com' },
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
  /** True when we matched a known retailer. */
  known: boolean;
  label: string;
}

/**
 * Resolve where to return something bought at `storeName`. Known stores link
 * straight to their returns page (or a site-scoped returns search); everything
 * else gets a plain returns search.
 */
export function resolveReturnPage(storeName: string): ResolvedReturnPage {
  const s = storeName.trim().toLowerCase();
  if (s.length >= 2) {
    for (const site of STORE_RETURN_SITES) {
      if (site.match.some((m) => containsWord(s, m))) {
        return {
          url: site.url ?? siteSearch(site.domain!),
          known: true,
          label: site.label,
        };
      }
    }
  }
  return { url: returnSearchUrl(storeName), known: false, label: storeName.trim() };
}
