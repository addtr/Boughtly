/**
 * Spending breakdowns for the Insights screen. Pure and testable.
 */

import { TrackedItem } from '../types/item';
import { parseISODate } from './dates';

export interface MonthSpend {
  /** "Jul" style label */
  label: string;
  total: number;
}

export interface NamedSpend {
  name: string;
  total: number;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Spend per calendar month for the last `months` months (oldest first). */
export function monthlySpend(items: TrackedItem[], months = 6, now = new Date()): MonthSpend[] {
  const buckets: MonthSpend[] = [];
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${d.getMonth()}`);
    buckets.push({ label: MONTH_LABELS[d.getMonth()], total: 0 });
  }
  for (const item of items) {
    const d = parseISODate(item.purchaseDate);
    const idx = keys.indexOf(`${d.getFullYear()}-${d.getMonth()}`);
    if (idx >= 0) buckets[idx].total = round2(buckets[idx].total + item.price);
  }
  return buckets;
}

/** Total spend per store, biggest first. */
export function spendByStore(items: TrackedItem[], top = 5): NamedSpend[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = item.storeName.trim() || 'Unknown store';
    map.set(key, (map.get(key) ?? 0) + item.price);
  }
  return [...map.entries()]
    .map(([name, total]) => ({ name, total: round2(total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, top);
}

/** Total spend per tag, biggest first (untagged items excluded). */
export function spendByTag(items: TrackedItem[], top = 6): NamedSpend[] {
  const map = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.tags ?? []) {
      map.set(tag, (map.get(tag) ?? 0) + item.price);
    }
  }
  return [...map.entries()]
    .map(([name, total]) => ({ name, total: round2(total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, top);
}
