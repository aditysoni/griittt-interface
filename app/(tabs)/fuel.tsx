import {FoodBodyDiagram} from '../../components/FoodBodyDiagram';
import {FoodInsightCard} from '../../components/TrackingInsightCards';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DarkBackground } from '../../components/DarkBackground';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { fuel, fuelQuestions, FuelQuestion, FuelQuestionResponses, FuelMonthlyAnalysis, FoodLog, FoodItem, today, shiftDate } from '../../lib/api';
import { TrackingLoadingScreen } from '../../components/LoadingScreen';
import { ErrorState } from '../../components/ErrorState';
import { DateSwipe, useDateNav } from '../../components/DateSwipe';
import { useTheme } from '../../components/ThemeContext';
import { AskGritttButton } from '../../components/AskGritttButton';
import { ViewingBanner } from '../../components/TodayCards';
import {
  ChoiceChips, Disclosure, EmptyState, EntryRow, IconButton, PrimaryButton, SecondaryButton, SectionCard,
  TrackingHeader, timeOf,
} from '../../components/TrackingShared';
import { FoodCheckIn, FoodCheckInMap, FoodFeel, foodStorage } from '../../lib/storage';
import { formatShortDate } from '../../lib/today';
import { FoodIntake, IntakeMap, INTAKE_OPTIONS, foodIntakeStorage } from '../../lib/foodIntake';
import { FoodQuestionCard, IntakeChartModal } from '../../components/FoodDailyCards';
import { VoiceLogButton } from '../../components/VoiceLogButton';
import { DaySelector } from '../../components/DaySelector';
import { ArcGauge, MomentumPill } from '../../components/ScoreGauge';
import { FoodSubmissionMode, FoodModeTabs, FoodOverview, DetailedFoodView } from '../../components/FoodDetailedView';
import { FoodEntrySheet } from '../../components/FoodEntrySheet';
import { FoodDetailMap, foodDetailStorage } from '../../lib/foodDetails';
import { AddCustomModal, QuestionDetailModal } from '../fuel-questions';

const FEEL_OPTIONS: { key: FoodFeel; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'difficult', label: 'Difficult', icon: 'cloudy-outline' },
  { key: 'mixed',     label: 'Mixed',     icon: 'partly-sunny-outline' },
  { key: 'well',      label: 'Went well', icon: 'sunny-outline' },
];
const FEEL_LABEL: Record<FoodFeel, string> = { difficult: 'Difficult', mixed: 'Mixed', well: 'Went well' };

type QuickDraft = { feel: FoodFeel | null; note: string };

