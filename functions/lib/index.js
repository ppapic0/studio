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
exports.generateStudyPlan = exports.syncGiftishowCatalogSecure = exports.scheduledGiftishowCatalogSync = exports.saveGiftishowSettingsSecure = exports.resendGiftishowOrderSecure = exports.rejectGiftishowOrderSecure = exports.reconcilePendingGiftishowOrders = exports.getGiftishowBizmoneySecure = exports.createGiftishowOrderRequestSecure = exports.cancelGiftishowOrderSecure = exports.approveGiftishowOrderSecure = exports.scheduledRankingRewardSettlement = exports.ensureCurrentUserMemberships = exports.scheduledOpenClawSnapshotExport = exports.generateOpenClawSnapshot = exports.refreshClassroomSignals = exports.stopStudentStudySessionSecure = exports.openStudyRewardBoxSecure = exports.submitAttendanceRequestSecure = exports.applyPenaltyEventSecure = exports.cancelPointBoostEventSecure = exports.createPointBoostEventSecure = exports.scheduledClassroomSignalsRefresh = exports.scheduledDailyRiskAlert = exports.onSessionWritten = exports.onSessionCreated = exports.scheduledWeeklyReport = exports.cleanupOldDocuments = exports.scheduledAttendanceCheck = exports.runLateArrivalCheck = exports.sendPaymentReminderBatch = exports.notifyDailyReportReady = exports.notifyAttendanceSms = exports.scheduledSmsQueueDispatcher = exports.updateSmsRecipientPreference = exports.cancelSmsQueueItem = exports.retrySmsQueueItem = exports.saveNotificationSettingsSecure = exports.confirmInvoicePayment = exports.completeSignupWithInvite = exports.redeemInviteCode = exports.createCounselingDemoBundle = exports.registerStudent = exports.updateStudentAccount = exports.deleteTeacherAccount = exports.deleteStudentAccount = void 0;
const params_1 = require("firebase-functions/params");
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const crypto_1 = require("crypto");
const geminiClient_1 = require("./geminiClient");
const openclawSnapshot_1 = require("./openclawSnapshot");
const plannerSchema_1 = require("./plannerSchema");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const region = "asia-northeast3";
const geminiApiKey = (0, params_1.defineSecret)("GEMINI_API_KEY");
const allowedRoles = ["student", "teacher", "parent", "centerAdmin"];
const adminRoles = new Set(["centerAdmin", "owner", "admin", "centerManager"]);
const SMS_BYTE_LIMIT = 90;
const PARENT_LINK_FAILED_ATTEMPT_LIMIT = 5;
const PARENT_LINK_FAILED_ATTEMPT_WINDOW_MS = 30 * 60 * 1000;
const PARENT_LINK_FAILED_ATTEMPT_LOCK_MS = 30 * 60 * 1000;
const PARENT_LINK_LOOKUP_COLLECTION = "parentLinkCodeLookup";
const ATTENDANCE_REQUEST_PENALTY_POINTS = {
    late: 1,
    absence: 2,
};
const SECURE_PENALTY_SOURCE_POINTS = {
    manual: 1,
    routine_missing: 1,
};
const SENSITIVE_USER_MESSAGE_PATTERNS = [
    /\b(firebase|firestore|identitytoolkit|googleapis|gstatic)\b/i,
    /\b(auth|functions)\/[a-z0-9-]+/i,
    /\b(permission[-_ ]?denied|failed[-_ ]?precondition|invalid[-_ ]?argument|already[-_ ]?exists|deadline[-_ ]?exceeded|unauthenticated|internal|not[-_ ]?found)\b/i,
    /\b(api[_ -]?key|apikey|secret|token|credential|service account|bearer|project[_ -]?id)\b/i,
    /\bhttp\s*\d{3}\b/i,
    /https?:\/\//i,
    /\bmissing or insufficient permissions\b/i,
    /\bat\s+\S+:\d+:\d+/i,
    /firebaseerror:/i,
];
const DEFAULT_SMS_TEMPLATES = {
    study_start: "[{centerName}] {studentName} 학생 {time} 공부시작. 오늘 학습 흐름 확인 부탁드립니다.",
    away_start: "[{centerName}] {studentName} 학생 {time} 외출. 복귀 후 다시 공부를 이어갑니다.",
    away_end: "[{centerName}] {studentName} 학생 {time} 복귀. 다시 공부를 시작했습니다.",
    study_end: "[{centerName}] {studentName} 학생 {time} 공부종료. 오늘 학습 마무리했습니다.",
    late_alert: "{studentName}학생이 {expectedTime}까지 등원하지 않았습니다.",
};
const STUDY_BOX_REWARD_RANGE_BY_RARITY = {
    common: [1, 10],
    rare: [10, 20],
    epic: [20, 30],
};
const EARLY_STUDY_BOX_RARITY_WEIGHTS = [
    { rarity: "common", weight: 80 },
    { rarity: "rare", weight: 17 },
    { rarity: "epic", weight: 3 },
];
const LATE_STUDY_BOX_RARITY_WEIGHTS = [
    { rarity: "common", weight: 60 },
    { rarity: "rare", weight: 30 },
    { rarity: "epic", weight: 10 },
];
const DAILY_POINT_EARN_CAP = 1000;
const ACTIVE_STUDY_ATTENDANCE_STATUS_VALUES = ["studying", "away", "break"];
const ACTIVE_STUDY_ATTENDANCE_STATUSES = new Set(ACTIVE_STUDY_ATTENDANCE_STATUS_VALUES);
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
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
function normalizeStoredStudyBoxReward(value) {
    var _a, _b, _c, _d, _e, _f;
    if (!isPlainObject(value))
        return null;
    const milestone = Math.round((_a = parseFiniteNumber(value.milestone)) !== null && _a !== void 0 ? _a : Number.NaN);
    const rarity = asTrimmedString(value.rarity);
    const minReward = Math.round((_b = parseFiniteNumber(value.minReward)) !== null && _b !== void 0 ? _b : Number.NaN);
    const maxReward = Math.round((_c = parseFiniteNumber(value.maxReward)) !== null && _c !== void 0 ? _c : Number.NaN);
    const awardedPoints = Math.round((_d = parseFiniteNumber(value.awardedPoints)) !== null && _d !== void 0 ? _d : Number.NaN);
    const basePoints = Math.round((_e = parseFiniteNumber(value.basePoints)) !== null && _e !== void 0 ? _e : awardedPoints);
    const multiplier = Math.max(1, (_f = parseFiniteNumber(value.multiplier)) !== null && _f !== void 0 ? _f : 1);
    const earnedAt = asTrimmedString(value.earnedAt);
    const boostEventId = asTrimmedString(value.boostEventId);
    if (!Number.isFinite(milestone) || milestone < 1 || milestone > 8)
        return null;
    if (rarity !== "common" && rarity !== "rare" && rarity !== "epic")
        return null;
    if (!Number.isFinite(minReward) || !Number.isFinite(maxReward) || !Number.isFinite(basePoints) || !Number.isFinite(awardedPoints))
        return null;
    return {
        milestone,
        rarity,
        minReward,
        maxReward,
        basePoints,
        awardedPoints,
        multiplier,
        earnedAt: earnedAt || null,
        boostEventId: boostEventId || null,
    };
}
function normalizeStudyBoxRewardEntries(existing) {
    return Array.isArray(existing)
        ? existing
            .map((entry) => normalizeStoredStudyBoxReward(entry))
            .filter((entry) => Boolean(entry))
        : [];
}
function upsertStudyBoxRewardEntries(existing, reward) {
    const entries = normalizeStudyBoxRewardEntries(existing);
    const next = new Map();
    entries.forEach((entry) => {
        next.set(entry.milestone, entry);
    });
    next.set(reward.milestone, reward);
    return Array.from(next.values()).sort((a, b) => a.milestone - b.milestone);
}
function getLegacyDailyPointAwardTotal(dayStatus) {
    const studyBoxPoints = normalizeStudyBoxRewardEntries(dayStatus.studyBoxRewards).reduce((total, entry) => total + Math.max(0, Math.floor(entry.awardedPoints)), 0);
    const rankRewardPoints = ["dailyRankRewardAmount", "weeklyRankRewardAmount", "monthlyRankRewardAmount"].reduce((total, key) => { var _a; return total + Math.max(0, Math.floor((_a = parseFiniteNumber(dayStatus[key])) !== null && _a !== void 0 ? _a : 0)); }, 0);
    return studyBoxPoints + rankRewardPoints;
}
function getDailyAwardedPointTotal(dayStatus) {
    var _a;
    const dailyPointAmount = Math.max(0, Math.floor((_a = parseFiniteNumber(dayStatus.dailyPointAmount)) !== null && _a !== void 0 ? _a : 0));
    return Math.max(dailyPointAmount, getLegacyDailyPointAwardTotal(dayStatus));
}
function getRankRewardAwardTotal(dayStatus) {
    return ["dailyRankRewardAmount", "weeklyRankRewardAmount", "monthlyRankRewardAmount"].reduce((total, key) => { var _a; return total + Math.max(0, Math.floor((_a = parseFiniteNumber(dayStatus[key])) !== null && _a !== void 0 ? _a : 0)); }, 0);
}
function resolveOpenedStudyBoxHoursFromDayStatus(dayStatus) {
    var _a;
    const explicitOpenedStudyBoxes = normalizeStudyBoxHoursFromUnknown(dayStatus.openedStudyBoxes);
    const claimedStudyBoxes = normalizeStudyBoxHoursFromUnknown(dayStatus.claimedStudyBoxes);
    if (claimedStudyBoxes.length === 0)
        return explicitOpenedStudyBoxes;
    const rewardEntries = normalizeStudyBoxRewardEntries(dayStatus.studyBoxRewards);
    const rewardByHour = new Map();
    rewardEntries.forEach((entry) => {
        rewardByHour.set(entry.milestone, Math.max(0, Math.floor(entry.awardedPoints)));
    });
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
function clampDailyPointAward(dayStatus, requestedPoints) {
    const normalizedRequestedPoints = Math.max(0, Math.floor(requestedPoints));
    const currentAwardedTotal = getDailyAwardedPointTotal(dayStatus);
    const remainingPoints = Math.max(0, DAILY_POINT_EARN_CAP - currentAwardedTotal);
    const awardedPoints = Math.min(normalizedRequestedPoints, remainingPoints);
    return {
        currentAwardedTotal,
        remainingPoints,
        awardedPoints,
    };
}
function getStudyBoxRarityWeights(milestone) {
    return milestone >= 5 ? LATE_STUDY_BOX_RARITY_WEIGHTS : EARLY_STUDY_BOX_RARITY_WEIGHTS;
}
function hashSeedToUInt32(input) {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
function seededUnitInterval(seed) {
    return hashSeedToUInt32(seed) / 0xffffffff;
}
function rollDeterministicStudyBoxRarity(milestone, seed) {
    var _a, _b;
    const weights = getStudyBoxRarityWeights(milestone);
    const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
    const rolled = seededUnitInterval(`${seed}:rarity`) * totalWeight;
    let cursor = 0;
    for (const entry of weights) {
        cursor += entry.weight;
        if (rolled < cursor)
            return entry.rarity;
    }
    return (_b = (_a = weights.at(-1)) === null || _a === void 0 ? void 0 : _a.rarity) !== null && _b !== void 0 ? _b : "common";
}
function buildDeterministicStudyBoxReward(params) {
    const { centerId, studentId, dateKey, milestone } = params;
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
function normalizePointBoostMode(value) {
    if (value === "day" || value === "window")
        return value;
    return null;
}
function normalizePointBoostMultiplier(value) {
    const multiplier = parseFiniteNumber(value);
    if (multiplier === null || !Number.isFinite(multiplier))
        return null;
    if (multiplier <= 1 || multiplier > 100)
        return null;
    return Number(multiplier.toFixed(2));
}
function isPointBoostEventCancelled(value) {
    return toMillisSafe(value === null || value === void 0 ? void 0 : value.cancelledAt) > 0;
}
function isPointBoostEventActiveAt(value, targetMs) {
    const event = value;
    const startAtMs = toMillisSafe(event === null || event === void 0 ? void 0 : event.startAt);
    const endAtMs = toMillisSafe(event === null || event === void 0 ? void 0 : event.endAt);
    if (startAtMs <= 0 || endAtMs <= 0)
        return false;
    if (isPointBoostEventCancelled(event))
        return false;
    return startAtMs <= targetMs && targetMs < endAtMs;
}
function doTimeRangesOverlap(startAtMs, endAtMs, otherStartAtMs, otherEndAtMs) {
    return startAtMs < otherEndAtMs && otherStartAtMs < endAtMs;
}
async function listPointBoostEventDocs(db, centerId, limitCount = 200) {
    const snap = await db
        .collection(`centers/${centerId}/pointBoostEvents`)
        .orderBy("startAt", "desc")
        .limit(limitCount)
        .get();
    return snap.docs;
}
function buildStudyTimelineSegments(params) {
    var _a, _b, _c, _d;
    const segments = [];
    params.sessionDocs.forEach((docSnap) => {
        var _a;
        const data = docSnap.data();
        const startAtMs = toMillisSafe(data.startTime);
        const durationMinutes = Math.max(0, Math.floor((_a = parseFiniteNumber(data.durationMinutes)) !== null && _a !== void 0 ? _a : 0));
        if (startAtMs <= 0 || durationMinutes <= 0)
            return;
        segments.push({ startAtMs, durationMinutes });
    });
    if (((_a = params.liveSessionStartMs) !== null && _a !== void 0 ? _a : 0) > 0 && ((_b = params.liveSessionMinutes) !== null && _b !== void 0 ? _b : 0) > 0) {
        segments.push({
            startAtMs: (_c = params.liveSessionStartMs) !== null && _c !== void 0 ? _c : 0,
            durationMinutes: Math.max(0, Math.floor((_d = params.liveSessionMinutes) !== null && _d !== void 0 ? _d : 0)),
        });
    }
    return segments.sort((left, right) => left.startAtMs - right.startAtMs);
}
function resolveStudyBoxMilestoneEarnedAtMs(params) {
    const thresholdMinutes = Math.max(1, Math.floor(params.milestone)) * 60;
    let cumulativeMinutes = 0;
    for (const segment of buildStudyTimelineSegments(params)) {
        const nextCumulativeMinutes = cumulativeMinutes + segment.durationMinutes;
        if (nextCumulativeMinutes < thresholdMinutes) {
            cumulativeMinutes = nextCumulativeMinutes;
            continue;
        }
        const remainingMinutes = Math.max(0, thresholdMinutes - cumulativeMinutes);
        return segment.startAtMs + remainingMinutes * 60 * 1000;
    }
    if (params.persistedDayMinutes >= thresholdMinutes) {
        return null;
    }
    return null;
}
function getAttendanceActivityRank(status) {
    if (status === "studying")
        return 0;
    if (status === "away" || status === "break")
        return 1;
    if (status === "absent")
        return 3;
    return 2;
}
function pickPreferredAttendanceSeatDoc(docs) {
    if (!docs.length)
        return null;
    return [...docs].sort((a, b) => {
        const aData = a.data();
        const bData = b.data();
        const rankDiff = getAttendanceActivityRank(asTrimmedString(aData.status)) - getAttendanceActivityRank(asTrimmedString(bData.status));
        if (rankDiff !== 0)
            return rankDiff;
        const aTime = toMillisSafe(aData.lastCheckInAt) || toMillisSafe(aData.updatedAt);
        const bTime = toMillisSafe(bData.lastCheckInAt) || toMillisSafe(bData.updatedAt);
        return bTime - aTime;
    })[0] || null;
}
function normalizePhoneNumber(raw) {
    if (typeof raw !== "string" && typeof raw !== "number")
        return "";
    const digits = String(raw).replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("01"))
        return digits;
    if (digits.length === 10 && digits.startsWith("01"))
        return digits;
    return "";
}
function resolveFirstValidPhoneNumber(...values) {
    for (const value of values) {
        const normalized = normalizePhoneNumber(value);
        if (normalized)
            return normalized;
    }
    return "";
}
function isCounselingDemoId(value) {
    if (typeof value !== "string")
        return false;
    const normalized = value.trim().toLowerCase();
    if (!normalized)
        return false;
    return (normalized.startsWith("counseling-demo-")
        || normalized.startsWith("demo-counseling-"));
}
function asRecord(value) {
    return value && typeof value === "object" ? value : null;
}
function isCounselingDemoRecord(value) {
    const record = asRecord(value);
    if (!record)
        return false;
    if (record.isCounselingDemo === true)
        return true;
    const accountKind = typeof record.accountKind === "string" ? record.accountKind.trim().toLowerCase() : "";
    return accountKind === "counseling-demo" || accountKind === "counseling_demo";
}
function shouldExcludeFromSmsQueries(value, id) {
    if (isCounselingDemoId(id))
        return true;
    const record = asRecord(value);
    if (!record)
        return false;
    if (isCounselingDemoRecord(record))
        return true;
    const exclusions = asRecord(record.operationalExclusions);
    return (exclusions === null || exclusions === void 0 ? void 0 : exclusions.sms) === true || (exclusions === null || exclusions === void 0 ? void 0 : exclusions.messages) === true;
}
function toKstDate(baseDate = new Date()) {
    const formatted = baseDate.toLocaleString("en-US", { timeZone: "Asia/Seoul" });
    return new Date(formatted);
}
function toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
function toTimeLabel(date) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}
function parseHourMinute(value) {
    if (typeof value !== "string")
        return null;
    const normalized = value.trim();
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalized))
        return null;
    const [hour, minute] = normalized.split(":").map((part) => Number(part));
    return { hour, minute };
}
function normalizeMembershipStatus(value) {
    if (typeof value !== "string")
        return "";
    return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}
