import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { COLORS } from './theme';

// ── constants ──────────────────────────────────────────────────────────────────

const CIRCLE = 40;
const GAP    = 6;
const COLS   = 7;
const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const STORAGE_KEY = 'grittt_hawkeye_countdown';
const PRIMARY  = '#8B5CF6';
const GREEN    = '#10B981';
const RED      = '#EF4444';
const CROSSED  = '#1A1A2A';

type HawkMode   = 'calendar' | 'countdown';
type FilterKind = 'none' | 'habit' | 'food';
type FoodMetric = 'quality' | 'junk' | 'meal';

// overlay per day: 'done' | 'missed' | number (quality 0-10) | null (no data)
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
  label, state, overlay,
}: { label: string; state: CircleState; overlay?: Overlay }) {
  const today  = state === 'today';
  const past   = state === 'past';
  const hasData = overlay !== undefined && overlay !== null;

  // Determine bg + text + icon based on overlay
  let bg = 'transparent';
  let borderColor = COLORS.border;
  let textColor = COLORS.textSecondary;
  let icon: React.ReactNode = null;
  let displayLabel = label;

  if (overlay !== undefined && overlay !== null) {
    if (typeof overlay === 'number') {
      // Food quality: show quality number, color-coded background
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
    bg = PRIMARY;
    borderColor = PRIMARY;
    textColor = '#FFF';
  } else if (past) {
    bg = CROSSED;
    borderColor = '#2D2D42';
    textColor = '#3D3D55';
    icon = <View style={dc.crossWrap}><Text style={dc.cross}>✕</Text></View>;
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
  cross: { fontSize: 18, color: '#3D3D55', fontWeight: '900' },
});

// ── CalendarMonth ──────────────────────────────────────────────────────────────

function CalendarMonth({ year, month, overlayMap }: { year: number; month: number; overlayMap?: OverlayMap }) {
  const today   = todayStr();
  const total   = daysInMonth(year, month);
  const offset  = firstWeekday(year, month);
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={cs.month}>
      <Text style={cs.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
      <View style={cs.row}>
        {DAY_LABELS.map(d => <Text key={d} style={cs.dayHeader}>{d}</Text>)}
      </View>
      {chunk(cells, 7).map((week, wi) => (
        <View key={wi} style={cs.row}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={{ width: CIRCLE, height: CIRCLE }} />;
            const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const state: CircleState = ds < today ? 'past' : ds === today ? 'today' : 'future';
            const overlay = overlayMap ? overlayMap[ds] : undefined;
            return <DayCircle key={di} label={String(day)} state={state} overlay={overlay} />;
          })}
        </View>
      ))}
    </View>
  );
}

const cs = StyleSheet.create({
  month: { marginBottom: 28 },
  monthLabel: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 14 },
  row: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
  dayHeader: { width: CIRCLE, textAlign: 'center', fontSize: 10, fontWeight: '700', color: COLORS.textTertiary },
});

// ── CountdownGrid ──────────────────────────────────────────────────────────────

function CountdownGrid({ startDate, endDate }: { startDate: string; endDate: string }) {
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

  return (
    <View>
      <View style={cg.header}>
        <Text style={cg.info}>{total} → 1 days remaining</Text>
        <Text style={cg.done}>{days.filter(d => d.state === 'past').length} / {total} done</Text>
      </View>
      {chunk(days, COLS).map((row, ri) => (
        <View key={ri} style={cg.row}>
          {row.map(({ n, state }) => <DayCircle key={n} label={String(n)} state={state} />)}
          {Array.from({ length: COLS - row.length }).map((_, i) => (
            <View key={`p${i}`} style={{ width: CIRCLE, height: CIRCLE }} />
          ))}
        </View>
      ))}
    </View>
  );
}

const cg = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  info: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  done: { fontSize: 13, color: PRIMARY, fontWeight: '700' },
  row: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
});

// ── Countdown Setup ────────────────────────────────────────────────────────────

const PRESETS = [21, 30, 60, 90, 100];