export default function FuelScreen() {
  const { token, user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const userKey = user?.id ?? 'anon';
  const [mode, setMode] = useState<FoodSubmissionMode>('quick');
  const scrollRef = useRef<ScrollView>(null);
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);
  const [photoDetails, setPhotoDetails] = useState<FoodDetailMap>({});
  const [photoDetailsError, setPhotoDetailsError] = useState(false);
  const [foodItemsError, setFoodItemsError] = useState(false);
  const [itemsDate, setItemsDate] = useState('');
  const [analysisData, setAnalysisData] = useState<FuelMonthlyAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(false);
  const [analysisVersion, setAnalysisVersion] = useState(0);
  const [detailedDays, setDetailedDays] = useState<Set<string>>(new Set());
  const [detailWeekComplete, setDetailWeekComplete] = useState(false);

  const [selectedDate, setSelectedDate] = useState(today());
  const { goPrev, goNext, canPrev, canNext } = useDateNav(selectedDate, setSelectedDate);
  const [logs, setLogs]                 = useState<FoodLog[]>([]);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [submitting, setSubmitting]     = useState(false);

  // Checklist (the app's existing "fuel questions")
  const [activeQuestions, setActiveQuestions] = useState<FuelQuestion[]>([]);
  const [questionDrafts, setQuestionDrafts] = useState<Record<string, Record<string, number>>>({});
  const [dayResponses, setDayResponses] = useState<FuelQuestionResponses | null>(null);
  const [catalogQuestions, setCatalogQuestions] = useState<FuelQuestion[]>([]);
  const [recordsComplete, setRecordsComplete] = useState(false);
  const requestId = useRef(0);
  const [dayLoading, setDayLoading] = useState(false);
  const [intakeEntries, setIntakeEntries] = useState<IntakeMap>({});
  const [intakeDrafts, setIntakeDrafts] = useState<Record<string, FoodIntake>>({});
  const [intakeHistoryOpen, setIntakeHistoryOpen] = useState(false);
  const [intakeLoadError, setIntakeLoadError] = useState(false);
  const [savedAt, setSavedAt] = useState<{ date: string; time: string } | null>(null);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [detailQuestion, setDetailQuestion] = useState<FuelQuestion | null>(null);

  // Food items (real meal records)
  const [foodItems, setFoodItems]       = useState<FoodItem[]>([]);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [recentFoods, setRecentFoods]   = useState<FoodItem[]>([]);

  // Weekly facts: which of the 7 days ending on the selected date have records
  const [dailyScores,setDailyScores] = useState<Record<string,number | null>>({});
  const [checklistDays, setChecklistDays] = useState<Set<string>>(new Set());
  const [logDays, setLogDays]             = useState<Set<string>>(new Set());

  // Quick check-in (device-stored; see lib/storage foodStorage for the backend contract)
  const [checkIns, setCheckIns]   = useState<FoodCheckInMap>({});
  const [drafts, setDrafts]       = useState<Record<string, QuickDraft>>({});   // keyed by date so switching days never discards typing
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const serverAnswers = useMemo(() => Object.fromEntries(((dayResponses?.date === selectedDate ? dayResponses.answers : [])).map(a => [a.questionId, a.optionIndex])), [dayResponses, selectedDate]);
  const questionAnswers = questionDrafts[selectedDate] ?? serverAnswers;
  const setQuestionAnswers = (update: (previous: Record<string, number>) => Record<string, number>) => {
    setQuestionDrafts(previous => ({ ...previous, [selectedDate]: update(previous[selectedDate] ?? serverAnswers) }));
    setSavedAt(null);
  };
  const intakeAnswer = intakeDrafts[selectedDate] ?? intakeEntries[selectedDate]?.answer ?? null;
  const qualityQuestion = catalogQuestions.find(q => q.isPreset && /quality/i.test(q.prompt)) ?? catalogQuestions.find(q => /quality/i.test(q.prompt));
  const customQuestions = activeQuestions.filter(q => q.isCustom && q.id !== qualityQuestion?.id);
  const otherQuestions = activeQuestions.filter(q => !q.isCustom && q.id !== qualityQuestion?.id);
  const intakeChanged = intakeDrafts[selectedDate] !== undefined && intakeDrafts[selectedDate] !== intakeEntries[selectedDate]?.answer;
  const answersChanged = Object.entries(questionAnswers).some(([id, value]) => serverAnswers[id] !== value);
  const hasChanges = intakeChanged || answersChanged;

  const todayStr = today();
  const isToday = selectedDate === todayStr;
  const canLog  = selectedDate <= todayStr;

  const draft = drafts[selectedDate] ?? { feel: null, note: '' };
  const setDraft = (patch: Partial<QuickDraft>) => setDrafts(d => ({ ...d, [selectedDate]: { ...(d[selectedDate] ?? { feel: null, note: '' }), ...patch } }));
  const savedCheckIn: FoodCheckIn | undefined = checkIns[selectedDate];
  const showCheckInForm = canLog && (!savedCheckIn || editingDate === selectedDate);

  async function load(date: string) {
    if (!token) return;
    const currentRequest = ++requestId.current;
    setDayLoading(true);
    const from = shiftDate(date, -6);
    const results = await Promise.allSettled([
      fuel.logs(token, date),
      fuel.items(token, date),
      fuelQuestions.scoreRange(token, shiftDate(today(), -90), today()),
      fuelQuestions.catalog(token),
      fuelQuestions.getResponses(token, date),
      fuel.history(token, from, date),
    ]);
    if (currentRequest !== requestId.current) return;
    setDayLoading(false);
    setRecordsComplete(results.every(result => result.status === 'fulfilled'));

    setLoadError(results[3].status === 'rejected' || results[4].status === 'rejected');
    const val = <T,>(i: number, fb: T): T =>
      results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<T>).value : fb;
    setLogs(val(0, [] as FoodLog[]));
    const items = val(1, [] as FoodItem[]);
    setFoodItems(items);
    setFoodItemsError(results[1].status === 'rejected');
    setItemsDate(date);
    if (items.length > 0) {
      setRecentFoods(prev => {
        const merged = [...items, ...prev];
        const seen = new Set<string>();
        const deduped: FoodItem[] = [];
        for (const it of merged) {
          const key = it.name.trim().toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key); deduped.push(it);
        }
        return deduped.slice(0, 20);
      });
    }
    const scoreRange = val(2, null as any);
    const scoreDays: Array<{ date: string; checklistScore: number | null }> = scoreRange?.days ?? (scoreRange ? [scoreRange] : []);
    setChecklistDays(new Set(scoreDays.filter(d => d.checklistScore != null).map(d => d.date)));
    setDailyScores(Object.fromEntries(scoreDays.map(day=>[day.date,day.checklistScore])));
    const catalog = val(3, [] as FuelQuestion[]);
    setCatalogQuestions(catalog);
    setActiveQuestions(catalog.filter(q => q.selected));
    const responses = val(4, null as FuelQuestionResponses | null);
    setDayResponses(responses && responses.answers?.length ? responses : null);
    // Unsaved answers remain keyed by date; loading another day never overwrites them.
    const hist = val(5, [] as Array<{ date: string; score: number | null; foodQuality: number | null }>);
    setLogDays(new Set(hist.filter(h => h.score != null || h.foodQuality != null).map(h => h.date)));
  }

  useEffect(() => {
    let cancelled = false;
    setDailyScores({}); setPhotoDetails({}); setRecentFoods([]); setAnalysisData(null); setDetailedDays(new Set());
    foodDetailStorage.getAll(userKey).then(details => { if (!cancelled) { setPhotoDetails(details); setPhotoDetailsError(false); } }).catch(() => { if (!cancelled) setPhotoDetailsError(true); });
    setCheckIns({}); setIntakeEntries({}); setIntakeDrafts({}); setQuestionDrafts({}); setSavedAt(null);
    foodStorage.getAll(userKey).then(m => { if (!cancelled) setCheckIns(m); }).catch(() => {});
    foodIntakeStorage.getAll(userKey).then(m => { if (!cancelled) { setIntakeEntries(m); setIntakeLoadError(false); } }).catch(() => { if (!cancelled) setIntakeLoadError(true); });
    return () => { cancelled = true; };
  }, [userKey]);

  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [mode]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setAnalysisLoading(true); setAnalysisError(false); setDetailWeekComplete(false);
    const dates = Array.from({ length: 7 }, (_, index) => shiftDate(selectedDate, index - 6));
    Promise.allSettled([fuel.monthlyAnalysis(token, selectedDate.slice(0, 7)), ...dates.map(date => fuel.items(token, date))]).then(results => {
      if (cancelled) return;
      const analysis = results[0];
      if (analysis.status === 'fulfilled') setAnalysisData(analysis.value as FuelMonthlyAnalysis);
      else { setAnalysisData(null); setAnalysisError(true); }
      const logged = new Set<string>();
      const recent: FoodItem[] = [];
      results.slice(1).forEach((result, index) => { if (result.status === 'fulfilled') { const items = result.value as FoodItem[]; if (items.length) logged.add(dates[index]); recent.push(...items); } });
      setDetailedDays(logged); setDetailWeekComplete(results.slice(1).every(result => result.status === 'fulfilled'));
      setRecentFoods(previous => { const all = [...recent, ...previous].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); const names = new Set<string>(); return all.filter(item => { const name = item.name.trim().toLowerCase(); if (names.has(name)) return false; names.add(name); return true; }).slice(0, 20); });
      setAnalysisLoading(false);
    });
    return () => { cancelled = true; };
  }, [token, selectedDate, analysisVersion]);
  async function refreshFoodDetails() {
    try { setPhotoDetails(await foodDetailStorage.getAll(userKey)); setPhotoDetailsError(false); }
    catch { setPhotoDetailsError(true); }
  }
  useEffect(() => { load(selectedDate).finally(() => setLoading(false)); }, [token, selectedDate]);
  const onRefresh = useCallback(async () => { setRefreshing(true); try { const entries = await foodIntakeStorage.getAll(userKey); setIntakeEntries(entries); setIntakeLoadError(false); } catch { setIntakeLoadError(true); } await Promise.all([load(selectedDate), refreshFoodDetails()]); setAnalysisVersion(value => value + 1); setRefreshing(false); }, [token, selectedDate, userKey]);

  async function saveQuickCheckIn() {
    if (!draft.feel) return;
    const entry: FoodCheckIn = { feel: draft.feel, note: draft.note.trim(), updatedAt: new Date().toISOString() };
    const date = selectedDate;
    try {
      await foodStorage.set(userKey, date, entry);
      setCheckIns(prev => ({ ...prev, [date]: entry }));
      setEditingDate(null);
      setDrafts(d => { const n = { ...d }; delete n[date]; return n; });
    }
    catch { Alert.alert('Could not save', 'The check-in could not be stored on this device.'); }
  }
  function startEditCheckIn() {
    if (!savedCheckIn) return;
    setDrafts(d => ({ ...d, [selectedDate]: { feel: savedCheckIn.feel, note: savedCheckIn.note } }));
    setEditingDate(selectedDate);
    setRecordsOpen(true);
  }

  function removeFood(item: FoodItem) {
    if (!token) return;
    Alert.alert('Remove this food entry?', `Remove “${item.name}” and its nutrition from this day?`, [
      { text: 'Keep entry', style: 'cancel' },
      { text: 'Remove entry', style: 'destructive', onPress: async () => {
        try {
          await fuel.deleteItem(token, item.id);
          await foodDetailStorage.remove(userKey, item.id, photoDetails[item.id]).catch(() => {});
          await Promise.all([load(selectedDate), refreshFoodDetails()]); setAnalysisVersion(value => value + 1);
        } catch (error: any) { Alert.alert('Could not remove entry', error.message); }
      } },
    ]);
  }

  async function saveDailyAnswers() {
    if (!token || !canLog || !hasChanges || submitting || dayLoading || intakeLoadError || loadError) return;
    const date = selectedDate;
    const owner = userKey;
    const intake = intakeAnswer;
    const changes = Object.entries(questionAnswers).filter(([id, value]) => serverAnswers[id] !== value);
    setSubmitting(true);
    setSavedAt(null);
    let remoteSaved = false;
    try {
      if (changes.length) {
        const result = await fuelQuestions.submitResponses(token, { date, answers: changes.map(([questionId, optionIndex]) => ({ questionId, optionIndex })) });
        const accepted = new Set(result.answers.filter(a => typeof a.optionIndex === 'number').map(a => a.questionId));
        remoteSaved = accepted.size > 0;
        if (changes.some(([id]) => !accepted.has(id))) throw new Error('Some answers were not accepted. Your selections are still here; please retry.');
      }
      if (intake && intakeChanged) {
        const entry = { answer: intake, updatedAt: new Date().toISOString() };
        await foodIntakeStorage.set(owner, date, entry);
        setIntakeEntries(previous => ({ ...previous, [date]: entry }));
        setIntakeDrafts(previous => { const next = { ...previous }; delete next[date]; return next; });
      }
      await load(date);
      setQuestionDrafts(previous => { const next = { ...previous }; delete next[date]; return next; });
      setSavedAt({ date, time: new Date().toISOString() });
    } catch (error: any) {
      if (remoteSaved) await load(date);
      Alert.alert(remoteSaved ? 'Some answers were saved' : 'Could not save answers', remoteSaved ? `Some question answers were saved. ${error.message || 'The remaining answers could not be saved.'} Your selections are still here; please retry.` : error.message || 'Your selections are still here. Please try again.');
    } finally { setSubmitting(false); }
  }

  function renderQuestion(q: FuelQuestion) {
    return <FoodQuestionCard key={q.id} title={q.prompt} options={q.options.map((label, index) => ({ key: String(index), label }))}
      value={questionAnswers[q.id] === undefined ? null : String(questionAnswers[q.id])}
      onChange={value => setQuestionAnswers(previous => ({ ...previous, [q.id]: Number(value) }))}
      onHistory={() => setDetailQuestion(q)} theme={theme} disabled={!canLog || submitting || dayLoading} />;
  }

  if (loading) return <TrackingLoadingScreen title="Food" />;

  const checklistAnswered = dayResponses?.answers?.length ?? 0;
  const recordedDates = new Set([...Object.keys(checkIns), ...Object.keys(intakeEntries), ...checklistDays, ...logDays, ...detailedDays]);
  const visibleFoodItems = itemsDate === selectedDate ? foodItems : [];
  const hasEntries = !!savedCheckIn || checklistAnswered > 0 || foodItems.length > 0 || logs.length > 0;

  return (
    <DarkBackground><SafeAreaView style={s.safe} edges={['top']}>
      <TrackingHeader
        title="Food"
        showDate={false}
        date={selectedDate}
        todayStr={todayStr}
        theme={theme}
        right={<>
          <AskGritttButton screen="food" date={selectedDate} compact />
          <VoiceLogButton domain="food" date={selectedDate} token={token} disabled={!canLog||submitting||dayLoading} onSaved={()=>{void onRefresh()}}/>
          <IconButton icon="settings-outline" label="Profile and settings" onPress={() => router.push('/(tabs)/profile')} theme={theme} />
        </>}
      />
      <View style={{marginBottom:14}}><DaySelector selectedDate={selectedDate} onSelect={setSelectedDate} scores={dailyScores} disabled={submitting}/></View>
      <DateSwipe onPrev={goPrev} onNext={goNext} canPrev={canPrev && !submitting} canNext={canNext && !submitting}>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />}>

        {!isToday && <ViewingBanner theme={theme} canLog={canLog} onToday={() => setSelectedDate(todayStr)} />}

        {mode === 'quick' && loadError && (
          <ErrorState message="Couldn't load your food records." onRetry={() => { setLoading(true); load(selectedDate).finally(() => setLoading(false)); }} />
        )}

        {/* Weekly card retained while trying the Habits-style gauge.
        <FoodOverview dailyScores={dailyScores} score={!dayLoading ? dailyScores[selectedDate] : null} scoreLabel={isToday ? "Today’s score" : "Day’s score"} mode={mode} endDate={selectedDate} recordedDates={recordedDates} complete={recordsComplete && !intakeLoadError && detailWeekComplete} analysis={analysisData} loading={analysisLoading} error={analysisError} onRetry={() => setAnalysisVersion(value => value + 1)} theme={theme} />
        */}
        <ArcGauge value={!dayLoading ? dailyScores[selectedDate] ?? (loadError ? null : 0) : null} label="Food score" theme={theme}/>
        <View style={{alignItems:'center',marginTop:8,marginBottom:18}}><MomentumPill score={!dayLoading ? dailyScores[selectedDate] ?? (loadError ? null : 0) : null} theme={theme}/></View>
      <FoodModeTabs mode={mode} onChange={setMode} theme={theme} disabled={submitting} />
        {mode === 'quick' ? <>
        <View style={s.dailyHeading}><Text style={[s.subHeadText, { color: theme.text, fontFamily: 'Inter_800ExtraBold' }]} accessibilityRole="header">{isToday ? 'Your daily check-in' : `Check-in · ${formatShortDate(selectedDate)}`}</Text>{dayLoading && <ActivityIndicator size="small" color={theme.textSecondary} />}</View>
        {intakeLoadError && <ErrorState message="Intake history could not be loaded. Retry before saving." onRetry={onRefresh} />}
        <FoodQuestionCard title="How was your food intake?" subtitle="Compared with your usual day."
          options={INTAKE_OPTIONS} value={intakeAnswer}
          onChange={value => { setIntakeDrafts(previous => ({ ...previous, [selectedDate]: value as FoodIntake })); setSavedAt(null); }}
          onHistory={() => setIntakeHistoryOpen(true)} theme={theme} disabled={!canLog || submitting || dayLoading} />
        {qualityQuestion ? renderQuestion(qualityQuestion) : <SectionCard title="Food quality" theme={theme}><Text style={[s.fine, { color: theme.textSecondary }]}>Food quality questions could not be loaded.</Text><SecondaryButton label="Retry questions" onPress={onRefresh} theme={theme} /></SectionCard>}

        <View style={s.customHeading}><Text style={[s.customLabel, { color: theme.textSecondary }]} accessibilityRole="header">YOUR QUESTIONS{customQuestions.length ? ` · ${customQuestions.length}` : ''}</Text><TouchableOpacity onPress={() => setCustomOpen(true)} disabled={!canLog || submitting} style={s.addQuestionButton} accessibilityRole="button" accessibilityLabel="Add a custom food question"><Ionicons name="add" size={18} color={theme.text} /><Text style={[s.editText, { color: theme.text, fontFamily: 'Inter_600SemiBold' }]}>Add question</Text></TouchableOpacity></View>
        {customQuestions.map(renderQuestion)}

        {!!otherQuestions.length && <Disclosure label="More food questions" hint={`${otherQuestions.length} existing questions · optional to answer`} open={detailOpen} onToggle={() => setDetailOpen(value => !value)} theme={theme}>{otherQuestions.map(renderQuestion)}</Disclosure>}

        <View style={s.saveArea}>
          <PrimaryButton label={submitting ? 'Saving…' : 'Save answers'} onPress={saveDailyAnswers} disabled={!hasChanges || !canLog || dayLoading || intakeLoadError || loadError} loading={submitting} theme={theme} icon="checkmark" />
          {savedAt?.date === selectedDate && <Text style={[s.fine, { color: theme.textSecondary }]} accessibilityLiveRegion="polite">Saved at {timeOf(savedAt.time)}</Text>}
        </View>

        <Disclosure label="Previous check-ins" hint="Earlier check-ins and nutrition summaries" open={recordsOpen} onToggle={() => setRecordsOpen(value => !value)} theme={theme}>
          {showCheckInForm && savedCheckIn && editingDate === selectedDate && <SectionCard title="Edit previous check-in" theme={theme}>
            <ChoiceChips options={FEEL_OPTIONS} value={draft.feel} onChange={feel => setDraft({ feel })} theme={theme} />
            <TextInput style={[s.noteInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]} value={draft.note} onChangeText={note => setDraft({ note: note.slice(0, 280) })} placeholder="Add a note (optional)" placeholderTextColor={theme.textSecondary} multiline maxLength={280} accessibilityLabel="Optional note about eating" />
            <View style={s.formActions}><PrimaryButton label="Save previous check-in" onPress={saveQuickCheckIn} disabled={!draft.feel} theme={theme} /><SecondaryButton label="Cancel" onPress={() => setEditingDate(null)} theme={theme} /></View>
          </SectionCard>}
          <View style={{ marginHorizontal: 16, marginBottom: 12 }}><SecondaryButton label="Open detailed food log" icon="restaurant-outline" onPress={() => setMode('detailed')} theme={theme} /></View>
        {/* 3 — What is recorded for this day */}
        <SectionCard title={isToday ? "Today's entries" : `Entries for ${formatShortDate(selectedDate)}`} theme={theme}>
          {!hasEntries ? (
            <EmptyState
              icon="restaurant-outline"
              title={canLog ? 'No food check-in yet.' : 'Nothing was recorded for this day.'}
              body={canLog ? 'Your daily questions are above. You can also add a food item.' : 'This is an absence of records, not a bad day.'}
              theme={theme}
            />
          ) : (
            <>
              {savedCheckIn && (
                <EntryRow icon="chatbubble-ellipses-outline" title={`Check-in: ${FEEL_LABEL[savedCheckIn.feel]}`} meta={savedCheckIn.note || 'No note'} time={timeOf(savedCheckIn.updatedAt)} onEdit={canLog ? startEditCheckIn : undefined} theme={theme} last={!checklistAnswered && foodItems.length === 0 && logs.length === 0} />
              )}
              {checklistAnswered > 0 && (
                <EntryRow icon="checkbox-outline" title="Checklist answered" meta={`${checklistAnswered} question${checklistAnswered === 1 ? '' : 's'}${dayResponses?.checklistScore != null ? ` · score ${Math.round(dayResponses.checklistScore)} of 100` : ''}`} onEdit={canLog ? () => { setRecordsOpen(false); setDetailOpen(true); } : undefined} theme={theme} last={foodItems.length === 0 && logs.length === 0} />
              )}
              {logs.length > 0 && logs.map((log, i) => (
                <EntryRow
                  key={log.id}
                  icon={log.mode === 'simple' ? 'flash-outline' : 'nutrition-outline'}
                  title={log.mode === 'simple' ? 'Quick log' : 'Nutrition log'}
                  meta={mealRowSummary(log)}
                  time={timeOf(log.createdAt)}
                  theme={theme}
                  last={i === logs.length - 1 && foodItems.length === 0}
                />
              ))}
            </>
          )}
        </SectionCard>

        </Disclosure>
        <View style={s.manageRow}><SecondaryButton label="Manage questions" icon="options-outline" onPress={() => router.push('/fuel-questions' as any)} theme={theme} /></View>
        </> : <>
          <FoodInsightCard token={token} date={selectedDate} version={analysisVersion} details={photoDetails}/>
          <FoodBodyDiagram token={token} date={selectedDate} version={analysisVersion}/>
          {photoDetailsError && <ErrorState message="Local food photos or portion notes could not be loaded." onRetry={refreshFoodDetails} />}
          <DetailedFoodView date={selectedDate} todayStr={todayStr} items={visibleFoodItems} details={photoDetails} loading={dayLoading || itemsDate !== selectedDate} error={foodItemsError} canLog={canLog} onRetry={onRefresh}
            onAdd={() => { setEditingFood(null); setLogModalOpen(true); }} onEdit={item => { setEditingFood(item); setLogModalOpen(true); }} onDelete={removeFood} theme={theme} />
        </>}
      </ScrollView>
      </DateSwipe>

      <IntakeChartModal open={intakeHistoryOpen} entries={intakeEntries} endDate={selectedDate} onClose={() => setIntakeHistoryOpen(false)} theme={theme} />
      <AddCustomModal open={customOpen} token={token!} theme={theme} onClose={() => setCustomOpen(false)} onSaved={() => { setCustomOpen(false); load(selectedDate); }} />
      <QuestionDetailModal initialTab="graph" question={detailQuestion} token={token!} theme={theme} onClose={() => setDetailQuestion(null)} />
      <FoodEntrySheet open={logModalOpen} token={token!} userId={userKey} date={selectedDate} item={editingFood} detail={editingFood ? photoDetails[editingFood.id] : undefined} theme={theme} recentFoods={recentFoods}
        onClose={() => setLogModalOpen(false)} onSaved={() => { setLogModalOpen(false); setEditingFood(null); load(selectedDate); refreshFoodDetails(); setAnalysisVersion(value => value + 1); }} />
    </SafeAreaView></DarkBackground>
  );
}

