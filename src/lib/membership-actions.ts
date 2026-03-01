import { 
  doc, 
  collection, 
  writeBatch, 
  serverTimestamp, 
  Firestore,
  setDoc
} from 'firebase/firestore';
import { format, subDays } from 'date-fns';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * 초기 데이터 시딩용 함수 (관리자용)
 */
export async function seedInitialData(db: Firestore, uid: string, centerId: string) {
  const batch = writeBatch(db);
  
  // 1. 초대 코드 설정
  batch.set(doc(db, 'inviteCodes', '0313'), { centerId: 'learning-lab-dongbaek', intendedRole: 'student', maxUses: 999, usedCount: 0, createdAt: serverTimestamp() }, { merge: true });
  batch.set(doc(db, 'inviteCodes', 'T0313'), { centerId: 'learning-lab-dongbaek', intendedRole: 'teacher', maxUses: 999, usedCount: 0, createdAt: serverTimestamp() }, { merge: true });
  batch.set(doc(db, 'inviteCodes', 'A0313'), { centerId: 'learning-lab-dongbaek', intendedRole: 'centerAdmin', maxUses: 999, usedCount: 0, createdAt: serverTimestamp() }, { merge: true });

  const testStudentUids = ['test-student-1', 'test-student-2', 'test-student-3'];
  const yesterday = subDays(new Date(), 1);
  const yesterdayKey = format(yesterday, 'yyyy-MM-dd');
  const weekKey = format(yesterday, "yyyy-'W'II");

  for (const sUid of testStudentUids) {
    const logRef = doc(db, 'centers', centerId, 'studyLogs', sUid, 'days', yesterdayKey);
    const statRef = doc(db, 'centers', centerId, 'dailyStudentStats', yesterdayKey, 'students', sUid);
    
    batch.set(logRef, {
      totalMinutes: 420,
      studentId: sUid,
      dateKey: yesterdayKey,
      centerId: centerId,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true });

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
      updatedAt: serverTimestamp(),
    }, { merge: true });

    const routineItems = [
      { title: '등원: 08:30', category: 'schedule' },
      { title: '하원: 22:00', category: 'schedule' },
      { title: '수학 문제집 2단원', category: 'study', done: true },
      { title: '영어 단어 100개', category: 'study', done: true },
      { title: '국어 비문학 3지문', category: 'study', done: false },
    ];

    routineItems.forEach((item) => {
      const itemRef = doc(collection(db, 'centers', centerId, 'plans', sUid, 'weeks', weekKey, 'items'));
      batch.set(itemRef, {
        ...item,
        done: item.done || false,
        weight: 1,
        dateKey: yesterdayKey,
        studentId: sUid,
        centerId: centerId,
        studyPlanWeekId: weekKey,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }

  await batch.commit().catch(async (err) => {
    // 에러 발생 시 공통 리스너에서 처리
    console.error("Seeding commit failed:", err);
  });
  
  return { ok: true };
}
