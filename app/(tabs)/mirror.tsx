import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Path, Circle, G } from 'react-native-svg';
import { useAuth } from '../../lib/auth';
import {
  mirror as mirrorApi,
  MirrorPayload,
  MirrorTrait,
  MirrorHorizon,
  MirrorForming,
  MirrorHero,
} from '../../lib/api';
import { PREVIEW, PREVIEW_MIRROR_STATE, previewMirror } from '../../lib/preview';

const SW = Dimensions.get('window').width;

// Parchment palette — matches The Mirror HTML design
const C = {
  bg:          '#ECE8DC',
  bgCard:      '#FBF9F2',
  bgDeep:      '#EAE4D4',
  ink:         '#14110D',
  inkMid:      '#4A4338',
  inkLight:    '#7A7264',
  inkMuted:    '#8A8272',
  border:      '#E7E1D1',
  borderDark:  '#D8D0BC',
  lime:        '#B8F23A',
  limeDim:     '#9BD12A',
  limeText:    '#14110D',
  limeGreen:   '#5E9D27',
  greenPill:   '#E4F0D0',
  greenDark:   '#4C8A3A',
  amber:       '#D9982B',
  amberDark:   '#9A6B14',
  amberPill:   '#F3E1BC',
  dark:        '#14110D',
};

// ── Root screen ───────────────────────────────────────────────────────────────

