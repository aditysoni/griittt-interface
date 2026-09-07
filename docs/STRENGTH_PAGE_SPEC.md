# Strength Page — Web Build Spec (design + APIs)

Source of truth: `app/(tabs)/strength.tsx` + `lib/api.ts` (`strength.*`).
Internally "STRENGTH MODE." One day at a time (date selector + swipe). Two logging modes: **QUICK** (a 1–10 effort rating) and **DETAILED** (a full Gym / Sports / Cardio session). All writes reload the day after saving.

Base URL: `${API_BASE}/api` · Header on every call: `Authorization: Bearer <JWT>` · Dates are local `YYYY-MM-DD`.

---

## 1. Page layout (top → bottom)

```
┌──────────────────────────────────────────────┐
│ STRENGTH MODE                     [✨] [⚙]     │  header
├──────────────────────────────────────────────┤
│  ‹  date selector (week strip)  ›              │  DaySelector + swipe
├──────────────────────────────────────────────┤
│  ┌ Strength Score Card ───────────────────┐    │  hero: today score + trend + 7-day squares
│  │ TODAY'S STRENGTH   47      ↑ GETTING…   │    │
│  │ ───────────────────────────────────────│    │
│  │ [47][·][62][55][·][70][47]  (M T W…)    │    │
│  └─────────────────────────────────────────┘    │
│  [   QUICK   |   DETAILED   ]                    │  mode toggle (only if canLog)
│                                                 │
│  (QUICK)  rating hero card + LOG RATING          │
│  (DETAILED) Gym / Sports / Run cards → forms     │
│                                                 │
│  TODAY'S SESSIONS  02 LOGGED                     │  list of logged session cards
│  ┌ session card ┐ ┌ session card ┐ …             │
└──────────────────────────────────────────────┘
```

- **Header:** ✨ → AI page (`/(tabs)/ai`), ⚙ → Profile.
- **Date rules:** log **today or any past day**; future = view-only (`canLog = selectedDate <= today`). `canNext` disabled on today.
- **Today's score** shown = the **max `score` of that day's logged sessions** (0 if none).

## 2. Strength Score Card (hero, always visible)

- Big score number, colored: `≥70` green `#22A664` · `50–69` amber `#F0A12E` · `1–49` red `#E84A4A` · `0` muted. Card border uses the same color.
- **Trend pill** (computed client-side from the 7-day history): splits the scored days in half, compares recent vs early average → `GETTING BETTER ↑` (diff > 8, green) / `DECLINING ↓` (diff < −8, red) / `CONSISTENT →` (blue) / `SHOWING UP ·` (fewer than 3 scored days).
- **Delta line:** `+N vs last 7 days` = today's score minus the average of the previous 6 days.
- **7-day squares strip:** last 7 days, each a colored square with the score (or `·` if none), day letter (M–S), selected day outlined. Colors same thresholds as above; empty days = faded grey.
- Data comes from `strength.history` (see §6).

## 3. QUICK mode — rating hero card

- Eyebrow `HOW DID IT GO?`, a big `<rating>/10` (tap opens a scroll picker 0–10), a tier label + copy that changes with the rating:
  | Rating | Tier | Color | Copy |
  |---|---|---|---|
  | 1–2 | WRECKED | red | "Tough one. Recovery is the work today." |
  | 3–4 | LOW | red | "Showed up. That counts." |
  | 5–6 | STEADY | amber | "Solid effort — kept the streak alive." |
  | 7–8 | STRONG | green | "Real work today. You earned this." |
  | 9–10 | ELITE | green | "Top tier. Don't stop now." |
- **10-segment bar** (tap a segment to set the rating) with ticks `1 · COOKED` … `10 · ELITE`. Default rating = 7.
- **LOG RATING** button → `strength.log` with `{ mode:'simple', date, rating, streak:0 }`. Shows "LOGGING…".

## 4. DETAILED mode — full session

Section hint `OR LOG A FULL SESSION`, then 3 training-type cards:

