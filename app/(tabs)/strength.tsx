import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DarkBackground } from '../../components/DarkBackground';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import {
  strength, WorkoutLog, today,
  BodyPart, SetEntry, ExerciseEntry, TrainingType,
  BODY_PARTS, EXERCISE_SUGGESTIONS, SPORTS_SUGGESTIONS,
} from '../../lib/api';
import { LoadingScreen } from '../../components/LoadingScreen';
import { DaySelector } from '../../components/DaySelector';
import { useTheme } from '../../components/ThemeContext';

const RATING_LABELS = ['Rest','Very light','Light','Easy','Moderate','Medium','Good','Strong','Very strong','Excellent','Elite'];

function ratingColor(r: number): string {
  if (r <= 3) return '#E84A4A';
  if (r <= 6) return '#F0A12E';
  return '#22A664';
}

const BODY_PART_COLORS: Record<string, string> = {
  chest:     '#FF6B6B',
  back:      '#4ECDC4',
  shoulders: '#FFD93D',
  legs:      '#6BCB77',
  biceps:    '#4D96FF',
  triceps:   '#C77DFF',
  abs:       '#F0A12E',
  cardio:    '#34C759',
};

const TRAINING_TYPES: { key: TrainingType; label: string; icon: string; sub: string; tint: string }[] = [
  { key: 'gym',    label: 'GYM',        icon: '🏋️', sub: 'Pick a body part', tint: '#EAF2FF' },
  { key: 'sports', label: 'SPORTS',     icon: '🏀', sub: 'Pick a sport',      tint: '#FFF1E5' },
  { key: 'cardio', label: 'RUN / WALK', icon: '🏃', sub: 'Time & distance',   tint: '#E2F7EC' },
];

const RATING_TIERS = [
  { upTo: 2,  label: 'WRECKED', copy: 'Tough one. Recovery is the work today.' },
  { upTo: 4,  label: 'LOW',     copy: 'Showed up. That counts.' },
  { upTo: 6,  label: 'STEADY',  copy: 'Solid effort — kept the streak alive.' },
  { upTo: 8,  label: 'STRONG',  copy: 'Real work today. You earned this.' },
  { upTo: 10, label: 'ELITE',   copy: "Top tier. Don't stop now." },
];

function RatingDial({ value, max = 10, eyebrow, label, copy, lowLabel, highLabel, big = true, theme, onPress, onChange }: {
  value: number; max?: number; eyebrow: string; label: string;
  copy?: string; lowLabel: string; highLabel: string;
  big?: boolean; theme: any; onPress?: () => void; onChange?: (v: number) => void;
}) {
  const pct   = value / max;
  const numSz = big ? 68 : 36;

  // Refs so PanResponder closure always sees latest values
  const barRef    = useRef<View>(null);
  const barX      = useRef(0);
  const barW      = useRef(0);
  const changeRef = useRef(onChange);
  const maxRef    = useRef(max);
  useEffect(() => { changeRef.current = onChange; }, [onChange]);
  useEffect(() => { maxRef.current    = max;      }, [max]);

  const calcVal = (pageX: number) => {
    const pct2 = Math.max(0, Math.min(1, (pageX - barX.current) / barW.current));
    return Math.max(1, Math.min(maxRef.current, Math.round(pct2 * (maxRef.current - 1)) + 1));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: ()        => true,
      onMoveShouldSetPanResponder:  (_, s)    => Math.abs(s.dx) > 2,
      onPanResponderTerminationRequest:       () => false,
      onPanResponderGrant: (e) => { changeRef.current?.(calcVal(e.nativeEvent.pageX)); },
      onPanResponderMove:  (e) => { changeRef.current?.(calcVal(e.nativeEvent.pageX)); },
    })
  ).current;

  const onBarLayout = useCallback(() => {
    barRef.current?.measure((_, __, w, ___, px) => { barX.current = px; barW.current = w; });
  }, []);

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 9, letterSpacing: 2.5, color: theme.textMuted, fontFamily: 'Inter_700Bold' }}>{eyebrow}</Text>
        <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: theme.surface }}>
          <Text style={{ fontSize: 9, letterSpacing: 2, color: theme.text, fontFamily: 'Inter_900Black' }}>{label}</Text>
        </View>
      </View>

      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: big ? 10 : 6 }}>
        <Text style={{ fontSize: numSz, letterSpacing: -3, lineHeight: numSz, color: theme.text, fontFamily: 'Inter_900Black' }}>{value}</Text>
        <Text style={{ fontSize: big ? 20 : 14, color: theme.textMuted, paddingBottom: big ? 8 : 4, fontFamily: 'Inter_500Medium' }}>/{max}</Text>
      </TouchableOpacity>

      {copy && (
        <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 8, lineHeight: 17, fontFamily: 'Inter_500Medium' }}>{copy}</Text>
      )}

      {/* Slideable dial */}
      <View style={{ marginTop: big ? 18 : 12 }}>
        <View
          ref={barRef}
          style={{ height: 44 }}
          onLayout={onBarLayout}
          {...pan.panHandlers}
        >
          {/* Track */}
          <View style={{ position: 'absolute', left: 0, right: 0, top: 20, height: 4, borderRadius: 2, backgroundColor: theme.surface }} />
          {/* Fill */}
          <View style={{ position: 'absolute', left: 0, top: 20, height: 4, borderRadius: 2, width: `${pct * 100}%` as any, backgroundColor: theme.text }} />
          {/* Ticks */}
          <View style={{ position: 'absolute', left: 0, right: 0, top: 18, flexDirection: 'row', justifyContent: 'space-between' }}>
            {Array.from({ length: max + 1 }).map((_, i) => (
              <View key={i} style={{ width: 1.5, height: 8, borderRadius: 1, backgroundColor: i / max <= pct ? theme.text : theme.surface }} />
            ))}
          </View>
          {/* Knob */}
          {barW.current > 0 && (
            <View style={{
              position: 'absolute',
              left: `${pct * 100}%` as any,
              marginLeft: -11,
              top: 11,
              width: 22, height: 22, borderRadius: 11,
              backgroundColor: theme.card, borderWidth: 2.5, borderColor: theme.text,
              shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 }, elevation: 5,
            }} />
          )}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ fontSize: 9, letterSpacing: 1.5, color: theme.textMuted, fontFamily: 'Inter_700Bold' }}>{lowLabel}</Text>
          <Text style={{ fontSize: 9, letterSpacing: 1.5, color: theme.textMuted, fontFamily: 'Inter_700Bold' }}>{highLabel}</Text>
        </View>
      </View>
    </View>
  );
}

