import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ItemCard } from '../components/ItemCard';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../store/AppStateContext';
import { cardShadow, colors, fonts, spacing } from '../theme/theme';
import { formatPrice, nearestDeadline } from '../utils/dates';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export function DashboardScreen({ navigation }: Props) {
  const { items } = useAppState();

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

  const totalCovered = useMemo(
    () => items.reduce((sum, item) => sum + item.price, 0),
    [items]
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          items.length > 0 ? (
            <Text style={styles.summary}>
              {items.length} item{items.length === 1 ? '' : 's'} protected ·{' '}
              {formatPrice(totalCovered)} covered
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🧾</Text>
            <Text style={styles.emptyTitle}>Nothing tracked yet</Text>
            <Text style={styles.emptyBody}>
              Add your first receipt and Boughtly will watch the return window and
              warranty for you.
            </Text>
          </View>
        }
      />
      <Pressable
        onPress={() => navigation.navigate('AddItem')}
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.96 }] }]}
        accessibilityLabel="Add an item"
      >
        <Text style={styles.fabPlus}>+</Text>
      </Pressable>
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 44,
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
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
    shadowOpacity: 0.25,
    elevation: 6,
  },
  fabPlus: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 36,
    fontFamily: fonts.display,
  },
});