export default function MirrorScreen() {
  const { token }    = useAuth();
  const [data,       setData]       = useState<MirrorPayload | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [selHorizon, setSelHorizon] = useState('today');

  function load() {
    if (PREVIEW) {
      const d = previewMirror(PREVIEW_MIRROR_STATE);
      setData(d);
      if (d.state === 'full') setSelHorizon(d.projection.selected ?? 'today');
      setLoading(false); setError(null);
      return;
    }
    if (!token) return;
    setLoading(true); setError(null);
    mirrorApi.get(token)
      .then(d => {
        setData(d);
        if (d.state === 'full') setSelHorizon(d.projection.selected ?? 'today');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [token]);

  const windowDays = data?.state === 'full' ? (data as any).windowDays ?? 30 : 30;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Text style={s.headerKicker}>
          MIRROR · {data?.state === 'full' ? `LAST ${windowDays} DAYS` : 'YOUR REFLECTION'}
        </Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.inkMuted} />
          <Text style={s.loadingText}>Reading your patterns...</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={load} activeOpacity={0.8}>
            <Text style={s.retryText}>TRY AGAIN</Text>
          </TouchableOpacity>
        </View>
      ) : data?.state === 'forming' ? (
        <FormingView forming={data.forming} />
      ) : data?.state === 'teaser' ? (
        <TeaserView data={data as Extract<MirrorPayload, { state: 'teaser' }>} />
      ) : data?.state === 'full' ? (
        <FullView
          data={data as Extract<MirrorPayload, { state: 'full' }>}
          selHorizon={selHorizon}
          setSelHorizon={setSelHorizon}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ── FORMING state ─────────────────────────────────────────────────────────────

function FormingView({ forming }: { forming: MirrorForming }) {
  const r = 72, cx = 84, cy = 84;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - forming.pct / 100);
  const daysLeft = forming.daysNeeded - forming.daysLogged;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.formingScroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Circular progress arc */}
      <View style={s.arcWrap}>
        <Svg width={168} height={168}>
          {/* Dashed track */}
          <Circle
            cx={cx} cy={cy} r={r}
            fill="none" stroke={C.borderDark}
            strokeWidth={10} strokeDasharray="3 9" strokeLinecap="round"
          />
          {/* Progress arc, starts at 12 o'clock */}
          <G rotation="-90" origin={`${cx}, ${cy}`}>
            <Circle
              cx={cx} cy={cy} r={r}
              fill="none" stroke={C.lime} strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={`${circ}`}
              strokeDashoffset={`${dashOffset}`}
            />
          </G>
        </Svg>
        {/* Center label overlay */}
        <View style={s.arcCenter} pointerEvents="none">
          <Text style={s.arcPct}>{Math.round(forming.pct)}%</Text>
          <Text style={s.arcLabel}>DONE</Text>
        </View>
      </View>

      <Text style={s.formingHead}>Your Mirror is{'\n'}still forming.</Text>
      <Text style={s.formingDesc}>
        Keep logging. In {daysLeft} more {daysLeft === 1 ? 'day' : 'days'} it has enough
        {'\n'}data to reflect who you're becoming.
      </Text>

      {/* Days progress card */}
      <View style={s.formingCard}>
        <View style={s.formingCardRow}>
          <View>
            <Text style={s.formingCardLabel}>DAYS LOGGED</Text>
            <Text style={s.formingCardNum}>{forming.daysLogged} / {forming.daysNeeded}</Text>
          </View>
          <View style={s.formingDots}>
            {Array.from({ length: forming.daysNeeded }).map((_, i) => (
              <View
                key={i}
                style={[s.formingDot, i < forming.daysLogged && s.formingDotFilled]}
              />
            ))}
          </View>
        </View>
      </View>

      {forming.streakDays > 0 && (
        <Text style={s.formingStreak}>🔥 {forming.streakDays}-day streak — keep going</Text>
      )}

      <Text style={s.handwritten}>your reflection is taking shape.</Text>
      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

// ── TEASER state ──────────────────────────────────────────────────────────────

function TeaserView({ data }: { data: Extract<MirrorPayload, { state: 'teaser' }> }) {
  const { hero, teaserTrait, traitCount } = data;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
    >
      <HeroCard hero={hero} />

      <SectionHeader text="IDENTITY TAKING SHAPE" sub="TAP FOR RECEIPTS" />
      <View style={s.card}>
        <TraitRow trait={teaserTrait} />
      </View>

      {/* Locked section */}
      <View style={s.lockedWrap}>
        {/* Fake faded rows behind overlay */}
        <View style={s.lockedFakeRows} pointerEvents="none">
          {[70, 58, 45].map((w, i) => (
            <View key={i} style={s.lockedFakeRow}>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={[s.lockedFakeBar, { width: `${w}%` as any }]} />
                <View style={[s.lockedFakeBar, { width: `${w - 20}%` as any, height: 5 }]} />
              </View>
              <View style={s.lockedFakeScore} />
            </View>
          ))}
        </View>

        {/* Gradient + lock overlay */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <View style={s.lockedGradTop} />
        </View>
        <View style={s.lockedOverlay}>
          <View style={s.lockedBox}>
            <View style={s.lockedIconWrap}>
              <Ionicons name="lock-closed" size={22} color={C.ink} />
            </View>
            <Text style={s.lockedTitle}>{traitCount - 1} more traits hidden</Text>
            <Text style={s.lockedBody}>
              Unlock the full Mirror to see your complete identity, 6-month
              projection, and what habits to fix first.
            </Text>
            <TouchableOpacity style={s.unlockBtn} activeOpacity={0.85}>
              <Text style={s.unlockBtnText}>SEE WHO YOU'RE BECOMING</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

// ── FULL state ────────────────────────────────────────────────────────────────

function FullView({
  data,
  selHorizon,
  setSelHorizon,
}: {
  data: Extract<MirrorPayload, { state: 'full' }>;
  selHorizon: string;
  setSelHorizon: (k: string) => void;
}) {
  const { hero, selfScore, stats, traits, consistency, buildControl, projection, risks, recommendations, windowDays } = data;
  const activeHorizon = projection.horizons.find(h => h.k === selHorizon) ?? projection.horizons[0];
  const delta = selfScore.deltaVsLastMonth;
  const deltaText = `${delta >= 0 ? '+' : ''}${delta} VS LAST MO.`;

  function cellColor(score: number): string {
    if (score === 0) return C.bgDeep;
    if (score <= 25) return '#D3E6AF';
    if (score <= 50) return '#ADD473';
    if (score <= 75) return '#84BD3D';
    return C.limeGreen;
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero identity card */}
      <HeroCard hero={hero} />

      {/* Glance stats — 3 col */}
      <View style={s.statsGrid}>
        <View style={s.statCard}>
          <Text style={s.statBig}>{stats.streak.current}</Text>
          <Text style={s.statSub}>DAY STREAK</Text>
          <Text style={s.statHint}>Best: {stats.streak.best}</Text>
        </View>
        <View style={[s.statCard, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.border, borderRadius: 0 }]}>
          <Text style={s.statBig}>
            {stats.perfectDays.count}
            <Text style={s.statBigOf}>/{stats.perfectDays.of}</Text>
          </Text>
          <Text style={s.statSub}>PERFECT DAYS</Text>
          <Text style={s.statHint}>{stats.perfectDays.delta}</Text>
        </View>
        {stats.bounceBack ? (
          <View style={s.statCard}>
            <Text style={s.statBig}>~{stats.bounceBack.days}<Text style={s.statBigUnit}>d</Text></Text>
            <Text style={s.statSub}>BOUNCE-BACK</Text>
            <Text style={s.statHint}>was {stats.bounceBack.was}d</Text>
          </View>
        ) : (
          <View style={s.statCard}>
            <Text style={s.statBig}>{selfScore.value}</Text>
            <Text style={s.statSub}>SELF SCORE</Text>
            <Text style={s.statHint}>{deltaText}</Text>
          </View>
        )}
      </View>

      {/* Trend card */}
      <View style={[s.card, s.trendCard]}>
        <View style={s.trendLeft}>
          <Text style={s.trendTitle}>You're getting{'\n'}better.</Text>
          <View style={s.trendDeltaPill}>
            <Text style={s.trendDeltaText}>{deltaText}</Text>
          </View>
        </View>
        <TrendSparkline />
      </View>

      {/* Identity traits */}
      <SectionHeader text="IDENTITY TAKING SHAPE" sub="TAP FOR RECEIPTS" />
      <View style={s.card}>
        {traits.map((t, i) => (
          <React.Fragment key={t.key}>
            {i > 0 && <View style={s.divider} />}
            <TraitRow trait={t} />
          </React.Fragment>
        ))}
      </View>

      {/* Consistency heatmap */}
      <SectionHeader text="ARE YOU CONSISTENT?" />
      <View style={s.card}>
        <Text style={s.cardTitle}>Only {consistency.offDays} off-days in {windowDays}.</Text>
        <Text style={s.cardBody}>Each square is a day. Green = you showed up.</Text>
        <View style={{ marginTop: 14 }}>
          <HeatmapGrid days={consistency.days} cellColor={cellColor} />
        </View>
        <View style={s.heatLegend}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: C.limeGreen }]} />
            <Text style={s.legendText}>Active</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: C.bgDeep }]} />
            <Text style={s.legendText}>Off day</Text>
          </View>
        </View>
      </View>

      {/* Build vs Control */}
      <SectionHeader text="BUILD VS CONTROL" />
      <View style={s.card}>
        <BuildBar label="BUILD" value={buildControl.build} color={C.limeGreen} />
        <View style={{ height: 16 }} />
        <BuildBar label="CONTROL" value={buildControl.control} color={C.amber} />
      </View>

      {/* Projection */}
      <SectionHeader text="WHERE THIS IS HEADING" />
      <View style={s.card}>
        <View style={s.pillRow}>
          {projection.horizons.map(h => (
            <TouchableOpacity
              key={h.k}
              onPress={() => setSelHorizon(h.k)}
              style={[s.pill, selHorizon === h.k && s.pillActive]}
              activeOpacity={0.8}
            >
              <Text style={[s.pillText, selHorizon === h.k && s.pillTextActive]}>{h.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.horizonDisplay}>
          <Text style={s.horizonScore}>{activeHorizon.score}</Text>
          <Text style={s.horizonCaption}>{activeHorizon.caption}</Text>
        </View>
        <ProjectionChart horizons={projection.horizons} selected={selHorizon} />
      </View>

      {/* Risk card */}
      {risks.length > 0 && (
        <>
          <SectionHeader text="WATCH OUT" />
          <View style={[s.card, s.riskCard]}>
            <View style={s.riskIconRow}>
              <Ionicons name="warning" size={17} color={C.amberDark} />
              <Text style={s.riskTitle}>{risks[0].title}</Text>
            </View>
            <Text style={s.riskBody}>{risks[0].body}</Text>
            <TouchableOpacity style={s.riskFixBtn} activeOpacity={0.85}>
              <Text style={s.riskFixText}>Fix → {risks[0].fix}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Recommendation card */}
      {recommendations.length > 0 && (
        <>
          <SectionHeader text="WHAT TO DO" />
          <View style={[s.card, s.recCard]}>
            <View style={s.recHeader}>
              <Text style={s.recTitle}>{recommendations[0].title}</Text>
              <View style={s.recImpactPill}>
                <Text style={s.recImpact}>{recommendations[0].impact}</Text>
              </View>
            </View>
            <Text style={s.recWhy}>{recommendations[0].why}</Text>
            <TouchableOpacity style={s.recBtn} activeOpacity={0.85}>
              <Text style={s.recBtnText}>ADD TO TODAY</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <Text style={s.handwritten}>your reflection updates every morning.</Text>
      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function HeroCard({ hero }: { hero: MirrorHero }) {
  const outlookIcon =
    hero.outlook === 'up' ? 'trending-up' : hero.outlook === 'flat' ? 'remove' : 'trending-down';
  const outlookLabel =
    hero.outlook === 'up' ? 'TRENDING UP' : hero.outlook === 'flat' ? 'STEADY' : 'WATCH THIS';

  return (
    <View style={s.heroCard}>
      <Text style={s.heroEyebrow}>YOU ARE BECOMING</Text>
      <Text style={s.heroArchetype}>{hero.archetype}</Text>
      <Text style={s.heroBecoming}>{hero.becoming}</Text>
      <View style={s.heroPill}>
        <Ionicons name={outlookIcon} size={10} color={C.lime} />
        <Text style={s.heroPillText}>OUTLOOK · {outlookLabel}</Text>
      </View>
      <View style={s.heroChips}>
        <HeroChip label="MOMENTUM" value={`${hero.chips.momentum}%`} />
        <View style={s.heroChipDiv} />
        <HeroChip label="CONSISTENCY" value={`${hero.chips.consistency}%`} />
        <View style={s.heroChipDiv} />
        <HeroChip label="STREAK" value={`🔥 ${hero.chips.streak}`} />
      </View>
    </View>
  );
}

function HeroChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.heroChip}>
      <Text style={s.heroChipVal}>{value}</Text>
      <Text style={s.heroChipLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ text, sub }: { text: string; sub?: string }) {
  return (
    <View style={s.sectionHeaderWrap}>
      <Text style={s.sectionHeader}>{text}</Text>
      {sub && <Text style={s.sectionHeaderSub}>{sub}</Text>}
    </View>
  );
}

function TraitRow({ trait }: { trait: MirrorTrait }) {
  const isPos = trait.delta > 0;
  const isNeg = trait.delta < 0;
  const pillBg    = isPos ? C.greenPill : isNeg ? C.amberPill : C.bgDeep;
  const pillColor = isPos ? C.greenDark : isNeg ? C.amberDark : C.inkLight;
  const barColor  = isPos ? C.limeGreen : isNeg ? C.amber     : C.inkLight;

  return (
    <View style={s.traitRow}>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={s.traitTopRow}>
          <Text style={s.traitName}>{trait.name}</Text>
          <View style={[s.traitDeltaPill, { backgroundColor: pillBg }]}>
            <Text style={[s.traitDeltaText, { color: pillColor }]}>{trait.deltaText}</Text>
          </View>
        </View>
        <View style={s.traitTrack}>
          <View style={[s.traitFill, { width: `${trait.score}%` as any, backgroundColor: barColor }]} />
        </View>
        <Text style={s.traitEvidence}>{trait.evidence}</Text>
      </View>
      <Text style={s.traitScore}>{trait.score}</Text>
    </View>
  );
}

function BuildBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View>
      <View style={s.buildBarTop}>
        <Text style={s.buildLabel}>{label}</Text>
        <Text style={[s.buildValue, { color }]}>{value}</Text>
      </View>
      <View style={s.buildTrack}>
        <View style={[s.buildFill, { width: `${value}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function HeatmapGrid({ days, cellColor }: { days: { date: string; score: number }[]; cellColor: (s: number) => string }) {
  const cols = 6;
  const cellSz = Math.floor((SW - 64 - (cols - 1) * 6) / cols);
  const rows = Math.ceil(days.length / cols);
  return (
    <View style={{ gap: 6 }}>
      {Array.from({ length: rows }).map((_, row) => (
        <View key={row} style={{ flexDirection: 'row', gap: 6 }}>
          {days.slice(row * cols, row * cols + cols).map((d, col) => (
            <View
              key={col}
              style={{ width: cellSz, height: cellSz, borderRadius: 6, backgroundColor: cellColor(d.score) }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function TrendSparkline() {
  const w = (SW - 64) / 2;
  const h = 64;
  const pts: [number, number][] = [
    [0, h * 0.85],
    [w * 0.25, h * 0.65],
    [w * 0.5, h * 0.42],
    [w * 0.75, h * 0.28],
    [w, h * 0.1],
  ];
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
  const area = `${d} L${w} ${h} L0 ${h} Z`;

  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={C.lime} stopOpacity="0.35" />
          <Stop offset="1" stopColor={C.lime} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#trendGrad)" />
      <Path d={d} stroke={C.limeGreen} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ProjectionChart({ horizons, selected }: { horizons: MirrorHorizon[]; selected: string }) {
  const chartW = SW - 64;
  const chartH = 110;
  const n = horizons.length;
  if (n < 2) return null;

  const scores = horizons.map(h => h.score);
  const minS = Math.min(...scores) - 8;
  const maxS = Math.max(...scores) + 5;
  const range = maxS - minS || 1;

  const xs = horizons.map((_, i) => 10 + (i / (n - 1)) * (chartW - 20));
  const ys = scores.map(s => chartH - 20 - ((s - minS) / range) * (chartH - 36));

  const solidPath = `M${xs[0]} ${ys[0]} L${xs[1]} ${ys[1]}`;
  const dashedPath = n > 2
    ? `M${xs[1]} ${ys[1]} ${xs.slice(2).map((x, i) => `L${x} ${ys[i + 2]}`).join(' ')}`
    : '';
  const fullPath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x} ${ys[i]}`).join(' ');
  const areaPath = `${fullPath} L${xs[n - 1]} ${chartH} L${xs[0]} ${chartH} Z`;

  return (
    <View style={{ marginTop: 14 }}>
      <Svg width={chartW} height={chartH}>
        <Defs>
          <LinearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.limeGreen} stopOpacity="0.18" />
            <Stop offset="1" stopColor={C.limeGreen} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#projGrad)" />
        <Path d={solidPath} stroke={C.ink} strokeWidth={2} fill="none" strokeLinecap="round" />
        {dashedPath !== '' && (
          <Path d={dashedPath} stroke={C.inkLight} strokeWidth={2} fill="none" strokeLinecap="round" strokeDasharray="5 4" />
        )}
        {horizons.map((h, i) => (
          <Circle
            key={i}
            cx={xs[i]} cy={ys[i]}
            r={h.k === selected ? 5.5 : 3.5}
            fill={h.k === selected ? C.ink : C.bgCard}
            stroke={C.ink}
            strokeWidth={h.k === selected ? 0 : 1.5}
          />
        ))}
      </Svg>
      <View style={s.chartLabels}>
        {horizons.map(h => (
          <Text key={h.k} style={s.chartLabel}>{h.label}</Text>
        ))}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 24, paddingHorizontal: 16 },

  // Header
  header:       { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 },
  headerKicker: { fontSize: 10, letterSpacing: 4, color: C.inkMuted, fontFamily: 'SpaceGrotesk_700Bold' },

  // Loading / error
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  loadingText: { fontSize: 12, color: C.inkLight, fontFamily: 'Inter_500Medium', letterSpacing: 0.5 },
  errorText:   { fontSize: 13, color: '#CC3333', fontFamily: 'Inter_500Medium', textAlign: 'center' },
  retryBtn:    { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  retryText:   { fontSize: 10, color: C.inkMid, fontFamily: 'Inter_700Bold', letterSpacing: 2 },

  // Forming
  formingScroll:    { paddingBottom: 40, alignItems: 'center', paddingHorizontal: 24 },
  arcWrap:          { marginTop: 24, marginBottom: 28, width: 168, height: 168 },
  arcCenter:        { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  arcPct:           { fontSize: 26, color: C.ink, fontFamily: 'Inter_900Black', letterSpacing: -1, lineHeight: 28 },
  arcLabel:         { fontSize: 9, letterSpacing: 2.5, color: C.inkMuted, fontFamily: 'Inter_700Bold' },
  formingHead:      { fontSize: 32, letterSpacing: -1, color: C.ink, fontFamily: 'Inter_900Black', textAlign: 'center', lineHeight: 36, marginBottom: 12 },
  formingDesc:      { fontSize: 13, color: C.inkLight, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  formingCard:      { width: SW - 48, backgroundColor: C.bgCard, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 18, marginBottom: 20 },
  formingCardRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formingCardLabel: { fontSize: 9, letterSpacing: 2.5, color: C.inkMuted, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  formingCardNum:   { fontSize: 22, color: C.ink, fontFamily: 'Inter_900Black', letterSpacing: -0.5 },
  formingDots:      { flexDirection: 'row', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 120 },
  formingDot:       { width: 10, height: 10, borderRadius: 999, backgroundColor: C.border, borderWidth: 1, borderColor: C.borderDark },
  formingDotFilled: { backgroundColor: C.lime, borderColor: C.limeDim },
  formingStreak:    { fontSize: 12, color: C.inkLight, fontFamily: 'Inter_500Medium', marginBottom: 28 },

  // Hero card (lime)
  heroCard:      { backgroundColor: C.lime, borderRadius: 24, padding: 22, marginBottom: 14, shadowColor: '#96CD28', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.30, shadowRadius: 24, elevation: 8 },
  heroEyebrow:   { fontSize: 9, letterSpacing: 3.5, color: 'rgba(20,17,13,0.50)', fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 8 },
  heroArchetype: { fontSize: 32, letterSpacing: -1.5, color: C.ink, fontFamily: 'Inter_900Black', lineHeight: 34, marginBottom: 10 },
  heroBecoming:  { fontSize: 13, color: 'rgba(20,17,13,0.60)', fontFamily: 'Inter_500Medium', lineHeight: 19, marginBottom: 14 },
  heroPill:      { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: C.ink, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginBottom: 16 },
  heroPillText:  { fontSize: 9, letterSpacing: 1.5, color: C.lime, fontFamily: 'Inter_700Bold' },
  heroChips:     { flexDirection: 'row', backgroundColor: 'rgba(20,17,13,0.08)', borderRadius: 14, paddingVertical: 12 },
  heroChip:      { flex: 1, alignItems: 'center', gap: 3 },
  heroChipDiv:   { width: 1, backgroundColor: 'rgba(20,17,13,0.12)' },
  heroChipVal:   { fontSize: 15, color: C.ink, fontFamily: 'Inter_900Black', letterSpacing: -0.5 },
  heroChipLabel: { fontSize: 7.5, letterSpacing: 1.5, color: 'rgba(20,17,13,0.50)', fontFamily: 'Inter_700Bold' },

  // Section header
  sectionHeaderWrap: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10 },
  sectionHeader:     { fontSize: 9, letterSpacing: 3.5, color: C.inkMuted, fontFamily: 'SpaceGrotesk_700Bold' },
  sectionHeaderSub:  { fontSize: 8, letterSpacing: 1.5, color: C.lime, fontFamily: 'Inter_700Bold' },

  // Generic card
  card:       { backgroundColor: C.bgCard, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 4 },
  cardTitle:  { fontSize: 16, color: C.ink, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  cardBody:   { fontSize: 12, color: C.inkLight, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  divider:    { height: 1, backgroundColor: C.border, marginVertical: 12 },

  // Stats grid (full)
  statsGrid:   { flexDirection: 'row', backgroundColor: C.bgCard, borderRadius: 20, borderWidth: 1, borderColor: C.border, marginBottom: 14, overflow: 'hidden' },
  statCard:    { flex: 1, padding: 14, gap: 3 },
  statBig:     { fontSize: 24, color: C.ink, fontFamily: 'Inter_900Black', letterSpacing: -1, lineHeight: 26 },
  statBigOf:   { fontSize: 13, color: C.inkLight, fontFamily: 'Inter_700Bold', letterSpacing: 0 },
  statBigUnit: { fontSize: 13, color: C.inkLight, fontFamily: 'Inter_700Bold' },
  statSub:     { fontSize: 7, letterSpacing: 1.5, color: C.inkMuted, fontFamily: 'Inter_700Bold' },
  statHint:    { fontSize: 10, color: C.inkLight, fontFamily: 'Inter_400Regular' },

  // Trend card
  trendCard:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8, overflow: 'hidden', marginBottom: 4 },
  trendLeft:      { flex: 1, gap: 10 },
  trendTitle:     { fontSize: 16, color: C.ink, fontFamily: 'Inter_700Bold', lineHeight: 21 },
  trendDeltaPill: { alignSelf: 'flex-start', backgroundColor: C.greenPill, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  trendDeltaText: { fontSize: 8.5, letterSpacing: 1.5, color: C.greenDark, fontFamily: 'Inter_700Bold' },

  // Trait row
  traitRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  traitTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  traitName:      { fontSize: 13, color: C.ink, fontFamily: 'Inter_700Bold' },
  traitDeltaPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  traitDeltaText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  traitTrack:     { height: 6, borderRadius: 999, backgroundColor: C.bgDeep, overflow: 'hidden' },
  traitFill:      { height: 6, borderRadius: 999 },
  traitEvidence:  { fontSize: 10, color: C.inkLight, fontFamily: 'Inter_400Regular', lineHeight: 15 },
  traitScore:     { fontSize: 22, color: C.ink, fontFamily: 'Inter_900Black', letterSpacing: -0.5, width: 38, textAlign: 'right' },

  // Build bar
  buildBarTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  buildLabel:  { fontSize: 9, letterSpacing: 2, color: C.inkMuted, fontFamily: 'Inter_700Bold' },
  buildValue:  { fontSize: 14, fontFamily: 'Inter_900Black', letterSpacing: -0.5 },
  buildTrack:  { height: 8, borderRadius: 999, backgroundColor: C.bgDeep, overflow: 'hidden' },
  buildFill:   { height: 8, borderRadius: 999 },

  // Heatmap
  heatLegend:  { flexDirection: 'row', gap: 16, marginTop: 12, justifyContent: 'center' },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 10, height: 10, borderRadius: 3 },
  legendText:  { fontSize: 10, color: C.inkLight, fontFamily: 'Inter_500Medium' },

  // Projection
  pillRow:          { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 14 },
  pill:             { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: C.bgDeep },
  pillActive:       { backgroundColor: C.ink },
  pillText:         { fontSize: 9, letterSpacing: 1.5, color: C.inkLight, fontFamily: 'Inter_700Bold' },
  pillTextActive:   { color: C.lime },
  horizonDisplay:   { alignItems: 'center', paddingVertical: 4 },
  horizonScore:     { fontSize: 52, color: C.ink, fontFamily: 'Inter_900Black', letterSpacing: -2.5, lineHeight: 56 },
  horizonCaption:   { fontSize: 11, color: C.inkLight, fontFamily: 'Inter_500Medium' },
  chartLabels:      { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 6 },
  chartLabel:       { fontSize: 9, letterSpacing: 1, color: C.inkMuted, fontFamily: 'Inter_500Medium' },

  // Risk card
  riskCard:    { backgroundColor: C.amberPill, borderColor: '#E8C48A' },
  riskIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  riskTitle:   { fontSize: 13, color: C.amberDark, fontFamily: 'Inter_700Bold', flex: 1 },
  riskBody:    { fontSize: 12, color: C.inkMid, fontFamily: 'Inter_400Regular', lineHeight: 18, marginBottom: 10 },
  riskFixBtn:  { alignSelf: 'flex-start', backgroundColor: C.amberDark, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  riskFixText: { fontSize: 10, color: '#FFF8EE', fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },

  // Recommendation card
  recCard:       { backgroundColor: C.dark, borderColor: C.dark },
  recHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  recTitle:      { fontSize: 14, color: '#F2EFE4', fontFamily: 'Inter_700Bold', flex: 1 },
  recImpactPill: { backgroundColor: 'rgba(184,242,58,0.15)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  recImpact:     { fontSize: 9, letterSpacing: 1.5, color: C.lime, fontFamily: 'Inter_700Bold' },
  recWhy:        { fontSize: 12, color: 'rgba(242,239,228,0.65)', fontFamily: 'Inter_400Regular', lineHeight: 18, marginBottom: 14 },
  recBtn:        { alignSelf: 'flex-start', backgroundColor: C.lime, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  recBtnText:    { fontSize: 10, letterSpacing: 2, color: C.limeText, fontFamily: 'Inter_900Black' },

  // Locked (teaser)
  lockedWrap:     { marginBottom: 4 },
  lockedFakeRows: { backgroundColor: C.bgCard, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 20, gap: 18, opacity: 0.3 },
  lockedFakeRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lockedFakeBar:  { height: 8, borderRadius: 999, backgroundColor: C.bgDeep },
  lockedFakeScore:{ width: 32, height: 22, borderRadius: 6, backgroundColor: C.bgDeep },
  lockedGradTop:  { height: 40, backgroundColor: 'transparent' },
  lockedOverlay:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 12 },
  lockedBox:      { backgroundColor: C.bgCard, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 24, width: '100%', alignItems: 'center', gap: 8, shadowColor: '#14110D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 6 },
  lockedIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bgDeep, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  lockedTitle:    { fontSize: 17, color: C.ink, fontFamily: 'Inter_900Black', textAlign: 'center' },
  lockedBody:     { fontSize: 12, color: C.inkLight, fontFamily: 'Inter_400Regular', lineHeight: 18, textAlign: 'center' },
  unlockBtn:      { marginTop: 8, backgroundColor: C.ink, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 14, width: '100%', alignItems: 'center' },
  unlockBtnText:  { fontSize: 10, letterSpacing: 2.5, color: '#F2EFE4', fontFamily: 'Inter_900Black' },

  // Handwritten footer
  handwritten: { fontSize: 14, color: C.inkMuted, fontFamily: 'Inter_400Regular', fontStyle: 'italic', textAlign: 'center', marginTop: 28, marginBottom: 8, paddingHorizontal: 24 },
});
