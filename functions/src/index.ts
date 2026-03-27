import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const region = "asia-northeast3";
const smsVpcConnector = "sms-egress-connector";
const smsVpcEgressSettings = "ALL_TRAFFIC" as const;
const allowedRoles = ["student", "teacher", "parent", "centerAdmin"] as const;
const adminRoles = new Set(["centerAdmin", "owner"]);
type AllowedRole = (typeof allowedRoles)[number];

type InviteDoc = {
  centerId: string;
  intendedRole: AllowedRole;
  targetClassName?: string | null;
  isActive?: boolean;
  maxUses?: number;
  usedCount?: number;
  expiresAt?: admin.firestore.Timestamp;
};

type AttendanceSmsEventType =
  | "study_start"
  | "away_start"
  | "away_end"
  | "study_end"
  | "late_alert"
  | "check_in"
  | "check_out";
type ParentSmsEventType =
  | "study_start"
  | "away_start"
  | "away_end"
  | "study_end"
  | "late_alert"
  | "weekly_report";
type SmsQueueEventType = ParentSmsEventType | "risk_alert" | "manual_note";
type SmsQueueStatus =
  | "queued"
  | "processing"
  | "sent"
  | "failed"
  | "pending_provider"
  | "cancelled"
  | "suppressed_opt_out";
type SmsProviderType = "none" | "aligo" | "custom";

type NotificationSettingsDoc = {
  smsEnabled?: boolean;
  smsProvider?: SmsProviderType;
  smsSender?: string;
  smsApiKey?: string;
  smsUserId?: string;
  smsEndpointUrl?: string;
  smsTemplateCheckIn?: string;
  smsTemplateCheckOut?: string;
  smsTemplateStudyStart?: string;
  smsTemplateAwayStart?: string;
  smsTemplateAwayEnd?: string;
  smsTemplateStudyEnd?: string;
  smsTemplateLateAlert?: string;
  smsApiKeyConfigured?: boolean;
  smsApiKeyLastUpdatedAt?: admin.firestore.Timestamp;
  lateAlertEnabled?: boolean;
  lateAlertGraceMinutes?: number;
  defaultArrivalTime?: string;
};

type SmsRecipient = {
  parentUid: string;
  parentName: string | null;
  phoneNumber: string;
};

type SmsRecipientPreferenceDoc = {
  studentId: string;
  studentName?: string;
  parentUid: string;
  parentName?: string | null;
  phoneNumber?: string;
  enabled?: boolean;
  eventToggles?: Partial<Record<ParentSmsEventType, boolean>>;
  updatedAt?: admin.firestore.Timestamp;
  updatedBy?: string;
};

type SmsDeliveryLogStatus = "sent" | "failed" | "suppressed_opt_out";

type SmsDispatchResult =
  | {
      ok: true;
      providerMessageId?: string | null;
      responseSummary?: string | null;
    }
  | {
      ok: false;
      code: string;
      message: string;
      responseSummary?: string | null;
    };

const SMS_BYTE_LIMIT = 90;
const STUDENT_SMS_FALLBACK_UID = "__student__";

const DEFAULT_SMS_TEMPLATES: Record<"study_start" | "away_start" | "away_end" | "study_end" | "late_alert", string> = {
  study_start: "[{centerName}] {studentName} 학생 {time} 공부시작. 오늘 학습 흐름 확인 부탁드립니다.",
  away_start: "[{centerName}] {studentName} 학생 {time} 외출. 복귀 후 다시 공부를 이어갑니다.",
  away_end: "[{centerName}] {studentName} 학생 {time} 복귀. 다시 공부를 시작했습니다.",
  study_end: "[{centerName}] {studentName} 학생 {time} 공부종료. 오늘 학습 마무리했습니다.",
  late_alert: "{studentName}학생이 {expectedTime}까지 등원하지 않았습니다.",
};

function normalizePhoneNumber(raw: unknown): string {
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("01")) return digits;
  if (digits.length === 10 && digits.startsWith("01")) return digits;
  return "";
}

function resolveFirstValidPhoneNumber(...values: unknown[]): string {
  for (const value of values) {
    const normalized = normalizePhoneNumber(value);
    if (normalized) return normalized;
  }
  return "";
}

function toKstDate(baseDate: Date = new Date()): Date {
  const formatted = baseDate.toLocaleString("en-US", { timeZone: "Asia/Seoul" });
  return new Date(formatted);
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeLabel(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function parseHourMinute(value: unknown): { hour: number; minute: number } | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalized)) return null;
  const [hour, minute] = normalized.split(":").map((part) => Number(part));
  return { hour, minute };
}

function normalizeMembershipStatus(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function isActiveMembershipStatus(value: unknown): boolean {
  const normalized = normalizeMembershipStatus(value);
  return !normalized || normalized === "active";
}

function normalizeStudentMembershipStatusForWrite(value: unknown): "active" | "onHold" | "withdrawn" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "active") return "active";
  if (normalized === "onhold" || normalized === "on_hold" || normalized === "pending") return "onHold";
  if (normalized === "withdrawn" || normalized === "inactive") return "withdrawn";
  return null;
}

type CenterMembershipLookup = {
  role: string | null;
  status: unknown;
};

async function resolveCenterMembershipRole(
  db: admin.firestore.Firestore,
  centerId: string,
  uid: string
): Promise<CenterMembershipLookup> {
  const [memberSnap, userCenterSnap] = await Promise.all([
    db.doc(`centers/${centerId}/members/${uid}`).get(),
    db.doc(`userCenters/${uid}/centers/${centerId}`).get(),
  ]);

  const memberData = memberSnap.exists ? (memberSnap.data() as any) : null;
  const memberRole = typeof memberData?.role === "string" ? memberData.role.trim() : "";
  if (memberRole && isActiveMembershipStatus(memberData?.status)) {
    return {
      role: memberRole,
      status: memberData?.status,
    };
  }

  const userCenterData = userCenterSnap.exists ? (userCenterSnap.data() as any) : null;
  const userCenterRole = typeof userCenterData?.role === "string" ? userCenterData.role.trim() : "";
  if (userCenterRole && isActiveMembershipStatus(userCenterData?.status)) {
    return {
      role: userCenterRole,
      status: userCenterData?.status,
    };
  }

  if (memberRole) {
    return {
      role: memberRole,
      status: memberData?.status,
    };
  }

  if (userCenterRole) {
    return {
      role: userCenterRole,
      status: userCenterData?.status,
    };
  }

  return { role: null, status: null };
}

function normalizeParentLinkCodeValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value)).trim();
  }
  return "";
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

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function normalizeStatsPayload(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const keys = ["focus", "consistency", "achievement", "resilience"] as const;
  const result: Record<string, number> = {};
  let hasAny = false;

  for (const key of keys) {
    const parsed = parseFiniteNumber(source[key]);
    if (parsed === null) continue;
    result[key] = Math.max(0, Math.min(100, parsed));
    hasAny = true;
  }

  return hasAny ? result : null;
}

type ClassroomSignalRiskLevel = "stable" | "watch" | "risk" | "critical";
type ClassroomSignalOverlayFlag =
  | "risk"
  | "penalty"
  | "minutes"
  | "counseling"
  | "report"
  | "away_long"
  | "late_or_absent";
type ClassroomSignalPriority = "low" | "medium" | "high" | "critical";
type ClassroomSignalIncidentType =
  | "risk"
  | "away_long"
  | "late_or_absent"
  | "penalty_threshold"
  | "unread_report"
  | "counseling_pending";

type ClassroomSignalSummary = {
  studying: number;
  awayLong: number;
  lateOrAbsent: number;
  atRisk: number;
  unreadReports: number;
  counselingPending: number;
};

type ClassroomSignalClassSummary = {
  className: string;
  occupancyRate: number;
  avgMinutes: number;
  riskCount: number;
  awayLongCount: number;
  pendingCounselingCount: number;
};

type ClassroomSignalSeat = {
  studentId: string;
  seatId: string;
  overlayFlags: ClassroomSignalOverlayFlag[];
  todayMinutes: number;
  riskLevel: ClassroomSignalRiskLevel;
  effectivePenaltyPoints: number;
  hasUnreadReport: boolean;
  hasCounselingToday: boolean;
};

type ClassroomSignalIncident = {
  type: ClassroomSignalIncidentType;
  priority: ClassroomSignalPriority;
  studentId: string;
  studentName: string;
  seatId: string;
  className: string;
  reason: string;
  occurredAt: admin.firestore.Timestamp;
  actionTarget: string;
};

type ClassroomSignalsPayload = {
  updatedAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
  dateKey: string;
  summary: ClassroomSignalSummary;
  classSummaries: ClassroomSignalClassSummary[];
  seatSignals: ClassroomSignalSeat[];
  incidents: ClassroomSignalIncident[];
};

type ClassroomSignalStudentContext = {
  studentId: string;
  studentName: string;
  className: string;
  seatId: string;
  seatNo: number;
  seatStatus: string;
  lastCheckInAt: admin.firestore.Timestamp | null;
  expectedArrivalTime: string | null;
  targetDailyMinutes: number;
  todayMinutes: number;
  riskCacheAtRisk: boolean;
  effectivePenaltyPoints: number;
  unreadReport: boolean;
  counselingToday: boolean;
  awayLong: boolean;
  lateOrAbsent: boolean;
  riskLevel: ClassroomSignalRiskLevel;
  overlayFlags: ClassroomSignalOverlayFlag[];
  occurredAt: admin.firestore.Timestamp;
};

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toTimestampOrNow(value: unknown): admin.firestore.Timestamp | null {
  if (!value) return null;
  if (value instanceof admin.firestore.Timestamp) return value;
  if (value instanceof Date) return admin.firestore.Timestamp.fromDate(value);
  if (typeof value === "object" && value !== null) {
    const maybeTs = value as { toDate?: () => Date; toMillis?: () => number };
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

function asTrimmedString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function safeAverageMinutes(values: number[]): number {
  return values.length === 0 ? 0 : Math.round(average(values));
}

function parseExpectedArrivalMinutes(value: unknown, fallback: string): number | null {
  const parsed = parseHourMinute(typeof value === "string" && value.trim().length > 0 ? value : fallback);
  if (!parsed) return null;
  return parsed.hour * 60 + parsed.minute;
}

function sortByPriority(a: ClassroomSignalIncident, b: ClassroomSignalIncident): number {
  const priorityWeight: Record<ClassroomSignalPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const priorityDiff = priorityWeight[a.priority] - priorityWeight[b.priority];
  if (priorityDiff !== 0) return priorityDiff;
  return toMillisSafe(b.occurredAt) - toMillisSafe(a.occurredAt);
}

function toMillisSafe(value: unknown): number {
  if (!value) return 0;
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
    const maybeTs = value as { toMillis?: () => number };
    if (typeof maybeTs.toMillis === "function") {
      const millis = maybeTs.toMillis();
      return Number.isFinite(millis) ? millis : 0;
    }
  }
  return 0;
}

function applyTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((acc, [key, value]) => {
    return acc.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }, template);
}

function normalizeSmsEventType(eventType: AttendanceSmsEventType): "study_start" | "away_start" | "away_end" | "study_end" | "late_alert" {
  if (eventType === "check_in") return "study_start";
  if (eventType === "check_out") return "study_end";
  return eventType;
}

function getDefaultSmsEventToggles(): Record<ParentSmsEventType, boolean> {
  return {
    study_start: true,
    away_start: true,
    away_end: true,
    study_end: true,
    late_alert: true,
    weekly_report: true,
  };
}

