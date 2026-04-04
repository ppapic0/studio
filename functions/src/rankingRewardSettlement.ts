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

function isSyntheticStudentId(studentId: unknown): boolean {
  if (typeof studentId !== "string") return true;
  const normalized = studentId.trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.startsWith("test-")
    || normalized.startsWith("seed-")
    || normalized.startsWith("mock-")
    || normalized.includes("dummy")
  );
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
  studentsSnap.forEach((docSnap) => {
    const studentId = docSnap.id;
    if (isSyntheticStudentId(studentId)) return;

    const data = docSnap.data() as Record<string, unknown>;
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
    shouldInclude: (studentId: string) => activeStudentIds.size === 0 || activeStudentIds.has(studentId),
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
  competitionDateKey: string,
  context: CenterStudentContext
) {
  const dailySnap = await db.collection(`centers/${centerId}/dailyStudentStats/${competitionDateKey}/students`).get();

  const rankedEntries = applyCompetitionRanks(
    dailySnap.docs
      .map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const studentId = typeof data.studentId === "string" ? data.studentId : docSnap.id;
        const value = Math.max(0, Number(data.totalStudyMinutes ?? 0));
        if (!studentId || isSyntheticStudentId(studentId) || !context.shouldInclude(studentId) || value <= 0) return null;

        return {
          studentId,
          value,
          profile: context.getProfile(studentId),
        };
      })
      .filter((entry): entry is { studentId: string; value: number; profile: StudentProfileSnapshot } => Boolean(entry))
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
  if (awards.length === 0) return;

  const batch = db.batch();

  for (const award of awards) {
    const progressRef = db.doc(`centers/${centerId}/growthProgress/${award.studentId}`);
    const pointStatusPayload: Record<string, unknown> = {
      dailyPointAmount: admin.firestore.FieldValue.increment(award.points),
    };

    if (range === "daily") {
      pointStatusPayload.dailyRankRewardAmount = award.points;
      pointStatusPayload.dailyRankRewardRank = award.rank;
      pointStatusPayload.dailyTopRewardAmount = award.points;
    } else if (range === "weekly") {
      pointStatusPayload.weeklyRankRewardAmount = award.points;
      pointStatusPayload.weeklyRankRewardRank = award.rank;
    } else {
      pointStatusPayload.monthlyRankRewardAmount = award.points;
      pointStatusPayload.monthlyRankRewardRank = award.rank;
    }

    batch.set(progressRef, {
      pointsBalance: admin.firestore.FieldValue.increment(award.points),
      totalPointsEarned: admin.firestore.FieldValue.increment(award.points),
      dailyPointStatus: {
        [awardDateKey]: pointStatusPayload,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  await batch.commit();
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
    const centersSnap = await db.collection("centers").get();
    const dailyCandidates = getDailySettlementCandidates(nowKst);
    const weeklyCandidate = getWeeklySettlementCandidate(nowKst);
    const monthlyCandidate = getMonthlySettlementCandidate(nowKst);

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
          const awards = await buildDailyAwardEntries(db, centerId, candidate.periodKey, await getContext());
          await applyAwardEntries(db, centerId, "daily", awardDateKey, awards);
          await completeSettlement(settlementRef, {
            awardDateKey,
            awardCount: awards.length,
            awards: awards.map((award) => ({
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
            await applyAwardEntries(db, centerId, "weekly", awardDateKey, awards);
            await completeSettlement(settlementRef, {
              awardDateKey,
              awardCount: awards.length,
              awards: awards.map((award) => ({
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
            await applyAwardEntries(db, centerId, "monthly", awardDateKey, awards);
            await completeSettlement(settlementRef, {
              awardDateKey,
              awardCount: awards.length,
              awards: awards.map((award) => ({
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