function mealRowSummary(log: FoodLog): string {
  if (log.mode === 'simple') {
    const bits: string[] = [];
    if (log.hadThreeMeals != null) bits.push(log.hadThreeMeals ? 'three meals' : 'fewer than three meals');
    if (log.foodQuality != null) bits.push(`quality ${log.foodQuality}/10`);
    if (log.hadJunkFood != null) bits.push(log.hadJunkFood ? 'junk food: yes' : 'junk food: no');
    return bits.join(' · ') || 'Quick log';
  }
  const bits: string[] = [];
  if (log.calories != null) bits.push(`${Math.round(log.calories)} kcal`);
  if (log.protein != null) bits.push(`${Math.round(log.protein)} g protein`);
  if (log.mealsLogged != null) bits.push(`${log.mealsLogged} meals`);
  if (log.notes) bits.push(log.notes);
  return bits.join(' · ') || 'Nutrition log';
}

const s = StyleSheet.create({
  safe:        { flex: 1 },
  datesRow:    { paddingHorizontal: 14, paddingBottom: 10 },
  scroll:      { paddingBottom: 40 },
  compactDateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 8 },
  dateArrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  todayLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  dailyHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  customHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginTop: 2, marginBottom: 4 },
  customLabel: { fontSize: 11, letterSpacing: 1, fontFamily: 'Inter_600SemiBold' },
  addQuestionButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4 },
  customHint: { marginHorizontal: 20, marginBottom: 14, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_500Medium' },
  saveArea: { marginHorizontal: 16, marginTop: 4, marginBottom: 22 },
  storageHint: { fontSize: 11, lineHeight: 17, marginTop: 5, fontFamily: 'Inter_400Regular' },
  manageRow: { marginHorizontal: 16, marginTop: 6, marginBottom: 12 },
  noteInput:   { minHeight: 48, maxHeight: 120, marginTop: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderRadius: 14 },
  formActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 14 },
  fine:        { fontSize: 12, lineHeight: 17, marginTop: 10 },
  savedRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, borderWidth: 1, borderRadius: 14 },
  savedTitle:  { fontSize: 16, lineHeight: 21 },
  savedNote:   { fontSize: 14, lineHeight: 20, marginTop: 6 },
  editBtn:     { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  editText:    { fontSize: 13 },
  subHead:     { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 2 },
  subHeadText: { fontSize: 17 },
});
