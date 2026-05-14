import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { DarkBackground } from '../../components/DarkBackground';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import { challenges, Challenge, tasks } from '../../lib/api';
import { LoadingScreen } from '../../components/LoadingScreen';
import { useTheme, AppTheme } from '../../components/ThemeContext';

// ── Theme rows ────────────────────────────────────────────────────────────────
// Each row aggregates several legacy domain keys so existing challenge data
// still slots in correctly while the UI exposes only 4 clean themes.

type ThemeKey = 'physical' | 'health' | 'career' | 'lifestyle';

const THEME_ROWS: {
  key: ThemeKey;
  label: string;
  dot: string;
  matches: string[]; // domain keys that belong in this row
}[] = [
  {
    key: 'physical',
    label: 'PHYSICAL ACTIVITY',
    dot: '#34C759',
    matches: ['physical', 'fitness', 'strength', 'exercise', 'sports'],
  },
  {
    key: 'health',
    label: 'HEALTH',
    dot: '#F59E0B',
    matches: ['health', 'food', 'nutrition', 'sleep', 'mental'],
  },
  {
    key: 'career',
    label: 'CAREER',
    dot: '#06B6D4',
    matches: ['career', 'productivity', 'learning', 'work', 'finance'],
  },
  {
    key: 'lifestyle',
    label: 'LIFESTYLE',
    dot: '#8B5CF6',
    matches: ['lifestyle', 'discipline', 'control', 'social', 'creativity'],
  },
];

function themeForDomain(domain: string): typeof THEME_ROWS[number] {
  return THEME_ROWS.find(t => t.matches.includes(domain)) ?? THEME_ROWS[3];
}

const DURATION_OPTIONS = [7, 14, 21, 30, 60, 90];

const SCREEN_W = Dimensions.get('window').width;
const CARD_W        = Math.min(280, SCREEN_W - 60);   // explore — horizontal cards (a touch wider for benefits)
const ACTIVE_CARD_W = Math.min(340, SCREEN_W - 48);   // active — horizontal hero cards

// ── Progress analysis ─────────────────────────────────────────────────────────
// Derived from daysDone vs days elapsed since startedAt — no extra API needed.

type Trend = { label: string; color: string; icon: 'trending-up' | 'remove' | 'trending-down' };

function daysSince(startedAt: string | null): number {
  if (!startedAt) return 0;
  const start = new Date(startedAt);
  const now   = new Date();
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000) + 1);
}

function trendFor(c: Challenge): Trend {
  const elapsed = daysSince(c.startedAt);
  if (elapsed < 2) return { label: 'JUST STARTED', color: '#06B6D4', icon: 'remove' };
  const delta = c.daysDone - elapsed;
  if (delta >= 2)  return { label: 'GETTING BETTER',  color: '#34C759', icon: 'trending-up' };
  if (delta >= 0)  return { label: 'ON TRACK',        color: '#F59E0B', icon: 'remove' };
  if (delta <= -3) return { label: 'FALLING BEHIND',  color: '#EF4444', icon: 'trending-down' };
  return            { label: 'SLIPPING',           color: '#F59E0B', icon: 'trending-down' };
}

// Maps actual-vs-expected pace into a comparative percentile.
function percentileFor(c: Challenge): number {
  const elapsed = Math.max(daysSince(c.startedAt), 1);
  const ratio   = c.daysDone / elapsed;
  if (ratio >= 1.0)  return 90;
  if (ratio >= 0.85) return 75;
  if (ratio >= 0.7)  return 60;
  if (ratio >= 0.5)  return 40;
  if (ratio >= 0.3)  return 25;
  return 10;
}

// ── Benefits & instructions lookup ────────────────────────────────────────────
// Keyed by lowercased title. Falls back to generic per-theme benefits.

type ChallengeDetail = {
  benefits: string[];
  instructions: string;
};

const TITLE_DETAILS: Record<string, ChallengeDetail> = {
  'cold water bath': {
    benefits: ['Blood flow', 'High testosterone', 'Stress release', 'Calmness & freshness'],
    instructions: 'Stand under cold water for at least 60 seconds every morning. Breathe slow through the nose.',
  },
  'cold shower': {
    benefits: ['Blood flow', 'High testosterone', 'Stress release', 'Calmness & freshness'],
    instructions: 'Finish each shower with 60s of cold. Breathe slow through the nose.',
  },
  'no phone in bed': {
    benefits: ['Better sleep', 'Sharper focus', 'Less anxiety', 'More presence'],
    instructions: 'Plug your phone outside the bedroom. Read or stretch before sleep instead.',
  },
  'morning run': {
    benefits: ['Cardio fitness', 'Mental clarity', 'Energy boost', 'Discipline reps'],
    instructions: 'Run 20–30 min within an hour of waking, 5 days a week. Pace conversational.',
  },
  'no sugar': {
    benefits: ['Lean body', 'Stable energy', 'Better mood', 'Sharper mind'],
    instructions: 'Cut added sugar from drinks, snacks, and sauces. Fruits are fine.',
  },
  'meditation': {
    benefits: ['Lower anxiety', 'Better focus', 'Emotional control', 'Self-awareness'],
    instructions: 'Sit quietly for 10 minutes, breath at the nostrils as anchor.',
  },
  'read daily': {
    benefits: ['Vocabulary', 'Empathy', 'Focus stamina', 'Compounding knowledge'],
    instructions: 'Read 10 pages every day, any genre. Phone elsewhere.',
  },
  'no alcohol': {
    benefits: ['Better sleep', 'Lean body', 'Mental clarity', 'Stronger willpower'],
    instructions: 'Zero alcohol. Mocktails or sparkling water at social events.',
  },
  'gym daily': {
    benefits: ['Muscle gain', 'Strength', 'Bone density', 'Confidence'],
    instructions: '45–60 min of resistance training. Track lifts and progress weekly.',
  },
  'wake at 5am': {
    benefits: ['Time control', 'Discipline reps', 'Deep work', 'Quiet hours'],
    instructions: 'Alarm at 5:00. Phone across the room. Out of bed within 2 minutes.',
  },
};

