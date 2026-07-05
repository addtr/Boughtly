import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { cardShadow, colors, fonts, radii, spacing } from '../theme/theme';

/* ---------- Buttons ---------- */

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'coral' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, onPress, variant = 'primary', disabled, style }: ButtonProps) {
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'coral'
      ? colors.coral
      : variant === 'danger'
      ? colors.danger
      : 'transparent';
  const fg = variant === 'ghost' ? colors.primary : '#FFFFFF';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        variant === 'ghost' && styles.ghostButton,
        style,
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

/* ---------- Form field ---------- */

interface FieldProps extends TextInputProps {
  label: string;
}

export function Field({ label, style, ...inputProps }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, style]}
        {...inputProps}
      />
    </View>
  );
}

/* ---------- Preset chips (warranty / return window pickers) ---------- */

interface ChipRowProps {
  options: ReadonlyArray<{ label: string; days: number }>;
  selectedDays: number | null;
  onSelect: (days: number) => void;
  /** Called when the "Custom" chip is tapped */
  onCustom: () => void;
  customActive: boolean;
}

export function ChipRow({ options, selectedDays, onSelect, onCustom, customActive }: ChipRowProps) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = !customActive && selectedDays === opt.days;
        return (
          <Pressable
            key={opt.days}
            onPress={() => onSelect(opt.days)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
      <Pressable onPress={onCustom} style={[styles.chip, customActive && styles.chipActive]}>
        <Text style={[styles.chipText, customActive && styles.chipTextActive]}>Custom</Text>
      </Pressable>
    </View>
  );
}

/* ---------- Card ---------- */

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  ghostButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  buttonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
  },
  fieldWrap: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    ...cardShadow,
    shadowOpacity: 0.05,
    elevation: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    ...cardShadow,
    shadowOpacity: 0.05,
    elevation: 1,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.text,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...cardShadow,
  },
});
