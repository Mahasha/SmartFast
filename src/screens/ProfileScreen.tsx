/**
 * ProfileScreen — User profile overview and navigation hub.
 *
 * Displays: display name, email, selected plan, subscription status.
 * Allows editing display name (persists to AsyncStorage + Supabase).
 * Links to: Settings, Notification Settings, Paywall, Logout.
 *
 * Validates: Requirements 19.1, 19.2
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../theme/ThemeContext';
import { UserProfile, SubscriptionStatus } from '../models/index';
import { ALL_PREDEFINED_PLANS } from '../models/plans';
import { getItem, setItem } from '../data/localStorage';
import { STORAGE_KEYS } from '../utils/constants';
import { logout } from '../domain/authManager';
import { getSubscriptionStatus, hasProAccess } from '../domain/subscriptionManager';
import { ProfileStackParamList } from '../navigation/ProfileStack';

type ProfileNavProp = NativeStackNavigationProp<ProfileStackParamList, 'Profile'>;

export function ProfileScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<ProfileNavProp>();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    const storedProfile = await getItem<UserProfile>(STORAGE_KEYS.PROFILE);
    if (storedProfile) {
      setProfile(storedProfile);
      setEditedName(storedProfile.displayName);
    }
    const sub = await getSubscriptionStatus();
    setSubscription(sub);
  };

  const handleSaveDisplayName = useCallback(async () => {
    if (!profile) return;
    const trimmed = editedName.trim();
    if (trimmed.length === 0) {
      Alert.alert('Invalid Name', 'Display name cannot be empty.');
      return;
    }
    const updatedProfile: UserProfile = {
      ...profile,
      displayName: trimmed,
      updatedAt: new Date().toISOString(),
    };
    await setItem(STORAGE_KEYS.PROFILE, updatedProfile);
    setProfile(updatedProfile);
    setIsEditingName(false);
  }, [profile, editedName]);

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

  const getPlanName = (planId: string): string => {
    const plan = ALL_PREDEFINED_PLANS.find((p) => p.planId === planId);
    return plan ? plan.name : 'No plan selected';
  };

  const getSubscriptionLabel = (): string => {
    if (!subscription) return 'Free';
    if (hasProAccess(subscription.tier)) return 'Pro';
    return 'Free';
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      accessibilityLabel="Profile screen"
    >
      {/* Header */}
      <Text
        style={[styles.header, { color: theme.colors.text }]}
        accessibilityRole="header"
      >
        Profile
      </Text>

      {/* Profile Info Card */}
      <View
        style={[styles.card, { backgroundColor: theme.colors.surface }]}
        accessibilityLabel="Profile information"
      >
        {/* Display Name */}
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
            Display Name
          </Text>
          {isEditingName ? (
            <View style={styles.editRow}>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.colors.text, borderColor: theme.colors.primary },
                ]}
                value={editedName}
                onChangeText={setEditedName}
                autoFocus
                accessibilityLabel="Edit display name"
                accessibilityHint="Enter your new display name"
              />
              <TouchableOpacity
                onPress={handleSaveDisplayName}
                style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
                accessibilityLabel="Save display name"
                accessibilityRole="button"
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setIsEditingName(false);
                  setEditedName(profile?.displayName ?? '');
                }}
                accessibilityLabel="Cancel editing"
                accessibilityRole="button"
              >
                <Text style={[styles.cancelText, { color: theme.colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setIsEditingName(true)}
              accessibilityLabel={`Display name: ${profile?.displayName ?? 'Not set'}. Tap to edit.`}
              accessibilityRole="button"
            >
              <Text style={[styles.value, { color: theme.colors.text }]}>
                {profile?.displayName ?? 'Not set'} ✎
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Email */}
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
            Email
          </Text>
          <Text
            style={[styles.value, { color: theme.colors.text }]}
            accessibilityLabel={`Email: ${profile?.email ?? 'Not available'}`}
          >
            {profile?.email ?? 'Not available'}
          </Text>
        </View>

        {/* Selected Plan */}
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
            Selected Plan
          </Text>
          <Text
            style={[styles.value, { color: theme.colors.text }]}
            accessibilityLabel={`Selected plan: ${getPlanName(profile?.selectedPlanId ?? '')}`}
          >
            {getPlanName(profile?.selectedPlanId ?? '')}
          </Text>
        </View>

        {/* Subscription Status */}
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
            Subscription
          </Text>
          <View style={styles.badgeRow}>
            <Text
              style={[
                styles.badge,
                {
                  backgroundColor: hasProAccess(subscription?.tier ?? 'free')
                    ? theme.colors.primary
                    : theme.colors.locked,
                  color: '#FFFFFF',
                },
              ]}
              accessibilityLabel={`Subscription status: ${getSubscriptionLabel()}`}
            >
              {getSubscriptionLabel()}
            </Text>
          </View>
        </View>
      </View>

      {/* Navigation Links */}
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={styles.navRow}
          onPress={() => navigation.navigate('Settings')}
          accessibilityLabel="Settings"
          accessibilityRole="button"
          accessibilityHint="Navigate to app settings"
        >
          <Text style={[styles.navText, { color: theme.colors.text }]}>Settings</Text>
          <Text style={[styles.chevron, { color: theme.colors.textSecondary }]}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navRow}
          onPress={() => navigation.navigate('NotificationSettings')}
          accessibilityLabel="Notification Settings"
          accessibilityRole="button"
          accessibilityHint="Navigate to notification preferences"
        >
          <Text style={[styles.navText, { color: theme.colors.text }]}>
            Notification Settings
          </Text>
          <Text style={[styles.chevron, { color: theme.colors.textSecondary }]}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navRow}
          onPress={() => navigation.navigate('Paywall')}
          accessibilityLabel="Upgrade to Pro"
          accessibilityRole="button"
          accessibilityHint="View Pro subscription options"
        >
          <Text style={[styles.navText, { color: theme.colors.primary }]}>
            Upgrade to Pro
          </Text>
          <Text style={[styles.chevron, { color: theme.colors.textSecondary }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={[styles.logoutButton, { borderColor: theme.colors.error }]}
        onPress={handleLogout}
        accessibilityLabel="Log out"
        accessibilityRole="button"
      >
        <Text style={[styles.logoutText, { color: theme.colors.error }]}>Log Out</Text>
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
    paddingTop: 60,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  cancelText: {
    fontSize: 14,
    paddingHorizontal: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 13,
    fontWeight: '600',
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  navText: {
    fontSize: 16,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 22,
    fontWeight: '300',
  },
  logoutButton: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
