# Requirements Document

## Introduction

FastTrack is a mobile intermittent fasting application built with React Native (Expo), TypeScript, and Supabase. The application helps users manage intermittent fasting schedules through a system-time-based fasting timer, daily health tracking, streak-based gamification, educational content, and a freemium subscription model. The application targets Android first with iOS compatibility planned for a later phase. FastTrack follows an offline-first architecture, persisting active session data locally via AsyncStorage and syncing to Supabase when connectivity is available. The application monetizes through a Pro subscription tier (monthly R39.99, yearly R199.99, with a 7-day free trial) managed via RevenueCat or Google Play Billing (Post-MVP). For MVP, subscription state is represented by a local mock flag (FREE or PRO_MOCK) with no real billing integration.

## Release Scope

### MVP (First Releasable Version)

- **Requirement 1**: User Authentication
- **Requirement 32**: Guest Mode
- **Requirement 2**: First-Time Onboarding
- **Requirement 3**: Fasting Plan Selection (free plans: 12:12, 14:10, 16:8; Pro plans visible with lock: 18:6 through 48h; 72h is Post-MVP)
- **Requirement 4**: Fasting Timer — Starting a Fast
- **Requirement 5**: Fasting Timer — Active Timer Display
- **Requirement 6**: Fasting Timer — Session Persistence and Recovery
- **Requirement 7**: Fasting Timer — Ending a Fast
- **Requirement 8**: Fasting Timer — Offline Behavior (basic offline, no multi-device conflict resolution)
- **Requirement 9**: Daily Health Tracking (water, weight, calories, steps)
- **Requirement 10**: Fasting History (list view only, AC1-AC3; no analytics)
- **Requirement 11**: Streak System — Current Streak Calculation
- **Requirement 12**: Streak System — Longest Streak and Missed Days
- **Requirement 13**: Streak System — Calendar Display and Achievements (AC1-AC2 calendar and basic counts only)
- **Requirement 14**: Notification Scheduling — Fasting Milestones
- **Requirement 15**: Notification Scheduling — Reminders
- **Requirement 16**: Notification Permissions
- **Requirement 17**: Learn Section (articles only, bundled static content)
- **Requirement 18**: Recipe Section (browse only, bundled static content, no search)
- **Requirement 19**: Profile Management
- **Requirement 21**: Subscription System — Feature Gating (local mock state only: FREE / PRO_MOCK; no real billing)
- **Requirement 23**: Data Synchronization (with session-aware conflict rules, no advanced integrity checks)
- **Requirement 24**: Navigation and Screen Structure
- **Requirement 25**: Theme and Visual Design
- **Requirement 26**: Supabase Data Model
- **Requirement 27**: Local Data Persistence
- **Requirement 28**: Performance on Mid-Range Android Devices
- **Requirement 29**: Accessibility
- **Requirement 33**: Extended Fast Safety Disclaimers
- **Requirement 34**: Timestamp and Timezone Rules
- **Requirement 35**: Error Handling

### Post-MVP

- **Requirement 20**: Subscription System — Purchase Flow (full RevenueCat / Google Play Billing integration)
- **Requirement 22**: Subscription System — Trial and Renewal
- **Requirement 10 AC4-AC5**: Advanced analytics in fasting history
- **Requirement 13 AC3-AC5**: Achievement badges and streak insights
- **Requirement 18 AC3**: Recipe search functionality
- **Requirement 17 AC3**: Video content in Learn section
- **Requirement 8 AC4**: Multi-device active session conflict resolution
- **Requirement 31**: Data Integrity Across Sync (advanced sync integrity checks)
- **Requirement 30**: Play Store Readiness
- **Requirement 34 AC7**: Historical timezone recalculation (re-evaluating past streak days using original timezoneOffsetMinutes for streak recomputation)
- 72h fasting plan
- Dynamic content management (Supabase CMS for Learn/Recipes)
- Offline content caching for Learn and Recipe sections
- Recipe search
- Video playback in Learn section

### Future/V2

- iOS release
- Multi-language localization
- Social features (sharing streaks, challenges)
- Wearable device integration
- Advanced meal planning
- AI-powered fasting recommendations
- Data export functionality

## Glossary

- **FastTrack_App**: The FastTrack mobile application, the top-level system under specification.
- **Fasting_Timer**: The component responsible for computing and displaying remaining fasting time based on system clock timestamps (startTime, endTime in UTC ISO 8601 format).
- **Fasting_Session**: A data record representing a single fasting period, including startTime, endTime, planId, status (ACTIVE, COMPLETED, ENDED_EARLY, CANCELLED), and userId. Status definitions: ACTIVE — session is currently in progress; COMPLETED — session ran to full duration (endTime reached); ENDED_EARLY — user manually ended the fast before endTime; CANCELLED — session was discarded/invalidated (e.g., system error, data corruption). Terminal statuses are COMPLETED, ENDED_EARLY, and CANCELLED. A terminal status must never be overwritten by ACTIVE during sync.
- **Fasting_Plan**: A predefined or custom fasting schedule defining fasting and eating window durations (e.g., 16:8 means 16 hours fasting, 8 hours eating).
- **Plan_Selector**: The component responsible for presenting available fasting plans and allowing the user to choose one before starting a fast.
- **Daily_Tracker**: The component responsible for recording daily health metrics including water intake, weight, calories, and steps.
- **Daily_Stats**: A data record representing a user's tracked health metrics for a single calendar day, keyed by localDate (YYYY-MM-DD in the user's local timezone).
- **Streak_Engine**: The component responsible for computing current streak, longest streak, and handling missed-day logic based on completed qualifying fasting sessions. Stored streak values are cached values only; the Streak_Engine must recompute streaks from the full history of qualifying sessions on app launch, after sync completion, and after any session status change. For MVP, recomputation may short-circuit when cached session count, latest session updatedAt, and lastStreakDate match local history; if any mismatch is detected, force full recomputation. Correctness is more important than optimization. For MVP, all streak recomputation uses the device's current local timezone uniformly — historical timezoneOffsetMinutes values are not used for streak calculations.
- **Streak**: A data record representing consecutive days on which a user completed at least one Qualifying_Fast. Stored streak values (currentStreak, longestStreak) are cached for display performance but are not the source of truth — they must be recomputed from Fasting_Session history.
- **Notification_Scheduler**: The component responsible for scheduling, cancelling, and rescheduling local notifications via Expo Notifications.
- **Notification_Preference**: A data record representing a user's notification settings (enabled/disabled per notification type).
- **Learn_Section**: The component responsible for displaying educational articles about intermittent fasting. For MVP, content is bundled as static local JSON/assets.
- **Recipe_Section**: The component responsible for displaying healthy recipes for the fasting lifestyle. For MVP, content is bundled as static local JSON/assets.
- **Profile_Manager**: The component responsible for managing user profile data and application settings.
- **Subscription_Manager**: The component responsible for managing Pro subscription state and feature gating. For MVP, subscription state is a local mock flag (FREE or PRO_MOCK) with no real billing integration. Post-MVP adds RevenueCat or Google Play Billing.
- **Subscription_Status**: A data record representing a user's current subscription tier (free or pro), expiry date, and trial status. For MVP, the tier field uses "free" or "pro_mock" with provider set to "local".
- **Auth_Manager**: The component responsible for user authentication (sign up, login, logout, session management) via Supabase Auth.
- **Sync_Engine**: The component responsible for synchronizing local data (AsyncStorage) with Supabase Postgres when network connectivity is available.
- **Onboarding_Flow**: The sequence of screens presented to first-time users to introduce the application and collect initial preferences.
- **Paywall_Screen**: The screen that presents Pro subscription options and the Free vs Pro feature comparison. For MVP, the paywall displays pricing and features but does not process real purchases.
- **Navigation_Bar**: The bottom tab navigation component providing access to primary screens (Home, Learn, Recipes, Profile).
- **Theme_Manager**: The component responsible for managing dark and light mode themes with the dark green premium color scheme.
- **Pro_User**: A user with an active Pro subscription (or PRO_MOCK state in MVP).
- **Free_User**: A user without an active Pro subscription.
- **Qualifying_Fast**: A Fasting_Session with status COMPLETED or ENDED_EARLY where the actual fasting duration (durationFasted) is greater than or equal to 90% of the planned fasting duration (fastingHours of the associated Fasting_Plan). Only Qualifying_Fasts count toward streak progression. CANCELLED sessions never qualify. For example, a 16:8 plan requires at least 14.4 hours (14h 24m) of actual fasting to qualify.
- **Circular_Timer**: The circular visual component on the fasting dashboard that displays fasting progress as a ring/arc.
- **Terminal_Status**: A Fasting_Session status that represents a final, irreversible state. Terminal statuses are: COMPLETED, ENDED_EARLY, and CANCELLED. Once a session reaches a terminal status, it must not revert to ACTIVE.

