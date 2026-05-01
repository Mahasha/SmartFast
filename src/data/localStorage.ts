import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Typed AsyncStorage helpers with JSON serialization/deserialization
 * and error handling for the FastTrack app.
 *
 * Validates: Requirements 27.1, 27.2, 27.3
 */

/**
 * Reads a value from AsyncStorage and deserializes it from JSON.
 * Returns null if the key does not exist or if deserialization fails.
 */
export async function getItem<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(
      `[localStorage] Failed to read or parse key "${key}":`,
      error,
    );
    return null;
  }
}

/**
 * Serializes a value to JSON and writes it to AsyncStorage.
 * Throws a descriptive error if the write fails.
 */
export async function setItem<T>(key: string, value: T): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    await AsyncStorage.setItem(key, serialized);
  } catch (error) {
    throw new Error(
      `[localStorage] Failed to write key "${key}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Removes a key from AsyncStorage.
 * Throws a descriptive error if the removal fails.
 */
export async function removeItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    throw new Error(
      `[localStorage] Failed to remove key "${key}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Returns all keys currently stored in AsyncStorage.
 */
export async function getAllKeys(): Promise<string[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return keys as string[];
  } catch (error) {
    console.error('[localStorage] Failed to get all keys:', error);
    return [];
  }
}

/**
 * Batch reads multiple keys from AsyncStorage and deserializes each value.
 * Returns an array of results in the same order as the input keys.
 * Individual parse failures return null for that entry.
 */
export async function multiGet<T>(keys: string[]): Promise<(T | null)[]> {
  try {
    const record = await AsyncStorage.getMany(keys);
    return keys.map((key) => {
      const value = record[key] ?? null;
      if (value === null) {
        return null;
      }
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    });
  } catch (error) {
    console.error('[localStorage] Failed to batch read keys:', error);
    return keys.map(() => null);
  }
}

/**
 * Batch removes multiple keys from AsyncStorage.
 * Throws a descriptive error if the operation fails.
 */
export async function multiRemove(keys: string[]): Promise<void> {
  try {
    await AsyncStorage.removeMany(keys);
  } catch (error) {
    throw new Error(
      `[localStorage] Failed to batch remove keys: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