function shiftDateStr(base: string, days: number) {
  const d = new Date(base); d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function StrengthScreen() {
  const { token } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState(today());
  const [logs, setLogs]                 = useState<WorkoutLog[]>([]);
  // date → max strength score for that day (null when no session logged)
  const [history, setHistory]           = useState<Record<string, number | null>>({});
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [submitting, setSubmitting]     = useState(false);

  // Rating
  const [rating, setRating] = useState(7);
  const [detailLog, setDetailLog] = useState<WorkoutLog | null>(null);
  const [showRatingPicker, setShowRatingPicker] = useState(false);

  // QUICK = rating dial, DETAILED = full session (gym/sports/cardio)
  const [strengthMode, setStrengthMode] = useState<'quick' | 'detailed'>('quick');

  // Training type selected from the inline row
  const [trainingType, setTrainingType] = useState<TrainingType | null>(null);

  // GYM flow
  const [activeBodyPart, setActiveBodyPart] = useState<BodyPart | null>(null);
  const [exerciseList, setExerciseList]     = useState<ExerciseEntry[]>([]);
  const [exName, setExName]                 = useState('');
  const [exSets, setExSets]                 = useState<SetEntry[]>([]);
  const [setReps, setSetReps]               = useState('');
  const [setWeight, setSetWeight]           = useState('');

  // SPORTS flow
  const [sportName, setSportName]           = useState('');
  const [sportDuration, setSportDuration]   = useState('');
  const [sportIntensity, setSportIntensity] = useState(7);

  // CARDIO flow
  const [cardioActivity, setCardioActivity] = useState<'Running' | 'Walking'>('Running');
  const [cardioDistance, setCardioDistance] = useState('');
  const [cardioDuration, setCardioDuration] = useState('');
  const [cardioIntensity, setCardioIntensity] = useState(6);

  const isToday = selectedDate === today();

  async function load(date: string) {
    if (!token) return;
    const dayLogs = await strength.logs(token, date).catch(() => []);
    setLogs(dayLogs);

    // 14-day history via the bulk endpoint — one round-trip instead of the
    // 14 parallel /strength/logs calls we used before. Backgrounded so the
    // main screen render is never blocked.
    const todayStr = today();
    const from = shiftDateStr(todayStr, -13);
    strength.history(token, from, todayStr)
      .then(rows => {
        const map: Record<string, number | null> = {};
        rows.forEach(r => { map[r.date] = r.score; });
        setHistory(map);
      })
      .catch(() => {});
  }
  useEffect(() => { load(selectedDate).finally(() => setLoading(false)); }, [token, selectedDate]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(selectedDate); setRefreshing(false); }, [token, selectedDate]);

  // Today's score = max of today's session scores, or 0 if nothing logged.
  const todayScore = logs.length > 0 ? Math.max(...logs.map(l => l.score ?? 0)) : 0;

  // ── Quick log ────────────────────────────────────────────────────────────────
  async function submitQuick() {
    if (!token) return;
    setSubmitting(true);
    try {
      await strength.log(token, { mode: 'simple', date: selectedDate, rating, streak: 0 });
      await load(selectedDate);
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setSubmitting(false); }
  }

  // ── GYM helpers ─────────────────────────────────────────────────────────────
  function openBodyPart(bp: BodyPart) {
    setActiveBodyPart(bp);
    setExerciseList([]);
    setExName(''); setExSets([]); setSetReps(''); setSetWeight('');
  }

  function addSet() {
    const reps   = Number(setReps)   || 0;
    const weight = Number(setWeight) || 0;
    if (reps <= 0) { Alert.alert('Missing', 'Enter reps for this set.'); return; }
    setExSets(prev => [...prev, { reps, weight }]);
    setSetReps(''); setSetWeight('');
  }

  function removeSet(i: number) {
    setExSets(prev => prev.filter((_, idx) => idx !== i));
  }

  function saveExercise() {
    if (!exName.trim()) { Alert.alert('Missing', 'Pick or enter an exercise name.'); return; }
    if (exSets.length === 0) { Alert.alert('Missing', 'Add at least one set.'); return; }
    setExerciseList(prev => [...prev, { name: exName.trim(), sets: exSets }]);
    setExName(''); setExSets([]); setSetReps(''); setSetWeight('');
  }

  function removeExercise(i: number) {
    setExerciseList(prev => prev.filter((_, idx) => idx !== i));
  }

  async function saveGymSession() {
    if (!token || !activeBodyPart) return;
    // If user has pending set/exercise data, commit it
    let finalList = exerciseList;
    if (exName.trim() && exSets.length > 0) {
      finalList = [...exerciseList, { name: exName.trim(), sets: exSets }];
    }
    if (finalList.length === 0) { Alert.alert('No exercises', 'Add at least one exercise.'); return; }

    setSubmitting(true);
    try {
      await strength.log(token, {
        mode: 'detailed',
        date: selectedDate,
        category: 'strength',
        bodyPart: activeBodyPart,
        activity: BODY_PARTS.find(b => b.key === activeBodyPart)?.label.toLowerCase(),
        intensity: 7,
        exercises: finalList,
        streak: 0,
      });
      setActiveBodyPart(null);
      setExerciseList([]); setExName(''); setExSets([]);
      setTrainingType(null);
      await load(selectedDate);
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setSubmitting(false); }
  }

  // ── SPORTS submit ───────────────────────────────────────────────────────────
  async function saveSportsSession() {
    if (!token || !sportName.trim()) { Alert.alert('Missing', 'Pick or enter a sport.'); return; }
    setSubmitting(true);
    try {
      await strength.log(token, {
        mode: 'detailed',
        date: selectedDate,
        category: 'games',
        activity: sportName.trim(),
        durationMins: Number(sportDuration) || undefined,
        intensity: sportIntensity,
        streak: 0,
      });
      setSportName(''); setSportDuration(''); setSportIntensity(7);
      setTrainingType(null);
      await load(selectedDate);
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setSubmitting(false); }
  }

  // ── CARDIO submit ───────────────────────────────────────────────────────────
  async function saveCardioSession() {
    if (!token) return;
    if (!cardioDistance && !cardioDuration) { Alert.alert('Missing', 'Enter distance or duration.'); return; }
    setSubmitting(true);
    try {
      await strength.log(token, {
        mode: 'detailed',
        date: selectedDate,
        category: 'cardio',
        activity: cardioActivity,
        durationMins: Number(cardioDuration) || undefined,
        distanceKm:   Number(cardioDistance) || undefined,
        intensity:    cardioIntensity,
        streak: 0,
      });
      setCardioDistance(''); setCardioDuration(''); setCardioIntensity(6);
      setTrainingType(null);
      await load(selectedDate);
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setSubmitting(false); }
  }

  if (loading) return <LoadingScreen />;

  const activeBodyPartMeta = BODY_PARTS.find(b => b.key === activeBodyPart);
  const suggestions = activeBodyPart ? EXERCISE_SUGGESTIONS[activeBodyPart] : [];

  return (
    <DarkBackground><SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <Text style={[s.modeLabel, { color: theme.text, fontFamily: 'Inter_900Black' }]}>STRENGTH MODE</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={[s.topIcon, { borderColor: theme.border }]} onPress={() => router.push('/(tabs)/ai')}>
          <Ionicons name="sparkles" size={15} color="#34C759" />
        </TouchableOpacity>
        <TouchableOpacity style={[s.topIcon, { borderColor: theme.border }]} onPress={() => router.push('/(tabs)/profile')}>
          <Ionicons name="settings-outline" size={15} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={s.datesRow}><DaySelector selectedDate={selectedDate} onSelect={setSelectedDate} /></View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />}
      >
        {/* Hero score card — same layout as the food page's FuelScoreCard */}
        <StrengthScoreCard
          score={todayScore}
          history={history}
          selectedDate={selectedDate}
          theme={theme}
        />

        {/* ── QUICK / DETAILED toggle ── */}
        {isToday && (
          <View style={[s.modeToggle, { backgroundColor: theme.surface }]}>
            {(['quick', 'detailed'] as const).map(m => (
              <TouchableOpacity
                key={m}
                style={[s.modeBtn, strengthMode === m && { backgroundColor: theme.card }]}
                onPress={() => { setStrengthMode(m); setTrainingType(null); }}
                activeOpacity={0.8}
              >
                <Text style={[s.modeBtnText, {
                  color: strengthMode === m ? theme.text : theme.textSecondary,
                  fontFamily: 'Inter_900Black',
                }]}>{m.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* QUICK — rating dial */}
        {isToday && strengthMode === 'quick' && (() => {
          const tier = RATING_TIERS.find(t => rating <= t.upTo) ?? RATING_TIERS[4];
          return (
            <View style={[s.dialCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <RatingDial
                value={rating} max={10}
                eyebrow="HOW DID IT GO?" label={tier.label} copy={tier.copy}
                lowLabel="1 · COOKED" highLabel="ELITE · 10"
                big theme={theme}
                onPress={() => setShowRatingPicker(true)}
                onChange={setRating}
              />
              <TouchableOpacity
                style={[s.dialLogBtn, { backgroundColor: theme.text, opacity: submitting ? 0.4 : 1 }]}
                onPress={submitQuick} disabled={submitting} activeOpacity={0.85}
              >
                <Text style={[s.dialLogText, { color: '#FFFFFF', fontFamily: 'Inter_900Black' }]}>
                  {submitting ? 'LOGGING...' : 'LOG RATING'}
                </Text>
                <View style={s.dialLogArrow}>
                  <Ionicons name="arrow-forward" size={12} color={theme.text} />
                </View>
              </TouchableOpacity>
            </View>
          );
        })()}

        <Modal visible={showRatingPicker} transparent animationType="slide">
          <Pressable style={[bs.backdrop, { backgroundColor: theme.backdrop }]} onPress={() => setShowRatingPicker(false)} />
          <View style={[bs.sheet, { backgroundColor: theme.cardElevated }]}>
            <View style={[bs.handle, { backgroundColor: theme.border }]} />
            <Text style={[bs.title, { color: theme.text, fontFamily: 'Inter_900Black' }]}>PHYSICAL ACTIVITY</Text>
            <Text style={[bs.sub, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{RATING_LABELS[rating]}</Text>
            <RatingScroll value={rating} onChange={setRating} theme={theme} />
            <TouchableOpacity style={[bs.doneBtn, { backgroundColor: theme.text }]} onPress={() => setShowRatingPicker(false)}>
              <Text style={[bs.doneBtnText, { color: theme.bg, fontFamily: 'Inter_900Black' }]}>DONE</Text>
            </TouchableOpacity>
          </View>
        </Modal>

        {/* DETAILED — training type buttons */}
        {isToday && strengthMode === 'detailed' && (
          <>
            <View style={s.trainingRow}>
              {TRAINING_TYPES.map(tt => {
                const active = trainingType === tt.key;
                return (
                  <TouchableOpacity
                    key={tt.key}
                    style={[s.trainingCard, {
                      borderColor: active ? theme.text : theme.border,
                      backgroundColor: theme.card,
                      borderWidth: active ? 2 : 1,
                    }]}
                    onPress={() => setTrainingType(active ? null : tt.key)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.trainingIconBubble, { backgroundColor: theme.surface }]}>
                      <Text style={s.trainingIcon}>{tt.icon}</Text>
                    </View>
                    <Text style={[s.trainingLabel, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{tt.label}</Text>
                    <Text style={[s.trainingSub, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>{tt.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* GYM → body parts */}
            {trainingType === 'gym' && (
              <>
                <Text style={[s.sectionHint, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>WHAT DID YOU TRAIN?</Text>
                <View style={s.bodyGrid}>
                  {BODY_PARTS.filter(b => b.key !== 'cardio').map(bp => {
                    const ac = BODY_PART_COLORS[bp.key] ?? '#22A664';
                    return (
                      <TouchableOpacity
                        key={bp.key}
                        style={[s.bodyCard, { borderColor: theme.border, backgroundColor: theme.card }]}
                        onPress={() => openBodyPart(bp.key)}
                        activeOpacity={0.75}
                      >
                        {/* Colored top strip */}
                        <View style={[s.bodyCardAccent, { backgroundColor: ac }]} />
                        <View style={s.bodyCardInner}>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.bodyLabel, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{bp.label}</Text>
                            <Text style={[s.bodySubLabel, { color: theme.textMuted, fontFamily: 'Inter_500Medium' }]}>Tap to log</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={14} color={ac} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* SPORTS inline form */}
            {trainingType === 'sports' && (
              <View style={[s.inlineForm, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[s.formLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>SPORT</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                  {SPORTS_SUGGESTIONS.map(sp => (
                    <TouchableOpacity
                      key={sp}
                      style={[s.chip, {
                        borderColor: sportName === sp ? theme.text : theme.border,
                        backgroundColor: sportName === sp ? theme.text : 'transparent',
                      }]}
                      onPress={() => setSportName(sp)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.chipText, {
                        color: sportName === sp ? theme.bg : theme.textSecondary,
                        fontFamily: 'Inter_700Bold',
                      }]}>{sp.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput
                  style={[s.input, { color: theme.text, borderColor: theme.border, fontFamily: 'Inter_700Bold', backgroundColor: theme.isDark ? '#2A2A2A' : '#EAE4D4' }]}
                  value={sportName} onChangeText={setSportName}
                  placeholder="Or type your sport..."
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="words"
                />

                <View style={s.numRow}>
                  <NumField label="DURATION" unit="min" value={sportDuration} onChange={setSportDuration} theme={theme} />
                  <NumField label="INTENSITY" unit="/10" value={String(sportIntensity)} onChange={v => setSportIntensity(Math.min(10, Number(v) || 0))} theme={theme} />
                </View>

                <TouchableOpacity
                  style={[s.bigSaveBtn, { backgroundColor: theme.text, opacity: submitting ? 0.4 : 1 }]}
                  onPress={saveSportsSession} disabled={submitting}
                >
                  <Text style={[s.bigSaveText, { color: theme.bg, fontFamily: 'Inter_900Black' }]}>{submitting ? 'SAVING...' : 'LOG SPORT →'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* CARDIO inline form */}
            {trainingType === 'cardio' && (
              <View style={[s.inlineForm, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[s.formLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>ACTIVITY</Text>
                <View style={s.dualRow}>
                  {(['Running', 'Walking'] as const).map(a => (
                    <TouchableOpacity
                      key={a}
                      style={[s.dualBtn, {
                        borderColor: cardioActivity === a ? theme.text : theme.border,
                        backgroundColor: cardioActivity === a ? theme.text : 'transparent',
                      }]}
                      onPress={() => setCardioActivity(a)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.dualBtnText, {
                        color: cardioActivity === a ? theme.bg : theme.textSecondary,
                        fontFamily: 'Inter_900Black',
                      }]}>{a.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={s.numRow}>
                  <NumField label="DISTANCE" unit="km" value={cardioDistance} onChange={setCardioDistance} theme={theme} />
                  <NumField label="DURATION" unit="min" value={cardioDuration} onChange={setCardioDuration} theme={theme} />
                </View>
                <View style={s.numRow}>
                  <NumField label="INTENSITY" unit="/10" value={String(cardioIntensity)} onChange={v => setCardioIntensity(Math.min(10, Number(v) || 0))} theme={theme} />
                </View>

                <TouchableOpacity
                  style={[s.bigSaveBtn, { backgroundColor: theme.text, opacity: submitting ? 0.4 : 1 }]}
                  onPress={saveCardioSession} disabled={submitting}
                >
                  <Text style={[s.bigSaveText, { color: theme.bg, fontFamily: 'Inter_900Black' }]}>{submitting ? 'SAVING...' : 'LOG SESSION →'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}{/* end detailed */}

        {/* Read-only state for past days */}
        {!isToday && logs.length === 0 && (
          <View style={s.empty}><Text style={[s.emptyText, { color: theme.textSecondary }]}>NO ACTIVITY DATA FOR THIS DAY</Text></View>
        )}

        {logs.length > 0 && (
          <>
            <View style={[s.sectionHeader, { marginTop: 20 }]}>
              <Text style={[s.sectionTitle, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{isToday ? "TODAY'S SESSIONS" : 'SESSIONS'}</Text>
              <Text style={[s.sectionCount, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_500Medium' }]}>{String(logs.length).padStart(2,'0')} LOGGED</Text>
            </View>
            {/* Compact log rows in a single card */}
            <View style={[s.logCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {logs.map((log, idx) => (
                <SLogRow
                  key={log.id} log={log} theme={theme}
                  last={idx === logs.length - 1}
                  onPress={() => setDetailLog(log)}
                />
              ))}
            </View>
          </>
        )}

        {/* LOG ANOTHER — shown when sessions already logged today */}
        {isToday && logs.length > 0 && strengthMode === 'detailed' && (
          <Text style={[s.sectionHint, { color: theme.textSecondary, fontFamily: 'Inter_700Bold', marginTop: 20 }]}>LOG ANOTHER</Text>
        )}
      </ScrollView>

      {/* ── GYM body-part / multi-set exercise modal ── */}
      <Modal visible={!!activeBodyPart} transparent animationType="slide" onRequestClose={() => setActiveBodyPart(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={[ef.backdrop, { backgroundColor: theme.backdrop }]} onPress={() => setActiveBodyPart(null)} />
          <View style={[ef.sheet, { backgroundColor: theme.cardElevated }]}>
            <View style={[ef.handle, { backgroundColor: theme.border }]} />

            {/* SESSION IN PROGRESS banner */}
            {exerciseList.length > 0 && (
              <View style={[ef.sessionBanner, { backgroundColor: theme.text }]}>
                <Text style={{ fontSize: 20 }}>🏋️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9, letterSpacing: 2.5, color: '#B8F23A', fontFamily: 'Inter_700Bold' }}>SESSION IN PROGRESS</Text>
                  <Text style={{ fontSize: 15, color: '#FFFFFF', fontFamily: 'Inter_900Black', marginTop: 2 }}>
                    {activeBodyPartMeta?.label} · {exerciseList.length} exercise{exerciseList.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: '#B8F23A', fontFamily: 'Inter_900Black' }}>
                  {exerciseList.reduce((s, e) => s + e.sets.length, 0)} sets
                </Text>
              </View>
            )}

            <View style={ef.header}>
              <Text style={ef.headerIcon}>{activeBodyPartMeta?.icon}</Text>
              <Text style={[ef.headerTitle, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{activeBodyPartMeta?.label}</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => setActiveBodyPart(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Exercise picker */}
              <Text style={[ef.label, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>EXERCISE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ef.suggestRow}>
                {suggestions.map(sg => (
                  <TouchableOpacity
                    key={sg}
                    style={[ef.suggestChip, { borderColor: exName === sg ? theme.text : theme.border, backgroundColor: exName === sg ? theme.text : (theme.isDark ? '#2A2A2A' : '#FBF9F2') }]}
                    onPress={() => setExName(sg)}
                    activeOpacity={0.7}
                  >
                    <Text style={[ef.suggestText, {
                      color: exName === sg ? theme.bg : theme.textSecondary,
                      fontFamily: 'Inter_700Bold',
                    }]}>{sg}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput
                style={[ef.nameInput, { color: theme.text, borderColor: theme.border, fontFamily: 'Inter_700Bold', backgroundColor: theme.isDark ? '#2A2A2A' : '#FBF9F2' }]}
                value={exName} onChangeText={setExName}
                placeholder="Or type the exercise..."
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="words"
              />

              {/* Stats summary + redesigned set rows */}
              {exSets.length > 0 && (
                <>
                  {/* Mini stats bar */}
                  <View style={[ef.statsBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    {[
                      { v: String(exSets.length), l: 'SETS' },
                      { v: String(exSets.reduce((s, r) => s + r.reps, 0)), l: 'REPS' },
                      { v: `${exSets.reduce((s, r) => s + r.reps * r.weight, 0)} kg`, l: 'TOTAL' },
                    ].map((x, i) => (
                      <View key={i} style={[ef.statCell, i < 2 && { borderRightWidth: 1, borderRightColor: theme.border }]}>
                        <Text style={[ef.statVal, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{x.v}</Text>
                        <Text style={[ef.statLbl, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>{x.l}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={[ef.label, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>LOGGED SETS</Text>
                  {exSets.map((st, i) => (
                    <View key={i} style={[ef.setRowNew, { borderColor: theme.border, backgroundColor: theme.card }]}>
                      <View style={[ef.setNumBadge, { backgroundColor: theme.text }]}>
                        <Text style={[ef.setNumText, { color: '#B8F23A', fontFamily: 'Inter_900Black' }]}>{i + 1}</Text>
                      </View>
                      <Text style={[ef.setRepsVal, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{st.reps}</Text>
                      <Text style={[ef.setUnit, { color: theme.textMuted, fontFamily: 'Inter_500Medium' }]}>reps</Text>
                      {st.weight > 0 && (
                        <>
                          <View style={[ef.setSep, { backgroundColor: theme.border }]} />
                          <Text style={[ef.setWeightVal, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{st.weight}</Text>
                          <Text style={[ef.setUnit, { color: theme.textMuted, fontFamily: 'Inter_500Medium' }]}>kg</Text>
                        </>
                      )}
                      <View style={{ flex: 1 }} />
                      <TouchableOpacity onPress={() => removeSet(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="trash-outline" size={13} color={theme.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}

              {/* Add set form */}
              <Text style={[ef.label, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                {exSets.length === 0 ? 'FIRST SET' : `SET ${exSets.length + 1}`}
              </Text>
              <View style={ef.numRow}>
                <NumField label="REPS"   value={setReps}   onChange={setSetReps}   theme={theme} />
                <NumField label="WEIGHT" unit="kg" value={setWeight} onChange={setSetWeight} theme={theme} />
              </View>

              <TouchableOpacity
                style={[ef.addSetBtn, { borderColor: theme.text }]}
                onPress={addSet}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={16} color={theme.text} />
                <Text style={[ef.addSetBtnText, { color: theme.text, fontFamily: 'Inter_900Black' }]}>ADD SET</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[ef.saveExBtn, { backgroundColor: theme.overlay, opacity: (exSets.length === 0 || !exName.trim()) ? 0.4 : 1 }]}
                onPress={saveExercise}
                disabled={exSets.length === 0 || !exName.trim()}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark" size={14} color={theme.text} />
                <Text style={[ef.saveExBtnText, { color: theme.text, fontFamily: 'Inter_900Black' }]}>SAVE EXERCISE</Text>
              </TouchableOpacity>

              {/* List of saved exercises in this session */}
              {exerciseList.length > 0 && (
                <>
                  <View style={[ef.divider, { backgroundColor: theme.border }]} />
                  <Text style={[ef.label, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                    THIS SESSION ({exerciseList.length})
                  </Text>
                  {exerciseList.map((ex, i) => (
                    <View key={i} style={[ef.exItem, { borderColor: theme.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[ef.exName, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>{ex.name}</Text>
                        <Text style={[ef.exMeta, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_500Medium' }]}>
                          {ex.sets.length} {ex.sets.length === 1 ? 'set' : 'sets'}
                          {' · '}
                          {ex.sets.map(st => `${st.reps}${st.weight > 0 ? `@${st.weight}` : ''}`).join(', ')}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => removeExercise(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="trash-outline" size={14} color={theme.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}

              <TouchableOpacity
                style={[ef.finalSaveBtn, { backgroundColor: theme.text, opacity: ((exerciseList.length === 0 && exSets.length === 0) || submitting) ? 0.4 : 1 }]}
                onPress={saveGymSession}
                disabled={(exerciseList.length === 0 && exSets.length === 0) || submitting}
                activeOpacity={0.8}
              >
                <Text style={[ef.finalSaveText, { color: theme.bg, fontFamily: 'Inter_900Black' }]}>
                  {submitting ? 'SAVING...' : 'SAVE SESSION →'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* ── Session detail bottom sheet ── */}
      <Modal visible={!!detailLog} transparent animationType="slide" onRequestClose={() => setDetailLog(null)}>
        <Pressable style={[sd.backdrop, { backgroundColor: theme.backdrop }]} onPress={() => setDetailLog(null)} />
        <View style={[sd.sheet, { backgroundColor: theme.cardElevated }]}>
          <View style={[sd.handle, { backgroundColor: theme.border }]} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
            {detailLog && <SessionCard log={detailLog} theme={theme} />}
          </ScrollView>
          <TouchableOpacity
            style={[sd.closeBtn, { backgroundColor: theme.surface }]}
            onPress={() => setDetailLog(null)}
            activeOpacity={0.8}
          >
            <Text style={[sd.closeBtnText, { color: theme.text, fontFamily: 'Inter_900Black' }]}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </Modal>

    </SafeAreaView></DarkBackground>
  );
}

const sd = StyleSheet.create({
  backdrop:     { flex: 1 },
  sheet:        { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, maxHeight: '80%' },
  handle:       { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  closeBtn:     { marginHorizontal: 16, marginTop: 8, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  closeBtnText: { fontSize: 11, letterSpacing: 3 },
});

// ── Rating scroll picker ──────────────────────────────────────────────────────
const ITEM_W = 56;
function RatingScroll({ value, onChange, theme }: { value: number; onChange: (n: number) => void; theme: any }) {
  const ref = useRef<ScrollView>(null);
  useEffect(() => { ref.current?.scrollTo({ x: value * ITEM_W, animated: true }); }, []);
  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false}
      snapToInterval={ITEM_W} decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 12, alignItems: 'center' }}
      onMomentumScrollEnd={e => {
        const idx = Math.round(e.nativeEvent.contentOffset.x / ITEM_W);
        onChange(Math.max(0, Math.min(10, idx)));
      }}>
      {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
        const active = n === value;
        return (
          <TouchableOpacity key={n} style={{ width: ITEM_W, height: 64, alignItems: 'center', justifyContent: 'center', gap: 4 }}
            onPress={() => { onChange(n); ref.current?.scrollTo({ x: n * ITEM_W, animated: true }); }} activeOpacity={0.7}>
            <Text style={{ fontSize: active ? 40 : 28, lineHeight: 48, color: active ? theme.text : theme.textMuted, fontFamily: active ? 'Inter_900Black' : 'Inter_500Medium' }}>{n}</Text>
            {active && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#34C759' }} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const bs = StyleSheet.create({
  backdrop:    { flex: 1 },
  sheet:       { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, paddingTop: 12 },
  handle:      { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:       { fontSize: 14, letterSpacing: 3, textAlign: 'center' },
  sub:         { fontSize: 10, letterSpacing: 2, textAlign: 'center', marginTop: 6, marginBottom: 8 },
  doneBtn:     { marginHorizontal: 24, marginTop: 20, paddingVertical: 16, alignItems: 'center', borderRadius: 12 },
  doneBtnText: { fontSize: 11, letterSpacing: 4 },
});

// ── Numeric field ────────────────────────────────────────────────────────────
function NumField({ label, value, onChange, unit, theme }: { label: string; value: string; onChange: (v: string) => void; unit?: string; theme: any }) {
  return (
    <View style={[ef.numField, { borderColor: theme.border, backgroundColor: theme.isDark ? '#2A2A2A' : '#EAE4D4' }]}>
      <Text style={[ef.numLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
        {label}{unit ? ` (${unit})` : ''}
      </Text>
      <TextInput
        style={[ef.numInput, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}
        value={value}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={theme.textSecondary}
        keyboardType="decimal-pad"
      />
    </View>
  );
}

// ── Session card (logged) ────────────────────────────────────────────────────
function SessionCard({ log, theme }: { log: WorkoutLog; theme: any }) {
  const time = log.createdAt ? new Date(log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  const isQuick   = log.mode === 'simple';
  const bpMeta    = log.bodyPart ? BODY_PARTS.find(b => b.key === log.bodyPart) : null;
  const exercises = Array.isArray(log.exercises) ? log.exercises : [];

  // Top label
  let topIcon = '';
  let topLabel = '';
  if (isQuick) { topLabel = 'QUICK LOG'; }
  else if (log.category === 'cardio')  { topIcon = '🏃'; topLabel = (log.activity ?? 'CARDIO').toUpperCase(); }
  else if (log.category === 'games')   { topIcon = '🏀'; topLabel = (log.activity ?? 'SPORT').toUpperCase(); }
  else if (bpMeta) { topIcon = bpMeta.icon; topLabel = bpMeta.label; }
  else { topLabel = (log.category ?? 'SESSION').toUpperCase(); }

  return (
    <View style={[sc.card, { borderColor: theme.border }]}>
      <View style={sc.header}>
        <View style={[sc.badge, { backgroundColor: theme.surfaceStrong }]}>
          {!!topIcon && <Text style={sc.badgeIcon}>{topIcon}</Text>}
          <Text style={[sc.badgeText, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>{topLabel}</Text>
        </View>
        <View style={{ flex: 1 }} />
        {!!time && <Text style={[sc.time, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>{time}</Text>}
        <View style={[sc.scorePill, { backgroundColor: theme.surfaceStrong }]}>
          <Text style={[sc.scoreText, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>{log.score}/100</Text>
        </View>
      </View>

      <View style={[sc.divider, { backgroundColor: theme.border }]} />

      {isQuick && (
        <View style={sc.body}>
          <Text style={[sc.quickRating, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>Rated {log.rating}/10</Text>
          <Text style={[sc.quickWord, { color: '#34C759', fontFamily: 'Inter_700Bold' }]}>{RATING_LABELS[log.rating ?? 0]}</Text>
        </View>
      )}

      {!isQuick && log.category === 'cardio' && (
        <View style={sc.body}>
          <Text style={[sc.cardioMeta, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>
            {log.distanceKm != null ? `${log.distanceKm} km` : ''}{log.distanceKm != null && log.durationMins ? ' · ' : ''}{log.durationMins ? `${log.durationMins} min` : ''}
          </Text>
          {log.intensity != null && (
            <Text style={[sc.quickWord, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>INTENSITY {log.intensity}/10</Text>
          )}
        </View>
      )}

      {!isQuick && log.category === 'games' && (
        <View style={sc.body}>
          <Text style={[sc.cardioMeta, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>
            {log.durationMins ? `${log.durationMins} min` : 'Sport session'}
          </Text>
          {log.intensity != null && (
            <Text style={[sc.quickWord, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>INTENSITY {log.intensity}/10</Text>
          )}
        </View>
      )}

      {!isQuick && log.category === 'strength' && exercises.length > 0 && (
        <View style={sc.body}>
          {exercises.map((ex, i) => (
            <View key={i} style={sc.exRow}>
              <View style={{ flex: 1 }}>
                <Text style={[sc.exName, { color: theme.text, fontFamily: 'Inter_700Bold' }]} numberOfLines={1}>{ex.name}</Text>
                <Text style={[sc.exMeta, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_500Medium' }]}>
                  {ex.sets.length} {ex.sets.length === 1 ? 'set' : 'sets'} · {ex.sets.map(st => `${st.reps}${st.weight > 0 ? `@${st.weight}kg` : ''}`).join(' / ')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Session log row ───────────────────────────────────────────────────────────
function SLogRow({ log, theme, last, onPress }: { log: WorkoutLog; theme: any; last?: boolean; onPress?: () => void }) {
  const time = new Date(log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  let emoji = '⚡', tag = 'QUICK';
  if (log.bodyPart) {
    emoji = BODY_PARTS.find(b => b.key === log.bodyPart)?.icon ?? '🏋️';
    tag = 'GYM';
  } else if (log.category === 'cardio') { emoji = '🏃'; tag = 'RUN'; }
  else if (log.category === 'games')   { emoji = '🏀'; tag = 'SPORT'; }

  const bp    = BODY_PARTS.find(b => b.key === log.bodyPart);
  const title = log.activity ?? bp?.label ?? 'Session';
  const sub   = log.exercises?.length
    ? `${log.exercises.length} exercise${log.exercises.length !== 1 ? 's' : ''} · ${log.exercises.reduce((s, e) => s + e.sets.length, 0)} sets`
    : log.durationMins ? `${log.durationMins} min${log.distanceKm ? ` · ${log.distanceKm} km` : ''}` : '';

  const hasDetail = !!(log.exercises?.length || log.durationMins || log.distanceKm || log.intensity || log.rating);

  return (
    <TouchableOpacity
      style={[slr.row, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[slr.time, { color: theme.textMuted, fontFamily: 'SpaceGrotesk_500Medium' }]}>{time}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={[slr.tagBadge, { backgroundColor: theme.surface }]}>
          <Text style={[slr.tagText, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{emoji} {tag}</Text>
        </View>
        <Text style={[slr.title, { color: theme.text, fontFamily: 'Inter_900Black' }]} numberOfLines={1}>{title}</Text>
        {sub.length > 0 && (
          <Text style={[slr.sub, { color: theme.textMuted, fontFamily: 'SpaceGrotesk_500Medium' }]}>{sub}</Text>
        )}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {log.rating != null && (
          <Text style={[slr.metric, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{log.rating}/10</Text>
        )}
        {hasDetail && <Ionicons name="chevron-forward" size={13} color={theme.textMuted} />}
      </View>
    </TouchableOpacity>
  );
}

const slr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  time:     { fontSize: 10, letterSpacing: 0.5, minWidth: 38 },
  tagBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start', marginBottom: 4 },
  tagText:  { fontSize: 8, letterSpacing: 1.5 },
  title:    { fontSize: 14, letterSpacing: -0.2 },
  sub:      { fontSize: 10, letterSpacing: 0.3, marginTop: 2 },
  metric:   { fontSize: 16, letterSpacing: -0.5, minWidth: 40, textAlign: 'right' },
});

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:           { flex: 1 },
  topBar:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6, gap: 10 },
  modeLabel:      { fontSize: 10, letterSpacing: 1.5 },
  topIcon:        { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  datesRow:       { paddingHorizontal: 14, paddingBottom: 8 },
  scroll:         { paddingBottom: 120 },

  // QUICK/DETAILED mode toggle
  modeToggle:  { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, marginBottom: 2, padding: 4, borderRadius: 14, height: 46 },
  modeBtn:     { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  modeBtnText: { fontSize: 11, letterSpacing: 2.5 },
  // Dial card
  dialCard:     { marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderRadius: 20, padding: 20, gap: 20 },
  dialLogBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: 14 },
  dialLogText:  { fontSize: 12, letterSpacing: 3 },
  dialLogArrow: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#B8F23A', alignItems: 'center', justifyContent: 'center' },

  // Log card (sessions / food items)
  logCard:        { marginHorizontal: 16, borderWidth: 1, borderRadius: 16, overflow: 'hidden' },

  // Training type chooser
  sectionHint:    { fontSize: 9, letterSpacing: 3, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 10 },
  trainingRow:    { flexDirection: 'row', paddingHorizontal: 14, gap: 8 },
  trainingCard:   { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 6 },
  trainingIconBubble: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  trainingIcon:   { fontSize: 22 },
  trainingLabel:  { fontSize: 11, letterSpacing: 2 },
  trainingSub:    { fontSize: 8, letterSpacing: 0.5, textAlign: 'center' },

  // Body grid
  bodyGrid:       { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, gap: 10 },
  bodyCard:       { width: '47%', borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  bodyCardAccent: { height: 4 },
  bodyCardInner:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  bodyIconBubble: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bodyIcon:       { fontSize: 22 },
  bodyLabel:      { fontSize: 12, letterSpacing: 0.5 },
  bodySubLabel:   { fontSize: 10, marginTop: 2 },

  // Inline forms for sports / cardio
  inlineForm:     { marginHorizontal: 16, marginTop: 12, gap: 10, borderWidth: 1, borderRadius: 16, padding: 16 },
  formLabel:      { fontSize: 8, letterSpacing: 2.5, marginTop: 4 },
  chipRow:        { gap: 8, paddingVertical: 2 },
  chip:           { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderRadius: 10 },
  chipText:       { fontSize: 9, letterSpacing: 1.5 },
  input:          { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  dualRow:        { flexDirection: 'row', gap: 8 },
  dualBtn:        { flex: 1, paddingVertical: 14, borderWidth: 1, borderRadius: 12, alignItems: 'center' },
  dualBtnText:    { fontSize: 11, letterSpacing: 2 },
  numRow:         { flexDirection: 'row', gap: 8 },
  bigSaveBtn:     { marginTop: 14, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  bigSaveText:    { fontSize: 11, letterSpacing: 4 },

  // Common
  sectionHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 24, paddingTop: 20 },
  sectionTitle:   { fontSize: 9, letterSpacing: 3 },
  sectionCount:   { fontSize: 9 },
  empty:          { alignItems: 'center', paddingVertical: 48 },
  emptyText:      { fontSize: 9, letterSpacing: 3 },
});

function sscDayLetter(dateStr: string) {
  return ['M','T','W','T','F','S','S'][(new Date(dateStr + 'T12:00:00').getDay() + 6) % 7];
}

function StrengthScoreCard({ score, history, selectedDate, theme }: {
  score: number;
  history: Record<string, number | null>;
  selectedDate: string;
  theme: any;
}) {
  const last7 = React.useMemo(() => {
    const days: { date: string; score: number | null }[] = [];
    const todayStr = today();
    for (let i = 6; i >= 0; i--) {
      const d = shiftDateStr(todayStr, -i);
      days.push({ date: d, score: history[d] ?? null });
    }
    return days;
  }, [history]);

  const { trend, delta } = React.useMemo(() => {
    const prev = last7.slice(0, 6).filter(d => d.score != null).map(d => d.score as number);
    const avg  = prev.length ? Math.round(prev.reduce((a, b) => a + b, 0) / prev.length) : null;
    const diff = avg != null ? score - avg : null;
    const scored = last7.filter(d => d.score != null).map(d => d.score as number);
    if (scored.length < 3) return { trend: { label: 'SHOWING UP', color: '#0A84FF', icon: '·' }, delta: diff };
    const half   = Math.floor(scored.length / 2);
    const early  = scored.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const recent = scored.slice(-half).reduce((a, b) => a + b, 0) / half;
    const d      = recent - early;
    if (d > 8)  return { trend: { label: 'GETTING BETTER', color: '#34C759', icon: '↑' }, delta: diff };
    if (d < -8) return { trend: { label: 'DECLINING',      color: '#FF453A', icon: '↓' }, delta: diff };
    return            { trend: { label: 'CONSISTENT',      color: '#0A84FF', icon: '→' }, delta: diff };
  }, [last7, score]);

  const isToday = selectedDate === today();

  return (
    <View style={[ssc.card, { backgroundColor: '#14110D', borderColor: 'rgba(255,255,255,0.07)' }]}>
      {/* Top row: score left, trend + delta right */}
      <View style={ssc.top}>
        <View style={ssc.left}>
          <Text style={[ssc.eyebrow, { color: 'rgba(245,241,232,0.45)', fontFamily: 'Inter_700Bold' }]}>
            {isToday ? "TODAY'S STRENGTH" : 'STRENGTH SCORE'}
          </Text>
          <Text style={[ssc.scoreNum, { color: '#F5F1E8', fontFamily: 'SpaceGrotesk_700Bold', opacity: score === 0 ? 0.22 : 1 }]}>{score}</Text>
        </View>
        <View style={ssc.right}>
          <View style={[ssc.trendPill, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <Text style={[ssc.trendText, { color: '#F5F1E8', fontFamily: 'Inter_900Black' }]}>
              {trend.label}
            </Text>
          </View>
          {delta != null && (
            <Text style={[ssc.deltaText, { color: 'rgba(245,241,232,0.50)', fontFamily: 'Inter_500Medium' }]}>
              {delta > 0 ? '+' : ''}{delta} vs last 7 days
            </Text>
          )}
        </View>
      </View>

      {/* Lime progress bar */}
      <View style={[ssc.progressBg, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
        <View style={[ssc.progressFill, { width: `${score}%` as any, backgroundColor: '#B8F23A' }]} />
      </View>

      {/* Divider */}
      <View style={[ssc.divider, { backgroundColor: 'rgba(255,255,255,0.07)' }]} />

      {/* 7-day squares — white opacity scales with score */}
      <View style={ssc.gridRow}>
        {last7.map(day => {
          const s = day.score;
          const isSelected = day.date === selectedDate;
          const inkOpacity = s == null ? 0 : Math.min(1, 0.28 + (s / 100) * 0.72);
          const bg = s == null
            ? 'rgba(255,255,255,0.06)'
            : `rgba(255,255,255,${inkOpacity * 0.9})`;
          const textColor = s == null
            ? 'rgba(245,241,232,0.25)'
            : (inkOpacity > 0.55 ? '#14110D' : 'rgba(245,241,232,0.70)');
          return (
            <View key={day.date} style={[ssc.square, {
              backgroundColor: bg,
              borderWidth: isSelected ? 2 : 0,
              borderColor: '#B8F23A',
              opacity: s == null ? 0.45 : 1,
            }]}>
              <Text style={[ssc.squareNum, { color: textColor, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                {s ?? '·'}
              </Text>
              <Text style={[ssc.squareDay, { color: textColor, fontFamily: 'Inter_700Bold' }]}>
                {sscDayLetter(day.date)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const ssc = StyleSheet.create({
  card:      { marginHorizontal: 16, marginBottom: 14, borderWidth: 1.5, borderRadius: 18, overflow: 'hidden' },
  top:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 16, paddingBottom: 14 },
  left:      { gap: 2 },
  eyebrow:   { fontSize: 10, letterSpacing: 2 },
  scoreNum:  { fontSize: 64, lineHeight: 68, letterSpacing: -2 },
  right:     { alignItems: 'flex-end', gap: 6, paddingTop: 2 },
  trendPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  trendText: { fontSize: 10, letterSpacing: 1.5 },
  deltaText: { fontSize: 11 },
  progressBg:  { height: 4, marginHorizontal: 16, marginBottom: 14, borderRadius: 2, overflow: 'hidden' },
  progressFill:{ height: 4, borderRadius: 2 },
  divider:   { height: 1 },
  gridRow:   { flexDirection: 'row', padding: 12, gap: 6 },
  square:    { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center', gap: 3 },
  squareNum: { fontSize: 13, lineHeight: 15 },
  squareDay: { fontSize: 9, letterSpacing: 0.5 },
});

// Exercise form modal styles
const ef = StyleSheet.create({
  backdrop:        { flex: 1 },
  sheet:           { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, maxHeight: '92%' },
  handle:          { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  header:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 14 },
  headerIcon:      { fontSize: 22 },
  headerTitle:     { fontSize: 16, letterSpacing: 3 },
  label:           { fontSize: 8, letterSpacing: 2.5, paddingHorizontal: 20, marginTop: 14, marginBottom: 8 },
  suggestRow:      { paddingHorizontal: 20, gap: 8 },
  suggestChip:     { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderRadius: 8 },
  suggestText:     { fontSize: 10, letterSpacing: 1 },
  nameInput:       { marginHorizontal: 20, marginTop: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  // Session in progress banner
  sessionBanner:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 14 },
  // Stats bar above sets
  statsBar:        { flexDirection: 'row', marginHorizontal: 20, marginTop: 6, marginBottom: 2, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  statCell:        { flex: 1, alignItems: 'center', paddingVertical: 10 },
  statVal:         { fontSize: 18, letterSpacing: -0.5 },
  statLbl:         { fontSize: 8, letterSpacing: 1.5, marginTop: 2 },
  // Redesigned set rows
  setRowNew:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 6, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderRadius: 12 },
  setNumBadge:     { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  setNumText:      { fontSize: 12 },
  setRepsVal:      { fontSize: 18, letterSpacing: -0.5 },
  setWeightVal:    { fontSize: 18, letterSpacing: -0.5 },
  setUnit:         { fontSize: 10, paddingBottom: 2 },
  setSep:          { width: 1, height: 18 },
  // Legacy (kept for compat)
  setRow:          { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginTop: 6, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderRadius: 10 },
  setIdx:          { fontSize: 13, width: 18 },
  setMeta:         { fontSize: 14 },
  numRow:          { flexDirection: 'row', paddingHorizontal: 20, gap: 8 },
  numField:        { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  numLabel:        { fontSize: 8, letterSpacing: 1.5 },
  numInput:        { fontSize: 22 },
  addSetBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 20, marginTop: 12, paddingVertical: 12, borderWidth: 1, borderRadius: 10, borderStyle: 'dashed' },
  addSetBtnText:   { fontSize: 10, letterSpacing: 3 },
  saveExBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 20, marginTop: 10, paddingVertical: 12, borderRadius: 10 },
  saveExBtnText:   { fontSize: 10, letterSpacing: 3 },
  divider:         { height: 1, marginHorizontal: 20, marginTop: 18, marginBottom: 4 },
  exItem:          { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginTop: 8, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderRadius: 10 },
  exName:          { fontSize: 12, letterSpacing: 0.3 },
  exMeta:          { fontSize: 10, marginTop: 2 },
  finalSaveBtn:    { marginHorizontal: 20, marginTop: 24, paddingVertical: 16, alignItems: 'center', borderRadius: 12 },
  finalSaveText:   { fontSize: 11, letterSpacing: 4 },
});

// Session card styles
const sc = StyleSheet.create({
  card:       { marginHorizontal: 16, marginTop: 10, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  badge:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeIcon:  { fontSize: 12 },
  badgeText:  { fontSize: 9, letterSpacing: 1.5 },
  time:       { fontSize: 10, letterSpacing: 0.5 },
  scorePill:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  scoreText:  { fontSize: 11 },
  divider:    { height: 1 },
  body:       { paddingHorizontal: 16, paddingVertical: 10 },
  quickRating:{ fontSize: 14 },
  quickWord:  { fontSize: 10, letterSpacing: 1.5, marginTop: 4 },
  cardioMeta: { fontSize: 14 },
  exRow:      { paddingVertical: 7 },
  exName:     { fontSize: 12, letterSpacing: 0.3 },
  exMeta:     { fontSize: 10, marginTop: 2 },
});
