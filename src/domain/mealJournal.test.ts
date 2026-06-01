/**
 * Unit tests for the MealJournal domain service.
 *
 * Focus areas (Feature 1 acceptance):
 *  1. Freemium tier gating — free tier: 1 photo meal/day, unlimited text meals;
 *     Pro / pro_mock: unlimited. The gate is tier-based and MUST fire even
 *     though PRO_UNLOCKED_FOR_LAUNCH unlocks every other Pro feature.
 *  2. Local-only constraints — photos go through the device file store and the
 *     stored URI is local; meals persist only to the per-day AsyncStorage key
 *     and NEVER to the Supabase sync queue.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock the device file store so no expo-file-system native code loads in jest.
// persistMealImage echoes back a deterministic local path derived from mealId.
jest.mock('../data/mealImageStore', () => ({
  persistMealImage: jest.fn((_sourceUri: string, mealId: string) =>
    Promise.resolve(`file:///local/meal-photos/${mealId}.jpg`),
  ),
  deleteMealImage: jest.fn(() => Promise.resolve()),
}));

import {
  addMeal,
  canAddMealPhoto,
  countPhotoMealsForDate,
  deleteMeal,
  getMealsForDate,
  hasUnlimitedMealPhotos,
  FREE_TIER_DAILY_PHOTO_LIMIT,
  PHOTO_LIMIT_MESSAGE,
} from './mealJournal';
import { deleteMealImage, persistMealImage } from '../data/mealImageStore';
import { getItem } from '../data/localStorage';
import { mealsKey, STORAGE_KEYS } from '../utils/constants';
import { PRO_UNLOCKED_FOR_LAUNCH } from '../utils/featureFlags';
import { SubscriptionTier } from '../models/index';

const DATE = '2024-06-15';
const NEXT_DATE = '2024-06-16';
const NOW = new Date(2024, 5, 15, 9, 0, 0); // June 15, 2024, 09:00 local
const PHOTO_URI = 'file:///tmp/camera-capture.jpg';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addPhotoMeal(tier: SubscriptionTier, localDate = DATE, name = 'Photo Meal') {
  return addMeal({ name, photoSourceUri: PHOTO_URI }, { tier, localDate, now: NOW });
}

function addTextMeal(tier: SubscriptionTier, localDate = DATE, name = 'Text Meal') {
  return addMeal({ name }, { tier, localDate, now: NOW });
}

// ─── Tier gating ───────────────────────────────────────────────────────────────

describe('freemium photo gating', () => {
  it('caps free tier at one photo per day', () => {
    expect(FREE_TIER_DAILY_PHOTO_LIMIT).toBe(1);
  });

  it('allows the first photo meal for a free user', async () => {
    const result = await addPhotoMeal('free');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.meal.photoUri).not.toBeNull();
    }
    expect(persistMealImage).toHaveBeenCalledTimes(1);
  });

  it('blocks the second photo meal on the same day with the upgrade copy', async () => {
    const first = await addPhotoMeal('free');
    const second = await addPhotoMeal('free');

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.reason).toBe('PHOTO_LIMIT_REACHED');
      expect(second.message).toBe(PHOTO_LIMIT_MESSAGE);
    }
  });

  it('a blocked photo attempt has no side effects (no file copy, storage unchanged)', async () => {
    const first = await addPhotoMeal('free');
    const blocked = await addPhotoMeal('free');

    expect(first.ok && !blocked.ok).toBe(true);
    // Only the first (allowed) meal copied a file and was persisted.
    expect(persistMealImage).toHaveBeenCalledTimes(1);
    expect(await getMealsForDate(DATE)).toHaveLength(1);
  });

  it('allows unlimited text-only meals for free tier, even after the photo limit is hit', async () => {
    await addPhotoMeal('free'); // consumes the single photo slot
    await addTextMeal('free', DATE, 'Snack 1');
    await addTextMeal('free', DATE, 'Snack 2');
    await addTextMeal('free', DATE, 'Snack 3');

    const meals = await getMealsForDate(DATE);
    expect(meals).toHaveLength(4);
    expect(meals.filter((m) => m.photoUri !== null)).toHaveLength(1);
    expect(persistMealImage).toHaveBeenCalledTimes(1);
  });

  it('resets the photo limit on a new calendar day', async () => {
    const a = await addPhotoMeal('free', DATE);
    const b = await addPhotoMeal('free', NEXT_DATE);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(await countPhotoMealsForDate(DATE)).toBe(1);
    expect(await countPhotoMealsForDate(NEXT_DATE)).toBe(1);
  });

  it.each(['pro', 'pro_mock'] as const)(
    'allows unlimited photo meals for %s tier',
    async (tier) => {
      await addPhotoMeal(tier, DATE, 'A');
      await addPhotoMeal(tier, DATE, 'B');
      const third = await addPhotoMeal(tier, DATE, 'C');

      expect(third.ok).toBe(true);
      expect(await countPhotoMealsForDate(DATE)).toBe(3);
    },
  );

  it('enforces the free-tier limit even though PRO_UNLOCKED_FOR_LAUNCH unlocks other Pro features', async () => {
    // Documents the environment this gate must survive (design Decision 1):
    // the limit is tier-based, NOT routed through hasProAccess().
    expect(PRO_UNLOCKED_FOR_LAUNCH).toBe(true);

    const first = await addPhotoMeal('free');
    const second = await addPhotoMeal('free');

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
  });
});

describe('hasUnlimitedMealPhotos', () => {
  it('is false for free, true for pro and pro_mock', () => {
    expect(hasUnlimitedMealPhotos('free')).toBe(false);
    expect(hasUnlimitedMealPhotos('pro')).toBe(true);
    expect(hasUnlimitedMealPhotos('pro_mock')).toBe(true);
  });
});

describe('canAddMealPhoto', () => {
  it('free tier: allowed when under the daily limit', async () => {
    expect(await canAddMealPhoto(DATE, 'free')).toEqual({ allowed: true });
  });

  it('free tier: blocked once the daily limit is reached', async () => {
    await addPhotoMeal('free');
    const gate = await canAddMealPhoto(DATE, 'free');

    expect(gate.allowed).toBe(false);
    if (!gate.allowed) {
      expect(gate.reason).toBe('PHOTO_LIMIT_REACHED');
      expect(gate.message).toBe(PHOTO_LIMIT_MESSAGE);
    }
  });

  it('pro / pro_mock: always allowed regardless of existing photo count', async () => {
    await addPhotoMeal('pro');
    await addPhotoMeal('pro');

    expect(await canAddMealPhoto(DATE, 'pro')).toEqual({ allowed: true });
    expect(await canAddMealPhoto(DATE, 'pro_mock')).toEqual({ allowed: true });
  });
});

// ─── Local-only constraints ────────────────────────────────────────────────────

describe('local-only constraints', () => {
  it('saves the photo via the device file store and records the LOCAL uri', async () => {
    const result = await addPhotoMeal('free');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(persistMealImage).toHaveBeenCalledWith(PHOTO_URI, result.meal.mealId);
      expect(result.meal.photoUri).toBe(
        `file:///local/meal-photos/${result.meal.mealId}.jpg`,
      );
    }
  });

  it('persists meals to the per-day local AsyncStorage key only', async () => {
    const result = await addTextMeal('free', DATE, 'Oats');
    expect(result.ok).toBe(true);

    const raw = await getItem<unknown[]>(mealsKey(DATE));
    expect(Array.isArray(raw)).toBe(true);
    expect(raw).toHaveLength(1);
  });

  it('NEVER enqueues meals to the Supabase sync queue (zero cloud cost)', async () => {
    await addPhotoMeal('free');
    await addTextMeal('free', DATE, 'Coffee');
    await addTextMeal('pro', NEXT_DATE, 'Lunch');

    expect(await getItem(STORAGE_KEYS.SYNC_QUEUE)).toBeNull();
  });

  it('text-only meals never touch the image store', async () => {
    const result = await addTextMeal('free');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.meal.photoUri).toBeNull();
    }
    expect(persistMealImage).not.toHaveBeenCalled();
  });
});

// ─── Reads / record shape ──────────────────────────────────────────────────────

describe('getMealsForDate', () => {
  it('returns [] when no meals exist', async () => {
    expect(await getMealsForDate(DATE)).toEqual([]);
  });

  it('returns meals in the order they were added', async () => {
    await addTextMeal('free', DATE, 'First');
    await addTextMeal('free', DATE, 'Second');

    const meals = await getMealsForDate(DATE);
    expect(meals.map((m) => m.name)).toEqual(['First', 'Second']);
  });

  it('keys meals by date independently', async () => {
    await addTextMeal('free', DATE, 'Day1');
    await addTextMeal('free', NEXT_DATE, 'Day2');

    expect((await getMealsForDate(DATE)).map((m) => m.name)).toEqual(['Day1']);
    expect((await getMealsForDate(NEXT_DATE)).map((m) => m.name)).toEqual(['Day2']);
  });
});

describe('countPhotoMealsForDate', () => {
  it('counts only photo meals', async () => {
    await addPhotoMeal('pro', DATE, 'With photo');
    await addTextMeal('pro', DATE, 'No photo');

    expect(await countPhotoMealsForDate(DATE)).toBe(1);
  });
});

describe('meal record', () => {
  it('populates id, date, timestamps and trims the name', async () => {
    const result = await addMeal(
      { name: '  Avocado Toast  ', calories: 350 },
      { tier: 'free', localDate: DATE, userId: 'user-1', now: NOW },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const m = result.meal;
      expect(m.mealId).toBeTruthy();
      expect(m.userId).toBe('user-1');
      expect(m.localDate).toBe(DATE);
      expect(m.name).toBe('Avocado Toast');
      expect(m.calories).toBe(350);
      expect(m.photoUri).toBeNull();
      expect(m.loggedAt).toBe(NOW.toISOString());
      expect(m.createdAt).toBe(NOW.toISOString());
      expect(m.updatedAt).toBe(NOW.toISOString());
    }
  });

  it("defaults userId to 'guest' and calories to null", async () => {
    const result = await addMeal({ name: 'Water' }, { tier: 'free', localDate: DATE, now: NOW });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.meal.userId).toBe('guest');
      expect(result.meal.calories).toBeNull();
    }
  });

  it('derives localDate from now when not provided', async () => {
    const result = await addMeal({ name: 'Eggs' }, { tier: 'free', now: NOW });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.meal.localDate).toBe(DATE);
    }
  });
});

// ─── Validation ────────────────────────────────────────────────────────────────

describe('validation', () => {
  it('rejects an empty/whitespace name with INVALID_INPUT and no side effects', async () => {
    const result = await addMeal(
      { name: '   ', photoSourceUri: PHOTO_URI },
      { tier: 'free', localDate: DATE, now: NOW },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('INVALID_INPUT');
    }
    expect(persistMealImage).not.toHaveBeenCalled();
    expect(await getMealsForDate(DATE)).toHaveLength(0);
  });

  it('rejects out-of-range calories', async () => {
    const result = await addMeal(
      { name: 'Huge', calories: 999999 },
      { tier: 'free', localDate: DATE, now: NOW },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('INVALID_INPUT');
    }
  });

  it('rejects negative calories', async () => {
    const result = await addMeal(
      { name: 'Neg', calories: -5 },
      { tier: 'free', localDate: DATE, now: NOW },
    );

    expect(result.ok).toBe(false);
  });
});

// ─── Delete ────────────────────────────────────────────────────────────────────

describe('deleteMeal', () => {
  it('removes the meal and deletes its local photo file', async () => {
    const created = await addPhotoMeal('free');
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const removed = await deleteMeal(created.meal.mealId, DATE);

    expect(removed).toBe(true);
    expect(await getMealsForDate(DATE)).toHaveLength(0);
    expect(deleteMealImage).toHaveBeenCalledWith(created.meal.photoUri);
  });

  it('does not call the image store for text-only meals', async () => {
    const created = await addTextMeal('free');
    if (!created.ok) return;

    await deleteMeal(created.meal.mealId, DATE);
    expect(deleteMealImage).not.toHaveBeenCalled();
  });

  it('returns false for an unknown id and leaves storage untouched', async () => {
    await addTextMeal('free', DATE, 'Keep');

    const removed = await deleteMeal('does-not-exist', DATE);

    expect(removed).toBe(false);
    expect(await getMealsForDate(DATE)).toHaveLength(1);
  });

  it('frees the daily photo slot for free tier after deleting the photo meal', async () => {
    const created = await addPhotoMeal('free');
    if (!created.ok) return;

    expect((await canAddMealPhoto(DATE, 'free')).allowed).toBe(false);

    await deleteMeal(created.meal.mealId, DATE);

    expect((await canAddMealPhoto(DATE, 'free')).allowed).toBe(true);
    const second = await addPhotoMeal('free');
    expect(second.ok).toBe(true);
  });
});
