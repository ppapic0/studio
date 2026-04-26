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
const MANUAL_PARENT_SMS_UID = "__manual_parent__";
const STUDENT_SMS_FALLBACK_UID = "__student__";
const allowedRoles = ["student", "teacher", "parent", "centerAdmin"] as const;
const adminRoles = new Set(["centerAdmin", "owner", "admin", "centerManager"]);
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
  study_start: `[${TRACK_MANAGED_STUDY_CENTER_NAME}] {studentName} 학생 {time} 공부시작. 오늘 학습 흐름 확인 부탁드립니다.`,
  away_start: `[${TRACK_MANAGED_STUDY_CENTER_NAME}] {studentName} 학생 {time} 외출. 복귀 후 다시 공부를 이어갑니다.`,
  away_end: `[${TRACK_MANAGED_STUDY_CENTER_NAME}] {studentName} 학생 {time} 복귀. 다시 공부를 시작했습니다.`,
  study_end: `[${TRACK_MANAGED_STUDY_CENTER_NAME}] {studentName} 학생 {time} 공부종료. 오늘 학습 마무리했습니다.`,
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
  return Math.max(dailyPointAmount, getLegacyDailyPointAwardTotal(dayStatus));
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
  const segments = splitRangeByStudyDayBoundary(startMs, effectiveEndMs);
  const progressRef = db.doc(`centers/${centerId}/growthProgress/${studentId}`);
  const activeSessionDateKey = toStudyDayKey(new Date(effectiveEndMs));
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
    const daySnapshots = await Promise.all(sessionEntries.map((entry) => transaction.get(entry.dayRef)));
    const sessionSnapshots = await Promise.all(sessionEntries.map((entry) => transaction.get(entry.sessionRef)));
    const progressData = progressSnap.exists ? (progressSnap.data() as Record<string, unknown>) : {};
    const dailyPointStatus = isPlainObject(progressData.dailyPointStatus)
      ? (progressData.dailyPointStatus as Record<string, unknown>)
      : {};

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
      const existingTotalMinutes =
        totalMinutesByDateKey[entry.dateKey] ??
        Math.max(0, Math.floor(parseFiniteNumber(dayData.totalMinutes) ?? 0));

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
  return candidates
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

  const dateKey = asTrimmedString(params.dateKeyOverride) || toDateKey(params.fallbackEventAt);
  const candidates: Date[] = [];
  const addCandidate = (value: unknown) => {
    const candidate = toKstDateFromUnknownTimestamp(value);
    if (!candidate) return;
    if (toDateKey(candidate) !== dateKey) return;
    candidates.push(candidate);
  };

  const [dailyStatSnap, attendanceRecordSnap, attendanceEventsSnap, liveAttendanceSnap] = await Promise.all([
    db.doc(`centers/${params.centerId}/attendanceDailyStats/${dateKey}/students/${params.studentId}`).get(),
    db.doc(`centers/${params.centerId}/attendanceRecords/${dateKey}/students/${params.studentId}`).get(),
    db.collection(`centers/${params.centerId}/attendanceEvents`).where("dateKey", "==", dateKey).get(),
    db.collection(`centers/${params.centerId}/attendanceCurrent`).where("studentId", "==", params.studentId).limit(5).get(),
  ]);

  const dailyStatData = dailyStatSnap.exists ? dailyStatSnap.data() || {} : {};
  const attendanceRecordData = attendanceRecordSnap.exists ? attendanceRecordSnap.data() || {} : {};

  if (eventType === "study_start") {
    addCandidate(dailyStatData.checkInAt);
    addCandidate(attendanceRecordData.checkInAt);
    liveAttendanceSnap.docs.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const status = asTrimmedString(data.status);
      if (ACTIVE_STUDY_ATTENDANCE_STATUSES.has(status)) {
        addCandidate(data.lastCheckInAt);
      }
    });
  }

  if (eventType === "study_end") {
    addCandidate(dailyStatData.checkOutAt);
    addCandidate(attendanceRecordData.checkOutAt);
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
    addCandidate(data.occurredAt || data.createdAt);
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
    daily_report: true,
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
    daily_report: source.daily_report !== false,
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
    ? parentUidsRaw.filter((uid): uid is string => typeof uid === "string" && uid.trim().length > 0)
    : [];

  const recipients: SmsRecipient[] = [];
  const usedPhones = new Set<string>();

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
      usedPhones.add(phoneNumber);
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
    if (!phoneNumber || usedPhones.has(phoneNumber)) continue;

    recipients.push({
      parentUid,
      parentName: (memberData?.displayName as string | null) || (userData?.displayName as string | null) || null,
      phoneNumber,
    });
    usedPhones.add(phoneNumber);
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
    force?: boolean;
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
  const smsEventAt = await resolveAttendanceSmsEventAt(db, {
    centerId,
    studentId,
    eventType,
    fallbackEventAt: eventAt,
  });

  const eventTimeLabel = toTimeLabel(smsEventAt);
  const expectedTimeLabel = expectedTime || "학생이 정한 시간";
  const message = buildParentSmsTemplateMessage(template, {
    studentName,
    time: eventTimeLabel,
    expectedTime: expectedTimeLabel,
    centerName,
  });
  const messageBytes = calculateSmsBytes(message);
  const dedupeKey = buildSmsDedupeKey({
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
  if (params.force) {
    batch.set(dedupeRef, { ...dedupePayload, forcedAt: ts }, { merge: true });
  }

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
      dateKey: toDateKey(smsEventAt),
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
        eventTime: eventTimeLabel,
        expectedTime: expectedTime || null,
      },
    });

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
        suppressedReason: recipient.suppressedReason,
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
        suppressedReason: recipient.suppressedReason,
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

