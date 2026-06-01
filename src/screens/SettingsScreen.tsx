/**
 * SettingsScreen — App settings and account management.
 *
 * - Theme preference toggle (light/dark/system) — applies immediately via ThemeManager
 * - Unit preference (metric/imperial)
 * - Account management: logout, delete account
 *
 * Validates: Requirements 19.3, 19.4, 19.5
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { ThemePreference } from '../theme/tokens';
import { UserProfile } from '../models/index';
import { getItem } from '../data/localStorage';
import { STORAGE_KEYS } from '../utils/constants';
import { logout } from '../domain/authManager';
import { saveProfile } from '../domain/profileManager';
import { deleteAccount } from '../utils/errorHandling';
import {
  getSubscriptionStatus,
  setMockStatus,
  handleProDowngrade,
} from '../domain/subscriptionManager';

type UnitPreference = 'metric' | 'imperial';

export function SettingsScreen() {
  const { theme, preference, setTheme } = useTheme();
  const [unitPref, setUnitPref] = useState<UnitPreference>('metric');
  const [devTapCount, setDevTapCount] = useState(0);
  const [showDevMenu, setShowDevMenu] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string>('free');
  const [billingPeriod, setBillingPeriod] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    const profile = await getItem<UserProfile>(STORAGE_KEYS.PROFILE);
    if (profile) {
      setUnitPref(profile.unitPreference);
    }
    const sub = await getSubscriptionStatus();
    setSubscriptionTier(sub.tier);
    setBillingPeriod(sub.billingPeriod);
  }, []);

  useEffect(() => {
    void (async () => {
      await loadSettings();
    })();
  }, [loadSettings]);

  const handleThemeChange = useCallback(
    (newPref: ThemePreference) => {
      setTheme(newPref);
    },
    [setTheme],
  );

  const handleUnitChange = useCallback(async (unit: UnitPreference) => {
    setUnitPref(unit);
    const profile = await getItem<UserProfile>(STORAGE_KEYS.PROFILE);
    if (profile) {
      const updated: UserProfile = {
        ...profile,
        unitPreference: unit,
        updatedAt: new Date().toISOString(),
      };
      await saveProfile(updated);
    }
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  }, []);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This action is permanent and cannot be undone. All your data including fasting history, streaks, and daily stats will be permanently deleted. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            await deleteAccount();
          },
        },
      ],
    );
  }, []);

  const handleDevTap = useCallback(() => {
    const newCount = devTapCount + 1;
    setDevTapCount(newCount);
    if (newCount >= 7) {
      setShowDevMenu(true);
      setDevTapCount(0);
    }
  }, [devTapCount]);

  const handleToggleSubscription = useCallback(async () => {
    // Toggle on the ACTUAL stored tier (not hasProAccess, which is forced true
    // by PRO_UNLOCKED_FOR_LAUNCH) so the dev toggle can switch free <-> pro_mock.
    const newTier = subscriptionTier === 'free' ? 'pro_mock' : 'free';
    await setMockStatus(newTier);
    setSubscriptionTier(newTier);
    setBillingPeriod(newTier === 'free' ? null : 'monthly');

    if (newTier === 'free') {
      // Handle downgrade — revert Pro plans to free
      await handleProDowngrade();
    }

    Alert.alert(
      'Subscription Updated',
      `Subscription set to: ${newTier === 'free' ? 'FREE' : 'PRO (Mock)'}`,
    );
  }, [subscriptionTier]);

  const themeOptions: { label: string; value: ThemePreference }[] = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
    { label: 'System', value: 'system' },
  ];

  const unitOptions: { label: string; value: UnitPreference }[] = [
    { label: 'Metric (kg, ml)', value: 'metric' },
    { label: 'Imperial (lb, oz)', value: 'imperial' },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      accessibilityLabel="Settings screen"
    >
      {/* Theme Section */}
      <Text
        style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
        accessibilityRole="header"
      >
        APPEARANCE
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        {themeOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.optionRow, { borderBottomColor: theme.colors.border }]}
            onPress={() => handleThemeChange(option.value)}
            accessibilityLabel={`Theme: ${option.label}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: preference === option.value }}
          >
            <Text style={[styles.optionText, { color: theme.colors.text }]}>
              {option.label}
            </Text>
            <View
              style={[
                styles.radio,
                { borderColor: theme.colors.primary },
                preference === option.value && {
                  backgroundColor: theme.colors.primary,
                },
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Unit Preference Section */}
      <Text
        style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
        accessibilityRole="header"
      >
        UNITS
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        {unitOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.optionRow, { borderBottomColor: theme.colors.border }]}
            onPress={() => handleUnitChange(option.value)}
            accessibilityLabel={`Unit preference: ${option.label}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: unitPref === option.value }}
          >
            <Text style={[styles.optionText, { color: theme.colors.text }]}>
              {option.label}
            </Text>
            <View
              style={[
                styles.radio,
                { borderColor: theme.colors.primary },
                unitPref === option.value && {
                  backgroundColor: theme.colors.primary,
                },
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Account Section */}
      <Text
        style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
        accessibilityRole="header"
      >
        ACCOUNT
      </Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={[styles.optionRow, { borderBottomColor: theme.colors.border }]}
          onPress={handleLogout}
          accessibilityLabel="Log out"
          accessibilityRole="button"
        >
          <Text style={[styles.optionText, { color: theme.colors.text }]}>Log Out</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.optionRow, { borderBottomColor: theme.colors.border }]}
          onPress={handleDeleteAccount}
          accessibilityLabel="Delete account"
          accessibilityRole="button"
          accessibilityHint="Permanently deletes your account and all data"
        >
          <Text style={[styles.optionText, { color: theme.colors.error }]}>
            Delete Account
          </Text>
        </TouchableOpacity>
      </View>

      {/* Developer Menu (hidden — tap version 7 times to reveal) */}
      {showDevMenu && (
        <>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.warning }]}
            accessibilityRole="header"
          >
            DEVELOPER
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <TouchableOpacity
              style={[styles.optionRow, { borderBottomColor: theme.colors.border }]}
              onPress={handleToggleSubscription}
              accessibilityLabel={`Toggle subscription. Current: ${subscriptionTier === 'free' ? 'FREE' : 'PRO'}`}
              accessibilityRole="button"
            >
              <Text style={[styles.optionText, { color: theme.colors.text }]}>
                Subscription:{' '}
                {subscriptionTier !== 'free'
                  ? `PRO (Mock)${billingPeriod ? ` · ${billingPeriod === 'annual' ? 'Annual' : 'Monthly'}` : ''}`
                  : 'FREE'}
              </Text>
              <Text style={[styles.toggleHint, { color: theme.colors.primary }]}>
                Toggle
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Version tap target to reveal dev menu */}
      <TouchableOpacity
        onPress={handleDevTap}
        activeOpacity={1}
        accessibilityLabel="App version"
      >
        <Text style={[styles.versionText, { color: theme.colors.textSecondary }]}>
          FastTrack v1.0.0 (MVP)
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 16,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  toggleHint: {
    fontSize: 14,
    fontWeight: '600',
  },
  versionText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
});
