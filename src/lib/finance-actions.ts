
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp, 
  Timestamp, 
  Firestore,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { addDays, format, startOfDay, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Invoice, KpiDaily, StudentProfile } from './types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * 수납 처리 (결제 완료)
 * 실제 PG 연동 시 이 함수가 결제 성공 콜백에서 호출됩니다.
 */
export async function completePayment(
  db: Firestore, 
  centerId: string, 
  invoiceId: string, 
  method: 'card' | 'transfer' | 'cash'
) {
  const invoiceRef = doc(db, 'centers', centerId, 'invoices', invoiceId);
  const invoiceSnap = await getDoc(invoiceRef);
  
  if (!invoiceSnap.exists()) throw new Error('인보이스를 찾을 수 없습니다.');
  const invoice = invoiceSnap.data() as Invoice;

  if (invoice.status === 'paid') throw new Error('이미 결제된 항목입니다.');

  const batch = writeBatch(db);
  const now = serverTimestamp();
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  // 1. 인보이스 상태 업데이트
  batch.update(invoiceRef, {
    status: 'paid',
    paymentMethod: method,
    paidAt: now,
    updatedAt: now
  });

  // 2. 결제 트랜잭션 로그 생성
  const paymentRef = doc(collection(db, `centers/${centerId}/payments`));
  batch.set(paymentRef, {
    invoiceId,
    studentId: invoice.studentId,
    studentName: invoice.studentName,
    amount: invoice.finalPrice,
    method,
    status: 'success',
    processedAt: now,
    centerId
  });

  // 3. 당일 KPI 수납액(Collected Revenue) 업데이트
  const kpiRef = doc(db, 'centers', centerId, 'kpiDaily', todayKey);
  batch.set(kpiRef, {
    collectedRevenue: (await getDoc(kpiRef)).data()?.collectedRevenue || 0 + invoice.finalPrice,
    updatedAt: now
  }, { merge: true });

  await batch.commit();
  return { ok: true };
}

/**
 * 신규 인보이스 수동 생성
 */
export async function issueInvoice(
  db: Firestore,
  centerId: string,
  studentId: string,
  amount: number,
  title: string
) {
  const studentSnap = await getDoc(doc(db, 'centers', centerId, 'students', studentId));
  if (!studentSnap.exists()) throw new Error('학생을 찾을 수 없습니다.');
  
  const student = studentSnap.data() as StudentProfile;
  const now = serverTimestamp();
  const startDate = new Date();
  const endDate = addDays(startDate, 28);

  const invoiceData = {
    studentId,
    studentName: student.name,
    cycleStartDate: Timestamp.fromDate(startDate),
    cycleEndDate: Timestamp.fromDate(endDate),
    finalPrice: amount,
    status: 'issued',
    issuedAt: now,
    updatedAt: now,
    priceSnapshot: {
      productId: 'manual',
      season: 'none',
      studentType: 'none',
      basePrice: amount
    },
    discountsSnapshot: []
  };

  const invoiceRef = doc(collection(db, `centers/${centerId}/invoices`));
  await setDoc(invoiceRef, invoiceData);
  
  return { ok: true, invoiceId: invoiceRef.id };
}

/**
 * 발생주의 방식의 Daily KPI 집계 고도화
 */
export async function syncDailyKpi(db: Firestore, centerId: string, dateStr: string) {
  const targetDate = startOfDay(new Date(dateStr));

  // 1. 재원생 정보 기반 발생 매출 계산
  const membersQuery = query(
    collection(db, `centers/${centerId}/members`),
    where('role', '==', 'student'),
    where('status', '==', 'active')
  );
  const membersSnap = await getDocs(membersQuery);

  let dailyAccruedRevenue = 0;
  let activeStudentCount = 0;

  membersSnap.docs.forEach((doc) => {
    const data = doc.data();
    const monthlyFee = data.monthlyFee || 390000;
    dailyAccruedRevenue += Math.floor(monthlyFee / 28);
    activeStudentCount++;
  });

  // 2. 실제 수납액(Cash Flow) 계산 - 결제 컬렉션에서 해당 날짜 합산
  const paymentsQuery = query(
    collection(db, `centers/${centerId}/payments`),
    where('processedAt', '>=', Timestamp.fromDate(startOfDay(targetDate))),
    where('processedAt', '<=', Timestamp.fromDate(endOfDay(targetDate)))
  );
  const paymentsSnap = await getDocs(paymentsQuery);
  const collectedRevenue = paymentsSnap.docs.reduce((acc, d) => acc + (d.data().amount || 0), 0);

  const kpiData = {
    date: dateStr,
    totalRevenue: dailyAccruedRevenue,
    collectedRevenue,
    activeStudentCount,
    updatedAt: serverTimestamp()
  };

  await setDoc(doc(db, 'centers', centerId, 'kpiDaily', dateStr), kpiData, { merge: true });
  return { ok: true };
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}
