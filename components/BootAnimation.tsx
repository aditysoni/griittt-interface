import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, AppTheme } from './ThemeContext';

/**
 * Cold-start launch sequence.
 *
 * The brand mark is three ascending bars, which already means momentum — so the
 * animation is just the mark drawing itself: bars rise in order, the tallest
 * lands with a haptic tick, then the wordmark arrives. No stock illustration, no
 * Lottie file, nothing borrowed. It's the logo, moving.
 *
 * Built on React Native's Animated rather than Reanimated: Reanimated is in
 * package.json but has no babel plugin configured and is imported nowhere, so
 * touching it would crash. Everything here runs on the native driver, which
 * matters most at boot — that's exactly when the JS thread is busy hydrating
 * auth, and a JS-driven animation would stutter.
 */

const BAR_W = 13;
const BAR_GAP = 8;
const BARS = [
  { h: 22, delay: 0 },
  { h: 38, delay: 130 },
  { h: 56, delay: 260 },
];
const TILE = 104;

type Props = {
  /** Fired once the sequence has played through. The caller decides when to
   *  actually leave — this screen stays up while auth is still hydrating. */
  onDone: () => void;
};

export function BootAnimation({ onDone }: Props) {
  const { theme } = useTheme();
  const s = React.useMemo(() => makeStyles(theme), [theme]);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  const bars    = useRef(BARS.map(() => new Animated.Value(0))).current;
  const tile    = useRef(new Animated.Value(0)).current;
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
      [tile, word, kicker, settled, ...bars].forEach(v => v.setValue(1));
      glow.setValue(0.5);
      const t = setTimeout(onDone, 420);
      return () => clearTimeout(t);
    }

    const barAnims = BARS.map((b, i) =>
      Animated.sequence([
        Animated.delay(b.delay),
        Animated.spring(bars[i], {
          toValue: 1,
          useNativeDriver: true,
          damping: 13,
          stiffness: 190,
          mass: 0.9,
        }),
      ])
    );

    Animated.sequence([
      Animated.parallel([
        Animated.timing(tile, {
          toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 1, duration: 620, easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
      ]),
      Animated.parallel(barAnims),
      Animated.parallel([
        // The mark takes one small breath once the last bar lands — the beat
        // that makes it read as arriving rather than merely appearing.
        Animated.sequence([
          Animated.timing(settled, {
            toValue: 1, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true,
          }),
          Animated.spring(settled, {
            toValue: 0, useNativeDriver: true, damping: 9, stiffness: 150,
          }),
        ]),
        Animated.sequence([
          Animated.delay(90),
          Animated.timing(word, {
            toValue: 1, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(260),
          Animated.timing(kicker, {
            toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start(({ finished }) => { if (finished) onDone(); });

    // Fires with the tallest bar. The physical tick is half of why Duolingo and
    // Strava feel expensive — the visual alone doesn't land it.
    const tick = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }, 260 + 90);

    return () => clearTimeout(tick);
  }, [reduceMotion]);

  if (reduceMotion === null) return <View style={s.screen} />;

  return (
    <View style={s.screen}>
      <View style={s.stage}>
        <Animated.View
          pointerEvents="none"
          style={[s.glow, {
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          }]}
        />

        <Animated.View
          style={[s.tile, {
            opacity: tile,
            transform: [
              { scale: Animated.add(
                  tile.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }),
                  settled.interpolate({ inputRange: [0, 1], outputRange: [0, 0.045] })
                ) },
            ],
          }]}
        >
          <View style={s.barRow}>
            {BARS.map((b, i) => (
              // Each bar is clipped by its column and slides up into view. Growing
              // via scaleY would need transform-origin compensation; translating
              // inside an overflow-hidden column is the same result with no maths
              // to get wrong.
              <View key={i} style={[s.barClip, { height: b.h }]}>
                <Animated.View
                  style={[
                    s.bar,
                    {
                      height: b.h,
                      opacity: i === 2 ? 1 : 0.45 + i * 0.22,
                      transform: [{
                        translateY: bars[i].interpolate({
                          inputRange: [0, 1], outputRange: [b.h, 0],
                        }),
                      }],
                    },
                  ]}
                />
              </View>
            ))}
          </View>
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
      top: -46,
      width: 240,
      height: 240,
      borderRadius: 120,
      backgroundColor: t.accent,
    },

    tile: {
      width: TILE,
      height: TILE,
      borderRadius: 30,
      backgroundColor: t.isDark ? t.card : '#FFFFFF',
      borderWidth: 1.5,
      borderColor: t.isDark ? 'rgba(184,242,58,0.28)' : t.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: BAR_GAP, height: 56 },
    barClip: { width: BAR_W, overflow: 'hidden', justifyContent: 'flex-end' },
    bar: { width: BAR_W, borderRadius: BAR_W / 2, backgroundColor: t.accent },

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
