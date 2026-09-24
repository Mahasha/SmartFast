import { v4 as uuidv4 } from 'uuid';
import { SyncableRecord, SyncQueueEntry } from '../models/index';
import { getItem, setItem } from './localStorage';
import { STORAGE_KEYS } from '../utils/constants';

let queueTail: Promise<void> = Promise.resolve();

export async function getQueue(): Promise<SyncQueueEntry[]> {
  return (await getItem<SyncQueueEntry[]>(STORAGE_KEYS.SYNC_QUEUE)) ?? [];
}

/** Serialize read-modify-write operations on the AsyncStorage queue. */
export async function mutateQueue<T>(change: (queue: SyncQueueEntry[]) => { queue: SyncQueueEntry[]; result: T }): Promise<T> {
  const previous = queueTail;
  let release!: () => void;
  queueTail = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    const changed = change(await getQueue());
    await setItem(STORAGE_KEYS.SYNC_QUEUE, changed.queue);
    return changed.result;
  } finally {
    release();
  }
}

function recordType(record: SyncableRecord): SyncQueueEntry['recordType'] {
  if ('sessionId' in record) return 'fasting_session';
  if ('statsId' in record) return 'daily_stats';
  if ('streakId' in record) return 'streak';
  if ('prefId' in record) return 'notification_preference';
  return 'profile';
}

function recordId(record: SyncableRecord): string {
  if ('sessionId' in record) return record.sessionId;
  if ('statsId' in record) return record.statsId;
  if ('streakId' in record) return record.streakId;
  if ('prefId' in record) return record.prefId;
  return 'userId' in record ? record.userId : '';
}

export async function enqueue(record: SyncableRecord): Promise<void> {
  const entry: SyncQueueEntry = {
    id: uuidv4(),
    recordType: recordType(record),
    recordId: recordId(record),
    operation: 'CREATE',
    payload: record,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  await mutateQueue((queue) => {
    const index = queue.findIndex((item) => item.recordType === entry.recordType && item.recordId === entry.recordId);
    if (index >= 0) {
      entry.operation = 'UPDATE';
      entry.retryCount = queue[index]!.retryCount;
      queue[index] = entry;
    } else {
      queue.push(entry);
    }
    return { queue, result: undefined };
  });
}


type QueueLedger = Record<string, SyncQueueEntry[]>;

/** Keep an account's unsynced writes when its active local cache is cleared. */
export async function stashQueueForUser(userId: string): Promise<void> {
  if (!userId) return;
  const pending = await getQueue();
  if (pending.length === 0) return;
  const ledger = (await getItem<QueueLedger>(STORAGE_KEYS.SYNC_QUEUE_LEDGER)) ?? {};
  const byRecord = new Map<string, SyncQueueEntry>();
  for (const entry of [...(ledger[userId] ?? []), ...pending]) {
    byRecord.set(`${entry.recordType}:${entry.recordId}`, entry);
  }
  ledger[userId] = [...byRecord.values()];
  await setItem(STORAGE_KEYS.SYNC_QUEUE_LEDGER, ledger);
}

/** Restore only this account's queue; other accounts' writes stay isolated. */
export async function restoreQueueForUser(userId: string): Promise<void> {
  const ledger = (await getItem<QueueLedger>(STORAGE_KEYS.SYNC_QUEUE_LEDGER)) ?? {};
  const saved = ledger[userId];
  if (!saved?.length) return;
  await mutateQueue((current) => {
    const byRecord = new Map<string, SyncQueueEntry>();
    for (const entry of [...saved, ...current]) {
      byRecord.set(`${entry.recordType}:${entry.recordId}`, entry);
    }
    return { queue: [...byRecord.values()], result: undefined };
  });
  delete ledger[userId];
  await setItem(STORAGE_KEYS.SYNC_QUEUE_LEDGER, ledger);
}
