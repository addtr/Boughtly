import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button, Card, ChipRow } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { suggestPolicies } from '../services/policyLookup';
import {
  buildPurchaseItem,
  defaultPurchaseName,
  lineItemsSum,
  parsePrice,
  ReviewRow,
} from '../services/reviewBuild';
import { useAppState } from '../store/AppStateContext';
import { colors, fonts, radii, spacing } from '../theme/theme';
import { RETURN_PRESETS } from '../types/item';
import { formatDate, formatPrice } from '../utils/dates';
import { findDuplicateItem } from '../utils/duplicates';
import { successFeedback, tapFeedback } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanReview'>;

const RETURN_PRESET_DAYS: number[] = RETURN_PRESETS.map((p) => p.days);

export function ScanReviewScreen({ navigation, route }: Props) {
  const { addItem, items } = useAppState();
  const params = route.params;

  const [storeName, setStoreName] = useState(params.storeName);
  const [purchaseName, setPurchaseName] = useState(defaultPurchaseName(params.storeName));
  const [purchaseDate, setPurchaseDate] = useState(params.purchaseDate);
  const [totalText, setTotalText] = useState(
    params.total !== null ? String(params.total) : ''
  );

  const initialReturn = useMemo(() => {
    if (params.returnDays) return params.returnDays;
    const pol = suggestPolicies('', params.storeName);
    return pol.returnDays ?? 30;
  }, [params.returnDays, params.storeName]);
  const [returnDays, setReturnDays] = useState(initialReturn);
  const [returnCustom, setReturnCustom] = useState(
    !RETURN_PRESET_DAYS.includes(initialReturn)
  );

  const [rows, setRows] = useState<ReviewRow[]>(
    params.items.map((i) => ({ name: i.name, priceText: String(i.price) }))
  );
  const [saving, setSaving] = useState(false);

  function setRowName(idx: number, name: string) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, name } : r)));
  }
  function setRowPrice(idx: number, priceText: string) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, priceText } : r)));
  }
  function removeRow(idx: number) {
    tapFeedback();
    setRows((rs) => rs.filter((_, i) => i !== idx));
  }
  function addRow() {
    tapFeedback();
    setRows((rs) => [...rs, { name: '', priceText: '' }]);
  }

  const itemsSum = lineItemsSum(rows);
  const totalNum = parsePrice(totalText);
  // Flag a likely mis-scan: total and the sum of items disagree by > 5%.
  const mismatch =
    totalNum !== null && itemsSum > 0 && Math.abs(totalNum - itemsSum) / totalNum > 0.05;

  async function save() {
    if (!purchaseName.trim()) {
      Alert.alert('Name this purchase', 'Give it a name so you can find it later.');
      return;
    }
    if (parsePrice(totalText) === null && itemsSum === 0) {
      Alert.alert('Add a total', 'Enter what you paid, or add at least one item with a price.');
      return;
    }
    // Warn if this looks like a purchase already tracked.
    const effPrice = parsePrice(totalText) ?? itemsSum;
    const dup = findDuplicateItem({ storeName, price: effPrice, purchaseDate }, items);
    if (dup) {
      Alert.alert(
        'Looks like a duplicate',
        `You already track “${dup.itemName}” from ${dup.storeName} on ${formatDate(
          dup.purchaseDate
        )} for ${formatPrice(dup.price)}. Save this one anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save anyway', onPress: () => void doSave() },
        ]
      );
      return;
    }
    await doSave();
  }

  async function doSave() {
    setSaving(true);
    try {
      const input = buildPurchaseItem(rows, {
        storeName,
        purchaseDate,
        returnDays,
        receiptImageUri: params.receiptImageUri,
        purchaseName,
        totalText,
      });
      await addItem(input);
      successFeedback();
      navigation.popToTop();
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>
          Here’s what Boughtly read off your receipt. Fix anything that looks off, then
          save it as one protected purchase.
        </Text>
        <Text style={styles.disclaimer}>
          Scans aren’t perfectly accurate and depend a lot on the condition of the
          receipt — give the details a quick once-over.
        </Text>

        {/* Purchase-level details */}
        <Card style={styles.card}>
          <Text style={styles.label}>Purchase name</Text>
          <TextInput
            value={purchaseName}
            onChangeText={setPurchaseName}
            placeholder="CVS Pharmacy purchase"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Text style={styles.label}>Store</Text>
          <TextInput
            value={storeName}
            onChangeText={setStoreName}
            placeholder="Where from?"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Text style={styles.label}>Purchase date (YYYY-MM-DD)</Text>
          <TextInput
            value={purchaseDate}
            onChangeText={setPurchaseDate}
            placeholder="2026-07-05"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            style={styles.input}
          />
          <Text style={styles.label}>Total paid</Text>
          <View style={styles.totalRow}>
            <Text style={styles.currency}>$</Text>
            <TextInput
              value={totalText}
              onChangeText={setTotalText}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              style={styles.totalInput}
            />
          </View>
          {mismatch && (
            <Text style={styles.mismatch}>
              Heads up: your items add up to {formatPrice(itemsSum)}, but the total says{' '}
              {formatPrice(totalNum!)}. Double-check both.
            </Text>
          )}

          <Text style={styles.label}>Return window (for the whole purchase)</Text>
          <ChipRow
            options={RETURN_PRESETS}
            selectedDays={returnDays}
            onSelect={(d) => {
              setReturnDays(d);
              setReturnCustom(false);
            }}
            onCustom={() => setReturnCustom(true)}
            customActive={returnCustom}
          />
          {returnCustom && (
            <TextInput
              value={String(returnDays || '')}
              onChangeText={(t) => setReturnDays(Number(t.replace(/[^0-9]/g, '')) || 0)}
              keyboardType="number-pad"
              placeholder="Return window (days)"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          )}
          {params.returnDays ? (
            <Text style={styles.receiptHint}>
              Read {params.returnDays} days off your receipt — change it if that's wrong.
            </Text>
          ) : null}
        </Card>

        {/* Item breakdown */}
        <View style={styles.itemsHeader}>
          <Text style={styles.sectionTitle}>
            Items on this receipt ({rows.length})
          </Text>
          <Text style={styles.sumText}>{formatPrice(itemsSum)}</Text>
        </View>
        <Card style={styles.card}>
          {rows.length === 0 && (
            <Text style={styles.noItems}>
              No items detected. Add them below or just save with the total.
            </Text>
          )}
          {rows.map((r, idx) => (
            <View key={idx} style={styles.itemRow}>
              <TextInput
                value={r.name}
                onChangeText={(t) => setRowName(idx, t)}
                placeholder="Item name"
                placeholderTextColor={colors.muted}
                style={styles.itemName}
              />
              <View style={styles.itemPriceBox}>
                <Text style={styles.currencySmall}>$</Text>
                <TextInput
                  value={r.priceText}
                  onChangeText={(t) => setRowPrice(idx, t)}
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  style={styles.itemPrice}
                />
              </View>
              <Pressable onPress={() => removeRow(idx)} hitSlop={8} style={styles.removeBtn}>
                <Ionicons name="close-circle" size={22} color={colors.muted} />
              </Pressable>
            </View>
          ))}
          <Pressable onPress={addRow} style={styles.addRow}>
            <Ionicons name="add-circle" size={20} color={colors.primary} />
            <Text style={styles.addRowText}>Add an item</Text>
          </Pressable>
        </Card>

        <Button
          title={saving ? 'Saving…' : 'Protect this purchase'}
          variant="coral"
          onPress={save}
          disabled={saving}
          style={styles.saveBtn}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  intro: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  disclaimer: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.muted,
    lineHeight: 16,
    marginBottom: spacing.md,
  },
  card: { marginBottom: spacing.lg },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  currency: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.deepBlue,
    marginRight: 6,
  },
  totalInput: {
    flex: 1,
    paddingVertical: 11,
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.deepBlue,
  },
  mismatch: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.coral,
    marginTop: 6,
    lineHeight: 17,
  },
  receiptHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.primary,
    marginTop: 4,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.deepBlue,
  },
  sumText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.muted,
  },
  noItems: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    paddingVertical: spacing.sm,
    lineHeight: 18,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  itemName: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.deepBlue,
  },
  itemPriceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    width: 92,
  },
  currencySmall: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.muted,
    marginRight: 2,
  },
  itemPrice: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  removeBtn: { padding: 2 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  addRowText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.primary,
  },
  saveBtn: { marginTop: spacing.xs },
});
