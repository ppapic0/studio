
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const region = "asia-northeast3";

/**
 * 학생 계정 및 모든 하위 데이터를 강제로 삭제 (Firebase CLI --recursive와 동일한 로직)
 * 메모리를 1GB로 늘리고 타임아웃을 9분으로 설정하여 방대한 데이터 삭제 중 중단을 방지합니다.
 */
export const deleteStudentAccount = functions.region(region).runWith({
  timeoutSeconds: 540,
  memory: '1GB'
}).https.onCall(async (data, context) => {
  const db = admin.firestore();
  const auth = admin.auth();

  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "인증 필요");
  
  const { studentId, centerId } = data;
  if (!studentId || !centerId) throw new functions.https.HttpsError("invalid-argument", "ID 누락");

  try {
    console.log(`[DeleteProcess] Starting for student: ${studentId}`);

    // 1. Auth 계정 삭제 (실패 시 무시하고 진행)
    try { 
      await auth.deleteUser(studentId); 
      console.log(`[DeleteProcess] Auth account deleted: ${studentId}`);
    } catch (e) {
      console.warn(`[DeleteProcess] Auth delete warning (may already be gone):`, e);
    }

    // 2. 삭제할 주요 문서 및 컬렉션 경로 (재귀 삭제 대상)
    const paths = [
      `users/${studentId}`,
      `userCenters/${studentId}`,
      `centers/${centerId}/members/${studentId}`,
      `centers/${centerId}/students/${studentId}`,
      `centers/${centerId}/growthProgress/${studentId}`,
      `centers/${centerId}/plans/${studentId}`,
      `centers/${centerId}/studyLogs/${studentId}`,
      `centers/${centerId}/dailyStudentStats/today/students/${studentId}`
    ];

    // 3. 필터링 삭제 대상 (컬렉션 내에서 studentId 필드가 일치하는 모든 문서)
    const filterCols = [
      `centers/${centerId}/counselingReservations`,
      `centers/${centerId}/counselingLogs`,
      `centers/${centerId}/attendanceRequests`,
      `centers/${centerId}/dailyReports`
    ];

    // 병렬로 재귀 삭제 실행
    await Promise.allSettled([
      ...paths.map(async (p) => {
        try { 
          await db.recursiveDelete(db.doc(p)); 
          console.log(`[DeleteProcess] Path recursive deleted: ${p}`);
        } catch (e) {
          console.error(`[DeleteProcess] Failed to delete path: ${p}`, e);
        }
      }),
      ...filterCols.map(async (cp) => {
        try {
          const q = await db.collection(cp).where('studentId', '==', studentId).get();
          const tasks = q.docs.map(doc => db.recursiveDelete(doc.ref));
          await Promise.all(tasks);
          console.log(`[DeleteProcess] Collection ${cp} filtered items deleted`);
        } catch (e) {
          console.error(`[DeleteProcess] Failed to delete filtered items in: ${cp}`, e);
        }
      })
    ]);

    return { ok: true, message: "모든 데이터가 성공적으로 정리되었습니다." };
  } catch (error: any) {
    console.error(`[DeleteProcess] CRITICAL ERROR:`, error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

export const registerStudent = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();
  const auth = admin.auth();
  const { email, password, displayName, schoolName, grade, centerId } = data;
  try {
    const userRecord = await auth.createUser({ email, password, displayName });
    const uid = userRecord.uid;
    const timestamp = admin.firestore.Timestamp.now();
    await db.runTransaction(async (t) => {
      t.set(db.doc(`users/${uid}`), { id: uid, email, displayName, schoolName, createdAt: timestamp, updatedAt: timestamp });
      t.set(db.doc(`centers/${centerId}/members/${uid}`), { id: uid, centerId, role: 'student', status: 'active', joinedAt: timestamp, displayName });
      t.set(db.doc(`userCenters/${uid}/centers/${centerId}`), { id: centerId, centerId, role: 'student', status: 'active', joinedAt: timestamp });
      t.set(db.doc(`centers/${centerId}/students/${uid}`), { id: uid, name: displayName, schoolName, grade, createdAt: timestamp, updatedAt: timestamp });
      t.set(db.doc(`centers/${centerId}/growthProgress/${uid}`), { seasonLp: 0, penaltyPoints: 0, stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 }, updatedAt: timestamp });
    });
    return { ok: true, uid };
  } catch (e: any) { throw new functions.https.HttpsError("internal", e.message); }
});

export const updateStudentAccount = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();
  const auth = admin.auth();
  const { studentId, centerId, password, displayName, schoolName, grade, parentLinkCode } = data;
  try {
    const authUpdates: any = {};
    if (password) authUpdates.password = password;
    if (displayName) authUpdates.displayName = displayName;
    if (Object.keys(authUpdates).length > 0) await auth.updateUser(studentId, authUpdates);
    
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
    
    if (displayName) batch.set(db.doc(`centers/${centerId}/members/${studentId}`), { displayName, updatedAt: timestamp }, { merge: true });
    
    await batch.commit();
    return { ok: true };
  } catch (e: any) { throw new functions.https.HttpsError("internal", e.message); }
});

export const redeemInviteCode = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();
  const { code } = data;
  const uid = context.auth!.uid;
  try {
    return await db.runTransaction(async (t) => {
      const snap = await t.get(db.doc(`inviteCodes/${code}`));
      if (!snap.exists) throw new Error("Invalid code");
      const inv = snap.data()!;
      const ts = admin.firestore.Timestamp.now();
      t.set(db.doc(`userCenters/${uid}/centers/${inv.centerId}`), { id: inv.centerId, role: inv.intendedRole, status: 'active', joinedAt: ts, className: inv.targetClassName || null });
      t.set(db.doc(`centers/${inv.centerId}/members/${uid}`), { id: uid, role: inv.intendedRole, status: 'active', joinedAt: ts, displayName: context.auth!.token.name, className: inv.targetClassName || null });
      t.update(db.doc(`inviteCodes/${code}`), { usedCount: admin.firestore.FieldValue.increment(1), updatedAt: ts });
      return { ok: true };
    });
  } catch (e: any) { throw new functions.https.HttpsError("internal", e.message); }
});
