import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppTheme } from './ThemeContext';
import { Challenge, DurationStats } from '../lib/api';

// The signature "accept + start + stick" experience: who's climbing with you
// (live cohort presence) + a climbing trail to the summit. Pure presentational —
// all data comes from the existing /challenges APIs, no new backend.

function milestones(d: number): number[] {
  const raw = [1, Math.round(d * 0.25), Math.round(d * 0.5), Math.round(d * 0.75), d];
  return [...new Set(raw)].filter(x => x >= 1 && x <= d).sort((a, b) => a - b);
}

export function ChallengeJourney({
  challenge: c, stats, theme, accent, active,
}: {
  challenge: Challenge;
  stats: DurationStats | null;
  theme: AppTheme;
  accent: string;
  active: boolean;
}) {
  const total     = stats?.total ?? c.participantCount ?? 0;
  const going     = stats?.active ?? 0;
  const finished  = stats?.completed ?? 0;
  const dropped   = stats?.abandoned ?? 0;
  const daysDone  = active ? Math.min(c.daysDone, c.durationDays) : 0;

  // Cohort headline — honest at low counts, motivating at scale.
  const headline =
    total <= 0 ? 'Be the first to take this on.'
    : finished > 0 ? `${finished.toLocaleString()} already reached the summit.`
    : going > 0 ? `${going.toLocaleString()} ${going === 1 ? 'person is' : 'people are'} climbing right now.`
    : `${total.toLocaleString()} ${total === 1 ? 'person is' : 'people are'} in.`;

  const nodes = milestones(c.durationDays).reverse(); // summit first (top)

  return (
    <View style={{ gap: 22 }}>
      {/* ── Live cohort presence ─────────────────────────────── */}
      <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[s.eyebrow, { color: theme.textTertiary }]}>WHO'S IN THIS WITH YOU</Text>
        <View style={s.cohortTop}>
          <Text style={[s.bigNum, { color: theme.text }]}>{total.toLocaleString()}</Text>
          <Text style={[s.headline, { color: theme.textSecondary }]}>{headline}</Text>
        </View>

        {total > 0 && (
          <>
            <View style={[s.stackBar, { backgroundColor: theme.surfaceStrong }]}>
              {finished > 0 && <View style={{ flex: finished, backgroundColor: '#F0A12E' }} />}
              {going > 0    && <View style={{ flex: going,    backgroundColor: accent }} />}
              {dropped > 0  && <View style={{ flex: dropped,  backgroundColor: theme.textMuted }} />}
            </View>
            <View style={s.legendRow}>
              <Legend color={accent}          label={`${going} climbing`} theme={theme} />
              <Legend color="#F0A12E"         label={`${finished} finished`} theme={theme} />
              <Legend color={theme.textMuted} label={`${dropped} slipped`} theme={theme} />
            </View>
          </>
        )}
      </View>

      {/* ── The climb ────────────────────────────────────────── */}
      <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[s.eyebrow, { color: theme.textTertiary }]}>THE CLIMB · {c.durationDays} DAYS</Text>
        <View style={{ marginTop: 14 }}>
          {nodes.map((day, i) => {
            const reached  = daysDone >= day;
            const isSummit = i === 0;
            const isStart  = i === nodes.length - 1;
            // current = the highest reached node
            const isCurrent = active && reached && (i === 0 ? true : daysDone < nodes[i - 1]);
            const lineAbove = i > 0;
            const lineBelow = i < nodes.length - 1;
            // segment below is "climbed" if the lower node is reached
            const belowClimbed = lineBelow && daysDone >= nodes[i + 1];
            return (
              <View key={day} style={s.nodeRow}>
                {/* rail */}
                <View style={s.rail}>
                  <View style={[s.railLine, { backgroundColor: lineAbove ? (reached ? accent : theme.border) : 'transparent' }]} />
                  <View style={[
                    s.dot,
                    reached
                      ? { backgroundColor: isSummit ? theme.text : accent, borderColor: isSummit ? theme.text : accent }
                      : { backgroundColor: theme.card, borderColor: theme.borderStrong },
                    isCurrent && { transform: [{ scale: 1.35 }], borderColor: accent },
                  ]}>
                    {isSummit && <Text style={s.summitIcon}>★</Text>}
                  </View>
                  <View style={[s.railLine, { backgroundColor: lineBelow ? (belowClimbed ? accent : theme.border) : 'transparent' }]} />
                </View>
                {/* content */}
                <View style={s.nodeBody}>
                  <Text style={[s.nodeTitle, { color: reached ? theme.text : theme.textSecondary }]}>
                    {isSummit ? 'SUMMIT' : isStart ? 'DAY 1' : `DAY ${day}`}
                  </Text>
                  <Text style={[s.nodeSub, { color: theme.textTertiary }]}>
                    {isSummit ? `${c.durationDays}-day ${c.domain} — done`
                      : isStart ? 'Where you begin'
                      : isCurrent ? "You're here"
                      : reached ? 'Cleared'
                      : `${day - daysDone} ${day - daysDone === 1 ? 'day' : 'days'} away`}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
        <Text style={[s.forgiving, { color: theme.textMuted }]}>
          A slip dents the climb — it never ends it. Show up tomorrow and you're still on the mountain.
        </Text>
      </View>
    </View>
  );
}

const Legend = ({ color, label, theme }: { color: string; label: string; theme: AppTheme }) => (
  <View style={s.legend}>
    <View style={[s.legendDot, { backgroundColor: color }]} />
    <Text style={[s.legendText, { color: theme.textSecondary }]}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 18 },
  eyebrow: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 10, letterSpacing: 1.8 },
  cohortTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
  bigNum: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 44, letterSpacing: -1.5 },
  headline: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5, lineHeight: 18, flex: 1 },
  stackBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 16 },
  legendRow: { flexDirection: 'row', gap: 16, marginTop: 12, flexWrap: 'wrap' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontFamily: 'Inter_600SemiBold', fontSize: 11.5 },

  nodeRow: { flexDirection: 'row', gap: 14 },
  rail: { width: 26, alignItems: 'center' },
  railLine: { width: 2.5, flex: 1, minHeight: 14 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  summitIcon: { fontSize: 10, color: '#B8F23A', lineHeight: 12 },
  nodeBody: { flex: 1, paddingVertical: 2, justifyContent: 'center' },
  nodeTitle: { fontFamily: 'Inter_800ExtraBold', fontSize: 13, letterSpacing: 0.5 },
  nodeSub: { fontFamily: 'Inter_500Medium', fontSize: 11.5, marginTop: 1 },
  forgiving: { fontFamily: 'Inter_500Medium', fontSize: 11.5, lineHeight: 16, marginTop: 16, fontStyle: 'italic' },
});
