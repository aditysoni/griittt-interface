import React, { useState } from 'react';
import {
  Alert, Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { storage } from '../../lib/storage';

// ── Warm Coach design tokens ─────────────────────────────
const W = {
  bg:   '#F5F1E8',
  card: '#FFFFFF',
  ink:  '#14110D',
  ink2: '#5C544A',
  ink3: '#A39B8E',
  rule: '#E8E0CE',
  rest: '#EFE8D7',
  hype: '#B8F23A',
  good: '#22A664',
  warn: '#F0A12E',
  bad:  '#E84A4A',
  dark: '#14110D',
};

// ── Shared Shell ─────────────────────────────────────────
function Shell({ step, total = 10, children, cta, ctaDisabled, onCta, onBack, dark = false }: {
  step: number; total?: number; children: React.ReactNode;
  cta?: string; ctaDisabled?: boolean; onCta?: () => void;
  onBack?: () => void;
  dark?: boolean;
}) {
  const bg = dark ? W.dark : W.bg;
  const ink = dark ? '#FFFFFF' : W.ink;
  const ink3c = dark ? 'rgba(255,255,255,0.35)' : W.ink3;
  const ruleC = dark ? 'rgba(255,255,255,0.12)' : W.rule;
  const ctaBg = ctaDisabled ? (dark ? 'rgba(255,255,255,0.08)' : W.rest) : (dark ? W.hype : W.ink);
  const ctaColor = ctaDisabled ? ink3c : (dark ? W.ink : '#FFFFFF');

  return (
    <View style={[ss.shell, { backgroundColor: bg }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: bg }}>
        <View style={ss.progressRow}>
          <TouchableOpacity
            style={[ss.backBtn, { borderColor: ruleC, opacity: onBack ? 1 : 0.3 }]}
            onPress={onBack}
            disabled={!onBack}
            activeOpacity={0.6}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={{ color: dark ? 'rgba(255,255,255,0.7)' : W.ink2, fontSize: 18 }}>‹</Text>
          </TouchableOpacity>
          <View style={ss.dots}>
            {Array.from({ length: total }).map((_, i) => (
              <View key={i} style={[
                ss.dot,
                i < step
                  ? { flex: 1, height: 4, backgroundColor: dark ? W.hype : W.ink }
                  : { width: 6, height: 6, backgroundColor: i === step ? ink : ruleC },
              ]} />
            ))}
          </View>
          <Text style={[ss.stepCount, { color: ink3c, fontFamily: 'SpaceGrotesk_500Medium' }]}>
            {step}/{total}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={ss.body}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>

      {cta && (
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: bg }}>
          <View style={ss.ctaWrap}>
            <TouchableOpacity style={[ss.ctaBtn, { backgroundColor: ctaBg }]}
              onPress={onCta} disabled={ctaDisabled} activeOpacity={0.85}>
              <Text style={[ss.ctaText, { color: ctaColor, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                {cta}  →
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

function Title({ eyebrow, title, sub, dark = false }: {
  eyebrow?: string; title: string; sub?: string; dark?: boolean;
}) {
  return (
    <View style={{ marginBottom: 28 }}>
      {eyebrow && (
        <Text style={[tt.eyebrow, { color: dark ? W.hype : W.ink3, fontFamily: 'Inter_700Bold' }]}>
          {eyebrow}
        </Text>
      )}
      <Text style={[tt.title, { color: dark ? '#FFFFFF' : W.ink, fontFamily: 'SpaceGrotesk_700Bold' }]}>
        {title}
      </Text>
      {sub && (
        <Text style={[tt.sub, { color: dark ? 'rgba(255,255,255,0.65)' : W.ink2, fontFamily: 'Inter_400Regular' }]}>
          {sub}
        </Text>
      )}
    </View>
  );
}

// ── S1: Welcome ──────────────────────────────────────────
function S1_Welcome({ onNext, showSignIn, onSignIn }: {
  onNext: () => void;
  showSignIn: boolean;
  onSignIn: () => void;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: W.dark }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 26, paddingTop: 40 }}>
          <View style={s1.circle1} />
          <View style={s1.circle2} />
          <View style={{ flex: 1 }} />
          <Text style={[s1.eyebrow, { fontFamily: 'Inter_700Bold' }]}>WELCOME TO GRITTT</Text>
          <Text style={[s1.headline, { fontFamily: 'SpaceGrotesk_700Bold' }]}>
            {'The day\nbelongs\nto you.'}
          </Text>
          <Text style={[s1.sub, { fontFamily: 'Inter_400Regular' }]}>
            One score. Every day. Built from your habits, your fuel, your sweat. Let's set you up in 60 seconds.
          </Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={s1.cta} onPress={onNext} activeOpacity={0.85}>
            <Text style={[s1.ctaText, { fontFamily: 'SpaceGrotesk_700Bold' }]}>I'M NEW HERE  →</Text>
          </TouchableOpacity>
          {showSignIn && (
            <TouchableOpacity style={s1.signInCta} onPress={onSignIn} activeOpacity={0.85}>
              <Text style={[s1.signInCtaText, { fontFamily: 'SpaceGrotesk_700Bold' }]}>
                SIGN IN
              </Text>
            </TouchableOpacity>
          )}
          <View style={{ height: 24 }} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const s1 = StyleSheet.create({
  circle1: {
    position: 'absolute', top: 88, right: 26,
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 1.5, borderColor: W.hype,
  },
  circle2: {
    position: 'absolute', top: 130, right: 60,
    width: 50, height: 50, borderRadius: 25, backgroundColor: W.hype,
  },
  eyebrow: { color: W.hype, fontSize: 12, letterSpacing: 2, marginBottom: 12 },
  headline: { color: '#FFFFFF', fontSize: 50, letterSpacing: -1.5, lineHeight: 52 },
  sub: { color: 'rgba(255,255,255,0.65)', fontSize: 16, marginTop: 20, lineHeight: 24, maxWidth: 300 },
  cta: { backgroundColor: W.hype, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  ctaText: { color: W.ink, fontSize: 14, letterSpacing: 2 },
  signInCta: {
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: W.hype,
    backgroundColor: 'transparent',
  },
  signInCtaText: { color: W.hype, fontSize: 14, letterSpacing: 2 },
});

// ── S2: Name ─────────────────────────────────────────────
function S2_Name({ value, onChange, onNext, onBack, step, total }: {
  value: string; onChange: (s: string) => void; onNext: () => void; onBack: () => void;
  step?: number; total?: number;
}) {
  return (
    <Shell step={step ?? 1} total={total} cta="CONTINUE" onCta={onNext} onBack={onBack} ctaDisabled={!value.trim()}>
      <Title eyebrow="ABOUT YOU · 1 OF 4" title="What should we call you?" sub="Used for your daily coaching nudges." />
      <TextInput
        style={[s2.input, { fontFamily: 'SpaceGrotesk_700Bold' }]}
        value={value} onChangeText={onChange}
        placeholder="Your name…" placeholderTextColor={W.ink3}
        autoFocus returnKeyType="next" onSubmitEditing={onNext}
      />
      <Text style={[s2.hint, { color: W.ink3, fontFamily: 'Inter_400Regular' }]}>
        Your real name or a callsign — your choice.
      </Text>
    </Shell>
  );
}

const s2 = StyleSheet.create({
  input: {
    borderWidth: 1.5, borderColor: W.ink, borderRadius: 14,
    backgroundColor: W.card, paddingHorizontal: 18, paddingVertical: 16,
    fontSize: 20, color: W.ink,
  },
  hint: { fontSize: 12, marginTop: 10 },
});

// ── S3: Body stats ───────────────────────────────────────
function Stepper({ label, value, unit, onDec, onInc, big }: {
  label: string; value: number; unit: string;
  onDec: () => void; onInc: () => void; big?: boolean;
}) {
  return (
    <View style={[s3.card, { backgroundColor: W.card, borderColor: W.rule }]}>
      <Text style={[s3.label, { color: W.ink3, fontFamily: 'Inter_700Bold' }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 10 }}>
        <Text style={[s3.val, { fontSize: big ? 44 : 36, fontFamily: 'SpaceGrotesk_700Bold', color: W.ink }]}>{value}</Text>
        <Text style={[s3.unit, { color: W.ink3, fontFamily: 'Inter_500Medium' }]}>{unit}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
        {['−', '+'].map((s, i) => (
          <TouchableOpacity key={s} style={[s3.btn, { backgroundColor: W.rest }]}
            onPress={i === 0 ? onDec : onInc} activeOpacity={0.7}>
            <Text style={[s3.btnText, { color: W.ink, fontFamily: 'SpaceGrotesk_700Bold' }]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function S3_Body({ age, height, weight, onAge, onHeight, onWeight, onNext, onBack, step, total }: {
  age: number; height: number; weight: number;
  onAge: (n: number) => void; onHeight: (n: number) => void; onWeight: (n: number) => void;
  onNext: () => void; onBack: () => void;
  step?: number; total?: number;
}) {
  return (
    <Shell step={step ?? 2} total={total} cta="CONTINUE" onCta={onNext} onBack={onBack}>
      <Title eyebrow="ABOUT YOU · 2 OF 4" title="The basics." sub="So your fuel and strength scores actually mean something." />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Stepper label="AGE" value={age} unit="yrs"
            onDec={() => onAge(Math.max(10, age - 1))} onInc={() => onAge(Math.min(99, age + 1))} big />
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Stepper label="HEIGHT" value={height} unit="cm"
            onDec={() => onHeight(Math.max(100, height - 1))} onInc={() => onHeight(Math.min(250, height + 1))} />
          <Stepper label="WEIGHT" value={weight} unit="kg"
            onDec={() => onWeight(Math.max(30, weight - 1))} onInc={() => onWeight(Math.min(300, weight + 1))} />
        </View>
      </View>
      <View style={[s3.notice, { backgroundColor: W.rest }]}>
        <Text style={[{ color: W.ink2, fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_400Regular' }]}>
          We never share this. Switch units in settings any time.
        </Text>
      </View>
    </Shell>
  );
}

const s3 = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  label: { fontSize: 9, letterSpacing: 2 },
  val: { lineHeight: 44 },
  unit: { fontSize: 12 },
  btn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  btnText: { fontSize: 18 },
  notice: { marginTop: 16, padding: 14, borderRadius: 12 },
});

// ── Habit recommendations ───────────────────────────────────
// Build = things to start doing (positive habits)
// Break = things to stop doing (control habits)
const BUILD_RECS = [
  { id: 'gym',         name: 'Go to the gym',       icon: '🏋️', impact: 8 },
  { id: 'run',         name: 'Morning run',         icon: '🏃', impact: 7 },
  { id: 'wake_early',  name: 'Wake up at 5am',      icon: '🌅', impact: 6 },
  { id: 'protein',     name: 'Hit protein target',  icon: '💪', impact: 5 },
  { id: 'water',       name: 'Drink 3L water',      icon: '💧', impact: 3 },
  { id: 'read',        name: 'Read 30 minutes',     icon: '📖', impact: 4 },
  { id: 'meditate',    name: 'Meditate 10 min',     icon: '🧘', impact: 5 },
  { id: 'cold_shower', name: 'Cold shower',         icon: '🚿', impact: 5 },
  { id: 'journal',     name: 'Journal 1 page',      icon: '📝', impact: 4 },
];

const BREAK_RECS = [
  { id: 'smoking',      name: 'No smoking',           icon: '🚭', impact: 9 },
  { id: 'alcohol',      name: 'No alcohol',           icon: '🍺', impact: 8 },
  { id: 'porn',         name: 'No porn',              icon: '🚫', impact: 7 },
  { id: 'masturbation', name: 'No masturbation',      icon: '🔞', impact: 7 },
  { id: 'junk_food',    name: 'No junk food',         icon: '🍔', impact: 6 },
  { id: 'social_media', name: 'No social media',      icon: '📱', impact: 6 },
  { id: 'sugar',        name: 'No sugar',             icon: '🍬', impact: 5 },
  { id: 'phone_bed',    name: 'No phone in bed',      icon: '🛏️', impact: 5 },
];

// ── Challenge recommendations ───────────────────────────────
// Title is matched server-side against seeded preset challenges by lowercase.
type ChallengeTheme = 'physical' | 'health' | 'career' | 'lifestyle';
const THEME_COLOR: Record<ChallengeTheme, string> = {
  physical:  '#34C759',
  health:    '#F59E0B',
  career:    '#06B6D4',
  lifestyle: '#8B5CF6',
};
const CHALLENGE_RECS: { title: string; durationDays: number; theme: ChallengeTheme; benefits: string[] }[] = [
  { title: 'Cold shower',     durationDays: 30, theme: 'physical',  benefits: ['Blood flow', 'High testosterone', 'Stress release'] },
  { title: 'Gym daily',       durationDays: 30, theme: 'physical',  benefits: ['Muscle gain', 'Strength', 'Confidence'] },
  { title: 'Morning run',     durationDays: 30, theme: 'physical',  benefits: ['Cardio fitness', 'Mental clarity', 'Energy boost'] },
  { title: 'No sugar',        durationDays: 30, theme: 'health',    benefits: ['Lean body', 'Stable energy', 'Better mood'] },
  { title: 'No alcohol',      durationDays: 30, theme: 'health',    benefits: ['Better sleep', 'Lean body', 'Mental clarity'] },
  { title: 'Meditation',      durationDays: 30, theme: 'health',    benefits: ['Lower anxiety', 'Better focus', 'Emotional control'] },
  { title: 'Read daily',      durationDays: 30, theme: 'career',    benefits: ['Vocabulary', 'Empathy', 'Focus stamina'] },
  { title: 'Wake at 5am',     durationDays: 30, theme: 'lifestyle', benefits: ['Time control', 'Discipline reps', 'Quiet hours'] },
  { title: 'No phone in bed', durationDays: 30, theme: 'lifestyle', benefits: ['Better sleep', 'Sharper focus', 'Less anxiety'] },
];

// ── S_HabitPicker — list-row design like the Discipline page ────────────────
function S_HabitPicker({
  variant, selected, onToggle, onNext, onBack, step, total,
}: {
  variant: 'build' | 'break';
  selected: string[];
  onToggle: (id: string) => void;
  onNext: () => void; onBack: () => void;
  step?: number; total?: number;
}) {
  const isBuild  = variant === 'build';
  const opts     = isBuild ? BUILD_RECS : BREAK_RECS;
  const eyebrow  = isBuild ? 'DISCIPLINE · BUILD' : 'DISCIPLINE · BREAK';
  const title    = isBuild ? 'What do you want to build?' : 'What do you want to control?';
  const sub      = isBuild
    ? 'Pick the habits to add. Skip anything you don\'t want.'
    : 'Pick what you want out of your life. Skip anything that doesn\'t apply.';
  const ptColor  = isBuild ? W.good : W.bad;
  const ptPrefix = isBuild ? '+' : '−';

  return (
    <Shell step={step ?? 4} total={total} cta="CONTINUE" onCta={onNext} onBack={onBack}>
      <Title eyebrow={eyebrow} title={title} sub={sub} />
      <View style={hp.list}>
        {opts.map(o => {
          const on = selected.includes(o.id);
          return (
            <TouchableOpacity key={o.id}
              style={[hp.row, { borderColor: on ? W.ink : W.rule, backgroundColor: W.card }]}
              onPress={() => onToggle(o.id)} activeOpacity={0.8}>
              <View style={[hp.checkbox, { borderColor: on ? W.ink : W.rule, backgroundColor: on ? W.hype : 'transparent' }]}>
                {on && <Text style={{ color: W.ink, fontSize: 12, fontWeight: '900' }}>✓</Text>}
              </View>
              <Text style={{ fontSize: 22 }}>{o.icon}</Text>
              <Text style={[hp.name, { color: W.ink, fontFamily: 'Inter_700Bold' }]} numberOfLines={1}>{o.name}</Text>
              <Text style={[hp.pts, { color: ptColor, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                {ptPrefix}{o.impact} PT
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Shell>
  );
}

const hp = StyleSheet.create({
  list:     { gap: 8 },
  row:      {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    borderRadius: 14, borderWidth: 1.5,
  },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  name:     { flex: 1, fontSize: 14, letterSpacing: 0.3 },
  pts:      { fontSize: 12, letterSpacing: 1 },
});

// ── S_ChallengePicker — styled like the Challenges page cards ───────────────
function S_ChallengePicker({
  selected, onToggle, onNext, onBack, step, total,
}: {
  selected: string[];
  onToggle: (title: string) => void;
  onNext: () => void; onBack: () => void;
  step?: number; total?: number;
}) {
  return (
    <Shell step={step ?? 6} total={total} cta="CONTINUE" onCta={onNext} onBack={onBack}>
      <Title eyebrow="GRIND · CHALLENGES" title="Take on a challenge?" sub="Pick anything you want to lock in for 30 days. Skip if none." />
      <View style={cp.list}>
        {CHALLENGE_RECS.map(c => {
          const on = selected.includes(c.title);
          const dotColor = THEME_COLOR[c.theme];
          return (
            <TouchableOpacity key={c.title}
              style={[cp.card, { borderColor: on ? W.ink : W.rule, backgroundColor: W.card }]}
              onPress={() => onToggle(c.title)} activeOpacity={0.85}>
              <View style={cp.headerRow}>
                <View style={[cp.dot, { backgroundColor: dotColor }]} />
                <Text style={[cp.title, { color: W.ink, fontFamily: 'SpaceGrotesk_700Bold' }]}>{c.title.toUpperCase()}</Text>
                <View style={{ flex: 1 }} />
                <View style={[cp.checkbox, { borderColor: on ? W.ink : W.rule, backgroundColor: on ? W.hype : 'transparent' }]}>
                  {on && <Text style={{ color: W.ink, fontSize: 12, fontWeight: '900' }}>✓</Text>}
                </View>
              </View>
              <Text style={[cp.duration, { color: W.ink3, fontFamily: 'Inter_700Bold' }]}>{c.durationDays} DAYS</Text>
              <View style={cp.benefits}>
                {c.benefits.map(b => (
                  <View key={b} style={[cp.chip, { backgroundColor: W.rest }]}>
                    <Text style={[cp.chipText, { color: W.ink2, fontFamily: 'Inter_500Medium' }]}>{b}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Shell>
  );
}

const cp = StyleSheet.create({
  list:      { gap: 10 },
  card:      { padding: 14, borderRadius: 14, borderWidth: 1.5, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:       { width: 10, height: 10, borderRadius: 5 },
  title:     { fontSize: 14, letterSpacing: 1 },
  duration:  { fontSize: 9, letterSpacing: 2 },
  benefits:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  chip:      { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6 },
  chipText:  { fontSize: 11 },
  checkbox:  { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});

// ── S5: Baseline ─────────────────────────────────────────
function S5_Baseline({ value, onChange, onNext, onBack, step, total }: {
  value: number; onChange: (n: number) => void; onNext: () => void; onBack: () => void;
  step?: number; total?: number;
}) {
  const cfg = value <= 4
    ? { label: value <= 2 ? 'ROCK BOTTOM' : 'DRIFTING — TIME TO RESET', color: W.bad, bg: '#FCE6E6' }
    : value <= 6
      ? { label: 'AVERAGE — ROOM TO GROW', color: W.warn, bg: '#FFF1DC' }
      : { label: 'BUILDING MOMENTUM', color: W.good, bg: '#E2F7EC' };

  return (
    <Shell step={step ?? 4} total={total} cta="CONTINUE" onCta={onNext} onBack={onBack}>
      <Title eyebrow="HONEST CHECK" title="Be honest." sub="Where are you right now? 1 is rock bottom, 10 is dialed. No judgment." />
      <View style={{ alignItems: 'center', paddingVertical: 12 }}>
        <Text style={[s5.bigNum, { color: W.ink, fontFamily: 'SpaceGrotesk_700Bold' }]}>
          {value}<Text style={{ fontSize: 32, color: W.ink3 }}>/10</Text>
        </Text>
        <View style={[s5.pill, { backgroundColor: cfg.bg }]}>
          <Text style={[s5.pillText, { color: cfg.color, fontFamily: 'Inter_700Bold' }]}>{cfg.label}</Text>
        </View>
      </View>
      <View style={s5.ratingRow}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <TouchableOpacity key={n}
            style={[s5.ratingBtn, { backgroundColor: n <= value ? W.ink : W.rest, borderWidth: n === value ? 2 : 0, borderColor: W.hype }]}
            onPress={() => onChange(n)} activeOpacity={0.7}>
            <Text style={[s5.ratingNum, { color: n <= value ? '#FFFFFF' : W.ink3, fontFamily: 'SpaceGrotesk_700Bold' }]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
        <Text style={[s5.rangeLabel, { color: W.ink3, fontFamily: 'Inter_700Bold' }]}>ROCK BOTTOM</Text>
        <Text style={[s5.rangeLabel, { color: W.ink3, fontFamily: 'Inter_700Bold' }]}>DIALED IN</Text>
      </View>
    </Shell>
  );
}

const s5 = StyleSheet.create({
  bigNum: { fontSize: 96, lineHeight: 96, letterSpacing: -4 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 10 },
  pillText: { fontSize: 11, letterSpacing: 1.5 },
  ratingRow: { flexDirection: 'row', gap: 5, marginTop: 20 },
  ratingBtn: { flex: 1, aspectRatio: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ratingNum: { fontSize: 13 },
  rangeLabel: { fontSize: 9, letterSpacing: 1.5 },
});

// ── S6: Priority mode ────────────────────────────────────
const MODES = [
  { id: 'disc', name: 'DISCIPLINE', sub: 'Build a bulletproof daily routine.' },
  { id: 'fuel', name: 'FUEL',       sub: 'Lock in clean eating. Body comp follows.' },
  { id: 'phys', name: 'STRENGTH',   sub: 'Move every day. Get visibly stronger.' },
];

function S6_Priority({ selected, onSelect, onNext, onBack, step, total }: {
  selected: string; onSelect: (id: string) => void; onNext: () => void; onBack: () => void;
  step?: number; total?: number;
}) {
  return (
    <Shell step={step ?? 3} total={total} cta="CONTINUE" onCta={onNext} onBack={onBack}>
      <Title eyebrow="YOUR FOCUS" title="What matters most right now?" sub="We'll surface this mode first on your dashboard. Change anytime." />
      <View style={{ gap: 10 }}>
        {MODES.map(m => {
          const on = selected === m.id;
          return (
            <TouchableOpacity key={m.id}
              style={[s6.card, { borderColor: on ? W.ink : W.rule, backgroundColor: on ? W.ink : W.card }]}
              onPress={() => onSelect(m.id)} activeOpacity={0.8}>
              <Text style={[s6.modeName, { color: on ? '#FFFFFF' : W.ink, fontFamily: 'SpaceGrotesk_700Bold' }]}>{m.name}</Text>
              <Text style={[s6.modeSub, { color: on ? 'rgba(255,255,255,0.7)' : W.ink2, fontFamily: 'Inter_400Regular' }]}>{m.sub}</Text>
              <View style={[s6.radio, { borderColor: on ? W.hype : W.rule, backgroundColor: on ? W.hype : 'transparent' }]}>
                {on && <Text style={{ color: W.ink, fontSize: 10, fontWeight: '900' }}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Shell>
  );
}

const s6 = StyleSheet.create({
  card: { padding: 18, borderRadius: 18, borderWidth: 1.5 },
  modeName: { fontSize: 26, letterSpacing: -0.5, lineHeight: 28 },
  modeSub: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  radio: { position: 'absolute', top: 18, right: 18, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});

// ── S8: Log time ─────────────────────────────────────────
const TIMES = [
  { id: 'morning', label: 'Morning',    emoji: '🌅', sub: '6–10 am' },
  { id: 'midday',  label: 'Midday',     emoji: '☀️',  sub: '11 am–2 pm' },
  { id: 'evening', label: 'Evening',    emoji: '🌆', sub: '5–8 pm' },
  { id: 'bed',     label: 'Before bed', emoji: '🌙', sub: '9–11 pm' },
];

function S8_Time({ selected, onSelect, onNext, onBack, step, total }: {
  selected: string; onSelect: (id: string) => void; onNext: () => void; onBack: () => void;
  step?: number; total?: number;
}) {
  return (
    <Shell step={step ?? 7} total={total} cta="CONTINUE" onCta={onNext} onBack={onBack}>
      <Title eyebrow="DAILY RHYTHM" title="When can you spare 60 seconds?" sub="That's when we'll nudge you to log. Be realistic." />
      <View style={s8.grid}>
        {TIMES.map(t => {
          const on = selected === t.id;
          return (
            <TouchableOpacity key={t.id}
              style={[s8.card, { borderColor: on ? W.ink : W.rule, backgroundColor: on ? W.ink : W.card }]}
              onPress={() => onSelect(t.id)} activeOpacity={0.8}>
              <Text style={{ fontSize: 28 }}>{t.emoji}</Text>
              <Text style={[s8.timeLabel, { color: on ? '#FFFFFF' : W.ink, fontFamily: 'SpaceGrotesk_700Bold' }]}>{t.label}</Text>
              <Text style={[s8.timeSub, { color: on ? 'rgba(255,255,255,0.6)' : W.ink3, fontFamily: 'Inter_500Medium' }]}>{t.sub}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={[s8.note, { backgroundColor: W.rest }]}>
        <Text style={{ color: W.ink2, fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_400Regular' }}>
          We'll remind you once. Miss it? No big deal — log when you can. The streak only cares that you logged.
        </Text>
      </View>
    </Shell>
  );
}

const s8 = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '48%', padding: 18, borderRadius: 16, borderWidth: 1.5, minHeight: 110, justifyContent: 'space-between' },
  timeLabel: { fontSize: 17, marginTop: 8 },
  timeSub: { fontSize: 11.5, marginTop: 2 },
  note: { marginTop: 16, padding: 14, borderRadius: 12 },
});

// ── S9: Coaching tone ────────────────────────────────────
const TONES = [
  { id: 'soft', label: 'Encouraging', sub: 'A gentle push. Cheer the wins.', icon: '🤗' },
  { id: 'bal',  label: 'Balanced',    sub: 'Honest. Hype the wins, name the misses.', icon: '⚖️' },
  { id: 'hard', label: 'No mercy',    sub: 'Goggins energy. Call out every slip.', icon: '🔥' },
];

function S9_Tone({ selected, onSelect, onNext, onBack, step, total }: {
  selected: string; onSelect: (id: string) => void; onNext: () => void; onBack: () => void;
  step?: number; total?: number;
}) {
  return (
    <Shell step={step ?? 8} total={total} cta="CONTINUE" onCta={onNext} onBack={onBack}>
      <Title eyebrow="COACHING" title="How should we talk to you?" sub="Change anytime in settings." />
      <View style={{ gap: 10 }}>
        {TONES.map(t => {
          const on = selected === t.id;
          return (
            <TouchableOpacity key={t.id}
              style={[s9.row, { borderColor: on ? W.ink : W.rule, backgroundColor: on ? '#FFFBEC' : W.card }]}
              onPress={() => onSelect(t.id)} activeOpacity={0.8}>
              <View style={[s9.iconBox, { backgroundColor: W.rest }]}>
                <Text style={{ fontSize: 22 }}>{t.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s9.toneName, { color: W.ink, fontFamily: 'SpaceGrotesk_700Bold' }]}>{t.label}</Text>
                <Text style={[s9.toneSub, { color: W.ink2, fontFamily: 'Inter_400Regular' }]}>{t.sub}</Text>
              </View>
              <View style={[s9.radio, { borderColor: on ? W.ink : W.rule, backgroundColor: on ? W.ink : 'transparent' }]}>
                {on && <View style={s9.radioDot} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={[s9.sample, { backgroundColor: W.ink }]}>
        <Text style={[s9.sampleEyebrow, { color: W.hype, fontFamily: 'Inter_700Bold' }]}>SAMPLE NUDGE</Text>
        <Text style={[s9.sampleText, { color: '#FFFFFF', fontFamily: 'SpaceGrotesk_700Bold' }]}>
          "Two days clean on cold showers. Don't break it now — same time tomorrow."
        </Text>
      </View>
    </Shell>
  );
}

const s9 = StyleSheet.create({
  row: { padding: 16, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toneName: { fontSize: 17, letterSpacing: 0.3 },
  toneSub: { fontSize: 12.5, marginTop: 2, lineHeight: 18 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: W.hype },
  sample: { marginTop: 16, padding: 16, borderRadius: 14 },
  sampleEyebrow: { fontSize: 10, letterSpacing: 2, marginBottom: 8 },
  sampleText: { fontSize: 15, lineHeight: 22, textTransform: 'uppercase' },
});

// ── S10: Commit ──────────────────────────────────────────
function S10_Commit({
  name, onCommit, onBack, needsCredentials, email, password, onEmail, onPassword, submitting,
}: {
  name: string;
  onCommit: () => void;
  onBack: () => void;
  needsCredentials: boolean;
  email: string;
  password: string;
  onEmail: (s: string) => void;
  onPassword: (s: string) => void;
  submitting: boolean;
}) {
  const today = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
  const credsValid = !needsCredentials || (email.trim().includes('@') && password.length >= 8);
  const disabled = !credsValid || submitting;

  return (
    <View style={{ flex: 1, backgroundColor: W.dark }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: W.dark }}>
        <View style={s10.topRow}>
          <TouchableOpacity
            style={[s10.backBtn, { borderColor: 'rgba(255,255,255,0.15)' }]}
            onPress={onBack}
            activeOpacity={0.6}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18 }}>‹</Text>
          </TouchableOpacity>
          <View style={[s10.fullBar, { backgroundColor: W.hype }]} />
          <Text style={[s10.stepNum, { color: 'rgba(255,255,255,0.5)', fontFamily: 'SpaceGrotesk_500Medium' }]}>10/10</Text>
        </View>
      </SafeAreaView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s10.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={[s10.eyebrow, { color: W.hype, fontFamily: 'Inter_700Bold' }]}>
          {needsCredentials ? 'LOCK IT IN' : 'SIGN THE PACT'}
        </Text>
        <Text style={[s10.headline, { color: '#FFFFFF', fontFamily: 'SpaceGrotesk_700Bold' }]}>
          {'Today.\nTomorrow.\n'}
          <Text style={{ color: W.hype }}>Every day.</Text>
        </Text>
        <Text style={[s10.sub, { color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter_400Regular' }]}>
          {needsCredentials
            ? 'Create your account so we can save your answers and track every day.'
            : "You'll get one daily nudge. Log in under a minute. Watch your score build."}
        </Text>

        {needsCredentials && (
          <View style={{ marginTop: 22, gap: 12 }}>
            <View>
              <Text style={[s10.fieldLabel, { color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_700Bold' }]}>EMAIL</Text>
              <TextInput
                style={[s10.input, { color: '#FFFFFF', fontFamily: 'Inter_500Medium' }]}
                value={email}
                onChangeText={onEmail}
                placeholder="you@example.com"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
              />
            </View>
            <View>
              <Text style={[s10.fieldLabel, { color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_700Bold' }]}>PASSWORD</Text>
              <TextInput
                style={[s10.input, { color: '#FFFFFF', fontFamily: 'Inter_500Medium' }]}
                value={password}
                onChangeText={onPassword}
                placeholder="At least 8 characters"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                textContentType="newPassword"
              />
            </View>
          </View>
        )}

        {!needsCredentials && (
          <View style={s10.pact}>
            <Text style={[s10.pactEyebrow, { color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_700Bold' }]}>
              I, {(name || 'YOU').toUpperCase()}, COMMIT TO:
            </Text>
            {[
              'Logging every day for 30 days.',
              'Building 3 daily habits.',
              'Being honest about my food and effort.',
            ].map((t, i) => (
              <View key={i} style={s10.commitRow}>
                <View style={s10.commitCheck}>
                  <Text style={{ color: W.ink, fontSize: 11, fontWeight: '900' }}>✓</Text>
                </View>
                <Text style={[s10.commitText, { color: '#FFFFFF', fontFamily: 'Inter_400Regular' }]}>{t}</Text>
              </View>
            ))}
            <View style={s10.sigLine}>
              <Text style={[s10.sigName, { color: W.hype, fontFamily: 'SpaceGrotesk_700Bold' }]}>
                {name || 'Your name'}
              </Text>
              <Text style={[s10.sigDate, { color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_700Bold' }]}>
                SIGNATURE · {today}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={{ backgroundColor: W.dark }}>
        <View style={{ paddingHorizontal: 22, paddingBottom: 16 }}>
          <TouchableOpacity
            style={[s10.cta, disabled && { opacity: 0.4 }]}
            onPress={onCommit}
            disabled={disabled}
            activeOpacity={0.85}
          >
            <Text style={[s10.ctaText, { color: W.ink, fontFamily: 'SpaceGrotesk_700Bold' }]}>
              {submitting ? 'CREATING...' : needsCredentials ? 'CREATE ACCOUNT  →' : "I'M IN  →"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s10 = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 16 },
  backBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  fullBar: { flex: 1, height: 4, borderRadius: 2 },
  stepNum: { fontSize: 11 },
  body: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 24, gap: 0 },
  eyebrow: { fontSize: 12, letterSpacing: 2, marginBottom: 12 },
  headline: { fontSize: 42, letterSpacing: -1.5, lineHeight: 44 },
  sub: { fontSize: 15, marginTop: 14, lineHeight: 22, maxWidth: 300 },
  pact: {
    marginTop: 26, padding: 20, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)', gap: 10,
  },
  pactEyebrow: { fontSize: 10, letterSpacing: 2, marginBottom: 2 },
  commitRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  commitCheck: { width: 20, height: 20, borderRadius: 5, backgroundColor: W.hype, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  commitText: { flex: 1, fontSize: 14, lineHeight: 20 },
  sigLine: { marginTop: 18, paddingTop: 12, borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)', gap: 4 },
  sigName: { fontSize: 28 },
  sigDate: { fontSize: 11, letterSpacing: 1.5 },
  notifRow: { marginTop: 14, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggle: { width: 38, height: 22, borderRadius: 11, backgroundColor: W.hype, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 2 },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: W.ink },
  cta: { backgroundColor: W.hype, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  ctaText: { fontSize: 14, letterSpacing: 2 },
  fieldLabel: { fontSize: 10, letterSpacing: 2, marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
});

// ── Shell styles ─────────────────────────────────────────
const ss = StyleSheet.create({
  shell: { flex: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dots: { flex: 1, flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { borderRadius: 3 },
  stepCount: { fontSize: 11, width: 36, textAlign: 'right' },
  body: { paddingHorizontal: 22, paddingBottom: 24 },
  ctaWrap: { paddingHorizontal: 22, paddingBottom: 16, paddingTop: 14 },
  ctaBtn: { borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
  ctaText: { fontSize: 14, letterSpacing: 2 },
});

const tt = StyleSheet.create({
  eyebrow: { fontSize: 11, letterSpacing: 2, marginBottom: 10 },
  title: { fontSize: 34, letterSpacing: -1, lineHeight: 36, textTransform: 'uppercase' },
  sub: { fontSize: 15, marginTop: 12, lineHeight: 22 },
});

// ── S_QuestionPicker ─────────────────────────────────────
const QUESTION_CATEGORIES = [
  { key: 'Food',       icon: '🍽️', desc: 'Food quality, junk food, meal adherence' },
  { key: 'Hydration',  icon: '💧', desc: 'Water intake throughout the day' },
  { key: 'Sleep',      icon: '😴', desc: 'Sleep quality and duration' },
  { key: 'Energy',     icon: '⚡', desc: 'Energy levels and focus' },
  { key: 'Mindset',    icon: '🧠', desc: 'Mood, stress, and mental clarity' },
  { key: 'Digestion',  icon: '🌿', desc: 'Gut comfort and digestion' },
];

function S_QuestionPicker({ selected, onToggle, onNext, onBack, step, total }: {
  selected: string[];
  onToggle: (key: string) => void;
  onNext: () => void;
  onBack: () => void;
  step?: number;
  total?: number;
}) {
  return (
    <Shell step={step ?? 7} total={total} cta="CONTINUE" onCta={onNext} onBack={onBack}>
      <Text style={[tt.eyebrow, { color: W.ink3 }]}>DAILY CHECK-IN</Text>
      <Text style={[tt.title, { color: W.ink }]}>What do you{'\n'}want to track?</Text>
      <Text style={[tt.sub, { color: W.ink2 }]}>
        Each day you'll answer a few quick questions to build your fuel score. Pick the areas that matter to you.
      </Text>

      <View style={{ gap: 10, marginTop: 28 }}>
        {QUESTION_CATEGORIES.map(cat => {
          const active = selected.includes(cat.key);
          return (
            <TouchableOpacity
              key={cat.key}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                padding: 16, borderRadius: 14, borderWidth: 1.5,
                backgroundColor: active ? W.ink : W.card,
                borderColor: active ? W.ink : W.rule,
              }}
              onPress={() => onToggle(cat.key)}
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 22 }}>{cat.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: active ? '#FFF' : W.ink, marginBottom: 2 }}>
                  {cat.key}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: active ? 'rgba(255,255,255,0.65)' : W.ink3 }}>
                  {cat.desc}
                </Text>
              </View>
              <View style={{
                width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
                backgroundColor: active ? W.hype : 'transparent',
                borderColor: active ? W.hype : W.rule,
                alignItems: 'center', justifyContent: 'center',
              }}>
                {active && <Text style={{ fontSize: 13, color: W.ink }}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={{ fontSize: 12, color: W.ink3, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 16 }}>
        You can add or remove questions anytime from your profile.
      </Text>
    </Shell>
  );
}

// ── Main export ──────────────────────────────────────────
export default function OnboardingScreen() {
  const { completeOnboarding, signup, login, user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.name ?? '');
  const [age, setAge] = useState(25);
  const [height, setHeight] = useState(175);
  const [weight, setWeight] = useState(75);
  const [baseline, setBaseline] = useState(5);
  const [priority, setPriority] = useState('disc');
  // Recommendations the user opts into
  const [buildHabits, setBuildHabits]           = useState<string[]>([]);
  const [breakHabits, setBreakHabits]           = useState<string[]>([]);
  const [pickedChallenges, setPickedChallenges] = useState<string[]>([]);
  const [logTime, setLogTime] = useState('evening');
  const [tone, setTone] = useState('bal');
  // Question categories the user selects during onboarding
  // Applied to real question IDs after signup via the API
  const [selectedQCategories, setSelectedQCategories] = useState<string[]>(['Food', 'Hydration']);

  // Credentials only collected on the final screen when the user isn't logged in yet
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  const needsCredentials = !user;

  const next = () => setStep(s => s + 1);
  const back = () => setStep(s => Math.max(0, s - 1));

  function toggleBuildHabit(id: string) {
    setBuildHabits(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }
  function toggleBreakHabit(id: string) {
    setBreakHabits(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }
  function toggleChallenge(title: string) {
    setPickedChallenges(p => p.includes(title) ? p.filter(x => x !== title) : [...p, title]);
  }
  function toggleQCategory(key: string) {
    setSelectedQCategories(p => p.includes(key) ? p.filter(x => x !== key) : [...p, key]);
  }

  const [submitting, setSubmitting] = useState(false);
  async function finish() {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Create the account first if the user isn't logged in yet. signup()
      // returns the new token so we can chain completeOnboarding() without
      // waiting for React state to re-render — the closure-captured `token`
      // would still be null at this point.
      let freshToken: string | undefined;
      if (needsCredentials) {
        const em = email.trim().toLowerCase();
        if (!em || password.length < 8) {
          Alert.alert('Almost there', 'Enter an email and a password (8+ characters).');
          setSubmitting(false);
          return;
        }
        try {
          freshToken = await signup(name.trim() || 'You', em, password);
        } catch (err: any) {
          // A previous attempt may have created the account but failed to save
          // onboarding (network blip on the final step). Retrying signup with
          // the same email would 409 and trap the user with all their answers.
          // Recover by signing in with the same credentials and continuing.
          const msg = String(err?.message ?? '').toLowerCase();
          const alreadyExists =
            err?.status === 409 || msg.includes('exist') || msg.includes('already') || msg.includes('registered');
          if (!alreadyExists) throw err;
          try {
            await login(em, password);
            freshToken = (await storage.getToken()) ?? undefined;
          } catch {
            Alert.alert(
              'Account already exists',
              'That email is already registered. If it’s yours, sign in to continue — your answers here will need to be re-entered after signing in.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Go to sign in', onPress: () => router.replace('/(auth)/login' as any) },
              ],
            );
            setSubmitting(false);
            return;
          }
        }
      }

      // Convert recommendation ids → habit names the backend can store.
      const buildNames = buildHabits
        .map(id => BUILD_RECS.find(b => b.id === id)?.name)
        .filter((n): n is string => !!n);
      const breakNames = breakHabits
        .map(id => BREAK_RECS.find(b => b.id === id)?.name)
        .filter((n): n is string => !!n);
      const starterHabits = [...buildNames, ...breakNames];

      await completeOnboarding({
        name: name.trim() || undefined,
        age,
        heightCm: height,
        weightKg: weight,
        goals: [],
        baselineSelfRating: baseline,
        priorityMode: priority as 'disc' | 'fuel' | 'phys',
        starterHabits,
        starterChallenges: pickedChallenges,
        dailyNudgeTime: logTime as 'morning' | 'midday' | 'evening' | 'before_bed',
        coachingTone: tone as 'soft' | 'bal' | 'hard',
        notificationsEnabled: true,
      }, freshToken);

      // Apply question selection — load catalog with fresh token, filter by
      // chosen categories, set selection. Failure is non-blocking.
      try {
        const { fuelQuestions } = await import('../../lib/api');
        const tok = freshToken ?? (await import('../../lib/storage').then(m => m.storage.getToken()));
        if (tok) {
          const catalog = await fuelQuestions.catalog(tok);
          const ids = catalog
            .filter(q => selectedQCategories.includes(q.category))
            .map(q => q.id);
          if (ids.length > 0) await fuelQuestions.setSelection(tok, ids);
        }
      } catch { /* non-blocking — user can configure from profile */ }

      router.replace('/first-win' as any);
    } catch (err: any) {
      Alert.alert('Could not finish setup', err?.message ?? 'Try again.');
      setSubmitting(false);
    }
  }

  // Linear flow — no conditional branches. Build → Control → Challenge picks
  // are always shown; each can be skipped by leaving zero selections.
  const flow: React.ReactElement[] = [
    <S1_Welcome
      key="ob1"
      onNext={next}
      showSignIn={!user}
      onSignIn={() => router.push('/(auth)/login' as any)}
    />,
    <S2_Name key="ob2" value={name} onChange={setName} onNext={next} onBack={back} />,
    <S3_Body key="ob3" age={age} height={height} weight={weight}
      onAge={setAge} onHeight={setHeight} onWeight={setWeight} onNext={next} onBack={back} />,
    <S6_Priority key="ob_priority" selected={priority} onSelect={setPriority} onNext={next} onBack={back} />,
    <S_HabitPicker
      key="ob_build"
      variant="build"
      selected={buildHabits}
      onToggle={toggleBuildHabit}
      onNext={next}
      onBack={back}
    />,
    <S_HabitPicker
      key="ob_break"
      variant="break"
      selected={breakHabits}
      onToggle={toggleBreakHabit}
      onNext={next}
      onBack={back}
    />,
    <S_ChallengePicker
      key="ob_challenges"
      selected={pickedChallenges}
      onToggle={toggleChallenge}
      onNext={next}
      onBack={back}
    />,
    <S_QuestionPicker
      key="ob_questions"
      selected={selectedQCategories}
      onToggle={toggleQCategory}
      onNext={next}
      onBack={back}
    />,
    <S5_Baseline key="ob_baseline" value={baseline} onChange={setBaseline} onNext={next} onBack={back} />,
    <S8_Time key="ob_time" selected={logTime} onSelect={setLogTime} onNext={next} onBack={back} />,
    <S9_Tone key="ob_tone" selected={tone} onSelect={setTone} onNext={next} onBack={back} />,
    <S10_Commit
      key="ob_commit"
      name={name}
      onCommit={finish}
      onBack={back}
      needsCredentials={needsCredentials}
      email={email}
      password={password}
      onEmail={setEmail}
      onPassword={setPassword}
      submitting={submitting}
    />,
  ];

  // Inject the correct step + total into each screen based on its position.
  // S1_Welcome is index 0 and doesn't render a Shell, so it has no progress dots.
  const total = flow.length - 1; // excludes Welcome from the dot count
  const screens = flow.map((el, idx) =>
    idx === 0 ? el : React.cloneElement(el, { step: idx, total } as any)
  );

  return screens[Math.min(step, screens.length - 1)];
}
