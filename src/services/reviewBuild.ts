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
}

export interface ReviewRow {
  name: string;
  priceText: string;
  selected: boolean;
}

export interface ReviewShared {
  storeName: string;
  purchaseDate: string;
  returnDays: number;
  receiptImageUri: string | null;
}

export function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const v = Number(cleaned);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Warranty an item gets: a real manufacturer warranty when we recognize the
 * product category, otherwise it mirrors the shared return window.
 */
export function warrantyForItem(name: string, store: string, returnDays: number): number {
  const pol = suggestPolicies(name, store, returnDays);
  return pol.warrantyDays ?? returnDays;
}

/** Build the tracked-item inputs from the reviewed rows. Pure + testable. */
export function buildScanItems(rows: ReviewRow[], shared: ReviewShared): ReviewItemInput[] {
  return rows
    .filter((r) => r.selected)
    .map((r) => ({
      itemName: r.name.trim(),
      storeName: shared.storeName.trim() || 'Unknown store',
      price: parsePrice(r.priceText) ?? 0,
      purchaseDate: shared.purchaseDate,
      receiptImageUri: shared.receiptImageUri,
      warrantyLengthDays: warrantyForItem(r.name, shared.storeName, shared.returnDays),
      returnWindowDays: shared.returnDays,
    }));
}
