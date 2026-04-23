import { format, subMonths } from 'date-fns';

import type {
  BusinessLedgerCategory,
  BusinessLedgerDirection,
  BusinessLedgerEntry,
  BusinessLedgerPaymentMethod,
  BusinessLedgerProofStatus,
  BusinessLedgerTrackScope,
  Invoice,
  PaymentRecord,
} from './types';
import {
  buildMonthlyTrackBuckets,
  resolveInvoiceTrackCategory,
  type InvoiceTrackCategory,
} from './invoice-analytics';

type TimestampLike = { toDate?: () => Date } | Date | string | null | undefined;

export type BusinessTrackFilter = 'all' | InvoiceTrackCategory;

type LabelMeta = {
  label: string;
  badgeClass?: string;
};

type CategoryMeta = LabelMeta & {
  direction: BusinessLedgerDirection;
};

export const BUSINESS_LEDGER_DIRECTION_META: Record<BusinessLedgerDirection, LabelMeta> = {
  income: { label: '수입', badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  expense: { label: '지출', badgeClass: 'border-rose-200 bg-rose-50 text-rose-600' },
};

export const BUSINESS_LEDGER_TRACK_SCOPE_META: Record<BusinessLedgerTrackScope, LabelMeta> = {
  center: { label: '센터 공통', badgeClass: 'border-slate-200 bg-slate-50 text-slate-600' },
  studyRoom: { label: '독서실', badgeClass: 'border-blue-200 bg-blue-50 text-blue-700' },
  academy: { label: '트랙 분석지', badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
};

export const BUSINESS_LEDGER_PAYMENT_METHOD_META: Record<BusinessLedgerPaymentMethod, LabelMeta> = {
  card: { label: '카드' },
  transfer: { label: '계좌이체' },
  cash: { label: '현금' },
  auto_debit: { label: '자동이체' },
  other: { label: '기타' },
};

export const BUSINESS_LEDGER_PROOF_STATUS_META: Record<BusinessLedgerProofStatus, LabelMeta> = {
  not_needed: { label: '증빙 불필요' },
  pending: { label: '증빙 대기' },
  card_receipt: { label: '카드영수증' },
  cash_receipt: { label: '현금영수증' },
  tax_invoice: { label: '세금계산서' },
  simple_receipt: { label: '간이영수증' },
};

export const BUSINESS_LEDGER_CATEGORY_META: Record<BusinessLedgerCategory, CategoryMeta> = {
  other_tuition_income: { label: '기타 수강료', direction: 'income' },
  material_income: { label: '교재비 수입', direction: 'income' },
  subsidy_income: { label: '지원금 수입', direction: 'income' },
  refund_recovery: { label: '환불 회수', direction: 'income' },
  other_income: { label: '기타 수입', direction: 'income' },
  rent: { label: '임차료', direction: 'expense' },
  payroll: { label: '인건비', direction: 'expense' },
  utilities: { label: '공과금', direction: 'expense' },
  marketing: { label: '마케팅비', direction: 'expense' },
  sms: { label: '문자비', direction: 'expense' },
  supplies: { label: '소모품비', direction: 'expense' },
  snacks: { label: '간식비', direction: 'expense' },
  refund_expense: { label: '환불 지출', direction: 'expense' },
  payment_fee: { label: '결제 수수료', direction: 'expense' },
  tax: { label: '세금', direction: 'expense' },
  other_expense: { label: '기타 지출', direction: 'expense' },
};

export const BUSINESS_LEDGER_CATEGORY_OPTIONS: Record<BusinessLedgerDirection, BusinessLedgerCategory[]> = {
  income: ['other_tuition_income', 'material_income', 'subsidy_income', 'refund_recovery', 'other_income'],
  expense: ['rent', 'payroll', 'utilities', 'marketing', 'sms', 'supplies', 'snacks', 'refund_expense', 'payment_fee', 'tax', 'other_expense'],
};

export type BusinessMonthlyCashSummary = {
  month: string;
  billed: number;
  collected: number;
  manualIncome: number;
  totalInflow: number;
  manualExpense: number;
  netCash: number;
  arrears: number;
  overdueCount: number;
  proofPendingCount: number;
};

export type TaxLedgerDetailRow = {
  month: string;
  entryDate: string;
  directionLabel: string;
  sourceLabel: string;
  trackLabel: string;
  categoryLabel: string;
  description: string;
  studentName: string;
  counterparty: string;
  paymentMethodLabel: string;
  proofStatusLabel: string;
  creditAmount: number;
  debitAmount: number;
  memo: string;
  originId: string;
  sortKey: number;
};

function toDateSafe(value: TimestampLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toDateMs(value: TimestampLike): number {
  return toDateSafe(value)?.getTime() ?? 0;
}

function getInvoiceTrackLabelFromPayment(payment: PaymentRecord, invoiceById: Map<string, Invoice>) {
  const sourceInvoice = invoiceById.get(payment.invoiceId);
  const track = sourceInvoice ? resolveInvoiceTrackCategory(sourceInvoice) : 'studyRoom';
  return BUSINESS_LEDGER_TRACK_SCOPE_META[track].label;
}

export function getBusinessLedgerMonth(entry: Pick<BusinessLedgerEntry, 'monthKey' | 'entryDate'>): string | null {
  if (entry.monthKey) return entry.monthKey;
  const parsed = toDateSafe(entry.entryDate);
  return parsed ? format(parsed, 'yyyy-MM') : null;
}

export function matchesBusinessLedgerTrackFilter(trackScope: BusinessLedgerTrackScope, filter: BusinessTrackFilter) {
  if (filter === 'all') return true;
  return trackScope === filter;
}

export function buildRecentMonthKeys(selectedMonth: string, count = 12) {
  const [yearText, monthText] = selectedMonth.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const baseDate =
    Number.isFinite(year) && Number.isFinite(monthIndex) && monthIndex >= 0 && monthIndex <= 11
      ? new Date(year, monthIndex, 1)
      : new Date();

  return Array.from({ length: count }, (_, index) => format(subMonths(baseDate, count - index - 1), 'yyyy-MM'));
}

export function formatBusinessLedgerCategoryLabel(category: BusinessLedgerCategory | string | null | undefined) {
  if (!category) return '-';
  return BUSINESS_LEDGER_CATEGORY_META[category as BusinessLedgerCategory]?.label || category;
}

export function formatBusinessLedgerProofStatusLabel(status: BusinessLedgerProofStatus | string | null | undefined) {
  if (!status) return '-';
  return BUSINESS_LEDGER_PROOF_STATUS_META[status as BusinessLedgerProofStatus]?.label || status;
}

export function formatBusinessLedgerPaymentMethodLabel(method: BusinessLedgerPaymentMethod | PaymentRecord['method'] | string | null | undefined) {
  if (!method) return '-';
  return BUSINESS_LEDGER_PAYMENT_METHOD_META[method as BusinessLedgerPaymentMethod]?.label || method;
}

export function buildBusinessMonthlyCashSummaries(params: {
  invoices: Invoice[];
  payments: PaymentRecord[];
  ledgerEntries: BusinessLedgerEntry[];
  trackFilter: BusinessTrackFilter;
  months: string[];
}): BusinessMonthlyCashSummary[] {
  const { invoices, payments, ledgerEntries, trackFilter, months } = params;
  const invoiceBuckets = buildMonthlyTrackBuckets(invoices, payments);
  const invoiceBucketMap = new Map(invoiceBuckets.map((bucket) => [bucket.month, bucket]));
  const ledgerMonthMap = new Map<string, { income: number; expense: number; proofPendingCount: number }>();

  ledgerEntries.forEach((entry) => {
    const month = getBusinessLedgerMonth(entry);
    if (!month || !matchesBusinessLedgerTrackFilter(entry.trackScope, trackFilter)) return;
    const current = ledgerMonthMap.get(month) || { income: 0, expense: 0, proofPendingCount: 0 };
    const amount = Math.max(0, toNumber(entry.amount));

    if (entry.direction === 'income') {
      current.income += amount;
    } else {
      current.expense += amount;
      if (entry.proofStatus === 'pending') {
        current.proofPendingCount += 1;
      }
    }

    ledgerMonthMap.set(month, current);
  });

  return months.map((month) => {
    const invoiceMetrics = invoiceBucketMap.get(month);
    const scopedMetrics =
      !invoiceMetrics
        ? null
        : trackFilter === 'all'
          ? invoiceMetrics.total
          : invoiceMetrics.byTrack[trackFilter];
    const ledgerMetrics = ledgerMonthMap.get(month) || { income: 0, expense: 0, proofPendingCount: 0 };
    const billed = scopedMetrics?.billed || 0;
    const collected = scopedMetrics?.collected || 0;
    const arrears = scopedMetrics?.arrears || 0;
    const overdueCount = scopedMetrics?.overdueInvoiceCount || 0;
    const manualIncome = ledgerMetrics.income;
    const manualExpense = ledgerMetrics.expense;
    const totalInflow = collected + manualIncome;

    return {
      month,
      billed,
      collected,
      manualIncome,
      totalInflow,
      manualExpense,
      netCash: totalInflow - manualExpense,
      arrears,
      overdueCount,
      proofPendingCount: ledgerMetrics.proofPendingCount,
    };
  });
}

export function buildTaxLedgerDetailRows(params: {
  selectedMonth: string;
  trackFilter: BusinessTrackFilter;
  invoices: Invoice[];
  payments: PaymentRecord[];
  ledgerEntries: BusinessLedgerEntry[];
}): TaxLedgerDetailRow[] {
  const { selectedMonth, trackFilter, invoices, payments, ledgerEntries } = params;
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const rows: TaxLedgerDetailRow[] = [];

  payments.forEach((payment) => {
    if (payment.status !== 'success') return;
    const month = toDateSafe(payment.processedAt);
    if (!month || format(month, 'yyyy-MM') !== selectedMonth) return;

    const sourceInvoice = invoiceById.get(payment.invoiceId);
    const track = sourceInvoice ? resolveInvoiceTrackCategory(sourceInvoice) : 'studyRoom';
    if (trackFilter !== 'all' && track !== trackFilter) return;

    rows.push({
      month: selectedMonth,
      entryDate: format(month, 'yyyy-MM-dd'),
      directionLabel: BUSINESS_LEDGER_DIRECTION_META.income.label,
      sourceLabel: '실수납',
      trackLabel: getInvoiceTrackLabelFromPayment(payment, invoiceById),
      categoryLabel: '수강료 수납',
      description: sourceInvoice ? `${getInvoiceTrackLabelFromPayment(payment, invoiceById)} 수납` : '센터 수납',
      studentName: sourceInvoice?.studentName || '',
      counterparty: sourceInvoice?.studentName || '',
      paymentMethodLabel: formatBusinessLedgerPaymentMethodLabel(payment.method),
      proofStatusLabel: BUSINESS_LEDGER_PROOF_STATUS_META.not_needed.label,
      creditAmount: Math.max(0, toNumber(payment.amount)),
      debitAmount: 0,
      memo: sourceInvoice ? `인보이스 ${sourceInvoice.id}` : '',
      originId: payment.id,
      sortKey: toDateMs(payment.processedAt),
    });
  });

  ledgerEntries.forEach((entry) => {
    const month = getBusinessLedgerMonth(entry);
    if (month !== selectedMonth || !matchesBusinessLedgerTrackFilter(entry.trackScope, trackFilter)) return;
    const parsedDate = toDateSafe(entry.entryDate);
    const amount = Math.max(0, toNumber(entry.amount));
    rows.push({
      month: selectedMonth,
      entryDate: parsedDate ? format(parsedDate, 'yyyy-MM-dd') : '-',
      directionLabel: BUSINESS_LEDGER_DIRECTION_META[entry.direction].label,
      sourceLabel: '수기장부',
      trackLabel: BUSINESS_LEDGER_TRACK_SCOPE_META[entry.trackScope].label,
      categoryLabel: formatBusinessLedgerCategoryLabel(entry.category),
      description: entry.description || '-',
      studentName: '',
      counterparty: entry.counterparty || '',
      paymentMethodLabel: formatBusinessLedgerPaymentMethodLabel(entry.paymentMethod),
      proofStatusLabel: formatBusinessLedgerProofStatusLabel(entry.proofStatus),
      creditAmount: entry.direction === 'income' ? amount : 0,
      debitAmount: entry.direction === 'expense' ? amount : 0,
      memo: entry.memo || '',
      originId: entry.id,
      sortKey: toDateMs(entry.entryDate),
    });
  });

  return rows.sort((left, right) => right.sortKey - left.sortKey);
}

export function buildCsvContent(headers: string[], rows: Array<Array<string | number>>) {
  const csvEscape = (value: unknown) => {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  return '\uFEFF' + [headers, ...rows].map((row) => row.map((cell) => csvEscape(cell)).join(',')).join('\r\n');
}

export function downloadCsvFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
