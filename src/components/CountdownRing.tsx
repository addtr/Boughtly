import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts, URGENT_DAYS_THRESHOLD } from '../theme/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CountdownRingProps {
  daysLeft: number;
  /** Total window length in days; ring is full at purchase, empty at deadline */
  totalDays: number;
  size?: number;
  strokeWidth?: number;
  /** Small label under the number, e.g. "days" or "return" */
  label?: string;
}

/**
 * Boughtly's signature element: a circular ring that depletes as a deadline
 * approaches. Blue while there's plenty of time, coral when urgent.
 */
export function CountdownRing({
  daysLeft,
  totalDays,
  size = 72,
  strokeWidth = 6,
  label = 'days',
}: CountdownRingProps) {
  const expired = daysLeft < 0;
  const clampedDays = Math.max(daysLeft, 0);
  const fraction =
    totalDays > 0 ? Math.min(Math.max(clampedDays / totalDays, 0), 1) : 0;
  const urgent = daysLeft <= URGENT_DAYS_THRESHOLD;
  const ringColor = expired ? colors.muted : urgent ? colors.coral : colors.primary;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Animate the ring filling in from empty to its current fraction on mount,
  // and smoothly to new values on update.
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: fraction,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [fraction, progress]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const numberSize = size * (String(clampedDays).length > 2 ? 0.26 : 0.32);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.ringTrack}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          // Start the ring at 12 o'clock
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center}>
        {expired ? (
          <Text style={[styles.expiredText, { fontSize: size * 0.18 }]}>Done</Text>
        ) : (
          <>
            <Text style={[styles.number, { fontSize: numberSize, color: ringColor }]}>
              {clampedDays}
            </Text>
            <Text style={[styles.label, { fontSize: size * 0.13 }]}>{label}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontFamily: fonts.displayBold,
    lineHeight: undefined,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    color: colors.muted,
    marginTop: -2,
  },
  expiredText: {
    fontFamily: fonts.display,
    color: colors.muted,
  },
});
