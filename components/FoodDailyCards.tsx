import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from './ThemeContext';
import { formatShortDate } from '../lib/today';
import { shiftDate } from '../lib/api';
import { INTAKE_OPTIONS, IntakeMap, intakeDistribution } from '../lib/foodIntake';

type Choice = { key: string; label: string };
export function FoodQuestionCard({ title, subtitle, options, value, onChange, onHistory, theme, disabled = false }: {
  title: string; subtitle?: string; score?: number | null; scoreLabel?: string; dailyScores?: Record<string,number | null>; options: readonly Choice[]; value: string | null;
  onChange: (value: string) => void; onHistory: () => void; theme: AppTheme; disabled?: boolean;
}) {
  return <View style={[s.question, { backgroundColor: theme.card, borderColor: theme.border }]}>
    <View style={s.questionHeader}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>{title}</Text>
        {!!subtitle && <Text style={[s.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>}
      </View>
      <TouchableOpacity onPress={onHistory} style={[s.chartButton, { backgroundColor: theme.surface }]} accessibilityRole="button" accessibilityLabel={`View chart for ${title}`} activeOpacity={0.7}>
        <Ionicons name="stats-chart-outline" size={18} color={theme.textSecondary} />
      </TouchableOpacity>
    </View>
    <View style={s.choices} accessibilityRole="radiogroup" accessibilityLabel={title}>
      {options.map(option => {
        const selected = value === option.key;
        return <TouchableOpacity key={option.key} onPress={() => onChange(option.key)} disabled={disabled} activeOpacity={0.75}
          accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: selected, disabled }}
          style={[s.choice, { borderColor: selected ? theme.inverse : theme.borderStrong, backgroundColor: selected ? theme.inverse : theme.card, opacity: disabled ? 0.6 : 1 }]}>
          <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={selected ? theme.inverseText : theme.textSecondary} />
          <Text style={[s.choiceText, { color: selected ? theme.inverseText : theme.text }]}>{option.label}</Text>
        </TouchableOpacity>;
      })}
    </View>
  </View>;
}

export function FoodWeekCard({ endDate, recordedDates, complete, theme, controls, extraNote, title = "Your food week", score, scoreLabel = "Today’s score", dailyScores }: {
  endDate: string; recordedDates: Set<string>; complete: boolean; theme: AppTheme; controls?: React.ReactNode; extraNote?: string; title?: string; score?: number | null; scoreLabel?: string; dailyScores?: Record<string,number | null>;
}) {
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(endDate, i - 6));
  const count = days.filter(date => recordedDates.has(date)).length;
  return <View style={[s.week, { backgroundColor: theme.inverse }]}>
    <View style={[s.weekHeading,{justifyContent:'space-between',alignItems:'flex-start'}]}>
      <View><Text style={[s.weekCount, { color: theme.inverseText }]} accessibilityLabel={score == null ? 'No score recorded' : `${Math.round(score)} out of 100`}>{score == null ? '—' : Math.round(score)}{score != null && <Text style={s.weekDenominator}> / 100</Text>}</Text></View>
      {controls}
    </View>
    {dailyScores ? <View style={{flexDirection:'row',gap:8,marginTop:22}}>{days.map(date=>{
      const raw=dailyScores[date];const value=raw==null?null:Number(raw);const score=value!=null&&Number.isFinite(value)?Math.min(100,Math.max(0,value)):null;
      return <View key={date} accessible accessibilityLabel={`${formatShortDate(date)}: ${score==null?'No score recorded':`${Math.round(score)} out of 100`}`} style={{flex:1,alignItems:'center',gap:8}}>
        <View style={{height:90,width:'100%',alignItems:'center',justifyContent:'flex-end'}}>
          <Text style={{color:theme.inverseText,opacity:0.65,fontSize:10,marginBottom:5}}>{score==null?'—':Math.round(score)}</Text>
          <View style={{width:'60%',maxWidth:24,height:score==null?2:Math.max(2,score/100*68),borderRadius:5,backgroundColor:score==null?theme.inverseText+'25':theme.inverseText,opacity:date===endDate?1:0.75}}/>
        </View>
        <Text style={{color:theme.inverseText,fontSize:11,fontFamily:date===endDate?'Inter_800ExtraBold':'Inter_500Medium'}}>{Number(date.slice(-2))}</Text>
      </View>;
    })}</View> : <View style={s.weekDays}>
      {days.map(date => {
        const logged = recordedDates.has(date);
        const d = new Date(date + 'T12:00:00');
        return <View key={date} style={s.weekDay} accessible accessibilityLabel={`${formatShortDate(date)}: ${logged ? 'Check-in recorded' : complete ? 'No check-in' : 'Record not confirmed'}`}>
          <Text style={[s.weekDayText, { color: theme.inverseText }]}>{d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)}</Text>
          <View style={[s.dayMark, { backgroundColor: logged ? theme.accent : theme.inverseText + '18' }]}>
            {logged ? <Ionicons name="checkmark" size={16} color={theme.accentText} /> : <Text style={[s.dayNumber, { color: theme.inverseText }]}>{d.getDate()}</Text>}
          </View>
        </View>;
      })}
    </View>}
    {!!extraNote && <Text style={[s.weekFootnote, { color: theme.inverseText }]} accessibilityLiveRegion="polite">{extraNote}</Text>}
    {!complete && <Text style={[s.weekFootnote, { color: theme.inverseText }]}>Some records are unavailable. These are confirmed check-ins only.</Text>}
  </View>;
}

