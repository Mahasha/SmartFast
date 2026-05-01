/**
 * PlanSelector Domain Service
 *
 * Manages fasting plan display, selection, custom plan creation, and Pro gating.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */

import { v4 as uuidv4 } from 'uuid';
import { FastingPlan, SubscriptionTier, UserProfile } from '../models/index';
import { ALL_PREDEFINED_PLANS, FREE_PLANS } from '../models/plans';
import { getItem, setItem } from '../data/localStorage';
import { STORAGE_KEYS } from '../utils/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlanDisplay {
  plan: FastingPlan;
  isLocked: boolean;
  isSelected: boolean;
}

// ─── Plan Selector Functions ─────────────────────────────────────────────────

/**
 * Returns all predefined plans with lock/selection state based on subscription tier.
 *
 * - Free plans are always selectable (isLocked = false).
 * - Pro plans are locked (isLocked = true) when tier is 'free'.
 * - Pro plans are unlocked (isLocked = false) when tier is 'pro' or 'pro_mock'.
 * - isSelected is true for the plan matching the user's selectedPlanId.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.7
 */
export async function getAvailablePlans(
  subscriptionTier: SubscriptionTier,
): Promise<PlanDisplay[]> {
  const profile = await getItem<UserProfile>(STORAGE_KEYS.PROFILE);
  const selectedPlanId = profile?.selectedPlanId ?? null;

  const hasProAccess = subscriptionTier === 'pro' || subscriptionTier === 'pro_mock';

  return ALL_PREDEFINED_PLANS.map((plan) => ({
    plan,
    isLocked: plan.isPro && !hasProAccess,
    isSelected: plan.planId === selectedPlanId,
  }));
}

/**
 * Selects a fasting plan by updating the user profile's selectedPlanId in AsyncStorage.
 *
 * Validates: Requirements 3.6, 3.8
 */
export async function selectPlan(planId: string): Promise<void> {
  const profile = await getItem<UserProfile>(STORAGE_KEYS.PROFILE);
  if (profile === null) {
    throw new Error('User profile not found. Cannot select plan.');
  }

  const updatedProfile: UserProfile = {
    ...profile,
    selectedPlanId: planId,
    updatedAt: new Date().toISOString(),
  };

  await setItem(STORAGE_KEYS.PROFILE, updatedProfile);
}

/**
 * Creates a custom fasting plan with the specified fasting hours.
 *
 * - Requires 'pro' or 'pro_mock' subscription tier.
 * - Validates fastingHours is between 1 and 48 (MVP maximum).
 * - Returns a new FastingPlan with isCustom = true and isPro = true.
 *
 * Validates: Requirements 3.4, 3.5
 */
export async function createCustomPlan(
  fastingHours: number,
  subscriptionTier: SubscriptionTier,
): Promise<FastingPlan> {
  const hasProAccess = subscriptionTier === 'pro' || subscriptionTier === 'pro_mock';

  if (!hasProAccess) {
    throw new Error(
      'Custom plans require a Pro subscription. Please upgrade to create custom plans.',
    );
  }

  if (fastingHours < 1 || fastingHours > 48) {
    throw new Error(
      'Custom plan fasting hours must be between 1 and 48 for MVP.',
    );
  }

  if (!Number.isFinite(fastingHours) || fastingHours !== Math.floor(fastingHours * 10) / 10) {
    // Allow one decimal place for flexibility, but reject non-finite values
  }

  const eatingHours = Math.max(0, 24 - fastingHours);
  const now = new Date().toISOString();

  const customPlan: FastingPlan = {
    planId: uuidv4(),
    name: `Custom ${fastingHours}h`,
    fastingHours,
    eatingHours: fastingHours > 24 ? 0 : eatingHours,
    description: `A custom fasting plan with ${fastingHours} hours of fasting.`,
    isPro: true,
    isCustom: true,
    createdByUserId: null, // Will be set by caller with actual userId
    createdAt: now,
  };

  return customPlan;
}

/**
 * Returns whether a given plan is a Pro plan.
 *
 * Validates: Requirements 3.2, 3.3
 */
export function isProPlan(plan: FastingPlan): boolean {
  return plan.isPro;
}

/**
 * Returns the first free plan. Used as a fallback when downgrading from Pro.
 * Throws if no free plans are configured (should never happen in practice).
 */
export function getDefaultFreePlan(): FastingPlan {
  const plan = FREE_PLANS[0];
  if (!plan) {
    throw new Error('No free plans available. This should not happen.');
  }
  return plan;
}
