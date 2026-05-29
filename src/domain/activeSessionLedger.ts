/**
 * ActiveSessionLedger — Per-user persistence for an in-progress fast.
 *
 * The active session lives at the ACTIVE_SESSION key, which logout wipes (to
 * avoid one account's fast leaking into the next). This ledger keeps a copy
 * keyed by userId that survives logout, so signing back in restores the fast.
 *
 * The countdown is derived from the session's startTime/endTime, so a restored
 * session resumes counting at the correct remaining time with no extra work.
 */

import { FastingSession } from '../models/index';
import { getItem, setItem } from '../data/localStorage';
import { STORAGE_KEYS } from '../utils/constants';

type ActiveSessionLedger = Record<string, FastingSession>;

async function getLedger(): Promise<ActiveSessionLedger> {
  return (await getItem<ActiveSessionLedger>(STORAGE_KEYS.ACTIVE_SESSION_LEDGER)) ?? {};
}

async function saveLedger(ledger: ActiveSessionLedger): Promise<void> {
  await setItem(STORAGE_KEYS.ACTIVE_SESSION_LEDGER, ledger);
}

/**
 * Records the active session for a user. Stamps the authenticated userId onto
 * the stored copy so a later restore is correctly attributed. Only ACTIVE
 * sessions for a real (non-guest) user are kept — guests are local-only.
 */
export async function saveActiveSessionToLedger(
  userId: string,
  session: FastingSession,
): Promise<void> {
  if (!userId || userId === 'guest') return;
  if (session.status !== 'ACTIVE') return;
  const ledger = await getLedger();
  ledger[userId] = { ...session, userId };
  await saveLedger(ledger);
}

/**
 * Removes a user's ledger entry once their fast ends, cancels, or completes.
 */
export async function clearActiveSessionFromLedger(userId: string): Promise<void> {
  if (!userId || userId === 'guest') return;
  const ledger = await getLedger();
  if (ledger[userId]) {
    delete ledger[userId];
    await saveLedger(ledger);
  }
}

/**
 * On login, writes any ledgered active session back to the ACTIVE_SESSION key
 * so the app's launch/restore flow picks it up and resumes the timer. Returns
 * the restored session, or null if the user had none.
 */
export async function restoreActiveSessionFromLedger(
  userId: string,
): Promise<FastingSession | null> {
  if (!userId || userId === 'guest') return null;
  const ledger = await getLedger();
  const session = ledger[userId];
  if (!session) return null;
  await setItem(STORAGE_KEYS.ACTIVE_SESSION, session);
  return session;
}
