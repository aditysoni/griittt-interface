import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, KeyboardAvoidingView, Modal, Platform, Pressable,
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

type TabMode = 'quick' | 'session';
const RATING_LABELS = ['Rest','Very light','Light','Easy','Moderate','Medium','Good','Strong','Very strong','Excellent','Elite'];

const TRAINING_TYPES: { key: TrainingType; label: string; icon: string; sub: string }[] = [
  { key: 'gym',    label: 'GYM',           icon: '🏋️', sub: 'Pick a body part' },
  { key: 'sports', label: 'SPORTS',        icon: '🏀', sub: 'Pick a sport' },
  { key: 'cardio', label: 'RUN / WALK',    icon: '🏃', sub: 'Distance & time' },
];

export default function StrengthScreen() {
  const { token } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState(today());
  const [mode, setMode]                 = useState<TabMode>('quick');
  const [logs, setLogs]                 = useState<WorkoutLog[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [submitting, setSubmitting]     = useState(false);

  // Tab animation
  const tabAnim = useRef(new Animated.Value(0)).current;
  const [tabContainerW, setTabContainerW] = useState(0);
  function switchMode(tab: TabMode) {
    setMode(tab);
    Animated.spring(tabAnim, {
      toValue: tab === 'quick' ? 0 : 1,
      useNativeDriver: false,
      damping: 18, stiffness: 220, mass: 0.8,
    }).start();
  }

  // Quick mode state
  const [rating, setRating] = useState(7);
  const [showRatingPicker, setShowRatingPicker] = useState(false);

  // Session mode state
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
  }
  useEffect(() => { load(selectedDate).finally(() => setLoading(false)); }, [token, selectedDate]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(selectedDate); setRefreshing(false); }, [token, selectedDate]);

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
        {/* QUICK / SESSION tabs */}
        <View style={s.tabToggle} onLayout={e => setTabContainerW(e.nativeEvent.layout.width)}>
          {tabContainerW > 0 && (
            <Animated.View style={[s.tabPill, {
              width: tabContainerW / 2,
              transform: [{ translateX: tabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, tabContainerW / 2] }) }],
            }]} />
          )}
          <TouchableOpacity style={s.tabBtn} onPress={() => switchMode('quick')} activeOpacity={0.8}>
            <Text style={[s.tabBtnText, { color: mode === 'quick' ? '#000' : 'rgba(255,255,255,0.4)', fontFamily: 'Inter_900Black' }]}>QUICK</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.tabBtn} onPress={() => switchMode('session')} activeOpacity={0.8}>
            <Text style={[s.tabBtnText, { color: mode === 'session' ? '#000' : 'rgba(255,255,255,0.4)', fontFamily: 'Inter_900Black' }]}>SESSION</Text>
          </TouchableOpacity>
        </View>

        {/* ── QUICK: rating card ── */}
        {mode === 'quick' && isToday && (
          <>
            <TouchableOpacity
              style={[s.ratingCard, { borderColor: theme.border }]}
              onPress={() => setShowRatingPicker(true)}
              activeOpacity={0.85}
            >
              <View style={s.ratingCardTop}>
                <Text style={[s.ratingCardLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>HOW DID IT GO TODAY?</Text>
                <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
              </View>
              <View style={s.ratingCardCenter}>
                <Text style={[s.ratingCardBig, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{rating}<Text style={[s.ratingCardSlash, { color: theme.textSecondary }]}>/10</Text></Text>
                <Text style={[s.ratingCardWord, { color: '#34C759', fontFamily: 'Inter_700Bold' }]}>{RATING_LABELS[rating]}</Text>
              </View>
              <View style={s.ratingBars}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <View key={i} style={[s.ratingBar, { backgroundColor: i < rating ? '#34C759' : 'rgba(255,255,255,0.08)' }]} />
                ))}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: theme.tabActiveBg, opacity: submitting ? 0.4 : 1 }]}
              onPress={submitQuick} disabled={submitting}
            >
              <Text style={[s.submitBtnText, { color: theme.tabActiveText, fontFamily: 'Inter_900Black' }]}>{submitting ? 'LOGGING...' : 'LOG ACTIVITY →'}</Text>
            </TouchableOpacity>

            <Modal visible={showRatingPicker} transparent animationType="slide">
              <Pressable style={bs.backdrop} onPress={() => setShowRatingPicker(false)} />
              <View style={[bs.sheet, { backgroundColor: theme.isDark ? '#1A1A1A' : '#FFFFFF' }]}>
                <View style={[bs.handle, { backgroundColor: theme.border }]} />
                <Text style={[bs.title, { color: theme.text, fontFamily: 'Inter_900Black' }]}>PHYSICAL ACTIVITY</Text>
                <Text style={[bs.sub, { color: '#34C759', fontFamily: 'Inter_700Bold' }]}>{RATING_LABELS[rating]}</Text>
                <RatingScroll value={rating} onChange={setRating} theme={theme} />
                <TouchableOpacity style={[bs.doneBtn, { backgroundColor: theme.text }]} onPress={() => setShowRatingPicker(false)}>
                  <Text style={[bs.doneBtnText, { color: theme.bg, fontFamily: 'Inter_900Black' }]}>DONE</Text>
                </TouchableOpacity>
              </View>
            </Modal>
          </>
        )}

        {/* ── SESSION: training-type picker → either GYM body parts or inline form ── */}
        {mode === 'session' && isToday && (
          <>
            <Text style={[s.sectionHint, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>CHOOSE YOUR TRAINING</Text>
            <View style={s.trainingRow}>
              {TRAINING_TYPES.map(tt => {
                const active = trainingType === tt.key;
                return (
                  <TouchableOpacity
                    key={tt.key}
                    style={[s.trainingCard, {
                      borderColor: active ? theme.text : theme.border,
                      backgroundColor: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                    }]}
                    onPress={() => setTrainingType(active ? null : tt.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.trainingIcon}>{tt.icon}</Text>
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
                  {BODY_PARTS.filter(b => b.key !== 'cardio').map(bp => (
                    <TouchableOpacity
                      key={bp.key}
                      style={[s.bodyCard, { borderColor: theme.border }]}
                      onPress={() => openBodyPart(bp.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={s.bodyIcon}>{bp.icon}</Text>
                      <Text style={[s.bodyLabel, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>{bp.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* SPORTS inline form */}
            {trainingType === 'sports' && (
              <View style={s.inlineForm}>
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
                  style={[s.input, { color: theme.text, borderColor: theme.border, fontFamily: 'Inter_700Bold' }]}
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
              <View style={s.inlineForm}>
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
      </ScrollView>

      {/* ── GYM body-part / multi-set exercise modal ── */}
      <Modal visible={!!activeBodyPart} transparent animationType="slide" onRequestClose={() => setActiveBodyPart(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={ef.backdrop} onPress={() => setActiveBodyPart(null)} />
          <View style={[ef.sheet, { backgroundColor: theme.isDark ? '#111' : '#FFF' }]}>
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
                    style={[ef.suggestChip, { borderColor: theme.border, backgroundColor: exName === sg ? theme.text : 'transparent' }]}
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
                style={[ef.nameInput, { color: theme.text, borderColor: theme.border, fontFamily: 'Inter_700Bold' }]}
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
                    <View key={i} style={[ef.setRow, { borderColor: theme.border }]}>
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
                style={[ef.saveExBtn, { backgroundColor: 'rgba(255,255,255,0.08)', opacity: (exSets.length === 0 || !exName.trim()) ? 0.4 : 1 }]}
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
            <Text style={{ fontSize: active ? 40 : 28, lineHeight: 48, color: active ? '#FFFFFF' : 'rgba(255,255,255,0.2)', fontFamily: active ? 'Inter_900Black' : 'Inter_500Medium' }}>{n}</Text>
            {active && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#34C759' }} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const bs = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
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
    <View style={[ef.numField, { borderColor: theme.border }]}>
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
        <View style={[sc.badge, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
          {!!topIcon && <Text style={sc.badgeIcon}>{topIcon}</Text>}
          <Text style={[sc.badgeText, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>{topLabel}</Text>
        </View>
        <View style={{ flex: 1 }} />
        {!!time && <Text style={[sc.time, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>{time}</Text>}
        <View style={[sc.scorePill, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
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

  tabToggle:      { flexDirection: 'row', marginHorizontal: 16, marginBottom: 4, height: 46, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden', position: 'relative' },
  tabPill:        { position: 'absolute', top: 0, left: 0, height: 46, backgroundColor: '#FFF', borderRadius: 12 },
  tabBtn:         { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  tabBtnText:     { fontSize: 11, letterSpacing: 3 },

  ratingCard:     { marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderRadius: 16, padding: 18, gap: 14 },
  ratingCardTop:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ratingCardLabel:{ fontSize: 9, letterSpacing: 2 },
  ratingCardCenter:{ alignItems: 'center', gap: 4 },
  ratingCardBig:  { fontSize: 56, letterSpacing: -2 },
  ratingCardSlash:{ fontSize: 24 },
  ratingCardWord: { fontSize: 11, letterSpacing: 2 },
  ratingBars:     { flexDirection: 'row', gap: 4, marginTop: 6 },
  ratingBar:      { flex: 1, height: 5, borderRadius: 3 },

  // Training type chooser
  sectionHint:    { fontSize: 9, letterSpacing: 3, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 10 },
  trainingRow:    { flexDirection: 'row', paddingHorizontal: 14, gap: 8 },
  trainingCard:   { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 6 },
  trainingIcon:   { fontSize: 26 },
  trainingLabel:  { fontSize: 11, letterSpacing: 2 },
  trainingSub:    { fontSize: 8, letterSpacing: 0.5, textAlign: 'center' },

  // Body grid
  bodyGrid:       { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, gap: 8 },
  bodyCard:       { width: '31.5%', aspectRatio: 1, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8 },
  bodyIcon:       { fontSize: 28 },
  bodyLabel:      { fontSize: 9, letterSpacing: 1.5 },

  // Inline forms for sports / cardio
  inlineForm:     { marginHorizontal: 16, marginTop: 12, gap: 10 },
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
  submitBtn:      { marginHorizontal: 16, marginTop: 16, paddingVertical: 16, alignItems: 'center', borderRadius: 12 },
  submitBtnText:  { fontSize: 10, letterSpacing: 4 },
  empty:          { alignItems: 'center', paddingVertical: 48 },
  emptyText:      { fontSize: 9, letterSpacing: 3 },
});

// Exercise form modal styles
const ef = StyleSheet.create({
  backdrop:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
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
