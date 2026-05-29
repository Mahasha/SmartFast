/**
 * Unit tests for FastingTimer domain service (open-ended / overtime model).
 *
 * Fasting is never auto-completed at its goal: the session stays ACTIVE and
 * counts up in overtime until the user explicitly ends it.
 *
 * Validates: Requirements 4.1, 4.2, 4.4, 4.5, 5.1, 5.2, 5.4, 5.5,
 *            7.2, 7.3, 7.5
 */

import {
  startFast,
  endFast,
  cancelFast,
  getActiveSession,
  computeProgress,
  restoreSession,
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

/** Builds a stored ACTIVE session with explicit start/end (UTC ISO). */
function makeActiveSession(overrides: Partial<FastingSession> = {}): FastingSession {
  return {
    sessionId: 'test-session',
    userId: 'guest',
    planId: 'plan-16-8',
    startTime: '2024-01-01T00:00:00.000Z',
    endTime: '2024-01-01T16:00:00.000Z',
    actualEndTime: null,
    status: 'ACTIVE',
    durationFasted: null,
    goalReachedAt: null,
    completedAt: null,
    timezoneOffsetMinutes: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

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
    expect(session.goalReachedAt).toBeNull();
    expect(session.completedAt).toBeNull();

    const startMs = new Date(session.startTime).getTime();
    const endMs = new Date(session.endTime).getTime();

    expect(startMs).toBeGreaterThanOrEqual(before);
    expect(startMs).toBeLessThanOrEqual(after);
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

    expect(session.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    expect(session.endTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
  });
});

describe('endFast', () => {
  it('ends a pre-goal session with ENDED_EARLY status', async () => {
    await startFast(mockPlan); // 16h plan, ended immediately → before goal
    const ended = await endFast();

    expect(ended.status).toBe('ENDED_EARLY');
    expect(ended.actualEndTime).not.toBeNull();
    expect(ended.completedAt).toBe(ended.actualEndTime);
    expect(ended.goalReachedAt).toBeNull();
    expect(ended.durationFasted).toBeGreaterThanOrEqual(0);
  });

  it('marks the session COMPLETED when ended in overtime (goal reached)', async () => {
    // Stored ACTIVE session whose goal is already in the past.
    const start = new Date(Date.now() - 21 * 60 * 60 * 1000); // 21h ago
    const end = new Date(Date.now() - 1 * 60 * 60 * 1000); //  goal 1h ago
    await AsyncStorage.setItem(
      STORAGE_KEYS.ACTIVE_SESSION,
      JSON.stringify(
        makeActiveSession({
          sessionId: 'overtime-end',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        }),
      ),
    );

    const ended = await endFast();

    expect(ended.status).toBe('COMPLETED');
    expect(ended.goalReachedAt).toBe(end.toISOString());
    // durationFasted is the ACTUAL elapsed (~21h), not the planned 20h.
    expect(ended.durationFasted).toBeGreaterThanOrEqual(20 * 60 * 60);
  });

  it('computes durationFasted as actual seconds fasted', async () => {
    const session = await startFast(mockPlan);
    const ended = await endFast();

    const startMs = new Date(session.startTime).getTime();
    const endMs = new Date(ended.actualEndTime!).getTime();
    const expectedSeconds = Math.round((endMs - startMs) / 1000);

    expect(ended.durationFasted).toBe(expectedSeconds);
  });

  it('clears the active session from storage', async () => {
    await startFast(mockPlan);
    await endFast();

    expect(await getActiveSession()).toBeNull();
  });

  it('throws if no active session exists', async () => {
    await expect(endFast()).rejects.toThrow('No active fasting session to end.');
  });
});

describe('cancelFast', () => {
  it('cancels an active session with CANCELLED status', async () => {
    await startFast(mockPlan);
    const cancelled = await cancelFast();

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.actualEndTime).not.toBeNull();
    expect(cancelled.goalReachedAt).toBeNull();
    expect(cancelled.durationFasted).toBeGreaterThanOrEqual(0);
  });

  it('clears the active session from storage', async () => {
    await startFast(mockPlan);
    await cancelFast();

    expect(await getActiveSession()).toBeNull();
  });

  it('throws if no active session exists', async () => {
    await expect(cancelFast()).rejects.toThrow('No active fasting session to cancel.');
  });
});

describe('getActiveSession', () => {
  it('returns null when no session exists', async () => {
    expect(await getActiveSession()).toBeNull();
  });

  it('returns the active session when one exists', async () => {
    const created = await startFast(mockPlan);
    const retrieved = await getActiveSession();

    expect(retrieved).not.toBeNull();
    expect(retrieved!.sessionId).toBe(created.sessionId);
  });

  it('returns null if stored session is not ACTIVE', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.ACTIVE_SESSION,
      JSON.stringify(makeActiveSession({ status: 'COMPLETED', durationFasted: 57600 })),
    );

    expect(await getActiveSession()).toBeNull();
  });
});

