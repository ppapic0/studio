'use server';

import { adminDb, adminAuth } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * 초대 코드를 검증하고 센터 가입 처리를 수행합니다.
 */
export async function redeemInviteCodeAction(uid: string, code: string, displayName: string) {
  if (!code) throw new Error("초대 코드가 필요합니다.");

  const fixedCenterId = 'learning-lab-dongbaek';

  try {
    return await adminDb.runTransaction(async (transaction) => {
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

      transaction.set(memberRef, {
        id: uid,
        centerId: fixedCenterId,
        role,
        status: "active",
        joinedAt: timestamp,
        displayName,
      });

      transaction.set(userCenterRef, {
        id: fixedCenterId,
        centerId: fixedCenterId,
        role,
        status: "active",
        joinedAt: timestamp,
      });

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

/**
 * 선생님이 학생 계정을 직접 생성하고 센터에 등록합니다. (회원가입 프로세스 대행)
 */
export async function registerStudentAction(data: {
  email: string;
  password: string;
  displayName: string;
  schoolName: string;
  grade: string;
  targetDailyMinutes: number;
  centerId: string;
}) {
  try {
    // 1. Auth 계정 생성
    const userRecord = await adminAuth.createUser({
      email: data.email,
      password: data.password,
      displayName: data.displayName,
    });

    const uid = userRecord.uid;
    const timestamp = FieldValue.serverTimestamp();

    await adminDb.runTransaction(async (transaction) => {
      // 2. 기본 프로필 생성
      transaction.set(adminDb.doc(`users/${uid}`), {
        id: uid,
        email: data.email,
        displayName: data.displayName,
        schoolName: data.schoolName,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      // 3. 센터 멤버십 설정
      transaction.set(adminDb.doc(`centers/${data.centerId}/members/${uid}`), {
        id: uid,
        centerId: data.centerId,
        role: 'student',
        status: "active",
        joinedAt: timestamp,
        displayName: data.displayName,
      });

      // 4. 사용자 센터 역인덱스 (AuthGuard용)
      transaction.set(adminDb.doc(`userCenters/${uid}/centers/${data.centerId}`), {
        id: data.centerId,
        centerId: data.centerId,
        role: 'student',
        status: "active",
        joinedAt: timestamp,
      });

      // 5. 학생 상세 프로필
      transaction.set(adminDb.doc(`centers/${data.centerId}/students/${uid}`), {
        id: uid,
        name: data.displayName,
        schoolName: data.schoolName,
        grade: data.grade,
        seatNo: 0,
        targetDailyMinutes: data.targetDailyMinutes,
        parentUids: [],
        createdAt: timestamp,
      });

      // 6. 성장 로드맵 초기화
      transaction.set(adminDb.doc(`centers/${data.centerId}/growthProgress/${uid}`), {
        level: 1,
        currentXp: 0,
        nextLevelXp: 1000,
        stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 },
        skills: {},
        updatedAt: timestamp,
      });
    });

    return { ok: true, message: "학생 계정 생성 및 등록이 완료되었습니다." };
  } catch (error: any) {
    console.error("Register Student Error:", error);
    throw new Error(error.message || "학생 등록 중 오류가 발생했습니다.");
  }
}

export async function seedInitialData(uid: string, centerId: string) {
  const batch = adminDb.batch();
  batch.set(adminDb.doc('inviteCodes/0313'), { centerId: 'learning-lab-dongbaek', intendedRole: 'student', maxUses: 999, usedCount: 0, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.set(adminDb.doc('inviteCodes/T0313'), { centerId: 'learning-lab-dongbaek', intendedRole: 'teacher', maxUses: 999, usedCount: 0, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
  return { ok: true };
}