## Requirements


### Requirement 1: User Authentication [MVP]

**User Story:** As a user, I want to create an account and log in securely, so that my fasting data is tied to my identity and can be synced across sessions.

#### Acceptance Criteria

1. WHEN a new user submits a valid email and password on the registration screen, THE Auth_Manager SHALL create a new account via Supabase Auth and navigate the user to the Onboarding_Flow.
2. WHEN a returning user submits valid credentials on the login screen, THE Auth_Manager SHALL authenticate the user via Supabase Auth and navigate to the fasting dashboard.
3. IF the user submits invalid credentials, THEN THE Auth_Manager SHALL display a descriptive error message indicating the reason for failure (e.g., "Invalid email or password").
4. IF the user submits a registration request with an email that is already registered, THEN THE Auth_Manager SHALL display an error message indicating the email is already in use.
5. WHEN the user taps the logout button in the Profile screen, THE Auth_Manager SHALL end the Supabase session, clear locally cached credentials, and navigate to the login screen.
6. WHEN the FastTrack_App launches and a valid Supabase session token exists locally, THE Auth_Manager SHALL restore the authenticated session without requiring the user to re-enter credentials.
7. IF the stored session token has expired, THEN THE Auth_Manager SHALL attempt to refresh the token via Supabase Auth and, if refresh fails, navigate the user to the login screen.
8. IF network connectivity is unavailable when the user attempts to log in or register, THEN THE Auth_Manager SHALL display a message indicating that an internet connection is required for authentication and SHALL NOT attempt the request.

### Requirement 2: First-Time Onboarding [MVP]

**User Story:** As a new user, I want to be guided through an onboarding experience, so that I understand how the app works and can set my initial preferences.

#### Acceptance Criteria

1. WHEN a newly registered user completes authentication for the first time, THE Onboarding_Flow SHALL present a sequence of introductory screens explaining fasting basics, app features, and navigation.
2. WHEN the user reaches the plan selection step of the Onboarding_Flow, THE Plan_Selector SHALL display all available basic (free) fasting plans for the user to choose from.
3. WHEN the user completes the Onboarding_Flow, THE FastTrack_App SHALL persist a flag indicating onboarding completion so that the Onboarding_Flow is not shown on subsequent launches.
4. WHEN the user completes the Onboarding_Flow, THE FastTrack_App SHALL navigate the user to the fasting dashboard with the selected plan pre-loaded.
5. IF the user dismisses the Onboarding_Flow before completion, THEN THE FastTrack_App SHALL allow the user to proceed to the fasting dashboard and SHALL mark onboarding as skipped.

### Requirement 3: Fasting Plan Selection [MVP]

**User Story:** As a user, I want to choose from predefined fasting plans or create a custom plan, so that I can follow a fasting schedule that fits my lifestyle.

#### Acceptance Criteria

1. THE Plan_Selector SHALL display the following predefined free fasting plans available to all users regardless of Subscription_Status: 12:12 (12 hours fasting, 12 hours eating), 14:10 (14 hours fasting, 10 hours eating), and 16:8 (16 hours fasting, 8 hours eating).
2. WHERE the local Subscription_Status is PRO_MOCK, THE Plan_Selector SHALL additionally display the following Pro fasting plans as selectable and fully functional: 18:6 (18 hours fasting, 6 hours eating), 20:4 (20 hours fasting, 4 hours eating), 21:3 (21 hours fasting, 3 hours eating), 22:2 (22 hours fasting, 2 hours eating), 23:1 (23 hours fasting, 1 hour eating), 24h (24 hours fasting, 0 hours eating — extended fast), 36h (36 hours fasting — extended fast), and 48h (48 hours fasting — extended fast). The 72h plan is Post-MVP. Pro plans are implemented and selectable ONLY when the local Subscription_Status is PRO_MOCK.
3. WHERE the local Subscription_Status is FREE, THE Plan_Selector SHALL display Pro plans with a lock indicator. Pro plans SHALL NOT be selectable by Free users; tapping a locked Pro plan SHALL navigate to the Paywall_Screen.
4. WHERE the local Subscription_Status is PRO_MOCK, THE Plan_Selector SHALL allow the user to create a custom fasting plan by specifying a fasting duration between 1 and 48 hours (MVP maximum). Post-MVP extends the maximum to 72 hours.
5. WHEN a Free_User (Subscription_Status is FREE) taps on a Pro plan, custom plan option, or any Pro-gated feature, THE Plan_Selector SHALL display a lock indicator and navigate to the Paywall_Screen.
6. WHEN the user selects a fasting plan, THE Plan_Selector SHALL store the selected plan as the user's active plan in the user profile.
7. THE Plan_Selector SHALL display each plan with its name, fasting duration, eating window duration, and a brief description of the plan's suitability.
8. WHEN the user changes the active fasting plan while no fast is in progress, THE Plan_Selector SHALL update the active plan immediately and reflect the change on the fasting dashboard.

### Requirement 4: Fasting Timer — Starting a Fast [MVP]

**User Story:** As a user, I want to start a fasting session based on my selected plan, so that I can track my fasting progress in real time.

#### Acceptance Criteria

1. WHEN the user taps the "Start Fast" button on the fasting dashboard, THE Fasting_Timer SHALL create a new Fasting_Session with startTime set to the current system time (UTC ISO 8601) and endTime set to startTime plus the fasting duration of the active Fasting_Plan.
2. WHEN a new Fasting_Session is created, THE FastTrack_App SHALL persist the session to AsyncStorage immediately for offline resilience.
3. WHEN a new Fasting_Session is created and network connectivity is available, THE Sync_Engine SHALL persist the session to the Supabase fasting_sessions table.
4. IF the user attempts to start a new fast while an ACTIVE Fasting_Session already exists, THEN THE Fasting_Timer SHALL prevent the action and display a message indicating that a fast is already in progress.
5. WHEN a Fasting_Session is created, THE Fasting_Timer SHALL set the session status to "ACTIVE".

