/**
 * Unit tests for ProfileManager.
 *
 * Guards the invariant that every profile write also updates the per-user
 * ledger, so a change (e.g. selected plan) survives logout/login instead of
 * being reset to a stale value.
 */

import { saveProfile, getLedgerProfile } from './profileManager';
import { UserProfile } from '../models/index';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';

const baseProfile: UserProfile = {
  userId: 'user-1',
  displayName: 'Test User',
  email: 'test@example.com',
  selectedPlanId: 'plan-16-8',
  unitPreference: 'metric',
  themePreference: 'system',
  onboardingCompleted: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.clear as jest.Mock)();
});

describe('saveProfile', () => {
  it('writes the active PROFILE key and the per-user ledger', async () => {
    await saveProfile(baseProfile);

    const active = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
    expect(JSON.parse(active!).selectedPlanId).toBe('plan-16-8');

    const ledgered = await getLedgerProfile('user-1');
    expect(ledgered?.selectedPlanId).toBe('plan-16-8');
  });

  it('persists a plan change to the ledger so it survives an active-key wipe', async () => {
    await saveProfile(baseProfile);
    await saveProfile({ ...baseProfile, selectedPlanId: 'plan-20-4' });

    // Simulate logout wiping the active key (ledger is preserved).
    await AsyncStorage.removeItem(STORAGE_KEYS.PROFILE);

    const restored = await getLedgerProfile('user-1');
    expect(restored?.selectedPlanId).toBe('plan-20-4');
  });

  it('does not write a guest profile to the ledger', async () => {
    await saveProfile({ ...baseProfile, userId: 'guest' });

    const active = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
    expect(active).not.toBeNull();
    expect(await getLedgerProfile('guest')).toBeUndefined();
  });
});
