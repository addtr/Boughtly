import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CountdownRing } from '../components/CountdownRing';
import { Button, Card } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../store/AppStateContext';
import { colors, fonts, radii, spacing } from '../theme/theme';
import { daysUntil, formatDate, formatPrice, nearestDeadline } from '../utils/dates';
import { tapFeedback, warningFeedback } from '../utils/haptics';
import { openPriceScan } from '../utils/priceScan';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemDetail'>;

export function ItemDetailScreen({ navigation, route }: Props) {
  const { items, returns, deleteItem, startReturn } = useAppState();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const item = useMemo(
    () => items.find((i) => i.id === route.params.itemId),
    [items, route.params.itemId]
  );

  if (!item) {
    // Item was deleted while this screen was open
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>This item is no longer tracked.</Text>
        <Button title="Back to dashboard" onPress={() => navigation.popToTop()} />
      </View>
    );
  }

  const returnDaysLeft = daysUntil(item.returnDeadlineDate);
  const warrantyDaysLeft = daysUntil(item.warrantyExpirationDate);
  const deadline = nearestDeadline(item);
  const statusExpired = deadline.daysLeft < 0;
  const statusUrgent = !statusExpired && deadline.daysLeft <= 3;
  const statusText = statusExpired
    ? 'Protection ended'
    : deadline.kind === 'return'
    ? `Returnable — ${deadline.daysLeft === 0 ? 'last day' : `${deadline.daysLeft} days left`}`
    : `Under warranty — ${deadline.daysLeft} days left`;

  // The line item worth re-shopping: the most expensive thing on the receipt,
  // or the item itself when there's no breakdown.
  const primaryScan =
    item.lineItems && item.lineItems.length > 0
      ? item.lineItems.reduce((a, b) => (b.price > a.price ? b : a))
      : { name: item.itemName, price: item.price };

  /** Same as the Prices tab: live cross-retailer search for a cheaper price. */
  async function scanForCheaper(name: string, paid: number) {
    tapFeedback();
    await openPriceScan(name);
    if (Platform.OS !== 'web') {
      Alert.alert(
        'Found it for less?',
        `You paid ${formatPrice(paid)} for “${name}”. If it’s cheaper somewhere and you’re still in the return window, you could rebuy at the lower price and return this one.`,
        [{ text: 'Got it' }]
      );
    }
  }

  function confirmDelete() {
    warningFeedback();
    Alert.alert(
      'Stop tracking this item?',
      'Its reminders will be cancelled too. This can’t be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteItem(item!.id);
            navigation.popToTop();
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.name}>{item.itemName}</Text>
      <Text style={styles.subtitle}>
        {item.storeName} · {formatPrice(item.price)} · bought {formatDate(item.purchaseDate)}
      </Text>
      <View
        style={[
          styles.statusPill,
          {
            backgroundColor: statusExpired
              ? colors.divider
              : statusUrgent
              ? colors.coralSoft
              : colors.primarySoft,
          },
        ]}
      >
        <Text
          style={[
            styles.statusPillText,
            {
              color: statusExpired
                ? colors.muted
                : statusUrgent
                ? colors.coral
                : colors.primary,
            },
          ]}
        >
          {statusText}
        </Text>
      </View>

      {/* Scan for a cheaper price on what they bought */}
      <Pressable
        onPress={() => scanForCheaper(primaryScan.name, primaryScan.price)}
        style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.88 }]}
      >
        <Ionicons name="pricetag" size={19} color="#FFFFFF" />
        <View style={styles.scanText}>
          <Text style={styles.scanTitle}>Scan for a better price</Text>
          <Text style={styles.scanSub} numberOfLines={2}>
            Search retailers for “{primaryScan.name}” — you paid {formatPrice(primaryScan.price)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
      </Pressable>

      {/* Deadlines */}
      <View style={styles.ringsRow}>
        <Card style={styles.ringCard}>
          <CountdownRing
            daysLeft={returnDaysLeft}
            totalDays={item.returnWindowDays}
            size={96}
            label="days"
          />
          <Text style={styles.ringTitle}>Return window</Text>
          <Text style={styles.ringDate}>
            {returnDaysLeft < 0 ? 'Closed ' : 'Closes '}
            {formatDate(item.returnDeadlineDate)}
          </Text>
        </Card>
        <Card style={styles.ringCard}>
          <CountdownRing
            daysLeft={warrantyDaysLeft}
            totalDays={item.warrantyLengthDays}
            size={96}
            label="days"
          />
          <Text style={styles.ringTitle}>Warranty</Text>
          <Text style={styles.ringDate}>
            {warrantyDaysLeft < 0 ? 'Ended ' : 'Ends '}
            {formatDate(item.warrantyExpirationDate)}
          </Text>
        </Card>
      </View>

      {/* What's on this receipt */}
      {item.lineItems && item.lineItems.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>
            What’s inside ({item.lineItems.length})
          </Text>
          <Text style={styles.sectionHint}>Tap any item to scan for it cheaper.</Text>
          <Card style={styles.lineItemsCard}>
            {item.lineItems.map((li, i) => (
              <Pressable
                key={i}
                onPress={() => scanForCheaper(li.name, li.price)}
                style={({ pressed }) => [
                  styles.lineItemRow,
                  i > 0 && styles.lineItemDivider,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.lineItemName} numberOfLines={2}>
                  {li.name}
                </Text>
                <View style={styles.lineItemRight}>
                  <Text style={styles.lineItemPrice}>{formatPrice(li.price)}</Text>
                  <Ionicons name="search" size={15} color={colors.primary} />
                </View>
              </Pressable>
            ))}
            <View style={[styles.lineItemRow, styles.lineItemTotal]}>
              <Text style={styles.lineItemTotalLabel}>Total paid</Text>
              <Text style={styles.lineItemTotalValue}>{formatPrice(item.price)}</Text>
            </View>
          </Card>
        </>
      ) : null}

      {/* Receipt */}
      <Text style={styles.sectionTitle}>Receipt</Text>
      {item.receiptImageUri ? (
        <Card style={styles.receiptCard}>
          <Pressable onPress={() => setReceiptOpen(true)}>
            <Image source={{ uri: item.receiptImageUri }} style={styles.receiptImage} />
            <Text style={styles.receiptHint}>Tap to view full screen</Text>
          </Pressable>
        </Card>
      ) : (
        <Card style={styles.receiptCard}>
          <Text style={styles.noReceipt}>
            No receipt photo yet. Add one from Edit so it’s there when you need it.
          </Text>
        </Card>
      )}

      {item.notes ? (
        <>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Card>
            <Text style={styles.notes}>{item.notes}</Text>
          </Card>
        </>
      ) : null}

      <View style={styles.actions}>
        {(() => {
          const activeReturn = returns.find(
            (r) => r.itemId === item.id && r.status !== 'refunded'
          );
          if (activeReturn) {
            return (
              <Button
                title="View return in progress"
                variant="coral"
                onPress={() =>
                  navigation.navigate('ReturnDetail', { returnId: activeReturn.id })
                }
              />
            );
          }
          if (returnDaysLeft >= 0) {
            return (
              <Button
                title="Start a return"
                variant="coral"
                onPress={async () => {
                  const ret = await startReturn(item!);
                  navigation.navigate('ReturnDetail', { returnId: ret.id });
                }}
              />
            );
          }
          return null;
        })()}
        <Button
          title="Edit details"
          onPress={() => navigation.navigate('AddItem', { itemId: item.id })}
        />
        <Button title="Stop tracking" variant="danger" onPress={confirmDelete} />
      </View>

      {/* Full-screen zoomable receipt */}
      <Modal
        visible={receiptOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setReceiptOpen(false)}
      >
        <View style={styles.viewerBackdrop}>
          <ScrollView
            style={styles.viewerScroll}
            contentContainerStyle={styles.viewerContent}
            maximumZoomScale={4}
            minimumZoomScale={1}
            bouncesZoom
          >
            {item.receiptImageUri && (
              <Image
                source={{ uri: item.receiptImageUri }}
                style={styles.viewerImage}
                resizeMode="contain"
              />
            )}
          </ScrollView>
          <Pressable
            style={styles.viewerClose}
            onPress={() => setReceiptOpen(false)}
            hitSlop={12}
            accessibilityLabel="Close receipt"
          >
            <Text style={styles.viewerCloseText}>✕</Text>
          </Pressable>
        </View>
      </Modal>
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
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 100,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  statusPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
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
  ringsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  ringCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  ringTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.deepBlue,
    marginTop: spacing.md,
  },
  ringDate: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    textAlign: 'center',
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.deepBlue,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  lineItemsCard: {
    paddingVertical: spacing.xs,
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    gap: spacing.md,
  },
  lineItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lineItemDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  lineItemName: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  lineItemPrice: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.deepBlue,
  },
  lineItemTotal: {
    borderTopWidth: 1.5,
    borderTopColor: colors.deepBlue,
    marginTop: 2,
  },
  lineItemTotalLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.deepBlue,
  },
  lineItemTotalValue: {
    fontFamily: fonts.displayBold,
    fontSize: 17,
    color: colors.deepBlue,
  },
  receiptCard: {
    padding: spacing.sm,
  },
  receiptImage: {
    width: '100%',
    height: 320,
    borderRadius: radii.md,
    resizeMode: 'contain',
    backgroundColor: colors.divider,
  },
  receiptHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 18, 28, 0.96)',
  },
  viewerScroll: {
    flex: 1,
  },
  viewerContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
    minHeight: 400,
  },
  viewerClose: {
    position: 'absolute',
    top: 56,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerCloseText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: fonts.bodySemiBold,
  },
  noReceipt: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    padding: spacing.sm,
  },
  notes: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
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
