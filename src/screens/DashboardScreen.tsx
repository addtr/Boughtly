import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { FeatureTour } from '../components/FeatureTour';
import { ItemCard } from '../components/ItemCard';
import { Button } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { lookupPriceAdjustment } from '../services/priceAdjust';
import { useAppState } from '../store/AppStateContext';
import { Palette, cardShadow, fonts, radii, spacing } from '../theme/theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { addDays, daysUntil, formatDate, formatPrice, nearestDeadline } from '../utils/dates';
import { computeInsights } from '../utils/insights';
import { monthlyCost } from '../types/tracking';
import { spendByStore } from '../utils/spending';
import {
  fetchUpcomingReminders,
  formatFireAt,
  UpcomingReminder,
} from '../utils/upcomingReminders';
import { DONE_ACCESSORY_ID } from '../components/KeyboardDoneBar';

/** Items whose nearest active deadline is this close (days) are "act now". */
const URGENT_DAYS = 7;

type SortMode = 'deadline' | 'newest' | 'price' | 'name';
const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'deadline', label: 'Deadline' },
  { key: 'newest', label: 'Newest' },
  { key: 'price', label: 'Price' },
  { key: 'name', label: 'A–Z' },
];
const DASH_PREFS_KEY = 'boughtly.dashPrefs.v1';

