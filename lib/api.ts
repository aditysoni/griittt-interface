const BASE_URL = `${process.env.EXPO_PUBLIC_API_BASE ?? 'http://192.168.1.6:3001'}/api`;

export type MacroTargets = { calories: number; protein: number; fat: number; carbs: number };

export type User = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  goals?: string[];
  baselineSelfRating?: number | null;
  priorityMode?: 'disc' | 'fuel' | 'phys' | null;
  dailyNudgeTime?: 'morning' | 'midday' | 'evening' | 'before_bed' | null;
  coachingTone?: 'soft' | 'bal' | 'hard' | null;
  notificationsEnabled?: boolean | null;
  onboardingDone?: boolean;
  macroTargets?: MacroTargets | null;
  isPremium?: boolean;
  premiumUntil?: string | null;
};

// ── The Mirror ──────────────────────────────────────────────────────────────
export type MirrorTrait = {
  key: string; name: string; score: number; delta: number; deltaText: string; evidence: string;
};
export type MirrorHorizon = { k: string; label: string; score: number; caption: string };
export type MirrorHero = {
  archetype: string;
  becoming: string;
  outlook: 'up' | 'flat' | 'down';
  chips: { momentum: number; consistency: number; streak: number };
  /** Overall self-score (0–100) for the identity card — e.g. 82 */
  selfScore: number;
  /** Change vs last month — e.g. +11 or -4 */
  selfScoreDelta: number;
};
export type MirrorPayload = {
  state: 'forming' | 'teaser' | 'full';
  updatedAt: string;
  meta?: { narrated: boolean };
  // forming
  forming?: { daysLogged: number; daysNeeded: number; pct: number; streakDays: number; message: string };
  // teaser + full
  hero?: MirrorHero;
  teaserTrait?: MirrorTrait;
  traitCount?: number;
  // full
  windowDays?: number;
  selfScore?: { value: number; deltaVsLastMonth: number; caption: string };
  stats?: {
    streak: { current: number; best: number };
    perfectDays: { count: number; of: number; delta: number };
    bounceBack: { days: number; was: number | null; caption: string } | null;
  };
  traits?: MirrorTrait[];
  consistency?: { offDays: number; days: { date: string; score: number }[] };
  buildControl?: { build: number; control: number };
  projection?: { selected: string; horizons: MirrorHorizon[] };
  risks?: { title: string; body: string; fix: string }[];
  recommendations?: { title: string; impact: string; why: string; action: string }[];
};

export type OnboardingPayload = {
  name?: string;
  age: number;
  heightFt?: number;
  heightIn?: number;
  heightCm?: number;
  weightLbs?: number;
  weightKg?: number;
  goals: string[];
  baselineSelfRating: number;
  priorityMode: 'disc' | 'fuel' | 'phys';
  starterHabits: string[];
  /** Preset challenge titles the user wants to auto-join (e.g. ["Cold shower", "No sugar"]). */
  starterChallenges?: string[];
  dailyNudgeTime: 'morning' | 'midday' | 'evening' | 'before_bed';
  coachingTone: 'soft' | 'bal' | 'hard';
  notificationsEnabled: boolean;
};

export type Task = {
  id: string;
  name: string;
  normalized_name: string;
  score: number;
  days: number[] | null;
  archived_at: string | null;
  start_date: string | null;
  category: string | null;
  tiny_version: string | null;
  why_started: string | null;
  track_count: boolean;
  count_unit: string | null;
  created_at: string;
};

export type HabitScore = {
  name: string;
  normalized: string;
  score: number;
  done: boolean;
  streak: number;
};

// Preset control habits (shown as chips when creating a CONTROL habit)
export const CONTROL_PRESETS: { name: string; icon: string; unit: string }[] = [
  { name: 'Cigarettes',         icon: '🚬', unit: 'cigs'    },
  { name: 'Alcohol',            icon: '🍺', unit: 'drinks'  },
  { name: 'Masturbation',       icon: '🔞', unit: 'times'   },
  { name: 'Instagram / Reels',  icon: '📱', unit: 'minutes' },
  { name: 'Gambling',           icon: '🎰', unit: 'sessions'},
  { name: 'Junk Food',          icon: '🍔', unit: 'times'   },
  { name: 'Social Media',       icon: '💬', unit: 'minutes' },
  { name: 'Caffeine',           icon: '☕', unit: 'cups'    },
];

