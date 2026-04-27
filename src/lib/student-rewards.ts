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

export type DailyPointBreakdownItemTone = 'box' | 'rank' | 'plan' | 'legacy' | 'adjustment';

export type DailyPointBreakdownItem = {
  key: string;
  label: string;
  points: number;
  tone: DailyPointBreakdownItemTone;
  source?: string;
  reason?: string;
  direction?: 'add' | 'subtract';
};

const PLANNER_COMPLETION_REWARD_POINTS = 5;

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

function getDailyPointEventTone(source: string): DailyPointBreakdownItemTone {
  if (source === 'study_box') return 'box';
  if (source === 'plan_completion') return 'plan';
  if (source.includes('rank')) return 'rank';
  if (source.includes('adjustment')) return 'adjustment';
  return 'legacy';
}

function getDailyPointEventLabel(event: Record<string, any>): string {
  const explicitLabel = typeof event.label === 'string' ? event.label.trim() : '';
  if (explicitLabel) return explicitLabel;

  const source = typeof event.source === 'string' ? event.source : '';
  const hour = Number(event.hour ?? event.milestone);
  const rank = Math.max(0, Math.floor(Number(event.rank || 0)));
  const rangeLabel =
    source === 'weekly_rank'
      ? '주간 랭킹'
      : source === 'monthly_rank'
        ? '월간 랭킹'
        : '일간 랭킹';

  if (source === 'study_box' && Number.isFinite(hour) && hour > 0) return `${hour}시간 상자`;
  if (source === 'plan_completion') return '계획 완수';
  if (source.includes('rank')) return rank > 0 ? `${rangeLabel} ${rank}위` : rangeLabel;
  if (source.includes('adjustment')) return '포인트 조정';
  return '이전 포인트 기록';
}

