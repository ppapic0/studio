
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Firebase Admin SDK 초기화
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const region = "asia-northeast3";

/**
 * 하위 컬렉션까지 수동으로 재귀 삭제하는 헬퍼 함수
 * 사용자 제안 로직을 바탕으로 Admin SDK에 최적화함
 */
async function deleteRecursive(ref: admin.firestore.DocumentReference | admin.firestore.CollectionReference) {
  const db = admin.firestore();
  
  if (ref instanceof admin.firestore.DocumentReference) {
    console.log(`[DeleteRecursive] Processing Document: ${ref.path}`);
    // 1. 하위 컬렉션 목록 가져오기 (listCollections는 Admin SDK 전용)
    const subcollections = await ref.listCollections();
    for (const sub of subcollections) {
      await deleteRecursive(sub);
    }
    // 2. 본인 문서 삭제
    await ref.delete();
    console.log(`[DeleteRecursive] Deleted Document: ${ref.path}`);
  } else {
    console.log(`[DeleteRecursive] Processing Collection: ${ref.path}`);
    // 컬렉션인 경우 내부 모든 문서를 가져와서 재귀 삭제
    const snapshot = await ref.get();
    const tasks = snapshot.docs.map(doc => deleteRecursive(doc.ref));
    await Promise.all(tasks);
    console.log(`[DeleteRecursive] Processed all docs in Collection: ${ref.path}`);
  }
}

/**
 * 학생 계정 및 모든 하위 데이터를 강제로 삭제 (Firebase CLI --recursive 모사)
 */
export const deleteStudentAccount = functions.region(region).runWith({
  timeoutSeconds: 540, // 9분
  memory: '1GB'        // 1GB
}).https.onCall(async (data, context) => {
  const db = admin.firestore();
  const auth = admin.auth();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }
  
  const { studentId, centerId } = data;
  if (!studentId || !centerId) {
    throw new functions.https.HttpsError("invalid-argument", "학생 ID와 센터 ID가 필요합니다.");
  }

  try {
    console.log(`[DeleteProcess] Starting deletion for student: ${studentId}`);

    // 1. Firebase Auth 계정 삭제 (실패해도 무시)
    try {
      await auth.deleteUser(studentId);
      console.log(`[DeleteProcess] Auth account deleted: ${studentId}`);
    } catch (authError: any) {
      console.warn(`[DeleteProcess] Auth account error (might be already deleted): ${authError.message}`);
    }

    // 2. 삭제할 주요 문서 경로 (직접 참조 가능)
    const docPaths = [
      `users/${studentId}`,
      `userCenters/${studentId}`, 
      `centers/${centerId}/members/${studentId}`,
      `centers/${centerId}/students/${studentId}`,
      `centers/${centerId}/growthProgress/${studentId}`,
      `centers/${centerId}/plans/${studentId}`,
      `centers/${centerId}/studyLogs/${studentId}`
    ];

    // 3. 필터링이 필요한 데이터 (컬렉션 내에서 studentId로 찾아야 하는 것들)
    const collectionsToFilter = [
      `centers/${centerId}/counselingReservations`,
      `centers/${centerId}/counselingLogs`,
      `centers/${centerId}/attendanceRequests`
    ];

    // 실행 시작
    await Promise.allSettled([
      // 문서 경로 재귀 삭제
      ...docPaths.map(async (path) => {
        try {
          const docRef = db.doc(path);
          await deleteRecursive(docRef);
          console.log(`[DeleteProcess] Successfully deleted: ${path}`);
        } catch (e: any) {
          console.error(`[DeleteProcess] Error deleting path ${path}: ${e.message}`);
        }
      }),
      // 필터링 삭제 (해당 학생의 기록만 골라내서 삭제)
      ...collectionsToFilter.map(async (colPath) => {
        try {
          const q = await db.collection(colPath).where('studentId', '==', studentId).get();
          const tasks = q.docs.map(doc => deleteRecursive(doc.ref));
          await Promise.all(tasks);
          console.log(`[DeleteProcess] Filter-deleted from: ${colPath}`);
        } catch (e: any) {
          console.error(`[DeleteProcess] Error in filter-delete ${colPath}: ${e.message}`);
        }
      })
    ]);

    console.log(`[DeleteProcess] Finalized deletion for student: ${studentId}`);
    return { ok: true, message: "모든 하위 데이터가 수동 재귀 로직에 의해 완전 삭제되었습니다." };

  } catch (error: any) {
    console.error("[DeleteStudent Main Error]", error);
    throw new functions.https.HttpsError("internal", `서버 내부 오류: ${error.message}`);
  }
});

export const registerStudent = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();
  const auth = admin.auth();
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "인증 필요");
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
      t.set(db.doc(`centers/${centerId}/growthProgress/${uid}`), { seasonLp: 0, stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 }, updatedAt: timestamp });
    });
    return { ok: true, uid };
  } catch (e: any) { throw new functions.https.HttpsError("internal", e.message); }
});

export const updateStudentAccount = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();
  const auth = admin.auth();
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "인증 필요");
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
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "인증 필요");
  const { code } = data;
  const uid = context.auth.uid;
  try {
    return await db.runTransaction(async (t) => {
      const snap = await t.get(db.doc(`inviteCodes/${code}`));
      if (!snap.exists) throw new Error("Invalid code");
      const inv = snap.data()!;
      const ts = admin.firestore.Timestamp.now();
      t.set(db.doc(`userCenters/${uid}/centers/${inv.centerId}`), { id: inv.centerId, role: inv.intendedRole, status: 'active', joinedAt: ts });
      t.set(db.doc(`centers/${inv.centerId}/members/${uid}`), { id: uid, role: inv.intendedRole, status: 'active', joinedAt: ts, displayName: context.auth.token.name });
      t.update(db.doc(`inviteCodes/${code}`), { usedCount: admin.firestore.FieldValue.increment(1), updatedAt: ts });
      return { ok: true };
    });
  } catch (e: any) { throw new functions.https.HttpsError("internal", e.message); }
});
