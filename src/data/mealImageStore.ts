/**
 * Meal image storage (LOCAL-ONLY).
 *
 * Persists meal photos into the app's private document directory using
 * expo-file-system. Images NEVER leave the device — there is no upload, no
 * cloud bucket, no external API. The domain layer stores only the returned
 * local `file://` URI (see `MealEntry.photoUri`), which honors the
 * zero-cloud-cost constraint.
 *
 * This module is the single boundary that touches the native file system, so
 * the meal-journal domain logic can be unit-tested by mocking it. The file I/O
 * itself depends on native modules and is verified on-device, not in jest.
 *
 * Uses the SDK 54 (expo-file-system v19) class-based API (`File` / `Directory`
 * / `Paths`), whose operations are synchronous; the async wrappers below keep a
 * stable, future-proof interface for callers.
 */

import { Directory, File, Paths } from 'expo-file-system';

/** Subfolder (under the document directory) that holds all meal photos. */
const MEAL_PHOTOS_DIRNAME = 'meal-photos';

function mealPhotosDirectory(): Directory {
  return new Directory(Paths.document, MEAL_PHOTOS_DIRNAME);
}

/** Ensures the meal-photos directory exists and returns it. */
function ensureMealPhotosDirectory(): Directory {
  const dir = mealPhotosDirectory();
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

/**
 * Copies a picked/captured image into permanent local app storage and returns
 * its device-local file URI. The source (usually a temporary cache file from
 * the camera/picker) is left untouched.
 *
 * @param sourceUri Temporary `file://` URI from expo-image-picker / the camera.
 * @param mealId    UUID of the owning meal; used as the stable filename.
 * @returns The permanent local `file://` URI to store on the meal record.
 */
export async function persistMealImage(sourceUri: string, mealId: string): Promise<string> {
  const dir = ensureMealPhotosDirectory();
  const source = new File(sourceUri);
  const extension = source.extension || '.jpg';
  const destination = new File(dir, `${mealId}${extension}`);

  // Overwrite defensively in case a file already exists for this id.
  if (destination.exists) {
    destination.delete();
  }
  source.copy(destination);

  return destination.uri;
}

/**
 * Deletes a meal photo from local storage. Safe to call with a URI whose file
 * no longer exists; failures are logged but never thrown, so deleting a meal
 * record never fails just because its image is already gone.
 */
export async function deleteMealImage(uri: string): Promise<void> {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch (error) {
    console.warn(`[mealImageStore] Failed to delete image "${uri}":`, error);
  }
}
