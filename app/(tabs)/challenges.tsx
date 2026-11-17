import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
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
import { challenges, Challenge, DurationStats, tasks, habits, today, shiftDate, toDateStr } from '../../lib/api';
import { AskGritttButton } from '../../components/AskGritttButton';
import { TrackingHeader, IconButton, PrimaryButton } from '../../components/TrackingShared';
import { FoodModeTabs, FoodSubmissionMode } from '../../components/FoodDetailedView';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorState } from '../../components/ErrorState';
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

async function shareChallenge(c: Challenge) {
  const bullets = (c.benefits ?? []).slice(0, 3).map(b => `• ${b}`).join('\n');
  await Share.share({
    message: `💪 ${c.title.toUpperCase()} — ${c.durationDays}-DAY CHALLENGE\n\n${bullets}\n\nJoin me on Grittt! 🔥`,
    title: c.title,
  }).catch(() => {});
}

// Instructions come from the backend (preset-seeded or stored on the challenge);
// fall back to the description, then a generic line. Benefits are read straight
// off `c.benefits` (the server fills these in for presets and custom challenges).
function instructionsFor(c: Challenge): string {
  return (
    c.instructions?.trim() ||
    c.description?.trim() ||
    `Complete this every day for ${c.durationDays} days. Mark it done on your habits page.`
  );
}

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

