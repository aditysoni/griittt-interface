import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { FoodItem } from './api';
export const NUTRIENTS = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fibre', label: 'Fibre', unit: 'g' },
] as const;
export type Nutrient = typeof NUTRIENTS[number]['key'];
export type NutritionDraft = Record<Nutrient, string>;
export type FoodDetail = { portion: string; photoUri?: string; source: 'manual' | 'photo' | 'previous'; updatedAt: string };
export type FoodDetailMap = Record<string, FoodDetail>;
export const emptyNutrition = (): NutritionDraft => ({ calories: '', protein: '', carbs: '', fat: '', fibre: '' });
export function nutritionFromItem(item?: FoodItem | null): NutritionDraft {
  return Object.fromEntries(NUTRIENTS.map(n => [n.key, item?.[n.key] == null ? '' : String(item[n.key])])) as NutritionDraft;
}
export function parseNutrition(draft: NutritionDraft): Record<Nutrient, number | null> {
  return Object.fromEntries(NUTRIENTS.map(n => {
    const text = draft[n.key].trim().replace(',', '.');
    if (!text) return [n.key, null];
    if (!/^\d+(\.\d+)?$/.test(text) || !Number.isFinite(Number(text))) throw new Error(`Enter a valid, non-negative value for ${n.label.toLowerCase()}, or leave it blank.`);
    return [n.key, Number(text)];
  })) as Record<Nutrient, number | null>;
}
export function summarizeNutrition(items: FoodItem[]) {
  return NUTRIENTS.map(n => {
    const known = items.map(item => { const value = item[n.key]; return value == null || String(value).trim() === '' ? null : Number(value); }).filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0);
    return { ...n, value: known.length ? Math.round(known.reduce((sum, v) => sum + v, 0) * 10) / 10 : null, recorded: known.length, total: items.length };
  });
}
const prefix = (user: string) => `grittt_food_details_v1_${encodeURIComponent(user)}_`;
const photoDirectory = (user: string) => FileSystem.documentDirectory ? `${FileSystem.documentDirectory}grittt-food/${encodeURIComponent(user)}/` : null;
export const foodDetailStorage = {
  async getAll(user: string): Promise<FoodDetailMap> {
    const start = prefix(user), result: FoodDetailMap = {};
    const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(start));
    for (const [key, value] of await AsyncStorage.multiGet(keys)) {
      try {
        const data = JSON.parse(value || 'null') as FoodDetail | null;
        if (!data || typeof data.portion !== 'string' || !['manual', 'photo', 'previous'].includes(data.source)) continue;
        const directory = photoDirectory(user);
        result[decodeURIComponent(key.slice(start.length))] = { ...data, photoUri: directory && typeof data.photoUri === 'string' && data.photoUri.startsWith(directory) ? data.photoUri : undefined };
      } catch { /* Skip only the invalid record. */ }
    }
    return result;
  },
  async set(user: string, itemId: string, detail: FoodDetail, newPhoto?: { uri: string; mimeType?: string | null }) {
    let copied: string | undefined;
    try {
      if (newPhoto) {
        const directory = photoDirectory(user);
        if (!directory) throw Error('Photo storage is unavailable on this device.');
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
        copied = `${directory}${encodeURIComponent(itemId)}-${Date.now()}-${Math.random().toString(36).slice(2)}.${newPhoto.mimeType === 'image/png' ? 'png' : 'jpg'}`;
        await FileSystem.copyAsync({ from: newPhoto.uri, to: copied });
      }
      const next = { ...detail, portion: detail.portion.trim().slice(0, 140), ...(copied ? { photoUri: copied } : {}) };
      await AsyncStorage.setItem(prefix(user) + encodeURIComponent(itemId), JSON.stringify(next));
      return next;
    } catch (error) {
      if (copied) await FileSystem.deleteAsync(copied, { idempotent: true }).catch(() => {});
      throw error;
    }
  },
  async remove(user: string, itemId: string, detail?: FoodDetail) {
    await AsyncStorage.removeItem(prefix(user) + encodeURIComponent(itemId));
    const directory = photoDirectory(user);
    if (directory && detail?.photoUri?.startsWith(directory)) await FileSystem.deleteAsync(detail.photoUri, { idempotent: true });
  },
};
