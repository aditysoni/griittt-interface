// 10-step Warm Coach onboarding flow.
// Single component, internal step state. Not yet wired to the backend —
// every "continue" just advances `step`; OB10 "I'M IN" routes to /(tabs).
//
// Step order:
//   0  OB1  Welcome      (dark hero)
//   1  OB2  Name         (text input)
//   2  OB3  Body         (age / height / weight steppers)
//   3  OB4  Why          (multi-select chips)
//   4  OB5  Baseline     (1-10 slider)
//   5  OB6  Priority     (mode picker)
//   6  OB7  Habits       (pick 3+)
//   7  OB8  Time         (4 time-of-day cards)
//   8  OB9  Tone         (3 cards + preview)
//   9  OB10 Commit       (dark pact)

import React, { useState } from 'react';
import {
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// ── Warm Coach palette — fixed colors for the onboarding flow ────────────────
// These are intentionally NOT theme-aware. The onboarding has a designed look
// (cream canvas, lime hype) that stays consistent regardless of the user's
// app-wide theme preference.
const A = {
  bg:    '#F5F1E8',
  card:  '#FFFFFF',
  ink:   '#14110D',
  ink2:  '#5C544A',
  ink3:  '#A39B8E',
  rule:  '#E8E0CE',
  rest:  '#EFE8D7',
  hype:  '#B8F23A',
  good:  '#22A664',
  warn:  '#F0A12E',
  bad:   '#E84A4A',
};
const DARK = {
  bg:    '#14110D',
  card:  'rgba(255,255,255,0.04)',
  ink:   '#FFFFFF',
  ink2:  'rgba(255,255,255,0.7)',
  ink3:  'rgba(255,255,255,0.5)',
  rule:  'rgba(255,255,255,0.12)',
};

const TOTAL = 10;

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Collected answers — held in one object, ready to POST when backend hooks in.
  const [data, setData] = useState({
    name: 'Alex',
    age: 28,
    heightFt: 5,
    heightIn: 10,
    weightLbs: 178,
    why: new Set<string>(['build', 'strong', 'sharp']),
    baseline: 4,
    priority: 'disc' as 'disc' | 'fuel' | 'phys',
    habits: new Set<string>(['Cold shower', 'No sugar', 'Read 30 min']),
    time: 2, // 0..3
    tone: 'bal' as 'soft' | 'bal' | 'hard',
  });
  const update = (patch: Partial<typeof data>) => setData(d => ({ ...d, ...patch }));

  const next = () => setStep(s => Math.min(TOTAL - 1, s + 1));
  const back = () => setStep(s => Math.max(0, s - 1));
  const done = () => router.replace('/(tabs)');

  switch (step) {
    case 0: return <OB1_Welcome onNext={next} />;
    case 1: return <OB2_Name value={data.name} onChange={n => update({ name: n })} step={1} onNext={next} onBack={back} />;
    case 2: return <OB3_Body data={data} update={update} step={2} onNext={next} onBack={back} />;
    case 3: return <OB4_Why selected={data.why} toggle={k => {
      const w = new Set(data.why); w.has(k) ? w.delete(k) : w.add(k); update({ why: w });
    }} step={3} onNext={next} onBack={back} />;
    case 4: return <OB5_Baseline value={data.baseline} onChange={v => update({ baseline: v })} step={4} onNext={next} onBack={back} />;
    case 5: return <OB6_Priority value={data.priority} onChange={p => update({ priority: p })} step={5} onNext={next} onBack={back} />;
    case 6: return <OB7_Habits selected={data.habits} toggle={k => {
      const h = new Set(data.habits); h.has(k) ? h.delete(k) : h.add(k); update({ habits: h });
    }} step={6} onNext={next} onBack={back} />;
    case 7: return <OB8_Time value={data.time} onChange={t => update({ time: t })} step={7} onNext={next} onBack={back} />;
    case 8: return <OB9_Tone value={data.tone} onChange={t => update({ tone: t })} step={8} onNext={next} onBack={back} />;
    case 9: return <OB10_Commit name={data.name} onDone={done} onBack={back} />;
  }
  return null;
}

// ── Shared shell — top progress + body + sticky CTA ──────────────────────────

