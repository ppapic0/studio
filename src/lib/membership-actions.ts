
'use server';

import { adminDb } from './firebase-admin';
import { FieldValue, Transaction } from 'firebase-admin/firestore';

/**
 * 센터 가입을 위한 공통 부트스트랩 로직
 * 트랜잭션 객체를 전달받아 모든 필수 문서를 한 번에 처리합니다.
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

  // 2. 사용자 프로필 업데이트
  transaction.set(userRef, {
    id: uid,
    displayName,
    updatedAt: timestamp,
    createdAt: timestamp,
  }, { merge: true });

  // 3. 센터 멤버십 정보
  transaction.set(memberRef, {
    role,
    status: "active",
    joinedAt: timestamp,
    displayName,
  });

  // 4. 사용자별 가입 센터 인덱스
  transaction.set(userCenterRef, {
    role,
    status: "active",
    joinedAt: timestamp,
  });

  // 5. 학생인 경우 성장 로드맵 초기화
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

/**
 * 초대 코드를 사용한 센터 가입 액션
 */
export async function redeemInviteCodeAction(uid: string, code: string, displayName: string) {
  if (!code) throw new Error("초대 코드가 필요합니다.");

  try {
    return await adminDb.runTransaction(async (transaction) => {
      const inviteRef = adminDb.doc(`inviteCodes/${code}`);
      const inviteSnap = await transaction.get(inviteRef);

      let inviteData = inviteSnap.exists ? inviteSnap.data() : null;

      // 테스트용 폴백
      if (!inviteData) {
        if (code === '0313') {
          inviteData = { centerId: 'learning-lab-dongbaek', intendedRole: 'student' };
        } else if (code === 'T0313') {
          inviteData = { centerId: 'learning-lab-dongbaek', intendedRole: 'teacher' };
        }
      }

      if (!inviteData) {
        throw new Error("유효하지 않은 초대 코드입니다.");
      }

      const centerId = inviteData.centerId;
      const role = inviteData.intendedRole || 'student';

      if (inviteData.maxUses && inviteData.usedCount >= inviteData.maxUses) {
        throw new Error("사용 한도가 초과된 코드입니다.");
      }

      // 통합 트랜잭션 실행
      await performBootstrap(transaction, uid, centerId, role, displayName);

      // 코드 사용 횟수 증가
      if (inviteSnap.exists) {
        transaction.update(inviteRef, {
          usedCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      return { ok: true, message: `${role === 'teacher' ? '선생님' : '학생'}으로 가입이 완료되었습니다!` };
    });
  } catch (error: any) {
    console.error("Redeem Transaction Error:", error);
    throw new Error(error.message || "가입 처리 중 오류가 발생했습니다.");
  }
}

/**
 * 개발자용 강제 가입 액션
 */
export async function devJoinCenterAction(data: { uid: string, centerId: string, role: string, devSecret: string }) {
  const { uid, centerId, role, devSecret } = data;
  
  const expectedSecret = process.env.DEV_SECRET || '0313'; 
  if (devSecret !== expectedSecret) {
    throw new Error("개발용 비밀 키가 올바르지 않습니다.");
  }

  try {
    await adminDb.runTransaction(async (transaction) => {
      await performBootstrap(transaction, uid, centerId, role, "개발자");
    });
    return { ok: true, message: "강제 가입 성공!" };
  } catch (error: any) {
    console.error("Dev Join Error:", error);
    throw new Error(error.message);
  }
}

/**
 * 테스트용 초기 데이터 시딩 액션
 */
export async function seedInitialData(uid: string, centerId: string) {
  try {
    await adminDb.runTransaction(async (transaction) => {
      const timestamp = FieldValue.serverTimestamp();

      // 1. 초대 코드 생성
      transaction.set(adminDb.doc(`inviteCodes/0313`), {
        centerId,
        intendedRole: 'student',
        usedCount: 0,
        maxUses: 999,
        createdAt: timestamp,
      });

      transaction.set(adminDb.doc(`inviteCodes/T0313`), {
        centerId,
        intendedRole: 'teacher',
        usedCount: 0,
        maxUses: 100,
        createdAt: timestamp,
      });

      // 2. Mock 학생 데이터
      const mockStudents = [
        { id: 'mock_std_1', name: '김철수', seatNo: 5, grade: '고3' },
        { id: 'mock_std_2', name: '이영희', seatNo: 12, grade: '중3' },
        { id: 'mock_std_3', name: '박지민', seatNo: 24, grade: '고2' },
      ];

      for (const s of mockStudents) {
        transaction.set(adminDb.doc(`centers/${centerId}/students/${s.id}`), {
          name: s.name,
          seatNo: s.seatNo,
          grade: s.grade,
          targetDailyMinutes: 360,
          parentUids: [],
          createdAt: timestamp,
        });

        transaction.set(adminDb.doc(`centers/${centerId}/attendanceCurrent/${s.id}`), {
          seatNo: s.seatNo,
          status: s.id === 'mock_std_2' ? 'away' : 'studying',
          updatedAt: timestamp,
          lastCheckInAt: timestamp,
        });
      }

      // 3. 현재 유저 멤버십 (관리자용)
      await performBootstrap(transaction, uid, centerId, "centerAdmin", "시스템 관리자");
    });
    return { ok: true };
  } catch (error: any) {
    console.error("Seed Error:", error);
    throw new Error(error.message);
  }
}