function CountdownSetup({ onSet }: { onSet: (start: string, end: string) => void }) {
  const [startInput, setStartInput] = useState(todayStr());
  const [duration, setDuration] = useState(30);
  const [custom, setCustom] = useState('');

  function handleSet() {
    const s = parseDate(startInput);
    if (isNaN(s.getTime())) { Alert.alert('Invalid date', 'Use YYYY-MM-DD'); return; }
    const days = custom ? Number(custom) : duration;
    if (!days || days < 1 || days > 3650) { Alert.alert('Invalid duration', '1–3650 days'); return; }
    const e = new Date(s); e.setDate(e.getDate() + days - 1);
    onSet(startInput, e.toISOString().slice(0, 10));
  }

  return (
    <View style={su.card}>
      <Text style={su.title}>Set Your Countdown</Text>
      <View style={su.field}>
        <Text style={su.label}>Start Date (YYYY-MM-DD)</Text>
        <TextInput style={su.input} value={startInput} onChangeText={setStartInput} placeholder="2026-05-09" placeholderTextColor={COLORS.textTertiary} autoCorrect={false} />
      </View>
      <View style={su.field}>
        <Text style={su.label}>Duration</Text>
        <View style={su.presets}>
          {PRESETS.map(p => (
            <TouchableOpacity key={p} style={[su.chip, !custom && duration === p && su.chipActive]} onPress={() => { setDuration(p); setCustom(''); }}>
              <Text style={[su.chipText, !custom && duration === p && { color: PRIMARY, fontWeight: '700' }]}>{p}d</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={[su.input, { marginTop: 8 }]} value={custom} onChangeText={setCustom} placeholder="Custom days..." placeholderTextColor={COLORS.textTertiary} keyboardType="number-pad" />
      </View>
      <TouchableOpacity style={su.btn} onPress={handleSet}>
        <Ionicons name="flag" size={16} color="#FFF" />
        <Text style={su.btnText}>Start Countdown</Text>
      </TouchableOpacity>
    </View>
  );
}

const su = StyleSheet.create({
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, gap: 14, borderWidth: 1, borderColor: COLORS.border },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  field: { gap: 8 },
  label: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.text, fontSize: 14 },
  presets: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  chipActive: { borderColor: PRIMARY, backgroundColor: PRIMARY + '18' },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 14 },
  btnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});

// ── Filter Panel ───────────────────────────────────────────────────────────────

const FOOD_METRICS: { key: FoodMetric; label: string; desc: string }[] = [
  { key: 'quality', label: 'Meal Quality', desc: 'Color-coded 0–10 rating per day' },
  { key: 'junk',    label: 'Junk Food',    desc: '✓ avoided · ✕ had junk' },
  { key: 'meal',    label: 'Correct Meal', desc: '✓ stuck to it · ✕ didn\'t' },
];

