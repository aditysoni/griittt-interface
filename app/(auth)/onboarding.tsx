import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Dimensions, Easing, Pressable, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { storage } from '../../lib/storage';
import { futureMirror as futureMirrorApi, FutureMirrorResult, FutureMirrorSnapshot } from '../../lib/api';

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
      <Title eyebrow="ABOUT YOU" title="What should we call you?" sub="Used for your daily coaching nudges." />
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

// ── Shared: Stepper (used for birthday + body stats) ─────
function Stepper({ label, value, unit, onDec, onInc, big }: {
  label: string; value: number | string; unit: string;
  onDec: () => void; onInc: () => void; big?: boolean;
}) {
  return (
    <View style={[s3.card, { backgroundColor: W.card, borderColor: W.rule }]}>
      <Text style={[s3.label, { color: W.ink3, fontFamily: 'Inter_700Bold' }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 10 }}>
        <Text style={[s3.val, { fontSize: big ? 44 : 30, fontFamily: 'SpaceGrotesk_700Bold', color: W.ink }]}>{value}</Text>
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

const s3 = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  label: { fontSize: 9, letterSpacing: 2 },
  val: { lineHeight: 44 },
  unit: { fontSize: 12 },
  btn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  btnText: { fontSize: 18 },
  notice: { marginTop: 16, padding: 14, borderRadius: 12 },
});

// ── S_Birthday ───────────────────────────────────────────
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}
function calcAge(day: number, month: number, year: number): number {
  const today = new Date();
  let age = today.getFullYear() - year;
  const beforeBirthdayThisYear =
    today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthdayThisYear) age--;
  return Math.max(0, age);
}
function daysUntilNextBirthday(day: number, month: number): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const clampedDay = Math.min(day, daysInMonth(month, today.getFullYear()));
  let next = new Date(today.getFullYear(), month - 1, clampedDay);
  if (next < today) next = new Date(today.getFullYear() + 1, month - 1, clampedDay);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

const MIN_AGE = 18;

function S_Birthday({ day, month, year, onDay, onMonth, onYear, onNext, onBack, step, total }: {
  day: number; month: number; year: number;
  onDay: (n: number) => void; onMonth: (n: number) => void; onYear: (n: number) => void;
  onNext: () => void; onBack: () => void; step?: number; total?: number;
}) {
  const daysLeft = daysUntilNextBirthday(day, month);
  const age = calcAge(day, month, year);
  const underage = age < MIN_AGE;
  // Newest birth year that CAN yield 18+ (exact eligibility is still verified
  // via calcAge below, since this alone doesn't account for day/month).
  const latestYear = new Date().getFullYear() - MIN_AGE;

  return (
    <Shell step={step ?? 2} total={total} cta="CONTINUE" onCta={onNext} onBack={onBack} ctaDisabled={underage}>
      <Title eyebrow="ABOUT YOU" title="When's your birthday?" sub="We'll use this to show you where you're headed." />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Stepper label="DAY" value={day} unit=""
            onDec={() => onDay(day <= 1 ? daysInMonth(month, year) : day - 1)}
            onInc={() => onDay(day >= daysInMonth(month, year) ? 1 : day + 1)} />
        </View>
        <View style={{ flex: 1 }}>
          <Stepper label="MONTH" value={MONTH_NAMES[month - 1]} unit=""
            onDec={() => onMonth(month <= 1 ? 12 : month - 1)}
            onInc={() => onMonth(month >= 12 ? 1 : month + 1)} />
        </View>
        <View style={{ flex: 1 }}>
          <Stepper label="YEAR" value={year} unit=""
            onDec={() => onYear(Math.max(1930, year - 1))}
            onInc={() => onYear(Math.min(latestYear, year + 1))} />
        </View>
      </View>
      {underage ? (
        <View style={[s3.notice, { backgroundColor: '#FCE6E6' }]}>
          <Text style={{ color: W.bad, fontSize: 13, fontFamily: 'Inter_700Bold' }}>
            GRITTT is only available to people 18 and older right now.
          </Text>
        </View>
      ) : (
        <View style={[s3.notice, { backgroundColor: W.ink }]}>
          <Text style={{ color: W.hype, fontSize: 13, fontFamily: 'Inter_700Bold', marginBottom: 4 }}>
            Your next birthday is in {daysLeft} days.
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_400Regular' }}>
            The person celebrating that birthday is being built right now.
          </Text>
        </View>
      )}
    </Shell>
  );
}

// ── Grouped multi-select (reused for outcomes / pain points / blockers / habits) ──
type Group = { label: string; options: string[] };

