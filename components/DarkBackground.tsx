import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Liquid black-grey gradient — multiple stops create a flowing, depth-layered feel
type Props = { children: React.ReactNode };

export function DarkBackground({ children }: Props) {
  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#000000', '#1F1E1E']}
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
