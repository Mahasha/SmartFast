# Testing Guide

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run a specific test file
npx jest src/domain/fastingTimer.test.ts

# Run tests matching a pattern
npx jest --testPathPattern="integration"

# Run with coverage
npx jest --coverage
```

## Test Infrastructure

- **Framework**: Jest 30 with ts-jest transform
- **React Native**: @testing-library/react-native for component tests
- **Mocks**: AsyncStorage mock in `jest.setup.js`, Supabase client mocked per test file
- **SVG**: `__mocks__/react-native-svg.js` provides mock SVG components

## Critical Flows Tested

### Unit Tests

| Module | File | Coverage |
|--------|------|----------|
| Theme tokens | `src/theme/__tests__/tokens.test.ts` | stableHash, getCardColor, theme objects |
| ThemeContext | `src/theme/__tests__/ThemeContext.test.tsx` | Provider, useTheme, system detection |
| localStorage | `src/data/localStorage.test.ts` | get/set/remove, JSON round-trips, errors |
| FastingTimer | `src/domain/fastingTimer.test.ts` | start, end, cancel, restore, progress |
| Session Recovery | `src/domain/useSessionRecovery.test.ts` | foreground recovery, auto-complete |
| Timer Tick | `src/domain/timerTickPersistence.test.ts` | persist, read, clear, interval check |
| Clock Integrity | `src/domain/clockIntegrity.test.ts` | backward drift, forward jump, CLOCK_SUSPECT |
| PlanSelector | `src/domain/planSelector.test.ts` | available plans, selection, custom plans |
| SubscriptionManager | `src/domain/subscriptionManager.test.ts` | status, gating, mock toggle, downgrade |
| DailyTracker | `src/domain/dailyTracker.test.ts` | validation, save/get, date keying |
| StreakEngine | `src/domain/streakEngine.test.ts` | qualifying, streak days, recompute, short-circuit |
| NotificationScheduler | `src/domain/notificationScheduler.test.ts` | milestones, reminders, permissions |
| AuthManager | `src/domain/authManager.test.ts` | login, register, guest, migration |
| SyncEngine | `src/data/syncEngine.test.ts` | queue, conflicts, push, pull, retry |
| CircularTimer | `src/components/__tests__/CircularTimer.test.tsx` | rendering, accessibility |

### Integration Tests

| Flow | File | What's Tested |
|------|------|---------------|
| Timer Lifecycle | `src/__tests__/integration/timerLifecycle.integration.test.ts` | Start → persist → restore → complete, streak integration |
| Guest Migration | `src/__tests__/integration/guestMigration.integration.test.ts` | Guest session → migration → offline blocking |
| Sync Conflicts | `src/__tests__/integration/syncConflictResolution.integration.test.ts` | All conflict resolution rules, queue management |
| Streak Multi-Day | `src/__tests__/integration/streakComputation.integration.test.ts` | Consecutive days, missed days, grace period, 90% threshold |
| PRO_MOCK QA | `src/__tests__/integration/proMockQA.integration.test.ts` | Pro gating, lock indicators, downgrade, tier equivalence |
| Profile & Content | `src/__tests__/integration/profileAndContent.test.ts` | Profile CRUD, notification prefs, content loading |

## Manual QA Checklist

### Pre-Release Device Testing

- [ ] Cold start time < 2 seconds on Samsung Galaxy A14 / Redmi Note 12
- [ ] Timer runs smoothly for 30+ minutes without jank
- [ ] Navigate between all tabs while timer is active — no frame drops
- [ ] Scroll through Learn articles list — smooth scrolling
- [ ] Scroll through Recipes list — smooth scrolling
- [ ] Start a fast, background the app for 5 minutes, resume — timer correct
- [ ] Start a fast, kill the app, relaunch — session restored correctly
- [ ] Toggle airplane mode during active fast — timer unaffected
- [ ] Trigger sync with 10+ queued items — UI remains responsive
- [ ] Switch theme (light/dark) — immediate visual update
- [ ] Enter daily stats while timer is active — no interference

### Subscription QA

- [ ] All Pro plans show 🔒 in FREE state
- [ ] Tapping locked plan navigates to Paywall
- [ ] Dev toggle (tap version 7x) switches FREE ↔ PRO_MOCK
- [ ] Pro plans unlock after toggling to PRO_MOCK
- [ ] Downgrade from PRO_MOCK to FREE reverts Pro plan to 12:12
- [ ] Custom plan creation works in PRO_MOCK, blocked in FREE

### Auth QA

- [ ] Register with new email → navigates to Onboarding
- [ ] Register with existing email → shows error
- [ ] Login with valid credentials → navigates to Dashboard
- [ ] Login with invalid credentials → shows error
- [ ] Continue as Guest → full free-tier access
- [ ] Logout → returns to Login screen
- [ ] Offline login attempt → shows network error

### Accessibility QA

- [ ] TalkBack reads all buttons, inputs, and timer correctly
- [ ] Tab navigation order is logical
- [ ] Timer announces progress percentage
- [ ] All interactive elements have minimum 48dp touch targets
- [ ] Text contrast meets 4.5:1 for normal text, 3:1 for large text

## Reference Android Devices

| Device | RAM | Chipset | Android |
|--------|-----|---------|---------|
| Samsung Galaxy A14 | 4 GB | Exynos 850 / Helio G80 | 13+ |
| Redmi Note 12 | 4 GB | Snapdragon 4 Gen 1 | 13+ |

These represent the target mid-range Android user base (3–4 GB RAM class). All performance targets assume release builds with Hermes engine enabled.
