/**
 * Unit tests for SubscriptionManager domain service
 *
 * Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5
 */

import {
  getSubscriptionStatus,
  isProFeature,
  hasProAccess,
  setMockStatus,
  handleProDowngrade,
} from './subscriptionManager';
import { SubscriptionStatus, UserProfile } from '../models/index';
import { PRO_FEATURES } from '../models/plans';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';

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

const mockSubscriptionStatus: SubscriptionStatus = {
  subId: 'sub-1',
  userId: 'user-1',
  tier: 'pro_mock',
  expiryDate: null,
  trialStartDate: null,
  trialEndDate: null,
  provider: 'local',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.clear as jest.Mock)();
});

describe('getSubscriptionStatus', () => {
  it('returns stored subscription status from AsyncStorage', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.SUBSCRIPTION_STATUS,
      JSON.stringify(mockSubscriptionStatus),
    );

    const status = await getSubscriptionStatus();
    expect(status.tier).toBe('pro_mock');
    expect(status.provider).toBe('local');
  });

  it('returns default FREE status when nothing is stored', async () => {
    const status = await getSubscriptionStatus();
    expect(status.tier).toBe('free');
    expect(status.provider).toBe('local');
    expect(status.expiryDate).toBeNull();
  });
});

describe('isProFeature', () => {
  it('returns true for all defined Pro features', () => {
    PRO_FEATURES.forEach((feature) => {
      expect(isProFeature(feature)).toBe(true);
    });
  });

  it('returns true for PRO_PLANS feature', () => {
    expect(isProFeature('PRO_PLANS')).toBe(true);
  });

  it('returns true for CUSTOM_PLANS feature', () => {
    expect(isProFeature('CUSTOM_PLANS')).toBe(true);
  });
});

describe('hasProAccess', () => {
  it('returns false for free tier', () => {
    expect(hasProAccess('free')).toBe(false);
  });

  it('returns true for pro tier', () => {
    expect(hasProAccess('pro')).toBe(true);
  });

  it('returns true for pro_mock tier', () => {
    expect(hasProAccess('pro_mock')).toBe(true);
  });
});

describe('setMockStatus', () => {
  it('sets tier to pro_mock when toggling from free', async () => {
    await setMockStatus('pro_mock');

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SUBSCRIPTION_STATUS);
    const status = JSON.parse(raw!) as SubscriptionStatus;
    expect(status.tier).toBe('pro_mock');
    expect(status.provider).toBe('local');
  });

  it('sets tier to free when toggling from pro_mock', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.SUBSCRIPTION_STATUS,
      JSON.stringify(mockSubscriptionStatus),
    );

    await setMockStatus('free');

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SUBSCRIPTION_STATUS);
    const status = JSON.parse(raw!) as SubscriptionStatus;
    expect(status.tier).toBe('free');
  });

  it('preserves existing subscription metadata when updating tier', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.SUBSCRIPTION_STATUS,
      JSON.stringify(mockSubscriptionStatus),
    );

    await setMockStatus('free');

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SUBSCRIPTION_STATUS);
    const status = JSON.parse(raw!) as SubscriptionStatus;
    expect(status.subId).toBe('sub-1');
    expect(status.userId).toBe('user-1');
  });

  it('updates the updatedAt timestamp', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.SUBSCRIPTION_STATUS,
      JSON.stringify(mockSubscriptionStatus),
    );

    await setMockStatus('free');

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SUBSCRIPTION_STATUS);
    const status = JSON.parse(raw!) as SubscriptionStatus;
    expect(new Date(status.updatedAt).getTime()).toBeGreaterThan(
      new Date(mockSubscriptionStatus.updatedAt).getTime(),
    );
  });
});

describe('handleProDowngrade', () => {
  it('reverts Pro plan to first free plan on downgrade', async () => {
    const proProfile: UserProfile = {
      ...mockProfile,
      selectedPlanId: 'plan-20-4', // Pro plan
    };
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(proProfile));

    await handleProDowngrade();

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
    const updated = JSON.parse(raw!) as UserProfile;
    expect(updated.selectedPlanId).toBe('plan-12-12'); // First free plan
  });

  it('does not change plan if already on a free plan', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(mockProfile));

    await handleProDowngrade();

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
    const updated = JSON.parse(raw!) as UserProfile;
    expect(updated.selectedPlanId).toBe('plan-16-8'); // Unchanged
  });

  it('reverts custom plan (unknown planId) to free plan on downgrade', async () => {
    const customProfile: UserProfile = {
      ...mockProfile,
      selectedPlanId: 'custom-plan-uuid', // Custom plan not in predefined
    };
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(customProfile));

    await handleProDowngrade();

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
    const updated = JSON.parse(raw!) as UserProfile;
    expect(updated.selectedPlanId).toBe('plan-12-12');
  });

  it('does nothing if no profile exists', async () => {
    // Should not throw
    await expect(handleProDowngrade()).resolves.toBeUndefined();
  });
});
