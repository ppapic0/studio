import { defineSecret } from "firebase-functions/params";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { randomInt } from "crypto";

import { generateStructuredStudyPlan } from "./geminiClient";
import {
  executeOpenClawSnapshotExport,
  OpenClawExportInProgressError,
} from "./openclawSnapshot";
import { generateStudyPlanInputSchema, validateStudyPlanOutput } from "./plannerSchema";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const region = "asia-northeast3";
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const SMS_VPC_CONNECTOR = "projects/studio-2815552762-86e0f/locations/asia-northeast3/connectors/sms-egress-connector";
const smsDispatcherFunctions = functions.region(region).runWith({
  vpcConnector: SMS_VPC_CONNECTOR,
  vpcConnectorEgressSettings: "ALL_TRAFFIC",
});
const MANUAL_PARENT_SMS_UID = "__manual_parent__";
const STUDENT_SMS_FALLBACK_UID = "__student__";
const allowedRoles = ["student", "teacher", "parent", "centerAdmin", "kiosk"] as const;
const adminRoles = new Set(["centerAdmin", "owner", "admin", "centerManager"]);
type AllowedRole = (typeof allowedRoles)[number];

const signupRoleAliases: Record<string, AllowedRole> = {
  student: "student",
  "학생": "student",
  teacher: "teacher",
  "선생님": "teacher",
  "교사": "teacher",
  "강사": "teacher",
  parent: "parent",
  "학부모": "parent",
  "보호자": "parent",
  centeradmin: "centerAdmin",
  centeradministrator: "centerAdmin",
  "센터관리자": "centerAdmin",
  kiosk: "kiosk",
  kioskaccount: "kiosk",
  kioskmode: "kiosk",
  tabletkiosk: "kiosk",
  attendancekiosk: "kiosk",
  "키오스크": "kiosk",
  "키오스크계정": "kiosk",
  "태블릿키오스크": "kiosk",
};

function normalizeSignupRole(value: unknown): AllowedRole | null {
  const normalized = String(value ?? "").trim();
  if ((allowedRoles as readonly string[]).includes(normalized)) {
    return normalized as AllowedRole;
  }

  const compact = normalized.toLowerCase().replace(/[\s._-]+/g, "");
  return signupRoleAliases[compact] ?? null;
}

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
  | "weekly_report"
  | "daily_report"
  | "payment_reminder";
type RecipientPreferenceEventType = ParentSmsEventType | "manual_note";
type SmsQueueEventType = RecipientPreferenceEventType | "risk_alert";
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
};

type NotificationSettingsSecretDoc = {
  smsApiKey?: string;
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
  isManualRecipient?: boolean;
  isFallbackRecipient?: boolean;
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

type ParentLinkRateLimitDoc = {
  failedAttemptCount?: number;
  firstFailedAt?: admin.firestore.Timestamp;
  lastFailedAt?: admin.firestore.Timestamp;
  blockedUntil?: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
};

type ParentLinkLookupDoc = {
  code?: string;
  centerId?: string;
  studentId?: string;
  studentPath?: string;
  studentName?: string;
  updatedAt?: admin.firestore.Timestamp;
  createdAt?: admin.firestore.Timestamp;
};

type StudentAccountChangeLogDoc = {
  action: "student_phone_number_updated";
  centerId: string;
  studentId: string;
  studentName?: string | null;
  studentClassName?: string | null;
  field: "phoneNumber";
  previousValueMasked: string | null;
  nextValueMasked: string | null;
  previousValueLast4: string | null;
  nextValueLast4: string | null;
  changedByUid: string;
  changedByRole: string | null;
  changedByName?: string | null;
  source: "updateStudentAccount";
  createdAt: admin.firestore.Timestamp;
};

const SMS_BYTE_LIMIT = 90;
const PARENT_LINK_FAILED_ATTEMPT_LIMIT = 5;
const PARENT_LINK_FAILED_ATTEMPT_WINDOW_MS = 30 * 60 * 1000;
const PARENT_LINK_FAILED_ATTEMPT_LOCK_MS = 30 * 60 * 1000;
const PARENT_LINK_LOOKUP_COLLECTION = "parentLinkCodeLookup";
const TRACK_MANAGED_STUDY_CENTER_NAME = "트랙 관리형 스터디센터";
const ATTENDANCE_REQUEST_PENALTY_POINTS: Record<"late" | "absence" | "schedule_change", number> = {
  late: 1,
  absence: 2,
  schedule_change: 1,
};
const ATTENDANCE_REQUEST_PROOF_LIMIT = 2;
const ATTENDANCE_REQUEST_PROOF_MAX_ATTACHMENT_BYTES = 700 * 1024;
const ATTENDANCE_REQUEST_REASON_CATEGORIES = new Set([
  "disaster",
  "emergency",
  "surgery",
  "hospital",
  "other",
]);
const ATTENDANCE_REQUEST_REASON_LABELS: Record<
  "disaster" | "emergency" | "surgery" | "hospital" | "other",
  string
> = {
  disaster: "천재지변",
  emergency: "긴급",
  surgery: "수술",
  hospital: "병원",
  other: "기타",
};
const SECURE_PENALTY_SOURCE_POINTS: Record<"manual" | "routine_missing", number> = {
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

const DEFAULT_SMS_TEMPLATES: Record<"study_start" | "away_start" | "away_end" | "study_end" | "late_alert", string> = {
  study_start: `[${TRACK_MANAGED_STUDY_CENTER_NAME}] {studentName} 학생 {time} 공부시작. 운영일 학습 흐름 확인 부탁드립니다.`,
  away_start: `[${TRACK_MANAGED_STUDY_CENTER_NAME}] {studentName} 학생 {time} 외출. 복귀 후 다시 공부를 이어갑니다.`,
  away_end: `[${TRACK_MANAGED_STUDY_CENTER_NAME}] {studentName} 학생 {time} 복귀. 다시 공부를 시작했습니다.`,
  study_end: `[${TRACK_MANAGED_STUDY_CENTER_NAME}] {studentName} 학생 {time} 공부종료. 운영일 학습 마무리했습니다.`,
  late_alert: `[${TRACK_MANAGED_STUDY_CENTER_NAME}] {studentName} 학생 {expectedTime} 미등원. 확인 부탁드립니다.`,
};

const SMS_TEMPLATE_SETTING_KEYS = [
  "smsTemplateStudyStart",
  "smsTemplateAwayStart",
  "smsTemplateAwayEnd",
  "smsTemplateStudyEnd",
  "smsTemplateLateAlert",
  "smsTemplateCheckIn",
  "smsTemplateCheckOut",
] as const;

type StudyBoxRarity = "common" | "rare" | "epic";
type SecureStudyBoxReward = {
  milestone: number;
  rarity: StudyBoxRarity;
  minReward: number;
  maxReward: number;
  basePoints: number;
  awardedPoints: number;
  multiplier: number;
  earnedAt?: string | null;
  boostEventId?: string | null;
};

type DailyPointEventDoc = {
  id: string;
  source: "study_box" | "daily_rank" | "weekly_rank" | "monthly_rank" | "plan_completion" | "manual_adjustment" | "legacy";
  label: string;
  points: number;
  createdAt: string;
  hour?: number;
  range?: "daily" | "weekly" | "monthly";
  rank?: number;
  periodKey?: string;
  awardDateKey?: string;
  paidAt?: string;
  deltaPoints?: number;
  direction?: "add" | "subtract";
  reason?: string;
};

type PointBoostEventMode = "day" | "window";
type PointBoostEventDoc = {
  centerId: string;
  mode: PointBoostEventMode;
  startAt: admin.firestore.Timestamp;
  endAt: admin.firestore.Timestamp;
  multiplier: number;
  message?: string | null;
  createdBy: string;
  createdAt?: admin.firestore.Timestamp;
  cancelledAt?: admin.firestore.Timestamp | null;
  cancelledBy?: string | null;
};

type StudyTimelineSegment = {
  startAtMs: number;
  durationMinutes: number;
  durationSeconds: number;
};

type StudyDayRangeSegment = {
  dateKey: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  durationMinutes: number;
  durationSeconds: number;
};

type FinalizeStudySessionParams = {
  db: admin.firestore.Firestore;
  centerId: string;
  studentId: string;
  startMs: number;
  endMs: number;
  dateKeyOverride?: string | null;
  closeSeatRef?: FirebaseFirestore.DocumentReference | null;
  shouldCloseSeat?: boolean;
  closeAttendanceEvent?: {
    dateKey: string;
    eventAtMs: number;
    source: string;
    seatId?: string | null;
    statusBefore?: string | null;
    statusAfter?: string | null;
  };
  progressExtra?: Record<string, unknown>;
  sessionMetadata?: Record<string, unknown>;
};

type FinalizeStudySessionResult = {
  duplicatedSession: boolean;
  sessionId: string;
  sessionIds: string[];
  sessionDateKey: string;
  sessionMinutes: number;
  totalMinutesAfterSession: number;
  totalMinutesByDateKey: Record<string, number>;
  attendanceAchieved: boolean;
  bonus6hAchieved: boolean;
};

type AttendanceSeatStatus = "studying" | "away" | "break" | "absent";
type AttendanceTransitionSource =
  | "student_dashboard"
  | "kiosk"
  | "teacher_dashboard"
  | "admin_focus_board"
  | "student_index";
type AttendanceSeatHint = {
  seatNo?: number | null;
  roomId?: string | null;
  roomSeatNo?: number | null;
};
type ApplyAttendanceStatusTransitionParams = {
  db: admin.firestore.Firestore;
  centerId: string;
  studentId: string;
  nextStatus: AttendanceSeatStatus;
  source: AttendanceTransitionSource;
  actorUid?: string | null;
  seatId?: string | null;
  seatHint?: AttendanceSeatHint | null;
  fallbackStartTimeMs?: number | null;
  nowMs?: number;
};
type ApplyAttendanceStatusTransitionResult = {
  ok: true;
  noop: boolean;
  previousStatus: AttendanceSeatStatus;
  nextStatus: AttendanceSeatStatus;
  seatId: string | null;
  eventType: "check_in" | "away_start" | "away_end" | "check_out" | null;
  eventId: string | null;
  eventAtMillis: number | null;
  duplicatedSession: boolean;
  sessionId: string | null;
  sessionDateKey: string | null;
  sessionMinutes: number;
  totalMinutesAfterSession: number;
  attendanceAchieved: boolean;
  bonus6hAchieved: boolean;
};

function normalizeAttendanceSeatStatus(value: unknown): AttendanceSeatStatus {
  const normalized = asTrimmedString(value).toLowerCase();
  if (normalized === "studying") return "studying";
  if (normalized === "away") return "away";
  if (normalized === "break") return "break";
  return "absent";
}

function parseAttendanceSeatStatus(value: unknown): AttendanceSeatStatus | null {
  const normalized = asTrimmedString(value).toLowerCase();
  if (normalized === "studying" || normalized === "away" || normalized === "break" || normalized === "absent") {
    return normalized;
  }
  return null;
}

function parseAttendanceTransitionSource(value: unknown): AttendanceTransitionSource | null {
  const normalized = asTrimmedString(value);
  if (
    normalized === "student_dashboard" ||
    normalized === "kiosk" ||
    normalized === "teacher_dashboard" ||
    normalized === "admin_focus_board" ||
    normalized === "student_index"
  ) {
    return normalized;
  }
  return null;
}

function getStudySessionDurationMinutesFromData(data: Record<string, unknown>): number {
  const rawMinutes = Number(data.durationMinutes ?? 0);
  if (Number.isFinite(rawMinutes) && rawMinutes > 0) {
    return Math.max(0, Math.round(rawMinutes));
  }

  const rawSeconds = Number(data.durationSeconds ?? 0);
  if (Number.isFinite(rawSeconds) && rawSeconds > 0) {
    return Math.max(1, Math.ceil(rawSeconds / 60));
  }

  const startMs = toMillisSafe(data.startTime);
  const endMs = toMillisSafe(data.endTime);
  if (startMs > 0 && endMs > startMs) {
    return Math.max(1, Math.ceil((endMs - startMs) / MINUTE_MS));
  }

  return 0;
}

function getStoredStudyTotalMinutes(data: Record<string, unknown> | null | undefined, keys: string[]): number {
  if (!data) return 0;
  for (const key of keys) {
    const value = parseFiniteNumber(data[key]);
    if (value !== null && value > 0) {
      return Math.max(0, Math.round(value));
    }
  }
  return 0;
}

function getLegacyStudyCarryoverMinutes(storedTotalMinutes: number, sessionTotalMinutes: number): number {
  return Math.max(0, Math.round(storedTotalMinutes) - Math.max(0, Math.round(sessionTotalMinutes)));
}

function getStudySessionProtectionArchiveRef(params: {
  db: admin.firestore.Firestore;
  centerId: string;
  studentId: string;
  dateKey: string;
  sessionId: string;
}) {
  const safeSessionId = asTrimmedString(params.sessionId).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 140);
  const archiveId = `${params.dateKey}_${params.studentId}_${safeSessionId}_${Date.now()}`;
  return params.db.doc(`centers/${params.centerId}/studySessionProtectionLogs/${archiveId}`);
}

async function hasStudySessionDeletionAllowance(params: {
  db: admin.firestore.Firestore;
  centerId: string;
  studentId: string;
  sessionId?: string;
}): Promise<boolean> {
  const allowanceSnap = await params.db
    .doc(`centers/${params.centerId}/studySessionDeletionAllowances/${params.studentId}`)
    .get();
  if (!allowanceSnap.exists) return false;
  const allowanceData = (allowanceSnap.data() || {}) as Record<string, unknown>;
  const expiresAtMs = toMillisSafe(allowanceData.expiresAt);
  const allowedSessionId = asTrimmedString(allowanceData.sessionId);
  if (allowedSessionId && params.sessionId && allowedSessionId !== params.sessionId) return false;
  return expiresAtMs <= 0 || expiresAtMs > Date.now();
}

async function archiveProtectedStudySessionMutation(params: {
  db: admin.firestore.Firestore;
  centerId: string;
  studentId: string;
  dateKey: string;
  sessionId: string;
  reason: "deleted_session_restored" | "shrunk_session_restored";
  beforeData: Record<string, unknown>;
  afterData?: Record<string, unknown> | null;
}): Promise<void> {
  const beforeMinutes = getStudySessionDurationMinutesFromData(params.beforeData);
  const afterMinutes = params.afterData ? getStudySessionDurationMinutesFromData(params.afterData) : null;
  await getStudySessionProtectionArchiveRef(params).set({
    centerId: params.centerId,
    studentId: params.studentId,
    dateKey: params.dateKey,
    sessionId: params.sessionId,
    reason: params.reason,
    beforeData: params.beforeData,
    afterData: params.afterData || null,
    beforeMinutes,
    afterMinutes,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

const STUDY_BOX_REWARD_RANGE_BY_RARITY: Record<StudyBoxRarity, readonly [number, number]> = {
  common: [1, 10],
  rare: [10, 20],
  epic: [20, 30],
};
const EARLY_STUDY_BOX_RARITY_WEIGHTS: Array<{ rarity: StudyBoxRarity; weight: number }> = [
  { rarity: "common", weight: 80 },
  { rarity: "rare", weight: 17 },
  { rarity: "epic", weight: 3 },
];
const LATE_STUDY_BOX_RARITY_WEIGHTS: Array<{ rarity: StudyBoxRarity; weight: number }> = [
  { rarity: "common", weight: 60 },
  { rarity: "rare", weight: 30 },
  { rarity: "epic", weight: 10 },
];
const DAILY_POINT_EARN_CAP = 1000;
const PLANNER_COMPLETION_REWARD_POINTS = 5;
const PLANNER_COMPLETION_DAILY_REWARD_LIMIT = 4;
const ACTIVE_STUDY_ATTENDANCE_STATUS_VALUES = ["studying", "away", "break"] as const;
const ACTIVE_STUDY_ATTENDANCE_STATUSES = new Set<string>(ACTIVE_STUDY_ATTENDANCE_STATUS_VALUES);
const STUDY_DAY_RESET_HOUR = 1;
const STUDY_BOX_CARRYOVER_GRACE_MINUTES = 30;
const STUDY_DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const SECOND_MS = 1000;
const MAX_STUDY_SESSION_MINUTES = 360;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStudyBoxHoursFromUnknown(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => {
          if (typeof entry === "number") return entry;
          if (typeof entry === "string") {
            const trimmed = entry.trim().toLowerCase();
            if (!trimmed) return Number.NaN;
            const legacyMatch = trimmed.match(/^(\d+)\s*(?:h|시간)$/);
            return Number(legacyMatch?.[1] ?? trimmed);
          }
          return Number.NaN;
        })
        .filter((entry) => Number.isFinite(entry) && entry >= 1 && entry <= 8)
        .map((entry) => Math.round(entry))
    )
  ).sort((a, b) => a - b);
}

function normalizeStoredStudyBoxReward(value: unknown): SecureStudyBoxReward | null {
  if (!isPlainObject(value)) return null;

  const milestone = Math.round(parseFiniteNumber(value.milestone) ?? Number.NaN);
  const rarity = asTrimmedString(value.rarity) as StudyBoxRarity;
  const minReward = Math.round(parseFiniteNumber(value.minReward) ?? Number.NaN);
  const maxReward = Math.round(parseFiniteNumber(value.maxReward) ?? Number.NaN);
  const awardedPoints = Math.round(parseFiniteNumber(value.awardedPoints) ?? Number.NaN);
  const basePoints = Math.round(parseFiniteNumber(value.basePoints) ?? awardedPoints);
  const multiplier = Math.max(1, parseFiniteNumber(value.multiplier) ?? 1);
  const earnedAt = asTrimmedString(value.earnedAt);
  const boostEventId = asTrimmedString(value.boostEventId);

  if (!Number.isFinite(milestone) || milestone < 1 || milestone > 8) return null;
  if (rarity !== "common" && rarity !== "rare" && rarity !== "epic") return null;
  if (!Number.isFinite(minReward) || !Number.isFinite(maxReward) || !Number.isFinite(basePoints) || !Number.isFinite(awardedPoints)) return null;

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

function normalizeStudyBoxRewardEntries(existing: unknown): SecureStudyBoxReward[] {
  return Array.isArray(existing)
    ? existing
        .map((entry) => normalizeStoredStudyBoxReward(entry))
        .filter((entry): entry is SecureStudyBoxReward => Boolean(entry))
    : [];
}

function upsertStudyBoxRewardEntries(existing: unknown, reward: SecureStudyBoxReward): SecureStudyBoxReward[] {
  const entries = normalizeStudyBoxRewardEntries(existing);

  const next = new Map<number, SecureStudyBoxReward>();
  entries.forEach((entry) => {
    next.set(entry.milestone, entry);
  });
  next.set(reward.milestone, reward);

  return Array.from(next.values()).sort((a, b) => a.milestone - b.milestone);
}

function normalizePlannerCompletionRewardTaskIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => asTrimmedString(entry))
        .filter((entry) => entry.length > 0)
    )
  ).slice(-200);
}

function normalizeDailyPointEventEntry(value: unknown): DailyPointEventDoc | null {
  if (!isPlainObject(value)) return null;

  const id = asTrimmedString(value.id);
  const source = asTrimmedString(value.source) as DailyPointEventDoc["source"];
  const label = asTrimmedString(value.label);
  const points = Math.max(0, Math.floor(parseFiniteNumber(value.points) ?? 0));
  const createdAt = asTrimmedString(value.createdAt);

  if (!id || !source || !label || points <= 0 || !createdAt) return null;
  if (!["study_box", "daily_rank", "weekly_rank", "monthly_rank", "plan_completion", "manual_adjustment", "legacy"].includes(source)) {
    return null;
  }

  const event: DailyPointEventDoc = {
    id,
    source,
    label,
    points,
    createdAt,
  };

  const hour = Math.round(parseFiniteNumber(value.hour) ?? Number.NaN);
  if (Number.isFinite(hour) && hour >= 1 && hour <= 8) event.hour = hour;

  const range = asTrimmedString(value.range);
  if (range === "daily" || range === "weekly" || range === "monthly") event.range = range;

  const rank = Math.max(0, Math.floor(parseFiniteNumber(value.rank) ?? 0));
  if (rank > 0) event.rank = rank;

  const periodKey = asTrimmedString(value.periodKey);
  if (periodKey) event.periodKey = periodKey;

  const awardDateKey = asTrimmedString(value.awardDateKey);
  if (awardDateKey) event.awardDateKey = awardDateKey;

  const paidAt = asTrimmedString(value.paidAt);
  if (paidAt) event.paidAt = paidAt;

  const deltaPoints = Math.round(parseFiniteNumber(value.deltaPoints) ?? Number.NaN);
  if (Number.isFinite(deltaPoints) && deltaPoints !== 0) {
    event.deltaPoints = deltaPoints;
  }

  const direction = asTrimmedString(value.direction);
  if (direction === "add" || direction === "subtract") {
    event.direction = direction;
  }

  const reason = asTrimmedString(value.reason);
  if (reason) event.reason = reason.slice(0, 160);

  return event;
}

function normalizeDailyPointEvents(value: unknown): DailyPointEventDoc[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeDailyPointEventEntry(entry))
    .filter((entry): entry is DailyPointEventDoc => entry !== null)
    .slice(-80);
}

function upsertDailyPointEvent(existing: unknown, event: DailyPointEventDoc): DailyPointEventDoc[] {
  const next = new Map<string, DailyPointEventDoc>();
  normalizeDailyPointEvents(existing).forEach((entry) => {
    next.set(entry.id, entry);
  });
  next.set(event.id, event);
  return Array.from(next.values()).slice(-80);
}

function getOpenedStudyBoxAwardTotal(dayStatus: Record<string, unknown>): number {
  const openedHourSet = new Set(resolveOpenedStudyBoxHoursFromDayStatus(dayStatus));
  return normalizeStudyBoxRewardEntries(dayStatus.studyBoxRewards)
    .filter((entry) => openedHourSet.has(entry.milestone))
    .reduce((total, entry) => total + Math.max(0, Math.floor(entry.awardedPoints)), 0);
}

function getLegacyDailyPointAwardTotal(dayStatus: Record<string, unknown>): number {
  const studyBoxPoints = getOpenedStudyBoxAwardTotal(dayStatus);
  const rankRewardPoints = getRankRewardAwardTotal(dayStatus);
  return studyBoxPoints + rankRewardPoints;
}

function getDailyAwardedPointTotal(dayStatus: Record<string, unknown>): number {
  const dailyPointAmount = Math.max(0, Math.floor(parseFiniteNumber(dayStatus.dailyPointAmount) ?? 0));
  if (hasManualPointAdjustment(dayStatus)) {
    const legacyPointAmount = getLegacyDailyPointAwardTotal(dayStatus);
    const manualDelta = getManualPointAdjustmentDelta(dayStatus);
    const adjustedLegacyAmount = Math.max(0, legacyPointAmount + manualDelta);

    if (Math.abs(dailyPointAmount - adjustedLegacyAmount) <= 1) return dailyPointAmount;
    if (legacyPointAmount > 0) return adjustedLegacyAmount;
    return Math.max(0, dailyPointAmount + manualDelta);
  }
  return Math.max(dailyPointAmount, getLegacyDailyPointAwardTotal(dayStatus));
}

function hasManualPointAdjustment(dayStatus: Record<string, unknown>): boolean {
  const manualAdjustmentPoints = Math.round(parseFiniteNumber(dayStatus.manualAdjustmentPoints) ?? 0);
  if (manualAdjustmentPoints !== 0) return true;
  return normalizeDailyPointEvents(dayStatus.pointEvents).some((entry) =>
    entry.source === "manual_adjustment" && Math.round(parseFiniteNumber(entry.deltaPoints) ?? 0) !== 0
  );
}

function getManualPointAdjustmentDelta(dayStatus: Record<string, unknown>): number {
  const storedManualAdjustmentPoints = Math.round(parseFiniteNumber(dayStatus.manualAdjustmentPoints) ?? 0);
  if (storedManualAdjustmentPoints !== 0) return storedManualAdjustmentPoints;

  return normalizeDailyPointEvents(dayStatus.pointEvents).reduce((sum, entry) => {
    if (entry.source !== "manual_adjustment") return sum;

    const deltaPoints = Math.round(parseFiniteNumber(entry.deltaPoints) ?? 0);
    if (deltaPoints !== 0) return sum + deltaPoints;

    const points = Math.max(0, Math.floor(parseFiniteNumber(entry.points) ?? 0));
    if (points <= 0) return sum;
    return entry.direction === "subtract" ? sum - points : sum + points;
  }, 0);
}

function getRankRewardAwardTotal(dayStatus: Record<string, unknown>): number {
  const dailyRankRewardAmount = Math.max(
    Math.floor(parseFiniteNumber(dayStatus.dailyRankRewardAmount) ?? 0),
    Math.floor(parseFiniteNumber(dayStatus.dailyTopRewardAmount) ?? 0)
  );
  const weeklyRankRewardAmount = Math.max(0, Math.floor(parseFiniteNumber(dayStatus.weeklyRankRewardAmount) ?? 0));
  const monthlyRankRewardAmount = Math.max(0, Math.floor(parseFiniteNumber(dayStatus.monthlyRankRewardAmount) ?? 0));

  return Math.max(0, dailyRankRewardAmount) + weeklyRankRewardAmount + monthlyRankRewardAmount;
}

function resolveOpenedStudyBoxHoursFromDayStatus(dayStatus: Record<string, unknown>): number[] {
  const explicitOpenedStudyBoxes = normalizeStudyBoxHoursFromUnknown(dayStatus.openedStudyBoxes);
  const claimedStudyBoxes = normalizeStudyBoxHoursFromUnknown(dayStatus.claimedStudyBoxes);
  const hasExplicitOpenedStudyBoxes = Object.prototype.hasOwnProperty.call(dayStatus, "openedStudyBoxes");

  if (hasExplicitOpenedStudyBoxes) return explicitOpenedStudyBoxes;
  if (claimedStudyBoxes.length === 0) return explicitOpenedStudyBoxes;

  const rewardEntries = normalizeStudyBoxRewardEntries(dayStatus.studyBoxRewards);
  const rewardByHour = new Map<number, number>();
  rewardEntries.forEach((entry) => {
    rewardByHour.set(entry.milestone, Math.max(0, Math.floor(entry.awardedPoints)));
  });

  if (explicitOpenedStudyBoxes.some((hour) => !rewardByHour.has(hour))) {
    return explicitOpenedStudyBoxes;
  }

  const persistedDailyPointAmount = Math.max(0, Math.floor(parseFiniteNumber(dayStatus.dailyPointAmount) ?? 0));
  const studyBoxAwardedPoints = Math.max(0, persistedDailyPointAmount - getRankRewardAwardTotal(dayStatus));
  const explicitOpenedStudyBoxPoints = explicitOpenedStudyBoxes.reduce(
    (total, hour) => total + (rewardByHour.get(hour) ?? 0),
    0
  );
  const remainingAwardedStudyBoxPoints = Math.max(0, studyBoxAwardedPoints - explicitOpenedStudyBoxPoints);
  const missingClaimedStudyBoxes = claimedStudyBoxes.filter(
    (hour) => !explicitOpenedStudyBoxes.includes(hour) && rewardByHour.has(hour)
  );

  if (missingClaimedStudyBoxes.length === 0) return explicitOpenedStudyBoxes;

  const missingClaimedRewardTotal = missingClaimedStudyBoxes.reduce(
    (total, hour) => total + (rewardByHour.get(hour) ?? 0),
    0
  );

  if (missingClaimedRewardTotal > 0 && remainingAwardedStudyBoxPoints < missingClaimedRewardTotal) {
    return explicitOpenedStudyBoxes;
  }

  return normalizeStudyBoxHoursFromUnknown([...explicitOpenedStudyBoxes, ...missingClaimedStudyBoxes]);
}

function clampDailyPointAward(dayStatus: Record<string, unknown>, requestedPoints: number) {
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

function getStudyBoxRarityWeights(milestone: number) {
  return milestone >= 5 ? LATE_STUDY_BOX_RARITY_WEIGHTS : EARLY_STUDY_BOX_RARITY_WEIGHTS;
}

function hashSeedToUInt32(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnitInterval(seed: string): number {
  return hashSeedToUInt32(seed) / 0xffffffff;
}

function rollDeterministicStudyBoxRarity(milestone: number, seed: string): StudyBoxRarity {
  const weights = getStudyBoxRarityWeights(milestone);
  const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
  const rolled = seededUnitInterval(`${seed}:rarity`) * totalWeight;
  let cursor = 0;

  for (const entry of weights) {
    cursor += entry.weight;
    if (rolled < cursor) return entry.rarity;
  }

  return weights.at(-1)?.rarity ?? "common";
}

function buildDeterministicStudyBoxReward(params: {
  centerId: string;
  studentId: string;
  dateKey: string;
  milestone: number;
}): SecureStudyBoxReward {
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

function normalizePointBoostMode(value: unknown): PointBoostEventMode | null {
  if (value === "day" || value === "window") return value;
  return null;
}

function normalizePointBoostMultiplier(value: unknown): number | null {
  const multiplier = parseFiniteNumber(value);
  if (multiplier === null || !Number.isFinite(multiplier)) return null;
  if (multiplier <= 1 || multiplier > 100) return null;
  return Number(multiplier.toFixed(2));
}

function formatPointBoostMultiplierLabel(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "1배";
  return Number.isInteger(value) ? `${value.toFixed(0)}배` : `${value.toFixed(2).replace(/\.?0+$/, "")}배`;
}

function buildDefaultPointBoostMessage(multiplier: number): string {
  return `지금부터 상자 pt가 ${formatPointBoostMultiplierLabel(multiplier)}로 적용돼요. 집중한 만큼 더 크게 받아가세요!`;
}

function normalizePointBoostMessage(value: unknown, multiplier: number): string {
  if (typeof value !== "string") {
    return buildDefaultPointBoostMessage(multiplier);
  }

  const trimmed = value.trim().slice(0, 160);
  return trimmed || buildDefaultPointBoostMessage(multiplier);
}

function isPointBoostEventCancelled(value: unknown): boolean {
  return toMillisSafe((value as PointBoostEventDoc | null | undefined)?.cancelledAt) > 0;
}

function isPointBoostEventActiveAt(value: unknown, targetMs: number): boolean {
  const event = value as PointBoostEventDoc | null | undefined;
  const startAtMs = toMillisSafe(event?.startAt);
  const endAtMs = toMillisSafe(event?.endAt);
  if (startAtMs <= 0 || endAtMs <= 0) return false;
  if (isPointBoostEventCancelled(event)) return false;
  return startAtMs <= targetMs && targetMs < endAtMs;
}

function doTimeRangesOverlap(startAtMs: number, endAtMs: number, otherStartAtMs: number, otherEndAtMs: number): boolean {
  return startAtMs < otherEndAtMs && otherStartAtMs < endAtMs;
}

async function listPointBoostEventDocs(
  db: admin.firestore.Firestore,
  centerId: string,
  limitCount = 200
): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  const snap = await db
    .collection(`centers/${centerId}/pointBoostEvents`)
    .orderBy("startAt", "desc")
    .limit(limitCount)
    .get();
  return snap.docs;
}

function buildStudyTimelineSegments(params: {
  sessionDocs: FirebaseFirestore.QueryDocumentSnapshot[];
  liveSessionStartMs?: number;
  liveSessionDurationSeconds?: number;
}): StudyTimelineSegment[] {
  const segments: StudyTimelineSegment[] = [];

  params.sessionDocs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const startAtMs = toMillisSafe(data.startTime);
    const durationMinutes = Math.max(0, Math.floor(parseFiniteNumber(data.durationMinutes) ?? 0));
    const durationSeconds = Math.max(
      0,
      Math.floor(parseFiniteNumber(data.durationSeconds) ?? durationMinutes * 60)
    );
    if (startAtMs <= 0 || durationSeconds <= 0) return;
    segments.push({
      startAtMs,
      durationMinutes: Math.max(durationMinutes, Math.ceil(durationSeconds / 60)),
      durationSeconds,
    });
  });

  if ((params.liveSessionStartMs ?? 0) > 0 && (params.liveSessionDurationSeconds ?? 0) > 0) {
    segments.push({
      startAtMs: params.liveSessionStartMs ?? 0,
      durationMinutes: Math.max(1, Math.ceil((params.liveSessionDurationSeconds ?? 0) / 60)),
      durationSeconds: Math.max(1, Math.floor(params.liveSessionDurationSeconds ?? 0)),
    });
  }

  return segments.sort((left, right) => left.startAtMs - right.startAtMs);
}

function resolveStudyBoxMilestoneEarnedAtMs(params: {
  milestone: number;
  persistedDayMinutes: number;
  sessionDocs: FirebaseFirestore.QueryDocumentSnapshot[];
  liveSessionStartMs?: number;
  liveSessionDurationSeconds?: number;
}): number | null {
  const thresholdSeconds = Math.max(1, Math.floor(params.milestone)) * 3600;
  let cumulativeSeconds = 0;

  for (const segment of buildStudyTimelineSegments(params)) {
    const nextCumulativeSeconds = cumulativeSeconds + segment.durationSeconds;
    if (nextCumulativeSeconds < thresholdSeconds) {
      cumulativeSeconds = nextCumulativeSeconds;
      continue;
    }

    const remainingSeconds = Math.max(0, thresholdSeconds - cumulativeSeconds);
    return segment.startAtMs + remainingSeconds * SECOND_MS;
  }

  if (params.persistedDayMinutes * 60 >= thresholdSeconds) {
    return null;
  }

  return null;
}

