import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
          text below and Boughtly reads the details — no photo needed.
        </Text>

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
