# Habits (Discipline) Page — Web Build Spec

Source of truth: `Grittt-app/app/(tabs)/index.tsx` + `Grittt-app/lib/api.ts`.
This page is the app home. Internally called **"DISCIPLINE MODE / LOCK IN."** It has two views via a segmented toggle: **BUILD** habits and **CONTROL** habits. Every write is optimistic (update UI first, reconcile with server).

Base URL for all calls: `${API_BASE}/api` · Auth header on every request: `Authorization: Bearer <JWT>`.

---

## 1. Page layout (top → bottom)

```
┌───────────────────────────────────────────────┐
│ DISCIPLINE MODE                    [✨] [⚙]     │  ← header
│ LOCK IN                                         │
├───────────────────────────────────────────────┤
│  [ ‹ ]   date selector (week strip)   [ › ]     │  ← DaySelector; swipe left/right changes day
├───────────────────────────────────────────────┤
│                  ╭─────────╮                    │
│                 (   73     )   arc gauge         │  ← score derived from checklist (0–100)
│                  ╰ OUT/100 ╯                     │
│              ↑ BUILDING MOMENTUM                 │  ← momentum pill
│                                                 │
│   [   BUILD   |   CONTROL   ]                   │  ← segmented control (animated pill)
│   3 / 5 DONE                    +18 SCORE       │  ← stats row (for the active tab)
│                                                 │
│   ┌ habit card ┐  ┌ habit card ┐ ...            │  ← list of BUILD or CONTROL cards
│                                                 │
│                    ( + )                        │  ← floating add button (opens Add Habit modal)
└───────────────────────────────────────────────┘
```

---

## 2. Header

- Eyebrow text: `DISCIPLINE MODE`. Title: `LOCK IN`.
- **✨ Sparkle button** → navigates to the AI Coach page (`/(tabs)/ai`).
- **⚙ Settings button** → navigates to Profile (`/(tabs)/profile`).

## 3. Date selector

- Week strip (`DaySelector`) + left/right swipe (`DateSwipe`) to move between days.
- **Rules:** you can view/log **today and any past day**. Future days = view-only, cannot log (`canLog = selectedDate <= today`). `canNext` is disabled on today.
- Date format used everywhere: `YYYY-MM-DD` in the device's **local** timezone.
- Changing the date reloads the list and clears the local "Y-pressed" state.

## 4. Arc gauge (daily score)

- 220° arc, big number in center, caption `OUT OF 100`.
- **Score is computed on the client from the current checklist** (not fetched), so it always matches what's ticked. Formula (mirrors server):
  - Each habit's weight = `max(toughness score, 1)`.
  - `buildScore = (sum of weights of done build habits / sum of all build weights) × 100`
  - `controlScore = (sum of weights of done control habits / sum of all control weights) × 100`
  - If only build habits exist → `buildScore`. If only control → `controlScore`.
  - If both → `round(buildScore × 0.6 + controlScore × 0.4)`.
- **Color thresholds:** `≤33` red (danger) · `34–66` amber (warning) · `≥67` green (success).

## 5. Momentum pill (label under gauge, from the same score)

| Score | Label | Arrow | Color |
|---|---|---|---|
| ≥ 75 | CRUSHING IT | ↑ | green `#22A664` |
| 50–74 | BUILDING MOMENTUM | ↑ | amber `#F0A12E` |
| 25–49 | WAVERING | → | amber `#F0A12E` |
| 1–24 | BELOW POTENTIAL | ↓ | red `#E84A4A` |
| 0 | SHOW UP | · | muted grey |

## 6. Segmented control + stats row

- Two tabs: **BUILD** / **CONTROL** with an animated sliding pill.
- Stats row shows, **for the active tab only**:
  - Left: `<done count> / <total count> DONE`
  - Right: `+<sum of toughness scores of done habits> SCORE`

---

## 7. BUILD habit card

Layout: `[checkbox] NAME + meta …………… +<score>  [📊 info]`

- **Checkbox (left):** tap the whole card to toggle done/undone (lime when done, `#B8F23A` dark / `#16A34A` light).
- **Name:** uppercase; strikethrough + muted when done.
- **Meta line:** `+<score>% DISCIPLINE`; if streak > 0 show `🔥 <streak>`; if it's a count habit and done, show a count badge `<count> <unit>` (green).
- **Right:** the toughness score as `+<score>` (big number).
- **📊 info button:** opens the Habit Detail modal.
- **Long-press card:** opens a menu → **Edit** / **Delete** / Cancel.
- **Yellow border** (`#F0A12E`, thicker) if this habit came from an active Challenge.

**Interactions:**
- Tapping a **non-count** build habit → immediately completes/uncompletes it.
- Tapping a **count-tracked** build habit that isn't done yet → opens the **Count modal** ("COUNT TODAY") instead of toggling. Tapping again when already done → uncompletes.

