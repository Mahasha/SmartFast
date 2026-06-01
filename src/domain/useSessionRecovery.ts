/**
 * useSessionRecovery Hook
 *
 * Handles session recovery when the app returns from background.
 * On app foreground, recalculates progress using the system clock and
 * auto-completes sessions that have expired while in background.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { FastingSession, FastingProgress } from '../models/index';
import { getActiveSession, computeProgress } from './fastingTimer';
import { updateFastingService, stopFastingService } from '../native/FastingService';
import { ALL_PREDEFINED_PLANS } from '../models/plans';

export interface SessionRecoveryState {
  session: FastingSession | null;
  timerState: FastingProgress | null;
  /**
   * Retained for callers' shape stability. Fasting is open-ended, so foreground
   * recovery never auto-completes a session — this is always false.
   */
  justCompleted: boolean;
}

export interface UseSessionRecoveryOptions {
  /** Callback invoked when session state changes due to foreground recovery */
  onRecovery?: (state: SessionRecoveryState) => void;
}

/**
 * React hook that listens for AppState changes and recalculates
 * fasting session progress when the app returns to the foreground.
 *
 * - On foreground: reads the active session, recalculates progress
 *   using the current system clock (Requirement 6.4).
 * - If the session has completed while in background, calls completeSession
 *   and clears the active session key (Requirement 6.3).
 *
 * @param options - Optional callbacks for recovery events
 */
export function useSessionRecovery(options?: UseSessionRecoveryOptions): void {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const handleAppStateChange = useCallback(
    async (nextAppState: AppStateStatus) => {
      // Only trigger on transition from background/inactive to active
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        await recoverSession(options?.onRecovery);
      }
      appStateRef.current = nextAppState;
    },
    [options?.onRecovery],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);
}

/**
 * Performs session recovery logic. Exported for testability.
 *
 * - Reads the active session from storage
 * - Recalculates progress from the system clock
 * - Returns the active session for resumption. Fasting is open-ended, so a
 *   session past its goal simply resumes in overtime — it is never
 *   auto-completed here; only an explicit user action ends a fast.
 *
 * Validates: Requirements 6.2, 6.3, 6.4
 */
export async function recoverSession(
  onRecovery?: (state: SessionRecoveryState) => void,
): Promise<SessionRecoveryState> {
  const session = await getActiveSession();

  if (session === null) {
    // No active fast — clear any lingering foreground notification.
    try {
      stopFastingService();
    } catch {
      // best-effort; the notification is non-critical
    }
    const state: SessionRecoveryState = {
      session: null,
      timerState: null,
      justCompleted: false,
    };
    onRecovery?.(state);
    return state;
  }

  const now = new Date();
  const timerState = computeProgress(session, now);

  // Re-establish the ongoing foreground notification on return to foreground.
  try {
    const planName =
      ALL_PREDEFINED_PLANS.find((p) => p.planId === session.planId)?.name ?? 'Fasting';
    updateFastingService({
      startTimeMillis: new Date(session.startTime).getTime(),
      goalTimeMillis: new Date(session.endTime).getTime(),
      planName,
    });
  } catch {
    // best-effort; the timer is correct regardless of the notification
  }

  // Session still active — resume (in overtime if past the goal).
  const state: SessionRecoveryState = {
    session,
    timerState,
    justCompleted: false,
  };
  onRecovery?.(state);
  return state;
}