function normalizeSmsEventToggles(value: unknown): Record<ParentSmsEventType, boolean> {
  const defaults = getDefaultSmsEventToggles();
  if (!value || typeof value !== "object") return defaults;
  const source = value as Record<string, unknown>;
  return {
    study_start: source.study_start !== false,
    away_start: source.away_start !== false,
    away_end: source.away_end !== false,
    study_end: source.study_end !== false,
    late_alert: source.late_alert !== false,
    weekly_report: source.weekly_report !== false,
  };
}

function buildSmsRecipientPreferenceId(studentId: string, parentUid: string): string {
  return `${studentId}_${parentUid}`;
}

function toTimestampDate(
  value: admin.firestore.Timestamp | Date | string | null | undefined
): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof (value as admin.firestore.Timestamp).toDate === "function") {
    return (value as admin.firestore.Timestamp).toDate();
  }
  return null;
}

function getNextRetryDelayMinutes(attemptCount: number): number | null {
  if (attemptCount <= 1) return 1;
  if (attemptCount === 2) return 5;
  if (attemptCount === 3) return 15;
  return null;
}

function calculateSmsBytes(message: string): number {
  return Array.from(message || "").reduce((sum, char) => {
    const code = char.charCodeAt(0);
    return sum + (code <= 0x007f ? 1 : 2);
  }, 0);
}

function trimSmsToByteLimit(message: string, limit = SMS_BYTE_LIMIT): string {
  let result = "";
  for (const char of Array.from(message || "")) {
    const candidate = result + char;
    if (calculateSmsBytes(candidate) > limit) break;
    result = candidate;
  }
  return result.trim();
}

