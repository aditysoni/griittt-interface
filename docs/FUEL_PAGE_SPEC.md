# Fuel Page — Web Build Spec (design + APIs)

Source of truth: `app/(tabs)/fuel.tsx` (+ `app/fuel-questions.tsx` for the two shared modals) + `lib/api.ts` (`fuel.*`, `fuelQuestions.*`, `ai.snapTrack`).
Internally "FUEL MODE / EAT CLEAN." One day at a time (date selector + swipe). Two modes: **QUICK** (answer daily fuel-check questions → a checklist score) and **DETAILED** (log individual foods with macros, incl. AI photo scan). All writes reload the day.

Base URL: `${API_BASE}/api` · Header on every call: `Authorization: Bearer <JWT>` · Dates are local `YYYY-MM-DD`.

---

## 1. Page layout (top → bottom)

```
┌──────────────────────────────────────────────┐
│ FUEL MODE / EAT CLEAN            [✨] [⚙]      │  header
├──────────────────────────────────────────────┤
│  ‹  date selector (week strip)  ›              │
├──────────────────────────────────────────────┤
│  ┌ Fuel Score Card ────────────────────────┐   │  ring score + macro totals + 7-day sparkline
│  │  (◔ 62/100)   CAL 1450/2000  PRO 90/150 │   │
│  │               CARBS 160/250  FAT 40/65  │   │
│  │  ── 7-DAY TREND  ∿∿∿ ──                  │   │
│  │  You're eating cleaner than 74% of days │   │
│  └──────────────────────────────────────────┘   │
│  [   QUICK   |   DETAILED   ]                    │  mode toggle
│  YOUR DAY  ● Breakfast — Lunch — ○ Snack — Dinner │  meal timeline
│                                                 │
│  (QUICK)   question cards → LOG FUEL              │
│  (DETAILED) LOG FOOD button → log sheet          │
│                                                 │
│  LOGGED MEALS / WHAT YOU ATE  (list)             │
└──────────────────────────────────────────────┘
```

- **Header:** ✨ → AI page (`/(tabs)/ai`), ⚙ → Profile.
- **Date rules:** log **today or any past day**; future = view-only (`canLog = selectedDate <= today`).
- **Today's score** = the day's **checklist score** (from the fuel questions), `0` if none.

## 2. Fuel Score Card (hero, always visible)

