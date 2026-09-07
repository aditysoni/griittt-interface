# GRITTT — Complete Product Breakdown (Acquisition Due-Diligence)

> **For:** an incoming owner/marketer who has never seen the code.
> **Scope:** the entire product — mobile app (`Grittt-app`, Expo/React Native) **and** backend (`Grittt-server`, Express + PostgreSQL + OpenAI).
> **Method:** reverse-engineered directly from source. File references throughout so you can inspect anything. Where this contradicts the older `GRITTT_PRODUCT_OVERVIEW.md`, **this document is current** — that doc predates the Mirror, Future Mirror, HealthKit, Challenges, Fuel Questions, and the full onboarding.

**Repos**
- `Grittt-app/` — iOS-first (Android buildable) mobile client. Expo SDK 54, React Native 0.81, expo-router. Version **1.0.2 (build 21)**.
- `Grittt-server/` — Express 5 API, PostgreSQL (`pg`), OpenAI. Deployed via Docker/nixpacks. Package name `server-habit-tracker`.

---

## 1. Product Overview

**What it is.** GRITTT is a **discipline & identity-building app**. It is a habit tracker that reframes every action as either *building* your identity or *controlling* your worst impulses, converts your day into an honest **0–100 score**, and layers AI coaching, gamified levels, an AI "Mirror" that reflects who you're becoming, Apple Health integration, and social leaderboards on top.

**Problem it solves.** Ordinary habit apps are soft, gamified toy-streaks that people abandon. GRITTT targets the emotional core — *"am I actually becoming the person I want to be?"* — with an unsentimental score you can't game, plus AI that references your real data instead of generic advice.

**Target customer.** Adults 18+ (age-gated) serious about self-improvement: gym-goers, people in **addiction recovery** (porn, alcohol, smoking, gambling — these are first-class presets), people rebuilding after a rough patch, "identity-driven" self-optimizers. Tone is deliberately hard-edged, not cheerful.

**Core value proposition.** *"The habit app for people who are done lying to themselves."* An honest daily score + an AI that has been watching your data all week + a vision of your future self.

**What makes it different (all verified in code):**
- **Build vs Control split** with a weighted 60/40 formula (`Grittt-server/src/services/score.ts:37-47`).
- **Toughness-weighted scoring** — you set 1–10 difficulty; harder habits move the score more (`Grittt-server/src/routes/habits.ts:295-308`).
- **The Mirror** — an AI identity reflection where the LLM *narrates pre-computed numbers but is forbidden to invent statistics* (`Grittt-server/src/routes/mirror.ts:96-134`). Includes a 3D human model asset (`Grittt-server/public/models/human.glb`).
- **Future Mirror** — a pre-signup AI that writes a letter from your future self (`Grittt-server/src/routes/future-mirror.ts`).
- **AI food photo recognition** (GPT-4o vision), **Apple Health sync incl. GPS routes**, **streak shields**, **three parallel XP/level ladders** (Discipline, Strength, Fuel).

---

## 2. Features

Status legend: **Complete** = shipped & wired end-to-end · **Partial** = works but gaps · **Stub** = placeholder/dev-only · **Broken/Dead** = present but unused/non-functional.

| Feature | Purpose | How the user interacts | Business value | Status |
|---|---|---|---|---|
| **Daily Discipline Score** | Honest 0–100 daily identity signal | Home tab; check off habits, score updates from server | Core hook & retention driver | **Complete** (`app/(tabs)/index.tsx`, `habits.ts:261-350`) |
| **Build/Control habits** | Two habit types, weighted differently | Create habit → pick Build or Control + toughness | Key differentiator | **Complete** (`tasks.ts`, `habits.ts`) |
| **Toughness weighting (1–10)** | Harder habits count more | Set on habit creation | Makes score credible | **Complete** |
| **Habit streaks** | Momentum/consistency | Auto-computed, shown per habit | Retention | **Complete** (`habits.ts:36-56`) |
| **Count-tracked habits** | e.g. "cigarettes: 3" | Enter a count on completion | Recovery use-cases | **Complete** |
| **Streak Shields (2/mo)** | Protect streaks on bad days | Profile → "Log Bad Day & Use Shield" | Anti-churn ("streak broke → quit") | **Complete** (`habits.ts:705-762`) |
| **Bad-Day Mode** | Mark a genuinely bad day | Toggle; feeds AI + Mirror | Retention, empathy | **Complete** (`habits.ts:767-795`) |
| **Hawk Eye calendar/countdown** | Visual history + goal countdown | Modal from home | Engagement | **Complete** (`components/HawkEye.tsx`) |
| **Strength logging + XP/levels** | Track training, 12-level ladder | Strength tab: simple/detailed log | Gamified retention | **Complete** (`app/(tabs)/strength.tsx`, `services/strength.ts`) |
| **Strength leaderboard** | Global daily ranking | Strength tab | Social/competitive | **Complete** (`db/identity.ts:124-139`) |
| **Fuel logging + XP/levels** | Nutrition, 12-level ladder | Fuel tab: simple/detailed | Gamified retention | **Complete** (`services/fuelService.ts`) |
| **Food items + macros** | Per-meal calories/protein/etc. | Add food items | Nutrition depth | **Complete** (`fuel.ts` food_items) |
| **Snap Track (AI food photo)** | Photo → macros | Camera/gallery in Fuel/AI | "Wow" demo feature | **Complete** (GPT-4o, `ai.ts:109-167`) |
| **Fuel Questions (daily checklist)** | Custom + preset yes/no/scale Qs | Fuel + dedicated screen | Flexible habit tracking | **Complete** (`app/fuel-questions.tsx`, `fuel.ts:664+`) |
| **Monthly nutrition analysis** | Top foods, percentiles | "Building You" / Fuel analysis | Insight retention | **Complete** (`fuel.ts:460-568`) |
| **AI Weekly Debrief** | AI reads 14 days → coach report | AI tab button | Premium-feel stickiness | **Complete** (gpt-4o-mini, `habits.ts:801-893`) |
| **AI 30-Day Patterns** | Behavioral pattern detection | AI tab | Insight | **Complete** (`habits.ts:941-1009`) |
| **AI Recovery Nudge** | Message after a miss | Triggered on missed habit | Anti-churn | **Complete** (`habits.ts:897-937`) |
| **Per-habit / per-food / per-question AI analysis** | Trend + 6-month projection | "AI Analysis" buttons | Depth | **Complete** (`habits.ts:1016+`, `fuel.ts:575+,1087+`) |
| **AI Food Coach / Workout Plan** | 3 tips / weekly plan | AI-driven | Coaching value | **Complete** (`ai.ts:13-103`) |
| **The Mirror (AI identity)** | Reflects "who you're becoming" | Mirror tab (forming→teaser→full) | **Premium paywall** & signature feature | **Complete** (`app/(tabs)/mirror.tsx`, `mirror.ts`) |
| **Future Mirror (pre-signup)** | Letter from your future self | During onboarding | Activation/conversion | **Complete** (`future-mirror.ts`) |
| **Challenges** | Preset + custom time-boxed goals | Challenges tab; join → becomes a habit | Engagement, virality | **Complete** (`challenges.ts`) |
| **Challenge percentile / drop-off stats** | Social proof of difficulty | On challenge detail | Motivation | **Complete** (`challenges.ts:312-413`) |
| **Apple Health sync** | Steps/HR/HRV/sleep/weight/workouts + GPS | Profile → Connect Health | Data moat, recovery scores | **Complete** (`lib/healthKit.ts`, `health.ts`) |
| **Recovery/Movement scores** | Health-derived readiness | Profile | Differentiation | **Complete** (`health.ts:310-359`) |
| **Onboarding (rich profile + consent)** | Collect goals, body, addictions, consent | First run | Personalization + legal | **Complete** (`app/(auth)/onboarding.tsx`, `users.ts:177-334`) |
| **Auth: email / Google / Apple** | Sign in | Login/Signup screens | Table stakes | **Partial** — see §8 (Apple is **client-only; backend endpoint missing**) |
| **Account & data deletion** | GDPR controls | Edit Profile | Compliance | **Complete** (`users.ts:341-401`) |
| **Premium / paywall** | Gate the full Mirror | Mirror teaser → unlock | **Revenue** | **Stub** — no real billing (`mirror.ts:395-408`) |
| **Push notifications** | Reminders | — | Retention | **Missing** — only a boolean preference exists |
| **Analytics/tracking** | Growth measurement | — | Growth ops | **Missing entirely** |
| **`sessions` table / server sessions** | — | — | — | **Dead** (`migrate.ts:34-39`, never used) |
| **Anthropic SDK** | — | — | — | **Dead dependency** (installed, never imported) |

