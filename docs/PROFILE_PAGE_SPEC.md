# Profile (Dashboard) Page — Web Build Spec (design + APIs)

Source of truth: `app/(tabs)/profile.tsx` + `components/HawkEye.tsx` + `lib/api.ts` + `lib/healthKit.ts`.
This is the user's **dashboard** — a 7-day overview of Discipline / Food / Physical (plus Apple-Health recovery & movement when connected), the **Hawk Eye** history modal, entry points to the Mirror / Fuel Analysis / Edit Profile, and settings (Apple Health, theme, logout).

Base URL: `${API_BASE}/api` · Header on every call: `Authorization: Bearer <JWT>` · Dates local `YYYY-MM-DD`.

> ⚠ **Web caveat:** Apple Health (HealthKit) is **iOS-native only**. On the web build, everything gated behind `healthConnected` (Recovery block, Vitals row, AI Body Insight, the Apple Health toggle) will not have data — hide those sections on web, or wire a different data source. Everything else works from the standard API.

---

## 1. Page layout (top → bottom)

```
┌───────────────────────────────────────────────┐
│ <FIRSTNAME>                    [✨] [✎] [⎋]      │  header: name + AI / edit / logout
│ Dashboard                                       │
├───────────────────────────────────────────────┤
│ ┌ Hero Dashboard card ───────────────────────┐  │
│ │  ‹ TODAY ›   [BUILDING]        STREAK 🔥 5  │  │  day nav + status + streak
│ │            ( ◔ Overall 72 )                 │  │  gauge
│ │  DISCIPLINE | (RECOVERY) | NUTRITION | (MOV)│  │  breakdown bars
│ │  [Recovery ring + sleep/HRV/RHR]  (Health)  │  │
│ │  [❤ bpm · 🌙 sleep · 👣 steps · 🔥 kcal]     │  │  vitals (Health)
│ └─────────────────────────────────────────────┘  │
│ ┌ Hawk Eye ───────────────────────────────► ┐   │  opens Hawk Eye modal
│ ┌ THE MIRROR — See who you're becoming ────► ┐   │  → /mirror
│ ┌ 7-DAY SCORE  AVG 68   [HABITS|FOOD|PHYS] ─┐   │  mini bar chart
│ ┌ AI BODY INSIGHT (Health, today only) ─────┐   │
│ ┌ FOOD / PHYSICAL / DISCIPLINE insight rows ┐   │
│ ┌ Fuel Analysis ───────────────────────────►┐   │  → /building-you
│ ┌ Apple Health  [toggle] ───────────────────┐   │
│ ┌ Appearance  [☀ | 🌙] ─────────────────────┐   │
└───────────────────────────────────────────────┘
```

- **Header:** first name + "Dashboard"; ✨ → AI (`/(tabs)/ai`), ✎ → Edit Profile (`/edit-profile`), ⎋ → logout (confirm dialog → `useAuth().logout()`).
- Loads a **7-day window** (today − 6 … today). Refetches on pull-to-refresh and whenever the tab regains focus.

## 2. Hero Dashboard card