const THEME_BENEFITS: Record<ThemeKey, string[]> = {
  physical:  ['Cardio fitness', 'Strength', 'Energy boost', 'Lean body'],
  health:    ['Better sleep', 'Stable energy', 'Sharper mind', 'Stronger immunity'],
  career:    ['Sharper focus', 'Skill compounding', 'Higher output', 'Clear thinking'],
  lifestyle: ['Discipline reps', 'Better routines', 'More presence', 'Calmer mind'],
};

function detailFor(c: Challenge): ChallengeDetail {
  const key = c.title.trim().toLowerCase();
  if (TITLE_DETAILS[key]) return TITLE_DETAILS[key];
  const t = themeForDomain(c.domain);
  return {
    benefits: THEME_BENEFITS[t.key],
    instructions: c.description?.trim() || `Complete this every day for ${c.durationDays} days. Mark it done on your habits page.`,
  };
}

// Stable hash of a string → unsigned int.
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Stable synthetic participant count from the challenge id — keeps the number
// the same across reloads. Replace with a real API field when available.
function participantsFor(c: Challenge): number {
  return 80 + (hashStr(c.id) % 1820); // 80–1900 range
}

// Buckets of "how many users dropped off at this day range" — stable per
// challenge. Total roughly equals participantsFor(c). Replace with real
// distribution data when the backend exposes it.
export type HistBucket = { label: string; range: [number, number]; users: number };

function durationHistogramFor(c: Challenge): HistBucket[] {
  const total      = participantsFor(c);
  const d          = c.durationDays;
  // Adaptive buckets so 7-day challenges and 90-day challenges both look right.
  const stops      = bucketStops(d);
  const seed       = hashStr(c.id + 'hist');

  // Build raw weights via a deterministic random walk seeded by id.
  // Bell-ish shape skewed left (more early dropoff, fewer go all the way).
  const rawWeights = stops.map((_, i) => {
    const center = stops.length * 0.45; // peak around 40-50% in
    const dist   = Math.abs(i - center);
    const bias   = Math.max(0, 1.4 - dist * 0.45);
    const jitter = ((seed >> (i * 3)) & 0xff) / 255; // 0..1
    return bias + jitter * 0.6;
  });
  const sum = rawWeights.reduce((a, b) => a + b, 0);
  const counts = rawWeights.map(w => Math.max(1, Math.round((w / sum) * total)));

  return stops.map((range, i) => ({
    label: range[0] === range[1] ? `Day ${range[0]}` : `${range[0]}-${range[1]}d`,
    range,
    users: counts[i],
  }));
}

// Classifies a challenge as a build (do this) or control (don't do this) habit.
// Used when mirroring a joined challenge into the user's habit list.
function inferHabitCategory(c: Challenge): 'build' | 'control' {
  if (c.domain === 'control') return 'control';
  const t = c.title.toLowerCase().trim();
  if (t.startsWith('no ') || t.startsWith("don't ") || t.startsWith('avoid ') || t.startsWith('quit ')) {
    return 'control';
  }
  return 'build';
}

function bucketStops(durationDays: number): [number, number][] {
  if (durationDays <= 7)  return [[1,1],[2,2],[3,3],[4,4],[5,5],[6,6],[7,7]];
  if (durationDays <= 14) return [[1,2],[3,4],[5,7],[8,10],[11,14]];
  if (durationDays <= 21) return [[1,3],[4,7],[8,10],[11,14],[15,18],[19,21]];
  if (durationDays <= 30) return [[1,3],[4,7],[8,14],[15,21],[22,28],[29,30]];
  if (durationDays <= 60) return [[1,7],[8,14],[15,21],[22,30],[31,45],[46,60]];
  return                    [[1,7],[8,14],[15,30],[31,45],[46,60],[61,75],[76, durationDays]];
}

