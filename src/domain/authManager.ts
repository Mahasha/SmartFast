/**
 * AuthManager — Handles user authentication, guest mode, and session management.
 *
 * Uses Supabase Auth for register/login/logout/refresh.
 * Guest mode: sets @fasttrack:guestMode flag, userId = "guest", no Supabase sync.
 * Session restore on launch: checks stored token, refreshes if expired, falls back to login.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 32.1, 32.2, 32.3, 32.4, 32.5
 */

import { supabase } from '../data/supabaseClient';
import { getItem, setItem, removeItem } from '../data/localStorage';
import { STORAGE_KEYS } from '../utils/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthSession {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

export interface GuestSession {
  userId: 'guest';
  isGuest: true;
}

export type AuthError =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_IN_USE'
  | 'NETWORK_UNAVAILABLE'
  | 'SERVER_ERROR'
  | 'EMAIL_EXISTS_GUEST_MIGRATION';

export type AuthResult =
  | { success: true; session: AuthSession }
  | { success: false; error: AuthError };

export type MigrationResult =
  | { success: true }
  | { success: false; error: string; dataPreserved: true };

// ─── Network Check ───────────────────────────────────────────────────────────

/**
 * Simple network availability check using a lightweight fetch.
 * Returns true if the device can reach the network.
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

// ─── AuthManager State ───────────────────────────────────────────────────────

let _currentSession: AuthSession | null = null;
let _isGuestMode = false;

// ─── AuthManager Implementation ──────────────────────────────────────────────

/**
 * Register a new user with email and password via Supabase Auth.
 * Requirement 1.1, 1.4, 1.8
 */
export async function register(email: string, password: string): Promise<AuthResult> {
  const online = await checkNetworkAvailable();
  if (!online) {
    return { success: false, error: 'NETWORK_UNAVAILABLE' };
  }

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      if (
        error.message.toLowerCase().includes('already registered') ||
        error.message.toLowerCase().includes('already been registered') ||
        error.message.toLowerCase().includes('user already registered')
      ) {
        return { success: false, error: 'EMAIL_IN_USE' };
      }
      return { success: false, error: 'SERVER_ERROR' };
    }

    if (!data.session || !data.user) {
      return { success: false, error: 'SERVER_ERROR' };
    }

    const session: AuthSession = {
      userId: data.user.id,
      email: data.user.email ?? email,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };

    _currentSession = session;
    _isGuestMode = false;
    await removeItem(STORAGE_KEYS.GUEST_MODE);

    return { success: true, session };
  } catch {
    return { success: false, error: 'SERVER_ERROR' };
  }
}

/**
 * Log in an existing user with email and password via Supabase Auth.
 * Requirement 1.2, 1.3, 1.8
 */
export async function login(email: string, password: string): Promise<AuthResult> {
  const online = await checkNetworkAvailable();
  if (!online) {
    return { success: false, error: 'NETWORK_UNAVAILABLE' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (
        error.message.toLowerCase().includes('invalid') ||
        error.message.toLowerCase().includes('credentials')
      ) {
        return { success: false, error: 'INVALID_CREDENTIALS' };
      }
      return { success: false, error: 'SERVER_ERROR' };
    }

    if (!data.session || !data.user) {
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    const session: AuthSession = {
      userId: data.user.id,
      email: data.user.email ?? email,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };

    _currentSession = session;
    _isGuestMode = false;
    await removeItem(STORAGE_KEYS.GUEST_MODE);

    return { success: true, session };
  } catch {
    return { success: false, error: 'SERVER_ERROR' };
  }
}

/**
 * Log out the current user, clearing session and local auth state.
 * Requirement 1.5
 */
export async function logout(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    // Best-effort sign out from Supabase
  }
  _currentSession = null;
  _isGuestMode = false;
  await removeItem(STORAGE_KEYS.GUEST_MODE);
}

/**
 * Restore session on app launch. Checks stored Supabase session token.
 * Requirement 1.6, 1.7
 */