---

## 3. User Journey

```
                        ┌─────────────────────────────────────────┐
                        │  App Store page: "Grittt – Mirror the    │
                        │  Future" (no web landing page exists)    │
                        └───────────────────┬─────────────────────┘
                                            ▼
                              ┌───────────── LOGIN (default) ──────────────┐
                              │  Returning users land here first            │
                              │  Email · Google · Apple                     │
                              └───────────────┬─────────────────────────────┘
                                              │ "New to Grittt? Get started"
                                              ▼
   ┌──────────────────────────────── ONBOARDING (biggest data step) ─────────────────────────────────┐
   │ Name → DOB (18+ gate) → Height/Weight → Sleep/Activity → Desired outcomes (incl. quit porn/       │
   │ alcohol/smoking) → Pain points → Blockers → Positive/Negative habits → Free-text reflection →     │
   │ Coaching tone → Nudge time → CONSENT screen → ✦ FUTURE MIRROR (AI, pre-account) → Email+Password  │
   │ (if not already social-signed-in) → starter habits & challenges                                    │
   └───────────────────────────────────────────┬───────────────────────────────────────────────────────┘
                                                ▼
                                     FIRST WIN (complete one starter habit)
                                                ▼
   ┌──────────────────────────────────── DASHBOARD (5 tabs) ────────────────────────────────────┐
   │  Discipline (home) · Strength · Fuel · AI Coach · Mirror   (+ Profile, Challenges, edit)     │
   └───────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                ▼
   ACTIONS: check off habits · log workout · log food/snap photo · answer fuel questions · join challenge · sync Health
                                                ▼
   RETENTION LOOPS: daily score ➜ streaks ➜ shields/bad-day ➜ weekly AI debrief ➜ monthly analysis ➜
                    Mirror "updates every morning" ➜ leaderboards ➜ level-ups
                                                ▼
   PREMIUM: full Mirror (teaser→full)      ◀── ⚠ paywall is a self-serve DEV STUB, no real billing
                                                ▼
   REFERRAL: ❌ none in code            NOTIFICATIONS: ❌ no push; only a stored on/off preference
```

**Every entry path:** (1) returning user with valid token → straight to Discipline tab; (2) returning user, expired token → Login; (3) new user → Login → onboarding CTA; (4) social sign-in (Google/Apple) → if `onboarding_done=false`, forced through onboarding. Routing logic: `app/_layout.tsx:30-58`.

**Notable gaps in the journey:** no marketing website/landing page, no email verification, **no referral loop, no push notifications, no re-engagement email.** These are the biggest growth holes (see §18).

---

## 4. Every Screen

Mobile screens live in `Grittt-app/app/`. All data goes through `Grittt-app/lib/api.ts`; auth/session state via `Grittt-app/lib/auth.tsx`; on-device storage via `Grittt-app/lib/storage.ts` (AsyncStorage).