function S_GroupedMultiSelect({ eyebrow, title, sub, groups, selected, onToggle, max, onNext, onBack, step, total }: {
  eyebrow: string; title: string; sub?: string; groups: Group[];
  selected: string[]; onToggle: (opt: string) => void; max?: number;
  onNext: () => void; onBack: () => void; step?: number; total?: number;
}) {
  const cta = max ? `CONTINUE${selected.length ? ` (${selected.length}/${max})` : ''}` : 'CONTINUE';
  return (
    <Shell step={step ?? 0} total={total} cta={cta} onCta={onNext} onBack={onBack}>
      <Title eyebrow={eyebrow} title={title} sub={sub} />
      {groups.map(g => (
        <View key={g.label} style={{ marginBottom: 20 }}>
          <Text style={[gm.groupLabel, { color: W.ink3, fontFamily: 'Inter_700Bold' }]}>{g.label.toUpperCase()}</Text>
          <View style={gm.chipWrap}>
            {g.options.map(opt => {
              const on = selected.includes(opt);
              const atMax = !on && !!max && selected.length >= max;
              return (
                <TouchableOpacity
                  key={opt}
                  disabled={atMax}
                  style={[gm.chip, {
                    borderColor: on ? W.ink : W.rule,
                    backgroundColor: on ? W.ink : W.card,
                    opacity: atMax ? 0.4 : 1,
                  }]}
                  onPress={() => onToggle(opt)}
                  activeOpacity={0.8}
                >
                  <Text style={[gm.chipText, { color: on ? '#FFFFFF' : W.ink, fontFamily: on ? 'Inter_700Bold' : 'Inter_500Medium' }]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
    </Shell>
  );
}

const gm = StyleSheet.create({
  groupLabel: { fontSize: 10, letterSpacing: 2, marginBottom: 10 },
  chipWrap:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:       { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  chipText:   { fontSize: 13 },
});

// ── Desired outcomes (max 5) ─────────────────────────────
const DESIRED_OUTCOME_GROUPS: Group[] = [
  { label: 'Body', options: ['Lose weight', 'Reduce belly fat', 'Build muscle', 'Get stronger', 'Improve fitness', 'Improve posture', 'Look better in photos', 'Feel attractive again'] },
  { label: 'Health', options: ['Better sleep', 'More energy', 'Eat healthier', 'Improve digestion', 'Reduce stress', 'Feel healthier overall'] },
  { label: 'Discipline', options: ['Become more disciplined', 'Stop procrastinating', 'Build consistency', 'Follow through on goals', 'Create a routine'] },
  { label: 'Focus', options: ['Better focus', 'Reduce distractions', 'Spend less time on social media', 'Use my phone less', 'Improve productivity'] },
  { label: 'Addictions', options: ['Quit smoking', 'Quit alcohol', 'Quit vaping', 'Quit porn', 'Quit masturbation', 'Reduce junk food', 'Reduce sugar'] },
  { label: 'Emotional', options: ['Feel more confident', 'Improve self-esteem', 'Stop feeling stuck', 'Feel proud of myself', 'Gain momentum in life'] },
];

// ── Pain points (max 3) ──────────────────────────────────
const PAIN_POINT_GROUPS: Group[] = [
  { label: 'Physical', options: ["I'm overweight", 'I have low energy', 'I get tired easily', "I don't like how I look", "I don't sleep well"] },
  { label: 'Mental', options: ['I overthink everything', 'I feel stuck', 'I feel unmotivated', 'I feel lost', 'I have low confidence'] },
  { label: 'Productivity', options: ['I procrastinate', 'I waste too much time', "I can't focus", 'I get distracted easily'] },
  { label: 'Habits', options: ['I keep relapsing', 'I start and quit', 'I have unhealthy habits', "I can't stay consistent"] },
  { label: 'Lifestyle', options: ['I spend too much time on my phone', "I don't exercise", 'I eat too much junk food', 'I smoke', 'I drink too much alcohol'] },
];

// ── Blockers (max 3) ─────────────────────────────────────
const BLOCKER_GROUPS: Group[] = [
  { label: 'Motivation', options: ['I lose motivation quickly', "I don't feel motivated enough", 'I stop when progress is slow'] },
  { label: 'Consistency', options: ['I start but never finish', "I can't stay consistent", 'I keep breaking streaks'] },
  { label: 'Time', options: ["I'm too busy", 'My schedule is unpredictable', 'Work drains me'] },
  { label: 'Environment', options: ['My friends influence me negatively', 'Temptations are everywhere', 'My environment makes it difficult'] },
  { label: 'Knowledge', options: ["I don't know where to start", "I don't know what works", "I've tried everything"] },
  { label: 'Emotional', options: ['Stress', 'Anxiety', 'Low confidence', 'Fear of failure'] },
  { label: 'Addictions', options: ['Nicotine cravings', 'Alcohol cravings', 'Porn addiction', 'Social media addiction', 'Food cravings'] },
];

// ── Positive / negative habits ───────────────────────────
const POSITIVE_HABIT_GROUPS: Group[] = [
  { label: 'Fitness', options: ['Gym', 'Running', 'Walking', 'Sports'] },
  { label: 'Mind', options: ['Reading', 'Journaling', 'Meditation'] },
  { label: 'Health', options: ['Good sleep schedule', 'High protein diet', 'Drinking enough water'] },
  { label: 'Productivity', options: ['Planning my day', 'Time blocking', 'Deep work sessions'] },
];

const NEGATIVE_HABIT_GROUPS: Group[] = [
  { label: 'Addictions', options: ['Smoking', 'Alcohol', 'Vaping', 'Porn', 'Masturbation'] },
  { label: 'Food', options: ['Junk food', 'Sugar', 'Late-night eating'] },
  { label: 'Digital', options: ['Social media', 'Excessive YouTube', 'Gaming', 'Phone in bed'] },
  { label: 'Lifestyle', options: ['Skipping workouts', 'Sleeping late', 'Oversleeping'] },
];

// ── S_Reflection ─────────────────────────────────────────
const REFLECTION_EXAMPLES = [
  "I'd still be overweight.",
  "I'd still be smoking.",
  "I'd still be wasting time.",
  "I'd still be making excuses.",
  "I'd still be stuck.",
];

function S_Reflection({ value, onChange, onNext, onBack, step, total }: {
  value: string; onChange: (s: string) => void; onNext: () => void; onBack: () => void;
  step?: number; total?: number;
}) {
  return (
    <Shell step={step ?? 0} total={total} cta="CONTINUE" onCta={onNext} onBack={onBack}>
      <Title
        eyebrow="HONEST REFLECTION"
        title="If your life looked exactly the same 6 months from now, what would disappoint you the most?"
        sub="Be honest. This one shapes everything else."
      />
      <TextInput
        style={[refl.input, { color: W.ink, fontFamily: 'Inter_500Medium' }]}
        value={value}
        onChangeText={onChange}
        placeholder="I'd still be…"
        placeholderTextColor={W.ink3}
        multiline
        textAlignVertical="top"
      />
      <Text style={[refl.exLabel, { color: W.ink3, fontFamily: 'Inter_700Bold' }]}>OR TAP AN EXAMPLE</Text>
      <View style={{ gap: 8 }}>
        {REFLECTION_EXAMPLES.map(ex => (
          <TouchableOpacity key={ex} onPress={() => onChange(ex)} style={[refl.exRow, { borderColor: W.rule, backgroundColor: W.card }]} activeOpacity={0.7}>
            <Text style={{ color: W.ink2, fontSize: 13.5, fontFamily: 'Inter_400Regular' }}>{ex}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Shell>
  );
}

const refl = StyleSheet.create({
  input: {
    borderWidth: 1.5, borderColor: W.ink, borderRadius: 14, backgroundColor: W.card,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, minHeight: 110,
  },
  exLabel: { fontSize: 10, letterSpacing: 2, marginTop: 20, marginBottom: 10 },
  exRow: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
});

// ── S3: Body (height/weight + sleep + activity) ──────────
const SLEEP_OPTIONS = ['Before 10 PM', '10 PM – 11 PM', '11 PM – Midnight', 'Midnight – 1 AM', 'After 1 AM'];
const ACTIVITY_OPTIONS = ['Never exercise', '1-2 times/week', '3-4 times/week', '5+ times/week'];

function ChoiceRow({ options, selected, onSelect }: { options: string[]; selected: string; onSelect: (s: string) => void }) {
  return (
    <View style={{ gap: 8 }}>
      {options.map(opt => {
        const on = selected === opt;
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(opt)}
            style={[cr.row, { borderColor: on ? W.ink : W.rule, backgroundColor: on ? W.ink : W.card }]}
            activeOpacity={0.8}
          >
            <Text style={[cr.text, { color: on ? '#FFFFFF' : W.ink, fontFamily: on ? 'Inter_700Bold' : 'Inter_500Medium' }]}>{opt}</Text>
            <View style={[cr.radio, { borderColor: on ? W.hype : W.rule, backgroundColor: on ? W.hype : 'transparent' }]}>
              {on && <Text style={{ color: W.ink, fontSize: 10, fontWeight: '900' }}>✓</Text>}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const cr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  text: { fontSize: 14 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});

function S3_Body({ height, weight, sleepSchedule, activityLevel, onHeight, onWeight, onSleep, onActivity, onNext, onBack, step, total }: {
  height: number; weight: number; sleepSchedule: string; activityLevel: string;
  onHeight: (n: number) => void; onWeight: (n: number) => void;
  onSleep: (s: string) => void; onActivity: (s: string) => void;
  onNext: () => void; onBack: () => void;
  step?: number; total?: number;
}) {
  return (
    <Shell step={step ?? 2} total={total} cta="CONTINUE" onCta={onNext} onBack={onBack}>
      <Title eyebrow="CURRENT REALITY" title="Where you're starting from." sub="So your fuel and strength scores actually mean something." />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
        <View style={{ flex: 1 }}>
          <Stepper label="HEIGHT" value={height} unit="cm"
            onDec={() => onHeight(Math.max(100, height - 1))} onInc={() => onHeight(Math.min(250, height + 1))} big />
        </View>
        <View style={{ flex: 1 }}>
          <Stepper label="WEIGHT" value={weight} unit="kg"
            onDec={() => onWeight(Math.max(30, weight - 1))} onInc={() => onWeight(Math.min(300, weight + 1))} big />
        </View>
      </View>

      <Text style={[gm.groupLabel, { color: W.ink3, fontFamily: 'Inter_700Bold' }]}>USUAL SLEEP TIME</Text>
      <View style={{ marginBottom: 20 }}>
        <ChoiceRow options={SLEEP_OPTIONS} selected={sleepSchedule} onSelect={onSleep} />
      </View>

      <Text style={[gm.groupLabel, { color: W.ink3, fontFamily: 'Inter_700Bold' }]}>ACTIVITY LEVEL</Text>
      <ChoiceRow options={ACTIVITY_OPTIONS} selected={activityLevel} onSelect={onActivity} />

      <View style={[s3.notice, { backgroundColor: W.rest }]}>
        <Text style={[{ color: W.ink2, fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_400Regular' }]}>
          We never share this. Switch units in settings any time.
        </Text>
      </View>
    </Shell>
  );
}

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
  const sub      = 'Pre-picked from your answers — adjust anything you don\'t want.';
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

// ── S_FutureMirror — premium AI reveal ───────────────────
// ── S_Consent — gate before the Future Mirror AI call ────
const CONSENT_POINTS = [
  'I am at least 18 years old.',
  'I understand that GRITTT collects and processes the information I provide, including my goals, habits, lifestyle choices, and self-reported behavioral data, in order to deliver personalized insights and recommendations.',
  'I understand that some of the information I provide may be sent to trusted AI service providers to generate personalized analyses, projections, and coaching content.',
  'I understand that GRITTT is not a medical device, healthcare provider, therapist, or treatment service. Any information, predictions, recommendations, or AI-generated content provided by GRITTT are for informational and motivational purposes only and should not be considered medical, psychological, legal, or professional advice.',
  'I understand that AI-generated insights may be inaccurate, incomplete, or unsuitable for my specific circumstances, and I am responsible for my own decisions and actions.',
  'I understand that I can delete my personal data or permanently delete my account at any time through the app settings.',
  'I have read and agree to the Privacy Policy and Terms of Service.',
];

function S_Consent({ agreed, onToggleAgree, onOpenPrivacy, onNext, onBack, step, total }: {
  agreed: boolean; onToggleAgree: () => void; onOpenPrivacy: () => void;
  onNext: () => void; onBack: () => void; step?: number; total?: number;
}) {
  return (
    <Shell step={step ?? 0} total={total} cta="CONTINUE" onCta={onNext} onBack={onBack} ctaDisabled={!agreed}>
      <Title eyebrow="BEFORE YOU CONTINUE" title="Quick check before we build your mirror." />
      <View style={{ gap: 14, marginBottom: 22 }}>
        {CONSENT_POINTS.map((text, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
            <Text style={{ color: W.good, fontSize: 13, fontFamily: 'Inter_900Black', marginTop: 1 }}>✓</Text>
            <Text style={{ flex: 1, color: W.ink2, fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular' }}>{text}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={onToggleAgree}
        style={[cs.row, { borderColor: agreed ? W.ink : W.rule, backgroundColor: agreed ? '#F5F1E8' : W.card }]}
      >
        <View style={[cs.checkbox, { borderColor: agreed ? W.ink : W.rule, backgroundColor: agreed ? W.ink : 'transparent' }]}>
          {agreed && <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '900' }}>✓</Text>}
        </View>
        <Text style={{ flex: 1, color: W.ink, fontSize: 13, lineHeight: 19, fontFamily: 'Inter_500Medium' }}>
          By continuing, I confirm that the information I provide is accurate to the best of my knowledge and I consent to the processing of my data as described above. I've read and agree to the{' '}
          <Text onPress={onOpenPrivacy} style={{ color: W.ink, fontFamily: 'Inter_800ExtraBold', textDecorationLine: 'underline' }}>
            Privacy Policy
          </Text>
          {' '}and Terms of Service.
        </Text>
      </Pressable>
    </Shell>
  );
}

const cs = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});

const SNAPSHOT_EMOJI: Record<string, string> = {
  'Your Next Birthday': '🎂',
  'A Random Tuesday': '📱',
  'Looking In The Mirror': '🪞',
  'Someone Notices': '👤',
};

const SCREEN_W = Dimensions.get('window').width;

/** Fades + gently rises content in on mount — the only motion this screen uses. */
function useEnter(delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1, duration: 700, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);
  return {
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };
}

function MirrorSectionLabel({ children }: { children: string }) {
  return (
    <Text style={fm.sectionLabel}>{children}</Text>
  );
}

function S_FutureMirror({ loading, error, result, onNext, onBack, step, total }: {
  loading: boolean; error: boolean; result: FutureMirrorResult | null;
  onNext: () => void; onBack: () => void; step?: number; total?: number;
}) {
  const heroEnter   = useEnter(0);
  const identEnter  = useEnter(80);
  const costEnter   = useEnter(140);
  const [sceneIdx, setSceneIdx] = useState(0);

  if (loading) {
    return (
      <View style={fm.screen}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: W.dark }}>
          <View style={fm.topRow}>
            <TouchableOpacity style={fm.backBtn} onPress={onBack} activeOpacity={0.6} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18 }}>‹</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
          <ActivityIndicator color={W.hype} size="large" />
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 }}>
            Building your mirror…
          </Text>
        </View>
      </View>
    );
  }

  if (error || !result) {
    return (
      <View style={fm.screen}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: W.dark }}>
          <View style={fm.topRow}>
            <TouchableOpacity style={fm.backBtn} onPress={onBack} activeOpacity={0.6} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18 }}>‹</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 }}>
          <Text style={{ color: W.hype, fontSize: 11, letterSpacing: 2, fontFamily: 'Inter_700Bold' }}>YOUR FUTURE MIRROR</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 22, fontFamily: 'SpaceGrotesk_700Bold', textAlign: 'center', marginTop: 6 }}>
            Couldn't build your mirror right now
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', lineHeight: 20, fontFamily: 'Inter_400Regular', marginTop: 4 }}>
            No worries — let's keep going. You can always come back to this later.
          </Text>
        </View>
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: W.dark }}>
          <View style={{ paddingHorizontal: 22, paddingBottom: 16 }}>
            <TouchableOpacity style={fm.cta} onPress={onNext} activeOpacity={0.85}>
              <Text style={fm.ctaText}>CONTINUE  →</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={fm.screen}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: W.dark }}>
        <View style={fm.topRow}>
          <TouchableOpacity style={fm.backBtn} onPress={onBack} activeOpacity={0.6} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18 }}>‹</Text>
          </TouchableOpacity>
          <View style={fm.dotsRow}>
            {Array.from({ length: total ?? 1 }).map((_, i) => (
              <View key={i} style={[fm.dot, i < (step ?? 0) ? fm.dotDone : fm.dotPending]} />
            ))}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={fm.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Section 1: Hero Mirror ── */}
        <Animated.View style={heroEnter}>
          <Text style={fm.screenTitle}>Future Mirror</Text>
          <Text style={fm.screenSub}>A reflection of who you're becoming.</Text>

          <View style={fm.heroWrap}>
            <View style={fm.heroGlow} pointerEvents="none" />
            <LinearGradient
              colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={fm.heroCard}
            >
              <Text style={fm.heroHeadline}>{result.futureHeadline}</Text>
              {!!result.confidenceLevel && (
                <View style={fm.confidenceRow}>
                  <View style={fm.confidenceDot} />
                  <Text style={fm.confidenceText}>{result.confidenceLevel}</Text>
                </View>
              )}
            </LinearGradient>
          </View>
        </Animated.View>

        {/* ── Section 2: Identity Reflection ── */}
        <Animated.View style={identEnter}>
          <MirrorSectionLabel>WHAT THE MIRROR SEES</MirrorSectionLabel>
          <View style={fm.identityCard}>
            <Text style={fm.identityText}>{result.identityObserved}</Text>
          </View>
          <View style={[fm.identityCard, fm.identityCardEmerging]}>
            <Text style={fm.emergingLabel}>WHO'S TRYING TO EMERGE</Text>
            <Text style={fm.identityTextEmerging}>{result.identityEmerging}</Text>
          </View>
        </Animated.View>

        {/* ── Section 3: Hidden Cost ── */}
        <Animated.View style={costEnter}>
          <MirrorSectionLabel>THE COST NOBODY NOTICES</MirrorSectionLabel>
          <View style={fm.costBlock}>
            <Text style={fm.costText}>{result.hiddenCost}</Text>
            {!!result.selfNegotiation && (
              <Text style={fm.negotiationText}>{result.selfNegotiation}</Text>
            )}
          </View>
        </Animated.View>

        {/* ── Section 4: Future Scenes (swipeable) ── */}
        <MirrorSectionLabel>THE TWO PATHS AHEAD</MirrorSectionLabel>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={e => setSceneIdx(Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - 44)))}
          style={{ marginHorizontal: -22 }}
          contentContainerStyle={{ paddingHorizontal: 22 }}
          decelerationRate="fast"
          snapToInterval={SCREEN_W - 44 + 12}
        >
          <View style={[fm.scene, fm.sceneNegative, { width: SCREEN_W - 44, marginRight: 12 }]}>
            <Text style={fm.sceneLabel}>IF NOTHING CHANGES</Text>
            <Text style={fm.sceneText}>{result.futureMirrorNegative}</Text>
          </View>
          <View style={[fm.scene, fm.scenePositive, { width: SCREEN_W - 44 }]}>
            <Text style={[fm.sceneLabel, { color: W.good }]}>IF THE PATTERN CHANGES</Text>
            <Text style={fm.sceneText}>{result.futureMirrorPositive}</Text>
          </View>
        </ScrollView>
        <View style={fm.pagerRow}>
          <View style={[fm.pagerDot, sceneIdx === 0 && fm.pagerDotActive]} />
          <View style={[fm.pagerDot, sceneIdx === 1 && fm.pagerDotActive]} />
        </View>

        {/* ── Section 5: Future Snapshots ── */}
        <MirrorSectionLabel>MOMENTS WAITING AHEAD</MirrorSectionLabel>
        <View style={{ gap: 12, marginBottom: 8 }}>
          {(result.futureSnapshots ?? []).map((snap: FutureMirrorSnapshot, i: number) => (
            <View key={i} style={fm.snapshotCard}>
              <Text style={fm.snapshotEmoji}>{SNAPSHOT_EMOJI[snap.title] ?? '✨'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={fm.snapshotTitle}>{snap.title}</Text>
                <Text style={fm.snapshotScene}>{snap.scene}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Section 6: Trajectory Drivers ── */}
        {(result.trajectoryDrivers ?? []).length > 0 && (
          <>
            <MirrorSectionLabel>WHAT'S SHAPING YOUR FUTURE</MirrorSectionLabel>
            <View style={fm.driverWrap}>
              {result.trajectoryDrivers.map((d, i) => (
                <View key={i} style={fm.driverChip}>
                  <Text style={fm.driverChipText}>{d}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Section 7: Birthday Checkpoint ── */}
        {!!result.birthdayCheckpoint && (
          <View style={fm.checkpointBlock}>
            <View style={fm.checkpointRule} />
            <Text style={fm.checkpointText}>{result.birthdayCheckpoint}</Text>
            <View style={fm.checkpointRule} />
          </View>
        )}

        {/* ── Section 8: Subscription teaser ── */}
        <View style={fm.subCard}>
          <Text style={fm.subEyebrow}>THE MIRROR CHANGES EVERY WEEK</Text>
          <Text style={fm.subHeadline}>The future isn't fixed. The mirror updates as your actions do.</Text>
          <View style={{ gap: 10, marginTop: 16 }}>
            {[
              'Weekly Future Mirror updates',
              'Track identity shifts over time',
              'Watch your trajectory change',
              'Compare past and future versions of yourself',
              'Unlock deeper future projections',
            ].map((b, i) => (
              <View key={i} style={fm.subRow}>
                <View style={fm.subDot} />
                <Text style={fm.subRowText}>{b}</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>

      <SafeAreaView edges={['bottom']} style={{ backgroundColor: W.dark }}>
        <View style={{ paddingHorizontal: 22, paddingBottom: 12, paddingTop: 10 }}>
          <TouchableOpacity style={fm.cta} onPress={onNext} activeOpacity={0.85}>
            <Text style={fm.ctaText}>SEE WHO YOU'RE BECOMING  →</Text>
          </TouchableOpacity>
          {!!result.trajectoryQuestion && (
            <Text style={fm.trajectoryQuestion}>{result.trajectoryQuestion}</Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const fm = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: W.dark },
  topRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 14 },
  backBtn:  { width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  dotsRow:  { flex: 1, flexDirection: 'row', gap: 4 },
  dot:      { flex: 1, height: 3, borderRadius: 2 },
  dotDone:  { backgroundColor: W.hype },
  dotPending: { backgroundColor: 'rgba(255,255,255,0.12)' },
  scroll:   { paddingHorizontal: 22, paddingTop: 4, paddingBottom: 28 },

  screenTitle: { color: '#FFFFFF', fontSize: 15, letterSpacing: 1, fontFamily: 'SpaceGrotesk_700Bold' },
  screenSub:   { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4, marginBottom: 22, fontFamily: 'Inter_400Regular' },

  // Hero
  heroWrap:  { position: 'relative', marginBottom: 34 },
  heroGlow:  {
    position: 'absolute', top: -30, left: '15%', right: '15%', height: 160,
    borderRadius: 999, backgroundColor: W.hype, opacity: 0.14,
  },
  heroCard: {
    borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 24, paddingVertical: 36, alignItems: 'center',
  },
  heroHeadline: {
    color: '#FFFFFF', fontSize: 28, lineHeight: 34, textAlign: 'center',
    fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: -0.3,
  },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18 },
  confidenceDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: W.hype },
  confidenceText: { color: 'rgba(255,255,255,0.55)', fontSize: 12.5, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },

  sectionLabel: { color: W.hype, fontSize: 10, letterSpacing: 2, fontFamily: 'Inter_700Bold', marginBottom: 12, marginTop: 8 },

  // Identity
  identityCard: {
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)', padding: 20, marginBottom: 10,
  },
  identityText: { color: '#FFFFFF', fontSize: 18, lineHeight: 26, fontFamily: 'SpaceGrotesk_500Medium' },
  identityCardEmerging: { backgroundColor: 'rgba(184,242,58,0.06)', borderColor: 'rgba(184,242,58,0.22)', marginBottom: 24 },
  emergingLabel: { color: W.hype, fontSize: 9, letterSpacing: 1.5, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  identityTextEmerging: { color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 22, fontFamily: 'Inter_500Medium' },

  // Hidden cost
  costBlock:  { paddingVertical: 4, marginBottom: 28 },
  costText:   { color: '#FFFFFF', fontSize: 17, lineHeight: 27, fontFamily: 'Inter_500Medium' },
  negotiationText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', marginTop: 14 },

  // Future scenes
  scene:    { borderWidth: 1.5, borderRadius: 20, padding: 22, justifyContent: 'center', minHeight: 180 },
  sceneNegative: { backgroundColor: '#1E1414', borderColor: 'rgba(232,74,74,0.3)' },
  scenePositive: { backgroundColor: '#131C16', borderColor: 'rgba(34,166,100,0.3)' },
  sceneLabel: { color: W.bad, fontSize: 10, letterSpacing: 1.5, fontFamily: 'Inter_900Black', marginBottom: 12 },
  sceneText:  { color: '#FFFFFF', fontSize: 15.5, lineHeight: 23, fontFamily: 'Inter_500Medium' },
  pagerRow:   { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12, marginBottom: 30 },
  pagerDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
  pagerDotActive: { backgroundColor: W.hype, width: 16 },

  // Snapshots
  snapshotCard: {
    flexDirection: 'row', gap: 14, alignItems: 'flex-start',
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)', padding: 16,
  },
  snapshotEmoji: { fontSize: 22, marginTop: 2 },
  snapshotTitle: { color: W.hype, fontSize: 11, letterSpacing: 1, fontFamily: 'Inter_800ExtraBold', marginBottom: 5 },
  snapshotScene: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular' },

  // Trajectory drivers
  driverWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 },
  driverChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.05)',
  },
  driverChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontFamily: 'Inter_500Medium' },

  // Birthday checkpoint
  checkpointBlock: { alignItems: 'center', paddingVertical: 38, gap: 20 },
  checkpointRule:  { width: 32, height: 1, backgroundColor: 'rgba(255,255,255,0.18)' },
  checkpointText:  { color: '#FFFFFF', fontSize: 21, lineHeight: 30, textAlign: 'center', fontFamily: 'SpaceGrotesk_700Bold', maxWidth: 300 },

  // Subscription teaser
  subCard: {
    borderRadius: 22, borderWidth: 1, borderColor: 'rgba(184,242,58,0.25)',
    backgroundColor: 'rgba(184,242,58,0.05)', padding: 22, marginTop: 6,
  },
  subEyebrow:  { color: W.hype, fontSize: 10, letterSpacing: 1.5, fontFamily: 'Inter_700Bold', marginBottom: 10 },
  subHeadline: { color: '#FFFFFF', fontSize: 17, lineHeight: 24, fontFamily: 'SpaceGrotesk_600SemiBold' },
  subRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  subDot:      { width: 5, height: 5, borderRadius: 2.5, backgroundColor: W.hype, marginTop: 7 },
  subRowText:  { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 13.5, lineHeight: 19, fontFamily: 'Inter_400Regular' },

  // CTA
  cta:     { backgroundColor: W.hype, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  ctaText: { color: W.ink, fontSize: 13.5, letterSpacing: 1.5, fontFamily: 'SpaceGrotesk_700Bold' },
  trajectoryQuestion: {
    color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center', fontStyle: 'italic',
    marginTop: 12, fontFamily: 'Inter_400Regular',
  },
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
      <Title eyebrow="COACHING STYLE · DAILY RHYTHM" title="When can you spare 60 seconds?" sub="That's when we'll nudge you to log. Be realistic." />
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
      <Title eyebrow="COACHING STYLE" title="How should we talk to you?" sub="Change anytime in settings." />
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
          <Text style={[s10.stepNum, { color: 'rgba(255,255,255,0.5)', fontFamily: 'SpaceGrotesk_500Medium' }]}>FINAL</Text>
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
  title: { fontSize: 30, letterSpacing: -1, lineHeight: 34 },
  sub: { fontSize: 15, marginTop: 12, lineHeight: 22 },
});


// ── Main export ──────────────────────────────────────────
export default function OnboardingScreen() {
  const { completeOnboarding, signup, login, user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.name ?? '');

  // Birthday
  const now = new Date();
  const [dobDay, setDobDay] = useState(1);
  const [dobMonth, setDobMonth] = useState(1);
  const [dobYear, setDobYear] = useState(now.getFullYear() - 25);

  // Desired outcomes / pain points / blockers / reflection
  const [desiredOutcomes, setDesiredOutcomes] = useState<string[]>([]);
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [disappointment, setDisappointment] = useState('');

  // Current reality
  const [height, setHeight] = useState(175);
  const [weight, setWeight] = useState(75);
  const [sleepSchedule, setSleepSchedule] = useState('');
  const [activityLevel, setActivityLevel] = useState('');

  // Positive / negative habits (free-form, distinct from the preset Build/Break pickers)
  const [positiveHabits, setPositiveHabits] = useState<string[]>([]);
  const [negativeHabits, setNegativeHabits] = useState<string[]>([]);

  // Consent gate (shown right before the Future Mirror AI call)
  const [consentAgreed, setConsentAgreed] = useState(false);

  // Future Mirror
  const [mirrorResult, setMirrorResult] = useState<FutureMirrorResult | null>(null);
  const [mirrorLoading, setMirrorLoading] = useState(false);
  const [mirrorError, setMirrorError] = useState(false);
  const mirrorRequested = useRef(false);

  // No longer asked directly (superseded by pain points / reflection) — the
  // backend still requires a value, so default to a neutral midpoint.
  const baseline = 5;
  // Recommendations the user opts into
  const [buildHabits, setBuildHabits]           = useState<string[]>([]);
  const [breakHabits, setBreakHabits]           = useState<string[]>([]);
  const [pickedChallenges, setPickedChallenges] = useState<string[]>([]);
  const [logTime, setLogTime] = useState('evening');
  const [tone, setTone] = useState('bal');

  // Credentials only collected on the final screen when the user isn't logged in yet
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  const needsCredentials = !user;

  const next = () => setStep(s => s + 1);
  const back = () => setStep(s => Math.max(0, s - 1));

  function toggleIn(list: string[], setList: (v: string[]) => void, item: string, max?: number) {
    if (list.includes(item)) { setList(list.filter(x => x !== item)); return; }
    if (max && list.length >= max) return;
    setList([...list, item]);
  }
  function toggleBuildHabit(id: string) {
    setBuildHabits(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }
  function toggleBreakHabit(id: string) {
    setBreakHabits(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }
  function toggleChallenge(title: string) {
    setPickedChallenges(p => p.includes(title) ? p.filter(x => x !== title) : [...p, title]);
  }

  const FUTURE_MIRROR_STEP = 11; // one after the consent gate
  async function runFutureMirror() {
    if (mirrorRequested.current) return;
    mirrorRequested.current = true;
    setMirrorLoading(true);
    setMirrorError(false);
    try {
      const result = await futureMirrorApi.generate({
        name: name.trim() || undefined,
        age: calcAge(dobDay, dobMonth, dobYear),
        daysUntilBirthday: daysUntilNextBirthday(dobDay, dobMonth),
        desiredOutcomes, painPoints, blockers,
        disappointmentStatement: disappointment.trim() || undefined,
        positiveHabits, negativeHabits,
        heightCm: height, weightKg: weight,
        sleepSchedule: sleepSchedule || undefined,
        activityLevel: activityLevel || undefined,
      });
      setMirrorResult(result);
    } catch {
      setMirrorError(true);
    } finally {
      setMirrorLoading(false);
    }
  }

  useEffect(() => {
    if (step === FUTURE_MIRROR_STEP) runFutureMirror();
  }, [step]);

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

      const dob = `${dobYear}-${String(dobMonth).padStart(2, '0')}-${String(dobDay).padStart(2, '0')}`;

      await completeOnboarding({
        name: name.trim() || undefined,
        age: calcAge(dobDay, dobMonth, dobYear),
        heightCm: height,
        weightKg: weight,
        goals: [],
        baselineSelfRating: baseline,
        starterHabits,
        starterChallenges: pickedChallenges,
        dailyNudgeTime: logTime as 'morning' | 'midday' | 'evening' | 'before_bed',
        coachingTone: tone as 'soft' | 'bal' | 'hard',
        notificationsEnabled: true,
        dateOfBirth: dob,
        desiredOutcomes, painPoints, blockers,
        disappointmentStatement: disappointment.trim() || undefined,
        positiveHabits, negativeHabits,
        sleepSchedule: sleepSchedule || undefined,
        activityLevel: activityLevel || undefined,
        futureMirror: mirrorResult ?? undefined,
      }, freshToken);

      router.replace('/first-win' as any);
    } catch (err: any) {
      Alert.alert('Could not finish setup', err?.message ?? 'Try again.');
      setSubmitting(false);
    }
  }

  // Flow order: understand the person (why they need change) before asking
  // them to pick habits (how they'll change) — the Future Mirror sits between
  // the two so there's emotional investment before the habit-picking screens.
  const flow: React.ReactElement[] = [
    <S1_Welcome
      key="ob1"
      onNext={next}
      showSignIn={!user}
      onSignIn={() => router.push('/(auth)/login' as any)}
    />,
    <S2_Name key="ob2" value={name} onChange={setName} onNext={next} onBack={back} />,
    <S_Birthday
      key="ob_birthday"
      day={dobDay} month={dobMonth} year={dobYear}
      onDay={setDobDay} onMonth={setDobMonth} onYear={setDobYear}
      onNext={next} onBack={back}
    />,
    <S_GroupedMultiSelect
      key="ob_outcomes"
      eyebrow="WHAT YOU WANT"
      title="What would you like to change before your next birthday?"
      sub="Pick up to 5."
      groups={DESIRED_OUTCOME_GROUPS}
      selected={desiredOutcomes}
      onToggle={(o) => toggleIn(desiredOutcomes, setDesiredOutcomes, o, 5)}
      max={5}
      onNext={next} onBack={back}
    />,
    <S_GroupedMultiSelect
      key="ob_pain"
      eyebrow="BE HONEST"
      title="What's hurting the most right now?"
      sub="This matters even more than what's blocking you. Pick up to 3."
      groups={PAIN_POINT_GROUPS}
      selected={painPoints}
      onToggle={(o) => toggleIn(painPoints, setPainPoints, o, 3)}
      max={3}
      onNext={next} onBack={back}
    />,
    <S_GroupedMultiSelect
      key="ob_blockers"
      eyebrow="THE REAL REASON"
      title="What's stopping you today?"
      sub="Pick up to 3."
      groups={BLOCKER_GROUPS}
      selected={blockers}
      onToggle={(o) => toggleIn(blockers, setBlockers, o, 3)}
      max={3}
      onNext={next} onBack={back}
    />,
    <S_Reflection
      key="ob_reflection"
      value={disappointment}
      onChange={setDisappointment}
      onNext={next} onBack={back}
    />,
    <S3_Body
      key="ob_body"
      height={height} weight={weight}
      sleepSchedule={sleepSchedule} activityLevel={activityLevel}
      onHeight={setHeight} onWeight={setWeight}
      onSleep={setSleepSchedule} onActivity={setActivityLevel}
      onNext={next} onBack={back}
    />,
    <S_GroupedMultiSelect
      key="ob_positive"
      eyebrow="WHAT'S WORKING"
      title="Which habits are already helping you?"
      groups={POSITIVE_HABIT_GROUPS}
      selected={positiveHabits}
      onToggle={(o) => toggleIn(positiveHabits, setPositiveHabits, o)}
      onNext={next} onBack={back}
    />,
    <S_GroupedMultiSelect
      key="ob_negative"
      eyebrow="WHAT'S HOLDING YOU BACK"
      title="Which habits are holding you back?"
      groups={NEGATIVE_HABIT_GROUPS}
      selected={negativeHabits}
      onToggle={(o) => toggleIn(negativeHabits, setNegativeHabits, o)}
      onNext={next} onBack={back}
    />,
    <S_Consent
      key="ob_consent"
      agreed={consentAgreed}
      onToggleAgree={() => setConsentAgreed(a => !a)}
      onOpenPrivacy={() => router.push('/privacy-policy' as any)}
      onNext={next} onBack={back}
    />,
    <S_FutureMirror
      key="ob_mirror"
      loading={mirrorLoading}
      error={mirrorError}
      result={mirrorResult}
      onNext={next} onBack={back}
    />,
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
    <S9_Tone key="ob_tone" selected={tone} onSelect={setTone} onNext={next} onBack={back} />,
    <S8_Time key="ob_time" selected={logTime} onSelect={setLogTime} onNext={next} onBack={back} />,
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
