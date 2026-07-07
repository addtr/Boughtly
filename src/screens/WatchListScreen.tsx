import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Sparkline } from '../components/Sparkline';
import { Button } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../store/AppStateContext';
import { cardShadow, colors, fonts, radii, spacing } from '../theme/theme';
import { formatPrice } from '../utils/dates';
import { trendVsTypical } from '../utils/deals';

export function WatchListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { watches } = useAppState();

  return (
    <View style={styles.container}>
      <FlatList
        data={watches}
        keyExtractor={(w) => w.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          watches.length > 0 ? (
            <Text style={styles.hint}>
              Log prices when you see them — Boughtly tells you when a “sale” is real.
            </Text>
          ) : null
        }
        renderItem={({ item: watch }) => {
          const latest = watch.priceLog[watch.priceLog.length - 1];
          const trend = trendVsTypical(watch.priceLog);
          const targetHit =
            watch.targetPrice !== undefined && latest.price <= watch.targetPrice;
          return (
            <Pressable
              onPress={() => navigation.navigate('WatchDetail', { watchId: watch.id })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
            >
              <View style={styles.cardLeft}>
                <Text style={styles.name} numberOfLines={1}>
                  {watch.name}
                </Text>
                <Text style={styles.store} numberOfLines={1}>
                  {watch.store}
                </Text>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>{formatPrice(latest.price)}</Text>
                  {targetHit ? (
                    <Text style={styles.targetHit}>target hit</Text>
                  ) : trend !== null ? (
                    <Text
                      style={[
                        styles.trend,
                        { color: trend < 0 ? '#2E9E6B' : trend > 0 ? colors.coral : colors.muted },
                      ]}
                    >
                      {trend < 0 ? '▾' : trend > 0 ? '▴' : '•'}{' '}
                      {Math.abs(Math.round(trend * 100))}% vs usual
                    </Text>
                  ) : (
                    <Text style={styles.trendMuted}>
                      {watch.priceLog.length} price{watch.priceLog.length === 1 ? '' : 's'} logged
                    </Text>
                  )}
                </View>
              </View>
              <Sparkline
                values={watch.priceLog.map((p) => p.price)}
                width={92}
                height={44}
              />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="pricetags" size={44} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Watching nothing yet</Text>
            <Text style={styles.emptyBody}>
              Eyeing something? Add it here, log the price when you see it, and
              Boughtly will tell you when a sale is actually a deal.
            </Text>
            <Button
              title="Watch your first price"
              onPress={() => navigation.navigate('AddWatch')}
              style={styles.emptyCta}
            />
          </View>
        }
      />
      {watches.length > 0 && (
        <Pressable
          onPress={() => navigation.navigate('AddWatch')}
          style={({ pressed }) => [styles.addRow, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="add-circle" size={20} color={colors.primary} />
          <Text style={styles.addRowText}>Watch another price</Text>
        </Pressable>
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
    paddingBottom: 40,
    flexGrow: 1,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
    ...cardShadow,
  },
  cardLeft: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.deepBlue,
  },
  store: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: 8,
  },
  price: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.deepBlue,
  },
  trend: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
  trendMuted: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  targetHit: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: '#2E9E6B',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
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
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  addRowText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.primary,
  },
});
