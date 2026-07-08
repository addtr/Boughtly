import { suggestPolicies } from './policyLookup';

/** Item input shape (mirrors NewItemInput without importing the store). */
export interface ReviewItemInput {
  itemName: string;
  storeName: string;
  price: number;
  purchaseDate: string;
  receiptImageUri: string | null;
  warrantyLengthDays: number;
  returnWindowDays: number;
  lineItems?: { name: string; price: number }[];
}

export interface ReviewRow {
  name: string;
  priceText: string;
}

export interface ReviewShared {
  storeName: string;
  purchaseDate: string;
  returnDays: number;
  receiptImageUri: string | null;
  /** Purchase name, e.g. "CVS Pharmacy purchase" */
  purchaseName: string;
  /** Total paid for the whole receipt */
  totalText: string;
}

export function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const v = Number(cleaned);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Sum of the parseable line-item prices. */
export function lineItemsSum(rows: ReviewRow[]): number {
  const sum = rows.reduce((acc, r) => acc + (parsePrice(r.priceText) ?? 0), 0);
  return Math.round(sum * 100) / 100;
}

/** A default purchase name from the store, e.g. "CVS Pharmacy purchase". */
export function defaultPurchaseName(storeName: string): string {
  const s = storeName.trim();
  return s ? `${s} purchase` : 'Receipt purchase';
}

/**
 * Warranty for the whole purchase. When every line item is the same known
 * category we use that category's real manufacturer warranty; otherwise the
 * warranty mirrors the return window (honest for a mixed basket).
 */
export function warrantyForPurchase(
  rows: ReviewRow[],
  store: string,
  returnDays: number
): number {
  const warranties = rows
    .map((r) => suggestPolicies(r.name, store, returnDays).warrantyDays)
    .filter((d): d is number => typeof d === 'number');
  // If all line items agree on a single warranty value, use it; else mirror.
  if (warranties.length > 0 && warranties.every((d) => d === warranties[0])) {
    return warranties[0];
  }
  return returnDays;
}

/**
 * Build ONE tracked-item input representing the whole receipt. `price` is the
 * total paid; `lineItems` is the breakdown the user sees on the detail screen.
 */
export function buildPurchaseItem(rows: ReviewRow[], shared: ReviewShared): ReviewItemInput {
  const cleanRows = rows
    .map((r) => ({ name: r.name.trim(), price: parsePrice(r.priceText) }))
    .filter((r): r is { name: string; price: number } => r.name.length > 0 && r.price !== null);

  const total = parsePrice(shared.totalText) ?? lineItemsSum(rows);

  return {
    itemName: shared.purchaseName.trim() || defaultPurchaseName(shared.storeName),
    storeName: shared.storeName.trim() || 'Unknown store',
    price: total,
    purchaseDate: shared.purchaseDate,
    receiptImageUri: shared.receiptImageUri,
    warrantyLengthDays: warrantyForPurchase(rows, shared.storeName, shared.returnDays),
    returnWindowDays: shared.returnDays,
    lineItems: cleanRows.length > 0 ? cleanRows : undefined,
  };
}
