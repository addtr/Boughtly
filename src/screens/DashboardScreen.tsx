import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { ItemCard } from '../components/ItemCard';
import { Button } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { lookupPriceAdjustment } from '../services/priceAdjust';
import { useAppState } from '../store/AppStateContext';
import { cardShadow, colors, fonts, radii, spacing } from '../theme/theme';
import { addDays, daysUntil, formatDate, formatPrice, nearestDeadline } from '../utils/dates';
import { computeInsights } from '../utils/insights';
import { spendByStore } from '../utils/spending';
import {
  fetchUpcomingReminders,
  formatFireAt,
  UpcomingReminder,
} from '../utils/upcomingReminders';

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { items, returns, watches, recentlyDeleted, undoDelete, deleteItem, startReturn } =
    useAppState();
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('deadline');
  const [hideExpired, setHideExpired] = useState(false);

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
        setUpcoming(all.filter((r) => r.fireAt !== null).slice(0, 3))
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
              {!query.trim() && urgent.length > 0 && (
                <View style={styles.attentionCard}>
                  <View style={styles.attentionHeader}>
                    <Ionicons name="alert-circle" size={18} color={colors.coral} />
                    <Text style={styles.attentionTitle}>
                      Needs attention ({urgent.length})
                    </Text>
                  </View>
                  {valueClosing > 0 && (
                    <Text style={styles.attentionValue}>
                      {formatPrice(valueClosing)} in return windows close this week
                    </Text>
                  )}
                  {urgent.map(({ item, deadline }) => (
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
                </View>
              )}
              {!query.trim() && urgent.length === 0 && (
                <View style={styles.caughtUpCard}>
                  <View style={styles.caughtUpHeader}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                    <Text style={styles.caughtUpTitle}>You’re all caught up ✨</Text>
                  </View>
                  {nextDeadline ? (
                    <Pressable
                      onPress={() =>
                        navigation.navigate('ItemDetail', { itemId: nextDeadline.item.id })
                      }
                    >
                      <Text style={styles.caughtUpNext}>
                        Next up: {nextDeadline.deadline.kind === 'return' ? 'return' : 'warranty'}{' '}
                        for {nextDeadline.item.itemName} — {formatDate(nextDeadline.deadline.date)}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.caughtUpNext}>Nothing closing soon. Nicely done.</Text>
                  )}
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
              {!query.trim() && priceAdjustOpps.length > 0 && (
                <View style={styles.oppCard}>
                  <View style={styles.oppHeader}>
                    <Ionicons name="cash-outline" size={18} color={colors.success} />
                    <Text style={styles.oppTitle}>
                      Price adjustments available ({priceAdjustOpps.length})
                    </Text>
                  </View>
                  <Text style={styles.oppSub}>
                    These stores refund the difference if the price dropped — worth a check.
                  </Text>
                  {priceAdjustOpps.slice(0, 4).map(({ item, daysLeft }) => (
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
                          {item.storeName} · check for a lower price
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
              {activeItems.length >= 4 && (
                <TextInput
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
              {topStores.length > 0 && (
                <View>
                  <Text style={styles.storesTitle}>Your stores</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.storesRow}
                    keyboardShouldPersistTaps="handled"
                  >
                    {topStores.map((s) => (
                      <Pressable
                        key={s.name}
                        style={({ pressed }) => [styles.storeChip, pressed && { opacity: 0.85 }]}
                        onPress={() =>
                          navigation.navigate('StoreProfile', { storeName: s.name })
                        }
                      >
                        <Ionicons name="storefront-outline" size={15} color={colors.primary} />
                        <Text style={styles.storeChipText} numberOfLines={1}>
                          {s.name}
                        </Text>
                        <Ionicons name="chevron-forward" size={13} color={colors.muted} />
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
              {activeItems.length >= 2 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.sortRow}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={styles.sortLabel}>Sort</Text>
                  {SORT_OPTIONS.map((o) => {
                    const active = sortMode === o.key;
                    return (
                      <Pressable
                        key={o.key}
                        onPress={() => {
                          setSortMode(o.key);
                          savePrefs({ sortMode: o.key });
                        }}
                        style={[styles.tagFilter, active && styles.tagFilterActive]}
                      >
                        <Text
                          style={[styles.tagFilterText, active && styles.tagFilterTextActive]}
                        >
                          {o.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <View style={styles.sortDivider} />
                  <Pressable
                    onPress={() => {
                      setHideExpired(!hideExpired);
                      savePrefs({ hideExpired: !hideExpired });
                    }}
                    style={[styles.tagFilter, hideExpired && styles.tagFilterActive]}
                  >
                    <Text
                      style={[styles.tagFilterText, hideExpired && styles.tagFilterTextActive]}
                    >
                      Hide expired
                    </Text>
                  </Pressable>
                </ScrollView>
              )}
              {(watchStats.count > 0 || underWarranty > 0) && (
                <View style={styles.quickRow}>
                  {watchStats.count > 0 && (
                    <Pressable
                      style={styles.quickTile}
                      onPress={() => navigation.navigate('Tabs', { screen: 'WatchTab' })}
                    >
                      <Ionicons name="pricetags-outline" size={18} color={colors.primary} />
                      <Text style={styles.quickValue}>
                        {watchStats.count} watched
                      </Text>
                      <Text style={styles.quickLabel}>
                        {watchStats.atTarget > 0
                          ? `${watchStats.atTarget} at your target`
                          : 'tracking prices'}
                      </Text>
                    </Pressable>
                  )}
                  {underWarranty > 0 && (
                    <View style={styles.quickTile}>
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={18}
                        color={colors.primary}
                      />
                      <Text style={styles.quickValue}>{underWarranty} under</Text>
                      <Text style={styles.quickLabel}>warranty</Text>
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

const styles = StyleSheet.create({
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
    borderRadius: radii.lg,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
    ...cardShadow,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  statValue: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
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
    fontSize: 12,
    color: colors.muted,
    marginTop: 3,
    textAlign: 'center',
  },
  statVDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.divider,
  },
  statHDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.md,
  },
  attentionCard: {
    backgroundColor: colors.coralSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  attentionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  attentionTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.coral,
  },
  attentionValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.coral,
    marginTop: -2,
    marginBottom: spacing.sm,
  },
  caughtUpCard: {
    backgroundColor: colors.successSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  caughtUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  caughtUpTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.success,
  },
  caughtUpNext: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.success,
    marginTop: 6,
    lineHeight: 18,
  },
  oppCard: {
    backgroundColor: colors.successSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  oppHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  oppTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.success,
  },
  oppSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.success,
    marginTop: 3,
    marginBottom: 4,
    lineHeight: 17,
  },
  oppRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
  },
  oppName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
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
    paddingVertical: 8,
  },
  attentionInfo: {
    flex: 1,
  },
  attentionName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
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
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.md,
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
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...cardShadow,
  },
  remindersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  remindersTitle: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
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
    paddingVertical: 5,
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
  storesTitle: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.muted,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },
  storesRow: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingRight: spacing.md,
  },
  storeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 12,
    maxWidth: 200,
    ...cardShadow,
    shadowOpacity: 0.05,
    elevation: 1,
  },
  storeChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.deepBlue,
  },
  sortRow: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingRight: spacing.md,
  },
  sortLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.muted,
    marginRight: 2,
  },
  sortDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.divider,
    marginHorizontal: 4,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  quickTile: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    ...cardShadow,
    shadowOpacity: 0.05,
    elevation: 1,
  },
  quickValue: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.deepBlue,
    marginTop: 6,
  },
  quickLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  tagFilterRow: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
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
