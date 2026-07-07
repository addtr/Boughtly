import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Sparkline } from '../components/Sparkline';
import { Button, Card } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../store/AppStateContext';
import { colors, fonts, radii, spacing } from '../theme/theme';
import { formatDate, formatPrice, toISODate } from '../utils/dates';
import { analyzeDeal, DealVerdict } from '../utils/deals';
import { successFeedback, tapFeedback, warningFeedback } from '../utils/haptics';
import { openPriceScan } from '../utils/priceScan';

type Props = NativeStackScreenProps<RootStackParamList, 'WatchDetail'>;

const VERDICT_STYLE: Record<DealVerdict['level'], { bg: string; fg: string; icon: string }> = {
  great: { bg: '#DFF3E9', fg: '#20744E', icon: 'trophy' },
  good: { bg: '#DFF3E9', fg: '#20744E', icon: 'thumbs-up' },
  meh: { bg: '#F0EDE6', fg: '#6B7080', icon: 'remove-circle' },
  suspicious: { bg: '#FFE7E2', fg: '#C24534', icon: 'warning' },
  unknown: { bg: '#E4ECFD', fg: '#3556C9', icon: 'help-circle' },
};

function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function WatchDetailScreen({ navigation, route }: Props) {
  const { watches, logWatchPrice, deleteWatch } = useAppState();
  const watch = useMemo(
    () => watches.find((w) => w.id === route.params.watchId),
    [watches, route.params.watchId]
  );

  const [priceText, setPriceText] = useState('');
  const [isSale, setIsSale] = useState(false);
  const [claimedText, setClaimedText] = useState('');
  const [verdict, setVerdict] = useState<DealVerdict | null>(null);

  if (!watch) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>This watch was removed.</Text>
        <Button title="Back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const latest = watch.priceLog[watch.priceLog.length - 1];
  const prices = watch.priceLog.map((p) => p.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const targetHit = watch.targetPrice !== undefined && latest.price <= watch.targetPrice;

  /** One tap: search every retailer for this item, cheapest first. */
  async function scanForCheaper() {
    if (!watch) return;
    tapFeedback();
    await openPriceScan(watch.name);
    // Browser sheet closed (native) — nudge toward logging what they found
    if (Platform.OS !== 'web') {
      Alert.alert(
        'Find a better price?',
        'Log it below and the deal-checker keeps getting smarter.',
        [{ text: 'OK' }]
      );
    }
  }

  async function handleLog() {
    if (!watch) return;
    const price = parsePrice(priceText);
    if (price === null) {
      Alert.alert('Almost there', 'Enter the price you saw.');
      return;
    }
    const claimed = isSale ? parsePrice(claimedText) ?? undefined : undefined;
    const point = { date: toISODate(new Date()), price, claimedOriginal: claimed };
    const result = analyzeDeal(watch.priceLog, point);
    await logWatchPrice(watch.id, point);
    setVerdict(result);
    setPriceText('');
    setClaimedText('');
    setIsSale(false);
    successFeedback();
  }

  function confirmDelete() {
    warningFeedback();
    Alert.alert('Stop watching this?', 'Its price history will be deleted.', [
      { text: 'Keep watching', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteWatch(watch!.id);
          navigation.goBack();
        },
      },
    ]);
  }

  const vStyle = verdict ? VERDICT_STYLE[verdict.level] : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.name}>{watch.name}</Text>
      <View style={styles.subRow}>
        <Text style={styles.store}>{watch.store}</Text>
        {watch.url ? (
          <Pressable
            style={styles.linkBtn}
            onPress={() => Linking.openURL(watch.url!).catch(() => {})}
          >
            <Ionicons name="open-outline" size={14} color={colors.primary} />
            <Text style={styles.linkText}>Check the price</Text>
          </Pressable>
        ) : null}
      </View>

      {/* One-tap cross-retailer scan */}
      <Pressable
        onPress={scanForCheaper}
        style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.88 }]}
      >
        <Ionicons name="search" size={19} color="#FFFFFF" />
        <View style={styles.scanText}>
          <Text style={styles.scanTitle}>Scan for it cheaper</Text>
          <Text style={styles.scanSub}>
            Live shopping search across retailers, lowest prices first
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
      </Pressable>

      {/* Current price + history chart */}
      <Card style={styles.chartCard}>
        <View style={styles.priceHeader}>
          <View>
            <Text style={styles.priceLabel}>Last seen</Text>
            <Text style={styles.bigPrice}>{formatPrice(latest.price)}</Text>
            <Text style={styles.priceDate}>on {formatDate(latest.date)}</Text>
          </View>
          <View style={styles.rangeBox}>
            <Text style={styles.rangeLine}>
              low <Text style={styles.rangeValue}>{formatPrice(low)}</Text>
            </Text>
            <Text style={styles.rangeLine}>
              high <Text style={styles.rangeValue}>{formatPrice(high)}</Text>
            </Text>
            {watch.targetPrice !== undefined && (
              <Text style={[styles.rangeLine, targetHit && styles.targetHit]}>
                target <Text style={styles.rangeValue}>{formatPrice(watch.targetPrice)}</Text>
                {targetHit ? ' ✓' : ''}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.chartWrap}>
          <Sparkline values={prices} width={300} height={110} showDots strokeWidth={3} />
        </View>
        <Text style={styles.chartCaption}>
          {watch.priceLog.length} price{watch.priceLog.length === 1 ? '' : 's'} logged —
          the more you log, the smarter the deal check gets.
        </Text>
      </Card>

      {/* Log a price */}
      <Text style={styles.sectionTitle}>Log today’s price</Text>
      <Card>
        <View style={styles.logRow}>
          <Text style={styles.currency}>$</Text>
          <TextInput
            value={priceText}
            onChangeText={setPriceText}
            placeholder="299.99"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            style={styles.logInput}
          />
        </View>
        <View style={styles.saleRow}>
          <Text style={styles.saleLabel}>The store says it’s on sale</Text>
          <Switch
            value={isSale}
            onValueChange={setIsSale}
            trackColor={{ true: colors.primary, false: colors.divider }}
            thumbColor="#FFFFFF"
          />
        </View>
        {isSale && (
          <View style={styles.logRow}>
            <Text style={styles.currency}>was $</Text>
            <TextInput
              value={claimedText}
              onChangeText={setClaimedText}
              placeholder="449.99 (the “original” price they claim)"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              style={styles.logInput}
            />
          </View>
        )}
        <Button
          title="Log it & check the deal"
          onPress={handleLog}
          disabled={!priceText.trim()}
          style={styles.logButton}
        />
      </Card>

      {/* Deal verdict */}
      {verdict && vStyle && (
        <View style={[styles.verdict, { backgroundColor: vStyle.bg }]}>
          <Ionicons name={vStyle.icon as any} size={22} color={vStyle.fg} />
          <View style={styles.verdictText}>
            <Text style={[styles.verdictTitle, { color: vStyle.fg }]}>{verdict.title}</Text>
            <Text style={[styles.verdictBody, { color: vStyle.fg }]}>{verdict.detail}</Text>
          </View>
        </View>
      )}

      <Button title="Stop watching" variant="danger" onPress={confirmDelete} style={styles.delete} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  name: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    color: colors.deepBlue,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  store: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  linkText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.primary,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  scanText: {
    flex: 1,
  },
  scanTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  scanSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  chartCard: {
    marginBottom: spacing.md,
  },
  priceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  priceLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.muted,
  },
  bigPrice: {
    fontFamily: fonts.displayBold,
    fontSize: 30,
    color: colors.deepBlue,
    marginTop: 2,
  },
  priceDate: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  rangeBox: {
    alignItems: 'flex-end',
    gap: 3,
  },
  rangeLine: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  rangeValue: {
    fontFamily: fonts.bodySemiBold,
    color: colors.text,
  },
  targetHit: {
    color: '#20744E',
  },
  chartWrap: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  chartCaption: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: spacing.sm,
    lineHeight: 17,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.deepBlue,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  currency: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.muted,
    marginRight: 6,
  },
  logInput: {
    flex: 1,
    paddingVertical: 11,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  saleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  saleLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.text,
  },
  logButton: {
    marginTop: spacing.xs,
  },
  verdict: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  verdictText: {
    flex: 1,
  },
  verdictTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  verdictBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  delete: {
    marginTop: spacing.xl,
  },
  missing: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  missingText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.muted,
  },
});
