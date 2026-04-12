import type {
  GiftishowOrder,
  GiftishowOrderStatus,
  GiftishowProduct,
  GiftishowSettings,
  GiftishowSyncStatus,
} from '@/lib/types';

const ORDER_STATUS_LABELS: Record<GiftishowOrderStatus, string> = {
  requested: '승인 대기',
  approved: '승인됨',
  sending: '발송 중',
  pending_provider: '사업자 확인 중',
  sent: '발송 완료',
  failed: '발송 실패',
  rejected: '반려됨',
  cancelled: '취소됨',
};

const SYNC_STATUS_LABELS: Record<GiftishowSyncStatus, string> = {
  idle: '대기',
  syncing: '동기화 중',
  success: '정상',
  error: '오류',
};

export function getGiftishowOrderStatusLabel(status?: GiftishowOrderStatus | null) {
  if (!status) return '상태 미정';
  return ORDER_STATUS_LABELS[status] || status;
}

export function getGiftishowSyncStatusLabel(status?: GiftishowSyncStatus | null) {
  if (!status) return '대기';
  return SYNC_STATUS_LABELS[status] || status;
}

export function getGiftishowOrderStatusTone(status?: GiftishowOrderStatus | null) {
  if (status === 'sent') return 'bg-emerald-100 text-emerald-700';
  if (status === 'requested' || status === 'pending_provider' || status === 'sending') {
    return 'bg-amber-100 text-amber-700';
  }
  if (status === 'failed' || status === 'rejected' || status === 'cancelled') {
    return 'bg-rose-100 text-rose-700';
  }
  return 'bg-slate-100 text-slate-700';
}

export function isGiftishowProductAvailable(product?: GiftishowProduct | null, settings?: GiftishowSettings | null) {
  if (!product) return false;
  if (settings?.enabled === false) return false;
  return product.isAvailable && product.goodsStateCd === 'SALE';
}

export function maskPhoneNumber(value?: string | null) {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7) return value;
  return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4).replace(/\d/g, '*')}-${digits.slice(-4)}`;
}

export function sortGiftishowProducts<T extends GiftishowProduct>(products: T[] | null | undefined) {
  return [...(products || [])].sort((left, right) => {
    const availableDiff = Number(right.isAvailable) - Number(left.isAvailable);
    if (availableDiff !== 0) return availableDiff;

    const pointDiff = left.pointCost - right.pointCost;
    if (pointDiff !== 0) return pointDiff;

    return left.goodsName.localeCompare(right.goodsName, 'ko');
  });
}

export function sortGiftishowOrdersByRecent<T extends GiftishowOrder>(orders: T[] | null | undefined) {
  return [...(orders || [])].sort((left, right) => {
    const leftTime = toMillis(left.updatedAt) || toMillis(left.createdAt) || toMillis(left.requestedAt);
    const rightTime = toMillis(right.updatedAt) || toMillis(right.createdAt) || toMillis(right.requestedAt);
    return rightTime - leftTime;
  });
}

export function formatGiftishowTimestamp(
  value:
    | { toDate?: () => Date }
    | { seconds?: number; nanoseconds?: number }
    | Date
    | null
    | undefined
) {
  const date = toDate(value);
  if (!date) return '-';

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}.${day} ${hours}:${minutes}`;
}

function toDate(
  value:
    | { toDate?: () => Date }
    | { seconds?: number; nanoseconds?: number }
    | Date
    | null
    | undefined
) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  return null;
}

function toMillis(
  value:
    | { toDate?: () => Date }
    | { seconds?: number; nanoseconds?: number }
    | Date
    | null
    | undefined
) {
  return toDate(value)?.getTime() || 0;
}
