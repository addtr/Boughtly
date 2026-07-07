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
import { AppSettings, DEFAULT_SETTINGS, TrackedItem } from '../types/item';
import {
  PricePoint,
  RETURN_STEPS,
  ReturnCase,
  WatchedProduct,
} from '../types/tracking';
import { addDays, toISODate } from '../utils/dates';

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
  deleteItem: (id: string) => Promise<void>;
  deleteAllItems: () => Promise<void>;
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
  startReturn: (item: TrackedItem) => Promise<ReturnCase>;
  updateReturn: (
    id: string,
    patch: Partial<Pick<ReturnCase, 'method' | 'trackingNumber' | 'notes' | 'refundAmount'>>
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
        if (rawSettings) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(rawSettings) });
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
      };
      updated.notificationIds = await scheduleItemReminders(updated, settingsRef.current);
      await persistItems(itemsRef.current.map((i) => (i.id === id ? updated : i)));
    },
    [persistItems]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      const existing = itemsRef.current.find((i) => i.id === id);
      if (existing) await cancelItemReminders(existing.notificationIds);
      await persistItems(itemsRef.current.filter((i) => i.id !== id));
    },
    [persistItems]
  );

  const deleteAllItems = useCallback(async () => {
    for (const item of itemsRef.current) {
      await cancelItemReminders(item.notificationIds);
    }
    await persistItems([]);
  }, [persistItems]);

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
    async (item: TrackedItem) => {
      const existing = returnsRef.current.find(
        (r) => r.itemId === item.id && r.status !== 'refunded'
      );
      if (existing) return existing;
      const now = new Date().toISOString();
      const ret: ReturnCase = {
        id: makeId(),
        itemId: item.id,
        itemName: item.itemName,
        storeName: item.storeName,
        refundAmount: item.price,
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
      patch: Partial<Pick<ReturnCase, 'method' | 'trackingNumber' | 'notes' | 'refundAmount'>>
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
          settingsRef.current.notificationsEnabled
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
        next.warrantyReminderDays !== prev.warrantyReminderDays;
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
      deleteItem,
      deleteAllItems,
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
      deleteItem,
      deleteAllItems,
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
