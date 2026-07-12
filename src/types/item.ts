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
  /** Small thumbnail of the first receipt page, for snappy list rows */
  receiptThumbUri?: string;
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
  /** How it was paid for — credit cards often add warranty/return protection */
  paymentMethod?: PaymentMethod;
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
  /** True once the one-time feature tour has been shown on the dashboard */
  tourSeen: boolean;
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
  /** Appearance: follow the system, or force light/dark. Applies instantly. */
  themeMode: ThemeMode;
  /** Sunday-morning summary of the week's deadlines */
  weeklyDigestEnabled: boolean;
  /** Auto price-check nudges while an item is still returnable */
  priceDropRemindersEnabled: boolean;
  /** How often to nudge during the return window (days between reminders) */
  priceDropCadenceDays: number;
  /** Only start nudging when this many days are left in the window (0 = whole window) */
  priceDropLeadDays: number;
}

/** Cadence choices for the return-window price-drop nudge. */
export const PRICE_DROP_CADENCE_OPTIONS: { days: number; label: string }[] = [
  { days: 1, label: 'Every day' },
  { days: 2, label: 'Every 2 days' },
  { days: 3, label: 'Every 3 days' },
  { days: 7, label: 'Weekly' },
];

/** When to start the price-drop nudge, relative to the return window closing. */
export const PRICE_DROP_LEAD_OPTIONS: { days: number; label: string }[] = [
  { days: 0, label: 'Whole window' },
  { days: 15, label: 'Last 15 days' },
  { days: 10, label: 'Last 10 days' },
  { days: 5, label: 'Last 5 days' },
  { days: 3, label: 'Last 3 days' },
];

export type ThemeMode = 'system' | 'light' | 'dark';

export type PaymentMethod = 'visa' | 'mastercard' | 'amex' | 'discover' | 'debit' | 'cash' | 'other';

/** Payment choices shown when adding/editing an item. */
export const PAYMENT_METHOD_OPTIONS: { key: PaymentMethod; label: string }[] = [
  { key: 'visa', label: 'Visa' },
  { key: 'mastercard', label: 'Mastercard' },
  { key: 'amex', label: 'Amex' },
  { key: 'discover', label: 'Discover' },
  { key: 'debit', label: 'Debit' },
  { key: 'cash', label: 'Cash' },
  { key: 'other', label: 'Other' },
];

/** A possible CPSC recall affecting a tracked item. */
export interface RecallAlert {
  /** `${recallId}:${itemId}` — one alert per recall per item */
  id: string;
  recallId: number;
  itemId: string;
  itemName: string;
  title: string;
  /** CPSC recall page */
  url: string;
  /** ISO date the recall was issued */
  recallDate: string;
  hazard?: string;
  /** ISO datetime Boughtly found the match */
  foundAt: string;
  /** User said "not my product" (kept so we never re-alert) */
  dismissed?: boolean;
}

/** Appearance choices shown in Settings. */
export const THEME_MODE_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

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
  tourSeen: false,
  notificationsEnabled: true,
  returnReminderDays: 3,
  warrantyReminderDays: 7,
  reminderHour: 9,
  currencyCode: 'USD',
  appLockEnabled: false,
  claudeApiKey: '',
  priceCheckCadence: 'weekly',
  themeMode: 'system',
  weeklyDigestEnabled: true,
  priceDropRemindersEnabled: true,
  priceDropCadenceDays: 3,
  priceDropLeadDays: 0,
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
