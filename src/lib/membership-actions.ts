'use server';

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * 초대 코드를 검증하고 센터 가입 처리를 수행합니다.
 * 트랜잭션을 사용하여 모든 필수 문서(Center, Member, UserCenter)를 원자적으로 생성합니다.
 */
export async function redeemInviteCodeAction(uid: string, code: string, displayName: string) {
  if (!code) throw new Error("초대 코드가 필요합니다.");

  const fixedCenterId = 'learning-lab-dongbaek';

  try {
    return await adminDb.runTransaction(async (transaction) => {
      // 1. 초대 코드 정보 결정
      let role: 'student' | 'teacher' = 'student';

      if (code === 'T0313') {
        role = 'teacher';
      } else if (code === '0313') {
        role = 'student';
      } else {
        const inviteRef = adminDb.doc(`inviteCodes/${code}`);
        const inviteSnap = await transaction.get(inviteRef);
        if (!inviteSnap.exists) {
          throw new Error("유효하지 않은 초대 코드입니다. (학생: 0313, 선생님: T0313)");
        }
        const data = inviteSnap.data()!;
        role = data.intendedRole || 'student';
        
        if (data.maxUses && data.usedCount >= data.maxUses) {
          throw new Error("사용 횟수가 초과된 초대 코드입니다.");
        }
        transaction.update(inviteRef, { usedCount: FieldValue.increment(1) });
      }

      const timestamp = FieldValue.serverTimestamp();
      const centerRef = adminDb.doc(`centers/${fixedCenterId}`);
      const memberRef = adminDb.doc(`centers/${fixedCenterId}/members/${uid}`);
      const userCenterRef = adminDb.doc(`userCenters/${uid}/centers/${fixedCenterId}`);

      // 2. 센터 정보 보장
      const centerSnap = await transaction.get(centerRef);
      if (!centerSnap.exists) {
        transaction.set(centerRef, {
          id: fixedCenterId,
          name: "공부트랙 동백센터",
          subscriptionTier: "Pro",
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      // 3. 멤버십 문서 생성 (보안 규칙 필수 참조 경로)
      transaction.set(memberRef, {
        id: uid, // Member ID는 사용자의 UID여야 함
        centerId: fixedCenterId,
        role,
        status: "active",
        joinedAt: timestamp,
        displayName,
      });

      // 4. 사용자 센터 역인덱스 생성 (AuthGuard 리스너 경로)
      transaction.set(userCenterRef, {
        id: fixedCenterId,
        centerId: fixedCenterId,
        role,
        status: "active",
        joinedAt: timestamp,
      });

      // 5. 학생일 경우 추가 초기 데이터 설정
      if (role === 'student') {
        const progressRef = adminDb.doc(`centers/${fixedCenterId}/growthProgress/${uid}`);
        transaction.set(progressRef, {
          level: 1,
          currentXp: 0,
          nextLevelXp: 1000,
          stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 },
          skills: {},
          updatedAt: timestamp,
        }, { merge: true });
      }

      return { ok: true, message: `${role === 'teacher' ? '선생님' : '학생'} 가입이 완료되었습니다!` };
    });
  } catch (error: any) {
    console.error("Redeem Transaction Error:", error);
    throw new Error(error.message || "가입 처리 중 오류가 발생했습니다.");
  }
}

export async function seedInitialData(uid: string, centerId: string) {
  const batch = adminDb.batch();
  batch.set(adminDb.doc('inviteCodes/0313'), { centerId: 'learning-lab-dongbaek', intendedRole: 'student', maxUses: 999, usedCount: 0, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.set(adminDb.doc('inviteCodes/T0313'), { centerId: 'learning-lab-dongbaek', intendedRole: 'teacher', maxUses: 999, usedCount: 0, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
  return { ok: true };
}
