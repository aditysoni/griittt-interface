import React, { useCallback, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, useWindowDimensions } from 'react-native';
import { shiftDate, today, toDateStr } from '../lib/api';
import { useAuth } from '../lib/auth';

/**
 * Clamped prev/next-day navigation for a screen that owns a selectedDate.
 * Same bounds as the DaySelector: never before the join date, never past today.
 * `canPrev`/`canNext` let the swipe UI decide whether a real slide should play.
 */
export function useDateNav(selectedDate: string, setSelectedDate: (d: string) => void) {
  const { user } = useAuth();
  const joinDay = user?.created_at ? toDateStr(new Date(user.created_at)) : null;

  const canPrev = !joinDay || shiftDate(selectedDate, -1) >= joinDay;
  const canNext = shiftDate(selectedDate, 1) <= today();

  const goPrev = useCallback(() => {
    if (!canPrev) return;
    setSelectedDate(shiftDate(selectedDate, -1));
  }, [selectedDate, setSelectedDate, canPrev]);

  const goNext = useCallback(() => {
    if (!canNext) return;
    setSelectedDate(shiftDate(selectedDate, 1));
  }, [selectedDate, setSelectedDate, canNext]);

  return { goPrev, goNext, canPrev, canNext };
}

type Props = {
  onPrev: () => void; // swipe right (finger →) → previous day
  onNext: () => void; // swipe left  (finger ←) → next day
  canPrev: boolean;
  canNext: boolean;
  children: React.ReactNode;
};

const H_INTENT = 16; // px of horizontal travel before we claim the gesture
const SWIPE_DISTANCE = 55; // px of travel to count as a completed swipe
const SWIPE_VELOCITY = 0.3; // ...or a quick flick (px/ms) above this speed
const EDGE_DAMP = 0.28; // rubber-band resistance when there's no day to go to

/**
 * Wraps a vertically-scrolling screen body so a horizontal swipe slides the
 * content and changes the date. Uses PanResponder + the built-in Animated API
 * (no native modules): it only claims the gesture on a clearly-horizontal move,
 * so the inner ScrollView keeps vertical scrolling and pull-to-refresh.
 */
export function DateSwipe({ onPrev, onNext, canPrev, canNext, children }: Props) {
  const { width } = useWindowDimensions();
  const translateX = useRef(new Animated.Value(0)).current;

  // Keep latest props in refs so the responder (created once) always sees them.
  const ref = useRef({ onPrev, onNext, canPrev, canNext, width });
  ref.current = { onPrev, onNext, canPrev, canNext, width };

  const springBack = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
      speed: 18,
    }).start();
  }, [translateX]);

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > H_INTENT && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => {
        const { canPrev, canNext } = ref.current;
        const blocked = (g.dx < 0 && !canNext) || (g.dx > 0 && !canPrev);
        translateX.setValue(blocked ? g.dx * EDGE_DAMP : g.dx);
      },
      onPanResponderRelease: (_e, g) => {
        const { onPrev, onNext, canPrev, canNext, width } = ref.current;
        const dir = g.dx < 0 ? -1 : 1; // -1 swiped left (next), +1 swiped right (prev)
        const allowed = dir < 0 ? canNext : canPrev;
        const passed =
          allowed && (Math.abs(g.dx) > SWIPE_DISTANCE || Math.abs(g.vx) > SWIPE_VELOCITY);

        if (!passed) {
          springBack();
          return;
        }

        // Finish sliding the current content out in the swipe direction…
        Animated.timing(translateX, {
          toValue: dir * width,
          duration: 150,
          useNativeDriver: true,
        }).start(() => {
          // …commit the date change while off-screen…
          if (dir < 0) onNext();
          else onPrev();
          // …then bring the new day's content in from the opposite edge.
          translateX.setValue(-dir * width);
          Animated.timing(translateX, {
            toValue: 0,
            duration: 190,
            useNativeDriver: true,
          }).start();
        });
      },
      onPanResponderTerminate: springBack,
    })
  ).current;

  return (
    <Animated.View style={[styles.fill, { transform: [{ translateX }] }]} {...responder.panHandlers}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
