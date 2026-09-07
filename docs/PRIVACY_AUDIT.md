# Grittt — Frontend Privacy Audit

**Purpose:** A complete, engineering-grounded inventory of every piece of personal data the Grittt mobile client collects, stores, requests permission for, transmits, and shares — so a lawyer can draft an accurate Privacy Policy. This is an audit of the **frontend/client** (`Grittt-app`, Expo/React Native). Where the client sends data to the backend (`Grittt-server`), that is noted, but the server's internal storage/retention is out of scope except where the client's behavior reveals it.

**App identity**
- Name: **Grittt** · Bundle/package id: `com.grittt.app`
- Platform: iOS (primary; HealthKit + Apple Sign In + Screen Time module) and Android
- Framework: Expo SDK ~54, React Native 0.81, expo-router
- Backend API base: `EXPO_PUBLIC_API_BASE` env var, default dev fallback `http://192.168.1.6:3001` ([lib/api.ts:1](../lib/api.ts#L1))
- OTA updates: Expo Updates, EAS project `4344d3a6-60dc-4ecd-909f-0fe591ed926b` ([app.json:75-77](../app.json#L75-L77))

> ⚠️ **Auditor's note:** Grittt collects an unusually **sensitive** behavioral profile — addiction/recovery data (porn, masturbation, smoking, alcohol, gambling), mental-health signals (anxiety, fear of failure), body metrics, and Apple Health data including **GPS workout routes**. This materially raises the app's privacy obligations (GDPR Art. 9 "special category" data, Apple's HealthKit rules, App Store sensitive-data disclosure). See §16.

---

## 1. Personal Information Collected

Every item below is entered by the user (or read from a device API) in the client and, unless noted, transmitted to the Grittt backend over the API in `lib/api.ts`. Nothing is sent to any third party directly from the client except (a) Apple/Google during sign-in, and (b) food photos routed through the backend to OpenAI (§7).

| # | Data item | Where collected (client) | Why | Optional / Required | Temp storage | Sent to |
|---|-----------|--------------------------|-----|---------------------|--------------|---------|
| 1 | **Name** | signup, onboarding (S2_Name), edit-profile; also from Apple/Google | Account identity, personalization, AI prompts | Required (email signup); from provider on social login | React state; AsyncStorage `grittt_user` | Backend `/auth/*`, `/users/*`; sent to AI in Future Mirror |
| 2 | **Email** | login, signup, onboarding; from Apple/Google | Login, account key, contact | Required | AsyncStorage `grittt_user` | Backend `/auth/*` |
| 3 | **Password** | login, signup, onboarding | Authentication | Required (email signup) | React state only (not persisted) | Backend `/auth/login`, `/auth/signup` (TLS) |
| 4 | **Date of birth + derived age** | onboarding (S_Birthday day/month/year), edit-profile (age) | 18+ age gate (MIN_AGE 18), personalization | Required in onboarding | React state; AsyncStorage `grittt_user` | Backend `/users/onboarding`, `/users/me`; age sent to Future Mirror AI |
| 5 | **Height (cm)** | onboarding (S3_Body), edit-profile | Fitness/nutrition targets | Optional-ish (part of onboarding flow) | AsyncStorage `grittt_user` | Backend; Future Mirror AI |
| 6 | **Weight (kg)** | onboarding (S3_Body), edit-profile; also **Apple Health bodyMass** | Fitness/nutrition targets, macro calc | Optional | AsyncStorage `grittt_user` | Backend `/health/metrics/sync`, `/users/*`; Future Mirror AI |
| 7 | **Sleep schedule** | onboarding | Personalization/scoring | Optional | React state | Backend; Future Mirror AI |
| 8 | **Activity level** | onboarding | Personalization/scoring | Optional | React state | Backend; Future Mirror AI |
| 9 | **Goals / desired outcomes** (incl. quit porn, quit masturbation, quit smoking, quit alcohol, "feel attractive again") | onboarding | Habit/challenge recommendations | Optional | React state | Backend `/users/onboarding`; Future Mirror AI |
| 10 | **Pain points** (overweight, drinking, smoking, low confidence…) | onboarding | Recommendations | Optional | React state | Backend; Future Mirror AI |
| 11 | **Blockers** (porn addiction, nicotine/alcohol cravings, anxiety, fear of failure) | onboarding | Recommendations | Optional | React state | Backend; Future Mirror AI |
| 12 | **Positive / negative habits** (incl. Smoking, Alcohol, Vaping, Porn, Masturbation) | onboarding | Habit seeding | Optional | React state | Backend; Future Mirror AI |
| 13 | **Free-text "disappointment" reflection** | onboarding (S_Reflection) | Motivation, AI Future Mirror | Optional | React state | Backend; Future Mirror AI |
| 14 | **Baseline self-rating, coaching tone, daily nudge time, priority mode** | onboarding, edit-profile | Personalization | Optional | AsyncStorage `grittt_user` | Backend `/users/*` |
| 15 | **Habit names + units + toughness + schedule + daily completion counts / "failed" flags** (custom, can be sensitive e.g. "No porn") | index.tsx, first-win.tsx | Core habit tracking | User-generated | React state | Backend `/tasks`, `/habits/*` |
| 16 | **Challenge title/description + joins** | challenges.tsx, onboarding | Challenges feature | Optional | React state | Backend `/challenges/*` |
| 17 | **Food/nutrition logs** — food names, meal time, calories, protein, fat, carbs, fibre; junk-food/meal-quality flags | fuel.tsx, fuel-analysis.tsx | Nutrition tracking + scoring | User-generated | React state | Backend `/fuel/*` |
| 18 | **Custom "fuel questions"** — free-text prompts, options, daily answers | fuel-questions.tsx, fuel.tsx | Daily discipline checklist | User-generated | React state | Backend `/fuel/questions/*`; prompts sent to AI |
| 19 | **Food photos (images)** | fuel.tsx, fuel-analysis.tsx, ai.tsx (camera + photo library) | AI calorie/macro estimation ("Snap Track") | Optional | In-memory base64 + preview `<Image>`; **not saved to disk** | Backend `/ai/snap-track` → OpenAI (§7) |
| 20 | **Strength/workout logs** — exercise names, reps, weights, sport, duration, distance, intensity, session rating, notes | strength.tsx | Fitness tracking | User-generated | React state | Backend `/strength/*` |
| 21 | **Apple Health metrics** — steps, active energy, resting HR, avg HR, HRV, sleep hours, body mass, walking/running distance, flights climbed | profile.tsx via `lib/healthKit.ts` | Recovery/movement scores | **Optional, off by default** | In-memory before sync | Backend `/health/metrics/sync` |
| 22 | **Apple Health workouts + GPS routes** (lat/lng/altitude/timestamp) | `lib/healthKit.ts` `getWorkouts` | Workout history/insights | Optional (HealthKit) | In-memory | Backend `/health/workouts/sync` |
| 23 | **Notifications-enabled preference** (boolean only) | onboarding, edit-profile | Reminder preference | Optional | AsyncStorage `grittt_user` | Backend `/users/*` |
| 24 | **Auth token (JWT)** | issued by backend on login | Session auth | — | **AsyncStorage `grittt_token`** | Sent as `Authorization: Bearer` on every request |
| 25 | **Avatar URL** | user object from backend | Profile display | Optional | AsyncStorage `grittt_user` | Backend |

**Explicitly NOT collected by the client (verified absent):**
- ❌ Phone number, ❌ Gender (not collected as a field), ❌ Video, ❌ Audio recordings, ❌ Screen-time / per-app usage data (module exists but is unused — see §2/§10), ❌ Push notification token, ❌ Advertising identifier (IDFA), ❌ Analytics identifiers, ❌ Cookies, ❌ Device identifiers (no `expo-device`/`expo-constants` device-id reads), ❌ IP address (not read client-side; backend may log it — out of scope), ❌ Crash logs (no Sentry/Crashlytics), ❌ SecureStore/Keychain (not used — see §6), ❌ SQLite/MMKV.

---

## 2. Device Permissions

| Permission | Requested? | Why | Where declared | When requested (runtime) | Optional? |
|-----------|-----------|-----|----------------|--------------------------|-----------|
| **Camera** (`NSCameraUsageDescription`) | Yes | Snap a photo of food for AI calorie estimation | [app.json:19,52-53](../app.json#L19), [Info.plist:50-51](../ios/Grittt/Info.plist#L50) | When user taps "snap food" → camera (fuel.tsx, ai.tsx) | Optional — only if using Snap Track camera |
| **Photo Library** (`NSPhotoLibraryUsageDescription`) | Yes | Pick an existing food photo for AI estimation | [app.json:19,51](../app.json#L19) | On gallery pick (fuel.tsx, fuel-analysis.tsx, ai.tsx) | Optional |
| **HealthKit — read** (`NSHealthShareUsageDescription`) | Yes | Read steps, HR, HRV, sleep, weight, distance, flights, workouts (incl. GPS routes) | [app.json:22,60-62](../app.json#L22), entitlement `com.apple.developer.healthkit` | Profile → "Connect Health" toggle → `healthKit.requestAuthorization()` | **Optional, off by default** |
| **HealthKit — write** (`NSHealthUpdateUsageDescription`) | Yes (declared) | "Save workouts you log back to Health" | [app.json:23](../app.json#L23) | Same sheet | Optional. ⚠️ **Note:** no client code currently *writes* to HealthKit — only reads. The write usage string is declared but unused. |
| **Microphone** (`NSMicrophoneUsageDescription`) | ⚠️ **Declared but unused** | Generic placeholder string ("access your microphone") | [Info.plist:56-57](../ios/Grittt/Info.plist#L56); pulled in by `expo-audio` dep + Android `RECORD_AUDIO` | Never requested at runtime — no audio recording code exists | Should be **removed** (App Store rejection risk for undeclared purpose) |
| **Screen Time / Family Controls** (`com.apple.developer.family-controls`) | ⚠️ Module present, **not wired to any screen** | Intended: turn screen-time into "discipline reps" (UsageAccessGate copy) | `modules/usage-access/*`, `components/UsageAccessGate.tsx` | `UsageAccessGate` is not mounted by any screen — no runtime request | Not currently active |
| **Notifications (push)** | ❌ **Not requested** | Only a boolean preference is stored; no `expo-notifications`, no push-token registration, no local notification scheduling anywhere | — | Never | — |
| Location, Contacts, Calendar, Motion, Bluetooth | ❌ Not requested | — | — | — | — |

**Android permissions declared:** `android.permission.RECORD_AUDIO` (listed twice — [app.json:33-36](../app.json#L33-L36)) — same unused-microphone concern as iOS.

---

## 3. Third-party SDKs

| SDK / Service | Present | Purpose | Data sent | Privacy implication | Docs |
|---------------|---------|---------|-----------|---------------------|------|
| **Expo / EAS** (expo, expo-updates, expo-router, expo-constants, expo-file-system, expo-linking, expo-web-browser, expo-haptics, expo-image-picker, expo-apple-authentication, expo-audio, fonts) | Yes | App framework, OTA updates, routing, image picking, browser OAuth, native auth | Expo Updates contacts `u.expo.dev` for OTA manifests (app version, runtime version, platform — no user PII) | OTA can silently replace JS; update server sees device/app metadata | expo.dev/privacy |
| **Apple — Sign in with Apple** (`expo-apple-authentication`) | Yes | Login | Receives Apple identity token; app gets name+email on first auth only | Standard; Apple relay email possible | developer.apple.com |
| **Apple — HealthKit** (`@kingstinct/react-native-healthkit`) | Yes | Read health metrics + workouts/GPS | Reads on-device Health data → app → Grittt backend | Highly sensitive; GPS routes = location history | github.com/kingstinct/react-native-healthkit |
| **Google — Sign-In** | Yes (server-side OAuth via browser) | Login | OAuth handshake done **by backend** with its own credentials; app only opens a browser URL and polls for a token. **No Google client SDK or client secret in the app.** | Reduced client exposure; Google sees standard OAuth consent | — |
| **OpenAI** | Yes — **via backend only** | AI features (Snap Track, Future Mirror, debriefs, analyses) | Food photos + logged-activity snippets + onboarding profile relayed by backend | User data leaves to a US AI provider; policy states not used for training | (server-side) |
| **Grittt backend** (first-party) | Yes | All app data | Everything in §1 | First-party controller | — |

**Analytics / tracking / crash SDKs:** **NONE found.** No Firebase, Supabase (client), Mixpanel, PostHog, Amplitude, Segment, Sentry, Crashlytics, Clerk, Auth0, or ad SDKs anywhere in `package.json`, `app/`, `components/`, or `lib/`.

---

## 4. Authentication

Three methods, all resolving to a first-party JWT:

- **Email/password** — `auth.login` / `auth.signup` POST `{email, password}` (and `name` on signup) to `/auth/login` `/auth/signup`; backend returns `{ user, token }` ([lib/api.ts:264-275](../lib/api.ts#L264)).
- **Sign in with Apple** (iOS only) — native sheet requests FULL_NAME + EMAIL scopes; app receives Apple's short-lived signed `identityToken` (+ name/email **first authorization only**) and POSTs to `/auth/apple`; backend verifies against Apple keys and issues its own JWT ([lib/auth.tsx:141-172](../lib/auth.tsx#L141), [lib/api.ts:302-306](../lib/api.ts#L302)).
- **Google** — **server-side OAuth**: app generates a random `session` key, opens `/auth/google/mobile?session=…` in a browser (`expo-web-browser`), and polls `/auth/google/mobile/poll/:session` until the backend (using its own `GOOGLE_CLIENT_ID/SECRET`) returns a JWT. **No Google client config/secret lives in the app.** ([lib/auth.tsx:82-139](../lib/auth.tsx#L82), [lib/api.ts:280-292](../lib/api.ts#L280)).

**Token model:** A single JWT (`{ token }`) — no separate refresh token observed; no OAuth tokens stored client-side (Google OAuth tokens live server-side).

**Token storage:** JWT is stored in **AsyncStorage** under `grittt_token`, and the cached user object under `grittt_user` ([lib/storage.ts:1-22](../lib/storage.ts#L1)). ⚠️ **AsyncStorage is not encrypted** — this is *not* SecureStore/Keychain. On session hydrate, the token is validated via `/auth/me`; only an explicit 401/403 clears it ([lib/auth.tsx:43-72](../lib/auth.tsx#L43)). JWT is attached as `Authorization: Bearer <token>` on every API request ([lib/api.ts:211-215](../lib/api.ts#L211)).

---

## 5. API Calls

All requests go to `${EXPO_PUBLIC_API_BASE}/api` with `Content-Type: application/json` and, when authenticated, `Authorization: Bearer <JWT>`. No cookies are used. Full surface (from [lib/api.ts](../lib/api.ts)):

**Auth (no token / token-issuing)**
- `POST /auth/login` — body `{email, password}` → PII: email, password
- `POST /auth/signup` — `{name, email, password}` → PII: name, email, password
- `GET /auth/me` — token → returns full user profile
- `GET /auth/google/mobile` (browser) + `GET /auth/google/mobile/poll/:session`
- `POST /auth/apple` — `{identityToken, fullName?, email?}` → PII: Apple token, name, email
- `POST /future-mirror` — **unauthenticated**, runs mid-onboarding before signup. Body includes name, age, days-until-birthday, desired outcomes, pain points, blockers, disappointment statement, positive/negative habits, height, weight, sleep, activity → **sensitive profile sent before an account exists** ([lib/api.ts:134-144](../lib/api.ts#L134)).

**Users / profile** (token)
- `GET /users/me`, `PATCH /users/me` (name, age, height, weight, goals, preferences, macroTargets)
- `POST /users/onboarding` — full `OnboardingPayload` (all §1 items 1-14)
- `GET /users/macro-targets`
- `DELETE /users/me/data` — delete tracked data (keeps account)
- `DELETE /users/me` — delete account

**Onboarding Q&A:** `GET /onboarding/questions`, `GET/POST /onboarding/answers|submit`, `GET /onboarding/recommendations`
**Tasks/habits:** `GET/POST/PUT/DELETE /tasks*`, `/habits/*` (score, completions with local date + counts + failed flag, ranking, shields, bad-day, all/status, stats, history, discipline day/range)
**Habit AI:** `POST /habits/ai/weekly-debrief`, `/habits/ai/recovery-nudge`, `/habits/ai/patterns`, `/habits/:name/ai/analysis`
**Strength:** `GET/POST /strength/identity|log|logs|leaderboard|history`
**Fuel:** `/fuel/log|logs|history|items|analysis/monthly*|identity`; **Fuel questions:** `/fuel/questions/catalog|selection|custom|responses|score|:id/history`, AI: `/fuel/questions/ai/suggest-weight`, `/fuel/questions/:id/ai/analysis`
**AI:** `POST /ai/food-coach` (daily macro logs + goals), `POST /ai/workout` (fitness level + recent sessions), `POST /ai/snap-track` (`{imageBase64}` — **food photo**)
**Challenges:** `/challenges*` (list/create/join/abandon/duration-stats/percentile)
**Mirror:** `GET /mirror`, `POST /mirror/premium` (⚠️ dev stub that flips premium — see §17)
**Health:** `POST /health/metrics/sync` (array of {date, metricType, value, unit, source}), `POST /health/workouts/sync` (incl. **GPS route** lat/lng/altitude/timestamp), `GET /health/metrics|workouts|workouts/:id|scores`, `DELETE /health/workouts/:id`

**Leaderboard/ranking endpoints** return other users' `userName` + `avatar` + score/streak — i.e. the client displays limited PII of *other* users ([lib/api.ts:199-204,436-441,624-625](../lib/api.ts#L199)).

**Headers/cookies/tokens:** Only `Content-Type` and `Authorization: Bearer`. No custom tracking headers, no cookies. ⚠️ In `__DEV__` builds, the request logger `console.debug`s the URL, **headers (including the bearer token), and request body** ([lib/api.ts:221-233](../lib/api.ts#L221)) — dev-only, but confirm it's stripped in production.

---

## 6. Local Storage

**AsyncStorage** (`@react-native-async-storage/async-storage`) — the only persistence layer. Keys:

| Key | Contents | PII? | File |
|-----|----------|------|------|
| `grittt_token` | JWT session token | Yes (credential) | [lib/storage.ts:3](../lib/storage.ts#L3) |
| `grittt_user` | Full cached user object (name, email, age, DOB, height, weight, goals, prefs, avatar…) | **Yes** | [lib/storage.ts:4](../lib/storage.ts#L4) |
| `grittt_onboarding_done` | boolean flag | No | [lib/storage.ts:5](../lib/storage.ts#L5) |
| `grittt_health_connected` | boolean — Health connect toggle | No | profile.tsx |
| `grittt_hawkeye_countdown` | `{start,end}` countdown dates | No | HawkEye.tsx, _layout.tsx |

- **SecureStore / Keychain:** ❌ Not used. Token+user (sensitive) sit in unencrypted AsyncStorage.
- **SQLite / MMKV:** ❌ Not used.
- **FileSystem** (`expo-file-system`): used transiently in ai.tsx to read a picked image into base64 for upload — **no persistent files written** ([app/(tabs)/ai.tsx](../app/(tabs)/ai.tsx)).
- **Images/offline cache:** Picked food photos live in React state (base64) only for the duration of the request; not persisted by app code (OS image cache aside).
- `logout()`/`storage.clear()` removes token, user, onboarding keys ([lib/storage.ts:19-21](../lib/storage.ts#L19)).

---

## 7. AI Features

All AI runs **server-side via the Grittt backend, which relays to OpenAI** (confirmed by privacy-policy copy and absence of any AI SDK client-side). Data sent from the client:

| Feature | Client call | Data sent | Personal/health data? |
|---------|-------------|-----------|-----------------------|
| **Snap Track** (food photo → macros) | `ai.snapTrack(token, imageBase64)` (fuel, fuel-analysis, ai screens) | A **food photo** as base64 | Image; ⚠️ EXIF (possibly GPS) not stripped in fuel.tsx/fuel-analysis.tsx; `exif:false` set only in ai.tsx |
| **Future Mirror** | `futureMirror.generate(...)` (onboarding, **pre-signup**) | Name, age, outcomes, pain points, blockers, disappointment text, habits, height, weight, sleep, activity | **Yes — full sensitive profile** |
| **Weekly debrief** | `habits.weeklyDebrief` | Backend-side habit history (derived) | Habit behavior |
| **Pattern analysis** | `habits.patterns` | Habit history | Habit behavior |
| **Habit AI analysis** | `habits.aiAnalysis(name)` | Habit name + history | Can be sensitive habit names |
| **Recovery nudge** | `habits.recoveryNudge({habitName, streak, tinyVersion, whyStarted})` | Habit name + user's "why" | Behavioral |
| **Food coach** | `ai.foodCoach({dailyLogs, calorieGoal, proteinGoal})` | Daily calorie/protein/carb/fat logs + goals | Nutrition |
| **Workout plan** | `ai.workout({level, sessions})` | Fitness level + recent session summaries | Fitness |
| **Fuel question analysis / weight suggest** | `fuelQuestions.aiAnalysis`, `suggestWeight` | Question text + answer history | Behavioral |
| **Food AI analysis** | `fuel.foodAiAnalysis(name, month)` | Food name + month | Nutrition |

- **Conversations stored?** No chat/history stored client-side; each call is one-shot request→response.
- **Prompts include personal data?** Yes (see table).
- **Health data included?** Recovery-related AI features use health-derived recovery figures (per privacy-policy copy); HealthKit raw data is not directly posted to `/ai/*` from the client but is available server-side.
- **Training?** Privacy-policy copy asserts data is not used to train the provider's models — **verify contractually with the AI provider (OpenAI zero-retention/no-train terms).**
- **Consent:** An onboarding consent screen (S_Consent) discloses that data "may be sent to trusted AI service providers" and gates the Future Mirror AI call.

---

## 8. Health Data

Collected (all → backend):

| Category | Collected? | Source |
|----------|-----------|--------|
| Weight / body mass | ✅ | Manual (onboarding/edit-profile) + Apple Health `bodyMass` |
| Calories | ✅ | Manual food logs + HealthKit `activeEnergyBurned` |
| Food / nutrition | ✅ | Food logs, items, macros, photos |
| Exercise / workouts | ✅ | Strength logs + HealthKit workouts |
| Steps | ✅ | HealthKit |
| Water | ❌ | Not tracked |
| Sleep | ✅ | HealthKit sleep analysis (asleep durations) |
| Heart rate (resting, avg, **HRV**) | ✅ | HealthKit |
| Mood | ⚠️ Indirect | Self-rating, coaching-tone, reflection text (not a mood tracker per se) |
| Smoking | ✅ | Onboarding habits/pain points/outcomes; control-habit presets ("Cigarettes") |
| Alcohol | ✅ | Onboarding + control-habit preset |
| Medical conditions | ❌ | Not explicitly collected |
| Mental health | ⚠️ | Anxiety/fear-of-failure blockers, addiction recovery framing |
| Journal entries | ⚠️ | Free-text disappointment reflection; habit "why", workout notes, food notes |
| Body measurements | ✅ | Height, weight |
| Goals | ✅ | Onboarding goals/outcomes |
| Habit history / progress | ✅ | Core tracking |
| **GPS workout routes** | ✅ | HealthKit workout routes (lat/lng/altitude/timestamp) — **location data** |

HealthKit is **opt-in, off by default**, toggled from Profile; user picks exact data types in Apple's system sheet; disconnect stops further reads ([lib/healthKit.ts](../lib/healthKit.ts), profile.tsx). Read types requested: step count, active energy, resting HR, HRV (SDNN), body mass, walking/running distance, flights climbed, avg heart rate, sleep analysis, workouts ([lib/healthKit.ts:99-104](../lib/healthKit.ts#L99)).

---

## 9. Notifications

- **No push notifications.** No `expo-notifications`, no APNs/FCM token registration, no `getExpoPushToken`, no local notification scheduling anywhere in the client.
- The only notification-related data is a **boolean preference** `notificationsEnabled` (onboarding + edit-profile), plus a `dailyNudgeTime` preference — both stored in the user profile ([lib/api.ts:27,117](../lib/api.ts#L27)).
- No device tokens are collected or transmitted. (If reminders are delivered, it is not via any mechanism present in this client — likely server-side email or a future feature.)
- `aps-environment` entitlement: **not present** in `Grittt.entitlements`.

---

## 10. Tracking

- **No analytics/telemetry SDK of any kind** (no Firebase Analytics, Mixpanel, PostHog, Amplitude, Segment, Sentry, etc.). No screen-view, event, funnel, retention, performance, or crash tracking.
- **No advertising identifier (IDFA)**, no `expo-tracking-transparency`, no ad SDKs.
- **No device identifiers** read (no `expo-device`, no `Constants.installationId`/`deviceId` usage).
- **App Tracking Transparency:** Not applicable / not implemented — the app does not track users across other companies' apps or sites. `ITSAppUsesNonExemptEncryption: false` is declared.
- **Screen Time / usage tracking:** A native `UsageAccess` module (FamilyControls) and `UsageAccessGate` UI exist but are **not mounted anywhere** — no runtime authorization request and, by Apple's design, the module cannot read app names or per-app minutes anyway ([modules/usage-access/ios/UsageAccessModule.swift:13-16](../modules/usage-access/ios/UsageAccessModule.swift#L13)). Treat as **dormant/unused** in the shipped experience.
- **Leaderboards** display other users' names/avatars/scores — social visibility, not tracking.

---

## 11. Cookies

**None.** The client uses stateless JWT bearer auth over `fetch`; no cookies are set, read, or sent. The only browser interaction is the Google OAuth `expo-web-browser` flow, where Google may set its own cookies in that browser session (outside app control).

---

## 12. Children

The app is **intended for adults** and enforces an **18+ age gate** in onboarding (`MIN_AGE = 18`, DOB stepper). Content strongly implies an adult audience (porn/masturbation/alcohol/smoking/gambling recovery). Recommend explicitly stating **"not directed to children under 18"** in the policy; not designed as a child-directed service under COPPA/age-appropriate design codes.

---

## 13. User-Generated Content

Every place a user creates content:
- **Habit names / units / "why started" / tiny-version** (index.tsx) — can be sensitive
- **Custom challenges** — title + description (challenges.tsx)
- **Custom fuel questions** — free-text prompts + option labels (fuel-questions.tsx)
- **Food entries** — food names + notes + macros (fuel.tsx, fuel-analysis.tsx)
- **Workout logs** — exercise names, sports, notes (strength.tsx)
- **Onboarding reflection** — free-text disappointment statement
- **Food photos** — camera/gallery images (fuel.tsx, fuel-analysis.tsx, ai.tsx)
- **Name/avatar** — shown to other users on leaderboards/rankings
- ❌ No public comments, no chat, no journal-per-se module, no social posting.
- **Outbound share:** `Share.share` shares a **challenge's** text (title/benefits) to other apps — not personal data (challenges.tsx).

---

## 14. Data Export

- **No self-serve data export/download.** No "download my data" feature exists in the client.
- The only "share" is `Share.share` of challenge marketing text (not the user's personal data).
- ⚠️ **GDPR/CCPA gap:** No portability/access mechanism in-app. Policy should describe how a user requests their data (e.g. via support email).

---

## 15. Data Deletion

Available from **Edit Profile** ([app/edit-profile.tsx](../app/edit-profile.tsx)):
- **Delete all tracked data (keep account):** `users.deleteData(token)` → `DELETE /users/me/data` ([lib/api.ts:338-339](../lib/api.ts#L338)).
- **Delete account permanently:** `users.deleteAccount(token)` → `DELETE /users/me`, then local `logout()`/`storage.clear()` ([lib/api.ts:341-342](../lib/api.ts#L341)). Confirmed irreversible in UI copy.
- Granular deletion (single habit/journal/AI-history/image) is **not** individually exposed — habits/food items can be deleted individually via their own delete endpoints (`tasks.delete`, `fuel.deleteItem`, `health.deleteWorkout`), but "delete my AI history" / "delete my images" specifically are not surfaced (images aren't persisted client-side anyway).
- **Apple Health disconnect:** stops further reads; already-synced data remains on backend until data/account deletion (profile.tsx copy).

---

## 16. Sensitive Data (elevated-risk inventory)

| Type | Present? | What |
|------|----------|------|
| **Health** | ✅ High | Steps, HR, HRV, resting HR, sleep, weight, distance, calories, workouts |
| **Biometric** | ⚠️ | Heart-rate/HRV are physiological but not "biometric identifiers"; no Face/Touch data collected |
| **Location** | ✅ | **GPS workout routes** from HealthKit (lat/lng/altitude) — location history |
| **Financial** | ⚠️ | `isPremium`/`premiumUntil` flags only; **no payment/card data in client** (billing is a dev stub, §17) |
| **Religion / Political** | ❌ | Not collected |
| **Medical** | ⚠️ | Addiction/recovery status (porn, smoking, alcohol, gambling), anxiety — health-adjacent, arguably GDPR Art. 9 |
| **Sexual behavior** | ✅ | "Quit porn"/"Quit masturbation" outcomes & habits — **special-category (GDPR Art. 9)** |
| **Mental health** | ⚠️ | Anxiety, fear of failure, self-worth reflection |
| **Children's data** | ❌ | 18+ gated |

**Takeaway:** Sexual-behavior and addiction data make this a **special-category** processor under GDPR — requires explicit consent (present in onboarding S_Consent), a lawful basis, and heightened safeguards. GPS routes make it location-sensitive under App Store rules.

---

## 17. Security

- **HTTPS/TLS:** Production traffic uses `EXPO_PUBLIC_API_BASE` (expected HTTPS). ⚠️ The **default dev fallback is cleartext `http://192.168.1.6:3001`** ([lib/api.ts:1](../lib/api.ts#L1)) — ensure production always sets an HTTPS base and consider ATS enforcement.
- **Certificate pinning:** ❌ None.
- **Token storage:** ⚠️ JWT + full user profile in **unencrypted AsyncStorage**, not SecureStore/Keychain ([lib/storage.ts](../lib/storage.ts)). Recommend migrating the token to `expo-secure-store`.
- **Passwords:** Sent over TLS; hashed server-side (never stored plaintext, per policy). Client holds password only in transient state.
- **JWT auth:** Bearer token on every request; cleared on 401/403.
- **Authorization:** All data endpoints require the bearer token (server-enforced).
- **Local encryption:** None at rest on device beyond OS-level.
- **HealthKit:** Read via Apple's permissioned APIs; GPS routes transmitted to backend — ensure TLS + server-side encryption at rest.
- ⚠️ **Dev logging:** `__DEV__` request logger prints headers (incl. bearer token) and bodies ([lib/api.ts:221-233](../lib/api.ts#L221)) — dev-only; verify not reachable in release.
- ⚠️ **Dev/demo endpoints in client:** `mirror.setPremium` is a "DEV UNLOCK STUB — flips premium so the paywall can be demoed. Real billing later." ([lib/api.ts:928-930](../lib/api.ts#L928)) — confirm it's disabled/removed before GA and that no real payment flow ships without a proper processor + disclosure.

---

## 18. App Store Privacy Labels (mapping)

For Apple "App Privacy" (App Store Connect) and Google Data Safety. "Linked to user" = yes because all data is tied to an authenticated account. "Tracking" per Apple's definition (sharing with data brokers / cross-app advertising) = **No** for every item (no ad/analytics SDKs).

| Data item | Collected? | Linked to user? | Used for tracking? | Apple category | Purpose |
|-----------|-----------|-----------------|--------------------|----------------|---------|
| Name | Yes | Yes | No | Contact Info → Name | App Functionality |
| Email address | Yes | Yes | No | Contact Info → Email | App Functionality, Account |
| Password | Yes | Yes | No | (Credential — not a label category; handled as auth) | App Functionality |
| Date of birth / age | Yes | Yes | No | Sensitive? → **no**; use "Other Data" / age gate | App Functionality |
| Height / weight / body metrics | Yes | Yes | No | **Health & Fitness → Fitness/Health** | App Functionality |
| Health metrics (steps, HR, HRV, sleep, energy) | Yes (opt-in) | Yes | No | **Health & Fitness → Health** | App Functionality |
| Workout GPS routes | Yes (opt-in) | Yes | No | **Location → Precise Location** | App Functionality |
| Nutrition/food logs | Yes | Yes | No | Health & Fitness → Fitness | App Functionality |
| Food photos | Yes | Yes | No | **User Content → Photos** | App Functionality (AI estimation) |
| Habits/goals/reflections (incl. addiction/sexual-behavior) | Yes | Yes | No | **Sensitive Info** + User Content | App Functionality |
| Workout/strength logs | Yes | Yes | No | Health & Fitness → Fitness | App Functionality |
| Coaching/notification/appearance prefs | Yes | Yes | No | Usage Data → Other (preferences) | App Functionality |
| Purchase/premium status | Yes (flag) | Yes | No | Purchases (status only) | App Functionality |
| Other users' name/avatar shown (leaderboards) | Displayed | Yes | No | User Content | Social feature |
| Advertising ID / analytics ID | **No** | — | — | — | — |
| Device ID / crash / diagnostics | **No** | — | — | — | — |
| Cookies / tracking | **No** | — | — | — | — |

**Apple "Data Used to Track You": NONE.** **Data Linked to You:** Contact Info, Health & Fitness, Location (precise, opt-in), User Content, Sensitive Info, Purchases, Identifiers (account id), Usage Data (preferences). **Data Not Linked:** none material.

---

## Complete Privacy Audit Summary

**What Grittt collects.** A first-party account (name, email, password or Apple/Google identity), a rich onboarding profile (DOB/age, height, weight, sleep, activity), and highly personal behavioral data: goals, pain points, blockers, and habits centered on **addiction and recovery (porn, masturbation, smoking, alcohol, gambling)**, plus a free-text reflection. Ongoing use adds habit completions, nutrition logs (incl. **food photos** sent to AI), strength/workout logs, custom checklist questions, and — **optionally** — Apple Health data including sleep, HRV, heart rate, weight, and **GPS workout routes**.

**Where it goes.** Everything is transmitted to the first-party Grittt backend over the API. AI features (Snap Track, Future Mirror, debriefs/analyses) relay data through the backend to **OpenAI**. Sign-in uses **Apple** and **Google** (Google's OAuth runs server-side; no Google secrets in the app). **No other third parties, no analytics, no ad networks, no crash reporting.**

**Where it's stored on device.** Only **AsyncStorage** — the **JWT and full cached user profile are unencrypted** (no SecureStore/Keychain, no SQLite/MMKV). Food photos are never persisted to disk by app code.

**Permissions.** Camera + Photo Library (food photos), HealthKit read (opt-in, off by default). **Microphone (iOS + Android RECORD_AUDIO) and a Screen Time/FamilyControls module are declared/present but unused** — remove or wire up to avoid App Store scrutiny. No location permission is requested directly, yet **location data enters via HealthKit GPS routes**.

**Notifications & tracking.** No push tokens, no notification SDK (boolean preference only). No tracking, no advertising ID, no device identifiers, no cookies.

**User controls.** In-app **delete-all-data** and **delete-account** (irreversible) exist; Health can be disconnected. **No in-app data export/portability** (GDPR/CCPA gap — provide a support path).

**Top risk flags for the policy & before launch:**
1. **Special-category data** (sexual behavior, addiction, mental health, health, precise location via GPS routes) → requires explicit consent + lawful basis + Art. 9 handling. Consent screen exists; ensure it's granular and logged.
2. **Unencrypted token/profile in AsyncStorage** → migrate token to SecureStore.
3. **EXIF/GPS not stripped** from food photos in fuel.tsx & fuel-analysis.tsx (only ai.tsx sets `exif:false`).
4. **Unused Microphone + RECORD_AUDIO + Screen Time entitlement** → remove if not used.
5. **Cleartext dev API fallback** and **`__DEV__` header/body logging** → confirm production hygiene.
6. **`mirror.setPremium` dev billing stub** → remove before shipping real billing.
7. **Pre-signup AI call** (`/future-mirror`) sends a sensitive profile before an account exists → ensure consent precedes it and clarify processing.
8. **No data export** → add or document a request channel.
9. **OpenAI processing** → confirm no-training/zero-retention terms and disclose the sub-processor.
10. **Leaderboards** expose other users' name/avatar → disclose social visibility.

*Report generated from a full read of `lib/`, `components/`, `modules/`, `app/` (all screens), `app.json`, `ios/Grittt/Info.plist`, `ios/Grittt/Grittt.entitlements`, and `package.json`.*