describe('computeProgress', () => {
  const baseSession = makeActiveSession();

  it('computes correct progress at the start', () => {
    const state = computeProgress(baseSession, new Date('2024-01-01T00:00:00.000Z'));

    expect(state.totalElapsedMs).toBe(0);
    expect(state.remainingMs).toBe(16 * 60 * 60 * 1000);
    expect(state.overtimeMs).toBe(0);
    expect(state.progressPercent).toBe(0);
    expect(state.isGoalReached).toBe(false);
    expect(state.phase).toBe('COUNTDOWN');
    expect(state.totalElapsedFormatted).toBe('00:00:00');
    expect(state.remainingFormatted).toBe('16:00:00');
  });

  it('computes correct progress at the midpoint', () => {
    const state = computeProgress(baseSession, new Date('2024-01-01T08:00:00.000Z'));

    expect(state.totalElapsedMs).toBe(8 * 60 * 60 * 1000);
    expect(state.remainingMs).toBe(8 * 60 * 60 * 1000);
    expect(state.progressPercent).toBe(50);
    expect(state.isGoalReached).toBe(false);
    expect(state.phase).toBe('COUNTDOWN');
  });

  it('enters GOAL_REACHED exactly at the goal (no auto-complete)', () => {
    const state = computeProgress(baseSession, new Date('2024-01-01T16:00:00.000Z'));

    expect(state.remainingMs).toBe(0);
    expect(state.overtimeMs).toBe(0);
    expect(state.progressPercent).toBe(100);
    expect(state.isGoalReached).toBe(true);
    expect(state.phase).toBe('GOAL_REACHED');
    expect(state.remainingFormatted).toBe('00:00:00');
  });

  it('counts up in OVERTIME past the goal, capping progress at 100%', () => {
    const state = computeProgress(baseSession, new Date('2024-01-01T18:00:00.000Z')); // +2h

    expect(state.remainingMs).toBe(0);
    expect(state.overtimeMs).toBe(2 * 60 * 60 * 1000);
    expect(state.totalElapsedMs).toBe(18 * 60 * 60 * 1000);
    expect(state.progressPercent).toBe(100); // never exceeds the goal visually
    expect(state.isGoalReached).toBe(true);
    expect(state.phase).toBe('OVERTIME');
    expect(state.overtimeFormatted).toBe('02:00:00');
    expect(state.totalElapsedFormatted).toBe('18:00:00');
  });

  it('reports COMPLETED phase for a terminal session', () => {
    const terminal = makeActiveSession({ status: 'COMPLETED', durationFasted: 57600 });
    const state = computeProgress(terminal, new Date('2024-01-01T16:00:00.000Z'));

    expect(state.phase).toBe('COMPLETED');
  });

  it('clamps elapsed/progress to 0 when now is before startTime', () => {
    const state = computeProgress(baseSession, new Date('2023-12-31T23:00:00.000Z'));

    expect(state.totalElapsedMs).toBe(0);
    expect(state.progressPercent).toBe(0);
    expect(state.remainingMs).toBe(17 * 60 * 60 * 1000);
  });

  it('formats total elapsed time with hours, minutes, seconds', () => {
    const now = new Date(
      new Date('2024-01-01T00:00:00.000Z').getTime() + 2 * 3600000 + 30 * 60000 + 45 * 1000,
    );
    const state = computeProgress(baseSession, now);

    expect(state.totalElapsedFormatted).toBe('02:30:45');
  });

  it('formats remaining time correctly', () => {
    const now = new Date(
      new Date('2024-01-01T00:00:00.000Z').getTime() + 2 * 3600000 + 30 * 60000 + 45 * 1000,
    );
    const state = computeProgress(baseSession, now);

    expect(state.remainingFormatted).toBe('13:29:15');
  });

  it('handles very long overtime (48h+) without overflow', () => {
    const state = computeProgress(baseSession, new Date('2024-01-03T16:00:00.000Z')); // +48h
    expect(state.overtimeMs).toBe(48 * 60 * 60 * 1000);
    expect(state.totalElapsedMs).toBe(64 * 60 * 60 * 1000);
    expect(state.phase).toBe('OVERTIME');
    expect(state.overtimeFormatted).toBe('48:00:00');
  });
});

describe('restoreSession', () => {
  it('returns null when no session exists in storage', async () => {
    expect(await restoreSession()).toBeNull();
  });

  it('returns the active session when endTime is in the future', async () => {
    const now = new Date();
    await AsyncStorage.setItem(
      STORAGE_KEYS.ACTIVE_SESSION,
      JSON.stringify(
        makeActiveSession({
          sessionId: 'restore-test-1',
          startTime: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(),
        }),
      ),
    );

    const result = await restoreSession();
    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe('restore-test-1');
    expect(result!.status).toBe('ACTIVE');
  });

  it('keeps the session ACTIVE (overtime) even when endTime is in the past', async () => {
    const pastStart = new Date('2024-01-01T00:00:00.000Z');
    const pastEnd = new Date('2024-01-01T16:00:00.000Z');
    await AsyncStorage.setItem(
      STORAGE_KEYS.ACTIVE_SESSION,
      JSON.stringify(
        makeActiveSession({
          sessionId: 'restore-overtime',
          startTime: pastStart.toISOString(),
          endTime: pastEnd.toISOString(),
        }),
      ),
    );

    const result = await restoreSession();
    expect(result).not.toBeNull();
    expect(result!.status).toBe('ACTIVE'); // resumes in overtime, not completed
    expect(result!.sessionId).toBe('restore-overtime');
  });

  it('does not clear the active session key on restore', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.ACTIVE_SESSION,
      JSON.stringify(
        makeActiveSession({
          startTime: '2024-01-01T00:00:00.000Z',
          endTime: '2024-01-01T16:00:00.000Z',
        }),
      ),
    );

    await restoreSession();

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    expect(raw).not.toBeNull();
  });

  it('returns null for a non-ACTIVE session in storage', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.ACTIVE_SESSION,
      JSON.stringify(makeActiveSession({ status: 'COMPLETED', durationFasted: 57600 })),
    );

    expect(await restoreSession()).toBeNull();
  });
});
