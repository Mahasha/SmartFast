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
  const lastCheck = new Date('2024-01-01T04:00:00.000Z');

  it('accepts wall and monotonic clocks advancing together', () => {
    expect(checkForwardClockJump(new Date('2024-01-01T04:05:00.000Z'), lastCheck, 5 * 60 * 1000))
      .toEqual({ suspicious: false });
  });

  it('detects a fifteen-minute wall-clock jump after ten seconds elapsed', () => {
    expect(checkForwardClockJump(new Date('2024-01-01T04:15:10.000Z'), lastCheck, 10_000))
      .toEqual({ suspicious: true, jumpMs: 15 * 60 * 1000 });
  });

  it('does not flag a ten-minute difference at the threshold', () => {
    expect(checkForwardClockJump(new Date('2024-01-01T04:10:10.000Z'), lastCheck, 10_000))
      .toEqual({ suspicious: false });
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
