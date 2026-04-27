export type StudentRankingRange = "daily" | "weekly" | "monthly";

export type StudentRankRewardTier = {
  rank: number;
  points: number;
};

export type DailyRankWindowState = {
  nowKst: Date;
  isLive: boolean;
  isSettlementPending: boolean;
  competitionDate: Date;
  competitionDateKey: string;
  startsAt: Date;
  endsAt: Date;
  awardsAt: Date;
  coveredDateKeys: string[];
  nextOpensAt: Date;
  nextOpensAtLabel: string;
  windowLabel: string;
};

const WEEKDAY_DAILY_RANK_START_HOUR = 17;
const WEEKEND_DAILY_RANK_START_HOUR = 8;
const DAILY_RANK_END_HOUR = 1;
const DAILY_RANK_REWARD_DELAY_MINUTES = 5;
const KST_OFFSET_HOURS = 9;
const DAY_MS = 24 * 60 * 60 * 1000;

export const STUDENT_RANK_REWARD_TIERS: Record<StudentRankingRange, StudentRankRewardTier[]> = {
  daily: [{ rank: 1, points: 500 }],
  weekly: [
    { rank: 1, points: 2000 },
    { rank: 2, points: 1000 },
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

function getKstDateParts(baseDate: Date = new Date()) {
  const shifted = new Date(baseDate.getTime() + KST_OFFSET_HOURS * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    dayOfWeek: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
  };
}

function dateFromKstParts(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0
) {
  return new Date(Date.UTC(year, month - 1, day, hour - KST_OFFSET_HOURS, minute, second, millisecond));
}

function shiftKstDateParts(parts: ReturnType<typeof getKstDateParts>, days: number) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    dayOfWeek: shifted.getUTCDay(),
  };
}

function compareKstDateParts(
  left: Pick<ReturnType<typeof getKstDateParts>, "year" | "month" | "day">,
  right: Pick<ReturnType<typeof getKstDateParts>, "year" | "month" | "day">
) {
  const leftValue = Date.UTC(left.year, left.month - 1, left.day);
  const rightValue = Date.UTC(right.year, right.month - 1, right.day);
  return leftValue - rightValue;
}

export function toKstDate(baseDate: Date = new Date()) {
  const parts = getKstDateParts(baseDate);
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond
  );
}

export function toKstDateKey(baseDate: Date) {
  const parts = getKstDateParts(baseDate);
  return `${parts.year}-${padNumber(parts.month)}-${padNumber(parts.day)}`;
}

function isWeekendCompetitionDate(date: Date) {
  const dayOfWeek = getKstDateParts(date).dayOfWeek;
  return dayOfWeek === 0 || dayOfWeek === 6;
}

function getCompetitionStartHour(targetDate: Date) {
  return isWeekendCompetitionDate(targetDate) ? WEEKEND_DAILY_RANK_START_HOUR : WEEKDAY_DAILY_RANK_START_HOUR;
}

function buildCompetitionWindow(targetDate: Date) {
  const parts = getKstDateParts(targetDate);
  const nextDayParts = shiftKstDateParts(parts, 1);
  const competitionDate = dateFromKstParts(parts.year, parts.month, parts.day);
  const startsAt = dateFromKstParts(parts.year, parts.month, parts.day, getCompetitionStartHour(competitionDate));
  const endsAt = dateFromKstParts(nextDayParts.year, nextDayParts.month, nextDayParts.day, DAILY_RANK_END_HOUR);

  return {
    competitionDate,
    startsAt,
    endsAt,
    awardsAt: addMinutes(endsAt, DAILY_RANK_REWARD_DELAY_MINUTES),
  };
}

