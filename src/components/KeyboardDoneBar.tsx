import React from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Palette, fonts, spacing } from '../theme/theme';
import { useThemedStyles } from '../theme/ThemeContext';

/** Shared id so every numeric field references the one Done bar. */
export const DONE_ACCESSORY_ID = 'boughtly-done-accessory';

/**
 * A "Done" bar shown above the keyboard on iOS. Numeric keypads (decimal-pad /
 * number-pad) have no return key, so there's otherwise no on-keyboard way to
 * dismiss them — you have to tap the screen behind the keyboard, which feels
 * broken. Mount this once on any screen with numeric inputs and set
 * `inputAccessoryViewID={DONE_ACCESSORY_ID}` on those inputs.
 *
 * iOS only — Android numeric keyboards already include a dismiss/return key,
 * and InputAccessoryView isn't supported there, so this renders nothing.
 */
export function KeyboardDoneBar() {
  const styles = useThemedStyles(makeStyles);
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={DONE_ACCESSORY_ID}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => Keyboard.dismiss()}
          hitSlop={10}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.btnText}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    bar: {
      backgroundColor: colors.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    btn: {
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
    },
    btnText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 16,
      color: colors.primary,
    },
  });
