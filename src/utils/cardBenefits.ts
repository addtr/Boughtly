/**
 * Credit-card purchase benefits most people never claim. The big card
 * networks commonly offer, on eligible cards:
 *  - Extended warranty: doubles the manufacturer's warranty, adding up to
 *    one extra year (usually only on warranties of five years or less).
 *  - Return protection: refunds an item the store won't take back, typically
 *    within 90 days of purchase.
 * Exact terms vary by card, so everything here is framed as "may" and the
 * numbers are conservative estimates for display — Boughtly never schedules
 * reminders off them.
 */

import { PaymentMethod, TrackedItem } from '../types/item';
import { addDays, daysUntil } from './dates';

const CREDIT_NETWORKS: PaymentMethod[] = ['visa', 'mastercard', 'amex', 'discover'];

export function isCreditCard(method?: PaymentMethod): boolean {
  return !!method && CREDIT_NETWORKS.includes(method);
}

/** Human label for the network, for copy like "Your Visa may…". */
export function cardLabel(method?: PaymentMethod): string {
  switch (method) {
    case 'visa': return 'Visa';
    case 'mastercard': return 'Mastercard';
    case 'amex': return 'Amex';
    case 'discover': return 'Discover';
    default: return 'card';
  }
}

export interface CardWarrantyBoost {
  /** Extra coverage the card likely adds (≤ 1 year, mirrors the original) */
  extraDays: number;
  /** ISO date the boosted coverage would run to */
  effectiveEndDate: string;
}

/**
 * Estimated card-extended warranty. Null when it doesn't apply: not a credit
 * card, no manufacturer warranty to double, or a warranty too long for
 * typical card programs to extend.
 */
export function cardExtendedWarranty(
  item: Pick<TrackedItem, 'paymentMethod' | 'warrantyLengthDays' | 'warrantyExpirationDate'>
): CardWarrantyBoost | null {
  if (!isCreditCard(item.paymentMethod)) return null;
  if (item.warrantyLengthDays <= 0) return null;
  if (item.warrantyLengthDays > 5 * 365) return null;
  const extraDays = Math.min(item.warrantyLengthDays, 365);
  return {
    extraDays,
    effectiveEndDate: addDays(item.warrantyExpirationDate, extraDays),
  };
}

/** Card return-protection windows are commonly 90 days from purchase. */
export const CARD_RETURN_PROTECTION_DAYS = 90;

export interface CardReturnProtection {
  /** Days left in the typical 90-day card window */
  daysLeft: number;
}

/**
 * Relevant exactly when the store's own window has closed but the card's
 * typical 90-day return protection hasn't: the "store said no, card might
 * say yes" gap. Null otherwise.
 */
export function cardReturnProtection(
  item: Pick<TrackedItem, 'paymentMethod' | 'purchaseDate' | 'returnDeadlineDate'>
): CardReturnProtection | null {
  if (!isCreditCard(item.paymentMethod)) return null;
  if (daysUntil(item.returnDeadlineDate) >= 0) return null; // store window still open
  const protectionEnd = addDays(item.purchaseDate, CARD_RETURN_PROTECTION_DAYS);
  const daysLeft = daysUntil(protectionEnd);
  return daysLeft >= 0 ? { daysLeft } : null;
}