export default function ChallengesScreen() {
  const { token } = useAuth();
  const { theme } = useTheme();
  const router    = useRouter();

  const [view,setView] = useState<FoodSubmissionMode>('quick');
  const [category,setCategory] = useState<ThemeKey | 'all'>('all');
  const [list, setList]             = useState<Challenge[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState(false);
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
    try {
      setList(await challenges.list(token));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
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
    if (!token) return;
    if (!formTitle.trim()) {
      Alert.alert('Add a title', 'Give your challenge a name before launching it.');
      return;
    }
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
    } catch (err: any) {
      Alert.alert('Couldn’t create challenge', err?.message || 'Please try again.');
    }
    finally { setCreating(false); }
  }

  const active    = list.filter(c => c.status === 'active');
  const available = list.filter(c => !c.joined || c.status === 'abandoned');

  if (loading) return <LoadingScreen />;

  return (
    <DarkBackground><SafeAreaView style={s.safe} edges={['top']}>
      <TrackingHeader title="Grind" date="" todayStr="" showDate={false} theme={theme} right={<><IconButton icon="add-outline" label="Create challenge" onPress={()=>setShowCreate(true)} theme={theme}/><IconButton icon="sparkles-outline" label="AI coach" onPress={()=>router.push('/(tabs)/ai')} theme={theme}/><IconButton icon="settings-outline" label="Profile and settings" onPress={()=>router.push('/(tabs)/profile')} theme={theme}/></>}/>
      <ScrollView contentContainerStyle={{paddingBottom:32}} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text}/>}>
        {loadError && <ErrorState message="Couldn't refresh your challenges." onRetry={onRefresh}/>}
        <FoodModeTabs mode={view} onChange={setView} quickLabel="My Grind" detailedLabel="Explore" accessibilityLabel="Challenge view" theme={theme}/>
        <View style={{marginHorizontal:16,marginBottom:18}}><PrimaryButton label="Create a challenge" icon="add" onPress={()=>setShowCreate(true)} theme={theme}/></View>
        {view==='quick' ? <>
          {active.map(c=><GrindListCard key={c.id} challenge={c} theme={theme} onPress={()=>setDetail(c)}/>)}
          {!active.length && !loadError && <View style={{marginHorizontal:16,marginBottom:16,padding:24,borderRadius:20,backgroundColor:theme.card}}><Text style={{color:theme.text,fontSize:18,fontFamily:'Inter_800ExtraBold',marginBottom:8}}>Choose your next challenge</Text><Text style={{color:theme.textSecondary,fontSize:14,lineHeight:21,marginBottom:18}}>Explore a challenge or create one of your own.</Text><PrimaryButton label="Explore challenges" onPress={()=>setView('detailed')} theme={theme}/></View>}
          {list.some(c=>c.status==='completed') && <><Text style={{marginHorizontal:18,marginTop:12,marginBottom:12,color:theme.text,fontFamily:'Inter_800ExtraBold',fontSize:17}}>Completed</Text>{list.filter(c=>c.status==='completed').map(c=><GrindListCard key={c.id} challenge={c} theme={theme} onPress={()=>setDetail(c)}/>)}</>}
        </> : <>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginHorizontal:16,marginBottom:18}}>{([{key:'all',label:'All'},...THEME_ROWS.map(row=>({key:row.key,label:row.key==='physical'?'Physical':row.key.charAt(0).toUpperCase()+row.key.slice(1)}))] as const).map(item=><TouchableOpacity key={item.key} accessibilityRole="button" accessibilityLabel={`Filter ${item.label}`} accessibilityState={{selected:category===item.key}} onPress={()=>setCategory(item.key)} style={{minHeight:44,paddingHorizontal:16,borderRadius:22,justifyContent:'center',borderWidth:1,borderColor:category===item.key?theme.inverse:theme.border,backgroundColor:category===item.key?theme.inverse:theme.card}}><Text style={{color:category===item.key?theme.inverseText:theme.text,fontSize:13,fontFamily:'Inter_600SemiBold'}}>{item.label}</Text></TouchableOpacity>)}</View>
          {available.filter(c=>category==='all'||themeForDomain(c.domain).key===category).map(c=><GrindListCard key={c.id} challenge={c} theme={theme} onPress={()=>setDetail(c)}/>)}
          {!available.some(c=>category==='all'||themeForDomain(c.domain).key===category)&&!loadError&&<Text style={{margin:24,color:theme.textSecondary,textAlign:'center'}}>No challenges in this category yet.</Text>}
        </>}
      </ScrollView>

      {/* Detail modal */}
      <ChallengeDetailModal
        challenge={detail}
        theme={theme}
        token={token}
        onClose={() => setDetail(null)}
        onJoin={c => { handleJoin(c); setDetail(null); }}
        onAbandon={c => { handleAbandon(c); setDetail(null); }}
      />

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={[s.modal, { backgroundColor: theme.bg }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
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
              autoCapitalize="characters"
              returnKeyType="done"
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
                      { borderColor: active ? theme.text : theme.border },
                      active && { backgroundColor: theme.text + '15' },
                    ]}
                    onPress={() => setFormTheme(row.key)}
                  >
                    <View style={[s.domainDot, { backgroundColor: theme.text }]} />
                    <Text style={[
                      s.domainLabel,
                      { fontFamily: 'Inter_700Bold' },
                      active ? { color: theme.text } : { color: theme.textSecondary },
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
                { backgroundColor: theme.tabActiveBg, opacity: creating ? 0.5 : (formTitle.trim() ? 1 : 0.7) },
              ]}
              onPress={handleCreate}
              disabled={creating}
              activeOpacity={0.85}
            >
              <Text style={[s.submitBtnText, { color: theme.tabActiveText, fontFamily: 'Inter_900Black' }]}>
                {creating ? 'CREATING...' : 'LAUNCH CHALLENGE'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
    </DarkBackground>
  );
}

// ── Horizontal theme row ──────────────────────────────────────────────────────

