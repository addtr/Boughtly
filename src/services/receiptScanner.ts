import { Platform } from 'react-native';
import { AppSettings } from '../types/item';
import { ExtractedReceipt, extractReceiptDetails } from './receiptOcr';
import { parseReceiptText } from './receiptParser';

/**
 * Receipt scanning entry point.
 *
 * Default (free): on-device text recognition (ML Kit) + heuristic parsing.
 * Runs entirely on the phone — no account, no network, no cost.
 *
 * Premium (future bundle): Claude vision extraction. The code path exists but
 * is dormant — nothing in the UI sets a key, so it never runs today.
 *
 * Returns null when no OCR engine is available (web, or Expo Go without the
 * native module) — callers should quietly fall back to manual entry.
 */
export async function scanReceipt(
  imageUri: string,
  settings: AppSettings
): Promise<ExtractedReceipt | null> {
  // Dormant premium path — no UI sets this key today
  if (settings.claudeApiKey) {
    return extractReceiptDetails(imageUri, settings.claudeApiKey);
  }

  if (Platform.OS === 'web') return null;

  let recognize: ((uri: string) => Promise<{ text: string }>) | null = null;
  try {
    // Lazy require: in Expo Go the native module doesn't exist, and a static
    // import would crash the whole app at startup. In a dev build it loads.
    const TextRecognition = require('@react-native-ml-kit/text-recognition').default;
    recognize = (uri: string) => TextRecognition.recognize(uri);
  } catch {
    return null;
  }

  try {
    const result = await recognize(imageUri);
    if (!result?.text?.trim()) {
      return { itemName: null, storeName: null, price: null, purchaseDate: null };
    }
    return parseReceiptText(result.text);
  } catch {
    return null;
  }
}
