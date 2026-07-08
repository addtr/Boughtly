import Anthropic from '@anthropic-ai/sdk';
import { File } from 'expo-file-system';

/**
 * Receipt OCR via Claude vision. Sends the receipt photo to the Claude API
 * and gets back structured fields (item, store, price, date).
 *
 * Requires the user's Anthropic API key (set in Settings). Without a key the
 * app falls back to manual entry — scanning still captures the photo.
 */

export interface ExtractedReceipt {
  itemName: string | null;
  storeName: string | null;
  price: number | null;
  /** ISO date "YYYY-MM-DD" */
  purchaseDate: string | null;
  /** Return window in days if the receipt states/implies one; else null */
  returnDays: number | null;
  /** The receipt's printed "return by" date, ISO, if any */
  returnByDate: string | null;
}

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    itemName: {
      type: ['string', 'null'],
      description:
        'The main purchased item, in plain language (e.g. "Noise-cancelling headphones"). If the receipt lists several items, pick the most expensive/significant one. Expand obvious abbreviations. Null if unreadable.',
    },
    storeName: {
      type: ['string', 'null'],
      description: 'The store or merchant name (usually the top line). Null if unreadable.',
    },
    price: {
      type: ['number', 'null'],
      description:
        'The amount actually paid for the goods, as a number with no currency symbol. This is the TOTAL (or amount due / balance) line — NOT the cash tendered and NOT the change given. If the receipt shows cash tendered and change, the true total is (cash tendered − change). Never report the cash-tendered amount as the price. Null if unreadable.',
    },
    purchaseDate: {
      type: ['string', 'null'],
      description:
        'The date the purchase was made, in YYYY-MM-DD format. This is the transaction date printed near the bottom with the time — NOT a "return by" date, coupon expiry, or any future date. Null if unreadable.',
    },
    returnDays: {
      type: ['integer', 'null'],
      description:
        'If the receipt states a return policy (e.g. "returns within 60 days", "60-day return policy", "return by 09/06/2026"), the number of days from purchase to the return deadline. Compute it from a printed return-by date if needed. Null if the receipt does not mention a return window.',
    },
    returnByDate: {
      type: ['string', 'null'],
      description:
        'If the receipt prints an explicit "return by / return before" date, that date in YYYY-MM-DD format. Null otherwise.',
    },
  },
  required: ['itemName', 'storeName', 'price', 'purchaseDate', 'returnDays', 'returnByDate'],
  additionalProperties: false,
} as const;

function mediaTypeForUri(uri: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Reads the receipt image and asks Claude to pull out the purchase details.
 * Throws on network/API errors; returns all-null fields if the image simply
 * couldn't be read as a receipt.
 */
export async function extractReceiptDetails(
  imageUri: string,
  apiKey: string
): Promise<ExtractedReceipt> {
  const base64 = new File(imageUri).base64Sync();

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    output_config: {
      format: {
        type: 'json_schema',
        schema: EXTRACTION_SCHEMA,
      },
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaTypeForUri(imageUri),
              data: base64,
            },
          },
          {
            type: 'text',
            text:
              'This is a photo of a shopping receipt. Extract the purchase details precisely. ' +
              'Be careful with the price: report what was paid for the goods (the TOTAL), ' +
              'never the cash tendered — if you see cash and change, the total is cash minus change. ' +
              'The purchase date is the transaction date near the bottom, not any return-by or expiry date. ' +
              'If the receipt prints a return policy or return-by date, capture it. ' +
              'Use null for anything you cannot read confidently.',
          },
        ],
      },
    ],
  });

  const empty: ExtractedReceipt = {
    itemName: null,
    storeName: null,
    price: null,
    purchaseDate: null,
    returnDays: null,
    returnByDate: null,
  };

  if (response.stop_reason === 'refusal') return empty;

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') return empty;

  const parsed = JSON.parse(textBlock.text) as Partial<ExtractedReceipt>;
  const isoOk = (s: unknown): s is string =>
    typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  return {
    itemName: parsed.itemName ?? null,
    storeName: parsed.storeName ?? null,
    price:
      typeof parsed.price === 'number' && Number.isFinite(parsed.price) && parsed.price > 0
        ? parsed.price
        : null,
    purchaseDate: isoOk(parsed.purchaseDate) ? parsed.purchaseDate : null,
    returnDays:
      typeof parsed.returnDays === 'number' &&
      Number.isInteger(parsed.returnDays) &&
      parsed.returnDays >= 1 &&
      parsed.returnDays <= 730
        ? parsed.returnDays
        : null,
    returnByDate: isoOk(parsed.returnByDate) ? parsed.returnByDate : null,
  };
}
