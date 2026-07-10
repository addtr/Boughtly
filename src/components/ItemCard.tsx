import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { cardShadow, colors, fonts, radii, spacing } from '../theme/theme';
import { TrackedItem } from '../types/item';
import { formatDate, formatPrice, nearestDeadline } from '../utils/dates';
import { CountdownRing } from './CountdownRing';

interface ItemCardProps {
  item: TrackedItem;
  onPress: () => void;
  /** Position in the list — staggers the entrance animation */
  index?: number;
}

export function ItemCard({ item, onPress, index = 0 }: ItemCardProps) {
  // Gentle fade-and-rise entrance, staggered down the list
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 380,
      delay: Math.min(index, 6) * 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance, index]);
  const deadline = nearestDeadline(item);
  const deadlineCopy =
    deadline.daysLeft < 0
      ? 'Protection ended'
      : deadline.kind === 'return'
      ? deadline.daysLeft === 0
        ? 'Last day to return this'
        : `${deadline.daysLeft} day${deadline.daysLeft === 1 ? '' : 's'} left to return this`
      : deadline.daysLeft === 0
      ? 'Warranty ends today'
      : `Warranty ends in ${deadline.daysLeft} day${deadline.daysLeft === 1 ? '' : 's'}`;

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [
          {
            translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
          },
        ],
      }}
    >
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
      ]}
    >
      <CountdownRing
        daysLeft={deadline.daysLeft}
        totalDays={deadline.totalDays}
        size={72}
        label={deadline.kind === 'return' ? 'return' : 'warranty'}
      />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.itemName}
        </Text>
        <Text style={styles.store} numberOfLines={1}>
          {item.storeName} · {formatPrice(item.price)}
        </Text>
        <Text style={styles.deadline} numberOfLines={1}>
          {deadlineCopy}
        </Text>
        {item.customReminder ? (
          <View style={styles.reminderRow}>
            <Ionicons name="notifications" size={12} color={colors.primary} />
            <Text style={styles.reminderText} numberOfLines={1}>
              {item.customReminder.note} · {formatDate(item.customReminder.date)}
            </Text>
          </View>
        ) : null}
      </View>
      {item.receiptThumbUri || item.receiptImageUri ? (
        <Image
          source={{ uri: item.receiptThumbUri ?? item.receiptImageUri! }}
          style={styles.thumb}
        />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Text style={styles.thumbPlaceholderText}>🧾</Text>
        </View>
      )}
    </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
    ...cardShadow,
  },
  info: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.deepBlue,
  },
  store: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  deadline: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.text,
    marginTop: 6,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  reminderText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.primary,
  },
  thumb: {
    width: 44,
    height: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.divider,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholderText: {
    fontSize: 20,
  },
});
