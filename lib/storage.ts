import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOKEN_KEY = 'grittt_token';
export const USER_KEY = 'grittt_user';
export const ONBOARDING_KEY = 'grittt_onboarding_done';

// Per-user keys for the Today screen. They are keyed by user id (and so survive
// sign-out without leaking between accounts on a shared device).
const prioritiesKey = (userId: string) => `grittt_priorities_${userId}`;
const checkInsKey = (userId: string) => `grittt_checkins_${userId}`;
const chatKey = (userId: string) => `grittt_askgrittt_${userId}`;
const foodCheckInsKey = (userId: string) => `grittt_food_checkins_${userId}`;
const workoutDraftKey = (userId: string, date: string) => `grittt_workout_draft_${userId}_${date}`;

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

/** Food quick check-in. Stored on the device only: the server has no field for a
 *  three-way "how did eating go" answer. Backend contract needed to persist it:
 *  POST /api/fuel/checkin { date, feel: 'difficult'|'mixed'|'well', note? } and the
 *  same fields on GET /api/fuel/logs and /api/fuel/history. */
export type FoodFeel = 'difficult' | 'mixed' | 'well';
export type FoodCheckIn = { feel: FoodFeel; note: string; updatedAt: string };
export type FoodCheckInMap = Record<string, FoodCheckIn>;

export const foodStorage = {
  getAll: async (userId: string): Promise<FoodCheckInMap> => {
    const map = await readJSON<unknown>(foodCheckInsKey(userId), {});
    return map && typeof map === 'object' && !Array.isArray(map) ? (map as FoodCheckInMap) : {};
  },
  set: async (userId: string, date: string, entry: FoodCheckIn | null): Promise<FoodCheckInMap> => {
    const map = await foodStorage.getAll(userId);
    const next = { ...map };
    if (entry) next[date] = entry; else delete next[date];
    await AsyncStorage.setItem(foodCheckInsKey(userId), JSON.stringify(next));
    return next;
  },
};

/** An unsaved gym session, so leaving the screen never loses typed sets. */
export type WorkoutDraft = {
  bodyPart: string;
  exercises: Array<{ name: string; sets: Array<{ reps: number; weight: number }> }>;
  currentName: string;
  currentSets: Array<{ reps: number; weight: number }>;
  updatedAt: string;
};

export const workoutDraftStorage = {
  get: (userId: string, date: string) => readJSON<WorkoutDraft | null>(workoutDraftKey(userId, date), null),
  set: (userId: string, date: string, draft: WorkoutDraft) => AsyncStorage.setItem(workoutDraftKey(userId, date), JSON.stringify(draft)),
  clear: (userId: string, date: string) => AsyncStorage.removeItem(workoutDraftKey(userId, date)),
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
