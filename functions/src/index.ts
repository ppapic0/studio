
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

  const callerId = context.auth.uid;

  try {
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${callerId}`).get();
    const callerData = callerMemberSnap.data();
    if (!callerMemberSnap.exists || !['teacher', 'centerAdmin'].includes(callerData?.role)) {
      throw new functions.https.HttpsError("permission-denied", "학생을 등록할 권한이 없습니다.");
    }

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

  const callerId = context.auth.uid;

  try {
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${callerId}`).get();
    const callerData = callerMemberSnap.data();
    if (!callerMemberSnap.exists || !['teacher', 'centerAdmin'].includes(callerData?.role)) {
      throw new functions.https.HttpsError("permission-denied", "정보를 수정할 권한이 없습니다.");
    }

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
 * 대량의 데이터를 지워야 하므로 리소스를 넉넉히 할당합니다.
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

  const callerId = context.auth.uid;

  try {
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${callerId}`).get();
    const callerData = callerMemberSnap.data();
    
    // 선생님 또는 관리자만 삭제 가능
    if (!callerMemberSnap.exists || !['teacher', 'centerAdmin'].includes(callerData?.role)) {
      throw new functions.https.HttpsError("permission-denied", "계정을 삭제할 권한이 없습니다.");
    }

    console.log(`[DeleteProcess] 시작: 학생(${studentId}) 센터(${centerId})`);

    // 1. Firebase Auth 계정 삭제
    try {
      await auth.deleteUser(studentId);
      console.log(`[DeleteProcess] Auth 계정 삭제 성공.`);
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        console.warn(`[DeleteProcess Warning] 삭제할 Auth 계정이 이미 존재하지 않습니다.`);
      } else {
        console.error(`[DeleteProcess Auth Error] ${authError.message}`);
        // Auth 삭제 실패가 치명적이지 않다면 계속 진행할 수도 있지만, 안전을 위해 로깅만 합니다.
      }
    }

    // 2. 하위 컬렉션을 포함한 모든 Firestore 데이터 재귀적 삭제
    // recursiveDelete는 지정된 문서와 그 아래의 모든 subcollection을 찾아 강제 삭제합니다.
    const refsToDelete = [
      db.doc(`users/${studentId}`),
      db.doc(`userCenters/${studentId}/centers/${centerId}`),
      db.doc(`centers/${centerId}/members/${studentId}`),
      db.doc(`centers/${centerId}/students/${studentId}`),
      db.doc(`centers/${centerId}/growthProgress/${studentId}`),
      db.doc(`centers/${centerId}/plans/${studentId}`),
      db.doc(`centers/${centerId}/studyLogs/${studentId}`),
    ];

    for (const ref of refsToDelete) {
      try {
        // 해당 경로가 존재하는지 확인하지 않고 바로 recursiveDelete 호출 (Admin SDK는 존재하지 않아도 오류를 내지 않음)
        await db.recursiveDelete(ref);
        console.log(`[DeleteProcess] 재귀 삭제 완료: ${ref.path}`);
      } catch (e: any) {
        console.error(`[DeleteProcess Error] 삭제 실패 (${ref.path}): ${e.message}`);
      }
    }

    // 3. 컬렉션 그룹 기반 일일 통계 문서 삭제 (구조상 별도로 찾아야 함)
    try {
      const statsSnap = await db.collectionGroup('students')
        .where('studentId', '==', studentId)
        .get();
      
      if (!statsSnap.empty) {
        console.log(`[DeleteProcess] 일일 통계 문서 ${statsSnap.size}개 발견. 삭제 중...`);
        const batch = db.batch();
        statsSnap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    } catch (e: any) {
      console.warn(`[DeleteProcess Stats Warning] 통계 문서 삭제 중 오류: ${e.message}`);
    }

    console.log(`[DeleteProcess] 모든 작업이 완료되었습니다.`);
    return { ok: true, message: "계정과 모든 하위 기록이 성공적으로 삭제되었습니다." };

  } catch (error: any) {
    console.error("[DeleteStudent Main Error]", error);
    throw new functions.https.HttpsError("internal", `계정 삭제 중 서버 오류가 발생했습니다: ${error.message}`);
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

      transaction.set(db.doc(`centers/${centerId}/members/${uid}`), {
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
