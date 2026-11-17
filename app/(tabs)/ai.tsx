import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import { ai, habits } from '../../lib/api';
import { useTheme } from '../../components/ThemeContext';
import { useRouter } from 'expo-router';

type SnapResult = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingNote: string;
};

type DebriefResult = {
  summary: string;
  pattern: string;
  suggestion: string;
  identity: string;
};

export default function AIScreen() {
  const { token } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [debriefLoading, setDebriefLoading] = useState(false);
  const [debrief, setDebrief] = useState<DebriefResult | null>(null);

  const [patternsLoading, setPatternsLoading] = useState(false);
  const [patterns, setPatterns] = useState<Array<{ insight: string; actionable: string }>>([]);

  const [snapImage, setSnapImage] = useState<string | null>(null);
  const [snapLoading, setSnapLoading] = useState(false);
  const [snapResult, setSnapResult] = useState<SnapResult | null>(null);

  const [debriefModal, setDebriefModal] = useState(false);
  const [patternsModal, setPatternsModal] = useState(false);

  async function runWeeklyDebrief() {
    if (!token) return;
    setDebriefLoading(true);
    setDebriefModal(true);
    try {
      const result = await habits.weeklyDebrief(token);
      setDebrief(result);
    } catch (err: any) {
      Alert.alert('Error', err.message);
      setDebriefModal(false);
    } finally {
      setDebriefLoading(false);
    }
  }

  async function runPatterns() {
    if (!token) return;
    setPatternsLoading(true);
    setPatternsModal(true);
    try {
      const result = await habits.patterns(token);
      setPatterns(result.patterns);
    } catch (err: any) {
      Alert.alert('Error', err.message);
      setPatternsModal(false);
    } finally {
      setPatternsLoading(false);
    }
  }

  async function snapFromSource(useCamera: boolean) {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', `Allow ${useCamera ? 'camera' : 'photo library'} access in Settings.`);
      return;
    }

    let result: ImagePicker.ImagePickerResult;
    try {
      // Camera: no allowsEditing — base64+allowsEditing together cause iOS to fail
      // Gallery: allowsEditing is fine
      result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            base64: true,
            quality: 0.4,
            exif: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            base64: true,
            quality: 0.4,
            allowsEditing: true,
            aspect: [1, 1],
            exif: false,
          });
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Could not open camera.');
      return;
    }

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    setSnapImage(asset.uri);
    setSnapResult(null);
    setSnapLoading(true);

    try {
      // Prefer base64 from the picker; fall back to reading the file directly
      let b64 = asset.base64 ?? null;

      if (!b64) {
        try {
          const fileRef = new FileSystem.File(asset.uri);
          b64 = await fileRef.base64();
        } catch {
          // FileSystem fallback also failed
        }
      }

      if (!b64) {
        Alert.alert('Image Error', 'Could not read image data.\nTry the Gallery button instead.');
        setSnapImage(null);
        return;
      }

      const tracked = await ai.snapTrack(token!, `data:image/jpeg;base64,${b64}`);
      setSnapResult(tracked);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to analyse image');
      setSnapImage(null);
    } finally {
      setSnapLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[styles.backBtn, { borderColor: theme.border }]}
          activeOpacity={0.7}
          accessibilityRole="button" accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: theme.text }]} accessibilityRole="header">AI Coach</Text>
        <View style={[styles.coachBadge,{backgroundColor:theme.accent}]}><Ionicons name="sparkles" size={18} color={theme.accentText}/></View>
        </View>
        <View style={styles.intro}>
          <Text style={[styles.introTitle,{color:theme.text}]}>Small insights.
