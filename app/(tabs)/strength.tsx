import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  strength, health, WorkoutLog, today, shiftDate,
  BodyPart, SetEntry, ExerciseEntry, TrainingType,
  BODY_PARTS, EXERCISE_SUGGESTIONS, SPORTS_SUGGESTIONS,
} from '../../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MovementGoalCard, STEP_GOAL, ACTIVE_KCAL_GOAL } from '../../components/MovementGoalCard';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorState } from '../../components/ErrorState';
import { DaySelector } from '../../components/DaySelector';
import { DateSwipe, useDateNav } from '../../components/DateSwipe';
import { useTheme } from '../../components/ThemeContext';
import { AskGritttButton } from '../../components/AskGritttButton';
import { ViewingBanner } from '../../components/TodayCards';
import {
  EmptyState, IconButton, PrimaryButton, SecondaryButton, SectionCard, TrackingHeader, WeekSummaryCard,
} from '../../components/TrackingShared';
import { WorkoutDraft, workoutDraftStorage } from '../../lib/storage';
import { formatShortDate } from '../../lib/today';

const RATING_LABELS = ['Rest','Very light','Light','Easy','Moderate','Medium','Good','Strong','Very strong','Excellent','Elite'];

const BODY_PART_COLORS: Record<string, string> = {
  chest: '#FF6B6B', back: '#4ECDC4', shoulders: '#FFD93D', legs: '#6BCB77',
  biceps: '#4D96FF', triceps: '#C77DFF', abs: '#F0A12E', cardio: '#34C759',
};

type LogKind = TrainingType | 'rate';
const LOG_KINDS: { key: LogKind; label: string; icon: string; sub: string }[] = [
  { key: 'gym',    label: 'Gym',        icon: '🏋️', sub: 'Exercises, sets, reps' },
  { key: 'sports', label: 'Sport',      icon: '🏀', sub: 'Any game or practice' },
  { key: 'cardio', label: 'Run / walk', icon: '🏃', sub: 'Distance and time' },
  { key: 'rate',   label: 'Rate the day', icon: '✍️', sub: 'One number, 1 to 10' },
];

const RATING_TIERS = [
  { upTo: 2,  label: 'Very light', copy: 'A recovery kind of day.' },
  { upTo: 4,  label: 'Light',      copy: 'You moved. That is recorded.' },
  { upTo: 6,  label: 'Steady',     copy: 'A solid, ordinary effort.' },
  { upTo: 8,  label: 'Strong',     copy: 'Real work today.' },
  { upTo: 10, label: 'Maximal',    copy: 'As hard as it goes.' },
];

