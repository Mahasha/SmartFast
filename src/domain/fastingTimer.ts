/**
 * FastingTimer Domain Service
 *
 * Manages fasting session lifecycle: creation, active display computation,
 * persistence/recovery, and completion.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6,
 *            7.1, 7.2, 7.3, 7.4, 7.5
 */

import { v4 as uuidv4 } from 'uuid';
import { FastingPlan, FastingSession, FastingProgress, ClockCheckResult, ForwardJumpResult } from '../models/index';
import { getItem, setItem, removeItem } from '../data/localStorage';
import { STORAGE_KEYS, clockSuspectKey } from '../utils/constants';

/**
 * Window after the goal during which the timer reports GOAL_REACHED (for the
 * one-time celebration). After it, the phase settles into OVERTIME. The
 * "Goal Achieved" label is shown throughout both phases — this only gates the
 * momentary celebration.
 */
export const GOAL_CELEBRATION_WINDOW_MS = 60_000;

/**
 * Starts a new fasting session based on the given plan.
 *
 * - Creates a session with UTC ISO 8601 startTime/endTime
 * - Sets status to ACTIVE
 * - Persists to AsyncStorage
 * - Prevents starting if an ACTIVE session already exists
 *
 * Validates: Requirements 4.1, 4.2, 4.4, 4.5
 */
export async function startFast(plan: FastingPlan): Promise<FastingSession> {
  const existing = await getActiveSession();
  if (existing !== null) {
    throw new Error(
      'Cannot start a new fast while one is already in progress.',
    );
  }

  const now = new Date();
  const startTime = now.toISOString();
  const endTime = new Date(
    now.getTime() + plan.fastingHours * 60 * 60 * 1000,
  ).toISOString();

  const session: FastingSession = {
    sessionId: uuidv4(),
    userId: 'guest', // Will be replaced by auth context when available
    planId: plan.planId,
    startTime,
    endTime,
    actualEndTime: null,
    status: 'ACTIVE',
    durationFasted: null,
    goalReachedAt: null,
    completedAt: null,
    timezoneOffsetMinutes: now.getTimezoneOffset(),
    createdAt: startTime,
    updatedAt: startTime,
  };

  await setItem(STORAGE_KEYS.ACTIVE_SESSION, session);

  return session;
}

/**
 * Ends the current active fast — the single, user-driven completion path.
 *
 * Fasting is open-ended: a session is never auto-completed when it reaches its
 * goal. The user explicitly ends it, at which point:
 * - status is COMPLETED if the goal was reached (now >= endTime), else ENDED_EARLY
 * - actualEndTime / completedAt = current UTC time
 * - durationFasted = actual seconds fasted (start → now), the analytics source of truth
 * - goalReachedAt = endTime when the goal was reached, else null
 * - the active session key is cleared
 *
 * Validates: Requirements 7.2, 7.3, 7.5
 */
export async function endFast(): Promise<FastingSession> {
  const session = await getActiveSession();
  if (session === null) {
    throw new Error('No active fasting session to end.');
  }

  const now = new Date();
  const actualEndTime = now.toISOString();
  const startMs = new Date(session.startTime).getTime();
  const endMs = new Date(session.endTime).getTime();
  const reachedGoal = now.getTime() >= endMs;
  const durationFasted = Math.round((now.getTime() - startMs) / 1000);

  const updatedSession: FastingSession = {
    ...session,
    status: reachedGoal ? 'COMPLETED' : 'ENDED_EARLY',
    actualEndTime,
    completedAt: actualEndTime,
    goalReachedAt: reachedGoal ? session.endTime : null,
    durationFasted,
    updatedAt: actualEndTime,
  };

  await removeItem(STORAGE_KEYS.ACTIVE_SESSION);

  return updatedSession;
}

/**
 * Cancels the current active fast.
 *
 * - Sets status to CANCELLED
 * - Sets actualEndTime to current UTC time
 * - Computes durationFasted in seconds
 * - Clears active session from storage
 *
 * Validates: Requirements 7.3
 */
