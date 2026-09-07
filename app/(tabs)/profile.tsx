import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator, Alert, Dimensions, FlatList, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkBackground } from '../../components/DarkBackground';
import Svg, { Rect, Line, Circle, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import { habits, strength, fuel, health, HealthScores, today, toDateStr } from '../../lib/api';
import { healthKit } from '../../lib/healthKit';
import { HawkEyeModal } from '../../components/HawkEye';
import { ErrorState } from '../../components/ErrorState';
import { Gauge } from '../../components/Gauge';
import { useTheme } from '../../components/ThemeContext';
import { MovementGoalCard, STEP_GOAL, ACTIVE_KCAL_GOAL } from '../../components/MovementGoalCard';

const HEALTH_CONNECTED_KEY = 'grittt_health_connected';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W   = SCREEN_W - 32;
const CHART_W  = SCREEN_W - 64; // card margin 16+16 + card padding 16+16

function shiftDate(base: string, days: number) {
  const d = new Date(base + 'T00:00:00'); d.setDate(d.getDate() + days);
  return toDateStr(d);
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00'), t = today();
  if (dateStr === t) return 'Today';
  if (dateStr === shiftDate(t, -1)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function identityMessage(score: number): { headline: string; sub: string } {
  if (score <= 20)  return { headline: 'SHOW UP', sub: 'Every day is a chance to restart.' };
  if (score <= 50)  return { headline: 'BELOW POTENTIAL', sub: 'The gap is effort. Close it.' };
  if (score <= 60)  return { headline: 'BUILDING MOMENTUM', sub: 'Consistency compounds.' };
  if (score <= 70)  return { headline: 'ABOVE AVERAGE', sub: "Most people stop here. You won't." };
  if (score <= 79)  return { headline: 'DOING WELL', sub: "Building a self you'll respect." };
  if (score <= 90)  return { headline: 'BECOMING PRO', sub: 'Discipline is your default now.' };
  if (score <= 95)  return { headline: 'ELITE LEVEL', sub: 'You operate where most only dream.' };
  return { headline: 'LEGENDARY', sub: 'This is who you are now.' };
}

// ── Chart ──────────────────────────────────────────────────────────────────────

type ChartFilter = 'habits' | 'food' | 'physical';

const CHART_FILTERS: { key: ChartFilter; label: string }[] = [
  { key: 'habits',   label: 'HABITS' },
  { key: 'food',     label: 'FOOD' },
  { key: 'physical', label: 'PHYSICAL' },
];

const BAR_STEP = 32; // fixed px per bar — scroll reveals older days
const BAR_W    = 18;
const H        = 100;
const PAD_T    = 8;
const PAD_B    = 24;
const INNER_H  = H - PAD_T - PAD_B;

function ScrollableChart({ allData, theme }: {
  allData: DayData[];
  theme: any;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [filter, setFilter] = useState<ChartFilter>('habits');

  const scores = allData.map(d =>
    filter === 'habits' ? d.discipline :
    filter === 'food'   ? d.food       :
                          d.physical
  );
  const maxVal = Math.max(...scores, 1);
  const totalW = allData.length * BAR_STEP;

  // Scroll to end (today) on mount
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
  }, []);

  return (
    <View style={ch.wrapper}>
      {/* Filter row */}
      <View style={ch.filterRow}>
        <Text style={[ch.chartLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>7-DAY SCORE</Text>
        <View style={ch.filters}>
          {CHART_FILTERS.map(f => (
            <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)} style={ch.filterBtn}>
              <Text style={[ch.filterText, {
                color: filter === f.key ? theme.text : theme.textSecondary,
                fontFamily: filter === f.key ? 'Inter_700Bold' : 'Inter_500Medium',
                opacity: filter === f.key ? 1 : 0.45,
              }]}>
                {f.label}
              </Text>
              {filter === f.key && <View style={[ch.filterDot, { backgroundColor: '#34C759' }]} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Scrollable bars */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8 }}
      >
        <Svg width={totalW} height={H}>
          {/* Baseline */}
          <Line x1={0} y1={H - PAD_B} x2={totalW} y2={H - PAD_B}
            stroke={theme.border} strokeWidth={1} />

          {allData.map((d, i) => {
            const v        = scores[i];
            const barH     = Math.max(2, (v / maxVal) * INNER_H);
            const x        = i * BAR_STEP + (BAR_STEP - BAR_W) / 2;
            const y        = PAD_T + INNER_H - barH;
            const isToday  = d.date === today();
            const fill     = isToday ? theme.text : v > 0 ? theme.overlayStrong : theme.overlay;
            const dayLabel = new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'narrow' });
            return (
              <React.Fragment key={d.date}>
                <Rect x={x} y={y} width={BAR_W} height={barH} fill={fill} rx={2} />
                <SvgText
                  x={x + BAR_W / 2} y={H - 6}
                  fill={isToday ? theme.text : theme.textMuted}
                  fontSize={8} textAnchor="middle"
                  fontWeight={isToday ? '700' : '400'}
                >
                  {dayLabel}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </ScrollView>
    </View>
  );
}

const ch = StyleSheet.create({
  wrapper:    { gap: 12 },
  filterRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  chartLabel: { fontSize: 9, letterSpacing: 3 },
  filters:    { flexDirection: 'row', gap: 14 },
  filterBtn:  { alignItems: 'center', gap: 3 },
  filterText: { fontSize: 8, letterSpacing: 1.5 },
  filterDot:  { width: 3, height: 3, borderRadius: 2 },
});

// ── Day card ───────────────────────────────────────────────────────────────────

type DayData = { date: string; discipline: number; food: number; physical: number };

function DayCard({ item, theme }: { item: DayData; theme: any }) {
  const overall = item.discipline;
  const color   = overall >= 80 ? '#34C759' : overall >= 50 ? '#F59E0B' : '#EF4444';
  const { headline } = identityMessage(overall);

  return (
    <View style={[dc.card, { width: CARD_W, backgroundColor: theme.card, borderColor: theme.border, borderTopColor: theme.borderStrong }]}>
      {/* Top label + headline */}
      <View style={dc.top}>
        <Text style={[dc.dateLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>
          {formatDayLabel(item.date).toUpperCase()}
        </Text>
        <Text style={[dc.headline, { color, fontFamily: 'Inter_900Black' }]}>{headline}</Text>
      </View>

      {/* Big score */}
      <View style={dc.scoreRow}>
        <Text style={[dc.scoreBig, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{overall}</Text>
        <Text style={[dc.scoreMax, { color: theme.textMuted, fontFamily: 'Inter_500Medium' }]}>/100</Text>
      </View>

      {/* Score bar */}
      <View style={[dc.barTrack, { backgroundColor: theme.overlayMid }]}>
        <View style={[dc.barFill, { width: `${overall}%`, backgroundColor: color }]} />
      </View>

      {/* 3-column breakdown */}
      <View style={dc.breakdown}>
        <Cell label="DISCIPLINE" value={item.discipline} theme={theme} />
        <View style={[dc.sep, { backgroundColor: theme.border }]} />
        <Cell label="FOOD" value={item.food} theme={theme} />
        <View style={[dc.sep, { backgroundColor: theme.border }]} />
        <Cell label="PHYSICAL" value={item.physical} theme={theme} />
      </View>
    </View>
  );
}

function Cell({ label, value, theme }: { label: string; value: number; theme: any }) {
  return (
    <View style={dc.cell}>
      <Text style={[dc.cellLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>{label}</Text>
      <Text style={[dc.cellValue, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>{value}</Text>
    </View>
  );
}

const dc = StyleSheet.create({
  card: {
    borderRadius: 2,
    padding: 20, gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    borderTopWidth: 1,
    borderWidth: 1,
  },
  top:       { gap: 3 },
  dateLabel: { fontSize: 8, letterSpacing: 3 },
  headline:  { fontSize: 11, letterSpacing: 2 },
  scoreRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  scoreBig:  { fontSize: 64, letterSpacing: -4, lineHeight: 68 },
  scoreMax:  { fontSize: 18 },
  barTrack:  { height: 1.5, borderRadius: 1, overflow: 'hidden' },
  barFill:   { height: '100%', borderRadius: 1 },
  breakdown: { flexDirection: 'row', alignItems: 'center' },
  cell:      { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 10 },
  cellLabel: { fontSize: 7, letterSpacing: 1.5 },
  cellValue: { fontSize: 20 },
  sep:       { width: 1, height: 28 },
});

// ── Trend card ─────────────────────────────────────────────────────────────────

function trendAnalysis(data: number[]): { label: string; color: string; sub: string } {
  const nonZero = data.filter(v => v > 0);
  if (nonZero.length < 2) return { label: 'NOT ENOUGH DATA', color: '#888888', sub: 'Log more to see your trend.' };
  const first = nonZero.slice(0, Math.ceil(nonZero.length / 2));
  const last  = nonZero.slice(Math.floor(nonZero.length / 2));
  const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
  const avgLast  = last.reduce((a, b) => a + b, 0) / last.length;
  const delta = avgLast - avgFirst;
  if (delta > 8)  return { label: 'GETTING BETTER', color: '#34C759', sub: `Up ${Math.round(delta)} pts vs earlier this week. Keep it going.` };
  if (delta > 2)  return { label: 'SLIGHT IMPROVEMENT', color: '#34C759', sub: 'Small progress is still progress. Push more.' };
  if (delta < -8) return { label: 'SLIPPING', color: '#EF4444', sub: `Down ${Math.round(Math.abs(delta))} pts. You are making the same mistakes. Fix the pattern.` };
  if (delta < -2) return { label: 'SLIGHTLY DECLINING', color: '#F59E0B', sub: 'Small dip. Catch it before it becomes a habit.' };
  return { label: 'CONSISTENT', color: '#F59E0B', sub: 'Holding steady — but are you growing or just maintaining?' };
}

function TrendCard({ icon, label, data, theme }: { icon: any; label: string; data: number[]; theme: any }) {
  const { label: trendLabel, color, sub } = trendAnalysis(data);
  const avg = data.filter(v => v > 0).reduce((a, b) => a + b, 0) / Math.max(data.filter(v => v > 0).length, 1);
  return (
    <View style={[tc.card, { borderColor: theme.border }]}>
      <View style={tc.top}>
        <Ionicons name={icon} size={14} color={theme.textSecondary} />
        <Text style={[tc.domain, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{label}</Text>
        <View style={{ flex: 1 }} />
        <Text style={[tc.avg, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_500Medium' }]}>
          AVG {Math.round(avg)}
        </Text>
      </View>
      <Text style={[tc.trendLabel, { color, fontFamily: 'Inter_900Black' }]}>{trendLabel}</Text>
      <Text style={[tc.trendSub, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>{sub}</Text>
    </View>
  );
}

const tc = StyleSheet.create({
  card:       { marginHorizontal: 16, borderWidth: 1, padding: 16, gap: 8 },
  top:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  domain:     { fontSize: 9, letterSpacing: 2 },
  avg:        { fontSize: 10 },
  trendLabel: { fontSize: 13, letterSpacing: 1.5 },
  trendSub:   { fontSize: 11, lineHeight: 17, fontStyle: 'italic' },
});

// ── Main screen ────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, token, logout, updateProfile } = useAuth();
  const { theme, setMode }      = useTheme();
  const router   = useRouter();
  const flatRef  = useRef<FlatList>(null);

  const NUM_DAYS = 7;
  const DAYS = Array.from({ length: NUM_DAYS }, (_, i) => shiftDate(today(), i - (NUM_DAYS - 1)));

  const [cardData, setCardData]     = useState<DayData[]>([]);
  const [chartData, setChartData]   = useState<{ date: string; value: number }[]>([]);
  const [strengthId, setStrengthId] = useState<any>(null);
  const [fuelId, setFuelId]         = useState<any>(null);
  const [shields, setShields]       = useState<any>(null);
  const [healthScores, setHealthScores] = useState<HealthScores | null>(null);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hawkEye, setHawkEye]       = useState(false);
  // Apple Health opt-in — persisted so the stats card stays hidden until the
  // user explicitly connects. null while we read the stored flag on mount.
  const [healthConnected, setHealthConnected] = useState<boolean | null>(null);
  const [healthBusy, setHealthBusy]           = useState(false);

  async function load() {
    if (!token) return;
    const from = DAYS[0];
    const to   = DAYS[DAYS.length - 1];
    // Bulk range fetches instead of per-day calls. allSettled so one failure
    // doesn't drop the rest — but if *every* call fails we treat it as a
    // connectivity error rather than "no data".
    const results = await Promise.allSettled([
      habits.disciplineRange(token, from, to),
      fuel.history(token, from, to),
      strength.history(token, from, to),
      strength.identity(token),
      fuel.identity(token),
      habits.shields(token),
      health.scores(token, today()),
    ]);
    if (results.every(r => r.status === 'rejected')) {
      setLoadError(true);
      return;
    }
    setLoadError(false);
    const val = <T,>(i: number, fallback: T): T =>
      results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<T>).value : fallback;
    const discRange = val(0, [] as Awaited<ReturnType<typeof habits.disciplineRange>>);
    const fuelRange = val(1, [] as Awaited<ReturnType<typeof fuel.history>>);
    const strRange  = val(2, [] as Awaited<ReturnType<typeof strength.history>>);
    const s  = val(3, null as Awaited<ReturnType<typeof strength.identity>> | null);
    const f  = val(4, null as Awaited<ReturnType<typeof fuel.identity>> | null);
    const sh = val(5, null as Awaited<ReturnType<typeof habits.shields>> | null);
    const hs = val(6, null as HealthScores | null);

    const discByDate = new Map(discRange.map(r => [r.date, r]));
    const fuelByDate = new Map(fuelRange.map(r => [r.date, r.score ?? 0]));
    const strByDate  = new Map(strRange.map(r => [r.date, r.score ?? 0]));

    const cards: DayData[] = DAYS.map(d => ({
      date: d,
      discipline: discByDate.get(d)?.overallScore ?? 0,
      food:       fuelByDate.get(d) ?? 0,
      physical:   strByDate.get(d)  ?? 0,
    }));

    setCardData(cards);
    setChartData(DAYS.map(d => ({ date: d, value: discByDate.get(d)?.overallScore ?? 0 })));
    setStrengthId(s); setFuelId(f); setShields(sh); setHealthScores(hs);
  }

  // Pull fresh HealthKit data in the background (sleep/HRV/resting HR/steps/
  // calories, last 7 days) before re-fetching scores — silent no-op on
  // Android/web/simulator-without-data, so it never blocks the rest of the page.
  // Only runs once the user has opted in via the Apple Health toggle.
  async function syncHealth() {
    if (!token) return;
    try {
      const available = await healthKit.isAvailable();
      if (!available) return;
      await healthKit.requestAuthorization();
      await healthKit.syncToBackend(token, 7);
    } catch {
      // HealthKit unavailable or user denied — dashboard just shows no data for those cards.
    }
  }

  // Flip the Apple Health connection. Turning it on requests the system
  // permission sheet and does a first sync; turning it off just hides the
  // stats card (already-synced data stays on the backend, untouched).
  async function toggleHealth() {
    if (healthBusy) return;
    if (healthConnected) {
      setHealthConnected(false);
      AsyncStorage.setItem(HEALTH_CONNECTED_KEY, 'false').catch(() => {});
      return;
    }
    setHealthBusy(true);
    try {
      const available = await healthKit.isAvailable();
      if (!available) {
        Alert.alert('Apple Health unavailable', 'Apple Health is only available on iPhone.');
        return;
      }
      const granted = await healthKit.requestAuthorization();
      if (!granted) {
        Alert.alert(
          'Permission needed',
          'Grittt needs access to Apple Health. You can enable it in Settings → Privacy → Health.'
        );
        return;
      }
      setHealthConnected(true);
      AsyncStorage.setItem(HEALTH_CONNECTED_KEY, 'true').catch(() => {});
      if (token) {
        const { metricsSynced, workoutsSynced } = await healthKit.syncToBackend(token, 7);
        await load();
        // HealthKit never reports whether READ access was denied — if the user
        // skipped the permission toggles, requestAuthorization resolves but every
        // read comes back empty. Surface that instead of a silently blank card.
        if (metricsSynced === 0 && workoutsSynced === 0) {
          Alert.alert(
            'No Health data found',
            "Grittt connected, but couldn't read any Health data. Open Settings → Privacy & Security → Health → Grittt, turn on Steps, Sleep, Heart Rate and the rest, then toggle Apple Health off and on here."
          );
        }
      }
    } catch {
      Alert.alert('Something went wrong', "Couldn't connect to Apple Health. Please try again.");
    } finally {
      setHealthBusy(false);
    }
  }

  useEffect(() => {
    (async () => {
      const stored = (await AsyncStorage.getItem(HEALTH_CONNECTED_KEY).catch(() => null)) === 'true';
      setHealthConnected(stored);
      if (stored) await syncHealth();
      await load();
    })().finally(() => {
      setLoading(false);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 120);
    });
  }, [token]);

  // Re-fetch whenever this tab regains focus — so ticks on the Discipline
  // tab show up here immediately when the user switches back.
  useFocusEffect(
    useCallback(() => { load(); }, [token])
  );

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [token]);

  function handleLogout() {
    Alert.alert('Sign Out', 'End current session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  }

  const strPct  = strengthId?.xpToNext ? 1 - strengthId.xpToNext / (strengthId.totalXP + strengthId.xpToNext) : 1;
  const fuelPct = fuelId?.xpToNext     ? 1 - fuelId.xpToNext / (fuelId.totalXP + fuelId.xpToNext) : 1;
  const firstName = user?.name?.split(' ')[0]?.toUpperCase() ?? 'YOU';

  return (
    <DarkBackground><SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={[s.nameLabel, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{firstName}</Text>
          <Text style={[s.modeEyebrow, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>Dashboard</Text>
        </View>
        <TouchableOpacity style={[s.topIcon, { borderColor: '#34C759' }]} onPress={() => router.push('/(tabs)/ai')}>
          <Ionicons name="sparkles" size={15} color="#34C759" />
        </TouchableOpacity>
        <TouchableOpacity style={[s.topIcon, { borderColor: theme.border }]} onPress={() => router.push('/edit-profile')}>
          <Ionicons name="create-outline" size={15} color={theme.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.topIcon, { borderColor: theme.border }]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={15} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />}>

        {/* ── D_Dashboard design ── */}
        {loadError ? (
          <ErrorState
            message="Couldn't load your dashboard."
            onRetry={() => { setLoading(true); load().finally(() => setLoading(false)); }}
          />
        ) : (
          cardData.length >= 2 && <DashSection cardData={cardData} healthScores={healthScores} healthConnected={!!healthConnected} token={token!} theme={theme} onHawkEye={() => setHawkEye(true)}
            stepGoal={user?.stepGoal ?? STEP_GOAL} calorieGoal={user?.calorieGoal ?? ACTIVE_KCAL_GOAL}
            onSetGoal={(which, n) => updateProfile(which === 'step' ? { stepGoal: n } : { calorieGoal: n }).then(() => load()).catch(() => {})} />
        )}
        <HawkEyeModal visible={hawkEye} onClose={() => setHawkEye(false)} token={token!} />


        {/* ── Mirror entry card ── */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/mirror' as any)}
          activeOpacity={0.9}
          style={{
            marginHorizontal: 16,
            marginBottom: 12,
            borderRadius: 20,
            backgroundColor: '#14110D',
            paddingVertical: 18,
            paddingHorizontal: 18,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            borderWidth: 1,
            borderColor: '#B8F23A33',
          }}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="sparkles" size={11} color="#B8F23A" />
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 10, letterSpacing: 2, color: '#B8F23A' }}>THE MIRROR</Text>
            </View>
            <Text style={{ fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 20, lineHeight: 24, color: '#F5F2E9', marginTop: 8 }}>See who you're becoming</Text>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#F5F2E9', opacity: 0.55, marginTop: 4 }}>Your identity, reflected</Text>
          </View>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#B8F23A', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-forward" size={18} color="#14110D" />
          </View>
        </TouchableOpacity>

        {/* Fuel Analysis */}
        <TouchableOpacity
          style={[s.appearanceRow, { borderColor: theme.border }]}
          onPress={() => router.push('/(tabs)/building-you' as any)}
          activeOpacity={0.8}
        >
          <Ionicons name="nutrition-outline" size={18} color={theme.text} />
          <Text style={[s.appearanceLabel, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>Fuel Analysis</Text>
          <View style={{ flex: 1 }} />
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </TouchableOpacity>

        {/* Apple Health connect toggle */}
        <TouchableOpacity
          style={[s.appearanceRow, { borderColor: theme.border }]}
          onPress={toggleHealth}
          disabled={healthBusy}
          activeOpacity={0.8}
        >
          <Ionicons name="heart" size={18} color="#FF2D55" />
          <View style={{ flex: 1 }}>
            <Text style={[s.appearanceLabel, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>Apple Health</Text>
            <Text style={[s.healthSub, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              {healthConnected ? 'Syncing recovery, sleep & movement' : 'Connect to see your health stats'}
            </Text>
          </View>
          {healthBusy
            ? <ActivityIndicator size="small" color={theme.textSecondary} />
            : (
              <View style={[s.switchTrack, {
                backgroundColor: healthConnected ? '#34C759' : theme.surfaceStrong,
                borderColor: healthConnected ? '#34C759' : theme.border,
              }]}>
                <View style={[s.switchKnob, {
                  backgroundColor: theme.card,
                  alignSelf: healthConnected ? 'flex-end' : 'flex-start',
                }]} />
              </View>
            )}
        </TouchableOpacity>

        {/* Appearance toggle */}
        <View style={[s.appearanceRow, { borderColor: theme.border }]}>
          <Ionicons name={theme.isDark ? 'moon' : 'sunny'} size={18} color={theme.text} />
          <Text style={[s.appearanceLabel, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>Appearance</Text>
          <View style={{ flex: 1 }} />
          <View style={[s.themeToggle, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TouchableOpacity style={[s.themeOpt, !theme.isDark && { backgroundColor: theme.inverse }]}
              onPress={() => setMode('light')} activeOpacity={0.7}>
              <Ionicons name="sunny" size={13} color={!theme.isDark ? theme.inverseText : theme.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.themeOpt, theme.isDark && { backgroundColor: theme.inverse }]}
              onPress={() => setMode('dark')} activeOpacity={0.7}>
              <Ionicons name="moon" size={13} color={theme.isDark ? theme.inverseText : theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView></DarkBackground>
  );
}

// ── Warm Coach Dashboard section ──────────────────────────────────────────────

const WC = {
  good:  '#22A664',
  warn:  '#F0A12E',
  bad:   '#E84A4A',
  hype:  '#B8F23A',
};

function StatusPill({ tone, children, theme }: { tone: 'good'|'warn'|'bad'; children: string; theme: any }) {
  const map = {
    good: { bg: '#E2F7EC', fg: WC.good },
    warn: { bg: '#FFF1DC', fg: WC.warn },
    bad:  { bg: '#FCE6E6', fg: WC.bad  },
  }[tone];
  return (
    <View style={[dd.pill, { backgroundColor: theme.isDark ? map.fg + '25' : map.bg }]}>
      <Text style={[dd.pillText, { color: map.fg, fontFamily: 'Inter_900Black' }]}>{children}</Text>
    </View>
  );
}

function formatHoursMin(hours: number | null): string {
  if (hours == null) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

function tierColor(v: number | null): string {
  if (v == null) return WC.warn;
  return v >= 70 ? WC.good : v >= 40 ? WC.warn : WC.bad;
}

/** Section header row — "MOVEMENT · TODAY" ......... "Live" */
function SectionHead({ left, right, theme }: { left: string; right?: string; theme: any }) {
  return (
    <View style={dd.sectionHead}>
      <Text style={[dd.sectionHeadLeft, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{left}</Text>
      {!!right && <Text style={[dd.sectionHeadRight, { color: theme.textMuted, fontFamily: 'Inter_500Medium' }]}>{right}</Text>}
    </View>
  );
}

function DashSection({ cardData, healthScores, healthConnected, token, theme, onHawkEye, stepGoal, calorieGoal, onSetGoal }: {
  cardData: { date: string; discipline: number; food: number; physical: number }[];
  healthScores: HealthScores | null;
  healthConnected: boolean;
  token: string;
  theme: any; onHawkEye: () => void;
  stepGoal: number;
  calorieGoal: number;
  onSetGoal: (which: 'step' | 'calorie', n: number) => void;
}) {
  const [chartTab, setChartTab] = React.useState<'HABITS'|'FOOD'|'PHYS'>('HABITS');

  // The hero card highlights one day at a time. Default to today (last index)
  // so ticks on the Discipline tab show up here immediately on focus.
  const todayIdx     = cardData.length - 1;
  const yesterdayIdx = cardData.length - 2;
  const [selectedIdx, setSelectedIdx] = React.useState(todayIdx);
  // Keep the pointer pinned to today when the underlying date window shifts
  // (refresh, day rollover) UNLESS the user has scrolled to a different day.
  const lastTodayIdxRef = React.useRef(todayIdx);
  React.useEffect(() => {
    if (lastTodayIdxRef.current === selectedIdx) {
      setSelectedIdx(todayIdx);
    }
    lastTodayIdxRef.current = todayIdx;
  }, [todayIdx]);

  const selectedDay = cardData[selectedIdx];
  const todayData   = cardData[todayIdx];
  const isSelectedToday = selectedIdx === todayIdx;
  const GOOD = WC.good; const BAD = WC.bad;

  // Recovery/Movement for the SELECTED day. The sync pushes the last 7 days, so
  // past days have data too — fetch that day's /scores. Seeded with today's
  // scores (passed in) so today renders instantly without a refetch flash.
  const [dayScores, setDayScores] = React.useState<HealthScores | null>(healthScores);
  React.useEffect(() => {
    if (!healthConnected) { setDayScores(null); return; }
    let cancelled = false;
    health.scores(token, selectedDay.date)
      .then(s => { if (!cancelled) setDayScores(s); })
      .catch(() => { if (!cancelled) setDayScores(null); });
    return () => { cancelled = true; };
  }, [selectedDay.date, healthConnected, token]);

  const recoveryScore = healthConnected ? dayScores?.recovery.score ?? null : null;
  const movementScore = healthConnected ? dayScores?.movement.score ?? null : null;

  // Only show metrics we actually have data for — drop the ones that are null
  // (e.g. no sleep/HRV/SpO2 without a Watch) instead of rendering a "—".
  const rec = dayScores?.recovery;
  const mov = dayScores?.movement;

  // Sleep (hero of the Recovery card): total time asleep + a quality word.
  const asleepMin = rec?.sleepHours != null ? Math.round(rec.sleepHours * 60) : null;
  const sleepH = asleepMin != null ? Math.floor(asleepMin / 60) : null;
  const sleepM = asleepMin != null ? asleepMin % 60 : null;
  const sleepWord =
    rec?.sleepHours == null ? '' :
    rec.sleepHours >= 7.5 ? 'Restful' :
    rec.sleepHours >= 6.5 ? 'Solid' :
    rec.sleepHours >= 5   ? 'Short' : 'Poor';

  // Sleep stages (Deep / REM / Light / Awake) — proportional bar + legend.
  const sleepStages = [
    { key: 'deep',  label: 'DEEP',  hrs: rec?.sleep?.deep  ?? 0, color: theme.text },
    { key: 'rem',   label: 'REM',   hrs: rec?.sleep?.rem   ?? 0, color: '#6E8F27' },
    { key: 'light', label: 'LIGHT', hrs: rec?.sleep?.light ?? 0, color: theme.textMuted },
    { key: 'awake', label: 'AWAKE', hrs: rec?.sleep?.awake ?? 0, color: theme.borderStrong },
  ];
  const stageTotal = sleepStages.reduce((s, x) => s + x.hrs, 0);

  // Recovery-card vitals row: HRV · Resting HR · Heart Rate · SpO₂.
  const recoveryVitals = [
    rec?.heartRateVariability != null ? { val: String(Math.round(rec.heartRateVariability)), unit: 'ms',  label: 'HRV' } : null,
    rec?.restingHeartRate != null     ? { val: String(Math.round(rec.restingHeartRate)),     unit: 'bpm', label: 'RESTING HR' } : null,
    rec?.heartRateAvg != null         ? { val: String(Math.round(rec.heartRateAvg)),         unit: 'bpm', label: 'HEART RATE' } : null,
    rec?.spo2 != null                 ? { val: String(Math.round(rec.spo2)),                 unit: '%',   label: 'SPO₂' } : null,
  ].filter(Boolean) as { val: string; unit: string; label: string }[];

  const hasRecovery = recoveryScore != null || rec?.sleepHours != null || recoveryVitals.length > 0 || stageTotal > 0;

  // Overall = equal-weight average of whichever pillars have data for the
  // selected day (Discipline + Nutrition always do; Recovery + Movement only
  // for today), mirroring the backend's weighted-average-of-available approach.
  const overallParts = [selectedDay.discipline, selectedDay.food, recoveryScore, movementScore].filter(
    (v): v is number => v != null
  );
  const overall = overallParts.length > 0
    ? Math.round(overallParts.reduce((a, b) => a + b, 0) / overallParts.length)
    : 0;

  const avg7disc    = Math.round(cardData.reduce((a, d) => a + d.discipline, 0) / cardData.length);

  const streak = (() => {
    let n = 0;
    for (let i = cardData.length - 2; i >= 0; i--) {
      if (cardData[i].discipline > 0) n++; else break;
    }
    return n;
  })();

  const statusTone: 'good'|'warn'|'bad' = overall >= 70 ? 'good' : overall >= 40 ? 'warn' : 'bad';
  const statusLabel = overall >= 70 ? 'BUILDING' : overall >= 40 ? 'WAVERING' : overall > 0 ? 'BELOW POTENTIAL' : 'UNLOGGED';

  // Friendly label for the selected day
  const dayLabel = (() => {
    if (selectedIdx === todayIdx)     return 'TODAY';
    if (selectedIdx === yesterdayIdx) return 'YESTERDAY';
    const d = new Date(selectedDay.date + 'T12:00:00Z');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
  })();
  const canPrev = selectedIdx > 0;
  const canNext = selectedIdx < todayIdx;

  const chartScores = chartTab === 'FOOD' ? cardData.map(d => d.food)
                    : chartTab === 'PHYS' ? cardData.map(d => d.physical)
                    : cardData.map(d => d.discipline);
  const chartAvg = Math.round(chartScores.reduce((a, b) => a + b, 0) / chartScores.length);
  const days = ['M','T','W','T','F','S','S'];

  const breakdown = [
    { k: 'DISCIPLINE', v: selectedDay.discipline as number | null, color: tierColor(selectedDay.discipline) },
    ...(healthConnected ? [{ k: 'RECOVERY', v: recoveryScore, color: tierColor(recoveryScore) }] : []),
    { k: 'NUTRITION',  v: selectedDay.food as number | null,        color: tierColor(selectedDay.food) },
    ...(healthConnected ? [{ k: 'MOVEMENT', v: movementScore, color: tierColor(movementScore) }] : []),
  ];

  // Recovery status pill + copy
  const recoveryTone: 'good'|'warn'|'bad' = recoveryScore == null ? 'warn' : recoveryScore >= 70 ? 'good' : recoveryScore >= 40 ? 'warn' : 'bad';
  const recoveryLabel = recoveryScore == null ? 'NO DATA' : recoveryScore >= 70 ? 'RECOVERED' : recoveryScore >= 40 ? 'RECOVERING' : 'LOW';
  const recoveryCopy  = recoveryScore == null
    ? 'Connect Apple Health to see recovery based on sleep, HRV, and resting heart rate.'
    : recoveryScore >= 70 ? 'Your body is ready to push today.'
    : recoveryScore >= 40 ? 'Take it a little easier — recovery is average.'
    : 'Your body needs rest. Prioritize sleep tonight.';

  // Heuristic "AI Body Insight" — compares today's recovery vs discipline so
  // the copy reacts to the most interesting gap, without a live model call.
  const insightHeadline = (() => {
    if (recoveryScore == null) return 'Log a few days of Health data to unlock body insights.';
    const disc = todayData.discipline;
    if (recoveryScore >= 70 && disc < 50) return "Your recovery improved, but your discipline dropped.";
    if (recoveryScore < 40 && disc >= 70) return "You're pushing hard on habits, but your body is under-recovered.";
    if (recoveryScore >= 70 && disc >= 70) return "Recovery and discipline are both dialed in.";
    return "Recovery and discipline are both lagging today.";
  })();
  const insightSub = recoveryScore == null ? '' : recoveryScore >= 70
    ? "You're physically capable today. Don't waste it."
    : recoveryScore >= 40
    ? 'Steady, not sharp. Match today\'s intensity to it.'
    : 'Pushing through low recovery raises injury risk.';

  const insights = [
    { mode: 'FOOD', avg: todayData.food, tone: todayData.food >= 70 ? 'good' : todayData.food >= 40 ? 'warn' : 'bad' as 'good'|'warn'|'bad',
      state: todayData.food >= 70 ? 'BUILDING' : todayData.food > 0 ? 'SLIPPING' : 'UNLOGGED',
      copy: todayData.food >= 70 ? 'Clean eating today. Fuel is dialled.' : todayData.food > 0 ? 'Logged. Check junk food and quality.' : 'No food log yet — takes 30 seconds.',
      delta: todayData.food - avg7disc },
    { mode: 'PHYSICAL', avg: todayData.physical, tone: todayData.physical >= 50 ? 'good' : 'bad' as 'good'|'warn'|'bad',
      state: todayData.physical >= 70 ? 'BUILDING' : todayData.physical > 0 ? 'WAVERING' : 'UNLOGGED',
      copy: todayData.physical >= 70 ? 'Strong session. Recovery matters too.' : todayData.physical > 0 ? 'Session logged. Push harder tomorrow.' : 'No workout logged yet today.',
      delta: todayData.physical - avg7disc },
    { mode: 'DISCIPLINE', avg: todayData.discipline, tone: todayData.discipline >= 70 ? 'good' : todayData.discipline >= 40 ? 'warn' : 'bad' as 'good'|'warn'|'bad',
      state: todayData.discipline >= 70 ? 'BUILDING' : todayData.discipline >= 40 ? 'WAVERING' : todayData.discipline > 0 ? 'SLIPPING' : 'UNLOGGED',
      copy: todayData.discipline >= 70 ? 'Habits locked in. Keep stacking.' : todayData.discipline >= 40 ? 'Making progress. Finish today\'s habits.' : 'Below potential. Mark one habit done now.',
      delta: todayData.discipline - avg7disc },
  ];

  return (
    <View>
      {/* ── Hero card ── */}
      <View style={[dd.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {/* Top: day nav + status | STREAK */}
        <View style={dd.heroTop}>
          <View style={dd.heroLeft}>
            <View style={dd.dayNav}>
              <TouchableOpacity
                style={[dd.navBtn, { borderColor: theme.border, opacity: canPrev ? 1 : 0.3 }]}
                onPress={() => canPrev && setSelectedIdx(i => i - 1)}
                disabled={!canPrev}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.6}
              >
                <Ionicons name="chevron-back" size={14} color={theme.textSecondary} />
              </TouchableOpacity>
              <Text style={[dd.eyebrow, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{dayLabel}</Text>
              <TouchableOpacity
                style={[dd.navBtn, { borderColor: theme.border, opacity: canNext ? 1 : 0.3 }]}
                onPress={() => canNext && setSelectedIdx(i => i + 1)}
                disabled={!canNext}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.6}
              >
                <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 8 }}>
              <StatusPill tone={statusTone} theme={theme}>{statusLabel}</StatusPill>
            </View>
          </View>
          {streak > 0 && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[dd.eyebrow, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>STREAK</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Text>🔥</Text>
                <Text style={[dd.streakVal, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>{streak} DAYS</Text>
              </View>
            </View>
          )}
        </View>

        {/* Gauge centered */}
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          <Gauge value={overall} max={100} label="Overall Score" />
        </View>

        {/* Mode breakdown */}
        <View style={[dd.breakdown, { borderTopColor: theme.border }]}>
          {breakdown.map((m, i) => (
            <View key={m.k} style={[dd.breakCell, i < breakdown.length - 1 && { borderRightColor: theme.border, borderRightWidth: 1 }]}>
              <Text style={[dd.eyebrow, { color: theme.textSecondary, fontFamily: 'Inter_700Bold', fontSize: 9 }]}>{m.k}</Text>
              <Text style={[dd.breakNum, { color: m.v == null ? theme.textMuted : theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                {m.v ?? '—'}
              </Text>
              <View style={[dd.breakTrack, { backgroundColor: theme.surfaceStrong }]}>
                <View style={[dd.breakFill, { width: `${Math.min(m.v ?? 0, 100)}%` as any, backgroundColor: theme.text }]} />
              </View>
            </View>
          ))}
        </View>

      </View>{/* ── end Hero card ── */}

      {/* ── MOVEMENT · TODAY ── */}
      {healthConnected && (
        <>
          <SectionHead left="MOVEMENT · TODAY" right="Live" theme={theme} />
          <View style={dd.movRow}>
            <MovementGoalCard label="STEPS" icon="footsteps" iconColor="#22A664" value={mov?.steps ?? 0}
              goal={stepGoal} sub={`of ${stepGoal.toLocaleString()} goal`} theme={theme}
              onSetGoal={n => onSetGoal('step', n)} />
            <MovementGoalCard label="CALORIES" icon="flame" iconColor="#F97316" value={mov?.activeEnergyBurned ?? 0}
              goal={calorieGoal} sub={`active kcal · of ${calorieGoal}`} theme={theme}
              onSetGoal={n => onSetGoal('calorie', n)} />
          </View>
        </>
      )}

      {/* ── RECOVERY ── */}
      {healthConnected && hasRecovery && (
        <>
          <SectionHead left="RECOVERY" right="Last night" theme={theme} />
          <View style={[dd.recoveryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {/* Top: sleep hero (left) + recovery ring (right) */}
            <View style={dd.recTop}>
              <View style={{ flex: 1 }}>
                <Text style={[dd.recEyebrow, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>SLEEP · TIME ASLEEP</Text>
                {sleepH != null ? (
                  <View style={dd.recBigRow}>
                    <Text style={[dd.recBigNum, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>{sleepH}</Text>
                    <Text style={[dd.recBigUnit, { color: theme.textMuted, fontFamily: 'Inter_500Medium' }]}>h</Text>
                    <Text style={[dd.recBigNum, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold', marginLeft: 10 }]}>{sleepM}</Text>
                    <Text style={[dd.recBigUnit, { color: theme.textMuted, fontFamily: 'Inter_500Medium' }]}>m</Text>
                  </View>
                ) : (
                  <Text style={[dd.recBigNum, { color: theme.textMuted, fontFamily: 'SpaceGrotesk_700Bold' }]}>—</Text>
                )}
                {!!sleepWord && (
                  <Text style={[dd.recQuality, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{sleepWord}</Text>
                )}
              </View>
              {recoveryScore != null && (
                <View style={dd.recRing}>
                  <Svg width={100} height={100} viewBox="0 0 100 100">
                    <Circle cx={50} cy={50} r={43} fill="none" stroke={theme.surfaceStrong} strokeWidth={8} />
                    <Circle cx={50} cy={50} r={43} fill="none"
                      stroke={tierColor(recoveryScore)} strokeWidth={8} strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 43} ${2 * Math.PI * 43}`}
                      strokeDashoffset={2 * Math.PI * 43 * (1 - recoveryScore / 100)}
                      rotation={-90} originX={50} originY={50} />
                  </Svg>
                  <View style={dd.recRingCenter} pointerEvents="none">
                    <Text style={[dd.recRingPct, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>{recoveryScore}%</Text>
                    <Text style={[dd.recRingLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{recoveryLabel}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Sleep stages — proportional bar + legend */}
            {stageTotal > 0 && (
              <>
                <View style={dd.stageBar}>
                  {sleepStages.filter(s => s.hrs > 0).map((s, i, arr) => (
                    <View key={s.key} style={{
                      flex: s.hrs, height: 12, backgroundColor: s.color, borderRadius: 4,
                      marginRight: i < arr.length - 1 ? 3 : 0,
                    }} />
                  ))}
                </View>
                <View style={dd.stageLegend}>
                  {sleepStages.map(s => (
                    <View key={s.key} style={dd.stageCell}>
                      <View style={dd.stageDotRow}>
                        <View style={[dd.stageDot, { backgroundColor: s.color }]} />
                        <Text style={[dd.stageLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{s.label}</Text>
                      </View>
                      <Text style={[dd.stageVal, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>{formatHoursMin(s.hrs)}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Vitals — HRV · Resting HR · Heart Rate · SpO₂ */}
            {recoveryVitals.length > 0 && (
              <View style={[dd.recVitals, { borderTopColor: theme.border }]}>
                {recoveryVitals.map((v, i) => (
                  <React.Fragment key={v.label}>
                    {i > 0 && <View style={[dd.recVitalSep, { backgroundColor: theme.border }]} />}
                    <View style={dd.recVitalCell}>
                      <Text>
                        <Text style={[dd.recVitalVal, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>{v.val}</Text>
                        <Text style={[dd.recVitalUnit, { color: theme.textMuted, fontFamily: 'Inter_500Medium' }]}>{v.unit}</Text>
                      </Text>
                      <Text style={[dd.recVitalLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>{v.label}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            )}
          </View>
        </>
      )}

      {/* ── Hawk Eye button ── */}
      <TouchableOpacity
        style={[dd.hawkCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={onHawkEye}
        activeOpacity={0.85}
      >
        <View style={{ flex: 1 }}>
          <Text style={[dd.hawkTitle, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>Hawk Eye</Text>
          <Text style={[dd.hawkSub, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            Full history · Calendar · Countdown
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </TouchableOpacity>

      {/* ── 7-day chart card ── */}
      <View style={[dd.card, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 12 }]}>
        <View style={dd.chartTop}>
          <View>
            <Text style={[dd.eyebrow, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>7-DAY SCORE</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2, marginTop: 2 }}>
              <Text style={[dd.chartAvg, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>AVG {chartAvg}</Text>
              <Text style={[{ color: theme.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 13 }]}> / 100</Text>
            </View>
          </View>
          <View style={[dd.tabRow, { backgroundColor: theme.surface }]}>
            {(['HABITS','FOOD','PHYS'] as const).map(t => (
              <TouchableOpacity key={t} style={[dd.tabBtn, chartTab === t && { backgroundColor: theme.inverse }]}
                onPress={() => setChartTab(t)} activeOpacity={0.8}>
                <Text style={[dd.tabText, { color: chartTab === t ? theme.inverseText : theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* MiniBars */}
        <View style={dd.barsRow}>
          {chartScores.map((v, i) => {
            const isToday = i === chartScores.length - 1;
            const h = Math.max(4, (v / 100) * 56);
            const bg = v === 0 ? theme.surfaceStrong : isToday ? WC.hype : theme.text + 'B0';
            const dow = (new Date(cardData[i].date + 'T12:00:00').getDay() + 6) % 7;
            return (
              <View key={i} style={dd.barCol}>
                <View style={[dd.barWrap, { height: 56 }]}>
                  <View style={[dd.bar, { height: h, backgroundColor: bg, borderRadius: 4,
                    borderWidth: isToday ? 1.5 : 0, borderColor: theme.text }]} />
                </View>
                <Text style={[dd.barDay, { color: isToday ? theme.text : theme.textSecondary,
                  fontFamily: isToday ? 'Inter_700Bold' : 'Inter_500Medium' }]}>{days[dow]}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* ── AI Body Insight ── (recovery-driven, Apple Health only) */}
      {healthConnected && isSelectedToday && (
        <View style={[dd.aiCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[dd.aiRail, { backgroundColor: WC.hype }]} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="sparkles" size={11} color={WC.hype} />
              <Text style={[dd.eyebrow, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>TODAY · AI BODY INSIGHT</Text>
            </View>
            <Text style={[dd.aiHeadline, { color: theme.text, fontFamily: 'Inter_800ExtraBold' }]}>{insightHeadline}</Text>
            {!!insightSub && (
              <Text style={[dd.insightCopy, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>{insightSub}</Text>
            )}
          </View>
        </View>
      )}

      {/* ── Insight rows ── */}
      {insights.map(row => (
        <View key={row.mode} style={[dd.card, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 10, padding: 16 }]}>
          <View style={dd.insightRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[dd.eyebrow, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{row.mode}</Text>
                <StatusPill tone={row.tone} theme={theme}>{row.state}</StatusPill>
              </View>
              <Text style={[dd.insightCopy, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>{row.copy}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[dd.eyebrow, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>AVG</Text>
              <Text style={[dd.insightScore, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>{row.avg}</Text>
              <Text style={[dd.insightDelta, { color: row.delta >= 0 ? GOOD : BAD, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                {row.delta >= 0 ? '+' : ''}{row.delta}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const dd = StyleSheet.create({
  card:        { marginHorizontal: 16, borderWidth: 1, borderRadius: 20, overflow: 'hidden', padding: 0 },
  hawkCard:    { marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  hawkEmoji:   { fontSize: 28 },
  hawkTitle:   { fontSize: 18, letterSpacing: -0.3 },
  hawkSub:     { fontSize: 12, marginTop: 2 },
  eyebrow:     { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  pill:        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pillText:    { fontSize: 10, letterSpacing: 1.5 },
  // Hero card
  heroTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingBottom: 4 },
  heroLeft:    { gap: 6 },
  dayNav:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtn:      { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  streakVal:   { fontSize: 17 },
  breakdown:   { flexDirection: 'row', borderTopWidth: 1 },
  breakCell:   { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6, gap: 6 },
  breakNum:    { fontSize: 22, lineHeight: 24 },
  breakTrack:  { width: '80%', height: 4, borderRadius: 2, overflow: 'hidden' },
  breakFill:   { height: '100%', borderRadius: 2 },
  // Section header
  sectionHead:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginHorizontal: 16, marginTop: 22, marginBottom: 12 },
  sectionHeadLeft:  { fontSize: 11, letterSpacing: 2 },
  sectionHeadRight: { fontSize: 11, letterSpacing: 0.5 },
  // Movement goal cards
  movRow:      { flexDirection: 'row', gap: 12, marginHorizontal: 16 },
  movCard:     { flex: 1, borderWidth: 1, borderRadius: 18, padding: 16, gap: 4 },
  movTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  movIcon:     { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  movLabel:    { fontSize: 9, letterSpacing: 1.5 },
  movValue:    { fontSize: 34, letterSpacing: -1, marginTop: 6, lineHeight: 38 },
  movSub:      { fontSize: 11, lineHeight: 15 },
  movTrack:    { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 10 },
  movFill:     { height: '100%', borderRadius: 2 },
  movFoot:     { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  movFootText: { fontSize: 11 },
  // Recovery card (sleep-focused)
  recoveryCard:  { marginHorizontal: 16, borderWidth: 1, borderRadius: 20, padding: 18, gap: 16 },
  recTop:        { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  recEyebrow:    { fontSize: 10, letterSpacing: 2 },
  recBigRow:     { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
  recBigNum:     { fontSize: 52, letterSpacing: -2, lineHeight: 54 },
  recBigUnit:    { fontSize: 18, marginLeft: 2 },
  recQuality:    { fontSize: 13, marginTop: 10 },
  recRing:       { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  recRingCenter: { position: 'absolute', alignItems: 'center' },
  recRingPct:    { fontSize: 20, letterSpacing: -0.5 },
  recRingLabel:  { fontSize: 8, letterSpacing: 1.2, marginTop: 1 },
  // Sleep stages
  stageBar:      { flexDirection: 'row', alignItems: 'center' },
  stageLegend:   { flexDirection: 'row', marginTop: 12 },
  stageCell:     { flex: 1, gap: 5 },
  stageDotRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stageDot:      { width: 8, height: 8, borderRadius: 4 },
  stageLabel:    { fontSize: 9, letterSpacing: 1 },
  stageVal:      { fontSize: 15 },
  // Recovery vitals
  recVitals:     { flexDirection: 'row', borderTopWidth: 1, paddingTop: 14 },
  recVitalCell:  { flex: 1, alignItems: 'center', gap: 4 },
  recVitalSep:   { width: 1, alignSelf: 'stretch' },
  recVitalVal:   { fontSize: 18 },
  recVitalUnit:  { fontSize: 9, letterSpacing: 0.3 },
  recVitalLabel: { fontSize: 8, letterSpacing: 1, marginTop: 2 },
  // AI Body Insight card
  aiCard:      { marginHorizontal: 16, marginTop: 10, borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: 'row', gap: 12, overflow: 'hidden' },
  aiRail:      { width: 3, borderRadius: 2 },
  aiHeadline:  { fontSize: 17, lineHeight: 22 },
  // Chart card
  chartTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 14 },
  chartAvg:    { fontSize: 22 },
  tabRow:      { flexDirection: 'row', gap: 3, padding: 3, borderRadius: 999 },
  tabBtn:      { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999 },
  tabText:     { fontSize: 10, letterSpacing: 1 },
  barsRow:     { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 16 },
  barCol:      { flex: 1, alignItems: 'center', gap: 6 },
  barWrap:     { justifyContent: 'flex-end', width: '100%' },
  bar:         { width: '100%' },
  barDay:      { fontSize: 10 },
  // Insight rows
  insightRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  insightCopy: { fontSize: 13, lineHeight: 18, maxWidth: 240, marginTop: 2 },
  insightScore:{ fontSize: 22, lineHeight: 24 },
  insightDelta:{ fontSize: 11, letterSpacing: 0.5 },
});

const s = StyleSheet.create({
  safe:      { flex: 1 },
  topBar:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, gap: 10 },
  modeEyebrow:{ fontSize: 11, letterSpacing: 1.5, marginTop: 2 },
  nameLabel:  { fontSize: 24, letterSpacing: -0.5 },
  topIcon:   { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:    { paddingBottom: 60, gap: 12 },
  cardList:  { paddingHorizontal: 16, paddingVertical: 4 },
  hawkBtn:   {
    marginHorizontal: 16, alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 12, paddingHorizontal: 24,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 8,
  },
  hawkTitle: { fontSize: 16, letterSpacing: 3 },
  hawkSub:   { fontSize: 10, letterSpacing: 1 },
  chartCard: { marginHorizontal: 16, borderWidth: 1, padding: 16, gap: 12, overflow: 'hidden' },
  chartLabel: { fontSize: 9, letterSpacing: 3 },
  levelDomain: { fontSize: 8, letterSpacing: 2 },
  levelName: { fontSize: 13, letterSpacing: 0.5 },
  levelXP:   { fontSize: 10 },
  lvlTrack:  { height: 1.5, borderRadius: 1, overflow: 'hidden' },
  lvlFill:   { height: '100%', borderRadius: 1 },
  levelNext: { fontSize: 8, letterSpacing: 2 },
  divider:   { height: 1, marginVertical: 4 },
  appearanceRow: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  appearanceLabel: { fontSize: 14 },
  healthSub:   { fontSize: 11, lineHeight: 15, marginTop: 2 },
  switchTrack: { width: 44, height: 26, borderRadius: 13, borderWidth: 1, padding: 2, justifyContent: 'center' },
  switchKnob:  { width: 20, height: 20, borderRadius: 10 },
  themeToggle: { flexDirection: 'row', borderWidth: 1, borderRadius: 8, padding: 2, gap: 2 },
  themeOpt: { width: 32, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
});
