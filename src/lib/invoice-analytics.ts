import { format } from 'date-fns';

import type { Invoice } from './types';

export type InvoiceTrackCategory = 'studyRoom' | 'academy';

export const INVOICE_TRACK_META: Record<
  InvoiceTrackCategory,
  { label: string; badgeClass: string; accentClass: string }
> = {
  studyRoom: {
    label: '독서실',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    accentClass: 'text-blue-700',
  },
  academy: {
    label: '학원',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    accentClass: 'text-emerald-700',
  },
};

type TimestampLike = { toDate?: () => Date } | Date | string | null | undefined;

export interface TrackMetrics {
  billed: number;
  collected: number;
  arrears: number;
  invoiceCount: number;
  paidInvoiceCount: number;
  overdueInvoiceCount: number;
}

export interface MonthlyTrackBucket {
  month: string;
  byTrack: Record<InvoiceTrackCategory, TrackMetrics>;
  total: TrackMetrics;
}

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

function emptyTrackMetrics(): TrackMetrics {
  return {
    billed: 0,
    collected: 0,
    arrears: 0,
    invoiceCount: 0,
    paidInvoiceCount: 0,
    overdueInvoiceCount: 0,
  };
}

function emptyMonthlyBucket(month: string): MonthlyTrackBucket {
  return {
    month,
    byTrack: {
      studyRoom: emptyTrackMetrics(),
      academy: emptyTrackMetrics(),
    },
    total: emptyTrackMetrics(),
  };
}

export function normalizeTrackCategory(value: unknown): InvoiceTrackCategory | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'studyroom' || normalized === 'study_room' || normalized === 'study-room') return 'studyRoom';
  if (normalized === 'academy') return 'academy';
  return null;
}

export function resolveInvoiceTrackCategory(invoice: Invoice): InvoiceTrackCategory {
  const explicit = normalizeTrackCategory((invoice as any).trackCategory);
  if (explicit) return explicit;

  const source = [
    invoice.priceSnapshot?.productId,
    invoice.priceSnapshot?.season,
    invoice.priceSnapshot?.studentType,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const academyKeywords = ['academy', 'hakwon', 'class', 'lecture', 'tutor', '학원', '교습'];
  if (academyKeywords.some((keyword) => source.includes(keyword))) return 'academy';

  const studyRoomKeywords = ['study', 'desk', 'reading', 'self', '독서실', '자습'];
  if (studyRoomKeywords.some((keyword) => source.includes(keyword))) return 'studyRoom';

  return 'studyRoom';
}

export function getInvoiceMonth(invoice: Invoice): string | null {
  const date = toDateSafe(invoice.cycleEndDate as TimestampLike) || toDateSafe(invoice.issuedAt as TimestampLike);
  if (!date) return null;
  return format(date, 'yyyy-MM');
}

export function buildMonthlyTrackBuckets(invoices: Invoice[]): MonthlyTrackBucket[] {
  const map = new Map<string, MonthlyTrackBucket>();

  for (const invoice of invoices) {
    const month = getInvoiceMonth(invoice);
    if (!month) continue;

    if (!map.has(month)) {
      map.set(month, emptyMonthlyBucket(month));
    }
    const bucket = map.get(month)!;
    const track = resolveInvoiceTrackCategory(invoice);
    const amount = Math.max(0, toNumber(invoice.finalPrice));
    const status = invoice.status;
    const isBilled = status !== 'void';
    const isCollected = status === 'paid';
    const isArrears = status === 'issued' || status === 'overdue';
    const isOverdue = status === 'overdue';

    bucket.byTrack[track].invoiceCount += 1;
    bucket.total.invoiceCount += 1;

    if (isBilled) {
      bucket.byTrack[track].billed += amount;
      bucket.total.billed += amount;
    }
    if (isCollected) {
      bucket.byTrack[track].collected += amount;
      bucket.byTrack[track].paidInvoiceCount += 1;
      bucket.total.collected += amount;
      bucket.total.paidInvoiceCount += 1;
    }
    if (isArrears) {
      bucket.byTrack[track].arrears += amount;
      bucket.total.arrears += amount;
    }
    if (isOverdue) {
      bucket.byTrack[track].overdueInvoiceCount += 1;
      bucket.total.overdueInvoiceCount += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}
