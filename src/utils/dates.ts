/**
 * Date helpers. All item dates are date-only ISO strings ("YYYY-MM-DD"),
 * interpreted in the device's local timezone.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parse "YYYY-MM-DD" as local midnight (avoids UTC off-by-one from Date parsing). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function localMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Whole days from today until the given date. 0 = today, negative = past.
 */
export function daysUntil(iso: string): number {
  const target = parseISODate(iso);
  const today = localMidnight(new Date());
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

/** "Jul 5, 2026" style display */
export function formatDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatPrice(price: number): string {
  return price.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
  });
}

export interface DeadlineInfo {
  kind: 'return' | 'warranty';
  /** ISO date of the deadline */
  date: string;
  daysLeft: number;
  /** Total length of this window in days (for ring progress) */
  totalDays: number;
}

/**
 * The nearer upcoming deadline for an item (return window vs warranty).
 * If one has passed, prefers the one still active; if both passed, returns
 * the one that ended most recently, flagged by its negative daysLeft.
 */
export function nearestDeadline(item: {
  returnDeadlineDate: string;
  warrantyExpirationDate: string;
  returnWindowDays: number;
  warrantyLengthDays: number;
}): DeadlineInfo {
  const ret: DeadlineInfo = {
    kind: 'return',
    date: item.returnDeadlineDate,
    daysLeft: daysUntil(item.returnDeadlineDate),
    totalDays: item.returnWindowDays,
  };
  const war: DeadlineInfo = {
    kind: 'warranty',
    date: item.warrantyExpirationDate,
    daysLeft: daysUntil(item.warrantyExpirationDate),
    totalDays: item.warrantyLengthDays,
  };

  const retActive = ret.daysLeft >= 0;
  const warActive = war.daysLeft >= 0;
  if (retActive && warActive) return ret.daysLeft <= war.daysLeft ? ret : war;
  if (retActive) return ret;
  if (warActive) return war;
  return ret.daysLeft >= war.daysLeft ? ret : war;
}
