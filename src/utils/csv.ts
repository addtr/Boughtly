/**
 * Spreadsheet export. RFC-4180-style escaping: fields containing commas,
 * quotes, or newlines are quoted, with quotes doubled.
 */

import { TrackedItem } from '../types/item';

function escapeField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function row(fields: (string | number | undefined | null)[]): string {
  return fields
    .map((f) => escapeField(f === undefined || f === null ? '' : String(f)))
    .join(',');
}

const HEADERS = [
  'Item',
  'Store',
  'Price',
  'Purchase date',
  'Return deadline',
  'Warranty ends',
  'Serial number',
  'Tags',
  'Gift',
  'Protection plan',
  'Plan ends',
  'Notes',
];

export function itemsToCsv(items: TrackedItem[]): string {
  const lines = [row(HEADERS)];
  for (const it of items) {
    lines.push(
      row([
        it.itemName,
        it.storeName,
        it.price,
        it.purchaseDate,
        it.returnDeadlineDate,
        it.warrantyExpirationDate,
        it.serialNumber,
        (it.tags ?? []).join('; '),
        it.isGift ? 'yes' : '',
        it.protectionPlan?.provider,
        it.protectionPlan?.endDate,
        it.notes,
      ])
    );
  }
  return lines.join('\r\n') + '\r\n';
}

export function csvFileName(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `boughtly-items-${y}-${m}-${d}.csv`;
}
