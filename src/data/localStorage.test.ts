import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getItem,
  setItem,
  removeItem,
  getAllKeys,
  multiGet,
  multiRemove,
} from './localStorage';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('localStorage', () => {
  describe('getItem', () => {
    it('returns null when key does not exist', async () => {
      const result = await getItem<string>('@fasttrack:nonexistent');
      expect(result).toBeNull();
    });

    it('deserializes and returns stored JSON value', async () => {
      await AsyncStorage.setItem(
        '@fasttrack:profile',
        JSON.stringify({ name: 'Alice', age: 30 }),
      );
      const result = await getItem<{ name: string; age: number }>(
        '@fasttrack:profile',
      );
      expect(result).toEqual({ name: 'Alice', age: 30 });
    });

    it('returns null and logs error on invalid JSON', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      await AsyncStorage.setItem('@fasttrack:bad', 'not-json{{{');
      const result = await getItem<unknown>('@fasttrack:bad');
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read or parse key'),
        expect.anything(),
      );
      consoleSpy.mockRestore();
    });

    it('handles primitive values (number, boolean, string)', async () => {
      await AsyncStorage.setItem('@fasttrack:num', JSON.stringify(42));
      await AsyncStorage.setItem('@fasttrack:bool', JSON.stringify(true));
      await AsyncStorage.setItem('@fasttrack:str', JSON.stringify('hello'));

      expect(await getItem<number>('@fasttrack:num')).toBe(42);
      expect(await getItem<boolean>('@fasttrack:bool')).toBe(true);
      expect(await getItem<string>('@fasttrack:str')).toBe('hello');
    });
  });

  describe('setItem', () => {
    it('serializes and stores a value', async () => {
      await setItem('@fasttrack:session', { id: '123', status: 'ACTIVE' });
      const raw = await AsyncStorage.getItem('@fasttrack:session');
      expect(raw).toBe(JSON.stringify({ id: '123', status: 'ACTIVE' }));
    });

    it('throws a descriptive error when write fails', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('Disk full'),
      );
      await expect(setItem('@fasttrack:fail', { x: 1 })).rejects.toThrow(
        '[localStorage] Failed to write key "@fasttrack:fail": Disk full',
      );
    });
  });

  describe('removeItem', () => {
    it('removes a key from storage', async () => {
      await AsyncStorage.setItem('@fasttrack:temp', '"value"');
      await removeItem('@fasttrack:temp');
      const result = await AsyncStorage.getItem('@fasttrack:temp');
      expect(result).toBeNull();
    });

    it('throws a descriptive error when removal fails', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(
        new Error('Permission denied'),
      );
      await expect(removeItem('@fasttrack:fail')).rejects.toThrow(
        '[localStorage] Failed to remove key "@fasttrack:fail": Permission denied',
      );
    });
  });

  describe('getAllKeys', () => {
    it('returns all stored keys', async () => {
      await AsyncStorage.setItem('@fasttrack:a', '"1"');
      await AsyncStorage.setItem('@fasttrack:b', '"2"');
      const keys = await getAllKeys();
      expect(keys).toContain('@fasttrack:a');
      expect(keys).toContain('@fasttrack:b');
    });

    it('returns empty array when storage is empty', async () => {
      const keys = await getAllKeys();
      expect(keys).toEqual([]);
    });
  });

  describe('multiGet', () => {
    it('returns deserialized values for multiple keys', async () => {
      await AsyncStorage.setItem('@fasttrack:x', JSON.stringify({ v: 1 }));
      await AsyncStorage.setItem('@fasttrack:y', JSON.stringify({ v: 2 }));

      const results = await multiGet<{ v: number }>([
        '@fasttrack:x',
        '@fasttrack:y',
      ]);
      expect(results).toEqual([{ v: 1 }, { v: 2 }]);
    });

    it('returns null for missing keys in batch', async () => {
      await AsyncStorage.setItem('@fasttrack:exists', JSON.stringify('yes'));
      const results = await multiGet<string>([
        '@fasttrack:exists',
        '@fasttrack:missing',
      ]);
      expect(results).toEqual(['yes', null]);
    });

    it('returns null for entries with invalid JSON', async () => {
      await AsyncStorage.setItem('@fasttrack:good', JSON.stringify(42));
      await AsyncStorage.setItem('@fasttrack:bad', '{broken');
      const results = await multiGet<number>([
        '@fasttrack:good',
        '@fasttrack:bad',
      ]);
      expect(results).toEqual([42, null]);
    });
  });

  describe('multiRemove', () => {
    it('removes multiple keys at once', async () => {
      await AsyncStorage.setItem('@fasttrack:r1', '"a"');
      await AsyncStorage.setItem('@fasttrack:r2', '"b"');
      await multiRemove(['@fasttrack:r1', '@fasttrack:r2']);
      const keys = await AsyncStorage.getAllKeys();
      expect(keys).not.toContain('@fasttrack:r1');
      expect(keys).not.toContain('@fasttrack:r2');
    });

    it('throws a descriptive error when batch removal fails', async () => {
      const mockMultiRemove = AsyncStorage.multiRemove as unknown as jest.Mock;
      mockMultiRemove.mockRejectedValueOnce(new Error('Storage error'));
      await expect(
        multiRemove(['@fasttrack:x', '@fasttrack:y']),
      ).rejects.toThrow(
        '[localStorage] Failed to batch remove keys: Storage error',
      );
    });
  });
});
