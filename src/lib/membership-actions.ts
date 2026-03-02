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
 * 테스트 학생들을 생성하고 03반, 04반, 과외반에 골고루 배정합니다.
 */
export async function seedInitialData(db: Firestore, uid: string, centerId: string) {
  const batch = writeBatch(db);
  
  // 1. 초대 코드 설정
  batch.set(doc(db, 'inviteCodes', '0313'), { centerId: 'learning-lab-dongbaek', intendedRole: 'student', targetClassName: '03반', maxUses: 999, usedCount: 0, createdAt: serverTimestamp(), isActive: true }, { merge: true });
  batch.set(doc(db, 'inviteCodes', '0404'), { centerId: 'learning-lab-dongbaek', intendedRole: 'student', targetClassName: '04반', maxUses: 999, usedCount: 0, createdAt: serverTimestamp(), isActive: true }, { merge: true });
  batch.set(doc(db, 'inviteCodes', 'TUTOR'), { centerId: 'learning-lab-dongbaek', intendedRole: 'student', targetClassName: '과외반', maxUses: 999, usedCount: 0, createdAt: serverTimestamp(), isActive: true }, { merge: true });
  batch.set(doc(db, 'inviteCodes', 'T0313'), { centerId: 'learning-lab-dongbaek', intendedRole: 'teacher', maxUses: 999, usedCount: 0, createdAt: serverTimestamp(), isActive: true }, { merge: true });
  batch.set(doc(db, 'inviteCodes', 'A0313'), { centerId: 'learning-lab-dongbaek', intendedRole: 'centerAdmin', maxUses: 999, usedCount: 0, createdAt: serverTimestamp(), isActive: true }, { merge: true });

  // 테스트 학생 그룹 (03반, 04반, 과외반)
  const testStudents = [
    { id: 'test-student-03-1', name: '김민수', class: '03반' },
    { id: 'test-student-03-2', name: '이지원', class: '03반' },
    { id: 'test-student-04-1', name: '최강산', class: '04반' },
    { id: 'test-student-04-2', name: '정유리', class: '04반' },
    { id: 'test-student-tutor-1', name: '박과외', class: '과외반' },
    { id: 'test-student-tutor-2', name: '한지수', class: '과외반' },
  ];

  const yesterday = subDays(new Date(), 1);
  const yesterdayKey = format(yesterday, 'yyyy-MM-dd');
  const weekKey = format(yesterday, "yyyy-'W'II");
  const periodKey = format(new Date(), 'yyyy-MM');

  for (const sInfo of testStudents) {
    const sUid = sInfo.id;
    
    // (1) 멤버십 및 사용자 센터 정보 등록
    const memberRef = doc(db, 'centers', centerId, 'members', sUid);
    const userCenterRef = doc(db, 'userCenters', sUid, 'centers', centerId);
    const timestamp = serverTimestamp();

    batch.set(memberRef, {
      id: sUid,
      centerId: centerId,
      role: 'student',
      status: 'active',
      className: sInfo.class,
      displayName: sInfo.name,
      joinedAt: timestamp,
      updatedAt: timestamp
    }, { merge: true });

    batch.set(userCenterRef, {
      id: centerId,
      centerId: centerId,
      role: 'student',
      status: 'active',
      className: sInfo.class,
      joinedAt: timestamp,
      updatedAt: timestamp
    }, { merge: true });

    // (2) 학생 상세 프로필
    const studentProfileRef = doc(db, 'centers', centerId, 'students', sUid);
    batch.set(studentProfileRef, {
      id: sUid,
      name: sInfo.name,
      className: sInfo.class,
      schoolName: '테스트고등학교',
      grade: '3학년',
      seatNo: 0,
      targetDailyMinutes: 360,
      createdAt: timestamp,
    }, { merge: true });

    // (3) 학습 로그 및 통계
    const logRef = doc(db, 'centers', centerId, 'studyLogs', sUid, 'days', yesterdayKey);
    const statRef = doc(db, 'centers', centerId, 'dailyStudentStats', yesterdayKey, 'students', sUid);
    
    batch.set(logRef, {
      totalMinutes: 300 + Math.floor(Math.random() * 200),
      studentId: sUid,
      dateKey: yesterdayKey,
      centerId: centerId,
      updatedAt: timestamp,
      createdAt: timestamp,
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
      updatedAt: timestamp,
    }, { merge: true });

    // (4) 성장 정보 (LP)
    const progressRef = doc(db, 'centers', centerId, 'growthProgress', sUid);
    const randomLp = 3000 + Math.floor(Math.random() * 10000);
    batch.set(progressRef, {
      seasonLp: randomLp,
      level: 10,
      stats: { focus: 40, consistency: 50, achievement: 45, resilience: 30 },
      totalLpEarned: randomLp + 5000,
      lastResetAt: timestamp,
      updatedAt: timestamp
    }, { merge: true });

    // (5) 랭킹 엔트리 생성
    const rankRef = doc(db, 'centers', centerId, 'leaderboards', `${periodKey}_lp`, 'entries', sUid);
    batch.set(rankRef, {
      studentId: sUid,
      displayNameSnapshot: sInfo.name,
      classNameSnapshot: sInfo.class,
      value: randomLp,
      rank: 999,
      updatedAt: timestamp
    }, { merge: true });

    // (6) 기본 계획 생성
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
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
  }

  await batch.commit().catch(async (err) => {
    console.error("Seeding commit failed:", err);
  });
  
  return { ok: true };
}
