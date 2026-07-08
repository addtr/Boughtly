/** One product line within a purchase. */
export interface ReceiptLineItem {
  name: string;
  price: number;
}

/** A purchase the user is protecting. Dates are ISO 8601 strings (date-only semantics). */
export interface TrackedItem {
  id: string;
  itemName: string;
  storeName: string;
  price: number;
  /** ISO date string, e.g. "2026-07-05" */
  purchaseDate: string;
  /** Local file URI of the receipt photo, if any */
  receiptImageUri: string | null;
  warrantyLengthDays: number;
  /** Calculated: purchaseDate + warrantyLengthDays (ISO date string) */
  warrantyExpirationDate: string;
  returnWindowDays: number;
  /** Calculated: purchaseDate + returnWindowDays (ISO date string) */
  returnDeadlineDate: string;
  notes?: string;
  /** Serial / model number, for warranty claims */
  serialNumber?: string;
  /** Local file URIs of product photos (condition, serial plate, box) */
  productPhotos?: string[];
  /** The individual products on this receipt (empty for a single-item purchase) */
  lineItems?: ReceiptLineItem[];
  /** Scheduled local notification ids, so they can be cancelled on edit/delete */
  notificationIds: string[];
  createdAt: string;
}

export interface AppSettings {
  /** True once the user has finished the welcome screens */
  hasOnboarded: boolean;
  notificationsEnabled: boolean;
  /** Days before the return deadline to remind the user */
  returnReminderDays: number;
  /** Days before warranty expiration to remind the user */
  warrantyReminderDays: number;
  /**
   * Reserved for the future premium bundle (Claude-powered extraction).
   * No UI sets this today — free on-device OCR is the default for everyone.
   */
  claudeApiKey: string;
  /** How often to nudge the user to price-check their watchlist */
  priceCheckCadence: PriceCheckCadence;
}

export type PriceCheckCadence = 'off' | 'daily' | 'every2d' | 'weekly' | 'biweekly' | 'monthly';

export const PRICE_CHECK_OPTIONS: { key: PriceCheckCadence; label: string; days: number }[] = [
  { key: 'daily', label: 'Daily', days: 1 },
  { key: 'every2d', label: 'Every 2 days', days: 2 },
  { key: 'weekly', label: 'Weekly', days: 7 },
  { key: 'biweekly', label: 'Every 2 weeks', days: 14 },
  { key: 'monthly', label: 'Monthly', days: 30 },
  { key: 'off', label: 'Off', days: 0 },
];

export const DEFAULT_SETTINGS: AppSettings = {
  hasOnboarded: false,
  notificationsEnabled: true,
  returnReminderDays: 3,
  warrantyReminderDays: 7,
  claudeApiKey: '',
  priceCheckCadence: 'weekly',
};

export const WARRANTY_PRESETS = [
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 },
  { label: '2 years', days: 730 },
] as const;

export const RETURN_PRESETS = [
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
  { label: '90 days', days: 90 },
] as const;
