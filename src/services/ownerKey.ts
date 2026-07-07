import Constants from 'expo-constants';
import { AppSettings } from '../types/item';

/**
 * Owner-only API key for the live lookup + premium OCR engines.
 *
 * There is deliberately NO user-facing field for this — set it in app.json
 * under expo.extra.anthropicApiKey in your own local copy (never commit a
 * real key). When it's empty, the app uses the free engines instead.
 * The shipping-to-users version of this is a paid backend, not a bundled key.
 */
export function getOwnerApiKey(settings: AppSettings): string {
  const fromConfig = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)
    ?.anthropicApiKey;
  if (typeof fromConfig === 'string' && fromConfig.trim()) return fromConfig.trim();
  return settings.claudeApiKey?.trim() ?? '';
}
