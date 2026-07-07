import Anthropic from '@anthropic-ai/sdk';
import { PolicySuggestion } from './policyLookup';

/**
 * Live per-item policy lookup: asks Claude (with real-time web search) what
 * the return window and manufacturer warranty are for THIS item at THIS
 * store. Costs a few cents per lookup and needs the owner API key — when no
 * key is configured the app falls back to the built-in knowledge base.
 */

const LOOKUP_PROMPT = (itemName: string, storeName: string) => `
Search the web to find, for a "${itemName}" purchased at "${storeName}":
1. The store's current return window for this kind of item, in days.
2. The typical manufacturer warranty for this kind of product, in days
   (use 0 if this product category has no manufacturer warranty).

Then answer with ONLY a JSON object, no other text after it, shaped exactly:
{"returnDays": <number|null>, "returnNote": "<one short sentence citing the store policy>", "warrantyDays": <number|null>, "warrantyNote": "<one short sentence>"}
Use null when you could not verify a number. Days must be integers.`;

/** Pulls the JSON object out of the model's final text. Exported for tests. */
export function parsePolicyResponse(text: string): PolicySuggestion {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    const raw = JSON.parse(match[0]);
    const out: PolicySuggestion = {};
    if (Number.isInteger(raw.returnDays) && raw.returnDays > 0 && raw.returnDays <= 3650) {
      out.returnDays = raw.returnDays;
      if (typeof raw.returnNote === 'string' && raw.returnNote) out.returnNote = raw.returnNote;
    }
    if (Number.isInteger(raw.warrantyDays) && raw.warrantyDays >= 0 && raw.warrantyDays <= 7300) {
      // 0 = no manufacturer warranty: mirror the return window if we have one
      out.warrantyDays = raw.warrantyDays === 0 ? out.returnDays ?? 30 : raw.warrantyDays;
      if (typeof raw.warrantyNote === 'string' && raw.warrantyNote)
        out.warrantyNote = raw.warrantyNote;
    }
    return out;
  } catch {
    return {};
  }
}

export async function lookupPoliciesLive(
  itemName: string,
  storeName: string,
  apiKey: string
): Promise<PolicySuggestion> {
  const client = new Anthropic({ apiKey });

  let messages: Anthropic.MessageParam[] = [
    { role: 'user', content: LOOKUP_PROMPT(itemName, storeName) },
  ];
  let response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2000,
    tools: [{ type: 'web_search_20260209', name: 'web_search' } as Anthropic.ToolUnion],
    messages,
  });

  // Server-side search runs in a loop; resume if the API pauses the turn
  let continuations = 0;
  while (response.stop_reason === 'pause_turn' && continuations < 3) {
    messages = [...messages, { role: 'assistant', content: response.content }];
    response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2000,
      tools: [{ type: 'web_search_20260209', name: 'web_search' } as Anthropic.ToolUnion],
      messages,
    });
    continuations++;
  }

  if (response.stop_reason === 'refusal') return {};
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  return parsePolicyResponse(text);
}
