import { ExtractedReceipt } from './receiptOcr';

/**
 * Heuristic parser for raw receipt text from on-device OCR.
 *
 * Receipts vary wildly, so this aims for "right most of the time, empty when
 * unsure" — the form never blocks on a bad guess, the user can always edit.
 */

const MONEY_RE = /(?:\$|USD\s?)?(\d{1,3}(?:,\d{3})*\.\d{2})\b/;

/** Lines that carry a price but are not purchasable items */
const NON_ITEM_RE =
  /total|subtotal|sub-total|tax|tip|cash|change|credit|debit|visa|mastercard|amex|discover|tender|payment|balance|due|refund|savings|discount|coupon|rounding|gift\s?card|loyalty|points/i;

const TOTAL_RE = /\b(?:grand\s+)?total\b|amount\s+due|balance\s+due/i;
const SUBTOTAL_RE = /sub\s?-?\s?total/i;

/** Lines that are clearly not a store name */
const NOT_STORE_RE =
  /^\s*$|receipt|invoice|welcome|thank|order|register|cashier|store\s*#|tel|phone|fax|www\.|http|@|^\d[\d\s\-().]*$/i;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** ALL CAPS → Title Case, without capitalizing after apostrophes ("Joe's") */
function softenCaps(text: string): string {
  if (text !== text.toUpperCase()) return text;
  return text.toLowerCase().replace(/(^|[\s\-/])([a-z])/g, (_, sep, c) => sep + c.toUpperCase());
}

function parseMoney(raw: string): number | null {
  const m = raw.match(MONEY_RE);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function plausible(y: number, mo: number, d: number): boolean {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const date = new Date(y, mo - 1, d);
  const now = new Date();
  const threeYearsAgo = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
  return date <= now && date >= threeYearsAgo;
}

/** Finds a purchase date anywhere in the text; returns ISO "YYYY-MM-DD" */
export function findDate(text: string): string | null {
  // ISO: 2026-07-05
  let m = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) {
    const [, y, mo, d] = m.map(Number);
    if (plausible(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  // US style: 07/05/2026 or 07/05/26 (assumes month first)
  m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/);
  if (m) {
    let [, mo, d, y] = m.map(Number);
    if (y < 100) y += 2000;
    if (plausible(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
    // Some receipts are day-first
    if (plausible(y, d, mo)) return `${y}-${pad(d)}-${pad(mo)}`;
  }
  // "Jul 5, 2026" / "5 Jul 2026"
  m = text.match(/\b([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})/i);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase()];
    const d = Number(m[2]);
    const y = Number(m[3]);
    if (mo && plausible(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  m = text.match(/\b(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s+(20\d{2})/i);
  if (m) {
    const d = Number(m[1]);
    const mo = MONTHS[m[2].toLowerCase()];
    const y = Number(m[3]);
    if (mo && plausible(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  return null;
}

function findStore(lines: string[]): string | null {
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (trimmed.length < 3 || trimmed.length > 40) continue;
    if (NOT_STORE_RE.test(trimmed)) continue;
    if (MONEY_RE.test(trimmed)) continue;
    if (!/[a-zA-Z]{3}/.test(trimmed)) continue;
    // Receipts often shout — soften ALL CAPS to Title Case
    return softenCaps(trimmed);
  }
  return null;
}

function findTotal(lines: string[]): number | null {
  // Prefer an explicit total line (money on it, or on the line right after)
  for (let i = 0; i < lines.length; i++) {
    if (TOTAL_RE.test(lines[i]) && !SUBTOTAL_RE.test(lines[i])) {
      const here = parseMoney(lines[i]);
      if (here !== null) return here;
      const next = lines[i + 1] ? parseMoney(lines[i + 1]) : null;
      if (next !== null) return next;
    }
  }
  // Fallback: the largest money amount on the receipt
  let max: number | null = null;
  for (const line of lines) {
    const value = parseMoney(line);
    if (value !== null && (max === null || value > max)) max = value;
  }
  return max;
}

function findItem(lines: string[]): string | null {
  // Candidate item lines: carry a price, aren't totals/payments
  let best: { name: string; price: number } | null = null;
  for (const line of lines) {
    if (NON_ITEM_RE.test(line)) continue;
    const price = parseMoney(line);
    if (price === null) continue;
    const name = line
      .replace(MONEY_RE, '')
      .replace(/^\d+\s*[x@]\s*/i, '') // leading qty ("1x Latte")
      .replace(/\b\d{6,}\b/g, '') // SKU/barcode digits
      .replace(/\s+[A-Z]\s*$/, '') // trailing tax-code letter
      .replace(/[\s@x*]+\d+(\.\d+)?\s*$/i, '') // qty markers
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (name.length < 3 || !/[a-zA-Z]{3}/.test(name)) continue;
    if (!best || price > best.price) best = { name, price };
  }
  if (!best) return null;
  return softenCaps(best.name);
}

export function parseReceiptText(rawText: string): ExtractedReceipt {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  return {
    itemName: findItem(lines),
    storeName: findStore(lines),
    price: findTotal(lines),
    purchaseDate: findDate(rawText),
  };
}
