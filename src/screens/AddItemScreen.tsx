import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { OcrWebView } from '../components/OcrWebView';
import { Button, Card, ChipRow, Field } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { getOwnerApiKey } from '../services/ownerKey';
import { lookupPoliciesLive } from '../services/policyLive';
import { PolicySuggestion, suggestPolicies } from '../services/policyLookup';
import { ExtractedReceipt } from '../services/receiptOcr';
import { parseReceiptText } from '../services/receiptParser';
import { scanReceipt } from '../services/receiptScanner';
import { NewItemInput, useAppState } from '../store/AppStateContext';
import { colors, fonts, radii, spacing } from '../theme/theme';
import { RETURN_PRESETS, WARRANTY_PRESETS } from '../types/item';
import { formatDate, parseISODate, toISODate } from '../utils/dates';
import { successFeedback } from '../utils/haptics';

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
  const { items, settings, addItem, updateItem } = useAppState();
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
  const [scanning, setScanning] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Expo Go fallback: OCR runs in a hidden WebView (see OcrWebView)
  const [webOcrImage, setWebOcrImage] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  // Auto-filled policy note (store return window / category warranty)
  const [policyNotes, setPolicyNotes] = useState<string[]>([]);
  const [policyChecking, setPolicyChecking] = useState(false);
  const [policyVerified, setPolicyVerified] = useState(false);
  // Once the user picks a window themselves, auto-fill keeps its hands off
  const returnTouched = useRef(!!editing);
  const warrantyTouched = useRef(!!editing);
  const lastLookupRef = useRef('');

  function applySuggestion(
    suggestion: PolicySuggestion,
    verified: boolean,
    baseNotes: string[] = []
  ) {
    const notes = [...baseNotes];
    if (suggestion.returnDays !== undefined && !returnTouched.current) {
      setReturnDays(suggestion.returnDays);
      setReturnCustom(!RETURN_PRESET_DAYS.includes(suggestion.returnDays));
      if (suggestion.returnNote) notes.push(suggestion.returnNote);
    }
    if (suggestion.warrantyDays !== undefined && !warrantyTouched.current) {
      setWarrantyDays(suggestion.warrantyDays);
      setWarrantyCustom(!WARRANTY_PRESET_DAYS.includes(suggestion.warrantyDays));
      if (suggestion.warrantyNote) notes.push(suggestion.warrantyNote);
    }
    if (notes.length > 0) {
      setPolicyNotes(notes);
      setPolicyVerified(verified);
    }
  }

  /**
   * Fills the warranty (and the return window, when the receipt didn't print
   * one). Engine order: live web lookup for this exact item+store (owner key),
   * falling back to the built-in store-policy + product-category knowledge base.
   * `baseNotes` carries any note already set from the receipt itself.
   */
  async function applyPolicySuggestions(
    forItemName: string,
    forStoreName: string,
    baseNotes: string[] = [],
    /** Return window already locked in from the receipt, if any */
    knownReturnDays?: number
  ) {
    const item = forItemName.trim();
    const store = forStoreName.trim();
    if (!item && !store) return;
    // Nothing left to fill?
    if (returnTouched.current && warrantyTouched.current) return;
    // Don't re-run the expensive lookup for the same inputs
    const lookupKey = `${item}|${store}`.toLowerCase();
    if (lookupKey === lastLookupRef.current) return;
    lastLookupRef.current = lookupKey;

    const ownerKey = getOwnerApiKey(settings);
    if (ownerKey && item && store) {
      setPolicyChecking(true);
      try {
        const live = await lookupPoliciesLive(item, store, ownerKey);
        if (live.returnDays !== undefined || live.warrantyDays !== undefined) {
          applySuggestion(live, true, baseNotes);
          return;
        }
      } catch {
        // fall through to the knowledge base
      } finally {
        setPolicyChecking(false);
      }
    }
    applySuggestion(suggestPolicies(item, store, knownReturnDays), false, baseNotes);
  }

  // "Scan the receipt" path: open the camera right away
  const autoScanned = useRef(false);
  useEffect(() => {
    if (route.params?.mode === 'scan' && !editing && !autoScanned.current) {
      autoScanned.current = true;
      void pickImage(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Fills in whatever was read — never clobbers anything the user typed. */
  function applyExtracted(extracted: ExtractedReceipt) {
    if (extracted.itemName && !itemName.trim()) setItemName(extracted.itemName);
    if (extracted.storeName && !storeName.trim()) setStoreName(extracted.storeName);
    if (extracted.price !== null && !priceText.trim()) setPriceText(String(extracted.price));
    if (extracted.purchaseDate) setPurchaseDate(extracted.purchaseDate);

    // Highest authority for the return window: what the RECEIPT itself printed.
    // If present, lock it in so the store-policy lookup can't override it.
    const notes: string[] = [];
    if (extracted.returnDays !== null && !returnTouched.current) {
      setReturnDays(extracted.returnDays);
      setReturnCustom(!RETURN_PRESET_DAYS.includes(extracted.returnDays));
      returnTouched.current = true; // the receipt beats any guess
      notes.push(
        extracted.returnByDate
          ? `Return by ${formatDate(extracted.returnByDate)} — printed on your receipt (${extracted.returnDays} days)`
          : `${extracted.returnDays}-day return window — printed on your receipt`
      );
    }
    if (notes.length > 0) {
      setPolicyNotes(notes);
      setPolicyVerified(true);
    }

    // Fill the rest (warranty always; return window only if the receipt didn't say)
    applyPolicySuggestions(
      extracted.itemName ?? itemName,
      extracted.storeName ?? storeName,
      notes,
      extracted.returnDays ?? undefined
    );

    if (!extracted.itemName && !extracted.storeName && extracted.price === null) {
      Alert.alert(
        'Couldn’t read that receipt',
        'The photo is saved — fill in the details below and you’re set.'
      );
    }
  }

  /** Reads the receipt and auto-fills the form. Engine order: premium API →
   * native ML Kit (dev build) → hidden-WebView reader (works in Expo Go). */
  async function runOcr(imageUri: string) {
    setScanning(true);
    try {
      const extracted = await scanReceipt(imageUri, settings);
      if (extracted) {
        applyExtracted(extracted);
        setScanning(false);
        return;
      }
      if (Platform.OS === 'web') {
        setScanning(false);
        return; // manual entry on web
      }
      // Expo Go path: downscale the photo and hand it to the WebView reader.
      // scanning stays true until its callbacks fire.
      const resized = await manipulateAsync(imageUri, [{ resize: { width: 1200 } }], {
        compress: 0.8,
        format: SaveFormat.JPEG,
        base64: true,
      });
      if (!resized.base64) throw new Error('no base64');
      setOcrProgress(0);
      setWebOcrImage(`data:image/jpeg;base64,${resized.base64}`);
    } catch {
      // Reading failed; the photo is kept and the form stays manual
      setScanning(false);
    }
  }

  function finishWebOcr(text: string | null) {
    setWebOcrImage(null);
    setOcrProgress(null);
    setScanning(false);
    if (text !== null) applyExtracted(parseReceiptText(text));
  }

  async function pickImage(fromCamera: boolean) {
    // Browsers don't expose a camera this way — fall back to the file picker
    if (Platform.OS === 'web') fromCamera = false;
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
        const uri = result.assets[0].uri;
        setReceiptImageUri(uri);
        void runOcr(uri);
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
    if (parseISODate(purchaseDate).getTime() > Date.now()) {
      Alert.alert('Check the date', 'The purchase date can’t be in the future.');
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
        successFeedback();
        navigation.goBack();
      } else {
        await addItem(input);
        successFeedback();
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
          {scanning ? (
            <View style={styles.scanningRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.scanningText}>
                {ocrProgress !== null && ocrProgress > 0
                  ? `Reading your receipt… ${Math.round(ocrProgress * 100)}%`
                  : webOcrImage
                  ? 'Warming up the reader… (first scan downloads it)'
                  : 'Reading your receipt…'}
              </Text>
            </View>
          ) : (
            <Text style={styles.ocrNote}>
              {Platform.OS === 'web'
                ? 'On the phone, Boughtly reads receipt details automatically.'
                : 'Snap or pick a photo and Boughtly reads the details for you — right on your phone.'}
            </Text>
          )}
        </Card>

        {/* Details */}
        <Field
          label="What did you buy?"
          value={itemName}
          onChangeText={setItemName}
          onBlur={() => void applyPolicySuggestions(itemName, storeName)}
          placeholder="Noise-cancelling headphones"
        />
        <Field
          label="Where from?"
          value={storeName}
          onChangeText={setStoreName}
          onBlur={() => void applyPolicySuggestions(itemName, storeName)}
          placeholder="Best Buy"
        />
        <View style={styles.priceWrap}>
          <Text style={styles.priceLabel}>What did it cost?</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceCurrency}>$</Text>
            <TextInput
              value={priceText}
              onChangeText={setPriceText}
              placeholder="129.99"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              style={styles.priceInput}
            />
          </View>
        </View>
        {Platform.OS === 'web' ? (
          <Field
            label="Purchase date (YYYY-MM-DD)"
            value={purchaseDate}
            onChangeText={setPurchaseDate}
            placeholder="2026-07-05"
            autoCapitalize="none"
          />
        ) : (
          <View style={styles.dateFieldWrap}>
            <Text style={styles.dateFieldLabel}>When did you buy it?</Text>
            <Pressable style={styles.dateField} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.dateFieldValue}>{formatDate(purchaseDate)}</Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={parseISODate(purchaseDate)}
                mode="date"
                maximumDate={new Date()}
                onChange={(event, date) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (event.type !== 'dismissed' && date) {
                    setPurchaseDate(toISODate(date));
                  }
                  if (Platform.OS === 'ios') setShowDatePicker(false);
                }}
              />
            )}
          </View>
        )}

        {/* Auto-filled policy note */}
        {policyChecking && (
          <View style={styles.policyCard}>
            <View style={styles.policyCheckingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.policyTitle}>
                Looking up this item’s warranty & return policy…
              </Text>
            </View>
          </View>
        )}
        {!policyChecking && policyNotes.length > 0 && (
          <View style={styles.policyCard}>
            <Text style={styles.policyTitle}>
              {policyVerified ? 'Looked up for this item' : 'Filled in for you'}
            </Text>
            {policyNotes.map((note, i) => (
              <Text key={i} style={styles.policyNote}>
                • {note}
              </Text>
            ))}
            <Text style={styles.policyCaveat}>
              {policyVerified
                ? 'Checked online just now — still worth a glance below.'
                : 'Typical policy — tweak below if your receipt or product says otherwise.'}
            </Text>
          </View>
        )}

        {/* Return window */}
        <Text style={styles.sectionTitle}>Return window</Text>
        <ChipRow
          options={RETURN_PRESETS}
          selectedDays={returnDays}
          onSelect={(d) => {
            returnTouched.current = true;
            setReturnDays(d);
            setReturnCustom(false);
          }}
          onCustom={() => {
            returnTouched.current = true;
            setReturnCustom(true);
          }}
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
            warrantyTouched.current = true;
            setWarrantyDays(d);
            setWarrantyCustom(false);
          }}
          onCustom={() => {
            warrantyTouched.current = true;
            setWarrantyCustom(true);
          }}
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
          disabled={saving || !itemName.trim() || !priceText.trim()}
          style={styles.saveButton}
        />
      </ScrollView>

      {webOcrImage && (
        <OcrWebView
          imageDataUrl={webOcrImage}
          onProgress={setOcrProgress}
          onResult={(text) => finishWebOcr(text)}
          onError={() => finishWebOcr(null)}
        />
      )}
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
  scanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  scanningText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.primary,
  },
  priceWrap: {
    marginBottom: spacing.md,
  },
  priceLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  priceCurrency: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.muted,
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  dateFieldWrap: {
    marginBottom: spacing.md,
  },
  dateFieldLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    marginBottom: 6,
  },
  dateField: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  dateFieldValue: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.deepBlue,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  policyCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  policyCheckingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  policyTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.primary,
    marginBottom: 4,
  },
  policyNote: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.deepBlue,
    lineHeight: 19,
  },
  policyCaveat: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
  },
  customField: {
    marginTop: spacing.sm,
  },
  saveButton: {
    marginTop: spacing.lg,
  },
});
