
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Firebase Admin SDK 초기화
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const region = "asia-northeast3";

/**
 * 선생님이 학생 계정을 직접 생성하고 센터에 등록하는 함수
 */
export const registerStudent = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();
  const auth = admin.auth();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }
  
  const { email, password, displayName, schoolName, grade, centerId } = data;
  
  if (!email || !password || !displayName || !centerId) {
    throw new functions.https.HttpsError("invalid-argument", "필수 정보가 누락되었습니다.");
  }

  try {
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: email.trim(),
        password: password,
        displayName: displayName.trim(),
      });
    } catch (authError: any) {
      if (authError.code === 'auth/email-already-exists') {
        throw new functions.https.HttpsError("already-exists", "이미 가입된 이메일 주소입니다.");
      }
      throw new functions.https.HttpsError("internal", `인증 계정 생성 실패: ${authError.message}`);
    }

    const uid = userRecord.uid;
    const timestamp = admin.firestore.Timestamp.now();

    await db.runTransaction(async (transaction) => {
      transaction.set(db.doc(`users/${uid}`), {
        id: uid,
        email: email.trim(),
        displayName: displayName.trim(),
        schoolName: schoolName || '',
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      transaction.set(db.doc(`centers/${centerId}/members/${uid}`), {
        id: uid,
        centerId: centerId,
        role: 'student',
        status: "active",
        joinedAt: timestamp,
        displayName: displayName.trim(),
      });

      transaction.set(db.doc(`userCenters/${uid}/centers/${centerId}`), {
        id: centerId,
        centerId: centerId,
        role: 'student',
        status: "active",
        joinedAt: timestamp,
      });

      transaction.set(db.doc(`centers/${centerId}/students/${uid}`), {
        id: uid,
        name: displayName.trim(),
        schoolName: schoolName || '',
        grade: grade || '',
        seatNo: 0,
        targetDailyMinutes: 360,
        parentUids: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      transaction.set(db.doc(`centers/${centerId}/growthProgress/${uid}`), {
        seasonLp: 0,
        level: 1,
        stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 },
        totalLpEarned: 0,
        lastResetAt: timestamp,
        updatedAt: timestamp,
      });
    });

    return { ok: true, uid, message: "학생 등록이 완료되었습니다." };

  } catch (error: any) {
    console.error("[RegisterStudent Error]", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `서버 처리 오류: ${error.message}`);
  }
});

/**
 * 학생의 계정 정보 업데이트
 */
export const updateStudentAccount = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();
  const auth = admin.auth();

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }
  
  const { studentId, centerId, password, displayName, schoolName, grade, parentLinkCode } = data;
  if (!studentId || !centerId) {
    throw new functions.https.HttpsError("invalid-argument", "학생 ID와 센터 ID가 필요합니다.");
  }

  try {
    const authUpdates: any = {};
    if (password && password.trim().length >= 6) authUpdates.password = password.trim();
    if (displayName && displayName.trim()) authUpdates.displayName = displayName.trim();
    
    if (Object.keys(authUpdates).length > 0) {
      await auth.updateUser(studentId, authUpdates);
    }

    const timestamp = admin.firestore.Timestamp.now();
    const batch = db.batch();

    const userUpdate: any = { updatedAt: timestamp };
    if (displayName) userUpdate.displayName = displayName.trim();
    if (schoolName) userUpdate.schoolName = schoolName.trim();
    batch.set(db.doc(`users/${studentId}`), userUpdate, { merge: true });
    
    const studentUpdate: any = { updatedAt: timestamp };
    if (displayName) studentUpdate.name = displayName.trim();
    if (schoolName) studentUpdate.schoolName = schoolName.trim();
    if (grade) studentUpdate.grade = grade;
    if (parentLinkCode !== undefined) studentUpdate.parentLinkCode = parentLinkCode;
    batch.set(db.doc(`centers/${centerId}/students/${studentId}`), studentUpdate, { merge: true });

    if (displayName) {
      batch.set(db.doc(`centers/${centerId}/members/${studentId}`), { displayName: displayName.trim(), updatedAt: timestamp }, { merge: true });
    }

    await batch.commit();
    return { ok: true, message: "학생 정보가 업데이트되었습니다." };

  } catch (error: any) {
    console.error("[UpdateStudent Error]", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `데이터베이스 처리 오류: ${error.message}`);
  }
});

