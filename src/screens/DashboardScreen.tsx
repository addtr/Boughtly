import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import {
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
import { ItemCard } from '../components/ItemCard';
import { Button } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { lookupPriceAdjustment } from '../services/priceAdjust';
import { useAppState } from '../store/AppStateContext';
import { cardShadow, colors, fonts, radii, spacing } from '../theme/theme';
import { addDays, daysUntil, formatDate, formatPrice, nearestDeadline } from '../utils/dates';
import { computeInsights } from '../utils/insights';

/** Items whose nearest active deadline is this close (days) are "act now". */
const URGENT_DAYS = 7;

export function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { items, returns, watches } = useAppState();
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

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

  // Soonest active deadline first; fully-expired items sink to the bottom.
  const sorted = useMemo(() => {
    return [...activeItems].sort((a, b) => {
      const da = nearestDeadline(a).daysLeft;
      const db = nearestDeadline(b).daysLeft;
      const aExpired = da < 0 ? 1 : 0;
      const bExpired = db < 0 ? 1 : 0;
      if (aExpired !== bExpired) return aExpired - bExpired;
      return da - db;
    });
  }, [activeItems]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    activeItems.forEach((i) => (i.tags ?? []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [activeItems]);

  const filtered = useMemo(() => {
    let list = sorted;
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
  }, [sorted, query, tagFilter]);

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
                    <Ionicons name="checkmark-circle" size={18} color="#20744E" />
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
              <View style={styles.statCard}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{formatPrice(insights.protectedValue)}</Text>
                  <Text style={styles.statLabel}>protected</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{insights.activeProtections}</Text>
                  <Text style={styles.statLabel}>
                    active {insights.activeProtections === 1 ? 'cover' : 'covers'}
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={[styles.statValue, insights.pending > 0 && styles.statValuePending]}>
                    {formatPrice(insights.pending)}
                  </Text>
                  <Text style={styles.statLabel}>coming back</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={[styles.statValue, insights.recovered > 0 && styles.statValueGood]}>
                    {formatPrice(insights.recovered)}
                  </Text>
                  <Text style={styles.statLabel}>recovered</Text>
                </View>
              </View>
              {!query.trim() && priceAdjustOpps.length > 0 && (
                <View style={styles.oppCard}>
                  <View style={styles.oppHeader}>
                    <Ionicons name="cash-outline" size={18} color="#20744E" />
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
            <ItemCard
              item={item}
              index={index}
              onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
            />
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    ...cardShadow,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: fonts.displayBold,
    fontSize: 17,
    color: colors.deepBlue,
  },
  statValueGood: {
    color: '#20744E',
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
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.divider,
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
    backgroundColor: '#DFF3E9',
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
    color: '#20744E',
  },
  caughtUpNext: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#20744E',
    marginTop: 6,
    lineHeight: 18,
  },
  oppCard: {
    backgroundColor: '#DFF3E9',
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
    color: '#20744E',
  },
  oppSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#20744E',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  oppPillHot: {
    backgroundColor: '#20744E',
  },
  oppPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: '#20744E',
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
    backgroundColor: '#FFFFFF',
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
