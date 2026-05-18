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
  const { user, isLoading } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    const onOnboarding = segments[1] === 'onboarding';

    if (!user) {
      // Not logged in — start them in onboarding (which has a "Sign in" link
      // for returning users). Allow them to be on login/signup if they
      // navigated there manually.
      if (!inAuth) router.replace('/(auth)/onboarding' as any);
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