## 8. CONTROL habit card

Same left/name area, but the right side has **two circles: `Y` and `N`** (no single score number). Control habits are things you're resisting; the question is "did you do the bad thing?"

- **N circle (green `#22A664`):** "No, I stayed controlled." Selecting N = **completion** (earns the score). Meta shows `+<score>% CONTROLLED` (green).
- **Y circle (red `#E84A4A`):** "Yes, I slipped." Y = **failed**; earns no discipline point. Meta shows `FAILED` (red), name turns red, streak hidden.
- **Un-answered:** neither active (default state).
- **Count-tracked control habits** (all control habits default to count-tracked — see form): pressing **Y** opens the **Count modal** ("HOW MANY TODAY?") so the user logs how many times (e.g. cigarettes: 3). The count is stored on a **failed** completion and shown as a red badge. Pressing **N** clears any count (0 violations).
- Selecting N when Y was set (or vice-versa) switches the answer.

**"Number of times we did it" lives here:** it's the `count` field, entered via the Count modal on the **Y** press for control habits (and optionally on build habits with Track Count on). It's shown as a badge on the card and as the number inside the 28-day heatmap cell in the detail modal.

## 9. List states

- **Loading:** full-screen loader on first load.
- **Empty:** `No <build|control> habits yet. Tap + to add one.`
- **Error (and list empty):** error card with a **Retry** button.
- **Pull-to-refresh** reloads.

---

## 10. Add Habit modal (opened by the floating **+**)

Title `NEW HABIT`. Fields top → bottom:

