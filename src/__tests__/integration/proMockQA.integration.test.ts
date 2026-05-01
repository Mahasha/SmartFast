/**
 * Integration Test: PRO_MOCK QA Validation
 *
 * Verifies that:
 * - All Pro-gated plans and screens work correctly in PRO_MOCK state
 * - All Pro features show lock indicator in FREE state
 * - Downgrade from PRO_MOCK to FREE reverts plan correctly
 * - Feature gating treats 'pro' and 'pro_mock' identically
 *
 * Validates: Requirements 21.1, 21.2, 21.3, 21.4
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getSubscriptionStatus,
  isProFeature,
  hasProAccess,
  setMockStatus,
  handleProDowngrade,
} from '../../domain/subscriptionManager';
import {
  getAvailablePlans,
  selectPlan,
  createCustomPlan,
  isProPlan,
} from '../../domain/planSelector';
import { setItem, getItem } from '../../data/localStorage';
import { STORAGE_KEYS } from '../../utils/constants';
import { UserProfile, SubscriptionTier } from '../../models/index';
import { PRO_FEATURES, PRO_PLANS, FREE_PLANS } from '../../models/plans';

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

describe('PRO_MOCK QA Validation', () => {
  const testProfile: UserProfile = {
    userId: 'user-test',
    displayName: 'Test User',
    email: 'test@example.com',
    selectedPlanId: 'plan-16-8',
    unitPreference: 'metric',
    themePreference: 'system',
    onboardingCompleted: true,
    createdAt: '2024-06-01T00:00:00.000Z',
    updatedAt: '2024-06-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
    await setItem(STORAGE_KEYS.PROFILE, testProfile);
  });

  describe('Pro-gated plans in PRO_MOCK state', () => {
    it('should unlock all Pro plans when tier is PRO_MOCK', async () => {
      const plans = await getAvailablePlans('pro_mock');

      const proPlanDisplays = plans.filter((p) => p.plan.isPro);
      expect(proPlanDisplays.length).toBe(PRO_PLANS.length);

      // All Pro plans should be unlocked
      for (const planDisplay of proPlanDisplays) {
        expect(planDisplay.isLocked).toBe(false);
      }
    });

    it('should allow selecting a Pro plan in PRO_MOCK state', async () => {
      const plans = await getAvailablePlans('pro_mock');
      const proPlan = plans.find((p) => p.plan.planId === 'plan-18-6');

      expect(proPlan).toBeDefined();
      expect(proPlan!.isLocked).toBe(false);

      // Should not throw
      await selectPlan('plan-18-6');

      const profile = await getItem<UserProfile>(STORAGE_KEYS.PROFILE);
      expect(profile!.selectedPlanId).toBe('plan-18-6');
    });

    it('should allow creating custom plans in PRO_MOCK state', async () => {
      const customPlan = await createCustomPlan(20, 'pro_mock');

      expect(customPlan.fastingHours).toBe(20);
      expect(customPlan.isCustom).toBe(true);
      expect(customPlan.isPro).toBe(true);
      expect(customPlan.name).toContain('Custom');
    });
  });

  describe('Pro features show lock indicator in FREE state', () => {
    it('should lock all Pro plans when tier is FREE', async () => {
      const plans = await getAvailablePlans('free');

      const proPlanDisplays = plans.filter((p) => p.plan.isPro);
      expect(proPlanDisplays.length).toBe(PRO_PLANS.length);

      // All Pro plans should be locked
      for (const planDisplay of proPlanDisplays) {
        expect(planDisplay.isLocked).toBe(true);
      }
    });

    it('should keep free plans unlocked regardless of tier', async () => {
      const plans = await getAvailablePlans('free');

      const freePlanDisplays = plans.filter((p) => !p.plan.isPro);
      expect(freePlanDisplays.length).toBe(FREE_PLANS.length);

      for (const planDisplay of freePlanDisplays) {
        expect(planDisplay.isLocked).toBe(false);
      }
    });

    it('should reject custom plan creation in FREE state', async () => {
      await expect(createCustomPlan(20, 'free')).rejects.toThrow(
        'Custom plans require a Pro subscription',
      );
    });

    it('should identify all PRO_FEATURES as Pro-gated', () => {
      for (const feature of PRO_FEATURES) {
        expect(isProFeature(feature)).toBe(true);
      }
    });
  });

  describe('Downgrade from PRO_MOCK to FREE reverts plan', () => {
    it('should revert to free plan when downgrading with a Pro plan selected', async () => {
      // Set up: user has a Pro plan selected
      const proProfile: UserProfile = {
        ...testProfile,
        selectedPlanId: 'plan-18-6', // Pro plan
      };
      await setItem(STORAGE_KEYS.PROFILE, proProfile);

      // Downgrade
      await handleProDowngrade();

      // Should revert to the default free plan
      const profile = await getItem<UserProfile>(STORAGE_KEYS.PROFILE);
      expect(profile!.selectedPlanId).toBe('plan-12-12'); // First free plan
    });

    it('should NOT change plan when downgrading with a free plan selected', async () => {
      // Set up: user has a free plan selected
      const freeProfile: UserProfile = {
        ...testProfile,
        selectedPlanId: 'plan-16-8', // Free plan
      };
      await setItem(STORAGE_KEYS.PROFILE, freeProfile);

      // Downgrade
      await handleProDowngrade();

      // Should keep the free plan
      const profile = await getItem<UserProfile>(STORAGE_KEYS.PROFILE);
      expect(profile!.selectedPlanId).toBe('plan-16-8');
    });

    it('should handle downgrade when no profile exists', async () => {
      await AsyncStorage.clear(); // Remove profile

      // Should not throw
      await expect(handleProDowngrade()).resolves.not.toThrow();
    });

    it('should persist mock status toggle to AsyncStorage', async () => {
      await setMockStatus('pro_mock');

      const status = await getSubscriptionStatus();
      expect(status.tier).toBe('pro_mock');

      await setMockStatus('free');

      const updatedStatus = await getSubscriptionStatus();
      expect(updatedStatus.tier).toBe('free');
    });
  });

  describe('Feature gating treats pro and pro_mock identically', () => {
    it('should grant Pro access for both pro and pro_mock tiers', () => {
      expect(hasProAccess('pro')).toBe(true);
      expect(hasProAccess('pro_mock')).toBe(true);
      expect(hasProAccess('free')).toBe(false);
    });

    it('should unlock plans identically for pro and pro_mock', async () => {
      const proPlans = await getAvailablePlans('pro');
      const proMockPlans = await getAvailablePlans('pro_mock');

      // Both should have the same lock states
      for (let i = 0; i < proPlans.length; i++) {
        expect(proPlans[i]!.isLocked).toBe(proMockPlans[i]!.isLocked);
      }
    });

    it('should allow custom plan creation for both pro and pro_mock', async () => {
      const customPro = await createCustomPlan(18, 'pro');
      const customProMock = await createCustomPlan(18, 'pro_mock');

      expect(customPro.fastingHours).toBe(18);
      expect(customProMock.fastingHours).toBe(18);
      expect(customPro.isCustom).toBe(true);
      expect(customProMock.isCustom).toBe(true);
    });

    it('should correctly identify Pro plans', () => {
      for (const plan of PRO_PLANS) {
        expect(isProPlan(plan)).toBe(true);
      }
      for (const plan of FREE_PLANS) {
        expect(isProPlan(plan)).toBe(false);
      }
    });

    it('should return default FREE status when no subscription exists', async () => {
      const status = await getSubscriptionStatus();

      expect(status.tier).toBe('free');
      expect(status.provider).toBe('local');
      expect(status.userId).toBe('guest');
    });
  });
});
