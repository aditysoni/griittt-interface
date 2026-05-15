import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Modal, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DarkBackground } from '../../components/DarkBackground';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { fuel, ai, FoodLog, FoodItem, MealTime, today } from '../../lib/api';
import { LoadingScreen } from '../../components/LoadingScreen';
import { DaySelector } from '../../components/DaySelector';
import { useTheme } from '../../components/ThemeContext';
import * as ImagePicker from 'expo-image-picker';

type TabMode = 'quick' | 'detailed';
const QUALITY_LABELS = ['Terrible','Very poor','Poor','Below avg','Average','Average+','Good','Great','Excellent','Outstanding','Perfect'];

export default function FuelScreen() {
  const { token } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState(today());
  const [mode, setMode]                 = useState<TabMode>('quick');
  const [identity, setIdentity]         = useState<any>(null);
  const [logs, setLogs]                 = useState<FoodLog[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [history, setHistory]           = useState<Array<{ date: string; score: number | null }>>([]);

  const tabAnim = useRef(new Animated.Value(0)).current;
  const [tabContainerW, setTabContainerW] = useState(0);

  function switchMode(tab: TabMode) {
    setMode(tab);
    Animated.spring(tabAnim, {
      toValue: tab === 'quick' ? 0 : 1,
      useNativeDriver: false,
      damping: 18,
      stiffness: 220,
      mass: 0.8,
    }).start();
  }

  // Quick mode state
  const [stuckToMeal, setStuckToMeal]   = useState<boolean | null>(null);
  const [foodQuality, setFoodQuality]   = useState(7);
  const [hadJunk, setHadJunk]           = useState<boolean | null>(null);
  const [showQPicker, setShowQPicker]   = useState(false);

  // Detailed mode state (food items)
  const [foodItems, setFoodItems]       = useState<FoodItem[]>([]);
  const [itemName, setItemName]         = useState('');
  const [itemMealTime, setItemMealTime] = useState<MealTime>('morning');
  const [itemCalories, setItemCalories] = useState('');
  const [itemProtein, setItemProtein]   = useState('');
  const [itemFat, setItemFat]           = useState('');
  const [itemCarbs, setItemCarbs]       = useState('');
  const [addingItem, setAddingItem]     = useState(false);
  const [scanning, setScanning]         = useState(false);

  const isToday = selectedDate === today();

  const liveScore = React.useMemo(() => {
    return Math.round(
      (foodQuality / 10) * 50 +
      (stuckToMeal === true ? 30 : 0) +
      (hadJunk === false ? 20 : 0)
    );
  }, [stuckToMeal, foodQuality, hadJunk]);

  const todayScore = logs.length > 0 ? Math.max(...logs.map(l => l.score)) : (isToday ? liveScore : 0);

  async function load(date: string) {
    if (!token) return;
    const from = new Date(Date.now() - 13 * 86400000).toISOString().split('T')[0];
    const [id, dayLogs, items, hist] = await Promise.all([
      fuel.identity(token).catch(() => null),
      fuel.logs(token, date).catch(() => []),
      fuel.items(token, date).catch(() => []),
      fuel.history(token, from, date).catch(() => []),
    ]);
    setIdentity(id); setLogs(dayLogs); setFoodItems(items); setHistory(hist);
  }

  function resetDetailedForm() {
    setItemName(''); setItemMealTime('morning');
    setItemCalories(''); setItemProtein(''); setItemFat(''); setItemCarbs('');
  }

  async function handleSnapTrack(source: 'camera' | 'gallery') {
    const fn = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    let perms;
    if (source === 'camera') {
      perms = await ImagePicker.requestCameraPermissionsAsync();
    } else {
      perms = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }
    if (!perms.granted) { Alert.alert('Permission needed', 'Allow access in Settings.'); return; }

    const result = await fn({ mediaTypes: 'images' as any, quality: 0.7, base64: true, allowsEditing: true, aspect: [4, 3] });
    if (result.canceled || !result.assets?.[0]?.base64) return;

    setScanning(true);
    try {
      const data = await ai.snapTrack(token!, result.assets[0].base64!);
      setItemName(data.name);
      setItemCalories(data.calories ? String(Math.round(data.calories)) : '');
      setItemProtein(data.protein  ? String(Math.round(data.protein))  : '');
      setItemCarbs(data.carbs    ? String(Math.round(data.carbs))    : '');
      setItemFat(data.fats     ? String(Math.round(data.fats))     : '');
    } catch (err: any) { Alert.alert('Snap failed', err.message); }
    finally { setScanning(false); }
  }

  async function submitDetailedItem() {
    if (!token || !itemName.trim()) { Alert.alert('INCOMPLETE', 'Enter a food name.'); return; }
    setAddingItem(true);
    try {
      await fuel.addItem(token, {
        date: selectedDate,
        name: itemName.trim(),
        mealTime: itemMealTime,
        calories: itemCalories ? Number(itemCalories) : undefined,
        protein:  itemProtein  ? Number(itemProtein)  : undefined,
        fat:      itemFat      ? Number(itemFat)      : undefined,
        carbs:    itemCarbs    ? Number(itemCarbs)    : undefined,
      });
      resetDetailedForm();
      await load(selectedDate);
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setAddingItem(false); }
  }

  async function deleteItem(id: string) {
    if (!token) return;
    try {
      await fuel.deleteItem(token, id);
      setFoodItems(prev => prev.filter(i => i.id !== id));
    } catch (err: any) { Alert.alert('Error', err.message); }
  }

  useEffect(() => { load(selectedDate).finally(() => setLoading(false)); }, [token, selectedDate]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(selectedDate); setRefreshing(false); }, [token, selectedDate]);

  async function submitQuick() {
    if (!token || stuckToMeal === null || hadJunk === null) { Alert.alert('INCOMPLETE', 'Answer all three questions.'); return; }
    setSubmitting(true);
    try {
      await fuel.log(token, { mode: 'simple', date: selectedDate, hadThreeMeals: stuckToMeal, foodQuality, hadJunkFood: hadJunk });
      setStuckToMeal(null); setHadJunk(null); setFoodQuality(7);
      await load(selectedDate);
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setSubmitting(false); }
  }


  if (loading) return <LoadingScreen />;

  return (
    <DarkBackground><SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.topBar}>
        <Text style={[s.modeLabel, { color: theme.text, fontFamily: 'Inter_900Black' }]}>FUEL MODE</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={[s.topIcon, { borderColor: theme.border }]} onPress={() => router.push('/(tabs)/ai')}>
          <Ionicons name="sparkles" size={15} color="#34C759" />
        </TouchableOpacity>
        <TouchableOpacity style={[s.topIcon, { borderColor: theme.border }]} onPress={() => router.push('/(tabs)/profile')}>
          <Ionicons name="settings-outline" size={15} color={theme.text} />
        </TouchableOpacity>
      </View>
      <View style={s.datesRow}>
        <DaySelector selectedDate={selectedDate} onSelect={setSelectedDate} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />}>
        <FuelScoreCard score={todayScore} history={history} selectedDate={selectedDate} theme={theme} />

        {mode === 'detailed' && <MacroTracker items={foodItems} theme={theme} />}

        {/* QUICK / DETAILED toggle */}
        <View
          style={[s.tabToggle, { backgroundColor: theme.isDark ? '#000000' : theme.overlay }]}
          onLayout={e => setTabContainerW(e.nativeEvent.layout.width)}
        >
          {tabContainerW > 0 && (
            <Animated.View style={[s.tabPill, {
              backgroundColor: theme.inverse,
              width: tabContainerW / 2,
              transform: [{ translateX: tabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, tabContainerW / 2] }) }],
            }]} />
          )}
          <TouchableOpacity style={s.tabBtn} onPress={() => switchMode('quick')} activeOpacity={0.8}>
            <Text style={[s.tabBtnText, { color: mode === 'quick' ? theme.inverseText : theme.textMuted, fontFamily: 'Inter_900Black' }]}>QUICK</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.tabBtn} onPress={() => switchMode('detailed')} activeOpacity={0.8}>
            <Text style={[s.tabBtnText, { color: mode === 'detailed' ? theme.inverseText : theme.textMuted, fontFamily: 'Inter_900Black' }]}>DETAILED</Text>
          </TouchableOpacity>
        </View>

        {/* QUICK */}
        {mode === 'quick' && isToday && (
          <>
            <QuestionCard
              icon="🍽️"
              label="STUCK TO YOUR DIET?"
              sub="Did you follow your planned meals today?"
              state={stuckToMeal}
              onAnswer={setStuckToMeal}
              yesColor="#34C759"
              noColor="#FF453A"
              theme={theme}
            />
            <QuestionCard
              icon="🍔"
              label="HAD JUNK FOOD?"
              sub="Any processed or unhealthy food?"
              state={hadJunk}
              onAnswer={setHadJunk}
              yesColor="#FF453A"
              noColor="#34C759"
              theme={theme}
            />

            {/* Food Quality card */}
            <TouchableOpacity
              style={[qcs.card, { borderColor: theme.border }]}
              onPress={() => setShowQPicker(true)}
              activeOpacity={0.85}
            >
              <View style={qcs.header}>
                <Text style={qcs.icon}>⭐</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[qcs.label, { color: theme.text, fontFamily: 'Inter_900Black' }]}>FOOD QUALITY</Text>
                  <Text style={[qcs.sub, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                    {QUALITY_LABELS[foodQuality]} · Tap to adjust
                  </Text>
                </View>
                <Text style={[qcs.qualityValue, { color: '#34C759', fontFamily: 'SpaceGrotesk_700Bold' }]}>
                  {foodQuality}/10
                </Text>
              </View>
              <View style={qcs.qualityBars}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <View key={i} style={[qcs.qualityBar, { backgroundColor: i < foodQuality ? '#34C759' : theme.overlay }]} />
                ))}
              </View>
            </TouchableOpacity>

            {/* Quality bottom-sheet modal */}
            <Modal visible={showQPicker} transparent animationType="slide">
              <Pressable style={[qs.backdrop, { backgroundColor: theme.backdrop }]} onPress={() => setShowQPicker(false)} />
              <View style={[qs.sheet, { backgroundColor: theme.cardElevated }]}>
                <View style={[qs.handle, { backgroundColor: theme.border }]} />
                <Text style={[qs.sheetTitle, { color: theme.text, fontFamily: 'Inter_900Black' }]}>FOOD QUALITY</Text>
                <Text style={[qs.sheetSub, { color: '#34C759', fontFamily: 'Inter_700Bold' }]}>{QUALITY_LABELS[foodQuality]}</Text>
                <QualityScroll value={foodQuality} onChange={setFoodQuality} theme={theme} />
                <TouchableOpacity style={[qs.doneBtn, { backgroundColor: theme.text }]} onPress={() => setShowQPicker(false)}>
                  <Text style={[qs.doneBtnText, { color: theme.bg, fontFamily: 'Inter_900Black' }]}>DONE</Text>
                </TouchableOpacity>
              </View>
            </Modal>

            <TouchableOpacity style={[s.submitBtn, { backgroundColor: theme.tabActiveBg, opacity: (stuckToMeal === null || hadJunk === null || submitting) ? 0.4 : 1 }]}
              onPress={submitQuick} disabled={stuckToMeal === null || hadJunk === null || submitting}>
              <Text style={[s.submitBtnText, { color: theme.tabActiveText, fontFamily: 'Inter_900Black' }]}>{submitting ? 'LOGGING...' : 'LOG FUEL →'}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── DETAILED: food item entry form ── */}
        {mode === 'detailed' && isToday && (
          <View style={s.detailedWrap}>
            {/* Snap row */}
            <View style={s.snapRow}>
              <TouchableOpacity
                style={[s.snapBtn, { borderColor: theme.border, opacity: scanning ? 0.6 : 1 }]}
                onPress={() => handleSnapTrack('camera')}
                disabled={scanning}
                activeOpacity={0.7}
              >
                {scanning
                  ? <ActivityIndicator size="small" color={theme.text} />
                  : <Ionicons name="camera" size={18} color={theme.text} />
                }
                <Text style={[s.snapBtnText, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>
                  {scanning ? 'ANALYSING...' : 'SNAP & TRACK'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.snapBtnSm, { borderColor: theme.border }]}
                onPress={() => handleSnapTrack('gallery')}
                disabled={scanning}
                activeOpacity={0.7}
              >
                <Ionicons name="images-outline" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={s.orRow}>
              <View style={[s.orLine, { backgroundColor: theme.border }]} />
              <Text style={[s.orText, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>OR ENTER MANUALLY</Text>
              <View style={[s.orLine, { backgroundColor: theme.border }]} />
            </View>

            {/* Food name */}
            <View style={[s.foodNameBox, { borderColor: theme.border }]}>
              <Ionicons name="fast-food-outline" size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={[s.foodNameInput, { color: theme.text, fontFamily: 'Inter_700Bold' }]}
                value={itemName}
                onChangeText={setItemName}
                placeholder="Food name..."
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="words"
              />
            </View>

            {/* Meal time chips */}
            <Text style={[s.detailFieldLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>WHEN</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.mealTimeRow}>
              {(['morning','brunch','lunch','evening','dinner','snacks'] as MealTime[]).map(mt => (
                <TouchableOpacity
                  key={mt}
                  style={[s.mealChip, {
                    backgroundColor: itemMealTime === mt ? theme.text : 'transparent',
                    borderColor: itemMealTime === mt ? theme.text : theme.border,
                  }]}
                  onPress={() => setItemMealTime(mt)}
                  activeOpacity={0.7}
                >
                  <Text style={s.mealChipEmoji}>{MEAL_TIME_ICONS[mt]}</Text>
                  <Text style={[s.mealChipLabel, {
                    color: itemMealTime === mt ? theme.bg : theme.textSecondary,
                    fontFamily: 'Inter_700Bold',
                  }]}>{mt.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Macros 2×2 */}
            <Text style={[s.detailFieldLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>MACROS</Text>
            <View style={s.macroGrid}>
              {([
                { label: 'CALORIES', value: itemCalories, setter: setItemCalories, placeholder: '', icon: '🔥' },
                { label: 'PROTEIN',  value: itemProtein,  setter: setItemProtein,  placeholder: '', icon: '💪' },
                { label: 'CARBS',    value: itemCarbs,    setter: setItemCarbs,    placeholder: '', icon: '🌾' },
                { label: 'FATS',     value: itemFat,      setter: setItemFat,      placeholder: '', icon: '🥑' },
              ] as Array<{ label: string; value: string; setter: (v: string) => void; placeholder: string; icon: string }>).map(f => (
                <View key={f.label} style={[s.macroBox, { borderColor: theme.border }]}>
                  <View style={s.macroBoxHeader}>
                    <Text style={s.macroBoxIcon}>{f.icon}</Text>
                    <Text style={[s.macroBoxLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{f.label}</Text>
                  </View>
                  <TextInput
                    style={[s.macroBoxInput, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}
                    value={f.value}
                    onChangeText={f.setter}
                    placeholder={f.placeholder}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: theme.tabActiveBg, opacity: addingItem ? 0.4 : 1 }]}
              onPress={submitDetailedItem}
              disabled={addingItem}
            >
              <Text style={[s.submitBtnText, { color: theme.tabActiveText, fontFamily: 'Inter_900Black' }]}>
                {addingItem ? 'SAVING...' : 'LOG FOOD →'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── QUICK: show food_logs entries only ── */}
        {mode === 'quick' && (
          <>
            {!isToday && logs.length === 0 && (
              <View style={s.empty}><Text style={[s.emptyText, { color: theme.textSecondary }]}>NO FUEL DATA FOR THIS DAY</Text></View>
            )}
            {logs.length > 0 && (
              <>
                <View style={s.sectionHeader}>
                  <Text style={[s.sectionTitle, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>LOGGED MEALS</Text>
                  <Text style={[s.sectionCount, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_500Medium' }]}>{String(logs.length).padStart(2,'0')} ENTRIES</Text>
                </View>
                {logs.map(log => <MealRow key={log.id} log={log} theme={theme} />)}
              </>
            )}
          </>
        )}

        {/* ── DETAILED: show food items with macros ── */}
        {mode === 'detailed' && (
          <>
            {!isToday && foodItems.length === 0 && (
              <View style={s.empty}><Text style={[s.emptyText, { color: theme.textSecondary }]}>NO FOOD LOGGED FOR THIS DAY</Text></View>
            )}
            {foodItems.length > 0 && (
              <>
                <View style={s.sectionHeader}>
                  <Text style={[s.sectionTitle, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>WHAT YOU ATE</Text>
                  <Text style={[s.sectionCount, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_500Medium' }]}>{String(foodItems.length).padStart(2,'0')} ITEMS</Text>
                </View>
                {foodItems.map(item => (
                  <FoodItemCard
                    key={item.id}
                    item={item}
                    theme={theme}
                    onDelete={isToday ? () => deleteItem(item.id) : undefined}
                  />
                ))}
                <MacroTotalsBar items={foodItems} theme={theme} />
              </>
            )}
          </>
        )}

      </ScrollView>
    </SafeAreaView></DarkBackground>
  );
}

function FuelScoreCard({ score, history, selectedDate, theme }: {
  score: number;
  history: Array<{ date: string; score: number | null }>;
  selectedDate: string;
  theme: any;
}) {
  const last7 = React.useMemo(() => {
    const days: { date: string; score: number | null }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      const found = history.find(h => h.date === d);
      days.push({ date: d, score: found?.score ?? null });
    }
    return days;
  }, [history]);

  const trend = React.useMemo(() => {
    const scored = last7.filter(d => d.score != null).map(d => d.score as number);
    if (scored.length < 3) return null;
    const half = Math.floor(scored.length / 2);
    const early = scored.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const recent = scored.slice(-half).reduce((a, b) => a + b, 0) / half;
    const diff = recent - early;
    if (diff > 8)  return { label: 'IMPROVING',  color: '#34C759', icon: '↑' };
    if (diff < -8) return { label: 'DECLINING',   color: '#FF453A', icon: '↓' };
    return { label: 'CONSISTENT', color: '#0A84FF', icon: '→' };
  }, [last7]);

  const streak = React.useMemo(() => {
    let count = 0;
    for (let i = last7.length - 1; i >= 0; i--) {
      if (last7[i].score != null) count++;
      else break;
    }
    return count;
  }, [last7]);

  const scoreColor = score >= 80 ? '#34C759' : score >= 50 ? '#FF9500' : '#FF453A';
  const isToday = selectedDate === today();

  return (
    <View style={[sc.card, { backgroundColor: theme.isDark ? '#1E1E1E' : '#ECECEC', borderColor: theme.borderStrong, borderTopColor: scoreColor }]}>
      <View style={sc.top}>
        <View style={sc.scoreBlock}>
          <Text style={[sc.scoreNum, { color: scoreColor, fontFamily: 'SpaceGrotesk_700Bold' }]}>{score}</Text>
          <Text style={[sc.scoreLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
            {isToday ? "TODAY'S FUEL SCORE" : 'FUEL SCORE'}
          </Text>
        </View>
        <View style={sc.right}>
          {trend && (
            <View style={[sc.trendBadge, { backgroundColor: trend.color + '22', borderColor: trend.color + '55' }]}>
              <Text style={[sc.trendIcon, { color: trend.color }]}>{trend.icon}</Text>
              <Text style={[sc.trendLabel, { color: trend.color, fontFamily: 'Inter_900Black' }]}>{trend.label}</Text>
            </View>
          )}
          {streak > 0 && (
            <Text style={[sc.streakText, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
              {streak} day{streak !== 1 ? 's' : ''} logged
            </Text>
          )}
        </View>
      </View>

      <View style={[sc.divider, { backgroundColor: theme.border }]} />

      <View style={sc.dotsRow}>
        {last7.map((day, i) => {
          const isSelected = day.date === selectedDate;
          const s = day.score;
          const dotColor = s == null ? theme.overlay : s >= 80 ? '#34C759' : s >= 50 ? '#FF9500' : '#FF453A';
          const label = ['M','T','W','T','F','S','S'][new Date(day.date + 'T12:00:00').getDay() === 0 ? 6 : new Date(day.date + 'T12:00:00').getDay() - 1];
          return (
            <View key={day.date} style={sc.dotCol}>
              <View style={[sc.dot, {
                backgroundColor: dotColor,
                borderWidth: isSelected ? 2 : 0,
                borderColor: theme.text,
                opacity: s == null ? 0.25 : 1,
              }]} />
              {s != null && (
                <Text style={[sc.dotScore, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>{s}</Text>
              )}
              <Text style={[sc.dotDay, { color: isSelected ? theme.text : theme.textSecondary, fontFamily: isSelected ? 'Inter_700Bold' : 'Inter_500Medium' }]}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const sc = StyleSheet.create({
  card:       { marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderRadius: 16, padding: 16, borderTopWidth: 3 },
  top:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  scoreBlock: { gap: 2 },
  scoreNum:   { fontSize: 52, lineHeight: 56 },
  scoreLabel: { fontSize: 8, letterSpacing: 2.5 },
  right:      { alignItems: 'flex-end', gap: 8 },
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  trendIcon:  { fontSize: 13, fontWeight: '800' },
  trendLabel: { fontSize: 9, letterSpacing: 2 },
  streakText: { fontSize: 9, letterSpacing: 1 },
  divider:    { height: 1, marginBottom: 14 },
  dotsRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  dotCol:     { alignItems: 'center', gap: 4, flex: 1 },
  dot:        { width: 10, height: 10, borderRadius: 5 },
  dotScore:   { fontSize: 8 },
  dotDay:     { fontSize: 8, letterSpacing: 0.5 },
});

const ITEM_W = 56;
const SCORES = [0,1,2,3,4,5,6,7,8,9,10];

function QualityScroll({ value, onChange, theme }: { value: number; onChange: (n: number) => void; theme: any }) {
  const scrollRef = React.useRef<ScrollView>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ x: value * ITEM_W, animated: true });
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={ITEM_W}
      decelerationRate="fast"
      contentContainerStyle={qs.row}
      onMomentumScrollEnd={e => {
        const idx = Math.round(e.nativeEvent.contentOffset.x / ITEM_W);
        onChange(Math.max(0, Math.min(10, idx)));
      }}
    >
      {SCORES.map(n => {
        const active = n === value;
        return (
          <TouchableOpacity
            key={n}
            style={[qs.item, { width: ITEM_W }]}
            onPress={() => { onChange(n); scrollRef.current?.scrollTo({ x: n * ITEM_W, animated: true }); }}
            activeOpacity={0.7}
          >
            <Text style={[qs.num, {
              color: active ? theme.text : theme.textMuted,
              fontSize: active ? 40 : 28,
              fontFamily: active ? 'Inter_900Black' : 'Inter_500Medium',
            }]}>
              {n}
            </Text>
            {active && <View style={[qs.dot, { backgroundColor: '#34C759' }]} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const qs = StyleSheet.create({
  row:        { paddingHorizontal: 24, paddingVertical: 12, alignItems: 'center' },
  item:       { alignItems: 'center', justifyContent: 'center', height: 64, gap: 4 },
  num:        { lineHeight: 48 },
  dot:        { width: 4, height: 4, borderRadius: 2 },
  backdrop:   { flex: 1 },
  sheet:      { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, paddingTop: 12 },
  handle:     { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 14, letterSpacing: 3, textAlign: 'center' },
  sheetSub:   { fontSize: 10, letterSpacing: 2, textAlign: 'center', marginTop: 6, marginBottom: 8 },
  doneBtn:    { marginHorizontal: 24, marginTop: 20, paddingVertical: 16, alignItems: 'center', borderRadius: 12 },
  doneBtnText:{ fontSize: 11, letterSpacing: 4 },
});

const MACRO_TARGETS = { calories: 2000, protein: 150, fat: 65, carbs: 250 };
const MACRO_COLORS  = { calories: '#FF9500', protein: '#0A84FF', fat: '#FFD60A', carbs: '#34C759' };

function MacroTracker({ items, theme }: { items: FoodItem[]; theme: any }) {
  const totals = items.reduce(
    (a, i) => ({
      calories: a.calories + (i.calories ?? 0),
      protein:  a.protein  + (i.protein  ?? 0),
      fat:      a.fat      + (i.fat      ?? 0),
      carbs:    a.carbs    + (i.carbs    ?? 0),
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  const rows: { key: keyof typeof MACRO_TARGETS; label: string; unit: string }[] = [
    { key: 'calories', label: 'CALORIES', unit: 'kcal' },
    { key: 'protein',  label: 'PROTEIN',  unit: 'g' },
    { key: 'carbs',    label: 'CARBS',    unit: 'g' },
    { key: 'fat',      label: 'FAT',      unit: 'g' },
  ];

  return (
    <View style={[mt.card, { borderColor: theme.border }]}>
      {rows.map((row, idx) => {
        const val    = Math.round(totals[row.key]);
        const target = MACRO_TARGETS[row.key];
        const pct    = Math.min(val / target, 1);
        const color  = MACRO_COLORS[row.key];
        const over   = val > target;
        return (
          <View key={row.key}>
            {idx > 0 && <View style={[mt.sep, { backgroundColor: theme.border }]} />}
            <View style={mt.row}>
              <View style={mt.left}>
                <Text style={[mt.label, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{row.label}</Text>
                <View style={mt.valRow}>
                  <Text style={[mt.val, { color: over ? color : theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                    {val.toLocaleString()}
                  </Text>
                  <Text style={[mt.unit, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                    {row.unit}
                  </Text>
                </View>
              </View>
              <View style={mt.barWrap}>
                <View style={[mt.barTrack, { backgroundColor: theme.overlay }]}>
                  <View style={[mt.barFill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
                </View>
                <Text style={[mt.target, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                  / {target.toLocaleString()}{row.unit}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const mt = StyleSheet.create({
  card:    { marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderRadius: 14, paddingVertical: 4 },
  sep:     { height: 1, marginHorizontal: 16 },
  row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, gap: 14 },
  left:    { width: 80, gap: 2 },
  label:   { fontSize: 7, letterSpacing: 2 },
  valRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  val:     { fontSize: 17 },
  unit:    { fontSize: 9 },
  barWrap: { flex: 1, gap: 4 },
  barTrack:{ height: 5, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  target:  { fontSize: 8, letterSpacing: 0.5 },
});

const MEAL_TIME_ICONS: Record<string, string> = {
  morning: '🌅', brunch: '☕', lunch: '🥗', evening: '🌆', dinner: '🍽️', snacks: '🍎',
};

function FoodItemCard({ item, theme, onDelete }: { item: FoodItem; theme: any; onDelete?: () => void }) {
  const hasMacros = item.calories != null || item.protein != null || item.fat != null || item.carbs != null;
  return (
    <View style={[fi.itemCard, { borderColor: theme.border }]}>
      <View style={fi.itemHeader}>
        <View style={[fi.mealTimeBadge, { backgroundColor: theme.overlay }]}>
          <Text style={fi.mealTimeEmoji}>{MEAL_TIME_ICONS[item.mealTime]}</Text>
          <Text style={[fi.mealTimeText, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
            {item.mealTime.toUpperCase()}
          </Text>
        </View>
        <Text style={[fi.itemName, { color: theme.text, fontFamily: 'Inter_700Bold' }]} numberOfLines={1}>{item.name}</Text>
        {onDelete && (
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={14} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {hasMacros && (
        <>
          <View style={[fi.itemDivider, { backgroundColor: theme.border }]} />
          <View style={fi.macroRow}>
            {item.calories != null && <MacroChip label="CAL" value={Math.round(item.calories)} theme={theme} />}
            {item.protein  != null && <MacroChip label="PRO" value={Math.round(item.protein)} unit="g" theme={theme} />}
            {item.fat      != null && <MacroChip label="FAT" value={Math.round(item.fat)} unit="g" theme={theme} />}
            {item.carbs    != null && <MacroChip label="CARBS" value={Math.round(item.carbs)} unit="g" theme={theme} />}
          </View>
        </>
      )}
    </View>
  );
}

function MacroChip({ label, value, unit = '', theme }: { label: string; value: number; unit?: string; theme: any }) {
  return (
    <View style={fi.macroChip}>
      <Text style={[fi.macroChipVal, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>{value}{unit}</Text>
      <Text style={[fi.macroChipLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{label}</Text>
    </View>
  );
}

function MacroTotalsBar({ items, theme }: { items: FoodItem[]; theme: any }) {
  const totals = items.reduce(
    (acc, item) => ({
      calories: acc.calories + (item.calories ?? 0),
      protein:  acc.protein  + (item.protein  ?? 0),
      fat:      acc.fat      + (item.fat      ?? 0),
      carbs:    acc.carbs    + (item.carbs    ?? 0),
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  const hasAny = items.some(i => i.calories != null || i.protein != null || i.fat != null || i.carbs != null);
  if (!hasAny) return null;

  return (
    <View style={[fi.totalsBar, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Text style={[fi.totalsLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>DAILY TOTAL</Text>
      <View style={fi.totalsRow}>
        {[
          { label: 'CAL',   value: Math.round(totals.calories), unit: '' },
          { label: 'PRO',   value: Math.round(totals.protein),  unit: 'g' },
          { label: 'FAT',   value: Math.round(totals.fat),      unit: 'g' },
          { label: 'CARBS', value: Math.round(totals.carbs),    unit: 'g' },
        ].map(t => (
          <View key={t.label} style={fi.totalCell}>
            <Text style={[fi.totalVal, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>
              {t.value}{t.unit}
            </Text>
            <Text style={[fi.totalCellLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{t.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const fi = StyleSheet.create({
  // item cards
  itemCard:       { marginHorizontal: 16, marginTop: 8, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  itemHeader:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  mealTimeBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  mealTimeEmoji:  { fontSize: 12 },
  mealTimeText:   { fontSize: 8, letterSpacing: 1.5 },
  itemName:       { flex: 1, fontSize: 13, letterSpacing: 0.3 },
  itemDivider:    { height: 1 },
  macroRow:       { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10 },
  macroChip:      { flex: 1, alignItems: 'center', gap: 2 },
  macroChipVal:   { fontSize: 14 },
  macroChipLabel: { fontSize: 7, letterSpacing: 1.5 },
  // totals bar
  totalsBar:      { marginHorizontal: 16, marginTop: 8, borderWidth: 1, borderRadius: 12, padding: 14 },
  totalsLabel:    { fontSize: 7, letterSpacing: 2.5, marginBottom: 10 },
  totalsRow:      { flexDirection: 'row' },
  totalCell:      { flex: 1, alignItems: 'center', gap: 3 },
  totalVal:       { fontSize: 16 },
  totalCellLabel: { fontSize: 7, letterSpacing: 1.5 },
  // add modal
  backdrop:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:          { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 44, paddingTop: 12, maxHeight: '90%' },
  handle:         { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:     { fontSize: 13, letterSpacing: 3, textAlign: 'center', marginBottom: 20 },
  nameBox:        { marginHorizontal: 20, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20 },
  nameInput:      { fontSize: 15, letterSpacing: 0.3 },
  fieldLabel:     { fontSize: 8, letterSpacing: 2.5, marginHorizontal: 20, marginBottom: 10 },
  mealTimeRow:    { paddingHorizontal: 20, gap: 8, marginBottom: 20 },
  mealChip:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderRadius: 10 },
  mealChipText:   { fontSize: 9, letterSpacing: 2 },
  macroGrid:      { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 20, gap: 10, marginBottom: 24 },
  macroBox:       { width: '47%', borderWidth: 1, borderRadius: 10, padding: 12 },
  macroLabel:     { fontSize: 7, letterSpacing: 2, marginBottom: 6 },
  macroInput:     { fontSize: 20 },
  doneBtn:        { marginHorizontal: 20, paddingVertical: 16, alignItems: 'center', borderRadius: 12, marginBottom: 8 },
  doneBtnText:    { fontSize: 11, letterSpacing: 4 },
});

function QuestionCard({ icon, label, sub, state, onAnswer, yesColor, noColor, theme }: {
  icon: string;
  label: string;
  sub: string;
  state: boolean | null;
  onAnswer: (v: boolean) => void;
  yesColor: string;
  noColor: string;
  theme: any;
}) {
  const yesActive = state === true;
  const noActive  = state === false;

  return (
    <View style={[qcs.card, { borderColor: theme.border }]}>
      <View style={qcs.header}>
        <Text style={qcs.icon}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[qcs.label, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{label}</Text>
          <Text style={[qcs.sub, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>{sub}</Text>
        </View>
      </View>
      <View style={qcs.btnRow}>
        <TouchableOpacity
          style={[qcs.btn, {
            backgroundColor: yesActive ? yesColor : 'transparent',
            borderColor:     yesActive ? yesColor : theme.border,
          }]}
          onPress={() => onAnswer(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="checkmark" size={14} color={yesActive ? '#FFFFFF' : yesColor} />
          <Text style={[qcs.btnText, {
            color: yesActive ? '#FFFFFF' : yesColor,
            fontFamily: 'Inter_900Black',
          }]}>YES</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[qcs.btn, {
            backgroundColor: noActive ? noColor : 'transparent',
            borderColor:     noActive ? noColor : theme.border,
          }]}
          onPress={() => onAnswer(false)}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={14} color={noActive ? '#FFFFFF' : noColor} />
          <Text style={[qcs.btnText, {
            color: noActive ? '#FFFFFF' : noColor,
            fontFamily: 'Inter_900Black',
          }]}>NO</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const qcs = StyleSheet.create({
  card:          { marginHorizontal: 16, marginTop: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  icon:          { fontSize: 18 },
  label:         { fontSize: 11, letterSpacing: 1.5 },
  sub:           { fontSize: 9, letterSpacing: 0.3, marginTop: 2 },
  btnRow:        { flexDirection: 'row', gap: 6 },
  btn:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderWidth: 1.5, borderRadius: 8 },
  btnText:       { fontSize: 10, letterSpacing: 3 },
  // Quality card extras
  qualityValue:  { fontSize: 14 },
  qualityBars:   { flexDirection: 'row', gap: 3, marginTop: 4 },
  qualityBar:    { flex: 1, height: 4, borderRadius: 2 },
});

function MealRow({ log, theme }: { log: FoodLog; theme: any }) {
  const time = log.createdAt
    ? new Date(log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';
  const isQuick = log.mode === 'simple';

  return (
    <View style={[mr.card, { borderColor: theme.border }]}>
      {/* ── Header ── */}
      <View style={mr.header}>
        <View style={[mr.badge, { backgroundColor: theme.text }]}>
          <Ionicons name="checkmark" size={9} color={theme.bg} />
        </View>
        <Text style={[mr.title, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>
          {isQuick ? 'QUICK LOG' : 'NUTRITION LOG'}
        </Text>
        <View style={{ flex: 1 }} />
        {!!time && (
          <Text style={[mr.time, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>{time}</Text>
        )}
        <View style={[mr.scorePill, { backgroundColor: theme.surfaceStrong }]}>
          <Text style={[mr.scoreText, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>+{log.score}</Text>
        </View>
      </View>

      <View style={[mr.divider, { backgroundColor: theme.border }]} />

      {/* ── Quick log answers ── */}
      {isQuick && (
        <View style={mr.body}>
          <LogAnswerRow
            label="CORRECT MEAL"
            value={log.hadThreeMeals}
            positiveIsGood
            theme={theme}
          />
          <View style={[mr.rowSep, { backgroundColor: theme.border }]} />
          <LogAnswerRow
            label="JUNK FOOD"
            value={log.hadJunkFood}
            positiveIsGood={false}
            theme={theme}
          />
          {log.foodQuality != null && (
            <>
              <View style={[mr.rowSep, { backgroundColor: theme.border }]} />
              <View style={mr.answerRow}>
                <Text style={[mr.answerLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>FOOD QUALITY</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                  <Text style={[mr.answerVal, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>{log.foodQuality}/10</Text>
                  <Text style={[mr.answerSub, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>{QUALITY_LABELS[log.foodQuality]}</Text>
                </View>
              </View>
            </>
          )}
        </View>
      )}

      {/* ── Detailed log stats ── */}
      {!isQuick && (
        <View style={mr.body}>
          {log.calories != null && (
            <LogStatRow label="CALORIES" value={Math.round(log.calories)} unit="kcal" target={log.calorieTarget != null ? Math.round(log.calorieTarget) : null} theme={theme} />
          )}
          {log.protein != null && (
            <>
              <View style={[mr.rowSep, { backgroundColor: theme.border }]} />
              <LogStatRow label="PROTEIN" value={Math.round(log.protein)} unit="g" target={log.proteinTarget != null ? Math.round(log.proteinTarget) : null} theme={theme} />
            </>
          )}
          {log.mealsLogged != null && (
            <>
              <View style={[mr.rowSep, { backgroundColor: theme.border }]} />
              <LogStatRow label="MEALS EATEN" value={log.mealsLogged} unit="" target={log.expectedMeals ?? null} theme={theme} />
            </>
          )}
          {log.junkMeals != null && (
            <>
              <View style={[mr.rowSep, { backgroundColor: theme.border }]} />
              <LogStatRow label="JUNK MEALS" value={log.junkMeals} unit="" target={null} theme={theme} />
            </>
          )}
          {!!log.notes && (
            <Text style={[mr.notes, { color: theme.textSecondary, fontFamily: 'Inter_400Regular', borderTopColor: theme.border }]}>{log.notes}</Text>
          )}
        </View>
      )}
    </View>
  );
}

function LogAnswerRow({ label, value, positiveIsGood, theme }: { label: string; value: boolean | null; positiveIsGood: boolean; theme: any }) {
  if (value === null) return null;
  const isGood = positiveIsGood ? value === true : value === false;
  const color  = isGood ? '#34C759' : '#FF453A';
  return (
    <View style={mr.answerRow}>
      <Text style={[mr.answerLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Ionicons name={isGood ? 'checkmark-circle' : 'close-circle'} size={13} color={color} />
        <Text style={[mr.answerVal, { color, fontFamily: 'SpaceGrotesk_700Bold' }]}>{value ? 'YES' : 'NO'}</Text>
      </View>
    </View>
  );
}

function LogStatRow({ label, value, unit, target, theme }: { label: string; value: number; unit: string; target: number | null; theme: any }) {
  return (
    <View style={mr.answerRow}>
      <Text style={[mr.answerLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text style={[mr.answerVal, { color: theme.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>{value}</Text>
        {!!unit && <Text style={[mr.answerSub, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>{unit}</Text>}
        {target != null && (
          <Text style={[mr.answerSub, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>
            {' '}/ {target}{unit}
          </Text>
        )}
      </View>
    </View>
  );
}

const mr = StyleSheet.create({
  card:       { marginHorizontal: 16, marginTop: 10, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  badge:      { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 10, letterSpacing: 2 },
  time:       { fontSize: 10, letterSpacing: 0.5 },
  scorePill:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  scoreText:  { fontSize: 11 },
  divider:    { height: 1 },
  body:       { paddingHorizontal: 16, paddingVertical: 4 },
  answerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  answerLabel:{ fontSize: 9, letterSpacing: 2 },
  answerVal:  { fontSize: 13 },
  answerSub:  { fontSize: 10 },
  rowSep:     { height: 1 },
  notes:      { fontSize: 11, letterSpacing: 0.3, paddingTop: 10, paddingBottom: 6, borderTopWidth: 1, fontStyle: 'italic' },
});

const s = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6, gap: 10 },
  modeLabel: { fontSize: 10, letterSpacing: 1.5 },
  topIcon: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  datesRow: { paddingHorizontal: 14, paddingBottom: 8 },
  scroll: { paddingBottom: 120 },
  tabToggle: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 4, height: 46, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  tabPill: { position: 'absolute', top: 0, left: 0, height: 46, borderRadius: 12 },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  tabBtnText: { fontSize: 11, letterSpacing: 3 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 0 },
  sectionTitle: { fontSize: 9, letterSpacing: 3 },
  sectionCount: { fontSize: 9 },
  questionRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1 },
  checkbox: { width: 20, height: 20, borderWidth: 1.5, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  qBox: { width: 20, height: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  qBoxNum: { fontSize: 11 },
  qInfo: { flex: 1, gap: 3 },
  qLabel: { fontSize: 14, letterSpacing: 0.3 },
  qSub: { fontSize: 10, letterSpacing: 0.5, fontStyle: 'italic' },
  qAnswer: { fontSize: 16 },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1 },
  pickerChip: { width: 44, height: 44, borderWidth: 1.5, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  pickerChipText: { fontSize: 14 },
  detailBlock: { marginHorizontal: 24, borderWidth: 1, marginTop: 16 },
  divider: { height: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14 },
  inputLabel: { fontSize: 9, letterSpacing: 2, flex: 1 },
  inputPair: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputField: { fontSize: 18, width: 80, textAlign: 'right', borderBottomWidth: 1, paddingBottom: 2 },
  inputSep: { width: 1, height: 20 },
  targetBlock: { alignItems: 'flex-end', gap: 1 },
  targetLabel: { fontSize: 7, letterSpacing: 2 },
  targetField: { fontSize: 12, width: 48, textAlign: 'right' },
  notesInput: { marginHorizontal: 24, marginTop: 12, borderWidth: 1, padding: 14, fontSize: 12, letterSpacing: 1, minHeight: 60, textAlignVertical: 'top' },
  submitBtn: { marginHorizontal: 16, marginTop: 14, paddingVertical: 14, alignItems: 'center', borderRadius: 12 },
  submitBtnText: { fontSize: 10, letterSpacing: 4 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 9, letterSpacing: 3 },
  // detailed form
  detailedWrap:     { paddingBottom: 8 },
  snapRow:          { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, gap: 10 },
  snapBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 14 },
  snapBtnText:      { fontSize: 11, letterSpacing: 2 },
  snapBtnSm:        { width: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12 },
  orRow:            { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 16, gap: 10 },
  orLine:           { flex: 1, height: 1 },
  orText:           { fontSize: 8, letterSpacing: 2 },
  foodNameBox:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 16 },
  foodNameInput:    { flex: 1, fontSize: 15 },
  detailFieldLabel: { fontSize: 8, letterSpacing: 2.5, marginHorizontal: 16, marginBottom: 10 },
  mealTimeRow:      { paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  mealChip:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderRadius: 10 },
  mealChipEmoji:    { fontSize: 13 },
  mealChipLabel:    { fontSize: 9, letterSpacing: 1.5 },
  macroGrid:        { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 16, gap: 10, marginBottom: 8 },
  macroBox:         { width: '47%', borderWidth: 1, borderRadius: 12, padding: 14 },
  macroBoxHeader:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  macroBoxIcon:     { fontSize: 13 },
  macroBoxLabel:    { fontSize: 8, letterSpacing: 2 },
  macroBoxInput:    { fontSize: 24 },
});