| Card | key | Sub | Opens |
|---|---|---|---|
| 🏋️ GYM | `gym` | "Pick a body part" | body-part grid → exercise/sets modal |
| 🏀 SPORTS | `sports` | "Pick a sport" | inline sport form |
| 🏃 RUN / WALK | `cardio` | "Time & distance" | inline cardio form |

### 4a. GYM
- Body-part grid (all `BODY_PARTS` except cardio): CHEST 🫁, BACK 🔙, SHOULDERS 💪, LEGS 🦵, BICEPS 💪, TRICEPS 🦾, ABS 🟫 — each with its own accent color. Tapping one opens the **Exercise modal**.
- **Exercise modal:** exercise suggestion chips (per body part) + free-text name → add **sets** (REPS required, WEIGHT kg optional; weight 0 = bodyweight) → **ADD SET** builds a list → **SAVE EXERCISE** pushes it to the session → repeat → **SAVE SESSION**.
  - Exercise suggestions per body part are hardcoded (e.g. chest: Bench Press, Incline Press, Dumbbell Flies, Push-ups, Cable Crossover, Dips). Full map in `lib/api.ts` `EXERCISE_SUGGESTIONS`.
- Saves via `strength.log` with `{ mode:'detailed', date, category:'strength', bodyPart, activity:<bodypart label lowercased>, intensity:7, exercises:[{name, sets:[{reps, weight}]}], streak:0 }`.

### 4b. SPORTS
- Sport suggestion chips (Basketball, Football, Soccer, Tennis, Cricket, Badminton, Volleyball, Swimming, Table Tennis, Squash) + free-text. Fields: DURATION (min), INTENSITY (/10, default 7).
- Saves via `strength.log` with `{ mode:'detailed', date, category:'games', activity:<sport>, durationMins, intensity, streak:0 }`. Requires a sport name.

### 4c. CARDIO (Run / Walk)
- Activity toggle Running / Walking. Fields: DISTANCE (km), DURATION (min), INTENSITY (/10, default 6). Requires distance OR duration.
- Saves via `strength.log` with `{ mode:'detailed', date, category:'cardio', activity:'Running'|'Walking', durationMins, distanceKm, intensity, streak:0 }`.

## 5. Logged session cards + states

- Header shows `TODAY'S SESSIONS` (or `SESSIONS`) + `NN LOGGED`.
- **Session card** renders differently per type:
  - Quick → `QUICK LOG`, `Rated N/10` + word (Rest…Elite).
  - Cardio → `<distance> km · <duration> min`, `INTENSITY N/10`.
  - Sports → `<duration> min`, `INTENSITY N/10`.
  - Gym → per-exercise rows: `name` + `N sets · 10@40kg / 8@45kg …`.
  - Every card shows the time it was logged + a `score/100` pill.
- **Loading:** full-screen loader on first load.
- **Error:** "Couldn't load your training log." + Retry.
- **Empty past day:** `NO ACTIVITY DATA FOR THIS DAY`.

---

## 6. APIs used by this page

All under `${API_BASE}/api` with the Bearer token. Wrappers in `lib/api.ts`.

### On load / refresh / date change
| Call | Method + path | Purpose |
|---|---|---|
| `strength.logs` | `GET /strength/logs?date=YYYY-MM-DD` | The selected day's sessions → `WorkoutLog[]` |
| `strength.history` | `GET /strength/history?from=YYYY-MM-DD&to=YYYY-MM-DD` | Last 14 days (page uses today−13…today) → `Array<{ date, score }>` for the hero card |

### Logging (all POST `/strength/log`, return `LogResult`)
| Mode | Body |
|---|---|
| Quick rating | `{ mode:'simple', date, rating, streak:0 }` |
| Gym | `{ mode:'detailed', date, category:'strength', bodyPart, activity, intensity:7, exercises:[{name, sets:[{reps, weight}]}], streak:0 }` |
| Sports | `{ mode:'detailed', date, category:'games', activity, durationMins?, intensity, streak:0 }` |
| Cardio | `{ mode:'detailed', date, category:'cardio', activity, durationMins?, distanceKm?, intensity, streak:0 }` |

