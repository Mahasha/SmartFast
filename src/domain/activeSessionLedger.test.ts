/**
 * Unit tests for ActiveSessionLedger.
 *
 * Guards that an in-progress fast is preserved per-user across a logout wipe of
 * the active key, and restored on next login — so the countdown keeps running.
 */

import {
  saveActiveSessionToLedger,
  clearActiveSessionFromLedger,
  restoreActiveSessionFromLedger,
} from './activeSessionLedger';
import { FastingSession } from '../models/index';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';

const activeSession: FastingSession = {
  sessionId: 'sess-1',
  userId: 'guest',
  planId: 'plan-20-4',
  startTime: '2026-01-01T00:00:00.000Z',
  endTime: '2026-01-01T20:00:00.000Z',
  actualEndTime: null,
  status: 'ACTIVE',
  durationFasted: null,
  timezoneOffsetMinutes: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.clear as jest.Mock)();
});

describe('activeSessionLedger', () => {
  it('restores the fast to the active key after a logout wipe, stamped with the real userId', async () => {
    await saveActiveSessionToLedger('uid-1', activeSession);

    // Simulate logout wiping the active session key (ledger is preserved).
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);

    const restored = await restoreActiveSessionFromLedger('uid-1');
    expect(restored?.sessionId).toBe('sess-1');
    expect(restored?.userId).toBe('uid-1');

    const active = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    expect(JSON.parse(active!).sessionId).toBe('sess-1');
  });

  it('returns null for a user with no ledgered fast', async () => {
    expect(await restoreActiveSessionFromLedger('nobody')).toBeNull();
  });

  it('does not restore another user\'s fast', async () => {
    await saveActiveSessionToLedger('uid-1', activeSession);
    expect(await restoreActiveSessionFromLedger('uid-2')).toBeNull();
  });

  it('clears the ledger entry when the fast ends', async () => {
    await saveActiveSessionToLedger('uid-1', activeSession);
    await clearActiveSessionFromLedger('uid-1');
    expect(await restoreActiveSessionFromLedger('uid-1')).toBeNull();
  });

  it('does not persist a terminal session', async () => {
    await saveActiveSessionToLedger('uid-1', { ...activeSession, status: 'COMPLETED' });
    expect(await restoreActiveSessionFromLedger('uid-1')).toBeNull();
  });

  it('ignores guest users (local-only by design)', async () => {
    await saveActiveSessionToLedger('guest', activeSession);
    expect(await restoreActiveSessionFromLedger('guest')).toBeNull();
  });
});
