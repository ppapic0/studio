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

function isAdminRole(role: unknown): boolean {
  return typeof role === "string" && adminRoles.has(role);
}

function assertInviteUsable(inv: InviteDoc, expectedRole?: AllowedRole) {
  if (!allowedRoles.includes(inv.intendedRole)) {
    throw new Error("Invalid role in invite");
  }
  if (expectedRole && inv.intendedRole !== expectedRole) {
    throw new Error("Invite role mismatch");
  }
  if (inv.isActive === false) {
    throw new Error("Inactive code");
  }
  if (typeof inv.maxUses === "number" && typeof inv.usedCount === "number" && inv.usedCount >= inv.maxUses) {
    throw new Error("Code usage exceeded");
  }
  if (inv.expiresAt && inv.expiresAt.toMillis && inv.expiresAt.toMillis() < Date.now()) {
    throw new Error("Code expired");
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

  const callerMemberSnap = await db.doc("centers/" + centerId + "/members/" + context.auth.uid).get();
  if (!callerMemberSnap.exists || !isAdminRole(callerMemberSnap.data()?.role)) {
    throw new functions.https.HttpsError("permission-denied", "센터 관리자만 수정 가능합니다.");
  }

  try {
    const authUpdates: any = {};
    if (typeof password === "string" && password.trim().length >= 6) authUpdates.password = password.trim();
    if (typeof displayName === "string" && displayName.trim()) authUpdates.displayName = displayName.trim();

    if (Object.keys(authUpdates).length > 0) {
      try {
        await auth.updateUser(studentId, authUpdates);
      } catch (authError: any) {
        console.warn("Auth update skipped for " + studentId + ": " + authError.message);
      }
    }

    const timestamp = admin.firestore.Timestamp.now();
    const batch = db.batch();
    const trimmedDisplayName = typeof displayName === "string" ? displayName.trim() : "";
    const trimmedSchoolName = typeof schoolName === "string" ? schoolName.trim() : "";
    const hasClassName = className !== undefined;
    const normalizedClassName = hasClassName
      ? (typeof className === "string" && className.trim() ? className.trim() : null)
      : undefined;

    if (trimmedDisplayName || trimmedSchoolName) {
      const userUpdate: any = { updatedAt: timestamp };
      if (trimmedDisplayName) userUpdate.displayName = trimmedDisplayName;
      if (trimmedSchoolName) userUpdate.schoolName = trimmedSchoolName;
      batch.set(db.doc("users/" + studentId), userUpdate, { merge: true });
    }

    const studentUpdate: any = { updatedAt: timestamp };
    if (trimmedDisplayName) studentUpdate.name = trimmedDisplayName;
    if (trimmedSchoolName) studentUpdate.schoolName = trimmedSchoolName;
    if (grade) studentUpdate.grade = grade;
    if (parentLinkCode !== undefined) studentUpdate.parentLinkCode = parentLinkCode;
    if (hasClassName) studentUpdate.className = normalizedClassName;
    batch.set(db.doc("centers/" + centerId + "/students/" + studentId), studentUpdate, { merge: true });

    const memberUpdate: any = { updatedAt: timestamp };
    if (trimmedDisplayName) memberUpdate.displayName = trimmedDisplayName;
    if (hasClassName) memberUpdate.className = normalizedClassName;
    batch.set(db.doc("centers/" + centerId + "/members/" + studentId), memberUpdate, { merge: true });

    if (hasClassName) {
      batch.set(db.doc("userCenters/" + studentId + "/centers/" + centerId), {
        className: normalizedClassName,
        updatedAt: timestamp,
      }, { merge: true });
    }

    const hasSeasonLp = typeof seasonLp === "number" && Number.isFinite(seasonLp);
    const hasStats = !!stats && typeof stats === "object";

    if (hasSeasonLp || hasStats) {
      const progressUpdate: any = { updatedAt: timestamp };
      if (hasSeasonLp) progressUpdate.seasonLp = seasonLp;
      if (hasStats) progressUpdate.stats = stats;
      batch.set(db.doc("centers/" + centerId + "/growthProgress/" + studentId), progressUpdate, { merge: true });
    }

    const safeDateKey = (typeof dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateKey))
      ? dateKey
      : new Date().toISOString().slice(0, 10);

    if (typeof todayStudyMinutes === "number" && Number.isFinite(todayStudyMinutes)) {
      batch.set(db.doc("centers/" + centerId + "/dailyStudentStats/" + safeDateKey + "/students/" + studentId), {
        totalStudyMinutes: todayStudyMinutes,
        studentId,
        centerId,
        dateKey: safeDateKey,
        updatedAt: timestamp,
      }, { merge: true });
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

      batch.set(db.doc("centers/" + centerId + "/leaderboards/" + periodKey + "_lp/entries/" + studentId), rankUpdate, { merge: true });
    }

    await batch.commit();
    return { ok: true };
  } catch (e: any) {
    throw new functions.https.HttpsError("internal", e.message);
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
    throw new functions.https.HttpsError("internal", e.message);
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
      if (!inviteSnap.exists) throw new Error("Invalid code");

      const inv = inviteSnap.data() as InviteDoc;
      assertInviteUsable(inv);

      const membershipRef = db.doc(`userCenters/${uid}/centers/${inv.centerId}`);
      const existingMembership = await t.get(membershipRef);
      if (existingMembership.exists) {
        throw new Error("Already joined center");
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
    throw new functions.https.HttpsError("internal", e.message);
  }
});

