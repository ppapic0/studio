
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
  writeBatch,
  deleteDoc,
} from 'firebase/firestore';
import { addDays, endOfDay, format, startOfDay, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import {
  BillingProfile,
  BusinessLedgerCategory,
  BusinessLedgerDirection,
  BusinessLedgerPaymentMethod,
  BusinessLedgerProofStatus,
  BusinessLedgerTrackScope,
  Invoice,
  KpiDaily,
  StudentProfile,
} from './types';
import type { InvoiceTrackCategory } from './invoice-analytics';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export type BusinessLedgerEntryInput = {
  entryDate: Date;
  direction: BusinessLedgerDirection;
  trackScope: BusinessLedgerTrackScope;
  category: BusinessLedgerCategory;
  description: string;
  counterparty?: string | null;
  amount: number;
  paymentMethod: BusinessLedgerPaymentMethod;
  proofStatus: BusinessLedgerProofStatus;
  memo?: string | null;
};

export type ManualAcademyInvoiceInput = {
  studentName: string;
  amount: number;
  phoneNumber?: string | null;
  memo?: string | null;
};

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

export async function clearLegacyInvoiceCollectionData(
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
    status: 'void',
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

export async function updateInvoiceCollectionWindow(
  db: Firestore,
  centerId: string,
  invoiceId: string,
  params: {
    collectionStartDate: Date;
    collectionEndDate: Date;
  }
) {
  const invoiceRef = doc(db, 'centers', centerId, 'invoices', invoiceId);
  const invoiceSnap = await getDoc(invoiceRef);

  if (!invoiceSnap.exists()) throw new Error('인보이스를 찾을 수 없습니다.');

  const invoice = invoiceSnap.data() as Invoice;
  const collectionStartDate = startOfDay(params.collectionStartDate);
  const collectionEndDate = endOfDay(params.collectionEndDate);
  const updateData: Record<string, any> = {
    collectionStartDate: Timestamp.fromDate(collectionStartDate),
    collectionEndDate: Timestamp.fromDate(collectionEndDate),
    updatedAt: serverTimestamp(),
  };

  if (invoice.status === 'issued' || invoice.status === 'overdue') {
    updateData.status = collectionEndDate.getTime() < Date.now() ? 'overdue' : 'issued';
  }

  await updateDoc(invoiceRef, updateData);

  return { ok: true };
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
    collectionStartDate: Timestamp.fromDate(startDate),
    collectionEndDate: Timestamp.fromDate(endOfDay(endDate)),
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

export async function issueManualAcademyInvoice(
  db: Firestore,
  centerId: string,
  input: ManualAcademyInvoiceInput
) {
  const studentName = input.studentName.trim();
  const amount = Math.max(0, Math.round(Number(input.amount) || 0));
  const phoneNumber = (input.phoneNumber || '').replace(/[^\d]/g, '').slice(0, 15);
  const memo = (input.memo || '').trim().slice(0, 300);

  if (!studentName) throw new Error('학생 이름을 입력해 주세요.');
  if (amount <= 0) throw new Error('인보이스 금액을 입력해 주세요.');

  const invoiceRef = doc(collection(db, `centers/${centerId}/invoices`));
  const now = serverTimestamp();
  const startDate = new Date();
  const endDate = addDays(startDate, 28);
  const studentId = `manual-academy-${invoiceRef.id}`;

  await setDoc(invoiceRef, {
    studentId,
    studentName,
    cycleStartDate: Timestamp.fromDate(startDate),
    cycleEndDate: Timestamp.fromDate(endDate),
    collectionStartDate: Timestamp.fromDate(startDate),
    collectionEndDate: Timestamp.fromDate(endOfDay(endDate)),
    finalPrice: amount,
    status: 'issued',
    issuedAt: now,
    updatedAt: now,
    priceSnapshot: {
      productId: 'manual_28d_academy_only',
      season: 'regular',
      studentType: 'academy_only',
      basePrice: amount,
    },
    discountsSnapshot: [],
    title: '28일 정기 트랙 국어 이용료',
    trackCategory: 'academy',
    isManualInvoice: true,
    studentSource: 'manualAcademy',
    ...(phoneNumber ? { manualStudentPhone: phoneNumber } : {}),
    ...(memo ? { memo } : {}),
  });

  return { ok: true, invoiceId: invoiceRef.id, studentId };
}

export async function createBusinessLedgerEntry(
  db: Firestore,
  centerId: string,
  actorUid: string,
  input: BusinessLedgerEntryInput
) {
  const entryRef = doc(collection(db, `centers/${centerId}/businessLedgerEntries`));
  const now = serverTimestamp();
  const entryDate = startOfDay(input.entryDate);

  await setDoc(entryRef, {
    centerId,
    entryDate: Timestamp.fromDate(entryDate),
    monthKey: format(entryDate, 'yyyy-MM'),
    direction: input.direction,
    trackScope: input.trackScope,
    category: input.category,
    description: input.description,
    counterparty: input.counterparty || null,
    amount: Math.max(0, Math.round(Number(input.amount) || 0)),
    paymentMethod: input.paymentMethod,
    proofStatus: input.proofStatus,
    memo: input.memo || null,
    createdAt: now,
    updatedAt: now,
    createdByUid: actorUid,
    updatedByUid: actorUid,
  });

  return { ok: true, entryId: entryRef.id };
}

export async function updateBusinessLedgerEntry(
  db: Firestore,
  centerId: string,
  entryId: string,
  actorUid: string,
  input: BusinessLedgerEntryInput
) {
  const entryDate = startOfDay(input.entryDate);

  await updateDoc(doc(db, 'centers', centerId, 'businessLedgerEntries', entryId), {
    entryDate: Timestamp.fromDate(entryDate),
    monthKey: format(entryDate, 'yyyy-MM'),
    direction: input.direction,
    trackScope: input.trackScope,
    category: input.category,
    description: input.description,
    counterparty: input.counterparty || null,
    amount: Math.max(0, Math.round(Number(input.amount) || 0)),
    paymentMethod: input.paymentMethod,
    proofStatus: input.proofStatus,
    memo: input.memo || null,
    updatedAt: serverTimestamp(),
    updatedByUid: actorUid,
  });

  return { ok: true };
}

export async function deleteBusinessLedgerEntry(
  db: Firestore,
  centerId: string,
  entryId: string
) {
  await deleteDoc(doc(db, 'centers', centerId, 'businessLedgerEntries', entryId));
  return { ok: true };
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

