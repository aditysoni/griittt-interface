import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { DarkBackground } from '../../components/DarkBackground';
import { useTheme } from '../../components/ThemeContext';
import { useAuth } from '../../lib/auth';
import { fuel, FuelMonthlyAnalysis, AiAnalysis } from '../../lib/api';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorState } from '../../components/ErrorState';
import { AiAnalysisButton, AiAnalysisCard } from '../../components/AiAnalysisCard';

function FoodCard({ food, month, token, theme }: {
  food: FuelMonthlyAnalysis['topFoods'][number]; month: string; token: string; theme: any;
}) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult]   = useState<AiAnalysis | null>(null);

  async function runAnalysis() {
    setAiLoading(true);
    try {
      const res = await fuel.foodAiAnalysis(token, food.name, month);
      setAiResult(res);
    } catch {
      // silently no-op — the button just stays available to retry
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={s.heroTop}>
        <Text style={[s.foodName, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{food.name}</Text>
        <View style={[s.rankPill, { backgroundColor: theme.accent }]}>
          <Text style={[s.rankText, { color: theme.accentText, fontFamily: 'SpaceGrotesk_700Bold' }]}>
            #{food.rank} this month
          </Text>
        </View>
      </View>

      <View style={s.statRow}>
        <View style={[s.statPill, { backgroundColor: theme.surface }]}>
          <Text style={[s.statValue, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{food.count}× eaten</Text>
          <Text style={[s.statLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>THIS MONTH</Text>
        </View>
        <View style={[s.statPill, { backgroundColor: theme.surface }]}>
          <Text style={[s.statValue, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{food.daysEaten} days</Text>
          <Text style={[s.statLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>DAYS EATEN</Text>
        </View>
      </View>

      {food.percentile != null && (
        <View style={[s.compareRow, { borderTopColor: theme.border }]}>
          <View style={[s.compareIcon, { backgroundColor: theme.text }]}>
            <Ionicons name="stats-chart" size={13} color={theme.accent} />
          </View>
          <Text style={[s.compareText, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            You eat this more than{' '}
            <Text style={{ color: theme.text, fontFamily: 'Inter_900Black' }}>{food.percentile}% of users</Text>.
          </Text>
        </View>
      )}

      <View style={[s.macroGrid, { borderTopColor: theme.border }]}>
        <View style={s.macroCell}>
          <Text style={[s.macroValue, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{Math.round(food.nutrition.calories)}</Text>
          <Text style={[s.macroLabel, { color: theme.textMuted }]}>KCAL · {food.contribution.caloriesPct}%</Text>
        </View>
        <View style={s.macroCell}>
          <Text style={[s.macroValue, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{Math.round(food.nutrition.protein)}g</Text>
          <Text style={[s.macroLabel, { color: theme.textMuted }]}>PROTEIN · {food.contribution.proteinPct}%</Text>
        </View>
        <View style={s.macroCell}>
          <Text style={[s.macroValue, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{Math.round(food.nutrition.carbs)}g</Text>
          <Text style={[s.macroLabel, { color: theme.textMuted }]}>CARBS · {food.contribution.carbsPct}%</Text>
        </View>
        <View style={s.macroCell}>
          <Text style={[s.macroValue, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{Math.round(food.nutrition.fat)}g</Text>
          <Text style={[s.macroLabel, { color: theme.textMuted }]}>FAT · {food.contribution.fatPct}%</Text>
        </View>
      </View>

      <View style={{ marginTop: 16 }}>
        <AiAnalysisButton loading={aiLoading} onPress={runAnalysis} theme={theme} label="AI ANALYSIS" />
      </View>
      {aiResult && (
        <View style={{ marginTop: 12 }}>
          <AiAnalysisCard result={aiResult} theme={theme} />
        </View>
      )}
    </View>
  );
}

export default function BuildingYouScreen() {
  const { theme } = useTheme();
  const { token } = useAuth();
  const router = useRouter();

  const [data, setData]           = useState<FuelMonthlyAnalysis | null>(null);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!token) return;
    fuel.monthlyAnalysis(token)
      .then(res => { setData(res); setLoadError(false); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingScreen />;

  return (
    <DarkBackground><SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <Text style={[s.eyebrow, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
            NUTRITION · THIS MONTH
          </Text>
          <TouchableOpacity
            style={[s.sparkBtn, { backgroundColor: theme.text }]}
            onPress={() => router.push('/(tabs)/ai')}
            activeOpacity={0.85}
          >
            <Ionicons name="sparkles" size={18} color={theme.accent} />
          </TouchableOpacity>
        </View>
        <Text style={[s.title, { color: theme.text, fontFamily: 'Inter_900Black' }]}>What's Building You</Text>
        <Text style={[s.subtitle, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>
          The foods shaping your body this month.
        </Text>

        {loadError && (
          <ErrorState
            message="Couldn't load your nutrition breakdown."
            onRetry={() => {
              if (!token) return;
              setLoading(true);
              fuel.monthlyAnalysis(token).then(setData).catch(() => setLoadError(true)).finally(() => setLoading(false));
            }}
          />
        )}

        {!loadError && data && !data.eligible && (
          <View style={[s.lockedCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="lock-closed-outline" size={28} color={theme.textMuted} />
            <Text style={[s.lockedTitle, { color: theme.text, fontFamily: 'Inter_800ExtraBold' }]}>
              Keep logging to unlock this
            </Text>
            <Text style={[s.lockedBody, { color: theme.textSecondary }]}>
              Log food for {data.daysNeeded} days this month to see which foods are actually shaping your body —
              you're at {data.totalDaysTracked} of {data.daysNeeded}.
            </Text>
            <View style={[s.lockedBarTrack, { backgroundColor: theme.surface }]}>
              <View style={[s.lockedBarFill, {
                backgroundColor: theme.accent,
                width: `${Math.min(100, Math.round((data.totalDaysTracked / data.daysNeeded) * 100))}%`,
              }]} />
            </View>
          </View>
        )}

        {!loadError && data && data.eligible && data.topFoods.length === 0 && (
          <View style={[s.lockedCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[s.lockedTitle, { color: theme.text, fontFamily: 'Inter_800ExtraBold' }]}>
              No food logged yet this month
            </Text>
          </View>
        )}

        {!loadError && data?.eligible && data.topFoods.length > 0 && (
          <View style={{ gap: 16, marginTop: 22 }}>
            {data.topFoods.map(food => (
              <FoodCard key={food.name} food={food} month={data.month} token={token!} theme={theme} />
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView></DarkBackground>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow:  { fontSize: 11, letterSpacing: 2 },
  sparkBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title:    { fontSize: 40, letterSpacing: -1.5, marginTop: 14, lineHeight: 44 },
  subtitle: { fontSize: 15, marginTop: 8 },

  lockedCard:    { marginTop: 22, borderWidth: 1, borderRadius: 22, padding: 24, alignItems: 'center', gap: 8 },
  lockedTitle:   { fontSize: 16, marginTop: 4, textAlign: 'center' },
  lockedBody:    { fontSize: 13, lineHeight: 19, textAlign: 'center', fontFamily: 'Inter_500Medium' },
  lockedBarTrack:{ width: '100%', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 8 },
  lockedBarFill: { height: '100%', borderRadius: 4 },

  card:     { borderWidth: 1, borderRadius: 22, padding: 20 },
  heroTop:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  foodName: { fontSize: 24, letterSpacing: -0.6, flexShrink: 1 },
  rankPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  rankText: { fontSize: 11 },

  statRow:   { flexDirection: 'row', gap: 12, marginTop: 16 },
  statPill:  { flex: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 14 },
  statValue: { fontSize: 17, letterSpacing: -0.3 },
  statLabel: { fontSize: 9, letterSpacing: 1, marginTop: 6 },

  compareRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 16, borderTopWidth: 1 },
  compareIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  compareText: { flex: 1, fontSize: 13, lineHeight: 19 },

  macroGrid:  { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, paddingTop: 16, borderTopWidth: 1, gap: 12 },
  macroCell:  { width: '46%', gap: 3 },
  macroValue: { fontSize: 16 },
  macroLabel: { fontSize: 9, letterSpacing: 0.5, fontFamily: 'Inter_700Bold' },
});
