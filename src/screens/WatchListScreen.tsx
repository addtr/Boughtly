import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Sparkline } from '../components/Sparkline';
import { Button } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../store/AppStateContext';
import { cardShadow, colors, fonts, radii, spacing } from '../theme/theme';
import { formatPrice } from '../utils/dates';
import { trendVsTypical } from '../utils/deals';
import { tapFeedback } from '../utils/haptics';
import { openPriceScan } from '../utils/priceScan';

export function WatchListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { watches } = useAppState();
  const [quickQuery, setQuickQuery] = useState('');

  function scanNow() {
    const q = quickQuery.trim();
    if (!q) return;
    tapFeedback();
    void openPriceScan(q);
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={watches}
        keyExtractor={(w) => w.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {/* Instant scan — no watch required */}
            <View style={styles.scanCard}>
              <Text style={styles.scanCardTitle}>Scan stores right now</Text>
              <View style={styles.scanRow}>
                <TextInput
                  value={quickQuery}
                  onChangeText={setQuickQuery}
                  placeholder="What are you looking for?"
                  placeholderTextColor={colors.muted}
                  style={styles.scanInput}
                  returnKeyType="search"
                  onSubmitEditing={scanNow}
                />
                <Pressable
                  onPress={scanNow}
                  disabled={!quickQuery.trim()}
                  accessibilityLabel="Scan now"
                  style={({ pressed }) => [
                    styles.scanNowBtn,
                    !quickQuery.trim() && { opacity: 0.4 },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Ionicons name="search" size={17} color="#FFFFFF" />
                  <Text style={styles.scanNowText}>Scan now</Text>
                </Pressable>
              </View>
              <Text style={styles.scanCardSub}>
                Live shopping search across retailers, lowest prices first.
              </Text>
              {quickQuery.trim().length > 1 && (
                <Pressable
                  onPress={() =>
                    navigation.navigate('AddWatch', { prefillName: quickQuery.trim() })
                  }
                  style={styles.watchItLink}
                  hitSlop={6}
                >
                  <Text style={styles.watchItText}>
                    + Watch “{quickQuery.trim()}” to track its price over time
                  </Text>
                </Pressable>
              )}
            </View>
            {watches.length > 0 && (
              <Text style={styles.hint}>
                Log prices when you see them — Boughtly tells you when a “sale” is real.
              </Text>
            )}
          </View>
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
                width={80}
                height={44}
              />
              <Pressable
                hitSlop={8}
                onPress={() => {
                  tapFeedback();
                  void openPriceScan(watch.name);
                }}
                accessibilityLabel={`Scan for ${watch.name} cheaper`}
                style={({ pressed }) => [styles.scanIcon, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="search" size={18} color={colors.primary} />
              </Pressable>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="pricetags" size={40} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Watching nothing yet</Text>
            <Text style={styles.emptyBody}>
              Scan above for an instant price check, or watch an item to build its
              price history — Boughtly will tell you when a sale is actually a deal.
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
  scanCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...cardShadow,
  },
  scanCardTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: spacing.sm,
  },
  scanRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  scanInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  scanNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.coral,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  scanNowText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  scanCardSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.sm,
  },
  watchItLink: {
    marginTop: spacing.sm,
  },
  watchItText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: '#FFFFFF',
    textDecorationLine: 'underline',
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
  scanIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
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
