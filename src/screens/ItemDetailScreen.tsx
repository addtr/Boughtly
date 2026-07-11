import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CountdownRing } from '../components/CountdownRing';
import { Button, Card } from '../components/ui';
import { useToast } from '../components/Toast';
import { RootStackParamList } from '../navigation/types';
import { lookupWarrantyByCategory } from '../services/policyLookup';
import {
  CARD_RETURN_PROTECTION_DAYS,
  cardExtendedWarranty,
  cardLabel,
  cardReturnProtection,
} from '../utils/cardBenefits';
import { lookupPriceAdjustment } from '../services/priceAdjust';
import { resolveWarrantyPage } from '../services/warrantyUrl';
import { useAppState } from '../store/AppStateContext';
import { Palette, cardShadow, fonts, radii, spacing } from '../theme/theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { addDeadlineToCalendar } from '../utils/calendar';
import {
  addDays,
  daysUntil,
  formatDate,
  formatPrice,
  nearestDeadline,
  parseISODate,
  toISODate,
} from '../utils/dates';
import { tapFeedback, warningFeedback } from '../utils/haptics';
import { openPriceScan } from '../utils/priceScan';
import { DONE_ACCESSORY_ID } from '../components/KeyboardDoneBar';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemDetail'>;

export function ItemDetailScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const {
    items,
    returns,
    deleteItem,
    startReturn,
    patchItem,
    recallAlerts,
    dismissRecallAlert,
    checkItemRecallsNow,
  } = useAppState();
  const toast = useToast();
  const [checkingRecalls, setCheckingRecalls] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [returnPickerOpen, setReturnPickerOpen] = useState(false);
  // Custom reminder editor
  const [reminderOpen, setReminderOpen] = useState(false);
  const [remDate, setRemDate] = useState<Date>(new Date());
  const [remNote, setRemNote] = useState('');
  const [remPickerVisible, setRemPickerVisible] = useState(false);
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

  const itemRecalls = recallAlerts.filter((a) => a.itemId === item.id && !a.dismissed);
  const warrantyBoost = cardExtendedWarranty(item);
  const returnRescue = cardReturnProtection(item);

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

  async function openUrl(url: string) {
    if (Platform.OS === 'web') {
      Linking.openURL(url).catch(() => {});
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      await Linking.openURL(url).catch(() => {});
    }
  }

  const warrantyPage = resolveWarrantyPage(item.itemName);

  // Registration nudge: real manufacturer-warranty categories, recent
  // purchase, not yet marked registered.
  const warrantyCategory = lookupWarrantyByCategory(item.itemName);
  const purchaseAgeDays = -daysUntil(item.purchaseDate);
  const showRegister =
    !!warrantyCategory &&
    warrantyCategory.days > 0 &&
    !item.productRegistered &&
    purchaseAgeDays <= 90 &&
    daysUntil(item.warrantyExpirationDate) >= 0;

  /** Open the manufacturer's warranty/support page. */
  async function fileWarrantyClaim() {
    tapFeedback();
    await openUrl(warrantyPage.url);
  }

  /** On-demand CPSC recall check; matches show as banners at the top. */
  async function checkRecalls() {
    tapFeedback();
    setCheckingRecalls(true);
    try {
      const matches = await checkItemRecallsNow(item!);
      const active = matches.filter((a) => !a.dismissed);
      if (active.length === 0) {
        toast('No recalls found — you’re all clear', 'info');
      } else {
        toast('Possible recall — see the notice above', 'error');
      }
    } catch {
      Alert.alert('Couldn’t check', 'The recall database didn’t respond — try again later.');
    } finally {
      setCheckingRecalls(false);
    }
  }

  /** Share a prefilled claim summary (serial, purchase details, photo count). */
  async function shareWarrantyClaim() {
    const lines = [
      `Warranty claim — ${item!.itemName}`,
      `Purchased ${formatDate(item!.purchaseDate)} at ${item!.storeName} for ${formatPrice(item!.price)}`,
      item!.serialNumber ? `Serial / model number: ${item!.serialNumber}` : null,
      item!.productPhotos && item!.productPhotos.length > 0
        ? `Photos available: ${item!.productPhotos.length}`
        : null,
      '',
      'Issue: (describe what went wrong)',
    ].filter((l): l is string => l !== null);
    try {
      await Share.share({ title: `Warranty claim — ${item!.itemName}`, message: lines.join('\n') });
    } catch {
      // dismissed
    }
  }

  /** Drop a deadline onto the device calendar. */
  async function addToCalendar(kind: 'return' | 'warranty') {
    tapFeedback();
    const iso = kind === 'return' ? item!.returnDeadlineDate : item!.warrantyExpirationDate;
    const title =
      kind === 'return'
        ? `Return window closes — ${item!.itemName}`
        : `Warranty ends — ${item!.itemName}`;
    const notes = `${item!.storeName} · ${formatPrice(item!.price)}${
      item!.serialNumber ? ` · SN ${item!.serialNumber}` : ''
    }`;
    const res = await addDeadlineToCalendar(title, iso, notes);
    if (res === 'created') {
      toast('Added to your calendar');
    } else if (res === 'denied') {
      Alert.alert(
        'Calendar access needed',
        'Allow calendar access in your phone’s Settings to add deadlines.'
      );
    } else if (res === 'unavailable') {
      Alert.alert('No calendar found', 'We couldn’t find a calendar to add this to.');
    } else {
      Alert.alert('Couldn’t add it', 'Something went wrong adding to your calendar.');
    }
  }

  function openReminderEditor() {
    const existing = item!.customReminder;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setRemDate(existing ? parseISODate(existing.date) : tomorrow);
    setRemNote(existing?.note ?? '');
    setRemPickerVisible(Platform.OS === 'ios');
    setReminderOpen(true);
  }

  async function saveCustomReminder() {
    const iso = toISODate(remDate);
    if (parseISODate(iso).getTime() <= Date.now() - 86400000) {
      Alert.alert('Pick a future date', 'The reminder needs to be later than today.');
      return;
    }
    setReminderOpen(false);
    await patchItem(item!.id, {
      customReminder: { date: iso, note: remNote.trim() || `Check on ${item!.itemName}` },
    });
    tapFeedback();
  }

  async function removeCustomReminder() {
    setReminderOpen(false);
    await patchItem(item!.id, { customReminder: undefined });
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
      'Its reminders will be cancelled too. You’ll have a few seconds to undo.',
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
        <Text
          style={styles.storeLink}
          onPress={() =>
            navigation.navigate('StoreProfile', { storeName: item.storeName })
          }
        >
          {item.storeName}
        </Text>
        {'  ·  '}
        {formatPrice(item.price)} · bought {formatDate(item.purchaseDate)}
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

      {itemRecalls.map((alert) => (
        <View key={alert.id} style={styles.recallBanner}>
          <View style={styles.recallBannerHeader}>
            <Ionicons name="warning" size={16} color={colors.danger} />
            <Text style={styles.recallBannerTitle}>Possible recall match</Text>
          </View>
          <Text style={styles.recallBannerBody} numberOfLines={3}>
            {alert.title}
          </Text>
          {alert.hazard ? (
            <Text style={styles.recallBannerHazard} numberOfLines={2}>
              {alert.hazard}
            </Text>
          ) : null}
          <View style={styles.recallBannerActions}>
            <Pressable style={styles.recallViewBtn} onPress={() => void openUrl(alert.url)}>
              <Text style={styles.recallViewBtnText}>View official notice</Text>
            </Pressable>
            <Pressable
              onPress={() => void dismissRecallAlert(alert.id)}
              hitSlop={6}
              style={styles.recallDismiss}
            >
              <Text style={styles.recallDismissText}>Not my product</Text>
            </Pressable>
          </View>
        </View>
      ))}

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
            <Ionicons name="cash-outline" size={18} color={colors.success} />
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
            <Ionicons name="search" size={16} color={colors.success} />
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
          {returnDaysLeft >= 0 && (
            <Pressable onPress={() => addToCalendar('return')} hitSlop={6}>
              <Text style={styles.calLink}>Add to calendar</Text>
            </Pressable>
          )}
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
          {warrantyDaysLeft >= 0 && (
            <Pressable onPress={() => addToCalendar('warranty')} hitSlop={6}>
              <Text style={styles.calLink}>Add to calendar</Text>
            </Pressable>
          )}
        </Card>
      </View>

      {/* Card benefits: the free protection hiding in how they paid */}
      {(warrantyBoost || returnRescue) && (
        <View style={styles.cardPerkBox}>
          <View style={styles.cardPerkHeader}>
            <Ionicons name="card-outline" size={16} color={colors.success} />
            <Text style={styles.cardPerkTitle}>
              Paid with {cardLabel(item.paymentMethod)} — extra protection likely
            </Text>
          </View>
          {returnRescue && (
            <Text style={styles.cardPerkLine}>
              The store’s window closed, but many {cardLabel(item.paymentMethod)} cards
              refund items the store won’t take back for {CARD_RETURN_PROTECTION_DAYS}{' '}
              days after purchase —{' '}
              {returnRescue.daysLeft === 0
                ? 'today is likely the last day to claim'
                : `about ${returnRescue.daysLeft} day${
                    returnRescue.daysLeft === 1 ? '' : 's'
                  } left to claim`}
              .
            </Text>
          )}
          {warrantyBoost && (
            <Text style={styles.cardPerkLine}>
              Many {cardLabel(item.paymentMethod)} cards double the maker’s warranty (up
              to an extra year) — coverage could run to{' '}
              {formatDate(warrantyBoost.effectiveEndDate)}.
            </Text>
          )}
          <Text style={styles.cardPerkFootnote}>
            Benefits vary by card — check your card’s benefits guide or call the number
            on the back.
          </Text>
        </View>
      )}

      {/* Custom reminder — right under the deadlines so it can't be missed */}
      <Pressable
        style={({ pressed }) => [styles.reminderRow, pressed && { opacity: 0.9 }]}
        onPress={openReminderEditor}
      >
        <View style={styles.reminderIcon}>
          <Ionicons
            name={item.customReminder ? 'notifications' : 'add'}
            size={item.customReminder ? 18 : 22}
            color="#FFFFFF"
          />
        </View>
        <View style={styles.reminderText}>
          {item.customReminder ? (
            <>
              <Text style={styles.reminderTitle} numberOfLines={1}>
                {item.customReminder.note}
              </Text>
              <Text style={styles.reminderMeta}>
                Reminds you {formatDate(item.customReminder.date)} — tap to change
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.reminderTitle}>Set your own reminder</Text>
              <Text style={styles.reminderMeta}>
                Pick any date and note — “decide if I’m keeping this by Sunday”.
              </Text>
            </>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </Pressable>

      {/* Warranty claim assistant — active warranties are actionable */}
      {warrantyDaysLeft >= 0 && (
        <View style={styles.warrantyCard}>
          <View style={styles.warrantyHeader}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
            <Text style={styles.warrantyTitle}>Warranty help</Text>
          </View>
          <Text style={styles.warrantyBody}>
            Something wrong with it?{' '}
            {warrantyPage.known
              ? `File a claim with ${warrantyPage.label}`
              : 'Find the maker’s claim page'}
            {item.serialNumber ? ' — your serial number is ready to go.' : '.'}
          </Text>
          <Button title="File a warranty claim" onPress={fileWarrantyClaim} />
          <Pressable onPress={shareWarrantyClaim} style={styles.warrantyShare} hitSlop={6}>
            <Ionicons name="share-outline" size={15} color={colors.primary} />
            <Text style={styles.warrantyShareText}>Share claim details</Text>
          </Pressable>
          <Pressable
            onPress={() => void checkRecalls()}
            style={styles.warrantyShare}
            hitSlop={6}
            disabled={checkingRecalls}
          >
            <Ionicons name="shield-checkmark-outline" size={15} color={colors.primary} />
            <Text style={styles.warrantyShareText}>
              {checkingRecalls ? 'Checking the CPSC recall database…' : 'Check for recalls'}
            </Text>
          </Pressable>

          {showRegister && (
            <View style={styles.registerBox}>
              <View style={styles.registerRow}>
                <Pressable
                  style={styles.registerLinkBtn}
                  onPress={() => navigation.navigate('RegisterProduct', { itemId: item!.id })}
                  hitSlop={6}
                >
                  <Ionicons name="ribbon-outline" size={14} color={colors.primary} />
                  <Text style={styles.registerLink}>
                    Register with {warrantyPage.known ? warrantyPage.label : 'the maker'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void patchItem(item!.id, { productRegistered: true })}
                  hitSlop={6}
                >
                  <Text style={styles.registerDoneText}>Did it ✓</Text>
                </Pressable>
              </View>
              <Text style={styles.registerDisclaimer}>
                Optional — the US doesn’t require registration for warranty coverage.
                Your receipt is the proof, and Boughtly keeps it safe.
              </Text>
            </View>
          )}
          {item.productRegistered && (
            <Text style={styles.registeredNote}>✓ Registered with the manufacturer</Text>
          )}
        </View>
      )}

      {/* Protection plan (extended warranty) */}
      {item.protectionPlan && (
        <View style={styles.planCard}>
          <View style={styles.warrantyHeader}>
            <Ionicons name="umbrella-outline" size={18} color={colors.primary} />
            <Text style={styles.warrantyTitle}>
              {item.protectionPlan.provider} protection plan
            </Text>
          </View>
          <Text style={styles.warrantyBody}>
            {daysUntil(item.protectionPlan.endDate) < 0
              ? `Coverage ended ${formatDate(item.protectionPlan.endDate)}.`
              : `Covered through ${formatDate(item.protectionPlan.endDate)} — ${daysUntil(
                  item.protectionPlan.endDate
                )} days left.`}
          </Text>
          {item.protectionPlan.contact ? (
            <Button
              title="Contact the plan"
              onPress={() => {
                const c = item.protectionPlan!.contact!;
                const url = /^https?:/i.test(c)
                  ? c
                  : /[a-z]/i.test(c)
                  ? `https://${c}`
                  : `tel:${c.replace(/[^0-9+]/g, '')}`;
                Linking.openURL(url).catch(() => {});
              }}
            />
          ) : null}
        </View>
      )}

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
      {(() => {
        const pages =
          item.receiptImageUris ??
          (item.receiptImageUri ? [item.receiptImageUri] : []);
        if (pages.length === 0) return null;
        if (pages.length === 1) {
          return (
            <Card style={styles.receiptCard}>
              <Pressable onPress={() => setViewerUri(pages[0])}>
                <Image source={{ uri: pages[0] }} style={styles.receiptImage} />
                <Text style={styles.receiptHint}>Tap to view full screen</Text>
              </Pressable>
            </Card>
          );
        }
        return (
          <Card style={styles.receiptCard}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.receiptPagesRow}
            >
              {pages.map((uri, i) => (
                <Pressable key={`${uri}-${i}`} onPress={() => setViewerUri(uri)}>
                  <Image source={{ uri }} style={styles.receiptPageThumb} />
                  <Text style={styles.receiptPageNum}>Page {i + 1}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.receiptHint}>Tap a page to view full screen</Text>
          </Card>
        );
      })() ?? (
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

      {item.documents && item.documents.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Documents</Text>
          <Card style={styles.docsCard}>
            {item.documents.map((d, i) => (
              <Pressable
                key={`${d.uri}-${i}`}
                style={[styles.docOpenRow, i > 0 && styles.lineItemDivider]}
                onPress={async () => {
                  try {
                    if (await Sharing.isAvailableAsync()) {
                      await Sharing.shareAsync(d.uri);
                    }
                  } catch {
                    Alert.alert('Couldn’t open that', 'The file may have been moved.');
                  }
                }}
              >
                <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                <Text style={styles.docOpenName} numberOfLines={1}>
                  {d.name}
                </Text>
                <Ionicons name="open-outline" size={16} color={colors.muted} />
              </Pressable>
            ))}
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

      {/* Custom reminder editor */}
      <Modal
        visible={reminderOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setReminderOpen(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Remind me about this</Text>
            <Text style={styles.sheetSub}>
              One nudge, on the day you pick, at your usual reminder time.
            </Text>

            <Text style={styles.reminderLabel}>What should it say?</Text>
            <TextInput
          inputAccessoryViewID={DONE_ACCESSORY_ID}
              value={remNote}
              onChangeText={setRemNote}
              placeholder={`Check on ${item.itemName}`}
              placeholderTextColor={colors.muted}
              style={styles.reminderInput}
            />

            <Text style={styles.reminderLabel}>When?</Text>
            {Platform.OS === 'web' ? (
              <TextInput
          inputAccessoryViewID={DONE_ACCESSORY_ID}
                value={toISODate(remDate)}
                onChangeText={(t) => {
                  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) setRemDate(parseISODate(t));
                }}
                placeholder="2026-07-20"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                style={styles.reminderInput}
              />
            ) : (
              <>
                <Pressable
                  style={styles.reminderInput}
                  onPress={() => setRemPickerVisible(true)}
                >
                  <Text style={styles.reminderDateText}>{formatDate(toISODate(remDate))}</Text>
                </Pressable>
                {remPickerVisible && (
                  <DateTimePicker
                    value={remDate}
                    mode="date"
                    minimumDate={new Date()}
                    onChange={(event, date) => {
                      if (Platform.OS !== 'ios') setRemPickerVisible(false);
                      if (event.type !== 'dismissed' && date) setRemDate(date);
                    }}
                  />
                )}
              </>
            )}

            <Button title="Save reminder" onPress={() => void saveCustomReminder()} />
            {item.customReminder ? (
              <Pressable
                style={styles.sheetCancel}
                onPress={() => void removeCustomReminder()}
                hitSlop={8}
              >
                <Text style={styles.reminderRemove}>Remove this reminder</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.sheetCancel}
              onPress={() => setReminderOpen(false)}
              hitSlop={8}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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

const makeStyles = (colors: Palette) => StyleSheet.create({
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
  storeLink: {
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
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
  cardPerkBox: {
    backgroundColor: colors.successSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  cardPerkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  cardPerkTitle: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.success,
  },
  cardPerkLine: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
    marginTop: 4,
  },
  cardPerkFootnote: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
  },
  recallBanner: {
    backgroundColor: colors.coralSoft,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.danger,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  recallBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  recallBannerTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.danger,
  },
  recallBannerBody: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },
  recallBannerHazard: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
    lineHeight: 17,
  },
  recallBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  recallViewBtn: {
    backgroundColor: colors.danger,
    borderRadius: radii.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  recallViewBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  recallDismiss: {
    padding: 4,
  },
  recallDismissText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
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
    backgroundColor: colors.successSoft,
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
    color: colors.success,
  },
  adjustBadge: {
    backgroundColor: colors.success,
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
    color: colors.success,
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingVertical: 10,
  },
  adjustBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.success,
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
  calLink: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.primary,
    marginTop: 8,
  },
  warrantyCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  warrantyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warrantyTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.deepBlue,
  },
  warrantyBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.deepBlue,
    lineHeight: 19,
  },
  registerBox: {
    marginTop: spacing.sm,
    gap: 4,
  },
  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  registerLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  registerLink: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.primary,
  },
  registerDoneText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.muted,
  },
  registerDisclaimer: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    lineHeight: 15,
  },
  registeredNote: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.success,
  },
  planCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
    ...cardShadow,
  },
  warrantyShare: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  warrantyShareText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.primary,
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
  receiptPagesRow: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  receiptPageThumb: {
    width: 130,
    height: 180,
    borderRadius: radii.md,
    backgroundColor: colors.divider,
    resizeMode: 'cover',
  },
  receiptPageNum: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  reminderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderText: {
    flex: 1,
  },
  reminderTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.deepBlue,
  },
  reminderMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  reminderLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  reminderInput: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  reminderDateText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  reminderRemove: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.danger,
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
  docsCard: {
    paddingVertical: spacing.xs,
  },
  docOpenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
  },
  docOpenName: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.text,
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
