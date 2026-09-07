# Login & Signup — Web Build Spec (APIs, request/response)

Source of truth: `app/(auth)/login.tsx`, `app/(auth)/signup.tsx`, `lib/auth.tsx`, `lib/api.ts` (client) and `Grittt-server/src/routes/auth.ts` (backend).

- Base URL: `${API_BASE}/api` (prod `https://grittt.online/api`).
- Content type: `application/json` on every request.
- Auth: stateless **JWT**. After login/signup you get a `token` — send it on all later requests as `Authorization: Bearer <token>`. (The backend also sets an httpOnly `token` cookie, but the app uses the Bearer token; do the same on web and persist the token yourself.)
- Token lifetime: **7 days** (`JWT_EXPIRES_IN`, default `7d`).

---

## 1. Email / Password — Signup

**`POST /api/auth/signup`** — public.

Client sends the trimmed name and **lower-cased, trimmed email**. Frontend validation before calling: all fields required, password ≥ 8 chars.

Request body:
```json
{
  "name": "Aditya Soni",
  "email": "you@example.com",
  "password": "your-password"
}
```
Server rules: `name` 1–100 chars, `email` valid, `password` 8–128 chars.

**Success — `201 Created`:**
```json
{
  "user": { /* User object — see §6 */ },
  "token": "eyJhbGciOiJIUzI1Ni...."
}
```

**Errors:**
| Status | When | Body |
|---|---|---|
| `400` | Validation failed (bad email, short password, etc.) | `{ "error": "<message>" }` |
| `409` | Email already registered | `{ "error": "<message>" }` |
| `500` | Server error | `{ "error": "Internal server error" }` |

After signup the app routes the user into **onboarding** (new accounts always go to onboarding).

---

## 2. Email / Password — Login

**`POST /api/auth/login`** — public. Email is lower-cased/trimmed client-side.

Request body:
```json
{ "email": "you@example.com", "password": "your-password" }
```

**Success — `200 OK`:**
```json
{ "user": { /* User object — see §6 */ }, "token": "eyJhbGci..." }
```

**Errors:**
| Status | When | Body |
|---|---|---|
| `400` | Missing/invalid fields | `{ "error": "<message>" }` |
| `401` | Wrong email/password, **or the account is Google-only (no password set)** | `{ "error": "Invalid email or password" }` |

After login the app decides where to go from `user.onboardingDone`: `false` → onboarding, `true` → home.

---

## 3. Current user (session hydrate)

**`GET /api/auth/me`** — requires `Authorization: Bearer <token>`.

On web app start: read the stored token → call this → if it returns a user, you're logged in.

**Success — `200`:** the **User object** (§6) directly (not wrapped).
**Errors:** `401` missing/invalid/expired token → treat as logged out and clear the token. `404` user not found.

> Client behavior worth copying: only clear the session on an explicit `401/403`. On network errors/5xx, keep the last-known user so people aren't logged out by a blip.

---

## 4. Logout

**`POST /api/auth/logout`** — clears the server cookie and returns `{ "message": "..." }`.
On web, **also delete your locally-stored token** — that's what actually ends the session (JWT is stateless).

---

## 5. Social login (Google / Apple)

### Google — use the WEB redirect flow for the browser app
(The mobile app uses a browser-poll flow; on web you want the standard redirect.)

1. Send the user to **`GET /api/auth/google`** (full-page navigation, not fetch).
2. Backend runs OAuth, then **redirects to `${CLIENT_URL}/auth/callback?token=<jwt>`** on success, or `${CLIENT_URL}/login?error=google&message=...` on failure.
3. Your web app needs a route at **`/auth/callback`** that reads `token` from the query string, stores it, then calls `GET /api/auth/me` and routes by `onboardingDone`.
   - ⚠ `CLIENT_URL` is a backend env var — make sure it points at the web app's origin so the redirect lands correctly.

There's also **`POST /api/auth/google/verify-token`** `{ accessToken }` → `{ user, token }` if you'd rather do the OAuth client-side (e.g. Google Identity Services) and just exchange the access token. Returns the same `{user, token}` shape; `401` if the token is invalid.

### Apple — ⚠ not available on the backend
The mobile app calls `POST /api/auth/apple`, **but that route does not exist on the server** (it's unimplemented). **Do not ship an Apple button on web until the backend adds `/api/auth/apple`.** If/when added, the app posts `{ identityToken, fullName?, email? }` and expects `{ user, token }`.

---

## 6. The `User` object (returned by signup / login / me)

Same shape everywhere. `password_hash` and `google_id` are **never** returned. Many profile fields are `null` until onboarding fills them in.

```ts
type User = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;                 // ISO timestamp
  onboardingDone: boolean;            // ← route new users to onboarding when false

  // profile (null until onboarding / edit-profile)
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  dateOfBirth?: string | null;        // YYYY-MM-DD
  goals?: string[];
  baselineSelfRating?: number | null;
  priorityMode?: 'disc' | 'fuel' | 'phys' | null;
  dailyNudgeTime?: 'morning' | 'midday' | 'evening' | 'before_bed' | null;
  coachingTone?: 'soft' | 'bal' | 'hard' | null;
  notificationsEnabled?: boolean | null;
  macroTargets?: { calories: number; protein: number; fat: number; carbs: number } | null;

  // premium
  isPremium?: boolean;
  premiumUntil?: string | null;

  // onboarding profile (sensitive)
  desiredOutcomes?: string[];
  painPoints?: string[];
  blockers?: string[];
  disappointmentStatement?: string | null;
  positiveHabits?: string[];
  negativeHabits?: string[];
  sleepSchedule?: string | null;
  activityLevel?: string | null;
  futureMirror?: object | null;       // AI "future self" result
};
```

Example (fresh email signup, pre-onboarding):
```json
{
  "id": "3c2f...",
  "email": "you@example.com",
  "name": "Aditya Soni",
  "avatar_url": null,
  "created_at": "2026-08-05T09:12:44.001Z",
  "onboardingDone": false,
  "isPremium": false
}
```

---

## 7. Error handling contract (all endpoints)

- Errors come back as JSON `{ "error": "<message>" }` (sometimes `{ "message": ... }`); the client shows `error || message`. Read the body for a human message, fall back to `HTTP <status>`.
- Standard codes used: `400` validation, `401` auth failure, `409` duplicate email, `404` not found, `500` server error, `204` no content.

## 8. Page structure reference (what the screens contain)

**Login** (`app/(auth)/login.tsx`): Grittt logo/tagline → "Welcome back" → **EMAIL** input → **PASSWORD** input (secure) → **Sign In** button (shows "Signing in…") → divider → **Apple** button → **Google** button → "Don't have an account? Sign up" → "New to Grittt? Get started →" (goes straight to onboarding). Client validation: email+password non-empty; email lower-cased/trimmed.

**Signup** (`app/(auth)/signup.tsx`): "GRITTT" + "Create your account" → **Name** → **Email** → **Password** (min 8) → **Create Account** button (shows "Creating account…") → divider → **Apple** (SIGN_UP) → **Google** ("Sign up with Google") → "Already have an account? Sign in". Client validation: all required, password ≥ 8. On success → onboarding.

> For web: keep the email/password + Google buttons. **Omit Apple** until `/api/auth/apple` exists on the backend.
```
