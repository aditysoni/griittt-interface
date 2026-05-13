import React, { createContext, useContext, useState } from 'react';

export type AppTheme = {
  isDark: boolean;
  bg: string;
  text: string;
  textSecondary: string;
  border: string;
  surface: string;
  card: string;
  success: string;
  tabActiveBg: string;
  tabActiveText: string;
};

function buildTheme(isDark: boolean): AppTheme {
  return {
    isDark,
    bg:            isDark ? '#000000' : '#FFFFFF',
    text:          isDark ? '#FFFFFF' : '#000000',
    textSecondary: '#888888',
    border:        isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
    surface:       isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    card:          isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
    success:       '#34C759',
    tabActiveBg:   isDark ? '#FFFFFF' : '#000000',
    tabActiveText: isDark ? '#000000' : '#FFFFFF',
  };
}

type ThemeContextType = {
  theme: AppTheme;
  setDark: (v: boolean) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: buildTheme(true),
  setDark: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);
  return (
    <ThemeContext.Provider value={{ theme: buildTheme(isDark), setDark: setIsDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
