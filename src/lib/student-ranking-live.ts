import type { StudentRankEntry } from '@/lib/student-ranking-client';
import {
  getDailyRankWindowOverlapMinutes,
  getDailyRankWindowState,
  type DailyRankWindowState,
  type StudentRankingRange,
} from '@/lib/student-ranking-policy';

type LiveAdjustableRankEntry = Pick<
  StudentRankEntry,
  'studentId' | 'value' | 'liveStatus' | 'liveStartedAtMs'
>;

type RankSortableEntry = {
  value: number;
  displayNameSnapshot: string;
  rank?: number;
};

function getSafeRankValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function getLiveAdjustedStudentRankValue({
  entry,
  range,
  nowMs,
  viewerId,
  selfLiveStartedAtMs,
  dailyRankWindow,
}: {
  entry: LiveAdjustableRankEntry;
  range: StudentRankingRange;
  nowMs: number;
  viewerId: string;
  selfLiveStartedAtMs: number;
  dailyRankWindow?: Pick<DailyRankWindowState, 'startsAt' | 'endsAt'>;
}) {
  const baseValue = getSafeRankValue(entry.value);
  const serverLiveStartedAtMs = Number(entry.liveStartedAtMs || 0);
  const hasServerLive = Boolean(entry.liveStatus === 'studying' && serverLiveStartedAtMs > 0);
  const hasSelfLive = entry.studentId === viewerId && selfLiveStartedAtMs > 0;

  if (!hasServerLive && !hasSelfLive) {
    return baseValue;
  }

  const effectiveStartedAtMs =
    serverLiveStartedAtMs > 0 && selfLiveStartedAtMs > 0 && entry.studentId === viewerId
      ? Math.min(serverLiveStartedAtMs, selfLiveStartedAtMs)
      : Math.max(serverLiveStartedAtMs, hasSelfLive ? selfLiveStartedAtMs : 0);

  if (effectiveStartedAtMs <= 0 || effectiveStartedAtMs >= nowMs) {
    return baseValue;
  }

  const liveMinutes =
    range === 'daily'
      ? getDailyRankWindowOverlapMinutes(
          effectiveStartedAtMs,
          nowMs,
          dailyRankWindow ?? getDailyRankWindowState(new Date(nowMs))
        )
      : Math.max(1, Math.ceil((nowMs - effectiveStartedAtMs) / 60000));

  return baseValue + liveMinutes;
}

export function assignStudentRankingTrackRanks<T extends RankSortableEntry>(entries: T[]): Array<T & { rank: number }> {
  return [...entries]
    .sort((left, right) => {
      const valueDiff = getSafeRankValue(right.value) - getSafeRankValue(left.value);
      if (valueDiff !== 0) return valueDiff;
      return (left.displayNameSnapshot || '').localeCompare(right.displayNameSnapshot || '', 'ko');
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}
