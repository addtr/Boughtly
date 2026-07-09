/**
 * Barcode → product name lookup, plus a tiny handoff slot so the scan screen
 * can pass its result back to the add-item form without non-serializable
 * navigation params.
 *
 * Lookup order: UPCitemdb's free trial endpoint (broad retail coverage,
 * ~100 lookups/day), then Open Food Facts (great for groceries). Both are
 * keyless. If neither knows the code, we return null and the user just types
 * the name like before.
 */

interface BarcodeProduct {
  name: string;
  brand?: string;
}

async function fetchJson(url: string, ms = 6000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function lookupUpcItemDb(code: string): Promise<BarcodeProduct | null> {
  const data = await fetchJson(
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`
  );
  const item = data?.items?.[0];
  if (!item?.title) return null;
  return { name: String(item.title), brand: item.brand ? String(item.brand) : undefined };
}

async function lookupOpenFoodFacts(code: string): Promise<BarcodeProduct | null> {
  const data = await fetchJson(
    `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`
  );
  const p = data?.product;
  const name = p?.product_name || p?.generic_name;
  if (!name) return null;
  return { name: String(name), brand: p?.brands ? String(p.brands).split(',')[0] : undefined };
}

/** Human-friendly product name for a barcode, or null if nobody knows it. */
export async function lookupBarcode(code: string): Promise<string | null> {
  const product = (await lookupUpcItemDb(code)) ?? (await lookupOpenFoodFacts(code));
  if (!product) return null;
  // Prepend the brand when the title doesn't already include it.
  if (product.brand && !product.name.toLowerCase().includes(product.brand.toLowerCase())) {
    return `${product.brand} ${product.name}`;
  }
  return product.name;
}

/* ---- result handoff between BarcodeScan and AddItem ---- */

let pendingItemName: string | null = null;

export function setPendingBarcodeItemName(name: string): void {
  pendingItemName = name;
}

export function consumePendingBarcodeItemName(): string | null {
  const v = pendingItemName;
  pendingItemName = null;
  return v;
}
