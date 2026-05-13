import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from './theme';

type Props = {
  progress: number; // 0 to 1
  color?: string;
  height?: number;
};

export function ProgressBar({ progress, color = COLORS.primary, height = 8 }: Props) {
  const pct = Math.min(Math.max(progress, 0), 1);
  return (
    <View style={[styles.track, { height }]}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color, height }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: COLORS.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 999,
  },
});
