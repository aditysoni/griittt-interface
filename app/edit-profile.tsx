import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DarkBackground } from '../components/DarkBackground';
import { useTheme } from '../components/ThemeContext';
import { useAuth } from '../lib/auth';
import { users } from '../lib/api';

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

// ── Shared building blocks ──────────────────────────────────────────────────

// NOTE: Card/Field/Segmented are defined at module scope (not inside the screen
// component) so React keeps the same element type across renders — otherwise
// the TextInput would remount on every keystroke and lose focus.
function SectionHeader({ icon, label, theme, tint }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; theme: any; tint?: string;
}) {
  return (
    <View style={st.sectionHeader}>
      <Ionicons name={icon} size={13} color={tint ?? theme.textSecondary} />
      <Text style={[st.section, { color: tint ?? theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

function Card({ children, theme, borderColor }: { children: React.ReactNode; theme: any; borderColor?: string }) {
  return (
    <View style={[st.card, { backgroundColor: theme.card, borderColor: borderColor ?? theme.border }]}>
      {children}
    </View>
  );
}

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
  const { user, token, updateProfile, logout } = useAuth();

  const [name, setName]       = useState(user?.name ?? '');
  const [age, setAge]         = useState(user?.age != null ? String(user.age) : '');
  const [heightCm, setHeight] = useState(user?.heightCm != null ? String(user.heightCm) : '');
  const [weightKg, setWeight] = useState(user?.weightKg != null ? String(user.weightKg) : '');
  const [priority, setPriority] = useState<Priority | null>(user?.priorityMode ?? null);
  const [nudge, setNudge]       = useState<Nudge | null>(user?.dailyNudgeTime ?? null);
  const [tone, setTone]         = useState<Tone | null>(user?.coachingTone ?? null);
  const [notifs, setNotifs]     = useState<boolean>(user?.notificationsEnabled ?? true);

  const [saving, setSaving] = useState(false);
  const [deletingData, setDeletingData]       = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

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

  function confirmDeleteData() {
    Alert.alert(
      'Delete all data?',
      'Every habit, fuel log, strength session, and streak will be permanently erased. Your account and login stay intact. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Data', style: 'destructive', onPress: handleDeleteData },
      ]
    );
  }

  async function handleDeleteData() {
    if (!token) return;
    setDeletingData(true);
    try {
      await users.deleteData(token);
      Alert.alert('Done', 'All your tracked data has been erased.');
      router.back();
    } catch (err: any) {
      Alert.alert('Could not delete data', err?.message || 'Please try again.');
    } finally {
      setDeletingData(false);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account, login, and every piece of data tied to it. There is no way to recover it afterward.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Account', style: 'destructive', onPress: handleDeleteAccount },
      ]
    );
  }

  async function handleDeleteAccount() {
    if (!token) return;
    setDeletingAccount(true);
    try {
      await users.deleteAccount(token);
      await logout();
    } catch (err: any) {
      setDeletingAccount(false);
      Alert.alert('Could not delete account', err?.message || 'Please try again.');
    }
  }

  const ink  = theme.text;
  const ink2 = theme.textSecondary;
  const busy = deletingData || deletingAccount;

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

            <SectionHeader icon="person-outline" label="ABOUT YOU" theme={theme} />
            <Card theme={theme}>
              <Field label="Name" value={name} onChange={setName} theme={theme} placeholder="Your name" />
              <View style={st.rowFields}>
                <View style={{ flex: 1 }}>
                  <Field label="Age" value={age} onChange={setAge} theme={theme} keyboardType="number-pad" placeholder="—" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Height (cm)" value={heightCm} onChange={setHeight} theme={theme} keyboardType="number-pad" placeholder="—" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Weight (kg)" value={weightKg} onChange={setWeight} theme={theme} keyboardType="number-pad" placeholder="—" />
                </View>
              </View>
            </Card>

            <SectionHeader icon="sparkles-outline" label="HOW GRITTT COACHES YOU" theme={theme} />
            <Card theme={theme}>
              <Segmented label="Main priority" opts={PRIORITY_OPTS} value={priority} onSelect={setPriority} theme={theme} />
              <Segmented label="Daily nudge time" opts={NUDGE_OPTS} value={nudge} onSelect={setNudge} theme={theme} />
              <Segmented label="Coaching tone" opts={TONE_OPTS} value={tone} onSelect={setTone} theme={theme} />

              <View style={[st.switchRow, { borderColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[st.label, { color: ink, marginBottom: 2 }]}>Notifications</Text>
                  <Text style={[st.switchSub, { color: theme.textMuted }]}>Daily nudges &amp; reminders</Text>
                </View>
                <Switch value={notifs} onValueChange={setNotifs} />
              </View>
            </Card>

            <TouchableOpacity
              style={[st.saveBtn, { backgroundColor: theme.inverse, opacity: saving ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator size="small" color={theme.inverseText} />
                : <Text style={[st.saveText, { color: theme.inverseText, fontFamily: 'Inter_900Black' }]}>SAVE CHANGES</Text>}
            </TouchableOpacity>

            <Text style={[st.emailNote, { color: theme.textMuted }]}>
              Signed in as {user?.email}
            </Text>

            {/* ── Danger zone ── */}
            <SectionHeader icon="warning-outline" label="DANGER ZONE" theme={theme} tint={theme.danger} />
            <Card theme={theme} borderColor={theme.danger + '40'}>
              <View style={st.dangerRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[st.dangerTitle, { color: ink, fontFamily: 'Inter_700Bold' }]}>Delete my data</Text>
                  <Text style={[st.dangerSub, { color: theme.textMuted }]}>
                    Erase every habit, fuel log, and strength session. Keeps your account and login.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[st.dangerBtn, st.dangerBtnGhost, { borderColor: theme.warning, opacity: busy ? 0.5 : 1 }]}
                  onPress={confirmDeleteData}
                  disabled={busy}
                  activeOpacity={0.8}
                >
                  {deletingData
                    ? <ActivityIndicator size="small" color={theme.warning} />
                    : <Text style={[st.dangerBtnText, { color: theme.warning, fontFamily: 'Inter_800ExtraBold' }]}>DELETE DATA</Text>}
                </TouchableOpacity>
              </View>

              <View style={[st.dangerDivider, { backgroundColor: theme.border }]} />

              <View style={st.dangerRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[st.dangerTitle, { color: ink, fontFamily: 'Inter_700Bold' }]}>Delete account</Text>
                  <Text style={[st.dangerSub, { color: theme.textMuted }]}>
                    Permanently deletes your login and everything tied to it. Cannot be undone.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[st.dangerBtn, { backgroundColor: theme.danger, opacity: busy ? 0.5 : 1 }]}
                  onPress={confirmDeleteAccount}
                  disabled={busy}
                  activeOpacity={0.85}
                >
                  {deletingAccount
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : <Text style={[st.dangerBtnText, { color: '#FFFFFF', fontFamily: 'Inter_800ExtraBold' }]}>DELETE ACCOUNT</Text>}
                </TouchableOpacity>
              </View>

              <View style={[st.dangerDivider, { backgroundColor: theme.border }]} />

              <TouchableOpacity
                style={st.privacyRow}
                onPress={() => router.push('/privacy-policy' as any)}
                activeOpacity={0.7}
              >
                <Ionicons name="document-text-outline" size={16} color={theme.textSecondary} />
                <Text style={[st.privacyText, { color: theme.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                  Privacy Policy
                </Text>
                <View style={{ flex: 1 }} />
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </TouchableOpacity>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </DarkBackground>
  );
}

const st = StyleSheet.create({
  topBar:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 14, letterSpacing: 2 },
  body:     { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 56, gap: 12 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  section:  { fontSize: 11, letterSpacing: 2, fontFamily: 'Inter_700Bold' },

  card:     { borderWidth: 1, borderRadius: 18, padding: 16, gap: 14, marginBottom: 6 },

  rowFields:{ flexDirection: 'row', gap: 10 },
  field:    { gap: 6 },
  label:    { fontSize: 12, letterSpacing: 0.5, fontFamily: 'Inter_500Medium', marginBottom: 2 },
  input:    { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_500Medium' },
  segRow:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  seg:      { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  segText:  { fontSize: 13 },

  switchRow:{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingTop: 14, marginTop: 2 },
  switchSub:{ fontSize: 11, fontFamily: 'Inter_500Medium' },

  saveBtn:  { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 10 },
  saveText: { fontSize: 14, letterSpacing: 1.5 },
  emailNote:{ fontSize: 12, textAlign: 'center', fontFamily: 'Inter_500Medium', marginTop: 4, marginBottom: 12 },

  dangerRow:     { flexDirection: 'row', alignItems: 'center' },
  dangerTitle:   { fontSize: 14, marginBottom: 3 },
  dangerSub:     { fontSize: 11.5, lineHeight: 16, fontFamily: 'Inter_500Medium' },
  dangerBtn:     { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', minWidth: 112 },
  dangerBtnGhost:{ backgroundColor: 'transparent', borderWidth: 1.5 },
  dangerBtnText: { fontSize: 10, letterSpacing: 1 },
  dangerDivider: { height: 1, marginVertical: 4 },
  privacyRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  privacyText:   { fontSize: 13 },
});
