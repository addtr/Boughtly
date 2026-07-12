/** Phase 2 models: price watching and return cases. Dates are ISO strings. */

import { ReceiptLineItem } from './item';

export interface PricePoint {
  /** ISO date "YYYY-MM-DD" */
  date: string;
  price: number;
  /** The "original" price the store claims when this was seen on sale */
  claimedOriginal?: number;
  store?: string;
}

export interface WatchedProduct {
  id: string;
  name: string;
  store: string;
  /** Product page, so it's one tap to go check the price */
  url?: string;
  /** Price the user would be happy to buy at */
  targetPrice?: number;
  /** Every price the user has logged, oldest first */
  priceLog: PricePoint[];
  createdAt: string;
}

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export const BILLING_CYCLE_OPTIONS: { key: BillingCycle; label: string; days: number }[] = [
  { key: 'weekly', label: 'Weekly', days: 7 },
  { key: 'monthly', label: 'Monthly', days: 30 },
  { key: 'quarterly', label: 'Every 3 months', days: 91 },
  { key: 'yearly', label: 'Yearly', days: 365 },
];

/** A recurring subscription the user wants to keep an eye on / cancel. */
export interface Subscription {
  id: string;
  name: string;
  /** Amount charged each cycle */
  cost: number;
  cycle: BillingCycle;
  /** ISO date of the next charge */
  nextRenewalDate: string;
  /** Optional label, e.g. "streaming", "gym" */
  category?: string;
  notes?: string;
  /** Scheduled renewal-reminder ids, so they can be cancelled */
  notificationIds: string[];
  createdAt: string;
}

/** Normalize any cycle's cost to a monthly figure for totals. */
export function monthlyCost(sub: Pick<Subscription, 'cost' | 'cycle'>): number {
  switch (sub.cycle) {
    case 'weekly':
      return (sub.cost * 52) / 12;
    case 'monthly':
      return sub.cost;
    case 'quarterly':
      return sub.cost / 3;
    case 'yearly':
      return sub.cost / 12;
  }
}

export type ReturnStatus = 'started' | 'sent' | 'refund_pending' | 'refunded';

export const RETURN_STEPS: { key: ReturnStatus; label: string; help: string }[] = [
  { key: 'started', label: 'Return started', help: 'You decided to send it back.' },
  { key: 'sent', label: 'Given back', help: 'Dropped off in store or shipped.' },
  { key: 'refund_pending', label: 'Refund pending', help: 'Waiting on the money.' },
  { key: 'refunded', label: 'Refunded', help: 'Money is back in your account.' },
];

export interface ReturnCase {
  id: string;
  /** The tracked item this return belongs to */
  itemId: string;
  itemName: string;
  storeName: string;
  refundAmount: number;
  /**
   * The specific line items being returned (partial return). Absent means the
   * whole purchase is going back.
   */
  returnedItems?: ReceiptLineItem[];
  method: 'in_store' | 'mail' | null;
  trackingNumber?: string;
  notes?: string;
  status: ReturnStatus;
  startedAt: string;
  updatedAt: string;
  /** Follow-up reminder ids so they can be cancelled */
  notificationIds: string[];
}
