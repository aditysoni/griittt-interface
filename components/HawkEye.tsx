import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { habits, fuel, tasks, Task } from '../lib/api';
import { useTheme, AppTheme } from './ThemeContext';

// ── constants ──────────────────────────────────────────────────────────────────

const CIRCLE = 40;
const GAP    = 6;
const COLS   = 7;
const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const STORAGE_KEY = 'grittt_hawkeye_countdown';
const PRIMARY  = '#14110D'; // warm ink — overridden inline via theme where possible
const GREEN    = '#10B981';
const RED      = '#EF4444';

type HawkMode   = 'calendar' | 'countdown';
type FilterKind = 'none' | 'habit' | 'food';
type FoodMetric = 'quality' | 'junk' | 'meal';

type Overlay = 'done' | 'missed' | number | null;
type OverlayMap = Record<string, Overlay>;

// ── utils ──────────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10); }
function parseDate(s: string) { return new Date(s + 'T00:00:00'); }
function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstWeekday(y: number, m: number) { return (new Date(y, m, 1).getDay() + 6) % 7; }
function addMonths(base: Date, n: number) {
  const d = new Date(base); d.setDate(1); d.setMonth(d.getMonth() + n); return d;
}
function chunk<T>(arr: T[], size: number): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < arr.length; i += size) r.push(arr.slice(i, i + size));
  return r;
}
function qualityColor(q: number) {
  if (q <= 3) return RED;
  if (q <= 6) return '#F59E0B';
  return GREEN;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── DayCircle ──────────────────────────────────────────────────────────────────

type CircleState = 'future' | 'today' | 'past';

function DayCircle({
  label, state, overlay, theme,
}: { label: string; state: CircleState; overlay?: Overlay; theme: AppTheme }) {
  const today  = state === 'today';
  const past   = state === 'past';

  let bg = 'transparent';
  let borderColor = theme.border;
  let textColor = theme.textSecondary;
  let icon: React.ReactNode = null;
  let displayLabel = label;

  if (overlay !== undefined && overlay !== null) {
    if (typeof overlay === 'number') {
      bg = qualityColor(overlay) + '30';
      borderColor = qualityColor(overlay);
      textColor = qualityColor(overlay);
      displayLabel = String(overlay);
    } else if (overlay === 'done') {
      bg = GREEN + '25';
      borderColor = GREEN;
      textColor = GREEN;
      icon = <Text style={[dc.icon, { color: GREEN }]}>✓</Text>;
      displayLabel = '';
    } else if (overlay === 'missed') {
      bg = RED + '15';
      borderColor = RED + '60';
      textColor = RED + '60';
      icon = <Text style={[dc.icon, { color: RED + '80' }]}>✕</Text>;
      displayLabel = '';
    }
  } else if (today) {
    bg = theme.inverse;
    borderColor = theme.inverse;
    textColor = theme.inverseText;
  } else if (past) {
    bg = theme.surface;
    borderColor = theme.border;
    textColor = theme.textMuted;
    icon = <View style={dc.crossWrap}><Text style={[dc.cross, { color: theme.textMuted }]}>✕</Text></View>;
  }

  return (
    <View style={[dc.circle, { backgroundColor: bg, borderColor }]}>
      {!!displayLabel && <Text style={[dc.label, { color: textColor }]}>{displayLabel}</Text>}
      {icon}
    </View>
  );
}

const dc = StyleSheet.create({
  circle: {
    width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 12, fontWeight: '600' },
  icon: { fontSize: 16, fontWeight: '900', lineHeight: 18 },
  crossWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', borderRadius: CIRCLE / 2 },
  cross: { fontSize: 18, fontWeight: '900' },
});

// ── CalendarMonth ──────────────────────────────────────────────────────────────

function CalendarMonth({ year, month, overlayMap, theme }: {
  year: number; month: number; overlayMap?: OverlayMap; theme: AppTheme;
}) {
  const today   = todayStr();
  const total   = daysInMonth(year, month);
  const offset  = firstWeekday(year, month);
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={cs.month}>
      <Text style={[cs.monthLabel, { color: theme.text }]}>{MONTH_NAMES[month]} {year}</Text>
      <View style={cs.row}>
        {DAY_LABELS.map(d => (
          <Text key={d} style={[cs.dayHeader, { color: theme.textTertiary }]}>{d}</Text>
        ))}
      </View>
      {chunk(cells, 7).map((week, wi) => (
        <View key={wi} style={cs.row}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={{ width: CIRCLE, height: CIRCLE }} />;
            const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const state: CircleState = ds < today ? 'past' : ds === today ? 'today' : 'future';
            const overlay = overlayMap ? overlayMap[ds] : undefined;
            return <DayCircle key={di} label={String(day)} state={state} overlay={overlay} theme={theme} />;
          })}
        </View>
      ))}
    </View>
  );
}

