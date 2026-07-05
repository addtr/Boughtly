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
}

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    itemName: {
      type: ['string', 'null'],
      description:
        'The main purchased item, in plain language (e.g. "Noise-cancelling headphones"). If the receipt lists several items, pick the most significant one. Null if unreadable.',
    },
    storeName: {
      type: ['string', 'null'],
      description: 'The store or merchant name. Null if unreadable.',
    },
    price: {
      type: ['number', 'null'],
      description:
        'The total amount paid as a number, no currency symbol. Prefer the receipt total. Null if unreadable.',
    },
    purchaseDate: {
      type: ['string', 'null'],
      description: 'The purchase date in YYYY-MM-DD format. Null if unreadable.',
    },
  },
  required: ['itemName', 'storeName', 'price', 'purchaseDate'],
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
              'This is a photo of a shopping receipt. Extract the purchase details. ' +
              'Use null for anything you cannot read confidently.',
          },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    return { itemName: null, storeName: null, price: null, purchaseDate: null };
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return { itemName: null, storeName: null, price: null, purchaseDate: null };
  }

  const parsed = JSON.parse(textBlock.text) as ExtractedReceipt;
  return {
    itemName: parsed.itemName ?? null,
    storeName: parsed.storeName ?? null,
    price: typeof parsed.price === 'number' && Number.isFinite(parsed.price) ? parsed.price : null,
    purchaseDate:
      parsed.purchaseDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.purchaseDate)
        ? parsed.purchaseDate
        : null,
  };
}
