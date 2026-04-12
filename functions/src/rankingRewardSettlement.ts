import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const region = "asia-northeast3";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

type StudentRankingRange = "daily" | "weekly" | "monthly";

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
  shouldInclude: (studentId: string) => boolean;
  getProfile: (studentId: string) => StudentProfileSnapshot;
};

const DAILY_RANK_START_HOUR = 17;
const WEEKEND_RANK_START_HOUR = 8;
const DAILY_RANK_END_HOUR = 1;
const ACTIVE_LIVE_RANK_STATUSES = new Set(["studying", "away", "break"]);

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

function getLegacyDailyPointAwardTotal(dayStatus: Record<string, unknown>): number {
  const studyBoxPoints = Array.isArray(dayStatus.studyBoxRewards)
    ? dayStatus.studyBoxRewards.reduce((total, entry) => {
        if (!isPlainObject(entry)) return total;
        return total + Math.max(0, Math.floor(parseFiniteNumber(entry.awardedPoints) ?? 0));
      }, 0)
    : 0;
  const rankRewardPoints = ["dailyRankRewardAmount", "weeklyRankRewardAmount", "monthlyRankRewardAmount"].reduce(
    (total, key) => total + Math.max(0, Math.floor(parseFiniteNumber(dayStatus[key]) ?? 0)),
    0
  );
  return studyBoxPoints + rankRewardPoints;
}

function getDailyAwardedPointTotal(dayStatus: Record<string, unknown>): number {
  const dailyPointAmount = Math.max(0, Math.floor(parseFiniteNumber(dayStatus.dailyPointAmount) ?? 0));
  return Math.max(dailyPointAmount, getLegacyDailyPointAwardTotal(dayStatus));
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

function isWeekendCompetitionDate(targetDate: Date) {
  const day = targetDate.getDay();
  return day === 0 || day === 6;
}

function getCompetitionStartHour(targetDate: Date) {
  return isWeekendCompetitionDate(targetDate) ? WEEKEND_RANK_START_HOUR : DAILY_RANK_START_HOUR;
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

  return {
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

async function buildDailyAwardEntries(
  db: admin.firestore.Firestore,
  centerId: string,
  competitionDate: Date,
  context: CenterStudentContext
) {
  const dailyWindow = buildCompetitionWindow(competitionDate);
  const dailyDateKeys = getDateKeysCoveredByWindow(dailyWindow.startsAt, dailyWindow.endsAt);
  const dailySnapshots = await Promise.all(
    dailyDateKeys.map((dateKey) => db.collection(`centers/${centerId}/dailyStudentStats/${dateKey}/students`).get())
  );

  const totals = new Map<string, number>();
  dailySnapshots.forEach((snapshot) => {
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const studentId = typeof data.studentId === "string" ? data.studentId : docSnap.id;
      const value = Math.max(0, Number(data.totalStudyMinutes ?? 0));
      if (!studentId || isSyntheticStudentId(studentId) || !context.shouldInclude(studentId) || value <= 0) return;
      totals.set(studentId, (totals.get(studentId) || 0) + value);
    });
  });

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
      const value = Math.max(0, Number(data.totalStudyMinutes ?? 0));
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
  awardDateKey: string,
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
      const currentDayStatus = isPlainObject(dailyPointStatus[awardDateKey])
        ? (dailyPointStatus[awardDateKey] as Record<string, unknown>)
        : {};
      const awardedPoints = clampDailyPointAward(currentDayStatus, award.points).awardedPoints;
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

      transaction.set(progressRef, {
        pointsBalance: admin.firestore.FieldValue.increment(awardedPoints),
        totalPointsEarned: admin.firestore.FieldValue.increment(awardedPoints),
        dailyPointStatus: {
          [awardDateKey]: pointStatusPayload,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

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
  const candidates: Array<{ periodKey: string; competitionDate: Date }> = [];

  for (let index = 1; index <= lookbackDays; index += 1) {
    const competitionDate = shiftKstDate(startOfKstDay(nowKst), -index);
    const window = buildCompetitionWindow(competitionDate);
    if (nowKst.getTime() < window.endsAt.getTime()) continue;

    candidates.push({
      periodKey: toDateKey(competitionDate),
      competitionDate,
    });
  }

  return candidates;
}

function getWeeklySettlementCandidate(nowKst: Date) {
  const currentWeekStart = startOfKstWeek(nowKst);
  const releaseAt = cloneDate(currentWeekStart);
  releaseAt.setHours(1, 0, 0, 0);
  if (nowKst.getTime() < releaseAt.getTime()) {
    return null;
  }

  const startDate = shiftKstDate(currentWeekStart, -7);
  const endDate = shiftKstDate(currentWeekStart, -1);

  return {
    periodKey: `${toDateKey(startDate)}_${toDateKey(endDate)}`,
    startDate,
    endDate,
  };
}

function getMonthlySettlementCandidate(nowKst: Date) {
  const currentMonthStart = startOfKstMonth(nowKst);
  const releaseAt = cloneDate(currentMonthStart);
  releaseAt.setHours(1, 0, 0, 0);
  if (nowKst.getTime() < releaseAt.getTime()) {
    return null;
  }

  const previousMonthStart = cloneDate(currentMonthStart);
  previousMonthStart.setMonth(previousMonthStart.getMonth() - 1, 1);
  previousMonthStart.setHours(0, 0, 0, 0);

  return {
    periodKey: toMonthKey(previousMonthStart),
    monthKey: toMonthKey(previousMonthStart),
  };
}

export const scheduledRankingRewardSettlement = functions
  .region(region)
  .pubsub.schedule("every 10 minutes")
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    const nowKst = toKstDate(now);
    const awardDateKey = toDateKey(nowKst);
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
        const claimed = await claimSettlement(db, settlementRef, now, {
          centerId,
          range: "daily",
          periodKey: candidate.periodKey,
          sourceDateKey: candidate.periodKey,
          awardDateKey,
        });
        if (!claimed) continue;

        try {
          const awards = await buildDailyAwardEntries(db, centerId, candidate.competitionDate, await getContext());
          const appliedAwards = await applyAwardEntries(db, centerId, "daily", awardDateKey, awards);
          await completeSettlement(settlementRef, {
            awardDateKey,
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
        const claimed = await claimSettlement(db, settlementRef, now, {
          centerId,
          range: "weekly",
          periodKey: weeklyCandidate.periodKey,
          sourceStartDateKey: toDateKey(weeklyCandidate.startDate),
          sourceEndDateKey: toDateKey(weeklyCandidate.endDate),
          awardDateKey,
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
            const appliedAwards = await applyAwardEntries(db, centerId, "weekly", awardDateKey, awards);
            await completeSettlement(settlementRef, {
              awardDateKey,
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
        const claimed = await claimSettlement(db, settlementRef, now, {
          centerId,
          range: "monthly",
          periodKey: monthlyCandidate.periodKey,
          sourceMonthKey: monthlyCandidate.monthKey,
          awardDateKey,
        });

        if (claimed) {
          try {
            const awards = await buildMonthlyAwardEntries(db, centerId, monthlyCandidate.monthKey, await getContext());
            const appliedAwards = await applyAwardEntries(db, centerId, "monthly", awardDateKey, awards);
            await completeSettlement(settlementRef, {
              awardDateKey,
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
            functions.logger.error("monthly ranking settlement failed", { centerId, periodKey: monthlyCandidate.periodKey, error });
            await failSettlement(settlementRef, error);
          }
        }
      }
    }

    return null;
  });
