
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

/**
 * 테스트용 초기 데이터 시딩 액션
 */
export async function seedInitialData(uid: string, centerId: string) {
  const timestamp = FieldValue.serverTimestamp();
  const dateKey = new Date().toISOString().split('T')[0];
  const weekId = `2024-W01`; 

  const batch = adminDb.batch();

  // 1. users
  batch.set(adminDb.doc(`users/${uid}`), {
    id: uid,
    displayName: "테스트 학생",
    createdAt: timestamp,
    updatedAt: timestamp,
  }, { merge: true });

  // 2. centers & members
  batch.set(adminDb.doc(`centers/${centerId}`), {
    id: centerId,
    name: "테스트 센터",
    createdAt: timestamp,
    updatedAt: timestamp,
  }, { merge: true });

  batch.set(adminDb.doc(`centers/${centerId}/members/${uid}`), {
    role: "student",
    status: "active",
    joinedAt: timestamp,
    displayName: "테스트 학생",
  });

  // 3. appointments
  const apt1 = adminDb.collection(`centers/${centerId}/appointments`).doc();
  batch.set(apt1, {
    studentId: uid,
    studentName: "테스트 학생",
    teacherId: "teacher_placeholder",
    startAt: timestamp,
    endAt: timestamp,
    status: "confirmed",
    createdByRole: "student",
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  // 4. counselingNotes
  const note1 = adminDb.collection(`centers/${centerId}/counselingNotes`).doc();
  batch.set(note1, {
    studentId: uid,
    studentName: "테스트 학생",
    teacherId: "teacher_placeholder",
    content: "학습 루틴 점검 및 목표 설정. 수학 미적분 위주로 학습 계획을 수립함.",
    visibility: "student_and_parent",
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  // 5. plans
  const plan1 = adminDb.collection(`centers/${centerId}/plans/${uid}/weeks/${weekId}/items`).doc();
  batch.set(plan1, {
    title: "수학 미적분",
    weight: 1,
    done: false,
    dateKey: dateKey,
    studentId: uid,
    centerId: centerId,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  // 6. studyLogs
  batch.set(adminDb.doc(`centers/${centerId}/studyLogs/${uid}/days/${dateKey}`), {
    totalMinutes: 210,
    dateKey: dateKey,
    studentId: uid,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  // 7. dailyStudentStats
  batch.set(adminDb.doc(`centers/${centerId}/dailyStudentStats/${dateKey}/students/${uid}`), {
    totalMinutes: 210,
    todayPlanCompletionRate: 0.5,
    updatedAt: timestamp,
  });

  // 8. growthProgress - Curved Leveling Initial Data
  batch.set(adminDb.doc(`centers/${centerId}/growthProgress/${uid}`), {
    level: 1,
    currentXp: 150,
    nextLevelXp: 1000, // Curved initial threshold
    stats: { focus: 15, consistency: 10, achievement: 5, resilience: 8 },
    updatedAt: timestamp,
  });

  // 9. userCenters
  batch.set(adminDb.doc(`userCenters/${uid}/centers/${centerId}`), {
    role: "student",
    status: "active",
    joinedAt: timestamp,
  });

  await batch.commit();
  return { ok: true };
}
