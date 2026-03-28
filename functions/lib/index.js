"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshClassroomSignals = exports.scheduledClassroomSignalsRefresh = exports.scheduledDailyRiskAlert = exports.onSessionCreated = exports.scheduledWeeklyReport = exports.cleanupOldDocuments = exports.scheduledAttendanceCheck = exports.runLateArrivalCheck = exports.sendMarketingLeadSms = exports.sendManualStudentSms = exports.notifyAttendanceSms = exports.scheduledSmsQueueDispatcher = exports.updateSmsRecipientPreference = exports.cancelSmsQueueItem = exports.retrySmsQueueItem = exports.saveNotificationSettingsSecure = exports.confirmInvoicePayment = exports.completeSignupWithInvite = exports.redeemInviteCode = exports.registerStudent = exports.updateParentProfile = exports.updateStudentAccount = exports.deleteTeacherAccount = exports.deleteStudentAccount = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const region = "asia-northeast3";
const smsVpcConnector = "sms-egress-connector";
const smsVpcEgressSettings = "ALL_TRAFFIC";
const allowedRoles = ["student", "teacher", "parent", "centerAdmin"];
const adminRoles = new Set(["centerAdmin", "owner"]);
const SMS_BYTE_LIMIT = 90;
const STUDENT_SMS_FALLBACK_UID = "__student__";
const DEFAULT_SMS_TEMPLATES = {
    study_start: "[{centerName}] {studentName} 학생 {time} 공부시작. 오늘 학습 흐름 확인 부탁드립니다.",
    away_start: "[{centerName}] {studentName} 학생 {time} 외출. 복귀 후 다시 공부를 이어갑니다.",
    away_end: "[{centerName}] {studentName} 학생 {time} 복귀. 다시 공부를 시작했습니다.",
    study_end: "[{centerName}] {studentName} 학생 {time} 공부종료. 오늘 학습 마무리했습니다.",
    late_alert: "{studentName}학생이 {expectedTime}까지 등원하지 않았습니다.",
};
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
    return value.trim().toLowerCase();
}
function isActiveMembershipStatus(value) {
    const normalized = normalizeMembershipStatus(value);
    return !normalized || normalized === "active";
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
    const memberRole = typeof (memberData === null || memberData === void 0 ? void 0 : memberData.role) === "string" ? memberData.role.trim() : "";
    if (memberRole && isActiveMembershipStatus(memberData === null || memberData === void 0 ? void 0 : memberData.status)) {
        return {
            role: memberRole,
            status: memberData === null || memberData === void 0 ? void 0 : memberData.status,
        };
    }
    const userCenterData = userCenterSnap.exists ? userCenterSnap.data() : null;
    const userCenterRole = typeof (userCenterData === null || userCenterData === void 0 ? void 0 : userCenterData.role) === "string" ? userCenterData.role.trim() : "";
    if (userCenterRole && isActiveMembershipStatus(userCenterData === null || userCenterData === void 0 ? void 0 : userCenterData.status)) {
        return {
            role: userCenterRole,
            status: userCenterData === null || userCenterData === void 0 ? void 0 : userCenterData.status,
        };
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
function safeAverageMinutes(values) {
    return values.length === 0 ? 0 : Math.round(average(values));
}
function parseExpectedArrivalMinutes(value, fallback) {
    const parsed = parseHourMinute(typeof value === "string" && value.trim().length > 0 ? value : fallback);
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
    if (eventType === "away_end") {
        return settings.smsTemplateAwayEnd || DEFAULT_SMS_TEMPLATES.away_end;
    }
    if (eventType === "study_end") {
        return settings.smsTemplateStudyEnd || settings.smsTemplateCheckOut || DEFAULT_SMS_TEMPLATES.study_end;
    }
    if (eventType === "away_start") {
        return settings.smsTemplateAwayStart || DEFAULT_SMS_TEMPLATES.away_start;
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
    const settingsSnap = await db.doc(`centers/${centerId}/settings/notifications`).get();
    if (!settingsSnap.exists)
        return {};
    return (settingsSnap.data() || {});
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
    var _a, _b, _c, _d, _e;
    const studentSnap = await db.doc(`centers/${centerId}/students/${studentId}`).get();
    if (!studentSnap.exists)
        return [];
    const parentUidsRaw = (_a = studentSnap.data()) === null || _a === void 0 ? void 0 : _a.parentUids;
    const parentUids = Array.isArray(parentUidsRaw)
        ? parentUidsRaw.filter((uid) => typeof uid === "string" && uid.trim().length > 0)
        : [];
    const recipients = [];
    const usedPhones = new Set();
    for (const parentUid of parentUids) {
        const [userSnap, memberSnap, userCenterSnap] = await Promise.all([
            db.doc(`users/${parentUid}`).get(),
            db.doc(`centers/${centerId}/members/${parentUid}`).get(),
            db.doc(`userCenters/${parentUid}/centers/${centerId}`).get(),
        ]);
        const userData = userSnap.exists ? userSnap.data() : null;
        const memberData = memberSnap.exists ? memberSnap.data() : null;
        const userCenterData = userCenterSnap.exists ? userCenterSnap.data() : null;
        const phoneNumber = resolveFirstValidPhoneNumber(userData === null || userData === void 0 ? void 0 : userData.phoneNumber, memberData === null || memberData === void 0 ? void 0 : memberData.phoneNumber, userCenterData === null || userCenterData === void 0 ? void 0 : userCenterData.phoneNumber);
        if (!phoneNumber || usedPhones.has(phoneNumber))
            continue;
        recipients.push({
            parentUid,
            parentName: (memberData === null || memberData === void 0 ? void 0 : memberData.displayName) ||
                (userCenterData === null || userCenterData === void 0 ? void 0 : userCenterData.displayName) ||
                (userData === null || userData === void 0 ? void 0 : userData.displayName) ||
                null,
            phoneNumber,
        });
        usedPhones.add(phoneNumber);
    }
    if (recipients.length > 0) {
        return recipients;
    }
    const [studentUserSnap, studentMemberSnap, studentUserCenterSnap] = await Promise.all([
        db.doc(`users/${studentId}`).get(),
        db.doc(`centers/${centerId}/members/${studentId}`).get(),
        db.doc(`userCenters/${studentId}/centers/${centerId}`).get(),
    ]);
    const fallbackPhoneNumber = resolveFirstValidPhoneNumber((_b = studentSnap.data()) === null || _b === void 0 ? void 0 : _b.phoneNumber, (_c = studentUserSnap.data()) === null || _c === void 0 ? void 0 : _c.phoneNumber, (_d = studentMemberSnap.data()) === null || _d === void 0 ? void 0 : _d.phoneNumber, (_e = studentUserCenterSnap.data()) === null || _e === void 0 ? void 0 : _e.phoneNumber);
    if (fallbackPhoneNumber) {
        recipients.push({
            parentUid: STUDENT_SMS_FALLBACK_UID,
            parentName: "학생 본인",
            phoneNumber: fallbackPhoneNumber,
        });
    }
    return recipients;
}
function normalizeExplicitSmsRecipients(rawRecipients) {
    if (!Array.isArray(rawRecipients))
        return [];
    const normalized = [];
    const usedPhones = new Set();
    for (const raw of rawRecipients) {
        const row = raw;
        const phoneNumber = resolveFirstValidPhoneNumber(row === null || row === void 0 ? void 0 : row.phoneNumber);
        if (!phoneNumber || usedPhones.has(phoneNumber))
            continue;
        const parentUid = asTrimmedString(row === null || row === void 0 ? void 0 : row.parentUid, STUDENT_SMS_FALLBACK_UID);
        const parentName = asTrimmedString(row === null || row === void 0 ? void 0 : row.parentName, parentUid === STUDENT_SMS_FALLBACK_UID ? "학생 본인" : "학부모");
        normalized.push({
            parentUid,
            parentName,
            phoneNumber,
        });
        usedPhones.add(phoneNumber);
    }
    return normalized;
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
        const eventEnabled = eventType ? toggles[eventType] !== false : true;
        if (!enabled) {
            suppressedRecipients.push(Object.assign(Object.assign({}, recipient), { suppressedReason: "recipient_disabled" }));
            continue;
        }
        if (!eventEnabled && eventType) {
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
    const expectedTimeLabel = expectedTime || settings.defaultArrivalTime || "정해진 시간";
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
                : eventType === "away_end"
                    ? "복귀 알림"
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
async function queueManualStudentSms(db, params) {
    const { centerId, studentId, studentName } = params;
    const settings = params.settings || await loadNotificationSettings(db, centerId);
    const recipients = params.recipientOverrides && params.recipientOverrides.length > 0
        ? params.recipientOverrides
        : await collectParentRecipients(db, centerId, studentId);
    const message = trimSmsToByteLimit(asTrimmedString(params.message));
    if (!message) {
        return { queuedCount: 0, recipientCount: 0, message: "" };
    }
    if (recipients.length === 0) {
        return { queuedCount: 0, recipientCount: 0, message };
    }
    const { allowedRecipients, suppressedRecipients } = await splitRecipientsBySmsPreference(db, centerId, studentId, studentName, null, recipients);
    const provider = settings.smsProvider || "none";
    const ts = admin.firestore.Timestamp.now();
    const batch = db.batch();
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
            dedupeKey: null,
            eventType: "manual_note",
            dateKey: toDateKey(ts.toDate()),
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
                manualSend: true,
            },
        });
        const parentNotificationRef = db.collection(`centers/${centerId}/parentNotifications`).doc();
        batch.set(parentNotificationRef, {
            centerId,
            studentId,
            parentUid: recipient.parentUid,
            type: "manual_note",
            title: "센터 수동 문자",
            body: message,
            isRead: false,
            isImportant: true,
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
        eventType: "manual_note",
        renderedMessage: message,
        messageBytes: calculateSmsBytes(message),
        provider,
        attemptNo: 0,
        status: "suppressed_opt_out",
        createdAt: ts,
        suppressedReason: recipient.suppressedReason,
    })));
    return { queuedCount: allowedRecipients.length, recipientCount: recipients.length, message };
}
async function queueMarketingManualSms(db, params) {
    const { centerId } = params;
    const settings = params.settings || await loadNotificationSettings(db, centerId);
    const message = trimSmsToByteLimit(asTrimmedString(params.message));
    if (!message) {
        return { queuedCount: 0, recipientCount: 0, targetCount: 0, skippedCount: 0, missingCount: 0, message: "" };
    }
    const targets = params.targets
        .map((row) => ({
        targetType: row.targetType,
        targetId: asTrimmedString(row.targetId),
    }))
        .filter((row) => row.targetId);
    if (targets.length === 0) {
        return { queuedCount: 0, recipientCount: 0, targetCount: 0, skippedCount: 0, missingCount: 0, message };
    }
    const initialStatus = buildSmsQueueInitialStatus(settings);
    const provider = settings.smsProvider || "none";
    const ts = admin.firestore.Timestamp.now();
    const batch = db.batch();
    const usedPhones = new Set();
    let queuedCount = 0;
    let skippedCount = 0;
    let missingCount = 0;
    for (const target of targets) {
        const refPath = target.targetType === "consulting_lead"
            ? `centers/${centerId}/consultingLeads/${target.targetId}`
            : `centers/${centerId}/admissionWaitlist/${target.targetId}`;
        const targetSnap = await db.doc(refPath).get();
        if (!targetSnap.exists) {
            missingCount += 1;
            continue;
        }
        const targetData = targetSnap.data() || {};
        const phoneNumber = resolveFirstValidPhoneNumber(targetData.parentPhone, targetData.studentPhone);
        if (!phoneNumber) {
            missingCount += 1;
            continue;
        }
        if (usedPhones.has(phoneNumber)) {
            skippedCount += 1;
            continue;
        }
        usedPhones.add(phoneNumber);
        const studentName = asTrimmedString(targetData.studentName, "문의 학생");
        const parentName = asTrimmedString(targetData.parentName, target.targetType === "consulting_lead" ? "상담 리드" : "입학 대기");
        const queueRef = db.collection(`centers/${centerId}/smsQueue`).doc();
        batch.set(queueRef, {
            centerId,
            studentId: null,
            studentName,
            parentUid: `marketing_${target.targetType}:${target.targetId}`,
            parentName,
            phoneNumber,
            to: phoneNumber,
            provider,
            sender: settings.smsSender || null,
            endpointUrl: settings.smsEndpointUrl || null,
            message,
            renderedMessage: message,
            messageBytes: calculateSmsBytes(message),
            dedupeKey: null,
            eventType: "manual_note",
            dateKey: toDateKey(ts.toDate()),
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
                targetType: target.targetType,
                targetId: target.targetId,
                school: asTrimmedString(targetData.school),
                grade: asTrimmedString(targetData.grade),
                serviceType: asTrimmedString(targetData.serviceType),
                requestType: asTrimmedString(targetData.requestType),
                source: "marketing_crm",
            },
        });
        queuedCount += 1;
    }
    if (queuedCount > 0) {
        await batch.commit();
    }
    return {
        queuedCount,
        recipientCount: usedPhones.size,
        targetCount: targets.length,
        skippedCount,
        missingCount,
        message,
    };
}
async function runLateArrivalCheckForCenter(db, centerId, nowKst, attendanceSnap) {
    const settings = await loadNotificationSettings(db, centerId);
    if (settings.lateAlertEnabled === false)
        return 0;
    const graceMinutes = Number.isFinite(Number(settings.lateAlertGraceMinutes))
        ? Math.max(0, Number(settings.lateAlertGraceMinutes))
        : 20;
    const defaultArrivalTime = settings.defaultArrivalTime || "17:00";
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
        if (seatData.status === "studying" || seatData.status === "away" || seatData.status === "break") {
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
        const expectedTimeRaw = studentData.expectedArrivalTime || defaultArrivalTime;
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
        formData.append("user_id", params.userId);
        formData.append("sender", params.sender);
        formData.append("receiver", params.receiver);
        formData.append("msg", params.message);
        formData.append("msg_type", "SMS");
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
    return typeof role === "string" && adminRoles.has(role);
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
    const defaultArrivalTime = settings.defaultArrivalTime || "17:00";
    const nowMinutes = nowKst.getHours() * 60 + nowKst.getMinutes();
    const weekAgoKey = toDateKey(new Date(nowKst.getTime() - 6 * 24 * 60 * 60 * 1000));
    const penaltyCutoff = admin.firestore.Timestamp.fromMillis(nowKst.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [membersSnap, attendanceSnap, todayStatsSnap, riskCacheSnap, counselingSnap, reportsSnap, penaltyLogsSnap] = await Promise.all([
        db.collection(`centers/${centerId}/members`).where("role", "==", "student").where("status", "==", "active").get(),
        db.collection(`centers/${centerId}/attendanceCurrent`).get(),
        db.collection(`centers/${centerId}/dailyStudentStats/${dateKey}/students`).get(),
        db.doc(`centers/${centerId}/riskCache/${dateKey}`).get(),
        db.collection(`centers/${centerId}/counselingReservations`).get(),
        db.collection(`centers/${centerId}/dailyReports`).where("status", "==", "sent").get(),
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
        const expectedArrivalTime = asTrimmedString(student === null || student === void 0 ? void 0 : student.expectedArrivalTime, defaultArrivalTime);
        const expectedArrivalMinutes = parseExpectedArrivalMinutes(expectedArrivalTime, defaultArrivalTime);
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
            incidents.push(buildIncident("late_or_absent", "high", context, `예상 등교 시간 ${context.expectedArrivalTime || defaultArrivalTime} 기준으로 미입실 상태입니다.`, context.occurredAt));
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
    var _a, _b, _c, _d, _e;
    const db = admin.firestore();
    const auth = admin.auth();
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "인증 필요");
    const { studentId, centerId } = data;
    if (!studentId || !centerId)
        throw new functions.https.HttpsError("invalid-argument", "ID 누락");
    const callerMembership = await resolveCenterMembershipRole(db, centerId, context.auth.uid);
    if (!isAdminRole(callerMembership.role)) {
        throw new functions.https.HttpsError("permission-denied", "센터 관리자만 삭제 가능합니다.");
    }
    const targetMemberRef = db.doc(`centers/${centerId}/members/${studentId}`);
    const targetStudentRef = db.doc(`centers/${centerId}/students/${studentId}`);
    const targetUserCenterRef = db.doc(`userCenters/${studentId}/centers/${centerId}`);
    const targetMemberSnap = await targetMemberRef.get();
    const [targetStudentSnap, targetUserCenterSnap] = await Promise.all([
        targetStudentRef.get(),
        targetUserCenterRef.get(),
    ]);
    const targetRole = (typeof ((_a = targetMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role) === "string" ? (_b = targetMemberSnap.data()) === null || _b === void 0 ? void 0 : _b.role : "") ||
        (typeof ((_c = targetUserCenterSnap.data()) === null || _c === void 0 ? void 0 : _c.role) === "string" ? (_d = targetUserCenterSnap.data()) === null || _d === void 0 ? void 0 : _d.role : "") ||
        (targetStudentSnap.exists ? "student" : "");
    if ((!targetMemberSnap.exists && !targetStudentSnap.exists && !targetUserCenterSnap.exists) || targetRole !== "student") {
        throw new functions.https.HttpsError("failed-precondition", "해당 센터의 학생 계정만 삭제할 수 있습니다.");
    }
    try {
        const timestamp = admin.firestore.Timestamp.now();
        const requiredErrors = [];
        const warningErrors = [];
        const parentUids = normalizeStringArray((_e = targetStudentSnap.data()) === null || _e === void 0 ? void 0 : _e.parentUids);
        const pushError = (bucket, label, error) => {
            bucket.push(`${label}: ${(error === null || error === void 0 ? void 0 : error.message) || "delete failed"}`);
        };
        const deleteTree = async (ref, label, bucket) => {
            try {
                await db.recursiveDelete(ref);
            }
            catch (error) {
                pushError(bucket, label, error);
            }
        };
        const deleteByStudentIdQuery = async (collectionPath, label, bucket) => {
            try {
                const snap = await db.collection(collectionPath).where("studentId", "==", studentId).get();
                await Promise.all(snap.docs.map((docSnap) => db.recursiveDelete(docSnap.ref)));
            }
            catch (error) {
                pushError(bucket, label, error);
            }
        };
        await Promise.all([
            deleteTree(db.doc(`users/${studentId}`), "users", requiredErrors),
            deleteTree(db.doc(`userCenters/${studentId}`), "userCenters", requiredErrors),
            deleteTree(targetMemberRef, "member", requiredErrors),
            deleteTree(targetStudentRef, "student", requiredErrors),
            deleteTree(db.doc(`centers/${centerId}/growthProgress/${studentId}`), "growthProgress", warningErrors),
            deleteTree(db.doc(`centers/${centerId}/plans/${studentId}`), "plans", warningErrors),
            deleteTree(db.doc(`centers/${centerId}/studyLogs/${studentId}`), "studyLogs", warningErrors),
            deleteByStudentIdQuery(`centers/${centerId}/counselingReservations`, "counselingReservations", warningErrors),
            deleteByStudentIdQuery(`centers/${centerId}/counselingLogs`, "counselingLogs", warningErrors),
            deleteByStudentIdQuery(`centers/${centerId}/attendanceRequests`, "attendanceRequests", warningErrors),
            deleteByStudentIdQuery(`centers/${centerId}/dailyReports`, "dailyReports", warningErrors),
            deleteByStudentIdQuery(`centers/${centerId}/attendanceEvents`, "attendanceEvents", warningErrors),
            deleteByStudentIdQuery(`centers/${centerId}/smsQueue`, "smsQueue", warningErrors),
            deleteByStudentIdQuery(`centers/${centerId}/smsDeliveryLogs`, "smsDeliveryLogs", warningErrors),
            deleteByStudentIdQuery(`centers/${centerId}/invoices`, "invoices", warningErrors),
            (async () => {
                try {
                    const statsSnap = await db.collectionGroup("students").where("studentId", "==", studentId).get();
                    const statDocs = statsSnap.docs.filter((docSnap) => docSnap.ref.path.startsWith(`centers/${centerId}/dailyStudentStats/`) ||
                        docSnap.ref.path.startsWith(`centers/${centerId}/attendanceDailyStats/`));
                    await Promise.all(statDocs.map((docSnap) => db.recursiveDelete(docSnap.ref)));
                }
                catch (error) {
                    pushError(warningErrors, "dailyStats", error);
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
                catch (error) {
                    pushError(warningErrors, "leaderboards", error);
                }
            })(),
            (async () => {
                try {
                    const seatsSnap = await db.collection(`centers/${centerId}/attendanceCurrent`).where("studentId", "==", studentId).get();
                    await Promise.all(seatsSnap.docs.map((seatDoc) => seatDoc.ref.set({
                        studentId: null,
                        roomId: admin.firestore.FieldValue.delete(),
                        roomSeatNo: admin.firestore.FieldValue.delete(),
                        seatId: admin.firestore.FieldValue.delete(),
                        status: "absent",
                        updatedAt: timestamp,
                        lastCheckInAt: admin.firestore.FieldValue.delete(),
                    }, { merge: true })));
                }
                catch (error) {
                    pushError(warningErrors, "attendanceCurrent", error);
                }
            })(),
            (async () => {
                try {
                    if (parentUids.length === 0)
                        return;
                    const batch = db.batch();
                    for (const parentUid of parentUids) {
                        batch.set(db.doc(`centers/${centerId}/members/${parentUid}`), {
                            linkedStudentIds: admin.firestore.FieldValue.arrayRemove(studentId),
                            updatedAt: timestamp,
                        }, { merge: true });
                        batch.set(db.doc(`userCenters/${parentUid}/centers/${centerId}`), {
                            linkedStudentIds: admin.firestore.FieldValue.arrayRemove(studentId),
                            updatedAt: timestamp,
                        }, { merge: true });
                    }
                    await batch.commit();
                }
                catch (error) {
                    pushError(warningErrors, "parentLinks", error);
                }
            })(),
            (async () => {
                try {
                    const recipientPrefSnap = await db
                        .collection(`centers/${centerId}/smsRecipientPreferences`)
                        .where("studentId", "==", studentId)
                        .get();
                    await Promise.all(recipientPrefSnap.docs.map((docSnap) => db.recursiveDelete(docSnap.ref)));
                }
                catch (error) {
                    pushError(warningErrors, "smsRecipientPreferences", error);
                }
            })(),
        ]);
        if (requiredErrors.length > 0) {
            throw new Error(`핵심 학생 데이터 삭제 실패 (${requiredErrors.join(" | ")})`);
        }
        try {
            await auth.deleteUser(studentId);
        }
        catch (e) {
            if ((e === null || e === void 0 ? void 0 : e.code) !== "auth/user-not-found") {
                throw e;
            }
        }
        return {
            ok: true,
            message: warningErrors.length > 0 ? "학생 계정은 삭제되었고, 일부 보조 기록은 후속 정리되었습니다." : "정리가 완료되었습니다.",
            warnings: warningErrors,
        };
    }
    catch (error) {
        throw new functions.https.HttpsError("internal", (error === null || error === void 0 ? void 0 : error.message) || "학생 계정 삭제 중 오류가 발생했습니다.", {
            userMessage: (error === null || error === void 0 ? void 0 : error.message) || "학생 계정 삭제 중 오류가 발생했습니다.",
        });
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
        throw new functions.https.HttpsError("internal", (error === null || error === void 0 ? void 0 : error.message) || "선생님 계정 삭제 중 오류가 발생했습니다.");
    }
});
exports.updateStudentAccount = functions.region(region).https.onCall(async (data, context) => {
    var _a, _b;
    const db = admin.firestore();
    const auth = admin.auth();
    const { studentId, centerId, password, displayName, schoolName, grade, phoneNumber, parentLinkCode, className, memberStatus, seasonLp, stats, todayStudyMinutes, dateKey, } = data;
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
    const phoneNumberProvided = phoneNumber !== undefined;
    const normalizedPhoneNumber = phoneNumber === null ? "" : normalizePhoneNumber(phoneNumber);
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
    if (phoneNumberProvided && !normalizedPhoneNumber) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid phone number.", {
            userMessage: "휴대폰 번호를 01012345678 형식으로 입력해 주세요.",
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
            let duplicateCandidates = [];
            try {
                const duplicateSnap = await db
                    .collectionGroup("students")
                    .where("parentLinkCode", "==", normalizedParentLinkCode)
                    .limit(20)
                    .get();
                duplicateCandidates = duplicateSnap.docs;
            }
            catch (lookupError) {
                console.warn("[updateStudentAccount] collectionGroup duplicate lookup failed, fallback to center scoped lookup", {
                    centerId,
                    studentId,
                    code: normalizedParentLinkCode,
                    message: (lookupError === null || lookupError === void 0 ? void 0 : lookupError.message) || lookupError,
                });
                const localStudentsRef = db.collection(`centers/${centerId}/students`);
                const localStringSnap = await localStudentsRef
                    .where("parentLinkCode", "==", normalizedParentLinkCode)
                    .limit(20)
                    .get();
                duplicateCandidates = [...localStringSnap.docs];
                const asNumber = Number(normalizedParentLinkCode);
                if (Number.isFinite(asNumber)) {
                    const localNumberSnap = await localStudentsRef
                        .where("parentLinkCode", "==", asNumber)
                        .limit(20)
                        .get();
                    for (const docSnap of localNumberSnap.docs) {
                        if (!duplicateCandidates.find((d) => d.ref.path === docSnap.ref.path)) {
                            duplicateCandidates.push(docSnap);
                        }
                    }
                }
            }
            let hasConflict = false;
            for (const docSnap of duplicateCandidates) {
                if (docSnap.id === studentId)
                    continue;
                const candidateCenterRef = docSnap.ref.parent.parent;
                if (!candidateCenterRef)
                    continue;
                const candidateMemberSnap = await db.doc(`centers/${candidateCenterRef.id}/members/${docSnap.id}`).get();
                if (!candidateMemberSnap.exists)
                    continue;
                const candidateMemberData = candidateMemberSnap.data();
                const isActiveStudentCandidate = (candidateMemberData === null || candidateMemberData === void 0 ? void 0 : candidateMemberData.role) === "student" && isActiveMembershipStatus(candidateMemberData === null || candidateMemberData === void 0 ? void 0 : candidateMemberData.status);
                if (!isActiveStudentCandidate)
                    continue;
                const candidateUserCenterSnap = await db.doc(`userCenters/${docSnap.id}/centers/${candidateCenterRef.id}`).get();
                const candidateUserCenterData = candidateUserCenterSnap.exists ? candidateUserCenterSnap.data() : null;
                const hasActiveUserCenter = candidateUserCenterSnap.exists &&
                    (candidateUserCenterData === null || candidateUserCenterData === void 0 ? void 0 : candidateUserCenterData.role) === "student" &&
                    isActiveMembershipStatus(candidateUserCenterData === null || candidateUserCenterData === void 0 ? void 0 : candidateUserCenterData.status);
                let hasSeatAssignment = false;
                if (!hasActiveUserCenter) {
                    const seatSnap = await db
                        .collection(`centers/${candidateCenterRef.id}/attendanceCurrent`)
                        .where("studentId", "==", docSnap.id)
                        .limit(1)
                        .get();
                    hasSeatAssignment = !seatSnap.empty;
                }
                if (hasActiveUserCenter || hasSeatAssignment) {
                    hasConflict = true;
                    break;
                }
            }
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
                userMessage: "학생은 학교/학년/본인 전화번호/학부모 연동 코드만 수정할 수 있습니다.",
            });
        }
        const hasSelfEditableFieldInPayload = typeof schoolName === "string" || typeof grade === "string" || parentLinkCodeProvided || phoneNumberProvided;
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
        if (phoneNumberProvided)
            userUpdate.phoneNumber = normalizedPhoneNumber;
        const hasUserWrite = trimmedDisplayName.length > 0 || trimmedSchoolName.length > 0 || phoneNumberProvided;
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
        if (phoneNumberProvided)
            studentUpdate.phoneNumber = normalizedPhoneNumber;
        if (parentLinkCodeProvided)
            studentUpdate.parentLinkCode = normalizedParentLinkCode || null;
        if (canEditOtherStudent && hasClassName)
            studentUpdate.className = normalizedClassName;
        batch.set(studentRef, studentUpdate, { merge: true });
        const memberRef = db.doc("centers/" + centerId + "/members/" + studentId);
        const memberUpdate = { updatedAt: timestamp };
        if (trimmedDisplayName)
            memberUpdate.displayName = trimmedDisplayName;
        if (hasClassName)
            memberUpdate.className = normalizedClassName;
        if (phoneNumberProvided)
            memberUpdate.phoneNumber = normalizedPhoneNumber;
        if (isAdminCaller && memberStatusProvided)
            memberUpdate.status = normalizedMemberStatus;
        const shouldWriteMember = canEditOtherStudent || phoneNumberProvided;
        if (shouldWriteMember) {
            batch.set(memberRef, memberUpdate, { merge: true });
        }
        const userCenterRef = db.doc("userCenters/" + studentId + "/centers/" + centerId);
        const userCenterUpdate = {
            className: normalizedClassName,
            updatedAt: timestamp,
        };
        if (phoneNumberProvided)
            userCenterUpdate.phoneNumber = normalizedPhoneNumber;
        if (isAdminCaller && memberStatusProvided)
            userCenterUpdate.status = normalizedMemberStatus;
        const shouldWriteUserCenter = (canEditOtherStudent && hasClassName) ||
            (isAdminCaller && memberStatusProvided) ||
            phoneNumberProvided;
        if (canEditOtherStudent && hasClassName) {
            batch.set(userCenterRef, userCenterUpdate, { merge: true });
        }
        else if (isAdminCaller && memberStatusProvided) {
            batch.set(userCenterRef, userCenterUpdate, { merge: true });
        }
        else if (phoneNumberProvided) {
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
            if (shouldWriteMember) {
                coreWrites.push(memberRef.set(memberUpdate, { merge: true }));
            }
            if (shouldWriteUserCenter) {
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
            userMessage: (e === null || e === void 0 ? void 0 : e.message) || "Unknown internal error",
        });
    }
});
exports.updateParentProfile = functions.region(region).https.onCall(async (data, context) => {
    const db = admin.firestore();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "인증 필요");
    }
    const callerUid = context.auth.uid;
    const centerId = typeof (data === null || data === void 0 ? void 0 : data.centerId) === "string" ? data.centerId.trim() : "";
    const schoolName = typeof (data === null || data === void 0 ? void 0 : data.schoolName) === "string" ? data.schoolName.trim() : "";
    const normalizedPhoneNumber = normalizePhoneNumber(data === null || data === void 0 ? void 0 : data.phoneNumber);
    if (!centerId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId is required.", {
            userMessage: "센터 정보가 누락되었습니다. 다시 로그인 후 시도해 주세요.",
        });
    }
    if (!normalizedPhoneNumber) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid phone number.", {
            userMessage: "휴대폰 번호를 01012345678 형식으로 입력해 주세요.",
        });
    }
    const callerMembership = await resolveCenterMembershipRole(db, centerId, callerUid);
    if (callerMembership.role !== "parent" || !isActiveMembershipStatus(callerMembership.status)) {
        throw new functions.https.HttpsError("permission-denied", "Only active parent members can update profile.", {
            userMessage: "학부모 계정만 본인 전화번호를 수정할 수 있습니다.",
        });
    }
    const timestamp = admin.firestore.Timestamp.now();
    const batch = db.batch();
    const userRef = db.doc(`users/${callerUid}`);
    const memberRef = db.doc(`centers/${centerId}/members/${callerUid}`);
    const userCenterRef = db.doc(`userCenters/${callerUid}/centers/${centerId}`);
    const userUpdate = {
        phoneNumber: normalizedPhoneNumber,
        updatedAt: timestamp,
    };
    if (schoolName) {
        userUpdate.schoolName = schoolName;
    }
    const membershipUpdate = {
        phoneNumber: normalizedPhoneNumber,
        updatedAt: timestamp,
    };
    batch.set(userRef, userUpdate, { merge: true });
    batch.set(memberRef, membershipUpdate, { merge: true });
    batch.set(userCenterRef, membershipUpdate, { merge: true });
    await batch.commit();
    return { ok: true };
});
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
            userMessage: (e === null || e === void 0 ? void 0 : e.message) || "Unknown internal error",
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
            userMessage: (e === null || e === void 0 ? void 0 : e.message) || "Unknown internal error",
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
    const signupPhoneNumber = normalizePhoneNumber((data === null || data === void 0 ? void 0 : data.parentPhoneNumber) || (data === null || data === void 0 ? void 0 : data.phoneNumber) || "");
    if (!allowedRoles.includes(role)) {
        throw new functions.https.HttpsError("invalid-argument", "선택한 역할이 유효하지 않습니다.");
    }
    if (role !== "parent" && !code) {
        throw new functions.https.HttpsError("invalid-argument", "초대 코드가 누락되었습니다.", {
            userMessage: "초대 코드를 입력해주세요.",
        });
    }
    const emailFromToken = context.auth.token.email || null;
    const tokenDisplayName = context.auth.token.name || null;
    try {
        return await db.runTransaction(async (t) => {
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
            let resolvedDisplayName = displayNameInput || tokenDisplayName || "사용자";
            const existingLinkedStudentIds = Array.from(new Set([
                ...extractLinkedIds(existingMembershipData === null || existingMembershipData === void 0 ? void 0 : existingMembershipData.linkedStudentIds),
                ...extractLinkedIds(existingCenterMemberData === null || existingCenterMemberData === void 0 ? void 0 : existingCenterMemberData.linkedStudentIds),
            ]));
            let linkedStudentIds = [];
            let effectiveUserPhone = signupPhoneNumber || normalizePhoneNumber((existingMembershipData === null || existingMembershipData === void 0 ? void 0 : existingMembershipData.phoneNumber) || (existingCenterMemberData === null || existingCenterMemberData === void 0 ? void 0 : existingCenterMemberData.phoneNumber) || "");
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
                if (!effectiveUserPhone) {
                    throw new functions.https.HttpsError("invalid-argument", "Student phone number is required.", {
                        userMessage: "학생 가입 시 본인 휴대폰 번호를 입력해주세요.",
                    });
                }
            }
            if (role === "parent") {
                if (!linkedStudentRef || !linkedStudentData || !linkedStudentId) {
                    throw new functions.https.HttpsError("failed-precondition", "Linked student data is missing.", {
                        userMessage: "연동할 학생 정보를 찾지 못했습니다. 다시 시도해주세요.",
                    });
                }
                if (!effectiveUserPhone) {
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
            }
            const userDocData = {
                id: uid,
                email: emailFromToken,
                displayName: resolvedDisplayName,
                schoolName: schoolName || "",
                updatedAt: ts,
                createdAt: ts,
            };
            if ((role === "student" || role === "parent") && effectiveUserPhone) {
                userDocData.phoneNumber = effectiveUserPhone;
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
            if ((role === "student" || role === "parent") && effectiveUserPhone) {
                memberData.phoneNumber = effectiveUserPhone;
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
            if ((role === "student" || role === "parent") && effectiveUserPhone) {
                userCenterData.phoneNumber = effectiveUserPhone;
            }
            if (linkedStudentIds.length > 0) {
                userCenterData.linkedStudentIds = linkedStudentIds;
            }
            t.set(memberRef, memberData, { merge: true });
            t.set(userCenterRef, userCenterData, { merge: true });
            if (role === "student") {
                t.set(db.doc(`centers/${centerId}/students/${uid}`), {
                    id: uid,
                    name: resolvedDisplayName,
                    schoolName,
                    grade,
                    phoneNumber: effectiveUserPhone,
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
    }
    catch (e) {
        if (e instanceof functions.https.HttpsError) {
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
                userMessage = normalizedFailedPreconditionMessage;
            }
            throw new functions.https.HttpsError("failed-precondition", "Signup precondition failed.", {
                userMessage,
            });
        }
        if (hasInvalidArgument) {
            throw new functions.https.HttpsError("invalid-argument", "Invalid signup input.", {
                userMessage: normalizedInvalidArgumentMessage || "입력값을 다시 확인해 주세요. 학생코드, 전화번호 등 필수값이 누락되었을 수 있습니다.",
            });
        }
        if (hasAlreadyExists) {
            throw new functions.https.HttpsError("already-exists", "Signup target already exists.", {
                userMessage: normalizedAlreadyExistsMessage || "이미 연결된 계정입니다. 로그인 후 대시보드에서 확인해 주세요.",
            });
        }
        throw new functions.https.HttpsError("internal", "Signup processing failed due to an internal error.", {
            userMessage: (e === null || e === void 0 ? void 0 : e.message) || "Unknown internal error",
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
        defaultArrivalTime: asTrimmedString(data === null || data === void 0 ? void 0 : data.defaultArrivalTime, "17:00"),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: context.auth.uid,
    };
    const rawApiKey = asTrimmedString(data === null || data === void 0 ? void 0 : data.smsApiKey);
    if (rawApiKey) {
        payload.smsApiKey = rawApiKey;
        payload.smsApiKeyConfigured = true;
        payload.smsApiKeyLastUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
    }
    else if ((data === null || data === void 0 ? void 0 : data.clearSmsApiKey) === true) {
        payload.smsApiKey = admin.firestore.FieldValue.delete();
        payload.smsApiKeyConfigured = false;
        payload.smsApiKeyLastUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
    }
    await db.doc(`centers/${centerId}/settings/notifications`).set(payload, { merge: true });
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
    var _a, _b, _c, _d, _e, _f, _g, _h;
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
    const isStudentFallbackRecipient = parentUid === STUDENT_SMS_FALLBACK_UID;
    if (!isStudentFallbackRecipient && !parentUids.includes(parentUid)) {
        throw new functions.https.HttpsError("failed-precondition", "해당 학생에 연결된 학부모가 아닙니다.");
    }
    const [userSnap, memberSnap] = await Promise.all([
        db.doc(`users/${isStudentFallbackRecipient ? studentId : parentUid}`).get(),
        db.doc(`centers/${centerId}/members/${isStudentFallbackRecipient ? studentId : parentUid}`).get(),
    ]);
    const studentName = asTrimmedString((_c = studentSnap.data()) === null || _c === void 0 ? void 0 : _c.name, "학생");
    const parentName = isStudentFallbackRecipient
        ? "학생 본인"
        : asTrimmedString(((_d = memberSnap.data()) === null || _d === void 0 ? void 0 : _d.displayName) || ((_e = userSnap.data()) === null || _e === void 0 ? void 0 : _e.displayName) || "학부모");
    const phoneNumberOverride = asTrimmedString(data === null || data === void 0 ? void 0 : data.phoneNumberOverride);
    const phoneNumber = resolveFirstValidPhoneNumber(phoneNumberOverride, isStudentFallbackRecipient
        ? (_f = studentSnap.data()) === null || _f === void 0 ? void 0 : _f.phoneNumber
        : null, (_g = userSnap.data()) === null || _g === void 0 ? void 0 : _g.phoneNumber, (_h = memberSnap.data()) === null || _h === void 0 ? void 0 : _h.phoneNumber);
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
    .runWith({
    vpcConnector: smsVpcConnector,
    vpcConnectorEgressSettings: smsVpcEgressSettings,
})
    .pubsub.schedule("every 1 minutes")
    .timeZone("Asia/Seoul")
    .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    const nowTs = admin.firestore.Timestamp.fromDate(now);
    const processingLeaseUntil = admin.firestore.Timestamp.fromDate(new Date(now.getTime() + 60 * 1000));
    const centersSnap = await db.collection("centers").get();
    let processed = 0;
    for (const centerDoc of centersSnap.docs) {
        const centerId = centerDoc.id;
        const queueCol = db.collection(`centers/${centerId}/smsQueue`);
        const [queuedSnap, processingSnap] = await Promise.all([
            queueCol.where("status", "==", "queued").limit(30).get(),
            queueCol.where("status", "==", "processing").limit(30).get(),
        ]);
        const candidateDocs = [...queuedSnap.docs, ...processingSnap.docs];
        for (const queueDoc of candidateDocs) {
            const claimed = await db.runTransaction(async (tx) => {
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
                const nextAttemptCount = Math.max(0, Number(freshData.attemptCount || 0)) + 1;
                tx.set(queueDoc.ref, {
                    status: "processing",
                    providerStatus: "processing",
                    attemptCount: nextAttemptCount,
                    processingStartedAt: nowTs,
                    processingLeaseUntil,
                    updatedAt: nowTs,
                }, { merge: true });
                return Object.assign(Object.assign({}, freshData), { id: queueDoc.id, attemptCount: nextAttemptCount });
            });
            if (!claimed)
                continue;
            await dispatchSmsQueueItem(db, centerId, queueDoc.ref, claimed, Number(claimed.attemptCount || 1));
            processed += 1;
        }
    }
    console.log("[sms-dispatcher] run complete", { centerCount: centersSnap.size, processed });
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
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
    const callerRole = callerMemberSnap.exists ? (_a = callerMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role : null;
    const canNotify = callerRole === "teacher" || isAdminRole(callerRole);
    if (!canNotify) {
        throw new functions.https.HttpsError("permission-denied", "Only teacher/admin can send notifications.");
    }
    const studentSnap = await db.doc(`centers/${centerId}/students/${studentId}`).get();
    if (!studentSnap.exists) {
        throw new functions.https.HttpsError("failed-precondition", "Student not found.", {
            userMessage: "학생 정보를 찾을 수 없습니다.",
        });
    }
    const studentNameRaw = (_b = studentSnap.data()) === null || _b === void 0 ? void 0 : _b.name;
    const studentName = typeof studentNameRaw === "string" && studentNameRaw.trim() ? studentNameRaw.trim() : "학생";
    const nowKst = toKstDate();
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
exports.sendManualStudentSms = functions.region(region).https.onCall(async (data, context) => {
    var _a, _b;
    const db = admin.firestore();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = String((data === null || data === void 0 ? void 0 : data.centerId) || "").trim();
    const studentId = String((data === null || data === void 0 ? void 0 : data.studentId) || "").trim();
    const rawMessage = String((data === null || data === void 0 ? void 0 : data.message) || "").replace(/\s+/g, " ").trim();
    if (!centerId || !studentId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId and studentId are required.", {
            userMessage: "센터 또는 학생 정보가 누락되었습니다.",
        });
    }
    if (!rawMessage) {
        throw new functions.https.HttpsError("invalid-argument", "message is required.", {
            userMessage: "보낼 문자 내용을 입력해 주세요.",
        });
    }
    if (calculateSmsBytes(rawMessage) > SMS_BYTE_LIMIT) {
        throw new functions.https.HttpsError("invalid-argument", "message exceeds byte limit.", {
            userMessage: "수동 문자 내용이 90byte를 넘었습니다.",
        });
    }
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
    const callerRole = callerMemberSnap.exists ? (_a = callerMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role : null;
    const canNotify = callerRole === "teacher" || isAdminRole(callerRole);
    if (!canNotify) {
        throw new functions.https.HttpsError("permission-denied", "Only teacher/admin can send notifications.");
    }
    const studentSnap = await db.doc(`centers/${centerId}/students/${studentId}`).get();
    if (!studentSnap.exists) {
        throw new functions.https.HttpsError("failed-precondition", "Student not found.", {
            userMessage: "학생 정보를 찾을 수 없습니다.",
        });
    }
    const studentNameRaw = (_b = studentSnap.data()) === null || _b === void 0 ? void 0 : _b.name;
    const studentName = typeof studentNameRaw === "string" && studentNameRaw.trim() ? studentNameRaw.trim() : "학생";
    const settings = await loadNotificationSettings(db, centerId);
    const recipientOverrides = normalizeExplicitSmsRecipients(data === null || data === void 0 ? void 0 : data.recipientOverrides);
    const queueResult = await queueManualStudentSms(db, {
        centerId,
        studentId,
        studentName,
        message: rawMessage,
        settings,
        recipientOverrides,
    });
    if (queueResult.recipientCount === 0) {
        throw new functions.https.HttpsError("failed-precondition", "No recipients available.", {
            userMessage: "수신 가능한 번호가 없습니다. 학생 또는 학부모 번호를 먼저 확인해 주세요.",
        });
    }
    return {
        ok: true,
        queuedCount: queueResult.queuedCount,
        recipientCount: queueResult.recipientCount,
        provider: settings.smsProvider || "none",
        message: queueResult.message,
    };
});
exports.sendMarketingLeadSms = functions.region(region).https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    const rawMessage = String((data === null || data === void 0 ? void 0 : data.message) || "").replace(/\s+/g, " ").trim();
    const rawTargets = Array.isArray(data === null || data === void 0 ? void 0 : data.targets) ? data.targets : [];
    if (!centerId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId is required.", {
            userMessage: "센터 정보가 누락되었습니다.",
        });
    }
    if (!rawMessage) {
        throw new functions.https.HttpsError("invalid-argument", "message is required.", {
            userMessage: "보낼 문자 내용을 입력해 주세요.",
        });
    }
    if (calculateSmsBytes(rawMessage) > SMS_BYTE_LIMIT) {
        throw new functions.https.HttpsError("invalid-argument", "message exceeds byte limit.", {
            userMessage: "문자 내용이 90byte를 넘었습니다.",
        });
    }
    if (rawTargets.length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "targets are required.", {
            userMessage: "문자 대상을 선택해 주세요.",
        });
    }
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
    const callerRole = callerMemberSnap.exists ? (_a = callerMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role : null;
    if (!isAdminRole(callerRole)) {
        throw new functions.https.HttpsError("permission-denied", "센터 관리자만 리드 문자를 보낼 수 있습니다.");
    }
    const targets = rawTargets
        .map((row) => {
        const targetType = asTrimmedString(row === null || row === void 0 ? void 0 : row.targetType);
        const targetId = asTrimmedString(row === null || row === void 0 ? void 0 : row.targetId);
        return {
            targetType,
            targetId,
        };
    })
        .filter((row) => row.targetId &&
        (row.targetType === "consulting_lead" || row.targetType === "waitlist"));
    const settings = await loadNotificationSettings(db, centerId);
    const queueResult = await queueMarketingManualSms(db, {
        centerId,
        message: rawMessage,
        settings,
        targets,
    });
    if (queueResult.queuedCount === 0) {
        throw new functions.https.HttpsError("failed-precondition", "No recipients available.", {
            userMessage: "발송 가능한 연락처가 없습니다. 학부모 또는 학생 번호를 먼저 확인해 주세요.",
        });
    }
    return {
        ok: true,
        queuedCount: queueResult.queuedCount,
        recipientCount: queueResult.recipientCount,
        targetCount: queueResult.targetCount,
        skippedCount: queueResult.skippedCount,
        missingCount: queueResult.missingCount,
        provider: settings.smsProvider || "none",
        message: queueResult.message,
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
    const attendanceSnap = await db.collection(`centers/${centerId}/attendanceCurrent`).get();
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
    var _a;
    const db = admin.firestore();
    const nowKst = toKstDate();
    const MAX_SESSION_MINUTES = 360; // 6시간
    const STUDY_SESSION_LP_PER_MINUTE = 0.75;
    const STUDY_ATTENDANCE_BONUS_LP = 50;
    const cutoffTimestamp = admin.firestore.Timestamp.fromMillis(Date.now() - MAX_SESSION_MINUTES * 60 * 1000);
    const centersSnap = await db.collection("centers").get();
    let totalLateAlerts = 0;
    let totalClosed = 0;
    for (const centerDoc of centersSnap.docs) {
        const centerId = centerDoc.id;
        // attendanceCurrent 한 번만 읽어 두 작업에 공유
        const attendanceSnap = await db.collection(`centers/${centerId}/attendanceCurrent`).get();
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
            batch.set(logRef, {
                totalMinutes: admin.firestore.FieldValue.increment(MAX_SESSION_MINUTES),
                studentId,
                centerId,
                dateKey: sessionDateKey,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            const sessionRef = logRef.collection("sessions").doc();
            batch.set(sessionRef, {
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
            const progressSnap = await progressRef.get();
            const progressData = progressSnap.exists ? progressSnap.data() : null;
            const stats = (progressData === null || progressData === void 0 ? void 0 : progressData.stats) || { focus: 0, consistency: 0, achievement: 0, resilience: 0 };
            const totalBoost = 1
                + (Number(stats.focus || 0) / 100 * 0.05)
                + (Number(stats.consistency || 0) / 100 * 0.05)
                + (Number(stats.achievement || 0) / 100 * 0.05)
                + (Number(stats.resilience || 0) / 100 * 0.05);
            const penaltyPoints = Number((progressData === null || progressData === void 0 ? void 0 : progressData.penaltyPoints) || 0);
            const penaltyRate = penaltyPoints >= 30 ? 0.15 : penaltyPoints >= 20 ? 0.10 : penaltyPoints >= 10 ? 0.06 : penaltyPoints >= 5 ? 0.03 : 0;
            const finalMultiplier = totalBoost * (1 - penaltyRate);
            const existingDayStatus = ((progressData === null || progressData === void 0 ? void 0 : progressData.dailyLpStatus) || {})[sessionDateKey] || {};
            const fortuneBoostPercent = (existingDayStatus === null || existingDayStatus === void 0 ? void 0 : existingDayStatus.fortuneRewardType) === "boost"
                ? Math.max(0, Math.min(10, Math.round(Number((existingDayStatus === null || existingDayStatus === void 0 ? void 0 : existingDayStatus.fortuneBoostPercent) || 0))))
                : 0;
            const fortuneBoostMultiplier = 1 + fortuneBoostPercent / 100;
            const existingDayMinutes = Number(((_a = (await logRef.get()).data()) === null || _a === void 0 ? void 0 : _a.totalMinutes) || 0);
            const totalMinutesAfterSession = existingDayMinutes + MAX_SESSION_MINUTES;
            let studyLpEarned = Math.max(0, Math.round(MAX_SESSION_MINUTES * STUDY_SESSION_LP_PER_MINUTE * finalMultiplier * fortuneBoostMultiplier));
            const nextDayStatus = Object.assign({}, existingDayStatus);
            const progressUpdate = {
                seasonLp: admin.firestore.FieldValue.increment(0),
                "stats.focus": admin.firestore.FieldValue.increment((MAX_SESSION_MINUTES / 60) * 0.1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (totalMinutesAfterSession >= 180 && !(existingDayStatus === null || existingDayStatus === void 0 ? void 0 : existingDayStatus.attendance)) {
                studyLpEarned += Math.max(0, Math.round(STUDY_ATTENDANCE_BONUS_LP * finalMultiplier * fortuneBoostMultiplier));
                nextDayStatus.attendance = true;
            }
            if (totalMinutesAfterSession >= 360 && !(existingDayStatus === null || existingDayStatus === void 0 ? void 0 : existingDayStatus.bonus6h)) {
                nextDayStatus.bonus6h = true;
                progressUpdate["stats.resilience"] = admin.firestore.FieldValue.increment(0.5);
            }
            nextDayStatus.dailyLpAmount = admin.firestore.FieldValue.increment(studyLpEarned);
            batch.set(progressRef, Object.assign(Object.assign({}, progressUpdate), { seasonLp: admin.firestore.FieldValue.increment(studyLpEarned), dailyLpStatus: {
                    [sessionDateKey]: nextDayStatus,
                } }), { merge: true });
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
    const centersSnap = await db.collection("centers").get();
    let totalDeleted = 0;
    const deleteOldDocs = async (colPath, cutoff, maxDocs = 500) => {
        const snap = await db
            .collection(colPath)
            .where("createdAt", "<", cutoff)
            .limit(maxDocs)
            .get();
        if (snap.empty)
            return 0;
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        return snap.size;
    };
    for (const centerDoc of centersSnap.docs) {
        const cid = centerDoc.id;
        const [sq, sdl, sl, sd, la, pn] = await Promise.all([
            deleteOldDocs(`centers/${cid}/smsQueue`, thirtyDaysAgo),
            deleteOldDocs(`centers/${cid}/smsDeliveryLogs`, thirtyDaysAgo),
            deleteOldDocs(`centers/${cid}/smsLogs`, thirtyDaysAgo),
            deleteOldDocs(`centers/${cid}/smsDedupes`, threeDaysAgo),
            deleteOldDocs(`centers/${cid}/lateAlerts`, sevenDaysAgo),
            deleteOldDocs(`centers/${cid}/parentNotifications`, thirtyDaysAgo),
        ]);
        const centerTotal = sq + sdl + sl + sd + la + pn;
        if (centerTotal > 0) {
            console.log(`[cleanup] center=${cid} deleted=${centerTotal} (smsQueue=${sq} smsDeliveryLogs=${sdl} smsLogs=${sl} smsDedupes=${sd} lateAlerts=${la} parentNotifications=${pn})`);
        }
        totalDeleted += centerTotal;
    }
    console.log("[cleanup] run complete", { centerCount: centersSnap.size, totalDeleted });
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
        for (const memberDoc of membersSnap.docs) {
            const studentId = memberDoc.id;
            // 7일 총 집중 시간 합산
            let weeklyMinutes = 0;
            await Promise.all(dateKeys.map(async (dateKey) => {
                var _a, _b;
                const statSnap = await db
                    .doc(`centers/${centerId}/dailyStudentStats/${dateKey}/students/${studentId}`)
                    .get();
                if (statSnap.exists) {
                    weeklyMinutes += Number((_b = (_a = statSnap.data()) === null || _a === void 0 ? void 0 : _a.totalStudyMinutes) !== null && _b !== void 0 ? _b : 0);
                }
            }));
            const studentData = (await db.doc(`centers/${centerId}/students/${studentId}`).get()).data();
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
/**
 * 세션 문서 생성 시 durationMinutes 유효성 검증 및 LP 서버 보정
 * - 0분 이하 또는 360분 초과 세션은 경계값으로 클램프
 * - closedReason이 있는 자동 종료 세션은 검증에서 제외
 */
exports.onSessionCreated = functions
    .region(region)
    .firestore.document("centers/{centerId}/studyLogs/{studentId}/days/{dateKey}/sessions/{sessionId}")
    .onCreate(async (snap, context) => {
    var _a;
    const data = snap.data();
    const { centerId, studentId, dateKey } = context.params;
    // 자동 종료 세션은 Cloud Function 자체가 생성했으므로 재검증 불필요
    if (data.closedReason)
        return null;
    const rawDuration = Number((_a = data.durationMinutes) !== null && _a !== void 0 ? _a : 0);
    if (!Number.isFinite(rawDuration) || rawDuration < 0) {
        console.warn("[session-validate] invalid durationMinutes", { centerId, studentId, sessionId: snap.id, rawDuration });
        await snap.ref.update({ durationMinutes: 0, validationFlag: "clamped_negative" });
        return null;
    }
    const MAX_MINUTES = 360;
    if (rawDuration > MAX_MINUTES) {
        const clamped = MAX_MINUTES;
        const db = admin.firestore();
        const batch = db.batch();
        batch.update(snap.ref, { durationMinutes: clamped, validationFlag: "clamped_max" });
        // dailyStudentStats 보정: 초과분 차감
        const overageMinutes = rawDuration - clamped;
        const statRef = db.doc(`centers/${centerId}/dailyStudentStats/${dateKey}/students/${studentId}`);
        batch.set(statRef, {
            totalStudyMinutes: admin.firestore.FieldValue.increment(-overageMinutes),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        // studyLogs day 보정
        const logRef = db.doc(`centers/${centerId}/studyLogs/${studentId}/days/${dateKey}`);
        batch.set(logRef, {
            totalMinutes: admin.firestore.FieldValue.increment(-overageMinutes),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        await batch.commit();
        console.log("[session-validate] clamped max", { centerId, studentId, sessionId: snap.id, rawDuration, clamped });
    }
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
        const atRiskStudentIds = [];
        const atRiskNames = [];
        for (const memberDoc of membersSnap.docs) {
            const studentId = memberDoc.id;
            const studentSnap = await db.doc(`centers/${centerId}/students/${studentId}`).get();
            if (!studentSnap.exists)
                continue;
            const studentData = studentSnap.data();
            const targetDailyMinutes = Number((_a = studentData === null || studentData === void 0 ? void 0 : studentData.targetDailyMinutes) !== null && _a !== void 0 ? _a : 0);
            if (targetDailyMinutes <= 0)
                continue;
            const target14Days = targetDailyMinutes * 14;
            let actual14Minutes = 0;
            await Promise.all(dateKeys.map(async (dateKey) => {
                var _a, _b;
                const statSnap = await db
                    .doc(`centers/${centerId}/dailyStudentStats/${dateKey}/students/${studentId}`)
                    .get();
                if (statSnap.exists) {
                    actual14Minutes += Number((_b = (_a = statSnap.data()) === null || _a === void 0 ? void 0 : _a.totalStudyMinutes) !== null && _b !== void 0 ? _b : 0);
                }
            }));
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
//# sourceMappingURL=index.js.map