function isActiveMembershipStatus(value) {
    const normalized = normalizeMembershipStatus(value);
    return !normalized || normalized === "active" || normalized === "approved" || normalized === "enabled" || normalized === "current";
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
function normalizeStudentMembershipStatusForWrite(value) {
    if (typeof value !== "string")
        return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === "active")
        return "active";
    if (normalized === "onhold" || normalized === "on_hold" || normalized === "pending")
        return "onHold";
    if (normalized === "withdrawn" || normalized === "inactive")
        return "withdrawn";
    return null;
}
async function resolveCenterMembershipRole(db, centerId, uid) {
    const [memberSnap, userCenterSnap] = await Promise.all([
        db.doc(`centers/${centerId}/members/${uid}`).get(),
        db.doc(`userCenters/${uid}/centers/${centerId}`).get(),
    ]);
    const memberData = memberSnap.exists ? memberSnap.data() : null;
    let memberRole = normalizeMembershipRoleValue(memberData === null || memberData === void 0 ? void 0 : memberData.role);
    if (memberRole && isActiveMembershipStatus(memberData === null || memberData === void 0 ? void 0 : memberData.status)) {
        return {
            role: memberRole,
            status: memberData === null || memberData === void 0 ? void 0 : memberData.status,
        };
    }
    const userCenterData = userCenterSnap.exists ? userCenterSnap.data() : null;
    const userCenterRole = normalizeMembershipRoleValue(userCenterData === null || userCenterData === void 0 ? void 0 : userCenterData.role);
    if (userCenterRole && isActiveMembershipStatus(userCenterData === null || userCenterData === void 0 ? void 0 : userCenterData.status)) {
        return {
            role: userCenterRole,
            status: userCenterData === null || userCenterData === void 0 ? void 0 : userCenterData.status,
        };
    }
    if (!memberRole) {
        const fallbackMemberSnap = await db
            .collection(`centers/${centerId}/members`)
            .where("id", "==", uid)
            .limit(1)
            .get();
        const fallbackMemberData = fallbackMemberSnap.empty ? null : fallbackMemberSnap.docs[0].data();
        memberRole = normalizeMembershipRoleValue(fallbackMemberData === null || fallbackMemberData === void 0 ? void 0 : fallbackMemberData.role);
        if (memberRole && isActiveMembershipStatus(fallbackMemberData === null || fallbackMemberData === void 0 ? void 0 : fallbackMemberData.status)) {
            return {
                role: memberRole,
                status: fallbackMemberData === null || fallbackMemberData === void 0 ? void 0 : fallbackMemberData.status,
            };
        }
        if (memberRole) {
            return {
                role: memberRole,
                status: fallbackMemberData === null || fallbackMemberData === void 0 ? void 0 : fallbackMemberData.status,
            };
        }
    }
    if (memberRole) {
        return {
            role: memberRole,
            status: memberData === null || memberData === void 0 ? void 0 : memberData.status,
        };
    }
    if (userCenterRole) {
        return {
            role: userCenterRole,
            status: userCenterData === null || userCenterData === void 0 ? void 0 : userCenterData.status,
        };
    }
    return { role: null, status: null };
}
function normalizeParentLinkCodeValue(value) {
    if (typeof value === "string") {
        return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return String(Math.trunc(value)).trim();
    }
    return "";
}
function normalizeUserFacingErrorMessage(raw) {
    return raw
        .replace(/^FirebaseError:\s*/i, "")
        .replace(/^\d+\s+FAILED_PRECONDITION:?\s*/i, "")
        .replace(/^\d+\s+INVALID_ARGUMENT:?\s*/i, "")
        .replace(/^\d+\s+ALREADY_EXISTS:?\s*/i, "")
        .replace(/^\d+\s+PERMISSION_DENIED:?\s*/i, "")
        .replace(/^\d+\s+INTERNAL:?\s*/i, "")
        .replace(/\s+/g, " ")
        .trim();
}
function isSensitiveUserFacingErrorMessage(message) {
    const normalized = normalizeUserFacingErrorMessage(message);
    if (!normalized)
        return true;
    if (normalized.length > 180)
        return true;
    if (normalized.includes("\n"))
        return true;
    return SENSITIVE_USER_MESSAGE_PATTERNS.some((pattern) => pattern.test(normalized));
}
function toSafeUserMessage(error, fallback) {
    const candidates = [];
    if (typeof error === "string") {
        candidates.push(error);
    }
    if (error && typeof error === "object") {
        const record = error;
        if (typeof record.message === "string") {
            candidates.push(record.message);
        }
        if (record.details && typeof record.details === "object") {
            const details = record.details;
            if (typeof details.userMessage === "string")
                candidates.push(details.userMessage);
            if (typeof details.message === "string")
                candidates.push(details.message);
            if (typeof details.error === "string")
                candidates.push(details.error);
        }
        else if (typeof record.details === "string") {
            candidates.push(record.details);
        }
    }
    for (const candidate of candidates) {
        const normalized = normalizeUserFacingErrorMessage(candidate);
        if (!normalized)
            continue;
        if (isSensitiveUserFacingErrorMessage(normalized))
            continue;
        return normalized;
    }
    return fallback;
}
function getParentLinkLookupRef(db, code) {
    return db.doc(`${PARENT_LINK_LOOKUP_COLLECTION}/${code}`);
}
function buildParentLinkLookupPayload(params) {
    const { code, centerId, studentId, studentName, timestamp, createdAt } = params;
    return {
        code,
        centerId,
        studentId,
        studentPath: `centers/${centerId}/students/${studentId}`,
        studentName,
        updatedAt: timestamp,
        createdAt: createdAt || timestamp,
    };
}
async function hasParentLinkCodeConflict(db, code, params = {}) {
    const normalizedCode = normalizeParentLinkCodeValue(code);
    if (!normalizedCode)
        return false;
    const lookupSnap = await getParentLinkLookupRef(db, normalizedCode).get();
    if (lookupSnap.exists) {
        const lookupData = lookupSnap.data();
        const lookupStudentId = asTrimmedString(lookupData === null || lookupData === void 0 ? void 0 : lookupData.studentId);
        const lookupCenterId = asTrimmedString(lookupData === null || lookupData === void 0 ? void 0 : lookupData.centerId);
        if (lookupStudentId &&
            lookupCenterId &&
            !(lookupStudentId === params.exceptStudentId && lookupCenterId === params.exceptCenterId)) {
            return true;
        }
    }
    let duplicateCandidates = [];
    try {
        const duplicateSnap = await db
            .collectionGroup("students")
            .where("parentLinkCode", "==", normalizedCode)
            .limit(20)
            .get();
        duplicateCandidates = duplicateSnap.docs;
    }
    catch (lookupError) {
        console.warn("[parent-link-lookup] collectionGroup duplicate lookup failed", {
            code: normalizedCode,
            message: (lookupError === null || lookupError === void 0 ? void 0 : lookupError.message) || lookupError,
        });
    }
    const asNumber = Number(normalizedCode);
    if (Number.isFinite(asNumber)) {
        try {
            const duplicateNumberSnap = await db
                .collectionGroup("students")
                .where("parentLinkCode", "==", asNumber)
                .limit(20)
                .get();
            for (const docSnap of duplicateNumberSnap.docs) {
                if (!duplicateCandidates.find((candidate) => candidate.ref.path === docSnap.ref.path)) {
                    duplicateCandidates.push(docSnap);
                }
            }
        }
        catch (lookupError) {
            console.warn("[parent-link-lookup] numeric duplicate lookup failed", {
                code: normalizedCode,
                message: (lookupError === null || lookupError === void 0 ? void 0 : lookupError.message) || lookupError,
            });
        }
    }
    for (const docSnap of duplicateCandidates) {
        const candidateCenterRef = docSnap.ref.parent.parent;
        if (!candidateCenterRef)
            continue;
        if (docSnap.id === params.exceptStudentId && candidateCenterRef.id === params.exceptCenterId) {
            continue;
        }
        const [candidateMemberSnap, candidateUserCenterSnap] = await Promise.all([
            db.doc(`centers/${candidateCenterRef.id}/members/${docSnap.id}`).get(),
            db.doc(`userCenters/${docSnap.id}/centers/${candidateCenterRef.id}`).get(),
        ]);
        const candidateMemberData = candidateMemberSnap.exists ? candidateMemberSnap.data() : null;
        const candidateUserCenterData = candidateUserCenterSnap.exists ? candidateUserCenterSnap.data() : null;
        const hasActiveMember = candidateMemberSnap.exists &&
            (candidateMemberData === null || candidateMemberData === void 0 ? void 0 : candidateMemberData.role) === "student" &&
            isActiveMembershipStatus(candidateMemberData === null || candidateMemberData === void 0 ? void 0 : candidateMemberData.status);
        const hasActiveUserCenter = candidateUserCenterSnap.exists &&
            (candidateUserCenterData === null || candidateUserCenterData === void 0 ? void 0 : candidateUserCenterData.role) === "student" &&
            isActiveMembershipStatus(candidateUserCenterData === null || candidateUserCenterData === void 0 ? void 0 : candidateUserCenterData.status);
        if (hasActiveMember || hasActiveUserCenter) {
            return true;
        }
    }
    return false;
}
async function reserveParentLinkCodeLookupInTransaction(params) {
    const { db, transaction, code, centerId, studentId, studentName, timestamp } = params;
    const normalizedCode = normalizeParentLinkCodeValue(code);
    if (!normalizedCode)
        return;
    const lookupRef = getParentLinkLookupRef(db, normalizedCode);
    const lookupSnap = await transaction.get(lookupRef);
    const lookupData = lookupSnap.exists ? lookupSnap.data() : null;
    const lookupStudentId = asTrimmedString(lookupData === null || lookupData === void 0 ? void 0 : lookupData.studentId);
    const lookupCenterId = asTrimmedString(lookupData === null || lookupData === void 0 ? void 0 : lookupData.centerId);
    if (lookupSnap.exists && (lookupStudentId !== studentId || lookupCenterId !== centerId)) {
        throw new functions.https.HttpsError("failed-precondition", "Parent link code is duplicated.", {
            userMessage: "이미 사용 중인 학부모 연동 코드입니다. 다른 6자리 숫자를 입력해 주세요.",
        });
    }
    transaction.set(lookupRef, buildParentLinkLookupPayload({
        code: normalizedCode,
        centerId,
        studentId,
        studentName,
        timestamp,
        createdAt: lookupData === null || lookupData === void 0 ? void 0 : lookupData.createdAt,
    }), { merge: true });
}
async function resolveParentLinkCandidateFromLookupInTransaction(db, transaction, code) {
    const normalizedCode = normalizeParentLinkCodeValue(code);
    if (!normalizedCode)
        return null;
    const lookupSnap = await transaction.get(getParentLinkLookupRef(db, normalizedCode));
    if (!lookupSnap.exists)
        return null;
    const lookupData = lookupSnap.data();
    const centerId = asTrimmedString(lookupData === null || lookupData === void 0 ? void 0 : lookupData.centerId);
    const studentId = asTrimmedString(lookupData === null || lookupData === void 0 ? void 0 : lookupData.studentId);
    if (!centerId || !studentId)
        return null;
    const studentRef = db.doc(`centers/${centerId}/students/${studentId}`);
    const memberRef = db.doc(`centers/${centerId}/members/${studentId}`);
    const userCenterRef = db.doc(`userCenters/${studentId}/centers/${centerId}`);
    const [studentSnap, memberSnap, userCenterSnap] = await Promise.all([
        transaction.get(studentRef),
        transaction.get(memberRef),
        transaction.get(userCenterRef),
    ]);
    if (!studentSnap.exists)
        return null;
    const studentData = studentSnap.data();
    const memberData = memberSnap.exists ? memberSnap.data() : null;
    const userCenterData = userCenterSnap.exists ? userCenterSnap.data() : null;
    const className = (memberData === null || memberData === void 0 ? void 0 : memberData.className) ||
        (userCenterData === null || userCenterData === void 0 ? void 0 : userCenterData.className) ||
        (studentData === null || studentData === void 0 ? void 0 : studentData.className) ||
        null;
    return {
        centerId,
        studentId,
        studentRef,
        studentData,
        className,
    };
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
function normalizeStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0);
}
function normalizeStatsPayload(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    const source = value;
    const keys = ["focus", "consistency", "achievement", "resilience"];
    const result = {};
    let hasAny = false;
    for (const key of keys) {
        const parsed = parseFiniteNumber(source[key]);
        if (parsed === null)
            continue;
        result[key] = Math.max(0, Math.min(100, parsed));
        hasAny = true;
    }
    return hasAny ? result : null;
}
function average(values) {
    if (values.length === 0)
        return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function toTimestampOrNow(value) {
    if (!value)
        return null;
    if (value instanceof admin.firestore.Timestamp)
        return value;
    if (value instanceof Date)
        return admin.firestore.Timestamp.fromDate(value);
    if (typeof value === "object" && value !== null) {
        const maybeTs = value;
        if (typeof maybeTs.toDate === "function") {
            const date = maybeTs.toDate();
            if (date instanceof Date && Number.isFinite(date.getTime())) {
                return admin.firestore.Timestamp.fromDate(date);
            }
        }
        if (typeof maybeTs.toMillis === "function") {
            const millis = maybeTs.toMillis();
            if (Number.isFinite(millis)) {
                return admin.firestore.Timestamp.fromMillis(millis);
            }
        }
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return admin.firestore.Timestamp.fromMillis(value);
    }
    if (typeof value === "string") {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) {
            return admin.firestore.Timestamp.fromMillis(parsed);
        }
    }
    return null;
}
function asTrimmedString(value, fallback = "") {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}
function isValidDateKey(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
function toDateKeyFromUnknownTimestamp(value) {
    const millis = toMillisSafe(value);
    if (!Number.isFinite(millis) || millis <= 0)
        return null;
    return toDateKey(toKstDate(new Date(millis)));
}
function buildPenaltyEventLogId(studentId, source, penaltyKey) {
    const normalized = `${studentId}_${source}_${penaltyKey}`.replace(/[^A-Za-z0-9_-]/g, "_");
    return normalized.slice(0, 240);
}
async function findExistingPenaltyEventLog(params) {
    const { db, centerId, studentId, source, penaltyKey, penaltyDateKey } = params;
    const logsSnap = await db
        .collection(`centers/${centerId}/penaltyLogs`)
        .where("studentId", "==", studentId)
        .where("source", "==", source)
        .limit(source === "manual" ? 80 : 40)
        .get();
    for (const docSnap of logsSnap.docs) {
        const data = docSnap.data();
        const existingPenaltyKey = asTrimmedString(data === null || data === void 0 ? void 0 : data.penaltyKey);
        const existingPenaltyDateKey = asTrimmedString(data === null || data === void 0 ? void 0 : data.penaltyDateKey);
        const createdAtDateKey = toDateKeyFromUnknownTimestamp(data === null || data === void 0 ? void 0 : data.createdAt);
        const reasonText = asTrimmedString(data === null || data === void 0 ? void 0 : data.reason);
        if (existingPenaltyKey && existingPenaltyKey === penaltyKey) {
            return { id: docSnap.id };
        }
        if (existingPenaltyDateKey && existingPenaltyDateKey === penaltyDateKey) {
            return { id: docSnap.id };
        }
        if (createdAtDateKey === penaltyDateKey) {
            if (source === "routine_missing") {
                return { id: docSnap.id };
            }
            if (source === "manual" && reasonText.includes("출석 루틴")) {
                return { id: docSnap.id };
            }
        }
    }
    return null;
}
function safeAverageMinutes(values) {
    return values.length === 0 ? 0 : Math.round(average(values));
}
function parseExpectedArrivalMinutes(value) {
    const parsed = parseHourMinute(value);
    if (!parsed)
        return null;
    return parsed.hour * 60 + parsed.minute;
}
function sortByPriority(a, b) {
    const priorityWeight = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
    };
    const priorityDiff = priorityWeight[a.priority] - priorityWeight[b.priority];
    if (priorityDiff !== 0)
        return priorityDiff;
    return toMillisSafe(b.occurredAt) - toMillisSafe(a.occurredAt);
}
function toMillisSafe(value) {
    if (!value)
        return 0;
    if (value instanceof Date) {
        return Number.isFinite(value.getTime()) ? value.getTime() : 0;
    }
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === "string") {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    if (typeof value === "object" && value !== null) {
        const maybeTs = value;
        if (typeof maybeTs.toMillis === "function") {
            const millis = maybeTs.toMillis();
            return Number.isFinite(millis) ? millis : 0;
        }
    }
    return 0;
}
function applyTemplate(template, values) {
    return Object.entries(values).reduce((acc, [key, value]) => {
        return acc.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }, template);
}
function normalizeSmsEventType(eventType) {
    if (eventType === "check_in")
        return "study_start";
    if (eventType === "check_out")
        return "study_end";
    return eventType;
}
function getDefaultSmsEventToggles() {
    return {
        study_start: true,
        away_start: true,
        away_end: true,
        study_end: true,
        late_alert: true,
        weekly_report: true,
        daily_report: true,
        payment_reminder: true,
    };
}
function normalizeSmsEventToggles(value) {
    const defaults = getDefaultSmsEventToggles();
    if (!value || typeof value !== "object")
        return defaults;
    const source = value;
    return {
        study_start: source.study_start !== false,
        away_start: source.away_start !== false,
        away_end: source.away_end !== false,
        study_end: source.study_end !== false,
        late_alert: source.late_alert !== false,
        weekly_report: source.weekly_report !== false,
        daily_report: source.daily_report !== false,
        payment_reminder: source.payment_reminder !== false,
    };
}
function buildSmsRecipientPreferenceId(studentId, parentUid) {
    return `${studentId}_${parentUid}`;
}
function toTimestampDate(value) {
    if (!value)
        return null;
    if (value instanceof Date)
        return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === "string") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value.toDate === "function") {
        return value.toDate();
    }
    return null;
}
function getNextRetryDelayMinutes(attemptCount) {
    if (attemptCount <= 1)
        return 1;
    if (attemptCount === 2)
        return 5;
    if (attemptCount === 3)
        return 15;
    return null;
}
function buildParentLinkRateLimitRef(db, uid) {
    return db.doc(`users/${uid}/securityGuards/parentLinkRateLimit`);
}
function getRemainingLockMinutes(target, now = new Date()) {
    return Math.max(1, Math.ceil((target.getTime() - now.getTime()) / (60 * 1000)));
}
async function assertParentLinkRateLimitAllowed(db, uid) {
    const snap = await buildParentLinkRateLimitRef(db, uid).get();
    if (!snap.exists)
        return;
    const data = (snap.data() || {});
    const now = new Date();
    const blockedUntil = toTimestampDate(data.blockedUntil);
    if (!blockedUntil || blockedUntil.getTime() <= now.getTime())
        return;
    const remainingMinutes = getRemainingLockMinutes(blockedUntil, now);
    throw new functions.https.HttpsError("resource-exhausted", "Parent link temporarily blocked due to repeated failures.", {
        userMessage: `학생코드 확인 시도가 많아 ${remainingMinutes}분 동안 잠겼습니다. 잠시 후 다시 시도해 주세요.`,
    });
}
async function registerParentLinkFailedAttempt(db, uid) {
    const rateLimitRef = buildParentLinkRateLimitRef(db, uid);
    return db.runTransaction(async (t) => {
        const snap = await t.get(rateLimitRef);
        const data = (snap.data() || {});
        const now = new Date();
        const nowTs = admin.firestore.Timestamp.fromDate(now);
        const blockedUntil = toTimestampDate(data.blockedUntil);
        if (blockedUntil && blockedUntil.getTime() > now.getTime()) {
            return admin.firestore.Timestamp.fromDate(blockedUntil);
        }
        const firstFailedAt = toTimestampDate(data.firstFailedAt);
        const failedAttemptCount = Math.max(0, Number(data.failedAttemptCount || 0));
        const isWithinWindow = firstFailedAt !== null && now.getTime() - firstFailedAt.getTime() < PARENT_LINK_FAILED_ATTEMPT_WINDOW_MS;
        const nextFailedAttemptCount = isWithinWindow ? failedAttemptCount + 1 : 1;
        const nextFirstFailedAt = isWithinWindow && data.firstFailedAt && typeof data.firstFailedAt.toDate === "function" ? data.firstFailedAt : nowTs;
        const nextBlockedUntil = nextFailedAttemptCount >= PARENT_LINK_FAILED_ATTEMPT_LIMIT
            ? admin.firestore.Timestamp.fromDate(new Date(now.getTime() + PARENT_LINK_FAILED_ATTEMPT_LOCK_MS))
            : null;
        t.set(rateLimitRef, {
            failedAttemptCount: nextFailedAttemptCount,
            firstFailedAt: nextFirstFailedAt,
            lastFailedAt: nowTs,
            blockedUntil: nextBlockedUntil !== null && nextBlockedUntil !== void 0 ? nextBlockedUntil : admin.firestore.FieldValue.delete(),
            updatedAt: nowTs,
        }, { merge: true });
        return nextBlockedUntil;
    });
}
async function clearParentLinkRateLimit(db, uid) {
    await buildParentLinkRateLimitRef(db, uid).delete();
}
function shouldCountParentLinkFailedAttempt(error) {
    return error instanceof functions.https.HttpsError && error.code === "failed-precondition";
}
function calculateSmsBytes(message) {
    return Array.from(message || "").reduce((sum, char) => {
        const code = char.charCodeAt(0);
        return sum + (code <= 0x007f ? 1 : 2);
    }, 0);
}
function trimSmsToByteLimit(message, limit = SMS_BYTE_LIMIT) {
    let result = "";
    for (const char of Array.from(message || "")) {
        const candidate = result + char;
        if (calculateSmsBytes(candidate) > limit)
            break;
        result = candidate;
    }
    return result.trim();
}
function sanitizeSmsTemplate(template) {
    return String(template || "")
        .replace(/[^\u0020-\u007E\u00A0-\u00FF\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
async function loadCenterName(db, centerId) {
    var _a;
    try {
        const centerSnap = await db.doc(`centers/${centerId}`).get();
        const name = (_a = centerSnap.data()) === null || _a === void 0 ? void 0 : _a.name;
        return typeof name === "string" && name.trim().length > 0 ? name.trim() : "센터";
    }
    catch (_b) {
        return "센터";
    }
}
function resolveTemplateByEvent(settings, eventType) {
    if (eventType === "study_start") {
        return settings.smsTemplateStudyStart || settings.smsTemplateCheckIn || DEFAULT_SMS_TEMPLATES.study_start;
    }
    if (eventType === "study_end") {
        return settings.smsTemplateStudyEnd || settings.smsTemplateCheckOut || DEFAULT_SMS_TEMPLATES.study_end;
    }
    if (eventType === "away_start") {
        return settings.smsTemplateAwayStart || DEFAULT_SMS_TEMPLATES.away_start;
    }
    if (eventType === "away_end") {
        return settings.smsTemplateAwayEnd || DEFAULT_SMS_TEMPLATES.away_end;
    }
    return settings.smsTemplateLateAlert || DEFAULT_SMS_TEMPLATES.late_alert;
}
function buildSmsDedupeKey(params) {
    const dateKey = toDateKey(params.eventAt);
    const minuteKey = `${String(params.eventAt.getHours()).padStart(2, "0")}${String(params.eventAt.getMinutes()).padStart(2, "0")}`;
    if (params.eventType === "study_start" || params.eventType === "study_end" || params.eventType === "late_alert") {
        return `${params.centerId}_${params.studentId}_${params.eventType}_${dateKey}`;
    }
    return `${params.centerId}_${params.studentId}_${params.eventType}_${dateKey}_${minuteKey}`;
}
function buildSmsQueueInitialStatus(settings) {
    const provider = settings.smsProvider || "none";
    if (settings.smsEnabled === false || provider === "none") {
        return {
            status: "pending_provider",
            providerStatus: "pending_provider",
        };
    }
    return {
        status: "queued",
        providerStatus: "queued",
    };
}
async function appendSmsDeliveryLog(db, params) {
    const createdAt = params.createdAt || admin.firestore.Timestamp.now();
    const logRef = db.collection(`centers/${params.centerId}/smsDeliveryLogs`).doc();
    await logRef.set({
        centerId: params.centerId,
        queueId: params.queueId || null,
        studentId: params.studentId || null,
        studentName: params.studentName || null,
        parentUid: params.parentUid || null,
        parentName: params.parentName || null,
        phoneNumber: params.phoneNumber || null,
        eventType: params.eventType,
        renderedMessage: params.renderedMessage,
        messageBytes: params.messageBytes,
        provider: params.provider || null,
        attemptNo: params.attemptNo || 0,
        status: params.status,
        dateKey: toDateKey(createdAt.toDate()),
        createdAt,
        sentAt: params.sentAt || null,
        failedAt: params.failedAt || null,
        errorCode: params.errorCode || null,
        errorMessage: params.errorMessage || null,
        suppressedReason: params.suppressedReason || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
async function loadNotificationSettings(db, centerId) {
    const publicRef = db.doc(`centers/${centerId}/settings/notifications`);
    const privateRef = db.doc(`centers/${centerId}/settingsPrivate/notificationsSecret`);
    const [settingsSnap, privateSnap] = await Promise.all([publicRef.get(), privateRef.get()]);
    const publicData = (settingsSnap.exists ? settingsSnap.data() : {});
    const privateData = (privateSnap.exists ? privateSnap.data() : {});
    const legacyPublicApiKey = asTrimmedString(publicData.smsApiKey);
    const privateApiKey = asTrimmedString(privateData.smsApiKey);
    if (legacyPublicApiKey && !privateApiKey) {
        await Promise.all([
            privateRef.set({
                smsApiKey: legacyPublicApiKey,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true }),
            publicRef.set({
                smsApiKey: admin.firestore.FieldValue.delete(),
                smsApiKeyConfigured: true,
                smsApiKeyLastUpdatedAt: publicData.smsApiKeyLastUpdatedAt || admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true }),
        ]);
    }
    return Object.assign(Object.assign({}, publicData), { smsApiKey: privateApiKey || legacyPublicApiKey || undefined });
}
function validateSmsTemplateLength(template, fieldLabel) {
    const sanitized = sanitizeSmsTemplate(template);
    if (!sanitized)
        return "";
    const bytes = calculateSmsBytes(sanitized);
    if (bytes > SMS_BYTE_LIMIT) {
        throw new functions.https.HttpsError("invalid-argument", `${fieldLabel} exceeds ${SMS_BYTE_LIMIT} bytes.`, { userMessage: `${fieldLabel} 문구가 90byte를 넘었습니다.` });
    }
    return sanitized;
}
async function collectParentRecipients(db, centerId, studentId) {
    var _a;
    const studentSnap = await db.doc(`centers/${centerId}/students/${studentId}`).get();
    if (!studentSnap.exists)
        return [];
    if (shouldExcludeFromSmsQueries(studentSnap.data(), studentId))
        return [];
    const parentUidsRaw = (_a = studentSnap.data()) === null || _a === void 0 ? void 0 : _a.parentUids;
    const parentUids = Array.isArray(parentUidsRaw)
        ? parentUidsRaw.filter((uid) => typeof uid === "string" && uid.trim().length > 0)
        : [];
    if (parentUids.length === 0)
        return [];
    const recipients = [];
    const usedPhones = new Set();
    for (const parentUid of parentUids) {
        const [userSnap, memberSnap] = await Promise.all([
            db.doc(`users/${parentUid}`).get(),
            db.doc(`centers/${centerId}/members/${parentUid}`).get(),
        ]);
        const userData = userSnap.exists ? userSnap.data() : null;
        const memberData = memberSnap.exists ? memberSnap.data() : null;
        if (shouldExcludeFromSmsQueries(userData, parentUid) || shouldExcludeFromSmsQueries(memberData, parentUid)) {
            continue;
        }
        const phoneNumber = normalizePhoneNumber((userData === null || userData === void 0 ? void 0 : userData.phoneNumber) || (memberData === null || memberData === void 0 ? void 0 : memberData.phoneNumber));
        if (!phoneNumber || usedPhones.has(phoneNumber))
            continue;
        recipients.push({
            parentUid,
            parentName: (memberData === null || memberData === void 0 ? void 0 : memberData.displayName) || (userData === null || userData === void 0 ? void 0 : userData.displayName) || null,
            phoneNumber,
        });
        usedPhones.add(phoneNumber);
    }
    return recipients;
}
async function splitRecipientsBySmsPreference(db, centerId, studentId, studentName, eventType, recipients) {
    if (recipients.length === 0) {
        return { allowedRecipients: [], suppressedRecipients: [] };
    }
    const prefRefs = recipients.map((recipient) => db.doc(`centers/${centerId}/smsRecipientPreferences/${buildSmsRecipientPreferenceId(studentId, recipient.parentUid)}`));
    const prefSnaps = prefRefs.length > 0 ? await db.getAll(...prefRefs) : [];
    const prefMap = new Map();
    prefSnaps.forEach((snap) => {
        if (snap.exists) {
            prefMap.set(snap.id, (snap.data() || {}));
        }
    });
    const allowedRecipients = [];
    const suppressedRecipients = [];
    for (const recipient of recipients) {
        const prefId = buildSmsRecipientPreferenceId(studentId, recipient.parentUid);
        const pref = prefMap.get(prefId);
        const enabled = (pref === null || pref === void 0 ? void 0 : pref.enabled) !== false;
        const toggles = normalizeSmsEventToggles(pref === null || pref === void 0 ? void 0 : pref.eventToggles);
        const eventEnabled = toggles[eventType] !== false;
        if (!enabled) {
            suppressedRecipients.push(Object.assign(Object.assign({}, recipient), { suppressedReason: "recipient_disabled" }));
            continue;
        }
        if (!eventEnabled) {
            suppressedRecipients.push(Object.assign(Object.assign({}, recipient), { suppressedReason: `event_${eventType}_disabled` }));
            continue;
        }
        allowedRecipients.push(recipient);
        if (!pref) {
            continue;
        }
        const needsRefresh = pref.studentName !== studentName ||
            pref.parentName !== recipient.parentName ||
            pref.phoneNumber !== recipient.phoneNumber;
        if (needsRefresh) {
            await db.doc(`centers/${centerId}/smsRecipientPreferences/${prefId}`).set({
                studentId,
                studentName,
                parentUid: recipient.parentUid,
                parentName: recipient.parentName,
                phoneNumber: recipient.phoneNumber,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
    }
    return { allowedRecipients, suppressedRecipients };
}
async function queueParentSmsNotification(db, params) {
    const { centerId, studentId, studentName, eventType: rawEventType, eventAt, expectedTime, } = params;
    const eventType = normalizeSmsEventType(rawEventType);
    const settings = params.settings || await loadNotificationSettings(db, centerId);
    const recipients = await collectParentRecipients(db, centerId, studentId);
    if (recipients.length === 0) {
        return { queuedCount: 0, recipientCount: 0, message: "" };
    }
    const centerName = await loadCenterName(db, centerId);
    const template = resolveTemplateByEvent(settings, eventType);
    const eventTimeLabel = toTimeLabel(eventAt);
    const expectedTimeLabel = expectedTime || "학생이 정한 시간";
    const message = trimSmsToByteLimit(applyTemplate(template, {
        studentName,
        time: eventTimeLabel,
        expectedTime: expectedTimeLabel,
        centerName,
    }));
    const messageBytes = calculateSmsBytes(message);
    const dedupeKey = buildSmsDedupeKey({
        centerId,
        studentId,
        eventType,
        eventAt,
    });
    const dedupeRef = db.doc(`centers/${centerId}/smsDedupes/${dedupeKey}`);
    const dedupeSnap = await dedupeRef.get();
    if (dedupeSnap.exists) {
        return { queuedCount: 0, recipientCount: recipients.length, message };
    }
    const { allowedRecipients, suppressedRecipients } = await splitRecipientsBySmsPreference(db, centerId, studentId, studentName, eventType, recipients);
    const provider = settings.smsProvider || "none";
    const ts = admin.firestore.Timestamp.now();
    const batch = db.batch();
    const initialStatus = buildSmsQueueInitialStatus(settings);
    batch.set(dedupeRef, {
        centerId,
        studentId,
        eventType,
        dedupeKey,
        createdAt: ts,
        renderedMessage: message,
        messageBytes,
    }, { merge: true });
    allowedRecipients.forEach((recipient) => {
        const queueRef = db.collection(`centers/${centerId}/smsQueue`).doc();
        batch.set(queueRef, {
            centerId,
            studentId,
            studentName,
            parentUid: recipient.parentUid,
            parentName: recipient.parentName,
            phoneNumber: recipient.phoneNumber,
            to: recipient.phoneNumber,
            provider,
            sender: settings.smsSender || null,
            endpointUrl: settings.smsEndpointUrl || null,
            message,
            renderedMessage: message,
            messageBytes,
            dedupeKey,
            eventType,
            dateKey: toDateKey(eventAt),
            status: initialStatus.status,
            providerStatus: initialStatus.providerStatus,
            attemptCount: 0,
            manualRetryCount: 0,
            nextAttemptAt: initialStatus.status === "queued" ? ts : null,
            sentAt: null,
            failedAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
            createdAt: ts,
            updatedAt: ts,
            metadata: {
                studentName,
                centerName,
                expectedTime: expectedTime || null,
            },
        });
        const parentNotificationRef = db.collection(`centers/${centerId}/parentNotifications`).doc();
        batch.set(parentNotificationRef, {
            centerId,
            studentId,
            parentUid: recipient.parentUid,
            type: eventType,
            title: eventType === "study_start"
                ? "공부 시작 알림"
                : eventType === "study_end"
                    ? "공부 종료 알림"
                    : eventType === "away_start"
                        ? "외출 알림"
                        : "지각 알림",
            body: message,
            isRead: false,
            isImportant: eventType !== "study_start",
            createdAt: ts,
            updatedAt: ts,
        });
    });
    await batch.commit();
    await Promise.all(suppressedRecipients.map((recipient) => appendSmsDeliveryLog(db, {
        centerId,
        studentId,
        studentName,
        parentUid: recipient.parentUid,
        parentName: recipient.parentName,
        phoneNumber: recipient.phoneNumber,
        eventType,
        renderedMessage: message,
        messageBytes,
        provider,
        attemptNo: 0,
        status: "suppressed_opt_out",
        createdAt: ts,
        suppressedReason: recipient.suppressedReason,
    })));
    return { queuedCount: allowedRecipients.length, recipientCount: recipients.length, message };
}
function buildParentNotificationTitle(eventType) {
    if (eventType === "study_start")
        return "공부 시작 알림";
    if (eventType === "study_end")
        return "공부 종료 알림";
    if (eventType === "away_start")
        return "외출 알림";
    if (eventType === "away_end")
        return "복귀 알림";
    if (eventType === "late_alert")
        return "지각 알림";
    if (eventType === "weekly_report")
        return "주간 리포트 알림";
    if (eventType === "daily_report")
        return "일일 리포트 알림";
    return "결제 예정 알림";
}
async function queueCustomParentSmsNotification(db, params) {
    const settings = params.settings || await loadNotificationSettings(db, params.centerId);
    const recipients = await collectParentRecipients(db, params.centerId, params.studentId);
    if (recipients.length === 0) {
        return { queuedCount: 0, recipientCount: 0, message: params.message };
    }
    const dedupeRef = params.dedupeKey
        ? db.doc(`centers/${params.centerId}/smsDedupes/${params.dedupeKey}`)
        : null;
    if (dedupeRef) {
        const dedupeSnap = await dedupeRef.get();
        if (dedupeSnap.exists) {
            return { queuedCount: 0, recipientCount: recipients.length, message: params.message };
        }
    }
    const { allowedRecipients, suppressedRecipients } = await splitRecipientsBySmsPreference(db, params.centerId, params.studentId, params.studentName, params.eventType, recipients);
    const provider = settings.smsProvider || "none";
    const ts = admin.firestore.Timestamp.now();
    const message = trimSmsToByteLimit(params.message);
    const messageBytes = calculateSmsBytes(message);
    const initialStatus = buildSmsQueueInitialStatus(settings);
    const batch = db.batch();
    if (dedupeRef) {
        batch.set(dedupeRef, {
            centerId: params.centerId,
            studentId: params.studentId,
            eventType: params.eventType,
            dedupeKey: params.dedupeKey,
            createdAt: ts,
            renderedMessage: message,
            messageBytes,
        }, { merge: true });
    }
    allowedRecipients.forEach((recipient) => {
        const queueRef = db.collection(`centers/${params.centerId}/smsQueue`).doc();
        batch.set(queueRef, {
            centerId: params.centerId,
            studentId: params.studentId,
            studentName: params.studentName,
            parentUid: recipient.parentUid,
            parentName: recipient.parentName,
            phoneNumber: recipient.phoneNumber,
            to: recipient.phoneNumber,
            provider,
            sender: settings.smsSender || null,
            endpointUrl: settings.smsEndpointUrl || null,
            message,
            renderedMessage: message,
            messageBytes,
            dedupeKey: params.dedupeKey || null,
            eventType: params.eventType,
            dateKey: toDateKey(params.date),
            status: initialStatus.status,
            providerStatus: initialStatus.providerStatus,
            attemptCount: 0,
            manualRetryCount: 0,
            nextAttemptAt: initialStatus.status === "queued" ? ts : null,
            sentAt: null,
            failedAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
            createdAt: ts,
            updatedAt: ts,
            metadata: params.metadata || null,
        });
        const parentNotificationRef = db.collection(`centers/${params.centerId}/parentNotifications`).doc();
        batch.set(parentNotificationRef, {
            centerId: params.centerId,
            studentId: params.studentId,
            parentUid: recipient.parentUid,
            type: params.eventType,
            title: params.notificationTitle || buildParentNotificationTitle(params.eventType),
            body: message,
            isRead: false,
            isImportant: params.isImportant !== false,
            createdAt: ts,
            updatedAt: ts,
        });
    });
    await batch.commit();
    await Promise.all(suppressedRecipients.map((recipient) => appendSmsDeliveryLog(db, {
        centerId: params.centerId,
        studentId: params.studentId,
        studentName: params.studentName,
        parentUid: recipient.parentUid,
        parentName: recipient.parentName,
        phoneNumber: recipient.phoneNumber,
        eventType: params.eventType,
        renderedMessage: message,
        messageBytes,
        provider,
        attemptNo: 0,
        status: "suppressed_opt_out",
        createdAt: ts,
        suppressedReason: recipient.suppressedReason,
    })));
    return { queuedCount: allowedRecipients.length, recipientCount: recipients.length, message };
}
async function runLateArrivalCheckForCenter(db, centerId, nowKst, attendanceSnap) {
    const settings = await loadNotificationSettings(db, centerId);
    if (settings.lateAlertEnabled === false)
        return 0;
    const graceMinutes = Number.isFinite(Number(settings.lateAlertGraceMinutes))
        ? Math.max(0, Number(settings.lateAlertGraceMinutes))
        : 20;
    const nowMinutes = nowKst.getHours() * 60 + nowKst.getMinutes();
    const dateKey = toDateKey(nowKst);
    const membersSnap = await db
        .collection(`centers/${centerId}/members`)
        .where("role", "==", "student")
        .where("status", "==", "active")
        .get();
    if (membersSnap.empty)
        return 0;
    const checkedInStudentIds = new Set();
    attendanceSnap.forEach((seatDoc) => {
        const seatData = seatDoc.data();
        if (!(seatData === null || seatData === void 0 ? void 0 : seatData.studentId))
            return;
        if (ACTIVE_STUDY_ATTENDANCE_STATUSES.has(String(seatData.status || ""))) {
            checkedInStudentIds.add(String(seatData.studentId));
        }
    });
    const studentRefs = membersSnap.docs.map((memberDoc) => db.doc(`centers/${centerId}/students/${memberDoc.id}`));
    const studentSnaps = studentRefs.length > 0 ? await db.getAll(...studentRefs) : [];
    const studentMap = new Map();
    studentSnaps.forEach((snap) => {
        if (snap.exists)
            studentMap.set(snap.id, snap.data() || {});
    });
    let alertsTriggered = 0;
    for (const memberDoc of membersSnap.docs) {
        const studentId = memberDoc.id;
        if (checkedInStudentIds.has(studentId))
            continue;
        const studentData = studentMap.get(studentId) || {};
        const studentName = typeof studentData.name === "string" && studentData.name.trim()
            ? studentData.name.trim()
            : "학생";
        const expectedTimeRaw = asTrimmedString(studentData.expectedArrivalTime);
        const expectedTime = parseHourMinute(expectedTimeRaw);
        if (!expectedTime)
            continue;
        const thresholdMinutes = expectedTime.hour * 60 + expectedTime.minute + graceMinutes;
        if (nowMinutes < thresholdMinutes)
            continue;
        const lateAlertRef = db.doc(`centers/${centerId}/lateAlerts/${dateKey}_${studentId}`);
        const alreadySentSnap = await lateAlertRef.get();
        if (alreadySentSnap.exists)
            continue;
        const expectedLabel = `${String(expectedTime.hour).padStart(2, "0")}:${String(expectedTime.minute).padStart(2, "0")}`;
        const queueResult = await queueParentSmsNotification(db, {
            centerId,
            studentId,
            studentName,
            eventType: "late_alert",
            eventAt: nowKst,
            expectedTime: expectedLabel,
            settings,
        });
        await lateAlertRef.set({
            centerId,
            studentId,
            studentName,
            expectedArrivalTime: expectedLabel,
            graceMinutes,
            triggeredAt: admin.firestore.Timestamp.now(),
            queuedCount: queueResult.queuedCount,
            dateKey,
        }, { merge: true });
        alertsTriggered += 1;
    }
    return alertsTriggered;
}
function summarizeProviderResponse(value) {
    if (value == null)
        return null;
    if (typeof value === "string") {
        return value.slice(0, 300);
    }
    try {
        return JSON.stringify(value).slice(0, 300);
    }
    catch (_a) {
        return String(value).slice(0, 300);
    }
}
async function sendSmsViaAligo(params) {
    var _a;
    try {
        const formData = new FormData();
        formData.append("key", params.apiKey);
        formData.append("userid", params.userId);
        formData.append("sender", params.sender);
        formData.append("receiver", params.receiver);
        formData.append("msg", params.message);
        formData.append("testmode_yn", "N");
        const response = await fetch("https://apis.aligo.in/send/", {
            method: "POST",
            body: formData,
        });
        const text = await response.text();
        let parsed = null;
        try {
            parsed = text ? JSON.parse(text) : null;
        }
        catch (_b) {
            parsed = text;
        }
        const responseSummary = summarizeProviderResponse(parsed !== null && parsed !== void 0 ? parsed : text);
        const resultCode = String((_a = parsed === null || parsed === void 0 ? void 0 : parsed.result_code) !== null && _a !== void 0 ? _a : "");
        if (response.ok && resultCode === "1") {
            return {
                ok: true,
                providerMessageId: (parsed === null || parsed === void 0 ? void 0 : parsed.msg_id) ? String(parsed.msg_id) : null,
                responseSummary,
            };
        }
        return {
            ok: false,
            code: resultCode || `HTTP_${response.status}`,
            message: String((parsed === null || parsed === void 0 ? void 0 : parsed.message) || (parsed === null || parsed === void 0 ? void 0 : parsed.msg) || "알리고 발송 실패"),
            responseSummary,
        };
    }
    catch (error) {
        return {
            ok: false,
            code: "ALIGO_FETCH_ERROR",
            message: (error === null || error === void 0 ? void 0 : error.message) || "알리고 요청 중 오류가 발생했습니다.",
        };
    }
}
async function sendSmsViaCustomEndpoint(params) {
    try {
        const response = await fetch(params.endpointUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-SMS-API-KEY": params.apiKey,
            },
            body: JSON.stringify({
                to: params.receiver,
                sender: params.sender,
                message: params.message,
                centerId: params.centerId,
                studentId: params.studentId || null,
                eventType: params.eventType || null,
            }),
        });
        const text = await response.text();
        let parsed = null;
        try {
            parsed = text ? JSON.parse(text) : null;
        }
        catch (_a) {
            parsed = text;
        }
        const responseSummary = summarizeProviderResponse(parsed !== null && parsed !== void 0 ? parsed : text);
        const isOk = response.ok && (parsed === null || parsed === void 0 ? void 0 : parsed.ok) !== false;
        if (isOk) {
            return {
                ok: true,
                providerMessageId: (parsed === null || parsed === void 0 ? void 0 : parsed.providerMessageId) ? String(parsed.providerMessageId) : null,
                responseSummary,
            };
        }
        return {
            ok: false,
            code: String((parsed === null || parsed === void 0 ? void 0 : parsed.code) || `HTTP_${response.status}`),
            message: String((parsed === null || parsed === void 0 ? void 0 : parsed.message) || "사용자 엔드포인트 발송 실패"),
            responseSummary,
        };
    }
    catch (error) {
        return {
            ok: false,
            code: "CUSTOM_FETCH_ERROR",
            message: (error === null || error === void 0 ? void 0 : error.message) || "사용자 엔드포인트 요청 중 오류가 발생했습니다.",
        };
    }
}
async function dispatchSmsQueueItem(db, centerId, queueRef, queueData, attemptCount) {
    var _a;
    const nowTs = admin.firestore.Timestamp.now();
    const settings = await loadNotificationSettings(db, centerId);
    const provider = (settings.smsProvider || queueData.provider || "none");
    const sender = asTrimmedString(settings.smsSender || queueData.sender || "");
    const receiver = normalizePhoneNumber(queueData.phoneNumber || queueData.to || "");
    const message = asTrimmedString(queueData.renderedMessage || queueData.message || "");
    const queueId = queueRef.id;
    const studentId = asTrimmedString(queueData.studentId);
    const studentName = asTrimmedString(queueData.studentName || ((_a = queueData === null || queueData === void 0 ? void 0 : queueData.metadata) === null || _a === void 0 ? void 0 : _a.studentName), "학생");
    const parentUid = asTrimmedString(queueData.parentUid);
    const parentName = asTrimmedString(queueData.parentName);
    const eventType = String(queueData.eventType || "study_start");
    if (!message || !receiver) {
        await queueRef.set({
            status: "failed",
            providerStatus: "failed",
            failedAt: nowTs,
            updatedAt: nowTs,
            lastErrorCode: "INVALID_QUEUE_ITEM",
            lastErrorMessage: "수신번호 또는 문자 본문이 비어 있습니다.",
            processingStartedAt: admin.firestore.FieldValue.delete(),
            processingLeaseUntil: admin.firestore.FieldValue.delete(),
        }, { merge: true });
        await appendSmsDeliveryLog(db, {
            centerId,
            queueId,
            studentId,
            studentName,
            parentUid,
            parentName,
            phoneNumber: receiver || queueData.phoneNumber || queueData.to || null,
            eventType,
            renderedMessage: message || "",
            messageBytes: Number(queueData.messageBytes || calculateSmsBytes(message || "")),
            provider,
            attemptNo: attemptCount,
            status: "failed",
            createdAt: nowTs,
            failedAt: nowTs,
            errorCode: "INVALID_QUEUE_ITEM",
            errorMessage: "수신번호 또는 문자 본문이 비어 있습니다.",
        });
        return;
    }
    if (settings.smsEnabled === false || provider === "none") {
        await queueRef.set({
            status: "pending_provider",
            providerStatus: "pending_provider",
            updatedAt: nowTs,
            nextAttemptAt: admin.firestore.FieldValue.delete(),
            processingStartedAt: admin.firestore.FieldValue.delete(),
            processingLeaseUntil: admin.firestore.FieldValue.delete(),
            lastErrorCode: "PROVIDER_NOT_READY",
            lastErrorMessage: "문자 전송 설정이 꺼져 있거나 제공사가 연결되지 않았습니다.",
        }, { merge: true });
        return;
    }
    let dispatchResult;
    if (provider === "aligo") {
        const apiKey = asTrimmedString(settings.smsApiKey);
        const userId = asTrimmedString(settings.smsUserId);
        if (!apiKey || !userId || !sender) {
            await queueRef.set({
                status: "pending_provider",
                providerStatus: "pending_provider",
                updatedAt: nowTs,
                nextAttemptAt: admin.firestore.FieldValue.delete(),
                processingStartedAt: admin.firestore.FieldValue.delete(),
                processingLeaseUntil: admin.firestore.FieldValue.delete(),
                lastErrorCode: "ALIGO_CONFIG_MISSING",
                lastErrorMessage: "알리고 설정(API 키, 사용자 ID, 발신번호)이 부족합니다.",
            }, { merge: true });
            return;
        }
        dispatchResult = await sendSmsViaAligo({
            apiKey,
            userId,
            sender,
            receiver,
            message,
        });
    }
    else {
        const endpointUrl = asTrimmedString(settings.smsEndpointUrl || queueData.endpointUrl || "");
        const apiKey = asTrimmedString(settings.smsApiKey);
        if (!endpointUrl || !apiKey) {
            await queueRef.set({
                status: "pending_provider",
                providerStatus: "pending_provider",
                updatedAt: nowTs,
                nextAttemptAt: admin.firestore.FieldValue.delete(),
                processingStartedAt: admin.firestore.FieldValue.delete(),
                processingLeaseUntil: admin.firestore.FieldValue.delete(),
                lastErrorCode: "CUSTOM_CONFIG_MISSING",
                lastErrorMessage: "사용자 엔드포인트 또는 연동 키가 비어 있습니다.",
            }, { merge: true });
            return;
        }
        dispatchResult = await sendSmsViaCustomEndpoint({
            endpointUrl,
            apiKey,
            sender: sender || null,
            receiver,
            message,
            centerId,
            studentId: studentId || null,
            eventType,
        });
    }
    const messageBytes = Number(queueData.messageBytes || calculateSmsBytes(message));
    if (dispatchResult.ok) {
        await queueRef.set({
            provider,
            sender: sender || null,
            status: "sent",
            providerStatus: "sent",
            sentAt: nowTs,
            updatedAt: nowTs,
            providerMessageId: dispatchResult.providerMessageId || null,
            lastErrorCode: admin.firestore.FieldValue.delete(),
            lastErrorMessage: admin.firestore.FieldValue.delete(),
            failedAt: admin.firestore.FieldValue.delete(),
            failedReason: admin.firestore.FieldValue.delete(),
            nextAttemptAt: admin.firestore.FieldValue.delete(),
            processingStartedAt: admin.firestore.FieldValue.delete(),
            processingLeaseUntil: admin.firestore.FieldValue.delete(),
        }, { merge: true });
        await appendSmsDeliveryLog(db, {
            centerId,
            queueId,
            studentId,
            studentName,
            parentUid,
            parentName,
            phoneNumber: receiver,
            eventType,
            renderedMessage: message,
            messageBytes,
            provider,
            attemptNo: attemptCount,
            status: "sent",
            createdAt: nowTs,
            sentAt: nowTs,
        });
        return;
    }
    const nextRetryDelay = getNextRetryDelayMinutes(attemptCount);
    const lastErrorCode = dispatchResult.code || "SMS_SEND_FAILED";
    const lastErrorMessage = dispatchResult.message || "문자 발송 실패";
    if (nextRetryDelay !== null) {
        await queueRef.set({
            provider,
            sender: sender || null,
            status: "queued",
            providerStatus: "retry_scheduled",
            updatedAt: nowTs,
            nextAttemptAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + nextRetryDelay * 60 * 1000)),
            failedReason: lastErrorMessage,
            lastErrorCode,
            lastErrorMessage,
            processingStartedAt: admin.firestore.FieldValue.delete(),
            processingLeaseUntil: admin.firestore.FieldValue.delete(),
        }, { merge: true });
    }
    else {
        await queueRef.set({
            provider,
            sender: sender || null,
            status: "failed",
            providerStatus: "failed",
            failedAt: nowTs,
            updatedAt: nowTs,
            failedReason: lastErrorMessage,
            lastErrorCode,
            lastErrorMessage,
            nextAttemptAt: admin.firestore.FieldValue.delete(),
            processingStartedAt: admin.firestore.FieldValue.delete(),
            processingLeaseUntil: admin.firestore.FieldValue.delete(),
        }, { merge: true });
    }
    await appendSmsDeliveryLog(db, {
        centerId,
        queueId,
        studentId,
        studentName,
        parentUid,
        parentName,
        phoneNumber: receiver,
        eventType,
        renderedMessage: message,
        messageBytes,
        provider,
        attemptNo: attemptCount,
        status: "failed",
        createdAt: nowTs,
        failedAt: nowTs,
        errorCode: lastErrorCode,
        errorMessage: lastErrorMessage,
    });
}
function isAdminRole(role) {
    if (typeof role !== "string")
        return false;
    const raw = role.trim();
    return adminRoles.has(raw) || normalizeMembershipRoleValue(raw) === "centerAdmin";
}
function chunkArray(items, size) {
    if (size <= 0)
        return [items];
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}
async function getDocsInChunks(db, refs) {
    const snapshots = [];
    for (const refsChunk of chunkArray(refs, 80)) {
        if (refsChunk.length === 0)
            continue;
        const chunkSnaps = await db.getAll(...refsChunk);
        snapshots.push(...chunkSnaps);
    }
    return snapshots;
}
async function loadStudentProfileMap(db, centerId, studentIds) {
    const profileRefs = studentIds.map((studentId) => db.doc(`centers/${centerId}/students/${studentId}`));
    const profileSnaps = await getDocsInChunks(db, profileRefs);
    const profileMap = new Map();
    profileSnaps.forEach((snap) => {
        if (!snap.exists)
            return;
        profileMap.set(snap.id, snap.data());
    });
    return profileMap;
}
async function loadStudyMinutesByStudentForDateKeys(db, centerId, dateKeys) {
    const uniqueDateKeys = Array.from(new Set(dateKeys.filter((dateKey) => typeof dateKey === "string" && dateKey.length > 0)));
    if (uniqueDateKeys.length === 0) {
        return new Map();
    }
    const totalsByStudentId = new Map();
    const statSnaps = await Promise.all(uniqueDateKeys.map((dateKey) => db.collection(`centers/${centerId}/dailyStudentStats/${dateKey}/students`).get()));
    statSnaps.forEach((snap) => {
        snap.forEach((docSnap) => {
            var _a;
            const raw = docSnap.data();
            const studentId = asTrimmedString(raw.studentId, docSnap.id);
            if (!studentId)
                return;
            const totalStudyMinutes = Math.max(0, Math.round(Number((_a = raw.totalStudyMinutes) !== null && _a !== void 0 ? _a : 0)));
            totalsByStudentId.set(studentId, (totalsByStudentId.get(studentId) || 0) + totalStudyMinutes);
        });
    });
    return totalsByStudentId;
}
function derivePenaltyPointsFromLogs(logs) {
    const sortedLogs = [...logs].sort((a, b) => toMillisSafe(a.createdAt) - toMillisSafe(b.createdAt));
    let total = 0;
    for (const log of sortedLogs) {
        const delta = parseFiniteNumber(log.pointsDelta);
        if (delta === null)
            continue;
        if (log.source === "reset") {
            total = Math.max(0, total + delta);
            continue;
        }
        total = Math.max(0, total + delta);
    }
    return Math.max(0, Math.round(total));
}
function getRiskLevelFromSignals(params) {
    const { riskCacheAtRisk, effectivePenaltyPoints, awayLong, lateOrAbsent, unreadReport, counselingToday, todayMinutes, targetDailyMinutes, } = params;
    if (effectivePenaltyPoints >= 12)
        return "critical";
    if (effectivePenaltyPoints >= 7 || riskCacheAtRisk || awayLong || lateOrAbsent)
        return "risk";
    if (unreadReport || counselingToday)
        return "watch";
    if (targetDailyMinutes > 0 && todayMinutes < Math.max(30, Math.round(targetDailyMinutes * 0.5)))
        return "watch";
    return "stable";
}
function buildOverlayFlagsFromSignals(params) {
    const flags = new Set();
    if (params.riskLevel === "risk" || params.riskLevel === "critical")
        flags.add("risk");
    if (params.effectivePenaltyPoints >= 7)
        flags.add("penalty");
    if (params.awayLong)
        flags.add("away_long");
    if (params.lateOrAbsent)
        flags.add("late_or_absent");
    if (params.unreadReport)
        flags.add("report");
    if (params.counselingToday)
        flags.add("counseling");
    if (params.targetDailyMinutes > 0 && params.todayMinutes < Math.max(30, Math.round(params.targetDailyMinutes * 0.5))) {
        flags.add("minutes");
    }
    return Array.from(flags);
}
function buildIncident(type, priority, student, reason, occurredAt) {
    return {
        type,
        priority,
        studentId: student.studentId,
        studentName: student.studentName,
        seatId: student.seatId,
        className: student.className,
        reason,
        occurredAt,
        actionTarget: `/dashboard/teacher/students/${student.studentId}`,
    };
}
async function buildClassroomSignalsForCenter(db, centerId, nowKst, dateKey) {
    var _a, _b, _c;
    const settings = await loadNotificationSettings(db, centerId);
    const graceMinutes = Number.isFinite(Number(settings.lateAlertGraceMinutes))
        ? Math.max(0, Number(settings.lateAlertGraceMinutes))
        : 20;
    const nowMinutes = nowKst.getHours() * 60 + nowKst.getMinutes();
    const weekAgoKey = toDateKey(new Date(nowKst.getTime() - 6 * 24 * 60 * 60 * 1000));
    const penaltyCutoff = admin.firestore.Timestamp.fromMillis(nowKst.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfTodayKst = new Date(nowKst);
    startOfTodayKst.setHours(0, 0, 0, 0);
    const endOfTodayKst = new Date(nowKst);
    endOfTodayKst.setHours(23, 59, 59, 999);
    const [membersSnap, attendanceSnap, todayStatsSnap, riskCacheSnap, counselingSnap, reportsSnap, penaltyLogsSnap] = await Promise.all([
        db.collection(`centers/${centerId}/members`).where("role", "==", "student").where("status", "==", "active").get(),
        db.collection(`centers/${centerId}/attendanceCurrent`).get(),
        db.collection(`centers/${centerId}/dailyStudentStats/${dateKey}/students`).get(),
        db.doc(`centers/${centerId}/riskCache/${dateKey}`).get(),
        db.collection(`centers/${centerId}/counselingReservations`)
            .where("scheduledAt", ">=", admin.firestore.Timestamp.fromDate(startOfTodayKst))
            .where("scheduledAt", "<=", admin.firestore.Timestamp.fromDate(endOfTodayKst))
            .get(),
        db.collection(`centers/${centerId}/dailyReports`)
            .where("dateKey", ">=", weekAgoKey)
            .where("dateKey", "<=", dateKey)
            .get(),
        db.collection(`centers/${centerId}/penaltyLogs`).where("createdAt", ">=", penaltyCutoff).get(),
    ]);
    const activeMembers = membersSnap.docs.map((docSnap) => (Object.assign({ id: docSnap.id }, docSnap.data())));
    if (activeMembers.length === 0) {
        return {
            updatedAt: admin.firestore.Timestamp.now(),
            dateKey,
            summary: {
                studying: 0,
                awayLong: 0,
                lateOrAbsent: 0,
                atRisk: 0,
                unreadReports: 0,
                counselingPending: 0,
            },
            classSummaries: [],
            seatSignals: [],
            incidents: [],
        };
    }
    const studentIds = activeMembers.map((member) => member.id);
    const studentRefs = studentIds.map((studentId) => db.doc(`centers/${centerId}/students/${studentId}`));
    const progressRefs = studentIds.map((studentId) => db.doc(`centers/${centerId}/growthProgress/${studentId}`));
    const [studentSnaps, progressSnaps] = await Promise.all([
        getDocsInChunks(db, studentRefs),
        getDocsInChunks(db, progressRefs),
    ]);
    const studentMap = new Map();
    studentSnaps.forEach((snap) => {
        if (snap.exists)
            studentMap.set(snap.id, snap.data());
    });
    const progressMap = new Map();
    progressSnaps.forEach((snap) => {
        if (snap.exists)
            progressMap.set(snap.id, snap.data());
    });
    const attendanceByStudentId = new Map();
    attendanceSnap.forEach((seatDoc) => {
        const seatData = seatDoc.data();
        const seatStudentId = asTrimmedString(seatData === null || seatData === void 0 ? void 0 : seatData.studentId, "");
        if (seatStudentId) {
            attendanceByStudentId.set(seatStudentId, Object.assign({ id: seatDoc.id }, seatData));
        }
    });
    const todayStatsByStudentId = new Map();
    todayStatsSnap.forEach((statDoc) => {
        const statData = statDoc.data();
        const statStudentId = asTrimmedString(statData === null || statData === void 0 ? void 0 : statData.studentId, statDoc.id);
        todayStatsByStudentId.set(statStudentId, statData);
    });
    const riskCacheStudentIds = new Set(Array.isArray((_a = riskCacheSnap.data()) === null || _a === void 0 ? void 0 : _a.atRiskStudentIds) ? (_b = riskCacheSnap.data()) === null || _b === void 0 ? void 0 : _b.atRiskStudentIds : []);
    const riskCacheUpdatedAt = toTimestampOrNow((_c = riskCacheSnap.data()) === null || _c === void 0 ? void 0 : _c.updatedAt);
    const pendingCounselingByStudentId = new Map();
    counselingSnap.forEach((reservationDoc) => {
        const reservation = reservationDoc.data();
        const reservationStudentId = asTrimmedString(reservation === null || reservation === void 0 ? void 0 : reservation.studentId, "");
        if (!reservationStudentId)
            return;
        const status = asTrimmedString(reservation === null || reservation === void 0 ? void 0 : reservation.status, "");
        if (status === "done" || status === "canceled")
            return;
        const scheduledAt = toTimestampOrNow(reservation === null || reservation === void 0 ? void 0 : reservation.scheduledAt);
        if (!scheduledAt)
            return;
        if (toDateKey(toKstDate(scheduledAt.toDate())) !== dateKey)
            return;
        const current = pendingCounselingByStudentId.get(reservationStudentId) || [];
        current.push(Object.assign({ id: reservationDoc.id }, reservation));
        pendingCounselingByStudentId.set(reservationStudentId, current);
    });
    const unreadReportByStudentId = new Map();
    reportsSnap.forEach((reportDoc) => {
        const report = reportDoc.data();
        if (asTrimmedString(report === null || report === void 0 ? void 0 : report.status, "") !== "sent")
            return;
        const reportDateKey = asTrimmedString(report === null || report === void 0 ? void 0 : report.dateKey, "");
        if (!reportDateKey || reportDateKey < weekAgoKey || reportDateKey > dateKey)
            return;
        if (report === null || report === void 0 ? void 0 : report.viewedAt)
            return;
        const reportStudentId = asTrimmedString(report === null || report === void 0 ? void 0 : report.studentId, "");
        if (!reportStudentId)
            return;
        const current = unreadReportByStudentId.get(reportStudentId);
        if (!current || toMillisSafe(report.updatedAt) > toMillisSafe(current.latest.updatedAt)) {
            unreadReportByStudentId.set(reportStudentId, {
                latest: Object.assign({ id: reportDoc.id }, report),
                count: ((current === null || current === void 0 ? void 0 : current.count) || 0) + 1,
            });
        }
        else {
            unreadReportByStudentId.set(reportStudentId, {
                latest: current.latest,
                count: current.count + 1,
            });
        }
    });
    const penaltyLogsByStudentId = new Map();
    penaltyLogsSnap.forEach((logDoc) => {
        const log = logDoc.data();
        const logStudentId = asTrimmedString(log === null || log === void 0 ? void 0 : log.studentId, "");
        if (!logStudentId)
            return;
        const current = penaltyLogsByStudentId.get(logStudentId) || [];
        current.push(Object.assign({ id: logDoc.id }, log));
        penaltyLogsByStudentId.set(logStudentId, current);
    });
    const contexts = activeMembers
        .map((member) => {
        var _a;
        const studentId = member.id;
        const student = studentMap.get(studentId) || {};
        const progress = progressMap.get(studentId) || {};
        const attendance = attendanceByStudentId.get(studentId) || null;
        const todayStats = todayStatsByStudentId.get(studentId) || {};
        const unreadReport = unreadReportByStudentId.has(studentId);
        const counselingToday = (pendingCounselingByStudentId.get(studentId) || []).length > 0;
        const studentName = asTrimmedString(student === null || student === void 0 ? void 0 : student.name, asTrimmedString(member === null || member === void 0 ? void 0 : member.displayName, "학생"));
        const className = asTrimmedString(student === null || student === void 0 ? void 0 : student.className, asTrimmedString(member === null || member === void 0 ? void 0 : member.className, "미분류"));
        const seatNo = Number.isFinite(Number(student === null || student === void 0 ? void 0 : student.seatNo)) ? Number(student.seatNo) : 0;
        const seatId = (attendance === null || attendance === void 0 ? void 0 : attendance.id) || (seatNo > 0 ? `seat_${String(seatNo).padStart(3, "0")}` : studentId);
        const lastCheckInAt = toTimestampOrNow(attendance === null || attendance === void 0 ? void 0 : attendance.lastCheckInAt);
        const seatStatus = asTrimmedString(attendance === null || attendance === void 0 ? void 0 : attendance.status, "absent");
        const targetDailyMinutes = Number.isFinite(Number(student === null || student === void 0 ? void 0 : student.targetDailyMinutes))
            ? Math.max(0, Number(student.targetDailyMinutes))
            : 0;
        const todayMinutes = Math.max(0, Math.round(Number((todayStats === null || todayStats === void 0 ? void 0 : todayStats.totalStudyMinutes) || 0)));
        const penaltyLogs = penaltyLogsByStudentId.get(studentId) || [];
        const penaltyFromProgress = parseFiniteNumber(progress === null || progress === void 0 ? void 0 : progress.penaltyPoints);
        const effectivePenaltyPoints = penaltyFromProgress !== null
            ? Math.max(0, Math.round(penaltyFromProgress))
            : derivePenaltyPointsFromLogs(penaltyLogs);
        const awayLong = Boolean(lastCheckInAt &&
            (seatStatus === "away" || seatStatus === "break") &&
            Math.max(0, Math.floor((nowKst.getTime() - lastCheckInAt.toMillis()) / 60000)) >= 15);
        const expectedArrivalTime = asTrimmedString(student === null || student === void 0 ? void 0 : student.expectedArrivalTime);
        const expectedArrivalMinutes = parseExpectedArrivalMinutes(expectedArrivalTime);
        const hasCurrentAttendance = seatStatus === "studying" || seatStatus === "away" || seatStatus === "break";
        const lateOrAbsent = Boolean(expectedArrivalMinutes !== null &&
            !hasCurrentAttendance &&
            nowMinutes >= expectedArrivalMinutes + graceMinutes);
        const riskCacheAtRisk = riskCacheStudentIds.has(studentId);
        const riskLevel = getRiskLevelFromSignals({
            riskCacheAtRisk,
            effectivePenaltyPoints,
            awayLong,
            lateOrAbsent,
            unreadReport,
            counselingToday,
            todayMinutes,
            targetDailyMinutes,
        });
        const overlayFlags = buildOverlayFlagsFromSignals({
            riskLevel,
            effectivePenaltyPoints,
            awayLong,
            lateOrAbsent,
            unreadReport,
            counselingToday,
            todayMinutes,
            targetDailyMinutes,
        });
        let occurredAt = riskCacheUpdatedAt || admin.firestore.Timestamp.now();
        if (awayLong && lastCheckInAt)
            occurredAt = lastCheckInAt;
        if (lateOrAbsent && expectedArrivalMinutes !== null) {
            const expectedDate = new Date(nowKst);
            expectedDate.setHours(Math.floor(expectedArrivalMinutes / 60), expectedArrivalMinutes % 60, 0, 0);
            occurredAt = admin.firestore.Timestamp.fromDate(expectedDate);
        }
        if (unreadReport) {
            const unreadReportRecord = (_a = unreadReportByStudentId.get(studentId)) === null || _a === void 0 ? void 0 : _a.latest;
            const unreadTs = toTimestampOrNow((unreadReportRecord === null || unreadReportRecord === void 0 ? void 0 : unreadReportRecord.updatedAt) || (unreadReportRecord === null || unreadReportRecord === void 0 ? void 0 : unreadReportRecord.createdAt));
            if (unreadTs)
                occurredAt = unreadTs;
        }
        if (counselingToday) {
            const upcoming = (pendingCounselingByStudentId.get(studentId) || [])
                .map((reservation) => ({
                reservation,
                timestamp: toTimestampOrNow(reservation === null || reservation === void 0 ? void 0 : reservation.scheduledAt),
            }))
                .filter((item) => item.timestamp)
                .sort((a, b) => { var _a, _b; return (((_a = a.timestamp) === null || _a === void 0 ? void 0 : _a.toMillis()) || 0) - (((_b = b.timestamp) === null || _b === void 0 ? void 0 : _b.toMillis()) || 0); })[0];
            if (upcoming === null || upcoming === void 0 ? void 0 : upcoming.timestamp)
                occurredAt = upcoming.timestamp;
        }
        const latestPenaltyLog = penaltyLogs
            .map((log) => ({ log, timestamp: toTimestampOrNow(log === null || log === void 0 ? void 0 : log.createdAt) }))
            .filter((item) => item.timestamp)
            .sort((a, b) => { var _a, _b; return (((_a = b.timestamp) === null || _a === void 0 ? void 0 : _a.toMillis()) || 0) - (((_b = a.timestamp) === null || _b === void 0 ? void 0 : _b.toMillis()) || 0); })[0];
        if (latestPenaltyLog === null || latestPenaltyLog === void 0 ? void 0 : latestPenaltyLog.timestamp)
            occurredAt = latestPenaltyLog.timestamp;
        return {
            studentId,
            studentName,
            className,
            seatId,
            seatNo,
            seatStatus,
            lastCheckInAt,
            expectedArrivalTime,
            targetDailyMinutes,
            todayMinutes,
            riskCacheAtRisk,
            effectivePenaltyPoints,
            unreadReport,
            counselingToday,
            awayLong,
            lateOrAbsent,
            riskLevel,
            overlayFlags,
            occurredAt,
        };
    })
        .sort((a, b) => {
        const classDiff = a.className.localeCompare(b.className, "ko");
        if (classDiff !== 0)
            return classDiff;
        return a.seatNo - b.seatNo;
    });
    const classGroups = new Map();
    for (const context of contexts) {
        const current = classGroups.get(context.className) || [];
        current.push(context);
        classGroups.set(context.className, current);
    }
    const summary = {
        studying: contexts.filter((context) => context.seatStatus === "studying").length,
        awayLong: contexts.filter((context) => context.awayLong).length,
        lateOrAbsent: contexts.filter((context) => context.lateOrAbsent).length,
        atRisk: contexts.filter((context) => context.riskLevel === "risk" || context.riskLevel === "critical").length,
        unreadReports: contexts.filter((context) => context.unreadReport).length,
        counselingPending: contexts.filter((context) => context.counselingToday).length,
    };
    const classSummaries = Array.from(classGroups.entries())
        .map(([className, students]) => {
        const activeCount = students.length;
        const occupiedCount = students.filter((student) => student.seatStatus !== "absent").length;
        return {
            className,
            occupancyRate: activeCount > 0 ? Math.round((occupiedCount / activeCount) * 100) : 0,
            avgMinutes: safeAverageMinutes(students.map((student) => student.todayMinutes)),
            riskCount: students.filter((student) => student.riskLevel === "risk" || student.riskLevel === "critical").length,
            awayLongCount: students.filter((student) => student.awayLong).length,
            pendingCounselingCount: students.filter((student) => student.counselingToday).length,
        };
    })
        .sort((a, b) => a.className.localeCompare(b.className, "ko"));
    const incidents = [];
    for (const context of contexts) {
        if (context.riskCacheAtRisk || context.riskLevel === "risk" || context.riskLevel === "critical") {
            incidents.push(buildIncident("risk", context.riskLevel === "critical" ? "critical" : "high", context, context.riskCacheAtRisk
                ? "최근 14일 학습량이 목표 대비 부족합니다."
                : "종합 관제 기준에서 주의가 필요한 학생입니다.", context.occurredAt));
        }
        if (context.awayLong) {
            incidents.push(buildIncident("away_long", "high", context, "외출/휴식 상태가 15분 이상 지속되고 있습니다.", context.occurredAt));
        }
        if (context.lateOrAbsent) {
            incidents.push(buildIncident("late_or_absent", "high", context, `예상 등교 시간 ${context.expectedArrivalTime || "학생이 정한 시간"} 기준으로 미입실 상태입니다.`, context.occurredAt));
        }
        if (context.effectivePenaltyPoints >= 12) {
            incidents.push(buildIncident("penalty_threshold", "critical", context, `실효 벌점 ${context.effectivePenaltyPoints}점이 임계값을 넘었습니다.`, context.occurredAt));
        }
        else if (context.effectivePenaltyPoints >= 7) {
            incidents.push(buildIncident("penalty_threshold", "high", context, `실효 벌점 ${context.effectivePenaltyPoints}점이 개입 기준을 넘었습니다.`, context.occurredAt));
        }
        if (context.unreadReport) {
            incidents.push(buildIncident("unread_report", "medium", context, "최근 7일 발송된 리포트가 아직 열람되지 않았습니다.", context.occurredAt));
        }
        if (context.counselingToday) {
            incidents.push(buildIncident("counseling_pending", "medium", context, "오늘 상담이 예정되어 있습니다.", context.occurredAt));
        }
    }
    incidents.sort(sortByPriority);
    return {
        updatedAt: admin.firestore.Timestamp.now(),
        dateKey,
        summary,
        classSummaries,
        seatSignals: contexts.map((context) => ({
            studentId: context.studentId,
            seatId: context.seatId,
            overlayFlags: context.overlayFlags,
            todayMinutes: context.todayMinutes,
            riskLevel: context.riskLevel,
            effectivePenaltyPoints: context.effectivePenaltyPoints,
            hasUnreadReport: context.unreadReport,
            hasCounselingToday: context.counselingToday,
        })),
        incidents: incidents.slice(0, 120),
    };
}
async function refreshClassroomSignalsForCenter(db, centerId, nowKst) {
    const dateKey = toDateKey(nowKst);
    const payload = await buildClassroomSignalsForCenter(db, centerId, nowKst, dateKey);
    await db.doc(`centers/${centerId}/classroomSignals/${dateKey}`).set(Object.assign(Object.assign({}, payload), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
    return payload;
}
function assertInviteUsable(inv, expectedRole) {
    if (!allowedRoles.includes(inv.intendedRole)) {
        throw new functions.https.HttpsError("failed-precondition", "Invite has invalid role configuration.");
    }
    if (expectedRole && inv.intendedRole !== expectedRole) {
        throw new functions.https.HttpsError("failed-precondition", "Invite role does not match selected signup role.");
    }
    if (inv.isActive === false) {
        throw new functions.https.HttpsError("failed-precondition", "Invite code is inactive.");
    }
    if (typeof inv.maxUses === "number" && typeof inv.usedCount === "number" && inv.usedCount >= inv.maxUses) {
        throw new functions.https.HttpsError("failed-precondition", "Invite code usage limit exceeded.");
    }
    if (inv.expiresAt && inv.expiresAt.toMillis && inv.expiresAt.toMillis() < Date.now()) {
        throw new functions.https.HttpsError("failed-precondition", "Invite code has expired.");
    }
}
exports.deleteStudentAccount = functions.region(region).runWith({
    timeoutSeconds: 540,
    memory: "1GB",
}).https.onCall(async (data, context) => {
    var _a, _b, _c;
    const db = admin.firestore();
    const auth = admin.auth();
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "인증 필요");
    const { studentId, centerId } = data;
    if (!studentId || !centerId)
        throw new functions.https.HttpsError("invalid-argument", "ID 누락");
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
    if (!callerMemberSnap.exists || !isAdminRole((_a = callerMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role)) {
        throw new functions.https.HttpsError("permission-denied", "센터 관리자만 삭제 가능합니다.");
    }
    const targetMemberRef = db.doc(`centers/${centerId}/members/${studentId}`);
    const targetMemberSnap = await targetMemberRef.get();
    if (!targetMemberSnap.exists || ((_b = targetMemberSnap.data()) === null || _b === void 0 ? void 0 : _b.role) !== "student") {
        throw new functions.https.HttpsError("failed-precondition", "해당 센터의 학생 계정만 삭제할 수 있습니다.");
    }
    const targetStudentSnap = await db.doc(`centers/${centerId}/students/${studentId}`).get();
    const targetParentLinkCode = normalizeParentLinkCodeValue((_c = targetStudentSnap.data()) === null || _c === void 0 ? void 0 : _c.parentLinkCode);
    try {
        const errors = [];
        const paths = [
            `users/${studentId}`,
            `userCenters/${studentId}`,
            `centers/${centerId}/members/${studentId}`,
            `centers/${centerId}/students/${studentId}`,
            `centers/${centerId}/growthProgress/${studentId}`,
            `centers/${centerId}/plans/${studentId}`,
            `centers/${centerId}/studyLogs/${studentId}`,
        ];
        const filterCols = [
            `centers/${centerId}/counselingReservations`,
            `centers/${centerId}/counselingLogs`,
            `centers/${centerId}/attendanceRequests`,
            `centers/${centerId}/dailyReports`,
        ];
        await Promise.all([
            ...paths.map(async (path) => {
                try {
                    await db.recursiveDelete(db.doc(path));
                }
                catch (e) {
                    errors.push(`${path}: ${(e === null || e === void 0 ? void 0 : e.message) || "delete failed"}`);
                }
            }),
            ...filterCols.map(async (colPath) => {
                try {
                    const q = await db.collection(colPath).where("studentId", "==", studentId).get();
                    await Promise.all(q.docs.map((docSnap) => db.recursiveDelete(docSnap.ref)));
                }
                catch (e) {
                    errors.push(`${colPath}: ${(e === null || e === void 0 ? void 0 : e.message) || "query delete failed"}`);
                }
            }),
            (async () => {
                try {
                    const statsSnap = await db.collectionGroup("students").where("studentId", "==", studentId).get();
                    const statDocs = statsSnap.docs.filter((docSnap) => docSnap.ref.path.startsWith(`centers/${centerId}/dailyStudentStats/`));
                    await Promise.all(statDocs.map((docSnap) => db.recursiveDelete(docSnap.ref)));
                }
                catch (e) {
                    errors.push(`dailyStudentStats: ${(e === null || e === void 0 ? void 0 : e.message) || "stats cleanup failed"}`);
                }
            })(),
            (async () => {
                try {
                    const leaderboardsSnap = await db.collection(`centers/${centerId}/leaderboards`).get();
                    await Promise.all(leaderboardsSnap.docs.map(async (boardDoc) => {
                        const directEntryRef = boardDoc.ref.collection("entries").doc(studentId);
                        await db.recursiveDelete(directEntryRef);
                        const byStudentQuery = await boardDoc.ref.collection("entries").where("studentId", "==", studentId).get();
                        await Promise.all(byStudentQuery.docs.map((docSnap) => db.recursiveDelete(docSnap.ref)));
                    }));
                }
                catch (e) {
                    errors.push(`leaderboards: ${(e === null || e === void 0 ? void 0 : e.message) || "leaderboard cleanup failed"}`);
                }
            })(),
            (async () => {
                if (!targetParentLinkCode)
                    return;
                try {
                    const lookupRef = getParentLinkLookupRef(db, targetParentLinkCode);
                    const lookupSnap = await lookupRef.get();
                    const lookupData = lookupSnap.exists ? lookupSnap.data() : null;
                    const lookupStudentId = asTrimmedString(lookupData === null || lookupData === void 0 ? void 0 : lookupData.studentId);
                    const lookupCenterId = asTrimmedString(lookupData === null || lookupData === void 0 ? void 0 : lookupData.centerId);
                    if (!lookupSnap.exists || (lookupStudentId === studentId && lookupCenterId === centerId)) {
                        await db.recursiveDelete(lookupRef);
                    }
                }
                catch (e) {
                    errors.push(`parentLinkCodeLookup: ${(e === null || e === void 0 ? void 0 : e.message) || "lookup cleanup failed"}`);
                }
            })(),
            (async () => {
                try {
                    const seatsSnap = await db.collection(`centers/${centerId}/attendanceCurrent`).where("studentId", "==", studentId).get();
                    await Promise.all(seatsSnap.docs.map((seatDoc) => seatDoc.ref.set({
                        studentId: null,
                        status: "absent",
                        updatedAt: admin.firestore.Timestamp.now(),
                        lastCheckInAt: admin.firestore.FieldValue.delete(),
                    }, { merge: true })));
                }
                catch (e) {
                    errors.push(`attendanceCurrent: ${(e === null || e === void 0 ? void 0 : e.message) || "seat cleanup failed"}`);
                }
            })(),
        ]);
        if (errors.length > 0) {
            throw new Error(`학생 데이터 일부 삭제 실패 (${errors.length}건)`);
        }
        try {
            await auth.deleteUser(studentId);
        }
        catch (e) {
            if ((e === null || e === void 0 ? void 0 : e.code) !== "auth/user-not-found") {
                throw e;
            }
        }
        return { ok: true, message: "정리가 완료되었습니다." };
    }
    catch (error) {
        throw new functions.https.HttpsError("internal", "학생 계정 삭제 중 오류가 발생했습니다.");
    }
});
exports.deleteTeacherAccount = functions.region(region).runWith({
    timeoutSeconds: 540,
    memory: "1GB",
}).https.onCall(async (data, context) => {
    var _a, _b;
    const db = admin.firestore();
    const auth = admin.auth();
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "인증 필요");
    const { teacherId, centerId } = data || {};
    if (!teacherId || !centerId) {
        throw new functions.https.HttpsError("invalid-argument", "teacherId / centerId 가 필요합니다.");
    }
    if (teacherId === context.auth.uid) {
        throw new functions.https.HttpsError("failed-precondition", "본인 계정은 직접 삭제할 수 없습니다.");
    }
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
    if (!callerMemberSnap.exists || !isAdminRole((_a = callerMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role)) {
        throw new functions.https.HttpsError("permission-denied", "센터 관리자만 선생님 계정을 삭제할 수 있습니다.");
    }
    const targetMemberRef = db.doc(`centers/${centerId}/members/${teacherId}`);
    const targetMemberSnap = await targetMemberRef.get();
    if (!targetMemberSnap.exists || ((_b = targetMemberSnap.data()) === null || _b === void 0 ? void 0 : _b.role) !== "teacher") {
        throw new functions.https.HttpsError("failed-precondition", "해당 센터의 선생님 계정만 삭제할 수 있습니다.");
    }
    try {
        const userCentersSnap = await db.collection(`userCenters/${teacherId}/centers`).get();
        const otherCenterCount = userCentersSnap.docs.filter((docSnap) => docSnap.id !== centerId).length;
        const isMultiCenter = otherCenterCount > 0;
        const batch = db.batch();
        batch.delete(targetMemberRef);
        batch.delete(db.doc(`userCenters/${teacherId}/centers/${centerId}`));
        await batch.commit();
        if (!isMultiCenter) {
            await Promise.allSettled([
                db.doc(`users/${teacherId}`).delete(),
                db.recursiveDelete(db.doc(`userCenters/${teacherId}`)),
            ]);
            try {
                await auth.deleteUser(teacherId);
            }
            catch (e) {
                if ((e === null || e === void 0 ? void 0 : e.code) !== "auth/user-not-found") {
                    throw e;
                }
            }
        }
        return {
            ok: true,
            message: isMultiCenter
                ? "해당 센터 기준 선생님 계정을 삭제했습니다."
                : "선생님 계정과 인증 정보를 삭제했습니다.",
        };
    }
    catch (error) {
        throw new functions.https.HttpsError("internal", "선생님 계정 삭제 중 오류가 발생했습니다.");
    }
});
exports.updateStudentAccount = functions.region(region).https.onCall(async (data, context) => {
    var _a, _b;
    const db = admin.firestore();
    const auth = admin.auth();
    const { studentId, centerId, password, displayName, schoolName, grade, parentLinkCode, className, memberStatus, seasonLp, stats, todayStudyMinutes, dateKey, } = data;
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "인증 필요");
    if (!studentId || !centerId)
        throw new functions.https.HttpsError("invalid-argument", "ID 누락");
    const callerUid = context.auth.uid;
    const studentRef = db.doc(`centers/${centerId}/students/${studentId}`);
    const existingStudentSnap = await studentRef.get();
    const existingStudentData = existingStudentSnap.exists ? existingStudentSnap.data() : null;
    if (!existingStudentSnap.exists) {
        throw new functions.https.HttpsError("failed-precondition", "Student profile not found.", {
            userMessage: "학생 프로필을 찾을 수 없습니다. 센터 관리자에게 학생 등록 상태를 확인해 주세요.",
        });
    }
    const callerMemberRef = db.doc(`centers/${centerId}/members/${callerUid}`);
    const callerUserCenterRef = db.doc(`userCenters/${callerUid}/centers/${centerId}`);
    const [callerMembership, callerMemberSnap, callerUserCenterSnap] = await Promise.all([
        resolveCenterMembershipRole(db, centerId, callerUid),
        callerMemberRef.get(),
        callerUserCenterRef.get(),
    ]);
    const callerMemberData = callerMemberSnap.exists ? callerMemberSnap.data() : null;
    const callerUserCenterData = callerUserCenterSnap.exists ? callerUserCenterSnap.data() : null;
    const callerMemberRole = typeof (callerMemberData === null || callerMemberData === void 0 ? void 0 : callerMemberData.role) === "string" ? callerMemberData.role.trim() : "";
    const callerUserCenterRole = typeof (callerUserCenterData === null || callerUserCenterData === void 0 ? void 0 : callerUserCenterData.role) === "string" ? callerUserCenterData.role.trim() : "";
    const callerRole = callerMembership.role || callerMemberRole || callerUserCenterRole || null;
    const callerStatus = (_b = (_a = callerMembership.status) !== null && _a !== void 0 ? _a : callerMemberData === null || callerMemberData === void 0 ? void 0 : callerMemberData.status) !== null && _b !== void 0 ? _b : callerUserCenterData === null || callerUserCenterData === void 0 ? void 0 : callerUserCenterData.status;
    const isAdminCaller = isAdminRole(callerRole);
    const isTeacherCaller = callerRole === "teacher";
    const canEditOtherStudent = isAdminCaller || isTeacherCaller;
    const isSelfStudentCaller = callerUid === studentId;
    console.info("[updateStudentAccount] caller resolved", {
        centerId,
        studentId,
        callerUid,
        callerRole,
        callerStatus,
        callerMemberRole,
        callerUserCenterRole,
        isSelfStudentCaller,
        isAdminCaller,
        isTeacherCaller,
    });
    if (!canEditOtherStudent && !isSelfStudentCaller) {
        throw new functions.https.HttpsError("permission-denied", "No permission to update this student.", {
            userMessage: "센터 관리자/선생님 또는 본인만 수정할 수 있습니다.",
        });
    }
    if (!isSelfStudentCaller && !isActiveMembershipStatus(callerStatus)) {
        throw new functions.https.HttpsError("permission-denied", "Inactive membership.", {
            userMessage: "현재 계정 상태로는 학생 정보를 수정할 수 없습니다.",
        });
    }
    const existingParentLinkCode = normalizeParentLinkCodeValue(existingStudentData === null || existingStudentData === void 0 ? void 0 : existingStudentData.parentLinkCode);
    const trimmedDisplayName = typeof displayName === "string" ? displayName.trim() : "";
    const trimmedSchoolName = typeof schoolName === "string" ? schoolName.trim() : "";
    const trimmedGrade = typeof grade === "string" ? grade.trim() : "";
    const hasClassName = className !== undefined;
    const normalizedClassName = hasClassName
        ? (typeof className === "string" && className.trim() ? className.trim() : null)
        : undefined;
    const parentLinkCodeProvided = parentLinkCode !== undefined;
    const normalizedParentLinkCode = parentLinkCode === null ? "" : normalizeParentLinkCodeValue(parentLinkCode);
    const memberStatusProvided = memberStatus !== undefined;
    const normalizedMemberStatus = memberStatusProvided
        ? normalizeStudentMembershipStatusForWrite(memberStatus)
        : null;
    const normalizedSeasonLp = parseFiniteNumber(seasonLp);
    const normalizedTodayStudyMinutes = parseFiniteNumber(todayStudyMinutes);
    const normalizedStats = normalizeStatsPayload(stats);
    if (memberStatusProvided && !isAdminCaller) {
        throw new functions.https.HttpsError("permission-denied", "Only admins can change membership status.", {
            userMessage: "학생 상태 변경은 센터 관리자만 가능합니다.",
        });
    }
    if (memberStatusProvided && !normalizedMemberStatus) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid member status.", {
            userMessage: "상태 값이 올바르지 않습니다. 재원/휴원/퇴원 중에서 선택해 주세요.",
        });
    }
    if (parentLinkCodeProvided) {
        if (parentLinkCode !== null && typeof parentLinkCode !== "string" && typeof parentLinkCode !== "number") {
            throw new functions.https.HttpsError("invalid-argument", "Parent link code type is invalid.");
        }
        if (normalizedParentLinkCode && !/^\d{6}$/.test(normalizedParentLinkCode)) {
            throw new functions.https.HttpsError("invalid-argument", "Parent link code must be 6 digits.", {
                userMessage: "학부모 연동 코드는 6자리 숫자여야 합니다.",
            });
        }
        if (normalizedParentLinkCode && normalizedParentLinkCode !== existingParentLinkCode) {
            const hasConflict = await hasParentLinkCodeConflict(db, normalizedParentLinkCode, {
                exceptStudentId: studentId,
                exceptCenterId: centerId,
            });
            if (hasConflict) {
                throw new functions.https.HttpsError("failed-precondition", "Parent link code is duplicated.", {
                    userMessage: "이미 사용 중인 학부모 연동 코드입니다. 다른 6자리 숫자를 입력해 주세요.",
                });
            }
        }
    }
    if (isSelfStudentCaller) {
        const hasForbiddenUpdate = (typeof password === "string" && password.trim().length > 0) ||
            trimmedDisplayName.length > 0 ||
            hasClassName ||
            memberStatusProvided ||
            seasonLp !== undefined ||
            stats !== undefined ||
            todayStudyMinutes !== undefined ||
            dateKey !== undefined;
        if (hasForbiddenUpdate) {
            throw new functions.https.HttpsError("permission-denied", "학생 계정은 일부 항목만 수정할 수 있습니다.", {
                userMessage: "학생은 학교/학년/학부모 연동 코드만 수정할 수 있습니다.",
            });
        }
        const hasSelfEditableFieldInPayload = typeof schoolName === "string" || typeof grade === "string" || parentLinkCodeProvided;
        if (!hasSelfEditableFieldInPayload) {
            throw new functions.https.HttpsError("invalid-argument", "No editable field provided.", {
                userMessage: "수정할 항목을 입력해 주세요.",
            });
        }
    }
    try {
        if (isAdminCaller) {
            const authUpdates = {};
            if (typeof password === "string" && password.trim().length >= 6)
                authUpdates.password = password.trim();
            if (trimmedDisplayName)
                authUpdates.displayName = trimmedDisplayName;
            if (Object.keys(authUpdates).length > 0) {
                try {
                    await auth.updateUser(studentId, authUpdates);
                }
                catch (authError) {
                    console.warn("Auth update skipped for " + studentId + ": " + authError.message);
                }
            }
        }
        const timestamp = admin.firestore.Timestamp.now();
        const batch = db.batch();
        const userRef = db.doc("users/" + studentId);
        const userUpdate = { updatedAt: timestamp };
        if (trimmedDisplayName)
            userUpdate.displayName = trimmedDisplayName;
        if (trimmedSchoolName)
            userUpdate.schoolName = trimmedSchoolName;
        const hasUserWrite = trimmedDisplayName.length > 0 || trimmedSchoolName.length > 0;
        if (hasUserWrite) {
            batch.set(userRef, userUpdate, { merge: true });
        }
        const studentUpdate = { updatedAt: timestamp };
        if (trimmedDisplayName)
            studentUpdate.name = trimmedDisplayName;
        if (trimmedSchoolName)
            studentUpdate.schoolName = trimmedSchoolName;
        if (trimmedGrade)
            studentUpdate.grade = trimmedGrade;
        if (parentLinkCodeProvided)
            studentUpdate.parentLinkCode = normalizedParentLinkCode || null;
        if (canEditOtherStudent && hasClassName)
            studentUpdate.className = normalizedClassName;
        batch.set(studentRef, studentUpdate, { merge: true });
        if (parentLinkCodeProvided || trimmedDisplayName) {
            const effectiveParentLinkCode = parentLinkCodeProvided ? normalizedParentLinkCode : existingParentLinkCode;
            const effectiveStudentName = trimmedDisplayName || asTrimmedString((existingStudentData === null || existingStudentData === void 0 ? void 0 : existingStudentData.name) || (existingStudentData === null || existingStudentData === void 0 ? void 0 : existingStudentData.displayName), "학생");
            if (existingParentLinkCode && existingParentLinkCode !== effectiveParentLinkCode) {
                const oldLookupRef = getParentLinkLookupRef(db, existingParentLinkCode);
                const oldLookupSnap = await oldLookupRef.get();
                const oldLookupData = oldLookupSnap.exists ? oldLookupSnap.data() : null;
                const oldLookupStudentId = asTrimmedString(oldLookupData === null || oldLookupData === void 0 ? void 0 : oldLookupData.studentId);
                const oldLookupCenterId = asTrimmedString(oldLookupData === null || oldLookupData === void 0 ? void 0 : oldLookupData.centerId);
                if (!oldLookupSnap.exists || (oldLookupStudentId === studentId && oldLookupCenterId === centerId)) {
                    batch.delete(oldLookupRef);
                }
            }
            if (effectiveParentLinkCode) {
                const lookupRef = getParentLinkLookupRef(db, effectiveParentLinkCode);
                const lookupSnap = await lookupRef.get();
                const lookupData = lookupSnap.exists ? lookupSnap.data() : null;
                const lookupStudentId = asTrimmedString(lookupData === null || lookupData === void 0 ? void 0 : lookupData.studentId);
                const lookupCenterId = asTrimmedString(lookupData === null || lookupData === void 0 ? void 0 : lookupData.centerId);
                if (lookupSnap.exists && (lookupStudentId !== studentId || lookupCenterId !== centerId)) {
                    throw new functions.https.HttpsError("failed-precondition", "Parent link code is duplicated.", {
                        userMessage: "이미 사용 중인 학부모 연동 코드입니다. 다른 6자리 숫자를 입력해 주세요.",
                    });
                }
                const lookupPayload = buildParentLinkLookupPayload({
                    code: effectiveParentLinkCode,
                    centerId,
                    studentId,
                    studentName: effectiveStudentName,
                    timestamp,
                    createdAt: lookupData === null || lookupData === void 0 ? void 0 : lookupData.createdAt,
                });
                if (lookupSnap.exists) {
                    batch.set(lookupRef, lookupPayload, { merge: true });
                }
                else {
                    batch.create(lookupRef, lookupPayload);
                }
            }
        }
        const memberRef = db.doc("centers/" + centerId + "/members/" + studentId);
        const memberUpdate = { updatedAt: timestamp };
        if (trimmedDisplayName)
            memberUpdate.displayName = trimmedDisplayName;
        if (hasClassName)
            memberUpdate.className = normalizedClassName;
        if (isAdminCaller && memberStatusProvided)
            memberUpdate.status = normalizedMemberStatus;
        if (canEditOtherStudent) {
            batch.set(memberRef, memberUpdate, { merge: true });
        }
        const userCenterRef = db.doc("userCenters/" + studentId + "/centers/" + centerId);
        const userCenterUpdate = {
            className: normalizedClassName,
            updatedAt: timestamp,
        };
        if (isAdminCaller && memberStatusProvided)
            userCenterUpdate.status = normalizedMemberStatus;
        if (canEditOtherStudent && hasClassName) {
            batch.set(userCenterRef, userCenterUpdate, { merge: true });
        }
        else if (isAdminCaller && memberStatusProvided) {
            batch.set(userCenterRef, userCenterUpdate, { merge: true });
        }
        if (isAdminCaller) {
            const hasSeasonLp = normalizedSeasonLp !== null;
            const hasStats = normalizedStats !== null;
            if (hasSeasonLp || hasStats) {
                const progressUpdate = { updatedAt: timestamp };
                if (hasSeasonLp)
                    progressUpdate.seasonLp = normalizedSeasonLp;
                if (hasStats)
                    progressUpdate.stats = normalizedStats;
                batch.set(db.doc("centers/" + centerId + "/growthProgress/" + studentId), progressUpdate, { merge: true });
            }
            const safeDateKey = typeof dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
                ? dateKey
                : new Date().toISOString().slice(0, 10);
            if (normalizedTodayStudyMinutes !== null) {
                batch.set(db.doc("centers/" + centerId + "/dailyStudentStats/" + safeDateKey + "/students/" + studentId), {
                    totalStudyMinutes: Math.max(0, Math.round(normalizedTodayStudyMinutes)),
                    studentId,
                    centerId,
                    dateKey: safeDateKey,
                    updatedAt: timestamp,
                }, { merge: true });
            }
            if (hasSeasonLp || trimmedDisplayName || hasClassName) {
                const periodKey = safeDateKey.slice(0, 7);
                const rankUpdate = {
                    studentId,
                    updatedAt: timestamp,
                };
                if (hasSeasonLp)
                    rankUpdate.value = normalizedSeasonLp;
                if (trimmedDisplayName)
                    rankUpdate.displayNameSnapshot = trimmedDisplayName;
                if (hasClassName)
                    rankUpdate.classNameSnapshot = normalizedClassName;
                batch.set(db.doc("centers/" + centerId + "/leaderboards/" + periodKey + "_lp/entries/" + studentId), rankUpdate, {
                    merge: true,
                });
            }
        }
        let batchError = null;
        try {
            await batch.commit();
        }
        catch (commitError) {
            batchError = commitError;
            console.error("[updateStudentAccount] batch commit failed", {
                centerId,
                studentId,
                callerUid,
                message: (commitError === null || commitError === void 0 ? void 0 : commitError.message) || commitError,
            });
        }
        if (batchError) {
            const coreWrites = [];
            coreWrites.push(studentRef.set(studentUpdate, { merge: true }));
            if (hasUserWrite) {
                coreWrites.push(userRef.set(userUpdate, { merge: true }));
            }
            if (canEditOtherStudent) {
                coreWrites.push(memberRef.set(memberUpdate, { merge: true }));
            }
            if (canEditOtherStudent && (hasClassName || (isAdminCaller && memberStatusProvided))) {
                coreWrites.push(userCenterRef.set(userCenterUpdate, { merge: true }));
            }
            const coreResults = await Promise.allSettled(coreWrites);
            const hasCoreFailure = coreResults.some((result) => result.status === "rejected");
            if (!hasCoreFailure) {
                console.warn("[updateStudentAccount] core fallback write succeeded after batch failure", {
                    centerId,
                    studentId,
                });
                return {
                    ok: true,
                    partial: true,
                    warning: "core_profile_saved_optional_sync_skipped",
                    updatedBy: isSelfStudentCaller ? "student" : isTeacherCaller ? "teacher" : "admin",
                };
            }
            throw batchError;
        }
        return { ok: true, updatedBy: isSelfStudentCaller ? "student" : isTeacherCaller ? "teacher" : "admin" };
    }
    catch (e) {
        if (e instanceof functions.https.HttpsError) {
            throw e;
        }
        console.error("[updateStudentAccount] failed", {
            centerId,
            studentId,
            callerUid,
            message: (e === null || e === void 0 ? void 0 : e.message) || e,
            stack: (e === null || e === void 0 ? void 0 : e.stack) || null,
        });
        throw new functions.https.HttpsError("internal", "Operation failed due to internal error.", {
            userMessage: toSafeUserMessage(e, "학생 정보를 수정하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."),
        });
    }
});
function buildCounselingDemoUid(centerId, role) {
    const token = centerId
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 24) || "center";
    return `counseling-demo-${role}-${token}`;
}
function buildCounselingDemoEmail(centerId, role) {
    const token = centerId
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 18) || "center";
    return `counseling.${role}.${token}@track-demo.local`;
}
function buildCounselingDemoPassword(role) {
    const roleToken = role === "student" ? "Student" : "Parent";
    return `Track${roleToken}${(0, crypto_1.randomInt)(1000, 10000)}!`;
}
function buildCounselingDemoStudySeeds(referenceDate) {
    const presets = [
        { daysAgo: 11, minutes: 195, completionRate: 68 },
        { daysAgo: 10, minutes: 228, completionRate: 74 },
        { daysAgo: 9, minutes: 256, completionRate: 81 },
        { daysAgo: 8, minutes: 242, completionRate: 79 },
        { daysAgo: 7, minutes: 278, completionRate: 84 },
        { daysAgo: 6, minutes: 305, completionRate: 86 },
        { daysAgo: 5, minutes: 264, completionRate: 82 },
        { daysAgo: 4, minutes: 318, completionRate: 88 },
        { daysAgo: 3, minutes: 296, completionRate: 85 },
        { daysAgo: 2, minutes: 332, completionRate: 91 },
        { daysAgo: 1, minutes: 287, completionRate: 83 },
        { daysAgo: 0, minutes: 245, completionRate: 78 },
    ];
    return presets.map((preset, index) => {
        const dayDate = new Date(referenceDate.getTime());
        dayDate.setDate(dayDate.getDate() - preset.daysAgo);
        dayDate.setHours(0, 0, 0, 0);
        const firstSessionStartAt = new Date(dayDate.getTime());
        firstSessionStartAt.setHours(17, index % 2 === 0 ? 20 : 40, 0, 0);
        const lastSessionEndAt = new Date(firstSessionStartAt.getTime() + preset.minutes * 60 * 1000);
        const previousMinutes = index > 0 ? presets[index - 1].minutes : preset.minutes;
        return Object.assign(Object.assign({}, preset), { date: dayDate, dateKey: toDateKey(dayDate), firstSessionStartAt,
            lastSessionEndAt, growthRate: preset.minutes - previousMinutes });
    });
}
function getAuthErrorCode(error) {
    var _a;
    return String((error === null || error === void 0 ? void 0 : error.code) || ((_a = error === null || error === void 0 ? void 0 : error.errorInfo) === null || _a === void 0 ? void 0 : _a.code) || "").trim().toLowerCase();
}
async function upsertCounselingDemoAuthUser(params) {
    const { auth, uid, email, password, displayName } = params;
    try {
        await auth.getUser(uid);
        await auth.updateUser(uid, { email, password, displayName });
        return;
    }
    catch (error) {
        if (!getAuthErrorCode(error).includes("user-not-found")) {
            throw error;
        }
    }
    try {
        const existingByEmail = await auth.getUserByEmail(email);
        if (existingByEmail.uid !== uid) {
            throw new functions.https.HttpsError("already-exists", "Counseling demo email is already bound to another account.", {
                userMessage: "상담 데모용 이메일이 이미 다른 계정에 연결되어 있습니다. 기존 데모 계정을 정리한 뒤 다시 시도해 주세요.",
            });
        }
        await auth.updateUser(uid, { email, password, displayName });
        return;
    }
    catch (error) {
        const authCode = getAuthErrorCode(error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        if (!authCode.includes("user-not-found")) {
            throw error;
        }
    }
    await auth.createUser({
        uid,
        email,
        password,
        displayName,
    });
}
async function resolveCounselingDemoParentLinkCode(db, centerId, studentId, preferredCode) {
    const normalizedPreferredCode = normalizeParentLinkCodeValue(preferredCode);
    if (normalizedPreferredCode) {
        const hasConflict = await hasParentLinkCodeConflict(db, normalizedPreferredCode, {
            exceptCenterId: centerId,
            exceptStudentId: studentId,
        });
        if (!hasConflict) {
            return normalizedPreferredCode;
        }
    }
    for (let attempt = 0; attempt < 40; attempt += 1) {
        const candidate = String((0, crypto_1.randomInt)(0, 1000000)).padStart(6, "0");
        const hasConflict = await hasParentLinkCodeConflict(db, candidate, {
            exceptCenterId: centerId,
            exceptStudentId: studentId,
        });
        if (!hasConflict) {
            return candidate;
        }
    }
    throw new functions.https.HttpsError("resource-exhausted", "Unable to allocate a parent link code for counseling demo.", {
        userMessage: "상담 데모 부모 연동 코드를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    });
}
exports.registerStudent = functions.region(region).https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    const auth = admin.auth();
    const { email, password, displayName, schoolName, grade, centerId } = data;
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "인증 필요");
    if (!email || !password || !displayName || !centerId) {
        throw new functions.https.HttpsError("invalid-argument", "필수값 누락");
    }
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
    if (!callerMemberSnap.exists || !isAdminRole((_a = callerMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role)) {
        throw new functions.https.HttpsError("permission-denied", "센터 관리자만 학생 계정을 생성할 수 있습니다.");
    }
    try {
        const userRecord = await auth.createUser({ email, password, displayName });
        const uid = userRecord.uid;
        const timestamp = admin.firestore.Timestamp.now();
        await db.runTransaction(async (t) => {
            t.set(db.doc(`users/${uid}`), { id: uid, email, displayName, schoolName, createdAt: timestamp, updatedAt: timestamp });
            t.set(db.doc(`centers/${centerId}/members/${uid}`), { id: uid, centerId, role: "student", status: "active", joinedAt: timestamp, displayName });
            t.set(db.doc(`userCenters/${uid}/centers/${centerId}`), { id: centerId, centerId, role: "student", status: "active", joinedAt: timestamp });
            t.set(db.doc(`centers/${centerId}/students/${uid}`), { id: uid, name: displayName, schoolName, grade, createdAt: timestamp, updatedAt: timestamp });
            t.set(db.doc(`centers/${centerId}/growthProgress/${uid}`), {
                seasonLp: 0,
                penaltyPoints: 0,
                stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 },
                updatedAt: timestamp,
            });
        });
        return { ok: true, uid };
    }
    catch (e) {
        if (e instanceof functions.https.HttpsError) {
            throw e;
        }
        throw new functions.https.HttpsError("internal", "Operation failed due to internal error.", {
            userMessage: toSafeUserMessage(e, "학생 계정 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."),
        });
    }
});
exports.createCounselingDemoBundle = functions.region(region).https.onCall(async (data, context) => {
    var _a, _b;
    const db = admin.firestore();
    const auth = admin.auth();
    const centerId = String((data === null || data === void 0 ? void 0 : data.centerId) || "").trim();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "인증 필요");
    }
    if (!centerId) {
        throw new functions.https.HttpsError("invalid-argument", "센터 정보가 필요합니다.");
    }
    const callerUid = context.auth.uid;
    const callerMemberRef = db.doc(`centers/${centerId}/members/${callerUid}`);
    const callerMemberSnap = await callerMemberRef.get();
    if (!callerMemberSnap.exists || !isAdminRole((_a = callerMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role)) {
        throw new functions.https.HttpsError("permission-denied", "센터 관리자만 상담 데모 계정을 만들 수 있습니다.");
    }
    const callerMemberData = callerMemberSnap.data();
    const teacherName = asTrimmedString(callerMemberData === null || callerMemberData === void 0 ? void 0 : callerMemberData.displayName)
        || asTrimmedString(context.auth.token.name)
        || "센터 관리자";
    const studentUid = buildCounselingDemoUid(centerId, "student");
    const parentUid = buildCounselingDemoUid(centerId, "parent");
    const studentEmail = buildCounselingDemoEmail(centerId, "student");
    const parentEmail = buildCounselingDemoEmail(centerId, "parent");
    const studentPassword = buildCounselingDemoPassword("student");
    const parentPassword = buildCounselingDemoPassword("parent");
    const studentDisplayName = "상담용 서윤";
    const parentDisplayName = "상담용 서윤 학부모";
    const schoolName = "한결고등학교";
    const grade = "고2";
    const targetDailyMinutes = 360;
    const nowKst = toKstDate();
    const nowTs = admin.firestore.Timestamp.fromDate(nowKst);
    const sampleDays = buildCounselingDemoStudySeeds(nowKst);
    const latestStudyDay = sampleDays[sampleDays.length - 1];
    const studentRef = db.doc(`centers/${centerId}/students/${studentUid}`);
    const existingStudentSnap = await studentRef.get();
    const parentLinkCode = await resolveCounselingDemoParentLinkCode(db, centerId, studentUid, (_b = existingStudentSnap.data()) === null || _b === void 0 ? void 0 : _b.parentLinkCode);
    try {
        await upsertCounselingDemoAuthUser({
            auth,
            uid: studentUid,
            email: studentEmail,
            password: studentPassword,
            displayName: studentDisplayName,
        });
        await upsertCounselingDemoAuthUser({
            auth,
            uid: parentUid,
            email: parentEmail,
            password: parentPassword,
            displayName: parentDisplayName,
        });
        const exclusions = {
            rankings: true,
            sms: true,
        };
        const batch = db.batch();
        batch.set(db.doc(`users/${studentUid}`), {
            id: studentUid,
            email: studentEmail,
            displayName: studentDisplayName,
            schoolName,
            targetDailyMinutes,
            isCounselingDemo: true,
            accountKind: "counseling-demo",
            operationalExclusions: exclusions,
            createdAt: nowTs,
            updatedAt: nowTs,
        }, { merge: true });
        batch.set(db.doc(`users/${parentUid}`), {
            id: parentUid,
            email: parentEmail,
            displayName: parentDisplayName,
            isCounselingDemo: true,
            accountKind: "counseling-demo",
            operationalExclusions: exclusions,
            createdAt: nowTs,
            updatedAt: nowTs,
        }, { merge: true });
        batch.set(db.doc(`centers/${centerId}/members/${studentUid}`), {
            id: studentUid,
            centerId,
            role: "student",
            status: "active",
            joinedAt: nowTs,
            displayName: studentDisplayName,
            className: "상담 데모",
            isCounselingDemo: true,
            accountKind: "counseling-demo",
            operationalExclusions: exclusions,
            updatedAt: nowTs,
        }, { merge: true });
        batch.set(db.doc(`userCenters/${studentUid}/centers/${centerId}`), {
            id: centerId,
            centerId,
            role: "student",
            status: "active",
            joinedAt: nowTs,
            displayName: studentDisplayName,
            className: "상담 데모",
            isCounselingDemo: true,
            accountKind: "counseling-demo",
            operationalExclusions: exclusions,
            updatedAt: nowTs,
        }, { merge: true });
        batch.set(db.doc(`centers/${centerId}/members/${parentUid}`), {
            id: parentUid,
            centerId,
            role: "parent",
            status: "active",
            joinedAt: nowTs,
            displayName: parentDisplayName,
            linkedStudentIds: [studentUid],
            isCounselingDemo: true,
            accountKind: "counseling-demo",
            operationalExclusions: exclusions,
            updatedAt: nowTs,
        }, { merge: true });
        batch.set(db.doc(`userCenters/${parentUid}/centers/${centerId}`), {
            id: centerId,
            centerId,
            role: "parent",
            status: "active",
            joinedAt: nowTs,
            displayName: parentDisplayName,
            linkedStudentIds: [studentUid],
            isCounselingDemo: true,
            accountKind: "counseling-demo",
            operationalExclusions: exclusions,
            updatedAt: nowTs,
        }, { merge: true });
        batch.set(studentRef, {
            id: studentUid,
            name: studentDisplayName,
            schoolName,
            grade,
            className: "상담 데모",
            seatNo: 0,
            targetDailyMinutes,
            parentUids: [parentUid],
            parentLinkCode,
            isCounselingDemo: true,
            accountKind: "counseling-demo",
            operationalExclusions: exclusions,
            createdAt: nowTs,
            updatedAt: nowTs,
        }, { merge: true });
        batch.set(db.doc(`centers/${centerId}/growthProgress/${studentUid}`), {
            seasonLp: 1840,
            pointsBalance: 1840,
            totalPointsEarned: 2480,
            penaltyPoints: 2,
            stats: {
                focus: 78,
                consistency: 84,
                achievement: 73,
                resilience: 80,
            },
            dailyPointStatus: {
                [latestStudyDay.dateKey]: {
                    dailyPointAmount: 120,
                    openedStudyBoxes: ["3h"],
                    claimedStudyBoxes: ["3h"],
                },
            },
            lastResetAt: nowTs,
            updatedAt: nowTs,
        }, { merge: true });
        batch.set(db.doc(`centers/${centerId}/billingProfiles/${studentUid}`), {
            id: studentUid,
            studentId: studentUid,
            centerId,
            monthlyFee: 390000,
            createdAt: nowTs,
            updatedAt: nowTs,
        }, { merge: true });
        batch.set(getParentLinkLookupRef(db, parentLinkCode), buildParentLinkLookupPayload({
            code: parentLinkCode,
            centerId,
            studentId: studentUid,
            studentName: studentDisplayName,
            timestamp: nowTs,
        }), { merge: true });
        sampleDays.forEach((day, index) => {
            batch.set(db.doc(`centers/${centerId}/studyLogs/${studentUid}/days/${day.dateKey}`), {
                studentId: studentUid,
                centerId,
                dateKey: day.dateKey,
                totalMinutes: day.minutes,
                awayMinutes: 0,
                firstSessionStartAt: admin.firestore.Timestamp.fromDate(day.firstSessionStartAt),
                lastSessionEndAt: admin.firestore.Timestamp.fromDate(day.lastSessionEndAt),
                updatedAt: nowTs,
                createdAt: nowTs,
            }, { merge: true });
            batch.set(db.doc(`centers/${centerId}/dailyStudentStats/${day.dateKey}/students/${studentUid}`), {
                centerId,
                studentId: studentUid,
                dateKey: day.dateKey,
                todayPlanCompletionRate: day.completionRate,
                totalStudyMinutes: day.minutes,
                studyTimeGrowthRate: day.growthRate,
                createdAt: nowTs,
                updatedAt: nowTs,
            }, { merge: true });
            if (index >= sampleDays.length - 3) {
                batch.set(db.doc(`centers/${centerId}/dailyReports/${day.dateKey}_${studentUid}`), {
                    id: `${day.dateKey}_${studentUid}`,
                    studentId: studentUid,
                    teacherId: callerUid,
                    dateKey: day.dateKey,
                    studentName: studentDisplayName,
                    content: index === sampleDays.length - 1
                        ? "오늘은 루틴 재정비를 중심으로 학습 흐름을 다시 안정시켰습니다. 국어 독해는 속도를 회복했고 수학은 오답 정리 비중을 높여 정확도를 끌어올렸습니다."
                        : index === sampleDays.length - 2
                            ? "전날보다 집중 시간이 늘었고, 문제 풀이 뒤 오답 분류가 깔끔하게 이어졌습니다. 설명식 복습이 특히 안정적으로 진행됐습니다."
                            : "한 주 흐름을 정리하며 과목 전환 타이밍이 좋아졌습니다. 목표량은 조금 남았지만 스스로 보완 과제를 적어 둔 점이 좋았습니다.",
                    teacherNote: "상담 시 데일리 리포트 예시로 바로 설명할 수 있는 샘플입니다.",
                    status: "sent",
                    nextAction: "다음 상담에서는 수학 오답 재개념화 루틴을 20분 단위로 쪼개서 점검합니다.",
                    priority: index === sampleDays.length - 1 ? "high" : "normal",
                    aiMeta: {
                        teacherOneLiner: "계획 유지력은 안정적이고, 과목 전환 시 자기조절이 눈에 띄게 좋아지고 있습니다.",
                        strengths: ["오답 정리 루틴 유지", "집중 회복 속도 향상"],
                        improvements: ["수학 개념 회독 속도 보강", "막판 30분 정리 루틴 고정"],
                        totalStudyMinutes: day.minutes,
                        completionRate: day.completionRate,
                        history7Days: sampleDays.slice(Math.max(0, index - 6), index + 1).map((item) => ({
                            date: item.dateKey,
                            minutes: item.minutes,
                        })),
                        metrics: {
                            growthRate: day.growthRate,
                            deltaMinutesFromAvg: day.minutes - Math.round(sampleDays.reduce((sum, item) => sum + item.minutes, 0) / sampleDays.length),
                            avg7StudyMinutes: Math.round(sampleDays.slice(Math.max(0, index - 6), index + 1).reduce((sum, item) => sum + item.minutes, 0) / Math.min(index + 1, 7)),
                            isNewRecord: day.minutes >= Math.max(...sampleDays.map((item) => item.minutes)),
                            alertLow: day.minutes < 180,
                            streakBadge: day.completionRate >= 80,
                            trendSummary: day.growthRate >= 0 ? "전일 대비 학습 흐름이 유지 또는 상승했습니다." : "전일 대비 학습량이 내려가 다시 리듬을 붙여야 합니다.",
                        },
                    },
                    createdAt: nowTs,
                    updatedAt: nowTs,
                }, { merge: true });
            }
        });
        const counselingLogDates = [
            { id: "counseling-demo-log-1", daysAgo: 6, type: "academic", content: "수학 오답 노트를 단순 정답 암기형에서 개념 재서술형으로 바꾸기로 합의했습니다.", improvement: "오답 1문항마다 핵심 개념 한 줄 요약을 직접 작성합니다." },
            { id: "counseling-demo-log-2", daysAgo: 2, type: "life", content: "주중 피로 누적 때문에 마지막 블록 집중력이 떨어지는 패턴을 확인했습니다.", improvement: "저녁 블록 시작 전 10분 회복 루틴과 과목 전환 체크리스트를 도입합니다." },
        ];
        counselingLogDates.forEach((item) => {
            const createdAt = new Date(nowKst.getTime());
            createdAt.setDate(createdAt.getDate() - item.daysAgo);
            createdAt.setHours(19, 10, 0, 0);
            batch.set(db.doc(`centers/${centerId}/counselingLogs/${item.id}`), {
                id: item.id,
                studentId: studentUid,
                studentName: studentDisplayName,
                teacherId: callerUid,
                teacherName,
                type: item.type,
                content: item.content,
                improvement: item.improvement,
                studentQuestion: "이번 흐름을 유지하려면 어떤 루틴부터 고정하면 좋을까요?",
                createdAt: admin.firestore.Timestamp.fromDate(createdAt),
            }, { merge: true });
        });
        const reservationDate = new Date(nowKst.getTime());
        reservationDate.setDate(reservationDate.getDate() + 2);
        reservationDate.setHours(19, 30, 0, 0);
        batch.set(db.doc(`centers/${centerId}/counselingReservations/counseling-demo-reservation`), {
            id: "counseling-demo-reservation",
            studentId: studentUid,
            studentName: studentDisplayName,
            teacherId: callerUid,
            teacherName,
            scheduledAt: admin.firestore.Timestamp.fromDate(reservationDate),
            status: "confirmed",
            studentNote: "중간고사 전 과목별 우선순위 재조정 상담",
            teacherNote: "학부모 설명용 샘플 예약",
            createdAt: nowTs,
            updatedAt: nowTs,
        }, { merge: true });
        const penaltySeed = [
            { id: "counseling-demo-penalty-1", daysAgo: 9, pointsDelta: 1, reason: "지각 출석", source: "attendance_request", requestType: "late" },
            { id: "counseling-demo-penalty-2", daysAgo: 3, pointsDelta: 1, reason: "루틴 미작성", source: "routine_missing" },
        ];
        penaltySeed.forEach((item) => {
            const createdAt = new Date(nowKst.getTime());
            createdAt.setDate(createdAt.getDate() - item.daysAgo);
            createdAt.setHours(18, 5, 0, 0);
            batch.set(db.doc(`centers/${centerId}/penaltyLogs/${item.id}`), {
                id: item.id,
                centerId,
                studentId: studentUid,
                studentName: studentDisplayName,
                pointsDelta: item.pointsDelta,
                reason: item.reason,
                source: item.source,
                requestType: item.requestType || null,
                createdByUserId: callerUid,
                createdByName: teacherName,
                createdAt: admin.firestore.Timestamp.fromDate(createdAt),
            }, { merge: true });
        });
        await batch.commit();
        const monthlyStudyMinutes = sampleDays
            .filter((day) => day.date.getMonth() === nowKst.getMonth() && day.date.getFullYear() === nowKst.getFullYear())
            .reduce((sum, day) => sum + day.minutes, 0);
        return {
            ok: true,
            centerId,
            student: {
                uid: studentUid,
                email: studentEmail,
                password: studentPassword,
                displayName: studentDisplayName,
                parentLinkCode,
            },
            parent: {
                uid: parentUid,
                email: parentEmail,
                password: parentPassword,
                displayName: parentDisplayName,
            },
            seeded: {
                studyDays: sampleDays.length,
                monthlyStudyMinutes,
                reportCount: 3,
                counselingLogCount: counselingLogDates.length,
                penaltyLogCount: penaltySeed.length,
            },
        };
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        console.error("[createCounselingDemoBundle] failed", {
            centerId,
            callerUid,
            message: (error === null || error === void 0 ? void 0 : error.message) || error,
            stack: (error === null || error === void 0 ? void 0 : error.stack) || null,
        });
        throw new functions.https.HttpsError("internal", "Operation failed due to internal error.", {
            userMessage: toSafeUserMessage(error, "상담 데모 계정을 만드는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."),
        });
    }
});
exports.redeemInviteCode = functions.region(region).https.onCall(async (data, context) => {
    const db = admin.firestore();
    const { code } = data;
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "인증 필요");
    if (!code)
        throw new functions.https.HttpsError("invalid-argument", "초대코드 누락");
    const uid = context.auth.uid;
    const callerDisplayName = context.auth.token.name || null;
    try {
        return await db.runTransaction(async (t) => {
            const inviteRef = db.doc(`inviteCodes/${code}`);
            const inviteSnap = await t.get(inviteRef);
            if (!inviteSnap.exists)
                throw new functions.https.HttpsError("failed-precondition", "Invalid invite code.");
            const inv = inviteSnap.data();
            assertInviteUsable(inv);
            const membershipRef = db.doc(`userCenters/${uid}/centers/${inv.centerId}`);
            const existingMembership = await t.get(membershipRef);
            if (existingMembership.exists) {
                throw new functions.https.HttpsError("already-exists", "Already joined this center.");
            }
            const ts = admin.firestore.Timestamp.now();
            t.set(membershipRef, {
                id: inv.centerId,
                role: inv.intendedRole,
                status: "active",
                joinedAt: ts,
                className: inv.targetClassName || null,
            });
            t.set(db.doc(`centers/${inv.centerId}/members/${uid}`), {
                id: uid,
                role: inv.intendedRole,
                status: "active",
                joinedAt: ts,
                displayName: callerDisplayName,
                className: inv.targetClassName || null,
            });
            t.update(inviteRef, { usedCount: admin.firestore.FieldValue.increment(1), updatedAt: ts });
            return { ok: true, message: "센터 가입이 완료되었습니다." };
        });
    }
    catch (e) {
        if (e instanceof functions.https.HttpsError) {
            throw e;
        }
        throw new functions.https.HttpsError("internal", "Operation failed due to internal error.", {
            userMessage: toSafeUserMessage(e, "센터 가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."),
        });
    }
});
exports.completeSignupWithInvite = functions.region(region).https.onCall(async (data, context) => {
    var _a, _b;
    const db = admin.firestore();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const uid = context.auth.uid;
    const role = data === null || data === void 0 ? void 0 : data.role;
    const code = String((data === null || data === void 0 ? void 0 : data.code) || "").trim();
    const schoolName = String((data === null || data === void 0 ? void 0 : data.schoolName) || "").trim();
    const grade = String((data === null || data === void 0 ? void 0 : data.grade) || "고등학생").trim();
    const parentLinkCode = String((data === null || data === void 0 ? void 0 : data.parentLinkCode) || "").trim();
    const studentLinkCodeInput = (_b = (_a = data === null || data === void 0 ? void 0 : data.studentLinkCode) !== null && _a !== void 0 ? _a : data === null || data === void 0 ? void 0 : data.parentLinkCode) !== null && _b !== void 0 ? _b : "";
    const studentLinkCode = String(studentLinkCodeInput).trim();
    const displayNameInput = String((data === null || data === void 0 ? void 0 : data.displayName) || "").trim();
    const parentPhoneNumber = normalizePhoneNumber((data === null || data === void 0 ? void 0 : data.parentPhoneNumber) || (data === null || data === void 0 ? void 0 : data.phoneNumber) || "");
    const legalConsentsInput = (data === null || data === void 0 ? void 0 : data.legalConsents) && typeof data.legalConsents === "object"
        ? data.legalConsents
        : {};
    const normalizeConsentInput = (value, fallbackSource) => {
        const raw = value && typeof value === "object" ? value : {};
        const version = typeof raw.version === "string" ? raw.version.trim() : "";
        const source = typeof raw.source === "string" && raw.source.trim().length > 0
            ? raw.source.trim()
            : fallbackSource;
        const channel = typeof raw.channel === "string" && raw.channel.trim().length > 0
            ? raw.channel.trim()
            : null;
        return {
            agreed: raw.agreed === true,
            version,
            source,
            channel,
        };
    };
    const termsConsentInput = normalizeConsentInput(legalConsentsInput.terms, "signup");
    const privacyConsentInput = normalizeConsentInput(legalConsentsInput.privacy, "signup");
    const age14ConsentInput = normalizeConsentInput(legalConsentsInput.age14, "signup");
    const marketingEmailConsentInput = normalizeConsentInput(legalConsentsInput.marketingEmail, "signup");
    if (!allowedRoles.includes(role)) {
        throw new functions.https.HttpsError("invalid-argument", "선택한 역할이 유효하지 않습니다.");
    }
    if (!termsConsentInput.agreed || !termsConsentInput.version) {
        throw new functions.https.HttpsError("invalid-argument", "Terms consent is required.", {
            userMessage: "이용약관 동의가 필요합니다.",
        });
    }
    if (!privacyConsentInput.agreed || !privacyConsentInput.version) {
        throw new functions.https.HttpsError("invalid-argument", "Privacy consent is required.", {
            userMessage: "개인정보 수집 및 이용 동의가 필요합니다.",
        });
    }
    if (!age14ConsentInput.agreed || !age14ConsentInput.version) {
        throw new functions.https.HttpsError("invalid-argument", "Age confirmation is required.", {
            userMessage: "만 14세 이상 확인이 필요합니다.",
        });
    }
    if (!marketingEmailConsentInput.version) {
        throw new functions.https.HttpsError("invalid-argument", "Marketing consent version is required.", {
            userMessage: "선택 동의 정보를 다시 확인해 주세요.",
        });
    }
    if (role !== "parent" && !code) {
        throw new functions.https.HttpsError("invalid-argument", "초대 코드가 누락되었습니다.", {
            userMessage: "초대 코드를 입력해주세요.",
        });
    }
    const emailFromToken = context.auth.token.email || null;
    const tokenDisplayName = context.auth.token.name || null;
    const isParentLinkFlow = role === "parent";
    try {
        if (isParentLinkFlow) {
            await assertParentLinkRateLimitAllowed(db, uid);
        }
        if (role === "student" && /^\d{6}$/.test(parentLinkCode)) {
            const hasConflict = await hasParentLinkCodeConflict(db, parentLinkCode);
            if (hasConflict) {
                throw new functions.https.HttpsError("failed-precondition", "Parent link code is duplicated.", {
                    userMessage: "이미 사용 중인 학부모 연동 코드입니다. 다른 6자리 숫자를 입력해 주세요.",
                });
            }
        }
        const result = await db.runTransaction(async (t) => {
            let centerId = "";
            let targetClassName = null;
            let inviteRef = null;
            let linkedStudentRef = null;
            let linkedStudentData = null;
            let linkedStudentId = "";
            if (role === "parent") {
                if (!/^\d{6}$/.test(studentLinkCode)) {
                    throw new functions.https.HttpsError("invalid-argument", "Student link code must be a 6-digit number.", {
                        userMessage: "학생 코드는 6자리 숫자로 입력해주세요.",
                    });
                }
                const lookupCandidate = await resolveParentLinkCandidateFromLookupInTransaction(db, t, studentLinkCode);
                if (lookupCandidate) {
                    centerId = lookupCandidate.centerId;
                    linkedStudentRef = lookupCandidate.studentRef;
                    linkedStudentData = lookupCandidate.studentData;
                    linkedStudentId = lookupCandidate.studentId;
                    targetClassName = lookupCandidate.className || (linkedStudentData === null || linkedStudentData === void 0 ? void 0 : linkedStudentData.className) || null;
                }
                else {
                    const codeAsNumber = Number(studentLinkCode);
                    const candidateQueries = [
                        db.collectionGroup("students").where("parentLinkCode", "==", studentLinkCode).limit(20),
                        db.collectionGroup("students").where("studentLinkCode", "==", studentLinkCode).limit(20),
                    ];
                    if (Number.isFinite(codeAsNumber)) {
                        candidateQueries.push(db.collectionGroup("students").where("parentLinkCode", "==", codeAsNumber).limit(20), db.collectionGroup("students").where("studentLinkCode", "==", codeAsNumber).limit(20));
                    }
                    const studentDocMap = new Map();
                    try {
                        const studentSnaps = await Promise.all(candidateQueries.map((candidateQuery) => candidateQuery.get()));
                        for (const snap of studentSnaps) {
                            for (const studentDoc of snap.docs) {
                                studentDocMap.set(studentDoc.ref.path, studentDoc);
                            }
                        }
                    }
                    catch (lookupError) {
                        const lookupCode = String((lookupError === null || lookupError === void 0 ? void 0 : lookupError.code) || "");
                        const lookupMessage = String((lookupError === null || lookupError === void 0 ? void 0 : lookupError.message) || "");
                        const isPreconditionLookupError = lookupCode === "9" ||
                            /failed[_ -]?precondition/i.test(lookupCode) ||
                            /failed[_ -]?precondition/i.test(lookupMessage);
                        if (!isPreconditionLookupError) {
                            throw lookupError;
                        }
                        console.warn("[completeSignupWithInvite] collectionGroup lookup failed, fallback to center scan", {
                            studentLinkCode,
                            lookupCode,
                            lookupMessage,
                        });
                        const centerSnap = await db.collection("centers").limit(100).get();
                        for (const centerDoc of centerSnap.docs) {
                            const studentCollectionSnap = await db.collection(`centers/${centerDoc.id}/students`).limit(1000).get();
                            for (const studentDoc of studentCollectionSnap.docs) {
                                const studentData = studentDoc.data();
                                const parentCode = normalizeParentLinkCodeValue(studentData === null || studentData === void 0 ? void 0 : studentData.parentLinkCode);
                                const studentCode = normalizeParentLinkCodeValue(studentData === null || studentData === void 0 ? void 0 : studentData.studentLinkCode);
                                if (parentCode === studentLinkCode || studentCode === studentLinkCode) {
                                    studentDocMap.set(studentDoc.ref.path, studentDoc);
                                }
                            }
                        }
                    }
                    if (studentDocMap.size === 0) {
                        throw new functions.https.HttpsError("failed-precondition", "No student found for this link code.", {
                            userMessage: "No student matched this code. Please check the 6-digit student code and try again.",
                        });
                    }
                    let candidates = [];
                    const candidateStudentDocs = Array.from(studentDocMap.values()).filter((studentDoc) => {
                        const pathSegments = studentDoc.ref.path.split("/");
                        return pathSegments.length === 4 && pathSegments[0] === "centers" && pathSegments[2] === "students";
                    });
                    console.info("[completeSignupWithInvite] parent code lookup", {
                        studentLinkCode,
                        rawMatchedDocCount: studentDocMap.size,
                        centerStudentDocCount: candidateStudentDocs.length,
                    });
                    for (const studentDoc of candidateStudentDocs) {
                        const pathSegments = studentDoc.ref.path.split("/");
                        const resolvedCenterId = pathSegments[1];
                        if (!resolvedCenterId)
                            continue;
                        const candidateMemberRef = db.doc(`centers/${resolvedCenterId}/members/${studentDoc.id}`);
                        const candidateUserCenterRef = db.doc(`userCenters/${studentDoc.id}/centers/${resolvedCenterId}`);
                        const [candidateMemberSnap, candidateUserCenterSnap] = await Promise.all([
                            t.get(candidateMemberRef),
                            t.get(candidateUserCenterRef),
                        ]);
                        const candidateMemberData = candidateMemberSnap.exists ? candidateMemberSnap.data() : null;
                        const hasActiveMember = candidateMemberSnap.exists &&
                            (candidateMemberData === null || candidateMemberData === void 0 ? void 0 : candidateMemberData.role) === "student" && isActiveMembershipStatus(candidateMemberData === null || candidateMemberData === void 0 ? void 0 : candidateMemberData.status);
                        const candidateUserCenterData = candidateUserCenterSnap.exists ? candidateUserCenterSnap.data() : null;
                        const hasActiveUserCenter = candidateUserCenterSnap.exists &&
                            (candidateUserCenterData === null || candidateUserCenterData === void 0 ? void 0 : candidateUserCenterData.role) === "student" &&
                            isActiveMembershipStatus(candidateUserCenterData === null || candidateUserCenterData === void 0 ? void 0 : candidateUserCenterData.status);
                        const seatQuery = db
                            .collection(`centers/${resolvedCenterId}/attendanceCurrent`)
                            .where("studentId", "==", studentDoc.id)
                            .limit(1);
                        const seatSnap = await t.get(seatQuery);
                        const hasSeatAssignment = !seatSnap.empty;
                        const studentData = studentDoc.data();
                        candidates.push({
                            centerId: resolvedCenterId,
                            studentDoc,
                            studentData,
                            className: (candidateMemberData === null || candidateMemberData === void 0 ? void 0 : candidateMemberData.className) ||
                                (candidateUserCenterData === null || candidateUserCenterData === void 0 ? void 0 : candidateUserCenterData.className) ||
                                null,
                            hasActiveMember,
                            hasActiveUserCenter,
                            hasSeatAssignment,
                            updatedAtMs: toMillisSafe(studentData === null || studentData === void 0 ? void 0 : studentData.updatedAt),
                            createdAtMs: toMillisSafe(studentData === null || studentData === void 0 ? void 0 : studentData.createdAt),
                        });
                    }
                    if (candidates.length === 0) {
                        console.warn("[completeSignupWithInvite] no resolvable student candidate", {
                            studentLinkCode,
                            rawMatchedDocCount: studentDocMap.size,
                            centerStudentDocCount: candidateStudentDocs.length,
                        });
                        throw new functions.https.HttpsError("failed-precondition", "No student profile could be resolved for this link code.", {
                            userMessage: "A student was found for this code, but profile linkage failed. Please ask the center admin to verify student data.",
                        });
                    }
                    const activeMemberCandidates = candidates.filter((candidate) => candidate.hasActiveMember);
                    if (activeMemberCandidates.length > 0) {
                        candidates = activeMemberCandidates;
                    }
                    const userCenterActiveCandidates = candidates.filter((candidate) => candidate.hasActiveUserCenter);
                    if (userCenterActiveCandidates.length > 0) {
                        candidates = userCenterActiveCandidates;
                    }
                    if (candidates.length > 1) {
                        const seatAssignedCandidates = candidates.filter((candidate) => candidate.hasSeatAssignment);
                        if (seatAssignedCandidates.length > 0) {
                            candidates = seatAssignedCandidates;
                        }
                    }
                    if (candidates.length > 1) {
                        const sortedCandidates = [...candidates].sort((a, b) => {
                            const aMemberScore = (a.hasActiveMember ? 2 : 0) + (a.hasActiveUserCenter ? 1 : 0);
                            const bMemberScore = (b.hasActiveMember ? 2 : 0) + (b.hasActiveUserCenter ? 1 : 0);
                            if (aMemberScore !== bMemberScore)
                                return bMemberScore - aMemberScore;
                            const aSeatScore = a.hasSeatAssignment ? 1 : 0;
                            const bSeatScore = b.hasSeatAssignment ? 1 : 0;
                            if (aSeatScore !== bSeatScore)
                                return bSeatScore - aSeatScore;
                            const aScore = Math.max(a.updatedAtMs, a.createdAtMs);
                            const bScore = Math.max(b.updatedAtMs, b.createdAtMs);
                            if (aScore !== bScore)
                                return bScore - aScore;
                            return a.studentDoc.id.localeCompare(b.studentDoc.id);
                        });
                        candidates = [sortedCandidates[0]];
                        console.warn("[completeSignupWithInvite] duplicate student link code candidates resolved automatically", {
                            studentLinkCode,
                            candidateCount: sortedCandidates.length,
                            selectedStudentId: sortedCandidates[0].studentDoc.id,
                            selectedCenterId: sortedCandidates[0].centerId,
                        });
                    }
                    const selected = candidates[0];
                    centerId = selected.centerId;
                    linkedStudentRef = selected.studentDoc.ref;
                    linkedStudentData = selected.studentData;
                    linkedStudentId = selected.studentDoc.id;
                    targetClassName = selected.className || (linkedStudentData === null || linkedStudentData === void 0 ? void 0 : linkedStudentData.className) || null;
                }
            }
            else {
                inviteRef = db.doc(`inviteCodes/${code}`);
                const inviteSnap = await t.get(inviteRef);
                if (!inviteSnap.exists) {
                    throw new functions.https.HttpsError("failed-precondition", "Invalid invite code.", {
                        userMessage: "유효하지 않은 초대 코드입니다.",
                    });
                }
                const inviteData = inviteSnap.data();
                assertInviteUsable(inviteData, role);
                centerId = inviteData.centerId;
                targetClassName = inviteData.targetClassName || null;
                if (!centerId) {
                    throw new functions.https.HttpsError("failed-precondition", "Invite code has no center information.", {
                        userMessage: "초대 코드의 센터 정보가 올바르지 않습니다.",
                    });
                }
            }
            const userCenterRef = db.doc(`userCenters/${uid}/centers/${centerId}`);
            const memberRef = db.doc(`centers/${centerId}/members/${uid}`);
            const [existingMembership, existingCenterMember] = await Promise.all([t.get(userCenterRef), t.get(memberRef)]);
            const existingMembershipData = existingMembership.exists ? existingMembership.data() : null;
            const existingCenterMemberData = existingCenterMember.exists ? existingCenterMember.data() : null;
            const existingRole = (existingMembershipData === null || existingMembershipData === void 0 ? void 0 : existingMembershipData.role) || (existingCenterMemberData === null || existingCenterMemberData === void 0 ? void 0 : existingCenterMemberData.role) || null;
            const isParentRelink = role === "parent" && existingRole === "parent";
            if ((existingMembership.exists || existingCenterMember.exists) && !isParentRelink) {
                throw new functions.https.HttpsError("already-exists", "Already joined this center.", {
                    userMessage: "이미 가입된 센터입니다.",
                });
            }
            const extractLinkedIds = (value) => {
                if (!Array.isArray(value))
                    return [];
                return value.filter((id) => typeof id === "string" && id.trim().length > 0);
            };
            const ts = admin.firestore.Timestamp.now();
            const legalConsents = {
                terms: {
                    agreed: termsConsentInput.agreed,
                    version: termsConsentInput.version,
                    agreedAt: termsConsentInput.agreed ? ts : null,
                    source: termsConsentInput.source,
                },
                privacy: {
                    agreed: privacyConsentInput.agreed,
                    version: privacyConsentInput.version,
                    agreedAt: privacyConsentInput.agreed ? ts : null,
                    source: privacyConsentInput.source,
                },
                age14: {
                    agreed: age14ConsentInput.agreed,
                    version: age14ConsentInput.version,
                    agreedAt: age14ConsentInput.agreed ? ts : null,
                    source: age14ConsentInput.source,
                },
                marketingEmail: {
                    agreed: marketingEmailConsentInput.agreed,
                    version: marketingEmailConsentInput.version,
                    agreedAt: marketingEmailConsentInput.agreed ? ts : null,
                    source: marketingEmailConsentInput.source,
                    channel: marketingEmailConsentInput.channel || "email",
                },
            };
            let resolvedDisplayName = displayNameInput || tokenDisplayName || "사용자";
            const existingLinkedStudentIds = Array.from(new Set([
                ...extractLinkedIds(existingMembershipData === null || existingMembershipData === void 0 ? void 0 : existingMembershipData.linkedStudentIds),
                ...extractLinkedIds(existingCenterMemberData === null || existingCenterMemberData === void 0 ? void 0 : existingCenterMemberData.linkedStudentIds),
            ]));
            let linkedStudentIds = [];
            let effectiveParentPhone = parentPhoneNumber || normalizePhoneNumber((existingMembershipData === null || existingMembershipData === void 0 ? void 0 : existingMembershipData.phoneNumber) || (existingCenterMemberData === null || existingCenterMemberData === void 0 ? void 0 : existingCenterMemberData.phoneNumber) || "");
            const resolvedStatus = "active";
            if (role === "student") {
                if (!schoolName) {
                    throw new functions.https.HttpsError("invalid-argument", "School name is required for student signup.", {
                        userMessage: "학생 가입에는 학교명이 필요합니다.",
                    });
                }
                if (!/^\d{6}$/.test(parentLinkCode)) {
                    throw new functions.https.HttpsError("invalid-argument", "Parent link code must be 6 digits.", {
                        userMessage: "학생 가입에는 6자리 부모 연동 코드가 필요합니다.",
                    });
                }
            }
            if (role === "parent") {
                if (!linkedStudentRef || !linkedStudentData || !linkedStudentId) {
                    throw new functions.https.HttpsError("failed-precondition", "Linked student data is missing.", {
                        userMessage: "연동할 학생 정보를 찾지 못했습니다. 다시 시도해주세요.",
                    });
                }
                if (!effectiveParentPhone) {
                    throw new functions.https.HttpsError("invalid-argument", "Parent phone number is required.", {
                        userMessage: "학부모 가입/연동 시 휴대폰 번호를 입력해주세요.",
                    });
                }
                linkedStudentIds = Array.from(new Set([...existingLinkedStudentIds, linkedStudentId]));
                if (!displayNameInput) {
                    resolvedDisplayName =
                        (existingMembershipData === null || existingMembershipData === void 0 ? void 0 : existingMembershipData.displayName) ||
                            (existingCenterMemberData === null || existingCenterMemberData === void 0 ? void 0 : existingCenterMemberData.displayName) ||
                            `${(linkedStudentData === null || linkedStudentData === void 0 ? void 0 : linkedStudentData.name) || "학생"} 학부모`;
                }
                t.set(linkedStudentRef, {
                    parentUids: admin.firestore.FieldValue.arrayUnion(uid),
                    updatedAt: ts,
                }, { merge: true });
                const linkedStudentParentCode = normalizeParentLinkCodeValue(linkedStudentData === null || linkedStudentData === void 0 ? void 0 : linkedStudentData.parentLinkCode);
                if (linkedStudentParentCode === studentLinkCode) {
                    await reserveParentLinkCodeLookupInTransaction({
                        db,
                        transaction: t,
                        code: linkedStudentParentCode,
                        centerId,
                        studentId: linkedStudentId,
                        studentName: asTrimmedString((linkedStudentData === null || linkedStudentData === void 0 ? void 0 : linkedStudentData.name) || (linkedStudentData === null || linkedStudentData === void 0 ? void 0 : linkedStudentData.displayName), "학생"),
                        timestamp: ts,
                    });
                }
            }
            const userDocData = {
                id: uid,
                email: emailFromToken,
                displayName: resolvedDisplayName,
                schoolName: schoolName || "",
                legalConsents,
                updatedAt: ts,
                createdAt: ts,
            };
            if (role === "parent" && effectiveParentPhone) {
                userDocData.phoneNumber = effectiveParentPhone;
            }
            t.set(db.doc(`users/${uid}`), userDocData, { merge: true });
            const memberData = {
                id: uid,
                centerId,
                role,
                status: resolvedStatus,
                joinedAt: (existingMembershipData === null || existingMembershipData === void 0 ? void 0 : existingMembershipData.joinedAt) || (existingCenterMemberData === null || existingCenterMemberData === void 0 ? void 0 : existingCenterMemberData.joinedAt) || ts,
                displayName: resolvedDisplayName,
                className: targetClassName || (existingMembershipData === null || existingMembershipData === void 0 ? void 0 : existingMembershipData.className) || (existingCenterMemberData === null || existingCenterMemberData === void 0 ? void 0 : existingCenterMemberData.className) || null,
            };
            if (role === "parent" && effectiveParentPhone) {
                memberData.phoneNumber = effectiveParentPhone;
            }
            if (linkedStudentIds.length > 0) {
                memberData.linkedStudentIds = linkedStudentIds;
            }
            const userCenterData = {
                id: centerId,
                centerId,
                role,
                status: resolvedStatus,
                joinedAt: (existingMembershipData === null || existingMembershipData === void 0 ? void 0 : existingMembershipData.joinedAt) || (existingCenterMemberData === null || existingCenterMemberData === void 0 ? void 0 : existingCenterMemberData.joinedAt) || ts,
                displayName: resolvedDisplayName,
                className: targetClassName || (existingMembershipData === null || existingMembershipData === void 0 ? void 0 : existingMembershipData.className) || (existingCenterMemberData === null || existingCenterMemberData === void 0 ? void 0 : existingCenterMemberData.className) || null,
            };
            if (role === "parent" && effectiveParentPhone) {
                userCenterData.phoneNumber = effectiveParentPhone;
            }
            if (linkedStudentIds.length > 0) {
                userCenterData.linkedStudentIds = linkedStudentIds;
            }
            t.set(memberRef, memberData, { merge: true });
            t.set(userCenterRef, userCenterData, { merge: true });
            if (role === "student") {
                await reserveParentLinkCodeLookupInTransaction({
                    db,
                    transaction: t,
                    code: parentLinkCode,
                    centerId,
                    studentId: uid,
                    studentName: resolvedDisplayName,
                    timestamp: ts,
                });
                t.set(db.doc(`centers/${centerId}/students/${uid}`), {
                    id: uid,
                    name: resolvedDisplayName,
                    schoolName,
                    grade,
                    className: targetClassName,
                    seatNo: 0,
                    targetDailyMinutes: 360,
                    parentUids: [],
                    parentLinkCode,
                    createdAt: ts,
                    updatedAt: ts,
                }, { merge: true });
                t.set(db.doc(`centers/${centerId}/growthProgress/${uid}`), {
                    level: 1,
                    currentXp: 0,
                    nextLevelXp: 1000,
                    seasonLp: 0,
                    penaltyPoints: 0,
                    stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 },
                    skills: {},
                    updatedAt: ts,
                }, { merge: true });
            }
            if (inviteRef) {
                t.update(inviteRef, {
                    usedCount: admin.firestore.FieldValue.increment(1),
                    updatedAt: ts,
                });
            }
            return { ok: true, centerId, role };
        });
        if (isParentLinkFlow) {
            try {
                await clearParentLinkRateLimit(db, uid);
            }
            catch (resetError) {
                console.warn("[completeSignupWithInvite] parent link rate limit reset failed", {
                    uid,
                    message: (resetError === null || resetError === void 0 ? void 0 : resetError.message) || resetError,
                });
            }
        }
        return result;
    }
    catch (e) {
        if (e instanceof functions.https.HttpsError) {
            if (isParentLinkFlow && shouldCountParentLinkFailedAttempt(e)) {
                try {
                    const blockedUntil = await registerParentLinkFailedAttempt(db, uid);
                    if (blockedUntil) {
                        const remainingMinutes = getRemainingLockMinutes(blockedUntil.toDate());
                        throw new functions.https.HttpsError("resource-exhausted", "Parent link temporarily blocked due to repeated failures.", {
                            userMessage: `학생코드 확인 시도가 반복되어 ${remainingMinutes}분 동안 잠겼습니다. 잠시 후 다시 시도해 주세요.`,
                        });
                    }
                }
                catch (rateLimitError) {
                    if (rateLimitError instanceof functions.https.HttpsError) {
                        throw rateLimitError;
                    }
                    console.warn("[completeSignupWithInvite] parent link rate limit write failed", {
                        uid,
                        message: (rateLimitError === null || rateLimitError === void 0 ? void 0 : rateLimitError.message) || rateLimitError,
                    });
                }
            }
            throw e;
        }
        const errorCode = String((e === null || e === void 0 ? void 0 : e.code) || "").toLowerCase();
        const errorMessage = String((e === null || e === void 0 ? void 0 : e.message) || "").trim();
        const strippedErrorMessage = errorMessage.replace(/^FirebaseError:\s*/i, "").trim();
        const normalizedFailedPreconditionMessage = strippedErrorMessage
            .replace(/^\d+\s+FAILED_PRECONDITION:\s*/i, "")
            .trim();
        const normalizedInvalidArgumentMessage = strippedErrorMessage
            .replace(/^\d+\s+INVALID_ARGUMENT:\s*/i, "")
            .trim();
        const normalizedAlreadyExistsMessage = strippedErrorMessage
            .replace(/^\d+\s+ALREADY_EXISTS:\s*/i, "")
            .trim();
        const hasFailedPrecondition = errorCode.includes("failed-precondition") ||
            errorCode === "9" ||
            /failed[_ -]?precondition/i.test(strippedErrorMessage);
        const hasInvalidArgument = errorCode.includes("invalid-argument") ||
            errorCode === "3" ||
            /invalid[_ -]?argument/i.test(strippedErrorMessage);
        const hasAlreadyExists = errorCode.includes("already-exists") ||
            errorCode === "6" ||
            /already[_ -]?exists/i.test(strippedErrorMessage);
        console.error("[completeSignupWithInvite] failed", {
            uid,
            role,
            studentLinkCode,
            code,
            errorCode,
            strippedErrorMessage,
        });
        if (hasFailedPrecondition) {
            const lower = normalizedFailedPreconditionMessage.toLowerCase();
            let userMessage = "학생코드 확인에 실패했습니다. 코드가 올바른지, 해당 학생이 센터에 정상 등록되어 있는지 확인해 주세요.";
            if (lower.includes("no student found for this link code")) {
                userMessage = "해당 학생코드를 찾을 수 없습니다. 6자리 학생코드를 다시 확인해 주세요.";
            }
            else if (lower.includes("no student profile could be resolved for this link code")) {
                userMessage = "학생코드는 확인됐지만 프로필 연결에 실패했습니다. 센터 관리자에게 학생 등록 상태를 확인해 주세요.";
            }
            else if (lower.includes("invite code has no center information")) {
                userMessage = "학생코드에 연결된 센터 정보가 올바르지 않습니다. 센터 관리자에게 문의해 주세요.";
            }
            else if (normalizedFailedPreconditionMessage) {
                userMessage = toSafeUserMessage(normalizedFailedPreconditionMessage, "학생코드 확인에 실패했습니다. 코드가 올바른지 다시 확인해 주세요.");
            }
            throw new functions.https.HttpsError("failed-precondition", "Signup precondition failed.", {
                userMessage,
            });
        }
        if (hasInvalidArgument) {
            throw new functions.https.HttpsError("invalid-argument", "Invalid signup input.", {
                userMessage: toSafeUserMessage(normalizedInvalidArgumentMessage, "입력값을 다시 확인해 주세요. 학생코드, 전화번호 등 필수값이 누락되었을 수 있습니다."),
            });
        }
        if (hasAlreadyExists) {
            throw new functions.https.HttpsError("already-exists", "Signup target already exists.", {
                userMessage: toSafeUserMessage(normalizedAlreadyExistsMessage, "이미 연결된 계정입니다. 로그인 후 대시보드에서 확인해 주세요."),
            });
        }
        throw new functions.https.HttpsError("internal", "Signup processing failed due to an internal error.", {
            userMessage: toSafeUserMessage(e, "회원가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."),
        });
    }
});
exports.confirmInvoicePayment = functions.region(region).https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = String((data === null || data === void 0 ? void 0 : data.centerId) || "").trim();
    const invoiceId = String((data === null || data === void 0 ? void 0 : data.invoiceId) || "").trim();
    if (!centerId || !invoiceId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId and invoiceId are required.");
    }
    const paymentMethodRaw = String((data === null || data === void 0 ? void 0 : data.paymentMethod) || "card").trim();
    const paymentMethod = ["card", "transfer", "cash"].includes(paymentMethodRaw)
        ? paymentMethodRaw
        : "card";
    const paymentKey = typeof (data === null || data === void 0 ? void 0 : data.paymentKey) === "string" ? data.paymentKey.trim() : "";
    const orderId = typeof (data === null || data === void 0 ? void 0 : data.orderId) === "string" ? data.orderId.trim() : "";
    const callerUid = context.auth.uid;
    const invoiceRef = db.doc(`centers/${centerId}/invoices/${invoiceId}`);
    const callerMemberRef = db.doc(`centers/${centerId}/members/${callerUid}`);
    const callerUserCenterRef = db.doc(`userCenters/${callerUid}/centers/${centerId}`);
    const [invoiceSnap, callerMembership, callerMemberSnap, callerUserCenterSnap] = await Promise.all([
        invoiceRef.get(),
        resolveCenterMembershipRole(db, centerId, callerUid),
        callerMemberRef.get(),
        callerUserCenterRef.get(),
    ]);
    if (!invoiceSnap.exists) {
        throw new functions.https.HttpsError("failed-precondition", "Invoice not found.", {
            userMessage: "수납 요청 정보를 찾을 수 없습니다.",
        });
    }
    const invoiceData = invoiceSnap.data();
    const invoiceStudentId = String((invoiceData === null || invoiceData === void 0 ? void 0 : invoiceData.studentId) || "").trim();
    if (!invoiceStudentId) {
        throw new functions.https.HttpsError("failed-precondition", "Invoice has invalid student info.");
    }
    const callerMemberData = callerMemberSnap.exists ? callerMemberSnap.data() : null;
    const callerUserCenterData = callerUserCenterSnap.exists ? callerUserCenterSnap.data() : null;
    const callerMemberRole = typeof (callerMemberData === null || callerMemberData === void 0 ? void 0 : callerMemberData.role) === "string" ? callerMemberData.role.trim() : "";
    const callerUserCenterRole = typeof (callerUserCenterData === null || callerUserCenterData === void 0 ? void 0 : callerUserCenterData.role) === "string" ? callerUserCenterData.role.trim() : "";
    const callerRole = callerMembership.role || callerMemberRole || callerUserCenterRole || null;
    const linkedStudentIds = new Set([
        ...normalizeStringArray(callerMemberData === null || callerMemberData === void 0 ? void 0 : callerMemberData.linkedStudentIds),
        ...normalizeStringArray(callerUserCenterData === null || callerUserCenterData === void 0 ? void 0 : callerUserCenterData.linkedStudentIds),
    ]);
    const isAdminOrTeacher = isAdminRole(callerRole) || callerRole === "teacher";
    const isOwnerStudent = callerUid === invoiceStudentId;
    let isLinkedParent = callerRole === "parent" && linkedStudentIds.has(invoiceStudentId);
    if (!isLinkedParent && callerRole === "parent") {
        const studentSnap = await db.doc(`centers/${centerId}/students/${invoiceStudentId}`).get();
        const parentUids = normalizeStringArray((_a = studentSnap.data()) === null || _a === void 0 ? void 0 : _a.parentUids);
        isLinkedParent = parentUids.includes(callerUid);
    }
    if (!isAdminOrTeacher && !isOwnerStudent && !isLinkedParent) {
        throw new functions.https.HttpsError("permission-denied", "No permission to process this invoice payment.", {
            userMessage: "해당 수납 건을 결제할 권한이 없습니다.",
        });
    }
    let alreadyProcessed = false;
    let processedAmount = parseFiniteNumber(invoiceData === null || invoiceData === void 0 ? void 0 : invoiceData.finalPrice) || 0;
    let processedStatus = String((invoiceData === null || invoiceData === void 0 ? void 0 : invoiceData.status) || "issued");
    await db.runTransaction(async (tx) => {
        var _a, _b;
        const latestInvoiceSnap = await tx.get(invoiceRef);
        if (!latestInvoiceSnap.exists) {
            throw new functions.https.HttpsError("failed-precondition", "Invoice not found during transaction.");
        }
        const latestInvoice = latestInvoiceSnap.data();
        const latestStatus = String((latestInvoice === null || latestInvoice === void 0 ? void 0 : latestInvoice.status) || "issued");
        const latestAmount = parseFiniteNumber(latestInvoice === null || latestInvoice === void 0 ? void 0 : latestInvoice.finalPrice) || 0;
        processedAmount = (_a = parseFiniteNumber(data === null || data === void 0 ? void 0 : data.amount)) !== null && _a !== void 0 ? _a : latestAmount;
        processedStatus = latestStatus;
        if (latestStatus === "paid") {
            alreadyProcessed = true;
            processedStatus = "paid";
            return;
        }
        if (latestStatus === "void" || latestStatus === "refunded") {
            throw new functions.https.HttpsError("failed-precondition", "Invoice is not payable.", {
                userMessage: "무효 또는 환불 처리된 청구건은 결제할 수 없습니다.",
            });
        }
        const nowTs = admin.firestore.Timestamp.now();
        tx.set(invoiceRef, Object.assign(Object.assign({ status: "paid", paymentMethod, paidAt: nowTs, updatedAt: nowTs }, (paymentKey ? { paymentKey } : {})), (orderId ? { orderId } : {})), { merge: true });
        const paymentRef = db.collection(`centers/${centerId}/payments`).doc();
        tx.set(paymentRef, {
            invoiceId,
            centerId,
            studentId: invoiceStudentId,
            studentName: (latestInvoice === null || latestInvoice === void 0 ? void 0 : latestInvoice.studentName) || "학생",
            amount: processedAmount,
            method: paymentMethod,
            status: "success",
            processedAt: nowTs,
            createdAt: nowTs,
            updatedAt: nowTs,
            paidByUid: callerUid,
            paidByRole: callerRole || null,
            paymentKey: paymentKey || null,
            orderId: orderId || null,
        });
        const todayKst = toKstDate();
        const todayKey = toDateKey(todayKst);
        const kpiRef = db.doc(`centers/${centerId}/kpiDaily/${todayKey}`);
        const kpiSnap = await tx.get(kpiRef);
        const prevCollectedRevenue = parseFiniteNumber((_b = kpiSnap.data()) === null || _b === void 0 ? void 0 : _b.collectedRevenue) || 0;
        tx.set(kpiRef, {
            date: todayKey,
            collectedRevenue: prevCollectedRevenue + processedAmount,
            updatedAt: nowTs,
        }, { merge: true });
        processedStatus = "paid";
    });
    return {
        ok: true,
        centerId,
        invoiceId,
        status: processedStatus,
        amount: processedAmount,
        alreadyProcessed,
    };
});
exports.saveNotificationSettingsSecure = functions.region(region).https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = String((data === null || data === void 0 ? void 0 : data.centerId) || "").trim();
    if (!centerId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId is required.");
    }
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
    const callerRole = callerMemberSnap.exists ? (_a = callerMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role : null;
    if (!isAdminRole(callerRole)) {
        throw new functions.https.HttpsError("permission-denied", "센터 관리자만 저장할 수 있습니다.");
    }
    const publicRef = db.doc(`centers/${centerId}/settings/notifications`);
    const privateRef = db.doc(`centers/${centerId}/settingsPrivate/notificationsSecret`);
    const payload = {
        smsEnabled: (data === null || data === void 0 ? void 0 : data.smsEnabled) !== false,
        smsProvider: (["none", "aligo", "custom"].includes(String((data === null || data === void 0 ? void 0 : data.smsProvider) || "")) ? String(data === null || data === void 0 ? void 0 : data.smsProvider) : "none"),
        smsSender: asTrimmedString(data === null || data === void 0 ? void 0 : data.smsSender),
        smsUserId: asTrimmedString(data === null || data === void 0 ? void 0 : data.smsUserId),
        smsEndpointUrl: asTrimmedString(data === null || data === void 0 ? void 0 : data.smsEndpointUrl),
        smsTemplateStudyStart: validateSmsTemplateLength(String((data === null || data === void 0 ? void 0 : data.smsTemplateStudyStart) || ""), "공부 시작 템플릿") || DEFAULT_SMS_TEMPLATES.study_start,
        smsTemplateAwayStart: validateSmsTemplateLength(String((data === null || data === void 0 ? void 0 : data.smsTemplateAwayStart) || ""), "외출 템플릿") || DEFAULT_SMS_TEMPLATES.away_start,
        smsTemplateAwayEnd: validateSmsTemplateLength(String((data === null || data === void 0 ? void 0 : data.smsTemplateAwayEnd) || ""), "복귀 템플릿") || DEFAULT_SMS_TEMPLATES.away_end,
        smsTemplateStudyEnd: validateSmsTemplateLength(String((data === null || data === void 0 ? void 0 : data.smsTemplateStudyEnd) || ""), "공부 종료 템플릿") || DEFAULT_SMS_TEMPLATES.study_end,
        smsTemplateLateAlert: validateSmsTemplateLength(String((data === null || data === void 0 ? void 0 : data.smsTemplateLateAlert) || ""), "지각 템플릿") || DEFAULT_SMS_TEMPLATES.late_alert,
        lateAlertEnabled: (data === null || data === void 0 ? void 0 : data.lateAlertEnabled) !== false,
        lateAlertGraceMinutes: Number.isFinite(Number(data === null || data === void 0 ? void 0 : data.lateAlertGraceMinutes))
            ? Math.max(0, Number(data === null || data === void 0 ? void 0 : data.lateAlertGraceMinutes))
            : 20,
        defaultArrivalTime: admin.firestore.FieldValue.delete(),
        smsApiKey: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: context.auth.uid,
    };
    const rawApiKey = asTrimmedString(data === null || data === void 0 ? void 0 : data.smsApiKey);
    const batch = db.batch();
    if (rawApiKey) {
        payload.smsApiKey = admin.firestore.FieldValue.delete();
        payload.smsApiKeyConfigured = true;
        payload.smsApiKeyLastUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
        batch.set(privateRef, {
            smsApiKey: rawApiKey,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: context.auth.uid,
        }, { merge: true });
    }
    else if ((data === null || data === void 0 ? void 0 : data.clearSmsApiKey) === true) {
        payload.smsApiKey = admin.firestore.FieldValue.delete();
        payload.smsApiKeyConfigured = false;
        payload.smsApiKeyLastUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
        batch.set(privateRef, {
            smsApiKey: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: context.auth.uid,
        }, { merge: true });
    }
    batch.set(publicRef, payload, { merge: true });
    await batch.commit();
    return {
        ok: true,
        smsApiKeyConfigured: rawApiKey.length > 0 ? true : (data === null || data === void 0 ? void 0 : data.clearSmsApiKey) === true ? false : undefined,
    };
});
exports.retrySmsQueueItem = functions.region(region).https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    const queueId = asTrimmedString(data === null || data === void 0 ? void 0 : data.queueId);
    if (!centerId || !queueId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId와 queueId가 필요합니다.");
    }
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
    const callerRole = callerMemberSnap.exists ? (_a = callerMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role : null;
    if (!isAdminRole(callerRole)) {
        throw new functions.https.HttpsError("permission-denied", "센터 관리자만 재시도할 수 있습니다.");
    }
    const queueRef = db.doc(`centers/${centerId}/smsQueue/${queueId}`);
    const queueSnap = await queueRef.get();
    if (!queueSnap.exists) {
        throw new functions.https.HttpsError("not-found", "큐 문서를 찾을 수 없습니다.");
    }
    const queueData = queueSnap.data() || {};
    const currentStatus = String(queueData.status || "");
    if (!["failed", "pending_provider", "cancelled"].includes(currentStatus)) {
        throw new functions.https.HttpsError("failed-precondition", "재시도 가능한 상태가 아닙니다.");
    }
    const settings = await loadNotificationSettings(db, centerId);
    const initialStatus = buildSmsQueueInitialStatus(settings);
    const manualRetryCount = Math.max(0, Number(queueData.manualRetryCount || 0)) + 1;
    const nowTs = admin.firestore.Timestamp.now();
    await queueRef.set({
        status: initialStatus.status,
        providerStatus: initialStatus.providerStatus,
        manualRetryCount,
        nextAttemptAt: initialStatus.status === "queued" ? nowTs : null,
        failedReason: admin.firestore.FieldValue.delete(),
        lastErrorCode: admin.firestore.FieldValue.delete(),
        lastErrorMessage: admin.firestore.FieldValue.delete(),
        failedAt: admin.firestore.FieldValue.delete(),
        processingStartedAt: admin.firestore.FieldValue.delete(),
        processingLeaseUntil: admin.firestore.FieldValue.delete(),
        updatedAt: nowTs,
    }, { merge: true });
    return { ok: true, status: initialStatus.status };
});
exports.cancelSmsQueueItem = functions.region(region).https.onCall(async (data, context) => {
    var _a, _b;
    const db = admin.firestore();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    const queueId = asTrimmedString(data === null || data === void 0 ? void 0 : data.queueId);
    if (!centerId || !queueId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId와 queueId가 필요합니다.");
    }
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
    const callerRole = callerMemberSnap.exists ? (_a = callerMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role : null;
    if (!isAdminRole(callerRole)) {
        throw new functions.https.HttpsError("permission-denied", "센터 관리자만 취소할 수 있습니다.");
    }
    const queueRef = db.doc(`centers/${centerId}/smsQueue/${queueId}`);
    const queueSnap = await queueRef.get();
    if (!queueSnap.exists) {
        throw new functions.https.HttpsError("not-found", "큐 문서를 찾을 수 없습니다.");
    }
    const currentStatus = String(((_b = queueSnap.data()) === null || _b === void 0 ? void 0 : _b.status) || "");
    if (!["queued", "pending_provider", "failed"].includes(currentStatus)) {
        throw new functions.https.HttpsError("failed-precondition", "취소 가능한 상태가 아닙니다.");
    }
    await queueRef.set({
        status: "cancelled",
        providerStatus: "cancelled",
        updatedAt: admin.firestore.Timestamp.now(),
        nextAttemptAt: admin.firestore.FieldValue.delete(),
        processingStartedAt: admin.firestore.FieldValue.delete(),
        processingLeaseUntil: admin.firestore.FieldValue.delete(),
    }, { merge: true });
    return { ok: true };
});
exports.updateSmsRecipientPreference = functions.region(region).https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const db = admin.firestore();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    const studentId = asTrimmedString(data === null || data === void 0 ? void 0 : data.studentId);
    const parentUid = asTrimmedString(data === null || data === void 0 ? void 0 : data.parentUid);
    if (!centerId || !studentId || !parentUid) {
        throw new functions.https.HttpsError("invalid-argument", "centerId, studentId, parentUid가 필요합니다.");
    }
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
    const callerRole = callerMemberSnap.exists ? (_a = callerMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role : null;
    if (!isAdminRole(callerRole)) {
        throw new functions.https.HttpsError("permission-denied", "센터 관리자만 수신 설정을 수정할 수 있습니다.");
    }
    const studentSnap = await db.doc(`centers/${centerId}/students/${studentId}`).get();
    if (!studentSnap.exists) {
        throw new functions.https.HttpsError("not-found", "학생 정보를 찾을 수 없습니다.");
    }
    const parentUids = normalizeStringArray((_b = studentSnap.data()) === null || _b === void 0 ? void 0 : _b.parentUids);
    if (!parentUids.includes(parentUid)) {
        throw new functions.https.HttpsError("failed-precondition", "해당 학생에 연결된 학부모가 아닙니다.");
    }
    const [userSnap, memberSnap] = await Promise.all([
        db.doc(`users/${parentUid}`).get(),
        db.doc(`centers/${centerId}/members/${parentUid}`).get(),
    ]);
    const studentName = asTrimmedString((_c = studentSnap.data()) === null || _c === void 0 ? void 0 : _c.name, "학생");
    const parentName = asTrimmedString(((_d = memberSnap.data()) === null || _d === void 0 ? void 0 : _d.displayName) || ((_e = userSnap.data()) === null || _e === void 0 ? void 0 : _e.displayName) || "학부모");
    const phoneNumber = normalizePhoneNumber(((_f = userSnap.data()) === null || _f === void 0 ? void 0 : _f.phoneNumber) || ((_g = memberSnap.data()) === null || _g === void 0 ? void 0 : _g.phoneNumber));
    const enabled = (data === null || data === void 0 ? void 0 : data.enabled) !== false;
    const eventToggles = normalizeSmsEventToggles(data === null || data === void 0 ? void 0 : data.eventToggles);
    await db.doc(`centers/${centerId}/smsRecipientPreferences/${buildSmsRecipientPreferenceId(studentId, parentUid)}`).set({
        studentId,
        studentName,
        parentUid,
        parentName,
        phoneNumber,
        enabled,
        eventToggles,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: context.auth.uid,
    }, { merge: true });
    return { ok: true };
});
exports.scheduledSmsQueueDispatcher = functions
    .region(region)
    .pubsub.schedule("every 1 minutes")
    .timeZone("Asia/Seoul")
    .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    const nowTs = admin.firestore.Timestamp.fromDate(now);
    const processingLeaseUntil = admin.firestore.Timestamp.fromDate(new Date(now.getTime() + 60 * 1000));
    const [queuedSnap, processingSnap] = await Promise.all([
        db.collectionGroup("smsQueue").where("status", "==", "queued").limit(120).get(),
        db.collectionGroup("smsQueue").where("status", "==", "processing").limit(120).get(),
    ]);
    let processed = 0;
    const touchedCenterIds = new Set();
    const candidateDocs = [...queuedSnap.docs, ...processingSnap.docs];
    for (const queueDoc of candidateDocs) {
        const claimed = await db.runTransaction(async (tx) => {
            var _a;
            const freshSnap = await tx.get(queueDoc.ref);
            if (!freshSnap.exists)
                return null;
            const freshData = freshSnap.data() || {};
            const status = String(freshData.status || "");
            const nextAttemptAt = toTimestampDate(freshData.nextAttemptAt);
            const leaseExpiresAt = toTimestampDate(freshData.processingLeaseUntil);
            if (status === "queued") {
                if (nextAttemptAt && nextAttemptAt.getTime() > now.getTime()) {
                    return null;
                }
            }
            else if (status === "processing") {
                if (leaseExpiresAt && leaseExpiresAt.getTime() > now.getTime()) {
                    return null;
                }
            }
            else {
                return null;
            }
            const centerId = asTrimmedString(freshData.centerId) ||
                asTrimmedString((_a = queueDoc.ref.parent.parent) === null || _a === void 0 ? void 0 : _a.id);
            if (!centerId) {
                return null;
            }
            const nextAttemptCount = Math.max(0, Number(freshData.attemptCount || 0)) + 1;
            tx.set(queueDoc.ref, {
                status: "processing",
                providerStatus: "processing",
                attemptCount: nextAttemptCount,
                processingStartedAt: nowTs,
                processingLeaseUntil,
                updatedAt: nowTs,
            }, { merge: true });
            return Object.assign(Object.assign({}, freshData), { id: queueDoc.id, centerId, attemptCount: nextAttemptCount });
        });
        if (!claimed)
            continue;
        touchedCenterIds.add(String(claimed.centerId));
        await dispatchSmsQueueItem(db, String(claimed.centerId), queueDoc.ref, claimed, Number(claimed.attemptCount || 1));
        processed += 1;
    }
    console.log("[sms-dispatcher] run complete", {
        queuedCandidates: queuedSnap.size,
        processingCandidates: processingSnap.size,
        touchedCenterCount: touchedCenterIds.size,
        processed,
    });
    return null;
});
exports.notifyAttendanceSms = functions.region(region).https.onCall(async (data, context) => {
    var _a, _b;
    const db = admin.firestore();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = String((data === null || data === void 0 ? void 0 : data.centerId) || "").trim();
    const studentId = String((data === null || data === void 0 ? void 0 : data.studentId) || "").trim();
    const eventType = String((data === null || data === void 0 ? void 0 : data.eventType) || "").trim();
    if (!centerId || !studentId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId and studentId are required.", {
            userMessage: "센터 또는 학생 정보가 누락되었습니다.",
        });
    }
    if (!["study_start", "away_start", "away_end", "study_end", "late_alert", "check_in", "check_out"].includes(eventType)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid event type.", {
            userMessage: "알림 타입이 올바르지 않습니다.",
        });
    }
    const nowKst = toKstDate();
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
    const callerRole = callerMemberSnap.exists ? (_a = callerMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role : null;
    const isTeacherOrAdminCaller = callerRole === "teacher" || isAdminRole(callerRole);
    const isStudentSelfCaller = callerRole === "student" && context.auth.uid === studentId;
    if (!isTeacherOrAdminCaller && !isStudentSelfCaller) {
        throw new functions.https.HttpsError("permission-denied", "Only authorized members can send notifications.");
    }
    if (isStudentSelfCaller && !["study_start", "study_end", "check_in", "check_out"].includes(eventType)) {
        throw new functions.https.HttpsError("permission-denied", "Students can only notify study start/end events.");
    }
    const studentSnap = await db.doc(`centers/${centerId}/students/${studentId}`).get();
    if (!studentSnap.exists) {
        throw new functions.https.HttpsError("failed-precondition", "Student not found.", {
            userMessage: "학생 정보를 찾을 수 없습니다.",
        });
    }
    const studentNameRaw = (_b = studentSnap.data()) === null || _b === void 0 ? void 0 : _b.name;
    const studentName = typeof studentNameRaw === "string" && studentNameRaw.trim() ? studentNameRaw.trim() : "학생";
    if (isStudentSelfCaller) {
        const todayKey = toDateKey(nowKst);
        const [todayStatSnap, attendanceSnap] = await Promise.all([
            db.doc(`centers/${centerId}/dailyStudentStats/${todayKey}/students/${studentId}`).get(),
            db.collection(`centers/${centerId}/attendanceCurrent`).where("studentId", "==", studentId).limit(3).get(),
        ]);
        const hasAttendanceTrace = attendanceSnap.docs.some((docSnap) => {
            var _a;
            const status = String(((_a = docSnap.data()) === null || _a === void 0 ? void 0 : _a.status) || "");
            return ["studying", "away", "break", "absent"].includes(status);
        });
        if (!todayStatSnap.exists && !hasAttendanceTrace) {
            throw new functions.https.HttpsError("failed-precondition", "Study trace not found.", {
                userMessage: "학습 기록이 확인된 뒤에만 보호자 알림을 보낼 수 있습니다.",
            });
        }
    }
    const settings = await loadNotificationSettings(db, centerId);
    const queueResult = await queueParentSmsNotification(db, {
        centerId,
        studentId,
        studentName,
        eventType,
        eventAt: nowKst,
        settings,
    });
    return {
        ok: true,
        queuedCount: queueResult.queuedCount,
        recipientCount: queueResult.recipientCount,
        provider: settings.smsProvider || "none",
        message: queueResult.message,
    };
});
exports.notifyDailyReportReady = functions.region(region).https.onCall(async (data, context) => {
    var _a, _b, _c;
    const db = admin.firestore();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    const studentId = asTrimmedString(data === null || data === void 0 ? void 0 : data.studentId);
    const dateKey = asTrimmedString(data === null || data === void 0 ? void 0 : data.dateKey, toDateKey(toKstDate()));
    if (!centerId || !studentId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId와 studentId가 필요합니다.");
    }
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
    const callerRole = callerMemberSnap.exists ? (_a = callerMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role : null;
    const canNotify = callerRole === "teacher" || isAdminRole(callerRole);
    if (!canNotify) {
        throw new functions.https.HttpsError("permission-denied", "교사 또는 관리자만 리포트 알림을 보낼 수 있습니다.");
    }
    const reportRef = db.doc(`centers/${centerId}/dailyReports/${dateKey}_${studentId}`);
    const [studentSnap, reportSnap] = await Promise.all([
        db.doc(`centers/${centerId}/students/${studentId}`).get(),
        reportRef.get(),
    ]);
    if (!studentSnap.exists) {
        throw new functions.https.HttpsError("failed-precondition", "Student not found.");
    }
    if (reportSnap.exists && ((_b = reportSnap.data()) === null || _b === void 0 ? void 0 : _b.parentSmsNotifiedAt)) {
        return { ok: true, queuedCount: 0, recipientCount: 0, skipped: true };
    }
    const studentName = asTrimmedString((_c = studentSnap.data()) === null || _c === void 0 ? void 0 : _c.name, "학생");
    const nowKst = toKstDate();
    const settings = await loadNotificationSettings(db, centerId);
    const queueResult = await queueCustomParentSmsNotification(db, {
        centerId,
        studentId,
        studentName,
        eventType: "daily_report",
        message: `[트랙학습센터] ${studentName} 학생의 오늘자 학습 리포트가 도착했습니다. 앱에서 확인해 주세요.`,
        date: nowKst,
        settings,
        dedupeKey: `${centerId}_${studentId}_daily_report_${dateKey}`,
        notificationTitle: "일일 리포트 알림",
        isImportant: true,
        metadata: {
            dateKey,
            reportId: `${dateKey}_${studentId}`,
        },
    });
    if (queueResult.queuedCount > 0 && reportSnap.exists) {
        await reportRef.set({
            parentSmsNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    return {
        ok: true,
        queuedCount: queueResult.queuedCount,
        recipientCount: queueResult.recipientCount,
        provider: settings.smsProvider || "none",
    };
});
exports.sendPaymentReminderBatch = functions.region(region).https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    if (!centerId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId가 필요합니다.");
    }
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
    const callerRole = callerMemberSnap.exists ? (_a = callerMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role : null;
    if (!isAdminRole(callerRole)) {
        throw new functions.https.HttpsError("permission-denied", "센터 관리자만 결제 알림을 보낼 수 있습니다.");
    }
    const nowKst = toKstDate();
    const todayKey = toDateKey(nowKst);
    const todayStart = new Date(nowKst.getFullYear(), nowKst.getMonth(), nowKst.getDate());
    const settings = await loadNotificationSettings(db, centerId);
    const invoicesSnap = await db.collection(`centers/${centerId}/invoices`).where("status", "==", "issued").get();
    let queuedCount = 0;
    let candidateCount = 0;
    for (const invoiceDoc of invoicesSnap.docs) {
        const invoiceData = invoiceDoc.data() || {};
        const studentId = asTrimmedString(invoiceData.studentId);
        if (!studentId)
            continue;
        const dueDate = toTimestampDate(invoiceData.cycleEndDate) ||
            toTimestampDate(invoiceData.dueDate) ||
            null;
        if (!dueDate)
            continue;
        const dueKst = toKstDate(dueDate);
        const dueStart = new Date(dueKst.getFullYear(), dueKst.getMonth(), dueKst.getDate());
        const daysLeft = Math.round((dueStart.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000));
        if (daysLeft !== 3)
            continue;
        if (asTrimmedString(invoiceData.lastPaymentReminderSentDateKey) === todayKey)
            continue;
        candidateCount += 1;
        const studentName = asTrimmedString(invoiceData.studentName, "학생");
        const dueDateLabel = toDateKey(dueKst);
        const queueResult = await queueCustomParentSmsNotification(db, {
            centerId,
            studentId,
            studentName,
            eventType: "payment_reminder",
            message: `[트랙학습센터] 안녕하세요 학부모님, ${studentName} 학생의 이번 달 수강료 결제일이 3일 남았습니다. (기한: ${dueDateLabel})`,
            date: nowKst,
            settings,
            dedupeKey: `${centerId}_${invoiceDoc.id}_payment_reminder_${todayKey}`,
            notificationTitle: "결제 예정 알림",
            isImportant: true,
            metadata: {
                dueDate: dueDateLabel,
                invoiceId: invoiceDoc.id,
            },
        });
        if (queueResult.queuedCount > 0) {
            queuedCount += queueResult.queuedCount;
            await invoiceDoc.ref.set({
                lastPaymentReminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
                lastPaymentReminderSentDateKey: todayKey,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
    }
    return {
        ok: true,
        queuedCount,
        candidateCount,
        provider: settings.smsProvider || "none",
    };
});
exports.runLateArrivalCheck = functions.region(region).https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = String((data === null || data === void 0 ? void 0 : data.centerId) || "").trim();
    if (!centerId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId is required.");
    }
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
    const callerRole = callerMemberSnap.exists ? (_a = callerMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role : null;
    const canRun = callerRole === "teacher" || isAdminRole(callerRole);
    if (!canRun) {
        throw new functions.https.HttpsError("permission-denied", "Only teacher/admin can run late check.");
    }
    const nowKst = toKstDate();
    const attendanceSnap = await db
        .collection(`centers/${centerId}/attendanceCurrent`)
        .where("status", "in", [...ACTIVE_STUDY_ATTENDANCE_STATUS_VALUES])
        .get();
    const alertsTriggered = await runLateArrivalCheckForCenter(db, centerId, nowKst, attendanceSnap);
    return {
        ok: true,
        centerId,
        alertsTriggered,
        checkedAt: admin.firestore.Timestamp.now(),
    };
});
/**
 * 10분마다 실행되는 통합 출석 점검 함수.
 * 센터별로 attendanceCurrent를 한 번만 읽어 두 가지 작업을 처리합니다:
 * 1. 지각 알림 발송 (sendScheduledLateArrivalAlerts 로직)
 * 2. 6시간 초과 세션 자동 종료 (autoCloseStuckStudySessions 로직)
 */
exports.scheduledAttendanceCheck = functions
    .region(region)
    .pubsub.schedule("every 10 minutes")
    .timeZone("Asia/Seoul")
    .onRun(async () => {
    const db = admin.firestore();
    const nowKst = toKstDate();
    const MAX_SESSION_MINUTES = 360; // 6시간
    const cutoffTimestamp = admin.firestore.Timestamp.fromMillis(Date.now() - MAX_SESSION_MINUTES * 60 * 1000);
    const centersSnap = await db.collection("centers").get();
    let totalLateAlerts = 0;
    let totalClosed = 0;
    let totalActiveSeatsScanned = 0;
    for (const centerDoc of centersSnap.docs) {
        const centerId = centerDoc.id;
        // 실제 활동 중인 좌석만 읽어 두 작업에 공유
        const attendanceSnap = await db
            .collection(`centers/${centerId}/attendanceCurrent`)
            .where("status", "in", [...ACTIVE_STUDY_ATTENDANCE_STATUS_VALUES])
            .get();
        totalActiveSeatsScanned += attendanceSnap.size;
        // ── 1. 지각 알림 ──────────────────────────────────────
        totalLateAlerts += await runLateArrivalCheckForCenter(db, centerId, nowKst, attendanceSnap);
        // ── 2. 6시간 초과 세션 자동 종료 ──────────────────────
        for (const seatDoc of attendanceSnap.docs) {
            const seat = seatDoc.data();
            if (seat.status !== "studying")
                continue;
            const lastCheckInAt = seat.lastCheckInAt;
            if (!lastCheckInAt || lastCheckInAt > cutoffTimestamp)
                continue;
            const studentId = seat.studentId;
            if (!studentId)
                continue;
            const startKst = toKstDate(lastCheckInAt.toDate());
            const sessionDateKey = toDateKey(startKst);
            const autoEndTime = admin.firestore.Timestamp.fromMillis(lastCheckInAt.toMillis() + MAX_SESSION_MINUTES * 60 * 1000);
            const batch = db.batch();
            batch.update(seatDoc.ref, {
                status: "absent",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            const logRef = db
                .collection("centers").doc(centerId)
                .collection("studyLogs").doc(studentId)
                .collection("days").doc(sessionDateKey);
            const existingLogSnap = await logRef.get();
            const existingLog = existingLogSnap.exists ? existingLogSnap.data() : null;
            const previousFirstSessionAt = toTimestampOrNow(existingLog === null || existingLog === void 0 ? void 0 : existingLog.firstSessionStartAt);
            const previousLastSessionAt = toTimestampOrNow(existingLog === null || existingLog === void 0 ? void 0 : existingLog.lastSessionEndAt);
            const nextFirstSessionAt = previousFirstSessionAt && previousFirstSessionAt.toMillis() <= lastCheckInAt.toMillis()
                ? previousFirstSessionAt
                : lastCheckInAt;
            const nextLastSessionAt = previousLastSessionAt && previousLastSessionAt.toMillis() >= autoEndTime.toMillis()
                ? previousLastSessionAt
                : autoEndTime;
            const awayGapMinutes = previousLastSessionAt
                ? Math.round((lastCheckInAt.toMillis() - previousLastSessionAt.toMillis()) / 60000)
                : 0;
            const normalizedAwayGapMinutes = awayGapMinutes > 0 && awayGapMinutes < 180 ? awayGapMinutes : 0;
            batch.set(logRef, Object.assign(Object.assign({ studentId,
                centerId, dateKey: sessionDateKey, firstSessionStartAt: nextFirstSessionAt, lastSessionEndAt: nextLastSessionAt }, (normalizedAwayGapMinutes > 0 ? { awayMinutes: admin.firestore.FieldValue.increment(normalizedAwayGapMinutes) } : {})), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }), { merge: true });
            const sessionRef = logRef.collection("sessions").doc();
            batch.set(sessionRef, {
                centerId,
                studentId,
                dateKey: sessionDateKey,
                startTime: lastCheckInAt,
                endTime: autoEndTime,
                durationMinutes: MAX_SESSION_MINUTES,
                autoClosedAt: admin.firestore.FieldValue.serverTimestamp(),
                closedReason: "auto_6h_limit",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            const progressRef = db
                .collection("centers").doc(centerId)
                .collection("growthProgress").doc(studentId);
            batch.set(progressRef, {
                seasonLp: admin.firestore.FieldValue.increment(MAX_SESSION_MINUTES),
                "stats.focus": admin.firestore.FieldValue.increment(0.1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            await batch.commit();
            totalClosed++;
            console.log("[auto-close-session] 6시간 초과 세션 자동 종료", {
                centerId,
                studentId,
                sessionDateKey,
                lastCheckInAt: lastCheckInAt.toDate().toISOString(),
                autoEndTime: autoEndTime.toDate().toISOString(),
            });
        }
    }
    console.log("[attendance-check] run complete", {
        centerCount: centersSnap.size,
        totalActiveSeatsScanned,
        totalLateAlerts,
        totalClosed,
        atKst: nowKst.toISOString(),
    });
    return null;
});
/**
 * 매일 새벽 3시(KST)에 오래된 임시 문서를 삭제합니다.
 * - smsQueue, smsLogs, lateAlerts: 7일 초과 삭제
 * - parentNotifications: 30일 초과 삭제
 * 삭제는 센터별로 최대 500건씩 처리합니다.
 */
exports.cleanupOldDocuments = functions
    .region(region)
    .pubsub.schedule("0 3 * * *")
    .timeZone("Asia/Seoul")
    .onRun(async () => {
    const db = admin.firestore();
    const now = Date.now();
    const sevenDaysAgo = admin.firestore.Timestamp.fromMillis(now - 7 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = admin.firestore.Timestamp.fromMillis(now - 3 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = admin.firestore.Timestamp.fromMillis(now - 30 * 24 * 60 * 60 * 1000);
    const deleteOldDocsByCollectionGroup = async (collectionId, cutoff, batchSize = 500) => {
        let deleted = 0;
        while (true) {
            const snap = await db
                .collectionGroup(collectionId)
                .where("createdAt", "<", cutoff)
                .limit(batchSize)
                .get();
            if (snap.empty)
                break;
            const batch = db.batch();
            snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
            await batch.commit();
            deleted += snap.size;
            if (snap.size < batchSize)
                break;
        }
        return deleted;
    };
    const [sq, sdl, sl, sd, la, pn] = await Promise.all([
        deleteOldDocsByCollectionGroup("smsQueue", thirtyDaysAgo),
        deleteOldDocsByCollectionGroup("smsDeliveryLogs", thirtyDaysAgo),
        deleteOldDocsByCollectionGroup("smsLogs", thirtyDaysAgo),
        deleteOldDocsByCollectionGroup("smsDedupes", threeDaysAgo),
        deleteOldDocsByCollectionGroup("lateAlerts", sevenDaysAgo),
        deleteOldDocsByCollectionGroup("parentNotifications", thirtyDaysAgo),
    ]);
    const totalDeleted = sq + sdl + sl + sd + la + pn;
    console.log("[cleanup] run complete", {
        totalDeleted,
        smsQueueDeleted: sq,
        smsDeliveryLogsDeleted: sdl,
        smsLogsDeleted: sl,
        smsDedupesDeleted: sd,
        lateAlertsDeleted: la,
        parentNotificationsDeleted: pn,
    });
    return null;
});
/**
 * 매주 일요일 오후 8시(KST) — 학부모에게 자녀의 주간 공부 리포트 SMS 발송
 * 지난 7일(월~일) 합산 집중 시간을 dailyStudentStats에서 읽어 SMS로 전송합니다.
 */
exports.scheduledWeeklyReport = functions
    .region(region)
    .pubsub.schedule("0 20 * * 0")
    .timeZone("Asia/Seoul")
    .onRun(async () => {
    var _a;
    const db = admin.firestore();
    const nowKst = toKstDate();
    // 지난 7일 dateKey 생성
    const dateKeys = [];
    for (let i = 1; i <= 7; i++) {
        const d = new Date(nowKst);
        d.setDate(d.getDate() - i);
        dateKeys.push(toDateKey(d));
    }
    const centersSnap = await db.collection("centers").get();
    let totalSent = 0;
    for (const centerDoc of centersSnap.docs) {
        const centerId = centerDoc.id;
        const settings = await loadNotificationSettings(db, centerId);
        if (settings.smsEnabled === false || !settings.smsProvider || settings.smsProvider === "none")
            continue;
        // 활성 학생 목록
        const membersSnap = await db
            .collection(`centers/${centerId}/members`)
            .where("role", "==", "student")
            .where("status", "==", "active")
            .get();
        const activeStudentIds = membersSnap.docs.map((memberDoc) => memberDoc.id);
        if (activeStudentIds.length === 0)
            continue;
        const [studentProfileMap, weeklyMinutesByStudent] = await Promise.all([
            loadStudentProfileMap(db, centerId, activeStudentIds),
            loadStudyMinutesByStudentForDateKeys(db, centerId, dateKeys),
        ]);
        for (const studentId of activeStudentIds) {
            const weeklyMinutes = weeklyMinutesByStudent.get(studentId) || 0;
            const studentData = studentProfileMap.get(studentId) || null;
            const studentName = typeof (studentData === null || studentData === void 0 ? void 0 : studentData.name) === "string" ? studentData.name : "학생";
            const targetWeekly = (Number((_a = studentData === null || studentData === void 0 ? void 0 : studentData.targetDailyMinutes) !== null && _a !== void 0 ? _a : 0) * 5);
            const weeklyHours = Math.floor(weeklyMinutes / 60);
            const weeklyMins = weeklyMinutes % 60;
            const timeLabel = weeklyHours > 0 ? `${weeklyHours}시간 ${weeklyMins}분` : `${weeklyMins}분`;
            const achieveRate = targetWeekly > 0 ? Math.round((weeklyMinutes / targetWeekly) * 100) : null;
            const achieveLabel = achieveRate !== null ? ` (목표 대비 ${achieveRate}%)` : "";
            const message = `[주간 리포트] ${studentName} 학생이 이번 주 ${timeLabel} 공부했습니다${achieveLabel}.`;
            const recipients = await collectParentRecipients(db, centerId, studentId);
            if (recipients.length === 0)
                continue;
            const { allowedRecipients, suppressedRecipients } = await splitRecipientsBySmsPreference(db, centerId, studentId, studentName, "weekly_report", recipients);
            const ts = admin.firestore.Timestamp.now();
            const batch = db.batch();
            const provider = settings.smsProvider || "none";
            const initialStatus = buildSmsQueueInitialStatus(settings);
            allowedRecipients.forEach((recipient) => {
                const queueRef = db.collection(`centers/${centerId}/smsQueue`).doc();
                batch.set(queueRef, {
                    centerId,
                    studentId,
                    studentName,
                    parentUid: recipient.parentUid,
                    parentName: recipient.parentName,
                    phoneNumber: recipient.phoneNumber,
                    to: recipient.phoneNumber,
                    provider,
                    sender: settings.smsSender || null,
                    endpointUrl: settings.smsEndpointUrl || null,
                    message,
                    renderedMessage: message,
                    messageBytes: calculateSmsBytes(message),
                    eventType: "weekly_report",
                    dateKey: toDateKey(nowKst),
                    status: initialStatus.status,
                    providerStatus: initialStatus.providerStatus,
                    attemptCount: 0,
                    manualRetryCount: 0,
                    nextAttemptAt: initialStatus.status === "queued" ? ts : null,
                    sentAt: null,
                    failedAt: null,
                    lastErrorCode: null,
                    lastErrorMessage: null,
                    createdAt: ts,
                    updatedAt: ts,
                });
            });
            await batch.commit();
            await Promise.all(suppressedRecipients.map((recipient) => appendSmsDeliveryLog(db, {
                centerId,
                studentId,
                studentName,
                parentUid: recipient.parentUid,
                parentName: recipient.parentName,
                phoneNumber: recipient.phoneNumber,
                eventType: "weekly_report",
                renderedMessage: message,
                messageBytes: calculateSmsBytes(message),
                provider,
                attemptNo: 0,
                status: "suppressed_opt_out",
                createdAt: ts,
                suppressedReason: recipient.suppressedReason,
            })));
            totalSent += allowedRecipients.length;
        }
    }
    console.log("[weekly-report] run complete", { centerCount: centersSnap.size, totalSent });
    return null;
});
async function syncStudyLogDayTotalMinutes(db, centerId, studentId, dateKey) {
    const sessionsSnap = await db.collection(`centers/${centerId}/studyLogs/${studentId}/days/${dateKey}/sessions`).get();
    const totalMinutes = sessionsSnap.docs.reduce((sum, docSnap) => {
        var _a, _b;
        const raw = Number((_b = (_a = docSnap.data()) === null || _a === void 0 ? void 0 : _a.durationMinutes) !== null && _b !== void 0 ? _b : 0);
        return sum + (Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0);
    }, 0);
    await db.doc(`centers/${centerId}/studyLogs/${studentId}/days/${dateKey}`).set({
        studentId,
        centerId,
        dateKey,
        totalMinutes,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
/**
 * 세션 문서 생성 시 durationMinutes 유효성 검증 및 서버 집계 보정
 * - 0분 이하 또는 360분 초과 세션은 경계값으로 클램프
 * - study-time leaderboard / dailyStudentStats는 세션 생성만 신뢰해 서버에서 누적
 * - closedReason이 있는 자동 종료 세션도 집계 대상에 포함
 */
exports.onSessionCreated = functions
    .region(region)
    .firestore.document("centers/{centerId}/studyLogs/{studentId}/days/{dateKey}/sessions/{sessionId}")
    .onCreate(async (snap, context) => {
    var _a;
    const data = snap.data();
    const { centerId, studentId, dateKey } = context.params;
    const db = admin.firestore();
    const skipValidation = Boolean(data.closedReason);
    const rawDuration = Number((_a = data.durationMinutes) !== null && _a !== void 0 ? _a : 0);
    const MAX_MINUTES = 360;
    let normalizedDuration = Number.isFinite(rawDuration) ? Math.max(0, Math.round(rawDuration)) : 0;
    let validationFlag = null;
    if (!skipValidation) {
        if (!Number.isFinite(rawDuration) || rawDuration < 0) {
            validationFlag = "clamped_negative";
            normalizedDuration = 0;
        }
        else if (rawDuration > MAX_MINUTES) {
            validationFlag = "clamped_max";
            normalizedDuration = MAX_MINUTES;
        }
    }
    await db.runTransaction(async (t) => {
        const statRef = db.doc(`centers/${centerId}/dailyStudentStats/${dateKey}/students/${studentId}`);
        const studentRef = db.doc(`centers/${centerId}/students/${studentId}`);
        const leaderboardRef = db.doc(`centers/${centerId}/leaderboards/${dateKey.slice(0, 7)}_study-time/entries/${studentId}`);
        const [studentSnap, statSnap] = await Promise.all([
            t.get(studentRef),
            t.get(statRef),
        ]);
        if (validationFlag === "clamped_negative") {
            console.warn("[session-validate] invalid durationMinutes", {
                centerId,
                studentId,
                sessionId: snap.id,
                rawDuration,
            });
            t.update(snap.ref, { durationMinutes: 0, validationFlag });
        }
        if (validationFlag === "clamped_max") {
            t.update(snap.ref, { durationMinutes: normalizedDuration, validationFlag });
        }
        if (normalizedDuration <= 0) {
            return;
        }
        const studentData = (studentSnap.data() || {});
        const statData = (statSnap.data() || {});
        const currentLongestSessionMinutes = Math.max(0, Number(statData.longestSessionMinutes || 0));
        t.set(statRef, {
            totalStudyMinutes: admin.firestore.FieldValue.increment(normalizedDuration),
            sessionCount: admin.firestore.FieldValue.increment(1),
            longestSessionMinutes: Math.max(normalizedDuration, currentLongestSessionMinutes),
            studentId,
            centerId,
            dateKey,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        t.set(leaderboardRef, {
            studentId,
            displayNameSnapshot: typeof studentData.name === "string" && studentData.name.trim().length > 0
                ? studentData.name.trim()
                : typeof studentData.displayName === "string" && studentData.displayName.trim().length > 0
                    ? studentData.displayName.trim()
                    : "학생",
            classNameSnapshot: typeof studentData.className === "string" && studentData.className.trim().length > 0
                ? studentData.className.trim()
                : null,
            schoolNameSnapshot: typeof studentData.schoolName === "string" && studentData.schoolName.trim().length > 0
                ? studentData.schoolName.trim()
                : null,
            value: admin.firestore.FieldValue.increment(normalizedDuration),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
    if (validationFlag === "clamped_max") {
        console.log("[session-validate] clamped max", {
            centerId,
            studentId,
            sessionId: snap.id,
            rawDuration,
            clamped: normalizedDuration,
        });
    }
    return null;
});
exports.onSessionWritten = functions
    .region(region)
    .firestore.document("centers/{centerId}/studyLogs/{studentId}/days/{dateKey}/sessions/{sessionId}")
    .onWrite(async (_change, context) => {
    const { centerId, studentId, dateKey } = context.params;
    const db = admin.firestore();
    await syncStudyLogDayTotalMinutes(db, centerId, studentId, dateKey);
    return null;
});
/**
 * 매일 오후 9시(KST) — 최근 14일 집중 시간이 목표 대비 30% 미만인 학생을 위험군으로 분류
 * - riskCache/{dateKey} 에 atRiskStudentIds 저장 (교사 대시보드 배지용)
 * - 센터 관리자에게 위험군 학생 목록 SMS 발송
 */
exports.scheduledDailyRiskAlert = functions
    .region(region)
    .pubsub.schedule("0 21 * * *")
    .timeZone("Asia/Seoul")
    .onRun(async () => {
    var _a;
    const db = admin.firestore();
    const nowKst = toKstDate();
    const todayKey = toDateKey(nowKst);
    const dateKeys = [];
    for (let i = 0; i < 14; i++) {
        const d = new Date(nowKst);
        d.setDate(d.getDate() - i);
        dateKeys.push(toDateKey(d));
    }
    const centersSnap = await db.collection("centers").get();
    let totalAtRisk = 0;
    for (const centerDoc of centersSnap.docs) {
        const centerId = centerDoc.id;
        const membersSnap = await db
            .collection(`centers/${centerId}/members`)
            .where("role", "==", "student")
            .where("status", "==", "active")
            .get();
        const activeStudentIds = membersSnap.docs.map((memberDoc) => memberDoc.id);
        if (activeStudentIds.length === 0) {
            await db.doc(`centers/${centerId}/riskCache/${todayKey}`).set({
                atRiskStudentIds: [],
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                dateKey: todayKey,
            }, { merge: true });
            continue;
        }
        const [studentProfileMap, actualMinutesByStudent] = await Promise.all([
            loadStudentProfileMap(db, centerId, activeStudentIds),
            loadStudyMinutesByStudentForDateKeys(db, centerId, dateKeys),
        ]);
        const atRiskStudentIds = [];
        const atRiskNames = [];
        for (const studentId of activeStudentIds) {
            const studentData = studentProfileMap.get(studentId) || null;
            if (!studentData)
                continue;
            const targetDailyMinutes = Number((_a = studentData === null || studentData === void 0 ? void 0 : studentData.targetDailyMinutes) !== null && _a !== void 0 ? _a : 0);
            if (targetDailyMinutes <= 0)
                continue;
            const target14Days = targetDailyMinutes * 14;
            const actual14Minutes = actualMinutesByStudent.get(studentId) || 0;
            const achieveRate = actual14Minutes / target14Days;
            if (achieveRate < 0.3) {
                atRiskStudentIds.push(studentId);
                const name = typeof studentData.name === "string" ? studentData.name : studentId;
                atRiskNames.push(name);
            }
        }
        // riskCache 저장 (교사 대시보드 배지용)
        await db.doc(`centers/${centerId}/riskCache/${todayKey}`).set({
            atRiskStudentIds,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            dateKey: todayKey,
        }, { merge: true });
        // 위험군이 있으면 관리자에게 SMS
        if (atRiskStudentIds.length > 0) {
            const settings = await loadNotificationSettings(db, centerId);
            if (settings.smsEnabled !== false && settings.smsProvider && settings.smsProvider !== "none") {
                const adminSnap = await db
                    .collection(`centers/${centerId}/members`)
                    .where("role", "in", ["centerAdmin", "owner"])
                    .limit(5)
                    .get();
                const message = `[위험군 알림] ${atRiskNames.slice(0, 5).join(", ")}${atRiskStudentIds.length > 5 ? ` 외 ${atRiskStudentIds.length - 5}명` : ""}의 14일 집중시간이 목표 대비 30% 미만입니다.`;
                const ts = admin.firestore.Timestamp.now();
                const batch = db.batch();
                for (const adminDoc of adminSnap.docs) {
                    const adminData = adminDoc.data();
                    const phone = normalizePhoneNumber(adminData === null || adminData === void 0 ? void 0 : adminData.phoneNumber);
                    if (!phone)
                        continue;
                    const queueRef = db.collection(`centers/${centerId}/smsQueue`).doc();
                    batch.set(queueRef, {
                        centerId,
                        studentId: null,
                        studentName: null,
                        parentUid: adminDoc.id,
                        parentName: asTrimmedString((adminData === null || adminData === void 0 ? void 0 : adminData.displayName) || (adminData === null || adminData === void 0 ? void 0 : adminData.name) || "관리자"),
                        phoneNumber: phone,
                        to: phone,
                        provider: settings.smsProvider,
                        sender: settings.smsSender || null,
                        endpointUrl: settings.smsEndpointUrl || null,
                        message,
                        renderedMessage: message,
                        messageBytes: calculateSmsBytes(message),
                        eventType: "risk_alert",
                        status: "queued",
                        providerStatus: "queued",
                        attemptCount: 0,
                        manualRetryCount: 0,
                        nextAttemptAt: ts,
                        createdAt: ts,
                        updatedAt: ts,
                    });
                }
                await batch.commit();
            }
            totalAtRisk += atRiskStudentIds.length;
        }
    }
    console.log("[daily-risk-alert] run complete", { centerCount: centersSnap.size, totalAtRisk });
    return null;
});
/**
 * 5분마다 교실 관제 신호 캐시를 갱신합니다.
 */
exports.scheduledClassroomSignalsRefresh = functions
    .region(region)
    .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
})
    .pubsub.schedule("every 5 minutes")
    .timeZone("Asia/Seoul")
    .onRun(async () => {
    const db = admin.firestore();
    const nowKst = toKstDate();
    const centersSnap = await db.collection("centers").get();
    let refreshed = 0;
    for (const centerDoc of centersSnap.docs) {
        try {
            await refreshClassroomSignalsForCenter(db, centerDoc.id, nowKst);
            refreshed += 1;
        }
        catch (error) {
            console.error("[classroom-signals] scheduled refresh failed", {
                centerId: centerDoc.id,
                error,
            });
        }
    }
    console.log("[classroom-signals] scheduled refresh complete", {
        centerCount: centersSnap.size,
        refreshed,
        dateKey: toDateKey(nowKst),
    });
    return null;
});
/**
 * 교사/센터관리자가 특정 센터의 교실 관제 신호를 수동 갱신합니다.
 */
exports.createPointBoostEventSecure = functions.region(region).https.onCall(async (data, context) => {
    var _a, _b, _c;
    const db = admin.firestore();
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    const mode = normalizePointBoostMode(data === null || data === void 0 ? void 0 : data.mode);
    const startAtMs = Math.round((_b = parseFiniteNumber(data === null || data === void 0 ? void 0 : data.startAtMs)) !== null && _b !== void 0 ? _b : Number.NaN);
    const endAtMs = Math.round((_c = parseFiniteNumber(data === null || data === void 0 ? void 0 : data.endAtMs)) !== null && _c !== void 0 ? _c : Number.NaN);
    const multiplier = normalizePointBoostMultiplier(data === null || data === void 0 ? void 0 : data.multiplier);
    if (!centerId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId is required.", {
            userMessage: "센터 정보를 다시 확인해 주세요.",
        });
    }
    if (!mode) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid boost mode.", {
            userMessage: "부스트 유형을 다시 선택해 주세요.",
        });
    }
    if (!Number.isFinite(startAtMs) || !Number.isFinite(endAtMs) || startAtMs <= 0 || endAtMs <= 0 || endAtMs <= startAtMs) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid boost time range.", {
            userMessage: "부스트 시작/종료 시간을 다시 확인해 주세요.",
        });
    }
    if (multiplier === null) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid boost multiplier.", {
            userMessage: "배율은 1보다 큰 숫자로 입력해 주세요.",
        });
    }
    if (endAtMs <= Date.now()) {
        throw new functions.https.HttpsError("failed-precondition", "Cannot create a boost event in the past.", {
            userMessage: "이미 지난 시간에는 부스트를 만들 수 없습니다.",
        });
    }
    const membership = await resolveCenterMembershipRole(db, centerId, context.auth.uid);
    if (!membership.role || !isAdminRole(membership.role) || !isActiveMembershipStatus(membership.status)) {
        throw new functions.https.HttpsError("permission-denied", "Only center admins can manage point boost events.", {
            userMessage: "센터 관리자만 포인트 부스트를 관리할 수 있습니다.",
        });
    }
    const existingEvents = await listPointBoostEventDocs(db, centerId);
    const overlappingEvent = existingEvents.find((docSnap) => {
        const event = docSnap.data();
        if (isPointBoostEventCancelled(event))
            return false;
        return doTimeRangesOverlap(startAtMs, endAtMs, toMillisSafe(event.startAt), toMillisSafe(event.endAt));
    });
    if (overlappingEvent) {
        throw new functions.https.HttpsError("already-exists", "Overlapping boost event exists.", {
            userMessage: "겹치는 시간에 이미 포인트 부스트가 있습니다.",
        });
    }
    const eventRef = db.collection(`centers/${centerId}/pointBoostEvents`).doc();
    await eventRef.set({
        centerId,
        mode,
        startAt: admin.firestore.Timestamp.fromMillis(startAtMs),
        endAt: admin.firestore.Timestamp.fromMillis(endAtMs),
        multiplier,
        createdBy: context.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return {
        ok: true,
        eventId: eventRef.id,
    };
});
exports.cancelPointBoostEventSecure = functions.region(region).https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    const eventId = asTrimmedString(data === null || data === void 0 ? void 0 : data.eventId);
    if (!centerId || !eventId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId and eventId are required.", {
            userMessage: "취소할 부스트 이벤트를 다시 선택해 주세요.",
        });
    }
    const membership = await resolveCenterMembershipRole(db, centerId, context.auth.uid);
    if (!membership.role || !isAdminRole(membership.role) || !isActiveMembershipStatus(membership.status)) {
        throw new functions.https.HttpsError("permission-denied", "Only center admins can manage point boost events.", {
            userMessage: "센터 관리자만 포인트 부스트를 관리할 수 있습니다.",
        });
    }
    const eventRef = db.doc(`centers/${centerId}/pointBoostEvents/${eventId}`);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Point boost event not found.", {
            userMessage: "포인트 부스트 이벤트를 찾지 못했습니다.",
        });
    }
    const eventData = eventSnap.data();
    if (isPointBoostEventCancelled(eventData)) {
        throw new functions.https.HttpsError("failed-precondition", "Boost event is already cancelled.", {
            userMessage: "이미 취소된 부스트 이벤트입니다.",
        });
    }
    if (toMillisSafe(eventData.endAt) <= Date.now()) {
        throw new functions.https.HttpsError("failed-precondition", "Completed boost event cannot be cancelled.", {
            userMessage: "이미 종료된 부스트 이벤트는 취소할 수 없습니다.",
        });
    }
    await eventRef.set({
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        cancelledBy: context.auth.uid,
    }, { merge: true });
    return {
        ok: true,
        eventId,
    };
});
exports.applyPenaltyEventSecure = functions.region(region).https.onCall(async (data, context) => {
    var _a, _b;
    const db = admin.firestore();
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const authUid = context.auth.uid;
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    const studentId = asTrimmedString(data === null || data === void 0 ? void 0 : data.studentId);
    const source = asTrimmedString(data === null || data === void 0 ? void 0 : data.source);
    const penaltyDateKey = asTrimmedString(data === null || data === void 0 ? void 0 : data.penaltyDateKey);
    const reasonInput = asTrimmedString(data === null || data === void 0 ? void 0 : data.reason);
    if (!centerId || !studentId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId/studentId is required.", {
            userMessage: "학생 벌점을 반영할 정보를 다시 확인해 주세요.",
        });
    }
    if (source !== "manual" && source !== "routine_missing") {
        throw new functions.https.HttpsError("invalid-argument", "Unsupported penalty source.", {
            userMessage: "벌점 반영 유형이 올바르지 않습니다.",
        });
    }
    if (!isValidDateKey(penaltyDateKey)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid penaltyDateKey.", {
            userMessage: "벌점 일자 정보가 올바르지 않습니다.",
        });
    }
    if (reasonInput.length < 2) {
        throw new functions.https.HttpsError("invalid-argument", "Reason is too short.", {
            userMessage: "벌점 사유를 다시 확인해 주세요.",
        });
    }
    const expectedPenaltyKey = source === "manual" ? `same_day_routine:${penaltyDateKey}` : `routine_missing:${penaltyDateKey}`;
    const penaltyKey = asTrimmedString(data === null || data === void 0 ? void 0 : data.penaltyKey, expectedPenaltyKey);
    if (penaltyKey !== expectedPenaltyKey) {
        throw new functions.https.HttpsError("invalid-argument", "Unexpected penaltyKey.", {
            userMessage: "벌점 키가 올바르지 않습니다.",
        });
    }
    const expectedPointsDelta = SECURE_PENALTY_SOURCE_POINTS[source];
    const requestedPointsDelta = Math.round((_b = parseFiniteNumber(data === null || data === void 0 ? void 0 : data.pointsDelta)) !== null && _b !== void 0 ? _b : Number.NaN);
    if (!Number.isFinite(requestedPointsDelta) || requestedPointsDelta !== expectedPointsDelta) {
        throw new functions.https.HttpsError("invalid-argument", "Unexpected pointsDelta.", {
            userMessage: "벌점 점수 정보가 올바르지 않습니다.",
        });
    }
    const membership = await resolveCenterMembershipRole(db, centerId, authUid);
    if (!membership.role || !isActiveMembershipStatus(membership.status)) {
        throw new functions.https.HttpsError("permission-denied", "Inactive membership.", {
            userMessage: "현재 계정 상태로는 벌점을 반영할 수 없습니다.",
        });
    }
    if (membership.role === "parent") {
        throw new functions.https.HttpsError("permission-denied", "Parent cannot apply penalties.", {
            userMessage: "학부모 계정에서는 벌점을 반영할 수 없습니다.",
        });
    }
    if (membership.role === "student" && studentId !== authUid) {
        throw new functions.https.HttpsError("permission-denied", "Students can only apply self penalties.", {
            userMessage: "본인에게만 벌점을 반영할 수 있습니다.",
        });
    }
    if (membership.role !== "student" && membership.role !== "teacher" && !isAdminRole(membership.role)) {
        throw new functions.https.HttpsError("permission-denied", "Unsupported membership role.", {
            userMessage: "현재 계정 권한으로는 벌점을 반영할 수 없습니다.",
        });
    }
    const [targetMemberSnap, targetStudentSnap, callerMemberSnap] = await Promise.all([
        db.doc(`centers/${centerId}/members/${studentId}`).get(),
        db.doc(`centers/${centerId}/students/${studentId}`).get(),
        db.doc(`centers/${centerId}/members/${authUid}`).get(),
    ]);
    const targetMemberData = targetMemberSnap.exists ? targetMemberSnap.data() : null;
    const targetStudentData = targetStudentSnap.exists ? targetStudentSnap.data() : null;
    const targetRole = normalizeMembershipRoleValue(targetMemberData === null || targetMemberData === void 0 ? void 0 : targetMemberData.role);
    if (targetRole && targetRole !== "student") {
        throw new functions.https.HttpsError("failed-precondition", "Target membership is not a student.", {
            userMessage: "학생 계정에만 벌점을 반영할 수 있습니다.",
        });
    }
    if (!targetMemberSnap.exists && !targetStudentSnap.exists) {
        throw new functions.https.HttpsError("failed-precondition", "Target student not found.", {
            userMessage: "학생 정보를 찾지 못했습니다.",
        });
    }
    const studentName = asTrimmedString((targetMemberData === null || targetMemberData === void 0 ? void 0 : targetMemberData.displayName) || (targetMemberData === null || targetMemberData === void 0 ? void 0 : targetMemberData.name) || (targetStudentData === null || targetStudentData === void 0 ? void 0 : targetStudentData.displayName) || (targetStudentData === null || targetStudentData === void 0 ? void 0 : targetStudentData.name), "학생");
    const callerMemberData = callerMemberSnap.exists ? callerMemberSnap.data() : null;
    const callerFallbackName = membership.role === "student" ? "학생" : membership.role === "teacher" ? "선생님" : "운영자";
    const createdByName = asTrimmedString((callerMemberData === null || callerMemberData === void 0 ? void 0 : callerMemberData.displayName) || (callerMemberData === null || callerMemberData === void 0 ? void 0 : callerMemberData.name) || context.auth.token.name, callerFallbackName);
    const existingLegacy = await findExistingPenaltyEventLog({
        db,
        centerId,
        studentId,
        source,
        penaltyKey,
        penaltyDateKey,
    });
    if (existingLegacy) {
        return {
            applied: false,
            duplicate: true,
            penaltyLogId: existingLegacy.id,
            penaltyPointsDelta: expectedPointsDelta,
        };
    }
    const penaltyLogId = buildPenaltyEventLogId(studentId, source, penaltyKey);
    const penaltyLogRef = db.doc(`centers/${centerId}/penaltyLogs/${penaltyLogId}`);
    const progressRef = db.doc(`centers/${centerId}/growthProgress/${studentId}`);
    const applied = await db.runTransaction(async (transaction) => {
        const existingPenaltyLogSnap = await transaction.get(penaltyLogRef);
        if (existingPenaltyLogSnap.exists) {
            return false;
        }
        transaction.set(progressRef, {
            penaltyPoints: admin.firestore.FieldValue.increment(expectedPointsDelta),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(penaltyLogRef, {
            centerId,
            studentId,
            studentName,
            pointsDelta: expectedPointsDelta,
            reason: reasonInput,
            source,
            penaltyKey,
            penaltyDateKey,
            createdByUserId: authUid,
            createdByName,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return true;
    });
    return {
        applied,
        duplicate: !applied,
        penaltyLogId,
        penaltyPointsDelta: expectedPointsDelta,
    };
});
exports.submitAttendanceRequestSecure = functions.region(region).https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const authUid = context.auth.uid;
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    const requestType = asTrimmedString(data === null || data === void 0 ? void 0 : data.requestType);
    const requestDate = asTrimmedString(data === null || data === void 0 ? void 0 : data.requestDate);
    const reason = asTrimmedString(data === null || data === void 0 ? void 0 : data.reason);
    if (!centerId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId is required.", {
            userMessage: "센터 정보가 누락되었습니다.",
        });
    }
    if (requestType !== "late" && requestType !== "absence") {
        throw new functions.https.HttpsError("invalid-argument", "requestType is invalid.", {
            userMessage: "출결 신청 유형이 올바르지 않습니다.",
        });
    }
    if (!requestDate) {
        throw new functions.https.HttpsError("invalid-argument", "requestDate is required.", {
            userMessage: "요청 날짜를 선택해 주세요.",
        });
    }
    if (reason.length < 10) {
        throw new functions.https.HttpsError("invalid-argument", "Reason is too short.", {
            userMessage: "사유는 10자 이상 입력해 주세요.",
        });
    }
    const membership = await resolveCenterMembershipRole(db, centerId, authUid);
    if (membership.role !== "student" || !isActiveMembershipStatus(membership.status)) {
        throw new functions.https.HttpsError("permission-denied", "Only active students can submit attendance requests.", {
            userMessage: "학생 본인만 출결 신청을 접수할 수 있습니다.",
        });
    }
    const [studentMemberSnap, studentProfileSnap] = await Promise.all([
        db.doc(`centers/${centerId}/members/${authUid}`).get(),
        db.doc(`centers/${centerId}/students/${authUid}`).get(),
    ]);
    if (!studentMemberSnap.exists && !studentProfileSnap.exists) {
        throw new functions.https.HttpsError("failed-precondition", "Student profile not found.", {
            userMessage: "학생 정보를 찾지 못했습니다.",
        });
    }
    const studentMemberData = studentMemberSnap.exists ? studentMemberSnap.data() : null;
    const studentProfileData = studentProfileSnap.exists ? studentProfileSnap.data() : null;
    const studentName = asTrimmedString((studentMemberData === null || studentMemberData === void 0 ? void 0 : studentMemberData.displayName) || (studentMemberData === null || studentMemberData === void 0 ? void 0 : studentMemberData.name) || (studentProfileData === null || studentProfileData === void 0 ? void 0 : studentProfileData.displayName) || (studentProfileData === null || studentProfileData === void 0 ? void 0 : studentProfileData.name) || context.auth.token.name, "학생");
    const penaltyPointsDelta = ATTENDANCE_REQUEST_PENALTY_POINTS[requestType];
    const requestRef = db.collection(`centers/${centerId}/attendanceRequests`).doc();
    const penaltyLogRef = db.doc(`centers/${centerId}/penaltyLogs/attendance_request_${requestRef.id}`);
    const progressRef = db.doc(`centers/${centerId}/growthProgress/${authUid}`);
    await db.runTransaction(async (transaction) => {
        transaction.set(requestRef, {
            studentId: authUid,
            studentName,
            centerId,
            type: requestType,
            date: requestDate,
            reason,
            status: "requested",
            penaltyApplied: true,
            penaltyPointsDelta,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.set(progressRef, {
            penaltyPoints: admin.firestore.FieldValue.increment(penaltyPointsDelta),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(penaltyLogRef, {
            centerId,
            studentId: authUid,
            studentName,
            pointsDelta: penaltyPointsDelta,
            reason: `${requestType === "absence" ? "결석" : "지각"} 신청 - ${reason}`,
            source: "attendance_request",
            requestId: requestRef.id,
            requestType,
            createdByUserId: authUid,
            createdByName: studentName,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
    return {
        ok: true,
        requestId: requestRef.id,
        penaltyLogId: penaltyLogRef.id,
        penaltyPointsDelta,
    };
});
exports.openStudyRewardBoxSecure = functions.region(region).https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e, _f;
    const db = admin.firestore();
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const authUid = context.auth.uid;
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    const dateKey = asTrimmedString(data === null || data === void 0 ? void 0 : data.dateKey);
    const hour = Math.round((_b = parseFiniteNumber(data === null || data === void 0 ? void 0 : data.hour)) !== null && _b !== void 0 ? _b : Number.NaN);
    if (!centerId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId is required.", {
            userMessage: "센터 정보를 다시 확인해 주세요.",
        });
    }
    if (!isValidDateKey(dateKey)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid dateKey.", {
            userMessage: "상자 날짜 정보가 올바르지 않습니다.",
        });
    }
    if (!Number.isFinite(hour) || hour < 1 || hour > 8) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid hour.", {
            userMessage: "열 상자 정보를 다시 확인해 주세요.",
        });
    }
    const membership = await resolveCenterMembershipRole(db, centerId, authUid);
    if (membership.role !== "student" || !isActiveMembershipStatus(membership.status)) {
        throw new functions.https.HttpsError("permission-denied", "Only active students can open study boxes.", {
            userMessage: "학생 본인만 보상 상자를 열 수 있습니다.",
        });
    }
    const studyDayRef = db.doc(`centers/${centerId}/studyLogs/${authUid}/days/${dateKey}`);
    const progressRef = db.doc(`centers/${centerId}/growthProgress/${authUid}`);
    const [studentMemberSnap, studentProfileSnap, studyDaySnap, attendanceSnap, progressSnap, sessionsSnap] = await Promise.all([
        db.doc(`centers/${centerId}/members/${authUid}`).get(),
        db.doc(`centers/${centerId}/students/${authUid}`).get(),
        studyDayRef.get(),
        db.collection(`centers/${centerId}/attendanceCurrent`).where("studentId", "==", authUid).limit(10).get(),
        progressRef.get(),
        studyDayRef.collection("sessions").orderBy("startTime", "asc").get(),
    ]);
    if (!studentMemberSnap.exists && !studentProfileSnap.exists) {
        throw new functions.https.HttpsError("failed-precondition", "Student profile not found.", {
            userMessage: "학생 정보를 찾지 못했습니다.",
        });
    }
    const persistedDayMinutes = Math.max(0, Math.floor((_d = parseFiniteNumber((_c = studyDaySnap.data()) === null || _c === void 0 ? void 0 : _c.totalMinutes)) !== null && _d !== void 0 ? _d : 0));
    const todayKstKey = toDateKey(toKstDate());
    const nowMs = Date.now();
    const dayStartMs = Date.parse(`${dateKey}T00:00:00+09:00`);
    let liveSessionMinutes = 0;
    let liveSessionStartMs = 0;
    if (dateKey === todayKstKey && !attendanceSnap.empty) {
        const preferredAttendanceDoc = pickPreferredAttendanceSeatDoc(attendanceSnap.docs);
        const attendanceData = preferredAttendanceDoc === null || preferredAttendanceDoc === void 0 ? void 0 : preferredAttendanceDoc.data();
        const attendanceStatus = asTrimmedString(attendanceData === null || attendanceData === void 0 ? void 0 : attendanceData.status);
        const liveStartedAtMs = toMillisSafe(attendanceData === null || attendanceData === void 0 ? void 0 : attendanceData.lastCheckInAt);
        if (ACTIVE_STUDY_ATTENDANCE_STATUSES.has(attendanceStatus) &&
            liveStartedAtMs > 0 &&
            Number.isFinite(dayStartMs) &&
            nowMs > liveStartedAtMs) {
            const effectiveStartMs = Math.max(liveStartedAtMs, dayStartMs);
            liveSessionStartMs = effectiveStartMs;
            liveSessionMinutes = Math.max(0, Math.floor((nowMs - effectiveStartMs) / 60000));
        }
    }
    const effectiveDayMinutes = Math.max(persistedDayMinutes, persistedDayMinutes + liveSessionMinutes);
    const earnedHours = Math.min(8, Math.floor(effectiveDayMinutes / 60));
    const preExistingProgress = progressSnap.exists ? progressSnap.data() : {};
    const preExistingDailyPointStatus = isPlainObject(preExistingProgress.dailyPointStatus)
        ? preExistingProgress.dailyPointStatus
        : {};
    const preExistingDayStatus = isPlainObject(preExistingDailyPointStatus[dateKey])
        ? preExistingDailyPointStatus[dateKey]
        : {};
    const preExistingClaimedStudyBoxes = normalizeStudyBoxHoursFromUnknown(preExistingDayStatus.claimedStudyBoxes);
    const preExistingOpenedStudyBoxes = resolveOpenedStudyBoxHoursFromDayStatus(preExistingDayStatus);
    const hasUnlockedBoxRecord = preExistingClaimedStudyBoxes.includes(hour) || preExistingOpenedStudyBoxes.includes(hour);
    if (!hasUnlockedBoxRecord && earnedHours < hour) {
        throw new functions.https.HttpsError("failed-precondition", "Study time milestone not reached.", {
            userMessage: "아직 이 상자를 열 수 있는 공부시간이 채워지지 않았습니다.",
        });
    }
    const baseReward = buildDeterministicStudyBoxReward({
        centerId,
        studentId: authUid,
        dateKey,
        milestone: hour,
    });
    const earnedAtMs = resolveStudyBoxMilestoneEarnedAtMs({
        milestone: hour,
        persistedDayMinutes,
        sessionDocs: sessionsSnap.docs,
        liveSessionStartMs,
        liveSessionMinutes,
    });
    let boostMultiplier = 1;
    let boostEventId = null;
    if (earnedAtMs) {
        const pointBoostDocs = await listPointBoostEventDocs(db, centerId);
        const matchedBoostDoc = (_e = pointBoostDocs.find((docSnap) => isPointBoostEventActiveAt(docSnap.data(), earnedAtMs))) !== null && _e !== void 0 ? _e : null;
        const matchedBoostEvent = matchedBoostDoc === null || matchedBoostDoc === void 0 ? void 0 : matchedBoostDoc.data();
        if (matchedBoostEvent) {
            boostMultiplier = matchedBoostEvent.multiplier;
            boostEventId = (_f = matchedBoostDoc === null || matchedBoostDoc === void 0 ? void 0 : matchedBoostDoc.id) !== null && _f !== void 0 ? _f : null;
        }
    }
    const reward = Object.assign(Object.assign({}, baseReward), { awardedPoints: Math.max(0, Math.round(baseReward.basePoints * boostMultiplier)), multiplier: boostMultiplier, earnedAt: earnedAtMs ? new Date(earnedAtMs).toISOString() : null, boostEventId });
    const result = await db.runTransaction(async (transaction) => {
        var _a, _b, _c;
        const progressSnap = await transaction.get(progressRef);
        const progressData = progressSnap.exists ? progressSnap.data() : {};
        const dailyPointStatus = isPlainObject(progressData.dailyPointStatus)
            ? progressData.dailyPointStatus
            : {};
        const currentDayStatus = isPlainObject(dailyPointStatus[dateKey])
            ? dailyPointStatus[dateKey]
            : {};
        const openedStudyBoxes = resolveOpenedStudyBoxHoursFromDayStatus(currentDayStatus);
        const claimedStudyBoxes = normalizeStudyBoxHoursFromUnknown(currentDayStatus.claimedStudyBoxes);
        const storedRewardEntries = normalizeStudyBoxRewardEntries(currentDayStatus.studyBoxRewards);
        const storedReward = (_a = storedRewardEntries.find((entry) => entry.milestone === hour)) !== null && _a !== void 0 ? _a : null;
        const alreadyOpened = openedStudyBoxes.includes(hour);
        const awardClamp = alreadyOpened
            ? { currentAwardedTotal: getDailyAwardedPointTotal(currentDayStatus), remainingPoints: 0, awardedPoints: 0 }
            : clampDailyPointAward(currentDayStatus, reward.awardedPoints);
        const awardedDelta = alreadyOpened ? 0 : awardClamp.awardedPoints;
        const creditedReward = alreadyOpened
            ? (storedReward !== null && storedReward !== void 0 ? storedReward : reward)
            : Object.assign(Object.assign({}, reward), { awardedPoints: awardedDelta });
        const nextOpenedStudyBoxes = normalizeStudyBoxHoursFromUnknown([...openedStudyBoxes, hour]);
        const nextClaimedStudyBoxes = normalizeStudyBoxHoursFromUnknown([...claimedStudyBoxes, hour]);
        const nextRewardEntries = upsertStudyBoxRewardEntries(storedRewardEntries, creditedReward);
        const currentPointsBalance = Math.max(0, Math.floor((_b = parseFiniteNumber(progressData.pointsBalance)) !== null && _b !== void 0 ? _b : 0));
        const currentTotalPointsEarned = Math.max(0, Math.floor((_c = parseFiniteNumber(progressData.totalPointsEarned)) !== null && _c !== void 0 ? _c : 0));
        transaction.set(progressRef, {
            pointsBalance: admin.firestore.FieldValue.increment(awardedDelta),
            totalPointsEarned: admin.firestore.FieldValue.increment(awardedDelta),
            dailyPointStatus: {
                [dateKey]: Object.assign(Object.assign({}, currentDayStatus), { claimedStudyBoxes: nextClaimedStudyBoxes, studyBoxRewards: nextRewardEntries, openedStudyBoxes: nextOpenedStudyBoxes, dailyPointAmount: admin.firestore.FieldValue.increment(awardedDelta), updatedAt: admin.firestore.FieldValue.serverTimestamp() }),
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return {
            alreadyOpened,
            claimedStudyBoxes: nextClaimedStudyBoxes,
            openedStudyBoxes: nextOpenedStudyBoxes,
            reward: creditedReward,
            pointsBalance: currentPointsBalance + awardedDelta,
            totalPointsEarned: currentTotalPointsEarned + awardedDelta,
        };
    });
    return {
        ok: true,
        opened: !result.alreadyOpened,
        alreadyOpened: result.alreadyOpened,
        reward: result.reward,
        claimedStudyBoxes: result.claimedStudyBoxes,
        openedStudyBoxes: result.openedStudyBoxes,
        pointsBalance: result.pointsBalance,
        totalPointsEarned: result.totalPointsEarned,
    };
});
exports.stopStudentStudySessionSecure = functions.region(region).https.onCall(async (data, context) => {
    var _a, _b;
    const db = admin.firestore();
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const authUid = context.auth.uid;
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    const fallbackStartTimeMs = Math.floor((_b = parseFiniteNumber(data === null || data === void 0 ? void 0 : data.fallbackStartTimeMs)) !== null && _b !== void 0 ? _b : 0);
    if (!centerId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId is required.", {
            userMessage: "센터 정보를 다시 확인해 주세요.",
        });
    }
    const membership = await resolveCenterMembershipRole(db, centerId, authUid);
    if (membership.role !== "student" || !isActiveMembershipStatus(membership.status)) {
        throw new functions.https.HttpsError("permission-denied", "Only active students can stop sessions.", {
            userMessage: "학생 본인만 공부 종료를 기록할 수 있습니다.",
        });
    }
    const [studentMemberSnap, studentProfileSnap, attendanceSnap] = await Promise.all([
        db.doc(`centers/${centerId}/members/${authUid}`).get(),
        db.doc(`centers/${centerId}/students/${authUid}`).get(),
        db.collection(`centers/${centerId}/attendanceCurrent`).where("studentId", "==", authUid).limit(10).get(),
    ]);
    if (!studentMemberSnap.exists && !studentProfileSnap.exists) {
        throw new functions.https.HttpsError("failed-precondition", "Student profile not found.", {
            userMessage: "학생 정보를 찾지 못했습니다.",
        });
    }
    const preferredSeatDoc = pickPreferredAttendanceSeatDoc(attendanceSnap.docs);
    const seatData = preferredSeatDoc === null || preferredSeatDoc === void 0 ? void 0 : preferredSeatDoc.data();
    const seatStatus = asTrimmedString(seatData === null || seatData === void 0 ? void 0 : seatData.status);
    const seatStartTimeMs = toMillisSafe(seatData === null || seatData === void 0 ? void 0 : seatData.lastCheckInAt);
    const nowMs = Date.now();
    const hasActiveSeatSession = ACTIVE_STUDY_ATTENDANCE_STATUSES.has(seatStatus) && seatStartTimeMs > 0;
    let resolvedStartTimeMs = hasActiveSeatSession ? seatStartTimeMs : fallbackStartTimeMs;
    if (!Number.isFinite(resolvedStartTimeMs) || resolvedStartTimeMs <= 0) {
        throw new functions.https.HttpsError("failed-precondition", "Active session not found.", {
            userMessage: "종료할 공부 세션을 찾지 못했습니다. 잠시 후 다시 시도해 주세요.",
        });
    }
    if (resolvedStartTimeMs > nowMs) {
        resolvedStartTimeMs = nowMs;
    }
    const MAX_MINUTES = 360;
    const sessionSeconds = Math.max(0, Math.floor((nowMs - resolvedStartTimeMs) / 1000));
    const sessionMinutes = sessionSeconds > 0 ? Math.min(MAX_MINUTES, Math.max(1, Math.ceil(sessionSeconds / 60))) : 0;
    const startAt = admin.firestore.Timestamp.fromMillis(resolvedStartTimeMs);
    const endAt = admin.firestore.Timestamp.fromMillis(nowMs);
    const sessionDateKey = toDateKey(toKstDate(new Date(resolvedStartTimeMs)));
    const sessionId = `session_${resolvedStartTimeMs}`;
    const dayRef = db.doc(`centers/${centerId}/studyLogs/${authUid}/days/${sessionDateKey}`);
    const sessionRef = dayRef.collection("sessions").doc(sessionId);
    const progressRef = db.doc(`centers/${centerId}/growthProgress/${authUid}`);
    const result = await db.runTransaction(async (transaction) => {
        var _a;
        const [daySnap, sessionSnap, progressSnap] = await Promise.all([
            transaction.get(dayRef),
            transaction.get(sessionRef),
            transaction.get(progressRef),
        ]);
        const dayData = daySnap.exists ? daySnap.data() : {};
        const progressData = progressSnap.exists ? progressSnap.data() : {};
        const existingTotalMinutes = Math.max(0, Math.floor((_a = parseFiniteNumber(dayData.totalMinutes)) !== null && _a !== void 0 ? _a : 0));
        const duplicatedSession = sessionSnap.exists;
        const previousFirstSessionAt = toTimestampOrNow(dayData.firstSessionStartAt);
        const previousLastSessionAt = toTimestampOrNow(dayData.lastSessionEndAt);
        const awayGapMinutes = previousLastSessionAt
            ? Math.round((resolvedStartTimeMs - previousLastSessionAt.toMillis()) / 60000)
            : 0;
        const normalizedAwayGapMinutes = awayGapMinutes > 0 && awayGapMinutes < 180 ? awayGapMinutes : 0;
        const nextFirstSessionAt = previousFirstSessionAt && previousFirstSessionAt.toMillis() <= resolvedStartTimeMs
            ? previousFirstSessionAt
            : startAt;
        const nextLastSessionAt = previousLastSessionAt && previousLastSessionAt.toMillis() >= nowMs
            ? previousLastSessionAt
            : endAt;
        let totalMinutesAfterSession = existingTotalMinutes;
        let attendanceAchieved = false;
        let bonus6hAchieved = false;
        if (!duplicatedSession && sessionMinutes > 0) {
            totalMinutesAfterSession = existingTotalMinutes + sessionMinutes;
            const dailyPointStatus = isPlainObject(progressData.dailyPointStatus)
                ? progressData.dailyPointStatus
                : {};
            const currentDayStatus = isPlainObject(dailyPointStatus[sessionDateKey])
                ? Object.assign({}, dailyPointStatus[sessionDateKey]) : {};
            if (totalMinutesAfterSession >= 180 && currentDayStatus.attendance !== true) {
                currentDayStatus.attendance = true;
                attendanceAchieved = true;
            }
            if (totalMinutesAfterSession >= 360 && currentDayStatus.bonus6h !== true) {
                currentDayStatus.bonus6h = true;
                bonus6hAchieved = true;
            }
            transaction.set(dayRef, Object.assign(Object.assign({ studentId: authUid, centerId, dateKey: sessionDateKey, totalMinutes: totalMinutesAfterSession, firstSessionStartAt: nextFirstSessionAt, lastSessionEndAt: nextLastSessionAt }, (normalizedAwayGapMinutes > 0 ? { awayMinutes: admin.firestore.FieldValue.increment(normalizedAwayGapMinutes) } : {})), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }), { merge: true });
            transaction.set(sessionRef, {
                centerId,
                studentId: authUid,
                dateKey: sessionDateKey,
                startTime: startAt,
                endTime: endAt,
                durationMinutes: sessionMinutes,
                sessionId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            if (attendanceAchieved || bonus6hAchieved) {
                transaction.set(progressRef, {
                    dailyPointStatus: {
                        [sessionDateKey]: Object.assign(Object.assign({}, currentDayStatus), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }),
                    },
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
        }
        if ((preferredSeatDoc === null || preferredSeatDoc === void 0 ? void 0 : preferredSeatDoc.ref) && hasActiveSeatSession) {
            transaction.set(preferredSeatDoc.ref, {
                status: "absent",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        return {
            duplicatedSession,
            totalMinutesAfterSession,
            attendanceAchieved,
            bonus6hAchieved,
        };
    });
    return {
        ok: true,
        duplicatedSession: result.duplicatedSession,
        sessionId,
        sessionDateKey,
        sessionMinutes,
        totalMinutesAfterSession: result.totalMinutesAfterSession,
        attendanceAchieved: result.attendanceAchieved,
        bonus6hAchieved: result.bonus6hAchieved,
    };
});
exports.refreshClassroomSignals = functions
    .region(region)
    .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
})
    .https.onCall(async (data, context) => {
    const db = admin.firestore();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = typeof (data === null || data === void 0 ? void 0 : data.centerId) === "string" ? data.centerId.trim() : "";
    if (!centerId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId is required.");
    }
    const membership = await resolveCenterMembershipRole(db, centerId, context.auth.uid);
    if (!membership.role || (membership.role !== "teacher" && !isAdminRole(membership.role))) {
        throw new functions.https.HttpsError("permission-denied", "Only teacher/admin can refresh classroom signals.");
    }
    if (!isActiveMembershipStatus(membership.status)) {
        throw new functions.https.HttpsError("permission-denied", "Inactive membership.");
    }
    const nowKst = toKstDate();
    const payload = await refreshClassroomSignalsForCenter(db, centerId, nowKst);
    return {
        ok: true,
        centerId,
        dateKey: payload.dateKey,
        updatedAt: payload.updatedAt,
        summary: payload.summary,
        classSummaryCount: payload.classSummaries.length,
        incidentCount: payload.incidents.length,
    };
});
exports.generateOpenClawSnapshot = functions
    .region(region)
    .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
})
    .https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = typeof (data === null || data === void 0 ? void 0 : data.centerId) === "string" ? data.centerId.trim() : "";
    if (!centerId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId is required.");
    }
    const membership = await resolveCenterMembershipRole(db, centerId, context.auth.uid);
    if (!membership.role || !isAdminRole(membership.role)) {
        throw new functions.https.HttpsError("permission-denied", "Only center admins can export OpenClaw snapshots.");
    }
    if (!isActiveMembershipStatus(membership.status)) {
        throw new functions.https.HttpsError("permission-denied", "Inactive membership.");
    }
    try {
        const result = await (0, openclawSnapshot_1.executeOpenClawSnapshotExport)({
            db,
            centerId,
            requestedBy: context.auth.uid,
            enableOnRequest: true,
        });
        return Object.assign({ ok: true, centerId }, result);
    }
    catch (error) {
        if (error instanceof openclawSnapshot_1.OpenClawExportInProgressError) {
            throw new functions.https.HttpsError("failed-precondition", "OpenClaw snapshot export already running.", {
                userMessage: "이미 OpenClaw 스냅샷을 생성 중입니다. 잠시 후 다시 시도해 주세요.",
            });
        }
        console.error("[openclaw] manual export failed", {
            centerId,
            uid: context.auth.uid,
            error,
        });
        throw new functions.https.HttpsError("internal", "OpenClaw snapshot export failed.", {
            userMessage: "OpenClaw 스냅샷 생성 중 오류가 발생했습니다.",
        });
    }
});
exports.scheduledOpenClawSnapshotExport = functions
    .region(region)
    .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
})
    .pubsub.schedule("10 4 * * *")
    .timeZone("Asia/Seoul")
    .onRun(async () => {
    const db = admin.firestore();
    const centersSnap = await db.collection("centers").get();
    let exported = 0;
    let skipped = 0;
    let failed = 0;
    for (const centerDoc of centersSnap.docs) {
        const centerId = centerDoc.id;
        const integrationSnap = await db.doc(`centers/${centerId}/integrations/openclaw`).get();
        const integration = integrationSnap.exists ? integrationSnap.data() : null;
        if (!(integration === null || integration === void 0 ? void 0 : integration.enabled)) {
            skipped += 1;
            continue;
        }
        try {
            const result = await (0, openclawSnapshot_1.executeOpenClawSnapshotExport)({
                db,
                centerId,
                requestedBy: "scheduler",
            });
            exported += 1;
            console.log("[openclaw] scheduled export complete", {
                centerId,
                objectPath: result.objectPath,
                generatedAt: result.generatedAt,
            });
        }
        catch (error) {
            if (error instanceof openclawSnapshot_1.OpenClawExportInProgressError) {
                skipped += 1;
                console.warn("[openclaw] export skipped because another run is active", { centerId });
                continue;
            }
            failed += 1;
            console.error("[openclaw] scheduled export failed", {
                centerId,
                error,
            });
        }
    }
    console.log("[openclaw] scheduled export summary", {
        centerCount: centersSnap.size,
        exported,
        skipped,
        failed,
    });
    return null;
});
exports.ensureCurrentUserMemberships = functions
    .region(region)
    .https.onCall(async (_data, context) => {
    var _a, _b;
    const db = admin.firestore();
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const uid = context.auth.uid;
    const [byFieldSnap, byDocIdSnap] = await Promise.all([
        db.collectionGroup("members").where("id", "==", uid).get(),
        db.collectionGroup("members").where(admin.firestore.FieldPath.documentId(), "==", uid).get(),
    ]);
    const dedupedDocs = Array.from(new Map([...byFieldSnap.docs, ...byDocIdSnap.docs].map((docSnap) => [docSnap.ref.path, docSnap])).values());
    const repairedCenterIds = new Set();
    for (const docSnap of dedupedDocs) {
        const raw = docSnap.data();
        const centerId = (_b = docSnap.ref.parent.parent) === null || _b === void 0 ? void 0 : _b.id;
        if (!centerId)
            continue;
        const role = normalizeMembershipRoleValue(raw.role) || "student";
        const normalizedStatus = normalizeMembershipStatus(raw.status);
        const status = !normalizedStatus || normalizedStatus === "active" || normalizedStatus === "approved" || normalizedStatus === "enabled" || normalizedStatus === "current"
            ? "active"
            : normalizedStatus === "onhold" || normalizedStatus === "pending"
                ? "onHold"
                : normalizedStatus === "withdrawn" || normalizedStatus === "inactive"
                    ? "withdrawn"
                    : "active";
        const payload = {
            role,
            status,
            joinedAt: raw.joinedAt || admin.firestore.FieldValue.serverTimestamp(),
        };
        if (typeof raw.displayName === "string" && raw.displayName.trim()) {
            payload.displayName = raw.displayName.trim();
        }
        if (typeof raw.className === "string" && raw.className.trim()) {
            payload.className = raw.className.trim();
        }
        if (Array.isArray(raw.linkedStudentIds)) {
            payload.linkedStudentIds = raw.linkedStudentIds
                .filter((item) => typeof item === "string" && item.trim().length > 0)
                .map((item) => item.trim());
        }
        const phoneNumber = resolveFirstValidPhoneNumber(raw.phoneNumber);
        if (phoneNumber) {
            payload.phoneNumber = phoneNumber;
        }
        await db.doc(`userCenters/${uid}/centers/${centerId}`).set(payload, { merge: true });
        repairedCenterIds.add(centerId);
    }
    return {
        ok: true,
        centerIds: Array.from(repairedCenterIds),
        repairedCount: repairedCenterIds.size,
    };
});
var rankingRewardSettlement_1 = require("./rankingRewardSettlement");
Object.defineProperty(exports, "scheduledRankingRewardSettlement", { enumerable: true, get: function () { return rankingRewardSettlement_1.scheduledRankingRewardSettlement; } });
var giftishow_1 = require("./giftishow");
Object.defineProperty(exports, "approveGiftishowOrderSecure", { enumerable: true, get: function () { return giftishow_1.approveGiftishowOrderSecure; } });
Object.defineProperty(exports, "cancelGiftishowOrderSecure", { enumerable: true, get: function () { return giftishow_1.cancelGiftishowOrderSecure; } });
Object.defineProperty(exports, "createGiftishowOrderRequestSecure", { enumerable: true, get: function () { return giftishow_1.createGiftishowOrderRequestSecure; } });
Object.defineProperty(exports, "getGiftishowBizmoneySecure", { enumerable: true, get: function () { return giftishow_1.getGiftishowBizmoneySecure; } });
Object.defineProperty(exports, "reconcilePendingGiftishowOrders", { enumerable: true, get: function () { return giftishow_1.reconcilePendingGiftishowOrders; } });
Object.defineProperty(exports, "rejectGiftishowOrderSecure", { enumerable: true, get: function () { return giftishow_1.rejectGiftishowOrderSecure; } });
Object.defineProperty(exports, "resendGiftishowOrderSecure", { enumerable: true, get: function () { return giftishow_1.resendGiftishowOrderSecure; } });
Object.defineProperty(exports, "saveGiftishowSettingsSecure", { enumerable: true, get: function () { return giftishow_1.saveGiftishowSettingsSecure; } });
Object.defineProperty(exports, "scheduledGiftishowCatalogSync", { enumerable: true, get: function () { return giftishow_1.scheduledGiftishowCatalogSync; } });
Object.defineProperty(exports, "syncGiftishowCatalogSecure", { enumerable: true, get: function () { return giftishow_1.syncGiftishowCatalogSecure; } });
function buildFallbackStudyPlan(profile) {
    const weakSubject = Array.isArray(profile.weakSubjects) && profile.weakSubjects.length > 0
        ? profile.weakSubjects[0]
        : "수학";
    return {
        weekly_balance: {
            국어: 25,
            수학: 30,
            영어: 20,
            탐구: 25,
        },
        daily_todos: [
            { 과목: weakSubject, 활동: "오답 원인 다시 쓰고 비슷한 문제 5개 적용해보기", 시간: 60 },
            { 과목: "국어", 활동: "지문 2개 정독 후 핵심 문장 직접 요약하기", 시간: 40 },
            { 과목: "영어", 활동: "틀린 유형 문장 해석 + 단어 회상 테스트", 시간: 40 },
            { 과목: "탐구", 활동: "개념 빈칸 회상 후 빠르게 확인하기", 시간: 40 },
        ],
        coaching_message: "이번 주는 많이 하는 과목과 효율이 낮은 과목이 겹치지 않는지 먼저 점검해보세요. 시작 전 1분 계획, 끝난 뒤 3분 점검만 붙여도 흐름이 훨씬 덜 흔들릴 수 있어요.",
    };
}
exports.generateStudyPlan = (0, https_1.onCall)({
    region,
    secrets: [geminiApiKey],
    timeoutSeconds: 60,
    memory: "512MiB",
}, async (request) => {
    var _a;
    if (!((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new https_1.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const parsedInput = plannerSchema_1.generateStudyPlanInputSchema.safeParse(request.data);
    if (!parsedInput.success) {
        functions.logger.warn("generateStudyPlan invalid input", {
            uid: request.auth.uid,
            issues: parsedInput.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            })),
        });
        throw new https_1.HttpsError("invalid-argument", "입력값 형식이 올바르지 않습니다.", {
            userMessage: "학습 진단 입력값을 다시 확인해 주세요.",
        });
    }
    const { profile } = parsedInput.data;
    const prompt = [
        "너는 고등학생 학습 코치다.",
        "Zimmerman 자기조절학습, Bloom 활동 유형, Sweller 인지부하, Dweck 동기 패턴, retrieval practice, review spacing을 반영해 이번 주 공부 계획을 JSON으로 생성해라.",
        "학생을 비난하지 말고, 친근하지만 가벼워 보이지 않는 말투를 써라.",
        "응답은 반드시 JSON만 반환하고 마크다운을 쓰지 마라.",
        "weekly_balance는 반드시 국어/수학/영어/탐구 4개 키만 사용하라.",
        "조건:",
        "- weekly_balance는 국어/수학/영어/탐구 합이 100이어야 한다.",
        "- daily_todos는 4~7개.",
        "- 각 todo 시간은 20~120분.",
        "- weak subject를 완전히 피하지 말 것.",
        "- least efficient subject는 활동 유형을 바꾸는 방향으로 제안할 것.",
        "- planning/reflection score가 낮으면 시작 전 계획 1분, 종료 전 점검 3분 같은 마이크로 루틴을 포함할 것.",
        "",
        "학생 프로필 JSON:",
        JSON.stringify(profile, null, 2),
    ].join("\n");
    const apiKey = geminiApiKey.value();
    const candidateModels = ["gemini-1.5-flash", "gemini-2.0-flash-lite", "gemini-2.0-flash"];
    let lastError = null;
    for (const model of candidateModels) {
        try {
            const rawText = await (0, geminiClient_1.generateStructuredStudyPlan)({
                apiKey,
                prompt,
                model,
            });
            const parsed = JSON.parse(rawText);
            const validated = (0, plannerSchema_1.validateStudyPlanOutput)(parsed);
            functions.logger.info("generateStudyPlan success", {
                uid: request.auth.uid,
                model,
                todoCount: validated.daily_todos.length,
            });
            return validated;
        }
        catch (error) {
            lastError = error;
            functions.logger.warn("generateStudyPlan model attempt failed", {
                uid: request.auth.uid,
                model,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    functions.logger.error("generateStudyPlan fallback used", {
        uid: request.auth.uid,
        error: lastError instanceof Error ? lastError.message : String(lastError),
    });
    return (0, plannerSchema_1.validateStudyPlanOutput)(buildFallbackStudyPlan(profile));
});
//# sourceMappingURL=index.js.map