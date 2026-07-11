import { Ionicons } from '@expo/vector-icons';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { Palette, cardShadow, fonts, radii, spacing } from '../theme/theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { successFeedback, tapFeedback, warningFeedback } from '../utils/haptics';

export type ToastVariant = 'success' | 'info' | 'error';

interface ToastState {
  message: string;
  variant: ToastVariant;
  /** bump each show so re-toasting the same text still re-animates */
  key: number;
}

type ShowToast = (message: string, variant?: ToastVariant) => void;

const ToastContext = createContext<ShowToast>(() => {});

/** Show a brief, auto-dismissing toast. Use for confirmations ("Saved"),
 *  not for decisions — those still belong in an Alert. */
export function useToast(): ShowToast {
  return useContext(ToastContext);
}

const ICON: Record<ToastVariant, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  info: 'information-circle',
  error: 'alert-circle',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [toast, setToast] = useState<ToastState | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const show = useCallback<ShowToast>(
    (message, variant = 'success') => {
      if (Platform.OS !== 'web') {
        variant === 'success'
          ? successFeedback()
          : variant === 'error'
          ? warningFeedback()
          : tapFeedback();
      }
      counter.current += 1;
      setToast({ message, variant, key: counter.current });
    },
    []
  );

  // Animate in on each new toast, then schedule the slide-out.
  useEffect(() => {
    if (!toast) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => finished && setToast(null));
    }, 2400);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [toast, anim]);

  const tint =
    toast?.variant === 'error'
      ? colors.danger
      : toast?.variant === 'info'
      ? colors.primary
      : colors.success;

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrap,
            {
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.toast}>
            <Ionicons name={ICON[toast.variant]} size={20} color={tint} />
            <Text style={styles.text} numberOfLines={2}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: spacing.md,
      right: spacing.md,
      bottom: 96, // clears the tab bar
      alignItems: 'center',
      zIndex: 1000,
    },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.card,
      borderRadius: radii.md,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
      maxWidth: 460,
      ...cardShadow,
      shadowOpacity: 0.18,
      elevation: 6,
    },
    text: {
      flex: 1,
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.text,
    },
  });