- **Day nav** ‹ / › to move the highlighted day within the 7-day window (can't go past today); label shows TODAY / YESTERDAY / `Wed, Aug 6`.
- **Status pill** from the selected day's overall: `≥70` BUILDING (green) · `40–69` WAVERING (amber) · `>0` BELOW POTENTIAL (red) · `0` UNLOGGED.
- **Streak** = consecutive prior days (before today) with discipline > 0.
- **Gauge** (`components/Gauge.tsx`) shows **Overall Score** = equal-weight average of the pillars that have data for the selected day: Discipline + Nutrition always; Recovery + Movement only for **today** and only when Apple Health is connected.
- **Breakdown bars:** DISCIPLINE, (RECOVERY if health), NUTRITION, (MOVEMENT if health) — each a number + colored mini-bar (green ≥70 / amber ≥40 / red <40; `—` when no data).
- **Recovery block** (health only): a recovery ring + status pill (RECOVERED/RECOVERING/LOW) + copy, and SLEEP / HRV / RESTING HR stats.
- **Vitals row** (health only): resting HR (bpm), sleep (h m), steps, active energy (kcal).

## 3. Hawk Eye button → Hawk Eye modal

Tapping the "Hawk Eye — Full history · Calendar · Countdown" card opens **`HawkEyeModal`** (`components/HawkEye.tsx`). It's a full-screen sheet with two modes:

### CALENDAR mode
- Shows ~8 months (3 months back … 4 ahead), Monday-aligned, auto-scrolled to the current month.
- **Filter panel** (three options): **Calendar** (plain), **🏷 Habit**, **🥗 Food**.
  - **Habit filter:** horizontal chips of the user's active habits. Selecting one overlays each day as ✓ done (green) / ✕ missed (red) using that habit's completion history.
  - **Food filter:** three metrics — **Meal Quality** (0–10 color-coded per day), **Junk Food** (✓ avoided / ✕ had junk), **Correct Meal** (✓ stuck / ✕ didn't) — overlaid from fuel history.
- Legend adapts to the active filter.

### COUNTDOWN mode
- A goal countdown grid. If none set, a **setup form**: Start date (YYYY-MM-DD), a duration preset (21/30/60/90/100) or custom days, or an explicit end date → "Start Countdown."
- Once set: a banner (START · DAYS LEFT · END), `X/Y days done`, `% complete`, and a numbered day grid. Reset via a confirm dialog.
- **The countdown is stored locally only** in AsyncStorage under `grittt_hawkeye_countdown` (`{start,end}`) — no backend. On web, use `localStorage`.

## 4. Other cards / entry points
- **The Mirror card** → navigates to `/(tabs)/mirror` (the premium AI identity page).
- **7-DAY SCORE chart:** `AVG N / 100` + a HABITS / FOOD / PHYS toggle; 7 mini bars (today highlighted lime).
- **AI Body Insight** (health + today only): a heuristic headline comparing recovery vs discipline — **computed client-side, no API call.**
- **Insight rows** (FOOD / PHYSICAL / DISCIPLINE): each shows today's value, a status pill, a coaching line, and delta vs the 7-day discipline average — all **computed client-side**.
- **Fuel Analysis row** → `/(tabs)/building-you`.
- **Apple Health toggle** → connect/disconnect (§6).
- **Appearance toggle** → light/dark (local theme, no API).

## 5. States
- **Loading:** full-screen loader on first load.
- **Error (all calls failed):** "Couldn't load your dashboard." + Retry.
- Individual cards degrade to `—` / "NOT ENOUGH DATA" when their data is missing (uses `Promise.allSettled`, so one failing call doesn't blank the page).

---

## 6. APIs used by this page

All under `${API_BASE}/api` with the Bearer token. Wrappers in `lib/api.ts`.

### On load (fired together via `Promise.allSettled`)
| Call | Method + path | Purpose | Returns |
|---|---|---|---|
| `habits.disciplineRange` | `GET /habits/discipline/range?from=&to=` | Daily discipline scores (7-day) | `Array<{ date, buildScore, controlScore, overallScore, buildDone, buildTotal, controlDone, controlTotal }>` |
| `fuel.history` | `GET /fuel/history?from=&to=` | Daily food score (7-day) | `Array<{ date, foodQuality, hadJunkFood, stuckToMeal, score }>` |
| `strength.history` | `GET /strength/history?from=&to=` | Daily physical score (7-day) | `Array<{ date, score }>` |
| `strength.identity` | `GET /strength/identity` | Strength level/XP | `StrengthIdentity` |
| `fuel.identity` | `GET /fuel/identity` | Fuel level/XP | `FuelIdentity` |
| `habits.shields` | `GET /habits/shields` | Streak shields status | `{ monthKey, used: string[], remaining, max }` |
| `health.scores` | `GET /health/scores?date=<today>` | Recovery + movement (Apple Health) | `HealthScores` |

The page merges the three range arrays by date into `DayData[] = { date, discipline: overallScore, food: score, physical: score }`.

### Apple Health connect (toggle) — iOS only
The toggle drives the native HealthKit helper (`lib/healthKit.ts`), which then pushes to the backend:
| Step | Call | Method + path | Body |
|---|---|---|---|
| Check availability / permission | `healthKit.isAvailable()`, `healthKit.requestAuthorization()` | (native HealthKit) | — |
| Push metrics | `health.syncMetrics` | `POST /health/metrics/sync` | `{ metrics: [{ date, metricType, value, unit, source:'healthkit' }] }` → `{ ok, synced }` |
| Push workouts | `health.syncWorkouts` | `POST /health/workouts/sync` | `{ workouts: [{ externalId, workoutType, startTime, endTime, durationSeconds, distanceMeters?, calories?, route?, source }] }` → `{ ok, synced }` |
| Then re-read | `health.scores` | `GET /health/scores?date=` | — |
- Connection state persisted locally in AsyncStorage `grittt_health_connected` (`'true'`/`'false'`). Disconnecting just hides the cards; already-synced data stays on the backend.

### Hawk Eye modal
| Call | Method + path | Purpose |
|---|---|---|
| `tasks.list` | `GET /tasks` | Habit chips for the habit filter |
| `habits.history` | `GET /habits/history?name=&from=&to=` | Done/missed overlay for a selected habit → `{ name, dates: string[] }` |
| `fuel.history` | `GET /fuel/history?from=&to=` | Food-metric overlay (quality/junk/meal) |
| (local) | AsyncStorage `grittt_hawkeye_countdown` | Countdown persistence — no backend |

### Navigations (no API)
- ✎ → `/edit-profile` · The Mirror → `/(tabs)/mirror` · Fuel Analysis → `/(tabs)/building-you` · ✨ → `/(tabs)/ai`.

---

## 7. Request/response types (from `lib/api.ts`)

```ts
// GET /habits/discipline/range
type DisciplineDay = {
  date: string;
  buildScore: number; controlScore: number; overallScore: number;   // ← 'physical' uses overallScore
  buildDone: number; buildTotal: number;
  controlDone: number; controlTotal: number;
};

// GET /fuel/history
type FuelHistoryDay = {
  date: string;
  foodQuality: number | null;
  hadJunkFood: boolean | null;
  stuckToMeal: boolean | null;
  score: number | null;         // ← 'food' pillar
};

// GET /strength/history
type StrengthHistoryDay = { date: string; score: number };   // ← 'physical' pillar

// GET /strength/identity  &  /fuel/identity
type Identity = { totalXP: number; levelIndex: number; levelName: string; nextLevel?: string; xpToNext?: number };

// GET /habits/shields
type Shields = { monthKey: string; used: string[]; remaining: number; max: number };

// GET /health/scores?date=
type HealthScores = {
  date: string;
  recovery: {
    score: number | null;
    sleepHours: number | null;
    heartRateVariability: number | null;   // ms
    restingHeartRate: number | null;        // bpm
  };
  movement: {
    score: number | null;
    steps: number | null;
    activeEnergyBurned: number | null;      // kcal
  };
};

// Health sync payload types
type HealthMetricType =
  | 'steps' | 'activeEnergyBurned' | 'restingHeartRate' | 'heartRateAvg' | 'heartRateVariability'
  | 'sleepHours' | 'bodyMass' | 'distanceWalkingRunning' | 'flightsClimbed';
type HealthRoutePoint = { lat: number; lng: number; timestamp: string; altitude?: number };
```

## 8. Client-side computed values (no endpoint — replicate these)
- **Overall (gauge):** `round(avg(of available: discipline, nutrition, [recovery today], [movement today]))`.
- **Streak:** count back from yesterday while `discipline > 0`.
- **7-day AVG:** mean of the selected chart tab's 7 values.
- **Trend / insight copy / AI Body Insight:** all heuristics from the day values (thresholds in the code: e.g. delta > 8 = "GETTING BETTER", recovery ≥70 & discipline <50 = mismatch insight). See `trendAnalysis()` and `DashSection` in `profile.tsx`.
- **Recovery/Movement only populate for TODAY** (the scores endpoint is fetched for the current date only); past days show `—`.

## 9. Color reference
- Score tiers: green `#22A664`/`#34C759` ≥70 · amber `#F0A12E`/`#F59E0B` 40–69 · red `#E84A4A`/`#EF4444` <40.
- Lime/hype accent: `#B8F23A`. Mirror card bg `#14110D`. Heart/health red `#FF2D55`. Health-connected switch green `#34C759`.
```
