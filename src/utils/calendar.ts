/**
 * Add a deadline to the device calendar. Notifications are easy to miss;
 * a calendar entry meets people where they already look.
 */

import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import { parseISODate } from './dates';

export type CalendarResult = 'created' | 'denied' | 'unavailable' | 'error';

/** Find a calendar we can write to (default on iOS; first modifiable on Android). */
async function getWritableCalendarId(): Promise<string | null> {
  if (Platform.OS === 'ios') {
    try {
      const def = await Calendar.getDefaultCalendarAsync();
      if (def?.id) return def.id;
    } catch {
      // fall through to scanning all calendars
    }
  }
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find((c) => c.allowsModifications);
  return writable?.id ?? null;
}

/**
 * Create an all-day event on `deadlineISO` with a heads-up alarm the morning of.
 * Returns a status the UI can message from.
 */
export async function addDeadlineToCalendar(
  title: string,
  deadlineISO: string,
  notes?: string
): Promise<CalendarResult> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    const perm = await Calendar.requestCalendarPermissionsAsync();
    if (perm.status !== 'granted') return 'denied';

    const calendarId = await getWritableCalendarId();
    if (!calendarId) return 'unavailable';

    const start = parseISODate(deadlineISO);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime());
    end.setHours(10, 0, 0, 0);

    await Calendar.createEventAsync(calendarId, {
      title,
      startDate: start,
      endDate: end,
      notes,
      alarms: [{ relativeOffset: 0 }],
      timeZone: undefined,
    });
    return 'created';
  } catch {
    return 'error';
  }
}
