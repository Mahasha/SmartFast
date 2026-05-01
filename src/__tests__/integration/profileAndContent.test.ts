/**
 * Unit Tests: ProfileManager, NotificationPreference Persistence, Content Loading
 *
 * Tests profile management operations, notification preference persistence,
 * and static content loading for Learn and Recipe sections.
 *
 * Validates: Requirements 19, 14, 17, 18
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getItem, setItem, removeItem } from '../../data/localStorage';
import { STORAGE_KEYS } from '../../utils/constants';
import { UserProfile, NotificationPreference } from '../../models/index';

// Mock Supabase client
jest.mock('../../data/supabaseClient', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn().mockResolvedValue({}),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      refreshSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    from: jest.fn(() => ({
      delete: jest.fn().mockReturnValue({
        neq: jest.fn().mockResolvedValue({ error: null }),
      }),
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    })),
  },
}));

describe('Profile Management', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  describe('Profile CRUD operations', () => {
    const defaultProfile: UserProfile = {
      userId: 'user-123',
      displayName: 'Test User',
      email: 'test@example.com',
      selectedPlanId: 'plan-16-8',
      unitPreference: 'metric',
      themePreference: 'system',
      onboardingCompleted: true,
      createdAt: '2024-06-01T00:00:00.000Z',
      updatedAt: '2024-06-01T00:00:00.000Z',
    };

    it('should persist and retrieve a user profile', async () => {
      await setItem(STORAGE_KEYS.PROFILE, defaultProfile);

      const retrieved = await getItem<UserProfile>(STORAGE_KEYS.PROFILE);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.userId).toBe('user-123');
      expect(retrieved!.displayName).toBe('Test User');
      expect(retrieved!.email).toBe('test@example.com');
    });

    it('should update display name', async () => {
      await setItem(STORAGE_KEYS.PROFILE, defaultProfile);

      const profile = await getItem<UserProfile>(STORAGE_KEYS.PROFILE);
      const updated: UserProfile = {
        ...profile!,
        displayName: 'New Name',
        updatedAt: new Date().toISOString(),
      };
      await setItem(STORAGE_KEYS.PROFILE, updated);

      const result = await getItem<UserProfile>(STORAGE_KEYS.PROFILE);
      expect(result!.displayName).toBe('New Name');
    });

    it('should update unit preference (metric/imperial)', async () => {
      await setItem(STORAGE_KEYS.PROFILE, defaultProfile);

      const profile = await getItem<UserProfile>(STORAGE_KEYS.PROFILE);
      const updated: UserProfile = {
        ...profile!,
        unitPreference: 'imperial',
        updatedAt: new Date().toISOString(),
      };
      await setItem(STORAGE_KEYS.PROFILE, updated);

      const result = await getItem<UserProfile>(STORAGE_KEYS.PROFILE);
      expect(result!.unitPreference).toBe('imperial');
    });

    it('should update theme preference', async () => {
      await setItem(STORAGE_KEYS.PROFILE, defaultProfile);

      const profile = await getItem<UserProfile>(STORAGE_KEYS.PROFILE);
      const updated: UserProfile = {
        ...profile!,
        themePreference: 'dark',
        updatedAt: new Date().toISOString(),
      };
      await setItem(STORAGE_KEYS.PROFILE, updated);

      const result = await getItem<UserProfile>(STORAGE_KEYS.PROFILE);
      expect(result!.themePreference).toBe('dark');
    });

    it('should return null when no profile exists', async () => {
      const result = await getItem<UserProfile>(STORAGE_KEYS.PROFILE);
      expect(result).toBeNull();
    });

    it('should clear profile on account deletion', async () => {
      await setItem(STORAGE_KEYS.PROFILE, defaultProfile);

      await removeItem(STORAGE_KEYS.PROFILE);

      const result = await getItem<UserProfile>(STORAGE_KEYS.PROFILE);
      expect(result).toBeNull();
    });
  });
});

describe('Notification Preference Persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  const defaultPrefs: NotificationPreference = {
    prefId: 'pref-123',
    userId: 'user-123',
    fastingMilestones: true,
    waterReminders: true,
    waterReminderInterval: 120,
    weighInReminder: true,
    weighInReminderTime: '08:00',
    createdAt: '2024-06-01T00:00:00.000Z',
    updatedAt: '2024-06-01T00:00:00.000Z',
  };

  it('should persist and retrieve notification preferences', async () => {
    await setItem(STORAGE_KEYS.NOTIFICATION_PREFS, defaultPrefs);

    const retrieved = await getItem<NotificationPreference>(STORAGE_KEYS.NOTIFICATION_PREFS);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.fastingMilestones).toBe(true);
    expect(retrieved!.waterReminders).toBe(true);
    expect(retrieved!.waterReminderInterval).toBe(120);
    expect(retrieved!.weighInReminderTime).toBe('08:00');
  });

  it('should update water reminder interval', async () => {
    await setItem(STORAGE_KEYS.NOTIFICATION_PREFS, defaultPrefs);

    const prefs = await getItem<NotificationPreference>(STORAGE_KEYS.NOTIFICATION_PREFS);
    const updated: NotificationPreference = {
      ...prefs!,
      waterReminderInterval: 60, // Changed to 1 hour
      updatedAt: new Date().toISOString(),
    };
    await setItem(STORAGE_KEYS.NOTIFICATION_PREFS, updated);

    const result = await getItem<NotificationPreference>(STORAGE_KEYS.NOTIFICATION_PREFS);
    expect(result!.waterReminderInterval).toBe(60);
  });

  it('should toggle fasting milestones off', async () => {
    await setItem(STORAGE_KEYS.NOTIFICATION_PREFS, defaultPrefs);

    const prefs = await getItem<NotificationPreference>(STORAGE_KEYS.NOTIFICATION_PREFS);
    const updated: NotificationPreference = {
      ...prefs!,
      fastingMilestones: false,
      updatedAt: new Date().toISOString(),
    };
    await setItem(STORAGE_KEYS.NOTIFICATION_PREFS, updated);

    const result = await getItem<NotificationPreference>(STORAGE_KEYS.NOTIFICATION_PREFS);
    expect(result!.fastingMilestones).toBe(false);
  });

  it('should update weigh-in reminder time', async () => {
    await setItem(STORAGE_KEYS.NOTIFICATION_PREFS, defaultPrefs);

    const prefs = await getItem<NotificationPreference>(STORAGE_KEYS.NOTIFICATION_PREFS);
    const updated: NotificationPreference = {
      ...prefs!,
      weighInReminderTime: '07:30',
      updatedAt: new Date().toISOString(),
    };
    await setItem(STORAGE_KEYS.NOTIFICATION_PREFS, updated);

    const result = await getItem<NotificationPreference>(STORAGE_KEYS.NOTIFICATION_PREFS);
    expect(result!.weighInReminderTime).toBe('07:30');
  });

  it('should return null when no preferences exist', async () => {
    const result = await getItem<NotificationPreference>(STORAGE_KEYS.NOTIFICATION_PREFS);
    expect(result).toBeNull();
  });
});

describe('Content Loading', () => {
  describe('Learn Articles', () => {
    it('should load learn articles from static JSON', () => {
      const articles = require('../../content/learnArticles.json');

      expect(Array.isArray(articles)).toBe(true);
      expect(articles.length).toBeGreaterThan(0);
    });

    it('should have required fields on each article', () => {
      const articles = require('../../content/learnArticles.json');

      for (const article of articles) {
        expect(article).toHaveProperty('id');
        expect(article).toHaveProperty('title');
        expect(article).toHaveProperty('category');
        expect(article).toHaveProperty('contentType');
        expect(article).toHaveProperty('estimatedReadTime');
        expect(article).toHaveProperty('body');
        expect(article.contentType).toBe('article');
        expect(typeof article.body).toBe('string');
        expect(article.body.length).toBeGreaterThan(0);
      }
    });

    it('should have articles in expected categories', () => {
      const articles = require('../../content/learnArticles.json');
      const categories = new Set(articles.map((a: { category: string }) => a.category));

      expect(categories.has('Getting Started')).toBe(true);
      expect(categories.has('Science of Fasting')).toBe(true);
      expect(categories.has('Tips and Tricks')).toBe(true);
      expect(categories.has('Health Benefits')).toBe(true);
    });

    it('should have unique IDs for all articles', () => {
      const articles = require('../../content/learnArticles.json');
      const ids = articles.map((a: { id: string }) => a.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Recipes', () => {
    it('should load recipes from static JSON', () => {
      const recipes = require('../../content/recipes.json');

      expect(Array.isArray(recipes)).toBe(true);
      expect(recipes.length).toBeGreaterThan(0);
    });

    it('should have required fields on each recipe', () => {
      const recipes = require('../../content/recipes.json');

      for (const recipe of recipes) {
        expect(recipe).toHaveProperty('id');
        expect(recipe).toHaveProperty('title');
        expect(recipe).toHaveProperty('category');
        expect(recipe).toHaveProperty('description');
        expect(recipe).toHaveProperty('ingredients');
        expect(recipe).toHaveProperty('steps');
        expect(recipe).toHaveProperty('nutrition');
        expect(recipe).toHaveProperty('prepTime');
        expect(Array.isArray(recipe.ingredients)).toBe(true);
        expect(Array.isArray(recipe.steps)).toBe(true);
        expect(recipe.ingredients.length).toBeGreaterThan(0);
        expect(recipe.steps.length).toBeGreaterThan(0);
      }
    });

    it('should have nutrition info with required fields', () => {
      const recipes = require('../../content/recipes.json');

      for (const recipe of recipes) {
        expect(recipe.nutrition).toHaveProperty('calories');
        expect(recipe.nutrition).toHaveProperty('protein');
        expect(recipe.nutrition).toHaveProperty('carbs');
        expect(recipe.nutrition).toHaveProperty('fat');
        expect(typeof recipe.nutrition.calories).toBe('number');
        expect(recipe.nutrition.calories).toBeGreaterThan(0);
      }
    });

    it('should have recipes in expected categories', () => {
      const recipes = require('../../content/recipes.json');
      const categories = new Set(recipes.map((r: { category: string }) => r.category));

      expect(categories.has('Breakfast')).toBe(true);
      expect(categories.has('Lunch')).toBe(true);
      expect(categories.has('Dinner')).toBe(true);
      expect(categories.has('Snacks')).toBe(true);
      expect(categories.has('Smoothies')).toBe(true);
    });

    it('should have unique IDs for all recipes', () => {
      const recipes = require('../../content/recipes.json');
      const ids = recipes.map((r: { id: string }) => r.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});
