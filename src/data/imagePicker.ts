/**
 * Meal photo picker (camera / library) boundary.
 *
 * Thin wrapper around expo-image-picker so the UI doesn't depend on it directly
 * and so permission + cancel handling lives in one place. The picker returns a
 * temporary local file URI; persisting it into permanent local storage is the
 * job of mealImageStore. Nothing here uploads or leaves the device.
 */

import * as ImagePicker from 'expo-image-picker';

export type MealPhotoSource = 'camera' | 'library';

export type MealPhotoPickResult =
  | { status: 'ok'; uri: string }
  | { status: 'canceled' }
  | { status: 'denied' };

/**
 * Requests the relevant permission, launches the camera or library, and returns
 * the picked image's temporary local URI.
 *
 * - 'denied'   — the user declined the camera/photos permission.
 * - 'canceled' — the user backed out without choosing an image.
 * - 'ok'       — `uri` is a temporary local file:// path to copy into storage.
 */
export async function pickMealPhoto(source: MealPhotoSource): Promise<MealPhotoPickResult> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    return { status: 'denied' };
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.7,
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || result.assets.length === 0) {
    return { status: 'canceled' };
  }

  return { status: 'ok', uri: result.assets[0]!.uri };
}
