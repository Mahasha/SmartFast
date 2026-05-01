/**
 * SyncEngine — Manages bidirectional sync between AsyncStorage and Supabase
 * with session-aware conflict resolution.
 *
 * - Enqueues local changes to a sync queue stored in @fasttrack:syncQueue
 * - Pushes pending changes chronologically to Supabase
 * - Pulls remote changes and merges with local data
 * - Resolves conflicts using session-aware rules (terminal > ACTIVE, latest updatedAt)
 * - Handles token refresh and retry on RLS/auth errors
 * - Triggers streak recomputation after pull
 * - Never blocks the UI — all operations are background
 *
 * Validates: Requirements 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7, 23.8,
 *            8.1, 8.2, 8.3, 35.10, 35.11, 35.12, 35.13
 */

import { v4 as uuidv4 } from 'uuid';

import {
  FastingSession,
  SyncableRecord,
  SyncQueueEntry,
  TERMINAL_STATUSES,
  SessionStatus,
} from '../models/index';
import { getItem, setItem } from './localStorage';
import { supabase } from './supabaseClient';
import { refreshToken } from '../domain/authManager';
import { recomputeStreaks } from '../domain/streakEngine';
import { STORAGE_KEYS } from '../utils/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  errors: SyncError[];
}

export interface SyncError {
  recordId: string;
  message: string;
  isAuthError: boolean;
}

export type SyncRetryResult =
  | { success: true }
  | { success: false; reason: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Determines the record type for a SyncableRecord based on its shape.
 */
function getRecordType(record: SyncableRecord): SyncQueueEntry['recordType'] {
  if ('sessionId' in record) return 'fasting_session';
  if ('statsId' in record) return 'daily_stats';
  if ('streakId' in record) return 'streak';
  if ('prefId' in record) return 'notification_preference';
  return 'profile';
}

/**
 * Extracts the primary ID from a SyncableRecord.
 */
function getRecordId(record: SyncableRecord): string {
  if ('sessionId' in record) return record.sessionId;
  if ('statsId' in record) return record.statsId;
  if ('streakId' in record) return record.streakId;
  if ('prefId' in record) return record.prefId;
  if ('userId' in record) return record.userId;
  return '';
}

/**
 * Returns the Supabase table name for a given record type.
 */
function getTableName(recordType: SyncQueueEntry['recordType']): string {
  switch (recordType) {
    case 'fasting_session':
      return 'fasting_sessions';
    case 'daily_stats':
      return 'daily_stats';
    case 'streak':
      return 'streaks';
    case 'notification_preference':
      return 'notification_preferences';
    case 'profile':
      return 'profiles';
  }
}

/**
 * Checks if an error is an auth/RLS/JWT error.
 */
function isAuthRlsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { message?: string; code?: string; status?: number };
  const message = (err.message ?? '').toLowerCase();
  const code = (err.code ?? '').toLowerCase();
  const status = err.status ?? 0;

  return (
    status === 401 ||
    status === 403 ||
    code === 'pgrst301' ||
    code === '42501' ||
    message.includes('jwt') ||
    message.includes('token') ||
    message.includes('expired') ||
    message.includes('rls') ||
    message.includes('permission') ||
    message.includes('unauthorized') ||
    message.includes('forbidden')
  );
}

/**
 * Checks if a session status is terminal.
 */
