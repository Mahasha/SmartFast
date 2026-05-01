# FastTrack

An offline-first intermittent fasting mobile app built with React Native (Expo), TypeScript, and Supabase.

## Overview

FastTrack helps users manage intermittent fasting schedules through a system-time-based fasting timer, daily health tracking, streak-based gamification, educational content, and a freemium subscription model. The app targets Android first with iOS compatibility planned for a later phase.

## Tech Stack

- **Framework**: React Native (Expo SDK 54)
- **Language**: TypeScript (strict mode)
- **Navigation**: React Navigation (bottom tabs + native stacks)
- **Local Storage**: AsyncStorage
- **Backend**: Supabase (Postgres + Auth + RLS)
- **Notifications**: Expo Notifications
- **Testing**: Jest + React Native Testing Library
- **Linting**: ESLint + Prettier

## Features

### MVP (Current)

- **Fasting Timer** — System-clock-based timer with circular progress display, session persistence across app restarts/backgrounding, and clock integrity checks
- **Plan Selection** — 3 free plans (12:12, 14:10, 16:8) and 8 Pro plans (18:6 through 48h) with subscription gating
- **Daily Health Tracking** — Water intake, weight, calories, and steps with validation
- **Streak System** — Qualifying fast detection (90% threshold), consecutive day counting, grace period, and calendar view
- **Notifications** — Fasting milestones, water reminders, and weigh-in reminders via Expo Notifications
- **Auth & Guest Mode** — Supabase Auth with email/password, guest mode with migration path
- **Offline-First Sync** — Queue-based sync with session-aware conflict resolution
- **Learn Section** — Educational articles about intermittent fasting
- **Recipe Section** — Healthy recipes organized by category
- **Profile & Settings** — Theme toggle, unit preferences, account management
- **Paywall** — Pro subscription UI (mock billing for MVP)
- **Accessibility** — Screen reader labels, contrast compliance, dynamic text sizing

### Subscription Model (MVP Mock)

- **FREE**: Basic plans, timer, tracking, streaks, content
- **PRO_MOCK**: Advanced plans, custom plans, extended fasts, analytics, insights, badges
- Dev toggle available in Settings (tap version 7 times to reveal)

## Project Structure

```
FastTrack/
├── src/
│   ├── components/       # Reusable UI components (CircularTimer, DailyStatsInput)
│   ├── content/          # Static JSON content (articles, recipes)
│   ├── data/             # Data layer (localStorage, supabaseClient, syncEngine)
│   ├── domain/           # Business logic services
│   │   ├── authManager.ts
│   │   ├── dailyTracker.ts
│   │   ├── fastingTimer.ts
│   │   ├── notificationScheduler.ts
│   │   ├── planSelector.ts
│   │   ├── streakEngine.ts
│   │   ├── subscriptionManager.ts
│   │   ├── timerLifecycle.ts
│   │   └── timerTickPersistence.ts
│   ├── models/           # TypeScript interfaces and constants
│   ├── navigation/       # React Navigation setup
│   ├── screens/          # Screen components
│   ├── theme/            # Theme tokens and context
│   └── utils/            # Constants, env config, error handling, accessibility
├── supabase/
│   └── migrations/       # SQL migrations with RLS policies
├── docs/                 # Architecture, testing, and release docs
├── App.tsx               # Root component
├── package.json
└── tsconfig.json
```

## Setup Instructions

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npx expo`)
- A Supabase project (for auth and sync)

### Installation

```bash
cd FastTrack
npm install
```

### Environment Variables

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous/public key |

### Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the migration to create tables and RLS policies:
   ```sql
   -- Copy contents of supabase/migrations/001_initial_schema.sql
   -- and run in the Supabase SQL Editor
   ```
3. Copy your project URL and anon key to `.env`

### Running the App

```bash
# Start Expo dev server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on web (limited support)
npm run web
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck

# Lint
npm run lint
```

## Known MVP Limitations

- **No real billing** — Subscription uses local PRO_MOCK flag, no RevenueCat/Google Play integration
- **Single device** — CLOCK_SUSPECT flag is local-only, not synced across devices
- **No multi-device conflict** — Active session conflicts across devices are Post-MVP
- **Static content** — Learn and Recipe content is bundled JSON, not a CMS
- **No 72h plan** — Maximum extended fast is 48h for MVP
- **No recipe search** — Browse only, search is Post-MVP
- **No video content** — Learn section is articles only
- **Android-first** — iOS not yet tested/optimized

## Post-MVP Roadmap

- Real billing integration (RevenueCat / Google Play Billing)
- Multi-device active session conflict resolution
- Advanced analytics and streak insights
- Achievement badges
- Recipe search
- Video content in Learn section
- Dynamic content management (Supabase CMS)
- iOS release
- Play Store readiness
- Data export functionality
- Multi-language localization

## License

MIT — see [LICENSE](./LICENSE) for details.
