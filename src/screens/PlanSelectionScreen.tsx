/**
 * PlanSelectionScreen — Fasting plan selection with Pro gating.
 *
 * Displays all predefined fasting plans as cards with:
 * - Plan name, fasting/eating hours, description
 * - Lock indicator (🔒) for Pro plans when user is FREE tier
 * - Extended fast disclaimer for plans ≥24h
 * - General health disclaimer at the bottom
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.7, 33.1, 33.2, 33.3
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../theme/ThemeContext';
import { getCardColor } from '../theme/tokens';
import { getAvailablePlans, selectPlan, PlanDisplay } from '../domain/planSelector';
import { getSubscriptionStatus } from '../domain/subscriptionManager';
import type { HomeStackParamList } from '../navigation/HomeStack';

// ─── Navigation Types ────────────────────────────────────────────────────────

type PlanSelectionNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  'PlanSelection'
>;

// ─── Constants ───────────────────────────────────────────────────────────────

const EXTENDED_FAST_THRESHOLD_HOURS = 24;

const EXTENDED_FAST_DISCLAIMER =
  'Extended fasts carry health risks. This app does not provide medical advice. Consult a healthcare professional before attempting fasts longer than 24 hours.';

const GENERAL_HEALTH_DISCLAIMER =
  'FastTrack is a fasting tracker, not a medical tool. Always consult your doctor before starting any fasting regimen.';

// ─── Component ───────────────────────────────────────────────────────────────

export function PlanSelectionScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<PlanSelectionNavigationProp>();

  const [plans, setPlans] = useState<PlanDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPlans() {
      try {
        const status = await getSubscriptionStatus();
        const availablePlans = await getAvailablePlans(status.tier);
        setPlans(availablePlans);
      } catch {
        // Non-critical: show empty list on failure
      } finally {
        setLoading(false);
      }
    }
    loadPlans();
  }, []);

  const handlePlanPress = useCallback(
    async (planDisplay: PlanDisplay) => {
      if (planDisplay.isLocked) {
        // Navigate to Paywall (within the Home stack) for locked Pro plans.
        // Staying in-stack keeps the native back button working so the user
        // can return to plan selection (Requirement 3.3, 3.5).
        navigation.navigate('Paywall');
        return;
      }

      // Select the plan and navigate back (Requirement 3.6)
      try {
        await selectPlan(planDisplay.plan.planId);
        navigation.goBack();
      } catch {
        // Selection failed — stay on screen
      }
    },
    [navigation],
  );

  const renderPlanCard = useCallback(
    ({ item }: { item: PlanDisplay }) => {
      const { plan, isLocked } = item;
      const cardColor = getCardColor(plan.planId, theme);
      const isExtendedFast = plan.fastingHours >= EXTENDED_FAST_THRESHOLD_HOURS;

      return (
        <TouchableOpacity
          style={[styles.card, { backgroundColor: cardColor }]}
          onPress={() => handlePlanPress(item)}
          activeOpacity={0.7}
          accessibilityLabel={
            isLocked
              ? `${plan.name} plan, locked, requires Pro subscription`
              : `${plan.name} plan, ${plan.fastingHours} hours fasting, ${plan.eatingHours} hours eating`
          }
          accessibilityRole="button"
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.planName, { color: theme.colors.text }]}>
              {plan.name}
            </Text>
            {isLocked && (
              <Text
                style={[styles.lockIcon, { color: theme.colors.locked }]}
                accessibilityLabel="Locked, Pro plan"
              >
                🔒
              </Text>
            )}
          </View>

          <Text style={[styles.planHours, { color: theme.colors.textSecondary }]}>
            {plan.fastingHours}h fasting / {plan.eatingHours}h eating
          </Text>

          <Text style={[styles.planDescription, { color: theme.colors.text }]}>
            {plan.description}
          </Text>

          {isExtendedFast && (
            <Text style={[styles.extendedDisclaimer, { color: theme.colors.warning }]}>
              ⚠️ {EXTENDED_FAST_DISCLAIMER}
            </Text>
          )}
        </TouchableOpacity>
      );
    },
    [theme, handlePlanPress],
  );

  const keyExtractor = useCallback((item: PlanDisplay) => item.plan.planId, []);

  const ListFooter = useCallback(
    () => (
      <View style={styles.disclaimerContainer}>
        <Text
          style={[styles.generalDisclaimer, { color: theme.colors.textSecondary }]}
          accessibilityLabel="Health disclaimer"
        >
          {GENERAL_HEALTH_DISCLAIMER}
        </Text>
      </View>
    ),
    [theme],
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
          Loading plans...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={plans}
        renderItem={renderPlanCard}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={ListFooter}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
  },
  lockIcon: {
    fontSize: 18,
  },
  planHours: {
    fontSize: 14,
    marginBottom: 8,
  },
  planDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  extendedDisclaimer: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 8,
    fontStyle: 'italic',
  },
  disclaimerContainer: {
    marginTop: 16,
    paddingHorizontal: 8,
  },
  generalDisclaimer: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 48,
  },
});
