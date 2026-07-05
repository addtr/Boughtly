import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, Card, ChipRow, Field } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { NewItemInput, useAppState } from '../store/AppStateContext';
import { colors, fonts, radii, spacing } from '../theme/theme';
import { RETURN_PRESETS, WARRANTY_PRESETS } from '../types/item';
import { toISODate } from '../utils/dates';

type Props = NativeStackScreenProps<RootStackParamList, 'AddItem'>;

const WARRANTY_PRESET_DAYS: number[] = WARRANTY_PRESETS.map((p) => p.days);
const RETURN_PRESET_DAYS: number[] = RETURN_PRESETS.map((p) => p.days);

/** Copy a picked photo into the app's documents dir so it survives cache cleanup. */
function persistReceiptImage(sourceUri: string): string {
  const ext = sourceUri.split('.').pop()?.split('?')[0] || 'jpg';
  const dest = new File(Paths.document, `receipt-${Date.now()}.${ext}`);
  new File(sourceUri).copy(dest);
  return dest.uri;
}

function parsePriceInput(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function isValidISODate(raw: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const [y, m, d] = raw.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function AddItemScreen({ navigation, route }: Props) {
  const { items, addItem, updateItem } = useAppState();
  const editingId = route.params?.itemId;
  const editing = useMemo(
    () => items.find((i) => i.id === editingId),
    [items, editingId]
  );

  const [itemName, setItemName] = useState(editing?.itemName ?? '');
  const [storeName, setStoreName] = useState(editing?.storeName ?? '');
  const [priceText, setPriceText] = useState(editing ? String(editing.price) : '');
  const [purchaseDate, setPurchaseDate] = useState(
    editing?.purchaseDate ?? toISODate(new Date())
  );
  const [receiptImageUri, setReceiptImageUri] = useState<string | null>(
    editing?.receiptImageUri ?? null
  );
  const [notes, setNotes] = useState(editing?.notes ?? '');

  const [warrantyDays, setWarrantyDays] = useState<number>(
    editing?.warrantyLengthDays ?? 365
  );
  const [warrantyCustom, setWarrantyCustom] = useState(
    editing ? !WARRANTY_PRESET_DAYS.includes(editing.warrantyLengthDays) : false
  );
  const [returnDays, setReturnDays] = useState<number>(editing?.returnWindowDays ?? 30);
  const [returnCustom, setReturnCustom] = useState(
    editing ? !RETURN_PRESET_DAYS.includes(editing.returnWindowDays) : false
  );
  const [saving, setSaving] = useState(false);

  async function pickImage(fromCamera: boolean) {
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera needed', 'Allow camera access to snap your receipt.');
          return;
        }
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled && result.assets[0]) {
        setReceiptImageUri(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Something went wrong', 'We couldn’t open that. Try again.');
    }
  }

  async function handleSave() {
    const price = parsePriceInput(priceText);
    if (!itemName.trim()) {
      Alert.alert('Almost there', 'Give this item a name so you can find it later.');
      return;
    }
    if (price === null) {
      Alert.alert('Almost there', 'Enter what you paid — numbers only is fine.');
      return;
    }
    if (!isValidISODate(purchaseDate)) {
      Alert.alert('Check the date', 'Use the format YYYY-MM-DD, like 2026-07-05.');
      return;
    }
    if (warrantyDays <= 0 || returnDays <= 0) {
      Alert.alert('Check the windows', 'Warranty and return lengths need to be at least 1 day.');
      return;
    }

    setSaving(true);
    try {
      let storedUri = receiptImageUri;
      // Only copy newly-picked images (cache paths); already-persisted ones keep their URI
      if (storedUri && !storedUri.includes('receipt-')) {
        try {
          storedUri = persistReceiptImage(storedUri);
        } catch {
          // fall back to the original URI rather than blocking the save
        }
      }
      const input: NewItemInput = {
        itemName: itemName.trim(),
        storeName: storeName.trim() || 'Unknown store',
        price,
        purchaseDate,
        receiptImageUri: storedUri,
        warrantyLengthDays: warrantyDays,
        returnWindowDays: returnDays,
        notes: notes.trim() || undefined,
      };
      if (editing) {
        await updateItem(editing.id, input);
        navigation.goBack();
      } else {
        await addItem(input);
        navigation.popToTop();
      }
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
        {/* Receipt photo */}
        <Card style={styles.receiptCard}>
          {receiptImageUri ? (
            <Image source={{ uri: receiptImageUri }} style={styles.receiptPreview} />
          ) : (
            <Text style={styles.receiptHint}>
              Snap the receipt now — you’ll thank yourself at the return counter.
            </Text>
          )}
          <View style={styles.receiptButtons}>
            <Button
              title={receiptImageUri ? 'Retake photo' : 'Scan receipt'}
              onPress={() => pickImage(true)}
              style={styles.flex}
            />
            <Button
              title="Choose photo"
              variant="ghost"
              onPress={() => pickImage(false)}
              style={styles.flex}
            />
          </View>
          <Text style={styles.ocrNote}>
            Auto-reading receipt details is coming soon — for now, fill in the details below.
          </Text>
        </Card>

        {/* Details */}
        <Field
          label="What did you buy?"
          value={itemName}
          onChangeText={setItemName}
          placeholder="Noise-cancelling headphones"
        />
        <Field
          label="Where from?"
          value={storeName}
          onChangeText={setStoreName}
          placeholder="Best Buy"
        />
        <Field
          label="What did it cost?"
          value={priceText}
          onChangeText={setPriceText}
          placeholder="129.99"
          keyboardType="decimal-pad"
        />
        <Field
          label="Purchase date (YYYY-MM-DD)"
          value={purchaseDate}
          onChangeText={setPurchaseDate}
          placeholder="2026-07-05"
          autoCapitalize="none"
        />

        {/* Return window */}
        <Text style={styles.sectionTitle}>Return window</Text>
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
          <View style={styles.customField}>
            <Field
              label="Return window (days)"
              value={String(returnDays || '')}
              onChangeText={(t) => setReturnDays(Number(t.replace(/[^0-9]/g, '')) || 0)}
              keyboardType="number-pad"
              placeholder="45"
            />
          </View>
        )}

        {/* Warranty */}
        <Text style={styles.sectionTitle}>Warranty length</Text>
        <ChipRow
          options={WARRANTY_PRESETS}
          selectedDays={warrantyDays}
          onSelect={(d) => {
            setWarrantyDays(d);
            setWarrantyCustom(false);
          }}
          onCustom={() => setWarrantyCustom(true)}
          customActive={warrantyCustom}
        />
        {warrantyCustom && (
          <View style={styles.customField}>
            <Field
              label="Warranty length (days)"
              value={String(warrantyDays || '')}
              onChangeText={(t) => setWarrantyDays(Number(t.replace(/[^0-9]/g, '')) || 0)}
              keyboardType="number-pad"
              placeholder="180"
            />
          </View>
        )}

        <Field
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Serial number, gift receipt, etc."
          multiline
        />

        <Button
          title={saving ? 'Saving…' : editing ? 'Save changes' : 'Start protecting this'}
          variant="coral"
          onPress={handleSave}
          disabled={saving}
          style={styles.saveButton}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  receiptCard: {
    marginBottom: spacing.lg,
  },
  receiptPreview: {
    width: '100%',
    height: 180,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    backgroundColor: colors.divider,
    resizeMode: 'cover',
  },
  receiptHint: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  receiptButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ocrNote: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.deepBlue,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  customField: {
    marginTop: spacing.sm,
  },
  saveButton: {
    marginTop: spacing.lg,
  },
});
