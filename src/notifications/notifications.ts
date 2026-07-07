import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { AppSettings, PRICE_CHECK_OPTIONS, TrackedItem } from '../types/item';
import { parseISODate } from '../utils/dates';

const PRICE_CHECK_NOTIF_KEY = 'boughtly.priceCheckNotif.v1';

/** Hour of day (local) reminders fire at. */
const REMINDER_HOUR = 9;

// expo-notifications doesn't support web; all entry points below no-op there.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureNotificationSetup(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
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

async function scheduleAt(
  title: string,
  body: string,
  date: Date,
  itemId: string
): Promise<string | null> {
  if (date.getTime() <= Date.now()) return null; // never schedule in the past
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true, data: { itemId } },
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
    reminderDate(item.returnDeadlineDate, settings.returnReminderDays),
    item.id
  );
  if (returnId) ids.push(returnId);

  const warrantyId = await scheduleAt(
    `Warranty ending soon`,
    `The warranty on ${item.itemName} from ${item.storeName} expires in ${settings.warrantyReminderDays} days.`,
    reminderDate(item.warrantyExpirationDate, settings.warrantyReminderDays),
    item.id
  );
  if (warrantyId) ids.push(warrantyId);

  return ids;
}

/**
 * Follow-up nudge for a return that's waiting on a refund: fires 7 days out
 * so unrefunded money never quietly slips through the cracks.
 */
export async function scheduleRefundFollowUp(
  returnId: string,
  itemName: string,
  storeName: string,
  enabled: boolean
): Promise<string[]> {
  if (!enabled || Platform.OS === 'web') return [];
  const granted = await ensureNotificationSetup();
  if (!granted) return [];
  const fireAt = new Date();
  fireAt.setDate(fireAt.getDate() + 7);
  fireAt.setHours(REMINDER_HOUR, 0, 0, 0);
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Refund still pending?',
      body: `It's been a week since ${itemName} went back to ${storeName}. Check that the money landed.`,
      sound: true,
      data: { returnId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
      channelId: 'deadlines',
    },
  });
  return [id];
}

/**
 * Repeating "price-check day" reminder. Called whenever the cadence setting,
 * the notifications toggle, or the watchlist changes — cancels the previous
 * schedule and sets up the new one, so exactly one reminder ever exists.
 */
export async function syncPriceCheckReminder(
  settings: AppSettings,
  watchCount: number
): Promise<void> {
  if (Platform.OS === 'web') return;
  // Clear whatever was scheduled before
  const prevId = await AsyncStorage.getItem(PRICE_CHECK_NOTIF_KEY);
  if (prevId) {
    await Notifications.cancelScheduledNotificationAsync(prevId).catch(() => {});
    await AsyncStorage.removeItem(PRICE_CHECK_NOTIF_KEY);
  }

  const option = PRICE_CHECK_OPTIONS.find((o) => o.key === settings.priceCheckCadence);
  if (
    !settings.notificationsEnabled ||
    !option ||
    option.days === 0 ||
    watchCount === 0
  ) {
    return;
  }
  const granted = await ensureNotificationSetup();
  if (!granted) return;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Price-check day',
      body: `Time to check prices on the ${watchCount} item${
        watchCount === 1 ? '' : 's'
      } you're watching — tap to scan for deals.`,
      sound: true,
      data: { openTab: 'watch' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: option.days * 24 * 60 * 60,
      repeats: true,
      channelId: 'deadlines',
    },
  });
  await AsyncStorage.setItem(PRICE_CHECK_NOTIF_KEY, id);
}

export async function cancelItemReminders(notificationIds: string[]): Promise<void> {
  if (Platform.OS === 'web') return;
  await Promise.all(
    notificationIds.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    )
  );
}
