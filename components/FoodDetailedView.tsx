import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppTheme } from './ThemeContext';
import type { FoodItem, FuelMonthlyAnalysis } from '../lib/api';
import { FoodWeekCard } from './FoodDailyCards';
import { FoodDetailMap, summarizeNutrition } from '../lib/foodDetails';
import { formatShortDate } from '../lib/today';

export type FoodSubmissionMode = 'quick' | 'detailed';
export function FoodModeTabs({ mode, onChange, theme, disabled, quickLabel = 'Quick submission', detailedLabel = 'Detailed', accessibilityLabel = 'Submission mode' }: { quickLabel?: string; detailedLabel?: string; accessibilityLabel?: string; mode: FoodSubmissionMode; onChange: (mode: FoodSubmissionMode) => void; theme: AppTheme; disabled?: boolean }) {
  return <View style={[s.modeTabs, { backgroundColor: theme.surface }]} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
    {([['quick',quickLabel,'flash-outline'],['detailed',detailedLabel,'restaurant-outline']] as const).map(([value,label,icon]) => <TouchableOpacity key={value} onPress={() => onChange(value)} disabled={disabled} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: mode === value, disabled: !!disabled }} activeOpacity={0.75} style={[s.modeTab, { backgroundColor: mode === value ? theme.card : 'transparent' }]}><Text style={[s.tabText, { color: mode === value ? theme.text : theme.textSecondary }]}>{label.toUpperCase()}</Text></TouchableOpacity>)}
  </View>;
}

