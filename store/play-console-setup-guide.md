# Grittt — Play Console Setup Guide (step-by-step)

Account is created + paid. The production `.aab` is built:
**https://expo.dev/artifacts/eas/8bdrzbe2YCFELjhyTwBr2r.aab** (v1.0.0, versionCode 2)

Work through these in order in https://play.google.com/console.

---

## STEP 0 — Identity verification
Check the Play Console banner. If identity verification is pending, complete it
(government ID + address). You can fill everything below while it processes, but
**cannot publish** until it clears.

## STEP 1 — Create the app
**All apps → Create app**
- App name: `Grittt: Discipline & Habits`
- Default language: English (US)
- App or game: **App**
- Free or paid: **Free**
- Tick the declarations (developer program policies, US export laws).

## STEP 2 — "Set up your app" / App content (left nav → Policy → App content)
Fill EVERY section here — Google blocks release until all are green.

### Privacy policy
- URL: `https://grittt.online/privacy`  ✅ (already live)

### App access
- The app uses Google Sign-In. If **any** Google account can sign in and use all
  features → choose **"All functionality is available without special access"**.
- If parts are gated/restricted → choose the other option and provide a test login
  + step-by-step instructions for Google's reviewers.

### Ads
- Does your app contain ads? → **No** (unless you add an ad SDK).

### Content rating (IARC questionnaire)
- Email: akshat.jangid@hirequotient.com
- Category: **Utility, Productivity, Communication, or Other**
- Answer honestly. Most answers = **No** (no violence, no sexual content, no gambling
  mechanics, no user-to-user comms unless your challenges include chat).
- ⚠️ **Alcohol/Tobacco/Drugs:** the app lets users TRACK vices (alcohol, cigarettes,
  etc.) to quit them. If asked whether the app *references* these, answer truthfully.
  It will likely land at **Teen / 16+ / 18+** depending on the questionnaire — that's
  fine for this app.

### Target audience and content
- Target age: **18+** (recommended given vice references) — at minimum 13+.
- Is the app designed for children? → **No**.

### Data safety  (see ready answers in STEP 3)

### Other declarations (answer as they appear)
- News app? **No**  · COVID-19 contact tracing? **No**
- Government app? **No** · Financial features? **No**
- Health: it's a wellness/habit app — declare health content if prompted; it is NOT a
  medical device and makes no medical claims.

## STEP 3 — Data Safety form (ready-to-paste answers)
**Does your app collect or share required user data types?** → **Yes**

**Data collected (not "shared" — see note):**
| Data type | Collected | Purpose | Optional/Required |
|---|---|---|---|
| Name | Yes | Account management, App functionality | Required |
| Email address | Yes | Account management, App functionality | Required |
| User IDs (Google account ID) | Yes | Account management, App functionality | Required |
| App activity (in-app actions: habits, check-ins) | Yes | App functionality | Required |

**Security questions:**
- Is all user data encrypted in transit? → **Yes** (HTTPS).
- Do you provide a way to request data deletion? → **Yes** — via email
  (akshat.jangid@hirequotient.com). *(Google increasingly prefers an in-app or web
  deletion flow; email is accepted for now. Consider adding a deletion request URL later.)*

**"Shared" with third parties?**
- OpenAI receives habit context to generate AI nudges, but as a **service provider
  processing on your behalf** — under Google's definition this is **collection/processing,
  NOT "sharing."** So you generally do **not** check "shared" for it. (If unsure, Google's
  Data Safety help page confirms transfers to service providers aren't "sharing.")

## STEP 4 — Main store listing (Store presence → Main store listing)
Paste from `play-store-listing.md`. Required:
- App name, short description (≤80 chars), full description
- **App icon** 512×512 (you have it)
- **Feature graphic** 1024×500  ← MUST CREATE
- **Phone screenshots** min 2  ← MUST CREATE
- App category: **Health & Fitness** (or Lifestyle); add contact email + website.

## STEP 5 — Create a release (TESTING FIRST — required for new personal accounts)
⚠️ New personal accounts must run **Closed testing with 12+ testers for 14 continuous
days** before production is unlocked.

1. **Testing → Closed testing → Create track** (or use the default "Alpha").
2. Create a release → **upload the `.aab`** (download from the EAS URL above).
3. Add **12+ tester emails** (Google accounts). They must **opt in** via the testing
   link AND keep the app installed/used for **14 days**.
4. Roll out to closed testing.

## STEP 6 — Promote to Production (after the 14 days)
- **Production → Create release** → reuse the tested `.aab` (or a new build).
- Complete the rollout; submit for review. First review can take a few days.

---

## Your blockers right now
1. Identity verification (if pending) — Google's side.
2. **Feature graphic (1024×500)** + **2 phone screenshots** — you must create these.
3. 12 testers lined up for the 14-day closed test.

Everything else (the `.aab`, privacy policy, listing text, Data Safety + rating answers)
is ready.
