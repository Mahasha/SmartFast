/**
 * Unit tests for SyncEngine
 *
 * Tests conflict resolution rules, queue management, retry logic,
 * and token refresh flow.
 *
 * Validates: Requirements 23, 35
 */

import {
  enqueue,
  getSyncQueueSize,
  pushPendingChanges,
  pullRemoteChanges,
  resolveConflict,
  resolveSessionConflict,
  refreshTokenAndRetry,
} from './syncEngine';
import { FastingSession, SyncQueueEntry, DailyStats } from '../models/index';
import { STORAGE_KEYS } from '../utils/constants';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('./supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../domain/authManager', () => ({
  refreshToken: jest.fn(),
}));

jest.mock('../domain/streakEngine', () => ({
  recomputeStreaks: jest.fn(() => ({
    currentStreak: 0,
    longestStreak: 0,
    lastStreakDate: null,
    streakDays: new Set(),
  })),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substring(7)),
}));

import { supabase } from './supabaseClient';
import { refreshToken } from '../domain/authManager';
import { recomputeStreaks } from '../domain/streakEngine';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockRefreshToken = refreshToken as jest.MockedFunction<typeof refreshToken>;
const mockRecomputeStreaks = recomputeStreaks as jest.MockedFunction<typeof recomputeStreaks>;

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createSession(overrides: Partial<FastingSession> = {}): FastingSession {
  return {
    sessionId: 'session-1',
    userId: 'user-1',
    planId: 'plan-16-8',
    startTime: '2024-01-01T08:00:00.000Z',
    endTime: '2024-01-02T00:00:00.000Z',
    actualEndTime: null,
    status: 'ACTIVE',
    durationFasted: null,
    timezoneOffsetMinutes: 120,
    createdAt: '2024-01-01T08:00:00.000Z',
    updatedAt: '2024-01-01T08:00:00.000Z',
    ...overrides,
  };
}

function createDailyStats(overrides: Partial<DailyStats> = {}): DailyStats {
  return {
    statsId: 'stats-1',
    userId: 'user-1',
    localDate: '2024-01-01',
    waterIntake: 2000,
    weight: 75,
    calories: 1800,
    steps: 8000,
    timezoneOffsetMinutes: 120,
    createdAt: '2024-01-01T08:00:00.000Z',
    updatedAt: '2024-01-01T08:00:00.000Z',
    ...overrides,
  };
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.clear as jest.Mock)();
});

// ─── Queue Management Tests ──────────────────────────────────────────────────

describe('SyncEngine - Queue Management', () => {
  test('enqueue adds a record to the sync queue', async () => {
    const session = createSession();
    await enqueue(session);

    const size = await getSyncQueueSize();
    expect(size).toBe(1);
  });

  test('enqueue deduplicates entries for the same record', async () => {
    const session = createSession();
    await enqueue(session);
    await enqueue({ ...session, updatedAt: '2024-01-01T09:00:00.000Z' });

    const size = await getSyncQueueSize();
    expect(size).toBe(1);
  });

  test('enqueue stores multiple different records', async () => {
    const session1 = createSession({ sessionId: 'session-1' });
    const session2 = createSession({ sessionId: 'session-2' });
    await enqueue(session1);
    await enqueue(session2);

    const size = await getSyncQueueSize();
    expect(size).toBe(2);
  });

  test('getSyncQueueSize returns 0 for empty queue', async () => {
    const size = await getSyncQueueSize();
    expect(size).toBe(0);
  });

  test('enqueue sets operation to UPDATE when deduplicating', async () => {
    const session = createSession();
    await enqueue(session);
    await enqueue({ ...session, status: 'COMPLETED' });

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
    const queue = JSON.parse(raw!) as SyncQueueEntry[];
    expect(queue[0]!.operation).toBe('UPDATE');
  });
});

// ─── Session Conflict Resolution Tests ───────────────────────────────────────

