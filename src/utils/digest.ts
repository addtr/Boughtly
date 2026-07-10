/**
 * Pure logic for the Sunday week-ahead digest (scheduling lives in
 * notifications.ts). Split out so it can be unit-tested without native deps.
 */

import { TrackedItem } from '../types/item';
import { parseISODate } from './dates';

/** Next Sunday at the given local hour (a week out if that's already past). */
export function nextDigestDate(hour: number, now: Date = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 7);
  return d;
}

/** The digest body for the 7 days starting at `fireAt` — null when nothing's due. */
export function buildDigestBody(items: TrackedItem[], fireAt: Date): string | null {
  const startDay = new Date(fireAt.getFullYear(), fireAt.getMonth(), fireAt.getDate()).getTime();
  const endDay = startDay + 7 * 24 * 60 * 60 * 1000;
  const inWeek = (iso: string) => {
    const t = parseISODate(iso).getTime();
    return t >= startDay && t < endDay;
  };
  const returnsClosing = items.filter((i) => inWeek(i.returnDeadlineDate));
  const warrantiesEnding = items.filter((i) => inWeek(i.warrantyExpirationDate));
  const reminders = items.filter((i) => i.customReminder && inWeek(i.customReminder.date));
  const parts: string[] = [];
  if (returnsClosing.length > 0) {
    const extra = returnsClosing.length - 1;
    parts.push(
      `${returnsClosing.length} return window${returnsClosing.length === 1 ? '' : 's'} close${
        returnsClosing.length === 1 ? 's' : ''
      } (${returnsClosing[0].itemName}${extra > 0 ? ` +${extra} more` : ''})`
    );
  }
  if (warrantiesEnding.length > 0) {
    parts.push(
      `${warrantiesEnding.length} warrant${warrantiesEnding.length === 1 ? 'y' : 'ies'} end${
        warrantiesEnding.length === 1 ? 's' : ''
      }`
    );
  }
  if (reminders.length > 0) {
    parts.push(`${reminders.length} reminder${reminders.length === 1 ? '' : 's'} due`);
  }
  if (parts.length === 0) return null;
  return `This week: ${parts.join(' · ')}. Tap to plan your week.`;
}