| Screen (file) | Purpose | Key inputs / buttons | API calls | Loading / Empty / Error |
|---|---|---|---|---|
| **Login** `app/(auth)/login.tsx` | Sign in | email, password; Google & Apple buttons | `auth.login`, `loginWithGoogle`, `loginWithApple` | Spinner on submit; inline error alerts |
| **Signup** `app/(auth)/signup.tsx` | Create account | name, email, password; Google/Apple | `auth.signup` | Same |
| **Onboarding** `app/(auth)/onboarding.tsx` | Full profile + consent + Future Mirror | ~15 steps of inputs (see §3) | `futureMirror.generate`, `signup`, `users.onboarding` | Multi-step; AI loading state on Future Mirror |
| **First Win** `app/first-win.tsx` | Complete one starter habit | tap to complete | `habits.complete`, `habits.dailyScore` | — |
| **Discipline (home)** `app/(tabs)/index.tsx` | Daily score + habit list | +add habit, check/uncheck, count entry, habit detail, Hawk Eye | `tasks.*`, `habits.*`, `habits.aiAnalysis` | Empty = "no habits yet"; per-card loading |
| **Strength** `app/(tabs)/strength.tsx` | Log training, XP, leaderboard | mode toggle, exercises/sets, sport/duration; log button | `strength.log/logs/identity/leaderboard/history` | Empty leaderboard state |
| **Fuel** `app/(tabs)/fuel.tsx` | Nutrition log + questions + snap | food name/macros, meal time, snap photo, fuel questions | `fuel.*`, `fuelQuestions.*`, `ai.snapTrack` | Loading on snap |
| **Fuel Analysis / Building You** `app/(tabs)/fuel-analysis.tsx`, `building-you.tsx` | Monthly nutrition insight + AI | snap (gallery), food AI analysis | `fuel.monthlyAnalysis`, `fuel.foodAiAnalysis` | "Not enough data" empty state |
| **Fuel Questions** `app/fuel-questions.tsx` | Manage checklist questions | create/edit custom Q, options, weight | `fuelQuestions.catalog/custom/selection/suggestWeight/aiAnalysis` | — |
| **AI Coach** `app/(tabs)/ai.tsx` | Debrief, patterns, snap | buttons; camera/gallery | `habits.weeklyDebrief/patterns`, `ai.snapTrack` | Spinner on each AI call |
| **Mirror** `app/(tabs)/mirror.tsx` | AI identity reflection | window toggle, unlock (premium) | `mirror.get`, `mirror.setPremium` | forming/teaser/full states are the empty/gated states |
| **Challenges** `app/(tabs)/challenges.tsx` | Browse/join/create challenges | join, create (title/desc/duration), share | `challenges.*`, `Share.share` | Loading list |
| **Profile** `app/(tabs)/profile.tsx` | Dashboard, Health, logout | Connect Health toggle, logout, nav to edit/AI | `habits.disciplineRange`, `fuel/strength.*`, `health.scores`, `healthKit.syncToBackend` | Health vitals empty until connected |
| **Edit Profile** `app/edit-profile.tsx` | Edit profile, delete data/account | name/age/height/weight, prefs, notifications switch, delete buttons | `users.patch`, `users.deleteData`, `users.deleteAccount` | Confirm dialogs |
| **Privacy Policy** `app/privacy-policy.tsx` | Static policy | — | none | — |
| **Not Found** `app/+not-found.tsx` | 404 | — | none | — |

Shared components: `DarkBackground`, `Gauge`, `ProgressBar`, `DaySelector`/`DateSwipe`, `DayCompleteCelebration`, `LoadingScreen`, `ErrorState`, `ThemeContext`, `AiAnalysisCard`, `AppleSignInButton`, `GoogleSignInButton`, `HawkEye`, `UsageAccessGate` (Screen-Time gate — **built but not mounted anywhere**).

---

## 5. AI Features

**Provider reality:** 100% **OpenAI**. `@anthropic-ai/sdk` is installed but **never imported** (dead). All calls use `chat.completions.create` with a single user message, **no temperature, no JSON mode, no memory** — JSON is regex-extracted from text. Only `OPENAI_API_KEY` is used.

| # | Feature (file:line) | Model | Input | Output | Prompt gist | Memory | ~Cost/call* |
|---|---|---|---|---|---|---|---|
| A | Food Coach `ai.ts:13-54` | gpt-4o-mini | daily macro logs + goals | `{tips[3]}` | "no-nonsense nutrition coach", 3 specific tips | none | ~$0.0004 |
| B | Workout Plan `ai.ts:60-103` | gpt-4o-mini | level, XP, recent sessions | `{plan[]}` | "expert strength coach", N-day plan | none | ~$0.0008 |
| C | **Snap Track** `ai.ts:109-167` | **gpt-4o** (vision) | food photo (base64, detail:low) | `{name,calories,protein,carbs,fats,servingNote}` | "precise nutrition analyst", numbers only | none | ~$0.0025 |
| D | **Future Mirror** `future-mirror.ts` | gpt-4o-mini | onboarding profile (pre-account) | 13-field future-self letter | Longest prompt; forbids advice/scores/clichés; writes as future self | none | ~$0.0016 |
| E | **The Mirror** narration `mirror.ts:96-134` | gpt-4o-mini | pre-computed facts blob | `{archetype,becoming,traits,risks,recs}` | "narrate ONLY provided numbers, NEVER invent a stat" | none (daily cache) | ~$0.0006 |
| F | Weekly Debrief `habits.ts:801-893` | gpt-4o-mini | 14d completions, bad days, shields | `{summary,pattern,suggestion,identity}` | "supportive, honest, never harsh", identity language | none | ~$0.0006 |
| G | Recovery Nudge `habits.ts:897-937` | gpt-4o-mini | missed habit + momentum | `{nudge,suggestTiny}` | never "you failed"; suggest tiny version | none | ~$0.0002 |
| H | 30-Day Patterns `habits.ts:941-1009` | gpt-4o-mini | 30d completions (≥7 req) | `{patterns[]}` | "behavioral data analyst" | none | ~$0.0005 |
| I | Per-habit Analysis `habits.ts:1016-1099` | gpt-4o-mini | 30d single habit (≥3 req) | `{trend,sections[3]}` | consistency + real impact + 6-mo projection | none | ~$0.0005 |
| J | Monthly Food Analysis `fuel.ts:575-636` | gpt-4o-mini | server-derived food stats | `{trend,sections[2]}` | impact now + 6-mo projection | none | ~$0.0005 |
| K | Suggest Question Weight `fuel.ts:997-1035` | gpt-4o-mini | question + options | `{weight,reasoning}` | rate 1–10 importance | none | ~$0.0002 |
| L | Per-question Analysis `fuel.ts:1087-1158` | gpt-4o-mini | 30d answers (≥3 req) | `{trend,sections[2]}` | trend analysis | none | ~$0.0005 |

