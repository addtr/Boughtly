import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { AppSettings, TrackedItem } from '../types/item';
import { parseISODate } from '../utils/dates';

/** Hour of day (local) reminders fire at. */
const REMINDER_HOUR = 9;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationSetup(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('deadlines', {
      name: 'Deadline reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function reminderDate(deadlineISO: string, daysBefore: number): Date {
  const date = parseISODate(deadlineISO);
  date.setDate(date.getDate() - daysBefore);
  date.setHours(REMINDER_HOUR, 0, 0, 0);
  return date;
}

async function scheduleAt(title: string, body: string, date: Date): Promise<string | null> {
  if (date.getTime() <= Date.now()) return null; // never schedule in the past
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: 'deadlines',
    },
  });
}

/**
 * Schedules the two reminders for an item (return window closing, warranty
 * expiring) and returns the notification ids so they can be cancelled later.
 */
export async function scheduleItemReminders(
  item: TrackedItem,
  settings: AppSettings
): Promise<string[]> {
  if (!settings.notificationsEnabled) return [];
  const granted = await ensureNotificationSetup();
  if (!granted) return [];

  const ids: string[] = [];

  const returnId = await scheduleAt(
    `${settings.returnReminderDays} days left to return this`,
    `Your return window for ${item.itemName} from ${item.storeName} closes soon.`,
    reminderDate(item.returnDeadlineDate, settings.returnReminderDays)
  );
  if (returnId) ids.push(returnId);

  const warrantyId = await scheduleAt(
    `Warranty ending soon`,
    `The warranty on ${item.itemName} from ${item.storeName} expires in ${settings.warrantyReminderDays} days.`,
    reminderDate(item.warrantyExpirationDate, settings.warrantyReminderDays)
  );
  if (warrantyId) ids.push(warrantyId);

  return ids;
}

export async function cancelItemReminders(notificationIds: string[]): Promise<void> {
  await Promise.all(
    notificationIds.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    )
  );
}
