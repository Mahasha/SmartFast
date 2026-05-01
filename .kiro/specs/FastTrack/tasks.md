# Implementation Plan: FastTrack

## Overview

FastTrack is an offline-first intermittent fasting mobile app built with React Native (Expo), TypeScript, and Supabase. This plan breaks the MVP into incremental milestones. Each task builds on the previous ones so the app can be tested after every checkpoint. All code is TypeScript targeting Expo SDK.

## Tasks

- [x] 1. Project setup and tooling
  - [x] 1.1 Initialize Expo project with TypeScript template
    - Run `npx create-expo-app FastTrack --template expo-template-blank-typescript`
    - Add ESLint, Prettier, and project-level tsconfig strict settings
    - Install core dependencies: `react-navigation`, `@react-native-async-storage/async-storage`, `@supabase/supabase-js`, `expo-notifications`, `uuid`
    - Create folder structure: `src/{screens, components, domain, data, models, content, navigation, theme, utils}`
    - _Requirements: 24, 26, 27, 28_

  - [x] 1.2 Configure environment and constants
    - Create `src/utils/constants.ts` with AsyncStorage key constants (all `@fasttrack:*` keys from design)
    - Create `src/utils/env.ts` for Supabase URL and anon key (read from Expo constants / .env)
    - _Requirements: 27_

- [x] 2. Theme and design tokens
  - [x] 2.1 Implement ThemeManager and design tokens
    - Create `src/theme/tokens.ts` defining light and dark `Theme` objects per design (dark green accent, pastel card palette, timer arc/track colors, error/warning/success/locked colors)
    - Create `src/theme/ThemeContext.tsx` React context providing `getActiveTheme`, `setTheme`, `onThemeChange`
    - Implement system-theme detection via `Appearance` API; default to system preference on first launch
    - Implement deterministic pastel card color assignment using stable hash of identifier modulo palette length
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 19.4, 19.5_

  - [x] 2.2 Write unit tests for ThemeManager
    - Test light/dark toggle, system default, hash-based color stability
    - _Requirements: 25_

- [x] 3. Navigation and screen structure
  - [x] 3.1 Set up React Navigation bottom tabs
    - Install `@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/native-stack`
    - Create `src/navigation/AppNavigator.tsx` with bottom tabs: Home, Learn, Recipes, Profile
    - Apply dark green accent to active tab indicator
    - Ensure tab state preservation (scroll position, component state) when switching tabs
    - Create placeholder screens for all routes listed in Requirement 24 AC4
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5_

  - [x] 3.2 Add stack navigators for nested flows
    - Home stack: Dashboard → Plan Selection → Streaks & Achievements → Fasting History
    - Profile stack: Profile → Settings → Notification Settings → Paywall
    - Auth stack: Login → Register → Onboarding
    - _Requirements: 24.4_

- [x] 4. Local storage layer
  - [x] 4.1 Implement AsyncStorage service
    - Create `src/data/localStorage.ts` with typed get/set/remove helpers wrapping AsyncStorage
    - Use key constants from `constants.ts`
    - Implement JSON serialization/deserialization with error handling
    - _Requirements: 27.1, 27.2, 27.3_

  - [x] 4.2 Write unit tests for localStorage service
    - Test serialization round-trips, key naming, error paths
    - _Requirements: 27_

- [x] 5. Domain models and types
  - [x] 5.1 Define all TypeScript interfaces and types
    - Create `src/models/index.ts` exporting: `FastingSession`, `SessionStatus`, `TERMINAL_STATUSES`, `FastingPlan`, `DailyStats`, `StreakRecord`, `SubscriptionStatus`, `SubscriptionTier`, `UserProfile`, `NotificationPreference`, `SyncQueueEntry`, `SyncableRecord`, `TimerState`, `ClockCheckResult`, `ForwardJumpResult`
    - Ensure all fields match the design document data models exactly
    - _Requirements: 26.1, 26.4, 26.5, 26.6, 34.1, 34.5_

  - [x] 5.2 Define ProFeature enum and plan constants
    - Create `src/models/plans.ts` with predefined free plans (12:12, 14:10, 16:8) and Pro plans (18:6 through 48h)
    - Define `ProFeature` type and feature list
    - _Requirements: 3.1, 3.2, 21.1_

