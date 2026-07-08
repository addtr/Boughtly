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
import { lookupPriceAdjustment } from '../services/priceAdjust';
import { addDays, daysUntil, formatDate, formatPrice, nearestDeadline } from '../utils/dates';
import { tapFeedback, warningFeedback } from '../utils/haptics';
import { openPriceScan } from '../utils/priceScan';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemDetail'>;

export function ItemDetailScreen({ navigation, route }: Props) {
  const { items, returns, deleteItem, startReturn } = useAppState();
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [returnPickerOpen, setReturnPickerOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<Set<number>>(new Set());
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

  // Price-adjustment window: if this store refunds price drops after purchase
  // and we're still inside the window, surface it (free money most people miss).
  const priceAdjust = lookupPriceAdjustment(item.storeName);
  const adjustEndISO = priceAdjust ? addDays(item.purchaseDate, priceAdjust.days) : null;
  const adjustDaysLeft = adjustEndISO ? daysUntil(adjustEndISO) : null;
  const inAdjustWindow = adjustDaysLeft !== null && adjustDaysLeft >= 0;

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

  const round2 = (n: number) => Math.round(n * 100) / 100;

  /** Start a return. Multi-item purchases open a picker; single ones go direct. */
  async function beginReturn() {
    if (item!.lineItems && item!.lineItems.length >= 2) {
      setSelectedReturn(new Set(item!.lineItems.map((_, i) => i)));
      setReturnPickerOpen(true);
      return;
    }
    const ret = await startReturn(item!);
    navigation.navigate('ReturnDetail', { returnId: ret.id });
  }

  function toggleReturnItem(idx: number) {
    setSelectedReturn((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function confirmPartialReturn() {
    const li = item!.lineItems ?? [];
    const chosen = li.filter((_, i) => selectedReturn.has(i));
    if (chosen.length === 0) return;
    const refund = round2(chosen.reduce((a, b) => a + b.price, 0));
    setReturnPickerOpen(false);
    const ret = await startReturn(item!, { items: chosen, refundAmount: refund });
    navigation.navigate('ReturnDetail', { returnId: ret.id });
  }

  const selectedRefund = round2(
    (item.lineItems ?? [])
      .filter((_, i) => selectedReturn.has(i))
      .reduce((a, b) => a + b.price, 0)
  );

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

      {item.isGift ? (
        <View style={styles.giftBadge}>
          <Text style={styles.giftBadgeText}>🎁 Gift — likely store credit on return</Text>
        </View>
      ) : null}

      {item.tags && item.tags.length > 0 ? (
        <View style={styles.detailTagsRow}>
          {item.tags.map((t) => (
            <View key={t} style={styles.detailTagChip}>
              <Text style={styles.detailTagText}>{t}</Text>
            </View>
          ))}
        </View>
      ) : null}

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

      {/* Price-adjustment window — claim the difference if it dropped */}
      {inAdjustWindow && (
        <View style={styles.adjustCard}>
          <View style={styles.adjustHeader}>
            <Ionicons name="cash-outline" size={18} color="#20744E" />
            <Text style={styles.adjustTitle}>Price-adjustment window open</Text>
            <View style={styles.adjustBadge}>
              <Text style={styles.adjustBadgeText}>
                {adjustDaysLeft === 0 ? 'last day' : `${adjustDaysLeft}d left`}
              </Text>
            </View>
          </View>
          <Text style={styles.adjustBody}>
            {item.storeName} refunds the difference if this dropped in price before{' '}
            {formatDate(adjustEndISO!)}. {priceAdjust!.note ? `${priceAdjust!.note}. ` : ''}
            Worth a 10-second check.
          </Text>
          <Pressable
            onPress={() => scanForCheaper(primaryScan.name, primaryScan.price)}
            style={({ pressed }) => [styles.adjustBtn, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="search" size={16} color="#20744E" />
            <Text style={styles.adjustBtnText}>Check for a lower price</Text>
          </Pressable>
        </View>
      )}

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
          <Pressable onPress={() => setViewerUri(item.receiptImageUri)}>
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

      {item.serialNumber ? (
        <>
          <Text style={styles.sectionTitle}>Serial / model number</Text>
          <Card>
            <Text style={styles.serial} selectable>
              {item.serialNumber}
            </Text>
          </Card>
        </>
      ) : null}

      {item.productPhotos && item.productPhotos.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Product photos</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoGallery}
          >
            {item.productPhotos.map((uri, i) => (
              <Pressable key={`${uri}-${i}`} onPress={() => setViewerUri(uri)}>
                <Image source={{ uri }} style={styles.galleryImage} />
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

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
                title={
                  item.lineItems && item.lineItems.length >= 2
                    ? 'Return some or all of this'
                    : 'Start a return'
                }
                variant="coral"
                onPress={beginReturn}
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

      {/* Pick which items to return (partial returns) */}
      <Modal
        visible={returnPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setReturnPickerOpen(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>What are you returning?</Text>
            <Text style={styles.sheetSub}>
              Pick the items going back — we’ll track the refund for just those.
            </Text>
            <ScrollView style={styles.sheetList}>
              {(item.lineItems ?? []).map((li, i) => {
                const on = selectedReturn.has(i);
                return (
                  <Pressable
                    key={i}
                    onPress={() => toggleReturnItem(i)}
                    style={[styles.pickRow, i > 0 && styles.lineItemDivider]}
                  >
                    <Ionicons
                      name={on ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={on ? colors.primary : colors.muted}
                    />
                    <Text style={styles.pickName} numberOfLines={2}>
                      {li.name}
                    </Text>
                    <Text style={styles.pickPrice}>{formatPrice(li.price)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.pickTotalRow}>
              <Text style={styles.pickTotalLabel}>
                Refund for {selectedReturn.size} item{selectedReturn.size === 1 ? '' : 's'}
              </Text>
              <Text style={styles.pickTotalValue}>{formatPrice(selectedRefund)}</Text>
            </View>
            <Button
              title="Start this return"
              variant="coral"
              onPress={confirmPartialReturn}
              disabled={selectedReturn.size === 0}
            />
            <Pressable
              style={styles.sheetCancel}
              onPress={() => setReturnPickerOpen(false)}
              hitSlop={8}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Full-screen zoomable image (receipt or product photo) */}
      <Modal
        visible={!!viewerUri}
        animationType="fade"
        transparent
        onRequestClose={() => setViewerUri(null)}
      >
        <View style={styles.viewerBackdrop}>
          <ScrollView
            style={styles.viewerScroll}
            contentContainerStyle={styles.viewerContent}
            maximumZoomScale={4}
            minimumZoomScale={1}
            bouncesZoom
          >
            {viewerUri && (
              <Image
                source={{ uri: viewerUri }}
                style={styles.viewerImage}
                resizeMode="contain"
              />
            )}
          </ScrollView>
          <Pressable
            style={styles.viewerClose}
            onPress={() => setViewerUri(null)}
            hitSlop={12}
            accessibilityLabel="Close image"
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
  giftBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.coralSoft,
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: spacing.md,
  },
  giftBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.coral,
  },
  detailTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  detailTagChip: {
    backgroundColor: colors.primarySoft,
    borderRadius: 100,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  detailTagText: {
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
  adjustCard: {
    backgroundColor: '#DFF3E9',
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  adjustHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  adjustTitle: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: '#20744E',
  },
  adjustBadge: {
    backgroundColor: '#20744E',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  adjustBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  adjustBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#20744E',
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    paddingVertical: 10,
  },
  adjustBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: '#20744E',
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
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 18, 28, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '80%',
  },
  sheetTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    color: colors.deepBlue,
  },
  sheetSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    marginBottom: spacing.md,
    lineHeight: 19,
  },
  sheetList: {
    flexGrow: 0,
    marginBottom: spacing.sm,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
  },
  pickName: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  pickPrice: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.deepBlue,
  },
  pickTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1.5,
    borderTopColor: colors.deepBlue,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  pickTotalLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.deepBlue,
  },
  pickTotalValue: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.deepBlue,
  },
  sheetCancel: {
    alignSelf: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  sheetCancelText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.muted,
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
  serial: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.deepBlue,
    letterSpacing: 0.5,
  },
  photoGallery: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  galleryImage: {
    width: 120,
    height: 120,
    borderRadius: radii.md,
    backgroundColor: colors.divider,
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
