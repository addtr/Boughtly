import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Palette, fonts, radii, spacing } from '../theme/theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { Button } from './ui';

interface TourSlide {
  icon: keyof typeof Ionicons.glyphMap;
  /** Palette keys, resolved against the active theme at render */
  tint: keyof Palette;
  tintSoft: keyof Palette;
  title: string;
  body: string;
}

const SLIDES: TourSlide[] = [
  {
    icon: 'add-circle',
    tint: 'coral',
    tintSoft: 'coralSoft',
    title: 'Add anything with +',
    body: 'Scan a paper receipt, point at a product barcode, or paste an order email / screenshot — Boughtly reads the details for you.',
  },
  {
    icon: 'hand-left',
    tint: 'primary',
    tintSoft: 'primarySoft',
    title: 'Swipe a card',
    body: 'Swipe any item on your home list to start a return or delete it — no digging through menus.',
  },
  {
    icon: 'stats-chart',
    tint: 'primary',
    tintSoft: 'primarySoft',
    title: 'Tap your stats',
    body: 'The numbers at the top open your spending insights — monthly totals, top stores, and your yearly recap.',
  },
  {
    icon: 'storefront',
    tint: 'primary',
    tintSoft: 'primarySoft',
    title: 'Store pages',
    body: 'Tap a store chip to see everything you bought there, its return policy, and a shortcut to its returns page.',
  },
  {
    icon: 'cash',
    tint: 'success',
    tintSoft: 'successSoft',
    title: 'Free money alerts',
    body: 'A green card means a store will refund the difference if the price dropped after you bought — most people never claim it.',
  },
  {
    icon: 'notifications',
    tint: 'coral',
    tintSoft: 'coralSoft',
    title: 'Never miss a deadline',
    body: 'Reminders fire before return windows and warranties close. Add your own on any item, and see every scheduled nudge right on Home.',
  },
];

/**
 * One-time walkthrough of the features people otherwise never find.
 * Replayable from Settings.
 */
export function FeatureTour({
  visible,
  onDone,
}: {
  visible: boolean;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [page, setPage] = useState(0);
  const slide = SLIDES[page];
  const isLast = page === SLIDES.length - 1;

  function close() {
    setPage(0);
    onDone();
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Pressable style={styles.skip} onPress={close} hitSlop={10}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>

          <View style={[styles.iconDisk, { backgroundColor: colors[slide.tintSoft] }]}>
            <Ionicons name={slide.icon} size={44} color={colors[slide.tint]} />
          </View>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.body}>{slide.body}</Text>

          <View style={styles.dots}>
            {SLIDES.map((s, i) => (
              <View
                key={s.title}
                style={[styles.dot, i === page && styles.dotActive]}
              />
            ))}
          </View>
          <Button
            title={isLast ? 'Got it — let’s go' : 'Next'}
            variant={isLast ? 'coral' : 'primary'}
            onPress={() => (isLast ? close() : setPage(page + 1))}
            style={styles.next}
          />
          {page > 0 && (
            <Pressable onPress={() => setPage(page - 1)} hitSlop={8} style={styles.back}>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 18, 28, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  skip: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    padding: 4,
  },
  skipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.muted,
  },
  iconDisk: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 21,
    color: colors.deepBlue,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: spacing.sm,
    minHeight: 84,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.divider,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 20,
  },
  next: {
    alignSelf: 'stretch',
  },
  back: {
    marginTop: spacing.sm,
    padding: 4,
  },
  backText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.muted,
  },
});