export type StrengthIdentity = {
  totalXP: number;
  levelIndex: number;
  levelName: string;
  nextLevel?: string;
  xpToNext?: number;
  updatedAt: string;
};

export type FuelIdentity = {
  totalXP: number;
  levelIndex: number;
  levelName: string;
  nextLevel?: string;
  xpToNext?: number;
};

export type LeaderboardEntry = {
  userId: string;
  userName: string;
  avatar: string | null;
  score: number;
};

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const url = `${BASE_URL}${path}`;

  // Helpful debug logs when running in development
  // Expo defines global __DEV__ -- keep this small and conditional
  try {
    // eslint-disable-next-line no-undef
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // Keep body small to avoid leaking large payloads
      // eslint-disable-next-line no-console
      console.debug('[api] request', options.method || 'GET', url, {
        headers,
        body: options.body ? (typeof options.body === 'string' ? options.body : '[body]') : undefined,
      });
    }
  } catch (e) {
    // ignore logging failures
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 204) return null as T;

  // Prefer reading as text so we can provide meaningful errors when server
  // returns non-JSON (e.g., HTML error page, plain text, etc.). Then try to
  // parse JSON; if that fails include the raw text in the thrown error.
  const text = await res.text().catch(() => '');
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { _raw: text };
    }
  }

  if (!res.ok) {
    const message = (data && (data.error || data.message)) || data?._raw || `HTTP ${res.status}`;
    const err: any = new Error(message);
    err.status = res.status;
    err.response = data;
    throw err;
  }

  return data as T;
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  signup: (name: string, email: string, password: string) =>
    request<{ user: User; token: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  me: (token: string) =>
    request<User>('/auth/me', {}, token),

  // ── Google OAuth (server-side polling flow) ──────────────────────────────
  // The app opens `googleMobileUrl(session)` in a browser; the backend runs the
  // whole OAuth handshake with its OWN credentials (GOOGLE_CLIENT_ID/SECRET from
  // its .env), stores the resulting JWT keyed by `session`, then the app polls
  // `googlePoll(session)` to retrieve it. No Google client config lives in the app.
  googleMobileUrl: (session: string) =>
    `${BASE_URL}/auth/google/mobile?session=${encodeURIComponent(session)}`,

  googlePoll: (session: string) =>
    request<{ ready: boolean; token?: string; error?: string }>(
      `/auth/google/mobile/poll/${encodeURIComponent(session)}`,
      {}
    ),
};

// Users / profile
export const users = {
  me: (token: string) =>
    request<User>('/users/me', {}, token),

  patch: (token: string, data: Partial<{
    name: string;
    age: number | null;
    heightCm: number | null;
    weightKg: number | null;
    goals: string[];
    baselineSelfRating: number | null;
    priorityMode: 'disc' | 'fuel' | 'phys' | null;
    dailyNudgeTime: 'morning' | 'midday' | 'evening' | 'before_bed' | null;
    coachingTone: 'soft' | 'bal' | 'hard' | null;
    notificationsEnabled: boolean | null;
    macroTargets: MacroTargets | null;
  }>) =>
    request<User>('/users/me', { method: 'PATCH', body: JSON.stringify(data) }, token),

  onboarding: (token: string, data: OnboardingPayload) =>
    request<{ user: User; onboardingDone: true }>('/users/onboarding', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token),

  macroTargets: (token: string) =>
    request<MacroTargets>('/users/macro-targets', {}, token),
};

// ── Onboarding (Q&A schema) ──────────────────────────────────────────────────
export type OnboardingQuestion = {
  id: string;
  order: number;
  prompt: string;
  subtitle: string | null;
  type: 'text' | 'compound' | 'multi_select' | 'single_select';
  options: any;            // shape depends on `type` — see server schema
  minSelect: number | null;
  maxSelect: number | null;
  required: boolean;
};

export type OnboardingRecommendation = {
  habits: Array<{
    name: string;
    category: 'build' | 'control';
    reason: string;
    score: number;
    trackCount?: boolean;
    unit?: string;
  }>;
  challenges: Array<{
    id: string;
    title: string;
    durationDays: number;
    theme: string;
    reason: string;
    score: number;
  }>;
};

