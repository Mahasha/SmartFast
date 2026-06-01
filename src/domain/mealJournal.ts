/**
 * MealJournal Domain Service
 *
 * Records and retrieves meal-journal entries keyed by local date (YYYY-MM-DD),
 * and enforces the freemium "visual journal" limit.
 *
 * LOCAL-ONLY by design: meals and their photos live entirely on the device
 * (AsyncStorage + the app document directory via mealImageStore). `MealEntry`
 * is intentionally excluded from `SyncableRecord` / the Supabase sync queue, so
 * this feature adds zero cloud cost.
 *
 * Freemium rule (Phase 1): free-tier users may save at most ONE photo meal per
 * calendar day; text-only meals are unlimited. Pro / pro_mock tiers are
 * unlimited.
 */

import { v4 as uuidv4 } from 'uuid';

import { MealEntry, SubscriptionTier } from '../models/index';
import { getItem, setItem } from '../data/localStorage';
import { deleteMealImage, persistMealImage } from '../data/mealImageStore';
import { mealsKey } from '../utils/constants';
import { getLocalDate } from './dailyTracker';

// ─── Freemium Constants ────────────────────────────────────────────────────────

/** Free-tier cap on photo ("visual") meals per calendar day. */
export const FREE_TIER_DAILY_PHOTO_LIMIT = 1;

/** Copy shown in the upgrade bottom sheet when the free-tier limit is hit. */
export const PHOTO_LIMIT_MESSAGE =
  'Free tier limited to 1 visual meal log per day. Upgrade to Pro for an unlimited visual journal.';

/** Upper sanity bound for a single meal's calories (kcal). */
const MEAL_CALORIE_MAX = 10000;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AddMealInput {
  /** Required, human-entered meal name. */
  name: string;
  /** Optional kcal for the meal. */
  calories?: number | null;
  /**
   * Optional temporary URI from the camera / image picker. When present, the
   * file is copied into local app storage and the meal becomes a "photo meal"
   * (subject to the free-tier daily limit). Never stored verbatim.
   */
  photoSourceUri?: string | null;
}

export interface AddMealOptions {
  /** Caller's subscription tier — drives the photo gate. */
  tier: SubscriptionTier;
  /** Calendar day to log the meal for. Defaults to today's local date. */
  localDate?: string;
  /** Owning user id. Defaults to 'guest'. */
  userId?: string;
  /** Injectable clock for deterministic timestamps/tests. */
  now?: Date;
}

export type PhotoGateResult =
  | { allowed: true }
  | { allowed: false; reason: 'PHOTO_LIMIT_REACHED'; message: string };

export type AddMealResult =
  | { ok: true; meal: MealEntry }
  | { ok: false; reason: 'PHOTO_LIMIT_REACHED' | 'INVALID_INPUT'; message: string };

// ─── Tier Gating ───────────────────────────────────────────────────────────────

/**
 * Whether a tier may log unlimited photo meals.
 *
 * NOTE: deliberately tier-based and NOT routed through subscriptionManager's
 * `hasProAccess()`, because the launch flag `PRO_UNLOCKED_FOR_LAUNCH` currently
 * unlocks every other Pro feature for everyone. Keeping this gate tier-based
 * lets the free-tier visual-journal limit be demonstrated now (the whole point
 * of building it in Phase 1).
 *
 * TODO(billing): once Google Play Billing is wired and `PRO_UNLOCKED_FOR_LAUNCH`
 * is flipped to false, unify this with `hasProAccess()` / the
 * `VISUAL_MEAL_JOURNAL` ProFeature so it follows the same path as everything
 * else.
 */
export function hasUnlimitedMealPhotos(tier: SubscriptionTier): boolean {
  return tier !== 'free';
}

/**
 * Checks whether another photo meal may be added for the given day under the
 * caller's tier. Pure read — performs no writes.
 */
export async function canAddMealPhoto(
  localDate: string,
  tier: SubscriptionTier,
): Promise<PhotoGateResult> {
  if (hasUnlimitedMealPhotos(tier)) {
    return { allowed: true };
  }

  const photoCount = await countPhotoMealsForDate(localDate);
  if (photoCount < FREE_TIER_DAILY_PHOTO_LIMIT) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'PHOTO_LIMIT_REACHED', message: PHOTO_LIMIT_MESSAGE };
}

