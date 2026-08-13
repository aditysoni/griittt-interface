// Colours live in components/ThemeContext.tsx (`useTheme()`), which is the single
// source of truth and supports light/dark. The old violet `COLORS` object that used
// to live here is gone — it only reached the auth screens, which meant new users saw
// a different app than the one they signed up for.

export const CATEGORY_EMOJI: Record<string, string> = {
  health: '❤️',
  fitness: '💪',
  mental: '🧠',
  productivity: '⚡',
  learning: '📚',
  social: '🤝',
  nutrition: '🥗',
  sleep: '😴',
  finance: '💰',
  creativity: '🎨',
};

export function categoryEmoji(cat: string | null | undefined): string {
  if (!cat) return '⭐';
  return CATEGORY_EMOJI[cat.toLowerCase()] ?? '⭐';
}

export const STRENGTH_LEVELS = [
  'Starter', 'Initiate', 'Committed', 'Consistent', 'Disciplined',
  'Relentless', 'Forged', 'Hardened', 'Elite', 'Unbreakable', 'Titan', 'Mythic',
];

export const FUEL_LEVELS = [
  'Unaware', 'Tracking', 'Conscious', 'Intentional', 'Balanced',
  'Clean', 'Structured', 'Optimized', 'Precise', 'Dialed', 'Peak', 'Surgical',
];
