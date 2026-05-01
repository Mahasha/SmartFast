import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { RootNavigator } from './src/navigation/RootNavigator';

/**
 * Inner app component that has access to the theme context.
 * Wraps NavigationContainer and RootNavigator.
 */
function AppContent() {
  const { theme } = useTheme();

  return (
    <NavigationContainer>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
    </NavigationContainer>
  );
}

/**
 * Root App component.
 * ThemeProvider must wrap NavigationContainer so that
 * navigation components can access the theme via useTheme().
 */
export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
