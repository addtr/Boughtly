import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/ui';
import { useToast } from '../components/Toast';
import { RootStackParamList } from '../navigation/types';
import {
  PLUS_PERKS,
  PLUS_PRICE_MONTHLY,
  PLUS_PRICE_YEARLY,
  PlusPlan,
  purchasePlus,
  restorePlus,
} from '../services/plus';
import { useAppState } from '../store/AppStateContext';
import { Palette, cardShadow, fonts, radii, spacing } from '../theme/theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { successFeedback } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Plus'>;

export function PlusScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { settings, updateSettings } = useAppState();
  const toast = useToast();
  const [plan, setPlan] = useState<PlusPlan>('yearly');
  const [busy, setBusy] = useState(false);

  const isPlus = settings.isPlus;

  async function goPlus() {
    setBusy(true);
    try {
      const ok = await purchasePlus(plan);
      if (ok) {
        await updateSettings({ isPlus: true });
        successFeedback();
        toast('Welcome to Boughtly Plus 💜');
        navigation.goBack();
      } else {
        Alert.alert(
          'Billing isn’t live yet',
          'In-app purchases turn on in a real App Store build. Everything else about Plus is ready to go.'
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    const ok = await restorePlus();
    if (ok) {
      await updateSettings({ isPlus: true });
      toast('Plus restored');
      navigation.goBack();
    } else {
      Alert.alert('Nothing to restore', 'We couldn’t find a previous Plus purchase on this account.');
    }
  }

  if (isPlus) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.badge}>
          <Ionicons name="sparkles" size={28} color={colors.primary} />
        </View>
        <Text style={styles.title}>You’re on Boughtly Plus 💜</Text>
        <Text style={styles.subtitle}>
          Thanks for supporting the app. Every perk below is unlocked.
        </Text>
        <View style={styles.perks}>
          {PLUS_PERKS.map((p) => (
            <View key={p.title} style={styles.perkRow}>
              <Ionicons name={p.icon as any} size={20} color={colors.primary} />
              <View style={styles.perkText}>
                <Text style={styles.perkTitle}>{p.title}</Text>
                <Text style={styles.perkBody}>{p.body}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            </View>
          ))}
        </View>
        {__DEV__ && (
          <Pressable onPress={() => void updateSettings({ isPlus: false })} style={styles.devRow}>
            <Text style={styles.devText}>Dev: turn Plus off</Text>
          </Pressable>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.badge}>
        <Ionicons name="sparkles" size={28} color={colors.primary} />
      </View>
      <Text style={styles.title}>Boughtly Plus</Text>
      <Text style={styles.subtitle}>
        Get more out of every purchase — no ads, no limits, and the pro tools.
      </Text>

      <View style={styles.perks}>
        {PLUS_PERKS.map((p) => (
          <View key={p.title} style={styles.perkRow}>
            <View style={styles.perkIcon}>
              <Ionicons name={p.icon as any} size={19} color={colors.primary} />
            </View>
            <View style={styles.perkText}>
              <Text style={styles.perkTitle}>{p.title}</Text>
              <Text style={styles.perkBody}>{p.body}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Plan picker */}
      <View style={styles.plans}>
        <Pressable
          style={[styles.plan, plan === 'yearly' && styles.planActive]}
          onPress={() => setPlan('yearly')}
        >
          <View style={styles.planTop}>
            <Text style={[styles.planName, plan === 'yearly' && styles.planNameActive]}>
              Yearly
            </Text>
            <View style={styles.saveTag}>
              <Text style={styles.saveTagText}>Best value</Text>
            </View>
          </View>
          <Text style={[styles.planPrice, plan === 'yearly' && styles.planNameActive]}>
            {PLUS_PRICE_YEARLY}
            <Text style={styles.planPer}>/yr</Text>
          </Text>
        </Pressable>
        <Pressable
          style={[styles.plan, plan === 'monthly' && styles.planActive]}
          onPress={() => setPlan('monthly')}
        >
          <Text style={[styles.planName, plan === 'monthly' && styles.planNameActive]}>
            Monthly
          </Text>
          <Text style={[styles.planPrice, plan === 'monthly' && styles.planNameActive]}>
            {PLUS_PRICE_MONTHLY}
            <Text style={styles.planPer}>/mo</Text>
          </Text>
        </Pressable>
      </View>

      <Button
        title={busy ? 'One sec…' : 'Start Boughtly Plus'}
        variant="coral"
        onPress={() => void goPlus()}
        disabled={busy}
        style={styles.cta}
      />
      <Pressable onPress={() => void restore()} style={styles.restoreRow} hitSlop={8}>
        <Text style={styles.restoreText}>Restore purchase</Text>
      </Pressable>

      {__DEV__ && (
        <Pressable
          onPress={() => void updateSettings({ isPlus: true })}
          style={styles.devRow}
        >
          <Text style={styles.devText}>Dev: unlock Plus (test)</Text>
        </Pressable>
      )}

      <Text style={styles.legal}>
        Billing is handled by the App Store. Subscriptions renew until cancelled;
        manage or cancel anytime in your device Settings. See our{' '}
        <Text style={styles.legalLink} onPress={() => navigation.navigate('Legal', { doc: 'terms' })}>
          Terms
        </Text>{' '}
        and{' '}
        <Text style={styles.legalLink} onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}>
          Privacy Policy
        </Text>
        .
      </Text>
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    badge: {
      alignSelf: 'center',
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    title: {
      fontFamily: fonts.displayBold,
      fontSize: 26,
      color: colors.deepBlue,
      textAlign: 'center',
    },
    subtitle: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.muted,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    perks: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      padding: spacing.md,
      gap: spacing.md,
      marginBottom: spacing.lg,
      ...cardShadow,
    },
    perkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    perkIcon: {
      width: 38,
      height: 38,
      borderRadius: radii.sm,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    perkText: { flex: 1 },
    perkTitle: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.deepBlue },
    perkBody: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 1, lineHeight: 16 },
    plans: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    plan: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radii.md,
      padding: spacing.md,
      borderWidth: 2,
      borderColor: 'transparent',
      ...cardShadow,
      shadowOpacity: 0.05,
      elevation: 1,
    },
    planActive: { borderColor: colors.primary },
    planTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    planName: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.text },
    planNameActive: { color: colors.deepBlue },
    planPrice: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.deepBlue, marginTop: 6 },
    planPer: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
    saveTag: {
      backgroundColor: colors.successSoft,
      borderRadius: 100,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    saveTagText: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.success },
    cta: { marginTop: spacing.xs },
    restoreRow: { alignSelf: 'center', paddingVertical: spacing.md },
    restoreText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.primary },
    devRow: { alignSelf: 'center', paddingVertical: spacing.sm },
    devText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.muted },
    legal: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 16,
      marginTop: spacing.sm,
    },
    legalLink: { fontFamily: fonts.bodySemiBold, color: colors.primary },
  });
