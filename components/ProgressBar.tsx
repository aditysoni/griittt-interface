import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from './ThemeContext';

type Props = {
  progress: number; // 0 to 1
  color?: string;
  height?: number;
};

export function ProgressBar({ progress, color, height = 8 }: Props) {
  const { theme } = useTheme();
  const pct = Math.min(Math.max(progress, 0), 1);
  return (
    <View style={[styles.track, { height, backgroundColor: theme.border }]}>
      <View
        style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color ?? theme.accent, height }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 999,
  },
});
