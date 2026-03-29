export const STUDY_SESSION_POINTS_PER_MINUTE = 0.42;
export const STUDY_ATTENDANCE_POINTS = 20;
export const STUDY_DEEP_FOCUS_POINTS = 15;
export const STUDY_PLAN_COMPLETION_POINTS = 10;
export const STUDY_ROUTINE_COMPLETION_POINTS = 10;

export const STUDY_SESSION_LP_PER_MINUTE = 0.12;
export const STUDY_ATTENDANCE_BONUS_LP = 12;
export const STUDY_DEEP_FOCUS_LP = 8;
export const STUDY_PLAN_COMPLETION_LP = 3;
export const STUDY_ROUTINE_COMPLETION_LP = 3;

export const DAILY_FORTUNE_POINT_MAX = 100;
export const DAILY_FORTUNE_BOOST_MIN_PERCENT = 1;
export const DAILY_FORTUNE_BOOST_MAX_PERCENT = 10;
export const DAILY_TOP_STUDY_POINTS = 1000;
export const MONTHLY_RANK_POINT_REWARDS = {
  1: 20000,
  2: 10000,
  3: 5000,
} as const;

export type DailyFortuneRewardType = "points" | "boost";

export interface DailyFortuneMessage {
  key: string;
  title: string;
  body: string;
}

export interface DailyFortuneOutcome {
  rewardType: DailyFortuneRewardType;
  pointGift: number;
  boostPercent: number;
  messageKey: string;
  message: DailyFortuneMessage;
}

type TaskRewardCategory = 'study' | 'schedule' | 'personal' | undefined;

type TaskCompletionRewardsParams = {
  category: TaskRewardCategory;
  lpDayStatus?: Record<string, any> | null;
};

const DAILY_FORTUNE_MESSAGES: DailyFortuneMessage[] = [
  {
    key: "steady-rise",
    title: "차분한 상승 운",
    body: "오늘은 서두르지 않아도 좋아요. 한 번 잡은 흐름이 끝까지 이어질 가능성이 큰 날이에요.",
  },
  {
    key: "focus-lock",
    title: "집중 고정 운",
    body: "첫 몰입만 잘 잡으면 뒤가 편해져요. 어려운 과목부터 열면 생각보다 빨리 속도가 붙습니다.",
  },
  {
    key: "finish-strong",
    title: "마무리 강세 운",
    body: "오늘은 시작보다 끝이 더 좋습니다. 남겨둔 문제를 정리할수록 만족감이 커지는 흐름이에요.",
  },
  {
    key: "confidence-up",
    title: "자신감 상승 운",
    body: "어제보다 조금만 더 하면 체감이 분명하게 올 날이에요. 익숙한 과목으로 리듬을 만들면 좋아요.",
  },
  {
    key: "streak-keeper",
    title: "꾸준함 유지 운",
    body: "큰 한 방보다 이어가는 힘이 강한 날입니다. 짧아도 끊기지 않는 공부가 오늘 운을 살려줘요.",
  },
  {
    key: "calm-recovery",
    title: "회복 집중 운",
    body: "흐름이 살짝 흔들려도 금방 다시 돌아올 수 있어요. 쉬는 시간을 짧게 나누면 더 안정적입니다.",
  },
  {
    key: "small-wins",
    title: "작은 승리 운",
    body: "작은 완료를 여러 번 만들수록 자신감이 커집니다. 오늘은 분량을 끊어 처리할수록 유리해요.",
  },
  {
    key: "breakthrough",
    title: "돌파력 상승 운",
    body: "막히던 지점이 풀릴 가능성이 큰 날이에요. 평소 미뤘던 단원도 오늘은 의외로 잘 넘어갑니다.",
  },
];

function clampInt(value: unknown, min: number, max: number) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDailyFortuneMessage(messageKey?: string | null) {
  if (messageKey) {
    const matched = DAILY_FORTUNE_MESSAGES.find((message) => message.key === messageKey);
    if (matched) return matched;
  }
  return DAILY_FORTUNE_MESSAGES[0];
}

export function pickDailyFortuneMessageKey(params: {
  userId: string;
  dateKey: string;
  stats?: {
    focus?: number;
    consistency?: number;
    achievement?: number;
    resilience?: number;
  } | null;
}) {
  const { userId, dateKey, stats } = params;
  const focusWeight = Math.round(
    Number(stats?.focus || 0)
    + Number(stats?.consistency || 0)
    + Number(stats?.achievement || 0)
    + Number(stats?.resilience || 0)
  );
  const hashed = hashString(`${userId}:${dateKey}:${focusWeight}`);
  return DAILY_FORTUNE_MESSAGES[hashed % DAILY_FORTUNE_MESSAGES.length].key;
}