function sanitizeSmsTemplate(template: string): string {
  return String(template || "")
    .replace(/[^\u0020-\u007E\u00A0-\u00FF\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadCenterName(
  db: admin.firestore.Firestore,
  centerId: string
): Promise<string> {
  try {
    const centerSnap = await db.doc(`centers/${centerId}`).get();
    const name = centerSnap.data()?.name;
    return typeof name === "string" && name.trim().length > 0 ? name.trim() : "센터";
  } catch {
    return "센터";
  }
}

function resolveTemplateByEvent(
  settings: NotificationSettingsDoc,
  eventType: "study_start" | "away_start" | "away_end" | "study_end" | "late_alert"
): string {
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

function buildSmsDedupeKey(params: {
  centerId: string;
  studentId: string;
  eventType: "study_start" | "away_start" | "away_end" | "study_end" | "late_alert";
  eventAt: Date;
}): string {
  const dateKey = toDateKey(params.eventAt);
  const minuteKey = `${String(params.eventAt.getHours()).padStart(2, "0")}${String(params.eventAt.getMinutes()).padStart(2, "0")}`;
  if (params.eventType === "study_start" || params.eventType === "study_end" || params.eventType === "late_alert") {
    return `${params.centerId}_${params.studentId}_${params.eventType}_${dateKey}`;
  }
  return `${params.centerId}_${params.studentId}_${params.eventType}_${dateKey}_${minuteKey}`;
}

function buildSmsQueueInitialStatus(settings: NotificationSettingsDoc): {
  status: SmsQueueStatus;
  providerStatus: string;
} {
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

async function appendSmsDeliveryLog(
  db: admin.firestore.Firestore,
  params: {
    centerId: string;
    queueId?: string | null;
    studentId?: string | null;
    studentName?: string | null;
    parentUid?: string | null;
    parentName?: string | null;
    phoneNumber?: string | null;
    eventType: SmsQueueEventType;
    renderedMessage: string;
    messageBytes: number;
    provider?: string | null;
    attemptNo?: number | null;
    status: SmsDeliveryLogStatus;
    createdAt?: admin.firestore.Timestamp;
    sentAt?: admin.firestore.Timestamp | null;
    failedAt?: admin.firestore.Timestamp | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    suppressedReason?: string | null;
  }
): Promise<void> {
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

async function loadNotificationSettings(
  db: admin.firestore.Firestore,
  centerId: string
): Promise<NotificationSettingsDoc> {
  const settingsSnap = await db.doc(`centers/${centerId}/settings/notifications`).get();
  if (!settingsSnap.exists) return {};
  return (settingsSnap.data() || {}) as NotificationSettingsDoc;
}

function validateSmsTemplateLength(template: string, fieldLabel: string) {
  const sanitized = sanitizeSmsTemplate(template);
  if (!sanitized) return "";
  const bytes = calculateSmsBytes(sanitized);
  if (bytes > SMS_BYTE_LIMIT) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `${fieldLabel} exceeds ${SMS_BYTE_LIMIT} bytes.`,
      { userMessage: `${fieldLabel} 문구가 90byte를 넘었습니다.` }
    );
  }
  return sanitized;
}

async function collectParentRecipients(
  db: admin.firestore.Firestore,
  centerId: string,
  studentId: string
): Promise<SmsRecipient[]> {
  const studentSnap = await db.doc(`centers/${centerId}/students/${studentId}`).get();
  if (!studentSnap.exists) return [];

  const parentUidsRaw = studentSnap.data()?.parentUids;
  const parentUids = Array.isArray(parentUidsRaw)
    ? parentUidsRaw.filter((uid): uid is string => typeof uid === "string" && uid.trim().length > 0)
    : [];

  const recipients: SmsRecipient[] = [];
  const usedPhones = new Set<string>();

  for (const parentUid of parentUids) {
    const [userSnap, memberSnap] = await Promise.all([
      db.doc(`users/${parentUid}`).get(),
      db.doc(`centers/${centerId}/members/${parentUid}`).get(),
    ]);

    const userData = userSnap.exists ? userSnap.data() : null;
    const memberData = memberSnap.exists ? memberSnap.data() : null;
    const phoneNumber = resolveFirstValidPhoneNumber(
      userData?.phoneNumber,
      memberData?.phoneNumber
    );
    if (!phoneNumber || usedPhones.has(phoneNumber)) continue;

    recipients.push({
      parentUid,
      parentName: (memberData?.displayName as string | null) || (userData?.displayName as string | null) || null,
      phoneNumber,
    });
    usedPhones.add(phoneNumber);
  }

  if (recipients.length > 0) {
    return recipients;
  }

  const [studentUserSnap, studentMemberSnap] = await Promise.all([
    db.doc(`users/${studentId}`).get(),
    db.doc(`centers/${centerId}/members/${studentId}`).get(),
  ]);
  const fallbackPhoneNumber = resolveFirstValidPhoneNumber(
    studentSnap.data()?.phoneNumber,
    studentUserSnap.data()?.phoneNumber,
    studentMemberSnap.data()?.phoneNumber
  );

  if (fallbackPhoneNumber) {
    recipients.push({
      parentUid: STUDENT_SMS_FALLBACK_UID,
      parentName: "학생 본인",
      phoneNumber: fallbackPhoneNumber,
    });
  }

  return recipients;
}

async function splitRecipientsBySmsPreference(
  db: admin.firestore.Firestore,
  centerId: string,
  studentId: string,
  studentName: string,
  eventType: ParentSmsEventType | null,
  recipients: SmsRecipient[]
): Promise<{
  allowedRecipients: SmsRecipient[];
  suppressedRecipients: Array<SmsRecipient & { suppressedReason: string }>;
}> {
  if (recipients.length === 0) {
    return { allowedRecipients: [], suppressedRecipients: [] };
  }

  const prefRefs = recipients.map((recipient) =>
    db.doc(`centers/${centerId}/smsRecipientPreferences/${buildSmsRecipientPreferenceId(studentId, recipient.parentUid)}`)
  );
  const prefSnaps = prefRefs.length > 0 ? await db.getAll(...prefRefs) : [];
  const prefMap = new Map<string, SmsRecipientPreferenceDoc>();
  prefSnaps.forEach((snap) => {
    if (snap.exists) {
      prefMap.set(snap.id, (snap.data() || {}) as SmsRecipientPreferenceDoc);
    }
  });

  const allowedRecipients: SmsRecipient[] = [];
  const suppressedRecipients: Array<SmsRecipient & { suppressedReason: string }> = [];

  for (const recipient of recipients) {
    const prefId = buildSmsRecipientPreferenceId(studentId, recipient.parentUid);
    const pref = prefMap.get(prefId);
    const enabled = pref?.enabled !== false;
    const toggles = normalizeSmsEventToggles(pref?.eventToggles);
    const eventEnabled = eventType ? toggles[eventType] !== false : true;

    if (!enabled) {
      suppressedRecipients.push({
        ...recipient,
        suppressedReason: "recipient_disabled",
      });
      continue;
    }

    if (!eventEnabled && eventType) {
      suppressedRecipients.push({
        ...recipient,
        suppressedReason: `event_${eventType}_disabled`,
      });
      continue;
    }

    allowedRecipients.push(recipient);

    if (!pref) {
      continue;
    }

    const needsRefresh =
      pref.studentName !== studentName ||
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

async function queueParentSmsNotification(
  db: admin.firestore.Firestore,
  params: {
    centerId: string;
    studentId: string;
    studentName: string;
    eventType: AttendanceSmsEventType;
    eventAt: Date;
    expectedTime?: string;
    settings?: NotificationSettingsDoc;
  }
): Promise<{ queuedCount: number; recipientCount: number; message: string }> {
  const {
    centerId,
    studentId,
    studentName,
    eventType: rawEventType,
    eventAt,
    expectedTime,
  } = params;
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

  const { allowedRecipients, suppressedRecipients } = await splitRecipientsBySmsPreference(
    db,
    centerId,
    studentId,
    studentName,
    eventType,
    recipients
  );

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

  await Promise.all(
    suppressedRecipients.map((recipient) =>
      appendSmsDeliveryLog(db, {
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
      })
    )
  );

  return { queuedCount: allowedRecipients.length, recipientCount: recipients.length, message };
}

async function queueManualStudentSms(
  db: admin.firestore.Firestore,
  params: {
    centerId: string;
    studentId: string;
    studentName: string;
    message: string;
    settings?: NotificationSettingsDoc;
  }
): Promise<{ queuedCount: number; recipientCount: number; message: string }> {
  const { centerId, studentId, studentName } = params;
  const settings = params.settings || await loadNotificationSettings(db, centerId);
  const recipients = await collectParentRecipients(db, centerId, studentId);
  const message = trimSmsToByteLimit(asTrimmedString(params.message));
  if (!message) {
    return { queuedCount: 0, recipientCount: 0, message: "" };
  }
  if (recipients.length === 0) {
    return { queuedCount: 0, recipientCount: 0, message };
  }

  const { allowedRecipients, suppressedRecipients } = await splitRecipientsBySmsPreference(
    db,
    centerId,
    studentId,
    studentName,
    null,
    recipients
  );

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

  await Promise.all(
    suppressedRecipients.map((recipient) =>
      appendSmsDeliveryLog(db, {
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
      })
    )
  );

  return { queuedCount: allowedRecipients.length, recipientCount: recipients.length, message };
}

async function runLateArrivalCheckForCenter(
  db: admin.firestore.Firestore,
  centerId: string,
  nowKst: Date,
  attendanceSnap: admin.firestore.QuerySnapshot
): Promise<number> {
  const settings = await loadNotificationSettings(db, centerId);
  if (settings.lateAlertEnabled === false) return 0;

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

  if (membersSnap.empty) return 0;

  const checkedInStudentIds = new Set<string>();
  attendanceSnap.forEach((seatDoc) => {
    const seatData = seatDoc.data();
    if (!seatData?.studentId) return;
    if (seatData.status === "studying" || seatData.status === "away" || seatData.status === "break") {
      checkedInStudentIds.add(String(seatData.studentId));
    }
  });

  const studentRefs = membersSnap.docs.map((memberDoc) => db.doc(`centers/${centerId}/students/${memberDoc.id}`));
  const studentSnaps = studentRefs.length > 0 ? await db.getAll(...studentRefs) : [];
  const studentMap = new Map<string, admin.firestore.DocumentData>();
  studentSnaps.forEach((snap) => {
    if (snap.exists) studentMap.set(snap.id, snap.data() || {});
  });

  let alertsTriggered = 0;

  for (const memberDoc of membersSnap.docs) {
    const studentId = memberDoc.id;
    if (checkedInStudentIds.has(studentId)) continue;

    const studentData = studentMap.get(studentId) || {};
    const studentName = typeof studentData.name === "string" && studentData.name.trim()
      ? studentData.name.trim()
      : "학생";

    const expectedTimeRaw = studentData.expectedArrivalTime || defaultArrivalTime;
    const expectedTime = parseHourMinute(expectedTimeRaw);
    if (!expectedTime) continue;

    const thresholdMinutes = expectedTime.hour * 60 + expectedTime.minute + graceMinutes;
    if (nowMinutes < thresholdMinutes) continue;

    const lateAlertRef = db.doc(`centers/${centerId}/lateAlerts/${dateKey}_${studentId}`);
    const alreadySentSnap = await lateAlertRef.get();
    if (alreadySentSnap.exists) continue;

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

function summarizeProviderResponse(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    return value.slice(0, 300);
  }
  try {
    return JSON.stringify(value).slice(0, 300);
  } catch {
    return String(value).slice(0, 300);
  }
}

async function sendSmsViaAligo(params: {
  apiKey: string;
  userId: string;
  sender: string;
  receiver: string;
  message: string;
}): Promise<SmsDispatchResult> {
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
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    const responseSummary = summarizeProviderResponse(parsed ?? text);
    const resultCode = String(parsed?.result_code ?? "");
    if (response.ok && resultCode === "1") {
      return {
        ok: true,
        providerMessageId: parsed?.msg_id ? String(parsed.msg_id) : null,
        responseSummary,
      };
    }

    return {
      ok: false,
      code: resultCode || `HTTP_${response.status}`,
      message: String(parsed?.message || parsed?.msg || "알리고 발송 실패"),
      responseSummary,
    };
  } catch (error: any) {
    return {
      ok: false,
      code: "ALIGO_FETCH_ERROR",
      message: error?.message || "알리고 요청 중 오류가 발생했습니다.",
    };
  }
}

async function sendSmsViaCustomEndpoint(params: {
  endpointUrl: string;
  apiKey: string;
  sender: string | null;
  receiver: string;
  message: string;
  centerId: string;
  studentId?: string | null;
  eventType?: string | null;
}): Promise<SmsDispatchResult> {
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
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    const responseSummary = summarizeProviderResponse(parsed ?? text);
    const isOk = response.ok && parsed?.ok !== false;
    if (isOk) {
      return {
        ok: true,
        providerMessageId: parsed?.providerMessageId ? String(parsed.providerMessageId) : null,
        responseSummary,
      };
    }

    return {
      ok: false,
      code: String(parsed?.code || `HTTP_${response.status}`),
      message: String(parsed?.message || "사용자 엔드포인트 발송 실패"),
      responseSummary,
    };
  } catch (error: any) {
    return {
      ok: false,
      code: "CUSTOM_FETCH_ERROR",
      message: error?.message || "사용자 엔드포인트 요청 중 오류가 발생했습니다.",
    };
  }
}

async function dispatchSmsQueueItem(
  db: admin.firestore.Firestore,
  centerId: string,
  queueRef: admin.firestore.DocumentReference,
  queueData: Record<string, any>,
  attemptCount: number
): Promise<void> {
  const nowTs = admin.firestore.Timestamp.now();
  const settings = await loadNotificationSettings(db, centerId);
  const provider = (settings.smsProvider || queueData.provider || "none") as SmsProviderType;
  const sender = asTrimmedString(settings.smsSender || queueData.sender || "");
  const receiver = normalizePhoneNumber(queueData.phoneNumber || queueData.to || "");
  const message = asTrimmedString(queueData.renderedMessage || queueData.message || "");
  const queueId = queueRef.id;
  const studentId = asTrimmedString(queueData.studentId);
  const studentName = asTrimmedString(queueData.studentName || queueData?.metadata?.studentName, "학생");
  const parentUid = asTrimmedString(queueData.parentUid);
  const parentName = asTrimmedString(queueData.parentName);
  const eventType = String(queueData.eventType || "study_start") as SmsQueueEventType;

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

  let dispatchResult: SmsDispatchResult;
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
  } else {
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
  } else {
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
function isAdminRole(role: unknown): boolean {
  return typeof role === "string" && adminRoles.has(role);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function getDocsInChunks(
  db: admin.firestore.Firestore,
  refs: admin.firestore.DocumentReference[]
): Promise<admin.firestore.DocumentSnapshot[]> {
  const snapshots: admin.firestore.DocumentSnapshot[] = [];
  for (const refsChunk of chunkArray(refs, 80)) {
    if (refsChunk.length === 0) continue;
    const chunkSnaps = await db.getAll(...refsChunk);
    snapshots.push(...chunkSnaps);
  }
  return snapshots;
}

function derivePenaltyPointsFromLogs(logs: Array<{ pointsDelta?: unknown; source?: unknown; createdAt?: unknown }>): number {
  const sortedLogs = [...logs].sort((a, b) => toMillisSafe(a.createdAt) - toMillisSafe(b.createdAt));
  let total = 0;
  for (const log of sortedLogs) {
    const delta = parseFiniteNumber(log.pointsDelta);
    if (delta === null) continue;
    if (log.source === "reset") {
      total = Math.max(0, total + delta);
      continue;
    }
    total = Math.max(0, total + delta);
  }
  return Math.max(0, Math.round(total));
}

function getRiskLevelFromSignals(params: {
  riskCacheAtRisk: boolean;
  effectivePenaltyPoints: number;
  awayLong: boolean;
  lateOrAbsent: boolean;
  unreadReport: boolean;
  counselingToday: boolean;
  todayMinutes: number;
  targetDailyMinutes: number;
}): ClassroomSignalRiskLevel {
  const {
    riskCacheAtRisk,
    effectivePenaltyPoints,
    awayLong,
    lateOrAbsent,
    unreadReport,
    counselingToday,
    todayMinutes,
    targetDailyMinutes,
  } = params;

  if (effectivePenaltyPoints >= 12) return "critical";
  if (effectivePenaltyPoints >= 7 || riskCacheAtRisk || awayLong || lateOrAbsent) return "risk";
  if (unreadReport || counselingToday) return "watch";
  if (targetDailyMinutes > 0 && todayMinutes < Math.max(30, Math.round(targetDailyMinutes * 0.5))) return "watch";
  return "stable";
}

function buildOverlayFlagsFromSignals(params: {
  riskLevel: ClassroomSignalRiskLevel;
  effectivePenaltyPoints: number;
  awayLong: boolean;
  lateOrAbsent: boolean;
  unreadReport: boolean;
  counselingToday: boolean;
  todayMinutes: number;
  targetDailyMinutes: number;
}): ClassroomSignalOverlayFlag[] {
  const flags = new Set<ClassroomSignalOverlayFlag>();
  if (params.riskLevel === "risk" || params.riskLevel === "critical") flags.add("risk");
  if (params.effectivePenaltyPoints >= 7) flags.add("penalty");
  if (params.awayLong) flags.add("away_long");
  if (params.lateOrAbsent) flags.add("late_or_absent");
  if (params.unreadReport) flags.add("report");
  if (params.counselingToday) flags.add("counseling");
  if (params.targetDailyMinutes > 0 && params.todayMinutes < Math.max(30, Math.round(params.targetDailyMinutes * 0.5))) {
    flags.add("minutes");
  }
  return Array.from(flags);
}

function buildIncident(
  type: ClassroomSignalIncidentType,
  priority: ClassroomSignalPriority,
  student: ClassroomSignalStudentContext,
  reason: string,
  occurredAt: admin.firestore.Timestamp
): ClassroomSignalIncident {
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

async function buildClassroomSignalsForCenter(
  db: admin.firestore.Firestore,
  centerId: string,
  nowKst: Date,
  dateKey: string
): Promise<ClassroomSignalsPayload> {
  const settings = await loadNotificationSettings(db, centerId);
  const graceMinutes = Number.isFinite(Number(settings.lateAlertGraceMinutes))
    ? Math.max(0, Number(settings.lateAlertGraceMinutes))
    : 20;
  const defaultArrivalTime = settings.defaultArrivalTime || "17:00";
  const nowMinutes = nowKst.getHours() * 60 + nowKst.getMinutes();
  const weekAgoKey = toDateKey(new Date(nowKst.getTime() - 6 * 24 * 60 * 60 * 1000));
  const penaltyCutoff = admin.firestore.Timestamp.fromMillis(nowKst.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [membersSnap, attendanceSnap, todayStatsSnap, riskCacheSnap, counselingSnap, reportsSnap, penaltyLogsSnap] =
    await Promise.all([
      db.collection(`centers/${centerId}/members`).where("role", "==", "student").where("status", "==", "active").get(),
      db.collection(`centers/${centerId}/attendanceCurrent`).get(),
      db.collection(`centers/${centerId}/dailyStudentStats/${dateKey}/students`).get(),
      db.doc(`centers/${centerId}/riskCache/${dateKey}`).get(),
      db.collection(`centers/${centerId}/counselingReservations`).get(),
      db.collection(`centers/${centerId}/dailyReports`).where("status", "==", "sent").get(),
      db.collection(`centers/${centerId}/penaltyLogs`).where("createdAt", ">=", penaltyCutoff).get(),
    ]);

  const activeMembers: Array<Record<string, any> & { id: string }> = membersSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Record<string, any>),
  }));
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

  const studentMap = new Map<string, Record<string, any>>();
  studentSnaps.forEach((snap) => {
    if (snap.exists) studentMap.set(snap.id, snap.data() as Record<string, any>);
  });

  const progressMap = new Map<string, Record<string, any>>();
  progressSnaps.forEach((snap) => {
    if (snap.exists) progressMap.set(snap.id, snap.data() as Record<string, any>);
  });

  const attendanceByStudentId = new Map<string, Record<string, any>>();
  attendanceSnap.forEach((seatDoc) => {
    const seatData = seatDoc.data() as Record<string, any>;
    const seatStudentId = asTrimmedString(seatData?.studentId, "");
    if (seatStudentId) {
      attendanceByStudentId.set(seatStudentId, {
        id: seatDoc.id,
        ...seatData,
      });
    }
  });

  const todayStatsByStudentId = new Map<string, Record<string, any>>();
  todayStatsSnap.forEach((statDoc) => {
    const statData = statDoc.data() as Record<string, any>;
    const statStudentId = asTrimmedString(statData?.studentId, statDoc.id);
    todayStatsByStudentId.set(statStudentId, statData);
  });

  const riskCacheStudentIds = new Set<string>(Array.isArray(riskCacheSnap.data()?.atRiskStudentIds) ? riskCacheSnap.data()?.atRiskStudentIds : []);
  const riskCacheUpdatedAt = toTimestampOrNow(riskCacheSnap.data()?.updatedAt);

  const pendingCounselingByStudentId = new Map<string, Record<string, any>[]>();
  counselingSnap.forEach((reservationDoc) => {
    const reservation = reservationDoc.data() as Record<string, any>;
    const reservationStudentId = asTrimmedString(reservation?.studentId, "");
    if (!reservationStudentId) return;
    const status = asTrimmedString(reservation?.status, "");
    if (status === "done" || status === "canceled") return;
    const scheduledAt = toTimestampOrNow(reservation?.scheduledAt);
    if (!scheduledAt) return;
    if (toDateKey(toKstDate(scheduledAt.toDate())) !== dateKey) return;
    const current = pendingCounselingByStudentId.get(reservationStudentId) || [];
    current.push({
      id: reservationDoc.id,
      ...reservation,
    });
    pendingCounselingByStudentId.set(reservationStudentId, current);
  });

  const unreadReportByStudentId = new Map<string, { latest: Record<string, any>; count: number }>();
  reportsSnap.forEach((reportDoc) => {
    const report = reportDoc.data() as Record<string, any>;
    if (asTrimmedString(report?.status, "") !== "sent") return;
    const reportDateKey = asTrimmedString(report?.dateKey, "");
    if (!reportDateKey || reportDateKey < weekAgoKey || reportDateKey > dateKey) return;
    if (report?.viewedAt) return;
    const reportStudentId = asTrimmedString(report?.studentId, "");
    if (!reportStudentId) return;
    const current = unreadReportByStudentId.get(reportStudentId);
    if (!current || toMillisSafe(report.updatedAt) > toMillisSafe(current.latest.updatedAt)) {
      unreadReportByStudentId.set(reportStudentId, {
        latest: {
          id: reportDoc.id,
          ...report,
        },
        count: (current?.count || 0) + 1,
      });
    } else {
      unreadReportByStudentId.set(reportStudentId, {
        latest: current.latest,
        count: current.count + 1,
      });
    }
  });

  const penaltyLogsByStudentId = new Map<string, Record<string, any>[]>();
  penaltyLogsSnap.forEach((logDoc) => {
    const log = logDoc.data() as Record<string, any>;
    const logStudentId = asTrimmedString(log?.studentId, "");
    if (!logStudentId) return;
    const current = penaltyLogsByStudentId.get(logStudentId) || [];
    current.push({
      id: logDoc.id,
      ...log,
    });
    penaltyLogsByStudentId.set(logStudentId, current);
  });

  const contexts: ClassroomSignalStudentContext[] = activeMembers
    .map((member) => {
      const studentId = member.id;
      const student = studentMap.get(studentId) || {};
      const progress = progressMap.get(studentId) || {};
      const attendance = attendanceByStudentId.get(studentId) || null;
      const todayStats = todayStatsByStudentId.get(studentId) || {};
      const unreadReport = unreadReportByStudentId.has(studentId);
      const counselingToday = (pendingCounselingByStudentId.get(studentId) || []).length > 0;
      const studentName = asTrimmedString(student?.name, asTrimmedString(member?.displayName, "학생"));
      const className = asTrimmedString(student?.className, asTrimmedString(member?.className, "미분류"));
      const seatNo = Number.isFinite(Number(student?.seatNo)) ? Number(student.seatNo) : 0;
      const seatId = attendance?.id || (seatNo > 0 ? `seat_${String(seatNo).padStart(3, "0")}` : studentId);
      const lastCheckInAt = toTimestampOrNow(attendance?.lastCheckInAt);
      const seatStatus = asTrimmedString(attendance?.status, "absent");
      const targetDailyMinutes = Number.isFinite(Number(student?.targetDailyMinutes))
        ? Math.max(0, Number(student.targetDailyMinutes))
        : 0;
      const todayMinutes = Math.max(0, Math.round(Number(todayStats?.totalStudyMinutes || 0)));
      const penaltyLogs = penaltyLogsByStudentId.get(studentId) || [];
      const penaltyFromProgress = parseFiniteNumber(progress?.penaltyPoints);
      const effectivePenaltyPoints = penaltyFromProgress !== null
        ? Math.max(0, Math.round(penaltyFromProgress))
        : derivePenaltyPointsFromLogs(penaltyLogs);
      const awayLong = Boolean(
        lastCheckInAt &&
          (seatStatus === "away" || seatStatus === "break") &&
          Math.max(0, Math.floor((nowKst.getTime() - lastCheckInAt.toMillis()) / 60000)) >= 15
      );
      const expectedArrivalTime = asTrimmedString(student?.expectedArrivalTime, defaultArrivalTime);
      const expectedArrivalMinutes = parseExpectedArrivalMinutes(expectedArrivalTime, defaultArrivalTime);
      const hasCurrentAttendance = seatStatus === "studying" || seatStatus === "away" || seatStatus === "break";
      const lateOrAbsent = Boolean(
        expectedArrivalMinutes !== null &&
          !hasCurrentAttendance &&
          nowMinutes >= expectedArrivalMinutes + graceMinutes
      );
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
      if (awayLong && lastCheckInAt) occurredAt = lastCheckInAt;
      if (lateOrAbsent && expectedArrivalMinutes !== null) {
        const expectedDate = new Date(nowKst);
        expectedDate.setHours(Math.floor(expectedArrivalMinutes / 60), expectedArrivalMinutes % 60, 0, 0);
        occurredAt = admin.firestore.Timestamp.fromDate(expectedDate);
      }
      if (unreadReport) {
        const unreadReportRecord = unreadReportByStudentId.get(studentId)?.latest;
        const unreadTs = toTimestampOrNow(unreadReportRecord?.updatedAt || unreadReportRecord?.createdAt);
        if (unreadTs) occurredAt = unreadTs;
      }
      if (counselingToday) {
        const upcoming = (pendingCounselingByStudentId.get(studentId) || [])
          .map((reservation) => ({
            reservation,
            timestamp: toTimestampOrNow(reservation?.scheduledAt),
          }))
          .filter((item) => item.timestamp)
          .sort((a, b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0))[0];
        if (upcoming?.timestamp) occurredAt = upcoming.timestamp;
      }
      const latestPenaltyLog = penaltyLogs
        .map((log) => ({ log, timestamp: toTimestampOrNow(log?.createdAt) }))
        .filter((item) => item.timestamp)
        .sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0))[0];
      if (latestPenaltyLog?.timestamp) occurredAt = latestPenaltyLog.timestamp;

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
      if (classDiff !== 0) return classDiff;
      return a.seatNo - b.seatNo;
    });

  const classGroups = new Map<string, ClassroomSignalStudentContext[]>();
  for (const context of contexts) {
    const current = classGroups.get(context.className) || [];
    current.push(context);
    classGroups.set(context.className, current);
  }

  const summary: ClassroomSignalSummary = {
    studying: contexts.filter((context) => context.seatStatus === "studying").length,
    awayLong: contexts.filter((context) => context.awayLong).length,
    lateOrAbsent: contexts.filter((context) => context.lateOrAbsent).length,
    atRisk: contexts.filter((context) => context.riskLevel === "risk" || context.riskLevel === "critical").length,
    unreadReports: contexts.filter((context) => context.unreadReport).length,
    counselingPending: contexts.filter((context) => context.counselingToday).length,
  };

  const classSummaries: ClassroomSignalClassSummary[] = Array.from(classGroups.entries())
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

  const incidents: ClassroomSignalIncident[] = [];
  for (const context of contexts) {
    if (context.riskCacheAtRisk || context.riskLevel === "risk" || context.riskLevel === "critical") {
      incidents.push(
        buildIncident(
          "risk",
          context.riskLevel === "critical" ? "critical" : "high",
          context,
          context.riskCacheAtRisk
            ? "최근 14일 학습량이 목표 대비 부족합니다."
            : "종합 관제 기준에서 주의가 필요한 학생입니다.",
          context.occurredAt
        )
      );
    }

    if (context.awayLong) {
      incidents.push(
        buildIncident(
          "away_long",
          "high",
          context,
          "외출/휴식 상태가 15분 이상 지속되고 있습니다.",
          context.occurredAt
        )
      );
    }

    if (context.lateOrAbsent) {
      incidents.push(
        buildIncident(
          "late_or_absent",
          "high",
          context,
          `예상 등교 시간 ${context.expectedArrivalTime || defaultArrivalTime} 기준으로 미입실 상태입니다.`,
          context.occurredAt
        )
      );
    }

    if (context.effectivePenaltyPoints >= 12) {
      incidents.push(
        buildIncident(
          "penalty_threshold",
          "critical",
          context,
          `실효 벌점 ${context.effectivePenaltyPoints}점이 임계값을 넘었습니다.`,
          context.occurredAt
        )
      );
    } else if (context.effectivePenaltyPoints >= 7) {
      incidents.push(
        buildIncident(
          "penalty_threshold",
          "high",
          context,
          `실효 벌점 ${context.effectivePenaltyPoints}점이 개입 기준을 넘었습니다.`,
          context.occurredAt
        )
      );
    }

    if (context.unreadReport) {
      incidents.push(
        buildIncident(
          "unread_report",
          "medium",
          context,
          "최근 7일 발송된 리포트가 아직 열람되지 않았습니다.",
          context.occurredAt
        )
      );
    }

    if (context.counselingToday) {
      incidents.push(
        buildIncident(
          "counseling_pending",
          "medium",
          context,
          "오늘 상담이 예정되어 있습니다.",
          context.occurredAt
        )
      );
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

async function refreshClassroomSignalsForCenter(
  db: admin.firestore.Firestore,
  centerId: string,
  nowKst: Date
): Promise<ClassroomSignalsPayload> {
  const dateKey = toDateKey(nowKst);
  const payload = await buildClassroomSignalsForCenter(db, centerId, nowKst, dateKey);
  await db.doc(`centers/${centerId}/classroomSignals/${dateKey}`).set({
    ...payload,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return payload;
}

function assertInviteUsable(inv: InviteDoc, expectedRole?: AllowedRole) {
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

export const deleteStudentAccount = functions.region(region).runWith({
  timeoutSeconds: 540,
  memory: "1GB",
}).https.onCall(async (data, context) => {
  const db = admin.firestore();
  const auth = admin.auth();

  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "인증 필요");

  const { studentId, centerId } = data;
  if (!studentId || !centerId) throw new functions.https.HttpsError("invalid-argument", "ID 누락");

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
  const targetRole =
    (typeof targetMemberSnap.data()?.role === "string" ? targetMemberSnap.data()?.role : "") ||
    (typeof targetUserCenterSnap.data()?.role === "string" ? targetUserCenterSnap.data()?.role : "") ||
    (targetStudentSnap.exists ? "student" : "");
  if ((!targetMemberSnap.exists && !targetStudentSnap.exists && !targetUserCenterSnap.exists) || targetRole !== "student") {
    throw new functions.https.HttpsError("failed-precondition", "해당 센터의 학생 계정만 삭제할 수 있습니다.");
  }

  try {
    const timestamp = admin.firestore.Timestamp.now();
    const requiredErrors: string[] = [];
    const warningErrors: string[] = [];
    const parentUids = normalizeStringArray(targetStudentSnap.data()?.parentUids);

    const pushError = (bucket: string[], label: string, error: any) => {
      bucket.push(`${label}: ${error?.message || "delete failed"}`);
    };

    const deleteTree = async (
      ref: admin.firestore.DocumentReference,
      label: string,
      bucket: string[]
    ) => {
      try {
        await db.recursiveDelete(ref);
      } catch (error: any) {
        pushError(bucket, label, error);
      }
    };

    const deleteByStudentIdQuery = async (
      collectionPath: string,
      label: string,
      bucket: string[]
    ) => {
      try {
        const snap = await db.collection(collectionPath).where("studentId", "==", studentId).get();
        await Promise.all(snap.docs.map((docSnap) => db.recursiveDelete(docSnap.ref)));
      } catch (error: any) {
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
          const statDocs = statsSnap.docs.filter((docSnap) =>
            docSnap.ref.path.startsWith(`centers/${centerId}/dailyStudentStats/`) ||
            docSnap.ref.path.startsWith(`centers/${centerId}/attendanceDailyStats/`)
          );
          await Promise.all(statDocs.map((docSnap) => db.recursiveDelete(docSnap.ref)));
        } catch (error: any) {
          pushError(warningErrors, "dailyStats", error);
        }
      })(),
      (async () => {
        try {
          const leaderboardsSnap = await db.collection(`centers/${centerId}/leaderboards`).get();
          await Promise.all(
            leaderboardsSnap.docs.map(async (boardDoc) => {
              const directEntryRef = boardDoc.ref.collection("entries").doc(studentId);
              await db.recursiveDelete(directEntryRef);
              const byStudentQuery = await boardDoc.ref.collection("entries").where("studentId", "==", studentId).get();
              await Promise.all(byStudentQuery.docs.map((docSnap) => db.recursiveDelete(docSnap.ref)));
            })
          );
        } catch (error: any) {
          pushError(warningErrors, "leaderboards", error);
        }
      })(),
      (async () => {
        try {
          const seatsSnap = await db.collection(`centers/${centerId}/attendanceCurrent`).where("studentId", "==", studentId).get();
          await Promise.all(
            seatsSnap.docs.map((seatDoc) =>
              seatDoc.ref.set(
                {
                  studentId: null,
                  roomId: admin.firestore.FieldValue.delete(),
                  roomSeatNo: admin.firestore.FieldValue.delete(),
                  seatId: admin.firestore.FieldValue.delete(),
                  status: "absent",
                  updatedAt: timestamp,
                  lastCheckInAt: admin.firestore.FieldValue.delete(),
                },
                { merge: true }
              )
            )
          );
        } catch (error: any) {
          pushError(warningErrors, "attendanceCurrent", error);
        }
      })(),
      (async () => {
        try {
          if (parentUids.length === 0) return;
          const batch = db.batch();
          for (const parentUid of parentUids) {
            batch.set(
              db.doc(`centers/${centerId}/members/${parentUid}`),
              {
                linkedStudentIds: admin.firestore.FieldValue.arrayRemove(studentId),
                updatedAt: timestamp,
              },
              { merge: true }
            );
            batch.set(
              db.doc(`userCenters/${parentUid}/centers/${centerId}`),
              {
                linkedStudentIds: admin.firestore.FieldValue.arrayRemove(studentId),
                updatedAt: timestamp,
              },
              { merge: true }
            );
          }
          await batch.commit();
        } catch (error: any) {
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
        } catch (error: any) {
          pushError(warningErrors, "smsRecipientPreferences", error);
        }
      })(),
    ]);

    if (requiredErrors.length > 0) {
      throw new Error(`핵심 학생 데이터 삭제 실패 (${requiredErrors.join(" | ")})`);
    }

    try {
      await auth.deleteUser(studentId);
    } catch (e: any) {
      if (e?.code !== "auth/user-not-found") {
        throw e;
      }
    }

    return {
      ok: true,
      message: warningErrors.length > 0 ? "학생 계정은 삭제되었고, 일부 보조 기록은 후속 정리되었습니다." : "정리가 완료되었습니다.",
      warnings: warningErrors,
    };
  } catch (error: any) {
    throw new functions.https.HttpsError("internal", error?.message || "학생 계정 삭제 중 오류가 발생했습니다.", {
      userMessage: error?.message || "학생 계정 삭제 중 오류가 발생했습니다.",
    });
  }
});

export const deleteTeacherAccount = functions.region(region).runWith({
  timeoutSeconds: 540,
  memory: "1GB",
}).https.onCall(async (data, context) => {
  const db = admin.firestore();
  const auth = admin.auth();

  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "인증 필요");

  const { teacherId, centerId } = data || {};
  if (!teacherId || !centerId) {
    throw new functions.https.HttpsError("invalid-argument", "teacherId / centerId 가 필요합니다.");
  }
  if (teacherId === context.auth.uid) {
    throw new functions.https.HttpsError("failed-precondition", "본인 계정은 직접 삭제할 수 없습니다.");
  }

  const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
  if (!callerMemberSnap.exists || !isAdminRole(callerMemberSnap.data()?.role)) {
    throw new functions.https.HttpsError("permission-denied", "센터 관리자만 선생님 계정을 삭제할 수 있습니다.");
  }

  const targetMemberRef = db.doc(`centers/${centerId}/members/${teacherId}`);
  const targetMemberSnap = await targetMemberRef.get();
  if (!targetMemberSnap.exists || targetMemberSnap.data()?.role !== "teacher") {
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
      } catch (e: any) {
        if (e?.code !== "auth/user-not-found") {
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
  } catch (error: any) {
    throw new functions.https.HttpsError("internal", error?.message || "선생님 계정 삭제 중 오류가 발생했습니다.");
  }
});

export const updateStudentAccount = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();
  const auth = admin.auth();
  const {
    studentId,
    centerId,
    password,
    displayName,
    schoolName,
    grade,
    phoneNumber,
    parentLinkCode,
    className,
    memberStatus,
    seasonLp,
    stats,
    todayStudyMinutes,
    dateKey,
  } = data;

  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "인증 필요");
  if (!studentId || !centerId) throw new functions.https.HttpsError("invalid-argument", "ID 누락");

  const callerUid = context.auth.uid;
  const studentRef = db.doc(`centers/${centerId}/students/${studentId}`);
  const existingStudentSnap = await studentRef.get();
  const existingStudentData = existingStudentSnap.exists ? (existingStudentSnap.data() as any) : null;

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
  const callerMemberData = callerMemberSnap.exists ? (callerMemberSnap.data() as any) : null;
  const callerUserCenterData = callerUserCenterSnap.exists ? (callerUserCenterSnap.data() as any) : null;
  const callerMemberRole = typeof callerMemberData?.role === "string" ? callerMemberData.role.trim() : "";
  const callerUserCenterRole = typeof callerUserCenterData?.role === "string" ? callerUserCenterData.role.trim() : "";
  const callerRole = callerMembership.role || callerMemberRole || callerUserCenterRole || null;
  const callerStatus = callerMembership.status ?? callerMemberData?.status ?? callerUserCenterData?.status;
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

  const existingParentLinkCode = normalizeParentLinkCodeValue(existingStudentData?.parentLinkCode);

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
      let duplicateCandidates: FirebaseFirestore.QueryDocumentSnapshot[] = [];
      try {
        const duplicateSnap = await db
          .collectionGroup("students")
          .where("parentLinkCode", "==", normalizedParentLinkCode)
          .limit(20)
          .get();
        duplicateCandidates = duplicateSnap.docs;
      } catch (lookupError: any) {
        console.warn("[updateStudentAccount] collectionGroup duplicate lookup failed, fallback to center scoped lookup", {
          centerId,
          studentId,
          code: normalizedParentLinkCode,
          message: lookupError?.message || lookupError,
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
        if (docSnap.id === studentId) continue;

        const candidateCenterRef = docSnap.ref.parent.parent;
        if (!candidateCenterRef) continue;

        const candidateMemberSnap = await db.doc(`centers/${candidateCenterRef.id}/members/${docSnap.id}`).get();
        if (!candidateMemberSnap.exists) continue;

        const candidateMemberData = candidateMemberSnap.data() as any;
        const isActiveStudentCandidate =
          candidateMemberData?.role === "student" && isActiveMembershipStatus(candidateMemberData?.status);
        if (!isActiveStudentCandidate) continue;

        const candidateUserCenterSnap = await db.doc(`userCenters/${docSnap.id}/centers/${candidateCenterRef.id}`).get();
        const candidateUserCenterData = candidateUserCenterSnap.exists ? (candidateUserCenterSnap.data() as any) : null;
        const hasActiveUserCenter =
          candidateUserCenterSnap.exists &&
          candidateUserCenterData?.role === "student" &&
          isActiveMembershipStatus(candidateUserCenterData?.status);

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
    const hasForbiddenUpdate =
      (typeof password === "string" && password.trim().length > 0) ||
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

    const hasSelfEditableFieldInPayload =
      typeof schoolName === "string" || typeof grade === "string" || parentLinkCodeProvided || phoneNumberProvided;

    if (!hasSelfEditableFieldInPayload) {
      throw new functions.https.HttpsError("invalid-argument", "No editable field provided.", {
        userMessage: "수정할 항목을 입력해 주세요.",
      });
    }
  }

  try {
    if (isAdminCaller) {
      const authUpdates: any = {};
      if (typeof password === "string" && password.trim().length >= 6) authUpdates.password = password.trim();
      if (trimmedDisplayName) authUpdates.displayName = trimmedDisplayName;

      if (Object.keys(authUpdates).length > 0) {
        try {
          await auth.updateUser(studentId, authUpdates);
        } catch (authError: any) {
          console.warn("Auth update skipped for " + studentId + ": " + authError.message);
        }
      }
    }

    const timestamp = admin.firestore.Timestamp.now();
    const batch = db.batch();

    const userRef = db.doc("users/" + studentId);
    const userUpdate: any = { updatedAt: timestamp };
    if (trimmedDisplayName) userUpdate.displayName = trimmedDisplayName;
    if (trimmedSchoolName) userUpdate.schoolName = trimmedSchoolName;
    if (phoneNumberProvided) userUpdate.phoneNumber = normalizedPhoneNumber;
    const hasUserWrite = trimmedDisplayName.length > 0 || trimmedSchoolName.length > 0 || phoneNumberProvided;
    if (hasUserWrite) {
      batch.set(userRef, userUpdate, { merge: true });
    }

    const studentUpdate: any = { updatedAt: timestamp };
    if (trimmedDisplayName) studentUpdate.name = trimmedDisplayName;
    if (trimmedSchoolName) studentUpdate.schoolName = trimmedSchoolName;
    if (trimmedGrade) studentUpdate.grade = trimmedGrade;
    if (phoneNumberProvided) studentUpdate.phoneNumber = normalizedPhoneNumber;
    if (parentLinkCodeProvided) studentUpdate.parentLinkCode = normalizedParentLinkCode || null;
    if (canEditOtherStudent && hasClassName) studentUpdate.className = normalizedClassName;
    batch.set(studentRef, studentUpdate, { merge: true });

    const memberRef = db.doc("centers/" + centerId + "/members/" + studentId);
    const memberUpdate: any = { updatedAt: timestamp };
    if (trimmedDisplayName) memberUpdate.displayName = trimmedDisplayName;
    if (hasClassName) memberUpdate.className = normalizedClassName;
    if (phoneNumberProvided) memberUpdate.phoneNumber = normalizedPhoneNumber;
    if (isAdminCaller && memberStatusProvided) memberUpdate.status = normalizedMemberStatus;
    const shouldWriteMember = canEditOtherStudent || phoneNumberProvided;
    if (shouldWriteMember) {
      batch.set(memberRef, memberUpdate, { merge: true });
    }

    const userCenterRef = db.doc("userCenters/" + studentId + "/centers/" + centerId);
    const userCenterUpdate: any = {
      className: normalizedClassName,
      updatedAt: timestamp,
    };
    if (phoneNumberProvided) userCenterUpdate.phoneNumber = normalizedPhoneNumber;
    if (isAdminCaller && memberStatusProvided) userCenterUpdate.status = normalizedMemberStatus;
    const shouldWriteUserCenter =
      (canEditOtherStudent && hasClassName) ||
      (isAdminCaller && memberStatusProvided) ||
      phoneNumberProvided;
    if (canEditOtherStudent && hasClassName) {
      batch.set(userCenterRef, userCenterUpdate, { merge: true });
    } else if (isAdminCaller && memberStatusProvided) {
      batch.set(userCenterRef, userCenterUpdate, { merge: true });
    } else if (phoneNumberProvided) {
      batch.set(userCenterRef, userCenterUpdate, { merge: true });
    }

    if (isAdminCaller) {
      const hasSeasonLp = normalizedSeasonLp !== null;
      const hasStats = normalizedStats !== null;

      if (hasSeasonLp || hasStats) {
        const progressUpdate: any = { updatedAt: timestamp };
        if (hasSeasonLp) progressUpdate.seasonLp = normalizedSeasonLp;
        if (hasStats) progressUpdate.stats = normalizedStats;
        batch.set(db.doc("centers/" + centerId + "/growthProgress/" + studentId), progressUpdate, { merge: true });
      }

      const safeDateKey =
        typeof dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
          ? dateKey
          : new Date().toISOString().slice(0, 10);

      if (normalizedTodayStudyMinutes !== null) {
        batch.set(
          db.doc("centers/" + centerId + "/dailyStudentStats/" + safeDateKey + "/students/" + studentId),
          {
            totalStudyMinutes: Math.max(0, Math.round(normalizedTodayStudyMinutes)),
            studentId,
            centerId,
            dateKey: safeDateKey,
            updatedAt: timestamp,
          },
          { merge: true }
        );
      }

      if (hasSeasonLp || trimmedDisplayName || hasClassName) {
        const periodKey = safeDateKey.slice(0, 7);
        const rankUpdate: any = {
          studentId,
          updatedAt: timestamp,
        };
        if (hasSeasonLp) rankUpdate.value = normalizedSeasonLp;
        if (trimmedDisplayName) rankUpdate.displayNameSnapshot = trimmedDisplayName;
        if (hasClassName) rankUpdate.classNameSnapshot = normalizedClassName;

        batch.set(db.doc("centers/" + centerId + "/leaderboards/" + periodKey + "_lp/entries/" + studentId), rankUpdate, {
          merge: true,
        });
      }
    }

    let batchError: any = null;
    try {
      await batch.commit();
    } catch (commitError: any) {
      batchError = commitError;
      console.error("[updateStudentAccount] batch commit failed", {
        centerId,
        studentId,
        callerUid,
        message: commitError?.message || commitError,
      });
    }

    if (batchError) {
      const coreWrites: Promise<FirebaseFirestore.WriteResult>[] = [];
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
  } catch (e: any) {
    if (e instanceof functions.https.HttpsError) {
      throw e;
    }
    console.error("[updateStudentAccount] failed", {
      centerId,
      studentId,
      callerUid,
      message: e?.message || e,
      stack: e?.stack || null,
    });
    throw new functions.https.HttpsError("internal", "Operation failed due to internal error.", {
      userMessage: e?.message || "Unknown internal error",
    });
  }
});

export const updateParentProfile = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증 필요");
  }

  const callerUid = context.auth.uid;
  const centerId = typeof data?.centerId === "string" ? data.centerId.trim() : "";
  const schoolName = typeof data?.schoolName === "string" ? data.schoolName.trim() : "";
  const normalizedPhoneNumber = normalizePhoneNumber(data?.phoneNumber);

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

  const userUpdate: any = {
    phoneNumber: normalizedPhoneNumber,
    updatedAt: timestamp,
  };
  if (schoolName) {
    userUpdate.schoolName = schoolName;
  }

  const membershipUpdate: any = {
    phoneNumber: normalizedPhoneNumber,
    updatedAt: timestamp,
  };

  batch.set(userRef, userUpdate, { merge: true });
  batch.set(memberRef, membershipUpdate, { merge: true });
  batch.set(userCenterRef, membershipUpdate, { merge: true });
  await batch.commit();

  return { ok: true };
});
export const registerStudent = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();
  const auth = admin.auth();
  const { email, password, displayName, schoolName, grade, centerId } = data;

  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "인증 필요");
  if (!email || !password || !displayName || !centerId) {
    throw new functions.https.HttpsError("invalid-argument", "필수값 누락");
  }

  const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
  if (!callerMemberSnap.exists || !isAdminRole(callerMemberSnap.data()?.role)) {
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
  } catch (e: any) {
    if (e instanceof functions.https.HttpsError) {
      throw e;
    }
    throw new functions.https.HttpsError("internal", "Operation failed due to internal error.", {
      userMessage: e?.message || "Unknown internal error",
    });
  }
});

