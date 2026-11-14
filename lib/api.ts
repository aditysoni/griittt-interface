const BASE_URL = `${process.env.EXPO_PUBLIC_API_BASE ?? 'http://192.168.1.6:3001'}/api`;

export type MacroTargets = { calories: number; protein: number; fat: number; carbs: number };

// Shared shape for every "AI analysis" surface (habits, fuel questions, foods) —
// a trend badge plus a list of headed sections so the UI can render subheaders
// consistently instead of one undifferentiated paragraph.
export type AiAnalysis = {
  trend: 'improving' | 'declining' | 'steady' | 'positive' | 'negative' | 'neutral' | 'insufficient_data';
  sections: Array<{ heading: string; body: string }>;
};

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
  dateOfBirth?: string | null;
  desiredOutcomes?: string[];
  painPoints?: string[];
  blockers?: string[];
  disappointmentStatement?: string | null;
  positiveHabits?: string[];
  negativeHabits?: string[];
  sleepSchedule?: string | null;
  activityLevel?: string | null;
  futureMirror?: FutureMirrorResult | null;
  stepGoal?: number;
  calorieGoal?: number;
};

export type FutureMirrorSnapshot = { title: string; scene: string };

export type FutureMirrorResult = {
  identityObserved: string;
  identityEmerging: string;
  futureHeadline: string;
  hiddenCost: string;
  selfNegotiation: string;
  confidenceLevel: string;
  birthdayCheckpoint: string;
  futureMirrorNegative: string;
  futureMirrorPositive: string;
  trajectoryDrivers: string[];
  futureSnapshots: FutureMirrorSnapshot[];
  trajectoryQuestion: string;
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
  /** No longer collected directly — derived server-side from futureMirror.recommendedFocus when omitted. */
  priorityMode?: 'disc' | 'fuel' | 'phys';
  starterHabits: string[];
  /** Preset challenge titles the user wants to auto-join (e.g. ["Cold shower", "No sugar"]). */
  starterChallenges?: string[];
  dailyNudgeTime: 'morning' | 'midday' | 'evening' | 'before_bed';
  coachingTone: 'soft' | 'bal' | 'hard';
  notificationsEnabled: boolean;

  dateOfBirth?: string;
  desiredOutcomes?: string[];
  painPoints?: string[];
  blockers?: string[];
  disappointmentStatement?: string;
  positiveHabits?: string[];
  negativeHabits?: string[];
  sleepSchedule?: string;
  activityLevel?: string;
  futureMirror?: FutureMirrorResult;
};

// ── Future Mirror (unauthenticated — runs mid-onboarding, before signup) ────
export const futureMirror = {
  generate: (data: {
    name?: string; age?: number; daysUntilBirthday?: number;
    desiredOutcomes: string[]; painPoints: string[]; blockers: string[];
    disappointmentStatement?: string;
    positiveHabits: string[]; negativeHabits: string[];
    heightCm?: number; weightKg?: number;
    sleepSchedule?: string; activityLevel?: string;
  }) =>
    request<FutureMirrorResult>('/future-mirror', { method: 'POST', body: JSON.stringify(data) }),
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

// Server build fingerprint — GET /api/version. Throws (404) against an old
// server build that predates this route, which is itself a useful signal.
export const server = {
  version: () => request<{ version: string }>('/version', {}),
};

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

  // ── Sign in with Apple (native) ──────────────────────────────────────────
  // The app runs Apple's native sheet, gets a short-lived `identityToken` (a
  // JWT signed by Apple), and posts it here. The backend must verify it against
  // Apple's public keys (https://appleid.apple.com/auth/keys), confirm `aud`
  // is our bundle id (com.grittt.app), then find-or-create the user keyed by
  // the token's stable `sub` and issue our own JWT. `fullName`/`email` are only
  // present on the user's FIRST authorization — the backend must persist them
  // then, since Apple won't send them again on later sign-ins.
  apple: (params: { identityToken: string; fullName?: string | null; email?: string | null }) =>
    request<{ user: User; token: string }>('/auth/apple', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
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
    stepGoal: number;
    calorieGoal: number;
  }>) =>
    request<User>('/users/me', { method: 'PATCH', body: JSON.stringify(data) }, token),

  onboarding: (token: string, data: OnboardingPayload) =>
    request<{ user: User; onboardingDone: true }>('/users/onboarding', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token),

  macroTargets: (token: string) =>
    request<MacroTargets>('/users/macro-targets', {}, token),

  deleteData: (token: string) =>
    request<{ ok: boolean }>('/users/me/data', { method: 'DELETE' }, token),

  deleteAccount: (token: string) =>
    request<{ ok: boolean }>('/users/me', { method: 'DELETE' }, token),
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
      completions: Array<{ date: string; failed: boolean; count: number | null }>;
    }>(`/habits/${encodeURIComponent(name)}/stats`, {}, token),

  aiAnalysis: (token: string, name: string) =>
    request<AiAnalysis>(`/habits/${encodeURIComponent(name)}/ai/analysis`, { method: 'POST' }, token),

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
  fibre: number | null;
  createdAt: string;
};