*Rough estimates at gpt-4o-mini ($0.15/$0.60 per 1M in/out) and gpt-4o ($2.50/$10 per 1M). **Real-world AI cost is pennies per active user per month.** The economics are excellent — the risk is *abuse*, not unit cost (see §5 note + §19).

**User benefit:** the AI always references *your* real numbers, which is what makes GRITTT feel like a coach, not a tracker. **The Mirror's architecture is a genuine IP asset** — separating computation (trusted) from narration (LLM) eliminates hallucinated stats, a common failure mode of AI coaching apps.

**⚠ Cost/abuse risk:** every AI endpoint is available to any logged-in user with **no rate limit**, and **Future Mirror is fully public/unauthenticated** (`future-mirror.ts:6-9`) — an open, OpenAI-billed endpoint anyone can hammer.

---

## 6. Database

PostgreSQL via a single `pg` pool (`Grittt-server/src/db/pool.ts`, max 10 conns; prod SSL with `rejectUnauthorized:false`). **No migration runner** — schema is created two ways: standalone `src/db/migrate*.ts` scripts (mostly run manually) **and** self-healing `CREATE TABLE IF NOT EXISTS` DDL that runs on every server boot inside route files. 23 tables (authoritative dump: `Grittt-server/deploy/grittt/schema.sql`).

| Table | Purpose | Key columns | Relationships | Written by | Read by |
|---|---|---|---|---|---|
| **users** | Accounts + full onboarding profile + premium flags | email, password_hash, google_id, age, height/weight, goals, addictions/blockers (JSONB), macro_targets, is_premium, premium_until, future_mirror | Parent of all (FK CASCADE) | `db/users.ts`, `onboarding.ts`, `users.ts`, `mirror.ts` (premium) | auth, mirror, habits, leaderboard |
| **tasks** | Habit definitions | name, normalized_name, score(toughness), days, category(build/control), track_count, source_challenge_id | →users; ←challenges(SET NULL) | `tasks.ts`, `challenges.ts`, `users.ts` | habits, mirror, challenges |
| **habit_completions** | One row per habit done per day | task_name, normalized_name, date, completion_type, count | →users | `habits.ts` (delete+insert) | habits, mirror |
| **daily_scores** | Composite per-day score + XP | discipline/strength/food/final_score, xp | →users, UNIQUE(user,date) | `db/identity.ts` (via score/strength services) | XP deltas, leaderboard |
| **daily_discipline_scores** | Cached build/control breakdown | build/control/overall + weights | →users, PK(user,date) | `habits.ts` | `habits.ts` |
| **fuel_daily_scores** | Per-day nutrition score + XP | fuel_score, xp | →users, UNIQUE(user,date) | `fuelService.ts` | `fuelService.ts` |
| **user_identity** | Cumulative XP/level per domain | domain(Overall/Strength/Fuel), total_xp, level_index, level_name | →users, PK(user,domain) | `db/identity.ts` | identity endpoints |
| **food_logs** | Daily nutrition summary | mode, calories/protein/targets, junk_meals, score | →users | `fuel.ts` | `fuel.ts` |
| **food_items** | Individual foods per meal | name, meal_time, calories/protein/fat/carbs/fibre | →users | `fuel.ts` | fuel analysis + AI |
| **fuel_questions** | Checklist Q catalog + custom | catalog_key, prompt, options(2 or 5), reverse_scoring, weight | →users(created_by) | `fuel.ts` | fuel questions |
| **user_fuel_questions** | Which questions a user enabled | enabled, order_index | →users, →fuel_questions, PK(user,q) | `fuel.ts` | fuel questions |
| **fuel_question_responses** | Daily answers | option_index, score, date | →users, →fuel_questions, UNIQUE(user,q,date) | `fuel.ts` | fuel score + AI |
| **workout_logs** | Logged workouts | mode, category, rating, exercises(JSONB), body_part, score | →users | `strength.ts` | strength |
| **health_metrics** | HealthKit metrics | metric_type, value, unit, source | →users, UNIQUE(user,date,type,source) | `health.ts` | health scores |
| **health_workouts** | HealthKit workouts incl. **GPS route** | workout_type, start/end, distance, route(JSONB) | →users, UNIQUE(user,external_id) | `health.ts` | health |
| **challenges** | Preset + custom challenges | title, domain, duration_days, is_preset, benefits, theme | →users(created_by) | `challenges.ts`, `migrate-challenges.ts` (8 presets) | challenges, onboarding |
| **user_challenges** | Enrollment | started_at, target_date, status | →users, →challenges, UNIQUE(user,challenge) | `challenges.ts`, `users.ts` | challenges |
| **streak_shields** | 2/month protection tokens | used_date, month_key | →users | `habits.ts` | habits |
| **bad_day_logs** | Bad-day activations | date | →users, UNIQUE(user,date) | `habits.ts` | habits, mirror |
| **onboarding_questions** | Onboarding Q catalog | order, prompt, type, options | — | `onboarding.ts` seed | onboarding |
| **user_onboarding_answers** | A user's answers | answer(JSONB) | →users, →onboarding_questions | `onboarding.ts` | onboarding, recs |
| **mirror_snapshots** | Cached Mirror payloads | window_days, payload(JSONB) | **no FK to users** (⚠ manual delete) | `mirror.ts` | `mirror.ts` |
| **sessions** | *(intended server sessions)* | — | →users | **nobody — DEAD** | nobody |

Account deletion (`users.ts:391-396`) manually clears `mirror_snapshots` (no FK) then deletes the user, cascading everything else.

---

## 7. APIs

Base: `${EXPO_PUBLIC_API_BASE}/api`. Auth = JWT via cookie `token` **or** `Authorization: Bearer` (`middleware/auth.ts`). Full catalog below (grouped; ~70 endpoints). Status: **Complete** unless noted.

