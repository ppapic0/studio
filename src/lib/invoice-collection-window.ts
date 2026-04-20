import { endOfDay, format } from 'date-fns';

import type { Invoice } from './types';

type TimestampLike = { toDate?: () => Date } | Date | string | null | undefined;

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

export function getInvoiceCollectionStartDate(
  invoice: Pick<Invoice, 'collectionStartDate' | 'issuedAt' | 'cycleStartDate'>
): Date | null {
  return (
    toDateSafe(invoice.collectionStartDate as TimestampLike) ||
    toDateSafe(invoice.issuedAt as TimestampLike) ||
    toDateSafe(invoice.cycleStartDate as TimestampLike)
  );
}

export function getInvoiceCollectionEndDate(
  invoice: Pick<Invoice, 'collectionEndDate' | 'cycleEndDate'>
): Date | null {
  return (
    toDateSafe(invoice.collectionEndDate as TimestampLike) ||
    toDateSafe(invoice.cycleEndDate as TimestampLike)
  );
}

export function isInvoiceCollectionOverdue(
  invoice: Pick<Invoice, 'collectionEndDate' | 'cycleEndDate'>,
  now: Date = new Date()
) {
  const collectionEndDate = getInvoiceCollectionEndDate(invoice);
  if (!collectionEndDate) return false;
  return endOfDay(collectionEndDate).getTime() < now.getTime();
}

export function formatInvoiceCollectionInputDate(value: Date | null, fallback = '') {
  return value ? format(value, 'yyyy-MM-dd') : fallback;
}

export function getInvoiceCollectionSortTime(invoice: Pick<Invoice, 'collectionEndDate' | 'cycleEndDate' | 'updatedAt'> & { updatedAt?: TimestampLike }) {
  return (
    getInvoiceCollectionEndDate(invoice)?.getTime() ||
    toDateSafe(invoice.updatedAt as TimestampLike)?.getTime() ||
    0
  );
}