### Requirement 5: Fasting Timer — Active Timer Display [MVP]

**User Story:** As a user, I want to see my fasting progress in real time with a circular timer, so that I know how much time remains and how far I have progressed.

#### Acceptance Criteria

1. WHILE a Fasting_Session is ACTIVE, THE Fasting_Timer SHALL compute remainingTime as (endTime - current system time) and update the display every second.
2. WHILE a Fasting_Session is ACTIVE, THE Fasting_Timer SHALL compute progress as (current system time - startTime) / (endTime - startTime) and display the value as a percentage on the Circular_Timer.
3. WHILE a Fasting_Session is ACTIVE, THE Circular_Timer SHALL render a circular arc that fills proportionally to the computed progress value.
4. WHILE a Fasting_Session is ACTIVE, THE Fasting_Timer SHALL display the remaining hours, minutes, and seconds in HH:MM:SS format below the Circular_Timer.
5. WHILE a Fasting_Session is ACTIVE, THE Fasting_Timer SHALL display the elapsed hours, minutes, and seconds in HH:MM:SS format.
6. WHILE a Fasting_Session is ACTIVE, THE Fasting_Timer SHALL display the fasting plan name and the start time of the current session.

### Requirement 6: Fasting Timer — Session Persistence and Recovery [MVP]

**User Story:** As a user, I want my fasting session to persist across app restarts, backgrounding, and phone reboots, so that I never lose my fasting progress.

#### Acceptance Criteria

1. WHEN the FastTrack_App launches and an ACTIVE Fasting_Session exists in AsyncStorage, THE Fasting_Timer SHALL restore the session and resume the timer display using the stored startTime and endTime.
2. WHEN the FastTrack_App returns from background and an ACTIVE Fasting_Session exists, THE Fasting_Timer SHALL recalculate remainingTime and progress based on the current system time and the stored endTime.
3. IF the FastTrack_App launches and the stored endTime of an ACTIVE Fasting_Session is in the past (session expired while app was closed), THEN THE Fasting_Timer SHALL mark the session as "COMPLETED", set durationFasted to (endTime - startTime), and display a completion summary.
4. WHEN the Fasting_Timer restores a session from AsyncStorage, THE Fasting_Timer SHALL use the system clock to compute elapsed time rather than relying on any locally stored elapsed counter.
5. IF the system clock is detected to have changed backward (current system time is earlier than the last recorded check time by more than 60 seconds), THEN THE Fasting_Timer SHALL display a warning to the user indicating a potential clock change and continue using the original startTime and endTime for calculations.
6. WHILE a Fasting_Session is ACTIVE, THE Fasting_Timer SHALL store lastTimerCheckUtc and lastKnownElapsedMs locally in AsyncStorage at each timer tick (or at minimum every 10 seconds).
7. IF the system clock is detected to have jumped forward suspiciously (current system time is more than 10 minutes ahead of the expected elapsed timer progression since the last recorded timer check, i.e., (currentTime - lastTimerCheckUtc) - (expectedElapsedSinceLastCheck) > 10 minutes), THEN THE Fasting_Timer SHALL:
   - NOT automatically mark the fast as COMPLETED.
   - Display a warning that the device time appears to have changed.
   - Continue displaying the timer based on the original startTime/endTime.
   - Mark the session locally with a CLOCK_SUSPECT flag.
8. A session marked CLOCK_SUSPECT SHALL NOT become a Qualifying_Fast until the user explicitly confirms the session summary upon completion.
9. CLOCK_SUSPECT is a local-only flag stored in AsyncStorage alongside the session; it is NOT a session status and is NOT synced to Supabase.
10. For MVP, the app SHALL NOT cancel a CLOCK_SUSPECT session automatically. The user must confirm or discard the session before it can count toward streaks.

### Requirement 7: Fasting Timer — Ending a Fast [MVP]

**User Story:** As a user, I want to end my fast manually or have it complete automatically, so that my fasting session is properly recorded.

#### Acceptance Criteria

1. WHEN the remainingTime reaches zero, THE Fasting_Timer SHALL automatically mark the Fasting_Session status as "COMPLETED", set durationFasted to (endTime - startTime) in seconds, and display a completion summary screen.
2. WHEN the user taps the "End Fast" button before the endTime, THE Fasting_Timer SHALL display a confirmation dialog. Upon confirmation, THE Fasting_Timer SHALL mark the Fasting_Session status as "ENDED_EARLY", set actualEndTime to the current system time (UTC ISO 8601), set durationFasted to (actualEndTime - startTime) in seconds, and display a summary showing the duration fasted.
3. WHEN a Fasting_Session status changes to "COMPLETED", "ENDED_EARLY", or "CANCELLED", THE Sync_Engine SHALL persist the updated session to AsyncStorage immediately and to Supabase when network connectivity is available.
4. WHEN a Fasting_Session is COMPLETED, THE Fasting_Timer SHALL display the total fasting duration, the plan name, and a congratulatory message.
5. WHEN a Fasting_Session is ENDED_EARLY, THE Fasting_Timer SHALL display the actual duration fasted and the percentage of the plan completed.

### Requirement 8: Fasting Timer — Offline Behavior [MVP]

**User Story:** As a user, I want the fasting timer to work without an internet connection, so that I can track my fast regardless of network availability.

#### Acceptance Criteria

1. WHILE network connectivity is unavailable, THE Fasting_Timer SHALL continue to operate using locally persisted session data from AsyncStorage and the system clock.
2. WHILE network connectivity is unavailable, THE Sync_Engine SHALL queue all session state changes (creation, completion, early ending, cancellation) for later synchronization.
3. WHEN network connectivity is restored, THE Sync_Engine SHALL synchronize all queued session state changes to Supabase in chronological order.
4. IF a sync conflict occurs (the same session was modified on another device), THEN THE Sync_Engine SHALL resolve the conflict by accepting the record with the most recent modification timestamp. [Post-MVP — multi-device conflict resolution]

### Requirement 9: Daily Health Tracking [MVP]

**User Story:** As a user, I want to log my daily water intake, weight, calories, and steps, so that I can monitor my health alongside my fasting routine.

#### Acceptance Criteria

