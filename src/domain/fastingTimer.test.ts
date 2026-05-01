/**
 * Unit tests for FastingTimer domain service
 *
 * Validates: Requirements 4.1, 4.2, 4.4, 4.5, 5.1, 5.2, 5.4, 5.5,
 *            7.2, 7.3, 7.5
 */

import {
  startFast,
  endFastEarly,
  cancelFast,
  getActiveSession,
  computeProgress,
  restoreSession,
  completeSession,
} from './fastingTimer';
import { FastingPlan, FastingSession } from '../models/index';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';

const mockPlan: FastingPlan = {
  planId: 'plan-16-8',
  name: '16:8',
  fastingHours: 16,
  eatingHours: 8,
  description: 'Popular intermittent fasting method',
  isPro: false,
  isCustom: false,
  createdByUserId: null,
  createdAt: '2024-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.clear as jest.Mock)();
});

describe('startFast', () => {
  it('creates a new ACTIVE session with correct timestamps', async () => {
    const before = Date.now();
    const session = await startFast(mockPlan);
    const after = Date.now();

    expect(session.status).toBe('ACTIVE');
    expect(session.planId).toBe('plan-16-8');
    expect(session.sessionId).toBeDefined();
    expect(session.actualEndTime).toBeNull();
    expect(session.durationFasted).toBeNull();

    const startMs = new Date(session.startTime).getTime();
    const endMs = new Date(session.endTime).getTime();

    expect(startMs).toBeGreaterThanOrEqual(before);
    expect(startMs).toBeLessThanOrEqual(after);
    // endTime should be startTime + 16 hours
    expect(endMs - startMs).toBe(16 * 60 * 60 * 1000);
  });

  it('persists the session to AsyncStorage', async () => {
    await startFast(mockPlan);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.ACTIVE_SESSION,
      expect.any(String),
    );
  });

  it('throws if an ACTIVE session already exists', async () => {
    await startFast(mockPlan);

    await expect(startFast(mockPlan)).rejects.toThrow(
      'Cannot start a new fast while one is already in progress.',
    );
  });

  it('uses UTC ISO 8601 format for timestamps', async () => {
    const session = await startFast(mockPlan);

    // ISO 8601 format check
    expect(session.startTime).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
    );
    expect(session.endTime).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
    );
  });
});

describe('endFastEarly', () => {
  it('ends an active session with ENDED_EARLY status', async () => {
    await startFast(mockPlan);
    const ended = await endFastEarly();

    expect(ended.status).toBe('ENDED_EARLY');
    expect(ended.actualEndTime).not.toBeNull();
    expect(ended.durationFasted).toBeGreaterThanOrEqual(0);
  });

  it('computes durationFasted in seconds', async () => {
    const session = await startFast(mockPlan);
    // Simulate some time passing by checking the result
    const ended = await endFastEarly();

    const startMs = new Date(session.startTime).getTime();
    const endMs = new Date(ended.actualEndTime!).getTime();
    const expectedSeconds = Math.round((endMs - startMs) / 1000);

    expect(ended.durationFasted).toBe(expectedSeconds);
  });

  it('clears the active session from storage', async () => {
    await startFast(mockPlan);
    await endFastEarly();

    const active = await getActiveSession();
    expect(active).toBeNull();
  });

  it('throws if no active session exists', async () => {
    await expect(endFastEarly()).rejects.toThrow(
      'No active fasting session to end.',
    );
  });
});

describe('cancelFast', () => {
  it('cancels an active session with CANCELLED status', async () => {
    await startFast(mockPlan);
    const cancelled = await cancelFast();

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.actualEndTime).not.toBeNull();
    expect(cancelled.durationFasted).toBeGreaterThanOrEqual(0);
  });

  it('clears the active session from storage', async () => {
    await startFast(mockPlan);
    await cancelFast();

    const active = await getActiveSession();
    expect(active).toBeNull();
  });

  it('throws if no active session exists', async () => {
    await expect(cancelFast()).rejects.toThrow(
      'No active fasting session to cancel.',
    );
  });
});

describe('getActiveSession', () => {
  it('returns null when no session exists', async () => {
    const session = await getActiveSession();
    expect(session).toBeNull();
  });

  it('returns the active session when one exists', async () => {
    const created = await startFast(mockPlan);
    const retrieved = await getActiveSession();

    expect(retrieved).not.toBeNull();
    expect(retrieved!.sessionId).toBe(created.sessionId);
  });

  it('returns null if stored session is not ACTIVE', async () => {
    // Manually store a completed session
    const completedSession: FastingSession = {
      sessionId: 'test-id',
      userId: 'guest',
      planId: 'plan-16-8',
      startTime: '2024-01-01T00:00:00.000Z',
      endTime: '2024-01-01T16:00:00.000Z',
      actualEndTime: null,
      status: 'COMPLETED',
      durationFasted: 57600,
      timezoneOffsetMinutes: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T16:00:00.000Z',
    };

    await AsyncStorage.setItem(
      STORAGE_KEYS.ACTIVE_SESSION,
      JSON.stringify(completedSession),
    );

    const result = await getActiveSession();
    expect(result).toBeNull();
  });
});

