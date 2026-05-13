export const COLORS = {
  bg: '#0F0F14',
  surface: '#1C1C28',
  card: '#252535',
  border: '#2D2D42',
  primary: '#8B5CF6',
  primaryLight: '#A78BFA',
  secondary: '#06B6D4',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',
};

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