function OBShell({
  step, total = TOTAL, children, cta, ctaDisabled, onNext, onBack,
}: {
  step: number;
  total?: number;
  children: React.ReactNode;
  cta?: string;
  ctaDisabled?: boolean;
  onNext?: () => void;
  onBack?: () => void;
}) {
  return (
    <SafeAreaView style={[sh.safe, { backgroundColor: A.bg }]} edges={['top', 'bottom']}>
      {/* Top: back + segmented progress + step counter */}
      <View style={sh.topRow}>
        {onBack ? (
          <TouchableOpacity style={[sh.iconBtn, { borderColor: A.rule }]} onPress={onBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={16} color={A.ink2} />
          </TouchableOpacity>
        ) : <View style={sh.iconBtn} />}

        <View style={sh.progressTrack}>
          {Array.from({ length: total }).map((_, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <View key={i} style={[
                sh.progressSeg,
                done   && { flex: 1, height: 4, backgroundColor: A.ink },
                current && { width: 6, height: 6, borderRadius: 3, backgroundColor: A.ink },
                !done && !current && { width: 6, height: 6, borderRadius: 3, backgroundColor: A.rule },
              ]} />
            );
          })}
        </View>

        <Text style={[sh.stepCount, { color: A.ink3 }]}>{step}/{total}</Text>
      </View>

      {/* Body */}
      <ScrollView
        contentContainerStyle={sh.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      {/* Sticky CTA */}
      {cta && (
        <View style={sh.ctaWrap}>
          <TouchableOpacity
            style={[sh.cta, ctaDisabled ? { backgroundColor: A.rest } : { backgroundColor: A.ink }]}
            onPress={ctaDisabled ? undefined : onNext}
            activeOpacity={ctaDisabled ? 1 : 0.85}
            disabled={ctaDisabled}
          >
            <Text style={[sh.ctaText, { color: ctaDisabled ? A.ink3 : '#fff' }]}>{cta}</Text>
            <Ionicons name="arrow-forward" size={16} color={ctaDisabled ? A.ink3 : '#fff'} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function OBTitle({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <View style={{ marginBottom: 28 }}>
      {!!eyebrow && (
        <Text style={[oblTitle.eyebrow, { color: A.ink3 }]}>{eyebrow}</Text>
      )}
      <Text style={[oblTitle.title, { color: A.ink }]}>{title}</Text>
      {!!sub && (
        <Text style={[oblTitle.sub, { color: A.ink2 }]}>{sub}</Text>
      )}
    </View>
  );
}

const oblTitle = StyleSheet.create({
  eyebrow: { fontSize: 11, letterSpacing: 1.5, fontFamily: 'Inter_700Bold', marginBottom: 10 },
  title:   { fontSize: 32, letterSpacing: -0.5, lineHeight: 36, fontFamily: 'Inter_900Black' },
  sub:     { fontSize: 15, lineHeight: 22, marginTop: 12, fontFamily: 'Inter_400Regular', maxWidth: 320 },
});

// ── OB1 · Welcome (dark hero) ────────────────────────────────────────────────

function OB1_Welcome({ onNext }: { onNext: () => void }) {
  return (
    <SafeAreaView style={[sh.safe, { backgroundColor: DARK.bg }]} edges={['top', 'bottom']}>
      <View style={ob1.wrap}>
        {/* Geometric motif */}
        <View style={[ob1.ring, { borderColor: A.hype }]} />
        <View style={[ob1.disc, { backgroundColor: A.hype }]} />

        <View style={{ flex: 1 }} />

        <Text style={[ob1.eyebrow, { color: A.hype }]}>WELCOME TO GRITTT</Text>
        <Text style={[ob1.title, { color: DARK.ink }]}>
          The day{'\n'}belongs{'\n'}to you.
        </Text>
        <Text style={[ob1.sub, { color: DARK.ink2 }]}>
          One score. Every day. Built from your habits, your fuel, your sweat. Let's set you up in 60 seconds.
        </Text>

        <View style={{ flex: 1 }} />
      </View>

      <View style={sh.ctaWrap}>
        <TouchableOpacity
          style={[sh.cta, { backgroundColor: A.hype }]}
          onPress={onNext}
          activeOpacity={0.85}
        >
          <Text style={[sh.ctaText, { color: A.ink }]}>LET'S GO</Text>
          <Ionicons name="arrow-forward" size={16} color={A.ink} />
        </TouchableOpacity>
        <Text style={[ob1.signin, { color: DARK.ink3 }]}>
          Already signed up?{' '}
          <Text style={{ color: A.hype, fontFamily: 'Inter_700Bold' }}>Sign in</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const ob1 = StyleSheet.create({
  wrap:    { flex: 1, paddingHorizontal: 26, paddingTop: 60, position: 'relative' },
  ring:    { position: 'absolute', top: 70, right: 26, width: 90, height: 90, borderRadius: 45, borderWidth: 1.5 },
  disc:    { position: 'absolute', top: 110, right: 60, width: 50, height: 50, borderRadius: 25 },
  eyebrow: { fontSize: 12, letterSpacing: 2, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  title:   { fontSize: 52, letterSpacing: -1.5, lineHeight: 52, fontFamily: 'Inter_900Black' },
  sub:     { fontSize: 16, lineHeight: 24, marginTop: 20, fontFamily: 'Inter_400Regular', maxWidth: 300 },
  signin:  { textAlign: 'center', marginTop: 14, fontSize: 13, fontFamily: 'Inter_500Medium' },
});

// ── OB2 · Name ───────────────────────────────────────────────────────────────

function OB2_Name({ value, onChange, step, onNext, onBack }: {
  value: string; onChange: (s: string) => void;
  step: number; onNext: () => void; onBack: () => void;
}) {
  return (
    <OBShell step={step} onNext={onNext} onBack={onBack} cta="CONTINUE" ctaDisabled={!value.trim()}>
      <OBTitle eyebrow="ABOUT YOU · 1 OF 4" title="WHAT SHOULD WE CALL YOU?" sub="Used for your daily coaching nudges." />
      <View style={[ob2.inputBox, { backgroundColor: A.card, borderColor: A.ink }]}>
        <TextInput
          style={[ob2.input, { color: A.ink }]}
          value={value}
          onChangeText={onChange}
          placeholder="Your name"
          placeholderTextColor={A.ink3}
          autoCapitalize="words"
          autoCorrect={false}
        />
      </View>
      <Text style={[ob2.hint, { color: A.ink3 }]}>
        Your real name or a callsign — your choice.
      </Text>
    </OBShell>
  );
}

const ob2 = StyleSheet.create({
  inputBox: { borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 18, paddingVertical: 16 },
  input:    { fontSize: 20, fontFamily: 'Inter_700Bold', padding: 0 },
  hint:     { fontSize: 12, marginTop: 10, fontFamily: 'Inter_500Medium' },
});

// ── OB3 · Body (age / height / weight) ───────────────────────────────────────

function OB3_Body({ data, update, step, onNext, onBack }: {
  data: any; update: (p: any) => void;
  step: number; onNext: () => void; onBack: () => void;
}) {
  return (
    <OBShell step={step} onNext={onNext} onBack={onBack} cta="CONTINUE">
      <OBTitle eyebrow="ABOUT YOU · 2 OF 4" title="THE BASICS." sub="So your fuel and strength scores actually mean something." />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Stepper
          label="AGE" unit="years" big
          value={data.age}
          onChange={v => update({ age: Math.max(13, Math.min(99, v)) })}
        />
        <View style={{ flex: 1, gap: 8 }}>
          <Stepper
            label="HEIGHT" unit="in"
            value={`${data.heightFt}'${data.heightIn}"`}
            onPlus={() => {
              let f = data.heightFt, i = data.heightIn + 1;
              if (i >= 12) { f++; i = 0; }
              update({ heightFt: f, heightIn: i });
            }}
            onMinus={() => {
              let f = data.heightFt, i = data.heightIn - 1;
              if (i < 0) { f--; i = 11; }
              if (f < 3) { f = 3; i = 0; }
              update({ heightFt: f, heightIn: i });
            }}
          />
          <Stepper
            label="WEIGHT" unit="lbs"
            value={data.weightLbs}
            onChange={v => update({ weightLbs: Math.max(50, Math.min(500, v)) })}
          />
        </View>
      </View>

      <View style={[ob3.info, { backgroundColor: A.rest }]}>
        <Ionicons name="information-circle-outline" size={16} color={A.ink2} />
        <Text style={[ob3.infoText, { color: A.ink2 }]}>
          We never share this. Switch to metric in settings later.
        </Text>
      </View>
    </OBShell>
  );
}

function Stepper({ label, unit, value, big, onChange, onPlus, onMinus }: {
  label: string; unit: string; value: string | number; big?: boolean;
  onChange?: (v: number) => void; onPlus?: () => void; onMinus?: () => void;
}) {
  const plus  = onPlus  ?? (() => typeof value === 'number' && onChange?.(value + 1));
  const minus = onMinus ?? (() => typeof value === 'number' && onChange?.(value - 1));
  return (
    <View style={[ob3.stepper, { backgroundColor: A.card, borderColor: A.rule }]}>
      <Text style={[ob3.stepLabel, { color: A.ink3 }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 10 }}>
        <Text style={[ob3.stepValue, { color: A.ink, fontSize: big ? 44 : 32 }]}>{value}</Text>
        <Text style={[ob3.stepUnit, { color: A.ink3 }]}>{unit}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
        <TouchableOpacity style={[ob3.stepBtn, { backgroundColor: A.rest }]} onPress={minus} activeOpacity={0.7}>
          <Text style={[ob3.stepBtnText, { color: A.ink }]}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[ob3.stepBtn, { backgroundColor: A.rest }]} onPress={plus} activeOpacity={0.7}>
          <Text style={[ob3.stepBtnText, { color: A.ink }]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ob3 = StyleSheet.create({
  stepper:    { flex: 1, padding: 18, borderRadius: 16, borderWidth: 1 },
  stepLabel:  { fontSize: 10, letterSpacing: 1.5, fontFamily: 'Inter_700Bold' },
  stepValue:  { fontFamily: 'Inter_900Black', letterSpacing: -1, lineHeight: 44 },
  stepUnit:   { fontSize: 12, fontFamily: 'Inter_700Bold' },
  stepBtn:    { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  stepBtnText:{ fontFamily: 'Inter_900Black', fontSize: 18 },
  info:       { marginTop: 16, padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText:   { flex: 1, fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_500Medium' },
});

// ── OB4 · Why (multi-select chips) ───────────────────────────────────────────

const WHY_OPTS = [
  { id: 'build',  label: 'Build new habits',        emoji: '🌱' },
  { id: 'break',  label: 'Break bad habits',        emoji: '✂️' },
  { id: 'strong', label: 'Get physically stronger', emoji: '💪' },
  { id: 'fuel',   label: 'Eat cleaner',             emoji: '🥗' },
  { id: 'lose',   label: 'Lose fat',                emoji: '⚖️' },
  { id: 'sharp',  label: 'Feel sharper mentally',   emoji: '🧠' },
  { id: 'sleep',  label: 'Sleep better',            emoji: '😴' },
  { id: 'else',   label: 'Just feel better',        emoji: '✨' },
];

function OB4_Why({ selected, toggle, step, onNext, onBack }: {
  selected: Set<string>; toggle: (id: string) => void;
  step: number; onNext: () => void; onBack: () => void;
}) {
  return (
    <OBShell step={step} onNext={onNext} onBack={onBack} cta="CONTINUE" ctaDisabled={selected.size === 0}>
      <OBTitle eyebrow="ABOUT YOU · 3 OF 4" title="WHY ARE YOU HERE?" sub="Pick all that apply. Shapes your coaching." />
      <View style={ob4.grid}>
        {WHY_OPTS.map(o => {
          const on = selected.has(o.id);
          return (
            <TouchableOpacity
              key={o.id}
              style={[ob4.chip, {
                backgroundColor: on ? A.ink : A.card,
                borderColor: on ? A.ink : A.rule,
              }]}
              onPress={() => toggle(o.id)}
              activeOpacity={0.85}
            >
              <Text style={ob4.chipEmoji}>{o.emoji}</Text>
              <Text style={[ob4.chipText, { color: on ? '#fff' : A.ink }]} numberOfLines={2}>
                {o.label}
              </Text>
              {on && (
                <View style={[ob4.tick, { backgroundColor: A.hype }]}>
                  <Ionicons name="checkmark" size={9} color={A.ink} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </OBShell>
  );
}

const ob4 = StyleSheet.create({
  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:    {
    width: '48%', minHeight: 64, borderWidth: 1.5, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 8, position: 'relative',
  },
  chipEmoji: { fontSize: 18 },
  chipText:  { flex: 1, fontSize: 13, fontFamily: 'Inter_700Bold', lineHeight: 16 },
  tick:    { position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});

// ── OB5 · Baseline (1-10 picker) ─────────────────────────────────────────────

function OB5_Baseline({ value, onChange, step, onNext, onBack }: {
  value: number; onChange: (v: number) => void;
  step: number; onNext: () => void; onBack: () => void;
}) {
  const pillFor = (v: number) => {
    if (v <= 3)  return { label: 'ROCK BOTTOM — TIME TO RESET', bg: '#FCE6E6', fg: A.bad };
    if (v <= 5)  return { label: 'DRIFTING — TIME TO RESET',    bg: '#FFF1DC', fg: A.warn };
    if (v <= 7)  return { label: 'BUILDING — KEEP STACKING',    bg: '#FFF7DC', fg: '#B8901A' };
    return         { label: 'DIALED IN — STAY SHARP',           bg: '#E2F7EC', fg: A.good };
  };
  const pill = pillFor(value);

  return (
    <OBShell step={step} onNext={onNext} onBack={onBack} cta="CONTINUE">
      <OBTitle eyebrow="ABOUT YOU · 4 OF 4" title="BE HONEST." sub="Where are you right now? 1 is rock bottom, 10 is dialed. No judgment." />

      <View style={ob5.numberWrap}>
        <Text style={[ob5.number, { color: A.ink }]}>
          {value}
          <Text style={[ob5.numberMax, { color: A.ink3 }]}>/10</Text>
        </Text>
        <View style={[ob5.statePill, { backgroundColor: pill.bg }]}>
          <Text style={[ob5.statePillText, { color: pill.fg }]}>{pill.label}</Text>
        </View>
      </View>

      <View style={{ marginTop: 30 }}>
        <View style={[ob5.scale, { backgroundColor: A.rest }]}>
          {Array.from({ length: 10 }).map((_, i) => {
            const n = i + 1;
            const on = n <= value;
            const color = n <= 3 ? A.bad : n <= 6 ? A.warn : A.good;
            return (
              <TouchableOpacity
                key={n}
                style={[ob5.scaleCell, on && { backgroundColor: color }]}
                onPress={() => onChange(n)}
                activeOpacity={0.7}
              >
                <Text style={[ob5.scaleNum, { color: on ? '#fff' : A.ink3 }]}>{n}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={ob5.scaleLabels}>
          <Text style={[ob5.scaleLabel, { color: A.ink3 }]}>ROCK BOTTOM</Text>
          <Text style={[ob5.scaleLabel, { color: A.ink3 }]}>DIALED IN</Text>
        </View>
      </View>
    </OBShell>
  );
}

const ob5 = StyleSheet.create({
  numberWrap:    { alignItems: 'center', paddingVertical: 12 },
  number:        { fontSize: 100, lineHeight: 100, letterSpacing: -3, fontFamily: 'Inter_900Black' },
  numberMax:     { fontSize: 28, fontFamily: 'Inter_700Bold' },
  statePill:     { marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  statePillText: { fontSize: 10, letterSpacing: 1.5, fontFamily: 'Inter_900Black' },
  scale:         { flexDirection: 'row', padding: 4, borderRadius: 14, gap: 4 },
  scaleCell:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10 },
  scaleNum:      { fontSize: 13, fontFamily: 'Inter_900Black' },
  scaleLabels:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  scaleLabel:    { fontSize: 10, letterSpacing: 1.5, fontFamily: 'Inter_700Bold' },
});

// ── OB6 · Priority mode ──────────────────────────────────────────────────────

const PRIORITY_MODES = [
  { id: 'disc', name: 'DISCIPLINE', sub: 'Build a bulletproof daily routine.' },
  { id: 'fuel', name: 'FUEL',       sub: 'Lock in clean eating. Body comp follows.' },
  { id: 'phys', name: 'STRENGTH',   sub: 'Move every day. Get visibly stronger.' },
] as const;

function OB6_Priority({ value, onChange, step, onNext, onBack }: {
  value: 'disc' | 'fuel' | 'phys'; onChange: (v: 'disc' | 'fuel' | 'phys') => void;
  step: number; onNext: () => void; onBack: () => void;
}) {
  return (
    <OBShell step={step} onNext={onNext} onBack={onBack} cta="CONTINUE">
      <OBTitle eyebrow="YOUR FOCUS" title="WHAT MATTERS MOST RIGHT NOW?" sub="We'll surface this mode first on your dashboard. Change anytime." />
      <View style={{ gap: 10 }}>
        {PRIORITY_MODES.map(m => {
          const on = value === m.id;
          return (
            <TouchableOpacity
              key={m.id}
              style={[ob6.card, {
                backgroundColor: on ? A.ink : A.card,
                borderColor: on ? A.ink : A.rule,
              }]}
              onPress={() => onChange(m.id)}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={[ob6.name, { color: on ? '#fff' : A.ink }]}>{m.name}</Text>
                <Text style={[ob6.sub, { color: on ? 'rgba(255,255,255,0.7)' : A.ink2 }]}>{m.sub}</Text>
              </View>
              <View style={[ob6.tick, {
                borderColor: on ? A.hype : A.rule,
                backgroundColor: on ? A.hype : 'transparent',
              }]}>
                {on && <Ionicons name="checkmark" size={12} color={A.ink} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </OBShell>
  );
}

const ob6 = StyleSheet.create({
  card: { padding: 18, borderRadius: 18, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontFamily: 'Inter_900Black', fontSize: 24, letterSpacing: -0.5, lineHeight: 24 },
  sub:  { fontFamily: 'Inter_500Medium', fontSize: 13, marginTop: 6, lineHeight: 18 },
  tick: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});

// ── OB7 · Habits (multi-select with min 3 hint) ──────────────────────────────

const HABIT_OPTS = [
  { name: 'Cold shower',      mins: '3 min' },
  { name: 'No sugar',         mins: 'all day' },
  { name: 'Walk 8,000 steps', mins: '60 min' },
  { name: 'Read 30 min',      mins: '30 min' },
  { name: 'No phone in bed',  mins: '—' },
  { name: 'Journal 1 page',   mins: '5 min' },
  { name: 'Meditate 10 min',  mins: '10 min' },
  { name: 'Strength workout', mins: '45 min' },
];

function OB7_Habits({ selected, toggle, step, onNext, onBack }: {
  selected: Set<string>; toggle: (k: string) => void;
  step: number; onNext: () => void; onBack: () => void;
}) {
  const cta = selected.size >= 3 ? `START WITH THESE ${selected.size}` : 'PICK AT LEAST 3';
  return (
    <OBShell step={step} onNext={onNext} onBack={onBack} cta={cta} ctaDisabled={selected.size < 3}>
      <OBTitle eyebrow="DISCIPLINE · STARTERS" title="PICK YOUR STARTER HABITS." sub="Small wins compound. You can add more once these stick." />
      <View style={{ gap: 8 }}>
        {HABIT_OPTS.map(h => {
          const on = selected.has(h.name);
          return (
            <TouchableOpacity
              key={h.name}
              style={[ob7.row, {
                backgroundColor: A.card,
                borderColor: on ? A.ink : A.rule,
              }]}
              onPress={() => toggle(h.name)}
              activeOpacity={0.85}
            >
              <View style={[ob7.box, {
                borderColor: on ? A.ink : A.rule,
                backgroundColor: on ? A.hype : 'transparent',
              }]}>
                {on && <Ionicons name="checkmark" size={12} color={A.ink} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[ob7.name, { color: A.ink }]}>{h.name}</Text>
                <Text style={[ob7.mins, { color: A.ink3 }]}>{h.mins}</Text>
              </View>
              <Text style={[ob7.pts, { color: on ? A.good : A.ink3 }]}>+5 PT</Text>
            </TouchableOpacity>
          );
        })}
        <View style={[ob7.row, ob7.addRow, { borderColor: A.ink3 }]}>
          <Text style={[ob7.addText, { color: A.ink2 }]}>+ Add your own</Text>
        </View>
      </View>
    </OBShell>
  );
}

const ob7 = StyleSheet.create({
  row:     { padding: 14, borderRadius: 14, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 12 },
  box:     { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  name:    { fontFamily: 'Inter_700Bold', fontSize: 15 },
  mins:    { fontFamily: 'Inter_700Bold', fontSize: 11.5, marginTop: 2 },
  pts:     { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 11, letterSpacing: 0.5 },
  addRow:  { borderStyle: 'dashed', justifyContent: 'center' },
  addText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
});

// ── OB8 · Time (4 cards) ─────────────────────────────────────────────────────

const TIME_OPTS = [
  { label: 'Morning',    emoji: '🌅', sub: '6–10 am' },
  { label: 'Midday',     emoji: '☀️', sub: '11 am–2 pm' },
  { label: 'Evening',    emoji: '🌆', sub: '5–8 pm' },
  { label: 'Before bed', emoji: '🌙', sub: '9–11 pm' },
];

function OB8_Time({ value, onChange, step, onNext, onBack }: {
  value: number; onChange: (n: number) => void;
  step: number; onNext: () => void; onBack: () => void;
}) {
  return (
    <OBShell step={step} onNext={onNext} onBack={onBack} cta="CONTINUE">
      <OBTitle eyebrow="DAILY RHYTHM" title="WHEN CAN YOU SPARE 60 SECONDS?" sub="That's when we'll nudge you to log. Be realistic." />
      <View style={ob8.grid}>
        {TIME_OPTS.map((t, i) => {
          const on = value === i;
          return (
            <TouchableOpacity
              key={t.label}
              style={[ob8.cell, {
                backgroundColor: on ? A.ink : A.card,
                borderColor: on ? A.ink : A.rule,
              }]}
              onPress={() => onChange(i)}
              activeOpacity={0.85}
            >
              <Text style={ob8.emoji}>{t.emoji}</Text>
              <View>
                <Text style={[ob8.name, { color: on ? '#fff' : A.ink }]}>{t.label}</Text>
                <Text style={[ob8.sub, { color: on ? 'rgba(255,255,255,0.6)' : A.ink3 }]}>{t.sub}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={[ob8.note, { backgroundColor: A.rest }]}>
        <Text style={[ob8.noteText, { color: A.ink2 }]}>
          We'll remind you once. Miss it? No big deal — log when you can. The streak only cares that you logged.
        </Text>
      </View>
    </OBShell>
  );
}

const ob8 = StyleSheet.create({
  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell:    { width: '48%', minHeight: 110, padding: 18, borderRadius: 16, borderWidth: 1.5, justifyContent: 'space-between' },
  emoji:   { fontSize: 28 },
  name:    { fontFamily: 'Inter_900Black', fontSize: 17 },
  sub:     { fontFamily: 'Inter_700Bold', fontSize: 11.5, marginTop: 2 },
  note:    { marginTop: 16, padding: 14, borderRadius: 12 },
  noteText:{ fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_500Medium' },
});

// ── OB9 · Tone (3 cards + preview nudge) ─────────────────────────────────────

const TONE_OPTS = [
  { id: 'soft', label: 'Encouraging', sub: 'A gentle push. Cheer the wins.', emoji: '🤗', sample: '"Nice work logging today. Tomorrow we go again — you got this."' },
  { id: 'bal',  label: 'Balanced',    sub: 'Honest. Hype the wins, name the misses.', emoji: '⚖️', sample: '"Two days clean on cold showers. Don\'t break it now — same time tomorrow."' },
  { id: 'hard', label: 'No mercy',    sub: 'Goggins energy. Call out every slip.', emoji: '🔥', sample: '"You said you\'d show up. You didn\'t. Excuses don\'t build identity — discipline does."' },
] as const;

function OB9_Tone({ value, onChange, step, onNext, onBack }: {
  value: 'soft' | 'bal' | 'hard'; onChange: (v: 'soft' | 'bal' | 'hard') => void;
  step: number; onNext: () => void; onBack: () => void;
}) {
  const sample = TONE_OPTS.find(t => t.id === value)?.sample ?? '';
  return (
    <OBShell step={step} onNext={onNext} onBack={onBack} cta="CONTINUE">
      <OBTitle eyebrow="COACHING" title="HOW SHOULD WE TALK TO YOU?" sub="Change anytime in settings." />
      <View style={{ gap: 10 }}>
        {TONE_OPTS.map(t => {
          const on = value === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[ob9.card, {
                backgroundColor: on ? '#FFFBEC' : A.card,
                borderColor: on ? A.ink : A.rule,
              }]}
              onPress={() => onChange(t.id)}
              activeOpacity={0.85}
            >
              <View style={[ob9.iconWrap, { backgroundColor: A.rest }]}>
                <Text style={ob9.emoji}>{t.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[ob9.label, { color: A.ink }]}>{t.label}</Text>
                <Text style={[ob9.sub, { color: A.ink2 }]}>{t.sub}</Text>
              </View>
              <View style={[ob9.radio, { borderColor: on ? A.ink : A.rule, backgroundColor: on ? A.ink : 'transparent' }]}>
                {on && <View style={[ob9.radioDot, { backgroundColor: A.hype }]} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Sample nudge preview */}
      <View style={[ob9.preview, { backgroundColor: A.ink }]}>
        <Text style={[ob9.previewEyebrow, { color: A.hype }]}>SAMPLE NUDGE</Text>
        <Text style={[ob9.previewBody, { color: '#fff' }]}>{sample}</Text>
      </View>
    </OBShell>
  );
}

const ob9 = StyleSheet.create({
  card:    { padding: 16, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap:{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emoji:   { fontSize: 22 },
  label:   { fontFamily: 'Inter_900Black', fontSize: 17 },
  sub:     { fontFamily: 'Inter_500Medium', fontSize: 12.5, marginTop: 2, lineHeight: 18 },
  radio:   { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot:{ width: 8, height: 8, borderRadius: 4 },
  preview: { marginTop: 16, padding: 16, borderRadius: 14 },
  previewEyebrow: { fontSize: 10, letterSpacing: 1.5, fontFamily: 'Inter_700Bold' },
  previewBody:    { fontFamily: 'Inter_900Black', fontSize: 16, marginTop: 8, lineHeight: 22 },
});

// ── OB10 · Commit (dark pact) ────────────────────────────────────────────────

function OB10_Commit({ name, onDone, onBack }: {
  name: string; onDone: () => void; onBack: () => void;
}) {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
  const [notif, setNotif] = useState(true);

  return (
    <SafeAreaView style={[sh.safe, { backgroundColor: DARK.bg }]} edges={['top', 'bottom']}>
      {/* Top: back + full lime progress + 10/10 */}
      <View style={sh.topRow}>
        <TouchableOpacity style={[sh.iconBtn, { borderColor: DARK.rule }]} onPress={onBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={16} color={DARK.ink2} />
        </TouchableOpacity>
        <View style={[ob10.progressFull, { backgroundColor: A.hype }]} />
        <Text style={[sh.stepCount, { color: DARK.ink3 }]}>10/10</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
        <Text style={[ob10.eyebrow, { color: A.hype }]}>SIGN THE PACT</Text>
        <Text style={[ob10.title, { color: '#fff' }]}>
          Today.{'\n'}Tomorrow.{'\n'}
          <Text style={{ color: A.hype }}>Every day.</Text>
        </Text>
        <Text style={[ob10.sub, { color: DARK.ink2 }]}>
          You'll get one daily nudge. Log in under a minute. Watch your score build.
        </Text>

        {/* Pact */}
        <View style={[ob10.pact, { borderColor: DARK.rule, backgroundColor: DARK.card }]}>
          <Text style={[ob10.pactEyebrow, { color: DARK.ink3 }]}>
            I, {name.toUpperCase()}, COMMIT TO:
          </Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {[
              'Logging every day for 30 days.',
              'Building 3 daily habits.',
              'Being honest about my food and effort.',
            ].map((t, i) => (
              <View key={i} style={ob10.pactRow}>
                <View style={[ob10.pactTick, { backgroundColor: A.hype }]}>
                  <Ionicons name="checkmark" size={11} color={A.ink} />
                </View>
                <Text style={[ob10.pactItem, { color: '#fff' }]}>{t}</Text>
              </View>
            ))}
          </View>

          {/* Signature line */}
          <View style={[ob10.sigDivider, { borderTopColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={[ob10.sig, { color: A.hype }]}>{name}</Text>
            <Text style={[ob10.sigCap, { color: DARK.ink3 }]}>
              SIGNATURE · {today}
            </Text>
          </View>
        </View>

        {/* Notification toggle */}
        <Pressable
          style={[ob10.notif, { backgroundColor: DARK.card }]}
          onPress={() => setNotif(n => !n)}
        >
          <Ionicons name="notifications-outline" size={18} color={A.hype} />
          <Text style={[ob10.notifText, { color: 'rgba(255,255,255,0.8)' }]}>Daily nudge at 6 PM.</Text>
          <View style={[ob10.switch, { backgroundColor: notif ? A.hype : DARK.rule }]}>
            <View style={[ob10.switchKnob, {
              backgroundColor: notif ? A.ink : 'rgba(255,255,255,0.4)',
              alignSelf: notif ? 'flex-end' : 'flex-start',
            }]} />
          </View>
        </Pressable>
      </ScrollView>

      <View style={sh.ctaWrap}>
        <TouchableOpacity
          style={[sh.cta, { backgroundColor: A.hype }]}
          onPress={onDone}
          activeOpacity={0.85}
        >
          <Text style={[sh.ctaText, { color: A.ink }]}>I'M IN</Text>
          <Ionicons name="arrow-forward" size={16} color={A.ink} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const ob10 = StyleSheet.create({
  progressFull: { flex: 1, height: 4, borderRadius: 2 },
  eyebrow:      { fontSize: 12, letterSpacing: 2, fontFamily: 'Inter_700Bold', marginBottom: 12, marginTop: 16 },
  title:        { fontSize: 42, letterSpacing: -1.5, lineHeight: 44, fontFamily: 'Inter_900Black' },
  sub:          { fontSize: 15, lineHeight: 22, marginTop: 14, fontFamily: 'Inter_400Regular' },
  pact:         { marginTop: 26, padding: 20, borderRadius: 16, borderWidth: 1 },
  pactEyebrow:  { fontSize: 10, letterSpacing: 1.5, fontFamily: 'Inter_700Bold' },
  pactRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  pactTick:     { width: 20, height: 20, borderRadius: 5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  pactItem:     { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium' },
  sigDivider:   { marginTop: 18, borderTopWidth: 1, borderStyle: 'dashed', paddingTop: 12 },
  sig:          { fontSize: 32, fontFamily: 'Inter_900Black', fontStyle: 'italic', letterSpacing: 0.5 },
  sigCap:       { fontSize: 11, letterSpacing: 1.5, fontFamily: 'Inter_700Bold', marginTop: 4 },
  notif:        { marginTop: 14, padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifText:    { flex: 1, fontSize: 12.5, fontFamily: 'Inter_500Medium' },
  switch:       { width: 38, height: 22, borderRadius: 11, padding: 2, justifyContent: 'center' },
  switchKnob:   { width: 18, height: 18, borderRadius: 9 },
});

// ── Shared shell styles ──────────────────────────────────────────────────────

const sh = StyleSheet.create({
  safe:         { flex: 1 },
  topRow:       { paddingHorizontal: 22, paddingTop: 4, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBtn:      { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  progressTrack:{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  progressSeg:  { borderRadius: 3 },
  stepCount:    { width: 36, textAlign: 'right', fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold' },
  body:         { paddingHorizontal: 22, paddingBottom: 24 },
  ctaWrap:      { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 8 },
  cta:          { paddingVertical: 17, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText:      { fontSize: 14, letterSpacing: 2.5, fontFamily: 'Inter_900Black' },
});
