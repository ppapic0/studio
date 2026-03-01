
'use server';

import { adminDb } from './firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { addDays, format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
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
  const endDate = addDays(startDate, 27); // 28일 사이클 (start + 27일)

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
  const centerRef = adminDb.doc(`centers/${centerId}`);
  
  const [invoiceSnap, centerSnap] = await Promise.all([invoiceRef.get(), centerRef.get()]);
  if (!invoiceSnap.exists) throw new Error('인보이스를 찾을 수 없습니다.');
  
  const invoice = invoiceSnap.data() as any;
  const settings = centerSnap.data()?.financeSettings as FinanceSettings;
  
  const now = new Date();
  const start = invoice.cycleStartDate.toDate();
  
  const diffTime = now.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const usedDays = Math.min(28, Math.max(0, diffDays));

  const perDay = Math.floor(invoice.finalPrice / 28);
  const usedAmount = perDay * usedDays;

  let penalty = 0;
  if (settings?.refundPolicy.penaltyType === 'rate') {
    penalty = Math.floor(invoice.finalPrice * (settings.refundPolicy.penaltyRate || 0));
  } else if (settings?.refundPolicy.penaltyType === 'fixed') {
    penalty = settings.refundPolicy.penaltyFixed || 0;
  }

  const refundAmount = Math.max(0, invoice.finalPrice - usedAmount - penalty);

  const refundData = {
    invoiceId,
    studentId: invoice.studentId,
    requestedAt: FieldValue.serverTimestamp(),
    usedDays,
    perDay,
    usedAmount,
    penalty,
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
 * 해당 날짜를 포함하는 모든 인보이스의 일할 매출을 합산합니다.
 */
export async function syncDailyKpi(centerId: string, dateStr: string) {
  const targetDate = startOfDay(new Date(dateStr));
  const targetTimestamp = Timestamp.fromDate(targetDate);

  // 1. 해당 날짜가 사이클 내에 포함된 모든 유료 인보이스 조회
  const invoicesSnap = await adminDb.collection(`centers/${centerId}/invoices`)
    .where('status', '==', 'paid')
    .where('cycleStartDate', '<=', targetTimestamp)
    .get();

  let dailyAccruedRevenue = 0;
  let totalDiscount = 0;
  let activeStudentCount = 0;

  invoicesSnap.forEach(doc => {
    const data = doc.data() as Invoice;
    const cycleEnd = data.cycleEndDate.toDate();
    
    // Firestore where 쿼리 제한으로 인해 endDate는 메모리에서 필터링
    if (targetDate <= cycleEnd) {
      // 일할 매출 = 최종 결제액 / 28일
      const dailyPrice = Math.floor(data.finalPrice / 28);
      dailyAccruedRevenue += dailyPrice;
      
      // 할인액도 일할로 계산하여 통계에 반영 (옵션)
      data.discountsSnapshot.forEach(d => {
        totalDiscount += Math.floor(d.amount / 28);
      });
      
      activeStudentCount++;
    }
  });

  // 2. 환불액 집계 (환불은 요청일에 전액 차감 또는 일할 차감 - 여기서는 요청일 기준 집계)
  const refundsSnap = await adminDb.collection(`centers/${centerId}/refunds`)
    .where('requestedAt', '>=', Timestamp.fromDate(startOfDay(targetDate)))
    .where('requestedAt', '<=', Timestamp.fromDate(endOfDay(targetDate)))
    .get();

  let dailyTotalRefund = 0;
  refundsSnap.forEach(doc => {
    dailyTotalRefund += doc.data().refundAmount;
  });

  // 3. 해당 월의 고정비 조회 (BEP 계산용)
  const monthKey = format(targetDate, 'yyyy-MM');
  const monthFinanceSnap = await adminDb.doc(`centers/${centerId}/financeMonthly/${monthKey}`).get();
  const monthlyFixedCosts = monthFinanceSnap.exists ? monthFinanceSnap.data()?.totalFixedCosts || 0 : 0;
  
  const avgFinalPrice = activeStudentCount > 0 ? dailyAccruedRevenue / activeStudentCount * 28 : 0;
  const breakevenStudents = avgFinalPrice > 0 ? Math.ceil(monthlyFixedCosts / (avgFinalPrice)) : null;

  const kpiData = {
    date: dateStr,
    totalRevenue: dailyAccruedRevenue, // 오늘 하루의 실질 매출
    totalDiscount,
    totalRefund: dailyTotalRefund,
    activeStudentCount,
    avgFinalPrice,
    breakevenStudents,
    updatedAt: FieldValue.serverTimestamp()
  };

  await adminDb.doc(`centers/${centerId}/kpiDaily/${dateStr}`).set(kpiData, { merge: true });
}
