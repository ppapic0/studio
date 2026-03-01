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
  updateDoc
} from 'firebase/firestore';
import { addDays, format, startOfDay, subDays } from 'date-fns';
import { DiscountSnapshot, FinanceSettings, PricingMatrix, StudentProfile } from './types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * 결제 인보이스 생성 로직 (28일 주기 스냅샷)
 */
export async function createInvoice(db: Firestore, centerId: string, studentId: string) {
  const studentRef = doc(db, 'centers', centerId, 'students', studentId);
  const settingsRef = doc(db, 'centers', centerId);
  
  const [studentSnap, centerSnap] = await Promise.all([getDoc(studentRef), getDoc(settingsRef)]);
  
  if (!studentSnap.exists()) throw new Error('학생 정보를 찾을 수 없습니다.');
  const student = studentSnap.data() as StudentProfile;
  const enrollment = student.currentEnrollment;
  if (!enrollment) throw new Error('등록된 수강 정보가 없습니다.');

  const pricingId = `${enrollment.productId}_${enrollment.season}_${enrollment.studentType}`;
  const pricingSnap = await getDoc(doc(db, 'centers', centerId, 'pricing', pricingId));
  if (!pricingSnap.exists()) throw new Error('해당 조건의 가격 설정이 없습니다.');
  const pricing = pricingSnap.data() as PricingMatrix;

  const centerData = centerSnap.data();
  const financeSettings = (centerData?.financeSettings as FinanceSettings) || {
    discountPolicy: { order: ['rateFirst'] }
  };

  let currentPrice = pricing.basePrice;
  const discounts: DiscountSnapshot[] = [];
  let order = 1;

  const applySibling = () => {
    if (student.flags?.siblingDiscountEnabled) {
      const amount = Math.floor(currentPrice * 0.05);
      discounts.push({ type: 'sibling', method: 'rate', value: 0.05, amount, order: order++ });
      currentPrice -= amount;
    }
  };

  const applyTutoring = () => {
    if (student.flags?.tutoringDiscountEnabled) {
      const amount = 50000;
      discounts.push({ type: 'tutoring', method: 'fixed', value: 50000, amount, order: order++ });
      currentPrice -= amount;
    }
  };

  if (financeSettings.discountPolicy?.order?.[0] === 'rateFirst') {
    applySibling(); applyTutoring();
  } else {
    applyTutoring(); applySibling();
  }

  const finalPrice = Math.max(0, currentPrice);
  const startDate = enrollment.cycleStartDate.toDate();
  const endDate = addDays(startDate, 27); 

  const invoiceData = {
    studentId,
    studentName: student.name,
    cycleStartDate: Timestamp.fromDate(startDate),
    cycleEndDate: Timestamp.fromDate(endDate),
    priceSnapshot: {
      productId: enrollment.productId,
      season: enrollment.season,
      studentType: enrollment.studentType,
      basePrice: pricing.basePrice
    },
    discountsSnapshot: discounts,
    finalPrice,
    status: 'issued',
    issuedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const newInvoiceRef = doc(collection(db, `centers/${centerId}/invoices`));
  setDoc(newInvoiceRef, invoiceData).catch(async (err) => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: newInvoiceRef.path,
      operation: 'create',
      requestResourceData: invoiceData
    }));
  });

  return { ok: true, invoiceId: newInvoiceRef.id, finalPrice };
}

/**
 * 환불 계산 및 요청 (28일 일할 계산)
 */
export async function requestRefund(db: Firestore, centerId: string, invoiceId: string, reason: string) {
  const invoiceRef = doc(db, 'centers', centerId, 'invoices', invoiceId);
  const invoiceSnap = await getDoc(invoiceRef);
  
  if (!invoiceSnap.exists()) throw new Error('인보이스를 찾을 수 없습니다.');
  
  const invoice = invoiceSnap.data() as any;
  const now = new Date();
  const start = invoice.cycleStartDate.toDate();
  
  const diffTime = now.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const usedDays = Math.min(28, Math.max(0, diffDays));

  const perDay = Math.floor(invoice.finalPrice / 28);
  const usedAmount = perDay * usedDays;
  const refundAmount = Math.max(0, invoice.finalPrice - usedAmount);

  const refundData = {
    invoiceId,
    studentId: invoice.studentId,
    requestedAt: serverTimestamp(),
    usedDays,
    perDay,
    usedAmount,
    penalty: 0,
    refundAmount,
    status: 'requested',
    reason,
    updatedAt: serverTimestamp()
  };

  const refundRef = doc(collection(db, `centers/${centerId}/refunds`));
  setDoc(refundRef, refundData).catch(async (err) => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: refundRef.path,
      operation: 'create',
      requestResourceData: refundData
    }));
  });

  updateDoc(invoiceRef, { status: 'refunded', updatedAt: serverTimestamp() }).catch(async (err) => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: invoiceRef.path,
      operation: 'update',
      requestResourceData: { status: 'refunded' }
    }));
  });

  return { ok: true, refundAmount };
}

/**
 * 발생주의 방식의 Daily KPI 집계
 */
export async function syncDailyKpi(db: Firestore, centerId: string, dateStr: string) {
  const targetDate = startOfDay(new Date(dateStr));

  // 1. 현재 센터의 모든 '재원생' 조회
  const membersQuery = query(
    collection(db, `centers/${centerId}/members`),
    where('role', '==', 'student'),
    where('status', '==', 'active')
  );
  const membersSnap = await getDocs(membersQuery);

  let dailyAccruedRevenue = 0;
  let activeStudentCount = 0;

  membersSnap.forEach(doc => {
    const data = doc.data();
    const monthlyFee = data.monthlyFee || 350000;
    const dailyFee = Math.floor(monthlyFee / 28);
    
    dailyAccruedRevenue += dailyFee;
    activeStudentCount++;
  });

  // 2. 월별 고정비 가져오기 (BEP 계산용)
  const monthKey = format(targetDate, 'yyyy-MM');
  const monthFinanceSnap = await getDoc(doc(db, 'centers', centerId, 'financeMonthly', monthKey));
  const monthlyFixedCosts = monthFinanceSnap.exists() ? monthFinanceSnap.data()?.totalFixedCosts || 0 : 0;
  
  // 3. 손익분기점(BEP) 학생 수 계산
  const avgDailyFee = activeStudentCount > 0 ? dailyAccruedRevenue / activeStudentCount : 0;
  const breakevenStudents = avgDailyFee > 0 ? Math.ceil(monthlyFixedCosts / (avgDailyFee * 30)) : null;

  const kpiData = {
    date: dateStr,
    totalRevenue: dailyAccruedRevenue,
    activeStudentCount,
    breakevenStudents,
    updatedAt: serverTimestamp()
  };

  const kpiRef = doc(db, 'centers', centerId, 'kpiDaily', dateStr);
  setDoc(kpiRef, kpiData, { merge: true }).catch(async (err) => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: kpiRef.path,
      operation: 'write',
      requestResourceData: kpiData
    }));
  });

  return { ok: true };
}

/**
 * 최근 30일간의 모든 KPI를 동기화합니다.
 */
export async function syncRecentKpis(db: Firestore, centerId: string) {
  const today = new Date();
  const syncPromises = [];

  for (let i = 0; i < 30; i++) {
    const dateStr = format(subDays(today, i), 'yyyy-MM-dd');
    syncPromises.push(syncDailyKpi(db, centerId, dateStr));
  }

  await Promise.all(syncPromises);
  return { ok: true };
}
