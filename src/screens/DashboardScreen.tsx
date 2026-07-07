import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { ItemCard } from '../components/ItemCard';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../store/AppStateContext';
import { cardShadow, colors, fonts, radii, spacing } from '../theme/theme';
import { formatPrice, nearestDeadline } from '../utils/dates';

export function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { items } = useAppState();
  const [query, setQuery] = useState('');

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

  const totalCovered = useMemo(
    () => items.reduce((sum, item) => sum + item.price, 0),
    [items]
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          items.length > 0 ? (
            <View>
              <Text style={styles.summary}>
                {items.length} item{items.length === 1 ? '' : 's'} protected ·{' '}
                {formatPrice(totalCovered)} covered
              </Text>
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
});
