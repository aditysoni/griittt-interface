# Onboarding Flow — Web Build Spec (questions + APIs)

Source of truth: `app/(auth)/onboarding.tsx` + `lib/auth.tsx` (`completeOnboarding`, `signup`) + `lib/api.ts` (`futureMirror.generate`, `users.onboarding`).
This is the guided first-run flow (design: "Warm Coach", cream background `#F5F1E8` + lime `#B8F23A`, dark screens for Welcome/Future Mirror). **19 steps** shown as a progress bar. It collects a rich profile, runs a **pre-signup AI "Future Mirror"**, lets the user pick starter habits/challenges, and finally creates the account + saves everything.

Base URL: `${API_BASE}/api` · `application/json` on every call · Dates local `YYYY-MM-DD`.

> **Order logic:** understand the person (why they need change) → **Future Mirror** (emotional investment) → pick habits (how they'll change) → commit. Account creation happens **at the very end** (or the user may already be logged in via social auth).

---

## 1. The steps, in order

| # | Step (key) | What it asks | Input type | Saved to |
|---|---|---|---|---|
| 0 | Welcome | "The day belongs to you." — I'M NEW HERE / SIGN IN | — | — |
| 1 | Name | "What should we call you?" | text (required) | `name` |
| 2 | Birthday | Day / Month / Year steppers → age + days-to-birthday. **18+ gate** (blocks CONTINUE if under 18) | 3 steppers | `dateOfBirth`, derived `age` |
| 3 | Desired outcomes | "What would you like to change before your next birthday?" | grouped multi-select, **max 5** | `desiredOutcomes` |
| 4 | Pain points | "What's hurting the most right now?" | grouped multi-select, **max 3** | `painPoints` |
| 5 | Blockers | "What's stopping you today?" | grouped multi-select, **max 3** | `blockers` |
| 6 | Reflection | "If your life looked exactly the same 6 months from now, what would disappoint you most?" | free text (+ example chips) | `disappointmentStatement` |
| 7 | Body | Height (cm) + Weight (kg) steppers, Usual sleep time, Activity level | 2 steppers + 2 single-select | `heightCm`, `weightKg`, `sleepSchedule`, `activityLevel` |
| 8 | Positive habits | "Which habits are already helping you?" | grouped multi-select (no max) | `positiveHabits` |
| 9 | Negative habits | "Which habits are holding you back?" | grouped multi-select (no max) | `negativeHabits` |
| 10 | **Consent** | 7 consent points + agree checkbox + Privacy Policy link. **Gates CONTINUE until checked.** | checkbox (required) | — (gate before AI) |
| 11 | **Future Mirror** | AI-generated "reflection of who you're becoming" (loading → result). **Fires the AI call on entering this step.** | read-only reveal | `futureMirror` (result) |
| 12 | Build habits | "What do you want to build?" — pick from 9 preset positive habits | multi-select rows | → `starterHabits` |
| 13 | Break habits | "What do you want to control?" — pick from 8 preset control habits | multi-select rows | → `starterHabits` |
| 14 | Challenges | "Take on a challenge?" — pick 30-day challenges (skippable) | multi-select cards | `starterChallenges` |
| 15 | Coaching tone | Encouraging / Balanced / No mercy | single-select | `coachingTone` |
| 16 | Nudge time | Morning / Midday / Evening / Before bed | single-select | `dailyNudgeTime` |
| 17 | Commit | A "pact" + (if not logged in) **email + password** (min 8) → creates account + finishes | text ×2 (conditional) | triggers signup + submit |
| → | (after) | Routes to `/first-win` | — | — |

Progress bar shows steps 1–18 (Welcome excluded from the dot count).

## 2. Question option catalogs (exact chips)

**Desired outcomes** (max 5) — groups: Body (Lose weight, Reduce belly fat, Build muscle, Get stronger, Improve fitness, Improve posture, Look better in photos, Feel attractive again) · Health (Better sleep, More energy, Eat healthier, Improve digestion, Reduce stress, Feel healthier overall) · Discipline (Become more disciplined, Stop procrastinating, Build consistency, Follow through on goals, Create a routine) · Focus (Better focus, Reduce distractions, Spend less time on social media, Use my phone less, Improve productivity) · Addictions (Quit smoking, Quit alcohol, Quit vaping, Quit porn, Quit masturbation, Reduce junk food, Reduce sugar) · Emotional (Feel more confident, Improve self-esteem, Stop feeling stuck, Feel proud of myself, Gain momentum in life).

**Pain points** (max 3) — Physical / Mental / Productivity / Habits / Lifestyle (e.g. "I'm overweight", "I feel stuck", "I procrastinate", "I keep relapsing", "I smoke", "I drink too much alcohol").

**Blockers** (max 3) — Motivation / Consistency / Time / Environment / Knowledge / Emotional (Stress, Anxiety, Low confidence, Fear of failure) / Addictions (Nicotine cravings, Alcohol cravings, Porn addiction, Social media addiction, Food cravings).

**Positive habits** — Fitness (Gym, Running, Walking, Sports) · Mind (Reading, Journaling, Meditation) · Health (Good sleep schedule, High protein diet, Drinking enough water) · Productivity (Planning my day, Time blocking, Deep work sessions).

**Negative habits** — Addictions (Smoking, Alcohol, Vaping, Porn, Masturbation) · Food (Junk food, Sugar, Late-night eating) · Digital (Social media, Excessive YouTube, Gaming, Phone in bed) · Lifestyle (Skipping workouts, Sleeping late, Oversleeping).

**Sleep options:** Before 10 PM · 10 PM–11 PM · 11 PM–Midnight · Midnight–1 AM · After 1 AM. **Activity:** Never exercise · 1-2 times/week · 3-4 times/week · 5+ times/week.

**Build habit presets (id → name, impact):** gym→"Go to the gym"(8), run→"Morning run"(7), wake_early→"Wake up at 5am"(6), protein→"Hit protein target"(5), water→"Drink 3L water"(3), read→"Read 30 minutes"(4), meditate→"Meditate 10 min"(5), cold_shower→"Cold shower"(5), journal→"Journal 1 page"(4).
**Break habit presets:** smoking→"No smoking"(9), alcohol→"No alcohol"(8), porn→"No porn"(7), masturbation→"No masturbation"(7), junk_food→"No junk food"(6), social_media→"No social media"(6), sugar→"No sugar"(5), phone_bed→"No phone in bed"(5).
> The build/break picker stores **ids**, but on submit they're converted to **names** and merged into `starterHabits`.

**Challenge presets (title, all 30 days):** Cold shower, Gym daily, Morning run, No sugar, No alcohol, Meditation, Read daily, Wake at 5am, No phone in bed. Selected titles → `starterChallenges` (matched server-side against seeded presets).

**Coaching tone:** `soft` (Encouraging) · `bal` (Balanced) · `hard` (No mercy). **Nudge time:** `morning` · `midday` · `evening` · `bed`.

---

## 3. APIs used by the flow

Only **two** network calls in the whole flow (plus auth signup). Everything else is local state until the end.

### A. Future Mirror — step 11 (fires on entering the step)
**`POST /api/future-mirror`** — ⚠ **PUBLIC / unauthenticated** (runs before the account exists).

Request body:
```json
{
  "name": "Aditya",
  "age": 25,
  "daysUntilBirthday": 212,
  "desiredOutcomes": ["Quit smoking", "Build muscle"],
  "painPoints": ["I'm overweight"],
  "blockers": ["Fear of failure"],
  "disappointmentStatement": "I'd still be smoking.",
  "positiveHabits": ["Gym"],
  "negativeHabits": ["Smoking"],
  "heightCm": 175,
  "weightKg": 75,
  "sleepSchedule": "11 PM – Midnight",
  "activityLevel": "3-4 times/week"
}
```
(Every field except the arrays is optional; arrays default to empty. `age` 10–99, `daysUntilBirthday` 0–366.)

Response (`FutureMirrorResult`):
```ts
{
  identityObserved: string;      // "What the mirror sees"
  identityEmerging: string;      // "Who's trying to emerge"
  futureHeadline: string;        // hero headline (≤8 words)
  hiddenCost: string;
  selfNegotiation: string;
  confidenceLevel: string;       // natural language, no number
  birthdayCheckpoint: string;    // references daysUntilBirthday
  futureMirrorNegative: string;  // "If nothing changes"
  futureMirrorPositive: string;  // "If the pattern changes"
  trajectoryDrivers: string[];   // 3–6 chips
  futureSnapshots: { title: string; scene: string }[];  // 4 fixed titles:
                                 // 'Your Next Birthday', 'A Random Tuesday',
                                 // 'Looking In The Mirror', 'Someone Notices'
  trajectoryQuestion: string;
}
```
- Runs OpenAI `gpt-4o-mini`; can take several seconds → show the "Building your mirror…" loading state. On failure the app shows a soft "Couldn't build your mirror" screen and **still lets the user continue** (`futureMirror` just omitted from the final submit).

### B. Account creation — step 17 (only if not already logged in)
**`POST /api/auth/signup`** — `{ name, email, password }` → `{ user, token }`. (See AUTH_PAGES_SPEC.md.)
- The client lower-cases/trims the email. Requires password ≥ 8.
- **Recovery path:** if signup returns `409`/"already exists" (e.g. a prior attempt created the account but the final save failed), the app auto-tries `POST /api/auth/login` with the same credentials and continues.

### C. Final submit — step 17
**`POST /api/users/onboarding`** — requires the Bearer token (from the just-created account, or the existing session).

Request body (`OnboardingPayload`):
```json
{
  "name": "Aditya",
  "age": 25,
  "heightCm": 175,
  "weightKg": 75,
  "goals": [],
  "baselineSelfRating": 5,
  "starterHabits": ["Go to the gym", "No smoking"],
  "starterChallenges": ["Cold shower"],
  "dailyNudgeTime": "evening",
  "coachingTone": "bal",
  "notificationsEnabled": true,
  "dateOfBirth": "2000-04-18",
  "desiredOutcomes": ["Quit smoking"],
  "painPoints": ["I'm overweight"],
  "blockers": ["Fear of failure"],
  "disappointmentStatement": "I'd still be smoking.",
  "positiveHabits": ["Gym"],
  "negativeHabits": ["Smoking"],
  "sleepSchedule": "11 PM – Midnight",
  "activityLevel": "3-4 times/week",
  "futureMirror": { /* the FutureMirrorResult from step 11, or omitted */ }c
}
```
Response: `201 { user, onboardingDone: true }`. Notes: `goals` is sent as `[]` (superseded by outcomes), `baselineSelfRating` is hardcoded `5`, `notificationsEnabled` hardcoded `true`. The build/break picker ids are converted to names before sending. On success → navigate to `/first-win`.

> **Client wrappers:** `futureMirror.generate(...)`, `signup(name,email,password)` (returns token), `completeOnboarding(payload, freshToken)` (calls `users.onboarding` and updates cached user).

---

## 4. Server-driven onboarding (alternative — NOT what this screen uses)

The backend also exposes a **dynamic question-catalog** API (`/api/onboarding/*`) — a DB-driven Q&A set. **The current app's onboarding is hardcoded client-side and does NOT use these.** They exist if you'd rather render questions from the server:
- `GET /api/onboarding/questions` → `OnboardingQuestion[]` (`{ id, order, prompt, subtitle, type: 'text'|'compound'|'multi_select'|'single_select', options, minSelect, maxSelect, required }`).
- `GET /api/onboarding/answers` → saved answers map.
- `POST /api/onboarding/submit` → `{ answers }` → `{ user, recommendations }`.
- `GET /api/onboarding/recommendations` → `{ habits[], challenges[] }`.

For a 1:1 port of the mobile flow, **use the hardcoded steps above + the two calls in §3** — not this.

---

## 5. Web build notes
- **Only 2 real endpoints** matter (`/future-mirror`, `/users/onboarding`) + signup — everything else is local form state. Easy to port.
- Keep the **18+ gate** and the **Consent gate** (they block progression) — both are compliance-relevant given the sensitive data collected (addiction/sexual-behavior/health).
- The Future Mirror call is **public** and OpenAI-billed — consider adding your own throttling on web.
- On the Commit step, only ask for email/password **if the user isn't already logged in** (`needsCredentials = !user`). Social-auth users skip it.
- After submit, deep-link to your web equivalent of `/first-win`.
```

