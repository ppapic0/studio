'use server';

import { adminDb } from './firebase-admin';
import { FieldValue, Transaction } from 'firebase-admin/firestore';

/**
 * 센터 가입을 위한 공통 부트스트랩 로직
 * 필수 문서들을 한 번에 생성하여 보안 규칙 및 조회 로직이 즉시 작동하게 함
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

  // 2. 사용자 프로필 업데이트/생성
  transaction.set(userRef, {
    id: uid,
    displayName,
    updatedAt: timestamp,
    createdAt: timestamp,
  }, { merge: true });

  // 3. 센터 내 멤버십 정보 생성 (보안 규칙 hasRole의 근거)
  transaction.set(memberRef, {
    role,
    status: "active",
    joinedAt: timestamp,
    displayName,
  });

  // 4. 사용자별 가입 센터 역인덱스 생성 (AuthGuard 조회 근거)
  transaction.set(userCenterRef, {
    centerId,
    role,
    status: "active",
    joinedAt: timestamp,
  });

  // 5. 역할별 추가 초기화 (학생인 경우 성장 로그 등)
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
 * 초대 코드를 검증하고 센터 가입 처리를 수행
 */
export async function redeemInviteCodeAction(uid: string, code: string, displayName: string) {
  if (!code) throw new Error("초대 코드가 필요합니다.");

  try {
    return await adminDb.runTransaction(async (transaction) => {
      const inviteRef = adminDb.doc(`inviteCodes/${code}`);
      const inviteSnap = await transaction.get(inviteRef);

      let inviteData = inviteSnap.exists ? inviteSnap.data() : null;

      // 테스트용 하드코딩 코드 처리 (DB에 문서가 없어도 작동하도록 보장)
      if (!inviteData) {
        if (code === '0313') {
          inviteData = { centerId: 'learning-lab-dongbaek', intendedRole: 'student' };
        } else if (code === 'T0313') {
          inviteData = { centerId: 'learning-lab-dongbaek', intendedRole: 'teacher' };
        }
      }

      if (!inviteData) {
        throw new Error("유효하지 않은 초대 코드입니다. (테스트 코드: 학생 0313, 선생님 T0313)");
      }

      const centerId = inviteData.centerId;
      const role = inviteData.intendedRole || 'student';

      // 모든 필수 데이터 생성 실행
      await performBootstrap(transaction, uid, centerId, role, displayName);

      // 실제 DB에 코드가 존재했다면 사용 횟수 증가
      if (inviteSnap.exists) {
        transaction.update(inviteRef, {
          usedCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      // 선생님 권한인 경우 초기 테스트용 학생 데이터 시딩
      if (role === 'teacher' || role === 'centerAdmin') {
        const mockStudents = [
          { id: 'mock_std_1', name: '김철수', seatNo: 1, grade: '고3' },
          { id: 'mock_std_2', name: '이영희', seatNo: 2, grade: '중3' },
          { id: 'mock_std_3', name: '박지민', seatNo: 3, grade: '고2' },
        ];
        const timestamp = FieldValue.serverTimestamp();
        for (const s of mockStudents) {
          const sRef = adminDb.doc(`centers/${centerId}/students/${s.id}`);
          const aRef = adminDb.doc(`centers/${centerId}/attendanceCurrent/${s.id}`);
          transaction.set(sRef, { ...s, targetDailyMinutes: 360, createdAt: timestamp }, { merge: true });
          transaction.set(aRef, { seatNo: s.seatNo, status: 'studying', updatedAt: timestamp }, { merge: true });
        }
      }

      return { ok: true, message: "가입 및 센터 설정이 완료되었습니다!" };
    });
  } catch (error: any) {
    console.error("Redeem Error:", error);
    throw new Error(error.message || "가입 처리 중 오류가 발생했습니다.");
  }
}

export async function seedInitialData(uid: string, centerId: string) {
  // DB에 초대 코드 문서를 직접 생성하여 관리자 화면 등에서 보이게 함
  const batch = adminDb.batch();
  
  const studentCodeRef = adminDb.doc('inviteCodes/0313');
  batch.set(studentCodeRef, {
    centerId: 'learning-lab-dongbaek',
    intendedRole: 'student',
    maxUses: 999,
    usedCount: 0,
    createdAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const teacherCodeRef = adminDb.doc('inviteCodes/T0313');
  batch.set(teacherCodeRef, {
    centerId: 'learning-lab-dongbaek',
    intendedRole: 'teacher',
    maxUses: 999,
    usedCount: 0,
    createdAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await batch.commit();
  
  // 현재 로그인한 사용자를 관리자로 등록
  return redeemInviteCodeAction(uid, 'T0313', '관리자');
}