**Auth** (`/api/auth`, public unless noted): `POST /signup`, `POST /login`, `POST /logout`, `GET /me`(JWT), `POST /google/verify-token`, `GET /google` + `/google/callback` (web), `GET /google/mobile` + `/mobile/callback` + `/mobile/poll/:session` (mobile poll flow). **No `/auth/apple` endpoint exists** — the app calls it but the server doesn't implement it (**Broken**, see §8).

**Users** (`/api/users`, JWT): `GET /profile`, `GET /me`, `GET /macro-targets`, `PATCH /me`, `POST /onboarding`, `DELETE /me/data`, `DELETE /me`.

**Tasks** (`/api/tasks`, JWT): `GET/POST /`, `PUT/DELETE /:id`.

**Habits** (`/api/habits`, JWT): `GET /:name/stats`, `GET /history`, `GET /all/status`, `GET /discipline/day`, `GET /discipline/range`, `GET /:name/ranking`, `GET /:name/completions/today`, `POST/DELETE /:name/completions`, `GET /:name/score`, `GET /score/day`, `GET /shields`, `POST /shields/use`, `POST/DELETE /bad-day`, `POST /ai/weekly-debrief`, `POST /ai/recovery-nudge`, `POST /ai/patterns`, `POST /:name/ai/analysis`.

**Strength** (`/api/strength`, JWT): `POST /submit-day`, `GET /identity`, `GET /leaderboard`, `POST /log`, `GET /logs`, `GET /history`.

**Fuel** (`/api/fuel`, JWT): `POST /submit-day`, `POST /log`, `GET /logs`, `GET /history`, `GET /identity`, `POST/GET /items`, `PUT/DELETE /items/:id`, `GET /analysis/monthly`, `POST /analysis/monthly/food`, plus **Fuel Questions**: `GET /questions/catalog`, `PUT /questions/selection`, `POST /questions/custom`, `PUT/DELETE /questions/:id` (owner-checked), `POST/GET /questions/responses`, `GET /questions/score`, `POST /questions/ai/suggest-weight`, `GET /questions/:id/history`, `POST /questions/:id/ai/analysis`.

**Score** (`/api/score`, JWT): `POST /submit-day` (composite).
**AI** (`/api/ai`, JWT): `POST /food-coach`, `POST /workout`, `POST /snap-track`.
**Challenges** (`/api/challenges`, JWT): `GET/POST /`, `POST/DELETE /:id/join`, `GET /:id/duration-stats`, `GET /:id/percentile`.
**Onboarding** (`/api/onboarding`, JWT): `GET /questions`, `GET /answers`, `POST /submit`, `GET /recommendations`.
**Mirror** (`/api/mirror`, JWT): `GET /` (forming/teaser/full), `POST /premium` (**Stub** — self-serve premium toggle).
**Future-Mirror** (`/api/future-mirror`, **PUBLIC**): `POST /`.
**Health** (`/api/health`, JWT): `POST /metrics/sync`, `GET /metrics`, `POST /workouts/sync`, `GET /workouts`, `GET/DELETE /workouts/:id`, `GET /scores`. Plus public `GET /health` (server liveness).

Frontend mapping for all of the above lives in `Grittt-app/lib/api.ts`.

---

## 8. Authentication

- **Signup** (`auth.ts:25-47`): zod-validated, `bcrypt.hash(pw, 12)`, issues JWT.
- **Login** (`auth.ts:51-84`): bcrypt compare; Google-only accounts (no password_hash) correctly rejected.
- **JWT** (`middleware/auth.ts`): payload `{userId,email}`, `JWT_SECRET`, expiry `JWT_EXPIRES_IN` (default **7d**). Cookie `httpOnly`, `secure`+`sameSite:none` in prod. `requireAuth` accepts cookie or Bearer.
- **Google OAuth:** three flavors — web redirect (`/google` + callback), Expo mobile **poll flow** (`/google/mobile*`, token stashed in an **in-memory Map**, not multi-instance safe), and mobile **access-token verify** (`/google/verify-token`). The app currently uses the browser-poll flow (`lib/auth.tsx:82-139`).
- **⚠ Apple Sign In is BROKEN end-to-end.** The app runs Apple's native sheet and POSTs the identity token to `/auth/apple` (`lib/auth.tsx:141-172`, `lib/api.ts:302-306`), but **no `/auth/apple` route exists in the backend** (grep-confirmed). Apple sign-in will fail against the live API. Since Apple Sign In is *required* by App Review when other social logins exist, **this is a launch blocker** if the button is shown.
- **Sessions/roles:** `express-session` exists only for the OAuth handshake; the `sessions` table is dead. **No roles, no admin, no RBAC** — ownership is enforced per-query via `WHERE user_id = $1`.
- **Token storage (client):** JWT + full profile in **unencrypted AsyncStorage** (`lib/storage.ts`) — should be `expo-secure-store` (see §19 / privacy audit).

---

## 9. Payments

- **Model:** `users.is_premium` (bool) + `users.premium_until` (timestamp); `isPremiumUser = is_premium || premium_until > now` (`db/users.ts:80-83`).
- **What's gated:** exactly one thing — the **full Mirror**. Non-premium users get a `teaser` (hero + one trait); premium get `full` (`mirror.ts:207`). No other feature (including all AI) is gated.
- **Plans / pricing / subscriptions:** **none defined.** No RevenueCat, no StoreKit, no Stripe, no products, no webhooks anywhere.
- **How premium is granted today:** `POST /api/mirror/premium` — a **DEV STUB** that lets any authenticated user flip their own `is_premium` to true (`mirror.ts:395-408`, comment says "Replace with a RevenueCat entitlement webhook"). This is effectively a free self-unlock.
- **Implication:** monetization is **completely unbuilt**. There is a paywall *surface* (the Mirror teaser) but no way to actually charge. This is the #1 revenue gap. (Note: App Store metadata is titled "Grittt – Mirror the Future," so the Mirror is positioned as the hero/premium feature — the pricing just needs to be wired to StoreKit/RevenueCat.)

---

## 10. Notifications

