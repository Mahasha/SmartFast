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
  endTime: string;                  // UTC ISO 8601 (planned end)
  actualEndTime: string | null;     // UTC ISO 8601 (set when ended early)
  status: SessionStatus;
  durationFasted: number | null;    // seconds
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

export interface SubscriptionStatus {
  subId: string;
  userId: string;
  tier: SubscriptionTier;
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

// ─── Timer State ─────────────────────────────────────────────────────────────

export interface TimerState {
  remainingMs: number;
  elapsedMs: number;
  progressFraction: number;         // 0.0 to 1.0
  remainingFormatted: string;       // HH:MM:SS
  elapsedFormatted: string;         // HH:MM:SS
  isComplete: boolean;
}

// ─── Clock Integrity ─────────────────────────────────────────────────────────

export type ClockCheckResult =
  | { valid: true }
  | { valid: false; driftSeconds: number };

export type ForwardJumpResult =
  | { suspicious: false }
  | { suspicious: true; jumpMs: number };
