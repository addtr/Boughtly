/**
 * Reactive theme. Resolves the user's Appearance setting (System / Light /
 * Dark, stored in AppSettings.themeMode) against the live system color
 * scheme and hands the active palette to every screen — so switching in
 * Settings (or the OS) restyles the whole app instantly, no relaunch.
 *
 * Usage in a screen/component:
 *   const styles = useThemedStyles(makeStyles);   // themed StyleSheet
 *   const { colors } = useTheme();                // inline color values
 *   ...
 *   const makeStyles = (colors: Palette) => StyleSheet.create({ ... });
 *
 * useThemedStyles caches one built StyleSheet per (factory, palette) pair,
 * so styles are created at most twice per file — same cost as before.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import { useAppState } from '../store/AppStateContext';
import { ThemeMode } from '../types/item';
import { darkPalette, lightPalette, Palette } from './theme';

interface ThemeValue {
  colors: Palette;
  /** True when the dark palette is active (for status bar, nav theme, etc.) */
  isDark: boolean;
  mode: ThemeMode;
}

const systemIsDark = () => Appearance.getColorScheme() === 'dark';

const ThemeContext = createContext<ThemeValue>({
  colors: systemIsDark() ? darkPalette : lightPalette,
  isDark: systemIsDark(),
  mode: 'system',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useAppState();
  // `?? 'system'` guards settings persisted before themeMode existed
  const mode: ThemeMode = settings.themeMode ?? 'system';
  const [systemDark, setSystemDark] = useState(systemIsDark);
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemDark(colorScheme === 'dark');
    });
    return () => sub.remove();
  }, []);

  const isDark = mode === 'system' ? systemDark : mode === 'dark';
  const value = useMemo<ThemeValue>(
    () => ({ colors: isDark ? darkPalette : lightPalette, isDark, mode }),
    [isDark, mode]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

// One built StyleSheet per (factory, palette) — palettes are the two stable
// module-level objects, so this never grows beyond two entries per factory.
const styleCache = new WeakMap<(colors: Palette) => unknown, Map<Palette, unknown>>();

export function useThemedStyles<T>(factory: (colors: Palette) => T): T {
  const { colors } = useTheme();
  let byPalette = styleCache.get(factory);
  if (!byPalette) {
    byPalette = new Map();
    styleCache.set(factory, byPalette);
  }
  let styles = byPalette.get(colors);
  if (styles === undefined) {
    styles = factory(colors);
    byPalette.set(colors, styles);
  }
  return styles as T;
}
