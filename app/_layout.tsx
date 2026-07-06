import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { AuthProvider, useAuth } from '../lib/auth';
import { ThemeProvider, useTheme } from '../components/ThemeContext';
import { LoadingScreen } from '../components/LoadingScreen';

function InitialLayout() {
  const { user, isLoading } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  // Countdown — only checked once user is confirmed logged-in + onboarded
  const [countdown, setCountdown] = useState<{
    daysLeft: number; total: number; endDateStr: string;
  } | null>(null);
  const countdownChecked = useRef(false);

  useEffect(() => {
    if (!user?.onboardingDone || countdownChecked.current) return;
    countdownChecked.current = true;
    AsyncStorage.getItem('grittt_hawkeye_countdown')
      .then(raw => {
        if (!raw) return;
        const { start, end } = JSON.parse(raw) as { start: string; end: string };
        const startDate = new Date(start + 'T00:00:00');
        const endDate   = new Date(end   + 'T00:00:00');
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const left  = Math.round((endDate.getTime() - now.getTime()) / 86400000) + 1;
        const total = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
        if (left >= 1) {
          const endDateStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
          setCountdown({ daysLeft: left, total, endDateStr });
        }
      })
      .catch(() => {});
  }, [user?.onboardingDone]);

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    const onOnboarding = segments[1] === 'onboarding';

    if (!user) {
      if (!inAuth) router.replace('/(auth)/onboarding' as any);
      return;
    }
    if (!user.onboardingDone) {
      if (!onOnboarding) router.replace('/(auth)/onboarding' as any);
      return;
    }
    if (inAuth) router.replace('/(tabs)');
  }, [user, isLoading, segments]);

  if (isLoading) return <LoadingScreen />;

  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Slot />
      {/* Countdown overlay — only for logged-in users with an active countdown */}
      {countdown && (
        <View style={StyleSheet.absoluteFillObject}>
          <CountdownSplash
            daysLeft={countdown.daysLeft}
            total={countdown.total}
            endDateStr={countdown.endDateStr}
            onDone={() => setCountdown(null)}
          />
        </View>
      )}
    </>
  );
}

const SW = Dimensions.get('window').width;
const RING_SIZE = Math.min(SW - 64, 280);
const RING_R    = (RING_SIZE / 2) - 18;
const RING_C    = 2 * Math.PI * RING_R;

