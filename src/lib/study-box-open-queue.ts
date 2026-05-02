import { normalizeStudyBoxHourValues } from '@/lib/student-rewards';

type PendingStudyBoxOpenQueue = Record<string, number[]>;

function getStudyBoxOpenQueueKey(userId: string) {
  return `student-dashboard:pending-box-opens:${userId}`;
}

function readQueueMap(userId?: string | null): PendingStudyBoxOpenQueue {
  if (!userId || typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(getStudyBoxOpenQueueKey(userId));
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.entries(parsed).reduce<PendingStudyBoxOpenQueue>((queue, [dateKey, values]) => {
      const hours = normalizeStudyBoxHourValues(Array.isArray(values) ? values : []);
      if (hours.length > 0) {
        queue[dateKey] = hours;
      }
      return queue;
    }, {});
  } catch {
    return {};
  }
}

function writeQueueMap(userId: string | null | undefined, queue: PendingStudyBoxOpenQueue) {
  if (!userId || typeof window === 'undefined') return;

  try {
    const normalizedEntries = Object.entries(queue)
      .map(([dateKey, values]) => [dateKey, normalizeStudyBoxHourValues(values)] as const)
      .filter(([, values]) => values.length > 0);
    const key = getStudyBoxOpenQueueKey(userId);

    if (normalizedEntries.length === 0) {
      window.localStorage.removeItem(key);
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(Object.fromEntries(normalizedEntries)));
  } catch {
    // Ignore storage failures; the in-memory queue still covers the current session.
  }
}

export function readStudyBoxPendingOpenQueue(userId?: string | null) {
  return Object.entries(readQueueMap(userId))
    .map(([dateKey, hours]) => ({ dateKey, hours }))
    .filter((entry) => entry.dateKey && entry.hours.length > 0);
}

export function mergeStudyBoxPendingOpenQueue(
  userId: string | null | undefined,
  dateKey: string,
  hours: number[]
) {
  if (!userId || !dateKey) return;

  const queue = readQueueMap(userId);
  queue[dateKey] = normalizeStudyBoxHourValues([...(queue[dateKey] || []), ...hours]);
  writeQueueMap(userId, queue);
}

export function removeStudyBoxPendingOpenQueue(
  userId: string | null | undefined,
  dateKey: string,
  hours: number[]
) {
  if (!userId || !dateKey) return;

  const queue = readQueueMap(userId);
  const removeHourSet = new Set(normalizeStudyBoxHourValues(hours));
  queue[dateKey] = normalizeStudyBoxHourValues(queue[dateKey] || []).filter((hour) => !removeHourSet.has(hour));
  writeQueueMap(userId, queue);
}
