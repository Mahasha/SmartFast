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
import { FastingSession, TimerState } from '../models/index';
import { getActiveSession, computeProgress, completeSession } from './fastingTimer';
import { removeItem } from '../data/localStorage';
import { STORAGE_KEYS } from '../utils/constants';

export interface SessionRecoveryState {
  session: FastingSession | null;
  timerState: TimerState | null;
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
 * - If the session is complete, marks it as COMPLETED and clears active session
 *
 * Validates: Requirements 6.2, 6.3, 6.4
 */
export async function recoverSession(
  onRecovery?: (state: SessionRecoveryState) => void,
): Promise<SessionRecoveryState> {
  const session = await getActiveSession();

  if (session === null) {
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

  if (timerState.isComplete) {
    // Session completed while in background
    const completedSession = await completeSession(session);
    await removeItem(STORAGE_KEYS.ACTIVE_SESSION);

    const state: SessionRecoveryState = {
      session: completedSession,
      timerState,
      justCompleted: true,
    };
    onRecovery?.(state);
    return state;
  }

  // Session still active — return updated progress
  const state: SessionRecoveryState = {
    session,
    timerState,
    justCompleted: false,
  };
  onRecovery?.(state);
  return state;
}
