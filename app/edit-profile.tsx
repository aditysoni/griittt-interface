import React, { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DarkBackground } from '../components/DarkBackground';
import { useTheme } from '../components/ThemeContext';
import { useAuth } from '../lib/auth';

type Priority = 'disc' | 'fuel' | 'phys';
type Nudge    = 'morning' | 'midday' | 'evening' | 'before_bed';
type Tone     = 'soft' | 'bal' | 'hard';

const PRIORITY_OPTS: { key: Priority; label: string }[] = [
  { key: 'disc', label: 'Discipline' },
  { key: 'fuel', label: 'Fuel' },
  { key: 'phys', label: 'Physical' },
];
const NUDGE_OPTS: { key: Nudge; label: string }[] = [
  { key: 'morning',    label: 'Morning' },
  { key: 'midday',     label: 'Midday' },
  { key: 'evening',    label: 'Evening' },
  { key: 'before_bed', label: 'Before bed' },
];
const TONE_OPTS: { key: Tone; label: string }[] = [
  { key: 'soft', label: 'Soft' },
  { key: 'bal',  label: 'Balanced' },
  { key: 'hard', label: 'Hard' },
];

// Parses a numeric text field into a number or null (empty → null).
function numOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// NOTE: Field/Segmented are defined at module scope (not inside the screen
// component) so React keeps the same element type across renders — otherwise
// the TextInput would remount on every keystroke and lose focus.
function Field({ label, value, onChange, theme, keyboardType, placeholder }: {
  label: string; value: string; onChange: (s: string) => void; theme: any;
  keyboardType?: 'default' | 'number-pad'; placeholder?: string;
}) {
  return (
    <View style={st.field}>
      <Text style={[st.label, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        style={[st.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType ?? 'default'}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
      />
    </View>
  );
}

function Segmented<T extends string>({ label, opts, value, onSelect, theme }: {
  label: string; opts: { key: T; label: string }[]; value: T | null;
  onSelect: (v: T) => void; theme: any;
}) {
  return (
    <View style={st.field}>
      <Text style={[st.label, { color: theme.textSecondary }]}>{label}</Text>
      <View style={st.segRow}>
        {opts.map(o => {
          const active = value === o.key;
          return (
            <TouchableOpacity
              key={o.key}
              style={[st.seg, {
                borderColor: active ? theme.inverse : theme.border,
                backgroundColor: active ? theme.inverse : 'transparent',
              }]}
              onPress={() => onSelect(o.key)}
              activeOpacity={0.8}
            >
              <Text style={[st.segText, {
                color: active ? theme.inverseText : theme.textSecondary,
                fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium',
              }]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user, updateProfile } = useAuth();

  const [name, setName]       = useState(user?.name ?? '');
  const [age, setAge]         = useState(user?.age != null ? String(user.age) : '');
  const [heightCm, setHeight] = useState(user?.heightCm != null ? String(user.heightCm) : '');
  const [weightKg, setWeight] = useState(user?.weightKg != null ? String(user.weightKg) : '');
  const [priority, setPriority] = useState<Priority | null>(user?.priorityMode ?? null);
  const [nudge, setNudge]       = useState<Nudge | null>(user?.dailyNudgeTime ?? null);
  const [tone, setTone]         = useState<Tone | null>(user?.coachingTone ?? null);
  const [notifs, setNotifs]     = useState<boolean>(user?.notificationsEnabled ?? true);

  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Hold on', 'Your name can’t be empty.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        age: numOrNull(age),
        heightCm: numOrNull(heightCm),
        weightKg: numOrNull(weightKg),
        priorityMode: priority,
        dailyNudgeTime: nudge,
        coachingTone: tone,
        notificationsEnabled: notifs,
      });
      router.back();
    } catch (err: any) {
      Alert.alert('Could not save', err?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const ink  = theme.text;
  const ink2 = theme.textSecondary;

  return (
    <DarkBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={[st.topBar, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color={ink} />
          </TouchableOpacity>
          <Text style={[st.topTitle, { color: ink, fontFamily: 'Inter_900Black' }]}>EDIT PROFILE</Text>
          <View style={{ width: 24 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            <Text style={[st.section, { color: ink2 }]}>ABOUT YOU</Text>
            <Field label="Name" value={name} onChange={setName} theme={theme} placeholder="Your name" />
            <Field label="Age" value={age} onChange={setAge} theme={theme} keyboardType="number-pad" placeholder="—" />
            <Field label="Height (cm)" value={heightCm} onChange={setHeight} theme={theme} keyboardType="number-pad" placeholder="—" />
            <Field label="Weight (kg)" value={weightKg} onChange={setWeight} theme={theme} keyboardType="number-pad" placeholder="—" />

            <Text style={[st.section, { color: ink2, marginTop: 8 }]}>HOW GRITTT COACHES YOU</Text>
            <Segmented label="Main priority" opts={PRIORITY_OPTS} value={priority} onSelect={setPriority} theme={theme} />
            <Segmented label="Daily nudge time" opts={NUDGE_OPTS} value={nudge} onSelect={setNudge} theme={theme} />
            <Segmented label="Coaching tone" opts={TONE_OPTS} value={tone} onSelect={setTone} theme={theme} />

            <View style={[st.switchRow, { borderColor: theme.border }]}>
              <Text style={[st.label, { color: ink, marginBottom: 0 }]}>Notifications</Text>
              <View style={{ flex: 1 }} />
              <Switch value={notifs} onValueChange={setNotifs} />
            </View>

            <TouchableOpacity
              style={[st.saveBtn, { backgroundColor: theme.inverse, opacity: saving ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={[st.saveText, { color: theme.inverseText, fontFamily: 'Inter_900Black' }]}>
                {saving ? 'SAVING…' : 'SAVE CHANGES'}
              </Text>
            </TouchableOpacity>

            <Text style={[st.emailNote, { color: theme.textMuted }]}>
              Signed in as {user?.email}
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </DarkBackground>
  );
}

const st = StyleSheet.create({
  topBar:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 14, letterSpacing: 2 },
  body:     { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48, gap: 14 },
  section:  { fontSize: 11, letterSpacing: 2, fontFamily: 'Inter_700Bold', marginTop: 4 },
  field:    { gap: 6 },
  label:    { fontSize: 12, letterSpacing: 0.5, fontFamily: 'Inter_500Medium', marginBottom: 2 },
  input:    { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: 'Inter_500Medium' },
  segRow:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  seg:      { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  segText:  { fontSize: 13 },
  switchRow:{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 4 },
  saveBtn:  { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 18 },
  saveText: { fontSize: 14, letterSpacing: 1.5 },
  emailNote:{ fontSize: 12, textAlign: 'center', fontFamily: 'Inter_500Medium', marginTop: 14 },
});
