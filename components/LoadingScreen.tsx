import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
const TRACK_W  = SCREEN_W * 0.72;
const BAR_W    = TRACK_W  * 0.42;

export function LoadingScreen({ message }: { message?: string }) {
  const slide   = useRef(new Animated.Value(0)).current;
  const fadeIn  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade the wordmark in
    Animated.timing(fadeIn, {
      toValue: 1, duration: 600, useNativeDriver: true,
    }).start();

    // Slide the lime bar left → right, looping
    Animated.loop(
      Animated.sequence([
        Animated.timing(slide, {
          toValue: 1, duration: 980, useNativeDriver: true,
        }),
        Animated.timing(slide, {
          toValue: 0, duration: 0, useNativeDriver: true,
        }),
        Animated.delay(180),
      ])
    ).start();
  }, []);

  const translateX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [-BAR_W, TRACK_W],
  });

  return (
    <View style={s.root}>
      <Animated.View style={[s.center, { opacity: fadeIn }]}>
        {/* Lime accent dot */}
        <View style={s.dot} />

        {/* Wordmark */}
        <Text style={s.wordmark}>GRITTT</Text>
        <Text style={s.tagline}>{message ?? 'LOCK IN.'}</Text>
      </Animated.View>

      {/* Sliding bar at bottom */}
      <View style={s.trackWrap}>
        <View style={s.track}>
          <Animated.View style={[s.bar, { transform: [{ translateX }] }]} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center' },
  center:    { alignItems: 'center', gap: 10 },
  dot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: '#B8F23A', marginBottom: 6 },
  wordmark:  {
    fontSize: 44, color: '#FFFFFF', letterSpacing: 10,
    fontFamily: 'Inter_900Black', lineHeight: 48,
  },
  tagline:   {
    fontSize: 11, color: 'rgba(255,255,255,0.30)',
    letterSpacing: 4, fontFamily: 'Inter_700Bold',
  },

  // Sliding bar
  trackWrap: { position: 'absolute', bottom: 52, left: 0, right: 0, alignItems: 'center' },
  track:     { width: TRACK_W, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  bar:       { position: 'absolute', left: 0, width: BAR_W, height: 2, borderRadius: 1, backgroundColor: '#B8F23A' },
});
