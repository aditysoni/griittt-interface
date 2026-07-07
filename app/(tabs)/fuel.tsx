import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Modal, PanResponder, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DarkBackground } from '../../components/DarkBackground';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { fuel, ai, FoodLog, FoodItem, MealTime, MacroTargets, today } from '../../lib/api';
import { LoadingScreen } from '../../components/LoadingScreen';
import { DaySelector } from '../../components/DaySelector';
import { useTheme } from '../../components/ThemeContext';
import * as ImagePicker from 'expo-image-picker';

type TabMode = 'quick' | 'detailed';
const QUALITY_LABELS = ['Terrible','Very poor','Poor','Below avg','Average','Average+','Good','Great','Excellent','Outstanding','Perfect'];

export default function FuelScreen() {
  const { token, user } = useAuth();
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

  const tabAnim   = useRef(new Animated.Value(0)).current;
  const mainScroll = useRef<import('react-native').ScrollView>(null);
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
  const [itemFibre, setItemFibre]       = useState('');
  const [addingItem, setAddingItem]     = useState(false);
  const [scanning, setScanning]         = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

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
    setItemCalories(''); setItemProtein(''); setItemFat(''); setItemCarbs(''); setItemFibre('');
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
      const b64 = result.assets[0].base64!;
      const data = await ai.snapTrack(token!, `data:image/jpeg;base64,${b64}`);
      console.log('[snap-track] response:', JSON.stringify(data));
      setItemName(data.name);
      setItemCalories(data.calories ? String(Math.round(data.calories)) : '');
      setItemProtein(data.protein  ? String(Math.round(data.protein))  : '');
      setItemCarbs(data.carbs    ? String(Math.round(data.carbs))    : '');
      setItemFat(data.fats     ? String(Math.round(data.fats))     : '');
      setShowManualInput(true);
    } catch (err: any) {
      console.log('[snap-track] error:', err.message, err.status);
      Alert.alert('Snap failed', err.message);
    }
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
      setShowManualInput(false);
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

  async function updateItem(item: FoodItem, patch: { calories?: number; protein?: number; fat?: number; carbs?: number }) {
    if (!token) return;
    try {
      // Single round-trip via PUT /fuel/items/:id (replaced the old delete-then-readd dance).
      await fuel.editItem(token, item.id, patch);
      await load(selectedDate);
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
        <View>
          <Text style={[s.modeLabel, { color: theme.text, fontFamily: 'Inter_900Black' }]}>FUEL MODE</Text>
          <Text style={[s.eatClean, { color: theme.text, fontFamily: 'Inter_900Black' }]}>EAT CLEAN</Text>
        </View>
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

      <ScrollView ref={mainScroll} style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />}>
        <FuelScoreCard score={todayScore} history={history} selectedDate={selectedDate} theme={theme} />

        {/* QUICK / DETAILED toggle — directly under score card */}
        <View
          style={[s.tabToggle, { backgroundColor: theme.surface }]}
          onLayout={e => setTabContainerW(e.nativeEvent.layout.width)}
        >
          {tabContainerW > 0 && (
            <Animated.View style={[s.tabPill, {
              backgroundColor: theme.card,
              width: (tabContainerW - 8) / 2,
              transform: [{ translateX: tabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, (tabContainerW - 8) / 2] }) }],
            }]} />
          )}
          <TouchableOpacity style={s.tabBtn} onPress={() => switchMode('quick')} activeOpacity={0.8}>
            <Text style={[s.tabBtnText, { color: mode === 'quick' ? theme.text : theme.textSecondary, fontFamily: 'Inter_900Black' }]}>QUICK</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.tabBtn} onPress={() => switchMode('detailed')} activeOpacity={0.8}>
            <Text style={[s.tabBtnText, { color: mode === 'detailed' ? theme.text : theme.textSecondary, fontFamily: 'Inter_900Black' }]}>DETAILED</Text>
          </TouchableOpacity>
        </View>

        {/* Daily total — DETAILED mode only, shown when items exist */}
        {mode === 'detailed' && foodItems.length > 0 && (
          <DailyTotalCard items={foodItems} theme={theme} />
        )}

        {/* QUICK */}
        {mode === 'quick' && isToday && (
          <>
            {/* Question cards */}
            <QuestionCard
              icon="🍽️"
              iconBg={theme.isDark ? '#2A2A2A' : '#F0F0F0'}
              label="STUCK TO YOUR DIET?"
              sub="Did you follow your planned meals today?"
              state={stuckToMeal}
              onAnswer={setStuckToMeal}
              yesColor="#22A664"
              noColor="#E84A4A"
              theme={theme}
            />
            <QuestionCard
              icon="🍔"
              iconBg={theme.isDark ? '#2A2A2A' : '#FFE9D6'}
              label="HAD JUNK FOOD?"
              sub="Any processed or unhealthy food?"
              state={hadJunk}
              onAnswer={setHadJunk}
              yesColor="#E84A4A"
              noColor="#22A664"
              theme={theme}
            />

            {/* Food Quality — monochrome dial */}
            <View style={[qcs.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <FuelRatingDial
                value={foodQuality} max={10}
                eyebrow="FOOD QUALITY"
                label={QUALITY_LABELS[foodQuality].toUpperCase()}
                lowLabel="POOR" highLabel="CLEAN"
                theme={theme}
                onPress={() => setShowQPicker(true)}
                onChange={setFoodQuality}
              />
              <Text style={{ fontSize: 8, letterSpacing: 2, color: theme.textMuted, fontFamily: 'Inter_700Bold', opacity: 0.5, marginTop: 6, textAlign: 'center' }}>
                TAP BAR TO ADJUST · TAP NUMBER FOR PICKER
              </Text>
            </View>

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

            <TouchableOpacity
              style={[s.logFuelBtn, {
                backgroundColor: theme.text,
                opacity: (stuckToMeal === null || hadJunk === null || submitting) ? 0.4 : 1,
              }]}
              onPress={submitQuick}
              disabled={stuckToMeal === null || hadJunk === null || submitting}
              activeOpacity={0.85}
            >
              <Text style={[s.logFuelBtnText, { color: '#FFFFFF', fontFamily: 'Inter_900Black' }]}>
                {submitting ? 'LOGGING...' : 'LOG FUEL'}
              </Text>
              <View style={s.logFuelArrow}>
                <Ionicons name="arrow-forward" size={12} color={theme.text} />
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* ── DETAILED: food item entry form ── */}
        {mode === 'detailed' && isToday && (
          <View style={s.detailedWrap}>
            {/* Snap row */}
            <View style={s.snapRow}>
              <TouchableOpacity
                style={[s.snapBtn, { borderColor: theme.border, backgroundColor: theme.card, opacity: scanning ? 0.6 : 1 }]}
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
                style={[s.snapBtnSm, { borderColor: theme.border, backgroundColor: theme.card }]}
                onPress={() => handleSnapTrack('gallery')}
                disabled={scanning}
                activeOpacity={0.7}
              >
                <Ionicons name="images-outline" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Manual input button */}
            <TouchableOpacity
              style={[s.manualInputBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
              onPress={() => setShowManualInput(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={16} color={theme.text} />
              <Text style={[s.manualInputBtnText, { color: theme.text, fontFamily: 'Inter_700Bold' }]}>MANUAL INPUT</Text>
            </TouchableOpacity>

            {/* Manual entry modal */}
            <Modal visible={showManualInput} transparent animationType="slide">
              <Pressable style={[qs.backdrop, { backgroundColor: theme.backdrop }]} onPress={() => setShowManualInput(false)} />
              <View style={[mi.sheet, { backgroundColor: theme.cardElevated }]}>
                <View style={[qs.handle, { backgroundColor: theme.border }]} />
                <Text style={[mi.title, { color: theme.text, fontFamily: 'Inter_900Black' }]}>LOG FOOD</Text>

                {/* Food name */}
                <View style={[mi.nameBox, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  <Ionicons name="fast-food-outline" size={15} color={theme.textSecondary} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[mi.nameInput, { color: theme.text, fontFamily: 'Inter_700Bold' }]}
                    value={itemName}
                    onChangeText={setItemName}
                    placeholder="Food name..."
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="words"
                  />
                </View>

                {/* Macro inputs 2×2 grid */}
                <View style={[mi.macroGrid, { borderColor: theme.border }]}>
                  {([
                    { label: 'PROTEIN', icon: '💪', color: '#0A84FF', val: itemProtein,  set: setItemProtein  },
                    { label: 'CARBS',   icon: '🌾', color: '#34C759', val: itemCarbs,    set: setItemCarbs    },
                    { label: 'FIBRE',   icon: '🥦', color: '#30D158', val: itemFibre,    set: setItemFibre    },
                    { label: 'FAT',     icon: '🥑', color: '#FFD60A', val: itemFat,      set: setItemFat      },
                  ] as { label: string; icon: string; color: string; val: string; set: (v: string) => void }[]).map((m, i) => (
                    <View key={m.label} style={[mi.macroCell,
                      i % 2 === 1 && { borderLeftWidth: 1, borderLeftColor: theme.border },
                      i >= 2      && { borderTopWidth: 1,  borderTopColor:  theme.border },
                    ]}>
                      <View style={mi.macroCellHeader}>
                        <Text style={mi.macroCellIcon}>{m.icon}</Text>
                        <Text style={[mi.macroCellLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>{m.label}</Text>
                      </View>
                      <View style={mi.macroCellRow}>
                        <TextInput
                          style={[mi.macroCellInput, { color: m.color, fontFamily: 'SpaceGrotesk_700Bold' }]}
                          value={m.val}
                          onChangeText={m.set}
                          placeholder="—"
                          placeholderTextColor={theme.textMuted}
                          keyboardType="decimal-pad"
                        />
                        <Text style={[mi.macroCellUnit, { color: theme.textMuted, fontFamily: 'Inter_400Regular' }]}>g</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Meal time */}
                <Text style={[mi.whenLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>WHEN</Text>
                <View style={mi.mealRow}>
                  {([
                    { label: 'MORNING',   value: 'morning' as MealTime, icon: '🌅' },
                    { label: 'AFTERNOON', value: 'lunch'   as MealTime, icon: '☀️' },
                    { label: 'EVENING',   value: 'evening' as MealTime, icon: '🌆' },
                    { label: 'DINNER',    value: 'dinner'  as MealTime, icon: '🍽️' },
                  ]).map(mt => (
                    <TouchableOpacity
                      key={mt.label}
                      style={[mi.mealChip, {
                        backgroundColor: itemMealTime === mt.value ? theme.text : theme.surface,
                        borderColor:     itemMealTime === mt.value ? theme.text : theme.border,
                      }]}
                      onPress={() => setItemMealTime(mt.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={mi.mealChipIcon}>{mt.icon}</Text>
                      <Text style={[mi.mealChipLabel, {
                        color: itemMealTime === mt.value ? theme.bg : theme.textSecondary,
                        fontFamily: 'Inter_700Bold',
                      }]}>{mt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Log button */}
                <TouchableOpacity
                  style={[mi.logBtn, { backgroundColor: theme.text, opacity: (!itemName.trim() || addingItem) ? 0.4 : 1 }]}
                  onPress={submitDetailedItem}
                  disabled={!itemName.trim() || addingItem}
                  activeOpacity={0.85}
                >
                  <Text style={[mi.logBtnText, { color: theme.bg, fontFamily: 'Inter_900Black' }]}>
                    {addingItem ? 'LOGGING...' : 'LOG FOOD →'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Modal>
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
                {/* What you ate list */}
                <View style={[s.sectionHeader, { marginTop: 20 }]}>
                  <Text style={[s.sectionTitle, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>WHAT YOU ATE</Text>
                  <Text style={[s.sectionCount, { color: theme.textSecondary, fontFamily: 'SpaceGrotesk_500Medium' }]}>{String(foodItems.length).padStart(2,'0')} ITEMS</Text>
                </View>

                {/* Log rows in a single card */}
                <View style={[s.logCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  {foodItems.map((item, idx) => (
                    <FLogRow
                      key={item.id}
                      item={item}
                      theme={theme}
                      last={idx === foodItems.length - 1}
                      onDelete={isToday ? () => deleteItem(item.id) : undefined}
                    />
                  ))}
                </View>

                {/* LOG ANOTHER — dashed */}
                {isToday && (
                  <TouchableOpacity
                    style={[s.logAnotherBtn, { borderColor: theme.text }]}
                    onPress={() => mainScroll.current?.scrollTo({ y: 0, animated: true })}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="add" size={14} color={theme.text} />
                    <Text style={[s.logAnotherText, { color: theme.text, fontFamily: 'Inter_900Black' }]}>LOG ANOTHER</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </>
        )}

      </ScrollView>
    </SafeAreaView></DarkBackground>
  );
}

function dayLetter(dateStr: string) {
  return ['M','T','W','T','F','S','S'][(new Date(dateStr + 'T12:00:00').getDay() + 6) % 7];
}

const MEAL_TAGS: Record<string, { emoji: string; label: string }> = {
  morning: { emoji: '🌅', label: 'MORNING' },
  brunch:  { emoji: '☕', label: 'BRUNCH'  },
  lunch:   { emoji: '🥗', label: 'LUNCH'   },
  evening: { emoji: '🌃', label: 'EVENING' },
  dinner:  { emoji: '🍽️', label: 'DINNER'  },
  snacks:  { emoji: '🥨', label: 'SNACKS'  },
};

// ── Compact log row — shown in the WHAT YOU ATE list ──────────────────
function FLogRow({ item, theme, onDelete, last }: {
  item: FoodItem; theme: any; onDelete?: () => void; last?: boolean;
}) {
  const time = item.createdAt
    ? new Date(item.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';
  const mt = MEAL_TAGS[item.mealTime] ?? { emoji: '🍽️', label: item.mealTime.toUpperCase() };
  const macros = [
    item.calories != null ? `${item.calories} kcal` : null,
    item.protein  != null ? `${item.protein}P`      : null,
    item.carbs    != null ? `${item.carbs}C`         : null,
    item.fat      != null ? `${item.fat}F`           : null,
  ].filter(Boolean).join(' · ');

  return (
    <View style={[flr.row, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
      <Text style={[flr.time, { color: theme.textMuted, fontFamily: 'SpaceGrotesk_500Medium' }]}>{time}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={[flr.tagBadge, { backgroundColor: theme.surface }]}>
          <Text style={[flr.tagText, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{mt.emoji} {mt.label}</Text>
        </View>
        <Text style={[flr.title, { color: theme.text, fontFamily: 'Inter_900Black' }]} numberOfLines={1}>{item.name}</Text>
        {macros.length > 0 && (
          <Text style={[flr.sub, { color: theme.textMuted, fontFamily: 'SpaceGrotesk_500Medium' }]}>{macros}</Text>
        )}
      </View>
      {onDelete && (
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={14} color={theme.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const flr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  time:     { fontSize: 10, letterSpacing: 0.5, minWidth: 38 },
  tagBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start', marginBottom: 4 },
  tagText:  { fontSize: 8, letterSpacing: 1.5 },
  title:    { fontSize: 14, letterSpacing: -0.2 },
  sub:      { fontSize: 10, letterSpacing: 0.3, marginTop: 2 },
});

// ── Daily macro totals card ───────────────────────────────────────────
function DailyTotalCard({ items, theme }: { items: FoodItem[]; theme: any }) {
  const tot = items.reduce(
    (a, it) => ({
      cal:  a.cal  + (it.calories ?? 0),
      pro:  a.pro  + (it.protein  ?? 0),
      carb: a.carb + (it.carbs    ?? 0),
      fat:  a.fat  + (it.fat      ?? 0),
    }),
    { cal: 0, pro: 0, carb: 0, fat: 0 }
  );
  const cols = [
    { v: String(Math.round(tot.cal)),  l: 'CAL',   pct: Math.min(1, tot.cal  / 2000) },
    { v: `${Math.round(tot.pro)}g`,   l: 'PRO',   pct: Math.min(1, tot.pro  / 150)  },
    { v: `${Math.round(tot.carb)}g`,  l: 'CARBS', pct: Math.min(1, tot.carb / 250)  },
    { v: `${Math.round(tot.fat)}g`,   l: 'FAT',   pct: Math.min(1, tot.fat  / 65)   },
  ];
  return (
    <View style={[dtc.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={dtc.top}>
        <Text style={[dtc.label, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>DAILY TOTAL</Text>
        <Text style={[dtc.sub, { color: theme.textMuted, fontFamily: 'SpaceGrotesk_500Medium' }]}>
          {Math.round(tot.cal)} / 2,000 kcal
        </Text>
      </View>
      <View style={[dtc.divider, { backgroundColor: theme.border }]} />
      <View style={dtc.grid}>
        {cols.map((c, i) => (
          <View key={i} style={[dtc.cell, i < 3 && { borderRightWidth: 1, borderRightColor: theme.border }]}>
            <Text style={[dtc.val, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{c.v}</Text>
            <View style={[dtc.barBg, { backgroundColor: theme.surface }]}>
              <View style={[dtc.barFill, { width: `${c.pct * 100}%` as any, backgroundColor: '#B8F23A' }]} />
            </View>
            <Text style={[dtc.macroLbl, { color: theme.textMuted, fontFamily: 'Inter_700Bold' }]}>{c.l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const dtc = StyleSheet.create({
  card:     { marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  top:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  label:    { fontSize: 10, letterSpacing: 2 },
  sub:      { fontSize: 10 },
  divider:  { height: 1 },
  grid:     { flexDirection: 'row', paddingBottom: 14 },
  cell:     { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  val:      { fontSize: 18, letterSpacing: -0.5, lineHeight: 20 },
  barBg:    { width: '60%', height: 3, borderRadius: 2, marginVertical: 6, overflow: 'hidden' },
  barFill:  { height: 3, borderRadius: 2 },
  macroLbl: { fontSize: 9, letterSpacing: 1.5 },
});

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

  const { trend, delta } = React.useMemo(() => {
    const prev = last7.slice(0, 6).filter(d => d.score != null).map(d => d.score as number);
    const avg = prev.length ? Math.round(prev.reduce((a, b) => a + b, 0) / prev.length) : null;
    const diff = avg != null ? score - avg : null;
    const scored = last7.filter(d => d.score != null).map(d => d.score as number);
    if (scored.length < 3) return { trend: { label: 'SHOWING UP', color: '#0A84FF', icon: '·' }, delta: diff };
    const half = Math.floor(scored.length / 2);
    const early  = scored.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const recent = scored.slice(-half).reduce((a, b) => a + b, 0) / half;
    const d = recent - early;
    if (d > 8)  return { trend: { label: 'GETTING BETTER', color: '#34C759', icon: '↑' }, delta: diff };
    if (d < -8) return { trend: { label: 'DECLINING',      color: '#FF453A', icon: '↓' }, delta: diff };
    return { trend: { label: 'CONSISTENT', color: '#0A84FF', icon: '→' }, delta: diff };
  }, [last7, score]);

  const isToday = selectedDate === today();

  return (
    <View style={[sc.card, { backgroundColor: '#14110D', borderColor: 'rgba(255,255,255,0.07)' }]}>
      {/* Top row: score left, trend+delta right */}
      <View style={sc.top}>
        <View style={sc.left}>
          <Text style={[sc.eyebrow, { color: 'rgba(245,241,232,0.45)', fontFamily: 'Inter_700Bold' }]}>
            {isToday ? "TODAY'S FUEL" : 'FUEL SCORE'}
          </Text>
          <Text style={[sc.scoreNum, { color: '#F5F1E8', fontFamily: 'SpaceGrotesk_700Bold' }]}>{score}</Text>
        </View>

        <View style={sc.right}>
          {trend && (
            <View style={[sc.trendPill, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={[sc.trendText, { color: '#F5F1E8', fontFamily: 'Inter_900Black' }]}>
                {trend.label}
              </Text>
            </View>
          )}
          {delta != null && (
            <Text style={[sc.deltaText, { color: 'rgba(245,241,232,0.50)', fontFamily: 'Inter_500Medium' }]}>
              {delta > 0 ? '+' : ''}{delta} vs last 7 days
            </Text>
          )}
        </View>
      </View>

      {/* Lime progress bar */}
      <View style={[sc.progressBg, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
        <View style={[sc.progressFill, { width: `${score}%` as any, backgroundColor: '#B8F23A' }]} />
      </View>

      {/* Divider */}
      <View style={[sc.divider, { backgroundColor: 'rgba(255,255,255,0.07)' }]} />

      {/* 7-day squares — white opacity scales with score */}
      <View style={sc.gridRow}>
        {last7.map((day) => {
          const s = day.score;
          const isSelected = day.date === selectedDate;
          const inkOpacity = s == null ? 0 : Math.min(1, 0.28 + (s / 100) * 0.72);
          const bg = s == null
            ? 'rgba(255,255,255,0.06)'
            : `rgba(255,255,255,${inkOpacity * 0.9})`;
          const textColor = s == null
            ? 'rgba(245,241,232,0.25)'
            : (inkOpacity > 0.55 ? '#14110D' : 'rgba(245,241,232,0.70)');
          return (
            <View key={day.date} style={[sc.square, {
              backgroundColor: bg,
              borderWidth: isSelected ? 2 : 0,
              borderColor: '#B8F23A',
              opacity: s == null ? 0.45 : 1,
            }]}>
              <Text style={[sc.squareNum, { color: textColor, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                {s ?? '·'}
              </Text>
              <Text style={[sc.squareDay, { color: textColor, fontFamily: 'Inter_700Bold' }]}>
                {dayLetter(day.date)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const sc = StyleSheet.create({
  card:       { marginHorizontal: 16, marginBottom: 14, borderWidth: 1.5, borderRadius: 18, overflow: 'hidden' },
  top:        { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 16, paddingBottom: 14 },
  left:       { gap: 2 },
  eyebrow:    { fontSize: 10, letterSpacing: 2 },
  scoreNum:   { fontSize: 64, lineHeight: 68, letterSpacing: -2 },
  right:      { alignItems: 'flex-end', gap: 6, paddingTop: 2 },
  trendPill:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  trendText:  { fontSize: 10, letterSpacing: 1.5 },
  deltaText:  { fontSize: 11 },
  progressBg:  { height: 4, marginHorizontal: 16, marginBottom: 14, borderRadius: 2, overflow: 'hidden' },
  progressFill:{ height: 4, borderRadius: 2 },
  divider:    { height: 1, marginHorizontal: 0 },
  gridRow:    { flexDirection: 'row', padding: 12, gap: 6 },
  square:     { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center', gap: 3 },
  squareNum:  { fontSize: 13, lineHeight: 15 },
  squareDay:  { fontSize: 9, letterSpacing: 0.5 },
});

const ITEM_W = 56;
const SCORES = [0,1,2,3,4,5,6,7,8,9,10];

function FuelRatingDial({ value, max = 10, eyebrow, label, lowLabel, highLabel, theme, onPress, onChange }: {
  value: number; max?: number; eyebrow: string; label: string;
  lowLabel: string; highLabel: string; theme: any; onPress?: () => void; onChange?: (v: number) => void;
}) {
  const pct = value / max;

  const barRef    = useRef<View>(null);
  const barX      = useRef(0);
  const barW      = useRef(0);
  const changeRef = useRef(onChange);
  const maxRef    = useRef(max);
  useEffect(() => { changeRef.current = onChange; }, [onChange]);
  useEffect(() => { maxRef.current    = max;      }, [max]);

  const calcVal = (pageX: number) => {
    const p = Math.max(0, Math.min(1, (pageX - barX.current) / barW.current));
    return Math.max(1, Math.min(maxRef.current, Math.round(p * (maxRef.current - 1)) + 1));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: ()     => true,
      onMoveShouldSetPanResponder:  (_, s) => Math.abs(s.dx) > 2,
      onPanResponderTerminationRequest:    () => false,
      onPanResponderGrant: (e) => { changeRef.current?.(calcVal(e.nativeEvent.pageX)); },
      onPanResponderMove:  (e) => { changeRef.current?.(calcVal(e.nativeEvent.pageX)); },
    })
  ).current;

  const onBarLayout = useCallback(() => {
    barRef.current?.measure((_, __, w, ___, px) => { barX.current = px; barW.current = w; });
  }, []);

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 9, letterSpacing: 2.5, color: theme.textMuted, fontFamily: 'Inter_700Bold' }}>{eyebrow}</Text>
        <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: theme.surface }}>
          <Text style={{ fontSize: 9, letterSpacing: 2, color: theme.text, fontFamily: 'Inter_900Black' }}>{label}</Text>
        </View>
      </View>

      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 8 }}>
        <Text style={{ fontSize: 48, letterSpacing: -3, lineHeight: 48, color: theme.text, fontFamily: 'Inter_900Black' }}>{value}</Text>
        <Text style={{ fontSize: 16, color: theme.textMuted, paddingBottom: 6, fontFamily: 'Inter_500Medium' }}>/{max}</Text>
      </TouchableOpacity>

      <View style={{ marginTop: 14 }}>
        <View
          ref={barRef}
          style={{ height: 44 }}
          onLayout={onBarLayout}
          {...pan.panHandlers}
        >
          {/* Track */}
          <View style={{ position: 'absolute', left: 0, right: 0, top: 20, height: 4, borderRadius: 2, backgroundColor: theme.surface }} />
          {/* Fill */}
          <View style={{ position: 'absolute', left: 0, top: 20, height: 4, borderRadius: 2, width: `${pct * 100}%` as any, backgroundColor: theme.text }} />
          {/* Ticks */}
          <View style={{ position: 'absolute', left: 0, right: 0, top: 18, flexDirection: 'row', justifyContent: 'space-between' }}>
            {Array.from({ length: max + 1 }).map((_, i) => (
              <View key={i} style={{ width: 1.5, height: 8, borderRadius: 1, backgroundColor: i / max <= pct ? theme.text : theme.surface }} />
            ))}
          </View>
          {/* Knob */}
          <View style={{
            position: 'absolute',
            left: `${pct * 100}%` as any,
            marginLeft: -11,
            top: 11,
            width: 22, height: 22, borderRadius: 11,
            backgroundColor: theme.card, borderWidth: 2.5, borderColor: theme.text,
            shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 }, elevation: 3,
          }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ fontSize: 9, letterSpacing: 1.5, color: theme.textMuted, fontFamily: 'Inter_700Bold' }}>{lowLabel}</Text>
          <Text style={{ fontSize: 9, letterSpacing: 1.5, color: theme.textMuted, fontFamily: 'Inter_700Bold' }}>{highLabel}</Text>
        </View>
      </View>
    </View>
  );
}

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

function MacroTracker({ items, theme, targets, onQuickLog }: {
  items: FoodItem[];
  theme: any;
  targets: MacroTargets;
  onQuickLog?: (macros: { calories?: number; protein?: number; fat?: number; carbs?: number }) => void;
}) {
  const totals = items.reduce(
    (a, i) => ({
      calories: a.calories + (i.calories ?? 0),
      protein:  a.protein  + (i.protein  ?? 0),
      fat:      a.fat      + (i.fat      ?? 0),
      carbs:    a.carbs    + (i.carbs    ?? 0),
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  const [inputCal,  setInputCal]  = React.useState('');
  const [inputPro,  setInputPro]  = React.useState('');
  const [inputCarb, setInputCarb] = React.useState('');
  const [inputFat,  setInputFat]  = React.useState('');
  const [focused, setFocused] = React.useState<string | null>(null);
  const [saving, setSaving]   = React.useState(false);

  const calRef  = React.useRef<TextInput>(null);
  const proRef  = React.useRef<TextInput>(null);
  const carbRef = React.useRef<TextInput>(null);
  const fatRef  = React.useRef<TextInput>(null);

  const hasInput = !!(inputCal || inputPro || inputCarb || inputFat);

  async function handleLog() {
    if (!onQuickLog || saving) return;
    setSaving(true);
    await onQuickLog({
      calories: inputCal  ? Number(inputCal)  : undefined,
      protein:  inputPro  ? Number(inputPro)  : undefined,
      carbs:    inputCarb ? Number(inputCarb) : undefined,
      fat:      inputFat  ? Number(inputFat)  : undefined,
    });
    setInputCal(''); setInputPro(''); setInputCarb(''); setInputFat('');
    setSaving(false);
  }

  const cells = [
    { key: 'calories', label: 'Calories', unit: 'kcal', icon: '🔥', color: MACRO_COLORS.calories,
      total: totals.calories, input: inputCal, setInput: setInputCal, ref: calRef },
    { key: 'protein',  label: 'Protein',  unit: 'g',    icon: '💪', color: MACRO_COLORS.protein,
      total: totals.protein,  input: inputPro, setInput: setInputPro, ref: proRef },
    { key: 'carbs',    label: 'Carbs',    unit: 'g',    icon: '🌾', color: MACRO_COLORS.carbs,
      total: totals.carbs,    input: inputCarb, setInput: setInputCarb, ref: carbRef },
    { key: 'fat',      label: 'Fat',      unit: 'g',    icon: '🥑', color: MACRO_COLORS.fat,
      total: totals.fat,      input: inputFat, setInput: setInputFat, ref: fatRef },
  ] as const;

  return (
    <View style={[mt.card, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <View style={mt.grid}>
        {cells.map((cell, idx) => {
          const val    = Math.round(cell.total);
          const target = targets[cell.key as keyof MacroTargets];
          const pct    = Math.min((val + (Number(cell.input) || 0)) / target, 1);
          const isFocused = focused === cell.key;
          const displayVal = cell.input || (val > 0 ? String(val) : '');
          const isRight  = idx % 2 === 1;
          const isBottom = idx >= 2;

          return (
            <TouchableOpacity
              key={cell.key}
              style={[mt.cell,
                isRight  && { borderLeftColor: theme.border, borderLeftWidth: 1 },
                isBottom && { borderTopColor: theme.border, borderTopWidth: 1 },
                isFocused && { backgroundColor: cell.color + '12' },
              ]}
              onPress={() => (cell.ref as React.RefObject<TextInput>).current?.focus()}
              activeOpacity={0.75}
            >
              <View style={mt.cellHeader}>
                <Text style={mt.cellIcon}>{cell.icon}</Text>
                <Text style={[mt.cellLabel, { color: isFocused ? cell.color : theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                  {cell.label}
                </Text>
              </View>
              <View style={mt.cellValRow}>
                <TextInput
                  ref={cell.ref as React.RefObject<TextInput>}
                  style={[mt.cellInput, { color: displayVal ? cell.color : theme.textTertiary, fontFamily: 'SpaceGrotesk_700Bold' }]}
                  value={cell.input}
                  onChangeText={cell.setInput as (v: string) => void}
                  onFocus={() => setFocused(cell.key)}
                  onBlur={() => setFocused(null)}
                  placeholder={val > 0 ? String(val) : '—'}
                  placeholderTextColor={val > 0 ? cell.color : theme.textTertiary}
                  keyboardType="decimal-pad"
                />
                <Text style={[mt.cellUnit, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>{cell.unit}</Text>
              </View>
              <View style={[mt.barTrack, { backgroundColor: theme.surfaceStrong }]}>
                <View style={[mt.barFill, { width: `${pct * 100}%` as any, backgroundColor: cell.color }]} />
              </View>
              <Text style={[mt.cellTarget, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                / {target.toLocaleString()} {cell.unit}
              </Text>
              {isFocused && <View style={[mt.focusLine, { backgroundColor: cell.color }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {hasInput && onQuickLog && (
        <>
          <View style={[mt.divider, { backgroundColor: theme.border }]} />
          <TouchableOpacity style={[mt.logBtn, { opacity: saving ? 0.5 : 1 }]} onPress={handleLog} disabled={saving} activeOpacity={0.85}>
            <Text style={[mt.logBtnText, { color: theme.text, fontFamily: 'Inter_900Black' }]}>
              {saving ? 'SAVING...' : 'LOG MACROS →'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const mt = StyleSheet.create({
  card:       { marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  grid:       { flexDirection: 'row', flexWrap: 'wrap' },
  cell:       { width: '50%', padding: 14, gap: 6, position: 'relative' },
  cellHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cellIcon:   { fontSize: 14 },
  cellLabel:  { fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' },
  cellValRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  cellInput:  { fontSize: 26, letterSpacing: -0.5, lineHeight: 30, minWidth: 50, paddingVertical: 0 },
  cellUnit:   { fontSize: 10 },
  barTrack:   { height: 4, borderRadius: 2, overflow: 'hidden' },
  barFill:    { height: '100%', borderRadius: 2 },
  cellTarget: { fontSize: 10 },
  focusLine:  { position: 'absolute', bottom: 0, left: 14, right: 14, height: 2, borderRadius: 1 },
  divider:    { height: 1 },
  logBtn:     { paddingVertical: 13, alignItems: 'center' },
  logBtnText: { fontSize: 11, letterSpacing: 3 },
});

const MEAL_TIME_ICONS: Record<string, string> = {
  morning: '🌅', brunch: '☕', lunch: '🥗', evening: '🌆', dinner: '🍽️', snacks: '🍎',
};

function FoodItemCard({ item, theme, onDelete, onUpdate }: {
  item: FoodItem; theme: any;
  onDelete?: () => void;
  onUpdate?: (patch: { calories?: number; protein?: number; fat?: number; carbs?: number }) => void;
}) {
  const [cal,  setCal]  = React.useState(item.calories != null ? String(Math.round(item.calories)) : '');
  const [pro,  setPro]  = React.useState(item.protein  != null ? String(Math.round(item.protein))  : '');
  const [carb, setCarb] = React.useState(item.carbs    != null ? String(Math.round(item.carbs))    : '');
  const [fat,  setFat]  = React.useState(item.fat      != null ? String(Math.round(item.fat))      : '');
  const [focused, setFocused] = React.useState<string | null>(null);
  const [saving, setSaving]   = React.useState(false);

  const calRef  = React.useRef<TextInput>(null);
  const proRef  = React.useRef<TextInput>(null);
  const carbRef = React.useRef<TextInput>(null);
  const fatRef  = React.useRef<TextInput>(null);

  const origCal  = item.calories != null ? String(Math.round(item.calories)) : '';
  const origPro  = item.protein  != null ? String(Math.round(item.protein))  : '';
  const origCarb = item.carbs    != null ? String(Math.round(item.carbs))    : '';
  const origFat  = item.fat      != null ? String(Math.round(item.fat))      : '';
  const isDirty  = cal !== origCal || pro !== origPro || carb !== origCarb || fat !== origFat;

  async function handleSave() {
    if (!onUpdate || saving) return;
    setSaving(true);
    await onUpdate({
      calories: cal  ? Number(cal)  : undefined,
      protein:  pro  ? Number(pro)  : undefined,
      carbs:    carb ? Number(carb) : undefined,
      fat:      fat  ? Number(fat)  : undefined,
    });
    setSaving(false);
  }

  const macroFields = [
    { key: 'cal',  label: 'CAL',   val: cal,  setVal: setCal,  ref: calRef,  unit: 'kcal', color: MACRO_COLORS.calories, icon: '🔥' },
    { key: 'pro',  label: 'PRO',   val: pro,  setVal: setPro,  ref: proRef,  unit: 'g',    color: MACRO_COLORS.protein,  icon: '💪' },
    { key: 'carb', label: 'CARBS', val: carb, setVal: setCarb, ref: carbRef, unit: 'g',    color: MACRO_COLORS.carbs,    icon: '🌾' },
    { key: 'fat',  label: 'FAT',   val: fat,  setVal: setFat,  ref: fatRef,  unit: 'g',    color: MACRO_COLORS.fat,      icon: '🥑' },
  ];

  return (
    <View style={[fi.itemCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
      {/* Header */}
      <View style={fi.itemHeader}>
        <View style={[fi.mealTimeBadge, { backgroundColor: theme.surface }]}>
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

      <View style={[fi.itemDivider, { backgroundColor: theme.border }]} />

      {/* Tappable macro grid */}
      <View style={fi.macroGrid}>
        {macroFields.map((f, i) => {
          const isFocused = focused === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[fi.macroCell,
                i % 2 === 1 && { borderLeftColor: theme.border, borderLeftWidth: 1 },
                i >= 2      && { borderTopColor: theme.border, borderTopWidth: 1 },
                isFocused   && { backgroundColor: f.color + '12' },
              ]}
              onPress={() => f.ref.current?.focus()}
              activeOpacity={0.75}
            >
              <View style={fi.macroCellTop}>
                <Text style={fi.macroCellIcon}>{f.icon}</Text>
                <Text style={[fi.macroCellLabel, { color: isFocused ? f.color : theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>
                  {f.label}
                </Text>
              </View>
              <View style={fi.macroCellInputRow}>
                <TextInput
                  ref={f.ref}
                  style={[fi.macroCellInput, { color: f.val ? f.color : theme.textTertiary, fontFamily: 'SpaceGrotesk_700Bold' }]}
                  value={f.val}
                  onChangeText={f.setVal}
                  onFocus={() => setFocused(f.key)}
                  onBlur={() => setFocused(null)}
                  placeholder="—"
                  placeholderTextColor={theme.textTertiary}
                  keyboardType="decimal-pad"
                />
                <Text style={[fi.macroCellUnit, { color: theme.textSecondary, fontFamily: 'Inter_400Regular' }]}>{f.unit}</Text>
              </View>
              {isFocused && (
                <View style={[fi.macroCellLine, { backgroundColor: f.color }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Save button */}
      {isDirty && onUpdate && (
        <>
          <View style={[fi.itemDivider, { backgroundColor: theme.border }]} />
          <TouchableOpacity
            style={[fi.saveBtn, { opacity: saving ? 0.5 : 1 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={[fi.saveBtnText, { color: theme.text, fontFamily: 'Inter_900Black' }]}>
              {saving ? 'SAVING...' : 'SAVE CHANGES →'}
            </Text>
          </TouchableOpacity>
        </>
      )}
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

  const cols = [
    { label: 'CAL',   value: Math.round(totals.calories), unit: '',  color: MACRO_COLORS.calories },
    { label: 'PRO',   value: Math.round(totals.protein),  unit: 'g', color: MACRO_COLORS.protein },
    { label: 'CARBS', value: Math.round(totals.carbs),    unit: 'g', color: MACRO_COLORS.carbs },
    { label: 'FAT',   value: Math.round(totals.fat),      unit: 'g', color: MACRO_COLORS.fat },
  ];

  return (
    <View style={[fi.totalsBar, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <Text style={[fi.totalsLabel, { color: theme.textSecondary, fontFamily: 'Inter_700Bold' }]}>DAILY TOTAL</Text>
      <View style={fi.totalsRow}>
        {cols.map((t, i) => (
          <View key={t.label} style={[fi.totalCell, i < cols.length - 1 && { borderRightColor: theme.border, borderRightWidth: 1 }]}>
            <Text style={[fi.totalVal, { color: t.color, fontFamily: 'SpaceGrotesk_700Bold' }]}>
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
  itemCard:        { marginHorizontal: 16, marginTop: 8, borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  itemHeader:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  mealTimeBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  mealTimeEmoji:   { fontSize: 13 },
  mealTimeText:    { fontSize: 8, letterSpacing: 1.5 },
  itemName:        { flex: 1, fontSize: 14, letterSpacing: 0.2 },
  itemDivider:     { height: 1 },
  macroGrid:       { flexDirection: 'row', flexWrap: 'wrap' },
  macroCell:       { width: '50%', padding: 14, gap: 6, position: 'relative' },
  macroCellTop:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  macroCellIcon:   { fontSize: 14 },
  macroCellLabel:  { fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' },
  macroCellInputRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  macroCellInput:  { fontSize: 24, letterSpacing: -0.5, minWidth: 50, paddingVertical: 0 },
  macroCellUnit:   { fontSize: 10 },
  macroCellLine:   { position: 'absolute', bottom: 0, left: 14, right: 14, height: 2, borderRadius: 1 },
  saveBtn:         { paddingVertical: 12, alignItems: 'center' },
  saveBtnText:     { fontSize: 10, letterSpacing: 3 },
  // totals bar
  totalsBar:      { marginHorizontal: 16, marginTop: 8, borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  totalsLabel:    { fontSize: 9, letterSpacing: 2.5, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  totalsRow:      { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  totalCell:      { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4 },
  totalVal:       { fontSize: 18 },
  totalCellLabel: { fontSize: 8, letterSpacing: 1.5 },
});

function QuestionCard({ icon, iconBg, label, sub, state, onAnswer, yesColor, noColor, theme }: {
  icon: string;
  iconBg: string;
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
    <View style={[qcs.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={{ flex: 1 }}>
          <Text style={[qcs.label, { color: theme.text, fontFamily: 'Inter_900Black' }]}>{label}</Text>
          <Text style={[qcs.sub, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>{sub}</Text>
          <View style={qcs.btnRow}>
            <TouchableOpacity
              style={[qcs.yesNoBtn, {
                backgroundColor: yesActive ? yesColor + '20' : 'transparent',
                borderColor: yesActive ? yesColor : theme.border,
              }]}
              onPress={() => onAnswer(true)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={yesActive ? 'checkmark' : 'checkmark-outline'}
                size={14}
                color={yesActive ? yesColor : theme.textSecondary}
              />
              <Text style={[qcs.yesNoText, {
                color: yesActive ? yesColor : theme.textSecondary,
                fontFamily: 'Inter_900Black',
              }]}>YES</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[qcs.yesNoBtn, {
                backgroundColor: noActive ? noColor + '20' : 'transparent',
                borderColor: noActive ? noColor : theme.border,
              }]}
              onPress={() => onAnswer(false)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={noActive ? 'close' : 'close-outline'}
                size={14}
                color={noActive ? noColor : theme.textSecondary}
              />
              <Text style={[qcs.yesNoText, {
                color: noActive ? noColor : theme.textSecondary,
                fontFamily: 'Inter_900Black',
              }]}>NO</Text>
            </TouchableOpacity>
          </View>
      </View>
    </View>
  );
}

const qcs = StyleSheet.create({
  // Question cards
  card:       { marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderRadius: 16, padding: 14 },
  iconBubble: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label:      { fontSize: 12, letterSpacing: 1 },
  sub:        { fontSize: 10, letterSpacing: 0.2, marginTop: 2 },
  btnRow:     { flexDirection: 'row', gap: 8, marginTop: 10 },
  yesNoBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderWidth: 1.5, borderRadius: 10 },
  yesNoText:  { fontSize: 11, letterSpacing: 1.5 },

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

// ── Manual input modal styles ────────────────────────────────────────────────
const mi = StyleSheet.create({
  sheet:          { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, paddingTop: 12, paddingHorizontal: 20 },
  title:          { fontSize: 13, letterSpacing: 3, textAlign: 'center', marginBottom: 20 },
  nameBox:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 16 },
  nameInput:      { flex: 1, fontSize: 15 },
  macroGrid:      { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 20 },
  macroCell:      { width: '50%', padding: 14, gap: 6 },
  macroCellHeader:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  macroCellIcon:  { fontSize: 13 },
  macroCellLabel: { fontSize: 9, letterSpacing: 1.5 },
  macroCellRow:   { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  macroCellInput: { fontSize: 26, letterSpacing: -0.5, lineHeight: 30, minWidth: 50, paddingVertical: 0 },
  macroCellUnit:  { fontSize: 10 },
  whenLabel:      { fontSize: 9, letterSpacing: 2.5, marginBottom: 10 },
  mealRow:        { flexDirection: 'row', gap: 8, marginBottom: 22 },
  mealChip:       { flex: 1, alignItems: 'center', paddingVertical: 10, borderWidth: 1, borderRadius: 10, gap: 4 },
  mealChipIcon:   { fontSize: 14 },
  mealChipLabel:  { fontSize: 8, letterSpacing: 1 },
  logBtn:         { paddingVertical: 15, alignItems: 'center', borderRadius: 12 },
  logBtnText:     { fontSize: 12, letterSpacing: 3 },
});

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
  eatClean:  { fontSize: 22, letterSpacing: 2, marginTop: 2 },
  topIcon: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  datesRow: { paddingHorizontal: 14, paddingBottom: 8 },
  scroll: { paddingBottom: 120 },
  tabToggle: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 4, padding: 4, borderRadius: 14, height: 46, position: 'relative' },
  tabPill: { position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: 10 },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  tabBtnText: { fontSize: 12, letterSpacing: 2 },
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
  submitBtn:      { marginHorizontal: 16, marginTop: 14, paddingVertical: 14, alignItems: 'center', borderRadius: 12 },
  submitBtnText:  { fontSize: 10, letterSpacing: 4 },
  logFuelBtn:     { marginHorizontal: 16, marginTop: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14 },
  logFuelBtnText: { fontSize: 12, letterSpacing: 3 },
  logFuelArrow:   { width: 22, height: 22, borderRadius: 11, backgroundColor: '#B8F23A', alignItems: 'center', justifyContent: 'center' },
  logCard:        { marginHorizontal: 16, borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  logAnotherBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed' },
  logAnotherText: { fontSize: 12, letterSpacing: 2.5 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 9, letterSpacing: 3 },
  // detailed form
  detailedWrap:       { paddingBottom: 8 },
  manualInputBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 14, paddingVertical: 15, borderRadius: 12, borderWidth: 1 },
  manualInputBtnText: { fontSize: 12, letterSpacing: 2 },
  snapRow:            { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, gap: 10 },
  snapBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 14, backgroundColor: 'transparent' },
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
  macroGroup:       { marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  macroHairline:    { height: 1 },
  macroRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  macroIcon:        { fontSize: 18 },
  macroLabel:       { flex: 1, fontSize: 14 },
  macroInputWrap:   { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  macroInput:       { fontSize: 20, minWidth: 60, textAlign: 'right' },
  macroUnit:        { fontSize: 11 },
});