- **Score ring** (0–100) with status color: `≥80` green `#22A664` (CRUSHING IT) · `60–79` blue `#0A84FF` (CONSISTENT) · `40–59` amber `#F0A12E` (SHOWING UP) · `<40` red `#E84A4A` (SLIPPING).
- **Macro totals grid** — sums the day's logged **food items**, shown as `value unit` + `LABEL · /target`. Four macros: CALORIES (kcal, `#FF9500`), PROTEIN (g, `#0A84FF`), CARBS (g, `#34C759`), FAT (g, `#FFD60A`). Targets come from `user.macroTargets` (fallback `{calories:2000, protein:150, fat:65, carbs:250}`).
- **7-DAY TREND sparkline** — line of the last 7 days' checklist scores (needs ≥2 known days, else a flat line).
- **Percentile line** — `You're eating cleaner than X% of your recent days` (today's score vs prior days in the loaded history; hidden if no prior data).

## 3. Meal timeline ("YOUR DAY")

- 4 stops: Breakfast (☀), Lunch (🍽), Snack (🥜), Dinner (🌙). A stop is "done" if any logged food item has a matching `mealTime` (breakfast ← `morning`/`brunch`, lunch ← `lunch`, snack ← `snacks`, dinner ← `evening`/`dinner`). Shows `N of 4 done`.

## 4. QUICK mode — fuel-check questions

- Renders the user's **selected** fuel questions (each `FuelQuestion` with `selected: true`). Each is a card:
  - Title (short, derived from the prompt) + full prompt + `*` if required.
  - `+<weight> pts` pill (filled once answered), optional 🔥 streak, and a 📊 button → **Question Detail modal**.
  - **Options row:** radio chips (2 or 5 options). Tapping selects `optionIndex` for that question.
- **"Add custom question"** (dashed button) → opens **AddCustomModal** (create a custom question).
- **LOG FUEL** button → validates all required questions answered → `fuelQuestions.submitResponses`. On success it **auto-opens the Log Food sheet** so the user can add meals in the same flow.
- Below: **LOGGED MEALS** list (the day's `food_logs` entries rendered as `MealRow`).

## 5. DETAILED mode — food items + macros

- **LOG FOOD** button → opens the **Log Food sheet** (§6).
- Below: **WHAT YOU ATE** list of `FoodItemCard`s — each shows meal-time badge + name + a 2×2 tappable macro grid (CAL/PRO/CARBS/FAT). Editing any value reveals **SAVE CHANGES** → `fuel.editItem`. Trash icon → `fuel.deleteItem`. (Both only on `canLog` days.)

## 6. Log Food sheet (modal)

- **SNAP & TRACK** (camera) + a gallery button → `ai.snapTrack` (see §7). On success it auto-fills name + macros; on "no food" it prompts to retry/enter manually.
- **OR ENTER MANUALLY**: Food name input.
- **NUTRITION (OPTIONAL)**: 2×2 grid — CALORIES (🔥), PROTEIN (💪), CARBS (🌾), FIBRE (🌱). (Note: manual grid uses **fibre** as the 4th; the item cards & score card show **fat** — both fields are sent.)
- **RECENTLY EATEN**: chips of recently-logged foods (session-local, deduped) → tap to prefill everything.
- **WHEN**: meal-time chips — `morning 🌅 · brunch ☕ · lunch 🥗 · evening 🌆 · dinner 🍽️ · snacks 🍎`.
- **LOG FOOD →** → `fuel.addItem`. Requires a food name; macros optional.

## 7. Logged entries + states

- **MealRow** (`food_logs`, QUICK): "QUICK LOG" / "NUTRITION LOG" + time + `+score` pill; shows CORRECT MEAL / JUNK FOOD (yes/no colored), FOOD QUALITY /10, or detailed CALORIES/PROTEIN/MEALS/JUNK stats vs targets + notes.
- **FoodItemCard** (`food_items`, DETAILED): described in §5.
- **Loading:** full-screen loader first load. **Error:** "Couldn't load your fuel log." + Retry. **Empty past day:** `NO FUEL DATA FOR THIS DAY` (quick) / `NO FOOD LOGGED FOR THIS DAY` (detailed).

---

## 8. APIs used by this page

All under `${API_BASE}/api` with the Bearer token. Wrappers in `lib/api.ts`.

### On load / refresh / date change (fired together via Promise.allSettled)
| Call | Method + path | Purpose |
|---|---|---|
| `fuel.identity` | `GET /fuel/identity` | Fuel level/XP → `FuelIdentity` |
| `fuel.logs` | `GET /fuel/logs?date=` | Day's `food_logs` → `FoodLog[]` |
| `fuel.items` | `GET /fuel/items?date=` | Day's food items → `FoodItem[]` |
| `fuelQuestions.scoreRange` | `GET /fuel/questions/score?from=&to=` | 14-day checklist scores → `{ days: [{date, checklistScore, answeredCount}] }` |
| `fuelQuestions.catalog` | `GET /fuel/questions/catalog` | All questions (preset+custom) w/ `selected` + `streak` → `FuelQuestion[]` |
| `fuelQuestions.getResponses` | `GET /fuel/questions/responses?date=` | The day's saved answers → `FuelQuestionResponses` |

### Writes
| Action | Call | Method + path | Body |
|---|---|---|---|
| Submit quick check-in | `fuelQuestions.submitResponses` | `POST /fuel/questions/responses` | `{ date, answers: [{questionId, optionIndex}] }` → `FuelQuestionResponses` |
| Add a food item | `fuel.addItem` | `POST /fuel/items` | `{ date, name, mealTime, calories?, protein?, fat?, carbs?, fibre? }` → `FoodItem` |
| Edit a food item | `fuel.editItem` | `PUT /fuel/items/:id` | partial `{ name?, mealTime?, calories?, protein?, fat?, carbs?, fibre? }` → `FoodItem` |
| Delete a food item | `fuel.deleteItem` | `DELETE /fuel/items/:id` | — → `204` |
| AI photo scan | `ai.snapTrack` | `POST /ai/snap-track` | `{ imageBase64: "data:image/jpeg;base64,..." }` → `{ name, calories, protein, carbs, fats, servingNote }` |

### Custom-question modals (from `fuel-questions.tsx`, opened on this page)
| Action | Call | Method + path | Body |
|---|---|---|---|
| Create custom Q | `fuelQuestions.createCustom` | `POST /fuel/questions/custom` | `{ prompt, options:string[2 or 5], weight?, reverseScoring?, required? }` |
| AI suggest weight | `fuelQuestions.suggestWeight` | `POST /fuel/questions/ai/suggest-weight` | `{ prompt, options }` → `{ weight, reasoning }` |
| Question history | `fuelQuestions.history` | `GET /fuel/questions/:id/history?days=30` | → `{ question, avgScore, answers:[{date, optionIndex, optionLabel, score}] }` |
| Question AI analysis | `fuelQuestions.aiAnalysis` | `POST /fuel/questions/:id/ai/analysis` | → `{ trend, sections:[{heading, body}] }` (needs ≥3 answers) |

### Related (not called here — used elsewhere)
- `fuel.history` `GET /fuel/history?from=&to=`, `fuel.log` `POST /fuel/log` (simple/detailed daily summary — used by Hawk Eye / older flow), `fuel.monthlyAnalysis` / `fuel.foodAiAnalysis` (Building-You screen).

---

## 9. Request/response types (from `lib/api.ts`)

```ts
type MacroTargets = { calories: number; protein: number; fat: number; carbs: number };
type MealTime = 'morning' | 'brunch' | 'lunch' | 'evening' | 'dinner' | 'snacks';

// GET /fuel/items → FoodItem[]   /   POST,PUT /fuel/items
type FoodItem = {
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

// GET /fuel/logs → FoodLog[]  (daily summary rows, simple or detailed)
type FoodLog = {
  id: string;
  mode: 'simple' | 'detailed';
  hadThreeMeals: boolean | null;
  foodQuality: number | null;     // 0–10
  hadJunkFood: boolean | null;
  calories: number | null;  calorieTarget: number | null;
  protein: number | null;   proteinTarget: number | null;
  mealsLogged: number | null; expectedMeals: number | null; junkMeals: number | null;
  notes: string | null;
  score: number;
  createdAt: string;
};

// GET /fuel/identity
type FuelIdentity = {
  totalXP: number; levelIndex: number; levelName: string;   // Unaware → Surgical (12 levels)
  nextLevel?: string; xpToNext?: number;
};

// ── Fuel Questions ──────────────────────────────────────
type FuelQuestion = {
  id: string;
  category: string;
  prompt: string;
  options: string[];              // 2 or 5 options, ordered worst→best
  reverseScoring: boolean;
  weight: number;                 // "+N pts"
  required: boolean;
  isPreset: boolean;
  isCustom: boolean;
  selected: boolean;              // ← only selected ones show in QUICK mode
  streak?: number;
};

type FuelQuestionAnswer = {
  questionId: string; prompt?: string; optionIndex: number;
  optionLabel?: string; score?: number; weight?: number;
};
type FuelQuestionResponses = {
  date: string;
  answers: FuelQuestionAnswer[];
  checklistScore?: number;        // 0–100 weighted
};

// GET /fuel/questions/score?from=&to=
type FuelScoreRange = {
  from: string; to: string;
  days: Array<{ date: string; checklistScore: number | null; answeredCount: number }>;
};

// POST /ai/snap-track response  (⚠ note the field is `fats`, not `fat`)
type SnapTrackResult = {
  name: string; calories: number; protein: number; carbs: number; fats: number; servingNote: string;
};
```

## 10. Business rules the design reflects (backend)

- **Checklist score** = `round( Σ(answerScore × weight) / Σweight )`. Each answer's score = `round(optionIndex/(optionCount−1) × 100)`, reversed (`100 − x`) if `reverseScoring`. So a 5-option question yields 0/25/50/75/100; a 2-option yields 0/100.
- **Fuel XP / level** (Profile): XP = `fuelScore × 2`; level = `floor(sqrt(totalXP/100))`, capped at index 11 → 12 levels: Unaware, Tracking, Conscious, Intentional, Balanced, Clean, Structured, Optimized, Precise, Dialed, Peak, Surgical.
- **Snap Track** uses OpenAI **gpt-4o** vision; returns `422`/`{error:"No food detected"}` when it can't find food — handle that as a friendly "try a clearer photo" message.

## 11. Color reference
- Score status: green `#22A664` ≥80 · blue `#0A84FF` 60–79 · amber `#F0A12E` 40–59 · red `#E84A4A` <40.
- Macros: calories `#FF9500`, protein `#0A84FF`, carbs `#34C759`, fat `#FFD60A`, fibre `#30B0C7`.
- Lime accent (button arrow): `#B8F23A`; AI/green accent: `#34C759`.
```
