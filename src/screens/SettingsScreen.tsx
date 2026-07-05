import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Card } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../store/AppStateContext';
import { colors, fonts, spacing } from '../theme/theme';
import { formatPrice, nearestDeadline } from '../utils/dates';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const RETURN_REMINDER_OPTIONS = [1, 3, 7];
const WARRANTY_REMINDER_OPTIONS = [3, 7, 14];

export function SettingsScreen({ navigation }: Props) {
  const { items, settings, updateSettings, deleteItem } = useAppState();
  const [apiKeyDraft, setApiKeyDraft] = useState(settings.claudeApiKey);

  function confirmDelete(id: string, name: string) {
    Alert.alert('Stop tracking this item?', `${name} and its reminders will be removed.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteItem(id) },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Notifications */}
      <Text style={styles.sectionTitle}>Reminders</Text>
      <Card>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Send me reminders</Text>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={(v) => updateSettings({ notificationsEnabled: v })}
            trackColor={{ true: colors.primary, false: colors.divider }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.divider} />
        <Text style={styles.optionLabel}>Before a return window closes</Text>
        <View style={styles.optionRow}>
          {RETURN_REMINDER_OPTIONS.map((d) => {
            const active = settings.returnReminderDays === d;
            return (
              <Pressable
                key={d}
                onPress={() => updateSettings({ returnReminderDays: d })}
                style={[styles.option, active && styles.optionActive]}
                disabled={!settings.notificationsEnabled}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>
                  {d} day{d === 1 ? '' : 's'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.optionLabel}>Before a warranty expires</Text>
        <View style={styles.optionRow}>
          {WARRANTY_REMINDER_OPTIONS.map((d) => {
            const active = settings.warrantyReminderDays === d;
            return (
              <Pressable
                key={d}
                onPress={() => updateSettings({ warrantyReminderDays: d })}
                style={[styles.option, active && styles.optionActive]}
                disabled={!settings.notificationsEnabled}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>
                  {d} days
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Receipt auto-reading */}
      <Text style={styles.sectionTitle}>Receipt auto-reading</Text>
      <Card>
        <Text style={styles.helpText}>
          Add a Claude API key and Boughtly will read the item, store, price, and date
          straight off your receipt photos. Get one at console.anthropic.com.
        </Text>
        <TextInput
          value={apiKeyDraft}
          onChangeText={setApiKeyDraft}
          onBlur={() => updateSettings({ claudeApiKey: apiKeyDraft.trim() })}
          placeholder="sk-ant-…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={styles.apiKeyInput}
        />
        <Text style={styles.helpTextSmall}>
          {settings.claudeApiKey
            ? 'Key saved. Receipt photos are sent to Anthropic for reading only when you scan.'
            : 'No key yet — scanned receipts are saved as photos and you fill in details yourself.'}
        </Text>
      </Card>

      {/* Manage items */}
      <Text style={styles.sectionTitle}>Your items ({items.length})</Text>
      {items.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>Nothing tracked yet.</Text>
        </Card>
      ) : (
        <Card>
          {items.map((item, idx) => {
            const deadline = nearestDeadline(item);
            return (
              <View key={item.id}>
                {idx > 0 && <View style={styles.divider} />}
                <View style={styles.row}>
                  <Pressable
                    style={styles.itemInfo}
                    onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
                  >
                    <Text style={styles.rowLabel} numberOfLines={1}>
                      {item.itemName}
                    </Text>
                    <Text style={styles.itemMeta} numberOfLines={1}>
                      {item.storeName} · {formatPrice(item.price)} ·{' '}
                      {deadline.daysLeft < 0
                        ? 'protection ended'
                        : `${deadline.daysLeft}d left`}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => confirmDelete(item.id, item.itemName)}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {/* About */}
      <Text style={styles.sectionTitle}>About</Text>
      <Card>
        <Text style={styles.aboutName}>Boughtly</Text>
        <Text style={styles.aboutTagline}>
          The right price before. The right protection after.
        </Text>
        <Text style={styles.aboutVersion}>
          Version {Constants.expoConfig?.version ?? '1.0.0'} · All data stays on your device.
        </Text>
      </Card>
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
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.deepBlue,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  rowLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.sm,
  },
  optionLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  optionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  option: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  optionActive: {
    backgroundColor: colors.primary,
  },
  optionText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.text,
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
  helpText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  helpTextSmall: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  apiKeyInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  itemInfo: {
    flex: 1,
  },
  itemMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  deleteText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.danger,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
  },
  aboutName: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.deepBlue,
  },
  aboutTagline: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  aboutVersion: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: spacing.md,
  },
});
