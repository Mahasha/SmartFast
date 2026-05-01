/**
 * RegisterScreen — New account registration with email/password.
 *
 * Requirements: 1.1, 1.4, 1.8
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
import { register } from '../domain/authManager';
import { AuthStackParamList } from '../navigation/AuthStack';

type RegisterNavProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export function RegisterScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<RegisterNavProp>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validateInputs = (): string | null => {
    if (!email.trim()) {
      return 'Please enter your email.';
    }
    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return 'Please enter a valid email address.';
    }
    if (!password) {
      return 'Please enter a password.';
    }
    if (password.length < 6) {
      return 'Password must be at least 6 characters.';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match.';
    }
    return null;
  };

  const handleRegister = async () => {
    setError(null);

    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    const result = await register(email.trim(), password);
    setLoading(false);

    if (result.success) {
      // Navigate to onboarding on successful registration
      navigation.navigate('Onboarding');
    } else {
      switch (result.error) {
        case 'EMAIL_IN_USE':
          setError('An account with this email already exists.');
          break;
        case 'NETWORK_UNAVAILABLE':
          setError('An internet connection is required to create an account.');
          break;
        case 'SERVER_ERROR':
          setError('Something went wrong. Please try again.');
          break;
        default:
          setError('Registration failed. Please try again.');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Create Account</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Sign up to sync your data across devices
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

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
              borderColor: theme.colors.textSecondary + '40',
            },
          ]}
          placeholder="Confirm Password"
          placeholderTextColor={theme.colors.textSecondary}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          editable={!loading}
          accessibilityLabel="Confirm password input"
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={handleRegister}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Create account"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Account</Text>
          )}
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
    fontSize: 28,
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
});
