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

    // Warm Coach palette in light mode: parchment bg matching Mirror design.
    bg:           isDark ? '#000000' : '#ECE8DC',
    bgGradient:   isDark ? ['#000000', '#1F1E1E'] : ['#ECE8DC', '#ECE8DC'],

    text:          isDark ? '#FFFFFF' : '#14110D',
    textSecondary: isDark ? '#888888' : '#5C544A',
    textTertiary:  isDark ? '#666666' : '#A39B8E',
    textMuted:     isDark ? 'rgba(255,255,255,0.4)' : '#A39B8E',

    border:        isDark ? 'rgba(255,255,255,0.10)' : '#E7E1D1',
    borderStrong:  isDark ? 'rgba(255,255,255,0.18)' : '#D8D0BC',

    surface:       isDark ? 'rgba(255,255,255,0.05)' : '#E5DFD0',
    surfaceStrong: isDark ? 'rgba(255,255,255,0.08)' : '#DAD3C2',
    card:          isDark ? '#111111' : '#FBF9F2',
    cardElevated:  isDark ? '#141414' : '#F5F1E8',

    overlay:       isDark ? 'rgba(255,255,255,0.06)' : '#EFE8D7',
    overlayMid:    isDark ? 'rgba(255,255,255,0.15)' : 'rgba(20,17,13,0.10)',
    overlayStrong: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(20,17,13,0.20)',

    inverse:       isDark ? '#FFFFFF' : '#14110D',
    inverseText:   isDark ? '#000000' : '#FFFFFF',

    success: isDark ? '#34C759' : '#22A664',
    warning: isDark ? '#F59E0B' : '#F0A12E',
    danger:  isDark ? '#EF4444' : '#E84A4A',

    accent:      '#B8F23A',  // lime — same across modes (it's the brand spark)
    accentText:  '#14110D',  // ink reads on lime in both modes

    tabActiveBg:   isDark ? '#FFFFFF' : '#14110D',
    tabActiveText: isDark ? '#000000' : '#FFFFFF',

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
  const [mode, setModeState] = useState<ThemeMode>('light');

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