function normalizeDailyPointEventItems(value: unknown, maxTotal: number): DailyPointBreakdownItem[] {
  if (!Array.isArray(value) || maxTotal <= 0) return [];

  let remaining = maxTotal;
  const seenKeys = new Set<string>();
  const items: DailyPointBreakdownItem[] = [];
  const eventEntries = value
    .map((event, index) => ({ event, index }))
    .sort((left, right) => {
      const leftSource = typeof (left.event as Record<string, any> | null)?.source === 'string'
        ? String((left.event as Record<string, any>).source)
        : '';
      const rightSource = typeof (right.event as Record<string, any> | null)?.source === 'string'
        ? String((right.event as Record<string, any>).source)
        : '';
      const manualRank = Number(rightSource === 'manual_adjustment') - Number(leftSource === 'manual_adjustment');
      return manualRank || left.index - right.index;
    });

  eventEntries.forEach(({ event, index }) => {
    if (!event || typeof event !== 'object' || remaining <= 0) return;

    const points = getNormalizedRewardAmount((event as Record<string, any>).points);
    if (points <= 0) return;

    const keySource = typeof (event as Record<string, any>).id === 'string'
      ? (event as Record<string, any>).id.trim()
      : '';
    const key = keySource || `point-event-${index}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);

    const source = typeof (event as Record<string, any>).source === 'string'
      ? (event as Record<string, any>).source
      : '';
    const reason = typeof (event as Record<string, any>).reason === 'string'
      ? (event as Record<string, any>).reason.trim()
      : '';
    const direction = (event as Record<string, any>).direction === 'subtract'
      ? 'subtract'
      : (event as Record<string, any>).direction === 'add'
        ? 'add'
        : undefined;
    const cappedPoints = Math.min(remaining, points);
    if (cappedPoints <= 0) return;

    items.push({
      key,
      label: getDailyPointEventLabel(event as Record<string, any>),
      points: cappedPoints,
      tone: getDailyPointEventTone(source),
      source,
      ...(reason ? { reason } : {}),
      ...(direction ? { direction } : {}),
    });
    remaining -= cappedPoints;
  });

  return items;
}

function getPlanCompletionRewardCount(dayStatus?: Record<string, any>): number {
  const storedCount = Number(dayStatus?.planCompletionRewardCount ?? 0);
  if (Number.isFinite(storedCount) && storedCount > 0) {
    return Math.max(0, Math.floor(storedCount));
  }

  if (Array.isArray(dayStatus?.planCompletionRewardTaskIds)) {
    return dayStatus.planCompletionRewardTaskIds.length;
  }

  return 0;
}

function getPlanCompletionFallbackPoints(dayStatus?: Record<string, any>): number {
  return getPlanCompletionRewardCount(dayStatus) * PLANNER_COMPLETION_REWARD_POINTS;
}

function getPlanCompletionFallbackLabel(dayStatus?: Record<string, any>): string {
  const count = getPlanCompletionRewardCount(dayStatus);
  return count > 1 ? `계획 완수 ${count}회` : '계획 완수';
}

function pushBreakdownItem(
  items: DailyPointBreakdownItem[],
  key: string,
  label: string,
  points: number,
  tone: DailyPointBreakdownItemTone
) {
  const normalizedPoints = getNormalizedRewardAmount(points);
  if (normalizedPoints <= 0) return;

  items.push({ key, label, points: normalizedPoints, tone });
}

function sumBreakdownItemPoints(items: DailyPointBreakdownItem[], tone?: DailyPointBreakdownItemTone): number {
  return items.reduce((sum, item) => {
    if (tone && item.tone !== tone) return sum;
    return sum + Math.max(0, Math.floor(item.points));
  }, 0);
}

function pushMissingBreakdownItemsFromFallback({
  items,
  fallbackItems,
  keyPrefix,
  coveredPoints,
  missingPoints,
}: {
  items: DailyPointBreakdownItem[];
  fallbackItems: DailyPointBreakdownItem[];
  keyPrefix: string;
  coveredPoints: number;
  missingPoints: number;
}) {
  let coveredRemaining = Math.max(0, Math.floor(coveredPoints));
  let missingRemaining = Math.max(0, Math.floor(missingPoints));
  if (missingRemaining <= 0) return 0;

  fallbackItems.forEach((fallbackItem) => {
    if (missingRemaining <= 0) return;

    const fallbackPoints = Math.max(0, Math.floor(fallbackItem.points));
    if (fallbackPoints <= 0) return;

    if (coveredRemaining >= fallbackPoints) {
      coveredRemaining -= fallbackPoints;
      return;
    }

    const uncoveredFallbackPoints = fallbackPoints - coveredRemaining;
    coveredRemaining = 0;
    const pointsToAppend = Math.min(missingRemaining, uncoveredFallbackPoints);
    if (pointsToAppend <= 0) return;

    pushBreakdownItem(
      items,
      `${keyPrefix}-${fallbackItem.key}`,
      fallbackItem.label,
      pointsToAppend,
      fallbackItem.tone
    );
    missingRemaining -= pointsToAppend;
  });

  return missingRemaining;
}

function getRankRewardBreakdownItems(dayStatus: Record<string, any> | undefined, maxPoints: number): DailyPointBreakdownItem[] {
  const items: DailyPointBreakdownItem[] = [];
  let remaining = Math.max(0, Math.floor(maxPoints));
  if (remaining <= 0) return items;

  const dailyRankPoints = getDailyRankRewardPoints(dayStatus);
  const dailyRank = Math.max(0, Math.floor(Number(dayStatus?.dailyRankRewardRank || (dailyRankPoints > 0 ? 1 : 0))));
  const weeklyRankPoints = getNormalizedRewardAmount(dayStatus?.weeklyRankRewardAmount);
  const weeklyRank = Math.max(0, Math.floor(Number(dayStatus?.weeklyRankRewardRank || 0)));
  const monthlyRankPoints = getNormalizedRewardAmount(dayStatus?.monthlyRankRewardAmount);
  const monthlyRank = Math.max(0, Math.floor(Number(dayStatus?.monthlyRankRewardRank || 0)));

  const appendRankItem = (key: string, label: string, points: number) => {
    const cappedPoints = Math.min(remaining, getNormalizedRewardAmount(points));
    if (cappedPoints <= 0) return;
    pushBreakdownItem(items, key, label, cappedPoints, 'rank');
    remaining -= cappedPoints;
  };

  appendRankItem('rank-daily', dailyRank > 0 ? `일간 랭킹 ${dailyRank}위` : '일간 랭킹', dailyRankPoints);
  appendRankItem('rank-weekly', weeklyRank > 0 ? `주간 랭킹 ${weeklyRank}위` : '주간 랭킹', weeklyRankPoints);
  appendRankItem('rank-monthly', monthlyRank > 0 ? `월간 랭킹 ${monthlyRank}위` : '월간 랭킹', monthlyRankPoints);

  return items;
}

export function getRankRewardPoints(dayStatus?: Record<string, any>): number {
  return getDailyRankRewardPoints(dayStatus)
    + getNormalizedRewardAmount(dayStatus?.weeklyRankRewardAmount)
    + getNormalizedRewardAmount(dayStatus?.monthlyRankRewardAmount);
}

function inferOpenedStudyBoxHours(dayStatus?: Record<string, any>): number[] {
  const claimedStudyBoxes = getClaimedStudyBoxes(dayStatus);
  const explicitOpenedStudyBoxes = normalizeStudyBoxHourValues(dayStatus?.openedStudyBoxes);
  const hasExplicitOpenedStudyBoxes = Boolean(
    dayStatus &&
    typeof dayStatus === 'object' &&
    Object.prototype.hasOwnProperty.call(dayStatus, 'openedStudyBoxes')
  );

  if (hasExplicitOpenedStudyBoxes) return explicitOpenedStudyBoxes;
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

export function getStudyBoxRewardRangeByRarity(rarity: StudyBoxRarity) {
  return STUDY_BOX_REWARD_RANGE_BY_RARITY[rarity];
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
  const hasStoredDailyPointAmount = Boolean(
    dayStatus &&
    typeof dayStatus === 'object' &&
    Object.prototype.hasOwnProperty.call(dayStatus, 'dailyPointAmount')
  );
  const total = Number(dayStatus?.dailyPointAmount);
  if (hasManualPointAdjustment(dayStatus)) {
    const manualDelta = getManualPointAdjustmentDelta(dayStatus);
    const adjustedEarnedTotal = Math.max(0, earnedPointTotal + manualDelta);
    const storedTotal = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;

    if (!hasStoredDailyPointAmount) return adjustedEarnedTotal;
    if (Math.abs(storedTotal - adjustedEarnedTotal) <= 1) return storedTotal;
    if (earnedPointTotal > 0) return adjustedEarnedTotal;
    return Math.max(0, storedTotal + manualDelta);
  }

  if (hasStoredDailyPointAmount && Number.isFinite(total)) {
    return Math.max(0, Math.floor(total));
  }

  return earnedPointTotal;
}

function hasManualPointAdjustment(dayStatus?: Record<string, any>): boolean {
  if (!dayStatus || typeof dayStatus !== 'object') return false;
  const manualAdjustmentPoints = Number(dayStatus.manualAdjustmentPoints ?? 0);
  if (Number.isFinite(manualAdjustmentPoints) && Math.round(manualAdjustmentPoints) !== 0) return true;
  const events = Array.isArray(dayStatus.pointEvents) ? dayStatus.pointEvents : [];
  return events.some((event) => {
    if (!event || typeof event !== 'object') return false;
    const source = typeof event.source === 'string' ? event.source : '';
    const deltaPoints = Number(event.deltaPoints ?? 0);
    return source === 'manual_adjustment' && Number.isFinite(deltaPoints) && Math.round(deltaPoints) !== 0;
  });
}

function getManualPointAdjustmentDelta(dayStatus?: Record<string, any>): number {
  if (!dayStatus || typeof dayStatus !== 'object') return 0;

  const storedManualAdjustmentPoints = Number(dayStatus.manualAdjustmentPoints ?? 0);
  if (Number.isFinite(storedManualAdjustmentPoints) && Math.round(storedManualAdjustmentPoints) !== 0) {
    return Math.round(storedManualAdjustmentPoints);
  }

  const events = Array.isArray(dayStatus.pointEvents) ? dayStatus.pointEvents : [];
  return events.reduce((sum, event) => {
    if (!event || typeof event !== 'object') return sum;
    const source = typeof event.source === 'string' ? event.source : '';
    if (source !== 'manual_adjustment') return sum;

    const deltaPoints = Number(event.deltaPoints ?? 0);
    if (Number.isFinite(deltaPoints) && Math.round(deltaPoints) !== 0) {
      return sum + Math.round(deltaPoints);
    }

    const points = getNormalizedRewardAmount((event as Record<string, any>).points);
    if (points <= 0) return sum;
    return (event as Record<string, any>).direction === 'subtract' ? sum - points : sum + points;
  }, 0);
}

export function getDailyStudyBoxAwardPoints(dayStatus?: Record<string, any>): number {
  const rewardByHour = new Map<number, number>();
  normalizeStoredStudyBoxRewardEntries(dayStatus?.studyBoxRewards).forEach((entry) => {
    rewardByHour.set(entry.milestone, Math.max(0, Math.floor(entry.awardedPoints)));
  });

  return getOpenedStudyBoxes(dayStatus).reduce((total, hour) => total + (rewardByHour.get(hour) ?? 0), 0);
}

function getStoredStudyBoxRewardTotal(dayStatus?: Record<string, any>): number {
  return normalizeStoredStudyBoxRewardEntries(dayStatus?.studyBoxRewards).reduce(
    (total, entry) => total + Math.max(0, Math.floor(entry.awardedPoints)),
    0
  );
}

export function getDailyPointBreakdown(dayStatus?: Record<string, any>) {
  const totalPoints = getDailyAwardedPointTotal(dayStatus);
  const rankPoints = Math.min(totalPoints, getRankRewardPoints(dayStatus));
  const studyBoxPoints = Math.min(Math.max(0, totalPoints - rankPoints), getDailyStudyBoxAwardPoints(dayStatus));
  const nonPrimaryPoints = Math.max(0, totalPoints - rankPoints - studyBoxPoints);
  const pointItems = normalizeDailyPointEventItems(dayStatus?.pointEvents, totalPoints);

  if (pointItems.length > 0) {
    const initialEventTotal = sumBreakdownItemPoints(pointItems);

    const rankEventPoints = sumBreakdownItemPoints(pointItems, 'rank');
    const missingRankPoints = Math.min(
      Math.max(0, rankPoints - rankEventPoints),
      Math.max(0, totalPoints - initialEventTotal)
    );
    if (missingRankPoints > 0) {
      const remainingMissingRankPoints = pushMissingBreakdownItemsFromFallback({
        items: pointItems,
        fallbackItems: getRankRewardBreakdownItems(dayStatus, rankPoints),
        keyPrefix: 'inferred',
        coveredPoints: rankEventPoints,
        missingPoints: missingRankPoints,
      });
      pushBreakdownItem(pointItems, 'rank-reward-record', '랭킹 보상', remainingMissingRankPoints, 'rank');
    }

    const studyBoxEventPoints = sumBreakdownItemPoints(pointItems, 'box');
    const missingStudyBoxPoints = Math.min(
      Math.max(0, studyBoxPoints - studyBoxEventPoints),
      Math.max(0, totalPoints - sumBreakdownItemPoints(pointItems))
    );
    pushBreakdownItem(pointItems, 'study-box-record', '상자', missingStudyBoxPoints, 'box');

    const eventTotal = sumBreakdownItemPoints(pointItems);
    const hasPlanCompletionEvent = pointItems.some((item) => item.tone === 'plan');
    const inferredPlanPoints = hasPlanCompletionEvent
      ? 0
      : Math.min(Math.max(0, totalPoints - eventTotal), getPlanCompletionFallbackPoints(dayStatus));
    if (inferredPlanPoints > 0) {
      pushBreakdownItem(
        pointItems,
        'plan-completion-record',
        getPlanCompletionFallbackLabel(dayStatus),
        inferredPlanPoints,
        'plan'
      );
    }

    const enrichedEventTotal = eventTotal + inferredPlanPoints;
    const legacyPoints = Math.max(0, totalPoints - enrichedEventTotal);
    if (legacyPoints > 0) {
      pushBreakdownItem(pointItems, 'legacy-point-record', '이전 포인트 기록', legacyPoints, 'legacy');
    }

    return {
      totalPoints,
      studyBoxPoints,
      rankPoints,
      otherPoints: nonPrimaryPoints,
      legacyStudyBoxPoints: 0,
      legacyPointRecordPoints: legacyPoints,
      pointItems,
    };
  }

  const fallbackItems: DailyPointBreakdownItem[] = [];
  pushBreakdownItem(fallbackItems, 'study-box-opened', '상자', studyBoxPoints, 'box');
  getRankRewardBreakdownItems(dayStatus, rankPoints).forEach((item) => fallbackItems.push(item));

  const planCompletionPoints = Math.min(nonPrimaryPoints, getPlanCompletionFallbackPoints(dayStatus));
  pushBreakdownItem(
    fallbackItems,
    'plan-completion-record',
    getPlanCompletionFallbackLabel(dayStatus),
    planCompletionPoints,
    'plan'
  );
  const remainingNonPrimaryPoints = Math.max(0, nonPrimaryPoints - planCompletionPoints);
  const storedStudyBoxPoints = getStoredStudyBoxRewardTotal(dayStatus);
  const legacyStudyBoxPoints = Math.min(
    remainingNonPrimaryPoints,
    Math.max(0, storedStudyBoxPoints - studyBoxPoints)
  );
  pushBreakdownItem(fallbackItems, 'legacy-study-box-record', '이전 상자 기록', legacyStudyBoxPoints, 'legacy');

  const legacyPointRecordPoints = Math.max(0, remainingNonPrimaryPoints - legacyStudyBoxPoints);
  pushBreakdownItem(fallbackItems, 'legacy-point-record', '이전 포인트 기록', legacyPointRecordPoints, 'legacy');

  return {
    totalPoints,
    studyBoxPoints,
    rankPoints,
    otherPoints: nonPrimaryPoints,
    legacyStudyBoxPoints,
    legacyPointRecordPoints,
    pointItems: fallbackItems,
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
