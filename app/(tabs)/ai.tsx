import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
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
import { ai, habits, tasks, today } from '../../lib/api';
import { COLORS } from '../../components/theme';
import { useTheme } from '../../components/ThemeContext';

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
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.screenTitle, { color: theme.text }]}>AI Coach</Text>
        <Text style={[styles.screenSub, { color: theme.textSecondary }]}>Your personal AI-powered habit & health coach</Text>

        {/* Weekly Debrief */}
        <AICard
          icon="calendar-outline"
          iconColor="#8B5CF6"
          title="Weekly Debrief"
          description="Get a personalized summary of your week's habit performance, patterns, and suggestions."
          buttonLabel="Generate Debrief"
          onPress={runWeeklyDebrief}
          loading={debriefLoading}
          theme={theme}
        />

        {/* Pattern Analysis */}
        <AICard
          icon="analytics-outline"
          iconColor="#06B6D4"
          title="Pattern Analysis"
          description="Analyze your last 30 days to surface hidden patterns and actionable insights."
          buttonLabel="Analyze Patterns"
          onPress={runPatterns}
          loading={patternsLoading}
          theme={theme}
        />

        {/* Snap Track */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBadge, { backgroundColor: '#10B981' + '20' }]}>
              <Ionicons name="camera-outline" size={22} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Snap Track</Text>
              <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>Take a photo of your food and get instant nutrition estimates powered by AI.</Text>
            </View>
          </View>

          {snapImage && (
            <Image source={{ uri: snapImage }} style={styles.snapImage} resizeMode="cover" />
          )}

          {snapLoading && (
            <View style={styles.snapLoading}>
              <ActivityIndicator color="#10B981" />
              <Text style={[styles.snapLoadingText, { color: theme.textSecondary }]}>Analyzing food...</Text>
            </View>
          )}

          {snapResult && (
            <View style={styles.snapResult}>
              <Text style={[styles.snapFoodName, { color: theme.text }]}>{snapResult.name}</Text>
              <Text style={[styles.snapServing, { color: theme.textSecondary }]}>{snapResult.servingNote}</Text>
              <View style={styles.macroRow}>
                <Macro label="Calories" value={snapResult.calories} unit="kcal" color={COLORS.warning} theme={theme} />
                <Macro label="Protein" value={snapResult.protein} unit="g" color="#10B981" theme={theme} />
                <Macro label="Carbs" value={snapResult.carbs} unit="g" color={COLORS.primary} theme={theme} />
                <Macro label="Fats" value={snapResult.fats} unit="g" color={COLORS.error} theme={theme} />
              </View>
            </View>
          )}

          <Text style={[styles.snapHint, { color: theme.textSecondary }]}>📸 Take a photo with your Camera app first, then pick it here</Text>
          <TouchableOpacity style={styles.snapPickBtn} onPress={() => snapFromSource(false)}>
            <Ionicons name="images" size={20} color="#10B981" />
            <Text style={styles.snapPickBtnText}>Pick Photo from Gallery</Text>
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
                <ActivityIndicator size="large" color={COLORS.primary} />
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
                <ActivityIndicator size="large" color={COLORS.secondary} />
                <Text style={[styles.modalLoadingText, { color: theme.textSecondary }]}>Analyzing 30 days of data...</Text>
              </View>
            ) : patterns.length > 0 ? (
              <View style={{ gap: 16 }}>
                {patterns.map((p, i) => (
                  <View key={i} style={[styles.patternCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.patternInsight, { color: theme.text }]}>💡 {p.insight}</Text>
                    <Text style={[styles.patternActionable, { color: COLORS.secondary }]}>→ {p.actionable}</Text>
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
        <View style={[styles.iconBadge, { backgroundColor: iconColor + '20' }]}>
          <Ionicons name={icon} size={22} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>{description}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.cardBtn, { borderColor: iconColor }, loading && styles.cardBtnDisabled]}
        onPress={onPress}
        disabled={loading}
      >
        {loading ? <ActivityIndicator size="small" color={iconColor} /> : (
          <Text style={[styles.cardBtnText, { color: iconColor }]}>{buttonLabel}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function Macro({ label, value, unit, color, theme }: { label: string; value: number; unit: string; color: string; theme: any }) {
  return (
    <View style={styles.macro}>
      <Text style={[styles.macroValue, { color }]}>{value}</Text>
      <Text style={[styles.macroUnit, { color: theme.textSecondary }]}>{unit}</Text>
      <Text style={[styles.macroLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

function DebriefSection({ icon, title, body, theme }: { icon: string; title: string; body: string; theme: any }) {
  return (
    <View style={styles.debriefSection}>
      <Text style={[styles.debriefTitle, { color: theme.text }]}>{icon} {title}</Text>
      <Text style={[styles.debriefBody, { color: theme.textSecondary }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 16 },
  screenTitle: { fontSize: 28, fontWeight: '800' },
  screenSub: { fontSize: 13, marginTop: -8 },
  card: {
    borderRadius: 16, padding: 20,
    borderWidth: 1, gap: 14,
  },
  cardHeader: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  iconBadge: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  cardBtn: {
    borderWidth: 1, borderRadius: 10, paddingVertical: 12,
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
  macroRow: { flexDirection: 'row', gap: 12 },
  macro: { flex: 1, alignItems: 'center', gap: 2 },
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
  debriefSection: { gap: 8 },
  debriefTitle: { fontSize: 16, fontWeight: '700' },
  debriefBody: { fontSize: 14, lineHeight: 22 },
  patternCard: {
    borderRadius: 12, padding: 16, gap: 8,
    borderWidth: 1,
  },
  patternInsight: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  patternActionable: { fontSize: 13, lineHeight: 18 },
});
