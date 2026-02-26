import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const DEV_SECRET = functions.config().dev?.secret;

/**
 * 데이터 생성 부트스트랩 로직
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

  // 1. 센터 자동 생성 (동백센터 전용 이름 설정)
  const centerSnap = await transaction.get(centerRef);
  if (!centerSnap.exists) {
    transaction.set(centerRef, {
      id: centerId,
      name: centerId === 'learning-lab-dongbaek' ? "공부트랙 동백센터" : `센터 (${centerId})`,
      subscriptionTier: "Pro",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  // 2. 사용자 프로필
  transaction.set(userRef, {
    id: uid,
    email,
    displayName,
    updatedAt: timestamp,
    createdAt: timestamp,
  }, { merge: true });

  // 3. 센터 멤버십
  transaction.set(memberRef, {
    role,
    status: "active",
    joinedAt: timestamp,
    displayName,
  });

  // 4. 사용자 센터 인덱스 (역인덱스)
  transaction.set(userCenterRef, {
    role,
    status: "active",
    joinedAt: timestamp,
  });
}

/**
 * 리전을 asia-northeast3 (서울)로 명시적으로 설정
 */
const region = "asia-northeast3";

export const redeemInviteCode = functions.region(region).https.onCall(async (data: any, context: functions.https.CallableContext) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  
  const { code } = data;
  if (!code) throw new functions.https.HttpsError("invalid-argument", "초대 코드가 누락되었습니다.");

  const uid = context.auth.uid;
  const email = context.auth.token.email || `${uid}@example.com`;
  const displayName = context.auth.token.name || email.split('@')[0];

  console.log(`Attempting to redeem code: ${code} for user: ${uid}`);

  try {
    return await db.runTransaction(async (transaction) => {
      // 1. 최상위 /inviteCodes 에서 검색 (문서 ID가 코드인 경우)
      const inviteRef = db.doc(`inviteCodes/${code}`);
      const inviteSnap = await transaction.get(inviteRef);

      if (!inviteSnap.exists) {
        console.error(`Invite code not found: ${code}`);
        throw new functions.https.HttpsError("not-found", "유효하지 않은 초대 코드입니다.");
      }

      const inviteData = inviteSnap.data()!;
      const centerId = inviteData.centerId;
      const role = inviteData.intendedRole || 'student';

      if (!centerId) {
        throw new functions.https.HttpsError("failed-precondition", "초대 코드에 연결된 센터 정보가 없습니다.");
      }

      if (inviteData.maxUses && inviteData.usedCount >= inviteData.maxUses) {
        throw new functions.https.HttpsError("resource-exhausted", "이 초대 코드는 더 이상 사용할 수 없습니다.");
      }

      // 부트스트랩 및 가입 처리
      await bootstrapUserToCenter(transaction, uid, email, displayName, centerId, role);

      // 코드 사용 횟수 업데이트
      transaction.update(inviteRef, {
        usedCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { ok: true, message: "가입이 완료되었습니다!" };
    });
  } catch (error: any) {
    console.error("Redeem Transaction Error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", error.message || "서버 내부 오류");
  }
});

export const devJoinCenter = functions.region(region).https.onCall(async (data: any, context: functions.https.CallableContext) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  
  const { centerId, role, devSecret } = data;
  if (process.env.FUNCTIONS_EMULATOR !== 'true' && devSecret !== DEV_SECRET) {
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
    console.error("Dev Join Error:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});