export function DashboardScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    items,
    returns,
    watches,
    subscriptions,
    recentlyDeleted,
    undoDelete,
    deleteItem,
    startReturn,
    settings,
    isLoaded,
    updateSettings,
    recallAlerts,
  } = useAppState();
  const subsMonthly = useMemo(
    () => subscriptions.reduce((sum, s) => sum + monthlyCost(s), 0),
    [subscriptions]
  );

  // First landing on the dashboard → one-time feature tour (replayable from
  // Settings, which flips tourSeen back to false).
  const tourVisible = isLoaded && settings.hasOnboarded && !settings.tourSeen;
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('deadline');
  const [hideExpired, setHideExpired] = useState(false);
  const [menuOpen, setMenuOpen] = useState<'sort' | 'stores' | null>(null);

  // Sort/filter choices stick between sessions.
  useEffect(() => {
    AsyncStorage.getItem(DASH_PREFS_KEY)
      .then((raw) => {
        if (!raw) return;
        const prefs = JSON.parse(raw);
        if (SORT_OPTIONS.some((o) => o.key === prefs.sortMode)) setSortMode(prefs.sortMode);
        if (typeof prefs.hideExpired === 'boolean') setHideExpired(prefs.hideExpired);
      })
      .catch(() => {});
  }, []);
  function savePrefs(next: { sortMode?: SortMode; hideExpired?: boolean }) {
    const merged = { sortMode, hideExpired, ...next };
    AsyncStorage.setItem(DASH_PREFS_KEY, JSON.stringify(merged)).catch(() => {});
  }

  // The X on the attention/price-adjustment cards clears them for the rest of
  // the day — they're time-sensitive, so they come back tomorrow.
  const todayISO = new Date().toISOString().slice(0, 10);
  const [dismissed, setDismissed] = useState<{
    attention?: string;
    priceAdj?: string;
    recall?: string;
  }>({});
  useEffect(() => {
    AsyncStorage.getItem('boughtly.dismissed.v1')
      .then((raw) => raw && setDismissed(JSON.parse(raw)))
      .catch(() => {});
  }, []);
  function dismissCard(key: 'attention' | 'priceAdj' | 'recall') {
    const next = { ...dismissed, [key]: todayISO };
    setDismissed(next);
    AsyncStorage.setItem('boughtly.dismissed.v1', JSON.stringify(next)).catch(() => {});
  }
  const attentionHidden = dismissed.attention === todayISO;
  const priceAdjHidden = dismissed.priceAdj === todayISO;
  const recallHidden = dismissed.recall === todayISO;

  // Possible recalls for items still on the dashboard ("not my product"
  // dismissals are permanent and handled on the item's detail screen).
  const activeRecalls = useMemo(() => {
    const ids = new Set(items.map((i) => i.id));
    return recallAlerts.filter((a) => !a.dismissed && ids.has(a.itemId));
  }, [recallAlerts, items]);

  // Pull-to-refresh recomputes every countdown and replays the ring animations
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshTick((t) => t + 1);
      setRefreshing(false);
    }, 500);
  }, []);

  // Once a purchase has been refunded it's done — drop it from the dashboard
  // entirely (it still lives under "Refunded" in the Returns tab).
  const activeItems = useMemo(() => {
    const refunded = new Set(
      returns.filter((r) => r.status === 'refunded').map((r) => r.itemId)
    );
    return items.filter((i) => !refunded.has(i.id));
  }, [items, returns]);

  // Apply the chosen sort. Deadline sort keeps expired items at the bottom.
  const sorted = useMemo(() => {
    const list = [...activeItems];
    switch (sortMode) {
      case 'newest':
        return list.sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
      case 'price':
        return list.sort((a, b) => b.price - a.price);
      case 'name':
        return list.sort((a, b) =>
          a.itemName.localeCompare(b.itemName, undefined, { sensitivity: 'base' })
        );
      case 'deadline':
      default:
        return list.sort((a, b) => {
          const da = nearestDeadline(a).daysLeft;
          const db = nearestDeadline(b).daysLeft;
          const aExpired = da < 0 ? 1 : 0;
          const bExpired = db < 0 ? 1 : 0;
          if (aExpired !== bExpired) return aExpired - bExpired;
          return da - db;
        });
    }
  }, [activeItems, sortMode]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    activeItems.forEach((i) => (i.tags ?? []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [activeItems]);

  const filtered = useMemo(() => {
    let list = sorted;
    if (hideExpired) list = list.filter((i) => nearestDeadline(i).daysLeft >= 0);
    if (tagFilter) list = list.filter((i) => (i.tags ?? []).includes(tagFilter));
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (item) =>
          item.itemName.toLowerCase().includes(q) ||
          item.storeName.toLowerCase().includes(q) ||
          (item.tags ?? []).some((t) => t.includes(q))
      );
    }
    return list;
  }, [sorted, query, tagFilter, hideExpired]);

  const firstExpiredIndex = useMemo(
    () => filtered.findIndex((item) => nearestDeadline(item).daysLeft < 0),
    [filtered]
  );

  const insights = useMemo(() => computeInsights(activeItems, returns), [activeItems, returns]);

  // "Needs attention": items with an active deadline closing within a week,
  // soonest first. These get pulled to the top so nothing quietly expires.
  const urgent = useMemo(() => {
    return activeItems
      .map((item) => ({ item, deadline: nearestDeadline(item) }))
      .filter(({ deadline }) => deadline.daysLeft >= 0 && deadline.daysLeft <= URGENT_DAYS)
      .sort((a, b) => a.deadline.daysLeft - b.deadline.daysLeft);
  }, [activeItems]);

  function urgencyText(kind: 'return' | 'warranty', daysLeft: number): string {
    const noun = kind === 'return' ? 'Return window' : 'Warranty';
    if (daysLeft === 0) return `${noun} ends today`;
    if (daysLeft === 1) return `${noun} ends tomorrow`;
    return `${noun} ends in ${daysLeft} days`;
  }

  // Total value of return windows closing this week (money you could still get back).
  const valueClosing = useMemo(
    () =>
      urgent
        .filter((u) => u.deadline.kind === 'return')
        .reduce((sum, u) => sum + u.item.price, 0),
    [urgent]
  );

  // The soonest upcoming deadline, for the "next up" line when nothing's urgent.
  const nextDeadline = useMemo(() => {
    const upcoming = activeItems
      .map((item) => ({ item, deadline: nearestDeadline(item) }))
      .filter(({ deadline }) => deadline.daysLeft >= 0)
      .sort((a, b) => a.deadline.daysLeft - b.deadline.daysLeft);
    return upcoming[0] ?? null;
  }, [activeItems]);

  // Purchases still inside their store's price-adjustment window (free money).
  const priceAdjustOpps = useMemo(() => {
    return activeItems
      .map((item) => {
        const adj = lookupPriceAdjustment(item.storeName);
        if (!adj) return null;
        const daysLeft = daysUntil(addDays(item.purchaseDate, adj.days));
        if (daysLeft < 0) return null;
        return { item, daysLeft };
      })
      .filter((x): x is { item: (typeof activeItems)[number]; daysLeft: number } => x !== null)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [activeItems]);

  // Watchlist snapshot: how many watched, how many at/under target.
  const watchStats = useMemo(() => {
    const atTarget = watches.filter((w) => {
      const latest = w.priceLog[w.priceLog.length - 1];
      return w.targetPrice !== undefined && latest && latest.price <= w.targetPrice;
    }).length;
    return { count: watches.length, atTarget };
  }, [watches]);

  // Items still under an active manufacturer warranty.
  const underWarranty = useMemo(
    () => activeItems.filter((i) => daysUntil(i.warrantyExpirationDate) >= 0).length,
    [activeItems]
  );

  // The next few scheduled reminders, shown right on the home screen.
  const [upcoming, setUpcoming] = useState<UpcomingReminder[]>([]);
  useFocusEffect(
    useCallback(() => {
      void fetchUpcomingReminders().then((all) =>
        setUpcoming(all.filter((r) => r.fireAt !== null).slice(0, 2))
      );
    }, [])
  );

  // Your stores, biggest spend first — one tap to a store's profile page.
  const topStores = useMemo(() => spendByStore(activeItems, 8), [activeItems]);

  /** Swipe → Return: single items go straight to a return; multi-item
   *  purchases open the detail so the partial-return picker can run. */
  async function swipeReturn(item: (typeof items)[number]) {
    if (item.lineItems && item.lineItems.length >= 2) {
      navigation.navigate('ItemDetail', { itemId: item.id });
      return;
    }
    const ret = await startReturn(item);
    navigation.navigate('ReturnDetail', { returnId: ret.id });
  }

  function swipeDelete(item: (typeof items)[number]) {
    Alert.alert('Stop tracking this item?', `${item.itemName} — you'll have a few seconds to undo.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteItem(item.id) },
    ]);
  }

  function renderRowActions(item: (typeof items)[number]) {
    const returnable = daysUntil(item.returnDeadlineDate) >= 0;
    return (
      <View style={styles.swipeActions}>
        {returnable && (
          <Pressable
            style={[styles.swipeAction, { backgroundColor: colors.coral }]}
            onPress={() => void swipeReturn(item)}
          >
            <Ionicons name="arrow-undo" size={20} color="#FFFFFF" />
            <Text style={styles.swipeActionText}>Return</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.swipeAction, { backgroundColor: colors.danger }]}
          onPress={() => swipeDelete(item)}
        >
          <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
          <Text style={styles.swipeActionText}>Delete</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        key={refreshTick}
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          activeItems.length > 0 ? (
            <View>
              {!query.trim() && activeRecalls.length > 0 && !recallHidden && (
                <View style={styles.recallCard}>
                  <View style={styles.attentionHeader}>
                    <Ionicons name="warning" size={16} color={colors.danger} />
                    <Text style={styles.recallTitle}>
                      Possible recall{activeRecalls.length === 1 ? '' : 's'} (
                      {activeRecalls.length})
                    </Text>
                    <Pressable
                      onPress={() => dismissCard('recall')}
                      hitSlop={10}
                      accessibilityLabel="Dismiss for today"
                    >
                      <Ionicons name="close" size={17} color={colors.danger} />
                    </Pressable>
                  </View>
                  {activeRecalls.slice(0, 3).map((alert) => (
                    <Pressable
                      key={alert.id}
                      style={styles.attentionRow}
                      onPress={() =>
                        navigation.navigate('ItemDetail', { itemId: alert.itemId })
                      }
                    >
                      <View style={styles.attentionInfo}>
                        <Text style={styles.attentionName} numberOfLines={1}>
                          {alert.itemName}
                        </Text>
                        <Text style={styles.attentionMeta} numberOfLines={2}>
                          {alert.hazard ?? alert.title}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.danger} />
                    </Pressable>
                  ))}
                  <Text style={styles.recallHint}>
                    Tap to see the official notice — recalled items are usually a free
                    fix or refund.
                  </Text>
                </View>
              )}
              {!query.trim() && urgent.length > 0 && !attentionHidden && (
                <View style={styles.attentionCard}>
                  <View style={styles.attentionHeader}>
                    <Ionicons name="alert-circle" size={16} color={colors.coral} />
                    <Text style={styles.attentionTitle}>
                      Needs attention ({urgent.length})
                      {valueClosing > 0
                        ? ` · ${formatPrice(valueClosing)} closing this week`
                        : ''}
                    </Text>
                    <Pressable
                      onPress={() => dismissCard('attention')}
                      hitSlop={10}
                      accessibilityLabel="Dismiss for today"
                    >
                      <Ionicons name="close" size={17} color={colors.coral} />
                    </Pressable>
                  </View>
                  {urgent.slice(0, 3).map(({ item, deadline }) => (
                    <Pressable
                      key={item.id}
                      style={styles.attentionRow}
                      onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
                    >
                      <View style={styles.attentionInfo}>
                        <Text style={styles.attentionName} numberOfLines={1}>
                          {item.itemName}
                        </Text>
                        <Text style={styles.attentionMeta} numberOfLines={1}>
                          {item.storeName} · {urgencyText(deadline.kind, deadline.daysLeft)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.attentionPill,
                          deadline.daysLeft <= 1 && styles.attentionPillHot,
                        ]}
                      >
                        <Text
                          style={[
                            styles.attentionPillText,
                            deadline.daysLeft <= 1 && styles.attentionPillTextHot,
                          ]}
                        >
                          {deadline.daysLeft === 0 ? 'today' : `${deadline.daysLeft}d`}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                  {urgent.length > 3 && (
                    <Text style={styles.attentionMore}>
                      + {urgent.length - 3} more in your list below
                    </Text>
                  )}
                </View>
              )}
              {!query.trim() && urgent.length === 0 && (
                <Pressable
                  style={styles.caughtUpCard}
                  onPress={() =>
                    nextDeadline &&
                    navigation.navigate('ItemDetail', { itemId: nextDeadline.item.id })
                  }
                >
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.caughtUpText} numberOfLines={1}>
                    All caught up ✨{' '}
                    {nextDeadline
                      ? `Next: ${nextDeadline.item.itemName} — ${formatDate(
                          nextDeadline.deadline.date
                        )}`
                      : 'Nothing closing soon.'}
                  </Text>
                </Pressable>
              )}
              {!query.trim() && priceAdjustOpps.length > 0 && !priceAdjHidden && (
                <View style={styles.oppCard}>
                  <View style={styles.oppHeader}>
                    <Ionicons name="cash-outline" size={16} color={colors.success} />
                    <Text style={styles.oppTitle}>
                      Price adjustments available ({priceAdjustOpps.length})
                    </Text>
                    <Pressable
                      onPress={() => dismissCard('priceAdj')}
                      hitSlop={10}
                      accessibilityLabel="Dismiss for today"
                    >
                      <Ionicons name="close" size={17} color={colors.success} />
                    </Pressable>
                  </View>
                  {priceAdjustOpps.slice(0, 2).map(({ item, daysLeft }) => (
                    <Pressable
                      key={item.id}
                      style={styles.oppRow}
                      onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
                    >
                      <View style={styles.attentionInfo}>
                        <Text style={styles.oppName} numberOfLines={1}>
                          {item.itemName}
                        </Text>
                        <Text style={styles.oppMeta} numberOfLines={1}>
                          {item.storeName} · refunds the difference if it dropped
                        </Text>
                      </View>
                      <View style={[styles.oppPill, daysLeft <= URGENT_DAYS && styles.oppPillHot]}>
                        <Text
                          style={[
                            styles.oppPillText,
                            daysLeft <= URGENT_DAYS && styles.oppPillTextHot,
                          ]}
                        >
                          {daysLeft === 0 ? 'last day' : `${daysLeft}d left`}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
              <Pressable
                style={({ pressed }) => [styles.statCard, pressed && { opacity: 0.92 }]}
                onPress={() => navigation.navigate('Insights')}
              >
                <View style={styles.statRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                      {formatPrice(insights.protectedValue)}
                    </Text>
                    <Text style={styles.statLabel}>protected</Text>
                  </View>
                  <View style={styles.statVDivider} />
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{insights.activeProtections}</Text>
                    <Text style={styles.statLabel}>
                      active {insights.activeProtections === 1 ? 'cover' : 'covers'}
                    </Text>
                  </View>
                </View>
                <View style={styles.statHDivider} />
                <View style={styles.statRow}>
                  <View style={styles.stat}>
                    <Text
                      style={[styles.statValue, insights.pending > 0 && styles.statValuePending]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {formatPrice(insights.pending)}
                    </Text>
                    <Text style={styles.statLabel}>on its way</Text>
                  </View>
                  <View style={styles.statVDivider} />
                  <View style={styles.stat}>
                    <Text
                      style={[styles.statValue, insights.recovered > 0 && styles.statValueGood]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {formatPrice(insights.recovered)}
                    </Text>
                    <Text style={styles.statLabel}>recovered</Text>
                  </View>
                </View>
              </Pressable>
              {!query.trim() && upcoming.length > 0 && (
                <View style={styles.remindersCard}>
                  <Pressable
                    style={styles.remindersHeader}
                    onPress={() => navigation.navigate('Reminders')}
                  >
                    <Ionicons name="notifications" size={17} color={colors.primary} />
                    <Text style={styles.remindersTitle}>Upcoming reminders</Text>
                    <Text style={styles.remindersSeeAll}>See all ›</Text>
                  </Pressable>
                  {upcoming.map((r) => (
                    <View key={r.id} style={styles.reminderLine}>
                      <Text style={styles.reminderWhen}>
                        {r.fireAt ? formatFireAt(r.fireAt) : ''}
                      </Text>
                      <Text style={styles.reminderWhat} numberOfLines={1}>
                        {r.title}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {activeItems.length >= 4 && (
                <TextInput
          inputAccessoryViewID={DONE_ACCESSORY_ID}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search your items"
                  placeholderTextColor={colors.muted}
                  style={styles.search}
                  autoCapitalize="none"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
              )}
              {allTags.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tagFilterRow}
                  keyboardShouldPersistTaps="handled"
                >
                  <Pressable
                    onPress={() => setTagFilter(null)}
                    style={[styles.tagFilter, !tagFilter && styles.tagFilterActive]}
                  >
                    <Text
                      style={[styles.tagFilterText, !tagFilter && styles.tagFilterTextActive]}
                    >
                      All
                    </Text>
                  </Pressable>
                  {allTags.map((t) => {
                    const active = tagFilter === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => setTagFilter(active ? null : t)}
                        style={[styles.tagFilter, active && styles.tagFilterActive]}
                      >
                        <Text
                          style={[styles.tagFilterText, active && styles.tagFilterTextActive]}
                        >
                          {t}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
              {(activeItems.length >= 2 || topStores.length > 0) && (
                <View style={styles.dropdownRow}>
                  {activeItems.length >= 2 && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.dropdownBtn,
                        pressed && { opacity: 0.85 },
                      ]}
                      onPress={() => setMenuOpen('sort')}
                    >
                      <Ionicons name="swap-vertical" size={14} color={colors.primary} />
                      <Text style={styles.dropdownText} numberOfLines={1}>
                        Sort: {SORT_OPTIONS.find((o) => o.key === sortMode)?.label}
                        {hideExpired ? ' · no expired' : ''}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color={colors.muted} />
                    </Pressable>
                  )}
                  {activeItems.length >= 2 && topStores.length > 0 && (
                    <View style={styles.dropdownDivider} />
                  )}
                  {topStores.length > 0 && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.dropdownBtn,
                        pressed && { opacity: 0.85 },
                      ]}
                      onPress={() => setMenuOpen('stores')}
                    >
                      <Ionicons name="storefront-outline" size={14} color={colors.primary} />
                      <Text style={styles.dropdownText} numberOfLines={1}>
                        Stores ({topStores.length})
                      </Text>
                      <Ionicons name="chevron-down" size={14} color={colors.muted} />
                    </Pressable>
                  )}
                </View>
              )}
              {(watchStats.count > 0 || underWarranty > 0 || subscriptions.length > 0) && (
                <View style={styles.quickRow}>
                  {watchStats.count > 0 && (
                    <Pressable
                      style={styles.quickTile}
                      onPress={() => navigation.navigate('Tabs', { screen: 'WatchTab' })}
                    >
                      <Ionicons name="pricetags-outline" size={15} color={colors.primary} />
                      <Text style={styles.quickValue} numberOfLines={1}>
                        {watchStats.count} watched
                        {watchStats.atTarget > 0 ? ` · ${watchStats.atTarget} at target` : ''}
                      </Text>
                    </Pressable>
                  )}
                  {subscriptions.length > 0 && (
                    <Pressable
                      style={styles.quickTile}
                      onPress={() => navigation.navigate('Subscriptions')}
                    >
                      <Ionicons name="repeat-outline" size={15} color={colors.primary} />
                      <Text style={styles.quickValue} numberOfLines={1}>
                        {formatPrice(subsMonthly)}/mo subs
                      </Text>
                    </Pressable>
                  )}
                  {underWarranty > 0 && (
                    <View style={styles.quickTile}>
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={15}
                        color={colors.primary}
                      />
                      <Text style={styles.quickValue} numberOfLines={1}>
                        {underWarranty} under warranty
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <View>
            {index === firstExpiredIndex && (
              <Text style={styles.expiredLabel}>Protection ended</Text>
            )}
            <Swipeable
              renderRightActions={() => renderRowActions(item)}
              overshootRight={false}
              friction={2}
            >
              <ItemCard
                item={item}
                index={index}
                onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
              />
            </Swipeable>
          </View>
        )}
        ListEmptyComponent={
          activeItems.length > 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No matches</Text>
              <Text style={styles.emptyBody}>
                Nothing named “{query.trim()}” yet — try a different search.
              </Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Image
                source={require('../../assets/splash-icon.png')}
                style={styles.emptyArt}
                resizeMode="contain"
              />
              <Text style={styles.emptyTitle}>Nothing tracked yet</Text>
              <Text style={styles.emptyBody}>
                Add your first receipt and Boughtly will watch the return window and
                warranty for you.
              </Text>
              <Button
                title="Add your first receipt"
                variant="coral"
                onPress={() => navigation.navigate('AddChooser')}
                style={styles.emptyCta}
              />
            </View>
          )
        }
      />
      <FeatureTour
        visible={tourVisible}
        onDone={() => void updateSettings({ tourSeen: true })}
      />

      {/* Sort / Stores dropdown menus */}
      <Modal
        visible={menuOpen !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setMenuOpen(null)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(null)}>
          <Pressable style={styles.menuSheet} onPress={() => {}}>
            <View style={styles.menuGrabber} />
            {menuOpen === 'sort' && (
              <>
                <Text style={styles.menuTitle}>Sort your items</Text>
                {SORT_OPTIONS.map((o) => {
                  const active = sortMode === o.key;
                  return (
                    <Pressable
                      key={o.key}
                      style={styles.menuRow}
                      onPress={() => {
                        setSortMode(o.key);
                        savePrefs({ sortMode: o.key });
                        setMenuOpen(null);
                      }}
                    >
                      <Text style={[styles.menuRowText, active && styles.menuRowActive]}>
                        {o.label}
                      </Text>
                      {active && (
                        <Ionicons name="checkmark" size={18} color={colors.primary} />
                      )}
                    </Pressable>
                  );
                })}
                <View style={styles.menuDivider} />
                <Pressable
                  style={styles.menuRow}
                  onPress={() => {
                    setHideExpired(!hideExpired);
                    savePrefs({ hideExpired: !hideExpired });
                    setMenuOpen(null);
                  }}
                >
                  <Text style={[styles.menuRowText, hideExpired && styles.menuRowActive]}>
                    Hide expired items
                  </Text>
                  <Ionicons
                    name={hideExpired ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={hideExpired ? colors.primary : colors.muted}
                  />
                </Pressable>
              </>
            )}
            {menuOpen === 'stores' && (
              <>
                <Text style={styles.menuTitle}>Your stores</Text>
                <ScrollView style={styles.menuScroll}>
                  {topStores.map((s) => (
                    <Pressable
                      key={s.name}
                      style={styles.menuRow}
                      onPress={() => {
                        setMenuOpen(null);
                        navigation.navigate('StoreProfile', { storeName: s.name });
                      }}
                    >
                      <Ionicons
                        name="storefront-outline"
                        size={16}
                        color={colors.primary}
                      />
                      <Text style={[styles.menuRowText, styles.menuStoreName]} numberOfLines={1}>
                        {s.name}
                      </Text>
                      <Text style={styles.menuStoreTotal}>{formatPrice(s.total)}</Text>
                      <Ionicons name="chevron-forward" size={15} color={colors.muted} />
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
      {recentlyDeleted && (
        <View style={styles.undoBar}>
          <Text style={styles.undoText} numberOfLines={1}>
            Deleted “{recentlyDeleted.itemName}”
          </Text>
          <Pressable onPress={() => void undoDelete()} hitSlop={10}>
            <Text style={styles.undoAction}>Undo</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.md,
    paddingBottom: 120,
    flexGrow: 1,
  },
  summary: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    marginBottom: spacing.md,
    marginLeft: 2,
  },
  statCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingVertical: 2,
    marginBottom: spacing.sm,
    ...cardShadow,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
  },
  statValue: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.deepBlue,
  },
  statValueGood: {
    color: colors.success,
  },
  statValuePending: {
    color: colors.coral,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    textAlign: 'center',
  },
  statVDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.divider,
  },
  statHDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.md,
  },
  attentionCard: {
    backgroundColor: colors.coralSoft,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  recallCard: {
    backgroundColor: colors.coralSoft,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.danger,
  },
  recallTitle: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.danger,
  },
  recallHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },
  attentionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  attentionTitle: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.coral,
  },
  attentionMore: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.coral,
    marginTop: 2,
  },
  caughtUpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successSoft,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  caughtUpText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.success,
  },
  oppCard: {
    backgroundColor: colors.successSoft,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  oppHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  oppTitle: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.success,
  },
  oppRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 5,
  },
  oppName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.deepBlue,
  },
  oppMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  oppPill: {
    minWidth: 52,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  oppPillHot: {
    backgroundColor: colors.success,
  },
  oppPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.success,
  },
  oppPillTextHot: {
    color: '#FFFFFF',
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 5,
  },
  attentionInfo: {
    flex: 1,
  },
  attentionName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.deepBlue,
  },
  attentionMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  attentionPill: {
    minWidth: 40,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  attentionPillHot: {
    backgroundColor: colors.coral,
  },
  attentionPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.coral,
  },
  attentionPillTextHot: {
    color: '#FFFFFF',
  },
  search: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.sm,
    ...cardShadow,
    shadowOpacity: 0.05,
    elevation: 1,
  },
  expiredLabel: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.muted,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },
  remindersCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    ...cardShadow,
    shadowOpacity: 0.05,
    elevation: 1,
  },
  remindersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  remindersTitle: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.deepBlue,
  },
  remindersSeeAll: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.primary,
  },
  reminderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 3,
  },
  reminderWhen: {
    width: 118,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.primary,
  },
  reminderWhat: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    ...cardShadow,
    shadowOpacity: 0.05,
    elevation: 1,
  },
  dropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
  },
  dropdownDivider: {
    width: 1,
    alignSelf: 'center',
    height: 20,
    backgroundColor: colors.divider,
  },
  dropdownText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.deepBlue,
    flexShrink: 1,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 18, 28, 0.45)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '70%',
  },
  menuGrabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.divider,
    marginBottom: spacing.md,
  },
  menuTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.deepBlue,
    marginBottom: spacing.sm,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 13,
  },
  menuRowText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.text,
  },
  menuRowActive: {
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 4,
  },
  menuScroll: {
    flexGrow: 0,
  },
  menuStoreName: {
    flex: 1,
  },
  menuStoreTotal: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.deepBlue,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  quickTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    ...cardShadow,
    shadowOpacity: 0.05,
    elevation: 1,
  },
  quickValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.deepBlue,
  },
  quickLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  tagFilterRow: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    paddingRight: spacing.md,
  },
  tagFilter: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 100,
    backgroundColor: colors.card,
    ...cardShadow,
    shadowOpacity: 0.05,
    elevation: 1,
  },
  tagFilterActive: {
    backgroundColor: colors.primary,
  },
  tagFilterText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.text,
  },
  tagFilterTextActive: {
    color: '#FFFFFF',
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: spacing.md,
    marginLeft: spacing.sm,
    gap: spacing.sm,
  },
  swipeAction: {
    width: 76,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  swipeActionText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  undoBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: '#1F2A44', // fixed dark snackbar — readable over both themes
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    ...cardShadow,
    shadowOpacity: 0.25,
  },
  undoText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: '#FFFFFF',
  },
  undoAction: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: '#8FB0F7',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  emptyArt: {
    width: 150,
    height: 150,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.deepBlue,
    marginBottom: spacing.sm,
  },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyCta: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
});
