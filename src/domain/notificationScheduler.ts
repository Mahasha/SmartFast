/**
 * NotificationScheduler — Manages local notifications for fasting milestones and reminders.
 *
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 15.1, 15.2, 15.3, 15.4
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FastingSession, NotificationPreference } from '../models/index';
import { STORAGE_KEYS } from '../utils/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ReminderType = 'FASTING_MILESTONES' | 'WATER_REMINDERS' | 'WEIGH_IN_REMINDER';
export type PermissionResult = 'GRANTED' | 'DENIED' | 'ALREADY_GRANTED';

export interface ScheduledNotification {
  id: string;
  milestone: string;
  triggerTime: string; // UTC ISO 8601
}

export interface WaterReminderConfig {
  intervalMinutes: number;
  startHour: number; // 0-23, default 8
  endHour: number;   // 0-23, default 22
}

// ─── Storage Helpers ─────────────────────────────────────────────────────────

type ScheduledNotificationsMap = Record<string, string[]>;

async function getScheduledNotificationsMap(): Promise<ScheduledNotificationsMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SCHEDULED_NOTIFICATIONS);
    if (raw === null) return {};
    return JSON.parse(raw) as ScheduledNotificationsMap;
  } catch {
    return {};
  }
}

async function saveScheduledNotificationsMap(map: ScheduledNotificationsMap): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.SCHEDULED_NOTIFICATIONS, JSON.stringify(map));
}

// ─── Milestone Definitions ───────────────────────────────────────────────────

interface MilestoneDefinition {
  name: string;
  title: string;
  body: string;
  getTime: (startMs: number, endMs: number, durationMs: number) => number;
  condition?: (durationMs: number) => boolean;
}

const MILESTONES: MilestoneDefinition[] = [
  {
    name: 'Fast Started',
    title: 'Fast Started',
    body: 'Your fasting session has begun. Stay strong!',
    getTime: (startMs) => startMs,
  },
  {
    name: 'Halfway',
    title: 'Halfway Reached',
    body: "You're halfway through your fast. Keep going!",
    getTime: (startMs, _endMs, durationMs) => startMs + durationMs / 2,
  },
  {
    name: '12 Hours Reached',
    title: '12 Hours Reached',
    body: "You've reached 12 hours of fasting. Body responses vary from person to person.",
    getTime: (startMs) => startMs + 12 * 60 * 60 * 1000,
    condition: (durationMs) => durationMs >= 12 * 60 * 60 * 1000,
  },
  {
    name: '90%',
    title: 'Almost Complete',
    body: "You're 90% through your fast. The finish line is near!",
    getTime: (startMs, _endMs, durationMs) => startMs + durationMs * 0.9,
  },
  {
    name: 'Completed',
    title: 'Fast Completed',
    body: 'Congratulations! You have completed your fast.',
    getTime: (_startMs, endMs) => endMs,
  },
];

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Schedules fasting milestone notifications for a session.
 * Skips milestones whose trigger time has already passed.
 */
export async function scheduleFastingMilestones(
  session: FastingSession,
): Promise<ScheduledNotification[]> {
  const now = Date.now();
  const startMs = new Date(session.startTime).getTime();
  const endMs = new Date(session.endTime).getTime();
  const durationMs = endMs - startMs;

  const scheduled: ScheduledNotification[] = [];

  for (const milestone of MILESTONES) {
    // Check condition (e.g., 12h milestone only for plans >= 12h)
    if (milestone.condition && !milestone.condition(durationMs)) {
      continue;
    }

    const triggerTime = milestone.getTime(startMs, endMs, durationMs);

    // Skip milestones whose time has already passed
    if (triggerTime <= now) {
      continue;
    }

    const triggerDate = new Date(triggerTime);

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: milestone.title,
        body: milestone.body,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    scheduled.push({
      id: notificationId,
      milestone: milestone.name,
      triggerTime: triggerDate.toISOString(),
    });
  }

  // Persist notification IDs keyed by sessionId
  const map = await getScheduledNotificationsMap();
  map[session.sessionId] = scheduled.map((s) => s.id);
  await saveScheduledNotificationsMap(map);

  return scheduled;
}

/**
 * Cancels all pending notifications for a given session.
 */
export async function cancelSessionNotifications(sessionId: string): Promise<void> {
  const map = await getScheduledNotificationsMap();
  const ids = map[sessionId];

  if (ids && ids.length > 0) {
    for (const id of ids) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
  }

  delete map[sessionId];
  await saveScheduledNotificationsMap(map);
}

