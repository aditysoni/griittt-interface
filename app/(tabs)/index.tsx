import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DarkBackground } from '../../components/DarkBackground';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import { habits, Task, tasks, today, CONTROL_PRESETS, challenges } from '../../lib/api';
import { LoadingScreen } from '../../components/LoadingScreen';
import Svg, { Circle, G } from 'react-native-svg';
import { DaySelector } from '../../components/DaySelector';
import { useTheme } from '../../components/ThemeContext';
import { useFocusEffect, useRouter } from 'expo-router';

type HabitType = 'build' | 'control';
type TimeSlot  = 'morning' | 'afternoon' | 'evening' | 'night' | 'allday';
type HabitWithStatus = Task & { done: boolean; streak: number; count: number | null };

const TIME_SLOTS: { key: TimeSlot; label: string; color: string }[] = [
  { key: 'morning',   label: 'MORNING',   color: '#F59E0B' },
  { key: 'afternoon', label: 'AFTERNOON', color: '#3B82F6' },
  { key: 'evening',   label: 'EVENING',   color: '#F97316' },
  { key: 'night',     label: 'NIGHT',     color: '#8B5CF6' },
  { key: 'allday',    label: 'ALL DAY',   color: '#EF4444' },
];

function shiftDate(base: string, days: number): string {
  const d = new Date(base); d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function toughnessColor(score: number, isDark: boolean): string {
  if (score <= 3) return isDark ? '#34C759' : '#16A34A';
  if (score <= 6) return '#F59E0B';
  return '#EF4444';
}

const TOUGHNESS_OPTIONS = [1,2,3,4,5,6,7,8,9,10];

export default function HabitsScreen() {
  const { token } = useAuth();
  const { theme } = useTheme();
  const [selectedDate, setSelectedDate] = useState(today());
  const [activeTab, setActiveTab]       = useState<HabitType>('build');
  const [tabContainerW, setTabContainerW] = useState(0);
  const tabAnim = useRef(new Animated.Value(0)).current; // 0 = build (left), 1 = control (right)

  function switchTab(tab: HabitType) {
    setActiveTab(tab);
    Animated.spring(tabAnim, {
      toValue: tab === 'build' ? 0 : 1,
      useNativeDriver: false,
      damping: 18,
      stiffness: 220,
      mass: 0.8,
    }).start();
  }
  const [habitList, setHabitList]       = useState<HabitWithStatus[]>([]);
  const [challengeNames, setChallengeNames] = useState<Set<string>>(new Set());
  const [discipline, setDiscipline]     = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [timeSlot, setTimeSlot]         = useState<TimeSlot>('morning');
  const [showAdd, setShowAdd]           = useState(false);
  const [newName, setNewName]           = useState('');
  const [newType, setNewType]           = useState<HabitType>('build');
  const [newScore, setNewScore]         = useState(5);
  const [newTrackCount, setNewTrackCount] = useState(false);
  const [newUnit, setNewUnit]           = useState('');
  const [newDays, setNewDays]           = useState<number[]>([0,1,2,3,4,5,6]);
  const [adding, setAdding]             = useState(false);
  const [detailHabit, setDetailHabit]   = useState<HabitWithStatus | null>(null);

  // Control habit Y-pressed tracking (local — lost on refresh, persists during session)
  const [yPressedIds, setYPressedIds]   = useState<Set<string>>(new Set());

  // Count input modal state
  const [countHabit, setCountHabit]     = useState<HabitWithStatus | null>(null);
  const [countInput, setCountInput]     = useState('');

  const isToday = selectedDate === today();

  async function load(date: string) {
    if (!token) return;
    try {
      const [taskList, statusList, disc] = await Promise.all([
        tasks.list(token),
        habits.allStatus(token, date),
        habits.disciplineDay(token, date).catch(() => null),
      ]);
      const statusMap = new Map(statusList.map(s => [s.id, s]));
      const merged = taskList
        .filter(t => !t.archived_at)
        .map(t => ({
          ...t,
          done:   statusMap.get(t.id)?.done   ?? false,
          streak: statusMap.get(t.id)?.streak ?? 0,
          count:  statusMap.get(t.id)?.count  ?? null,
        }));
      setHabitList(merged);
      setDiscipline(disc);
    } catch (err: any) { Alert.alert('Error', err.message); }

    // Challenges fetched separately so a slow or failing /challenges call
    // can never block the habits screen from rendering. Yellow borders just
    // light up once this resolves.
    challenges.list(token)
      .then(challengeList => {
        const activeChallengeTitles = new Set(
          challengeList
            .filter(c => c.status === 'active')
            .map(c => c.title.trim().toLowerCase())
        );
        setChallengeNames(activeChallengeTitles);
      })
      .catch(() => {});
  }

  useEffect(() => { load(selectedDate).finally(() => setLoading(false)); }, [token, selectedDate]);
  useEffect(() => { setYPressedIds(new Set()); }, [selectedDate]);

  // Refresh whenever we come back to this screen — e.g. after joining a
  // challenge on the GRIND tab, so the new habit shows up immediately.
  useFocusEffect(
    useCallback(() => { load(selectedDate); }, [token, selectedDate])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(selectedDate); setRefreshing(false);
  }, [token, selectedDate]);

  function recomputeOptimisticScore(list: HabitWithStatus[]) {
    const bw  = list.filter(h => h.category !== 'control').reduce((s, h) => s + (h.score || 1), 0);
    const bdw = list.filter(h => h.category !== 'control' && h.done).reduce((s, h) => s + (h.score || 1), 0);
    const cw  = list.filter(h => h.category === 'control').reduce((s, h) => s + (h.score || 1), 0);
    const cdw = list.filter(h => h.category === 'control' && h.done).reduce((s, h) => s + (h.score || 1), 0);
    const bScore = bw > 0 ? Math.round((bdw / bw) * 100) : 0;
    const cScore = cw > 0 ? Math.round((cdw / cw) * 100) : 0;
    const overall = cw > 0 ? Math.round(bScore * 0.6 + cScore * 0.4) : bScore;
    setDiscipline((prev: any) => ({ ...(prev ?? {}), buildScore: bScore, controlScore: cScore, overallScore: overall }));
  }

  async function toggleHabit(habit: HabitWithStatus) {
    if (!token || !isToday) return;

    // If habit tracks count, open the count modal instead of toggling directly
    if (habit.track_count && !habit.done) {
      setCountHabit(habit);
      setCountInput('');
      return;
    }

    const nowDone = !habit.done;

    // Optimistic UI
    setHabitList(l => l.map(h => h.id === habit.id ? { ...h, done: nowDone, count: nowDone ? h.count : null } : h));
    const updatedList = habitList.map(h => h.id === habit.id ? { ...h, done: nowDone } : h);
    recomputeOptimisticScore(updatedList);

    try {
      if (nowDone) await habits.complete(token, habit.name, habit.id);
      else await habits.uncomplete(token, habit.name);
      const disc = await habits.disciplineDay(token, selectedDate).catch(() => null);
      if (disc) setDiscipline(disc);
    } catch (err: any) {
      setHabitList(l => l.map(h => h.id === habit.id ? { ...h, done: habit.done } : h));
      Alert.alert('Error', err.message);
    }
  }

  async function handleControlN(habit: HabitWithStatus) {
    if (!token || !isToday) return;
    const wasY = yPressedIds.has(habit.id);
    setYPressedIds(prev => { const s = new Set(prev); s.delete(habit.id); return s; });
    if (habit.done) return; // already N-selected

    setHabitList(l => l.map(h => h.id === habit.id ? { ...h, done: true } : h));
    const updatedList = habitList.map(h => h.id === habit.id ? { ...h, done: true } : h);
    recomputeOptimisticScore(updatedList);

    try {
      await habits.complete(token, habit.name, habit.id);
      const disc = await habits.disciplineDay(token, selectedDate).catch(() => null);
      if (disc) setDiscipline(disc);
    } catch (err: any) {
      setHabitList(l => l.map(h => h.id === habit.id ? { ...h, done: false } : h));
      if (wasY) setYPressedIds(prev => new Set([...prev, habit.id]));
      Alert.alert('Error', err.message);
    }
  }

  async function handleControlY(habit: HabitWithStatus) {
    if (!token || !isToday) return;
    setYPressedIds(prev => new Set([...prev, habit.id]));
    if (!habit.done) return; // already not done, just mark Y visually

    setHabitList(l => l.map(h => h.id === habit.id ? { ...h, done: false } : h));
    const updatedList = habitList.map(h => h.id === habit.id ? { ...h, done: false } : h);
    recomputeOptimisticScore(updatedList);

    try {
      await habits.uncomplete(token, habit.name);
      const disc = await habits.disciplineDay(token, selectedDate).catch(() => null);
      if (disc) setDiscipline(disc);
    } catch (err: any) {
      setHabitList(l => l.map(h => h.id === habit.id ? { ...h, done: true } : h));
      setYPressedIds(prev => { const s = new Set(prev); s.delete(habit.id); return s; });
      Alert.alert('Error', err.message);
    }
  }

  async function submitCount() {
    if (!token || !countHabit) return;
    const raw = countInput.trim();
    const num = raw === '' ? 0 : Number(raw);
    if (Number.isNaN(num) || num < 0) { Alert.alert('Invalid', 'Enter a non-negative number.'); return; }

    const habit = countHabit;
    setCountHabit(null);

    // Optimistic UI: mark done with count
    setHabitList(l => l.map(h => h.id === habit.id ? { ...h, done: true, count: num } : h));
    const updatedList = habitList.map(h => h.id === habit.id ? { ...h, done: true } : h);
    recomputeOptimisticScore(updatedList);

    try {
      await habits.complete(token, habit.name, habit.id, num);
      const disc = await habits.disciplineDay(token, selectedDate).catch(() => null);
      if (disc) setDiscipline(disc);
    } catch (err: any) {
      setHabitList(l => l.map(h => h.id === habit.id ? { ...h, done: false, count: null } : h));
      Alert.alert('Error', err.message);
    }
  }

  async function addHabit() {
    if (!token || !newName.trim()) return;
    setAdding(true);
    try {
      const isControl = newType === 'control';
      const task = await tasks.create(token, {
        name: newName.trim(),
        category: newType,
        score: newScore,
        days: newDays,
        trackCount: isControl ? true : newTrackCount,
        countUnit: (isControl || newTrackCount) ? (newUnit.trim() || null) : null,
      });
      setHabitList(l => [...l, { ...task, done: false, streak: 0, count: null }]);
      setShowAdd(false);
      setNewName(''); setNewType('build'); setNewScore(5);
      setNewTrackCount(false); setNewUnit(''); setNewDays([0,1,2,3,4,5,6]);
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setAdding(false); }
  }

  const buildHabits   = habitList.filter(h => h.category !== 'control');
  const controlHabits = habitList.filter(h => h.category === 'control');
  const isControl     = activeTab === 'control';
  const visibleHabits = isControl ? controlHabits : buildHabits;
  const slotColor     = TIME_SLOTS.find(t => t.key === timeSlot)?.color ?? '#FFFFFF';

  const overallScore  = discipline?.overallScore ?? 0;
  const totalDone     = habitList.filter(h => h.done).length;

  const router = useRouter();

  if (loading) return <LoadingScreen />;

  return (
    <DarkBackground><SafeAreaView style={s.safe} edges={['top']}>

      {/* ── Top bar ── */}
      <View style={s.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={[s.modeEyebrow, { color: theme.textTertiary, fontFamily: 'Inter_700Bold' }]}>
            DISCIPLINE MODE
          </Text>
          <Text style={[s.modeTitle, { color: theme.text, fontFamily: 'Inter_900Black' }]}>
            LOCK IN
          </Text>
        </View>
        <TouchableOpacity
          style={[s.sparkleBtn, { backgroundColor: theme.inverse }]}
          onPress={() => router.push('/(tabs)/ai')}
          activeOpacity={0.85}
        >
          <Ionicons name="sparkles" size={16} color={theme.accent} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.iconBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => router.push('/(tabs)/profile')}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Top bar row 2: dates ── */}
      <View style={s.datesRow}>
        <DaySelector selectedDate={selectedDate} onSelect={setSelectedDate} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />}
      >
        {/* Gauge + status */}
        <ArcGauge value={overallScore} theme={theme} />
        <View style={s.momentumWrap}>
          <MomentumPill score={overallScore} theme={theme} />
        </View>

        {/* ── BUILD / CONTROL segmented control ── */}
        <View
          style={[s.segmented, { backgroundColor: theme.surface }]}
          onLayout={e => setTabContainerW(e.nativeEvent.layout.width)}
        >
          {tabContainerW > 0 && (
            <Animated.View
              style={[s.segmentedPill, {
                backgroundColor: theme.card,
                width: (tabContainerW - 8) / 2,
                transform: [{
                  translateX: tabAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, (tabContainerW - 8) / 2],
                  }),
                }],
              }]}
            />
          )}
          <TouchableOpacity style={s.segmentedBtn} onPress={() => switchTab('build')} activeOpacity={0.8}>
            <Text style={[s.segmentedText, {
              color: activeTab === 'build' ? theme.text : theme.textSecondary,
              fontFamily: 'Inter_900Black',
            }]}>BUILD</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.segmentedBtn} onPress={() => switchTab('control')} activeOpacity={0.8}>
            <Text style={[s.segmentedText, {
              color: activeTab === 'control' ? theme.text : theme.textSecondary,
              fontFamily: 'Inter_900Black',
            }]}>CONTROL</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row: X / Y DONE  |  +N SCORE */}
        <View style={s.statRow}>
          <Text style={[s.statLeft, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
            {visibleHabits.filter(h => h.done).length} / {visibleHabits.length} DONE
          </Text>
          <Text style={[s.statRight, { color: theme.textTertiary, fontFamily: 'Inter_700Bold' }]}>
            +{visibleHabits.filter(h => h.done).reduce((a, h) => a + (h.score || 1), 0)} SCORE
          </Text>
        </View>

        {/* Habit list */}
        {visibleHabits.length === 0 ? (
          <View style={s.empty}>
            <Text style={[s.emptyText, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              No {isControl ? 'control' : 'build'} habits yet.{'\n'}Tap + to add one.
            </Text>
          </View>
        ) : (
          visibleHabits.map(habit => (
            <HabitRow
              key={habit.id}
              habit={habit}
              theme={theme}
              canToggle={isToday}
              isControl={isControl}
              ySelected={isControl ? yPressedIds.has(habit.id) : false}
              fromChallenge={challengeNames.has(habit.name.trim().toLowerCase())}
              onToggle={isControl ? undefined : () => toggleHabit(habit)}
              onPressN={isControl ? () => handleControlN(habit) : undefined}
              onPressY={isControl ? () => handleControlY(habit) : undefined}
              onInfo={() => setDetailHabit(habit)}
            />
          ))
        )}
      </ScrollView>

      {/* Habit Detail Modal */}
      {detailHabit && (
        <HabitDetailModal
          habit={detailHabit}
          token={token!}
          userId={undefined}
          theme={theme}
          onClose={() => setDetailHabit(null)}
          onChanged={() => { setDetailHabit(null); load(selectedDate); }}
        />
      )}

      {/* Floating + button — ink circle with white plus */}
      <TouchableOpacity
        style={[s.fab, { backgroundColor: theme.text }]}
        onPress={() => setShowAdd(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add Habit Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <View style={[s.modal, { backgroundColor: theme.bg }]}>
          <View style={[s.modalHandle, { backgroundColor: theme.border }]} />
          <View style={[s.modalHeader, { borderBottomColor: theme.border }]}>
            <Text style={[s.modalTitle, { color: theme.text, fontFamily: 'Inter_900Black' }]}>NEW HABIT</Text>
            <TouchableOpacity onPress={() => { setShowAdd(false); setNewName(''); }}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.modalBody}>
            {/* Type toggle */}
            <Text style={[s.fieldLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>TYPE</Text>
            <View style={[s.typeToggle, { backgroundColor: theme.surface }]}>
              {(['build', 'control'] as HabitType[]).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.typeBtn, newType === t && { backgroundColor: theme.tabActiveBg }]}
                  onPress={() => setNewType(t)}
                >
                  <Text style={[s.typeBtnText, { color: newType === t ? theme.tabActiveText : theme.textSecondary, fontFamily: 'Inter_900Black' }]}>
                    {t.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Control presets — shown only for control type */}
            {newType === 'control' && (
              <>
                <Text style={[s.fieldLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>QUICK PICK</Text>
                <View style={s.presetGrid}>
                  {CONTROL_PRESETS.map(p => {
                    const active = newName.trim().toLowerCase() === p.name.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={p.name}
                        style={[s.presetChip, {
                          borderColor: active ? theme.text : theme.border,
                          backgroundColor: active ? theme.text : 'transparent',
                        }]}
                        onPress={() => { setNewName(p.name); setNewUnit(p.unit); }}
                        activeOpacity={0.7}
                      >
                        <Text style={s.presetIcon}>{p.icon}</Text>
                        <Text style={[s.presetText, {
                          color: active ? theme.bg : theme.textSecondary,
                          fontFamily: 'Inter_700Bold',
                        }]}>{p.name.toUpperCase()}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={[s.fieldLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>HABIT NAME</Text>
            <TextInput
              style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface, fontFamily: 'Inter_500Medium' }]}
              value={newName}
              onChangeText={setNewName}
              placeholder={newType === 'build' ? 'e.g. MORNING RUN' : 'e.g. NO CIGARETTES'}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="characters"
            />

            {/* Track count: auto-on for control, optional for build */}
            {newType === 'build' && (
              <TouchableOpacity
                style={[s.trackToggle, { borderColor: theme.border }]}
                onPress={() => setNewTrackCount(v => !v)}
                activeOpacity={0.7}
              >
                <View style={[s.trackCheckbox, {
                  backgroundColor: newTrackCount ? theme.text : 'transparent',
                  borderColor: newTrackCount ? theme.text : theme.border,
                }]}>
                  {newTrackCount && <Ionicons name="checkmark" size={11} color={theme.bg} />}
                </View>
                <Text style={[s.trackLabel, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>TRACK COUNT</Text>
                <Text style={[s.trackHint, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                  e.g. glasses of water, pages read
                </Text>
              </TouchableOpacity>
            )}

            {(newType === 'control' || newTrackCount) && (
              <>
                <Text style={[s.fieldLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>UNIT (OPTIONAL)</Text>
                <TextInput
                  style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface, fontFamily: 'Inter_500Medium' }]}
                  value={newUnit}
                  onChangeText={setNewUnit}
                  placeholder={newType === 'control' ? 'cigarettes, drinks, minutes...' : 'glasses, pages, reps...'}
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                />
              </>
            )}

            <Text style={[s.fieldLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>DAYS</Text>
            <View style={s.daysRow}>
              {['M','T','W','T','F','S','S'].map((label, i) => {
                const active = newDays.includes(i);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.dayChip, {
                      backgroundColor: active ? theme.text : 'transparent',
                      borderColor: active ? theme.text : theme.border,
                    }]}
                    onPress={() => setNewDays(prev =>
                      prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
                    )}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.dayChipText, {
                      color: active ? theme.bg : theme.textSecondary,
                      fontFamily: 'Inter_900Black',
                    }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[s.dayAllBtn, {
                  backgroundColor: newDays.length === 7 ? theme.text : 'transparent',
                  borderColor: newDays.length === 7 ? theme.text : theme.border,
                }]}
                onPress={() => setNewDays(newDays.length === 7 ? [] : [0,1,2,3,4,5,6])}
                activeOpacity={0.7}
              >
                <Text style={[s.dayChipText, {
                  color: newDays.length === 7 ? theme.bg : theme.textSecondary,
                  fontFamily: 'Inter_900Black',
                }]}>ALL</Text>
              </TouchableOpacity>
            </View>

            <Text style={[s.fieldLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
              TOUGHNESS — <Text style={{ color: toughnessColor(newScore, theme.isDark) }}>{newScore}/10</Text>
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scoreScroll}>
              {TOUGHNESS_OPTIONS.map(n => {
                const active = newScore === n;
                const col = toughnessColor(n, theme.isDark);
                return (
                  <TouchableOpacity
                    key={n}
                    style={[s.scoreChip, {
                      borderColor: active ? col : theme.border,
                      backgroundColor: active ? col + '20' : theme.surface,
                    }]}
                    onPress={() => setNewScore(n)}
                  >
                    <Text style={[s.scoreChipText, { color: active ? col : theme.textSecondary, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: theme.tabActiveBg, opacity: (!newName.trim() || adding) ? 0.4 : 1 }]}
              onPress={addHabit}
              disabled={!newName.trim() || adding}
            >
              <Text style={[s.submitBtnText, { color: theme.tabActiveText, fontFamily: 'Inter_900Black' }]}>
                {adding ? 'ADDING...' : 'ADD HABIT'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Count input modal */}
      <Modal visible={!!countHabit} transparent animationType="fade" onRequestClose={() => setCountHabit(null)}>
        <Pressable style={cs.backdrop} onPress={() => setCountHabit(null)}>
          <Pressable style={[cs.card, { backgroundColor: theme.bg, borderColor: theme.border }]} onPress={e => e.stopPropagation()}>
            <Text style={[cs.title, { color: theme.text, fontFamily: 'Inter_900Black' }]}>
              {countHabit?.category === 'control' ? 'HOW MUCH TODAY?' : 'COUNT TODAY'}
            </Text>
            <Text style={[cs.subtitle, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
              {countHabit?.name}
            </Text>

            <View style={cs.inputRow}>
              <TextInput
                style={[cs.input, { color: theme.text, borderColor: theme.border, fontFamily: 'SpaceGrotesk_700Bold' }]}
                value={countInput}
                onChangeText={setCountInput}
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                autoFocus
              />
              {!!countHabit?.count_unit && (
                <Text style={[cs.unit, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                  {countHabit.count_unit}
                </Text>
              )}
            </View>

            <View style={cs.btnRow}>
              <TouchableOpacity
                style={[cs.btnGhost, { borderColor: theme.border }]}
                onPress={() => setCountHabit(null)}
                activeOpacity={0.7}
              >
                <Text style={[cs.btnGhostText, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[cs.btnFill, { backgroundColor: theme.text }]}
                onPress={submitCount}
                activeOpacity={0.7}
              >
                <Text style={[cs.btnFillText, { color: theme.bg, fontFamily: 'Inter_900Black' }]}>SAVE</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
    </DarkBackground>
  );
}

const cs = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card:        { width: '100%', maxWidth: 360, borderWidth: 1, borderRadius: 16, padding: 22 },
  title:       { fontSize: 13, letterSpacing: 3, textAlign: 'center' },
  subtitle:    { fontSize: 12, letterSpacing: 0.5, textAlign: 'center', marginTop: 6, marginBottom: 18 },
  inputRow:    { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8, marginBottom: 20 },
  input:       { fontSize: 44, minWidth: 100, textAlign: 'center', borderBottomWidth: 1, paddingBottom: 4 },
  unit:        { fontSize: 11, letterSpacing: 2 },
  btnRow:      { flexDirection: 'row', gap: 10 },
  btnGhost:    { flex: 1, paddingVertical: 14, borderWidth: 1, borderRadius: 10, alignItems: 'center' },
  btnGhostText:{ fontSize: 10, letterSpacing: 3 },
  btnFill:     { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnFillText: { fontSize: 10, letterSpacing: 3 },
});

// ── Habit Detail Modal ─────────────────────────────────────────────────────────

const DAY_LABELS_SHORT = ['M','T','W','T','F','S','S'];

function HabitDetailModal({ habit, token, theme, onClose, onChanged }: {
  habit: HabitWithStatus; token: string; userId: any; theme: any;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [loading, setLoading]         = useState(true);
  const [doneDates, setDoneDates]       = useState<Set<string>>(new Set());
  const [percentile, setPercentile]     = useState<number | null>(null);
  const [totalUsers, setTotalUsers]     = useState(0);
  const [consistency, setConsistency]   = useState(0);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName]   = useState(habit.name);
  const [editScore, setEditScore] = useState(habit.score || 5);
  const [editDays, setEditDays]   = useState<number[]>(
    habit.days && habit.days.length > 0 ? habit.days : [0,1,2,3,4,5,6]
  );
  const [saving, setSaving]       = useState(false);

  function toggleEditDay(i: number) {
    setEditDays(prev =>
      prev.includes(i)
        ? prev.length > 1 ? prev.filter(d => d !== i) : prev  // keep at least 1
        : [...prev, i].sort((a, b) => a - b)
    );
  }

  async function handleSave() {
    if (!editName.trim()) { Alert.alert('Name required', 'Enter a habit name.'); return; }
    setSaving(true);
    try {
      await tasks.update(token, habit.id, { name: editName.trim(), score: editScore, days: editDays });
      onChanged?.();
    } catch (err: any) {
      Alert.alert('Could not save', err?.message ?? 'Update failed.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      'Delete habit?',
      `"${habit.name}" will be removed from your list. Past completions are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await tasks.delete(token, habit.id);
              onChanged?.();
            } catch (err: any) {
              Alert.alert('Could not delete', err?.message ?? 'Delete failed.');
            }
          },
        },
      ]
    );
  }

  useEffect(() => {
    habits.stats(token, habit.name)
      .then(res => {
        setDoneDates(new Set(res.doneDates));
        setConsistency(res.consistency);
        setPercentile(res.percentile);
        setTotalUsers(res.totalUsersWithHabit);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [habit.id]);

  // Build 28-day grid (Mon-aligned, 4 rows)
  const cells: string[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 27);
  // align to Monday
  const offset = (baseDate.getDay() + 6) % 7;
  for (let i = 0; i < offset; i++) cells.push('');
  for (let i = 0; i < 28; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    cells.push(d.toISOString().slice(0, 10));
  }
  while (cells.length % 7 !== 0) cells.push('');

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const consistencyColor = consistency >= 70 ? '#34C759' : consistency >= 40 ? '#F59E0B' : '#EF4444';

  return (
    <Modal visible transparent animationType="fade">
      <Pressable style={[hd.backdrop, { backgroundColor: theme.backdrop }]} onPress={onClose} />
      <ScrollView
        style={hd.centreWrap}
        contentContainerStyle={hd.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[hd.card, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
          {/* Header */}
          <View style={hd.header}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[hd.habitName, { color: theme.text, fontFamily: 'Inter_900Black' }]}>
                {editing ? 'EDIT HABIT' : habit.name.toUpperCase()}
              </Text>
              {!editing && !loading && (
                totalUsers <= 1
                  ? <Text style={[hd.percentileLine, { color: '#22A664', fontFamily: 'Inter_600SemiBold' }]}>
                      Only you have this habit — set the standard.
                    </Text>
                  : <Text style={[hd.percentileLine, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                      Doing better than{' '}
                      <Text style={{
                        color: (percentile ?? 0) >= 60 ? '#22A664' : (percentile ?? 0) >= 30 ? '#F0A12E' : '#E84A4A',
                        fontFamily: 'Inter_700Bold',
                      }}>
                        {percentile ?? 0}%
                      </Text>
                      {' '}of people with this habit
                    </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={hd.closeBtn}>
              <Ionicons name="close" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {editing ? (
            /* ── Edit mode ─────────────────────────────────────────── */
            <>
              <Text style={[hd.editLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>HABIT NAME</Text>
              <TextInput
                style={[hd.editInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface, fontFamily: 'Inter_700Bold' }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="Habit name"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="characters"
              />

              <Text style={[hd.editLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>DAYS</Text>
              <View style={hd.scheduleRow}>
                {DAY_LABELS_SHORT.map((d, i) => {
                  const active = editDays.includes(i);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[hd.scheduleDay, {
                        backgroundColor: active ? theme.inverse : 'transparent',
                        borderColor: active ? theme.inverse : theme.border,
                      }]}
                      onPress={() => toggleEditDay(i)}
                      activeOpacity={0.75}
                    >
                      <Text style={[hd.scheduleDayText, {
                        color: active ? theme.inverseText : theme.textMuted,
                        fontFamily: 'Inter_700Bold',
                      }]}>{d}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[hd.editLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                TOUGHNESS — <Text style={{ color: toughnessColor(editScore, theme.isDark) }}>{editScore}/10</Text>
              </Text>
              <View style={hd.scoreGrid}>
                {TOUGHNESS_OPTIONS.map(n => {
                  const active = editScore === n;
                  const col = toughnessColor(n, theme.isDark);
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[hd.scoreChip, {
                        borderColor: active ? col : theme.border,
                        backgroundColor: active ? col + '20' : theme.surface,
                      }]}
                      onPress={() => setEditScore(n)}
                    >
                      <Text style={[hd.scoreChipText, { color: active ? col : theme.textSecondary, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                        {n}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={hd.actionRow}>
                <TouchableOpacity
                  style={[hd.actionBtn, hd.actionBtnGhost, { borderColor: theme.border }]}
                  onPress={() => {
                    setEditing(false);
                    setEditName(habit.name);
                    setEditScore(habit.score || 5);
                    setEditDays(habit.days && habit.days.length > 0 ? habit.days : [0,1,2,3,4,5,6]);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[hd.actionBtnText, { color: theme.text, fontFamily: 'Inter_900Black' }]}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[hd.actionBtn, { backgroundColor: theme.inverse, opacity: (saving || !editName.trim()) ? 0.4 : 1 }]}
                  onPress={handleSave}
                  disabled={saving || !editName.trim()}
                  activeOpacity={0.85}
                >
                  <Text style={[hd.actionBtnText, { color: theme.inverseText, fontFamily: 'Inter_900Black' }]}>
                    {saving ? 'SAVING...' : 'SAVE'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : loading ? (
            <View style={hd.loading}>
              <ActivityIndicator color={theme.text} />
            </View>
          ) : (
            <>
              {/* Stats row — 3 metrics */}
              <View style={hd.statsRow}>
                <View style={hd.statCell}>
                  <Text style={[hd.statVal, { color: consistencyColor, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                    {consistency}%
                  </Text>
                  <Text style={[hd.statLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>
                    CONSISTENCY
                  </Text>
                </View>
                <View style={[hd.statSep, { backgroundColor: theme.border }]} />
                <View style={hd.statCell}>
                  <Text style={[hd.statVal, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                    {doneDates.size}
                  </Text>
                  <Text style={[hd.statLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>
                    DAYS DONE
                  </Text>
                </View>
                <View style={[hd.statSep, { backgroundColor: theme.border }]} />
                <View style={hd.statCell}>
                  <Text style={[hd.statVal, {
                    color: habit.streak > 0 ? '#F59E0B' : theme.textMuted,
                    fontFamily: 'SpaceGrotesk_700Bold',
                  }]}>
                    {habit.streak > 0 ? `🔥 ${habit.streak}` : '—'}
                  </Text>
                  <Text style={[hd.statLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>
                    STREAK
                  </Text>
                </View>
              </View>


              {/* Schedule — which days this habit runs */}
              <View style={hd.scheduleBlock}>
                <Text style={[hd.calLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold', marginBottom: 8 }]}>
                  SCHEDULE
                </Text>
                <View style={hd.scheduleRow}>
                  {DAY_LABELS_SHORT.map((d, i) => {
                    const active = !habit.days || habit.days.length === 0 || habit.days.includes(i);
                    return (
                      <View key={i} style={[hd.scheduleDay, {
                        backgroundColor: active ? theme.inverse : 'transparent',
                        borderColor: active ? theme.inverse : theme.border,
                      }]}>
                        <Text style={[hd.scheduleDayText, {
                          color: active ? theme.inverseText : theme.textMuted,
                          fontFamily: 'Inter_700Bold',
                        }]}>{d}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* 28-day activity heatmap */}
              <View>
                <Text style={[hd.calLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold', marginBottom: 10 }]}>
                  LAST 28 DAYS
                </Text>
                {/* Day headers */}
                <View style={hd.calRow}>
                  {DAY_LABELS_SHORT.map((d, i) => (
                    <Text key={i} style={[hd.calDayHead, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>{d}</Text>
                  ))}
                </View>
                {/* Weeks */}
                <View style={{ gap: 5, marginTop: 4 }}>
                  {weeks.map((week, wi) => (
                    <View key={wi} style={hd.calRow}>
                      {week.map((dateStr, di) => {
                        if (!dateStr) return <View key={di} style={hd.calCell} />;
                        const isPast   = dateStr <= today();
                        const isDone   = doneDates.has(dateStr);
                        const isToday2 = dateStr === today();
                        const dayNum   = parseInt(dateStr.slice(8), 10);

                        let bg = 'transparent';
                        if (isToday2)     bg = theme.inverse;
                        else if (isDone)  bg = '#22A664';
                        else if (isPast)  bg = theme.surface;

                        return (
                          <View key={di} style={[hd.calCell, {
                            backgroundColor: bg,
                            borderRadius: 7,
                            opacity: !isPast && !isToday2 ? 0.3 : 1,
                          }]}>
                            {isDone && !isToday2 && (
                              <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                            )}
                            {!isDone && isPast && !isToday2 && (
                              <Text style={{ fontSize: 9, color: theme.textMuted, fontFamily: 'Inter_700Bold' }}>
                                {dayNum}
                              </Text>
                            )}
                            {isToday2 && (
                              <Text style={{ fontSize: 9, color: theme.inverseText, fontFamily: 'Inter_900Black' }}>
                                {dayNum}
                              </Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>

                {/* Legend */}
                <View style={hd.calLegend}>
                  <View style={hd.legendItem}>
                    <View style={[hd.legendDot, { backgroundColor: '#22A664' }]} />
                    <Text style={[hd.legendText, { color: theme.textMuted, fontFamily: 'Inter_500Medium' }]}>Done</Text>
                  </View>
                  <View style={hd.legendItem}>
                    <View style={[hd.legendDot, { backgroundColor: theme.surface }]} />
                    <Text style={[hd.legendText, { color: theme.textMuted, fontFamily: 'Inter_500Medium' }]}>Missed</Text>
                  </View>
                  <View style={hd.legendItem}>
                    <View style={[hd.legendDot, { backgroundColor: theme.inverse }]} />
                    <Text style={[hd.legendText, { color: theme.textMuted, fontFamily: 'Inter_500Medium' }]}>Today</Text>
                  </View>
                </View>
              </View>

              {/* Edit / Delete actions */}
              <View style={hd.actionRow}>
                <TouchableOpacity
                  style={[hd.actionBtn, hd.actionBtnGhost, { borderColor: '#EF4444' }]}
                  onPress={handleDelete}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  <Text style={[hd.actionBtnText, { color: '#EF4444', fontFamily: 'Inter_900Black' }]}>DELETE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[hd.actionBtn, { backgroundColor: theme.inverse }]}
                  onPress={() => { setEditing(true); setEditName(habit.name); setEditScore(habit.score || 5); }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="create-outline" size={14} color={theme.inverseText} />
                  <Text style={[hd.actionBtnText, { color: theme.inverseText, fontFamily: 'Inter_900Black' }]}>EDIT</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </Modal>
  );
}

const hd = StyleSheet.create({
  backdrop:       { ...StyleSheet.absoluteFillObject },
  centreWrap:     { ...StyleSheet.absoluteFillObject },
  scrollContent:  { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card:           { width: '100%', borderRadius: 20, borderWidth: 1, padding: 20, gap: 16 },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  habitName:      { fontSize: 20, letterSpacing: 0.5 },
  percentileLine: { fontSize: 12, lineHeight: 17 },
  // Edit mode
  editLabel:      { fontSize: 9, letterSpacing: 3, marginBottom: -8 },
  editInput:      { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, letterSpacing: 1 },
  scoreGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scoreChip:      { width: 44, height: 44, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  scoreChipText:  { fontSize: 14 },
  // Action row (Edit / Delete in view mode, Save / Cancel in edit mode)
  actionRow:      { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10 },
  actionBtnGhost: { backgroundColor: 'transparent', borderWidth: 1.5 },
  actionBtnText:  { fontSize: 11, letterSpacing: 2.5 },
  closeBtn:  { padding: 4 },
  loading:   { paddingVertical: 32, alignItems: 'center' },
  statsRow:  { flexDirection: 'row', alignItems: 'center' },
  statCell:  { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12 },
  statVal:   { fontSize: 22 },
  statLabel: { fontSize: 7, letterSpacing: 1.5 },
  statSep:   { width: 1, height: 36 },
  // Schedule
  scheduleBlock:   { gap: 0 },
  scheduleRow:     { flexDirection: 'row', gap: 5, justifyContent: 'space-between' },
  scheduleDay:     { flex: 1, aspectRatio: 1, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scheduleDayText: { fontSize: 9 },
  // Calendar
  calLabel:    { fontSize: 8, letterSpacing: 3 },
  calRow:      { flexDirection: 'row', gap: 5 },
  calCell:     { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calDayHead:  { flex: 1, textAlign: 'center', fontSize: 8, paddingBottom: 2 },
  calLegend:   { flexDirection: 'row', gap: 14, marginTop: 10, justifyContent: 'center' },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 10, height: 10, borderRadius: 3 },
  legendText:  { fontSize: 10 },
});

// ── Arc gauge — 220° sweep with score in the centre ────────────────────────
const GAUGE_W = 220;
const GAUGE_H = 150;
const GAUGE_R = 86;
const GAUGE_CX = GAUGE_W / 2;
const GAUGE_CY = 110;
const GAUGE_SWEEP_DEG = 220;
const GAUGE_C = 2 * Math.PI * GAUGE_R;
const GAUGE_ARC_LEN = GAUGE_C * (GAUGE_SWEEP_DEG / 360);
const GAUGE_GAP = GAUGE_C - GAUGE_ARC_LEN;
// Gap (140°) centered at 90° (bottom). Arc starts at 90° + gap/2 = 160°.
const GAUGE_ROTATE = 90 + (360 - GAUGE_SWEEP_DEG) / 2;

function gaugeColor(v: number, theme: any): string {
  if (v <= 33) return theme.danger;
  if (v <= 66) return theme.warning;
  return theme.success;
}

function ArcGauge({ value, theme }: { value: number; theme: any }) {
  const pct = Math.max(0, Math.min(1, value / 100));
  const fill = GAUGE_ARC_LEN * pct;
  const col  = gaugeColor(value, theme);
  return (
    <View style={{ width: GAUGE_W, height: GAUGE_H, alignSelf: 'center' }}>
      <Svg width={GAUGE_W} height={GAUGE_H} viewBox={`0 0 ${GAUGE_W} ${GAUGE_H + 30}`}>
        <G transform={`rotate(${GAUGE_ROTATE}, ${GAUGE_CX}, ${GAUGE_CY})`}>
          <Circle
            cx={GAUGE_CX} cy={GAUGE_CY} r={GAUGE_R}
            fill="none"
            stroke={theme.surface}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={`${GAUGE_ARC_LEN} ${GAUGE_GAP}`}
          />
          {value > 0 && (
            <Circle
              cx={GAUGE_CX} cy={GAUGE_CY} r={GAUGE_R}
              fill="none"
              stroke={col}
              strokeWidth={14}
              strokeLinecap="round"
              strokeDasharray={`${fill} ${GAUGE_C - fill}`}
            />
          )}
        </G>
      </Svg>
      <View style={s.gaugeLabel} pointerEvents="none">
        <Text style={[s.gaugeNum, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{value}</Text>
        <Text style={[s.gaugeCap, { color: theme.textTertiary, fontFamily: 'Inter_700Bold' }]}>OUT OF 100</Text>
      </View>
    </View>
  );
}

// ── Momentum status pill ──────────────────────────────────────────────────
function MomentumPill({ score, theme }: { score: number; theme: any }) {
  let label: string, bg: string, fg: string, arrow: string;
  if (score >= 75)      { label = 'CRUSHING IT';       bg = '#22A664' + '25'; fg = '#22A664'; arrow = '↑'; }
  else if (score >= 50) { label = 'BUILDING MOMENTUM'; bg = '#F0A12E' + '25'; fg = '#F0A12E'; arrow = '↑'; }
  else if (score >= 25) { label = 'WAVERING';          bg = '#F0A12E' + '20'; fg = '#F0A12E'; arrow = '→'; }
  else if (score > 0)   { label = 'BELOW POTENTIAL';   bg = '#E84A4A' + '20'; fg = '#E84A4A'; arrow = '↓'; }
  else                  { label = 'SHOW UP';           bg = theme.surfaceStrong; fg = theme.textSecondary; arrow = '·'; }

  return (
    <View style={[s.momentumPill, { backgroundColor: bg }]}>
      <Text style={[s.momentumPillText, { color: fg, fontFamily: 'Inter_900Black' }]}>
        {arrow}  {label}
      </Text>
    </View>
  );
}

function HabitRow({ habit, theme, canToggle, isControl, fromChallenge, ySelected, onToggle, onPressY, onPressN, onInfo }: {
  habit: HabitWithStatus; theme: any; canToggle: boolean; isControl: boolean;
  fromChallenge?: boolean;
  ySelected?: boolean;
  onToggle?: () => void;
  onPressY?: () => void;
  onPressN?: () => void;
  onInfo: () => void;
}) {
  const impact = habit.score || 1;
  const accentColor = theme.isDark ? '#B8F23A' : '#16A34A';

  const yActive = isControl && !habit.done && ySelected;
  const nActive = isControl && habit.done;

  const nameColor = habit.done
    ? theme.textSecondary
    : yActive ? '#E84A4A'
    : theme.text;

  const scoreColor = nActive ? '#22A664' : yActive ? '#E84A4A' : theme.textTertiary;

  return (
    <TouchableOpacity
      style={[s.habitCard, {
        backgroundColor: theme.card,
        borderColor: fromChallenge ? '#F0A12E' : theme.border,
        borderWidth: fromChallenge ? 1.5 : 1,
      }]}
      onPress={(!isControl && canToggle) ? onToggle : undefined}
      activeOpacity={(!isControl && canToggle) ? 0.75 : 1}
    >
      {/* Build habit: lime checkbox on left */}
      {!isControl && (
        <View style={[s.habitCheck, {
          backgroundColor: habit.done ? accentColor : 'transparent',
          borderColor: habit.done ? accentColor : theme.borderStrong,
        }]}>
          {habit.done && <Ionicons name="checkmark" size={13} color={theme.isDark ? '#14110D' : '#FFFFFF'} />}
        </View>
      )}

      {/* Name + meta */}
      <View style={s.habitInfo}>
        <Text style={[s.habitName, {
          color: nameColor,
          textDecorationLine: habit.done ? 'line-through' : 'none',
          textDecorationColor: theme.textTertiary,
          fontFamily: 'SpaceGrotesk_700Bold',
        }]} numberOfLines={1}>
          {habit.name.toUpperCase()}
        </Text>
        <View style={s.habitMetaRow}>
          <Text style={[s.impactText, {
            color: nActive ? '#22A664' : yActive ? '#E84A4A' : theme.textTertiary,
            fontFamily: 'Inter_700Bold',
          }]}>
            {nActive ? `+${impact}% CONTROLLED` : yActive ? 'FAILED' : `+${impact}% ${isControl ? 'CONTROL' : 'DISCIPLINE'}`}
          </Text>
          {habit.streak > 0 && (
            <View style={s.streakBadge}>
              <Text style={{ fontSize: 10 }}>🔥</Text>
              <Text style={[s.streakText, { color: theme.textTertiary, fontFamily: 'Inter_700Bold' }]}>
                {habit.streak}
              </Text>
            </View>
          )}
          {habit.done && habit.count != null && (
            <View style={[s.countBadge, { backgroundColor: '#22A66420' }]}>
              <Text style={[s.impactText, { color: '#22A664', fontFamily: 'SpaceGrotesk_700Bold' }]}>
                {habit.count}{habit.count_unit ? ` ${habit.count_unit}` : ''}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Control habits: Y | N circles on right (replaces score) */}
      {isControl ? (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity
            style={[s.ynCircle, {
              backgroundColor: yActive ? '#E84A4A' : 'transparent',
              borderColor: '#E84A4A',
            }]}
            onPress={canToggle ? onPressY : undefined}
            activeOpacity={0.75}
          >
            <Text style={[s.ynText, { color: yActive ? '#FFFFFF' : '#E84A4A', fontFamily: 'Inter_900Black' }]}>Y</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.ynCircle, {
              backgroundColor: nActive ? '#22A664' : 'transparent',
              borderColor: '#22A664',
            }]}
            onPress={canToggle ? onPressN : undefined}
            activeOpacity={0.75}
          >
            <Text style={[s.ynText, { color: nActive ? '#FFFFFF' : '#22A664', fontFamily: 'Inter_900Black' }]}>N</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Build habit: score number */
        <Text style={[s.pointsText, { color: scoreColor, fontFamily: 'SpaceGrotesk_700Bold' }]}>
          +{impact}
        </Text>
      )}

      <TouchableOpacity onPress={onInfo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.infoBtn}>
        <Ionicons name="stats-chart" size={13} color={theme.textTertiary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1 },

  // Warm Coach top bar
  topBar:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14, gap: 8 },
  modeEyebrow:   { fontSize: 11, letterSpacing: 1.6, marginBottom: 2 },
  modeTitle:     { fontSize: 26, letterSpacing: -0.5, lineHeight: 28 },
  sparkleBtn:    { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconBtn:       { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  // Legacy (still used by other modal styles inline)
  topIcon:       { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modeLabel:     { fontSize: 10, letterSpacing: 1.5, lineHeight: 15 },

  datesRow:      { paddingHorizontal: 14, paddingBottom: 8 },
  scroll:        { paddingBottom: 140, paddingTop: 0 },
  trackerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  trackerTitle:  { fontSize: 20, letterSpacing: -0.5 },

  // Gauge
  gaugeLabel:    { position: 'absolute', bottom: 28, left: 0, right: 0, alignItems: 'center', gap: 4 },
  gaugeNum:      { fontSize: 50, letterSpacing: -2.5, lineHeight: 50 },
  gaugeCap:      { fontSize: 9, letterSpacing: 1.8 },

  // Momentum pill
  momentumWrap:     { alignItems: 'center', marginTop: 8, marginBottom: 18 },
  momentumPill:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  momentumPillText: { fontSize: 11, letterSpacing: 1.5 },

  // BUILD / CONTROL segmented control
  segmented:     { flexDirection: 'row', marginHorizontal: 16, marginBottom: 4, padding: 4, borderRadius: 16, height: 48, position: 'relative' },
  segmentedPill: { position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  segmentedBtn:  { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  segmentedText: { fontSize: 12, letterSpacing: 2.5 },

  // Stats row above habit list
  statRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  statLeft:      { fontSize: 10, letterSpacing: 2 },
  statRight:     { fontSize: 10, letterSpacing: 2 },

  fab:           { position: 'absolute', bottom: 20, alignSelf: 'center', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 24, marginBottom: 12 },
  sectionTitle:  { fontSize: 9, letterSpacing: 3 },
  sectionCount:  { fontSize: 9 },
  empty:         { alignItems: 'center', paddingVertical: 40 },
  emptyText:     { fontSize: 13, textAlign: 'center', lineHeight: 20, opacity: 0.5 },

  // Habit card — Warm Coach style
  habitCard:     {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, marginBottom: 8, gap: 12, borderRadius: 18,
  },
  habitCheck:    { width: 28, height: 28, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', borderRadius: 9, flexShrink: 0 },
  habitInfo:     { flex: 1, gap: 5, minWidth: 0 },
  habitName:     { fontSize: 13, letterSpacing: 0.3 },
  habitMetaRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  impactText:    { fontSize: 10, letterSpacing: 0.8 },
  streakBadge:   { flexDirection: 'row', alignItems: 'center', gap: 2 },
  streakText:    { fontSize: 10, letterSpacing: 0.5 },
  countBadge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  dot:           { width: 3, height: 3, borderRadius: 2 },
  pointsText:    { fontSize: 17, letterSpacing: -0.5 },
  // Legacy checkbox style (still referenced by the add-habit modal trackToggle)
  checkbox:      { width: 20, height: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', borderRadius: 0 },
  // Add-habit modal extras
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  presetChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderRadius: 10 },
  presetIcon: { fontSize: 13 },
  presetText: { fontSize: 9, letterSpacing: 1.5 },
  trackToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderRadius: 10, marginTop: 4, marginBottom: 12 },
  trackCheckbox: { width: 18, height: 18, borderWidth: 1.5, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  trackLabel: { fontSize: 10, letterSpacing: 2 },
  trackHint: { flex: 1, fontSize: 9, letterSpacing: 0.3, fontStyle: 'italic', textAlign: 'right' },
  ynCircle:   { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  ynText:     { fontSize: 11 },
  infoBtn:    { padding: 4, opacity: 0.6 },
  modal:      { flex: 1, paddingTop: 8 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, borderBottomWidth: 1 },
  modalTitle:  { fontSize: 16, letterSpacing: 2 },
  modalBody:   { padding: 24, gap: 16, paddingBottom: 48 },
  fieldLabel:  { fontSize: 9, letterSpacing: 3, marginBottom: -4 },
  typeToggle:  { flexDirection: 'row', borderRadius: 8, padding: 4, height: 44 },
  typeBtn:     { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  typeBtnText: { fontSize: 11, letterSpacing: 3 },
  input:       { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, letterSpacing: 1 },
  daysRow:     { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dayChip:     { width: 34, height: 34, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dayAllBtn:   { flex: 1, height: 34, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dayChipText: { fontSize: 10, letterSpacing: 1 },
  scoreScroll: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  scoreChip:   { width: 52, height: 52, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  scoreChipText: { fontSize: 15 },
  submitBtn:   { paddingVertical: 16, alignItems: 'center', borderRadius: 0, marginTop: 8 },
  submitBtnText: { fontSize: 12, letterSpacing: 4 },
});
