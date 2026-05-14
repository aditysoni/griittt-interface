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

    bg:           isDark ? '#000000' : '#FFFFFF',
    bgGradient:   isDark ? ['#000000', '#1F1E1E'] : ['#FFFFFF', '#F2F2F2'],

    text:          isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? '#888888' : '#555555',
    textTertiary:  isDark ? '#666666' : '#888888',
    textMuted:     isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',

    border:        isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
    borderStrong:  isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)',

    surface:       isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    surfaceStrong: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    card:          isDark ? '#111111' : '#F2F2F2',
    cardElevated:  isDark ? '#141414' : '#E8E8E8',

    overlay:       isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    overlayMid:    isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
    overlayStrong: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',

    inverse:       isDark ? '#FFFFFF' : '#000000',
    inverseText:   isDark ? '#000000' : '#FFFFFF',

    success: '#34C759',
    warning: '#F59E0B',
    danger:  '#EF4444',

    tabActiveBg:   isDark ? '#FFFFFF' : '#000000',
    tabActiveText: isDark ? '#000000' : '#FFFFFF',

    backdrop: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)',
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
