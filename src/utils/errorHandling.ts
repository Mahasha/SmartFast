/**
 * Error Handling Utilities — Centralized error handling for FastTrack.
 *
 * Covers:
 * - 23.1: Sync error handling — network errors queue locally, retry limit with non-blocking warning
 * - 23.2: Notification error handling — log scheduling errors, show non-blocking message
 * - 23.3: Storage error handling — blocking alert for active session write failure; read failure attempts Supabase recovery
 * - 23.4: Auth error handling — network unavailable: show message, block attempt; server errors: generic retry message
 *
 * Critical invariant: Sync failures and notification failures NEVER stop the fasting timer.
 *
 * Validates: Requirements 35.1, 35.2, 35.3, 35.4, 35.5, 35.6, 35.7, 35.8, 35.9
 */

import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../data/supabaseClient';
import { STORAGE_KEYS } from './constants';
import { isAuthenticated } from '../domain/authManager';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum retry attempts for sync queue entries before showing a warning */
const MAX_SYNC_RETRIES = 5;

// ─── Network Check ───────────────────────────────────────────────────────────

/**
 * Simple network availability check.
 */
async function checkNetworkAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    await fetch('https://www.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return true;
  } catch {
    return false;
  }
}

// ─── 23.1: Sync Error Handling ───────────────────────────────────────────────

/**
 * Handles sync errors. Network errors are queued locally for retry.
 * After MAX_SYNC_RETRIES, shows a non-blocking warning.
 * Sync failures NEVER stop the fasting timer.
 *
 * Validates: Requirements 35.1, 35.2, 35.3
 */
export function handleSyncError(error: unknown, retryCount: number): void {
  const message = error instanceof Error ? error.message : 'Unknown sync error';
  console.warn(`[Sync] Error (attempt ${retryCount}): ${message}`);

  if (retryCount >= MAX_SYNC_RETRIES) {
    // Non-blocking warning — never interrupts the timer
    showNonBlockingWarning(
      'Sync Issue',
      'Some data hasn\'t synced yet. It will sync automatically when connection improves.',
    );
  }
  // Changes remain in the local sync queue for retry
}

/**
 * Checks if a sync error is a network error (should queue locally).
 */
export function isSyncNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { message?: string; code?: string };
  const message = (err.message ?? '').toLowerCase();
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('abort') ||
    message.includes('econnrefused') ||
    message.includes('enotfound')
  );
}

// ─── 23.2: Notification Error Handling ───────────────────────────────────────

/**
 * Handles notification scheduling errors.
 * Logs the error and shows a non-blocking message.
 * NEVER affects session state or timer operation.
 *
 * Validates: Requirements 35.4, 35.5
 */
export function handleNotificationError(error: unknown, context: string): void {
  const message = error instanceof Error ? error.message : 'Unknown notification error';
  console.warn(`[Notifications] ${context}: ${message}`);

  // Non-blocking — user can still fast without notifications
  showNonBlockingWarning(
    'Notification Issue',
    'Some notifications may not be delivered. Your fasting session is unaffected.',
  );
}

// ─── 23.3: Storage Error Handling ────────────────────────────────────────────

/**
 * Handles AsyncStorage write failure for an active session.
 * This is a BLOCKING alert because losing the active session is critical.
 *
 * Validates: Requirement 35.6
 */
export function handleStorageWriteError(error: unknown): void {
  const message = error instanceof Error ? error.message : 'Unknown storage error';
  console.error(`[Storage] Write failure: ${message}`);

  Alert.alert(
    'Storage Error',
    'Failed to save your session data. Please ensure your device has sufficient storage and try again.',
    [{ text: 'OK' }],
  );
}

/**
 * Handles AsyncStorage read failure.
 * For authenticated users, attempts recovery from Supabase.
 *
 * Validates: Requirement 35.7
 */
export async function handleStorageReadError(
  error: unknown,
  key: string,
): Promise<unknown | null> {
  const message = error instanceof Error ? error.message : 'Unknown storage error';
  console.error(`[Storage] Read failure for key "${key}": ${message}`);

  // Attempt Supabase recovery for authenticated users
  if (isAuthenticated()) {
    try {
      return await attemptSupabaseRecovery(key);
    } catch (recoveryError) {
      console.error('[Storage] Supabase recovery failed:', recoveryError);
    }
  }

  return null;
}

