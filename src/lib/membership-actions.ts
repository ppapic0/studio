import { 
  doc, 
  collection, 
  writeBatch, 
  serverTimestamp, 
  Firestore,
} from 'firebase/firestore';
import { format, subDays } from 'date-fns';

/**
 * 초기 데이터 시딩용 함수 (관리자용)
 */
export async function seedInitialData(db: Firestore, uid: string, centerId: string) {
  const batch = writeBatch(db);
  
  // 1. 초대 코드 설정
  batch.set(doc(db, 'inviteCodes', '0313'), { centerId: 'learning-lab-dongbaek', intendedRole: 'student', targetClassName: '03반', maxUses: 999, usedCount: 0, createdAt: serverTimestamp(), isActive: true }, { merge: true });
  batch.set(doc(db, 'inviteCodes', '0404'), { centerId: 'learning-lab-dongbaek', intendedRole: 'student', targetClassName: '04반', maxUses: 999, usedCount: 0, createdAt: serverTimestamp(), isActive: true }, { merge: true });
  batch.set(doc(db, 'inviteCodes', 'T0313'), { centerId: 'learning-lab-dongbaek', intendedRole: 'teacher', maxUses: 999, usedCount: 0, createdAt: serverTimestamp(), isActive: true }, { merge: true });
  batch.set(doc(db, 'inviteCodes', 'A0313'), { centerId: 'learning-lab-dongbaek', intendedRole: 'centerAdmin', maxUses: 999, usedCount: 0, createdAt: serverTimestamp(), isActive: true }, { merge: true });

  // 테스트 학생 그룹 (03반 3명, 04반 2명)
  const testStudents = [
    { id: 'test-student-03-1', name: '김민수', class: '03반' },
    { id: 'test-student-03-2', name: '이지원', class: '03반' },
    { id: 'test-student-03-3', name: '박하늘', class: '03반' },
    { id: 'test-student-04-1', name: '최강산', class: '04반' },
    { id: 'test-student-04-2', name: '정유리', class: '04반' },
  ];

  const yesterday = subDays(new Date(), 1);
  const yesterdayKey = format(yesterday, 'yyyy-MM-dd');
  const weekKey = format(yesterday, "yyyy-'W'II");
  const periodKey = format(new Date(), 'yyyy-MM');

  for (const sInfo of testStudents) {
    const sUid = sInfo.id;
    const logRef = doc(db, 'centers', centerId, 'studyLogs', sUid, 'days', yesterdayKey);
    const statRef = doc(db, 'centers', centerId, 'dailyStudentStats', yesterdayKey, 'students', sUid);
    
    // 기본 로그 및 통계
    batch.set(logRef, {
      totalMinutes: 300 + Math.floor(Math.random() * 200),
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
      todayPlanCompletionRate: 80 + Math.floor(Math.random() * 20),
      totalStudyMinutes: 300 + Math.floor(Math.random() * 200),
      attendanceStreakDays: 5,
      weeklyPlanCompletionRate: 0.85,
      studyTimeGrowthRate: 0.02,
      riskDetected: false,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // 초기 성장 정보
    const progressRef = doc(db, 'centers', centerId, 'growthProgress', sUid);
    const randomLp = 3000 + Math.floor(Math.random() * 10000);
    batch.set(progressRef, {
      seasonLp: randomLp,
      mastery: 10,
      stats: { focus: 40, consistency: 50, achievement: 45, resilience: 30 },
      totalLpEarned: randomLp + 5000,
      lastResetAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    // 랭킹 엔트리 생성 (04반 데이터 포함)
    const rankRef = doc(db, 'centers', centerId, 'leaderboards', `${periodKey}_lp`, 'entries', sUid);
    batch.set(rankRef, {
      studentId: sUid,
      displayNameSnapshot: sInfo.name,
      classNameSnapshot: sInfo.class,
      value: randomLp,
      rank: 999,
      updatedAt: serverTimestamp()
    }, { merge: true });

    const routineItems = [
      { title: '등원 예정: 09:00', category: 'schedule' },
      { title: '하원 예정: 22:00', category: 'schedule' },
      { title: '국어 모의고사 1회', category: 'study', done: true },
      { title: '수학 기출 30문항', category: 'study', done: true },
    ];

    routineItems.forEach((item) => {
      const itemRef = doc(collection(db, 'centers', centerId, 'plans', sUid, 'weeks', weekKey, 'items'));
      batch.set(itemRef, {
        ...item,
        done: true,
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
    console.error("Seeding commit failed:", err);
  });
  
  return { ok: true };
}