/**
 * 학생 계정 및 모든 하위 데이터를 강제로 삭제 (Firebase CLI --recursive 모사)
 */
export const deleteStudentAccount = functions.region(region).runWith({
  timeoutSeconds: 540, // 최대 9분
  memory: '1GB'        // 1GB 메모리 할당
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
    // 1. Firebase Auth 계정 삭제 (실패해도 무시)
    try {
      await auth.deleteUser(studentId);
    } catch (authError: any) {
      console.warn(`[DeleteProcess] Auth deletion skipped or user not found: ${authError.message}`);
    }

    // 2. 삭제할 주요 경로 리스트 (하위 컬렉션을 포함하는 문서들)
    const pathsToDelete = [
      `users/${studentId}`,
      `userCenters/${studentId}`, 
      `centers/${centerId}/members/${studentId}`,
      `centers/${centerId}/students/${studentId}`,
      `centers/${centerId}/growthProgress/${studentId}`,
      `centers/${centerId}/plans/${studentId}`,
      `centers/${centerId}/studyLogs/${studentId}`,
      `centers/${centerId}/counselingReservations/${studentId}`,
      `centers/${centerId}/counselingLogs/${studentId}`,
      `centers/${centerId}/dailyStudentStats/days/students/${studentId}` // 특정 학생의 통계 문서
    ];

    // 병렬 재귀 삭제 실행 (AllSettled를 사용하여 하나가 실패해도 끝까지 진행)
    await Promise.allSettled(pathsToDelete.map(async (path) => {
      try {
        const segments = path.split('/').length;
        // 세그먼트 수가 짝수면 문서(doc), 홀수면 컬렉션(collection)
        const ref = segments % 2 === 0 ? db.doc(path) : db.collection(path);
        
        // Firebase Admin SDK의 강력한 재귀 삭제 기능 호출
        await db.recursiveDelete(ref as any);
        console.log(`[DeleteProcess] Successfully deleted path: ${path}`);
      } catch (pathError: any) {
        console.error(`[DeleteProcess Error] Failed to delete path ${path}: ${pathError.message}`);
      }
    }));

    return { ok: true, message: "계정과 모든 하위 기록이 성공적으로 삭제되었습니다." };

  } catch (error: any) {
    console.error("[DeleteStudent Main Error]", error);
    throw new functions.https.HttpsError("internal", `서버 내부 오류: ${error.message}`);
  }
});

/**
 * 초대 코드 사용
 */
export const redeemInviteCode = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  
  const { code } = data;
  const uid = context.auth.uid;
  const displayName = context.auth.token.name || "사용자";

  try {
    return await db.runTransaction(async (transaction) => {
      const inviteRef = db.doc(`inviteCodes/${code}`);
      const inviteSnap = await transaction.get(inviteRef);
      
      if (!inviteSnap.exists) throw new functions.https.HttpsError("not-found", "유효하지 않은 초대 코드입니다.");
      
      const inviteData = inviteSnap.data()!;
      const centerId = inviteData.centerId;
      const role = inviteData.intendedRole || 'student';
      const timestamp = admin.firestore.Timestamp.now();

      transaction.set(db.doc(`userCenters/${uid}/centers/${centerId}`), {
        id: centerId, centerId, role, status: "active", joinedAt: timestamp,
      });

      transaction.set(db.doc(`centers/${inviteData.centerId}/members/${uid}`), {
        id: uid, centerId, role, status: "active", joinedAt: timestamp, displayName,
      });

      transaction.update(inviteRef, {
        usedCount: admin.firestore.FieldValue.increment(1),
        updatedAt: timestamp
      });

      return { ok: true, message: "센터 가입이 완료되었습니다." };
    });
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `처리 오류: ${error.message}`);
  }
});
