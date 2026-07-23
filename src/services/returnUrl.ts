/**
 * Resolves a store name to where you start a return.
 *
 * LESSON LEARNED: hand-curated deep links rot — retailers reorganize their
 * sites and yesterday's /returns URL becomes a 404 (Costco did exactly this).
 * Policy: an entry only gets a direct `url` if it was LIVE-VERIFIED (HTTP 200
 * at that address — last pass 2026-07-10); everything else opens a returns
 * search PINNED TO THE STORE'S OWN SITE (site:costco.com), whose top result
 * is always their current returns page and can never 404. When re-verifying,
 * promote more entries by adding `url`; never add one unverified.
 */

interface StoreReturnSite {
  /** Lowercased fragments matched (whole-word) against the typed store name */
  match: string[];
  /** Friendly label for the button, e.g. "Target" */
  label: string;
  /** Official domain — the search is pinned to this site. */
  domain: string;
  /** Direct returns page — ONLY set when live-verified (see header). */
  url?: string;
}

/** A returns search scoped to one store's own site — always current, never 404s. */
function siteSearch(domain: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(
    `return policy start a return site:${domain}`
  )}`;
}

// Order matters: more specific fragments before general ones they contain
// (e.g. "nordstrom rack" before "nordstrom", "old navy" before "gap").
const STORE_RETURN_SITES: StoreReturnSite[] = [
  // ── Big box / general merchandise ──────────────────────────────────────
  { match: ['amazon'], label: 'Amazon', domain: 'amazon.com', url: 'https://www.amazon.com/returns' },
  { match: ['walmart'], label: 'Walmart', domain: 'walmart.com', url: 'https://www.walmart.com/returns' },
  { match: ['target'], label: 'Target', domain: 'target.com', url: 'https://www.target.com/returns' },
  { match: ['best buy', 'bestbuy'], label: 'Best Buy', domain: 'bestbuy.com' },
  { match: ['costco'], label: 'Costco', domain: 'costco.com' },
  { match: ["sam's club", 'sams club', 'samsclub'], label: "Sam's Club", domain: 'samsclub.com' },
  { match: ["bj's", 'bjs wholesale', 'bjs'], label: "BJ's", domain: 'bjs.com' },
  { match: ['dollar general'], label: 'Dollar General', domain: 'dollargeneral.com' },
  { match: ['dollar tree'], label: 'Dollar Tree', domain: 'dollartree.com' },
  { match: ['family dollar'], label: 'Family Dollar', domain: 'familydollar.com' },
  { match: ['five below'], label: 'Five Below', domain: 'fivebelow.com' },
  { match: ['big lots'], label: 'Big Lots', domain: 'biglots.com' },
  { match: ["ollie's", 'ollies bargain'], label: "Ollie's", domain: 'ollies.us' },
  { match: ['meijer'], label: 'Meijer', domain: 'meijer.com' },

  // ── Department stores ──────────────────────────────────────────────────
  { match: ['jcpenney', 'jc penney', 'penney'], label: 'JCPenney', domain: 'jcpenney.com', url: 'https://www.jcpenney.com/m/customer-service/returns' },
  { match: ["dillard's", 'dillards'], label: "Dillard's", domain: 'dillards.com' },
  { match: ['belk'], label: 'Belk', domain: 'belk.com' },
  { match: ["bloomingdale's", 'bloomingdales'], label: "Bloomingdale's", domain: 'bloomingdales.com' },
  { match: ['saks off', 'saks fifth', 'saks'], label: 'Saks', domain: 'saksfifthavenue.com' },
  { match: ['neiman marcus'], label: 'Neiman Marcus', domain: 'neimanmarcus.com' },
  { match: ['nordstrom rack'], label: 'Nordstrom Rack', domain: 'nordstromrack.com', url: 'https://www.nordstromrack.com/customer-service/ship-return-policy' },
  { match: ['nordstrom'], label: 'Nordstrom', domain: 'nordstrom.com', url: 'https://www.nordstrom.com/browse/services/return-policy' },
  { match: ["macy's", 'macys', 'macy'], label: "Macy's", domain: 'macys.com' },
  { match: ["kohl's", 'kohls'], label: "Kohl's", domain: 'kohls.com' },
  { match: ['ross dress', 'ross stores'], label: 'Ross', domain: 'rossstores.com' },
  { match: ['burlington'], label: 'Burlington', domain: 'burlington.com' },
  { match: ['von maur'], label: 'Von Maur', domain: 'vonmaur.com' },

  // ── Off-price / TJX ────────────────────────────────────────────────────
  { match: ['tj maxx', 'tjmaxx'], label: 'TJ Maxx', domain: 'tjmaxx.tjx.com' },
  { match: ['marshalls'], label: 'Marshalls', domain: 'marshalls.com' },
  { match: ['homegoods', 'home goods'], label: 'HomeGoods', domain: 'homegoods.com' },
  { match: ['homesense'], label: 'HomeSense', domain: 'homesense.com' },
  { match: ['sierra trading', 'sierra'], label: 'Sierra', domain: 'sierra.com' },

  // ── Electronics & tech ─────────────────────────────────────────────────
  { match: ['apple'], label: 'Apple', domain: 'apple.com', url: 'https://www.apple.com/shop/help/returns_refund' },
  { match: ['microsoft store', 'microsoft'], label: 'Microsoft', domain: 'microsoft.com' },
  { match: ['micro center', 'microcenter'], label: 'Micro Center', domain: 'microcenter.com' },
  { match: ['b&h photo', 'b & h', 'bhphoto'], label: 'B&H Photo', domain: 'bhphotovideo.com' },
  { match: ['newegg'], label: 'Newegg', domain: 'newegg.com', url: 'https://kb.newegg.com/knowledge-base/returning-an-item' },
  { match: ['gamestop'], label: 'GameStop', domain: 'gamestop.com' },
  { match: ['samsung'], label: 'Samsung', domain: 'samsung.com' },
  { match: ['dell'], label: 'Dell', domain: 'dell.com' },
  { match: ['hp store', 'hewlett'], label: 'HP', domain: 'hp.com' },
  { match: ['lenovo'], label: 'Lenovo', domain: 'lenovo.com' },
  { match: ['sony'], label: 'Sony', domain: 'sony.com' },
  { match: ['bose'], label: 'Bose', domain: 'bose.com' },
  { match: ['sonos'], label: 'Sonos', domain: 'sonos.com' },
  { match: ['anker', 'soundcore'], label: 'Anker', domain: 'anker.com' },
  { match: ['logitech'], label: 'Logitech', domain: 'logitech.com' },
  { match: ['gopro'], label: 'GoPro', domain: 'gopro.com' },
  { match: ['verizon'], label: 'Verizon', domain: 'verizon.com' },
  { match: ['at&t', 'att store'], label: 'AT&T', domain: 'att.com' },
  { match: ['t-mobile', 'tmobile'], label: 'T-Mobile', domain: 't-mobile.com' },

  // ── Home improvement / hardware / auto ─────────────────────────────────
  { match: ['home depot', 'homedepot'], label: 'The Home Depot', domain: 'homedepot.com', url: 'https://www.homedepot.com/c/Return_Policy' },
  { match: ["lowe's", 'lowes'], label: "Lowe's", domain: 'lowes.com' },
  { match: ['menards'], label: 'Menards', domain: 'menards.com' },
  { match: ['ace hardware'], label: 'Ace Hardware', domain: 'acehardware.com' },
  { match: ['true value'], label: 'True Value', domain: 'truevalue.com' },
  { match: ['harbor freight'], label: 'Harbor Freight', domain: 'harborfreight.com' },
  { match: ['northern tool'], label: 'Northern Tool', domain: 'northerntool.com' },
  { match: ['tractor supply'], label: 'Tractor Supply', domain: 'tractorsupply.com' },
  { match: ['autozone'], label: 'AutoZone', domain: 'autozone.com' },
  { match: ["o'reilly", 'oreilly auto'], label: "O'Reilly Auto Parts", domain: 'oreillyauto.com' },
  { match: ['advance auto'], label: 'Advance Auto Parts', domain: 'advanceautoparts.com' },
  { match: ['napa auto', 'napa'], label: 'NAPA', domain: 'napaonline.com' },
  { match: ['pep boys'], label: 'Pep Boys', domain: 'pepboys.com' },
  { match: ['discount tire'], label: 'Discount Tire', domain: 'discounttire.com' },

  // ── Furniture & home ───────────────────────────────────────────────────
  { match: ['ikea'], label: 'IKEA', domain: 'ikea.com', url: 'https://www.ikea.com/us/en/customer-service/returns-claims/' },
  { match: ['wayfair'], label: 'Wayfair', domain: 'wayfair.com', url: 'https://www.wayfair.com/help/article/return_policy' },
  { match: ['west elm'], label: 'West Elm', domain: 'westelm.com' },
  { match: ['pottery barn'], label: 'Pottery Barn', domain: 'potterybarn.com' },
  { match: ['williams sonoma', 'williams-sonoma'], label: 'Williams Sonoma', domain: 'williams-sonoma.com' },
  { match: ['crate & barrel', 'crate and barrel'], label: 'Crate & Barrel', domain: 'crateandbarrel.com' },
  { match: ['cb2'], label: 'CB2', domain: 'cb2.com' },
  { match: ['restoration hardware'], label: 'RH', domain: 'rh.com' },
  { match: ['room & board', 'room and board'], label: 'Room & Board', domain: 'roomandboard.com' },
  { match: ['ashley furniture', 'ashley homestore'], label: 'Ashley', domain: 'ashleyfurniture.com' },
  { match: ['la-z-boy', 'lazboy', 'la z boy'], label: 'La-Z-Boy', domain: 'la-z-boy.com' },
  { match: ["bob's discount", 'bobs discount'], label: "Bob's Discount Furniture", domain: 'mybobs.com' },
  { match: ['living spaces'], label: 'Living Spaces', domain: 'livingspaces.com' },
  { match: ['raymour', 'flanigan'], label: 'Raymour & Flanigan', domain: 'raymourflanigan.com' },
  { match: ['value city'], label: 'Value City Furniture', domain: 'valuecityfurniture.com' },
  { match: ['container store'], label: 'The Container Store', domain: 'containerstore.com' },
  { match: ['at home'], label: 'At Home', domain: 'athome.com' },
  { match: ['bed bath & beyond', 'bed bath and beyond', 'bed bath'], label: 'Bed Bath & Beyond', domain: 'bedbathandbeyond.com', url: 'https://help.bedbathandbeyond.com/help/s/article/Standard-Return-Policy' },
  { match: ['overstock'], label: 'Overstock', domain: 'overstock.com' },
  { match: ["kirkland's", 'kirklands'], label: "Kirkland's", domain: 'kirklands.com' },
  { match: ['world market'], label: 'World Market', domain: 'worldmarket.com' },
  { match: ['mattress firm'], label: 'Mattress Firm', domain: 'mattressfirm.com' },
  { match: ['casper'], label: 'Casper', domain: 'casper.com', url: 'https://casper.com/pages/returns' },
  { match: ['purple'], label: 'Purple', domain: 'purple.com', url: 'https://purple.com/returns' },
  { match: ['abt'], label: 'Abt', domain: 'abt.com' },
  { match: ['pc richard', 'p.c. richard'], label: 'P.C. Richard & Son', domain: 'pcrichard.com' },

  // ── Apparel & shoes ────────────────────────────────────────────────────
  { match: ['nike'], label: 'Nike', domain: 'nike.com', url: 'https://www.nike.com/help/a/returns-policy' },
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
  { match: ['free people'], label: 'Free People', domain: 'freepeople.com' },
  { match: ['j.crew', 'j crew', 'jcrew'], label: 'J.Crew', domain: 'jcrew.com' },
  { match: ['madewell'], label: 'Madewell', domain: 'madewell.com' },
  { match: ['express'], label: 'Express', domain: 'express.com' },
  { match: ["levi's", 'levis', 'levi strauss'], label: "Levi's", domain: 'levi.com' },
  { match: ["victoria's secret", 'victorias secret'], label: "Victoria's Secret", domain: 'victoriassecret.com' },
  { match: ['patagonia'], label: 'Patagonia', domain: 'patagonia.com' },
  { match: ['columbia'], label: 'Columbia', domain: 'columbia.com' },
  { match: ['north face'], label: 'The North Face', domain: 'thenorthface.com' },
  { match: ['carhartt'], label: 'Carhartt', domain: 'carhartt.com' },
  { match: ['dickies'], label: 'Dickies', domain: 'dickies.com' },
  { match: ['ll bean', 'l.l. bean', 'l.l.bean', 'llbean'], label: 'L.L.Bean', domain: 'llbean.com', url: 'https://www.llbean.com/llb/shop/510624' },
  { match: ["lands' end", 'lands end', 'landsend'], label: "Lands' End", domain: 'landsend.com' },
  { match: ['eddie bauer'], label: 'Eddie Bauer', domain: 'eddiebauer.com' },
  { match: ['duluth trading', 'duluth'], label: 'Duluth Trading', domain: 'duluthtrading.com' },
  { match: ['everlane'], label: 'Everlane', domain: 'everlane.com' },
  { match: ['bonobos'], label: 'Bonobos', domain: 'bonobos.com', url: 'https://bonobos.com/help/returns' },
  { match: ['pacsun', 'pac sun'], label: 'PacSun', domain: 'pacsun.com' },
  { match: ['hot topic'], label: 'Hot Topic', domain: 'hottopic.com' },
  { match: ['zumiez'], label: 'Zumiez', domain: 'zumiez.com', url: 'https://www.zumiez.com/return-policy' },
  { match: ['aeropostale'], label: 'Aeropostale', domain: 'aeropostale.com' },
  { match: ['torrid'], label: 'Torrid', domain: 'torrid.com' },
  { match: ['lane bryant'], label: 'Lane Bryant', domain: 'lanebryant.com' },
  { match: ['ann taylor'], label: 'Ann Taylor', domain: 'anntaylor.com' },
  { match: ['loft'], label: 'LOFT', domain: 'loft.com' },
  { match: ['talbots'], label: 'Talbots', domain: 'talbots.com' },
  { match: ["chico's", 'chicos'], label: "Chico's", domain: 'chicos.com' },
  { match: ["carter's", 'carters'], label: "Carter's", domain: 'carters.com' },
  { match: ["children's place", 'childrens place'], label: "The Children's Place", domain: 'childrensplace.com' },
  { match: ['shein'], label: 'SHEIN', domain: 'shein.com', url: 'https://us.shein.com/Return-Policy-a-281.html' },
  { match: ['asos'], label: 'ASOS', domain: 'asos.com' },

  // ── Shoes ──────────────────────────────────────────────────────────────
  { match: ['vans'], label: 'Vans', domain: 'vans.com' },
  { match: ['crocs'], label: 'Crocs', domain: 'crocs.com', url: 'https://www.crocs.com/customer-service/order-returns.html' },
  { match: ['converse'], label: 'Converse', domain: 'converse.com' },
  { match: ['skechers'], label: 'Skechers', domain: 'skechers.com' },
  { match: ['new balance'], label: 'New Balance', domain: 'newbalance.com' },
  { match: ['puma'], label: 'PUMA', domain: 'puma.com' },
  { match: ['reebok'], label: 'Reebok', domain: 'reebok.com' },
  { match: ['asics'], label: 'ASICS', domain: 'asics.com' },
  { match: ['brooks running', 'brooks'], label: 'Brooks', domain: 'brooksrunning.com' },
  { match: ['hoka'], label: 'HOKA', domain: 'hoka.com' },
  { match: ['on running', 'on cloud'], label: 'On', domain: 'on.com', url: 'https://www.on.com/en-us/services/returns' },
  { match: ['timberland'], label: 'Timberland', domain: 'timberland.com' },
  { match: ['ugg'], label: 'UGG', domain: 'ugg.com' },
  { match: ['birkenstock'], label: 'Birkenstock', domain: 'birkenstock.com' },
  { match: ['allbirds'], label: 'Allbirds', domain: 'allbirds.com' },
  { match: ['journeys'], label: 'Journeys', domain: 'journeys.com' },
  { match: ['famous footwear'], label: 'Famous Footwear', domain: 'famousfootwear.com' },
  { match: ['shoe carnival'], label: 'Shoe Carnival', domain: 'shoecarnival.com' },
  { match: ['foot locker', 'footlocker'], label: 'Foot Locker', domain: 'footlocker.com', url: 'https://help.footlocker.com/hc/en-us/articles/360034123454-What-s-the-policy-for-returns' },
  { match: ['dsw'], label: 'DSW', domain: 'dsw.com', url: 'https://www.dsw.com/content/return-and-exchange-policy' },
  { match: ['zappos'], label: 'Zappos', domain: 'zappos.com', url: 'https://www.zappos.com/c/shipping-and-returns' },

  // ── Beauty & health ────────────────────────────────────────────────────
  { match: ['sephora'], label: 'Sephora', domain: 'sephora.com' },
  { match: ['ulta'], label: 'Ulta', domain: 'ulta.com', url: 'https://www.ulta.com/guestservices/returns' },
  { match: ['bath & body', 'bath and body'], label: 'Bath & Body Works', domain: 'bathandbodyworks.com' },
  { match: ['glossier'], label: 'Glossier', domain: 'glossier.com' },
  { match: ['mac cosmetics'], label: 'MAC Cosmetics', domain: 'maccosmetics.com' },
  { match: ['fenty'], label: 'Fenty Beauty', domain: 'fentybeauty.com' },
  { match: ['cvs'], label: 'CVS', domain: 'cvs.com' },
  { match: ['walgreens', 'walgreen'], label: 'Walgreens', domain: 'walgreens.com', url: 'https://www.walgreens.com/topic/help/returnpolicy.jsp' },
  { match: ['rite aid', 'riteaid'], label: 'Rite Aid', domain: 'riteaid.com' },
  { match: ['gnc'], label: 'GNC', domain: 'gnc.com' },
  { match: ['vitamin shoppe'], label: 'The Vitamin Shoppe', domain: 'vitaminshoppe.com' },

  // ── Sporting goods & outdoor ───────────────────────────────────────────
  { match: ["dick's", 'dicks sporting', 'dicks'], label: "Dick's Sporting Goods", domain: 'dickssportinggoods.com' },
  { match: ['rei'], label: 'REI', domain: 'rei.com' },
  { match: ['academy sports', 'academy'], label: 'Academy Sports', domain: 'academy.com' },
  { match: ['bass pro'], label: 'Bass Pro Shops', domain: 'basspro.com' },
  { match: ["cabela's", 'cabelas'], label: "Cabela's", domain: 'cabelas.com' },
  { match: ['scheels'], label: 'Scheels', domain: 'scheels.com' },
  { match: ['big 5', 'big5'], label: 'Big 5 Sporting Goods', domain: 'big5sportinggoods.com' },
  { match: ['hibbett'], label: 'Hibbett Sports', domain: 'hibbett.com' },
  { match: ['golf galaxy'], label: 'Golf Galaxy', domain: 'golfgalaxy.com' },
  { match: ['orvis'], label: 'Orvis', domain: 'orvis.com' },

  // ── Office, books & music ──────────────────────────────────────────────
  { match: ['staples'], label: 'Staples', domain: 'staples.com', url: 'https://www.staples.com/stores/help/orders/returns' },
  { match: ['office depot', 'officemax'], label: 'Office Depot', domain: 'officedepot.com', url: 'https://help.officedepot.com/app/answers/detail/a_id/6847/~/return-policy' },
  { match: ['barnes & noble', 'barnes and noble', 'barnesandnoble'], label: 'Barnes & Noble', domain: 'barnesandnoble.com' },
  { match: ['books-a-million', 'books a million'], label: 'Books-A-Million', domain: 'booksamillion.com' },
  { match: ['guitar center'], label: 'Guitar Center', domain: 'guitarcenter.com', url: 'https://www.guitarcenter.com/pages/return-policy' },
  { match: ['sweetwater'], label: 'Sweetwater', domain: 'sweetwater.com' },

  // ── Craft, toys & hobby ────────────────────────────────────────────────
  { match: ['michaels'], label: 'Michaels', domain: 'michaels.com', url: 'https://www.michaels.com/returns' },
  { match: ['joann', "jo-ann", 'jo ann'], label: 'JOANN', domain: 'joann.com' },
  { match: ['hobby lobby'], label: 'Hobby Lobby', domain: 'hobbylobby.com' },
  { match: ['lego'], label: 'LEGO', domain: 'lego.com' },
  { match: ['build-a-bear', 'build a bear'], label: 'Build-A-Bear', domain: 'buildabear.com' },
  { match: ['american girl'], label: 'American Girl', domain: 'americangirl.com' },

  // ── Jewelry & accessories ──────────────────────────────────────────────
  { match: ['kay jewelers', 'kay'], label: 'Kay Jewelers', domain: 'kay.com' },
  { match: ['zales'], label: 'Zales', domain: 'zales.com' },
  { match: ['jared'], label: 'Jared', domain: 'jared.com' },
  { match: ['pandora'], label: 'Pandora', domain: 'pandora.net' },
  { match: ['tiffany'], label: 'Tiffany & Co.', domain: 'tiffany.com' },
  { match: ["claire's", 'claires'], label: "Claire's", domain: 'claires.com' },
  { match: ['away travel', 'awaytravel'], label: 'Away', domain: 'awaytravel.com' },
  { match: ['tumi'], label: 'TUMI', domain: 'tumi.com' },
  { match: ['samsonite'], label: 'Samsonite', domain: 'samsonite.com' },
  { match: ['yeti'], label: 'YETI', domain: 'yeti.com' },

  // ── Pets ───────────────────────────────────────────────────────────────
  { match: ['petco'], label: 'Petco', domain: 'petco.com' },
  { match: ['petsmart'], label: 'PetSmart', domain: 'petsmart.com' },
  { match: ['chewy'], label: 'Chewy', domain: 'chewy.com', url: 'https://www.chewy.com/app/content/return-policy' },

  // ── Grocery & pharmacy ─────────────────────────────────────────────────
  { match: ['kroger'], label: 'Kroger', domain: 'kroger.com' },
  { match: ['publix'], label: 'Publix', domain: 'publix.com' },
  { match: ['albertsons', 'safeway'], label: 'Albertsons', domain: 'albertsons.com' },
  { match: ['whole foods'], label: 'Whole Foods', domain: 'wholefoodsmarket.com' },
  { match: ['trader joe'], label: "Trader Joe's", domain: 'traderjoes.com' },
  { match: ['aldi'], label: 'ALDI', domain: 'aldi.us' },
  { match: ['h-e-b', 'heb'], label: 'H-E-B', domain: 'heb.com' },
  { match: ['wegmans'], label: 'Wegmans', domain: 'wegmans.com' },
  { match: ['sprouts'], label: 'Sprouts', domain: 'sprouts.com' },

  // ── Online marketplaces & resale ───────────────────────────────────────
  { match: ['ebay'], label: 'eBay', domain: 'ebay.com', url: 'https://www.ebay.com/help/buying/returns-refunds/returning-item?id=4041' },
  { match: ['etsy'], label: 'Etsy', domain: 'etsy.com' },
  { match: ['temu'], label: 'Temu', domain: 'temu.com' },
  { match: ['aliexpress'], label: 'AliExpress', domain: 'aliexpress.com' },
  { match: ['qvc'], label: 'QVC', domain: 'qvc.com' },
  { match: ['hsn'], label: 'HSN', domain: 'hsn.com', url: 'https://www.hsn.com/content/returns/lp-6023' },
  { match: ['poshmark'], label: 'Poshmark', domain: 'poshmark.com' },
  { match: ['mercari'], label: 'Mercari', domain: 'mercari.com' },
  { match: ['stockx'], label: 'StockX', domain: 'stockx.com' },
  { match: ['goat'], label: 'GOAT', domain: 'goat.com' },
  { match: ['thredup', 'thred up'], label: 'ThredUp', domain: 'thredup.com' },
  { match: ['depop'], label: 'Depop', domain: 'depop.com' },

  // ── Verified direct pages — batch 8 (2026-07-11) ──
  { match: ['boohoo'], label: 'Boohoo', domain: 'boohoo.com', url: 'https://us.boohoo.com/pages/informational/returns' },
  { match: ['iherb'], label: 'iHerb', domain: 'iherb.com', url: 'https://www.iherb.com/info/returns' },
  { match: ['blenders eyewear'], label: 'Blenders Eyewear', domain: 'blenderseyewear.com', url: 'https://www.blenderseyewear.com/pages/shipping-returns' },
  { match: ['tuft & needle'], label: 'Tuft & Needle', domain: 'tuftandneedle.com', url: 'https://www.tuftandneedle.com/pages/returns' },
  { match: ['brooklinen'], label: 'Brooklinen', domain: 'brooklinen.com', url: 'https://www.brooklinen.com/pages/returns' },
  { match: ['rothys'], label: 'Rothys', domain: 'rothys.com', url: 'https://rothys.com/pages/returns' },
  { match: ['outdoor voices'], label: 'Outdoor Voices', domain: 'outdoorvoices.com', url: 'https://www.outdoorvoices.com/pages/help-center-returns-exchanges' },
  { match: ['mack weldon'], label: 'Mack Weldon', domain: 'mackweldon.com', url: 'https://mackweldon.com/pages/returns' },
  { match: ['buck mason'], label: 'Buck Mason', domain: 'buckmason.com', url: 'https://www.buckmason.com/pages/faq' },
  { match: ['faherty'], label: 'Faherty', domain: 'fahertybrand.com', url: 'https://fahertybrand.com/pages/returns' },
  { match: ['marine layer'], label: 'Marine Layer', domain: 'marinelayer.com', url: 'https://www.marinelayer.com/pages/returns' },
  { match: ['cuts'], label: 'Cuts', domain: 'cutsclothing.com', url: 'https://www.cutsclothing.com/pages/returns' },
  { match: ['taylor stitch'], label: 'Taylor Stitch', domain: 'taylorstitch.com', url: 'https://www.taylorstitch.com/blogs/help-center/tagged/returns-exchanges' },
  { match: ['thirdlove'], label: 'ThirdLove', domain: 'thirdlove.com', url: 'https://www.thirdlove.com/pages/returns-center' },
  { match: ['skims'], label: 'Skims', domain: 'skims.com', url: 'https://skims.com/pages/returns' },
  { match: ['spanx'], label: 'Spanx', domain: 'spanx.com', url: 'https://spanx.com/pages/returns-policy-us' },
  { match: ['girlfriend collective'], label: 'Girlfriend Collective', domain: 'girlfriend.com', url: 'https://girlfriend.com/pages/returns' },
  { match: ['beis'], label: 'Beis', domain: 'beistravel.com', url: 'https://beistravel.com/pages/returns-exchanges' },
  { match: ['quince'], label: 'Quince', domain: 'quince.com', url: 'https://www.quince.com/shipping-returns' },
  { match: ['cotopaxi'], label: 'Cotopaxi', domain: 'cotopaxi.com', url: 'https://www.cotopaxi.com/pages/returns' },
  { match: ['greats'], label: 'Greats', domain: 'greats.com', url: 'https://www.greats.com/pages/returns' },
  { match: ['koio'], label: 'Koio', domain: 'koio.co', url: 'https://www.koio.co/pages/returns-and-exchanges' },
  { match: ['steve madden'], label: 'Steve Madden', domain: 'stevemadden.com', url: 'https://www.stevemadden.com/apps/returns-1' },
  { match: ['red wing'], label: 'Red Wing', domain: 'redwingshoes.com', url: 'https://www.redwingshoes.com/contact-us/returns.html' },

  // ── Verified direct pages — batch 9 (2026-07-11) ──
  { match: ['parachute'], label: 'Parachute', domain: 'parachutehome.com', url: 'https://parachutehome.com/pages/returns' },
  { match: ['boll & branch'], label: 'Boll & Branch', domain: 'bollandbranch.com', url: 'https://www.bollandbranch.com/pages/returns/' },
  { match: ['coyuchi'], label: 'Coyuchi', domain: 'coyuchi.com', url: 'https://www.coyuchi.com/pages/returns' },
  { match: ['our place'], label: 'Our Place', domain: 'fromourplace.com', url: 'https://fromourplace.com/pages/returns' },
  { match: ['made in'], label: 'Made In', domain: 'madeincookware.com', url: 'https://madeincookware.com/pages/made-in-cookware-returns-exchanges' },
  { match: ['interior define'], label: 'Interior Define', domain: 'interiordefine.com', url: 'https://www.interiordefine.com/returns' },
  { match: ['joybird'], label: 'Joybird', domain: 'joybird.com', url: 'https://joybird.com/returns/' },
  { match: ['sabai'], label: 'Sabai', domain: 'sabai.design', url: 'https://sabai.design/pages/returns' },
  { match: ['thuma'], label: 'Thuma', domain: 'thuma.co', url: 'https://www.thuma.co/pages/returns' },
  { match: ['leesa'], label: 'Leesa', domain: 'leesa.com', url: 'https://www.leesa.com/pages/trial-and-returns' },
  { match: ['cozy earth'], label: 'Cozy Earth', domain: 'cozyearth.com', url: 'https://cozyearth.com/pages/returns' },

  // ── Verified direct pages — batch 10 (2026-07-23) ──
  { match: ['article'], label: 'Article', domain: 'article.com', url: 'https://www.article.com/returns' },
  { match: ['avocado'], label: 'Avocado', domain: 'avocadogreenmattress.com', url: 'https://www.avocadogreenmattress.com/pages/returns' },
  { match: ['peloton'], label: 'Peloton', domain: 'onepeloton.com', url: 'https://www.onepeloton.com/returns' },

  // ── Added brands — site-pinned returns search (never 404s) — 2026-07-23 ──
  { match: ['warby parker', 'warby'], label: 'Warby Parker', domain: 'warbyparker.com' },
  { match: ['ruggable'], label: 'Ruggable', domain: 'ruggable.com' },
  { match: ['vuori'], label: 'Vuori', domain: 'vuoriclothing.com' },
  { match: ['gymshark'], label: 'Gymshark', domain: 'gymshark.com' },
  { match: ['alo yoga', 'alo'], label: 'Alo Yoga', domain: 'aloyoga.com' },
  { match: ['bombas'], label: 'Bombas', domain: 'bombas.com' },
  { match: ['ridge wallet', 'ridge'], label: 'Ridge', domain: 'ridge.com' },
  { match: ['stanley'], label: 'Stanley', domain: 'stanley1913.com' },
  { match: ['hydro flask', 'hydroflask'], label: 'Hydro Flask', domain: 'hydroflask.com' },
  { match: ['dyson'], label: 'Dyson', domain: 'dyson.com' },
  { match: ['caraway'], label: 'Caraway', domain: 'carawayhome.com' },
  { match: ['hexclad', 'hex clad'], label: 'HexClad', domain: 'hexclad.com' },
  { match: ['saatva'], label: 'Saatva', domain: 'saatva.com' },
  { match: ['helix sleep', 'helix'], label: 'Helix Sleep', domain: 'helixsleep.com' },
  { match: ['nectar sleep', 'nectar'], label: 'Nectar Sleep', domain: 'nectarsleep.com' },
  { match: ['lovesac'], label: 'Lovesac', domain: 'lovesac.com' },
  { match: ['burrow'], label: 'Burrow', domain: 'burrow.com' },
  { match: ['chubbies'], label: 'Chubbies', domain: 'chubbiesshorts.com' },
  { match: ['untuckit'], label: 'UNTUCKit', domain: 'untuckit.com' },
  { match: ['tommy john'], label: 'Tommy John', domain: 'tommyjohn.com' },
  { match: ['meundies', 'me undies'], label: 'MeUndies', domain: 'meundies.com' },
  { match: ['vineyard vines'], label: 'Vineyard Vines', domain: 'vineyardvines.com' },

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
 * Resolve where to return something bought at `storeName`. Known stores get a
 * returns search pinned to their own site; everything else a plain search.
 */
export function resolveReturnPage(storeName: string): ResolvedReturnPage {
  const s = storeName.trim().toLowerCase();
  if (s.length >= 2) {
    for (const site of STORE_RETURN_SITES) {
      if (site.match.some((m) => containsWord(s, m))) {
        return { url: site.url ?? siteSearch(site.domain), known: true, label: site.label };
      }
    }
  }
  return { url: returnSearchUrl(storeName), known: false, label: storeName.trim() };
}