- [x] 6. Checkpoint — Ensure project compiles and navigation renders
  - Document assumptions and continue unless blocked.

- [x] 7. Fasting timer — core logic
  - [x] 7.1 Implement FastingTimer domain service
    - Create `src/domain/fastingTimer.ts` implementing `startFast`, `endFastEarly`, `cancelFast`, `getActiveSession`, `computeProgress`
    - `startFast`: create session with UTC ISO 8601 startTime/endTime, status ACTIVE, persist to AsyncStorage, return session
    - `computeProgress`: compute `remainingMs`, `elapsedMs`, `progressFraction`, formatted strings, `isComplete` from session + current Date
    - Prevent starting a new fast while one is ACTIVE
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 7.2 Write unit tests for FastingTimer
    - Test session creation, progress computation, end-early logic, auto-complete detection
    - _Requirements: 4, 5, 7_

- [x] 8. Session persistence and recovery
  - [x] 8.1 Implement session restore and background recovery
    - Add `restoreSession` to FastingTimer: on launch, read `@fasttrack:activeSession`; if endTime is past, mark COMPLETED and show summary; otherwise resume timer
    - On app foreground (AppState listener), recalculate progress from system clock
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 8.2 Implement timer tick persistence
    - Store `lastTimerCheckUtc` and `lastKnownElapsedMs` in AsyncStorage at minimum every 10 seconds during ACTIVE session
    - _Requirements: 6.6_

- [x] 9. Clock integrity checks
  - [x] 9.1 Implement backward drift detection
    - In `checkClockIntegrity`: compare current time to `lastTimerCheckUtc`; if current < last by >60s, return `{ valid: false, driftSeconds }`
    - Display warning to user; continue timer from original timestamps
    - _Requirements: 6.5_

  - [x] 9.2 Implement forward jump detection
    - In `checkForwardClockJump`: if `(currentTime - lastTimerCheckUtc) - expectedElapsed > 10 minutes`, flag suspicious
    - Do NOT auto-complete; show warning; mark session with `CLOCK_SUSPECT` flag in AsyncStorage key `@fasttrack:clockSuspect:{sessionId}`
    - CLOCK_SUSPECT session cannot become Qualifying_Fast until user confirms summary
    - _Requirements: 6.7, 6.8, 6.9, 6.10_

  - [x] 9.3 Write unit tests for clock integrity
    - Test backward drift, forward jump, normal progression, CLOCK_SUSPECT flag lifecycle
    - _Requirements: 6_

- [x] 10. Basic Fasting Dashboard (early UI)
  - [x] 10.1 Build initial Fasting Dashboard screen
    - Circular Timer component with dark green arc, muted track, progress animation
    - Display: remaining time (HH:MM:SS), elapsed time, plan name, start time
    - "Start Fast" button (when no session ACTIVE)
    - "End Fast" button with confirmation dialog (when session ACTIVE)
    - Wire to FastingTimer domain service for start/end/restore
    - Accessibility: `accessibilityLabel` on all interactive elements; text alternative for timer
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.1, 7.2, 7.4, 7.5, 25.4, 29.1, 29.4_

- [x] 11. Plan selection and PRO_MOCK gating
  - [x] 11.1 Implement PlanSelector domain service
    - Create `src/domain/planSelector.ts` implementing `getAvailablePlans`, `selectPlan`, `createCustomPlan`, `isProPlan`
    - Free plans always selectable; Pro plans locked when tier is FREE
    - Custom plans require PRO_MOCK tier; max 48h for MVP
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 11.2 Implement SubscriptionManager
    - Create `src/domain/subscriptionManager.ts` implementing `getSubscriptionStatus`, `isProFeature`, `setMockStatus`, `handleProDowngrade`
    - Read/write `@fasttrack:subscriptionStatus` in AsyncStorage
    - Treat `'pro'` and `'pro_mock'` identically for feature gating
    - On downgrade: revert active plan to a free plan if current is Pro-only
    - Provide dev toggle for FREE ↔ PRO_MOCK
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5_

  - [x] 11.3 Build Plan Selection screen UI
    - Display plans with name, fasting/eating hours, description, lock indicator for Pro plans when FREE
    - Tapping locked plan navigates to Paywall
    - Extended fast disclaimer for plans ≥24h
    - General health disclaimer on screen
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.7, 33.1, 33.2, 33.3_

  - [x] 11.4 Write unit tests for PlanSelector and SubscriptionManager
    - Test gating logic, custom plan validation, downgrade behavior
    - _Requirements: 3, 21_

