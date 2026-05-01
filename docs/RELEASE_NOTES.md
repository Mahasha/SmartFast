# Release Notes

## v0.1.0 — MVP (Initial Release)

**Release Date**: May 2026

### What's New

This is the initial MVP release of FastTrack, an offline-first intermittent fasting app.

#### Fasting Timer
- Start, end early, or cancel fasting sessions
- Circular progress timer with real-time countdown (HH:MM:SS)
- Session persistence across app restarts, backgrounding, and reboots
- Clock integrity checks (backward drift detection, forward jump detection)
- CLOCK_SUSPECT flagging for suspicious time changes

#### Plan Selection
- 3 free plans: 12:12, 14:10, 16:8
- 8 Pro plans: 18:6, 20:4, 21:3, 22:2, 23:1, 24h, 36h, 48h
- Custom plan creation (Pro only, 1–48h)
- Extended fast safety disclaimers for plans ≥24h

#### Daily Health Tracking
- Water intake (glasses/ml), weight (kg/lb), calories (kcal), steps
- Validation with out-of-range warnings
- Metric/imperial unit preference

#### Streak System
- Qualifying fast detection (90% of plan duration threshold)
- Current streak with grace period (alive through end of current day)
- Longest streak tracking
- Calendar view with color-coded days (green = qualifying, yellow = started)

#### Notifications
- Fasting milestones: Started, Halfway, 12h Reached, 90%, Completed
- Water reminders (configurable interval, 8AM–10PM)
- Weigh-in reminders (configurable time)
- Permission management with pre-permission explanation

#### Authentication
- Email/password registration and login via Supabase Auth
- Guest mode with full free-tier access
- Guest-to-account migration (new email only, no merge)
- Session restore on app launch

#### Data Sync
- Offline-first with AsyncStorage
- Queue-based sync to Supabase
- Session-aware conflict resolution (terminal beats ACTIVE)
- Token refresh and retry on auth errors
- Streak recomputation after sync

#### Content
- 12 educational articles across 4 categories
- 15 recipes across 5 categories with nutrition info
- Bundled as static JSON (no network dependency)

#### Profile & Settings
- Display name editing
- Theme toggle (light/dark/system)
- Unit preference (metric/imperial)
- Account deletion with confirmation
- Paywall with pricing display (mock billing)

#### Accessibility
- Screen reader labels on all interactive elements
- Contrast ratio compliance (4.5:1 normal, 3:1 large text)
- Dynamic text sizing support
- Logical TalkBack navigation order

### Known Limitations

- Subscription billing is mocked (PRO_MOCK flag, no real purchases)
- CLOCK_SUSPECT is single-device only
- No multi-device active session conflict resolution
- Content is static (no CMS updates)
- Android-first (iOS not yet tested)
- No recipe search functionality
- No video content in Learn section

### Technical Notes

- Built with Expo SDK 54, React Native 0.81, TypeScript 5.9
- Supabase for auth and cloud storage with Row Level Security
- 300+ automated tests (unit + integration)
- Offline-first architecture — timer works without any network connectivity
