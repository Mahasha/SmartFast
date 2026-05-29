/**
 * Unit tests for NotificationScheduler domain service
 *
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 15.1, 15.2, 15.3, 15.4, 16.1
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { FastingSession } from '../models/index';
import { STORAGE_KEYS } from '../utils/constants';
import {
  scheduleFastingMilestones,
  cancelSessionNotifications,
  rescheduleSessionNotifications,
  scheduleWaterReminders,
  scheduleWeighInReminder,
  cancelRemindersByType,
  requestPermissions,
  revalidateOnLaunch,
} from './notificationScheduler';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(() => Promise.resolve(`notif-${Math.random().toString(36).slice(2, 8)}`)),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'undetermined' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  SchedulableTriggerInputTypes: {
    DATE: 'date',
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createSession(overrides: Partial<FastingSession> = {}): FastingSession {
  const startTime = '2024-06-01T06:00:00.000Z';
  const endTime = '2024-06-01T22:00:00.000Z'; // 16 hours later
  return {
    sessionId: 'session-001',
    userId: 'guest',
    planId: 'plan-16-8',
    startTime,
    endTime,
    actualEndTime: null,
    status: 'ACTIVE',
    durationFasted: null,
    timezoneOffsetMinutes: 0,
    createdAt: startTime,
    updatedAt: startTime,
    ...overrides,
  };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.clear as jest.Mock)();
  // Set "now" to be at the start of the session so all milestones are in the future
  jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-01T06:00:00.000Z').getTime());
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('scheduleFastingMilestones', () => {
  it('schedules all milestones for a 16h session when all are in the future', async () => {
    // "now" is at session start, so Fast Started (immediate) is at the same time — it won't be scheduled
    // because triggerTime <= now. Let's set now to just before start.
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-01T05:59:59.000Z').getTime());

    const session = createSession();
    const result = await scheduleFastingMilestones(session);

    // 16h plan >= 12h, so 12h milestone is included. After the goal we add a
    // bounded set of hourly overtime reminders (+1h … +12h past the goal).
    expect(result.length).toBe(5 + 12);
    expect(result.map((r) => r.milestone)).toEqual([
      'Fast Started',
      'Halfway',
      '12 Hours Reached',
      '90%',
      'Goal Reached',
      'Overtime +1h',
      'Overtime +2h',
      'Overtime +3h',
      'Overtime +4h',
      'Overtime +5h',
      'Overtime +6h',
      'Overtime +7h',
      'Overtime +8h',
      'Overtime +9h',
      'Overtime +10h',
      'Overtime +11h',
      'Overtime +12h',
    ]);
  });

  it('skips milestones whose trigger time has already passed', async () => {
    // Set "now" to 9 hours into the fast (past start and halfway)
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-01T15:00:00.000Z').getTime());

    const session = createSession();
    const result = await scheduleFastingMilestones(session);

    // Fast Started (6:00), Halfway (14:00) are past. 12h (18:00), 90% (20:24),
    // Goal Reached (22:00) and all 12 future overtime marks (23:00 … 10:00) remain.
    expect(result.map((r) => r.milestone)).toEqual([
      '12 Hours Reached',
      '90%',
      'Goal Reached',
      'Overtime +1h',
      'Overtime +2h',
      'Overtime +3h',
      'Overtime +4h',
      'Overtime +5h',
      'Overtime +6h',
      'Overtime +7h',
      'Overtime +8h',
      'Overtime +9h',
      'Overtime +10h',
      'Overtime +11h',
      'Overtime +12h',
    ]);
  });

  it('skips 12h milestone for plans shorter than 12 hours', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-01T05:59:59.000Z').getTime());

    // 10-hour plan
    const session = createSession({
      endTime: '2024-06-01T16:00:00.000Z', // 10 hours
    });
    const result = await scheduleFastingMilestones(session);

    const milestoneNames = result.map((r) => r.milestone);
    expect(milestoneNames).not.toContain('12 Hours Reached');
  });

  it('includes 12h milestone for plans exactly 12 hours', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-01T05:59:59.000Z').getTime());

    // 12-hour plan
    const session = createSession({
      endTime: '2024-06-01T18:00:00.000Z', // 12 hours
    });
    const result = await scheduleFastingMilestones(session);

    const milestoneNames = result.map((r) => r.milestone);
    expect(milestoneNames).toContain('12 Hours Reached');
  });

  it('persists notification IDs to AsyncStorage keyed by sessionId', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-01T05:59:59.000Z').getTime());

    const session = createSession();
    const result = await scheduleFastingMilestones(session);

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SCHEDULED_NOTIFICATIONS);
    expect(raw).not.toBeNull();

    const map = JSON.parse(raw!);
    expect(map['session-001']).toBeDefined();
    expect(map['session-001'].length).toBe(result.length);
  });

  it('uses Expo Notifications API to schedule each notification', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-01T05:59:59.000Z').getTime());

    const session = createSession();
    await scheduleFastingMilestones(session);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
    expect(calls.length).toBe(5 + 12);

    // Verify the 12h milestone content
    const twelvehCall = calls[2];
    expect(twelvehCall[0].content.title).toBe('12 Hours Reached');
    expect(twelvehCall[0].content.body).toBe(
      "You've reached 12 hours of fasting. Body responses vary from person to person.",
    );
  });

  it('returns empty array when all milestones are in the past', async () => {
    // Set now past the goal AND the full overtime window (goal 22:00 + 12h = 10:00 next day)
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-02T11:00:00.000Z').getTime());

    const session = createSession();
    const result = await scheduleFastingMilestones(session);

    expect(result).toEqual([]);
  });
});

describe('cancelSessionNotifications', () => {
  it('cancels all scheduled notifications for a session', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-01T05:59:59.000Z').getTime());

    const session = createSession();
    await scheduleFastingMilestones(session);

    await cancelSessionNotifications('session-001');

    // Verify cancel was called for each notification (5 base + 12 overtime marks)
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(5 + 12);
  });

  it('removes session entry from the stored map', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-01T05:59:59.000Z').getTime());

    const session = createSession();
    await scheduleFastingMilestones(session);

    await cancelSessionNotifications('session-001');

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SCHEDULED_NOTIFICATIONS);
    const map = JSON.parse(raw!);
    expect(map['session-001']).toBeUndefined();
  });

  it('handles non-existent session gracefully', async () => {
    await expect(cancelSessionNotifications('non-existent')).resolves.not.toThrow();
  });
});

describe('rescheduleSessionNotifications', () => {
  it('cancels existing and schedules new notifications', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-01T05:59:59.000Z').getTime());

    const session = createSession();
    await scheduleFastingMilestones(session);

    // Clear mock call counts
    (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockClear();
    (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();

    // Reschedule with updated endTime
    const updatedSession = createSession({ endTime: '2024-06-02T00:00:00.000Z' }); // 18h
    const result = await rescheduleSessionNotifications(updatedSession);

    // Should have cancelled old ones
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalled();
    // Should have scheduled new ones
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('scheduleWaterReminders', () => {
  it('schedules water reminders at configured intervals', async () => {
    // Set now to 8AM on June 1
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-01T08:00:00.000Z').getTime());
    // Mock Date constructor for the scheduling logic
    const originalDate = global.Date;
    const mockNow = new Date('2024-06-01T08:00:00.000Z');
    jest.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
      if (args.length === 0) return mockNow;
      // @ts-ignore
      return new originalDate(...args);
    });

    await scheduleWaterReminders({
      intervalMinutes: 120,
      startHour: 8,
      endHour: 22,
    });

    // Should have scheduled notifications
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it('cancels existing water reminders before scheduling new ones', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-01T08:00:00.000Z').getTime());

    // Pre-populate some water reminder IDs
    const map = { '__water_reminders__': ['old-1', 'old-2'] };
    await AsyncStorage.setItem(STORAGE_KEYS.SCHEDULED_NOTIFICATIONS, JSON.stringify(map));

    const originalDate = global.Date;
    const mockNow = new Date('2024-06-01T08:00:00.000Z');
    jest.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
      if (args.length === 0) return mockNow;
      // @ts-ignore
      return new originalDate(...args);
    });

    await scheduleWaterReminders({
      intervalMinutes: 120,
      startHour: 8,
      endHour: 22,
    });

    // Old reminders should have been cancelled
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-1');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-2');

    jest.restoreAllMocks();
  });
});

describe('scheduleWeighInReminder', () => {
  it('schedules a weigh-in reminder at the configured time', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-01T06:00:00.000Z').getTime());

    const originalDate = global.Date;
    const mockNow = new Date('2024-06-01T06:00:00.000Z');
    jest.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
      if (args.length === 0) return mockNow;
      // @ts-ignore
      return new originalDate(...args);
    });

    await scheduleWeighInReminder('08:00');

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0];
    expect(call[0].content.title).toBe('Weigh-In Reminder');

    jest.restoreAllMocks();
  });

  it('cancels existing weigh-in reminders before scheduling', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-01T06:00:00.000Z').getTime());

    const map = { '__weighin_reminder__': ['old-weighin-1'] };
    await AsyncStorage.setItem(STORAGE_KEYS.SCHEDULED_NOTIFICATIONS, JSON.stringify(map));

    const originalDate = global.Date;
    const mockNow = new Date('2024-06-01T06:00:00.000Z');
    jest.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
      if (args.length === 0) return mockNow;
      // @ts-ignore
      return new originalDate(...args);
    });

    await scheduleWeighInReminder('08:00');

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-weighin-1');

    jest.restoreAllMocks();
  });
});

describe('cancelRemindersByType', () => {
  it('cancels water reminders', async () => {
    const map = { '__water_reminders__': ['w1', 'w2', 'w3'] };
    await AsyncStorage.setItem(STORAGE_KEYS.SCHEDULED_NOTIFICATIONS, JSON.stringify(map));

    await cancelRemindersByType('WATER_REMINDERS');

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(3);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('w1');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('w2');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('w3');

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SCHEDULED_NOTIFICATIONS);
    const updatedMap = JSON.parse(raw!);
    expect(updatedMap['__water_reminders__']).toBeUndefined();
  });

  it('cancels weigh-in reminders', async () => {
    const map = { '__weighin_reminder__': ['wi1'] };
    await AsyncStorage.setItem(STORAGE_KEYS.SCHEDULED_NOTIFICATIONS, JSON.stringify(map));

    await cancelRemindersByType('WEIGH_IN_REMINDER');

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('wi1');
  });

  it('cancels all fasting milestone notifications', async () => {
    const map = {
      'session-1': ['m1', 'm2'],
      'session-2': ['m3'],
      '__water_reminders__': ['w1'],
    };
    await AsyncStorage.setItem(STORAGE_KEYS.SCHEDULED_NOTIFICATIONS, JSON.stringify(map));

    await cancelRemindersByType('FASTING_MILESTONES');

    // Should cancel session notifications but not water reminders
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('m1');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('m2');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('m3');
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('w1');

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SCHEDULED_NOTIFICATIONS);
    const updatedMap = JSON.parse(raw!);
    expect(updatedMap['session-1']).toBeUndefined();
    expect(updatedMap['session-2']).toBeUndefined();
    expect(updatedMap['__water_reminders__']).toEqual(['w1']);
  });
});

describe('requestPermissions', () => {
  it('returns ALREADY_GRANTED when permissions are already granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });

    const result = await requestPermissions();
    expect(result).toBe('ALREADY_GRANTED');
  });

  it('returns GRANTED when user grants permission', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });

    const result = await requestPermissions();
    expect(result).toBe('GRANTED');
  });

  it('returns DENIED when user denies permission', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });

    const result = await requestPermissions();
    expect(result).toBe('DENIED');
  });
});

describe('revalidateOnLaunch', () => {
  it('reschedules notifications for an active session', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-01T10:00:00.000Z').getTime());

    const session = createSession();

    // Pre-populate some old notification IDs
    const map = { 'session-001': ['old-1', 'old-2'] };
    await AsyncStorage.setItem(STORAGE_KEYS.SCHEDULED_NOTIFICATIONS, JSON.stringify(map));

    await revalidateOnLaunch(session);

    // Should have cancelled old notifications
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-1');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-2');

    // Should have scheduled new ones (only future milestones)
    // At 10:00, start (6:00) and halfway (14:00 is future), 12h (18:00), 90% (20:24), completed (22:00)
    // Wait — halfway is at 14:00 which is in the future relative to 10:00
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('does nothing for non-ACTIVE sessions', async () => {
    const session = createSession({ status: 'COMPLETED' });

    await revalidateOnLaunch(session);

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('ensures the goal-reached notification is always scheduled for active sessions', async () => {
    // Set now to 90% through the fast (past 90% milestone but before the goal)
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-01T21:00:00.000Z').getTime());

    const session = createSession();
    await revalidateOnLaunch(session);

    // The goal-reached notification (at 22:00) should still be scheduled
    const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
    const goalCall = calls.find(
      (call: any[]) => call[0].content.title === 'Goal Reached!',
    );
    expect(goalCall).toBeDefined();
  });

  it('avoids duplicate notifications by cancelling before rescheduling', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-06-01T10:00:00.000Z').getTime());

    const session = createSession();

    // Schedule once
    await scheduleFastingMilestones(session);
    const firstCallCount = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.length;

    // Clear mocks
    (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();
    (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockClear();

    // Revalidate — should cancel then reschedule
    await revalidateOnLaunch(session);

    // Cancel should have been called for the previously scheduled notifications
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalled();
    // New notifications should be scheduled
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });
});
