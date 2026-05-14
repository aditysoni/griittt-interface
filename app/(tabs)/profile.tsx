import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Alert, Dimensions, FlatList, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DarkBackground } from '../../components/DarkBackground';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import { habits, strength, fuel, today } from '../../lib/api';
import { HawkEyeModal } from '../../components/HawkEye';
import { useTheme } from '../../components/ThemeContext';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W   = SCREEN_W - 32;
const CHART_W  = SCREEN_W - 64; // card margin 16+16 + card padding 16+16

function shiftDate(base: string, days: number) {
  const d = new Date(base); d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
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
  const { user, token, logout } = useAuth();
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
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hawkEye, setHawkEye]       = useState(false);

  async function load() {
    if (!token) return;
    const [discResults, fuelResults, strResults, s, f, sh] = await Promise.all([
      Promise.all(DAYS.map(d => habits.disciplineDay(token, d).catch(() => null))),
      Promise.all(DAYS.map(d => fuel.logs(token, d).catch(() => []))),
      Promise.all(DAYS.map(d => strength.logs(token, d).catch(() => []))),
      strength.identity(token).catch(() => null),
      fuel.identity(token).catch(() => null),
      habits.shields(token).catch(() => null),
    ]);

    const cards: DayData[] = DAYS.map((d, i) => {
      const disc = discResults[i]?.overallScore ?? 0;
      const foodLogs = fuelResults[i] as any[];
      const strLogs  = strResults[i]  as any[];
      const foodScore = foodLogs.length > 0 ? Math.max(...foodLogs.map((l: any) => l.score ?? 0)) : 0;
      const physScore = strLogs.length  > 0 ? Math.max(...strLogs.map((l: any)  => l.score ?? 0)) : 0;
      return { date: d, discipline: disc, food: foodScore, physical: physScore };
    });

    setCardData(cards);
    setChartData(DAYS.map((d, i) => ({ date: d, value: discResults[i]?.overallScore ?? 0 })));
    setStrengthId(s); setFuelId(f); setShields(sh);
  }

  useEffect(() => {
    load().finally(() => {
      setLoading(false);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 120);
    });
  }, [token]);

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
        <Text style={[s.nameLabel, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{firstName}</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={[s.topIcon, { borderColor: '#34C759' }]} onPress={() => router.push('/(tabs)/ai')}>
          <Ionicons name="sparkles" size={15} color="#34C759" />
        </TouchableOpacity>
        <TouchableOpacity style={[s.topIcon, { borderColor: theme.border }]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={15} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />}>

        {/* Sliding day cards */}
        <FlatList
          ref={flatRef}
          data={cardData}
          keyExtractor={item => item.date}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.cardList}
          snapToInterval={CARD_W + 12}
          decelerationRate="fast"
          renderItem={({ item }) => <DayCard item={item} theme={theme} />}
          ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        />

        {/* Hawk Eye — centred, popped */}
        <TouchableOpacity
          style={[s.hawkBtn, { backgroundColor: theme.inverse, shadowColor: theme.inverse }]}
          onPress={() => setHawkEye(true)}
          activeOpacity={0.85}
        >
          <Text style={[s.hawkTitle, { color: theme.inverseText, fontFamily: 'SpaceGrotesk_700Bold' }]}>HAWK EYE</Text>
        </TouchableOpacity>
        <HawkEyeModal visible={hawkEye} onClose={() => setHawkEye(false)} token={token!} />

        {/* Chart — scrollable with filter */}
        <View style={[s.chartCard, { borderColor: theme.border }]}>
          <ScrollableChart allData={cardData} theme={theme} />
        </View>

        {/* Food trend */}
        <TrendCard
          icon="nutrition-outline"
          label="FOOD"
          data={cardData.map(d => d.food)}
          theme={theme}
        />

        {/* Physical trend */}
        <TrendCard
          icon="barbell-outline"
          label="PHYSICAL ACTIVITY"
          data={cardData.map(d => d.physical)}
          theme={theme}
        />

        {/* Shields */}
        {shields && (
          <TouchableOpacity style={[s.actionRow, { borderColor: theme.border }]} onPress={() => {
            if (!shields.remaining) return;
            Alert.alert('LOG BAD DAY', 'Use a shield to protect your streaks today?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Use Shield', onPress: async () => { try { await habits.badDay(token!, today()); load(); } catch {} } },
            ]);
          }}>
            <Text style={s.actionEmoji}>🛡️</Text>
            <View style={s.actionInfo}>
              <Text style={[s.actionTitle, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>STREAK SHIELDS</Text>
              <Text style={[s.actionSub, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>{shields.remaining}/{shields.max} remaining · Resets monthly</Text>
            </View>
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 10, color: shields.remaining > 0 ? '#34C759' : theme.textSecondary }}>
              {shields.remaining > 0 ? 'USE →' : 'NONE LEFT'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Appearance / theme toggle */}
        <View style={[s.actionRow, { borderColor: theme.border }]}>
          <Ionicons
            name={theme.isDark ? 'moon' : 'sunny'}
            size={22}
            color={theme.text}
            style={{ width: 22 }}
          />
          <View style={s.actionInfo}>
            <Text style={[s.actionTitle, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>APPEARANCE</Text>
            <Text style={[s.actionSub, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Currently {theme.isDark ? 'Dark' : 'Light'} mode
            </Text>
          </View>
          <View style={[s.themeToggle, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TouchableOpacity
              style={[s.themeOpt, !theme.isDark && { backgroundColor: theme.inverse }]}
              onPress={() => setMode('light')}
              activeOpacity={0.7}
            >
              <Ionicons name="sunny" size={13} color={!theme.isDark ? theme.inverseText : theme.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.themeOpt, theme.isDark && { backgroundColor: theme.inverse }]}
              onPress={() => setMode('dark')}
              activeOpacity={0.7}
            >
              <Ionicons name="moon" size={13} color={theme.isDark ? theme.inverseText : theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={s.signOut} onPress={handleLogout}>
          <Text style={[s.signOutText, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>SIGN OUT</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView></DarkBackground>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1 },
  topBar:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, gap: 10 },
  nameLabel: { fontSize: 22, letterSpacing: -1 },
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
  actionRow: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, padding: 16 },
  actionEmoji: { fontSize: 22 },
  actionInfo: { flex: 1, gap: 3 },
  actionTitle: { fontSize: 12, letterSpacing: 1 },
  actionSub: { fontSize: 10 },
  themeToggle: { flexDirection: 'row', borderWidth: 1, borderRadius: 8, padding: 2, gap: 2 },
  themeOpt: { width: 32, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  signOut:   { alignItems: 'center', paddingVertical: 20 },
  signOutText: { fontSize: 9, letterSpacing: 4 },
});
