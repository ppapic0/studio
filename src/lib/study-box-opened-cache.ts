import { normalizeStudyBoxHourValues } from '@/lib/student-rewards';

function getStudyBoxOpenedCacheKey(userId: string, dateKey: string) {
  return `student-dashboard:opened-boxes:${userId}:${dateKey}`;
}

function getLegacyCarryoverOpenedCacheKey(userId: string, dateKey: string) {
  return `student-dashboard:carryover-opened:${userId}:${dateKey}`;
}

export function readStudyBoxOpenedCache(userId?: string | null, dateKey?: string | null): number[] {
  if (!userId || !dateKey || typeof window === 'undefined') return [];

  try {
    const values = [
      window.localStorage.getItem(getStudyBoxOpenedCacheKey(userId, dateKey)),
      window.localStorage.getItem(getLegacyCarryoverOpenedCacheKey(userId, dateKey)),
    ]
      .filter((value): value is string => Boolean(value))
      .flatMap((value) => {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      });

    return normalizeStudyBoxHourValues(values);
  } catch {
    return [];
  }
}

export function writeStudyBoxOpenedCache(userId?: string | null, dateKey?: string | null, values: number[] = []) {
  if (!userId || !dateKey || typeof window === 'undefined') return;

  const normalized = normalizeStudyBoxHourValues(values);

  try {
    const nextValue = normalized.length > 0 ? JSON.stringify(normalized) : null;
    const primaryKey = getStudyBoxOpenedCacheKey(userId, dateKey);
    const legacyKey = getLegacyCarryoverOpenedCacheKey(userId, dateKey);

    if (nextValue) {
      window.localStorage.setItem(primaryKey, nextValue);
      window.localStorage.setItem(legacyKey, nextValue);
      return;
    }

    window.localStorage.removeItem(primaryKey);
    window.localStorage.removeItem(legacyKey);
  } catch {
    // Ignore storage failures and fall back to Firestore state.
  }
}