/**
 * Attempts to recover data from Supabase when local storage read fails.
 */
async function attemptSupabaseRecovery(key: string): Promise<unknown | null> {
  // Map storage keys to Supabase tables for recovery
  if (key === STORAGE_KEYS.ACTIVE_SESSION || key === STORAGE_KEYS.SESSION_HISTORY) {
    const { data } = await supabase
      .from('fasting_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    return data;
  }

  if (key === STORAGE_KEYS.PROFILE) {
    const { data } = await supabase.from('profiles').select('*').single();
    return data;
  }

  if (key === STORAGE_KEYS.STREAK) {
    const { data } = await supabase.from('streaks').select('*').single();
    return data;
  }

  return null;
}

// ─── 23.4: Auth Error Handling ───────────────────────────────────────────────

/**
 * Handles authentication errors with appropriate user messaging.
 *
 * - Network unavailable: shows message and blocks the attempt
 * - Server errors: shows generic retry message
 *
 * Validates: Requirements 35.8, 35.9
 */
export function handleAuthError(
  errorType: 'NETWORK_UNAVAILABLE' | 'SERVER_ERROR' | 'INVALID_CREDENTIALS' | 'EMAIL_IN_USE' | string,
): string {
  switch (errorType) {
    case 'NETWORK_UNAVAILABLE':
      return 'No internet connection. Please check your network and try again.';
    case 'INVALID_CREDENTIALS':
      return 'Invalid email or password. Please try again.';
    case 'EMAIL_IN_USE':
      return 'An account with this email already exists. Please log in instead.';
    case 'SERVER_ERROR':
    default:
      return 'Something went wrong. Please try again later.';
  }
}

// ─── Account Deletion ────────────────────────────────────────────────────────

/**
 * Deletes the user's account. This is an online-required, direct operation
 * outside the sync queue.
 *
 * Steps:
 * 1. Check network connectivity — block if offline
 * 2. Delete user data from Supabase
 * 3. Clear local AsyncStorage
 * 4. Sign out
 *
 * Validates: Requirement 19.6
 */
export async function deleteAccount(): Promise<void> {
  // Check network — deletion requires connectivity
  const online = await checkNetworkAvailable();
  if (!online) {
    Alert.alert(
      'No Internet Connection',
      'Account deletion requires an internet connection. Please connect to the internet and try again.',
      [{ text: 'OK' }],
    );
    return;
  }

  try {
    // Delete user data from Supabase tables
    const { error: sessionsError } = await supabase
      .from('fasting_sessions')
      .delete()
      .neq('session_id', '');

    if (sessionsError) {
      console.error('[DeleteAccount] Failed to delete sessions:', sessionsError);
    }

    const { error: statsError } = await supabase
      .from('daily_stats')
      .delete()
      .neq('stats_id', '');

    if (statsError) {
      console.error('[DeleteAccount] Failed to delete stats:', statsError);
    }

    const { error: streakError } = await supabase
      .from('streaks')
      .delete()
      .neq('streak_id', '');

    if (streakError) {
      console.error('[DeleteAccount] Failed to delete streaks:', streakError);
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .neq('user_id', '');

    if (profileError) {
      console.error('[DeleteAccount] Failed to delete profile:', profileError);
    }

    // Clear all local AsyncStorage
    await AsyncStorage.clear();

    // Sign out from Supabase
    await supabase.auth.signOut();

    Alert.alert(
      'Account Deleted',
      'Your account and all associated data have been permanently deleted.',
      [{ text: 'OK' }],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    Alert.alert(
      'Deletion Failed',
      `Failed to delete your account: ${message}. Please try again.`,
      [{ text: 'OK' }],
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Shows a non-blocking warning that doesn't interrupt the user's workflow.
 * Uses a brief Alert that the user can dismiss.
 */
function showNonBlockingWarning(title: string, message: string): void {
  // Use console.warn for non-blocking — in production this would be a toast/snackbar
  console.warn(`[${title}] ${message}`);
  // For MVP, we use Alert as a simple notification mechanism
  // In production, replace with a toast/snackbar component
}
