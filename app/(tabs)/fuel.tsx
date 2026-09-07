import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Modal, Platform,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { DarkBackground } from '../../components/DarkBackground';
import { QuickTrendCard } from '../../components/QuickTrendCard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { fuel, fuelQuestions, FuelQuestion, ai, FoodLog, FoodItem, MealTime, MacroTargets, today, shiftDate } from '../../lib/api';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorState } from '../../components/ErrorState';
import { DaySelector } from '../../components/DaySelector';
import { DateSwipe, useDateNav } from '../../components/DateSwipe';
import { useTheme } from '../../components/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import { AddCustomModal, QuestionDetailModal } from '../fuel-questions';

// ── Short card title per checklist question, matched by keyword in the prompt ──
const QUESTION_TITLES: Array<{ match: RegExp; title: string }> = [
  { match: /quality|clean/i,           title: 'Food Quality' },
  { match: /protein/i,                 title: 'Protein' },
  { match: /fibre|fiber/i,             title: 'Fibre' },
  { match: /hydrat|water/i,            title: 'Hydration' },
  { match: /junk|sugar/i,              title: 'Sugar' },
  { match: /digestion|bowel/i,         title: 'Digestion' },
  { match: /energy/i,                  title: 'Energy' },
  { match: /sleep/i,                   title: 'Sleep' },
  { match: /home.?cooked/i,            title: 'Home Cooked' },
  { match: /adherence|plan|diet/i,     title: 'Plan Adherence' },
  { match: /fruit|veg/i,               title: 'Fruit & Veg' },
];
function questionTitle(prompt: string): string {
  const preset = QUESTION_TITLES.find(v => v.match.test(prompt))?.title;
  if (preset) return preset;
  const words = prompt.replace(/[?.!]+$/, '').split(/\s+/);
  return words.slice(0, 3).join(' ');
}

type TabMode = 'quick' | 'detailed';
const QUALITY_LABELS = ['Terrible','Very poor','Poor','Below avg','Average','Average+','Good','Great','Excellent','Outstanding','Perfect'];