function isTerminalStatus(status: SessionStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

// ─── Sync Queue Management ───────────────────────────────────────────────────

/**
 * Reads the current sync queue from AsyncStorage.
 */
async function getQueue(): Promise<SyncQueueEntry[]> {
  const queue = await getItem<SyncQueueEntry[]>(STORAGE_KEYS.SYNC_QUEUE);
  return queue ?? [];
}

/**
 * Writes the sync queue to AsyncStorage.
 */
async function saveQueue(queue: SyncQueueEntry[]): Promise<void> {
  await setItem(STORAGE_KEYS.SYNC_QUEUE, queue);
}

// ─── Core SyncEngine Functions ───────────────────────────────────────────────

/**
 * Enqueues a record for sync. Adds it to the sync queue in AsyncStorage.
 *
 * Validates: Requirements 23.3, 8.2
 */
export async function enqueue(record: SyncableRecord): Promise<void> {
  const queue = await getQueue();

  const entry: SyncQueueEntry = {
    id: uuidv4(),
    recordType: getRecordType(record),
    recordId: getRecordId(record),
    operation: 'CREATE',
    payload: record,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };

  // If there's already an entry for this record, update it (dedup)
  const existingIndex = queue.findIndex(
    (e) => e.recordId === entry.recordId && e.recordType === entry.recordType,
  );

  if (existingIndex >= 0) {
    entry.operation = 'UPDATE';
    entry.retryCount = queue[existingIndex]!.retryCount;
    queue[existingIndex] = entry;
  } else {
    queue.push(entry);
  }

  await saveQueue(queue);
}

/**
 * Returns the number of entries in the sync queue.
 *
 * Validates: Requirement 23.6
 */
export async function getSyncQueueSize(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

/**
 * Pushes all pending changes to Supabase in chronological order.
 * On auth/RLS errors, attempts token refresh and retry once.
 * Never blocks the UI.
 *
 * Validates: Requirements 23.3, 23.4, 23.5, 23.6, 8.3, 35.10, 35.11, 35.12, 35.13
 */
export async function pushPendingChanges(): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, conflicts: 0, errors: [] };
  const queue = await getQueue();

  if (queue.length === 0) {
    return result;
  }

  // Sort chronologically by createdAt
  const sorted = [...queue].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const remaining: SyncQueueEntry[] = [];

  for (const entry of sorted) {
    const tableName = getTableName(entry.recordType);

    try {
      const { error } = await supabase.from(tableName).upsert(entry.payload);

      if (error) {
        if (isAuthRlsError(error)) {
          // Attempt token refresh and retry (Requirements 35.10, 35.11)
          const retryResult = await refreshTokenAndRetry(entry);
          if (retryResult.success) {
            result.pushed++;
          } else {
            // Keep in queue (Requirement 35.12)
            entry.retryCount++;
            remaining.push(entry);
            result.errors.push({
              recordId: entry.recordId,
              message: retryResult.reason,
              isAuthError: true,
            });
          }
        } else {
          // Network or other error — keep in queue (Requirement 23.4)
          entry.retryCount++;
          remaining.push(entry);
          result.errors.push({
            recordId: entry.recordId,
            message: error.message,
            isAuthError: false,
          });
        }
      } else {
        result.pushed++;
      }
    } catch (err) {
      // Network error — keep in queue
      entry.retryCount++;
      remaining.push(entry);
      result.errors.push({
        recordId: entry.recordId,
        message: err instanceof Error ? err.message : 'Unknown error',
        isAuthError: false,
      });
    }
  }

  await saveQueue(remaining);
  return result;
}

/**
 * Pulls remote changes from Supabase and merges with local data.
 * After pull completes, triggers streak recomputation.
 *
 * Validates: Requirements 23.2, 23.5, 23.7, 23.8
 */
export async function pullRemoteChanges(): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, conflicts: 0, errors: [] };

  try {
    // Pull fasting sessions
    const { data: remoteSessions, error: sessionsError } = await supabase
      .from('fasting_sessions')
      .select('*');

    if (sessionsError) {
      result.errors.push({
        recordId: '',
        message: sessionsError.message,
        isAuthError: isAuthRlsError(sessionsError),
      });
      return result;
    }

    if (remoteSessions && remoteSessions.length > 0) {
      // Get local session history
      const localSessions =
        (await getItem<FastingSession[]>(STORAGE_KEYS.SESSION_HISTORY)) ?? [];

      const localMap = new Map<string, FastingSession>();
      for (const session of localSessions) {
        localMap.set(session.sessionId, session);
      }

      // Merge remote sessions with local
      for (const remote of remoteSessions as FastingSession[]) {
        const local = localMap.get(remote.sessionId);

        if (!local) {
          // New remote record — add locally
          localMap.set(remote.sessionId, remote);
          result.pulled++;
        } else {
          // Conflict — resolve using session-aware rules
          const resolved = resolveSessionConflict(local, remote);
          if (resolved !== local) {
            result.conflicts++;
          }
          localMap.set(remote.sessionId, resolved);
          result.pulled++;
        }
      }

      const mergedSessions = Array.from(localMap.values());
      await setItem(STORAGE_KEYS.SESSION_HISTORY, mergedSessions);

      // Trigger streak recomputation after sync (Requirement 23.8)
      await triggerStreakRecomputation(mergedSessions);
    }

    // Pull daily stats
    const { data: remoteStats, error: statsError } = await supabase
      .from('daily_stats')
      .select('*');

    if (!statsError && remoteStats) {
      for (const stat of remoteStats) {
        const key = `${STORAGE_KEYS.DAILY_STATS_PREFIX}${stat.localDate}`;
        const localStat = await getItem(key);
        if (!localStat) {
          await setItem(key, stat);
          result.pulled++;
        } else {
          const resolved = resolveConflict(localStat as SyncableRecord, stat as SyncableRecord);
          await setItem(key, resolved);
          result.pulled++;
        }
      }
    }
  } catch (err) {
    result.errors.push({
      recordId: '',
      message: err instanceof Error ? err.message : 'Unknown error',
      isAuthError: false,
    });
  }

  return result;
}

