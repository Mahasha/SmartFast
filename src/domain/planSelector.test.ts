/**
 * Unit tests for PlanSelector domain service
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */

import {
  getAvailablePlans,
  selectPlan,
  createCustomPlan,
  isProPlan,
  getDefaultFreePlan,
} from './planSelector';
import { UserProfile } from '../models/index';
import { FREE_PLANS, PRO_PLANS, ALL_PREDEFINED_PLANS } from '../models/plans';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';

// These tests validate the underlying free/Pro plan gating, which returns when
// real billing ships. The v1 launch flag (which unlocks everything) is covered
// separately in launchUnlock.test.ts.
jest.mock('../utils/featureFlags', () => ({ PRO_UNLOCKED_FOR_LAUNCH: false }));

const mockProfile: UserProfile = {
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

describe('getAvailablePlans', () => {
  it('returns all predefined plans', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(mockProfile));

    const plans = await getAvailablePlans('free');
    expect(plans).toHaveLength(ALL_PREDEFINED_PLANS.length);
  });

  it('marks Pro plans as locked when tier is free', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(mockProfile));

    const plans = await getAvailablePlans('free');
    const proPlanDisplays = plans.filter((p) => p.plan.isPro);
    const freePlanDisplays = plans.filter((p) => !p.plan.isPro);

    proPlanDisplays.forEach((p) => expect(p.isLocked).toBe(true));
    freePlanDisplays.forEach((p) => expect(p.isLocked).toBe(false));
  });

  it('marks Pro plans as unlocked when tier is pro_mock', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(mockProfile));

    const plans = await getAvailablePlans('pro_mock');
    plans.forEach((p) => expect(p.isLocked).toBe(false));
  });

  it('marks Pro plans as unlocked when tier is pro', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(mockProfile));

    const plans = await getAvailablePlans('pro');
    plans.forEach((p) => expect(p.isLocked).toBe(false));
  });

  it('marks the selected plan as isSelected', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(mockProfile));

    const plans = await getAvailablePlans('free');
    const selected = plans.filter((p) => p.isSelected);
    expect(selected).toHaveLength(1);
    expect(selected[0]!.plan.planId).toBe('plan-16-8');
  });

  it('handles missing profile gracefully (no plan selected)', async () => {
    const plans = await getAvailablePlans('free');
    plans.forEach((p) => expect(p.isSelected).toBe(false));
  });
});

describe('selectPlan', () => {
  it('updates the selectedPlanId in the user profile', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(mockProfile));

    await selectPlan('plan-14-10');

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
    const updated = JSON.parse(raw!) as UserProfile;
    expect(updated.selectedPlanId).toBe('plan-14-10');
  });

  it('updates the updatedAt timestamp', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(mockProfile));

    await selectPlan('plan-14-10');

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
    const updated = JSON.parse(raw!) as UserProfile;
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
      new Date(mockProfile.updatedAt).getTime(),
    );
  });

  it('throws if no profile exists', async () => {
    await expect(selectPlan('plan-14-10')).rejects.toThrow(
      'User profile not found',
    );
  });
});

describe('createCustomPlan', () => {
  it('creates a custom plan with valid fasting hours and pro_mock tier', async () => {
    const plan = await createCustomPlan(18, 'pro_mock');

    expect(plan.fastingHours).toBe(18);
    expect(plan.eatingHours).toBe(6);
    expect(plan.isCustom).toBe(true);
    expect(plan.isPro).toBe(true);
    expect(plan.name).toBe('Custom 18h');
    expect(plan.planId).toBeDefined();
  });

  it('creates a custom plan with pro tier', async () => {
    const plan = await createCustomPlan(20, 'pro');

    expect(plan.fastingHours).toBe(20);
    expect(plan.isCustom).toBe(true);
    expect(plan.isPro).toBe(true);
  });

  it('sets eatingHours to 0 for plans exceeding 24h', async () => {
    const plan = await createCustomPlan(36, 'pro_mock');

    expect(plan.fastingHours).toBe(36);
    expect(plan.eatingHours).toBe(0);
  });

  it('throws if tier is free', async () => {
    await expect(createCustomPlan(18, 'free')).rejects.toThrow(
      'Custom plans require a Pro subscription',
    );
  });

  it('throws if fasting hours is less than 1', async () => {
    await expect(createCustomPlan(0, 'pro_mock')).rejects.toThrow(
      'Custom plan fasting hours must be between 1 and 48',
    );
  });

  it('throws if fasting hours exceeds 48', async () => {
    await expect(createCustomPlan(49, 'pro_mock')).rejects.toThrow(
      'Custom plan fasting hours must be between 1 and 48',
    );
  });

  it('allows boundary value of 1 hour', async () => {
    const plan = await createCustomPlan(1, 'pro_mock');
    expect(plan.fastingHours).toBe(1);
    expect(plan.eatingHours).toBe(23);
  });

  it('allows boundary value of 48 hours', async () => {
    const plan = await createCustomPlan(48, 'pro_mock');
    expect(plan.fastingHours).toBe(48);
    expect(plan.eatingHours).toBe(0);
  });
});

describe('isProPlan', () => {
  it('returns true for Pro plans', () => {
    PRO_PLANS.forEach((plan) => {
      expect(isProPlan(plan)).toBe(true);
    });
  });

  it('returns false for free plans', () => {
    FREE_PLANS.forEach((plan) => {
      expect(isProPlan(plan)).toBe(false);
    });
  });
});

describe('getDefaultFreePlan', () => {
  it('returns the first free plan (12:12)', () => {
    const plan = getDefaultFreePlan();
    expect(plan.planId).toBe('plan-12-12');
    expect(plan.isPro).toBe(false);
  });
});
