/**
 * RootNavigator — Top-level navigator that conditionally shows
 * the AuthStack or the main AppNavigator (bottom tabs) based on
 * the live auth state.
 *
 * On launch it restores any stored session, showing a spinner until
 * the restore completes. Once auth state is known, authenticated and
 * guest users see the main tabs; everyone else sees the auth flow.
 * Because it subscribes to the Auth Manager, logging in / registering /
 * starting guest mode / logging out automatically swaps the stack.
 *
 * Implements Requirement 24 AC4: screen structure with auth flow.
 */

import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppNavigator } from './AppNavigator';
import { AuthStack } from './AuthStack';
import { subscribeAuthState, getAuthStatus, restoreSession } from '../domain/authManager';

export type RootStackParamList = {
  Main: undefined;
  Auth: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const authStatus = React.useSyncExternalStore(subscribeAuthState, getAuthStatus);
  const [restoring, setRestoring] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    restoreSession().finally(() => {
      if (!cancelled) setRestoring(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (restoring) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const showMain = authStatus === 'authenticated' || authStatus === 'guest';

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {showMain ? (
        <Stack.Screen name="Main" component={AppNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
