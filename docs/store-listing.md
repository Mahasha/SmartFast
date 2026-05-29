# FastTrack — Google Play Store Listing

Copy/paste these into **Play Console → Grow → Store presence → Main store listing**.

---

## App name (max 30 chars)
```
FastTrack: Fasting Tracker
```
*(26 chars. The on-device name stays "FastTrack"; the store name can be more descriptive for discoverability.)*

## Short description (max 80 chars)
```
Intermittent fasting timer with overtime, streaks & daily health logging.
```
*(72 chars.)*

## Full description (max 4000 chars)
```
FastTrack is a clean, distraction-free intermittent fasting tracker that helps you start, run, and complete your fasts with confidence.

Pick a fasting plan, tap start, and watch your progress on a simple circular timer. Reached your goal but want to keep going? FastTrack keeps counting in overtime until you decide to end your fast — so you stay in control, not the clock.

WHAT YOU CAN DO
• Start a fasting timer for popular plans like 12:12, 14:10, and 16:8
• Keep fasting past your goal with open-ended overtime tracking
• End your fast whenever you're ready — your real fasted time is always recorded
• Build and track fasting streaks to stay motivated
• Log daily health metrics: water, weight, calories, and steps
• Get notifications for fasting milestones and your goal
• Browse fasting tips, learn content, and recipe ideas
• Use light or dark mode, metric or imperial units
• Sign in to sync your data securely across devices

DESIGNED TO STAY OUT OF YOUR WAY
No ads. No clutter. Your fasting timer keeps running accurately even if you close the app or restart your phone, because it's calculated from your real start time.

A NOTE ON HEALTH
FastTrack is a tracking and informational tool, not medical advice. Intermittent fasting isn't right for everyone — please consult a qualified healthcare provider before starting, especially if you are pregnant, nursing, or managing a medical condition.

Start your first fast today and make every hour count.
```

---

## Graphics you must upload

| Asset | Spec | Required? |
|---|---|---|
| **App icon** | 512 × 512 px, 32-bit PNG, ≤ 1 MB | Yes |
| **Feature graphic** | 1024 × 500 px, PNG or JPG (no alpha) | Yes |
| **Phone screenshots** | 2–8 images, PNG/JPG; each side 320–3840 px; use portrait 9:16 | Yes (min 2) |
| Tablet screenshots | 7" and 10" | Optional |

Tips:
- You already have an app icon at `assets/icon.png` — resize/export it to exactly 512×512 for the listing icon.
- For screenshots: capture real phone frames from your internal-testing install (Home timer, an active fast, overtime state, streaks, daily stats). Portrait, at least 2.
- Feature graphic: a simple branded banner (app name + the circular timer) works fine.

---

## Data safety form answers (Play Console → App content → Data safety)

These must match the privacy policy.

- **Does your app collect or share user data?** → Yes (collect), No sharing with third parties.
- **Is data encrypted in transit?** → Yes.
- **Can users request data deletion?** → Yes (in-app: Settings → Delete Account).

Data types collected:
- **Personal info → Email address** — Collected. Purpose: Account management, App functionality. Required.
- **Personal info → Name** (display name) — Collected. Purpose: Account management, App functionality.
- **Health & fitness → Health info** (fasting sessions, water, weight, calories, steps) — Collected. Purpose: App functionality. Optional.
- **App activity / App info & performance** — only if you later add analytics (you currently have none → declare none).

Declare **No ads** in App content → Ads.

---

## Other App content declarations (quick answers)
- **Privacy policy**: paste your hosted URL.
- **Ads**: No, my app does not contain ads.
- **App access**: All functionality requires sign-in → provide test credentials (use a seeded account) so reviewers can log in.
- **Content rating**: complete the questionnaire (a fasting/health utility → expect "Everyone").
- **Target audience**: 18+ (or 13+), not designed for children.
- **Data safety**: as above.
- **Health apps declaration**: if shown, FastTrack is a general wellness/tracking tool, not a medical device.
