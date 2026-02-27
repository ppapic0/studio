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
  console.log(`[RegisterStudent] Starting registration for ${email} by ${callerId} in center ${centerId}`);

  try {
    // 호출자가 해당 센터의 권한이 있는지 확인
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${callerId}`).get();
    
    if (!callerMemberSnap.exists || !['teacher', 'centerAdmin'].includes(callerMemberSnap.data()?.role)) {
      throw new functions.https.HttpsError("permission-denied", "학생을 등록할 권한이 없습니다.");
    }

    // 2. Auth 계정 생성
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
    });

    const uid = userRecord.uid;
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // 3. Firestore 데이터 일괄 생성 (트랜잭션)
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
        role: 'student',
        status: "active",
        joinedAt: timestamp,
        displayName,
      });

      // (3) 사용자 가입 센터 인덱스 (로그인 리디렉션용)
      transaction.set(db.doc(`userCenters/${uid}/centers/${centerId}`), {
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

    console.log(`[RegisterStudent] Successfully registered student: ${uid}`);
    return { ok: true, uid, message: "학생 등록이 완료되었습니다." };
  } catch (error: any) {
    console.error("[RegisterStudent] Error:", error);
    
    if (error instanceof functions.https.HttpsError) throw error;

    if (error.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError("already-exists", "이미 가입된 이메일 주소입니다.");
    }
    
    throw new functions.https.HttpsError("internal", error.message || "서비 내부 오류가 발생했습니다.");
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

      const timestamp = admin.firestore.FieldValue.serverTimestamp();

      transaction.set(db.doc(`userCenters/${uid}/centers/${centerId}`), {
        role,
        status: "active",
        joinedAt: timestamp,
      });

      transaction.set(db.doc(`centers/${centerId}/members/${uid}`), {
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