// ─── Reads ─────────────────────────────────────────────────────────────────────

/**
 * Returns all meals logged for a local date, in the order they were added.
 * Returns an empty array when none exist.
 */
export async function getMealsForDate(localDate: string): Promise<MealEntry[]> {
  const meals = await getItem<MealEntry[]>(mealsKey(localDate));
  return meals ?? [];
}

/** Counts the photo ("visual") meals logged for a local date. */
export async function countPhotoMealsForDate(localDate: string): Promise<number> {
  const meals = await getMealsForDate(localDate);
  return meals.filter((meal) => meal.photoUri !== null).length;
}

// ─── Writes ────────────────────────────────────────────────────────────────────

/**
 * Adds a meal to the journal for a given day.
 *
 * - Enforces the free-tier photo limit BEFORE any file copy or storage write,
 *   so a blocked attempt leaves zero side effects.
 * - Copies any provided photo into local-only storage and records its local URI.
 * - Persists to the per-day AsyncStorage key only — never the sync queue.
 */
export async function addMeal(
  input: AddMealInput,
  options: AddMealOptions,
): Promise<AddMealResult> {
  const now = options.now ?? new Date();
  const localDate = options.localDate ?? getLocalDate(now);
  const userId = options.userId ?? 'guest';

  const validation = validateMealInput(input);
  if (!validation.valid) {
    return { ok: false, reason: 'INVALID_INPUT', message: validation.message };
  }

  const wantsPhoto =
    typeof input.photoSourceUri === 'string' && input.photoSourceUri.length > 0;

  if (wantsPhoto) {
    const gate = await canAddMealPhoto(localDate, options.tier);
    if (!gate.allowed) {
      return { ok: false, reason: gate.reason, message: gate.message };
    }
  }

  const mealId = uuidv4();
  const nowIso = now.toISOString();

  // Save the photo to LOCAL device storage only; store just the local URI.
  let photoUri: string | null = null;
  if (wantsPhoto && input.photoSourceUri) {
    photoUri = await persistMealImage(input.photoSourceUri, mealId);
  }

  const meal: MealEntry = {
    mealId,
    userId,
    localDate,
    name: input.name.trim(),
    calories: normalizeCalories(input.calories),
    photoUri,
    loggedAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const meals = await getMealsForDate(localDate);
  meals.push(meal);
  await setItem(mealsKey(localDate), meals);

  // NOTE: intentionally not enqueued to the Supabase sync queue. Meals are a
  // local-only feature (see MealEntry docs) — zero cloud cost by design.

  return { ok: true, meal };
}

/**
 * Deletes a meal from a day's journal and removes its local photo file (if any).
 * Returns false if no meal with that id exists for the date.
 */
export async function deleteMeal(mealId: string, localDate: string): Promise<boolean> {
  const meals = await getMealsForDate(localDate);
  const target = meals.find((meal) => meal.mealId === mealId);
  if (!target) {
    return false;
  }

  const remaining = meals.filter((meal) => meal.mealId !== mealId);
  await setItem(mealsKey(localDate), remaining);

  // Reclaim the local image file too, so deleting a meal frees device storage.
  if (target.photoUri) {
    await deleteMealImage(target.photoUri);
  }

  return true;
}

// ─── Validation ────────────────────────────────────────────────────────────────

function validateMealInput(
  input: AddMealInput,
): { valid: true } | { valid: false; message: string } {
  if (!input.name || input.name.trim().length === 0) {
    return { valid: false, message: 'Meal name is required.' };
  }

  const calories = input.calories;
  if (calories !== undefined && calories !== null) {
    if (!Number.isFinite(calories) || calories < 0 || calories > MEAL_CALORIE_MAX) {
      return {
        valid: false,
        message: `Calories must be a number between 0 and ${MEAL_CALORIE_MAX} kcal.`,
      };
    }
  }

  return { valid: true };
}

function normalizeCalories(calories: number | null | undefined): number | null {
  return calories === undefined || calories === null ? null : calories;
}