/**
 * Resolves a generic sync conflict between local and remote records.
 * Uses updatedAt timestamp — most recent wins.
 *
 * Validates: Requirement 23.5
 */
export function resolveConflict(
  local: SyncableRecord,
  remote: SyncableRecord,
): SyncableRecord {
  // For fasting sessions, use session-specific rules
  if ('sessionId' in local && 'sessionId' in remote) {
    return resolveSessionConflict(local as FastingSession, remote as FastingSession);
  }

  // Generic conflict resolution: latest updatedAt wins
  const localUpdatedAt = 'updatedAt' in local ? (local as { updatedAt: string }).updatedAt : '';
  const remoteUpdatedAt = 'updatedAt' in remote ? (remote as { updatedAt: string }).updatedAt : '';

  if (remoteUpdatedAt > localUpdatedAt) {
    return remote;
  }
  return local;
}

/**
 * Resolves a fasting session sync conflict using session-aware rules.
 *
 * Rules (Requirement 23.7):
 * 1. Terminal status beats ACTIVE (never overwrite terminal with ACTIVE)
 * 2. Both terminal: latest updatedAt wins
 * 3. Both ACTIVE: latest updatedAt wins; startTime protected
 * 4. ACTIVE endTime differs (plan change): latest updatedAt wins
 *
 * Validates: Requirement 23.7
 */
export function resolveSessionConflict(
  local: FastingSession,
  remote: FastingSession,
): FastingSession {
  const localTerminal = isTerminalStatus(local.status);
  const remoteTerminal = isTerminalStatus(remote.status);

  // Rule 1: Terminal status beats ACTIVE
  if (localTerminal && !remoteTerminal) {
    return local;
  }
  if (remoteTerminal && !localTerminal) {
    return remote;
  }

  // Rule 2: Both terminal — latest updatedAt wins
  if (localTerminal && remoteTerminal) {
    return remote.updatedAt > local.updatedAt ? remote : local;
  }

  // Rule 3 & 4: Both ACTIVE — latest updatedAt wins, but protect startTime
  const winner = remote.updatedAt > local.updatedAt ? remote : local;
  const loser = winner === remote ? local : remote;

  // Protect startTime: use the original startTime (from the loser if winner changed it)
  // startTime must not change unless session was created locally with no remote equivalent
  // Since both exist (local and remote), startTime should be preserved from the earlier record
  return {
    ...winner,
    startTime: loser.startTime < winner.startTime ? loser.startTime : winner.startTime,
  };
}

/**
 * Attempts token refresh and retries a failed sync entry once.
 *
 * Validates: Requirements 35.10, 35.11, 35.12, 35.13
 */
export async function refreshTokenAndRetry(
  failedEntry: SyncQueueEntry,
): Promise<SyncRetryResult> {
  // Attempt token refresh (Requirement 35.10)
  const session = await refreshToken();

  if (!session) {
    return { success: false, reason: 'Token refresh failed' };
  }

  // Retry the write once (Requirement 35.11)
  const tableName = getTableName(failedEntry.recordType);

  try {
    const { error } = await supabase.from(tableName).upsert(failedEntry.payload);

    if (error) {
      // Retry failed — keep in queue (Requirement 35.12)
      return { success: false, reason: error.message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      reason: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// ─── Streak Recomputation Trigger ────────────────────────────────────────────

/**
 * Triggers streak recomputation after sync pull completes.
 * Loads plans from local storage and calls StreakEngine.recomputeStreaks.
 *
 * Validates: Requirement 23.8
 */
async function triggerStreakRecomputation(sessions: FastingSession[]): Promise<void> {
  try {
    // Load plans from Supabase or local cache
    const { data: plans } = await supabase.from('fasting_plans').select('*');

    if (plans && plans.length > 0) {
      const streakResult = recomputeStreaks(sessions, plans, new Date());

      // Update cached streak record
      const existingStreak = await getItem<{ streakId: string; userId: string; createdAt: string }>(
        STORAGE_KEYS.STREAK,
      );

      const streakRecord = {
        streakId: existingStreak?.streakId ?? uuidv4(),
        userId: existingStreak?.userId ?? '',
        currentStreak: streakResult.currentStreak,
        longestStreak: streakResult.longestStreak,
        lastStreakDate: streakResult.lastStreakDate,
        sessionCountSnapshot: sessions.length,
        createdAt: existingStreak?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setItem(STORAGE_KEYS.STREAK, streakRecord);
    }
  } catch {
    // Streak recomputation failure is non-blocking
    console.error('[SyncEngine] Failed to recompute streaks after sync');
  }
}
