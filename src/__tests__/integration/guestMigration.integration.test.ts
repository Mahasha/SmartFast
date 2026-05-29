/**
 * Integration Test: Guest Mode → Migration Flow
 *
 * Tests the guest session lifecycle and migration to an authenticated account.
 * Verifies that local data is preserved during migration and that offline
 * migration is properly blocked.
 *
 * Validates: Requirements 32.1, 32.2, 32.3, 32.4, 32.5
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  startGuestSession,
  migrateGuestToAccount,
  isGuest,
  isAuthenticated,
  getCurrentUserId,
  _resetState,
} from '../../domain/authManager';
import { setItem, getItem } from '../../data/localStorage';
import { STORAGE_KEYS } from '../../utils/constants';
import { FastingSession } from '../../models/index';

// Mock Supabase client
const mockSignUp = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();

jest.mock('../../data/supabaseClient', () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      refreshSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    from: jest.fn(() => ({
      upsert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    })),
  },
}));

// Mock fetch for network check
const originalFetch = global.fetch;

describe('Guest Mode → Migration Integration', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    _resetState();
    jest.clearAllMocks();
    // Default: network available
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Guest session lifecycle', () => {
    it('should start a guest session with userId "guest"', async () => {
      const guestSession = await startGuestSession();

      expect(guestSession.userId).toBe('guest');
      expect(guestSession.isGuest).toBe(true);
      expect(isGuest()).toBe(true);
      expect(isAuthenticated()).toBe(false);
      expect(getCurrentUserId()).toBe('guest');
    });

    it('should persist guest mode flag in AsyncStorage', async () => {
      await startGuestSession();

      const guestFlag = await getItem<boolean>(STORAGE_KEYS.GUEST_MODE);
      expect(guestFlag).toBe(true);
    });

    it('should allow local data operations in guest mode', async () => {
      await startGuestSession();

      // Simulate saving a fasting session locally
      const session: FastingSession = {
        sessionId: 'guest-session-1',
        userId: 'guest',
        planId: 'plan-12-12',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
        actualEndTime: null,
        status: 'ACTIVE',
        durationFasted: null,
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setItem(STORAGE_KEYS.ACTIVE_SESSION, session);
      const retrieved = await getItem<FastingSession>(STORAGE_KEYS.ACTIVE_SESSION);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.sessionId).toBe('guest-session-1');
      expect(retrieved!.userId).toBe('guest');
    });
  });

  describe('Guest-to-account migration', () => {
    it('should successfully migrate when email is new', async () => {
      await startGuestSession();

      // Mock successful signup
      mockSignUp.mockResolvedValue({
        data: {
          user: { id: 'new-user-id', email: 'test@example.com' },
          session: {
            access_token: 'token-123',
            refresh_token: 'refresh-123',
          },
        },
        error: null,
      });

      const result = await migrateGuestToAccount('test@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(isGuest()).toBe(false);
      expect(isAuthenticated()).toBe(true);
      expect(getCurrentUserId()).toBe('new-user-id');
    });

    it('re-keys local guest data to the new account on migration', async () => {
      await startGuestSession();

      // Local records created in guest mode carry the placeholder userId.
      await setItem(STORAGE_KEYS.SESSION_HISTORY, [
        { sessionId: 's1', userId: 'guest', status: 'COMPLETED' },
      ]);
      await setItem(STORAGE_KEYS.STREAK, { streakId: 'streak-local', userId: 'guest' });

      mockSignUp.mockResolvedValue({
        data: {
          user: { id: 'new-user-id', email: 'test@example.com' },
          session: { access_token: 'token-123', refresh_token: 'refresh-123' },
        },
        error: null,
      });

      const result = await migrateGuestToAccount('test@example.com', 'password123');
      expect(result.success).toBe(true);

      const history = await getItem<{ userId: string }[]>(STORAGE_KEYS.SESSION_HISTORY);
      expect(history![0]!.userId).toBe('new-user-id');
      const streak = await getItem<{ userId: string }>(STORAGE_KEYS.STREAK);
      expect(streak!.userId).toBe('new-user-id');
    });

    it('should fail migration when email already exists', async () => {
      await startGuestSession();

      // Mock email already registered error
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      });

      const result = await migrateGuestToAccount('existing@example.com', 'password123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.dataPreserved).toBe(true);
        expect(result.error).toContain('already exists');
      }
      // Should remain in guest mode
      expect(isGuest()).toBe(true);
    });

    it('should block migration when offline and preserve data', async () => {
      await startGuestSession();

      // Save some local data
      await setItem(STORAGE_KEYS.SESSION_HISTORY, [
        { sessionId: 'local-session', status: 'COMPLETED' },
      ]);

      // Mock network unavailable
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await migrateGuestToAccount('test@example.com', 'password123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.dataPreserved).toBe(true);
        expect(result.error).toContain('internet connection');
      }

      // Verify local data is preserved
      const history = await getItem(STORAGE_KEYS.SESSION_HISTORY);
      expect(history).not.toBeNull();

      // Should remain in guest mode
      expect(isGuest()).toBe(true);
    });
  });
});