describe('SyncEngine - Session Conflict Resolution', () => {
  test('Rule 1: Terminal status beats ACTIVE (local terminal)', () => {
    const local = createSession({ status: 'COMPLETED', updatedAt: '2024-01-01T10:00:00.000Z' });
    const remote = createSession({ status: 'ACTIVE', updatedAt: '2024-01-01T12:00:00.000Z' });

    const result = resolveSessionConflict(local, remote);
    expect(result.status).toBe('COMPLETED');
    expect(result).toBe(local);
  });

  test('Rule 1: Terminal status beats ACTIVE (remote terminal)', () => {
    const local = createSession({ status: 'ACTIVE', updatedAt: '2024-01-01T12:00:00.000Z' });
    const remote = createSession({ status: 'ENDED_EARLY', updatedAt: '2024-01-01T10:00:00.000Z' });

    const result = resolveSessionConflict(local, remote);
    expect(result.status).toBe('ENDED_EARLY');
    expect(result).toBe(remote);
  });

  test('Rule 1: CANCELLED (terminal) beats ACTIVE', () => {
    const local = createSession({ status: 'ACTIVE', updatedAt: '2024-01-01T12:00:00.000Z' });
    const remote = createSession({ status: 'CANCELLED', updatedAt: '2024-01-01T09:00:00.000Z' });

    const result = resolveSessionConflict(local, remote);
    expect(result.status).toBe('CANCELLED');
  });

  test('Rule 2: Both terminal — latest updatedAt wins (remote newer)', () => {
    const local = createSession({ status: 'COMPLETED', updatedAt: '2024-01-01T10:00:00.000Z' });
    const remote = createSession({ status: 'ENDED_EARLY', updatedAt: '2024-01-01T12:00:00.000Z' });

    const result = resolveSessionConflict(local, remote);
    expect(result.status).toBe('ENDED_EARLY');
    expect(result.updatedAt).toBe('2024-01-01T12:00:00.000Z');
  });

  test('Rule 2: Both terminal — latest updatedAt wins (local newer)', () => {
    const local = createSession({ status: 'COMPLETED', updatedAt: '2024-01-01T14:00:00.000Z' });
    const remote = createSession({ status: 'CANCELLED', updatedAt: '2024-01-01T12:00:00.000Z' });

    const result = resolveSessionConflict(local, remote);
    expect(result.status).toBe('COMPLETED');
    expect(result.updatedAt).toBe('2024-01-01T14:00:00.000Z');
  });

  test('Rule 3: Both ACTIVE — latest updatedAt wins', () => {
    const local = createSession({
      status: 'ACTIVE',
      updatedAt: '2024-01-01T10:00:00.000Z',
      startTime: '2024-01-01T08:00:00.000Z',
    });
    const remote = createSession({
      status: 'ACTIVE',
      updatedAt: '2024-01-01T12:00:00.000Z',
      startTime: '2024-01-01T08:00:00.000Z',
    });

    const result = resolveSessionConflict(local, remote);
    expect(result.updatedAt).toBe('2024-01-01T12:00:00.000Z');
  });

  test('Rule 3: Both ACTIVE — startTime is protected (earliest preserved)', () => {
    const local = createSession({
      status: 'ACTIVE',
      startTime: '2024-01-01T07:00:00.000Z',
      updatedAt: '2024-01-01T10:00:00.000Z',
    });
    const remote = createSession({
      status: 'ACTIVE',
      startTime: '2024-01-01T08:00:00.000Z',
      updatedAt: '2024-01-01T12:00:00.000Z',
    });

    const result = resolveSessionConflict(local, remote);
    // Remote wins by updatedAt, but startTime should be the earliest
    expect(result.startTime).toBe('2024-01-01T07:00:00.000Z');
  });

  test('Rule 4: ACTIVE endTime differs (plan change) — latest updatedAt wins', () => {
    const local = createSession({
      status: 'ACTIVE',
      endTime: '2024-01-02T00:00:00.000Z',
      updatedAt: '2024-01-01T10:00:00.000Z',
    });
    const remote = createSession({
      status: 'ACTIVE',
      endTime: '2024-01-02T04:00:00.000Z', // Plan changed to longer fast
      updatedAt: '2024-01-01T12:00:00.000Z',
    });

    const result = resolveSessionConflict(local, remote);
    expect(result.endTime).toBe('2024-01-02T04:00:00.000Z');
    expect(result.updatedAt).toBe('2024-01-01T12:00:00.000Z');
  });
});

// ─── Generic Conflict Resolution Tests ───────────────────────────────────────