export const completeSignupWithInvite = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "인증 필요");

  const uid = context.auth.uid;
  const role = data?.role as AllowedRole;
  const code = String(data?.code || "").trim();
  const schoolName = String(data?.schoolName || "").trim();
  const grade = String(data?.grade || "고등학생").trim();
  const parentLinkCode = String(data?.parentLinkCode || "").trim();
  const studentLinkCode = String(data?.studentLinkCode || "").trim();
  const displayNameInput = String(data?.displayName || "").trim();

  if (!allowedRoles.includes(role)) throw new functions.https.HttpsError("invalid-argument", "역할 값이 올바르지 않습니다.");
  if (role !== "parent" && !code) throw new functions.https.HttpsError("invalid-argument", "초대코드 누락");

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
          throw new functions.https.HttpsError("invalid-argument", "부모 가입에는 6자리 자녀 연동 코드가 필요합니다.");
        }

        const studentQuery = db
          .collectionGroup("students")
          .where("parentLinkCode", "==", studentLinkCode)
          .limit(2);
        const studentSnap = await t.get(studentQuery);

        if (studentSnap.empty) {
          throw new functions.https.HttpsError("failed-precondition", "연동 코드를 가진 학생을 찾을 수 없습니다.");
        }
        if (studentSnap.size > 1) {
          throw new functions.https.HttpsError("failed-precondition", "동일한 자녀 연동 코드가 여러 명에게 설정되어 있어 가입할 수 없습니다. 센터에 문의해주세요.");
        }

        const studentDoc = studentSnap.docs[0];
        const centerRef = studentDoc.ref.parent.parent;
        if (!centerRef) {
          throw new functions.https.HttpsError("failed-precondition", "학생 센터 정보를 확인할 수 없습니다.");
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
          throw new functions.https.HttpsError("failed-precondition", "유효하지 않은 초대코드입니다.");
        }

        const inviteData = inviteSnap.data() as InviteDoc;
        assertInviteUsable(inviteData, role);

        centerId = inviteData.centerId;
        targetClassName = inviteData.targetClassName || null;
        if (!centerId) {
          throw new functions.https.HttpsError("failed-precondition", "센터 정보가 없는 초대코드입니다.");
        }
      }

      const userCenterRef = db.doc(`userCenters/${uid}/centers/${centerId}`);
      const existingMembership = await t.get(userCenterRef);
      if (existingMembership.exists) {
        throw new functions.https.HttpsError("already-exists", "이미 가입된 센터입니다.");
      }

      const ts = admin.firestore.Timestamp.now();
      let resolvedDisplayName = displayNameInput || tokenDisplayName || "사용자";
      let linkedStudentIds: string[] = [];

      if (role === "student") {
        if (!schoolName) {
          throw new functions.https.HttpsError("invalid-argument", "학생 가입에는 학교명이 필요합니다.");
        }
        if (!/^\d{6}$/.test(parentLinkCode)) {
          throw new functions.https.HttpsError("invalid-argument", "학생 가입에는 6자리 부모 연동 코드가 필요합니다.");
        }
      }

      if (role === "parent") {
        if (!linkedStudentRef || !linkedStudentData || !linkedStudentId) {
          throw new functions.https.HttpsError("failed-precondition", "연동할 학생 정보를 찾을 수 없습니다.");
        }

        linkedStudentIds = [linkedStudentId];
        if (!displayNameInput) {
          resolvedDisplayName = `${linkedStudentData?.name || "학생"} 학부모`;
        }

        t.set(linkedStudentRef, {
          parentUids: admin.firestore.FieldValue.arrayUnion(uid),
          updatedAt: ts,
        }, { merge: true });
      }

      t.set(db.doc(`users/${uid}`), {
        id: uid,
        email: emailFromToken,
        displayName: resolvedDisplayName,
        schoolName: schoolName || "",
        updatedAt: ts,
        createdAt: ts,
      }, { merge: true });

      const memberData: any = {
        id: uid,
        centerId,
        role,
        status: "active",
        joinedAt: ts,
        displayName: resolvedDisplayName,
        className: targetClassName,
      };
      if (linkedStudentIds.length > 0) {
        memberData.linkedStudentIds = linkedStudentIds;
      }

      const userCenterData: any = {
        id: centerId,
        centerId,
        role,
        status: "active",
        joinedAt: ts,
        className: targetClassName,
      };
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
    throw new functions.https.HttpsError("internal", "회원가입 처리 중 내부 오류가 발생했습니다.", {
      userMessage: e?.message || "알 수 없는 내부 오류",
    });
  }
});