export default function FuelScreen() {
  const { token, user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState(today());
  const { goPrev, goNext, canPrev, canNext } = useDateNav(selectedDate, setSelectedDate);
  const [mode, setMode]                 = useState<TabMode>('quick');
  const [identity, setIdentity]         = useState<any>(null);
  const [logs, setLogs]                 = useState<FoodLog[]>([]);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [history, setHistory]           = useState<Array<{ date: string; score: number | null }>>([]);

  const tabAnim = useRef(new Animated.Value(0)).current;
  const [tabContainerW, setTabContainerW] = useState(0);

  function switchMode(tab: TabMode) {
    setMode(tab);
    Animated.spring(tabAnim, {
      toValue: tab === 'quick' ? 0 : 1,
      useNativeDriver: false,
      damping: 18,
      stiffness: 220,
      mass: 0.8,
    }).start();
  }

  // Quick mode state
  const [activeQuestions, setActiveQuestions] = useState<FuelQuestion[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, number>>({});
  const [customOpen, setCustomOpen] = useState(false);
  const [detailQuestion, setDetailQuestion] = useState<FuelQuestion | null>(null);

  // Detailed mode state (food items)
  const [foodItems, setFoodItems]       = useState<FoodItem[]>([]);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [recentFoods, setRecentFoods]   = useState<FoodItem[]>([]);

  const isToday = selectedDate === today();
  // Logging is allowed for today and any past day — not days that haven't happened yet.
  const canLog  = selectedDate <= today();

  const todayScore = history.find(h => h.date === selectedDate)?.score ?? 0;

  async function load(date: string) {
    if (!token) return;
    const from = shiftDate(today(), -13);
    const results = await Promise.allSettled([
      fuel.identity(token),
      fuel.logs(token, date),
      fuel.items(token, date),
      fuelQuestions.scoreRange(token, from, date),
      fuelQuestions.catalog(token),
      fuelQuestions.getResponses(token, date),
    ]);
    // Items + logs are the core of this screen — if both fail it's a load error.
    if (results[1].status === 'rejected' && results[2].status === 'rejected') {
      setLoadError(true);
      return;
    }
    setLoadError(false);
    const val = <T,>(i: number, fb: T): T =>
      results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<T>).value : fb;
    setIdentity(val(0, null as any));
    setLogs(val(1, [] as any));
    const items = val(2, [] as FoodItem[]);
    setFoodItems(items);
    // Grow a session-local "recently eaten" list, deduped by name, newest first — used as
    // log-food recommendations. No dedicated backend endpoint for this, so it's built up
    // client-side from whatever days the user has viewed this session.
    if (items.length > 0) {
      setRecentFoods(prev => {
        const merged = [...items, ...prev];
        const seen = new Set<string>();
        const deduped: FoodItem[] = [];
        for (const it of merged) {
          const key = it.name.trim().toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          deduped.push(it);
        }
        return deduped.slice(0, 20);
      });
    }
    const scoreRange = val(3, null as any);
    const scoreDays: Array<{ date: string; checklistScore: number | null }> =
      scoreRange?.days ?? (scoreRange ? [scoreRange] : []);
    setHistory(scoreDays.map(d => ({ date: d.date, score: d.checklistScore })));

    const catalog = val(4, [] as FuelQuestion[]);
    setActiveQuestions(catalog.filter(q => q.selected));
    const responses = val(5, null as any);
    const prefilled: Record<string, number> = {};
    for (const a of responses?.answers ?? []) prefilled[a.questionId] = a.optionIndex;
    setQuestionAnswers(prefilled);
  }

  async function deleteItem(id: string) {
    if (!token) return;
    try {
      await fuel.deleteItem(token, id);
      setFoodItems(prev => prev.filter(i => i.id !== id));
    } catch (err: any) { Alert.alert('Error', err.message); }
  }

  async function updateItem(item: FoodItem, patch: { calories?: number; protein?: number; fat?: number; carbs?: number }) {
    if (!token) return;
    try {
      // Single round-trip via PUT /fuel/items/:id (replaced the old delete-then-readd dance).
      await fuel.editItem(token, item.id, patch);
      await load(selectedDate);
    } catch (err: any) { Alert.alert('Error', err.message); }
  }

  useEffect(() => { load(selectedDate).finally(() => setLoading(false)); }, [token, selectedDate]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(selectedDate); setRefreshing(false); }, [token, selectedDate]);

  async function submitQuick() {
    if (!token || activeQuestions.length === 0) return;
    const missingRequired = activeQuestions.some(q => q.required && questionAnswers[q.id] === undefined);
    if (missingRequired) { Alert.alert('INCOMPLETE', 'Answer all required questions.'); return; }
    setSubmitting(true);
    try {
      await fuelQuestions.submitResponses(token, {
        date: selectedDate,
        answers: Object.entries(questionAnswers).map(([questionId, optionIndex]) => ({ questionId, optionIndex })),
      });
      await load(selectedDate);
      // Follow the check-in straight into the food log sheet so the user can add
      // today's meals/macros in one flow, without a separate "Detailed" tap.
      setLogModalOpen(true);
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setSubmitting(false); }
  }

  if (loading) return <LoadingScreen />;

  return (
    <DarkBackground><SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.topBar}>
        <View>
          <Text style={[s.modeLabel, { color: theme.text, fontFamily: 'Inter_900Black' }]}>FUEL MODE</Text>
          <Text style={[s.eatClean, { color: theme.text, fontFamily: 'Inter_900Black' }]}>EAT CLEAN</Text>
        </View>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={[s.topIcon, { borderColor: theme.border }]} onPress={() => router.push('/(tabs)/ai')}>
          <Ionicons name="sparkles" size={15} color="#34C759" />
        </TouchableOpacity>
        <TouchableOpacity style={[s.topIcon, { borderColor: theme.border }]} onPress={() => router.push('/(tabs)/profile')}>
          <Ionicons name="settings-outline" size={15} color={theme.text} />
        </TouchableOpacity>
      </View>
      <View style={s.datesRow}>
        <DaySelector selectedDate={selectedDate} onSelect={setSelectedDate} />
      </View>

      <DateSwipe onPrev={goPrev} onNext={goNext} canPrev={canPrev} canNext={canNext}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />}>
        {mode === 'quick' ? (
          <QuickTrendCard
            eyebrow="TODAY'S FUEL SCORE"
            score={todayScore}
            history={history}
            selectedDate={selectedDate}
            identity={identity}
          />
        ) : (
          <FuelScoreCard
            score={todayScore}
            history={history}
            selectedDate={selectedDate}
            theme={theme}
            foodItems={foodItems}
            macroTargets={user?.macroTargets ?? MACRO_TARGETS}
          />
        )}

        {/* QUICK / DETAILED toggle — under the overview card */}
        <View
          style={[s.tabToggle, { backgroundColor: theme.surface }]}
          onLayout={e => setTabContainerW(e.nativeEvent.layout.width)}
        >
          {tabContainerW > 0 && (
            <Animated.View style={[s.tabPill, {
              backgroundColor: theme.card,
              width: (tabContainerW - 8) / 2,
              transform: [{ translateX: tabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, (tabContainerW - 8) / 2] }) }],
            }]} />
          )}
          <TouchableOpacity style={s.tabBtn} onPress={() => switchMode('quick')} activeOpacity={0.8}>
            <Text style={[s.tabBtnText, { color: mode === 'quick' ? theme.text : theme.textSecondary, fontFamily: 'Inter_900Black' }]}>QUICK</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.tabBtn} onPress={() => switchMode('detailed')} activeOpacity={0.8}>
            <Text style={[s.tabBtnText, { color: mode === 'detailed' ? theme.text : theme.textSecondary, fontFamily: 'Inter_900Black' }]}>DETAILED</Text>
          </TouchableOpacity>
        </View>

        {loadError && (
          <ErrorState
            message="Couldn't load your fuel log."
            onRetry={() => { setLoading(true); load(selectedDate).finally(() => setLoading(false)); }}
          />
        )}

        {!loadError && <>
        {/* QUICK */}
        {mode === 'quick' && canLog && (
          <>
            {/* Selected fuel questions (from Fuel Questions management screen) */}
            {activeQuestions.map((q) => {
              const answered = questionAnswers[q.id] !== undefined;
              return (
                <View key={q.id} style={[qcs.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={qcs.cardTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[qcs.title, { color: theme.text, fontFamily: 'Inter_800ExtraBold' }]}>
                        {questionTitle(q.prompt)}{q.required && <Text style={{ color: theme.danger }}> *</Text>}
                      </Text>
                      <Text style={[qcs.subtitle, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                        {q.prompt}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <View style={[qcs.ptsPill, { backgroundColor: answered ? theme.text : theme.surface }]}>
                        <Text style={[qcs.ptsText, { color: answered ? theme.bg : theme.textSecondary, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                          +{q.weight} pts
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {(q.streak ?? 0) > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Ionicons name="flame" size={11} color="#F0A12E" />
                            <Text style={[qcs.streakText, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_700Bold' }]}>{q.streak}</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          onPress={() => setDetailQuestion(q)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="stats-chart-outline" size={13} color={theme.textTertiary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={qcs.optionsRow}>
                    {q.options.map((opt, oi) => {
                      const active = questionAnswers[q.id] === oi;
                      return (
                        <TouchableOpacity
                          key={oi}
                          onPress={() => setQuestionAnswers(prev => ({ ...prev, [q.id]: oi }))}
                          activeOpacity={0.75}
                          style={[qcs.optionChip, {
                            backgroundColor: active ? theme.text : 'transparent',
                            borderColor: active ? theme.text : theme.borderStrong,
                          }]}
                        >
                          <Ionicons
                            name={active ? 'radio-button-on' : 'radio-button-off'}
                            size={13}
                            color={active ? theme.bg : theme.textSecondary}
                          />
                          <Text style={{
                            fontSize: 12, letterSpacing: 0.1, fontFamily: 'Inter_600SemiBold',
                            color: active ? theme.bg : theme.textSecondary,
                          }}>
                            {opt}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            <TouchableOpacity
              style={[qcs.addCustomBtn, { borderColor: theme.border }]}
              onPress={() => setCustomOpen(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle" size={18} color="#34C759" />
              <Text style={[qcs.addCustomText, { color: theme.text, fontFamily: 'Inter_800ExtraBold' }]}>
                Add custom question
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.logFuelBtn, {
                backgroundColor: theme.text,
                opacity: (activeQuestions.length === 0 || submitting) ? 0.4 : 1,
              }]}
              onPress={submitQuick}
              disabled={activeQuestions.length === 0 || submitting}
              activeOpacity={0.85}
            >
              <Text style={[s.logFuelBtnText, { color: '#FFFFFF', fontFamily: 'Inter_900Black' }]}>
                {submitting ? 'LOGGING...' : 'LOG FUEL'}
              </Text>
              <View style={s.logFuelArrow}>
                <Ionicons name="arrow-forward" size={12} color={theme.text} />
              </View>
            </TouchableOpacity>

            <AddCustomModal
              open={customOpen}
              token={token!}
              theme={theme}
              onClose={() => setCustomOpen(false)}
              onSaved={() => { setCustomOpen(false); load(selectedDate); }}
            />

            <QuestionDetailModal
              question={detailQuestion}
              token={token!}
              theme={theme}
              onClose={() => setDetailQuestion(null)}
            />
          </>
        )}

        {/* ── DETAILED: opens the log-food sheet (camera / manual entry / recommendations) ── */}
        {mode === 'detailed' && canLog && (
          <TouchableOpacity
            style={[s.logFuelBtn, { backgroundColor: theme.text }]}
            onPress={() => setLogModalOpen(true)}
            activeOpacity={0.85}
          >
            <Text style={[s.logFuelBtnText, { color: '#FFFFFF', fontFamily: 'Inter_900Black' }]}>LOG FOOD</Text>
            <View style={s.logFuelArrow}>
              <Ionicons name="add" size={16} color={theme.text} />
            </View>
          </TouchableOpacity>
        )}

        <LogFoodModal
          open={logModalOpen}
          token={token!}
          date={selectedDate}
          theme={theme}
          recentFoods={recentFoods}
          onClose={() => setLogModalOpen(false)}
          onSaved={() => { setLogModalOpen(false); load(selectedDate); }}
        />

        {/* ── QUICK: show food_logs entries only ── */}
        {mode === 'quick' && (
          <>
            {!canLog && logs.length === 0 && (
              <View style={s.empty}><Text style={[s.emptyText, { color: theme.textSecondary }]}>NO FUEL DATA FOR THIS DAY</Text></View>
            )}
            {logs.length > 0 && (
              <>
                <View style={s.sectionHeader}>
                  <Text style={[s.sectionTitle, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>LOGGED MEALS</Text>
                  <Text style={[s.sectionCount, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_500Medium' }]}>{String(logs.length).padStart(2,'0')} ENTRIES</Text>
                </View>
                {logs.map(log => <MealRow key={log.id} log={log} theme={theme} />)}
              </>
            )}
          </>
        )}

        {/* ── DETAILED: show food items with macros ── */}
        {mode === 'detailed' && (
          <>
            {!canLog && foodItems.length === 0 && (
              <View style={s.empty}><Text style={[s.emptyText, { color: theme.textSecondary }]}>NO FOOD LOGGED FOR THIS DAY</Text></View>
            )}
            {foodItems.length > 0 && (
              <>
                <View style={s.sectionHeader}>
                  <Text style={[s.sectionTitle, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>WHAT YOU ATE</Text>
                  <Text style={[s.sectionCount, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_500Medium' }]}>{String(foodItems.length).padStart(2,'0')} ITEMS</Text>
                </View>
                {foodItems.map(item => (
                  <FoodItemCard
                    key={item.id}
                    item={item}
                    theme={theme}
                    onDelete={canLog ? () => deleteItem(item.id) : undefined}
                    onUpdate={canLog ? (patch) => updateItem(item, patch) : undefined}
                  />
                ))}
              </>
            )}
          </>
        )}
        </>}

      </ScrollView>
      </DateSwipe>
    </SafeAreaView></DarkBackground>
  );
}

function fuelStatus(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'CRUSHING IT', color: '#22A664' };
  if (score >= 60) return { label: 'CONSISTENT',  color: '#0A84FF' };
  if (score >= 40) return { label: 'SHOWING UP',  color: '#F0A12E' };
  return { label: 'SLIPPING', color: '#E84A4A' };
}


function ScoreRing({ score, color, theme }: { score: number; color: string; theme: any }) {
  const size = 92, stroke = 9, r = (size - stroke) / 2, c = r * 2 * Math.PI;
  const pct = Math.max(0, Math.min(1, score / 100));
  const trackColor = theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        {pct > 0 && (
          <Circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={color} strokeWidth={stroke} fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - pct)}
            strokeLinecap="round"
            rotation={-90}
            originX={size / 2} originY={size / 2}
          />
        )}
      </Svg>
      <Text style={{ fontSize: 26, color: theme.text, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: -1 }}>{score}</Text>
      <Text style={{ fontSize: 9, color: theme.textSecondary, fontFamily: 'Inter_700Bold', letterSpacing: 1 }}>/100</Text>
    </View>
  );
}

function TrendSparkline({ points, color, theme, width = 220, height = 40 }: {
  points: Array<{ date: string; score: number | null }>;
  color: string; theme: any; width?: number; height?: number;
}) {
  const known = points
    .map((p, i) => ({ i, score: p.score }))
    .filter((p): p is { i: number; score: number } => p.score != null);

  if (known.length < 2) {
    return (
      <View style={{ width, height, justifyContent: 'center' }}>
        <View style={{ height: 1, backgroundColor: theme.border }} />
      </View>
    );
  }

  const minI = 0, maxI = points.length - 1;
  const scores = known.map(k => k.score);
  const lo = Math.min(...scores, 40), hi = Math.max(...scores, 80);
  const xFor = (i: number) => (i - minI) / (maxI - minI || 1) * width;
  const yFor = (v: number) => height - ((v - lo) / (hi - lo || 1)) * height;

  const d = known.map((k, idx) => `${idx === 0 ? 'M' : 'L'} ${xFor(k.i).toFixed(1)} ${yFor(k.score).toFixed(1)}`).join(' ');
  const last = known[known.length - 1];

  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={xFor(last.i)} cy={yFor(last.score)} r={3.5} fill={color} />
    </Svg>
  );
}

function FuelScoreCard({ score, history, selectedDate, theme, foodItems, macroTargets }: {
  score: number;
  history: Array<{ date: string; score: number | null }>;
  selectedDate: string;
  theme: any;
  foodItems: FoodItem[];
  macroTargets: MacroTargets;
}) {
  const last7 = React.useMemo(() => {
    const days: { date: string; score: number | null }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = shiftDate(selectedDate, -i);
      const found = history.find(h => h.date === d);
      days.push({ date: d, score: found?.score ?? null });
    }
    return days;
  }, [history, selectedDate]);

  const status = fuelStatus(score);

  const macroCells = React.useMemo(() => {
    const totals = foodItems.reduce(
      (a, i) => ({
        calories: a.calories + (i.calories ?? 0),
        protein:  a.protein  + (i.protein  ?? 0),
        carbs:    a.carbs    + (i.carbs    ?? 0),
        fat:      a.fat      + (i.fat      ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
    return [
      { key: 'calories', label: 'CALORIES', unit: 'kcal', value: Math.round(totals.calories), target: macroTargets.calories, color: MACRO_COLORS.calories },
      { key: 'protein',  label: 'PROTEIN',   unit: 'g',    value: Math.round(totals.protein),  target: macroTargets.protein,  color: MACRO_COLORS.protein },
      { key: 'carbs',    label: 'CARBS',     unit: 'g',    value: Math.round(totals.carbs),    target: macroTargets.carbs,    color: MACRO_COLORS.carbs },
      { key: 'fat',      label: 'FAT',       unit: 'g',    value: Math.round(totals.fat),      target: macroTargets.fat,      color: MACRO_COLORS.fat },
    ];
  }, [foodItems, macroTargets]);

  const percentile = React.useMemo(() => {
    const prior = history.filter(h => h.date !== selectedDate && h.score != null).map(h => h.score as number);
    if (prior.length === 0) return null;
    const beaten = prior.filter(v => v <= score).length;
    return Math.round((beaten / prior.length) * 100);
  }, [history, selectedDate, score]);

  return (
    <View style={[sc.card, { backgroundColor: theme.isDark ? '#1A1A1A' : '#FFFFFF', borderColor: theme.border }]}>
      {/* Top row: ring left, macro numbers right */}
      <View style={sc.top}>
        <ScoreRing score={score} color={status.color} theme={theme} />

        <View style={sc.macroGrid}>
          {macroCells.map(m => (
            <View key={m.key} style={sc.macroCell}>
              <Text numberOfLines={1}>
                <Text style={[sc.macroValue, { color: m.color, fontFamily: 'SpaceGrotesk_700Bold' }]}>{m.value}</Text>
                <Text style={[sc.macroUnit, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}> {m.unit}</Text>
              </Text>
              <Text style={[sc.macroLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                {m.label} · /{m.target}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Divider */}
      <View style={[sc.divider, { backgroundColor: theme.border }]} />

      {/* 7-day trend sparkline */}
      <View style={sc.trendBlock}>
        <Text style={[sc.trendLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>7-DAY TREND</Text>
        <TrendSparkline points={last7} color={status.color} theme={theme} />
      </View>

      {percentile != null && (
        <>
          <View style={[sc.divider, { backgroundColor: theme.border }]} />
          <Text style={[sc.percentileText, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
            You're eating cleaner than <Text style={{ color: theme.text, fontFamily: 'Inter_800ExtraBold' }}>{percentile}%</Text> of your recent days.
          </Text>
        </>
      )}
    </View>
  );
}

const sc = StyleSheet.create({
  card:         { marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  top:          { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 16 },
  eyebrow:      { fontSize: 10, letterSpacing: 2 },
  macroGrid:    { flex: 1, marginLeft: 16, flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, columnGap: 12 },
  macroCell:    { width: '47%' },
  macroValue:   { fontSize: 17, letterSpacing: -0.3 },
  macroUnit:    { fontSize: 10 },
  macroLabel:   { fontSize: 8.5, letterSpacing: 1, marginTop: 2 },
  divider:      { height: 1, marginHorizontal: 0 },
  trendBlock:   { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  trendLabel:   { fontSize: 9, letterSpacing: 2 },
  percentileText: { fontSize: 13, lineHeight: 19, paddingHorizontal: 16, paddingVertical: 14 },
});


const MACRO_TARGETS = { calories: 2000, protein: 150, fat: 65, carbs: 250 };
const MACRO_COLORS  = { calories: '#FF9500', protein: '#0A84FF', fat: '#FFD60A', carbs: '#34C759', fibre: '#30B0C7' };

const MEAL_TIME_ICONS: Record<string, string> = {
  morning: '🌅', brunch: '☕', lunch: '🥗', evening: '🌆', dinner: '🍽️', snacks: '🍎',
};

function LogFoodModal({ open, token, date, theme, recentFoods, onClose, onSaved }: {
  open: boolean; token: string; date: string; theme: any;
  recentFoods: FoodItem[];
  onClose: () => void; onSaved: () => void;
}) {
  const [itemName, setItemName]         = useState('');
  const [itemMealTime, setItemMealTime] = useState<MealTime>('morning');
  const [itemCalories, setItemCalories] = useState('');
  const [itemProtein, setItemProtein]   = useState('');
  const [itemFat, setItemFat]           = useState('');
  const [itemCarbs, setItemCarbs]       = useState('');
  const [itemFibre, setItemFibre]       = useState('');
  const [addingItem, setAddingItem]     = useState(false);
  const [scanning, setScanning]         = useState(false);

  function reset() {
    setItemName(''); setItemMealTime('morning');
    setItemCalories(''); setItemProtein(''); setItemFat(''); setItemCarbs(''); setItemFibre('');
  }

  function applyRecommendation(item: FoodItem) {
    setItemName(item.name);
    setItemMealTime(item.mealTime);
    setItemCalories(item.calories != null ? String(Math.round(item.calories)) : '');
    setItemProtein(item.protein  != null ? String(Math.round(item.protein))  : '');
    setItemFat(item.fat          != null ? String(Math.round(item.fat))      : '');
    setItemCarbs(item.carbs      != null ? String(Math.round(item.carbs))    : '');
    setItemFibre(item.fibre      != null ? String(Math.round(item.fibre))    : '');
  }

  async function handleSnapTrack(source: 'camera' | 'gallery') {
    const fn = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    let perms;
    if (source === 'camera') {
      perms = await ImagePicker.requestCameraPermissionsAsync();
    } else {
      perms = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }
    if (!perms.granted) { Alert.alert('Permission needed', 'Allow access in Settings.'); return; }

    const result = await fn({ mediaTypes: 'images' as any, quality: 0.7, base64: true, allowsEditing: true, aspect: [4, 3] });
    if (result.canceled || !result.assets?.[0]?.base64) return;

    setScanning(true);
    try {
      const data = await ai.snapTrack(token, `data:image/jpeg;base64,${result.assets[0].base64!}`);

      if (!data.name || data.name === 'Unknown food') {
        Alert.alert('No food detected', 'Try a clearer photo with better lighting, or enter the food manually.');
        return;
      }

      setItemName(data.name);
      setItemCalories(data.calories > 0 ? String(Math.round(data.calories)) : '');
      setItemProtein(data.protein   > 0 ? String(Math.round(data.protein))  : '');
      setItemCarbs(data.carbs       > 0 ? String(Math.round(data.carbs))    : '');
      const fatVal = (data as any).fat ?? data.fats ?? 0;
      setItemFat(fatVal > 0 ? String(Math.round(fatVal)) : '');

      if (!data.calories && !data.protein && !data.carbs) {
        Alert.alert('Food identified', `Found "${data.name}" but couldn't estimate nutrition. Fill in the values manually.`);
      }
    } catch (err: any) {
      const msg = err.message?.includes('No food') || err.status === 422
        ? 'No food detected. Try a clearer photo or better lighting.'
        : `Scan failed: ${err.message}`;
      Alert.alert('Snap Track', msg);
    }
    finally { setScanning(false); }
  }

  async function handleSubmit() {
    if (!itemName.trim()) { Alert.alert('INCOMPLETE', 'Enter a food name.'); return; }
    setAddingItem(true);
    try {
      await fuel.addItem(token, {
        date,
        name: itemName.trim(),
        mealTime: itemMealTime,
        calories: itemCalories ? Number(itemCalories) : undefined,
        protein:  itemProtein  ? Number(itemProtein)  : undefined,
        fat:      itemFat      ? Number(itemFat)      : undefined,
        carbs:    itemCarbs    ? Number(itemCarbs)    : undefined,
        fibre:    itemFibre    ? Number(itemFibre)    : undefined,
      });
      reset();
      onSaved();
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setAddingItem(false); }
  }

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[lm.sheet, { backgroundColor: theme.bg }]}>
        <View style={[lm.handle, { backgroundColor: theme.border }]} />
        <View style={[lm.header, { borderBottomColor: theme.border }]}>
          <Text style={[lm.title, { color: theme.text, fontFamily: 'Inter_900Black' }]}>LOG FOOD</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Ionicons name="close" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={lm.body} keyboardShouldPersistTaps="handled">
          {/* Snap row */}
          <View style={s.snapRow}>
            <TouchableOpacity
              style={[s.snapBtn, { borderColor: theme.border, backgroundColor: theme.isDark ? '#1E1E1E' : '#FFFFFF', opacity: scanning ? 0.6 : 1 }]}
              onPress={() => handleSnapTrack('camera')}
              disabled={scanning}
              activeOpacity={0.7}
            >
              {scanning
                ? <ActivityIndicator size="small" color={theme.text} />
                : <Ionicons name="camera" size={18} color={theme.text} />}
              <Text style={[s.snapBtnText, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>
                {scanning ? 'ANALYSING...' : 'SNAP & TRACK'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.snapBtnSm, { borderColor: theme.border, backgroundColor: theme.isDark ? '#1E1E1E' : '#FFFFFF' }]}
              onPress={() => handleSnapTrack('gallery')}
              disabled={scanning}
              activeOpacity={0.7}
            >
              <Ionicons name="images-outline" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={s.orRow}>
            <View style={[s.orLine, { backgroundColor: theme.border }]} />
            <Text style={[s.orText, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>OR ENTER MANUALLY</Text>
            <View style={[s.orLine, { backgroundColor: theme.border }]} />
          </View>

          {/* Food name */}
          <View style={[s.foodNameBox, { borderColor: theme.border, backgroundColor: theme.isDark ? '#1E1E1E' : '#FFFFFF' }]}>
            <Ionicons name="fast-food-outline" size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={[s.foodNameInput, { color: theme.text, fontFamily: 'Inter_700Bold', includeFontPadding: false }]}
              value={itemName}
              onChangeText={setItemName}
              placeholder="Food name..."
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="words"
              textAlignVertical="center"
            />
          </View>

          {/* Nutrition — manual macro entry, filled automatically by Snap & Track or a recommendation */}
          <Text style={[s.detailFieldLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>NUTRITION (OPTIONAL)</Text>
          <View style={[lm.nutritionCard, { borderColor: theme.border, backgroundColor: theme.isDark ? '#1E1E1E' : '#FFFFFF' }]}>
            <View style={lm.nutritionGrid}>
              {([
                { key: 'calories', label: 'CALORIES', unit: 'kcal', icon: '🔥', value: itemCalories, setValue: setItemCalories, color: MACRO_COLORS.calories },
                { key: 'protein',  label: 'PROTEIN',   unit: 'g',    icon: '💪', value: itemProtein,  setValue: setItemProtein,  color: MACRO_COLORS.protein },
                { key: 'carbs',    label: 'CARBS',      unit: 'g',    icon: '🌾', value: itemCarbs,    setValue: setItemCarbs,    color: MACRO_COLORS.carbs },
                { key: 'fibre',    label: 'FIBRE',      unit: 'g',    icon: '🌱', value: itemFibre,    setValue: setItemFibre,    color: MACRO_COLORS.fibre },
              ] as const).map((f, i) => (
                <View
                  key={f.key}
                  style={[lm.nutritionCell,
                    i % 2 === 1 && { borderLeftWidth: 1, borderLeftColor: theme.border },
                    i >= 2      && { borderTopWidth: 1, borderTopColor: theme.border },
                  ]}
                >
                  <View style={lm.nutritionLabelRow}>
                    <Text style={lm.nutritionIcon}>{f.icon}</Text>
                    <Text style={[lm.nutritionLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{f.label}</Text>
                  </View>
                  <View style={lm.nutritionInputRow}>
                    <TextInput
                      style={[lm.nutritionInput, { color: f.value ? f.color : theme.textTertiary, fontFamily: 'SpaceGrotesk_700Bold' }]}
                      value={f.value}
                      onChangeText={f.setValue}
                      placeholder="0"
                      placeholderTextColor={theme.textTertiary}
                      keyboardType="decimal-pad"
                    />
                    <Text style={[lm.nutritionUnit, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>{f.unit}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Recommendations from past logged food */}
          {recentFoods.length > 0 && (
            <>
              <Text style={[s.detailFieldLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>RECENTLY EATEN</Text>
              <View style={lm.recRow}>
                {recentFoods.slice(0, 10).map(f => (
                  <TouchableOpacity
                    key={f.id}
                    style={[lm.recChip, { borderColor: theme.border, backgroundColor: theme.isDark ? '#1E1E1E' : '#FFFFFF' }]}
                    onPress={() => applyRecommendation(f)}
                    activeOpacity={0.7}
                  >
                    <Text style={lm.recChipEmoji}>{MEAL_TIME_ICONS[f.mealTime]}</Text>
                    <Text style={[lm.recChipText, { color: theme.text, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={1}>
                      {f.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Meal time chips */}
          <Text style={[s.detailFieldLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>WHEN</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.mealTimeRow}>
            {(['morning','brunch','lunch','evening','dinner','snacks'] as MealTime[]).map(mealTimeOpt => (
              <TouchableOpacity
                key={mealTimeOpt}
                style={[s.mealChip, {
                  backgroundColor: itemMealTime === mealTimeOpt ? theme.text : (theme.isDark ? '#1E1E1E' : '#FFFFFF'),
                  borderColor: itemMealTime === mealTimeOpt ? theme.text : theme.border,
                }]}
                onPress={() => setItemMealTime(mealTimeOpt)}
                activeOpacity={0.7}
              >
                <Text style={s.mealChipEmoji}>{MEAL_TIME_ICONS[mealTimeOpt]}</Text>
                <Text style={[s.mealChipLabel, {
                  color: itemMealTime === mealTimeOpt ? theme.bg : theme.textSecondary,
                  fontFamily: 'Inter_700Bold',
                }]}>{mealTimeOpt.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: theme.tabActiveBg, opacity: (!itemName.trim() || addingItem) ? 0.4 : 1 }]}
            onPress={handleSubmit}
            disabled={!itemName.trim() || addingItem}
          >
            <Text style={[s.submitBtnText, { color: theme.tabActiveText, fontFamily: 'Inter_900Black' }]}>
              {addingItem ? 'SAVING...' : 'LOG FOOD →'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const lm = StyleSheet.create({
  sheet:        { flex: 1, paddingTop: 8 },
  handle:       { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  title:        { fontSize: 13, letterSpacing: 2 },
  body:         { paddingBottom: 40 },
  recRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  recChip:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1, maxWidth: 180 },
  recChipEmoji: { fontSize: 12 },
  recChipText:  { fontSize: 12, flexShrink: 1 },
  nutritionCard:     { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  nutritionGrid:     { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  nutritionCell:     { width: '50%', padding: 14, gap: 6 },
  nutritionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nutritionIcon:     { fontSize: 13 },
  nutritionLabel:    { fontSize: 9, letterSpacing: 1.2 },
  nutritionInputRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  nutritionInput:    { fontSize: 20, letterSpacing: -0.3, minWidth: 44, paddingVertical: 0 },
  nutritionUnit:     { fontSize: 10 },
});

function FoodItemCard({ item, theme, onDelete, onUpdate }: {
  item: FoodItem; theme: any;
  onDelete?: () => void;
  onUpdate?: (patch: { calories?: number; protein?: number; fat?: number; carbs?: number }) => void;
}) {
  const [cal,  setCal]  = React.useState(item.calories != null ? String(Math.round(item.calories)) : '');
  const [pro,  setPro]  = React.useState(item.protein  != null ? String(Math.round(item.protein))  : '');
  const [carb, setCarb] = React.useState(item.carbs    != null ? String(Math.round(item.carbs))    : '');
  const [fat,  setFat]  = React.useState(item.fat      != null ? String(Math.round(item.fat))      : '');
  const [focused, setFocused] = React.useState<string | null>(null);
  const [saving, setSaving]   = React.useState(false);

  const calRef  = React.useRef<TextInput>(null);
  const proRef  = React.useRef<TextInput>(null);
  const carbRef = React.useRef<TextInput>(null);
  const fatRef  = React.useRef<TextInput>(null);

  const origCal  = item.calories != null ? String(Math.round(item.calories)) : '';
  const origPro  = item.protein  != null ? String(Math.round(item.protein))  : '';
  const origCarb = item.carbs    != null ? String(Math.round(item.carbs))    : '';
  const origFat  = item.fat      != null ? String(Math.round(item.fat))      : '';
  const isDirty  = cal !== origCal || pro !== origPro || carb !== origCarb || fat !== origFat;

  async function handleSave() {
    if (!onUpdate || saving) return;
    setSaving(true);
    await onUpdate({
      calories: cal  ? Number(cal)  : undefined,
      protein:  pro  ? Number(pro)  : undefined,
      carbs:    carb ? Number(carb) : undefined,
      fat:      fat  ? Number(fat)  : undefined,
    });
    setSaving(false);
  }

  const macroFields = [
    { key: 'cal',  label: 'CAL',   val: cal,  setVal: setCal,  ref: calRef,  unit: 'kcal', color: MACRO_COLORS.calories, icon: '🔥' },
    { key: 'pro',  label: 'PRO',   val: pro,  setVal: setPro,  ref: proRef,  unit: 'g',    color: MACRO_COLORS.protein,  icon: '💪' },
    { key: 'carb', label: 'CARBS', val: carb, setVal: setCarb, ref: carbRef, unit: 'g',    color: MACRO_COLORS.carbs,    icon: '🌾' },
    { key: 'fat',  label: 'FAT',   val: fat,  setVal: setFat,  ref: fatRef,  unit: 'g',    color: MACRO_COLORS.fat,      icon: '🥑' },
  ];

  return (
    <View style={[fi.itemCard, { borderColor: theme.border, backgroundColor: theme.isDark ? '#1E1E1E' : '#FFFFFF' }]}>
      {/* Header */}
      <View style={fi.itemHeader}>
        <View style={[fi.mealTimeBadge, { backgroundColor: theme.surface }]}>
          <Text style={fi.mealTimeEmoji}>{MEAL_TIME_ICONS[item.mealTime]}</Text>
          <Text style={[fi.mealTimeText, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
            {item.mealTime.toUpperCase()}
          </Text>
        </View>
        <Text style={[fi.itemName, { color: theme.text, fontFamily: 'Inter_700Bold' }]} numberOfLines={1}>{item.name}</Text>
        {onDelete && (
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={14} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[fi.itemDivider, { backgroundColor: theme.border }]} />

      {/* Tappable macro grid */}
      <View style={fi.macroGrid}>
        {macroFields.map((f, i) => {
          const isFocused = focused === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[fi.macroCell,
                i % 2 === 1 && { borderLeftColor: theme.border, borderLeftWidth: 1 },
                i >= 2      && { borderTopColor: theme.border, borderTopWidth: 1 },
                isFocused   && { backgroundColor: f.color + '12' },
              ]}
              onPress={() => f.ref.current?.focus()}
              activeOpacity={0.75}
            >
              <View style={fi.macroCellTop}>
                <Text style={fi.macroCellIcon}>{f.icon}</Text>
                <Text style={[fi.macroCellLabel, { color: isFocused ? f.color : theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                  {f.label}
                </Text>
              </View>
              <View style={fi.macroCellInputRow}>
                <TextInput
                  ref={f.ref}
                  style={[fi.macroCellInput, { color: f.val ? f.color : theme.textTertiary, fontFamily: 'SpaceGrotesk_700Bold' }]}
                  value={f.val}
                  onChangeText={f.setVal}
                  onFocus={() => setFocused(f.key)}
                  onBlur={() => setFocused(null)}
                  placeholder="—"
                  placeholderTextColor={theme.textTertiary}
                  keyboardType="decimal-pad"
                />
                <Text style={[fi.macroCellUnit, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>{f.unit}</Text>
              </View>
              {isFocused && (
                <View style={[fi.macroCellLine, { backgroundColor: f.color }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Save button */}
      {isDirty && onUpdate && (
        <>
          <View style={[fi.itemDivider, { backgroundColor: theme.border }]} />
          <TouchableOpacity
            style={[fi.saveBtn, { opacity: saving ? 0.5 : 1 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={[fi.saveBtnText, { color: theme.text, fontFamily: 'Inter_900Black' }]}>
              {saving ? 'SAVING...' : 'SAVE CHANGES →'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const fi = StyleSheet.create({
  // item cards
  itemCard:        { marginHorizontal: 16, marginTop: 8, borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  itemHeader:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  mealTimeBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  mealTimeEmoji:   { fontSize: 13 },
  mealTimeText:    { fontSize: 8, letterSpacing: 1.5 },
  itemName:        { flex: 1, fontSize: 14, letterSpacing: 0.2 },
  itemDivider:     { height: 1 },
  macroGrid:       { flexDirection: 'row', flexWrap: 'wrap' },
  macroCell:       { width: '50%', padding: 14, gap: 6, position: 'relative' },
  macroCellTop:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  macroCellIcon:   { fontSize: 14 },
  macroCellLabel:  { fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' },
  macroCellInputRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  macroCellInput:  { fontSize: 24, letterSpacing: -0.5, minWidth: 50, paddingVertical: 0 },
  macroCellUnit:   { fontSize: 10 },
  macroCellLine:   { position: 'absolute', bottom: 0, left: 14, right: 14, height: 2, borderRadius: 1 },
  saveBtn:         { paddingVertical: 12, alignItems: 'center' },
  saveBtnText:     { fontSize: 10, letterSpacing: 3 },
});

function MealRow({ log, theme }: { log: FoodLog; theme: any }) {
  const time = log.createdAt
    ? new Date(log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';
  const isQuick = log.mode === 'simple';

  return (
    <View style={[mr.card, { borderColor: theme.border }]}>
      {/* ── Header ── */}
      <View style={mr.header}>
        <View style={[mr.badge, { backgroundColor: theme.text }]}>
          <Ionicons name="checkmark" size={9} color={theme.bg} />
        </View>
        <Text style={[mr.title, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>
          {isQuick ? 'QUICK LOG' : 'NUTRITION LOG'}
        </Text>
        <View style={{ flex: 1 }} />
        {!!time && (
          <Text style={[mr.time, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>{time}</Text>
        )}
        <View style={[mr.scorePill, { backgroundColor: theme.surfaceStrong }]}>
          <Text style={[mr.scoreText, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>+{log.score}</Text>
        </View>
      </View>

      <View style={[mr.divider, { backgroundColor: theme.border }]} />

      {/* ── Quick log answers ── */}
      {isQuick && (
        <View style={mr.body}>
          <LogAnswerRow
            label="CORRECT MEAL"
            value={log.hadThreeMeals}
            positiveIsGood
            theme={theme}
          />
          <View style={[mr.rowSep, { backgroundColor: theme.border }]} />
          <LogAnswerRow
            label="JUNK FOOD"
            value={log.hadJunkFood}
            positiveIsGood={false}
            theme={theme}
          />
          {log.foodQuality != null && (
            <>
              <View style={[mr.rowSep, { backgroundColor: theme.border }]} />
              <View style={mr.answerRow}>
                <Text style={[mr.answerLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>FOOD QUALITY</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                  <Text style={[mr.answerVal, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>{log.foodQuality}/10</Text>
                  <Text style={[mr.answerSub, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>{QUALITY_LABELS[log.foodQuality]}</Text>
                </View>
              </View>
            </>
          )}
        </View>
      )}

      {/* ── Detailed log stats ── */}
      {!isQuick && (
        <View style={mr.body}>
          {log.calories != null && (
            <LogStatRow label="CALORIES" value={Math.round(log.calories)} unit="kcal" target={log.calorieTarget != null ? Math.round(log.calorieTarget) : null} theme={theme} />
          )}
          {log.protein != null && (
            <>
              <View style={[mr.rowSep, { backgroundColor: theme.border }]} />
              <LogStatRow label="PROTEIN" value={Math.round(log.protein)} unit="g" target={log.proteinTarget != null ? Math.round(log.proteinTarget) : null} theme={theme} />
            </>
          )}
          {log.mealsLogged != null && (
            <>
              <View style={[mr.rowSep, { backgroundColor: theme.border }]} />
              <LogStatRow label="MEALS EATEN" value={log.mealsLogged} unit="" target={log.expectedMeals ?? null} theme={theme} />
            </>
          )}
          {log.junkMeals != null && (
            <>
              <View style={[mr.rowSep, { backgroundColor: theme.border }]} />
              <LogStatRow label="JUNK MEALS" value={log.junkMeals} unit="" target={null} theme={theme} />
            </>
          )}
          {!!log.notes && (
            <Text style={[mr.notes, { color: theme.textSecondary, fontFamily: 'Inter_400Regular', borderTopColor: theme.border }]}>{log.notes}</Text>
          )}
        </View>
      )}
    </View>
  );
}

function LogAnswerRow({ label, value, positiveIsGood, theme }: { label: string; value: boolean | null; positiveIsGood: boolean; theme: any }) {
  if (value === null) return null;
  const isGood = positiveIsGood ? value === true : value === false;
  const color  = isGood ? '#34C759' : '#FF453A';
  return (
    <View style={mr.answerRow}>
      <Text style={[mr.answerLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Ionicons name={isGood ? 'checkmark-circle' : 'close-circle'} size={13} color={color} />
        <Text style={[mr.answerVal, { color, fontFamily: 'SpaceGrotesk_700Bold' }]}>{value ? 'YES' : 'NO'}</Text>
      </View>
    </View>
  );
}

function LogStatRow({ label, value, unit, target, theme }: { label: string; value: number; unit: string; target: number | null; theme: any }) {
  return (
    <View style={mr.answerRow}>
      <Text style={[mr.answerLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text style={[mr.answerVal, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>{value}</Text>
        {!!unit && <Text style={[mr.answerSub, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>{unit}</Text>}
        {target != null && (
          <Text style={[mr.answerSub, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
            {' '}/ {target}{unit}
          </Text>
        )}
      </View>
    </View>
  );
}

const mr = StyleSheet.create({
  card:       { marginHorizontal: 16, marginTop: 10, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  badge:      { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 10, letterSpacing: 2 },
  time:       { fontSize: 10, letterSpacing: 0.5 },
  scorePill:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  scoreText:  { fontSize: 11 },
  divider:    { height: 1 },
  body:       { paddingHorizontal: 16, paddingVertical: 4 },
  answerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  answerLabel:{ fontSize: 9, letterSpacing: 2 },
  answerVal:  { fontSize: 13 },
  answerSub:  { fontSize: 10 },
  rowSep:     { height: 1 },
  notes:      { fontSize: 11, letterSpacing: 0.3, paddingTop: 10, paddingBottom: 6, borderTopWidth: 1, fontStyle: 'italic' },
});

const qcs = StyleSheet.create({
  card:         { marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderRadius: 18, padding: 16, position: 'relative' },
  cardTopRow:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 10 },
  title:        { fontSize: 15, letterSpacing: 0.1 },
  subtitle:     { fontSize: 12, marginTop: 3, letterSpacing: 0.1 },
  ptsPill:      { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  ptsText:      { fontSize: 11 },
  streakText:   { fontSize: 11 },
  optionsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5 },
  addCustomBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 14, paddingVertical: 14, borderRadius: 16,
    borderWidth: 1.5, borderStyle: 'dashed',
  },
  addCustomText:{ fontSize: 13 },
});

const s = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6, gap: 10 },
  modeLabel: { fontSize: 10, letterSpacing: 1.5 },
  eatClean:  { fontSize: 22, letterSpacing: 2, marginTop: 2 },
  topIcon: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  datesRow: { paddingHorizontal: 14, paddingBottom: 8 },
  scroll: { paddingBottom: 120 },
  tabToggle: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 4, padding: 4, borderRadius: 14, height: 46, position: 'relative' },
  tabPill: { position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: 10 },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  tabBtnText: { fontSize: 12, letterSpacing: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 0 },
  sectionTitle: { fontSize: 9, letterSpacing: 3 },
  sectionCount: { fontSize: 9 },
  questionRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1 },
  checkbox: { width: 20, height: 20, borderWidth: 1.5, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  qBox: { width: 20, height: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  qBoxNum: { fontSize: 11 },
  qInfo: { flex: 1, gap: 3 },
  qLabel: { fontSize: 14, letterSpacing: 0.3 },
  qSub: { fontSize: 10, letterSpacing: 0.5, fontStyle: 'italic' },
  qAnswer: { fontSize: 16 },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1 },
  pickerChip: { width: 44, height: 44, borderWidth: 1.5, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  pickerChipText: { fontSize: 14 },
  detailBlock: { marginHorizontal: 24, borderWidth: 1, marginTop: 16 },
  divider: { height: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14 },
  inputLabel: { fontSize: 9, letterSpacing: 2, flex: 1 },
  inputPair: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputField: { fontSize: 18, width: 80, textAlign: 'right', borderBottomWidth: 1, paddingBottom: 2 },
  inputSep: { width: 1, height: 20 },
  targetBlock: { alignItems: 'flex-end', gap: 1 },
  targetLabel: { fontSize: 7, letterSpacing: 2 },
  targetField: { fontSize: 12, width: 48, textAlign: 'right' },
  notesInput: { marginHorizontal: 24, marginTop: 12, borderWidth: 1, padding: 14, fontSize: 12, letterSpacing: 1, minHeight: 60, textAlignVertical: 'top' },
  submitBtn:      { marginHorizontal: 16, marginTop: 14, paddingVertical: 14, alignItems: 'center', borderRadius: 12 },
  submitBtnText:  { fontSize: 10, letterSpacing: 4 },
  logFuelBtn:     { marginHorizontal: 16, marginTop: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14 },
  logFuelBtnText: { fontSize: 12, letterSpacing: 3 },
  logFuelArrow:   { width: 22, height: 22, borderRadius: 11, backgroundColor: '#B8F23A', alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 9, letterSpacing: 3 },
  // detailed form
  detailedWrap:     { paddingBottom: 8 },
  snapRow:          { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, gap: 10 },
  snapBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 14, backgroundColor: 'transparent' },
  snapBtnText:      { fontSize: 11, letterSpacing: 2 },
  snapBtnSm:        { width: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12 },
  orRow:            { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 16, gap: 10 },
  orLine:           { flex: 1, height: 1 },
  orText:           { fontSize: 8, letterSpacing: 2 },
  foodNameBox:      { flexDirection: 'row', alignItems: 'center', minHeight: 52, marginHorizontal: 16, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  foodNameInput:    { flex: 1, fontSize: 15, lineHeight: 20, paddingVertical: 0 },
  detailFieldLabel: { fontSize: 8, letterSpacing: 2.5, marginHorizontal: 16, marginBottom: 10 },
  mealTimeRow:      { paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  mealChip:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderRadius: 10 },
  mealChipEmoji:    { fontSize: 13 },
  mealChipLabel:    { fontSize: 9, letterSpacing: 1.5 },
  macroGroup:       { marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  macroHairline:    { height: 1 },
  macroRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  macroIcon:        { fontSize: 18 },
  macroLabel:       { flex: 1, fontSize: 14 },
  macroInputWrap:   { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  macroInput:       { fontSize: 20, minWidth: 60, textAlign: 'right' },
  macroUnit:        { fontSize: 11 },
});
