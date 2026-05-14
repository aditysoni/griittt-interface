import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from './ThemeContext';

type Props = { children: React.ReactNode };

// Kept the export name for backwards-compat; renders the active theme's gradient.
export function DarkBackground({ children }: Props) {
  const { theme } = useTheme();
  return (
    <View style={s.root}>
      <LinearGradient
        colors={theme.bgGradient}
        locations={[0, 1]}
        start={{ x: 0.3, y: 1 }}
        end={{ x: 0.7, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
});
