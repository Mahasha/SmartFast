/**
 * AuthStack — Stack navigator for the authentication flow.
 *
 * Screens:
 * - Login — User login
 * - Register — New account registration
 * - Onboarding — First-time user onboarding
 *
 * Implements Requirement 24 AC4: auth screens accessible via navigation.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useTheme } from '../theme/ThemeContext';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  Onboarding: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
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
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: 'Create Account' }}
      />
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
