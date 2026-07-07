// Permission-request screen for iOS Screen Time access.
//
// Drop this anywhere a "Connect Screen Time" CTA needs to live. It:
//   1. Reads the current status on mount + on app foreground (so returning
//      from Settings re-checks).
//   2. Renders an explainer + a single CTA whose label adapts to the state.
//   3. Calls onAuthorized() when the user lands on 'granted', so the parent
//      can swap the screen for the actual feature.
//
// Visually it follows the Warm Coach palette so it slots into the rest of
// the app without ceremony.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, AppState, AppStateStatus,
  Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usageAccess, UsageAuthStatus } from '../lib/usageAccess';
import { useTheme } from './ThemeContext';

type Props = {
  /** Called when status flips to 'granted'. Use it to mount the next screen. */
  onAuthorized?: () => void;
  /** Optional override label for the title block. */
  title?: string;
};

export function UsageAccessGate({ onAuthorized, title }: Props) {
  const { theme } = useTheme();
  const [status, setStatus] = useState<UsageAuthStatus | null>(null);
  const [busy, setBusy]     = useState(false);

  const refresh = useCallback(async () => {
    const s = await usageAccess.getStatus();
    setStatus(s);
    if (s === 'granted') onAuthorized?.();
  }, [onAuthorized]);

  // First load
  useEffect(() => { refresh(); }, [refresh]);

  // Re-check whenever the app returns from background — covers the case of
  // user toggling Screen Time access in Settings and swiping back in.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  async function handlePress() {
    if (busy) return;
    setBusy(true);
    try {
      if (status === 'denied') {
        // Apple won't let us re-prompt — only path is the Settings app.
        await usageAccess.openSettings();
      } else {
        const next = await usageAccess.request();
        setStatus(next);
        if (next === 'granted') onAuthorized?.();
      }
    } finally {
      setBusy(false);
    }
  }

  // While we don't yet know the status, show a quiet spinner — avoids the
  // CTA flashing the wrong label for a frame.
  if (status === null) {
    return (
      <View style={[g.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.text} />
      </View>
    );
  }

  // Hide the gate entirely on Android / older iOS so screens importing this
  // can render their happy path without an "unsupported" wall.
  if (status === 'unsupported') {
    return (
      <SafeAreaView style={[g.safe, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
        <View style={g.body}>
          <Text style={[g.eyebrow, { color: theme.textTertiary }]}>SCREEN TIME</Text>
          <Text style={[g.title, { color: theme.text }]}>Not available on this device</Text>
          <Text style={[g.body2, { color: theme.textSecondary }]}>
            {Platform.OS === 'ios'
              ? 'Screen Time access needs iOS 16 or newer. Update your device to enable it.'
              : 'This feature is currently only available on iOS.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main flow: notDetermined | denied | granted ────────────────────────────

  const cta =
    status === 'granted' ? 'CONNECTED'
    : status === 'denied' ? 'OPEN SETTINGS'
    : 'ALLOW SCREEN TIME ACCESS';

  return (
    <SafeAreaView style={[g.safe, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={g.body} showsVerticalScrollIndicator={false}>
        <View style={[g.iconWrap, { backgroundColor: theme.surface }]}>
          <Ionicons name="hourglass-outline" size={28} color={theme.text} />
        </View>

        <Text style={[g.eyebrow, { color: theme.textTertiary }]}>SCREEN TIME · iOS</Text>
        <Text style={[g.title, { color: theme.text }]}>
          {title ?? 'Let Grittt see your screen time.'}
        </Text>
        <Text style={[g.body2, { color: theme.textSecondary }]}>
          We use Apple's Screen Time to spot the apps eating your day, then
          turn them into discipline reps. Nothing leaves your device unless
          you choose to share it.
        </Text>

        {/* What we actually do with it — short, honest list */}
        <View style={[g.bullets, { borderColor: theme.border }]}>
          <Bullet text="See which apps cross your daily limit" theme={theme} />
          <Bullet text="Nudge you when a control habit is slipping" theme={theme} />
          <Bullet text="Show progress against your own targets" theme={theme} />
        </View>

        <Text style={[g.fineprint, { color: theme.textMuted }]}>
          Apple controls this prompt. You'll see Apple's system sheet — we
          don't see your data until you tap Continue there. You can revoke
          anytime in Settings → Screen Time.
        </Text>
      </ScrollView>

      {/* Sticky CTA. Disabled while busy or already granted. */}
      <View style={g.ctaWrap}>
        <TouchableOpacity
          style={[g.cta, {
            backgroundColor: status === 'granted' ? theme.success : theme.inverse,
            opacity: busy ? 0.5 : 1,
          }]}
          onPress={handlePress}
          disabled={busy || status === 'granted'}
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator color={status === 'granted' ? '#fff' : theme.inverseText} />
          ) : (
            <>
              {status === 'granted' && (
                <Ionicons name="checkmark" size={16} color="#fff" style={{ marginRight: 6 }} />
              )}
              <Text style={[g.ctaText, {
                color: status === 'granted' ? '#fff' : theme.inverseText,
              }]}>
                {cta}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {status === 'denied' && (
          <Text style={[g.deniedHint, { color: theme.textMuted }]}>
            You denied access earlier. Toggle it on in Settings → Screen Time
            → Share Across Devices, then return here.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function Bullet({ text, theme }: { text: string; theme: any }) {
  return (
    <View style={g.bulletRow}>
      <View style={[g.bulletDot, { backgroundColor: theme.accent }]} />
      <Text style={[g.bulletText, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

const g = StyleSheet.create({
  safe:        { flex: 1 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body:        { padding: 24, paddingTop: 32, paddingBottom: 32, gap: 14 },
  iconWrap:    { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  eyebrow:     { fontSize: 11, letterSpacing: 1.8, fontFamily: 'Inter_700Bold' },
  title:       { fontSize: 26, letterSpacing: -0.5, lineHeight: 30, fontFamily: 'Inter_900Black' },
  body2:       { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_400Regular' },
  bullets:     { marginTop: 8, borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  bulletRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bulletDot:   { width: 6, height: 6, borderRadius: 3 },
  bulletText:  { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  fineprint:   { fontSize: 12, lineHeight: 18, marginTop: 8, fontFamily: 'Inter_400Regular' },
  ctaWrap:     { paddingHorizontal: 22, paddingBottom: 16, paddingTop: 8 },
  cta:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 17, borderRadius: 16 },
  ctaText:     { fontSize: 14, letterSpacing: 2, fontFamily: 'Inter_900Black' },
  deniedHint:  { textAlign: 'center', marginTop: 10, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium' },
});
