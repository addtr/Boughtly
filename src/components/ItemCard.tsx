import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { cardShadow, colors, fonts, radii, spacing } from '../theme/theme';
import { TrackedItem } from '../types/item';
import { formatPrice, nearestDeadline } from '../utils/dates';
import { CountdownRing } from './CountdownRing';

interface ItemCardProps {
  item: TrackedItem;
  onPress: () => void;
}

export function ItemCard({ item, onPress }: ItemCardProps) {
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
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
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
      </View>
      {item.receiptImageUri ? (
        <Image source={{ uri: item.receiptImageUri }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Text style={styles.thumbPlaceholderText}>🧾</Text>
        </View>
      )}
    </Pressable>
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