Better next steps.</Text>
          <Text style={[styles.screenSub, { color: theme.textSecondary }]}>Reflect on your habits, spot a pattern, or understand your plate.</Text>
        </View>
        <Text style={[styles.sectionLabel,{color:theme.textSecondary}]}>YOUR COACHING TOOLS</Text>

        <AICard icon="chatbubble-ellipses-outline" iconColor={theme.text} title="Talk to your coach" description="A conversation built around your habits and your plan." buttonLabel="Open coach" onPress={()=>router.push('/coach' as any)} loading={false} theme={theme}/>
        <AICard icon="trail-sign-outline" iconColor={theme.text} title="Your plans" description="Turn a goal into a small daily routine." buttonLabel="Open plans" onPress={()=>router.push('/plans' as any)} loading={false} theme={theme}/>
        {/* Weekly Debrief */}
        <AICard
          icon="calendar-outline"
          iconColor={theme.text}
          title="Your weekly reset"
          description="See what went well this week and choose your next small step."
          buttonLabel="Review my week"
          onPress={runWeeklyDebrief}
          loading={debriefLoading}
          theme={theme}
        />

        {/* Pattern Analysis */}
        <AICard
          icon="analytics-outline"
          iconColor={theme.text}
          title="Find your patterns"
          description="Connect the dots across your last 30 days of habits."
          buttonLabel="Explore patterns"
          onPress={runPatterns}
          loading={patternsLoading}
          theme={theme}
        />

        {/* Snap Track */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBadge, { backgroundColor: theme.surface }]}>
              <Ionicons name="camera-outline" size={22} color={theme.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Snap Track</Text>
              <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>Understand your meal with a photo. Nutrition values are estimates.</Text>
            </View>
          </View>

          {snapImage && (
            <Image source={{ uri: snapImage }} style={styles.snapImage} resizeMode="cover" />
          )}

          {snapLoading && (
            <View style={styles.snapLoading}>
              <ActivityIndicator color={theme.text} />
              <Text style={[styles.snapLoadingText, { color: theme.textSecondary }]}>Analyzing food...</Text>
            </View>
          )}

          {snapResult && (
            <View style={styles.snapResult}>
              <Text style={[styles.snapFoodName, { color: theme.text }]}>{snapResult.name}</Text>
              <Text style={[styles.snapServing, { color: theme.textSecondary }]}>{snapResult.servingNote}</Text>
              <View style={styles.macroRow}>
                <Macro label="Calories" value={snapResult.calories} unit="kcal" color={theme.text} theme={theme} />
                <Macro label="Protein" value={snapResult.protein} unit="g" color={theme.text} theme={theme} />
                <Macro label="Carbs" value={snapResult.carbs} unit="g" color={theme.text} theme={theme} />
                <Macro label="Fats" value={snapResult.fats} unit="g" color={theme.text} theme={theme} />
              </View>
            </View>
          )}

          <Text style={[styles.snapHint, { color: theme.textSecondary }]}>Choose a clear photo of your meal.</Text>
          <TouchableOpacity style={[styles.snapPickBtn,{backgroundColor:theme.accent,borderColor:theme.accent},snapLoading&&styles.cardBtnDisabled]} disabled={snapLoading} accessibilityRole="button" accessibilityLabel="Choose food photo" onPress={() => snapFromSource(false)}>
            <Ionicons name="images" size={20} color={theme.text} />
            <Text style={[styles.snapPickBtnText,{color:theme.accentText}]}>Choose food photo</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Weekly Debrief Modal */}
      <Modal visible={debriefModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: theme.bg }]}>
          <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Weekly Debrief</Text>
            <TouchableOpacity onPress={() => { setDebriefModal(false); setDebrief(null); }}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            {debriefLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={theme.text} />
                <Text style={[styles.modalLoadingText, { color: theme.textSecondary }]}>Generating your debrief...</Text>
              </View>
            ) : debrief ? (
              <View style={{ gap: 20 }}>
                <DebriefSection icon="📊" title="Summary" body={debrief.summary} theme={theme} />
                <DebriefSection icon="🔍" title="Pattern" body={debrief.pattern} theme={theme} />
                <DebriefSection icon="💡" title="Suggestion" body={debrief.suggestion} theme={theme} />
                <DebriefSection icon="🧬" title="Identity" body={debrief.identity} theme={theme} />
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      {/* Patterns Modal */}
      <Modal visible={patternsModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: theme.bg }]}>
          <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Pattern Analysis</Text>
            <TouchableOpacity onPress={() => { setPatternsModal(false); setPatterns([]); }}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            {patternsLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={theme.text} />
                <Text style={[styles.modalLoadingText, { color: theme.textSecondary }]}>Analyzing 30 days of data...</Text>
              </View>
            ) : patterns.length > 0 ? (
              <View style={{ gap: 16 }}>
                {patterns.map((p, i) => (
                  <View key={i} style={[styles.patternCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.patternInsight, { color: theme.text }]}>💡 {p.insight}</Text>
                    <Text style={[styles.patternActionable, { color: theme.text }]}>→ {p.actionable}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function AICard({ icon, iconColor, title, description, buttonLabel, onPress, loading, theme }: {
  icon: any; iconColor: string; title: string; description: string;
  buttonLabel: string; onPress: () => void; loading: boolean; theme: any;
}) {
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBadge, { backgroundColor: theme.surface }]}>
          <Ionicons name={icon} size={22} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>{description}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.cardBtn, { borderColor: theme.borderStrong, backgroundColor:theme.surface }, loading && styles.cardBtnDisabled]}
        onPress={onPress}
        disabled={loading}
        accessibilityRole="button" accessibilityLabel={buttonLabel} accessibilityState={{busy:loading,disabled:loading}}
      >
        {loading ? <ActivityIndicator size="small" color={iconColor} /> : (
          <><Text style={[styles.cardBtnText, { color: theme.text }]}>{buttonLabel}</Text><Ionicons name="arrow-forward" size={16} color={theme.text}/></>
        )}
      </TouchableOpacity>
    </View>
  );
}

