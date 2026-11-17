import React from 'react';
import {StyleSheet,Text,View} from 'react-native';
import Svg,{Circle,G} from 'react-native-svg';
import type {AppTheme} from './ThemeContext';
// ── Arc gauge — 220° sweep with score in the centre ────────────────────────
const GAUGE_W = 220;
const GAUGE_H = 150;
const GAUGE_R = 86;
const GAUGE_CX = GAUGE_W / 2;
const GAUGE_CY = 110;
const GAUGE_SWEEP_DEG = 220;
const GAUGE_C = 2 * Math.PI * GAUGE_R;
const GAUGE_ARC_LEN = GAUGE_C * (GAUGE_SWEEP_DEG / 360);
const GAUGE_GAP = GAUGE_C - GAUGE_ARC_LEN;
const GAUGE_ROTATE = 90 + (360 - GAUGE_SWEEP_DEG) / 2;

function gaugeColor(v: number, theme: any): string {
  if (v <= 33) return theme.danger;
  if (v <= 66) return theme.warning;
  return theme.success;
}

export function ArcGauge({ value, theme, label = 'Discipline score' }: { value: number | null; theme: AppTheme; label?: string }) {
  const score = value == null ? null : Math.max(0,Math.min(100,value));
  const pct = (score ?? 0) / 100;
  const fill = GAUGE_ARC_LEN * pct;
  const col  = gaugeColor(score ?? 0, theme);
  return (
    <View style={{ width: GAUGE_W, height: GAUGE_H, alignSelf: 'center' }} accessible accessibilityLabel={score == null ? `${label}: no score recorded` : `${label} ${Math.round(score)} out of 100`}>
      <Svg width={GAUGE_W} height={GAUGE_H} viewBox={`0 0 ${GAUGE_W} ${GAUGE_H + 30}`}>
        <G transform={`rotate(${GAUGE_ROTATE}, ${GAUGE_CX}, ${GAUGE_CY})`}>
          <Circle cx={GAUGE_CX} cy={GAUGE_CY} r={GAUGE_R} fill="none" stroke={theme.surface} strokeWidth={14} strokeLinecap="round" strokeDasharray={`${GAUGE_ARC_LEN} ${GAUGE_GAP}`} />
          {score != null && score > 0 && (
            <Circle cx={GAUGE_CX} cy={GAUGE_CY} r={GAUGE_R} fill="none" stroke={col} strokeWidth={14} strokeLinecap="round" strokeDasharray={`${fill} ${GAUGE_C - fill}`} />
          )}
        </G>
      </Svg>
      <View style={s.gaugeLabel} pointerEvents="none">
        <Text style={[s.gaugeNum, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{score == null ? '—' : Math.round(score)}</Text>
        <Text style={[s.gaugeCap, { color: theme.textTertiary, fontFamily: 'Inter_700Bold' }]}>OUT OF 100</Text>
      </View>
    </View>
  );
}

export function MomentumPill({ score, theme }: { score: number | null; theme: AppTheme }) {
  let label: string, bg: string, fg: string, arrow: string;
  if (score == null) { label = 'NO SCORE YET'; bg = theme.surfaceStrong; fg = theme.textSecondary; arrow = '·'; }
  else if (score >= 75)      { label = 'CRUSHING IT';       bg = '#22A66425'; fg = '#22A664'; arrow = '↑'; }
  else if (score >= 50) { label = 'BUILDING MOMENTUM'; bg = '#F0A12E25'; fg = '#F0A12E'; arrow = '↑'; }
  else if (score >= 25) { label = 'WAVERING';          bg = '#F0A12E20'; fg = '#F0A12E'; arrow = '→'; }
  else if (score > 0)   { label = 'BELOW POTENTIAL';   bg = '#E84A4A20'; fg = '#E84A4A'; arrow = '↓'; }
  else                  { label = 'SHOW UP';           bg = theme.surfaceStrong; fg = theme.textSecondary; arrow = '·'; }
  return (
    <View style={[s.momentumPill, { backgroundColor: bg }]}>
      <Text style={[s.momentumPillText, { color: fg, fontFamily: 'Inter_900Black' }]}>{arrow}  {label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
 gaugeLabel:{position:'absolute',bottom:28,left:0,right:0,alignItems:'center',gap:4},
 gaugeNum:{fontSize:50,letterSpacing:-2.5,lineHeight:50},
 gaugeCap:{fontSize:9,letterSpacing:1.8},
 momentumPill:{paddingHorizontal:14,paddingVertical:7,borderRadius:999},
 momentumPillText:{fontSize:11,letterSpacing:1.5},
});
