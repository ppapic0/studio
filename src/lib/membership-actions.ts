
'use server';

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * 센터 가입을 위한 공통 부트스트랩 로직 (서버 사이드)
 */
async function bootstrapUserToCenter(
  uid: string,
  centerId: string,
  role: string,
  displayName: string = '사용자'
) {
  const timestamp = FieldValue.serverTimestamp();
  const batch = adminDb.batch();

  const centerRef = adminDb.doc(`centers/${centerId}`);
  const userRef = adminDb.doc(`users/${uid}`);
  const memberRef = adminDb.doc(`centers/${centerId}/members/${uid}`);
  const userCenterRef = adminDb.doc(`userCenters/${uid}/centers/${centerId}`);

  // 1. 센터 자동 생성 (동백센터 특화)
  const centerSnap = await centerRef.get();
  if (!centerSnap.exists) {
    batch.set(centerRef, {
      id: centerId,
      name: centerId === 'learning-lab-dongbaek' ? "공부트랙 동백센터" : `센터 (${centerId})`,
      subscriptionTier: "Pro",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  // 2. 사용자 프로필 업데이트
  batch.set(userRef, {
    id: uid,
    displayName,
    updatedAt: timestamp,
  }, { merge: true });

  // 3. 센터 멤버십 정보
  batch.set(memberRef, {
    role,
    status: "active",
    joinedAt: timestamp,
    displayName,
  });

  // 4. 사용자별 가입 센터 인덱스
  batch.set(userCenterRef, {
    role,
    status: "active",
    joinedAt: timestamp,
  });

  await batch.commit();
}

/**
 * 초대 코드를 사용한 센터 가입 액션
 */
export async function redeemInviteCodeAction(uid: string, code: string, displayName: string) {
  if (!code) throw new Error("초대 코드가 필요합니다.");

  return await adminDb.runTransaction(async (transaction) => {
    const inviteRef = adminDb.doc(`inviteCodes/${code}`);
    const inviteSnap = await transaction.get(inviteRef);

    if (!inviteSnap.exists) {
      throw new Error("유효하지 않은 초대 코드입니다.");
    }

    const inviteData = inviteSnap.data()!;
    const centerId = inviteData.centerId;
    const role = inviteData.intendedRole || 'student';

    if (inviteData.maxUses && inviteData.usedCount >= inviteData.maxUses) {
      throw new Error("이미 사용 한도가 초과된 코드입니다.");
    }

    // 가입 처리
    await bootstrapUserToCenter(uid, centerId, role, displayName);

    // 사용 횟수 증가
    transaction.update(inviteRef, {
      usedCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    });

    return { ok: true, message: "가입이 완료되었습니다!" };
  });
}

/**
 * 개발자용 강제 가입 액션
 */
export async function devJoinCenterAction(data: { uid: string, centerId: string, role: string, devSecret: string }) {
  const { uid, centerId, role, devSecret } = data;
  
  // 보안 확인 (환경변수 또는 고정값)
  const expectedSecret = process.env.DEV_SECRET || '0313'; 
  if (devSecret !== expectedSecret) {
    throw new Error("개발용 비밀 키가 올바르지 않습니다.");
  }

  await bootstrapUserToCenter(uid, centerId, role, "개발자");
  return { ok: true, message: "강제 가입 성공!" };
}
