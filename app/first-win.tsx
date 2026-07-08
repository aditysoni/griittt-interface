// First Win — the activation bridge between finishing onboarding and the dashboard.
//
// Rationale: onboarding ends by having the user *declare* their habits, then the
// old flow dropped them on a cold dashboard showing a zero score / zero streak —
// the most motivating moment in the lifecycle (right after committing) was spent
// staring at empty progress. This screen closes that gap: complete ONE habit
// immediately, feel the score move and the streak start, THEN enter the app.
//
// Mounted at the app root (not inside (auth)) on purpose: the root _layout bounces
// any onboarded user out of (auth) into (tabs), which would kill this screen.

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { habits, tasks, today, type Task } from '../lib/api';

const W = {
  bg: '#F5F1E8',
  card: '#FFFFFF',
  ink: '#14110D',
  ink2: '#5C544A',
  ink3: '#A39B8E',
  rule: '#E8E0CE',
  hype: '#B8F23A',
  good: '#22A664',
};

// Maps the starter-habit display names (created from onboarding's BUILD_RECS /
// BREAK_RECS) back to their emoji. Falls back to a neutral marker for anything
// custom, so the screen never breaks on an unknown habit name.
const HABIT_ICON: Record<string, string> = {
  'Go to the gym': '🏋️',
  'Morning run': '🏃',
  'Wake up at 5am': '🌅',
  'Hit protein target': '💪',
  'Drink 3L water': '💧',
  'Read 30 minutes': '📖',
  'Meditate 10 min': '🧘',
  'Cold shower': '🚿',
  'Journal 1 page': '📝',
  'No smoking': '🚭',
  'No alcohol': '🍺',
  'No porn': '🚫',
  'No masturbation': '🔞',
  'No junk food': '🍔',
  'No social media': '📱',
  'No sugar': '🍬',
  'No phone in bed': '🛏️',
};

export default function FirstWinScreen() {
  const { token } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Task[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [score, setScore] = useState<number | null>(null);

  const enterApp = () => router.replace('/(tabs)');

  useEffect(() => {
    let active = true;
    (async () => {
      if (!token) return;
      try {
        const t = await tasks.list(token);
        if (active) setList(t ?? []);
      } catch {
        // If we can't load the starter habits, don't trap the user here —
        // the dashboard is a safe fallback.
        if (active) enterApp();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  async function complete(habit: Task) {
    if (!token || busyId || doneIds.includes(habit.id)) return;
    setBusyId(habit.id);
    try {
      await habits.complete(token, habit.name, habit.id, undefined, undefined, today());
      setDoneIds(prev => [...prev, habit.id]);
      const ds = await habits.dailyScore(token, today()).catch(() => null);
      if (ds) setScore(ds.score);
    } catch {
      // swallow — keep the moment forgiving; the card simply stays actionable
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color={W.ink} />
      </SafeAreaView>
    );
  }

  // No starter habits picked during onboarding — nothing to complete, so just
  // welcome them in rather than showing an empty screen.
  if (list.length === 0) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.kicker}>DAY 1</Text>
        <Text style={s.emptyTitle}>You're in.</Text>
        <Text style={s.sub}>Add your first habit from the dashboard whenever you're ready.</Text>
        <Pressable style={s.cta} onPress={enterApp}>
          <Text style={s.ctaText}>ENTER GRITTT  →</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const hasWin = doneIds.length > 0;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.topBar}>
        <Text style={s.kicker}>DAY 1</Text>
        <Pressable hitSlop={12} onPress={enterApp}>
          <Text style={s.skip}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>{hasWin ? 'That’s how it starts.' : 'One rep. Right now.'}</Text>
        <Text style={s.sub}>
          {hasWin
            ? 'Your streak is alive. Knock out another, or step into the app.'
            : 'You said these matter. Don’t wait for tomorrow — do one before you even reach your dashboard.'}
        </Text>

        <View style={s.cards}>
          {list.map(h => {
            const done = doneIds.includes(h.id);
            const busy = busyId === h.id;
            return (
              <Pressable
                key={h.id}
                onPress={() => complete(h)}
                disabled={done || !!busyId}
                style={[s.cardRow, done && s.cardRowDone]}
              >
                <Text style={s.icon}>{HABIT_ICON[h.name] ?? '◆'}</Text>
                <Text style={[s.habitName, done && s.habitNameDone]} numberOfLines={1}>
                  {h.name}
                </Text>
                {busy ? (
                  <ActivityIndicator size="small" color={W.ink2} />
                ) : (
                  <View style={[s.check, done && s.checkDone]}>
                    {done && <Text style={s.checkMark}>✓</Text>}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {hasWin && (
        <View style={s.footer}>
          <View style={s.streakPill}>
            <Text style={s.streakText}>🔥 Streak started</Text>
            {score != null && <Text style={s.scoreText}>+{score} today</Text>}
          </View>
          <Pressable style={s.cta} onPress={enterApp}>
            <Text style={s.ctaText}>ENTER GRITTT  →</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: W.bg },
  center: { flex: 1, backgroundColor: W.bg, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  kicker: { fontSize: 12, letterSpacing: 2, color: W.ink3, fontFamily: 'SpaceGrotesk_700Bold' },
  skip: { fontSize: 14, color: W.ink3, fontFamily: 'Inter_500Medium' },
  body: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 },
  title: { fontSize: 30, color: W.ink, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: -0.5, lineHeight: 36 },
  emptyTitle: { fontSize: 30, color: W.ink, fontFamily: 'SpaceGrotesk_700Bold' },
  sub: { fontSize: 15, color: W.ink2, fontFamily: 'Inter_400Regular', lineHeight: 22, marginTop: 10, textAlign: 'center' },
  cards: { marginTop: 28, gap: 12 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: W.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: W.rule,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
  },
  cardRowDone: { borderColor: W.good, backgroundColor: '#F2FBF5' },
  icon: { fontSize: 22 },
  habitName: { flex: 1, fontSize: 16, color: W.ink, fontFamily: 'Inter_600SemiBold' },
  habitNameDone: { color: W.ink2 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: W.rule },
  checkDone: { borderColor: W.good, backgroundColor: W.good, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter_800ExtraBold', lineHeight: 18 },
  footer: { paddingHorizontal: 24, paddingBottom: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: W.rule, gap: 14 },
  streakPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  streakText: { fontSize: 15, color: W.ink, fontFamily: 'SpaceGrotesk_600SemiBold' },
  scoreText: { fontSize: 15, color: W.good, fontFamily: 'SpaceGrotesk_700Bold' },
  cta: { backgroundColor: W.ink, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  ctaText: { color: '#FFFFFF', fontSize: 15, letterSpacing: 1, fontFamily: 'SpaceGrotesk_700Bold' },
});
