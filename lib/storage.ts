import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOKEN_KEY = 'grittt_token';
export const USER_KEY = 'grittt_user';
export const ONBOARDING_KEY = 'grittt_onboarding_done';

// Per-user keys for the Today screen. They are keyed by user id (and so survive
// sign-out without leaking between accounts on a shared device).
const prioritiesKey = (userId: string) => `grittt_priorities_${userId}`;
const checkInsKey = (userId: string) => `grittt_checkins_${userId}`;
const chatKey = (userId: string) => `grittt_askgrittt_${userId}`;

export type Mood = 'low' | 'okay' | 'good';
/** One entry per date. `mood: null` with `skipped` means the user chose to skip. */
export type CheckIn = { mood: Mood | null; skipped?: boolean; updatedAt: string };
export type CheckInMap = Record<string, CheckIn>;

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const todayStorage = {
  /** Habit ids the user picked as priorities, in their chosen order. */
  getPriorities: async (userId: string): Promise<string[]> => {
    const ids = await readJSON<unknown>(prioritiesKey(userId), []);
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
  },
  setPriorities: (userId: string, ids: string[]) =>
    AsyncStorage.setItem(prioritiesKey(userId), JSON.stringify(ids)),

  getCheckIns: async (userId: string): Promise<CheckInMap> => {
    const map = await readJSON<unknown>(checkInsKey(userId), {});
    return map && typeof map === 'object' && !Array.isArray(map) ? (map as CheckInMap) : {};
  },
  /** Writes the single entry for `date` (replacing any earlier one) and returns the new map. */
  setCheckIn: async (userId: string, date: string, entry: CheckIn): Promise<CheckInMap> => {
    const map = await todayStorage.getCheckIns(userId);
    const next = { ...map, [date]: entry };
    await AsyncStorage.setItem(checkInsKey(userId), JSON.stringify(next));
    return next;
  },
};

/** Ask GRITTT conversation, per user. Stored only on this device; the server
 *  keeps no copy. Bounded so a long chat can't grow without limit. */
export const chatStorage = {
  get: async <T = unknown>(userId: string): Promise<T[]> => {
    const list = await readJSON<unknown>(chatKey(userId), []);
    return Array.isArray(list) ? (list as T[]) : [];
  },
  set: (userId: string, messages: unknown[], max: number) =>
    AsyncStorage.setItem(chatKey(userId), JSON.stringify(messages.slice(-max))),
  clear: (userId: string) => AsyncStorage.removeItem(chatKey(userId)),
};

export const storage = {
  getToken: () => AsyncStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => AsyncStorage.setItem(TOKEN_KEY, token),
  removeToken: () => AsyncStorage.removeItem(TOKEN_KEY),
  getUser: async () => {
    const data = await AsyncStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  },
  setUser: (user: object) => AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
  removeUser: () => AsyncStorage.removeItem(USER_KEY),
  getOnboardingDone: async () => (await AsyncStorage.getItem(ONBOARDING_KEY)) === 'true',
  setOnboardingDone: () => AsyncStorage.setItem(ONBOARDING_KEY, 'true'),
  clear: async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, ONBOARDING_KEY]);
  },
};
