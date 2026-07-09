import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../store/AppStateContext';
import { colors, fonts, radii, spacing } from '../theme/theme';
import { formatPrice } from '../utils/dates';
import { monthlySpend, spendByStore, spendByTag } from '../utils/spending';

type Props = NativeStackScreenProps<RootStackParamList, 'Insights'>;

const CHART_HEIGHT = 120;

export function InsightsScreen(_props: Props) {
  const { items, returns } = useAppState();

  const months = useMemo(() => monthlySpend(items), [items]);
  const stores = useMemo(() => spendByStore(items), [items]);
  const tags = useMemo(() => spendByTag(items), [items]);

  const totalSpend = useMemo(
    () => Math.round(items.reduce((s, i) => s + i.price, 0) * 100) / 100,
    [items]
  );
  const recovered = useMemo(
    () =>
      Math.round(
        returns
          .filter((r) => r.status === 'refunded')
          .reduce((s, r) => s + r.refundAmount, 0) * 100
      ) / 100,
    [returns]
  );

  const maxMonth = Math.max(...months.map((m) => m.total), 1);
  const maxStore = Math.max(...stores.map((s) => s.total), 1);
  const maxTag = Math.max(...tags.map((t) => t.total), 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Headline numbers */}
      <View style={styles.heroRow}>
        <Card style={styles.heroCard}>
          <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatPrice(totalSpend)}
          </Text>
          <Text style={styles.heroLabel}>tracked spending</Text>
        </Card>
        <Card style={styles.heroCard}>
          <Text
            style={[styles.heroValue, recovered > 0 && styles.heroValueGood]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatPrice(recovered)}
          </Text>
          <Text style={styles.heroLabel}>recovered in returns</Text>
        </Card>
      </View>

      {/* Monthly spend */}
      <Text style={styles.sectionTitle}>Spending — last 6 months</Text>
      <Card>
        <View style={styles.chart}>
          {months.map((m, i) => {
            const h = m.total > 0 ? Math.max(6, (m.total / maxMonth) * CHART_HEIGHT) : 3;
            return (
              <View key={i} style={styles.chartCol}>
                <Text style={styles.chartValue} numberOfLines={1}>
                  {m.total > 0 ? formatPrice(m.total).replace(/\.\d+$/, '') : ''}
                </Text>
                <View style={styles.chartBarTrack}>
                  <View
                    style={[
                      styles.chartBar,
                      { height: h },
                      m.total === 0 && styles.chartBarEmpty,
                    ]}
                  />
                </View>
                <Text style={styles.chartMonth}>{m.label}</Text>
              </View>
            );
          })}
        </View>
      </Card>

      {/* By store */}
      {stores.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Where it goes</Text>
          <Card>
            {stores.map((s, i) => (
              <View key={s.name} style={[styles.rowItem, i > 0 && styles.rowDivider]}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={styles.rowValue}>{formatPrice(s.total)}</Text>
                </View>
                <View style={styles.rowBarTrack}>
                  <View
                    style={[styles.rowBar, { width: `${(s.total / maxStore) * 100}%` }]}
                  />
                </View>
              </View>
            ))}
          </Card>
        </>
      )}

      {/* By tag */}
      {tags.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>By tag</Text>
          <Card>
            {tags.map((t, i) => (
              <View key={t.name} style={[styles.rowItem, i > 0 && styles.rowDivider]}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <Text style={styles.rowValue}>{formatPrice(t.total)}</Text>
                </View>
                <View style={styles.rowBarTrack}>
                  <View style={[styles.rowBar, { width: `${(t.total / maxTag) * 100}%` }]} />
                </View>
              </View>
            ))}
          </Card>
        </>
      )}

      {items.length === 0 && (
        <Text style={styles.empty}>
          Nothing tracked yet — add a few purchases and your spending picture shows up
          here.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  heroRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  heroCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  heroValue: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    color: colors.deepBlue,
  },
  heroValueGood: {
    color: '#20744E',
  },
  heroLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 3,
    textAlign: 'center',
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.deepBlue,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
  },
  chartValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.muted,
    marginBottom: 4,
  },
  chartBarTrack: {
    height: CHART_HEIGHT,
    justifyContent: 'flex-end',
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  chartBar: {
    width: 18,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: colors.primary,
  },
  chartBarEmpty: {
    backgroundColor: colors.divider,
  },
  chartMonth: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
  },
  rowItem: {
    paddingVertical: 10,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: 6,
  },
  rowName: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.text,
  },
  rowValue: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.deepBlue,
  },
  rowBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.divider,
    overflow: 'hidden',
  },
  rowBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xl,
    lineHeight: 20,
  },
});
