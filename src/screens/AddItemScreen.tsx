import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
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
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { OcrWebView } from '../components/OcrWebView';
import { Button, Card, ChipRow, Field } from '../components/ui';
import { useToast } from '../components/Toast';
import { RootStackParamList } from '../navigation/types';
import { consumePendingBarcodeItemName } from '../services/barcode';
import {
  correctStore,
  learnStoreCorrection,
  loadCorrections,
} from '../services/corrections';
import {
  makeReceiptThumb,
  persistProductImage,
  persistReceiptImage,
} from '../services/imageStore';
import { getOwnerApiKey } from '../services/ownerKey';
import { canAddFile, FREE_FILES_PER_ITEM } from '../services/plus';
import { lookupPoliciesLive } from '../services/policyLive';
import { PolicySuggestion, suggestPolicies } from '../services/policyLookup';
import { ExtractedReceipt } from '../services/receiptOcr';
import { parseReceiptText } from '../services/receiptParser';
import { scanReceipt } from '../services/receiptScanner';
import { NewItemInput, useAppState } from '../store/AppStateContext';
import { Palette, cardShadow, fonts, radii, spacing } from '../theme/theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import {
  PAYMENT_METHOD_OPTIONS,
  PaymentMethod,
  RETURN_PRESETS,
  WARRANTY_PRESETS,
} from '../types/item';
import { formatDate, formatPrice, parseISODate, toISODate } from '../utils/dates';
import { findDuplicateItem } from '../utils/duplicates';
import { successFeedback } from '../utils/haptics';
import { DONE_ACCESSORY_ID } from '../components/KeyboardDoneBar';

type Props = NativeStackScreenProps<RootStackParamList, 'AddItem'>;

const WARRANTY_PRESET_DAYS: number[] = WARRANTY_PRESETS.map((p) => p.days);
const RETURN_PRESET_DAYS: number[] = RETURN_PRESETS.map((p) => p.days);

