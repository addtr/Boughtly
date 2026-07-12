import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  cancelItemReminders,
  scheduleItemReminders,
  scheduleRefundFollowUp,
  scheduleSubscriptionReminder,
  sendRecallNotification,
  syncPriceCheckReminder,
  syncWeeklyDigest,
} from '../notifications/notifications';
import { BoughtlyBackup } from '../services/backup';
import { makeReceiptThumb } from '../services/imageStore';
import { checkAllItemsForRecalls, checkItemForRecalls } from '../services/recalls';
import {
  AppSettings,
  DEFAULT_SETTINGS,
  PaymentMethod,
  RecallAlert,
  TrackedItem,
} from '../types/item';
import {
  BILLING_CYCLE_OPTIONS,
  BillingCycle,
  PricePoint,
  RETURN_STEPS,
  ReturnCase,
  Subscription,
  WatchedProduct,
} from '../types/tracking';
import { Platform } from 'react-native';
import { addDays, setActiveCurrency, toISODate } from '../utils/dates';

const ITEMS_KEY = 'boughtly.items.v1';
const SETTINGS_KEY = 'boughtly.settings.v1';
const WATCHES_KEY = 'boughtly.watches.v1';
const RETURNS_KEY = 'boughtly.returns.v1';
const RECALLS_KEY = 'boughtly.recalls.v1';
const SUBS_KEY = 'boughtly.subscriptions.v1';

/** Recall sweeps run at most this often (per device). */
const RECALL_CHECK_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

export interface NewItemInput {
  itemName: string;
  storeName: string;
  price: number;
  purchaseDate: string;
  receiptImageUri: string | null;
  receiptImageUris?: string[];
  receiptThumbUri?: string;
  warrantyLengthDays: number;
  returnWindowDays: number;
  notes?: string;
  isGift?: boolean;
  tags?: string[];
  serialNumber?: string;
  productPhotos?: string[];
  protectionPlan?: { provider: string; lengthDays: number; contact?: string };
  paymentMethod?: PaymentMethod;
  documents?: { name: string; uri: string }[];
  lineItems?: { name: string; price: number }[];
}

export interface NewWatchInput {
  name: string;
  store: string;
  url?: string;
  targetPrice?: number;
  firstPrice: number;
}

export interface NewSubscriptionInput {
  name: string;
  cost: number;
  cycle: BillingCycle;
  nextRenewalDate: string;
  category?: string;
  notes?: string;
}

interface AppState {
  items: TrackedItem[];
  watches: WatchedProduct[];
  returns: ReturnCase[];
  settings: AppSettings;
  isLoaded: boolean;
  addItem: (input: NewItemInput) => Promise<TrackedItem>;
  updateItem: (id: string, input: NewItemInput) => Promise<void>;
  /** Small targeted change (custom reminder, flags) — reschedules reminders. */
  patchItem: (
    id: string,
    patch: Partial<Pick<TrackedItem, 'customReminder' | 'productRegistered'>>
  ) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  /** The item most recently deleted, still restorable for a few seconds */
  recentlyDeleted: TrackedItem | null;
  undoDelete: () => Promise<void>;
  deleteAllItems: () => Promise<void>;
  restoreBackup: (backup: BoughtlyBackup) => Promise<{ items: number; watches: number; returns: number }>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  // Recall alerts
  recallAlerts: RecallAlert[];
  /** "Not my product" — hides the alert and never re-alerts for this pair */
  dismissRecallAlert: (id: string) => Promise<void>;
  /** On-demand CPSC check for one item; returns every current match for it */
  checkItemRecallsNow: (item: TrackedItem) => Promise<RecallAlert[]>;
  // Subscriptions
  subscriptions: Subscription[];
  addSubscription: (input: NewSubscriptionInput) => Promise<Subscription>;
  updateSubscription: (id: string, input: NewSubscriptionInput) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  // Price watching
  addWatch: (input: NewWatchInput) => Promise<WatchedProduct>;
  logWatchPrice: (id: string, point: PricePoint) => Promise<void>;
  updateWatch: (
    id: string,
    patch: Partial<Pick<WatchedProduct, 'name' | 'store' | 'url' | 'targetPrice'>>
  ) => Promise<void>;
  deleteWatch: (id: string) => Promise<void>;
  // Returns
  startReturn: (
    item: TrackedItem,
    selection?: { items: { name: string; price: number }[]; refundAmount: number }
  ) => Promise<ReturnCase>;
  updateReturn: (
    id: string,
    patch: Partial<Pick<ReturnCase, 'method' | 'trackingNumber' | 'notes' | 'refundAmount' | 'storeName'>>
  ) => Promise<void>;
  setReturnStatus: (id: string, status: ReturnCase['status']) => Promise<void>;
  deleteReturn: (id: string) => Promise<void>;
}