export const redeemInviteCode = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();
  const { code } = data;

  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "인증 필요");
  if (!code) throw new functions.https.HttpsError("invalid-argument", "초대코드 누락");

  const uid = context.auth.uid;
  const callerDisplayName = context.auth.token.name || null;

  try {
    return await db.runTransaction(async (t) => {
      const inviteRef = db.doc(`inviteCodes/${code}`);
      const inviteSnap = await t.get(inviteRef);
      if (!inviteSnap.exists) throw new functions.https.HttpsError("failed-precondition", "Invalid invite code.");

      const inv = inviteSnap.data() as InviteDoc;
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
  } catch (e: any) {
    if (e instanceof functions.https.HttpsError) {
      throw e;
    }
    throw new functions.https.HttpsError("internal", "Operation failed due to internal error.", {
      userMessage: e?.message || "Unknown internal error",
    });
  }
});

export const completeSignupWithInvite = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const uid = context.auth.uid;
  const role = data?.role as AllowedRole;
  const code = String(data?.code || "").trim();
  const schoolName = String(data?.schoolName || "").trim();
  const grade = String(data?.grade || "고등학생").trim();
  const parentLinkCode = String(data?.parentLinkCode || "").trim();
  const studentLinkCodeInput = data?.studentLinkCode ?? data?.parentLinkCode ?? "";
  const studentLinkCode = String(studentLinkCodeInput).trim();
  const displayNameInput = String(data?.displayName || "").trim();
  const signupPhoneNumber = normalizePhoneNumber(data?.parentPhoneNumber || data?.phoneNumber || "");

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
      let targetClassName: string | null = null;
      let inviteRef: admin.firestore.DocumentReference | null = null;
      let linkedStudentRef: admin.firestore.DocumentReference | null = null;
      let linkedStudentData: admin.firestore.DocumentData | null = null;
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
          candidateQueries.push(
            db.collectionGroup("students").where("parentLinkCode", "==", codeAsNumber).limit(20),
            db.collectionGroup("students").where("studentLinkCode", "==", codeAsNumber).limit(20)
          );
        }

        const studentDocMap = new Map<string, admin.firestore.QueryDocumentSnapshot>();
        try {
          const studentSnaps = await Promise.all(candidateQueries.map((candidateQuery) => candidateQuery.get()));
          for (const snap of studentSnaps) {
            for (const studentDoc of snap.docs) {
              studentDocMap.set(studentDoc.ref.path, studentDoc);
            }
          }
        } catch (lookupError: any) {
          const lookupCode = String(lookupError?.code || "");
          const lookupMessage = String(lookupError?.message || "");
          const isPreconditionLookupError =
            lookupCode === "9" ||
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
              const studentData = studentDoc.data() as any;
              const parentCode = normalizeParentLinkCodeValue(studentData?.parentLinkCode);
              const studentCode = normalizeParentLinkCodeValue(studentData?.studentLinkCode);
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

        type ParentLinkCandidate = {
          centerId: string;
          studentDoc: admin.firestore.QueryDocumentSnapshot;
          studentData: admin.firestore.DocumentData;
          className: string | null;
          hasActiveMember: boolean;
          hasActiveUserCenter: boolean;
          hasSeatAssignment: boolean;
          updatedAtMs: number;
          createdAtMs: number;
        };

        let candidates: ParentLinkCandidate[] = [];
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
          if (!resolvedCenterId) continue;

          const candidateMemberRef = db.doc(`centers/${resolvedCenterId}/members/${studentDoc.id}`);
          const candidateUserCenterRef = db.doc(`userCenters/${studentDoc.id}/centers/${resolvedCenterId}`);
          const [candidateMemberSnap, candidateUserCenterSnap] = await Promise.all([
            t.get(candidateMemberRef),
            t.get(candidateUserCenterRef),
          ]);
          const candidateMemberData = candidateMemberSnap.exists ? (candidateMemberSnap.data() as any) : null;
          const hasActiveMember =
            candidateMemberSnap.exists &&
            candidateMemberData?.role === "student" && isActiveMembershipStatus(candidateMemberData?.status);
          const candidateUserCenterData = candidateUserCenterSnap.exists ? (candidateUserCenterSnap.data() as any) : null;
          const hasActiveUserCenter =
            candidateUserCenterSnap.exists &&
            candidateUserCenterData?.role === "student" &&
            isActiveMembershipStatus(candidateUserCenterData?.status);


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
            className:
              (candidateMemberData?.className as string | null) ||
              (candidateUserCenterData?.className as string | null) ||
              null,
            hasActiveMember,
            hasActiveUserCenter,
            hasSeatAssignment,
            updatedAtMs: toMillisSafe(studentData?.updatedAt),
            createdAtMs: toMillisSafe(studentData?.createdAt),
          });
        }

        if (candidates.length === 0) {
          console.warn("[completeSignupWithInvite] no resolvable student candidate", {
            studentLinkCode,
            rawMatchedDocCount: studentDocMap.size,
            centerStudentDocCount: candidateStudentDocs.length,
          });
          throw new functions.https.HttpsError("failed-precondition", "No student profile could be resolved for this link code.", {
            userMessage:
              "A student was found for this code, but profile linkage failed. Please ask the center admin to verify student data.",
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
            if (aMemberScore !== bMemberScore) return bMemberScore - aMemberScore;

            const aSeatScore = a.hasSeatAssignment ? 1 : 0;
            const bSeatScore = b.hasSeatAssignment ? 1 : 0;
            if (aSeatScore !== bSeatScore) return bSeatScore - aSeatScore;

            const aScore = Math.max(a.updatedAtMs, a.createdAtMs);
            const bScore = Math.max(b.updatedAtMs, b.createdAtMs);
            if (aScore !== bScore) return bScore - aScore;

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
        targetClassName = selected.className || (linkedStudentData?.className as string | null) || null;
      } else {
        inviteRef = db.doc(`inviteCodes/${code}`);
        const inviteSnap = await t.get(inviteRef);
        if (!inviteSnap.exists) {
          throw new functions.https.HttpsError("failed-precondition", "Invalid invite code.", {
            userMessage: "유효하지 않은 초대 코드입니다.",
          });
        }

        const inviteData = inviteSnap.data() as InviteDoc;
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
      const existingMembershipData = existingMembership.exists ? (existingMembership.data() as any) : null;
      const existingCenterMemberData = existingCenterMember.exists ? (existingCenterMember.data() as any) : null;
      const existingRole = existingMembershipData?.role || existingCenterMemberData?.role || null;
      const isParentRelink = role === "parent" && existingRole === "parent";

      if ((existingMembership.exists || existingCenterMember.exists) && !isParentRelink) {
        throw new functions.https.HttpsError("already-exists", "Already joined this center.", {
          userMessage: "이미 가입된 센터입니다.",
        });
      }

      const extractLinkedIds = (value: unknown): string[] => {
        if (!Array.isArray(value)) return [];
        return value.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
      };

      const ts = admin.firestore.Timestamp.now();
      let resolvedDisplayName = displayNameInput || tokenDisplayName || "사용자";
      const existingLinkedStudentIds = Array.from(new Set([
        ...extractLinkedIds(existingMembershipData?.linkedStudentIds),
        ...extractLinkedIds(existingCenterMemberData?.linkedStudentIds),
      ]));
      let linkedStudentIds: string[] = [];
      let effectiveUserPhone = signupPhoneNumber || normalizePhoneNumber(existingMembershipData?.phoneNumber || existingCenterMemberData?.phoneNumber || "");
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
            (existingMembershipData?.displayName as string | undefined) ||
            (existingCenterMemberData?.displayName as string | undefined) ||
            `${linkedStudentData?.name || "학생"} 학부모`;
        }

        t.set(linkedStudentRef, {
          parentUids: admin.firestore.FieldValue.arrayUnion(uid),
          updatedAt: ts,
        }, { merge: true });
      }

      const userDocData: any = {
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

      const memberData: any = {
        id: uid,
        centerId,
        role,
        status: resolvedStatus,
        joinedAt: existingMembershipData?.joinedAt || existingCenterMemberData?.joinedAt || ts,
        displayName: resolvedDisplayName,
        className: targetClassName || existingMembershipData?.className || existingCenterMemberData?.className || null,
      };
      if ((role === "student" || role === "parent") && effectiveUserPhone) {
        memberData.phoneNumber = effectiveUserPhone;
      }
      if (linkedStudentIds.length > 0) {
        memberData.linkedStudentIds = linkedStudentIds;
      }

      const userCenterData: any = {
        id: centerId,
        centerId,
        role,
        status: resolvedStatus,
        joinedAt: existingMembershipData?.joinedAt || existingCenterMemberData?.joinedAt || ts,
        displayName: resolvedDisplayName,
        className: targetClassName || existingMembershipData?.className || existingCenterMemberData?.className || null,
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
  } catch (e: any) {
    if (e instanceof functions.https.HttpsError) {
      throw e;
    }

    const errorCode = String(e?.code || "").toLowerCase();
    const errorMessage = String(e?.message || "").trim();
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
    const hasFailedPrecondition =
      errorCode.includes("failed-precondition") ||
      errorCode === "9" ||
      /failed[_ -]?precondition/i.test(strippedErrorMessage);
    const hasInvalidArgument =
      errorCode.includes("invalid-argument") ||
      errorCode === "3" ||
      /invalid[_ -]?argument/i.test(strippedErrorMessage);
    const hasAlreadyExists =
      errorCode.includes("already-exists") ||
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
      let userMessage =
        "학생코드 확인에 실패했습니다. 코드가 올바른지, 해당 학생이 센터에 정상 등록되어 있는지 확인해 주세요.";

      if (lower.includes("no student found for this link code")) {
        userMessage = "해당 학생코드를 찾을 수 없습니다. 6자리 학생코드를 다시 확인해 주세요.";
      } else if (lower.includes("no student profile could be resolved for this link code")) {
        userMessage = "학생코드는 확인됐지만 프로필 연결에 실패했습니다. 센터 관리자에게 학생 등록 상태를 확인해 주세요.";
      } else if (lower.includes("invite code has no center information")) {
        userMessage = "학생코드에 연결된 센터 정보가 올바르지 않습니다. 센터 관리자에게 문의해 주세요.";
      } else if (normalizedFailedPreconditionMessage) {
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
      userMessage: e?.message || "Unknown internal error",
    });
  }
});