describe('computeProgress', () => {
  const baseSession: FastingSession = {
    sessionId: 'test-session',
    userId: 'guest',
    planId: 'plan-16-8',
    startTime: '2024-01-01T00:00:00.000Z',
    endTime: '2024-01-01T16:00:00.000Z', // 16 hours later
    actualEndTime: null,
    status: 'ACTIVE',
    durationFasted: null,
    timezoneOffsetMinutes: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  it('computes correct progress at the start', () => {
    const now = new Date('2024-01-01T00:00:00.000Z');
    const state = computeProgress(baseSession, now);

    expect(state.elapsedMs).toBe(0);
    expect(state.remainingMs).toBe(16 * 60 * 60 * 1000);
    expect(state.progressFraction).toBe(0);
    expect(state.isComplete).toBe(false);
    expect(state.elapsedFormatted).toBe('00:00:00');
    expect(state.remainingFormatted).toBe('16:00:00');
  });

  it('computes correct progress at the midpoint', () => {
    const now = new Date('2024-01-01T08:00:00.000Z'); // 8 hours in
    const state = computeProgress(baseSession, now);

    expect(state.elapsedMs).toBe(8 * 60 * 60 * 1000);
    expect(state.remainingMs).toBe(8 * 60 * 60 * 1000);
    expect(state.progressFraction).toBe(0.5);
    expect(state.isComplete).toBe(false);
    expect(state.elapsedFormatted).toBe('08:00:00');
    expect(state.remainingFormatted).toBe('08:00:00');
  });

  it('computes correct progress at completion', () => {
    const now = new Date('2024-01-01T16:00:00.000Z'); // exactly at end
    const state = computeProgress(baseSession, now);

    expect(state.remainingMs).toBe(0);
    expect(state.progressFraction).toBe(1);
    expect(state.isComplete).toBe(true);
    expect(state.remainingFormatted).toBe('00:00:00');
  });

  it('clamps remainingMs to 0 when past endTime', () => {
    const now = new Date('2024-01-01T18:00:00.000Z'); // 2 hours past end
    const state = computeProgress(baseSession, now);

    expect(state.remainingMs).toBe(0);
    expect(state.progressFraction).toBe(1);
    expect(state.isComplete).toBe(true);
  });

  it('clamps progressFraction to [0, 1] when now is before startTime', () => {
    const now = new Date('2023-12-31T23:00:00.000Z'); // 1 hour before start
    const state = computeProgress(baseSession, now);

    expect(state.progressFraction).toBe(0);
    expect(state.remainingMs).toBe(17 * 60 * 60 * 1000);
  });

  it('formats elapsed time correctly with hours, minutes, seconds', () => {
    // 2 hours, 30 minutes, 45 seconds in
    const now = new Date(
      new Date('2024-01-01T00:00:00.000Z').getTime() +
        2 * 3600000 +
        30 * 60000 +
        45 * 1000,
    );
    const state = computeProgress(baseSession, now);

    expect(state.elapsedFormatted).toBe('02:30:45');
  });

  it('formats remaining time correctly', () => {
    // 2 hours, 30 minutes, 45 seconds in → remaining = 13:29:15
    const now = new Date(
      new Date('2024-01-01T00:00:00.000Z').getTime() +
        2 * 3600000 +
        30 * 60000 +
        45 * 1000,
    );
    const state = computeProgress(baseSession, now);

    expect(state.remainingFormatted).toBe('13:29:15');
  });
});


describe('restoreSession', () => {
  it('returns null when no session exists in storage', async () => {
    const result = await restoreSession();
    expect(result).toBeNull();
  });

  it('returns the active session when endTime is in the future', async () => {
    const now = new Date();
    const futureEnd = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours from now

    const activeSession: FastingSession = {
      sessionId: 'restore-test-1',
      userId: 'guest',
      planId: 'plan-16-8',
      startTime: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
      endTime: futureEnd.toISOString(),
      actualEndTime: null,
      status: 'ACTIVE',
      durationFasted: null,
      timezoneOffsetMinutes: 0,
      createdAt: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
    };

    await AsyncStorage.setItem(
      STORAGE_KEYS.ACTIVE_SESSION,
      JSON.stringify(activeSession),
    );

    const result = await restoreSession();
    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe('restore-test-1');
    expect(result!.status).toBe('ACTIVE');
  });

  it('marks session as COMPLETED when endTime is in the past', async () => {
    const pastStart = new Date('2024-01-01T00:00:00.000Z');
    const pastEnd = new Date('2024-01-01T16:00:00.000Z');

    const expiredSession: FastingSession = {
      sessionId: 'restore-test-2',
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

    const result = await restoreSession();
    expect(result).not.toBeNull();
    expect(result!.status).toBe('COMPLETED');
    expect(result!.durationFasted).toBe(16 * 60 * 60); // 16 hours in seconds
  });

  it('clears active session key after completing an expired session', async () => {
    const pastStart = new Date('2024-01-01T00:00:00.000Z');
    const pastEnd = new Date('2024-01-01T16:00:00.000Z');

    const expiredSession: FastingSession = {
      sessionId: 'restore-test-3',
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

    await restoreSession();

    // Active session should be cleared
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    expect(raw).toBeNull();
  });

  it('returns null for a non-ACTIVE session in storage', async () => {
    const completedSession: FastingSession = {
      sessionId: 'restore-test-4',
      userId: 'guest',
      planId: 'plan-16-8',
      startTime: '2024-01-01T00:00:00.000Z',
      endTime: '2024-01-01T16:00:00.000Z',
      actualEndTime: null,
      status: 'COMPLETED',
      durationFasted: 57600,
      timezoneOffsetMinutes: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T16:00:00.000Z',
    };

    await AsyncStorage.setItem(
      STORAGE_KEYS.ACTIVE_SESSION,
      JSON.stringify(completedSession),
    );

    const result = await restoreSession();
    expect(result).toBeNull();
  });

  it('uses system clock for time calculations (Requirement 6.4)', async () => {
    // Create a session that started 15 hours ago with 16-hour duration
    const now = new Date();
    const startTime = new Date(now.getTime() - 15 * 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 16 * 60 * 60 * 1000);

    const session: FastingSession = {
      sessionId: 'restore-test-5',
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

    const result = await restoreSession();
    // endTime is 1 hour in the future, so session should still be ACTIVE
    expect(result).not.toBeNull();
    expect(result!.status).toBe('ACTIVE');
  });
});

describe('completeSession', () => {
  it('marks session as COMPLETED with correct durationFasted', async () => {
    const session: FastingSession = {
      sessionId: 'complete-test-1',
      userId: 'guest',
      planId: 'plan-16-8',
      startTime: '2024-01-01T00:00:00.000Z',
      endTime: '2024-01-01T16:00:00.000Z',
      actualEndTime: null,
      status: 'ACTIVE',
      durationFasted: null,
      timezoneOffsetMinutes: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const completed = await completeSession(session);

    expect(completed.status).toBe('COMPLETED');
    expect(completed.durationFasted).toBe(16 * 60 * 60); // 57600 seconds
  });

  it('sets updatedAt to current time', async () => {
    const session: FastingSession = {
      sessionId: 'complete-test-2',
      userId: 'guest',
      planId: 'plan-16-8',
      startTime: '2024-01-01T00:00:00.000Z',
      endTime: '2024-01-01T16:00:00.000Z',
      actualEndTime: null,
      status: 'ACTIVE',
      durationFasted: null,
      timezoneOffsetMinutes: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const before = Date.now();
    const completed = await completeSession(session);
    const after = Date.now();

    const updatedMs = new Date(completed.updatedAt).getTime();
    expect(updatedMs).toBeGreaterThanOrEqual(before);
    expect(updatedMs).toBeLessThanOrEqual(after);
  });

  it('persists the completed session to AsyncStorage', async () => {
    const session: FastingSession = {
      sessionId: 'complete-test-3',
      userId: 'guest',
      planId: 'plan-16-8',
      startTime: '2024-01-01T00:00:00.000Z',
      endTime: '2024-01-01T16:00:00.000Z',
      actualEndTime: null,
      status: 'ACTIVE',
      durationFasted: null,
      timezoneOffsetMinutes: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    await completeSession(session);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.ACTIVE_SESSION,
      expect.any(String),
    );
  });

  it('computes durationFasted as endTime - startTime in seconds', async () => {
    // 12-hour fast
    const session: FastingSession = {
      sessionId: 'complete-test-4',
      userId: 'guest',
      planId: 'plan-12-12',
      startTime: '2024-01-01T06:00:00.000Z',
      endTime: '2024-01-01T18:00:00.000Z',
      actualEndTime: null,
      status: 'ACTIVE',
      durationFasted: null,
      timezoneOffsetMinutes: 0,
      createdAt: '2024-01-01T06:00:00.000Z',
      updatedAt: '2024-01-01T06:00:00.000Z',
    };

    const completed = await completeSession(session);
    expect(completed.durationFasted).toBe(12 * 60 * 60); // 43200 seconds
  });
});