/**
 * Reschedules notifications for a session (e.g., after plan change).
 * Cancels existing notifications and schedules new ones.
 */
export async function rescheduleSessionNotifications(
  session: FastingSession,
): Promise<ScheduledNotification[]> {
  await cancelSessionNotifications(session.sessionId);
  return scheduleFastingMilestones(session);
}

/**
 * Schedules recurring water reminder notifications during waking hours.
 */
export async function scheduleWaterReminders(config: WaterReminderConfig): Promise<void> {
  // Cancel existing water reminders first
  await cancelRemindersByType('WATER_REMINDERS');

  const { intervalMinutes, startHour, endHour } = config;
  const ids: string[] = [];

  // Schedule notifications for today and tomorrow at each interval slot
  const now = new Date();

  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    const baseDate = new Date(now);
    baseDate.setDate(baseDate.getDate() + dayOffset);
    baseDate.setHours(startHour, 0, 0, 0);

    const endDate = new Date(baseDate);
    endDate.setHours(endHour, 0, 0, 0);

    let currentTime = baseDate.getTime();
    const endTime = endDate.getTime();

    while (currentTime <= endTime) {
      if (currentTime > now.getTime()) {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Water Reminder',
            body: "Time to drink some water! Stay hydrated.",
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(currentTime),
          },
        });
        ids.push(notificationId);
      }
      currentTime += intervalMinutes * 60 * 1000;
    }
  }

  // Persist water reminder IDs
  const map = await getScheduledNotificationsMap();
  map['__water_reminders__'] = ids;
  await saveScheduledNotificationsMap(map);
}

/**
 * Schedules a daily weigh-in reminder at the configured time.
 */
export async function scheduleWeighInReminder(time: string): Promise<void> {
  // Cancel existing weigh-in reminders first
  await cancelRemindersByType('WEIGH_IN_REMINDER');

  const parts = time.split(':').map(Number);
  const hours = parts[0] ?? 8;
  const minutes = parts[1] ?? 0;
  const now = new Date();

  // Schedule for today (if not passed) and tomorrow
  const ids: string[] = [];

  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    const triggerDate = new Date(now);
    triggerDate.setDate(triggerDate.getDate() + dayOffset);
    triggerDate.setHours(hours, minutes, 0, 0);

    if (triggerDate.getTime() > now.getTime()) {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Weigh-In Reminder',
          body: "Time for your daily weigh-in. Track your progress!",
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });
      ids.push(notificationId);
    }
  }

  // Persist weigh-in reminder IDs
  const map = await getScheduledNotificationsMap();
  map['__weighin_reminder__'] = ids;
  await saveScheduledNotificationsMap(map);
}

/**
 * Cancels all pending notifications of a given reminder type.
 */
export async function cancelRemindersByType(type: ReminderType): Promise<void> {
  const map = await getScheduledNotificationsMap();

  let key: string;
  switch (type) {
    case 'WATER_REMINDERS':
      key = '__water_reminders__';
      break;
    case 'WEIGH_IN_REMINDER':
      key = '__weighin_reminder__';
      break;
    case 'FASTING_MILESTONES':
      // Cancel all session-based notifications
      for (const [sessionKey, ids] of Object.entries(map)) {
        if (!sessionKey.startsWith('__')) {
          for (const id of ids) {
            await Notifications.cancelScheduledNotificationAsync(id);
          }
          delete map[sessionKey];
        }
      }
      await saveScheduledNotificationsMap(map);
      return;
  }

  const ids = map[key];
  if (ids && ids.length > 0) {
    for (const id of ids) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
  }

  delete map[key];
  await saveScheduledNotificationsMap(map);
}

/**
 * Requests notification permissions from the user.
 */
export async function requestPermissions(): Promise<PermissionResult> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return 'ALREADY_GRANTED';
  }

  const { status } = await Notifications.requestPermissionsAsync();

  if (status === 'granted') {
    return 'GRANTED';
  }

  return 'DENIED';
}

/**
 * Revalidates notifications on app launch for an active session.
 * Skips past milestones, ensures completion notification is scheduled, avoids duplicates.
 */
export async function revalidateOnLaunch(session: FastingSession): Promise<void> {
  if (session.status !== 'ACTIVE') {
    return;
  }

  // Cancel existing notifications for this session to avoid duplicates
  await cancelSessionNotifications(session.sessionId);

  // Reschedule — scheduleFastingMilestones already skips past milestones
  await scheduleFastingMilestones(session);
}