// Photo persistence (capped resolution + list thumbnails) lives in imageStore.

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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const toast = useToast();
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
  // All receipt pages (long receipts need several photos). First page = OCR.
  const [receiptImages, setReceiptImages] = useState<string[]>(
    editing?.receiptImageUris ??
      (editing?.receiptImageUri ? [editing.receiptImageUri] : [])
  );
  const receiptImageUri = receiptImages[0] ?? null;
  // Fresh value inside async OCR callbacks (state in that closure is stale).
  const receiptImagesRef = useRef(receiptImages);
  receiptImagesRef.current = receiptImages;
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [isGift, setIsGift] = useState(editing?.isGift ?? false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>(
    editing?.paymentMethod
  );
  const [serialNumber, setSerialNumber] = useState(editing?.serialNumber ?? '');
  // Extended warranty / protection plan
  const [hasPlan, setHasPlan] = useState(!!editing?.protectionPlan);
  const [planProvider, setPlanProvider] = useState(editing?.protectionPlan?.provider ?? '');
  const [planDays, setPlanDays] = useState<number>(editing?.protectionPlan?.lengthDays ?? 730);
  const [planContact, setPlanContact] = useState(editing?.protectionPlan?.contact ?? '');
  const [productPhotos, setProductPhotos] = useState<string[]>(editing?.productPhotos ?? []);
  const [tags, setTags] = useState<string[]>(editing?.tags ?? []);
  const [tagDraft, setTagDraft] = useState('');
  const [documents, setDocuments] = useState<{ name: string; uri: string }[]>(
    editing?.documents ?? []
  );
  // Free tier is capped on extra attachments; show a PLUS hint once it's hit.
  const extrasLocked =
    !settings.isPlus && productPhotos.length + documents.length >= FREE_FILES_PER_ITEM;

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
  // Return-key chaining: name → store → price
  const storeRef = useRef<TextInput>(null);
  const priceRef = useRef<TextInput>(null);
  const lastLookupRef = useRef('');
  // Raw store text a scan produced, so we can learn a correction if the user edits it.
  const extractedStoreRaw = useRef<string | null>(null);

  // Load learned store-name corrections so scans can apply them.
  useEffect(() => {
    void loadCorrections();
  }, []);

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

  // "Scan the receipt" path: open the camera automatically — but only AFTER the
  // screen finishes animating in. Launching the camera mid-transition makes iOS
  // dismiss it instantly (you can't present over an in-progress transition),
  // which looked like the camera "flashing" and dumping you back on the form.
  const autoScanned = useRef(false);
  useEffect(() => {
    const mode = route.params?.mode;
    if ((mode !== 'scan' && mode !== 'photo' && mode !== 'barcode') || editing || autoScanned.current)
      return;
    const launch = () => {
      if (autoScanned.current) return;
      autoScanned.current = true;
      if (mode === 'barcode') {
        navigation.navigate('BarcodeScan');
      } else {
        // 'scan' opens the camera; 'photo' the library (e.g. a screenshot)
        void pickImage(mode === 'scan');
      }
    };
    // Fires once the push/replace transition settles.
    const unsub = navigation.addListener('transitionEnd', launch);
    // Safety net if transitionEnd never arrives (reduced motion, web, etc.).
    const fallback = setTimeout(launch, 700);
    return () => {
      unsub();
      clearTimeout(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A barcode scan finished — pick up the product name it found.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      const name = consumePendingBarcodeItemName();
      if (name) {
        setItemName((prev) => (prev.trim() ? prev : name));
        void applyPolicySuggestions(name, storeName);
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  // Pasted receipt/email text: parse it and route just like a scan would.
  const pastedProcessed = useRef(false);
  useEffect(() => {
    const scanText = route.params?.scanText;
    if (!scanText || editing || pastedProcessed.current) return;
    pastedProcessed.current = true;
    void handleExtracted(parseReceiptText(scanText));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Route a scan result: 2+ items → the multi-item review screen; otherwise
   * fill this single-item form. Only routes for a fresh scan (not editing,
   * and only when the user hasn't already typed an item name).
   */
  async function handleExtracted(extracted: ExtractedReceipt) {
    if (!editing && extracted.lineItems.length >= 2 && !itemName.trim()) {
      // Persist the receipt photo so every created item shares it.
      // (Read via ref — this runs after an await, where state is stale.)
      let persisted: string | null = receiptImagesRef.current[0] ?? null;
      let thumb: string | null = null;
      if (persisted && !persisted.includes('receipt-')) {
        persisted = await persistReceiptImage(persisted);
      }
      if (persisted) thumb = await makeReceiptThumb(persisted);
      const correctedStore = extracted.storeName
        ? correctStore(extracted.storeName) ?? extracted.storeName
        : '';
      navigation.replace('ScanReview', {
        storeName: correctedStore,
        purchaseDate: extracted.purchaseDate ?? toISODate(new Date()),
        returnDays: extracted.returnDays,
        receiptImageUri: persisted,
        receiptThumbUri: thumb,
        total: extracted.price,
        items: extracted.lineItems.map((li) => ({ name: li.name, price: li.price })),
      });
      return;
    }
    applyExtracted(extracted);
  }

  /** Fills in whatever was read — never clobbers anything the user typed. */
  function applyExtracted(extracted: ExtractedReceipt) {
    if (extracted.itemName && !itemName.trim()) setItemName(extracted.itemName);
    // Apply any learned correction for this store's raw scanned text.
    const correctedStore = extracted.storeName
      ? correctStore(extracted.storeName) ?? extracted.storeName
      : null;
    if (extracted.storeName) extractedStoreRaw.current = extracted.storeName;
    if (correctedStore && !storeName.trim()) setStoreName(correctedStore);
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
      correctedStore ?? storeName,
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
        setScanning(false);
        void handleExtracted(extracted);
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
    if (text !== null) void handleExtracted(parseReceiptText(text));
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
        const isFirstPage = receiptImages.length === 0;
        setReceiptImages((prev) => [...prev, uri]);
        // Only the first page drives auto-fill; extra pages are kept as proof.
        if (isFirstPage) void runOcr(uri);
      }
    } catch (e) {
      Alert.alert('Something went wrong', 'We couldn’t open that. Try again.');
    }
  }

  async function pickProductPhoto(fromCamera: boolean) {
    if (Platform.OS === 'web') fromCamera = false;
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera needed', 'Allow camera access to add a photo.');
          return;
        }
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            allowsMultipleSelection: true,
          });
      if (!result.canceled && result.assets.length > 0) {
        setProductPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
      }
    } catch {
      Alert.alert('Something went wrong', 'We couldn’t add that photo. Try again.');
    }
  }

  // Free tier caps extra attachments (product photos + docs) per item; Plus is
  // unlimited. Receipt pages stay free since they're core to the receipt.
  function guardExtraFile(): boolean {
    if (canAddFile(productPhotos.length + documents.length, settings.isPlus)) return true;
    navigation.navigate('Plus');
    return false;
  }

  function addProductPhotoPrompt() {
    if (!guardExtraFile()) return;
    if (Platform.OS === 'web') {
      void pickProductPhoto(false);
      return;
    }
    Alert.alert('Add a product photo', 'Great for the serial plate, box, or condition.', [
      { text: 'Take a photo', onPress: () => pickProductPhoto(true) },
      { text: 'Choose from library', onPress: () => pickProductPhoto(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function removeProductPhoto(idx: number) {
    setProductPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  /** Attach a PDF/image document (warranty card, manual, receipt PDF). */
  async function pickDocument() {
    if (!guardExtraFile()) return;
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'text/plain'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (res.canceled || res.assets.length === 0) return;
      const added = res.assets.map((a) => {
        // Copy into the documents dir so it survives cache cleanup.
        try {
          const ext = a.name?.split('.').pop() || a.uri.split('.').pop() || 'pdf';
          const rand = Math.random().toString(36).slice(2, 7);
          const dest = new File(Paths.document, `doc-${Date.now()}-${rand}.${ext}`);
          new File(a.uri).copy(dest);
          return { name: a.name ?? `document.${ext}`, uri: dest.uri };
        } catch {
          return { name: a.name ?? 'document', uri: a.uri };
        }
      });
      setDocuments((prev) => [...prev, ...added]);
    } catch {
      Alert.alert('Something went wrong', 'We couldn’t attach that file. Try again.');
    }
  }

  function removeDocument(idx: number) {
    setDocuments((prev) => prev.filter((_, i) => i !== idx));
  }

  function addTag() {
    const t = tagDraft.trim().replace(/,/g, '').toLowerCase();
    setTagDraft('');
    if (!t) return;
    setTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
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

    // Warn before saving what looks like the same purchase twice.
    if (!editing) {
      const dup = findDuplicateItem(
        { storeName: storeName.trim() || 'Unknown store', price, purchaseDate },
        items
      );
      if (dup) {
        Alert.alert(
          'Looks like a duplicate',
          `You already track “${dup.itemName}” from ${dup.storeName} on ${formatDate(
            dup.purchaseDate
          )} for ${formatPrice(dup.price)}. Add this one anyway?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add anyway', onPress: () => void persistSave(price) },
          ]
        );
        return;
      }
    }
    await persistSave(price);
  }

  async function persistSave(price: number) {
    setSaving(true);
    try {
      // Persist every receipt page (only newly-picked cache paths get copied;
      // persistence caps resolution so list rows and disk stay light).
      const storedReceipts: string[] = await Promise.all(
        receiptImages.map((uri) =>
          uri.includes('receipt-') ? Promise.resolve(uri) : persistReceiptImage(uri)
        )
      );
      const storedUri = storedReceipts[0] ?? null;
      // Small thumbnail of page 1 for the dashboard list. Reuse an existing
      // one only if the first page didn't change.
      let storedThumb: string | undefined;
      if (storedUri) {
        if (editing?.receiptThumbUri && editing.receiptImageUri === storedUri) {
          storedThumb = editing.receiptThumbUri;
        } else {
          storedThumb = (await makeReceiptThumb(storedUri)) ?? undefined;
        }
      }
      // Persist any freshly-picked product photos to the documents dir.
      const storedPhotos: string[] = await Promise.all(
        productPhotos.map((uri) =>
          uri.includes('product-') ? Promise.resolve(uri) : persistProductImage(uri)
        )
      );

      const input: NewItemInput = {
        itemName: itemName.trim(),
        storeName: storeName.trim() || 'Unknown store',
        price,
        purchaseDate,
        receiptImageUri: storedUri,
        receiptImageUris: storedReceipts.length > 0 ? storedReceipts : undefined,
        receiptThumbUri: storedThumb,
        warrantyLengthDays: warrantyDays,
        returnWindowDays: returnDays,
        notes: notes.trim() || undefined,
        isGift: isGift || undefined,
        paymentMethod,
        tags: tags.length > 0 ? tags : undefined,
        serialNumber: serialNumber.trim() || undefined,
        productPhotos: storedPhotos.length > 0 ? storedPhotos : undefined,
        documents: documents.length > 0 ? documents : undefined,
        protectionPlan:
          hasPlan && planProvider.trim()
            ? {
                provider: planProvider.trim(),
                lengthDays: planDays,
                contact: planContact.trim() || undefined,
              }
            : undefined,
      };
      // Learn a store-name correction from a fresh scan the user edited.
      if (!editing && extractedStoreRaw.current && storeName.trim()) {
        void learnStoreCorrection(extractedStoreRaw.current, storeName.trim());
      }

      if (editing) {
        await updateItem(editing.id, input);
        toast('Changes saved');
        navigation.goBack();
      } else {
        await addItem(input);
        toast(`${input.itemName} is now protected`);
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
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Receipt photo */}
        <Card style={styles.receiptCard}>
          {receiptImages.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.receiptPages}
            >
              {receiptImages.map((uri, idx) => (
                <View key={`${uri}-${idx}`} style={styles.receiptPageWrap}>
                  <Image source={{ uri }} style={styles.receiptPage} />
                  <Text style={styles.receiptPageLabel}>
                    {idx === 0 ? 'Page 1 (scanned)' : `Page ${idx + 1}`}
                  </Text>
                  <Pressable
                    style={styles.receiptPageRemove}
                    onPress={() =>
                      setReceiptImages((prev) => prev.filter((_, i) => i !== idx))
                    }
                    hitSlop={6}
                    accessibilityLabel="Remove page"
                  >
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.receiptHint}>
              Snap the receipt now — you’ll thank yourself at the return counter.
            </Text>
          )}
          <View style={styles.receiptButtons}>
            <Button
              title={receiptImages.length > 0 ? 'Add another page' : 'Scan receipt'}
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
          <Text style={styles.scanDisclaimer}>
            Scans aren’t perfectly accurate and depend a lot on the condition of the
            receipt — double-check the details below before saving.
          </Text>
        </Card>

        {/* Details */}
        <Field
          label="What did you buy?"
          value={itemName}
          onChangeText={setItemName}
          onBlur={() => void applyPolicySuggestions(itemName, storeName)}
          placeholder="Noise-cancelling headphones"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => storeRef.current?.focus()}
        />
        {!editing && Platform.OS !== 'web' && (
          <Pressable
            style={styles.barcodeBtn}
            onPress={() => navigation.navigate('BarcodeScan')}
            hitSlop={6}
          >
            <Ionicons name="barcode-outline" size={18} color={colors.primary} />
            <Text style={styles.barcodeBtnText}>Scan the product barcode instead</Text>
          </Pressable>
        )}
        <Field
          ref={storeRef}
          label="Where from?"
          value={storeName}
          onChangeText={setStoreName}
          onBlur={() => void applyPolicySuggestions(itemName, storeName)}
          placeholder="Best Buy"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => priceRef.current?.focus()}
        />
        <View style={styles.priceWrap}>
          <Text style={styles.priceLabel}>What did it cost?</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceCurrency}>$</Text>
            <TextInput
              ref={priceRef}
              inputAccessoryViewID={DONE_ACCESSORY_ID}
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

        {/* Gift flag */}
        <View style={styles.giftRow}>
          <View style={styles.giftText}>
            <Text style={styles.giftLabel}>This was a gift</Text>
            <Text style={styles.giftHint}>
              Returns usually mean store credit or an exchange, not cash back.
            </Text>
          </View>
          <Switch
            value={isGift}
            onValueChange={setIsGift}
            trackColor={{ true: colors.primary, false: colors.divider }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Payment method — unlocks card-benefit nudges on the item screen */}
        <Text style={styles.sectionTitle}>Paid with</Text>
        <Text style={styles.paymentHint}>
          Optional — credit cards often add up to a year of warranty and 90 days of
          return protection.
        </Text>
        <View style={styles.paymentRow}>
          {PAYMENT_METHOD_OPTIONS.map((o) => {
            const active = paymentMethod === o.key;
            return (
              <Pressable
                key={o.key}
                onPress={() => setPaymentMethod(active ? undefined : o.key)}
                style={[styles.paymentChip, active && styles.paymentChipActive]}
              >
                <Text
                  style={[styles.paymentChipText, active && styles.paymentChipTextActive]}
                >
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

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

        {/* Extended warranty / protection plan */}
        <View style={styles.giftRow}>
          <View style={styles.giftText}>
            <Text style={styles.giftLabel}>Covered by a protection plan</Text>
            <Text style={styles.giftHint}>
              AppleCare, Asurion, a store plan — track its coverage separately.
            </Text>
          </View>
          <Switch
            value={hasPlan}
            onValueChange={setHasPlan}
            trackColor={{ true: colors.primary, false: colors.divider }}
            thumbColor="#FFFFFF"
          />
        </View>
        {hasPlan && (
          <View style={styles.planBox}>
            <Field
              label="Plan provider"
              value={planProvider}
              onChangeText={setPlanProvider}
              placeholder="AppleCare+, Asurion, Best Buy Total…"
            />
            <Text style={styles.planLabel}>Coverage length (from purchase)</Text>
            <View style={styles.planChips}>
              {[
                { label: '1 year', days: 365 },
                { label: '2 years', days: 730 },
                { label: '3 years', days: 1095 },
              ].map((o) => {
                const active = planDays === o.days;
                return (
                  <Pressable
                    key={o.days}
                    onPress={() => setPlanDays(o.days)}
                    style={[styles.planChip, active && styles.planChipActive]}
                  >
                    <Text style={[styles.planChipText, active && styles.planChipTextActive]}>
                      {o.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Field
              label="Claim phone or website (optional)"
              value={planContact}
              onChangeText={setPlanContact}
              placeholder="1-800-… or https://…"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        <Field
          label="Serial / model number (optional)"
          value={serialNumber}
          onChangeText={setSerialNumber}
          placeholder="For warranty claims"
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <Text style={styles.photosLabel}>
          Product photos (optional){' '}
          {extrasLocked && <Text style={styles.plusTag}>PLUS</Text>}
        </Text>
        <Text style={styles.photosHint}>
          Snap the serial plate, the box, or its condition — handy for a warranty claim.
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photosRow}
          keyboardShouldPersistTaps="handled"
        >
          {productPhotos.map((uri, idx) => (
            <View key={`${uri}-${idx}`} style={styles.photoThumbWrap}>
              <Image source={{ uri }} style={styles.photoThumb} />
              <Pressable
                style={styles.photoRemove}
                onPress={() => removeProductPhoto(idx)}
                hitSlop={6}
                accessibilityLabel="Remove photo"
              >
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.photoAdd} onPress={addProductPhotoPrompt}>
            <Ionicons name="camera-outline" size={24} color={colors.primary} />
            <Text style={styles.photoAddText}>Add</Text>
          </Pressable>
        </ScrollView>

        <Text style={styles.photosLabel}>
          Documents (optional){' '}
          {extrasLocked && <Text style={styles.plusTag}>PLUS</Text>}
        </Text>
        <Text style={styles.photosHint}>
          Attach the warranty card, manual, or a PDF receipt — everything for a claim
          in one place.
        </Text>
        {documents.map((d, idx) => (
          <View key={`${d.uri}-${idx}`} style={styles.docRow}>
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            <Text style={styles.docName} numberOfLines={1}>
              {d.name}
            </Text>
            <Pressable onPress={() => removeDocument(idx)} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.muted} />
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.docAdd} onPress={() => void pickDocument()}>
          <Ionicons name="attach" size={18} color={colors.primary} />
          <Text style={styles.docAddText}>Attach a document</Text>
        </Pressable>

        <Field
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Gift receipt, who it's for, etc."
          multiline
        />

        <Text style={styles.photosLabel}>Tags (optional)</Text>
        <Text style={styles.photosHint}>
          Group items like “electronics” or “kitchen” — then filter by them on your
          dashboard.
        </Text>
        {tags.length > 0 && (
          <View style={styles.tagWrap}>
            {tags.map((t) => (
              <Pressable key={t} style={styles.tagChip} onPress={() => removeTag(t)}>
                <Text style={styles.tagChipText}>{t}</Text>
                <Ionicons name="close" size={13} color={colors.primary} />
              </Pressable>
            ))}
          </View>
        )}
        <TextInput
          inputAccessoryViewID={DONE_ACCESSORY_ID}
          value={tagDraft}
          onChangeText={setTagDraft}
          onSubmitEditing={addTag}
          onBlur={addTag}
          placeholder="Add a tag and press return"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          blurOnSubmit={false}
          style={styles.tagInput}
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

const makeStyles = (colors: Palette) => StyleSheet.create({
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
  receiptPages: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingRight: spacing.md,
  },
  receiptPageWrap: {
    position: 'relative',
    alignItems: 'center',
  },
  receiptPage: {
    width: 110,
    height: 140,
    borderRadius: radii.md,
    backgroundColor: colors.divider,
    resizeMode: 'cover',
  },
  receiptPageLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },
  receiptPageRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15,18,28,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
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
  scanDisclaimer: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.muted,
    lineHeight: 16,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
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
  photosLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    marginBottom: 4,
  },
  plusTag: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    color: colors.primary,
  },
  photosHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginBottom: spacing.sm,
    lineHeight: 17,
  },
  photosRow: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    paddingRight: spacing.md,
  },
  photoThumbWrap: {
    position: 'relative',
  },
  photoThumb: {
    width: 84,
    height: 84,
    borderRadius: radii.md,
    backgroundColor: colors.divider,
  },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15,18,28,0.8)', // dark badge over any photo, both themes
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    width: 84,
    height: 84,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  photoAddText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.primary,
  },
  barcodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  barcodeBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.primary,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  docName: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.text,
  },
  docAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  docAddText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.primary,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySoft,
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  paymentHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: -6,
    marginBottom: spacing.sm,
  },
  paymentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  paymentChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    ...cardShadow,
    shadowOpacity: 0.05,
    elevation: 1,
  },
  paymentChipActive: {
    backgroundColor: colors.primary,
  },
  paymentChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.text,
  },
  paymentChipTextActive: {
    color: '#FFFFFF',
  },
  tagChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.primary,
  },
  tagInput: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  giftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  giftText: {
    flex: 1,
  },
  giftLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.text,
  },
  giftHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 17,
  },
  planBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  planLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    marginBottom: 6,
  },
  planChips: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  planChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  planChipActive: {
    backgroundColor: colors.primary,
  },
  planChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.text,
  },
  planChipTextActive: {
    color: '#FFFFFF',
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
