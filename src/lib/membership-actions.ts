
import { 
  doc, 
  collection, 
  writeBatch, 
  serverTimestamp, 
  Firestore,
  getDoc,
} from 'firebase/firestore';
import { format, subDays, startOfDay } from 'date-fns';

/**
 * 초기 데이터 주입용 함수 (관리자용)
 * 테스트 학생들을 생성하고 03반, 04반, 과외반에 골고루 배정합니다.
 * 또한 최근 30일간의 센터 KPI 데이터를 생성하여 그래프를 정상적으로 표시합니다.
 */
export async function seedInitialData(db: Firestore, uid: string, centerId: string) {
  const [memberSnap, userCenterSnap] = await Promise.all([
    getDoc(doc(db, 'centers', centerId, 'members', uid)),
    getDoc(doc(db, 'userCenters', uid, 'centers', centerId)),
  ]);
  const callerRole = String(memberSnap.data()?.role || userCenterSnap.data()?.role || '').trim();
  const isAdmin =
    callerRole === 'centerAdmin' ||
    callerRole === 'owner' ||
    callerRole === 'admin' ||
    callerRole === 'centerManager';

  if (!isAdmin) {
    throw new Error('센터 관리자만 초기 데이터 시딩을 실행할 수 있습니다.');
  }

  const batch = writeBatch(db);
  const today = new Date();
  const timestamp = serverTimestamp();
  const periodKey = format(today, 'yyyy-MM');
  
  // 1. 초대 코드 설정
  const inviteCodes = [
    { id: '0313', role: 'student', class: '03반' },
    { id: '0404', role: 'student', class: '04반' },
    { id: 'TUTOR', role: 'student', class: '과외반' },
    { id: 'T0313', role: 'teacher', class: '' },
    { id: 'P0313', role: 'parent', class: '' },
    { id: 'A0313', role: 'centerAdmin', class: '' }
  ];

  inviteCodes.forEach(inv => {
    batch.set(doc(db, 'inviteCodes', inv.id), { 
      centerId: centerId, 
      intendedRole: inv.role, 
      targetClassName: inv.class || null, 
      maxUses: 999, 
      usedCount: 0, 
      createdAt: serverTimestamp(), 
      isActive: true 
    }, { merge: true });
  });

  // 테스트 학생 그룹 (랭킹 형성을 위한 LP 점수 차등 부여)
  const testStudents = [
    { id: 'test-student-03-1', name: '김철수', class: '03반', lp: 32500, rank: 1 },
    { id: 'test-student-03-2', name: '이현우', class: '03반', lp: 28200, rank: 2 },
    { id: 'test-student-04-1', name: '최강산', class: '04반', lp: 24800, rank: 3 },
    { id: 'test-student-04-2', name: '정유리', class: '04반', lp: 18500, rank: 4 },
    { id: 'test-student-tutor-1', name: '박과외', class: '과외반', lp: 12200, rank: 5 },
    { id: 'test-student-tutor-2', name: '한지수', class: '과외반', lp: 8000, rank: 6 },
  ];

  // 학생별 시퀀셜 데이터 생성
  for (const sInfo of testStudents) {
    const sUid = sInfo.id;
    const memberRef = doc(db, 'centers', centerId, 'members', sUid);
    const userCenterRef = doc(db, 'userCenters', sUid, 'centers', centerId);

    // 멤버십 정보
    batch.set(memberRef, {
      id: sUid, centerId, role: 'student', status: 'active', className: sInfo.class,
      displayName: sInfo.name, joinedAt: timestamp, updatedAt: timestamp
    }, { merge: true });

    batch.set(userCenterRef, {
      id: centerId, centerId, role: 'student', status: 'active', className: sInfo.class,
      joinedAt: timestamp, updatedAt: timestamp
    }, { merge: true });

    // 학생 프로필
    const studentProfileRef = doc(db, 'centers', centerId, 'students', sUid);
    batch.set(studentProfileRef, {
      id: sUid, name: sInfo.name, className: sInfo.class, schoolName: '트랙고등학교',
      grade: '3학년', seatNo: 0, targetDailyMinutes: 360, parentLinkCode: '123456',
      createdAt: timestamp, updatedAt: timestamp,
    }, { merge: true });

    const billingProfileRef = doc(db, 'centers', centerId, 'billingProfiles', sUid);
    batch.set(billingProfileRef, {
      id: sUid,
      studentId: sUid,
      centerId,
      monthlyFee: 390000,
      createdAt: timestamp,
      updatedAt: timestamp,
    }, { merge: true });

    // 성장 지표 초기화
    const progressRef = doc(db, 'centers', centerId, 'growthProgress', sUid);
    batch.set(progressRef, {
      pointsBalance: sInfo.lp,
      totalPointsEarned: 15000,
      level: 5,
      stats: { focus: 50, consistency: 60, achievement: 40, resilience: 55 },
      lastResetAt: timestamp,
      updatedAt: timestamp,
      penaltyPoints: 0,
      dailyPointStatus: {},
    }, { merge: true });

    // 핵심: 랭킹 보드 엔트리 추가 (이 부분이 누락되면 랭킹에 안 뜸)
    const rankRef = doc(db, 'centers', centerId, 'leaderboards', `${periodKey}_study-time`, 'entries', sUid);
    batch.set(rankRef, {
      studentId: sUid,
      displayNameSnapshot: sInfo.name,
      classNameSnapshot: sInfo.class,
      schoolNameSnapshot: '트랙고등학교',
      value: 2400 - (sInfo.rank * 60),
      rank: sInfo.rank,
      updatedAt: timestamp
    }, { merge: true });

    // 최근 14일간의 학습 로그 (간략화)
    const dateStr = format(today, 'yyyy-MM-dd');
    const logRef = doc(db, 'centers', centerId, 'studyLogs', sUid, 'days', dateStr);
    batch.set(logRef, {
      totalMinutes: 300, studentId: sUid, dateKey: dateStr, centerId,
      updatedAt: timestamp, createdAt: timestamp
    }, { merge: true });

    const dailyStatRef = doc(db, 'centers', centerId, 'dailyStudentStats', dateStr, 'students', sUid);
    batch.set(dailyStatRef, {
      totalStudyMinutes: 300,
      studentId: sUid,
      centerId,
      dateKey: dateStr,
      updatedAt: timestamp,
      createdAt: timestamp,
    }, { merge: true });
  }

  // 2. 센터 KPI 데이터 생성 (최근 30일 그래프용)
  for (let i = 0; i < 30; i++) {
    const date = subDays(today, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const kpiRef = doc(db, 'centers', centerId, 'kpiDaily', dateStr);
    
    batch.set(kpiRef, {
      date: dateStr,
      totalRevenue: testStudents.length * Math.floor(390000 / 28),
      totalStudyMinutes: testStudents.length * 360,
      activeStudentCount: testStudents.length,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  await batch.commit();
  return { ok: true };
}
