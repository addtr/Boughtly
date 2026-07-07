/** Phase 2 models: price watching and return cases. Dates are ISO strings. */

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
  method: 'in_store' | 'mail' | null;
  trackingNumber?: string;
  notes?: string;
  status: ReturnStatus;
  startedAt: string;
  updatedAt: string;
  /** Follow-up reminder ids so they can be cancelled */
  notificationIds: string[];
}
