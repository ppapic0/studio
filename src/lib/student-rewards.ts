export const NAVY_REWARD_THEME = {
  name: '네이비',
  min: 0,
  color: 'text-white',
  bg: 'bg-[#14295F]',
  border: 'border-[#223B7A]',
  gradient: 'from-[#14295F] via-[#1B326D] to-[#233E86]',
} as const;

export type StudyBoxRarity = "common" | "rare" | "epic";
const STUDY_BOX_REWARD_RANGE_BY_RARITY: Record<StudyBoxRarity, readonly [number, number]> = {
  common: [1, 10],
  rare: [10, 20],
  epic: [20, 30],
};

const EARLY_STUDY_BOX_RARITY_WEIGHTS: Array<{ rarity: StudyBoxRarity; weight: number }> = [
  { rarity: "common", weight: 80 },
  { rarity: "rare", weight: 17 },
  { rarity: "epic", weight: 3 },
];

const LATE_STUDY_BOX_RARITY_WEIGHTS: Array<{ rarity: StudyBoxRarity; weight: number }> = [
  { rarity: "common", weight: 60 },
  { rarity: "rare", weight: 30 },
  { rarity: "epic", weight: 10 },
];

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
  rarity: StudyBoxRarity;
  minReward: number;
  maxReward: number;
  basePoints: number;
  awardedPoints: number;
  multiplier: number;
  earnedAt?: string | null;
  boostEventId?: string | null;
};

function normalizeStoredStudyBoxReward(value: unknown): StudyBoxReward | null {
  const milestone = Number((value as StudyBoxReward | null | undefined)?.milestone);
  const minReward = Number((value as StudyBoxReward | null | undefined)?.minReward);
  const maxReward = Number((value as StudyBoxReward | null | undefined)?.maxReward);
  const awardedPoints = Number((value as StudyBoxReward | null | undefined)?.awardedPoints);
  const basePoints = Number((value as StudyBoxReward | null | undefined)?.basePoints ?? awardedPoints);
  const multiplier = Number((value as StudyBoxReward | null | undefined)?.multiplier ?? 1);
  const earnedAtValue = (value as StudyBoxReward | null | undefined)?.earnedAt;
  const boostEventIdValue = (value as StudyBoxReward | null | undefined)?.boostEventId;
  const rarity = (value as StudyBoxReward | null | undefined)?.rarity;

  if (!Number.isFinite(milestone) || milestone < 1 || milestone > 8) return null;
  if (!Number.isFinite(minReward) || !Number.isFinite(maxReward) || !Number.isFinite(basePoints) || !Number.isFinite(awardedPoints)) return null;
  if (rarity !== 'common' && rarity !== 'rare' && rarity !== 'epic') return null;

  return {
    milestone,
    rarity,
    minReward,
    maxReward,
    basePoints: Math.max(0, Math.floor(basePoints)),
    awardedPoints: Math.max(0, Math.floor(awardedPoints)),
    multiplier: Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1,
    earnedAt: typeof earnedAtValue === 'string' && earnedAtValue.trim() ? earnedAtValue.trim() : null,
    boostEventId: typeof boostEventIdValue === 'string' && boostEventIdValue.trim() ? boostEventIdValue.trim() : null,
  };
}

export function normalizeStoredStudyBoxRewardEntries(values: unknown): StudyBoxReward[] {
  if (!Array.isArray(values)) return [];

  return values
    .map((value) => normalizeStoredStudyBoxReward(value))
    .filter((value): value is StudyBoxReward => value !== null)
    .sort((a, b) => a.milestone - b.milestone);
}

function getNormalizedRewardAmount(value: unknown): number {
  const points = Number(value ?? 0);
  if (!Number.isFinite(points)) return 0;
  return Math.max(0, Math.floor(points));
}

function getDailyRankRewardPoints(dayStatus?: Record<string, any>): number {
  return Math.max(
    getNormalizedRewardAmount(dayStatus?.dailyRankRewardAmount),
    getNormalizedRewardAmount(dayStatus?.dailyTopRewardAmount)
  );
}

export function getRankRewardPoints(dayStatus?: Record<string, any>): number {
  return getDailyRankRewardPoints(dayStatus)
    + getNormalizedRewardAmount(dayStatus?.weeklyRankRewardAmount)
    + getNormalizedRewardAmount(dayStatus?.monthlyRankRewardAmount);
}