function CountdownSplash({ daysLeft, total, endDateStr, onDone }: {
  daysLeft: number; total: number; endDateStr: string; onDone: () => void;
}) {
  const fadeIn  = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;
  const scale   = useRef(new Animated.Value(0.88)).current;

  const done = Math.max(0, total - daysLeft);
  const pct  = total > 0 ? done / total : 0;
  const cx   = RING_SIZE / 2;
  const cy   = RING_SIZE / 2;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeIn, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.spring(scale,  { toValue: 1, damping: 14, stiffness: 160, useNativeDriver: true }),
      ]),
      Animated.delay(1800),
      Animated.timing(fadeOut, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.View style={[sp.root, { opacity: fadeOut }]}>
      {/* Wordmark */}
      <Animated.View style={[sp.topRow, { opacity: fadeIn }]}>
        <View style={sp.wordmarkRow}>
          <Text style={sp.wordmark}>grittt</Text>
          <View style={sp.wordDot} />
        </View>
      </Animated.View>

      {/* Timer card */}
      <Animated.View style={[sp.card, { opacity: fadeIn, transform: [{ scale }] }]}>
        <Text style={sp.cardEyebrow}>COUNTING DOWN TO</Text>
        <Text style={sp.cardGoal}>YOUR GOAL</Text>

        {/* Ring + number */}
        <View style={[sp.ringWrap, { width: RING_SIZE, height: RING_SIZE }]}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            {/* Track ring */}
            <Circle cx={cx} cy={cy} r={RING_R} fill="none" stroke="#E4DECF" strokeWidth={3}
              transform={`rotate(-90 ${cx} ${cy})`} />
            {/* Progress arc */}
            {pct > 0 && (
              <Circle cx={cx} cy={cy} r={RING_R} fill="none" stroke="#14110D" strokeWidth={3}
                strokeLinecap="round" strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - pct)}
                transform={`rotate(-90 ${cx} ${cy})`} />
            )}
            {/* Tick marks */}
            {Array.from({ length: Math.min(total, 60) }).map((_, i) => {
              const angle = (i / Math.min(total, 60)) * 2 * Math.PI - Math.PI / 2;
              const r1 = RING_R - 10, r2 = RING_R - 4;
              const x1 = cx + r1 * Math.cos(angle), y1 = cy + r1 * Math.sin(angle);
              const x2 = cx + r2 * Math.cos(angle), y2 = cy + r2 * Math.sin(angle);
              const isPast = i < done;
              return (
                <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={isPast ? '#E4DECF' : '#14110D'} strokeWidth={1.5} strokeLinecap="round" />
              );
            })}
          </Svg>
          {/* Center number */}
          <View style={sp.ringCenter}>
            <Text style={sp.ringNum}>{daysLeft}</Text>
            <Text style={sp.ringLabel}>DAYS LEFT</Text>
          </View>
        </View>

        {/* Footer meta */}
        <View style={sp.cardFooter}>
          <View style={{ flex: 1 }}>
            <Text style={sp.metaLabel}>DONE</Text>
            <Text style={sp.metaVal}>{done} / {total}</Text>
          </View>
          <View style={[sp.metaSep, { flex: 1, alignItems: 'center' }]}>
            <Text style={sp.metaLabel}>ENDS</Text>
            <Text style={sp.metaVal}>{endDateStr}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={sp.metaLabel}>PROGRESS</Text>
            <Text style={sp.metaVal}>{Math.round(pct * 100)}%</Text>
          </View>
        </View>
      </Animated.View>

      {/* Motivating line */}
      <Animated.Text style={[sp.motive, { opacity: fadeIn }]}>
        Every day counts now.
      </Animated.Text>
    </Animated.View>
  );
}

const sp = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#FBFAF7', alignItems: 'center', paddingHorizontal: 22 },
  topRow:      { marginTop: 64, alignSelf: 'center' },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordmark:    { fontSize: 22, color: '#14110D', fontFamily: 'Inter_900Black', letterSpacing: -0.5 },
  wordDot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: '#C8F14A' },
  card:        { width: '100%', marginTop: 24, backgroundColor: '#FFFFFF', borderRadius: 28, borderWidth: 1, borderColor: '#E8E2D5', padding: 22, alignItems: 'center', shadowColor: '#14110D', shadowOpacity: 0.07, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  cardEyebrow: { fontSize: 10, letterSpacing: 3.5, color: '#AAA295', fontFamily: 'Inter_700Bold', marginBottom: 6 },
  cardGoal:    { fontSize: 20, letterSpacing: 0.5, color: '#14110D', fontFamily: 'Inter_900Black', marginBottom: 16 },
  ringWrap:    { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  ringCenter:  { position: 'absolute', alignItems: 'center' },
  ringNum:     { fontSize: 88, letterSpacing: -5, lineHeight: 88, color: '#14110D', fontFamily: 'Inter_900Black' },
  ringLabel:   { fontSize: 11, letterSpacing: 4, color: '#6A6258', fontFamily: 'Inter_700Bold', marginTop: 6 },
  cardFooter:  { flexDirection: 'row', width: '100%', paddingTop: 16, marginTop: 16, borderTopWidth: 1, borderTopColor: '#E8E2D5' },
  metaLabel:   { fontSize: 9, letterSpacing: 2.5, color: '#AAA295', fontFamily: 'Inter_700Bold', marginBottom: 4 },
  metaVal:     { fontSize: 16, letterSpacing: -0.3, color: '#14110D', fontFamily: 'Inter_900Black' },
  metaSep:     {},
  motive:      { marginTop: 22, fontSize: 17, letterSpacing: -0.3, color: '#14110D', fontFamily: 'Inter_900Black', textAlign: 'center' },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <AuthProvider>
        <InitialLayout />
      </AuthProvider>
    </ThemeProvider>
  );
}