export function IntakeChartModal({ open, entries, endDate, onClose, theme }: {
  open: boolean; entries: IntakeMap; endDate: string; onClose: () => void; theme: AppTheme;
}) {
  const [range, setRange] = useState<7 | 28>(7);
  const from = shiftDate(endDate, 1 - range);
  const distribution = useMemo(() => intakeDistribution(entries, from, endDate), [entries, from, endDate]);
  const total = distribution.reduce((sum, d) => sum + d.count, 0);
  const recent = Object.entries(entries).filter(([date]) => date >= from && date <= endDate).sort(([a],[b]) => b.localeCompare(a));
  return <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <View style={[s.sheet, { backgroundColor: theme.bg }]}>
      <View style={s.sheetHeader}><View style={{ flex: 1 }}><Text style={[s.sheetTitle, { color: theme.text }]}>Food intake</Text><Text style={[s.subtitle, { color: theme.textSecondary }]}>{formatShortDate(from)} – {formatShortDate(endDate)}</Text></View><TouchableOpacity style={s.chartButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close food intake chart"><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity></View>
      <ScrollView contentContainerStyle={s.sheetContent}>
        <View style={s.rangeRow}>{([7,28] as const).map(days => <TouchableOpacity key={days} onPress={() => setRange(days)} accessibilityRole="button" accessibilityState={{ selected: range === days }} style={[s.rangeButton, { backgroundColor: range === days ? theme.inverse : theme.card, borderColor: theme.border }]}><Text style={[s.choiceText, { color: range === days ? theme.inverseText : theme.text }]}>{days} days</Text></TouchableOpacity>)}</View>
        <Text style={[s.title, { color: theme.text, marginTop: 24 }]}>{total ? `${total} intake check-in${total === 1 ? '' : 's'}` : 'No intake check-ins yet'}</Text>
        <Text style={[s.subtitle, { color: theme.textSecondary }]}>Answers describe amount relative to your usual day. They are not ranked from good to bad.</Text>
        {distribution.map(d => <View key={d.key} style={s.distributionRow} accessibilityLabel={`${d.label}: ${d.count} of ${total} responses`}><View style={s.distributionLabel}><Text style={[s.body, { color: theme.text }]}>{d.label}</Text><Text style={[s.body, { color: theme.text }]}>{d.count}</Text></View><View style={[s.track, { backgroundColor: theme.surfaceStrong }]}><View style={[s.bar, { width: `${total ? d.count / total * 100 : 0}%`, backgroundColor: theme.success }]} /></View></View>)}
        {!!recent.length && <Text style={[s.title, { color: theme.text, marginTop: 28, marginBottom: 10 }]}>Your answers</Text>}
        {recent.map(([date, entry]) => <View key={date} style={[s.historyRow, { borderBottomColor: theme.border }]}><Text style={[s.body, { color: theme.textSecondary }]}>{formatShortDate(date)}</Text><Text style={[s.body, { color: theme.text }]}>{INTAKE_OPTIONS.find(o => o.key === entry.answer)?.label}</Text></View>)}
        <Text style={[s.subtitle, { color: theme.textSecondary, marginTop: 24 }]}>Intake history is saved on this device. Earlier three-option check-ins remain in your previous records.</Text>
      </ScrollView>
    </View>
  </Modal>;
}
const s = StyleSheet.create({
  question: { marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 18, borderWidth: 1 },
  questionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  title: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 12, lineHeight: 18, marginTop: 4, fontFamily: 'Inter_500Medium' },
  chartButton: { minWidth: 44, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexGrow: 1, flexBasis: '44%' },
  choiceText: { flexShrink: 1, fontSize: 13, lineHeight: 18, fontFamily: 'Inter_600SemiBold' },
  week: { marginHorizontal: 16, marginBottom: 18, padding: 18, borderRadius: 20 },
  weekHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  weekTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  weekPeriod: { fontSize: 11, lineHeight: 16, opacity: 0.8, marginTop: 3, fontFamily: 'Inter_500Medium' },
  weekCount: { fontSize: 27, lineHeight: 32, fontFamily: 'SpaceGrotesk_700Bold' },
  weekDenominator: { fontSize: 15 },
  weekDays: { flexDirection: 'row', justifyContent: 'space-between', gap: 3, marginTop: 18 },
  weekDay: { alignItems: 'center', flex: 1, gap: 8 },
  weekDayText: { fontSize: 11, fontFamily: 'Inter_500Medium', opacity: 0.8 },
  dayMark: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dayNumber: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  weekFootnote: { fontSize: 11, lineHeight: 17, opacity: 0.8, fontFamily: 'Inter_400Regular', marginTop: 14 },
  sheet: { flex: 1, paddingTop: 20 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 20, gap: 12 },
  sheetTitle: { fontSize: 24, fontFamily: 'BricolageGrotesque_800ExtraBold' },
  sheetContent: { padding: 20, paddingBottom: 50 },
  rangeRow: { flexDirection: 'row', gap: 10 },
  rangeButton: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
  distributionRow: { marginTop: 20 },
  distributionLabel: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  body: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_500Medium' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
  historyRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, paddingVertical: 13, borderBottomWidth: 1 },
});