export const onboarding = {
  questions: (token: string) =>
    request<OnboardingQuestion[]>('/onboarding/questions', {}, token),

  answers: (token: string) =>
    request<Record<string, any>>('/onboarding/answers', {}, token),

  submit: (token: string, answers: Record<string, any>) =>
    request<{ user: User; recommendations: OnboardingRecommendation }>(
      '/onboarding/submit',
      { method: 'POST', body: JSON.stringify({ answers }) },
      token
    ),

  recommendations: (token: string) =>
    request<OnboardingRecommendation>('/onboarding/recommendations', {}, token),
};

// Tasks / Habits
export const tasks = {
  list: (token: string) =>
    request<Task[]>('/tasks', {}, token),

  create: (token: string, data: { name: string; category?: string; days?: number[]; score?: number; tinyVersion?: string; whyStarted?: string; trackCount?: boolean; countUnit?: string | null }) =>
    request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }, token),

  update: (token: string, id: string, data: Partial<Task>) =>
    request<Task>('/tasks/' + id, { method: 'PUT', body: JSON.stringify(data) }, token),

  delete: (token: string, id: string) =>
    request<null>('/tasks/' + id, { method: 'DELETE' }, token),
};

// Habit completions & scores
export const habits = {
  score: (token: string, name: string, date: string) =>
    request<HabitScore>(`/habits/${encodeURIComponent(name)}/score?date=${date}`, {}, token),

  dailyScore: (token: string, date: string) =>
    request<{ date: string; score: number }>(`/habits/score/day?date=${date}`, {}, token),

  // `date` (YYYY-MM-DD, the caller's LOCAL day) is sent so the server records the
  // completion on the same calendar day the reads (allStatus / disciplineDay) query
  // by. Without it the server falls back to its own CURRENT_DATE, which drifts from
  // the user's local date across the midnight boundary (e.g. IST is UTC+5:30) and
  // makes a just-completed habit read back as not-done.
  complete: (token: string, name: string, taskId?: string, count?: number | null, failed?: boolean, date?: string) =>
    request<{ ok: boolean; count: number | null }>(`/habits/${encodeURIComponent(name)}/completions`, {
      method: 'POST',
      body: JSON.stringify({ taskId, count, ...(failed ? { failed: true } : {}), ...(date ? { date } : {}) }),
    }, token),

  uncomplete: (token: string, name: string, date?: string) =>
    request<null>(
      `/habits/${encodeURIComponent(name)}/completions${date ? `?date=${date}` : ''}`,
      { method: 'DELETE' },
      token,
    ),

  ranking: (token: string, name: string) =>
    request<{ name: string; normalized: string; ranking: Array<{ userId: string; userName: string; avatar: string | null; streak: number }> }>(
      `/habits/${encodeURIComponent(name)}/ranking`,
      {},
      token
    ),

  shields: (token: string) =>
    request<{ monthKey: string; used: string[]; remaining: number; max: number }>('/habits/shields', {}, token),

  useShield: (token: string, date: string) =>
    request<{ ok: boolean; alreadyUsed?: boolean; remaining: number }>('/habits/shields/use', {
      method: 'POST',
      body: JSON.stringify({ date }),
    }, token),

  badDay: (token: string, date: string) =>
    request<{ ok: boolean }>('/habits/bad-day', {
      method: 'POST',
      body: JSON.stringify({ date }),
    }, token),

  weeklyDebrief: (token: string) =>
    request<{ summary: string; pattern: string; suggestion: string; identity: string }>('/habits/ai/weekly-debrief', { method: 'POST' }, token),

  recoveryNudge: (token: string, data: { habitName: string; streak?: number; tinyVersion?: string; whyStarted?: string }) =>
    request<{ nudge: string; suggestTiny: boolean }>('/habits/ai/recovery-nudge', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token),

  patterns: (token: string) =>
    request<{ patterns: Array<{ insight: string; actionable: string }> }>('/habits/ai/patterns', { method: 'POST' }, token),

  allStatus: (token: string, date: string) =>
    request<Array<{ id: string; normalized_name: string; done: boolean; yFailed: boolean; count: number | null; streak: number }>>(
      `/habits/all/status?date=${date}`, {}, token
    ),

  stats: (token: string, name: string) =>
    request<{
      name: string;
      normalized: string;
      consistency: number;
      currentStreak: number;
      longestStreak: number;
      totalDone: number;
      daysActive: number;
      windowDays: number;
      percentile: number | null;
      totalUsersWithHabit: number;
      doneDates: string[];
    }>(`/habits/${encodeURIComponent(name)}/stats`, {}, token),

  history: (token: string, name: string, from: string, to: string) =>
    request<{ name: string; dates: string[] }>(
      `/habits/history?name=${encodeURIComponent(name)}&from=${from}&to=${to}`,
      {},
      token
    ),

  disciplineDay: (token: string, date: string) =>
    request<{
      date: string;
      buildScore: number;
      controlScore: number;
      overallScore: number;
      buildDone: number;
      buildTotal: number;
      controlDone: number;
      controlTotal: number;
    }>(`/habits/discipline/day?date=${date}`, {}, token),

  disciplineRange: (token: string, from: string, to: string) =>
    request<Array<{
      date: string;
      buildScore: number;
      controlScore: number;
      overallScore: number;
      buildDone: number;
      buildTotal: number;
      controlDone: number;
      controlTotal: number;
    }>>(`/habits/discipline/range?from=${from}&to=${to}`, {}, token),
};

