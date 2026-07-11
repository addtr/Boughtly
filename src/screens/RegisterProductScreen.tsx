import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../components/ui';
import { useToast } from '../components/Toast';
import { RootStackParamList } from '../navigation/types';
import {
  buildAutofillScript,
  splitName,
  toUSDate,
} from '../services/registrationAutofill';
import { resolveRegistrationPage } from '../services/warrantyUrl';
import { useAppState } from '../store/AppStateContext';
import { Palette, fonts, radii, spacing } from '../theme/theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { successFeedback, tapFeedback } from '../utils/haptics';

// react-native-webview is native-only; require it lazily so the web bundle
// never executes its native-module lookup (web gets an open-in-browser card).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WebView: React.ComponentType<any> | null =
  Platform.OS === 'web' ? null : require('react-native-webview').WebView;

type Props = NativeStackScreenProps<RootStackParamList, 'RegisterProduct'>;

interface CopyChip {
  key: string;
  label: string;
  value: string;
}

export function RegisterProductScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { items, settings, patchItem } = useAppState();
  const toast = useToast();
  const item = items.find((i) => i.id === route.params.itemId);

  const webRef = useRef<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [fillNote, setFillNote] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const page = useMemo(
    () => (item ? resolveRegistrationPage(item.itemName) : null),
    [item]
  );

  const chips = useMemo<CopyChip[]>(() => {
    if (!item) return [];
    const list: CopyChip[] = [];
    if (item.serialNumber) list.push({ key: 'serial', label: 'Serial', value: item.serialNumber });
    list.push({ key: 'product', label: 'Product', value: item.itemName });
    list.push({ key: 'date', label: 'Purchased', value: toUSDate(item.purchaseDate) });
    if (settings.accountEmail) list.push({ key: 'email', label: 'Email', value: settings.accountEmail });
    if (settings.accountName) list.push({ key: 'name', label: 'Name', value: settings.accountName });
    list.push({ key: 'store', label: 'Store', value: item.storeName });
    list.push({ key: 'price', label: 'Price', value: item.price.toFixed(2) });
    return list;
  }, [item, settings.accountEmail, settings.accountName]);

  if (!item || !page) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>This item was removed.</Text>
        <Button title="Back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  async function copyChip(chip: CopyChip) {
    tapFeedback();
    await Clipboard.setStringAsync(chip.value);
    setCopiedKey(chip.key);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedKey(null), 1400);
  }

  function autofill() {
    tapFeedback();
    const name = splitName(settings.accountName ?? '');
    webRef.current?.injectJavaScript(
      buildAutofillScript({
        firstName: name.firstName,
        lastName: name.lastName,
        fullName: settings.accountName || undefined,
        email: settings.accountEmail || undefined,
        serial: item!.serialNumber || undefined,
        product: item!.itemName,
        purchaseDateUS: toUSDate(item!.purchaseDate),
        purchaseDateISO: item!.purchaseDate,
        store: item!.storeName,
        price: item!.price.toFixed(2),
      })
    );
  }

  function onWebMessage(event: { nativeEvent: { data: string } }) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'autofilled') {
        setFillNote(
          msg.filled > 0
            ? `Filled ${msg.filled} field${msg.filled === 1 ? '' : 's'} — check them, then submit.`
            : 'No fillable form here yet — open the registration form, or use the chips above.'
        );
      }
    } catch {
      // not ours
    }
  }

  async function markRegistered() {
    await patchItem(item!.id, { productRegistered: true });
    toast('Marked as registered');
    navigation.goBack();
  }

  return (
    <View style={styles.container}>
      {/* Everything a registration form asks for, one tap to copy */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipStrip}
        contentContainerStyle={styles.chipStripContent}
      >
        {chips.map((chip) => {
          const copied = copiedKey === chip.key;
          return (
            <Pressable
              key={chip.key}
              onPress={() => void copyChip(chip)}
              style={[styles.chip, copied && styles.chipCopied]}
            >
              <Text style={[styles.chipLabel, copied && styles.chipTextCopied]}>
                {copied ? 'Copied ✓' : chip.label}
              </Text>
              <Text
                style={[styles.chipValue, copied && styles.chipTextCopied]}
                numberOfLines={1}
              >
                {chip.value}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {WebView ? (
        <WebView
          ref={webRef}
          source={{ uri: page.url }}
          onMessage={onWebMessage}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          )}
          originWhitelist={['*']}
          allowsBackForwardNavigationGestures
          style={styles.web}
        />
      ) : (
        <View style={styles.webFallback}>
          <Ionicons name="open-outline" size={40} color={colors.muted} />
          <Text style={styles.webFallbackText}>
            The in-app browser is iPhone-only. Open the registration page and
            paste from the chips above.
          </Text>
          <Button
            title={`Open ${page.known ? page.label : 'registration'} page`}
            onPress={() => void Linking.openURL(page!.url).catch(() => {})}
          />
        </View>
      )}

      {fillNote ? <Text style={styles.fillNote}>{fillNote}</Text> : null}

      <View style={styles.footer}>
        {WebView ? (
          <Pressable style={styles.fillBtn} onPress={autofill}>
            <Ionicons name="color-wand" size={18} color="#FFFFFF" />
            <Text style={styles.fillBtnText}>Auto-fill this page</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.doneBtn} onPress={() => void markRegistered()}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.doneBtnText}>I registered it</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  chipStrip: {
    flexGrow: 0,
  },
  chipStripContent: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chip: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    maxWidth: 180,
  },
  chipCopied: {
    backgroundColor: colors.successSoft,
  },
  chipLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.muted,
  },
  chipValue: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.text,
  },
  chipTextCopied: {
    color: colors.success,
  },
  web: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  webFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  webFallbackText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 21,
  },
  fillNote: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.success,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  fillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 13,
  },
  fillBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.successSoft,
    borderRadius: radii.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
  },
  doneBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.success,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  missingText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.muted,
  },
});
