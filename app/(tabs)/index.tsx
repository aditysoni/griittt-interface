import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  AppState,
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
import { habits, Task, tasks, today, toDateStr, CONTROL_PRESETS, challenges, AiAnalysis } from '../../lib/api';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorState } from '../../components/ErrorState';
import { DaySelector } from '../../components/DaySelector';
import { DateSwipe, useDateNav } from '../../components/DateSwipe';
import { useTheme } from '../../components/ThemeContext';
import { useFocusEffect, useRouter } from 'expo-router';
import { DayCompleteCelebration } from '../../components/DayCompleteCelebration';
import { AiAnalysisButton, AiAnalysisCard } from '../../components/AiAnalysisCard';
import { ActionOutcome, AskGritttSheet } from '../../components/AskGritttSheet';
import type { AssistantContext } from '../../lib/assistant';
import {
  AskGritttRow, CheckInCard, NextStepCard, PrioritiesCard, PriorityPickerModal,
  ProgressCard, UndoBar, ViewingBanner,
} from '../../components/TodayCards';
import { CheckInMap, Mood, todayStorage } from '../../lib/storage';
import {
  dayTitle, dayWord, formatLongDate, formatShortDate, greeting, isScheduledOn,
  pickNextStep, sanitizePriorities, summarizeDay,
} from '../../lib/today';

type HabitType = 'build' | 'control';
type TimeSlot  = 'morning' | 'afternoon' | 'evening' | 'night' | 'allday';
type HabitWithStatus = Task & { done: boolean; yFailed: boolean; streak: number; count: number | null };

const TIME_SLOTS: { key: TimeSlot; label: string; color: string }[] = [
  { key: 'morning',   label: 'MORNING',   color: '#F59E0B' },
  { key: 'afternoon', label: 'AFTERNOON', color: '#3B82F6' },
  { key: 'evening',   label: 'EVENING',   color: '#F97316' },
  { key: 'night',     label: 'NIGHT',     color: '#8B5CF6' },
  { key: 'allday',    label: 'ALL DAY',   color: '#EF4444' },
];

function shiftDate(base: string, days: number): string {
  const d = new Date(base + 'T00:00:00'); d.setDate(d.getDate() + days);
  return toDateStr(d);
}

function toughnessColor(score: number, isDark: boolean): string {
  if (score <= 3) return isDark ? '#34C759' : '#16A34A';
  if (score <= 6) return '#F59E0B';
  return '#EF4444';
}

const TOUGHNESS_OPTIONS = [1,2,3,4,5,6,7,8,9,10];

// What a habit's log looked like before a change — enough to put it back on Undo.
type LogState = { done: boolean; yFailed: boolean; count: number | null };
type UndoEntry = {
  habitId: string; name: string; date: string; prev: LogState; message: string;
  /** The write being undone, so Undo can wait for it instead of racing it. */
  pending: Promise<unknown>;
};

