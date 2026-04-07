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
exports.OpenClawExportInProgressError = exports.OPENCLAW_TIMEZONE = exports.OPENCLAW_SCHEMA_VERSION = void 0;
exports.serializeSnapshotValue = serializeSnapshotValue;
exports.isDateKeyInRange = isDateKeyInRange;
exports.buildOpenClawHistoryPath = buildOpenClawHistoryPath;
exports.createEmptyOpenClawSnapshot = createEmptyOpenClawSnapshot;
exports.executeOpenClawSnapshotExport = executeOpenClawSnapshotExport;
const admin = __importStar(require("firebase-admin"));
exports.OPENCLAW_SCHEMA_VERSION = "openclaw-snapshot.v1";
exports.OPENCLAW_TIMEZONE = "Asia/Seoul";
const OPENCLAW_KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const OPENCLAW_EXPORT_STALE_MS = 15 * 60 * 1000;
const OPENCLAW_ATTENDANCE_DAYS = 35;
const OPENCLAW_CONSULTATION_LOG_DAYS = 90;
const OPENCLAW_RESERVATION_PAST_DAYS = 30;
const OPENCLAW_RESERVATION_FUTURE_DAYS = 30;
const OPENCLAW_BILLING_DAYS = 180;
const OPENCLAW_KPI_DAYS = 35;
const OPENCLAW_STUDY_LOG_DAYS = 35;
const OPENCLAW_SESSION_DAYS = 14;
class OpenClawExportInProgressError extends Error {
    constructor(message = "An OpenClaw export is already running.") {
        super(message);
        this.name = "OpenClawExportInProgressError";
    }
}
exports.OpenClawExportInProgressError = OpenClawExportInProgressError;
const MEMBER_FIELDS = [
    "role",
    "status",
    "joinedAt",
    "displayName",
    "className",
    "linkedStudentIds",
    "monthlyFee",
    "baseFee",
    "tutoringDiscount",
    "siblingDiscount",
];
const STUDENT_PROFILE_FIELDS = [
    "name",
    "grade",
    "schoolName",
    "className",
    "seatNo",
    "seatId",
    "roomId",
    "roomSeatNo",
    "seatZone",
    "targetDailyMinutes",
    "targetDailyMinutesSource",
    "parentUids",
    "createdAt",
    "monthlyFee",
    "currentEnrollment",
    "examCountdowns",
    "goalPathType",
    "goalPathLabel",
];
const GROWTH_PROGRESS_FIELDS = [
    "seasonLp",
    "penaltyPoints",
    "stats",
    "dailyPointStatus",
    "pointsBalance",
    "totalPointsEarned",
    "dailyLpStatus",
    "totalLpEarned",
    "lastResetAt",
    "updatedAt",
];
const ATTENDANCE_RECORD_FIELDS = [
    "status",
    "statusSource",
    "updatedAt",
    "checkInAt",
    "autoSyncedAt",
    "routineMissingAtCheckIn",
    "routineMissingPenaltyApplied",
    "confirmedByUserId",
    "centerId",
    "studentId",
    "dateKey",
    "studentName",
];
const SCHEDULE_FIELDS = [
    "uid",
    "studentName",
    "centerId",
    "dateKey",
    "timezone",
    "arrivalPlannedAt",
    "departurePlannedAt",
    "hasExcursion",
    "excursionStartAt",
    "excursionEndAt",
    "excursionReason",
    "note",
    "recurrenceSourceId",
    "status",
    "actualArrivalAt",
    "actualDepartureAt",
    "inTime",
    "outTime",
    "isAbsent",
    "outings",
    "recommendedStudyMinutes",
    "recommendedWeeklyDays",
    "source",
    "createdAt",
    "updatedAt",
];
const CURRENT_SEAT_FIELDS = [
    "seatNo",
    "roomId",
    "roomSeatNo",
    "status",
    "type",
    "seatZone",
    "updatedAt",
    "lastCheckInAt",
    "studentId",
];
const COUNSELING_LOG_FIELDS = [
    "studentId",
    "studentName",
    "teacherId",
    "teacherName",
    "type",
    "content",
    "improvement",
    "reservationId",
    "studentQuestion",
    "readAt",
    "readByUid",
    "readByRole",
    "createdAt",
];
const COUNSELING_RESERVATION_FIELDS = [
    "studentId",
    "studentName",
    "teacherId",
    "teacherName",
    "scheduledAt",
    "status",
    "studentNote",
    "teacherNote",
    "createdAt",
    "updatedAt",
];
const INVOICE_FIELDS = [
    "studentId",
    "studentName",
    "cycleStartDate",
    "cycleEndDate",
    "priceSnapshot",
    "discountsSnapshot",
    "finalPrice",
    "status",
    "paymentMethod",
    "paidAt",
    "issuedAt",
    "updatedAt",
    "trackCategory",
    "isActionRequired",
    "dueLabel",
    "paymentMethodSummary",
    "nextAction",
    "priority",
    "readAt",
];
const PAYMENT_FIELDS = [
    "invoiceId",
    "studentId",
    "studentName",
    "centerId",
    "amount",
    "method",
    "status",
    "processedAt",
    "createdAt",
];
const KPI_FIELDS = [
    "date",
    "totalRevenue",
    "collectedRevenue",
    "totalDiscount",
    "totalRefund",
    "totalStudyMinutes",
    "activeStudentCount",
    "breakevenStudents",
    "updatedAt",
];
const DAILY_STUDENT_STAT_FIELDS = [
    "centerId",
    "studentId",
    "dateKey",
    "todayPlanCompletionRate",
    "totalStudyMinutes",
    "studyTimeGrowthRate",
    "createdAt",
    "updatedAt",
];
const STUDY_LOG_DAY_FIELDS = [
    "centerId",
    "studentId",
    "dateKey",
    "totalMinutes",
    "awayMinutes",
    "firstSessionStartAt",
    "lastSessionEndAt",
    "createdAt",
    "updatedAt",
    "autoClosedAt",
];
const SESSION_FIELDS = [
    "centerId",
    "studentId",
    "dateKey",
    "startTime",
    "endTime",
    "durationMinutes",
    "sessionId",
    "closedReason",
    "autoClosedAt",
    "validationFlag",
    "correctedAt",
    "createdAt",
];
const RISK_CACHE_FIELDS = [
    "dateKey",
    "atRiskStudentIds",
    "updatedAt",
];
const CLASSROOM_SIGNAL_FIELDS = [
    "dateKey",
    "updatedAt",
    "summary",
    "classSummaries",
    "seatSignals",
    "incidents",
];
function toKstCalendarDate(baseDate = new Date()) {
    return new Date(baseDate.getTime() + OPENCLAW_KST_OFFSET_MS);
}
function toKstDateKey(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
function addUtcDays(date, delta) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + delta);
    return next;
}
function addDays(date, delta) {
    const next = new Date(date);
    next.setDate(next.getDate() + delta);
    return next;
}
function buildPastDateKeys(nowKstCalendar, days) {
    return Array.from({ length: days }, (_value, index) => {
        return toKstDateKey(addUtcDays(nowKstCalendar, -(days - index - 1)));
    });
}
function chunkArray(items, size) {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}
function toIsoString(value) {
    if (!value)
        return null;
    if (value instanceof Date) {
        return Number.isFinite(value.getTime()) ? value.toISOString() : null;
    }
    if (typeof value === "string") {
        const parsed = new Date(value);
        return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : value;
    }
    if (typeof value === "number") {
        const parsed = new Date(value);
        return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
    }
    if (typeof value === "object") {
        const maybeValue = value;
        if (typeof maybeValue.toDate === "function") {
            const date = maybeValue.toDate();
            return Number.isFinite(date.getTime()) ? date.toISOString() : null;
        }
        if (typeof maybeValue.seconds === "number") {
            return new Date(maybeValue.seconds * 1000).toISOString();
        }
    }
    return null;
}
function serializeSnapshotValue(value) {
    if (value === undefined)
        return undefined;
    const isoString = toIsoString(value);
    if (isoString)
        return isoString;
    if (Array.isArray(value)) {
        return value
            .map((entry) => serializeSnapshotValue(entry))
            .filter((entry) => entry !== undefined);
    }
    if (value && typeof value === "object") {
        const source = value;
        const next = {};
        for (const [key, entryValue] of Object.entries(source)) {
            const serialized = serializeSnapshotValue(entryValue);
            if (serialized !== undefined) {
                next[key] = serialized;
            }
        }
        return next;
    }
    return value;
}
function isDateKeyInRange(dateKey, fromDateKey, toDateKey) {
    return Boolean(dateKey) && dateKey >= fromDateKey && dateKey <= toDateKey;
}
function buildOpenClawHistoryPath(centerId, generatedAt) {
    const kstDate = toKstCalendarDate(generatedAt);
    const year = String(kstDate.getUTCFullYear());
    const month = String(kstDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(kstDate.getUTCDate()).padStart(2, "0");
    const hh = String(kstDate.getUTCHours()).padStart(2, "0");
    const mm = String(kstDate.getUTCMinutes()).padStart(2, "0");
    const ss = String(kstDate.getUTCSeconds()).padStart(2, "0");
    return `openclaw/centers/${centerId}/history/${year}/${month}/${day}/${hh}${mm}${ss}.json`;
}
function buildOpenClawLatestPath(centerId) {
    return `openclaw/centers/${centerId}/latest.json`;
}
function pickFields(source, fields, extras) {
    const record = {};
    for (const field of fields) {
        if (source[field] === undefined)
            continue;
        const serialized = serializeSnapshotValue(source[field]);
        if (serialized !== undefined) {
            record[field] = serialized;
        }
    }
    if (extras) {
        for (const [key, value] of Object.entries(extras)) {
            if (value === undefined)
                continue;
            const serialized = serializeSnapshotValue(value);
            if (serialized !== undefined) {
                record[key] = serialized;
            }
        }
    }
    return record;
}
function extractParentDisplayNames(parentMembers, studentId, studentParentUids) {
    return parentMembers
        .filter((member) => {
        const linkedStudentIds = Array.isArray(member.linkedStudentIds) ? member.linkedStudentIds : [];
        const memberId = typeof member.uid === "string" ? member.uid : "";
        return linkedStudentIds.includes(studentId) || studentParentUids.includes(memberId);
    })
        .map((member) => (typeof member.displayName === "string" ? member.displayName.trim() : ""))
        .filter((name) => name.length > 0);
}
async function fetchStudyLogDaySnapshots(params) {
    const { db, centerId, studentIds, fromDateKey, toDateKey } = params;
    const snapshots = [];
    for (const studentIdChunk of chunkArray(studentIds, 24)) {
        const chunkResults = await Promise.all(studentIdChunk.map((studentId) => db
            .collection(`centers/${centerId}/studyLogs/${studentId}/days`)
            .where("dateKey", ">=", fromDateKey)
            .where("dateKey", "<=", toDateKey)
            .get()));
        chunkResults.forEach((snap) => {
            snapshots.push(...snap.docs);
        });
    }
    return snapshots;
}
function summarizeRecordCounts(snapshot) {
    return {
        students: {
            memberships: snapshot.students.memberships.length,
            profiles: snapshot.students.profiles.length,
            growthProgress: snapshot.students.growthProgress.length,
        },
        attendance: {
            records: snapshot.attendance.records.length,
            schedules: snapshot.attendance.schedules.length,
            currentSeats: snapshot.attendance.currentSeats.length,
        },
        consultations: {
            logs: snapshot.consultations.logs.length,
            reservations: snapshot.consultations.reservations.length,
        },
        billing: {
            invoices: snapshot.billing.invoices.length,
            payments: snapshot.billing.payments.length,
            kpiDaily: snapshot.billing.kpiDaily.length,
        },
        studyRoomUsage: {
            dailyStudentStats: snapshot.studyRoomUsage.dailyStudentStats.length,
            studyLogDays: snapshot.studyRoomUsage.studyLogDays.length,
            sessions: snapshot.studyRoomUsage.sessions.length,
        },
        derived: {
            riskCache: snapshot.derived.riskCache ? 1 : 0,
            classroomSignals: snapshot.derived.classroomSignals ? 1 : 0,
            kpiDaily: snapshot.derived.kpiDaily.length,
        },
    };
}
function createEmptyOpenClawSnapshot(params) {
    return {
        schemaVersion: exports.OPENCLAW_SCHEMA_VERSION,
        centerId: params.centerId,
        generatedAt: params.generatedAt,
        timezone: exports.OPENCLAW_TIMEZONE,
        windows: params.windows,
        students: {
            memberships: [],
            profiles: [],
            growthProgress: [],
        },
        attendance: {
            records: [],
            schedules: [],
            currentSeats: [],
        },
        consultations: {
            logs: [],
            reservations: [],
        },
        billing: {
            invoices: [],
            payments: [],
            kpiDaily: [],
        },
        studyRoomUsage: {
            dailyStudentStats: [],
            studyLogDays: [],
            sessions: [],
        },
        derived: {
            riskCache: null,
            classroomSignals: null,
            kpiDaily: [],
        },
    };
}
async function buildOpenClawSnapshot(params) {
    const { db, centerId } = params;
    const generatedAtDate = new Date();
    const nowKstCalendar = toKstCalendarDate(generatedAtDate);
    const generatedAtISO = generatedAtDate.toISOString();
    const attendanceDateKeys = buildPastDateKeys(nowKstCalendar, OPENCLAW_ATTENDANCE_DAYS);
    const kpiDateKeys = buildPastDateKeys(nowKstCalendar, OPENCLAW_KPI_DAYS);
    const studyLogDateKeys = buildPastDateKeys(nowKstCalendar, OPENCLAW_STUDY_LOG_DAYS);
    const sessionDateKeys = buildPastDateKeys(nowKstCalendar, OPENCLAW_SESSION_DAYS);
    const consultationLogsFrom = addDays(generatedAtDate, -(OPENCLAW_CONSULTATION_LOG_DAYS - 1));
    const reservationFrom = addDays(generatedAtDate, -OPENCLAW_RESERVATION_PAST_DAYS);
    const reservationTo = addDays(generatedAtDate, OPENCLAW_RESERVATION_FUTURE_DAYS);
    const billingFrom = addDays(generatedAtDate, -(OPENCLAW_BILLING_DAYS - 1));
    const windows = {
        attendance: {
            fromDateKey: attendanceDateKeys[0],
            toDateKey: attendanceDateKeys[attendanceDateKeys.length - 1],
            days: OPENCLAW_ATTENDANCE_DAYS,
        },
        consultations: {
            logsFromISO: consultationLogsFrom.toISOString(),
            logsToISO: generatedAtISO,
            reservationsFromISO: reservationFrom.toISOString(),
            reservationsToISO: reservationTo.toISOString(),
        },
        billing: {
            invoicesFromISO: billingFrom.toISOString(),
            paymentsFromISO: billingFrom.toISOString(),
            kpiFromDateKey: kpiDateKeys[0],
            kpiToDateKey: kpiDateKeys[kpiDateKeys.length - 1],
        },
        studyRoomUsage: {
            fromDateKey: studyLogDateKeys[0],
            toDateKey: studyLogDateKeys[studyLogDateKeys.length - 1],
            sessionFromDateKey: sessionDateKeys[0],
            sessionToDateKey: sessionDateKeys[sessionDateKeys.length - 1],
        },
        derived: {
            kpiFromDateKey: kpiDateKeys[0],
            kpiToDateKey: kpiDateKeys[kpiDateKeys.length - 1],
            latestOnly: ["riskCache", "classroomSignals"],
        },
    };
    const snapshot = createEmptyOpenClawSnapshot({
        centerId,
        generatedAt: generatedAtISO,
        windows,
    });
    const studyLogDateKeySet = new Set(studyLogDateKeys);
    const sessionDateKeySet = new Set(sessionDateKeys);
    const membersQuery = db.collection(`centers/${centerId}/members`).get();
    const studentProfilesQuery = db.collection(`centers/${centerId}/students`).get();
    const growthProgressQuery = db.collection(`centers/${centerId}/growthProgress`).get();
    const attendanceCurrentQuery = db.collection(`centers/${centerId}/attendanceCurrent`).get();
    const schedulesQuery = db
        .collectionGroup("schedules")
        .where("centerId", "==", centerId)
        .where("dateKey", ">=", attendanceDateKeys[0])
        .where("dateKey", "<=", attendanceDateKeys[attendanceDateKeys.length - 1])
        .get();
    const counselingLogsQuery = db
        .collection(`centers/${centerId}/counselingLogs`)
        .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(consultationLogsFrom))
        .get();
    const counselingReservationsQuery = db
        .collection(`centers/${centerId}/counselingReservations`)
        .where("scheduledAt", ">=", admin.firestore.Timestamp.fromDate(reservationFrom))
        .where("scheduledAt", "<=", admin.firestore.Timestamp.fromDate(reservationTo))
        .get();
    const invoicesQuery = db
        .collection(`centers/${centerId}/invoices`)
        .where("cycleEndDate", ">=", admin.firestore.Timestamp.fromDate(billingFrom))
        .get();
    const paymentsQuery = db
        .collection(`centers/${centerId}/payments`)
        .where("processedAt", ">=", admin.firestore.Timestamp.fromDate(billingFrom))
        .get();
    const kpiDailyQuery = db
        .collection(`centers/${centerId}/kpiDaily`)
        .where("date", ">=", kpiDateKeys[0])
        .where("date", "<=", kpiDateKeys[kpiDateKeys.length - 1])
        .get();
    const riskCacheQuery = db.collection(`centers/${centerId}/riskCache`).orderBy("dateKey", "desc").limit(1).get();
    const classroomSignalsQuery = db.collection(`centers/${centerId}/classroomSignals`).orderBy("dateKey", "desc").limit(1).get();
    const attendanceRecordsQueries = attendanceDateKeys.map((dateKey) => db.collection(`centers/${centerId}/attendanceRecords/${dateKey}/students`).get());
    const dailyStudentStatsQueries = studyLogDateKeys.map((dateKey) => db.collection(`centers/${centerId}/dailyStudentStats/${dateKey}/students`).get());
    const [membersSnap, studentProfilesSnap, growthProgressSnap, attendanceCurrentSnap, schedulesSnap, counselingLogsSnap, counselingReservationsSnap, invoicesSnap, paymentsSnap, kpiDailySnap, riskCacheSnap, classroomSignalsSnap, ...datedSnaps] = await Promise.all([
        membersQuery,
        studentProfilesQuery,
        growthProgressQuery,
        attendanceCurrentQuery,
        schedulesQuery,
        counselingLogsQuery,
        counselingReservationsQuery,
        invoicesQuery,
        paymentsQuery,
        kpiDailyQuery,
        riskCacheQuery,
        classroomSignalsQuery,
        ...attendanceRecordsQueries,
        ...dailyStudentStatsQueries,
    ]);
    const attendanceRecordSnaps = datedSnaps.slice(0, attendanceRecordsQueries.length);
    const dailyStudentStatSnaps = datedSnaps.slice(attendanceRecordsQueries.length);
    const memberships = membersSnap.docs.map((docSnap) => pickFields(docSnap.data(), MEMBER_FIELDS, {
        uid: docSnap.id,
    }));
    const parentMemberships = memberships.filter((membership) => membership.role === "parent");
    const studentMembershipIds = new Set(memberships
        .filter((membership) => membership.role === "student")
        .map((membership) => String(membership.uid || ""))
        .filter((uid) => uid.length > 0));
    snapshot.students.memberships = memberships;
    snapshot.students.profiles = studentProfilesSnap.docs.map((docSnap) => {
        const raw = docSnap.data();
        const parentUids = Array.isArray(raw.parentUids)
            ? raw.parentUids.filter((value) => typeof value === "string" && value.trim().length > 0)
            : [];
        return pickFields(raw, STUDENT_PROFILE_FIELDS, {
            id: docSnap.id,
            parentDisplayNames: extractParentDisplayNames(parentMemberships, docSnap.id, parentUids),
        });
    });
    const studentProfileIds = new Set(snapshot.students.profiles.map((profile) => String(profile.id || "")).filter(Boolean));
    const studentIds = Array.from(new Set([...studentMembershipIds, ...studentProfileIds]));
    snapshot.students.growthProgress = growthProgressSnap.docs
        .filter((docSnap) => studentIds.length === 0 || studentIds.includes(docSnap.id))
        .map((docSnap) => pickFields(docSnap.data(), GROWTH_PROGRESS_FIELDS, {
        studentId: docSnap.id,
    }));
    snapshot.attendance.records = attendanceRecordSnaps.flatMap((snap, index) => snap.docs.map((docSnap) => {
        const raw = docSnap.data();
        const dateKey = typeof raw.dateKey === "string" ? raw.dateKey : attendanceDateKeys[index] || "";
        return pickFields(raw, ATTENDANCE_RECORD_FIELDS, {
            id: docSnap.id,
            studentId: typeof raw.studentId === "string" ? raw.studentId : docSnap.id,
            dateKey,
        });
    }));
    snapshot.attendance.schedules = schedulesSnap.docs
        .filter((docSnap) => {
        const raw = docSnap.data();
        const dateKey = typeof raw.dateKey === "string" ? raw.dateKey : docSnap.id;
        return isDateKeyInRange(dateKey, attendanceDateKeys[0], attendanceDateKeys[attendanceDateKeys.length - 1]);
    })
        .map((docSnap) => {
        var _a;
        const raw = docSnap.data();
        return pickFields(raw, SCHEDULE_FIELDS, {
            id: docSnap.id,
            uid: typeof raw.uid === "string" ? raw.uid : ((_a = docSnap.ref.parent.parent) === null || _a === void 0 ? void 0 : _a.id) || null,
        });
    });
    snapshot.attendance.currentSeats = attendanceCurrentSnap.docs.map((docSnap) => pickFields(docSnap.data(), CURRENT_SEAT_FIELDS, {
        id: docSnap.id,
    }));
    snapshot.consultations.logs = counselingLogsSnap.docs.map((docSnap) => pickFields(docSnap.data(), COUNSELING_LOG_FIELDS, {
        id: docSnap.id,
    }));
    snapshot.consultations.reservations = counselingReservationsSnap.docs.map((docSnap) => pickFields(docSnap.data(), COUNSELING_RESERVATION_FIELDS, {
        id: docSnap.id,
    }));
    snapshot.billing.invoices = invoicesSnap.docs.map((docSnap) => pickFields(docSnap.data(), INVOICE_FIELDS, {
        id: docSnap.id,
    }));
    snapshot.billing.payments = paymentsSnap.docs.map((docSnap) => pickFields(docSnap.data(), PAYMENT_FIELDS, {
        id: docSnap.id,
    }));
    const kpiDailyRecords = kpiDailySnap.docs.map((docSnap) => pickFields(docSnap.data(), KPI_FIELDS, {
        id: docSnap.id,
    }));
    snapshot.billing.kpiDaily = kpiDailyRecords;
    snapshot.derived.kpiDaily = kpiDailyRecords;
    snapshot.studyRoomUsage.dailyStudentStats = dailyStudentStatSnaps.flatMap((snap, index) => snap.docs.map((docSnap) => pickFields(docSnap.data(), DAILY_STUDENT_STAT_FIELDS, {
        id: docSnap.id,
        studentId: docSnap.data().studentId || docSnap.id,
        dateKey: studyLogDateKeys[index] || "",
    })));
    const existingStudyLogDaySnaps = await fetchStudyLogDaySnapshots({
        db,
        centerId,
        studentIds,
        fromDateKey: studyLogDateKeys[0],
        toDateKey: studyLogDateKeys[studyLogDateKeys.length - 1],
    }).then((snaps) => snaps.filter((docSnap) => {
        const raw = docSnap.data();
        const dateKey = typeof raw.dateKey === "string" ? raw.dateKey : docSnap.id;
        return studyLogDateKeySet.has(dateKey);
    }));
    snapshot.studyRoomUsage.studyLogDays = existingStudyLogDaySnaps.map((docSnap) => {
        var _a;
        const raw = docSnap.data();
        const studentId = ((_a = docSnap.ref.parent.parent) === null || _a === void 0 ? void 0 : _a.id) || raw.studentId || "";
        return pickFields(raw, STUDY_LOG_DAY_FIELDS, {
            id: docSnap.id,
            studentId,
            dateKey: typeof raw.dateKey === "string" ? raw.dateKey : docSnap.id,
        });
    });
    const sessionCollections = await Promise.all(existingStudyLogDaySnaps
        .filter((docSnap) => {
        const raw = docSnap.data();
        const dateKey = typeof raw.dateKey === "string" ? raw.dateKey : docSnap.id;
        return sessionDateKeySet.has(dateKey);
    })
        .map(async (docSnap) => ({
        daySnap: docSnap,
        sessionSnap: await docSnap.ref.collection("sessions").get(),
    })));
    snapshot.studyRoomUsage.sessions = sessionCollections.flatMap(({ daySnap, sessionSnap }) => {
        var _a;
        const rawDay = daySnap.data();
        const studentId = ((_a = daySnap.ref.parent.parent) === null || _a === void 0 ? void 0 : _a.id) || String(rawDay.studentId || "");
        const dateKey = typeof rawDay.dateKey === "string" ? rawDay.dateKey : daySnap.id;
        return sessionSnap.docs.map((docSnap) => pickFields(docSnap.data(), SESSION_FIELDS, {
            id: docSnap.id,
            studentId,
            dateKey,
        }));
    });
    const latestRiskCacheDoc = riskCacheSnap.docs[0];
    snapshot.derived.riskCache = latestRiskCacheDoc
        ? pickFields(latestRiskCacheDoc.data(), RISK_CACHE_FIELDS, {
            id: latestRiskCacheDoc.id,
        })
        : null;
    const latestClassroomSignalsDoc = classroomSignalsSnap.docs[0];
    snapshot.derived.classroomSignals = latestClassroomSignalsDoc
        ? pickFields(latestClassroomSignalsDoc.data(), CLASSROOM_SIGNAL_FIELDS, {
            id: latestClassroomSignalsDoc.id,
        })
        : null;
    return {
        snapshot,
        recordCounts: summarizeRecordCounts(snapshot),
        generatedAtDate,
    };
}
async function setIntegrationState(ref, payload) {
    const nextPayload = Object.fromEntries(Object.entries(Object.assign(Object.assign({}, payload), { schemaVersion: exports.OPENCLAW_SCHEMA_VERSION })).filter(([, value]) => value !== undefined));
    await ref.set(nextPayload, { merge: true });
}
async function markOpenClawExportStarted(params) {
    const { db, centerId, requestedBy, enableOnRequest = false } = params;
    const integrationRef = db.doc(`centers/${centerId}/integrations/openclaw`);
    const nowTs = admin.firestore.Timestamp.now();
    await db.runTransaction(async (transaction) => {
        var _a, _b;
        const integrationSnap = await transaction.get(integrationRef);
        const existing = (integrationSnap.exists ? integrationSnap.data() : {});
        const enabled = existing.enabled === true || enableOnRequest;
        const lastRequestedAt = ((_b = (_a = existing.lastRequestedAt) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) || 0;
        const isFreshExport = existing.status === "exporting" && Date.now() - lastRequestedAt < OPENCLAW_EXPORT_STALE_MS;
        if (isFreshExport) {
            throw new OpenClawExportInProgressError();
        }
        transaction.set(integrationRef, {
            enabled,
            status: "exporting",
            lastRequestedAt: nowTs,
            lastRequestedBy: requestedBy,
            schemaVersion: exports.OPENCLAW_SCHEMA_VERSION,
        }, { merge: true });
    });
    return integrationRef;
}
async function writeSnapshotFiles(params) {
    const { centerId, generatedAt, snapshot } = params;
    const latestObjectPath = buildOpenClawLatestPath(centerId);
    const historyObjectPath = buildOpenClawHistoryPath(centerId, generatedAt);
    const payload = JSON.stringify(snapshot, null, 2);
    const bucket = admin.storage().bucket();
    await Promise.all([
        bucket.file(latestObjectPath).save(payload, {
            resumable: false,
            contentType: "application/json; charset=utf-8",
            metadata: {
                cacheControl: "private, max-age=0, no-transform",
            },
        }),
        bucket.file(historyObjectPath).save(payload, {
            resumable: false,
            contentType: "application/json; charset=utf-8",
            metadata: {
                cacheControl: "private, max-age=0, no-transform",
            },
        }),
    ]);
    return {
        latestObjectPath,
        historyObjectPath,
    };
}
async function executeOpenClawSnapshotExport(params) {
    const { db, centerId, requestedBy, enableOnRequest = false } = params;
    const integrationRef = await markOpenClawExportStarted({
        db,
        centerId,
        requestedBy,
        enableOnRequest,
    });
    try {
        const buildResult = await buildOpenClawSnapshot({ db, centerId });
        const filePaths = await writeSnapshotFiles({
            centerId,
            generatedAt: buildResult.generatedAtDate,
            snapshot: buildResult.snapshot,
        });
        const exportedAt = admin.firestore.Timestamp.fromDate(buildResult.generatedAtDate);
        await setIntegrationState(integrationRef, {
            enabled: true,
            status: "success",
            lastExportedAt: exportedAt,
            lastSnapshotPath: filePaths.historyObjectPath,
            lastErrorAt: null,
            lastErrorMessage: null,
        });
        return {
            generatedAt: buildResult.generatedAtDate.toISOString(),
            objectPath: filePaths.historyObjectPath,
            latestObjectPath: filePaths.latestObjectPath,
            recordCounts: buildResult.recordCounts,
        };
    }
    catch (error) {
        if (error instanceof OpenClawExportInProgressError) {
            throw error;
        }
        await setIntegrationState(integrationRef, {
            enabled: enableOnRequest ? true : undefined,
            status: "error",
            lastErrorAt: admin.firestore.Timestamp.now(),
            lastErrorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}
//# sourceMappingURL=openclawSnapshot.js.map