### Related strength endpoints (NOT called on this screen — used on Profile, but same domain)
| Call | Method + path | Returns |
|---|---|---|
| `strength.identity` | `GET /strength/identity` | `StrengthIdentity` (XP + level) |
| `strength.leaderboard` | `GET /strength/leaderboard?date=` | `{ date, leaderboard: LeaderboardEntry[] }` |

---

## 7. Request/response types (from `lib/api.ts`)

```ts
// ── Logging ──────────────────────────────────────────────
type SetEntry = { reps: number; weight: number };          // weight in kg; 0 = bodyweight
type ExerciseEntry = { name: string; sets: SetEntry[] };
type BodyPart = 'chest'|'back'|'shoulders'|'legs'|'biceps'|'triceps'|'abs'|'cardio';

// POST /strength/log request
type StrengthLogRequest = {
  mode: 'simple' | 'detailed';
  date: string;                 // YYYY-MM-DD (local)
  streak?: number;              // app always sends 0
  // simple:
  rating?: number;              // 1–10
  // detailed:
  category?: 'strength' | 'cardio' | 'games';
  activity?: string;            // sport name / 'Running' / body-part label
  durationMins?: number;
  intensity?: number;           // 1–10
  distanceKm?: number;
  exercises?: ExerciseEntry[];
  bodyPart?: BodyPart;
};

// POST /strength/log response
type LogResult = {
  logId: string;
  score: number;                // 0–100 for this session
  xpEarned: number;
  totalXP: number;
  levelIndex: number;
  levelName: string;
  levelChanged: boolean;        // true → show "Level Up!"
};

// ── GET /strength/logs?date= → WorkoutLog[] ──────────────
type WorkoutLog = {
  id: string;
  mode: 'simple' | 'detailed';
  category: 'strength' | 'cardio' | 'games' | null;
  rating: number | null;        // simple mode
  activity: string | null;
  durationMins: number | null;
  distanceKm: number | null;
  intensity: number | null;
  notes: string | null;
  exercises: ExerciseEntry[] | null;
  bodyPart: BodyPart | null;
  score: number;                // 0–100
  createdAt: string;            // ISO timestamp
};

// ── GET /strength/history?from=&to= ──────────────────────
type StrengthHistoryRow = { date: string; score: number };   // max score that day

// ── GET /strength/identity (Profile) ─────────────────────
type StrengthIdentity = {
  totalXP: number;
  levelIndex: number;           // 0-based, 12 levels
  levelName: string;            // Starter → Mythic
  nextLevel?: string;
  xpToNext?: number;
  updatedAt: string;
};

// ── GET /strength/leaderboard?date= (Profile) ────────────
type LeaderboardEntry = { userId: string; userName: string; avatar: string | null; score: number };
```

## 8. Business rules the design reflects (from the backend `services/strength.ts`)

- **Score** = `(completedWeight/totalWeight×100 − missedWeight×0.3) × (1 + streak×0.02)`, floored at 0, capped 100. For quick mode the rating drives it server-side.
- **XP** = `completedWeight×10 + streak×5 − missedWeight×2`.
- **Level** = `floor(sqrt(totalXP/100))`, capped at index 11 → 12 named levels: Starter, Initiate, Committed, Consistent, Disciplined, Relentless, Forged, Hardened, Elite, Unbreakable, Titan, Mythic. `levelChanged:true` in the log response = show a "Level Up!" celebration.
- Re-logging a day doesn't double-count XP (server uses a delta).

## 9. Color reference
- Score thresholds: green `#22A664` ≥70 · amber `#F0A12E` 50–69 · red `#E84A4A` 1–49.
- Body-part accents: chest `#FF6B6B`, back `#4ECDC4`, shoulders `#FFD93D`, legs `#6BCB77`, biceps `#4D96FF`, triceps `#C77DFF`, abs `#F0A12E`, cardio `#34C759`.
- Rating tiers: red ≤4 / amber 5–6 / green ≥7. Lime accent (buttons/arrows): `#B8F23A` / `#34C759`.
```
