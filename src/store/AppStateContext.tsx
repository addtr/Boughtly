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
} from '../notifications/notifications';
import { AppSettings, DEFAULT_SETTINGS, TrackedItem } from '../types/item';
import { addDays } from '../utils/dates';

const ITEMS_KEY = 'boughtly.items.v1';
const SETTINGS_KEY = 'boughtly.settings.v1';

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

interface AppState {
  items: TrackedItem[];
  settings: AppSettings;
  isLoaded: boolean;
  addItem: (input: NewItemInput) => Promise<TrackedItem>;
  updateItem: (id: string, input: NewItemInput) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  deleteAllItems: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
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
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  // Always-current snapshots for async callbacks
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    (async () => {
      try {
        const [rawItems, rawSettings] = await Promise.all([
          AsyncStorage.getItem(ITEMS_KEY),
          AsyncStorage.getItem(SETTINGS_KEY),
        ]);
        if (rawItems) setItems(JSON.parse(rawItems));
        if (rawSettings) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(rawSettings) });
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

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const prev = settingsRef.current;
      const next = { ...prev, ...patch };
      setSettings(next);
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));

      // Reschedule reminders only when a notification preference changed
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
      settings,
      isLoaded,
      addItem,
      updateItem,
      deleteItem,
      deleteAllItems,
      updateSettings,
    }),
    [items, settings, isLoaded, addItem, updateItem, deleteItem, deleteAllItems, updateSettings]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