function FilterPanel({
  token, taskList,
  filterKind, setFilterKind,
  selectedHabit, setSelectedHabit,
  foodMetric, setFoodMetric,
}: {
  token: string;
  taskList: Task[];
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
      <View style={fp.kindRow}>
        {(['none', 'habit', 'food'] as FilterKind[]).map(k => (
          <TouchableOpacity
            key={k}
            style={[fp.kindBtn, filterKind === k && fp.kindBtnActive]}
            onPress={() => { setFilterKind(k); if (k !== 'habit') setSelectedHabit(null); }}
          >
            <Text style={[fp.kindText, filterKind === k && { color: PRIMARY, fontWeight: '700' }]}>
              {k === 'none' ? 'Calendar' : k === 'habit' ? '🏷 Habit' : '🥗 Food'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Habit list */}
      {filterKind === 'habit' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fp.hScroll}>
          {taskList.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[fp.habitChip, selectedHabit?.id === t.id && fp.habitChipActive]}
              onPress={() => setSelectedHabit(selectedHabit?.id === t.id ? null : t)}
            >
              <Text style={[fp.habitChipText, selectedHabit?.id === t.id && { color: PRIMARY, fontWeight: '700' }]} numberOfLines={1}>
                {t.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Food metrics */}
      {filterKind === 'food' && (
        <View style={fp.metricRow}>
          {FOOD_METRICS.map(m => (
            <TouchableOpacity
              key={m.key}
              style={[fp.metricBtn, foodMetric === m.key && fp.metricBtnActive]}
              onPress={() => setFoodMetric(m.key)}
            >
              <Text style={[fp.metricLabel, foodMetric === m.key && { color: PRIMARY }]}>{m.label}</Text>
              <Text style={fp.metricDesc}>{m.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const fp = StyleSheet.create({
  root: { paddingHorizontal: 16, gap: 10, marginBottom: 4 },
  kindRow: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: COLORS.border },
  kindBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9 },
  kindBtnActive: { backgroundColor: PRIMARY + '20' },
  kindText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  hScroll: { gap: 8, paddingVertical: 2 },
  habitChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.card },
  habitChipActive: { borderColor: PRIMARY, backgroundColor: PRIMARY + '18' },
  habitChipText: { fontSize: 13, color: COLORS.textSecondary },
  metricRow: { gap: 8 },
  metricBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.card },
  metricBtnActive: { borderColor: PRIMARY, backgroundColor: PRIMARY + '15' },
  metricLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  metricDesc: { fontSize: 11, color: COLORS.textTertiary },
});

// ── Legend ─────────────────────────────────────────────────────────────────────

function LegendItem({ color, border, label, icon, crossed }: { color: string; border: string; label: string; icon?: string; crossed?: boolean }) {
  return (
    <View style={leg.item}>
      <View style={[leg.dot, { backgroundColor: color, borderColor: border }]}>
        {icon   && <Text style={{ fontSize: 9, color: border, fontWeight: '900' }}>{icon}</Text>}
        {crossed && <Text style={{ fontSize: 9, color: '#3D3D55', fontWeight: '900' }}>✕</Text>}
      </View>
      <Text style={leg.label}>{label}</Text>
    </View>
  );
}

const leg = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10, color: COLORS.textSecondary },
});

// ── Main HawkEyeModal ──────────────────────────────────────────────────────────

type Props = { visible: boolean; onClose: () => void; token: string };

export function HawkEyeModal({ visible, onClose, token }: Props) {
  const [mode, setMode]         = useState<HawkMode>('calendar');
  const [countdown, setCountdown] = useState<{ start: string; end: string } | null>(null);
  const [filterKind, setFilterKind]     = useState<FilterKind>('none');
  const [selectedHabit, setSelectedHabit] = useState<Task | null>(null);
  const [foodMetric, setFoodMetric]     = useState<FoodMetric>('quality');
  const [taskList, setTaskList]         = useState<Task[]>([]);
  const [overlayMap, setOverlayMap]     = useState<OverlayMap>({});
  const [overlayLoading, setOverlayLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Date range for data fetch (covers all visible months)
  const now = new Date();
  const rangeFrom = addMonths(now, -3).toISOString().slice(0, 10);
  const rangeTo   = todayStr();

  // Build list of months to show
  const months = Array.from({ length: 8 }, (_, i) => {
    const d = addMonths(now, i - 3);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Load tasks + countdown on open
  useEffect(() => {
    if (!visible) return;
    tasks.list(token).then(list => setTaskList(list.filter(t => !t.archived_at))).catch(() => {});
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) try { setCountdown(JSON.parse(raw)); } catch {}
    });
  }, [visible, token]);

  // Scroll to current month
  useEffect(() => {
    if (visible && mode === 'calendar') {
      setTimeout(() => scrollRef.current?.scrollTo({ y: 3 * 340, animated: false }), 120);
    }
  }, [visible, mode]);

  // Fetch overlay data when filter changes
  useEffect(() => {
    if (filterKind === 'none') { setOverlayMap({}); return; }

    if (filterKind === 'habit') {
      if (!selectedHabit) { setOverlayMap({}); return; }
      setOverlayLoading(true);
      habits.history(token, selectedHabit.normalized_name, rangeFrom, rangeTo)
        .then(res => {
          const doneSet = new Set(res.dates);
          const map: OverlayMap = {};
          // mark done
          res.dates.forEach(d => { map[d] = 'done'; });
          // mark missed for past days not in done set
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

  // Build dynamic legend
  function renderLegend() {
    if (filterKind === 'habit') return (
      <View style={m.legend}>
        <LegendItem color={GREEN + '25'} border={GREEN} label="Done" icon="✓" />
        <LegendItem color={RED + '15'} border={RED + '60'} label="Missed" icon="✕" />
        <LegendItem color="transparent" border={COLORS.border} label="Future" />
      </View>
    );
    if (filterKind === 'food' && foodMetric === 'quality') return (
      <View style={m.legend}>
        <LegendItem color={GREEN + '30'} border={GREEN} label="7–10 Great" />
        <LegendItem color="#F59E0B30" border="#F59E0B" label="4–6 Avg" />
        <LegendItem color={RED + '30'} border={RED} label="0–3 Poor" />
        <LegendItem color="transparent" border={COLORS.border} label="No data" />
      </View>
    );
    if (filterKind === 'food') return (
      <View style={m.legend}>
        <LegendItem color={GREEN + '25'} border={GREEN} label={foodMetric === 'junk' ? 'Avoided' : 'Stuck to it'} icon="✓" />
        <LegendItem color={RED + '15'} border={RED + '60'} label={foodMetric === 'junk' ? 'Had junk' : 'Didn\'t'} icon="✕" />
      </View>
    );
    return (
      <View style={m.legend}>
        <LegendItem color={'#1A1A2A'} border="#2D2D42" label="Past" crossed />
        <LegendItem color={PRIMARY} border={PRIMARY} label="Today" />
        <LegendItem color="transparent" border={COLORS.border} label="Future" />
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={m.root}>
        <View style={m.handle} />
        <View style={m.header}>
          <Text style={m.headerTitle}>🦅 Hawk Eye</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Mode toggle */}
        <View style={m.modeBar}>
          {(['calendar', 'countdown'] as HawkMode[]).map(md => (
            <Pressable key={md} style={[m.modeBtn, mode === md && m.modeBtnActive]} onPress={() => setMode(md)}>
              <Ionicons name={md === 'calendar' ? 'calendar-outline' : 'timer-outline'} size={14} color={mode === md ? '#FFF' : COLORS.textSecondary} />
              <Text style={[m.modeBtnText, mode === md && { color: '#FFF' }]}>{md === 'calendar' ? 'Calendar' : 'Countdown'}</Text>
            </Pressable>
          ))}
        </View>

        {/* Filter panel — only in calendar mode */}
        {mode === 'calendar' && (
          <FilterPanel
            token={token}
            taskList={taskList}
            filterKind={filterKind} setFilterKind={setFilterKind}
            selectedHabit={selectedHabit} setSelectedHabit={setSelectedHabit}
            foodMetric={foodMetric} setFoodMetric={setFoodMetric}
          />
        )}

        {/* Legend */}
        {renderLegend()}

        {overlayLoading && (
          <View style={m.loadingRow}>
            <ActivityIndicator size="small" color={PRIMARY} />
            <Text style={m.loadingText}>Loading history…</Text>
          </View>
        )}

        {/* Calendar content */}
        {mode === 'calendar' && (
          <ScrollView ref={scrollRef} contentContainerStyle={m.calScroll} showsVerticalScrollIndicator={false}>
            {months.map(({ year, month }) => (
              <CalendarMonth key={`${year}-${month}`} year={year} month={month} overlayMap={overlayMap} />
            ))}
          </ScrollView>
        )}

        {/* Countdown content */}
        {mode === 'countdown' && (
          <ScrollView contentContainerStyle={m.cdScroll} showsVerticalScrollIndicator={false}>
            {countdown ? (
              <>
                <View style={m.cdInfo}>
                  <View>
                    <Text style={m.cdLabel}>Started</Text>
                    <Text style={m.cdDate}>{countdown.start}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={COLORS.textTertiary} />
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={m.cdLabel}>Ends</Text>
                    <Text style={m.cdDate}>{countdown.end}</Text>
                  </View>
                  <TouchableOpacity style={m.resetBtn} onPress={() =>
                    Alert.alert('Reset Countdown', 'Clear this countdown?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Reset', style: 'destructive', onPress: clearCountdown },
                    ])
                  }>
                    <Ionicons name="refresh" size={16} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
                <CountdownGrid startDate={countdown.start} endDate={countdown.end} />
              </>
            ) : (
              <CountdownSetup onSet={saveCountdown} />
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const m = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 8 },
  handle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  modeBar: { flexDirection: 'row', margin: 16, marginBottom: 10, backgroundColor: COLORS.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: COLORS.border },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 9 },
  modeBtnActive: { backgroundColor: PRIMARY },
  modeBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  loadingText: { fontSize: 12, color: COLORS.textSecondary },
  calScroll: { paddingHorizontal: 16, paddingVertical: 16 },
  cdScroll: { padding: 16, gap: 20 },
  cdInfo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, gap: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cdLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  cdDate: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginTop: 2 },
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
