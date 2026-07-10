/**
 * Recall alerts via the US CPSC SaferProducts API (free, no key).
 * We query recalls issued since each item's purchase date using the item's
 * most distinctive word, then require a second word to also match before
 * alerting — a recall notice is scary, so precision beats recall here (pun
 * intended). Matches are surfaced as "possible" and link to the official
 * CPSC page for the user to confirm.
 */

import { RecallAlert, TrackedItem } from '../types/item';

const API = 'https://www.saferproducts.gov/RestWebServices/Recall';

/** Raw shape returned by the CPSC API (only the fields we read). */
interface CpscRecall {
  RecallID: number;
  RecallDate: string;
  Title: string;
  URL: string;
  Products?: { Name?: string }[];
  Hazards?: { Name?: string }[];
}

// Words too generic to identify a product on their own.
const STOPWORDS = new Set([
  'the', 'and', 'with', 'for', 'from', 'pro', 'max', 'mini', 'plus', 'new',
  'set', 'pack', 'kit', 'inch', 'black', 'white', 'blue', 'red', 'gray',
  'grey', 'green', 'pink', 'gold', 'silver', 'small', 'medium', 'large',
]);

/** Meaningful words from an item name: 3+ chars, contains a letter, not filler. */
export function itemTokens(itemName: string): string[] {
  return itemName
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((w) => w.length >= 3 && /[a-z]/.test(w) && !STOPWORDS.has(w));
}

/**
 * Decide whether a recall plausibly covers this item: the recall's title and
 * product names must contain at least two of the item's words (or all of
 * them, for one-word items).
 */
export function recallMatchesItem(recall: CpscRecall, itemName: string): boolean {
  const tokens = itemTokens(itemName);
  if (tokens.length === 0) return false;
  const hay = (
    recall.Title +
    ' ' +
    (recall.Products ?? []).map((p) => p.Name ?? '').join(' ')
  ).toLowerCase();
  const matched = tokens.filter((t) => hay.includes(t)).length;
  return tokens.length === 1 ? matched === 1 : matched >= 2;
}

async function fetchJson(url: string, timeoutMs = 12000): Promise<CpscRecall[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Check one item against recalls issued since it was purchased.
 * Network/API failures return [] — recall checking is best-effort.
 */
export async function checkItemForRecalls(item: TrackedItem): Promise<RecallAlert[]> {
  const tokens = itemTokens(item.itemName);
  if (tokens.length === 0) return [];
  // The longest word is usually the most distinctive (brand or product line)
  const query = [...tokens].sort((a, b) => b.length - a.length)[0];
  const since = item.purchaseDate.slice(0, 10);
  let recalls: CpscRecall[];
  try {
    recalls = await fetchJson(
      `${API}?format=json&ProductName=${encodeURIComponent(query)}&RecallDateStart=${since}`
    );
  } catch {
    return [];
  }
  return recalls
    .filter((r) => r.RecallID && r.Title && recallMatchesItem(r, item.itemName))
    .slice(0, 3) // never bury the user in matches for one item
    .map((r) => ({
      id: `${r.RecallID}:${item.id}`,
      recallId: r.RecallID,
      itemId: item.id,
      itemName: item.itemName,
      title: r.Title,
      url: r.URL || `https://www.cpsc.gov/Recalls?search=${encodeURIComponent(r.Title)}`,
      recallDate: (r.RecallDate ?? '').slice(0, 10),
      hazard: r.Hazards?.[0]?.Name || undefined,
      foundAt: new Date().toISOString(),
    }));
}

/**
 * Check every item, skipping alerts we already know about (dismissed or not).
 * Sequential with a small gap — polite to the API, and launch isn't blocked
 * on it anyway.
 */
export async function checkAllItemsForRecalls(
  items: TrackedItem[],
  known: RecallAlert[]
): Promise<RecallAlert[]> {
  const knownIds = new Set(known.map((a) => a.id));
  const fresh: RecallAlert[] = [];
  for (const item of items) {
    try {
      const alerts = await checkItemForRecalls(item);
      for (const a of alerts) {
        if (!knownIds.has(a.id)) {
          knownIds.add(a.id);
          fresh.push(a);
        }
      }
    } catch {
      // keep going — one bad item name must not stop the sweep
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return fresh;
}
