import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button, Card } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { resolveReturnPage } from '../services/returnUrl';
import { useAppState } from '../store/AppStateContext';
import { colors, fonts, radii, spacing } from '../theme/theme';
import { RETURN_STEPS } from '../types/tracking';
import { formatDate, formatPrice } from '../utils/dates';
import { successFeedback, tapFeedback, warningFeedback } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'ReturnDetail'>;

export function ReturnDetailScreen({ navigation, route }: Props) {
  const { returns, items, updateReturn, setReturnStatus, deleteReturn } = useAppState();
  const ret = useMemo(
    () => returns.find((r) => r.id === route.params.returnId),
    [returns, route.params.returnId]
  );
  const item = useMemo(
    () => (ret ? items.find((i) => i.id === ret.itemId) : undefined),
    [items, ret]
  );

  // Where the user bought it — prefilled from the return, editable here.
  const [storeInput, setStoreInput] = useState(ret?.storeName ?? '');
  const resolved = useMemo(
    () => resolveReturnPage(storeInput.trim() || ret?.storeName || ''),
    [storeInput, ret?.storeName]
  );

  if (!ret) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>This return was removed.</Text>
        <Button title="Back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const stepIndex = RETURN_STEPS.findIndex((s) => s.key === ret.status);
  const isDone = ret.status === 'refunded';

  async function advance() {
    if (!ret || stepIndex >= RETURN_STEPS.length - 1) return;
    const next = RETURN_STEPS[stepIndex + 1].key;
    await setReturnStatus(ret.id, next);
    if (next === 'refunded') successFeedback();
    else tapFeedback();
  }

  async function stepBack() {
    if (!ret || stepIndex <= 0) return;
    await setReturnStatus(ret.id, RETURN_STEPS[stepIndex - 1].key);
    tapFeedback();
  }

  /** Open the store's return page (known retailer → its returns page; else a
   *  web search), saving any edit to where they bought it. */
  async function openReturnPage() {
    if (!ret) return;
    const store = storeInput.trim() || ret.storeName;
    if (!store) {
      Alert.alert('Where did you buy it?', 'Type the store so we can find its return page.');
      return;
    }
    if (store !== ret.storeName) updateReturn(ret.id, { storeName: store });
    const page = resolveReturnPage(store);
    tapFeedback();
    if (Platform.OS === 'web') {
      Linking.openURL(page.url).catch(() => {});
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(page.url);
    } catch {
      await Linking.openURL(page.url).catch(() => {});
    }
  }

  /** Prefilled return request — share to email/messages, ready to send. */
  async function shareRequest() {
    if (!ret) return;
    const lines = [
      `Hi ${ret.storeName} team,`,
      '',
      `I'd like to return the following purchase:`,
      `• Item: ${ret.itemName}`,
      item ? `• Purchased: ${formatDate(item.purchaseDate)}` : null,
      `• Amount: ${formatPrice(ret.refundAmount)}`,
      ret.trackingNumber ? `• Tracking number: ${ret.trackingNumber}` : null,
      '',
      'I have the receipt available. Could you send me return instructions',
      'or a return label, and confirm how the refund will be issued?',
      '',
      'Thank you!',
    ].filter((l): l is string => l !== null);
    try {
      await Share.share(
        { title: `Return request — ${ret.itemName}`, message: lines.join('\n') },
        { dialogTitle: 'Send your return request' }
      );
    } catch {
      // share sheet dismissed
    }
  }

  function confirmDelete() {
    warningFeedback();
    Alert.alert('Delete this return?', 'Its progress and reminders will be removed.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteReturn(ret!.id);
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.name}>{ret.itemName}</Text>
      <Text style={styles.subtitle}>
        {ret.storeName} · {formatPrice(ret.refundAmount)} coming back
      </Text>

      {/* Take me to the store's return page */}
      <Card style={styles.returnPageCard}>
        <Text style={styles.returnPageTitle}>Return it at the store</Text>
        <Text style={styles.fieldLabel}>Where did you buy it?</Text>
        <TextInput
          value={storeInput}
          onChangeText={setStoreInput}
          onSubmitEditing={openReturnPage}
          placeholder="Target"
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="go"
          style={styles.input}
        />
        <Pressable
          onPress={openReturnPage}
          style={({ pressed }) => [styles.returnPageBtn, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="open-outline" size={18} color="#FFFFFF" />
          <Text style={styles.returnPageBtnText}>
            {resolved.known
              ? `Go to ${resolved.label}'s return page`
              : 'Find where to return it'}
          </Text>
        </Pressable>
        <Text style={styles.returnPageHint}>
          {resolved.known
            ? `Opens ${resolved.label}'s official returns page.`
            : 'Press go and we’ll take you to this store’s return page online.'}
        </Text>
      </Card>

      {/* Progress stepper */}
      <Card style={styles.stepsCard}>
        {RETURN_STEPS.map((step, i) => {
          const done = i <= stepIndex;
          const current = i === stepIndex;
          return (
            <View key={step.key} style={styles.stepRow}>
              <View style={styles.stepRail}>
                <View
                  style={[
                    styles.stepDot,
                    done ? styles.stepDotDone : styles.stepDotTodo,
                    current && styles.stepDotCurrent,
                  ]}
                >
                  {done && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                </View>
                {i < RETURN_STEPS.length - 1 && (
                  <View style={[styles.stepLine, i < stepIndex && styles.stepLineDone]} />
                )}
              </View>
              <View style={styles.stepText}>
                <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>
                  {step.label}
                </Text>
                <Text style={styles.stepHelp}>{step.help}</Text>
              </View>
            </View>
          );
        })}
        {!isDone ? (
          <Button
            title={`Mark: ${RETURN_STEPS[stepIndex + 1].label}`}
            variant={RETURN_STEPS[stepIndex + 1].key === 'refunded' ? 'coral' : 'primary'}
            onPress={advance}
            style={styles.advanceBtn}
          />
        ) : (
          <View style={styles.doneBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#20744E" />
            <Text style={styles.doneText}>
              {formatPrice(ret.refundAmount)} back in your pocket
            </Text>
          </View>
        )}
        {stepIndex > 0 && (
          <Pressable onPress={stepBack} style={styles.undoBtn} hitSlop={8}>
            <Text style={styles.undoText}>Undo last step</Text>
          </Pressable>
        )}
      </Card>

      {/* Details */}
      <Text style={styles.sectionTitle}>Details</Text>
      <Card>
        <Text style={styles.fieldLabel}>How are you returning it?</Text>
        <View style={styles.methodRow}>
          {(
            [
              { key: 'in_store', label: 'In store', icon: 'storefront-outline' },
              { key: 'mail', label: 'By mail', icon: 'cube-outline' },
            ] as const
          ).map((m) => {
            const active = ret.method === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => updateReturn(ret.id, { method: m.key })}
                style={[styles.methodChip, active && styles.methodChipActive]}
              >
                <Ionicons
                  name={m.icon}
                  size={16}
                  color={active ? '#FFFFFF' : colors.text}
                />
                <Text style={[styles.methodText, active && styles.methodTextActive]}>
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {ret.method === 'mail' && (
          <>
            <Text style={styles.fieldLabel}>Tracking number (optional)</Text>
            <TextInput
              defaultValue={ret.trackingNumber}
              onEndEditing={(e) =>
                updateReturn(ret.id, { trackingNumber: e.nativeEvent.text.trim() })
              }
              placeholder="1Z999AA10123456784"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
            />
          </>
        )}
        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <TextInput
          defaultValue={ret.notes}
          onEndEditing={(e) => updateReturn(ret.id, { notes: e.nativeEvent.text.trim() })}
          placeholder="Return code, who you spoke to…"
          placeholderTextColor={colors.muted}
          multiline
          style={[styles.input, styles.inputMultiline]}
        />
      </Card>

      {/* Prefilled paperwork */}
      <Text style={styles.sectionTitle}>Paperwork</Text>
      <Card>
        <Text style={styles.paperworkBody}>
          Boughtly prefills a return request with the item, purchase date, and amount —
          send it to the store by email or chat.
        </Text>
        <Button title="Share return request" onPress={shareRequest} style={styles.shareBtn} />
      </Card>

      {item && (
        <Pressable
          style={styles.itemLink}
          onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
        >
          <Text style={styles.itemLinkText}>View the tracked item →</Text>
        </Pressable>
      )}

      <Button title="Delete return" variant="danger" onPress={confirmDelete} style={styles.delete} />
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
    marginBottom: spacing.lg,
  },
  returnPageCard: {
    marginBottom: spacing.md,
  },
  returnPageTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.deepBlue,
    marginBottom: spacing.sm,
  },
  returnPageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 13,
    marginTop: spacing.xs,
  },
  returnPageBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  returnPageHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: spacing.sm,
    lineHeight: 17,
  },
  stepsCard: {
    marginBottom: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepRail: {
    alignItems: 'center',
    width: 26,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    backgroundColor: colors.primary,
  },
  stepDotTodo: {
    backgroundColor: colors.divider,
  },
  stepDotCurrent: {
    backgroundColor: colors.coral,
  },
  stepLine: {
    width: 3,
    flex: 1,
    minHeight: 18,
    backgroundColor: colors.divider,
    marginVertical: 2,
    borderRadius: 2,
  },
  stepLineDone: {
    backgroundColor: colors.primary,
  },
  stepText: {
    flex: 1,
    paddingBottom: spacing.md,
  },
  stepLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.muted,
  },
  stepLabelDone: {
    color: colors.deepBlue,
  },
  stepHelp: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  advanceBtn: {
    marginTop: spacing.xs,
  },
  doneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#DFF3E9',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  doneText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: '#20744E',
  },
  undoBtn: {
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  undoText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.deepBlue,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    marginBottom: 6,
    marginTop: spacing.xs,
  },
  methodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: colors.background,
  },
  methodChipActive: {
    backgroundColor: colors.primary,
  },
  methodText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.text,
  },
  methodTextActive: {
    color: '#FFFFFF',
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
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  paperworkBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  shareBtn: {},
  itemLink: {
    alignSelf: 'center',
    marginTop: spacing.lg,
  },
  itemLinkText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.primary,
  },
  delete: {
    marginTop: spacing.lg,
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
