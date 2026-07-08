import { ExtractedReceipt } from './receiptOcr';

/**
 * Heuristic parser for raw receipt text from OCR.
 *
 * Tuned against real receipts: payment lines (CASH/CHANGE) never win the
 * total, the purchase date is the bottom-most past date, and if the receipt
 * prints its own "return by" date or "within N days" policy, that wins over
 * every store-policy guess.
 */

const MONEY_RE = /(?:\$|USD\s?)?(\d{1,3}(?:,\d{3})*\.\d{2})\b/;

/** Lines that carry a price but are not purchasable items */
const NON_ITEM_RE =
  /total|subtotal|sub-total|tax|tip|cash|change|credit|debit|visa|mastercard|amex|discover|tender|payment|balance|due|refund|savings|discount|coupon|rounding|gift\s?card|loyalty|points|cash\s?back|reward/i;

/** Payment/tender lines — must NEVER be mistaken for the total */
const PAYMENT_RE =
  /cash|change|tender|credit|debit|visa|mastercard|amex|discover|card\b|gift\s?card|balance|due|cash\s?back|refund|account|approved|auth/i;

// OCR loves to mangle TOTAL into T0TAL / TOTAI / TQTAL etc.
const TOTAL_RE = /\b(?:grand\s+)?t[o0q]ta[l1i]\b|amount\s+due|balance\s+due/i;
const SUBTOTAL_RE = /sub\s?-?\s?t[o0q]ta[l1i]/i;

/** Lines that are clearly not a store name */
const NOT_STORE_RE =
  /^\s*$|receipt|invoice|welcome|thank|order|register|cashier|store\s*#|tel|phone|fax|www\.|http|@|^\d[\d\s\-().]*$/i;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function parseMoney(raw: string): number | null {
  const m = raw.match(MONEY_RE);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** ALL CAPS → Title Case, without capitalizing after apostrophes ("Joe's") */
function softenCaps(text: string): string {
  if (text !== text.toUpperCase()) return text;
  return text.toLowerCase().replace(/(^|[\s\-/])([a-z])/g, (_, sep, c) => sep + c.toUpperCase());
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toISO(y: number, mo: number, d: number): string {
  return `${y}-${pad(mo)}-${pad(d)}`;
}

function validYMD(y: number, mo: number, d: number): boolean {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

interface FoundDate {
  iso: string;
  /** character index in the source text, for "prefer the bottom-most" logic */
  index: number;
  time: number;
}

/** Every date present in the text, in every format we know. */
function findAllDates(text: string): FoundDate[] {
  const found: FoundDate[] = [];
  const push = (index: number, y: number, mo: number, d: number) => {
    if (!validYMD(y, mo, d)) return;
    found.push({ iso: toISO(y, mo, d), index, time: new Date(y, mo - 1, d).getTime() });
  };

  // ISO: 2026-07-05
  for (const m of text.matchAll(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
    push(m.index ?? 0, Number(m[1]), Number(m[2]), Number(m[3]));
  }
  // US style: 07/05/2026 or 7/5/26 (month first; also try day-first if invalid)
  for (const m of text.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/g)) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (validYMD(y, a, b)) push(m.index ?? 0, y, a, b);
    else if (validYMD(y, b, a)) push(m.index ?? 0, y, b, a);
  }
  // "Jul 5, 2026" / "July 5 2026"
  for (const m of text.matchAll(/\b([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})/gi)) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (mo) push(m.index ?? 0, Number(m[3]), mo, Number(m[2]));
  }
  // "5 Jul 2026"
  for (const m of text.matchAll(/\b(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s+(20\d{2})/gi)) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) push(m.index ?? 0, Number(m[3]), mo, Number(m[1]));
  }
  return found;
}

/**
 * Purchase date: the bottom-most date on the receipt that isn't in the
 * future (receipts print the sale datetime near the bottom; future dates
 * are return-by/offer-expiry dates).
 */
export function findDate(text: string): string | null {
  const now = Date.now();
  const threeYearsAgo = now - 3 * 365 * 86400000;
  const candidates = findAllDates(text).filter(
    (d) => d.time <= now + 86400000 && d.time >= threeYearsAgo
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.index - b.index);
  return candidates[candidates.length - 1].iso;
}

/**
 * The receipt's own printed return policy — the highest-authority source.
 * Handles "RETURN BY 09/06/2026", "returns accepted until Sep 6",
 * "within 60 days", "60-day return policy".
 */
export function findReturnInfo(
  text: string,
  purchaseISO: string | null
): { returnDays: number; returnByDate?: string } | null {
  const purchase = purchaseISO
    ? new Date(
        Number(purchaseISO.slice(0, 4)),
        Number(purchaseISO.slice(5, 7)) - 1,
        Number(purchaseISO.slice(8, 10))
      ).getTime()
    : Date.now();

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!/return|exchange|refund/i.test(line)) continue;

    // "within 60 days" / "60 days" / "60-day"
    const within = line.match(/(?:within|in)\s+(\d{1,3})\s*days?/i) ?? line.match(/\b(\d{1,3})[\s-]*day/i);
    if (within) {
      const days = Number(within[1]);
      if (days >= 1 && days <= 730) return { returnDays: days };
    }

    // "by/until/before/through <date>" — a future date relative to purchase
    if (/\b(by|until|before|through|thru)\b/i.test(line)) {
      const dates = findAllDates(line);
      for (const d of dates) {
        const diff = Math.round((d.time - purchase) / 86400000);
        if (diff >= 1 && diff <= 730) {
          return { returnDays: diff, returnByDate: d.iso };
        }
      }
    }
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
    return softenCaps(trimmed);
  }
  return null;
}

function findTotal(lines: string[]): number | null {
  // 1) An explicit TOTAL line (money on it, or on the line right after)
  for (let i = 0; i < lines.length; i++) {
    if (TOTAL_RE.test(lines[i]) && !SUBTOTAL_RE.test(lines[i]) && !PAYMENT_RE.test(lines[i])) {
      const here = parseMoney(lines[i]);
      if (here !== null) return here;
      const next = lines[i + 1] ? parseMoney(lines[i + 1]) : null;
      if (next !== null && !PAYMENT_RE.test(lines[i + 1])) return next;
    }
  }

  // 2) The receipt's own arithmetic: cash tendered − change = total paid
  let cash: number | null = null;
  let change: number | null = null;
  for (const line of lines) {
    if (/\bcash\b/i.test(line) && !/cash\s?back/i.test(line) && cash === null) {
      cash = parseMoney(line);
    }
    if (/\bchange\b/i.test(line) && change === null) {
      change = parseMoney(line);
    }
  }
  if (cash !== null && change !== null && cash > change) {
    return Math.round((cash - change) * 100) / 100;
  }

  // 3) Fallback: the largest amount that is NOT a payment/tender line
  let max: number | null = null;
  for (const line of lines) {
    if (PAYMENT_RE.test(line)) continue;
    const value = parseMoney(line);
    if (value !== null && (max === null || value > max)) max = value;
  }
  return max;
}

function findItem(lines: string[]): string | null {
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

  const purchaseDate = findDate(rawText);
  const returnInfo = findReturnInfo(rawText, purchaseDate);

  return {
    itemName: findItem(lines),
    storeName: findStore(lines),
    price: findTotal(lines),
    purchaseDate,
    returnDays: returnInfo?.returnDays ?? null,
    returnByDate: returnInfo?.returnByDate ?? null,
  };
}
