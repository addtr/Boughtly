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
  buildScanItems,
  parsePrice,
  ReviewRow as Row,
  warrantyForItem,
} from '../services/reviewBuild';
import { useAppState } from '../store/AppStateContext';
import { colors, fonts, radii, spacing } from '../theme/theme';
import { RETURN_PRESETS } from '../types/item';
import { formatPrice } from '../utils/dates';
import { successFeedback, tapFeedback } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanReview'>;

const RETURN_PRESET_DAYS: number[] = RETURN_PRESETS.map((p) => p.days);

export function ScanReviewScreen({ navigation, route }: Props) {
  const { addItem } = useAppState();
  const params = route.params;

  const [storeName, setStoreName] = useState(params.storeName);
  const [purchaseDate, setPurchaseDate] = useState(params.purchaseDate);

  // Shared return window: from the receipt if it printed one, else store policy
  const initialReturn = useMemo(() => {
    if (params.returnDays) return params.returnDays;
    const pol = suggestPolicies('', params.storeName);
    return pol.returnDays ?? 30;
  }, [params.returnDays, params.storeName]);
  const [returnDays, setReturnDays] = useState(initialReturn);
  const [returnCustom, setReturnCustom] = useState(
    !RETURN_PRESET_DAYS.includes(initialReturn)
  );

  // Pre-select the priciest item; leave the rest for the user to opt in.
  const maxPrice = Math.max(...params.items.map((i) => i.price), 0);
  const [rows, setRows] = useState<Row[]>(
    params.items.map((i) => ({
      name: i.name,
      priceText: String(i.price),
      selected: i.price === maxPrice,
    }))
  );
  const [saving, setSaving] = useState(false);

  const selectedCount = rows.filter((r) => r.selected).length;

  function toggle(idx: number) {
    tapFeedback();
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)));
  }
  function setName(idx: number, name: string) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, name } : r)));
  }
  function setPrice(idx: number, priceText: string) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, priceText } : r)));
  }

  const warrantyFor = (name: string) => warrantyForItem(name, storeName, returnDays);

  async function saveSelected() {
    const chosen = rows.filter((r) => r.selected);
    if (chosen.length === 0) {
      Alert.alert('Pick at least one', 'Tap the items you want Boughtly to protect.');
      return;
    }
    for (const r of chosen) {
      if (!r.name.trim() || parsePrice(r.priceText) === null) {
        Alert.alert('Check the items', 'Each selected item needs a name and a price.');
        return;
      }
    }
    setSaving(true);
    try {
      const inputs = buildScanItems(rows, {
        storeName,
        purchaseDate,
        returnDays,
        receiptImageUri: params.receiptImageUri,
      });
      for (const input of inputs) {
        await addItem(input);
      }
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
          Found {params.items.length} item{params.items.length === 1 ? '' : 's'} on your
          receipt. Tap the ones worth protecting, fix anything the scan misread, then save.
        </Text>

        {/* Shared details */}
        <Card style={styles.sharedCard}>
          <Text style={styles.sharedLabel}>Store</Text>
          <TextInput
            value={storeName}
            onChangeText={setStoreName}
            placeholder="Where from?"
            placeholderTextColor={colors.muted}
            style={styles.sharedInput}
          />
          <Text style={styles.sharedLabel}>Purchase date (YYYY-MM-DD)</Text>
          <TextInput
            value={purchaseDate}
            onChangeText={setPurchaseDate}
            placeholder="2026-07-05"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            style={styles.sharedInput}
          />
          <Text style={styles.sharedLabel}>Return window (applies to all)</Text>
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
              style={styles.sharedInput}
            />
          )}
          {params.returnDays ? (
            <Text style={styles.sharedHint}>
              Read {params.returnDays} days off your receipt — change it if that's wrong.
            </Text>
          ) : null}
        </Card>

        {/* Item rows */}
        <Text style={styles.sectionTitle}>Items</Text>
        {rows.map((r, idx) => {
          const w = warrantyFor(r.name);
          return (
            <Card key={idx} style={[styles.itemCard, r.selected && styles.itemCardOn]}>
              <Pressable onPress={() => toggle(idx)} style={styles.itemHeader}>
                <View style={[styles.check, r.selected && styles.checkOn]}>
                  {r.selected && <Ionicons name="checkmark" size={15} color="#FFFFFF" />}
                </View>
                <Text style={styles.itemHeaderText}>
                  {r.selected ? 'Protecting this' : 'Tap to protect'}
                </Text>
                {r.selected && (
                  <Text style={styles.warrantyTag}>
                    {w >= 365 ? `${Math.round(w / 365)} yr warranty` : `${w}-day cover`}
                  </Text>
                )}
              </Pressable>
              {r.selected && (
                <View style={styles.itemFields}>
                  <TextInput
                    value={r.name}
                    onChangeText={(t) => setName(idx, t)}
                    placeholder="Item name"
                    placeholderTextColor={colors.muted}
                    style={styles.itemInput}
                  />
                  <View style={styles.priceRow}>
                    <Text style={styles.currency}>$</Text>
                    <TextInput
                      value={r.priceText}
                      onChangeText={(t) => setPrice(idx, t)}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={colors.muted}
                      style={styles.priceInput}
                    />
                  </View>
                </View>
              )}
              {!r.selected && (
                <Text style={styles.itemPreview} numberOfLines={1}>
                  {r.name} · {formatPrice(parsePrice(r.priceText) ?? 0)}
                </Text>
              )}
            </Card>
          );
        })}

        <Button
          title={
            saving
              ? 'Saving…'
              : selectedCount === 0
              ? 'Pick items to protect'
              : `Protect ${selectedCount} item${selectedCount === 1 ? '' : 's'}`
          }
          variant="coral"
          onPress={saveSelected}
          disabled={saving || selectedCount === 0}
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
    marginBottom: spacing.md,
  },
  sharedCard: { marginBottom: spacing.lg },
  sharedLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  sharedInput: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sharedHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.primary,
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.deepBlue,
    marginBottom: spacing.sm,
  },
  itemCard: { marginBottom: spacing.sm, padding: spacing.md },
  itemCardOn: { backgroundColor: '#FFFFFF' },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary },
  itemHeaderText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    flex: 1,
  },
  warrantyTag: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.primary,
  },
  itemFields: { marginTop: spacing.sm, gap: spacing.sm },
  itemInput: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.deepBlue,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  currency: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.muted,
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 11,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  itemPreview: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    marginTop: spacing.sm,
    marginLeft: 32,
  },
  saveBtn: { marginTop: spacing.lg },
});
