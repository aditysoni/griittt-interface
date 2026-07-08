import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';

// Play the chime even when the phone's silent switch is on (iOS). Runs once.
let audioModeSet = false;
function ensureAudioMode() {
  if (audioModeSet) return;
  audioModeSet = true;
  setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
}

/**
 * Full-screen celebration shown when the user completes every task of the day.
 * Plays a triumphant fanfare + a success haptic while the discipline score counts
 * up. To change the tune, swap the require() below for any file in assets/sounds/.
 * Tap anywhere (or wait ~2.8s) to dismiss.
 */
export function DayCompleteCelebration({
  visible,
  score,
  theme,
  onClose,
}: {
  visible: boolean;
  score: number;
  theme: any;
  onClose: () => void;
}) {
  const player = useAudioPlayer(require('../assets/sounds/fanfare-major.wav'));
  const count   = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!visible) return;

    // fire the tune + haptic at the same instant the animation starts
    ensureAudioMode();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try { player.seekTo(0); player.play(); } catch {}

    count.setValue(0);
    scale.setValue(0.6);
    opacity.setValue(0);
    const id = count.addListener(({ value }) => setDisplay(Math.round(value)));

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(count, {
        toValue: score,
        duration: 1500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

    const t = setTimeout(onClose, 2800);
    return () => { count.removeListener(id); clearTimeout(t); };
  }, [visible, score]);

  const accent = theme?.accent ?? '#B8F23A';

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Animated.View style={{ opacity, transform: [{ scale }], alignItems: 'center' }}>
          {/* scrim is always dark, so text stays light regardless of theme */}
          <Text style={[styles.kicker, { color: accent }]}>PERFECT DAY</Text>
          <Text style={styles.number}>{display}</Text>
          <Text style={styles.sub}>DISCIPLINE SCORE</Text>
          <Text style={styles.tap}>tap to dismiss</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(10,9,7,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: { fontSize: 15, letterSpacing: 4, fontWeight: '800', marginBottom: 4 },
  number: { fontSize: 104, fontWeight: '900', color: '#F5F2E9', fontVariant: ['tabular-nums'] },
  sub:    { fontSize: 13, letterSpacing: 3, marginTop: 2, color: '#9A9488' },
  tap:    { fontSize: 11, letterSpacing: 1, marginTop: 28, color: '#9A9488', opacity: 0.7 },
});
