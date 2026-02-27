'use server';

import { adminDb } from './firebase-admin';
import { FieldValue, Transaction } from 'firebase-admin/firestore';

/**
 * 센터 가입을 위한 공통 부트스트랩 로직
 */
async function performBootstrap(
  transaction: Transaction,
  uid: string,
  centerId: string,
  role: string,
  displayName: string = '사용자'
) {
  const timestamp = FieldValue.serverTimestamp();

  const centerRef = adminDb.doc(`centers/${centerId}`);
  const userRef = adminDb.doc(`users/${uid}`);
  const memberRef = adminDb.doc(`centers/${centerId}/members/${uid}`);
  const userCenterRef = adminDb.doc(`userCenters/${uid}/centers/${centerId}`);

  // 1. 센터 확인 및 생성
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
    displayName,
    updatedAt: timestamp,
    createdAt: timestamp,
  }, { merge: true });

  // 3. 센터 멤버십 (Security Rules의 핵심)
  transaction.set(memberRef, {
    role,
    status: "active",
    joinedAt: timestamp,
    displayName,
  });

  // 4. 역인덱스 (AuthGuard의 핵심)
  transaction.set(userCenterRef, {
    role,
    status: "active",
    joinedAt: timestamp,
  });

  // 5. 역할별 추가 초기화
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
}

export async function redeemInviteCodeAction(uid: string, code: string, displayName: string) {
  if (!code) throw new Error("초대 코드가 필요합니다.");

  try {
    return await adminDb.runTransaction(async (transaction) => {
      const inviteRef = adminDb.doc(`inviteCodes/${code}`);
      const inviteSnap = await transaction.get(inviteRef);

      let inviteData = inviteSnap.exists ? inviteSnap.data() : null;

      // 테스트용 하드코딩 코드 처리
      if (!inviteData) {
        if (code === '0313') inviteData = { centerId: 'learning-lab-dongbaek', intendedRole: 'student' };
        else if (code === 'T0313') inviteData = { centerId: 'learning-lab-dongbaek', intendedRole: 'teacher' };
      }

      if (!inviteData) throw new Error("유효하지 않은 초대 코드입니다.");

      const centerId = inviteData.centerId;
      const role = inviteData.intendedRole || 'student';

      await performBootstrap(transaction, uid, centerId, role, displayName);

      if (inviteSnap.exists) {
        transaction.update(inviteRef, {
          usedCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      // 만약 선생님으로 가입한다면 테스트용 학생 데이터도 심어줌 (최초 1회성)
      if (role === 'teacher' || role === 'centerAdmin') {
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

      return { ok: true, message: "가입이 완료되었습니다!" };
    });
  } catch (error: any) {
    console.error("Redeem Error:", error);
    throw new Error(error.message);
  }
}

export async function devJoinCenterAction(data: { uid: string, centerId: string, role: string, devSecret: string }) {
  const { uid, centerId, role, devSecret } = data;
  if (devSecret !== (process.env.DEV_SECRET || '0313')) throw new Error("비밀키 불일치");

  try {
    await adminDb.runTransaction(async (transaction) => {
      await performBootstrap(transaction, uid, centerId, role, "개발자");
    });
    return { ok: true, message: "강제 가입 성공" };
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function seedInitialData(uid: string, centerId: string) {
  return redeemInviteCodeAction(uid, 'T0313', '관리자');
}