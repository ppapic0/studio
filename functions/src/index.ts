import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const region = "asia-northeast3";
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

type AttendanceSmsEventType = "check_in" | "check_out" | "late_alert";
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
  smsTemplateLateAlert?: string;
  lateAlertEnabled?: boolean;
  lateAlertGraceMinutes?: number;
  defaultArrivalTime?: string;
};

type SmsRecipient = {
  parentUid: string;
  parentName: string | null;
  phoneNumber: string;
};

const DEFAULT_SMS_TEMPLATES: Record<AttendanceSmsEventType, string> = {
  check_in: "{studentName}학생이 {time}에 등원했습니다.",
  check_out: "{studentName}학생이 {time}에 하원했습니다.",
  late_alert: "{studentName}학생이 {expectedTime}까지 등원하지 않았습니다.",
};

function normalizePhoneNumber(raw: unknown): string {
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("01")) return digits;
  if (digits.length === 10 && digits.startsWith("01")) return digits;
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

async function loadNotificationSettings(
  db: admin.firestore.Firestore,
  centerId: string
): Promise<NotificationSettingsDoc> {
  const settingsSnap = await db.doc(`centers/${centerId}/settings/notifications`).get();
  if (!settingsSnap.exists) return {};
  return (settingsSnap.data() || {}) as NotificationSettingsDoc;
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
  if (parentUids.length === 0) return [];

  const recipients: SmsRecipient[] = [];
  const usedPhones = new Set<string>();

  for (const parentUid of parentUids) {
    const [userSnap, memberSnap] = await Promise.all([
      db.doc(`users/${parentUid}`).get(),
      db.doc(`centers/${centerId}/members/${parentUid}`).get(),
    ]);

    const userData = userSnap.exists ? userSnap.data() : null;
    const memberData = memberSnap.exists ? memberSnap.data() : null;
    const phoneNumber = normalizePhoneNumber(userData?.phoneNumber || memberData?.phoneNumber);
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
    eventType,
    eventAt,
    expectedTime,
  } = params;
  const settings = params.settings || await loadNotificationSettings(db, centerId);
  const recipients = await collectParentRecipients(db, centerId, studentId);
  if (recipients.length === 0) {
    return { queuedCount: 0, recipientCount: 0, message: "" };
  }

  const template = (() => {
    if (eventType === "check_in") return settings.smsTemplateCheckIn || DEFAULT_SMS_TEMPLATES.check_in;
    if (eventType === "check_out") return settings.smsTemplateCheckOut || DEFAULT_SMS_TEMPLATES.check_out;
    return settings.smsTemplateLateAlert || DEFAULT_SMS_TEMPLATES.late_alert;
  })();

  const eventTimeLabel = toTimeLabel(eventAt);
  const expectedTimeLabel = expectedTime || settings.defaultArrivalTime || "정해진 시간";
  const message = applyTemplate(template, {
    studentName,
    time: eventTimeLabel,
    expectedTime: expectedTimeLabel,
  });

  const provider = settings.smsProvider || "none";
  const ts = admin.firestore.Timestamp.now();
  const batch = db.batch();

  recipients.forEach((recipient) => {
    const queueRef = db.collection(`centers/${centerId}/smsQueue`).doc();
    batch.set(queueRef, {
      centerId,
      studentId,
      parentUid: recipient.parentUid,
      parentName: recipient.parentName,
      to: recipient.phoneNumber,
      provider,
      sender: settings.smsSender || null,
      endpointUrl: settings.smsEndpointUrl || null,
      message,
      eventType,
      status: settings.smsEnabled === false || provider === "none" ? "pending_provider" : "queued",
      createdAt: ts,
      updatedAt: ts,
      metadata: {
        studentName,
        expectedTime: expectedTime || null,
      },
    });

    const parentNotificationRef = db.collection(`centers/${centerId}/parentNotifications`).doc();
    batch.set(parentNotificationRef, {
      centerId,
      studentId,
      parentUid: recipient.parentUid,
      type: eventType,
      title: eventType === "check_in"
        ? "등원 알림"
        : eventType === "check_out"
          ? "하원 알림"
          : "지각 알림",
      body: message,
      isRead: false,
      isImportant: eventType !== "check_in",
      createdAt: ts,
      updatedAt: ts,
    });
  });

  const logRef = db.collection(`centers/${centerId}/smsLogs`).doc();
  batch.set(logRef, {
    centerId,
    studentId,
    eventType,
    provider,
    recipientCount: recipients.length,
    message,
    createdAt: ts,
    updatedAt: ts,
  });

  await batch.commit();
  return { queuedCount: recipients.length, recipientCount: recipients.length, message };
}

