import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DarkBackground } from '../../components/DarkBackground';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import {
  strength, WorkoutLog, today, shiftDate,
  BodyPart, SetEntry, ExerciseEntry, TrainingType,
  BODY_PARTS, EXERCISE_SUGGESTIONS, SPORTS_SUGGESTIONS,
} from '../../lib/api';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorState } from '../../components/ErrorState';
import { DaySelector } from '../../components/DaySelector';
import { DateSwipe, useDateNav } from '../../components/DateSwipe';
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
  { upTo: 2,  label: 'WRECKED', color: '#E84A4A', copy: 'Tough one. Recovery is the work today.' },
  { upTo: 4,  label: 'LOW',     color: '#E84A4A', copy: 'Showed up. That counts.' },
  { upTo: 6,  label: 'STEADY',  color: '#F0A12E', copy: 'Solid effort — kept the streak alive.' },
  { upTo: 8,  label: 'STRONG',  color: '#22A664', copy: 'Real work today. You earned this.' },
  { upTo: 10, label: 'ELITE',   color: '#22A664', copy: "Top tier. Don't stop now." },
];

const shiftDateStr = shiftDate;

export default function StrengthScreen() {
  const { token } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState(today());
  const { goPrev, goNext, canPrev, canNext } = useDateNav(selectedDate, setSelectedDate);
  const [logs, setLogs]                 = useState<WorkoutLog[]>([]);
  // date → max strength score for that day (null when no session logged)
  const [history, setHistory]           = useState<Record<string, number | null>>({});
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [submitting, setSubmitting]     = useState(false);

  // Rating
  const [rating, setRating] = useState(7);
  const [showRatingPicker, setShowRatingPicker] = useState(false);

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
    try {
      const dayLogs = await strength.logs(token, date);
      setLogs(dayLogs);
      setLoadError(false);
    } catch {
      setLoadError(true);
      return;
    }

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

      <DateSwipe onPrev={goPrev} onNext={goNext} canPrev={canPrev} canNext={canNext}>
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

        {loadError && (
          <ErrorState
            message="Couldn't load your training log."
            onRetry={() => { setLoading(true); load(selectedDate).finally(() => setLoading(false)); }}
          />
        )}

        {!loadError && <>
        {/* Rating hero card */}
        {isToday && (() => {
          const tier = RATING_TIERS.find(t => rating <= t.upTo) ?? RATING_TIERS[4];
          return (
            <View style={[s.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[s.heroEyebrow, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>HOW DID IT GO?</Text>

              {/* Hero number with glow halo */}
              <TouchableOpacity style={s.heroNumWrap} onPress={() => setShowRatingPicker(true)} activeOpacity={0.85}>
                <View style={[s.heroHalo, { backgroundColor: tier.color + '25' }]} />
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
                  {/* Transparent mirror of "/10" balances the suffix so the big
                      digit stays centered under the halo (and doesn't shift
                      between single-digit ratings and 10). */}
                  <Text style={[s.heroDenom, { fontFamily: 'Inter_500Medium', opacity: 0 }]}>/10</Text>
                  <Text style={[s.heroNum, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{rating}</Text>
                  <Text style={[s.heroDenom, { color: theme.textMuted, fontFamily: 'Inter_500Medium' }]}>/10</Text>
                </View>
              </TouchableOpacity>

              <Text style={[s.heroTierLabel, { color: tier.color, fontFamily: 'Inter_900Black' }]}>{tier.label}</Text>
              <Text style={[s.heroTierCopy, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>{tier.copy}</Text>

              {/* Rating scale — tap a segment to set your rating */}
              <View style={s.heroBarWrap}>
                {Array.from({ length: 10 }).map((_, i) => {
                  const n = i + 1;
                  const filled = n <= rating;
                  const isActive = n === rating;
                  const band = n <= 2 ? '#E84A4A' : n <= 4 ? '#F08560' : n <= 6 ? '#F0A12E' : n <= 8 ? '#7BC95E' : '#22A664';
                  return (
                    <TouchableOpacity
                      key={i}
                      activeOpacity={0.7}
                      onPress={() => setRating(n)}
                      style={[
                        s.heroBar,
                        { backgroundColor: filled ? band : theme.surface },
                        isActive && { borderWidth: 2.5, borderColor: theme.text, transform: [{ scale: 1.12 }] },
                      ]}
                    >
                      {isActive && (
                        <Text style={[s.heroBarNum, { color: filled ? '#FFFFFF' : theme.text, fontFamily: 'Inter_900Black' }]}>{n}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={s.heroBarTicks}>
                <Text style={[s.heroBarTick, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>1 · COOKED</Text>
                <Text style={[s.heroBarTick, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>10 · ELITE</Text>
              </View>

              {/* LOG RATING button */}
              <TouchableOpacity
                style={[s.heroLogBtn, { backgroundColor: theme.text, opacity: submitting ? 0.4 : 1 }]}
                onPress={submitQuick}
                disabled={submitting}
                activeOpacity={0.8}
              >
                <Text style={[s.heroLogBtnText, { color: '#FFFFFF', fontFamily: 'Inter_900Black' }]}>
                  {submitting ? 'LOGGING...' : 'LOG RATING'}
                </Text>
                <View style={s.heroLogArrow}>
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
            <Text style={[bs.sub, { color: '#34C759', fontFamily: 'Inter_700Bold' }]}>{RATING_LABELS[rating]}</Text>
            <RatingScroll value={rating} onChange={setRating} theme={theme} />
            <TouchableOpacity style={[bs.doneBtn, { backgroundColor: theme.text }]} onPress={() => setShowRatingPicker(false)}>
              <Text style={[bs.doneBtnText, { color: theme.bg, fontFamily: 'Inter_900Black' }]}>DONE</Text>
            </TouchableOpacity>
          </View>
        </Modal>

        {/* ── Training type buttons (Gym / Sports / Run) ── */}
        {isToday && (
          <>
            <Text style={[s.sectionHint, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>OR LOG A FULL SESSION</Text>
            <View style={s.trainingRow}>
              {TRAINING_TYPES.map(tt => {
                const active = trainingType === tt.key;
                return (
                  <TouchableOpacity
                    key={tt.key}
                    style={[s.trainingCard, {
                      borderColor: active ? theme.text : theme.border,
                      backgroundColor: theme.isDark ? '#1E1E1E' : '#FFFFFF',
                      borderWidth: active ? 2 : 1,
                    }]}
                    onPress={() => setTrainingType(active ? null : tt.key)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.trainingIconBubble, { backgroundColor: theme.isDark ? '#2A2A2A' : tt.tint }]}>
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
                        style={[s.bodyCard, { borderColor: theme.border, backgroundColor: theme.isDark ? '#1A1A1A' : '#FFFFFF' }]}
                        onPress={() => openBodyPart(bp.key)}
                        activeOpacity={0.75}
                      >
                        {/* Colored top strip */}
                        <View style={[s.bodyCardAccent, { backgroundColor: ac }]} />
                        <View style={s.bodyCardInner}>
                          <View style={[s.bodyIconBubble, { backgroundColor: ac + '22' }]}>
                            <Text style={s.bodyIcon}>{bp.icon}</Text>
                          </View>
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
              <View style={[s.inlineForm, { backgroundColor: theme.isDark ? '#1E1E1E' : '#FFFFFF', borderColor: theme.border }]}>
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
                  style={[s.input, { color: theme.text, borderColor: theme.border, fontFamily: 'Inter_700Bold', backgroundColor: theme.isDark ? '#2A2A2A' : '#F5F5F5' }]}
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
              <View style={[s.inlineForm, { backgroundColor: theme.isDark ? '#1E1E1E' : '#FFFFFF', borderColor: theme.border }]}>
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
        )}

        {/* Read-only state for past days */}
        {!isToday && logs.length === 0 && (
          <View style={s.empty}><Text style={[s.emptyText, { color: theme.textSecondary }]}>NO ACTIVITY DATA FOR THIS DAY</Text></View>
        )}

        {logs.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{isToday ? "TODAY'S SESSIONS" : 'SESSIONS'}</Text>
              <Text style={[s.sectionCount, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_500Medium' }]}>{String(logs.length).padStart(2,'0')} LOGGED</Text>
            </View>
            {logs.map(log => <SessionCard key={log.id} log={log} theme={theme} />)}
          </>
        )}
        </>}
      </ScrollView>
      </DateSwipe>

      {/* ── GYM body-part / multi-set exercise modal ── */}
      <Modal visible={!!activeBodyPart} transparent animationType="slide" onRequestClose={() => setActiveBodyPart(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={[ef.backdrop, { backgroundColor: theme.backdrop }]} onPress={() => setActiveBodyPart(null)} />
          <View style={[ef.sheet, { backgroundColor: theme.cardElevated }]}>
            <View style={[ef.handle, { backgroundColor: theme.border }]} />
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
                    style={[ef.suggestChip, { borderColor: exName === sg ? theme.text : theme.border, backgroundColor: exName === sg ? theme.text : (theme.isDark ? '#2A2A2A' : '#FFFFFF') }]}
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
                style={[ef.nameInput, { color: theme.text, borderColor: theme.border, fontFamily: 'Inter_700Bold', backgroundColor: theme.isDark ? '#2A2A2A' : '#FFFFFF' }]}
                value={exName} onChangeText={setExName}
                placeholder="Or type the exercise..."
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="words"
              />

              {/* Sets list (already added for the current exercise) */}
              {exSets.length > 0 && (
                <>
                  <Text style={[ef.label, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                    SETS — {exSets.length} added
                  </Text>
                  {exSets.map((st, i) => (
                    <View key={i} style={[ef.setRow, { borderColor: theme.border, backgroundColor: theme.isDark ? '#2A2A2A' : '#FFFFFF' }]}>
                      <Text style={[ef.setIdx, { color: theme.textSecondary, fontFamily: 'Inter_900Black' }]}>{i + 1}</Text>
                      <Text style={[ef.setMeta, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                        {st.reps} reps{st.weight > 0 ? ` · ${st.weight} kg` : ''}
                      </Text>
                      <View style={{ flex: 1 }} />
                      <TouchableOpacity onPress={() => removeSet(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close" size={14} color={theme.textSecondary} />
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
    </SafeAreaView></DarkBackground>
  );
}

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
    <View style={[ef.numField, { borderColor: theme.border, backgroundColor: theme.isDark ? '#2A2A2A' : '#F5F5F5' }]}>
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

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:           { flex: 1 },
  topBar:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6, gap: 10 },
  modeLabel:      { fontSize: 10, letterSpacing: 1.5 },
  topIcon:        { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  datesRow:       { paddingHorizontal: 14, paddingBottom: 8 },
  scroll:         { paddingBottom: 120 },

  // Rating hero card
  heroCard:        { marginHorizontal: 16, marginTop: 14, borderWidth: 1, borderRadius: 20, padding: 20 },
  heroEyebrow:     { fontSize: 9, letterSpacing: 3, textAlign: 'center', marginBottom: 4 },
  heroNumWrap:     { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, position: 'relative' },
  heroHalo:        { position: 'absolute', width: 130, height: 130, borderRadius: 65 },
  heroNum:         { fontSize: 84, letterSpacing: -4, lineHeight: 84 },
  heroDenom:       { fontSize: 22, letterSpacing: -0.5 },
  heroTierLabel:   { fontSize: 14, letterSpacing: 3, textAlign: 'center', marginTop: 2 },
  heroTierCopy:    { fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 6, marginBottom: 16, paddingHorizontal: 16, opacity: 0.8 },
  heroBarWrap:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  heroBar:         { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  heroBarNum:      { fontSize: 13 },
  heroBarTicks:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 18, paddingHorizontal: 2 },
  heroBarTick:     { fontSize: 9, letterSpacing: 1 },
  heroLogBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: 14 },
  heroLogBtnText:  { fontSize: 12, letterSpacing: 3 },
  heroLogArrow:    { width: 22, height: 22, borderRadius: 11, backgroundColor: '#B8F23A', alignItems: 'center', justifyContent: 'center' },

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

  const scoreColor = score >= 70 ? '#22A664' : score >= 50 ? '#F0A12E' : score > 0 ? '#E84A4A' : theme.textMuted;
  const isToday    = selectedDate === today();

  return (
    <View style={[ssc.card, { backgroundColor: theme.isDark ? '#1A1A1A' : '#FFFFFF', borderColor: scoreColor }]}>
      {/* Top row: score left, trend + delta right */}
      <View style={ssc.top}>
        <View style={ssc.left}>
          <Text style={[ssc.eyebrow, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
            {isToday ? "TODAY'S STRENGTH" : 'STRENGTH SCORE'}
          </Text>
          <Text style={[ssc.scoreNum, { color: scoreColor, fontFamily: 'SpaceGrotesk_700Bold' }]}>{score}</Text>
        </View>
        <View style={ssc.right}>
          <View style={[ssc.trendPill, { backgroundColor: trend.color + '25' }]}>
            <Text style={[ssc.trendText, { color: trend.color, fontFamily: 'Inter_900Black' }]}>
              {trend.icon}  {trend.label}
            </Text>
          </View>
          {delta != null && (
            <Text style={[ssc.deltaText, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
              {delta > 0 ? '+' : ''}{delta} vs last 7 days
            </Text>
          )}
        </View>
      </View>

      {/* Divider */}
      <View style={[ssc.divider, { backgroundColor: theme.border }]} />

      {/* 7-day coloured squares */}
      <View style={ssc.gridRow}>
        {last7.map(day => {
          const s          = day.score;
          const isSelected = day.date === selectedDate;
          const bg = s == null
            ? (theme.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)')
            : s >= 70 ? '#22A664' : s >= 50 ? '#F0A12E' : '#E84A4A';
          const textColor = s == null ? theme.textSecondary : '#FFFFFF';
          return (
            <View key={day.date} style={[ssc.square, {
              backgroundColor: bg,
              borderWidth: isSelected ? 2 : 0,
              borderColor: theme.text,
              opacity: s == null ? 0.5 : 1,
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
