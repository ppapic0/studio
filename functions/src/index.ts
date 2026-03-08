import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const region = "asia-northeast3";

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
  if (!callerMemberSnap.exists || callerMemberSnap.data()?.role !== "centerAdmin") {
    throw new functions.https.HttpsError("permission-denied", "센터 관리자만 삭제 가능합니다.");
  }

  try {
    try {
      await auth.deleteUser(studentId);
    } catch {
      console.log("Auth already gone");
    }

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

    await Promise.allSettled([
      ...paths.map(async (p) => {
        try {
          await db.recursiveDelete(db.doc(p));
        } catch {
          // best effort delete
        }
      }),
      ...filterCols.map(async (cp) => {
        try {
          const q = await db.collection(cp).where("studentId", "==", studentId).get();
          const tasks = q.docs.map((doc) => db.recursiveDelete(doc.ref));
          await Promise.all(tasks);
        } catch {
          // best effort delete
        }
      }),
    ]);

    return { ok: true, message: "정리가 완료되었습니다." };
  } catch (error: any) {
    throw new functions.https.HttpsError("internal", error.message);
  }
});

export const updateStudentAccount = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();
  const auth = admin.auth();
  const { studentId, centerId, password, displayName, schoolName, grade, parentLinkCode } = data;

  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "인증 필요");
  if (!studentId || !centerId) throw new functions.https.HttpsError("invalid-argument", "ID 누락");

  const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
  if (!callerMemberSnap.exists || callerMemberSnap.data()?.role !== "centerAdmin") {
    throw new functions.https.HttpsError("permission-denied", "센터 관리자만 수정 가능합니다.");
  }

  try {
    const authUpdates: any = {};
    if (password) authUpdates.password = password;
    if (displayName) authUpdates.displayName = displayName;

    if (Object.keys(authUpdates).length > 0) {
      try {
        await auth.updateUser(studentId, authUpdates);
      } catch (authError: any) {
        console.warn(`Auth update skipped for ${studentId}: ${authError.message}`);
      }
    }

    const timestamp = admin.firestore.Timestamp.now();
    const batch = db.batch();

    if (displayName || schoolName) {
      const uUp: any = { updatedAt: timestamp };
      if (displayName) uUp.displayName = displayName;
      if (schoolName) uUp.schoolName = schoolName;
      batch.set(db.doc(`users/${studentId}`), uUp, { merge: true });
    }

    const sUp: any = { updatedAt: timestamp };
    if (displayName) sUp.name = displayName;
    if (schoolName) sUp.schoolName = schoolName;
    if (grade) sUp.grade = grade;
    if (parentLinkCode !== undefined) sUp.parentLinkCode = parentLinkCode;
    batch.set(db.doc(`centers/${centerId}/students/${studentId}`), sUp, { merge: true });

    if (displayName) {
      batch.set(db.doc(`centers/${centerId}/members/${studentId}`), { displayName, updatedAt: timestamp }, { merge: true });
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
  if (!callerMemberSnap.exists || callerMemberSnap.data()?.role !== "centerAdmin") {
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
      t.set(db.doc(`centers/${centerId}/growthProgress/${uid}`), { seasonLp: 0, penaltyPoints: 0, stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 }, updatedAt: timestamp });
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
      const snap = await t.get(db.doc(`inviteCodes/${code}`));
      if (!snap.exists) throw new Error("Invalid code");

      const inv = snap.data()!;
      if (inv.isActive === false) throw new Error("Inactive code");
      if (typeof inv.maxUses === "number" && typeof inv.usedCount === "number" && inv.usedCount >= inv.maxUses) {
        throw new Error("Code usage exceeded");
      }
      if (inv.expiresAt && inv.expiresAt.toMillis && inv.expiresAt.toMillis() < Date.now()) {
        throw new Error("Code expired");
      }

      const ts = admin.firestore.Timestamp.now();
      t.set(db.doc(`userCenters/${uid}/centers/${inv.centerId}`), { id: inv.centerId, role: inv.intendedRole, status: "active", joinedAt: ts, className: inv.targetClassName || null });
      t.set(db.doc(`centers/${inv.centerId}/members/${uid}`), { id: uid, role: inv.intendedRole, status: "active", joinedAt: ts, displayName: callerDisplayName, className: inv.targetClassName || null });
      t.update(db.doc(`inviteCodes/${code}`), { usedCount: admin.firestore.FieldValue.increment(1), updatedAt: ts });
      return { ok: true };
    });
  } catch (e: any) {
    throw new functions.https.HttpsError("internal", e.message);
  }
});



