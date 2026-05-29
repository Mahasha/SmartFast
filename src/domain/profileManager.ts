/**
 * ProfileManager — Single source of truth for persisting the user profile.
 *
 * Writes go to two places at once:
 *  - the active PROFILE key (what every screen reads), and
 *  - a per-user ledger (Record<userId, UserProfile>) that survives logout.
 *
 * The active PROFILE key is wiped on logout and syncEngine does not pull the
 * profiles table, so without the ledger any local profile change (plan, units,
 * display name) would be lost and reset on next login. All profile mutations
 * must route through saveProfile so the ledger never goes stale.
 */

import { UserProfile } from '../models/index';
import { getItem, setItem } from '../data/localStorage';
import { STORAGE_KEYS } from '../utils/constants';

type ProfileLedger = Record<string, UserProfile>;

async function getProfileLedger(): Promise<ProfileLedger> {
  return (await getItem<ProfileLedger>(STORAGE_KEYS.PROFILE_LEDGER)) ?? {};
}

/**
 * Returns the ledger entry for a user, if any. Used on login to restore the
 * profile after logout wiped the active PROFILE key.
 */
export async function getLedgerProfile(userId: string): Promise<UserProfile | undefined> {
  const ledger = await getProfileLedger();
  return ledger[userId];
}

/**
 * Persists a profile to the active PROFILE key and the per-user ledger.
 * Guest profiles are intentionally local-only, so they skip the ledger.
 */
export async function saveProfile(profile: UserProfile): Promise<void> {
  await setItem(STORAGE_KEYS.PROFILE, profile);
  if (profile.userId && profile.userId !== 'guest') {
    const ledger = await getProfileLedger();
    ledger[profile.userId] = profile;
    await setItem(STORAGE_KEYS.PROFILE_LEDGER, ledger);
  }
}
