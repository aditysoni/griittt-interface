import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, Dimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Circle, G } from 'react-native-svg';
import { useAuth } from '../../lib/auth';
import { useTheme, AppTheme } from '../../components/ThemeContext';
import { DarkBackground } from '../../components/DarkBackground';
import { Alert } from 'react-native';
import { mirror, MirrorPayload, MirrorTrait } from '../../lib/api';

type Preview = 'forming' | 'teaser' | 'full' | undefined;

export default function MirrorScreen() {
  const { theme } = useTheme();
  const { token } = useAuth();
  const s = React.useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();

  const [data, setData] = useState<MirrorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [preview, setPreview] = useState<Preview>(undefined);
  const [horizon, setHorizon] = useState('today');
  const [unlocking, setUnlocking] = useState(false);
  const [window, setWindow] = useState<7 | 30>(7);

  const load = useCallback(async (pv: Preview, win: 7 | 30 = 7) => {
    if (!token) return;
    try {
      setError(false);
      const d = await mirror.get(token, pv, win);
      setData(d);
      if (d.projection) setHorizon(d.projection.selected || 'today');
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [token]);

  useFocusEffect(useCallback(() => { load(preview, window); }, [load, preview, window]));

  function switchWindow(w: 7 | 30) {
    setWindow(w);
    setLoading(true);
    load(preview, w);
  }

  const unlock = useCallback(async () => {
    if (!token) return;
    setUnlocking(true);
    try {
      await mirror.setPremium(token, true);
      await load(preview === 'teaser' ? 'full' : undefined); // reveal the full Mirror
    } catch { Alert.alert('Unlock', 'Could not unlock right now.'); }
    finally { setUnlocking(false); }
  }, [token, load, preview]);

  return (
    <DarkBackground>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.topBar}>
          <Text style={s.eyebrow}>
            {data?.state === 'forming' ? 'MIRROR' : `MIRROR · LAST ${window} DAYS`}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {/* Weekly / Monthly toggle */}
            {data?.state !== 'forming' && (
              <View style={[s.windowToggle, { backgroundColor: theme.surfaceStrong }]}>
                <Pressable
                  style={[s.windowBtn, window === 7 && { backgroundColor: theme.inverse }]}
                  onPress={() => switchWindow(7)}
                >
                  <Text style={[s.windowBtnText, { color: window === 7 ? theme.inverseText : theme.textSecondary }]}>7D</Text>
                </Pressable>
                <Pressable
                  style={[s.windowBtn, window === 30 && { backgroundColor: theme.inverse }]}
                  onPress={() => switchWindow(30)}
                >
                  <Text style={[s.windowBtnText, { color: window === 30 ? theme.inverseText : theme.textSecondary }]}>30D</Text>
                </Pressable>
              </View>
            )}
            {data?.state !== 'forming' && data?.hero && (
              <View style={[s.badge, { backgroundColor: data.state === 'full' ? theme.accent : theme.surfaceStrong }]}>
                <Text style={[s.badgeText, { color: data.state === 'full' ? theme.accentText : theme.textSecondary }]}>
                  {data.state === 'full' ? 'PREMIUM' : 'FREE'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Dev-only state switcher */}
        {__DEV__ && (
          <View style={s.devRow}>
            {(['forming', 'teaser', 'full'] as const).map(p => (
              <Pressable key={p} onPress={() => { setPreview(p); setLoading(true); }}
                style={[s.devChip, preview === p && { backgroundColor: theme.accent }]}>
                <Text style={[s.devChipText, preview === p && { color: theme.accentText }]}>{p}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {loading ? (
          <View style={s.center}><ActivityIndicator color={theme.accent} /></View>
        ) : error || !data ? (
          <View style={s.center}>
            <Text style={s.dim}>Couldn’t load your Mirror.</Text>
            <Pressable onPress={() => { setLoading(true); load(preview); }} style={s.retry}>
              <Text style={s.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : data.state === 'forming' ? (
          <Forming data={data} theme={theme} s={s} />
        ) : data.state === 'teaser' ? (
          <Teaser data={data} theme={theme} s={s} onUpgrade={unlock} unlocking={unlocking} />
        ) : (
          <Full data={data} theme={theme} s={s} horizon={horizon} setHorizon={setHorizon} />
        )}
      </ScrollView>
    </DarkBackground>
  );
}

// ── FORMING ─────────────────────────────────────────────────────────────────
function Forming({ data, theme, s }: any) {
  const f = data.forming!;
  return (
    <View style={{ alignItems: 'center', paddingTop: 40 }}>
      <Ring pct={f.pct} size={190} theme={theme} label={`${f.pct}%`} sub="FORMING" />
      <Text style={[s.h1, { marginTop: 30, textAlign: 'center' }]}>Your Mirror is{'\n'}still forming</Text>
      <Text style={[s.body, { textAlign: 'center', marginTop: 14, maxWidth: 300 }]}>
        Keep logging. In <Text style={{ color: theme.text, fontFamily: 'Inter_700Bold' }}>{Math.max(0, f.daysNeeded - f.daysLogged)} more day{f.daysNeeded - f.daysLogged === 1 ? '' : 's'}</Text> it has enough to show you who you’re becoming.
      </Text>
      <View style={[s.card, { marginTop: 28, width: '100%' }]}>
        <Text style={s.mono}>DAYS LOGGED</Text>
        <Text style={[s.bigNum, { marginTop: 4 }]}>{f.daysLogged}<Text style={s.dimBig}> / {f.daysNeeded}</Text></Text>
        <Text style={[s.body, { marginTop: 10 }]}>{f.message}</Text>
      </View>
      <Text style={[s.footer, { marginTop: 24 }]}>every day you log is a brushstroke.</Text>
    </View>
  );
}

// ── TEASER ──────────────────────────────────────────────────────────────────
function Teaser({ data, theme, s, onUpgrade, unlocking }: any) {
  return (
    <View>
      <Hero hero={data.hero} theme={theme} s={s} />
      <SectionLabel s={s}>IDENTITY TAKING SHAPE</SectionLabel>
      {data.teaserTrait && <TraitRow t={data.teaserTrait} theme={theme} s={s} rank={`1 OF ${data.traitCount ?? 5}`} />}
      <View style={[s.card, s.lockCard, { marginTop: 20 }]}>
        <Text style={[s.h2, { textAlign: 'center' }]}>See the full picture</Text>
        <Text style={[s.body, { textAlign: 'center', marginTop: 8 }]}>
          Your five traits, consistency map, and the 30 / 90 / 180-day projection are part of Mirror Premium.
        </Text>
        <Pressable style={[s.cta, { marginTop: 18 }, unlocking && { opacity: 0.6 }]} onPress={onUpgrade} disabled={unlocking}>
          <Text style={s.ctaText}>{unlocking ? 'Unlocking…' : 'See who you’re becoming'}</Text>
        </Pressable>
        <Text style={[s.mono, { marginTop: 10 }]}>DEV: FREE UNLOCK · BILLING LATER</Text>
      </View>
    </View>
  );
}

// ── FULL ────────────────────────────────────────────────────────────────────
function Full({ data, theme, s, horizon, setHorizon }: any) {
  const d: MirrorPayload = data;
  const sel = d.projection?.horizons.find(h => h.k === horizon) ?? d.projection?.horizons[0];
  return (
    <View>
      <Hero hero={d.hero} theme={theme} s={s} />

      {/* Stat trio */}
      <View style={s.trio}>
        <Stat s={s} theme={theme} big={`${d.stats!.streak.current}`} unit="DAY STREAK" note={`Best yet: ${d.stats!.streak.best}`} />
        <Stat s={s} theme={theme} big={`${d.stats!.perfectDays.count}`} unit={`/${d.stats!.perfectDays.of} PERFECT`} note={deltaNote(d.stats!.perfectDays.delta)} />
        {d.stats!.bounceBack
          ? <Stat s={s} theme={theme} big={`~${d.stats!.bounceBack.days}`} unit="BOUNCE-BACK" note={d.stats!.bounceBack.was ? `Was ${d.stats!.bounceBack.was}d` : d.stats!.bounceBack.caption} />
          : <Stat s={s} theme={theme} big={`${d.hero!.chips.consistency}%`} unit="CONSISTENT" note=" " />}
      </View>

      {/* Self-score */}
      <View style={[s.card, { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <View>
          <Text style={s.mono}>OVERALL SELF-SCORE</Text>
          <Text style={[s.body, { marginTop: 2 }]}>{d.selfScore!.caption}</Text>
          <Text style={[s.deltaPill, { color: d.selfScore!.deltaVsLastMonth >= 0 ? theme.success : theme.danger, marginTop: 8 }]}>
            {d.selfScore!.deltaVsLastMonth >= 0 ? '↑ +' : '↓ '}{Math.abs(d.selfScore!.deltaVsLastMonth)} vs last mo.
          </Text>
        </View>
        <Ring pct={d.selfScore!.value} size={104} theme={theme} label={`${d.selfScore!.value}`} sub="" />
      </View>

      {/* Traits */}
      <SectionLabel s={s} right="TAP FOR RECEIPTS">IDENTITY TAKING SHAPE</SectionLabel>
      {d.traits!.map(t => <TraitRow key={t.key} t={t} theme={theme} s={s} />)}

      {/* Consistency heatmap */}
      <SectionLabel s={s}>ARE YOU CONSISTENT?</SectionLabel>
      <View style={s.card}>
        <Text style={s.body}>Only {d.consistency!.offDays} off-day{d.consistency!.offDays === 1 ? '' : 's'} in {d.consistency!.days.length}.</Text>
        <Heatmap days={d.consistency!.days} theme={theme} s={s} />
        <View style={s.legendRow}>
          <Text style={s.mono}>less</Text>
          <Text style={s.mono}>more</Text>
        </View>
      </View>

      {/* Build vs Control */}
      <SectionLabel s={s}>BUILD vs CONTROL</SectionLabel>
      <View style={s.card}>
        <Bar label="Building good habits" value={d.buildControl!.build} theme={theme} s={s} />
        <View style={{ height: 14 }} />
        <Bar label="Resisting the vices" value={d.buildControl!.control} theme={theme} s={s} />
      </View>

      {/* Projection */}
      <SectionLabel s={s}>WHERE THIS IS HEADING</SectionLabel>
      <View style={s.card}>
        <View style={{ alignItems: 'center', paddingVertical: 6 }}>
          <Text style={s.bigNum}>{sel?.score}</Text>
          <Text style={s.mono}>SELF-SCORE</Text>
          <Text style={[s.body, { marginTop: 4 }]}>{sel?.caption}</Text>
        </View>
        <View style={s.horizonRow}>
          {d.projection!.horizons.map(h => (
            <Pressable key={h.k} onPress={() => setHorizon(h.k)}
              style={[s.horizonChip, horizon === h.k && { backgroundColor: theme.inverse }]}>
              <Text style={[s.horizonText, { color: horizon === h.k ? theme.inverseText : theme.textSecondary }]}>{h.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Risks */}
      {d.risks!.length > 0 && d.risks!.map((r, i) => (
        <View key={i} style={[s.card, s.riskCard, { marginTop: 14 }]}>
          <Text style={s.h2}>{r.title}</Text>
          <Text style={[s.body, { marginTop: 6 }]}>{r.body}</Text>
          <View style={[s.tag, { marginTop: 12 }]}><Text style={s.tagText}>{r.fix}</Text></View>
        </View>
      ))}

      {/* Recommendations */}
      {d.recommendations!.map((r, i) => (
        <View key={i} style={[s.card, { marginTop: 14 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[s.h2, { flex: 1 }]}>{r.title}</Text>
            <Text style={[s.impact, { color: theme.accentText, backgroundColor: theme.accent }]}>{r.impact}</Text>
          </View>
          <Text style={[s.body, { marginTop: 6 }]}>{r.why}</Text>
        </View>
      ))}

      <Text style={[s.footer, { marginTop: 24 }]}>your reflection updates every morning.</Text>
    </View>
  );
}

// ── shared pieces ─────────────────────────────────────────────────────────────

const OUTLOOK_LABEL: Record<string, string> = {
  up:   'TRENDING UP',
  flat: 'HOLDING STEADY',
  down: 'NEEDS ATTENTION',
};
const OUTLOOK_COLOR: Record<string, string> = {
  up:   '#B8F23A',
  flat: '#F0A12E',
  down: '#E84A4A',
};

function Hero({ hero, theme }: any) {
  const outlookLabel = OUTLOOK_LABEL[hero.outlook] ?? 'TRENDING UP';
  const outlookColor = OUTLOOK_COLOR[hero.outlook] ?? '#B8F23A';
  const deltaPositive = (hero.selfScoreDelta ?? 0) >= 0;

  return (
    <View style={hc.card}>
      {/* Top eyebrow row */}
      <View style={hc.topRow}>
        <Text style={hc.eyebrow}>YOU ARE BECOMING</Text>
        <View style={[hc.statusBadge, { backgroundColor: outlookColor }]}>
          <Text style={hc.statusText}>{outlookLabel}</Text>
        </View>
      </View>

      {/* Main identity title */}
      <Text style={hc.archetype}>{hero.archetype}</Text>

      {/* Supporting quote */}
      <Text style={hc.becoming}>"{hero.becoming}"</Text>

      {/* Divider */}
      <View style={hc.divider} />

      {/* Score + trend row */}
      <View style={hc.scoreRow}>
        <View>
          <Text style={hc.scoreNum}>{hero.selfScore ?? hero.chips.momentum}</Text>
          <Text style={hc.scoreLabel}>CURRENT SCORE</Text>
        </View>
        <View style={hc.trendWrap}>
          <Text style={[hc.trendDelta, { color: deltaPositive ? '#B8F23A' : '#E84A4A' }]}>
            {deltaPositive ? '+' : ''}{hero.selfScoreDelta ?? 0} this month
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View style={hc.divider} />

      {/* Bottom row — streak */}
      <View style={hc.bottomRow}>
        <Text style={hc.streakText}>🔥 {hero.chips.streak} Day Streak</Text>
        <Text style={[hc.consistencyText, { color: 'rgba(245,241,232,0.45)' }]}>
          {hero.chips.consistency}% consistent
        </Text>
      </View>
    </View>
  );
}

const hc = StyleSheet.create({
  card: {
    backgroundColor: '#14110D',
    borderRadius: 24,
    padding: 24,
    marginTop: 18,
    borderWidth: 1,
    borderColor: 'rgba(184,242,58,0.15)',
  },
  topRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  eyebrow:     { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 10, letterSpacing: 2.5, color: 'rgba(245,241,232,0.40)' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusText:  { fontFamily: 'Inter_800ExtraBold', fontSize: 9, letterSpacing: 1.5, color: '#14110D' },
  archetype:   { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 38, lineHeight: 42, letterSpacing: -1, color: '#F5F1E8', marginBottom: 14 },
  becoming:    { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 23, color: 'rgba(245,241,232,0.60)', fontStyle: 'italic' },
  divider:     { height: 1, backgroundColor: 'rgba(245,241,232,0.08)', marginVertical: 20 },
  scoreRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  scoreNum:    { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 52, lineHeight: 52, color: '#F5F1E8', letterSpacing: -2 },
  scoreLabel:  { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 9, letterSpacing: 2, color: 'rgba(245,241,232,0.35)', marginTop: 4 },
  trendWrap:   { alignItems: 'flex-end', paddingBottom: 8 },
  trendDelta:  { fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: 0.3 },
  bottomRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  streakText:  { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#F5F1E8', letterSpacing: 0.2 },
  consistencyText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
});
const Stat = ({ s, theme, big, unit, note }: any) => (
  <View style={[s.card, s.statCard]}>
    <Text style={s.statBig}>{big}</Text>
    <Text style={s.mono}>{unit}</Text>
    <Text style={[s.statNote, { color: theme.textTertiary }]} numberOfLines={1}>{note}</Text>
  </View>
);
const SectionLabel = ({ s, children, right }: any) => (
  <View style={s.sectionRow}>
    <Text style={s.sectionLabel}>{children}</Text>
    {right ? <Text style={s.sectionRight}>{right}</Text> : null}
  </View>
);
function TraitRow({ t, theme, s, rank }: { t: MirrorTrait; theme: AppTheme; s: any; rank?: string }) {
  const col = t.score >= 67 ? theme.success : t.score >= 34 ? theme.warning : theme.danger;
  return (
    <View style={[s.card, { marginTop: 10 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={s.traitName}>{rank ? `${rank}  ·  ` : ''}{t.name}</Text>
        <Text style={[s.traitDelta, { color: t.delta > 0 ? theme.success : t.delta < 0 ? theme.danger : theme.textTertiary }]}>{t.deltaText}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 }}>
        <Text style={[s.traitScore, { color: col }]}>{t.score}</Text>
        <View style={{ flex: 1, marginLeft: 12, marginBottom: 6 }}>
          <View style={[s.track, { backgroundColor: theme.surfaceStrong }]}>
            <View style={[s.fill, { width: `${Math.max(3, t.score)}%`, backgroundColor: col }]} />
          </View>
        </View>
      </View>
      <Text style={[s.body, { marginTop: 6 }]}>{t.evidence}</Text>
    </View>
  );
}
function Bar({ label, value, theme, s }: any) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={s.body}>{label}</Text>
        <Text style={[s.traitName]}>{value}</Text>
      </View>
      <View style={[s.track, { backgroundColor: theme.surfaceStrong }]}>
        <View style={[s.fill, { width: `${Math.max(3, value)}%`, backgroundColor: theme.accent }]} />
      </View>
    </View>
  );
}
function Heatmap({ days, theme, s }: { days: { date: string; score: number }[]; theme: AppTheme; s: any }) {
  const cell = (score: number) => {
    if (score <= 0) return theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(20,17,13,0.06)';
    const t = Math.min(1, score / 100);
    // muted → lime
    const r = Math.round(0x2E + (0xB8 - 0x2E) * t);
    const g = Math.round(0x3A + (0xF2 - 0x3A) * t);
    const b = Math.round(0x17 + (0x3A - 0x17) * t);
    return `rgb(${r},${g},${b})`;
  };
  return (
    <View style={s.heatWrap}>
      {days.map((d, i) => (
        <View key={i} style={[s.heatCell, { backgroundColor: cell(d.score) }]} />
      ))}
    </View>
  );
}
function Ring({ pct, size, theme, label, sub }: any) {
  const stroke = 12, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct)) / 100;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.surfaceStrong} strokeWidth={stroke} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.accent} strokeWidth={stroke} fill="none"
            strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} />
        </G>
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: size * 0.28, color: theme.text }}>{label}</Text>
        {sub ? <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 10, letterSpacing: 2, color: theme.textTertiary }}>{sub}</Text> : null}
      </View>
    </View>
  );
}
const deltaNote = (d: number) => (d > 0 ? `↑ +${d} vs last mo.` : d < 0 ? `↓ ${d} vs last mo.` : 'same as last mo.');

function makeStyles(t: AppTheme) {
  return StyleSheet.create({
    scroll: { paddingHorizontal: 18, paddingTop: 64, paddingBottom: 60 },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    eyebrow: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, letterSpacing: 2, color: t.textTertiary },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontFamily: 'Inter_800ExtraBold', fontSize: 9, letterSpacing: 1 },
    windowToggle:   { flexDirection: 'row', borderRadius: 10, padding: 2, gap: 2 },
    windowBtn:      { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
    windowBtnText:  { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1 },
    devRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
    devChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: t.surfaceStrong },
    devChipText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: t.textSecondary },
    center: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 14 },
    dim: { color: t.textSecondary, fontFamily: 'Inter_500Medium' },
    retry: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: t.accent },
    retryText: { color: t.accentText, fontFamily: 'Inter_800ExtraBold' },

    card: { backgroundColor: t.card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: t.border },
    heroCard: { marginTop: 18, backgroundColor: t.cardElevated },
    lockCard: { alignItems: 'center', borderStyle: 'dashed', borderColor: t.borderStrong },
    riskCard: { borderColor: t.danger + '55' },

    mono: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 10, letterSpacing: 1.6, color: t.textTertiary },
    archetype: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 40, lineHeight: 42, letterSpacing: -1, color: t.text, marginTop: 8 },
    body: { fontFamily: 'Inter_400Regular', fontSize: 14.5, lineHeight: 21, color: t.textSecondary },
    footer: { fontFamily: 'Inter_500Medium', fontSize: 12, color: t.textTertiary, textAlign: 'center', fontStyle: 'italic' },

    outlookPill: { alignSelf: 'flex-start', backgroundColor: t.accent + '22', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    outlookText: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 10, letterSpacing: 1, color: t.isDark ? t.accent : '#4C5A17' },

    chipRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
    chip: { flex: 1, backgroundColor: t.surface, borderRadius: 14, padding: 11 },
    chipV: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 18, color: t.text },
    chipK: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 8.5, letterSpacing: 0.8, color: t.textTertiary, marginTop: 2 },

    trio: { flexDirection: 'row', gap: 8, marginTop: 16 },
    statCard: { flex: 1, padding: 13 },
    statBig: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 30, color: t.text },
    statNote: { fontFamily: 'Inter_500Medium', fontSize: 10, marginTop: 4 },

    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, marginBottom: 4 },
    sectionLabel: { fontFamily: 'Inter_800ExtraBold', fontSize: 12, letterSpacing: 1.4, color: t.text },
    sectionRight: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 9, letterSpacing: 1, color: t.textTertiary },

    traitName: { fontFamily: 'Inter_700Bold', fontSize: 14, color: t.text },
    traitDelta: { fontFamily: 'Inter_700Bold', fontSize: 13 },
    traitScore: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 34, lineHeight: 34 },
    track: { height: 8, borderRadius: 4, overflow: 'hidden' },
    fill: { height: 8, borderRadius: 4 },

    heatWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 14 },
    heatCell: { width: 22, height: 22, borderRadius: 5 },
    legendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },

    bigNum: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 52, color: t.text },
    dimBig: { color: t.textTertiary },
    deltaPill: { fontFamily: 'Inter_700Bold', fontSize: 12 },

    horizonRow: { flexDirection: 'row', gap: 6, marginTop: 16 },
    horizonChip: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: t.surface },
    horizonText: { fontFamily: 'Inter_700Bold', fontSize: 10.5, letterSpacing: 0.3 },

    tag: { alignSelf: 'flex-start', backgroundColor: t.surfaceStrong, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
    tagText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: t.text },
    impact: { fontFamily: 'Inter_800ExtraBold', fontSize: 11, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },

    h1: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 30, lineHeight: 34, color: t.text },
    h2: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 18, color: t.text },
    cta: { backgroundColor: t.accent, paddingVertical: 15, paddingHorizontal: 22, borderRadius: 14, alignSelf: 'stretch', alignItems: 'center' },
    ctaText: { fontFamily: 'Inter_800ExtraBold', fontSize: 15, color: t.accentText },
  });
}
