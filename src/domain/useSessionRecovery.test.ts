/**
 * Unit tests for useSessionRecovery hook and recoverSession utility
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
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

  it('recalculates progress from system clock for an active session (Requirement 6.2, 6.4)', async () => {
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
    expect(result.timerState!.isComplete).toBe(false);
    expect(result.timerState!.elapsedMs).toBeGreaterThan(0);
    expect(result.timerState!.remainingMs).toBeGreaterThan(0);
    expect(result.justCompleted).toBe(false);
  });

  it('completes session that expired while in background (Requirement 6.3)', async () => {
    const pastStart = new Date('2024-01-01T00:00:00.000Z');
    const pastEnd = new Date('2024-01-01T16:00:00.000Z');

    const expiredSession: FastingSession = {
      sessionId: 'recovery-test-2',
      userId: 'guest',
      planId: 'plan-16-8',
      startTime: pastStart.toISOString(),
      endTime: pastEnd.toISOString(),
      actualEndTime: null,
      status: 'ACTIVE',
      durationFasted: null,
      timezoneOffsetMinutes: 0,
      createdAt: pastStart.toISOString(),
      updatedAt: pastStart.toISOString(),
    };

    await AsyncStorage.setItem(
      STORAGE_KEYS.ACTIVE_SESSION,
      JSON.stringify(expiredSession),
    );

    const result = await recoverSession();

    expect(result.session).not.toBeNull();
    expect(result.session!.status).toBe('COMPLETED');
    expect(result.session!.durationFasted).toBe(16 * 60 * 60);
    expect(result.timerState).not.toBeNull();
    expect(result.timerState!.isComplete).toBe(true);
    expect(result.justCompleted).toBe(true);
  });

  it('clears active session key after completing expired session', async () => {
    const pastStart = new Date('2024-01-01T00:00:00.000Z');
    const pastEnd = new Date('2024-01-01T16:00:00.000Z');

    const expiredSession: FastingSession = {
      sessionId: 'recovery-test-3',
      userId: 'guest',
      planId: 'plan-16-8',
      startTime: pastStart.toISOString(),
      endTime: pastEnd.toISOString(),
      actualEndTime: null,
      status: 'ACTIVE',
      durationFasted: null,
      timezoneOffsetMinutes: 0,
      createdAt: pastStart.toISOString(),
      updatedAt: pastStart.toISOString(),
    };

    await AsyncStorage.setItem(
      STORAGE_KEYS.ACTIVE_SESSION,
      JSON.stringify(expiredSession),
    );

    await recoverSession();

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    expect(raw).toBeNull();
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
        timerState: expect.objectContaining({ isComplete: false }),
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