export type BodyPart =
  | 'chest' | 'back' | 'shoulders' | 'legs'
  | 'biceps' | 'triceps' | 'abs' | 'cardio';

export type SetEntry = {
  reps: number;
  weight: number; // kg, 0 = bodyweight
};

export type ExerciseEntry = {
  name: string;
  sets: SetEntry[];
};

export type TrainingType = 'gym' | 'sports' | 'cardio';

export type WorkoutLog = {
  id: string;
  mode: 'simple' | 'detailed';
  category: 'strength' | 'cardio' | 'games' | null;
  rating: number | null;
  activity: string | null;
  durationMins: number | null;
  distanceKm: number | null;
  intensity: number | null;
  notes: string | null;
  exercises: ExerciseEntry[] | null;
  bodyPart: BodyPart | null;
  score: number;
  createdAt: string;
};

// Body parts with icons (used for the chooser grid)
export const BODY_PARTS: { key: BodyPart; label: string; icon: string }[] = [
  { key: 'chest',     label: 'CHEST',     icon: '🫁' },
  { key: 'back',      label: 'BACK',      icon: '🔙' },
  { key: 'shoulders', label: 'SHOULDERS', icon: '💪' },
  { key: 'legs',      label: 'LEGS',      icon: '🦵' },
  { key: 'biceps',    label: 'BICEPS',    icon: '💪' },
  { key: 'triceps',   label: 'TRICEPS',   icon: '🦾' },
  { key: 'abs',       label: 'ABS',       icon: '🟫' },
  { key: 'cardio',    label: 'CARDIO',    icon: '🏃' },
];

// Common sports suggestions
export const SPORTS_SUGGESTIONS = [
  'Basketball', 'Football', 'Soccer', 'Tennis', 'Cricket',
  'Badminton', 'Volleyball', 'Swimming', 'Table Tennis', 'Squash',
];

// Suggested exercises per body part
export const EXERCISE_SUGGESTIONS: Record<BodyPart, string[]> = {
  chest:     ['Bench Press', 'Incline Press', 'Dumbbell Flies', 'Push-ups', 'Cable Crossover', 'Dips'],
  back:      ['Pull-ups', 'Lat Pulldown', 'Barbell Rows', 'Deadlifts', 'T-Bar Rows', 'Face Pulls'],
  shoulders: ['Overhead Press', 'Lateral Raise', 'Front Raise', 'Reverse Flies', 'Shrugs', 'Arnold Press'],
  legs:      ['Squats', 'Lunges', 'Leg Press', 'Romanian Deadlift', 'Leg Curls', 'Calf Raises'],
  biceps:    ['Bicep Curl', 'Hammer Curl', 'Preacher Curl', 'Cable Curl', 'Concentration Curl'],
  triceps:   ['Tricep Pushdown', 'Skull Crushers', 'Overhead Extension', 'Dips', 'Close-Grip Bench'],
  abs:       ['Crunches', 'Plank', 'Leg Raises', 'Russian Twists', 'Cable Crunch', 'Hanging Knee Raise'],
  cardio:    ['Running', 'Cycling', 'Rowing', 'Jump Rope', 'Stair Climber', 'Elliptical'],
};

export type LogResult = {
  logId: string;
  score: number;
  xpEarned: number;
  totalXP: number;
  levelIndex: number;
  levelName: string;
  levelChanged: boolean;
};

