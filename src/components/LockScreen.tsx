import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Palette, fonts, spacing } from '../theme/theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { Button } from './ui';

/**
 * Full-screen gate shown while the app is locked. Tries Face ID / passcode
 * automatically on mount; the button retries after a cancel or failure.
 */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [trying, setTrying] = useState(false);

  const tryUnlock = useCallback(async () => {
    if (trying) return;
    setTrying(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Boughtly',
      });
      if (result.success) onUnlock();
    } finally {
      setTrying(false);
    }
  }, [trying, onUnlock]);

  useEffect(() => {
    // Kick off the system prompt right away.
    const t = setTimeout(() => void tryUnlock(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/splash-icon.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <View style={styles.lockBadge}>
        <Ionicons name="lock-closed" size={22} color={colors.primary} />
      </View>
      <Text style={styles.title}>Boughtly is locked</Text>
      <Text style={styles.body}>Your receipts and purchases stay private.</Text>
      <Button
        title={trying ? 'Unlocking…' : 'Unlock'}
        onPress={() => void tryUnlock()}
        disabled={trying}
        style={styles.button}
      />
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  logo: {
    width: 96,
    height: 96,
  },
  lockBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -spacing.md,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    color: colors.deepBlue,
    marginTop: spacing.md,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    marginTop: 6,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  button: {
    alignSelf: 'stretch',
  },
});
