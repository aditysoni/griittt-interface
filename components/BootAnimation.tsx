import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, AppTheme } from './ThemeContext';
import { getLottie } from './lottiePlayer';

/**
 * Cold-start launch sequence.
 *
 * The mark itself is a Lottie composition (assets/lottie/boot.json, compiled by
 * scripts/build-boot-lottie.mjs) so the tile pop, the G landing, the impact ring
 * and the orbit sweep all run on the animation thread — which matters most at
 * boot, exactly when the JS thread is busy hydrating auth. The wordmark and
 * kicker stay native Text: the app's fonts are already loaded and Lottie text
 * layers would mean shipping glyph outlines.
 *
 * The Lottie embeds the real brand mark (assets/logo-g.png) as a base64 image
 * asset, so it is self-contained — no imageAssetsFolder wiring on Android.
 *
 * Three ways out, because lottie-react-native is a native module:
 *  - Reduce Motion → the finished mark, held briefly. Same destination, no travel.
 *  - Native module missing (an older dev client that predates the install) →
 *    <FallbackMark>, the previous RN Animated sequence. A launch screen must
 *    never be the thing that white-screens the app.
 *  - Web → same fallback; getLottie() is stubbed out there (lottiePlayer.web.ts).
 */

/** Sampled from the source logo — part of the mark, not the UI palette. */
const LOGO_CREAM = '#F6EFE4';
const LOGO_GREEN = '#46B151';

/** Lottie is authored in a 512pt square; the tile is 232 of it. */
const STAGE = 260;
const TILE = (232 / 512) * STAGE;

/** Frame 34 of 104 @ 60fps — the beat the G lands on. Keep in sync with the
 *  GLYPH_LANDS constant in scripts/build-boot-lottie.mjs. */
const LAND_MS = Math.round((34 / 60) * 1000);
const SEQUENCE_MS = Math.round((104 / 60) * 1000);

type Props = {
  /** Fired once the sequence has played through. The caller decides when to
   *  actually leave — this screen stays up while auth is still hydrating. */
  onDone: () => void;
};

export function BootAnimation({ onDone }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => makeStyles(theme), [theme]);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [lottieBroken, setLottieBroken] = useState(false);

  const word   = useRef(new Animated.Value(0)).current;
  const kicker = useRef(new Animated.Value(0)).current;

  const Lottie = getLottie();
  const useLottie = !!Lottie && !lottieBroken && reduceMotion === false;

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
      word.setValue(1);
      kicker.setValue(1);
      const t = setTimeout(onDone, 420);
      return () => clearTimeout(t);
    }

    // The wordmark rises off the landing, not off the start — it reads as a
    // consequence of the mark arriving.
    Animated.sequence([
      Animated.delay(LAND_MS + 90),
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
    ]).start();

    // Fires as the G lands. The physical tick is half of why Duolingo and Strava
    // feel expensive — the visual alone doesn't carry it.
    const tick = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }, LAND_MS);

    // The Lottie has its own onAnimationFinish, but the fallback path doesn't,
    // and a finish callback that never fires would strand the app on the splash.
    const done = setTimeout(onDone, SEQUENCE_MS + 620);

    return () => { clearTimeout(tick); clearTimeout(done); };
  }, [reduceMotion]);

  if (reduceMotion === null) return <View style={s.screen} />;

  return (
    <View style={s.screen}>
      <View style={s.stage}>
        {useLottie ? (
          <LottieBoundary onBroken={() => setLottieBroken(true)}>
            <Lottie
              source={require('../assets/lottie/boot.json')}
              autoPlay
              loop={false}
              resizeMode="contain"
              style={s.lottie}
            />
          </LottieBoundary>
        ) : (
          <FallbackMark static={reduceMotion === true} />
        )}

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

/** Catches the native-view-not-found throw so a stale binary degrades instead
 *  of crashing the launch. */
class LottieBoundary extends React.Component<
  { onBroken: () => void; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onBroken(); }
  render() {
    if (this.state.failed) return <FallbackMark static={false} />;
    return this.props.children;
  }
}

/**
 * The pre-Lottie sequence, kept as the degraded path: tile pops, the G lands
 * with overshoot, a soft halo behind it. Pure RN Animated on the native driver,
 * so it works in any binary.
 */
function FallbackMark({ static: isStatic }: { static: boolean }) {
  const tile    = useRef(new Animated.Value(0)).current;
  const glyph   = useRef(new Animated.Value(0)).current;
  const glow    = useRef(new Animated.Value(0)).current;
  const settled = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isStatic) {
      [tile, glyph, glow].forEach(v => v.setValue(1));
      return;
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
    ]).start();
  }, [isStatic]);

  return (
    <View style={f.wrap}>
      <Animated.View
        pointerEvents="none"
        style={[f.glow, {
          opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.20] }),
          transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
        }]}
      />
      <Animated.View
        style={[f.tile, {
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
          style={[f.glyph, {
            opacity: glyph.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
            transform: [{ scale: glyph.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
          }]}
        />
      </Animated.View>
    </View>
  );
}

const f = StyleSheet.create({
  wrap: { width: STAGE, height: STAGE, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: 250, height: 250, borderRadius: 125,
    backgroundColor: LOGO_GREEN,
  },
  tile: {
    width: TILE, height: TILE,
    borderRadius: TILE * 0.276,
    backgroundColor: LOGO_CREAM,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glyph: { width: TILE * 0.62, height: TILE * 0.62 },
});

function makeStyles(t: AppTheme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' },
    stage: { alignItems: 'center' },

    lottie: { width: STAGE, height: STAGE },

    word: {
      fontFamily: 'BricolageGrotesque_800ExtraBold',
      fontSize: 46,
      color: t.text,
      letterSpacing: 1,
      // The Lottie box is deliberately larger than the tile (the glow and orbit
      // ring need the room), so pull the wordmark back up under the tile.
      marginTop: -30,
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
