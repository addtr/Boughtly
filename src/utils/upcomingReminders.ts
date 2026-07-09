/**
 * Read the notifications that are actually scheduled on this phone, in a
 * shape screens can render. Shared by the home-screen card and the full
 * Upcoming Reminders screen.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export interface UpcomingReminder {
  id: string;
  title: string;
  body: string;
  /** When it fires; null for repeating interval reminders */
  fireAt: Date | null;
  /** For repeating reminders, the repeat interval in days */
  repeatDays: number | null;
}

/** Read the fire time out of the platform-specific trigger shape, defensively. */
function parseTrigger(trigger: unknown): { fireAt: Date | null; repeatDays: number | null } {
  const t = trigger as Record<string, any> | null;
  if (!t) return { fireAt: null, repeatDays: null };
  // Repeating interval (the price-check reminder)
  if (typeof t.seconds === 'number' && (t.repeats || t.type === 'timeInterval')) {
    return { fireAt: null, repeatDays: Math.round(t.seconds / 86400) };
  }
  // One-shot date triggers surface differently per platform/version
  const raw = t.value ?? t.date ?? t.timestamp;
  if (typeof raw === 'number') return { fireAt: new Date(raw), repeatDays: null };
  if (typeof raw === 'string') {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return { fireAt: d, repeatDays: null };
  }
  return { fireAt: null, repeatDays: null };
}

/** All scheduled reminders, soonest first (repeating ones last). */
export async function fetchUpcomingReminders(): Promise<UpcomingReminder[]> {
  if (Platform.OS === 'web') return [];
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const list: UpcomingReminder[] = scheduled.map((n) => {
      const { fireAt, repeatDays } = parseTrigger(n.trigger);
      return {
        id: n.identifier,
        title: n.content.title ?? 'Reminder',
        body: n.content.body ?? '',
        fireAt,
        repeatDays,
      };
    });
    list.sort((a, b) => {
      if (a.fireAt && b.fireAt) return a.fireAt.getTime() - b.fireAt.getTime();
      if (a.fireAt) return -1;
      if (b.fireAt) return 1;
      return 0;
    });
    return list;
  } catch {
    return [];
  }
}

export function formatFireAt(d: Date): string {
  return (
    d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
}
