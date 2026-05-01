/**
 * SubscriptionManager Domain Service
 *
 * Manages local mock subscription state and feature gating.
 * For MVP, subscription state is a local mock flag (FREE or PRO_MOCK)
 * with no real billing integration.
 *
 * Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5
 */

import { v4 as uuidv4 } from 'uuid';
import { SubscriptionStatus, SubscriptionTier, UserProfile } from '../models/index';
import { ProFeature, PRO_FEATURES, ALL_PREDEFINED_PLANS, FREE_PLANS } from '../models/plans';
import { getItem, setItem } from '../data/localStorage';
import { STORAGE_KEYS } from '../utils/constants';
import { getDefaultFreePlan } from './planSelector';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Default subscription status for new users or when no status is found in storage.
 */
function createDefaultSubscriptionStatus(): SubscriptionStatus {
  const now = new Date().toISOString();
  return {
    subId: uuidv4(),
    userId: 'guest',
    tier: 'free',
    expiryDate: null,
    trialStartDate: null,
    trialEndDate: null,
    provider: 'local',
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Subscription Manager Functions ──────────────────────────────────────────

/**
 * Reads the current subscription status from AsyncStorage.
 * Returns a default FREE status if no status is found.
 *
 * Validates: Requirements 21.4, 21.5
 */
export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const status = await getItem<SubscriptionStatus>(STORAGE_KEYS.SUBSCRIPTION_STATUS);
  if (status === null) {
    return createDefaultSubscriptionStatus();
  }
  return status;
}

/**
 * Determines whether a given feature is Pro-gated.
 *
 * All features in PRO_FEATURES are Pro-only. This function always returns true
 * for any valid ProFeature, since the PRO_FEATURES list defines the complete
 * set of gated features.
 *
 * Validates: Requirement 21.1
 */
export function isProFeature(featureId: ProFeature): boolean {
  return PRO_FEATURES.includes(featureId);
}

/**
 * Checks whether the given subscription tier grants Pro access.
 * Both 'pro' and 'pro_mock' are treated identically for feature gating.
 *
 * Validates: Requirements 21.4 (treats pro and pro_mock identically)
 */
export function hasProAccess(tier: SubscriptionTier): boolean {
  return tier === 'pro' || tier === 'pro_mock';
}

/**
 * Sets the mock subscription status (dev/test toggle for FREE ↔ PRO_MOCK).
 * Writes the new tier to AsyncStorage.
 *
 * Validates: Requirement 21.4 (developer/tester setting to toggle)
 */
export async function setMockStatus(tier: SubscriptionTier): Promise<void> {
  const existing = await getItem<SubscriptionStatus>(STORAGE_KEYS.SUBSCRIPTION_STATUS);
  const now = new Date().toISOString();

  const updatedStatus: SubscriptionStatus = existing
    ? {
        ...existing,
        tier,
        updatedAt: now,
      }
    : {
        subId: uuidv4(),
        userId: 'guest',
        tier,
        expiryDate: null,
        trialStartDate: null,
        trialEndDate: null,
        provider: 'local',
        createdAt: now,
        updatedAt: now,
      };

  await setItem(STORAGE_KEYS.SUBSCRIPTION_STATUS, updatedStatus);
}

/**
 * Handles downgrade from Pro to Free.
 *
 * Reads the user profile and checks if the currently selected plan is Pro-only.
 * If so, reverts the active plan to the first free plan.
 *
 * Validates: Requirement 21.3
 */
export async function handleProDowngrade(): Promise<void> {
  const profile = await getItem<UserProfile>(STORAGE_KEYS.PROFILE);
  if (profile === null) {
    return;
  }

  // Check if the current plan is a Pro plan by looking it up in predefined plans
  const currentPlan = ALL_PREDEFINED_PLANS.find(
    (p) => p.planId === profile.selectedPlanId,
  );

  // If the current plan is Pro-only, revert to the default free plan
  if (currentPlan && currentPlan.isPro) {
    const defaultPlan = getDefaultFreePlan();
    const updatedProfile: UserProfile = {
      ...profile,
      selectedPlanId: defaultPlan.planId,
      updatedAt: new Date().toISOString(),
    };
    await setItem(STORAGE_KEYS.PROFILE, updatedProfile);
    return;
  }

  // If the plan is not found in predefined plans, it might be a custom plan.
  // Custom plans are always Pro-gated, so revert to free plan.
  if (!currentPlan && profile.selectedPlanId) {
    const isFreePlan = FREE_PLANS.some((p) => p.planId === profile.selectedPlanId);
    if (!isFreePlan) {
      const defaultPlan = getDefaultFreePlan();
      const updatedProfile: UserProfile = {
        ...profile,
        selectedPlanId: defaultPlan.planId,
        updatedAt: new Date().toISOString(),
      };
      await setItem(STORAGE_KEYS.PROFILE, updatedProfile);
    }
  }
}
