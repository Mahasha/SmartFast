/**
 * DailyTracker Domain Service
 *
 * Records and retrieves daily health metrics keyed by local date (YYYY-MM-DD).
 * All values are stored in canonical units:
 * - waterIntake: millilitres
 * - weight: kilograms
 * - calories: kcal
 * - steps: integer count
 *
 * Conversions (glasses → ml, lb → kg) happen at the UI/service boundary, not here.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.5, 9.6, 9.7, 34.2
 */

import { v4 as uuidv4 } from 'uuid';
import { DailyStats } from '../models/index';
import { getItem, setItem } from '../data/localStorage';
import { enqueue } from '../data/syncQueue';
import { dailyStatsKey, STORAGE_KEYS } from '../utils/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

export type MetricType = 'waterIntake' | 'weight' | 'calories' | 'steps';

export type ValidationResult =
  | { valid: true }
  | { valid: false; warning: string };

// ─── Validation Ranges ───────────────────────────────────────────────────────

const METRIC_RANGES: Record<MetricType, { min: number; max: number; unit: string }> = {
  waterIntake: { min: 0, max: 20000, unit: 'ml' },
  weight: { min: 20, max: 300, unit: 'kg' },
  calories: { min: 0, max: 10000, unit: 'kcal' },
  steps: { min: 0, max: 200000, unit: 'steps' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns today's date as YYYY-MM-DD in the device's local timezone.
 *
 * Validates: Requirement 34.2
 */
export function getLocalDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the current timezone offset in minutes (e.g., UTC+2 → -120).
 */
function getTimezoneOffsetMinutes(now: Date = new Date()): number {
  return now.getTimezoneOffset();
}

// ─── Domain Functions ────────────────────────────────────────────────────────

/**
 * Validates a metric value against its allowed range.
 *
 * Returns { valid: true } if within range, or { valid: false, warning } if outside.
 *
 * Validates: Requirement 9.7
 */
export function validateMetric(metric: MetricType, value: number): ValidationResult {
  const range = METRIC_RANGES[metric];

  if (!Number.isFinite(value)) {
    return { valid: false, warning: `${metric} must be a valid number.` };
  }

  if (metric === 'steps' && !Number.isInteger(value)) {
    return { valid: false, warning: 'Steps must be a whole number.' };
  }

  if (value < range.min || value > range.max) {
    return {
      valid: false,
      warning: `${metric} value ${value} is outside the expected range (${range.min}–${range.max} ${range.unit}). Are you sure?`,
    };
  }

  return { valid: true };
}

/**
 * Retrieves the DailyStats record for a given local date.
 * Returns null if no record exists for that date.
 *
 * Validates: Requirement 9.5
 */
export async function getDailyStats(localDate: string): Promise<DailyStats | null> {
  const key = dailyStatsKey(localDate);
  return getItem<DailyStats>(key);
}

/**
 * Saves (creates or merges) daily stats for the current calendar day.
 *
 * - If no record exists for today, creates a new DailyStats record.
 * - If a record already exists, merges the provided fields into it (overwriting per-field).
 * - Only non-undefined fields in the input are merged.
 *
 * Validates: Requirements 9.2, 9.3, 9.6
 */
export async function saveDailyStats(
  stats: Partial<Pick<DailyStats, 'waterIntake' | 'weight' | 'calories' | 'steps'>>,
  userId: string = 'guest',
  now: Date = new Date(),
): Promise<DailyStats> {
  const localDate = getLocalDate(now);
  const key = dailyStatsKey(localDate);
  const existing = await getItem<DailyStats>(key);
  const nowIso = now.toISOString();

  let record: DailyStats;

  if (existing) {
    // Merge: only overwrite fields that are explicitly provided
    record = {
      ...existing,
      waterIntake: stats.waterIntake !== undefined ? stats.waterIntake : existing.waterIntake,
      weight: stats.weight !== undefined ? stats.weight : existing.weight,
      calories: stats.calories !== undefined ? stats.calories : existing.calories,
      steps: stats.steps !== undefined ? stats.steps : existing.steps,
      updatedAt: nowIso,
    };
  } else {
    // Create new record
    record = {
      statsId: uuidv4(),
      userId,
      localDate,
      waterIntake: stats.waterIntake ?? null,
      weight: stats.weight ?? null,
      calories: stats.calories ?? null,
      steps: stats.steps ?? null,
      timezoneOffsetMinutes: getTimezoneOffsetMinutes(now),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  await setItem(key, record);
  await enqueue(record);
  return record;
}
