import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, AppTheme } from './ThemeContext';

/**
 * Cold-start launch sequence, built on the real brand mark from the landing
 * page (assets/logo-g.png — the G extracted from the lockup onto transparency
 * so it can sit in a tile we control).
 *
 * The tile keeps the logo's own cream rather than a theme surface: green-on-cream
 * IS the mark, it's what the app icon and the landing page show, and a launch
 * screen's whole job is to be instantly recognisable as the thing you tapped.
 *
 * Built on React Native's Animated rather than Reanimated: Reanimated is in
 * package.json but has no babel plugin configured and is imported nowhere, so
 * touching it would crash. Everything runs on the native driver, which matters
 * most at boot — that's exactly when the JS thread is busy hydrating auth.
 */

/** Sampled from the source logo — part of the mark, not the UI palette. */
const LOGO_CREAM = '#F6EFE4';
const LOGO_GREEN = '#46B151';
const TILE = 116;

type Props = {
  /** Fired once the sequence has played through. The caller decides when to
   *  actually leave — this screen stays up while auth is still hydrating. */
  onDone: () => void;
};

export function BootAnimation({ onDone }: Props) {
  const { theme } = useTheme();
  const s = React.useMemo(() => makeStyles(theme), [theme]);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  const tile    = useRef(new Animated.Value(0)).current;
  const glyph   = useRef(new Animated.Value(0)).current;
  const glow    = useRef(new Animated.Value(0)).current;
  const word    = useRef(new Animated.Value(0)).current;
  const kicker  = useRef(new Animated.Value(0)).current;
  const settled = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;

    // Reduce Motion: show the finished mark, hold briefly so it doesn't flash,
    // and hand off. Same destination, no travel.
    if (reduceMotion) {
      [tile, glyph, word, kicker].forEach(v => v.setValue(1));
      glow.setValue(1);
      const t = setTimeout(onDone, 420);
      return () => clearTimeout(t);
    }

    Animated.sequence([
      Animated.parallel([
        Animated.timing(tile, {
          toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
      ]),
      // The G arrives with a little overshoot — the mark lands rather than
      // fades. This is the moment the launch is actually about.
      Animated.parallel([
        Animated.spring(glyph, {
          toValue: 1, useNativeDriver: true, damping: 11, stiffness: 200, mass: 0.85,
        }),
        Animated.sequence([
          Animated.timing(settled, {
            toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true,
          }),
          Animated.spring(settled, {
            toValue: 0, useNativeDriver: true, damping: 9, stiffness: 150,
          }),
        ]),
      ]),
      Animated.parallel([
        Animated.timing(word, {
          toValue: 1, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(170),
          Animated.timing(kicker, {
            toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start(({ finished }) => { if (finished) onDone(); });

    // Fires as the G lands. The physical tick is half of why Duolingo and Strava
    // feel expensive — the visual alone doesn't carry it.
    const tick = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }, 360);

    return () => clearTimeout(tick);
  }, [reduceMotion]);

  if (reduceMotion === null) return <View style={s.screen} />;

  return (
    <View style={s.screen}>
      <View style={s.stage}>
        <Animated.View
          pointerEvents="none"
          style={[s.glow, {
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.20] }),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          }]}
        />

        <Animated.View
          style={[s.tile, {
            opacity: tile,
            transform: [
              { scale: Animated.add(
                  tile.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }),
                  settled.interpolate({ inputRange: [0, 1], outputRange: [0, 0.05] })
                ) },
            ],
          }]}
        >
          <Animated.Image
            source={require('../assets/logo-g.png')}
            resizeMode="contain"
            style={[s.glyph, {
              opacity: glyph.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
              transform: [{ scale: glyph.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
            }]}
          />
        </Animated.View>

        <Animated.View
          style={{
            opacity: word,
            transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          }}
        >
          <Text style={s.word}>GRITT<Text style={s.wordAccent}>T</Text></Text>
        </Animated.View>

        <Animated.Text style={[s.kicker, { opacity: kicker }]}>
          DISCIPLINE · IDENTITY · MOMENTUM
        </Animated.Text>
      </View>
    </View>
  );
}

function makeStyles(t: AppTheme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' },
    stage: { alignItems: 'center' },

    glow: {
      position: 'absolute',
      top: -52,
      width: 250,
      height: 250,
      borderRadius: 125,
      backgroundColor: LOGO_GREEN,
    },

    tile: {
      width: TILE,
      height: TILE,
      borderRadius: 32,
      backgroundColor: LOGO_CREAM,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    glyph: { width: TILE * 0.62, height: TILE * 0.62 },

    word: {
      fontFamily: 'BricolageGrotesque_800ExtraBold',
      fontSize: 46,
      color: t.text,
      letterSpacing: 1,
      marginTop: 30,
    },
    wordAccent: { color: t.accent },

    kicker: {
      fontFamily: 'SpaceGrotesk_600SemiBold',
      color: t.textTertiary,
      fontSize: 10,
      letterSpacing: 2.6,
      marginTop: 14,
    },
  });
}
