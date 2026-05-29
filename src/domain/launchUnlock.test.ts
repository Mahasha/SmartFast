/**
 * Verifies the v1 launch behavior: when PRO_UNLOCKED_FOR_LAUNCH is enabled,
 * every user has full Pro access and no plans are gated. Guards against the
 * flag/wiring silently regressing and re-locking features before billing ships.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Force the launch flag on regardless of its real default.
jest.mock('../utils/featureFlags', () => ({ PRO_UNLOCKED_FOR_LAUNCH: true }));

import { hasProAccess } from './subscriptionManager';
import { getAvailablePlans, createCustomPlan } from './planSelector';

beforeEach(() => {
  (AsyncStorage.clear as jest.Mock)();
});

describe('PRO_UNLOCKED_FOR_LAUNCH', () => {
  it('grants Pro access to the free tier', () => {
    expect(hasProAccess('free')).toBe(true);
    expect(hasProAccess('pro')).toBe(true);
    expect(hasProAccess('pro_mock')).toBe(true);
  });

  it('leaves no plan locked for a free user', async () => {
    const plans = await getAvailablePlans('free');
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every((p) => p.isLocked === false)).toBe(true);
  });

  it('allows a free user to create a custom plan', async () => {
    const plan = await createCustomPlan(20, 'free');
    expect(plan.fastingHours).toBe(20);
    expect(plan.isCustom).toBe(true);
  });
});
