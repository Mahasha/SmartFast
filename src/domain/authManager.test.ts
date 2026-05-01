/**
 * Unit tests for AuthManager
 *
 * Tests: login, register, guest mode, migration (new email),
 * existing-email handling, offline migration blocking.
 *
 * Requirements: 1, 32
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock supabase client
const mockSignUp = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();
const mockRefreshSession = jest.fn();

jest.mock('../data/supabaseClient', () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
    },
  },
}));

// Mock fetch for network check
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Import after mocks
import {
  register,
  login,
  logout,
  restoreSession,
  refreshToken,
  startGuestSession,
  migrateGuestToAccount,
  isGuest,
  isAuthenticated,
  _resetState,
} from './authManager';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockNetworkOnline() {
  mockFetch.mockResolvedValue({ ok: true });
}

function mockNetworkOffline() {
  mockFetch.mockRejectedValue(new Error('Network unavailable'));
}

function mockSuccessfulSignUp(userId = 'user-123', email = 'test@example.com') {
  mockSignUp.mockResolvedValue({
    data: {
      user: { id: userId, email },
      session: {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
        user: { id: userId, email },
      },
    },
    error: null,
  });
}

function mockSuccessfulLogin(userId = 'user-123', email = 'test@example.com') {
  mockSignInWithPassword.mockResolvedValue({
    data: {
      user: { id: userId, email },
      session: {
        access_token: 'access-token-456',
        refresh_token: 'refresh-token-456',
        user: { id: userId, email },
      },
    },
    error: null,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  _resetState();
  mockNetworkOnline();
});

describe('AuthManager', () => {
  describe('register', () => {
    it('creates a new account and returns session on success', async () => {
      mockSuccessfulSignUp();

      const result = await register('test@example.com', 'password123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.session.userId).toBe('user-123');
        expect(result.session.email).toBe('test@example.com');
        expect(result.session.accessToken).toBe('access-token-123');
      }
      expect(isAuthenticated()).toBe(true);
      expect(isGuest()).toBe(false);
    });

    it('returns EMAIL_IN_USE when email is already registered', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      });

      const result = await register('existing@example.com', 'password123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('EMAIL_IN_USE');
      }
    });

    it('returns NETWORK_UNAVAILABLE when offline', async () => {
      mockNetworkOffline();

      const result = await register('test@example.com', 'password123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('NETWORK_UNAVAILABLE');
      }
      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it('returns SERVER_ERROR on unexpected Supabase error', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Internal server error' },
      });

      const result = await register('test@example.com', 'password123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('SERVER_ERROR');
      }
    });

    it('clears guest mode flag on successful registration', async () => {
      await AsyncStorage.setItem(STORAGE_KEYS.GUEST_MODE, JSON.stringify(true));
      mockSuccessfulSignUp();

      await register('test@example.com', 'password123');

      const guestMode = await AsyncStorage.getItem(STORAGE_KEYS.GUEST_MODE);
      expect(guestMode).toBeNull();
    });
  });

  describe('login', () => {
    it('authenticates user and returns session on success', async () => {
      mockSuccessfulLogin();

      const result = await login('test@example.com', 'password123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.session.userId).toBe('user-123');
        expect(result.session.email).toBe('test@example.com');
        expect(result.session.accessToken).toBe('access-token-456');
      }
      expect(isAuthenticated()).toBe(true);
      expect(isGuest()).toBe(false);
    });

    it('returns INVALID_CREDENTIALS on wrong password', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      const result = await login('test@example.com', 'wrongpassword');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_CREDENTIALS');
      }
    });

    it('returns NETWORK_UNAVAILABLE when offline', async () => {
      mockNetworkOffline();

      const result = await login('test@example.com', 'password123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('NETWORK_UNAVAILABLE');
      }
      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });

    it('returns SERVER_ERROR on unexpected error', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Service unavailable' },
      });

      const result = await login('test@example.com', 'password123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('SERVER_ERROR');
      }
    });
  });

  describe('logout', () => {
    it('clears session and guest mode', async () => {
      mockSuccessfulLogin();
      await login('test@example.com', 'password123');
      mockSignOut.mockResolvedValue({ error: null });

      await logout();

      expect(isAuthenticated()).toBe(false);
      expect(isGuest()).toBe(false);
    });

    it('handles Supabase signOut failure gracefully', async () => {
      mockSuccessfulLogin();
      await login('test@example.com', 'password123');
      mockSignOut.mockRejectedValue(new Error('Network error'));

      await logout();

      expect(isAuthenticated()).toBe(false);
    });
  });

  describe('guest mode', () => {
    it('starts guest session and sets guest mode flag', async () => {
      const session = await startGuestSession();

      expect(session.userId).toBe('guest');
      expect(session.isGuest).toBe(true);
      expect(isGuest()).toBe(true);
      expect(isAuthenticated()).toBe(false);

      const stored = await AsyncStorage.getItem(STORAGE_KEYS.GUEST_MODE);
      expect(JSON.parse(stored!)).toBe(true);
    });

    it('guest mode does not require network', async () => {
      mockNetworkOffline();

      const session = await startGuestSession();

      expect(session.userId).toBe('guest');
      expect(isGuest()).toBe(true);
    });
  });

  describe('restoreSession', () => {
    it('restores authenticated session from Supabase', async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-456', email: 'restored@example.com' },
            access_token: 'restored-access',
            refresh_token: 'restored-refresh',
          },
        },
        error: null,
      });

      const session = await restoreSession();

      expect(session).not.toBeNull();
      expect(session!.userId).toBe('user-456');
      expect(isAuthenticated()).toBe(true);
    });

    it('returns null and detects guest mode when no Supabase session', async () => {
      await AsyncStorage.setItem(STORAGE_KEYS.GUEST_MODE, JSON.stringify(true));
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const session = await restoreSession();

      expect(session).toBeNull();
      expect(isGuest()).toBe(true);
    });

    it('returns null when no session and not guest', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const session = await restoreSession();

      expect(session).toBeNull();
      expect(isGuest()).toBe(false);
      expect(isAuthenticated()).toBe(false);
    });
  });

  describe('refreshToken', () => {
    it('refreshes session token successfully', async () => {
      mockRefreshSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-789', email: 'refresh@example.com' },
            access_token: 'new-access',
            refresh_token: 'new-refresh',
          },
        },
        error: null,
      });

      const session = await refreshToken();

      expect(session).not.toBeNull();
      expect(session!.accessToken).toBe('new-access');
      expect(isAuthenticated()).toBe(true);
    });

    it('returns null when refresh fails', async () => {
      mockRefreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Token expired' },
      });

      const session = await refreshToken();

      expect(session).toBeNull();
      expect(isAuthenticated()).toBe(false);
    });
  });

  describe('migrateGuestToAccount', () => {
    beforeEach(async () => {
      await startGuestSession();
    });

    it('creates account and migrates guest data for new email', async () => {
      mockSuccessfulSignUp('new-user-id', 'new@example.com');

      const result = await migrateGuestToAccount('new@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(isGuest()).toBe(false);
      expect(isAuthenticated()).toBe(true);

      // Guest mode flag should be cleared
      const guestMode = await AsyncStorage.getItem(STORAGE_KEYS.GUEST_MODE);
      expect(guestMode).toBeNull();
    });

    it('returns error when email already exists', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      });

      const result = await migrateGuestToAccount('existing@example.com', 'password123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(
          'An account already exists for this email. Please log in to continue.',
        );
        expect(result.dataPreserved).toBe(true);
      }
      // Should remain in guest mode
      expect(isGuest()).toBe(true);
    });

    it('blocks migration when offline and preserves data', async () => {
      mockNetworkOffline();

      const result = await migrateGuestToAccount('new@example.com', 'password123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('internet connection is required');
        expect(result.dataPreserved).toBe(true);
      }
      // Should remain in guest mode
      expect(isGuest()).toBe(true);
      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it('preserves data on server error during migration', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Internal server error' },
      });

      const result = await migrateGuestToAccount('new@example.com', 'password123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.dataPreserved).toBe(true);
      }
      expect(isGuest()).toBe(true);
    });
  });

  describe('isGuest / isAuthenticated', () => {
    it('both false initially', () => {
      expect(isGuest()).toBe(false);
      expect(isAuthenticated()).toBe(false);
    });

    it('isGuest true after startGuestSession', async () => {
      await startGuestSession();
      expect(isGuest()).toBe(true);
      expect(isAuthenticated()).toBe(false);
    });

    it('isAuthenticated true after login', async () => {
      mockSuccessfulLogin();
      await login('test@example.com', 'password123');
      expect(isAuthenticated()).toBe(true);
      expect(isGuest()).toBe(false);
    });

    it('both false after logout', async () => {
      mockSuccessfulLogin();
      await login('test@example.com', 'password123');
      mockSignOut.mockResolvedValue({ error: null });
      await logout();
      expect(isGuest()).toBe(false);
      expect(isAuthenticated()).toBe(false);
    });
  });
});
