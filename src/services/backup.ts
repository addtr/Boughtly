/**
 * Backup & restore: serialize everything the app tracks into a single JSON
 * document the user can save/email, and validate one on the way back in.
 *
 * Notification ids are intentionally dropped — they're device-local and get
 * rescheduled on restore, so they'd be meaningless (and misleading) in a file.
 */

import { AppSettings, DEFAULT_SETTINGS, TrackedItem } from '../types/item';
import { ReturnCase, WatchedProduct } from '../types/tracking';

export const BACKUP_VERSION = 1;

export type BackupItem = Omit<TrackedItem, 'notificationIds'>;
export type BackupReturn = Omit<ReturnCase, 'notificationIds'>;

export interface BoughtlyBackup {
  app: 'Boughtly';
  version: number;
  exportedAt: string;
  items: BackupItem[];
  watches: WatchedProduct[];
  returns: BackupReturn[];
  settings: AppSettings;
}

export function buildBackup(
  items: TrackedItem[],
  watches: WatchedProduct[],
  returns: ReturnCase[],
  settings: AppSettings
): BoughtlyBackup {
  return {
    app: 'Boughtly',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items: items.map(({ notificationIds, ...rest }) => rest),
    watches,
    returns: returns.map(({ notificationIds, ...rest }) => rest),
    settings,
  };
}

export function backupFileName(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `boughtly-backup-${y}-${m}-${d}.json`;
}

export type ParseResult =
  | { ok: true; backup: BoughtlyBackup }
  | { ok: false; error: string };

function looksLikeItem(x: unknown): x is BackupItem {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.itemName === 'string' &&
    typeof o.price === 'number' &&
    typeof o.purchaseDate === 'string'
  );
}

/**
 * Parse and validate a backup file's text. Tolerant of older exports (the very
 * first version only carried `items`), so restoring never throws — it just
 * fills missing collections with empty defaults.
 */
export function parseBackup(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'That file isn’t valid JSON.' };
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'That doesn’t look like a Boughtly backup.' };
  }
  const o = data as Record<string, unknown>;
  if (o.app !== 'Boughtly') {
    return { ok: false, error: 'That file isn’t a Boughtly backup.' };
  }
  if (!Array.isArray(o.items)) {
    return { ok: false, error: 'This backup is missing its items.' };
  }
  const items = (o.items as unknown[]).filter(looksLikeItem) as BackupItem[];
  const watches = Array.isArray(o.watches) ? (o.watches as WatchedProduct[]) : [];
  const returns = Array.isArray(o.returns) ? (o.returns as BackupReturn[]) : [];
  const settings =
    o.settings && typeof o.settings === 'object'
      ? { ...DEFAULT_SETTINGS, ...(o.settings as Partial<AppSettings>) }
      : DEFAULT_SETTINGS;

  return {
    ok: true,
    backup: {
      app: 'Boughtly',
      version: typeof o.version === 'number' ? o.version : 1,
      exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : new Date().toISOString(),
      items,
      watches,
      returns,
      settings,
    },
  };
}