1. THE Daily_Tracker SHALL provide input fields for the following daily metrics: water intake (in millilitres or glasses, where 1 glass = 250 ml), weight (in kilograms or pounds), calorie intake (in kcal), and step count. Canonical storage units: waterIntake is always stored in millilitres, weight is always stored in kilograms, calories are stored in kcal, and steps are stored as integer count. Water may be entered as glasses but is converted to ml (1 glass = 250 ml) at the UI/service boundary. Weight may be displayed in kg or lb based on unitPreference, but storage remains kg. Conversions must happen at the UI/service boundary, not in storage.
2. WHEN the user enters a value for any daily metric, THE Daily_Tracker SHALL persist the value to the Daily_Stats record for the current calendar day (using localDate in the user's local timezone).
3. WHEN the user updates a daily metric that already has a value for the current day, THE Daily_Tracker SHALL overwrite the previous value with the new value.
4. THE Daily_Tracker SHALL display the current day's tracked metrics on the fasting dashboard or a dedicated tracking section.
5. WHEN the user opens the Daily_Tracker, THE Daily_Tracker SHALL pre-populate fields with any previously entered values for the current calendar day.
6. WHEN a daily metric is saved, THE Sync_Engine SHALL persist the Daily_Stats record to AsyncStorage immediately and to Supabase when network connectivity is available.
7. IF the user enters a value outside a reasonable range (e.g., weight below 20 kg or above 300 kg, calories below 0 or above 10000 kcal), THEN THE Daily_Tracker SHALL display a validation warning and request confirmation before saving.

### Requirement 10: Fasting History [MVP]

**User Story:** As a user, I want to view my past fasting sessions and daily stats, so that I can review my progress over time.

#### Acceptance Criteria

1. THE FastTrack_App SHALL provide a history view displaying all past Fasting_Sessions in reverse chronological order.
2. THE FastTrack_App SHALL display each historical Fasting_Session with the plan name, start time, end time, total duration, and status (COMPLETED, ENDED_EARLY, or CANCELLED).
3. WHEN the user selects a historical Fasting_Session, THE FastTrack_App SHALL display a detail view with the session's full metadata including daily stats recorded on that day.
4. WHERE the user has a Pro subscription, THE FastTrack_App SHALL display detailed analytics including average fasting duration, completion rate, and weekly/monthly trends. [Post-MVP]
5. WHEN the user is a Free_User and taps on detailed analytics, THE FastTrack_App SHALL display a lock indicator and navigate to the Paywall_Screen. [Post-MVP]


### Requirement 11: Streak System — Current Streak Calculation [MVP]

**User Story:** As a user, I want to see my current fasting streak, so that I am motivated to maintain consistency.

#### Acceptance Criteria

1. THE Streak_Engine SHALL define a "streak day" as a calendar day (midnight to midnight in the user's local timezone) on which the user completed at least one Qualifying_Fast (a session with status COMPLETED or ENDED_EARLY where durationFasted >= 90% of the plan's fasting duration). CANCELLED sessions never count.
2. THE Streak_Engine SHALL compute the current streak as the count of consecutive streak days ending on the current calendar day or the previous calendar day. The current streak remains "alive" through the end of the current local calendar day if the user completed a Qualifying_Fast yesterday but has not yet completed one today. The streak resets only after the current local day ends without a Qualifying_Fast. The numeric streak value must not increment until today's Qualifying_Fast is completed.
3. WHEN a Fasting_Session status changes to a terminal status (COMPLETED or ENDED_EARLY) and the session qualifies as a Qualifying_Fast, THE Streak_Engine SHALL recompute the current streak from the full history of qualifying sessions and update the cached Streak record.
4. WHEN the user completes a Qualifying_Fast today after having completed one yesterday, THE Streak_Engine SHALL increment the current streak by one.
5. IF the user has no completed Qualifying_Fast on the previous calendar day and no completed Qualifying_Fast on the current calendar day, THEN THE Streak_Engine SHALL reset the current streak to zero.
6. WHEN the user completes multiple Qualifying_Fasts on the same calendar day, THE Streak_Engine SHALL count that day as a single streak day (no double counting).
7. THE Streak_Engine SHALL persist the current streak value, longest streak value, and last streak date to the Streak record in AsyncStorage and Supabase as cached values for display performance.
8. THE Streak_Engine SHALL recompute streak values from the full history of Qualifying_Fasts on app launch, after sync completion, and after any session status change. The stored Streak record is a cache and must not be treated as the source of truth. For MVP, recomputation may short-circuit when cached session count, latest session updatedAt, and lastStreakDate match local history. If any mismatch is detected, force full recomputation. Correctness is more important than optimization.

### Requirement 12: Streak System — Longest Streak and Missed Days [MVP]

**User Story:** As a user, I want to see my longest streak and understand how missed days affect my streak, so that I can set goals and recover from breaks.

#### Acceptance Criteria

1. THE Streak_Engine SHALL maintain a longest streak value that records the highest current streak value ever achieved by the user.
2. WHEN the current streak exceeds the longest streak, THE Streak_Engine SHALL update the longest streak to equal the current streak.
3. WHEN the Streak_Engine detects a missed day (no Qualifying_Fast completed on a calendar day that breaks the consecutive sequence), THE Streak_Engine SHALL reset the current streak to zero and preserve the longest streak value.
4. THE Streak_Engine SHALL evaluate streak continuity based on calendar days in the user's local timezone, accounting for timezone changes during travel.
5. WHEN the user opens the FastTrack_App after being away for multiple days, THE Streak_Engine SHALL recompute the streak status from the full history of qualifying sessions rather than relying on the cached streak values.

### Requirement 13: Streak System — Calendar Display and Achievements [MVP / Post-MVP]

**User Story:** As a user, I want to see a calendar view of my fasting activity and earn achievements, so that I can visualize my consistency and feel rewarded.

#### Acceptance Criteria

1. THE FastTrack_App SHALL display a calendar view on the Streaks and Achievements screen, marking each calendar day with a visual indicator showing whether a Qualifying_Fast was completed (green), a fast was started but not completed or ended early (yellow), or no fast was attempted (unmarked). [MVP]
2. THE FastTrack_App SHALL display the current streak count and longest streak count prominently on the Streaks and Achievements screen. [MVP]
3. WHERE the user has a Pro subscription, THE FastTrack_App SHALL display streak insights including streak trends, average fasts per week, and best performing days of the week. [Post-MVP]
4. WHERE the user has a Pro subscription, THE FastTrack_App SHALL award achievement badges for milestones (e.g., 7-day streak, 30-day streak, 100-day streak, first fast completed, 10 fasts completed, 50 fasts completed). [Post-MVP]
5. WHEN a Free_User views the Streaks and Achievements screen, THE FastTrack_App SHALL display the calendar view and basic streak counts, and SHALL show locked indicators on Pro-only streak insights and badges. [Post-MVP]

### Requirement 14: Notification Scheduling — Fasting Milestones [MVP]

**User Story:** As a user, I want to receive notifications at key fasting milestones, so that I stay informed about my progress without opening the app.

#### Acceptance Criteria

1. WHEN a Fasting_Session is started, THE Notification_Scheduler SHALL schedule the following local notifications based on the session's startTime and endTime: "Fast Started" (immediately), "Halfway Reached" (at 50% of fasting duration), "12 Hours Reached" (at 12 hours elapsed, if the plan duration is 12 hours or longer; message: "You've reached 12 hours of fasting. Body responses vary from person to person."), "Almost Complete" (at 90% of fasting duration), and "Fast Completed" (at endTime). Notifications must avoid strong physiological or medical claims.
2. WHEN a Fasting_Session is ended early or cancelled, THE Notification_Scheduler SHALL cancel all pending scheduled notifications for that session.
3. WHEN the user changes the active Fasting_Plan while a session is in progress, THE Notification_Scheduler SHALL cancel existing milestone notifications and reschedule new notifications based on the updated endTime.
4. IF the computed notification time for a milestone has already passed (e.g., the app was opened after the halfway point), THEN THE Notification_Scheduler SHALL skip scheduling that notification.
5. THE Notification_Scheduler SHALL use Expo Notifications to schedule all local notifications and SHALL persist scheduled notification identifiers in AsyncStorage for cancellation purposes.
6. WHEN the FastTrack_App launches and an ACTIVE Fasting_Session exists, THE Notification_Scheduler SHALL re-evaluate all fasting milestone notifications and reschedule any pending notifications that should still occur. THE Notification_Scheduler SHALL NOT duplicate existing scheduled notifications, SHALL skip milestone notifications whose trigger time has already passed, and SHALL always ensure the completion notification is scheduled if the session has not yet ended.

### Requirement 15: Notification Scheduling — Reminders [MVP]

**User Story:** As a user, I want to receive daily reminders for water intake and weigh-in, so that I maintain healthy habits alongside fasting.

#### Acceptance Criteria

1. WHEN the user enables water reminders in Notification_Preference, THE Notification_Scheduler SHALL schedule recurring local notifications at user-configured intervals (default: every 2 hours during waking hours 8:00 AM to 10:00 PM).
2. WHEN the user enables daily weigh-in reminders in Notification_Preference, THE Notification_Scheduler SHALL schedule a daily local notification at the user-configured time (default: 8:00 AM).
3. WHEN the user disables a reminder type in Notification_Preference, THE Notification_Scheduler SHALL cancel all pending notifications of that type.
4. WHEN the user changes the reminder time or interval in Notification_Preference, THE Notification_Scheduler SHALL cancel existing notifications of that type and reschedule with the updated configuration.

### Requirement 16: Notification Permissions [MVP]

**User Story:** As a user, I want to control which notifications I receive and grant notification permissions, so that I am not overwhelmed by unwanted alerts.

#### Acceptance Criteria

1. WHEN the FastTrack_App requires notification permissions and the user has not yet granted them, THE FastTrack_App SHALL display a pre-permission screen explaining the benefits of notifications before triggering the system permission dialog.
2. IF the user denies notification permissions at the system level, THEN THE FastTrack_App SHALL disable all notification-related toggles in the Notification settings screen and display a message explaining how to enable permissions in device settings.
3. THE FastTrack_App SHALL provide a Notification settings screen where the user can independently enable or disable each notification type: fasting milestones, water reminders, and weigh-in reminders.
4. WHEN the user modifies any notification preference, THE Notification_Scheduler SHALL persist the updated Notification_Preference to AsyncStorage and Supabase.

### Requirement 17: Learn Section [MVP / Post-MVP]

**User Story:** As a user, I want to access educational articles about intermittent fasting, so that I can make informed decisions about my fasting practice.

#### Acceptance Criteria

1. THE Learn_Section SHALL display a list of educational articles organized by category (e.g., "Getting Started", "Science of Fasting", "Tips and Tricks", "Health Benefits"). For MVP, content SHALL be bundled as static local JSON/assets in the app. [MVP]
2. WHEN the user taps on an article, THE Learn_Section SHALL display the full article content in a readable format within the app. [MVP]
3. WHEN the user taps on a video item, THE Learn_Section SHALL play the video using an embedded video player within the app. [Post-MVP]
4. THE Learn_Section SHALL indicate the content type (article or video), estimated reading/viewing time, and category for each item in the list. For MVP, only articles are displayed. [MVP]
5. Since MVP content is bundled locally, offline unavailability messages are not required for MVP. For Post-MVP remotely loaded content, THE Learn_Section SHALL display a message indicating that content is unavailable offline when network connectivity is unavailable and the content has not been previously cached. [Post-MVP]

### Requirement 18: Recipe Section [MVP / Post-MVP]

**User Story:** As a user, I want to browse healthy recipes suited for an intermittent fasting lifestyle, so that I can plan nutritious meals for my eating windows.

#### Acceptance Criteria

1. THE Recipe_Section SHALL display a list of recipes organized by category (e.g., "Breakfast", "Lunch", "Dinner", "Snacks", "Smoothies"). For MVP, content SHALL be bundled as static local JSON/assets in the app. [MVP]
2. WHEN the user taps on a recipe, THE Recipe_Section SHALL display the full recipe including title, description, ingredients list, preparation steps, nutritional information (calories, protein, carbs, fat), and preparation time. [MVP]
3. THE Recipe_Section SHALL provide a search function allowing the user to filter recipes by name or ingredient. [Post-MVP]
4. THE Recipe_Section SHALL display a thumbnail image and brief description for each recipe in the list view. [MVP]
5. Since MVP content is bundled locally, offline unavailability messages are not required for MVP. For Post-MVP remotely loaded content, THE Recipe_Section SHALL display a message indicating that content is unavailable offline when network connectivity is unavailable and the content has not been previously cached. [Post-MVP]

### Requirement 19: Profile Management [MVP]

**User Story:** As a user, I want to manage my profile and app settings, so that I can personalize my experience.

#### Acceptance Criteria

1. THE Profile_Manager SHALL display the user's profile information including display name, email, selected fasting plan, and subscription status.
2. WHEN the user updates the display name, THE Profile_Manager SHALL persist the change to the Supabase profiles table and AsyncStorage.
3. THE Profile_Manager SHALL provide access to the following settings: theme preference (light/dark mode), unit preferences (metric/imperial for weight), notification settings, and account management (logout, delete account).
4. WHEN the user selects a theme preference, THE Theme_Manager SHALL apply the selected theme (light or dark mode with dark green premium accents) immediately across all screens.
5. THE FastTrack_App SHALL default to the device's system theme preference on first launch.
6. WHEN the user requests account deletion, THE Profile_Manager SHALL display a confirmation dialog explaining that all data will be permanently deleted, and upon confirmation, SHALL delete the user's data from Supabase and local storage, then navigate to the login screen.

### Requirement 20: Subscription System — Purchase Flow [Post-MVP]

**User Story:** As a user, I want to subscribe to Pro to unlock advanced features, so that I can get the most out of my fasting experience.

#### Acceptance Criteria

1. THE Paywall_Screen SHALL display the following subscription options: Monthly at R39.99 per month and Yearly at R199.99 per year (approximately R16.67/month, saving about 58% compared to monthly). The Paywall may show "Save 58%" or "Best value" on the yearly option. [Post-MVP]
2. THE Paywall_Screen SHALL display a 7-day free trial offer for new subscribers who have not previously used a trial. [Post-MVP]
3. THE Paywall_Screen SHALL display a clear comparison of Free vs Pro features, highlighting what the user will unlock. [MVP — UI only]
4. WHEN the user selects a subscription option and confirms the purchase, THE Subscription_Manager SHALL initiate the purchase flow via RevenueCat or Google Play Billing. [Post-MVP]
5. WHEN the purchase is confirmed by the payment provider, THE Subscription_Manager SHALL update the Subscription_Status record to "pro" with the appropriate expiry date and persist the status to Supabase and AsyncStorage. [Post-MVP]
6. IF the purchase fails or is cancelled by the user, THEN THE Subscription_Manager SHALL display an appropriate message and return the user to the Paywall_Screen without changing the subscription status. [Post-MVP]
7. WHEN the purchase includes a 7-day free trial, THE Subscription_Manager SHALL set the trial start date and trial end date in the Subscription_Status record. [Post-MVP]

### Requirement 21: Subscription System — Feature Gating [MVP]

**User Story:** As a user, I want to understand which features require Pro, so that I can make an informed decision about subscribing.

#### Acceptance Criteria

1. THE Subscription_Manager SHALL gate the following features as Pro-only: Pro fasting plans (18:6, 20:4, 21:3, 22:2, 23:1, 24h, 36h, 48h), custom fasting plans, extended fasts (24h and longer), detailed analytics, streak insights and badges.
2. WHEN a Free_User attempts to access a Pro-only feature, THE FastTrack_App SHALL display a lock indicator on the feature and navigate to the Paywall_Screen.
3. WHEN the Subscription_Status changes from "pro" (or "pro_mock") to "free", THE Subscription_Manager SHALL revoke access to Pro-only features and revert the user's active plan to a basic plan if the current plan is Pro-only.
4. For MVP, THE Subscription_Manager SHALL determine feature access exclusively using the locally stored Subscription_Status mock state (FREE or PRO_MOCK). Pro plans and all Pro-gated features SHALL be implemented and selectable ONLY when the local Subscription_Status is PRO_MOCK. WHEN the Subscription_Status is FREE, all Pro plans and Pro-gated features SHALL be displayed with a lock indicator and SHALL NOT be selectable; tapping any locked feature SHALL navigate to the Paywall_Screen. A developer/tester setting SHALL be available to toggle between FREE and PRO_MOCK during development and testing.
5. WHILE network connectivity is unavailable, THE Subscription_Manager SHALL use the locally cached Subscription_Status from AsyncStorage to determine feature access.
6. IF the locally cached Subscription_Status indicates Pro but the cached expiry date has passed, THEN THE Subscription_Manager SHALL treat the user as a Free_User until the status can be verified online. [Post-MVP — only applies when real billing is integrated]

### Requirement 22: Subscription System — Trial and Renewal [Post-MVP]

**User Story:** As a user, I want my subscription to renew automatically and my trial to convert seamlessly, so that I have uninterrupted access to Pro features.

#### Acceptance Criteria

1. WHEN the 7-day free trial expires and the user has not cancelled, THE Subscription_Manager SHALL allow the payment provider to charge the selected subscription price and update the Subscription_Status accordingly.
2. WHEN a subscription renewal is processed by the payment provider, THE Subscription_Manager SHALL update the expiry date in the Subscription_Status record.
3. WHEN the user cancels the subscription, THE Subscription_Manager SHALL maintain Pro access until the current billing period or trial period ends, then revert to Free_User status.
4. THE Subscription_Manager SHALL provide a way for the user to view the current subscription status, next billing date, and manage the subscription (which opens the device's subscription management screen).


### Requirement 23: Data Synchronization [MVP]

**User Story:** As a user, I want my data to sync between my local device and the cloud, so that my fasting history and stats are backed up and available if I switch devices.

#### Acceptance Criteria

1. THE Sync_Engine SHALL synchronize the following data types between AsyncStorage and Supabase: Fasting_Sessions, Daily_Stats, Streaks (cached values), Notification_Preferences, and user profile data.
2. WHEN the FastTrack_App launches with network connectivity, THE Sync_Engine SHALL pull the latest data from Supabase and merge it with local data.
3. WHEN a data record is created or updated locally, THE Sync_Engine SHALL add the change to a sync queue and attempt to push the change to Supabase.
4. IF a sync operation fails due to network error, THEN THE Sync_Engine SHALL retain the change in the sync queue and retry on the next sync attempt.
5. THE Sync_Engine SHALL use a last-modified timestamp (updatedAt) on each record to resolve conflicts, with the most recently modified record taking precedence, subject to the session-specific conflict rules in AC7.
6. THE Sync_Engine SHALL perform sync operations in the background without blocking the user interface.
7. FOR Fasting_Session sync conflicts: a Terminal_Status (COMPLETED, ENDED_EARLY, CANCELLED) SHALL NOT be overwritten by ACTIVE. If local and remote records conflict, the record with a terminal status SHALL take precedence over a record with ACTIVE status. If both records have terminal statuses, the record with the most recent updatedAt timestamp SHALL take precedence. If both records are ACTIVE, the record with the most recent updatedAt SHALL take precedence, but startTime must not change unless the session was created locally and has no remote equivalent. If ACTIVE records differ in endTime due to a plan change, the record with the most recent updatedAt wins.
8. WHEN sync completes, THE Streak_Engine SHALL recompute streak values from the full history of qualifying sessions to ensure cached streak values reflect the latest synced data.

### Requirement 24: Navigation and Screen Structure [MVP]

**User Story:** As a user, I want intuitive bottom tab navigation, so that I can quickly access the main sections of the app.

#### Acceptance Criteria

1. THE Navigation_Bar SHALL provide bottom tab navigation with the following tabs: Home (fasting dashboard), Learn, Recipes, and Profile.
2. WHEN the user taps a tab in the Navigation_Bar, THE FastTrack_App SHALL navigate to the corresponding screen immediately.
3. THE Navigation_Bar SHALL visually indicate the currently active tab using the dark green premium accent color.
4. THE FastTrack_App SHALL provide the following screens accessible via navigation: Fasting Dashboard (Home), Plan Selection, Learn, Recipes, Profile, Paywall, Notification Settings, Streaks and Achievements, Settings, Login, and Register.
5. THE FastTrack_App SHALL maintain scroll position and state when switching between tabs via the Navigation_Bar.

### Requirement 25: Theme and Visual Design [MVP]

**User Story:** As a user, I want a soft, health-focused UI with light and dark mode support, so that the app feels pleasant and is comfortable to use at any time of day.

#### Acceptance Criteria

1. THE Theme_Manager SHALL support two themes: light mode and dark mode.
2. THE Theme_Manager SHALL apply a dark green premium accent color consistently across both themes for primary actions, active states, and highlights.
3. THE FastTrack_App SHALL use pastel-colored cards for content sections (daily stats, plan cards, recipe cards) in both themes.
4. THE Circular_Timer SHALL use the dark green accent color for the progress arc and a muted background track color appropriate to the active theme.
5. WHEN the user toggles the theme preference, THE Theme_Manager SHALL apply the new theme to all screens without requiring an app restart.

### Requirement 26: Supabase Data Model [MVP]

**User Story:** As a developer, I want a well-defined data model in Supabase, so that all application data is stored consistently and can be queried efficiently.

#### Acceptance Criteria

1. THE FastTrack_App SHALL use the following Supabase Postgres tables: profiles (userId, displayName, email, selectedPlanId, unitPreference, themePreference, onboardingCompleted, createdAt, updatedAt), fasting_plans (planId, name, fastingHours, eatingHours, description, isPro, isCustom, createdByUserId, createdAt), fasting_sessions (sessionId, userId, planId, startTime, endTime, actualEndTime, status, durationFasted, timezoneOffsetMinutes, createdAt, updatedAt), daily_stats (statsId, userId, localDate, waterIntake, weight, calories, steps, timezoneOffsetMinutes, createdAt, updatedAt), streaks (streakId, userId, currentStreak, longestStreak, lastStreakDate, sessionCountSnapshot, createdAt, updatedAt), notification_preferences (prefId, userId, fastingMilestones, waterReminders, waterReminderInterval, weighInReminder, weighInReminderTime, createdAt, updatedAt), and subscription_status (subId, userId, tier, expiryDate, trialStartDate, trialEndDate, provider, createdAt, updatedAt). Note: The achievements table is Post-MVP and will be introduced via a future migration when achievement badges are implemented.
2. THE FastTrack_App SHALL enforce Row Level Security (RLS) on all Supabase tables so that each user can only read and write their own data.
3. THE FastTrack_App SHALL use the Supabase userId (from Supabase Auth) as the foreign key linking all user-specific tables.
4. All timestamp fields (startTime, endTime, actualEndTime, createdAt, updatedAt, earnedAt) SHALL be stored as UTC ISO 8601 strings (TIMESTAMPTZ in Postgres).
5. The daily_stats table SHALL use a localDate field (DATE type, "YYYY-MM-DD" in the user's local timezone) as the primary date key for daily records, with a UNIQUE constraint on (userId, localDate).
6. The fasting_sessions and daily_stats tables SHALL include a timezoneOffsetMinutes field (INTEGER) recording the user's timezone offset at the time of record creation, for audit and debugging purposes.

### Requirement 27: Local Data Persistence [MVP]

**User Story:** As a user, I want my active fasting session and critical data to be available instantly on app launch, so that I do not experience delays or data loss.

#### Acceptance Criteria

1. THE FastTrack_App SHALL persist the following data in AsyncStorage for offline access: active Fasting_Session, current Daily_Stats, current Streak values (cached), Notification_Preferences, Subscription_Status, user profile, and sync queue.
2. WHEN the FastTrack_App launches, THE FastTrack_App SHALL load data from AsyncStorage first and display it immediately, then update from Supabase in the background when connectivity is available.
3. THE FastTrack_App SHALL use structured JSON keys in AsyncStorage with a consistent naming convention (e.g., "@fasttrack:activeSession", "@fasttrack:dailyStats", "@fasttrack:streak").

### Requirement 28: Performance on Mid-Range Android Devices [MVP]

**User Story:** As a user on a mid-range Android device, I want the app to perform smoothly, so that my experience is not degraded by slow loading or janky animations.

#### Acceptance Criteria

1. THE FastTrack_App SHALL render the fasting dashboard within 2 seconds of app launch on a mid-range Android device (e.g., devices with 3-4 GB RAM and a mid-tier processor). QA reference devices: Samsung Galaxy A14 or equivalent, Redmi Note 12 or equivalent (3–4 GB RAM class).
2. THE Fasting_Timer SHALL update the Circular_Timer display at a consistent frame rate without visible jank or dropped frames during the 1-second update interval. Timer updates must occur once per second without visible UI jank on reference devices.
3. THE FastTrack_App SHALL lazy-load content in the Learn_Section and Recipe_Section to avoid blocking the initial screen render.
4. THE Sync_Engine SHALL perform background sync operations without causing perceptible UI lag.

### Requirement 29: Accessibility [MVP]

**User Story:** As a user with accessibility needs, I want the app to be usable with assistive technologies, so that I can track my fasting regardless of ability.

#### Acceptance Criteria

1. THE FastTrack_App SHALL provide accessible labels (accessibilityLabel) for all interactive elements including buttons, inputs, tabs, and the Circular_Timer.
2. THE FastTrack_App SHALL support dynamic text sizing based on the device's accessibility font size settings.
3. THE FastTrack_App SHALL ensure a minimum color contrast ratio of 4.5:1 for all normal text content against its background in both light and dark themes. Large text (as defined by WCAG) may use the AA large-text threshold of 3:1 where applicable.
4. THE Circular_Timer SHALL provide a text-based alternative (e.g., "50% complete, 8 hours remaining") accessible to screen readers.
5. THE FastTrack_App SHALL ensure all screens are navigable using TalkBack (Android) screen reader in a logical reading order.
6. Interactive controls and meaningful icons SHALL remain clearly distinguishable in both light and dark mode.

### Requirement 30: Play Store Readiness [Post-MVP]

**User Story:** As a product owner, I want the app to meet Google Play Store requirements, so that the app can be published and distributed to users.

#### Acceptance Criteria

1. THE FastTrack_App SHALL comply with Google Play Store content policies including privacy policy, data safety disclosures, and subscription billing transparency.
2. THE FastTrack_App SHALL provide a privacy policy URL accessible from the Profile screen and the Play Store listing.
3. THE FastTrack_App SHALL implement Google Play Billing Library requirements for subscription management, including providing access to subscription management from within the app.
4. THE FastTrack_App SHALL handle the Play Store review process requirements for health-related apps, including appropriate disclaimers that the app does not provide medical advice.

### Requirement 31: Data Integrity Across Sync [Post-MVP]

**User Story:** As a user, I want my data to remain consistent and accurate across local storage and cloud sync, so that I can trust the information displayed in the app.

#### Acceptance Criteria

1. THE Sync_Engine SHALL use optimistic concurrency control with last-modified timestamps to prevent data loss during concurrent modifications.
2. THE Sync_Engine SHALL validate data integrity after each sync operation by comparing record counts and checksums for critical data (Fasting_Sessions, Streaks).
3. IF a data integrity violation is detected during sync, THEN THE Sync_Engine SHALL log the violation, preserve both local and remote versions, and flag the conflict for resolution on the next sync attempt.
4. THE Sync_Engine SHALL use database transactions when writing multiple related records (e.g., completing a session and updating the streak) to ensure atomicity.

### Requirement 32: Guest Mode [MVP]

**User Story:** As a new user, I want to try the app without creating an account, so that I can evaluate the app before committing to registration.

#### Acceptance Criteria

1. WHEN a user selects "Continue as Guest" on the login screen, THE Auth_Manager SHALL create a local-only anonymous session without requiring email or password.
2. WHILE in guest mode, THE FastTrack_App SHALL allow the user to access all Free_User features with data stored only in AsyncStorage (no Supabase sync). Guest mode is fully unrestricted for free features with no session limit.
3. WHEN a guest user decides to create an account, THE Auth_Manager SHALL prompt for email and password. If the email is new (not already registered), THE Auth_Manager SHALL create a Supabase account and THE Sync_Engine SHALL migrate all locally stored guest data to the new authenticated user. Local guest data SHALL be treated as the source of truth. Since the Supabase account is newly created, no remote merge conflict resolution is required in MVP. After successful migration, guest-mode local AsyncStorage keys SHALL be converted or copied to authenticated-user keys. If the email already exists in Supabase Auth, THE Auth_Manager SHALL NOT overwrite or silently merge data. Instead, THE FastTrack_App SHALL display a clear message: "An account already exists for this email. Please log in to continue." For MVP, automatic guest-data merge into an existing account is blocked. Post-MVP may add a manual merge flow.
4. IF guest-to-account data migration fails, THE FastTrack_App SHALL preserve the local guest data, inform the user that migration could not be completed, and allow retry on next app launch or manual trigger. The user SHALL NOT lose data due to a migration failure.
5. IF a guest user uninstalls the app without creating an account, THEN all guest data stored in AsyncStorage SHALL be lost, and THE FastTrack_App SHALL display a persistent warning about data loss when the user is in guest mode.

### Requirement 33: Extended Fast Safety Disclaimers [MVP]

**User Story:** As a user considering an extended fast, I want to see clear health disclaimers, so that I understand the risks and make informed decisions.

#### Acceptance Criteria

1. WHEN a user selects a fasting plan with a duration of 24 hours or longer, THE Plan_Selector SHALL display a health disclaimer stating: "Extended fasts carry health risks. This app does not provide medical advice. Consult a healthcare professional before attempting fasts longer than 24 hours."
2. THE FastTrack_App SHALL display a general health disclaimer on the Plan Selection screen stating: "FastTrack is a fasting tracker, not a medical tool. Always consult your doctor before starting any fasting regimen."
3. WHEN a user creates a custom fasting plan with a duration exceeding 24 hours, THE Plan_Selector SHALL require the user to acknowledge the health disclaimer before the plan can be saved.
4. THE FastTrack_App SHALL include a health disclaimer in the app's About section and Play Store listing.

### Requirement 34: Timestamp and Timezone Rules [MVP]

**User Story:** As a developer, I want clear and consistent rules for how timestamps and timezones are handled, so that time-dependent features (timer, streaks, daily stats) behave correctly across timezones and devices.

#### Acceptance Criteria

1. ALL stored timestamps SHALL be UTC ISO 8601 strings. This applies to: startTime, endTime, actualEndTime, createdAt, updatedAt, and earnedAt across all data models.
2. Daily_Stats records SHALL use a localDate field in "YYYY-MM-DD" format representing the calendar day in the user's local timezone at the time of data entry. This localDate is the primary key for daily records (combined with userId).
3. FOR MVP, streak and daily boundary calculations SHALL use the device's current local timezone at the time of calculation to determine calendar day boundaries (midnight to midnight). A "streak day" is defined by the user's current local device time, not UTC. The Streak_Engine SHALL NOT use historical timezoneOffsetMinutes values when recomputing streaks.
4. THE Fasting_Timer SHALL store startTime and endTime as UTC ISO 8601 strings and SHALL convert to local time only for display purposes.
5. THE fasting_sessions and daily_stats records SHALL include a timezoneOffsetMinutes field (integer) recording the user's timezone offset from UTC at the time of record creation. This field is stored for audit and debugging purposes only and SHALL NOT be used for any MVP calculations (streak evaluation, daily boundary determination, timer logic, or streak recomputation).
6. WHEN the user's device timezone changes (e.g., during travel), streak and daily stats calculations SHALL use the device's current local timezone at the time of calculation for determining "today" and calendar day boundaries (midnight to midnight). Historical records retain their original timezoneOffsetMinutes for audit purposes only.
7. Historical timezone recalculation — re-evaluating past streak days using their original timezoneOffsetMinutes for streak recomputation — is a Post-MVP feature. For MVP, all streak recomputation uses the device's current local timezone uniformly across all historical sessions.

### Requirement 35: Error Handling [MVP]

**User Story:** As a user, I want the app to handle errors gracefully, so that I can continue tracking my fasts even when things go wrong.

#### Acceptance Criteria

**Sync Errors:**
1. IF the Sync_Engine fails to persist data remotely, THE FastTrack_App SHALL keep the data locally in AsyncStorage and add the change to the sync queue for later retry.
2. IF sync retry fails repeatedly (after maximum retry attempts), THE FastTrack_App SHALL show a non-blocking warning such as "Some changes have not synced yet" without interrupting the user's current activity.
3. Sync failure SHALL NEVER stop or interfere with the fasting timer. The timer operates independently of sync status.

**Notification Errors:**
4. IF the Notification_Scheduler fails to schedule a notification (e.g., scheduling error, system limitation), THE FastTrack_App SHALL log the error and show a non-blocking message indicating that notifications may not be delivered.
5. Timer and session tracking SHALL continue normally even if notification scheduling fails completely. Notification failures SHALL NOT affect fasting session state.

**Storage Errors:**
6. IF AsyncStorage write fails for an active fasting session, THE FastTrack_App SHALL show a blocking error alert because the session cannot be safely persisted. The user SHALL be informed that their session may not survive an app restart.
7. IF AsyncStorage read fails on app launch, THE FastTrack_App SHALL attempt to recover data from Supabase for authenticated users. If recovery succeeds, the app SHALL proceed normally. If recovery fails or the user is a guest, THE FastTrack_App SHALL display a recovery/error state explaining that local data could not be loaded.

**Auth Errors:**
8. IF network connectivity is unavailable when the user attempts to log in or register, THE Auth_Manager SHALL display a message indicating that an internet connection is required for authentication.
9. IF the Supabase Auth service returns an unexpected error (5xx, timeout), THE Auth_Manager SHALL display a generic error message ("Something went wrong. Please try again.") and allow the user to retry.

**RLS/Auth Sync Errors:**
10. IF Supabase rejects a write due to auth/RLS/JWT expiry, THE Sync_Engine SHALL attempt token refresh once.
11. IF token refresh succeeds after an RLS/auth rejection, THE Sync_Engine SHALL retry the failed write once.
12. IF the retry after token refresh fails, THE Sync_Engine SHALL keep the change in the sync queue and show a non-blocking sync warning to the user.
13. Auth/RLS sync failures SHALL NEVER interrupt an active fasting timer. The timer operates independently of sync auth status.

### Testing Note: PRO_MOCK QA Requirements [MVP]

Because MVP uses PRO_MOCK instead of real billing, QA must run full regression tests in both FREE and PRO_MOCK states. All Pro-gated plans and screens must be tested with PRO_MOCK enabled before release. This ensures feature gating logic works correctly in both subscription states.


## Open Questions

1. **Guest Mode Scope**: ~~Should guest mode support a limited number of fasting sessions before prompting registration, or should it be fully unrestricted for free features?~~ **Resolved:** Guest mode is fully unrestricted for free features in MVP. No session limit.
2. **Content Management**: ~~Should Learn and Recipe content be stored in Supabase and fetched dynamically, or bundled with the app and updated via app releases?~~ **Resolved:** For MVP, content is bundled as static local JSON/assets in the app. Dynamic content management via Supabase CMS is Post-MVP.
3. **Timezone Handling**: ~~When a user travels across timezones, should streak calculations use the timezone at the time of fast completion or the user's current device timezone?~~ **Resolved for MVP:** The device's current local timezone at the time of calculation is used for ALL streak and daily boundary calculations, including streak recomputation from history. The historical timezoneOffsetMinutes field is stored for audit/debugging purposes only and does NOT affect any MVP calculations — it is not used for streak recalculation, daily boundary determination, or timer logic. **Post-MVP consideration:** Historical timezone recalculation (re-evaluating past streak days using their original timezoneOffsetMinutes for streak recomputation) will be added in a future release for users who travel frequently across timezones.
4. **Extended Fasts**: ~~What is the maximum allowed fasting duration for custom plans? Should there be a safety warning for fasts exceeding 24 hours?~~ **Resolved:** Maximum custom plan duration is 48 hours for MVP. 72h plan is Post-MVP. Safety warnings are required for fasts of 24 hours or longer (see Requirement 33).
5. **Achievement Definitions**: What is the complete list of achievement badges and their unlock criteria beyond the streak milestones mentioned? (Post-MVP feature)
6. **Offline Content Caching**: ~~Should Learn and Recipe content be cached for offline access after first view, and if so, what is the maximum cache size?~~ **Resolved for MVP:** Content is bundled locally, so offline caching is not needed for MVP. Post-MVP will need a caching strategy for remotely loaded content.
7. **Multi-Device Support**: Should the app support concurrent usage on multiple devices, and if so, how should active session conflicts be resolved? (Post-MVP consideration)
8. **Data Retention**: How long should completed fasting session data be retained in Supabase? Indefinitely or with a retention policy?
9. **Localization**: Should the app support multiple languages beyond English, and if so, which languages are prioritized? (Future/V2)
10. **Health Disclaimer**: ~~What specific health disclaimers and warnings are required for the Play Store listing and in-app display?~~ **Resolved:** General disclaimer on Plan Selection screen and About section. Extended fast disclaimer for plans of 24 hours or longer (see Requirement 33).