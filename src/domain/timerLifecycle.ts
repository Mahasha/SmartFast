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
  endFast as timerEndFast,
  cancelFast as timerCancelFast,
  restoreSession as timerRestoreSession,
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
import { getCurrentUserId } from './authManager';
import {
  saveActiveSessionToLedger,
  clearActiveSessionFromLedger,
} from './activeSessionLedger';
import {
  startFastingService,
  updateFastingService,
  stopFastingService,
} from '../native/FastingService';

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

  // Remember the active fast per-user so it survives logout (Requirement 6.x).
  await saveActiveSessionToLedger(getCurrentUserId(), session);

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

  // 5. Start the native foreground service (ongoing chronometer notification).
  try {
    startFastingService({
      startTimeMillis: new Date(session.startTime).getTime(),
      goalTimeMillis: new Date(session.endTime).getTime(),
      planName: plan.name,
    });
  } catch (error) {
    handleNotificationError(error, 'startFastingService');
  }

  return session;
}

/**
 * Ends the active fast — the single, user-driven completion path. The fast is
 * never auto-completed at its goal; this runs when the user taps "End Fast",
 * whether before the goal (ENDED_EARLY) or in overtime (COMPLETED).
 *
 * 1. Finalize session via FastingTimer (status + actual duration)
 * 2. Update session history
 * 3. Drop the per-user active-session ledger entry
 * 4. Enqueue sync
 * 5. Cancel notifications
 * 6. Recompute streaks so the dashboard reflects the result immediately
 *
 * Validates: Requirements 7.3, 14.6, 23.2
 */
export async function endFastWithLifecycle(): Promise<FastingSession> {
  // 1. Finalize the fast (COMPLETED if goal reached, else ENDED_EARLY)
  const session = await timerEndFast();

  // 2. Update session history
  await updateSessionHistory(session);

  // 3. The fast is over — drop the per-user active-session ledger entry.
  await clearActiveSessionFromLedger(getCurrentUserId());

  // 4. Enqueue sync (non-blocking)
  try {
    await enqueue(session);
  } catch (error) {
    handleSyncError(error, 0);
  }

  // 5. Cancel notifications (non-blocking)
  try {
    await cancelSessionNotifications(session.sessionId);
  } catch (error) {
    handleNotificationError(error, 'cancelSessionNotifications');
  }

  // 5b. Stop the foreground service / ongoing notification.
  try {
    stopFastingService();
  } catch (error) {
    handleNotificationError(error, 'stopFastingService');
  }

  // 6. Recompute streaks (non-blocking) so Home updates without a relaunch.
  try {
    await recomputeAndCacheStreaks();
  } catch (error) {
    console.warn('[TimerLifecycle] Streak recomputation failed:', error);
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

  // The fast is over — drop the per-user active-session ledger entry.
  await clearActiveSessionFromLedger(getCurrentUserId());

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

  // 5. Stop the foreground service / ongoing notification.
  try {
    stopFastingService();
  } catch (error) {
    handleNotificationError(error, 'stopFastingService');
  }

  return session;
}

/**
 * Handles app launch lifecycle:
 * 1. Restore session from storage (resumes in overtime if past the goal)
 * 2. Revalidate notifications for the active session (re-extends overtime marks)
 * 3. Trigger sync push/pull
 *
 * Validates: Requirements 14.6, 23.2
 */
export async function onAppLaunchLifecycle(): Promise<FastingSession | null> {
  // 1. Restore session — open-ended, so an over-goal session is still ACTIVE.
  const session = await timerRestoreSession();

  // 2. Revalidate notifications if session is active. revalidateOnLaunch
  //    reschedules goal + overtime marks relative to now, re-extending the
  //    bounded overtime window on every launch.
  if (session && session.status === 'ACTIVE') {
    try {
      await revalidateOnLaunch(session);
    } catch (error) {
      handleNotificationError(error, 'revalidateOnLaunch');
    }
    // Re-establish the ongoing foreground notification (recomputes phase).
    try {
      const planName =
        ALL_PREDEFINED_PLANS.find((p) => p.planId === session.planId)?.name ?? 'Fasting';
      updateFastingService({
        startTimeMillis: new Date(session.startTime).getTime(),
        goalTimeMillis: new Date(session.endTime).getTime(),
        planName,
      });
    } catch (error) {
      handleNotificationError(error, 'updateFastingService');
    }
  } else {
    // No active fast — clear any stale tile left by a killed process.
    try {
      stopFastingService();
    } catch (error) {
      handleNotificationError(error, 'stopFastingService');
    }
  }

  // 3. Flush any queued local changes, then pull remote (non-blocking).
  //    push is a no-op in guest mode (guarded inside pushPendingChanges).
  try {
    await pushPendingChanges();
  } catch (error) {
    handleSyncError(error, 0);
  }
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
