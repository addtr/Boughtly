/**
 * Headline "your money" numbers, derived from tracked items and returns.
 * Pure and testable — no storage or RN imports.
 */

import { TrackedItem } from '../types/item';
import { ReturnCase } from '../types/tracking';
import { nearestDeadline } from './dates';

export interface Insights {
  itemCount: number;
  /** Total value of everything currently tracked */
  protectedValue: number;
  /** Items whose return window or warranty is still active */
  activeProtections: number;
  /** Money already refunded from completed returns */
  recovered: number;
  /** Money owed from returns still in progress */
  pending: number;
}

export function computeInsights(items: TrackedItem[], returns: ReturnCase[]): Insights {
  const protectedValue = items.reduce((sum, i) => sum + i.price, 0);
  const activeProtections = items.filter((i) => nearestDeadline(i).daysLeft >= 0).length;
  let recovered = 0;
  let pending = 0;
  for (const r of returns) {
    if (r.status === 'refunded') recovered += r.refundAmount;
    else pending += r.refundAmount;
  }
  return {
    itemCount: items.length,
    protectedValue: Math.round(protectedValue * 100) / 100,
    activeProtections,
    recovered: Math.round(recovered * 100) / 100,
    pending: Math.round(pending * 100) / 100,
  };
}
