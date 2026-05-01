/**
 * Unit tests for Clock Integrity functions
 *
 * Tests backward drift detection, forward jump detection, normal progression,
 * and CLOCK_SUSPECT flag lifecycle.
 *
 * Validates: Requirements 6.5, 6.7, 6.8, 6.9, 6.10
 */

import {
  checkClockIntegrity,
  checkForwardClockJump,
  markClockSuspect,
  isClockSuspect,
  clearClockSuspect,
} from './fastingTimer';
import { FastingSession } from '../models/index';
import AsyncStorage from '@react-native-async-storage/async-storage';

const baseSession: FastingSession = {
  sessionId: 'clock-test-session',
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

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.clear as jest.Mock)();
});

describe('checkClockIntegrity - backward drift detection', () => {
  it('returns valid: true when current time is after last check time', () => {
    const lastCheck = new Date('2024-01-01T08:00:00.000Z');
    const now = new Date('2024-01-01T08:00:10.000Z'); // 10 seconds later

    const result = checkClockIntegrity(baseSession, now, lastCheck);

    expect(result).toEqual({ valid: true });
  });

  it('returns valid: true when current time equals last check time', () => {
    const lastCheck = new Date('2024-01-01T08:00:00.000Z');
    const now = new Date('2024-01-01T08:00:00.000Z');

    const result = checkClockIntegrity(baseSession, now, lastCheck);

    expect(result).toEqual({ valid: true });
  });

  it('returns valid: true when backward drift is within 60 seconds', () => {
    const lastCheck = new Date('2024-01-01T08:00:30.000Z');
    const now = new Date('2024-01-01T08:00:00.000Z'); // 30 seconds behind

    const result = checkClockIntegrity(baseSession, now, lastCheck);

    expect(result).toEqual({ valid: true });
  });

  it('returns valid: true when backward drift is exactly 60 seconds', () => {
    const lastCheck = new Date('2024-01-01T08:01:00.000Z');
    const now = new Date('2024-01-01T08:00:00.000Z'); // exactly 60 seconds behind

    const result = checkClockIntegrity(baseSession, now, lastCheck);

    expect(result).toEqual({ valid: true });
  });

  it('returns valid: false when backward drift exceeds 60 seconds', () => {
    const lastCheck = new Date('2024-01-01T08:02:00.000Z');
    const now = new Date('2024-01-01T08:00:00.000Z'); // 120 seconds behind

    const result = checkClockIntegrity(baseSession, now, lastCheck);

    expect(result).toEqual({ valid: false, driftSeconds: 120 });
  });

  it('returns correct driftSeconds for large backward drift', () => {
    const lastCheck = new Date('2024-01-01T10:00:00.000Z');
    const now = new Date('2024-01-01T08:00:00.000Z'); // 2 hours behind

    const result = checkClockIntegrity(baseSession, now, lastCheck);

    expect(result).toEqual({ valid: false, driftSeconds: 7200 });
  });

  it('returns valid: false when backward drift is just over 60 seconds', () => {
    const lastCheck = new Date('2024-01-01T08:01:01.000Z');
    const now = new Date('2024-01-01T08:00:00.000Z'); // 61 seconds behind

    const result = checkClockIntegrity(baseSession, now, lastCheck);

    expect(result).toEqual({ valid: false, driftSeconds: 61 });
  });
});

