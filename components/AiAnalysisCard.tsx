import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AiAnalysis } from '../lib/api';

function trendColor(trend: string): string {
  if (trend === 'improving' || trend === 'positive') return '#22A664';
  if (trend === 'declining' || trend === 'negative') return '#E84A4A';
  if (trend === 'insufficient_data') return '#8A8A8A';
  return '#0A84FF'; // steady / neutral
}

/** The "ASK AI" trigger button — same look everywhere an AI analysis can be run. */
export function AiAnalysisButton({ loading, onPress, theme, label = 'AI ANALYSIS', featured = false }: {
  loading: boolean; onPress: () => void; theme: any; label?: string; featured?: boolean;
}) {
  if (featured) return <TouchableOpacity onPress={onPress} disabled={loading} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={loading ? 'Analyzing your habit' : label} accessibilityState={{disabled:loading,busy:loading}} style={{backgroundColor:theme.card,borderWidth:1,borderColor:theme.text,borderRadius:20,padding:20,minHeight:96,flexDirection:'row',alignItems:'center',gap:14,opacity:loading?0.75:1}}>
    <View style={{width:42,height:42,borderRadius:14,backgroundColor:theme.surface,alignItems:'center',justifyContent:'center'}}>{loading?<ActivityIndicator color={theme.text}/>:<Ionicons name="sparkles-outline" size={21} color={theme.text}/>}</View>
    <View style={{flex:1}}><Text style={{color:theme.text,fontSize:16,fontFamily:'Inter_800ExtraBold'}}>{loading?'Finding your patterns…':label}</Text><Text style={{color:theme.text,opacity:0.7,fontSize:12,lineHeight:18,marginTop:4}}>Insights and next steps from your check-ins</Text></View>
    {!loading&&<Ionicons name="arrow-forward" size={20} color={theme.text}/>}</TouchableOpacity>;
  return (
    <TouchableOpacity
      style={[a.btn, {
        backgroundColor: '#34C75912',
        borderColor: '#34C75955',
        opacity: loading ? 0.6 : 1,
      }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator size="small" color="#34C759" />
        : <Ionicons name="sparkles" size={16} color="#34C759" />}
      <Text style={[a.btnText, { color: theme.text, fontFamily: 'Inter_800ExtraBold' }]}>
        {loading ? 'ANALYZING...' : label}
      </Text>
    </TouchableOpacity>
  );
}

/** Trend badge + headed sections — the standard "AI analysis result" card with subheaders. */
export function AiAnalysisCard({ result, theme }: { result: AiAnalysis; theme: any }) {
  const color = trendColor(result.trend);
  return (
    <View style={[a.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[a.trendPill, { backgroundColor: color + '20', alignSelf: 'flex-start' }]}>
        <Text style={{ fontSize: 10, letterSpacing: 1.5, color, fontFamily: 'Inter_900Black' }}>
          {result.trend.toUpperCase().replace('_', ' ')}
        </Text>
      </View>
      {result.sections.map((sec, i) => (
        <View key={i} style={{ marginTop: i === 0 ? 12 : 14 }}>
          <Text style={[a.heading, { color: theme.textSecondary, fontFamily: 'Inter_800ExtraBold' }]}>
            {sec.heading}
          </Text>
          <Text style={[a.body, { color: theme.text, fontFamily: 'Inter_500Medium', marginTop: 4 }]}>
            {sec.body}
          </Text>
        </View>
      ))}
    </View>
  );
}

const a = StyleSheet.create({
  btn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5 },
  btnText:  { fontSize: 13, letterSpacing: 0.3 },
  card:     { padding: 16, borderRadius: 16, borderWidth: 1 },
  trendPill:{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  heading:  { fontSize: 10, letterSpacing: 1.5 },
  body:     { fontSize: 13, lineHeight: 19 },
});