- **Push:** none. No `expo-notifications`, no APNs/FCM registration, no device token, no `aps-environment` entitlement.
- **Local:** none scheduled.
- **Email/SMS:** none (no email/SMS provider integrated; even signup has no verification email).
- **In-app:** only celebratory UI (`DayCompleteCelebration`) and haptics.
- **What exists:** a stored **preference only** — `notificationsEnabled` + `dailyNudgeTime` on the user profile. The plumbing to actually *send* anything does not exist.
- **Triggers/frequency:** N/A — nothing fires. **This is a major retention gap** — a discipline app with no reminders.

---

## 11. Analytics

- **Tracked events:** **none.** No Firebase, Amplitude, Mixpanel, PostHog, Segment, GA — nothing, on client or server.
- **Funnels / retention / conversion dashboards:** none.
- **User properties:** only what's in the DB (profile fields).
- **What you *could* derive today** without adding SDKs: signups (`users`), activation (`onboarding_done`, first completion), DAU/retention (`habit_completions.date`, `daily_scores.date`), feature usage (row counts per table), premium conversion (`is_premium`). It's all in Postgres but **nobody is measuring it.**
- **Missing (critical for a marketer):** an analytics/attribution layer (e.g. PostHog + a store-attribution tool), event instrumentation on the key funnel steps, and a KPI dashboard. Today you are flying blind on activation, retention, and conversion.

---

## 12. Third-Party Services

| Service | Purpose | Cost model | Usage | Failure impact |
|---|---|---|---|---|
| **OpenAI** | All AI (gpt-4o-mini + gpt-4o vision) | Pay-per-token (pennies/user/mo) | 12 endpoints | AI features degrade; Mirror falls back to rule-based; **public Future Mirror = abuse/cost risk** |
| **Google OAuth** | Social login | Free | Passport + mobile flows | Google login breaks |
| **Apple Sign In** | Social login (client) | Free | Native sheet | **Already broken (no server route)** |
| **Apple HealthKit** | Health data + GPS | Free (Apple) | `lib/healthKit.ts` ↔ `/api/health` | Health features unavailable |
| **Expo / EAS** | Build, OTA updates | Free tier / usage | `expo-updates` → `u.expo.dev` | No OTA; builds via EAS |
| **PostgreSQL host** | Database | Hosting | Single pool | Total outage |
| **Container host** (Docker/nixpacks, `EXPO_PUBLIC_API_BASE=https://grittt.online`) | API hosting | Hosting | Express server | Total outage |
| **Anthropic** | — | — | **installed, unused** | none (remove it) |

No analytics, no email, no payments, no crash reporting, no CDN beyond `/static` (serves the `human.glb` model).

---

## 13. Background Jobs

