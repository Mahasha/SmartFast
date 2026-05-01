/**
 * RootNavigator — Top-level navigator that conditionally shows
 * the AuthStack or the main AppNavigator (bottom tabs).
 *
 * For now, always shows AppNavigator. Auth gating will be added
 * in a future task when the Auth Manager is implemented.
 *
 * Implements Requirement 24 AC4: screen structure with auth flow.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppNavigator } from './AppNavigator';
import { AuthStack } from './AuthStack';

export type RootStackParamList = {
  Main: undefined;
  Auth: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  // TODO: Replace with actual auth state check when Auth Manager is implemented
  const isAuthenticated = true;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={AppNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
    </Stack.Navigator>
  );
}
