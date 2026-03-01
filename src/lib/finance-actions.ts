
'use server';

import { adminDb } from './firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { addDays, format, startOfDay } from 'date-fns';
import { DiscountSnapshot, FinanceSettings, PricingMatrix, StudentProfile } from './types';

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

  // 1. 기본가 조회
  const pricingId = `${enrollment.productId}_${enrollment.season}_${enrollment.studentType}`;
  const pricingSnap = await adminDb.doc(`centers/${centerId}/pricing/${pricingId}`).get();
  if (!pricingSnap.exists) throw new Error('해당 조건의 가격 설정이 없습니다.');
  const pricing = pricingSnap.data() as PricingMatrix;

  // 2. 할인 적용
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

  // 정책에 따른 순서 적용
  if (financeSettings.discountPolicy.order[0] === 'rateFirst') {
    applySibling(); applyTutoring();
  } else {
    applyTutoring(); applySibling();
  }

  const finalPrice = Math.max(0, currentPrice);

  // 3. 인보이스 저장
  const startDate = enrollment.cycleStartDate.toDate();
  const endDate = addDays(startDate, 28);

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
  
  // 1. 사용 일수 계산 (0~28일)
  const diffTime = now.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const usedDays = Math.min(28, Math.max(0, diffDays));

  // 2. 금액 계산
  const perDay = Math.floor(invoice.finalPrice / 28);
  const usedAmount = perDay * usedDays;

  // 3. 위약금 계산
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
 * Daily KPI 집계
 */
export async function syncDailyKpi(centerId: string, dateStr: string) {
  const start = Timestamp.fromDate(startOfDay(new Date(dateStr)));
  const end = Timestamp.fromDate(addDays(start.toDate(), 1));

  const invoicesSnap = await adminDb.collection(`centers/${centerId}/invoices`)
    .where('paidAt', '>=', start)
    .where('paidAt', '<', end)
    .get();

  const refundsSnap = await adminDb.collection(`centers/${centerId}/refunds`)
    .where('requestedAt', '>=', start)
    .where('requestedAt', '<', end)
    .get();

  let totalRevenue = 0;
  let totalDiscount = 0;
  let paidCount = 0;

  invoicesSnap.forEach(doc => {
    const data = doc.data();
    totalRevenue += data.finalPrice;
    data.discountsSnapshot.forEach((d: any) => totalDiscount += d.amount);
    paidCount++;
  });

  let totalRefund = 0;
  refundsSnap.forEach(doc => {
    totalRefund += doc.data().refundAmount;
  });

  const centerSnap = await adminDb.doc(`centers/${centerId}`).get();
  const fixedCosts = centerSnap.data()?.financeSettings?.fixedCosts || 0;
  
  const avgFinalPrice = paidCount > 0 ? totalRevenue / paidCount : 0;
  const breakevenStudents = avgFinalPrice > 0 ? Math.ceil(fixedCosts / avgFinalPrice) : null;

  const kpiData = {
    date: dateStr,
    totalRevenue,
    totalDiscount,
    totalRefund,
    paidInvoiceCount: paidCount,
    refundedInvoiceCount: refundsSnap.size,
    avgFinalPrice,
    breakevenStudents,
    updatedAt: FieldValue.serverTimestamp()
  };

  await adminDb.doc(`centers/${centerId}/kpiDaily/${dateStr}`).set(kpiData, { merge: true });
}
