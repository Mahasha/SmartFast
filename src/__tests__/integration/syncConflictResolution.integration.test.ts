/**
 * Integration Test: Sync Conflict Resolution Scenarios
 *
 * Tests the SyncEngine's conflict resolution logic for session-aware merging:
 * - Terminal status beats ACTIVE
 * - Both terminal: latest updatedAt wins
 * - Both ACTIVE: latest updatedAt wins with startTime protection
 *
 * Validates: Requirements 23.5, 23.7, 8.3
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  resolveConflict,
  resolveSessionConflict,
  enqueue,
  getSyncQueueSize,
} from '../../data/syncEngine';
import { FastingSession, DailyStats } from '../../models/index';

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

// Mock authManager
jest.mock('../../domain/authManager', () => ({
  refreshToken: jest.fn().mockResolvedValue(null),
  isAuthenticated: jest.fn().mockReturnValue(false),
  isGuest: jest.fn().mockReturnValue(true),
}));

describe('Sync Conflict Resolution Integration', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('Session conflict resolution rules', () => {
    const baseSession: FastingSession = {
      sessionId: 'session-conflict-1',
      userId: 'user-1',
      planId: 'plan-16-8',
      startTime: '2024-06-01T08:00:00.000Z',
      endTime: '2024-06-02T00:00:00.000Z',
      actualEndTime: null,
      status: 'ACTIVE',
      durationFasted: null,
      timezoneOffsetMinutes: -120,
      createdAt: '2024-06-01T08:00:00.000Z',
      updatedAt: '2024-06-01T08:00:00.000Z',
    };

    it('should prefer terminal status over ACTIVE (local terminal, remote ACTIVE)', () => {
      const local: FastingSession = {
        ...baseSession,
        status: 'COMPLETED',
        durationFasted: 57600,
        updatedAt: '2024-06-01T10:00:00.000Z',
      };

      const remote: FastingSession = {
        ...baseSession,
        status: 'ACTIVE',
        updatedAt: '2024-06-01T12:00:00.000Z', // More recent but ACTIVE
      };

      const resolved = resolveSessionConflict(local, remote);

      expect(resolved.status).toBe('COMPLETED');
      expect(resolved.durationFasted).toBe(57600);
    });

    it('should prefer terminal status over ACTIVE (remote terminal, local ACTIVE)', () => {
      const local: FastingSession = {
        ...baseSession,
        status: 'ACTIVE',
        updatedAt: '2024-06-01T12:00:00.000Z',
      };

      const remote: FastingSession = {
        ...baseSession,
        status: 'ENDED_EARLY',
        actualEndTime: '2024-06-01T14:00:00.000Z',
        durationFasted: 21600,
        updatedAt: '2024-06-01T10:00:00.000Z', // Older but terminal
      };

      const resolved = resolveSessionConflict(local, remote);

      expect(resolved.status).toBe('ENDED_EARLY');
    });

    it('should use latest updatedAt when both are terminal', () => {
      const local: FastingSession = {
        ...baseSession,
        status: 'COMPLETED',
        durationFasted: 57600,
        updatedAt: '2024-06-01T16:00:00.000Z',
      };

      const remote: FastingSession = {
        ...baseSession,
        status: 'ENDED_EARLY',
        actualEndTime: '2024-06-01T14:00:00.000Z',
        durationFasted: 21600,
        updatedAt: '2024-06-01T18:00:00.000Z', // More recent
      };

      const resolved = resolveSessionConflict(local, remote);

      expect(resolved.status).toBe('ENDED_EARLY');
      expect(resolved.updatedAt).toBe('2024-06-01T18:00:00.000Z');
    });

    it('should use latest updatedAt when both are ACTIVE and protect startTime', () => {
      const local: FastingSession = {
        ...baseSession,
        status: 'ACTIVE',
        startTime: '2024-06-01T08:00:00.000Z',
        updatedAt: '2024-06-01T10:00:00.000Z',
      };

      const remote: FastingSession = {
        ...baseSession,
        status: 'ACTIVE',
        startTime: '2024-06-01T08:00:00.000Z',
        endTime: '2024-06-02T02:00:00.000Z', // Different endTime (plan change)
        updatedAt: '2024-06-01T12:00:00.000Z', // More recent
      };

      const resolved = resolveSessionConflict(local, remote);

      // Remote wins (latest updatedAt)
      expect(resolved.endTime).toBe('2024-06-02T02:00:00.000Z');
      // startTime is protected
      expect(resolved.startTime).toBe('2024-06-01T08:00:00.000Z');
    });

    it('should never overwrite CANCELLED with ACTIVE', () => {
      const local: FastingSession = {
        ...baseSession,
        status: 'CANCELLED',
        actualEndTime: '2024-06-01T09:00:00.000Z',
        durationFasted: 3600,
        updatedAt: '2024-06-01T09:00:00.000Z',
      };

      const remote: FastingSession = {
        ...baseSession,
        status: 'ACTIVE',
        updatedAt: '2024-06-01T15:00:00.000Z',
      };

      const resolved = resolveSessionConflict(local, remote);

      expect(resolved.status).toBe('CANCELLED');
    });
  });

  describe('Generic conflict resolution', () => {
    it('should resolve DailyStats conflict using latest updatedAt', () => {
      const local: DailyStats = {
        statsId: 'stats-1',
        userId: 'user-1',
        localDate: '2024-06-01',
        waterIntake: 2000,
        weight: 75,
        calories: 1800,
        steps: 8000,
        timezoneOffsetMinutes: -120,
        createdAt: '2024-06-01T06:00:00.000Z',
        updatedAt: '2024-06-01T10:00:00.000Z',
      };

      const remote: DailyStats = {
        statsId: 'stats-1',
        userId: 'user-1',
        localDate: '2024-06-01',
        waterIntake: 2500,
        weight: 74.5,
        calories: 2000,
        steps: 10000,
        timezoneOffsetMinutes: -120,
        createdAt: '2024-06-01T06:00:00.000Z',
        updatedAt: '2024-06-01T14:00:00.000Z', // More recent
      };

      const resolved = resolveConflict(local, remote) as DailyStats;

      expect(resolved.waterIntake).toBe(2500);
      expect(resolved.weight).toBe(74.5);
      expect(resolved.updatedAt).toBe('2024-06-01T14:00:00.000Z');
    });
  });

  describe('Sync queue management', () => {
    it('should enqueue records and track queue size', async () => {
      const session: FastingSession = {
        sessionId: 'queue-test-1',
        userId: 'user-1',
        planId: 'plan-16-8',
        startTime: '2024-06-01T08:00:00.000Z',
        endTime: '2024-06-02T00:00:00.000Z',
        actualEndTime: null,
        status: 'ACTIVE',
        durationFasted: null,
        timezoneOffsetMinutes: -120,
        createdAt: '2024-06-01T08:00:00.000Z',
        updatedAt: '2024-06-01T08:00:00.000Z',
      };

      await enqueue(session);
      expect(await getSyncQueueSize()).toBe(1);

      // Enqueue same record again (should dedup/update)
      const updatedSession = { ...session, updatedAt: '2024-06-01T09:00:00.000Z' };
      await enqueue(updatedSession);
      expect(await getSyncQueueSize()).toBe(1); // Still 1 (deduped)
    });

    it('should enqueue different records separately', async () => {
      const session1: FastingSession = {
        sessionId: 'queue-test-a',
        userId: 'user-1',
        planId: 'plan-16-8',
        startTime: '2024-06-01T08:00:00.000Z',
        endTime: '2024-06-02T00:00:00.000Z',
        actualEndTime: null,
        status: 'ACTIVE',
        durationFasted: null,
        timezoneOffsetMinutes: -120,
        createdAt: '2024-06-01T08:00:00.000Z',
        updatedAt: '2024-06-01T08:00:00.000Z',
      };

      const session2: FastingSession = {
        ...session1,
        sessionId: 'queue-test-b',
        startTime: '2024-06-02T08:00:00.000Z',
        endTime: '2024-06-03T00:00:00.000Z',
        createdAt: '2024-06-02T08:00:00.000Z',
        updatedAt: '2024-06-02T08:00:00.000Z',
      };

      await enqueue(session1);
      await enqueue(session2);

      expect(await getSyncQueueSize()).toBe(2);
    });
  });
});
