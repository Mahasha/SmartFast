/**
 * PaywallScreen — Pro subscription upsell screen.
 *
 * NOTE: Intentionally not registered in any navigator for the v1 launch. The
 * app ships without real billing, so no priced purchase flow is reachable
 * (see PRO_UNLOCKED_FOR_LAUNCH). Re-add it to the Home/Profile stacks and wire
 * Google Play Billing into handleSubscribe when monetization returns.
 *
 * Displays:
 * - Pricing: Monthly R39.99, Yearly R199.99 (~R16.67/month, ~58% savings)
 * - "Save 58%" badge on yearly option
 * - Free vs Pro feature comparison table
 * - 7-day free trial mention (UI only, no real billing)
 * - CTA buttons (non-functional for MVP — show toast "Coming soon")
 *
 * Validates: Requirements 20.1, 20.2, 20.3, 21.2
 */

import React, { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '../theme/ThemeContext';

type PlanOption = 'monthly' | 'yearly';

interface FeatureRow {
  feature: string;
  free: boolean | string;
  pro: boolean | string;
}

const FEATURE_COMPARISON: FeatureRow[] = [
  { feature: 'Basic fasting plans (12:12, 14:10, 16:8)', free: true, pro: true },
  { feature: 'Fasting timer with notifications', free: true, pro: true },
  { feature: 'Daily health tracking', free: true, pro: true },
  { feature: 'Streak tracking', free: true, pro: true },
  { feature: 'Learn content & recipes', free: true, pro: true },
  { feature: 'Advanced plans (18:6 to 48h)', free: false, pro: true },
  { feature: 'Custom fasting plans', free: false, pro: true },
  { feature: 'Extended fast support', free: false, pro: true },
  { feature: 'Detailed analytics', free: false, pro: true },
  { feature: 'Streak insights', free: false, pro: true },
  { feature: 'Achievement badges', free: false, pro: true },
];

export function PaywallScreen() {
  const { theme } = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<PlanOption>('yearly');

  const handleSubscribe = useCallback(() => {
    Alert.alert('Coming Soon', 'Subscription purchases will be available in a future update.');
  }, []);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      accessibilityLabel="Paywall screen"
    >
      {/* Header */}
      <Text
        style={[styles.title, { color: theme.colors.text }]}
        accessibilityRole="header"
      >
        Unlock Pro
      </Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        Get access to all fasting plans, custom schedules, and detailed analytics.
      </Text>

      {/* Trial mention */}
      <View
        style={[styles.trialBanner, { backgroundColor: theme.colors.primary + '15' }]}
        accessibilityLabel="7-day free trial included with all plans"
      >
        <Text style={[styles.trialText, { color: theme.colors.primary }]}>
          🎉 Start with a 7-day free trial
        </Text>
      </View>

      {/* Plan Options */}
      <View style={styles.planOptions}>
        {/* Monthly */}
        <TouchableOpacity
          style={[
            styles.planCard,
            { backgroundColor: theme.colors.surface },
            selectedPlan === 'monthly' && {
              borderColor: theme.colors.primary,
              borderWidth: 2,
            },
          ]}
          onPress={() => setSelectedPlan('monthly')}
          accessibilityLabel="Monthly plan: R39.99 per month"
          accessibilityRole="radio"
          accessibilityState={{ selected: selectedPlan === 'monthly' }}
        >
          <Text style={[styles.planName, { color: theme.colors.text }]}>Monthly</Text>
          <Text style={[styles.planPrice, { color: theme.colors.text }]}>R39.99</Text>
          <Text style={[styles.planPeriod, { color: theme.colors.textSecondary }]}>
            per month
          </Text>
        </TouchableOpacity>

        {/* Yearly */}
        <TouchableOpacity
          style={[
            styles.planCard,
            { backgroundColor: theme.colors.surface },
            selectedPlan === 'yearly' && {
              borderColor: theme.colors.primary,
              borderWidth: 2,
            },
          ]}
          onPress={() => setSelectedPlan('yearly')}
          accessibilityLabel="Yearly plan: R199.99 per year, approximately R16.67 per month, save 58%"
          accessibilityRole="radio"
          accessibilityState={{ selected: selectedPlan === 'yearly' }}
        >
          {/* Badge */}
          <View style={[styles.badge, { backgroundColor: theme.colors.success }]}>
            <Text style={styles.badgeText}>Save 58%</Text>
          </View>
          <Text style={[styles.planName, { color: theme.colors.text }]}>Yearly</Text>
          <Text style={[styles.planPrice, { color: theme.colors.text }]}>R199.99</Text>
          <Text style={[styles.planPeriod, { color: theme.colors.textSecondary }]}>
            per year (~R16.67/month)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Feature Comparison */}
      <Text
        style={[styles.comparisonTitle, { color: theme.colors.text }]}
        accessibilityRole="header"
      >
        Free vs Pro
      </Text>
      <View style={[styles.comparisonTable, { backgroundColor: theme.colors.surface }]}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderFeature, { color: theme.colors.textSecondary }]}>
            Feature
          </Text>
          <Text style={[styles.tableHeaderCol, { color: theme.colors.textSecondary }]}>
            Free
          </Text>
          <Text style={[styles.tableHeaderCol, { color: theme.colors.primary }]}>
            Pro
          </Text>
        </View>

        {/* Table Rows */}
        {FEATURE_COMPARISON.map((row, index) => (
          <View
            key={index}
            style={styles.tableRow}
            accessibilityLabel={`${row.feature}: ${row.free ? 'included in Free' : 'not in Free'}, ${row.pro ? 'included in Pro' : 'not in Pro'}`}
          >
            <Text
              style={[styles.tableFeature, { color: theme.colors.text }]}
              numberOfLines={2}
            >
              {row.feature}
            </Text>
            <Text style={[styles.tableCell, { color: row.free ? theme.colors.success : theme.colors.locked }]}>
              {row.free ? '✓' : '—'}
            </Text>
            <Text style={[styles.tableCell, { color: theme.colors.success }]}>
              {row.pro ? '✓' : '—'}
            </Text>
          </View>
        ))}
      </View>

      {/* CTA Button */}
      <TouchableOpacity
        style={[styles.ctaButton, { backgroundColor: theme.colors.primary }]}
        onPress={handleSubscribe}
        accessibilityLabel={`Subscribe to ${selectedPlan} plan`}
        accessibilityRole="button"
      >
        <Text style={styles.ctaText}>
          {selectedPlan === 'yearly' ? 'Start Free Trial — R199.99/year' : 'Start Free Trial — R39.99/month'}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.disclaimer, { color: theme.colors.textSecondary }]}>
        Cancel anytime. No charge during the 7-day trial period.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  trialBanner: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  trialText: {
    fontSize: 15,
    fontWeight: '600',
  },
  planOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  planCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -10,
    right: -4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  planName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '700',
  },
  planPeriod: {
    fontSize: 13,
    marginTop: 4,
  },
  comparisonTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  comparisonTable: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    marginBottom: 4,
  },
  tableHeaderFeature: {
    flex: 3,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  tableHeaderCol: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  tableFeature: {
    flex: 3,
    fontSize: 14,
  },
  tableCell: {
    flex: 1,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  ctaButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  disclaimer: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
