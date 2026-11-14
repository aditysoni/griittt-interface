import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DarkBackground } from '../../components/DarkBackground';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { fuel, fuelQuestions, FuelQuestion, FuelQuestionResponses, ai, FoodLog, FoodItem, MealTime, today, shiftDate } from '../../lib/api';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorState } from '../../components/ErrorState';
import { DaySelector } from '../../components/DaySelector';
import { DateSwipe, useDateNav } from '../../components/DateSwipe';
import { useTheme } from '../../components/ThemeContext';
import { AskGritttButton } from '../../components/AskGritttButton';
import { ViewingBanner } from '../../components/TodayCards';
import {
  ChoiceChips, Disclosure, EmptyState, EntryRow, IconButton, PrimaryButton, SecondaryButton, SectionCard,
  TrackingHeader, WeekSummaryCard, timeOf,
} from '../../components/TrackingShared';
import { FoodCheckIn, FoodCheckInMap, FoodFeel, foodStorage } from '../../lib/storage';
import { formatShortDate } from '../../lib/today';
import * as ImagePicker from 'expo-image-picker';
import { AddCustomModal, QuestionDetailModal } from '../fuel-questions';

// ── Short card title per checklist question, matched by keyword in the prompt ──
// Titles must describe the question actually asked: "junk food" and "sugar" are
// different questions and get different titles.
const QUESTION_TITLES: Array<{ match: RegExp; title: string }> = [
  { match: /quality|clean/i,           title: 'Food quality' },
  { match: /protein/i,                 title: 'Protein' },
  { match: /fibre|fiber/i,             title: 'Fibre' },
  { match: /hydrat|water/i,            title: 'Hydration' },
  { match: /junk/i,                    title: 'Junk food' },
  { match: /sugar|sweet/i,             title: 'Sugar' },
  { match: /digestion|bowel/i,         title: 'Digestion' },
  { match: /energy/i,                  title: 'Energy' },
  { match: /sleep/i,                   title: 'Sleep' },
  { match: /home.?cooked/i,            title: 'Home cooked' },
  { match: /adherence|plan|diet/i,     title: 'Plan adherence' },
  { match: /fruit|veg/i,               title: 'Fruit & veg' },
];
function questionTitle(prompt: string): string {
  const preset = QUESTION_TITLES.find(v => v.match.test(prompt))?.title;
  if (preset) return preset;
  const words = prompt.replace(/[?.!]+$/, '').split(/\s+/);
  return words.slice(0, 3).join(' ');
}