describe('SyncEngine - Generic Conflict Resolution', () => {
  test('resolveConflict picks remote when remote updatedAt is newer', () => {
    const local = createDailyStats({ updatedAt: '2024-01-01T08:00:00.000Z' });
    const remote = createDailyStats({ updatedAt: '2024-01-01T12:00:00.000Z', waterIntake: 3000 });

    const result = resolveConflict(local, remote);
    expect((result as DailyStats).waterIntake).toBe(3000);
  });

  test('resolveConflict picks local when local updatedAt is newer', () => {
    const local = createDailyStats({ updatedAt: '2024-01-01T14:00:00.000Z', waterIntake: 2500 });
    const remote = createDailyStats({ updatedAt: '2024-01-01T12:00:00.000Z' });

    const result = resolveConflict(local, remote);
    expect((result as DailyStats).waterIntake).toBe(2500);
  });

  test('resolveConflict delegates to resolveSessionConflict for sessions', () => {
    const local = createSession({ status: 'COMPLETED', updatedAt: '2024-01-01T10:00:00.000Z' });
    const remote = createSession({ status: 'ACTIVE', updatedAt: '2024-01-01T12:00:00.000Z' });

    const result = resolveConflict(local, remote);
    // Terminal beats ACTIVE
    expect((result as FastingSession).status).toBe('COMPLETED');
  });
});

// ─── Push Pending Changes Tests ──────────────────────────────────────────────

