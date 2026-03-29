import type { GrowthProgress } from '@/lib/types';

export const NAVY_REWARD_THEME = {
  name: '네이비',
  min: 0,
  color: 'text-white',
  bg: 'bg-[#14295F]',
  border: 'border-[#223B7A]',
  gradient: 'from-[#14295F] via-[#1B326D] to-[#233E86]',
} as const;

export const STUDY_BOX_REWARD_CURVE: Record<number, readonly [number, number]> = {
  1: [10, 20],
  2: [15, 25],
  3: [20, 30],
  4: [25, 35],
  5: [30, 40],
  6: [35, 45],
  7: [40, 50],
  8: [45, 55],
};

const FORTUNE_MESSAGES = [
  '오늘은 차분하게 시작해도 끝이 강해지는 날이에요.',
  '작은 몰입 하나가 오늘 공부 흐름을 예쁘게 열어 줄 거예요.',
  '꾸준함이 잘 붙는 날이라, 첫 한 시간을 잡으면 끝까지 이어질 수 있어요.',
  '오늘의 집중은 천천히 올라오지만 한 번 붙으면 오래 갑니다.',
  '지금 만든 리듬이 오늘 전체 공부의 분위기를 결정해 줄 거예요.',
  '생각보다 더 잘 풀리는 날이에요. 첫 문제만 가볍게 열어 보세요.',
  '오늘은 기록보다 감각이 좋아지는 날이라, 시작만 하면 금방 안정돼요.',
  '한 번의 깊은 몰입이 오늘 전체 만족감을 크게 끌어올려 줄 거예요.',
];

export type StudyBoxReward = {
  milestone: number;
  minReward: number;
  maxReward: number;
  awardedPoints: number;
  multiplier: number;
};

export function getSkillRewardMultiplier(stats?: GrowthProgress['stats']) {
  if (!stats) return 1;
  const safeValues = [stats.focus, stats.consistency, stats.achievement, stats.resilience].map((value) =>
    Math.max(0, Math.min(100, Number(value || 0)))
  );
  const average = safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length;
  return 1 + Math.min(0.2, average / 100 * 0.2);
}

export function getClaimedStudyBoxes(dayStatus?: Record<string, any>): number[] {
  const raw = dayStatus?.claimedStudyBoxes;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 8)
    .sort((a, b) => a - b);
}

export function getAvailableStudyBoxMilestones(totalMinutes: number, claimedStudyBoxes?: number[]) {
  const crossedMilestones = Math.max(0, Math.min(8, Math.floor(Math.max(0, totalMinutes) / 60)));
  const claimed = new Set((claimedStudyBoxes || []).filter((value) => value >= 1 && value <= 8));
  return Array.from({ length: crossedMilestones }, (_, index) => index + 1).filter((milestone) => !claimed.has(milestone));
}

export function rollStudyBoxReward(milestone: number, stats?: GrowthProgress['stats']): StudyBoxReward {
  const [baseMin, baseMax] = STUDY_BOX_REWARD_CURVE[milestone] || STUDY_BOX_REWARD_CURVE[1];
  const multiplier = getSkillRewardMultiplier(stats);
  const minReward = Math.max(1, Math.round(baseMin * multiplier));
  const maxReward = Math.max(minReward, Math.round(baseMax * multiplier));
  const awardedPoints = Math.floor(Math.random() * (maxReward - minReward + 1)) + minReward;
  return {
    milestone,
    minReward,
    maxReward,
    awardedPoints,
    multiplier,
  };
}

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getDailyFortuneMessage(uid: string, dateKey: string) {
  const safeKey = `${uid || 'student'}:${dateKey || 'today'}`;
  return FORTUNE_MESSAGES[hashString(safeKey) % FORTUNE_MESSAGES.length];
}

export function formatStudyMinutes(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const remain = safe % 60;
  if (hours <= 0) return `${remain}분`;
  if (remain === 0) return `${hours}시간`;
  return `${hours}시간 ${remain}분`;
}

export function formatStudyMinutesShort(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const remain = safe % 60;
  if (hours <= 0) return `${remain}m`;
  if (remain === 0) return `${hours}h`;
  return `${hours}.${Math.round((remain / 60) * 10)}h`;
}