export function FoodOverview({ mode, endDate, recordedDates, complete, analysis, loading, error, onRetry, theme, score, scoreLabel, dailyScores }: {
  dailyScores: Record<string,number | null>; score?: number | null; scoreLabel?: string; mode: FoodSubmissionMode; endDate: string; recordedDates: Set<string>; complete: boolean;
  analysis: FuelMonthlyAnalysis | null; loading: boolean; error: boolean; onRetry: () => void; theme: AppTheme;
}) {
  const [view, setView] = useState<'week' | 'foods'>('week');
  const foods = analysis?.month === endDate.slice(0, 7) ? analysis.topFoods.filter(food => food.count > 0) : [];
  const unlocked = foods.length > 0 && !error;
  useEffect(() => { if (!unlocked) setView('week'); }, [unlocked]);
  const controls = <View style={[s.summaryTabs, { backgroundColor: theme.inverseText + '16' }]} accessibilityRole="tablist" accessibilityLabel="Food overview">
    {([['week','Weekly habit'],['foods','Most logged']] as const).map(([value,label]) => <TouchableOpacity key={value} onPress={() => setView(value)} disabled={value === 'foods' && !unlocked} accessibilityRole="tab" accessibilityLabel={label} accessibilityHint={value === 'foods' && !unlocked ? 'Log a food item in Detailed to unlock this summary.' : undefined} accessibilityState={{ selected: view === value, disabled: value === 'foods' && !unlocked }} style={[s.summaryTab, { backgroundColor: view === value ? theme.inverseText : 'transparent', opacity: value === 'foods' && !unlocked ? 0.5 : 1 }]}><Text style={[s.summaryTabText, { color: view === value ? theme.inverse : theme.inverseText }]}>{label}</Text>{value === 'foods' && !unlocked && <Ionicons name="lock-closed-outline" size={12} color={theme.inverseText} />}</TouchableOpacity>)}
  </View>;
  const hint = loading ? 'Updating your detailed food history…' : error ? 'Food insights could not be loaded.' : undefined;
  if (view === 'foods' && unlocked) {
    const month = new Date(endDate.slice(0, 7) + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const max = Math.max(...foods.map(food => food.count));
    return <View style={[s.mostCard, { backgroundColor: theme.inverse }]}>{controls}<Text style={[s.summaryTitle, { color: theme.inverseText }]}>Your most logged foods</Text><Text style={[s.summaryPeriod, { color: theme.inverseText }]}>{month} · based on detailed entries</Text>
      {foods.slice(0, 3).map((food, index) => <View key={food.name} style={s.foodRankRow} accessibilityLabel={`${food.name}: ${food.count} entries across ${food.daysEaten} days`}><Text style={[s.rank, { color: theme.inverseText }]}>{index + 1}</Text><View style={{ flex: 1, minWidth: 0 }}><View style={s.rankHeading}><Text style={[s.foodRankName, { color: theme.inverseText }]}>{food.name}</Text><Text style={[s.foodRankCount, { color: theme.inverseText }]}>{food.count}×</Text></View><View style={[s.rankTrack, { backgroundColor: theme.inverseText + '22' }]}><View style={[s.rankFill, { width: `${food.count / max * 100}%`, backgroundColor: theme.accent }]} /></View><Text style={[s.summaryPeriod, { color: theme.inverseText }]}>{food.daysEaten} day{food.daysEaten === 1 ? '' : 's'} logged</Text></View></View>)}
      <Text style={[s.summaryNote, { color: theme.inverseText }]}>Frequency of logged entries, not portion size or the amount eaten.</Text>
    </View>;
  }
  return <><FoodWeekCard dailyScores={dailyScores} score={score} scoreLabel={scoreLabel} endDate={endDate} recordedDates={recordedDates} complete={complete} theme={theme} controls={controls} extraNote={hint} />{error && <TouchableOpacity onPress={onRetry} style={s.retry} accessibilityRole="button" accessibilityLabel="Retry detailed food insights"><Text style={[s.link, { color: theme.text }]}>Retry food insights</Text></TouchableOpacity>}</>;
}

export function DetailedFoodView({ date, todayStr, items, details, loading, error, canLog, onRetry, onAdd, onEdit, onDelete, theme }: {
  date: string; todayStr: string; items: FoodItem[]; details: FoodDetailMap; loading: boolean; error: boolean; canLog: boolean;
  onRetry: () => void; onAdd: () => void; onEdit: (item: FoodItem) => void; onDelete: (item: FoodItem) => void; theme: AppTheme;
}) {
  const nutrients = summarizeNutrition(items);
  return <>
    {canLog && <View style={{marginHorizontal:16,marginBottom:18}}><TouchableOpacity onPress={onAdd} style={[s.addFood, { backgroundColor: theme.inverse }]} accessibilityRole="button" accessibilityLabel="Add food" activeOpacity={0.8}><Ionicons name="add" size={18} color={theme.inverseText} /><Text style={[s.link, { color: theme.inverseText }]}>Add food</Text></TouchableOpacity></View>}
    {!!items.length && !error && <View style={[s.nutritionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12}}><Text style={[s.sectionTitle, { color: theme.text }]}>Recorded nutrition</Text><Text style={{color:theme.textSecondary,fontSize:11,fontFamily:'Inter_600SemiBold'}}>{date === todayStr ? 'Today' : formatShortDate(date)}</Text></View>
      <View accessible accessibilityLabel={`Calories: ${nutrients[0].value==null?'Not entered':`${nutrients[0].value} kcal`}. Entered for ${nutrients[0].recorded} of ${items.length} foods.`} style={{paddingVertical:20,marginBottom:16,borderBottomWidth:1,borderBottomColor:theme.border}}>
        <View style={{flexDirection:'row',alignItems:'baseline',gap:7}}><Text style={{color:theme.text,fontSize:38,lineHeight:44,fontFamily:'SpaceGrotesk_700Bold',letterSpacing:-1}}>{nutrients[0].value??'—'}</Text><Text style={{color:theme.textSecondary,fontSize:14}}>kcal</Text></View>
        <Text style={{color:theme.textSecondary,fontSize:12,marginTop:4}}>Energy logged · {items.length} food{items.length===1?'':'s'}</Text>
        {nutrients[0].recorded>0&&nutrients[0].recorded<items.length&&<Text style={[s.coverage,{color:theme.textSecondary}]}>Calories entered for {nutrients[0].recorded} of {items.length} foods</Text>}
      </View>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{nutrients.slice(1).map(n=><View key={n.key} accessible accessibilityLabel={`${n.label}: ${n.value==null?'Not entered':`${n.value} ${n.unit}`}. Entered for ${n.recorded} of ${n.total} foods.`} style={{flexBasis:'47%',flexGrow:1,backgroundColor:theme.surface,borderRadius:14,padding:14,minHeight:88}}>
        <Text style={{color:theme.textSecondary,fontSize:12,marginBottom:8,fontFamily:'Inter_500Medium'}}>{n.label}</Text><Text style={{color:theme.text,fontSize:23,fontFamily:'SpaceGrotesk_700Bold'}}>{n.value??'—'}<Text style={{fontSize:12,color:theme.textSecondary}}> g</Text></Text>
        {n.recorded>0&&n.recorded<n.total&&<Text style={[s.coverage,{color:theme.textSecondary}]}>{n.recorded}/{n.total} foods recorded</Text>}
      </View>)}</View>
      {nutrients.some(n=>n.value==null)&&<Text style={{color:theme.textSecondary,fontSize:11,marginTop:12}}>— Not entered</Text>}
    </View>}
    <View style={s.listHeading}><Text style={[s.sectionTitle, { color: theme.text }]}>{date === todayStr ? 'Today’s food' : `Food · ${formatShortDate(date)}`}</Text>{loading ? <ActivityIndicator size="small" color={theme.textSecondary} /> : <Text style={[s.small, { color: theme.textSecondary }]}>{items.length} entr{items.length === 1 ? 'y' : 'ies'}</Text>}</View>
    {error ? <View style={s.empty}><Text style={[s.captureBody, { color: theme.textSecondary }]}>Food entries could not be loaded.</Text><TouchableOpacity onPress={onRetry} style={s.retry} accessibilityRole="button"><Text style={[s.link, { color: theme.text }]}>Try again</Text></TouchableOpacity></View> : !items.length && !loading ? <View style={s.empty}><Ionicons name="restaurant-outline" size={26} color={theme.textSecondary} /><Text style={[s.emptyTitle, { color: theme.text }]}>No food logged for this day</Text><Text style={[s.captureBody, { color: theme.textSecondary }]}>Your food entries and nutrition will appear here.</Text></View> : items.map(item => <FoodRow key={item.id} item={item} details={details} canEdit={canLog} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} theme={theme} />)}
    <Text style={[s.localNote, { color: theme.textSecondary }]}>Food and nutrition sync to your account. Photos and portion notes stay on this device.</Text>
  </>;
}
function FoodRow({ item, details, canEdit, onEdit, onDelete, theme }: { item: FoodItem; details: FoodDetailMap; canEdit: boolean; onEdit: () => void; onDelete: () => void; theme: AppTheme }) {
  const detail = details[item.id];
  const [imageError, setImageError] = useState(false);
  useEffect(() => setImageError(false), [detail?.photoUri]);
  const content = <><View style={[s.thumbnail, { backgroundColor: theme.surface }]}>{detail?.photoUri && !imageError ? <Image source={{ uri: detail.photoUri }} style={s.thumbnailImage} onError={() => setImageError(true)} accessibilityLabel={`Photo of ${item.name}`} /> : <Ionicons name="restaurant-outline" size={22} color={theme.textSecondary} />}</View><View style={{ flex: 1, minWidth: 0 }}><Text style={[s.foodName, { color: theme.text }]}>{item.name}</Text><Text style={[s.small, { color: theme.textSecondary }]}>{item.mealTime.charAt(0).toUpperCase() + item.mealTime.slice(1)}{detail?.portion ? ` · ${detail.portion}` : ''}</Text><Text style={[s.small, { color: theme.textSecondary }]}>{[item.calories != null ? `${item.calories} kcal` : null, item.protein != null ? `${item.protein} g protein` : null].filter(Boolean).join(' · ') || 'Nutrition not entered'}</Text>{detail?.source === 'photo' && <Text style={[s.coverage, { color: theme.textSecondary }]}>Photo-assisted estimate</Text>}</View>{canEdit && <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />}</>;
  return <View style={[s.foodRow, { backgroundColor: theme.card, borderColor: theme.border }]}><TouchableOpacity onPress={onEdit} disabled={!canEdit} accessibilityRole="button" accessibilityLabel={`Edit ${item.name}`} style={s.foodRowMain}>{content}</TouchableOpacity>{canEdit && <TouchableOpacity onPress={onDelete} style={s.deleteButton} accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`}><Ionicons name="trash-outline" size={17} color={theme.textSecondary} /></TouchableOpacity>}</View>;
}
const s = StyleSheet.create({
  modeTabs: { flexDirection: 'row', marginHorizontal: 16, padding: 4, borderRadius: 16, height: 48, marginBottom: 16 },
  modeTab: { flex: 1, minHeight: 40, paddingHorizontal: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabText: { fontSize: 12, lineHeight: 18, letterSpacing: 2.5, fontFamily: 'Inter_900Black', flexShrink: 1, textAlign: 'center' },
  summaryTabs: { alignSelf: 'flex-end', flexDirection: 'row', padding: 3, borderRadius: 10, gap: 2, flexShrink: 1 },
  summaryTab: { minHeight: 36, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  summaryTabText: { fontSize: 10, lineHeight: 14, fontFamily: 'Inter_600SemiBold', flexShrink: 1 },
  mostCard: { marginHorizontal: 16, marginBottom: 18, padding: 18, borderRadius: 20 },
  summaryTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  summaryPeriod: { fontSize: 11, lineHeight: 16, opacity: 0.85, fontFamily: 'Inter_500Medium', marginTop: 4 },
  summaryNote: { fontSize: 11, lineHeight: 17, opacity: 0.85, marginTop: 16, fontFamily: 'Inter_400Regular' },
  foodRankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  rank: { fontSize: 13, fontFamily: 'Inter_500Medium', width: 16, opacity: 0.75 },
  rankHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  foodRankName: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_600SemiBold', flex: 1 },
  foodRankCount: { fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },
  rankTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  rankFill: { height: 5, borderRadius: 3 },
  captureCard: { marginHorizontal: 16, marginBottom: 18, padding: 20, borderRadius: 20, borderWidth: 1 },
  captureIcon: { height: 48, width: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  captureTitle: { fontSize: 20, lineHeight: 27, fontFamily: 'BricolageGrotesque_800ExtraBold' },
  captureBody: { fontSize: 13, lineHeight: 20, fontFamily: 'Inter_500Medium', marginTop: 7 },
  addFood: { minHeight: 48, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
  link: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  nutritionCard: { marginHorizontal: 16, marginBottom: 20, padding: 20, borderRadius: 20, borderWidth: 1 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  small: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_500Medium', marginTop: 3 },
  nutrientGrid: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 18, rowGap: 18 },
  nutrient: { width: '33.333%', paddingRight: 8 },
  nutrientValue: { fontSize: 23, lineHeight: 29, fontFamily: 'SpaceGrotesk_700Bold' },
  nutrientUnit: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  coverage: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', marginTop: 3 },
  listHeading: { marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  empty: { marginHorizontal: 24, paddingVertical: 20, alignItems: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 12 },
  foodRow: { marginHorizontal: 16, borderWidth: 1, borderRadius: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  foodRowMain: { flex: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumbnail: { width: 54, height: 54, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbnailImage: { width: '100%', height: '100%' },
  foodName: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_700Bold' },
  deleteButton: { width: 44, minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  retry: { minHeight: 44, marginHorizontal: 20, marginBottom: 12, alignItems: 'center', justifyContent: 'center' },
  localNote: { fontSize: 11, lineHeight: 17, marginHorizontal: 20, marginTop: 14, marginBottom: 24, fontFamily: 'Inter_400Regular' },
});
