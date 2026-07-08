/**
 * Remembers the store-name fixes a user makes after a scan, so the next
 * receipt from the same place comes out right automatically.
 *
 * OCR often reads a store as something messy ("TARGET T-1234", "WM
 * SUPERCENTER #5"). When the user corrects it to "Target" / "Walmart" and
 * saves, we learn a mapping keyed by a normalized form of the raw text and
 * apply it to future scans.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'boughtly.corrections.v1';

let cache: Record<string, string> | null = null;

/** Collapse a raw store string to a stable key (drops store numbers, punctuation). */
function normalizeStore(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\d+/g, ' ') // store / register numbers
    .replace(/\b(store|supercenter|super\s?center|register|reg)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Load learned corrections into memory. Safe to call repeatedly. */
export async function loadCorrections(): Promise<void> {
  if (cache) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? JSON.parse(raw) : {};
  } catch {
    cache = {};
  }
}

/**
 * Synchronous lookup of a learned correction for a raw store string. Returns
 * null until loadCorrections() has run (call it on screen mount).
 */
export function correctStore(raw: string): string | null {
  if (!cache || !raw) return null;
  const key = normalizeStore(raw);
  if (!key) return null;
  return cache[key] ?? null;
}

/** Remember that a raw scanned store should read as `corrected`. */
export async function learnStoreCorrection(raw: string, corrected: string): Promise<void> {
  await loadCorrections();
  const key = normalizeStore(raw);
  const value = corrected.trim();
  if (!key || !value) return;
  // Nothing to learn if the correction normalizes to the same thing.
  if (normalizeStore(value) === key) return;
  cache![key] = value;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // best effort — a failed write just means we re-learn next time
  }
}

/** Test/reset helper. */
export function __resetCorrectionsCache(): void {
  cache = null;
}