// Fuel
// ── Fuel Questions ────────────────────────────────────────────────────────────
export type FuelQuestion = {
  id: string;
  category: string;
  prompt: string;
  options: string[];
  reverseScoring: boolean;
  weight: number;
  required: boolean;
  isPreset: boolean;
  isCustom: boolean;
  selected: boolean;
  streak?: number;
};

export type FuelQuestionAnswer = {
  questionId: string;
  prompt?: string;
  optionIndex: number;
  optionLabel?: string;
  score?: number;
  weight?: number;
};

export type FuelQuestionResponses = {
  date: string;
  answers: FuelQuestionAnswer[];
  checklistScore?: number;
};

export const fuelQuestions = {
  catalog: (token: string) =>
    request<FuelQuestion[]>('/fuel/questions/catalog', {}, token),

  setSelection: (token: string, questionIds: string[]) =>
    request<{ ok: boolean; selected: number; skipped: number }>(
      '/fuel/questions/selection',
      { method: 'PUT', body: JSON.stringify({ questionIds }) },
      token,
    ),

  createCustom: (token: string, data: {
    prompt: string; options: string[]; weight?: number;
    reverseScoring?: boolean; required?: boolean;
  }) =>
    request<FuelQuestion>('/fuel/questions/custom', { method: 'POST', body: JSON.stringify(data) }, token),

  updateCustom: (token: string, id: string, data: Partial<{
    prompt: string; options: string[]; weight: number; reverseScoring: boolean; required: boolean;
  }>) =>
    request<FuelQuestion>(`/fuel/questions/${id}`, { method: 'PUT', body: JSON.stringify(data) }, token),

  deleteCustom: (token: string, id: string) =>
    request<null>(`/fuel/questions/${id}`, { method: 'DELETE' }, token),

  submitResponses: (token: string, data: { date: string; answers: { questionId: string; optionIndex: number }[] }) =>
    request<FuelQuestionResponses>('/fuel/questions/responses', { method: 'POST', body: JSON.stringify(data) }, token),

  getResponses: (token: string, date: string) =>
    request<FuelQuestionResponses>(`/fuel/questions/responses?date=${date}`, {}, token),

  getScore: (token: string, date: string) =>
    request<{ date: string; checklistScore: number | null; answeredCount: number }>(
      `/fuel/questions/score?date=${date}`, {}, token,
    ),

  scoreRange: (token: string, from: string, to: string) =>
    request<{ from: string; to: string; days: Array<{ date: string; checklistScore: number | null; answeredCount: number }> }>(
      `/fuel/questions/score?from=${from}&to=${to}`, {}, token,
    ),

  suggestWeight: (token: string, data: { prompt: string; options: string[] }) =>
    request<{ weight: number; reasoning: string }>(
      '/fuel/questions/ai/suggest-weight', { method: 'POST', body: JSON.stringify(data) }, token,
    ),

  history: (token: string, id: string, days = 30) =>
    request<{
      question: FuelQuestion;
      days: number;
      avgScore: number | null;
      answeredCount: number;
      answers: Array<{ date: string; optionIndex: number; optionLabel: string | null; score: number }>;
    }>(`/fuel/questions/${id}/history?days=${days}`, {}, token),

  aiAnalysis: (token: string, id: string) =>
    request<AiAnalysis>(`/fuel/questions/${id}/ai/analysis`, { method: 'POST' }, token),
};

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

  addItem: (token: string, data: { date: string; name: string; mealTime: MealTime; calories?: number; protein?: number; fat?: number; carbs?: number; fibre?: number }) =>
    request<FoodItem>('/fuel/items', { method: 'POST', body: JSON.stringify(data) }, token),

  deleteItem: (token: string, id: string) =>
    request<null>(`/fuel/items/${id}`, { method: 'DELETE' }, token),

  editItem: (token: string, id: string, data: Partial<{
    name: string; mealTime: MealTime;
    calories: number | null; protein: number | null;
    fat: number | null; carbs: number | null; fibre: number | null;
  }>) =>
    request<FoodItem>(`/fuel/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }, token),

  monthlyAnalysis: (token: string, month?: string) =>
    request<FuelMonthlyAnalysis>(`/fuel/analysis/monthly${month ? `?month=${month}` : ''}`, {}, token),

  foodAiAnalysis: (token: string, name: string, month?: string) =>
    request<AiAnalysis>('/fuel/analysis/monthly/food', { method: 'POST', body: JSON.stringify({ name, month }) }, token),
};

export type FuelMonthlyAnalysis = {
  month: string;
  totalDaysTracked: number;
  eligible: boolean;
  daysNeeded: number;
  totalNutrition: { calories: number; protein: number; carbs: number; fat: number };
  topFoods: Array<{
    rank: number;
    name: string;
    count: number;
    daysEaten: number;
    percentile: number | null;
    nutrition: { calories: number; protein: number; carbs: number; fat: number };
    contribution: { caloriesPct: number; proteinPct: number; carbsPct: number; fatPct: number };
  }>;
};

// AI
export type AiChatRequest = {
  question: string;
  screen: string;
  /** Names, states and counts only — see lib/assistant minimalContext(). */
  context: Record<string, unknown>;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
};
export type AiChatResponse = { answer: string; basis?: string };

export const ai = {
  /** Open-ended question to the coach. POST /ai/chat is NOT implemented on the
   *  server yet: it returns 404, which the assistant renders as "unavailable". The
   *  client is typed here so the server can be added without an app release. */
  chat: (token: string, data: AiChatRequest, signal?: AbortSignal) =>
    request<AiChatResponse>('/ai/chat', { method: 'POST', body: JSON.stringify(data), signal }, token),

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

// ── Health (HealthKit sync) ───────────────────────────────────────────────────
// Names track the HealthKit identifiers they're read from — see
// Grittt-server/src/routes/health.ts for the authoritative list + units.
export type HealthMetricType =
  | 'steps' | 'activeEnergyBurned' | 'restingHeartRate' | 'heartRateAvg' | 'heartRateVariability'
  | 'sleepHours' | 'bodyMass' | 'distanceWalkingRunning' | 'flightsClimbed' | 'oxygenSaturation'
  | 'sleepDeep' | 'sleepRem' | 'sleepLight' | 'sleepAwake';

export type HealthWorkoutType =
  | 'running' | 'walking' | 'cycling' | 'swimming' | 'hiking'
  | 'functionalStrengthTraining' | 'traditionalStrengthTraining'
  | 'yoga' | 'coreTraining' | 'other';

export type HealthSource = 'healthkit' | 'manual' | 'gps_tracked';

export type HealthMetricPoint = { date: string; value: number; unit: string; source: HealthSource };

export type HealthRoutePoint = { lat: number; lng: number; timestamp: string; altitude?: number };

export type HealthWorkoutSummary = {
  id: string;
  workoutType: HealthWorkoutType;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  distanceMeters: number | null;
  calories: number | null;
  source: HealthSource;
  hasRoute: boolean;
};

export type HealthWorkoutDetail = Omit<HealthWorkoutSummary, 'hasRoute'> & {
  route: HealthRoutePoint[] | null;
};

export type HealthScores = {
  date: string;
  recovery: {
    score: number | null;
    sleepHours: number | null;
    heartRateVariability: number | null;
    restingHeartRate: number | null;
    spo2: number | null;
    heartRateAvg: number | null;
    sleep: {
      deep: number | null;
      rem: number | null;
      light: number | null;
      awake: number | null;
    };
  };
  movement: {
    score: number | null;
    steps: number | null;
    activeEnergyBurned: number | null;
    stepGoal?: number;
    calorieGoal?: number;
  };
};

export const health = {
  syncMetrics: (token: string, metrics: Array<{
    date: string; metricType: HealthMetricType; value: number; unit: string; source?: HealthSource;
  }>) =>
    request<{ ok: boolean; synced: number }>(
      '/health/metrics/sync', { method: 'POST', body: JSON.stringify({ metrics }) }, token,
    ),

  metrics: (token: string, type: HealthMetricType, from: string, to: string) =>
    request<HealthMetricPoint[]>(`/health/metrics?type=${type}&from=${from}&to=${to}`, {}, token),

  allMetrics: (token: string, from: string, to: string) =>
    request<Record<HealthMetricType, HealthMetricPoint[]>>(`/health/metrics?from=${from}&to=${to}`, {}, token),

  syncWorkouts: (token: string, workouts: Array<{
    externalId?: string; workoutType: HealthWorkoutType; startTime: string; endTime: string;
    durationSeconds: number; distanceMeters?: number; calories?: number;
    route?: HealthRoutePoint[]; source?: HealthSource;
  }>) =>
    request<{ ok: boolean; synced: number }>(
      '/health/workouts/sync', { method: 'POST', body: JSON.stringify({ workouts }) }, token,
    ),

  workouts: (token: string, from: string, to: string) =>
    request<HealthWorkoutSummary[]>(`/health/workouts?from=${from}&to=${to}`, {}, token),

  workout: (token: string, id: string) =>
    request<HealthWorkoutDetail>(`/health/workouts/${id}`, {}, token),

  deleteWorkout: (token: string, id: string) =>
    request<null>(`/health/workouts/${id}`, { method: 'DELETE' }, token),

  scores: (token: string, date: string) =>
    request<HealthScores>(`/health/scores?date=${date}`, {}, token),
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
