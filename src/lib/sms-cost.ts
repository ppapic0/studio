export const SMS_UNIT_COST_KRW = 8.7;

export function calculateSmsCost(count: number): number {
  const safeCount = Number.isFinite(count) ? Math.max(0, count) : 0;
  return Math.round(safeCount * SMS_UNIT_COST_KRW * 10) / 10;
}

export function formatSmsCost(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  const normalized = Math.round(safeValue * 10) / 10;
  return `${normalized.toLocaleString('ko-KR', {
    minimumFractionDigits: Number.isInteger(normalized) ? 0 : 1,
    maximumFractionDigits: 1,
  })}원`;
}
