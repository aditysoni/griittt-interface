import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { useTheme, AppTheme } from '../../components/ThemeContext';
import { DarkBackground } from '../../components/DarkBackground';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';

type Field = 'name' | 'email' | 'password';

export default function SignupScreen() {
  const { theme } = useTheme();
  const s = React.useMemo(() => makeStyles(theme), [theme]);

  const { signup, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [focused, setFocused] = useState<Field | null>(null);

  // ── Animations — mirrors the login screen so the pair feels like one flow ──
  const steps = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.stagger(
      110,
      steps.map((v) =>
        Animated.timing(v, {
          toValue: 1,
          duration: 620,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    ).start();
  }, []);

  const enter = (i: number) => ({
    opacity: steps[i],
    transform: [
      { translateY: steps[i].interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
    ],
  });

  function pressIn() {
    Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  }
  function pressOut() {
    Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      // New Google users land on onboarding; returning ones go to the app —
      // the root layout decides based on `onboardingDone`.
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('Google sign-in error', err);
      Alert.alert('Google Sign-In', err?.message || 'Could not sign in with Google.');
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleSignup() {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await signup(name.trim(), email.trim().toLowerCase(), password);
      // Brand new account — kick into onboarding. Login does NOT route here.
      router.replace('/(auth)/onboarding' as any);
    } catch (err: any) {
      Alert.alert('Signup Failed', err.message || 'Could not create account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <DarkBackground>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          {/* ── Hero ── */}
          <Animated.View style={[s.hero, enter(0)]}>
            <Text style={s.logo}>
              GRITT<Text style={s.logoAccent}>T</Text>
            </Text>
            <Text style={s.kicker}>DISCIPLINE · IDENTITY · MOMENTUM</Text>
            <Text style={s.title}>Start your first streak</Text>
            <Text style={s.subtitle}>Day one is the hardest. Let's get it on the board.</Text>
          </Animated.View>

          {/* ── Credentials ── */}
          <Animated.View style={[s.form, enter(1)]}>
            <View style={s.inputGroup}>
              <Text style={s.label}>NAME</Text>
              <TextInput
                style={[s.input, focused === 'name' && s.inputFocused]}
                value={name}
                onChangeText={setName}
                onFocus={() => setFocused('name')}
                onBlur={() => setFocused(null)}
                placeholder="Your name"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="next"
              />
            </View>

            <View style={s.inputGroup}>
              <Text style={s.label}>EMAIL</Text>
              <TextInput
                style={[s.input, focused === 'email' && s.inputFocused]}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                placeholder="you@example.com"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
              />
            </View>

            <View style={s.inputGroup}>
              <Text style={s.label}>PASSWORD</Text>
              <TextInput
                style={[s.input, focused === 'password' && s.inputFocused]}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                placeholder="At least 8 characters"
                placeholderTextColor={theme.textTertiary}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleSignup}
              />
            </View>

            <Animated.View style={{ transform: [{ scale: btnScale }], marginTop: 4 }}>
              <Pressable
                onPress={handleSignup}
                onPressIn={pressIn}
                onPressOut={pressOut}
                disabled={loading}
                style={[s.btn, loading && s.btnDisabled]}
              >
                <Text style={s.btnText}>{loading ? 'Creating account…' : 'Create Account'}</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>

          {/* ── Alternatives ── */}
          <Animated.View style={[s.altGroup, enter(2)]}>
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>OR</Text>
              <View style={s.dividerLine} />
            </View>

            <GoogleSignInButton onPress={handleGoogle} loading={googleLoading} label="Sign up with Google" />

            <View style={s.footer}>
              <Text style={s.footerText}>Already have an account? </Text>
              <Link href="/(auth)/login" asChild>
                <Pressable hitSlop={8}>
                  <Text style={s.footerLink}>Sign in</Text>
                </Pressable>
              </Link>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </DarkBackground>
  );
}

function makeStyles(t: AppTheme) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 26,
      paddingTop: 72,
      paddingBottom: 40,
      gap: 26,
    },

    // Hero
    hero: { alignItems: 'center', marginBottom: 4 },
    logo: {
      fontFamily: 'BricolageGrotesque_800ExtraBold',
      fontSize: 44,
      color: t.text,
      letterSpacing: 1,
    },
    logoAccent: { color: t.accent },
    kicker: {
      fontFamily: 'SpaceGrotesk_600SemiBold',
      color: t.textTertiary,
      fontSize: 10.5,
      letterSpacing: 2.6,
      marginTop: 12,
    },
    title: {
      fontFamily: 'BricolageGrotesque_700Bold',
      fontSize: 29,
      color: t.text,
      letterSpacing: -0.4,
      marginTop: 26,
      textAlign: 'center',
    },
    subtitle: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14.5,
      color: t.textSecondary,
      marginTop: 6,
      textAlign: 'center',
    },

    // Form
    form: { gap: 16 },
    inputGroup: { gap: 8 },
    label: {
      fontFamily: 'Inter_700Bold',
      color: t.textTertiary,
      fontSize: 11,
      letterSpacing: 1.4,
    },
    input: {
      backgroundColor: t.surface,
      borderWidth: 1.5,
      borderColor: t.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 15,
      color: t.text,
      fontSize: 16,
      fontFamily: 'Inter_500Medium',
    },
    inputFocused: {
      borderColor: t.accent,
      backgroundColor: t.surfaceStrong,
    },
    btn: {
      backgroundColor: t.accent,
      borderRadius: 14,
      paddingVertical: 17,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: t.accent,
      shadowOpacity: t.isDark ? 0.45 : 0.35,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    btnDisabled: { opacity: 0.55 },
    btnText: {
      fontFamily: 'Inter_800ExtraBold',
      color: t.accentText,
      fontSize: 16,
      letterSpacing: 0.3,
    },

    // Alternatives
    altGroup: { gap: 18 },
    divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dividerLine: { flex: 1, height: 1, backgroundColor: t.border },
    dividerText: {
      fontFamily: 'Inter_700Bold',
      color: t.textTertiary,
      fontSize: 11,
      letterSpacing: 1.5,
    },
    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    footerText: { fontFamily: 'Inter_400Regular', color: t.textSecondary, fontSize: 14 },
    footerLink: { fontFamily: 'Inter_700Bold', color: t.text, fontSize: 14 },
  });
}
