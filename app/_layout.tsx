import { useEffect } from 'react';
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
  const { user, isLoading, onboardingDone } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    const onOnboarding = segments[1] === 'onboarding';

    if (!user) {
      if (!inAuth) router.replace('/(auth)/login');
      return;
    }
    // user is logged in
    if (!onboardingDone) {
      if (!onOnboarding) router.replace('/(auth)/onboarding');
      return;
    }
    // user + onboarding done
    if (inAuth) router.replace('/(tabs)');
  }, [user, isLoading, onboardingDone, segments]);

  if (isLoading) return <LoadingScreen />;
  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Slot />
    </>
  );
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
