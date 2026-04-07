import * as admin from "firebase-admin";

export const OPENCLAW_SCHEMA_VERSION = "openclaw-snapshot.v1";
export const OPENCLAW_TIMEZONE = "Asia/Seoul";

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

type SnapshotRecord = Record<string, unknown>;

export type OpenClawExportStatus = "idle" | "exporting" | "success" | "error";

export interface OpenClawIntegrationState {
  enabled?: boolean;
  status?: OpenClawExportStatus;
  lastRequestedAt?: admin.firestore.Timestamp | null;
  lastRequestedBy?: string | null;
  lastExportedAt?: admin.firestore.Timestamp | null;
  lastSnapshotPath?: string | null;
  lastErrorAt?: admin.firestore.Timestamp | null;
  lastErrorMessage?: string | null;
  schemaVersion?: string | null;
}

export interface OpenClawSnapshotWindows {
  attendance: {
    fromDateKey: string;
    toDateKey: string;
    days: number;
  };
  consultations: {
    logsFromISO: string;
    logsToISO: string;
    reservationsFromISO: string;
    reservationsToISO: string;
  };
  billing: {
    invoicesFromISO: string;
    paymentsFromISO: string;
    kpiFromDateKey: string;
    kpiToDateKey: string;
  };
  studyRoomUsage: {
    fromDateKey: string;
    toDateKey: string;
    sessionFromDateKey: string;
    sessionToDateKey: string;
  };
  derived: {
    kpiFromDateKey: string;
    kpiToDateKey: string;
    latestOnly: string[];
  };
}

export interface OpenClawSnapshotV1 {
  schemaVersion: string;
  centerId: string;
  generatedAt: string;
  timezone: string;
  windows: OpenClawSnapshotWindows;
  students: {
    memberships: SnapshotRecord[];
    profiles: SnapshotRecord[];
    growthProgress: SnapshotRecord[];
  };
  attendance: {
    records: SnapshotRecord[];
    schedules: SnapshotRecord[];
    currentSeats: SnapshotRecord[];
  };
  consultations: {
    logs: SnapshotRecord[];
    reservations: SnapshotRecord[];
  };
  billing: {
    invoices: SnapshotRecord[];
    payments: SnapshotRecord[];
    kpiDaily: SnapshotRecord[];
  };
  studyRoomUsage: {
    dailyStudentStats: SnapshotRecord[];
    studyLogDays: SnapshotRecord[];
    sessions: SnapshotRecord[];
  };
  derived: {
    riskCache: SnapshotRecord | null;
    classroomSignals: SnapshotRecord | null;
    kpiDaily: SnapshotRecord[];
  };
}

export interface OpenClawSnapshotRecordCounts {
  students: {
    memberships: number;
    profiles: number;
    growthProgress: number;
  };
  attendance: {
    records: number;
    schedules: number;
    currentSeats: number;
  };
  consultations: {
    logs: number;
    reservations: number;
  };
  billing: {
    invoices: number;
    payments: number;
    kpiDaily: number;
  };
  studyRoomUsage: {
    dailyStudentStats: number;
    studyLogDays: number;
    sessions: number;
  };
  derived: {
    riskCache: number;
    classroomSignals: number;
    kpiDaily: number;
  };
}

export interface OpenClawExportResult {
  generatedAt: string;
  objectPath: string;
  latestObjectPath: string;
  recordCounts: OpenClawSnapshotRecordCounts;
}

type SnapshotBuildResult = {
  snapshot: OpenClawSnapshotV1;
  recordCounts: OpenClawSnapshotRecordCounts;
  generatedAtDate: Date;
};

type ExecuteOpenClawSnapshotExportParams = {
  db: admin.firestore.Firestore;
  centerId: string;
  requestedBy: string;
  enableOnRequest?: boolean;
};