export function getDailyFortuneBoostPercent(dayStatus?: Record<string, any> | null) {
  return clampInt(
    dayStatus?.fortuneRewardType === "boost" ? dayStatus?.fortuneBoostPercent : 0,
    0,
    DAILY_FORTUNE_BOOST_MAX_PERCENT
  );
}

export function getDailyFortuneBoostMultiplier(dayStatus?: Record<string, any> | null) {
  return 1 + getDailyFortuneBoostPercent(dayStatus) / 100;
}

export function calculateStudySessionLp(
  sessionMinutes: number,
  finalMultiplier: number,
  dayStatus?: Record<string, any> | null,
) {
  return Math.max(
    0,
    Math.round(sessionMinutes * STUDY_SESSION_LP_PER_MINUTE * finalMultiplier * getDailyFortuneBoostMultiplier(dayStatus))
  );
}

export function calculateStudySessionPoints(
  sessionMinutes: number,
  finalMultiplier: number,
) {
  return Math.max(
    0,
    Math.round(sessionMinutes * STUDY_SESSION_POINTS_PER_MINUTE * finalMultiplier)
  );
}

export function calculateAttendanceBonusLp(
  finalMultiplier: number,
  dayStatus?: Record<string, any> | null,
) {
  return Math.max(
    0,
    Math.round(STUDY_ATTENDANCE_BONUS_LP * finalMultiplier * getDailyFortuneBoostMultiplier(dayStatus))
  );
}

export function calculateAttendanceBonusPoints(finalMultiplier: number) {
  return Math.max(0, Math.round(STUDY_ATTENDANCE_POINTS * finalMultiplier));
}

export function calculateDeepFocusBonusLp(
  finalMultiplier: number,
  dayStatus?: Record<string, any> | null,
) {
  return Math.max(
    0,
    Math.round(STUDY_DEEP_FOCUS_LP * finalMultiplier * getDailyFortuneBoostMultiplier(dayStatus))
  );
}

export function calculateDeepFocusBonusPoints(finalMultiplier: number) {
  return Math.max(0, Math.round(STUDY_DEEP_FOCUS_POINTS * finalMultiplier));
}

export function calculatePlanCompletionLp(dayStatus?: Record<string, any> | null) {
  return Math.max(
    1,
    Math.round(STUDY_PLAN_COMPLETION_LP * getDailyFortuneBoostMultiplier(dayStatus))
  );
}

export function calculateTaskCompletionRewards({
  category,
  lpDayStatus,
}: TaskCompletionRewardsParams) {
  const currentDayStatus = lpDayStatus || {};

  if (category === 'study') {
    const alreadyGranted = !!currentDayStatus.plan;
    return {
      pointReward: alreadyGranted ? 0 : STUDY_PLAN_COMPLETION_POINTS,
      lpReward: alreadyGranted ? 0 : calculatePlanCompletionLp(currentDayStatus),
      pointFlagKey: 'plan' as const,
      lpFlagKey: 'plan' as const,
    };
  }

  if (category === 'schedule') {
    const alreadyGranted = !!currentDayStatus.routine;
    return {
      pointReward: alreadyGranted ? 0 : STUDY_ROUTINE_COMPLETION_POINTS,
      lpReward: alreadyGranted
        ? 0
        : Math.max(1, Math.round(STUDY_ROUTINE_COMPLETION_LP * getDailyFortuneBoostMultiplier(currentDayStatus))),
      pointFlagKey: 'routine' as const,
      lpFlagKey: 'routine' as const,
    };
  }

  return {
    pointReward: 0,
    lpReward: 0,
    pointFlagKey: null,
    lpFlagKey: null,
  };
}

export function createDailyFortuneOutcome(params: {
  userId: string;
  dateKey: string;
  stats?: {
    focus?: number;
    consistency?: number;
    achievement?: number;
    resilience?: number;
  } | null;
}) {
  const messageKey = pickDailyFortuneMessageKey(params);
  const message = getDailyFortuneMessage(messageKey);
  const rewardRoll = Math.random();

  if (rewardRoll < 0.58) {
    return {
      rewardType: "points" as const,
      pointGift: Math.floor(Math.random() * (DAILY_FORTUNE_POINT_MAX + 1)),
      boostPercent: 0,
      messageKey,
      message,
    };
  }

  return {
    rewardType: "boost" as const,
    pointGift: 0,
    boostPercent:
      DAILY_FORTUNE_BOOST_MIN_PERCENT
      + Math.floor(Math.random() * (DAILY_FORTUNE_BOOST_MAX_PERCENT - DAILY_FORTUNE_BOOST_MIN_PERCENT + 1)),
    messageKey,
    message,
  };
}
