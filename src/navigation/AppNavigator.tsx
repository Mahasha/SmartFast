/**
 * AppNavigator — Bottom tab navigation for FastTrack.
 *
 * Implements Requirement 24:
 * - AC1: Bottom tabs with Home, Learn, Recipes, Profile
 * - AC2: Immediate navigation on tab tap
 * - AC3: Dark green accent on active tab
 * - AC4: Nested stack navigators for Home and Profile tabs
 * - AC5: Tab state preservation (unmountOnBlur defaults to false)
 *
 * Tab state is preserved by default in React Navigation bottom tabs —
 * screens remain mounted when switching tabs, preserving scroll position
 * and component state.
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { HomeStack } from './HomeStack';
import { LearnScreen } from '../screens/LearnScreen';
import { RecipesScreen } from '../screens/RecipesScreen';
import { ProfileStack } from './ProfileStack';

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { HomeStackParamList } from './HomeStack';
import type { ProfileStackParamList } from './ProfileStack';

export type BottomTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Learn: undefined;
  Recipes: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

/**
 * Simple text-based tab icon component.
 * Will be replaced with proper icons in a future task.
 */
function TabIcon({ label, color }: { label: string; color: string }) {
  return <Text style={[styles.tabIcon, { color }]}>{label}</Text>;
}

export function AppNavigator() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.timerTrack,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        // Preserve tab state when switching (Requirement 24 AC5)
        // unmountOnBlur defaults to false, keeping screens mounted
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <TabIcon label="🏠" color={color} />,
          tabBarAccessibilityLabel: 'Home tab',
        }}
      />
      <Tab.Screen
        name="Learn"
        component={LearnScreen}
        options={{
          tabBarLabel: 'Learn',
          tabBarIcon: ({ color }) => <TabIcon label="📚" color={color} />,
          tabBarAccessibilityLabel: 'Learn tab',
        }}
      />
      <Tab.Screen
        name="Recipes"
        component={RecipesScreen}
        options={{
          tabBarLabel: 'Recipes',
          tabBarIcon: ({ color }) => <TabIcon label="🍽️" color={color} />,
          tabBarAccessibilityLabel: 'Recipes tab',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon label="👤" color={color} />,
          tabBarAccessibilityLabel: 'Profile tab',
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    fontSize: 20,
  },
});
