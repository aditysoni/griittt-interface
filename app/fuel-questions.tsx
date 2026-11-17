import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { fuelQuestions, FuelQuestion, AiAnalysis, today } from '../lib/api';
import { useTheme } from '../components/ThemeContext';
import { DarkBackground } from '../components/DarkBackground';
import { AiAnalysisButton, AiAnalysisCard } from '../components/AiAnalysisCard';

export default function FuelQuestionsScreen() {
  const { token } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const [catalog, setCatalog]       = useState<FuelQuestion[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [customOpen, setCustomOpen] = useState(false);
  const [detailQuestion, setDetailQuestion] = useState<FuelQuestion | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fuelQuestions.catalog(token);
      setCatalog(data);
      setSelected(new Set(data.filter(q => q.selected).map(q => q.id)));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveSelection() {
    if (!token) return;
    setSaving(true);
    try {
      await fuelQuestions.setSelection(token, Array.from(selected));
      Alert.alert('Saved', 'Your daily questions have been updated.');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion(q: FuelQuestion) {
    if (!token) return;
    Alert.alert('Delete question?', `"${q.prompt}" will be removed. Past answers are kept.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await fuelQuestions.deleteCustom(token, q.id);
            load();
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  }

  const grouped: Record<string, FuelQuestion[]> = {};
  for (const q of catalog) {
    if (!grouped[q.category]) grouped[q.category] = [];
    grouped[q.category].push(q);
  }

  if (loading) {
    return (
      <DarkBackground>
        <SafeAreaView style={s.safe} edges={['top']}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={theme.text} />
          </View>
        </SafeAreaView>
      </DarkBackground>
    );
  }

  return (
    <DarkBackground>
      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Header */}
        <View style={s.topBar}>
          <TouchableOpacity style={[s.backBtn, { borderColor: theme.border }]} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={18} color={theme.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: theme.text, fontFamily: 'Inter_900Black' }]}>Fuel Questions</Text>
            <Text style={[s.subtitle, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
              {selected.size} selected · asked daily
            </Text>
          </View>
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => setCustomOpen(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>

      

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />}
        >
          {Object.entries(grouped).map(([category, questions]) => (
            <View key={category}>
              <Text style={[s.categoryLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                {category.toUpperCase()}
              </Text>
              <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {questions.map((q, i) => (
                  <View key={q.id} style={[s.questionRow, i < questions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                    <TouchableOpacity
                      style={[s.checkbox, {
                        backgroundColor: selected.has(q.id) ? theme.inverse : 'transparent',
                        borderColor: selected.has(q.id) ? theme.inverse : theme.border,
                      }]}
                      onPress={() => toggle(q.id)}
                      activeOpacity={0.7}
                    >
                      {selected.has(q.id) && <Ionicons name="checkmark" size={12} color={theme.inverseText} />}
                    </TouchableOpacity>

                    <TouchableOpacity style={{ flex: 1 }} onPress={() => toggle(q.id)} activeOpacity={0.7}>
                      <Text style={[s.questionPrompt, { color: theme.text, fontFamily: 'Inter_600SemiBold' }]}>
                        {q.prompt}
                      </Text>
                      <View style={s.optionPills}>
                        {q.options.map((opt, oi) => (
                          <View key={oi} style={[s.optionPill, { backgroundColor: theme.surface }]}>
                            <Text style={[s.optionText, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>{opt}</Text>
                          </View>
                        ))}
                      </View>
                      <View style={s.questionMeta}>
                        {q.isPreset && (
                          <View style={[s.metaBadge, { backgroundColor: theme.surface }]}>
                            <Text style={[s.metaBadgeText, { color: theme.textSecondary }]}>PRESET</Text>
                          </View>
                        )}
                        {q.isCustom && (
                          <View style={[s.metaBadge, { backgroundColor: '#0A84FF18' }]}>
                            <Text style={[s.metaBadgeText, { color: '#0A84FF' }]}>CUSTOM</Text>
                          </View>
                        )}
                        {q.required && (
                          <View style={[s.metaBadge, { backgroundColor: '#E84A4A18' }]}>
                            <Text style={[s.metaBadgeText, { color: '#E84A4A' }]}>REQUIRED</Text>
                          </View>
                        )}
                        <Text style={[s.metaWeight, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                          weight {q.weight}×
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setDetailQuestion(q)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="stats-chart-outline" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>

                    {q.isCustom && (
                      <TouchableOpacity onPress={() => deleteQuestion(q)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="trash-outline" size={15} color={theme.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))}

          {catalog.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Text style={[{ color: theme.textSecondary, fontSize: 14 }]}>No questions yet</Text>
            </View>
          )}
        </ScrollView>

        {/* Save button */}
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: 'transparent', paddingHorizontal: 16, paddingBottom: 8 }}>
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: theme.text, opacity: saving ? 0.6 : 1 }]}
            onPress={saveSelection}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={[s.saveBtnText, { color: theme.bg, fontFamily: 'Inter_900Black' }]}>
              {saving ? 'SAVING...' : `SAVE  ·  ${selected.size} QUESTIONS`}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>

        <AddCustomModal
          open={customOpen}
          token={token!}
          theme={theme}
          onClose={() => setCustomOpen(false)}
          onSaved={() => { setCustomOpen(false); load(); }}
        />

        <QuestionDetailModal
          question={detailQuestion}
          token={token!}
          theme={theme}
          onClose={() => setDetailQuestion(null)}
        />
      </SafeAreaView>
    </DarkBackground>
  );
}

// ── Add custom question modal ──────────────────────────────────────────────────

export function AddCustomModal({ open, token, theme, onClose, onSaved }: {
  open: boolean; token: string; theme: any;
  onClose: () => void; onSaved: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [weight, setWeight] = useState('1');
  const [saving, setSaving] = useState(false);
  const [optionCount, setOptionCount] = useState<2 | 5 | 8>(2);
  const [suggestingWeight, setSuggestingWeight] = useState(false);

  function reset() {
    setPrompt(''); setOptions(['', '']); setWeight('1'); setOptionCount(2);
  }

  async function suggestWeight() {
    if (!prompt.trim()) { Alert.alert('Enter a question first', 'Fill in the question text so AI has something to rate.'); return; }
    const filled = options.filter(o => o.trim());
    if (filled.length < 2) { Alert.alert('Fill in options first', 'Add at least 2 options so AI can judge the scale.'); return; }
    setSuggestingWeight(true);
    try {
      const res = await fuelQuestions.suggestWeight(token, { prompt: prompt.trim(), options: filled });
      setWeight(String(res.weight));
      if (res.reasoning) Alert.alert(`Suggested weight: ${res.weight}×`, res.reasoning);
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSuggestingWeight(false); }
  }

  function switchOptionCount(n: 2 | 5 | 8) {
    setOptionCount(n);
    setOptions(Array.from({ length: n }, () => ''));
  }

  async function handleSave() {
    if (!prompt.trim()) { Alert.alert('Required', 'Enter a question.'); return; }
    const filled = options.filter(o => o.trim());
    if (filled.length !== optionCount) {
      Alert.alert('Required', `Fill in all ${optionCount} options.`);
      return;
    }
    setSaving(true);
    try {
      await fuelQuestions.createCustom(token, {
        prompt: prompt.trim(),
        options: options.map(o => o.trim()),
        weight: Number(weight) || 1,
        reverseScoring: false,
        required: false,
      });
      reset(); onSaved();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
      <View style={[cm.sheet, { backgroundColor: theme.bg }]}>
        <View style={[cm.handle, { backgroundColor: theme.border }]} />
        <View style={[cm.header, { borderBottomColor: theme.border }]}>
          <Text style={[cm.title, { color: theme.text, fontFamily: 'Inter_900Black' }]}>ADD QUESTION</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Ionicons name="close" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={cm.body} keyboardShouldPersistTaps="handled">
          <Text style={[cm.label, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>QUESTION</Text>
          <TextInput
            style={[cm.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface, fontFamily: 'Inter_500Medium' }]}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="e.g. Did you cook at home today?"
            placeholderTextColor={theme.textSecondary}
            multiline
          />

          <Text style={[cm.label, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>OPTIONS</Text>
          <View style={[cm.optCountRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {([2, 5, 8] as const).map(n => (
              <TouchableOpacity
                key={n}
                style={[cm.optCountBtn, optionCount === n && { backgroundColor: theme.inverse }]}
                onPress={() => switchOptionCount(n)}
                activeOpacity={0.7}
              >
                <Text style={[cm.optCountText, { color: optionCount === n ? theme.inverseText : theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                  {n} Options
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {options.map((opt, i) => (
            <View key={i} style={cm.optRow}>
              <View style={[cm.optBadge, { backgroundColor: theme.surface }]}>
                <Text style={[cm.optBadgeText, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{i + 1}</Text>
              </View>
              <TextInput
                style={[cm.optInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface, fontFamily: 'Inter_500Medium' }]}
                value={opt}
                onChangeText={v => setOptions(prev => { const n = [...prev]; n[i] = v; return n; })}
                placeholder={`Option ${i + 1}${i === 0 ? ' (worst)' : i === options.length - 1 ? ' (best)' : ''}`}
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          ))}

          <Text style={[cm.hint, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            Score goes from 0% (option 1) to 100% (last option). Answers auto-score based on position.
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[cm.label, { color: theme.textSecondary, fontFamily: 'Inter_700Bold', marginBottom: 0 }]}>
              WEIGHT · {weight}×
            </Text>
            <TouchableOpacity
              onPress={suggestWeight}
              disabled={suggestingWeight}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, opacity: suggestingWeight ? 0.5 : 1 }}
            >
              {suggestingWeight
                ? <ActivityIndicator size="small" color="#34C759" />
                : <Ionicons name="sparkles" size={13} color="#34C759" />}
              <Text style={{ fontSize: 11, letterSpacing: 0.3, color: '#34C759', fontFamily: 'Inter_800ExtraBold' }}>
                {suggestingWeight ? 'THINKING...' : 'ASK AI'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={[cm.weightRow, { marginTop: 8 }]}>
            {['1', '2', '3', '5', '8', '10'].map(w => (
              <TouchableOpacity
                key={w}
                style={[cm.weightBtn, { backgroundColor: weight === w ? theme.inverse : theme.surface, borderColor: theme.border }]}
                onPress={() => setWeight(w)}
                activeOpacity={0.7}
              >
                <Text style={[cm.weightText, { color: weight === w ? theme.inverseText : theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                  {w}×
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[cm.hint, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            Higher weight = more impact on your daily fuel score. Tap "Ask AI" to let it judge based on the question.
          </Text>

          <TouchableOpacity
            style={[cm.saveBtn, { backgroundColor: theme.text, opacity: (!prompt.trim() || saving) ? 0.4 : 1 }]}
            onPress={handleSave}
            disabled={!prompt.trim() || saving}
            activeOpacity={0.85}
          >
            <Text style={[cm.saveBtnText, { color: theme.bg, fontFamily: 'Inter_900Black' }]}>
              {saving ? 'ADDING...' : 'ADD QUESTION'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Question detail: 30-day calendar / trend graph + AI analysis ───────────────

const DAY_LABELS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function scoreColor(score: number): string {
  if (score >= 70) return '#22A664';
  if (score >= 40) return '#F0A12E';
  return '#E84A4A';
}

export function QuestionDetailModal({ question, token, theme, onClose, initialTab = 'calendar' }: {
  question: FuelQuestion | null; token: string; theme: any; onClose: () => void; initialTab?: 'calendar' | 'graph';
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    avgScore: number | null; answeredCount: number;
    answers: Array<{ date: string; optionIndex: number; optionLabel: string | null; score: number }>;
  } | null>(null);
  const [tab, setTab] = useState<'calendar' | 'graph'>(initialTab);
  const [historyError, setHistoryError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiAnalysis | null>(null);

  useEffect(() => {
    if (!question) return;
    let cancelled = false;
    setLoading(true); setHistoryError(false); setData(null); setAiResult(null); setTab(initialTab);
    fuelQuestions.history(token, question.id, 28)
      .then(res => { if (!cancelled) setData({ avgScore: res.avgScore, answeredCount: res.answeredCount, answers: res.answers }); })
      .catch(() => { if (!cancelled) setHistoryError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [question?.id, token, initialTab, retry]);

  async function runAnalysis() {
    if (!question) return;
    setAiLoading(true);
    try {
      const res = await fuelQuestions.aiAnalysis(token, question.id);
      setAiResult(res);
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setAiLoading(false); }
  }

  const byDate = new Map((data?.answers ?? []).map(a => [a.date, a]));

  // Build a 28-day grid (Mon-aligned, 4 rows) ending today.
  const cells: string[] = [];
  const base = new Date();
  base.setDate(base.getDate() - 27);
  const dow = (base.getDay() + 6) % 7; // Mon=0
  base.setDate(base.getDate() - dow);
  const gridStart = new Date(base);
  for (let i = 0; i < 35; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    if (d > new Date()) break;
    cells.push(d.toISOString().slice(0, 10));
  }
  const weeks: string[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <Modal visible={!!question} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[qd.sheet, { backgroundColor: theme.bg }]}>
        <View style={[qd.handle, { backgroundColor: theme.border }]} />
        <View style={[qd.header, { borderBottomColor: theme.border }]}>
          <Text style={[qd.title, { color: theme.text, fontFamily: 'Inter_900Black' }]} numberOfLines={2}>
            {question?.prompt}
          </Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close question chart" onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={theme.text} />
          </View>
        ) : historyError ? (
          <View style={{ padding: 24, gap: 16 }}>
            <Text accessibilityRole="alert" style={{ color: theme.textSecondary, fontSize: 14, fontFamily: 'Inter_500Medium' }}>This question's history could not be loaded. Your answers have not been changed.</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry question history" onPress={() => setRetry(value => value + 1)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: theme.text, fontSize: 14, fontFamily: 'Inter_700Bold' }}>Try again</Text></TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={qd.body}>
            {/* Stats row */}
            <View style={qd.statsRow}>
              <View style={qd.statCell}>
                <Text style={[qd.statVal, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                  {data?.avgScore ?? '—'}
                </Text>
                <Text style={[qd.statLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>AVG SCORE (28D)</Text>
              </View>
              <View style={[qd.statSep, { backgroundColor: theme.border }]} />
              <View style={qd.statCell}>
                <Text style={[qd.statVal, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                  {data?.answeredCount ?? 0}/28
                </Text>
                <Text style={[qd.statLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>DAYS LOGGED</Text>
              </View>
              <View style={[qd.statSep, { backgroundColor: theme.border }]} />
              <View style={qd.statCell}>
                <Text style={[qd.statVal, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                  {question?.weight}×
                </Text>
                <Text style={[qd.statLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>WEIGHT</Text>
              </View>
            </View>

            {/* Calendar / Graph tab toggle */}
            <View style={[qd.tabToggle, { backgroundColor: theme.surface }]}>
              <TouchableOpacity
                style={[qd.tabBtn, tab === 'calendar' && { backgroundColor: theme.card }]}
                onPress={() => setTab('calendar')}
                activeOpacity={0.8}
              >
                <Text style={[qd.tabBtnText, { color: tab === 'calendar' ? theme.text : theme.textSecondary, fontFamily: 'Inter_900Black' }]}>
                  CALENDAR
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[qd.tabBtn, tab === 'graph' && { backgroundColor: theme.card }]}
                onPress={() => setTab('graph')}
                activeOpacity={0.8}
              >
                <Text style={[qd.tabBtnText, { color: tab === 'graph' ? theme.text : theme.textSecondary, fontFamily: 'Inter_900Black' }]}>
                  GRAPH
                </Text>
              </TouchableOpacity>
            </View>

            {tab === 'calendar' ? (
              <View style={{ marginTop: 16 }}>
                <View style={qd.calRow}>
                  {DAY_LABELS_SHORT.map((d, i) => (
                    <Text key={i} style={[qd.calDayHead, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>{d}</Text>
                  ))}
                </View>
                <View style={{ gap: 5, marginTop: 4 }}>
                  {weeks.map((week, wi) => (
                    <View key={wi} style={qd.calRow}>
                      {week.map((dateStr, di) => {
                        const answer = byDate.get(dateStr);
                        const isToday2 = dateStr === today();
                        const isPast = dateStr <= today();
                        const dayNum = parseInt(dateStr.slice(8), 10);
                        const bg = isToday2
                          ? theme.inverse
                          : answer ? scoreColor(answer.score) + '22'
                          : isPast ? theme.surface : 'transparent';
                        const fg = answer ? scoreColor(answer.score) : theme.textMuted;
                        return (
                          <View key={di} style={[qd.calCell, { backgroundColor: bg, opacity: !isPast && !isToday2 ? 0.3 : 1 }]}>
                            {answer && !isToday2 && (
                              <Text style={{ fontSize: 9, color: fg, fontFamily: 'Inter_900Black' }}>{answer.score}</Text>
                            )}
                            {!answer && !isToday2 && (
                              <Text style={{ fontSize: 9, color: theme.textMuted, fontFamily: 'Inter_700Bold' }}>{dayNum}</Text>
                            )}
                            {isToday2 && (
                              <Text style={{ fontSize: 9, color: theme.inverseText, fontFamily: 'Inter_900Black' }}>{dayNum}</Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <TrendGraph answers={data?.answers ?? []} theme={theme} />
            )}

            {/* AI analysis */}
            <View style={{ marginTop: 4 }}>
              <AiAnalysisButton loading={aiLoading} onPress={runAnalysis} theme={theme} />
            </View>
            {aiResult && (
              <View style={{ marginTop: 12 }}>
                <AiAnalysisCard result={aiResult} theme={theme} />
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function TrendGraph({ answers, theme }: {
  answers: Array<{ date: string; score: number }>;
  theme: any;
}) {
  const W = 320, H = 140, PAD = 12;
  if (answers.length < 2) {
    return (
      <View style={{ marginTop: 24, alignItems: 'center', paddingVertical: 24 }}>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Not enough data yet for a trend graph.</Text>
      </View>
    );
  }
  const points = answers.map((a, i) => {
    const x = PAD + (i / (answers.length - 1)) * (W - PAD * 2);
    const y = PAD + (1 - a.score / 100) * (H - PAD * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <View style={{ marginTop: 20, alignItems: 'center' }}>
      <Svg width={W} height={H}>
        <Line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke={theme.border} strokeWidth={1} />
        <Line x1={PAD} y1={PAD} x2={W - PAD} y2={PAD} stroke={theme.border} strokeWidth={1} strokeDasharray="2 3" />
        <Polyline points={points} fill="none" stroke="#34C759" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {answers.map((a, i) => {
          const x = PAD + (i / (answers.length - 1)) * (W - PAD * 2);
          const y = PAD + (1 - a.score / 100) * (H - PAD * 2);
          return <Circle key={i} cx={x} cy={y} r={2.5} fill="#34C759" />;
        })}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: W, marginTop: 4 }}>
        <Text style={{ fontSize: 9, color: theme.textMuted }}>{answers[0].date.slice(5)}</Text>
        <Text style={{ fontSize: 9, color: theme.textMuted }}>{answers[answers.length - 1].date.slice(5)}</Text>
      </View>
    </View>
  );
}

const qd = StyleSheet.create({
  sheet:      { flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12 },
  handle:     { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  header:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  title:      { fontSize: 17, lineHeight: 22, flex: 1 },
  body:       { paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 40 },
  statsRow:   { flexDirection: 'row', alignItems: 'center' },
  statCell:   { flex: 1, alignItems: 'center', gap: 4 },
  statSep:    { width: 1, height: 30 },
  statVal:    { fontSize: 20 },
  statLabel:  { fontSize: 8, letterSpacing: 1 },
  tabToggle:  { flexDirection: 'row', marginTop: 20, padding: 4, borderRadius: 12, gap: 4 },
  tabBtn:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8 },
  tabBtnText: { fontSize: 11, letterSpacing: 1.5 },
  calRow:     { flexDirection: 'row', justifyContent: 'space-between' },
  calDayHead: { flex: 1, textAlign: 'center', fontSize: 9, letterSpacing: 0.5 },
  calCell:    { flex: 1, aspectRatio: 1, marginHorizontal: 2, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
});

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:         { flex: 1 },
  topBar:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12 },
  backBtn:      { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: 20, letterSpacing: -0.5 },
  subtitle:     { fontSize: 12, letterSpacing: 0.5, marginTop: 2 },
  addBtn:       { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:       { paddingHorizontal: 16, paddingBottom: 20, gap: 16 },
  categoryLabel:{ fontSize: 9, letterSpacing: 3, marginBottom: 8 },
  card:         { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  questionRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  checkbox:     { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  questionPrompt:{ fontSize: 14, lineHeight: 20, marginBottom: 8 },
  optionPills:  { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  optionPill:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  optionText:   { fontSize: 11 },
  questionMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  metaBadge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  metaBadgeText:{ fontSize: 9, letterSpacing: 1.5, fontFamily: 'Inter_700Bold' },
  metaWeight:   { fontSize: 11 },
  saveBtn:      { paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText:  { fontSize: 12, letterSpacing: 3 },
});

const cm = StyleSheet.create({
  sheet:        { flex: 1, paddingTop: 8 },
  handle:       { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  title:        { fontSize: 14, letterSpacing: 3 },
  body:         { padding: 20, gap: 10, paddingBottom: 48 },
  label:        { fontSize: 9, letterSpacing: 2.5, marginTop: 6 },
  input:        { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, minHeight: 70, textAlignVertical: 'top' },
  optCountRow:  { flexDirection: 'row', borderRadius: 10, padding: 3, gap: 4, borderWidth: 1 },
  optCountBtn:  { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  optCountText: { fontSize: 13 },
  optRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optBadge:     { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  optBadgeText: { fontSize: 12 },
  optInput:     { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  hint:         { fontSize: 12, lineHeight: 17, opacity: 0.7 },
  weightRow:    { flexDirection: 'row', gap: 8 },
  weightBtn:    { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1 },
  weightText:   { fontSize: 14 },
  saveBtn:      { paddingVertical: 16, alignItems: 'center', borderRadius: 12, marginTop: 8 },
  saveBtnText:  { fontSize: 12, letterSpacing: 3 },
});
