import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const region = "asia-northeast3";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

type StudentRankingRange = "daily" | "weekly" | "monthly";

type DailyPointEventDoc = {
  id: string;
  source: "study_box" | "daily_rank" | "weekly_rank" | "monthly_rank" | "plan_completion" | "manual_adjustment" | "legacy";
  label: string;
  points: number;
  createdAt: string;
  range?: StudentRankingRange;
  rank?: number;
  periodKey?: string;
  awardDateKey?: string;
  paidAt?: string;
  deltaPoints?: number;
  direction?: "add" | "subtract";
  reason?: string;
};

type StudentRankRewardTier = {
  rank: number;
  points: number;
};

type StudentProfileSnapshot = {
  displayNameSnapshot: string;
  classNameSnapshot: string | null;
  schoolNameSnapshot: string | null;
};

type RankedStudentEntry = StudentProfileSnapshot & {
  studentId: string;
  value: number;
  rank: number;
  points: number;
};

type CenterStudentContext = {
  includedStudentIds: string[];
  shouldInclude: (studentId: string) => boolean;
  getProfile: (studentId: string) => StudentProfileSnapshot;
};

type DailyRankAwardCancellation = {
  studentId: string;
  cancelledPoints: number;
  balanceDeduction: number;
  balanceDeficit: number;
  pointsBalance: number;
  totalPointsEarned: number;
  dailyPointAmount: number;
};

type RankingNotificationTarget = {
  periodKey: string;
  awardDateKey: string;
};

const WEEKDAY_DAILY_RANK_START_HOUR = 17;
const WEEKEND_DAILY_RANK_START_HOUR = 8;
const DAILY_RANK_END_HOUR = 1;
const DAILY_RANK_REWARD_DELAY_MINUTES = 5;
const ACTIVE_LIVE_RANK_STATUSES = new Set(["studying"]);
const MONTHLY_RANK_REWARD_FIRST_ELIGIBLE_PERIOD_KEY = "2026-05";
const MONTHLY_RANK_REWARD_PRELAUNCH_SKIP_REASON = "monthly_rank_rewards_start_from_2026_05";
const RANKING_ENGINE_VERSION = "v2";
const DEFAULT_DAILY_RANK_REISSUE_DATE_KEY = "2026-04-26";

