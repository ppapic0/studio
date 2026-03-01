'use server';

import { adminDb } from './firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { format, subDays } from 'date-fns';

/**
 * 초기 데이터 시딩용 함수 (관리자용)
 * 테스트를 위해 어제의 학습 로그 및 계획 데이터를 주입합니다.
 */
export async function seedInitialData(uid: string, centerId: string) {
  const batch = adminDb.batch();
  
  // 1. 초대 코드 설정
  batch.set(adminDb.doc('inviteCodes/0313'), { centerId: 'learning-lab-dongbaek', intendedRole: 'student', maxUses: 999, usedCount: 0, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.set(adminDb.doc('inviteCodes/T0313'), { centerId: 'learning-lab-dongbaek', intendedRole: 'teacher', maxUses: 999, usedCount: 0, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.set(adminDb.doc('inviteCodes/A0313'), { centerId: 'learning-lab-dongbaek', intendedRole: 'centerAdmin', maxUses: 999, usedCount: 0, createdAt: FieldValue.serverTimestamp() }, { merge: true });

  // 2. 테스트용 학생 계정 리스트 (실제 UID가 있을 경우를 대비하여 하드코딩된 예시 UID들)
  // 사용자 환경에 따라 실제 가입된 학생들의 UID로 대체되거나 추가될 수 있습니다.
  const testStudentUids = ['test-student-1', 'test-student-2', 'test-student-3'];
  const yesterday = subDays(new Date(), 1);
  const yesterdayKey = format(yesterday, 'yyyy-MM-dd');
  const weekKey = format(yesterday, "yyyy-'W'II");

  for (const sUid of testStudentUids) {
    const logRef = adminDb.doc(`centers/${centerId}/studyLogs/${sUid}/days/${yesterdayKey}`);
    const statRef = adminDb.doc(`centers/${centerId}/dailyStudentStats/${yesterdayKey}/students/${sUid}`);
    
    // (1) 전날 학습 로그: 420분 (7시간)
    batch.set(logRef, {
      totalMinutes: 420,
      studentId: sUid,
      dateKey: yesterdayKey,
      centerId: centerId,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // (2) 전날 통계: 완수율 90%, 성장률 +5%
    batch.set(statRef, {
      centerId,
      studentId: sUid,
      dateKey: yesterdayKey,
      todayPlanCompletionRate: 90,
      totalStudyMinutes: 420,
      attendanceStreakDays: 12,
      weeklyPlanCompletionRate: 0.88,
      studyTimeGrowthRate: 0.05,
      riskDetected: false,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // (3) 전날 루틴 계획 (등/하원 기록)
    const routineItems = [
      { title: '등원: 08:30', category: 'schedule' },
      { title: '하원: 22:00', category: 'schedule' },
      { title: '수학 문제집 2단원', category: 'study', done: true },
      { title: '영어 단어 100개', category: 'study', done: true },
      { title: '국어 비문학 3지문', category: 'study', done: false },
    ];

    routineItems.forEach((item, idx) => {
      const itemRef = adminDb.collection(`centers/${centerId}/plans/${sUid}/weeks/${weekKey}/items`).doc();
      batch.set(itemRef, {
        ...item,
        done: item.done || false,
        weight: 1,
        dateKey: yesterdayKey,
        studentId: sUid,
        centerId: centerId,
        studyPlanWeekId: weekKey,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  }

  await batch.commit();
  return { ok: true };
}
