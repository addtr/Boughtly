/**
 * Yearly recap numbers, computed from tracked items and returns. Pure.
 */

import { TrackedItem } from '../types/item';
import { ReturnCase } from '../types/tracking';

export interface YearRecap {
  year: number;
  itemCount: number;
  protectedTotal: number;
  recovered: number;
  returnsCompleted: number;
  topStore: string | null;
  biggestName: string | null;
  biggestPrice: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeYearRecap(
  items: TrackedItem[],
  returns: ReturnCase[],
  year: number
): YearRecap {
  const yearItems = items.filter((i) => i.purchaseDate.startsWith(`${year}-`));
  const yearReturns = returns.filter(
    (r) => r.status === 'refunded' && r.updatedAt.startsWith(`${year}-`)
  );

  const storeTotals = new Map<string, number>();
  let biggest: TrackedItem | null = null;
  let protectedTotal = 0;
  for (const it of yearItems) {
    protectedTotal += it.price;
    const key = it.storeName.trim() || 'Unknown store';
    storeTotals.set(key, (storeTotals.get(key) ?? 0) + it.price);
    if (!biggest || it.price > biggest.price) biggest = it;
  }
  let topStore: string | null = null;
  let topTotal = 0;
  for (const [store, total] of storeTotals) {
    if (total > topTotal) {
      topStore = store;
      topTotal = total;
    }
  }

  return {
    year,
    itemCount: yearItems.length,
    protectedTotal: round2(protectedTotal),
    recovered: round2(yearReturns.reduce((s, r) => s + r.refundAmount, 0)),
    returnsCompleted: yearReturns.length,
    topStore,
    biggestName: biggest?.itemName ?? null,
    biggestPrice: biggest?.price ?? 0,
  };
}

/** Shareable text version of the recap. */
export function recapShareText(r: YearRecap, formatPrice: (n: number) => string): string {
  const lines = [
    `My ${r.year} with Boughtly 🧾`,
    `• Protected ${r.itemCount} purchase${r.itemCount === 1 ? '' : 's'} worth ${formatPrice(r.protectedTotal)}`,
  ];
  if (r.recovered > 0) {
    lines.push(
      `• Got ${formatPrice(r.recovered)} back across ${r.returnsCompleted} return${
        r.returnsCompleted === 1 ? '' : 's'
      }`
    );
  }
  if (r.topStore) lines.push(`• Shopped most at ${r.topStore}`);
  if (r.biggestName) {
    lines.push(`• Biggest buy: ${r.biggestName} (${formatPrice(r.biggestPrice)})`);
  }
  return lines.join('\n');
}
