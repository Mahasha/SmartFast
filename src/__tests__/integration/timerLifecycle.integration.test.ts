/**
 * Integration Test: Timer Start → Persist → Restore → Complete Flow
 *
 * Tests the full lifecycle of a fasting session across multiple domain services:
 * FastingTimer, TimerLifecycle, SyncEngine, and StreakEngine.
 *
 * Validates: Requirements 4, 6, 7, 8, 11
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { startFast, getActiveSession, restoreSession, computeProgress, endFast } from '../../domain/fastingTimer';
import { recomputeStreaks, isQualifyingFast } from '../../domain/streakEngine';
import { enqueue, getSyncQueueSize } from '../../data/syncEngine';
import { getItem, setItem } from '../../data/localStorage';
import { STORAGE_KEYS } from '../../utils/constants';
import { FastingPlan, FastingSession } from '../../models/index';
import { FREE_PLANS } from '../../models/plans';

// Mock Supabase client
jest.mock('../../data/supabaseClient', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      refreshSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    from: jest.fn(() => ({
      upsert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    })),
  },
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notif-id'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}));

describe('Timer Lifecycle Integration', () => {
  const plan16_8: FastingPlan = FREE_PLANS[0]!; // 12:12 plan for testing

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('Start → Persist → Restore → Complete flow', () => {

    it('should start a fast, persist it, and retrieve it as active', async () => {
      const session = await startFast(plan16_8);

      expect(session.status).toBe('ACTIVE');
      expect(session.planId).toBe(plan16_8.planId);
      expect(session.userId).toBe('guest');

      // Verify it's persisted and retrievable
      const active = await getActiveSession();
      expect(active).not.toBeNull();
      expect(active!.sessionId).toBe(session.sessionId);
      expect(active!.status).toBe('ACTIVE');
    });

    it('should restore an active session on app launch when endTime is in the future', async () => {
      const session = await startFast(plan16_8);

      // Simulate app restart by reading from storage
      const restored = await restoreSession();

      expect(restored).not.toBeNull();
      expect(restored!.sessionId).toBe(session.sessionId);
      expect(restored!.status).toBe('ACTIVE');
    });

    it('should keep a session ACTIVE in overtime when restored after the goal passed', async () => {
      // Create a session whose planned goal is already behind us
      const now = new Date();
      const pastStart = new Date(now.getTime() - 13 * 60 * 60 * 1000); // 13 hours ago
      const pastEnd = new Date(now.getTime() - 1 * 60 * 60 * 1000); // goal hit 1 hour ago

      const overtimeSession: FastingSession = {
        sessionId: 'test-session-overtime',
        userId: 'guest',
        planId: plan16_8.planId,
        startTime: pastStart.toISOString(),
        endTime: pastEnd.toISOString(),
        actualEndTime: null,
        status: 'ACTIVE',
        durationFasted: null,
        goalReachedAt: null,
        completedAt: null,
        timezoneOffsetMinutes: now.getTimezoneOffset(),
        createdAt: pastStart.toISOString(),
        updatedAt: pastStart.toISOString(),
      };

      await setItem(STORAGE_KEYS.ACTIVE_SESSION, overtimeSession);

      // Restore must NOT auto-complete — the fast keeps counting up.
      const restored = await restoreSession();

      expect(restored).not.toBeNull();
      expect(restored!.status).toBe('ACTIVE');
      expect(restored!.durationFasted).toBeNull();

      // The active session key must still be present after restore.
      const stillActive = await getActiveSession();
      expect(stillActive).not.toBeNull();
      expect(stillActive!.sessionId).toBe('test-session-overtime');
    });

    it('should complete a goal-passed session only when the user ends it, recording actual duration', async () => {
      const now = new Date();
      const pastStart = new Date(now.getTime() - 13 * 60 * 60 * 1000); // 13 hours ago
      const pastEnd = new Date(now.getTime() - 1 * 60 * 60 * 1000); // goal hit 1 hour ago

      const overtimeSession: FastingSession = {
        sessionId: 'test-session-end',
        userId: 'guest',
        planId: plan16_8.planId,
        startTime: pastStart.toISOString(),
        endTime: pastEnd.toISOString(),
        actualEndTime: null,
        status: 'ACTIVE',
        durationFasted: null,
        goalReachedAt: null,
        completedAt: null,
        timezoneOffsetMinutes: now.getTimezoneOffset(),
        createdAt: pastStart.toISOString(),
        updatedAt: pastStart.toISOString(),
      };

      await setItem(STORAGE_KEYS.ACTIVE_SESSION, overtimeSession);

      const ended = await endFast();

      expect(ended.status).toBe('COMPLETED');
      // Actual fasted duration (~13h) exceeds the planned 12h goal.
      expect(ended.durationFasted).toBeGreaterThan(12 * 60 * 60);
      expect(ended.actualEndTime).not.toBeNull();
      expect(ended.completedAt).not.toBeNull();
      expect(ended.goalReachedAt).toBe(overtimeSession.endTime);

      // Active session key is cleared after ending.
      const active = await getActiveSession();
      expect(active).toBeNull();
    });

    it('should compute progress correctly for an active session', async () => {
      const session = await startFast(plan16_8);

      // Simulate 6 hours elapsed (half of 12:12 plan)
      const sixHoursLater = new Date(
        new Date(session.startTime).getTime() + 6 * 60 * 60 * 1000,
      );

      const progress = computeProgress(session, sixHoursLater);

      expect(progress.progressPercent).toBeCloseTo(50, 0);
      expect(progress.isGoalReached).toBe(false);
      expect(progress.phase).toBe('COUNTDOWN');
      expect(progress.remainingMs).toBeGreaterThan(0);
      expect(progress.totalElapsedMs).toBeGreaterThan(0);
      expect(progress.overtimeMs).toBe(0);
    });

    it('should enter overtime and cap progress at 100% once the goal is passed', async () => {
      const session = await startFast(plan16_8);

      // Simulate time past endTime
      const pastEnd = new Date(
        new Date(session.endTime).getTime() + 1000,
      );

      const progress = computeProgress(session, pastEnd);

      expect(progress.progressPercent).toBe(100);
      expect(progress.isGoalReached).toBe(true);
      expect(progress.remainingMs).toBe(0);
      expect(progress.overtimeMs).toBeGreaterThan(0);
    });

    it('should prevent starting a new fast while one is active', async () => {
      await startFast(plan16_8);

      await expect(startFast(plan16_8)).rejects.toThrow(
        'Cannot start a new fast while one is already in progress.',
      );
    });
  });

  describe('Session completion and streak integration', () => {
    it('should count a completed session as a qualifying fast when duration >= 90%', () => {
      const now = new Date();
      const startTime = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours ago

      const completedSession: FastingSession = {
        sessionId: 'qualifying-session',
        userId: 'guest',
        planId: plan16_8.planId,
        startTime: startTime.toISOString(),
        endTime: now.toISOString(),
        actualEndTime: null,
        status: 'COMPLETED',
        durationFasted: 12 * 3600, // Full 12 hours in seconds
        timezoneOffsetMinutes: now.getTimezoneOffset(),
        createdAt: startTime.toISOString(),
        updatedAt: now.toISOString(),
      };

      expect(isQualifyingFast(completedSession, plan16_8)).toBe(true);
    });

    it('should NOT count a cancelled session as qualifying', () => {
      const now = new Date();
      const startTime = new Date(now.getTime() - 12 * 60 * 60 * 1000);

      const cancelledSession: FastingSession = {
        sessionId: 'cancelled-session',
        userId: 'guest',
        planId: plan16_8.planId,
        startTime: startTime.toISOString(),
        endTime: now.toISOString(),
        actualEndTime: now.toISOString(),
        status: 'CANCELLED',
        durationFasted: 12 * 3600,
        timezoneOffsetMinutes: now.getTimezoneOffset(),
        createdAt: startTime.toISOString(),
        updatedAt: now.toISOString(),
      };

      expect(isQualifyingFast(cancelledSession, plan16_8)).toBe(false);
    });

    it('should enqueue session to sync queue after creation', async () => {
      const session = await startFast(plan16_8);

      // Enqueue for sync
      await enqueue(session);

      const queueSize = await getSyncQueueSize();
      expect(queueSize).toBe(1);
    });
  });
});
