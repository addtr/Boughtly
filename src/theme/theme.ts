/**
 * Boughtly design tokens.
 * These values are the single source of truth for color, type, spacing,
 * and radii across the app — do not hardcode hex values in screens.
 *
 * Dark mode: the active palette is provided reactively by ThemeContext
 * (System / Light / Dark, switchable in Settings, applies instantly).
 * Screens get colors via useTheme()/useThemedStyles() — never import a
 * palette directly.
 */

export interface Palette {
  primary: string;
  deepBlue: string;
  coral: string;
  background: string;
  card: string;
  text: string;
  muted: string;
  primarySoft: string;
  coralSoft: string;
  ringTrack: string;
  danger: string;
  divider: string;
  success: string;
  successSoft: string;
}

export const lightPalette: Palette = {
  /** Headers, primary buttons, calm/plenty-of-time states */
  primary: '#4C7EF3',
  /** Headings / strong text (light on dark surfaces in dark mode) */
  deepBlue: '#1F2A44',
  /** Urgent deadlines, CTAs, key alerts */
  coral: '#FF6B54',
  /** Warm off-white app background */
  background: '#FAF7F2',
  /** Card surface */
  card: '#FFFFFF',
  /** Body text */
  text: '#2B2E33',
  /** Secondary info */
  muted: '#7A7F8A',
  primarySoft: '#E4ECFD',
  coralSoft: '#FFE7E2',
  ringTrack: '#ECEAE4',
  danger: '#E04E36',
  divider: '#F0EDE6',
  /** Good news: refunds landed, deals, open opportunity windows */
  success: '#20744E',
  successSoft: '#DFF3E9',
};

// Dark steps of the same hues — chosen for contrast on the dark surfaces,
// not a mechanical inversion.
export const darkPalette: Palette = {
  primary: '#6E97F6',
  deepBlue: '#E7EAF2',
  coral: '#FF7E68',
  background: '#14161C',
  card: '#1E222B',
  text: '#D9DCE3',
  muted: '#9098A8',
  primarySoft: '#263455',
  coralSoft: '#412823',
  ringTrack: '#2A2F3A',
  danger: '#F0604A',
  divider: '#2B303B',
  success: '#5FBE8C',
  successSoft: '#1E3529',
};

export const fonts = {
  /** Display face — screen titles, day-count numerals */
  display: 'Sora_600SemiBold',
  displayBold: 'Sora_700Bold',
  /** Body/UI face */
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

/** Soft shadow used on all cards — no hard borders. */
export const cardShadow = {
  shadowColor: '#1F2A44',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
} as const;

/** Days-remaining threshold at which UI shifts from calm blue to urgent coral. */
export const URGENT_DAYS_THRESHOLD = 3;
