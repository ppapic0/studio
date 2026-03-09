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

    const paths = [
      `users/${studentId}`,
      `userCenters/${studentId}`,
      `centers/${centerId}/members/${studentId}`,
      `centers/${centerId}/students/${studentId}`,
      `centers/${centerId}/growthProgress/${studentId}`,
      `centers/${centerId}/plans/${studentId}`,
      `centers/${centerId}/studyLogs/${studentId}`,
      `centers/${centerId}/dailyStudentStats/today/students/${studentId}`,
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
    throw new functions.https.HttpsError("internal", error.message);
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
  const callerMemberSnap = await db.doc(`centers/${centerId}/members/${callerUid}`).get();
  const callerRole = callerMemberSnap.exists ? callerMemberSnap.data()?.role : null;
  const isAdminCaller = isAdminRole(callerRole);
  const isSelfStudentCaller = callerRole === "student" && callerUid === studentId;

  if (!isAdminCaller && !isSelfStudentCaller) {
    throw new functions.https.HttpsError("permission-denied", "수정 권한이 없습니다.");
  }

  const trimmedDisplayName = typeof displayName === "string" ? displayName.trim() : "";
  const trimmedSchoolName = typeof schoolName === "string" ? schoolName.trim() : "";
  const trimmedGrade = typeof grade === "string" ? grade.trim() : "";
  const hasClassName = className !== undefined;
  const normalizedClassName = hasClassName
    ? (typeof className === "string" && className.trim() ? className.trim() : null)
    : undefined;

  const parentLinkCodeProvided = parentLinkCode !== undefined;
  const normalizedParentLinkCode =
    typeof parentLinkCode === "string"
      ? parentLinkCode.trim()
      : parentLinkCode === null
        ? ""
        : undefined;

  if (parentLinkCodeProvided) {
    if (typeof normalizedParentLinkCode !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "Parent link code type is invalid.");
    }

    if (normalizedParentLinkCode && !/^\d{6}$/.test(normalizedParentLinkCode)) {
      throw new functions.https.HttpsError("invalid-argument", "Parent link code must be 6 digits.", {
        userMessage: "학부모 연동 코드는 6자리 숫자여야 합니다.",
      });
    }

    if (normalizedParentLinkCode) {
      const duplicateSnap = await db
        .collectionGroup("students")
        .where("parentLinkCode", "==", normalizedParentLinkCode)
        .limit(2)
        .get();

      const hasConflict = duplicateSnap.docs.some((docSnap) => docSnap.id !== studentId);
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

    if (!trimmedSchoolName && !trimmedGrade && !parentLinkCodeProvided) {
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

    if (trimmedDisplayName || trimmedSchoolName) {
      const userUpdate: any = { updatedAt: timestamp };
      if (trimmedDisplayName) userUpdate.displayName = trimmedDisplayName;
      if (trimmedSchoolName) userUpdate.schoolName = trimmedSchoolName;
      batch.set(db.doc("users/" + studentId), userUpdate, { merge: true });
    }

    const studentUpdate: any = { updatedAt: timestamp };
    if (trimmedDisplayName) studentUpdate.name = trimmedDisplayName;
    if (trimmedSchoolName) studentUpdate.schoolName = trimmedSchoolName;
    if (trimmedGrade) studentUpdate.grade = trimmedGrade;
    if (parentLinkCodeProvided) studentUpdate.parentLinkCode = normalizedParentLinkCode || null;
    if (isAdminCaller && hasClassName) studentUpdate.className = normalizedClassName;
    batch.set(db.doc("centers/" + centerId + "/students/" + studentId), studentUpdate, { merge: true });

    if (isAdminCaller) {
      const memberUpdate: any = { updatedAt: timestamp };
      if (trimmedDisplayName) memberUpdate.displayName = trimmedDisplayName;
      if (hasClassName) memberUpdate.className = normalizedClassName;
      batch.set(db.doc("centers/" + centerId + "/members/" + studentId), memberUpdate, { merge: true });

      if (hasClassName) {
        batch.set(
          db.doc("userCenters/" + studentId + "/centers/" + centerId),
          {
            className: normalizedClassName,
            updatedAt: timestamp,
          },
          { merge: true }
        );
      }

      const hasSeasonLp = typeof seasonLp === "number" && Number.isFinite(seasonLp);
      const hasStats = !!stats && typeof stats === "object";

      if (hasSeasonLp || hasStats) {
        const progressUpdate: any = { updatedAt: timestamp };
        if (hasSeasonLp) progressUpdate.seasonLp = seasonLp;
        if (hasStats) progressUpdate.stats = stats;
        batch.set(db.doc("centers/" + centerId + "/growthProgress/" + studentId), progressUpdate, { merge: true });
      }

      const safeDateKey =
        typeof dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
          ? dateKey
          : new Date().toISOString().slice(0, 10);

      if (typeof todayStudyMinutes === "number" && Number.isFinite(todayStudyMinutes)) {
        batch.set(
          db.doc("centers/" + centerId + "/dailyStudentStats/" + safeDateKey + "/students/" + studentId),
          {
            totalStudyMinutes: todayStudyMinutes,
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
        if (hasSeasonLp) rankUpdate.value = seasonLp;
        if (trimmedDisplayName) rankUpdate.displayNameSnapshot = trimmedDisplayName;
        if (hasClassName) rankUpdate.classNameSnapshot = normalizedClassName;

        batch.set(db.doc("centers/" + centerId + "/leaderboards/" + periodKey + "_lp/entries/" + studentId), rankUpdate, {
          merge: true,
        });
      }
    }

    await batch.commit();
    return { ok: true, updatedBy: isSelfStudentCaller ? "student" : "admin" };
  } catch (e: any) {
    if (e instanceof functions.https.HttpsError) {
      throw e;
    }
    throw new functions.https.HttpsError("internal", "Operation failed due to internal error.", {
      userMessage: e?.message || "Unknown internal error",
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
  const studentLinkCode = String(data?.studentLinkCode || "").trim();
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

        const studentQuery = db
          .collectionGroup("students")
          .where("parentLinkCode", "==", studentLinkCode)
          .limit(2);
        const studentSnap = await t.get(studentQuery);

        if (studentSnap.empty) {
          throw new functions.https.HttpsError("failed-precondition", "No student found for this link code.", {
            userMessage: "입력한 학생 코드와 일치하는 학생이 없습니다. 학생 코드를 다시 확인해주세요.",
          });
        }
        if (studentSnap.size > 1) {
          throw new functions.https.HttpsError("failed-precondition", "Student link code is duplicated.", {
            userMessage: "해당 학생 코드가 중복되어 있습니다. 센터 관리자에게 코드 재설정을 요청해주세요.",
          });
        }

        const studentDoc = studentSnap.docs[0];
        const centerRef = studentDoc.ref.parent.parent;
        if (!centerRef) {
          throw new functions.https.HttpsError("failed-precondition", "Student center information is missing.", {
            userMessage: "학생 센터 정보를 확인할 수 없습니다. 관리자에게 문의해주세요.",
          });
        }

        centerId = centerRef.id;
        linkedStudentRef = studentDoc.ref;
        linkedStudentData = studentDoc.data();
        linkedStudentId = studentDoc.id;
        targetClassName = (linkedStudentData?.className as string | null) || null;
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
      const existingMembership = await t.get(userCenterRef);
      const existingMembershipData = existingMembership.exists ? (existingMembership.data() as any) : null;
      const isParentRelink = role === "parent" && existingMembership.exists && existingMembershipData?.role === "parent";

      if (existingMembership.exists && !isParentRelink) {
        throw new functions.https.HttpsError("already-exists", "Already joined this center.", {
          userMessage: "이미 가입된 센터입니다.",
        });
      }

      const ts = admin.firestore.Timestamp.now();
      let resolvedDisplayName = displayNameInput || tokenDisplayName || "사용자";
      const existingLinkedStudentIds = Array.isArray(existingMembershipData?.linkedStudentIds)
        ? existingMembershipData.linkedStudentIds.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
        : [];
      let linkedStudentIds: string[] = [];
      let effectiveParentPhone = parentPhoneNumber || normalizePhoneNumber(existingMembershipData?.phoneNumber || "");

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
            (existingMembershipData?.displayName as string | undefined) || `${linkedStudentData?.name || "학생"} 학부모`;
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
        status: existingMembershipData?.status || "active",
        joinedAt: existingMembershipData?.joinedAt || ts,
        displayName: resolvedDisplayName,
        className: targetClassName || existingMembershipData?.className || null,
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
        status: existingMembershipData?.status || "active",
        joinedAt: existingMembershipData?.joinedAt || ts,
        className: targetClassName || existingMembershipData?.className || null,
      };
      if (role === "parent" && effectiveParentPhone) {
        userCenterData.phoneNumber = effectiveParentPhone;
      }
      if (linkedStudentIds.length > 0) {
        userCenterData.linkedStudentIds = linkedStudentIds;
      }

      t.set(db.doc(`centers/${centerId}/members/${uid}`), memberData, { merge: true });
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
    throw new functions.https.HttpsError("internal", "회원가입 처리 중 오류가 발생했습니다.", {
      userMessage: e?.message || "알 수 없는 내부 오류",
    });
  }
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
