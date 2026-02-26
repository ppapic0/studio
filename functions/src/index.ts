
'use server';
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const DEV_SECRET = functions.config().dev?.secret;

/**
 * 센터가 없으면 생성하고 사용자를 등록하는 부트스트랩 로직
 */
async function bootstrapUserToCenter(
  transaction: admin.firestore.Transaction,
  uid: string,
  email: string,
  displayName: string,
  centerId: string,
  role: string
) {
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  const centerRef = db.doc(`centers/${centerId}`);
  const userRef = db.doc(`users/${uid}`);
  const memberRef = db.doc(`centers/${centerId}/members/${uid}`);
  const userCenterRef = db.doc(`userCenters/${uid}/centers/${centerId}`);

  const centerSnap = await transaction.get(centerRef);
  
  // 1. 센터 자동 생성 (동백센터 정보 우선)
  if (!centerSnap.exists) {
    transaction.set(centerRef, {
      id: centerId,
      name: centerId === 'learning-lab-dongbaek' ? "공부트랙 동백센터" : `센터 (${centerId})`,
      subscriptionTier: "Pro",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  // 2. 사용자 프로필 생성/업데이트
  transaction.set(userRef, {
    id: uid,
    email,
    displayName,
    updatedAt: timestamp,
    createdAt: timestamp,
  }, { merge: true });

  // 3. 멤버십 등록
  transaction.set(memberRef, {
    role,
    status: "active",
    joinedAt: timestamp,
    displayName,
  });

  // 4. 역인덱스 등록 (AuthGuard용)
  transaction.set(userCenterRef, {
    role,
    status: "active",
    joinedAt: timestamp,
  });
}

export const redeemInviteCode = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  
  const { code } = data;
  const uid = context.auth.uid;
  const email = context.auth.token.email || `${uid}@example.com`;
  const displayName = context.auth.token.name || email.split('@')[0];

  try {
    return await db.runTransaction(async (transaction) => {
      // 1. 초대 코드 검색 (최상위 -> 센터 서브컬렉션 순서)
      let inviteRef = db.doc(`inviteCodes/${code}`);
      let inviteSnap = await transaction.get(inviteRef);

      if (!inviteSnap.exists) {
        // 호환성을 위해 동백센터 서브컬렉션도 확인
        inviteRef = db.doc(`centers/learning-lab-dongbaek/inviteCodes/${code}`);
        inviteSnap = await transaction.get(inviteRef);
      }

      if (!inviteSnap.exists) {
        throw new functions.https.HttpsError("not-found", "유효하지 않은 초대 코드입니다.");
      }

      const inviteData = inviteSnap.data()!;
      const centerId = inviteData.centerId || 'learning-lab-dongbaek';
      const role = inviteData.intendedRole || 'student';

      // 2. 부트스트랩 및 가입 처리
      await bootstrapUserToCenter(transaction, uid, email, displayName, centerId, role);

      // 3. 초대 코드 사용 횟수 증가
      transaction.update(inviteRef, {
        usedCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { ok: true, message: "센터 가입이 완료되었습니다!" };
    });
  } catch (error: any) {
    console.error("Redeem Error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", error.message || "서버 내부 오류가 발생했습니다.");
  }
});

export const devJoinCenter = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  
  const { centerId, role, devSecret } = data;
  if (devSecret !== DEV_SECRET && process.env.FUNCTIONS_EMULATOR !== 'true') {
    throw new functions.https.HttpsError("permission-denied", "비밀 키가 올바르지 않습니다.");
  }

  const uid = context.auth.uid;
  const email = context.auth.token.email || `${uid}@example.com`;
  const displayName = context.auth.token.name || "개발자";

  try {
    await db.runTransaction(async (transaction) => {
      await bootstrapUserToCenter(transaction, uid, email, displayName, centerId, role);
    });
    return { ok: true, message: "강제 가입 성공!" };
  } catch (error: any) {
    throw new functions.https.HttpsError("internal", error.message);
  }
});
