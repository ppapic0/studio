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
exports.scheduledRankingRewardSettlement = exports.reissueDailyRankingRewardV2Secure = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const region = "asia-northeast3";
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const WEEKDAY_DAILY_RANK_START_HOUR = 17;
const WEEKEND_DAILY_RANK_START_HOUR = 8;
const DAILY_RANK_END_HOUR = 1;
const DAILY_RANK_REWARD_DELAY_MINUTES = 5;
const ACTIVE_LIVE_RANK_STATUSES = new Set(["studying"]);
const MONTHLY_RANK_REWARD_FIRST_ELIGIBLE_PERIOD_KEY = "2026-05";
const MONTHLY_RANK_REWARD_PRELAUNCH_SKIP_REASON = "monthly_rank_rewards_start_from_2026_05";
const RANKING_ENGINE_VERSION = "v2";
const DEFAULT_DAILY_RANK_REISSUE_DATE_KEY = "2026-04-26";
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
function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60 * 1000);
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
function asNonEmptyString(value) {
    return typeof value === "string" ? value.trim() : "";
}
function normalizeDailyPointEventEntry(value) {
    var _a, _b, _c;
    if (!isPlainObject(value))
        return null;
    const id = asNonEmptyString(value.id);
    const source = asNonEmptyString(value.source);
    const label = asNonEmptyString(value.label);
    const points = Math.max(0, Math.floor((_a = parseFiniteNumber(value.points)) !== null && _a !== void 0 ? _a : 0));
    const createdAt = asNonEmptyString(value.createdAt);
    if (!id || !source || !label || points <= 0 || !createdAt)
        return null;
    if (!["study_box", "daily_rank", "weekly_rank", "monthly_rank", "plan_completion", "manual_adjustment", "legacy"].includes(source)) {
        return null;
    }
    const event = {
        id,
        source,
        label,
        points,
        createdAt,
    };
    const range = asNonEmptyString(value.range);
    if (range === "daily" || range === "weekly" || range === "monthly")
        event.range = range;
    const rank = Math.max(0, Math.floor((_b = parseFiniteNumber(value.rank)) !== null && _b !== void 0 ? _b : 0));
    if (rank > 0)
        event.rank = rank;
    const periodKey = asNonEmptyString(value.periodKey);
    if (periodKey)
        event.periodKey = periodKey;
    const awardDateKey = asNonEmptyString(value.awardDateKey);
    if (awardDateKey)
        event.awardDateKey = awardDateKey;
    const paidAt = asNonEmptyString(value.paidAt);
    if (paidAt)
        event.paidAt = paidAt;
    const deltaPoints = Math.round((_c = parseFiniteNumber(value.deltaPoints)) !== null && _c !== void 0 ? _c : Number.NaN);
    if (Number.isFinite(deltaPoints) && deltaPoints !== 0) {
        event.deltaPoints = deltaPoints;
    }
    const direction = asNonEmptyString(value.direction);
    if (direction === "add" || direction === "subtract") {
        event.direction = direction;
    }
    const reason = asNonEmptyString(value.reason);
    if (reason)
        event.reason = reason.slice(0, 160);
    return event;
}
function normalizeDailyPointEvents(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .map((entry) => normalizeDailyPointEventEntry(entry))
        .filter((entry) => entry !== null)
        .slice(-80);
}
function upsertDailyPointEvent(existing, event) {
    const next = new Map();
    normalizeDailyPointEvents(existing).forEach((entry) => {
        next.set(entry.id, entry);
    });
    next.set(event.id, event);
    return Array.from(next.values()).slice(-80);
}
function normalizeStudyBoxHoursFromUnknown(value) {
    if (!Array.isArray(value))
        return [];
    return Array.from(new Set(value
        .map((entry) => {
        var _a;
        if (typeof entry === "number")
            return entry;
        if (typeof entry === "string") {
            const trimmed = entry.trim().toLowerCase();
            if (!trimmed)
                return Number.NaN;
            const legacyMatch = trimmed.match(/^(\d+)\s*(?:h|시간)$/);
            return Number((_a = legacyMatch === null || legacyMatch === void 0 ? void 0 : legacyMatch[1]) !== null && _a !== void 0 ? _a : trimmed);
        }
        return Number.NaN;
    })
        .filter((entry) => Number.isFinite(entry) && entry >= 1 && entry <= 8)
        .map((entry) => Math.round(entry)))).sort((a, b) => a - b);
}
function getStudyBoxRewardPointByHour(dayStatus) {
    const rewardByHour = new Map();
    if (!Array.isArray(dayStatus.studyBoxRewards))
        return rewardByHour;
    dayStatus.studyBoxRewards.forEach((entry) => {
        var _a, _b;
        if (!isPlainObject(entry))
            return;
        const milestone = Math.round((_a = parseFiniteNumber(entry.milestone)) !== null && _a !== void 0 ? _a : Number.NaN);
        if (!Number.isFinite(milestone) || milestone < 1 || milestone > 8)
            return;
        rewardByHour.set(milestone, Math.max(0, Math.floor((_b = parseFiniteNumber(entry.awardedPoints)) !== null && _b !== void 0 ? _b : 0)));
    });
    return rewardByHour;
}
function resolveOpenedStudyBoxHoursFromDayStatus(dayStatus) {
    var _a;
    const explicitOpenedStudyBoxes = normalizeStudyBoxHoursFromUnknown(dayStatus.openedStudyBoxes);
    const claimedStudyBoxes = normalizeStudyBoxHoursFromUnknown(dayStatus.claimedStudyBoxes);
    if (claimedStudyBoxes.length === 0)
        return explicitOpenedStudyBoxes;
    const rewardByHour = getStudyBoxRewardPointByHour(dayStatus);
    if (explicitOpenedStudyBoxes.some((hour) => !rewardByHour.has(hour))) {
        return explicitOpenedStudyBoxes;
    }
    const persistedDailyPointAmount = Math.max(0, Math.floor((_a = parseFiniteNumber(dayStatus.dailyPointAmount)) !== null && _a !== void 0 ? _a : 0));
    const studyBoxAwardedPoints = Math.max(0, persistedDailyPointAmount - getRankRewardAwardTotal(dayStatus));
    const explicitOpenedStudyBoxPoints = explicitOpenedStudyBoxes.reduce((total, hour) => { var _a; return total + ((_a = rewardByHour.get(hour)) !== null && _a !== void 0 ? _a : 0); }, 0);
    const remainingAwardedStudyBoxPoints = Math.max(0, studyBoxAwardedPoints - explicitOpenedStudyBoxPoints);
    const missingClaimedStudyBoxes = claimedStudyBoxes.filter((hour) => !explicitOpenedStudyBoxes.includes(hour) && rewardByHour.has(hour));
    if (missingClaimedStudyBoxes.length === 0)
        return explicitOpenedStudyBoxes;
    const missingClaimedRewardTotal = missingClaimedStudyBoxes.reduce((total, hour) => { var _a; return total + ((_a = rewardByHour.get(hour)) !== null && _a !== void 0 ? _a : 0); }, 0);
    if (missingClaimedRewardTotal > 0 && remainingAwardedStudyBoxPoints < missingClaimedRewardTotal) {
        return explicitOpenedStudyBoxes;
    }
    return normalizeStudyBoxHoursFromUnknown([...explicitOpenedStudyBoxes, ...missingClaimedStudyBoxes]);
}
function getOpenedStudyBoxAwardTotal(dayStatus) {
    const rewardByHour = getStudyBoxRewardPointByHour(dayStatus);
    return resolveOpenedStudyBoxHoursFromDayStatus(dayStatus).reduce((total, hour) => { var _a; return total + ((_a = rewardByHour.get(hour)) !== null && _a !== void 0 ? _a : 0); }, 0);
}
function getLegacyDailyPointAwardTotal(dayStatus) {
    const studyBoxPoints = getOpenedStudyBoxAwardTotal(dayStatus);
    const rankRewardPoints = getRankRewardAwardTotal(dayStatus);
    return studyBoxPoints + rankRewardPoints;
}
function getDailyAwardedPointTotal(dayStatus) {
    var _a;
    const dailyPointAmount = Math.max(0, Math.floor((_a = parseFiniteNumber(dayStatus.dailyPointAmount)) !== null && _a !== void 0 ? _a : 0));
    if (hasManualPointAdjustment(dayStatus)) {
        return dailyPointAmount;
    }
    return Math.max(dailyPointAmount, getLegacyDailyPointAwardTotal(dayStatus));
}
function hasManualPointAdjustment(dayStatus) {
    var _a;
    const manualAdjustmentPoints = Math.round((_a = parseFiniteNumber(dayStatus.manualAdjustmentPoints)) !== null && _a !== void 0 ? _a : 0);
    if (manualAdjustmentPoints !== 0)
        return true;
    return normalizeDailyPointEvents(dayStatus.pointEvents).some((entry) => { var _a; return entry.source === "manual_adjustment" && Math.round((_a = parseFiniteNumber(entry.deltaPoints)) !== null && _a !== void 0 ? _a : 0) !== 0; });
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
function resolveRankingRewardAwardPoints(range, dayStatus, requestedPoints) {
    if (range === "daily") {
        return clampDailyPointAward(dayStatus, requestedPoints).awardedPoints;
    }
    return Math.max(0, Math.floor(requestedPoints));
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
function isWeekendCompetitionDate(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
}
function getCompetitionStartHour(targetDate) {
    return isWeekendCompetitionDate(targetDate) ? WEEKEND_DAILY_RANK_START_HOUR : WEEKDAY_DAILY_RANK_START_HOUR;
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
        awardsAt: addMinutes(endsAt, DAILY_RANK_REWARD_DELAY_MINUTES),
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
function buildStudentDateRankKey(studentId, dateKey) {
    return `${studentId}\u001f${dateKey}`;
}
function addRankMinutesByDate(target, studentId, dateKey, minutes) {
    if (!studentId || !dateKey || minutes <= 0)
        return;
    const key = buildStudentDateRankKey(studentId, dateKey);
    target.set(key, (target.get(key) || 0) + minutes);
}
function foldRankMinutesByDate(source) {
    const totals = new Map();
    source.forEach((minutes, compositeKey) => {
        const separatorIndex = compositeKey.indexOf("\u001f");
        const studentId = separatorIndex >= 0 ? compositeKey.slice(0, separatorIndex) : compositeKey;
        if (!studentId || minutes <= 0)
            return;
        totals.set(studentId, (totals.get(studentId) || 0) + minutes);
    });
    return totals;
}
function getStudyLogDayStudentId(docSnap, data) {
    var _a;
    const directStudentId = typeof data.studentId === "string" && data.studentId.trim()
        ? data.studentId.trim()
        : "";
    return directStudentId || ((_a = docSnap.ref.parent.parent) === null || _a === void 0 ? void 0 : _a.id) || "";
}
function getStudyLogDayDateKey(docSnap, data) {
    return typeof data.dateKey === "string" && data.dateKey.trim()
        ? data.dateKey.trim()
        : docSnap.id;
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
function formatDateKeyLabel(dateKey) {
    if (!dateKey)
        return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
    if (!match)
        return null;
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isFinite(month) || !Number.isFinite(day))
        return null;
    return `${month}월 ${day}일`;
}
function formatMonthKeyLabel(monthKey) {
    if (!monthKey)
        return null;
    const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
    if (!match)
        return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month))
        return null;
    return `${year}년 ${month}월`;
}
function isMonthlyRankRewardEligiblePeriod(periodKey) {
    return periodKey >= MONTHLY_RANK_REWARD_FIRST_ELIGIBLE_PERIOD_KEY;
}
function buildRankingRewardPeriodLabel(range, periodKey, awardDateKey) {
    if (range === "daily") {
        return formatDateKeyLabel(periodKey || awardDateKey);
    }
    if (range === "weekly") {
        const [startKey, endKey] = (periodKey || "").split("_");
        const startLabel = formatDateKeyLabel(startKey);
        const endLabel = formatDateKeyLabel(endKey);
        if (startLabel && endLabel)
            return `${startLabel}~${endLabel}`;
        return startLabel || endLabel || null;
    }
    if (range === "monthly") {
        return formatMonthKeyLabel(periodKey);
    }
    return null;
}
function buildRankingRewardNotificationTitle(range, rank, periodKey, awardDateKey) {
    const rangeLabel = RANKING_RANGE_LABEL[range];
    const periodLabel = buildRankingRewardPeriodLabel(range, periodKey, awardDateKey);
    const baseLabel = `${rangeLabel} 랭킹 ${rank}위 축하`;
    return periodLabel ? `${periodLabel} ${baseLabel}` : baseLabel;
}
function buildRankingRewardNotificationMessageWithPeriod(range, award, periodKey, awardDateKey) {
    const rangeLabel = RANKING_RANGE_LABEL[range];
    const periodLabel = buildRankingRewardPeriodLabel(range, periodKey, awardDateKey);
    const rewardLabel = `${rangeLabel} 랭킹 ${award.rank}위로 ${award.points.toLocaleString()}포인트가 지급되었어요.`;
    return periodLabel
        ? `${periodLabel} ${rewardLabel} 알림함에서 다시 확인할 수 있습니다.`
        : `${rewardLabel} 알림함에서 다시 확인할 수 있습니다.`;
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
        if (!docSnap.exists)
            return [];
        const data = docSnap.data();
        const studentId = getStudyLogDayStudentId(docSnap, data);
        const dateKey = getStudyLogDayDateKey(docSnap, data);
        if (!studentId || !dateKey || isSyntheticStudentId(studentId) || !context.shouldInclude(studentId))
            return [];
        return [{
                studentId,
                dateKey,
                snapshotRef: docSnap.ref.collection("sessions"),
            }];
    });
    const minutesByStudentDate = new Map();
    for (const chunk of chunkItems(sessionRequests, 40)) {
        if (chunk.length === 0)
            continue;
        const chunkSnapshots = await Promise.all(chunk.map(({ snapshotRef }) => snapshotRef.get()));
        chunkSnapshots.forEach((snapshot, index) => {
            var _a, _b, _c, _d;
            const fallbackStudentId = (_b = (_a = chunk[index]) === null || _a === void 0 ? void 0 : _a.studentId) !== null && _b !== void 0 ? _b : "";
            const fallbackDateKey = (_d = (_c = chunk[index]) === null || _c === void 0 ? void 0 : _c.dateKey) !== null && _d !== void 0 ? _d : "";
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const studentId = typeof data.studentId === "string" && data.studentId.trim()
                    ? data.studentId.trim()
                    : fallbackStudentId;
                const dateKey = typeof data.dateKey === "string" && data.dateKey.trim()
                    ? data.dateKey.trim()
                    : fallbackDateKey;
                const { startedAtMs, referenceMs } = getSessionReferenceMillis(data);
                const value = getDailyWindowOverlapMinutes(startedAtMs, referenceMs, dailyWindow);
                if (!studentId || !dateKey || isSyntheticStudentId(studentId) || !context.shouldInclude(studentId) || value <= 0)
                    return;
                addRankMinutesByDate(minutesByStudentDate, studentId, dateKey, value);
            });
        });
    }
    const totals = foldRankMinutesByDate(minutesByStudentDate);
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
            var _a, _b;
            const data = docSnap.data();
            const studentId = typeof data.studentId === "string" ? data.studentId : docSnap.id;
            const baseValue = Number((_a = data.totalStudyMinutes) !== null && _a !== void 0 ? _a : 0);
            const adjustment = Number((_b = data.manualAdjustmentMinutes) !== null && _b !== void 0 ? _b : 0);
            const value = Math.max(0, (Number.isFinite(baseValue) ? baseValue : 0) + (Number.isFinite(adjustment) ? adjustment : 0));
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
            const awardedPoints = resolveRankingRewardAwardPoints(range, currentDayStatus, award.points);
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
            if (awardedPoints > 0) {
                const source = `${range}_rank`;
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
            }
            else {
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
                const notificationRef = db.doc(`centers/${centerId}/studentNotifications/ranking_reward_${range}_${target.periodKey}_${award.studentId}`);
                transaction.set(notificationRef, {
                    centerId,
                    studentId: award.studentId,
                    teacherId: "ranking-system",
                    teacherName: "랭킹 시스템",
                    type: "ranking_reward",
                    title: buildRankingRewardNotificationTitle(range, award.rank, target.periodKey, target.awardDateKey),
                    message: buildRankingRewardNotificationMessageWithPeriod(range, Object.assign(Object.assign({}, award), { points: awardedPoints }), target.periodKey, target.awardDateKey),
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
        if (nowKst.getTime() < window.awardsAt.getTime())
            continue;
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
function buildRankingRewardAwardTime(periodEndDate) {
    const awardAt = shiftKstDate(startOfKstDay(periodEndDate), 1);
    awardAt.setHours(1, DAILY_RANK_REWARD_DELAY_MINUTES, 0, 0);
    return awardAt;
}
function getWeeklySettlementCandidate(nowKst) {
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
function getMonthlySettlementCandidate(nowKst) {
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
function isValidDateKey(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const [year, month, day] = value.split("-").map((part) => Number(part));
    const date = new Date(year, month - 1, day);
    return (date.getFullYear() === year
        && date.getMonth() === month - 1
        && date.getDate() === day);
}
function parseDateKeyAsKstDate(dateKey) {
    const [year, month, day] = dateKey.split("-").map((part) => Number(part));
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date;
}
function normalizeMembershipRoleValue(value) {
    if (typeof value !== "string")
        return "";
    const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (normalized === "owner" || normalized === "admin" || normalized === "centermanager" || normalized === "centeradmin") {
        return "centerAdmin";
    }
    if (normalized === "teacher")
        return "teacher";
    if (normalized === "parent")
        return "parent";
    if (normalized === "student")
        return "student";
    return "";
}
function isAdminRole(value) {
    return normalizeMembershipRoleValue(value) === "centerAdmin";
}
async function assertActiveCenterAdmin(db, centerId, uid) {
    const [memberSnap, userCenterSnap] = await Promise.all([
        db.doc(`centers/${centerId}/members/${uid}`).get(),
        db.doc(`userCenters/${uid}/centers/${centerId}`).get(),
    ]);
    const memberData = memberSnap.exists ? memberSnap.data() : null;
    const userCenterData = userCenterSnap.exists ? userCenterSnap.data() : null;
    const memberRole = normalizeMembershipRoleValue(memberData === null || memberData === void 0 ? void 0 : memberData.role);
    const userCenterRole = normalizeMembershipRoleValue(userCenterData === null || userCenterData === void 0 ? void 0 : userCenterData.role);
    const memberIsActive = isAdminRole(memberRole) && normalizeMembershipStatus(memberData === null || memberData === void 0 ? void 0 : memberData.status) === "active";
    const userCenterIsActive = isAdminRole(userCenterRole) && normalizeMembershipStatus(userCenterData === null || userCenterData === void 0 ? void 0 : userCenterData.status) === "active";
    if (!memberIsActive && !userCenterIsActive) {
        throw new functions.https.HttpsError("permission-denied", "Only active center admins can reissue ranking rewards.", {
            userMessage: "센터 관리자만 랭킹 포인트 재정산을 실행할 수 있습니다.",
        });
    }
}
function isDailyRankEventForPeriod(event, periodKey) {
    if (event.source !== "daily_rank")
        return false;
    if (event.periodKey && event.periodKey !== periodKey)
        return false;
    if (event.periodKey === periodKey)
        return true;
    return event.id.startsWith(`rank:daily:${periodKey}:`);
}
function getDailyRankAwardPointsForPeriod(dayStatus, periodKey) {
    var _a, _b;
    const fieldPoints = Math.max(Math.floor((_a = parseFiniteNumber(dayStatus.dailyRankRewardAmount)) !== null && _a !== void 0 ? _a : 0), Math.floor((_b = parseFiniteNumber(dayStatus.dailyTopRewardAmount)) !== null && _b !== void 0 ? _b : 0));
    const eventPoints = normalizeDailyPointEvents(dayStatus.pointEvents)
        .filter((event) => isDailyRankEventForPeriod(event, periodKey))
        .reduce((total, event) => total + Math.max(0, Math.floor(event.points)), 0);
    return Math.max(0, fieldPoints, eventPoints);
}
async function collectDailyRankAwardStudentIds(db, centerId, periodKey) {
    const settlementRef = db.doc(`centers/${centerId}/rankingRewardSettlements/daily_${periodKey}`);
    const [settlementSnap, progressSnap] = await Promise.all([
        settlementRef.get(),
        db.collection(`centers/${centerId}/growthProgress`).get(),
    ]);
    const studentIds = new Set();
    const settlementData = settlementSnap.exists ? settlementSnap.data() : {};
    if (Array.isArray(settlementData.awards)) {
        settlementData.awards.forEach((entry) => {
            if (!isPlainObject(entry))
                return;
            const studentId = asNonEmptyString(entry.studentId);
            if (studentId && !isSyntheticStudentId(studentId))
                studentIds.add(studentId);
        });
    }
    progressSnap.forEach((docSnap) => {
        if (isSyntheticStudentId(docSnap.id))
            return;
        const data = docSnap.data();
        const dailyPointStatus = isPlainObject(data.dailyPointStatus)
            ? data.dailyPointStatus
            : {};
        const dayStatus = isPlainObject(dailyPointStatus[periodKey])
            ? dailyPointStatus[periodKey]
            : {};
        if (getDailyRankAwardPointsForPeriod(dayStatus, periodKey) > 0) {
            studentIds.add(docSnap.id);
        }
    });
    return Array.from(studentIds);
}
async function cancelDailyRankAwardForStudent(params) {
    const { db, centerId, studentId, periodKey, adminUid, reissueId } = params;
    const progressRef = db.doc(`centers/${centerId}/growthProgress/${studentId}`);
    const logRef = db.collection(`centers/${centerId}/rankingRewardReissueLogs`).doc();
    return db.runTransaction(async (transaction) => {
        var _a, _b, _c;
        const progressSnap = await transaction.get(progressRef);
        if (!progressSnap.exists)
            return null;
        const progressData = progressSnap.data();
        const dailyPointStatus = isPlainObject(progressData.dailyPointStatus)
            ? progressData.dailyPointStatus
            : {};
        const currentDayStatus = isPlainObject(dailyPointStatus[periodKey])
            ? dailyPointStatus[periodKey]
            : {};
        const cancelPoints = getDailyRankAwardPointsForPeriod(currentDayStatus, periodKey);
        if (cancelPoints <= 0)
            return null;
        const currentBalance = Math.max(0, Math.floor((_a = parseFiniteNumber(progressData.pointsBalance)) !== null && _a !== void 0 ? _a : 0));
        const currentTotalEarned = Math.max(0, Math.floor((_b = parseFiniteNumber(progressData.totalPointsEarned)) !== null && _b !== void 0 ? _b : 0));
        const currentDailyAmount = Math.max(0, Math.floor((_c = parseFiniteNumber(currentDayStatus.dailyPointAmount)) !== null && _c !== void 0 ? _c : 0));
        const balanceDeduction = Math.min(currentBalance, cancelPoints);
        const balanceDeficit = Math.max(0, cancelPoints - currentBalance);
        const nextEvents = normalizeDailyPointEvents(currentDayStatus.pointEvents)
            .filter((event) => !isDailyRankEventForPeriod(event, periodKey));
        const nextDayStatus = Object.assign(Object.assign({}, currentDayStatus), { dailyPointAmount: Math.max(0, currentDailyAmount - cancelPoints), dailyRankRewardAmount: 0, dailyTopRewardAmount: 0, dailyRankRewardRank: 0, pointEvents: nextEvents, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
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
exports.reissueDailyRankingRewardV2Secure = functions
    .region(region)
    .runWith({ timeoutSeconds: 540, memory: "1GB" })
    .https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = asNonEmptyString(data === null || data === void 0 ? void 0 : data.centerId);
    const periodKey = asNonEmptyString(data === null || data === void 0 ? void 0 : data.dateKey) || DEFAULT_DAILY_RANK_REISSUE_DATE_KEY;
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
    const cancellations = [];
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
        if (cancellation)
            cancellations.push(cancellation);
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
exports.scheduledRankingRewardSettlement = functions
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
        let contextPromise = null;
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
            }
            catch (error) {
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
                    const awards = await buildWeeklyAwardEntries(db, centerId, weeklyCandidate.startDate, weeklyCandidate.endDate, await getContext());
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
                }
                catch (error) {
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