export const onAttendanceEventCreated = functions
  .region(region)
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

    try {
      const eventAt =
        toKstDateFromUnknownTimestamp(data.occurredAt)
        || toKstDateFromUnknownTimestamp(data.createdAt)
        || toKstDate();
      const [settings, studentSnap] = await Promise.all([
        loadNotificationSettings(db, centerId),
        db.doc(`centers/${centerId}/students/${studentId}`).get(),
      ]);
      const studentData = studentSnap.exists ? studentSnap.data() || {} : {};
      const studentName = asTrimmedString(
        studentData.name || asRecord(data.meta)?.studentName || data.studentName,
        "학생"
      );
      const queueResult = await queueParentSmsNotification(db, {
        centerId,
        studentId,
        studentName,
        eventType,
        eventAt,
        settings,
      });

      await snap.ref.set({
        smsAutoQueuedAt: admin.firestore.FieldValue.serverTimestamp(),
        smsAutoQueuedCount: queueResult.queuedCount,
        smsAutoRecipientCount: queueResult.recipientCount,
        smsAutoEventType: eventType,
        smsAutoMessage: queueResult.message || null,
      }, { merge: true });
    } catch (error: any) {
      console.error("[attendance-sms-auto] failed", {
        centerId,
        eventId,
        studentId,
        eventType,
        message: error?.message || String(error),
      });
      await snap.ref.set({
        smsAutoQueuedAt: admin.firestore.FieldValue.serverTimestamp(),
        smsAutoError: error?.message || String(error),
        smsAutoEventType: eventType,
      }, { merge: true });
    }

    return null;
  });

