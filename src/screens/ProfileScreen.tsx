import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { successFeedback } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Edit the local profile: name, email, phone, and account password. */
export function ProfileScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { settings, updateSettings } = useAppState();
  const toast = useToast();

  const [name, setName] = useState(settings.accountName);
  const [email, setEmail] = useState(settings.accountEmail);
  const [phone, setPhone] = useState(settings.accountPhone);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const hasPassword = !!settings.accountPassword;

  async function handleSave() {
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) {
      Alert.alert('Check your email', 'That doesn’t look like an email address.');
      return;
    }
    // Password is optional to change — only validate if they typed something.
    const changingPassword = password.length > 0 || confirm.length > 0;
    if (changingPassword) {
      if (password.length < 6) {
        Alert.alert('Password too short', 'Use at least 6 characters.');
        return;
      }
      if (password !== confirm) {
        Alert.alert('Passwords don’t match', 'Re-enter the same password in both fields.');
        return;
      }
    }
    setSaving(true);
    try {
      await updateSettings({
        accountName: name.trim() || cleanEmail.split('@')[0],
        accountEmail: cleanEmail,
        accountPhone: phone.trim(),
        ...(changingPassword ? { accountPassword: password } : {}),
      });
      successFeedback();
      toast('Profile saved');
      setPassword('');
      setConfirm('');
      navigation.goBack();
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
        <Text style={styles.sectionTitle}>Your details</Text>
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          autoCapitalize="words"
          autoComplete="name"
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          label="Phone number (optional)"
          value={phone}
          onChangeText={setPhone}
          placeholder="(555) 123-4567"
          keyboardType="phone-pad"
          autoComplete="tel"
        />

        <Text style={styles.sectionTitle}>
          Password {hasPassword ? '' : '(none set yet)'}
        </Text>
        <Field
          label={hasPassword ? 'New password' : 'Create a password'}
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password-new"
        />
        <Field
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Re-enter password"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password-new"
        />

        <Button
          title={saving ? 'Saving…' : 'Save changes'}
          onPress={() => void handleSave()}
          disabled={saving || !email.trim()}
          style={styles.save}
        />

        <View style={styles.note}>
          <Ionicons name="phone-portrait-outline" size={16} color={colors.muted} style={styles.noteIcon} />
          <Text style={styles.noteText}>
            Your profile is saved on this device. Boughtly doesn’t have cloud accounts yet,
            so signing in on another phone with these details isn’t possible — your data
            lives only here. To move to a new phone, use Back up my data in Settings. To
            keep the app private on this device, turn on the Face ID / passcode lock.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.md, paddingBottom: spacing.xxl },
    sectionTitle: {
      fontFamily: fonts.display,
      fontSize: 16,
      color: colors.deepBlue,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    save: { marginTop: spacing.sm },
    note: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: radii.md,
      padding: spacing.md,
      marginTop: spacing.lg,
    },
    noteIcon: {
      marginTop: 1,
    },
    noteText: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 18,
      color: colors.muted,
    },
  });
