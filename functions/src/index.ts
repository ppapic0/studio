import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const region = "asia-northeast3";

/**
 * 선생님이 학생 계정을 직접 생성하고 센터에 등록하는 함수
 */
export const registerStudent = functions.region(region).https.onCall(async (data, context) => {
  // 1. 권한 확인
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  }
  
  const { email, password, displayName, schoolName, grade, centerId } = data;
  
  if (!email || !password || !displayName || !schoolName || !centerId) {
    throw new functions.https.HttpsError("invalid-argument", "필수 정보가 누락되었습니다.");
  }

  const callerId = context.auth.uid;
  console.log(`[RegisterStudent] Starting registration: Email=${email}, Center=${centerId}, RequestedBy=${callerId}`);

  try {
    // 호출자가 해당 센터의 선생님/관리자인지 확인
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${callerId}`).get();
    const callerData = callerMemberSnap.data();
    
    if (!callerMemberSnap.exists || !['teacher', 'centerAdmin'].includes(callerData?.role)) {
      console.warn(`[RegisterStudent] Permission Denied for UID: ${callerId}`);
      throw new functions.https.HttpsError("permission-denied", "학생을 등록할 권한이 없습니다.");
    }

    // 2. Auth 계정 생성
    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
      });
    } catch (authError: any) {
      console.error(`[RegisterStudent] Auth Creation Failed:`, authError);
      if (authError.code === 'auth/email-already-exists') {
        throw new functions.https.HttpsError("already-exists", "이미 가입된 이메일 주소입니다.");
      }
      throw new functions.https.HttpsError("internal", `계정 생성 중 오류: ${authError.message}`);
    }

    const uid = userRecord.uid;
    const timestamp = admin.firestore.Timestamp.now();

    // 3. Firestore 데이터 일괄 생성 (트랜잭션)
    try {
      await db.runTransaction(async (transaction) => {
        // (1) 기본 유저 프로필
        transaction.set(db.doc(`users/${uid}`), {
          id: uid,
          email,
          displayName,
          schoolName,
          createdAt: timestamp,
          updatedAt: timestamp,
        });

        // (2) 센터 멤버십 정보
        transaction.set(db.doc(`centers/${centerId}/members/${uid}`), {
          id: uid,
          centerId: centerId,
          role: 'student',
          status: "active",
          joinedAt: timestamp,
          displayName,
        });

        // (3) 사용자 가입 센터 인덱스 (AuthGuard 핵심 경로)
        transaction.set(db.doc(`userCenters/${uid}/centers/${centerId}`), {
          id: centerId,
          centerId: centerId,
          role: 'student',
          status: "active",
          joinedAt: timestamp,
        });

        // (4) 학생 상세 프로필
        transaction.set(db.doc(`centers/${centerId}/students/${uid}`), {
          id: uid,
          name: displayName,
          schoolName,
          grade,
          seatNo: 0,
          targetDailyMinutes: 360,
          parentUids: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        });

        // (5) 성장 로드맵 초기화
        transaction.set(db.doc(`centers/${centerId}/growthProgress/${uid}`), {
          level: 1,
          currentXp: 0,
          nextLevelXp: 1000,
          stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 },
          skills: {},
          updatedAt: timestamp,
        });
      });
    } catch (dbError: any) {
      console.error(`[RegisterStudent] Firestore Transaction Failed:`, dbError);
      // Auth 계정은 생성되었으나 DB 저장이 실패한 경우, 관리자가 조치할 수 있도록 로그 남김
      throw new functions.https.HttpsError("internal", `데이터베이스 저장 실패 (UID: ${uid}): ${dbError.message}`);
    }

    console.log(`[RegisterStudent] Successfully registered student: ${uid}`);
    return { ok: true, uid, message: "학생 등록이 완료되었습니다." };

  } catch (error: any) {
    console.error("[RegisterStudent] Fatal Error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", error.message || "서버 내부 오류가 발생했습니다.");
  }
});

/**
 * 초대 코드 사용 및 센터 가입 함수
 */
export const redeemInviteCode = functions.region(region).https.onCall(async (data, context) => {
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
    throw new functions.https.HttpsError("internal", error.message);
  }
});