// Strength
export const strength = {
  identity: (token: string) =>
    request<StrengthIdentity>('/strength/identity', {}, token),

  log: (token: string, data: {
    mode: 'simple' | 'detailed';
    date: string;
    streak?: number;
    // simple
    rating?: number;
    // detailed
    category?: string;
    activity?: string;
    durationMins?: number;
    intensity?: number;
    distanceKm?: number;
    notes?: string;
    exercises?: ExerciseEntry[];
    bodyPart?: BodyPart;
  }) =>
    request<LogResult>('/strength/log', { method: 'POST', body: JSON.stringify(data) }, token),

  logs: (token: string, date: string) =>
    request<WorkoutLog[]>(`/strength/logs?date=${date}`, {}, token),

  leaderboard: (token: string, date: string) =>
    request<{ date: string; leaderboard: LeaderboardEntry[] }>(`/strength/leaderboard?date=${date}`, {}, token),

  history: (token: string, from: string, to: string) =>
    request<Array<{ date: string; score: number }>>(`/strength/history?from=${from}&to=${to}`, {}, token),
};

export type FoodLog = {
  id: string;
  mode: 'simple' | 'detailed';
  hadThreeMeals: boolean | null;
  foodQuality: number | null;
  hadJunkFood: boolean | null;
  calories: number | null;
  calorieTarget: number | null;
  protein: number | null;
  proteinTarget: number | null;
  mealsLogged: number | null;
  expectedMeals: number | null;
  junkMeals: number | null;
  notes: string | null;
  score: number;
  createdAt: string;
};

export type FuelLogResult = {
  score: number;
  fuelScore?: number;
  xpEarned?: number;
  levelName?: string;
  levelChanged?: boolean;
};

export type MealTime = 'morning' | 'brunch' | 'lunch' | 'evening' | 'dinner' | 'snacks';

export type FoodItem = {
  id: string;
  name: string;
  mealTime: MealTime;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  createdAt: string;
};

