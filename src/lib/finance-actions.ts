
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
import { BillingProfile, Invoice, KpiDaily, StudentProfile } from './types';
import type { InvoiceTrackCategory } from './invoice-analytics';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * 수납 상태 수동 업데이트 (고도화)
 * 관리자가 인보이스의 상태를 직접 변경할 때 사용 (Paid, Issued, Overdue 등)
 */
export async function updateInvoiceStatus(
  db: Firestore,
  centerId: string,
  invoiceId: string,
  status: Invoice['status'],
  method: Invoice['paymentMethod'] = 'none'
) {
  const invoiceRef = doc(db, 'centers', centerId, 'invoices', invoiceId);
  const invoiceSnap = await getDoc(invoiceRef);
  
  if (!invoiceSnap.exists()) throw new Error('인보이스를 찾을 수 없습니다.');
  const invoice = invoiceSnap.data() as Invoice;

  const batch = writeBatch(db);
  const now = serverTimestamp();
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const updateData: any = {
    status,
    updatedAt: now
  };

  if (status === 'paid') {
    updateData.paymentMethod = method;
    updateData.paidAt = now;

    // 결제 로그 생성
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
  } else {
    // 유료 상태에서 다른 상태로 변경 시 (환불 등은 별도 로직이 필요하지만 여기서는 단순 상태 전환)
    updateData.paidAt = null;
    updateData.paymentMethod = 'none';
  }

  batch.update(invoiceRef, updateData);
  await batch.commit();

  // 변경된 내용을 바탕으로 KPI 즉시 동기화
  await syncDailyKpi(db, centerId, todayKey);

  return { ok: true };
}

/**
 * 수납 처리 (결제 완료 - 기존 함수 유지 및 보강)
 */
export async function completePayment(
  db: Firestore, 
  centerId: string, 
  invoiceId: string, 
  method: 'card' | 'transfer' | 'cash'
) {
  return updateInvoiceStatus(db, centerId, invoiceId, 'paid', method);
}

/**
 * 인보이스 수납 상태 초기화
 * 인보이스를 다시 수납 대기 상태로 되돌리고 연결된 결제 로그도 함께 정리한다.
 */
export async function resetInvoiceCollectionState(
  db: Firestore,
  centerId: string,
  invoiceId: string
) {
  const invoiceRef = doc(db, 'centers', centerId, 'invoices', invoiceId);
  const invoiceSnap = await getDoc(invoiceRef);

  if (!invoiceSnap.exists()) throw new Error('인보이스를 찾을 수 없습니다.');

  const paymentsQuery = query(
    collection(db, `centers/${centerId}/payments`),
    where('invoiceId', '==', invoiceId)
  );
  const paymentsSnap = await getDocs(paymentsQuery);

  const batch = writeBatch(db);
  const now = serverTimestamp();
  const affectedDateKeys = new Set<string>();

  paymentsSnap.docs.forEach((paymentDoc) => {
    const paymentData = paymentDoc.data();
    const processedAt = paymentData?.processedAt;
    if (processedAt instanceof Timestamp) {
      affectedDateKeys.add(format(processedAt.toDate(), 'yyyy-MM-dd'));
    }
    batch.delete(paymentDoc.ref);
  });

  batch.update(invoiceRef, {
    status: 'issued',
    paidAt: null,
    paymentMethod: 'none',
    updatedAt: now,
  });

  await batch.commit();

  if (affectedDateKeys.size === 0) {
    affectedDateKeys.add(format(new Date(), 'yyyy-MM-dd'));
  }

  await Promise.all(Array.from(affectedDateKeys).map((dateKey) => syncDailyKpi(db, centerId, dateKey)));

  return { ok: true, deletedPayments: paymentsSnap.size };
}

/**
 * 신규 인보이스 생성 (관리형 독서실 표준 28일 주기 적용)
 */
export async function issueInvoice(
  db: Firestore,
  centerId: string,
  studentId: string,
  amount: number,
  title: string,
  options?: {
    trackCategory?: InvoiceTrackCategory;
  }
) {
  const studentSnap = await getDoc(doc(db, 'centers', centerId, 'students', studentId));
  if (!studentSnap.exists()) throw new Error('학생을 찾을 수 없습니다.');
  
  const student = studentSnap.data() as StudentProfile;
  const now = serverTimestamp();
  const startDate = new Date();
  const endDate = addDays(startDate, 28);
  const trackCategory = options?.trackCategory;
  const productId =
    trackCategory === 'academy'
      ? 'manual_28d_academy'
      : trackCategory === 'studyRoom'
        ? 'manual_28d_studyroom'
        : 'manual_28d';

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
      productId,
      season: 'regular',
      studentType: 'student',
      basePrice: amount
    },
    discountsSnapshot: [],
    title,
    ...(trackCategory ? { trackCategory } : {})
  };

  const invoiceRef = doc(collection(db, `centers/${centerId}/invoices`));
  await setDoc(invoiceRef, invoiceData);
  
  return { ok: true, invoiceId: invoiceRef.id };
}

/**
 * 발생주의 방식의 Daily KPI 집계
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
  const billingProfilesSnap = await getDocs(collection(db, `centers/${centerId}/billingProfiles`));
  const billingProfilesByStudentId = new Map(
    billingProfilesSnap.docs.map((docSnap) => [docSnap.id, { id: docSnap.id, ...(docSnap.data() as Omit<BillingProfile, 'id'>) }])
  );

  let dailyAccruedRevenue = 0;
  let activeStudentCount = 0;

  membersSnap.docs.forEach((doc) => {
    const data = doc.data();
    const billingProfile = billingProfilesByStudentId.get(doc.id);
    const monthlyFee = billingProfile?.monthlyFee || data.monthlyFee || 390000;
    // 28일 기준 일할 계산
    dailyAccruedRevenue += Math.floor(monthlyFee / 28);
    activeStudentCount++;
  });

  // 2. 실제 수납액(Cash Flow) 계산
  const paymentsQuery = query(
    collection(db, `centers/${centerId}/payments`),
    where('processedAt', '>=', Timestamp.fromDate(startOfDay(targetDate))),
    where('processedAt', '<=', Timestamp.fromDate(new Date(targetDate.getTime() + 86399999)))
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

