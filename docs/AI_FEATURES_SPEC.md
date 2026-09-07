# AI Features — Web Build Spec (every AI call, API + result shape)

Every AI feature in Grittt runs **server-side**: the app calls the Grittt backend, which calls **OpenAI**. There is **no AI SDK in the client** and no API key on-device — the web build just calls the same backend endpoints. (`@anthropic-ai/sdk` is installed on the backend but unused; everything is OpenAI.)

- Base URL: `${API_BASE}/api` · `Authorization: Bearer <JWT>` on all except Future Mirror (public).
- Models: **`gpt-4o-mini`** for all text features · **`gpt-4o`** (vision) for the food-photo scan.
- No conversation memory — every call is one-shot request → response. No streaming. JSON is parsed out of the model's text server-side.

---

## 1. The "AI ANALYSIS" button (shared component)

Three different screens use the **same button + result card** (`components/AiAnalysisCard.tsx`) and the **same result shape** (`AiAnalysis`). This is the green "sparkles" ASK-AI button you see across the app.

```ts
type AiAnalysis = {
  trend: 'improving' | 'declining' | 'steady'
       | 'positive' | 'negative' | 'neutral'
       | 'insufficient_data';
  sections: Array<{ heading: string; body: string }>;   // usually 2–3 headed sections
};
```
- **Button** (`AiAnalysisButton`): a "AI ANALYSIS" pill; while loading shows "ANALYZING…".
- **Card** (`AiAnalysisCard`): a colored **trend badge** (green = improving/positive, red = declining/negative, grey = insufficient_data, blue = steady/neutral) + the headed sections.
- The three features that return `AiAnalysis`: **per-habit analysis**, **fuel-question analysis**, **food analysis** (rows 4/6/7 below).

---

## 2. Every AI call — where it's used, API, and result

| # | Feature | Called from (file) | Endpoint | Model |
|---|---|---|---|---|
| 1 | Snap Track (food photo → macros) | `fuel.tsx:717`, `fuel-analysis.tsx:483`, `ai.tsx:147` | `POST /ai/snap-track` | gpt-4o (vision) |
| 2 | Weekly Debrief | `ai.tsx:63` (AI Coach tab) | `POST /habits/ai/weekly-debrief` | gpt-4o-mini |
| 3 | 30-Day Patterns | `ai.tsx:78` (AI Coach tab) | `POST /habits/ai/patterns` | gpt-4o-mini |
| 4 | Per-habit Analysis | `index.tsx:789` (Habit Detail modal) | `POST /habits/:name/ai/analysis` | gpt-4o-mini |
| 5 | Fuel-question Suggest Weight | `fuel-questions.tsx:265` | `POST /fuel/questions/ai/suggest-weight` | gpt-4o-mini |
| 6 | Fuel-question Analysis | `fuel-questions.tsx:442` (Question Detail modal) | `POST /fuel/questions/:id/ai/analysis` | gpt-4o-mini |
| 7 | Food Analysis | `building-you.tsx:23` | `POST /fuel/analysis/monthly/food` | gpt-4o-mini |
| 8 | Future Mirror (onboarding) | `onboarding.tsx` | `POST /future-mirror` (**public**) | gpt-4o-mini |
| 9 | The Mirror (identity narration) | `mirror.tsx:33` | `GET /mirror` (AI narration embedded) | gpt-4o-mini |

