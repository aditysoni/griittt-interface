import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { fuelQuestions, FuelQuestion } from '../lib/api';
import { useTheme } from '../components/ThemeContext';
import { DarkBackground } from '../components/DarkBackground';

export default function FuelQuestionsScreen() {
  const { token } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [catalog, setCatalog]       = useState<FuelQuestion[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [customOpen, setCustomOpen] = useState(false);

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

  const categories = ['All', ...Array.from(new Set(catalog.map(q => q.category)))];
  const filtered = activeCategory === 'All'
    ? catalog
    : catalog.filter(q => q.category === activeCategory);

  const grouped: Record<string, FuelQuestion[]> = {};
  for (const q of filtered) {
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

        {/* Category pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[s.pill, { backgroundColor: activeCategory === cat ? theme.inverse : theme.surface, borderColor: theme.border }]}
              onPress={() => setActiveCategory(cat)}
              activeOpacity={0.7}
            >
              <Text style={[s.pillText, { color: activeCategory === cat ? theme.inverseText : theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

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

          {filtered.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Text style={[{ color: theme.textSecondary, fontSize: 14 }]}>No questions in this category</Text>
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
      </SafeAreaView>
    </DarkBackground>
  );
}

// ── Add custom question modal ──────────────────────────────────────────────────

function AddCustomModal({ open, token, theme, onClose, onSaved }: {
  open: boolean; token: string; theme: any;
  onClose: () => void; onSaved: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [weight, setWeight] = useState('1');
  const [saving, setSaving] = useState(false);
  const [optionCount, setOptionCount] = useState<2 | 5>(2);

  function reset() {
    setPrompt(''); setOptions(['', '']); setWeight('1'); setOptionCount(2);
  }

  function switchOptionCount(n: 2 | 5) {
    setOptionCount(n);
    setOptions(n === 2 ? ['', ''] : ['', '', '', '', '']);
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
            {([2, 5] as const).map(n => (
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

          <Text style={[cm.label, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>WEIGHT</Text>
          <View style={cm.weightRow}>
            {['1', '2', '3'].map(w => (
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
            Higher weight = more impact on your daily fuel score.
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

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:         { flex: 1 },
  topBar:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12 },
  backBtn:      { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: 20, letterSpacing: -0.5 },
  subtitle:     { fontSize: 12, letterSpacing: 0.5, marginTop: 2 },
  addBtn:       { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pillRow:      { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  pill:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  pillText:     { fontSize: 12, letterSpacing: 0.5 },
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