export default function HabitsScreen() {
  const { token, user } = useAuth();
  const { theme } = useTheme();
  const userKey = user?.id ?? 'anon';
  const [selectedDate, setSelectedDate] = useState(today());
  // The device's local "today". Kept in state so the screen rolls over at midnight
  // instead of quietly logging against yesterday when the app was left open.
  const [todayStr, setTodayStr] = useState(today());
  const { goPrev, goNext, canPrev, canNext } = useDateNav(selectedDate, setSelectedDate);
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
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState(false);
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
  const [countIsY,   setCountIsY]       = useState(false); // true = Y-press (failed), false = N/build

  // Today-screen state
  const [loadedDate, setLoadedDate]     = useState<string | null>(null); // date habitList belongs to
  const [priorityIds, setPriorityIds]   = useState<string[]>([]);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [checkIns, setCheckIns]         = useState<CheckInMap>({});
  const [showAsk, setShowAsk]           = useState(false);
  const [undo, setUndo]                 = useState<UndoEntry | null>(null);
  const undoTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A past date the user has confirmed they mean to log against (cleared on date change).
  const confirmedDate = useRef<string | null>(null);
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const todayRef = useRef(todayStr);
  todayRef.current = todayStr;
  const scrollRef = useRef<ScrollView>(null);
  const allHabitsY = useRef(0);

  const isToday = selectedDate === todayStr;
  // Ticking is allowed for today and any past day — just not days that haven't happened yet.
  const canLog  = selectedDate <= todayStr;
  // Set by the completion handlers so the day-complete celebration only fires from
  // a user action — never from loading or refreshing an already-complete day.
  const justCompleted = useRef(false);

  async function load(date: string) {
    if (!token) return;
    try {
      const [taskList, statusList] = await Promise.all([
        tasks.list(token),
        habits.allStatus(token, date),
      ]);
      const statusMap = new Map(statusList.map(s => [s.id, s]));
      const merged = taskList
        .filter(t => !t.archived_at)
        .map(t => ({
          ...t,
          done:    statusMap.get(t.id)?.done    ?? false,
          yFailed: statusMap.get(t.id)?.yFailed ?? false,
          streak:  statusMap.get(t.id)?.streak  ?? 0,
          count:   statusMap.get(t.id)?.count   ?? null,
        }));
      // A slower reply for a date the user has already left must not overwrite the current day.
      if (date !== selectedDateRef.current) return;
      setHabitList(merged);
      setLoadedDate(date);
      setLoadError(false);
    } catch (err: any) {
      if (date === selectedDateRef.current) setLoadError(true);
    }

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
  useEffect(() => { setYPressedIds(new Set()); confirmedDate.current = null; setLoadError(false); }, [selectedDate]);

  // Midnight rollover: when the local date changes, follow it if the user was on "today".
  useEffect(() => {
    function syncToday() {
      const now = today();
      if (now === todayRef.current) return;
      if (selectedDateRef.current === todayRef.current) setSelectedDate(now);
      setTodayStr(now);
    }
    const sub = AppState.addEventListener('change', state => { if (state === 'active') syncToday(); });
    const timer = setInterval(syncToday, 30000);
    return () => { sub.remove(); clearInterval(timer); };
  }, []);

  // Priorities and check-ins live in on-device storage, per user.
  useEffect(() => {
    let cancelled = false;
    todayStorage.getPriorities(userKey).then(ids => { if (!cancelled) setPriorityIds(ids); }).catch(() => {});
    todayStorage.getCheckIns(userKey).then(map => { if (!cancelled) setCheckIns(map); }).catch(() => {});
    return () => { cancelled = true; };
  }, [userKey]);

  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  function goToday() { const now = today(); setTodayStr(now); setSelectedDate(now); }

  function savePriorities(ids: string[]) {
    const clean = sanitizePriorities(ids, habitList);
    setPriorityIds(clean);
    setShowPriorityPicker(false);
    todayStorage.setPriorities(userKey, clean).catch(() => {
      Alert.alert('Could not save', 'Your priorities could not be saved on this device.');
    });
  }

  function saveCheckIn(mood: Mood | null) {
    const date = selectedDate;
    const entry = { mood, ...(mood ? {} : { skipped: true }), updatedAt: new Date().toISOString() };
    setCheckIns(prev => ({ ...prev, [date]: entry })); // one entry per date — a new answer replaces the old one
    todayStorage.setCheckIn(userKey, date, entry).catch(() => {});
  }

  // ── Wrong-date protection ────────────────────────────────────────────────────
  // Logging on a past date asks once per visit to that date; future dates can't be logged.
  function guardDate(action: () => void) {
    if (!canLog) {
      Alert.alert("This day hasn't happened yet", 'You can log it once the day arrives.', [
        { text: 'Back to today', onPress: goToday },
        { text: 'OK', style: 'cancel' },
      ]);
      return;
    }
    if (isToday || confirmedDate.current === selectedDate) { action(); return; }
    const date = selectedDate;
    Alert.alert(
      `This is ${dayWord(date, todayStr)}, not today`,
      `Changes here are saved to ${formatLongDate(date, todayStr)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go to today', onPress: goToday },
        { text: `Continue for ${formatShortDate(date)}`, onPress: () => { confirmedDate.current = date; action(); } },
      ]
    );
  }

  // ── Undo ─────────────────────────────────────────────────────────────────────
  function offerUndo(habit: HabitWithStatus, message: string, pending: Promise<unknown>) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({
      habitId: habit.id, name: habit.name, date: selectedDate, message, pending,
      prev: { done: habit.done, yFailed: habit.yFailed, count: habit.count },
    });
    undoTimer.current = setTimeout(() => setUndo(null), 7000);
  }
  function dropUndo(habitId: string) {
    setUndo(u => (u && u.habitId === habitId ? null : u));
  }

  // Puts a habit's log back exactly as it was — on the date it was logged for,
  // even if the user has moved to another day since.
  async function undoLast() {
    const u = undo;
    if (!u || !token) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(null);
    if (u.date === selectedDate) {
      setHabitList(l => l.map(h => h.id === u.habitId ? { ...h, ...u.prev } : h));
      setYPressedIds(prev => { const s = new Set(prev); s.delete(u.habitId); return s; });
    }
    try {
      await u.pending.catch(() => {});
      if (u.prev.done)         await habits.complete(token, u.name, u.habitId, u.prev.count, undefined, u.date);
      else if (u.prev.yFailed) await habits.complete(token, u.name, u.habitId, u.prev.count, true, u.date);
      else                     await habits.uncomplete(token, u.name, u.date);
    } catch (err: any) {
      Alert.alert('Could not undo', err?.message ?? 'Undo failed.');
    } finally {
      if (u.date === selectedDateRef.current) load(u.date);
    }
  }

  // Removes whatever is logged for this habit on the selected date (the "Undo" on a logged row).
  async function clearLog(habit: HabitWithStatus) {
    if (!token || !canLog) return;
    const date = selectedDate;
    dropUndo(habit.id);
    setYPressedIds(prev => { const s = new Set(prev); s.delete(habit.id); return s; });
    setHabitList(l => l.map(h => h.id === habit.id ? { ...h, done: false, yFailed: false, count: null } : h));
    try {
      await habits.uncomplete(token, habit.name, date);
    } catch (err: any) {
      if (date === selectedDateRef.current) {
        setHabitList(l => l.map(h => h.id === habit.id ? { ...h, done: habit.done, yFailed: habit.yFailed, count: habit.count } : h));
      }
      Alert.alert('Error', err.message);
    }
  }

  // One entry point for "Mark done" / "Log…" from the Today cards. It reuses the
  // same handlers as the full list, so there is only ever one record per habit.
  function logFromCard(habit: HabitWithStatus) {
    guardDate(() => {
      if (habit.category === 'control') {
        Alert.alert(habit.name, `How did it go ${isToday ? 'today' : `on ${formatShortDate(selectedDate)}`}?`, [
          { text: 'Stayed in control', onPress: () => handleControlN(habit) },
          { text: 'Slipped', onPress: () => handleControlY(habit) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      } else {
        toggleHabit(habit);
      }
    });
  }

  // Refresh whenever we come back to this screen — e.g. after joining a
  // challenge on the GRIND tab, so the new habit shows up immediately.
  useFocusEffect(
    useCallback(() => { load(selectedDate); }, [token, selectedDate])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(selectedDate); setRefreshing(false);
  }, [token, selectedDate]);

  // Long-press a habit → quick Edit / Delete menu (works for build + control rows).
  function handleHabitMenu(habit: HabitWithStatus) {
    Alert.alert(habit.name, 'What would you like to do?', [
      { text: 'Edit', onPress: () => setDetailHabit(habit) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteHabit(habit) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function confirmDeleteHabit(habit: HabitWithStatus) {
    Alert.alert(
      'Delete habit?',
      `"${habit.name}" will be removed from your list. Your past completions are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            if (!token) return;
            setHabitList(l => l.filter(h => h.id !== habit.id)); // optimistic removal
            try {
              await tasks.delete(token, habit.id);
            } catch (err: any) {
              Alert.alert('Could not delete', err?.message ?? 'Delete failed.');
              load(selectedDate); // restore from server on failure
            }
          },
        },
      ]
    );
  }

  // " for Thu 5 Nov" when the selected day isn't today — keeps confirmations honest about the date.
  const dateSuffix = isToday ? '' : ` for ${formatShortDate(selectedDate)}`;

  function restoreIfCurrent(habit: HabitWithStatus, date: string) {
    if (date !== selectedDateRef.current) return;
    setHabitList(l => l.map(h => h.id === habit.id
      ? { ...h, done: habit.done, yFailed: habit.yFailed, count: habit.count } : h));
  }

  async function toggleHabit(habit: HabitWithStatus) {
    if (!token || !canLog) return;

    // If habit tracks count, open the count modal instead of toggling directly
    if (habit.track_count && !habit.done) {
      setCountHabit(habit);
      setCountIsY(false);
      setCountInput('');
      return;
    }

    const nowDone = !habit.done;
    const date = selectedDate;

    // Optimistic UI
    justCompleted.current = true;
    setHabitList(l => l.map(h => h.id === habit.id ? { ...h, done: nowDone, count: nowDone ? h.count : null } : h));

    const request = nowDone
      ? habits.complete(token, habit.name, habit.id, undefined, undefined, date)
      : habits.uncomplete(token, habit.name, date);
    offerUndo(habit, nowDone ? `Marked "${habit.name}" done${dateSuffix}` : `Removed the log for "${habit.name}"${dateSuffix}`, request);

    try {
      await request;
    } catch (err: any) {
      dropUndo(habit.id);
      restoreIfCurrent(habit, date);
      Alert.alert('Error', err.message);
    }
  }

  async function handleControlN(habit: HabitWithStatus) {
    if (!token || !canLog) return;
    const wasY = yPressedIds.has(habit.id);
    setYPressedIds(prev => { const s = new Set(prev); s.delete(habit.id); return s; });
    if (habit.done) return; // already N-selected
    const date = selectedDate;

    // Clear count — N means controlled (0 violations), so any Y-entered count is wiped
    justCompleted.current = true;
    setHabitList(l => l.map(h => h.id === habit.id ? { ...h, done: true, yFailed: false, count: null } : h));

    const request = habits.complete(token, habit.name, habit.id, undefined, undefined, date);
    offerUndo(habit, `Logged "${habit.name}" as in control${dateSuffix}`, request);

    try {
      await request;
    } catch (err: any) {
      dropUndo(habit.id);
      restoreIfCurrent(habit, date);
      if (wasY) setYPressedIds(prev => new Set([...prev, habit.id]));
      Alert.alert('Error', err.message);
    }
  }

  async function handleControlY(habit: HabitWithStatus) {
    if (!token || !canLog) return;

    // track_count habits → open count modal so the user can log how many
    if (habit.track_count) {
      setCountHabit(habit);
      setCountIsY(true);
      setCountInput('');
      return;
    }

    // Non-count control habits: mark Y locally, uncomplete if was N
    setYPressedIds(prev => new Set([...prev, habit.id]));
    if (!habit.done && !habit.yFailed) return; // already unanswered
    const date = selectedDate;

    setHabitList(l => l.map(h => h.id === habit.id ? { ...h, done: false, yFailed: false } : h));

    const request = habits.uncomplete(token, habit.name, date);
    offerUndo(habit, `Logged a slip for "${habit.name}"${dateSuffix}`, request);

    try {
      await request;
    } catch (err: any) {
      dropUndo(habit.id);
      restoreIfCurrent(habit, date);
      setYPressedIds(prev => { const s = new Set(prev); s.delete(habit.id); return s; });
      Alert.alert('Error', err.message);
    }
  }

  function closeCountModal() {
    setCountHabit(null);
    setCountIsY(false);
  }

  async function submitCount() {
    if (!token || !countHabit) return;
    const raw = countInput.trim();
    const num = raw === '' ? 0 : Number(raw);
    if (Number.isNaN(num) || num < 0) { Alert.alert('Invalid', 'Enter a non-negative number.'); return; }

    const habit  = countHabit;
    const isY    = countIsY;
    const date   = selectedDate;
    const amount = `${num}${habit.count_unit ? ` ${habit.count_unit}` : ''}`;
    closeCountModal();

    if (isY) {
      // Y path: store count as a "failed" completion — no discipline point
      setHabitList(l => l.map(h => h.id === habit.id ? { ...h, done: false, yFailed: true, count: num } : h));
      const request = habits.complete(token, habit.name, habit.id, num, true, date); // failed=true
      offerUndo(habit, `Logged a slip for "${habit.name}" (${amount})${dateSuffix}`, request);
      try {
        await request;
      } catch (err: any) {
        dropUndo(habit.id);
        restoreIfCurrent(habit, date);
        Alert.alert('Error', err.message);
      }
    } else {
      // N / build path: normal completion
      justCompleted.current = true;
      setHabitList(l => l.map(h => h.id === habit.id ? { ...h, done: true, yFailed: false, count: num } : h));
      const request = habits.complete(token, habit.name, habit.id, num, undefined, date);
      offerUndo(habit, `Logged ${amount} for "${habit.name}"${dateSuffix}`, request);
      try {
        await request;
      } catch (err: any) {
        dropUndo(habit.id);
        restoreIfCurrent(habit, date);
        Alert.alert('Error', err.message);
      }
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
      setHabitList(l => [...l, { ...task, done: false, yFailed: false, streak: 0, count: null }]);
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
  // A habit that doesn't run on the selected day is listed separately, never as a miss.
  const visibleScheduled = visibleHabits.filter(h => isScheduledOn(h, selectedDate));
  const visibleOff       = visibleHabits.filter(h => !isScheduledOn(h, selectedDate));

  // ── Today cards: all derived from the one habit list ─────────────────────────
  // habitList only describes the selected day once its load has landed; until
  // then the cards show a loading state rather than another day's ticks.
  const dayReady = loadedDate === selectedDate;
  // A Y pressed locally on a control habit counts as a logged slip.
  const dayHabits = useMemo(
    () => habitList.map(h => (yPressedIds.has(h.id) && !h.done ? { ...h, yFailed: true } : h)),
    [habitList, yPressedIds]
  );
  const activePriorityIds = useMemo(() => sanitizePriorities(priorityIds, habitList), [priorityIds, habitList]);
  const priorityHabits = useMemo(
    () => activePriorityIds
      .map(id => dayHabits.find(h => h.id === id))
      .filter((h): h is HabitWithStatus => !!h),
    [activePriorityIds, dayHabits]
  );
  const summary  = useMemo(() => summarizeDay(dayHabits, selectedDate, todayStr), [dayHabits, selectedDate, todayStr]);
  const nextStep = useMemo(
    () => pickNextStep(dayHabits, activePriorityIds, selectedDate, todayStr),
    [dayHabits, activePriorityIds, selectedDate, todayStr]
  );

  // ── Ask GRITTT ────────────────────────────────────────────────────────────────
  // The assistant reads the same in-memory day as the cards, and its writes go
  // through the handlers below, which are the screen's own completion flows.
  const assistantContext: AssistantContext | null = dayReady ? {
    screen: 'today', date: selectedDate, todayStr, habits: dayHabits, priorityIds: activePriorityIds,
    checkIn: checkIns[selectedDate], goals: user?.goals, userName: user?.name,
  } : null;

  async function assistantMarkDone(habitId: string): Promise<ActionOutcome> {
    const habit = dayHabits.find(h => h.id === habitId);
    if (!habit || !token || !canLog) return 'unsupported';
    if (habit.done) return 'done';
    // Habits that need input (a count or a Y/N answer) use the screen's own step.
    if (habit.category === 'control' || habit.track_count) { logFromCard(habit); return 'handoff'; }
    const date = selectedDate;
    justCompleted.current = true;
    setHabitList(l => l.map(h => h.id === habit.id ? { ...h, done: true } : h));
    try {
      await habits.complete(token, habit.name, habit.id, undefined, undefined, date);
      return 'done';
    } catch {
      restoreIfCurrent(habit, date);
      return 'failed';
    }
  }

  async function assistantSetPriority(habitId: string): Promise<ActionOutcome> {
    if (activePriorityIds.includes(habitId)) return 'done';
    if (activePriorityIds.length >= 3) return 'failed';
    savePriorities([...activePriorityIds, habitId]);
    return 'done';
  }

  // ── Day-complete celebration ──────────────────────────────────────────────
  // Fires the instant the user's own action completes everything scheduled for
  // today. Gated on `justCompleted` so it never fires just from loading or
  // refreshing an already-complete day — but it does replay if you re-complete
  // (uncheck, then recheck the last task). Rest-day habits don't hold it back.
  const scheduledToday = dayHabits.filter(h => isScheduledOn(h, selectedDate));
  const allTasksDone  = dayReady && scheduledToday.length > 0 && scheduledToday.every(h => h.done);
  const [celebrateScore, setCelebrateScore] = useState<number | null>(null);
  useEffect(() => {
    if (isToday && allTasksDone && justCompleted.current) {
      setCelebrateScore(100);
    }
    justCompleted.current = false; // consume the flag every render
  }, [allTasksDone, isToday]);

  const router = useRouter();

  if (loading) return <LoadingScreen />;

  const title = dayTitle(selectedDate, todayStr);
  const word  = dayWord(selectedDate, todayStr);
  const retryLoad = () => { setLoadError(false); load(selectedDate); };

  const renderHabitRow = (habit: HabitWithStatus) => (
    <HabitRow
      key={habit.id}
      habit={habit}
      theme={theme}
      canToggle={canLog}
      isControl={isControl}
      ySelected={isControl ? (habit.yFailed || yPressedIds.has(habit.id)) : false}
      fromChallenge={challengeNames.has(habit.name.trim().toLowerCase())}
      onToggle={isControl ? undefined : () => guardDate(() => toggleHabit(habit))}
      onPressN={isControl ? () => guardDate(() => handleControlN(habit)) : undefined}
      onPressY={isControl ? () => guardDate(() => handleControlY(habit)) : undefined}
      onInfo={() => setDetailHabit(habit)}
      onLongPress={() => handleHabitMenu(habit)}
    />
  );

  return (
    <DarkBackground><SafeAreaView style={s.safe} edges={['top']}>

      {/* ── Top bar: which day this is, and a short welcome ── */}
      <View style={s.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={[s.dayTitle, { color: theme.text, fontFamily: 'BricolageGrotesque_800ExtraBold' }]} accessibilityRole="header">
            {title}
          </Text>
          {isToday && (
            <Text style={[s.welcome, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
              {greeting(new Date().getHours(), user?.name)} One small step is enough.
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[s.iconBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => router.push('/(tabs)/profile')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Profile and settings"
        >
          <Ionicons name="settings-outline" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Top bar row 2: dates ── */}
      <View style={s.datesRow}>
        <DaySelector selectedDate={selectedDate} onSelect={setSelectedDate} />
      </View>

      <DateSwipe onPrev={goPrev} onNext={goNext} canPrev={canPrev} canNext={canNext}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />}
      >
        {!isToday && (
          <ViewingBanner theme={theme} canLog={canLog} onToday={goToday} />
        )}

        {!dayReady ? (
          loadError ? (
            <ErrorState
              message={habitList.length === 0 ? "Couldn't load your habits." : "Couldn't load this day."}
              onRetry={retryLoad}
            />
          ) : (
            <View style={s.dayLoading}>
              <ActivityIndicator color={theme.text} />
              <Text style={[s.dayLoadingText, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                Loading {word}…
              </Text>
            </View>
          )
        ) : (
          <>
            {loadError && (
              <TouchableOpacity
                style={[s.staleNote, { borderColor: theme.border, backgroundColor: theme.card }]}
                onPress={retryLoad}
                accessibilityRole="button"
                accessibilityLabel="Couldn't refresh. Tap to retry."
              >
                <Ionicons name="cloud-offline-outline" size={16} color={theme.textSecondary} />
                <Text style={[s.staleText, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                  Couldn't refresh, so this may be out of date. Tap to retry.
                </Text>
              </TouchableOpacity>
            )}

            {/* 1 — the one next action, before any numbers */}
            <NextStepCard
              step={nextStep}
              theme={theme}
              isToday={isToday}
              date={selectedDate}
              dayWord={word}
              onAct={logFromCard}
              onAddHabit={() => setShowAdd(true)}
            />

            {/* 2 — up to three chosen habits, with quick completion */}
            <PrioritiesCard
              priorities={priorityHabits}
              hasHabits={habitList.length > 0}
              theme={theme}
              date={selectedDate}
              todayStr={todayStr}
              canLog={canLog}
              onAct={logFromCard}
              onUndo={h => guardDate(() => clearLog(h))}
              onEdit={() => setShowPriorityPicker(true)}
              onAllHabits={() => scrollRef.current?.scrollTo({ y: Math.max(0, allHabitsY.current - 8), animated: true })}
            />

            {/* 3 — optional check-in (separate from the score) and the AI entry point */}
            {canLog && (
              <CheckInCard
                key={selectedDate}
                checkIn={checkIns[selectedDate]}
                theme={theme}
                isToday={isToday}
                onSelect={saveCheckIn}
                onSkip={() => saveCheckIn(null)}
              />
            )}
            <AskGritttRow theme={theme} onPress={() => setShowAsk(true)} />

            {/* 4 — small factual summary; charts live on the progress screen */}
            <ProgressCard summary={summary} theme={theme} onDetails={() => router.push('/(tabs)/profile')} />

            {/* 5 — the full habit list */}
            <View style={s.allHead} onLayout={e => { allHabitsY.current = e.nativeEvent.layout.y; }}>
              <Text style={[s.allTitle, { color: theme.text, fontFamily: 'Inter_800ExtraBold' }]} accessibilityRole="header">
                All habits
              </Text>
              <Text style={[s.allSub, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                {isToday ? 'Today' : formatLongDate(selectedDate, todayStr)}
              </Text>
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
              <TouchableOpacity style={s.segmentedBtn} onPress={() => switchTab('build')} activeOpacity={0.8}
                accessibilityRole="button" accessibilityState={{ selected: activeTab === 'build' }}>
                <Text style={[s.segmentedText, {
                  color: activeTab === 'build' ? theme.text : theme.textSecondary,
                  fontFamily: 'Inter_900Black',
                }]}>BUILD</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.segmentedBtn} onPress={() => switchTab('control')} activeOpacity={0.8}
                accessibilityRole="button" accessibilityState={{ selected: activeTab === 'control' }}>
                <Text style={[s.segmentedText, {
                  color: activeTab === 'control' ? theme.text : theme.textSecondary,
                  fontFamily: 'Inter_900Black',
                }]}>CONTROL</Text>
              </TouchableOpacity>
            </View>

            {/* Stats row: X / Y scheduled done  |  +N SCORE */}
            <View style={s.statRow}>
              <Text style={[s.statLeft, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                {visibleScheduled.filter(h => h.done).length} / {visibleScheduled.length} SCHEDULED DONE
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
              <>
                {visibleScheduled.map(renderHabitRow)}
                {visibleOff.length > 0 && (
                  <>
                    <Text style={[s.offHead, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                      Not scheduled {isToday ? 'today' : 'on this day'} · optional
                    </Text>
                    <View style={{ opacity: 0.6 }}>{visibleOff.map(renderHabitRow)}</View>
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
      </DateSwipe>

      {undo && <UndoBar message={undo.message} theme={theme} onUndo={undoLast} />}

      <PriorityPickerModal
        visible={showPriorityPicker}
        habits={dayHabits}
        selected={activePriorityIds}
        theme={theme}
        onClose={() => setShowPriorityPicker(false)}
        onSave={savePriorities}
      />

      <AskGritttSheet
        visible={showAsk}
        onClose={() => setShowAsk(false)}
        screen="today"
        context={assistantContext}
        contextError={loadError && !dayReady}
        onRetryContext={retryLoad}
        token={token}
        userId={userKey}
        theme={theme}
        handlers={{
          onMarkDone: assistantMarkDone,
          onSetPriority: assistantSetPriority,
          onOpenHabit: id => { const h = dayHabits.find(x => x.id === id); if (h) setDetailHabit(h); },
          onNavigate: route => router.push(route as any),
        }}
      />

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
        accessibilityRole="button"
        accessibilityLabel="Add habit"
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
      <Modal visible={!!countHabit} transparent animationType="fade" onRequestClose={closeCountModal}>
        <Pressable style={cs.backdrop} onPress={closeCountModal}>
          <Pressable style={[cs.card, { backgroundColor: theme.bg, borderColor: theme.border }]} onPress={e => e.stopPropagation()}>
            <Text style={[cs.title, { color: theme.text, fontFamily: 'Inter_900Black' }]}>
              {isToday
                ? (countIsY ? 'HOW MANY TODAY?' : countHabit?.category === 'control' ? 'HOW MUCH TODAY?' : 'COUNT TODAY')
                : (countIsY ? 'HOW MANY?' : countHabit?.category === 'control' ? 'HOW MUCH?' : 'COUNT')}
            </Text>
            <Text style={[cs.subtitle, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
              {countHabit?.name}{isToday ? '' : `\nSaving to ${formatLongDate(selectedDate, todayStr)}`}
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
                onPress={closeCountModal}
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

      <DayCompleteCelebration
        visible={celebrateScore !== null}
        score={celebrateScore ?? 0}
        theme={theme}
        onClose={() => setCelebrateScore(null)}
      />
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
  const [completionByDate, setCompletionByDate] = useState<Map<string, { failed: boolean; count: number | null }>>(new Map());
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

  // AI analysis
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult]   = useState<AiAnalysis | null>(null);

  async function runAnalysis() {
    setAiLoading(true);
    try {
      const res = await habits.aiAnalysis(token, habit.name);
      setAiResult(res);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setAiLoading(false);
    }
  }

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
        setCompletionByDate(new Map(res.completions.map(c => [c.date, { failed: c.failed, count: c.count }])));
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
    cells.push(toDateStr(d));
  }
  while (cells.length % 7 !== 0) cells.push('');

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const consistencyColor = consistency >= 70 ? '#34C759' : consistency >= 40 ? '#F59E0B' : '#EF4444';

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={[hd.sheet, { backgroundColor: theme.bg }]}>
        <View style={[hd.handleBar, { backgroundColor: theme.border }]} />
        <ScrollView contentContainerStyle={hd.scrollContent} keyboardShouldPersistTaps="handled">
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
                        const isPast     = dateStr <= today();
                        const isDone     = doneDates.has(dateStr);
                        const completion = completionByDate.get(dateStr);
                        const isFailed   = completion?.failed ?? false;
                        const isToday2   = dateStr === today();
                        const dayNum     = parseInt(dateStr.slice(8), 10);

                        let bg = 'transparent';
                        if (isToday2)      bg = theme.inverse;
                        else if (isFailed) bg = '#E84A4A';
                        else if (isDone)   bg = '#22A664';
                        else if (isPast)   bg = theme.surface;

                        return (
                          <View key={di} style={[hd.calCell, {
                            backgroundColor: bg,
                            borderRadius: 7,
                            opacity: !isPast && !isToday2 ? 0.3 : 1,
                          }]}>
                            {isDone && isFailed && !isToday2 && (
                              completion?.count != null
                                ? <Text style={{ fontSize: 10, color: '#FFFFFF', fontFamily: 'Inter_900Black' }}>{completion.count}</Text>
                                : <Ionicons name="close" size={11} color="#FFFFFF" />
                            )}
                            {isDone && !isFailed && !isToday2 && (
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
                  {habit.category === 'control' && (
                    <View style={hd.legendItem}>
                      <View style={[hd.legendDot, { backgroundColor: '#E84A4A' }]} />
                      <Text style={[hd.legendText, { color: theme.textMuted, fontFamily: 'Inter_500Medium' }]}>Violated</Text>
                    </View>
                  )}
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

              {/* AI analysis */}
              <View style={{ marginTop: 4 }}>
                <AiAnalysisButton loading={aiLoading} onPress={runAnalysis} theme={theme} />
              </View>
              {aiResult && (
                <View style={{ marginTop: 12 }}>
                  <AiAnalysisCard result={aiResult} theme={theme} />
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const hd = StyleSheet.create({
  sheet:          { flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12 },
  handleBar:      { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  scrollContent:  { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 16 },
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

function HabitRow({ habit, theme, canToggle, isControl, fromChallenge, ySelected, onToggle, onPressY, onPressN, onInfo, onLongPress }: {
  habit: HabitWithStatus; theme: any; canToggle: boolean; isControl: boolean;
  fromChallenge?: boolean;
  ySelected?: boolean;
  onToggle?: () => void;
  onPressY?: () => void;
  onPressN?: () => void;
  onInfo: () => void;
  onLongPress?: () => void;
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
      onLongPress={onLongPress}
      delayLongPress={300}
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
          {/* Streak — hide when Y is active (failed = no streak credit) */}
          {habit.streak > 0 && !yActive && (
            <View style={s.streakBadge}>
              <Text style={{ fontSize: 10 }}>🔥</Text>
              <Text style={[s.streakText, { color: theme.textTertiary, fontFamily: 'Inter_700Bold' }]}>
                {habit.streak}
              </Text>
            </View>
          )}
          {/* Count badge — show for Y (red) and N (green), hide when neither selected */}
          {habit.count != null && (yActive || nActive) && (
            <View style={[s.countBadge, { backgroundColor: yActive ? '#E84A4A20' : '#22A66420' }]}>
              <Text style={[s.impactText, { color: yActive ? '#E84A4A' : '#22A664', fontFamily: 'SpaceGrotesk_700Bold' }]}>
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
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 3 }}
            accessibilityRole="button"
            accessibilityLabel={`${habit.name}: slipped`}
            accessibilityState={{ selected: !!yActive }}
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
            hitSlop={{ top: 6, bottom: 6, left: 3, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={`${habit.name}: stayed in control`}
            accessibilityState={{ selected: !!nActive }}
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
  topBar:        { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12, gap: 10 },
  dayTitle:      { fontSize: 21, lineHeight: 26 },
  welcome:       { fontSize: 14, lineHeight: 20, marginTop: 2 },
  iconBtn:       { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  // Today screen
  dayLoading:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 48 },
  dayLoadingText:{ fontSize: 14 },
  staleNote:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 12, minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderRadius: 14 },
  staleText:     { fontSize: 13, lineHeight: 18, flex: 1 },
  allHead:       { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 },
  allTitle:      { fontSize: 17 },
  allSub:        { fontSize: 13 },
  offHead:       { fontSize: 12, letterSpacing: 0.4, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  // Legacy (still used by other modal styles inline)
  topIcon:       { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modeLabel:     { fontSize: 10, letterSpacing: 1.5, lineHeight: 15 },

  datesRow:      { paddingHorizontal: 14, paddingBottom: 8 },
  scroll:        { paddingBottom: 150, paddingTop: 4 },
  trackerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  trackerTitle:  { fontSize: 20, letterSpacing: -0.5 },

  // BUILD / CONTROL segmented control
  segmented:     { flexDirection: 'row', marginHorizontal: 16, marginBottom: 4, padding: 4, borderRadius: 16, height: 48, position: 'relative' },
  segmentedPill: { position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  segmentedBtn:  { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  segmentedText: { fontSize: 12, letterSpacing: 2.5 },

  // Stats row above habit list
  statRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  statLeft:      { fontSize: 10, letterSpacing: 2 },
  statRight:     { fontSize: 10, letterSpacing: 2 },

  fab:           { position: 'absolute', bottom: 20, right: 18, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
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
