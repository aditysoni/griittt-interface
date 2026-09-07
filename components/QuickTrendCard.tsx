import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { shiftDate } from '../lib/api';

// Shared "quick" hero card used by the Fuel and Strength screens: today's score
// + status pill + XP-to-next, over a 7-day gradient bar chart with dashed
// gridlines. Intentionally dark in both themes (like the Mirror entry card).

const GRID_LEVELS = [100, 75, 50, 25, 0];
const CHART_H = 150;
const Y_GUTTER = 28;

function statusFor(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'CRUSHING IT', color: '#22A664' };
  if (score >= 60) return { label: 'CONSISTENT',  color: '#22A664' }; // green (no blue)
  if (score >= 40) return { label: 'SHOWING UP',  color: '#F0A12E' };
  return { label: 'SLIPPING', color: '#E84A4A' };
}

// Vertical gradient for a bar — brighter olive/lime at top fading to dark at the
// bottom. Today gets a brighter lime.
function barGradient(score: number | null, isToday: boolean): [string, string] {
  if (score == null) return ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)'];
  if (isToday)       return ['#C4F04A', '#5E7A22'];
  return ['#A6C13E', '#2E3814'];
}

export function QuickTrendCard({ eyebrow, score, history, selectedDate, identity }: {
  eyebrow: string;
  score: number;
  history: Array<{ date: string; score: number | null }>;
  selectedDate: string;
  identity?: { totalXP?: number; xpToNext?: number; nextLevel?: string } | null;
}) {
  const status = statusFor(score);

  const last7 = React.useMemo(() => {
    const days: { date: string; score: number | null }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = shiftDate(selectedDate, -i);
      days.push({ date: d, score: history.find(h => h.date === d)?.score ?? null });
    }
    return days;
  }, [history, selectedDate]);

  const dayLetter = (ds: string) => ['M', 'T', 'W', 'T', 'F', 'S', 'S'][(new Date(ds + 'T12:00:00').getDay() + 6) % 7];

  const totalXP   = identity?.totalXP ?? 0;
  const xpToNext  = identity?.xpToNext ?? 0;
  const nextLevel = identity?.nextLevel;

  return (
    <LinearGradient
      colors={['#252A12', '#12150B', '#090A05']}
      locations={[0, 0.55, 1]}
      start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
      style={s.card}
    >
      {/* Today's score (left) · status pill + XP (right) */}
      <View style={s.topRow}>
        <View style={{ flexShrink: 1 }}>
          <Text style={s.eyebrow}>{eyebrow}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 6 }}>
            <Text style={[s.scoreNum, { color: status.color }]}>{score}</Text>
            <Text style={s.scoreMax}>/100</Text>
          </View>
        </View>
        <View style={s.topRight}>
          <View style={[s.statusPill, { backgroundColor: status.color + '22' }]}>
            <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          {!!identity && (
            <Text style={s.xpLine}>
              <Text style={s.xpEarned}>{Math.round(totalXP)} XP</Text>
              <Text style={s.xpMuted}> earned</Text>
              {xpToNext ? (
                <Text style={s.xpMuted}>
                  {'  ·  '}
                  <Text style={s.xpToNext}>{Math.round(xpToNext)} XP</Text>
                  {` to ${nextLevel ?? 'next'}`}
                </Text>
              ) : null}
            </Text>
          )}
        </View>
      </View>

      {/* Chart — dashed gridlines + y-axis labels + gradient bars */}
      <View style={[s.chart, { height: CHART_H }]}>
        <Svg width="100%" height={CHART_H} style={StyleSheet.absoluteFill as any}>
          {GRID_LEVELS.map(v => {
            const y = (1 - v / 100) * (CHART_H - 1) + 0.5;
            return (
              <Line key={v} x1={Y_GUTTER} y1={y} x2="100%" y2={y}
                stroke="rgba(245,242,233,0.14)" strokeWidth={1} strokeDasharray="2 5" />
            );
          })}
        </Svg>
        {GRID_LEVELS.map(v => (
          <Text key={v} style={[s.yLabel, { top: (1 - v / 100) * CHART_H - 7 }]}>{v}</Text>
        ))}
        <View style={s.barsRow}>
          {last7.map(d => {
            const isToday = d.date === selectedDate;
            const h = d.score == null ? 4 : Math.max(6, (d.score / 100) * CHART_H);
            return (
              <View key={d.date} style={s.barCol}>
                <LinearGradient
                  colors={barGradient(d.score, isToday)}
                  start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                  style={[s.bar, { height: h }]}
                />
              </View>
            );
          })}
        </View>
      </View>

      {/* Day labels — aligned under the bars */}
      <View style={s.daysRow}>
        {last7.map(d => {
          const isToday = d.date === selectedDate;
          return (
            <View key={d.date} style={s.barCol}>
              <Text style={[s.barDay, { color: isToday ? '#C4F04A' : 'rgba(245,242,233,0.4)' }]}>
                {dayLetter(d.date)}
              </Text>
            </View>
          );
        })}
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  card:      { marginHorizontal: 16, marginBottom: 14, borderRadius: 20, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 16, borderWidth: 1, borderColor: 'rgba(184,242,58,0.14)' },
  topRow:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  topRight:  { alignItems: 'flex-end', maxWidth: '58%' },
  eyebrow:   { fontSize: 10, letterSpacing: 2, color: 'rgba(245,242,233,0.5)', fontFamily: 'Inter_700Bold' },
  scoreNum:  { fontSize: 52, letterSpacing: -2, lineHeight: 54, fontFamily: 'Inter_900Black' },
  scoreMax:  { fontSize: 16, color: 'rgba(245,242,233,0.4)', fontFamily: 'Inter_500Medium' },
  statusPill:{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusText:{ fontSize: 10, letterSpacing: 1.5, fontFamily: 'Inter_900Black' },
  xpLine:    { marginTop: 8, textAlign: 'right', fontSize: 11, lineHeight: 16 },
  xpEarned:  { color: '#B8F23A', fontFamily: 'Inter_800ExtraBold' },
  xpToNext:  { color: '#F0A12E', fontFamily: 'Inter_800ExtraBold' },
  xpMuted:   { color: 'rgba(245,242,233,0.5)', fontFamily: 'Inter_500Medium' },
  chart:     { position: 'relative', marginTop: 18 },
  yLabel:    { position: 'absolute', left: 0, width: Y_GUTTER - 8, textAlign: 'right', fontSize: 9, color: 'rgba(245,242,233,0.35)', fontFamily: 'SpaceGrotesk_500Medium' },
  barsRow:   { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'flex-end', paddingLeft: Y_GUTTER, gap: 4 },
  barCol:    { flex: 1, alignItems: 'center' },
  bar:       { width: '82%', borderRadius: 4, minHeight: 4 },
  daysRow:   { flexDirection: 'row', paddingLeft: Y_GUTTER, gap: 4, marginTop: 8 },
  barDay:    { fontSize: 10, fontFamily: 'Inter_700Bold' },
});