export class OpenClawExportInProgressError extends Error {
  constructor(message = "An OpenClaw export is already running.") {
    super(message);
    this.name = "OpenClawExportInProgressError";
  }
}

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
] as const;

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
] as const;

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
] as const;

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
] as const;

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
] as const;

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
] as const;

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
] as const;

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
] as const;

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
] as const;

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
] as const;

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
] as const;

const DAILY_STUDENT_STAT_FIELDS = [
  "centerId",
  "studentId",
  "dateKey",
  "todayPlanCompletionRate",
  "totalStudyMinutes",
  "studyTimeGrowthRate",
  "createdAt",
  "updatedAt",
] as const;

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
] as const;

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
] as const;

const RISK_CACHE_FIELDS = [
  "dateKey",
  "atRiskStudentIds",
  "updatedAt",
] as const;

const CLASSROOM_SIGNAL_FIELDS = [
  "dateKey",
  "updatedAt",
  "summary",
  "classSummaries",
  "seatSignals",
  "incidents",
] as const;

function toKstCalendarDate(baseDate: Date = new Date()): Date {
  return new Date(baseDate.getTime() + OPENCLAW_KST_OFFSET_MS);
}

function toKstDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addUtcDays(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + delta);
  return next;
}

function addDays(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

function buildPastDateKeys(nowKstCalendar: Date, days: number): string[] {
  return Array.from({ length: days }, (_value, index) => {
    return toKstDateKey(addUtcDays(nowKstCalendar, -(days - index - 1)));
  });
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function toIsoString(value: unknown): string | null {
  if (!value) return null;
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
    const maybeValue = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
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

export function serializeSnapshotValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  const isoString = toIsoString(value);
  if (isoString) return isoString;
  if (Array.isArray(value)) {
    return value
      .map((entry) => serializeSnapshotValue(entry))
      .filter((entry) => entry !== undefined);
  }
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
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

export function isDateKeyInRange(dateKey: string, fromDateKey: string, toDateKey: string): boolean {
  return Boolean(dateKey) && dateKey >= fromDateKey && dateKey <= toDateKey;
}

export function buildOpenClawHistoryPath(centerId: string, generatedAt: Date): string {
  const kstDate = toKstCalendarDate(generatedAt);
  const year = String(kstDate.getUTCFullYear());
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kstDate.getUTCDate()).padStart(2, "0");
  const hh = String(kstDate.getUTCHours()).padStart(2, "0");
  const mm = String(kstDate.getUTCMinutes()).padStart(2, "0");
  const ss = String(kstDate.getUTCSeconds()).padStart(2, "0");
  return `openclaw/centers/${centerId}/history/${year}/${month}/${day}/${hh}${mm}${ss}.json`;
}

function buildOpenClawLatestPath(centerId: string): string {
  return `openclaw/centers/${centerId}/latest.json`;
}

function pickFields(
  source: Record<string, unknown>,
  fields: readonly string[],
  extras?: Record<string, unknown>
): SnapshotRecord {
  const record: SnapshotRecord = {};
  for (const field of fields) {
    if (source[field] === undefined) continue;
    const serialized = serializeSnapshotValue(source[field]);
    if (serialized !== undefined) {
      record[field] = serialized;
    }
  }
  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      if (value === undefined) continue;
      const serialized = serializeSnapshotValue(value);
      if (serialized !== undefined) {
        record[key] = serialized;
      }
    }
  }
  return record;
}

function extractParentDisplayNames(
  parentMembers: SnapshotRecord[],
  studentId: string,
  studentParentUids: string[]
): string[] {
  return parentMembers
    .filter((member) => {
      const linkedStudentIds = Array.isArray(member.linkedStudentIds) ? member.linkedStudentIds : [];
      const memberId = typeof member.uid === "string" ? member.uid : "";
      return linkedStudentIds.includes(studentId) || studentParentUids.includes(memberId);
    })
    .map((member) => (typeof member.displayName === "string" ? member.displayName.trim() : ""))
    .filter((name) => name.length > 0);
}