function inferOpenedStudyBoxHours(dayStatus?: Record<string, any>): number[] {
  const claimedStudyBoxes = getClaimedStudyBoxes(dayStatus);
  const explicitOpenedStudyBoxes = normalizeStudyBoxHourValues(dayStatus?.openedStudyBoxes);

  if (claimedStudyBoxes.length === 0) return explicitOpenedStudyBoxes;

  const rewardByHour = new Map<number, number>();
  normalizeStoredStudyBoxRewardEntries(dayStatus?.studyBoxRewards).forEach((entry) => {
    rewardByHour.set(entry.milestone, Math.max(0, Math.floor(entry.awardedPoints)));
  });

  if (explicitOpenedStudyBoxes.some((hour) => !rewardByHour.has(hour))) {
    return explicitOpenedStudyBoxes;
  }

  const persistedDailyPointAmount = Number(dayStatus?.dailyPointAmount ?? 0);
  const studyBoxAwardedPoints = Math.max(
    0,
    Math.floor(Number.isFinite(persistedDailyPointAmount) ? persistedDailyPointAmount : 0) - getRankRewardPoints(dayStatus)
  );
  const explicitOpenedStudyBoxPoints = explicitOpenedStudyBoxes.reduce(
    (total, hour) => total + (rewardByHour.get(hour) ?? 0),
    0
  );
  const remainingAwardedStudyBoxPoints = Math.max(0, studyBoxAwardedPoints - explicitOpenedStudyBoxPoints);
  const missingClaimedStudyBoxes = claimedStudyBoxes.filter(
    (hour) => !explicitOpenedStudyBoxes.includes(hour) && rewardByHour.has(hour)
  );

  if (missingClaimedStudyBoxes.length === 0) return explicitOpenedStudyBoxes;

  const missingClaimedRewardTotal = missingClaimedStudyBoxes.reduce(
    (total, hour) => total + (rewardByHour.get(hour) ?? 0),
    0
  );

  if (missingClaimedRewardTotal > 0 && remainingAwardedStudyBoxPoints < missingClaimedRewardTotal) {
    return explicitOpenedStudyBoxes;
  }

  return normalizeStudyBoxHourValues([...explicitOpenedStudyBoxes, ...missingClaimedStudyBoxes]);
}

function coerceStudyBoxHourValue(value: unknown): number | null {
  let parsedValue: number | null = null;

  if (typeof value === 'number') {
    parsedValue = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return null;

    const legacyMatch = trimmed.match(/^(\d+)\s*(?:h|시간)$/);
    if (legacyMatch) {
      parsedValue = Number(legacyMatch[1]);
    } else {
      parsedValue = Number(trimmed);
    }
  }

  if (parsedValue === null || !Number.isFinite(parsedValue)) return null;

  const rounded = Math.round(parsedValue);
  if (rounded < 1 || rounded > 8) return null;

  return rounded;
}

export function normalizeStudyBoxHourValues(values: unknown): number[] {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .map((value) => coerceStudyBoxHourValue(value))
        .filter((value): value is number => value !== null)
    )
  ).sort((a, b) => a - b);
}

export function getStudyBoxRarityWeights(milestone: number) {
  return milestone >= 5 ? LATE_STUDY_BOX_RARITY_WEIGHTS : EARLY_STUDY_BOX_RARITY_WEIGHTS;
}

export function getStudyBoxFallbackRarity(milestone: number): StudyBoxRarity {
  return milestone >= 5 ? "rare" : "common";
}

export function rollStudyBoxRarity(milestone: number): StudyBoxRarity {
  const weights = getStudyBoxRarityWeights(milestone);
  const rolled = Math.random() * weights.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = 0;

  for (const entry of weights) {
    cursor += entry.weight;
    if (rolled < cursor) return entry.rarity;
  }

  return weights.at(-1)?.rarity ?? "common";
}