export async function cancelFast(): Promise<FastingSession> {
  const session = await getActiveSession();
  if (session === null) {
    throw new Error('No active fasting session to cancel.');
  }

  const now = new Date();
  const actualEndTime = now.toISOString();
  const startMs = new Date(session.startTime).getTime();
  const durationFasted = Math.round((now.getTime() - startMs) / 1000);

  const updatedSession: FastingSession = {
    ...session,
    status: 'CANCELLED',
    actualEndTime,
    completedAt: actualEndTime,
    goalReachedAt: null,
    durationFasted,
    updatedAt: actualEndTime,
  };

  await removeItem(STORAGE_KEYS.ACTIVE_SESSION);

  return updatedSession;
}

/**
 * Retrieves the current active fasting session from AsyncStorage.
 * Returns null if no active session exists.
 *
 * Validates: Requirements 4.4
 */
export async function getActiveSession(): Promise<FastingSession | null> {
  const session = await getItem<FastingSession>(STORAGE_KEYS.ACTIVE_SESSION);
  if (session === null) {
    return null;
  }
  if (session.status !== 'ACTIVE') {
    return null;
  }
  return session;
}

/**
 * Computes the current derived progress for a fasting session.
 *
 * Fasting is open-ended: reaching the goal does NOT complete the session. Once
 * the goal is passed the timer counts up (overtimeMs) while remainingMs stays 0.
 *
 * - remainingMs   = max(0, endTime − now)
 * - overtimeMs    = max(0, now − endTime)
 * - totalElapsedMs = max(0, now − startTime)
 * - progressPercent = min(100, totalElapsed / planned * 100) — capped at the goal
 * - phase: COUNTDOWN before the goal; GOAL_REACHED within the celebration window
 *   after it; OVERTIME thereafter; COMPLETED for a terminal session.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */
export function computeProgress(session: FastingSession, now: Date): FastingProgress {
  const startMs = new Date(session.startTime).getTime();
  const endMs = new Date(session.endTime).getTime();
  const nowMs = now.getTime();

  const plannedDurationMs = Math.max(0, endMs - startMs);
  const totalElapsedMs = Math.max(0, nowMs - startMs);
  const remainingMs = Math.max(0, endMs - nowMs);
  const overtimeMs = Math.max(0, nowMs - endMs);
  const isGoalReached = nowMs >= endMs;

  const progressPercent =
    plannedDurationMs <= 0
      ? 100
      : Math.min(100, Math.max(0, (totalElapsedMs / plannedDurationMs) * 100));

  let phase: FastingProgress['phase'];
  if (session.status !== 'ACTIVE') {
    phase = 'COMPLETED';
  } else if (!isGoalReached) {
    phase = 'COUNTDOWN';
  } else if (overtimeMs < GOAL_CELEBRATION_WINDOW_MS) {
    phase = 'GOAL_REACHED';
  } else {
    phase = 'OVERTIME';
  }

  return {
    phase,
    isGoalReached,
    remainingMs,
    overtimeMs,
    totalElapsedMs,
    plannedDurationMs,
    progressPercent,
    remainingFormatted: formatDuration(remainingMs),
    overtimeFormatted: formatDuration(overtimeMs),
    totalElapsedFormatted: formatDuration(totalElapsedMs),
  };
}

/**
 * Restores a fasting session from AsyncStorage on app launch.
 *
 * Fasting is open-ended, so an ACTIVE session is returned as-is for timer
 * resumption — even if it is already past its goal (the timer simply resumes in
 * overtime, counting up). A session is only ever ended by an explicit user
 * action, never on restore. Returns null if there is no active session.
 *
 * Uses the system clock (new Date()) for all time calculations.
 *
 * Validates: Requirements 6.1, 6.3, 6.4
 */
export async function restoreSession(): Promise<FastingSession | null> {
  const session = await getItem<FastingSession>(STORAGE_KEYS.ACTIVE_SESSION);
  if (session === null || session.status !== 'ACTIVE') {
    return null;
  }

  // Active session — resume the timer (in overtime if already past the goal).
  return session;
}

