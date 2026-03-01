
'use server';

import { adminDb } from './firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { addDays, format, startOfDay, subDays } from 'date-fns';
import { DiscountSnapshot, FinanceSettings, PricingMatrix, StudentProfile, Invoice } from './types';

/**
 * 결제 인보이스 생성 로직 (28일 주기 스냅샷)
 */
export async function createInvoice(centerId: string, studentId: string) {
  const studentRef = adminDb.doc(`centers/${centerId}/students/${studentId}`);
  const settingsRef = adminDb.doc(`centers/${centerId}`);
  
  const [studentSnap, centerSnap] = await Promise.all([studentRef.get(), settingsRef.get()]);
  
  if (!studentSnap.exists) throw new Error('학생 정보를 찾을 수 없습니다.');
  const student = studentSnap.data() as StudentProfile;
  const enrollment = student.currentEnrollment;
  if (!enrollment) throw new Error('등록된 수강 정보가 없습니다.');

  const pricingId = `${enrollment.productId}_${enrollment.season}_${enrollment.studentType}`;
  const pricingSnap = await adminDb.doc(`centers/${centerId}/pricing/${pricingId}`).get();
  if (!pricingSnap.exists) throw new Error('해당 조건의 가격 설정이 없습니다.');
  const pricing = pricingSnap.data() as PricingMatrix;

  const financeSettings = (centerSnap.data()?.financeSettings as FinanceSettings) || {
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

  if (financeSettings.discountPolicy.order[0] === 'rateFirst') {
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
    issuedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  const newInvoiceRef = adminDb.collection(`centers/${centerId}/invoices`).doc();
  await newInvoiceRef.set(invoiceData);

  return { ok: true, invoiceId: newInvoiceRef.id, finalPrice };
}

/**
 * 환불 계산 및 요청 (28일 일할 계산)
 */
export async function requestRefund(centerId: string, invoiceId: string, reason: string) {
  const invoiceRef = adminDb.doc(`centers/${centerId}/invoices/${invoiceId}`);
  const invoiceSnap = await invoiceRef.get();
  
  if (!invoiceSnap.exists) throw new Error('인보이스를 찾을 수 없습니다.');
  
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
    requestedAt: FieldValue.serverTimestamp(),
    usedDays,
    perDay,
    usedAmount,
    penalty: 0,
    refundAmount,
    status: 'requested',
    reason,
    updatedAt: FieldValue.serverTimestamp()
  };

  const refundRef = adminDb.collection(`centers/${centerId}/refunds`).doc();
  await refundRef.set(refundData);
  await invoiceRef.update({ status: 'refunded' });

  return { ok: true, refundAmount };
}

/**
 * 발생주의 방식의 Daily KPI 집계
 * 해당 날짜에 '재원' 중인 모든 학생의 수강료를 일할(1/28)로 합산합니다.
 */
export async function syncDailyKpi(centerId: string, dateStr: string) {
  const targetDate = startOfDay(new Date(dateStr));

  // 1. 현재 센터의 모든 '재원생' 조회
  const membersSnap = await adminDb.collection(`centers/${centerId}/members`)
    .where('role', '==', 'student')
    .where('status', '==', 'active')
    .get();

  let dailyAccruedRevenue = 0;
  let activeStudentCount = 0;

  membersSnap.forEach(doc => {
    const data = doc.data();
    // 설정된 개별 수강료가 없으면 기본값 350,000원 적용
    const monthlyFee = data.monthlyFee || 350000;
    const dailyFee = Math.floor(monthlyFee / 28);
    
    dailyAccruedRevenue += dailyFee;
    activeStudentCount++;
  });

  // 2. 월별 고정비 가져오기 (BEP 계산용)
  const monthKey = format(targetDate, 'yyyy-MM');
  const monthFinanceSnap = await adminDb.doc(`centers/${centerId}/financeMonthly/${monthKey}`).get();
  const monthlyFixedCosts = monthFinanceSnap.exists ? monthFinanceSnap.data()?.totalFixedCosts || 0 : 0;
  
  // 3. 손익분기점(BEP) 학생 수 계산
  // BEP = 월 고정비 / (인당 평균 일일 수강료 * 30일)
  const avgDailyFee = activeStudentCount > 0 ? dailyAccruedRevenue / activeStudentCount : 0;
  const breakevenStudents = avgDailyFee > 0 ? Math.ceil(monthlyFixedCosts / (avgDailyFee * 30)) : null;

  const kpiData = {
    date: dateStr,
    totalRevenue: dailyAccruedRevenue,
    activeStudentCount,
    breakevenStudents,
    updatedAt: FieldValue.serverTimestamp()
  };

  await adminDb.doc(`centers/${centerId}/kpiDaily/${dateStr}`).set(kpiData, { merge: true });
  return { ok: true };
}

/**
 * 최근 30일간의 모든 KPI를 동기화합니다. (차트 데이터 복구용)
 */
export async function syncRecentKpis(centerId: string) {
  const today = new Date();
  const syncPromises = [];

  for (let i = 0; i < 30; i++) {
    const dateStr = format(subDays(today, i), 'yyyy-MM-dd');
    syncPromises.push(syncDailyKpi(centerId, dateStr));
  }

  await Promise.all(syncPromises);
  return { ok: true };
}
