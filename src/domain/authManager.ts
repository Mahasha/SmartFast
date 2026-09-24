/**
 * AuthManager — Handles user authentication, guest mode, and session management.
 *
 * Uses Supabase Auth for register/login/logout/refresh.
 * Guest mode: sets @fasttrack:guestMode flag, userId = "guest", no Supabase sync.
 * Session restore on launch: checks stored token, refreshes if expired, falls back to login.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 32.1, 32.2, 32.3, 32.4, 32.5
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../data/supabaseClient';
import { getItem, setItem, removeItem } from '../data/localStorage';
import { STORAGE_KEYS } from '../utils/constants';
import { UserProfile } from '../models/index';
import { ALL_PREDEFINED_PLANS } from '../models/plans';
import { cancelAllNotifications } from './notificationScheduler';
import { resolveSubscriptionForUser } from './subscriptionManager';
import { saveProfile, getLedgerProfile } from './profileManager';
import { restoreActiveSessionFromLedger } from './activeSessionLedger';
import { restoreQueueForUser, stashQueueForUser } from '../data/syncQueue';

const DEFAULT_PLAN_ID = 'plan-16-8';

// Device-level keys that are NOT tied to a specific user and must survive
// logout. The subscription ledger is keyed by userId, so preserving it only
// restores a tier when that same account signs back in.
const PRESERVED_KEYS: string[] = [
  STORAGE_KEYS.THEME_PREFERENCE,
  STORAGE_KEYS.SUBSCRIPTION_LEDGER,
  STORAGE_KEYS.PROFILE_LEDGER,
  STORAGE_KEYS.ACTIVE_SESSION_LEDGER,
  STORAGE_KEYS.SYNC_QUEUE_LEDGER,
];

/**
 * Wipes all locally-cached, user-scoped data (profile, sessions, stats, streak,
 * sync queue, etc.) so it can't leak into the next session — e.g. a guest
 * started right after logging out. Authenticated data is already synced to
 * Supabase and re-pulls on next login. Device preferences are preserved.
 */
async function clearLocalUserData(): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const userKeys = allKeys.filter(
    (key) => key.startsWith('@fasttrack:') && !PRESERVED_KEYS.includes(key),
  );
  if (userKeys.length > 0) {
    await AsyncStorage.multiRemove(userKeys);
  }
}

/**
 * Ensures a complete UserProfile exists in local storage for the signed-in
 * user. Creates one on first sign-in; otherwise backfills any missing fields
 * (userId, email) and discards a stale/unknown selectedPlanId. Without this a
 * freshly-registered account has no profile, so the Profile screen renders
 * empty fields and the display-name save is a no-op.
 *
 * Falls back to the per-user ledger when the active PROFILE key is absent (e.g.
 * after logout wiped it) so the saved display name and preferences are restored
 * rather than reset to the email prefix.
 */
