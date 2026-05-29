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
import {
  BillingPeriod,
  SubscriptionStatus,
  SubscriptionTier,
  UserProfile,
} from '../models/index';
import { ProFeature, PRO_FEATURES, ALL_PREDEFINED_PLANS, FREE_PLANS } from '../models/plans';
import { getItem, setItem } from '../data/localStorage';
import { STORAGE_KEYS } from '../utils/constants';
import { getDefaultFreePlan } from './planSelector';
import { saveProfile } from './profileManager';

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
    billingPeriod: null,
    expiryDate: null,
    trialStartDate: null,
    trialEndDate: null,
    provider: 'local',
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Test-User Seed ──────────────────────────────────────────────────────────

/**
 * Seed plans for known test accounts. Subscriptions are a local mock with no
 * server backing, so logging into one of these accounts on a fresh install
 * resolves to the assigned tier/period. Keyed by lower-cased email.
 *
 * Remove (or gate behind a dev flag) before real billing is wired up.
 */
const SUBSCRIPTION_SEED: Record<string, { tier: SubscriptionTier; billingPeriod: BillingPeriod }> = {
  'mahasha.retshepile@gmail.com': { tier: 'pro_mock', billingPeriod: 'annual' },
  'psp.mahasha@gmail.com': { tier: 'pro_mock', billingPeriod: 'monthly' },
  'molozwi@gmail.com': { tier: 'free', billingPeriod: null },
};

// ─── Per-User Ledger ─────────────────────────────────────────────────────────

type SubscriptionLedger = Record<string, SubscriptionStatus>;

async function getLedger(): Promise<SubscriptionLedger> {
  return (await getItem<SubscriptionLedger>(STORAGE_KEYS.SUBSCRIPTION_LEDGER)) ?? {};
}

async function saveToLedger(status: SubscriptionStatus): Promise<void> {
  if (!status.userId || status.userId === 'guest') return;
  const ledger = await getLedger();
  ledger[status.userId] = status;
  await setItem(STORAGE_KEYS.SUBSCRIPTION_LEDGER, ledger);
}

function expiryForPeriod(period: BillingPeriod, from: Date): string | null {
  if (period === null) return null;
  const expiry = new Date(from);
  if (period === 'annual') {
    expiry.setFullYear(expiry.getFullYear() + 1);
  } else {
    expiry.setMonth(expiry.getMonth() + 1);
  }
  return expiry.toISOString();
}

/**
 * Resolves and activates the subscription for a signed-in user. Restores from
 * the per-user ledger first; otherwise applies the test-user seed; otherwise
 * defaults to free. Writes the result to the active SUBSCRIPTION_STATUS key
 * (what the rest of the app reads) and back into the ledger.
 *
 * Called on login/register/restore so each account carries its own tier across
 * logout/login even though clearing local data wipes the active key.
 */
export async function resolveSubscriptionForUser(
  userId: string,
  email: string,
): Promise<SubscriptionStatus> {
  const now = new Date();
  const nowIso = now.toISOString();
  const ledger = await getLedger();

  let status = ledger[userId];

  if (!status) {
    const seed = SUBSCRIPTION_SEED[email.toLowerCase()];
    status = {
      subId: uuidv4(),
      userId,
      tier: seed?.tier ?? 'free',
      billingPeriod: seed?.billingPeriod ?? null,
      expiryDate: seed ? expiryForPeriod(seed.billingPeriod, now) : null,
      trialStartDate: null,
      trialEndDate: null,
      provider: 'local',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  } else {
    // Keep the userId field aligned in case it was persisted under 'guest'.
    status = { ...status, userId };
  }

  await setItem(STORAGE_KEYS.SUBSCRIPTION_STATUS, status);
  await saveToLedger(status);
  return status;
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
export async function setMockStatus(
  tier: SubscriptionTier,
  billingPeriod?: BillingPeriod,
): Promise<void> {
  const existing = await getItem<SubscriptionStatus>(STORAGE_KEYS.SUBSCRIPTION_STATUS);
  const now = new Date();
  const nowIso = now.toISOString();

  // Free has no billing period. For Pro, use the explicit period, else keep the
  // existing one, else default to monthly.
  const resolvedPeriod: BillingPeriod =
    tier === 'free'
      ? null
      : billingPeriod ?? existing?.billingPeriod ?? 'monthly';

  const updatedStatus: SubscriptionStatus = existing
    ? {
        ...existing,
        tier,
        billingPeriod: resolvedPeriod,
        expiryDate: expiryForPeriod(resolvedPeriod, now),
        updatedAt: nowIso,
      }
    : {
        subId: uuidv4(),
        userId: 'guest',
        tier,
        billingPeriod: resolvedPeriod,
        expiryDate: expiryForPeriod(resolvedPeriod, now),
        trialStartDate: null,
        trialEndDate: null,
        provider: 'local',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

  await setItem(STORAGE_KEYS.SUBSCRIPTION_STATUS, updatedStatus);
  await saveToLedger(updatedStatus);
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
    await saveProfile(updatedProfile);
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
      await saveProfile(updatedProfile);
    }
  }
}
