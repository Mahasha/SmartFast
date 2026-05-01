import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  persistTimerTick,
  getLastTimerCheck,
  clearTimerTick,
  shouldPersistTick,
} from './timerTickPersistence';
import { FastingSession } from '../models/index';
import { STORAGE_KEYS } from '../utils/constants';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

function makeSession(overrides: Partial<FastingSession> = {}): FastingSession {
  return {
    sessionId: 'session-1',
    userId: 'guest',
    planId: 'plan-16-8',
    startTime: '2024-01-15T08:00:00.000Z',
    endTime: '2024-01-16T00:00:00.000Z',
    actualEndTime: null,
    status: 'ACTIVE',
    durationFasted: null,
    timezoneOffsetMinutes: -120,
    createdAt: '2024-01-15T08:00:00.000Z',
    updatedAt: '2024-01-15T08:00:00.000Z',
    ...overrides,
  };
}

describe('timerTickPersistence', () => {
  describe('persistTimerTick', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('stores lastTimerCheckUtc as current UTC ISO string', async () => {
      const fixedNow = new Date('2024-01-15T09:00:00.000Z');
      const OriginalDate = global.Date;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).Date = Object.assign(
        function (...args: unknown[]) {
          if (args.length === 0) return fixedNow;
          return new OriginalDate(...(args as [string]));
        },
        { now: OriginalDate.now, parse: OriginalDate.parse, UTC: OriginalDate.UTC, prototype: OriginalDate.prototype },
      );

      const session = makeSession();
      await persistTimerTick(session);

      const raw = await AsyncStorage.getItem(STORAGE_KEYS.LAST_TIMER_CHECK_UTC);
      expect(JSON.parse(raw!)).toBe('2024-01-15T09:00:00.000Z');

      global.Date = OriginalDate;
    });

    it('stores lastKnownElapsedMs as elapsed milliseconds since startTime', async () => {
      const fixedNow = new Date('2024-01-15T09:00:00.000Z');
      const OriginalDate = global.Date;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).Date = Object.assign(
        function (...args: unknown[]) {
          if (args.length === 0) return fixedNow;
          return new OriginalDate(...(args as [string]));
        },
        { now: OriginalDate.now, parse: OriginalDate.parse, UTC: OriginalDate.UTC, prototype: OriginalDate.prototype },
      );

      const session = makeSession({ startTime: '2024-01-15T08:00:00.000Z' });
      await persistTimerTick(session);

      const raw = await AsyncStorage.getItem(STORAGE_KEYS.LAST_KNOWN_ELAPSED_MS);
      // 1 hour = 3,600,000 ms
      expect(JSON.parse(raw!)).toBe(3_600_000);

      global.Date = OriginalDate;
    });

    it('computes elapsed correctly for a session started 30 minutes ago', async () => {
      const fixedNow = new Date('2024-01-15T08:30:00.000Z');
      const OriginalDate = global.Date;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).Date = Object.assign(
        function (...args: unknown[]) {
          if (args.length === 0) return fixedNow;
          return new OriginalDate(...(args as [string]));
        },
        { now: OriginalDate.now, parse: OriginalDate.parse, UTC: OriginalDate.UTC, prototype: OriginalDate.prototype },
      );

      const session = makeSession({ startTime: '2024-01-15T08:00:00.000Z' });
      await persistTimerTick(session);

      const raw = await AsyncStorage.getItem(STORAGE_KEYS.LAST_KNOWN_ELAPSED_MS);
      // 30 minutes = 1,800,000 ms
      expect(JSON.parse(raw!)).toBe(1_800_000);

      global.Date = OriginalDate;
    });
  });

  describe('getLastTimerCheck', () => {
    it('returns null when no data is stored', async () => {
      const result = await getLastTimerCheck();
      expect(result).toBeNull();
    });

    it('returns null when only lastTimerCheckUtc is stored', async () => {
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_TIMER_CHECK_UTC,
        JSON.stringify('2024-01-15T09:00:00.000Z'),
      );
      const result = await getLastTimerCheck();
      expect(result).toBeNull();
    });

    it('returns null when only lastKnownElapsedMs is stored', async () => {
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_KNOWN_ELAPSED_MS,
        JSON.stringify(3_600_000),
      );
      const result = await getLastTimerCheck();
      expect(result).toBeNull();
    });

    it('returns both values when both are stored', async () => {
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_TIMER_CHECK_UTC,
        JSON.stringify('2024-01-15T09:00:00.000Z'),
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_KNOWN_ELAPSED_MS,
        JSON.stringify(3_600_000),
      );

      const result = await getLastTimerCheck();
      expect(result).toEqual({
        lastTimerCheckUtc: '2024-01-15T09:00:00.000Z',
        lastKnownElapsedMs: 3_600_000,
      });
    });
  });

  describe('clearTimerTick', () => {
    it('removes both timer tick keys from storage', async () => {
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_TIMER_CHECK_UTC,
        JSON.stringify('2024-01-15T09:00:00.000Z'),
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_KNOWN_ELAPSED_MS,
        JSON.stringify(3_600_000),
      );

      await clearTimerTick();

      const utcRaw = await AsyncStorage.getItem(STORAGE_KEYS.LAST_TIMER_CHECK_UTC);
      const elapsedRaw = await AsyncStorage.getItem(STORAGE_KEYS.LAST_KNOWN_ELAPSED_MS);
      expect(utcRaw).toBeNull();
      expect(elapsedRaw).toBeNull();
    });

    it('does not throw when keys do not exist', async () => {
      await expect(clearTimerTick()).resolves.toBeUndefined();
    });
  });

  describe('shouldPersistTick', () => {
    const FIXED_NOW = 1_700_000_000_000; // a fixed timestamp

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('returns true when lastPersistTime is null', () => {
      expect(shouldPersistTick(null)).toBe(true);
    });

    it('returns true when at least 10 seconds have elapsed', () => {
      const tenSecondsAgo = FIXED_NOW - 10_000;
      expect(shouldPersistTick(tenSecondsAgo)).toBe(true);
    });

    it('returns true when more than 10 seconds have elapsed', () => {
      const fifteenSecondsAgo = FIXED_NOW - 15_000;
      expect(shouldPersistTick(fifteenSecondsAgo)).toBe(true);
    });

    it('returns false when less than 10 seconds have elapsed', () => {
      const fiveSecondsAgo = FIXED_NOW - 5_000;
      expect(shouldPersistTick(fiveSecondsAgo)).toBe(false);
    });

    it('returns false when lastPersistTime is now', () => {
      expect(shouldPersistTick(FIXED_NOW)).toBe(false);
    });

    it('returns false when 9999ms have elapsed (just under threshold)', () => {
      const justUnder = FIXED_NOW - 9_999;
      expect(shouldPersistTick(justUnder)).toBe(false);
    });
  });
});