export const confirmInvoicePayment = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = String(data?.centerId || "").trim();
  const invoiceId = String(data?.invoiceId || "").trim();
  if (!centerId || !invoiceId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId and invoiceId are required.");
  }

  const paymentMethodRaw = String(data?.paymentMethod || "card").trim();
  const paymentMethod = (["card", "transfer", "cash"] as const).includes(paymentMethodRaw as any)
    ? (paymentMethodRaw as "card" | "transfer" | "cash")
    : "card";
  const paymentKey = typeof data?.paymentKey === "string" ? data.paymentKey.trim() : "";
  const orderId = typeof data?.orderId === "string" ? data.orderId.trim() : "";

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

  const invoiceData = invoiceSnap.data() as any;
  const invoiceStudentId = String(invoiceData?.studentId || "").trim();
  if (!invoiceStudentId) {
    throw new functions.https.HttpsError("failed-precondition", "Invoice has invalid student info.");
  }

  const callerMemberData = callerMemberSnap.exists ? (callerMemberSnap.data() as any) : null;
  const callerUserCenterData = callerUserCenterSnap.exists ? (callerUserCenterSnap.data() as any) : null;
  const callerMemberRole = typeof callerMemberData?.role === "string" ? callerMemberData.role.trim() : "";
  const callerUserCenterRole = typeof callerUserCenterData?.role === "string" ? callerUserCenterData.role.trim() : "";
  const callerRole = callerMembership.role || callerMemberRole || callerUserCenterRole || null;

  const linkedStudentIds = new Set<string>([
    ...normalizeStringArray(callerMemberData?.linkedStudentIds),
    ...normalizeStringArray(callerUserCenterData?.linkedStudentIds),
  ]);

  const isAdminOrTeacher = isAdminRole(callerRole) || callerRole === "teacher";
  const isOwnerStudent = callerUid === invoiceStudentId;
  let isLinkedParent = callerRole === "parent" && linkedStudentIds.has(invoiceStudentId);

  if (!isLinkedParent && callerRole === "parent") {
    const studentSnap = await db.doc(`centers/${centerId}/students/${invoiceStudentId}`).get();
    const parentUids = normalizeStringArray(studentSnap.data()?.parentUids);
    isLinkedParent = parentUids.includes(callerUid);
  }

  if (!isAdminOrTeacher && !isOwnerStudent && !isLinkedParent) {
    throw new functions.https.HttpsError("permission-denied", "No permission to process this invoice payment.", {
      userMessage: "해당 수납 건을 결제할 권한이 없습니다.",
    });
  }

  let alreadyProcessed = false;
  let processedAmount = parseFiniteNumber(invoiceData?.finalPrice) || 0;
  let processedStatus = String(invoiceData?.status || "issued");

  await db.runTransaction(async (tx) => {
    const latestInvoiceSnap = await tx.get(invoiceRef);
    if (!latestInvoiceSnap.exists) {
      throw new functions.https.HttpsError("failed-precondition", "Invoice not found during transaction.");
    }

    const latestInvoice = latestInvoiceSnap.data() as any;
    const latestStatus = String(latestInvoice?.status || "issued");
    const latestAmount = parseFiniteNumber(latestInvoice?.finalPrice) || 0;
    processedAmount = parseFiniteNumber(data?.amount) ?? latestAmount;
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
    tx.set(invoiceRef, {
      status: "paid",
      paymentMethod,
      paidAt: nowTs,
      updatedAt: nowTs,
      ...(paymentKey ? { paymentKey } : {}),
      ...(orderId ? { orderId } : {}),
    }, { merge: true });

    const paymentRef = db.collection(`centers/${centerId}/payments`).doc();
    tx.set(paymentRef, {
      invoiceId,
      centerId,
      studentId: invoiceStudentId,
      studentName: latestInvoice?.studentName || "학생",
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
    const prevCollectedRevenue = parseFiniteNumber(kpiSnap.data()?.collectedRevenue) || 0;
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

export const saveNotificationSettingsSecure = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = String(data?.centerId || "").trim();
  if (!centerId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId is required.");
  }

  const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
  const callerRole = callerMemberSnap.exists ? callerMemberSnap.data()?.role : null;
  if (!isAdminRole(callerRole)) {
    throw new functions.https.HttpsError("permission-denied", "센터 관리자만 저장할 수 있습니다.");
  }

  const payload = {
    smsEnabled: data?.smsEnabled !== false,
    smsProvider: (["none", "aligo", "custom"].includes(String(data?.smsProvider || "")) ? String(data?.smsProvider) : "none") as SmsProviderType,
    smsSender: asTrimmedString(data?.smsSender),
    smsUserId: asTrimmedString(data?.smsUserId),
    smsEndpointUrl: asTrimmedString(data?.smsEndpointUrl),
    smsTemplateStudyStart: validateSmsTemplateLength(
      String(data?.smsTemplateStudyStart || ""),
      "공부 시작 템플릿"
    ) || DEFAULT_SMS_TEMPLATES.study_start,
    smsTemplateAwayStart: validateSmsTemplateLength(
      String(data?.smsTemplateAwayStart || ""),
      "외출 템플릿"
    ) || DEFAULT_SMS_TEMPLATES.away_start,
    smsTemplateAwayEnd: validateSmsTemplateLength(
      String(data?.smsTemplateAwayEnd || ""),
      "복귀 템플릿"
    ) || DEFAULT_SMS_TEMPLATES.away_end,
    smsTemplateStudyEnd: validateSmsTemplateLength(
      String(data?.smsTemplateStudyEnd || ""),
      "공부 종료 템플릿"
    ) || DEFAULT_SMS_TEMPLATES.study_end,
    smsTemplateLateAlert: validateSmsTemplateLength(
      String(data?.smsTemplateLateAlert || ""),
      "지각 템플릿"
    ) || DEFAULT_SMS_TEMPLATES.late_alert,
    lateAlertEnabled: data?.lateAlertEnabled !== false,
    lateAlertGraceMinutes: Number.isFinite(Number(data?.lateAlertGraceMinutes))
      ? Math.max(0, Number(data?.lateAlertGraceMinutes))
      : 20,
    defaultArrivalTime: asTrimmedString(data?.defaultArrivalTime, "17:00"),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: context.auth.uid,
  } as Record<string, unknown>;

  const rawApiKey = asTrimmedString(data?.smsApiKey);
  if (rawApiKey) {
    payload.smsApiKey = rawApiKey;
    payload.smsApiKeyConfigured = true;
    payload.smsApiKeyLastUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
  } else if (data?.clearSmsApiKey === true) {
    payload.smsApiKey = admin.firestore.FieldValue.delete();
    payload.smsApiKeyConfigured = false;
    payload.smsApiKeyLastUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
  }

  await db.doc(`centers/${centerId}/settings/notifications`).set(payload, { merge: true });

  return {
    ok: true,
    smsApiKeyConfigured: rawApiKey.length > 0 ? true : data?.clearSmsApiKey === true ? false : undefined,
  };
});

export const retrySmsQueueItem = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = asTrimmedString(data?.centerId);
  const queueId = asTrimmedString(data?.queueId);
  if (!centerId || !queueId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId와 queueId가 필요합니다.");
  }

  const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
  const callerRole = callerMemberSnap.exists ? callerMemberSnap.data()?.role : null;
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

export const cancelSmsQueueItem = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = asTrimmedString(data?.centerId);
  const queueId = asTrimmedString(data?.queueId);
  if (!centerId || !queueId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId와 queueId가 필요합니다.");
  }

  const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
  const callerRole = callerMemberSnap.exists ? callerMemberSnap.data()?.role : null;
  if (!isAdminRole(callerRole)) {
    throw new functions.https.HttpsError("permission-denied", "센터 관리자만 취소할 수 있습니다.");
  }

  const queueRef = db.doc(`centers/${centerId}/smsQueue/${queueId}`);
  const queueSnap = await queueRef.get();
  if (!queueSnap.exists) {
    throw new functions.https.HttpsError("not-found", "큐 문서를 찾을 수 없습니다.");
  }

  const currentStatus = String(queueSnap.data()?.status || "");
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

export const updateSmsRecipientPreference = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = asTrimmedString(data?.centerId);
  const studentId = asTrimmedString(data?.studentId);
  const parentUid = asTrimmedString(data?.parentUid);
  if (!centerId || !studentId || !parentUid) {
    throw new functions.https.HttpsError("invalid-argument", "centerId, studentId, parentUid가 필요합니다.");
  }

  const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
  const callerRole = callerMemberSnap.exists ? callerMemberSnap.data()?.role : null;
  if (!isAdminRole(callerRole)) {
    throw new functions.https.HttpsError("permission-denied", "센터 관리자만 수신 설정을 수정할 수 있습니다.");
  }

  const studentSnap = await db.doc(`centers/${centerId}/students/${studentId}`).get();
  if (!studentSnap.exists) {
    throw new functions.https.HttpsError("not-found", "학생 정보를 찾을 수 없습니다.");
  }

  const parentUids = normalizeStringArray(studentSnap.data()?.parentUids);
  const isStudentFallbackRecipient = parentUid === STUDENT_SMS_FALLBACK_UID;
  if (!isStudentFallbackRecipient && !parentUids.includes(parentUid)) {
    throw new functions.https.HttpsError("failed-precondition", "해당 학생에 연결된 학부모가 아닙니다.");
  }

  const [userSnap, memberSnap] = await Promise.all([
    db.doc(`users/${isStudentFallbackRecipient ? studentId : parentUid}`).get(),
    db.doc(`centers/${centerId}/members/${isStudentFallbackRecipient ? studentId : parentUid}`).get(),
  ]);

  const studentName = asTrimmedString(studentSnap.data()?.name, "학생");
  const parentName = isStudentFallbackRecipient
    ? "학생 본인"
    : asTrimmedString(memberSnap.data()?.displayName || userSnap.data()?.displayName || "학부모");
  const phoneNumberOverride = asTrimmedString(data?.phoneNumberOverride);
  const phoneNumber = resolveFirstValidPhoneNumber(
    phoneNumberOverride,
    isStudentFallbackRecipient
      ? studentSnap.data()?.phoneNumber
      : null,
    userSnap.data()?.phoneNumber,
    memberSnap.data()?.phoneNumber
  );
  const enabled = data?.enabled !== false;
  const eventToggles = normalizeSmsEventToggles(data?.eventToggles);

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

export const scheduledSmsQueueDispatcher = functions
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
          if (!freshSnap.exists) return null;
          const freshData = freshSnap.data() || {};
          const status = String(freshData.status || "");
          const nextAttemptAt = toTimestampDate(freshData.nextAttemptAt);
          const leaseExpiresAt = toTimestampDate(freshData.processingLeaseUntil);

          if (status === "queued") {
            if (nextAttemptAt && nextAttemptAt.getTime() > now.getTime()) {
              return null;
            }
          } else if (status === "processing") {
            if (leaseExpiresAt && leaseExpiresAt.getTime() > now.getTime()) {
              return null;
            }
          } else {
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

          return {
            ...freshData,
            id: queueDoc.id,
            attemptCount: nextAttemptCount,
          };
        });

        if (!claimed) continue;

        await dispatchSmsQueueItem(db, centerId, queueDoc.ref, claimed, Number(claimed.attemptCount || 1));
        processed += 1;
      }
    }

    console.log("[sms-dispatcher] run complete", { centerCount: centersSnap.size, processed });
    return null;
  });

