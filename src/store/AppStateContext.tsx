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
  syncPriceCheckReminder,
} from '../notifications/notifications';
import { BoughtlyBackup } from '../services/backup';
import { AppSettings, DEFAULT_SETTINGS, TrackedItem } from '../types/item';
import {
  PricePoint,
  RETURN_STEPS,
  ReturnCase,
  WatchedProduct,
} from '../types/tracking';
import { Platform } from 'react-native';
import { addDays, setActiveCurrency, toISODate } from '../utils/dates';

const ITEMS_KEY = 'boughtly.items.v1';
const SETTINGS_KEY = 'boughtly.settings.v1';
const WATCHES_KEY = 'boughtly.watches.v1';
const RETURNS_KEY = 'boughtly.returns.v1';

export interface NewItemInput {
  itemName: string;
  storeName: string;
  price: number;
  purchaseDate: string;
  receiptImageUri: string | null;
  warrantyLengthDays: number;
  returnWindowDays: number;
  notes?: string;
  isGift?: boolean;
  tags?: string[];
  serialNumber?: string;
  productPhotos?: string[];
  protectionPlan?: { provider: string; lengthDays: number; contact?: string };
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
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  // Always-current snapshots for async callbacks
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const watchesRef = useRef(watches);
  watchesRef.current = watches;
  const returnsRef = useRef(returns);
  returnsRef.current = returns;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    (async () => {
      try {
        const [rawItems, rawSettings, rawWatches, rawReturns] = await Promise.all([
          AsyncStorage.getItem(ITEMS_KEY),
          AsyncStorage.getItem(SETTINGS_KEY),
          AsyncStorage.getItem(WATCHES_KEY),
          AsyncStorage.getItem(RETURNS_KEY),
        ]);
        if (rawItems) setItems(JSON.parse(rawItems));
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
        updated.push({ ...item, notificationIds });
      }
      setItems(updated);
      await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(updated));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const persistWatches = useCallback(async (next: WatchedProduct[]) => {
    setWatches(next);
    await AsyncStorage.setItem(WATCHES_KEY, JSON.stringify(next));
  }, []);

  const persistReturns = useCallback(async (next: ReturnCase[]) => {
    setReturns(next);
    await AsyncStorage.setItem(RETURNS_KEY, JSON.stringify(next));
  }, []);

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
      if (existing) {
        setRecentlyDeleted(existing);
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        undoTimerRef.current = setTimeout(() => setRecentlyDeleted(null), 8000);
      }
    },
    [persistItems]
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
  }, [persistItems]);

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
      if (next.currencyCode !== prev.currencyCode) setActiveCurrency(next.currencyCode);
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));

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
        next.reminderHour !== prev.reminderHour;
      if (!affectsReminders) return;

      const rescheduled: TrackedItem[] = [];
      for (const item of itemsRef.current) {
        await cancelItemReminders(item.notificationIds);
        const notificationIds = await scheduleItemReminders(item, next);
        rescheduled.push({ ...item, notificationIds });
      }
      await persistItems(rescheduled);
    },
    [persistItems]
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
