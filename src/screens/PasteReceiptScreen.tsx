import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
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
import { Button } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PasteReceipt'>;

/**
 * Paste a receipt or order-confirmation email. This covers online purchases
 * (Amazon, etc.) that paper scanning can't — the pasted text runs through the
 * same parser as a scanned receipt.
 */
export function PasteReceiptScreen({ navigation }: Props) {
  const [text, setText] = useState('');

  function readIt() {
    const trimmed = text.trim();
    if (trimmed.length < 10) {
      Alert.alert(
        'Paste a bit more',
        'Copy the whole receipt or order email — item names, prices, the total, and the date all help.'
      );
      return;
    }
    // AddItem parses this and routes multi-item receipts to the review screen.
    navigation.replace('AddItem', { scanText: trimmed });
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
          Bought something online? Paste the order confirmation email or receipt
          text below — or upload a screenshot of it — and Boughtly reads the details.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.uploadBtn, pressed && { opacity: 0.9 }]}
          onPress={() => navigation.replace('AddItem', { mode: 'photo' })}
        >
          <Ionicons name="image-outline" size={20} color="#FFFFFF" />
          <View style={styles.uploadText}>
            <Text style={styles.uploadTitle}>Upload a screenshot</Text>
            <Text style={styles.uploadSub}>
              Pick a screenshot of your order email from your photos.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
        </Pressable>

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>or paste the text</Text>
          <View style={styles.orLine} />
        </View>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={
            'Paste here…\n\nAmazon.com order\nEcho Dot  $49.99\nUSB-C cable  $12.99\nOrder total: $62.98\nOrdered July 5, 2026'
          }
          placeholderTextColor={colors.muted}
          multiline
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        <Button
          title="Read it"
          variant="coral"
          onPress={readIt}
          disabled={text.trim().length < 10}
          style={styles.button}
        />
        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>Tips for the best read</Text>
          <Text style={styles.tipBody}>
            • Include the item names with their prices{'\n'}
            • Keep the order total / amount line{'\n'}
            • Leave the purchase date in — it sets your return window
          </Text>
        </View>
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
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  uploadText: {
    flex: 1,
  },
  uploadTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  uploadSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.divider,
  },
  orText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  input: {
    minHeight: 200,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    lineHeight: 21,
  },
  button: {
    marginTop: spacing.md,
  },
  tipBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  tipTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.primary,
    marginBottom: 6,
  },
  tipBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.deepBlue,
    lineHeight: 20,
  },
});
