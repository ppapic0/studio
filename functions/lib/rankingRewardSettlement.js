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
const DAILY_RANK_END_HOUR = 1;
const ACTIVE_LIVE_RANK_STATUSES = new Set(["studying", "away", "break"]);
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
const DAILY_POINT_EARN_CAP = 1000;
const RANKING_RANGE_LABEL = {
    daily: "일간",
    weekly: "주간",
    monthly: "월간",
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
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseFiniteNumber(value) {
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
function getLegacyDailyPointAwardTotal(dayStatus) {
    const studyBoxPoints = Array.isArray(dayStatus.studyBoxRewards)
        ? dayStatus.studyBoxRewards.reduce((total, entry) => {
            var _a;
            if (!isPlainObject(entry))
                return total;
            return total + Math.max(0, Math.floor((_a = parseFiniteNumber(entry.awardedPoints)) !== null && _a !== void 0 ? _a : 0));
        }, 0)
        : 0;
    const rankRewardPoints = getRankRewardAwardTotal(dayStatus);
    return studyBoxPoints + rankRewardPoints;
}
function getDailyAwardedPointTotal(dayStatus) {
    var _a;
    const dailyPointAmount = Math.max(0, Math.floor((_a = parseFiniteNumber(dayStatus.dailyPointAmount)) !== null && _a !== void 0 ? _a : 0));
    return Math.max(dailyPointAmount, getLegacyDailyPointAwardTotal(dayStatus));
}
function getRankRewardAwardTotal(dayStatus) {
    var _a, _b, _c, _d;
    const dailyRankRewardAmount = Math.max(Math.floor((_a = parseFiniteNumber(dayStatus.dailyRankRewardAmount)) !== null && _a !== void 0 ? _a : 0), Math.floor((_b = parseFiniteNumber(dayStatus.dailyTopRewardAmount)) !== null && _b !== void 0 ? _b : 0));
    const weeklyRankRewardAmount = Math.max(0, Math.floor((_c = parseFiniteNumber(dayStatus.weeklyRankRewardAmount)) !== null && _c !== void 0 ? _c : 0));
    const monthlyRankRewardAmount = Math.max(0, Math.floor((_d = parseFiniteNumber(dayStatus.monthlyRankRewardAmount)) !== null && _d !== void 0 ? _d : 0));
    return Math.max(0, dailyRankRewardAmount) + weeklyRankRewardAmount + monthlyRankRewardAmount;
}
function clampDailyPointAward(dayStatus, requestedPoints) {
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
function isSyntheticStudentId(studentId) {
    if (typeof studentId !== "string")
        return true;
    const normalized = studentId.trim().toLowerCase();
    if (!normalized)
        return true;
    return (normalized.startsWith("test-")
        || normalized.startsWith("seed-")
        || normalized.startsWith("mock-")
        || normalized.startsWith("counseling-demo-")
        || normalized.startsWith("demo-counseling-")
        || normalized.includes("dummy"));
}
function asRecord(value) {
    return value && typeof value === "object" ? value : null;
}
function shouldExcludeFromCompetitionRecord(value, studentId) {
    if (isSyntheticStudentId(studentId))
        return true;
    const record = asRecord(value);
    if (!record)
        return false;
    if (record.isCounselingDemo === true)
        return true;
    const accountKind = typeof record.accountKind === "string" ? record.accountKind.trim().toLowerCase() : "";
    if (accountKind === "counseling-demo" || accountKind === "counseling_demo") {
        return true;
    }
    const exclusions = asRecord(record.operationalExclusions);
    return (exclusions === null || exclusions === void 0 ? void 0 : exclusions.rankings) === true || (exclusions === null || exclusions === void 0 ? void 0 : exclusions.competition) === true;
}
function getCompetitionStartHour() {
    return DAILY_RANK_START_HOUR;
}
function buildCompetitionWindow(targetDate) {
    const competitionDate = startOfKstDay(targetDate);
    const startsAt = cloneDate(competitionDate);
    startsAt.setHours(getCompetitionStartHour(), 0, 0, 0);
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
function chunkItems(items, size) {
    if (size <= 0)
        return [items];
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}
function getAttendanceStatusRank(value) {
    if (value === "studying")
        return 0;
    if (value === "away" || value === "break")
        return 1;
    if (value === "absent")
        return 3;
    return 2;
}
function toTimestampMillis(value) {
    if (value && typeof value === "object") {
        if ("toMillis" in value && typeof value.toMillis === "function") {
            return Number(value.toMillis());
        }
        if ("toDate" in value && typeof value.toDate === "function") {
            return value.toDate().getTime();
        }
    }
    if (value instanceof Date)
        return value.getTime();
    return 0;
}
function pickPreferredAttendanceRecord(records) {
    var _a;
    if (!records.length)
        return null;
    return (_a = [...records].sort((left, right) => {
        const statusRankDiff = getAttendanceStatusRank(left.status) - getAttendanceStatusRank(right.status);
        if (statusRankDiff !== 0)
            return statusRankDiff;
        const checkInPresenceDiff = Number(Boolean(right.lastCheckInAt)) - Number(Boolean(left.lastCheckInAt));
        if (checkInPresenceDiff !== 0)
            return checkInPresenceDiff;
        return toTimestampMillis(right.updatedAt) - toTimestampMillis(left.updatedAt);
    })[0]) !== null && _a !== void 0 ? _a : null;
}
function getTimeRangeOverlapMs(rangeStartMs, rangeEndMs, windowStartMs, windowEndMs) {
    if (!Number.isFinite(rangeStartMs) || !Number.isFinite(rangeEndMs))
        return 0;
    const overlapStart = Math.max(rangeStartMs, windowStartMs);
    const overlapEnd = Math.min(rangeEndMs, windowEndMs);
    if (overlapEnd <= overlapStart)
        return 0;
    return overlapEnd - overlapStart;
}
function getDailyWindowOverlapMinutes(startedAtMs, referenceMs, dailyWindow) {
    const overlapMs = getTimeRangeOverlapMs(startedAtMs, referenceMs, dailyWindow.startsAt.getTime(), dailyWindow.endsAt.getTime());
    if (overlapMs <= 0)
        return 0;
    return Math.max(1, Math.ceil(overlapMs / 60000));
}
function getLiveAttendanceOverlapMinutes(attendance, referenceMs, dailyWindow) {
    const status = typeof attendance.status === "string" ? attendance.status : "";
    if (!ACTIVE_LIVE_RANK_STATUSES.has(status))
        return 0;
    const startedAtMs = toTimestampMillis(attendance.lastCheckInAt);
    if (startedAtMs <= 0)
        return 0;
    return getDailyWindowOverlapMinutes(startedAtMs, referenceMs, dailyWindow);
}
function getSessionReferenceMillis(session) {
    var _a;
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
    const rawDurationMinutes = Number((_a = session.durationMinutes) !== null && _a !== void 0 ? _a : 0);
    const durationMinutes = Number.isFinite(rawDurationMinutes) ? Math.max(0, Math.round(rawDurationMinutes)) : 0;
    return {
        startedAtMs,
        referenceMs: durationMinutes > 0 ? startedAtMs + durationMinutes * 60000 : 0,
    };
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
    const excludedStudentIds = new Set();
    studentsSnap.forEach((docSnap) => {
        const studentId = docSnap.id;
        if (isSyntheticStudentId(studentId))
            return;
        const data = docSnap.data();
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
    const memberProfiles = new Map();
    const activeStudentIds = new Set();
    membersSnap.forEach((docSnap) => {
        const studentId = docSnap.id;
        if (isSyntheticStudentId(studentId))
            return;
        const data = docSnap.data();
        if (shouldExcludeFromCompetitionRecord(data, studentId)) {
            excludedStudentIds.add(studentId);
            return;
        }
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
    const includedStudentIds = Array.from(new Set([
        ...studentProfiles.keys(),
        ...activeStudentIds,
    ])).filter((studentId) => !excludedStudentIds.has(studentId) && (activeStudentIds.size === 0 || activeStudentIds.has(studentId)));
    return {
        includedStudentIds,
        shouldInclude: (studentId) => !excludedStudentIds.has(studentId) && (activeStudentIds.size === 0 || activeStudentIds.has(studentId)),
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
function buildRankingRewardNotificationMessage(range, award) {
    const rangeLabel = RANKING_RANGE_LABEL[range];
    return `${rangeLabel} 랭킹 ${award.rank}위로 ${award.points.toLocaleString()}포인트가 지급되었어요. 알림함에서 다시 확인할 수 있습니다.`;
}
async function buildDailyAwardEntries(db, centerId, competitionDate, context) {
    const dailyWindow = buildCompetitionWindow(competitionDate);
    const dailyDateKeys = getDateKeysCoveredByWindow(dailyWindow.startsAt, dailyWindow.endsAt);
    const dayRefs = context.includedStudentIds.flatMap((studentId) => dailyDateKeys.map((dateKey) => db.doc(`centers/${centerId}/studyLogs/${studentId}/days/${dateKey}`)));
    const dailyDayDocs = [];
    for (const chunk of chunkItems(dayRefs, 350)) {
        if (chunk.length === 0)
            continue;
        const chunkSnapshots = await db.getAll(...chunk);
        dailyDayDocs.push(...chunkSnapshots);
    }
    const sessionRequests = dailyDayDocs.flatMap((docSnap) => {
        var _a, _b, _c, _d;
        if (!docSnap.exists)
            return [];
        const data = docSnap.data();
        const studentId = typeof data.studentId === "string" && data.studentId.trim()
            ? data.studentId.trim()
            : (_b = (_a = docSnap.ref.parent.parent) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : "";
        const persistedMinutes = Math.max(0, Number((_d = (_c = data.totalMinutes) !== null && _c !== void 0 ? _c : data.totalStudyMinutes) !== null && _d !== void 0 ? _d : 0));
        if (!studentId || isSyntheticStudentId(studentId) || !context.shouldInclude(studentId))
            return [];
        if (persistedMinutes <= 0 && !data.firstSessionStartAt && !data.lastSessionEndAt)
            return [];
        return [{
                studentId,
                snapshotRef: docSnap.ref.collection("sessions"),
            }];
    });
    const totals = new Map();
    for (const chunk of chunkItems(sessionRequests, 40)) {
        if (chunk.length === 0)
            continue;
        const chunkSnapshots = await Promise.all(chunk.map(({ snapshotRef }) => snapshotRef.get()));
        chunkSnapshots.forEach((snapshot, index) => {
            var _a, _b;
            const fallbackStudentId = (_b = (_a = chunk[index]) === null || _a === void 0 ? void 0 : _a.studentId) !== null && _b !== void 0 ? _b : "";
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const studentId = typeof data.studentId === "string" && data.studentId.trim()
                    ? data.studentId.trim()
                    : fallbackStudentId;
                const { startedAtMs, referenceMs } = getSessionReferenceMillis(data);
                const value = getDailyWindowOverlapMinutes(startedAtMs, referenceMs, dailyWindow);
                if (!studentId || isSyntheticStudentId(studentId) || !context.shouldInclude(studentId) || value <= 0)
                    return;
                totals.set(studentId, (totals.get(studentId) || 0) + value);
            });
        });
    }
    const attendanceBuckets = new Map();
    const attendanceSnap = await db.collection(`centers/${centerId}/attendanceCurrent`).get();
    attendanceSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const studentId = typeof data.studentId === "string" ? data.studentId : "";
        if (!studentId || isSyntheticStudentId(studentId) || !context.shouldInclude(studentId))
            return;
        const current = attendanceBuckets.get(studentId) || [];
        current.push(data);
        attendanceBuckets.set(studentId, current);
    });
    attendanceBuckets.forEach((records, studentId) => {
        const selectedRecord = pickPreferredAttendanceRecord(records);
        if (!selectedRecord)
            return;
        const liveMinutes = getLiveAttendanceOverlapMinutes(selectedRecord, dailyWindow.endsAt.getTime(), dailyWindow);
        if (liveMinutes <= 0)
            return;
        totals.set(studentId, (totals.get(studentId) || 0) + liveMinutes);
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
async function applyAwardEntries(db, centerId, range, target, awards) {
    if (awards.length === 0)
        return [];
    const appliedAwards = [];
    for (const award of awards) {
        const progressRef = db.doc(`centers/${centerId}/growthProgress/${award.studentId}`);
        const appliedAward = await db.runTransaction(async (transaction) => {
            const progressSnap = await transaction.get(progressRef);
            const progressData = progressSnap.exists ? progressSnap.data() : {};
            const dailyPointStatus = isPlainObject(progressData.dailyPointStatus)
                ? progressData.dailyPointStatus
                : {};
            const currentDayStatus = isPlainObject(dailyPointStatus[target.awardDateKey])
                ? dailyPointStatus[target.awardDateKey]
                : {};
            const awardedPoints = clampDailyPointAward(currentDayStatus, award.points).awardedPoints;
            const pointStatusPayload = Object.assign(Object.assign({}, currentDayStatus), { dailyPointAmount: admin.firestore.FieldValue.increment(awardedPoints) });
            if (range === "daily") {
                pointStatusPayload.dailyRankRewardAmount = awardedPoints;
                pointStatusPayload.dailyRankRewardRank = award.rank;
                pointStatusPayload.dailyTopRewardAmount = awardedPoints;
            }
            else if (range === "weekly") {
                pointStatusPayload.weeklyRankRewardAmount = awardedPoints;
                pointStatusPayload.weeklyRankRewardRank = award.rank;
            }
            else {
                pointStatusPayload.monthlyRankRewardAmount = awardedPoints;
                pointStatusPayload.monthlyRankRewardRank = award.rank;
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
                const notificationRef = db.doc(`centers/${centerId}/studentNotifications/ranking_reward_${range}_${target.periodKey}_${award.studentId}`);
                transaction.set(notificationRef, {
                    centerId,
                    studentId: award.studentId,
                    teacherId: "ranking-system",
                    teacherName: "랭킹 시스템",
                    type: "ranking_reward",
                    title: `${RANKING_RANGE_LABEL[range]} 랭킹 ${award.rank}위 축하`,
                    message: buildRankingRewardNotificationMessage(range, Object.assign(Object.assign({}, award), { points: awardedPoints })),
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
            return Object.assign(Object.assign({}, award), { points: awardedPoints });
        });
        appliedAwards.push(appliedAward);
    }
    return appliedAwards;
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
                const appliedAwards = await applyAwardEntries(db, centerId, "daily", {
                    periodKey: candidate.periodKey,
                    awardDateKey,
                }, awards);
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
                    const appliedAwards = await applyAwardEntries(db, centerId, "weekly", {
                        periodKey: weeklyCandidate.periodKey,
                        awardDateKey,
                    }, awards);
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
                    const appliedAwards = await applyAwardEntries(db, centerId, "monthly", {
                        periodKey: monthlyCandidate.periodKey,
                        awardDateKey,
                    }, awards);
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