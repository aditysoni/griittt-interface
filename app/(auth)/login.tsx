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
import { Link } from 'expo-router';
import Svg, { Rect } from 'react-native-svg';
import { useAuth } from '../../lib/auth';
import { useTheme, AppTheme } from '../../components/ThemeContext';
import { DarkBackground } from '../../components/DarkBackground';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';

/** Brand mark — three ascending bars (momentum / streak) in a rounded tile. */
function Logomark({ accent, tile, ring }: { accent: string; tile: string; ring: string }) {
  return (
    <Svg width={78} height={78} viewBox="0 0 78 78">
      <Rect x={1.5} y={1.5} width={75} height={75} rx={22} fill={tile} stroke={ring} strokeWidth={1.5} />
      <Rect x={19} y={44} width={10} height={16} rx={5} fill={accent} opacity={0.5} />
      <Rect x={34} y={33} width={10} height={27} rx={5} fill={accent} opacity={0.78} />
      <Rect x={49} y={20} width={10} height={40} rx={5} fill={accent} />
    </Svg>
  );
}

export default function LoginScreen() {
  const { theme } = useTheme();
  const s = React.useMemo(() => makeStyles(theme), [theme]);

  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);

  // ── Animations (built-in Animated — native-driven, no extra native deps) ──
  const steps = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  const glow = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Staggered fade + rise for each section.
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

    // Slow "breathing" lime glow behind the wordmark.
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
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
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('Google sign-in error', err);
      Alert.alert('Google Sign-In', err?.message || 'Could not sign in with Google.');
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('Login error', err);
      Alert.alert('Login Failed', err.message || 'Invalid credentials');
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
            <View style={s.markWrap}>
              <Animated.View
                pointerEvents="none"
                style={[
                  s.glow,
                  {
                    opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.32] }),
                    transform: [
                      { scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.2] }) },
                    ],
                  },
                ]}
              />
              <Animated.View
                style={{
                  transform: [
                    { translateY: glow.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) },
                  ],
                }}
              >
                <Logomark
                  accent={theme.accent}
                  tile={theme.isDark ? '#0D0D0D' : '#FFFFFF'}
                  ring={theme.isDark ? 'rgba(184,242,58,0.28)' : theme.borderStrong}
                />
              </Animated.View>
            </View>

            <Text style={s.logo}>
              GRITT<Text style={s.logoAccent}>T</Text>
            </Text>
            <Text style={s.kicker}>DISCIPLINE · IDENTITY · MOMENTUM</Text>
            <Text style={s.tagline}>Build habits. Build identity.</Text>
          </Animated.View>

          {/* ── Title ── */}
          <Animated.View style={enter(1)}>
            <Text style={s.title}>Welcome back</Text>
            <Text style={s.subtitle}>Pick up where your streak left off.</Text>
          </Animated.View>

          {/* ── Credentials ── */}
          <Animated.View style={[s.form, enter(2)]}>
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
                placeholder="••••••••"
                placeholderTextColor={theme.textTertiary}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            <Animated.View style={{ transform: [{ scale: btnScale }], marginTop: 4 }}>
              <Pressable
                onPress={handleLogin}
                onPressIn={pressIn}
                onPressOut={pressOut}
                disabled={loading}
                style={[s.btn, loading && s.btnDisabled]}
              >
                <Text style={s.btnText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>

          {/* ── Alternatives ── */}
          <Animated.View style={[s.altGroup, enter(3)]}>
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>OR</Text>
              <View style={s.dividerLine} />
            </View>

            <GoogleSignInButton onPress={handleGoogle} loading={googleLoading} label="Sign in with Google" />

            <View style={s.footer}>
              <Text style={s.footerText}>Don't have an account? </Text>
              <Link href="/(auth)/signup" asChild>
                <Pressable hitSlop={8}>
                  <Text style={s.footerLink}>Sign up</Text>
                </Pressable>
              </Link>
            </View>

            <Link href={'/(auth)/onboarding' as any} asChild>
              <Pressable style={s.getStartedBtn}>
                <Text style={s.getStartedText}>New to Grittt? Get started →</Text>
              </Pressable>
            </Link>
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
    hero: { alignItems: 'center', marginBottom: 8 },
    markWrap: { alignItems: 'center', justifyContent: 'center', height: 92, marginBottom: 18 },
    glow: {
      position: 'absolute',
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: t.accent,
    },
    logo: {
      fontFamily: 'BricolageGrotesque_800ExtraBold',
      fontSize: 56,
      color: t.text,
      letterSpacing: 1,
    },
    logoAccent: { color: t.accent },
    kicker: {
      fontFamily: 'SpaceGrotesk_600SemiBold',
      color: t.textTertiary,
      fontSize: 10.5,
      letterSpacing: 2.6,
      marginTop: 14,
    },
    tagline: {
      fontFamily: 'Inter_500Medium',
      color: t.textSecondary,
      fontSize: 14.5,
      marginTop: 10,
      letterSpacing: 0.3,
    },

    // Title
    title: {
      fontFamily: 'BricolageGrotesque_700Bold',
      fontSize: 31,
      color: t.text,
      letterSpacing: -0.4,
    },
    subtitle: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14.5,
      color: t.textSecondary,
      marginTop: 6,
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
    getStartedBtn: {
      alignItems: 'center',
      paddingVertical: 15,
      borderWidth: 1.5,
      borderColor: t.borderStrong,
      borderRadius: 14,
    },
    getStartedText: {
      fontFamily: 'Inter_700Bold',
      color: t.text,
      fontSize: 14,
      letterSpacing: 0.2,
    },
  });
}
