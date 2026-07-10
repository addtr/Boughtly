import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Palette, fonts, radii, spacing } from '../theme/theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';

const { width } = Dimensions.get('window');

interface TourSlide {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Palette keys, resolved against the active theme at render */
  tint: keyof Palette;
  tintSoft: keyof Palette;
  title: string;
  body: string;
}

// The headline features, in the order a new user should meet them.
const SLIDES: TourSlide[] = [
  {
    key: 'add',
    icon: 'add-circle',
    tint: 'coral',
    tintSoft: 'coralSoft',
    title: 'Add anything in seconds',
    body: 'Scan a paper receipt, point at a product barcode, or paste an order email or screenshot — Boughtly reads the store, price, and dates for you.',
  },
  {
    key: 'deadlines',
    icon: 'notifications',
    tint: 'primary',
    tintSoft: 'primarySoft',
    title: 'Never miss a deadline',
    body: 'Countdown rings track every return window and warranty. Reminders fire before they close, and a Sunday digest previews your week ahead.',
  },
  {
    key: 'money',
    icon: 'cash',
    tint: 'success',
    tintSoft: 'successSoft',
    title: 'Price drop? Get paid',
    body: 'Watch any product’s price, scan every retailer for it cheaper, and get alerted when a store owes you a refund because the price fell after you bought.',
  },
  {
    key: 'recalls',
    icon: 'warning',
    tint: 'danger',
    tintSoft: 'coralSoft',
    title: 'Your recall guardian',
    body: 'Boughtly quietly checks your items against the official US recall database. If something you own is recalled, you’ll know — usually a free fix or refund.',
  },
  {
    key: 'register',
    icon: 'color-wand',
    tint: 'primary',
    tintSoft: 'primarySoft',
    title: 'Register without the typing',
    body: 'One tap opens the maker’s registration page and auto-fills your name, serial number, and purchase details — you just review and submit.',
  },
  {
    key: 'card',
    icon: 'card',
    tint: 'success',
    tintSoft: 'successSoft',
    title: 'Unlock hidden card perks',
    body: 'Paid by credit card? Many double the warranty and refund items the store won’t take back. Boughtly tells you when those perks apply.',
  },
  {
    key: 'returns',
    icon: 'hand-left',
    tint: 'coral',
    tintSoft: 'coralSoft',
    title: 'Returns without the fight',
    body: 'Swipe any item to start a return, jump straight to the store’s returns page, track the package, and get nudged until the refund actually lands.',
  },
  {
    key: 'safety',
    icon: 'shield-checkmark',
    tint: 'primary',
    tintSoft: 'primarySoft',
    title: 'Everything, safely yours',
    body: 'Spending insights, a year-in-review, one-tap insurance PDF of everything you own, backups, and Face ID lock — all stored only on your phone.',
  },
];

/**
 * Full-screen swipeable walkthrough of the headline features. Shown once on
 * first landing, replayable from Settings.
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
  const listRef = useRef<FlatList<TourSlide>>(null);
  const isLast = page === SLIDES.length - 1;

  function close() {
    setPage(0);
    onDone();
  }

  function next() {
    if (isLast) {
      close();
      return;
    }
    const target = page + 1;
    listRef.current?.scrollToIndex({ index: target, animated: true });
    setPage(target); // momentum event doesn't fire on programmatic scrolls
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={styles.container}>
        <Pressable style={styles.skip} onPress={close} hitSlop={12}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>

        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(s) => s.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) =>
            setPage(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item }) => (
            <View style={[styles.slide, { width }]}>
              <View style={[styles.iconDisk, { backgroundColor: colors[item.tintSoft] }]}>
                <Ionicons name={item.icon} size={72} color={colors[item.tint]} />
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          )}
        />

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((s, i) => (
              <View key={s.key} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.nextBtn,
              isLast && styles.nextBtnLast,
              pressed && { opacity: 0.88 },
            ]}
            onPress={next}
          >
            <Text style={styles.nextBtnText}>
              {isLast ? 'Got it — let’s go' : 'Next'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skip: {
    position: 'absolute',
    top: 58,
    right: spacing.lg,
    zIndex: 2,
    padding: 6,
  },
  skipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.muted,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  iconDisk: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 26,
    color: colors.deepBlue,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: spacing.md,
    minHeight: 120,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    gap: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.divider,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 22,
  },
  nextBtn: {
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 15,
    alignItems: 'center',
  },
  nextBtnLast: {
    backgroundColor: colors.coral,
  },
  nextBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