describe('checkForwardClockJump - forward jump detection', () => {
  it('returns suspicious: false for normal progression (10 seconds between checks)', () => {
    // Normal operation: last check at T+8h with 8h elapsed, now is 10s later
    const lastTimerCheckUtc = new Date('2024-01-01T08:00:00.000Z');
    const lastKnownElapsedMs = 8 * 60 * 60 * 1000; // 8 hours
    const now = new Date('2024-01-01T08:00:10.000Z'); // 10 seconds later

    const result = checkForwardClockJump(
      baseSession,
      now,
      lastTimerCheckUtc,
      lastKnownElapsedMs,
    );

    expect(result).toEqual({ suspicious: false });
  });

  it('returns suspicious: false for normal progression (5 minutes between checks)', () => {
    const lastTimerCheckUtc = new Date('2024-01-01T04:00:00.000Z');
    const lastKnownElapsedMs = 4 * 60 * 60 * 1000; // 4 hours
    const now = new Date('2024-01-01T04:05:00.000Z'); // 5 minutes later

    const result = checkForwardClockJump(
      baseSession,
      now,
      lastTimerCheckUtc,
      lastKnownElapsedMs,
    );

    expect(result).toEqual({ suspicious: false });
  });

  it('returns suspicious: false when values are consistent (no discrepancy)', () => {
    // lastKnownElapsedMs matches (lastTimerCheckUtc - startTime) exactly
    const lastTimerCheckUtc = new Date('2024-01-01T04:00:00.000Z');
    const lastKnownElapsedMs = 4 * 60 * 60 * 1000; // exactly 4h = lastCheck - start
    const now = new Date('2024-01-01T04:10:00.000Z'); // 10 minutes later

    const result = checkForwardClockJump(
      baseSession,
      now,
      lastTimerCheckUtc,
      lastKnownElapsedMs,
    );

    expect(result).toEqual({ suspicious: false });
  });

  it('returns suspicious: true when elapsed exceeds wall clock by more than 10 minutes', () => {
    // jumpMs = lastKnownElapsedMs - (lastTimerCheckUtc - startTime)
    // = (4h + 15min) - 4h = 15 min > 10 min threshold
    // This indicates a clock discrepancy where the timer recorded more elapsed
    // time than the wall clock shows between start and last check
    const lastTimerCheckUtc = new Date('2024-01-01T04:00:00.000Z'); // 4h after start
    const lastKnownElapsedMs = (4 * 60 + 15) * 60 * 1000; // 4h 15min in ms
    const now = new Date('2024-01-01T04:00:10.000Z'); // 10s after last check

    const result = checkForwardClockJump(
      baseSession,
      now,
      lastTimerCheckUtc,
      lastKnownElapsedMs,
    );

    expect(result.suspicious).toBe(true);
    if (result.suspicious) {
      expect(result.jumpMs).toBeGreaterThan(10 * 60 * 1000);
    }
  });

  it('returns suspicious: false when discrepancy is under 10 minutes', () => {
    // jumpMs = (4h + 5min) - 4h = 5 min < 10 min threshold
    const lastTimerCheckUtc = new Date('2024-01-01T04:00:00.000Z');
    const lastKnownElapsedMs = (4 * 60 + 5) * 60 * 1000; // 4h 5min
    const now = new Date('2024-01-01T04:00:10.000Z');

    const result = checkForwardClockJump(
      baseSession,
      now,
      lastTimerCheckUtc,
      lastKnownElapsedMs,
    );

    expect(result).toEqual({ suspicious: false });
  });

  it('returns the correct jumpMs value', () => {
    // jumpMs = lastKnownElapsedMs - (lastTimerCheckUtc - startTime) + (now - lastTimerCheckUtc) - (now - startTime - lastKnownElapsedMs)
    // Simplified: jumpMs = lastKnownElapsedMs - (lastTimerCheckUtc - startTime)
    // = (4h + 20min) - 4h = 20 min = 1,200,000 ms
    const lastTimerCheckUtc = new Date('2024-01-01T04:00:00.000Z');
    const lastKnownElapsedMs = (4 * 60 + 20) * 60 * 1000; // 4h 20min
    const now = new Date('2024-01-01T04:00:10.000Z');

    const result = checkForwardClockJump(
      baseSession,
      now,
      lastTimerCheckUtc,
      lastKnownElapsedMs,
    );

    expect(result.suspicious).toBe(true);
    if (result.suspicious) {
      expect(result.jumpMs).toBe(20 * 60 * 1000);
    }
  });

  it('returns suspicious: false when discrepancy is exactly 10 minutes', () => {
    // jumpMs = (4h + 10min) - 4h = 10 min = threshold (not exceeded)
    const lastTimerCheckUtc = new Date('2024-01-01T04:00:00.000Z');
    const lastKnownElapsedMs = (4 * 60 + 10) * 60 * 1000; // 4h 10min
    const now = new Date('2024-01-01T04:00:00.000Z'); // same as last check

    const result = checkForwardClockJump(
      baseSession,
      now,
      lastTimerCheckUtc,
      lastKnownElapsedMs,
    );

    expect(result).toEqual({ suspicious: false });
  });

  it('returns suspicious: true when discrepancy is just over 10 minutes', () => {
    // jumpMs = (4h + 10min + 1s) - 4h = 10min + 1s > 10 min threshold
    const lastTimerCheckUtc = new Date('2024-01-01T04:00:00.000Z');
    const lastKnownElapsedMs = 4 * 60 * 60 * 1000 + 10 * 60 * 1000 + 1000; // 4h 10min 1s
    const now = new Date('2024-01-01T04:00:00.000Z');

    const result = checkForwardClockJump(
      baseSession,
      now,
      lastTimerCheckUtc,
      lastKnownElapsedMs,
    );

    expect(result.suspicious).toBe(true);
    if (result.suspicious) {
      expect(result.jumpMs).toBe(10 * 60 * 1000 + 1000); // 10min + 1s
    }
  });
});

describe('CLOCK_SUSPECT flag lifecycle', () => {
  const sessionId = 'suspect-test-session';

  it('isClockSuspect returns false when no flag is set', async () => {
    const result = await isClockSuspect(sessionId);
    expect(result).toBe(false);
  });

  it('markClockSuspect sets the flag', async () => {
    await markClockSuspect(sessionId);
    const result = await isClockSuspect(sessionId);
    expect(result).toBe(true);
  });

  it('stores flag at the correct AsyncStorage key', async () => {
    await markClockSuspect(sessionId);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      `@fasttrack:clockSuspect:${sessionId}`,
      JSON.stringify(true),
    );
  });

  it('clearClockSuspect removes the flag', async () => {
    await markClockSuspect(sessionId);
    expect(await isClockSuspect(sessionId)).toBe(true);

    await clearClockSuspect(sessionId);
    expect(await isClockSuspect(sessionId)).toBe(false);
  });

  it('clearClockSuspect calls removeItem with correct key', async () => {
    await markClockSuspect(sessionId);
    await clearClockSuspect(sessionId);

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      `@fasttrack:clockSuspect:${sessionId}`,
    );
  });

  it('different sessions have independent CLOCK_SUSPECT flags', async () => {
    const sessionA = 'session-a';
    const sessionB = 'session-b';

    await markClockSuspect(sessionA);

    expect(await isClockSuspect(sessionA)).toBe(true);
    expect(await isClockSuspect(sessionB)).toBe(false);
  });

  it('marking suspect multiple times is idempotent', async () => {
    await markClockSuspect(sessionId);
    await markClockSuspect(sessionId);

    expect(await isClockSuspect(sessionId)).toBe(true);
  });

  it('clearing a non-existent flag does not throw', async () => {
    await expect(clearClockSuspect('non-existent')).resolves.not.toThrow();
  });
});
