import React, { useState } from 'react';
import {
  Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';

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
function Shell({ step, total = 10, children, cta, ctaDisabled, onCta, dark = false }: {
  step: number; total?: number; children: React.ReactNode;
  cta?: string; ctaDisabled?: boolean; onCta?: () => void; dark?: boolean;
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
          <View style={[ss.backBtn, { borderColor: ruleC }]}>
            <Text style={{ color: dark ? 'rgba(255,255,255,0.5)' : W.ink3, fontSize: 18 }}>‹</Text>
          </View>
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
function S1_Welcome({ onNext }: { onNext: () => void }) {
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
            <Text style={[s1.ctaText, { fontFamily: 'SpaceGrotesk_700Bold' }]}>LET'S GO  →</Text>
          </TouchableOpacity>
          <View style={{ height: 16 }} />
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
});

// ── S2: Name ─────────────────────────────────────────────
function S2_Name({ value, onChange, onNext }: {
  value: string; onChange: (s: string) => void; onNext: () => void;
}) {
  return (
    <Shell step={1} cta="CONTINUE" onCta={onNext} ctaDisabled={!value.trim()}>
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

function S3_Body({ age, height, weight, onAge, onHeight, onWeight, onNext }: {
  age: number; height: number; weight: number;
  onAge: (n: number) => void; onHeight: (n: number) => void; onWeight: (n: number) => void;
  onNext: () => void;
}) {
  return (
    <Shell step={2} cta="CONTINUE" onCta={onNext}>
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

// ── S4: Why ──────────────────────────────────────────────
const WHY_OPTS = [
  { id: 'build',   label: 'Build new habits',        emoji: '🌱' },
  { id: 'break',   label: 'Break bad habits',        emoji: '✂️' },
  { id: 'strong',  label: 'Get physically stronger', emoji: '💪' },
  { id: 'fuel',    label: 'Eat cleaner',             emoji: '🥗' },
  { id: 'lose',    label: 'Lose fat',                emoji: '⚖️' },
  { id: 'sharp',   label: 'Feel sharper mentally',   emoji: '🧠' },
  { id: 'sleep',   label: 'Sleep better',            emoji: '😴' },
  { id: 'better',  label: 'Just feel better',        emoji: '✨' },
];

function S4_Why({ selected, onToggle, onNext }: {
  selected: string[]; onToggle: (id: string) => void; onNext: () => void;
}) {
  return (
    <Shell step={3} cta="CONTINUE" onCta={onNext} ctaDisabled={selected.length === 0}>
      <Title eyebrow="ABOUT YOU · 3 OF 4" title="Why are you here?" sub="Pick all that apply. Shapes your coaching." />
      <View style={s4.grid}>
        {WHY_OPTS.map(o => {
          const on = selected.includes(o.id);
          return (
            <TouchableOpacity key={o.id}
              style={[s4.option, { borderColor: on ? W.ink : W.rule, backgroundColor: on ? W.ink : W.card }]}
              onPress={() => onToggle(o.id)} activeOpacity={0.8}>
              <Text style={{ fontSize: 18 }}>{o.emoji}</Text>
              <Text style={[s4.optLabel, { color: on ? '#FFFFFF' : W.ink, fontFamily: 'Inter_500Medium' }]}>
                {o.label}
              </Text>
              {on && (
                <View style={s4.check}>
                  <Text style={{ color: W.ink, fontSize: 9, fontWeight: '900' }}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </Shell>
  );
}

const s4 = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { width: '48%', padding: 14, borderRadius: 14, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 8 },
  optLabel: { fontSize: 13, flex: 1, lineHeight: 18 },
  check: { position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: 8, backgroundColor: W.hype, alignItems: 'center', justifyContent: 'center' },
});

// ── S5: Baseline ─────────────────────────────────────────
function S5_Baseline({ value, onChange, onNext }: {
  value: number; onChange: (n: number) => void; onNext: () => void;
}) {
  const cfg = value <= 4
    ? { label: value <= 2 ? 'ROCK BOTTOM' : 'DRIFTING — TIME TO RESET', color: W.bad, bg: '#FCE6E6' }
    : value <= 6
      ? { label: 'AVERAGE — ROOM TO GROW', color: W.warn, bg: '#FFF1DC' }
      : { label: 'BUILDING MOMENTUM', color: W.good, bg: '#E2F7EC' };

  return (
    <Shell step={4} cta="CONTINUE" onCta={onNext}>
      <Title eyebrow="ABOUT YOU · 4 OF 4" title="Be honest." sub="Where are you right now? 1 is rock bottom, 10 is dialed. No judgment." />
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

function S6_Priority({ selected, onSelect, onNext }: {
  selected: string; onSelect: (id: string) => void; onNext: () => void;
}) {
  return (
    <Shell step={5} cta="CONTINUE" onCta={onNext}>
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

// ── S7: Starter habits ───────────────────────────────────
const ALL_HABITS = [
  { id: 'cold',    name: 'Cold shower',       dur: '3 min' },
  { id: 'sugar',   name: 'No sugar',          dur: 'all day' },
  { id: 'walk',    name: 'Walk 8,000 steps',  dur: '60 min' },
  { id: 'read',    name: 'Read 30 min',       dur: '30 min' },
  { id: 'phone',   name: 'No phone in bed',   dur: '—' },
  { id: 'journal', name: 'Journal 1 page',    dur: '5 min' },
  { id: 'med',     name: 'Meditate 10 min',   dur: '10 min' },
  { id: 'workout', name: 'Strength workout',  dur: '45 min' },
];

function S7_Habits({ selected, onToggle, onNext }: {
  selected: string[]; onToggle: (id: string) => void; onNext: () => void;
}) {
  const atMax = selected.length >= 3;
  return (
    <Shell step={6} cta="START WITH THESE" onCta={onNext} ctaDisabled={selected.length === 0}>
      <Title eyebrow="DISCIPLINE · STARTERS" title="Pick 3 habits to build." sub="Small wins compound. Add more once these stick." />
      <View style={{ gap: 8 }}>
        {ALL_HABITS.map(h => {
          const on = selected.includes(h.id);
          const disabled = !on && atMax;
          return (
            <TouchableOpacity key={h.id}
              style={[s7.row, { borderColor: on ? W.ink : W.rule, backgroundColor: W.card, opacity: disabled ? 0.4 : 1 }]}
              onPress={() => !disabled && onToggle(h.id)} activeOpacity={0.8}>
              <View style={[s7.checkbox, { borderColor: on ? W.ink : W.rule, backgroundColor: on ? W.hype : 'transparent' }]}>
                {on && <Text style={{ color: W.ink, fontSize: 11, fontWeight: '900' }}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s7.habitName, { color: W.ink, fontFamily: 'SpaceGrotesk_700Bold' }]}>{h.name}</Text>
                <Text style={[s7.habitDur, { color: W.ink3, fontFamily: 'Inter_500Medium' }]}>{h.dur}</Text>
              </View>
              <Text style={[s7.pts, { color: on ? W.good : W.ink3, fontFamily: 'SpaceGrotesk_700Bold' }]}>+5 PT</Text>
            </TouchableOpacity>
          );
        })}
        <View style={s7.addRow}>
          <Text style={[s7.addText, { color: W.ink2, fontFamily: 'Inter_500Medium' }]}>+ Add your own</Text>
        </View>
      </View>
    </Shell>
  );
}

const s7 = StyleSheet.create({
  row: { padding: 14, borderRadius: 14, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  habitName: { fontSize: 15, letterSpacing: 0.3 },
  habitDur: { fontSize: 11.5, marginTop: 2 },
  pts: { fontSize: 11, letterSpacing: 1 },
  addRow: { padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: W.ink3, borderStyle: 'dashed', alignItems: 'center' },
  addText: { fontSize: 13 },
});

// ── S8: Log time ─────────────────────────────────────────
const TIMES = [
  { id: 'morning', label: 'Morning',    emoji: '🌅', sub: '6–10 am' },
  { id: 'midday',  label: 'Midday',     emoji: '☀️',  sub: '11 am–2 pm' },
  { id: 'evening', label: 'Evening',    emoji: '🌆', sub: '5–8 pm' },
  { id: 'bed',     label: 'Before bed', emoji: '🌙', sub: '9–11 pm' },
];

function S8_Time({ selected, onSelect, onNext }: {
  selected: string; onSelect: (id: string) => void; onNext: () => void;
}) {
  return (
    <Shell step={7} cta="CONTINUE" onCta={onNext}>
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

function S9_Tone({ selected, onSelect, onNext }: {
  selected: string; onSelect: (id: string) => void; onNext: () => void;
}) {
  return (
    <Shell step={8} cta="CONTINUE" onCta={onNext}>
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
function S10_Commit({ name, onCommit }: { name: string; onCommit: () => void }) {
  const today = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
  return (
    <View style={{ flex: 1, backgroundColor: W.dark }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: W.dark }}>
        <View style={s10.topRow}>
          <View style={[s10.backBtn, { borderColor: 'rgba(255,255,255,0.15)' }]}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18 }}>‹</Text>
          </View>
          <View style={[s10.fullBar, { backgroundColor: W.hype }]} />
          <Text style={[s10.stepNum, { color: 'rgba(255,255,255,0.5)', fontFamily: 'SpaceGrotesk_500Medium' }]}>10/10</Text>
        </View>
      </SafeAreaView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s10.body} showsVerticalScrollIndicator={false}>
        <Text style={[s10.eyebrow, { color: W.hype, fontFamily: 'Inter_700Bold' }]}>SIGN THE PACT</Text>
        <Text style={[s10.headline, { color: '#FFFFFF', fontFamily: 'SpaceGrotesk_700Bold' }]}>
          {'Today.\nTomorrow.\n'}
          <Text style={{ color: W.hype }}>Every day.</Text>
        </Text>
        <Text style={[s10.sub, { color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter_400Regular' }]}>
          You'll get one daily nudge. Log in under a minute. Watch your score build.
        </Text>

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

        <View style={s10.notifRow}>
          <Text style={{ fontSize: 18 }}>🔔</Text>
          <Text style={[{ flex: 1, fontSize: 12.5, color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter_400Regular' }]}>
            Daily nudge enabled.
          </Text>
          <View style={s10.toggle}>
            <View style={s10.toggleThumb} />
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={{ backgroundColor: W.dark }}>
        <View style={{ paddingHorizontal: 22, paddingBottom: 16 }}>
          <TouchableOpacity style={s10.cta} onPress={onCommit} activeOpacity={0.85}>
            <Text style={[s10.ctaText, { color: W.ink, fontFamily: 'SpaceGrotesk_700Bold' }]}>I'M IN  →</Text>
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

// ── Main export ──────────────────────────────────────────
export default function OnboardingScreen() {
  const { completeOnboarding, user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.name ?? '');
  const [age, setAge] = useState(25);
  const [height, setHeight] = useState(175);
  const [weight, setWeight] = useState(75);
  const [whySelected, setWhySelected] = useState<string[]>([]);
  const [baseline, setBaseline] = useState(5);
  const [priority, setPriority] = useState('disc');
  const [habits, setHabits] = useState<string[]>([]);
  const [logTime, setLogTime] = useState('evening');
  const [tone, setTone] = useState('bal');

  const next = () => setStep(s => s + 1);

  function toggleWhy(id: string) {
    setWhySelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }
  function toggleHabit(id: string) {
    setHabits(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  async function finish() {
    await completeOnboarding();
    router.replace('/(tabs)');
  }

  const screens = [
    <S1_Welcome key="ob1" onNext={next} />,
    <S2_Name key="ob2" value={name} onChange={setName} onNext={next} />,
    <S3_Body key="ob3" age={age} height={height} weight={weight}
      onAge={setAge} onHeight={setHeight} onWeight={setWeight} onNext={next} />,
    <S4_Why key="ob4" selected={whySelected} onToggle={toggleWhy} onNext={next} />,
    <S5_Baseline key="ob5" value={baseline} onChange={setBaseline} onNext={next} />,
    <S6_Priority key="ob6" selected={priority} onSelect={setPriority} onNext={next} />,
    <S7_Habits key="ob7" selected={habits} onToggle={toggleHabit} onNext={next} />,
    <S8_Time key="ob8" selected={logTime} onSelect={setLogTime} onNext={next} />,
    <S9_Tone key="ob9" selected={tone} onSelect={setTone} onNext={next} />,
    <S10_Commit key="ob10" name={name} onCommit={finish} />,
  ];

  return screens[step];
}