async function fetchStudyLogDaySnapshots(params: {
  db: admin.firestore.Firestore;
  centerId: string;
  studentIds: string[];
  fromDateKey: string;
  toDateKey: string;
}): Promise<admin.firestore.QueryDocumentSnapshot[]> {
  const { db, centerId, studentIds, fromDateKey, toDateKey } = params;
  const snapshots: admin.firestore.QueryDocumentSnapshot[] = [];

  for (const studentIdChunk of chunkArray(studentIds, 24)) {
    const chunkResults = await Promise.all(
      studentIdChunk.map((studentId) =>
        db
          .collection(`centers/${centerId}/studyLogs/${studentId}/days`)
          .where("dateKey", ">=", fromDateKey)
          .where("dateKey", "<=", toDateKey)
          .get()
      )
    );

    chunkResults.forEach((snap) => {
      snapshots.push(...snap.docs);
    });
  }

  return snapshots;
}

function summarizeRecordCounts(snapshot: OpenClawSnapshotV1): OpenClawSnapshotRecordCounts {
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

export function createEmptyOpenClawSnapshot(params: {
  centerId: string;
  generatedAt: string;
  windows: OpenClawSnapshotWindows;
}): OpenClawSnapshotV1 {
  return {
    schemaVersion: OPENCLAW_SCHEMA_VERSION,
    centerId: params.centerId,
    generatedAt: params.generatedAt,
    timezone: OPENCLAW_TIMEZONE,
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

async function buildOpenClawSnapshot(params: {
  db: admin.firestore.Firestore;
  centerId: string;
}): Promise<SnapshotBuildResult> {
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

  const windows: OpenClawSnapshotWindows = {
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
  const attendanceRecordsQueries = attendanceDateKeys.map((dateKey) =>
    db.collection(`centers/${centerId}/attendanceRecords/${dateKey}/students`).get()
  );
  const dailyStudentStatsQueries = studyLogDateKeys.map((dateKey) =>
    db.collection(`centers/${centerId}/dailyStudentStats/${dateKey}/students`).get()
  );

  const [
    membersSnap,
    studentProfilesSnap,
    growthProgressSnap,
    attendanceCurrentSnap,
    schedulesSnap,
    counselingLogsSnap,
    counselingReservationsSnap,
    invoicesSnap,
    paymentsSnap,
    kpiDailySnap,
    riskCacheSnap,
    classroomSignalsSnap,
    ...datedSnaps
  ] = await Promise.all([
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

  const memberships = membersSnap.docs.map((docSnap) =>
    pickFields(docSnap.data() as Record<string, unknown>, MEMBER_FIELDS, {
      uid: docSnap.id,
    })
  );
  const parentMemberships = memberships.filter((membership) => membership.role === "parent");

  const studentMembershipIds = new Set(
    memberships
      .filter((membership) => membership.role === "student")
      .map((membership) => String(membership.uid || ""))
      .filter((uid) => uid.length > 0)
  );

  snapshot.students.memberships = memberships;
  snapshot.students.profiles = studentProfilesSnap.docs.map((docSnap) => {
    const raw = docSnap.data() as Record<string, unknown>;
    const parentUids = Array.isArray(raw.parentUids)
      ? raw.parentUids.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
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
    .map((docSnap) =>
      pickFields(docSnap.data() as Record<string, unknown>, GROWTH_PROGRESS_FIELDS, {
        studentId: docSnap.id,
      })
    );

  snapshot.attendance.records = attendanceRecordSnaps.flatMap((snap, index) =>
    snap.docs.map((docSnap) => {
      const raw = docSnap.data() as Record<string, unknown>;
      const dateKey =
        typeof raw.dateKey === "string" ? raw.dateKey : attendanceDateKeys[index] || "";
      return pickFields(raw, ATTENDANCE_RECORD_FIELDS, {
        id: docSnap.id,
        studentId: typeof raw.studentId === "string" ? raw.studentId : docSnap.id,
        dateKey,
      });
    })
  );

  snapshot.attendance.schedules = schedulesSnap.docs
    .filter((docSnap) => {
      const raw = docSnap.data() as Record<string, unknown>;
      const dateKey = typeof raw.dateKey === "string" ? raw.dateKey : docSnap.id;
      return isDateKeyInRange(dateKey, attendanceDateKeys[0], attendanceDateKeys[attendanceDateKeys.length - 1]);
    })
    .map((docSnap) => {
      const raw = docSnap.data() as Record<string, unknown>;
      return pickFields(raw, SCHEDULE_FIELDS, {
        id: docSnap.id,
        uid: typeof raw.uid === "string" ? raw.uid : docSnap.ref.parent.parent?.id || null,
      });
    });

  snapshot.attendance.currentSeats = attendanceCurrentSnap.docs.map((docSnap) =>
    pickFields(docSnap.data() as Record<string, unknown>, CURRENT_SEAT_FIELDS, {
      id: docSnap.id,
    })
  );

  snapshot.consultations.logs = counselingLogsSnap.docs.map((docSnap) =>
    pickFields(docSnap.data() as Record<string, unknown>, COUNSELING_LOG_FIELDS, {
      id: docSnap.id,
    })
  );

  snapshot.consultations.reservations = counselingReservationsSnap.docs.map((docSnap) =>
    pickFields(docSnap.data() as Record<string, unknown>, COUNSELING_RESERVATION_FIELDS, {
      id: docSnap.id,
    })
  );

  snapshot.billing.invoices = invoicesSnap.docs.map((docSnap) =>
    pickFields(docSnap.data() as Record<string, unknown>, INVOICE_FIELDS, {
      id: docSnap.id,
    })
  );

  snapshot.billing.payments = paymentsSnap.docs.map((docSnap) =>
    pickFields(docSnap.data() as Record<string, unknown>, PAYMENT_FIELDS, {
      id: docSnap.id,
    })
  );

  const kpiDailyRecords = kpiDailySnap.docs.map((docSnap) =>
    pickFields(docSnap.data() as Record<string, unknown>, KPI_FIELDS, {
      id: docSnap.id,
    })
  );
  snapshot.billing.kpiDaily = kpiDailyRecords;
  snapshot.derived.kpiDaily = kpiDailyRecords;

  snapshot.studyRoomUsage.dailyStudentStats = dailyStudentStatSnaps.flatMap((snap, index) =>
    snap.docs.map((docSnap) =>
      pickFields(docSnap.data() as Record<string, unknown>, DAILY_STUDENT_STAT_FIELDS, {
        id: docSnap.id,
        studentId: (docSnap.data() as Record<string, unknown>).studentId || docSnap.id,
        dateKey: studyLogDateKeys[index] || "",
      })
    )
  );

  const existingStudyLogDaySnaps = await fetchStudyLogDaySnapshots({
    db,
    centerId,
    studentIds,
    fromDateKey: studyLogDateKeys[0],
    toDateKey: studyLogDateKeys[studyLogDateKeys.length - 1],
  }).then((snaps) =>
    snaps.filter((docSnap) => {
      const raw = docSnap.data() as Record<string, unknown>;
      const dateKey = typeof raw.dateKey === "string" ? raw.dateKey : docSnap.id;
      return studyLogDateKeySet.has(dateKey);
    })
  );

  snapshot.studyRoomUsage.studyLogDays = existingStudyLogDaySnaps.map((docSnap) => {
    const raw = docSnap.data() as Record<string, unknown>;
    const studentId = docSnap.ref.parent.parent?.id || raw.studentId || "";
    return pickFields(raw, STUDY_LOG_DAY_FIELDS, {
      id: docSnap.id,
      studentId,
      dateKey: typeof raw.dateKey === "string" ? raw.dateKey : docSnap.id,
    });
  });

  const sessionCollections = await Promise.all(
    existingStudyLogDaySnaps
      .filter((docSnap) => {
        const raw = docSnap.data() as Record<string, unknown>;
        const dateKey = typeof raw.dateKey === "string" ? raw.dateKey : docSnap.id;
        return sessionDateKeySet.has(dateKey);
      })
      .map(async (docSnap) => ({
        daySnap: docSnap,
        sessionSnap: await docSnap.ref.collection("sessions").get(),
      }))
  );

  snapshot.studyRoomUsage.sessions = sessionCollections.flatMap(({ daySnap, sessionSnap }) => {
    const rawDay = daySnap.data() as Record<string, unknown>;
    const studentId = daySnap.ref.parent.parent?.id || String(rawDay.studentId || "");
    const dateKey = typeof rawDay.dateKey === "string" ? rawDay.dateKey : daySnap.id;
    return sessionSnap.docs.map((docSnap) =>
      pickFields(docSnap.data() as Record<string, unknown>, SESSION_FIELDS, {
        id: docSnap.id,
        studentId,
        dateKey,
      })
    );
  });

  const latestRiskCacheDoc = riskCacheSnap.docs[0];
  snapshot.derived.riskCache = latestRiskCacheDoc
    ? pickFields(latestRiskCacheDoc.data() as Record<string, unknown>, RISK_CACHE_FIELDS, {
        id: latestRiskCacheDoc.id,
      })
    : null;

  const latestClassroomSignalsDoc = classroomSignalsSnap.docs[0];
  snapshot.derived.classroomSignals = latestClassroomSignalsDoc
    ? pickFields(latestClassroomSignalsDoc.data() as Record<string, unknown>, CLASSROOM_SIGNAL_FIELDS, {
        id: latestClassroomSignalsDoc.id,
      })
    : null;

  return {
    snapshot,
    recordCounts: summarizeRecordCounts(snapshot),
    generatedAtDate,
  };
}

async function setIntegrationState(
  ref: admin.firestore.DocumentReference,
  payload: Partial<OpenClawIntegrationState>
): Promise<void> {
  const nextPayload = Object.fromEntries(
    Object.entries({
      ...payload,
      schemaVersion: OPENCLAW_SCHEMA_VERSION,
    }).filter(([, value]) => value !== undefined)
  );
  await ref.set(
    nextPayload,
    { merge: true }
  );
}

async function markOpenClawExportStarted(params: {
  db: admin.firestore.Firestore;
  centerId: string;
  requestedBy: string;
  enableOnRequest?: boolean;
}): Promise<admin.firestore.DocumentReference> {
  const { db, centerId, requestedBy, enableOnRequest = false } = params;
  const integrationRef = db.doc(`centers/${centerId}/integrations/openclaw`);
  const nowTs = admin.firestore.Timestamp.now();

  await db.runTransaction(async (transaction) => {
    const integrationSnap = await transaction.get(integrationRef);
    const existing = (integrationSnap.exists ? integrationSnap.data() : {}) as OpenClawIntegrationState;
    const enabled = existing.enabled === true || enableOnRequest;
    const lastRequestedAt = existing.lastRequestedAt?.toMillis?.() || 0;
    const isFreshExport = existing.status === "exporting" && Date.now() - lastRequestedAt < OPENCLAW_EXPORT_STALE_MS;

    if (isFreshExport) {
      throw new OpenClawExportInProgressError();
    }

    transaction.set(
      integrationRef,
      {
        enabled,
        status: "exporting" satisfies OpenClawExportStatus,
        lastRequestedAt: nowTs,
        lastRequestedBy: requestedBy,
        schemaVersion: OPENCLAW_SCHEMA_VERSION,
      },
      { merge: true }
    );
  });

  return integrationRef;
}

async function writeSnapshotFiles(params: {
  centerId: string;
  generatedAt: Date;
  snapshot: OpenClawSnapshotV1;
}): Promise<{ latestObjectPath: string; historyObjectPath: string }> {
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

export async function executeOpenClawSnapshotExport(
  params: ExecuteOpenClawSnapshotExportParams
): Promise<OpenClawExportResult> {
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
  } catch (error) {
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
