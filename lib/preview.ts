// ── Preview / test mode ──────────────────────────────────────────────────────────
// Set EXPO_PUBLIC_PREVIEW=1 in .env to render pages with dummy data instead of
// hitting the API. Handy for demos and design work with no backend running.
//
//   EXPO_PUBLIC_PREVIEW=1                 → all preview-enabled pages use mock data
//   EXPO_PUBLIC_PREVIEW_MIRROR=full       → which Mirror state to show
//                                           (forming | teaser | full, default full)
//
// EXPO_PUBLIC_* vars are inlined at build time, so restart the bundler after
// changing them (expo start -c).

import type { MirrorPayload } from './api';

const flag = (v?: string) => v === '1' || v === 'true' || v === 'yes';

export const PREVIEW = flag(process.env.EXPO_PUBLIC_PREVIEW);

export type MirrorPreviewState = 'forming' | 'teaser' | 'full';
export const PREVIEW_MIRROR_STATE: MirrorPreviewState =
  (process.env.EXPO_PUBLIC_PREVIEW_MIRROR as MirrorPreviewState) || 'full';

// Deterministic 0..1 pseudo-random so the mock data looks natural but is stable.
function rand(i: number, salt = 1): number {
  const x = Math.sin((i + 1) * 12.9898 * salt) * 43758.5453;
  return x - Math.floor(x);
}

// ── Fuel Analysis ────────────────────────────────────────────────────────────────

export type PreviewFuelDay = {
  date: string;
  foodQuality: number | null;
  hadJunkFood: boolean | null;
  stuckToMeal: boolean | null;
  score: number | null;
};

/** Builds a plausible, gently-improving 30-day fuel history for the given dates. */
export function previewFuelHistory(days: string[]): PreviewFuelDay[] {
  return days.map((date, i) => {
    // Leave the oldest few + the occasional day unlogged, like a real user.
    const logged = i >= 3 && i % 7 !== 4;
    if (!logged) {
      return { date, foodQuality: null, hadJunkFood: null, stuckToMeal: null, score: null };
    }
    const trend = i * 1.1;                       // slow upward climb
    const wobble = Math.sin(i / 2.4) * 12;       // natural day-to-day variance
    const score = Math.max(24, Math.min(97, Math.round(42 + trend + wobble)));
    const foodQuality = Math.max(1, Math.min(10, Math.round(score / 10)));
    return {
      date,
      foodQuality,
      hadJunkFood: rand(i, 3) > 0.72,
      stuckToMeal: rand(i, 7) < 0.78,
      score,
    };
  });
}

export const previewFuelIdentity = {
  totalXP: 3240,
  levelIndex: 4,
  levelName: 'Clean Eater',
  nextLevel: 'Fuel Master',
  xpToNext: 760,
};

// ── Mirror ─────────────────────────────────────────────────────────────────────

const previewHero = {
  archetype: 'The Disciplined Builder',
  becoming: "Someone who shows up whether they feel like it or not — and it's starting to show.",
  outlook: 'up' as const,
  chips: { momentum: 82, consistency: 88, streak: 12 },
};

function previewConsistencyDays(n = 30): { date: string; score: number }[] {
  const out: { date: string; score: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
    const off = rand(i, 5) > 0.85;               // ~4 off-days
    const score = off ? 0 : Math.round(55 + rand(i, 2) * 45);
    out.push({ date, score });
  }
  return out;
}

export function previewMirror(state: MirrorPreviewState = 'full'): MirrorPayload {
  const updatedAt = new Date().toISOString();

  if (state === 'forming') {
    return {
      state: 'forming',
      updatedAt,
      forming: {
        daysLogged: 4,
        daysNeeded: 7,
        pct: Math.round((4 / 7) * 100),
        streakDays: 4,
        message: "Keep going — your reflection is taking shape.",
      },
      meta: { narrated: true },
    };
  }

  const teaserTrait = {
    key: 'discipline',
    name: 'Discipline',
    score: 84,
    delta: 9,
    deltaText: '+9 THIS MO.',
    evidence: 'Logged 24 of the last 27 days, even on low-energy ones.',
  };

  if (state === 'teaser') {
    return {
      state: 'teaser',
      updatedAt,
      hero: previewHero,
      teaserTrait,
      traitCount: 5,
      meta: { narrated: true },
    };
  }

  return {
    state: 'full',
    updatedAt,
    windowDays: 30,
    hero: previewHero,
    selfScore: { value: 79, deltaVsLastMonth: 11, caption: 'Trending up vs last month' },
    stats: {
      streak: { current: 12, best: 18 },
      perfectDays: { count: 9, of: 30, delta: 3 },
      bounceBack: { days: 1, was: 3, caption: 'You recover faster now' },
    },
    traits: [
      teaserTrait,
      { key: 'consistency', name: 'Consistency', score: 88, delta: 6, deltaText: '+6 THIS MO.',
        evidence: 'Only 4 off-days in the last 30. Weekends held steady.' },
      { key: 'recovery', name: 'Recovery', score: 71, delta: 4, deltaText: '+4 THIS MO.',
        evidence: 'You bounce back in ~1 day after a miss, down from 3.' },
      { key: 'nutrition', name: 'Nutrition', score: 64, delta: -3, deltaText: '−3 THIS MO.',
        evidence: 'Junk-food days crept up in the last two weeks.' },
      { key: 'focus', name: 'Focus', score: 58, delta: 2, deltaText: '+2 THIS MO.',
        evidence: 'Deep-work sessions are getting longer but still uneven.' },
    ],
    consistency: { offDays: 4, days: previewConsistencyDays(30) },
    buildControl: { build: 82, control: 67 },
    projection: {
      selected: 'today',
      horizons: [
        { k: 'today', label: 'TODAY',  score: 79, caption: 'Where you are right now' },
        { k: '1mo',   label: '1 MONTH', score: 84, caption: 'If you hold this pace' },
        { k: '3mo',   label: '3 MONTHS', score: 89, caption: 'Momentum compounding' },
        { k: '6mo',   label: '6 MONTHS', score: 93, caption: 'The person you\'re becoming' },
      ],
    },
    risks: [
      {
        title: 'Nutrition is slipping',
        body: 'Junk-food days doubled in the last two weeks. Left unchecked it drags your whole score down.',
        fix: 'Prep one clean meal tonight',
      },
    ],
    recommendations: [
      {
        title: 'Protect your morning routine',
        impact: 'HIGH IMPACT',
        why: 'Your best streaks all start with an early, logged morning. Anchor the day there.',
        action: 'Add "Morning log" to today',
      },
    ],
    meta: { narrated: true },
  };
}
