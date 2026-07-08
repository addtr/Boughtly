/**
 * Spot a likely duplicate before it's saved — the same purchase scanned or
 * entered twice. We match on store + total + date (within a day) rather than
 * item name, since names vary but a receipt's store/total/date rarely do.
 */

import { TrackedItem } from '../types/item';
import { parseISODate } from './dates';

export interface DuplicateCandidate {
  storeName: string;
  price: number;
  purchaseDate: string;
}

function normalizeStore(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Same store if the strings match or one contains the other ("CVS" ⊂ "CVSPharmacy"). */
function storesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 3 && long.includes(short);
}

function daysApart(isoA: string, isoB: string): number {
  const a = parseISODate(isoA).getTime();
  const b = parseISODate(isoB).getTime();
  return Math.abs(Math.round((a - b) / 86400000));
}

/**
 * Returns an existing item that looks like the same purchase, or null.
 * Same store, total within a cent (or ~1%), and purchase date within a day.
 */
export function findDuplicateItem(
  candidate: DuplicateCandidate,
  items: TrackedItem[]
): TrackedItem | null {
  const store = normalizeStore(candidate.storeName);
  if (!store) return null;
  for (const it of items) {
    if (!storesMatch(store, normalizeStore(it.storeName))) continue;
    const priceClose = Math.abs(it.price - candidate.price) <= Math.max(0.01, candidate.price * 0.01);
    if (!priceClose) continue;
    if (daysApart(it.purchaseDate, candidate.purchaseDate) <= 1) return it;
  }
  return null;
}