const shiftDateStr = shiftDate;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export default function StrengthScreen() {
  const { token, user, updateProfile } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const userKey = user?.id ?? 'anon';

  const [selectedDate, setSelectedDate] = useState(today());
  const { goPrev, goNext, canPrev, canNext } = useDateNav(selectedDate, setSelectedDate);
  const [logs, setLogs]                 = useState<WorkoutLog[]>([]);
  // date → max session score for that day, 14 days ending on the selected date
  const [history, setHistory]           = useState<Record<string, number | null>>({});
  const [healthConnected, setHealthConnected] = useState(false);
  const [movement, setMovement]         = useState<{ steps: number | null; activeEnergyBurned: number | null; score?: number | null } | null>(null);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [submitting, setSubmitting]     = useState(false);

  // What the user is logging right now (null = chooser closed)
  const [kind, setKind] = useState<LogKind | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);

  // Rating
  const [rating, setRating] = useState(7);

  // GYM flow (the modal) — mirrored to a device draft so it survives leaving the screen
  const [activeBodyPart, setActiveBodyPart] = useState<BodyPart | null>(null);
  const [exerciseList, setExerciseList]     = useState<ExerciseEntry[]>([]);
  const [exName, setExName]                 = useState('');
  const [exSets, setExSets]                 = useState<SetEntry[]>([]);
  const [setReps, setSetReps]               = useState('');
  const [setWeight, setSetWeight]           = useState('');
  const [draft, setDraft]                   = useState<WorkoutDraft | null>(null);
  const [prefilledFrom, setPrefilledFrom]   = useState<string | null>(null); // "Repeat": label the source, never auto-complete
  const modalOpenRef = useRef(false);

  // SPORTS flow
  const [sportName, setSportName]           = useState('');
  const [sportDuration, setSportDuration]   = useState('');
  const [sportIntensity, setSportIntensity] = useState(7);

  // CARDIO flow
  const [cardioActivity, setCardioActivity] = useState<'Running' | 'Walking'>('Running');
  const [cardioDistance, setCardioDistance] = useState('');
  const [cardioDuration, setCardioDuration] = useState('');
  const [cardioIntensity, setCardioIntensity] = useState(6);

  const todayStr = today();
  const isToday = selectedDate === todayStr;
  const canLog  = selectedDate <= todayStr;

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
    const from = shiftDateStr(date, -13);
    strength.history(token, from, date)
      .then(rows => { const map: Record<string, number | null> = {}; rows.forEach(r => { map[r.date] = r.score; }); setHistory(map); })
      .catch(() => {});
    AsyncStorage.getItem('grittt_health_connected').then(v => setHealthConnected(v === 'true')).catch(() => {});
    health.scores(token, date).then(s => setMovement(s.movement)).catch(() => setMovement(null));
  }
  useEffect(() => { load(selectedDate).finally(() => setLoading(false)); }, [token, selectedDate]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(selectedDate); setRefreshing(false); }, [token, selectedDate]);

  // Device draft for the selected date
  useEffect(() => {
    let cancelled = false;
    workoutDraftStorage.get(userKey, selectedDate).then(d => { if (!cancelled) setDraft(d && d.bodyPart ? d : null); }).catch(() => {});
    setKind(null); setChooserOpen(false);
    return () => { cancelled = true; };
  }, [userKey, selectedDate]);

  const gymHasContent = exerciseList.length > 0 || exSets.length > 0 || !!exName.trim();
  useEffect(() => {
    modalOpenRef.current = !!activeBodyPart;
    if (!activeBodyPart || !gymHasContent) return;
    const d: WorkoutDraft = { bodyPart: activeBodyPart, exercises: exerciseList, currentName: exName, currentSets: exSets, updatedAt: new Date().toISOString() };
    setDraft(d);
    workoutDraftStorage.set(userKey, selectedDate, d).catch(() => {});
  }, [activeBodyPart, exerciseList, exName, exSets]);

  function clearDraft() {
    setDraft(null);
    workoutDraftStorage.clear(userKey, selectedDate).catch(() => {});
  }

  // ── Quick rating ─────────────────────────────────────────────────────────────
  async function submitRating() {
    if (!token) return;
    setSubmitting(true);
    try {
      await strength.log(token, { mode: 'simple', date: selectedDate, rating, streak: 0 });
      setKind(null); setChooserOpen(false);
      await load(selectedDate);
    } catch (err: any) { Alert.alert('Could not save', err.message); }
    finally { setSubmitting(false); }
  }

  // ── GYM helpers ──────────────────────────────────────────────────────────────
  function openBodyPart(bp: BodyPart) {
    setActiveBodyPart(bp);
    setExerciseList([]); setExName(''); setExSets([]); setSetReps(''); setSetWeight('');
    setPrefilledFrom(null);
  }
  function continueDraft() {
    if (!draft) return;
    setActiveBodyPart(draft.bodyPart as BodyPart);
    setExerciseList(draft.exercises);
    setExName(draft.currentName); setExSets(draft.currentSets);
    setSetReps(''); setSetWeight('');
    setPrefilledFrom(null);
  }
  function closeGymModal() {
    if (!gymHasContent) { setActiveBodyPart(null); clearDraft(); return; }
    Alert.alert('Leave this workout?', 'Nothing has been saved to your log yet. You can keep it as a draft on this device and continue later.', [
      { text: 'Keep draft', onPress: () => setActiveBodyPart(null) },
      { text: 'Discard', style: 'destructive', onPress: () => { setActiveBodyPart(null); setExerciseList([]); setExName(''); setExSets([]); clearDraft(); } },
      { text: 'Stay', style: 'cancel' },
    ]);
  }
  function addSet() {
    const reps = Number(setReps) || 0; const weight = Number(setWeight) || 0;
    if (reps <= 0) { Alert.alert('Reps needed', 'Enter the reps for this set.'); return; }
    setExSets(prev => [...prev, { reps, weight }]);
    setSetReps(''); setSetWeight('');
  }
  function removeSet(i: number) { setExSets(prev => prev.filter((_, idx) => idx !== i)); }
  function saveExercise() {
    if (!exName.trim()) { Alert.alert('Exercise needed', 'Pick or type the exercise name.'); return; }
    if (exSets.length === 0) { Alert.alert('Set needed', 'Add at least one set.'); return; }
    setExerciseList(prev => [...prev, { name: exName.trim(), sets: exSets }]);
    setExName(''); setExSets([]); setSetReps(''); setSetWeight('');
  }
  function removeExercise(i: number) { setExerciseList(prev => prev.filter((_, idx) => idx !== i)); }

  async function saveGymSession() {
    if (!token || !activeBodyPart) return;
    let finalList = exerciseList;
    if (exName.trim() && exSets.length > 0) finalList = [...exerciseList, { name: exName.trim(), sets: exSets }];
    if (finalList.length === 0) { Alert.alert('Nothing to save', 'Add at least one exercise with a set.'); return; }
    setSubmitting(true);
    try {
      await strength.log(token, {
        mode: 'detailed', date: selectedDate, category: 'strength', bodyPart: activeBodyPart,
        activity: BODY_PARTS.find(b => b.key === activeBodyPart)?.label.toLowerCase(),
        intensity: 7, exercises: finalList, streak: 0,
      });
      setActiveBodyPart(null); setExerciseList([]); setExName(''); setExSets([]);
      setKind(null); setChooserOpen(false); setPrefilledFrom(null);
      clearDraft();
      await load(selectedDate);
    } catch (err: any) { Alert.alert('Could not save', err.message); }
    finally { setSubmitting(false); }
  }

  // ── SPORTS / CARDIO ──────────────────────────────────────────────────────────
  async function saveSportsSession() {
    if (!token || !sportName.trim()) { Alert.alert('Sport needed', 'Pick or type the sport.'); return; }
    setSubmitting(true);
    try {
      await strength.log(token, { mode: 'detailed', date: selectedDate, category: 'games', activity: sportName.trim(), durationMins: Number(sportDuration) || undefined, intensity: sportIntensity, streak: 0 });
      setSportName(''); setSportDuration(''); setSportIntensity(7);
      setKind(null); setChooserOpen(false); setPrefilledFrom(null);
      await load(selectedDate);
    } catch (err: any) { Alert.alert('Could not save', err.message); }
    finally { setSubmitting(false); }
  }
  async function saveCardioSession() {
    if (!token) return;
    if (!cardioDistance && !cardioDuration) { Alert.alert('One number needed', 'Enter a distance or a duration.'); return; }
    setSubmitting(true);
    try {
      await strength.log(token, { mode: 'detailed', date: selectedDate, category: 'cardio', activity: cardioActivity, durationMins: Number(cardioDuration) || undefined, distanceKm: Number(cardioDistance) || undefined, intensity: cardioIntensity, streak: 0 });
      setCardioDistance(''); setCardioDuration(''); setCardioIntensity(6);
      setKind(null); setChooserOpen(false); setPrefilledFrom(null);
      await load(selectedDate);
    } catch (err: any) { Alert.alert('Could not save', err.message); }
    finally { setSubmitting(false); }
  }

  // ── Repeat: open a reviewable draft from a saved session. Nothing is saved until the user taps Save. ──
  function repeatSession(log: WorkoutLog) {
    const label = `${log.activity ?? log.category ?? 'session'} on ${formatShortDate(selectedDate)}`;
    if (log.category === 'cardio') {
      setCardioActivity(log.activity === 'Walking' ? 'Walking' : 'Running');
      setCardioDistance(log.distanceKm != null ? String(log.distanceKm) : '');
      setCardioDuration(log.durationMins != null ? String(log.durationMins) : '');
      setCardioIntensity(log.intensity ?? 6);
      setKind('cardio'); setChooserOpen(true); setPrefilledFrom(label);
    } else if (log.category === 'games') {
      setSportName(log.activity ?? ''); setSportDuration(log.durationMins != null ? String(log.durationMins) : ''); setSportIntensity(log.intensity ?? 7);
      setKind('sports'); setChooserOpen(true); setPrefilledFrom(label);
    } else if (log.category === 'strength' && log.bodyPart) {
      setActiveBodyPart(log.bodyPart);
      setExerciseList(Array.isArray(log.exercises) ? log.exercises : []);
      setExName(''); setExSets([]); setSetReps(''); setSetWeight('');
      setPrefilledFrom(label);
    } else if (log.mode === 'simple') {
      setRating(log.rating ?? 7); setKind('rate'); setChooserOpen(true); setPrefilledFrom(label);
    }
  }

  // ── Weekly facts ─────────────────────────────────────────────────────────────
  const week = useMemo(() => {
    const thisWeek: string[] = []; const lastWeek: string[] = [];
    for (let i = 6; i >= 0; i--) thisWeek.push(shiftDateStr(selectedDate, -i));
    for (let i = 13; i >= 7; i--) lastWeek.push(shiftDateStr(selectedDate, -i));
    const past = thisWeek.filter(d => d <= todayStr);
    const daysWith = past.filter(d => (history[d] ?? null) != null).length;
    const lastWith = lastWeek.filter(d => (history[d] ?? null) != null).length;
    return { from: thisWeek[0], days: past.length, daysWith, lastWith };
  }, [selectedDate, todayStr, history]);

  const dayFacts = useMemo(() => {
    const minutes = logs.reduce((a, l) => a + (l.durationMins ?? 0), 0);
    const sets = logs.reduce((a, l) => a + (Array.isArray(l.exercises) ? l.exercises.reduce((x, e) => x + e.sets.length, 0) : 0), 0);
    const km = logs.reduce((a, l) => a + (l.distanceKm ?? 0), 0);
    return { minutes, sets, km: Math.round(km * 10) / 10 };
  }, [logs]);

  if (loading) return <LoadingScreen />;

  const activeBodyPartMeta = BODY_PARTS.find(b => b.key === activeBodyPart);
  const suggestions = activeBodyPart ? EXERCISE_SUGGESTIONS[activeBodyPart] : [];
  const tier = RATING_TIERS.find(t => rating <= t.upTo) ?? RATING_TIERS[4];
  const stepGoal = user?.stepGoal ?? STEP_GOAL;
  const kcalGoal = user?.calorieGoal ?? ACTIVE_KCAL_GOAL;

  return (
    <DarkBackground><SafeAreaView style={s.safe} edges={['top']}>
      <TrackingHeader
        title="Physical"
        subtitle="Your movement, clearly recorded."
        date={selectedDate}
        todayStr={todayStr}
        theme={theme}
        right={<>
          <AskGritttButton screen="physical" date={selectedDate} compact />
          <IconButton icon="settings-outline" label="Profile and settings" onPress={() => router.push('/(tabs)/profile')} theme={theme} />
        </>}
      />
      <View style={s.datesRow}><DaySelector selectedDate={selectedDate} onSelect={setSelectedDate} /></View>

      <DateSwipe onPrev={goPrev} onNext={goNext} canPrev={canPrev} canNext={canNext}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />}>

        {!isToday && <ViewingBanner theme={theme} canLog={canLog} onToday={() => setSelectedDate(todayStr)} />}

        {loadError && (
          <ErrorState message="Couldn't load your activity log." onRetry={() => { setLoading(true); load(selectedDate).finally(() => setLoading(false)); }} />
        )}

        {/* 1 — Primary action */}
        {canLog && !loadError && (
          <SectionCard theme={theme}>
            {draft ? (
              <>
                <Text style={[s.lead, { color: theme.text, fontFamily: 'Inter_800ExtraBold' }]} maxFontSizeMultiplier={1.5}>You have an unsaved workout</Text>
                <Text style={[s.leadSub, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]} maxFontSizeMultiplier={1.6}>
                  {BODY_PARTS.find(b => b.key === draft.bodyPart)?.label ?? 'Gym'} · {plural(draft.exercises.length + (draft.currentSets.length ? 1 : 0), 'exercise')} in progress · kept on this device
                </Text>
                <View style={s.actions}>
                  <PrimaryButton label="Continue workout" icon="play" onPress={continueDraft} theme={theme} />
                  <SecondaryButton label={chooserOpen ? 'Hide other options' : 'Log something else'} onPress={() => setChooserOpen(v => !v)} theme={theme} />
                </View>
              </>
            ) : (
              <>
                <Text style={[s.lead, { color: theme.text, fontFamily: 'Inter_800ExtraBold' }]} maxFontSizeMultiplier={1.5}>
                  {logs.length ? 'Add another activity' : isToday ? 'What did you do today?' : `Add activity for ${formatShortDate(selectedDate)}`}
                </Text>
                <View style={s.actions}>
                  <PrimaryButton label={chooserOpen ? 'Close' : 'Log activity'} icon={chooserOpen ? 'close' : 'add'} onPress={() => { setChooserOpen(v => !v); if (chooserOpen) setKind(null); }} theme={theme} />
                </View>
              </>
            )}

            {chooserOpen && (
              <View style={s.kindGrid}>
                {LOG_KINDS.map(k => {
                  const on = kind === k.key;
                  return (
                    <TouchableOpacity
                      key={k.key}
                      style={[s.kindTile, { backgroundColor: on ? theme.inverse : theme.surface, borderColor: on ? theme.inverse : theme.border }]}
                      onPress={() => setKind(on ? null : k.key)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${k.label}. ${k.sub}`}
                    >
                      <Text style={s.kindIcon}>{k.icon}</Text>
                      <Text style={[s.kindLabel, { color: on ? theme.inverseText : theme.text, fontFamily: 'Inter_700Bold' }]} maxFontSizeMultiplier={1.4}>{k.label}</Text>
                      <Text style={[s.kindSub, { color: on ? theme.inverseText : theme.textSecondary, fontFamily: 'Inter_500Medium' }]} maxFontSizeMultiplier={1.4}>{k.sub}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {chooserOpen && prefilledFrom && kind !== null && (
              <View style={[s.prefillNote, { backgroundColor: theme.warning + '22', borderColor: theme.warning }]}>
                <Ionicons name="copy-outline" size={14} color={theme.text} />
                <Text style={[s.prefillText, { color: theme.text, fontFamily: 'Inter_500Medium' }]} maxFontSizeMultiplier={1.6}>Prefilled from {prefilledFrom}. Review it, then save. Nothing is recorded yet.</Text>
              </View>
            )}

            {/* Gym → pick a body part */}
            {chooserOpen && kind === 'gym' && (
              <>
                <Text style={[s.formLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>WHAT DID YOU TRAIN?</Text>
                <View style={s.bodyGrid}>
                  {BODY_PARTS.filter(b => b.key !== 'cardio').map(bp => {
                    const ac = BODY_PART_COLORS[bp.key] ?? '#22A664';
                    return (
                      <TouchableOpacity key={bp.key} style={[s.bodyCard, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => openBodyPart(bp.key)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`${bp.label}, start logging`}>
                        <View style={[s.bodyIconBubble, { backgroundColor: ac + '22' }]}><Text style={s.bodyIcon}>{bp.icon}</Text></View>
                        <Text style={[s.bodyLabel, { color: theme.text, fontFamily: 'Inter_700Bold' }]} maxFontSizeMultiplier={1.4}>{bp.label}</Text>
                        <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Sport */}
            {chooserOpen && kind === 'sports' && (
              <View style={s.form}>
                <Text style={[s.formLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>SPORT</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                  {SPORTS_SUGGESTIONS.map(sp => (
                    <TouchableOpacity key={sp} style={[s.chip, { borderColor: sportName === sp ? theme.inverse : theme.border, backgroundColor: sportName === sp ? theme.inverse : 'transparent' }]} onPress={() => setSportName(sp)} activeOpacity={0.7} accessibilityRole="radio" accessibilityState={{ checked: sportName === sp }} accessibilityLabel={sp}>
                      <Text style={[s.chipText, { color: sportName === sp ? theme.inverseText : theme.text, fontFamily: 'Inter_700Bold' }]} maxFontSizeMultiplier={1.4}>{sp}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface, fontFamily: 'Inter_600SemiBold' }]} value={sportName} onChangeText={setSportName} placeholder="Or type the sport" placeholderTextColor={theme.textTertiary} autoCapitalize="words" accessibilityLabel="Sport name" maxFontSizeMultiplier={1.6} />
                <Text style={[s.formLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>OPTIONAL</Text>
                <View style={s.numRow}>
                  <NumField label="Duration" unit="min" value={sportDuration} onChange={setSportDuration} theme={theme} />
                  <NumField label="Intensity" unit="/10" value={String(sportIntensity)} onChange={v => setSportIntensity(Math.min(10, Number(v) || 0))} theme={theme} />
                </View>
                <PrimaryButton label="Save sport" onPress={saveSportsSession} loading={submitting} disabled={!sportName.trim()} theme={theme} />
              </View>
            )}

            {/* Run / walk */}
            {chooserOpen && kind === 'cardio' && (
              <View style={s.form}>
                <Text style={[s.formLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>ACTIVITY</Text>
                <View style={s.dualRow}>
                  {(['Running', 'Walking'] as const).map(a => (
                    <TouchableOpacity key={a} style={[s.dualBtn, { borderColor: cardioActivity === a ? theme.inverse : theme.border, backgroundColor: cardioActivity === a ? theme.inverse : 'transparent' }]} onPress={() => setCardioActivity(a)} activeOpacity={0.7} accessibilityRole="radio" accessibilityState={{ checked: cardioActivity === a }} accessibilityLabel={a}>
                      <Text style={[s.dualBtnText, { color: cardioActivity === a ? theme.inverseText : theme.text, fontFamily: 'Inter_700Bold' }]} maxFontSizeMultiplier={1.4}>{a}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[s.formLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>AT LEAST ONE OF</Text>
                <View style={s.numRow}>
                  <NumField label="Distance" unit="km" value={cardioDistance} onChange={setCardioDistance} theme={theme} />
                  <NumField label="Duration" unit="min" value={cardioDuration} onChange={setCardioDuration} theme={theme} />
                </View>
                <Text style={[s.formLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>OPTIONAL</Text>
                <View style={s.numRow}>
                  <NumField label="Intensity" unit="/10" value={String(cardioIntensity)} onChange={v => setCardioIntensity(Math.min(10, Number(v) || 0))} theme={theme} />
                </View>
                <PrimaryButton label="Save run / walk" onPress={saveCardioSession} loading={submitting} disabled={!cardioDistance && !cardioDuration} theme={theme} />
              </View>
            )}

            {/* Rate the day */}
            {chooserOpen && kind === 'rate' && (
              <View style={s.form}>
                <Text style={[s.formLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>HOW HARD DID YOU GO?</Text>
                <View style={s.ratingHead}>
                  <Text style={[s.ratingNum, { color: theme.text, fontFamily: 'Inter_900Black' }]} accessibilityLabel={`${rating} out of 10`}>{rating}<Text style={[s.ratingDenom, { color: theme.textTertiary, fontFamily: 'Inter_500Medium' }]}>/10</Text></Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.ratingTier, { color: theme.text, fontFamily: 'Inter_700Bold' }]} maxFontSizeMultiplier={1.4}>{tier.label}</Text>
                    <Text style={[s.ratingCopy, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]} maxFontSizeMultiplier={1.6}>{tier.copy}</Text>
                  </View>
                </View>
                <RatingSlider value={rating} onChange={setRating} theme={theme} />
                <PrimaryButton label="Save rating" onPress={submitRating} loading={submitting} theme={theme} />
                <Text style={[s.fine, { color: theme.textTertiary, fontFamily: 'Inter_500Medium' }]} maxFontSizeMultiplier={1.6}>A rating is your own 1 to 10 effort score for the day. It is kept as a record, not a measurement.</Text>
              </View>
            )}
          </SectionCard>
        )}

        {/* 2 — From Apple Health (only when connected; a measurement, not a log) */}
        {healthConnected && (
          <SectionCard title="From Apple Health" subtitle={isToday ? 'Today so far' : formatShortDate(selectedDate)} theme={theme}>
            <View style={s.movRow}>
              <MovementGoalCard label="STEPS" icon="footsteps" iconColor="#22A664" value={movement?.steps ?? 0} goal={stepGoal} sub={`of ${stepGoal.toLocaleString()} goal`} theme={theme}
                onSetGoal={n => updateProfile({ stepGoal: n }).then(() => load(selectedDate)).catch(() => {})} />
              <MovementGoalCard label="ACTIVE KCAL" icon="flame" iconColor="#F97316" value={movement?.activeEnergyBurned ?? 0} goal={kcalGoal} sub={`of ${kcalGoal} goal`} theme={theme}
                onSetGoal={n => updateProfile({ calorieGoal: n }).then(() => load(selectedDate)).catch(() => {})} />
            </View>
          </SectionCard>
        )}

        {/* 3 — What is recorded for this day */}
        <SectionCard
          title={isToday ? "Today's activity" : `Activity on ${formatShortDate(selectedDate)}`}
          subtitle={logs.length ? [dayFacts.minutes ? `${dayFacts.minutes} min recorded` : null, dayFacts.sets ? plural(dayFacts.sets, 'set') : null, dayFacts.km ? `${dayFacts.km} km` : null].filter(Boolean).join(' · ') || undefined : undefined}
          theme={theme}
        >
          {logs.length === 0 ? (
            <EmptyState
              icon="walk-outline"
              title={canLog ? (isToday ? 'No activity recorded today.' : 'Nothing was recorded for this day.') : 'This day has not happened yet.'}
              body={canLog ? 'Nothing logged is not the same as a rest day. If you rested on purpose, that is fine; if you moved, you can still log it.' : undefined}
              theme={theme}
            />
          ) : (
            logs.map(log => <SessionCard key={log.id} log={log} theme={theme} onRepeat={canLog ? () => repeatSession(log) : undefined} />)
          )}
        </SectionCard>

        {/* 4 — Weekly facts */}
        <WeekSummaryCard
          title="This week"
          period={`${formatShortDate(week.from)} – ${formatShortDate(selectedDate)} · ${plural(week.days, 'day')}`}
          rows={[
            { label: 'Days with a session', value: `${week.daysWith} of ${week.days}` },
            { label: 'Previous 7 days', value: `${week.lastWith} of 7`, hint: 'days with a session' },
            ...(dayFacts.minutes ? [{ label: isToday ? 'Minutes today' : 'Minutes this day', value: String(dayFacts.minutes), hint: 'where a duration was entered' }] : []),
            ...(dayFacts.sets ? [{ label: isToday ? 'Sets today' : 'Sets this day', value: String(dayFacts.sets) }] : []),
          ]}
          note={week.days - week.daysWith > 0
            ? `${plural(week.days - week.daysWith, 'day')} with no session logged. A planned rest day and a missed log look the same here, so this is a count, not a verdict.`
            : week.days > 0 ? 'A session was logged on every day this week.' : null}
          onHistory={() => router.push('/(tabs)/profile')}
          theme={theme}
        />
        <Text style={[s.fine, { color: theme.textTertiary, fontFamily: 'Inter_500Medium', marginHorizontal: 20, marginBottom: 20 }]} maxFontSizeMultiplier={1.6}>
          Session scores out of 100 come from what you entered (effort, duration, sets). They are not calories or fitness measurements.
        </Text>
      </ScrollView>
      </DateSwipe>

      {/* ── Gym session modal ── */}
      <Modal visible={!!activeBodyPart} transparent animationType="slide" onRequestClose={closeGymModal}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={[ef.backdrop, { backgroundColor: theme.backdrop }]} onPress={closeGymModal} accessibilityLabel="Close workout" />
          <View style={[ef.sheet, { backgroundColor: theme.cardElevated }]}>
            <View style={[ef.handle, { backgroundColor: theme.border }]} />
            <View style={ef.header}>
              <Text style={ef.headerIcon}>{activeBodyPartMeta?.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[ef.headerTitle, { color: theme.text, fontFamily: 'Inter_900Black' }]} accessibilityRole="header">{activeBodyPartMeta?.label}</Text>
                <Text style={[s.fine, { color: theme.textSecondary, fontFamily: 'Inter_500Medium', marginTop: 2 }]}>
                  {prefilledFrom ? `Prefilled from ${prefilledFrom}. Nothing is saved until you tap Save session.` : 'Draft kept on this device until you save.'}
                </Text>
              </View>
              <TouchableOpacity onPress={closeGymModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="Close workout">
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              {exerciseList.length > 0 && (
                <>
                  <Text style={[ef.label, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                    IN THIS SESSION ({exerciseList.length}){prefilledFrom ? ' · FROM PREVIOUS, NOT YET SAVED' : ''}
                  </Text>
                  {exerciseList.map((ex, i) => (
                    <View key={i} style={[ef.exItem, { borderColor: theme.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[ef.exName, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>{ex.name}</Text>
                        <Text style={[ef.exMeta, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_500Medium' }]}>
                          {plural(ex.sets.length, 'set')} · {ex.sets.map(st => `${st.reps}${st.weight > 0 ? `@${st.weight}` : ''}`).join(', ')}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => removeExercise(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={`Remove ${ex.name}`}>
                        <Ionicons name="trash-outline" size={16} color={theme.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={[ef.divider, { backgroundColor: theme.border }]} />
                </>
              )}

              <Text style={[ef.label, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{exerciseList.length ? 'NEXT EXERCISE' : 'EXERCISE'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ef.suggestRow}>
                {suggestions.map(sg => (
                  <TouchableOpacity key={sg} style={[ef.suggestChip, { borderColor: exName === sg ? theme.text : theme.border, backgroundColor: exName === sg ? theme.text : (theme.isDark ? '#2A2A2A' : '#FFFFFF') }]} onPress={() => setExName(sg)} activeOpacity={0.7} accessibilityRole="radio" accessibilityState={{ checked: exName === sg }} accessibilityLabel={sg}>
                    <Text style={[ef.suggestText, { color: exName === sg ? theme.bg : theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{sg}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput style={[ef.nameInput, { color: theme.text, borderColor: theme.border, fontFamily: 'Inter_700Bold', backgroundColor: theme.isDark ? '#2A2A2A' : '#FFFFFF' }]} value={exName} onChangeText={setExName} placeholder="Or type the exercise" placeholderTextColor={theme.textSecondary} autoCapitalize="words" accessibilityLabel="Exercise name" />

              {exSets.length > 0 && (
                <>
                  <Text style={[ef.label, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>SETS DONE — {exSets.length}</Text>
                  {exSets.map((st, i) => (
                    <View key={i} style={[ef.setRow, { borderColor: theme.border, backgroundColor: theme.isDark ? '#2A2A2A' : '#FFFFFF' }]}>
                      <Text style={[ef.setIdx, { color: theme.textSecondary, fontFamily: 'Inter_900Black' }]}>{i + 1}</Text>
                      <Text style={[ef.setMeta, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>{st.reps} reps{st.weight > 0 ? ` · ${st.weight} kg` : ''}</Text>
                      <View style={{ flex: 1 }} />
                      <TouchableOpacity onPress={() => removeSet(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={`Remove set ${i + 1}`}>
                        <Ionicons name="close" size={14} color={theme.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}

              <Text style={[ef.label, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{exSets.length === 0 ? 'FIRST SET' : `SET ${exSets.length + 1}`}</Text>
              <View style={ef.numRow}>
                <NumField label="Reps" value={setReps} onChange={setSetReps} theme={theme} />
                <NumField label="Weight" unit="kg" value={setWeight} onChange={setSetWeight} theme={theme} />
              </View>
              <TouchableOpacity style={[ef.addSetBtn, { borderColor: theme.text }]} onPress={addSet} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Add set">
                <Ionicons name="add" size={16} color={theme.text} />
                <Text style={[ef.addSetBtnText, { color: theme.text, fontFamily: 'Inter_900Black' }]}>ADD SET</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[ef.saveExBtn, { backgroundColor: theme.overlay, opacity: (exSets.length === 0 || !exName.trim()) ? 0.4 : 1 }]} onPress={saveExercise} disabled={exSets.length === 0 || !exName.trim()} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Add exercise to session">
                <Ionicons name="checkmark" size={14} color={theme.text} />
                <Text style={[ef.saveExBtnText, { color: theme.text, fontFamily: 'Inter_900Black' }]}>ADD EXERCISE TO SESSION</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[ef.finalSaveBtn, { backgroundColor: theme.text, opacity: ((exerciseList.length === 0 && exSets.length === 0) || submitting) ? 0.4 : 1 }]}
                onPress={saveGymSession}
                disabled={(exerciseList.length === 0 && exSets.length === 0) || submitting}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Save session to your log"
              >
                <Text style={[ef.finalSaveText, { color: theme.bg, fontFamily: 'Inter_900Black' }]}>{submitting ? 'SAVING...' : 'SAVE SESSION'}</Text>
              </TouchableOpacity>
              <Text style={[s.fine, { color: theme.textTertiary, fontFamily: 'Inter_500Medium', marginHorizontal: 20 }]}>Saving records the session for {formatShortDate(selectedDate)}. Closing keeps a draft on this device.</Text>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView></DarkBackground>
  );
}

// ── Rating slider ─────────────────────────────────────────────────────────────
// A 1–10 track: small dots at each step (dark up to the selected value), with the
// selected value shown as a larger knob (the number sits inside it, on the line).
function RatingSlider({ value, onChange, theme }: { value: number; onChange: (n: number) => void; theme: any }) {
  const fillW = Math.max(0, ((value - 0.5) / 10 - 0.05) * 100); // dark track up to the knob

  return (
    <View style={rs.wrap}>
      {/* track */}
      <View style={[rs.trackFull, { backgroundColor: theme.border }]} />
      <View style={[rs.trackFill, { width: `${fillW}%`, backgroundColor: theme.text }]} />

      {/* dots / knob */}
      <View style={rs.row}>
        {Array.from({ length: 10 }).map((_, i) => {
          const n = i + 1;
          const active = n === value;
          const passed = n <= value;
          return (
            <TouchableOpacity
              key={n}
              style={rs.cell}
              onPress={() => onChange(n)}
              activeOpacity={0.7}
              hitSlop={{ top: 14, bottom: 14, left: 4, right: 4 }}
            >
              {active ? (
                <View style={[rs.knob, { backgroundColor: theme.card, borderColor: theme.text }]}>
                  <Text style={[rs.knobNum, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{n}</Text>
                </View>
              ) : (
                <View style={[rs.dot, { backgroundColor: passed ? theme.text : theme.borderStrong }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* number labels */}
      <View style={rs.labels}>
        {Array.from({ length: 10 }).map((_, i) => {
          const n = i + 1;
          const active = n === value;
          return (
            <View key={n} style={rs.labelCell}>
              <Text style={[rs.labelNum, {
                color: active ? theme.text : theme.textMuted,
                fontFamily: active ? 'Inter_900Black' : 'Inter_700Bold',
              }]}>{n}</Text>
            </View>
          );
        })}
      </View>

      {/* ends */}
      <View style={rs.ends}>
        <Text style={[rs.endText, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>VERY EASY</Text>
        <Text style={[rs.endText, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>MAX EFFORT</Text>
      </View>
    </View>
  );
}

const rs = StyleSheet.create({
  wrap:      { marginTop: 16, marginBottom: 18, position: 'relative' },
  trackFull: { position: 'absolute', left: '5%', right: '5%', top: 26, height: 3, borderRadius: 2 },
  trackFill: { position: 'absolute', left: '5%', top: 26, height: 3, borderRadius: 2 },
  row:       { flexDirection: 'row', height: 56, alignItems: 'center' },
  cell:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dot:       { width: 8, height: 8, borderRadius: 4 },
  knob:      { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  knobNum:   { fontSize: 15 },
  labels:    { flexDirection: 'row', marginTop: 4 },
  labelCell: { flex: 1, alignItems: 'center' },
  labelNum:  { fontSize: 13 },
  ends:      { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 2 },
  endText:   { fontSize: 9, letterSpacing: 1 },
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
function SessionCard({ log, theme, onRepeat }: { log: WorkoutLog; theme: any; onRepeat?: () => void }) {
  const time = log.createdAt ? new Date(log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  const isQuick   = log.mode === 'simple';
  const bpMeta    = log.bodyPart ? BODY_PARTS.find(b => b.key === log.bodyPart) : null;
  const exercises = Array.isArray(log.exercises) ? log.exercises : [];

  // Top label
  let topIcon = '';
  let topLabel = '';
  if (isQuick) { topLabel = 'RATING'; }
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
        <View style={[sc.scorePill, { backgroundColor: theme.surfaceStrong }]} accessibilityLabel={`Session score ${log.score} out of 100`}>
          <Text style={[sc.scoreText, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>{log.score}/100</Text>
        </View>
        {onRepeat && (
          <TouchableOpacity onPress={onRepeat} style={{ minHeight: 36, paddingHorizontal: 8, justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="Repeat this session as a new draft">
            <Text style={{ fontSize: 12, color: theme.text, fontFamily: 'Inter_700Bold' }}>Repeat</Text>
          </TouchableOpacity>
        )}
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
  safe:        { flex: 1 },
  datesRow:    { paddingHorizontal: 14, paddingBottom: 10 },
  scroll:      { paddingBottom: 110 },
  lead:        { fontSize: 17, lineHeight: 22 },
  leadSub:     { fontSize: 13, lineHeight: 18, marginTop: 4 },
  actions:     { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 12 },
  fine:        { fontSize: 12, lineHeight: 17, marginTop: 10 },
  kindGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  kindTile:    { flexGrow: 1, flexBasis: '45%', minHeight: 84, padding: 12, borderWidth: 1, borderRadius: 14, gap: 2 },
  kindIcon:    { fontSize: 20, marginBottom: 2 },
  kindLabel:   { fontSize: 14 },
  kindSub:     { fontSize: 12, lineHeight: 16 },
  prefillNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 10, borderWidth: 1, borderRadius: 12 },
  prefillText: { flex: 1, fontSize: 12, lineHeight: 17 },
  form:        { marginTop: 6, gap: 10 },
  formLabel:   { fontSize: 10, letterSpacing: 1.5, marginTop: 14, marginBottom: 6 },
  bodyGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bodyCard:    { flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 12, borderWidth: 1, borderRadius: 14 },
  bodyIconBubble: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bodyIcon:    { fontSize: 18 },
  bodyLabel:   { flex: 1, fontSize: 14 },
  chipRow:     { gap: 8, paddingVertical: 2 },
  chip:        { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1.5, borderRadius: 999 },
  chipText:    { fontSize: 13 },
  input:       { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 46, fontSize: 15 },
  dualRow:     { flexDirection: 'row', gap: 8 },
  dualBtn:     { flex: 1, minHeight: 46, borderWidth: 1.5, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dualBtnText: { fontSize: 14 },
  numRow:      { flexDirection: 'row', gap: 8 },
  ratingHead:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ratingNum:   { fontSize: 44, lineHeight: 48, letterSpacing: -2 },
  ratingDenom: { fontSize: 16, letterSpacing: 0 },
  ratingTier:  { fontSize: 15 },
  ratingCopy:  { fontSize: 13, lineHeight: 18 },
  movRow:      { flexDirection: 'row', gap: 12 },
});

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
