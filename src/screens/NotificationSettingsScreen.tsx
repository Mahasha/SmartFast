/**
 * NotificationSettingsScreen — Notification preferences management.
 *
 * Validates: Requirements 16.1, 16.2, 16.3, 16.4
 *
 * Features:
 * - Permission request with pre-permission explanation
 * - Toggles for fasting milestones, water reminders, weigh-in reminder
 * - Interval picker for water reminders
 * - Time picker for weigh-in reminder
 * - Disables toggles when permissions denied with instructions
 * - Persists NotificationPreference to AsyncStorage
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { NotificationPreference } from '../models/index';
import { STORAGE_KEYS } from '../utils/constants';
import { useTheme } from '../theme/ThemeContext';
import {
  requestPermissions,
  scheduleWaterReminders,
  scheduleWeighInReminder,
  cancelRemindersByType,
  PermissionResult,
} from '../domain/notificationScheduler';

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_PREFS: Omit<NotificationPreference, 'prefId' | 'userId' | 'createdAt' | 'updatedAt'> = {
  fastingMilestones: true,
  waterReminders: false,
  waterReminderInterval: 120, // minutes
  weighInReminder: false,
  weighInReminderTime: '08:00',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function NotificationSettingsScreen() {
  const { theme } = useTheme();
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [showPrePermission, setShowPrePermission] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreference | null>(null);

  const checkPermissions = useCallback(async () => {
    try {
      const result = await requestPermissions();
      setPermissionGranted(result === 'GRANTED' || result === 'ALREADY_GRANTED');
    } catch {
      setPermissionGranted(false);
    }
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_PREFS);
      if (raw) {
        setPrefs(JSON.parse(raw) as NotificationPreference);
      } else {
        // Initialize with defaults
        const now = new Date().toISOString();
        const defaultPrefs: NotificationPreference = {
          prefId: `pref-${Date.now()}`,
          userId: 'guest',
          ...DEFAULT_PREFS,
          createdAt: now,
          updatedAt: now,
        };
        await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_PREFS, JSON.stringify(defaultPrefs));
        setPrefs(defaultPrefs);
      }
    } catch {
      // Fallback to defaults
      const now = new Date().toISOString();
      setPrefs({
        prefId: `pref-${Date.now()}`,
        userId: 'guest',
        ...DEFAULT_PREFS,
        createdAt: now,
        updatedAt: now,
      });
    }
  }, []);

  // Load preferences and check permission status on mount
  useEffect(() => {
    void (async () => {
      await loadPreferences();
      await checkPermissions();
    })();
  }, [loadPreferences, checkPermissions]);

  const savePreferences = async (updated: NotificationPreference) => {
    const withTimestamp = { ...updated, updatedAt: new Date().toISOString() };
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_PREFS, JSON.stringify(withTimestamp));
    setPrefs(withTimestamp);
  };

  const handleRequestPermission = async () => {
    setShowPrePermission(false);
    const result: PermissionResult = await requestPermissions();
    const granted = result === 'GRANTED' || result === 'ALREADY_GRANTED';
    setPermissionGranted(granted);

    if (!granted) {
      Alert.alert(
        'Permissions Denied',
        'Notifications are disabled. To enable them, go to your device settings and allow notifications for FastTrack.',
        [
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    }
  };

  const handleToggleMilestones = useCallback(async (value: boolean) => {
    if (!prefs) return;
    const updated = { ...prefs, fastingMilestones: value };
    await savePreferences(updated);

    if (!value) {
      await cancelRemindersByType('FASTING_MILESTONES');
    }
  }, [prefs]);

  const handleToggleWaterReminders = useCallback(async (value: boolean) => {
    if (!prefs) return;
    const updated = { ...prefs, waterReminders: value };
    await savePreferences(updated);

    if (value) {
      await scheduleWaterReminders({
        intervalMinutes: prefs.waterReminderInterval,
        startHour: 8,
        endHour: 22,
      });
    } else {
      await cancelRemindersByType('WATER_REMINDERS');
    }
  }, [prefs]);

  const handleToggleWeighIn = useCallback(async (value: boolean) => {
    if (!prefs) return;
    const updated = { ...prefs, weighInReminder: value };
    await savePreferences(updated);

    if (value) {
      await scheduleWeighInReminder(prefs.weighInReminderTime);
    } else {
      await cancelRemindersByType('WEIGH_IN_REMINDER');
    }
  }, [prefs]);

  const handleWaterIntervalChange = useCallback(async (text: string) => {
    if (!prefs) return;
    const minutes = parseInt(text, 10);
    if (isNaN(minutes) || minutes < 15 || minutes > 480) return;

    const updated = { ...prefs, waterReminderInterval: minutes };
    await savePreferences(updated);

    if (prefs.waterReminders) {
      await cancelRemindersByType('WATER_REMINDERS');
      await scheduleWaterReminders({
        intervalMinutes: minutes,
        startHour: 8,
        endHour: 22,
      });
    }
  }, [prefs]);

  const handleWeighInTimeChange = useCallback(async (text: string) => {
    if (!prefs) return;
    // Validate HH:MM format
    const match = text.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return;
    const hours = parseInt(match[1]!, 10);
    const mins = parseInt(match[2]!, 10);
    if (hours < 0 || hours > 23 || mins < 0 || mins > 59) return;

    const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    const updated = { ...prefs, weighInReminderTime: timeStr };
    await savePreferences(updated);

    if (prefs.weighInReminder) {
      await cancelRemindersByType('WEIGH_IN_REMINDER');
      await scheduleWeighInReminder(timeStr);
    }
  }, [prefs]);

  // Pre-permission explanation screen
  if (showPrePermission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.prePermissionContainer}>
          <Text style={[styles.prePermissionTitle, { color: theme.colors.text }]}>
            Enable Notifications
          </Text>
          <Text style={[styles.prePermissionBody, { color: theme.colors.textSecondary }]}>
            FastTrack uses notifications to keep you informed about your fasting progress.
            You&apos;ll receive alerts at key milestones, water reminders to stay hydrated,
            and daily weigh-in reminders to track your progress.
          </Text>
          <Text style={[styles.prePermissionBody, { color: theme.colors.textSecondary }]}>
            You can customize which notifications you receive at any time.
          </Text>
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleRequestPermission}
            accessibilityRole="button"
            accessibilityLabel="Allow notifications"
          >
            <Text style={styles.permissionButtonText}>Allow Notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => setShowPrePermission(false)}
            accessibilityRole="button"
            accessibilityLabel="Skip for now"
          >
            <Text style={[styles.skipButtonText, { color: theme.colors.textSecondary }]}>
              Skip for Now
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Show permission request prompt if not yet determined
  if (permissionGranted === null) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scrollContainer, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Notification Settings
      </Text>

      {/* Permission denied banner */}
      {!permissionGranted && (
        <View style={[styles.deniedBanner, { backgroundColor: theme.colors.warning + '20' }]}>
          <Text style={[styles.deniedText, { color: theme.colors.text }]}>
            Notifications are disabled. Enable them in your device settings to receive alerts.
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            accessibilityRole="button"
            accessibilityLabel="Open device settings"
          >
            <Text style={[styles.settingsLink, { color: theme.colors.primary }]}>
              Open Settings
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Fasting Milestones */}
      <View style={[styles.settingRow, { borderBottomColor: theme.colors.textSecondary + '30' }]}>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
            Fasting Milestones
          </Text>
          <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
            Get notified at key points during your fast
          </Text>
        </View>
        <Switch
          value={prefs?.fastingMilestones ?? false}
          onValueChange={handleToggleMilestones}
          disabled={!permissionGranted}
          trackColor={{ false: '#767577', true: theme.colors.primary + '80' }}
          thumbColor={prefs?.fastingMilestones ? theme.colors.primary : '#f4f3f4'}
          accessibilityLabel="Toggle fasting milestone notifications"
        />
      </View>

      {/* Water Reminders */}
      <View style={[styles.settingRow, { borderBottomColor: theme.colors.textSecondary + '30' }]}>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
            Water Reminders
          </Text>
          <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
            Periodic reminders to stay hydrated (8AM–10PM)
          </Text>
        </View>
        <Switch
          value={prefs?.waterReminders ?? false}
          onValueChange={handleToggleWaterReminders}
          disabled={!permissionGranted}
          trackColor={{ false: '#767577', true: theme.colors.primary + '80' }}
          thumbColor={prefs?.waterReminders ? theme.colors.primary : '#f4f3f4'}
          accessibilityLabel="Toggle water reminder notifications"
        />
      </View>

      {/* Water Reminder Interval */}
      {prefs?.waterReminders && permissionGranted && (
        <View style={[styles.subSetting, { borderBottomColor: theme.colors.textSecondary + '30' }]}>
          <Text style={[styles.subSettingLabel, { color: theme.colors.text }]}>
            Reminder Interval (minutes)
          </Text>
          <TextInput
            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.textSecondary + '50' }]}
            value={String(prefs.waterReminderInterval)}
            onChangeText={handleWaterIntervalChange}
            keyboardType="numeric"
            placeholder="120"
            placeholderTextColor={theme.colors.textSecondary}
            accessibilityLabel="Water reminder interval in minutes"
          />
        </View>
      )}

      {/* Weigh-In Reminder */}
      <View style={[styles.settingRow, { borderBottomColor: theme.colors.textSecondary + '30' }]}>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
            Weigh-In Reminder
          </Text>
          <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
            Daily reminder to log your weight
          </Text>
        </View>
        <Switch
          value={prefs?.weighInReminder ?? false}
          onValueChange={handleToggleWeighIn}
          disabled={!permissionGranted}
          trackColor={{ false: '#767577', true: theme.colors.primary + '80' }}
          thumbColor={prefs?.weighInReminder ? theme.colors.primary : '#f4f3f4'}
          accessibilityLabel="Toggle weigh-in reminder notifications"
        />
      </View>

      {/* Weigh-In Time */}
      {prefs?.weighInReminder && permissionGranted && (
        <View style={[styles.subSetting, { borderBottomColor: theme.colors.textSecondary + '30' }]}>
          <Text style={[styles.subSettingLabel, { color: theme.colors.text }]}>
            Reminder Time (HH:MM)
          </Text>
          <TextInput
            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.textSecondary + '50' }]}
            value={prefs.weighInReminderTime}
            onChangeText={handleWeighInTimeChange}
            placeholder="08:00"
            placeholderTextColor={theme.colors.textSecondary}
            accessibilityLabel="Weigh-in reminder time"
          />
        </View>
      )}

      {/* Request permission button if not granted */}
      {!permissionGranted && (
        <TouchableOpacity
          style={[styles.enableButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => setShowPrePermission(true)}
          accessibilityRole="button"
          accessibilityLabel="Enable notifications"
        >
          <Text style={styles.enableButtonText}>Enable Notifications</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 24,
  },
  loadingText: {
    fontSize: 16,
  },
  deniedBanner: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  deniedText: {
    fontSize: 14,
    marginBottom: 8,
  },
  settingsLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
  },
  subSetting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingLeft: 16,
    borderBottomWidth: 1,
  },
  subSettingLabel: {
    fontSize: 14,
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 80,
    textAlign: 'center',
    fontSize: 14,
  },
  prePermissionContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  prePermissionTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  prePermissionBody: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 22,
  },
  permissionButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 24,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 16,
    padding: 12,
  },
  skipButtonText: {
    fontSize: 14,
  },
  enableButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  enableButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
