/**
 * HomeStack — Stack navigator for the Home tab flow.
 *
 * Screens:
 * - Dashboard (HomeScreen) — Fasting timer and daily stats
 * - PlanSelection — Choose or change fasting plan
 * - Streaks — Streaks & Achievements calendar view
 * - FastingHistory — Past fasting sessions list
 *
 * Implements Requirement 24 AC4: nested navigation within Home tab.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useTheme } from '../theme/ThemeContext';
import { HomeScreen } from '../screens/HomeScreen';
import { PlanSelectionScreen } from '../screens/PlanSelectionScreen';
import { StreaksScreen } from '../screens/StreaksScreen';
import { FastingHistoryScreen } from '../screens/FastingHistoryScreen';
import { PaywallScreen } from '../screens/PaywallScreen';

export type HomeStackParamList = {
  Dashboard: undefined;
  PlanSelection: undefined;
  Streaks: undefined;
  FastingHistory: undefined;
  Paywall: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
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
        name="Dashboard"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PlanSelection"
        component={PlanSelectionScreen}
        options={{ title: 'Select Plan' }}
      />
      <Stack.Screen
        name="Streaks"
        component={StreaksScreen}
        options={{ title: 'Streaks & Achievements' }}
      />
      <Stack.Screen
        name="FastingHistory"
        component={FastingHistoryScreen}
        options={{ title: 'Fasting History' }}
      />
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{ title: 'Go Pro' }}
      />
    </Stack.Navigator>
  );
}