const QUALITY_LABELS = ['Terrible','Very poor','Poor','Below avg','Average','Average+','Good','Great','Excellent','Outstanding','Perfect'];

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

  const [selectedDate, setSelectedDate] = useState(today());
  const { goPrev, goNext, canPrev, canNext } = useDateNav(selectedDate, setSelectedDate);
  const [logs, setLogs]                 = useState<FoodLog[]>([]);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [submitting, setSubmitting]     = useState(false);

  // Checklist (the app's existing "fuel questions")
  const [activeQuestions, setActiveQuestions] = useState<FuelQuestion[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, number>>({});
  const [dayResponses, setDayResponses] = useState<FuelQuestionResponses | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [detailQuestion, setDetailQuestion] = useState<FuelQuestion | null>(null);

  // Food items (real meal records)
  const [foodItems, setFoodItems]       = useState<FoodItem[]>([]);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [recentFoods, setRecentFoods]   = useState<FoodItem[]>([]);

  // Weekly facts: which of the 7 days ending on the selected date have records
  const [checklistDays, setChecklistDays] = useState<Set<string>>(new Set());
  const [logDays, setLogDays]             = useState<Set<string>>(new Set());

  // Quick check-in (device-stored; see lib/storage foodStorage for the backend contract)
  const [checkIns, setCheckIns]   = useState<FoodCheckInMap>({});
  const [drafts, setDrafts]       = useState<Record<string, QuickDraft>>({});   // keyed by date so switching days never discards typing
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const todayStr = today();
  const isToday = selectedDate === todayStr;
  const canLog  = selectedDate <= todayStr;
  const weekFrom = shiftDate(selectedDate, -6);

  const draft = drafts[selectedDate] ?? { feel: null, note: '' };
  const setDraft = (patch: Partial<QuickDraft>) => setDrafts(d => ({ ...d, [selectedDate]: { ...(d[selectedDate] ?? { feel: null, note: '' }), ...patch } }));
  const savedCheckIn: FoodCheckIn | undefined = checkIns[selectedDate];
  const showCheckInForm = canLog && (!savedCheckIn || editingDate === selectedDate);

  async function load(date: string) {
    if (!token) return;
    const from = shiftDate(date, -6);
    const results = await Promise.allSettled([
      fuel.logs(token, date),
      fuel.items(token, date),
      fuelQuestions.scoreRange(token, from, date),
      fuelQuestions.catalog(token),
      fuelQuestions.getResponses(token, date),
      fuel.history(token, from, date),
    ]);
    if (results[0].status === 'rejected' && results[1].status === 'rejected') { setLoadError(true); return; }
    setLoadError(false);
    const val = <T,>(i: number, fb: T): T =>
      results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<T>).value : fb;
    setLogs(val(0, [] as FoodLog[]));
    const items = val(1, [] as FoodItem[]);
    setFoodItems(items);
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
    const catalog = val(3, [] as FuelQuestion[]);
    setActiveQuestions(catalog.filter(q => q.selected));
    const responses = val(4, null as FuelQuestionResponses | null);
    setDayResponses(responses && responses.answers?.length ? responses : null);
    const prefilled: Record<string, number> = {};
    for (const a of responses?.answers ?? []) prefilled[a.questionId] = a.optionIndex;
    setQuestionAnswers(prefilled);
    const hist = val(5, [] as Array<{ date: string; score: number | null; foodQuality: number | null }>);
    setLogDays(new Set(hist.filter(h => h.score != null || h.foodQuality != null).map(h => h.date)));
  }

  useEffect(() => {
    let cancelled = false;
    foodStorage.getAll(userKey).then(m => { if (!cancelled) setCheckIns(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, [userKey]);

  useEffect(() => { load(selectedDate).finally(() => setLoading(false)); }, [token, selectedDate]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(selectedDate); setRefreshing(false); }, [token, selectedDate]);

  async function saveQuickCheckIn() {
    if (!draft.feel) return;
    const entry: FoodCheckIn = { feel: draft.feel, note: draft.note.trim(), updatedAt: new Date().toISOString() };
    const date = selectedDate;
    setCheckIns(prev => ({ ...prev, [date]: entry }));
    setEditingDate(null);
    setDrafts(d => { const n = { ...d }; delete n[date]; return n; });
    try { await foodStorage.set(userKey, date, entry); }
    catch { Alert.alert('Could not save', 'The check-in could not be stored on this device.'); }
  }
  function startEditCheckIn() {
    if (!savedCheckIn) return;
    setDrafts(d => ({ ...d, [selectedDate]: { feel: savedCheckIn.feel, note: savedCheckIn.note } }));
    setEditingDate(selectedDate);
  }

  async function deleteItem(id: string) {
    if (!token) return;
    try { await fuel.deleteItem(token, id); setFoodItems(prev => prev.filter(i => i.id !== id)); }
    catch (err: any) { Alert.alert('Error', err.message); }
  }
  async function updateItem(item: FoodItem, patch: { calories?: number; protein?: number; fat?: number; carbs?: number }) {
    if (!token) return;
    try { await fuel.editItem(token, item.id, patch); await load(selectedDate); }
    catch (err: any) { Alert.alert('Error', err.message); }
  }

  async function submitChecklist() {
    if (!token || activeQuestions.length === 0) return;
    const missing = activeQuestions.filter(q => q.required && questionAnswers[q.id] === undefined);
    if (missing.length) { Alert.alert('One more answer needed', `Please answer: ${missing.map(q => questionTitle(q.prompt)).join(', ')}.`); return; }
    setSubmitting(true);
    try {
      await fuelQuestions.submitResponses(token, {
        date: selectedDate,
        answers: Object.entries(questionAnswers).map(([questionId, optionIndex]) => ({ questionId, optionIndex })),
      });
      await load(selectedDate);
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setSubmitting(false); }
  }

  // ── Weekly facts (7 days ending on the selected date, no inference) ────────────
  const week = useMemo(() => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) days.push(shiftDate(selectedDate, -i));
    const pastDays = days.filter(d => d <= todayStr);
    const withAny = pastDays.filter(d => checkIns[d] || checklistDays.has(d) || logDays.has(d));
    const withQuick = pastDays.filter(d => !!checkIns[d]);
    const withChecklist = pastDays.filter(d => checklistDays.has(d));
    return { days: pastDays.length, withAny: withAny.length, withQuick: withQuick.length, withChecklist: withChecklist.length };
  }, [selectedDate, todayStr, checkIns, checklistDays, logDays]);

  const caloriesToday = useMemo(() => {
    const withCal = foodItems.filter(i => i.calories != null);
    return { items: withCal.length, kcal: Math.round(withCal.reduce((a, i) => a + (i.calories ?? 0), 0)) };
  }, [foodItems]);

  if (loading) return <LoadingScreen />;

  const checklistAnswered = dayResponses?.answers?.length ?? 0;
  const hasEntries = !!savedCheckIn || checklistAnswered > 0 || foodItems.length > 0 || logs.length > 0;
  const dayWordShort = isToday ? 'today' : `on ${formatShortDate(selectedDate)}`;

  return (
    <DarkBackground><SafeAreaView style={s.safe} edges={['top']}>
      <TrackingHeader
        title="Food"
        subtitle="A simple picture of how eating is going."
        date={selectedDate}
        todayStr={todayStr}
        theme={theme}
        right={<>
          <AskGritttButton screen="food" date={selectedDate} compact />
          <IconButton icon="settings-outline" label="Profile and settings" onPress={() => router.push('/(tabs)/profile')} theme={theme} />
        </>}
      />
      <View style={s.datesRow}>
        <DaySelector selectedDate={selectedDate} onSelect={setSelectedDate} />
      </View>

      <DateSwipe onPrev={goPrev} onNext={goNext} canPrev={canPrev} canNext={canNext}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />}>

        {!isToday && <ViewingBanner theme={theme} canLog={canLog} onToday={() => setSelectedDate(todayStr)} />}

        {loadError && (
          <ErrorState message="Couldn't load your food records." onRetry={() => { setLoading(true); load(selectedDate).finally(() => setLoading(false)); }} />
        )}

        {/* 1 — Quick check-in: the first useful interaction */}
        {canLog && (
          <SectionCard
            title={showCheckInForm ? `How did eating go ${dayWordShort}?` : 'Food check-in'}
            subtitle={showCheckInForm ? 'One tap is enough. A note is optional.' : undefined}
            theme={theme}
          >
            {showCheckInForm ? (
              <>
                <ChoiceChips options={FEEL_OPTIONS} value={draft.feel} onChange={feel => setDraft({ feel })} theme={theme} />
                <TextInput
                  style={[s.noteInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface, fontFamily: 'Inter_500Medium' }]}
                  value={draft.note}
                  onChangeText={note => setDraft({ note: note.slice(0, 280) })}
                  placeholder="Add a note (optional)"
                  placeholderTextColor={theme.textTertiary}
                  multiline
                  maxLength={280}
                  accessibilityLabel="Optional note about eating"
                  maxFontSizeMultiplier={1.6}
                />
                <View style={s.formActions}>
                  <PrimaryButton label={savedCheckIn ? 'Save changes' : 'Save check-in'} onPress={saveQuickCheckIn} disabled={!draft.feel} theme={theme} />
                  {savedCheckIn && <SecondaryButton label="Cancel" onPress={() => { setEditingDate(null); setDrafts(d => { const n = { ...d }; delete n[selectedDate]; return n; }); }} theme={theme} />}
                </View>
                <Text style={[s.fine, { color: theme.textTertiary, fontFamily: 'Inter_500Medium' }]} maxFontSizeMultiplier={1.6}>
                  Saved on this device. It is a note to yourself and does not change any score.
                </Text>
              </>
            ) : (
              <View style={[s.savedRow, { borderColor: theme.success, backgroundColor: theme.success + '14' }]} accessibilityLiveRegion="polite">
                <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.savedTitle, { color: theme.text, fontFamily: 'Inter_800ExtraBold' }]} maxFontSizeMultiplier={1.5}>{FEEL_LABEL[savedCheckIn!.feel]}</Text>
                  <Text style={[s.fine, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]} maxFontSizeMultiplier={1.6}>
                    Saved for {formatShortDate(selectedDate)}{timeOf(savedCheckIn!.updatedAt) ? ` at ${timeOf(savedCheckIn!.updatedAt)}` : ''}
                  </Text>
                  {!!savedCheckIn!.note && <Text style={[s.savedNote, { color: theme.text, fontFamily: 'Inter_500Medium' }]} maxFontSizeMultiplier={1.8}>“{savedCheckIn!.note}”</Text>}
                </View>
                <TouchableOpacity onPress={startEditCheckIn} style={s.editBtn} accessibilityRole="button" accessibilityLabel="Edit food check-in">
                  <Text style={[s.editText, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>Edit</Text>
                </TouchableOpacity>
              </View>
            )}
          </SectionCard>
        )}

        {/* 2 — Optional detail, collapsed by default */}
        {canLog && (
          <Disclosure
            label="Add more detail"
            hint={`${activeQuestions.length ? `${activeQuestions.length} checklist question${activeQuestions.length === 1 ? '' : 's'}` : 'Checklist'} · food items with nutrition`}
            open={detailOpen}
            onToggle={() => setDetailOpen(v => !v)}
            theme={theme}
          >
            {activeQuestions.length > 0 && (
              <SectionCard title="Your checklist" subtitle="Answer what you know. Skip or pick Not sure for the rest." theme={theme}>
                {activeQuestions.map((q, qi) => {
                  const answered = questionAnswers[q.id] !== undefined;
                  return (
                    <View key={q.id} style={[qcs.block, qi > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                      <View style={qcs.blockHead}>
                        <View style={{ flex: 1 }}>
                          <Text style={[qcs.title, { color: theme.text, fontFamily: 'Inter_700Bold' }]} maxFontSizeMultiplier={1.5}>
                            {questionTitle(q.prompt)}{q.required ? '' : <Text style={{ color: theme.textTertiary, fontFamily: 'Inter_500Medium' }}>  · optional</Text>}
                          </Text>
                          <Text style={[qcs.subtitle, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]} maxFontSizeMultiplier={1.6}>{q.prompt}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setDetailQuestion(q)} style={qcs.histBtn} accessibilityRole="button" accessibilityLabel={`History for ${questionTitle(q.prompt)}`}>
                          <Ionicons name="stats-chart-outline" size={16} color={theme.textSecondary} />
                        </TouchableOpacity>
                      </View>
                      <View style={qcs.optionsRow}>
                        {q.options.map((opt, oi) => {
                          const active = questionAnswers[q.id] === oi;
                          return (
                            <TouchableOpacity
                              key={oi}
                              onPress={() => setQuestionAnswers(prev => ({ ...prev, [q.id]: oi }))}
                              activeOpacity={0.75}
                              style={[qcs.optionChip, { backgroundColor: active ? theme.inverse : 'transparent', borderColor: active ? theme.inverse : theme.borderStrong }]}
                              accessibilityRole="radio"
                              accessibilityState={{ checked: active }}
                              accessibilityLabel={opt}
                            >
                              <Text style={[qcs.optionText, { color: active ? theme.inverseText : theme.text, fontFamily: 'Inter_600SemiBold' }]} maxFontSizeMultiplier={1.4}>{opt}</Text>
                            </TouchableOpacity>
                          );
                        })}
                        {!q.required && (
                          <TouchableOpacity
                            onPress={() => setQuestionAnswers(prev => { const n = { ...prev }; delete n[q.id]; return n; })}
                            activeOpacity={0.75}
                            style={[qcs.optionChip, { backgroundColor: 'transparent', borderColor: theme.border, borderStyle: 'dashed' }]}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: !answered }}
                            accessibilityLabel="Not sure"
                          >
                            <Text style={[qcs.optionText, { color: theme.textSecondary, fontFamily: 'Inter_600SemiBold' }]} maxFontSizeMultiplier={1.4}>Not sure</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
                <View style={s.formActions}>
                  <PrimaryButton label={checklistAnswered ? 'Update checklist' : 'Save checklist'} onPress={submitChecklist} loading={submitting} theme={theme} />
                  <SecondaryButton label="Add question" icon="add" onPress={() => setCustomOpen(true)} theme={theme} />
                </View>
                <Text style={[s.fine, { color: theme.textTertiary, fontFamily: 'Inter_500Medium' }]} maxFontSizeMultiplier={1.6}>
                  The checklist score is the weighted sum of these answers, out of 100. It is separate from the quick check-in.
                </Text>
              </SectionCard>
            )}
            {activeQuestions.length === 0 && (
              <SectionCard title="Your checklist" theme={theme}>
                <EmptyState icon="list-outline" title="No checklist questions selected" body="Choose the questions you want to answer each day." action={{ label: 'Choose questions', onPress: () => router.push('/fuel-questions' as any) }} theme={theme} />
              </SectionCard>
            )}
            <SectionCard title="Food items" subtitle="Record what you ate, with nutrition if you know it. Snap a photo to estimate it." theme={theme}>
              <SecondaryButton label="Log a food item" icon="add" onPress={() => setLogModalOpen(true)} theme={theme} />
            </SectionCard>
          </Disclosure>
        )}

        {/* 3 — What is recorded for this day */}
        <SectionCard title={isToday ? "Today's entries" : `Entries for ${formatShortDate(selectedDate)}`} theme={theme}>
          {!hasEntries ? (
            <EmptyState
              icon="restaurant-outline"
              title={canLog ? 'No food check-in yet.' : 'Nothing was recorded for this day.'}
              body={canLog ? 'The quick check-in above takes one tap.' : 'This is an absence of records, not a bad day.'}
              theme={theme}
            />
          ) : (
            <>
              {savedCheckIn && (
                <EntryRow icon="chatbubble-ellipses-outline" title={`Check-in: ${FEEL_LABEL[savedCheckIn.feel]}`} meta={savedCheckIn.note || 'No note'} time={timeOf(savedCheckIn.updatedAt)} onEdit={canLog ? startEditCheckIn : undefined} theme={theme} last={!checklistAnswered && foodItems.length === 0 && logs.length === 0} />
              )}
              {checklistAnswered > 0 && (
                <EntryRow icon="checkbox-outline" title="Checklist answered" meta={`${checklistAnswered} question${checklistAnswered === 1 ? '' : 's'}${dayResponses?.checklistScore != null ? ` · score ${Math.round(dayResponses.checklistScore)} of 100` : ''}`} onEdit={canLog ? () => setDetailOpen(true) : undefined} theme={theme} last={foodItems.length === 0 && logs.length === 0} />
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

        {foodItems.length > 0 && (
          <>
            <View style={s.subHead}>
              <Text style={[s.subHeadText, { color: theme.text, fontFamily: 'Inter_800ExtraBold' }]} accessibilityRole="header" maxFontSizeMultiplier={1.5}>Food items</Text>
              <Text style={[s.fine, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>{foodItems.length} · tap a number to edit</Text>
            </View>
            {foodItems.map(item => (
              <FoodItemCard key={item.id} item={item} theme={theme}
                onDelete={canLog ? () => deleteItem(item.id) : undefined}
                onUpdate={canLog ? (patch) => updateItem(item, patch) : undefined} />
            ))}
          </>
        )}

        {/* 4 — Weekly facts */}
        <WeekSummaryCard
          title="This week"
          period={`${formatShortDate(weekFrom)} – ${formatShortDate(selectedDate)} · ${week.days} day${week.days === 1 ? '' : 's'}`}
          rows={[
            { label: 'Days with any record', value: `${week.withAny} of ${week.days}` },
            { label: 'Quick check-ins', value: String(week.withQuick), hint: 'on this device' },
            { label: 'Checklist days', value: String(week.withChecklist) },
            ...(caloriesToday.items > 0 ? [{ label: isToday ? 'Calories recorded today' : 'Calories recorded', value: `${caloriesToday.kcal.toLocaleString()} kcal`, hint: `from ${caloriesToday.items} item${caloriesToday.items === 1 ? '' : 's'}` }] : []),
          ]}
          note={week.days - week.withAny > 0
            ? `${week.days - week.withAny} day${week.days - week.withAny === 1 ? ' has' : 's have'} no record. Missing days are not counted as bad days.`
            : week.days > 0 ? 'Every day this week has a record.' : null}
          onHistory={() => router.push('/(tabs)/building-you' as any)}
          theme={theme}
        />
        <Text style={[s.fine, { color: theme.textTertiary, fontFamily: 'Inter_500Medium', marginHorizontal: 20, marginBottom: 20 }]} maxFontSizeMultiplier={1.6}>
          Counts show what was logged, not how well you ate.
        </Text>
      </ScrollView>
      </DateSwipe>

      <AddCustomModal open={customOpen} token={token!} theme={theme} onClose={() => setCustomOpen(false)} onSaved={() => { setCustomOpen(false); load(selectedDate); }} />
      <QuestionDetailModal question={detailQuestion} token={token!} theme={theme} onClose={() => setDetailQuestion(null)} />
      <LogFoodModal open={logModalOpen} token={token!} date={selectedDate} theme={theme} recentFoods={recentFoods}
        onClose={() => setLogModalOpen(false)} onSaved={() => { setLogModalOpen(false); load(selectedDate); }} />
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
  block:      { paddingVertical: 12 },
  blockHead:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  title:      { fontSize: 15, lineHeight: 20 },
  subtitle:   { fontSize: 13, lineHeight: 18, marginTop: 2 },
  histBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: -8, marginRight: -8 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 999, borderWidth: 1.5 },
  optionText: { fontSize: 13 },
});

const s = StyleSheet.create({
  safe:        { flex: 1 },
  datesRow:    { paddingHorizontal: 14, paddingBottom: 10 },
  scroll:      { paddingBottom: 110 },
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
  // Log-food sheet (kept from the previous design)
  snapRow:          { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, gap: 10 },
  snapBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 12, minHeight: 48 },
  snapBtnText:      { fontSize: 11, letterSpacing: 2 },
  snapBtnSm:        { width: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12 },
  orRow:            { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 16, gap: 10 },
  orLine:           { flex: 1, height: 1 },
  orText:           { fontSize: 8, letterSpacing: 2 },
  foodNameBox:      { flexDirection: 'row', alignItems: 'center', minHeight: 52, marginHorizontal: 16, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  foodNameInput:    { flex: 1, fontSize: 15, lineHeight: 20, paddingVertical: 0 },
  detailFieldLabel: { fontSize: 8, letterSpacing: 2.5, marginHorizontal: 16, marginBottom: 10 },
  mealTimeRow:      { paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  mealChip:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 40, borderWidth: 1, borderRadius: 10 },
  mealChipEmoji:    { fontSize: 13 },
  mealChipLabel:    { fontSize: 9, letterSpacing: 1.5 },
  submitBtn:        { marginHorizontal: 16, marginTop: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  submitBtnText:    { fontSize: 10, letterSpacing: 4 },
});
