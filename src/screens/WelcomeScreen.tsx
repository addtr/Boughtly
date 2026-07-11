import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Alert,
  Image,
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
import { useAppState } from '../store/AppStateContext';
import { Palette, fonts, radii, spacing } from '../theme/theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { successFeedback } from '../utils/haptics';
import { DONE_ACCESSORY_ID } from '../components/KeyboardDoneBar';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * First-launch account screen. The profile lives on this device (there's no
 * server yet), so "sign in" and "create account" both set up the local
 * profile — the split exists so the flow feels familiar and is ready to hook
 * up to real auth later.
 */
export function WelcomeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { settings, updateSettings } = useAppState();
  const [mode, setMode] = useState<'create' | 'signin'>('create');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) {
      Alert.alert('Check your email', 'That doesn’t look like an email address.');
      return;
    }
    if (mode === 'create' && !name.trim()) {
      Alert.alert('Almost there', 'Tell us your name so the app can say hi.');
      return;
    }
    setSaving(true);
    try {
      await updateSettings({
        accountName: name.trim() || cleanEmail.split('@')[0],
        accountEmail: cleanEmail,
      });
      successFeedback();
      navigation.replace(settings.hasOnboarded ? 'Tabs' : 'Onboarding');
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
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={require('../../assets/splash-icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.appName}>Boughtly</Text>
        <Text style={styles.tagline}>
          The right price before. The right protection after.
        </Text>

        {/* Create / sign-in toggle */}
        <View style={styles.tabs}>
          {(
            [
              { key: 'create', label: 'Create account' },
              { key: 'signin', label: 'Sign in' },
            ] as const
          ).map((t) => {
            const active = mode === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setMode(t.key)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode === 'create' && (
          <TextInput
          inputAccessoryViewID={DONE_ACCESSORY_ID}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
            autoComplete="name"
            style={styles.input}
          />
        )}
        <TextInput
          inputAccessoryViewID={DONE_ACCESSORY_ID}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          style={styles.input}
        />

        <Button
          title={
            saving ? 'One sec…' : mode === 'create' ? 'Create my account' : 'Sign in'
          }
          variant="coral"
          onPress={() => void submit()}
          disabled={saving || !email.trim() || (mode === 'create' && !name.trim())}
          style={styles.cta}
        />

        <Text style={styles.privacy}>
          Your account and everything you track stay on this device — nothing is
          uploaded. Back up anytime from Settings.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  logo: {
    width: 110,
    height: 110,
    alignSelf: 'center',
  },
  appName: {
    fontFamily: fonts.displayBold,
    fontSize: 30,
    color: colors.deepBlue,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: spacing.xl,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.divider,
    borderRadius: radii.md,
    padding: 4,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radii.sm,
  },
  tabActive: {
    backgroundColor: colors.card,
  },
  tabText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.deepBlue,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.md,
  },
  cta: {
    marginTop: spacing.xs,
  },
  privacy: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.lg,
  },
});
