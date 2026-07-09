import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import React, { useMemo } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Card } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { lookupStoreReturnPolicy } from '../services/policyLookup';
import { lookupPriceAdjustment } from '../services/priceAdjust';
import { resolveReturnPage } from '../services/returnUrl';
import { useAppState } from '../store/AppStateContext';
import { cardShadow, colors, fonts, radii, spacing } from '../theme/theme';
import { daysUntil, formatDate, formatPrice } from '../utils/dates';

type Props = NativeStackScreenProps<RootStackParamList, 'StoreProfile'>;

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Same store when equal or one contains the other ("CVS" ⊂ "CVS Pharmacy"). */
function sameStore(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  return short.length >= 3 && long.includes(short);
}

export function StoreProfileScreen({ navigation, route }: Props) {
  const { items } = useAppState();
  const storeName = route.params.storeName;

  const storeItems = useMemo(
    () =>
      items
        .filter((i) => sameStore(i.storeName, storeName))
        .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate)),
    [items, storeName]
  );
  const totalSpent = useMemo(
    () => Math.round(storeItems.reduce((s, i) => s + i.price, 0) * 100) / 100,
    [storeItems]
  );

  const returnPolicy = lookupStoreReturnPolicy(storeName);
  const priceAdjust = lookupPriceAdjustment(storeName);
  const returnPage = resolveReturnPage(storeName);

  async function openReturnPage() {
    if (Platform.OS === 'web') {
      Linking.openURL(returnPage.url).catch(() => {});
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(returnPage.url);
    } catch {
      await Linking.openURL(returnPage.url).catch(() => {});
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.name}>{storeName}</Text>
      <Text style={styles.subtitle}>
        {storeItems.length} purchase{storeItems.length === 1 ? '' : 's'} tracked ·{' '}
        {formatPrice(totalSpent)} spent
      </Text>

      {/* Policies */}
      <Text style={styles.sectionTitle}>What to know</Text>
      <Card style={styles.policyCard}>
        <View style={styles.policyRow}>
          <Ionicons name="arrow-undo-outline" size={18} color={colors.primary} />
          <Text style={styles.policyText}>
            {returnPolicy
              ? `Returns are typically ${returnPolicy.days} days${
                  returnPolicy.note ? ` (${returnPolicy.note})` : ''
                }.`
              : 'No return policy on file for this store — check your receipt.'}
          </Text>
        </View>
        <View style={[styles.policyRow, styles.policyDivider]}>
          <Ionicons name="cash-outline" size={18} color={colors.success} />
          <Text style={styles.policyText}>
            {priceAdjust
              ? `Price adjustments within ${priceAdjust.days} days of purchase — they refund the difference if it drops.`
              : 'No price-adjustment policy on file.'}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.returnBtn, pressed && { opacity: 0.9 }]}
          onPress={() => void openReturnPage()}
        >
          <Ionicons name="open-outline" size={17} color="#FFFFFF" />
          <Text style={styles.returnBtnText}>
            {returnPage.known
              ? `Open ${returnPage.label}'s returns page`
              : 'Find their returns page'}
          </Text>
        </Pressable>
      </Card>

      {/* Purchases here */}
      <Text style={styles.sectionTitle}>Your purchases here</Text>
      {storeItems.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>Nothing tracked from this store yet.</Text>
        </Card>
      ) : (
        <Card style={styles.listCard}>
          {storeItems.map((it, i) => {
            const daysLeft = daysUntil(it.returnDeadlineDate);
            return (
              <Pressable
                key={it.id}
                style={[styles.itemRow, i > 0 && styles.itemDivider]}
                onPress={() => navigation.push('ItemDetail', { itemId: it.id })}
              >
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {it.itemName}
                  </Text>
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    {formatDate(it.purchaseDate)} ·{' '}
                    {daysLeft >= 0
                      ? `returnable ${daysLeft === 0 ? 'today only' : `${daysLeft}d more`}`
                      : 'return window closed'}
                  </Text>
                </View>
                <Text style={styles.itemPrice}>{formatPrice(it.price)}</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.muted} />
              </Pressable>
            );
          })}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  name: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    color: colors.deepBlue,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.deepBlue,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  policyCard: {},
  policyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  policyDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  policyText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  returnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 12,
    marginTop: spacing.sm,
  },
  returnBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  listCard: {
    paddingVertical: spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
  },
  itemDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.deepBlue,
  },
  itemMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  itemPrice: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.deepBlue,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
  },
});
