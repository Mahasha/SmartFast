/**
 * LoginScreen — User login with email/password and "Continue as Guest" option.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.8, 32.1
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../theme/ThemeContext';
import { login, startGuestSession } from '../domain/authManager';
import { AuthStackParamList } from '../navigation/AuthStack';

type LoginNavProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export function LoginScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<LoginNavProp>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);

    if (result.success) {
      // Navigation to dashboard is handled by the root navigator
      // based on auth state change
    } else {
      switch (result.error) {
        case 'INVALID_CREDENTIALS':
          setError('Invalid email or password.');
          break;
        case 'NETWORK_UNAVAILABLE':
          setError('An internet connection is required to log in.');
          break;
        case 'SERVER_ERROR':
          setError('Something went wrong. Please try again.');
          break;
        default:
          setError('Login failed. Please try again.');
      }
    }
  };

  const handleGuestMode = async () => {
    await startGuestSession();
    // Navigation to dashboard handled by root navigator
  };

  const handleNavigateToRegister = () => {
    navigation.navigate('Register');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text }]}>FastTrack</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Sign in to your account
        </Text>

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: theme.colors.error + '15' }]}>
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
          </View>
        )}

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
              borderColor: theme.colors.textSecondary + '40',
            },
          ]}
          placeholder="Email"
          placeholderTextColor={theme.colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          accessibilityLabel="Email input"
        />

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
              borderColor: theme.colors.textSecondary + '40',
            },
          ]}
          placeholder="Password"
          placeholderTextColor={theme.colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
          accessibilityLabel="Password input"
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Log in"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Log In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.colors.primary }]}
          onPress={handleNavigateToRegister}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Create account"
        >
          <Text style={[styles.secondaryButtonText, { color: theme.colors.primary }]}>
            Create Account
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.guestButton}
          onPress={handleGuestMode}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Continue as guest"
        >
          <Text style={[styles.guestButtonText, { color: theme.colors.textSecondary }]}>
            Continue as Guest
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  guestButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  guestButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