- [x] 12. Daily stats tracking
  - [x] 12.1 Implement DailyTracker domain service
    - Create `src/domain/dailyTracker.ts` implementing `saveDailyStats`, `getDailyStats`, `validateMetric`
    - Key by localDate (YYYY-MM-DD in device timezone)
    - Store canonical units (ml, kg, kcal, integer steps); convert at UI boundary
    - Validation: weight 20–300 kg, calories 0–10000, water 0–20000 ml, steps 0–200000
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.6, 9.7, 34.2_

  - [x] 12.2 Build Daily Stats UI component
    - Input fields for water (glasses or ml), weight (kg/lb based on unitPreference), calories, steps
    - Display current day's stats on dashboard
    - Show validation warning with confirmation for out-of-range values
    - _Requirements: 9.1, 9.4, 9.5, 9.7_

  - [x] 12.3 Write unit tests for DailyTracker
    - Test metric validation, unit conversion, date keying
    - _Requirements: 9_

- [x] 13. Streak engine
  - [x] 13.1 Implement StreakEngine domain service
    - Create `src/domain/streakEngine.ts` implementing `recomputeStreaks`, `isQualifyingFast`, `getStreakDays`, `shouldShortCircuit`
    - Qualifying_Fast: status COMPLETED or ENDED_EARLY with durationFasted ≥ 90% of plan fastingHours; CANCELLED never qualifies
    - Streak day: calendar day (device local timezone) with ≥1 Qualifying_Fast
    - Current streak: consecutive streak days ending today or yesterday (grace period)
    - Streak does NOT increment until today's Qualifying_Fast completes
    - Short-circuit: compare cached updatedAt, lastStreakDate, sessionCountSnapshot; if any mismatch → full recompute
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 12.1, 12.2, 12.3, 12.4, 12.5, 34.3_

  - [x] 13.2 Build Streaks & Achievements screen
    - Calendar view with green (qualifying), yellow (started but not qualifying), unmarked days
    - Display current streak and longest streak prominently
    - Pro-only insights shown with lock indicator when FREE
    - _Requirements: 13.1, 13.2_

  - [x] 13.3 Write unit tests for StreakEngine
    - Test qualifying fast logic, consecutive day counting, grace period, short-circuit, timezone boundary
    - _Requirements: 11, 12_

- [x] 14. Checkpoint — Ensure timer, dashboard, plans, stats, and streaks work end-to-end locally
  - Document assumptions and continue unless blocked.

- [x] 15. Notifications
  - [x] 15.1 Implement NotificationScheduler
    - Create `src/domain/notificationScheduler.ts` implementing `scheduleFastingMilestones`, `cancelSessionNotifications`, `rescheduleSessionNotifications`, `scheduleWaterReminders`, `scheduleWeighInReminder`, `cancelRemindersByType`, `requestPermissions`, `revalidateOnLaunch`
    - Milestones: Fast Started, Halfway, 12h (if plan ≥12h — "12 Hours Reached"), 90%, Completed
    - Skip milestones whose time has already passed
    - Persist scheduled notification IDs in AsyncStorage keyed by sessionId
    - On launch with ACTIVE session: revalidate — skip past milestones, ensure completion notification scheduled, no duplicates
    - Use Expo Notifications API
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 15.2 Implement reminder scheduling
    - Water reminders: recurring at configured interval (default 2h) during 8AM–10PM
    - Weigh-in reminder: daily at configured time (default 8AM)
    - Cancel/reschedule on preference change
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [x] 15.3 Build Notification Settings screen
    - Permission request with pre-permission explanation screen
    - Toggles for fasting milestones, water reminders, weigh-in reminder
    - Interval/time pickers for water and weigh-in
    - If permissions denied: disable toggles, show instructions to enable in device settings
    - Persist NotificationPreference to AsyncStorage
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [x] 15.4 Write unit tests for NotificationScheduler
    - Test milestone scheduling, cancellation, revalidation, reminder intervals
    - _Requirements: 14, 15, 16_

