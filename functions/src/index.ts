
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Firebase Admin SDK 초기화 (최상단에서 한 번만 수행)
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
 * 학생의 계정 정보(비밀번호 등)를 업데이트하는 함수
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
      try {
        await auth.updateUser(studentId, authUpdates);
      } catch (authError: any) {
        throw new functions.https.HttpsError("internal", `인증 서버 업데이트 실패: ${authError.message}`);
      }
    }

    const timestamp = admin.firestore.Timestamp.now();
    const batch = db.batch();

    const userRef = db.doc(`users/${studentId}`);
    const studentRef = db.doc(`centers/${centerId}/students/${studentId}`);
    const memberRef = db.doc(`centers/${centerId}/members/${studentId}`);

    const userUpdate: any = { updatedAt: timestamp };
    if (displayName) userUpdate.displayName = displayName.trim();
    if (schoolName) userUpdate.schoolName = schoolName.trim();
    batch.set(userRef, userUpdate, { merge: true });
    
    const studentUpdate: any = { updatedAt: timestamp };
    if (displayName) studentUpdate.name = displayName.trim();
    if (schoolName) studentUpdate.schoolName = schoolName.trim();
    if (grade) studentUpdate.grade = grade;
    if (parentLinkCode !== undefined) studentUpdate.parentLinkCode = parentLinkCode;
    batch.set(studentRef, studentUpdate, { merge: true });

    if (displayName) {
      batch.set(memberRef, { displayName: displayName.trim(), updatedAt: timestamp }, { merge: true });
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
 * 학생 계정을 영구 삭제하는 함수 (관리자 전용)
 */
export const deleteStudentAccount = functions.region(region).https.onCall(async (data, context) => {
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
    if (!callerMemberSnap.exists || !['centerAdmin'].includes(callerData?.role)) {
      throw new functions.https.HttpsError("permission-denied", "계정을 삭제할 권한이 없습니다.");
    }

    // 1. Auth 계정 삭제 (비동기 처리, 실패해도 Firestore 데이터는 삭제 시도)
    try {
      await auth.deleteUser(studentId);
    } catch (authError: any) {
      console.warn(`[DeleteStudent Auth Warning] User ${studentId} not found or error:`, authError.message);
    }

    // 2. 관련 모든 데이터 삭제
    const batch = db.batch();
    const paths = [
      `users/${studentId}`,
      `centers/${centerId}/members/${studentId}`,
      `userCenters/${studentId}/centers/${centerId}`,
      `centers/${centerId}/students/${studentId}`,
      `centers/${centerId}/growthProgress/${studentId}`
    ];

    paths.forEach(path => {
      batch.delete(db.doc(path));
    });

    try {
      await batch.commit();
    } catch (batchError: any) {
      throw new functions.https.HttpsError("internal", `DB 데이터 삭제 실패: ${batchError.message}`);
    }

    return { ok: true, message: "계정 및 모든 데이터가 성공적으로 삭제되었습니다." };

  } catch (error: any) {
    console.error("[DeleteStudent Error]", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `서버 처리 중 오류 발생: ${error.message}`);
  }
});

/**
 * 초대 코드 사용 및 센터 가입 함수
 */
export const redeemInviteCode = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  
  const { code } = data;
  const uid = context.auth.uid;
  const email = context.auth.token.email || "";
  const displayName = context.auth.token.name || email.split('@')[0];

  try {
    return await db.runTransaction(async (transaction) => {
      const inviteRef = db.doc(`inviteCodes/${code}`);
      const inviteSnap = await transaction.get(inviteRef);
      
      if (!inviteSnap.exists) throw new functions.https.HttpsError("not-found", "유효하지 않은 초대 코드입니다.");
      
      const inviteData = inviteSnap.data()!;
      if (inviteData.isActive === false || (inviteData.expiresAt && inviteData.expiresAt.toDate() < new Date()) || inviteData.usedCount >= inviteData.maxUses) {
        throw new functions.https.HttpsError("failed-precondition", "사용할 수 없는 초대 코드입니다.");
      }

      const centerId = inviteData.centerId;
      const role = inviteData.intendedRole || 'student';
      const timestamp = admin.firestore.Timestamp.now();

      transaction.set(db.doc(`userCenters/${uid}/centers/${centerId}`), {
        id: centerId,
        centerId: centerId,
        role,
        status: "active",
        joinedAt: timestamp,
      });

      transaction.set(db.doc(`centers/${centerId}/members/${uid}`), {
        id: uid,
        centerId: centerId,
        role,
        status: "active",
        joinedAt: timestamp,
        displayName,
      });

      transaction.update(inviteRef, {
        usedCount: admin.firestore.FieldValue.increment(1),
        updatedAt: timestamp
      });

      return { ok: true, message: "센터 가입이 완료되었습니다." };
    });
  } catch (error: any) {
    console.error("[RedeemInviteCode Error]", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `초대 코드 처리 오류: ${error.message}`);
  }
});
