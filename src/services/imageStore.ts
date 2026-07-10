/**
 * Image persistence with performance in mind.
 *
 * Phone cameras produce ~12MP photos; a receipt is perfectly readable at
 * 1600px wide and the dashboard renders a 44x56 thumbnail. Storing originals
 * uncapped wastes disk and makes every list row decode a huge bitmap. So:
 *  - full images are persisted capped at MAX_WIDTH (never upscaled)
 *  - each receipt gets a small THUMB_WIDTH companion file for list rows
 * Every step is best-effort: on any failure we fall back to the original
 * file rather than losing the photo.
 */

import { File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const MAX_WIDTH = 1600;
const THUMB_WIDTH = 240;

function rand(): string {
  return Math.random().toString(36).slice(2, 7);
}

/** Copy a file URI into the app's documents dir under the given prefix. */
function copyIntoDocuments(sourceUri: string, prefix: string): string {
  const ext = sourceUri.split('.').pop()?.split('?')[0] || 'jpg';
  const dest = new File(Paths.document, `${prefix}-${Date.now()}-${rand()}.${ext}`);
  new File(sourceUri).copy(dest);
  return dest.uri;
}

/** Resize (down only) and persist as a JPEG in the documents dir. */
async function resizeIntoDocuments(
  sourceUri: string,
  width: number,
  prefix: string,
  compress: number
): Promise<string> {
  // A no-op manipulate call reports the source dimensions.
  const info = await manipulateAsync(sourceUri, []);
  const actions = info.width > width ? [{ resize: { width } }] : [];
  const out = await manipulateAsync(sourceUri, actions, {
    compress,
    format: SaveFormat.JPEG,
  });
  const dest = new File(Paths.document, `${prefix}-${Date.now()}-${rand()}.jpg`);
  new File(out.uri).copy(dest);
  return dest.uri;
}

/** Persist a receipt page, capped at readable resolution. */
export async function persistReceiptImage(sourceUri: string): Promise<string> {
  try {
    return await resizeIntoDocuments(sourceUri, MAX_WIDTH, 'receipt', 0.8);
  } catch {
    // Manipulation failed (odd format, web quirk) — keep the original bytes.
    return copyIntoDocuments(sourceUri, 'receipt');
  }
}

/** Persist a product photo, capped at readable resolution. */
export async function persistProductImage(sourceUri: string): Promise<string> {
  try {
    return await resizeIntoDocuments(sourceUri, MAX_WIDTH, 'product', 0.8);
  } catch {
    return copyIntoDocuments(sourceUri, 'product');
  }
}

/** Small list-row thumbnail for a receipt. Null when it can't be made. */
export async function makeReceiptThumb(sourceUri: string): Promise<string | null> {
  try {
    return await resizeIntoDocuments(sourceUri, THUMB_WIDTH, 'thumb', 0.5);
  } catch {
    return null;
  }
}