- [x] 16. Supabase schema and RLS
  - [x] 16.1 Create Supabase migration for all tables
    - Write SQL migration creating tables: `profiles`, `fasting_plans`, `fasting_sessions`, `daily_stats`, `streaks`, `notification_preferences`, `subscription_status`
    - All timestamps as TIMESTAMPTZ
    - UNIQUE constraint on (userId, localDate) for daily_stats
    - Seed predefined fasting plans (free and Pro) with `createdByUserId = NULL`
    - _Requirements: 26.1, 26.3, 26.4, 26.5, 26.6_

  - [x] 16.2 Implement Row Level Security policies
    - Enable RLS on all tables
    - Default policy: users can only SELECT, INSERT, UPDATE, DELETE their own rows (WHERE userId = auth.uid())
    - fasting_plans RLS:
      - Predefined plans (`createdByUserId IS NULL`): globally readable by all authenticated users (SELECT)
      - Custom plans (`createdByUserId = auth.uid()`): only visible and editable by their owner (SELECT, INSERT, UPDATE, DELETE)
      - No user can INSERT/UPDATE/DELETE predefined plans
    - _Requirements: 26.2_

  - [x] 16.3 Create Supabase client wrapper
    - Create `src/data/supabaseClient.ts` initializing Supabase client with URL and anon key
    - Configure auth persistence with AsyncStorage adapter
    - _Requirements: 26_

- [x] 17. Auth and guest mode
  - [x] 17.1 Implement AuthManager
    - Create `src/domain/authManager.ts` implementing `register`, `login`, `logout`, `restoreSession`, `refreshToken`, `startGuestSession`, `migrateGuestToAccount`, `isGuest`, `isAuthenticated`
    - Use Supabase Auth for register/login/logout/refresh
    - Guest mode: set `@fasttrack:guestMode` flag, userId = "guest", no Supabase sync
    - Session restore on launch: check stored token, refresh if expired, fallback to login
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 32.1_

  - [x] 17.2 Implement guest-to-account migration
    - If email is new: create Supabase account, migrate all local guest data (sessions, stats, streaks, prefs) to new userId, convert AsyncStorage keys
    - If email exists: show "An account already exists for this email. Please log in to continue." — do NOT merge
    - On failure: preserve local data, inform user, allow retry
    - Offline migration blocked: show "An internet connection is required to create your account. Your local data is safe — please try again when you're online."
    - _Requirements: 32.2, 32.3, 32.4, 32.5_

  - [x] 17.3 Build Login, Register, and Guest screens
    - Login: email + password fields, "Continue as Guest" button, error messages
    - Register: email + password fields, validation, navigate to onboarding on success
    - Network unavailable: show message, block attempt
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.8, 32.1, 32.5_

  - [x] 17.4 Build Onboarding flow
    - Sequence of intro screens explaining fasting basics, app features, navigation
    - Plan selection step showing free plans
    - Persist onboarding completion flag
    - Navigate to dashboard with selected plan
    - Allow skip (mark as skipped, proceed to dashboard)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 17.5 Write unit tests for AuthManager
    - Test login, register, guest mode, migration (new email), existing-email handling, offline migration blocking
    - _Requirements: 1, 32_

- [x] 18. Sync engine
  - [x] 18.1 Implement SyncEngine core
    - Create `src/data/syncEngine.ts` implementing `enqueue`, `pushPendingChanges`, `pullRemoteChanges`, `resolveConflict`, `resolveSessionConflict`, `getSyncQueueSize`
    - Sync queue stored in `@fasttrack:syncQueue` as array of `SyncQueueEntry`
    - Push changes chronologically; pull and merge remote changes
    - Background execution — never block UI
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 8.1, 8.2, 8.3_

  - [x] 18.2 Implement session-aware conflict resolution
    - Terminal status beats ACTIVE (never overwrite terminal with ACTIVE)
    - Both terminal: latest updatedAt wins
    - Both ACTIVE: latest updatedAt wins; startTime protected unless session was created locally with no remote equivalent
    - ACTIVE endTime differs (plan change): latest updatedAt wins
    - _Requirements: 23.7_

  - [x] 18.3 Implement token refresh and retry on RLS/auth errors
    - On auth/RLS/JWT rejection: attempt token refresh once → retry write once → if still failing, keep in queue and show non-blocking warning
    - Auth/RLS failures NEVER interrupt active timer
    - _Requirements: 35.10, 35.11, 35.12, 35.13_

  - [x] 18.4 Trigger streak recomputation after sync
    - After `pullRemoteChanges` completes, call StreakEngine.recomputeStreaks with merged session history
    - _Requirements: 23.8_

  - [x] 18.5 Write unit tests for SyncEngine
    - Test conflict resolution rules (terminal vs ACTIVE, ACTIVE vs ACTIVE, startTime protection), queue management, retry logic, token refresh flow
    - _Requirements: 23, 35_