async function ensureUserProfile(userId: string, email: string): Promise<void> {
  const local =
    (await getItem<Partial<UserProfile>>(STORAGE_KEYS.PROFILE)) ??
    (await getLedgerProfile(userId));
  let remote: Partial<UserProfile> | null = null;
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('userId', userId).maybeSingle();
    if (!error) remote = data as Partial<UserProfile> | null;
  } catch {
    // Offline startup continues from the per-user local ledger.
  }
  const existing = local && remote
    ? (local.updatedAt ?? '') > (remote.updatedAt ?? '') ? local : remote
    : local ?? remote;
  const shouldSync = !remote || (!!local && (local.updatedAt ?? '') > (remote.updatedAt ?? ''));
  const now = new Date().toISOString();

  const displayName =
    existing?.displayName?.trim() || email.split('@')[0] || 'FastTrack User';

  const planIsKnown =
    !!existing?.selectedPlanId &&
    ALL_PREDEFINED_PLANS.some((p) => p.planId === existing.selectedPlanId);

  const profile: UserProfile = {
    userId,
    email,
    displayName,
    selectedPlanId: planIsKnown ? existing!.selectedPlanId! : DEFAULT_PLAN_ID,
    unitPreference: existing?.unitPreference ?? 'metric',
    themePreference: existing?.themePreference ?? 'system',
    onboardingCompleted: existing?.onboardingCompleted ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: existing?.updatedAt ?? now,
  };

  await saveProfile(profile, shouldSync);
}

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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch('https://www.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── AuthManager State ───────────────────────────────────────────────────────

let _currentSession: AuthSession | null = null;
let _isGuestMode = false;

// ─── Auth State Observability ──────────────────────────────────────────────────

export type AuthStatus = 'authenticated' | 'guest' | 'unauthenticated';

const _listeners = new Set<() => void>();

/**
 * Subscribe to auth state changes. Returns an unsubscribe function.
 * Designed for React's useSyncExternalStore so navigation re-renders
 * when the user logs in, registers, starts guest mode, or logs out.
 */
export function subscribeAuthState(listener: () => void): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

/**
 * Current auth status snapshot. Must return a stable value so
 * useSyncExternalStore can compare references between renders.
 */
export function getAuthStatus(): AuthStatus {
  if (_currentSession !== null && !_isGuestMode) return 'authenticated';
  if (_isGuestMode) return 'guest';
  return 'unauthenticated';
}

function emitAuthChange(): void {
  for (const listener of _listeners) {
    listener();
  }
}

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
    await restoreQueueForUser(session.userId);
    await ensureUserProfile(session.userId, session.email);
    await resolveSubscriptionForUser(session.userId, session.email);
    await restoreActiveSessionFromLedger(session.userId);
    emitAuthChange();

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
    await restoreQueueForUser(session.userId);
    await ensureUserProfile(session.userId, session.email);
    await resolveSubscriptionForUser(session.userId, session.email);
    await restoreActiveSessionFromLedger(session.userId);
    emitAuthChange();

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
  await stashQueueForUser(getCurrentUserId());
  try {
    await supabase.auth.signOut();
  } catch {
    // Best-effort sign out from Supabase
  }
  try {
    await cancelAllNotifications();
  } catch {
    // Best-effort — clearing local data below is what matters
  }
  await clearLocalUserData();
  _currentSession = null;
  _isGuestMode = false;
  emitAuthChange();
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
        emitAuthChange();
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
    await restoreQueueForUser(session.userId);
    await ensureUserProfile(session.userId, session.email);
    await resolveSubscriptionForUser(session.userId, session.email);
    await restoreActiveSessionFromLedger(session.userId);
    emitAuthChange();
    return session;
  } catch {
    // Check guest mode fallback
    const guestMode = await getItem<boolean>(STORAGE_KEYS.GUEST_MODE);
    if (guestMode) {
      _isGuestMode = true;
      emitAuthChange();
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
      emitAuthChange();
      return null;
    }

    const session: AuthSession = {
      userId: data.session.user.id,
      email: data.session.user.email ?? '',
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };

    _currentSession = session;
    emitAuthChange();
    return session;
  } catch {
    _currentSession = null;
    emitAuthChange();
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
  emitAuthChange();
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
    emitAuthChange();

    // Re-key all locally-stored guest data to the new account so it displays
    // under and syncs to the authenticated user.
    await rekeyGuestData(data.user.id);
    await ensureUserProfile(data.user.id, data.user.email ?? email);

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
 * Rewrites the `userId` field of every locally-stored record from the guest
 * placeholder ("guest") to the authenticated user's id. Covers singleton
 * records, the session history array, and per-date daily stats.
 */
async function rekeyGuestData(userId: string): Promise<void> {
  // Singleton records that carry a userId field.
  const singletonKeys = [
    STORAGE_KEYS.PROFILE,
    STORAGE_KEYS.STREAK,
    STORAGE_KEYS.SUBSCRIPTION_STATUS,
    STORAGE_KEYS.NOTIFICATION_PREFS,
    STORAGE_KEYS.ACTIVE_SESSION,
  ];
  for (const key of singletonKeys) {
    const record = await getItem<{ userId?: string }>(key);
    if (record && record.userId === 'guest') {
      await setItem(key, { ...record, userId });
    }
  }

  // Session history is an array of records.
  const history = await getItem<{ userId?: string }[]>(STORAGE_KEYS.SESSION_HISTORY);
  if (history) {
    const rekeyed = history.map((r) => (r.userId === 'guest' ? { ...r, userId } : r));
    await setItem(STORAGE_KEYS.SESSION_HISTORY, rekeyed);
  }

  // Daily stats are stored one key per date.
  const allKeys = await AsyncStorage.getAllKeys();
  for (const key of allKeys) {
    if (key.startsWith(STORAGE_KEYS.DAILY_STATS_PREFIX)) {
      const record = await getItem<{ userId?: string }>(key);
      if (record && record.userId === 'guest') {
        await setItem(key, { ...record, userId });
      }
    }
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
  emitAuthChange();
}
