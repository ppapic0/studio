import { StudentNotification } from '@/lib/types';

const RANGE_LABEL: Record<'daily' | 'weekly' | 'monthly', string> = {
  daily: '일간',
  weekly: '주간',
  monthly: '월간',
};

function parseDateKey(value?: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day };
}

function parseMonthKey(value?: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  return { year, month };
}

function formatDateKeyLabel(value?: string | null) {
  const parsed = parseDateKey(value);
  if (!parsed) return null;
  return `${parsed.month}월 ${parsed.day}일`;
}

function formatMonthKeyLabel(value?: string | null) {
  const parsed = parseMonthKey(value);
  if (!parsed) return null;
  return `${parsed.year}년 ${parsed.month}월`;
}

export function getRankingRangeLabel(range?: StudentNotification['rankingRange']) {
  if (range === 'daily' || range === 'weekly' || range === 'monthly') {
    return RANGE_LABEL[range];
  }
  return '랭킹';
}

export function getRankingRewardPeriodLabel(
  reward?: Pick<StudentNotification, 'rankingRange' | 'rankingPeriodKey' | 'awardDateKey'> | null
) {
  if (!reward) return null;

  if (reward.rankingRange === 'daily') {
    return formatDateKeyLabel(reward.rankingPeriodKey || reward.awardDateKey);
  }

  if (reward.rankingRange === 'weekly') {
    const [startKey, endKey] = (reward.rankingPeriodKey || '').split('_');
    const startLabel = formatDateKeyLabel(startKey);
    const endLabel = formatDateKeyLabel(endKey);
    if (startLabel && endLabel) return `${startLabel}~${endLabel}`;
    return startLabel || endLabel || null;
  }

  if (reward.rankingRange === 'monthly') {
    return formatMonthKeyLabel(reward.rankingPeriodKey);
  }

  return null;
}

export function getRankingRewardHeadline(reward?: StudentNotification | null) {
  const rangeLabel = getRankingRangeLabel(reward?.rankingRange);
  const rank = Math.max(0, Number(reward?.rankingRank || 0));
  const periodLabel = getRankingRewardPeriodLabel(reward);
  const rankLabel = rank > 0 ? `${rangeLabel} 랭킹 ${rank}위` : `${rangeLabel} 랭킹`;
  return periodLabel ? `${periodLabel} ${rankLabel}` : rankLabel;
}

export function getRankingRewardContextCopy(reward?: StudentNotification | null) {
  const rangeLabel = getRankingRangeLabel(reward?.rankingRange);
  const periodLabel = getRankingRewardPeriodLabel(reward);
  return periodLabel
    ? `${periodLabel} 기준 ${rangeLabel} 랭킹에서 얻은 포인트 보상입니다.`
    : `${rangeLabel} 랭킹에서 얻은 포인트 보상입니다.`;
}
