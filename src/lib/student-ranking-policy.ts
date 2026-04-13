export type StudentRankingRange = "daily" | "weekly" | "monthly";

export type StudentRankRewardTier = {
  rank: number;
  points: number;
};

export type DailyRankWindowState = {
  nowKst: Date;
  isLive: boolean;
  competitionDate: Date;
  competitionDateKey: string;
  startsAt: Date;
  endsAt: Date;
  coveredDateKeys: string[];
  nextOpensAt: Date;
  nextOpensAtLabel: string;
  windowLabel: string;
};

const DAILY_RANK_START_HOUR = 17;
const DAILY_RANK_END_HOUR = 1;

export const STUDENT_RANK_REWARD_TIERS: Record<StudentRankingRange, StudentRankRewardTier[]> = {
  daily: [{ rank: 1, points: 500 }],
  weekly: [
    { rank: 1, points: 3000 },
    { rank: 2, points: 1500 },
  ],
  monthly: [
    { rank: 1, points: 10000 },
    { rank: 2, points: 5000 },
    { rank: 3, points: 2500 },
  ],
};

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

export function toKstDate(baseDate: Date = new Date()) {
  const formatted = baseDate.toLocaleString("en-US", { timeZone: "Asia/Seoul" });
  return new Date(formatted);
}

export function toKstDateKey(baseDate: Date) {
  return `${baseDate.getFullYear()}-${padNumber(baseDate.getMonth() + 1)}-${padNumber(baseDate.getDate())}`;
}

function getCompetitionStartHour() {
  return DAILY_RANK_START_HOUR;
}

function buildCompetitionWindow(targetDate: Date) {
  const competitionDate = new Date(targetDate);
  competitionDate.setHours(0, 0, 0, 0);

  const startsAt = new Date(competitionDate);
  startsAt.setHours(getCompetitionStartHour(), 0, 0, 0);

  const endsAt = new Date(competitionDate);
  endsAt.setDate(endsAt.getDate() + 1);
  endsAt.setHours(DAILY_RANK_END_HOUR, 0, 0, 0);

  return {
    competitionDate,
    startsAt,
    endsAt,
  };
}

function buildRelativeOpenLabel(nowKst: Date, opensAt: Date) {
  const dateGap = Math.round((opensAt.getTime() - nowKst.getTime()) / (24 * 60 * 60 * 1000));
  const dayLabel = dateGap <= 0 ? "오늘" : dateGap === 1 ? "내일" : `${opensAt.getMonth() + 1}/${opensAt.getDate()}`;
  return `${dayLabel} ${padNumber(opensAt.getHours())}:${padNumber(opensAt.getMinutes())}`;
}

function getDateKeysCoveredByWindow(startsAt: Date, endsAt: Date) {
  const keys: string[] = [];
  const cursor = new Date(startsAt);
  cursor.setHours(0, 0, 0, 0);

  const lastIncludedDate = new Date(endsAt.getTime() - 1);
  lastIncludedDate.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= lastIncludedDate.getTime()) {
    keys.push(toKstDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

export function getDailyRankWindowLabel() {
  return "매일 17:00~01:00";
}

export function getStudentRankRewardTiers(range: StudentRankingRange) {
  return STUDENT_RANK_REWARD_TIERS[range];
}

export function getStudentRankRewardPoints(range: StudentRankingRange, rank: number) {
  return STUDENT_RANK_REWARD_TIERS[range].find((entry) => entry.rank === rank)?.points ?? 0;
}

export function shouldHighlightStudentRankReward(range: StudentRankingRange, rank: number) {
  return getStudentRankRewardPoints(range, rank) > 0;
}

export function formatStudentRankRewardSummary(range: StudentRankingRange) {
  return STUDENT_RANK_REWARD_TIERS[range]
    .map((entry) => `${entry.rank}위 ${entry.points.toLocaleString()}P`)
    .join(" / ");
}

function getTimeRangeOverlapMs(
  rangeStartMs: number,
  rangeEndMs: number,
  windowStartMs: number,
  windowEndMs: number
) {
  if (!Number.isFinite(rangeStartMs) || !Number.isFinite(rangeEndMs)) return 0;
  const overlapStart = Math.max(rangeStartMs, windowStartMs);
  const overlapEnd = Math.min(rangeEndMs, windowEndMs);
  if (overlapEnd <= overlapStart) return 0;
  return overlapEnd - overlapStart;
}

export function isTimestampInDailyRankWindow(
  timestampMs: number,
  dailyRankWindow: Pick<DailyRankWindowState, "startsAt" | "endsAt">
) {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return false;
  return timestampMs >= dailyRankWindow.startsAt.getTime() && timestampMs < dailyRankWindow.endsAt.getTime();
}

export function getDailyRankWindowOverlapMinutes(
  startedAtMs: number,
  referenceMs: number,
  dailyRankWindow: Pick<DailyRankWindowState, "startsAt" | "endsAt">
) {
  const overlapMs = getTimeRangeOverlapMs(
    startedAtMs,
    referenceMs,
    dailyRankWindow.startsAt.getTime(),
    dailyRankWindow.endsAt.getTime()
  );
  if (overlapMs <= 0) return 0;
  return Math.max(1, Math.ceil(overlapMs / 60000));
}

export function getDailyRankWindowOverlapSeconds(
  startedAtMs: number,
  referenceMs: number,
  dailyRankWindow: Pick<DailyRankWindowState, "startsAt" | "endsAt">
) {
  const overlapMs = getTimeRangeOverlapMs(
    startedAtMs,
    referenceMs,
    dailyRankWindow.startsAt.getTime(),
    dailyRankWindow.endsAt.getTime()
  );
  if (overlapMs <= 0) return 0;
  return Math.max(0, Math.floor(overlapMs / 1000));
}

export function getDailyRankWindowState(baseDate: Date = new Date()): DailyRankWindowState {
  const nowKst = toKstDate(baseDate);
  const todayWindow = buildCompetitionWindow(nowKst);
  const previousDate = new Date(nowKst);
  previousDate.setDate(previousDate.getDate() - 1);
  const previousWindow = buildCompetitionWindow(previousDate);

  const isPreviousWindowLive = nowKst >= previousWindow.startsAt && nowKst < previousWindow.endsAt;
  const isTodayWindowLive = nowKst >= todayWindow.startsAt && nowKst < todayWindow.endsAt;
  const activeWindow = isPreviousWindowLive ? previousWindow : isTodayWindowLive ? todayWindow : todayWindow;
  const nextOpensAt = isPreviousWindowLive || isTodayWindowLive ? activeWindow.startsAt : todayWindow.startsAt;

  return {
    nowKst,
    isLive: isPreviousWindowLive || isTodayWindowLive,
    competitionDate: activeWindow.competitionDate,
    competitionDateKey: toKstDateKey(activeWindow.competitionDate),
    startsAt: activeWindow.startsAt,
    endsAt: activeWindow.endsAt,
    coveredDateKeys: getDateKeysCoveredByWindow(activeWindow.startsAt, activeWindow.endsAt),
    nextOpensAt,
    nextOpensAtLabel: buildRelativeOpenLabel(nowKst, nextOpensAt),
    windowLabel: getDailyRankWindowLabel(),
  };
}