const STUDENT_RANK_REWARD_TIERS: Record<StudentRankingRange, StudentRankRewardTier[]> = {
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
const DAILY_POINT_EARN_CAP = 1000;
const RANKING_RANGE_LABEL: Record<StudentRankingRange, string> = {
  daily: "일간",
  weekly: "주간",
  monthly: "월간",
};

function toKstDate(baseDate: Date = new Date()) {
  const formatted = baseDate.toLocaleString("en-US", { timeZone: "Asia/Seoul" });
  return new Date(formatted);
}

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}`;
}

function cloneDate(date: Date) {
  return new Date(date.getTime());
}

function startOfKstDay(date: Date) {
  const next = cloneDate(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function shiftKstDate(date: Date, days: number) {
  const next = cloneDate(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function startOfKstWeek(date: Date) {
  const next = startOfKstDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function startOfKstMonth(date: Date) {
  const next = startOfKstDay(date);
  next.setDate(1);
  return next;
}

function normalizeMembershipStatus(value: unknown) {
  if (typeof value !== "string") return "active";
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!normalized || normalized === "active" || normalized === "approved" || normalized === "enabled" || normalized === "current") {
    return "active";
  }
  if (normalized === "onhold" || normalized === "pending") return "onHold";
  if (normalized === "inactive" || normalized === "withdrawn") return "withdrawn";
  return "active";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function asNonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDailyPointEventEntry(value: unknown): DailyPointEventDoc | null {
  if (!isPlainObject(value)) return null;

  const id = asNonEmptyString(value.id);
  const source = asNonEmptyString(value.source) as DailyPointEventDoc["source"];
  const label = asNonEmptyString(value.label);
  const points = Math.max(0, Math.floor(parseFiniteNumber(value.points) ?? 0));
  const createdAt = asNonEmptyString(value.createdAt);

  if (!id || !source || !label || points <= 0 || !createdAt) return null;
  if (!["study_box", "daily_rank", "weekly_rank", "monthly_rank", "plan_completion", "manual_adjustment", "legacy"].includes(source)) {
    return null;
  }

  const event: DailyPointEventDoc = {
    id,
    source,
    label,
    points,
    createdAt,
  };

  const range = asNonEmptyString(value.range);
  if (range === "daily" || range === "weekly" || range === "monthly") event.range = range;

  const rank = Math.max(0, Math.floor(parseFiniteNumber(value.rank) ?? 0));
  if (rank > 0) event.rank = rank;

  const periodKey = asNonEmptyString(value.periodKey);
  if (periodKey) event.periodKey = periodKey;

  const awardDateKey = asNonEmptyString(value.awardDateKey);
  if (awardDateKey) event.awardDateKey = awardDateKey;

  const paidAt = asNonEmptyString(value.paidAt);
  if (paidAt) event.paidAt = paidAt;

  const deltaPoints = Math.round(parseFiniteNumber(value.deltaPoints) ?? Number.NaN);
  if (Number.isFinite(deltaPoints) && deltaPoints !== 0) {
    event.deltaPoints = deltaPoints;
  }

  const direction = asNonEmptyString(value.direction);
  if (direction === "add" || direction === "subtract") {
    event.direction = direction;
  }

  const reason = asNonEmptyString(value.reason);
  if (reason) event.reason = reason.slice(0, 160);

  return event;
}

function normalizeDailyPointEvents(value: unknown): DailyPointEventDoc[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeDailyPointEventEntry(entry))
    .filter((entry): entry is DailyPointEventDoc => entry !== null)
    .slice(-80);
}

function upsertDailyPointEvent(existing: unknown, event: DailyPointEventDoc): DailyPointEventDoc[] {
  const next = new Map<string, DailyPointEventDoc>();
  normalizeDailyPointEvents(existing).forEach((entry) => {
    next.set(entry.id, entry);
  });
  next.set(event.id, event);
  return Array.from(next.values()).slice(-80);
}

function normalizeStudyBoxHoursFromUnknown(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => {
          if (typeof entry === "number") return entry;
          if (typeof entry === "string") {
            const trimmed = entry.trim().toLowerCase();
            if (!trimmed) return Number.NaN;
            const legacyMatch = trimmed.match(/^(\d+)\s*(?:h|시간)$/);
            return Number(legacyMatch?.[1] ?? trimmed);
          }
          return Number.NaN;
        })
        .filter((entry) => Number.isFinite(entry) && entry >= 1 && entry <= 8)
        .map((entry) => Math.round(entry))
    )
  ).sort((a, b) => a - b);
}

function getStudyBoxRewardPointByHour(dayStatus: Record<string, unknown>): Map<number, number> {
  const rewardByHour = new Map<number, number>();
  if (!Array.isArray(dayStatus.studyBoxRewards)) return rewardByHour;

  dayStatus.studyBoxRewards.forEach((entry) => {
    if (!isPlainObject(entry)) return;
    const milestone = Math.round(parseFiniteNumber(entry.milestone) ?? Number.NaN);
    if (!Number.isFinite(milestone) || milestone < 1 || milestone > 8) return;
    rewardByHour.set(milestone, Math.max(0, Math.floor(parseFiniteNumber(entry.awardedPoints) ?? 0)));
  });

  return rewardByHour;
}

function resolveOpenedStudyBoxHoursFromDayStatus(dayStatus: Record<string, unknown>): number[] {
  const explicitOpenedStudyBoxes = normalizeStudyBoxHoursFromUnknown(dayStatus.openedStudyBoxes);
  const claimedStudyBoxes = normalizeStudyBoxHoursFromUnknown(dayStatus.claimedStudyBoxes);

  if (claimedStudyBoxes.length === 0) return explicitOpenedStudyBoxes;

  const rewardByHour = getStudyBoxRewardPointByHour(dayStatus);
  if (explicitOpenedStudyBoxes.some((hour) => !rewardByHour.has(hour))) {
    return explicitOpenedStudyBoxes;
  }

  const persistedDailyPointAmount = Math.max(0, Math.floor(parseFiniteNumber(dayStatus.dailyPointAmount) ?? 0));
  const studyBoxAwardedPoints = Math.max(0, persistedDailyPointAmount - getRankRewardAwardTotal(dayStatus));
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

  return normalizeStudyBoxHoursFromUnknown([...explicitOpenedStudyBoxes, ...missingClaimedStudyBoxes]);
}

function getOpenedStudyBoxAwardTotal(dayStatus: Record<string, unknown>): number {
  const rewardByHour = getStudyBoxRewardPointByHour(dayStatus);
  return resolveOpenedStudyBoxHoursFromDayStatus(dayStatus).reduce(
    (total, hour) => total + (rewardByHour.get(hour) ?? 0),
    0
  );
}

function getLegacyDailyPointAwardTotal(dayStatus: Record<string, unknown>): number {
  const studyBoxPoints = getOpenedStudyBoxAwardTotal(dayStatus);
  const rankRewardPoints = getRankRewardAwardTotal(dayStatus);
  return studyBoxPoints + rankRewardPoints;
}

function getDailyAwardedPointTotal(dayStatus: Record<string, unknown>): number {
  const dailyPointAmount = Math.max(0, Math.floor(parseFiniteNumber(dayStatus.dailyPointAmount) ?? 0));
  if (hasManualPointAdjustment(dayStatus)) {
    return dailyPointAmount;
  }
  return Math.max(dailyPointAmount, getLegacyDailyPointAwardTotal(dayStatus));
}

function hasManualPointAdjustment(dayStatus: Record<string, unknown>): boolean {
  const manualAdjustmentPoints = Math.round(parseFiniteNumber(dayStatus.manualAdjustmentPoints) ?? 0);
  if (manualAdjustmentPoints !== 0) return true;
  return normalizeDailyPointEvents(dayStatus.pointEvents).some((entry) =>
    entry.source === "manual_adjustment" && Math.round(parseFiniteNumber(entry.deltaPoints) ?? 0) !== 0
  );
}

function getRankRewardAwardTotal(dayStatus: Record<string, unknown>) {
  const dailyRankRewardAmount = Math.max(
    Math.floor(parseFiniteNumber(dayStatus.dailyRankRewardAmount) ?? 0),
    Math.floor(parseFiniteNumber(dayStatus.dailyTopRewardAmount) ?? 0)
  );
  const weeklyRankRewardAmount = Math.max(0, Math.floor(parseFiniteNumber(dayStatus.weeklyRankRewardAmount) ?? 0));
  const monthlyRankRewardAmount = Math.max(0, Math.floor(parseFiniteNumber(dayStatus.monthlyRankRewardAmount) ?? 0));

  return Math.max(0, dailyRankRewardAmount) + weeklyRankRewardAmount + monthlyRankRewardAmount;
}

function clampDailyPointAward(dayStatus: Record<string, unknown>, requestedPoints: number) {
  const normalizedRequestedPoints = Math.max(0, Math.floor(requestedPoints));
  const currentAwardedTotal = getDailyAwardedPointTotal(dayStatus);
  const remainingPoints = Math.max(0, DAILY_POINT_EARN_CAP - currentAwardedTotal);
  const awardedPoints = Math.min(normalizedRequestedPoints, remainingPoints);

  return {
    awardedPoints,
    currentAwardedTotal,
    remainingPoints,
  };
}

function resolveRankingRewardAwardPoints(
  range: StudentRankingRange,
  dayStatus: Record<string, unknown>,
  requestedPoints: number
) {
  if (range === "daily") {
    return clampDailyPointAward(dayStatus, requestedPoints).awardedPoints;
  }

  return Math.max(0, Math.floor(requestedPoints));
}

function isSyntheticStudentId(studentId: unknown): boolean {
  if (typeof studentId !== "string") return true;
  const normalized = studentId.trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.startsWith("test-")
    || normalized.startsWith("seed-")
    || normalized.startsWith("mock-")
    || normalized.startsWith("counseling-demo-")
    || normalized.startsWith("demo-counseling-")
    || normalized.includes("dummy")
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function shouldExcludeFromCompetitionRecord(value: unknown, studentId?: unknown): boolean {
  if (isSyntheticStudentId(studentId)) return true;
  const record = asRecord(value);
  if (!record) return false;
  if (record.isCounselingDemo === true) return true;

  const accountKind = typeof record.accountKind === "string" ? record.accountKind.trim().toLowerCase() : "";
  if (accountKind === "counseling-demo" || accountKind === "counseling_demo") {
    return true;
  }

  const exclusions = asRecord(record.operationalExclusions);
  return exclusions?.rankings === true || exclusions?.competition === true;
}

function isWeekendCompetitionDate(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function getCompetitionStartHour(targetDate: Date) {
  return isWeekendCompetitionDate(targetDate) ? WEEKEND_DAILY_RANK_START_HOUR : WEEKDAY_DAILY_RANK_START_HOUR;
}

function buildCompetitionWindow(targetDate: Date) {
  const competitionDate = startOfKstDay(targetDate);
  const startsAt = cloneDate(competitionDate);
  startsAt.setHours(getCompetitionStartHour(competitionDate), 0, 0, 0);

  const endsAt = cloneDate(competitionDate);
  endsAt.setDate(endsAt.getDate() + 1);
  endsAt.setHours(DAILY_RANK_END_HOUR, 0, 0, 0);

  return {
    competitionDate,
    startsAt,
    endsAt,
    awardsAt: addMinutes(endsAt, DAILY_RANK_REWARD_DELAY_MINUTES),
  };
}

function getDateKeysCoveredByWindow(startsAt: Date, endsAt: Date) {
  const keys: string[] = [];
  const cursor = startOfKstDay(startsAt);
  const lastIncludedDate = startOfKstDay(new Date(endsAt.getTime() - 1));

  while (cursor.getTime() <= lastIncludedDate.getTime()) {
    keys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

function chunkItems<T>(items: T[], size: number) {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function getAttendanceStatusRank(value: unknown) {
  if (value === "studying") return 0;
  if (value === "away" || value === "break") return 1;
  if (value === "absent") return 3;
  return 2;
}

function toTimestampMillis(value: unknown) {
  if (value && typeof value === "object") {
    if ("toMillis" in value && typeof value.toMillis === "function") {
      return Number(value.toMillis());
    }
    if ("toDate" in value && typeof value.toDate === "function") {
      return value.toDate().getTime();
    }
  }
  if (value instanceof Date) return value.getTime();
  return 0;
}

function pickPreferredAttendanceRecord(records: Record<string, unknown>[]) {
  if (!records.length) return null;

  return [...records].sort((left, right) => {
    const statusRankDiff = getAttendanceStatusRank(left.status) - getAttendanceStatusRank(right.status);
    if (statusRankDiff !== 0) return statusRankDiff;

    const checkInPresenceDiff = Number(Boolean(right.lastCheckInAt)) - Number(Boolean(left.lastCheckInAt));
    if (checkInPresenceDiff !== 0) return checkInPresenceDiff;

    return toTimestampMillis(right.updatedAt) - toTimestampMillis(left.updatedAt);
  })[0] ?? null;
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

function getDailyWindowOverlapMinutes(
  startedAtMs: number,
  referenceMs: number,
  dailyWindow: Pick<ReturnType<typeof buildCompetitionWindow>, "startsAt" | "endsAt">
) {
  const overlapMs = getTimeRangeOverlapMs(
    startedAtMs,
    referenceMs,
    dailyWindow.startsAt.getTime(),
    dailyWindow.endsAt.getTime()
  );
  if (overlapMs <= 0) return 0;
  return Math.max(1, Math.ceil(overlapMs / 60000));
}

function getLiveAttendanceOverlapMinutes(
  attendance: Record<string, unknown>,
  referenceMs: number,
  dailyWindow: Pick<ReturnType<typeof buildCompetitionWindow>, "startsAt" | "endsAt">
) {
  const status = typeof attendance.status === "string" ? attendance.status : "";
  if (!ACTIVE_LIVE_RANK_STATUSES.has(status)) return 0;

  const startedAtMs = toTimestampMillis(attendance.lastCheckInAt);
  if (startedAtMs <= 0) return 0;

  return getDailyWindowOverlapMinutes(startedAtMs, referenceMs, dailyWindow);
}

function getSessionReferenceMillis(session: Record<string, unknown>) {
  const startedAtMs = toTimestampMillis(session.startTime);
  if (startedAtMs <= 0) {
    return {
      startedAtMs: 0,
      referenceMs: 0,
    };
  }

  const endedAtMs = toTimestampMillis(session.endTime);
  if (endedAtMs > startedAtMs) {
    return {
      startedAtMs,
      referenceMs: endedAtMs,
    };
  }

  const rawDurationMinutes = Number(session.durationMinutes ?? 0);
  const durationMinutes = Number.isFinite(rawDurationMinutes) ? Math.max(0, Math.round(rawDurationMinutes)) : 0;
  return {
    startedAtMs,
    referenceMs: durationMinutes > 0 ? startedAtMs + durationMinutes * 60000 : 0,
  };
}

function buildStudentDateRankKey(studentId: string, dateKey: string) {
  return `${studentId}\u001f${dateKey}`;
}

function addRankMinutesByDate(target: Map<string, number>, studentId: string, dateKey: string, minutes: number) {
  if (!studentId || !dateKey || minutes <= 0) return;
  const key = buildStudentDateRankKey(studentId, dateKey);
  target.set(key, (target.get(key) || 0) + minutes);
}

function foldRankMinutesByDate(source: Map<string, number>) {
  const totals = new Map<string, number>();

  source.forEach((minutes, compositeKey) => {
    const separatorIndex = compositeKey.indexOf("\u001f");
    const studentId = separatorIndex >= 0 ? compositeKey.slice(0, separatorIndex) : compositeKey;
    if (!studentId || minutes <= 0) return;
    totals.set(studentId, (totals.get(studentId) || 0) + minutes);
  });

  return totals;
}

function getStudyLogDayStudentId(
  docSnap: FirebaseFirestore.DocumentSnapshot,
  data: Record<string, unknown>
) {
  const directStudentId = typeof data.studentId === "string" && data.studentId.trim()
    ? data.studentId.trim()
    : "";
  return directStudentId || docSnap.ref.parent.parent?.id || "";
}

function getStudyLogDayDateKey(
  docSnap: FirebaseFirestore.DocumentSnapshot,
  data: Record<string, unknown>
) {
  return typeof data.dateKey === "string" && data.dateKey.trim()
    ? data.dateKey.trim()
    : docSnap.id;
}

function applyCompetitionRanks<T extends { value: number }>(entries: T[]): Array<T & { rank: number }> {
  const sorted = [...entries].sort((left, right) => right.value - left.value);
  let lastValue: number | null = null;
  let currentRank = 0;

  return sorted.map((entry, index) => {
    if (lastValue === null || entry.value < lastValue) {
      currentRank = index + 1;
      lastValue = entry.value;
    }

    return {
      ...entry,
      rank: currentRank,
    };
  });
}

async function loadCenterStudentContext(
  db: admin.firestore.Firestore,
  centerId: string
): Promise<CenterStudentContext> {
  const [membersSnap, studentsSnap] = await Promise.all([
    db.collection(`centers/${centerId}/members`).where("role", "==", "student").get(),
    db.collection(`centers/${centerId}/students`).get(),
  ]);

  const studentProfiles = new Map<string, StudentProfileSnapshot>();
  const excludedStudentIds = new Set<string>();
  studentsSnap.forEach((docSnap) => {
    const studentId = docSnap.id;
    if (isSyntheticStudentId(studentId)) return;

    const data = docSnap.data() as Record<string, unknown>;
    if (shouldExcludeFromCompetitionRecord(data, studentId)) {
      excludedStudentIds.add(studentId);
      return;
    }
    studentProfiles.set(studentId, {
      displayNameSnapshot: typeof data.name === "string" && data.name.trim()
        ? data.name.trim()
        : typeof data.displayName === "string" && data.displayName.trim()
          ? data.displayName.trim()
          : "학생",
      classNameSnapshot: typeof data.className === "string" && data.className.trim()
        ? data.className.trim()
        : null,
      schoolNameSnapshot: typeof data.schoolName === "string" && data.schoolName.trim()
        ? data.schoolName.trim()
        : null,
    });
  });

  const memberProfiles = new Map<string, StudentProfileSnapshot>();
  const activeStudentIds = new Set<string>();

  membersSnap.forEach((docSnap) => {
    const studentId = docSnap.id;
    if (isSyntheticStudentId(studentId)) return;

    const data = docSnap.data() as Record<string, unknown>;
    if (shouldExcludeFromCompetitionRecord(data, studentId)) {
      excludedStudentIds.add(studentId);
      return;
    }
    if (normalizeMembershipStatus(data.status) !== "active") return;

    activeStudentIds.add(studentId);
    const studentProfile = studentProfiles.get(studentId);
    memberProfiles.set(studentId, {
      displayNameSnapshot: typeof data.displayName === "string" && data.displayName.trim()
        ? data.displayName.trim()
        : studentProfile?.displayNameSnapshot || "학생",
      classNameSnapshot: typeof data.className === "string" && data.className.trim()
        ? data.className.trim()
        : studentProfile?.classNameSnapshot || null,
      schoolNameSnapshot: typeof data.schoolName === "string" && data.schoolName.trim()
        ? data.schoolName.trim()
        : typeof data.schoolNameSnapshot === "string" && data.schoolNameSnapshot.trim()
          ? data.schoolNameSnapshot.trim()
          : studentProfile?.schoolNameSnapshot || null,
    });
  });

  const includedStudentIds = Array.from(new Set([
    ...studentProfiles.keys(),
    ...activeStudentIds,
  ])).filter((studentId) =>
    !excludedStudentIds.has(studentId) && (activeStudentIds.size === 0 || activeStudentIds.has(studentId))
  );

  return {
    includedStudentIds,
    shouldInclude: (studentId: string) =>
      !excludedStudentIds.has(studentId) && (activeStudentIds.size === 0 || activeStudentIds.has(studentId)),
    getProfile: (studentId: string) =>
      memberProfiles.get(studentId)
      || studentProfiles.get(studentId)
      || {
        displayNameSnapshot: "학생",
        classNameSnapshot: null,
        schoolNameSnapshot: null,
      },
  };
}

function buildAwardEntries(
  range: StudentRankingRange,
  rankedEntries: Array<{
    studentId: string;
    value: number;
    rank: number;
    profile: StudentProfileSnapshot;
  }>
): RankedStudentEntry[] {
  return rankedEntries
    .map((entry) => {
      const points = STUDENT_RANK_REWARD_TIERS[range].find((tier) => tier.rank === entry.rank)?.points ?? 0;
      if (points <= 0) return null;

      return {
        studentId: entry.studentId,
        value: entry.value,
        rank: entry.rank,
        points,
        ...entry.profile,
      };
    })
    .filter((entry): entry is RankedStudentEntry => Boolean(entry));
}

function formatDateKeyLabel(dateKey?: string | null) {
  if (!dateKey) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  if (!match) return null;

  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  return `${month}월 ${day}일`;
}

function formatMonthKeyLabel(monthKey?: string | null) {
  if (!monthKey) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  return `${year}년 ${month}월`;
}

function isMonthlyRankRewardEligiblePeriod(periodKey: string) {
  return periodKey >= MONTHLY_RANK_REWARD_FIRST_ELIGIBLE_PERIOD_KEY;
}

function buildRankingRewardPeriodLabel(range: StudentRankingRange, periodKey?: string | null, awardDateKey?: string | null) {
  if (range === "daily") {
    return formatDateKeyLabel(periodKey || awardDateKey);
  }

  if (range === "weekly") {
    const [startKey, endKey] = (periodKey || "").split("_");
    const startLabel = formatDateKeyLabel(startKey);
    const endLabel = formatDateKeyLabel(endKey);
    if (startLabel && endLabel) return `${startLabel}~${endLabel}`;
    return startLabel || endLabel || null;
  }

  if (range === "monthly") {
    return formatMonthKeyLabel(periodKey);
  }

  return null;
}

function buildRankingRewardNotificationTitle(
  range: StudentRankingRange,
  rank: number,
  periodKey?: string | null,
  awardDateKey?: string | null
) {
  const rangeLabel = RANKING_RANGE_LABEL[range];
  const periodLabel = buildRankingRewardPeriodLabel(range, periodKey, awardDateKey);
  const baseLabel = `${rangeLabel} 랭킹 ${rank}위 축하`;
  return periodLabel ? `${periodLabel} ${baseLabel}` : baseLabel;
}

function buildRankingRewardNotificationMessageWithPeriod(
  range: StudentRankingRange,
  award: RankedStudentEntry,
  periodKey?: string | null,
  awardDateKey?: string | null
) {
  const rangeLabel = RANKING_RANGE_LABEL[range];
  const periodLabel = buildRankingRewardPeriodLabel(range, periodKey, awardDateKey);
  const rewardLabel = `${rangeLabel} 랭킹 ${award.rank}위로 ${award.points.toLocaleString()}포인트가 지급되었어요.`;
  return periodLabel
    ? `${periodLabel} ${rewardLabel} 알림함에서 다시 확인할 수 있습니다.`
    : `${rewardLabel} 알림함에서 다시 확인할 수 있습니다.`;
}

async function buildDailyAwardEntries(
  db: admin.firestore.Firestore,
  centerId: string,
  competitionDate: Date,
  context: CenterStudentContext
) {
  const dailyWindow = buildCompetitionWindow(competitionDate);
  const dailyDateKeys = getDateKeysCoveredByWindow(dailyWindow.startsAt, dailyWindow.endsAt);
  const dayRefs = context.includedStudentIds.flatMap((studentId) =>
    dailyDateKeys.map((dateKey) => db.doc(`centers/${centerId}/studyLogs/${studentId}/days/${dateKey}`))
  );
  const dailyDayDocs: FirebaseFirestore.DocumentSnapshot[] = [];
  for (const chunk of chunkItems(dayRefs, 350)) {
    if (chunk.length === 0) continue;
    const chunkSnapshots = await db.getAll(...chunk);
    dailyDayDocs.push(...chunkSnapshots);
  }

  const sessionRequests = dailyDayDocs.flatMap((docSnap) => {
    if (!docSnap.exists) return [];

    const data = docSnap.data() as Record<string, unknown>;
    const studentId = getStudyLogDayStudentId(docSnap, data);
    const dateKey = getStudyLogDayDateKey(docSnap, data);

    if (!studentId || !dateKey || isSyntheticStudentId(studentId) || !context.shouldInclude(studentId)) return [];

    return [{
      studentId,
      dateKey,
      snapshotRef: docSnap.ref.collection("sessions"),
    }];
  });

  const minutesByStudentDate = new Map<string, number>();
  for (const chunk of chunkItems(sessionRequests, 40)) {
    if (chunk.length === 0) continue;
    const chunkSnapshots = await Promise.all(chunk.map(({ snapshotRef }) => snapshotRef.get()));
    chunkSnapshots.forEach((snapshot, index) => {
      const fallbackStudentId = chunk[index]?.studentId ?? "";
      const fallbackDateKey = chunk[index]?.dateKey ?? "";
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const studentId = typeof data.studentId === "string" && data.studentId.trim()
          ? data.studentId.trim()
          : fallbackStudentId;
        const dateKey = typeof data.dateKey === "string" && data.dateKey.trim()
          ? data.dateKey.trim()
          : fallbackDateKey;
        const { startedAtMs, referenceMs } = getSessionReferenceMillis(data);
        const value = getDailyWindowOverlapMinutes(startedAtMs, referenceMs, dailyWindow);

        if (!studentId || !dateKey || isSyntheticStudentId(studentId) || !context.shouldInclude(studentId) || value <= 0) return;
        addRankMinutesByDate(minutesByStudentDate, studentId, dateKey, value);
      });
    });
  }

  const totals = foldRankMinutesByDate(minutesByStudentDate);

  const attendanceBuckets = new Map<string, Record<string, unknown>[]>();
  const attendanceSnap = await db.collection(`centers/${centerId}/attendanceCurrent`).get();
  attendanceSnap.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const studentId = typeof data.studentId === "string" ? data.studentId : "";
    if (!studentId || isSyntheticStudentId(studentId) || !context.shouldInclude(studentId)) return;

    const current = attendanceBuckets.get(studentId) || [];
    current.push(data);
    attendanceBuckets.set(studentId, current);
  });

  attendanceBuckets.forEach((records, studentId) => {
    const selectedRecord = pickPreferredAttendanceRecord(records);
    if (!selectedRecord) return;

    const liveMinutes = getLiveAttendanceOverlapMinutes(
      selectedRecord,
      dailyWindow.endsAt.getTime(),
      dailyWindow
    );
    if (liveMinutes <= 0) return;

    totals.set(studentId, (totals.get(studentId) || 0) + liveMinutes);
  });

  const rankedEntries = applyCompetitionRanks(
    Array.from(totals.entries()).map(([studentId, value]) => ({
      studentId,
      value,
      profile: context.getProfile(studentId),
    }))
  );

  return buildAwardEntries("daily", rankedEntries);
}

async function buildWeeklyAwardEntries(
  db: admin.firestore.Firestore,
  centerId: string,
  startDate: Date,
  endDate: Date,
  context: CenterStudentContext
) {
  const dateKeys: string[] = [];
  let cursor = startOfKstDay(startDate);
  const inclusiveEnd = startOfKstDay(endDate);

  while (cursor.getTime() <= inclusiveEnd.getTime()) {
    dateKeys.push(toDateKey(cursor));
    cursor = shiftKstDate(cursor, 1);
  }

  const snapshots = await Promise.all(
    dateKeys.map((dateKey) => db.collection(`centers/${centerId}/dailyStudentStats/${dateKey}/students`).get())
  );

  const totals = new Map<string, number>();
  snapshots.forEach((snapshot) => {
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const studentId = typeof data.studentId === "string" ? data.studentId : docSnap.id;
      const baseValue = Number(data.totalStudyMinutes ?? 0);
      const adjustment = Number(data.manualAdjustmentMinutes ?? 0);
      const value = Math.max(0, (Number.isFinite(baseValue) ? baseValue : 0) + (Number.isFinite(adjustment) ? adjustment : 0));
      if (!studentId || isSyntheticStudentId(studentId) || !context.shouldInclude(studentId) || value <= 0) return;
      totals.set(studentId, (totals.get(studentId) || 0) + value);
    });
  });

  const rankedEntries = applyCompetitionRanks(
    Array.from(totals.entries()).map(([studentId, value]) => ({
      studentId,
      value,
      profile: context.getProfile(studentId),
    }))
  );

  return buildAwardEntries("weekly", rankedEntries);
}

async function buildMonthlyAwardEntries(
  db: admin.firestore.Firestore,
  centerId: string,
  monthKey: string,
  context: CenterStudentContext
) {
  const monthlySnap = await db.collection(`centers/${centerId}/leaderboards/${monthKey}_study-time/entries`).get();

  const rankedEntries = applyCompetitionRanks(
    monthlySnap.docs
      .map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const studentId = typeof data.studentId === "string" ? data.studentId : docSnap.id;
        const value = Math.max(0, Number(data.value ?? 0));
        if (!studentId || isSyntheticStudentId(studentId) || !context.shouldInclude(studentId) || value <= 0) return null;

        const profile = context.getProfile(studentId);
        return {
          studentId,
          value,
          profile: {
            displayNameSnapshot: typeof data.displayNameSnapshot === "string" && data.displayNameSnapshot.trim()
              ? data.displayNameSnapshot.trim()
              : profile.displayNameSnapshot,
            classNameSnapshot: typeof data.classNameSnapshot === "string" && data.classNameSnapshot.trim()
              ? data.classNameSnapshot.trim()
              : profile.classNameSnapshot,
            schoolNameSnapshot: typeof data.schoolNameSnapshot === "string" && data.schoolNameSnapshot.trim()
              ? data.schoolNameSnapshot.trim()
              : profile.schoolNameSnapshot,
          },
        };
      })
      .filter((entry): entry is { studentId: string; value: number; profile: StudentProfileSnapshot } => Boolean(entry))
  );

  return buildAwardEntries("monthly", rankedEntries);
}

async function claimSettlement(
  db: admin.firestore.Firestore,
  settlementRef: admin.firestore.DocumentReference,
  now: Date,
  payload: Record<string, unknown>
) {
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(settlementRef);
    const data = snapshot.data() as Record<string, unknown> | undefined;
    const status = typeof data?.status === "string" ? data.status : "";
    const leaseUntil = data?.leaseUntil instanceof admin.firestore.Timestamp ? data.leaseUntil.toDate() : null;

    if (status === "completed") {
      return false;
    }

    if (status === "processing" && leaseUntil && leaseUntil.getTime() > now.getTime()) {
      return false;
    }

    transaction.set(settlementRef, {
      ...payload,
      status: "processing",
      leaseUntil: admin.firestore.Timestamp.fromMillis(now.getTime() + 9 * 60 * 1000),
      processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return true;
  });
}

async function completeSettlement(
  settlementRef: admin.firestore.DocumentReference,
  payload: Record<string, unknown>
) {
  await settlementRef.set({
    ...payload,
    status: "completed",
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function failSettlement(
  settlementRef: admin.firestore.DocumentReference,
  error: unknown
) {
  await settlementRef.set({
    status: "failed",
    lastError: error instanceof Error ? error.message : String(error),
    failedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function applyAwardEntries(
  db: admin.firestore.Firestore,
  centerId: string,
  range: StudentRankingRange,
  target: RankingNotificationTarget,
  awards: RankedStudentEntry[]
) {
  if (awards.length === 0) return [] as RankedStudentEntry[];

  const appliedAwards: RankedStudentEntry[] = [];

  for (const award of awards) {
    const progressRef = db.doc(`centers/${centerId}/growthProgress/${award.studentId}`);
    const appliedAward = await db.runTransaction(async (transaction) => {
      const progressSnap = await transaction.get(progressRef);
      const progressData = progressSnap.exists ? (progressSnap.data() as Record<string, unknown>) : {};
      const dailyPointStatus = isPlainObject(progressData.dailyPointStatus)
        ? (progressData.dailyPointStatus as Record<string, unknown>)
        : {};
      const currentDayStatus = isPlainObject(dailyPointStatus[target.awardDateKey])
        ? (dailyPointStatus[target.awardDateKey] as Record<string, unknown>)
        : {};
      const awardedPoints = resolveRankingRewardAwardPoints(range, currentDayStatus, award.points);
      const pointStatusPayload: Record<string, unknown> = {
        ...currentDayStatus,
        dailyPointAmount: admin.firestore.FieldValue.increment(awardedPoints),
      };

      if (range === "daily") {
        pointStatusPayload.dailyRankRewardAmount = awardedPoints;
        pointStatusPayload.dailyRankRewardRank = award.rank;
        pointStatusPayload.dailyTopRewardAmount = awardedPoints;
      } else if (range === "weekly") {
        pointStatusPayload.weeklyRankRewardAmount = awardedPoints;
        pointStatusPayload.weeklyRankRewardRank = award.rank;
      } else {
        pointStatusPayload.monthlyRankRewardAmount = awardedPoints;
        pointStatusPayload.monthlyRankRewardRank = award.rank;
      }

      if (awardedPoints > 0) {
        const source = `${range}_rank` as DailyPointEventDoc["source"];
        const paidAt = new Date().toISOString();
        pointStatusPayload.pointEvents = upsertDailyPointEvent(currentDayStatus.pointEvents, {
          id: `rank:${range}:${target.periodKey}:${award.rank}`,
          source,
          label: `${RANKING_RANGE_LABEL[range]} 랭킹 ${award.rank}위`,
          points: awardedPoints,
          createdAt: paidAt,
          range,
          rank: award.rank,
          periodKey: target.periodKey,
          awardDateKey: target.awardDateKey,
          paidAt,
        });
      } else {
        pointStatusPayload.pointEvents = normalizeDailyPointEvents(currentDayStatus.pointEvents);
      }

      transaction.set(progressRef, {
        pointsBalance: admin.firestore.FieldValue.increment(awardedPoints),
        totalPointsEarned: admin.firestore.FieldValue.increment(awardedPoints),
        dailyPointStatus: {
          [target.awardDateKey]: pointStatusPayload,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      if (awardedPoints > 0) {
        const notificationRef = db.doc(
          `centers/${centerId}/studentNotifications/ranking_reward_${range}_${target.periodKey}_${award.studentId}`
        );
        transaction.set(notificationRef, {
          centerId,
          studentId: award.studentId,
          teacherId: "ranking-system",
          teacherName: "랭킹 시스템",
          type: "ranking_reward",
          title: buildRankingRewardNotificationTitle(range, award.rank, target.periodKey, target.awardDateKey),
          message: buildRankingRewardNotificationMessageWithPeriod(
            range,
            { ...award, points: awardedPoints },
            target.periodKey,
            target.awardDateKey
          ),
          rankingRange: range,
          rankingRank: award.rank,
          rankingRewardPoints: awardedPoints,
          rankingPeriodKey: target.periodKey,
          awardDateKey: target.awardDateKey,
          readAt: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      return {
        ...award,
        points: awardedPoints,
      };
    });

    appliedAwards.push(appliedAward);
  }

  return appliedAwards;
}

function getDailySettlementCandidates(nowKst: Date, lookbackDays = 7) {
  const candidates: Array<{ periodKey: string; competitionDate: Date; windowStartsAt: Date; windowEndsAt: Date; awardsAt: Date }> = [];

  for (let index = 1; index <= lookbackDays; index += 1) {
    const competitionDate = shiftKstDate(startOfKstDay(nowKst), -index);
    const window = buildCompetitionWindow(competitionDate);
    if (nowKst.getTime() < window.awardsAt.getTime()) continue;

    candidates.push({
      periodKey: toDateKey(competitionDate),
      competitionDate,
      windowStartsAt: window.startsAt,
      windowEndsAt: window.endsAt,
      awardsAt: window.awardsAt,
    });
  }

  return candidates;
}

function buildRankingRewardAwardTime(periodEndDate: Date) {
  const awardAt = shiftKstDate(startOfKstDay(periodEndDate), 1);
  awardAt.setHours(1, DAILY_RANK_REWARD_DELAY_MINUTES, 0, 0);
  return awardAt;
}

function getWeeklySettlementCandidate(nowKst: Date) {
  const currentWeekStart = startOfKstWeek(nowKst);
  const startDate = shiftKstDate(currentWeekStart, -7);
  const endDate = shiftKstDate(currentWeekStart, -1);
  const awardsAt = buildRankingRewardAwardTime(endDate);
  if (nowKst.getTime() < awardsAt.getTime()) {
    return null;
  }

  return {
    periodKey: `${toDateKey(startDate)}_${toDateKey(endDate)}`,
    startDate,
    endDate,
    awardsAt,
  };
}

function getMonthlySettlementCandidate(nowKst: Date) {
  const currentMonthStart = startOfKstMonth(nowKst);
  const previousMonthStart = cloneDate(currentMonthStart);
  previousMonthStart.setMonth(previousMonthStart.getMonth() - 1, 1);
  previousMonthStart.setHours(0, 0, 0, 0);
  const previousMonthEnd = shiftKstDate(currentMonthStart, -1);
  const awardsAt = buildRankingRewardAwardTime(previousMonthEnd);
  if (nowKst.getTime() < awardsAt.getTime()) {
    return null;
  }

  return {
    periodKey: toMonthKey(previousMonthStart),
    monthKey: toMonthKey(previousMonthStart),
    startDate: previousMonthStart,
    endDate: previousMonthEnd,
    awardsAt,
  };
}

function isValidDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map((part) => Number(part));
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
  );
}

function parseDateKeyAsKstDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function normalizeMembershipRoleValue(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized === "owner" || normalized === "admin" || normalized === "centermanager" || normalized === "centeradmin") {
    return "centerAdmin";
  }
  if (normalized === "teacher") return "teacher";
  if (normalized === "parent") return "parent";
  if (normalized === "student") return "student";
  return "";
}

function isAdminRole(value: unknown): boolean {
  return normalizeMembershipRoleValue(value) === "centerAdmin";
}

async function assertActiveCenterAdmin(
  db: admin.firestore.Firestore,
  centerId: string,
  uid: string
) {
  const [memberSnap, userCenterSnap] = await Promise.all([
    db.doc(`centers/${centerId}/members/${uid}`).get(),
    db.doc(`userCenters/${uid}/centers/${centerId}`).get(),
  ]);
  const memberData = memberSnap.exists ? (memberSnap.data() as Record<string, unknown>) : null;
  const userCenterData = userCenterSnap.exists ? (userCenterSnap.data() as Record<string, unknown>) : null;
  const memberRole = normalizeMembershipRoleValue(memberData?.role);
  const userCenterRole = normalizeMembershipRoleValue(userCenterData?.role);
  const memberIsActive = isAdminRole(memberRole) && normalizeMembershipStatus(memberData?.status) === "active";
  const userCenterIsActive = isAdminRole(userCenterRole) && normalizeMembershipStatus(userCenterData?.status) === "active";

  if (!memberIsActive && !userCenterIsActive) {
    throw new functions.https.HttpsError("permission-denied", "Only active center admins can reissue ranking rewards.", {
      userMessage: "센터 관리자만 랭킹 포인트 재정산을 실행할 수 있습니다.",
    });
  }
}

function isDailyRankEventForPeriod(event: DailyPointEventDoc, periodKey: string) {
  if (event.source !== "daily_rank") return false;
  if (event.periodKey && event.periodKey !== periodKey) return false;
  if (event.periodKey === periodKey) return true;
  return event.id.startsWith(`rank:daily:${periodKey}:`);
}

function getDailyRankAwardPointsForPeriod(dayStatus: Record<string, unknown>, periodKey: string) {
  const fieldPoints = Math.max(
    Math.floor(parseFiniteNumber(dayStatus.dailyRankRewardAmount) ?? 0),
    Math.floor(parseFiniteNumber(dayStatus.dailyTopRewardAmount) ?? 0)
  );
  const eventPoints = normalizeDailyPointEvents(dayStatus.pointEvents)
    .filter((event) => isDailyRankEventForPeriod(event, periodKey))
    .reduce((total, event) => total + Math.max(0, Math.floor(event.points)), 0);
  return Math.max(0, fieldPoints, eventPoints);
}

async function collectDailyRankAwardStudentIds(
  db: admin.firestore.Firestore,
  centerId: string,
  periodKey: string
) {
  const settlementRef = db.doc(`centers/${centerId}/rankingRewardSettlements/daily_${periodKey}`);
  const [settlementSnap, progressSnap] = await Promise.all([
    settlementRef.get(),
    db.collection(`centers/${centerId}/growthProgress`).get(),
  ]);
  const studentIds = new Set<string>();
  const settlementData = settlementSnap.exists ? (settlementSnap.data() as Record<string, unknown>) : {};
  if (Array.isArray(settlementData.awards)) {
    settlementData.awards.forEach((entry) => {
      if (!isPlainObject(entry)) return;
      const studentId = asNonEmptyString(entry.studentId);
      if (studentId && !isSyntheticStudentId(studentId)) studentIds.add(studentId);
    });
  }

  progressSnap.forEach((docSnap) => {
    if (isSyntheticStudentId(docSnap.id)) return;
    const data = docSnap.data() as Record<string, unknown>;
    const dailyPointStatus = isPlainObject(data.dailyPointStatus)
      ? (data.dailyPointStatus as Record<string, unknown>)
      : {};
    const dayStatus = isPlainObject(dailyPointStatus[periodKey])
      ? (dailyPointStatus[periodKey] as Record<string, unknown>)
      : {};
    if (getDailyRankAwardPointsForPeriod(dayStatus, periodKey) > 0) {
      studentIds.add(docSnap.id);
    }
  });

  return Array.from(studentIds);
}

async function cancelDailyRankAwardForStudent(params: {
  db: admin.firestore.Firestore;
  centerId: string;
  studentId: string;
  periodKey: string;
  adminUid: string;
  reissueId: string;
}): Promise<DailyRankAwardCancellation | null> {
  const { db, centerId, studentId, periodKey, adminUid, reissueId } = params;
  const progressRef = db.doc(`centers/${centerId}/growthProgress/${studentId}`);
  const logRef = db.collection(`centers/${centerId}/rankingRewardReissueLogs`).doc();

  return db.runTransaction(async (transaction) => {
    const progressSnap = await transaction.get(progressRef);
    if (!progressSnap.exists) return null;

    const progressData = progressSnap.data() as Record<string, unknown>;
    const dailyPointStatus = isPlainObject(progressData.dailyPointStatus)
      ? (progressData.dailyPointStatus as Record<string, unknown>)
      : {};
    const currentDayStatus = isPlainObject(dailyPointStatus[periodKey])
      ? (dailyPointStatus[periodKey] as Record<string, unknown>)
      : {};
    const cancelPoints = getDailyRankAwardPointsForPeriod(currentDayStatus, periodKey);
    if (cancelPoints <= 0) return null;

    const currentBalance = Math.max(0, Math.floor(parseFiniteNumber(progressData.pointsBalance) ?? 0));
    const currentTotalEarned = Math.max(0, Math.floor(parseFiniteNumber(progressData.totalPointsEarned) ?? 0));
    const currentDailyAmount = Math.max(0, Math.floor(parseFiniteNumber(currentDayStatus.dailyPointAmount) ?? 0));
    const balanceDeduction = Math.min(currentBalance, cancelPoints);
    const balanceDeficit = Math.max(0, cancelPoints - currentBalance);
    const nextEvents = normalizeDailyPointEvents(currentDayStatus.pointEvents)
      .filter((event) => !isDailyRankEventForPeriod(event, periodKey));
    const nextDayStatus = {
      ...currentDayStatus,
      dailyPointAmount: Math.max(0, currentDailyAmount - cancelPoints),
      dailyRankRewardAmount: 0,
      dailyTopRewardAmount: 0,
      dailyRankRewardRank: 0,
      pointEvents: nextEvents,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const nextBalance = currentBalance - balanceDeduction;
    const nextTotalEarned = Math.max(0, currentTotalEarned - cancelPoints);

    transaction.set(progressRef, {
      pointsBalance: nextBalance,
      totalPointsEarned: nextTotalEarned,
      dailyPointStatus: {
        [periodKey]: nextDayStatus,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(logRef, {
      centerId,
      studentId,
      periodKey,
      awardDateKey: periodKey,
      action: "cancel_daily_rank_reward",
      reissueId,
      cancelledPoints: cancelPoints,
      balanceDeduction,
      balanceDeficit,
      beforePointsBalance: currentBalance,
      afterPointsBalance: nextBalance,
      beforeTotalPointsEarned: currentTotalEarned,
      afterTotalPointsEarned: nextTotalEarned,
      beforeDailyPointAmount: currentDailyAmount,
      afterDailyPointAmount: nextDayStatus.dailyPointAmount,
      adjustedBy: adminUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      studentId,
      cancelledPoints: cancelPoints,
      balanceDeduction,
      balanceDeficit,
      pointsBalance: nextBalance,
      totalPointsEarned: nextTotalEarned,
      dailyPointAmount: nextDayStatus.dailyPointAmount,
    };
  });
}

export const reissueDailyRankingRewardV2Secure = functions
  .region(region)
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .https.onCall(async (data, context) => {
    const db = admin.firestore();
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const centerId = asNonEmptyString(data?.centerId);
    const periodKey = asNonEmptyString(data?.dateKey) || DEFAULT_DAILY_RANK_REISSUE_DATE_KEY;
    if (!centerId) {
      throw new functions.https.HttpsError("invalid-argument", "centerId is required.", {
        userMessage: "센터 정보를 다시 확인해 주세요.",
      });
    }
    if (!isValidDateKey(periodKey)) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid dateKey.", {
        userMessage: "재정산할 랭킹 날짜를 다시 확인해 주세요.",
      });
    }

    await assertActiveCenterAdmin(db, centerId, context.auth.uid);

    const reissueRef = db.collection(`centers/${centerId}/rankingRewardReissues`).doc(`daily_${periodKey}_${Date.now()}`);
    const reissueId = reissueRef.id;
    const contextSnapshot = await loadCenterStudentContext(db, centerId);
    const competitionDate = parseDateKeyAsKstDate(periodKey);
    const dailyWindow = buildCompetitionWindow(competitionDate);
    const newAwards = await buildDailyAwardEntries(db, centerId, competitionDate, contextSnapshot);
    const oldAwardStudentIds = await collectDailyRankAwardStudentIds(db, centerId, periodKey);
    const studentsToCancel = Array.from(new Set(oldAwardStudentIds));
    const cancellations: DailyRankAwardCancellation[] = [];

    await reissueRef.set({
      centerId,
      range: "daily",
      periodKey,
      awardDateKey: periodKey,
      rankingEngineVersion: RANKING_ENGINE_VERSION,
      status: "processing",
      requestedBy: context.auth.uid,
      windowStartsAt: admin.firestore.Timestamp.fromDate(dailyWindow.startsAt),
      windowEndsAt: admin.firestore.Timestamp.fromDate(dailyWindow.endsAt),
      scheduledAwardAt: admin.firestore.Timestamp.fromDate(dailyWindow.awardsAt),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    for (const studentId of studentsToCancel) {
      const cancellation = await cancelDailyRankAwardForStudent({
        db,
        centerId,
        studentId,
        periodKey,
        adminUid: context.auth.uid,
        reissueId,
      });
      if (cancellation) cancellations.push(cancellation);
    }

    const appliedAwards = await applyAwardEntries(db, centerId, "daily", {
      periodKey,
      awardDateKey: periodKey,
    }, newAwards);
    const settlementRef = db.doc(`centers/${centerId}/rankingRewardSettlements/daily_${periodKey}`);
    await completeSettlement(settlementRef, {
      centerId,
      range: "daily",
      periodKey,
      sourceDateKey: periodKey,
      awardDateKey: periodKey,
      rankingEngineVersion: RANKING_ENGINE_VERSION,
      reissued: true,
      reissueId,
      reissuedBy: context.auth.uid,
      windowStartsAt: admin.firestore.Timestamp.fromDate(dailyWindow.startsAt),
      windowEndsAt: admin.firestore.Timestamp.fromDate(dailyWindow.endsAt),
      scheduledAwardAt: admin.firestore.Timestamp.fromDate(dailyWindow.awardsAt),
      cancelledAwardCount: cancellations.length,
      cancelledPointTotal: cancellations.reduce((total, entry) => total + entry.cancelledPoints, 0),
      balanceDeficitTotal: cancellations.reduce((total, entry) => total + entry.balanceDeficit, 0),
      awardCount: appliedAwards.length,
      awards: appliedAwards.map((award) => ({
        studentId: award.studentId,
        rank: award.rank,
        points: award.points,
        value: award.value,
        displayNameSnapshot: award.displayNameSnapshot,
      })),
    });
    await reissueRef.set({
      status: "completed",
      cancelledAwardCount: cancellations.length,
      cancelledPointTotal: cancellations.reduce((total, entry) => total + entry.cancelledPoints, 0),
      balanceDeficitTotal: cancellations.reduce((total, entry) => total + entry.balanceDeficit, 0),
      awardCount: appliedAwards.length,
      awards: appliedAwards.map((award) => ({
        studentId: award.studentId,
        rank: award.rank,
        points: award.points,
        value: award.value,
        displayNameSnapshot: award.displayNameSnapshot,
      })),
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      ok: true,
      reissueId,
      centerId,
      periodKey,
      cancelledAwardCount: cancellations.length,
      cancelledPointTotal: cancellations.reduce((total, entry) => total + entry.cancelledPoints, 0),
      balanceDeficitTotal: cancellations.reduce((total, entry) => total + entry.balanceDeficit, 0),
      awardCount: appliedAwards.length,
      awards: appliedAwards.map((award) => ({
        studentId: award.studentId,
        rank: award.rank,
        points: award.points,
        value: award.value,
      })),
    };
  });

export const scheduledRankingRewardSettlement = functions
  .region(region)
  .pubsub.schedule("every 5 minutes")
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    const nowKst = toKstDate(now);
    const settlementDateKey = toDateKey(nowKst);
    const dailyCandidates = getDailySettlementCandidates(nowKst);
    const weeklyCandidate = getWeeklySettlementCandidate(nowKst);
    const monthlyCandidate = getMonthlySettlementCandidate(nowKst);
    if (dailyCandidates.length === 0 && !weeklyCandidate && !monthlyCandidate) {
      functions.logger.info("ranking settlement skipped: no eligible settlement window", {
        atKst: nowKst.toISOString(),
      });
      return null;
    }

    const centersSnap = await db.collection("centers").get();

    for (const centerDoc of centersSnap.docs) {
      const centerId = centerDoc.id;
      let contextPromise: Promise<CenterStudentContext> | null = null;
      const getContext = () => {
        if (!contextPromise) {
          contextPromise = loadCenterStudentContext(db, centerId);
        }
        return contextPromise;
      };

      for (const candidate of dailyCandidates) {
        const settlementRef = db.doc(`centers/${centerId}/rankingRewardSettlements/daily_${candidate.periodKey}`);
        const awardDateKey = candidate.periodKey;
        const claimed = await claimSettlement(db, settlementRef, now, {
          centerId,
          range: "daily",
          periodKey: candidate.periodKey,
          sourceDateKey: candidate.periodKey,
          awardDateKey,
          settlementDateKey,
          rankingEngineVersion: RANKING_ENGINE_VERSION,
          windowStartsAt: admin.firestore.Timestamp.fromDate(candidate.windowStartsAt),
          windowEndsAt: admin.firestore.Timestamp.fromDate(candidate.windowEndsAt),
          scheduledAwardAt: admin.firestore.Timestamp.fromDate(candidate.awardsAt),
        });
        if (!claimed) continue;

        try {
          const awards = await buildDailyAwardEntries(db, centerId, candidate.competitionDate, await getContext());
          const appliedAwards = await applyAwardEntries(db, centerId, "daily", {
            periodKey: candidate.periodKey,
            awardDateKey,
          }, awards);
          await completeSettlement(settlementRef, {
            awardDateKey,
            settlementDateKey,
            rankingEngineVersion: RANKING_ENGINE_VERSION,
            windowStartsAt: admin.firestore.Timestamp.fromDate(candidate.windowStartsAt),
            windowEndsAt: admin.firestore.Timestamp.fromDate(candidate.windowEndsAt),
            scheduledAwardAt: admin.firestore.Timestamp.fromDate(candidate.awardsAt),
            awardCount: appliedAwards.length,
            awards: appliedAwards.map((award) => ({
              studentId: award.studentId,
              rank: award.rank,
              points: award.points,
              value: award.value,
              displayNameSnapshot: award.displayNameSnapshot,
            })),
          });
        } catch (error) {
          functions.logger.error("daily ranking settlement failed", { centerId, periodKey: candidate.periodKey, error });
          await failSettlement(settlementRef, error);
        }
      }

      if (weeklyCandidate) {
        const settlementRef = db.doc(`centers/${centerId}/rankingRewardSettlements/weekly_${weeklyCandidate.periodKey}`);
        const awardDateKey = toDateKey(weeklyCandidate.endDate);
        const claimed = await claimSettlement(db, settlementRef, now, {
          centerId,
          range: "weekly",
          periodKey: weeklyCandidate.periodKey,
          sourceStartDateKey: toDateKey(weeklyCandidate.startDate),
          sourceEndDateKey: toDateKey(weeklyCandidate.endDate),
          awardDateKey,
          settlementDateKey,
          rankingEngineVersion: RANKING_ENGINE_VERSION,
          scheduledAwardAt: admin.firestore.Timestamp.fromDate(weeklyCandidate.awardsAt),
        });

        if (claimed) {
          try {
            const awards = await buildWeeklyAwardEntries(
              db,
              centerId,
              weeklyCandidate.startDate,
              weeklyCandidate.endDate,
              await getContext()
            );
            const appliedAwards = await applyAwardEntries(db, centerId, "weekly", {
              periodKey: weeklyCandidate.periodKey,
              awardDateKey,
            }, awards);
            await completeSettlement(settlementRef, {
              awardDateKey,
              settlementDateKey,
              rankingEngineVersion: RANKING_ENGINE_VERSION,
              scheduledAwardAt: admin.firestore.Timestamp.fromDate(weeklyCandidate.awardsAt),
              awardCount: appliedAwards.length,
              awards: appliedAwards.map((award) => ({
                studentId: award.studentId,
                rank: award.rank,
                points: award.points,
                value: award.value,
                displayNameSnapshot: award.displayNameSnapshot,
              })),
            });
          } catch (error) {
            functions.logger.error("weekly ranking settlement failed", { centerId, periodKey: weeklyCandidate.periodKey, error });
            await failSettlement(settlementRef, error);
          }
        }
      }

      if (monthlyCandidate) {
        const settlementRef = db.doc(`centers/${centerId}/rankingRewardSettlements/monthly_${monthlyCandidate.periodKey}`);
        const awardDateKey = toDateKey(monthlyCandidate.endDate);
        const claimed = await claimSettlement(db, settlementRef, now, {
          centerId,
          range: "monthly",
          periodKey: monthlyCandidate.periodKey,
          sourceMonthKey: monthlyCandidate.monthKey,
          sourceStartDateKey: toDateKey(monthlyCandidate.startDate),
          sourceEndDateKey: toDateKey(monthlyCandidate.endDate),
          awardDateKey,
          settlementDateKey,
          rankingEngineVersion: RANKING_ENGINE_VERSION,
          scheduledAwardAt: admin.firestore.Timestamp.fromDate(monthlyCandidate.awardsAt),
          firstEligiblePeriodKey: MONTHLY_RANK_REWARD_FIRST_ELIGIBLE_PERIOD_KEY,
        });

        if (claimed) {
          try {
            const isRewardEligible = isMonthlyRankRewardEligiblePeriod(monthlyCandidate.periodKey);
            const awards = isRewardEligible
              ? await buildMonthlyAwardEntries(db, centerId, monthlyCandidate.monthKey, await getContext())
              : [];
            const appliedAwards = isRewardEligible
              ? await applyAwardEntries(db, centerId, "monthly", {
                periodKey: monthlyCandidate.periodKey,
                awardDateKey,
              }, awards)
              : [];
            await completeSettlement(settlementRef, {
              awardDateKey,
              settlementDateKey,
              rankingEngineVersion: RANKING_ENGINE_VERSION,
              scheduledAwardAt: admin.firestore.Timestamp.fromDate(monthlyCandidate.awardsAt),
              awardCount: appliedAwards.length,
              awards: appliedAwards.map((award) => ({
                studentId: award.studentId,
                rank: award.rank,
                points: award.points,
                value: award.value,
                displayNameSnapshot: award.displayNameSnapshot,
              })),
              skipped: !isRewardEligible,
              skippedReason: isRewardEligible ? null : MONTHLY_RANK_REWARD_PRELAUNCH_SKIP_REASON,
              firstEligiblePeriodKey: MONTHLY_RANK_REWARD_FIRST_ELIGIBLE_PERIOD_KEY,
            });
          } catch (error) {
            functions.logger.error("monthly ranking settlement failed", { centerId, periodKey: monthlyCandidate.periodKey, error });
            await failSettlement(settlementRef, error);
          }
        }
      }
    }

    return null;
  });
