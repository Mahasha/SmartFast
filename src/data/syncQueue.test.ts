import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueue, getQueue, restoreQueueForUser, stashQueueForUser } from './syncQueue';
import { STORAGE_KEYS } from '../utils/constants';
import { FastingSession } from '../models/index';

beforeEach(async () => { await AsyncStorage.clear(); });

it('restores only the signed-in account pending writes after logout', async () => {
  const session = {
    sessionId: 'session-1', userId: 'user-a', planId: 'plan-16-8',
    startTime: '2024-01-01T00:00:00Z', endTime: '2024-01-01T16:00:00Z',
    actualEndTime: null, status: 'ACTIVE', durationFasted: null,
    timezoneOffsetMinutes: 0, createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  } as FastingSession;
  await enqueue(session);
  await stashQueueForUser('user-a');
  await AsyncStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE);
  await restoreQueueForUser('user-b');
  expect(await getQueue()).toHaveLength(0);
  await restoreQueueForUser('user-a');
  expect((await getQueue())[0]?.recordId).toBe('session-1');
});
