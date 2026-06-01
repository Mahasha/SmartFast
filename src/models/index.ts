/**
 * FastTrack Data Models
 *
 * All TypeScript interfaces and types for the FastTrack application.
 * These models define the shape of data used across the domain, data, and presentation layers.
 */

// ─── Session Status ──────────────────────────────────────────────────────────

export type SessionStatus = 'ACTIVE' | 'COMPLETED' | 'ENDED_EARLY' | 'CANCELLED';

export const TERMINAL_STATUSES: SessionStatus[] = ['COMPLETED', 'ENDED_EARLY', 'CANCELLED'];

// ─── Fasting Session ─────────────────────────────────────────────────────────

export interface FastingSession {
  sessionId: string;                // UUID
  userId: string;                   // Supabase Auth userId or "guest"
  planId: string;
  startTime: string;                // UTC ISO 8601
  endTime: string;                  // UTC ISO 8601 (planned goal — fasting may continue past this)
  actualEndTime: string | null;     // UTC ISO 8601 (set when the fast is ended/cancelled)
  status: SessionStatus;
  durationFasted: number | null;    // seconds actually fasted (start → actualEndTime); the analytics source of truth
  goalReachedAt?: string | null;    // UTC ISO 8601 — set to endTime when carried to/past goal; absent on legacy/pre-overtime sessions
  completedAt?: string | null;      // UTC ISO 8601 — when the user explicitly ended the fast; absent on legacy sessions
  timezoneOffsetMinutes: number;    // audit only, not used in MVP calculations
  createdAt: string;                // UTC ISO 8601
  updatedAt: string;                // UTC ISO 8601
}

// ─── Fasting Plan ────────────────────────────────────────────────────────────

export interface FastingPlan {
  planId: string;
  name: string;                     // e.g., "16:8"
  fastingHours: number;
  eatingHours: number;
  description: string;
  isPro: boolean;
  isCustom: boolean;
  createdByUserId: string | null;
  createdAt: string;
}

// ─── Daily Stats ─────────────────────────────────────────────────────────────

export interface DailyStats {
  statsId: string;
  userId: string;
  localDate: string;                // "YYYY-MM-DD" in user's local timezone
  waterIntake: number | null;       // always stored in millilitres
  weight: number | null;            // always stored in kilograms
  calories: number | null;          // always stored in kcal
  steps: number | null;             // integer count
  timezoneOffsetMinutes: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Streak Record ───────────────────────────────────────────────────────────

export interface StreakRecord {
  streakId: string;
  userId: string;
  currentStreak: number;            // cached — recomputed from history
  longestStreak: number;            // cached — recomputed from history
  lastStreakDate: string | null;    // "YYYY-MM-DD"
  sessionCountSnapshot: number;     // count of sessions at last full recompute
  createdAt: string;
  updatedAt: string;
}

// ─── Subscription ────────────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'pro' | 'pro_mock';

/** Billing cadence for a paid subscription. null for free tier. */
export type BillingPeriod = 'monthly' | 'annual' | null;

export interface SubscriptionStatus {
  subId: string;
  userId: string;
  tier: SubscriptionTier;
  billingPeriod: BillingPeriod;
  expiryDate: string | null;
  trialStartDate: string | null;
  trialEndDate: string | null;
  provider: 'local' | 'revenuecat' | 'google_play';
  createdAt: string;
  updatedAt: string;
}

// ─── User Profile ────────────────────────────────────────────────────────────

export interface UserProfile {
  userId: string;
  displayName: string;
  email: string;
  selectedPlanId: string;
  unitPreference: 'metric' | 'imperial';
  themePreference: 'light' | 'dark' | 'system';
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Notification Preference ─────────────────────────────────────────────────

export interface NotificationPreference {
  prefId: string;
  userId: string;
  fastingMilestones: boolean;
  waterReminders: boolean;
  waterReminderInterval: number;    // minutes, default 120
  weighInReminder: boolean;
  weighInReminderTime: string;      // "HH:MM" local time
  createdAt: string;
  updatedAt: string;
}

// ─── Sync Queue ──────────────────────────────────────────────────────────────

export type SyncableRecord =
  | FastingSession
  | DailyStats
  | StreakRecord
  | NotificationPreference
  | UserProfile;

export interface SyncQueueEntry {
  id: string;
  recordType: 'fasting_session' | 'daily_stats' | 'streak' | 'notification_preference' | 'profile';
  recordId: string;
  operation: 'CREATE' | 'UPDATE';
  payload: SyncableRecord;
  createdAt: string;                // UTC ISO 8601
  retryCount: number;
}

// ─── Timer / Fasting Progress ────────────────────────────────────────────────

/**
 * Lifecycle phase of a fasting session's timer:
 * - COUNTDOWN:    before the planned goal (remaining time > 0)
 * - GOAL_REACHED: the instant the goal is hit (brief celebration window)
 * - OVERTIME:     fasting continued past the goal; counting up
 * - COMPLETED:    a terminal session (not a live, ticking state)
 */
export type FastingPhase = 'COUNTDOWN' | 'GOAL_REACHED' | 'OVERTIME' | 'COMPLETED';

/**
 * Derived timer state for a fasting session. Computed purely from
 * startTime/endTime and the current clock — never persisted per tick.
 */
export interface FastingProgress {
  phase: FastingPhase;
  isGoalReached: boolean;
  remainingMs: number;              // time left until goal; 0 once reached
  overtimeMs: number;               // time fasted past the goal; 0 before
  totalElapsedMs: number;           // start → now (includes overtime)
  plannedDurationMs: number;        // endTime − startTime
  progressPercent: number;          // 0–100, capped at 100 (never exceeds the goal visually)
  remainingFormatted: string;       // HH:MM:SS
  overtimeFormatted: string;        // HH:MM:SS
  totalElapsedFormatted: string;    // HH:MM:SS
}

// ─── Clock Integrity ─────────────────────────────────────────────────────────

export type ClockCheckResult =
  | { valid: true }
  | { valid: false; driftSeconds: number };

export type ForwardJumpResult =
  | { suspicious: false }
  | { suspicious: true; jumpMs: number };

// ─── Meal Entry (local-only journal) ─────────────────────────────────────────

/**
 * A single logged meal in the daily journal.
 *
 * LOCAL-ONLY by design: `MealEntry` is intentionally NOT part of
 * `SyncableRecord` / the Supabase sync queue above. Meals — and especially
 * their photos — live entirely on the device (AsyncStorage + the app document
 * directory). `photoUri` is a device-local `file://` path with no meaning
 * off-device, so there is nothing to sync. This keeps the meal journal at zero
 * cloud cost.
 */
export interface MealEntry {
  mealId: string;                   // UUID
  userId: string;                   // Supabase Auth userId or "guest"
  localDate: string;                // "YYYY-MM-DD" in the user's local timezone
  name: string;
  calories: number | null;          // kcal; null when not provided
  photoUri: string | null;          // device-local file URI; null for text-only meals
  loggedAt: string;                 // UTC ISO 8601 — meal time, used for timeline ordering
  createdAt: string;                // UTC ISO 8601
  updatedAt: string;                // UTC ISO 8601
}