**Not AI but often grouped with it:** `POST /fuel/analysis/monthly` (`fuel.monthlyAnalysis`, used by `building-you.tsx` / `fuel-analysis.tsx`) is **pure server-side stats, no LLM** — it returns top foods + percentiles. Only the per-food drill-down (#7) uses AI.

**Dead endpoints** — exist in `lib/api.ts` but **not called anywhere in the app** (skip on web unless you build UI for them): `ai.foodCoach` (`POST /ai/food-coach`), `ai.workout` (`POST /ai/workout`), `habits.recoveryNudge` (`POST /habits/ai/recovery-nudge`).

---

## 3. Request / response for each

### 1. Snap Track — `POST /ai/snap-track`
- **Where:** the "SNAP & TRACK" camera/gallery button in Fuel, Fuel-Analysis, and the AI Coach tab.
- **Request:** `{ "imageBase64": "data:image/jpeg;base64,...." }` (a food photo).
- **Response:**
  ```ts
  { name: string; calories: number; protein: number; carbs: number; fats: number; servingNote: string }
  ```
  ⚠ Field is **`fats`** (plural). On "no food", backend returns **HTTP 422** / `{ error: "No food detected" }` — show a "try a clearer photo" message.
- **Model:** gpt-4o vision, `detail: low`, `max_tokens: 200`.

### 2. Weekly Debrief — `POST /habits/ai/weekly-debrief`
- **Where:** AI Coach tab (`app/(tabs)/ai.tsx`). No request body — backend pulls the user's last 14 days of habit data itself.
- **Response:** `{ summary: string; pattern: string; suggestion: string; identity: string }`.
- **Prompt gist:** "supportive, insightful habit coach; honest but never harsh; identify ONE non-obvious pattern; identity-based language ('You ARE someone who…'); <150 words."

### 3. 30-Day Patterns — `POST /habits/ai/patterns`
- **Where:** AI Coach tab. No body. **Gate:** needs ≥7 completion-days in the last 30, else returns `{ patterns: [], message: "Need at least 7 days…" }`.
- **Response:** `{ patterns: Array<{ insight: string; actionable: string }> }` (2–3 patterns).

### 4. Per-habit Analysis — `POST /habits/:name/ai/analysis`
- **Where:** the "AI ANALYSIS" button inside a habit's detail modal (`index.tsx`). `:name` = habit name, URL-encoded. No body.
- **Response:** `AiAnalysis` (§1). Sections are `YOUR CONSISTENCY / REAL IMPACT / 6 MONTHS FROM NOW`.
- **Gate:** needs ≥3 completions in 30 days, else `trend: 'insufficient_data'`.

### 5. Fuel-question Suggest Weight — `POST /fuel/questions/ai/suggest-weight`
- **Where:** the "Add custom question" modal — suggests how important a question should be.
- **Request:** `{ prompt: string; options: string[] }` (≥2 options).
- **Response:** `{ weight: number (1–10); reasoning: string }`.

### 6. Fuel-question Analysis — `POST /fuel/questions/:id/ai/analysis`
- **Where:** the "AI ANALYSIS" button in a fuel question's detail modal (`fuel-questions.tsx`). No body.
- **Response:** `AiAnalysis` (§1). Sections: `WHAT'S HAPPENING / IF THIS CONTINUES`.
- **Gate:** ≥3 answers in 30 days, else `insufficient_data`.

### 7. Food Analysis — `POST /fuel/analysis/monthly/food`
- **Where:** the "AI ANALYSIS" button on a food in the Building-You / Fuel-Analysis screen.
- **Request:** `{ name: string; month?: "YYYY-MM" }`.
- **Response:** `AiAnalysis` (§1). Sections: `CURRENT IMPACT / 6-MONTH PROJECTION`. `404` if that food has no logged items.

### 8. Future Mirror — `POST /future-mirror`  ⚠ **PUBLIC**
- **Where:** onboarding step 11 (runs before the account exists). Full details in `ONBOARDING_SPEC.md §3A`.
- **Request:** the onboarding profile (name, age, daysUntilBirthday, desiredOutcomes, painPoints, blockers, disappointmentStatement, positive/negativeHabits, heightCm, weightKg, sleepSchedule, activityLevel).
- **Response:** `FutureMirrorResult` (13 fields — headline, identityObserved/Emerging, hiddenCost, two future paths, 4 snapshots, trajectoryDrivers, birthdayCheckpoint, trajectoryQuestion).
- ⚠ Unauthenticated + OpenAI-billed → add throttling on web.

### 9. The Mirror — `GET /mirror`
- **Where:** the Mirror tab (`mirror.tsx`). `GET /mirror?today=<date>&window=7|30[&preview=forming|teaser|full]`.
- **AI role:** the endpoint returns a `MirrorPayload`; the human-readable text (archetype, "becoming" line, per-trait sentences, risks, recommendations) is **AI-narrated on the server** — but the LLM **only narrates pre-computed numbers, never invents stats**. If the AI is unavailable, a rule-based fallback fills the same fields (numbers are identical either way).
- **States:** `forming` (< 7 logged days — no AI), `teaser` (free — hero + 1 trait), `full` (premium — everything). `POST /mirror/premium` is the current (stub) unlock. See the Mirror payload in `lib/api.ts` (`MirrorPayload`).

---

## 4. Client wrappers (from `lib/api.ts`)
```ts
ai.snapTrack(token, imageBase64)                         // POST /ai/snap-track
habits.weeklyDebrief(token)                              // POST /habits/ai/weekly-debrief
habits.patterns(token)                                   // POST /habits/ai/patterns
habits.aiAnalysis(token, name)                           // POST /habits/:name/ai/analysis
fuelQuestions.suggestWeight(token, {prompt, options})    // POST /fuel/questions/ai/suggest-weight
fuelQuestions.aiAnalysis(token, id)                      // POST /fuel/questions/:id/ai/analysis
fuel.foodAiAnalysis(token, name, month?)                 // POST /fuel/analysis/monthly/food
futureMirror.generate(payload)                           // POST /future-mirror   (public)
mirror.get(token, preview?, window?)                     // GET  /mirror
// Present but UNUSED in the app:
ai.foodCoach(...) ai.workout(...) habits.recoveryNudge(...)
```

## 5. Web build notes
- **Loading UX:** every AI call is a few seconds (no streaming) — always show a spinner ("ANALYZING…" / "Building your mirror…").
- **Gates:** analyses need minimum data (≥3 or ≥7 days) — handle the `insufficient_data` trend / `message` gracefully instead of erroring.
- **Reuse one component** for rows 4/6/7 — they all return the identical `AiAnalysis` shape.
- **Snap Track:** send the image as a `data:image/jpeg;base64,...` URI; handle the 422 "no food" case; read `fats` (not `fat`).
- **Cost/abuse:** none of these are rate-limited server-side and Future Mirror is public — add throttling/auth on the web edge if it's exposed.
```
