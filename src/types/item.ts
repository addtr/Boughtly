/** One product line within a purchase. */
export interface ReceiptLineItem {
  name: string;
  price: number;
}

/** An extended warranty / protection plan bought with an item (AppleCare, Asurion…). */
export interface ProtectionPlan {
  provider: string;
  /** Coverage length from the purchase date */
  lengthDays: number;
  /** Calculated: purchaseDate + lengthDays (ISO date string) */
  endDate: string;
  /** Claim phone number or URL */
  contact?: string;
}

/** A purchase the user is protecting. Dates are ISO 8601 strings (date-only semantics). */
export interface TrackedItem {
  id: string;
  itemName: string;
  storeName: string;
  price: number;
  /** ISO date string, e.g. "2026-07-05" */
  purchaseDate: string;
  /** Local file URI of the receipt photo, if any (first page) */
  receiptImageUri: string | null;
  /** All receipt pages, in order (long receipts, front/back). Includes the first. */
  receiptImageUris?: string[];
  warrantyLengthDays: number;
  /** Calculated: purchaseDate + warrantyLengthDays (ISO date string) */
  warrantyExpirationDate: string;
  returnWindowDays: number;
  /** Calculated: purchaseDate + returnWindowDays (ISO date string) */
  returnDeadlineDate: string;
  notes?: string;
  /** Bought as a gift — returns usually mean store credit/exchange, not cash */
  isGift?: boolean;
  /** Optional user labels for grouping/filtering, e.g. "electronics", "gift" */
  tags?: string[];
  /** Serial / model number, for warranty claims */
  serialNumber?: string;
  /** Local file URIs of product photos (condition, serial plate, box) */
  productPhotos?: string[];
  /** A user-set one-off reminder for this item ("decide by Sunday") */
  customReminder?: { date: string; note: string };
  /** True once the user registered the product with the manufacturer */
  productRegistered?: boolean;
  /** Extended warranty / protection plan, if one was purchased */
  protectionPlan?: ProtectionPlan;
  /** Attached documents (warranty card PDF, manual…) as local file URIs */
  documents?: { name: string; uri: string }[];
  /** The individual products on this receipt (empty for a single-item purchase) */
  lineItems?: ReceiptLineItem[];
  /** Scheduled local notification ids, so they can be cancelled on edit/delete */
  notificationIds: string[];
  createdAt: string;
}

export interface AppSettings {
  /** Local profile (no server yet — ready to hook up to real auth later) */
  accountName: string;
  accountEmail: string;
  /** True once the user has finished the welcome screens */
  hasOnboarded: boolean;
  notificationsEnabled: boolean;
  /** Days before the return deadline to remind the user */
  returnReminderDays: number;
  /** Days before warranty expiration to remind the user */
  warrantyReminderDays: number;
  /** Local hour of day (0–23) reminders fire at */
  reminderHour: number;
  /** ISO 4217 currency code used to format prices app-wide */
  currencyCode: string;
  /** Require Face ID / passcode to open the app */
  appLockEnabled: boolean;
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
  accountName: '',
  accountEmail: '',
  hasOnboarded: false,
  notificationsEnabled: true,
  returnReminderDays: 3,
  warrantyReminderDays: 7,
  reminderHour: 9,
  currencyCode: 'USD',
  appLockEnabled: false,
  claudeApiKey: '',
  priceCheckCadence: 'weekly',
};

/** Reminder time-of-day presets shown in Settings. */
export const REMINDER_TIME_OPTIONS: { hour: number; label: string }[] = [
  { hour: 9, label: '9:00 AM' },
  { hour: 12, label: '12:00 PM' },
  { hour: 18, label: '6:00 PM' },
  { hour: 21, label: '9:00 PM' },
];

/** Currencies offered in Settings. */
export const CURRENCY_OPTIONS: { code: string; label: string }[] = [
  { code: 'USD', label: '$ USD' },
  { code: 'CAD', label: '$ CAD' },
  { code: 'EUR', label: '€ EUR' },
  { code: 'GBP', label: '£ GBP' },
  { code: 'AUD', label: '$ AUD' },
  { code: 'JPY', label: '¥ JPY' },
  { code: 'INR', label: '₹ INR' },
];

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
