/**
 * Unit tests for useSessionRecovery hook and recoverSession utility
 *
 * Open-ended fasting model: a session that runs past its planned goal stays
 * ACTIVE and counts up in overtime. recoverSession never auto-completes.
 */

import { recoverSession } from './useSessionRecovery';
import { FastingSession } from '../models/index';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.clear as jest.Mock)();
});

describe('recoverSession', () => {
  it('returns null session state when no active session exists', async () => {
    const result = await recoverSession();

    expect(result.session).toBeNull();
    expect(result.timerState).toBeNull();
    expect(result.justCompleted).toBe(false);
  });

  it('recalculates progress from system clock for an active session', async () => {
    const now = new Date();
    const startTime = new Date(now.getTime() - 4 * 60 * 60 * 1000); // 4 hours ago
    const endTime = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours from now

    const session: FastingSession = {
      sessionId: 'recovery-test-1',
      userId: 'guest',
      planId: 'plan-16-8',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      actualEndTime: null,
      status: 'ACTIVE',
      durationFasted: null,
      goalReachedAt: null,
      completedAt: null,
      timezoneOffsetMinutes: 0,
      createdAt: startTime.toISOString(),
      updatedAt: startTime.toISOString(),
    };

    await AsyncStorage.setItem(
      STORAGE_KEYS.ACTIVE_SESSION,
      JSON.stringify(session),
    );

    const result = await recoverSession();

    expect(result.session).not.toBeNull();
    expect(result.session!.status).toBe('ACTIVE');
    expect(result.timerState).not.toBeNull();
    expect(result.timerState!.isGoalReached).toBe(false);
    expect(result.timerState!.phase).toBe('COUNTDOWN');
    expect(result.timerState!.totalElapsedMs).toBeGreaterThan(0);
    expect(result.timerState!.remainingMs).toBeGreaterThan(0);
    expect(result.justCompleted).toBe(false);
  });

  it('keeps a goal-passed session ACTIVE in overtime instead of auto-completing', async () => {
    const now = new Date();
    const pastStart = new Date(now.getTime() - 17 * 60 * 60 * 1000); // 17 hours ago
    const pastEnd = new Date(now.getTime() - 1 * 60 * 60 * 1000); // goal hit 1 hour ago

    const overtimeSession: FastingSession = {
      sessionId: 'recovery-test-2',
      userId: 'guest',
      planId: 'plan-16-8',
      startTime: pastStart.toISOString(),
      endTime: pastEnd.toISOString(),
      actualEndTime: null,
      status: 'ACTIVE',
      durationFasted: null,
      goalReachedAt: null,
      completedAt: null,
      timezoneOffsetMinutes: 0,
      createdAt: pastStart.toISOString(),
      updatedAt: pastStart.toISOString(),
    };

    await AsyncStorage.setItem(
      STORAGE_KEYS.ACTIVE_SESSION,
      JSON.stringify(overtimeSession),
    );

    const result = await recoverSession();

    expect(result.session).not.toBeNull();
    expect(result.session!.status).toBe('ACTIVE');
    expect(result.session!.durationFasted).toBeNull();
    expect(result.timerState).not.toBeNull();
    expect(result.timerState!.isGoalReached).toBe(true);
    expect(result.timerState!.phase).toBe('OVERTIME');
    expect(result.timerState!.overtimeMs).toBeGreaterThan(0);
    expect(result.justCompleted).toBe(false);
  });

  it('does not clear the active session key for a goal-passed session', async () => {
    const now = new Date();
    const pastStart = new Date(now.getTime() - 17 * 60 * 60 * 1000);
    const pastEnd = new Date(now.getTime() - 1 * 60 * 60 * 1000);

    const overtimeSession: FastingSession = {
      sessionId: 'recovery-test-3',
      userId: 'guest',
      planId: 'plan-16-8',
      startTime: pastStart.toISOString(),
      endTime: pastEnd.toISOString(),
      actualEndTime: null,
      status: 'ACTIVE',
      durationFasted: null,
      goalReachedAt: null,
      completedAt: null,
      timezoneOffsetMinutes: 0,
      createdAt: pastStart.toISOString(),
      updatedAt: pastStart.toISOString(),
    };

    await AsyncStorage.setItem(
      STORAGE_KEYS.ACTIVE_SESSION,
      JSON.stringify(overtimeSession),
    );

    await recoverSession();

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    expect(raw).not.toBeNull();
  });

  it('invokes onRecovery callback with session state', async () => {
    const now = new Date();
    const startTime = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const endTime = new Date(now.getTime() + 14 * 60 * 60 * 1000);

    const session: FastingSession = {
      sessionId: 'recovery-test-4',
      userId: 'guest',
      planId: 'plan-16-8',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      actualEndTime: null,
      status: 'ACTIVE',
      durationFasted: null,
      goalReachedAt: null,
      completedAt: null,
      timezoneOffsetMinutes: 0,
      createdAt: startTime.toISOString(),
      updatedAt: startTime.toISOString(),
    };

    await AsyncStorage.setItem(
      STORAGE_KEYS.ACTIVE_SESSION,
      JSON.stringify(session),
    );

    const onRecovery = jest.fn();
    await recoverSession(onRecovery);

    expect(onRecovery).toHaveBeenCalledTimes(1);
    expect(onRecovery).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({ sessionId: 'recovery-test-4' }),
        timerState: expect.objectContaining({ isGoalReached: false }),
        justCompleted: false,
      }),
    );
  });

  it('invokes onRecovery callback with null when no session exists', async () => {
    const onRecovery = jest.fn();
    await recoverSession(onRecovery);

    expect(onRecovery).toHaveBeenCalledTimes(1);
    expect(onRecovery).toHaveBeenCalledWith({
      session: null,
      timerState: null,
      justCompleted: false,
    });
  });
});
