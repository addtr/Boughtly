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
  { match: ['costco'], label: 'Costco', domain: 'costco.com', url: 'https://customerservice.costco.com/app/answers/answer_view/a_id/1191' },
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
  { match: ['newegg'], label: 'Newegg', domain: 'newegg.com' },
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
  { match: ['casper'], label: 'Casper', domain: 'casper.com' },
  { match: ['purple'], label: 'Purple', domain: 'purple.com' },
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
  { match: ['patagonia'], label: 'Patagonia', domain: 'patagonia.com', url: 'https://www.patagonia.com/returns.html' },
  { match: ['columbia'], label: 'Columbia', domain: 'columbia.com' },
  { match: ['north face'], label: 'The North Face', domain: 'thenorthface.com' },
  { match: ['carhartt'], label: 'Carhartt', domain: 'carhartt.com' },
  { match: ['dickies'], label: 'Dickies', domain: 'dickies.com' },
  { match: ['ll bean', 'l.l. bean', 'l.l.bean', 'llbean'], label: 'L.L.Bean', domain: 'llbean.com', url: 'https://www.llbean.com/llb/shop/510624' },
  { match: ["lands' end", 'lands end', 'landsend'], label: "Lands' End", domain: 'landsend.com' },
  { match: ['eddie bauer'], label: 'Eddie Bauer', domain: 'eddiebauer.com' },
  { match: ['duluth trading', 'duluth'], label: 'Duluth Trading', domain: 'duluthtrading.com' },
  { match: ['everlane'], label: 'Everlane', domain: 'everlane.com' },
  { match: ['bonobos'], label: 'Bonobos', domain: 'bonobos.com' },
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
  { match: ['shein'], label: 'SHEIN', domain: 'shein.com' },
  { match: ['asos'], label: 'ASOS', domain: 'asos.com' },

  // ── Shoes ──────────────────────────────────────────────────────────────
  { match: ['vans'], label: 'Vans', domain: 'vans.com' },
  { match: ['crocs'], label: 'Crocs', domain: 'crocs.com' },
  { match: ['converse'], label: 'Converse', domain: 'converse.com' },
  { match: ['skechers'], label: 'Skechers', domain: 'skechers.com' },
  { match: ['new balance'], label: 'New Balance', domain: 'newbalance.com' },
  { match: ['puma'], label: 'PUMA', domain: 'puma.com' },
  { match: ['reebok'], label: 'Reebok', domain: 'reebok.com' },
  { match: ['asics'], label: 'ASICS', domain: 'asics.com' },
  { match: ['brooks running', 'brooks'], label: 'Brooks', domain: 'brooksrunning.com' },
  { match: ['hoka'], label: 'HOKA', domain: 'hoka.com' },
  { match: ['on running', 'on cloud'], label: 'On', domain: 'on.com' },
  { match: ['timberland'], label: 'Timberland', domain: 'timberland.com' },
  { match: ['ugg'], label: 'UGG', domain: 'ugg.com' },
  { match: ['birkenstock'], label: 'Birkenstock', domain: 'birkenstock.com' },
  { match: ['allbirds'], label: 'Allbirds', domain: 'allbirds.com' },
  { match: ['journeys'], label: 'Journeys', domain: 'journeys.com' },
  { match: ['famous footwear'], label: 'Famous Footwear', domain: 'famousfootwear.com' },
  { match: ['shoe carnival'], label: 'Shoe Carnival', domain: 'shoecarnival.com' },
  { match: ['foot locker', 'footlocker'], label: 'Foot Locker', domain: 'footlocker.com' },
  { match: ['dsw'], label: 'DSW', domain: 'dsw.com' },
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
  { match: ['staples'], label: 'Staples', domain: 'staples.com' },
  { match: ['office depot', 'officemax'], label: 'Office Depot', domain: 'officedepot.com' },
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
