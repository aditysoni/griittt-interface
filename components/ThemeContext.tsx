import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';

export type AppTheme = {
  isDark: boolean;
  mode: ThemeMode;

  // Backgrounds
  bg: string;
  bgGradient: [string, string];

  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;

  // Borders
  border: string;
  borderStrong: string;

  // Surfaces
  surface: string;        // very subtle elevated
  surfaceStrong: string;  // more visible
  card: string;           // solid card bg
  cardElevated: string;   // deeper solid card

  // Overlays (additive over bg)
  overlay: string;        // ~6%
  overlayMid: string;     // ~12%
  overlayStrong: string;  // ~25%

  // Inverse (opposite of bg, for "accent" pills)
  inverse: string;
  inverseText: string;

  // Status / fixed
  success: string;
  warning: string;
  danger: string;

  // Hype accent — lime in light mode, used for wins / signature highlights
  accent: string;
  accentText: string;
  accentSoft: string;     // tinted bg for lime pills/badges

  // Heat — streaks, "on fire", intensity. Never used for errors.
  heat: string;
  heatText: string;
  heatSoft: string;

  // Cool — secondary data, info, hydration. Readable as text in both modes.
  cool: string;
  coolSoft: string;

  // Tab/pill active states
  tabActiveBg: string;
  tabActiveText: string;

  // Backdrop for modals
  backdrop: string;
};

function buildTheme(mode: ThemeMode): AppTheme {
  const isDark = mode === 'dark';
  return {
    isDark,
    mode,

    // Warm Coach: cream bg + ink in light, warm carbon in dark, lime hype in both.
    // Dark mode is deliberately NOT pure black — a warm carbon keeps it in the same
    // family as the cream side, and stops the lime from reading as neon-on-void.
    bg:           isDark ? '#0E0C09' : '#F5F1E8',
    bgGradient:   isDark ? ['#0E0C09', '#1A1613'] : ['#F5F1E8', '#ECE8DC'],

    // Warm off-white instead of #FFF — pure white on near-black haloes on OLED,
    // and this app gets opened at 6am and last thing at night.
    text:          isDark ? '#F7F4EC' : '#14110D',
    textSecondary: isDark ? '#9A9287' : '#5C544A',
    textTertiary:  isDark ? '#6E675D' : '#A39B8E',
    textMuted:     isDark ? 'rgba(247,244,236,0.42)' : '#A39B8E',

    border:        isDark ? 'rgba(247,244,236,0.10)' : '#E8E0CE',
    borderStrong:  isDark ? 'rgba(247,244,236,0.18)' : '#D4C9B0',

    surface:       isDark ? 'rgba(247,244,236,0.05)' : '#EFE8D7',
    surfaceStrong: isDark ? 'rgba(247,244,236,0.08)' : '#E8E0CE',
    card:          isDark ? '#17140F' : '#FFFFFF',
    // Elevated must clear the `surface` wash, which composites to ~#1A1814 over
    // the carbon ground — anything closer and raised elements (segmented pills,
    // bottom sheets) read as holes instead of surfaces.
    cardElevated:  isDark ? '#252017' : '#FFFBEC',

    overlay:       isDark ? 'rgba(247,244,236,0.06)' : '#EFE8D7',
    overlayMid:    isDark ? 'rgba(247,244,236,0.15)' : 'rgba(20,17,13,0.10)',
    overlayStrong: isDark ? 'rgba(247,244,236,0.25)' : 'rgba(20,17,13,0.20)',

    inverse:       isDark ? '#F7F4EC' : '#14110D',
    inverseText:   isDark ? '#14110D' : '#FFFFFF',

    success: isDark ? '#34C759' : '#22A664',
    warning: isDark ? '#F59E0B' : '#F0A12E',
    danger:  isDark ? '#EF4444' : '#E84A4A',

    accent:      '#B8F23A',  // lime — same across modes (it's the brand spark)
    accentText:  '#14110D',  // ink reads on lime in both modes
    accentSoft:  isDark ? 'rgba(184,242,58,0.16)' : 'rgba(184,242,58,0.30)',

    // Streaks get their own colour. Borrowing warning-amber or danger-red for a
    // streak paints the app's best moment in its alarm palette.
    heat:      isDark ? '#FF6B2C' : '#E05416',
    heatText:  '#FFFFFF',
    heatSoft:  isDark ? 'rgba(255,107,44,0.16)' : 'rgba(224,84,22,0.12)',

    cool:      isDark ? '#4CC9F0' : '#0E7490',
    coolSoft:  isDark ? 'rgba(76,201,240,0.16)' : 'rgba(14,116,144,0.12)',

    tabActiveBg:   isDark ? '#F7F4EC' : '#14110D',
    tabActiveText: isDark ? '#14110D' : '#FFFFFF',

    backdrop: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(20,17,13,0.4)',
  };
}

type ThemeContextType = {
  theme: AppTheme;
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
};

const STORAGE_KEY = 'grittt_theme_mode';

const ThemeContext = createContext<ThemeContextType>({
  theme: buildTheme('dark'),
  setMode: () => {},
  toggleMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (raw === 'light' || raw === 'dark') setModeState(raw);
      })
      .catch(() => {});
  }, []);

  function setMode(next: ThemeMode) {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }

  function toggleMode() {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }

  return (
    <ThemeContext.Provider value={{ theme: buildTheme(mode), setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
