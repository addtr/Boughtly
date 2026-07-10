/**
 * Home-inventory PDF for insurance: everything Boughtly already knows about
 * your stuff (names, stores, dates, prices, serials, receipt thumbnails) laid
 * out the way a renters/home-insurance claim or application wants it.
 * Generated fully on-device with expo-print, then handed to the share sheet.
 */

import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { AppSettings, TrackedItem } from '../types/item';
import { formatDate, formatPrice } from '../utils/dates';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface InventoryRow {
  name: string;
  store: string;
  purchaseDate: string; // already formatted for display
  price: number;
  serial?: string;
  /** data: URI thumbnail, when the receipt image could be read */
  imageDataUri?: string;
}

/** Pure HTML builder so layout/escaping/totals are unit-testable. */
export function buildInventoryHtml(
  rows: InventoryRow[],
  meta: { ownerName?: string; ownerEmail?: string; generatedOn: string }
): string {
  const total = rows.reduce((sum, r) => sum + r.price, 0);
  const owner = [meta.ownerName, meta.ownerEmail]
    .filter((v): v is string => !!v)
    .map(esc)
    .join(' · ');
  const bodyRows = rows
    .map(
      (r) => `<tr>
        <td class="img">${
          r.imageDataUri ? `<img src="${r.imageDataUri}" />` : '<div class="noimg">—</div>'
        }</td>
        <td><strong>${esc(r.name)}</strong>${
          r.serial ? `<div class="serial">SN ${esc(r.serial)}</div>` : ''
        }</td>
        <td>${esc(r.store)}</td>
        <td>${esc(r.purchaseDate)}</td>
        <td class="price">${esc(formatPrice(r.price))}</td>
      </tr>`
    )
    .join('\n');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #2B2E33; margin: 32px; }
  h1 { font-size: 22px; margin: 0 0 2px; color: #1F2A44; }
  .sub { color: #7A7F8A; font-size: 12px; margin-bottom: 4px; }
  .totals { font-size: 14px; margin: 14px 0 18px; }
  .totals strong { color: #1F2A44; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; color: #7A7F8A; font-weight: 600; padding: 6px 8px; border-bottom: 2px solid #1F2A44; }
  td { padding: 8px; border-bottom: 1px solid #E7E4DD; vertical-align: top; }
  td.img { width: 44px; }
  td.img img { width: 40px; height: 52px; object-fit: cover; border-radius: 4px; }
  .noimg { width: 40px; height: 52px; background: #F0EDE6; border-radius: 4px; text-align: center; line-height: 52px; color: #B9B4A9; }
  .serial { color: #7A7F8A; font-size: 11px; margin-top: 2px; }
  td.price { text-align: right; white-space: nowrap; font-weight: 600; }
  .foot { margin-top: 20px; font-size: 10px; color: #7A7F8A; }
</style>
</head>
<body>
  <h1>Home inventory</h1>
  ${owner ? `<div class="sub">${owner}</div>` : ''}
  <div class="sub">Generated ${esc(meta.generatedOn)} with Boughtly</div>
  <div class="totals">
    <strong>${rows.length}</strong> item${rows.length === 1 ? '' : 's'} ·
    total purchase value <strong>${esc(formatPrice(total))}</strong>
  </div>
  <table>
    <thead>
      <tr><th></th><th>Item</th><th>Bought at</th><th>Date</th><th style="text-align:right">Price</th></tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>
  <div class="foot">
    Prices are original purchase prices from stored receipts. Receipt photos and
    serial numbers for each item are kept in the Boughtly app.
  </div>
</body>
</html>`;
}

async function thumbDataUri(uri?: string | null): Promise<string | undefined> {
  if (!uri) return undefined;
  try {
    return `data:image/jpeg;base64,${await new File(uri).base64()}`;
  } catch {
    return undefined; // a missing photo never blocks the report
  }
}

/**
 * Build and share the PDF. Returns false where unsupported (web).
 * Most-expensive first — that's the order an insurer cares about.
 */
export async function exportInventoryReport(
  items: TrackedItem[],
  settings: AppSettings
): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const sorted = [...items].sort((a, b) => b.price - a.price);
  const rows: InventoryRow[] = [];
  for (const item of sorted) {
    rows.push({
      name: item.itemName,
      store: item.storeName,
      purchaseDate: formatDate(item.purchaseDate),
      price: item.price,
      serial: item.serialNumber,
      imageDataUri: await thumbDataUri(item.receiptThumbUri ?? item.receiptImageUri),
    });
  }
  const html = buildInventoryHtml(rows, {
    ownerName: settings.accountName || undefined,
    ownerEmail: settings.accountEmail || undefined,
    generatedOn: formatDate(new Date().toISOString().slice(0, 10)),
  });
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Home inventory report',
      UTI: 'com.adobe.pdf',
    });
  }
  return true;
}
