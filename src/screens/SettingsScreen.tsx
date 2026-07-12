import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
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
import { ensureNotificationSetup, sendTestReminder } from '../notifications/notifications';
import { backupFileName, buildBackup, parseBackup } from '../services/backup';
import { exportInventoryReport } from '../services/inventoryReport';
import { useToast } from '../components/Toast';
import { csvFileName, itemsToCsv } from '../utils/csv';
import { useAppState } from '../store/AppStateContext';
import { Palette, fonts, spacing } from '../theme/theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import {
  CURRENCY_OPTIONS,
  PRICE_CHECK_OPTIONS,
  PRICE_DROP_CADENCE_OPTIONS,
  PRICE_DROP_LEAD_OPTIONS,
  REMINDER_TIME_OPTIONS,
  SUBSCRIPTION_REMINDER_OPTIONS,
  THEME_MODE_OPTIONS,
} from '../types/item';
import { formatPrice, nearestDeadline } from '../utils/dates';
import { successFeedback, warningFeedback } from '../utils/haptics';

const RETURN_REMINDER_OPTIONS = [1, 3, 7];
const WARRANTY_REMINDER_OPTIONS = [3, 7, 14];

export function SettingsScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    items,
    watches,
    returns,
    settings,
    updateSettings,
    deleteItem,
    deleteAllItems,
    restoreBackup,
  } = useAppState();

  const hasData = items.length > 0 || watches.length > 0 || returns.length > 0;
  const [exportingPdf, setExportingPdf] = useState(false);
  const toast = useToast();

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

  /** Write a full backup file and hand it to the share sheet (Files, Mail, …). */
  async function exportData() {
    const json = JSON.stringify(buildBackup(items, watches, returns, settings), null, 2);
    try {
      if (Platform.OS === 'web') {
        await Share.share({ title: 'Boughtly backup', message: json });
        return;
      }
      const file = new File(Paths.cache, backupFileName());
      if (file.exists) file.delete();
      file.create();
      file.write(json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Export Boughtly backup',
          UTI: 'public.json',
        });
      } else {
        await Share.share({ title: 'Boughtly backup', message: json });
      }
    } catch {
      // share sheet dismissed or write failed — nothing to do
    }
  }

  /** Write a spreadsheet (CSV) of the items and open the share sheet. */
  async function exportCsv() {
    const csv = itemsToCsv(items);
    try {
      if (Platform.OS === 'web') {
        await Share.share({ title: 'Boughtly items', message: csv });
        return;
      }
      const file = new File(Paths.cache, csvFileName());
      if (file.exists) file.delete();
      file.create();
      file.write(csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Boughtly spreadsheet',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        await Share.share({ title: 'Boughtly items', message: csv });
      }
    } catch {
      // dismissed or write failed
    }
  }

  /** Build the insurance-ready home-inventory PDF and open the share sheet. */
  async function exportInventoryPdf() {
    if (Platform.OS === 'web') {
      Alert.alert('iPhone only', 'PDF reports are generated on your phone — open Boughtly there.');
      return;
    }
    setExportingPdf(true);
    try {
      await exportInventoryReport(items, settings);
    } catch {
      Alert.alert('Couldn’t build the report', 'Something went wrong generating the PDF — try again.');
    } finally {
      setExportingPdf(false);
    }
  }

  /** Pick a backup file and restore it (after confirming the replace). */
  async function importData() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'public.json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const text = await new File(res.assets[0].uri).text();
      const parsed = parseBackup(text);
      if (!parsed.ok) {
        Alert.alert('Couldn’t import that file', parsed.error);
        return;
      }
      const b = parsed.backup;
      const when = new Date(b.exportedAt).toLocaleDateString();
      Alert.alert(
        'Restore this backup?',
        `This replaces everything in Boughtly with ${b.items.length} item${
          b.items.length === 1 ? '' : 's'
        }, ${b.returns.length} return${b.returns.length === 1 ? '' : 's'}, and ${
          b.watches.length
        } watch${b.watches.length === 1 ? '' : 'es'} from ${when}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              const counts = await restoreBackup(b);
              toast(
                `Restored ${counts.items} item${counts.items === 1 ? '' : 's'}, ${
                  counts.returns
                } return${counts.returns === 1 ? '' : 's'}, ${counts.watches} watch${
                  counts.watches === 1 ? '' : 'es'
                }`
              );
            },
          },
        ]
      );
    } catch {
      Alert.alert(
        'Couldn’t import that file',
        'Make sure you picked a Boughtly backup (.json) file.'
      );
    }
  }

  /** Enable the app lock only after proving Face ID/passcode works here. */
  async function toggleAppLock(enabled: boolean) {
    if (!enabled) {
      updateSettings({ appLockEnabled: false });
      return;
    }
    if (Platform.OS === 'web') {
      Alert.alert('Phone only', 'The app lock uses Face ID / passcode on your phone.');
      return;
    }
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) {
      Alert.alert(
        'No lock set up',
        'Set up Face ID, Touch ID, or a passcode in your phone’s Settings first.'
      );
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirm to enable the app lock',
    });
    if (result.success) {
      updateSettings({ appLockEnabled: true });
    }
  }

  async function testReminder() {
    const ok = await sendTestReminder();
    if (ok) {
      toast('Test reminder sent — watch for it in ~5s');
    } else {
      Alert.alert(
        'Reminders are off',
        'Turn reminders on (and allow notifications for Boughtly) to receive a test.'
      );
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

  function signOut() {
    warningFeedback();
    Alert.alert(
      'Sign out?',
      'Your items stay safely on this device — you’ll just see the welcome screen next time.',
      [
        { text: 'Stay signed in', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await updateSettings({ accountName: '', accountEmail: '' });
            navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Account */}
      {settings.accountEmail ? (
        <>
          <Text style={styles.sectionTitle}>Account</Text>
          <Card>
            <Pressable style={styles.row} onPress={() => navigation.navigate('Profile')}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(settings.accountName || settings.accountEmail)[0]?.toUpperCase()}
                </Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.rowLabel}>{settings.accountName || 'You'}</Text>
                <Text style={styles.itemMeta}>
                  {settings.accountEmail}
                  {settings.accountPhone ? ` · ${settings.accountPhone}` : ''}
                </Text>
                <Text style={styles.editHint}>Edit profile ›</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.muted} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.signOutRow} onPress={signOut} hitSlop={8}>
              <Ionicons name="log-out-outline" size={18} color={colors.danger} />
              <Text style={styles.deleteText}>Sign out</Text>
            </Pressable>
          </Card>
        </>
      ) : null}

      {/* Boughtly Plus */}
      <Text style={styles.sectionTitle}>Boughtly Plus</Text>
      <Pressable onPress={() => navigation.navigate('Plus')}>
        <View style={styles.plusCard}>
          <View style={styles.plusIcon}>
            <Ionicons name="sparkles" size={22} color={colors.primary} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.plusTitle}>
              {settings.isPlus ? 'You’re on Plus 💜' : 'Upgrade to Plus'}
            </Text>
            <Text style={styles.itemMeta}>
              {settings.isPlus
                ? 'All perks unlocked — thanks for supporting Boughtly.'
                : 'No ads, unlimited items, and the pro tools.'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.muted} />
        </View>
      </Pressable>

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

        <Text style={styles.optionLabel}>Before a subscription renews</Text>
        <View style={[styles.optionRow, styles.optionRowWrap]}>
          {SUBSCRIPTION_REMINDER_OPTIONS.map((o) => {
            const active = (settings.subscriptionReminderDays ?? 2) === o.days;
            return (
              <Pressable
                key={o.days}
                onPress={() => updateSettings({ subscriptionReminderDays: o.days })}
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
          A “cancel by” nudge before each renewal, so you never get charged for
          something you meant to drop.
        </Text>

        <Text style={styles.optionLabel}>What time of day?</Text>
        <View style={[styles.optionRow, styles.optionRowWrap]}>
          {REMINDER_TIME_OPTIONS.map((o) => {
            const active = settings.reminderHour === o.hour;
            return (
              <Pressable
                key={o.hour}
                onPress={() => updateSettings({ reminderHour: o.hour })}
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

        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={styles.itemInfo}>
            <Text style={styles.rowLabel}>Weekly digest</Text>
            <Text style={styles.itemMeta}>
              A Sunday summary of the week ahead — windows closing, warranties ending.
            </Text>
          </View>
          <Switch
            value={settings.weeklyDigestEnabled}
            onValueChange={(v) => void updateSettings({ weeklyDigestEnabled: v })}
            disabled={!settings.notificationsEnabled}
            trackColor={{ true: colors.primary, false: colors.divider }}
            thumbColor="#FFFFFF"
          />
        </View>

        <Pressable
          style={styles.testRow}
          onPress={testReminder}
          disabled={!settings.notificationsEnabled}
        >
          <Ionicons
            name="notifications-outline"
            size={17}
            color={settings.notificationsEnabled ? colors.primary : colors.muted}
          />
          <Text
            style={[
              styles.testText,
              !settings.notificationsEnabled && styles.rowDisabled,
            ]}
          >
            Send a test reminder
          </Text>
        </Pressable>

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

        <View style={styles.divider} />
        <Pressable
          style={styles.row}
          onPress={() => navigation.navigate('Reminders')}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="calendar-outline" size={19} color={colors.primary} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.rowLabel}>See upcoming reminders</Text>
            <Text style={styles.itemMeta}>
              Every nudge that's scheduled, and when it fires.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.muted} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.row} onPress={() => navigation.navigate('Subscriptions')}>
          <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="repeat-outline" size={19} color={colors.primary} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.rowLabel}>Your subscriptions</Text>
            <Text style={styles.itemMeta}>
              Every recurring charge in one place, with a one-tap cancel.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.muted} />
        </Pressable>
      </Card>

      {/* Price-drop check-ins (return window) */}
      <Text style={styles.sectionTitle}>Price-drop check-ins</Text>
      <Card>
        <View style={styles.row}>
          <View style={styles.itemInfo}>
            <Text style={styles.rowLabel}>Nudge me to check for a lower price</Text>
            <Text style={styles.itemMeta}>
              While an item is still returnable, Boughtly reminds you to check if it got
              cheaper — so you can rebuy at the lower price and return the first one.
            </Text>
          </View>
          <Switch
            value={settings.priceDropRemindersEnabled}
            onValueChange={(v) => void updateSettings({ priceDropRemindersEnabled: v })}
            disabled={!settings.notificationsEnabled}
            trackColor={{ true: colors.primary, false: colors.divider }}
            thumbColor="#FFFFFF"
          />
        </View>

        {settings.priceDropRemindersEnabled && (
          <>
            <View style={styles.divider} />
            <Text style={styles.optionLabel}>How often</Text>
            <View style={[styles.optionRow, styles.optionRowWrap]}>
              {PRICE_DROP_CADENCE_OPTIONS.map((o) => {
                const active = settings.priceDropCadenceDays === o.days;
                return (
                  <Pressable
                    key={o.days}
                    onPress={() => void updateSettings({ priceDropCadenceDays: o.days })}
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

            <Text style={styles.optionLabel}>When to start</Text>
            <View style={[styles.optionRow, styles.optionRowWrap]}>
              {PRICE_DROP_LEAD_OPTIONS.map((o) => {
                const active = settings.priceDropLeadDays === o.days;
                return (
                  <Pressable
                    key={o.days}
                    onPress={() => void updateSettings({ priceDropLeadDays: o.days })}
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
              Tapping the reminder opens the item ready to scan for a cheaper price.
            </Text>
          </>
        )}
      </Card>

      {/* Privacy */}
      <Text style={styles.sectionTitle}>Privacy</Text>
      <Card>
        <View style={styles.row}>
          <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="lock-closed-outline" size={19} color={colors.primary} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.rowLabel}>Lock the app</Text>
            <Text style={styles.itemMeta}>
              Require Face ID or your passcode when Boughtly opens.
            </Text>
          </View>
          <Switch
            value={settings.appLockEnabled}
            onValueChange={(v) => void toggleAppLock(v)}
            trackColor={{ true: colors.primary, false: colors.divider }}
            thumbColor="#FFFFFF"
          />
        </View>
      </Card>

      {/* Appearance */}
      <Text style={styles.sectionTitle}>Appearance</Text>
      <Card>
        <Text style={styles.optionLabel}>Theme</Text>
        <View style={styles.optionRow}>
          {THEME_MODE_OPTIONS.map((o) => {
            const active = (settings.themeMode ?? 'system') === o.mode;
            return (
              <Pressable
                key={o.mode}
                onPress={() => updateSettings({ themeMode: o.mode })}
                style={[styles.option, styles.themeOption, active && styles.optionActive]}
              >
                <Ionicons
                  name={
                    o.mode === 'system'
                      ? 'phone-portrait-outline'
                      : o.mode === 'light'
                      ? 'sunny-outline'
                      : 'moon-outline'
                  }
                  size={14}
                  color={active ? '#FFFFFF' : colors.muted}
                />
                <Text style={[styles.optionText, active && styles.optionTextActive]}>
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.itemMeta}>
          System follows your iPhone’s light/dark setting. Changes apply instantly.
        </Text>
      </Card>

      {/* Currency */}
      <Text style={styles.sectionTitle}>Currency</Text>
      <Card>
        <Text style={styles.optionLabel}>Show prices in</Text>
        <View style={[styles.optionRow, styles.optionRowWrap]}>
          {CURRENCY_OPTIONS.map((o) => {
            const active = settings.currencyCode === o.code;
            return (
              <Pressable
                key={o.code}
                onPress={() => updateSettings({ currencyCode: o.code })}
                style={[styles.option, active && styles.optionActive]}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
        <Pressable style={styles.row} onPress={exportData} disabled={!hasData}>
          <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="share-outline" size={19} color={colors.primary} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={[styles.rowLabel, !hasData && styles.rowDisabled]}>
              Back up my data
            </Text>
            <Text style={styles.itemMeta}>
              Save a full backup file — items, returns, and watchlist — to Files or
              email it to yourself.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.muted} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.row} onPress={exportCsv} disabled={items.length === 0}>
          <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="grid-outline" size={19} color={colors.primary} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={[styles.rowLabel, items.length === 0 && styles.rowDisabled]}>
              Export a spreadsheet (CSV)
            </Text>
            <Text style={styles.itemMeta}>
              Items, prices, and deadlines — opens in Excel, Numbers, or Sheets.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.muted} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          style={styles.row}
          onPress={() => void exportInventoryPdf()}
          disabled={items.length === 0 || exportingPdf}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.successSoft }]}>
            <Ionicons name="document-text-outline" size={19} color={colors.success} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={[styles.rowLabel, items.length === 0 && styles.rowDisabled]}>
              {exportingPdf ? 'Building your report…' : 'Home inventory report (PDF)'}
            </Text>
            <Text style={styles.itemMeta}>
              Every item with prices, serials, and receipt photos — ready for renters or
              home insurance.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.muted} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.row} onPress={importData}>
          <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="download-outline" size={19} color={colors.primary} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.rowLabel}>Restore from a backup</Text>
            <Text style={styles.itemMeta}>
              Load a backup file to move to a new phone or recover your data.
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

      {/* Legal */}
      <Text style={styles.sectionTitle}>Legal</Text>
      <Card>
        <Pressable
          style={styles.row}
          onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="shield-checkmark-outline" size={19} color={colors.primary} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.rowLabel}>Privacy Policy</Text>
            <Text style={styles.itemMeta}>
              What we collect (nothing) and how your data stays on your device.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.muted} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          style={styles.row}
          onPress={() => navigation.navigate('Legal', { doc: 'terms' })}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="document-text-outline" size={19} color={colors.primary} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.rowLabel}>Terms & Disclaimer</Text>
            <Text style={styles.itemMeta}>
              Boughtly is a helper, not official advice — confirm deadlines yourself.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.muted} />
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
        <View style={styles.divider} />
        <Pressable
          style={styles.row}
          onPress={async () => {
            await updateSettings({ tourSeen: false });
            navigation.navigate('Tabs', { screen: 'Home' });
          }}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="sparkles-outline" size={19} color={colors.primary} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.rowLabel}>Replay the feature tour</Text>
            <Text style={styles.itemMeta}>A quick reminder of everything Boughtly can do.</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.muted} />
        </Pressable>
      </Card>
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
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
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.md,
  },
  testText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.primary,
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
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
  editHint: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.primary,
    marginTop: 3,
  },
  plusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    padding: spacing.md,
  },
  plusIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.deepBlue,
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.xs,
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: '#FFFFFF',
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
