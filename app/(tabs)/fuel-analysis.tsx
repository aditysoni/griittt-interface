import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Dimensions, Modal,
  PanResponder, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DarkBackground } from '../../components/DarkBackground';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { fuel, ai, FuelMonthlyAnalysis, MealTime, today } from '../../lib/api';
import { LoadingScreen } from '../../components/LoadingScreen';
import { useTheme } from '../../components/ThemeContext';
import * as ImagePicker from 'expo-image-picker';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W   = SCREEN_W - 32;
const SWIPE_THRESHOLD = 60;

// ── Lookup tables ──────────────────────────────────────────────────────────────

const FOOD_EMOJI: Record<string, string> = {
  egg: '🥚', chicken: '🍗', rice: '🍚', oat: '🌾', banana: '🍌',
  milk: '🥛', bread: '🍞', apple: '🍎', yogurt: '🥛', fish: '🐟',
  beef: '🥩', pasta: '🍝', salad: '🥗', tuna: '🐟', salmon: '🐟',
  paneer: '🧀', dal: '🫘', roti: '🫓', whey: '💪', protein: '💪',
};

function getEmoji(name: string): string {
  const l = name.toLowerCase();
  for (const [k, e] of Object.entries(FOOD_EMOJI)) if (l.includes(k)) return e;
  return '🍽️';
}

const SUPPORTS: Record<string, string[]> = {
  egg:     ['Muscle Growth', 'Recovery', 'Energy Stability', 'Satiety'],
  chicken: ['Lean Muscle', 'Recovery', 'Weight Management', 'Satiety'],
  fish:    ['Brain Health', 'Recovery', 'Heart Health', 'Muscle Growth'],
  oat:     ['Energy Stability', 'Digestive Health', 'Heart Health', 'Satiety'],
  rice:    ['Energy', 'Glycogen Replenishment', 'Training Performance'],
  banana:  ['Energy', 'Recovery', 'Potassium Intake', 'Digestive Health'],
  yogurt:  ['Gut Health', 'Protein Intake', 'Bone Health', 'Recovery'],
  beef:    ['Muscle Growth', 'Iron Intake', 'Recovery', 'Energy'],
  paneer:  ['Protein Intake', 'Bone Health', 'Muscle Growth', 'Satiety'],
  dal:     ['Protein Intake', 'Digestive Health', 'Energy', 'Recovery'],
  whey:    ['Muscle Growth', 'Recovery', 'Protein Goal Achievement', 'Satiety'],
  protein: ['Muscle Growth', 'Recovery', 'Protein Goal Achievement', 'Satiety'],
};

const FUTURE: Record<string, string[]> = {
  egg:     ['Recovery', 'Lean Muscle Development', 'Protein Goal Achievement'],
  chicken: ['Lean Muscle Growth', 'Fat Loss', 'Recovery'],
  oat:     ['Sustained Energy', 'Heart Health', 'Blood Sugar Stability'],
  rice:    ['Glycogen Optimization', 'Training Performance', 'Energy Stability'],
  fish:    ['Brain Performance', 'Joint Health', 'Muscle Recovery'],
  whey:    ['Muscle Hypertrophy', 'Faster Recovery', 'Protein Goal Achievement'],
  protein: ['Muscle Hypertrophy', 'Faster Recovery', 'Protein Goal Achievement'],
};

function getSupports(name: string): string[] {
  const l = name.toLowerCase();
  for (const [k, v] of Object.entries(SUPPORTS)) if (l.includes(k)) return v;
  return ['Energy', 'Recovery', 'Nutritional Balance'];
}