export const notifyAttendanceSms = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = String(data?.centerId || "").trim();
  const studentId = String(data?.studentId || "").trim();
  const eventType = String(data?.eventType || "").trim() as AttendanceSmsEventType;

  if (!centerId || !studentId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId and studentId are required.", {
      userMessage: "센터 또는 학생 정보가 누락되었습니다.",
    });
  }

  if (!(["study_start", "away_start", "away_end", "study_end", "late_alert", "check_in", "check_out"] as AttendanceSmsEventType[]).includes(eventType)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid event type.", {
      userMessage: "알림 타입이 올바르지 않습니다.",
    });
  }

  const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
  const callerRole = callerMemberSnap.exists ? callerMemberSnap.data()?.role : null;
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

  const studentNameRaw = studentSnap.data()?.name;
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

export const sendManualStudentSms = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = String(data?.centerId || "").trim();
  const studentId = String(data?.studentId || "").trim();
  const rawMessage = String(data?.message || "").replace(/\s+/g, " ").trim();

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
  const callerRole = callerMemberSnap.exists ? callerMemberSnap.data()?.role : null;
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

  const studentNameRaw = studentSnap.data()?.name;
  const studentName = typeof studentNameRaw === "string" && studentNameRaw.trim() ? studentNameRaw.trim() : "학생";
  const settings = await loadNotificationSettings(db, centerId);
  const queueResult = await queueManualStudentSms(db, {
    centerId,
    studentId,
    studentName,
    message: rawMessage,
    settings,
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

export const runLateArrivalCheck = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = String(data?.centerId || "").trim();
  if (!centerId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId is required.");
  }

  const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
  const callerRole = callerMemberSnap.exists ? callerMemberSnap.data()?.role : null;
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
export const scheduledAttendanceCheck = functions
  .region(region)
  .pubsub.schedule("every 10 minutes")
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    const db = admin.firestore();
    const nowKst = toKstDate();
    const MAX_SESSION_MINUTES = 360; // 6시간
    const cutoffTimestamp = admin.firestore.Timestamp.fromMillis(
      Date.now() - MAX_SESSION_MINUTES * 60 * 1000
    );

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
        if (seat.status !== "studying") continue;

        const lastCheckInAt = seat.lastCheckInAt as admin.firestore.Timestamp | undefined;
        if (!lastCheckInAt || lastCheckInAt > cutoffTimestamp) continue;

        const studentId = seat.studentId as string | undefined;
        if (!studentId) continue;

        const startKst = toKstDate(lastCheckInAt.toDate());
        const sessionDateKey = toDateKey(startKst);
        const autoEndTime = admin.firestore.Timestamp.fromMillis(
          lastCheckInAt.toMillis() + MAX_SESSION_MINUTES * 60 * 1000
        );

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
export const cleanupOldDocuments = functions
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

    const deleteOldDocs = async (
      colPath: string,
      cutoff: admin.firestore.Timestamp,
      maxDocs = 500
    ): Promise<number> => {
      const snap = await db
        .collection(colPath)
        .where("createdAt", "<", cutoff)
        .limit(maxDocs)
        .get();
      if (snap.empty) return 0;

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
export const scheduledWeeklyReport = functions
  .region(region)
  .pubsub.schedule("0 20 * * 0")
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    const db = admin.firestore();
    const nowKst = toKstDate();

    // 지난 7일 dateKey 생성
    const dateKeys: string[] = [];
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
      if (settings.smsEnabled === false || !settings.smsProvider || settings.smsProvider === "none") continue;

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
        await Promise.all(
          dateKeys.map(async (dateKey) => {
            const statSnap = await db
              .doc(`centers/${centerId}/dailyStudentStats/${dateKey}/students/${studentId}`)
              .get();
            if (statSnap.exists) {
              weeklyMinutes += Number(statSnap.data()?.totalStudyMinutes ?? 0);
            }
          })
        );

        const studentData = (await db.doc(`centers/${centerId}/students/${studentId}`).get()).data() as any;
        const studentName = typeof studentData?.name === "string" ? studentData.name : "학생";
        const targetWeekly = (Number(studentData?.targetDailyMinutes ?? 0) * 5);

        const weeklyHours = Math.floor(weeklyMinutes / 60);
        const weeklyMins = weeklyMinutes % 60;
        const timeLabel = weeklyHours > 0 ? `${weeklyHours}시간 ${weeklyMins}분` : `${weeklyMins}분`;
        const achieveRate = targetWeekly > 0 ? Math.round((weeklyMinutes / targetWeekly) * 100) : null;
        const achieveLabel = achieveRate !== null ? ` (목표 대비 ${achieveRate}%)` : "";

        const message = `[주간 리포트] ${studentName} 학생이 이번 주 ${timeLabel} 공부했습니다${achieveLabel}.`;

        const recipients = await collectParentRecipients(db, centerId, studentId);
        if (recipients.length === 0) continue;
        const { allowedRecipients, suppressedRecipients } = await splitRecipientsBySmsPreference(
          db,
          centerId,
          studentId,
          studentName,
          "weekly_report",
          recipients
        );

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
        await Promise.all(
          suppressedRecipients.map((recipient) =>
            appendSmsDeliveryLog(db, {
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
            })
          )
        );
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
export const onSessionCreated = functions
  .region(region)
  .firestore.document("centers/{centerId}/studyLogs/{studentId}/days/{dateKey}/sessions/{sessionId}")
  .onCreate(async (snap, context) => {
    const data = snap.data() as Record<string, any>;
    const { centerId, studentId, dateKey } = context.params;

    // 자동 종료 세션은 Cloud Function 자체가 생성했으므로 재검증 불필요
    if (data.closedReason) return null;

    const rawDuration = Number(data.durationMinutes ?? 0);
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
export const scheduledDailyRiskAlert = functions
  .region(region)
  .pubsub.schedule("0 21 * * *")
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    const db = admin.firestore();
    const nowKst = toKstDate();
    const todayKey = toDateKey(nowKst);

    const dateKeys: string[] = [];
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

      const atRiskStudentIds: string[] = [];
      const atRiskNames: string[] = [];

      for (const memberDoc of membersSnap.docs) {
        const studentId = memberDoc.id;
        const studentSnap = await db.doc(`centers/${centerId}/students/${studentId}`).get();
        if (!studentSnap.exists) continue;
        const studentData = studentSnap.data() as any;
        const targetDailyMinutes = Number(studentData?.targetDailyMinutes ?? 0);
        if (targetDailyMinutes <= 0) continue;

        const target14Days = targetDailyMinutes * 14;
        let actual14Minutes = 0;
        await Promise.all(
          dateKeys.map(async (dateKey) => {
            const statSnap = await db
              .doc(`centers/${centerId}/dailyStudentStats/${dateKey}/students/${studentId}`)
              .get();
            if (statSnap.exists) {
              actual14Minutes += Number(statSnap.data()?.totalStudyMinutes ?? 0);
            }
          })
        );

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
            const adminData = adminDoc.data() as any;
            const phone = normalizePhoneNumber(adminData?.phoneNumber);
            if (!phone) continue;
            const queueRef = db.collection(`centers/${centerId}/smsQueue`).doc();
            batch.set(queueRef, {
              centerId,
              studentId: null,
              studentName: null,
              parentUid: adminDoc.id,
              parentName: asTrimmedString(adminData?.displayName || adminData?.name || "관리자"),
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
export const scheduledClassroomSignalsRefresh = functions
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
      } catch (error) {
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
export const refreshClassroomSignals = functions
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

    const centerId = typeof data?.centerId === "string" ? data.centerId.trim() : "";
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