function hashSeedToUInt32(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnitInterval(seed: string): number {
  return hashSeedToUInt32(seed) / 0xffffffff;
}

function rollDeterministicStudyBoxRarity(milestone: number, seed: string): StudyBoxRarity {
  const weights = getStudyBoxRarityWeights(milestone);
  const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
  const rolled = seededUnitInterval(`${seed}:rarity`) * totalWeight;
  let cursor = 0;

  for (const entry of weights) {
    cursor += entry.weight;
    if (rolled < cursor) return entry.rarity;
  }

  return weights.at(-1)?.rarity ?? "common";
}

export function buildDeterministicStudyBoxReward({
  centerId,
  studentId,
  dateKey,
  milestone,
}: {
  centerId: string;
  studentId: string;
  dateKey: string;
  milestone: number;
}): StudyBoxReward {
  const seed = `${centerId}:${studentId}:${dateKey}:${milestone}`;
  const rarity = rollDeterministicStudyBoxRarity(milestone, seed);
  const [minReward, maxReward] = STUDY_BOX_REWARD_RANGE_BY_RARITY[rarity];
  const rewardSpan = maxReward - minReward + 1;
  const awardedPoints = minReward + Math.floor(seededUnitInterval(`${seed}:points`) * rewardSpan);

  return {
    milestone,
    rarity,
    minReward,
    maxReward,
    basePoints: awardedPoints,
    awardedPoints,
    multiplier: 1,
    earnedAt: null,
    boostEventId: null,
  };
}

export function getClaimedStudyBoxes(dayStatus?: Record<string, any>): number[] {
  return normalizeStudyBoxHourValues(dayStatus?.claimedStudyBoxes);
}

export function getOpenedStudyBoxes(dayStatus?: Record<string, any>): number[] {
  return inferOpenedStudyBoxHours(dayStatus);
}

export function getDailyAwardedPointTotal(dayStatus?: Record<string, any>): number {
  const earnedPointTotal = getDailyStudyBoxAwardPoints(dayStatus) + getRankRewardPoints(dayStatus);
  const total = Number(dayStatus?.dailyPointAmount ?? 0);
  if (Number.isFinite(total)) {
    return Math.max(0, Math.max(Math.floor(total), earnedPointTotal));
  }

  return earnedPointTotal;
}

export function getDailyStudyBoxAwardPoints(dayStatus?: Record<string, any>): number {
  const rewardByHour = new Map<number, number>();
  normalizeStoredStudyBoxRewardEntries(dayStatus?.studyBoxRewards).forEach((entry) => {
    rewardByHour.set(entry.milestone, Math.max(0, Math.floor(entry.awardedPoints)));
  });

  return getOpenedStudyBoxes(dayStatus).reduce((total, hour) => total + (rewardByHour.get(hour) ?? 0), 0);
}

export function getDailyPointBreakdown(dayStatus?: Record<string, any>) {
  const totalPoints = getDailyAwardedPointTotal(dayStatus);
  const rankPoints = Math.min(totalPoints, getRankRewardPoints(dayStatus));
  const studyBoxPoints = Math.min(Math.max(0, totalPoints - rankPoints), getDailyStudyBoxAwardPoints(dayStatus));
  const otherPoints = Math.max(0, totalPoints - rankPoints - studyBoxPoints);

  return {
    totalPoints,
    studyBoxPoints,
    rankPoints,
    otherPoints,
  };
}

export function getAvailableStudyBoxMilestones(
  totalMinutes: number,
  claimedStudyBoxes?: unknown,
  openedStudyBoxes?: unknown
) {
  const crossedMilestones = Math.max(0, Math.min(8, Math.floor(Math.max(0, totalMinutes) / 60)));
  const completed = new Set([
    ...normalizeStudyBoxHourValues(claimedStudyBoxes),
    ...normalizeStudyBoxHourValues(openedStudyBoxes),
  ]);
  return Array.from({ length: crossedMilestones }, (_, index) => index + 1).filter((milestone) => !completed.has(milestone));
}

export function getRenderableTodayStudyBoxHours({
  earnedHours,
  claimedHours,
  openedHours,
}: {
  earnedHours: number;
  claimedHours?: unknown;
  openedHours?: unknown;
}) {
  const cappedEarnedHours = Math.max(0, Math.min(8, Math.floor(Number(earnedHours) || 0)));
  const claimableHours = new Set(Array.from({ length: cappedEarnedHours }, (_, index) => index + 1));
  const renderableClaimedHours = normalizeStudyBoxHourValues(claimedHours).filter((hour) => claimableHours.has(hour));
  const renderableOpenedHours = normalizeStudyBoxHourValues(openedHours).filter((hour) => claimableHours.has(hour));

  return {
    earnedHours: cappedEarnedHours,
    claimedHours: renderableClaimedHours,
    openedHours: renderableOpenedHours,
  };
}

export function getRemainingCarryoverStudyBoxHours({
  claimedHours,
  openedHours,
}: {
  claimedHours?: unknown;
  openedHours?: unknown;
}) {
  const openedHourSet = new Set(normalizeStudyBoxHourValues(openedHours));
  return normalizeStudyBoxHourValues(claimedHours).filter((hour) => !openedHourSet.has(hour));
}

export function rollStudyBoxReward(milestone: number): StudyBoxReward {
  const rarity = rollStudyBoxRarity(milestone);
  const [minReward, maxReward] = STUDY_BOX_REWARD_RANGE_BY_RARITY[rarity];
  const awardedPoints = Math.floor(Math.random() * (maxReward - minReward + 1)) + minReward;
  return {
    milestone,
    rarity,
    minReward,
    maxReward,
    basePoints: awardedPoints,
    awardedPoints,
    multiplier: 1,
    earnedAt: null,
    boostEventId: null,
  };
}

export function upsertStudyBoxRewardEntry(entries: StudyBoxReward[], reward: StudyBoxReward) {
  const next = new Map<number, StudyBoxReward>();
  entries.forEach((entry) => {
    next.set(entry.milestone, entry);
  });
  next.set(reward.milestone, reward);
  return Array.from(next.values()).sort((a, b) => a.milestone - b.milestone);
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
