/**
 * AsyncStorage key constants for FastTrack.
 * All keys follow the @fasttrack:* convention.
 */

export const STORAGE_KEYS = {
  /** Current active fasting session */
  ACTIVE_SESSION: '@fasttrack:activeSession',

  /** Daily stats for a specific date. Append :{YYYY-MM-DD} */
  DAILY_STATS_PREFIX: '@fasttrack:dailyStats:',

  /** Cached streak record */
  STREAK: '@fasttrack:streak',

  /** User profile */
  PROFILE: '@fasttrack:profile',

  /** Subscription tier and metadata */
  SUBSCRIPTION_STATUS: '@fasttrack:subscriptionStatus',

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

/** Helper to build a clock suspect key for a specific session */
export function clockSuspectKey(sessionId: string): string {
  return `${STORAGE_KEYS.CLOCK_SUSPECT_PREFIX}${sessionId}`;
}
