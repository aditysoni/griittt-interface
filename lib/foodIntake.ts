import AsyncStorage from '@react-native-async-storage/async-storage';

// Intake describes amount, not food quality. It is deliberately not converted
// into a nutrition score or merged with the legacy three-option mood check-in.
export const INTAKE_OPTIONS = [
  { key: 'less', label: 'Less than usual' },
  { key: 'usual', label: 'About usual' },
  { key: 'more', label: 'More than usual' },
  { key: 'unsure', label: 'Not sure' },
] as const;
export type FoodIntake = typeof INTAKE_OPTIONS[number]['key'];
export type IntakeEntry = { answer: FoodIntake; updatedAt: string };
export type IntakeMap = Record<string, IntakeEntry>;
const prefix = (userId: string) => `grittt_food_intake_v1_${userId}_`;
export function isIntakeEntry(value: unknown): value is IntakeEntry {
  if (!value || typeof value !== 'object') return false;
  const v = value as IntakeEntry;
  return INTAKE_OPTIONS.some(o => o.key === v.answer) && typeof v.updatedAt === 'string' && Number.isFinite(Date.parse(v.updatedAt));
}
export function intakeDistribution(entries: IntakeMap, from: string, to: string) {
  const responses = Object.entries(entries).filter(([date]) => date >= from && date <= to);
  return INTAKE_OPTIONS.map(option => ({ ...option, count: responses.filter(([,entry]) => entry.answer === option.key).length }));
}
export const foodIntakeStorage = {
  async getAll(userId: string): Promise<IntakeMap> {
    const start = prefix(userId);
    const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(start) && /^\d{4}-\d{2}-\d{2}$/.test(key.slice(start.length)));
    const result: IntakeMap = {};
    for (const [key, raw] of await AsyncStorage.multiGet(keys)) {
      try { const value: unknown = raw ? JSON.parse(raw) : null; if (isIntakeEntry(value)) result[key.slice(start.length)] = value; } catch { /* Ignore an invalid individual record, never invent an answer. */ }
    }
    return result;
  },
  async set(userId: string, date: string, entry: IntakeEntry) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isIntakeEntry(entry)) throw new Error('Invalid food intake entry');
    // One key per user/date avoids lost updates when different dates are saved.
    await AsyncStorage.setItem(prefix(userId) + date, JSON.stringify(entry));
  },
};
