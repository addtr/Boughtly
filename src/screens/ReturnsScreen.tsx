import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../store/AppStateContext';
import { Palette, cardShadow, fonts, radii, spacing } from '../theme/theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { RETURN_STEPS, ReturnCase } from '../types/tracking';
import { formatPrice } from '../utils/dates';

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

// Palette keys, resolved against the active theme at render
const STATUS_COLOR: Record<ReturnCase['status'], { bg: keyof Palette; fg: keyof Palette }> = {
  started: { bg: 'primarySoft', fg: 'primary' },
  sent: { bg: 'primarySoft', fg: 'primary' },
  refund_pending: { bg: 'coralSoft', fg: 'coral' },
  refunded: { bg: 'successSoft', fg: 'success' },
};

function ReturnRow({ ret, onPress }: { ret: ReturnCase; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const stepLabel = RETURN_STEPS.find((s) => s.key === ret.status)?.label ?? ret.status;
  const c = STATUS_COLOR[ret.status];
  const age = daysSince(ret.startedAt);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
      <View style={styles.cardLeft}>
        <Text style={styles.name} numberOfLines={1}>
          {ret.itemName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {ret.storeName} · {formatPrice(ret.refundAmount)} back
        </Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: colors[c.bg] }]}>
            <Text style={[styles.badgeText, { color: colors[c.fg] }]}>{stepLabel}</Text>
          </View>
          {ret.status !== 'refunded' && (
            <Text style={styles.age}>
              {age === 0 ? 'started today' : `day ${age}`}
            </Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function ReturnsScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { returns } = useAppState();

  const active = useMemo(() => returns.filter((r) => r.status !== 'refunded'), [returns]);
  const done = useMemo(() => returns.filter((r) => r.status === 'refunded'), [returns]);
  const pendingTotal = useMemo(
    () => active.reduce((sum, r) => sum + r.refundAmount, 0),
    [active]
  );
  const recoveredTotal = useMemo(
    () => done.reduce((sum, r) => sum + r.refundAmount, 0),
    [done]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {returns.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="arrow-undo" size={44} color={colors.coral} />
          </View>
          <Text style={styles.emptyTitle}>No returns in progress</Text>
          <Text style={styles.emptyBody}>
            Changed your mind about something? Open the item and tap
            “Start a return” — Boughtly walks it through until the money’s back.
          </Text>
        </View>
      ) : (
        <>
          {active.length > 0 && (
            <>
              <Text style={styles.summary}>
                {formatPrice(pendingTotal)} on its way back to you
              </Text>
              {active.map((r) => (
                <ReturnRow
                  key={r.id}
                  ret={r}
                  onPress={() => navigation.navigate('ReturnDetail', { returnId: r.id })}
                />
              ))}
            </>
          )}
          {done.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                Refunded · {formatPrice(recoveredTotal)} recovered
              </Text>
              {done.map((r) => (
                <ReturnRow
                  key={r.id}
                  ret={r}
                  onPress={() => navigation.navigate('ReturnDetail', { returnId: r.id })}
                />
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 40,
    flexGrow: 1,
  },
  summary: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    marginBottom: spacing.md,
    marginLeft: 2,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.muted,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
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
  meta: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 8,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 100,
  },
  badgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
  },
  age: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 120,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.coralSoft,
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
});
