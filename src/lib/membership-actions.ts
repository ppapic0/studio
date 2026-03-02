import { 
  doc, 
  collection, 
  writeBatch, 
  serverTimestamp, 
  Firestore,
  Timestamp
} from 'firebase/firestore';
import { format, subDays } from 'date-fns';

/**
 * 초기 데이터 시딩용 함수 (관리자용)
 * 테스트 학생들을 생성하고 03반, 04반, 과외반에 골고루 배정합니다.
 */
export async function seedInitialData(db: Firestore, uid: string, centerId: string) {
  const batch = writeBatch(db);
  
  // 1. 초대 코드 설정
  batch.set(doc(db, 'inviteCodes', '0313'), { centerId: centerId, intendedRole: 'student', targetClassName: '03반', maxUses: 999, usedCount: 0, createdAt: serverTimestamp(), isActive: true }, { merge: true });
  batch.set(doc(db, 'inviteCodes', '0404'), { centerId: centerId, intendedRole: 'student', targetClassName: '04반', maxUses: 999, usedCount: 0, createdAt: serverTimestamp(), isActive: true }, { merge: true });
  batch.set(doc(db, 'inviteCodes', 'TUTOR'), { centerId: centerId, intendedRole: 'student', targetClassName: '과외반', maxUses: 999, usedCount: 0, createdAt: serverTimestamp(), isActive: true }, { merge: true });
  batch.set(doc(db, 'inviteCodes', 'T0313'), { centerId: centerId, intendedRole: 'teacher', maxUses: 999, usedCount: 0, createdAt: serverTimestamp(), isActive: true }, { merge: true });
  batch.set(doc(db, 'inviteCodes', 'A0313'), { centerId: centerId, intendedRole: 'centerAdmin', maxUses: 999, usedCount: 0, createdAt: serverTimestamp(), isActive: true }, { merge: true });

  // 테스트 학생 그룹 (03반, 04반, 과외반)
  const testStudents = [
    { id: 'test-student-03-1', name: '김민수', class: '03반' },
    { id: 'test-student-03-2', name: '이지원', class: '03반' },
    { id: 'test-student-04-1', name: '최강산', class: '04반' },
    { id: 'test-student-04-2', name: '정유리', class: '04반' },
    { id: 'test-student-tutor-1', name: '박과외', class: '과외반' },
    { id: 'test-student-tutor-2', name: '한지수', class: '과외반' },
  ];

  const today = new Date();
  const todayKey = format(today, 'yyyy-MM-dd');
  const yesterday = subDays(today, 1);
  const yesterdayKey = format(yesterday, 'yyyy-MM-dd');
  const weekKey = format(today, "yyyy-'W'II");
  const periodKey = format(today, 'yyyy-MM');

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

    // (3) 학습 로그 및 통계 (오늘 및 어제 데이터 모두 생성)
    const logRefToday = doc(db, 'centers', centerId, 'studyLogs', sUid, 'days', todayKey);
    const logRefYesterday = doc(db, 'centers', centerId, 'studyLogs', sUid, 'days', yesterdayKey);
    const statRefToday = doc(db, 'centers', centerId, 'dailyStudentStats', todayKey, 'students', sUid);
    
    // 어제 기록
    batch.set(logRefYesterday, {
      totalMinutes: 300 + Math.floor(Math.random() * 200),
      studentId: sUid,
      dateKey: yesterdayKey,
      centerId: centerId,
      updatedAt: timestamp,
      createdAt: timestamp,
    }, { merge: true });

    // 오늘 기록
    batch.set(logRefToday, {
      totalMinutes: 180 + Math.floor(Math.random() * 120),
      studentId: sUid,
      dateKey: todayKey,
      centerId: centerId,
      updatedAt: timestamp,
      createdAt: timestamp,
    }, { merge: true });

    batch.set(statRefToday, {
      centerId,
      studentId: sUid,
      dateKey: todayKey,
      todayPlanCompletionRate: 60 + Math.floor(Math.random() * 30),
      totalStudyMinutes: 180 + Math.floor(Math.random() * 120),
      attendanceStreakDays: 5,
      weeklyPlanCompletionRate: 0.85,
      studyTimeGrowthRate: 0.05,
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

    // (6) 실시간 좌석 상태 (일부 학생은 공부 중으로 설정)
    const seatId = `seat_00${testStudents.indexOf(sInfo) + 1}`;
    const isStudying = testStudents.indexOf(sInfo) % 2 === 0;
    batch.set(doc(db, 'centers', centerId, 'attendanceCurrent', seatId), {
      id: seatId,
      seatNo: testStudents.indexOf(sInfo) + 1,
      studentId: sUid,
      status: isStudying ? 'studying' : 'absent',
      type: 'seat',
      lastCheckInAt: isStudying ? Timestamp.fromDate(subDays(new Date(), 0)) : null,
      updatedAt: timestamp
    }, { merge: true });

    // (7) 기본 계획 생성 (오늘)
    const routineItems = [
      { title: '등원 예정: 09:00', category: 'schedule' },
      { title: '하원 예정: 22:00', category: 'schedule' },
      { title: '국어 모의고사 1회', category: 'study', done: true },
      { title: '수학 기출 30문항', category: 'study', done: false },
    ];

    routineItems.forEach((item) => {
      const itemRef = doc(collection(db, 'centers', centerId, 'plans', sUid, 'weeks', weekKey, 'items'));
      batch.set(itemRef, {
        ...item,
        weight: 1,
        dateKey: todayKey,
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
