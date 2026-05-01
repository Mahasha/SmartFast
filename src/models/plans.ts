/**
 * FastTrack Fasting Plans and Pro Feature Definitions
 *
 * Predefined fasting plans (free and Pro) and Pro feature gating constants.
 * Requirements: 3.1, 3.2, 21.1
 */

import { FastingPlan } from './index';

// ─── Pro Feature Gating ──────────────────────────────────────────────────────

/**
 * Features gated behind Pro subscription.
 * Used by SubscriptionManager to determine access.
 */
export type ProFeature =
  | 'PRO_PLANS'
  | 'CUSTOM_PLANS'
  | 'EXTENDED_FASTS'
  | 'DETAILED_ANALYTICS'
  | 'STREAK_INSIGHTS'
  | 'ACHIEVEMENT_BADGES';

/**
 * Complete list of all Pro-gated features for iteration and validation.
 */
export const PRO_FEATURES: ProFeature[] = [
  'PRO_PLANS',
  'CUSTOM_PLANS',
  'EXTENDED_FASTS',
  'DETAILED_ANALYTICS',
  'STREAK_INSIGHTS',
  'ACHIEVEMENT_BADGES',
];

// ─── Free Fasting Plans ──────────────────────────────────────────────────────

/**
 * Predefined free fasting plans available to all users regardless of subscription status.
 * Requirement 3.1: 12:12, 14:10, 16:8
 */
export const FREE_PLANS: FastingPlan[] = [
  {
    planId: 'plan-12-12',
    name: '12:12',
    fastingHours: 12,
    eatingHours: 12,
    description: 'A gentle introduction to intermittent fasting. Ideal for beginners with equal fasting and eating windows.',
    isPro: false,
    isCustom: false,
    createdByUserId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    planId: 'plan-14-10',
    name: '14:10',
    fastingHours: 14,
    eatingHours: 10,
    description: 'A moderate fasting schedule that extends the overnight fast slightly. Great for those ready to move beyond 12:12.',
    isPro: false,
    isCustom: false,
    createdByUserId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    planId: 'plan-16-8',
    name: '16:8',
    fastingHours: 16,
    eatingHours: 8,
    description: 'The most popular intermittent fasting method. A balanced approach suitable for experienced fasters.',
    isPro: false,
    isCustom: false,
    createdByUserId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
];

// ─── Pro Fasting Plans ───────────────────────────────────────────────────────

/**
 * Pro fasting plans available only when SubscriptionStatus is PRO_MOCK (or PRO post-MVP).
 * Requirement 3.2: 18:6, 20:4, 21:3, 22:2, 23:1, 24h, 36h, 48h
 * Note: 72h is Post-MVP and not included here.
 */
export const PRO_PLANS: FastingPlan[] = [
  {
    planId: 'plan-18-6',
    name: '18:6',
    fastingHours: 18,
    eatingHours: 6,
    description: 'An advanced fasting schedule with a shorter eating window. Suited for those comfortable with longer fasts.',
    isPro: true,
    isCustom: false,
    createdByUserId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    planId: 'plan-20-4',
    name: '20:4',
    fastingHours: 20,
    eatingHours: 4,
    description: 'Also known as the Warrior Diet. A challenging schedule with a very short eating window.',
    isPro: true,
    isCustom: false,
    createdByUserId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    planId: 'plan-21-3',
    name: '21:3',
    fastingHours: 21,
    eatingHours: 3,
    description: 'A highly restrictive plan for experienced fasters. Requires careful meal planning within the 3-hour window.',
    isPro: true,
    isCustom: false,
    createdByUserId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    planId: 'plan-22-2',
    name: '22:2',
    fastingHours: 22,
    eatingHours: 2,
    description: 'Near one-meal-a-day fasting. Only recommended for those with significant fasting experience.',
    isPro: true,
    isCustom: false,
    createdByUserId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    planId: 'plan-23-1',
    name: '23:1',
    fastingHours: 23,
    eatingHours: 1,
    description: 'One meal a day (OMAD). An intense fasting protocol with a single daily eating opportunity.',
    isPro: true,
    isCustom: false,
    createdByUserId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    planId: 'plan-24h',
    name: '24h',
    fastingHours: 24,
    eatingHours: 0,
    description: 'A full 24-hour extended fast. Suitable for experienced fasters looking to push their limits.',
    isPro: true,
    isCustom: false,
    createdByUserId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    planId: 'plan-36h',
    name: '36h',
    fastingHours: 36,
    eatingHours: 0,
    description: 'An extended 36-hour fast spanning overnight into the next day. Requires preparation and experience.',
    isPro: true,
    isCustom: false,
    createdByUserId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    planId: 'plan-48h',
    name: '48h',
    fastingHours: 48,
    eatingHours: 0,
    description: 'A two-day extended fast. The longest plan available in MVP. Only for very experienced fasters.',
    isPro: true,
    isCustom: false,
    createdByUserId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
];

// ─── Combined Plans ──────────────────────────────────────────────────────────

/**
 * All predefined fasting plans (free + Pro).
 * Used by PlanSelector to display the full plan catalogue.
 */
export const ALL_PREDEFINED_PLANS: FastingPlan[] = [...FREE_PLANS, ...PRO_PLANS];
