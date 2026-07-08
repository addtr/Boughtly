import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ItemCard } from '../components/ItemCard';
import { Button } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../store/AppStateContext';
import { cardShadow, colors, fonts, radii, spacing } from '../theme/theme';
import { formatPrice, nearestDeadline } from '../utils/dates';
import { computeInsights } from '../utils/insights';

/** Items whose nearest active deadline is this close (days) are "act now". */
const URGENT_DAYS = 7;

export function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { items, returns } = useAppState();
  const [query, setQuery] = useState('');
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

  // Soonest active deadline first; fully-expired items sink to the bottom.
  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const da = nearestDeadline(a).daysLeft;
      const db = nearestDeadline(b).daysLeft;
      const aExpired = da < 0 ? 1 : 0;
      const bExpired = db < 0 ? 1 : 0;
      if (aExpired !== bExpired) return aExpired - bExpired;
      return da - db;
    });
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (item) =>
        item.itemName.toLowerCase().includes(q) || item.storeName.toLowerCase().includes(q)
    );
  }, [sorted, query]);

  const firstExpiredIndex = useMemo(
    () => filtered.findIndex((item) => nearestDeadline(item).daysLeft < 0),
    [filtered]
  );

  const insights = useMemo(() => computeInsights(items, returns), [items, returns]);

  // "Needs attention": items with an active deadline closing within a week,
  // soonest first. These get pulled to the top so nothing quietly expires.
  const urgent = useMemo(() => {
    return items
      .map((item) => ({ item, deadline: nearestDeadline(item) }))
      .filter(({ deadline }) => deadline.daysLeft >= 0 && deadline.daysLeft <= URGENT_DAYS)
      .sort((a, b) => a.deadline.daysLeft - b.deadline.daysLeft);
  }, [items]);

  function urgencyText(kind: 'return' | 'warranty', daysLeft: number): string {
    const noun = kind === 'return' ? 'Return window' : 'Warranty';
    if (daysLeft === 0) return `${noun} ends today`;
    if (daysLeft === 1) return `${noun} ends tomorrow`;
    return `${noun} ends in ${daysLeft} days`;
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
          items.length > 0 ? (
            <View>
              {!query.trim() && urgent.length > 0 && (
                <View style={styles.attentionCard}>
                  <View style={styles.attentionHeader}>
                    <Ionicons name="alert-circle" size={18} color={colors.coral} />
                    <Text style={styles.attentionTitle}>
                      Needs attention ({urgent.length})
                    </Text>
                  </View>
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
                  <Text style={[styles.statValue, insights.recovered > 0 && styles.statValueGood]}>
                    {formatPrice(insights.recovered)}
                  </Text>
                  <Text style={styles.statLabel}>recovered</Text>
                </View>
              </View>
              {items.length >= 4 && (
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
          items.length > 0 ? (
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
    fontSize: 19,
    color: colors.deepBlue,
  },
  statValueGood: {
    color: '#20744E',
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
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
