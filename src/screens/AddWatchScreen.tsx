import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { Button, Field } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../store/AppStateContext';
import { colors, fonts, spacing } from '../theme/theme';
import { successFeedback } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'AddWatch'>;

function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function AddWatchScreen({ navigation, route }: Props) {
  const { addWatch } = useAppState();
  const [name, setName] = useState(route.params?.prefillName ?? '');
  const [store, setStore] = useState('');
  const [url, setUrl] = useState('');
  const [priceText, setPriceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const firstPrice = parsePrice(priceText);
    if (!name.trim() || firstPrice === null) {
      Alert.alert('Almost there', 'Give it a name and the price you saw today.');
      return;
    }
    const target = targetText.trim() ? parsePrice(targetText) : null;
    setSaving(true);
    try {
      const watch = await addWatch({
        name: name.trim(),
        store: store.trim() || 'Anywhere',
        url: url.trim() || undefined,
        targetPrice: target ?? undefined,
        firstPrice,
      });
      successFeedback();
      navigation.replace('WatchDetail', { watchId: watch.id });
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
          Track something you’re thinking about buying. Log its price whenever you
          check, and Boughtly will tell you when a “sale” is the real thing.
        </Text>
        <Field
          label="What are you eyeing?"
          value={name}
          onChangeText={setName}
          placeholder="Sony WH-1000XM5 headphones"
        />
        <Field
          label="Where are you watching it? (optional)"
          value={store}
          onChangeText={setStore}
          placeholder="Best Buy, Amazon…"
        />
        <Field
          label="Product link (optional)"
          value={url}
          onChangeText={setUrl}
          placeholder="https://…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Field
          label="Price you see today"
          value={priceText}
          onChangeText={setPriceText}
          placeholder="349.99"
          keyboardType="decimal-pad"
        />
        <Field
          label="Price you’d be happy to pay (optional)"
          value={targetText}
          onChangeText={setTargetText}
          placeholder="279.99"
          keyboardType="decimal-pad"
        />
        <Button
          title={saving ? 'Saving…' : 'Start watching'}
          onPress={handleSave}
          disabled={saving || !name.trim() || !priceText.trim()}
          style={styles.save}
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
  intro: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  save: {
    marginTop: spacing.md,
  },
});
