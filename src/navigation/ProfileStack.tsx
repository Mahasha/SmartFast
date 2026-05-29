/**
 * ProfileStack — Stack navigator for the Profile tab flow.
 *
 * Screens:
 * - Profile (ProfileScreen) — User profile and settings overview
 * - Settings — App settings
 * - NotificationSettings — Notification preferences
 *
 * Implements Requirement 24 AC4: nested navigation within Profile tab.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useTheme } from '../theme/ThemeContext';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { NotificationSettingsScreen } from '../screens/NotificationSettingsScreen';

export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
  NotificationSettings: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: 'Notifications' }}
      />
    </Stack.Navigator>
  );
}
