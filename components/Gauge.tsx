import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from './ThemeContext';

type Props = {
  value: number;
  max: number;
  label: string;
  subLabel?: string;
};

const W    = 320;
const CX   = W / 2;
const CY   = W / 2;
const R    = 116;                  // main arc
const R2   = 128;                  // outer decorative ring
const SEMI = Math.PI * R;
const SEMI2 = Math.PI * R2;

function scoreTier(v: number): string {
  if (v <= 20)  return 'YOU REALLY NEED TO DO BETTER';
  if (v <= 50)  return 'BELOW AVERAGE';
  if (v <= 60)  return 'AVERAGE';
  if (v <= 70)  return 'ABOVE AVERAGE';
  if (v <= 79)  return 'DOING GOOD';
  if (v <= 90)  return 'BEING PRO';
  if (v <= 95)  return 'ELITE PERSON';
  return 'ARE YOU A KNIGHT?';
}

export function Gauge({ value, max, label, subLabel }: Props) {
  const { theme } = useTheme();
  const pct    = Math.min(1, Math.max(0, value / max));
  const offset = SEMI * (1 - pct);

  const trackColor   = theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
  const ringColor    = theme.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
  const progressCol  = theme.text;
  const glowCol      = theme.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)';

  return (
    <View style={s.root}>
      <View style={s.clip}>
        <Svg width={W} height={W} viewBox={`0 0 ${W} ${W}`} style={s.svg}>

          {/* Outer ghost ring — adds subtle depth */}
          <Circle
            cx={CX} cy={CY} r={R2}
            fill="none"
            stroke={ringColor}
            strokeWidth={1}
            strokeDasharray={`${SEMI2} ${SEMI2}`}
            strokeDashoffset={0}
            rotation={-180}
            originX={CX} originY={CY}
            strokeLinecap="butt"
          />

          {/* Track — thin, subtle */}
          <Circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={trackColor}
            strokeWidth={3}
            strokeDasharray={`${SEMI} ${SEMI}`}
            strokeDashoffset={0}
            rotation={-180}
            originX={CX} originY={CY}
            strokeLinecap="round"
          />

          {/* Progress — bold, rounded ends */}
          {pct > 0 && (
            <Circle
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={progressCol}
              strokeWidth={7}
              strokeDasharray={`${SEMI} ${SEMI}`}
              strokeDashoffset={offset}
              rotation={-180}
              originX={CX} originY={CY}
              strokeLinecap="round"
            />
          )}

          {/* Soft glow layer — thinner, slightly transparent on top */}
          {pct > 0 && (
            <Circle
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={glowCol}
              strokeWidth={14}
              strokeDasharray={`${SEMI} ${SEMI}`}
              strokeDashoffset={offset}
              rotation={-180}
              originX={CX} originY={CY}
              strokeLinecap="round"
            />
          )}
        </Svg>
      </View>

      {/* Labels */}
      <View style={s.labels} pointerEvents="none">
        <Text style={[s.value, { color: theme.text, fontFamily: 'Inter_500Medium' }]}>
          {value.toLocaleString()}
        </Text>
        <Text style={[s.tier, { color: '#34C759', fontFamily: 'Inter_900Black' }]}>
          {scoreTier(value)}
        </Text>
        {subLabel ? (
          <Text style={[s.sublabel, { color: theme.textSecondary }]}>
            / {max.toLocaleString()} {subLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    alignItems: 'center',
    marginBottom: 0,
    height: W / 2 + 24,
  },
  clip: {
    width: W,
    height: W / 2,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
  },
  svg: {
    position: 'absolute',
    top: 0,
  },
  labels: {
    position: 'absolute',
    bottom: 28,
    alignItems: 'center',
    gap: 6,
  },
  value: {
    fontSize: 64,
    letterSpacing: -3,
    lineHeight: 68,
  },
  sublabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  tier: {
    fontSize: 8,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
