/**
 * Integration Test: Streak Computation Across Multiple Days
 *
 * Tests the StreakEngine's ability to compute streaks from session history
 * spanning multiple days, including grace periods, missed days, and
 * longest streak tracking.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 12.1, 12.2, 12.3, 12.4, 12.5
 */

import { recomputeStreaks, isQualifyingFast, getStreakDays } from '../../domain/streakEngine';
import { FastingSession, FastingPlan } from '../../models/index';
import { FREE_PLANS } from '../../models/plans';

describe('Streak Computation Integration', () => {
  const plan12_12: FastingPlan = FREE_PLANS[0]!; // 12:12 plan
  const plan16_8: FastingPlan = FREE_PLANS[2]!; // 16:8 plan

  /**
   * Helper to create a completed qualifying session on a specific date.
   */
  function createQualifyingSession(
    dateStr: string,
    plan: FastingPlan,
    sessionId: string,
  ): FastingSession {
    // Create a session that started at 8 AM on the given date and lasted the full duration
    const startTime = new Date(`${dateStr}T08:00:00.000Z`);
    const endTime = new Date(startTime.getTime() + plan.fastingHours * 3600 * 1000);

    return {
      sessionId,
      userId: 'user-1',
      planId: plan.planId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      actualEndTime: null,
      status: 'COMPLETED',
      durationFasted: plan.fastingHours * 3600, // Full duration
      timezoneOffsetMinutes: 0,
      createdAt: startTime.toISOString(),
      updatedAt: endTime.toISOString(),
    };
  }

  /**
   * Helper to create a non-qualifying session (ended too early).
   */
  function createNonQualifyingSession(
    dateStr: string,
    plan: FastingPlan,
    sessionId: string,
  ): FastingSession {
    const startTime = new Date(`${dateStr}T08:00:00.000Z`);
    const actualEnd = new Date(startTime.getTime() + plan.fastingHours * 3600 * 1000 * 0.5); // Only 50%

    return {
      sessionId,
      userId: 'user-1',
      planId: plan.planId,
      startTime: startTime.toISOString(),
      endTime: new Date(startTime.getTime() + plan.fastingHours * 3600 * 1000).toISOString(),
      actualEndTime: actualEnd.toISOString(),
      status: 'ENDED_EARLY',
      durationFasted: Math.round(plan.fastingHours * 3600 * 0.5), // Only 50% of required
      timezoneOffsetMinutes: 0,
      createdAt: startTime.toISOString(),
      updatedAt: actualEnd.toISOString(),
    };
  }

  describe('Multi-day streak computation', () => {
    it('should compute a 3-day streak from consecutive qualifying fasts', () => {
      const sessions = [
        createQualifyingSession('2024-06-01', plan16_8, 'sess-1'),
        createQualifyingSession('2024-06-02', plan16_8, 'sess-2'),
        createQualifyingSession('2024-06-03', plan16_8, 'sess-3'),
      ];

      // "Now" is end of June 3
      const now = new Date('2024-06-03T23:00:00.000Z');
      const result = recomputeStreaks(sessions, [plan16_8], now);

      expect(result.currentStreak).toBe(3);
      expect(result.longestStreak).toBe(3);
      expect(result.lastStreakDate).toBe('2024-06-03');
    });

    it('should reset streak when a day is missed', () => {
      const sessions = [
        createQualifyingSession('2024-06-01', plan16_8, 'sess-1'),
        createQualifyingSession('2024-06-02', plan16_8, 'sess-2'),
        // June 3 missed
        createQualifyingSession('2024-06-04', plan16_8, 'sess-4'),
        createQualifyingSession('2024-06-05', plan16_8, 'sess-5'),
      ];

      const now = new Date('2024-06-05T23:00:00.000Z');
      const result = recomputeStreaks(sessions, [plan16_8], now);

      expect(result.currentStreak).toBe(2); // Only June 4-5
      expect(result.longestStreak).toBe(2); // Both runs are 2 days
    });

    it('should track longest streak separately from current streak', () => {
      const sessions = [
        // First streak: 5 days
        createQualifyingSession('2024-06-01', plan16_8, 'sess-1'),
        createQualifyingSession('2024-06-02', plan16_8, 'sess-2'),
        createQualifyingSession('2024-06-03', plan16_8, 'sess-3'),
        createQualifyingSession('2024-06-04', plan16_8, 'sess-4'),
        createQualifyingSession('2024-06-05', plan16_8, 'sess-5'),
        // Gap on June 6
        // Second streak: 2 days (current)
        createQualifyingSession('2024-06-07', plan16_8, 'sess-7'),
        createQualifyingSession('2024-06-08', plan16_8, 'sess-8'),
      ];

      const now = new Date('2024-06-08T23:00:00.000Z');
      const result = recomputeStreaks(sessions, [plan16_8], now);

      expect(result.currentStreak).toBe(2);
      expect(result.longestStreak).toBe(5);
    });

    it('should apply grace period: streak alive if yesterday had qualifying fast', () => {
      const sessions = [
        createQualifyingSession('2024-06-01', plan16_8, 'sess-1'),
        createQualifyingSession('2024-06-02', plan16_8, 'sess-2'),
        createQualifyingSession('2024-06-03', plan16_8, 'sess-3'),
        // No fast today (June 4) yet
      ];

      // "Now" is early June 4 — yesterday (June 3) had a qualifying fast
      const now = new Date('2024-06-04T10:00:00.000Z');
      const result = recomputeStreaks(sessions, [plan16_8], now);

      // Streak should still be alive (grace period)
      expect(result.currentStreak).toBe(3);
    });

    it('should reset streak when neither today nor yesterday has a qualifying fast', () => {
      const sessions = [
        createQualifyingSession('2024-06-01', plan16_8, 'sess-1'),
        createQualifyingSession('2024-06-02', plan16_8, 'sess-2'),
        // No fast on June 3 or June 4
      ];

      // "Now" is June 4 — yesterday (June 3) had no qualifying fast
      const now = new Date('2024-06-04T10:00:00.000Z');
      const result = recomputeStreaks(sessions, [plan16_8], now);

      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(2);
    });

    it('should count multiple qualifying fasts on same day as single streak day', () => {
      const sessions = [
        createQualifyingSession('2024-06-01', plan12_12, 'sess-1a'),
        // Second qualifying fast on same day
        {
          ...createQualifyingSession('2024-06-01', plan12_12, 'sess-1b'),
          startTime: '2024-06-01T20:00:00.000Z',
          endTime: '2024-06-02T08:00:00.000Z',
        },
        createQualifyingSession('2024-06-02', plan12_12, 'sess-2'),
      ];

      const now = new Date('2024-06-02T23:00:00.000Z');
      const result = recomputeStreaks(sessions, [plan12_12], now);

      expect(result.currentStreak).toBe(2); // June 1 + June 2 = 2 days (not 3)
    });

    it('should not count non-qualifying sessions toward streaks', () => {
      const sessions = [
        createQualifyingSession('2024-06-01', plan16_8, 'sess-1'),
        createNonQualifyingSession('2024-06-02', plan16_8, 'sess-2'), // Only 50% — not qualifying
        createQualifyingSession('2024-06-03', plan16_8, 'sess-3'),
      ];

      const now = new Date('2024-06-03T23:00:00.000Z');
      const result = recomputeStreaks(sessions, [plan16_8], now);

      // June 2 doesn't count, so streak is just June 3 = 1
      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(1);
    });

    it('should handle empty session history', () => {
      const now = new Date('2024-06-01T10:00:00.000Z');
      const result = recomputeStreaks([], [plan16_8], now);

      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
      expect(result.lastStreakDate).toBeNull();
    });

    it('should correctly identify streak days from mixed sessions', () => {
      const sessions = [
        createQualifyingSession('2024-06-01', plan16_8, 'sess-1'),
        createNonQualifyingSession('2024-06-01', plan16_8, 'sess-1b'), // Same day, non-qualifying
        createQualifyingSession('2024-06-02', plan12_12, 'sess-2'), // Different plan
      ];

      const streakDays = getStreakDays(sessions, [plan16_8, plan12_12]);

      expect(streakDays.has('2024-06-01')).toBe(true);
      expect(streakDays.has('2024-06-02')).toBe(true);
      expect(streakDays.size).toBe(2);
    });
  });

  describe('Qualifying fast threshold (90%)', () => {
    it('should qualify a session with exactly 90% of plan duration', () => {
      const session: FastingSession = {
        sessionId: 'threshold-test',
        userId: 'user-1',
        planId: plan16_8.planId,
        startTime: '2024-06-01T08:00:00.000Z',
        endTime: '2024-06-02T00:00:00.000Z',
        actualEndTime: '2024-06-01T22:24:00.000Z',
        status: 'ENDED_EARLY',
        durationFasted: Math.round(16 * 3600 * 0.9), // Exactly 90%
        timezoneOffsetMinutes: 0,
        createdAt: '2024-06-01T08:00:00.000Z',
        updatedAt: '2024-06-01T22:24:00.000Z',
      };

      expect(isQualifyingFast(session, plan16_8)).toBe(true);
    });

    it('should NOT qualify a session with 89% of plan duration', () => {
      const session: FastingSession = {
        sessionId: 'below-threshold',
        userId: 'user-1',
        planId: plan16_8.planId,
        startTime: '2024-06-01T08:00:00.000Z',
        endTime: '2024-06-02T00:00:00.000Z',
        actualEndTime: '2024-06-01T22:00:00.000Z',
        status: 'ENDED_EARLY',
        durationFasted: Math.round(16 * 3600 * 0.89), // 89% — below threshold
        timezoneOffsetMinutes: 0,
        createdAt: '2024-06-01T08:00:00.000Z',
        updatedAt: '2024-06-01T22:00:00.000Z',
      };

      expect(isQualifyingFast(session, plan16_8)).toBe(false);
    });
  });
});
