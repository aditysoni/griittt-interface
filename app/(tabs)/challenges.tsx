import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import { DarkBackground } from '../../components/DarkBackground';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import { challenges, Challenge } from '../../lib/api';
import { LoadingScreen } from '../../components/LoadingScreen';
import { useTheme } from '../../components/ThemeContext';

const DOMAINS = [
  { key: 'all',        label: 'ALL',        dot: '#888888' },
  { key: 'health',     label: 'HEALTH',     dot: '#34C759' },
  { key: 'food',       label: 'FOOD',       dot: '#F59E0B' },
  { key: 'discipline', label: 'DISCIPLINE', dot: '#8B5CF6' },
  { key: 'control',    label: 'CONTROL',    dot: '#EF4444' },
  { key: 'career',     label: 'CAREER',     dot: '#06B6D4' },
];

const DURATION_OPTIONS = [7, 14, 21, 30, 60, 90];

function domainDot(key: string) {
  return DOMAINS.find(d => d.key === key)?.dot ?? '#888888';
}

function domainLabel(key: string) {
  return DOMAINS.find(d => d.key === key)?.label ?? key.toUpperCase();
}

export default function ChallengesScreen() {
  const { token } = useAuth();
  const { theme } = useTheme();
  const [list, setList]         = useState<Challenge[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]     = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const [formTitle, setFormTitle]   = useState('');
  const [formDesc, setFormDesc]     = useState('');
  const [formDomain, setFormDomain] = useState('health');
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
    try { await challenges.join(token, c.id); }
    catch (err: any) {
      setList(l => l.map(x => x.id === c.id ? { ...x, joined: false, status: null } : x));
      Alert.alert('Error', err.message);
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
        title: formTitle.trim(), description: formDesc.trim() || undefined,
        domain: formDomain, durationDays: formDays,
      });
      setList(l => [created, ...l]);
      setShowCreate(false);
      setFormTitle(''); setFormDesc(''); setFormDomain('health'); setFormDays(30);
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setCreating(false); }
  }

  const filtered  = filter === 'all' ? list : list.filter(c => c.domain === filter);
  const active    = filtered.filter(c => c.status === 'active');
  const available = filtered.filter(c => !c.joined || c.status === 'abandoned');

  if (loading) return <LoadingScreen />;

  return (
    <DarkBackground><SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <View style={s.headerLeft}>
          <View style={[s.logoBox, { backgroundColor: theme.text }]} />
          <Text style={[s.logoText, { color: theme.text, fontFamily: 'Inter_900Black' }]}>GRITTT</Text>
        </View>
        <TouchableOpacity
          style={[s.createBtn, { borderColor: theme.text }]}
          onPress={() => setShowCreate(true)}
        >
          <Ionicons name="add" size={14} color={theme.text} />
          <Text style={[s.createBtnText, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>NEW</Text>
        </TouchableOpacity>
      </View>

      {/* Domain filter strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[s.filterStrip, { borderBottomColor: theme.border }]}
      >
        {DOMAINS.map(d => (
          <TouchableOpacity
            key={d.key}
            style={s.filterItem}
            onPress={() => setFilter(d.key)}
          >
            {filter === d.key && (
              <View style={[s.filterDot, { backgroundColor: d.dot }]} />
            )}
            <Text style={[
              s.filterLabel,
              { fontFamily: 'Inter_700Bold' },
              filter === d.key
                ? { color: theme.text }
                : { color: theme.textSecondary, opacity: 0.5 },
            ]}>
              {d.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />}
      >
        {/* Active */}
        {active.length > 0 && (
          <View>
            <SectionLabel label="ACTIVE" count={active.length} theme={theme} />
            {active.map(c => (
              <ActiveRow key={c.id} challenge={c} theme={theme} onAbandon={() => handleAbandon(c)} />
            ))}
          </View>
        )}

        {/* Available */}
        {available.length > 0 && (
          <View>
            <SectionLabel
              label={active.length > 0 ? 'AVAILABLE' : 'CHALLENGES'}
              count={available.length}
              theme={theme}
            />
            {available.map(c => (
              <ChallengeRow key={c.id} challenge={c} theme={theme} onJoin={() => handleJoin(c)} />
            ))}
          </View>
        )}

        {filtered.length === 0 && (
          <View style={s.empty}>
            <Text style={[s.emptyTitle, { color: theme.textSecondary, fontFamily: 'Inter_900Black' }]}>
              NO CHALLENGES
            </Text>
            <Text style={[s.emptySub, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              Create your own or pick a different category
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

            <FieldLabel label="DOMAIN" theme={theme} />
            <View style={s.domainGrid}>
              {DOMAINS.filter(d => d.key !== 'all').map(d => (
                <TouchableOpacity
                  key={d.key}
                  style={[
                    s.domainChip,
                    { borderColor: formDomain === d.key ? d.dot : theme.border },
                    formDomain === d.key && { backgroundColor: d.dot + '15' },
                  ]}
                  onPress={() => setFormDomain(d.key)}
                >
                  <View style={[s.domainDot, { backgroundColor: d.dot }]} />
                  <Text style={[
                    s.domainLabel,
                    { fontFamily: 'Inter_700Bold' },
                    formDomain === d.key ? { color: d.dot } : { color: theme.textSecondary },
                  ]}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
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

function SectionLabel({ label, count, theme }: { label: string; count: number; theme: any }) {
  return (
    <View style={[sl.row, { borderBottomColor: theme.border }]}>
      <Text style={[sl.label, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{label}</Text>
      <Text style={[sl.count, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_500Medium' }]}>
        {String(count).padStart(2, '0')}
      </Text>
    </View>
  );
}

const sl = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12, borderBottomWidth: 1 },
  label: { fontSize: 9, letterSpacing: 3 },
  count: { fontSize: 11 },
});

function ChallengeRow({ challenge: c, theme, onJoin }: { challenge: Challenge; theme: any; onJoin: () => void }) {
  const dot = domainDot(c.domain);
  return (
    <View style={[cr.row, { borderBottomColor: theme.border }]}>
      <View style={cr.left}>
        <View style={[cr.dot, { backgroundColor: dot }]} />
        <View style={cr.info}>
          <Text style={[cr.title, { color: theme.text, fontFamily: 'Inter_700Bold' }]} numberOfLines={1}>
            {c.title.toUpperCase()}
          </Text>
          <View style={cr.meta}>
            <Text style={[cr.domain, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
              {domainLabel(c.domain)}
            </Text>
            <View style={[cr.sep, { backgroundColor: theme.textSecondary }]} />
            <Text style={[cr.duration, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_500Medium' }]}>
              {c.durationDays}D
            </Text>
            {!c.isPreset && (
              <>
                <View style={[cr.sep, { backgroundColor: theme.textSecondary }]} />
                <Text style={[cr.custom, { color: dot, fontFamily: 'Inter_700Bold' }]}>CUSTOM</Text>
              </>
            )}
          </View>
          {!!c.description && (
            <Text style={[cr.desc, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]} numberOfLines={1}>
              {c.description}
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity style={[cr.joinBtn, { borderColor: theme.border }]} onPress={onJoin}>
        <Text style={[cr.joinText, { color: theme.text, fontFamily: 'Inter_900Black' }]}>START →</Text>
      </TouchableOpacity>
    </View>
  );
}

function ActiveRow({ challenge: c, theme, onAbandon }: { challenge: Challenge; theme: any; onAbandon: () => void }) {
  const dot      = domainDot(c.domain);
  const pct      = Math.min(c.daysDone / c.durationDays, 1);
  const daysLeft = Math.max(c.durationDays - c.daysDone, 0);

  return (
    <View style={[cr.row, { borderBottomColor: theme.border }]}>
      <View style={cr.left}>
        <View style={[cr.dot, { backgroundColor: dot }]} />
        <View style={[cr.info, { flex: 1 }]}>
          <Text style={[cr.title, { color: theme.text, fontFamily: 'Inter_700Bold' }]} numberOfLines={1}>
            {c.title.toUpperCase()}
          </Text>
          <View style={cr.meta}>
            <Text style={[cr.domain, { color: dot, fontFamily: 'Inter_700Bold' }]}>
              DAY {c.daysDone}/{c.durationDays}
            </Text>
            <View style={[cr.sep, { backgroundColor: theme.textSecondary }]} />
            <Text style={[cr.duration, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_500Medium' }]}>
              {daysLeft === 0 ? 'COMPLETE' : `${daysLeft}D LEFT`}
            </Text>
          </View>
          {/* Thin progress line */}
          <View style={[cr.track, { backgroundColor: theme.border }]}>
            <View style={[cr.fill, { backgroundColor: dot, width: `${Math.round(pct * 100)}%` }]} />
          </View>
        </View>
      </View>
      <TouchableOpacity onPress={onAbandon} style={cr.abandonBtn}>
        <Ionicons name="close" size={16} color={theme.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const cr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  left:     { flexDirection: 'row', alignItems: 'flex-start', gap: 14, flex: 1 },
  dot:      { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  info:     { flex: 1, gap: 4 },
  title:    { fontSize: 12, letterSpacing: 0.5 },
  meta:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  domain:   { fontSize: 9, letterSpacing: 2 },
  sep:      { width: 2, height: 2, borderRadius: 1, opacity: 0.3 },
  duration: { fontSize: 9 },
  custom:   { fontSize: 9, letterSpacing: 1 },
  desc:     { fontSize: 10, lineHeight: 14 },
  joinBtn:  { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  joinText: { fontSize: 9, letterSpacing: 2 },
  abandonBtn: { padding: 6, opacity: 0.4 },
  track:    { height: 1.5, overflow: 'hidden', marginTop: 4 },
  fill:     { height: '100%' },
});

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

const s = StyleSheet.create({
  safe:   { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 18, height: 18, borderRadius: 3 },
  logoText: { fontSize: 18, letterSpacing: -1 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  createBtnText: { fontSize: 9, letterSpacing: 2 },
  filterStrip: { paddingHorizontal: 20, paddingVertical: 14, gap: 24, borderBottomWidth: 1 },
  filterItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterDot:  { width: 5, height: 5, borderRadius: 3 },
  filterLabel: { fontSize: 9, letterSpacing: 2 },
  scroll: { paddingBottom: 40 },
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
