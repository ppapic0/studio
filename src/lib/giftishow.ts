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

const GIFTISHOW_AVAILABLE_STATE_CODES = new Set(['SALE', 'SALES', 'ONSALE', 'ON_SALE', 'AVAILABLE', 'Y', 'YES', 'TRUE', '1', '판매', '판매중']);
const GIFTISHOW_UNAVAILABLE_STATE_CODES = new Set([
  'STOP',
  'STOPPED',
  'SOLDOUT',
  'SOLD_OUT',
  'END',
  'ENDED',
  'EXPIRE',
  'EXPIRED',
  'DELETE',
  'DELETED',
  'N',
  'NO',
  'FALSE',
  '0',
  '품절',
  '중지',
  '판매중지',
]);

const GIFTISHOW_STUDENT_CATALOG_EXCLUSION_RULES = [
  {
    reason: '노래방 관련',
    keywords: ['노래방', '노래연습장', '노래연습', '코인노래', '코인 노래', '코노', '락휴', 'karaoke'],
  },
];

const GIFTISHOW_STUDENT_REVIEW_ALLOWLIST_KEYWORDS = ['세븐일레븐', '7-eleven', '7 eleven', 'seven eleven'];

const GIFTISHOW_STUDENT_REVIEW_RULES = [
  ...GIFTISHOW_STUDENT_CATALOG_EXCLUSION_RULES,
  {
    reason: '주류·음주 관련',
    keywords: ['맥주', '소주', '와인', '위스키', '막걸리', '칵테일', '하이볼', '호프집', '주점'],
  },
  {
    reason: '흡연 관련',
    keywords: ['담배', '전자담배', '흡연', '라이터'],
  },
  {
    reason: '성인·유흥 관련',
    keywords: ['성인', '19금', '유흥', '클럽', '룸카페', '마사지'],
  },
  {
    reason: '숙박 관련',
    keywords: ['호텔', '모텔', '숙박', '펜션', '풀빌라'],
  },
  {
    reason: '도박·복권 관련',
    keywords: ['복권', '로또', '카지노', '토토'],
  },
  {
    reason: '게임·PC방 관련',
    keywords: ['pc방', '피씨방', '게임', '넥슨', '메이플', '스팀', '플레이스테이션'],
  },
];

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

export function getGiftishowProductPointCost(product?: GiftishowProduct | null) {
  const rawCost = Number(product?.pointCost ?? product?.salePrice ?? 0);
  return Number.isFinite(rawCost) ? Math.max(0, Math.floor(rawCost)) : 0;
}

export function getGiftishowProductAvailabilityReason(
  product?: GiftishowProduct | null,
  settings?: GiftishowSettings | null
) {
  if (!product) return '상품 정보를 찾지 못했어요.';
  if (settings?.enabled === false) return '센터에서 보상샵을 준비 중이에요.';

  const stateCode = normalizeGiftishowStateCode(product.goodsStateCd);
  if (GIFTISHOW_UNAVAILABLE_STATE_CODES.has(stateCode)) return '판매 중지된 상품이에요.';
  if (getGiftishowProductPointCost(product) <= 0) return '상품 포인트 정보가 아직 없어요.';
  if (product.isAvailable === true || GIFTISHOW_AVAILABLE_STATE_CODES.has(stateCode)) return null;

  return '현재 교환할 수 없는 상품이에요.';
}

export function isGiftishowProductAvailable(product?: GiftishowProduct | null, settings?: GiftishowSettings | null) {
  return getGiftishowProductAvailabilityReason(product, settings) === null;
}

export function getGiftishowStudentCatalogExclusionReason(product?: GiftishowProduct | null) {
  const text = getGiftishowProductSearchText(product);
  if (!text) return null;

  const matchedRule = GIFTISHOW_STUDENT_CATALOG_EXCLUSION_RULES.find((rule) =>
    rule.keywords.some((keyword) => text.includes(keyword.toLowerCase()))
  );

  return matchedRule ? `학생 보상샵 제외 품목(${matchedRule.reason})` : null;
}

export function isGiftishowStudentCatalogProduct(product?: GiftishowProduct | null) {
  return getGiftishowStudentCatalogExclusionReason(product) === null;
}

export function getGiftishowStudentReviewCandidateReasons(product?: GiftishowProduct | null) {
  const text = getGiftishowProductSearchText(product);
  if (!text) return [];
  if (GIFTISHOW_STUDENT_REVIEW_ALLOWLIST_KEYWORDS.some((keyword) => text.includes(keyword))) return [];

  return GIFTISHOW_STUDENT_REVIEW_RULES
    .map((rule) => {
      const keyword = rule.keywords.find((candidate) => text.includes(candidate.toLowerCase()));
      return keyword ? `${rule.reason}: ${keyword}` : null;
    })
    .filter((reason): reason is string => Boolean(reason));
}

export function maskPhoneNumber(value?: string | null) {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7) return value;
  return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4).replace(/\d/g, '*')}-${digits.slice(-4)}`;
}

export function sortGiftishowProducts<T extends GiftishowProduct>(products: T[] | null | undefined) {
  return [...(products || [])].sort((left, right) => {
    const availableDiff = Number(isGiftishowProductAvailable(right)) - Number(isGiftishowProductAvailable(left));
    if (availableDiff !== 0) return availableDiff;

    const pointDiff = getGiftishowProductPointCost(left) - getGiftishowProductPointCost(right);
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

function normalizeGiftishowStateCode(value?: string | null) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

function getGiftishowProductSearchText(product?: GiftishowProduct | null) {
  if (!product) return '';
  return [
    product.goodsName,
    product.brandName,
    product.affiliate,
    product.goodsTypeNm,
    product.goodsTypeDtlNm,
    product.content,
    product.contentAddDesc,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
