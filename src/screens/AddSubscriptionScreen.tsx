import { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, Field } from '../components/ui';
import { useToast } from '../components/Toast';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../store/AppStateContext';
import { Palette, fonts, radii, spacing } from '../theme/theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { BILLING_CYCLE_OPTIONS, BillingCycle } from '../types/tracking';
import { addDays, formatDate, toISODate } from '../utils/dates';
import { warningFeedback } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'AddSubscription'>;

function parseCost(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const v = Number(cleaned);
  return Number.isFinite(v) && v > 0 ? v : null;
}

export function AddSubscriptionScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { subscriptions, addSubscription, updateSubscription, deleteSubscription } =
    useAppState();
  const toast = useToast();
  const editing = route.params?.subscriptionId
    ? subscriptions.find((s) => s.id === route.params!.subscriptionId)
    : undefined;

  const [name, setName] = useState(editing?.name ?? '');
  const [costText, setCostText] = useState(editing ? String(editing.cost) : '');
  const [cycle, setCycle] = useState<BillingCycle>(editing?.cycle ?? 'monthly');
  const [renewal, setRenewal] = useState(
    editing?.nextRenewalDate ?? addDays(toISODate(new Date()), 30)
  );
  const [category, setCategory] = useState(editing?.category ?? '');
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const cost = parseCost(costText);
    if (!name.trim() || cost === null) {
      Alert.alert('Almost there', 'Give it a name and what it costs each cycle.');
      return;
    }
    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        cost,
        cycle,
        nextRenewalDate: renewal,
        category: category.trim() || undefined,
      };
      if (editing) {
        await updateSubscription(editing.id, input);
        toast('Subscription updated');
      } else {
        await addSubscription(input);
        toast(`Now tracking ${input.name}`);
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!editing) return;
    warningFeedback();
    Alert.alert('Stop tracking this subscription?', `${editing.name} will be removed.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSubscription(editing.id);
          navigation.goBack();
        },
      },
    ]);
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
        <Field
          label="What’s the subscription?"
          value={name}
          onChangeText={setName}
          placeholder="Netflix, Planet Fitness, iCloud+…"
        />
        <Field
          label="What does it cost?"
          value={costText}
          onChangeText={setCostText}
          placeholder="15.99"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Billing cycle</Text>
        <View style={styles.chipRow}>
          {BILLING_CYCLE_OPTIONS.map((o) => {
            const active = cycle === o.key;
            return (
              <Pressable
                key={o.key}
                onPress={() => setCycle(o.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Next renewal date</Text>
        {Platform.OS === 'web' ? (
          <Field
            label=""
            value={renewal}
            onChangeText={setRenewal}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
        ) : (
          <>
            <Pressable style={styles.dateBtn} onPress={() => setShowPicker(true)}>
              <Text style={styles.dateBtnText}>{formatDate(renewal)}</Text>
            </Pressable>
            {showPicker && (
              <DateTimePicker
                value={new Date(renewal)}
                mode="date"
                onChange={(_, d) => {
                  setShowPicker(Platform.OS === 'ios');
                  if (d) setRenewal(toISODate(d));
                }}
              />
            )}
          </>
        )}

        <Field
          label="Category (optional)"
          value={category}
          onChangeText={setCategory}
          placeholder="streaming, gym, cloud…"
          autoCapitalize="none"
        />

        <Button
          title={saving ? 'Saving…' : editing ? 'Save changes' : 'Track this subscription'}
          onPress={handleSave}
          disabled={saving || !name.trim() || !costText.trim()}
          style={styles.save}
        />
        {editing && (
          <Pressable onPress={confirmDelete} style={styles.deleteRow} hitSlop={8}>
            <Text style={styles.deleteText}>Stop tracking</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.md, paddingBottom: spacing.xxl },
    label: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.muted,
      marginBottom: 8,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: radii.md,
      backgroundColor: colors.card,
    },
    chipActive: { backgroundColor: colors.primary },
    chipText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.text,
    },
    chipTextActive: { color: '#FFFFFF' },
    dateBtn: {
      backgroundColor: colors.card,
      borderRadius: radii.md,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    dateBtnText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 16,
      color: colors.text,
    },
    save: { marginTop: spacing.md },
    deleteRow: { alignItems: 'center', paddingVertical: spacing.md },
    deleteText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.danger,
    },
  });