- **Cron jobs:** none.
- **Queues / workers:** none.
- **Schedulers:** the only timer is a `setInterval` in `auth.ts` that sweeps the in-memory Google-mobile OAuth pending-token map (5-min TTL). Not a real job system.
- **Webhooks:** none (the payment webhook referenced in comments doesn't exist).
- **Boot-time work:** every route file runs self-healing DDL (`CREATE/ALTER … IF NOT EXISTS`) on import — this is the de-facto "migration" mechanism.

The backend is **purely request-driven.** All scoring, caching, and AI happen synchronously inside HTTP requests. (The Mirror is cached per user/day in `mirror_snapshots`, refreshed lazily on first request each morning — not by a scheduled job.)

---

## 14. Configuration

**Backend env** (`Grittt-server`): `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SESSION_SECRET` (fatal if missing), `OPENAI_API_KEY`, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` / `GOOGLE_MOBILE_CALLBACK_URL`, `CLIENT_URL`, `PORT`, `NODE_ENV`, `DEFAULT_STREAK_FACTOR`/`VITE_STREAK_FACTOR`, `DEFAULT_SKIP_PENALTY`/`VITE_SKIP_PENALTY` (the `VITE_*` names are leftovers from a former web frontend). ⚠ `JWT_SECRET` has no startup guard (fails only at request time).

**Frontend env** (`Grittt-app`): `EXPO_PUBLIC_API_BASE` (prod `https://grittt.online` via `eas.json`), `EXPO_PUBLIC_PREVIEW`, `EXPO_PUBLIC_PREVIEW_MIRROR` (dev/demo mock-data toggles, `lib/preview.ts`).

**Feature flags:** none in production; only the preview/mock flags and Mirror `?preview=` dev overrides.
**Build/deploy:** backend → `Dockerfile` + `nixpacks.toml` (runs `NODE_ENV=development` deliberately so Postgres speaks plaintext; HTTPS via tunnel), DB schema in `deploy/grittt/schema.sql` + `docker-compose.yml`. Mobile → EAS (`eas.json`, `appVersionSource: local`, production `autoIncrement`), OTA via Expo Updates. Apple app id `6787925474`, team `PK4MS63RTX`.

---

## 15. Admin Features

**There is no admin panel, no admin role, and no internal tooling.** Everything a "power user" or operator might need is done directly in the database or via dev endpoints:
- **Dev/hidden endpoints:** `POST /api/mirror/premium` (self-grant premium), Mirror `?preview=forming|teaser|full` and `?fresh=1` (bypass cache/gating). No auth-role restriction on these — any user can hit them.
- **Preset content management** (challenges, onboarding questions, fuel questions) is done via seed code / manual SQL, not an admin UI.
- **Content seeding:** 8 preset challenges (`migrate-challenges.ts`), onboarding questions (`onboarding.ts`), fuel question catalog (`src/questions/food.json`, 13 questions).

For an acquirer: **you will need to build basic admin/ops tooling** (user lookup, content editing, premium grants, refunds) — none exists.

---

## 16. Business Logic (the rules that define the product)

- **Daily Discipline score:** `overall = (buildScore·0.6 + controlScore·0.4)·100`, where build/control are toughness-weighted completion ratios (weight = `max(toughness,1)`). `services/score.ts:37-47`, `habits.ts:295-308`.
- **Composite day score:** `discipline·0.5 + strength·0.3 + food·0.2` (`score.ts:91-98`); composite XP `= finalScore·1.5 + streak·5`.
- **Strength score:** `(completed/total·100 − missed·0.3)·(1 + streak·0.02)`; XP `= completedWeight·10 + streak·5 − missedWeight·2` (`services/strength.ts:40-70`).
- **Fuel score:** `calorieAccuracy·40 + protein·30 + mealConsistency·30 − junkMeals·5`; XP `= fuelScore·2` (`services/fuelService.ts:24-69`).
- **Level curve (all 3 domains):** `levelIndex = floor(sqrt(totalXP/100))`, capped at 11 → 12 named levels each (Strength: Starter→Mythic; Fuel: Unaware→Surgical). `strength.ts:77-84`, `fuelService.ts:71-75`.
- **Re-submission safety:** XP uses a delta approach (`newTotal = max(0, current − previousDayXP + newXP)`) so editing a day never double-counts (`score.ts:155`).
- **Streaks:** consecutive days counting backward from today (`habits.ts:36-56`); a control-habit "failed" (Y-pressed) does **not** count as done.
- **Streak Shields:** 2/month (`MAX_SHIELDS_PER_MONTH`), idempotent per date (`habits.ts:705-762`).
- **Percentile / leaderboard:** per-habit percentile vs other users with the same normalized habit, self excluded (`habits.ts:128-133`); strength leaderboard uses SQL `RANK() OVER (ORDER BY score DESC)` (`db/identity.ts:124-139`).
- **Macro targets:** Mifflin-St Jeor BMR × 1.4 activity, goal adjust ±500/+250 kcal; protein = weight·1.8g; fat = 25% kcal (`db/users.ts:87-111`). ⚠ **Assumes male** (sex not collected) — a correctness gap for female users.
- **Mirror state machine:** `forming` until **7 distinct logged days**, then `teaser` (free) or `full` (premium); momentum via least-squares slope over the window; projections at +30/+90/+180 days (`mirror.ts`). LLM narrates, never computes.
- **Challenges:** duration 1–365; join sets `target_date = today + days − 1` and mirrors the challenge into a real habit task; percentile by "pace"; drop-off histogram (`challenges.ts`).
- **Fuel question scoring:** option index → 0–100 (`raw = index/(n−1)·100`, reversed if `reverse_scoring`); weighted daily score `= Σ(score·weight)/Σweight` (`fuel.ts:130-133,914-916`).

---

## 17. Marketing Opportunities

**Main selling points**
- The score that doesn't lie — honest 0–100 daily identity signal.
- Build **and** break habits in one app (addiction-recovery is first-class: quit porn/alcohol/smoking/gambling).
- An AI that actually knows *your* data (weekly debrief, patterns, recovery nudges).
- **The Mirror** — see who you're becoming; **Future Mirror** — a letter from your future self before you even sign up.
- Snap a photo → instant macros.
- Apple Health-powered recovery scores.

**Emotional benefits:** earned pride, productive discomfort (not shame), being *seen* by the AI, milestone identity shifts, hope (Future Mirror), redemption after a bad day (shields).
**Functional benefits:** weighted scoring, streak protection, three XP ladders, leaderboards, monthly analysis, health integration, fast food logging.
**Differentiators (vs Habitica/Streaks/Apple Fitness):** Build/Control split, toughness weighting, non-hallucinating AI Mirror, addiction-recovery framing, real-time server scoring.

**Headline ideas**
- "The habit app for people who are done lying to themselves."
- "Your score doesn't lie. Neither should you."
- "Meet the person you're becoming."
- "Grit is the only cheat code."
- "Build discipline. Break the vices. See the mirror."

**Landing-page copy blocks:** hero (score animation 34→87), Build vs Control explainer, the Mirror reveal (use the 3D `human.glb`), Future Mirror emotional hook, Snap Track demo GIF, "AI that reads your real data," social proof via challenge percentiles.

**Social content ideas:** level-up screenshots (Starter→Mythic), "my Future Mirror said…" reactions, 30-day transformation score graphs, Snap Track "guess the calories" videos, addiction-recovery streak milestones, leaderboard trash-talk.
**Demo ideas:** onboarding → Future Mirror live; snap a real meal on stage; open the Mirror after 7 days; a bad-day/shield recovery story.

⚠ **Marketing caveat:** the addiction/sexual-behavior framing is a strong hook **but** raises App Store content sensitivity and privacy obligations (special-category data — see the Privacy Audit). Lead with "discipline/identity," keep recovery as a supported use-case.

---

## 18. Missing Features (prioritized)

**CRITICAL (blocks revenue or launch)**
- **Real payments/subscriptions** — no StoreKit/RevenueCat; premium is a free self-unlock. No way to make money today.
- **Apple Sign In backend** — button exists, server route doesn't; likely App-Review blocker.
- **Push notifications** — a reminder app that can't remind.
- **Analytics/attribution** — cannot measure or optimize growth.
- **Rate limiting on AI endpoints** + close the public Future Mirror — cost/abuse exposure.

**HIGH**
- Re-engagement (email/push drips), referral/invite loop, secure token storage (SecureStore), sex field for correct macros, crash reporting (Sentry), a hosted marketing site + privacy-policy URL.
- Wire up (or remove) the built-but-unused **Screen Time** feature (`UsageAccessGate`, `modules/usage-access`).

**MEDIUM**
- Admin/ops panel, data export (GDPR), HealthKit *write-back* (declared but unused), image EXIF stripping, social/friends beyond leaderboards, content-management UI for challenges/questions.

**LOW**
- Android polish, widgets, Apple Watch, dark/light themes already handled, localization, richer charts.

---

## 19. Technical Debt

- **Dead code/deps:** `@anthropic-ai/sdk` (unused), `sessions` table (unused), `passport-local` (installed, never used), `UsageAccess` Screen-Time module (built, not mounted), `migrate-startdate.ts` contains a **hardcoded personal backfill** for one email.
- **Broken feature:** Apple Sign In (client calls non-existent `/auth/apple`).
- **Duplicate/inconsistent logic:** `daily_discipline_scores` is defined **twice with conflicting schemas** (SERIAL+FLOAT vs no-id+INT); several columns added in 2–3 places; migrations largely duplicated by boot-time self-healing DDL.
- **No migration versioning** — schema drift risk; the checked-in `schema.sql` is already **stale** (missing health & fuel-questions tables that only exist via inline DDL).
- **Stubs/TODOs:** `mirror/premium` dev unlock; comments referencing a RevenueCat webhook that doesn't exist.
- **Performance:** discipline scores recomputed live + cached ad hoc; leaderboard/percentile queries scan per-habit across all users (fine now, won't scale without indexes/materialization); AI calls block the request thread.
- **Security concerns (see also Privacy Audit):**
  - `CORS origin:true + credentials:true` (reflects any origin with cookies) → CSRF surface.
  - **No rate limiting**; **public unauthenticated OpenAI-billed** Future Mirror endpoint.
  - Premium self-grant endpoint.
  - JWT/profile in **unencrypted AsyncStorage** on device.
  - `NODE_ENV=development` in the Docker runtime (disables PG SSL verification; relies on tunnel for TLS).
  - No `helmet`/security headers; `__DEV__` client logger prints bearer token + bodies.
  - In-memory OAuth state → breaks under horizontal scaling.
- **Data model gap:** macro calc assumes male (no sex field).

---

## 20. Product Roadmap (inferred from the codebase)

```
MVP  (essentially done)         v1  (ship-ready, ~weeks)          v2  (growth, ~1-2 quarters)        Enterprise / scale
────────────────────────        ─────────────────────────        ──────────────────────────        ──────────────────
• Habits + Build/Control        • Wire RevenueCat/StoreKit        • Referral + invite loop           • Team/coach dashboards
• Discipline score + streaks    • Fix Apple Sign In (server)      • Push + email drip campaigns       • Multi-instance-safe OAuth
• Strength/Fuel XP + levels     • Push notifications              • Analytics + KPI dashboards         • Admin/ops console + RBAC
• AI coach suite (OpenAI)       • Analytics/attribution SDK       • A/B testing, funnels              • SOC2/GDPR hardening, DPA
• The Mirror + Future Mirror    • Rate limit + secure Future      • Social/friends, challenge virality• Data warehouse + cohorts
• Challenges, Fuel Questions      Mirror; SecureStore token       • HealthKit write-back, widgets     • Coach-assigned programs
• Apple Health sync             • Marketing site + policy URL     • Female macro model, localization  • White-label / B2B2C
• Onboarding + consent          • Crash reporting                • Content-management admin UI
• Account/data deletion         • Remove dead code/deps
```

**Reality check:** the *product* is remarkably complete (MVP+); what's missing is the entire **commercial and growth layer** (payments, notifications, analytics, referral) and some **hardening** (Apple auth, security, migrations).

---

## 21. Executive Summary

**What the company actually does.** GRITTT is a premium, iOS-first **discipline & identity app**: an honest daily score, gamified Strength/Fuel/Discipline progression, a suite of OpenAI-powered coaching features, an AI "Mirror" that reflects who you're becoming (its architecture deliberately prevents AI-fabricated stats), Apple Health integration, and social leaderboards — aimed at serious self-improvers and people in recovery.

**Product maturity: ~70%.**
- *Feature completeness of the core app:* ~90%.
- *Commercialization (payments, growth, notifications, analytics):* ~10%.
- *Production hardening (auth completeness, security, migrations, ops):* ~50%.

```
Core app        ██████████████████░░  90%
Monetization    ██░░░░░░░░░░░░░░░░░░  10%
Growth engine   ██░░░░░░░░░░░░░░░░░░  10%   (no push/referral/analytics)
Hardening/ops   ██████████░░░░░░░░░░  50%
────────────────────────────────────────
Overall         ██████████████░░░░░░  ~70%
```

**Biggest strengths**
1. A genuinely differentiated, emotionally resonant product (Build/Control, the Mirror, Future Mirror) that's already built.
2. Sophisticated, non-hallucinating AI architecture at **near-zero unit cost** (pennies/user/month).
3. Deep, sticky data model (health + habits + nutrition + identity) — a real moat if retained.
4. Clean, thorough client codebase; no analytics/ad SDK bloat.

**Biggest weaknesses**
1. **No working monetization** — premium is a free self-unlock; nothing charges.
2. **No growth engine** — no push, no referral, no analytics; you can't measure or drive retention.
3. **Broken Apple Sign In** (client-only) — likely App-Review blocker.
4. Security/ops debt — open CORS, no rate limiting, public AI endpoint, unencrypted token, schema drift, no admin tooling.

**Biggest opportunities**
1. Wire RevenueCat + a real paywall on the Mirror (the hero feature, and the app is literally titled "Mirror the Future") → immediate revenue with minimal new build.
2. Turn on the retention/growth flywheel: push reminders + weekly-debrief pushes + referral + analytics.
3. Lean into the recovery/identity niche for high-intent, high-LTV users and organic social content.
4. Expand the AI Mirror as a premium, defensible centerpiece.

**Biggest risks**
1. **Cost/abuse** via the unauthenticated, unrate-limited OpenAI endpoints.
2. **Privacy/compliance** — collects special-category data (sexual behavior, addiction, health, GPS) with gaps (see the Privacy Audit) → App Store + GDPR exposure.
3. **Key-person / bus-factor** — hand-rolled infra (no migration system, in-memory OAuth, dev stubs in prod paths) needs an engineer who understands it.
4. **App Review** — Apple sign-in break, sensitive content, and privacy-label accuracy could delay launch.

**One-line for the pitch:** *A near-complete, emotionally differentiated discipline app with a defensible AI core and a deep data moat — that has never been wired to make money or measure growth. The product risk is behind you; the commercial upside is entirely ahead.*

---

*Prepared from a full read of both repositories. Companion document: `docs/PRIVACY_AUDIT.md` (data collection, permissions, App Store privacy labels, compliance risks).*
*Cross-references use `Grittt-app/...` (this repo) and `Grittt-server/...` (backend repo) paths.*