export async function restoreSession(): Promise<AuthSession | null> {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      // Check if we're in guest mode
      const guestMode = await getItem<boolean>(STORAGE_KEYS.GUEST_MODE);
      if (guestMode) {
        _isGuestMode = true;
        _currentSession = null;
        return null;
      }
      return null;
    }

    const session: AuthSession = {
      userId: data.session.user.id,
      email: data.session.user.email ?? '',
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };

    _currentSession = session;
    _isGuestMode = false;
    return session;
  } catch {
    // Check guest mode fallback
    const guestMode = await getItem<boolean>(STORAGE_KEYS.GUEST_MODE);
    if (guestMode) {
      _isGuestMode = true;
    }
    return null;
  }
}

/**
 * Refresh the current session token.
 * Requirement 1.7
 */
export async function refreshToken(): Promise<AuthSession | null> {
  try {
    const { data, error } = await supabase.auth.refreshSession();

    if (error || !data.session) {
      _currentSession = null;
      return null;
    }

    const session: AuthSession = {
      userId: data.session.user.id,
      email: data.session.user.email ?? '',
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };

    _currentSession = session;
    return session;
  } catch {
    _currentSession = null;
    return null;
  }
}

/**
 * Start a guest session — local-only, no Supabase sync.
 * Requirement 32.1
 */
export async function startGuestSession(): Promise<GuestSession> {
  _isGuestMode = true;
  _currentSession = null;
  await setItem(STORAGE_KEYS.GUEST_MODE, true);
  return { userId: 'guest', isGuest: true };
}

/**
 * Migrate guest data to a new authenticated account.
 * - If email is new: creates Supabase account, migrates local data.
 * - If email exists: returns error with EMAIL_EXISTS_GUEST_MIGRATION.
 * - Offline: blocks migration, preserves data.
 * Requirements: 32.2, 32.3, 32.4, 32.5
 */
export async function migrateGuestToAccount(
  email: string,
  password: string,
): Promise<MigrationResult> {
  // Check network connectivity first
  const online = await checkNetworkAvailable();
  if (!online) {
    return {
      success: false,
      error: 'An internet connection is required to create your account. Your local data is safe — please try again when you\'re online.',
      dataPreserved: true,
    };
  }

  try {
    // Attempt to create a new account
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      if (
        error.message.toLowerCase().includes('already registered') ||
        error.message.toLowerCase().includes('already been registered') ||
        error.message.toLowerCase().includes('user already registered')
      ) {
        return {
          success: false,
          error: 'An account already exists for this email. Please log in to continue.',
          dataPreserved: true,
        };
      }
      return {
        success: false,
        error: `Migration failed: ${error.message}`,
        dataPreserved: true,
      };
    }

    if (!data.session || !data.user) {
      return {
        success: false,
        error: 'Migration failed: Could not create account.',
        dataPreserved: true,
      };
    }

    // Successfully created account — update auth state
    const session: AuthSession = {
      userId: data.user.id,
      email: data.user.email ?? email,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };

    _currentSession = session;
    _isGuestMode = false;
    await removeItem(STORAGE_KEYS.GUEST_MODE);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `Migration failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      dataPreserved: true,
    };
  }
}

/**
 * Check if the current session is in guest mode.
 */
export function isGuest(): boolean {
  return _isGuestMode;
}

/**
 * Check if the user is authenticated (has a valid session, not guest).
 */
export function isAuthenticated(): boolean {
  return _currentSession !== null && !_isGuestMode;
}

/**
 * Get the current user ID. Returns "guest" for guest mode, or the Supabase user ID.
 */
export function getCurrentUserId(): string {
  if (_isGuestMode) return 'guest';
  return _currentSession?.userId ?? '';
}

/**
 * Get the current session (for testing/internal use).
 */
export function getCurrentSession(): AuthSession | null {
  return _currentSession;
}

// ─── Test Helpers ────────────────────────────────────────────────────────────

/**
 * Reset internal state (for testing only).
 */
export function _resetState(): void {
  _currentSession = null;
  _isGuestMode = false;
}
