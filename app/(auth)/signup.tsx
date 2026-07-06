import React, { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';

export default function SignupScreen() {
  const { signup } = useAuth();
  const router = useRouter();
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);

  async function handleSignup() {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Missing fields', 'All fields are required.'); return;
    }
    if (password.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.'); return;
    }
    setLoading(true);
    try {
      await signup(name.trim(), email.trim().toLowerCase(), password);
      router.replace('/(auth)/onboarding' as any);
    } catch (err: any) {
      Alert.alert('Signup failed', err.message || 'Could not create account');
    } finally { setLoading(false); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F0EDE6' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={s.inner}>

              {/* Header */}
              <View style={s.topRow}>
                <View style={s.wordmarkRow}>
                  <Text style={[s.wordmark, { fontFamily: 'Inter_900Black' }]}>grittt</Text>
                  <View style={s.wordDot} />
                </View>
                <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
                  <Ionicons name="chevron-back" size={17} color="#6A6258" />
                </TouchableOpacity>
              </View>

              {/* Title */}
              <View style={{ marginTop: 30 }}>
                <Text style={[s.title, { fontFamily: 'Inter_900Black' }]}>Create{'\n'}your account</Text>
                <Text style={[s.subtitle, { fontFamily: 'Inter_400Regular' }]}>
                  Set up grittt and lock in your first countdown.
                </Text>
              </View>

              {/* Toggle */}
              <View style={s.toggle}>
                <TouchableOpacity style={s.toggleBtn} onPress={() => router.replace('/(auth)/login' as any)} activeOpacity={0.7}>
                  <Text style={[s.toggleInactive, { fontFamily: 'Inter_700Bold' }]}>SIGN IN</Text>
                </TouchableOpacity>
                <View style={[s.togglePill, { backgroundColor: '#FFFFFF' }]}>
                  <Text style={[s.toggleActive, { fontFamily: 'Inter_900Black' }]}>SIGN UP</Text>
                </View>
              </View>

              {/* Form */}
              <View style={s.form}>
                <View>
                  <Text style={[s.label, { fontFamily: 'Inter_700Bold' }]}>NAME</Text>
                  <View style={s.field}>
                    <TextInput
                      style={[s.fieldInput, { fontFamily: 'Inter_500Medium' }]}
                      value={name} onChangeText={setName}
                      placeholder="Your name"
                      placeholderTextColor="#AAA295"
                      autoCapitalize="words"
                    />
                  </View>
                </View>
                <View>
                  <Text style={[s.label, { fontFamily: 'Inter_700Bold' }]}>EMAIL</Text>
                  <View style={s.field}>
                    <TextInput
                      style={[s.fieldInput, { fontFamily: 'Inter_500Medium' }]}
                      value={email} onChangeText={setEmail}
                      placeholder="you@grittt.app"
                      placeholderTextColor="#AAA295"
                      autoCapitalize="none" keyboardType="email-address"
                    />
                  </View>
                </View>
                <View>
                  <Text style={[s.label, { fontFamily: 'Inter_700Bold' }]}>PASSWORD</Text>
                  <View style={s.field}>
                    <TextInput
                      style={[s.fieldInput, { fontFamily: 'Inter_500Medium', flex: 1 }]}
                      value={password} onChangeText={setPassword}
                      placeholder="Min 8 characters"
                      placeholderTextColor="#AAA295"
                      secureTextEntry={!showPass}
                      returnKeyType="done" onSubmitEditing={handleSignup}
                    />
                    <TouchableOpacity onPress={() => setShowPass(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={17} color="#AAA295" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={{ flex: 1, minHeight: 24 }} />

              {/* OR divider */}
              <View style={s.orRow}>
                <View style={s.orLine} />
                <Text style={[s.orText, { fontFamily: 'Inter_700Bold' }]}>OR</Text>
                <View style={s.orLine} />
              </View>

              {/* Social */}
              <View style={s.socialRow}>
                <TouchableOpacity style={s.socialBtn} activeOpacity={0.8}>
                  <Text style={s.socialIcon}>🍎</Text>
                  <Text style={[s.socialLabel, { fontFamily: 'Inter_700Bold' }]}>Apple</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.socialBtn} activeOpacity={0.8}>
                  <Text style={s.socialIcon}>🔍</Text>
                  <Text style={[s.socialLabel, { fontFamily: 'Inter_700Bold' }]}>Google</Text>
                </TouchableOpacity>
              </View>

              {/* CTA */}
              <TouchableOpacity
                style={[s.cta, { opacity: loading ? 0.5 : 1 }]}
                onPress={handleSignup} disabled={loading} activeOpacity={0.85}
              >
                <Text style={[s.ctaText, { fontFamily: 'Inter_900Black' }]}>
                  {loading ? 'CREATING...' : 'CREATE ACCOUNT'}
                </Text>
                {!loading && (
                  <View style={s.ctaArrow}>
                    <Ionicons name="arrow-forward" size={13} color="#14110D" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Switch */}
              <TouchableOpacity
                style={s.switchRow}
                onPress={() => router.replace('/(auth)/login' as any)}
                activeOpacity={0.7}
              >
                <Text style={[s.switchText, { fontFamily: 'Inter_400Regular' }]}>Already have an account? </Text>
                <Text style={[s.switchLink, { fontFamily: 'Inter_700Bold' }]}>Sign in</Text>
              </TouchableOpacity>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  inner:         { flex: 1, paddingHorizontal: 24, paddingBottom: 32 },
  topRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16 },
  wordmarkRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordmark:      { fontSize: 22, color: '#14110D', letterSpacing: -0.5 },
  wordDot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: '#C8F14A' },
  backBtn:       { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#E8E2D5', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  title:         { fontSize: 34, color: '#14110D', letterSpacing: -1, lineHeight: 36 },
  subtitle:      { fontSize: 14, color: '#6A6258', marginTop: 10, lineHeight: 20 },
  toggle:        { flexDirection: 'row', backgroundColor: '#EFEADD', borderRadius: 12, padding: 4, marginTop: 22 },
  togglePill:    { flex: 1, textAlign: 'center', paddingVertical: 10, borderRadius: 8, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  toggleBtn:     { flex: 1, paddingVertical: 10, alignItems: 'center' },
  toggleActive:  { fontSize: 12, letterSpacing: 2, color: '#14110D' },
  toggleInactive:{ fontSize: 12, letterSpacing: 2, color: '#6A6258' },
  form:          { marginTop: 20, gap: 16 },
  label:         { fontSize: 10, letterSpacing: 2.5, color: '#AAA295', marginBottom: 7 },
  field:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, borderWidth: 1.5, borderColor: '#E8E2D5', borderRadius: 14, backgroundColor: '#FFFFFF' },
  fieldInput:    { flex: 1, fontSize: 15, color: '#14110D' },
  orRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  orLine:        { flex: 1, height: 1, backgroundColor: '#E8E2D5' },
  orText:        { fontSize: 10, letterSpacing: 2.5, color: '#AAA295' },
  socialRow:     { flexDirection: 'row', gap: 8, marginBottom: 14 },
  socialBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderWidth: 1.5, borderColor: '#E8E2D5', borderRadius: 14, backgroundColor: '#FFFFFF' },
  socialIcon:    { fontSize: 15 },
  socialLabel:   { fontSize: 13, color: '#14110D', letterSpacing: 0.3 },
  cta:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#14110D', borderRadius: 15, paddingVertical: 17, marginBottom: 12 },
  ctaText:       { color: '#FFFFFF', fontSize: 13, letterSpacing: 2.5 },
  ctaArrow:      { width: 24, height: 24, borderRadius: 12, backgroundColor: '#C8F14A', alignItems: 'center', justifyContent: 'center' },
  switchRow:     { flexDirection: 'row', justifyContent: 'center', paddingBottom: 8 },
  switchText:    { fontSize: 13, color: '#6A6258' },
  switchLink:    { fontSize: 13, color: '#14110D' },
});
