import { ExtractedReceipt } from './receiptOcr';

/**
 * Heuristic parser for raw receipt text from OCR.
 *
 * Tuned against real receipts: payment lines (CASH/CHANGE) never win the
 * total, the purchase date is the bottom-most past date, and if the receipt
 * prints its own "return by" date or "within N days" policy, that wins over
 * every store-policy guess.
 */

// Dollar amount: comma-grouped ("1,299.99") or plain ("1299.99", "12.00").
const MONEY_RE = /(?:\$|USD\s?)?((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})\b/;

/** Lines that carry a price but are not purchasable items */
const NON_ITEM_RE =
  /total|subtotal|sub-total|tax|tip|cash|change|credit|debit|visa|mastercard|amex|discover|tender|payment|balance|due|refund|savings|discount|coupon|rounding|gift\s?card|loyalty|points|cash\s?back|reward/i;

/** Payment/tender lines — must NEVER be mistaken for the total */
const PAYMENT_RE =
  /cash|change|tender|credit|debit|visa|mastercard|amex|discover|card\b|gift\s?card|balance|due|cash\s?back|refund|account|approved|auth/i;

// OCR loves to mangle TOTAL into T0TAL / TOTAI / TQTAL etc. Also catch the
// other words receipts use for the amount due: balance, amount, grand total…
const TOTAL_RE =
  /\b(?:grand\s+)?t[o0q]ta[l1i]\b|\bbalance\b|\bamount\s+due\b|\bamount\b|\bbal\s+due\b|\bto\s+pay\b|\byou\s+(?:pay|paid)\b/i;
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