- [x] 19. Checkpoint — Ensure auth, sync, and full data flow work together
  - Document assumptions and continue unless blocked.

- [x] 20. Learn and recipes static content
  - [x] 20.1 Create static content data files
    - Create `src/content/learnArticles.json` with sample articles organized by category (Getting Started, Science of Fasting, Tips and Tricks, Health Benefits)
    - Create `src/content/recipes.json` with sample recipes organized by category (Breakfast, Lunch, Dinner, Snacks, Smoothies)
    - Each article: id, title, category, contentType ("article"), estimatedReadTime, body (markdown or structured text)
    - Each recipe: id, title, category, description, ingredients, steps, nutrition (calories, protein, carbs, fat), prepTime, thumbnail
    - _Requirements: 17.1, 17.4, 18.1, 18.4_

  - [x] 20.2 Build Learn Section screens
    - List screen: articles grouped by category, showing content type, estimated read time, category
    - Detail screen: full article content in readable format
    - Lazy-load list for performance
    - _Requirements: 17.1, 17.2, 17.4, 28.3_

  - [x] 20.3 Build Recipe Section screens
    - List screen: recipes with thumbnail and brief description, organized by category
    - Detail screen: full recipe with title, description, ingredients, steps, nutrition info, prep time
    - Lazy-load list for performance
    - _Requirements: 18.1, 18.2, 18.4, 28.3_

- [x] 21. Profile and settings
  - [x] 21.1 Build Profile screen
    - Display: display name, email, selected plan, subscription status
    - Edit display name (persist to AsyncStorage + Supabase)
    - Links to: Settings, Notification Settings, Paywall, Logout
    - _Requirements: 19.1, 19.2_

  - [x] 21.2 Build Settings screen
    - Theme preference toggle (light/dark/system) — apply immediately via ThemeManager
    - Unit preference (metric/imperial)
    - Account management: logout, delete account
    - _Requirements: 19.3, 19.4, 19.5_

  - [x] 21.3 Implement account deletion
    - Confirmation dialog explaining permanent data loss
    - Delete user data from Supabase (online-required, direct operation outside sync queue)
    - Clear local AsyncStorage
    - Navigate to login screen
    - If offline: inform user and block deletion
    - _Requirements: 19.6_

- [x] 22. Paywall UI and mock subscription state
  - [x] 22.1 Build Paywall screen
    - Display pricing: Monthly R39.99, Yearly R199.99 (~R16.67/month, ~58% savings)
    - "Save 58%" or "Best value" badge on yearly option
    - Free vs Pro feature comparison table
    - 7-day free trial mention (UI only, no real billing)
    - CTA buttons (non-functional for MVP — show toast "Coming soon")
    - _Requirements: 20.1, 20.2, 20.3, 21.2_

  - [x] 22.2 Add dev/test subscription toggle
    - Hidden developer menu or settings toggle to switch between FREE and PRO_MOCK
    - On toggle: update SubscriptionStatus in AsyncStorage, trigger UI refresh, handle downgrade if switching to FREE
    - _Requirements: 21.4_

