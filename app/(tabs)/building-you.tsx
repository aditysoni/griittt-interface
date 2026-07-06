import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { DarkBackground } from '../../components/DarkBackground';
import { useTheme } from '../../components/ThemeContext';

// ── Static content for the monthly top-food breakdown ────────────────────────────
// (Design page — mirrors the "What's Building You" spec. Wire to /fuel data later.)
const FOOD = {
  name: 'Eggs',
  image: 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?w=900&q=80',
  rank: '#1 this month',
  consumed: '114 eggs',
  daysEaten: '24 / 30 days',
  percentileText: '68% of users',
};

const CONTRIBUTION = [
  { label: 'Protein',  value: '684g'   },
  { label: 'Calories', value: '7,980'  },
  { label: 'Carbs',    value: '12g'    },
  { label: 'Fat',      value: '570g'   },
  { label: 'Fiber',    value: '0g'     },
];

const CONTRIBUTED = [
  { pct: 38, label: 'of your monthly protein intake' },
  { pct: 12, label: 'of your total calories' },
  { pct: 22, label: 'of your recovery nutrition score' },
];

const SUPPORTS = ['Muscle Growth', 'Recovery', 'Energy Stability', 'Satiety'];
const FUTURE   = ['Recovery', 'Lean Muscle Development', 'Protein Goal Achievement'];

// ── Small circular progress ring ─────────────────────────────────────────────────
function MiniRing({ pct, theme }: { pct: number; theme: any }) {
  const size = 44;
  const sw   = 4;
  const r    = (size - sw) / 2;
  const c    = 2 * Math.PI * r;
  const cx   = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cx} r={r} fill="none" stroke={theme.surfaceStrong} strokeWidth={sw} />
        <Circle
          cx={cx} cy={cx} r={r} fill="none"
          stroke={theme.accent} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          transform={`rotate(-90 ${cx} ${cx})`}
        />
      </Svg>
      <Text style={[s.ringPct, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{pct}%</Text>
    </View>
  );
}

export default function BuildingYouScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const softGreen = theme.isDark ? 'rgba(52,199,89,0.16)' : 'rgba(34,166,100,0.14)';

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

        {/* Hero food card */}
        <View style={[s.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Image source={{ uri: FOOD.image }} style={s.heroImg} resizeMode="cover" />
          <View style={s.heroBody}>
            <View style={s.heroTop}>
              <Text style={[s.foodName, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{FOOD.name}</Text>
              <View style={[s.rankPill, { backgroundColor: theme.accent }]}>
                <Text style={[s.rankText, { color: theme.accentText, fontFamily: 'SpaceGrotesk_700Bold' }]}>{FOOD.rank}</Text>
              </View>
            </View>

            <View style={s.statRow}>
              <View style={[s.statPill, { backgroundColor: theme.surface }]}>
                <Text style={[s.statValue, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{FOOD.consumed}</Text>
                <Text style={[s.statLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>CONSUMED THIS MONTH</Text>
              </View>
              <View style={[s.statPill, { backgroundColor: theme.surface }]}>
                <Text style={[s.statValue, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{FOOD.daysEaten}</Text>
                <Text style={[s.statLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>DAYS EATEN</Text>
              </View>
            </View>

            <View style={[s.compareRow, { borderTopColor: theme.border }]}>
              <View style={[s.compareIcon, { backgroundColor: theme.text }]}>
                <Ionicons name="stats-chart" size={13} color={theme.accent} />
              </View>
              <Text style={[s.compareText, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                You consume more eggs than{' '}
                <Text style={{ color: theme.text, fontFamily: 'Inter_900Black' }}>{FOOD.percentileText}</Text>.
              </Text>
            </View>
          </View>
        </View>

        {/* Nutritional contribution */}
        <Text style={[s.section, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>NUTRITIONAL CONTRIBUTION</Text>
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {CONTRIBUTION.map((row, i) => (
            <View key={row.label} style={[s.contribRow, i < CONTRIBUTION.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
              <Text style={[s.contribLabel, { color: theme.text, fontFamily: 'Inter_400Regular' }]}>{row.label}</Text>
              <Text style={[s.contribValue, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* This food contributed — rings */}
        <Text style={[s.section, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>THIS FOOD CONTRIBUTED</Text>
        <View style={{ gap: 12 }}>
          {CONTRIBUTED.map((row) => (
            <View key={row.label} style={[s.ringCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <MiniRing pct={row.pct} theme={theme} />
              <Text style={[s.ringLabel, { color: theme.text, fontFamily: 'Inter_400Regular' }]}>{row.label}</Text>
            </View>
          ))}
        </View>

        {/* What this food supports */}
        <Text style={[s.section, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>WHAT THIS FOOD SUPPORTS</Text>
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {SUPPORTS.map((item, i) => (
            <View key={item} style={[s.iconRow, i < SUPPORTS.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
              <View style={[s.iconCircle, { backgroundColor: softGreen }]}>
                <Ionicons name="checkmark" size={16} color={theme.success} />
              </View>
              <Text style={[s.iconRowText, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Future impact if maintained */}
        <Text style={[s.section, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>FUTURE IMPACT IF MAINTAINED</Text>
        <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border, marginBottom: 8 }]}>
          {FUTURE.map((item, i) => (
            <View key={item} style={[s.iconRow, i < FUTURE.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
              <View style={[s.iconCircle, { backgroundColor: softGreen }]}>
                <Ionicons name="arrow-up" size={16} color={theme.success} />
              </View>
              <Text style={[s.iconRowText, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{item}</Text>
            </View>
          ))}
        </View>

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

  // Hero
  heroCard: { marginTop: 22, borderWidth: 1, borderRadius: 22, overflow: 'hidden' },
  heroImg:  { width: '100%', height: 190 },
  heroBody: { padding: 20 },
  heroTop:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  foodName: { fontSize: 30, letterSpacing: -0.8 },
  rankPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  rankText: { fontSize: 12 },

  statRow:   { flexDirection: 'row', gap: 12, marginTop: 18 },
  statPill:  { flex: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 14 },
  statValue: { fontSize: 19, letterSpacing: -0.5 },
  statLabel: { fontSize: 9, letterSpacing: 1, marginTop: 6 },

  compareRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, paddingTop: 18, borderTopWidth: 1 },
  compareIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  compareText: { flex: 1, fontSize: 14, lineHeight: 20 },

  section: { fontSize: 11, letterSpacing: 2, marginTop: 32, marginBottom: 14 },

  card:         { borderWidth: 1, borderRadius: 20, paddingHorizontal: 20 },
  contribRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18 },
  contribLabel: { fontSize: 17 },
  contribValue: { fontSize: 19, letterSpacing: -0.3 },

  ringCard:  { flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderRadius: 18, padding: 16 },
  ringPct:   { position: 'absolute', fontSize: 11 },
  ringLabel: { flex: 1, fontSize: 16 },

  iconRow:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  iconCircle:  { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  iconRowText: { fontSize: 18, letterSpacing: -0.3 },
});