1. **TYPE toggle:** `BUILD` / `CONTROL`.
2. **QUICK PICK** (only when type = CONTROL): preset chips, each sets name + unit. Presets: Cigarettes (cigs), Alcohol (drinks), Masturbation (times), Instagram / Reels (minutes), Gambling (sessions), Junk Food (times), Social Media (minutes), Caffeine (cups).
3. **HABIT NAME:** text input (auto-uppercase). Placeholder differs by type.
4. **TRACK COUNT** checkbox (only shown for BUILD; for CONTROL it's forced ON). Hint: "e.g. glasses of water, pages read."
5. **UNIT (optional):** text input, shown when control OR track-count is on. Placeholder e.g. "cigarettes, drinks, minutes…" / "glasses, pages, reps…".
6. **DAYS:** 7 day chips `M T W T F S S` (index 0=Mon … 6=Sun) + an **ALL** toggle. Defaults to all 7.
7. **TOUGHNESS:** horizontal chips 1–10, colored green (1–3) / amber (4–6) / red (7–10). Default 5. This becomes the habit's weight/score.
8. **ADD HABIT** button (disabled until name is non-empty; shows "ADDING…").

Maps to `POST /api/tasks` with `{ name, category, score, days, trackCount, countUnit }`. For control, `trackCount` is always `true`.

## 11. Count modal

- Title: `HOW MANY TODAY?` (control Y) · `HOW MUCH TODAY?` (control) · `COUNT TODAY` (build). Subtitle = habit name.
- Big number input (numeric), optional unit label beside it.
- Buttons: **CANCEL** / **SAVE**. Empty input = 0. Rejects negative/NaN.
- On save: build/N path → normal completion with count; control-Y path → **failed** completion with count.

## 12. Habit Detail modal (opened by 📊 or Edit menu)

**View mode:**
- Header: habit name + a percentile line — either `Only you have this habit — set the standard.` or `Doing better than <X>% of people with this habit` (color-graded).
- **3 stat cells:** `CONSISTENCY <n>%` (green≥70/amber≥40/red) · `DAYS DONE <n>` · `STREAK 🔥<n>` (or `—`).
- **SCHEDULE:** 7-day row showing which days the habit runs.
- **LAST 28 DAYS heatmap:** Mon-aligned 4-week grid. Cell colors: green `#22A664` = done · red `#E84A4A` = violated (control, shows the count number or ✕) · surface grey = missed · inverse = today. Legend below (Done / Violated [control only] / Missed / Today).
- **Actions:** **DELETE** (red, confirm dialog) · **EDIT**.
- **AI ANALYSIS** button → runs per-habit AI, renders a trend badge + 3 sections (`YOUR CONSISTENCY / REAL IMPACT / 6 MONTHS FROM NOW`).

**Edit mode:** editable NAME, DAYS (min 1 day), TOUGHNESS (1–10); **CANCEL** / **SAVE**. Maps to `PUT /api/tasks/:id` with `{ name, score, days }`.

---

## 13. API calls used by this page

All under `${API_BASE}/api`, all with the Bearer token. Client wrappers are in `lib/api.ts`.

### On load / refresh / focus / date change
| Call | Method + path | Purpose | Request | Response (shape) |
|---|---|---|---|---|
| `tasks.list` | `GET /tasks` | All the user's habits | — | `Task[]` |
| `habits.allStatus` | `GET /habits/all/status?date=YYYY-MM-DD` | Per-habit done/failed/count/streak for the selected day | — | `Array<{ id, normalized_name, done, yFailed, count, streak }>` |
| `challenges.list` | `GET /challenges` | To draw yellow border on challenge-linked habits | — | `Challenge[]` (uses `status==='active'` + `title`) |

The page **merges** `tasks.list` + `allStatus` by task `id` into the card model `{...task, done, yFailed, streak, count}` (archived tasks filtered out).

### Completing / logging
| Action | Call | Method + path | Body |
|---|---|---|---|
| Complete build habit / control **N** | `habits.complete` | `POST /habits/:name/completions` | `{ taskId, date }` |
| Complete with a count (build track-count / **N**) | `habits.complete` | `POST /habits/:name/completions` | `{ taskId, count, date }` |
| Control **Y** with count (a "failure", counts times) | `habits.complete` | `POST /habits/:name/completions` | `{ taskId, count, failed: true, date }` |
| Uncomplete (untick, or switch Y↔N) | `habits.uncomplete` | `DELETE /habits/:name/completions?date=YYYY-MM-DD` | — |

- `:name` is the habit name, URL-encoded. `date` is the selected local day (important so it lands on the right calendar day).
- Response of complete: `{ ok: true, count: number|null }`. Uncomplete: `204`.

### Create / edit / delete habit
| Action | Call | Method + path | Body |
|---|---|---|---|
| Add habit | `tasks.create` | `POST /tasks` | `{ name, category:'build'|'control', score, days:number[], trackCount:boolean, countUnit:string|null }` → returns the new `Task` |
| Edit habit | `tasks.update` | `PUT /tasks/:id` | `{ name, score, days }` (partial) → `Task` |
| Delete habit | `tasks.delete` | `DELETE /tasks/:id` | — → `204` (past completions are kept) |

### Habit Detail modal
| Call | Method + path | Purpose | Response |
|---|---|---|---|
| `habits.stats` | `GET /habits/:name/stats` | Consistency, streaks, percentile, 28-day data | `{ consistency, currentStreak, longestStreak, totalDone, daysActive, percentile, totalUsersWithHabit, doneDates: string[], completions: Array<{date, failed, count}> }` |
| `habits.aiAnalysis` | `POST /habits/:name/ai/analysis` | AI trend + impact + projection | `{ trend, sections: Array<{heading, body}> }` (needs ≥3 completions in 30 days, else `trend:'insufficient_data'`) |

### Data types (from `lib/api.ts`)
```ts
type Task = {
  id: string; name: string; normalized_name: string;
  score: number;                 // toughness 1–10 = weight
  days: number[] | null;         // 0=Mon … 6=Sun; null/[] = every day
  archived_at: string | null;    // non-null = hidden (soft delete)
  start_date: string | null;
  category: 'build' | 'control' | string;
  tiny_version: string | null;
  why_started: string | null;
  track_count: boolean;
  count_unit: string | null;     // e.g. "cigs", "glasses"
  created_at: string;
};
```

---

## 14. Optional related endpoints (not called by this exact page, but relevant if you extend it)

These are the server's authoritative discipline-score endpoints — the page currently computes the gauge client-side, but you can read/verify against these:
- `habits.disciplineDay` — `GET /habits/discipline/day?date=` → `{ buildScore, controlScore, overallScore, buildDone, buildTotal, controlDone, controlTotal }`.
- `habits.disciplineRange` — `GET /habits/discipline/range?from=&to=` → array of the above per day (used by the calendar/Hawk Eye + profile trends).
- `habits.history` — `GET /habits/history?name=&from=&to=` → `{ name, dates: string[] }`.
- `habits.dailyScore` — `GET /habits/score/day?date=` → `{ date, score }`.
- `habits.ranking` — `GET /habits/:name/ranking` → users doing the same habit, by streak.
- Streak shields / bad-day (surfaced on Profile, not here): `GET /habits/shields`, `POST /habits/shields/use`, `POST/DELETE /habits/bad-day`.

## 15. Color reference
- Build accent (checkbox/done): `#B8F23A` (dark) / `#16A34A` (light).
- Control N / success / done: `#22A664`. Control Y / fail / violated: `#E84A4A`.
- Toughness & gauge: green ≤3 / amber 4–6 / red 7–10; gauge green ≥67 / amber 34–66 / red ≤33.
- Challenge-linked border + "wavering" amber: `#F0A12E`.
```
