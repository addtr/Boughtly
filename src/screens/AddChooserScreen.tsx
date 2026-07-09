import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from '../navigation/types';
import { cardShadow, colors, fonts, radii, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AddChooser'>;

/** Modal asking how the user wants to add a purchase. */
export function AddChooserScreen({ navigation }: Props) {
  function choose(mode: 'scan' | 'manual' | 'barcode') {
    navigation.replace('AddItem', { mode });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
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
          <Ionicons name="camera" size={20} color={colors.primary} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Scan the receipt</Text>
          <Text style={styles.optionBody}>
            Snap a photo — the details fill in for you.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
        onPress={() => choose('barcode')}
      >
        <View style={[styles.optionIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="barcode" size={20} color={colors.primary} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Scan a barcode</Text>
          <Text style={styles.optionBody}>
            No receipt? Track a single item from its barcode.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
        onPress={() => choose('manual')}
      >
        <View style={[styles.optionIcon, { backgroundColor: colors.coralSoft }]}>
          <Ionicons name="create" size={20} color={colors.coral} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Enter it manually</Text>
          <Text style={styles.optionBody}>
            No receipt handy? Type in the details yourself.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
        onPress={() => navigation.replace('PasteReceipt')}
      >
        <View style={[styles.optionIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="clipboard" size={20} color={colors.primary} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Paste or screenshot a receipt</Text>
          <Text style={styles.optionBody}>
            Bought online? Paste the order email or upload a screenshot.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
        onPress={() => navigation.replace('AddWatch')}
      >
        <View style={[styles.optionIcon, { backgroundColor: colors.successSoft }]}>
          <Ionicons name="pricetags" size={20} color={colors.success} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Watch a price</Text>
          <Text style={styles.optionBody}>
            Not buying yet? Track the price and catch the real deal.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </Pressable>

      <Pressable style={styles.cancel} onPress={() => navigation.goBack()} hitSlop={8}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.divider,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    color: colors.deepBlue,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...cardShadow,
    shadowOpacity: 0.06,
    elevation: 2,
  },
  optionPressed: {
    opacity: 0.85,
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.deepBlue,
  },
  optionBody: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
    lineHeight: 16,
  },
  cancel: {
    alignSelf: 'center',
    marginTop: spacing.xs,
    padding: spacing.sm,
  },
  cancelText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.muted,
  },
});
