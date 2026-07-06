import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Dimensions, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DarkBackground } from '../../components/DarkBackground';
import { useAuth } from '../../lib/auth';
import { fuel, today } from '../../lib/api';
import { PREVIEW, previewFuelHistory, previewFuelIdentity } from '../../lib/preview';
import { useTheme } from '../../components/ThemeContext';

const SCREEN_W = Dimensions.get('window').width;

const WC = { good: '#22A664', warn: '#F0A12E', bad: '#E84A4A', hype: '#B8F23A' };

function shiftDate(base: string, days: number) {
  const d = new Date(base); d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const NUM_DAYS = 30;

type FuelDay = {
  date: string;
  foodQuality: number | null;
  hadJunkFood: boolean | null;
  stuckToMeal: boolean | null;
  score: number | null;
};

function scoreColor(v: number) {
  return v >= 70 ? WC.good : v >= 40 ? WC.warn : WC.bad;
}

// ── Trend helper ────────────────────────────────────────────────────────────────

function trendAnalysis(data: number[]): { label: string; color: string; sub: string } {
  const nonZero = data.filter(v => v > 0);
  if (nonZero.length < 2) return { label: 'NOT ENOUGH DATA', color: '#888888', sub: 'Log more meals to see your trend.' };
  const first = nonZero.slice(0, Math.ceil(nonZero.length / 2));
  const last  = nonZero.slice(Math.floor(nonZero.length / 2));
  const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
  const avgLast  = last.reduce((a, b) => a + b, 0) / last.length;
  const delta = avgLast - avgFirst;
  if (delta > 8)  return { label: 'GETTING BETTER', color: WC.good, sub: `Up ${Math.round(delta)} pts vs earlier. Your fuel is dialling in.` };
  if (delta > 2)  return { label: 'SLIGHT IMPROVEMENT', color: WC.good, sub: 'Small progress is still progress. Push more.' };
  if (delta < -8) return { label: 'SLIPPING', color: WC.bad, sub: `Down ${Math.round(Math.abs(delta))} pts. Tighten up your eating.` };
  if (delta < -2) return { label: 'SLIGHTLY DECLINING', color: WC.warn, sub: 'Small dip. Catch it before it becomes a habit.' };
  return { label: 'CONSISTENT', color: WC.warn, sub: 'Holding steady — but are you growing or maintaining?' };
}

// ── Main screen ──────────────────────────────────────────────────────────────────

export default function FuelAnalysisScreen() {
  const { token } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const DAYS = Array.from({ length: NUM_DAYS }, (_, i) => shiftDate(today(), i - (NUM_DAYS - 1)));

  const [history, setHistory]   = useState<FuelDay[]>([]);
  const [identity, setIdentity] = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (PREVIEW) {
      setHistory(previewFuelHistory(DAYS));
      setIdentity(previewFuelIdentity);
      return;
    }
    if (!token) return;
    const from = DAYS[0];
    const to   = DAYS[DAYS.length - 1];
    const [hist, id] = await Promise.all([
      fuel.history(token, from, to).catch(() => []),
      fuel.identity(token).catch(() => null),
    ]);
    const byDate = new Map(hist.map(r => [r.date, r]));
    setHistory(DAYS.map(d => byDate.get(d) ?? { date: d, foodQuality: null, hadJunkFood: null, stuckToMeal: null, score: null }));
    setIdentity(id);
  }, [token]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const logged      = history.filter(d => d.score != null);
  const scores      = logged.map(d => d.score ?? 0);
  const avgScore    = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const bestScore   = scores.length ? Math.max(...scores) : 0;
  const loggedDays  = logged.length;

  const cleanDays   = logged.filter(d => d.hadJunkFood === false).length;
  const junkDays    = logged.filter(d => d.hadJunkFood === true).length;
  const cleanRate   = loggedDays ? Math.round((cleanDays / loggedDays) * 100) : 0;

  const mealAdhered = logged.filter(d => d.stuckToMeal === true).length;
  const mealRate    = loggedDays ? Math.round((mealAdhered / loggedDays) * 100) : 0;

  const qualityVals = logged.map(d => d.foodQuality ?? 0).filter(v => v > 0);
  const avgQuality  = qualityVals.length ? (qualityVals.reduce((a, b) => a + b, 0) / qualityVals.length) : 0;

  // Current junk-free streak (from most recent logged day backwards)
  const junkFreeStreak = (() => {
    let n = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const d = history[i];
      if (d.score == null) continue;      // skip unlogged days
      if (d.hadJunkFood === false) n++; else break;
    }
    return n;
  })();

  const trend = trendAnalysis(history.map(d => d.score ?? 0));

  // Last 14 days for the bar chart (most recent window)
  const chart = history.slice(-14);
  const maxBar = 100;

  return (
    <DarkBackground><SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.topBar}>
        <TouchableOpacity style={[s.topIcon, { borderColor: theme.border }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: theme.text, fontFamily: 'Inter_900Black' }]}>Fuel Analysis</Text>
          <Text style={[s.subtitle, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>Last {NUM_DAYS} days</Text>
        </View>
        <TouchableOpacity style={[s.topIcon, { borderColor: '#34C759' }]} onPress={() => router.push('/(tabs)/fuel')}>
          <Ionicons name="add" size={18} color="#34C759" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />}>

        {loggedDays === 0 && !loading ? (
          <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border, alignItems: 'center', gap: 8, paddingVertical: 36 }]}>
            <Ionicons name="nutrition-outline" size={30} color={theme.textSecondary} />
            <Text style={[s.emptyTitle, { color: theme.text, fontFamily: 'Inter_900Black' }]}>No fuel data yet</Text>
            <Text style={[s.emptySub, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Log your meals to unlock your analysis.
            </Text>
            <TouchableOpacity style={[s.cta, { backgroundColor: theme.text }]} onPress={() => router.push('/(tabs)/fuel')}>
              <Text style={[s.ctaText, { color: theme.bg, fontFamily: 'Inter_700Bold' }]}>Log a meal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Hero — average score */}
            <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[s.eyebrow, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>AVERAGE FUEL SCORE</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                <Text style={[s.heroNum, { color: scoreColor(avgScore), fontFamily: 'Inter_900Black' }]}>{avgScore}</Text>
                <Text style={[s.heroMax, { color: theme.textMuted, fontFamily: 'Inter_500Medium' }]}>/100</Text>
              </View>
              <View style={[s.track, { backgroundColor: theme.surfaceStrong }]}>
                <View style={[s.trackFill, { width: `${Math.min(avgScore, 100)}%`, backgroundColor: scoreColor(avgScore) }]} />
              </View>
              <Text style={[s.trendLabel, { color: trend.color, fontFamily: 'Inter_900Black', marginTop: 14 }]}>{trend.label}</Text>
              <Text style={[s.trendSub, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>{trend.sub}</Text>
            </View>

            {/* Stat grid */}
            <View style={s.grid}>
              <Stat label="LOGGED DAYS" value={`${loggedDays}`} unit={`/ ${NUM_DAYS}`} theme={theme} />
              <Stat label="BEST SCORE" value={`${bestScore}`} unit="/ 100" color={scoreColor(bestScore)} theme={theme} />
              <Stat label="CLEAN RATE" value={`${cleanRate}`} unit="%" color={scoreColor(cleanRate)} theme={theme} />
              <Stat label="MEAL ADHERENCE" value={`${mealRate}`} unit="%" color={scoreColor(mealRate)} theme={theme} />
              <Stat label="AVG QUALITY" value={avgQuality ? avgQuality.toFixed(1) : '—'} unit="/ 5" theme={theme} />
              <Stat label="JUNK-FREE STREAK" value={`${junkFreeStreak}`} unit={junkFreeStreak === 1 ? 'day' : 'days'} color={junkFreeStreak > 0 ? WC.good : theme.text} theme={theme} />
            </View>

            {/* Score chart — last 14 days */}
            <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[s.eyebrow, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>SCORE · LAST 14 DAYS</Text>
              <View style={s.barsRow}>
                {chart.map((d, i) => {
                  const v = d.score ?? 0;
                  const isToday = i === chart.length - 1;
                  const h = Math.max(4, (v / maxBar) * 90);
                  const bg = d.score == null ? theme.surfaceStrong : isToday ? WC.hype : scoreColor(v);
                  const dow = new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' });
                  return (
                    <View key={d.date} style={s.barCol}>
                      <View style={s.barWrap}>
                        <View style={[s.bar, { height: h, backgroundColor: bg }]} />
                      </View>
                      <Text style={[s.barDay, { color: isToday ? theme.text : theme.textSecondary,
                        fontFamily: isToday ? 'Inter_700Bold' : 'Inter_500Medium' }]}>{dow}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Clean vs junk split */}
            <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[s.eyebrow, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>CLEAN vs JUNK</Text>
              <View style={[s.splitTrack, { backgroundColor: theme.surfaceStrong }]}>
                {loggedDays > 0 && (
                  <View style={{ flexDirection: 'row', height: '100%' }}>
                    <View style={{ flex: Math.max(cleanDays, 0.001), backgroundColor: WC.good }} />
                    <View style={{ flex: Math.max(junkDays, 0.001), backgroundColor: WC.bad }} />
                  </View>
                )}
              </View>
              <View style={s.splitLegend}>
                <View style={s.legendItem}>
                  <View style={[s.dot, { backgroundColor: WC.good }]} />
                  <Text style={[s.legendText, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>{cleanDays} clean {cleanDays === 1 ? 'day' : 'days'}</Text>
                </View>
                <View style={s.legendItem}>
                  <View style={[s.dot, { backgroundColor: WC.bad }]} />
                  <Text style={[s.legendText, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>{junkDays} junk {junkDays === 1 ? 'day' : 'days'}</Text>
                </View>
              </View>
            </View>

            {/* Fuel identity / level */}
            {identity && (
              <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[s.eyebrow, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>FUEL IDENTITY</Text>
                <Text style={[s.levelName, { color: theme.text, fontFamily: 'Inter_900Black', marginTop: 4 }]}>{identity.levelName}</Text>
                <Text style={[s.levelXP, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_500Medium' }]}>
                  {identity.totalXP} XP{identity.nextLevel ? `  ·  ${identity.xpToNext} XP to ${identity.nextLevel}` : ''}
                </Text>
                {identity.xpToNext != null && identity.nextLevel && (
                  <View style={[s.track, { backgroundColor: theme.surfaceStrong, marginTop: 10 }]}>
                    <View style={[s.trackFill, {
                      width: `${Math.round((1 - identity.xpToNext / (identity.totalXP + identity.xpToNext)) * 100)}%`,
                      backgroundColor: WC.hype,
                    }]} />
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView></DarkBackground>
  );
}

function Stat({ label, value, unit, color, theme }: { label: string; value: string; unit?: string; color?: string; theme: any }) {
  return (
    <View style={[s.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[s.statLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 4 }}>
        <Text style={[s.statValue, { color: color ?? theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>{value}</Text>
        {unit ? <Text style={[s.statUnit, { color: theme.textMuted, fontFamily: 'Inter_500Medium' }]}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1 },
  topBar:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, gap: 12 },
  topIcon:  { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title:    { fontSize: 22, letterSpacing: -0.5 },
  subtitle: { fontSize: 11, letterSpacing: 1.5, marginTop: 2 },
  scroll:   { paddingBottom: 60, gap: 12, paddingHorizontal: 16, paddingTop: 4 },

  card:     { borderWidth: 1, borderRadius: 20, padding: 18 },
  eyebrow:  { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },

  heroNum:  { fontSize: 60, letterSpacing: -3, lineHeight: 64 },
  heroMax:  { fontSize: 18 },
  track:    { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 12 },
  trackFill:{ height: '100%', borderRadius: 2 },
  trendLabel: { fontSize: 13, letterSpacing: 1.5 },
  trendSub:   { fontSize: 12, lineHeight: 17, marginTop: 4, fontStyle: 'italic' },

  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: (SCREEN_W - 32 - 12) / 2, borderWidth: 1, borderRadius: 16, padding: 14 },
  statLabel:{ fontSize: 9, letterSpacing: 1.5 },
  statValue:{ fontSize: 26, lineHeight: 28 },
  statUnit: { fontSize: 12 },

  barsRow:  { flexDirection: 'row', gap: 5, marginTop: 16, alignItems: 'flex-end' },
  barCol:   { flex: 1, alignItems: 'center', gap: 6 },
  barWrap:  { justifyContent: 'flex-end', height: 90, width: '100%' },
  bar:      { width: '100%', borderRadius: 4 },
  barDay:   { fontSize: 9 },

  splitTrack:  { height: 12, borderRadius: 6, overflow: 'hidden', marginTop: 14 },
  splitLegend: { flexDirection: 'row', gap: 20, marginTop: 12 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:         { width: 8, height: 8, borderRadius: 4 },
  legendText:  { fontSize: 12 },

  levelName:{ fontSize: 20, letterSpacing: -0.3 },
  levelXP:  { fontSize: 12, marginTop: 4 },

  emptyTitle: { fontSize: 16 },
  emptySub:   { fontSize: 13, textAlign: 'center' },
  cta:      { marginTop: 8, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 999 },
  ctaText:  { fontSize: 13, letterSpacing: 0.5 },
});