const AppStateContext = createContext<AppState | null>(null);

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Advance a subscription's next-renewal date past today by whole billing cycles. */
function rollRenewalForward(sub: Subscription, today = new Date()): Subscription {
  const cycleDays = BILLING_CYCLE_OPTIONS.find((c) => c.key === sub.cycle)?.days ?? 30;
  let next = sub.nextRenewalDate;
  let guard = 0;
  while (new Date(next).getTime() < today.getTime() && guard < 120) {
    next = addDays(next, cycleDays);
    guard += 1;
  }
  return next === sub.nextRenewalDate ? sub : { ...sub, nextRenewalDate: next };
}

function withCalculatedDates(input: NewItemInput) {
  return {
    ...input,
    warrantyExpirationDate: addDays(input.purchaseDate, input.warrantyLengthDays),
    returnDeadlineDate: addDays(input.purchaseDate, input.returnWindowDays),
    protectionPlan: input.protectionPlan
      ? {
          ...input.protectionPlan,
          endDate: addDays(input.purchaseDate, input.protectionPlan.lengthDays),
        }
      : undefined,
  };
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [watches, setWatches] = useState<WatchedProduct[]>([]);
  const [returns, setReturns] = useState<ReturnCase[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [recallAlerts, setRecallAlerts] = useState<RecallAlert[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  // Always-current snapshots for async callbacks
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const recallAlertsRef = useRef(recallAlerts);
  recallAlertsRef.current = recallAlerts;
  const lastRecallCheckRef = useRef<string>('');
  const watchesRef = useRef(watches);
  watchesRef.current = watches;
  const returnsRef = useRef(returns);
  returnsRef.current = returns;
  const subscriptionsRef = useRef(subscriptions);
  subscriptionsRef.current = subscriptions;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    (async () => {
      try {
        const [rawItems, rawSettings, rawWatches, rawReturns, rawRecalls, rawSubs] =
          await Promise.all([
            AsyncStorage.getItem(ITEMS_KEY),
            AsyncStorage.getItem(SETTINGS_KEY),
            AsyncStorage.getItem(WATCHES_KEY),
            AsyncStorage.getItem(RETURNS_KEY),
            AsyncStorage.getItem(RECALLS_KEY),
            AsyncStorage.getItem(SUBS_KEY),
          ]);
        if (rawItems) setItems(JSON.parse(rawItems));
        if (rawSubs) setSubscriptions(JSON.parse(rawSubs));
        if (rawRecalls) {
          const parsed = JSON.parse(rawRecalls);
          setRecallAlerts(parsed.alerts ?? []);
          lastRecallCheckRef.current = parsed.lastCheckedAt ?? '';
        }
        if (rawSettings) {
          const loaded = { ...DEFAULT_SETTINGS, ...JSON.parse(rawSettings) };
          setSettings(loaded);
          setActiveCurrency(loaded.currencyCode);
        }
        if (rawWatches) setWatches(JSON.parse(rawWatches));
        if (rawReturns) setReturns(JSON.parse(rawReturns));
      } catch (e) {
        console.warn('Failed to load saved data', e);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const persistItems = useCallback(async (next: TrackedItem[]) => {
    setItems(next);
    await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(next));
    // Items changed → the Sunday week-ahead digest needs rebuilding
    void syncWeeklyDigest(next, settingsRef.current).catch(() => {});
  }, []);

  // Reschedule every item's reminders once per launch. Scheduled local
  // notifications can be lost on reboot, OS update, reinstall, or restore —
  // this makes sure they always exist for what's currently tracked.
  const resyncedRef = useRef(false);
  useEffect(() => {
    if (!isLoaded || resyncedRef.current || Platform.OS === 'web') return;
    resyncedRef.current = true;
    (async () => {
      const current = itemsRef.current;
      if (current.length === 0) return;
      const updated: TrackedItem[] = [];
      for (const item of current) {
        await cancelItemReminders(item.notificationIds);
        const notificationIds = await scheduleItemReminders(item, settingsRef.current);
        // Backfill a list thumbnail for items saved before thumbnails existed
        // (best-effort — a missing/odd photo keeps rendering full-size).
        let receiptThumbUri = item.receiptThumbUri;
        if (item.receiptImageUri && !receiptThumbUri) {
          receiptThumbUri = (await makeReceiptThumb(item.receiptImageUri)) ?? undefined;
        }
        updated.push({ ...item, notificationIds, receiptThumbUri });
      }
      setItems(updated);
      await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(updated));
      await syncWeeklyDigest(updated, settingsRef.current);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const persistRecalls = useCallback(async (alerts: RecallAlert[]) => {
    setRecallAlerts(alerts);
    await AsyncStorage.setItem(
      RECALLS_KEY,
      JSON.stringify({ alerts, lastCheckedAt: lastRecallCheckRef.current })
    );
  }, []);

  // Recall sweep: check tracked items against new CPSC recalls at most every
  // few days. Silent and best-effort — no network, no problem, try next time.
  const recallSweepRef = useRef(false);
  useEffect(() => {
    if (!isLoaded || recallSweepRef.current) return;
    const last = lastRecallCheckRef.current ? Date.parse(lastRecallCheckRef.current) : 0;
    if (Date.now() - last < RECALL_CHECK_INTERVAL_MS) return;
    if (itemsRef.current.length === 0) return;
    recallSweepRef.current = true;
    (async () => {
      const fresh = await checkAllItemsForRecalls(itemsRef.current, recallAlertsRef.current);
      lastRecallCheckRef.current = new Date().toISOString();
      await persistRecalls([...recallAlertsRef.current, ...fresh]);
      if (fresh.length > 0) {
        await sendRecallNotification(fresh[0].itemName, fresh.length - 1);
      }
    })().catch(() => {});
  }, [isLoaded, persistRecalls]);

  // Subscription resync: roll any past renewal dates forward to the next cycle
  // and (re)schedule the renewal reminders once per launch.
  const subSyncRef = useRef(false);
  useEffect(() => {
    if (!isLoaded || subSyncRef.current || Platform.OS === 'web') return;
    subSyncRef.current = true;
    const current = subscriptionsRef.current;
    if (current.length === 0) return;
    (async () => {
      const updated: Subscription[] = [];
      for (const sub of current) {
        const rolled = rollRenewalForward(sub);
        await cancelItemReminders(rolled.notificationIds);
        const notificationIds = await scheduleSubscriptionReminder(rolled, settingsRef.current);
        updated.push({ ...rolled, notificationIds });
      }
      await persistSubscriptions(updated);
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const dismissRecallAlert = useCallback(
    async (id: string) => {
      await persistRecalls(
        recallAlertsRef.current.map((a) => (a.id === id ? { ...a, dismissed: true } : a))
      );
    },
    [persistRecalls]
  );

  const checkItemRecallsNow = useCallback(
    async (item: TrackedItem) => {
      const found = await checkItemForRecalls(item);
      const knownIds = new Set(recallAlertsRef.current.map((a) => a.id));
      const fresh = found.filter((a) => !knownIds.has(a.id));
      const merged = fresh.length > 0 ? [...recallAlertsRef.current, ...fresh] : recallAlertsRef.current;
      if (fresh.length > 0) await persistRecalls(merged);
      return merged.filter((a) => a.itemId === item.id);
    },
    [persistRecalls]
  );

  const persistWatches = useCallback(async (next: WatchedProduct[]) => {
    setWatches(next);
    await AsyncStorage.setItem(WATCHES_KEY, JSON.stringify(next));
  }, []);

  const persistReturns = useCallback(async (next: ReturnCase[]) => {
    setReturns(next);
    await AsyncStorage.setItem(RETURNS_KEY, JSON.stringify(next));
  }, []);

  const persistSubscriptions = useCallback(async (next: Subscription[]) => {
    setSubscriptions(next);
    await AsyncStorage.setItem(SUBS_KEY, JSON.stringify(next));
  }, []);

  const addSubscription = useCallback(
    async (input: NewSubscriptionInput) => {
      const sub: Subscription = {
        ...input,
        id: makeId(),
        notificationIds: [],
        createdAt: new Date().toISOString(),
      };
      sub.notificationIds = await scheduleSubscriptionReminder(sub, settingsRef.current);
      await persistSubscriptions([sub, ...subscriptionsRef.current]);
      return sub;
    },
    [persistSubscriptions]
  );

  const updateSubscription = useCallback(
    async (id: string, input: NewSubscriptionInput) => {
      const existing = subscriptionsRef.current.find((s) => s.id === id);
      if (!existing) return;
      await cancelItemReminders(existing.notificationIds);
      const updated: Subscription = { ...existing, ...input };
      updated.notificationIds = await scheduleSubscriptionReminder(updated, settingsRef.current);
      await persistSubscriptions(
        subscriptionsRef.current.map((s) => (s.id === id ? updated : s))
      );
    },
    [persistSubscriptions]
  );

  const deleteSubscription = useCallback(
    async (id: string) => {
      const existing = subscriptionsRef.current.find((s) => s.id === id);
      if (existing) await cancelItemReminders(existing.notificationIds);
      await persistSubscriptions(subscriptionsRef.current.filter((s) => s.id !== id));
    },
    [persistSubscriptions]
  );

  const addItem = useCallback(
    async (input: NewItemInput) => {
      const base = withCalculatedDates(input);
      const item: TrackedItem = {
        ...base,
        id: makeId(),
        notificationIds: [],
        createdAt: new Date().toISOString(),
      };
      item.notificationIds = await scheduleItemReminders(item, settingsRef.current);
      await persistItems([item, ...itemsRef.current]);
      return item;
    },
    [persistItems]
  );

  const updateItem = useCallback(
    async (id: string, input: NewItemInput) => {
      const existing = itemsRef.current.find((i) => i.id === id);
      if (!existing) return;
      await cancelItemReminders(existing.notificationIds);
      const updated: TrackedItem = {
        ...existing,
        ...withCalculatedDates(input),
        // Preserve the receipt breakdown if the edit form didn't supply one
        lineItems: input.lineItems ?? existing.lineItems,
      };
      updated.notificationIds = await scheduleItemReminders(updated, settingsRef.current);
      await persistItems(itemsRef.current.map((i) => (i.id === id ? updated : i)));
    },
    [persistItems]
  );

  const patchItem = useCallback(
    async (
      id: string,
      patch: Partial<Pick<TrackedItem, 'customReminder' | 'productRegistered'>>
    ) => {
      const existing = itemsRef.current.find((i) => i.id === id);
      if (!existing) return;
      await cancelItemReminders(existing.notificationIds);
      const updated: TrackedItem = { ...existing, ...patch };
      updated.notificationIds = await scheduleItemReminders(updated, settingsRef.current);
      await persistItems(itemsRef.current.map((i) => (i.id === id ? updated : i)));
    },
    [persistItems]
  );

  // Soft delete: the removed item is held for a short window so an accidental
  // "Stop tracking" can be undone from the dashboard.
  const [recentlyDeleted, setRecentlyDeleted] = useState<TrackedItem | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deleteItem = useCallback(
    async (id: string) => {
      const existing = itemsRef.current.find((i) => i.id === id);
      if (existing) await cancelItemReminders(existing.notificationIds);
      await persistItems(itemsRef.current.filter((i) => i.id !== id));
      // Recall alerts for a gone item are just noise
      if (recallAlertsRef.current.some((a) => a.itemId === id)) {
        await persistRecalls(recallAlertsRef.current.filter((a) => a.itemId !== id));
      }
      if (existing) {
        setRecentlyDeleted(existing);
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        undoTimerRef.current = setTimeout(() => setRecentlyDeleted(null), 8000);
      }
    },
    [persistItems, persistRecalls]
  );

  const undoDelete = useCallback(async () => {
    const item = recentlyDeleted;
    if (!item) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setRecentlyDeleted(null);
    const restored: TrackedItem = { ...item, notificationIds: [] };
    restored.notificationIds = await scheduleItemReminders(restored, settingsRef.current);
    await persistItems([restored, ...itemsRef.current]);
  }, [recentlyDeleted, persistItems]);

  const deleteAllItems = useCallback(async () => {
    for (const item of itemsRef.current) {
      await cancelItemReminders(item.notificationIds);
    }
    await persistItems([]);
    await persistRecalls([]);
  }, [persistItems, persistRecalls]);

  /**
   * Replace all local data with a backup. Existing reminders are cancelled and
   * fresh ones are scheduled for the restored items, so notifications stay
   * consistent with what's now on the device.
   */
  const restoreBackup = useCallback(
    async (backup: BoughtlyBackup) => {
      // Clear every reminder tied to current items and returns.
      for (const item of itemsRef.current) await cancelItemReminders(item.notificationIds);
      for (const ret of returnsRef.current) await cancelItemReminders(ret.notificationIds);

      const nextSettings = { ...DEFAULT_SETTINGS, ...backup.settings };
      setSettings(nextSettings);
      settingsRef.current = nextSettings; // restored reminders use these below
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));

      // Reschedule reminders for each restored item under the restored settings.
      const restoredItems: TrackedItem[] = [];
      for (const it of backup.items) {
        const item: TrackedItem = { ...it, notificationIds: [] };
        item.notificationIds = await scheduleItemReminders(item, nextSettings);
        restoredItems.push(item);
      }
      const restoredReturns: ReturnCase[] = backup.returns.map((r) => ({
        ...r,
        notificationIds: [],
      }));

      await persistItems(restoredItems);
      await persistWatches(backup.watches);
      await persistReturns(restoredReturns);
      await syncPriceCheckReminder(nextSettings, backup.watches.length);

      return {
        items: restoredItems.length,
        watches: backup.watches.length,
        returns: restoredReturns.length,
      };
    },
    [persistItems, persistWatches, persistReturns]
  );

  /* ---------- Price watching ---------- */

  const addWatch = useCallback(
    async (input: NewWatchInput) => {
      const watch: WatchedProduct = {
        id: makeId(),
        name: input.name,
        store: input.store,
        url: input.url,
        targetPrice: input.targetPrice,
        priceLog: [{ date: toISODate(new Date()), price: input.firstPrice }],
        createdAt: new Date().toISOString(),
      };
      const nextWatches = [watch, ...watchesRef.current];
      await persistWatches(nextWatches);
      await syncPriceCheckReminder(settingsRef.current, nextWatches.length);
      return watch;
    },
    [persistWatches]
  );

  const logWatchPrice = useCallback(
    async (id: string, point: PricePoint) => {
      await persistWatches(
        watchesRef.current.map((w) =>
          w.id === id ? { ...w, priceLog: [...w.priceLog, point] } : w
        )
      );
    },
    [persistWatches]
  );

  const updateWatch = useCallback(
    async (
      id: string,
      patch: Partial<Pick<WatchedProduct, 'name' | 'store' | 'url' | 'targetPrice'>>
    ) => {
      await persistWatches(
        watchesRef.current.map((w) => (w.id === id ? { ...w, ...patch } : w))
      );
    },
    [persistWatches]
  );

  const deleteWatch = useCallback(
    async (id: string) => {
      const nextWatches = watchesRef.current.filter((w) => w.id !== id);
      await persistWatches(nextWatches);
      await syncPriceCheckReminder(settingsRef.current, nextWatches.length);
    },
    [persistWatches]
  );

  /* ---------- Returns ---------- */

  const startReturn = useCallback(
    async (
      item: TrackedItem,
      selection?: { items: { name: string; price: number }[]; refundAmount: number }
    ) => {
      const existing = returnsRef.current.find(
        (r) => r.itemId === item.id && r.status !== 'refunded'
      );
      if (existing) return existing;
      const now = new Date().toISOString();
      // A partial return names the selected items; a whole-purchase return
      // keeps the item name and full price.
      const isPartial =
        !!selection &&
        selection.items.length > 0 &&
        selection.items.length < (item.lineItems?.length ?? 1);
      const ret: ReturnCase = {
        id: makeId(),
        itemId: item.id,
        itemName:
          isPartial && selection!.items.length === 1
            ? selection!.items[0].name
            : item.itemName,
        storeName: item.storeName,
        // Partial → sum of chosen items; whole purchase → the real total paid.
        refundAmount: isPartial ? selection!.refundAmount : item.price,
        returnedItems: isPartial ? selection!.items : undefined,
        method: null,
        status: 'started',
        startedAt: now,
        updatedAt: now,
        notificationIds: [],
      };
      await persistReturns([ret, ...returnsRef.current]);
      return ret;
    },
    [persistReturns]
  );

  const updateReturn = useCallback(
    async (
      id: string,
      patch: Partial<Pick<ReturnCase, 'method' | 'trackingNumber' | 'notes' | 'refundAmount' | 'storeName'>>
    ) => {
      await persistReturns(
        returnsRef.current.map((r) =>
          r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
        )
      );
    },
    [persistReturns]
  );

  const setReturnStatus = useCallback(
    async (id: string, status: ReturnCase['status']) => {
      const existing = returnsRef.current.find((r) => r.id === id);
      if (!existing || existing.status === status) return;

      // Reminder lifecycle: nudge in 7 days once we're waiting on money;
      // clear the nudge once refunded (or when stepping back).
      await cancelItemReminders(existing.notificationIds);
      let notificationIds: string[] = [];
      if (status === 'refund_pending' || status === 'sent') {
        notificationIds = await scheduleRefundFollowUp(
          id,
          existing.itemName,
          existing.storeName,
          settingsRef.current.notificationsEnabled,
          settingsRef.current.reminderHour
        );
      }
      await persistReturns(
        returnsRef.current.map((r) =>
          r.id === id
            ? { ...r, status, notificationIds, updatedAt: new Date().toISOString() }
            : r
        )
      );
    },
    [persistReturns]
  );

  const deleteReturn = useCallback(
    async (id: string) => {
      const existing = returnsRef.current.find((r) => r.id === id);
      if (existing) await cancelItemReminders(existing.notificationIds);
      await persistReturns(returnsRef.current.filter((r) => r.id !== id));
    },
    [persistReturns]
  );

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const prev = settingsRef.current;
      const next = { ...prev, ...patch };
      setSettings(next);
      settingsRef.current = next; // async work below must see the new settings
      if (next.currencyCode !== prev.currencyCode) setActiveCurrency(next.currencyCode);
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));

      if (
        next.weeklyDigestEnabled !== prev.weeklyDigestEnabled ||
        next.notificationsEnabled !== prev.notificationsEnabled ||
        next.reminderHour !== prev.reminderHour
      ) {
        await syncWeeklyDigest(itemsRef.current, next);
      }

      // Keep the repeating price-check reminder in sync with its settings
      if (
        next.priceCheckCadence !== prev.priceCheckCadence ||
        next.notificationsEnabled !== prev.notificationsEnabled
      ) {
        await syncPriceCheckReminder(next, watchesRef.current.length);
      }

      // Reschedule item reminders only when a notification preference changed
      const affectsReminders =
        next.notificationsEnabled !== prev.notificationsEnabled ||
        next.returnReminderDays !== prev.returnReminderDays ||
        next.warrantyReminderDays !== prev.warrantyReminderDays ||
        next.reminderHour !== prev.reminderHour ||
        next.priceDropRemindersEnabled !== prev.priceDropRemindersEnabled ||
        next.priceDropCadenceDays !== prev.priceDropCadenceDays ||
        next.priceDropLeadDays !== prev.priceDropLeadDays;
      if (!affectsReminders) return;

      const rescheduled: TrackedItem[] = [];
      for (const item of itemsRef.current) {
        await cancelItemReminders(item.notificationIds);
        const notificationIds = await scheduleItemReminders(item, next);
        rescheduled.push({ ...item, notificationIds });
      }
      await persistItems(rescheduled);

      // Subscriptions share the reminder hour / notifications toggle, plus
      // their own "cancel by" lead time.
      if (
        next.notificationsEnabled !== prev.notificationsEnabled ||
        next.reminderHour !== prev.reminderHour ||
        next.subscriptionReminderDays !== prev.subscriptionReminderDays
      ) {
        const resubbed: Subscription[] = [];
        for (const sub of subscriptionsRef.current) {
          await cancelItemReminders(sub.notificationIds);
          const notificationIds = await scheduleSubscriptionReminder(sub, next);
          resubbed.push({ ...sub, notificationIds });
        }
        await persistSubscriptions(resubbed);
      }
    },
    [persistItems, persistSubscriptions]
  );

  const value = useMemo(
    () => ({
      items,
      watches,
      returns,
      settings,
      isLoaded,
      addItem,
      updateItem,
      patchItem,
      deleteItem,
      recentlyDeleted,
      undoDelete,
      deleteAllItems,
      restoreBackup,
      updateSettings,
      recallAlerts,
      dismissRecallAlert,
      checkItemRecallsNow,
      subscriptions,
      addSubscription,
      updateSubscription,
      deleteSubscription,
      addWatch,
      logWatchPrice,
      updateWatch,
      deleteWatch,
      startReturn,
      updateReturn,
      setReturnStatus,
      deleteReturn,
    }),
    [
      items,
      watches,
      returns,
      settings,
      isLoaded,
      addItem,
      updateItem,
      patchItem,
      deleteItem,
      recentlyDeleted,
      undoDelete,
      deleteAllItems,
      restoreBackup,
      updateSettings,
      recallAlerts,
      dismissRecallAlert,
      checkItemRecallsNow,
      subscriptions,
      addSubscription,
      updateSubscription,
      deleteSubscription,
      addWatch,
      logWatchPrice,
      updateWatch,
      deleteWatch,
      startReturn,
      updateReturn,
      setReturnStatus,
      deleteReturn,
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