async function runLateArrivalCheckForCenter(
  db: admin.firestore.Firestore,
  centerId: string,
  nowKst: Date
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

  const attendanceSnap = await db.collection(`centers/${centerId}/attendanceCurrent`).get();
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
function isAdminRole(role: unknown): boolean {
  return typeof role === "string" && adminRoles.has(role);
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

  const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
  if (!callerMemberSnap.exists || !isAdminRole(callerMemberSnap.data()?.role)) {
    throw new functions.https.HttpsError("permission-denied", "센터 관리자만 삭제 가능합니다.");
  }

  const targetMemberRef = db.doc(`centers/${centerId}/members/${studentId}`);
  const targetMemberSnap = await targetMemberRef.get();
  if (!targetMemberSnap.exists || targetMemberSnap.data()?.role !== "student") {
    throw new functions.https.HttpsError("failed-precondition", "해당 센터의 학생 계정만 삭제할 수 있습니다.");
  }

  try {
    const errors: string[] = [];

    // 다중 센터 소속 확인: 이 센터 외에 다른 센터에도 소속되어 있는지 체크
    const userCentersSnap = await db.collection(`userCenters/${studentId}/centers`).get();
    const otherCenterCount = userCentersSnap.docs.filter((doc) => doc.id !== centerId).length;
    const isMultiCenter = otherCenterCount > 0;

    // 이 센터 데이터만 삭제 (다른 센터에 소속된 경우 전역 데이터는 보존)
    const paths = [
      `centers/${centerId}/members/${studentId}`,
      `centers/${centerId}/students/${studentId}`,
      `centers/${centerId}/growthProgress/${studentId}`,
      `centers/${centerId}/plans/${studentId}`,
      `centers/${centerId}/studyLogs/${studentId}`,
      `userCenters/${studentId}/centers/${centerId}`,
    ];

    // 다른 센터에 소속이 없을 때만 전역 데이터 삭제
    if (!isMultiCenter) {
      paths.push(`users/${studentId}`);
      paths.push(`userCenters/${studentId}`);
    }

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

    // 다른 센터에 소속이 없을 때만 Auth 계정 삭제
    if (!isMultiCenter) {
      try {
        await auth.deleteUser(studentId);
      } catch (e: any) {
        if (e?.code !== "auth/user-not-found") {
          throw e;
        }
      }
    }

    return { ok: true, message: isMultiCenter ? "이 센터에서의 학생 데이터가 정리되었습니다." : "정리가 완료되었습니다." };
  } catch (error: any) {
    throw new functions.https.HttpsError("internal", error.message);
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
    parentLinkCode,
    className,
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
  const hasClassName = className !== undefined;
  const normalizedClassName = hasClassName
    ? (typeof className === "string" && className.trim() ? className.trim() : null)
    : undefined;

  const parentLinkCodeProvided = parentLinkCode !== undefined;
  const normalizedParentLinkCode = parentLinkCode === null ? "" : normalizeParentLinkCodeValue(parentLinkCode);
  const normalizedSeasonLp = parseFiniteNumber(seasonLp);
  const normalizedTodayStudyMinutes = parseFiniteNumber(todayStudyMinutes);
  const normalizedStats = normalizeStatsPayload(stats);

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
      seasonLp !== undefined ||
      stats !== undefined ||
      todayStudyMinutes !== undefined ||
      dateKey !== undefined;

    if (hasForbiddenUpdate) {
      throw new functions.https.HttpsError("permission-denied", "학생 계정은 일부 항목만 수정할 수 있습니다.", {
        userMessage: "학생은 학교/학년/학부모 연동 코드만 수정할 수 있습니다.",
      });
    }

    const hasSelfEditableFieldInPayload =
      typeof schoolName === "string" || typeof grade === "string" || parentLinkCodeProvided;

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
    const hasUserWrite = trimmedDisplayName.length > 0 || trimmedSchoolName.length > 0;
    if (hasUserWrite) {
      batch.set(userRef, userUpdate, { merge: true });
    }

    const studentUpdate: any = { updatedAt: timestamp };
    if (trimmedDisplayName) studentUpdate.name = trimmedDisplayName;
    if (trimmedSchoolName) studentUpdate.schoolName = trimmedSchoolName;
    if (trimmedGrade) studentUpdate.grade = trimmedGrade;
    if (parentLinkCodeProvided) studentUpdate.parentLinkCode = normalizedParentLinkCode || null;
    if (canEditOtherStudent && hasClassName) studentUpdate.className = normalizedClassName;
    batch.set(studentRef, studentUpdate, { merge: true });

    const memberRef = db.doc("centers/" + centerId + "/members/" + studentId);
    const memberUpdate: any = { updatedAt: timestamp };
    if (trimmedDisplayName) memberUpdate.displayName = trimmedDisplayName;
    if (hasClassName) memberUpdate.className = normalizedClassName;
    if (canEditOtherStudent) {
      batch.set(memberRef, memberUpdate, { merge: true });
    }

    const userCenterRef = db.doc("userCenters/" + studentId + "/centers/" + centerId);
    const userCenterUpdate = {
      className: normalizedClassName,
      updatedAt: timestamp,
    };
    if (canEditOtherStudent && hasClassName) {
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
      if (canEditOtherStudent && hasClassName) {
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
      userMessage: "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    });
  }
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

  let createdUid: string | null = null;
  try {
    const userRecord = await auth.createUser({ email, password, displayName });
    createdUid = userRecord.uid;
    const uid = createdUid;
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
    // Firestore 트랜잭션 실패 시 이미 생성된 Auth 계정을 롤백(삭제)하여 고아 계정 방지
    if (createdUid) {
      try {
        await auth.deleteUser(createdUid);
        console.warn(`[registerStudent] Rolled back Auth user ${createdUid} after transaction failure`);
      } catch (rollbackErr: any) {
        console.error(`[registerStudent] Failed to rollback Auth user ${createdUid}:`, rollbackErr?.message);
      }
    }
    if (e instanceof functions.https.HttpsError) {
      throw e;
    }
    throw new functions.https.HttpsError("internal", "Operation failed due to internal error.", {
      userMessage: "학생 등록 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
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
      userMessage: "초대 코드 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
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
      if (role === "parent" && effectiveParentPhone) {
        userDocData.phoneNumber = effectiveParentPhone;
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
      userMessage: "회원가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
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

  if (!(["check_in", "check_out", "late_alert"] as AttendanceSmsEventType[]).includes(eventType)) {
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
  const alertsTriggered = await runLateArrivalCheckForCenter(db, centerId, nowKst);
  return {
    ok: true,
    centerId,
    alertsTriggered,
    checkedAt: admin.firestore.Timestamp.now(),
  };
});

export const sendScheduledLateArrivalAlerts = functions
  .region(region)
  .pubsub.schedule("every 10 minutes")
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    const db = admin.firestore();
    const centersSnap = await db.collection("centers").get();
    const nowKst = toKstDate();

    let totalTriggered = 0;
    for (const centerDoc of centersSnap.docs) {
      totalTriggered += await runLateArrivalCheckForCenter(db, centerDoc.id, nowKst);
    }

    console.log("[late-arrival] run complete", {
      centerCount: centersSnap.size,
      totalTriggered,
      atKst: nowKst.toISOString(),
    });
    return null;
  });