function Macro({ label, value, unit, color, theme }: { label: string; value: number; unit: string; color: string; theme: any }) {
  return (
    <View style={[styles.macro,{backgroundColor:theme.surface,borderColor:theme.border}]}>
      <Text style={[styles.macroValue, { color }]}>{value}</Text>
      <Text style={[styles.macroUnit, { color: theme.textSecondary }]}>{unit}</Text>
      <Text style={[styles.macroLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

function DebriefSection({ icon, title, body, theme }: { icon: string; title: string; body: string; theme: any }) {
  return (
    <View style={[styles.debriefSection,{backgroundColor:theme.card,borderColor:theme.border}]}>
      <Text style={[styles.debriefTitle, { color: theme.text }]}>{icon} {title}</Text>
      <Text style={[styles.debriefBody, { color: theme.textSecondary }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 14 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  topBar: {flexDirection:'row',alignItems:'center',gap:12,marginBottom:8},
  coachBadge: {width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center'},
  screenTitle: { flex:1,fontSize:24,fontFamily:'Inter_800ExtraBold' },
  intro: {gap:10,paddingTop:8,paddingBottom:16},
  introTitle: {fontSize:30,lineHeight:37,fontFamily:'Inter_800ExtraBold',letterSpacing:-0.8},
  screenSub: { fontSize:14,lineHeight:21,maxWidth:310 },
  sectionLabel: {fontSize:10,letterSpacing:1.5,fontFamily:'Inter_700Bold',marginBottom:2},
  card: {
    borderRadius: 22, padding: 18,
    borderWidth: 1, gap: 14,
  },
  cardHeader: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  iconBadge: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 18, fontFamily:'Inter_700Bold', marginBottom: 6 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  cardBtn: {
    flexDirection: 'row', gap:10, borderWidth: 1, borderRadius: 24, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center', minHeight: 44,
  },
  cardBtnDisabled: { opacity: 0.5 },
  cardBtnText: { fontSize: 14, fontWeight: '600' },
  snapImage: { width: '100%', height: 200, borderRadius: 12 },
  snapLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  snapLoadingText: { fontSize: 14 },
  snapResult: { gap: 8 },
  snapFoodName: { fontSize: 18, fontWeight: '700' },
  snapServing: { fontSize: 12 },
  macroRow: { flexDirection: 'row', gap: 6 },
  macro: { flex: 1, alignItems: 'center', gap: 4,paddingVertical:12,borderRadius:12,borderWidth:1 },
  macroValue: { fontSize: 20, fontWeight: '800' },
  macroUnit: { fontSize: 10 },
  macroLabel: { fontSize: 10 },
  snapHint: { fontSize: 12, textAlign: 'center' },
  snapPickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 14, borderRadius: 12, borderWidth: 1,
    borderColor: '#10B981', backgroundColor: '#10B981' + '15',
  },
  snapPickBtnText: { fontSize: 15, fontWeight: '700', color: '#10B981' },
  modal: { flex: 1, paddingTop: 8 },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalBody: { padding: 20, paddingBottom: 40 },
  modalLoading: { alignItems: 'center', gap: 16, paddingTop: 60 },
  modalLoadingText: { fontSize: 15 },
  debriefSection: { gap: 8,padding:18,borderWidth:1,borderRadius:18 },
  debriefTitle: { fontSize: 16, fontWeight: '700' },
  debriefBody: { fontSize: 14, lineHeight: 22 },
  patternCard: {
    borderRadius: 12, padding: 16, gap: 8,
    borderWidth: 1,
  },
  patternInsight: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  patternActionable: { fontSize: 13, lineHeight: 18 },
});
