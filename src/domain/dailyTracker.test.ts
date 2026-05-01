/**
 * Unit tests for DailyTracker domain service.
 *
 * Tests metric validation, unit conversion, date keying, and save/get round-trips.
 *
 * Validates: Requirements 9
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getDailyStats,
  getLocalDate,
  MetricType,
  saveDailyStats,
  validateMetric,
} from './dailyTracker';
import { dailyStatsKey } from '../utils/constants';

// Clear AsyncStorage between tests
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

// ─── getLocalDate ────────────────────────────────────────────────────────────

describe('getLocalDate', () => {
  it('returns YYYY-MM-DD format for a given date', () => {
    const date = new Date(2024, 0, 15, 10, 30, 0); // Jan 15, 2024
    expect(getLocalDate(date)).toBe('2024-01-15');
  });

  it('pads single-digit month and day with leading zeros', () => {
    const date = new Date(2024, 2, 5, 8, 0, 0); // Mar 5, 2024
    expect(getLocalDate(date)).toBe('2024-03-05');
  });

  it('handles end of year correctly', () => {
    const date = new Date(2024, 11, 31, 23, 59, 59); // Dec 31, 2024
    expect(getLocalDate(date)).toBe('2024-12-31');
  });

  it('handles start of year correctly', () => {
    const date = new Date(2025, 0, 1, 0, 0, 0); // Jan 1, 2025
    expect(getLocalDate(date)).toBe('2025-01-01');
  });
});

// ─── validateMetric ──────────────────────────────────────────────────────────

describe('validateMetric', () => {
  describe('waterIntake', () => {
    it('accepts 0 ml (minimum)', () => {
      expect(validateMetric('waterIntake', 0)).toEqual({ valid: true });
    });

    it('accepts 20000 ml (maximum)', () => {
      expect(validateMetric('waterIntake', 20000)).toEqual({ valid: true });
    });

    it('accepts a typical value (2000 ml)', () => {
      expect(validateMetric('waterIntake', 2000)).toEqual({ valid: true });
    });

    it('rejects negative values', () => {
      const result = validateMetric('waterIntake', -1);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.warning).toContain('outside the expected range');
      }
    });

    it('rejects values above 20000 ml', () => {
      const result = validateMetric('waterIntake', 20001);
      expect(result.valid).toBe(false);
    });
  });

  describe('weight', () => {
    it('accepts 20 kg (minimum)', () => {
      expect(validateMetric('weight', 20)).toEqual({ valid: true });
    });

    it('accepts 300 kg (maximum)', () => {
      expect(validateMetric('weight', 300)).toEqual({ valid: true });
    });

    it('accepts a typical value (70 kg)', () => {
      expect(validateMetric('weight', 70)).toEqual({ valid: true });
    });

    it('rejects values below 20 kg', () => {
      const result = validateMetric('weight', 19.9);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.warning).toContain('outside the expected range');
      }
    });

    it('rejects values above 300 kg', () => {
      const result = validateMetric('weight', 301);
      expect(result.valid).toBe(false);
    });
  });

  describe('calories', () => {
    it('accepts 0 kcal (minimum)', () => {
      expect(validateMetric('calories', 0)).toEqual({ valid: true });
    });

    it('accepts 10000 kcal (maximum)', () => {
      expect(validateMetric('calories', 10000)).toEqual({ valid: true });
    });

    it('accepts a typical value (2000 kcal)', () => {
      expect(validateMetric('calories', 2000)).toEqual({ valid: true });
    });

    it('rejects negative values', () => {
      const result = validateMetric('calories', -1);
      expect(result.valid).toBe(false);
    });

    it('rejects values above 10000 kcal', () => {
      const result = validateMetric('calories', 10001);
      expect(result.valid).toBe(false);
    });
  });

  describe('steps', () => {
    it('accepts 0 steps (minimum)', () => {
      expect(validateMetric('steps', 0)).toEqual({ valid: true });
    });

    it('accepts 200000 steps (maximum)', () => {
      expect(validateMetric('steps', 200000)).toEqual({ valid: true });
    });

    it('accepts a typical value (10000 steps)', () => {
      expect(validateMetric('steps', 10000)).toEqual({ valid: true });
    });

    it('rejects negative values', () => {
      const result = validateMetric('steps', -1);
      expect(result.valid).toBe(false);
    });

    it('rejects values above 200000', () => {
      const result = validateMetric('steps', 200001);
      expect(result.valid).toBe(false);
    });

    it('rejects non-integer values', () => {
      const result = validateMetric('steps', 10000.5);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.warning).toContain('whole number');
      }
    });
  });

  describe('edge cases', () => {
    it('rejects NaN', () => {
      const result = validateMetric('weight', NaN);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.warning).toContain('valid number');
      }
    });

    it('rejects Infinity', () => {
      const result = validateMetric('calories', Infinity);
      expect(result.valid).toBe(false);
    });

    it('rejects -Infinity', () => {
      const result = validateMetric('waterIntake', -Infinity);
      expect(result.valid).toBe(false);
    });
  });
});

// ─── saveDailyStats & getDailyStats ──────────────────────────────────────────

describe('saveDailyStats and getDailyStats', () => {
  const testDate = new Date(2024, 5, 15, 14, 30, 0); // June 15, 2024

  it('creates a new record when none exists', async () => {
    const result = await saveDailyStats({ waterIntake: 2000 }, 'user1', testDate);

    expect(result.localDate).toBe('2024-06-15');
    expect(result.userId).toBe('user1');
    expect(result.waterIntake).toBe(2000);
    expect(result.weight).toBeNull();
    expect(result.calories).toBeNull();
    expect(result.steps).toBeNull();
    expect(result.statsId).toBeDefined();
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });

  it('round-trips through getDailyStats', async () => {
    await saveDailyStats(
      { waterIntake: 1500, weight: 75, calories: 2200, steps: 8000 },
      'user1',
      testDate,
    );

    const retrieved = await getDailyStats('2024-06-15');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.waterIntake).toBe(1500);
    expect(retrieved!.weight).toBe(75);
    expect(retrieved!.calories).toBe(2200);
    expect(retrieved!.steps).toBe(8000);
  });

  it('merges new fields into existing record', async () => {
    // First save: only water
    await saveDailyStats({ waterIntake: 1000 }, 'user1', testDate);

    // Second save: add weight
    const result = await saveDailyStats({ weight: 68.5 }, 'user1', testDate);

    expect(result.waterIntake).toBe(1000); // preserved
    expect(result.weight).toBe(68.5); // added
    expect(result.calories).toBeNull(); // still null
    expect(result.steps).toBeNull(); // still null
  });

  it('overwrites existing field value', async () => {
    await saveDailyStats({ calories: 1800 }, 'user1', testDate);
    const result = await saveDailyStats({ calories: 2100 }, 'user1', testDate);

    expect(result.calories).toBe(2100);
  });

  it('preserves statsId across updates', async () => {
    const first = await saveDailyStats({ steps: 5000 }, 'user1', testDate);
    const second = await saveDailyStats({ steps: 7000 }, 'user1', testDate);

    expect(second.statsId).toBe(first.statsId);
  });

  it('updates updatedAt on merge', async () => {
    const time1 = new Date(2024, 5, 15, 10, 0, 0);
    const time2 = new Date(2024, 5, 15, 14, 0, 0);

    const first = await saveDailyStats({ waterIntake: 500 }, 'user1', time1);
    const second = await saveDailyStats({ waterIntake: 1000 }, 'user1', time2);

    expect(second.updatedAt).toBe(time2.toISOString());
    expect(second.updatedAt).not.toBe(first.updatedAt);
  });

  it('returns null for non-existent date', async () => {
    const result = await getDailyStats('2024-01-01');
    expect(result).toBeNull();
  });

  it('uses correct AsyncStorage key based on date', async () => {
    await saveDailyStats({ waterIntake: 500 }, 'user1', testDate);

    const expectedKey = dailyStatsKey('2024-06-15');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      expectedKey,
      expect.any(String),
    );
  });

  it('defaults userId to guest', async () => {
    const result = await saveDailyStats({ steps: 3000 }, undefined, testDate);
    expect(result.userId).toBe('guest');
  });

  it('stores timezoneOffsetMinutes on creation', async () => {
    const result = await saveDailyStats({ waterIntake: 1000 }, 'user1', testDate);
    expect(typeof result.timezoneOffsetMinutes).toBe('number');
  });

  it('keys records by different dates independently', async () => {
    const day1 = new Date(2024, 5, 15, 10, 0, 0);
    const day2 = new Date(2024, 5, 16, 10, 0, 0);

    await saveDailyStats({ waterIntake: 1000 }, 'user1', day1);
    await saveDailyStats({ waterIntake: 2000 }, 'user1', day2);

    const stats1 = await getDailyStats('2024-06-15');
    const stats2 = await getDailyStats('2024-06-16');

    expect(stats1!.waterIntake).toBe(1000);
    expect(stats2!.waterIntake).toBe(2000);
  });
});
