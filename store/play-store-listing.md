# Grittt — Google Play Store Listing (draft)

> Fill these into Play Console → your app → **Store presence → Main store listing**.
> Character limits are Google's hard caps.

---

## App name (max 30 chars)
```
Grittt: Discipline & Habits
```
*(27 chars. Alternatives: "Grittt — Beat Your Vices" / "Grittt: Habit & Streak Tracker")*

## Short description (max 80 chars)
```
Quit your vices and build discipline with simple daily streaks. Progress, not perfection.
```
*(⚠️ 89 chars — trim to ≤80. Suggested ≤80: "Quit your vices & build discipline with daily streaks. Progress, not perfection.")*

## Full description (max 4000 chars)
```
Grittt is a discipline tracker for people who want to quit their vices and build
better habits — one honest day at a time.

Most habit apps punish you for slipping. Grittt is built on a simpler idea:
progress, not perfection. A bad day doesn't erase your progress — you log it,
recover, and keep going.

WHAT YOU CAN DO
• Track the vices you want to cut — alcohol, nicotine, doomscrolling, junk food,
  and more — and the habits you want to build.
• Keep daily streaks and watch your discipline score grow.
• Log a slip without losing everything — recover and stay in the game.
• Join challenges to stay accountable.
• Get short, personalized nudges when you need a push.

WHY GRITTT
• Simple, fast daily check-ins.
• A forgiving system that keeps you coming back instead of guilt-tripping you.
• Built for self-mastery, not vanity metrics.

Start today. Build the streak. Become someone you're proud of.
```

## Category
- **Application type:** App
- **Category:** Health & Fitness  *(or Lifestyle)*
- **Tags:** habits, discipline, self-improvement, streaks

## Contact details
- **Email:** akshat.jangid@hirequotient.com
- **Website:** https://grittt.online
- **Privacy Policy:** https://grittt.online/privacy

---

## Graphic assets you must produce (Google requirements)
| Asset | Spec | Status |
|---|---|---|
| App icon | 512×512 PNG, 32-bit | ✅ have `icon.png` (verify it's 512²) |
| Feature graphic | **1024×500 PNG/JPG** | ❌ need to create |
| Phone screenshots | **min 2**, 16:9 or 9:16, 320–3840px | ❌ need to capture |
| (optional) 7" / 10" tablet shots | — | optional |

---

## Content rating questionnaire — notes
- Be honest about **references to alcohol, tobacco, gambling** as *tracked vices*
  (the app helps users QUIT them, but the questionnaire asks if they're referenced).
  Likely lands at **Teen / Mature 17+** depending on answers.

## Data Safety form — what to declare
- **Collected:** Name, Email, Google account ID (Account info); app activity (habits/usage).
- **Microphone/Audio:** declare ONLY if a shipped feature uses `RECORD_AUDIO`.
  ⚠️ ACTION: confirm whether RECORD_AUDIO is actually used. If not, remove it from
  `app.json` android.permissions to avoid an unjustified-permission review flag.
- **Shared with third parties:** OpenAI (for AI features), as processor.
- **Encryption in transit:** Yes (HTTPS). **Deletion method:** email request.

## Target audience & content
- Set target age appropriately (likely 18+ given vice content, or 13+ — decide with content rating).
- Declare it is NOT primarily directed at children.

---

## Pre-launch checklist
- [ ] Play Developer account registered + identity verified ($25)
- [ ] Privacy policy live at https://grittt.online/privacy
- [ ] Confirm/justify or remove RECORD_AUDIO permission
- [ ] Production .aab built via EAS
- [ ] Feature graphic (1024×500) created
- [ ] 2+ phone screenshots captured
- [ ] Content rating questionnaire completed
- [ ] Data Safety form completed
- [ ] (Personal accounts) 12+ testers on closed testing for 14 days before production