export function getDailyRankCompetitionWindow(targetDate: Date) {
  const window = buildCompetitionWindow(targetDate);
  return {
    ...window,
    competitionDateKey: toKstDateKey(window.competitionDate),
    coveredDateKeys: getDateKeysCoveredByWindow(window.startsAt, window.endsAt),
  };
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function shiftDate(date: Date, days: number) {
  const parts = getKstDateParts(date);
  const shifted = shiftKstDateParts(parts, days);
  return dateFromKstParts(
    shifted.year,
    shifted.month,
    shifted.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond
  );
}

function buildRelativeOpenLabel(nowKst: Date, opensAt: Date) {
  const nowParts = getKstDateParts(nowKst);
  const openParts = getKstDateParts(opensAt);
  const dateGap = Math.round(
    (Date.UTC(openParts.year, openParts.month - 1, openParts.day) - Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day)) / DAY_MS
  );
  const dayLabel = dateGap <= 0 ? "오늘" : dateGap === 1 ? "내일" : `${openParts.month}/${openParts.day}`;
  return `${dayLabel} ${padNumber(openParts.hour)}:${padNumber(openParts.minute)}`;
}

function getDateKeysCoveredByWindow(startsAt: Date, endsAt: Date) {
  const keys: string[] = [];
  let cursorParts = getKstDateParts(startsAt);
  const lastIncludedParts = getKstDateParts(new Date(endsAt.getTime() - 1));

  while (compareKstDateParts(cursorParts, lastIncludedParts) <= 0) {
    keys.push(`${cursorParts.year}-${padNumber(cursorParts.month)}-${padNumber(cursorParts.day)}`);
    cursorParts = {
      ...cursorParts,
      ...shiftKstDateParts(cursorParts, 1),
    };
  }

  return keys;
}

export function startOfKstWeekDate(baseDate: Date) {
  const parts = getKstDateParts(baseDate);
  const diff = parts.dayOfWeek === 0 ? -6 : 1 - parts.dayOfWeek;
  const weekStart = shiftKstDateParts(parts, diff);
  return dateFromKstParts(weekStart.year, weekStart.month, weekStart.day);
}

export function startOfKstMonthDate(baseDate: Date) {
  const parts = getKstDateParts(baseDate);
  return dateFromKstParts(parts.year, parts.month, 1);
}

export function eachKstDateOfInterval(startDate: Date, endDate: Date) {
  const dates: Date[] = [];
  let cursorParts = getKstDateParts(startDate);
  const endParts = getKstDateParts(endDate);

  while (compareKstDateParts(cursorParts, endParts) <= 0) {
    dates.push(dateFromKstParts(cursorParts.year, cursorParts.month, cursorParts.day));
    cursorParts = {
      ...cursorParts,
      ...shiftKstDateParts(cursorParts, 1),
    };
  }

  return dates;
}

export function getDailyRankWindowLabel() {
  return "평일 17:00~01:00 · 토/일 08:00~01:00";
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
  const todayWindow = getDailyRankCompetitionWindow(baseDate);
  const previousWindow = getDailyRankCompetitionWindow(shiftDate(baseDate, -1));
  const nextWindow = getDailyRankCompetitionWindow(shiftDate(baseDate, 1));

  const isPreviousWindowLive = baseDate >= previousWindow.startsAt && baseDate < previousWindow.endsAt;
  const isPreviousWindowSettlementPending = baseDate >= previousWindow.endsAt && baseDate < previousWindow.awardsAt;
  const isTodayWindowLive = baseDate >= todayWindow.startsAt && baseDate < todayWindow.endsAt;
  const activeWindow = isPreviousWindowLive || isPreviousWindowSettlementPending
    ? previousWindow
    : isTodayWindowLive
      ? todayWindow
      : todayWindow;
  const nextOpensAt = isPreviousWindowLive || isPreviousWindowSettlementPending || isTodayWindowLive
    ? nextWindow.startsAt
    : baseDate < todayWindow.startsAt
      ? todayWindow.startsAt
      : nextWindow.startsAt;

  return {
    nowKst,
    isLive: isPreviousWindowLive || isTodayWindowLive,
    isSettlementPending: isPreviousWindowSettlementPending,
    competitionDate: activeWindow.competitionDate,
    competitionDateKey: activeWindow.competitionDateKey,
    startsAt: activeWindow.startsAt,
    endsAt: activeWindow.endsAt,
    awardsAt: activeWindow.awardsAt,
    coveredDateKeys: activeWindow.coveredDateKeys,
    nextOpensAt,
    nextOpensAtLabel: buildRelativeOpenLabel(baseDate, nextOpensAt),
    windowLabel: getDailyRankWindowLabel(),
  };
}
