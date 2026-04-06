"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledRankingRewardSettlement = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const region = "asia-northeast3";
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const DAILY_RANK_START_HOUR = 17;
const WEEKEND_RANK_START_HOUR = 8;
const DAILY_RANK_END_HOUR = 1;
const STUDENT_RANK_REWARD_TIERS = {
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
function toKstDate(baseDate = new Date()) {
    const formatted = baseDate.toLocaleString("en-US", { timeZone: "Asia/Seoul" });
    return new Date(formatted);
}
function padNumber(value) {
    return String(value).padStart(2, "0");
}
function toDateKey(date) {
    return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}
function toMonthKey(date) {
    return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}`;
}
function cloneDate(date) {
    return new Date(date.getTime());
}
function startOfKstDay(date) {
    const next = cloneDate(date);
    next.setHours(0, 0, 0, 0);
    return next;
}
function shiftKstDate(date, days) {
    const next = cloneDate(date);
    next.setDate(next.getDate() + days);
    return next;
}
function startOfKstWeek(date) {
    const next = startOfKstDay(date);
    const day = next.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    next.setDate(next.getDate() + diff);
    return next;
}
function startOfKstMonth(date) {
    const next = startOfKstDay(date);
    next.setDate(1);
    return next;
}
function normalizeMembershipStatus(value) {
    if (typeof value !== "string")
        return "active";
    const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (!normalized || normalized === "active" || normalized === "approved" || normalized === "enabled" || normalized === "current") {
        return "active";
    }
    if (normalized === "onhold" || normalized === "pending")
        return "onHold";
    if (normalized === "inactive" || normalized === "withdrawn")
        return "withdrawn";
    return "active";
}
function isSyntheticStudentId(studentId) {
    if (typeof studentId !== "string")
        return true;
    const normalized = studentId.trim().toLowerCase();
    if (!normalized)
        return true;
    return (normalized.startsWith("test-")
        || normalized.startsWith("seed-")
        || normalized.startsWith("mock-")
        || normalized.includes("dummy"));
}
function isWeekendCompetitionDate(targetDate) {
    const day = targetDate.getDay();
    return day === 0 || day === 6;
}
function getCompetitionStartHour(targetDate) {
    return isWeekendCompetitionDate(targetDate) ? WEEKEND_RANK_START_HOUR : DAILY_RANK_START_HOUR;
}
function buildCompetitionWindow(targetDate) {
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
function getDateKeysCoveredByWindow(startsAt, endsAt) {
    const keys = [];
    const cursor = startOfKstDay(startsAt);
    const lastIncludedDate = startOfKstDay(new Date(endsAt.getTime() - 1));
    while (cursor.getTime() <= lastIncludedDate.getTime()) {
        keys.push(toDateKey(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return keys;
}
function applyCompetitionRanks(entries) {
    const sorted = [...entries].sort((left, right) => right.value - left.value);
    let lastValue = null;
    let currentRank = 0;
    return sorted.map((entry, index) => {
        if (lastValue === null || entry.value < lastValue) {
            currentRank = index + 1;
            lastValue = entry.value;
        }
        return Object.assign(Object.assign({}, entry), { rank: currentRank });
    });
}
async function loadCenterStudentContext(db, centerId) {
    const [membersSnap, studentsSnap] = await Promise.all([
        db.collection(`centers/${centerId}/members`).where("role", "==", "student").get(),
        db.collection(`centers/${centerId}/students`).get(),
    ]);
    const studentProfiles = new Map();
    studentsSnap.forEach((docSnap) => {
        const studentId = docSnap.id;
        if (isSyntheticStudentId(studentId))
            return;
        const data = docSnap.data();
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
    const memberProfiles = new Map();
    const activeStudentIds = new Set();
    membersSnap.forEach((docSnap) => {
        const studentId = docSnap.id;
        if (isSyntheticStudentId(studentId))
            return;
        const data = docSnap.data();
        if (normalizeMembershipStatus(data.status) !== "active")
            return;
        activeStudentIds.add(studentId);
        const studentProfile = studentProfiles.get(studentId);
        memberProfiles.set(studentId, {
            displayNameSnapshot: typeof data.displayName === "string" && data.displayName.trim()
                ? data.displayName.trim()
                : (studentProfile === null || studentProfile === void 0 ? void 0 : studentProfile.displayNameSnapshot) || "학생",
            classNameSnapshot: typeof data.className === "string" && data.className.trim()
                ? data.className.trim()
                : (studentProfile === null || studentProfile === void 0 ? void 0 : studentProfile.classNameSnapshot) || null,
            schoolNameSnapshot: typeof data.schoolName === "string" && data.schoolName.trim()
                ? data.schoolName.trim()
                : typeof data.schoolNameSnapshot === "string" && data.schoolNameSnapshot.trim()
                    ? data.schoolNameSnapshot.trim()
                    : (studentProfile === null || studentProfile === void 0 ? void 0 : studentProfile.schoolNameSnapshot) || null,
        });
    });
    return {
        shouldInclude: (studentId) => activeStudentIds.size === 0 || activeStudentIds.has(studentId),
        getProfile: (studentId) => memberProfiles.get(studentId)
            || studentProfiles.get(studentId)
            || {
                displayNameSnapshot: "학생",
                classNameSnapshot: null,
                schoolNameSnapshot: null,
            },
    };
}
function buildAwardEntries(range, rankedEntries) {
    return rankedEntries
        .map((entry) => {
        var _a, _b;
        const points = (_b = (_a = STUDENT_RANK_REWARD_TIERS[range].find((tier) => tier.rank === entry.rank)) === null || _a === void 0 ? void 0 : _a.points) !== null && _b !== void 0 ? _b : 0;
        if (points <= 0)
            return null;
        return Object.assign({ studentId: entry.studentId, value: entry.value, rank: entry.rank, points }, entry.profile);
    })
        .filter((entry) => Boolean(entry));
}
async function buildDailyAwardEntries(db, centerId, competitionDate, context) {
    const dailyWindow = buildCompetitionWindow(competitionDate);
    const dailyDateKeys = getDateKeysCoveredByWindow(dailyWindow.startsAt, dailyWindow.endsAt);
    const dailySnapshots = await Promise.all(dailyDateKeys.map((dateKey) => db.collection(`centers/${centerId}/dailyStudentStats/${dateKey}/students`).get()));
    const totals = new Map();
    dailySnapshots.forEach((snapshot) => {
        snapshot.forEach((docSnap) => {
            var _a;
            const data = docSnap.data();
            const studentId = typeof data.studentId === "string" ? data.studentId : docSnap.id;
            const value = Math.max(0, Number((_a = data.totalStudyMinutes) !== null && _a !== void 0 ? _a : 0));
            if (!studentId || isSyntheticStudentId(studentId) || !context.shouldInclude(studentId) || value <= 0)
                return;
            totals.set(studentId, (totals.get(studentId) || 0) + value);
        });
    });
    const rankedEntries = applyCompetitionRanks(Array.from(totals.entries()).map(([studentId, value]) => ({
        studentId,
        value,
        profile: context.getProfile(studentId),
    })));
    return buildAwardEntries("daily", rankedEntries);
}
async function buildWeeklyAwardEntries(db, centerId, startDate, endDate, context) {
    const dateKeys = [];
    let cursor = startOfKstDay(startDate);
    const inclusiveEnd = startOfKstDay(endDate);
    while (cursor.getTime() <= inclusiveEnd.getTime()) {
        dateKeys.push(toDateKey(cursor));
        cursor = shiftKstDate(cursor, 1);
    }
    const snapshots = await Promise.all(dateKeys.map((dateKey) => db.collection(`centers/${centerId}/dailyStudentStats/${dateKey}/students`).get()));
    const totals = new Map();
    snapshots.forEach((snapshot) => {
        snapshot.forEach((docSnap) => {
            var _a;
            const data = docSnap.data();
            const studentId = typeof data.studentId === "string" ? data.studentId : docSnap.id;
            const value = Math.max(0, Number((_a = data.totalStudyMinutes) !== null && _a !== void 0 ? _a : 0));
            if (!studentId || isSyntheticStudentId(studentId) || !context.shouldInclude(studentId) || value <= 0)
                return;
            totals.set(studentId, (totals.get(studentId) || 0) + value);
        });
    });
    const rankedEntries = applyCompetitionRanks(Array.from(totals.entries()).map(([studentId, value]) => ({
        studentId,
        value,
        profile: context.getProfile(studentId),
    })));
    return buildAwardEntries("weekly", rankedEntries);
}
async function buildMonthlyAwardEntries(db, centerId, monthKey, context) {
    const monthlySnap = await db.collection(`centers/${centerId}/leaderboards/${monthKey}_study-time/entries`).get();
    const rankedEntries = applyCompetitionRanks(monthlySnap.docs
        .map((docSnap) => {
        var _a;
        const data = docSnap.data();
        const studentId = typeof data.studentId === "string" ? data.studentId : docSnap.id;
        const value = Math.max(0, Number((_a = data.value) !== null && _a !== void 0 ? _a : 0));
        if (!studentId || isSyntheticStudentId(studentId) || !context.shouldInclude(studentId) || value <= 0)
            return null;
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
        .filter((entry) => Boolean(entry)));
    return buildAwardEntries("monthly", rankedEntries);
}
async function claimSettlement(db, settlementRef, now, payload) {
    return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(settlementRef);
        const data = snapshot.data();
        const status = typeof (data === null || data === void 0 ? void 0 : data.status) === "string" ? data.status : "";
        const leaseUntil = (data === null || data === void 0 ? void 0 : data.leaseUntil) instanceof admin.firestore.Timestamp ? data.leaseUntil.toDate() : null;
        if (status === "completed") {
            return false;
        }
        if (status === "processing" && leaseUntil && leaseUntil.getTime() > now.getTime()) {
            return false;
        }
        transaction.set(settlementRef, Object.assign(Object.assign({}, payload), { status: "processing", leaseUntil: admin.firestore.Timestamp.fromMillis(now.getTime() + 9 * 60 * 1000), processingStartedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }), { merge: true });
        return true;
    });
}
async function completeSettlement(settlementRef, payload) {
    await settlementRef.set(Object.assign(Object.assign({}, payload), { status: "completed", completedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }), { merge: true });
}
async function failSettlement(settlementRef, error) {
    await settlementRef.set({
        status: "failed",
        lastError: error instanceof Error ? error.message : String(error),
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
async function applyAwardEntries(db, centerId, range, awardDateKey, awards) {
    if (awards.length === 0)
        return;
    const batch = db.batch();
    for (const award of awards) {
        const progressRef = db.doc(`centers/${centerId}/growthProgress/${award.studentId}`);
        const pointStatusPayload = {
            dailyPointAmount: admin.firestore.FieldValue.increment(award.points),
        };
        if (range === "daily") {
            pointStatusPayload.dailyRankRewardAmount = award.points;
            pointStatusPayload.dailyRankRewardRank = award.rank;
            pointStatusPayload.dailyTopRewardAmount = award.points;
        }
        else if (range === "weekly") {
            pointStatusPayload.weeklyRankRewardAmount = award.points;
            pointStatusPayload.weeklyRankRewardRank = award.rank;
        }
        else {
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
function getDailySettlementCandidates(nowKst, lookbackDays = 7) {
    const candidates = [];
    for (let index = 1; index <= lookbackDays; index += 1) {
        const competitionDate = shiftKstDate(startOfKstDay(nowKst), -index);
        const window = buildCompetitionWindow(competitionDate);
        if (nowKst.getTime() < window.endsAt.getTime())
            continue;
        candidates.push({
            periodKey: toDateKey(competitionDate),
            competitionDate,
        });
    }
    return candidates;
}
function getWeeklySettlementCandidate(nowKst) {
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
function getMonthlySettlementCandidate(nowKst) {
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
exports.scheduledRankingRewardSettlement = functions
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
        let contextPromise = null;
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
            if (!claimed)
                continue;
            try {
                const awards = await buildDailyAwardEntries(db, centerId, candidate.competitionDate, await getContext());
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
            }
            catch (error) {
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
                    const awards = await buildWeeklyAwardEntries(db, centerId, weeklyCandidate.startDate, weeklyCandidate.endDate, await getContext());
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
                }
                catch (error) {
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
                }
                catch (error) {
                    functions.logger.error("monthly ranking settlement failed", { centerId, periodKey: monthlyCandidate.periodKey, error });
                    await failSettlement(settlementRef, error);
                }
            }
        }
    }
    return null;
});
//# sourceMappingURL=rankingRewardSettlement.js.map