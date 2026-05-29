// Manual mock for @react-native-async-storage/async-storage v3
const store = {};

const mockAsyncStorage = {
  getItem: jest.fn((key) => {
    return Promise.resolve(store[key] || null);
  }),
  setItem: jest.fn((key, value) => {
    store[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key) => {
    delete store[key];
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => {
    return Promise.resolve(Object.keys(store));
  }),
  // v3 batch API
  getMany: jest.fn((keys) => {
    const result = {};
    keys.forEach((key) => {
      result[key] = store[key] || null;
    });
    return Promise.resolve(result);
  }),
  setMany: jest.fn((entries) => {
    Object.entries(entries).forEach(([key, value]) => {
      store[key] = value;
    });
    return Promise.resolve();
  }),
  removeMany: jest.fn((keys) => {
    keys.forEach((key) => delete store[key]);
    return Promise.resolve();
  }),
  // Legacy v2 batch API (kept for backward compatibility with existing tests)
  multiGet: jest.fn((keys) => {
    return Promise.resolve(keys.map((key) => [key, store[key] || null]));
  }),
  multiSet: jest.fn((keyValuePairs) => {
    keyValuePairs.forEach(([key, value]) => {
      store[key] = value;
    });
    return Promise.resolve();
  }),
  multiRemove: jest.fn((keys) => {
    keys.forEach((key) => delete store[key]);
    return Promise.resolve();
  }),
};

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Default mock for expo-notifications so suites that only transitively import
// it (e.g. via authManager → notificationScheduler) don't pull Expo's
// strict-mode TS source into ts-jest. Suites that assert on scheduling
// override this with their own jest.mock('expo-notifications', ...).
jest.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve()),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('mock-notification-id')),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  setNotificationHandler: jest.fn(),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
}));