export default function ChallengesScreen() {
  const { token } = useAuth();
  const { theme } = useTheme();
  const router    = useRouter();

  const [list, setList]             = useState<Challenge[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Detail modal
  const [detail, setDetail]         = useState<Challenge | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [formTitle, setFormTitle]   = useState('');
  const [formDesc, setFormDesc]     = useState('');
  const [formTheme, setFormTheme]   = useState<ThemeKey>('physical');
  const [formDays, setFormDays]     = useState(30);
  const [creating, setCreating]     = useState(false);

  async function load() {
    if (!token) return;
    try { setList(await challenges.list(token)); } catch {}
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, [token]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [token]);

  async function handleJoin(c: Challenge) {
    if (!token) return;
    setList(l => l.map(x => x.id === c.id ? { ...x, joined: true, status: 'active', daysDone: 0 } : x));
    try {
      await challenges.join(token, c.id);
    } catch (err: any) {
      setList(l => l.map(x => x.id === c.id ? { ...x, joined: false, status: null } : x));
      Alert.alert('Error', err.message);
      return;
    }

    // Mirror the challenge into the user's habit list so it shows up in
    // Discipline → Build (or Control). The challenge itself is already
    // joined at this point — any habit-creation failure is purely cosmetic
    // (no mirror in the habit list), so we never roll back the join.
    const category = inferHabitCategory(c);
    try {
      await tasks.create(token, {
        name: c.title.trim(),
        category,
        score: 5,
        trackCount: category === 'control',
        countUnit: null,
      });
    } catch (err: any) {
      const msg = String(err?.message ?? '').toLowerCase();
      const isDup   = msg.includes('exist') || msg.includes('duplicate') || msg.includes('unique');
      const isLimit = msg.includes('limit');
      if (isDup) {
        // Same-name habit already exists — it'll just inherit the yellow border. No-op.
      } else if (isLimit) {
        Alert.alert(
          'Challenge started',
          "You've hit your 80-habit limit, so this challenge won't show up in your Discipline list. " +
          'Archive an unused habit to make room, then re-join.'
        );
      } else {
        Alert.alert('Habit not added', err?.message ?? 'Could not add this challenge as a habit.');
      }
    }
  }

  async function handleAbandon(c: Challenge) {
    Alert.alert('ABANDON', `Stop "${c.title.toUpperCase()}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Abandon', style: 'destructive', onPress: async () => {
          setList(l => l.map(x => x.id === c.id ? { ...x, joined: false, status: 'abandoned' } : x));
          try { await challenges.abandon(token!, c.id); } catch {}
        },
      },
    ]);
  }

  async function handleCreate() {
    if (!token || !formTitle.trim()) return;
    setCreating(true);
    try {
      const created = await challenges.create(token, {
        title: formTitle.trim(),
        description: formDesc.trim() || undefined,
        domain: formTheme, // store the theme key as the domain
        durationDays: formDays,
      });
      setList(l => [created, ...l]);
      setShowCreate(false);
      setFormTitle(''); setFormDesc(''); setFormTheme('physical'); setFormDays(30);
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setCreating(false); }
  }

  const active    = list.filter(c => c.status === 'active');
  const available = list.filter(c => !c.joined || c.status === 'abandoned');

  if (loading) return <LoadingScreen />;

  return (
    <DarkBackground><SafeAreaView style={s.safe} edges={['top']}>
      {/* Top bar — matches the rest of the app */}
      <View style={s.topBar}>
        <Text style={[s.modeLabel, { color: theme.text, fontFamily: 'Inter_900Black' }]}>GRIND MODE</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[s.topIcon, { borderColor: theme.text }]}
          onPress={() => setShowCreate(true)}
        >
          <Ionicons name="add" size={15} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.topIcon, { borderColor: theme.border }]}
          onPress={() => router.push('/(tabs)/ai')}
        >
          <Ionicons name="sparkles" size={15} color="#34C759" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.topIcon, { borderColor: theme.border }]}
          onPress={() => router.push('/(tabs)/profile')}
        >
          <Ionicons name="settings-outline" size={15} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />}
      >
        {/* Active — horizontal row, thicker borders mark these out */}
        {active.length > 0 && (
          <View style={tr.section}>
            <View style={tr.header}>
              <View style={tr.headerLeft}>
                <View style={[tr.accentDot, { backgroundColor: '#34C759' }]} />
                <Text style={[tr.label, { color: theme.text, fontFamily: 'Inter_900Black' }]}>ACTIVE</Text>
              </View>
              <Text style={[tr.count, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_500Medium' }]}>
                {String(active.length).padStart(2, '0')}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={tr.row}
              decelerationRate="fast"
              snapToInterval={ACTIVE_CARD_W + 12}
            >
              {active.map(c => (
                <ActiveCard
                  key={c.id}
                  challenge={c}
                  theme={theme}
                  width={ACTIVE_CARD_W}
                  onPress={() => setDetail(c)}
                  onAbandon={() => handleAbandon(c)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Explore — themed horizontal rows */}
        {THEME_ROWS.map(row => {
          const items = available.filter(c => row.matches.includes(c.domain));
          if (items.length === 0) return null;
          return (
            <ThemeRow
              key={row.key}
              label={row.label}
              count={items.length}
              accent={row.dot}
              challenges={items}
              theme={theme}
              onPressCard={c => setDetail(c)}
            />
          );
        })}

        {available.length === 0 && active.length === 0 && (
          <View style={s.empty}>
            <Text style={[s.emptyTitle, { color: theme.textSecondary, fontFamily: 'Inter_900Black' }]}>
              NO CHALLENGES
            </Text>
            <Text style={[s.emptySub, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Tap + to create your first one
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={[s.footer, { borderTopColor: theme.border }]}>
          <Text style={[s.footerQuote, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            "A challenge is just a habit you haven't committed to yet."
          </Text>
          <View style={s.footerRule}>
            <View style={[s.footerLine, { backgroundColor: theme.text }]} />
            <Text style={[s.footerLabel, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>GRITTT MANUAL</Text>
            <View style={[s.footerLine, { backgroundColor: theme.text }]} />
          </View>
        </View>
      </ScrollView>

      {/* Detail modal */}
      <ChallengeDetailModal
        challenge={detail}
        theme={theme}
        onClose={() => setDetail(null)}
        onJoin={c => { handleJoin(c); setDetail(null); }}
        onAbandon={c => { handleAbandon(c); setDetail(null); }}
      />

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={[s.modal, { backgroundColor: theme.bg }]}>
          <View style={[s.modalHandle, { backgroundColor: theme.border }]} />
          <View style={[s.modalHeader, { borderBottomColor: theme.border }]}>
            <Text style={[s.modalTitle, { color: theme.text, fontFamily: 'Inter_900Black' }]}>NEW CHALLENGE</Text>
            <TouchableOpacity onPress={() => { setShowCreate(false); setFormTitle(''); }}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
            <FieldLabel label="TITLE" theme={theme} />
            <TextInput
              style={[s.input, { color: theme.text, borderColor: theme.border, fontFamily: 'Inter_700Bold' }]}
              value={formTitle}
              onChangeText={setFormTitle}
              placeholder="E.G. NO PHONE IN BED"
              placeholderTextColor={theme.textSecondary}
              autoFocus
              autoCapitalize="characters"
            />

            <FieldLabel label="DESCRIPTION" optional theme={theme} />
            <TextInput
              style={[s.input, s.inputMulti, { color: theme.text, borderColor: theme.border, fontFamily: 'Inter_500Medium' }]}
              value={formDesc}
              onChangeText={setFormDesc}
              placeholder="What does winning look like?"
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
            />

            <FieldLabel label="THEME" theme={theme} />
            <View style={s.domainGrid}>
              {THEME_ROWS.map(row => {
                const active = formTheme === row.key;
                return (
                  <TouchableOpacity
                    key={row.key}
                    style={[
                      s.domainChip,
                      { borderColor: active ? row.dot : theme.border },
                      active && { backgroundColor: row.dot + '15' },
                    ]}
                    onPress={() => setFormTheme(row.key)}
                  >
                    <View style={[s.domainDot, { backgroundColor: row.dot }]} />
                    <Text style={[
                      s.domainLabel,
                      { fontFamily: 'Inter_700Bold' },
                      active ? { color: row.dot } : { color: theme.textSecondary },
                    ]}>
                      {row.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <FieldLabel label="DURATION" theme={theme} />
            <View style={s.durationRow}>
              {DURATION_OPTIONS.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[
                    s.durationChip,
                    { borderColor: formDays === d ? theme.text : theme.border },
                    formDays === d && { backgroundColor: theme.text },
                  ]}
                  onPress={() => setFormDays(d)}
                >
                  <Text style={[
                    s.durationText,
                    { fontFamily: 'SpaceGrotesk_700Bold' },
                    formDays === d ? { color: theme.bg } : { color: theme.textSecondary },
                  ]}>
                    {d}D
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[
                s.submitBtn,
                { backgroundColor: theme.tabActiveBg, opacity: (!formTitle.trim() || creating) ? 0.4 : 1 },
              ]}
              onPress={handleCreate}
              disabled={!formTitle.trim() || creating}
            >
              <Text style={[s.submitBtnText, { color: theme.tabActiveText, fontFamily: 'Inter_900Black' }]}>
                {creating ? 'CREATING...' : 'LAUNCH CHALLENGE'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
    </DarkBackground>
  );
}

// ── Horizontal theme row ──────────────────────────────────────────────────────

function ThemeRow({
  label, count, accent, challenges: items, theme, onPressCard,
}: {
  label: string;
  count: number;
  accent?: string;
  challenges: Challenge[];
  theme: AppTheme;
  onPressCard: (c: Challenge) => void;
}) {
  return (
    <View style={tr.section}>
      <View style={tr.header}>
        <View style={tr.headerLeft}>
          {!!accent && <View style={[tr.accentDot, { backgroundColor: accent }]} />}
          <Text style={[tr.label, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{label}</Text>
        </View>
        <Text style={[tr.count, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_500Medium' }]}>
          {String(count).padStart(2, '0')}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={tr.row}
        decelerationRate="fast"
        snapToInterval={CARD_W + 12}
      >
        {items.map(c => (
          <ChallengeCard key={c.id} challenge={c} theme={theme} onPress={() => onPressCard(c)} />
        ))}
      </ScrollView>
    </View>
  );
}

const tr = StyleSheet.create({
  section:    { marginBottom: 8 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 18, paddingBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accentDot:  { width: 6, height: 6, borderRadius: 3 },
  label:      { fontSize: 11, letterSpacing: 2 },
  count:      { fontSize: 10, letterSpacing: 1 },
  row:        { paddingHorizontal: 16, gap: 12 },
});

// ── Challenge card (horizontal) ───────────────────────────────────────────────

function ChallengeCard({ challenge: c, theme, onPress }: { challenge: Challenge; theme: any; onPress: () => void }) {
  const t        = themeForDomain(c.domain);
  const detail   = detailFor(c);
  const benefits = detail.benefits.slice(0, 4);

  return (
    <TouchableOpacity
      style={[cc.card, { width: CARD_W, backgroundColor: theme.card, borderColor: theme.text }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Top: accent dot + duration */}
      <View style={cc.top}>
        <View style={[cc.dot, { backgroundColor: t.dot }]} />
        <Text style={[cc.themeLabel, { color: t.dot, fontFamily: 'Inter_900Black' }]}>
          {t.label}
        </Text>
        <View style={{ flex: 1 }} />
        <View style={[cc.durationBadge, { borderColor: theme.text }]}>
          <Text style={[cc.durationText, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>
            {c.durationDays}D
          </Text>
        </View>
      </View>

      {/* Title */}
      <Text style={[cc.title, { color: theme.text, fontFamily: 'Inter_900Black' }]} numberOfLines={2}>
        {c.title.toUpperCase()}
      </Text>

      {/* Benefits — what the user gets */}
      <View style={cc.benefits}>
        {benefits.map((b, i) => (
          <View key={i} style={cc.benefitRow}>
            <View style={[cc.benefitMarker, { backgroundColor: t.dot, borderColor: theme.text }]} />
            <Text style={[cc.benefitText, { color: theme.text, fontFamily: 'Inter_700Bold' }]} numberOfLines={1}>
              {b}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      {/* Footer: tap hint */}
      <View style={[cc.detailHint, { borderTopColor: theme.text }]}>
        <Text style={[cc.detailHintText, { color: theme.text, fontFamily: 'Inter_900Black' }]}>
          TAP FOR DETAILS
        </Text>
        <Ionicons name="chevron-forward" size={13} color={theme.text} />
      </View>

      {!c.isPreset && (
        <View style={[cc.customBadge, { backgroundColor: t.dot }]}>
          <Text style={[cc.customText, { color: theme.inverseText, fontFamily: 'Inter_900Black' }]}>CUSTOM</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function ActiveCard({ challenge: c, theme, width, onPress, onAbandon }: {
  challenge: Challenge; theme: any; width?: number; onPress?: () => void; onAbandon: () => void;
}) {
  const t          = themeForDomain(c.domain);
  const pct        = Math.min(c.daysDone / c.durationDays, 1);
  const pctLabel   = Math.round(pct * 100);
  const daysLeft   = Math.max(c.durationDays - c.daysDone, 0);
  const isComplete = daysLeft === 0;
  const trend      = trendFor(c);
  const percentile = percentileFor(c);

  return (
    <TouchableOpacity
      style={[ac.card, {
        width: width ?? ACTIVE_CARD_W,
        backgroundColor: theme.card,
        borderColor: t.dot,
      }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Accent stripe down the left */}
      <View style={[ac.accent, { backgroundColor: t.dot }]} />

      {/* Header row */}
      <View style={ac.header}>
        <View style={[ac.themePill, { backgroundColor: t.dot + '20' }]}>
          <View style={[ac.themeDot, { backgroundColor: t.dot }]} />
          <Text style={[ac.themeLabel, { color: t.dot, fontFamily: 'Inter_900Black' }]}>{t.label}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={onAbandon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Title */}
      <Text style={[ac.title, { color: theme.text, fontFamily: 'Inter_900Black' }]} numberOfLines={2}>
        {c.title.toUpperCase()}
      </Text>

      {/* Stat grid: days done + days left */}
      <View style={ac.statRow}>
        <View style={ac.statCell}>
          <Text style={[ac.statBig, { color: theme.text, fontFamily: 'Inter_900Black' }]}>
            {c.daysDone}
            <Text style={[ac.statBigMax, { color: theme.textMuted, fontFamily: 'Inter_500Medium' }]}>
              /{c.durationDays}
            </Text>
          </Text>
          <Text style={[ac.statLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>
            DAYS DONE
          </Text>
        </View>
        <View style={[ac.statSep, { backgroundColor: theme.border }]} />
        <View style={ac.statCell}>
          <Text style={[ac.statBig, { color: isComplete ? '#34C759' : theme.text, fontFamily: 'Inter_900Black' }]}>
            {isComplete ? '✓' : daysLeft}
          </Text>
          <Text style={[ac.statLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>
            {isComplete ? 'COMPLETE' : 'DAYS LEFT'}
          </Text>
        </View>
      </View>

      {/* Completion bar */}
      <View style={ac.barWrap}>
        <View style={[ac.barTrack, { backgroundColor: theme.border }]}>
          <View style={[ac.barFill, { backgroundColor: t.dot, width: `${pctLabel}%` }]} />
        </View>
        <Text style={[ac.barPct, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_700Bold' }]}>
          {pctLabel}%
        </Text>
      </View>

      {/* Trend + percentile */}
      <View style={ac.insightRow}>
        <View style={[ac.insightChip, { backgroundColor: trend.color + '18' }]}>
          <Ionicons name={trend.icon} size={12} color={trend.color} />
          <Text style={[ac.insightChipText, { color: trend.color, fontFamily: 'Inter_900Black' }]}>
            {trend.label}
          </Text>
        </View>
      </View>

      <Text style={[ac.percentileLine, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
        Better than{' '}
        <Text style={{ color: percentile >= 60 ? '#34C759' : percentile >= 40 ? '#F59E0B' : '#EF4444', fontFamily: 'Inter_900Black' }}>
          {percentile}%
        </Text>
        {' '}of people on this challenge
      </Text>
    </TouchableOpacity>
  );
}

const ac = StyleSheet.create({
  card:           { borderWidth: 2.5, borderRadius: 16, padding: 18, gap: 12, position: 'relative', overflow: 'hidden' },
  accent:         { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  themePill:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  themeDot:       { width: 5, height: 5, borderRadius: 3 },
  themeLabel:     { fontSize: 8, letterSpacing: 1.5 },
  title:          { fontSize: 17, letterSpacing: 0.3, lineHeight: 21 },
  statRow:        { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statCell:       { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 6 },
  statBig:        { fontSize: 32, letterSpacing: -1, lineHeight: 34 },
  statBigMax:     { fontSize: 14 },
  statLabel:      { fontSize: 8, letterSpacing: 2 },
  statSep:        { width: 1, height: 32 },
  barWrap:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barTrack:       { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  barFill:        { height: '100%', borderRadius: 2 },
  barPct:         { fontSize: 11, minWidth: 32, textAlign: 'right' },
  insightRow:     { flexDirection: 'row', gap: 8 },
  insightChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6 },
  insightChipText:{ fontSize: 9, letterSpacing: 1.5 },
  percentileLine: { fontSize: 11, lineHeight: 16 },
});

const cc = StyleSheet.create({
  card:           { borderWidth: 2.5, borderRadius: 14, padding: 16, gap: 10, minHeight: 240, position: 'relative' },
  top:            { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:            { width: 8, height: 8, borderRadius: 4 },
  themeLabel:     { fontSize: 9, letterSpacing: 1.8 },
  durationBadge:  { paddingHorizontal: 9, paddingVertical: 3, borderWidth: 2, borderRadius: 6 },
  durationText:   { fontSize: 11, letterSpacing: 0.5 },
  title:          { fontSize: 17, letterSpacing: 0.5, lineHeight: 21, marginTop: 4 },
  benefits:       { gap: 8, marginTop: 6 },
  benefitRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitMarker:  { width: 9, height: 9, borderWidth: 1.5 },
  benefitText:    { fontSize: 12, lineHeight: 16, flex: 1, letterSpacing: 0.2 },
  detailHint:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 2 },
  detailHintText: { fontSize: 10, letterSpacing: 2 },
  customBadge:    { position: 'absolute', top: 12, right: 12, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  customText:     { fontSize: 8, letterSpacing: 1.5 },
});

// ── Field label ───────────────────────────────────────────────────────────────

function FieldLabel({ label, optional, theme }: { label: string; optional?: boolean; theme: any }) {
  return (
    <Text style={[fl.label, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
      {label}{optional ? <Text style={{ opacity: 0.5 }}> OPTIONAL</Text> : ''}
    </Text>
  );
}

const fl = StyleSheet.create({
  label: { fontSize: 9, letterSpacing: 3 },
});

// ── Screen styles ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:       { flex: 1 },
  topBar:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, gap: 10 },
  modeLabel:  { fontSize: 10, letterSpacing: 1.5 },
  topIcon:    { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:     { paddingBottom: 40 },
  empty:      { alignItems: 'center', paddingVertical: 64, gap: 10 },
  emptyTitle: { fontSize: 14, letterSpacing: 2 },
  emptySub:   { fontSize: 12, opacity: 0.5 },
  footer:     { marginHorizontal: 24, marginTop: 48, paddingTop: 32, borderTopWidth: 1, alignItems: 'center', gap: 20, paddingBottom: 20 },
  footerQuote: { fontSize: 12, textAlign: 'center', lineHeight: 20, fontStyle: 'italic', maxWidth: 260 },
  footerRule: { flexDirection: 'row', alignItems: 'center', gap: 10, opacity: 0.15 },
  footerLine: { height: 1, width: 16 },
  footerLabel: { fontSize: 8, letterSpacing: 4 },
  modal:      { flex: 1, paddingTop: 8 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, borderBottomWidth: 1 },
  modalTitle: { fontSize: 14, letterSpacing: 3 },
  modalBody:  { padding: 24, gap: 16, paddingBottom: 48 },
  input:      { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 13, letterSpacing: 1, borderRadius: 0 },
  inputMulti: { height: 80, textAlignVertical: 'top', paddingTop: 12 },
  domainGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  domainChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, borderRadius: 0 },
  domainDot:  { width: 6, height: 6, borderRadius: 3 },
  domainLabel: { fontSize: 9, letterSpacing: 2 },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationChip: { paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1.5, borderRadius: 0, minWidth: 48, alignItems: 'center' },
  durationText: { fontSize: 11 },
  submitBtn:   { paddingVertical: 16, alignItems: 'center', borderRadius: 0, marginTop: 8 },
  submitBtnText: { fontSize: 10, letterSpacing: 4 },
});

// ── Challenge detail modal ────────────────────────────────────────────────────

function ChallengeDetailModal({
  challenge: c, theme, onClose, onJoin, onAbandon,
}: {
  challenge: Challenge | null;
  theme: AppTheme;
  onClose: () => void;
  onJoin: (c: Challenge) => void;
  onAbandon: (c: Challenge) => void;
}) {
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Reset heatmap toggle whenever the modal opens for a new challenge.
  useEffect(() => { setShowHeatmap(false); }, [c?.id]);

  if (!c) return null;
  const t            = themeForDomain(c.domain);
  const detail       = detailFor(c);
  const participants = participantsFor(c);
  const isActive     = c.joined && c.status === 'active';
  const pct          = isActive ? Math.min(c.daysDone / c.durationDays, 1) : 0;
  const histogram    = durationHistogramFor(c);
  const peakBucket   = histogram.reduce((a, b) => b.users > a.users ? b : a, histogram[0]);
  const maxUsers     = peakBucket.users;

  return (
    <Modal
      visible={!!c}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[dm.root, { backgroundColor: theme.bg }]}>
        <View style={[dm.handle, { backgroundColor: theme.border }]} />

        {/* Header */}
        <View style={[dm.header, { borderBottomColor: theme.border }]}>
          <View style={[dm.themePill, { backgroundColor: t.dot + '20' }]}>
            <View style={[dm.themeDot, { backgroundColor: t.dot }]} />
            <Text style={[dm.themeLabel, { color: t.dot, fontFamily: 'Inter_900Black' }]}>{t.label}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={dm.body} showsVerticalScrollIndicator={false}>
          {/* Title */}
          <Text style={[dm.title, { color: theme.text, fontFamily: 'Inter_900Black' }]}>
            {c.title.toUpperCase()}
          </Text>

          {/* Quick stats row */}
          <View style={[dm.statsRow, { borderColor: theme.border }]}>
            <View style={dm.statCell}>
              <Text style={[dm.statBig, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                {c.durationDays}
              </Text>
              <Text style={[dm.statLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>DAYS</Text>
            </View>
            <View style={[dm.statSep, { backgroundColor: theme.border }]} />
            <View style={dm.statCell}>
              <Text style={[dm.statBig, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                {participants.toLocaleString()}
              </Text>
              <Text style={[dm.statLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>PEOPLE IN</Text>
            </View>
            {isActive && (
              <>
                <View style={[dm.statSep, { backgroundColor: theme.border }]} />
                <View style={dm.statCell}>
                  <Text style={[dm.statBig, { color: t.dot, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                    {Math.round(pct * 100)}%
                  </Text>
                  <Text style={[dm.statLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>DONE</Text>
                </View>
              </>
            )}
          </View>

          {/* Description (if any) */}
          {!!c.description?.trim() && (
            <View style={dm.section}>
              <Text style={[dm.sectionLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                THE PROMISE
              </Text>
              <Text style={[dm.sectionBody, { color: theme.text, fontFamily: 'Inter_500Medium' }]}>
                {c.description}
              </Text>
            </View>
          )}

          {/* What to do */}
          <View style={dm.section}>
            <Text style={[dm.sectionLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
              WHAT YOU NEED TO DO
            </Text>
            <Text style={[dm.sectionBody, { color: theme.text, fontFamily: 'Inter_500Medium' }]}>
              {detail.instructions}
            </Text>
          </View>

          {/* Benefits */}
          <View style={dm.section}>
            <Text style={[dm.sectionLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
              WHAT YOU GAIN
            </Text>
            <View style={dm.benefitGrid}>
              {detail.benefits.map((b, i) => (
                <View key={i} style={[dm.benefitChip, { borderColor: t.dot + '60', backgroundColor: t.dot + '12' }]}>
                  <View style={[dm.benefitDot, { backgroundColor: t.dot }]} />
                  <Text style={[dm.benefitText, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>
                    {b}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Participants footer line */}
          <Text style={[dm.participantsLine, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
            <Text style={{ color: t.dot, fontFamily: 'Inter_900Black' }}>{participants.toLocaleString()}</Text>
            {' '}people are running this challenge right now
          </Text>

          {/* Heatmap toggle */}
          <TouchableOpacity
            style={[dm.heatmapBtn, { borderColor: theme.text }]}
            onPress={() => setShowHeatmap(v => !v)}
            activeOpacity={0.85}
          >
            <Ionicons name="bar-chart-outline" size={14} color={theme.text} />
            <Text style={[dm.heatmapBtnText, { color: theme.text, fontFamily: 'Inter_900Black' }]}>
              {showHeatmap ? 'HIDE HEATMAP' : 'SHOW HEATMAP'}
            </Text>
            <Ionicons
              name={showHeatmap ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={theme.text}
            />
          </TouchableOpacity>

          {showHeatmap && (
            <View style={[dm.heatmapCard, { borderColor: theme.text, backgroundColor: theme.card }]}>
              <Text style={[dm.heatmapTitle, { color: theme.text, fontFamily: 'Inter_900Black' }]}>
                HOW LONG OTHERS STUCK WITH IT
              </Text>
              <Text style={[dm.heatmapSub, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                Most people drop off around{' '}
                <Text style={{ color: t.dot, fontFamily: 'Inter_900Black' }}>
                  {peakBucket.label}
                </Text>
                .
              </Text>
              <View style={dm.heatRows}>
                {histogram.map((b, i) => {
                  const w        = (b.users / maxUsers) * 100;
                  const isPeak   = b.users === maxUsers;
                  const barColor = isPeak ? t.dot : t.dot + '70';
                  return (
                    <View key={i} style={dm.heatRow}>
                      <Text style={[dm.heatLabel, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                        {b.label}
                      </Text>
                      <View style={[dm.heatTrack, { backgroundColor: theme.overlay }]}>
                        <View style={[dm.heatFill, { width: `${w}%`, backgroundColor: barColor }]} />
                      </View>
                      <Text style={[dm.heatCount, { color: theme.text, fontFamily: 'Inter_900Black' }]}>
                        {b.users}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={[dm.heatmapFootnote, { color: theme.textMuted, fontFamily: 'Inter_500Medium' }]}>
                Based on {participants.toLocaleString()} participants
              </Text>
            </View>
          )}

          {/* Primary action */}
          {isActive ? (
            <TouchableOpacity
              style={[dm.btnDanger, { borderColor: '#EF4444' }]}
              onPress={() => onAbandon(c)}
              activeOpacity={0.85}
            >
              <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
              <Text style={[dm.btnDangerText, { color: '#EF4444', fontFamily: 'Inter_900Black' }]}>
                ABANDON CHALLENGE
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[dm.btnPrimary, { backgroundColor: theme.inverse }]}
              onPress={() => onJoin(c)}
              activeOpacity={0.85}
            >
              <Text style={[dm.btnPrimaryText, { color: theme.inverseText, fontFamily: 'Inter_900Black' }]}>
                START THIS CHALLENGE →
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const dm = StyleSheet.create({
  root:             { flex: 1, paddingTop: 8 },
  handle:           { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  themePill:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  themeDot:         { width: 6, height: 6, borderRadius: 3 },
  themeLabel:       { fontSize: 9, letterSpacing: 1.5 },
  body:             { padding: 24, paddingBottom: 48, gap: 22 },
  title:            { fontSize: 26, letterSpacing: -0.5, lineHeight: 30 },
  statsRow:         { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingVertical: 14 },
  statCell:         { flex: 1, alignItems: 'center', gap: 4 },
  statBig:          { fontSize: 20, letterSpacing: -0.5 },
  statLabel:        { fontSize: 8, letterSpacing: 1.8 },
  statSep:          { width: 1, height: 32 },
  section:          { gap: 8 },
  sectionLabel:     { fontSize: 9, letterSpacing: 3 },
  sectionBody:      { fontSize: 14, lineHeight: 20 },
  benefitGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  benefitChip:      { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
  benefitDot:       { width: 5, height: 5, borderRadius: 3 },
  benefitText:      { fontSize: 11, letterSpacing: 0.5 },
  participantsLine: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 },
  heatmapBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderWidth: 2, borderRadius: 10 },
  heatmapBtnText:   { fontSize: 11, letterSpacing: 2.5, flex: 0 },
  heatmapCard:      { borderWidth: 2, borderRadius: 12, padding: 16, gap: 14 },
  heatmapTitle:    { fontSize: 11, letterSpacing: 2 },
  heatmapSub:       { fontSize: 11, lineHeight: 16 },
  heatRows:         { gap: 8, marginTop: 4 },
  heatRow:          { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heatLabel:        { width: 56, fontSize: 10, letterSpacing: 0.3 },
  heatTrack:        { flex: 1, height: 10, borderRadius: 3, overflow: 'hidden' },
  heatFill:         { height: '100%', borderRadius: 3 },
  heatCount:        { width: 32, textAlign: 'right', fontSize: 12 },
  heatmapFootnote:  { fontSize: 10, textAlign: 'center', marginTop: 2 },
  btnPrimary:       { paddingVertical: 16, alignItems: 'center', borderRadius: 10, marginTop: 8 },
  btnPrimaryText:   { fontSize: 12, letterSpacing: 3 },
  btnDanger:        { paddingVertical: 14, alignItems: 'center', borderRadius: 10, borderWidth: 1.5, flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  btnDangerText:    { fontSize: 11, letterSpacing: 3 },
});
