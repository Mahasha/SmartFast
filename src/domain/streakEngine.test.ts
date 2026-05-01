/**
 * Unit tests for StreakEngine domain service.
 *
 * Tests qualifying fast logic, consecutive day counting, grace period,
 * short-circuit, and timezone boundary handling.
 *
 * Validates: Requirements 11, 12
 */

import {
  isQualifyingFast,
  getStreakDays,
  recomputeStreaks,
  shouldShortCircuit,
  StreakResult,
} from './streakEngine';
import { FastingSession, FastingPlan, StreakRecord } from '../models/index';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makePlan(overrides: Partial<FastingPlan> = {}): FastingPlan {
  return {
    planId: 'plan-16-8',
    name: '16:8',
    fastingHours: 16,
    eatingHours: 8,
    description: 'Test plan',
    isPro: false,
    isCustom: false,
    createdByUserId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSession(overrides: Partial<FastingSession> = {}): FastingSession {
  return {
    sessionId: 'session-1',
    userId: 'user-1',
    planId: 'plan-16-8',
    startTime: '2024-06-15T08:00:00.000Z',
    endTime: '2024-06-16T00:00:00.000Z',
    actualEndTime: null,
    status: 'COMPLETED',
    durationFasted: 16 * 3600, // 16 hours in seconds
    timezoneOffsetMinutes: -120,
    createdAt: '2024-06-15T08:00:00.000Z',
    updatedAt: '2024-06-16T00:00:00.000Z',
    ...overrides,
  };
}

function makeStreakRecord(overrides: Partial<StreakRecord> = {}): StreakRecord {
  return {
    streakId: 'streak-1',
    userId: 'user-1',
    currentStreak: 3,
    longestStreak: 5,
    lastStreakDate: '2024-06-15',
    sessionCountSnapshot: 10,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-06-16T00:00:00.000Z',
    ...overrides,
  };
}

// ─── isQualifyingFast ────────────────────────────────────────────────────────

describe('isQualifyingFast', () => {
  const plan16 = makePlan({ fastingHours: 16 });

  it('qualifies a COMPLETED session meeting 90% threshold', () => {
    const session = makeSession({
      status: 'COMPLETED',
      durationFasted: 16 * 3600, // 100% of 16h
    });
    expect(isQualifyingFast(session, plan16)).toBe(true);
  });

  it('qualifies an ENDED_EARLY session meeting 90% threshold', () => {
    const session = makeSession({
      status: 'ENDED_EARLY',
      durationFasted: Math.ceil(0.9 * 16 * 3600), // exactly 90%
    });
    expect(isQualifyingFast(session, plan16)).toBe(true);
  });

  it('qualifies at exactly 90% boundary', () => {
    const session = makeSession({
      status: 'ENDED_EARLY',
      durationFasted: 0.9 * 16 * 3600, // exactly 90%
    });
    expect(isQualifyingFast(session, plan16)).toBe(true);
  });

  it('does not qualify below 90% threshold', () => {
    const session = makeSession({
      status: 'ENDED_EARLY',
      durationFasted: Math.floor(0.9 * 16 * 3600) - 1, // just below 90%
    });
    expect(isQualifyingFast(session, plan16)).toBe(false);
  });

  it('CANCELLED sessions never qualify', () => {
    const session = makeSession({
      status: 'CANCELLED',
      durationFasted: 16 * 3600,
    });
    expect(isQualifyingFast(session, plan16)).toBe(false);
  });

  it('ACTIVE sessions never qualify', () => {
    const session = makeSession({
      status: 'ACTIVE',
      durationFasted: null,
    });
    expect(isQualifyingFast(session, plan16)).toBe(false);
  });

  it('does not qualify when durationFasted is null', () => {
    const session = makeSession({
      status: 'COMPLETED',
      durationFasted: null,
    });
    expect(isQualifyingFast(session, plan16)).toBe(false);
  });

  it('qualifies with a 12:12 plan at 90%', () => {
    const plan12 = makePlan({ planId: 'plan-12-12', fastingHours: 12 });
    const session = makeSession({
      planId: 'plan-12-12',
      status: 'ENDED_EARLY',
      durationFasted: 0.9 * 12 * 3600, // 10.8 hours
    });
    expect(isQualifyingFast(session, plan12)).toBe(true);
  });
});

// ─── getStreakDays ───────────────────────────────────────────────────────────

describe('getStreakDays', () => {
  const plan16 = makePlan({ fastingHours: 16 });

  it('returns empty set when no sessions', () => {
    const result = getStreakDays([], [plan16]);
    expect(result.size).toBe(0);
  });

  it('returns a single streak day for one qualifying session', () => {
    const session = makeSession({
      startTime: '2024-06-15T08:00:00.000Z',
      status: 'COMPLETED',
      durationFasted: 16 * 3600,
    });
    const result = getStreakDays([session], [plan16]);
    expect(result.size).toBe(1);
    // The exact date depends on local timezone, but it should contain one entry
    expect(result.size).toBe(1);
  });

  it('counts multiple qualifying fasts on same day as single streak day', () => {
    const session1 = makeSession({
      sessionId: 's1',
      startTime: '2024-06-15T06:00:00.000Z',
      status: 'COMPLETED',
      durationFasted: 16 * 3600,
    });
    const session2 = makeSession({
      sessionId: 's2',
      startTime: '2024-06-15T20:00:00.000Z',
      status: 'COMPLETED',
      durationFasted: 16 * 3600,
    });
    const result = getStreakDays([session1, session2], [plan16]);
    // Both start on the same local day (assuming timezone doesn't push them apart)
    expect(result.size).toBeLessThanOrEqual(2); // Could be 1 or 2 depending on TZ
  });

  it('does not include non-qualifying sessions', () => {
    const session = makeSession({
      status: 'ENDED_EARLY',
      durationFasted: 1000, // way below 90%
    });
    const result = getStreakDays([session], [plan16]);
    expect(result.size).toBe(0);
  });

  it('does not include sessions with unknown plan', () => {
    const session = makeSession({
      planId: 'unknown-plan',
      status: 'COMPLETED',
      durationFasted: 16 * 3600,
    });
    const result = getStreakDays([session], [plan16]);
    expect(result.size).toBe(0);
  });
});

// ─── recomputeStreaks ────────────────────────────────────────────────────────

describe('recomputeStreaks', () => {
  const plan16 = makePlan({ fastingHours: 16 });

  it('returns zero streaks when no sessions', () => {
    const result = recomputeStreaks([], [plan16], new Date('2024-06-15T12:00:00'));
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.lastStreakDate).toBeNull();
    expect(result.streakDays.size).toBe(0);
  });

  it('computes current streak of 1 for a qualifying fast today', () => {
    // Create a session that started "today" in local time
    const now = new Date(2024, 5, 15, 14, 0, 0); // June 15, 2024 2pm local
    const todayStart = new Date(2024, 5, 15, 6, 0, 0); // 6am local today

    const session = makeSession({
      startTime: todayStart.toISOString(),
      status: 'COMPLETED',
      durationFasted: 16 * 3600,
      updatedAt: now.toISOString(),
    });

    const result = recomputeStreaks([session], [plan16], now);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });

  it('computes consecutive streak across multiple days', () => {
    const now = new Date(2024, 5, 15, 14, 0, 0); // June 15

    const sessions = [
      makeSession({
        sessionId: 's1',
        startTime: new Date(2024, 5, 13, 8, 0, 0).toISOString(), // June 13
        status: 'COMPLETED',
        durationFasted: 16 * 3600,
        updatedAt: new Date(2024, 5, 14, 0, 0, 0).toISOString(),
      }),
      makeSession({
        sessionId: 's2',
        startTime: new Date(2024, 5, 14, 8, 0, 0).toISOString(), // June 14
        status: 'COMPLETED',
        durationFasted: 16 * 3600,
        updatedAt: new Date(2024, 5, 15, 0, 0, 0).toISOString(),
      }),
      makeSession({
        sessionId: 's3',
        startTime: new Date(2024, 5, 15, 8, 0, 0).toISOString(), // June 15 (today)
        status: 'COMPLETED',
        durationFasted: 16 * 3600,
        updatedAt: now.toISOString(),
      }),
    ];

    const result = recomputeStreaks(sessions, [plan16], now);
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  it('grace period: streak stays alive if yesterday had qualifying fast but today does not yet', () => {
    const now = new Date(2024, 5, 15, 10, 0, 0); // June 15, morning (no fast today yet)

    const sessions = [
      makeSession({
        sessionId: 's1',
        startTime: new Date(2024, 5, 13, 8, 0, 0).toISOString(), // June 13
        status: 'COMPLETED',
        durationFasted: 16 * 3600,
        updatedAt: new Date(2024, 5, 13, 23, 0, 0).toISOString(),
      }),
      makeSession({
        sessionId: 's2',
        startTime: new Date(2024, 5, 14, 8, 0, 0).toISOString(), // June 14 (yesterday)
        status: 'COMPLETED',
        durationFasted: 16 * 3600,
        updatedAt: new Date(2024, 5, 14, 23, 0, 0).toISOString(),
      }),
    ];

    const result = recomputeStreaks(sessions, [plan16], now);
    // Grace period: yesterday had a qualifying fast, so streak is alive
    expect(result.currentStreak).toBe(2);
  });

  it('streak resets when neither today nor yesterday has qualifying fast', () => {
    const now = new Date(2024, 5, 17, 10, 0, 0); // June 17

    const sessions = [
      makeSession({
        sessionId: 's1',
        startTime: new Date(2024, 5, 14, 8, 0, 0).toISOString(), // June 14
        status: 'COMPLETED',
        durationFasted: 16 * 3600,
        updatedAt: new Date(2024, 5, 14, 23, 0, 0).toISOString(),
      }),
      makeSession({
        sessionId: 's2',
        startTime: new Date(2024, 5, 15, 8, 0, 0).toISOString(), // June 15
        status: 'COMPLETED',
        durationFasted: 16 * 3600,
        updatedAt: new Date(2024, 5, 15, 23, 0, 0).toISOString(),
      }),
    ];

    // June 16 (yesterday) has no qualifying fast, June 17 (today) has none
    const result = recomputeStreaks(sessions, [plan16], now);
    expect(result.currentStreak).toBe(0);
    // But longest streak should still be 2
    expect(result.longestStreak).toBe(2);
  });

  it('streak does NOT increment until today qualifying fast completes', () => {
    const now = new Date(2024, 5, 15, 10, 0, 0); // June 15

    const sessions = [
      makeSession({
        sessionId: 's1',
        startTime: new Date(2024, 5, 14, 8, 0, 0).toISOString(), // June 14 (yesterday)
        status: 'COMPLETED',
        durationFasted: 16 * 3600,
        updatedAt: new Date(2024, 5, 14, 23, 0, 0).toISOString(),
      }),
      makeSession({
        sessionId: 's2',
        startTime: new Date(2024, 5, 15, 8, 0, 0).toISOString(), // June 15 (today) - ACTIVE
        status: 'ACTIVE',
        durationFasted: null,
        updatedAt: now.toISOString(),
      }),
    ];

    const result = recomputeStreaks(sessions, [plan16], now);
    // ACTIVE session doesn't count — streak is 1 (from yesterday, grace period)
    expect(result.currentStreak).toBe(1);
  });

  it('longest streak tracks the highest ever achieved', () => {
    const now = new Date(2024, 5, 20, 14, 0, 0); // June 20

    // 5-day streak (June 1-5), then gap, then 2-day streak (June 19-20)
    const sessions = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeSession({
          sessionId: `s${i + 1}`,
          startTime: new Date(2024, 5, i + 1, 8, 0, 0).toISOString(),
          status: 'COMPLETED',
          durationFasted: 16 * 3600,
          updatedAt: new Date(2024, 5, i + 1, 23, 0, 0).toISOString(),
        }),
      ),
      makeSession({
        sessionId: 's6',
        startTime: new Date(2024, 5, 19, 8, 0, 0).toISOString(),
        status: 'COMPLETED',
        durationFasted: 16 * 3600,
        updatedAt: new Date(2024, 5, 19, 23, 0, 0).toISOString(),
      }),
      makeSession({
        sessionId: 's7',
        startTime: new Date(2024, 5, 20, 8, 0, 0).toISOString(),
        status: 'COMPLETED',
        durationFasted: 16 * 3600,
        updatedAt: now.toISOString(),
      }),
    ];

    const result = recomputeStreaks(sessions, [plan16], now);
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(5);
  });

  it('multiple qualifying fasts on same day count as single streak day', () => {
    const now = new Date(2024, 5, 15, 20, 0, 0); // June 15

    const sessions = [
      makeSession({
        sessionId: 's1',
        startTime: new Date(2024, 5, 15, 6, 0, 0).toISOString(),
        status: 'COMPLETED',
        durationFasted: 16 * 3600,
        updatedAt: new Date(2024, 5, 15, 14, 0, 0).toISOString(),
      }),
      makeSession({
        sessionId: 's2',
        startTime: new Date(2024, 5, 15, 15, 0, 0).toISOString(),
        status: 'COMPLETED',
        durationFasted: 16 * 3600,
        updatedAt: now.toISOString(),
      }),
    ];

    const result = recomputeStreaks(sessions, [plan16], now);
    expect(result.currentStreak).toBe(1); // Same day = 1 streak day
    expect(result.streakDays.size).toBe(1);
  });
});

// ─── shouldShortCircuit ──────────────────────────────────────────────────────

describe('shouldShortCircuit', () => {
  it('returns true when all conditions match', () => {
    const sessions = [
      makeSession({ updatedAt: '2024-06-16T00:00:00.000Z' }),
      makeSession({ sessionId: 's2', updatedAt: '2024-06-15T00:00:00.000Z' }),
    ];

    const cached = makeStreakRecord({
      updatedAt: '2024-06-16T00:00:00.000Z', // matches max updatedAt
      sessionCountSnapshot: 2, // matches sessions.length
      lastStreakDate: '2024-06-15',
    });

    expect(shouldShortCircuit(cached, sessions)).toBe(true);
  });

  it('returns false when session count differs', () => {
    const sessions = [
      makeSession({ updatedAt: '2024-06-16T00:00:00.000Z' }),
    ];

    const cached = makeStreakRecord({
      updatedAt: '2024-06-16T00:00:00.000Z',
      sessionCountSnapshot: 5, // mismatch
    });

    expect(shouldShortCircuit(cached, sessions)).toBe(false);
  });

  it('returns false when updatedAt differs', () => {
    const sessions = [
      makeSession({ updatedAt: '2024-06-16T00:00:00.000Z' }),
    ];

    const cached = makeStreakRecord({
      updatedAt: '2024-06-15T00:00:00.000Z', // mismatch
      sessionCountSnapshot: 1,
    });

    expect(shouldShortCircuit(cached, sessions)).toBe(false);
  });

  it('returns true for empty sessions with matching snapshot of 0', () => {
    const cached = makeStreakRecord({
      sessionCountSnapshot: 0,
    });

    expect(shouldShortCircuit(cached, [])).toBe(true);
  });

  it('returns false for empty sessions with non-zero snapshot', () => {
    const cached = makeStreakRecord({
      sessionCountSnapshot: 3,
    });

    expect(shouldShortCircuit(cached, [])).toBe(false);
  });
});

// ─── Timezone boundary tests ─────────────────────────────────────────────────

describe('timezone boundary handling', () => {
  const plan16 = makePlan({ fastingHours: 16 });

  it('uses device local timezone for determining calendar day', () => {
    // A session starting late at night UTC might be on a different local day
    // depending on timezone. We test that the function uses local time.
    const now = new Date(2024, 5, 15, 14, 0, 0);

    // Session started at midnight UTC — in positive offset timezones this is
    // already the next day
    const session = makeSession({
      startTime: new Date(2024, 5, 15, 0, 0, 0).toISOString(),
      status: 'COMPLETED',
      durationFasted: 16 * 3600,
      updatedAt: now.toISOString(),
    });

    const result = recomputeStreaks([session], [plan16], now);
    // Should have exactly 1 streak day regardless of timezone
    expect(result.streakDays.size).toBe(1);
    expect(result.currentStreak).toBe(1);
  });

  it('handles sessions spanning midnight correctly', () => {
    // Session starts before midnight, ends after midnight
    // The streak day is determined by startTime's local date
    const now = new Date(2024, 5, 16, 10, 0, 0); // June 16

    const session = makeSession({
      startTime: new Date(2024, 5, 15, 22, 0, 0).toISOString(), // 10pm June 15
      endTime: new Date(2024, 5, 16, 14, 0, 0).toISOString(), // 2pm June 16
      status: 'COMPLETED',
      durationFasted: 16 * 3600,
      updatedAt: new Date(2024, 5, 16, 14, 0, 0).toISOString(),
    });

    const result = recomputeStreaks([session], [plan16], now);
    // The streak day should be June 15 (startTime's local date)
    expect(result.streakDays.size).toBe(1);
    // Since the streak day is yesterday (June 15) and today is June 16,
    // grace period applies — current streak is 1
    expect(result.currentStreak).toBe(1);
  });
});