/** The RIGHTMOST money amount on a line — the price "across from" a label/item. */
function parseMoneyLast(raw: string): number | null {
  const all = [...raw.matchAll(new RegExp(MONEY_RE.source, 'g'))];
  if (all.length === 0) return null;
  const value = Number(all[all.length - 1][1].replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** True if a line is essentially just a price (OCR often splits it off). */
function isPriceOnlyLine(line: string): boolean {
  return MONEY_RE.test(line) && !/[a-zA-Z]{3}/.test(line.replace(MONEY_RE, ''));
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

/** A "TOTAL" line that's really savings/discount/tax/item-count, not the amount due. */
const FAKE_TOTAL_RE = /saving|discount|coupon|\btax\b|\bitems?\b|\bcount\b|\bqty\b|points/i;

function findTotal(lines: string[], lineItems: ParsedLineItem[]): number | null {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // Gather reference numbers: subtotal, tax, and the sum of line items.
  let subtotal: number | null = null;
  let tax: number | null = null;
  for (const line of lines) {
    if (SUBTOTAL_RE.test(line) && subtotal === null) subtotal = parseMoney(line);
    if (/\btax\b/i.test(line) && !/tax\s?id|tax\s?exempt/i.test(line) && tax === null) {
      tax = parseMoney(line);
    }
  }
  const itemsSum = lineItems.reduce((a, li) => a + li.price, 0);
  const target =
    subtotal !== null ? round2(subtotal + (tax ?? 0)) : itemsSum > 0 ? round2(itemsSum + (tax ?? 0)) : null;

  // 1) Explicit TOTAL / BALANCE / AMOUNT DUE lines. The amount is the price to
  //    the RIGHT of the label (rightmost on the line); if OCR pushed it onto an
  //    adjacent price-only line, take that instead.
  const candidates: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Exclude the payment section explicitly, but 'balance/due' appear in both
    // TOTAL_RE and PAYMENT_RE — allow those through when the word 'total/balance
    // /amount' is what matched.
    if (!TOTAL_RE.test(line) || SUBTOTAL_RE.test(line)) continue;
    if (FAKE_TOTAL_RE.test(line)) continue; // "total savings", "total items"…
    if (/\b(cash|change|tender|visa|mastercard|amex|discover|card|credit|debit|account|approved|auth)\b/i.test(line))
      continue; // genuine payment line
    const here = parseMoneyLast(line);
    if (here !== null) {
      candidates.push(here);
    } else {
      // price split onto the next or previous line
      if (lines[i + 1] && isPriceOnlyLine(lines[i + 1])) {
        const next = parseMoney(lines[i + 1]);
        if (next !== null) candidates.push(next);
      } else if (i > 0 && isPriceOnlyLine(lines[i - 1])) {
        const prev = parseMoney(lines[i - 1]);
        if (prev !== null) candidates.push(prev);
      }
    }
  }
  if (candidates.length > 0) {
    // Prefer the candidate closest to subtotal+tax; else the largest (final total).
    if (target !== null) {
      let best = candidates[0];
      let bestDiff = Math.abs(best - target);
      for (const c of candidates) {
        const d = Math.abs(c - target);
        if (d < bestDiff) {
          best = c;
          bestDiff = d;
        }
      }
      return best;
    }
    return Math.max(...candidates);
  }

  // 2) The receipt's own arithmetic: cash tendered − change = total paid.
  let cash: number | null = null;
  let change: number | null = null;
  for (const line of lines) {
    if (/\bcash\b/i.test(line) && !/cash\s?back/i.test(line) && cash === null) {
      cash = parseMoney(line);
    }
    if (/\bchange\b/i.test(line) && change === null) change = parseMoney(line);
  }
  if (cash !== null && change !== null && cash > change) {
    return round2(cash - change);
  }

  // 3) Sum of the line items (+ tax if we saw a tax line).
  if (itemsSum > 0) return round2(itemsSum + (tax ?? 0));

  // 4) Last resort: the largest non-payment amount.
  let max: number | null = null;
  for (const line of lines) {
    if (PAYMENT_RE.test(line)) continue;
    const value = parseMoney(line);
    if (value !== null && (max === null || value > max)) max = value;
  }
  return max;
}

/** Strip prices, SKUs, quantity markers and tax codes from a line-item line. */
function cleanItemName(line: string): string {
  return line
    .replace(new RegExp(MONEY_RE.source, 'g'), '') // every price on the line
    .replace(/^\d+\s*[x@]\s*/i, '') // leading qty ("1x Latte", "2 @")
    .replace(/\b\d{5,}\b/g, '') // SKU / barcode digits (5+)
    .replace(/\bqty\b|\beach\b|\bea\b/gi, '')
    .replace(/\s+\d+\s*@\s*$/i, '') // trailing "2 @"
    .replace(/[@x*]\s*$/i, '')
    .replace(/\s+[A-Z]\s*$/, '') // trailing single tax-code letter (T, F, N)
    .replace(/[^a-zA-Z0-9%.&/'()+\- ]/g, ' ') // drop stray OCR punctuation
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** True for lines that carry a price but aren't a purchasable line item. */
function isNonItemLine(line: string): boolean {
  if (NON_ITEM_RE.test(line)) return true;
  // discount / negative lines
  if (/-\s*\$?\d|\(\s*\$?\d/.test(line)) return true;
  return false;
}

export interface ParsedLineItem {
  name: string;
  price: number;
}

/**
 * Every purchasable line item on the receipt (name + price), in order.
 * Stops at the SUBTOTAL/TOTAL section so tax/total/payment rows are excluded.
 */
export function parseLineItems(rawText: string): ParsedLineItem[] {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Everything above the first SUBTOTAL/TOTAL line is the item body.
  let bodyEnd = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (
      SUBTOTAL_RE.test(lines[i]) ||
      (TOTAL_RE.test(lines[i]) && !PAYMENT_RE.test(lines[i]))
    ) {
      bodyEnd = i;
      break;
    }
  }

  const items: ParsedLineItem[] = [];
  const scanTo = bodyEnd > 0 ? bodyEnd : lines.length;
  for (let i = 0; i < scanTo; i++) {
    const line = lines[i];
    if (isNonItemLine(line)) continue;

    // The item's price is the amount "across from" the name — the RIGHTMOST
    // money on the line, not the first (leading unit-price/qty columns exist).
    let price = parseMoneyLast(line);
    const name = cleanItemName(line);

    // OCR often splits the price into its own line ("Column" layouts). If this
    // line is a name with no price, adopt the price from the next price-only line.
    if (price === null && /[a-zA-Z]{2}/.test(name) && lines[i + 1] && isPriceOnlyLine(lines[i + 1])) {
      const next = parseMoneyLast(lines[i + 1]);
      if (next !== null && !isNonItemLine(lines[i + 1])) {
        price = next;
        i++; // consume the price line so it isn't scanned again
      }
    }

    if (price === null || price <= 0 || price > 100000) continue;
    if (name.length < 2 || !/[a-zA-Z]{2}/.test(name)) continue;
    items.push({ name: softenCaps(name), price });
  }
  return items;
}

function findItem(lines: string[], lineItems: ParsedLineItem[]): string | null {
  // The most expensive line item is the primary one worth protecting.
  if (lineItems.length > 0) {
    const best = lineItems.reduce((a, b) => (b.price > a.price ? b : a));
    return best.name;
  }
  // Fallback: scan the whole receipt (rare — no clean item body)
  let best: { name: string; price: number } | null = null;
  for (const line of lines) {
    if (isNonItemLine(line)) continue;
    const price = parseMoney(line);
    if (price === null) continue;
    const name = cleanItemName(line);
    if (name.length < 3 || !/[a-zA-Z]{3}/.test(name)) continue;
    if (!best || price > best.price) best = { name, price };
  }
  return best ? softenCaps(best.name) : null;
}

export function parseReceiptText(rawText: string): ExtractedReceipt {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const purchaseDate = findDate(rawText);
  const returnInfo = findReturnInfo(rawText, purchaseDate);
  const lineItems = parseLineItems(rawText);

  return {
    itemName: findItem(lines, lineItems),
    storeName: findStore(lines),
    price: findTotal(lines, lineItems),
    purchaseDate,
    returnDays: returnInfo?.returnDays ?? null,
    returnByDate: returnInfo?.returnByDate ?? null,
    lineItems,
  };
}