// Fuel
export const fuel = {
  identity: (token: string) =>
    request<FuelIdentity>('/fuel/identity', {}, token),

  log: (token: string, data: {
    mode: 'simple' | 'detailed';
    date: string;
    // simple
    hadThreeMeals?: boolean;
    foodQuality?: number;
    hadJunkFood?: boolean;
    // detailed
    calories?: number;
    calorieTarget?: number;
    protein?: number;
    proteinTarget?: number;
    mealsLogged?: number;
    expectedMeals?: number;
    junkMeals?: number;
    notes?: string;
  }) =>
    request<FuelLogResult>('/fuel/log', { method: 'POST', body: JSON.stringify(data) }, token),

  logs: (token: string, date: string) =>
    request<FoodLog[]>(`/fuel/logs?date=${date}`, {}, token),

  history: (token: string, from: string, to: string) =>
    request<Array<{
      date: string;
      foodQuality: number | null;
      hadJunkFood: boolean | null;
      stuckToMeal: boolean | null;
      score: number | null;
    }>>(`/fuel/history?from=${from}&to=${to}`, {}, token),

  items: (token: string, date: string) =>
    request<FoodItem[]>(`/fuel/items?date=${date}`, {}, token),

  addItem: (token: string, data: { date: string; name: string; mealTime: MealTime; calories?: number; protein?: number; fat?: number; carbs?: number }) =>
    request<FoodItem>('/fuel/items', { method: 'POST', body: JSON.stringify(data) }, token),

  deleteItem: (token: string, id: string) =>
    request<null>(`/fuel/items/${id}`, { method: 'DELETE' }, token),

  editItem: (token: string, id: string, data: Partial<{
    name: string; mealTime: MealTime;
    calories: number | null; protein: number | null;
    fat: number | null; carbs: number | null;
  }>) =>
    request<FoodItem>(`/fuel/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }, token),

  monthlyAnalysis: (token: string, month?: string) =>
    request<FuelMonthlyAnalysis>(`/fuel/analysis/monthly${month ? `?month=${month}` : ''}`, {}, token),
};

export type FuelMonthlyAnalysis = {
  month: string;
  totalDaysTracked: number;
  totalNutrition: { calories: number; protein: number; carbs: number; fat: number };
  topFoods: Array<{
    rank: number;
    name: string;
    count: number;
    daysEaten: number;
    nutrition: { calories: number; protein: number; carbs: number; fat: number };
    contribution: { caloriesPct: number; proteinPct: number; carbsPct: number; fatPct: number };
  }>;
};

// AI
export const ai = {
  foodCoach: (token: string, data: { dailyLogs: Array<{ date: string; calories: number; protein: number; carbs: number; fats: number }>; calorieGoal: number; proteinGoal: number }) =>
    request<{ tips: string[] }>('/ai/food-coach', { method: 'POST', body: JSON.stringify(data) }, token),

  workout: (token: string, data: { levelName: string; levelIndex: number; totalXP: number; workoutDaysPerWeek: number; recentSessions: Array<{ date: string; completedWeight: number; totalWeight: number; effort: number }> }) =>
    request<{ plan: Array<{ day: string; focus: string; exercises: string[] }> }>('/ai/workout', { method: 'POST', body: JSON.stringify(data) }, token),

  snapTrack: (token: string, imageBase64: string) =>
    request<{ name: string; calories: number; protein: number; carbs: number; fats: number; servingNote: string }>(
      '/ai/snap-track',
      { method: 'POST', body: JSON.stringify({ imageBase64 }) },
      token
    ),
};

// Challenges
export type ChallengeTheme = 'physical' | 'health' | 'career' | 'lifestyle';

export type Challenge = {
  id: string;
  title: string;
  description: string;
  domain: string;
  theme: ChallengeTheme;
  habitCategory: 'build' | 'control';
  benefits: string[];
  instructions: string | null;
  durationDays: number;
  isPreset: boolean;
  joined: boolean;
  status: 'active' | 'completed' | 'abandoned' | null;
  startedAt: string | null;
  targetDate: string | null;
  daysDone: number;
  completedAt: string | null;
  participantCount: number;
};

export type DurationStats = {
  challengeId: string;
  durationDays: number;
  total: number;
  completed: number;
  active: number;
  abandoned: number;
  histogram: Array<{ range: [number, number]; label: string; users: number }>;
};

export const challenges = {
  list: (token: string, domain?: string) =>
    request<Challenge[]>(
      `/challenges${domain ? `?domain=${domain}` : ''}`,
      {},
      token
    ),

  create: (token: string, data: {
    title: string; description?: string; domain: string; durationDays: number;
    theme?: ChallengeTheme; benefits?: string[]; instructions?: string;
    habitCategory?: 'build' | 'control';
  }) =>
    request<Challenge>('/challenges', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token),

  join: (token: string, id: string) =>
    request<{ ok: boolean; startedAt: string; targetDate: string }>(
      `/challenges/${id}/join`,
      { method: 'POST' },
      token
    ),

  abandon: (token: string, id: string) =>
    request<null>(`/challenges/${id}/join`, { method: 'DELETE' }, token),

  durationStats: (token: string, id: string) =>
    request<DurationStats>(`/challenges/${id}/duration-stats`, {}, token),

  percentile: (token: string, id: string) =>
    request<{ challengeId: string; pace: number; percentile: number | null; totalOthers: number }>(
      `/challenges/${id}/percentile`, {}, token
    ),
};

export const mirror = {
  // `preview` (forming|teaser|full) is a dev override for building all states.
  get: (token: string, preview?: 'forming' | 'teaser' | 'full', window?: 7 | 30) => {
    const qs = `?today=${today()}${preview ? `&preview=${preview}` : ''}${window ? `&window=${window}` : ''}`;
    return request<MirrorPayload>(`/mirror${qs}`, {}, token);
  },
  // DEV UNLOCK STUB — flips premium so the paywall can be demoed. Real billing later.
  setPremium: (token: string, premium = true) =>
    request<{ isPremium: boolean }>('/mirror/premium', { method: 'POST', body: JSON.stringify({ premium }) }, token),
};

/** Format a Date as YYYY-MM-DD in the device's LOCAL timezone.
 *  Using toISOString() here would format in UTC, which shifts the calendar day
 *  for anyone behind/ahead of UTC (e.g. evening in the Americas reads as
 *  "tomorrow"), causing the wrong day to highlight and logs to land on the
 *  wrong date. */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local-timezone "today" as YYYY-MM-DD. */
export function today(): string {
  return toDateStr(new Date());
}

/** Shift a YYYY-MM-DD date string by `days` (local calendar days). */
export function shiftDate(base: string, days: number): string {
  const d = new Date(base + 'T00:00:00'); // parse as local midnight
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}
