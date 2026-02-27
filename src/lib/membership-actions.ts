'use server';

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * 초대 코드를 검증하고 센터 가입 처리를 수행합니다.
 * 트랜잭션을 사용하여 모든 필수 문서(User, Center, Member, UserCenter)를 원자적으로 생성합니다.
 */
export async function redeemInviteCodeAction(uid: string, code: string, displayName: string) {
  if (!code) throw new Error("초대 코드가 필요합니다.");

  try {
    return await adminDb.runTransaction(async (transaction) => {
      // 1. 초대 코드 정보 결정 (테스트용 하드코딩 포함)
      let centerId = 'learning-lab-dongbaek';
      let role: 'student' | 'teacher' = 'student';

      if (code === 'T0313') {
        role = 'teacher';
      } else if (code === '0313') {
        role = 'student';
      } else {
        // 실제 DB에서 코드 확인
        const inviteRef = adminDb.doc(`inviteCodes/${code}`);
        const inviteSnap = await transaction.get(inviteRef);
        if (!inviteSnap.exists) {
          throw new Error("유효하지 않은 초대 코드입니다. (테스트 코드: 학생 0313, 선생님 T0313)");
        }
        const data = inviteSnap.data()!;
        centerId = data.centerId;
        role = data.intendedRole || 'student';
        
        if (data.maxUses && data.usedCount >= data.maxUses) {
          throw new Error("사용 횟수가 초과된 초대 코드입니다.");
        }
        transaction.update(inviteRef, { usedCount: FieldValue.increment(1) });
      }

      const timestamp = FieldValue.serverTimestamp();
      const centerRef = adminDb.doc(`centers/${centerId}`);
      const userRef = adminDb.doc(`users/${uid}`);
      const memberRef = adminDb.doc(`centers/${centerId}/members/${uid}`);
      const userCenterRef = adminDb.doc(`userCenters/${uid}/centers/${centerId}`);

      // 2. 센터 정보 보장
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

      // 3. 핵심 문서들 생성 (보안 규칙 및 조회용)
      transaction.set(userRef, { id: uid, displayName, updatedAt: timestamp, createdAt: timestamp }, { merge: true });
      
      // /centers/{centerId}/members/{uid} -> hasRole() 규칙의 근거
      transaction.set(memberRef, {
        role,
        status: "active",
        joinedAt: timestamp,
        displayName,
      });

      // /userCenters/{uid}/centers/{centerId} -> AuthGuard 조회 근거
      transaction.set(userCenterRef, {
        role,
        status: "active",
        joinedAt: timestamp,
      });

      // 4. 학생용 초기화
      if (role === 'student') {
        const progressRef = adminDb.doc(`centers/${centerId}/growthProgress/${uid}`);
        transaction.set(progressRef, {
          level: 1,
          currentXp: 0,
          nextLevelXp: 1000,
          stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 },
          skills: {},
          updatedAt: timestamp,
        }, { merge: true });
      }

      // 5. 선생님용 초기 데이터 시딩
      if (role === 'teacher') {
        const mockStudents = [
          { id: 'mock_std_1', name: '김철수', seatNo: 1, grade: '고3' },
          { id: 'mock_std_2', name: '이영희', seatNo: 2, grade: '중3' },
          { id: 'mock_std_3', name: '박지민', seatNo: 3, grade: '고2' },
        ];
        for (const s of mockStudents) {
          const sRef = adminDb.doc(`centers/${centerId}/students/${s.id}`);
          const aRef = adminDb.doc(`centers/${centerId}/attendanceCurrent/${s.id}`);
          transaction.set(sRef, { ...s, targetDailyMinutes: 360, createdAt: timestamp }, { merge: true });
          transaction.set(aRef, { seatNo: s.seatNo, status: 'studying', updatedAt: timestamp }, { merge: true });
        }
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