const cs = StyleSheet.create({
  month: { marginBottom: 28 },
  monthLabel: { fontSize: 16, fontWeight: '800', marginBottom: 14 },
  row: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
  dayHeader: { width: CIRCLE, textAlign: 'center', fontSize: 10, fontWeight: '700' },
});

// ── CountdownGrid ──────────────────────────────────────────────────────────────

function CountdownGrid({ startDate, endDate, theme }: { startDate: string; endDate: string; theme: AppTheme }) {
  const today = todayStr();
  const start = parseDate(startDate);
  const end   = parseDate(endDate);
  const total = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (total <= 0) return null;

  const days = Array.from({ length: total }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    const state: CircleState = ds < today ? 'past' : ds === today ? 'today' : 'future';
    return { n: total - i, state };
  });

  const todayDate  = parseDate(today);
  const daysLeft   = Math.max(0, Math.round((end.getTime() - todayDate.getTime()) / 86400000) + 1);
  const daysDone   = days.filter(d => d.state === 'past').length;

  return (
    <View>
      {/* Date range banner */}
      <View style={[cg.dateBanner, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={cg.dateCell}>
          <Text style={[cg.dateCaption, { color: theme.textMuted }]}>START</Text>
          <Text style={[cg.dateVal, { color: theme.text }]}>{startDate}</Text>
        </View>
        <View style={[cg.dateSep, { backgroundColor: theme.border }]} />
        <View style={[cg.dateCell, { alignItems: 'center' }]}>
          <Text style={[cg.daysLeftNum, { color: theme.text }]}>{daysLeft}</Text>
          <Text style={[cg.daysLeftLabel, { color: theme.textMuted }]}>DAYS LEFT</Text>
        </View>
        <View style={[cg.dateSep, { backgroundColor: theme.border }]} />
        <View style={[cg.dateCell, { alignItems: 'flex-end' }]}>
          <Text style={[cg.dateCaption, { color: theme.textMuted }]}>END</Text>
          <Text style={[cg.dateVal, { color: theme.text }]}>{endDate}</Text>
        </View>
      </View>
      <View style={cg.header}>
        <Text style={[cg.info, { color: theme.textSecondary }]}>{daysDone} / {total} days done</Text>
        <Text style={[cg.done, { color: theme.text }]}>{Math.round((daysDone / total) * 100)}% complete</Text>
      </View>
      {chunk(days, COLS).map((row, ri) => (
        <View key={ri} style={cg.row}>
          {row.map(({ n, state }) => <DayCircle key={n} label={String(n)} state={state} theme={theme} />)}
          {Array.from({ length: COLS - row.length }).map((_, i) => (
            <View key={`p${i}`} style={{ width: CIRCLE, height: CIRCLE }} />
          ))}
        </View>
      ))}
    </View>
  );
}

const cg = StyleSheet.create({
  dateBanner:    { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16, alignItems: 'center' },
  dateCell:      { flex: 1 },
  dateCaption:   { fontSize: 9, letterSpacing: 2, marginBottom: 3 },
  dateVal:       { fontSize: 12, fontWeight: '700' },
  dateSep:       { width: 1, height: 36, marginHorizontal: 12 },
  daysLeftNum:   { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  daysLeftLabel: { fontSize: 8, letterSpacing: 2, marginTop: 2 },
  header:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  info:          { fontSize: 13, fontWeight: '600' },
  done:          { fontSize: 13, fontWeight: '700' },
  row:           { flexDirection: 'row', gap: GAP, marginBottom: GAP },
});

// ── Countdown Setup ────────────────────────────────────────────────────────────

const PRESETS = [21, 30, 60, 90, 100];

function CountdownSetup({ onSet, theme }: { onSet: (start: string, end: string) => void; theme: AppTheme }) {
  const [startInput, setStartInput] = useState(todayStr());
  const [endInput, setEndInput]     = useState('');
  const [duration, setDuration]     = useState(30);
  const [custom, setCustom]         = useState('');

  // Computed end date preview when no manual end date entered
  function computedEnd(): string {
    const s = parseDate(startInput);
    if (isNaN(s.getTime())) return '';
    const days = custom ? Number(custom) : duration;
    if (!days || days < 1) return '';
    const e = new Date(s); e.setDate(e.getDate() + days - 1);
    return e.toISOString().slice(0, 10);
  }

  function handleSet() {
    const s = parseDate(startInput);
    if (isNaN(s.getTime())) { Alert.alert('Invalid date', 'Use YYYY-MM-DD'); return; }
    if (endInput.trim()) {
      // End date entered directly
      const e = parseDate(endInput.trim());
      if (isNaN(e.getTime())) { Alert.alert('Invalid end date', 'Use YYYY-MM-DD'); return; }
      if (e.getTime() <= s.getTime()) { Alert.alert('Invalid range', 'End date must be after start'); return; }
      onSet(startInput, endInput.trim());
    } else {
      const days = custom ? Number(custom) : duration;
      if (!days || days < 1 || days > 3650) { Alert.alert('Invalid duration', '1–3650 days'); return; }
      const e = new Date(s); e.setDate(e.getDate() + days - 1);
      onSet(startInput, e.toISOString().slice(0, 10));
    }
  }

  return (
    <View style={[su.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[su.title, { color: theme.text }]}>Set Your Countdown</Text>
      <View style={su.field}>
        <Text style={[su.label, { color: theme.textSecondary }]}>Start Date (YYYY-MM-DD)</Text>
        <TextInput
          style={[su.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          value={startInput} onChangeText={setStartInput}
          placeholder="2026-05-09" placeholderTextColor={theme.textTertiary} autoCorrect={false}
        />
      </View>
      <View style={su.field}>
        <Text style={[su.label, { color: theme.textSecondary }]}>Duration</Text>
        <View style={su.presets}>
          {PRESETS.map(p => {
            const active = !custom && duration === p;
            return (
              <TouchableOpacity
                key={p}
                style={[
                  su.chip,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  active && { borderColor: theme.text, backgroundColor: theme.text + '18' },
                ]}
                onPress={() => { setDuration(p); setCustom(''); }}
              >
                <Text style={[su.chipText, { color: theme.textSecondary }, active && { color: theme.text, fontWeight: '700' }]}>{p}d</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TextInput
          style={[su.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, marginTop: 8 }]}
          value={custom} onChangeText={v => { setCustom(v); setEndInput(''); }}
          placeholder="Custom days..." placeholderTextColor={theme.textTertiary} keyboardType="number-pad"
        />
        {/* End date preview when duration chosen and no manual end set */}
        {!endInput && computedEnd() !== '' && (
          <View style={[su.endPreview, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[su.endPreviewLabel, { color: theme.textMuted }]}>END DATE →</Text>
            <Text style={[su.endPreviewVal, { color: theme.text }]}>{computedEnd()}</Text>
          </View>
        )}
      </View>
      <View style={su.field}>
        <Text style={[su.label, { color: theme.textSecondary }]}>Or set End Date directly (YYYY-MM-DD)</Text>
        <TextInput
          style={[su.input, { backgroundColor: theme.surface, borderColor: endInput ? theme.text : theme.border, color: theme.text }]}
          value={endInput} onChangeText={setEndInput}
          placeholder="e.g. 2026-08-01" placeholderTextColor={theme.textTertiary} autoCorrect={false}
        />
      </View>
      <TouchableOpacity style={su.btn} onPress={handleSet}>
        <Ionicons name="flag" size={16} color="#FFF" />
        <Text style={su.btnText}>Start Countdown</Text>
      </TouchableOpacity>
    </View>
  );
}

const su = StyleSheet.create({
  card: { borderRadius: 14, padding: 16, gap: 14, borderWidth: 1 },
  title: { fontSize: 15, fontWeight: '700' },
  field: { gap: 8 },
  label: { fontSize: 12, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  presets: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '600' },
  btn:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#14110D', borderRadius: 12, paddingVertical: 14 },
  btnText:         { color: '#FFF', fontSize: 14, fontWeight: '700' },
  endPreview:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 4 },
  endPreviewLabel: { fontSize: 9, letterSpacing: 2 },
  endPreviewVal:   { fontSize: 13, fontWeight: '700' },
});

// ── Filter Panel ───────────────────────────────────────────────────────────────

const FOOD_METRICS: { key: FoodMetric; label: string; desc: string }[] = [
  { key: 'quality', label: 'Meal Quality', desc: 'Color-coded 0–10 rating per day' },
  { key: 'junk',    label: 'Junk Food',    desc: '✓ avoided · ✕ had junk' },
  { key: 'meal',    label: 'Correct Meal', desc: '✓ stuck to it · ✕ didn\'t' },
];

function FilterPanel({
  token, taskList, theme,
  filterKind, setFilterKind,
  selectedHabit, setSelectedHabit,
  foodMetric, setFoodMetric,
}: {
  token: string;
  taskList: Task[];
  theme: AppTheme;
  filterKind: FilterKind;
  setFilterKind: (k: FilterKind) => void;
  selectedHabit: Task | null;
  setSelectedHabit: (t: Task | null) => void;
  foodMetric: FoodMetric;
  setFoodMetric: (m: FoodMetric) => void;
}) {
  return (
    <View style={fp.root}>
      {/* Kind selector */}
      <View style={[fp.kindRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {(['none', 'habit', 'food'] as FilterKind[]).map(k => {
          const active = filterKind === k;
          return (
            <TouchableOpacity
              key={k}
              style={[fp.kindBtn, active && { backgroundColor: theme.text + '20' }]}
              onPress={() => { setFilterKind(k); if (k !== 'habit') setSelectedHabit(null); }}
            >
              <Text style={[fp.kindText, { color: theme.textSecondary }, active && { color: theme.text, fontWeight: '700' }]}>
                {k === 'none' ? 'Calendar' : k === 'habit' ? '🏷 Habit' : '🥗 Food'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Habit list */}
      {filterKind === 'habit' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fp.hScroll}>
          {taskList.map(t => {
            const active = selectedHabit?.id === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[fp.habitChip, { backgroundColor: theme.card, borderColor: theme.border }, active && { borderColor: theme.text, backgroundColor: theme.text + '18' }]}
                onPress={() => setSelectedHabit(active ? null : t)}
              >
                <Text style={[fp.habitChipText, { color: theme.textSecondary }, active && { color: theme.text, fontWeight: '700' }]} numberOfLines={1}>
                  {t.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Food metrics */}
      {filterKind === 'food' && (
        <View style={fp.metricRow}>
          {FOOD_METRICS.map(m => {
            const active = foodMetric === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[fp.metricBtn, { backgroundColor: theme.card, borderColor: theme.border }, active && { borderColor: theme.text, backgroundColor: theme.text + '15' }]}
                onPress={() => setFoodMetric(m.key)}
              >
                <Text style={[fp.metricLabel, { color: theme.textSecondary }, active && { color: theme.text }]}>{m.label}</Text>
                <Text style={[fp.metricDesc, { color: theme.textTertiary }]}>{m.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const fp = StyleSheet.create({
  root: { paddingHorizontal: 16, gap: 10, marginBottom: 4 },
  kindRow: { flexDirection: 'row', borderRadius: 12, padding: 4, borderWidth: 1 },
  kindBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9 },
  kindText: { fontSize: 12, fontWeight: '600' },
  hScroll: { gap: 8, paddingVertical: 2 },
  habitChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  habitChipText: { fontSize: 13 },
  metricRow: { gap: 8 },
  metricBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 10, borderWidth: 1.5 },
  metricLabel: { fontSize: 13, fontWeight: '700' },
  metricDesc: { fontSize: 11 },
});

// ── Legend ─────────────────────────────────────────────────────────────────────

function LegendItem({ color, border, label, icon, crossed, theme }: { color: string; border: string; label: string; icon?: string; crossed?: boolean; theme: AppTheme }) {
  return (
    <View style={leg.item}>
      <View style={[leg.dot, { backgroundColor: color, borderColor: border }]}>
        {icon   && <Text style={{ fontSize: 9, color: border, fontWeight: '900' }}>{icon}</Text>}
        {crossed && <Text style={{ fontSize: 9, color: theme.textMuted, fontWeight: '900' }}>✕</Text>}
      </View>
      <Text style={[leg.label, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const leg = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10 },
});

// ── Main HawkEyeModal ──────────────────────────────────────────────────────────

type Props = { visible: boolean; onClose: () => void; token: string };

export function HawkEyeModal({ visible, onClose, token }: Props) {
  const { theme } = useTheme();
  const [mode, setMode]         = useState<HawkMode>('calendar');
  const [countdown, setCountdown] = useState<{ start: string; end: string } | null>(null);
  const [filterKind, setFilterKind]     = useState<FilterKind>('none');
  const [selectedHabit, setSelectedHabit] = useState<Task | null>(null);
  const [foodMetric, setFoodMetric]     = useState<FoodMetric>('quality');
  const [taskList, setTaskList]         = useState<Task[]>([]);
  const [overlayMap, setOverlayMap]     = useState<OverlayMap>({});
  const [overlayLoading, setOverlayLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const now = new Date();
  const rangeFrom = addMonths(now, -3).toISOString().slice(0, 10);
  const rangeTo   = todayStr();

  const months = Array.from({ length: 8 }, (_, i) => {
    const d = addMonths(now, i - 3);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => {
    if (!visible) return;
    tasks.list(token).then(list => setTaskList(list.filter(t => !t.archived_at))).catch(() => {});
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) try { setCountdown(JSON.parse(raw)); } catch {}
    });
  }, [visible, token]);

  useEffect(() => {
    if (visible && mode === 'calendar') {
      setTimeout(() => scrollRef.current?.scrollTo({ y: 3 * 340, animated: false }), 120);
    }
  }, [visible, mode]);

  useEffect(() => {
    if (filterKind === 'none') { setOverlayMap({}); return; }

    if (filterKind === 'habit') {
      if (!selectedHabit) { setOverlayMap({}); return; }
      setOverlayLoading(true);
      habits.history(token, selectedHabit.normalized_name, rangeFrom, rangeTo)
        .then(res => {
          const doneSet = new Set(res.dates);
          const map: OverlayMap = {};
          res.dates.forEach(d => { map[d] = 'done'; });
          eachDay(rangeFrom, rangeTo, ds => {
            if (!doneSet.has(ds)) map[ds] = 'missed';
          });
          setOverlayMap(map);
        })
        .catch(() => {})
        .finally(() => setOverlayLoading(false));
      return;
    }

    if (filterKind === 'food') {
      setOverlayLoading(true);
      fuel.history(token, rangeFrom, rangeTo)
        .then(rows => {
          const map: OverlayMap = {};
          rows.forEach(row => {
            if (foodMetric === 'quality') {
              map[row.date] = row.foodQuality ?? null;
            } else if (foodMetric === 'junk') {
              if (row.hadJunkFood !== null) map[row.date] = row.hadJunkFood ? 'missed' : 'done';
            } else {
              if (row.stuckToMeal !== null) map[row.date] = row.stuckToMeal ? 'done' : 'missed';
            }
          });
          setOverlayMap(map);
        })
        .catch(() => {})
        .finally(() => setOverlayLoading(false));
    }
  }, [filterKind, selectedHabit, foodMetric, token]);

  async function saveCountdown(start: string, end: string) {
    const c = { start, end };
    setCountdown(c);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  }

  async function clearCountdown() {
    setCountdown(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  function renderLegend() {
    if (filterKind === 'habit') return (
      <View style={m.legend}>
        <LegendItem color={GREEN + '25'} border={GREEN} label="Done" icon="✓" theme={theme} />
        <LegendItem color={RED + '15'} border={RED + '60'} label="Missed" icon="✕" theme={theme} />
        <LegendItem color="transparent" border={theme.border} label="Future" theme={theme} />
      </View>
    );
    if (filterKind === 'food' && foodMetric === 'quality') return (
      <View style={m.legend}>
        <LegendItem color={GREEN + '30'} border={GREEN} label="7–10 Great" theme={theme} />
        <LegendItem color="#F59E0B30" border="#F59E0B" label="4–6 Avg" theme={theme} />
        <LegendItem color={RED + '30'} border={RED} label="0–3 Poor" theme={theme} />
        <LegendItem color="transparent" border={theme.border} label="No data" theme={theme} />
      </View>
    );
    if (filterKind === 'food') return (
      <View style={m.legend}>
        <LegendItem color={GREEN + '25'} border={GREEN} label={foodMetric === 'junk' ? 'Avoided' : 'Stuck to it'} icon="✓" theme={theme} />
        <LegendItem color={RED + '15'} border={RED + '60'} label={foodMetric === 'junk' ? 'Had junk' : 'Didn\'t'} icon="✕" theme={theme} />
      </View>
    );
    return (
      <View style={m.legend}>
        <LegendItem color={theme.surface} border={theme.border} label="Past" crossed theme={theme} />
        <LegendItem color={theme.inverse} border={theme.inverse} label="Today" theme={theme} />
        <LegendItem color="transparent" border={theme.border} label="Future" theme={theme} />
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[m.root, { backgroundColor: theme.bg }]}>
        <View style={[m.handle, { backgroundColor: theme.border }]} />
        <View style={[m.header, { borderBottomColor: theme.border }]}>
          <Text style={[m.headerTitle, { color: theme.text }]}>🦅 Hawk Eye</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Mode toggle */}
        <View style={[m.modeBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {(['calendar', 'countdown'] as HawkMode[]).map(md => {
            const active = mode === md;
            return (
              <Pressable key={md} style={[m.modeBtn, active && { backgroundColor: theme.inverse }]} onPress={() => setMode(md)}>
                <Ionicons name={md === 'calendar' ? 'calendar-outline' : 'timer-outline'} size={14} color={active ? theme.inverseText : theme.textSecondary} />
                <Text style={[m.modeBtnText, { color: theme.textSecondary }, active && { color: theme.inverseText }]}>{md === 'calendar' ? 'Calendar' : 'Countdown'}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Filter panel — only in calendar mode */}
        {mode === 'calendar' && (
          <FilterPanel
            token={token}
            taskList={taskList}
            theme={theme}
            filterKind={filterKind} setFilterKind={setFilterKind}
            selectedHabit={selectedHabit} setSelectedHabit={setSelectedHabit}
            foodMetric={foodMetric} setFoodMetric={setFoodMetric}
          />
        )}

        {/* Legend */}
        {renderLegend()}

        {overlayLoading && (
          <View style={m.loadingRow}>
            <ActivityIndicator size="small" color={theme.text} />
            <Text style={[m.loadingText, { color: theme.textSecondary }]}>Loading history…</Text>
          </View>
        )}

        {/* Calendar content */}
        {mode === 'calendar' && (
          <ScrollView ref={scrollRef} contentContainerStyle={m.calScroll} showsVerticalScrollIndicator={false}>
            {months.map(({ year, month }) => (
              <CalendarMonth key={`${year}-${month}`} year={year} month={month} overlayMap={overlayMap} theme={theme} />
            ))}
          </ScrollView>
        )}

        {/* Countdown content */}
        {mode === 'countdown' && (
          <ScrollView contentContainerStyle={m.cdScroll} showsVerticalScrollIndicator={false}>
            {countdown ? (
              <>
                <View style={[m.cdInfo, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View>
                    <Text style={[m.cdLabel, { color: theme.textSecondary }]}>Started</Text>
                    <Text style={[m.cdDate, { color: theme.text }]}>{countdown.start}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={theme.textTertiary} />
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[m.cdLabel, { color: theme.textSecondary }]}>Ends</Text>
                    <Text style={[m.cdDate, { color: theme.text }]}>{countdown.end}</Text>
                  </View>
                  <TouchableOpacity style={m.resetBtn} onPress={() =>
                    Alert.alert('Reset Countdown', 'Clear this countdown?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Reset', style: 'destructive', onPress: clearCountdown },
                    ])
                  }>
                    <Ionicons name="refresh" size={16} color={theme.danger} />
                  </TouchableOpacity>
                </View>
                <CountdownGrid startDate={countdown.start} endDate={countdown.end} theme={theme} />
              </>
            ) : (
              <CountdownSetup onSet={saveCountdown} theme={theme} />
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const m = StyleSheet.create({
  root: { flex: 1, paddingTop: 8 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  modeBar: { flexDirection: 'row', margin: 16, marginBottom: 10, borderRadius: 12, padding: 4, borderWidth: 1 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 9 },
  modeBtnText: { fontSize: 13, fontWeight: '600' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  loadingText: { fontSize: 12 },
  calScroll: { paddingHorizontal: 16, paddingVertical: 16 },
  cdScroll: { padding: 16, gap: 20 },
  cdInfo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 12, padding: 14, gap: 8, borderWidth: 1,
  },
  cdLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  cdDate: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  resetBtn: { padding: 6 },
});

// iterate every past/today date in range
function eachDay(from: string, to: string, cb: (ds: string) => void) {
  const cur = parseDate(from);
  const end = parseDate(to);
  while (cur <= end) {
    cb(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
}