async function finalizeStudySession(params: FinalizeStudySessionParams): Promise<FinalizeStudySessionResult> {
  const { db, centerId, studentId, closeSeatRef, shouldCloseSeat, closeAttendanceEvent, progressExtra, sessionMetadata } = params;
  const startMs = Math.max(0, Math.floor(params.startMs));
  const rawEndMs = Math.max(startMs, Math.floor(params.endMs));
  const effectiveEndMs = Math.min(rawEndMs, startMs + MAX_STUDY_SESSION_MINUTES * MINUTE_MS);
  const sessionDateKey = isValidDateKey(asTrimmedString(params.dateKeyOverride))
    ? asTrimmedString(params.dateKeyOverride)
    : toStudyDayKey(new Date(startMs));
  const segments = buildStartAnchoredStudyDaySegment(startMs, effectiveEndMs, sessionDateKey);
  const progressRef = db.doc(`centers/${centerId}/growthProgress/${studentId}`);
  const activeSessionDateKey = sessionDateKey;
  const sessionEntries = segments.map((segment) => {
    const sessionId = `session_${startMs}_${segment.startMs}`;
    const dayRef = db.doc(`centers/${centerId}/studyLogs/${studentId}/days/${segment.dateKey}`);
    return {
      ...segment,
      sessionId,
      dayRef,
      sessionRef: dayRef.collection("sessions").doc(sessionId),
    };
  });

  return db.runTransaction(async (transaction) => {
    const progressSnap = await transaction.get(progressRef);
    const uniqueSessionDayRefs = Array.from(new Map(sessionEntries.map((entry) => [entry.dateKey, entry.dayRef])).entries());
    const existingSessionSnaps = await Promise.all(
      uniqueSessionDayRefs.map(([, dayRef]) => transaction.get(dayRef.collection("sessions")))
    );
    const daySnapshots = await Promise.all(sessionEntries.map((entry) => transaction.get(entry.dayRef)));
    const sessionSnapshots = await Promise.all(sessionEntries.map((entry) => transaction.get(entry.sessionRef)));
    const dayDataByDateKey = new Map<string, Record<string, unknown>>();
    sessionEntries.forEach((entry, index) => {
      if (dayDataByDateKey.has(entry.dateKey)) return;
      const daySnap = daySnapshots[index];
      dayDataByDateKey.set(entry.dateKey, daySnap.exists ? ((daySnap.data() || {}) as Record<string, unknown>) : {});
    });
    const progressData = progressSnap.exists ? (progressSnap.data() as Record<string, unknown>) : {};
    const dailyPointStatus = isPlainObject(progressData.dailyPointStatus)
      ? (progressData.dailyPointStatus as Record<string, unknown>)
      : {};
    const existingSessionTotalMinutesByDateKey = Object.fromEntries(
      uniqueSessionDayRefs.map(([dateKey], index) => [
        dateKey,
        existingSessionSnaps[index].docs.reduce(
          (sum, docSnap) => sum + getStudySessionDurationMinutesFromData((docSnap.data() || {}) as Record<string, unknown>),
          0
        ),
      ])
    ) as Record<string, number>;
    const existingDayTotalMinutesByDateKey = Object.fromEntries(
      uniqueSessionDayRefs.map(([dateKey]) => [
        dateKey,
        getStoredStudyTotalMinutes(dayDataByDateKey.get(dateKey), ["totalMinutes", "totalStudyMinutes"]),
      ])
    ) as Record<string, number>;

    const totalMinutesByDateKey: Record<string, number> = {};
    const dailyPointStatusUpdates: Record<string, Record<string, unknown>> = {};
    let attendanceAchieved = false;
    let bonus6hAchieved = false;

    sessionEntries.forEach((entry, index) => {
      const daySnap = daySnapshots[index];
      const sessionSnap = sessionSnapshots[index];
      const dayData = daySnap.exists ? (daySnap.data() as Record<string, unknown>) : {};
      const previousFirstSessionAt = toTimestampOrNow(dayData.firstSessionStartAt);
      const previousLastSessionAt = toTimestampOrNow(dayData.lastSessionEndAt);
      const existingSessionTotalMinutes = Math.max(0, Math.floor(existingSessionTotalMinutesByDateKey[entry.dateKey] ?? 0));
      const existingDayTotalMinutes = Math.max(0, Math.floor(existingDayTotalMinutesByDateKey[entry.dateKey] ?? 0));
      const existingTotalMinutes =
        totalMinutesByDateKey[entry.dateKey] ??
        Math.max(existingSessionTotalMinutes, existingDayTotalMinutes);

      totalMinutesByDateKey[entry.dateKey] = existingTotalMinutes;

      if (sessionSnap.exists || entry.durationMinutes <= 0) {
        return;
      }

      const awayGapMinutes = entry.startMs === startMs && previousLastSessionAt
        ? Math.round((entry.startMs - previousLastSessionAt.toMillis()) / MINUTE_MS)
        : 0;
      const normalizedAwayGapMinutes = awayGapMinutes > 0 && awayGapMinutes < 180 ? awayGapMinutes : 0;
      const nextFirstSessionAt =
        previousFirstSessionAt && previousFirstSessionAt.toMillis() <= entry.startMs
          ? previousFirstSessionAt
          : admin.firestore.Timestamp.fromMillis(entry.startMs);
      const nextLastSessionAt =
        previousLastSessionAt && previousLastSessionAt.toMillis() >= entry.endMs
          ? previousLastSessionAt
          : admin.firestore.Timestamp.fromMillis(entry.endMs);
      const nextTotalMinutes = existingTotalMinutes + entry.durationMinutes;
      totalMinutesByDateKey[entry.dateKey] = nextTotalMinutes;

      transaction.set(
        entry.dayRef,
        {
          studentId,
          centerId,
          dateKey: entry.dateKey,
          totalMinutes: nextTotalMinutes,
          firstSessionStartAt: nextFirstSessionAt,
          lastSessionEndAt: nextLastSessionAt,
          ...(normalizedAwayGapMinutes > 0 ? { awayMinutes: admin.firestore.FieldValue.increment(normalizedAwayGapMinutes) } : {}),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      transaction.set(
        entry.sessionRef,
        {
          centerId,
          studentId,
          dateKey: entry.dateKey,
          startTime: admin.firestore.Timestamp.fromMillis(entry.startMs),
          endTime: admin.firestore.Timestamp.fromMillis(entry.endMs),
          durationMinutes: entry.durationMinutes,
          durationSeconds: entry.durationSeconds,
          sessionId: entry.sessionId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          ...(sessionMetadata ?? {}),
        },
        { merge: true }
      );

      const currentDayStatus = isPlainObject(dailyPointStatus[entry.dateKey])
        ? { ...(dailyPointStatus[entry.dateKey] as Record<string, unknown>) }
        : {};
      let shouldPersistDayStatus = false;
      const currentClaimedStudyBoxes = normalizeStudyBoxHoursFromUnknown(currentDayStatus.claimedStudyBoxes);
      const crossedMilestones = Math.max(0, Math.min(8, Math.floor(nextTotalMinutes / 60)));
      const nextClaimedStudyBoxes = normalizeStudyBoxHoursFromUnknown([
        ...currentClaimedStudyBoxes,
        ...Array.from({ length: crossedMilestones }, (_, index) => index + 1),
      ]);
      if (nextClaimedStudyBoxes.length > currentClaimedStudyBoxes.length) {
        currentDayStatus.claimedStudyBoxes = nextClaimedStudyBoxes;
        shouldPersistDayStatus = true;
      }

      const storedRewardEntries = normalizeStudyBoxRewardEntries(currentDayStatus.studyBoxRewards);
      let nextRewardEntries = storedRewardEntries;
      nextClaimedStudyBoxes
        .filter((hour) => !storedRewardEntries.some((rewardEntry) => rewardEntry.milestone === hour))
        .forEach((hour) => {
          nextRewardEntries = upsertStudyBoxRewardEntries(
            nextRewardEntries,
            buildDeterministicStudyBoxReward({
              centerId,
              studentId,
              dateKey: entry.dateKey,
              milestone: hour,
            })
          );
        });
      if (nextRewardEntries.length > storedRewardEntries.length) {
        currentDayStatus.studyBoxRewards = nextRewardEntries;
        shouldPersistDayStatus = true;
      }

      if (nextTotalMinutes >= 180 && currentDayStatus.attendance !== true) {
        currentDayStatus.attendance = true;
        attendanceAchieved = true;
        shouldPersistDayStatus = true;
      }
      if (nextTotalMinutes >= 360 && currentDayStatus.bonus6h !== true) {
        currentDayStatus.bonus6h = true;
        bonus6hAchieved = true;
        shouldPersistDayStatus = true;
      }

      if (shouldPersistDayStatus) {
        currentDayStatus.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        dailyPointStatusUpdates[entry.dateKey] = currentDayStatus;
      }
    });

    const createdSessionEntries = sessionEntries.filter((entry, index) => {
      const sessionSnap = sessionSnapshots[index];
      return !sessionSnap.exists && entry.durationMinutes > 0;
    });

    uniqueSessionDayRefs.forEach(([dateKey, dayRef], dayIndex) => {
      const dayData = dayDataByDateKey.get(dateKey) || {};
      const existingSessionTotalMinutes = Math.max(0, Math.floor(existingSessionTotalMinutesByDateKey[dateKey] ?? 0));
      const existingDayTotalMinutes = Math.max(0, Math.floor(existingDayTotalMinutesByDateKey[dateKey] ?? 0));
      const legacyCarryoverMinutes = getLegacyStudyCarryoverMinutes(existingDayTotalMinutes, existingSessionTotalMinutes);
      const existingSessionData = existingSessionSnaps[dayIndex].docs.map((docSnap) => {
        return (docSnap.data() || {}) as Record<string, unknown>;
      });
      const createdSessionData = createdSessionEntries
        .filter((entry) => entry.dateKey === dateKey)
        .map((entry) => ({
          startTime: admin.firestore.Timestamp.fromMillis(entry.startMs),
          endTime: admin.firestore.Timestamp.fromMillis(entry.endMs),
          durationMinutes: entry.durationMinutes,
          durationSeconds: entry.durationSeconds,
        }));
      const allSessionData = [...existingSessionData, ...createdSessionData];
      if (allSessionData.length === 0) return;

      const recomputedSessionMinutes = allSessionData.reduce((sum, sessionData) => {
        return sum + getStudySessionDurationMinutesFromData(sessionData);
      }, 0);
      const firstSessionStartMsFromSessions = allSessionData
        .map((sessionData) => toMillisSafe(sessionData.startTime))
        .filter((value) => value > 0)
        .sort((left, right) => left - right)[0] ?? 0;
      const lastSessionEndMsFromSessions = allSessionData
        .map((sessionData) => toMillisSafe(sessionData.endTime))
        .filter((value) => value > 0)
        .sort((left, right) => right - left)[0] ?? 0;
      const previousFirstSessionMs = legacyCarryoverMinutes > 0 ? toMillisSafe(dayData.firstSessionStartAt) : 0;
      const previousLastSessionMs = legacyCarryoverMinutes > 0 ? toMillisSafe(dayData.lastSessionEndAt) : 0;
      const firstSessionStartMs = [previousFirstSessionMs, firstSessionStartMsFromSessions]
        .filter((value) => value > 0)
        .sort((left, right) => left - right)[0] ?? 0;
      const lastSessionEndMs = [previousLastSessionMs, lastSessionEndMsFromSessions]
        .filter((value) => value > 0)
        .sort((left, right) => right - left)[0] ?? 0;

      totalMinutesByDateKey[dateKey] = Math.max(0, Math.round(recomputedSessionMinutes + legacyCarryoverMinutes));
      transaction.set(
        dayRef,
        {
          studentId,
          centerId,
          dateKey,
          totalMinutes: totalMinutesByDateKey[dateKey],
          ...(legacyCarryoverMinutes > 0 ? { legacyCarryoverMinutes } : {}),
          firstSessionStartAt: firstSessionStartMs > 0
            ? admin.firestore.Timestamp.fromMillis(firstSessionStartMs)
            : admin.firestore.FieldValue.delete(),
          lastSessionEndAt: lastSessionEndMs > 0
            ? admin.firestore.Timestamp.fromMillis(lastSessionEndMs)
            : admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      transaction.set(
        db.doc(`centers/${centerId}/dailyStudentStats/${dateKey}/students/${studentId}`),
        {
          studentId,
          centerId,
          dateKey,
          totalStudyMinutes: totalMinutesByDateKey[dateKey],
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    const createdSessionCount = sessionEntries.reduce((count, entry, index) => {
      const sessionSnap = sessionSnapshots[index];
      return count + (!sessionSnap.exists && entry.durationMinutes > 0 ? 1 : 0);
    }, 0);

    if (shouldCloseSeat && closeSeatRef) {
      transaction.set(
        closeSeatRef,
        {
          status: "absent",
          lastCheckInAt: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    if (shouldCloseSeat && closeAttendanceEvent && createdSessionCount > 0) {
      const closeEventAt = admin.firestore.Timestamp.fromMillis(
        Math.max(startMs, Math.floor(closeAttendanceEvent.eventAtMs || effectiveEndMs))
      );
      const closeEventRef = db.collection(`centers/${centerId}/attendanceEvents`).doc();
      transaction.set(closeEventRef, {
        studentId,
        dateKey: closeAttendanceEvent.dateKey,
        eventType: "check_out",
        occurredAt: closeEventAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: closeAttendanceEvent.source,
        ...(closeAttendanceEvent.seatId ? { seatId: closeAttendanceEvent.seatId } : {}),
        ...(closeAttendanceEvent.statusBefore ? { statusBefore: closeAttendanceEvent.statusBefore } : {}),
        statusAfter: closeAttendanceEvent.statusAfter || "absent",
      });

      const attendanceStatRef = db.doc(`centers/${centerId}/attendanceDailyStats/${closeAttendanceEvent.dateKey}/students/${studentId}`);
      transaction.set(attendanceStatRef, {
        centerId,
        studentId,
        dateKey: closeAttendanceEvent.dateKey,
        attendanceStatus: closeAttendanceEvent.statusAfter || "absent",
        checkOutAt: closeEventAt,
        hasCheckOutRecord: true,
        source: closeAttendanceEvent.source,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    const hasDailyPointStatusUpdates = Object.keys(dailyPointStatusUpdates).length > 0;
    if (hasDailyPointStatusUpdates || progressExtra) {
      transaction.set(
        progressRef,
        {
          ...(hasDailyPointStatusUpdates ? { dailyPointStatus: dailyPointStatusUpdates } : {}),
          ...(progressExtra ?? {}),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    const duplicatedSession = sessionSnapshots.every((snapshot) => snapshot.exists);
    return {
      duplicatedSession,
      sessionId: sessionEntries[0]?.sessionId ?? `session_${startMs}`,
      sessionIds: sessionEntries.map((entry) => entry.sessionId),
      sessionDateKey: activeSessionDateKey,
      sessionMinutes: sessionEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0),
      totalMinutesAfterSession: totalMinutesByDateKey[activeSessionDateKey] ?? 0,
      totalMinutesByDateKey,
      attendanceAchieved,
      bonus6hAchieved,
    };
  });
}

function getAttendanceActivityRank(status?: string | null): number {
  if (status === "studying") return 0;
  if (status === "away" || status === "break") return 1;
  if (status === "absent") return 3;
  return 2;
}

function pickPreferredAttendanceSeatDoc(
  docs: FirebaseFirestore.QueryDocumentSnapshot[]
): FirebaseFirestore.QueryDocumentSnapshot | null {
  if (!docs.length) return null;

  return [...docs].sort((a, b) => {
    const aData = a.data() as Record<string, unknown>;
    const bData = b.data() as Record<string, unknown>;
    const rankDiff = getAttendanceActivityRank(asTrimmedString(aData.status)) - getAttendanceActivityRank(asTrimmedString(bData.status));
    if (rankDiff !== 0) return rankDiff;

    const aTime = toMillisSafe(aData.lastCheckInAt) || toMillisSafe(aData.updatedAt);
    const bTime = toMillisSafe(bData.lastCheckInAt) || toMillisSafe(bData.updatedAt);
    return bTime - aTime;
  })[0] || null;
}

function normalizePhoneNumber(raw: unknown): string {
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("01")) return digits;
  if (digits.length === 10 && digits.startsWith("01")) return digits;
  return "";
}

function maskPhoneNumberForAudit(raw: unknown): string | null {
  const digits = normalizePhoneNumber(raw);
  if (!digits) return null;
  if (digits.length < 7) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4).replace(/\d/g, "*")}-${digits.slice(-4)}`;
}

function extractPhoneLast4(raw: unknown): string | null {
  const digits = normalizePhoneNumber(raw);
  return digits.length >= 4 ? digits.slice(-4) : null;
}

function resolveFirstValidPhoneNumber(...values: unknown[]): string {
  for (const value of values) {
    const normalized = normalizePhoneNumber(value);
    if (normalized) return normalized;
  }
  return "";
}

async function writeStudentPhoneNumberAuditLog(params: {
  db: FirebaseFirestore.Firestore;
  centerId: string;
  studentId: string;
  studentName?: string | null;
  studentClassName?: string | null;
  previousPhoneNumber?: string | null;
  nextPhoneNumber?: string | null;
  changedByUid: string;
  changedByRole: string | null;
  changedByName?: string | null;
  createdAt: admin.firestore.Timestamp;
}) {
  const previousPhoneNumber = normalizePhoneNumber(params.previousPhoneNumber);
  const nextPhoneNumber = normalizePhoneNumber(params.nextPhoneNumber);

  if (previousPhoneNumber === nextPhoneNumber) return;

  const payload: StudentAccountChangeLogDoc = {
    action: "student_phone_number_updated",
    centerId: params.centerId,
    studentId: params.studentId,
    studentName: params.studentName || null,
    studentClassName: params.studentClassName || null,
    field: "phoneNumber",
    previousValueMasked: maskPhoneNumberForAudit(previousPhoneNumber),
    nextValueMasked: maskPhoneNumberForAudit(nextPhoneNumber),
    previousValueLast4: extractPhoneLast4(previousPhoneNumber),
    nextValueLast4: extractPhoneLast4(nextPhoneNumber),
    changedByUid: params.changedByUid,
    changedByRole: params.changedByRole,
    changedByName: params.changedByName || null,
    source: "updateStudentAccount",
    createdAt: params.createdAt,
  };

  const logRef = params.db.collection(`centers/${params.centerId}/studentAccountChangeLogs`).doc();
  await logRef.set(payload);
}

function isCounselingDemoId(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;

  return (
    normalized.startsWith("counseling-demo-")
    || normalized.startsWith("demo-counseling-")
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function isCounselingDemoRecord(value: unknown): boolean {
  const record = asRecord(value);
  if (!record) return false;
  if (record.isCounselingDemo === true) return true;

  const accountKind = typeof record.accountKind === "string" ? record.accountKind.trim().toLowerCase() : "";
  return accountKind === "counseling-demo" || accountKind === "counseling_demo";
}

function shouldExcludeFromSmsQueries(value: unknown, id?: unknown): boolean {
  if (isCounselingDemoId(id)) return true;
  const record = asRecord(value);
  if (!record) return false;
  if (isCounselingDemoRecord(record)) return true;

  const exclusions = asRecord(record.operationalExclusions);
  return exclusions?.sms === true || exclusions?.messages === true;
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

function toStudyDayDate(baseDate: Date = new Date()): Date {
  const kstDate = toKstDate(baseDate);
  if (kstDate.getHours() < STUDY_DAY_RESET_HOUR) {
    kstDate.setDate(kstDate.getDate() - 1);
  }
  kstDate.setHours(0, 0, 0, 0);
  return kstDate;
}

function toStudyDayKey(baseDate: Date = new Date()): string {
  return toDateKey(toStudyDayDate(baseDate));
}

function getStudyDayWindowBounds(dateKey: string): { startMs: number; endMs: number } {
  const hourLabel = String(STUDY_DAY_RESET_HOUR).padStart(2, "0");
  const startMs = Date.parse(`${dateKey}T${hourLabel}:00:00+09:00`);
  return {
    startMs,
    endMs: startMs + STUDY_DAY_MS,
  };
}

function getPreviousDateKey(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00+09:00`);
  date.setDate(date.getDate() - 1);
  return toDateKey(date);
}

function getStudyBoxCarryoverExpiresAtMs(dateKey: string): number {
  return getStudyDayWindowBounds(dateKey).endMs + STUDY_BOX_CARRYOVER_GRACE_MINUTES * MINUTE_MS;
}

function hasStudyBoxCarryoverExpired(dateKey: string, baseDate: Date = new Date()): boolean {
  return baseDate.getTime() >= getStudyBoxCarryoverExpiresAtMs(dateKey);
}

function getExpiredStudyBoxCarryoverDateKey(baseDate: Date = new Date()): string {
  const currentStudyDayDate = toStudyDayDate(baseDate);
  currentStudyDayDate.setDate(currentStudyDayDate.getDate() - 1);
  return toDateKey(currentStudyDayDate);
}

function getTimeRangeOverlapMs(rangeStartMs: number, rangeEndMs: number, windowStartMs: number, windowEndMs: number): number {
  if (!Number.isFinite(rangeStartMs) || !Number.isFinite(rangeEndMs)) return 0;
  const overlapStartMs = Math.max(rangeStartMs, windowStartMs);
  const overlapEndMs = Math.min(rangeEndMs, windowEndMs);
  if (overlapEndMs <= overlapStartMs) return 0;
  return overlapEndMs - overlapStartMs;
}

function splitRangeByStudyDayBoundary(startMs: number, endMs: number): StudyDayRangeSegment[] {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];

  const segments: StudyDayRangeSegment[] = [];
  let cursorMs = startMs;

  while (cursorMs < endMs) {
    const dateKey = toStudyDayKey(new Date(cursorMs));
    const { startMs: windowStartMs, endMs: windowEndMs } = getStudyDayWindowBounds(dateKey);
    const segmentStartMs = Math.max(cursorMs, windowStartMs);
    const segmentEndMs = Math.min(endMs, windowEndMs);

    if (segmentEndMs <= segmentStartMs) {
      cursorMs = windowEndMs;
      continue;
    }

    const durationMs = segmentEndMs - segmentStartMs;
    segments.push({
      dateKey,
      startMs: segmentStartMs,
      endMs: segmentEndMs,
      durationMs,
      durationMinutes: Math.max(1, Math.ceil(durationMs / MINUTE_MS)),
      durationSeconds: Math.max(1, Math.ceil(durationMs / SECOND_MS)),
    });

    cursorMs = segmentEndMs;
  }

  return segments;
}

function buildStartAnchoredStudyDaySegment(startMs: number, endMs: number, dateKeyOverride?: string | null): StudyDayRangeSegment[] {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];

  const durationMs = endMs - startMs;
  const dateKey = asTrimmedString(dateKeyOverride);
  return [{
    dateKey: isValidDateKey(dateKey) ? dateKey : toStudyDayKey(new Date(startMs)),
    startMs,
    endMs,
    durationMs,
    durationMinutes: Math.max(1, Math.ceil(durationMs / MINUTE_MS)),
    durationSeconds: Math.max(1, Math.ceil(durationMs / SECOND_MS)),
  }];
}

function buildStudySessionOverlapDateKeys(startMs: number, endMs: number): string[] {
  const segmentKeys = splitRangeByStudyDayBoundary(startMs, endMs).map((segment) => segment.dateKey);
  const startDateKey = Number.isFinite(startMs) && startMs > 0 ? toStudyDayKey(new Date(startMs)) : "";
  const keys = Array.from(new Set([...segmentKeys, startDateKey].filter(Boolean)));
  return Array.from(new Set(keys.flatMap((dateKey) => [dateKey, getPreviousDateKey(dateKey)])));
}

function toTimeLabel(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function hasActiveOrSentSmsQueueStatus(status: unknown): boolean {
  const normalized = asTrimmedString(status);
  return normalized === "queued" || normalized === "processing" || normalized === "sent";
}

function hasRetryableSmsQueueStatus(status: unknown): boolean {
  const normalized = asTrimmedString(status);
  return normalized === "failed" || normalized === "pending_provider";
}

function parseHourMinute(value: unknown): { hour: number; minute: number } | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalized)) return null;
  const [hour, minute] = normalized.split(":").map((part) => Number(part));
  return { hour, minute };
}

function parseTimeToMinutes(value: unknown): number {
  const parsed = parseHourMinute(value);
  if (!parsed) return Number.NaN;
  return parsed.hour * 60 + parsed.minute;
}

function normalizeMembershipStatus(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function isActiveMembershipStatus(value: unknown): boolean {
  const normalized = normalizeMembershipStatus(value);
  return !normalized || normalized === "active" || normalized === "approved" || normalized === "enabled" || normalized === "current";
}

function normalizeMembershipRoleValue(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized === "owner" || normalized === "admin" || normalized === "centermanager" || normalized === "centeradmin") {
    return "centerAdmin";
  }
  if (normalized === "teacher") return "teacher";
  if (normalized === "parent") return "parent";
  if (normalized === "student") return "student";
  if (normalized === "kiosk") return "kiosk";
  return "";
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

type ResolvedCenterStudentIdentity = {
  studentId: string;
  memberData: Record<string, unknown> | null;
  studentProfileData: Record<string, unknown> | null;
  memberExists: boolean;
  studentProfileExists: boolean;
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
  let memberRole = normalizeMembershipRoleValue(memberData?.role);
  if (memberRole && isActiveMembershipStatus(memberData?.status)) {
    return {
      role: memberRole,
      status: memberData?.status,
    };
  }

  const userCenterData = userCenterSnap.exists ? (userCenterSnap.data() as any) : null;
  const userCenterRole = normalizeMembershipRoleValue(userCenterData?.role);
  if (userCenterRole && isActiveMembershipStatus(userCenterData?.status)) {
    return {
      role: userCenterRole,
      status: userCenterData?.status,
    };
  }

  if (!memberRole) {
    const fallbackMemberSnap = await db
      .collection(`centers/${centerId}/members`)
      .where("id", "==", uid)
      .limit(1)
      .get();
    const fallbackMemberData = fallbackMemberSnap.empty ? null : (fallbackMemberSnap.docs[0].data() as any);
    memberRole = normalizeMembershipRoleValue(fallbackMemberData?.role);
    if (memberRole && isActiveMembershipStatus(fallbackMemberData?.status)) {
      return {
        role: memberRole,
        status: fallbackMemberData?.status,
      };
    }
    if (memberRole) {
      return {
        role: memberRole,
        status: fallbackMemberData?.status,
      };
    }
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

async function resolveCenterStudentIdentity(
  db: admin.firestore.Firestore,
  centerId: string,
  uid: string
): Promise<ResolvedCenterStudentIdentity | null> {
  const [directMemberSnap, directStudentSnap] = await Promise.all([
    db.doc(`centers/${centerId}/members/${uid}`).get(),
    db.doc(`centers/${centerId}/students/${uid}`).get(),
  ]);

  if (directMemberSnap.exists || directStudentSnap.exists) {
    return {
      studentId: uid,
      memberData: directMemberSnap.exists ? (directMemberSnap.data() as Record<string, unknown>) : null,
      studentProfileData: directStudentSnap.exists ? (directStudentSnap.data() as Record<string, unknown>) : null,
      memberExists: directMemberSnap.exists,
      studentProfileExists: directStudentSnap.exists,
    };
  }

  const [fallbackMemberSnap, fallbackStudentSnap] = await Promise.all([
    db.collection(`centers/${centerId}/members`).where("id", "==", uid).limit(1).get(),
    db.collection(`centers/${centerId}/students`).where("id", "==", uid).limit(1).get(),
  ]);

  const fallbackMemberDoc = fallbackMemberSnap.empty ? null : fallbackMemberSnap.docs[0];
  const fallbackStudentDoc = fallbackStudentSnap.empty ? null : fallbackStudentSnap.docs[0];
  if (!fallbackMemberDoc && !fallbackStudentDoc) {
    return null;
  }

  return {
    studentId: fallbackMemberDoc?.id || fallbackStudentDoc?.id || uid,
    memberData: fallbackMemberDoc ? (fallbackMemberDoc.data() as Record<string, unknown>) : null,
    studentProfileData: fallbackStudentDoc ? (fallbackStudentDoc.data() as Record<string, unknown>) : null,
    memberExists: Boolean(fallbackMemberDoc),
    studentProfileExists: Boolean(fallbackStudentDoc),
  };
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

function normalizeUserFacingErrorMessage(raw: string): string {
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

function isSensitiveUserFacingErrorMessage(message: string): boolean {
  const normalized = normalizeUserFacingErrorMessage(message);
  if (!normalized) return true;
  if (normalized.length > 180) return true;
  if (normalized.includes("\n")) return true;
  return SENSITIVE_USER_MESSAGE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function toSafeUserMessage(error: unknown, fallback: string): string {
  const candidates: string[] = [];

  if (typeof error === "string") {
    candidates.push(error);
  }

  if (error && typeof error === "object") {
    const record = error as {
      message?: unknown;
      details?: unknown;
    };

    if (typeof record.message === "string") {
      candidates.push(record.message);
    }

    if (record.details && typeof record.details === "object") {
      const details = record.details as { userMessage?: unknown; message?: unknown; error?: unknown };
      if (typeof details.userMessage === "string") candidates.push(details.userMessage);
      if (typeof details.message === "string") candidates.push(details.message);
      if (typeof details.error === "string") candidates.push(details.error);
    } else if (typeof record.details === "string") {
      candidates.push(record.details);
    }
  }

  for (const candidate of candidates) {
    const normalized = normalizeUserFacingErrorMessage(candidate);
    if (!normalized) continue;
    if (isSensitiveUserFacingErrorMessage(normalized)) continue;
    return normalized;
  }

  return fallback;
}

function getParentLinkLookupRef(db: admin.firestore.Firestore, code: string) {
  return db.doc(`${PARENT_LINK_LOOKUP_COLLECTION}/${code}`);
}

function buildParentLinkLookupPayload(params: {
  code: string;
  centerId: string;
  studentId: string;
  studentName: string;
  timestamp: admin.firestore.Timestamp;
  createdAt?: admin.firestore.Timestamp;
}): Required<Pick<ParentLinkLookupDoc, "code" | "centerId" | "studentId" | "studentPath" | "studentName" | "updatedAt" | "createdAt">> {
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

async function hasParentLinkCodeConflict(
  db: admin.firestore.Firestore,
  code: string,
  params: { exceptStudentId?: string; exceptCenterId?: string } = {}
): Promise<boolean> {
  const normalizedCode = normalizeParentLinkCodeValue(code);
  if (!normalizedCode) return false;

  const lookupSnap = await getParentLinkLookupRef(db, normalizedCode).get();
  if (lookupSnap.exists) {
    const lookupData = lookupSnap.data() as ParentLinkLookupDoc;
    const lookupStudentId = asTrimmedString(lookupData?.studentId);
    const lookupCenterId = asTrimmedString(lookupData?.centerId);
    if (
      lookupStudentId &&
      lookupCenterId &&
      !(lookupStudentId === params.exceptStudentId && lookupCenterId === params.exceptCenterId)
    ) {
      return true;
    }
  }

  let duplicateCandidates: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  try {
    const duplicateSnap = await db
      .collectionGroup("students")
      .where("parentLinkCode", "==", normalizedCode)
      .limit(20)
      .get();
    duplicateCandidates = duplicateSnap.docs;
  } catch (lookupError: any) {
    console.warn("[parent-link-lookup] collectionGroup duplicate lookup failed", {
      code: normalizedCode,
      message: lookupError?.message || lookupError,
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
    } catch (lookupError: any) {
      console.warn("[parent-link-lookup] numeric duplicate lookup failed", {
        code: normalizedCode,
        message: lookupError?.message || lookupError,
      });
    }
  }

  for (const docSnap of duplicateCandidates) {
    const candidateCenterRef = docSnap.ref.parent.parent;
    if (!candidateCenterRef) continue;

    if (docSnap.id === params.exceptStudentId && candidateCenterRef.id === params.exceptCenterId) {
      continue;
    }

    const [candidateMemberSnap, candidateUserCenterSnap] = await Promise.all([
      db.doc(`centers/${candidateCenterRef.id}/members/${docSnap.id}`).get(),
      db.doc(`userCenters/${docSnap.id}/centers/${candidateCenterRef.id}`).get(),
    ]);
    const candidateMemberData = candidateMemberSnap.exists ? (candidateMemberSnap.data() as any) : null;
    const candidateUserCenterData = candidateUserCenterSnap.exists ? (candidateUserCenterSnap.data() as any) : null;
    const hasActiveMember =
      candidateMemberSnap.exists &&
      candidateMemberData?.role === "student" &&
      isActiveMembershipStatus(candidateMemberData?.status);
    const hasActiveUserCenter =
      candidateUserCenterSnap.exists &&
      candidateUserCenterData?.role === "student" &&
      isActiveMembershipStatus(candidateUserCenterData?.status);

    if (hasActiveMember || hasActiveUserCenter) {
      return true;
    }
  }

  return false;
}

async function reserveParentLinkCodeLookupInTransaction(params: {
  db: admin.firestore.Firestore;
  transaction: FirebaseFirestore.Transaction;
  code: string;
  centerId: string;
  studentId: string;
  studentName: string;
  timestamp: admin.firestore.Timestamp;
}) {
  const { db, transaction, code, centerId, studentId, studentName, timestamp } = params;
  const normalizedCode = normalizeParentLinkCodeValue(code);
  if (!normalizedCode) return;

  const lookupRef = getParentLinkLookupRef(db, normalizedCode);
  const lookupSnap = await transaction.get(lookupRef);
  const lookupData = lookupSnap.exists ? (lookupSnap.data() as ParentLinkLookupDoc) : null;
  const lookupStudentId = asTrimmedString(lookupData?.studentId);
  const lookupCenterId = asTrimmedString(lookupData?.centerId);

  if (lookupSnap.exists && (lookupStudentId !== studentId || lookupCenterId !== centerId)) {
    throw new functions.https.HttpsError("failed-precondition", "Parent link code is duplicated.", {
      userMessage: "이미 사용 중인 학부모 연동 코드입니다. 다른 6자리 숫자를 입력해 주세요.",
    });
  }

  transaction.set(
    lookupRef,
    buildParentLinkLookupPayload({
      code: normalizedCode,
      centerId,
      studentId,
      studentName,
      timestamp,
      createdAt: lookupData?.createdAt,
    }),
    { merge: true }
  );
}

async function resolveParentLinkCandidateFromLookupInTransaction(
  db: admin.firestore.Firestore,
  transaction: FirebaseFirestore.Transaction,
  code: string
): Promise<{
  centerId: string;
  studentId: string;
  studentRef: FirebaseFirestore.DocumentReference;
  studentData: FirebaseFirestore.DocumentData;
  className: string | null;
} | null> {
  const normalizedCode = normalizeParentLinkCodeValue(code);
  if (!normalizedCode) return null;

  const lookupSnap = await transaction.get(getParentLinkLookupRef(db, normalizedCode));
  if (!lookupSnap.exists) return null;

  const lookupData = lookupSnap.data() as ParentLinkLookupDoc;
  const centerId = asTrimmedString(lookupData?.centerId);
  const studentId = asTrimmedString(lookupData?.studentId);
  if (!centerId || !studentId) return null;

  const studentRef = db.doc(`centers/${centerId}/students/${studentId}`);
  const memberRef = db.doc(`centers/${centerId}/members/${studentId}`);
  const userCenterRef = db.doc(`userCenters/${studentId}/centers/${centerId}`);

  const [studentSnap, memberSnap, userCenterSnap] = await Promise.all([
    transaction.get(studentRef),
    transaction.get(memberRef),
    transaction.get(userCenterRef),
  ]);

  if (!studentSnap.exists) return null;

  const studentData = studentSnap.data() as FirebaseFirestore.DocumentData;
  const memberData = memberSnap.exists ? (memberSnap.data() as any) : null;
  const userCenterData = userCenterSnap.exists ? (userCenterSnap.data() as any) : null;
  const className =
    (memberData?.className as string | null) ||
    (userCenterData?.className as string | null) ||
    (studentData?.className as string | null) ||
    null;

  return {
    centerId,
    studentId,
    studentRef,
    studentData,
    className,
  };
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

function getFirebaseStorageBucketName(): string {
  const appBucket = asTrimmedString(admin.app().options.storageBucket);
  if (appBucket) return appBucket;

  if (typeof process.env.FIREBASE_CONFIG === "string" && process.env.FIREBASE_CONFIG.trim()) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_CONFIG) as { storageBucket?: unknown; projectId?: unknown };
      const configuredBucket = asTrimmedString(parsed.storageBucket);
      if (configuredBucket) return configuredBucket;
      const configuredProjectId = asTrimmedString(parsed.projectId);
      if (configuredProjectId) return `${configuredProjectId}.appspot.com`;
    } catch (error) {
      console.warn("[counseling] failed to parse FIREBASE_CONFIG for storage bucket", { error });
    }
  }

  const projectId = asTrimmedString(
    process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || admin.app().options.projectId
  );
  if (projectId) return `${projectId}.appspot.com`;

  throw new functions.https.HttpsError("internal", "Storage bucket is not configured.", {
    userMessage: "첨부 파일 저장소 설정을 확인해 주세요.",
  });
}

function buildFirebaseStorageDownloadUrl(path: string, downloadToken: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(getFirebaseStorageBucketName())}/o/${encodeURIComponent(path)}?alt=media&token=${encodeURIComponent(downloadToken)}`;
}

function normalizeAttendanceRequestProofAttachments(params: {
  attachments: unknown;
  centerId: string;
  studentId: string;
  uploadedAt: admin.firestore.Timestamp;
}) {
  const expectedPathPrefix = `centers/${params.centerId}/attendance-request-proofs/${params.studentId}/`;
  if (!Array.isArray(params.attachments) || params.attachments.length === 0) return [];
  if (params.attachments.length > ATTENDANCE_REQUEST_PROOF_LIMIT) {
    throw new functions.https.HttpsError("invalid-argument", "Too many proof attachments.", {
      userMessage: `병원 증빙 사진은 최대 ${ATTENDANCE_REQUEST_PROOF_LIMIT}장까지 첨부할 수 있습니다.`,
    });
  }

  const uniquePaths = new Set<string>();
  return params.attachments.map((rawAttachment, index) => {
    const attachment = (rawAttachment || {}) as Record<string, unknown>;
    const id = asTrimmedString(attachment.id, `proof-${index + 1}`);
    const name = asTrimmedString(attachment.name, `proof-${index + 1}.jpg`);
    const path = asTrimmedString(attachment.path);
    const downloadToken = asTrimmedString(attachment.downloadToken);
    const contentType = asTrimmedString(attachment.contentType, "image/jpeg");
    const sizeBytes = Math.round(parseFiniteNumber(attachment.sizeBytes) ?? Number.NaN);
    const width = Math.round(parseFiniteNumber(attachment.width) ?? Number.NaN);
    const height = Math.round(parseFiniteNumber(attachment.height) ?? Number.NaN);

    if (!path || !path.startsWith(expectedPathPrefix)) {
      throw new functions.https.HttpsError("invalid-argument", "Proof attachment path is invalid.", {
        userMessage: "병원 증빙 사진 경로가 올바르지 않습니다. 다시 업로드해 주세요.",
      });
    }
    if (!downloadToken || downloadToken.length < 8) {
      throw new functions.https.HttpsError("invalid-argument", "Proof attachment token is invalid.", {
        userMessage: "병원 증빙 사진 정보를 다시 확인해 주세요.",
      });
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > ATTENDANCE_REQUEST_PROOF_MAX_ATTACHMENT_BYTES) {
      throw new functions.https.HttpsError("invalid-argument", "Proof attachment size is invalid.", {
        userMessage: "병원 증빙 사진 용량이 너무 크거나 올바르지 않습니다. 다시 업로드해 주세요.",
      });
    }
    if (uniquePaths.has(path)) {
      throw new functions.https.HttpsError("invalid-argument", "Duplicate proof attachment path.", {
        userMessage: "같은 병원 증빙 사진이 중복 첨부되었습니다. 다시 확인해 주세요.",
      });
    }
    uniquePaths.add(path);

    return {
      id,
      name,
      path,
      downloadUrl: buildFirebaseStorageDownloadUrl(path, downloadToken),
      contentType,
      sizeBytes,
      width: Number.isFinite(width) && width > 0 ? width : null,
      height: Number.isFinite(height) && height > 0 ? height : null,
      uploadedAt: params.uploadedAt,
      deletedAt: null,
    };
  });
}

function shouldWaiveSameDayScheduleChangePenalty(
  category: "disaster" | "emergency" | "surgery" | "hospital" | "other" | ""
  ,
  proofCount: number,
  parentContactConfirmed: boolean
) {
  if (category === "disaster" || category === "emergency" || category === "surgery") return true;
  if (category === "hospital") return proofCount > 0 && parentContactConfirmed;
  return false;
}

function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getPlannerWeekKeyFromDateKey(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return "";

  const calendarYear = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(calendarYear, month - 1, day));
  if (
    date.getUTCFullYear() !== calendarYear ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }

  const isoWeekAnchor = new Date(date.getTime());
  const weekday = isoWeekAnchor.getUTCDay() || 7;
  isoWeekAnchor.setUTCDate(isoWeekAnchor.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(isoWeekAnchor.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil((((isoWeekAnchor.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  return `${String(calendarYear).padStart(4, "0")}-W${String(isoWeek).padStart(2, "0")}`;
}

function toDateKeyFromUnknownTimestamp(value: unknown): string | null {
  const millis = toMillisSafe(value);
  if (!Number.isFinite(millis) || millis <= 0) return null;
  return toDateKey(toKstDate(new Date(millis)));
}

function buildPenaltyEventLogId(studentId: string, source: string, penaltyKey: string): string {
  const normalized = `${studentId}_${source}_${penaltyKey}`.replace(/[^A-Za-z0-9_-]/g, "_");
  return normalized.slice(0, 240);
}

async function findExistingPenaltyEventLog(params: {
  db: admin.firestore.Firestore;
  centerId: string;
  studentId: string;
  source: "manual" | "routine_missing";
  penaltyKey: string;
  penaltyDateKey: string;
}): Promise<{ id: string } | null> {
  const { db, centerId, studentId, source, penaltyKey, penaltyDateKey } = params;
  const logsSnap = await db
    .collection(`centers/${centerId}/penaltyLogs`)
    .where("studentId", "==", studentId)
    .where("source", "==", source)
    .limit(source === "manual" ? 80 : 40)
    .get();

  for (const docSnap of logsSnap.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    const existingPenaltyKey = asTrimmedString(data?.penaltyKey);
    const existingPenaltyDateKey = asTrimmedString(data?.penaltyDateKey);
    const createdAtDateKey = toDateKeyFromUnknownTimestamp(data?.createdAt);
    const reasonText = asTrimmedString(data?.reason);

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

function safeAverageMinutes(values: number[]): number {
  return values.length === 0 ? 0 : Math.round(average(values));
}

function parseExpectedArrivalMinutes(value: unknown): number | null {
  const parsed = parseHourMinute(value);
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

function buildParentSmsTemplateMessage(
  template: string,
  values: Record<string, string>
): string {
  return trimSmsToByteLimit(
    normalizeTrackManagedSmsMessage(applyTemplate(template, values), { ensurePrefix: true })
  );
}

function shouldEnsureTrackManagedSmsPrefix(eventType: SmsQueueEventType): boolean {
  return (
    eventType === "study_start" ||
    eventType === "away_start" ||
    eventType === "away_end" ||
    eventType === "study_end" ||
    eventType === "late_alert" ||
    eventType === "daily_report" ||
    eventType === "payment_reminder" ||
    eventType === "weekly_report"
  );
}

function isAttendanceSmsEventType(value: unknown): value is AttendanceSmsEventType {
  const normalized = String(value || "").trim();
  return (
    normalized === "study_start" ||
    normalized === "away_start" ||
    normalized === "away_end" ||
    normalized === "study_end" ||
    normalized === "late_alert" ||
    normalized === "check_in" ||
    normalized === "check_out"
  );
}

function normalizeSmsEventType(eventType: AttendanceSmsEventType): "study_start" | "away_start" | "away_end" | "study_end" | "late_alert" {
  if (eventType === "check_in") return "study_start";
  if (eventType === "check_out") return "study_end";
  return eventType;
}

function toKstDateFromUnknownTimestamp(value: unknown): Date | null {
  const millis = toMillisSafe(value);
  if (!millis) return null;
  return toKstDate(new Date(millis));
}

function pickSmsEventDate(candidates: Date[], mode: "earliest" | "latest"): Date | null {
  if (candidates.length === 0) return null;
  const preciseCandidates = candidates.filter((date) =>
    date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0
  );
  const orderedCandidates = preciseCandidates.length > 0 ? preciseCandidates : candidates;
  return orderedCandidates
    .slice()
    .sort((a, b) => mode === "earliest" ? a.getTime() - b.getTime() : b.getTime() - a.getTime())[0] || null;
}

async function resolveAttendanceSmsEventAt(
  db: admin.firestore.Firestore,
  params: {
    centerId: string;
    studentId: string;
    eventType: AttendanceSmsEventType;
    fallbackEventAt: Date;
    dateKeyOverride?: string | null;
  }
): Promise<Date> {
  const eventType = normalizeSmsEventType(params.eventType);
  if (eventType === "late_alert") return params.fallbackEventAt;

  const overrideDateKey = asTrimmedString(params.dateKeyOverride);
  const hasDateKeyOverride = isValidDateKey(overrideDateKey);
  const dateKey = hasDateKeyOverride ? overrideDateKey : toStudyDayKey(params.fallbackEventAt);
  const candidates: Date[] = [];
  const addCandidate = (value: unknown, allowOutsideStudyDay = false) => {
    const candidate = toKstDateFromUnknownTimestamp(value);
    if (!candidate) return;
    if (!allowOutsideStudyDay && toStudyDayKey(candidate) !== dateKey) return;
    candidates.push(candidate);
  };
  addCandidate(params.fallbackEventAt);

  const [dailyStatSnap, attendanceRecordSnap, attendanceEventsSnap, liveAttendanceSnap] = await Promise.all([
    db.doc(`centers/${params.centerId}/attendanceDailyStats/${dateKey}/students/${params.studentId}`).get(),
    db.doc(`centers/${params.centerId}/attendanceRecords/${dateKey}/students/${params.studentId}`).get(),
    db.collection(`centers/${params.centerId}/attendanceEvents`).where("dateKey", "==", dateKey).get(),
    db.collection(`centers/${params.centerId}/attendanceCurrent`).where("studentId", "==", params.studentId).limit(5).get(),
  ]);

  const dailyStatData = dailyStatSnap.exists ? dailyStatSnap.data() || {} : {};
  const attendanceRecordData = attendanceRecordSnap.exists ? attendanceRecordSnap.data() || {} : {};

  if (eventType === "study_start") {
    addCandidate(dailyStatData.checkInAt, hasDateKeyOverride);
    addCandidate(attendanceRecordData.checkInAt, hasDateKeyOverride);
    liveAttendanceSnap.docs.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const status = asTrimmedString(data.status);
      if (ACTIVE_STUDY_ATTENDANCE_STATUSES.has(status)) {
        const activeStudyDayKey = asTrimmedString(data.activeStudyDayKey);
        addCandidate(data.lastCheckInAt, isValidDateKey(activeStudyDayKey) && activeStudyDayKey === dateKey);
      }
    });
  }

  if (eventType === "study_end") {
    addCandidate(dailyStatData.checkOutAt, hasDateKeyOverride);
    addCandidate(attendanceRecordData.checkOutAt, hasDateKeyOverride);
  }

  const matchingAttendanceEventTypes: Record<
    "study_start" | "away_start" | "away_end" | "study_end",
    string[]
  > = {
    study_start: ["check_in"],
    away_start: ["away_start"],
    away_end: ["away_end"],
    study_end: ["check_out"],
  };
  const targetEventTypes = matchingAttendanceEventTypes[eventType];
  attendanceEventsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    if (asTrimmedString(data.studentId) !== params.studentId) return;
    if (!targetEventTypes.includes(asTrimmedString(data.eventType))) return;
    addCandidate(data.occurredAt || data.createdAt, true);
  });

  const picked = pickSmsEventDate(candidates, eventType === "study_start" ? "earliest" : "latest");
  return picked || params.fallbackEventAt;
}

function getDefaultSmsEventToggles(): Record<ParentSmsEventType, boolean> {
  return {
    study_start: true,
    away_start: true,
    away_end: true,
    study_end: true,
    late_alert: true,
    weekly_report: true,
    daily_report: false,
    payment_reminder: true,
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
    daily_report: false,
    payment_reminder: source.payment_reminder !== false,
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

function buildParentLinkRateLimitRef(db: admin.firestore.Firestore, uid: string) {
  return db.doc(`users/${uid}/securityGuards/parentLinkRateLimit`);
}

function getRemainingLockMinutes(target: Date, now = new Date()): number {
  return Math.max(1, Math.ceil((target.getTime() - now.getTime()) / (60 * 1000)));
}

async function assertParentLinkRateLimitAllowed(db: admin.firestore.Firestore, uid: string): Promise<void> {
  const snap = await buildParentLinkRateLimitRef(db, uid).get();
  if (!snap.exists) return;

  const data = (snap.data() || {}) as ParentLinkRateLimitDoc;
  const now = new Date();
  const blockedUntil = toTimestampDate(data.blockedUntil);
  if (!blockedUntil || blockedUntil.getTime() <= now.getTime()) return;

  const remainingMinutes = getRemainingLockMinutes(blockedUntil, now);
  throw new functions.https.HttpsError("resource-exhausted", "Parent link temporarily blocked due to repeated failures.", {
    userMessage: `학생코드 확인 시도가 많아 ${remainingMinutes}분 동안 잠겼습니다. 잠시 후 다시 시도해 주세요.`,
  });
}

async function registerParentLinkFailedAttempt(
  db: admin.firestore.Firestore,
  uid: string
): Promise<admin.firestore.Timestamp | null> {
  const rateLimitRef = buildParentLinkRateLimitRef(db, uid);
  return db.runTransaction(async (t) => {
    const snap = await t.get(rateLimitRef);
    const data = (snap.data() || {}) as ParentLinkRateLimitDoc;
    const now = new Date();
    const nowTs = admin.firestore.Timestamp.fromDate(now);
    const blockedUntil = toTimestampDate(data.blockedUntil);

    if (blockedUntil && blockedUntil.getTime() > now.getTime()) {
      return admin.firestore.Timestamp.fromDate(blockedUntil);
    }

    const firstFailedAt = toTimestampDate(data.firstFailedAt);
    const failedAttemptCount = Math.max(0, Number(data.failedAttemptCount || 0));
    const isWithinWindow =
      firstFailedAt !== null && now.getTime() - firstFailedAt.getTime() < PARENT_LINK_FAILED_ATTEMPT_WINDOW_MS;
    const nextFailedAttemptCount = isWithinWindow ? failedAttemptCount + 1 : 1;
    const nextFirstFailedAt =
      isWithinWindow && data.firstFailedAt && typeof data.firstFailedAt.toDate === "function" ? data.firstFailedAt : nowTs;
    const nextBlockedUntil =
      nextFailedAttemptCount >= PARENT_LINK_FAILED_ATTEMPT_LIMIT
        ? admin.firestore.Timestamp.fromDate(new Date(now.getTime() + PARENT_LINK_FAILED_ATTEMPT_LOCK_MS))
        : null;

    t.set(
      rateLimitRef,
      {
        failedAttemptCount: nextFailedAttemptCount,
        firstFailedAt: nextFirstFailedAt,
        lastFailedAt: nowTs,
        blockedUntil: nextBlockedUntil ?? admin.firestore.FieldValue.delete(),
        updatedAt: nowTs,
      },
      { merge: true }
    );

    return nextBlockedUntil;
  });
}

async function clearParentLinkRateLimit(db: admin.firestore.Firestore, uid: string): Promise<void> {
  await buildParentLinkRateLimitRef(db, uid).delete();
}

function shouldCountParentLinkFailedAttempt(error: unknown): boolean {
  if (!(error instanceof functions.https.HttpsError) || error.code !== "failed-precondition") return false;
  const message = String(error.message || "").toLowerCase();
  return (
    message.includes("student") ||
    message.includes("parent link") ||
    message.includes("linked student") ||
    message.includes("invite center does not match linked student center")
  );
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
  return enforceTrackManagedSmsCenterName(String(template || ""))
    .replace(/[^\u0020-\u007E\u00A0-\u00FF\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function enforceTrackManagedSmsCenterName(value: string): string {
  return String(value || "")
    .replace(/\{centerName\}/g, TRACK_MANAGED_STUDY_CENTER_NAME)
    .replace(/공부\s*트랙\s*동백\s*센터/g, TRACK_MANAGED_STUDY_CENTER_NAME)
    .replace(/트랙\s*학습\s*센터/g, TRACK_MANAGED_STUDY_CENTER_NAME)
    .replace(/트랙학습센터/g, TRACK_MANAGED_STUDY_CENTER_NAME);
}

function normalizeTrackManagedSmsMessage(
  message: string,
  options: { ensurePrefix?: boolean } = {}
): string {
  const normalized = enforceTrackManagedSmsCenterName(message).replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const requiredPrefix = `[${TRACK_MANAGED_STUDY_CENTER_NAME}]`;
  if (normalized.startsWith(requiredPrefix)) return normalized;

  const bracketPrefixPattern = /^\[[^\]]+\]\s*/;
  if (bracketPrefixPattern.test(normalized)) {
    return normalized.replace(bracketPrefixPattern, `${requiredPrefix} `).trim();
  }

  return options.ensurePrefix ? `${requiredPrefix} ${normalized}` : normalized;
}

async function loadCenterName(
  _db: admin.firestore.Firestore,
  _centerId: string
): Promise<string> {
  return TRACK_MANAGED_STUDY_CENTER_NAME;
}

function resolveTemplateByEvent(
  settings: NotificationSettingsDoc,
  eventType: "study_start" | "away_start" | "away_end" | "study_end" | "late_alert"
): string {
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

function buildSmsDedupeKey(params: {
  centerId: string;
  studentId: string;
  eventType: "study_start" | "away_start" | "away_end" | "study_end" | "late_alert";
  eventAt: Date;
}): string {
  const dateKey = toStudyDayKey(params.eventAt);
  if (params.eventType === "late_alert") {
    return `${params.centerId}_${params.studentId}_${params.eventType}_${dateKey}`;
  }
  return `${params.centerId}_${params.studentId}_${params.eventType}_${dateKey}_${params.eventAt.getTime()}`;
}

function buildAttendanceEventSmsDedupeKey(params: {
  centerId: string;
  studentId: string;
  eventType: AttendanceSmsEventType;
  eventAt: Date;
  eventId: string;
}): string {
  const normalizedEventType = normalizeSmsEventType(params.eventType);
  const dateKey = toStudyDayKey(params.eventAt);
  const eventId = asTrimmedString(params.eventId).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);
  return `${params.centerId}_${params.studentId}_${normalizedEventType}_${dateKey}_event_${eventId}`;
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
    dedupeKey?: string | null;
    sourceEventId?: string | null;
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
    dateKey?: string | null;
    createdAt?: admin.firestore.Timestamp;
    eventAt?: admin.firestore.Timestamp | null;
    sentAt?: admin.firestore.Timestamp | null;
    failedAt?: admin.firestore.Timestamp | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    suppressedReason?: string | null;
  }
): Promise<void> {
  const createdAt = params.createdAt || admin.firestore.Timestamp.now();
  const eventAt = params.eventAt || null;
  const dateKey = isValidDateKey(asTrimmedString(params.dateKey))
    ? asTrimmedString(params.dateKey)
    : toStudyDayKey((eventAt || createdAt).toDate());
  const logRef = db.collection(`centers/${params.centerId}/smsDeliveryLogs`).doc();
  await logRef.set({
    centerId: params.centerId,
    queueId: params.queueId || null,
    dedupeKey: params.dedupeKey || null,
    sourceEventId: params.sourceEventId || null,
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
    dateKey,
    eventAt,
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
  const publicRef = db.doc(`centers/${centerId}/settings/notifications`);
  const privateRef = db.doc(`centers/${centerId}/settingsPrivate/notificationsSecret`);
  const [settingsSnap, privateSnap] = await Promise.all([publicRef.get(), privateRef.get()]);

  const publicData = (settingsSnap.exists ? settingsSnap.data() : {}) as NotificationSettingsDoc;
  const privateData = (privateSnap.exists ? privateSnap.data() : {}) as NotificationSettingsSecretDoc;
  const legacyPublicApiKey = asTrimmedString(publicData.smsApiKey);
  const privateApiKey = asTrimmedString(privateData.smsApiKey);

  if (legacyPublicApiKey && !privateApiKey) {
    await Promise.all([
      privateRef.set(
        {
          smsApiKey: legacyPublicApiKey,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
      publicRef.set(
        {
          smsApiKey: admin.firestore.FieldValue.delete(),
          smsApiKeyConfigured: true,
          smsApiKeyLastUpdatedAt:
            publicData.smsApiKeyLastUpdatedAt || admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
    ]);
  }

  const normalizedTemplateUpdates: Record<string, string> = {};
  for (const key of SMS_TEMPLATE_SETTING_KEYS) {
    const currentValue = publicData[key];
    if (typeof currentValue !== "string" || !currentValue.trim()) continue;
    const normalizedValue = sanitizeSmsTemplate(currentValue);
    if (normalizedValue && normalizedValue !== currentValue) {
      normalizedTemplateUpdates[key] = normalizedValue;
      publicData[key] = normalizedValue;
    }
  }

  if (Object.keys(normalizedTemplateUpdates).length > 0) {
    await publicRef.set(
      {
        ...normalizedTemplateUpdates,
        smsTemplatesNormalizedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  return {
    ...publicData,
    smsApiKey: privateApiKey || legacyPublicApiKey || undefined,
  };
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
  const studentData = studentSnap.data() || {};
  if (shouldExcludeFromSmsQueries(studentData, studentId)) return [];

  const parentUidsRaw = studentData.parentUids;
  const parentUids = Array.isArray(parentUidsRaw)
    ? Array.from(new Set(parentUidsRaw
      .map((uid) => (typeof uid === "string" ? uid.trim() : ""))
      .filter((uid): uid is string => uid.length > 0)))
    : [];

  const recipients: SmsRecipient[] = [];

  const manualParentPrefSnap = await db
    .doc(`centers/${centerId}/smsRecipientPreferences/${buildSmsRecipientPreferenceId(studentId, MANUAL_PARENT_SMS_UID)}`)
    .get();
  if (manualParentPrefSnap.exists) {
    const manualPref = manualParentPrefSnap.data() as SmsRecipientPreferenceDoc;
    const phoneNumber = normalizePhoneNumber(manualPref.phoneNumber);
    if (phoneNumber) {
      recipients.push({
        parentUid: MANUAL_PARENT_SMS_UID,
        parentName: asTrimmedString(manualPref.parentName, "보호자"),
        phoneNumber,
      });
    }
  }

  for (const parentUid of parentUids) {
    const [userSnap, memberSnap, prefSnap] = await Promise.all([
      db.doc(`users/${parentUid}`).get(),
      db.doc(`centers/${centerId}/members/${parentUid}`).get(),
      db.doc(`centers/${centerId}/smsRecipientPreferences/${buildSmsRecipientPreferenceId(studentId, parentUid)}`).get(),
    ]);

    const userData = userSnap.exists ? userSnap.data() : null;
    const memberData = memberSnap.exists ? memberSnap.data() : null;
    const prefData = prefSnap.exists ? (prefSnap.data() as SmsRecipientPreferenceDoc) : null;
    if (shouldExcludeFromSmsQueries(userData, parentUid) || shouldExcludeFromSmsQueries(memberData, parentUid)) {
      continue;
    }
    const phoneNumber = normalizePhoneNumber(userData?.phoneNumber || memberData?.phoneNumber || prefData?.phoneNumber);
    if (!phoneNumber) continue;

    recipients.push({
      parentUid,
      parentName: (memberData?.displayName as string | null) || (userData?.displayName as string | null) || null,
      phoneNumber,
    });
  }

  return recipients;
}

async function splitRecipientsBySmsPreference(
  db: admin.firestore.Firestore,
  centerId: string,
  studentId: string,
  studentName: string,
  eventType: RecipientPreferenceEventType,
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
    const eventEnabled = eventType === "manual_note" || toggles[eventType] !== false;

    if (!enabled) {
      suppressedRecipients.push({
        ...recipient,
        suppressedReason: "recipient_disabled",
      });
      continue;
    }

    if (!eventEnabled) {
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

  const dedupedAllowedRecipients: SmsRecipient[] = [];
  const allowedPhoneNumbers = new Set<string>();
  allowedRecipients.forEach((recipient) => {
    const phoneNumber = normalizePhoneNumber(recipient.phoneNumber);
    if (!phoneNumber) return;
    if (allowedPhoneNumbers.has(phoneNumber)) {
      suppressedRecipients.push({
        ...recipient,
        phoneNumber,
        suppressedReason: "duplicate_phone",
      });
      return;
    }

    allowedPhoneNumbers.add(phoneNumber);
    dedupedAllowedRecipients.push({
      ...recipient,
      phoneNumber,
    });
  });

  return { allowedRecipients: dedupedAllowedRecipients, suppressedRecipients };
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
    force?: boolean;
    dateKeyOverride?: string | null;
    useExactEventAt?: boolean;
    dedupeKeyOverride?: string | null;
    sourceEventId?: string | null;
    dispatchImmediately?: boolean;
  }
): Promise<{ queuedCount: number; recipientCount: number; suppressedCount: number; message: string; deduped?: boolean }> {
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
    return { queuedCount: 0, recipientCount: 0, suppressedCount: 0, message: "" };
  }
  const centerName = await loadCenterName(db, centerId);
  const template = resolveTemplateByEvent(settings, eventType);
  const smsEventAt = params.useExactEventAt
    ? eventAt
    : await resolveAttendanceSmsEventAt(db, {
        centerId,
        studentId,
        eventType,
        fallbackEventAt: eventAt,
        dateKeyOverride: params.dateKeyOverride,
      });

  const eventTimeLabel = toTimeLabel(smsEventAt);
  const eventAtTs = admin.firestore.Timestamp.fromDate(smsEventAt);
  const overrideDateKey = asTrimmedString(params.dateKeyOverride);
  const smsDateKey = isValidDateKey(overrideDateKey) ? overrideDateKey : toStudyDayKey(smsEventAt);
  const expectedTimeLabel = expectedTime || "학생이 정한 시간";
  const message = buildParentSmsTemplateMessage(template, {
    studentName,
    time: eventTimeLabel,
    expectedTime: expectedTimeLabel,
    centerName,
  });
  const messageBytes = calculateSmsBytes(message);
  const dedupeKey = asTrimmedString(params.dedupeKeyOverride) || buildSmsDedupeKey({
    centerId,
    studentId,
    eventType,
    eventAt: smsEventAt,
  });
  const dedupeRef = db.doc(`centers/${centerId}/smsDedupes/${dedupeKey}`);
  const ts = admin.firestore.Timestamp.now();
  const dedupePayload = {
    centerId,
    studentId,
    eventType,
    dedupeKey,
    createdAt: ts,
    renderedMessage: message,
    messageBytes,
    sourceEventId: asTrimmedString(params.sourceEventId) || null,
  };
  if (!params.force) {
    const shouldQueue = await db.runTransaction(async (tx) => {
      const dedupeSnap = await tx.get(dedupeRef);
      if (dedupeSnap.exists) return false;
      tx.set(dedupeRef, dedupePayload, { merge: true });
      return true;
    });
    if (!shouldQueue) {
      return { queuedCount: 0, recipientCount: recipients.length, suppressedCount: 0, message, deduped: true };
    }
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
  const batch = db.batch();
  const initialStatus = buildSmsQueueInitialStatus(settings);
  const shouldDispatchImmediately = params.dispatchImmediately === true && initialStatus.status === "queued";
  const immediateProcessingLeaseUntil = admin.firestore.Timestamp.fromMillis(ts.toMillis() + 60 * 1000);
  const immediateDispatchQueueItems: Array<{
    ref: admin.firestore.DocumentReference;
    data: Record<string, unknown>;
  }> = [];
  if (params.force) {
    batch.set(dedupeRef, { ...dedupePayload, forcedAt: ts }, { merge: true });
  }

  allowedRecipients.forEach((recipient) => {
    const queueRef = db.collection(`centers/${centerId}/smsQueue`).doc();
    const queuePayload = {
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
      dateKey: smsDateKey,
      eventAt: eventAtTs,
      status: shouldDispatchImmediately ? "processing" : initialStatus.status,
      providerStatus: shouldDispatchImmediately ? "processing" : initialStatus.providerStatus,
      attemptCount: shouldDispatchImmediately ? 1 : 0,
      manualRetryCount: 0,
      nextAttemptAt: shouldDispatchImmediately ? null : initialStatus.status === "queued" ? ts : null,
      sentAt: null,
      failedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      processingStartedAt: shouldDispatchImmediately ? ts : null,
      processingLeaseUntil: shouldDispatchImmediately ? immediateProcessingLeaseUntil : null,
      createdAt: ts,
      updatedAt: ts,
      metadata: {
        studentName,
        centerName,
        eventTime: eventTimeLabel,
        eventAt: eventAtTs,
        expectedTime: expectedTime || null,
        sourceEventId: asTrimmedString(params.sourceEventId) || null,
      },
    };
    batch.set(queueRef, queuePayload);
    if (shouldDispatchImmediately) {
      immediateDispatchQueueItems.push({ ref: queueRef, data: queuePayload });
    }

    const parentNotificationRef = db.collection(`centers/${centerId}/parentNotifications`).doc();
    batch.set(parentNotificationRef, {
      centerId,
      studentId,
      parentUid: recipient.parentUid,
      type: eventType,
      title: buildParentNotificationTitle(eventType),
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
        eventAt: eventAtTs,
        dateKey: smsDateKey,
        suppressedReason: recipient.suppressedReason,
        dedupeKey,
        sourceEventId: asTrimmedString(params.sourceEventId) || null,
      })
    )
  );

  if (shouldDispatchImmediately && immediateDispatchQueueItems.length > 0) {
    await Promise.allSettled(
      immediateDispatchQueueItems.map((queueItem) =>
        dispatchSmsQueueItem(db, centerId, queueItem.ref, queueItem.data, 1)
      )
    );
  }

  return {
    queuedCount: allowedRecipients.length,
    recipientCount: recipients.length,
    suppressedCount: suppressedRecipients.length,
    message,
  };
}

function buildParentNotificationTitle(eventType: RecipientPreferenceEventType) {
  if (eventType === "study_start") return "공부 시작 알림";
  if (eventType === "study_end") return "공부 종료 알림";
  if (eventType === "away_start") return "외출 알림";
  if (eventType === "away_end") return "복귀 알림";
  if (eventType === "late_alert") return "지각 알림";
  if (eventType === "weekly_report") return "주간 리포트 알림";
  if (eventType === "daily_report") return "일일 리포트 알림";
  if (eventType === "manual_note") return "수동 문자";
  return "결제 예정 알림";
}

async function queueCustomParentSmsNotification(
  db: admin.firestore.Firestore,
  params: {
    centerId: string;
    studentId: string;
    studentName: string;
    eventType: Extract<RecipientPreferenceEventType, "daily_report" | "payment_reminder" | "manual_note">;
    message: string;
    date: Date;
    settings?: NotificationSettingsDoc;
    dedupeKey?: string;
    notificationTitle?: string;
    isImportant?: boolean;
    metadata?: Record<string, unknown>;
  }
): Promise<{ queuedCount: number; recipientCount: number; suppressedCount: number; message: string }> {
  const settings = params.settings || await loadNotificationSettings(db, params.centerId);
  const recipients = await collectParentRecipients(db, params.centerId, params.studentId);
  if (recipients.length === 0) {
    return { queuedCount: 0, recipientCount: 0, suppressedCount: 0, message: params.message };
  }

  const dedupeRef = params.dedupeKey
    ? db.doc(`centers/${params.centerId}/smsDedupes/${params.dedupeKey}`)
    : null;
  if (dedupeRef) {
    const dedupeSnap = await dedupeRef.get();
    if (dedupeSnap.exists) {
      return { queuedCount: 0, recipientCount: recipients.length, suppressedCount: 0, message: params.message };
    }
  }

  const { allowedRecipients, suppressedRecipients } = await splitRecipientsBySmsPreference(
    db,
    params.centerId,
    params.studentId,
    params.studentName,
    params.eventType,
    recipients
  );

  const provider = settings.smsProvider || "none";
  const ts = admin.firestore.Timestamp.now();
  const message = trimSmsToByteLimit(
    normalizeTrackManagedSmsMessage(params.message, { ensurePrefix: false })
  );
  const messageBytes = calculateSmsBytes(message);
  const initialStatus = buildSmsQueueInitialStatus(settings);
  const batch = db.batch();

  if (dedupeRef) {
    batch.set(
      dedupeRef,
      {
        centerId: params.centerId,
        studentId: params.studentId,
        eventType: params.eventType,
        dedupeKey: params.dedupeKey,
        createdAt: ts,
        renderedMessage: message,
        messageBytes,
      },
      { merge: true },
    );
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
      dateKey: toStudyDayKey(params.date),
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

  await Promise.all(
    suppressedRecipients.map((recipient) =>
      appendSmsDeliveryLog(db, {
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
        dateKey: toStudyDayKey(params.date),
        suppressedReason: recipient.suppressedReason,
        dedupeKey: params.dedupeKey || null,
      })
    )
  );

  return {
    queuedCount: allowedRecipients.length,
    recipientCount: recipients.length,
    suppressedCount: suppressedRecipients.length,
    message,
  };
}

function normalizeAttendanceEventForParentSms(value: unknown): AttendanceSmsEventType | null {
  const normalized = asTrimmedString(value);
  if (normalized === "check_in") return "study_start";
  if (normalized === "check_out") return "study_end";
  if (normalized === "away_start" || normalized === "away_end") return normalized;
  if (normalized === "study_start" || normalized === "study_end") return normalized;
  return null;
}

type AttendanceSmsPipelineStatus = "queued" | "deduped" | "no_recipient" | "suppressed" | "failed";

type AttendanceEventSmsQueueResult = {
  status: AttendanceSmsPipelineStatus;
  queuedCount: number;
  recipientCount: number;
  suppressedCount: number;
  deduped?: boolean;
  dedupeKey?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function hasSmsQueueForDedupeKey(
  db: admin.firestore.Firestore,
  centerId: string,
  dedupeKey: string
): Promise<boolean> {
  const normalizedCenterId = asTrimmedString(centerId);
  const normalizedDedupeKey = asTrimmedString(dedupeKey);
  if (!normalizedCenterId || !normalizedDedupeKey) return false;

  const queueSnap = await db
    .collection(`centers/${normalizedCenterId}/smsQueue`)
    .where("dedupeKey", "==", normalizedDedupeKey)
    .limit(1)
    .get();
  return !queueSnap.empty;
}

function resolveAttendanceSmsPipelineStatus(queueResult: {
  queuedCount: number;
  recipientCount: number;
  suppressedCount: number;
  deduped?: boolean;
}): AttendanceSmsPipelineStatus {
  if (queueResult.deduped) return "deduped";
  if (queueResult.recipientCount === 0) return "no_recipient";
  if (queueResult.queuedCount > 0) return "queued";
  if (queueResult.suppressedCount > 0) return "suppressed";
  return "no_recipient";
}

async function queueAttendanceEventSmsV2(
  db: admin.firestore.Firestore,
  params: {
    centerId: string;
    eventId: string;
    eventData: Record<string, unknown>;
    eventRef?: admin.firestore.DocumentReference;
    force?: boolean;
  }
): Promise<AttendanceEventSmsQueueResult> {
  const centerId = asTrimmedString(params.centerId);
  const eventId = asTrimmedString(params.eventId);
  const eventData = params.eventData || {};
  const studentId = asTrimmedString(eventData.studentId);
  const smsEventType = normalizeAttendanceEventForParentSms(eventData.eventType);
  const eventRef = params.eventRef || db.doc(`centers/${centerId}/attendanceEvents/${eventId}`);

  try {
    if (!centerId || !eventId || !studentId || !smsEventType) {
      return {
        status: "failed",
        queuedCount: 0,
        recipientCount: 0,
        suppressedCount: 0,
      };
    }

    const eventAt =
      toKstDateFromUnknownTimestamp(eventData.occurredAt)
      || toKstDateFromUnknownTimestamp(eventData.createdAt)
      || toKstDate();
    const eventMeta = asRecord(eventData.meta);
    const [settings, studentSnap] = await Promise.all([
      loadNotificationSettings(db, centerId),
      db.doc(`centers/${centerId}/students/${studentId}`).get(),
    ]);
    const studentData = studentSnap.exists ? studentSnap.data() || {} : {};
    const studentName = asTrimmedString(
      studentData.name || eventMeta?.studentName || eventData.studentName,
      "학생"
    );
    const dedupeKey = buildAttendanceEventSmsDedupeKey({
      centerId,
      studentId,
      eventType: smsEventType,
      eventAt,
      eventId,
    });
    const queueResult = await queueParentSmsNotification(db, {
      centerId,
      studentId,
      studentName,
      eventType: smsEventType,
      eventAt,
      settings,
      force: params.force === true,
      dateKeyOverride: asTrimmedString(eventData.dateKey) || null,
      useExactEventAt: true,
      dedupeKeyOverride: dedupeKey,
      sourceEventId: eventId,
      dispatchImmediately: true,
    });
    let smsStatus = resolveAttendanceSmsPipelineStatus(queueResult);
    if (smsStatus === "deduped" && dedupeKey) {
      const hasExistingQueue = await hasSmsQueueForDedupeKey(db, centerId, dedupeKey);
      if (hasExistingQueue) {
        smsStatus = "queued";
      }
    }

    await eventRef.set({
      smsStatus,
      smsPipelineVersion: "v2",
      smsQueuedAt: admin.firestore.FieldValue.serverTimestamp(),
      smsQueuedCount: queueResult.queuedCount,
      smsRecipientCount: queueResult.recipientCount,
      smsSuppressedCount: queueResult.suppressedCount,
      smsError: null,
      smsEventType,
      smsMessage: queueResult.message || null,
      smsDedupeKey: dedupeKey,
    }, { merge: true });

    console.log("[attendance-sms-v2] queued", {
      centerId,
      studentId,
      eventId,
      eventType: smsEventType,
      status: smsStatus,
      queuedCount: queueResult.queuedCount,
      recipientCount: queueResult.recipientCount,
      suppressedCount: queueResult.suppressedCount,
      deduped: queueResult.deduped === true,
    });

    return {
      status: smsStatus,
      queuedCount: queueResult.queuedCount,
      recipientCount: queueResult.recipientCount,
      suppressedCount: queueResult.suppressedCount,
      deduped: queueResult.deduped,
      dedupeKey,
    };
  } catch (error: any) {
    const message = error?.message || String(error);
    console.error("[attendance-sms-v2] failed", {
      centerId,
      studentId,
      eventId,
      eventType: smsEventType,
      message,
    });
    await eventRef.set({
      smsStatus: "failed",
      smsPipelineVersion: "v2",
      smsQueuedAt: admin.firestore.FieldValue.serverTimestamp(),
      smsQueuedCount: 0,
      smsRecipientCount: 0,
      smsSuppressedCount: 0,
      smsError: message,
      smsEventType: smsEventType || null,
      smsFailedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return {
      status: "failed",
      queuedCount: 0,
      recipientCount: 0,
      suppressedCount: 0,
    };
  }
}

export const onAttendanceEventCreated = smsDispatcherFunctions
  .firestore.document("centers/{centerId}/attendanceEvents/{eventId}")
  .onCreate(async (snap, context) => {
    const db = admin.firestore();
    const centerId = asTrimmedString(context.params.centerId);
    const eventId = asTrimmedString(context.params.eventId);
    const data = (snap.data() || {}) as Record<string, unknown>;
    const studentId = asTrimmedString(data.studentId);
    const eventType = normalizeAttendanceEventForParentSms(data.eventType);

    if (!centerId || !studentId || !eventType) {
      return null;
    }

    await queueAttendanceEventSmsV2(db, {
      centerId,
      eventId,
      eventData: data,
      eventRef: snap.ref,
    });

    return null;
  });

async function queueAttendanceTransitionSmsAfterCommit(
  db: admin.firestore.Firestore,
  params: {
    centerId: string;
    result: Pick<ApplyAttendanceStatusTransitionResult, "eventId" | "eventType" | "noop">;
  }
): Promise<void> {
  const centerId = asTrimmedString(params.centerId);
  const eventId = asTrimmedString(params.result.eventId);
  if (!centerId || !eventId || params.result.noop || !params.result.eventType) return;

  const eventRef = db.doc(`centers/${centerId}/attendanceEvents/${eventId}`);
  try {
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      console.warn("[attendance-sms-v2] direct fallback skipped; event missing", {
        centerId,
        eventId,
        eventType: params.result.eventType,
      });
      return;
    }

    const firstQueueResult = await queueAttendanceEventSmsV2(db, {
      centerId,
      eventId,
      eventData: eventSnap.data() || {},
      eventRef,
    });

    if (firstQueueResult.status === "deduped" && firstQueueResult.dedupeKey) {
      await sleep(3000);
      const hasExistingQueue = await hasSmsQueueForDedupeKey(db, centerId, firstQueueResult.dedupeKey);
      if (!hasExistingQueue) {
        console.warn("[attendance-sms-v2] dedupe without queue; forcing attendance sms queue", {
          centerId,
          eventId,
          eventType: params.result.eventType,
          dedupeKey: firstQueueResult.dedupeKey,
        });
        await queueAttendanceEventSmsV2(db, {
          centerId,
          eventId,
          eventData: eventSnap.data() || {},
          eventRef,
          force: true,
        });
      }
    }
  } catch (error) {
    console.error("[attendance-sms-v2] direct fallback failed", {
      centerId,
      eventId,
      eventType: params.result.eventType,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

type AttendanceSmsRepairResult = {
  centerId: string;
  dateKey: string;
  scannedCount: number;
  targetCount: number;
  queuedCount: number;
  suppressedCount: number;
  skippedCount: number;
  noRecipientCount: number;
  failedCount: number;
};

type ExistingAttendanceSmsQueue = {
  id: string;
  studentId: string;
  eventType: string;
  status: string;
  dedupeKey: string;
  eventAtMs: number;
  createdAtMs: number;
  renderedMessage: string;
};

type ExistingAttendanceSmsQueueState = "none" | "active_or_sent" | "retryable";

async function loadExistingAttendanceSmsQueuesForDate(
  db: admin.firestore.Firestore,
  centerId: string,
  dateKey: string
): Promise<ExistingAttendanceSmsQueue[]> {
  const queueSnap = await db
    .collection(`centers/${centerId}/smsQueue`)
    .where("dateKey", "==", dateKey)
    .limit(1500)
    .get();

  return queueSnap.docs.map((queueDoc) => {
    const queueData = (queueDoc.data() || {}) as Record<string, unknown>;
    const queueMetadata = asRecord(queueData.metadata);
    return {
      id: queueDoc.id,
      studentId: asTrimmedString(queueData.studentId),
      eventType: asTrimmedString(queueData.eventType),
      status: asTrimmedString(queueData.status),
      dedupeKey: asTrimmedString(queueData.dedupeKey),
      eventAtMs: toMillisSafe(queueData.eventAt || queueMetadata?.eventAt),
      createdAtMs: toMillisSafe(queueData.createdAt),
      renderedMessage: asTrimmedString(queueData.renderedMessage || queueData.message),
    };
  });
}

function getExistingAttendanceSmsQueueState(
  existingQueues: ExistingAttendanceSmsQueue[],
  params: {
    studentId: string;
    studentName: string;
    eventType: AttendanceSmsEventType;
    eventAt: Date;
    dedupeKey: string;
  }
): ExistingAttendanceSmsQueueState {
  const normalizedEventType = normalizeSmsEventType(params.eventType);
  const eventAtMs = params.eventAt.getTime();
  const eventTimeLabel = toTimeLabel(params.eventAt);
  let hasRetryableQueue = false;

  for (const queue of existingQueues) {
    if (queue.studentId !== params.studentId) continue;
    if (normalizeAttendanceEventForParentSms(queue.eventType) !== normalizedEventType) continue;

    const matchesDedupe = params.dedupeKey && queue.dedupeKey === params.dedupeKey;
    const matchesEventAt = queue.eventAtMs > 0 && Math.abs(queue.eventAtMs - eventAtMs) <= 2 * MINUTE_MS;
    const matchesRenderedTime =
      Boolean(queue.renderedMessage) &&
      queue.renderedMessage.includes(params.studentName) &&
      queue.renderedMessage.includes(eventTimeLabel);

    if (!matchesDedupe && !matchesEventAt && !matchesRenderedTime) continue;

    if (hasActiveOrSentSmsQueueStatus(queue.status)) {
      return "active_or_sent";
    }
    if (hasRetryableSmsQueueStatus(queue.status)) {
      hasRetryableQueue = true;
    }
  }

  return hasRetryableQueue ? "retryable" : "none";
}

function shouldRepairAttendanceSmsEvent(params: {
  smsStatus: string;
  existingQueueState: ExistingAttendanceSmsQueueState;
}): { shouldRepair: boolean; force: boolean } {
  if (params.existingQueueState === "active_or_sent") {
    return { shouldRepair: false, force: false };
  }

  if (params.smsStatus && params.smsStatus !== "failed") {
    if (params.smsStatus === "deduped" && params.existingQueueState === "none") {
      return { shouldRepair: true, force: true };
    }
    return { shouldRepair: false, force: false };
  }

  return {
    shouldRepair: true,
    force: params.smsStatus === "failed" || params.existingQueueState === "retryable",
  };
}

async function repairAttendanceSmsQueueForCenter(
  db: admin.firestore.Firestore,
  centerId: string,
  dateKey: string,
  options: { windowStartMs?: number; limit?: number } = {}
): Promise<AttendanceSmsRepairResult> {
  const eventsSnap = await db
    .collection(`centers/${centerId}/attendanceEvents`)
    .where("dateKey", "==", dateKey)
    .limit(Math.max(1, Math.floor(options.limit || 1500)))
    .get();
  const targetEvents = eventsSnap.docs
    .map((eventDoc) => {
      const eventData = eventDoc.data() || {};
      const eventType = normalizeAttendanceEventForParentSms(eventData.eventType);
      const studentId = asTrimmedString(eventData.studentId);
      if (!eventType || !studentId) return null;
      return {
        eventId: eventDoc.id,
        data: eventData,
        studentId,
        eventType,
        eventAt:
          toKstDateFromUnknownTimestamp(eventData.occurredAt)
          || toKstDateFromUnknownTimestamp(eventData.createdAt)
          || toKstDate(),
      };
    })
    .filter((event): event is {
      eventId: string;
      data: Record<string, unknown>;
      studentId: string;
      eventType: AttendanceSmsEventType;
      eventAt: Date;
    } => {
      if (!event) return false;
      return !options.windowStartMs || event.eventAt.getTime() >= options.windowStartMs;
    })
    .sort((left, right) => left.eventAt.getTime() - right.eventAt.getTime());

  const studentIds = Array.from(new Set(targetEvents.map((event) => event.studentId)));
  const studentRefs = studentIds.map((studentId) => db.doc(`centers/${centerId}/students/${studentId}`));
  const studentSnaps = studentRefs.length > 0 ? await db.getAll(...studentRefs) : [];
  const studentNameById = new Map<string, string>();
  studentSnaps.forEach((studentSnap) => {
    const studentData = studentSnap.exists ? studentSnap.data() || {} : {};
    studentNameById.set(studentSnap.id, asTrimmedString(studentData.name, "학생"));
  });
  const existingQueues = await loadExistingAttendanceSmsQueuesForDate(db, centerId, dateKey);

  let queuedCount = 0;
  let suppressedCount = 0;
  let skippedCount = 0;
  let noRecipientCount = 0;
  let failedCount = 0;

  for (const event of targetEvents) {
    const eventMeta = asRecord(event.data.meta);
    const studentName = studentNameById.get(event.studentId)
      || asTrimmedString(eventMeta?.studentName || event.data.studentName, "학생");
    const dedupeKey = buildAttendanceEventSmsDedupeKey({
      centerId,
      studentId: event.studentId,
      eventType: event.eventType,
      eventAt: event.eventAt,
      eventId: event.eventId,
    });
    const existingQueueState = getExistingAttendanceSmsQueueState(existingQueues, {
      studentId: event.studentId,
      studentName,
      eventType: event.eventType,
      eventAt: event.eventAt,
      dedupeKey,
    });
    const repairDecision = shouldRepairAttendanceSmsEvent({
      smsStatus: asTrimmedString(event.data.smsStatus),
      existingQueueState,
    });
    if (!repairDecision.shouldRepair) {
      skippedCount += 1;
      continue;
    }
    const queueResult = await queueAttendanceEventSmsV2(db, {
      centerId,
      eventId: event.eventId,
      eventData: event.data,
      force: repairDecision.force,
    });

    if (queueResult.status === "deduped") {
      skippedCount += 1;
      continue;
    }
    if (queueResult.status === "failed") {
      failedCount += 1;
      continue;
    }
    if (queueResult.status === "no_recipient") {
      noRecipientCount += 1;
      continue;
    }

    queuedCount += queueResult.queuedCount;
    suppressedCount += queueResult.suppressedCount;
  }

  return {
    centerId,
    dateKey,
    scannedCount: eventsSnap.size,
    targetCount: targetEvents.length,
    queuedCount,
    suppressedCount,
    skippedCount,
    noRecipientCount,
    failedCount,
  };
}

async function repairRecentAttendanceSmsQueueForCenter(
  db: admin.firestore.Firestore,
  centerId: string,
  dateKey: string,
  windowStartMs: number
): Promise<AttendanceSmsRepairResult> {
  return repairAttendanceSmsQueueForCenter(db, centerId, dateKey, {
    windowStartMs,
    limit: 300,
  });
}

export const repairTodayAttendanceSmsQueue = smsDispatcherFunctions.https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = asTrimmedString(data?.centerId);
  if (!centerId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId가 필요합니다.");
  }

  const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
  const callerRole = callerMemberSnap.exists ? callerMemberSnap.data()?.role : null;
  if (!isAdminRole(callerRole)) {
    throw new functions.https.HttpsError("permission-denied", "센터 관리자만 문자 접수 복구를 실행할 수 있습니다.");
  }

  const todayKey = toStudyDayKey(toKstDate());
  const requestedDateKey = asTrimmedString(data?.dateKey, todayKey);
  if (requestedDateKey !== todayKey) {
    throw new functions.https.HttpsError("invalid-argument", "현재 운영일의 문자 접수만 복구할 수 있습니다.");
  }

  const result = await repairAttendanceSmsQueueForCenter(db, centerId, todayKey);

  return {
    ok: true,
    ...result,
  };
});

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
  const nowMinutes = nowKst.getHours() * 60 + nowKst.getMinutes();
  const dateKey = toStudyDayKey(nowKst);

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
    if (ACTIVE_STUDY_ATTENDANCE_STATUSES.has(String(seatData.status || ""))) {
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

    const expectedTimeRaw = asTrimmedString(studentData.expectedArrivalTime);
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
  const queueId = queueRef.id;
  const queueEventAt = toTimestampOrNow(queueData.eventAt || queueData?.metadata?.eventAt);
  const queueDateKey = asTrimmedString(queueData.dateKey);
  const queueDedupeKey = asTrimmedString(queueData.dedupeKey);
  const queueSourceEventId = asTrimmedString(queueData.sourceEventId || queueData?.metadata?.sourceEventId);
  const studentId = asTrimmedString(queueData.studentId);
  const studentName = asTrimmedString(queueData.studentName || queueData?.metadata?.studentName, "학생");
  const parentUid = asTrimmedString(queueData.parentUid);
  const parentName = asTrimmedString(queueData.parentName);
  const eventType = String(queueData.eventType || "study_start") as SmsQueueEventType;
  const rawMessage = asTrimmedString(queueData.renderedMessage || queueData.message || "");
  const message = trimSmsToByteLimit(
    normalizeTrackManagedSmsMessage(rawMessage, {
      ensurePrefix: shouldEnsureTrackManagedSmsPrefix(eventType),
    })
  );
  const messageBytes = calculateSmsBytes(message);

  if (parentUid === STUDENT_SMS_FALLBACK_UID) {
    await queueRef.set({
      status: "suppressed_opt_out",
      providerStatus: "suppressed_parent_only",
      updatedAt: nowTs,
      nextAttemptAt: admin.firestore.FieldValue.delete(),
      processingStartedAt: admin.firestore.FieldValue.delete(),
      processingLeaseUntil: admin.firestore.FieldValue.delete(),
      lastErrorCode: admin.firestore.FieldValue.delete(),
      lastErrorMessage: admin.firestore.FieldValue.delete(),
    }, { merge: true });
    await appendSmsDeliveryLog(db, {
      centerId,
      queueId,
      studentId,
      studentName,
      parentUid,
      parentName: parentName || "학생 본인",
      phoneNumber: receiver || queueData.phoneNumber || queueData.to || null,
      eventType,
      renderedMessage: message || "",
      messageBytes,
      provider,
      attemptNo: attemptCount,
      status: "suppressed_opt_out",
      createdAt: nowTs,
      eventAt: queueEventAt,
      dateKey: queueDateKey,
      suppressedReason: "student_fallback_blocked",
      dedupeKey: queueDedupeKey || null,
      sourceEventId: queueSourceEventId || null,
    });
    return;
  }

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
      messageBytes,
      provider,
      attemptNo: attemptCount,
      status: "failed",
      createdAt: nowTs,
      eventAt: queueEventAt,
      dateKey: queueDateKey,
      failedAt: nowTs,
      errorCode: "INVALID_QUEUE_ITEM",
      errorMessage: "수신번호 또는 문자 본문이 비어 있습니다.",
      dedupeKey: queueDedupeKey || null,
      sourceEventId: queueSourceEventId || null,
    });
    return;
  }

  if (settings.smsEnabled === false || provider === "none") {
    await queueRef.set({
      message,
      renderedMessage: message,
      messageBytes,
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
        message,
        renderedMessage: message,
        messageBytes,
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
        message,
        renderedMessage: message,
        messageBytes,
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

  if (dispatchResult.ok) {
    await queueRef.set({
      provider,
      sender: sender || null,
      message,
      renderedMessage: message,
      messageBytes,
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
      eventAt: queueEventAt,
      dateKey: queueDateKey,
      sentAt: nowTs,
      dedupeKey: queueDedupeKey || null,
      sourceEventId: queueSourceEventId || null,
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
      message,
      renderedMessage: message,
      messageBytes,
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
      message,
      renderedMessage: message,
      messageBytes,
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
    eventAt: queueEventAt,
    dateKey: queueDateKey,
    failedAt: nowTs,
    errorCode: lastErrorCode,
    errorMessage: lastErrorMessage,
    dedupeKey: queueDedupeKey || null,
    sourceEventId: queueSourceEventId || null,
  });
}
function isAdminRole(role: unknown): boolean {
  if (typeof role !== "string") return false;
  const raw = role.trim();
  return adminRoles.has(raw) || normalizeMembershipRoleValue(raw) === "centerAdmin";
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

async function loadStudentProfileMap(
  db: admin.firestore.Firestore,
  centerId: string,
  studentIds: string[]
): Promise<Map<string, Record<string, any>>> {
  const profileRefs = studentIds.map((studentId) => db.doc(`centers/${centerId}/students/${studentId}`));
  const profileSnaps = await getDocsInChunks(db, profileRefs);
  const profileMap = new Map<string, Record<string, any>>();

  profileSnaps.forEach((snap) => {
    if (!snap.exists) return;
    profileMap.set(snap.id, snap.data() as Record<string, any>);
  });

  return profileMap;
}

async function loadStudyMinutesByStudentForDateKeys(
  db: admin.firestore.Firestore,
  centerId: string,
  dateKeys: string[]
): Promise<Map<string, number>> {
  const uniqueDateKeys = Array.from(
    new Set(dateKeys.filter((dateKey) => typeof dateKey === "string" && dateKey.length > 0))
  );
  if (uniqueDateKeys.length === 0) {
    return new Map<string, number>();
  }

  const totalsByStudentId = new Map<string, number>();
  const statSnaps = await Promise.all(
    uniqueDateKeys.map((dateKey) => db.collection(`centers/${centerId}/dailyStudentStats/${dateKey}/students`).get())
  );

  statSnaps.forEach((snap) => {
    snap.forEach((docSnap) => {
      const raw = docSnap.data() as Record<string, unknown>;
      const studentId = asTrimmedString(raw.studentId, docSnap.id);
      if (!studentId) return;

      const totalStudyMinutes = Math.max(0, Math.round(Number(raw.totalStudyMinutes ?? 0)));
      totalsByStudentId.set(studentId, (totalsByStudentId.get(studentId) || 0) + totalStudyMinutes);
    });
  });

  return totalsByStudentId;
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
  const nowMinutes = nowKst.getHours() * 60 + nowKst.getMinutes();
  const weekAgoKey = toStudyDayKey(new Date(nowKst.getTime() - 6 * 24 * 60 * 60 * 1000));
  const penaltyCutoff = admin.firestore.Timestamp.fromMillis(nowKst.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfTodayKst = new Date(nowKst);
  startOfTodayKst.setHours(0, 0, 0, 0);
  const endOfTodayKst = new Date(nowKst);
  endOfTodayKst.setHours(23, 59, 59, 999);

  const [membersSnap, attendanceSnap, todayStatsSnap, riskCacheSnap, counselingSnap, reportsSnap, penaltyLogsSnap] =
    await Promise.all([
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
      const expectedArrivalTime = asTrimmedString(student?.expectedArrivalTime);
      const expectedArrivalMinutes = parseExpectedArrivalMinutes(expectedArrivalTime);
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
          `예상 등교 시간 ${context.expectedArrivalTime || "학생이 정한 시간"} 기준으로 미입실 상태입니다.`,
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
  const dateKey = toStudyDayKey(nowKst);
  const payload = await buildClassroomSignalsForCenter(db, centerId, nowKst, dateKey);
  await db.doc(`centers/${centerId}/classroomSignals/${dateKey}`).set({
    ...payload,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return payload;
}

function assertInviteUsable(inv: InviteDoc, expectedRole?: AllowedRole) {
  const inviteRole = normalizeSignupRole(inv.intendedRole);
  if (!inviteRole) {
    throw new functions.https.HttpsError("failed-precondition", "Invite has invalid role configuration.", {
      userMessage: "초대 코드의 역할 설정이 올바르지 않습니다. 센터 관리자에게 문의해 주세요.",
    });
  }
  if (expectedRole && inviteRole !== expectedRole) {
    throw new functions.https.HttpsError("failed-precondition", "Invite role does not match selected signup role.", {
      userMessage: "선택한 역할과 초대 코드 권한이 맞지 않습니다.",
    });
  }
  if (inv.isActive === false) {
    throw new functions.https.HttpsError("failed-precondition", "Invite code is inactive.", {
      userMessage: "비활성화된 초대 코드입니다.",
    });
  }
  if (typeof inv.maxUses === "number" && typeof inv.usedCount === "number" && inv.usedCount >= inv.maxUses) {
    throw new functions.https.HttpsError("failed-precondition", "Invite code usage limit exceeded.", {
      userMessage: "사용 가능 횟수가 모두 소진된 초대 코드입니다.",
    });
  }
  if (inv.expiresAt && inv.expiresAt.toMillis && inv.expiresAt.toMillis() < Date.now()) {
    throw new functions.https.HttpsError("failed-precondition", "Invite code has expired.", {
      userMessage: "만료된 초대 코드입니다.",
    });
  }
}

const sharedStudyRoomScheduleWeekdays = [1, 2, 3, 4, 5, 0];
const saturdayStudyRoomScheduleWeekdays = [6];
const nsuStudyRoomScheduleWeekdays = [1, 2, 3, 4, 5, 6, 0];
const sharedStudyRoomArrivalTime = "18:00";
const sharedStudyRoomDepartureTime = "23:30";
const saturdayStudyRoomArrivalTime = "08:30";
const saturdayStudyRoomDepartureTime = "16:40";
const nsuStudyRoomArrivalTime = "17:00";
const nsuStudyRoomDepartureTime = "01:00";
const defaultStudyRoomScheduleTemplateId = "default-shared-study-room-schedule";
const saturdayStudyRoomScheduleTemplateId = "default-saturday-mandatory-track-schedule";
const nsuStudyRoomScheduleTemplateId = "default-nsu-study-room-schedule";
const sharedStudyRoomClassScheduleId = "shared-study-room-schedule";
const saturdayStudyRoomClassScheduleId = "saturday-mandatory-track-schedule";
const nsuStudyRoomClassScheduleId = "nsu-study-room-schedule";

function isNsuStudyRoomClassName(className: unknown): boolean {
  const normalized = String(className || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[._-]/g, "");

  return (
    normalized.includes("n수") ||
    normalized.includes("엔수") ||
    normalized.includes("재수") ||
    normalized.includes("nstudent") ||
    normalized.includes("n반")
  );
}

function buildDefaultStudyRoomScheduleTemplateData(params: {
  centerId: string;
  className: string | null;
  timestamp: admin.firestore.Timestamp;
}) {
  const isNsu = isNsuStudyRoomClassName(params.className);
  const templateConfigs = isNsu
    ? [
        {
          id: nsuStudyRoomScheduleTemplateId,
          classScheduleId: nsuStudyRoomClassScheduleId,
          classScheduleName: "N수반 트랙제",
          weekdays: nsuStudyRoomScheduleWeekdays,
          arrivalPlannedAt: nsuStudyRoomArrivalTime,
          departurePlannedAt: nsuStudyRoomDepartureTime,
          note: "N수반은 센터 공통 트랙제와 별도 기준으로 운영합니다. 특이사항이 있는 학생만 학원 및 외출 일정을 별도로 등록합니다.",
        },
      ]
    : [
        {
          id: defaultStudyRoomScheduleTemplateId,
          classScheduleId: sharedStudyRoomClassScheduleId,
          classScheduleName: "센터 공통 트랙제",
          weekdays: sharedStudyRoomScheduleWeekdays,
          arrivalPlannedAt: sharedStudyRoomArrivalTime,
          departurePlannedAt: sharedStudyRoomDepartureTime,
          note: "의무 등원은 18:00, 의무 하원은 23:30입니다. 특이사항이 없으면 이 트랙제를 그대로 따르고, 학원 및 외출 일정이 있는 학생만 별도로 등록합니다.",
        },
        {
          id: saturdayStudyRoomScheduleTemplateId,
          classScheduleId: saturdayStudyRoomClassScheduleId,
          classScheduleName: "토요일 의무 트랙제",
          weekdays: saturdayStudyRoomScheduleWeekdays,
          arrivalPlannedAt: saturdayStudyRoomArrivalTime,
          departurePlannedAt: saturdayStudyRoomDepartureTime,
          note: "토요일은 의무 트랙제로 운영합니다. 08:30 입실 후 16:40 기록 마감까지 토요일 전용 트랙을 따릅니다.",
        },
      ];

  return templateConfigs.map((config) => ({
    id: config.id,
    data: {
      centerId: params.centerId,
      name: `${config.classScheduleName} 기본 등하원`,
      weekdays: config.weekdays,
      arrivalPlannedAt: config.arrivalPlannedAt,
      departurePlannedAt: config.departurePlannedAt,
      academyNameDefault: null,
      academyStartAtDefault: null,
      academyEndAtDefault: null,
      hasExcursionDefault: false,
      defaultExcursionStartAt: null,
      defaultExcursionEndAt: null,
      defaultExcursionReason: null,
      note: config.note,
      classScheduleId: config.classScheduleId,
      classScheduleName: config.classScheduleName,
      active: true,
      timezone: "Asia/Seoul",
      source: "default-study-room-class-schedule",
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    },
  }));
}

function seedDefaultStudyRoomScheduleTemplateInTransaction(params: {
  db: admin.firestore.Firestore;
  transaction: admin.firestore.Transaction;
  uid: string;
  centerId: string;
  className: string | null;
  timestamp: admin.firestore.Timestamp;
}) {
  const templates = buildDefaultStudyRoomScheduleTemplateData({
    centerId: params.centerId,
    className: params.className,
    timestamp: params.timestamp,
  });

  templates.forEach((template) => {
    params.transaction.set(
      params.db.doc(`users/${params.uid}/scheduleTemplates/${template.id}`),
      template.data,
      { merge: true }
    );
  });
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

  const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
  if (!callerMemberSnap.exists || !isAdminRole(callerMemberSnap.data()?.role)) {
    throw new functions.https.HttpsError("permission-denied", "센터 관리자만 삭제 가능합니다.");
  }

  const targetMemberRef = db.doc(`centers/${centerId}/members/${studentId}`);
  const targetMemberSnap = await targetMemberRef.get();
  if (!targetMemberSnap.exists || targetMemberSnap.data()?.role !== "student") {
    throw new functions.https.HttpsError("failed-precondition", "해당 센터의 학생 계정만 삭제할 수 있습니다.");
  }
  const targetStudentSnap = await db.doc(`centers/${centerId}/students/${studentId}`).get();
  const targetParentLinkCode = normalizeParentLinkCodeValue(targetStudentSnap.data()?.parentLinkCode);

  try {
    const errors: string[] = [];
    await db.doc(`centers/${centerId}/studySessionDeletionAllowances/${studentId}`).set({
      studentId,
      centerId,
      reason: "deleteStudentAccount",
      createdByUid: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 60 * MINUTE_MS),
    }, { merge: true });

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
        } catch (e: any) {
          errors.push(`${path}: ${e?.message || "delete failed"}`);
        }
      }),
      ...filterCols.map(async (colPath) => {
        try {
          const q = await db.collection(colPath).where("studentId", "==", studentId).get();
          await Promise.all(q.docs.map((docSnap) => db.recursiveDelete(docSnap.ref)));
        } catch (e: any) {
          errors.push(`${colPath}: ${e?.message || "query delete failed"}`);
        }
      }),
      (async () => {
        try {
          const statsSnap = await db.collectionGroup("students").where("studentId", "==", studentId).get();
          const statDocs = statsSnap.docs.filter((docSnap) =>
            docSnap.ref.path.startsWith(`centers/${centerId}/dailyStudentStats/`)
          );
          await Promise.all(statDocs.map((docSnap) => db.recursiveDelete(docSnap.ref)));
        } catch (e: any) {
          errors.push(`dailyStudentStats: ${e?.message || "stats cleanup failed"}`);
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
        } catch (e: any) {
          errors.push(`leaderboards: ${e?.message || "leaderboard cleanup failed"}`);
        }
      })(),
      (async () => {
        if (!targetParentLinkCode) return;
        try {
          const lookupRef = getParentLinkLookupRef(db, targetParentLinkCode);
          const lookupSnap = await lookupRef.get();
          const lookupData = lookupSnap.exists ? (lookupSnap.data() as ParentLinkLookupDoc) : null;
          const lookupStudentId = asTrimmedString(lookupData?.studentId);
          const lookupCenterId = asTrimmedString(lookupData?.centerId);
          if (!lookupSnap.exists || (lookupStudentId === studentId && lookupCenterId === centerId)) {
            await db.recursiveDelete(lookupRef);
          }
        } catch (e: any) {
          errors.push(`parentLinkCodeLookup: ${e?.message || "lookup cleanup failed"}`);
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
                  status: "absent",
                  updatedAt: admin.firestore.Timestamp.now(),
                  lastCheckInAt: admin.firestore.FieldValue.delete(),
                },
                { merge: true }
              )
            )
          );
        } catch (e: any) {
          errors.push(`attendanceCurrent: ${e?.message || "seat cleanup failed"}`);
        }
      })(),
    ]);

    if (errors.length > 0) {
      throw new Error(`학생 데이터 일부 삭제 실패 (${errors.length}건)`);
    }

    try {
      await auth.deleteUser(studentId);
    } catch (e: any) {
      if (e?.code !== "auth/user-not-found") {
        throw e;
      }
    }

    return { ok: true, message: "정리가 완료되었습니다." };
  } catch (error: any) {
    throw new functions.https.HttpsError("internal", "학생 계정 삭제 중 오류가 발생했습니다.");
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
    throw new functions.https.HttpsError("internal", "선생님 계정 삭제 중 오류가 발생했습니다.");
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
    phoneNumber,
    grade,
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
  const existingPhoneNumber = resolveFirstValidPhoneNumber(existingStudentData?.phoneNumber);
  const callerDisplayName = asTrimmedString(
    callerMemberData?.displayName
      || callerMemberData?.name
      || callerUserCenterData?.displayName
      || context.auth.token?.name
  );

  const trimmedDisplayName = typeof displayName === "string" ? displayName.trim() : "";
  const trimmedSchoolName = typeof schoolName === "string" ? schoolName.trim() : "";
  const trimmedGrade = typeof grade === "string" ? grade.trim() : "";
  const phoneNumberProvided = phoneNumber !== undefined;
  const normalizedPhoneNumber = phoneNumberProvided ? normalizePhoneNumber(phoneNumber) : "";
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

  if (phoneNumberProvided && !isAdminCaller) {
    throw new functions.https.HttpsError("permission-denied", "Only admins can change student phone numbers.", {
      userMessage: "학생 전화번호 변경은 센터 관리자만 가능합니다.",
    });
  }

  if (phoneNumberProvided && phoneNumber !== null && String(phoneNumber).trim() && !normalizedPhoneNumber) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid phone number.", {
      userMessage: "학생 전화번호는 01012345678 형식으로 입력해 주세요.",
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

  if (isSelfStudentCaller && !canEditOtherStudent) {
    throw new functions.https.HttpsError("permission-denied", "Student profiles are read-only for students.", {
      userMessage: "학생은 본인 프로필을 확인만 할 수 있습니다. 변경이 필요하면 센터 관리자에게 요청해 주세요.",
    });
  }

  const timestamp = admin.firestore.Timestamp.now();
  const logPhoneNumberChangeIfNeeded = async () => {
    if (!isAdminCaller || !phoneNumberProvided) return;

    try {
      await writeStudentPhoneNumberAuditLog({
        db,
        centerId,
        studentId,
        studentName: trimmedDisplayName || asTrimmedString(existingStudentData?.name || existingStudentData?.displayName),
        studentClassName:
          normalizedClassName !== undefined
            ? normalizedClassName
            : asTrimmedString(existingStudentData?.className),
        previousPhoneNumber: existingPhoneNumber,
        nextPhoneNumber: normalizedPhoneNumber || null,
        changedByUid: callerUid,
        changedByRole: callerRole,
        changedByName: callerDisplayName || null,
        createdAt: timestamp,
      });
    } catch (auditError: any) {
      console.warn("[updateStudentAccount] phone audit log skipped", {
        centerId,
        studentId,
        callerUid,
        message: auditError?.message || auditError,
      });
    }
  };

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

    const batch = db.batch();

    const userRef = db.doc("users/" + studentId);
    const userUpdate: any = { updatedAt: timestamp };
    if (trimmedDisplayName) userUpdate.displayName = trimmedDisplayName;
    if (trimmedSchoolName) userUpdate.schoolName = trimmedSchoolName;
    if (phoneNumberProvided) userUpdate.phoneNumber = normalizedPhoneNumber || null;
    const hasUserWrite = trimmedDisplayName.length > 0 || trimmedSchoolName.length > 0 || phoneNumberProvided;
    if (hasUserWrite) {
      batch.set(userRef, userUpdate, { merge: true });
    }

    const studentUpdate: any = { updatedAt: timestamp };
    if (trimmedDisplayName) studentUpdate.name = trimmedDisplayName;
    if (trimmedSchoolName) studentUpdate.schoolName = trimmedSchoolName;
    if (trimmedGrade) studentUpdate.grade = trimmedGrade;
    if (phoneNumberProvided) studentUpdate.phoneNumber = normalizedPhoneNumber || null;
    if (parentLinkCodeProvided) studentUpdate.parentLinkCode = normalizedParentLinkCode || null;
    if (canEditOtherStudent && hasClassName) studentUpdate.className = normalizedClassName;
    batch.set(studentRef, studentUpdate, { merge: true });

    if (parentLinkCodeProvided || trimmedDisplayName) {
      const effectiveParentLinkCode = parentLinkCodeProvided ? normalizedParentLinkCode : existingParentLinkCode;
      const effectiveStudentName = trimmedDisplayName || asTrimmedString(existingStudentData?.name || existingStudentData?.displayName, "학생");
      if (existingParentLinkCode && existingParentLinkCode !== effectiveParentLinkCode) {
        const oldLookupRef = getParentLinkLookupRef(db, existingParentLinkCode);
        const oldLookupSnap = await oldLookupRef.get();
        const oldLookupData = oldLookupSnap.exists ? (oldLookupSnap.data() as ParentLinkLookupDoc) : null;
        const oldLookupStudentId = asTrimmedString(oldLookupData?.studentId);
        const oldLookupCenterId = asTrimmedString(oldLookupData?.centerId);
        if (!oldLookupSnap.exists || (oldLookupStudentId === studentId && oldLookupCenterId === centerId)) {
          batch.delete(oldLookupRef);
        }
      }
      if (effectiveParentLinkCode) {
        const lookupRef = getParentLinkLookupRef(db, effectiveParentLinkCode);
        const lookupSnap = await lookupRef.get();
        const lookupData = lookupSnap.exists ? (lookupSnap.data() as ParentLinkLookupDoc) : null;
        const lookupStudentId = asTrimmedString(lookupData?.studentId);
        const lookupCenterId = asTrimmedString(lookupData?.centerId);
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
          createdAt: lookupData?.createdAt,
        });
        if (lookupSnap.exists) {
          batch.set(lookupRef, lookupPayload, { merge: true });
        } else {
          batch.create(lookupRef, lookupPayload);
        }
      }
    }

    const memberRef = db.doc("centers/" + centerId + "/members/" + studentId);
    const memberUpdate: any = { updatedAt: timestamp };
    if (trimmedDisplayName) memberUpdate.displayName = trimmedDisplayName;
    if (phoneNumberProvided) memberUpdate.phoneNumber = normalizedPhoneNumber || null;
    if (hasClassName) memberUpdate.className = normalizedClassName;
    if (isAdminCaller && memberStatusProvided) memberUpdate.status = normalizedMemberStatus;
    if (canEditOtherStudent) {
      batch.set(memberRef, memberUpdate, { merge: true });
    }

    const userCenterRef = db.doc("userCenters/" + studentId + "/centers/" + centerId);
    const userCenterUpdate: any = { updatedAt: timestamp };
    if (hasClassName) userCenterUpdate.className = normalizedClassName;
    if (phoneNumberProvided) userCenterUpdate.phoneNumber = normalizedPhoneNumber || null;
    if (isAdminCaller && memberStatusProvided) userCenterUpdate.status = normalizedMemberStatus;
    if (canEditOtherStudent && (hasClassName || phoneNumberProvided)) {
      batch.set(userCenterRef, userCenterUpdate, { merge: true });
    } else if (isAdminCaller && (memberStatusProvided || phoneNumberProvided)) {
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
      if (canEditOtherStudent) {
        coreWrites.push(memberRef.set(memberUpdate, { merge: true }));
      }
      if (canEditOtherStudent && (hasClassName || phoneNumberProvided || (isAdminCaller && memberStatusProvided))) {
        coreWrites.push(userCenterRef.set(userCenterUpdate, { merge: true }));
      }

      const coreResults = await Promise.allSettled(coreWrites);
      const hasCoreFailure = coreResults.some((result) => result.status === "rejected");

      if (!hasCoreFailure) {
        await logPhoneNumberChangeIfNeeded();
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

    await logPhoneNumberChangeIfNeeded();

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
      userMessage: toSafeUserMessage(e, "학생 정보를 수정하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."),
    });
  }
});

function buildCounselingDemoUid(centerId: string, role: "student" | "parent") {
  const token = centerId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "center";
  return `counseling-demo-${role}-${token}`;
}

function buildCounselingDemoEmail(centerId: string, role: "student" | "parent") {
  const token = centerId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18) || "center";
  return `counseling.${role}.${token}@track-demo.local`;
}

function buildCounselingDemoPassword(role: "student" | "parent") {
  const roleToken = role === "student" ? "Student" : "Parent";
  return `Track${roleToken}${randomInt(1000, 10000)}!`;
}

function buildCounselingDemoStudySeeds(referenceDate: Date) {
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

    return {
      ...preset,
      date: dayDate,
      dateKey: toDateKey(dayDate),
      firstSessionStartAt,
      lastSessionEndAt,
      growthRate: preset.minutes - previousMinutes,
    };
  });
}

function getAuthErrorCode(error: any): string {
  return String(error?.code || error?.errorInfo?.code || "").trim().toLowerCase();
}

async function upsertCounselingDemoAuthUser(params: {
  auth: admin.auth.Auth;
  uid: string;
  email: string;
  password: string;
  displayName: string;
}) {
  const { auth, uid, email, password, displayName } = params;

  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, { email, password, displayName });
    return;
  } catch (error: any) {
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
  } catch (error: any) {
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

async function resolveCounselingDemoParentLinkCode(
  db: admin.firestore.Firestore,
  centerId: string,
  studentId: string,
  preferredCode?: unknown
) {
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
    const candidate = String(randomInt(0, 1_000_000)).padStart(6, "0");
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

export const registerStudent = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();
  const auth = admin.auth();
  const { email, password, displayName, schoolName, grade, centerId, phoneNumber } = data;

  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "인증 필요");
  if (!email || !password || !displayName || !centerId) {
    throw new functions.https.HttpsError("invalid-argument", "필수값 누락");
  }
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  if (phoneNumber !== undefined && phoneNumber !== null && String(phoneNumber).trim() && !normalizedPhoneNumber) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid phone number.", {
      userMessage: "학생 전화번호는 01012345678 형식으로 입력해 주세요.",
    });
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
      const phonePayload = normalizedPhoneNumber ? { phoneNumber: normalizedPhoneNumber } : {};
      t.set(db.doc(`users/${uid}`), { id: uid, email, displayName, schoolName, ...phonePayload, createdAt: timestamp, updatedAt: timestamp });
      t.set(db.doc(`centers/${centerId}/members/${uid}`), { id: uid, centerId, role: "student", status: "active", joinedAt: timestamp, displayName, ...phonePayload });
      t.set(db.doc(`userCenters/${uid}/centers/${centerId}`), { id: centerId, centerId, role: "student", status: "active", joinedAt: timestamp, ...phonePayload });
      t.set(db.doc(`centers/${centerId}/students/${uid}`), { id: uid, name: displayName, schoolName, grade, phoneNumber: normalizedPhoneNumber || null, createdAt: timestamp, updatedAt: timestamp });
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
      userMessage: toSafeUserMessage(e, "학생 계정 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."),
    });
  }
});

export const createCounselingDemoBundle = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();
  const auth = admin.auth();
  const centerId = String(data?.centerId || "").trim();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증 필요");
  }
  if (!centerId) {
    throw new functions.https.HttpsError("invalid-argument", "센터 정보가 필요합니다.");
  }

  const callerUid = context.auth.uid;
  const callerMemberRef = db.doc(`centers/${centerId}/members/${callerUid}`);
  const callerMemberSnap = await callerMemberRef.get();
  if (!callerMemberSnap.exists || !isAdminRole(callerMemberSnap.data()?.role)) {
    throw new functions.https.HttpsError("permission-denied", "센터 관리자만 상담 데모 계정을 만들 수 있습니다.");
  }

  const callerMemberData = callerMemberSnap.data() as Record<string, unknown> | undefined;
  const teacherName =
    asTrimmedString(callerMemberData?.displayName)
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
  const parentLinkCode = await resolveCounselingDemoParentLinkCode(
    db,
    centerId,
    studentUid,
    existingStudentSnap.data()?.parentLinkCode
  );

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

    batch.set(
      getParentLinkLookupRef(db, parentLinkCode),
      buildParentLinkLookupPayload({
        code: parentLinkCode,
        centerId,
        studentId: studentUid,
        studentName: studentDisplayName,
        timestamp: nowTs,
      }),
      { merge: true }
    );

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
        const reportHistoryWindow = sampleDays.slice(Math.max(0, index - 6), index);
        const reportHistoryAverage = reportHistoryWindow.length > 0
          ? Math.round(reportHistoryWindow.reduce((sum, item) => sum + item.minutes, 0) / reportHistoryWindow.length)
          : 0;

        batch.set(db.doc(`centers/${centerId}/dailyReports/${day.dateKey}_${studentUid}`), {
          id: `${day.dateKey}_${studentUid}`,
          studentId: studentUid,
          teacherId: callerUid,
          dateKey: day.dateKey,
          studentName: studentDisplayName,
          content:
            index === sampleDays.length - 1
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
            history7Days: reportHistoryWindow.map((item) => ({
              date: item.dateKey,
              minutes: item.minutes,
            })),
            metrics: {
              growthRate: day.growthRate,
              deltaMinutesFromAvg: day.minutes - reportHistoryAverage,
              avg7StudyMinutes: reportHistoryAverage,
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
      { id: "counseling-demo-log-1", daysAgo: 6, type: "academic" as const, content: "수학 오답 노트를 단순 정답 암기형에서 개념 재서술형으로 바꾸기로 합의했습니다.", improvement: "오답 1문항마다 핵심 개념 한 줄 요약을 직접 작성합니다." },
      { id: "counseling-demo-log-2", daysAgo: 2, type: "life" as const, content: "주중 피로 누적 때문에 마지막 블록 집중력이 떨어지는 패턴을 확인했습니다.", improvement: "저녁 블록 시작 전 10분 회복 루틴과 과목 전환 체크리스트를 도입합니다." },
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
      { id: "counseling-demo-penalty-1", daysAgo: 9, pointsDelta: 1, reason: "지각 출석", source: "attendance_request" as const, requestType: "late" as const },
      { id: "counseling-demo-penalty-2", daysAgo: 3, pointsDelta: 1, reason: "루틴 미작성", source: "routine_missing" as const },
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
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error("[createCounselingDemoBundle] failed", {
      centerId,
      callerUid,
      message: error?.message || error,
      stack: error?.stack || null,
    });
    throw new functions.https.HttpsError("internal", "Operation failed due to internal error.", {
      userMessage: toSafeUserMessage(error, "상담 데모 계정을 만드는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."),
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
      if (inv.intendedRole === "student") {
        seedDefaultStudyRoomScheduleTemplateInTransaction({
          db,
          transaction: t,
          uid,
          centerId: inv.centerId,
          className: inv.targetClassName || null,
          timestamp: ts,
        });
      }
      t.update(inviteRef, { usedCount: admin.firestore.FieldValue.increment(1), updatedAt: ts });
      return { ok: true, message: "센터 가입이 완료되었습니다." };
    });
  } catch (e: any) {
    if (e instanceof functions.https.HttpsError) {
      throw e;
    }
    throw new functions.https.HttpsError("internal", "Operation failed due to internal error.", {
      userMessage: toSafeUserMessage(e, "센터 가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."),
    });
  }
});

export const completeSignupWithInvite = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const uid = context.auth.uid;
  const role = normalizeSignupRole(data?.role);
  const code = String(data?.code || "").trim();
  const schoolName = String(data?.schoolName || "").trim();
  const grade = String(data?.grade || "고등학생").trim();
  const parentLinkCode = String(data?.parentLinkCode || "").trim();
  const studentLinkCodeInput = data?.studentLinkCode ?? data?.parentLinkCode ?? "";
  const studentLinkCode = String(studentLinkCodeInput).trim();
  const displayNameInput = String(data?.displayName || "").trim();
  const parentPhoneNumber = normalizePhoneNumber(data?.parentPhoneNumber || data?.phoneNumber || "");
  const studentPhoneNumber = role === "student" ? normalizePhoneNumber(data?.phoneNumber || "") : "";
  const legalConsentsInput =
    data?.legalConsents && typeof data.legalConsents === "object"
      ? (data.legalConsents as Record<string, unknown>)
      : {};
  const normalizeConsentInput = (value: unknown, fallbackSource: string) => {
    const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    const version = typeof raw.version === "string" ? raw.version.trim() : "";
    const source =
      typeof raw.source === "string" && raw.source.trim().length > 0
        ? raw.source.trim()
        : fallbackSource;
    const channel =
      typeof raw.channel === "string" && raw.channel.trim().length > 0
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

  if (!role) {
    console.warn("[completeSignupWithInvite] invalid signup role", {
      uid,
      requestedRole: asTrimmedString(data?.role),
    });
    throw new functions.https.HttpsError("invalid-argument", "선택한 역할이 유효하지 않습니다.", {
      userMessage: "선택한 역할이 유효하지 않습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.",
    });
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
  if (!code) {
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
      let targetClassName: string | null = null;
      let inviteRef: admin.firestore.DocumentReference | null = null;
      let linkedStudentRef: admin.firestore.DocumentReference | null = null;
      let linkedStudentData: admin.firestore.DocumentData | null = null;
      let linkedStudentId = "";

      inviteRef = db.doc(`inviteCodes/${code}`);
      const inviteSnap = await t.get(inviteRef);
      if (!inviteSnap.exists) {
        throw new functions.https.HttpsError("failed-precondition", "Invalid invite code.", {
          userMessage: "유효하지 않은 초대 코드입니다.",
        });
      }

      const inviteData = inviteSnap.data() as InviteDoc;
      assertInviteUsable(inviteData, role);

      centerId = asTrimmedString(inviteData.centerId);
      targetClassName = inviteData.targetClassName || null;
      if (!centerId) {
        throw new functions.https.HttpsError("failed-precondition", "Invite code has no center information.", {
          userMessage: "초대 코드의 센터 정보가 올바르지 않습니다.",
        });
      }

      if (role === "parent") {
        if (!/^\d{6}$/.test(studentLinkCode)) {
          throw new functions.https.HttpsError("invalid-argument", "Student link code must be a 6-digit number.", {
            userMessage: "학생 코드는 6자리 숫자로 입력해주세요.",
          });
        }

        const lookupCandidate = await resolveParentLinkCandidateFromLookupInTransaction(db, t, studentLinkCode);
        if (lookupCandidate) {
          if (lookupCandidate.centerId !== centerId) {
            throw new functions.https.HttpsError("failed-precondition", "Invite center does not match linked student center.", {
              userMessage: "센터 초대 코드와 학생 코드의 센터가 일치하지 않습니다. 코드를 다시 확인해 주세요.",
            });
          }
          linkedStudentRef = lookupCandidate.studentRef;
          linkedStudentData = lookupCandidate.studentData;
          linkedStudentId = lookupCandidate.studentId;
          targetClassName = lookupCandidate.className || (linkedStudentData?.className as string | null) || targetClassName;
        } else {
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
              userMessage: "해당 학생 코드를 찾을 수 없습니다. 6자리 학생 코드를 다시 확인해 주세요.",
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
          const centerScopedStudentDocs = candidateStudentDocs.filter((studentDoc) => {
            const pathSegments = studentDoc.ref.path.split("/");
            return pathSegments[1] === centerId;
          });
          if (candidateStudentDocs.length > 0 && centerScopedStudentDocs.length === 0) {
            throw new functions.https.HttpsError("failed-precondition", "Invite center does not match linked student center.", {
              userMessage: "센터 초대 코드와 학생 코드의 센터가 일치하지 않습니다. 코드를 다시 확인해 주세요.",
            });
          }

          console.info("[completeSignupWithInvite] parent code lookup", {
            studentLinkCode,
            rawMatchedDocCount: studentDocMap.size,
            centerStudentDocCount: centerScopedStudentDocs.length,
          });

          for (const studentDoc of centerScopedStudentDocs) {
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
                "학생 코드는 확인됐지만 프로필 연결에 실패했습니다. 센터 관리자에게 학생 등록 상태를 확인해 주세요.",
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
          linkedStudentRef = selected.studentDoc.ref;
          linkedStudentData = selected.studentData;
          linkedStudentId = selected.studentDoc.id;
          targetClassName = selected.className || (linkedStudentData?.className as string | null) || targetClassName;
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
          ...extractLinkedIds(existingMembershipData?.linkedStudentIds),
        ...extractLinkedIds(existingCenterMemberData?.linkedStudentIds),
      ]));
      let linkedStudentIds: string[] = [];
      let effectiveParentPhone = parentPhoneNumber || normalizePhoneNumber(existingMembershipData?.phoneNumber || existingCenterMemberData?.phoneNumber || "");
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
            (existingMembershipData?.displayName as string | undefined) ||
            (existingCenterMemberData?.displayName as string | undefined) ||
            `${linkedStudentData?.name || "학생"} 학부모`;
        }

        const linkedStudentParentCode = normalizeParentLinkCodeValue(linkedStudentData?.parentLinkCode);
        if (linkedStudentParentCode === studentLinkCode) {
          await reserveParentLinkCodeLookupInTransaction({
            db,
            transaction: t,
            code: linkedStudentParentCode,
            centerId,
            studentId: linkedStudentId,
            studentName: asTrimmedString(linkedStudentData?.name || linkedStudentData?.displayName, "학생"),
            timestamp: ts,
          });
        }

        t.set(linkedStudentRef, {
          parentUids: admin.firestore.FieldValue.arrayUnion(uid),
          updatedAt: ts,
        }, { merge: true });
      }

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
      }

      const userDocData: any = {
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
      } else if (role === "student" && studentPhoneNumber) {
        userDocData.phoneNumber = studentPhoneNumber;
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
      if (role === "parent" && effectiveParentPhone) {
        memberData.phoneNumber = effectiveParentPhone;
      } else if (role === "student" && studentPhoneNumber) {
        memberData.phoneNumber = studentPhoneNumber;
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
      if (role === "parent" && effectiveParentPhone) {
        userCenterData.phoneNumber = effectiveParentPhone;
      } else if (role === "student" && studentPhoneNumber) {
        userCenterData.phoneNumber = studentPhoneNumber;
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
          className: targetClassName,
          phoneNumber: studentPhoneNumber || null,
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

        seedDefaultStudyRoomScheduleTemplateInTransaction({
          db,
          transaction: t,
          uid,
          centerId,
          className: memberData.className || targetClassName || null,
          timestamp: ts,
        });
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
      } catch (resetError: any) {
        console.warn("[completeSignupWithInvite] parent link rate limit reset failed", {
          uid,
          message: resetError?.message || resetError,
        });
      }
    }

    return result;
  } catch (e: any) {
    if (e instanceof functions.https.HttpsError) {
      if (isParentLinkFlow && shouldCountParentLinkFailedAttempt(e)) {
        try {
          const blockedUntil = await registerParentLinkFailedAttempt(db, uid);
          if (blockedUntil) {
            const remainingMinutes = getRemainingLockMinutes(blockedUntil.toDate());
            throw new functions.https.HttpsError(
              "resource-exhausted",
              "Parent link temporarily blocked due to repeated failures.",
              {
                userMessage: `학생코드 확인 시도가 반복되어 ${remainingMinutes}분 동안 잠겼습니다. 잠시 후 다시 시도해 주세요.`,
              }
            );
          }
        } catch (rateLimitError: any) {
          if (rateLimitError instanceof functions.https.HttpsError) {
            throw rateLimitError;
          }
          console.warn("[completeSignupWithInvite] parent link rate limit write failed", {
            uid,
            message: rateLimitError?.message || rateLimitError,
          });
        }
      }
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
        userMessage = toSafeUserMessage(
          normalizedFailedPreconditionMessage,
          "학생코드 확인에 실패했습니다. 코드가 올바른지 다시 확인해 주세요."
        );
      }

      throw new functions.https.HttpsError("failed-precondition", "Signup precondition failed.", {
        userMessage,
      });
    }

    if (hasInvalidArgument) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid signup input.", {
        userMessage: toSafeUserMessage(
          normalizedInvalidArgumentMessage,
          "입력값을 다시 확인해 주세요. 학생코드, 전화번호 등 필수값이 누락되었을 수 있습니다."
        ),
      });
    }

    if (hasAlreadyExists) {
      throw new functions.https.HttpsError("already-exists", "Signup target already exists.", {
        userMessage: toSafeUserMessage(
          normalizedAlreadyExistsMessage,
          "이미 연결된 계정입니다. 로그인 후 대시보드에서 확인해 주세요."
        ),
      });
    }

    throw new functions.https.HttpsError("internal", "Signup processing failed due to an internal error.", {
      userMessage: toSafeUserMessage(e, "회원가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."),
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

  const publicRef = db.doc(`centers/${centerId}/settings/notifications`);
  const privateRef = db.doc(`centers/${centerId}/settingsPrivate/notificationsSecret`);
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
      defaultArrivalTime: admin.firestore.FieldValue.delete(),
      smsApiKey: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: context.auth.uid,
  } as Record<string, unknown>;

  const rawApiKey = asTrimmedString(data?.smsApiKey);
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
  } else if (data?.clearSmsApiKey === true) {
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
  const retryPayload: Record<string, unknown> = {
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
  };

  const queueEventTypeRaw = String(queueData.eventType || "").trim();
  const queueMetadata = asRecord(queueData.metadata);
  if (isAttendanceSmsEventType(queueEventTypeRaw)) {
    const retryStudentId = asTrimmedString(queueData.studentId);
    if (retryStudentId) {
      const centerName = await loadCenterName(db, centerId);
      const smsEventType = normalizeSmsEventType(queueEventTypeRaw);
      const fallbackEventAt = toKstDateFromUnknownTimestamp(queueData.createdAt) || toKstDate();
      const smsEventAt = await resolveAttendanceSmsEventAt(db, {
        centerId,
        studentId: retryStudentId,
        eventType: smsEventType,
        fallbackEventAt,
        dateKeyOverride: asTrimmedString(queueData.dateKey),
      });
      const eventTimeLabel = toTimeLabel(smsEventAt);
      const expectedTime = asTrimmedString(queueMetadata?.expectedTime);
      const studentName = asTrimmedString(queueData.studentName || queueMetadata?.studentName, "학생");
      const message = buildParentSmsTemplateMessage(resolveTemplateByEvent(settings, smsEventType), {
        studentName,
        time: eventTimeLabel,
        expectedTime: expectedTime || "학생이 정한 시간",
        centerName,
      });
      retryPayload.message = message;
      retryPayload.renderedMessage = message;
      retryPayload.messageBytes = calculateSmsBytes(message);
      retryPayload.dateKey = isValidDateKey(asTrimmedString(queueData.dateKey))
        ? asTrimmedString(queueData.dateKey)
        : toStudyDayKey(smsEventAt);
      retryPayload.metadata = {
        studentName,
        centerName,
        eventTime: eventTimeLabel,
        expectedTime: expectedTime || null,
      };
    }
  } else {
    const queueEventType = String(queueData.eventType || "manual_note") as SmsQueueEventType;
    const message = trimSmsToByteLimit(
      normalizeTrackManagedSmsMessage(asTrimmedString(queueData.renderedMessage || queueData.message), {
        ensurePrefix: shouldEnsureTrackManagedSmsPrefix(queueEventType),
      })
    );
    if (message) {
      retryPayload.message = message;
      retryPayload.renderedMessage = message;
      retryPayload.messageBytes = calculateSmsBytes(message);
    }
  }

  await queueRef.set(retryPayload, { merge: true });

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
  const requestedParentUid = asTrimmedString(data?.parentUid);
  const isManualRecipientRequest = data?.isManualRecipient === true || requestedParentUid === MANUAL_PARENT_SMS_UID;
  const isFallbackRecipientRequest = data?.isFallbackRecipient === true || requestedParentUid === STUDENT_SMS_FALLBACK_UID;
  const shouldDeleteManualRecipient = data?.deleteManualRecipient === true;
  if (isFallbackRecipientRequest) {
    throw new functions.https.HttpsError("invalid-argument", "학생 본인 번호는 문자 수신 대상으로 사용할 수 없습니다.");
  }

  const parentUid = isManualRecipientRequest ? MANUAL_PARENT_SMS_UID : requestedParentUid;
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

  const studentData = studentSnap.data() || {};
  const studentName = asTrimmedString(studentData.name, "학생");
  const phoneNumberOverride = normalizePhoneNumber(data?.phoneNumberOverride || "");
  const enabled = data?.enabled !== false;
  const eventToggles = normalizeSmsEventToggles(data?.eventToggles);
  const parentNameOverride = asTrimmedString(data?.parentNameOverride);

  if (isManualRecipientRequest) {
    const prefRef = db.doc(`centers/${centerId}/smsRecipientPreferences/${buildSmsRecipientPreferenceId(studentId, parentUid)}`);

    if (shouldDeleteManualRecipient) {
      await prefRef.delete();
      return { ok: true, deleted: true };
    }

    const existingPrefSnap = await prefRef.get();
    const existingPrefData = existingPrefSnap.exists ? (existingPrefSnap.data() || {}) as SmsRecipientPreferenceDoc : null;
    const manualPhoneNumber = phoneNumberOverride || normalizePhoneNumber(existingPrefData?.phoneNumber || "");

    if (!manualPhoneNumber) {
      throw new functions.https.HttpsError("invalid-argument", "보호자 휴대폰 번호가 필요합니다.");
    }

    await prefRef.set({
      studentId,
      studentName,
      parentUid,
      parentName: parentNameOverride || existingPrefData?.parentName || "보호자",
      phoneNumber: manualPhoneNumber,
      enabled,
      eventToggles,
      isManualRecipient: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: context.auth.uid,
    }, { merge: true });

    return { ok: true };
  }

  const parentUids = normalizeStringArray(studentData.parentUids);
  if (!parentUids.includes(parentUid)) {
    throw new functions.https.HttpsError("failed-precondition", "해당 학생에 연결된 학부모가 아닙니다.");
  }

  const [userSnap, memberSnap] = await Promise.all([
    db.doc(`users/${parentUid}`).get(),
    db.doc(`centers/${centerId}/members/${parentUid}`).get(),
  ]);

  const parentName = asTrimmedString(memberSnap.data()?.displayName || userSnap.data()?.displayName || "학부모");
  const phoneNumber = normalizePhoneNumber(userSnap.data()?.phoneNumber || memberSnap.data()?.phoneNumber || phoneNumberOverride);

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

export const sendManualStudentSms = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = asTrimmedString(data?.centerId);
  const studentId = asTrimmedString(data?.studentId);
  const message = sanitizeSmsTemplate(asTrimmedString(data?.message));
  if (!centerId || !studentId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId와 studentId가 필요합니다.");
  }
  if (!message) {
    throw new functions.https.HttpsError("invalid-argument", "보낼 문자 내용이 필요합니다.");
  }
  if (calculateSmsBytes(message) > SMS_BYTE_LIMIT) {
    throw new functions.https.HttpsError("invalid-argument", "수동 문자 내용이 90byte를 넘었습니다.");
  }

  const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
  const callerRole = callerMemberSnap.exists ? callerMemberSnap.data()?.role : null;
  if (!isAdminRole(callerRole)) {
    throw new functions.https.HttpsError("permission-denied", "센터 관리자만 수동 문자를 발송할 수 있습니다.");
  }

  const studentSnap = await db.doc(`centers/${centerId}/students/${studentId}`).get();
  if (!studentSnap.exists) {
    throw new functions.https.HttpsError("not-found", "학생 정보를 찾을 수 없습니다.");
  }

  const studentName = asTrimmedString(studentSnap.data()?.name, "학생");
  const settings = await loadNotificationSettings(db, centerId);
  const queueResult = await queueCustomParentSmsNotification(db, {
    centerId,
    studentId,
    studentName,
    eventType: "manual_note",
    message,
    date: toKstDate(),
    settings,
    notificationTitle: "수동 문자",
    isImportant: true,
    metadata: {
      sentBy: context.auth.uid,
      source: "manual_console",
    },
  });

  if (queueResult.recipientCount === 0) {
    throw new functions.https.HttpsError("failed-precondition", "등록된 수신 대상 번호가 없습니다.");
  }

  return {
    ok: true,
    queuedCount: queueResult.queuedCount,
    recipientCount: queueResult.recipientCount,
    provider: settings.smsProvider || "none",
    message: queueResult.message,
  };
});

export const scheduledSmsQueueDispatcher = smsDispatcherFunctions
  .pubsub.schedule("every 1 minutes")
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    const todayKey = toStudyDayKey(toKstDate(now));
    const repairWindowStartMs = toKstDate(new Date(now.getTime() - 2 * 60 * 60 * 1000)).getTime();
    const nowTs = admin.firestore.Timestamp.fromDate(now);
    const processingLeaseUntil = admin.firestore.Timestamp.fromDate(new Date(now.getTime() + 60 * 1000));
    let repairedQueuedCount = 0;
    let repairedSuppressedCount = 0;
    let repairedSkippedCount = 0;
    let centerDocs: admin.firestore.QueryDocumentSnapshot[] = [];
    try {
      const centersSnap = await db.collection("centers").get();
      centerDocs = centersSnap.docs;
      for (const centerDoc of centersSnap.docs) {
        const repairResult = await repairRecentAttendanceSmsQueueForCenter(db, centerDoc.id, todayKey, repairWindowStartMs);
        repairedQueuedCount += repairResult.queuedCount;
        repairedSuppressedCount += repairResult.suppressedCount;
        repairedSkippedCount += repairResult.skippedCount;
      }
    } catch (error: any) {
      console.error("[sms-dispatcher] attendance repair failed", {
        message: error?.message || String(error),
      });
    }

    if (centerDocs.length === 0) {
      try {
        centerDocs = (await db.collection("centers").get()).docs;
      } catch (error: any) {
        console.error("[sms-dispatcher] center query failed", {
          message: error?.message || String(error),
        });
        return null;
      }
    }

    const queuedDocs: admin.firestore.QueryDocumentSnapshot[] = [];
    const processingDocs: admin.firestore.QueryDocumentSnapshot[] = [];
    try {
      for (const centerDoc of centerDocs) {
        const queuedLimit = Math.max(0, 120 - queuedDocs.length);
        const processingLimit = Math.max(0, 120 - processingDocs.length);
        if (queuedLimit === 0 && processingLimit === 0) break;

        const [queuedSnap, processingSnap] = await Promise.all([
          queuedLimit > 0
            ? centerDoc.ref.collection("smsQueue").where("status", "==", "queued").limit(queuedLimit).get()
            : Promise.resolve(null),
          processingLimit > 0
            ? centerDoc.ref.collection("smsQueue").where("status", "==", "processing").limit(processingLimit).get()
            : Promise.resolve(null),
        ]);
        if (queuedSnap) queuedDocs.push(...queuedSnap.docs);
        if (processingSnap) processingDocs.push(...processingSnap.docs);
      }
    } catch (error: any) {
      console.error("[sms-dispatcher] queue query failed", {
        message: error?.message || String(error),
      });
      return null;
    }

    let processed = 0;
    const touchedCenterIds = new Set<string>();
    const candidateDocs = [...queuedDocs, ...processingDocs];

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

        const centerId =
          asTrimmedString(freshData.centerId) ||
          asTrimmedString(queueDoc.ref.parent.parent?.id);
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

        return {
          ...freshData,
          id: queueDoc.id,
          centerId,
          attemptCount: nextAttemptCount,
        };
      });

      if (!claimed) continue;

      touchedCenterIds.add(String(claimed.centerId));
      await dispatchSmsQueueItem(
        db,
        String(claimed.centerId),
        queueDoc.ref,
        claimed,
        Number(claimed.attemptCount || 1)
      );
      processed += 1;
    }

    console.log("[sms-dispatcher] run complete", {
      queuedCandidates: queuedDocs.length,
      processingCandidates: processingDocs.length,
      touchedCenterCount: touchedCenterIds.size,
      processed,
      repairedQueuedCount,
      repairedSuppressedCount,
      repairedSkippedCount,
    });
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

  const nowKst = toKstDate();
  const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
  const callerRole = callerMemberSnap.exists ? callerMemberSnap.data()?.role : null;
  const isTeacherOrAdminCaller = callerRole === "teacher" || isAdminRole(callerRole);
  const forceResend = data?.force === true && isTeacherOrAdminCaller;
  const requestedEventAt = isTeacherOrAdminCaller ? toKstDateFromUnknownTimestamp(data?.eventAt) : null;
  const requestedDateKey = isTeacherOrAdminCaller ? asTrimmedString(data?.dateKey) : "";
  const callerIdentity = callerRole === "student"
    ? await resolveCenterStudentIdentity(db, centerId, context.auth.uid)
    : null;
  const effectiveStudentId = callerRole === "student"
    ? (callerIdentity?.studentId || context.auth.uid)
    : studentId;
  const isStudentSelfCaller = callerRole === "student"
    && (studentId === effectiveStudentId || studentId === context.auth.uid);
  if (!isTeacherOrAdminCaller && !isStudentSelfCaller) {
    throw new functions.https.HttpsError("permission-denied", "Only authorized members can send notifications.");
  }

  if (isStudentSelfCaller && !(["study_start", "study_end", "check_in", "check_out"] as AttendanceSmsEventType[]).includes(eventType)) {
    throw new functions.https.HttpsError("permission-denied", "Students can only notify study start/end events.");
  }

  const studentSnap = await db.doc(`centers/${centerId}/students/${effectiveStudentId}`).get();
  if (!studentSnap.exists) {
    throw new functions.https.HttpsError("failed-precondition", "Student not found.", {
      userMessage: "학생 정보를 찾을 수 없습니다.",
    });
  }

  const studentNameRaw = studentSnap.data()?.name;
  const studentName = typeof studentNameRaw === "string" && studentNameRaw.trim() ? studentNameRaw.trim() : "학생";
  if (isStudentSelfCaller) {
    const todayKey = toStudyDayKey(nowKst);
    const [todayStatSnap, attendanceSnap] = await Promise.all([
      db.doc(`centers/${centerId}/dailyStudentStats/${todayKey}/students/${effectiveStudentId}`).get(),
      db.collection(`centers/${centerId}/attendanceCurrent`).where("studentId", "==", effectiveStudentId).limit(3).get(),
    ]);
    const hasAttendanceTrace = attendanceSnap.docs.some((docSnap) => {
      const status = String(docSnap.data()?.status || "");
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
    studentId: effectiveStudentId,
    studentName,
    eventType,
    eventAt: requestedEventAt || nowKst,
    settings,
    force: forceResend,
    dateKeyOverride: requestedDateKey || null,
    useExactEventAt: !!requestedEventAt,
  });

  return {
    ok: true,
    queuedCount: queueResult.queuedCount,
    recipientCount: queueResult.recipientCount,
    provider: settings.smsProvider || "none",
      message: queueResult.message,
    };
  });

export const notifyDailyReportReady = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = asTrimmedString(data?.centerId);
  const studentId = asTrimmedString(data?.studentId);
  const dateKey = asTrimmedString(data?.dateKey, toDateKey(toKstDate()));
  if (!centerId || !studentId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId와 studentId가 필요합니다.");
  }

  const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
  const callerRole = callerMemberSnap.exists ? callerMemberSnap.data()?.role : null;
  const canNotify = callerRole === "teacher" || isAdminRole(callerRole);
  if (!canNotify) {
    throw new functions.https.HttpsError("permission-denied", "교사 또는 관리자만 리포트 알림을 보낼 수 있습니다.");
  }

  return {
    ok: true,
    queuedCount: 0,
    recipientCount: 0,
    skipped: true,
    reason: "daily_report_sms_disabled",
    dateKey,
    studentId,
  };
});

export const sendPaymentReminderBatch = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = asTrimmedString(data?.centerId);
  if (!centerId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId가 필요합니다.");
  }

  const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
  const callerRole = callerMemberSnap.exists ? callerMemberSnap.data()?.role : null;
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
    if (!studentId) continue;

    const dueDate =
      toTimestampDate(invoiceData.cycleEndDate) ||
      toTimestampDate(invoiceData.dueDate) ||
      null;
    if (!dueDate) continue;

    const dueKst = toKstDate(dueDate);
    const dueStart = new Date(dueKst.getFullYear(), dueKst.getMonth(), dueKst.getDate());
    const daysLeft = Math.round((dueStart.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000));
    if (daysLeft !== 3) continue;
    if (asTrimmedString(invoiceData.lastPaymentReminderSentDateKey) === todayKey) continue;

    candidateCount += 1;
    const studentName = asTrimmedString(invoiceData.studentName, "학생");
    const dueDateLabel = toDateKey(dueKst);
    const queueResult = await queueCustomParentSmsNotification(db, {
      centerId,
      studentId,
      studentName,
      eventType: "payment_reminder",
      message: `[${TRACK_MANAGED_STUDY_CENTER_NAME}] 안녕하세요 학부모님, ${studentName} 학생의 이번 달 수강료 결제일이 3일 남았습니다. (기한: ${dueDateLabel})`,
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
      await invoiceDoc.ref.set(
        {
          lastPaymentReminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
          lastPaymentReminderSentDateKey: todayKey,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  }

  return {
    ok: true,
    queuedCount,
    candidateCount,
    provider: settings.smsProvider || "none",
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
 * 센터별로 활동 중인 좌석을 읽어 지각 알림만 처리합니다.
 * 학생 퇴실은 키오스크/관리자/학생 직접 액션으로만 처리합니다.
 */
export const scheduledAttendanceCheck = functions
  .region(region)
  .pubsub.schedule("every 10 minutes")
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    const db = admin.firestore();
    const nowKst = toKstDate();

    const centersSnap = await db.collection("centers").get();
    let totalLateAlerts = 0;
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
    }

    console.log("[attendance-check] run complete", {
      centerCount: centersSnap.size,
      totalActiveSeatsScanned,
      totalLateAlerts,
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
    const deleteOldDocsByCollectionGroup = async (
      collectionId: string,
      cutoff: admin.firestore.Timestamp,
      batchSize = 500
    ): Promise<number> => {
      let deleted = 0;

      while (true) {
        const snap = await db
          .collectionGroup(collectionId)
          .where("createdAt", "<", cutoff)
          .limit(batchSize)
          .get();
        if (snap.empty) break;

        const batch = db.batch();
        snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
        deleted += snap.size;

        if (snap.size < batchSize) break;
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

      const activeStudentIds = membersSnap.docs.map((memberDoc) => memberDoc.id);
      if (activeStudentIds.length === 0) continue;

      const [studentProfileMap, weeklyMinutesByStudent] = await Promise.all([
        loadStudentProfileMap(db, centerId, activeStudentIds),
        loadStudyMinutesByStudentForDateKeys(db, centerId, dateKeys),
      ]);

      for (const studentId of activeStudentIds) {
        const weeklyMinutes = weeklyMinutesByStudent.get(studentId) || 0;
        const studentData = studentProfileMap.get(studentId) || null;
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
            dateKey: toStudyDayKey(nowKst),
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

async function syncStudyLogDayTotalMinutes(
  db: admin.firestore.Firestore,
  centerId: string,
  studentId: string,
  dateKey: string
): Promise<void> {
  const sessionsSnap = await db.collection(`centers/${centerId}/studyLogs/${studentId}/days/${dateKey}/sessions`).get();
  const sessionRows = sessionsSnap.docs
    .map((docSnap) => {
      const data = (docSnap.data() || {}) as Record<string, unknown>;
      return {
        startMs: toMillisSafe(data.startTime),
        endMs: toMillisSafe(data.endTime),
        minutes: getStudySessionDurationMinutesFromData(data),
      };
    })
    .filter((session) => session.startMs > 0 && session.minutes > 0)
    .sort((left, right) => left.startMs - right.startMs);
  const sessionTotalMinutes = Math.max(0, Math.round(sessionRows.reduce((sum, session) => sum + session.minutes, 0)));
  const firstSessionStartMs = sessionRows.map((session) => session.startMs).filter((value) => value > 0)[0] ?? 0;
  const lastSessionEndMs = sessionRows
    .map((session) => session.endMs)
    .filter((value) => value > 0)
    .sort((left, right) => right - left)[0] ?? 0;
  const longestSessionMinutes = sessionRows.reduce((max, session) => Math.max(max, session.minutes), 0);
  const awayMinutes = sessionRows.reduce((sum, session, index) => {
    const nextSession = sessionRows[index + 1];
    if (!nextSession || session.endMs <= 0 || nextSession.startMs <= session.endMs) return sum;
    return sum + Math.max(0, Math.round((nextSession.startMs - session.endMs) / MINUTE_MS));
  }, 0);
  const dayRef = db.doc(`centers/${centerId}/studyLogs/${studentId}/days/${dateKey}`);
  const statRef = db.doc(`centers/${centerId}/dailyStudentStats/${dateKey}/students/${studentId}`);

  await db.runTransaction(async (transaction) => {
    const [daySnap, statSnap] = await Promise.all([
      transaction.get(dayRef),
      transaction.get(statRef),
    ]);
    const dayData = (daySnap.data() || {}) as Record<string, unknown>;
    const statData = (statSnap.data() || {}) as Record<string, unknown>;
    const dayManualAdjustment = Math.round(parseFiniteNumber(dayData.manualAdjustmentMinutes) ?? 0);
    const statManualAdjustment = Math.round(parseFiniteNumber(statData.manualAdjustmentMinutes) ?? 0);
    const hasManualCorrection = Boolean(dayData.correctedAt || dayData.correctedByUserId);
    const manualAdjustmentMinutes = hasManualCorrection
      ? (dayManualAdjustment !== 0 ? dayManualAdjustment : statManualAdjustment)
      : 0;
    const hasManualSessionCorrection = dayData.manualSessionCorrection === true;
    const storedTotalMinutes = Math.max(
      getStoredStudyTotalMinutes(dayData, ["totalMinutes", "totalStudyMinutes"]),
      getStoredStudyTotalMinutes(statData, ["totalStudyMinutes", "totalMinutes"])
    );
    const legacyCarryoverMinutes = hasManualSessionCorrection
      ? 0
      : getLegacyStudyCarryoverMinutes(storedTotalMinutes, sessionTotalMinutes);
    const effectiveTotalMinutes = sessionTotalMinutes + legacyCarryoverMinutes;
    const previousFirstSessionMs = legacyCarryoverMinutes > 0 ? toMillisSafe(dayData.firstSessionStartAt) : 0;
    const previousLastSessionMs = legacyCarryoverMinutes > 0 ? toMillisSafe(dayData.lastSessionEndAt) : 0;
    const preservedFirstSessionStartMs = [previousFirstSessionMs, firstSessionStartMs]
      .filter((value) => value > 0)
      .sort((left, right) => left - right)[0] ?? 0;
    const preservedLastSessionEndMs = [previousLastSessionMs, lastSessionEndMs]
      .filter((value) => value > 0)
      .sort((left, right) => right - left)[0] ?? 0;

    transaction.set(
      dayRef,
      {
        studentId,
        centerId,
        dateKey,
        totalMinutes: effectiveTotalMinutes,
        manualAdjustmentMinutes,
        sessionCount: sessionRows.length,
        longestSessionMinutes,
        awayMinutes: awayMinutes > 0 ? awayMinutes : admin.firestore.FieldValue.delete(),
        legacyCarryoverMinutes: legacyCarryoverMinutes > 0 ? legacyCarryoverMinutes : admin.firestore.FieldValue.delete(),
        firstSessionStartAt: preservedFirstSessionStartMs > 0
          ? admin.firestore.Timestamp.fromMillis(preservedFirstSessionStartMs)
          : admin.firestore.FieldValue.delete(),
        lastSessionEndAt: preservedLastSessionEndMs > 0
          ? admin.firestore.Timestamp.fromMillis(preservedLastSessionEndMs)
          : admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(
      statRef,
      {
        studentId,
        centerId,
        dateKey,
        totalStudyMinutes: effectiveTotalMinutes,
        manualAdjustmentMinutes,
        sessionCount: sessionRows.length,
        longestSessionMinutes,
        awayMinutes: awayMinutes > 0 ? awayMinutes : admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  await syncMonthlyStudyTimeLeaderboardEntry(db, centerId, studentId, dateKey);
}

function buildMonthDateKeys(monthKey: string): string[] {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return [];
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const firstDay = new Date(year, monthIndex, 1);
  if (firstDay.getFullYear() !== year || firstDay.getMonth() !== monthIndex) return [];

  const keys: string[] = [];
  const cursor = new Date(firstDay);
  while (cursor.getMonth() === monthIndex) {
    keys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

async function syncMonthlyStudyTimeLeaderboardEntry(
  db: admin.firestore.Firestore,
  centerId: string,
  studentId: string,
  dateKey: string
): Promise<void> {
  const monthKey = dateKey.slice(0, 7);
  const dateKeys = buildMonthDateKeys(monthKey);
  if (dateKeys.length === 0) return;

  const statRefs = dateKeys.map((dayKey) => db.doc(`centers/${centerId}/dailyStudentStats/${dayKey}/students/${studentId}`));
  const [studentSnap, ...statSnaps] = await db.getAll(
    db.doc(`centers/${centerId}/students/${studentId}`),
    ...statRefs
  );
  const totalMinutes = statSnaps.reduce((sum, statSnap) => {
    return sum + getStoredStudyTotalMinutes((statSnap.data() || {}) as Record<string, unknown>, ["totalStudyMinutes", "totalMinutes"]);
  }, 0);
  const leaderboardRef = db.doc(`centers/${centerId}/leaderboards/${monthKey}_study-time/entries/${studentId}`);

  if (totalMinutes <= 0) {
    await leaderboardRef.delete();
    return;
  }

  const studentData = (studentSnap.data() || {}) as Record<string, unknown>;
  await leaderboardRef.set({
    studentId,
    displayNameSnapshot:
      typeof studentData.name === "string" && studentData.name.trim().length > 0
        ? studentData.name.trim()
        : typeof studentData.displayName === "string" && studentData.displayName.trim().length > 0
          ? studentData.displayName.trim()
          : "학생",
    classNameSnapshot:
      typeof studentData.className === "string" && studentData.className.trim().length > 0
        ? studentData.className.trim()
        : null,
    schoolNameSnapshot:
      typeof studentData.schoolName === "string" && studentData.schoolName.trim().length > 0
        ? studentData.schoolName.trim()
        : null,
    value: Math.max(0, Math.round(totalMinutes)),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

/**
 * 세션 문서 생성 시 durationMinutes 유효성 검증 및 서버 집계 보정
 * - 0분 이하 또는 360분 초과 세션은 경계값으로 클램프
 * - study-time leaderboard / dailyStudentStats는 세션 생성만 신뢰해 서버에서 누적
 * - closedReason이 있는 자동 종료 세션도 집계 대상에 포함
 */
export const onSessionCreated = functions
  .region(region)
  .firestore.document("centers/{centerId}/studyLogs/{studentId}/days/{dateKey}/sessions/{sessionId}")
  .onCreate(async (snap, context) => {
    const data = snap.data() as Record<string, any>;
    const { centerId, studentId, dateKey } = context.params;
    const db = admin.firestore();
    const skipValidation = Boolean(data.closedReason);
    const rawDuration = Number(data.durationMinutes ?? 0);
    const MAX_MINUTES = 360;

    let normalizedDuration = Number.isFinite(rawDuration) ? Math.max(0, Math.round(rawDuration)) : 0;
    let validationFlag: "clamped_negative" | "clamped_max" | null = null;

    if (!skipValidation) {
      if (!Number.isFinite(rawDuration) || rawDuration < 0) {
        validationFlag = "clamped_negative";
        normalizedDuration = 0;
      } else if (rawDuration > MAX_MINUTES) {
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

      const studentData = (studentSnap.data() || {}) as Record<string, unknown>;
      const statData = (statSnap.data() || {}) as Record<string, unknown>;
      const currentLongestSessionMinutes = Math.max(0, Number(statData.longestSessionMinutes || 0));

      t.set(statRef, {
        sessionCount: admin.firestore.FieldValue.increment(1),
        longestSessionMinutes: Math.max(normalizedDuration, currentLongestSessionMinutes),
        studentId,
        centerId,
        dateKey,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      t.set(leaderboardRef, {
        studentId,
        displayNameSnapshot:
          typeof studentData.name === "string" && studentData.name.trim().length > 0
            ? studentData.name.trim()
            : typeof studentData.displayName === "string" && studentData.displayName.trim().length > 0
              ? studentData.displayName.trim()
              : "학생",
        classNameSnapshot:
          typeof studentData.className === "string" && studentData.className.trim().length > 0
            ? studentData.className.trim()
            : null,
        schoolNameSnapshot:
          typeof studentData.schoolName === "string" && studentData.schoolName.trim().length > 0
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

    await syncStudyLogDayTotalMinutes(db, centerId, studentId, dateKey);

    return null;
  });

export const onSessionWritten = functions
  .region(region)
  .firestore.document("centers/{centerId}/studyLogs/{studentId}/days/{dateKey}/sessions/{sessionId}")
  .onWrite(async (change, context) => {
    const { centerId, studentId, dateKey, sessionId } = context.params;
    const db = admin.firestore();

    if (change.before.exists && !change.after.exists) {
      const beforeData = (change.before.data() || {}) as Record<string, unknown>;
      const beforeMinutes = getStudySessionDurationMinutesFromData(beforeData);
      const deletionAllowed = await hasStudySessionDeletionAllowance({ db, centerId, studentId, sessionId });
      if (beforeMinutes > 0 && !deletionAllowed) {
        await archiveProtectedStudySessionMutation({
          db,
          centerId,
          studentId,
          dateKey,
          sessionId,
          reason: "deleted_session_restored",
          beforeData,
        });
        await change.after.ref.set({
          ...beforeData,
          restoredFromAccidentalDelete: true,
          restoredAt: admin.firestore.FieldValue.serverTimestamp(),
          restoreReason: "prevent_study_time_loss",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return null;
      }
    }

    if (change.before.exists && change.after.exists) {
      const beforeData = (change.before.data() || {}) as Record<string, unknown>;
      const afterData = (change.after.data() || {}) as Record<string, unknown>;
      const beforeMinutes = getStudySessionDurationMinutesFromData(beforeData);
      const afterMinutes = getStudySessionDurationMinutesFromData(afterData);
      const shrinkAllowed = afterData.allowSessionShrink === true || afterData.manualSessionCorrection === true;
      if (beforeMinutes > 0 && afterMinutes + 1 < beforeMinutes && !shrinkAllowed) {
        await archiveProtectedStudySessionMutation({
          db,
          centerId,
          studentId,
          dateKey,
          sessionId,
          reason: "shrunk_session_restored",
          beforeData,
          afterData,
        });
        await change.after.ref.set({
          startTime: beforeData.startTime ?? admin.firestore.FieldValue.delete(),
          endTime: beforeData.endTime ?? admin.firestore.FieldValue.delete(),
          durationMinutes: beforeData.durationMinutes ?? admin.firestore.FieldValue.delete(),
          durationSeconds: beforeData.durationSeconds ?? admin.firestore.FieldValue.delete(),
          sessionRestoredFromShrink: true,
          sessionRestoredAt: admin.firestore.FieldValue.serverTimestamp(),
          restoreReason: "prevent_study_time_loss",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return null;
      }
    }

    await syncStudyLogDayTotalMinutes(db, centerId, studentId, dateKey);
    return null;
  });

async function resolveAttendanceSeatDocForTransition(params: {
  db: admin.firestore.Firestore;
  centerId: string;
  studentId: string;
  seatId?: string | null;
}): Promise<admin.firestore.QueryDocumentSnapshot | admin.firestore.DocumentSnapshot | null> {
  const { db, centerId, studentId } = params;
  const seatId = asTrimmedString(params.seatId);

  if (seatId) {
    const directSnap = await db.doc(`centers/${centerId}/attendanceCurrent/${seatId}`).get();
    const seatSnap = await db
      .collection(`centers/${centerId}/attendanceCurrent`)
      .where("studentId", "==", studentId)
      .limit(10)
      .get();
    const existingStudentSeatDoc = pickPreferredAttendanceSeatDoc(seatSnap.docs);

    if (existingStudentSeatDoc) {
      const directData = directSnap.exists ? (directSnap.data() as Record<string, unknown>) : {};
      const directStudentId = asTrimmedString(directData.studentId);
      const directStatus = normalizeAttendanceSeatStatus(directData.status);
      const preferredStatus = normalizeAttendanceSeatStatus(existingStudentSeatDoc.data().status);
      const directMatchesStudent = directSnap.exists && directStudentId === studentId;
      const directIsPreferred = directSnap.exists && existingStudentSeatDoc.id === directSnap.id;
      const directIsEmptyTarget = directSnap.exists && !directStudentId;
      const shouldUseExistingStudentSeat =
        directIsPreferred ||
        !directSnap.exists ||
        !directMatchesStudent ||
        getAttendanceActivityRank(preferredStatus) <= getAttendanceActivityRank(directStatus);

      if (shouldUseExistingStudentSeat && !directIsEmptyTarget) {
        return existingStudentSeatDoc;
      }
    }

    if (directSnap.exists) {
      const directData = directSnap.data() as Record<string, unknown>;
      const directStudentId = asTrimmedString(directData.studentId);
      if (!directStudentId || directStudentId === studentId) {
        return directSnap;
      }
    }

    if (!directSnap.exists) {
      return directSnap;
    }

    return null;
  }

  const seatSnap = await db
    .collection(`centers/${centerId}/attendanceCurrent`)
    .where("studentId", "==", studentId)
    .limit(10)
    .get();
  return pickPreferredAttendanceSeatDoc(seatSnap.docs);
}

function resolveAttendanceTransitionEventType(
  prevStatus: AttendanceSeatStatus,
  nextStatus: AttendanceSeatStatus
): "check_in" | "away_start" | "away_end" | "check_out" | null {
  if (prevStatus === nextStatus) return null;
  if (prevStatus === "absent" && nextStatus === "studying") return "check_in";
  if ((prevStatus === "away" || prevStatus === "break") && nextStatus === "studying") return "away_end";
  if ((nextStatus === "away" || nextStatus === "break") && prevStatus !== "away" && prevStatus !== "break") return "away_start";
  if (nextStatus === "absent" && prevStatus !== "absent") return "check_out";
  return null;
}

function resolveExplicitAttendanceEventType(
  prevStatus: AttendanceSeatStatus,
  nextStatus: AttendanceSeatStatus
): "check_in" | "away_start" | "away_end" | "check_out" {
  if (nextStatus === "studying") {
    return prevStatus === "away" || prevStatus === "break" ? "away_end" : "check_in";
  }
  if (nextStatus === "away" || nextStatus === "break") {
    return "away_start";
  }
  return "check_out";
}

function buildAttendanceSeatPatch(params: {
  studentId: string;
  nextStatus: AttendanceSeatStatus;
  seatData: Record<string, unknown>;
  seatHint?: AttendanceSeatHint | null;
  nowTs: admin.firestore.Timestamp;
  activeStudyDayKey?: string | null;
  activeStudyStartedAtMs?: number | null;
}): Record<string, unknown> {
  const seatNo = Math.max(
    0,
    Math.round(
      parseFiniteNumber(params.seatData.seatNo) ??
      parseFiniteNumber(params.seatHint?.seatNo) ??
      0
    )
  );
  const roomId = asTrimmedString(params.seatData.roomId) || asTrimmedString(params.seatHint?.roomId) || null;
  const roomSeatNo = Math.max(
    0,
    Math.round(
      parseFiniteNumber(params.seatData.roomSeatNo) ??
      parseFiniteNumber(params.seatHint?.roomSeatNo) ??
      0
    )
  );
  const patch: Record<string, unknown> = {
    studentId: params.studentId,
    status: params.nextStatus,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (seatNo > 0) patch.seatNo = seatNo;
  if (roomId) patch.roomId = roomId;
  if (roomSeatNo > 0) patch.roomSeatNo = roomSeatNo;
  patch.type = asTrimmedString(params.seatData.type) || "seat";
  const seatZone = asTrimmedString(params.seatData.seatZone);
  if (seatZone) patch.seatZone = seatZone;
  const seatLabel = asTrimmedString(params.seatData.seatLabel);
  if (seatLabel) patch.seatLabel = seatLabel;

  if (params.nextStatus === "studying") {
    patch.lastCheckInAt = params.nowTs;
  } else {
    patch.lastCheckInAt = admin.firestore.FieldValue.delete();
  }

  if (params.nextStatus === "absent") {
    patch.activeStudyDayKey = admin.firestore.FieldValue.delete();
    patch.activeStudyStartedAt = admin.firestore.FieldValue.delete();
  } else {
    const activeStudyDayKey = asTrimmedString(params.activeStudyDayKey);
    const activeStudyStartedAtMs = Math.max(0, Math.floor(params.activeStudyStartedAtMs ?? 0));
    patch.activeStudyDayKey = isValidDateKey(activeStudyDayKey)
      ? activeStudyDayKey
      : toStudyDayKey(params.nowTs.toDate());
    patch.activeStudyStartedAt = activeStudyStartedAtMs > 0
      ? admin.firestore.Timestamp.fromMillis(activeStudyStartedAtMs)
      : params.nowTs;
  }

  return patch;
}

async function resolveActiveAttendanceFlowContext(params: {
  db: admin.firestore.Firestore;
  centerId: string;
  studentId: string;
  currentDateKey: string;
  nowMs: number;
  seatData: Record<string, unknown>;
}): Promise<{ dateKey: string; startedAtMs: number }> {
  const fieldDateKey = asTrimmedString(params.seatData.activeStudyDayKey);
  const fieldStartedAtMs = toMillisSafe(params.seatData.activeStudyStartedAt);
  const seatStartedAtMs = fieldStartedAtMs || toMillisSafe(params.seatData.lastCheckInAt);
  if (isValidDateKey(fieldDateKey)) {
    return { dateKey: fieldDateKey, startedAtMs: seatStartedAtMs };
  }

  if (seatStartedAtMs > 0 && seatStartedAtMs < params.nowMs + MINUTE_MS) {
    return { dateKey: toStudyDayKey(new Date(seatStartedAtMs)), startedAtMs: seatStartedAtMs };
  }

  const evidenceDateKeys = Array.from(new Set([params.currentDateKey, getPreviousDateKey(params.currentDateKey)]));
  const eventSnaps = await Promise.all(
    evidenceDateKeys.map((dateKey) =>
      params.db
        .collection(`centers/${params.centerId}/attendanceEvents`)
        .where("studentId", "==", params.studentId)
        .where("dateKey", "==", dateKey)
        .limit(160)
        .get()
    )
  );

  let activeFlowStartMs = 0;
  eventSnaps
    .flatMap((snap) => snap.docs)
    .map((docSnap) => {
      const data = (docSnap.data() || {}) as Record<string, unknown>;
      return {
        eventType: asTrimmedString(data.eventType),
        occurredAtMs: toMillisSafe(data.occurredAt) || toMillisSafe(data.createdAt),
      };
    })
    .filter((event) => event.occurredAtMs > 0 && event.occurredAtMs < params.nowMs + MINUTE_MS)
    .sort((left, right) => left.occurredAtMs - right.occurredAtMs)
    .forEach((event) => {
      if (event.eventType === "check_in" && event.occurredAtMs > 0) {
        activeFlowStartMs = event.occurredAtMs;
        return;
      }
      if (event.eventType === "check_out") {
        activeFlowStartMs = 0;
      }
    });

  if (activeFlowStartMs > 0) {
    return { dateKey: toStudyDayKey(new Date(activeFlowStartMs)), startedAtMs: activeFlowStartMs };
  }

  const statSnaps = await Promise.all(
    evidenceDateKeys.map((dateKey) =>
      params.db.doc(`centers/${params.centerId}/attendanceDailyStats/${dateKey}/students/${params.studentId}`).get()
    )
  );
  let statCheckInMs = 0;
  statSnaps.forEach((statSnap) => {
    const statData = statSnap.exists ? ((statSnap.data() || {}) as Record<string, unknown>) : {};
    const checkInMs = toMillisSafe(statData.checkInAt);
    const checkOutMs = toMillisSafe(statData.checkOutAt);
    if (checkInMs > 0 && checkInMs < params.nowMs + MINUTE_MS && checkInMs > statCheckInMs && (!checkOutMs || checkOutMs < checkInMs)) {
      statCheckInMs = checkInMs;
    }
  });

  if (statCheckInMs > 0) {
    return { dateKey: toStudyDayKey(new Date(statCheckInMs)), startedAtMs: statCheckInMs };
  }

  return { dateKey: params.currentDateKey, startedAtMs: 0 };
}

async function resolveOpenStudyStartMsFromAttendanceEvidence(params: {
  db: admin.firestore.Firestore;
  centerId: string;
  studentId: string;
  dateKey: string;
  nowMs: number;
  seatData: Record<string, unknown>;
}): Promise<number> {
  const seatStartMs = toMillisSafe(params.seatData.lastCheckInAt);
  if (seatStartMs > 0 && seatStartMs < params.nowMs) {
    return seatStartMs;
  }

  const bounds = getStudyDayWindowBounds(params.dateKey);
  const previousDate = new Date(`${params.dateKey}T00:00:00+09:00`);
  previousDate.setDate(previousDate.getDate() - 1);
  const previousDateKey = toDateKey(previousDate);
  const evidenceDateKeys = Array.from(new Set([params.dateKey, previousDateKey]));
  const eventsSnaps = await Promise.all(
    evidenceDateKeys.map((dateKey) =>
      params.db
        .collection(`centers/${params.centerId}/attendanceEvents`)
        .where("studentId", "==", params.studentId)
        .where("dateKey", "==", dateKey)
        .limit(120)
        .get()
    )
  );

  let openStartMs: number | null = null;
  eventsSnaps
    .flatMap((snap) => snap.docs)
    .map((docSnap) => {
      const data = (docSnap.data() || {}) as Record<string, unknown>;
      return {
        eventType: asTrimmedString(data.eventType),
        occurredAtMs: toMillisSafe(data.occurredAt) || toMillisSafe(data.createdAt),
      };
    })
    .filter((event) => event.occurredAtMs > 0 && event.occurredAtMs < params.nowMs)
    .sort((left, right) => left.occurredAtMs - right.occurredAtMs)
    .forEach((event) => {
      if (event.eventType === "check_in" || event.eventType === "away_end") {
        openStartMs = event.occurredAtMs;
        return;
      }
      if (event.eventType === "away_start" || event.eventType === "check_out") {
        openStartMs = null;
      }
    });

  if (openStartMs !== null && openStartMs > 0 && openStartMs < params.nowMs) {
    return Math.max(bounds.startMs, openStartMs);
  }

  const [statSnaps, daySnaps] = await Promise.all([
    Promise.all(
      evidenceDateKeys.map((dateKey) =>
        params.db.doc(`centers/${params.centerId}/attendanceDailyStats/${dateKey}/students/${params.studentId}`).get()
      )
    ),
    Promise.all(
      evidenceDateKeys.map((dateKey) =>
        params.db.doc(`centers/${params.centerId}/studyLogs/${params.studentId}/days/${dateKey}`).get()
      )
    ),
  ]);
  let statCheckInMs = 0;
  statSnaps.forEach((statSnap) => {
    const statData = statSnap.exists ? ((statSnap.data() || {}) as Record<string, unknown>) : {};
    const candidateMs = toMillisSafe(statData.checkInAt);
    if (candidateMs > 0 && candidateMs < params.nowMs && candidateMs > statCheckInMs) {
      statCheckInMs = candidateMs;
    }
  });
  const lastSessionEndMs = Math.max(
    0,
    ...daySnaps.map((daySnap) => {
      const dayData = daySnap.exists ? ((daySnap.data() || {}) as Record<string, unknown>) : {};
      return toMillisSafe(dayData.lastSessionEndAt);
    })
  );
  if (statCheckInMs > 0 && statCheckInMs < params.nowMs && statCheckInMs > lastSessionEndMs) {
    return Math.max(bounds.startMs, statCheckInMs);
  }

  return 0;
}

async function applyAttendanceStatusTransition(
  params: ApplyAttendanceStatusTransitionParams
): Promise<ApplyAttendanceStatusTransitionResult> {
  const db = params.db;
  const centerId = asTrimmedString(params.centerId);
  const studentId = asTrimmedString(params.studentId);
  const nextStatus = params.nextStatus;
  const nowMs = Math.max(0, Math.floor(params.nowMs ?? Date.now()));
  const nowTs = admin.firestore.Timestamp.fromMillis(nowMs);
  const currentDateKey = toStudyDayKey(new Date(nowMs));
  const seatDoc = await resolveAttendanceSeatDocForTransition({
    db,
    centerId,
    studentId,
    seatId: params.seatId,
  });

  if (!seatDoc) {
    const fallbackStartTimeMs = Math.max(0, Math.floor(params.fallbackStartTimeMs ?? 0));
    if (nextStatus === "absent" && fallbackStartTimeMs > 0 && nowMs > fallbackStartTimeMs) {
      const fallbackResult = await finalizeStudySession({
        db,
        centerId,
        studentId,
        startMs: fallbackStartTimeMs,
        endMs: nowMs,
        dateKeyOverride: toStudyDayKey(new Date(fallbackStartTimeMs)),
        sessionMetadata: {
          closedReason: "fallback_no_seat",
          closedBySource: params.source,
          ...(params.actorUid ? { closedByUid: params.actorUid } : {}),
        },
      });
      return {
        ok: true,
        noop: false,
        previousStatus: "studying",
        nextStatus,
        seatId: null,
        eventType: null,
        eventId: null,
        eventAtMillis: null,
        duplicatedSession: fallbackResult.duplicatedSession,
        sessionId: fallbackResult.sessionId,
        sessionDateKey: fallbackResult.sessionDateKey,
        sessionMinutes: fallbackResult.sessionMinutes,
        totalMinutesAfterSession: fallbackResult.totalMinutesAfterSession,
        attendanceAchieved: fallbackResult.attendanceAchieved,
        bonus6hAchieved: fallbackResult.bonus6hAchieved,
      };
    }

    throw new functions.https.HttpsError("failed-precondition", "Attendance seat not found.", {
      userMessage: "좌석이 배정된 학생만 출결 상태를 변경할 수 있습니다.",
    });
  }

  const initialSeatData = (seatDoc.data() || {}) as Record<string, unknown>;
  const preflightSeatSnap = await seatDoc.ref.get();
  const preflightSeatData = preflightSeatSnap.exists ? ((preflightSeatSnap.data() || {}) as Record<string, unknown>) : initialSeatData;
  const preflightStudentId = asTrimmedString(preflightSeatData.studentId);
  if (preflightStudentId && preflightStudentId !== studentId) {
    throw new functions.https.HttpsError("failed-precondition", "Seat belongs to another student.", {
      userMessage: "선택한 좌석이 다른 학생에게 배정되어 있습니다.",
    });
  }

  const preflightStatus = normalizeAttendanceSeatStatus(preflightSeatData.status);
  const preflightFlowContext =
    preflightStatus === "absent" && nextStatus === "studying"
      ? { dateKey: currentDateKey, startedAtMs: nowMs }
      : await resolveActiveAttendanceFlowContext({
          db,
          centerId,
          studentId,
          currentDateKey,
          nowMs,
          seatData: preflightSeatData,
        });
  const attendanceDateKey = preflightFlowContext.dateKey;
  const activeStudyStartedAtMs = preflightFlowContext.startedAtMs > 0
    ? preflightFlowContext.startedAtMs
    : (preflightStatus === "absent" && nextStatus === "studying" ? nowMs : 0);
  if (
    (nextStatus === "away" || nextStatus === "break") &&
    preflightStatus !== "studying" &&
    preflightStatus !== "away" &&
    preflightStatus !== "break"
  ) {
    throw new functions.https.HttpsError("failed-precondition", "Only active study seats can move away.", {
      userMessage: "입실 중인 학생만 외출 처리할 수 있습니다. 좌석 상태를 새로고침한 뒤 다시 확인해 주세요.",
    });
  }

  const preflightStartMs = preflightStatus === "studying" && nextStatus !== "studying"
    ? await resolveOpenStudyStartMsFromAttendanceEvidence({
        db,
        centerId,
        studentId,
        dateKey: attendanceDateKey,
        nowMs,
        seatData: preflightSeatData,
      })
    : toMillisSafe(preflightSeatData.lastCheckInAt);
  let finalized: FinalizeStudySessionResult | null = null;
  const shouldAllowCheckoutWithoutSession =
    preflightStatus === "studying" &&
    nextStatus === "absent" &&
    (preflightStartMs <= 0 || nowMs <= preflightStartMs);

  if (preflightStatus === "studying" && nextStatus !== "studying" && preflightStartMs <= 0 && !shouldAllowCheckoutWithoutSession) {
    throw new functions.https.HttpsError("failed-precondition", "Open study session start is missing.", {
      userMessage: "공부 시작 시간을 찾지 못해 외출 처리할 수 없습니다. 관리자에게 세션 보정을 요청해 주세요.",
    });
  }

  if (preflightStatus === "studying" && nextStatus !== "studying" && nowMs <= preflightStartMs && !shouldAllowCheckoutWithoutSession) {
    throw new functions.https.HttpsError("failed-precondition", "Open study session start is not before transition time.", {
      userMessage: "공부 시작 시간이 현재 시간보다 늦어 외출 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    });
  }

  if (preflightStatus === "studying" && nextStatus !== "studying" && !shouldAllowCheckoutWithoutSession) {
    finalized = await finalizeStudySession({
      db,
      centerId,
      studentId,
      startMs: preflightStartMs,
      endMs: nowMs,
      dateKeyOverride: attendanceDateKey,
      sessionMetadata: {
        closedReason: nextStatus === "absent" ? "check_out" : "away_start",
        closedBySource: params.source,
        ...(params.actorUid ? { closedByUid: params.actorUid } : {}),
      },
    });
  }

  return db.runTransaction(async (transaction) => {
    const freshSeatSnap = await transaction.get(seatDoc.ref);
    const freshSeatData = freshSeatSnap.exists ? ((freshSeatSnap.data() || {}) as Record<string, unknown>) : initialSeatData;
    const freshStudentId = asTrimmedString(freshSeatData.studentId);
    if (freshStudentId && freshStudentId !== studentId) {
      throw new functions.https.HttpsError("failed-precondition", "Seat belongs to another student.", {
        userMessage: "선택한 좌석이 다른 학생에게 배정되어 있습니다.",
      });
    }

    const prevStatus = normalizeAttendanceSeatStatus(freshSeatData.status);
    if (preflightStatus === "studying" && nextStatus !== "studying" && prevStatus !== "studying") {
      return {
        ok: true,
        noop: true,
        previousStatus: prevStatus,
        nextStatus,
        seatId: seatDoc.id,
        eventType: null,
        eventId: null,
        eventAtMillis: null,
        duplicatedSession: finalized?.duplicatedSession ?? true,
        sessionId: finalized?.sessionId ?? null,
        sessionDateKey: finalized?.sessionDateKey ?? null,
        sessionMinutes: finalized?.sessionMinutes ?? 0,
        totalMinutesAfterSession: finalized?.totalMinutesAfterSession ?? 0,
        attendanceAchieved: finalized?.attendanceAchieved ?? false,
        bonus6hAchieved: finalized?.bonus6hAchieved ?? false,
      };
    }

    if (prevStatus === "studying" && nextStatus !== "studying" && !finalized && !shouldAllowCheckoutWithoutSession) {
      throw new functions.https.HttpsError("failed-precondition", "Open study session was not finalized.", {
        userMessage: "진행 중인 공부 세션을 먼저 저장하지 못해 외출 처리할 수 없습니다. 다시 시도해 주세요.",
      });
    }

    if (
      (nextStatus === "away" || nextStatus === "break") &&
      prevStatus !== "studying" &&
      prevStatus !== "away" &&
      prevStatus !== "break"
    ) {
      throw new functions.https.HttpsError("failed-precondition", "Only active study seats can move away.", {
        userMessage: "입실 중인 학생만 외출 처리할 수 있습니다. 좌석 상태를 새로고침한 뒤 다시 확인해 주세요.",
      });
    }

    if (prevStatus === nextStatus) {
      if (params.source === "kiosk") {
        const repeatEventType = resolveExplicitAttendanceEventType(prevStatus, nextStatus);
        const repeatEventRef = db.collection(`centers/${centerId}/attendanceEvents`).doc();
        const repeatStatRef = db.doc(`centers/${centerId}/attendanceDailyStats/${attendanceDateKey}/students/${studentId}`);
        const repeatStatSnap = await transaction.get(repeatStatRef);
        const repeatStatData = repeatStatSnap.exists ? ((repeatStatSnap.data() || {}) as Record<string, unknown>) : {};
        const existingCheckInAt = toTimestampOrNow(repeatStatData.checkInAt);
        const repeatStatPatch: Record<string, unknown> = {
          centerId,
          studentId,
          dateKey: attendanceDateKey,
          attendanceStatus: nextStatus,
          source: params.source,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (repeatEventType === "check_in") {
          repeatStatPatch.checkInAt =
            existingCheckInAt && existingCheckInAt.toMillis() <= nowMs
              ? existingCheckInAt
              : nowTs;
        }
        if (repeatEventType === "check_out") {
          repeatStatPatch.checkOutAt = nowTs;
          repeatStatPatch.hasCheckOutRecord = true;
        }

        const repeatSeatPatch: Record<string, unknown> = {
          studentId,
          status: nextStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (nextStatus === "absent") {
          repeatSeatPatch.activeStudyDayKey = admin.firestore.FieldValue.delete();
          repeatSeatPatch.activeStudyStartedAt = admin.firestore.FieldValue.delete();
        } else {
          repeatSeatPatch.activeStudyDayKey = attendanceDateKey;
          repeatSeatPatch.activeStudyStartedAt = activeStudyStartedAtMs > 0
            ? admin.firestore.Timestamp.fromMillis(activeStudyStartedAtMs)
            : nowTs;
        }

        transaction.set(repeatStatRef, repeatStatPatch, { merge: true });
        transaction.set(seatDoc.ref, repeatSeatPatch, { merge: true });
        transaction.set(repeatEventRef, {
          studentId,
          dateKey: attendanceDateKey,
          eventType: repeatEventType,
          occurredAt: nowTs,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          source: params.source,
          seatId: seatDoc.id,
          statusBefore: prevStatus,
          statusAfter: nextStatus,
          repeatAction: true,
          ...(params.actorUid ? { actorUid: params.actorUid } : {}),
        });

        return {
          ok: true,
          noop: false,
          previousStatus: prevStatus,
          nextStatus,
          seatId: seatDoc.id,
          eventType: repeatEventType,
          eventId: repeatEventRef.id,
          eventAtMillis: nowMs,
          duplicatedSession: finalized?.duplicatedSession ?? true,
          sessionId: finalized?.sessionId ?? null,
          sessionDateKey: finalized?.sessionDateKey ?? null,
          sessionMinutes: finalized?.sessionMinutes ?? 0,
          totalMinutesAfterSession: finalized?.totalMinutesAfterSession ?? 0,
          attendanceAchieved: finalized?.attendanceAchieved ?? false,
          bonus6hAchieved: finalized?.bonus6hAchieved ?? false,
        };
      }

      return {
        ok: true,
        noop: true,
        previousStatus: prevStatus,
        nextStatus,
        seatId: seatDoc.id,
        eventType: null,
        eventId: null,
        eventAtMillis: null,
        duplicatedSession: finalized?.duplicatedSession ?? true,
        sessionId: finalized?.sessionId ?? null,
        sessionDateKey: finalized?.sessionDateKey ?? null,
        sessionMinutes: finalized?.sessionMinutes ?? 0,
        totalMinutesAfterSession: finalized?.totalMinutesAfterSession ?? 0,
        attendanceAchieved: finalized?.attendanceAchieved ?? false,
        bonus6hAchieved: finalized?.bonus6hAchieved ?? false,
      };
    }

    const eventType = resolveAttendanceTransitionEventType(prevStatus, nextStatus);
    const eventRef = eventType ? db.collection(`centers/${centerId}/attendanceEvents`).doc() : null;
    const statRef = db.doc(`centers/${centerId}/attendanceDailyStats/${attendanceDateKey}/students/${studentId}`);
    const progressRef = db.doc(`centers/${centerId}/growthProgress/${studentId}`);
    const [statSnap, progressSnap] = await Promise.all([
      transaction.get(statRef),
      eventType === "check_in" ? transaction.get(progressRef) : Promise.resolve(null),
    ]);
    const seatPatch = buildAttendanceSeatPatch({
      studentId,
      nextStatus,
      seatData: freshSeatData,
      seatHint: params.seatHint,
      nowTs,
      activeStudyDayKey: attendanceDateKey,
      activeStudyStartedAtMs,
    });
    transaction.set(seatDoc.ref, seatPatch, { merge: true });

    const statData = statSnap.exists ? ((statSnap.data() || {}) as Record<string, unknown>) : {};
    const existingCheckInAt = toTimestampOrNow(statData.checkInAt);
    const statPatch: Record<string, unknown> = {
      centerId,
      studentId,
      dateKey: attendanceDateKey,
      attendanceStatus: nextStatus,
      source: params.source,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (eventType === "check_in") {
      statPatch.checkInAt =
        existingCheckInAt && existingCheckInAt.toMillis() <= nowMs
          ? existingCheckInAt
          : nowTs;
    }
    if (eventType === "check_out") {
      statPatch.checkOutAt = nowTs;
      statPatch.hasCheckOutRecord = true;
      if (shouldAllowCheckoutWithoutSession) {
        statPatch.checkoutSessionMissing = true;
      }
    }
    transaction.set(statRef, statPatch, { merge: true });

    if (eventType && eventRef) {
      transaction.set(eventRef, {
        studentId,
        dateKey: attendanceDateKey,
        eventType,
        occurredAt: nowTs,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: params.source,
        seatId: seatDoc.id,
        statusBefore: prevStatus,
        statusAfter: nextStatus,
        ...(shouldAllowCheckoutWithoutSession ? { sessionFinalizeSkipped: true, sessionFinalizeSkipReason: "missing_open_session_start" } : {}),
        ...(params.actorUid ? { actorUid: params.actorUid } : {}),
      });
    }

    if (eventType === "check_in" && progressSnap) {
      const progressData = progressSnap.exists ? ((progressSnap.data() || {}) as Record<string, unknown>) : {};
      const dailyPointStatus = isPlainObject(progressData.dailyPointStatus)
        ? (progressData.dailyPointStatus as Record<string, unknown>)
        : {};
      const currentDayStatus = isPlainObject(dailyPointStatus[attendanceDateKey])
        ? { ...(dailyPointStatus[attendanceDateKey] as Record<string, unknown>) }
        : {};
      if (currentDayStatus.checkedIn !== true) {
        transaction.set(progressRef, {
          dailyPointStatus: {
            [attendanceDateKey]: {
              ...currentDayStatus,
              checkedIn: true,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }

    return {
      ok: true,
      noop: false,
      previousStatus: prevStatus,
      nextStatus,
      seatId: seatDoc.id,
      eventType,
      eventId: eventRef?.id || null,
      eventAtMillis: eventType ? nowMs : null,
      duplicatedSession: finalized?.duplicatedSession ?? false,
      sessionId: finalized?.sessionId ?? null,
      sessionDateKey: finalized?.sessionDateKey ?? null,
      sessionMinutes: finalized?.sessionMinutes ?? 0,
      totalMinutesAfterSession: finalized?.totalMinutesAfterSession ?? 0,
      attendanceAchieved: finalized?.attendanceAchieved ?? false,
      bonus6hAchieved: finalized?.bonus6hAchieved ?? false,
    };
  });
}

export const setStudentAttendanceStatusSecure = smsDispatcherFunctions.https.onCall(async (data, context) => {
  const db = admin.firestore();
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = asTrimmedString(data?.centerId);
  const requestedStudentId = asTrimmedString(data?.studentId);
  const nextStatus = parseAttendanceSeatStatus(data?.nextStatus);
  const source = parseAttendanceTransitionSource(data?.source);
  if (!centerId || !requestedStudentId || !nextStatus || !source) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid attendance transition input.", {
      userMessage: "출결 변경 정보를 다시 확인해 주세요.",
    });
  }

  const membership = await resolveCenterMembershipRole(db, centerId, context.auth.uid);
  if (!membership.role || !isActiveMembershipStatus(membership.status)) {
    throw new functions.https.HttpsError("permission-denied", "Inactive membership.", {
      userMessage: "현재 계정 상태로는 출결을 변경할 수 없습니다.",
    });
  }
  if (membership.role === "parent") {
    throw new functions.https.HttpsError("permission-denied", "Parents cannot update attendance.", {
      userMessage: "학부모 계정에서는 출결을 변경할 수 없습니다.",
    });
  }

  const callerIdentity = membership.role === "student"
    ? await resolveCenterStudentIdentity(db, centerId, context.auth.uid)
    : null;
  const effectiveStudentId = membership.role === "student"
    ? (callerIdentity?.studentId || context.auth.uid)
    : requestedStudentId;
  if (membership.role === "student" && requestedStudentId !== effectiveStudentId && requestedStudentId !== context.auth.uid) {
    throw new functions.https.HttpsError("permission-denied", "Students can only update self attendance.", {
      userMessage: "학생 본인 출결만 변경할 수 있습니다.",
    });
  }
  if (membership.role === "student" && source !== "student_dashboard") {
    throw new functions.https.HttpsError("permission-denied", "Invalid student attendance source.", {
      userMessage: "학생 대시보드에서만 본인 출결을 변경할 수 있습니다.",
    });
  }
  if (membership.role === "kiosk" && source !== "kiosk") {
    throw new functions.https.HttpsError("permission-denied", "Invalid kiosk attendance source.", {
      userMessage: "키오스크 계정에서는 키오스크 화면에서만 출결을 변경할 수 있습니다.",
    });
  }
  if (membership.role === "teacher" || isAdminRole(membership.role)) {
    // Allowed.
  } else if (membership.role === "kiosk") {
    // Kiosk accounts can update attendance only through the kiosk source check above.
  } else if (membership.role !== "student") {
    throw new functions.https.HttpsError("permission-denied", "Unsupported attendance caller role.");
  }

  const [studentSnap, memberSnap] = await Promise.all([
    db.doc(`centers/${centerId}/students/${effectiveStudentId}`).get(),
    db.doc(`centers/${centerId}/members/${effectiveStudentId}`).get(),
  ]);
  if (!studentSnap.exists && !memberSnap.exists) {
    throw new functions.https.HttpsError("failed-precondition", "Student not found.", {
      userMessage: "학생 정보를 찾을 수 없습니다.",
    });
  }

  const seatHintRaw = isPlainObject(data?.seatHint) ? (data.seatHint as Record<string, unknown>) : {};
  const result = await applyAttendanceStatusTransition({
    db,
    centerId,
    studentId: effectiveStudentId,
    nextStatus,
    source,
    actorUid: context.auth.uid,
    seatId: asTrimmedString(data?.seatId) || null,
    seatHint: {
      seatNo: parseFiniteNumber(seatHintRaw.seatNo),
      roomId: asTrimmedString(seatHintRaw.roomId) || null,
      roomSeatNo: parseFiniteNumber(seatHintRaw.roomSeatNo),
    },
  });

  void queueAttendanceTransitionSmsAfterCommit(db, {
    centerId,
    result,
  }).catch((error) => {
    console.error("[attendance-sms-v2] post-transition queue failed", {
      centerId,
      eventId: result.eventId || null,
      eventType: result.eventType || null,
      message: error instanceof Error ? error.message : String(error),
    });
  });

  return result;
});

type RepairRecentStudySessionTotalsResult = {
  ok: true;
  studentCount: number;
  dayCount: number;
  sessionsCreated: number;
  daysSynced: number;
};

type CreateManualStudySessionResult = {
  ok: true;
  sessionId: string;
  sessionIds: string[];
  sessionDateKey: string;
  sessionMinutes: number;
  totalMinutesAfterSession: number;
  totalMinutesByDateKey: Record<string, number>;
};

type UpdateManualStudySessionResult = {
  ok: true;
  sessionId: string;
  sessionDateKey: string;
  sessionMinutes: number;
  totalMinutesAfterSession: number;
};

type DeleteManualStudySessionResult = {
  ok: true;
  sessionId: string;
  sessionDateKey: string;
  deletedMinutes: number;
  totalMinutesAfterSession: number;
};

async function assertManualStudySessionMutationAllowed(params: {
  db: admin.firestore.Firestore;
  centerId: string;
  studentId: string;
  authUid: string;
  action: "create" | "update" | "delete";
}): Promise<void> {
  const membership = await resolveCenterMembershipRole(params.db, params.centerId, params.authUid);
  if (
    !membership.role ||
    !isActiveMembershipStatus(membership.status) ||
    (membership.role !== "teacher" && !isAdminRole(membership.role))
  ) {
    throw new functions.https.HttpsError("permission-denied", `Only active teachers or admins can ${params.action} manual sessions.`, {
      userMessage: "선생님 또는 관리자 권한으로만 세션을 조정할 수 있습니다.",
    });
  }

  const [studentSnap, memberSnap] = await Promise.all([
    params.db.doc(`centers/${params.centerId}/students/${params.studentId}`).get(),
    params.db.doc(`centers/${params.centerId}/members/${params.studentId}`).get(),
  ]);
  if (!studentSnap.exists && !memberSnap.exists) {
    throw new functions.https.HttpsError("failed-precondition", "Student not found.", {
      userMessage: "학생 정보를 찾을 수 없습니다.",
    });
  }
}

function assertManualSessionTimeInput(params: {
  centerId: string;
  studentId: string;
  startMs: number;
  endMs: number;
  dateKey?: string;
}): void {
  if (!params.centerId || !params.studentId || params.startMs <= 0 || params.endMs <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid manual session input.", {
      userMessage: "학생과 세션 시간을 다시 확인해 주세요.",
    });
  }
  if (params.endMs <= params.startMs) {
    throw new functions.https.HttpsError("invalid-argument", "Manual session end must be after start.", {
      userMessage: "종료 시간은 시작 시간보다 뒤여야 합니다.",
    });
  }
  if (params.endMs - params.startMs > MAX_STUDY_SESSION_MINUTES * MINUTE_MS) {
    throw new functions.https.HttpsError("invalid-argument", "Manual session is too long.", {
      userMessage: `세션은 한 번에 최대 ${MAX_STUDY_SESSION_MINUTES}분까지만 만들 수 있습니다.`,
    });
  }
  if (params.endMs > Date.now() + 5 * MINUTE_MS) {
    throw new functions.https.HttpsError("invalid-argument", "Manual session cannot end in the future.", {
      userMessage: "아직 지나지 않은 시간으로 세션을 저장할 수 없습니다.",
    });
  }

  if (params.dateKey) {
    if (!isValidDateKey(params.dateKey)) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid dateKey.", {
        userMessage: "날짜 정보를 다시 확인해 주세요.",
      });
    }
    const startDateKey = toStudyDayKey(new Date(params.startMs));
    if (startDateKey !== params.dateKey) {
      throw new functions.https.HttpsError("invalid-argument", "Manual session must stay inside the selected study day.", {
        userMessage: "현재 선택한 날짜에 시작한 세션만 입력해 주세요.",
      });
    }
  }
}

function buildRecentStudyDayKeys(dayCount: number, baseDate: Date = new Date()): string[] {
  const safeCount = Math.min(7, Math.max(1, Math.round(dayCount)));
  const currentStudyDay = toStudyDayDate(baseDate);
  return Array.from({ length: safeCount }, (_, index) => {
    const day = new Date(currentStudyDay);
    day.setDate(day.getDate() - index);
    return toDateKey(day);
  });
}

function getExistingStudySessionRangeMs(data: Record<string, unknown>, fallbackEndMs: number): { startMs: number; endMs: number } | null {
  const startMs = toMillisSafe(data.startTime);
  if (startMs <= 0) return null;

  const explicitEndMs = toMillisSafe(data.endTime);
  if (explicitEndMs > startMs) {
    return { startMs, endMs: explicitEndMs };
  }

  const durationMinutes = getStudySessionDurationMinutesFromData(data);
  if (durationMinutes > 0) {
    return {
      startMs,
      endMs: startMs + durationMinutes * MINUTE_MS,
    };
  }

  if (fallbackEndMs > startMs) {
    return { startMs, endMs: fallbackEndMs };
  }

  return { startMs, endMs: startMs + MINUTE_MS };
}

async function assertNoOverlappingStudySessions(params: {
  db: admin.firestore.Firestore;
  centerId: string;
  studentId: string;
  startMs: number;
  endMs: number;
  ignoreSessionIds?: string[];
}): Promise<void> {
  const { db, centerId, studentId, startMs, endMs } = params;
  const ignoredSessionIds = new Set((params.ignoreSessionIds || []).map((value) => asTrimmedString(value)).filter(Boolean));
  const dateKeys = buildStudySessionOverlapDateKeys(startMs, endMs);
  const fallbackOpenEndMs = Math.max(Date.now(), endMs);

  for (const dateKey of dateKeys) {
    const sessionsSnap = await db.collection(`centers/${centerId}/studyLogs/${studentId}/days/${dateKey}/sessions`).get();

    for (const sessionSnap of sessionsSnap.docs) {
      if (ignoredSessionIds.has(sessionSnap.id)) continue;
      const range = getExistingStudySessionRangeMs((sessionSnap.data() || {}) as Record<string, unknown>, fallbackOpenEndMs);
      if (!range) continue;
      if (range.startMs < endMs && range.endMs > startMs) {
        throw new functions.https.HttpsError("failed-precondition", "Manual session overlaps with an existing session.", {
          userMessage: "이미 저장된 세션 시간과 겹칩니다. 시작/종료 시간을 다시 확인해 주세요.",
          sessionId: sessionSnap.id,
        });
      }
    }
  }

  const liveSeatSnap = await db
    .collection(`centers/${centerId}/attendanceCurrent`)
    .where("studentId", "==", studentId)
    .limit(10)
    .get();
  for (const seatDoc of liveSeatSnap.docs) {
    const seatData = (seatDoc.data() || {}) as Record<string, unknown>;
    if (asTrimmedString(seatData.status) !== "studying") continue;
    const liveStartMs = toMillisSafe(seatData.lastCheckInAt);
    if (liveStartMs <= 0) continue;
    const liveEndMs = Math.max(Date.now(), liveStartMs + MINUTE_MS);
    if (liveStartMs < endMs && liveEndMs > startMs) {
      throw new functions.https.HttpsError("failed-precondition", "Manual session overlaps with the active live session.", {
        userMessage: "현재 진행 중인 공부 세션과 시간이 겹칩니다. 진행 중 세션을 먼저 종료하거나 겹치지 않는 시간을 입력해 주세요.",
        seatId: seatDoc.id,
      });
    }
  }
}

export const createManualStudySessionSecure = functions
  .region(region)
  .https.onCall(async (data, context): Promise<CreateManualStudySessionResult> => {
    const db = admin.firestore();
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const centerId = asTrimmedString(data?.centerId);
    const studentId = asTrimmedString(data?.studentId);
    const startMs = Math.floor(parseFiniteNumber(data?.startAtMs) ?? 0);
    const endMs = Math.floor(parseFiniteNumber(data?.endAtMs) ?? 0);
    const source = asTrimmedString(data?.source, "admin_focus_board");
    const note = asTrimmedString(data?.note);

    assertManualSessionTimeInput({ centerId, studentId, startMs, endMs });
    await assertManualStudySessionMutationAllowed({
      db,
      centerId,
      studentId,
      authUid: context.auth.uid,
      action: "create",
    });

    await assertNoOverlappingStudySessions({
      db,
      centerId,
      studentId,
      startMs,
      endMs,
    });

    const result = await finalizeStudySession({
      db,
      centerId,
      studentId,
      startMs,
      endMs,
      sessionMetadata: {
        manualCreated: true,
        manualCreatedByUid: context.auth.uid,
        manualCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
        source,
        ...(note ? { manualNote: note } : {}),
      },
    });

    return {
      ok: true,
      sessionId: result.sessionId,
      sessionIds: result.sessionIds,
      sessionDateKey: result.sessionDateKey,
      sessionMinutes: result.sessionMinutes,
      totalMinutesAfterSession: result.totalMinutesAfterSession,
      totalMinutesByDateKey: result.totalMinutesByDateKey,
    };
  });

export const updateManualStudySessionSecure = functions
  .region(region)
  .https.onCall(async (data, context): Promise<UpdateManualStudySessionResult> => {
    const db = admin.firestore();
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const centerId = asTrimmedString(data?.centerId);
    const studentId = asTrimmedString(data?.studentId);
    const dateKey = asTrimmedString(data?.dateKey);
    const sessionId = asTrimmedString(data?.sessionId);
    const startMs = Math.floor(parseFiniteNumber(data?.startAtMs) ?? 0);
    const endMs = Math.floor(parseFiniteNumber(data?.endAtMs) ?? 0);
    const source = asTrimmedString(data?.source, "admin_focus_board");
    const note = asTrimmedString(data?.note);

    if (!sessionId) {
      throw new functions.https.HttpsError("invalid-argument", "sessionId is required.", {
        userMessage: "수정할 세션을 다시 선택해 주세요.",
      });
    }
    assertManualSessionTimeInput({ centerId, studentId, startMs, endMs, dateKey });
    await assertManualStudySessionMutationAllowed({
      db,
      centerId,
      studentId,
      authUid: context.auth.uid,
      action: "update",
    });

    const sessionRef = db.doc(`centers/${centerId}/studyLogs/${studentId}/days/${dateKey}/sessions/${sessionId}`);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Study session not found.", {
        userMessage: "수정할 세션을 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.",
      });
    }

    await assertNoOverlappingStudySessions({
      db,
      centerId,
      studentId,
      startMs,
      endMs,
      ignoreSessionIds: [sessionId],
    });

    const sessionSeconds = Math.max(1, Math.floor((endMs - startMs) / SECOND_MS));
    const sessionMinutes = Math.max(1, Math.ceil(sessionSeconds / 60));
    const dayRef = db.doc(`centers/${centerId}/studyLogs/${studentId}/days/${dateKey}`);
    const batch = db.batch();
    batch.set(dayRef, {
      studentId,
      centerId,
      dateKey,
      manualSessionCorrection: true,
      manualSessionCorrectionAt: admin.firestore.FieldValue.serverTimestamp(),
      manualSessionCorrectionByUid: context.auth.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    batch.set(sessionRef, {
      studentId,
      centerId,
      dateKey,
      sessionId,
      startTime: admin.firestore.Timestamp.fromMillis(startMs),
      endTime: admin.firestore.Timestamp.fromMillis(endMs),
      durationMinutes: sessionMinutes,
      durationSeconds: sessionSeconds,
      allowSessionShrink: true,
      manualSessionCorrection: true,
      manualUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      manualUpdatedByUid: context.auth.uid,
      source,
      manualNote: note || admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await batch.commit();
    await syncStudyLogDayTotalMinutes(db, centerId, studentId, dateKey);

    const daySnap = await dayRef.get();
    const totalMinutesAfterSession = getStoredStudyTotalMinutes((daySnap.data() || {}) as Record<string, unknown>, ["totalMinutes", "totalStudyMinutes"]);
    return {
      ok: true,
      sessionId,
      sessionDateKey: dateKey,
      sessionMinutes,
      totalMinutesAfterSession,
    };
  });

export const deleteManualStudySessionSecure = functions
  .region(region)
  .https.onCall(async (data, context): Promise<DeleteManualStudySessionResult> => {
    const db = admin.firestore();
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const centerId = asTrimmedString(data?.centerId);
    const studentId = asTrimmedString(data?.studentId);
    const dateKey = asTrimmedString(data?.dateKey);
    const sessionId = asTrimmedString(data?.sessionId);
    const source = asTrimmedString(data?.source, "admin_focus_board");
    const reason = asTrimmedString(data?.reason) || "manual_session_delete";

    if (!centerId || !studentId || !isValidDateKey(dateKey) || !sessionId) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid session delete input.", {
        userMessage: "삭제할 세션 정보를 다시 확인해 주세요.",
      });
    }
    await assertManualStudySessionMutationAllowed({
      db,
      centerId,
      studentId,
      authUid: context.auth.uid,
      action: "delete",
    });

    const sessionRef = db.doc(`centers/${centerId}/studyLogs/${studentId}/days/${dateKey}/sessions/${sessionId}`);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Study session not found.", {
        userMessage: "삭제할 세션을 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.",
      });
    }
    const sessionData = (sessionSnap.data() || {}) as Record<string, unknown>;
    const deletedMinutes = getStudySessionDurationMinutesFromData(sessionData);
    const dayRef = db.doc(`centers/${centerId}/studyLogs/${studentId}/days/${dateKey}`);
    const allowanceRef = db.doc(`centers/${centerId}/studySessionDeletionAllowances/${studentId}`);
    const archiveRef = getStudySessionProtectionArchiveRef({
      db,
      centerId,
      studentId,
      dateKey,
      sessionId,
    });

    const batch = db.batch();
    batch.set(allowanceRef, {
      studentId,
      centerId,
      sessionId,
      reason,
      source,
      createdByUid: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 10 * MINUTE_MS),
    }, { merge: true });
    batch.set(dayRef, {
      studentId,
      centerId,
      dateKey,
      manualSessionCorrection: true,
      manualSessionCorrectionAt: admin.firestore.FieldValue.serverTimestamp(),
      manualSessionCorrectionByUid: context.auth.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    batch.set(archiveRef, {
      centerId,
      studentId,
      dateKey,
      sessionId,
      reason: "manual_session_deleted",
      source,
      beforeData: sessionData,
      beforeMinutes: deletedMinutes,
      createdByUid: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.delete(sessionRef);
    await batch.commit();
    await syncStudyLogDayTotalMinutes(db, centerId, studentId, dateKey);

    const daySnap = await dayRef.get();
    const totalMinutesAfterSession = getStoredStudyTotalMinutes((daySnap.data() || {}) as Record<string, unknown>, ["totalMinutes", "totalStudyMinutes"]);
    return {
      ok: true,
      sessionId,
      sessionDateKey: dateKey,
      deletedMinutes,
      totalMinutesAfterSession,
    };
  });

type RepairAttendanceEvent = {
  eventType: "check_in" | "away_start" | "away_end" | "check_out";
  occurredAtMs: number;
  dateKey?: string;
};

async function repairMissingStudySessionsFromAttendanceEvents(params: {
  db: admin.firestore.Firestore;
  centerId: string;
  studentId: string;
  dateKey: string;
  events: RepairAttendanceEvent[];
}): Promise<number> {
  const { db, centerId, studentId, dateKey } = params;
  const dayRef = db.doc(`centers/${centerId}/studyLogs/${studentId}/days/${dateKey}`);
  const sessionsCol = dayRef.collection("sessions");
  const existingSessionsSnap = await sessionsCol.get();
  const existingSessionRanges: Array<{ startMs: number; endMs: number }> = existingSessionsSnap.docs
    .map((sessionSnap) => getExistingStudySessionRangeMs((sessionSnap.data() || {}) as Record<string, unknown>, Date.now()))
    .filter((range): range is { startMs: number; endMs: number } => Boolean(range));

  const dayEvents = params.events
    .filter((event) => {
      const eventDateKey = asTrimmedString(event.dateKey);
      if (isValidDateKey(eventDateKey)) return eventDateKey === dateKey;
      const bounds = getStudyDayWindowBounds(dateKey);
      return event.occurredAtMs >= bounds.startMs && event.occurredAtMs < bounds.endMs;
    })
    .sort((left, right) => left.occurredAtMs - right.occurredAtMs);

  let openStartMs: number | null = null;
  let sessionsCreated = 0;

  for (const event of dayEvents) {
    if (event.eventType === "check_in" || event.eventType === "away_end") {
      if (openStartMs === null) {
        openStartMs = event.occurredAtMs;
      }
      continue;
    }

    if ((event.eventType === "away_start" || event.eventType === "check_out") && openStartMs !== null) {
      const endMs = Math.min(event.occurredAtMs, openStartMs + MAX_STUDY_SESSION_MINUTES * MINUTE_MS);
      if (endMs > openStartMs) {
        const overlapsExistingSession = existingSessionRanges.some((range) =>
          doTimeRangesOverlap(openStartMs as number, endMs, range.startMs, range.endMs)
        );
        if (overlapsExistingSession) {
          openStartMs = null;
          continue;
        }

        const sessionSeconds = Math.max(1, Math.floor((endMs - openStartMs) / 1000));
        const sessionMinutes = Math.max(1, Math.ceil(sessionSeconds / 60));
        const sessionId = `repaired_${openStartMs}_${endMs}`;
        const sessionRef = sessionsCol.doc(sessionId);
        const sessionSnap = await sessionRef.get();
        if (!sessionSnap.exists) {
          await sessionRef.set({
            studentId,
            centerId,
            dateKey,
            sessionId,
            startTime: admin.firestore.Timestamp.fromMillis(openStartMs),
            endTime: admin.firestore.Timestamp.fromMillis(endMs),
            durationSeconds: sessionSeconds,
            durationMinutes: sessionMinutes,
            repairedFromAttendanceEvents: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          sessionsCreated += 1;
          existingSessionRanges.push({ startMs: openStartMs, endMs });
        }
      }
      openStartMs = null;
    }
  }

  return sessionsCreated;
}

export const repairRecentStudySessionTotals = functions
  .region(region)
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .https.onCall(async (data, context): Promise<RepairRecentStudySessionTotalsResult> => {
    const db = admin.firestore();
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const centerId = asTrimmedString(data?.centerId);
    if (!centerId) {
      throw new functions.https.HttpsError("invalid-argument", "centerId is required.", {
        userMessage: "센터 정보를 다시 확인해 주세요.",
      });
    }

    const membership = await resolveCenterMembershipRole(db, centerId, context.auth.uid);
    if (!membership.role || !isActiveMembershipStatus(membership.status) || !isAdminRole(membership.role)) {
      throw new functions.https.HttpsError("permission-denied", "Only active admins can repair study sessions.", {
        userMessage: "관리자 권한으로만 학습시간 보정을 실행할 수 있습니다.",
      });
    }

    const requestedStudentId = asTrimmedString(data?.studentId);
    const dayCount = Math.min(7, Math.max(1, Math.round(parseFiniteNumber(data?.days) ?? 7)));
    const dateKeys = buildRecentStudyDayKeys(dayCount);
    let studentIds: string[] = [];

    if (requestedStudentId) {
      studentIds = [requestedStudentId];
    } else {
      const [studentsSnap, membersSnap] = await Promise.all([
        db.collection(`centers/${centerId}/students`).get(),
        db.collection(`centers/${centerId}/members`).where("role", "==", "student").get(),
      ]);
      studentIds = Array.from(new Set([
        ...studentsSnap.docs.map((docSnap) => docSnap.id),
        ...membersSnap.docs.map((docSnap) => docSnap.id),
      ])).filter(Boolean);
    }

    let sessionsCreated = 0;
    let daysSynced = 0;

    for (const studentId of studentIds) {
      const eventSnap = await db.collection(`centers/${centerId}/attendanceEvents`).where("studentId", "==", studentId).get();
      const repairEvents = eventSnap.docs
        .map((docSnap): RepairAttendanceEvent | null => {
          const eventData = (docSnap.data() || {}) as Record<string, unknown>;
          const eventType = asTrimmedString(eventData.eventType);
          if (
            eventType !== "check_in" &&
            eventType !== "away_start" &&
            eventType !== "away_end" &&
            eventType !== "check_out"
          ) {
            return null;
          }
          const occurredAtMs = toMillisSafe(eventData.occurredAt) || toMillisSafe(eventData.createdAt);
          if (occurredAtMs <= 0) return null;
          return {
            eventType,
            occurredAtMs,
            dateKey: asTrimmedString(eventData.dateKey),
          };
        })
        .filter((event): event is RepairAttendanceEvent => Boolean(event));

      for (const dateKey of dateKeys) {
        sessionsCreated += await repairMissingStudySessionsFromAttendanceEvents({
          db,
          centerId,
          studentId,
          dateKey,
          events: repairEvents,
        });
        await syncStudyLogDayTotalMinutes(db, centerId, studentId, dateKey);
        daysSynced += 1;
      }
    }

    return {
      ok: true,
      studentCount: studentIds.length,
      dayCount: dateKeys.length,
      sessionsCreated,
      daysSynced,
    };
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
    const todayKey = toStudyDayKey(nowKst);

    const dateKeys: string[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(nowKst);
      d.setDate(d.getDate() - i);
      dateKeys.push(toStudyDayKey(d));
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

      const atRiskStudentIds: string[] = [];
      const atRiskNames: string[] = [];

      for (const studentId of activeStudentIds) {
        const studentData = studentProfileMap.get(studentId) || null;
        if (!studentData) continue;
        const targetDailyMinutes = Number(studentData?.targetDailyMinutes ?? 0);
        if (targetDailyMinutes <= 0) continue;

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
              dateKey: todayKey,
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
      dateKey: toStudyDayKey(nowKst),
    });
    return null;
  });

/**
 * 교사/센터관리자가 특정 센터의 교실 관제 신호를 수동 갱신합니다.
 */
export const createPointBoostEventSecure = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = asTrimmedString(data?.centerId);
  const mode = normalizePointBoostMode(data?.mode);
  const startAtMs = Math.round(parseFiniteNumber(data?.startAtMs) ?? Number.NaN);
  const endAtMs = Math.round(parseFiniteNumber(data?.endAtMs) ?? Number.NaN);
  const multiplier = normalizePointBoostMultiplier(data?.multiplier);

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
  const message = normalizePointBoostMessage(data?.message, multiplier);
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
    const event = docSnap.data() as PointBoostEventDoc;
    if (isPointBoostEventCancelled(event)) return false;
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
    message,
    createdBy: context.auth.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    ok: true,
    eventId: eventRef.id,
  };
});

export const cancelPointBoostEventSecure = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = asTrimmedString(data?.centerId);
  const eventId = asTrimmedString(data?.eventId);

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

  const eventData = eventSnap.data() as PointBoostEventDoc;
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

export const adjustStudentPointBalanceSecure = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const authUid = context.auth.uid;
  const centerId = asTrimmedString(data?.centerId);
  const studentId = asTrimmedString(data?.studentId);
  const dateKey = asTrimmedString(data?.dateKey);
  const deltaPoints = Math.round(parseFiniteNumber(data?.deltaPoints) ?? Number.NaN);
  const reason = asTrimmedString(data?.reason).slice(0, 160);
  const absPoints = Math.abs(deltaPoints);

  if (!centerId || !studentId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId/studentId is required.", {
      userMessage: "포인트를 수정할 학생 정보를 다시 확인해 주세요.",
    });
  }
  if (!isValidDateKey(dateKey)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid dateKey.", {
      userMessage: "포인트 수정 일자를 다시 확인해 주세요.",
    });
  }
  if (!Number.isFinite(deltaPoints) || deltaPoints === 0 || absPoints < 1 || absPoints > 100000) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid point delta.", {
      userMessage: "포인트는 1~100,000 사이의 숫자로 입력해 주세요.",
    });
  }
  if (reason.length < 2) {
    throw new functions.https.HttpsError("invalid-argument", "Reason is required.", {
      userMessage: "포인트 수정 사유를 입력해 주세요.",
    });
  }

  const membership = await resolveCenterMembershipRole(db, centerId, authUid);
  if (!membership.role || !isAdminRole(membership.role) || !isActiveMembershipStatus(membership.status)) {
    throw new functions.https.HttpsError("permission-denied", "Only center admins can adjust student points.", {
      userMessage: "센터 관리자만 학생 포인트를 수정할 수 있습니다.",
    });
  }

  const [studentMemberSnap, studentProfileSnap] = await Promise.all([
    db.doc(`centers/${centerId}/members/${studentId}`).get(),
    db.doc(`centers/${centerId}/students/${studentId}`).get(),
  ]);
  if (!studentMemberSnap.exists && !studentProfileSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Student not found.", {
      userMessage: "포인트를 수정할 학생을 찾지 못했습니다.",
    });
  }

  const studentMemberData = studentMemberSnap.exists ? (studentMemberSnap.data() as Record<string, unknown>) : {};
  const studentProfileData = studentProfileSnap.exists ? (studentProfileSnap.data() as Record<string, unknown>) : {};
  const targetRole = normalizeMembershipRoleValue(studentMemberData.role);
  if (targetRole && targetRole !== "student") {
    throw new functions.https.HttpsError("failed-precondition", "Target member is not a student.", {
      userMessage: "학생 계정에만 포인트를 수정할 수 있습니다.",
    });
  }

  const studentName =
    asTrimmedString(studentMemberData.displayName)
    || asTrimmedString(studentProfileData.name)
    || asTrimmedString(studentProfileData.displayName)
    || "학생";
  const adminName = asTrimmedString((context.auth.token as Record<string, unknown>).name) || "센터관리자";
  const direction = deltaPoints > 0 ? "add" : "subtract";
  const label = direction === "add" ? "관리자 포인트 추가" : "관리자 포인트 차감";
  const progressRef = db.doc(`centers/${centerId}/growthProgress/${studentId}`);
  const logRef = db.collection(`centers/${centerId}/pointAdjustmentLogs`).doc();
  const eventCreatedAt = new Date().toISOString();

  const result = await db.runTransaction(async (transaction) => {
    const progressSnap = await transaction.get(progressRef);
    const progressData = progressSnap.exists ? (progressSnap.data() as Record<string, unknown>) : {};
    const dailyPointStatus = isPlainObject(progressData.dailyPointStatus)
      ? (progressData.dailyPointStatus as Record<string, unknown>)
      : {};
    const currentDayStatus = isPlainObject(dailyPointStatus[dateKey])
      ? (dailyPointStatus[dateKey] as Record<string, unknown>)
      : {};
    const currentBalance = Math.max(0, Math.floor(parseFiniteNumber(progressData.pointsBalance) ?? 0));
    const currentTotalEarned = Math.max(0, Math.floor(parseFiniteNumber(progressData.totalPointsEarned) ?? 0));
    const currentDailyAmount = Math.floor(parseFiniteNumber(currentDayStatus.dailyPointAmount) ?? 0);
    const currentManualAdjustment = Math.round(parseFiniteNumber(currentDayStatus.manualAdjustmentPoints) ?? 0);

    if (deltaPoints < 0 && currentBalance < absPoints) {
      throw new functions.https.HttpsError("failed-precondition", "Insufficient point balance.", {
        userMessage: "보유 포인트보다 크게 차감할 수 없습니다.",
      });
    }
    if (currentTotalEarned + deltaPoints < 0) {
      throw new functions.https.HttpsError("failed-precondition", "Total earned points cannot be negative.", {
        userMessage: "누적 포인트가 음수가 되도록 차감할 수 없습니다.",
      });
    }

    const nextBalance = currentBalance + deltaPoints;
    const nextTotalEarned = currentTotalEarned + deltaPoints;
    const nextDailyAmount = currentDailyAmount + deltaPoints;
    const nextManualAdjustment = currentManualAdjustment + deltaPoints;
    const nextPointEvents = upsertDailyPointEvent(currentDayStatus.pointEvents, {
      id: `manual_adjustment:${dateKey}:${logRef.id}`,
      source: "manual_adjustment",
      label,
      points: absPoints,
      deltaPoints,
      direction,
      reason,
      createdAt: eventCreatedAt,
    });

    transaction.set(progressRef, {
      pointsBalance: nextBalance,
      totalPointsEarned: nextTotalEarned,
      dailyPointStatus: {
        [dateKey]: {
          ...currentDayStatus,
          dailyPointAmount: nextDailyAmount,
          manualAdjustmentPoints: nextManualAdjustment,
          pointEvents: nextPointEvents,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    transaction.set(logRef, {
      centerId,
      studentId,
      studentName,
      dateKey,
      deltaPoints,
      points: absPoints,
      direction,
      reason,
      beforePointsBalance: currentBalance,
      afterPointsBalance: nextBalance,
      beforeTotalPointsEarned: currentTotalEarned,
      afterTotalPointsEarned: nextTotalEarned,
      beforeDailyPointAmount: currentDailyAmount,
      afterDailyPointAmount: nextDailyAmount,
      adjustedBy: authUid,
      adjustedByName: adminName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      ok: true,
      adjustmentId: logRef.id,
      studentId,
      dateKey,
      deltaPoints,
      pointsBalance: nextBalance,
      totalPointsEarned: nextTotalEarned,
      dailyPointAmount: nextDailyAmount,
    };
  });

  return result;
});

export const adjustStudentPenaltyBalanceSecure = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const authUid = context.auth.uid;
  const centerId = asTrimmedString(data?.centerId);
  const studentId = asTrimmedString(data?.studentId);
  const dateKey = asTrimmedString(data?.dateKey, toDateKey(toKstDate()));
  const deltaPoints = Math.round(parseFiniteNumber(data?.deltaPoints) ?? Number.NaN);
  const reason = asTrimmedString(data?.reason).slice(0, 160);
  const absPoints = Math.abs(deltaPoints);

  if (!centerId || !studentId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId/studentId is required.", {
      userMessage: "벌점을 조정할 학생 정보를 다시 확인해 주세요.",
    });
  }
  if (!isValidDateKey(dateKey)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid dateKey.", {
      userMessage: "벌점 조정 일자를 다시 확인해 주세요.",
    });
  }
  if (!Number.isFinite(deltaPoints) || deltaPoints === 0 || absPoints < 1 || absPoints > 1000) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid penalty delta.", {
      userMessage: "벌점은 1~1,000 사이의 숫자로 입력해 주세요.",
    });
  }
  if (reason.length < 2) {
    throw new functions.https.HttpsError("invalid-argument", "Reason is required.", {
      userMessage: "벌점 조정 사유를 입력해 주세요.",
    });
  }

  const membership = await resolveCenterMembershipRole(db, centerId, authUid);
  if (!membership.role || !isAdminRole(membership.role) || !isActiveMembershipStatus(membership.status)) {
    throw new functions.https.HttpsError("permission-denied", "Only center admins can adjust student penalties.", {
      userMessage: "센터 관리자만 학생 벌점을 조정할 수 있습니다.",
    });
  }

  const [studentMemberSnap, studentProfileSnap] = await Promise.all([
    db.doc(`centers/${centerId}/members/${studentId}`).get(),
    db.doc(`centers/${centerId}/students/${studentId}`).get(),
  ]);
  if (!studentMemberSnap.exists && !studentProfileSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Student not found.", {
      userMessage: "벌점을 조정할 학생을 찾지 못했습니다.",
    });
  }

  const studentMemberData = studentMemberSnap.exists ? (studentMemberSnap.data() as Record<string, unknown>) : {};
  const studentProfileData = studentProfileSnap.exists ? (studentProfileSnap.data() as Record<string, unknown>) : {};
  const targetRole = normalizeMembershipRoleValue(studentMemberData.role);
  if (targetRole && targetRole !== "student") {
    throw new functions.https.HttpsError("failed-precondition", "Target member is not a student.", {
      userMessage: "학생 계정에만 벌점을 조정할 수 있습니다.",
    });
  }

  const studentName =
    asTrimmedString(studentMemberData.displayName)
    || asTrimmedString(studentMemberData.name)
    || asTrimmedString(studentProfileData.name)
    || asTrimmedString(studentProfileData.displayName)
    || "학생";
  const adminName = asTrimmedString((context.auth.token as Record<string, unknown>).name) || "센터관리자";
  const direction = deltaPoints > 0 ? "add" : "subtract";
  const label = direction === "add" ? "관리자 벌점 부여" : "관리자 벌점 삭감";
  const progressRef = db.doc(`centers/${centerId}/growthProgress/${studentId}`);
  const adjustmentLogRef = db.collection(`centers/${centerId}/penaltyAdjustmentLogs`).doc();
  const penaltyLogRef = db.collection(`centers/${centerId}/penaltyLogs`).doc(`manual_adjustment_${adjustmentLogRef.id}`);

  const result = await db.runTransaction(async (transaction) => {
    const progressSnap = await transaction.get(progressRef);
    const progressData = progressSnap.exists ? (progressSnap.data() as Record<string, unknown>) : {};
    const currentPenaltyPoints = Math.max(0, Math.floor(parseFiniteNumber(progressData.penaltyPoints) ?? 0));

    if (deltaPoints < 0 && currentPenaltyPoints < absPoints) {
      throw new functions.https.HttpsError("failed-precondition", "Insufficient penalty points.", {
        userMessage: "현재 벌점보다 크게 삭감할 수 없습니다.",
      });
    }

    const nextPenaltyPoints = currentPenaltyPoints + deltaPoints;

    transaction.set(progressRef, {
      penaltyPoints: nextPenaltyPoints,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    transaction.set(penaltyLogRef, {
      centerId,
      studentId,
      studentName,
      pointsDelta: deltaPoints,
      points: absPoints,
      reason,
      source: "manual_adjustment",
      direction,
      label,
      penaltyDateKey: dateKey,
      createdByUserId: authUid,
      createdByName: adminName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    transaction.set(adjustmentLogRef, {
      centerId,
      studentId,
      studentName,
      dateKey,
      deltaPoints,
      points: absPoints,
      direction,
      reason,
      beforePenaltyPoints: currentPenaltyPoints,
      afterPenaltyPoints: nextPenaltyPoints,
      penaltyLogId: penaltyLogRef.id,
      adjustedBy: authUid,
      adjustedByName: adminName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      ok: true,
      adjustmentId: adjustmentLogRef.id,
      penaltyLogId: penaltyLogRef.id,
      studentId,
      dateKey,
      deltaPoints,
      penaltyPoints: nextPenaltyPoints,
    };
  });

  return result;
});

export const applyPenaltyEventSecure = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }
  const authUid = context.auth.uid;

  const centerId = asTrimmedString(data?.centerId);
  const requestedStudentId = asTrimmedString(data?.studentId);
  const source = asTrimmedString(data?.source) as "manual" | "routine_missing";
  const penaltyDateKey = asTrimmedString(data?.penaltyDateKey);
  const reasonInput = asTrimmedString(data?.reason);

  if (!centerId || !requestedStudentId) {
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
  const penaltyKey = asTrimmedString(data?.penaltyKey, expectedPenaltyKey);
  if (penaltyKey !== expectedPenaltyKey) {
    throw new functions.https.HttpsError("invalid-argument", "Unexpected penaltyKey.", {
      userMessage: "벌점 키가 올바르지 않습니다.",
    });
  }

  const expectedPointsDelta = SECURE_PENALTY_SOURCE_POINTS[source];
  const requestedPointsDelta = Math.round(parseFiniteNumber(data?.pointsDelta) ?? Number.NaN);
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
  if (membership.role !== "student" && membership.role !== "teacher" && !isAdminRole(membership.role)) {
    throw new functions.https.HttpsError("permission-denied", "Unsupported membership role.", {
      userMessage: "현재 계정 권한으로는 벌점을 반영할 수 없습니다.",
    });
  }

  const callerIdentity = membership.role === "student"
    ? await resolveCenterStudentIdentity(db, centerId, authUid)
    : null;
  const studentId = membership.role === "student"
    ? (callerIdentity?.studentId || authUid)
    : requestedStudentId;

  if (membership.role === "student" && requestedStudentId !== studentId && requestedStudentId !== authUid) {
    throw new functions.https.HttpsError("permission-denied", "Students can only apply self penalties.", {
      userMessage: "본인에게만 벌점을 반영할 수 있습니다.",
    });
  }

  const [targetMemberSnap, targetStudentSnap, callerMemberSnap] = await Promise.all([
    db.doc(`centers/${centerId}/members/${studentId}`).get(),
    db.doc(`centers/${centerId}/students/${studentId}`).get(),
    db.doc(`centers/${centerId}/members/${authUid}`).get(),
  ]);

  const targetMemberData = callerIdentity?.memberData || (targetMemberSnap.exists ? (targetMemberSnap.data() as Record<string, unknown>) : null);
  const targetStudentData = callerIdentity?.studentProfileData || (targetStudentSnap.exists ? (targetStudentSnap.data() as Record<string, unknown>) : null);
  const targetRole = normalizeMembershipRoleValue(targetMemberData?.role);
  if (targetRole && targetRole !== "student") {
    throw new functions.https.HttpsError("failed-precondition", "Target membership is not a student.", {
      userMessage: "학생 계정에만 벌점을 반영할 수 있습니다.",
    });
  }
  if (!targetMemberSnap.exists && !targetStudentSnap.exists && !callerIdentity) {
    throw new functions.https.HttpsError("failed-precondition", "Target student not found.", {
      userMessage: "학생 정보를 찾지 못했습니다.",
    });
  }

  const studentName = asTrimmedString(
    targetMemberData?.displayName || targetMemberData?.name || targetStudentData?.displayName || targetStudentData?.name,
    "학생"
  );
  const callerMemberData = callerMemberSnap.exists ? (callerMemberSnap.data() as Record<string, unknown>) : null;
  const callerFallbackName = membership.role === "student" ? "학생" : membership.role === "teacher" ? "선생님" : "운영자";
  const createdByName = asTrimmedString(
    callerMemberData?.displayName || callerMemberData?.name || context.auth.token.name,
    callerFallbackName
  );

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

    transaction.set(
      progressRef,
      {
        penaltyPoints: admin.firestore.FieldValue.increment(expectedPointsDelta),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(
      penaltyLogRef,
      {
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
      },
      { merge: true }
    );

    return true;
  });

  return {
    applied,
    duplicate: !applied,
    penaltyLogId,
    penaltyPointsDelta: expectedPointsDelta,
  };
});

export const submitAttendanceRequestSecure = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }
  const authUid = context.auth.uid;

  const centerId = asTrimmedString(data?.centerId);
  const requestType = asTrimmedString(data?.requestType) as "late" | "absence" | "schedule_change";
  const requestDate = asTrimmedString(data?.requestDate);
  const reason = asTrimmedString(data?.reason);
  const reasonCategory = asTrimmedString(data?.reasonCategory) as
    | "disaster"
    | "emergency"
    | "surgery"
    | "hospital"
    | "other"
    | "";
  const requestedArrivalTime = asTrimmedString(data?.requestedArrivalTime);
  const requestedDepartureTime = asTrimmedString(data?.requestedDepartureTime);
  const requestedAcademyName = asTrimmedString(data?.requestedAcademyName);
  const requestedAcademyStartTime = asTrimmedString(data?.requestedAcademyStartTime);
  const requestedAcademyEndTime = asTrimmedString(data?.requestedAcademyEndTime);
  const scheduleChangeAction = asTrimmedString(data?.scheduleChangeAction) as "save" | "absent" | "reset" | "";
  const classScheduleId = asTrimmedString(data?.classScheduleId);
  const classScheduleName = asTrimmedString(data?.classScheduleName);
  const parentContactConfirmed = Boolean(data?.parentContactConfirmed);

  if (!centerId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId is required.", {
      userMessage: "센터 정보가 누락되었습니다.",
    });
  }
  if (requestType !== "late" && requestType !== "absence" && requestType !== "schedule_change") {
    throw new functions.https.HttpsError("invalid-argument", "requestType is invalid.", {
      userMessage: "출결 신청 유형이 올바르지 않습니다.",
    });
  }
  if (!isValidDateKey(requestDate)) {
    throw new functions.https.HttpsError("invalid-argument", "requestDate is required.", {
      userMessage: "요청 날짜를 선택해 주세요.",
    });
  }
  if (requestType === "schedule_change") {
    if (!ATTENDANCE_REQUEST_REASON_CATEGORIES.has(reasonCategory)) {
      throw new functions.https.HttpsError("invalid-argument", "reasonCategory is invalid.", {
        userMessage: "당일 변경 사유 유형을 다시 선택해 주세요.",
      });
    }
    if (scheduleChangeAction !== "save" && scheduleChangeAction !== "absent" && scheduleChangeAction !== "reset") {
      throw new functions.https.HttpsError("invalid-argument", "scheduleChangeAction is invalid.", {
        userMessage: "변경 유형을 다시 확인해 주세요.",
      });
    }
    if (reason.length < 5) {
      throw new functions.https.HttpsError("invalid-argument", "Reason is too short.", {
        userMessage: "변경 사유는 5자 이상 입력해 주세요.",
      });
    }

    const todayDateKey = toDateKey(toKstDate(new Date()));
    if (requestDate !== todayDateKey) {
      throw new functions.https.HttpsError("failed-precondition", "Schedule change requests are same-day only.", {
        userMessage: "당일 등하원 변경만 이 신청서로 접수할 수 있습니다.",
      });
    }
    if (scheduleChangeAction === "save") {
      if (!requestedArrivalTime || !requestedDepartureTime) {
        throw new functions.https.HttpsError("invalid-argument", "Requested arrival/departure time is required.", {
          userMessage: "등원 예정 시간과 하원 예정 시간을 모두 입력해 주세요.",
        });
      }
      const arrivalMinutes = parseTimeToMinutes(requestedArrivalTime);
      const departureMinutes = parseTimeToMinutes(requestedDepartureTime);
      if (!Number.isFinite(arrivalMinutes) || !Number.isFinite(departureMinutes) || arrivalMinutes >= departureMinutes) {
        throw new functions.https.HttpsError("invalid-argument", "Requested arrival/departure time is invalid.", {
          userMessage: "등원 예정 시간은 하원 예정 시간보다 빨라야 합니다.",
        });
      }
      if (requestedAcademyStartTime || requestedAcademyEndTime) {
        if (!requestedAcademyStartTime || !requestedAcademyEndTime) {
          throw new functions.https.HttpsError("invalid-argument", "Academy time is incomplete.", {
            userMessage: "학원 시작 시간과 종료 시간을 모두 입력해 주세요.",
          });
        }
        const academyStartMinutes = parseTimeToMinutes(requestedAcademyStartTime);
        const academyEndMinutes = parseTimeToMinutes(requestedAcademyEndTime);
        if (!Number.isFinite(academyStartMinutes) || !Number.isFinite(academyEndMinutes) || academyStartMinutes >= academyEndMinutes) {
          throw new functions.https.HttpsError("invalid-argument", "Academy time is invalid.", {
            userMessage: "학원 시작 시간은 종료 시간보다 빨라야 합니다.",
          });
        }
        if (academyStartMinutes < arrivalMinutes || academyEndMinutes > departureMinutes) {
          throw new functions.https.HttpsError("invalid-argument", "Academy time is outside attendance range.", {
            userMessage: "학원 시간은 등원부터 하원 사이에서만 등록할 수 있습니다.",
          });
        }
      }
    }
  } else if (reason.length < 10) {
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

  const studentIdentity = await resolveCenterStudentIdentity(db, centerId, authUid);
  if (!studentIdentity) {
    throw new functions.https.HttpsError("failed-precondition", "Student profile not found.", {
      userMessage: "학생 정보를 찾지 못했습니다.",
    });
  }

  const studentId = studentIdentity.studentId;
  const studentMemberData = studentIdentity.memberData;
  const studentProfileData = studentIdentity.studentProfileData;
  const studentName = asTrimmedString(
    studentMemberData?.displayName || studentMemberData?.name || studentProfileData?.displayName || studentProfileData?.name || context.auth.token.name,
    "학생"
  );
  const uploadedAt = admin.firestore.Timestamp.now();
  const proofAttachments = requestType === "schedule_change"
    ? normalizeAttendanceRequestProofAttachments({
        attachments: data?.proofAttachments,
        centerId,
        studentId,
        uploadedAt,
      })
    : [];
  const penaltyPointsDelta = ATTENDANCE_REQUEST_PENALTY_POINTS[requestType];
  const penaltyShouldBeWaived = requestType === "schedule_change"
    ? shouldWaiveSameDayScheduleChangePenalty(reasonCategory, proofAttachments.length, parentContactConfirmed)
    : false;
  const penaltyKey = requestType === "schedule_change" ? `same_day_routine:${requestDate}` : "";
  const penaltyDateKey = requestType === "schedule_change" ? requestDate : "";
  const requestRef = db.collection(`centers/${centerId}/attendanceRequests`).doc();
  const penaltyLogRef = requestType === "schedule_change"
    ? db.doc(`centers/${centerId}/penaltyLogs/${buildPenaltyEventLogId(studentId, "attendance_request", `schedule_change:${requestDate}`)}`)
    : db.doc(`centers/${centerId}/penaltyLogs/attendance_request_${requestRef.id}`);
  const progressRef = db.doc(`centers/${centerId}/growthProgress/${studentId}`);
  const existingSameDayPenaltyLog = requestType === "schedule_change" && !penaltyShouldBeWaived
    ? await findExistingPenaltyEventLog({
        db,
        centerId,
        studentId,
        source: "manual",
        penaltyKey,
        penaltyDateKey,
      })
    : null;

  let penaltyApplied = false;
  let duplicatePenalty = false;

  await db.runTransaction(async (transaction) => {
    const existingPenaltySnap = requestType === "schedule_change" && !penaltyShouldBeWaived
      ? await transaction.get(penaltyLogRef)
      : null;
    penaltyApplied = requestType !== "schedule_change" || (!penaltyShouldBeWaived && !existingSameDayPenaltyLog && !existingPenaltySnap?.exists);
    duplicatePenalty = requestType === "schedule_change" && !penaltyShouldBeWaived && (Boolean(existingSameDayPenaltyLog) || Boolean(existingPenaltySnap?.exists));

    transaction.set(requestRef, {
      studentId,
      studentName,
      centerId,
      type: requestType,
      date: requestDate,
      reason,
      reasonCategory: reasonCategory || null,
      status: "requested",
      penaltyApplied: requestType === "schedule_change" ? !penaltyShouldBeWaived : true,
      penaltyPointsDelta: penaltyApplied ? penaltyPointsDelta : 0,
      penaltyWaived: requestType === "schedule_change" ? penaltyShouldBeWaived : false,
      proofRequired: requestType === "schedule_change" ? reasonCategory === "hospital" && proofAttachments.length === 0 : false,
      parentContactRequired: requestType === "schedule_change" ? reasonCategory === "hospital" && !parentContactConfirmed : false,
      parentContactConfirmed: requestType === "schedule_change" ? parentContactConfirmed : false,
      proofAttachments,
      requestedArrivalTime: requestedArrivalTime || null,
      requestedDepartureTime: requestedDepartureTime || null,
      requestedAcademyName: requestedAcademyName || null,
      requestedAcademyStartTime: requestedAcademyStartTime || null,
      requestedAcademyEndTime: requestedAcademyEndTime || null,
      scheduleChangeAction: scheduleChangeAction || null,
      classScheduleId: classScheduleId || null,
      classScheduleName: classScheduleName || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (penaltyApplied) {
      transaction.set(
        progressRef,
        {
          penaltyPoints: admin.firestore.FieldValue.increment(penaltyPointsDelta),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    if (penaltyApplied) {
      const requestTypeLabel = requestType === "absence"
        ? "결석"
        : requestType === "late"
          ? "지각"
          : "당일 등하원 변경";
      const reasonLabel = requestType === "schedule_change"
        ? ATTENDANCE_REQUEST_REASON_LABELS[reasonCategory as "disaster" | "emergency" | "surgery" | "hospital" | "other"]
        : requestTypeLabel;
      transaction.set(
        penaltyLogRef,
        {
          centerId,
          studentId,
          studentName,
          pointsDelta: penaltyPointsDelta,
          reason: requestType === "schedule_change"
            ? `${requestTypeLabel} - ${reasonLabel} - ${reason}`
            : `${requestTypeLabel} 신청 - ${reason}`,
          source: "attendance_request",
          requestId: requestRef.id,
          requestType,
          penaltyKey: penaltyKey || null,
          penaltyDateKey: penaltyDateKey || null,
          createdByUserId: authUid,
          createdByName: studentName,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  });

  return {
    ok: true,
    requestId: requestRef.id,
    penaltyLogId: existingSameDayPenaltyLog?.id || (penaltyApplied ? penaltyLogRef.id : undefined),
    penaltyPointsDelta: penaltyApplied ? penaltyPointsDelta : 0,
    penaltyApplied,
    penaltyWaived: requestType === "schedule_change" ? penaltyShouldBeWaived : false,
    duplicatePenalty,
  };
});

export const claimPlannerCompletionRewardSecure = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }
  const authUid = context.auth.uid;

  const centerId = asTrimmedString(data?.centerId);
  const dateKey = asTrimmedString(data?.dateKey);
  const taskId = asTrimmedString(data?.taskId);

  if (!centerId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId is required.", {
      userMessage: "센터 정보를 다시 확인해 주세요.",
    });
  }
  if (!isValidDateKey(dateKey)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid dateKey.", {
      userMessage: "계획 날짜 정보가 올바르지 않습니다.",
    });
  }
  if (dateKey !== toDateKey(toKstDate())) {
    throw new functions.https.HttpsError("failed-precondition", "Planner rewards can only be claimed for today.", {
      userMessage: "계획 완료 포인트는 해당 날짜 당일에만 적립할 수 있습니다.",
    });
  }
  if (!taskId) {
    throw new functions.https.HttpsError("invalid-argument", "taskId is required.", {
      userMessage: "완료한 계획 정보를 다시 확인해 주세요.",
    });
  }

  const membership = await resolveCenterMembershipRole(db, centerId, authUid);
  if (membership.role !== "student" || !isActiveMembershipStatus(membership.status)) {
    throw new functions.https.HttpsError("permission-denied", "Only active students can claim planner rewards.", {
      userMessage: "학생 본인만 계획 완료 포인트를 적립할 수 있습니다.",
    });
  }

  const studentIdentity = await resolveCenterStudentIdentity(db, centerId, authUid);
  if (!studentIdentity) {
    throw new functions.https.HttpsError("failed-precondition", "Student profile not found.", {
      userMessage: "학생 정보를 찾지 못했습니다.",
    });
  }

  const studentId = studentIdentity.studentId;
  const weekKey = getPlannerWeekKeyFromDateKey(dateKey);
  if (!weekKey) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid planner week key.", {
      userMessage: "계획 주차 정보가 올바르지 않습니다.",
    });
  }

  const planItemRef = db.doc(`centers/${centerId}/plans/${studentId}/weeks/${weekKey}/items/${taskId}`);
  const progressRef = db.doc(`centers/${centerId}/growthProgress/${studentId}`);
  const eventCreatedAt = new Date().toISOString();

  const result = await db.runTransaction(async (transaction) => {
    const [planItemSnap, progressSnap] = await Promise.all([
      transaction.get(planItemRef),
      transaction.get(progressRef),
    ]);
    const progressData = progressSnap.exists ? (progressSnap.data() as Record<string, unknown>) : {};
    const dailyPointStatus = isPlainObject(progressData.dailyPointStatus)
      ? (progressData.dailyPointStatus as Record<string, unknown>)
      : {};
    const currentDayStatus = isPlainObject(dailyPointStatus[dateKey])
      ? (dailyPointStatus[dateKey] as Record<string, unknown>)
      : {};
    const rewardedTaskIds = normalizePlannerCompletionRewardTaskIds(currentDayStatus.planCompletionRewardTaskIds);
    const currentRewardCount = Math.max(
      rewardedTaskIds.length,
      Math.max(0, Math.floor(parseFiniteNumber(currentDayStatus.planCompletionRewardCount) ?? 0))
    );
    const currentPointsBalance = Math.max(0, Math.floor(parseFiniteNumber(progressData.pointsBalance) ?? 0));
    const currentTotalPointsEarned = Math.max(0, Math.floor(parseFiniteNumber(progressData.totalPointsEarned) ?? 0));

    const planItemData = planItemSnap.exists ? (planItemSnap.data() as Record<string, unknown>) : null;
    const planItemDateKey = asTrimmedString(planItemData?.dateKey);
    const planItemCategory = asTrimmedString(planItemData?.category);
    const isEligibleStudyTask =
      Boolean(planItemData) &&
      planItemDateKey === dateKey &&
      (planItemCategory === "" || planItemCategory === "study") &&
      planItemData?.done === true;

    if (!isEligibleStudyTask) {
      return {
        awarded: false,
        duplicate: false,
        dailyLimitReached: false,
        ineligible: true,
        awardedPoints: 0,
        rewardCount: currentRewardCount,
        pointsBalance: currentPointsBalance,
        totalPointsEarned: currentTotalPointsEarned,
      };
    }

    if (rewardedTaskIds.includes(taskId)) {
      return {
        awarded: false,
        duplicate: true,
        dailyLimitReached: false,
        ineligible: false,
        awardedPoints: 0,
        rewardCount: currentRewardCount,
        pointsBalance: currentPointsBalance,
        totalPointsEarned: currentTotalPointsEarned,
      };
    }

    if (currentRewardCount >= PLANNER_COMPLETION_DAILY_REWARD_LIMIT) {
      return {
        awarded: false,
        duplicate: false,
        dailyLimitReached: true,
        ineligible: false,
        awardedPoints: 0,
        rewardCount: currentRewardCount,
        pointsBalance: currentPointsBalance,
        totalPointsEarned: currentTotalPointsEarned,
      };
    }

    const awardClamp = clampDailyPointAward(currentDayStatus, PLANNER_COMPLETION_REWARD_POINTS);
    const awardedPoints = awardClamp.awardedPoints;
    const nextRewardedTaskIds = normalizePlannerCompletionRewardTaskIds([...rewardedTaskIds, taskId]);
    const nextRewardCount = nextRewardedTaskIds.length;
    const nextPointEvents = awardedPoints > 0
      ? upsertDailyPointEvent(currentDayStatus.pointEvents, {
          id: `plan_completion:${dateKey}:${taskId}`,
          source: "plan_completion",
          label: "계획 완수",
          points: awardedPoints,
          createdAt: eventCreatedAt,
        })
      : normalizeDailyPointEvents(currentDayStatus.pointEvents);

    transaction.set(
      progressRef,
      {
        pointsBalance: admin.firestore.FieldValue.increment(awardedPoints),
        totalPointsEarned: admin.firestore.FieldValue.increment(awardedPoints),
        dailyPointStatus: {
          [dateKey]: {
            ...currentDayStatus,
            planCompletionRewardTaskIds: nextRewardedTaskIds,
            planCompletionRewardCount: nextRewardCount,
            pointEvents: nextPointEvents,
            dailyPointAmount: admin.firestore.FieldValue.increment(awardedPoints),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      awarded: awardedPoints > 0,
      duplicate: false,
      dailyLimitReached: false,
      ineligible: false,
      awardedPoints,
      rewardCount: nextRewardCount,
      pointsBalance: currentPointsBalance + awardedPoints,
      totalPointsEarned: currentTotalPointsEarned + awardedPoints,
    };
  });

  return {
    ok: true,
    ...result,
    rewardLimit: PLANNER_COMPLETION_DAILY_REWARD_LIMIT,
  };
});

export const openStudyRewardBoxSecure = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }
  const authUid = context.auth.uid;

  const centerId = asTrimmedString(data?.centerId);
  const dateKey = asTrimmedString(data?.dateKey);
  const hour = Math.round(parseFiniteNumber(data?.hour) ?? Number.NaN);

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

  const studentIdentity = await resolveCenterStudentIdentity(db, centerId, authUid);
  if (!studentIdentity) {
    throw new functions.https.HttpsError("failed-precondition", "Student profile not found.", {
      userMessage: "학생 정보를 찾지 못했습니다.",
    });
  }

  const studentId = studentIdentity.studentId;
  const studyDayRef = db.doc(`centers/${centerId}/studyLogs/${studentId}/days/${dateKey}`);
  const progressRef = db.doc(`centers/${centerId}/growthProgress/${studentId}`);

  const [studyDaySnap, attendanceSnap, progressSnap, sessionsSnap] = await Promise.all([
    studyDayRef.get(),
    db.collection(`centers/${centerId}/attendanceCurrent`).where("studentId", "==", studentId).limit(10).get(),
    progressRef.get(),
    studyDayRef.collection("sessions").orderBy("startTime", "asc").get(),
  ]);

  const studyDayData = (studyDaySnap.data() || {}) as Record<string, unknown>;
  const persistedBaseDayMinutes = Math.max(
    0,
    Math.floor(
      parseFiniteNumber(studyDayData.totalMinutes)
      ?? parseFiniteNumber(studyDayData.totalStudyMinutes)
      ?? 0
    )
  );
  const persistedAdjustmentMinutes = Math.floor(parseFiniteNumber(studyDayData.manualAdjustmentMinutes) ?? 0);
  const persistedDayMinutes = Math.max(0, persistedBaseDayMinutes + persistedAdjustmentMinutes);
  const nowMs = Date.now();
  const nowDate = new Date(nowMs);
  const currentStudyDayKey = toStudyDayKey(nowDate);
  const isCarryoverDate = dateKey !== currentStudyDayKey;
  if (isCarryoverDate && hasStudyBoxCarryoverExpired(dateKey, nowDate)) {
    throw new functions.https.HttpsError("failed-precondition", "Study box carryover expired.", {
      userMessage: "전날 상자는 새벽 1시 30분까지만 열 수 있습니다. 오늘 상자를 새로 모아 주세요.",
    });
  }
  const { startMs: studyDayStartMs, endMs: studyDayEndMs } = getStudyDayWindowBounds(dateKey);
  let liveSessionDurationSeconds = 0;
  let liveSessionStartMs = 0;

  if (dateKey === currentStudyDayKey && !attendanceSnap.empty) {
    const preferredAttendanceDoc = pickPreferredAttendanceSeatDoc(attendanceSnap.docs);
    const attendanceData = preferredAttendanceDoc?.data() as Record<string, unknown> | undefined;
    const attendanceStatus = asTrimmedString(attendanceData?.status);
    const liveStartedAtMs = toMillisSafe(attendanceData?.lastCheckInAt);

    if (
      ACTIVE_STUDY_ATTENDANCE_STATUSES.has(attendanceStatus) &&
      liveStartedAtMs > 0 &&
      Number.isFinite(studyDayStartMs) &&
      nowMs > liveStartedAtMs
    ) {
      const overlapMs = getTimeRangeOverlapMs(liveStartedAtMs, nowMs, studyDayStartMs, studyDayEndMs);
      if (overlapMs > 0) {
        liveSessionStartMs = Math.max(liveStartedAtMs, studyDayStartMs);
        liveSessionDurationSeconds = Math.max(0, Math.floor(overlapMs / SECOND_MS));
      }
    }
  }

  const effectiveDaySeconds = Math.max(0, persistedDayMinutes * 60 + liveSessionDurationSeconds);
  const earnedHours = Math.min(8, Math.floor(effectiveDaySeconds / 3600));
  const preExistingProgress = progressSnap.exists ? (progressSnap.data() as Record<string, unknown>) : {};
  const preExistingDailyPointStatus = isPlainObject(preExistingProgress.dailyPointStatus)
    ? (preExistingProgress.dailyPointStatus as Record<string, unknown>)
    : {};
  const preExistingDayStatus = isPlainObject(preExistingDailyPointStatus[dateKey])
    ? (preExistingDailyPointStatus[dateKey] as Record<string, unknown>)
    : {};
  const preExistingClaimedStudyBoxes = normalizeStudyBoxHoursFromUnknown(preExistingDayStatus.claimedStudyBoxes);
  const preExistingOpenedStudyBoxes = resolveOpenedStudyBoxHoursFromDayStatus(preExistingDayStatus);
  const hasClaimedBoxRecord = preExistingClaimedStudyBoxes.includes(hour);
  const alreadyOpenedByRecord = preExistingOpenedStudyBoxes.includes(hour);
  const canOpenCarryoverByRecord = isCarryoverDate && hasClaimedBoxRecord;

  if (!alreadyOpenedByRecord && !canOpenCarryoverByRecord && earnedHours < hour) {
    throw new functions.https.HttpsError("failed-precondition", "Study time milestone not reached.", {
      userMessage: "아직 이 상자를 열 수 있는 공부시간이 채워지지 않았습니다.",
    });
  }

  const baseReward = buildDeterministicStudyBoxReward({
    centerId,
    studentId,
    dateKey,
    milestone: hour,
  });
  const earnedAtMs = resolveStudyBoxMilestoneEarnedAtMs({
    milestone: hour,
    persistedDayMinutes,
    sessionDocs: sessionsSnap.docs,
    liveSessionStartMs,
    liveSessionDurationSeconds,
  });
  let boostMultiplier = 1;
  let boostEventId: string | null = null;

  if (earnedAtMs) {
    const pointBoostDocs = await listPointBoostEventDocs(db, centerId);
    const matchedBoostDoc = pointBoostDocs.find((docSnap) => isPointBoostEventActiveAt(docSnap.data(), earnedAtMs)) ?? null;
    const matchedBoostEvent = matchedBoostDoc?.data() as PointBoostEventDoc | undefined;
    if (matchedBoostEvent) {
      boostMultiplier = matchedBoostEvent.multiplier;
      boostEventId = matchedBoostDoc?.id ?? null;
    }
  }

  const reward = {
    ...baseReward,
    awardedPoints: Math.max(0, Math.round(baseReward.basePoints * boostMultiplier)),
    multiplier: boostMultiplier,
    earnedAt: earnedAtMs ? new Date(earnedAtMs).toISOString() : null,
    boostEventId,
  };

  const result = await db.runTransaction(async (transaction) => {
    const progressSnap = await transaction.get(progressRef);
    const progressData = progressSnap.exists ? (progressSnap.data() as Record<string, unknown>) : {};
    const dailyPointStatus = isPlainObject(progressData.dailyPointStatus)
      ? (progressData.dailyPointStatus as Record<string, unknown>)
      : {};
    const currentDayStatus = isPlainObject(dailyPointStatus[dateKey])
      ? (dailyPointStatus[dateKey] as Record<string, unknown>)
      : {};

    const openedStudyBoxes = resolveOpenedStudyBoxHoursFromDayStatus(currentDayStatus);
    const claimedStudyBoxes = normalizeStudyBoxHoursFromUnknown(currentDayStatus.claimedStudyBoxes);
    const storedRewardEntries = normalizeStudyBoxRewardEntries(currentDayStatus.studyBoxRewards);
    const storedReward = storedRewardEntries.find((entry) => entry.milestone === hour) ?? null;
    const alreadyOpened = openedStudyBoxes.includes(hour);
    const rewardBase = storedReward ?? baseReward;
    const resolvedReward = alreadyOpened
      ? (storedReward ?? reward)
      : {
          ...rewardBase,
          awardedPoints: Math.max(
            0,
            Math.round(Math.max(0, Math.floor(rewardBase.basePoints)) * boostMultiplier)
          ),
          multiplier: boostMultiplier,
          earnedAt: earnedAtMs ? new Date(earnedAtMs).toISOString() : null,
          boostEventId,
        };
    const awardClamp = alreadyOpened
      ? { currentAwardedTotal: getDailyAwardedPointTotal(currentDayStatus), remainingPoints: 0, awardedPoints: 0 }
      : clampDailyPointAward(currentDayStatus, resolvedReward.awardedPoints);
    const awardedDelta = alreadyOpened ? 0 : awardClamp.awardedPoints;
    const creditedReward = alreadyOpened
      ? resolvedReward
      : {
          ...resolvedReward,
          awardedPoints: awardedDelta,
        };
    const nextOpenedStudyBoxes = normalizeStudyBoxHoursFromUnknown([...openedStudyBoxes, hour]);
    const nextClaimedStudyBoxes = normalizeStudyBoxHoursFromUnknown([...claimedStudyBoxes, hour]);
    const nextRewardEntries = upsertStudyBoxRewardEntries(storedRewardEntries, creditedReward);
    const nextPointEvents = awardedDelta > 0
      ? upsertDailyPointEvent(currentDayStatus.pointEvents, {
          id: `study_box:${dateKey}:${hour}`,
          source: "study_box",
          label: `${hour}시간 상자`,
          points: awardedDelta,
          createdAt: new Date(nowMs).toISOString(),
          hour,
        })
      : normalizeDailyPointEvents(currentDayStatus.pointEvents);
    const currentPointsBalance = Math.max(0, Math.floor(parseFiniteNumber(progressData.pointsBalance) ?? 0));
    const currentTotalPointsEarned = Math.max(0, Math.floor(parseFiniteNumber(progressData.totalPointsEarned) ?? 0));

    transaction.set(
      progressRef,
      {
        pointsBalance: admin.firestore.FieldValue.increment(awardedDelta),
        totalPointsEarned: admin.firestore.FieldValue.increment(awardedDelta),
        dailyPointStatus: {
          [dateKey]: {
            ...currentDayStatus,
            claimedStudyBoxes: nextClaimedStudyBoxes,
            studyBoxRewards: nextRewardEntries,
            openedStudyBoxes: nextOpenedStudyBoxes,
            pointEvents: nextPointEvents,
            dailyPointAmount: admin.firestore.FieldValue.increment(awardedDelta),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

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

function buildExpiredStudyBoxCarryoverStatusUpdate(dayStatus: Record<string, unknown>) {
  const claimedStudyBoxes = normalizeStudyBoxHoursFromUnknown(dayStatus.claimedStudyBoxes);
  if (claimedStudyBoxes.length === 0) return null;

  const openedStudyBoxes = resolveOpenedStudyBoxHoursFromDayStatus(dayStatus);
  const openedHourSet = new Set(openedStudyBoxes);
  const expiredStudyBoxes = claimedStudyBoxes.filter((hour) => !openedHourSet.has(hour));
  if (expiredStudyBoxes.length === 0) return null;

  const retainedClaimedStudyBoxes = normalizeStudyBoxHoursFromUnknown([
    ...claimedStudyBoxes.filter((hour) => openedHourSet.has(hour)),
    ...openedStudyBoxes,
  ]);
  const retainedStudyBoxRewards = normalizeStudyBoxRewardEntries(dayStatus.studyBoxRewards)
    .filter((entry) => openedHourSet.has(entry.milestone));
  const mergedExpiredStudyBoxes = normalizeStudyBoxHoursFromUnknown([
    ...normalizeStudyBoxHoursFromUnknown(dayStatus.expiredStudyBoxes),
    ...expiredStudyBoxes,
  ]);

  return {
    expiredStudyBoxes,
    nextDayStatus: {
      ...dayStatus,
      claimedStudyBoxes: retainedClaimedStudyBoxes,
      openedStudyBoxes,
      studyBoxRewards: retainedStudyBoxRewards,
      expiredStudyBoxes: mergedExpiredStudyBoxes,
      studyBoxCarryoverExpiredAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  };
}

export const scheduledStudyBoxCarryoverExpiry = functions
  .region(region)
  .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
  })
  .pubsub.schedule("30 1 * * *")
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    const db = admin.firestore();
    const expiredDateKey = getExpiredStudyBoxCarryoverDateKey();
    const centersSnap = await db.collection("centers").get();
    let scannedProgressDocs = 0;
    let cleanedProgressDocs = 0;
    let expiredBoxCount = 0;

    for (const centerDoc of centersSnap.docs) {
      const centerId = centerDoc.id;
      const progressSnap = await db.collection(`centers/${centerId}/growthProgress`).get();
      let batch = db.batch();
      let pendingWrites = 0;

      for (const progressDoc of progressSnap.docs) {
        scannedProgressDocs += 1;
        const progressData = progressDoc.data() as Record<string, unknown>;
        const dailyPointStatus = isPlainObject(progressData.dailyPointStatus)
          ? (progressData.dailyPointStatus as Record<string, unknown>)
          : {};
        const dayStatus = isPlainObject(dailyPointStatus[expiredDateKey])
          ? (dailyPointStatus[expiredDateKey] as Record<string, unknown>)
          : null;
        if (!dayStatus) continue;

        const update = buildExpiredStudyBoxCarryoverStatusUpdate(dayStatus);
        if (!update) continue;

        batch.set(progressDoc.ref, {
          dailyPointStatus: {
            [expiredDateKey]: update.nextDayStatus,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        pendingWrites += 1;
        cleanedProgressDocs += 1;
        expiredBoxCount += update.expiredStudyBoxes.length;

        if (pendingWrites >= 400) {
          await batch.commit();
          batch = db.batch();
          pendingWrites = 0;
        }
      }

      if (pendingWrites > 0) {
        await batch.commit();
      }
    }

    functions.logger.info("study box carryover expiry complete", {
      expiredDateKey,
      centerCount: centersSnap.size,
      scannedProgressDocs,
      cleanedProgressDocs,
      expiredBoxCount,
    });

    return null;
  });


export const stopStudentStudySessionSecure = smsDispatcherFunctions.https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }
  const authUid = context.auth.uid;

  const centerId = asTrimmedString(data?.centerId);
  const fallbackStartTimeMs = Math.floor(parseFiniteNumber(data?.fallbackStartTimeMs) ?? 0);
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

  const studentIdentity = await resolveCenterStudentIdentity(db, centerId, authUid);
  if (!studentIdentity) {
    throw new functions.https.HttpsError("failed-precondition", "Student profile not found.", {
      userMessage: "학생 정보를 찾지 못했습니다.",
    });
  }

  const studentId = studentIdentity.studentId;
  const result = await applyAttendanceStatusTransition({
    db,
    centerId,
    studentId,
    nextStatus: "absent",
    source: "student_dashboard",
    actorUid: authUid,
    fallbackStartTimeMs,
  });

  void queueAttendanceTransitionSmsAfterCommit(db, {
    centerId,
    result,
  }).catch((error) => {
    console.error("[attendance-sms-v2] post-stop queue failed", {
      centerId,
      eventId: result.eventId || null,
      eventType: result.eventType || null,
      message: error instanceof Error ? error.message : String(error),
    });
  });

  return {
    ok: true,
    duplicatedSession: result.duplicatedSession,
    sessionId: result.sessionId || undefined,
    sessionDateKey: result.sessionDateKey,
    sessionMinutes: result.sessionMinutes,
    totalMinutesAfterSession: result.totalMinutesAfterSession,
    attendanceAchieved: result.attendanceAchieved,
    bonus6hAchieved: result.bonus6hAchieved,
  };
});

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

export const generateOpenClawSnapshot = functions
  .region(region)
  .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
  })
  .https.onCall(async (data, context) => {
    const db = admin.firestore();

    if (!context.auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const centerId = typeof data?.centerId === "string" ? data.centerId.trim() : "";
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
      const result = await executeOpenClawSnapshotExport({
        db,
        centerId,
        requestedBy: context.auth.uid,
        enableOnRequest: true,
      });
      return {
        ok: true,
        centerId,
        ...result,
      };
    } catch (error) {
      if (error instanceof OpenClawExportInProgressError) {
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

export const scheduledOpenClawSnapshotExport = functions
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
      const integration = integrationSnap.exists ? (integrationSnap.data() as { enabled?: boolean }) : null;
      if (!integration?.enabled) {
        skipped += 1;
        continue;
      }

      try {
        const result = await executeOpenClawSnapshotExport({
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
      } catch (error) {
        if (error instanceof OpenClawExportInProgressError) {
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

export const ensureCurrentUserMemberships = functions
  .region(region)
  .https.onCall(async (_data, context) => {
    const db = admin.firestore();

    if (!context.auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const uid = context.auth.uid;
    const centerRefs = await db.collection("centers").listDocuments();
    const memberDocs = (
      await Promise.all(
        centerRefs.map(async (centerRef) => {
          const directMemberSnap = await centerRef.collection("members").doc(uid).get();
          if (directMemberSnap.exists) {
            return directMemberSnap;
          }

          try {
            const fallbackMemberSnap = await centerRef
              .collection("members")
              .where("id", "==", uid)
              .limit(1)
              .get();

            if (fallbackMemberSnap.docs[0]) {
              return fallbackMemberSnap.docs[0];
            }
          } catch (error) {
            functions.logger.warn("Membership id query failed; scanning center members instead.", {
              centerId: centerRef.id,
              uid,
              error: error instanceof Error ? error.message : String(error),
            });
          }

          const scannedMemberSnap = await centerRef.collection("members").get();
          return (
            scannedMemberSnap.docs.find((docSnap) => {
              const raw = docSnap.data() as Record<string, unknown>;
              return docSnap.id === uid || raw.id === uid;
            }) || null
          );
        })
      )
    ).filter((docSnap): docSnap is FirebaseFirestore.DocumentSnapshot => Boolean(docSnap?.exists));

    const dedupedDocs = Array.from(
      new Map(memberDocs.map((docSnap) => [docSnap.ref.path, docSnap])).values()
    );

    const repairedCenterIds = new Set<string>();

    for (const docSnap of dedupedDocs) {
      const raw = docSnap.data() as Record<string, unknown>;
      const centerId = docSnap.ref.parent.parent?.id;
      if (!centerId) continue;

      const role = normalizeMembershipRoleValue(raw.role) || "student";
      const normalizedStatus = normalizeMembershipStatus(raw.status);
      const status =
        !normalizedStatus || normalizedStatus === "active" || normalizedStatus === "approved" || normalizedStatus === "enabled" || normalizedStatus === "current"
          ? "active"
          : normalizedStatus === "onhold" || normalizedStatus === "pending"
            ? "onHold"
            : normalizedStatus === "withdrawn" || normalizedStatus === "inactive"
              ? "withdrawn"
              : "active";

      const payload: Record<string, unknown> = {
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
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
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

export { scheduledRankingRewardSettlement, reissueDailyRankingRewardV2Secure } from "./rankingRewardSettlement";
export {
  approveGiftishowOrderSecure,
  cancelGiftishowSendFailSecure,
  cancelGiftishowOrderSecure,
  createGiftishowOrderRequestSecure,
  getGiftishowBizmoneySecure,
  reconcilePendingGiftishowOrders,
  rejectGiftishowOrderSecure,
  resendGiftishowOrderSecure,
  saveGiftishowSettingsSecure,
  scheduledGiftishowCatalogSync,
  syncGiftishowCatalogSecure,
} from "./giftishow";

function buildFallbackStudyPlan(profile: Record<string, any>) {
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
    coaching_message:
      "이번 주는 많이 하는 과목과 효율이 낮은 과목이 겹치지 않는지 먼저 점검해보세요. 시작 전 1분 계획, 끝난 뒤 3분 점검만 붙여도 흐름이 훨씬 덜 흔들릴 수 있어요.",
  };
}

export const generateStudyPlan = onCall(
  {
    region,
    secrets: [geminiApiKey],
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const parsedInput = generateStudyPlanInputSchema.safeParse(request.data);
    if (!parsedInput.success) {
      functions.logger.warn("generateStudyPlan invalid input", {
        uid: request.auth.uid,
        issues: parsedInput.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      throw new HttpsError("invalid-argument", "입력값 형식이 올바르지 않습니다.", {
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
    let lastError: unknown = null;

    for (const model of candidateModels) {
      try {
        const rawText = await generateStructuredStudyPlan({
          apiKey,
          prompt,
          model,
        });
        const parsed = JSON.parse(rawText);
        const validated = validateStudyPlanOutput(parsed);
        functions.logger.info("generateStudyPlan success", {
          uid: request.auth.uid,
          model,
          todoCount: validated.daily_todos.length,
        });
        return validated;
      } catch (error) {
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

    return validateStudyPlanOutput(buildFallbackStudyPlan(profile));
  }
);
