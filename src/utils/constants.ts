/**
 * AsyncStorage key constants for FastTrack.
 * All keys follow the @fasttrack:* convention.
 */

export const STORAGE_KEYS = {
  /** Current active fasting session */
  ACTIVE_SESSION: '@fasttrack:activeSession',

  /**
   * Per-user active-session ledger: Record<userId, FastingSession>.
   * Device-level, preserved across logout so an in-progress fast is restored
   * (and keeps counting, since the timer is derived from startTime) when the
   * same account signs back in. Cleared when the fast ends/cancels/completes.
   */
  ACTIVE_SESSION_LEDGER: '@fasttrack:activeSessionLedger',

  /** Daily stats for a specific date. Append :{YYYY-MM-DD} */
  DAILY_STATS_PREFIX: '@fasttrack:dailyStats:',

  /**
   * Meal-journal entries for a specific date (an array of MealEntry).
   * Append :{YYYY-MM-DD}. Local-only — never enqueued to the Supabase sync queue.
   */
  MEALS_PREFIX: '@fasttrack:meals:',

  /** Cached streak record */
  STREAK: '@fasttrack:streak',

  /** User profile */
  PROFILE: '@fasttrack:profile',

  /**
   * Per-user profile ledger: Record<userId, UserProfile>.
   * Device-level, preserved across logout so each account's display name and
   * preferences are restored on next login. The active PROFILE key is wiped on
   * logout and syncEngine does not pull the profiles table, so without this the
   * display name would reset to the email prefix every login.
   */
  PROFILE_LEDGER: '@fasttrack:profileLedger',

  /** Subscription tier and metadata (active, for the currently signed-in user) */
  SUBSCRIPTION_STATUS: '@fasttrack:subscriptionStatus',

  /**
   * Per-user subscription ledger: Record<userId, SubscriptionStatus>.
   * Device-level, preserved across logout so each account's tier is restored
   * when they sign back in (subscriptions are a local mock, not server-backed).
   */
  SUBSCRIPTION_LEDGER: '@fasttrack:subscriptionLedger',

  /** Notification preferences */
  NOTIFICATION_PREFS: '@fasttrack:notificationPrefs',

  /** Array of pending sync entries */
  SYNC_QUEUE: '@fasttrack:syncQueue',

  /** Map of sessionId → notification IDs */
  SCHEDULED_NOTIFICATIONS: '@fasttrack:scheduledNotifications',

  /** Boolean flag for onboarding completion */
  ONBOARDING_COMPLETE: '@fasttrack:onboardingComplete',

  /** Boolean flag for guest session */
  GUEST_MODE: '@fasttrack:guestMode',

  /** Last system time check for drift detection */
  LAST_CLOCK_CHECK: '@fasttrack:lastClockCheck',

  /** UTC timestamp of last timer tick (for forward jump detection) */
  LAST_TIMER_CHECK_UTC: '@fasttrack:lastTimerCheckUtc',

  /** Elapsed ms at last timer tick (for forward jump detection) */
  LAST_KNOWN_ELAPSED_MS: '@fasttrack:lastKnownElapsedMs',

  /** CLOCK_SUSPECT flag for a specific session. Append :{sessionId} */
  CLOCK_SUSPECT_PREFIX: '@fasttrack:clockSuspect:',

  /** Local cache of completed sessions */
  SESSION_HISTORY: '@fasttrack:sessionHistory',

  /** User's theme preference ('light' | 'dark' | 'system') */
  THEME_PREFERENCE: '@fasttrack:themePreference',
} as const;

/** Helper to build a daily stats key for a specific date */
export function dailyStatsKey(date: string): string {
  return `${STORAGE_KEYS.DAILY_STATS_PREFIX}${date}`;
}

/** Helper to build a meals key for a specific date */
export function mealsKey(date: string): string {
  return `${STORAGE_KEYS.MEALS_PREFIX}${date}`;
}

/** Helper to build a clock suspect key for a specific session */
export function clockSuspectKey(sessionId: string): string {
  return `${STORAGE_KEYS.CLOCK_SUSPECT_PREFIX}${sessionId}`;
}
