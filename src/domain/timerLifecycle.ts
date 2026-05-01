/**
 * Timer Lifecycle Wiring — Coordinates timer events with notifications and sync.
 *
 * On startFast: persist session, enqueue sync, schedule milestone notifications
 * On endFastEarly/cancel: update session, enqueue sync, cancel notifications
 * On auto-complete: update session, enqueue sync, trigger streak recompute
 * On app launch: restore session, revalidate notifications, trigger sync pull
 *
 * Validates: Requirements 4.2, 4.3, 7.3, 14.1, 14.2, 14.6, 23.2
 */

import { FastingPlan, FastingSession } from '../models/index';
import { ALL_PREDEFINED_PLANS } from '../models/plans';
import {
  startFast as timerStartFast,
  endFastEarly as timerEndFastEarly,
  cancelFast as timerCancelFast,
  restoreSession as timerRestoreSession,
  completeSession,
} from './fastingTimer';
import { enqueue, pushPendingChanges, pullRemoteChanges } from '../data/syncEngine';
import {
  scheduleFastingMilestones,
  cancelSessionNotifications,
  revalidateOnLaunch,
} from './notificationScheduler';
import { recomputeStreaks } from './streakEngine';
import { getItem, setItem } from '../data/localStorage';
import { STORAGE_KEYS } from '../utils/constants';
import { handleSyncError, handleNotificationError } from '../utils/errorHandling';

// ─── Lifecycle Functions ─────────────────────────────────────────────────────

/**
 * Starts a fast with full lifecycle wiring:
 * 1. Persist session via FastingTimer
 * 2. Enqueue sync
 * 3. Schedule milestone notifications
 *
 * Validates: Requirements 4.2, 4.3, 14.1, 14.2
 */
export async function startFastWithLifecycle(plan: FastingPlan): Promise<FastingSession> {
  // 1. Create and persist session
  const session = await timerStartFast(plan);

  // 2. Add to session history
  await addToSessionHistory(session);

  // 3. Enqueue sync (non-blocking)
  try {
    await enqueue(session);
  } catch (error) {
    handleSyncError(error, 0);
  }

  // 4. Schedule notifications (non-blocking)
  try {
    await scheduleFastingMilestones(session);
  } catch (error) {
    handleNotificationError(error, 'scheduleFastingMilestones');
  }

  return session;
}

/**
 * Ends a fast early with full lifecycle wiring:
 * 1. Update session via FastingTimer
 * 2. Enqueue sync
 * 3. Cancel notifications
 *
 * Validates: Requirements 7.3, 14.6
 */
export async function endFastEarlyWithLifecycle(): Promise<FastingSession> {
  // 1. End fast early
  const session = await timerEndFastEarly();

  // 2. Update session history
  await updateSessionHistory(session);

  // 3. Enqueue sync (non-blocking)
  try {
    await enqueue(session);
  } catch (error) {
    handleSyncError(error, 0);
  }

  // 4. Cancel notifications (non-blocking)
  try {
    await cancelSessionNotifications(session.sessionId);
  } catch (error) {
    handleNotificationError(error, 'cancelSessionNotifications');
  }

  return session;
}

/**
 * Cancels a fast with full lifecycle wiring:
 * 1. Update session via FastingTimer
 * 2. Enqueue sync
 * 3. Cancel notifications
 *
 * Validates: Requirements 7.3, 14.6
 */
export async function cancelFastWithLifecycle(): Promise<FastingSession> {
  // 1. Cancel fast
  const session = await timerCancelFast();

  // 2. Update session history
  await updateSessionHistory(session);

  // 3. Enqueue sync (non-blocking)
  try {
    await enqueue(session);
  } catch (error) {
    handleSyncError(error, 0);
  }

  // 4. Cancel notifications (non-blocking)
  try {
    await cancelSessionNotifications(session.sessionId);
  } catch (error) {
    handleNotificationError(error, 'cancelSessionNotifications');
  }

  return session;
}

/**
 * Handles auto-completion of a fasting session:
 * 1. Mark session as COMPLETED
 * 2. Enqueue sync
 * 3. Trigger streak recomputation
 *
 * Validates: Requirements 4.3, 23.2
 */
export async function autoCompleteWithLifecycle(session: FastingSession): Promise<FastingSession> {
  // 1. Complete the session
  const completed = await completeSession(session);

  // 2. Update session history
  await updateSessionHistory(completed);

  // 3. Enqueue sync (non-blocking)
  try {
    await enqueue(completed);
  } catch (error) {
    handleSyncError(error, 0);
  }

  // 4. Trigger streak recomputation
  try {
    await recomputeAndCacheStreaks();
  } catch (error) {
    console.warn('[TimerLifecycle] Streak recomputation failed:', error);
  }

  return completed;
}

/**
 * Handles app launch lifecycle:
 * 1. Restore session from storage
 * 2. Revalidate notifications for active session
 * 3. Trigger sync pull
 *
 * Validates: Requirements 14.6, 23.2
 */
export async function onAppLaunchLifecycle(): Promise<FastingSession | null> {
  // 1. Restore session
  const session = await timerRestoreSession();

  // 2. Revalidate notifications if session is active
  if (session && session.status === 'ACTIVE') {
    try {
      await revalidateOnLaunch(session);
    } catch (error) {
      handleNotificationError(error, 'revalidateOnLaunch');
    }
  }

  // 3. If session was auto-completed during restore, handle lifecycle
  if (session && session.status === 'COMPLETED') {
    await updateSessionHistory(session);
    try {
      await enqueue(session);
    } catch (error) {
      handleSyncError(error, 0);
    }
    try {
      await recomputeAndCacheStreaks();
    } catch {
      // Non-blocking
    }
  }

  // 4. Trigger sync pull (non-blocking)
  try {
    await pullRemoteChanges();
  } catch (error) {
    handleSyncError(error, 0);
  }

  return session;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Adds a session to the local session history.
 */
async function addToSessionHistory(session: FastingSession): Promise<void> {
  const history = (await getItem<FastingSession[]>(STORAGE_KEYS.SESSION_HISTORY)) ?? [];
  history.push(session);
  await setItem(STORAGE_KEYS.SESSION_HISTORY, history);
}

/**
 * Updates a session in the local session history.
 */
async function updateSessionHistory(session: FastingSession): Promise<void> {
  const history = (await getItem<FastingSession[]>(STORAGE_KEYS.SESSION_HISTORY)) ?? [];
  const index = history.findIndex((s) => s.sessionId === session.sessionId);
  if (index >= 0) {
    history[index] = session;
  } else {
    history.push(session);
  }
  await setItem(STORAGE_KEYS.SESSION_HISTORY, history);
}

/**
 * Recomputes streaks from session history and caches the result.
 */
async function recomputeAndCacheStreaks(): Promise<void> {
  const history = (await getItem<FastingSession[]>(STORAGE_KEYS.SESSION_HISTORY)) ?? [];
  const streakResult = recomputeStreaks(history, ALL_PREDEFINED_PLANS, new Date());

  const existingStreak = await getItem<{ streakId: string; userId: string; createdAt: string }>(
    STORAGE_KEYS.STREAK,
  );

  const streakRecord = {
    streakId: existingStreak?.streakId ?? 'streak-local',
    userId: existingStreak?.userId ?? 'guest',
    currentStreak: streakResult.currentStreak,
    longestStreak: streakResult.longestStreak,
    lastStreakDate: streakResult.lastStreakDate,
    sessionCountSnapshot: history.length,
    createdAt: existingStreak?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await setItem(STORAGE_KEYS.STREAK, streakRecord);
}