- [x] 23. Error handling
  - [x] 23.1 Implement sync error handling
    - Network errors: queue locally, retry on connectivity
    - Retry limit with non-blocking "Some changes have not synced yet" warning
    - Sync failures never stop the timer
    - _Requirements: 35.1, 35.2, 35.3_

  - [x] 23.2 Implement notification error handling
    - Log scheduling errors, show non-blocking message
    - Notification failures never affect session state
    - _Requirements: 35.4, 35.5_

  - [x] 23.3 Implement storage error handling
    - AsyncStorage write failure for active session: blocking alert
    - AsyncStorage read failure on launch: attempt Supabase recovery for authenticated users; show error state for guests
    - _Requirements: 35.6, 35.7_

  - [x] 23.4 Implement auth error handling
    - Network unavailable on login/register: show message, block attempt
    - Server errors (5xx, timeout): generic retry message
    - _Requirements: 35.8, 35.9_

- [x] 24. Fasting dashboard — final wiring
  - [x] 24.1 Enhance Fasting Dashboard with daily stats and streak display
    - Add daily stats summary section to dashboard
    - Add current streak display
    - _Requirements: 9.4, 13.2_

  - [x] 24.2 Build Fasting History screen
    - List all past sessions in reverse chronological order
    - Each entry: plan name, start time, end time, duration, status
    - Detail view with full metadata and daily stats for that day
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 24.3 Wire timer lifecycle with notifications and sync
    - On startFast: persist session, enqueue sync, schedule milestone notifications
    - On endFastEarly/cancel: update session, enqueue sync, cancel notifications
    - On auto-complete: update session, enqueue sync, trigger streak recompute
    - On app launch: restore session, revalidate notifications, trigger sync pull
    - _Requirements: 4.2, 4.3, 7.3, 14.1, 14.2, 14.6, 23.2_

- [x] 25. Accessibility pass
  - [x] 25.1 Add accessibility labels and screen reader support
    - Add `accessibilityLabel` to all buttons, inputs, tabs, timer
    - Ensure logical reading order for TalkBack navigation on all screens
    - Support dynamic text sizing
    - Verify minimum 4.5:1 contrast ratio for normal text; 3:1 for large text
    - Ensure interactive controls distinguishable in both themes
    - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 29.6_

- [x] 26. Checkpoint — Full MVP integration test
  - Document assumptions and continue unless blocked.

- [x] 27. QA and testing checklist
  - [x] 27.1 Write integration tests for critical flows
    - Timer start → persist → restore → complete flow
    - Guest mode → migration flow
    - Sync conflict resolution scenarios
    - Streak computation across multiple days
    - _Requirements: 4, 6, 7, 8, 11, 23, 32_

  - [x] 27.2 Write unit tests for remaining untested modules
    - ProfileManager, NotificationPreference persistence, content loading
    - _Requirements: 19, 14, 17, 18_

  - [x] 27.3 PRO_MOCK QA validation
    - Verify all Pro-gated plans and screens work correctly in PRO_MOCK state
    - Verify all Pro features show lock indicator in FREE state
    - Verify downgrade from PRO_MOCK to FREE reverts plan correctly
    - Test feature gating treats 'pro' and 'pro_mock' identically
    - _Requirements: 21.1, 21.2, 21.3, 21.4_

  - [x] 27.4 Performance and device testing notes
    - Verify dashboard renders within 2 seconds on reference devices (Samsung Galaxy A14, Redmi Note 12)
    - Verify timer updates at 1-second intervals without jank
    - Verify lazy-loading of Learn and Recipe content
    - Verify background sync does not cause UI lag
    - _Requirements: 28.1, 28.2, 28.3, 28.4_

- [x] 28. Final checkpoint — All tests pass, MVP complete
  - Document assumptions and continue unless blocked.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- **Mandatory tests**: FastingTimer (7.2), Clock integrity (9.3), StreakEngine (13.3), AuthManager (17.5), SyncEngine (18.5) — these are NOT optional
- Each task references specific requirements for traceability
- Checkpoints (tasks 6, 14, 19, 26, 28) ensure incremental validation
- All timestamps are UTC ISO 8601; local conversion happens only at the presentation layer
- The app uses TypeScript throughout (React Native / Expo SDK)
- PRO_MOCK is the only Pro state in MVP — no real billing integration
- Static content (Learn, Recipes) is bundled as local JSON assets
- CLOCK_SUSPECT is local-only and not synced to Supabase
- fasting_plans RLS: predefined plans (`createdByUserId = NULL`) are globally readable; custom plans (`createdByUserId = auth.uid()`) are only visible/editable by their owner
