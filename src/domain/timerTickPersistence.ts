/**
 * Timer Tick Persistence
 *
 * Stores lastTimerCheckUtc and lastKnownElapsedMs in AsyncStorage
 * at minimum every 10 seconds during an ACTIVE fasting session.
 * Used for forward clock jump detection.
 *
 * Validates: Requirements 6.6
 */

import { FastingSession } from '../models/index';
import { getItem, setItem, removeItem } from '../data/localStorage';
import { STORAGE_KEYS } from '../utils/constants';

/** Minimum interval (ms) between persisted ticks */
const PERSIST_INTERVAL_MS = 10_000;

/**
 * Persists the current timer tick data to AsyncStorage.
 *
 * Computes elapsed time from session.startTime and the current time,
 * then stores:
 * - lastTimerCheckUtc: current UTC time as ISO 8601 string
 * - lastKnownElapsedMs: elapsed milliseconds since session start
 */
export async function persistTimerTick(session: FastingSession): Promise<void> {
  const now = new Date();
  const startMs = new Date(session.startTime).getTime();
  const elapsedMs = now.getTime() - startMs;

  await setItem(STORAGE_KEYS.LAST_TIMER_CHECK_UTC, now.toISOString());
  await setItem(STORAGE_KEYS.LAST_KNOWN_ELAPSED_MS, elapsedMs);
}

/**
 * Reads the last persisted timer tick data from AsyncStorage.
 *
 * Returns an object with lastTimerCheckUtc and lastKnownElapsedMs,
 * or null if either value is missing.
 */
export async function getLastTimerCheck(): Promise<{
  lastTimerCheckUtc: string;
  lastKnownElapsedMs: number;
} | null> {
  const lastTimerCheckUtc = await getItem<string>(
    STORAGE_KEYS.LAST_TIMER_CHECK_UTC,
  );
  const lastKnownElapsedMs = await getItem<number>(
    STORAGE_KEYS.LAST_KNOWN_ELAPSED_MS,
  );

  if (lastTimerCheckUtc === null || lastKnownElapsedMs === null) {
    return null;
  }

  return { lastTimerCheckUtc, lastKnownElapsedMs };
}

/**
 * Clears both timer tick keys from AsyncStorage.
 * Called when a session ends or is cancelled.
 */
export async function clearTimerTick(): Promise<void> {
  await removeItem(STORAGE_KEYS.LAST_TIMER_CHECK_UTC);
  await removeItem(STORAGE_KEYS.LAST_KNOWN_ELAPSED_MS);
}

/**
 * Determines whether a new tick should be persisted based on the
 * elapsed time since the last persist.
 *
 * Returns true if:
 * - lastPersistTime is null (never persisted), or
 * - At least 10 seconds (PERSIST_INTERVAL_MS) have elapsed since lastPersistTime
 */
export function shouldPersistTick(lastPersistTime: number | null): boolean {
  if (lastPersistTime === null) {
    return true;
  }
  return Date.now() - lastPersistTime >= PERSIST_INTERVAL_MS;
}
