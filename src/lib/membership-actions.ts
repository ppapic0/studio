
import { 
  doc, 
  collection, 
  writeBatch, 
  serverTimestamp, 
  Firestore,
  Timestamp
} from 'firebase/firestore';
import { format, subDays, startOfDay } from 'date-fns';

/**
 * 초기 데이터 시딩용 함수 (관리자용)
 * 테스트 학생들을 생성하고 03반, 04반, 과외반에 골고루 배정합니다.
 * 또한 최근 30일간의 센터 KPI 데이터를 생성하여 그래프를 정상적으로 표시합니다.
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
    { id: 'test-student-03-1', name: '이현우', class: '03반' },
    { id: 'test-student-03-2', name: '오윤성', class: '03반' },
    { id: 'test-student-04-1', name: '최강산', class: '04반' },
    { id: 'test-student-04-2', name: '정유리', class: '04반' },
    { id: 'test-student-tutor-1', name: '박과외', class: '과외반' },
    { id: 'test-student-tutor-2', name: '한지수', class: '과외반' },
  ];

  const today = new Date();
  const timestamp = serverTimestamp();

  // 학생별 시퀀셜 데이터 생성
  for (const sInfo of testStudents) {
    const sUid = sInfo.id;
    const memberRef = doc(db, 'centers', centerId, 'members', sUid);
    const userCenterRef = doc(db, 'userCenters', sUid, 'centers', centerId);

    batch.set(memberRef, {
      id: sUid, centerId, role: 'student', status: 'active', className: sInfo.class,
      displayName: sInfo.name, joinedAt: timestamp, updatedAt: timestamp, monthlyFee: 390000
    }, { merge: true });

    batch.set(userCenterRef, {
      id: centerId, centerId, role: 'student', status: 'active', className: sInfo.class,
      joinedAt: timestamp, updatedAt: timestamp
    }, { merge: true });

    const studentProfileRef = doc(db, 'centers', centerId, 'students', sUid);
    batch.set(studentProfileRef, {
      id: sUid, name: sInfo.name, className: sInfo.class, schoolName: '트랙고등학교',
      grade: '3학년', seatNo: 0, targetDailyMinutes: 360, createdAt: timestamp, updatedAt: timestamp,
    }, { merge: true });

    // 최근 14일간의 개인 학습 로그 생성
    for (let i = 0; i < 14; i++) {
      const date = subDays(today, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const logRef = doc(db, 'centers', centerId, 'studyLogs', sUid, 'days', dateStr);
      const randomMins = 240 + Math.floor(Math.random() * 240); // 4~8시간

      batch.set(logRef, {
        totalMinutes: randomMins, studentId: sUid, dateKey: dateStr, centerId,
        updatedAt: timestamp, createdAt: timestamp
      }, { merge: true });

      if (i === 0) { // 오늘자 통계
        const statRef = doc(db, 'centers', centerId, 'dailyStudentStats', dateStr, 'students', sUid);
        batch.set(statRef, {
          centerId, studentId: sUid, dateKey: dateStr, todayPlanCompletionRate: 70 + Math.floor(Math.random() * 20),
          totalStudyMinutes: randomMins, updatedAt: timestamp
        }, { merge: true });
      }
    }

    const progressRef = doc(db, 'centers', centerId, 'growthProgress', sUid);
    batch.set(progressRef, {
      seasonLp: 5000, level: 5, stats: { focus: 50, consistency: 60, achievement: 40, resilience: 55 },
      totalLpEarned: 15000, lastResetAt: timestamp, updatedAt: timestamp
    }, { merge: true });
  }

  // 2. 센터 KPI 데이터 생성 (최근 30일) - 그래프용
  for (let i = 0; i < 30; i++) {
    const date = subDays(today, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const kpiRef = doc(db, 'centers', centerId, 'kpiDaily', dateStr);
    
    const estimatedTotalMinutes = testStudents.length * (360 + Math.floor(Math.random() * 120));
    
    batch.set(kpiRef, {
      date: dateStr,
      totalRevenue: testStudents.length * Math.floor(390000 / 28),
      totalStudyMinutes: estimatedTotalMinutes,
      activeStudentCount: testStudents.length,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  await batch.commit().catch(err => console.error("Seeding failed:", err));
  return { ok: true };
}
