import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
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
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { AuthProvider, useAuth } from '../lib/auth';
import { ThemeProvider, useTheme } from '../components/ThemeContext';
import { LoadingScreen } from '../components/LoadingScreen';

function InitialLayout() {
  const { user, isLoading } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    const onOnboarding = segments[1] === 'onboarding';

    if (!user) {
      // Not logged in — land on the LOGIN screen. Returning users (the common
      // case after logout) see sign-in first; new users reach the guided
      // onboarding via the "New to Grittt? Get started" CTA on that screen.
      // Allow them to stay on any auth screen they navigated to manually.
      if (!inAuth) router.replace('/(auth)/login' as any);
      return;
    }

    // Logged in but onboarding not finished → force them through it.
    if (!user.onboardingDone) {
      if (!onOnboarding) router.replace('/(auth)/onboarding' as any);
      return;
    }

    // Logged in and onboarded → bounce out of any auth screen into the app.
    if (inAuth) router.replace('/(tabs)');
  }, [user, isLoading, segments]);

  if (isLoading) return <LoadingScreen />;
  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Slot />
    </>
  );
}

function CountdownSplash({ daysLeft, onDone }: { daysLeft: number; onDone: () => void }) {
  const scale   = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 140 }),
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.delay(1300),
        Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
    ]).start(() => onDone());
  }, []);

  return (
    <View style={sp.root}>
      <Animated.View style={[sp.content, { opacity, transform: [{ scale }] }]}>
        <Text style={sp.number}>{daysLeft}</Text>
        <Text style={sp.label}>DAYS LEFT</Text>
      </Animated.View>
    </View>
  );
}

const sp = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', gap: 14 },
  number:  { fontSize: 110, color: '#FFFFFF', fontFamily: 'Inter_900Black', letterSpacing: -6, lineHeight: 110 },
  label:   { fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: 5, fontFamily: 'Inter_700Bold' },
});

// Check for OTA update on every launch and reload immediately if one is available.
// This prevents users from seeing stale UI after an eas update is pushed.
async function checkForUpdate() {
  if (__DEV__) return; // skip in local dev
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync(); // instant reload before user sees anything
    }
  } catch {
    // network offline or check failed — silently ignore
  }
}

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
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });

  // ready = fonts loaded + AsyncStorage checked
  const [ready, setReady]       = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => { checkForUpdate(); }, []);

  useEffect(() => {
    if (!fontsLoaded) return;
    AsyncStorage.getItem('grittt_hawkeye_countdown')
      .then(raw => {
        if (raw) {
          try {
            const { end } = JSON.parse(raw) as { start: string; end: string };
            const endDate = new Date(end + 'T00:00:00');
            const now = new Date(); now.setHours(0, 0, 0, 0);
            const left = Math.round((endDate.getTime() - now.getTime()) / 86400000) + 1;
            if (left >= 1) setDaysLeft(left);
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [fontsLoaded]);

  // Show nothing until both fonts and storage check are done
  if (!fontsLoaded || !ready) return null;

  // Countdown found — show splash, dismiss into app when done
  if (daysLeft !== null) {
    return <CountdownSplash daysLeft={daysLeft} onDone={() => setDaysLeft(null)} />;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <InitialLayout />
      </AuthProvider>
    </ThemeProvider>
  );
}