function GrindListCard({challenge:c,theme,onPress}:{challenge:Challenge;theme:AppTheme;onPress:()=>void}) {
 const joined=c.status==='active'||c.status==='completed';
 const progress=c.durationDays>0?Math.min(100,Math.max(0,c.daysDone/c.durationDays*100)):0;
 const category=themeForDomain(c.domain).key;
 return <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={`${c.title}, ${c.durationDays} days${joined?`, ${c.daysDone} days completed`:''}. View challenge`} activeOpacity={0.8} style={{marginHorizontal:16,marginBottom:12,padding:18,borderRadius:20,borderWidth:1,borderColor:theme.border,backgroundColor:theme.card}}>
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12}}><Text style={{color:theme.textSecondary,fontSize:11,fontFamily:'Inter_700Bold'}}>{category.charAt(0).toUpperCase()+category.slice(1)}</Text><Text style={{color:theme.textSecondary,fontSize:12}}>{c.durationDays} days</Text></View>
  <View style={{flexDirection:'row',alignItems:'center',gap:12}}><Text style={{flex:1,color:theme.text,fontSize:18,lineHeight:24,fontFamily:'Inter_800ExtraBold'}}>{c.title}</Text><Ionicons name="chevron-forward" color={theme.text} size={18}/></View>
  {joined?<View style={{marginTop:16}}><View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:10}}><Text style={{color:theme.textSecondary,fontSize:12}}>{c.daysDone} / {c.durationDays} days logged</Text><Text style={{color:theme.text,fontSize:12,fontFamily:'Inter_700Bold'}}>{c.status==='completed'?'Completed':`${Math.round(progress)}%`}</Text></View><View style={{height:5,borderRadius:3,backgroundColor:theme.surfaceStrong,overflow:'hidden'}}><View style={{height:5,width:`${progress}%`,backgroundColor:theme.text,borderRadius:3}}/></View></View>:<><Text style={{marginTop:10,color:theme.textSecondary,fontSize:13,lineHeight:20}} numberOfLines={2}>{c.description||instructionsFor(c)}</Text><Text style={{marginTop:14,color:theme.text,fontSize:13,fontFamily:'Inter_700Bold'}}>View challenge →</Text></>}
 </TouchableOpacity>;
}

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
          <Text style={[tr.label, { color: theme.text, fontFamily: 'Inter_900Black' }]}>
            {label} · {count}
          </Text>
        </View>
        <Text style={[tr.hint, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>SEE ALL</Text>
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
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accentDot:  { width: 7, height: 7, borderRadius: 4 },
  label:      { fontSize: 11, letterSpacing: 1.5 },
  hint:       { fontSize: 11 },
  row:        { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
});

// ── Challenge card (horizontal) ───────────────────────────────────────────────

function ChallengeCard({ challenge: c, theme, onPress }: { challenge: Challenge; theme: any; onPress: () => void }) {
  const t      = themeForDomain(c.domain);
  const points = (c.benefits ?? []).slice(0, 3);

  return (
    <TouchableOpacity
      style={[cc.card, { width: CARD_W, backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Top: theme pill + duration badge */}
      <View style={cc.top}>
        <View style={[cc.themePill, { backgroundColor: theme.text + '22' }]}>
          <View style={[cc.themeDot, { backgroundColor: theme.text }]} />
          <Text style={[cc.themeLabel, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{t.label}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <View style={[cc.durationBadge, { backgroundColor: theme.surfaceStrong }]}>
          <Text style={[cc.durationText, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_700Bold' }]}>
            {c.durationDays}D
          </Text>
        </View>
      </View>

      {/* Title */}
      <Text style={[cc.title, { color: theme.text, fontFamily: 'Inter_900Black' }]} numberOfLines={2}>
        {c.title.toUpperCase()}
      </Text>

      {/* Bullet points */}
      <View style={cc.points}>
        {points.map((pt, i) => (
          <View key={i} style={cc.pointRow}>
            <View style={[cc.bullet, { backgroundColor: theme.text }]} />
            <Text style={[cc.pointText, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{pt}</Text>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      {/* Start + Share row */}
      <View style={cc.actionRow}>
        <TouchableOpacity style={[cc.startBtn, { backgroundColor: theme.inverse, flex: 1 }]} onPress={onPress} activeOpacity={0.85}>
          <Text style={[cc.startText, { color: theme.inverseText, fontFamily: 'Inter_900Black' }]}>START →</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[cc.shareBtn, { borderColor: theme.border }]}
          onPress={() => shareChallenge(c)}
          activeOpacity={0.75}
        >
          <Ionicons name="share-outline" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {!c.isPreset && (
        <View style={[cc.customBadge, { backgroundColor: theme.text }]}>
          <Text style={[cc.customText, { color: '#FFF', fontFamily: 'Inter_900Black' }]}>CUSTOM</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function ActiveCard({ challenge: c, theme, token, width, onPress, onAbandon }: {
  challenge: Challenge; theme: any; token: string | null;
  width?: number; onPress?: () => void; onAbandon: () => void;
}) {
  const t          = themeForDomain(c.domain);
  const pct        = Math.min(c.daysDone / c.durationDays, 1);
  const pctLabel   = Math.round(pct * 100);
  const daysLeft   = Math.max(c.durationDays - c.daysDone, 0);
  const isComplete = daysLeft === 0;
  const trend      = trendFor(c);

  // Real /challenges/:id/percentile endpoint. `percentile` is null until there
  // are enough other participants to compare against — we show an honest
  // "you're setting the pace" line in that case rather than inventing a number.
  const [serverPct, setServerPct] = useState<number | null>(null);
  const [hasOthers, setHasOthers] = useState<boolean>(false);
  useEffect(() => {
    if (!token) return;
    let alive = true;
    challenges.percentile(token, c.id)
      .then(r => { if (alive) { setServerPct(r.percentile); setHasOthers(r.totalOthers > 0); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [token, c.id]);

  const percentile = serverPct ?? 0;
  const pColor     = percentile >= 60 ? '#22A664' : percentile >= 40 ? '#F0A12E' : '#E84A4A';

  return (
    <TouchableOpacity
      style={[ac.card, { width: width ?? ACTIVE_CARD_W, backgroundColor: theme.card, borderColor: theme.text }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Header: theme pill + close */}
      <View style={ac.header}>
        <View style={[ac.themePill, { backgroundColor: theme.text + '22' }]}>
          <Text style={[ac.themeLabel, { color: theme.text, fontFamily: 'Inter_900Black' }]}>
            {t.label} · {c.durationDays}D
          </Text>
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

      {/* Stat row: days done | days left */}
      <View style={ac.statRow}>
        <View style={ac.statCell}>
          <Text style={[ac.statBig, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>
            {c.daysDone}
            <Text style={[ac.statBigSub, { color: theme.textMuted }]}>/{c.durationDays}</Text>
          </Text>
          <Text style={[ac.statLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>DAYS DONE</Text>
        </View>
        <View style={[ac.statSep, { backgroundColor: theme.border }]} />
        <View style={ac.statCell}>
          <Text style={[ac.statBig, { color: isComplete ? '#22A664' : theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>
            {isComplete ? '✓' : daysLeft}
          </Text>
          <Text style={[ac.statLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>
            {isComplete ? 'COMPLETE' : 'DAYS LEFT'}
          </Text>
        </View>
      </View>

      {/* Progress dot grid */}
      <View style={ac.progressWrap}>
        <View style={ac.progressMeta}>
          <Text style={[ac.progressPct, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
            {pctLabel}% COMPLETE
          </Text>
          <Text style={[ac.trendLabel, { color: trend.color, fontFamily: 'Inter_900Black' }]}>
            {trend.label}
          </Text>
        </View>
        <View style={ac.dotsGrid}>
          {Array.from({ length: c.durationDays }).map((_, i) => (
            <View key={i} style={[ac.dot, {
              backgroundColor: i < c.daysDone
                ? theme.text
                : i === c.daysDone
                  ? theme.text + '55'
                  : theme.surfaceStrong,
            }]} />
          ))}
        </View>
      </View>

      {/* Percentile — real server data only. When the server can't rank you yet
          (no/too-few other participants) we show an honest line instead of a
          made-up number. */}
      <Text style={[ac.percentileLine, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
        {serverPct == null
          ? (hasOthers
              ? <>Not enough data to rank you <Text style={{ color: theme.text, fontFamily: 'Inter_900Black' }}>yet</Text> — keep going.</>
              : <>You're the <Text style={{ color: theme.text, fontFamily: 'Inter_900Black' }}>first one in</Text> — set the pace.</>)
          : <>Better than{' '}
              <Text style={{ color: pColor, fontFamily: 'Inter_900Black' }}>{percentile}%</Text>
              {' '}of people on this challenge</>
        }
      </Text>
    </TouchableOpacity>
  );
}

const ac = StyleSheet.create({
  card:          { borderWidth: 1.5, borderRadius: 18, padding: 16, gap: 12 },
  header:        { flexDirection: 'row', alignItems: 'center' },
  themePill:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  themeLabel:    { fontSize: 9, letterSpacing: 1.5 },
  title:         { fontSize: 22, letterSpacing: -0.3, lineHeight: 25 },
  statRow:       { flexDirection: 'row', alignItems: 'center', gap: 0 },
  statCell:      { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6 },
  statBig:       { fontSize: 34, letterSpacing: -1, lineHeight: 36 },
  statBigSub:    { fontSize: 15 },
  statLabel:     { fontSize: 8, letterSpacing: 2 },
  statSep:       { width: 1, height: 36 },
  progressWrap:  { gap: 8 },
  progressMeta:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressPct:   { fontSize: 9, letterSpacing: 2 },
  trendLabel:    { fontSize: 9, letterSpacing: 1.5 },
  dotsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  dot:           { width: 8, height: 6, borderRadius: 2 },
  percentileLine:{ fontSize: 11, lineHeight: 16 },
});

const cc = StyleSheet.create({
  card:         { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10, minHeight: 230, position: 'relative' },
  top:          { flexDirection: 'row', alignItems: 'center', gap: 8 },
  themePill:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  themeDot:     { width: 5, height: 5, borderRadius: 3 },
  themeLabel:   { fontSize: 9, letterSpacing: 1.5 },
  durationBadge:{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  durationText: { fontSize: 10, letterSpacing: 0.5 },
  title:        { fontSize: 17, letterSpacing: 0.3, lineHeight: 21 },
  points:       { gap: 6 },
  pointRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bullet:       { width: 4, height: 4, borderRadius: 2, flexShrink: 0 },
  pointText:    { fontSize: 12, lineHeight: 16, flex: 1 },
  actionRow:    { flexDirection: 'row', gap: 8, marginTop: 4 },
  startBtn:     { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  startText:    { fontSize: 11, letterSpacing: 3 },
  shareBtn:     { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  customBadge:  { position: 'absolute', top: 12, right: 12, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  customText:   { fontSize: 8, letterSpacing: 1.5 },
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
  modeLabel:  { fontSize: 10, letterSpacing: 2 },
  modeTitle:  { fontSize: 24, letterSpacing: -0.5, lineHeight: 26 },
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
  challenge: c, theme, token, onClose, onJoin, onAbandon,
}: {
  challenge: Challenge | null;
  theme: AppTheme;
  token: string | null;
  onClose: () => void;
  onJoin: (c: Challenge) => void;
  onAbandon: (c: Challenge) => void;
}) {
  const [ranking,setRanking] = useState<Awaited<ReturnType<typeof challenges.percentile>> | null>(null);
  const [rankLoading,setRankLoading] = useState(false);
  const [rankError,setRankError] = useState(false);
  const [rankVersion,setRankVersion] = useState(0);
  useEffect(()=>{
    let cancelled=false;setRanking(null);setRankError(false);
    if (!c?.joined || !token) {setRankLoading(false);return;}
    setRankLoading(true);
    challenges.percentile(token,c.id).then(result=>{if(!cancelled)setRanking(result)}).catch(()=>{if(!cancelled)setRankError(true)}).finally(()=>{if(!cancelled)setRankLoading(false)});
    return()=>{cancelled=true};
  },[c?.id,c?.joined,c?.daysDone,token,rankVersion]);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [stats, setStats]             = useState<DurationStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [calendar,setCalendar] = useState<Record<string,boolean>>({});
  const [calendarLoading,setCalendarLoading] = useState(false);
  const [calendarError,setCalendarError] = useState(false);
  const [calendarVersion,setCalendarVersion] = useState(0);
  useEffect(()=>{
    let cancelled=false;setCalendar({});setCalendarError(false);
    if (!c?.joined || !token) {setCalendarLoading(false);return;}
    setCalendarLoading(true);
    habits.stats(token,c.title.trim()).then(result=>{if(cancelled)return;const start=c.startedAt?toDateStr(new Date(c.startedAt)):null;const end=c.completedAt?toDateStr(new Date(c.completedAt)):today();const records:Record<string,boolean>={};result.completions.forEach(record=>{if((!start||record.date>=start)&&record.date<=end)records[record.date]=record.failed;});setCalendar(records);}).catch(()=>{if(!cancelled)setCalendarError(true)}).finally(()=>{if(!cancelled)setCalendarLoading(false)});
    return()=>{cancelled=true};
  },[c?.id,c?.joined,c?.startedAt,c?.completedAt,token,calendarVersion]);

  // Reset state whenever the modal opens for a new challenge.
  useEffect(() => { setShowHeatmap(false); setStats(null); }, [c?.id]);

  // Fetch the real drop-off distribution lazily, the first time the heatmap is opened.
  useEffect(() => {
    if (!showHeatmap || !token || !c || stats) return;
    let alive = true;
    setStatsLoading(true);
    challenges.durationStats(token, c.id)
      .then(r => { if (alive) setStats(r); })
      .catch(() => {})
      .finally(() => { if (alive) setStatsLoading(false); });
    return () => { alive = false; };
  }, [showHeatmap, token, c?.id]);

  if (!c) return null;
  const t            = themeForDomain(c.domain);
  const instructions = instructionsFor(c);
  const benefits     = c.benefits ?? [];
  const participants = c.participantCount;
  const isActive     = c.joined && c.status === 'active';
  const pct          = c.durationDays > 0 ? Math.min(Math.max(c.daysDone / c.durationDays, 0), 1) : 0;
  const histogram    = stats?.histogram ?? [];
  const peakBucket   = histogram.length ? histogram.reduce((a, b) => b.users > a.users ? b : a, histogram[0]) : null;
  const maxUsers     = Math.max(1, ...histogram.map(b => b.users));

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
          <View style={[dm.themePill, { backgroundColor: theme.text + '20' }]}>
            <View style={[dm.themeDot, { backgroundColor: theme.text }]} />
            <Text style={[dm.themeLabel, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{t.label}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <AskGritttButton screen="habits"/>
          <TouchableOpacity
            onPress={() => shareChallenge(c)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button" accessibilityLabel="Share challenge"
            style={{ marginLeft: 14, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="share-outline" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close challenge details" style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={dm.body} showsVerticalScrollIndicator={false}>
          {/* Title */}
          <Text style={[dm.title, { color: theme.text, fontFamily: 'Inter_900Black' }]}>
            {c.title}
          </Text>

          {/* Quick stats row */}
          <View style={[dm.statsRow,{borderColor:theme.text,backgroundColor:theme.card}]}>
            <View style={dm.statCell}>
              <Text style={[dm.statBig, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                {c.durationDays}
              </Text>
              <Text style={[dm.statLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>Duration</Text>
            </View>
            <View style={dm.statCell}>
              <Text style={[dm.statBig, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                {participants.toLocaleString()}
              </Text>
              <Text style={[dm.statLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>Joined</Text>
            </View>
            {(isActive || c.status === 'completed') && (
              <>
                    <View style={dm.statCell}>
                  <Text style={[dm.statBig, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                    {Math.round(pct * 100)}%
                  </Text>
                  <Text style={[dm.statLabel, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>Progress</Text>
                </View>
              </>
            )}
            {c.joined && <TouchableOpacity style={[dm.statCell,{minHeight:44}]} disabled={!rankError} onPress={()=>setRankVersion(value=>value+1)} accessibilityRole={rankError?'button':'text'} accessibilityLabel={rankLoading?'Loading position':rankError?'Position unavailable. Tap to retry.':ranking?.percentile!=null&&ranking.totalOthers>0?`Position: ahead of ${ranking.percentile}% of ${ranking.totalOthers} other participants`:'Position: not ranked yet'}>
              <Text style={[dm.statBig,{color:theme.text,fontFamily:'SpaceGrotesk_700Bold'}]} numberOfLines={1} adjustsFontSizeToFit>{rankLoading?'…':!rankError&&ranking?.percentile!=null&&ranking.totalOthers>0?`${ranking.percentile}%`:'—'}</Text>
              <Text style={[dm.statLabel,{color:theme.textMuted,fontFamily:'Inter_700Bold'}]}>Position</Text>
              <Text style={{color:theme.textSecondary,fontSize:9,textAlign:'center'}}>{rankLoading?'Loading':rankError?'Tap to retry':ranking?.percentile!=null&&ranking.totalOthers>0?'Ahead of others':'Not ranked yet'}</Text>
            </TouchableOpacity>}
          </View>

          {/* Description (if any) */}
          {!!c.description?.trim() && c.description.trim() !== instructions.trim() && (
            <View style={dm.section}>
              <Text style={[dm.sectionLabel, { color: theme.text, fontFamily: 'Inter_800ExtraBold' }]}>
                About this challenge
              </Text>
              <Text style={[dm.sectionBody, { color: theme.text, fontFamily: 'Inter_500Medium' }]}>
                {c.description}
              </Text>
            </View>
          )}

          <View style={{padding:18,borderRadius:20,backgroundColor:theme.card}}>
            <Text style={{color:theme.text,fontSize:18,fontFamily:'Inter_800ExtraBold',marginBottom:6}}>Your consistency</Text>
            <Text style={{color:theme.textSecondary,fontSize:12,marginBottom:16}}>Last 28 days</Text>
            {calendarLoading ? <Text style={{color:theme.textSecondary,paddingVertical:20}}>Loading your records…</Text> : calendarError ? <TouchableOpacity accessibilityRole="button" onPress={()=>setCalendarVersion(value=>value+1)} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:theme.text}}>Couldn’t load records. Tap to retry.</Text></TouchableOpacity> : <>
              <View style={{flexDirection:'row',gap:5,marginBottom:8}}>{['M','T','W','T','F','S','S'].map((day,index)=><Text key={index} style={{flex:1,textAlign:'center',color:theme.textSecondary,fontSize:11}}>{day}</Text>)}</View>
              {(()=>{const end=today();const from=shiftDate(end,-27);const offset=(new Date(from+'T12:00:00').getDay()+6)%7;const cells:(string|null)[]=[...Array(offset).fill(null),...Array.from({length:28},(_,index)=>shiftDate(from,index))];while(cells.length%7)cells.push(null);return Array.from({length:cells.length/7},(_,row)=><View key={row} style={{flexDirection:'row',gap:5,marginBottom:5}}>{cells.slice(row*7,row*7+7).map((date,index)=>{const failed=date?calendar[date]:undefined;const logged=failed!==undefined;const isToday=date===end;return <View key={date??`blank-${index}`} accessible={!!date} accessibilityLabel={date?`${date}: ${logged?(failed?'Slipped':'Completed'):'No recorded entry'}`:undefined} style={{flex:1,aspectRatio:1,borderRadius:8,alignItems:'center',justifyContent:'center',borderWidth:isToday?1:0,borderColor:theme.text,backgroundColor:!date?'transparent':logged?(failed?theme.surfaceStrong:theme.inverse):theme.surface}}>{date&&<Text style={{color:logged&&!failed?theme.inverseText:theme.textSecondary,fontSize:12,fontFamily:logged?'Inter_700Bold':'Inter_500Medium'}}>{logged?(failed?'!':'✓'):Number(date.slice(-2))}</Text>}</View>})}</View>)})()}
              <View style={{flexDirection:'row',gap:14,marginTop:10}}><Text style={{color:theme.textSecondary,fontSize:11}}>✓ Completed</Text><Text style={{color:theme.textSecondary,fontSize:11}}>Outline · Today</Text>{Object.values(calendar).some(failed=>failed)&&<Text style={{color:theme.textSecondary,fontSize:11}}>! Slipped</Text>}</View>
              {!c.joined&&<Text style={{color:theme.textSecondary,fontSize:12,marginTop:12}}>Join this challenge to start tracking.</Text>}
            </>}
          </View>

          {/* Benefits */}
          {benefits.length > 0 && (
            <View style={dm.section}>
              <Text style={[dm.sectionLabel, { color: theme.text, fontFamily: 'Inter_800ExtraBold' }]}>
                What you’re working towards
              </Text>
              <View style={dm.benefitGrid}>
                {benefits.map((b, i) => (
                  <View key={i} style={[dm.benefitChip, { backgroundColor: theme.card }]}>
                    <Ionicons name="checkmark-outline" size={16} color={theme.textSecondary}/>
                    <Text style={[dm.benefitText, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>
                      {b}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Participants footer line — real count from the backend */}
          {participants > 0 && (
            <Text style={[dm.participantsLine, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
              <Text style={{ color: theme.text, fontFamily: 'Inter_900Black' }}>{participants.toLocaleString()}</Text>
              {participants === 1 ? ' person has' : ' people have'} joined this challenge
            </Text>
          )}

          {/* Heatmap toggle */}
          <TouchableOpacity
            style={[dm.heatmapBtn, { borderColor: theme.text }]}
            onPress={() => setShowHeatmap(v => !v)}
            activeOpacity={0.85}
          >
            <Ionicons name="bar-chart-outline" size={14} color={theme.text} />
            <Text style={[dm.heatmapBtnText, { color: theme.text, fontFamily: 'Inter_900Black' }]}>
              {showHeatmap ? 'Hide participant progress' : 'Participant progress'}
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

              {statsLoading && (
                <Text style={[dm.heatmapSub, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                  Loading the real numbers…
                </Text>
              )}

              {!statsLoading && (!stats || stats.total === 0) && (
                <Text style={[dm.heatmapSub, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                  No one has logged enough days yet — be the first to set the curve.
                </Text>
              )}

              {!statsLoading && stats && stats.total > 0 && (
                <>
                  {peakBucket && (
                    <Text style={[dm.heatmapSub, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                      Most people are around{' '}
                      <Text style={{ color: theme.text, fontFamily: 'Inter_900Black' }}>
                        {peakBucket.label}
                      </Text>
                      .
                    </Text>
                  )}
                  <View style={dm.heatRows}>
                    {histogram.map((b, i) => {
                      const w        = (b.users / maxUsers) * 100;
                      const isPeak   = peakBucket != null && b.users === peakBucket.users && b.users > 0;
                      const barColor = isPeak ? theme.text : theme.text + '70';
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
                    Based on {stats.total.toLocaleString()} {stats.total === 1 ? 'participant' : 'participants'}
                    {' · '}{stats.completed} completed · {stats.active} active · {stats.abandoned} dropped
                  </Text>
                </>
              )}
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
          ) : c.status === 'completed' ? <View style={{padding:18,borderRadius:16,backgroundColor:theme.card}}><Text style={{color:theme.text,fontSize:16,fontFamily:'Inter_800ExtraBold'}}>Challenge completed</Text></View> : (
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
  title:            { fontSize: 30, letterSpacing: -0.6, lineHeight: 36 },
  statsRow:         { flexDirection: 'row', alignItems: 'stretch', borderWidth: 1, borderRadius: 16, paddingVertical: 12 },
  statCell:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 6 },
  statBig:          { fontSize: 23, letterSpacing: -0.5 },
  statLabel:        { fontSize: 11 },
  statSep:          { width: 1, height: 32 },
  section:          { gap: 8 },
  sectionLabel:     { fontSize: 18, lineHeight: 24 },
  sectionBody:      { fontSize: 15, lineHeight: 23 },
  benefitGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  benefitChip:      { width: '48%', flexGrow: 1, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12 },
  benefitDot:       { width: 5, height: 5, borderRadius: 3 },
  benefitText:      { fontSize: 13, flex: 1, lineHeight: 19 },
  participantsLine: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 },
  heatmapBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, paddingVertical: 12, borderWidth: 1, borderRadius: 14 },
  heatmapBtnText:   { fontSize: 13, flex: 0 },
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
