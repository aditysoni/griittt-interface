import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DarkBackground } from '../components/DarkBackground';
import { useTheme } from '../components/ThemeContext';

const LAST_UPDATED = 'August 1, 2026';

function Section({ title, children, theme }: { title: string; children: React.ReactNode; theme: any }) {
  return (
    <View style={s.section}>
      <Text style={[s.sectionTitle, { color: theme.text, fontFamily: 'Inter_800ExtraBold' }]}>{title}</Text>
      <Text style={[s.body, { color: theme.textSecondary, fontFamily: 'Inter_500Medium' }]}>{children}</Text>
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <DarkBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={[s.topBar, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[s.topTitle, { color: theme.text, fontFamily: 'Inter_900Black' }]}>PRIVACY POLICY</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[s.updated, { color: theme.textMuted }]}>Last updated {LAST_UPDATED}</Text>

          <Section title="What we collect" theme={theme}>
            Your account details (name, email, and password hash — or, if you sign in with Apple or Google,
            the account identifier and email address those services provide), profile info you provide (age,
            height, weight, goals), and the activity you log in the app — habits, fuel/food entries, strength
            sessions, and your answers to daily checklist questions. If you connect Apple Health, we also read
            the health metrics you approve (see "Apple Health" below).
          </Section>

          <Section title="How we use it" theme={theme}>
            To run the app: computing your scores, streaks, history, and — if you connect Apple Health — your
            recovery and movement stats; powering the optional AI features (weekly debriefs, recovery nudges,
            pattern and consistency analysis) by sending relevant snippets of your logged activity to our AI
            provider; and, if you enable them, sending you reminder notifications.
          </Section>

          <Section title="Apple Health" theme={theme}>
            Connecting Apple Health is optional and off by default. You turn it on from your profile and
            choose exactly which data to share through Apple's permission screen — this can include steps,
            active energy, heart rate, heart-rate variability, resting heart rate, sleep, body weight,
            walking/running distance, flights climbed, and workouts (including GPS routes recorded during a
            workout). We use this data only to calculate your in-app recovery and movement stats and related
            insights. You can disconnect at any time from your profile or in the iOS Health app, which stops
            any further reading of your data. We never use Apple Health data for advertising, and we never
            sell it.
          </Section>

          <Section title="AI features" theme={theme}>
            When you use an AI analysis or coaching feature, the specific data needed for that request (e.g.
            a habit's recent completion history, a fuel question's recent answers, or — for recovery
            features — your health-derived recovery figures) is sent to our AI provider to generate a
            response. It is not used to train their models and is not shared beyond what's needed to generate
            that one response.
          </Section>

          <Section title="What we don't do" theme={theme}>
            We don't sell your data. We don't share it with advertisers. We don't use it for anything beyond
            running and improving Grittt.
          </Section>

          <Section title="Third parties" theme={theme}>
            We use OpenAI to power AI features, and Sign in with Apple or Google Sign-In if you choose one of
            those login options. Each only receives the minimum data needed to do its job. We do not share
            your Apple Health data with advertisers.
          </Section>

          <Section title="Your data, your control" theme={theme}>
            From Edit Profile, you can delete all your tracked data at any time while keeping your account,
            or permanently delete your account and everything tied to it. Account deletion cannot be undone.
          </Section>

          <Section title="Security" theme={theme}>
            Passwords are stored hashed, never in plain text. Data is transmitted over encrypted connections.
          </Section>

          <Section title="Contact" theme={theme}>
            Questions about this policy or your data? Reach out to the email associated with your account
            sign-up, or through the app's support channel.
          </Section>
        </ScrollView>
      </SafeAreaView>
    </DarkBackground>
  );
}

const s = StyleSheet.create({
  topBar:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 14, letterSpacing: 2 },
  scroll:   { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48, gap: 20 },
  updated:  { fontSize: 11, fontFamily: 'Inter_500Medium', marginBottom: -4 },
  section:  { gap: 6 },
  sectionTitle: { fontSize: 13, letterSpacing: 0.3 },
  body:     { fontSize: 13.5, lineHeight: 20 },
});