describe('SyncEngine - pushPendingChanges', () => {
  test('pushes queued entries to Supabase successfully', async () => {
    const session = createSession();
    await enqueue(session);

    const mockUpsert = jest.fn().mockResolvedValue({ error: null });
    (mockSupabase.from as jest.Mock).mockReturnValue({ upsert: mockUpsert });

    const result = await pushPendingChanges();

    expect(result.pushed).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(mockSupabase.from).toHaveBeenCalledWith('fasting_sessions');

    // Queue should be empty after successful push
    const size = await getSyncQueueSize();
    expect(size).toBe(0);
  });

  test('returns empty result when queue is empty', async () => {
    const result = await pushPendingChanges();
    expect(result.pushed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  test('retains entries in queue on network error', async () => {
    const session = createSession();
    await enqueue(session);

    const mockUpsert = jest.fn().mockRejectedValue(new Error('Network error'));
    (mockSupabase.from as jest.Mock).mockReturnValue({ upsert: mockUpsert });

    const result = await pushPendingChanges();

    expect(result.pushed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toBe('Network error');

    // Entry should remain in queue
    const size = await getSyncQueueSize();
    expect(size).toBe(1);
  });

  test('retains entries in queue on Supabase error', async () => {
    const session = createSession();
    await enqueue(session);

    const mockUpsert = jest.fn().mockResolvedValue({
      error: { message: 'Database error', code: '500' },
    });
    (mockSupabase.from as jest.Mock).mockReturnValue({ upsert: mockUpsert });

    const result = await pushPendingChanges();

    expect(result.pushed).toBe(0);
    expect(result.errors).toHaveLength(1);

    const size = await getSyncQueueSize();
    expect(size).toBe(1);
  });

  test('pushes entries in chronological order', async () => {
    // Manually set up the queue with known createdAt timestamps
    // to test chronological ordering
    const queue: SyncQueueEntry[] = [
      {
        id: 'entry-1',
        recordType: 'fasting_session',
        recordId: 'session-1',
        operation: 'CREATE',
        payload: createSession({ sessionId: 'session-1' }),
        createdAt: '2024-01-01T10:00:00.000Z', // later
        retryCount: 0,
      },
      {
        id: 'entry-2',
        recordType: 'fasting_session',
        recordId: 'session-2',
        operation: 'CREATE',
        payload: createSession({ sessionId: 'session-2' }),
        createdAt: '2024-01-01T08:00:00.000Z', // earlier
        retryCount: 0,
      },
    ];
    await AsyncStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));

    const upsertCalls: unknown[] = [];
    const mockUpsert = jest.fn().mockImplementation((payload) => {
      upsertCalls.push(payload);
      return Promise.resolve({ error: null });
    });
    (mockSupabase.from as jest.Mock).mockReturnValue({ upsert: mockUpsert });

    await pushPendingChanges();

    // session-2 was created earlier, should be pushed first
    expect(upsertCalls[0]).toEqual(expect.objectContaining({ sessionId: 'session-2' }));
    expect(upsertCalls[1]).toEqual(expect.objectContaining({ sessionId: 'session-1' }));
  });
});

// ─── Token Refresh and Retry Tests ───────────────────────────────────────────

describe('SyncEngine - Token Refresh and Retry', () => {
  test('attempts token refresh on auth/RLS error and retries successfully', async () => {
    const session = createSession();
    await enqueue(session);

    let callCount = 0;
    const mockUpsert = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          error: { message: 'JWT expired', code: 'pgrst301', status: 401 },
        });
      }
      return Promise.resolve({ error: null });
    });
    (mockSupabase.from as jest.Mock).mockReturnValue({ upsert: mockUpsert });
    mockRefreshToken.mockResolvedValue({
      userId: 'user-1',
      email: 'test@test.com',
      accessToken: 'new-token',
      refreshToken: 'new-refresh',
    });

    const result = await pushPendingChanges();

    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(result.pushed).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  test('keeps entry in queue when token refresh fails', async () => {
    const session = createSession();
    await enqueue(session);

    const mockUpsert = jest.fn().mockResolvedValue({
      error: { message: 'Unauthorized', code: '401', status: 401 },
    });
    (mockSupabase.from as jest.Mock).mockReturnValue({ upsert: mockUpsert });
    mockRefreshToken.mockResolvedValue(null);

    const result = await pushPendingChanges();

    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(result.pushed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.isAuthError).toBe(true);

    const size = await getSyncQueueSize();
    expect(size).toBe(1);
  });

  test('keeps entry in queue when retry after refresh fails', async () => {
    const session = createSession();
    await enqueue(session);

    const mockUpsert = jest.fn().mockResolvedValue({
      error: { message: 'Forbidden', code: '42501', status: 403 },
    });
    (mockSupabase.from as jest.Mock).mockReturnValue({ upsert: mockUpsert });
    mockRefreshToken.mockResolvedValue({
      userId: 'user-1',
      email: 'test@test.com',
      accessToken: 'new-token',
      refreshToken: 'new-refresh',
    });

    const result = await pushPendingChanges();

    expect(result.pushed).toBe(0);
    expect(result.errors).toHaveLength(1);

    const size = await getSyncQueueSize();
    expect(size).toBe(1);
  });

  test('refreshTokenAndRetry returns success when retry succeeds', async () => {
    const entry: SyncQueueEntry = {
      id: 'entry-1',
      recordType: 'fasting_session',
      recordId: 'session-1',
      operation: 'UPDATE',
      payload: createSession(),
      createdAt: '2024-01-01T08:00:00.000Z',
      retryCount: 0,
    };

    mockRefreshToken.mockResolvedValue({
      userId: 'user-1',
      email: 'test@test.com',
      accessToken: 'new-token',
      refreshToken: 'new-refresh',
    });

    const mockUpsert = jest.fn().mockResolvedValue({ error: null });
    (mockSupabase.from as jest.Mock).mockReturnValue({ upsert: mockUpsert });

    const result = await refreshTokenAndRetry(entry);
    expect(result).toEqual({ success: true });
  });

  test('refreshTokenAndRetry returns failure when refresh fails', async () => {
    const entry: SyncQueueEntry = {
      id: 'entry-1',
      recordType: 'fasting_session',
      recordId: 'session-1',
      operation: 'UPDATE',
      payload: createSession(),
      createdAt: '2024-01-01T08:00:00.000Z',
      retryCount: 0,
    };

    mockRefreshToken.mockResolvedValue(null);

    const result = await refreshTokenAndRetry(entry);
    expect(result).toEqual({ success: false, reason: 'Token refresh failed' });
  });

  test('auth/RLS failures never interrupt active timer (non-blocking)', async () => {
    // This test verifies that pushPendingChanges returns a result
    // (doesn't throw) even when auth errors occur, ensuring the timer
    // can continue operating independently.
    const session = createSession({ status: 'ACTIVE' });
    await enqueue(session);

    const mockUpsert = jest.fn().mockResolvedValue({
      error: { message: 'JWT expired', status: 401 },
    });
    (mockSupabase.from as jest.Mock).mockReturnValue({ upsert: mockUpsert });
    mockRefreshToken.mockResolvedValue(null);

    // Should not throw — returns result with errors
    const result = await pushPendingChanges();
    expect(result).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ─── Pull Remote Changes Tests ───────────────────────────────────────────────

describe('SyncEngine - pullRemoteChanges', () => {
  test('pulls remote sessions and stores locally', async () => {
    const remoteSessions = [createSession({ sessionId: 'remote-1', status: 'COMPLETED' })];

    (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'fasting_sessions') {
        return { select: jest.fn().mockResolvedValue({ data: remoteSessions, error: null }) };
      }
      if (table === 'fasting_plans') {
        return { select: jest.fn().mockResolvedValue({ data: [{ planId: 'plan-16-8', fastingHours: 16, eatingHours: 8 }], error: null }) };
      }
      return { select: jest.fn().mockResolvedValue({ data: [], error: null }) };
    });

    mockRecomputeStreaks.mockReturnValue({
      currentStreak: 1,
      longestStreak: 1,
      lastStreakDate: '2024-01-01',
      streakDays: new Set(['2024-01-01']),
    });

    const result = await pullRemoteChanges();

    expect(result.pulled).toBeGreaterThan(0);
  });

  test('resolves conflicts when local and remote sessions exist', async () => {
    // Pre-populate local session history
    const localSession = createSession({
      sessionId: 'session-1',
      status: 'ACTIVE',
      updatedAt: '2024-01-01T08:00:00.000Z',
    });
    await AsyncStorage.setItem(
      STORAGE_KEYS.SESSION_HISTORY,
      JSON.stringify([localSession]),
    );

    const remoteSession = createSession({
      sessionId: 'session-1',
      status: 'COMPLETED',
      updatedAt: '2024-01-01T12:00:00.000Z',
    });

    (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'fasting_sessions') {
        return { select: jest.fn().mockResolvedValue({ data: [remoteSession], error: null }) };
      }
      if (table === 'fasting_plans') {
        return { select: jest.fn().mockResolvedValue({ data: [{ planId: 'plan-16-8', fastingHours: 16, eatingHours: 8 }], error: null }) };
      }
      return { select: jest.fn().mockResolvedValue({ data: [], error: null }) };
    });

    mockRecomputeStreaks.mockReturnValue({
      currentStreak: 0,
      longestStreak: 0,
      lastStreakDate: null,
      streakDays: new Set(),
    });

    const result = await pullRemoteChanges();

    expect(result.conflicts).toBeGreaterThan(0);

    // Verify the resolved session is COMPLETED (terminal beats ACTIVE)
    const stored = JSON.parse(
      (await AsyncStorage.getItem(STORAGE_KEYS.SESSION_HISTORY))!,
    ) as FastingSession[];
    expect(stored[0]!.status).toBe('COMPLETED');
  });

  test('triggers streak recomputation after pull', async () => {
    const remoteSessions = [
      createSession({ sessionId: 'session-1', status: 'COMPLETED', durationFasted: 57600 }),
    ];
    const plans = [{ planId: 'plan-16-8', name: '16:8', fastingHours: 16, eatingHours: 8 }];

    (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'fasting_sessions') {
        return { select: jest.fn().mockResolvedValue({ data: remoteSessions, error: null }) };
      }
      if (table === 'daily_stats') {
        return { select: jest.fn().mockResolvedValue({ data: [], error: null }) };
      }
      if (table === 'fasting_plans') {
        return { select: jest.fn().mockResolvedValue({ data: plans, error: null }) };
      }
      return { select: jest.fn().mockResolvedValue({ data: [], error: null }) };
    });

    mockRecomputeStreaks.mockReturnValue({
      currentStreak: 1,
      longestStreak: 1,
      lastStreakDate: '2024-01-01',
      streakDays: new Set(['2024-01-01']),
    });

    await pullRemoteChanges();

    expect(mockRecomputeStreaks).toHaveBeenCalled();
  });

  test('handles pull errors gracefully', async () => {
    const mockSelect = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Network error' },
    });
    (mockSupabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

    const result = await pullRemoteChanges();

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toBe('Network error');
  });
});
