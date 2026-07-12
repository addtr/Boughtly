import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import {
  Alert,
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
import { resolveCancelPage } from '../services/subscriptionUrl';
import { useAppState } from '../store/AppStateContext';
import { Palette, cardShadow, fonts, radii, spacing } from '../theme/theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { BILLING_CYCLE_OPTIONS, monthlyCost, Subscription } from '../types/tracking';
import { addDays, daysUntil, formatDate, formatPrice } from '../utils/dates';
import { tapFeedback } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Subscriptions'>;

function cycleLabel(sub: Subscription): string {
  return BILLING_CYCLE_OPTIONS.find((c) => c.key === sub.cycle)?.label ?? sub.cycle;
}

export function SubscriptionsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { subscriptions, settings } = useAppState();
  const toast = useToast();
  const leadDays = settings.subscriptionReminderDays ?? 2;

  const sorted = [...subscriptions].sort((a, b) =>
    a.nextRenewalDate.localeCompare(b.nextRenewalDate)
  );
  const totalMonthly = subscriptions.reduce((sum, s) => sum + monthlyCost(s), 0);
  const totalYearly = totalMonthly * 12;

  async function openCancel(sub: Subscription) {
    tapFeedback();
    const page = resolveCancelPage(sub.name);
    if (page.appStore) {
      Alert.alert(
        `${page.label} is billed through Apple`,
        'Subscriptions bought in an app are cancelled in iOS Settings → tap your name → Subscriptions.',
        [
          { text: 'Close', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => Linking.openURL('App-Prefs:root').catch(() => {}),
          },
        ]
      );
      return;
    }
    try {
      if (Platform.OS === 'web') {
        Linking.openURL(page.url).catch(() => {});
      } else {
        await WebBrowser.openBrowserAsync(page.url);
      }
    } catch {
      Linking.openURL(page.url).catch(() => {});
    }
    if (!page.known) {
      toast('Opened a cancel search for this one', 'info');
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {subscriptions.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="repeat" size={40} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>See every subscription in one place</Text>
          <Text style={styles.emptyBody}>
            Add the recurring charges you want to keep an eye on — streaming, gym,
            cloud storage. Boughtly totals them up, reminds you before each renews,
            and takes you straight to the cancel page in one tap.
          </Text>
          <Button
            title="Add a subscription"
            onPress={() => navigation.navigate('AddSubscription', {})}
            style={styles.emptyBtn}
          />
        </View>
      ) : (
        <>
          {/* Total spend header */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>You’re spending about</Text>
            <Text style={styles.totalValue}>{formatPrice(totalMonthly)}/mo</Text>
            <Text style={styles.totalSub}>
              ≈ {formatPrice(totalYearly)} a year across {subscriptions.length} subscription
              {subscriptions.length === 1 ? '' : 's'}
            </Text>
          </View>

          {sorted.map((sub) => {
            const dLeft = daysUntil(sub.nextRenewalDate);
            const soon = dLeft >= 0 && dLeft <= 3;
            const cancelBy = addDays(sub.nextRenewalDate, -leadDays);
            const reminderActive =
              settings.notificationsEnabled && dLeft >= 0 && daysUntil(cancelBy) >= 0;
            return (
              <View key={sub.id} style={styles.subCard}>
                <Pressable
                  style={styles.subMain}
                  onPress={() =>
                    navigation.navigate('AddSubscription', { subscriptionId: sub.id })
                  }
                >
                  <View style={styles.subInfo}>
                    <Text style={styles.subName} numberOfLines={1}>
                      {sub.name}
                    </Text>
                    <Text style={styles.subMeta} numberOfLines={1}>
                      {formatPrice(sub.cost)} · {cycleLabel(sub)}
                    </Text>
                    <Text style={[styles.subRenew, soon && styles.subRenewSoon]}>
                      {dLeft < 0
                        ? `Renewed ${formatDate(sub.nextRenewalDate)}`
                        : dLeft === 0
                        ? 'Renews today'
                        : `Renews in ${dLeft} day${dLeft === 1 ? '' : 's'} · ${formatDate(
                            sub.nextRenewalDate
                          )}`}
                    </Text>
                    {reminderActive && (
                      <View style={styles.reminderRow}>
                        <Ionicons
                          name="notifications-outline"
                          size={12}
                          color={colors.primary}
                        />
                        <Text style={styles.reminderText}>
                          Cancel-by reminder {formatDate(cancelBy)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={() => void openCancel(sub)}>
                  <Ionicons name="close-circle-outline" size={16} color={colors.coral} />
                  <Text style={styles.cancelText}>Cancel / manage</Text>
                </Pressable>
              </View>
            );
          })}

          <Button
            title="Add another subscription"
            variant="ghost"
            onPress={() => navigation.navigate('AddSubscription', {})}
            style={styles.addMore}
          />
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.md, paddingBottom: spacing.xxl },
    empty: {
      alignItems: 'center',
      paddingTop: spacing.xxl,
      paddingHorizontal: spacing.md,
    },
    emptyIcon: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    emptyTitle: {
      fontFamily: fonts.displayBold,
      fontSize: 20,
      color: colors.deepBlue,
      textAlign: 'center',
    },
    emptyBody: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 21,
      marginTop: spacing.sm,
    },
    emptyBtn: { alignSelf: 'stretch', marginTop: spacing.lg },
    totalCard: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      padding: spacing.lg,
      alignItems: 'center',
      marginBottom: spacing.md,
      ...cardShadow,
    },
    totalLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.muted,
    },
    totalValue: {
      fontFamily: fonts.displayBold,
      fontSize: 32,
      color: colors.deepBlue,
      marginTop: 2,
    },
    totalSub: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.muted,
      marginTop: 4,
    },
    subCard: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      marginBottom: spacing.sm,
      ...cardShadow,
    },
    subMain: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
    },
    subInfo: { flex: 1 },
    subName: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 16,
      color: colors.deepBlue,
    },
    subMeta: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.muted,
      marginTop: 2,
    },
    subRenew: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.text,
      marginTop: 4,
    },
    subRenewSoon: { color: colors.coral },
    reminderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    reminderText: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.primary,
    },
    cancelBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
    },
    cancelText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
      color: colors.coral,
    },
    addMore: { marginTop: spacing.sm },
  });
