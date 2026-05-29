/**
 * OnboardingScreen — First-time user onboarding flow.
 *
 * Sequence of intro screens explaining fasting basics, app features, navigation.
 * Plan selection step showing free plans.
 * Persists onboarding completion flag.
 * Navigates to dashboard with selected plan.
 * Allows skip.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import React, { useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { getItem, setItem } from '../data/localStorage';
import { STORAGE_KEYS } from '../utils/constants';
import { UserProfile } from '../models/index';
import { saveProfile } from '../domain/profileManager';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Onboarding Steps ────────────────────────────────────────────────────────

interface OnboardingStep {
  title: string;
  description: string;
  type: 'info' | 'plan_selection';
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Welcome to FastTrack',
    description:
      'FastTrack helps you manage intermittent fasting with a simple, reliable timer that works even when you\'re offline.',
    type: 'info',
  },
  {
    title: 'How Fasting Works',
    description:
      'Intermittent fasting alternates between eating and fasting windows. Choose a plan that fits your lifestyle — start with shorter fasts and work your way up.',
    type: 'info',
  },
  {
    title: 'Track Your Progress',
    description:
      'Log daily health metrics like water intake, weight, and steps. Build streaks by completing fasts consistently.',
    type: 'info',
  },
  {
    title: 'Choose Your Plan',
    description: 'Select a fasting plan to get started. You can change this anytime.',
    type: 'plan_selection',
  },
];

// ─── Free Plans ──────────────────────────────────────────────────────────────

interface FreePlan {
  planId: string;
  name: string;
  fastingHours: number;
  eatingHours: number;
  description: string;
}

const FREE_PLANS: FreePlan[] = [
  {
    planId: 'plan-12-12',
    name: '12:12',
    fastingHours: 12,
    eatingHours: 12,
    description: 'Beginner-friendly — equal fasting and eating windows.',
  },
  {
    planId: 'plan-14-10',
    name: '14:10',
    fastingHours: 14,
    eatingHours: 10,
    description: 'A gentle step up — slightly longer fasting window.',
  },
  {
    planId: 'plan-16-8',
    name: '16:8',
    fastingHours: 16,
    eatingHours: 8,
    description: 'The most popular plan — 16 hours fasting, 8 hours eating.',
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function OnboardingScreen() {
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('plan-16-8');

  const step = ONBOARDING_STEPS[currentStep]!;
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  const handleNext = async () => {
    if (isLastStep) {
      await completeOnboarding();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
  };

  const completeOnboarding = async () => {
    // Persist onboarding completion and selected plan
    await setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, true);

    // Merge into the existing profile (seeded at sign-in) so we keep
    // userId/email/displayName and only update the plan + completion flag.
    const existing = await getItem<UserProfile>(STORAGE_KEYS.PROFILE);
    if (existing) {
      await saveProfile({
        ...existing,
        selectedPlanId,
        onboardingCompleted: true,
        updatedAt: new Date().toISOString(),
      });
    }

    // Navigation to dashboard is handled by root navigator
    // detecting onboarding completion state change
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Progress dots */}
      <View style={styles.progressContainer}>
        {ONBOARDING_STEPS.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor:
                  index === currentStep
                    ? theme.colors.primary
                    : theme.colors.textSecondary + '40',
              },
            ]}
          />
        ))}
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{step.title}</Text>
        <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
          {step.description}
        </Text>

        {/* Plan selection step */}
        {step.type === 'plan_selection' && (
          <View style={styles.planList}>
            {FREE_PLANS.map((plan) => (
              <TouchableOpacity
                key={plan.planId}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor:
                      selectedPlanId === plan.planId
                        ? theme.colors.primary
                        : theme.colors.textSecondary + '30',
                    borderWidth: selectedPlanId === plan.planId ? 2 : 1,
                  },
                ]}
                onPress={() => setSelectedPlanId(plan.planId)}
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedPlanId === plan.planId }}
                accessibilityLabel={`${plan.name} plan: ${plan.description}`}
              >
                <Text style={[styles.planName, { color: theme.colors.text }]}>
                  {plan.name}
                </Text>
                <Text style={[styles.planHours, { color: theme.colors.primary }]}>
                  {plan.fastingHours}h fast · {plan.eatingHours}h eat
                </Text>
                <Text style={[styles.planDescription, { color: theme.colors.textSecondary }]}>
                  {plan.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        {!isLastStep && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
          >
            <Text style={[styles.skipButtonText, { color: theme.colors.textSecondary }]}>
              Skip
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.nextButton,
            { backgroundColor: theme.colors.primary },
            isLastStep && styles.fullWidthButton,
          ]}
          onPress={handleNext}
          accessibilityRole="button"
          accessibilityLabel={isLastStep ? 'Get started' : 'Next'}
        >
          <Text style={styles.nextButtonText}>
            {isLastStep ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  planList: {
    gap: 12,
  },
  planCard: {
    padding: 16,
    borderRadius: 12,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  planHours: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  skipButton: {
    height: 48,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  nextButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidthButton: {
    flex: 1,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
