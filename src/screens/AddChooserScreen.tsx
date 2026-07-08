import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from '../navigation/types';
import { cardShadow, colors, fonts, radii, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AddChooser'>;

/** Modal asking how the user wants to add a purchase. */
export function AddChooserScreen({ navigation }: Props) {
  function choose(mode: 'scan' | 'manual') {
    navigation.replace('AddItem', { mode });
  }

  return (
    <View style={styles.container}>
      <View style={styles.grabber} />
      <Text style={styles.title}>Add something you bought</Text>
      <Text style={styles.subtitle}>
        Boughtly will track its return window and warranty for you.
      </Text>

      <Pressable
        style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
        onPress={() => choose('scan')}
      >
        <View style={[styles.optionIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="camera" size={26} color={colors.primary} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Scan the receipt</Text>
          <Text style={styles.optionBody}>
            Snap a photo — the details fill in for you.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
        onPress={() => choose('manual')}
      >
        <View style={[styles.optionIcon, { backgroundColor: colors.coralSoft }]}>
          <Ionicons name="create" size={26} color={colors.coral} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Enter it manually</Text>
          <Text style={styles.optionBody}>
            No receipt handy? Type in the details yourself.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
        onPress={() => navigation.replace('PasteReceipt')}
      >
        <View style={[styles.optionIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="clipboard" size={24} color={colors.primary} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Paste or screenshot a receipt</Text>
          <Text style={styles.optionBody}>
            Bought online? Paste the order email or upload a screenshot.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
        onPress={() => navigation.replace('AddWatch')}
      >
        <View style={[styles.optionIcon, { backgroundColor: '#DFF3E9' }]}>
          <Ionicons name="pricetags" size={24} color="#20744E" />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Watch a price</Text>
          <Text style={styles.optionBody}>
            Not buying yet? Track the price and catch the real deal.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>

      <Pressable style={styles.cancel} onPress={() => navigation.goBack()} hitSlop={8}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.divider,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    color: colors.deepBlue,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    marginTop: 6,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
    ...cardShadow,
  },
  optionPressed: {
    opacity: 0.85,
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.deepBlue,
  },
  optionBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 18,
  },
  cancel: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    padding: spacing.sm,
  },
  cancelText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.muted,
  },
});