export const repairTodayAttendanceSmsQueue = functions.region(region).https.onCall(async (data, context) => {
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

  const todayKey = toDateKey(toKstDate());
  const requestedDateKey = asTrimmedString(data?.dateKey, todayKey);
  if (requestedDateKey !== todayKey) {
    throw new functions.https.HttpsError("invalid-argument", "오늘 날짜의 문자 접수만 복구할 수 있습니다.");
  }

  const eventsSnap = await db
    .collection(`centers/${centerId}/attendanceEvents`)
    .where("dateKey", "==", todayKey)
    .limit(1500)
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
      data: FirebaseFirestore.DocumentData;
      studentId: string;
      eventType: AttendanceSmsEventType;
      eventAt: Date;
    } => Boolean(event))
    .sort((left, right) => left.eventAt.getTime() - right.eventAt.getTime());

  const studentIds = Array.from(new Set(targetEvents.map((event) => event.studentId)));
  const studentRefs = studentIds.map((studentId) => db.doc(`centers/${centerId}/students/${studentId}`));
  const [settings, studentSnaps] = await Promise.all([
    loadNotificationSettings(db, centerId),
    studentRefs.length > 0 ? db.getAll(...studentRefs) : Promise.resolve([]),
  ]);
  const studentNameById = new Map<string, string>();
  studentSnaps.forEach((studentSnap) => {
    const studentData = studentSnap.exists ? studentSnap.data() || {} : {};
    studentNameById.set(studentSnap.id, asTrimmedString(studentData.name, "학생"));
  });

  let queuedCount = 0;
  let suppressedCount = 0;
  let skippedCount = 0;
  let noRecipientCount = 0;

  for (const event of targetEvents) {
    const studentName = studentNameById.get(event.studentId) || asTrimmedString(event.data.studentName, "학생");
    const queueResult = await queueParentSmsNotification(db, {
      centerId,
      studentId: event.studentId,
      studentName,
      eventType: event.eventType,
      eventAt: event.eventAt,
      settings,
    });

    if (queueResult.deduped) {
      skippedCount += 1;
      continue;
    }
    if (queueResult.recipientCount === 0) {
      noRecipientCount += 1;
      continue;
    }

    queuedCount += queueResult.queuedCount;
    suppressedCount += queueResult.suppressedCount;
  }

  return {
    ok: true,
    centerId,
    dateKey: todayKey,
    scannedCount: eventsSnap.size,
    targetCount: targetEvents.length,
    queuedCount,
    suppressedCount,
    skippedCount,
    noRecipientCount,
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
      suppressedReason: "student_fallback_blocked",
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
      failedAt: nowTs,
      errorCode: "INVALID_QUEUE_ITEM",
      errorMessage: "수신번호 또는 문자 본문이 비어 있습니다.",
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
    failedAt: nowTs,
    errorCode: lastErrorCode,
    errorMessage: lastErrorMessage,
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
  const weekAgoKey = toDateKey(new Date(nowKst.getTime() - 6 * 24 * 60 * 60 * 1000));
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
    throw new functions.https.HttpsError("failed-precondition", "Invite has invalid role configuration.", {
      userMessage: "초대 코드의 역할 설정이 올바르지 않습니다. 센터 관리자에게 문의해 주세요.",
    });
  }
  if (expectedRole && inv.intendedRole !== expectedRole) {
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
  const role = data?.role as AllowedRole;
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
      retryPayload.dateKey = toDateKey(smsEventAt);
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

export const scheduledSmsQueueDispatcher = functions
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
    const touchedCenterIds = new Set<string>();
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
      queuedCandidates: queuedSnap.size,
      processingCandidates: processingSnap.size,
      touchedCenterCount: touchedCenterIds.size,
      processed,
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
    const todayKey = toDateKey(nowKst);
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
    eventAt: nowKst,
    settings,
    force: forceResend,
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

  const reportRef = db.doc(`centers/${centerId}/dailyReports/${dateKey}_${studentId}`);
  const [studentSnap, reportSnap] = await Promise.all([
    db.doc(`centers/${centerId}/students/${studentId}`).get(),
    reportRef.get(),
  ]);
  if (!studentSnap.exists) {
    throw new functions.https.HttpsError("failed-precondition", "Student not found.");
  }

  if (reportSnap.exists && reportSnap.data()?.parentSmsNotifiedAt) {
    return { ok: true, queuedCount: 0, recipientCount: 0, skipped: true };
  }

  const studentName = asTrimmedString(studentSnap.data()?.name, "학생");
  const nowKst = toKstDate();
  const settings = await loadNotificationSettings(db, centerId);
  const queueResult = await queueCustomParentSmsNotification(db, {
    centerId,
    studentId,
    studentName,
    eventType: "daily_report",
    message: `[${TRACK_MANAGED_STUDY_CENTER_NAME}] ${studentName} 학생의 오늘자 학습 리포트가 도착했습니다. 앱에서 확인해 주세요.`,
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
    await reportRef.set(
      {
        parentSmsNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  return {
    ok: true,
    queuedCount: queueResult.queuedCount,
    recipientCount: queueResult.recipientCount,
    provider: settings.smsProvider || "none",
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
    const cutoffTimestamp = admin.firestore.Timestamp.fromMillis(
      Date.now() - MAX_STUDY_SESSION_MINUTES * MINUTE_MS
    );

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
        if (seat.status !== "studying") continue;

        const lastCheckInAt = seat.lastCheckInAt as admin.firestore.Timestamp | undefined;
        if (!lastCheckInAt || lastCheckInAt > cutoffTimestamp) continue;

        const studentId = seat.studentId as string | undefined;
        if (!studentId) continue;

        const autoEndTimeMs = lastCheckInAt.toMillis() + MAX_STUDY_SESSION_MINUTES * MINUTE_MS;
        const result = await finalizeStudySession({
          db,
          centerId,
          studentId,
          startMs: lastCheckInAt.toMillis(),
          endMs: autoEndTimeMs,
          closeSeatRef: seatDoc.ref,
          shouldCloseSeat: true,
          progressExtra: {
            seasonLp: admin.firestore.FieldValue.increment(MAX_STUDY_SESSION_MINUTES),
            "stats.focus": admin.firestore.FieldValue.increment(0.1),
          },
          sessionMetadata: {
            autoClosedAt: admin.firestore.FieldValue.serverTimestamp(),
            closedReason: "auto_6h_limit",
          },
        });
        totalClosed++;

        console.log("[auto-close-session] 6시간 초과 세션 자동 종료", {
          centerId,
          studentId,
          sessionDateKey: result.sessionDateKey,
          lastCheckInAt: lastCheckInAt.toDate().toISOString(),
          autoEndTime: new Date(autoEndTimeMs).toISOString(),
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

async function syncStudyLogDayTotalMinutes(
  db: admin.firestore.Firestore,
  centerId: string,
  studentId: string,
  dateKey: string
): Promise<void> {
  const sessionsSnap = await db.collection(`centers/${centerId}/studyLogs/${studentId}/days/${dateKey}/sessions`).get();
  const sessionTotalMinutes = sessionsSnap.docs.reduce((sum, docSnap) => {
    const raw = Number((docSnap.data() as Record<string, unknown>)?.durationMinutes ?? 0);
    return sum + (Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0);
  }, 0);
  const firstSessionStartAt = sessionsSnap.docs
    .map((docSnap) => toTimestampOrNow((docSnap.data() as Record<string, unknown>)?.startTime))
    .filter((value): value is admin.firestore.Timestamp => Boolean(value))
    .sort((left, right) => left.toMillis() - right.toMillis())[0] ?? null;
  const lastSessionEndAt = sessionsSnap.docs
    .map((docSnap) => toTimestampOrNow((docSnap.data() as Record<string, unknown>)?.endTime))
    .filter((value): value is admin.firestore.Timestamp => Boolean(value))
    .sort((left, right) => right.toMillis() - left.toMillis())[0] ?? null;
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

    transaction.set(
      dayRef,
      {
        studentId,
        centerId,
        dateKey,
        totalMinutes: sessionTotalMinutes,
        manualAdjustmentMinutes,
        ...(firstSessionStartAt ? { firstSessionStartAt } : {}),
        ...(lastSessionEndAt ? { lastSessionEndAt } : {}),
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
        totalStudyMinutes: sessionTotalMinutes,
        manualAdjustmentMinutes,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
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

  const persistedDayMinutes = Math.max(0, Math.floor(parseFiniteNumber(studyDaySnap.data()?.totalMinutes) ?? 0));
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


export const stopStudentStudySessionSecure = functions.region(region).https.onCall(async (data, context) => {
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
  const attendanceSnap = await db.collection(`centers/${centerId}/attendanceCurrent`).where("studentId", "==", studentId).limit(10).get();

  const preferredSeatDoc = pickPreferredAttendanceSeatDoc(attendanceSnap.docs);
  const seatData = preferredSeatDoc?.data() as Record<string, unknown> | undefined;
  const seatStatus = asTrimmedString(seatData?.status);
  const seatStartTimeMs = toMillisSafe(seatData?.lastCheckInAt);
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

  const result = await finalizeStudySession({
    db,
    centerId,
    studentId,
    startMs: resolvedStartTimeMs,
    endMs: nowMs,
    closeSeatRef: preferredSeatDoc?.ref ?? null,
    shouldCloseSeat: hasActiveSeatSession,
    closeAttendanceEvent: hasActiveSeatSession
      ? {
          dateKey: toDateKey(toKstDate(new Date(nowMs))),
          eventAtMs: nowMs,
          source: "student_dashboard_secure",
          seatId: preferredSeatDoc?.id || null,
          statusBefore: seatStatus || null,
          statusAfter: "absent",
        }
      : undefined,
  });

  return {
    ok: true,
    duplicatedSession: result.duplicatedSession,
    sessionId: result.sessionId,
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

export { scheduledRankingRewardSettlement } from "./rankingRewardSettlement";
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
