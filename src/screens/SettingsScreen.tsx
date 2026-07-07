import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import React from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Card } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { ensureNotificationSetup } from '../notifications/notifications';
import { useAppState } from '../store/AppStateContext';
import { colors, fonts, spacing } from '../theme/theme';
import { PRICE_CHECK_OPTIONS } from '../types/item';
import { formatPrice, nearestDeadline } from '../utils/dates';
import { warningFeedback } from '../utils/haptics';

const RETURN_REMINDER_OPTIONS = [1, 3, 7];
const WARRANTY_REMINDER_OPTIONS = [3, 7, 14];

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { items, settings, updateSettings, deleteItem, deleteAllItems } = useAppState();

  function confirmDelete(id: string, name: string) {
    warningFeedback();
    Alert.alert('Stop tracking this item?', `${name} and its reminders will be removed.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteItem(id) },
    ]);
  }

  async function toggleNotifications(enabled: boolean) {
    if (enabled && Platform.OS !== 'web') {
      const granted = await ensureNotificationSetup();
      if (!granted) {
        Alert.alert(
          'Notifications are blocked',
          'Boughtly can’t send reminders until you allow notifications in your phone’s Settings app (Settings → Boughtly → Notifications).'
        );
      }
    }
    updateSettings({ notificationsEnabled: enabled });
  }

  async function exportData() {
    const backup = {
      app: 'Boughtly',
      exportedAt: new Date().toISOString(),
      items: items.map(({ notificationIds, ...rest }) => rest),
    };
    try {
      await Share.share(
        {
          title: 'Boughtly backup',
          message: JSON.stringify(backup, null, 2),
        },
        { dialogTitle: 'Export Boughtly data' }
      );
    } catch {
      // user closed the share sheet — nothing to do
    }
  }

  function confirmDeleteAll() {
    warningFeedback();
    Alert.alert(
      'Delete all items?',
      `All ${items.length} tracked item${items.length === 1 ? '' : 's'} and their reminders will be removed. This can’t be undone.`,
      [
        { text: 'Keep everything', style: 'cancel' },
        { text: 'Delete all', style: 'destructive', onPress: () => deleteAllItems() },
      ]
    );
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
            onValueChange={toggleNotifications}
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

        <View style={styles.divider} />
        <Text style={styles.optionLabel}>Remind me to price-check my watchlist</Text>
        <View style={[styles.optionRow, styles.optionRowWrap]}>
          {PRICE_CHECK_OPTIONS.map((o) => {
            const active = settings.priceCheckCadence === o.key;
            return (
              <Pressable
                key={o.key}
                onPress={() => updateSettings({ priceCheckCadence: o.key })}
                style={[styles.option, active && styles.optionActive]}
                disabled={!settings.notificationsEnabled}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.optionHint}>
          Fires only while you're actually watching something; tapping it opens your
          watchlist ready to scan.
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

      {/* Your data */}
      <Text style={styles.sectionTitle}>Your data</Text>
      <Card>
        <Pressable style={styles.row} onPress={exportData} disabled={items.length === 0}>
          <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="share-outline" size={19} color={colors.primary} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={[styles.rowLabel, items.length === 0 && styles.rowDisabled]}>
              Export my data
            </Text>
            <Text style={styles.itemMeta}>
              Share a copy of your items as text — email it to yourself as a backup.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.muted} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.row} onPress={confirmDeleteAll} disabled={items.length === 0}>
          <View style={[styles.rowIcon, { backgroundColor: colors.coralSoft }]}>
            <Ionicons name="trash-outline" size={19} color={colors.danger} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={[styles.deleteText, items.length === 0 && styles.rowDisabled]}>
              Delete all items
            </Text>
            <Text style={styles.itemMeta}>
              Removes everything Boughtly is tracking, including reminders.
            </Text>
          </View>
        </Pressable>
      </Card>

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
  optionRowWrap: {
    flexWrap: 'wrap',
  },
  optionHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
    marginTop: 4,
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
  rowDisabled: {
    opacity: 0.4,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