/**
 * Formats a duration in milliseconds to HH:MM:SS string.
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${padTwo(hours)}:${padTwo(minutes)}:${padTwo(seconds)}`;
}

/**
 * Pads a number to two digits with a leading zero.
 */
function padTwo(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Checks for backward clock drift by comparing the current time to the last
 * recorded timer check time.
 *
 * If the current time is earlier than the last check time by more than 60 seconds,
 * this indicates the system clock was set backward (potential tampering or NTP correction).
 *
 * Returns { valid: true } if no backward drift detected, or
 * { valid: false, driftSeconds } if backward drift exceeds the 60-second threshold.
 *
 * Validates: Requirement 6.5
 */
export function checkClockIntegrity(
  _session: FastingSession,
  now: Date,
  lastCheckTime: Date,
): ClockCheckResult {
  const diffMs = lastCheckTime.getTime() - now.getTime();

  if (diffMs > 60_000) {
    return { valid: false, driftSeconds: diffMs / 1000 };
  }

  return { valid: true };
}

/**
 * Checks for a suspicious forward clock jump.
 *
 * Compares the wall clock delta (time since last timer check) against the
 * expected elapsed time based on the timer's perspective. If the wall clock
 * advanced more than 10 minutes beyond what the timer expected, the jump is
 * flagged as suspicious.
 *
 * Detection logic:
 * - wallClockDelta = now - lastTimerCheckUtc (how much wall time passed since last check)
 * - expectedElapsedSinceLastCheck = (now - session.startTime) - lastKnownElapsedMs
 *   (how much time the timer thinks should have passed since last check)
 * - If wallClockDelta - expectedElapsedSinceLastCheck > 10 minutes → suspicious
 *
 * In normal operation these values are equal. A forward clock jump makes
 * wallClockDelta much larger than expectedElapsedSinceLastCheck.
 *
 * Validates: Requirement 6.7
 */
export function checkForwardClockJump(
  session: FastingSession,
  now: Date,
  lastTimerCheckUtc: Date,
  lastKnownElapsedMs: number,
): ForwardJumpResult {
  const TEN_MINUTES_MS = 10 * 60 * 1000;

  const wallClockDelta = now.getTime() - lastTimerCheckUtc.getTime();
  const currentElapsedMs = now.getTime() - new Date(session.startTime).getTime();
  const expectedElapsedSinceLastCheck = currentElapsedMs - lastKnownElapsedMs;

  const jumpMs = wallClockDelta - expectedElapsedSinceLastCheck;

  if (jumpMs > TEN_MINUTES_MS) {
    return { suspicious: true, jumpMs };
  }

  return { suspicious: false };
}

/**
 * Marks a session as CLOCK_SUSPECT by storing a flag in AsyncStorage.
 *
 * CLOCK_SUSPECT is a local-only flag (not a session status) and is NOT synced
 * to Supabase. A CLOCK_SUSPECT session cannot become a Qualifying_Fast until
 * the user explicitly confirms the session summary.
 *
 * Validates: Requirements 6.7, 6.8, 6.9
 */
export async function markClockSuspect(sessionId: string): Promise<void> {
  await setItem(clockSuspectKey(sessionId), true);
}

/**
 * Checks whether a session is marked as CLOCK_SUSPECT.
 *
 * Returns true if the CLOCK_SUSPECT flag exists for the given session.
 *
 * Validates: Requirements 6.8, 6.10
 */
export async function isClockSuspect(sessionId: string): Promise<boolean> {
  const value = await getItem<boolean>(clockSuspectKey(sessionId));
  return value === true;
}

/**
 * Clears the CLOCK_SUSPECT flag for a session.
 *
 * Called when the user confirms the session summary, allowing the session
 * to be evaluated as a potential Qualifying_Fast.
 *
 * Validates: Requirement 6.10
 */
export async function clearClockSuspect(sessionId: string): Promise<void> {
  await removeItem(clockSuspectKey(sessionId));
}