function getFuture(name: string): string[] {
  const l = name.toLowerCase();
  for (const [k, v] of Object.entries(FUTURE)) if (l.includes(k)) return v;
  return ['Improved Recovery', 'Performance Gains', 'Nutritional Balance'];
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function FuelAnalysisScreen() {
  const { token } = useAuth();
  const { theme }  = useTheme();
  const router     = useRouter();

  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analysis, setAnalysis]     = useState<FuelMonthlyAnalysis | null>(null);
  const [activeIdx, setActiveIdx]   = useState(0);
  const [logOpen, setLogOpen]       = useState(false);

  async function load() {
    if (!token) return;
    const data = await fuel.monthlyAnalysis(token).catch(() => null);
    setAnalysis(data);
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, [token]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [token]);

  if (loading) return <LoadingScreen />;

  const foods = analysis?.topFoods ?? [];
  const top   = foods[activeIdx] ?? null;

  const supports     = top ? getSupports(top.name) : [];
  const futureImpact = top ? getFuture(top.name)   : [];
  const emoji        = top ? getEmoji(top.name)     : '🍽️';

  return (
    <DarkBackground>
      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Header */}
        <View style={s.topBar}>
          <TouchableOpacity style={[s.backBtn, { borderColor: theme.border }]} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={18} color={theme.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.eyebrow, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>NUTRITION · THIS MONTH</Text>
            <Text style={[s.pageTitle, { color: theme.text, fontFamily: 'Inter_900Black' }]}>What's Building You</Text>
          </View>
          <TouchableOpacity style={[s.sparkleBtn, { backgroundColor: theme.inverse }]} onPress={() => router.push('/(tabs)/ai')} activeOpacity={0.85}>
            <Ionicons name="sparkles" size={15} color={theme.isDark ? '#B8F23A' : '#16A34A'} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />}
        >
          <Text style={[s.pageSub, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            The foods shaping your body this month.
          </Text>

          {foods.length === 0 ? (
            /* ── Empty state ── */
            <View style={{ alignItems: 'center', paddingVertical: 64, gap: 16 }}>
              <Text style={{ fontSize: 56 }}>🍽️</Text>
              <Text style={[{ color: theme.text, fontSize: 20, fontFamily: 'Inter_900Black' }]}>Nothing logged yet</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 }}>
                Start logging your meals to see what's building your body this month.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: theme.text, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, marginTop: 8 }}
                onPress={() => setLogOpen(true)}
                activeOpacity={0.85}
              >
                <Text style={{ color: theme.bg, fontSize: 12, letterSpacing: 3, fontFamily: 'Inter_900Black' }}>LOG FIRST MEAL</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* ── SECTION 1: Swipeable hero card ── */}
              <SwipeableHeroCard
                foods={foods}
                activeIdx={activeIdx}
                onChangeIdx={setActiveIdx}
                theme={theme}
              />

              {top && (
                <>
                  {/* ── SECTION 2: Nutritional Contribution ── */}
                  <Text style={[s.sectionLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                    NUTRITIONAL CONTRIBUTION
                  </Text>
                  <View style={[s.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    {([
                      { label: 'Protein',  value: `${Math.round(top.nutrition.protein)}g`,                              color: '#0A84FF' },
                      { label: 'Calories', value: `${Math.round(top.nutrition.calories).toLocaleString()} kcal`,        color: '#FF9500' },
                      { label: 'Carbs',    value: `${Math.round(top.nutrition.carbs)}g`,                                color: '#34C759' },
                      { label: 'Fat',      value: `${Math.round(top.nutrition.fat)}g`,                                  color: '#FFD60A' },
                    ] as { label: string; value: string; color: string }[]).map((row, i, arr) => (
                      <View key={row.label} style={[s.nutritionRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                        <Text style={[s.nutritionLabel, { color: theme.text, fontFamily: 'Inter_500Medium' }]}>{row.label}</Text>
                        <Text style={[s.nutritionVal, { color: row.color, fontFamily: 'Inter_900Black' }]}>{row.value}</Text>
                      </View>
                    ))}
                  </View>

                  {/* ── SECTION 3: This food contributed ── */}
                  <Text style={[s.sectionLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                    THIS FOOD CONTRIBUTED
                  </Text>
                  <View style={{ gap: 8 }}>
                    <ContribRow pct={top.contribution.proteinPct}  label="of your monthly protein intake"   color="#0A84FF" theme={theme} />
                    <ContribRow pct={top.contribution.caloriesPct} label="of your total calories"           color="#FF9500" theme={theme} />
                    <ContribRow pct={top.contribution.fatPct}      label="of your total fat intake"         color="#FFD60A" theme={theme} />
                  </View>

                  {/* ── SECTION 4a: What this food supports ── */}
                  <Text style={[s.sectionLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                    WHAT THIS FOOD SUPPORTS
                  </Text>
                  <View style={[s.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    {supports.map((benefit, i) => (
                      <View key={benefit} style={[s.benefitRow, i < supports.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                        <View style={[s.iconCircle, { backgroundColor: '#34C75918' }]}>
                          <Ionicons name="checkmark" size={13} color="#34C759" />
                        </View>
                        <Text style={[s.benefitText, { color: theme.text, fontFamily: 'Inter_600SemiBold' }]}>{benefit}</Text>
                      </View>
                    ))}
                  </View>

                  {/* ── SECTION 4b: Future impact ── */}
                  <Text style={[s.sectionLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                    FUTURE IMPACT IF MAINTAINED
                  </Text>
                  <View style={[s.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    {futureImpact.map((impact, i) => (
                      <View key={impact} style={[s.benefitRow, i < futureImpact.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                        <View style={[s.iconCircle, { backgroundColor: '#34C75918' }]}>
                          <Ionicons name="arrow-up" size={13} color="#34C759" />
                        </View>
                        <Text style={[s.benefitText, { color: theme.text, fontFamily: 'Inter_600SemiBold' }]}>{impact}</Text>
                      </View>
                    ))}
                  </View>

                  {/* ── Top foods ranking ── */}
                  <Text style={[s.sectionLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                    TOP FOODS RANKING
                  </Text>
                  <View style={[s.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    {foods.map((food, i) => (
                      <TouchableOpacity
                        key={food.name}
                        style={[s.rankRow,
                          i < foods.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
                          activeIdx === i && { backgroundColor: theme.surface },
                        ]}
                        onPress={() => setActiveIdx(i)}
                        activeOpacity={0.7}
                      >
                        <View style={[s.rankNum, { backgroundColor: i === 0 ? theme.inverse : theme.surface }]}>
                          <Text style={[s.rankNumText, { color: i === 0 ? theme.inverseText : theme.textSecondary, fontFamily: 'Inter_900Black' }]}>
                            {i + 1}
                          </Text>
                        </View>
                        <Text style={[s.rankFoodName, { color: theme.text, fontFamily: activeIdx === i ? 'Inter_700Bold' : 'Inter_500Medium' }]} numberOfLines={1}>
                          {food.name}
                        </Text>
                        <Text style={[s.rankCount, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                          {food.count}×
                        </Text>
                        {i === activeIdx && (
                          <Ionicons name="eye" size={13} color={theme.textSecondary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>

        {/* FAB */}
        <TouchableOpacity style={[s.fab, { backgroundColor: theme.text }]} onPress={() => setLogOpen(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={26} color={theme.bg} />
        </TouchableOpacity>

        <LogFoodModal
          open={logOpen}
          token={token!}
          theme={theme}
          onClose={() => setLogOpen(false)}
          onSaved={() => { setLogOpen(false); load(); }}
        />
      </SafeAreaView>
    </DarkBackground>
  );
}

// ── Swipeable hero card ────────────────────────────────────────────────────────

type TopFood = FuelMonthlyAnalysis['topFoods'][number];

function SwipeableHeroCard({
  foods, activeIdx, onChangeIdx, theme,
}: {
  foods: TopFood[];
  activeIdx: number;
  onChangeIdx: (i: number) => void;
  theme: any;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const activeIdxRef = useRef(activeIdx);
  const foodsRef     = useRef(foods);

  useEffect(() => { activeIdxRef.current = activeIdx; }, [activeIdx]);
  useEffect(() => { foodsRef.current = foods; }, [foods]);

  // Animate card in from direction whenever activeIdx changes externally (ranking tap)
  const prevIdxRef = useRef(activeIdx);
  useEffect(() => {
    if (prevIdxRef.current === activeIdx) return;
    const dir = activeIdx > prevIdxRef.current ? -SCREEN_W : SCREEN_W;
    translateX.setValue(dir);
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    prevIdxRef.current = activeIdx;
  }, [activeIdx]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => { translateX.setValue(g.dx); },
      onPanResponderRelease: (_, g) => {
        const idx   = activeIdxRef.current;
        const total = foodsRef.current.length;

        if (g.dx < -SWIPE_THRESHOLD && idx < total - 1) {
          // Swipe left → next
          Animated.spring(translateX, { toValue: -CARD_W, useNativeDriver: true, damping: 20, stiffness: 220 }).start(() => {
            translateX.setValue(0);
            onChangeIdx(idx + 1);
          });
        } else if (g.dx > SWIPE_THRESHOLD && idx > 0) {
          // Swipe right → previous
          Animated.spring(translateX, { toValue: CARD_W, useNativeDriver: true, damping: 20, stiffness: 220 }).start(() => {
            translateX.setValue(0);
            onChangeIdx(idx - 1);
          });
        } else {
          // Snap back
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 260 }).start();
        }
      },
    })
  ).current;

  const food  = foods[activeIdx];
  const emoji = food ? getEmoji(food.name) : '🍽️';

  if (!food) return null;

  return (
    <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...pan.panHandlers}
      >
        <View style={[sw.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Food image area */}
          <View style={[sw.imageBox, { backgroundColor: theme.surface }]}>
            {/* Rank label top-left */}
            <View style={[sw.rankOverlay, { backgroundColor: theme.card }]}>
              <Text style={[sw.rankOverlayText, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                #{food.rank} OF {foods.length}
              </Text>
            </View>

            <Text style={sw.emoji}>{emoji}</Text>

            {/* Swipe hint */}
            <View style={sw.swipeHint}>
              {activeIdx > 0 && (
                <Ionicons name="chevron-back" size={16} color={theme.textSecondary} style={{ opacity: 0.5 }} />
              )}
              <View style={{ flex: 1 }} />
              {activeIdx < foods.length - 1 && (
                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} style={{ opacity: 0.5 }} />
              )}
            </View>
          </View>

          {/* Food info */}
          <View style={sw.body}>
            <View style={sw.nameRow}>
              <Text style={[sw.foodName, { color: theme.text, fontFamily: 'Inter_900Black' }]} numberOfLines={1}>
                {food.name}
              </Text>
              {food.rank === 1 && (
                <View style={sw.badge}>
                  <Text style={[sw.badgeText, { fontFamily: 'Inter_700Bold' }]}>#1 this month</Text>
                </View>
              )}
            </View>

            <View style={sw.statsRow}>
              <View style={[sw.statBox, { backgroundColor: theme.surface }]}>
                <Text style={[sw.statVal, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{food.count}×</Text>
                <Text style={[sw.statLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>CONSUMED</Text>
              </View>
              <View style={[sw.statBox, { backgroundColor: theme.surface }]}>
                <Text style={[sw.statVal, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{food.daysEaten} days</Text>
                <Text style={[sw.statLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>DAYS EATEN</Text>
              </View>
            </View>

            <View style={[sw.insightRow, { backgroundColor: theme.surface }]}>
              <Ionicons name="bar-chart-outline" size={15} color={theme.text} />
              <Text style={[sw.insightText, { color: theme.text, fontFamily: 'Inter_500Medium' }]}>
                Rank <Text style={{ fontFamily: 'Inter_900Black' }}>#{food.rank}</Text> by frequency this month
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Dot indicators */}
      <View style={sw.dots}>
        {foods.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => onChangeIdx(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <View style={[sw.dot, {
              backgroundColor: i === activeIdx ? theme.text : theme.border,
              width: i === activeIdx ? 16 : 6,
            }]} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const sw = StyleSheet.create({
  card:       { borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  imageBox:   { height: 200, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  rankOverlay:{ position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  rankOverlayText: { fontSize: 10, letterSpacing: 1.5 },
  emoji:      { fontSize: 72 },
  swipeHint:  { position: 'absolute', bottom: 10, left: 14, right: 14, flexDirection: 'row', alignItems: 'center' },
  body:       { padding: 16, gap: 12 },
  nameRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  foodName:   { fontSize: 24, letterSpacing: -0.5, flex: 1 },
  badge:      { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#B8F23A' },
  badgeText:  { fontSize: 10, color: '#14110D' },
  statsRow:   { flexDirection: 'row', gap: 10 },
  statBox:    { flex: 1, borderRadius: 12, padding: 12, gap: 3 },
  statVal:    { fontSize: 18, letterSpacing: -0.5 },
  statLabel:  { fontSize: 8, letterSpacing: 2 },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12 },
  insightText:{ fontSize: 13, flex: 1, lineHeight: 18 },
  dots:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
  dot:        { height: 6, borderRadius: 3 },
});

// ── Contribution row ──────────────────────────────────────────────────────────

function ContribRow({ pct, label, color, theme }: { pct: number; label: string; color: string; theme: any }) {
  return (
    <View style={[cr.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[cr.circle, { borderColor: theme.border }]}>
        <View style={[cr.circleAccent, { borderColor: color }]} />
        <Text style={[cr.pct, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{pct}%</Text>
      </View>
      <Text style={[cr.label, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>{label}</Text>
    </View>
  );
}

const cr = StyleSheet.create({
  card:        { flexDirection: 'row', alignItems: 'center', gap: 16, marginHorizontal: 16, padding: 16, borderWidth: 1, borderRadius: 14 },
  circle:      { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  circleAccent:{ position: 'absolute', width: 56, height: 56, borderRadius: 28, borderWidth: 3, opacity: 0.6 },
  pct:         { fontSize: 13 },
  label:       { flex: 1, fontSize: 13, lineHeight: 18 },
});

// ── Log Food modal ────────────────────────────────────────────────────────────

function LogFoodModal({ open, token, theme, onClose, onSaved }: {
  open: boolean; token: string; theme: any;
  onClose: () => void; onSaved: () => void;
}) {
  const [name, setName]         = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein]   = useState('');
  const [carbs, setCarbs]       = useState('');
  const [fat, setFat]           = useState('');
  const [mealTime, setMealTime] = useState<MealTime>('morning');
  const [saving, setSaving]     = useState(false);
  const [scanning, setScanning] = useState(false);

  function reset() { setName(''); setCalories(''); setProtein(''); setCarbs(''); setFat(''); setMealTime('morning'); }

  async function handleSnap() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo library access in Settings.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images' as any, quality: 0.7, base64: true, allowsEditing: true, aspect: [4, 3] });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    setScanning(true);
    try {
      const b64 = result.assets[0].base64!;
      const data = await ai.snapTrack(token, `data:image/jpeg;base64,${b64}`);
      setName(data.name);
      setCalories(data.calories ? String(Math.round(data.calories)) : '');
      setProtein(data.protein   ? String(Math.round(data.protein))  : '');
      setCarbs(data.carbs       ? String(Math.round(data.carbs))    : '');
      const fatVal = (data as any).fat ?? data.fats;
      setFat(fatVal ? String(Math.round(fatVal)) : '');
    } catch (e: any) { Alert.alert('Snap failed', e.message); }
    finally { setScanning(false); }
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Name required', 'Enter a food name.'); return; }
    setSaving(true);
    try {
      await fuel.addItem(token, {
        date: today(), name: name.trim(), mealTime,
        calories: calories ? Number(calories) : undefined,
        protein:  protein  ? Number(protein)  : undefined,
        fat:      fat      ? Number(fat)      : undefined,
        carbs:    carbs    ? Number(carbs)    : undefined,
      });
      reset(); onSaved();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  const MEAL_TIMES: { label: string; value: MealTime; icon: string }[] = [
    { label: 'MORNING',   value: 'morning', icon: '🌅' },
    { label: 'AFTERNOON', value: 'lunch',   icon: '☀️' },
    { label: 'EVENING',   value: 'evening', icon: '🌆' },
    { label: 'DINNER',    value: 'dinner',  icon: '🍽️' },
  ];

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
      <View style={[lm.sheet, { backgroundColor: theme.bg }]}>
        <View style={[lm.handle, { backgroundColor: theme.border }]} />
        <View style={[lm.header, { borderBottomColor: theme.border }]}>
          <Text style={[lm.title, { color: theme.text, fontFamily: 'Inter_900Black' }]}>LOG FOOD</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Ionicons name="close" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={lm.body} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={[lm.snapBtn, { borderColor: theme.border, backgroundColor: theme.surface, opacity: scanning ? 0.6 : 1 }]} onPress={handleSnap} disabled={scanning} activeOpacity={0.7}>
            {scanning ? <ActivityIndicator size="small" color={theme.text} /> : <Ionicons name="images-outline" size={18} color={theme.text} />}
            <Text style={[lm.snapBtnText, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>{scanning ? 'ANALYSING...' : 'SNAP FROM GALLERY'}</Text>
          </TouchableOpacity>

          <View style={[lm.inputBox, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Ionicons name="fast-food-outline" size={15} color={theme.textSecondary} style={{ marginRight: 8 }} />
            <TextInput style={[lm.nameInput, { color: theme.text, fontFamily: 'Inter_700Bold' }]} value={name} onChangeText={setName} placeholder="Food name..." placeholderTextColor={theme.textSecondary} autoCapitalize="words" />
          </View>

          <View style={[lm.macroGrid, { borderColor: theme.border }]}>
            {([
              { label: 'CALORIES', val: calories, set: setCalories, color: '#FF9500', unit: 'kcal' },
              { label: 'PROTEIN',  val: protein,  set: setProtein,  color: '#0A84FF', unit: 'g'    },
              { label: 'CARBS',    val: carbs,    set: setCarbs,    color: '#34C759', unit: 'g'    },
              { label: 'FAT',      val: fat,      set: setFat,      color: '#FFD60A', unit: 'g'    },
            ] as { label: string; val: string; set: (v: string) => void; color: string; unit: string }[]).map((m, i) => (
              <View key={m.label} style={[lm.macroCell, i % 2 === 1 && { borderLeftWidth: 1, borderLeftColor: theme.border }, i >= 2 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                <Text style={[lm.macroCellLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{m.label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                  <TextInput style={[lm.macroCellInput, { color: m.color, fontFamily: 'SpaceGrotesk_700Bold' }]} value={m.val} onChangeText={m.set} placeholder="—" placeholderTextColor={theme.textMuted} keyboardType="decimal-pad" />
                  <Text style={{ fontSize: 10, color: theme.textMuted }}>{m.unit}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={[lm.whenLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>WHEN</Text>
          <View style={lm.mealRow}>
            {MEAL_TIMES.map(mt => (
              <TouchableOpacity key={mt.value} style={[lm.mealChip, { backgroundColor: mealTime === mt.value ? theme.text : theme.surface, borderColor: mealTime === mt.value ? theme.text : theme.border }]} onPress={() => setMealTime(mt.value)} activeOpacity={0.7}>
                <Text style={lm.mealChipIcon}>{mt.icon}</Text>
                <Text style={[lm.mealChipLabel, { color: mealTime === mt.value ? theme.bg : theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{mt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={[lm.saveBtn, { backgroundColor: theme.text, opacity: (!name.trim() || saving) ? 0.4 : 1 }]} onPress={handleSave} disabled={!name.trim() || saving} activeOpacity={0.85}>
            <Text style={[lm.saveBtnText, { color: theme.bg, fontFamily: 'Inter_900Black' }]}>{saving ? 'SAVING...' : 'LOG FOOD →'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:       { flex: 1 },
  topBar:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12 },
  backBtn:    { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow:    { fontSize: 10, letterSpacing: 2, marginBottom: 2 },
  pageTitle:  { fontSize: 24, letterSpacing: -0.5, lineHeight: 26 },
  sparkleBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  scroll:     { paddingBottom: 120 },
  pageSub:    { fontSize: 14, lineHeight: 20, paddingHorizontal: 20, marginBottom: 20 },
  sectionLabel:{ fontSize: 9, letterSpacing: 3, marginHorizontal: 20, marginTop: 24, marginBottom: 10 },
  listCard:   { marginHorizontal: 16, borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  nutritionRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  nutritionLabel:{ fontSize: 15 },
  nutritionVal:{ fontSize: 20 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  iconCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  benefitText:{ fontSize: 15 },
  rankRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rankNum:    { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rankNumText:{ fontSize: 13 },
  rankFoodName:{ flex: 1, fontSize: 15 },
  rankCount:  { fontSize: 12, fontFamily: 'Inter_500Medium' },
  fab:        { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
});

const lm = StyleSheet.create({
  sheet:        { flex: 1, paddingTop: 8 },
  handle:       { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  title:        { fontSize: 14, letterSpacing: 3 },
  body:         { padding: 20, gap: 14, paddingBottom: 48 },
  snapBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 14 },
  snapBtnText:  { fontSize: 11, letterSpacing: 2 },
  inputBox:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  nameInput:    { flex: 1, fontSize: 15 },
  macroGrid:    { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  macroCell:    { width: '50%', padding: 14, gap: 6 },
  macroCellLabel:{ fontSize: 9, letterSpacing: 1.5 },
  macroCellInput:{ fontSize: 26, letterSpacing: -0.5, lineHeight: 30, minWidth: 50, paddingVertical: 0 },
  whenLabel:    { fontSize: 9, letterSpacing: 2.5 },
  mealRow:      { flexDirection: 'row', gap: 8 },
  mealChip:     { flex: 1, alignItems: 'center', paddingVertical: 10, borderWidth: 1, borderRadius: 10, gap: 4 },
  mealChipIcon: { fontSize: 14 },
  mealChipLabel:{ fontSize: 7, letterSpacing: 1 },
  saveBtn:      { paddingVertical: 16, alignItems: 'center', borderRadius: 12, marginTop: 8 },
  saveBtnText:  { fontSize: 12, letterSpacing: 3 },
});
