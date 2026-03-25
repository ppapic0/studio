export type CenterAdminHeatmapTone = 'stable' | 'good' | 'watch' | 'risk';

export interface CenterAdminHeatmapMetric {
  id: string;
  label: string;
  value: string;
  score: number;
  hint: string;
  href?: string;
}

export interface CenterAdminHeatmapTrendPoint {
  label: string;
  score: number;
}

export interface CenterAdminHeatmapRow {
  id: string;
  label: string;
  description: string;
  summaryScore: number;
  summaryLabel: string;
  href?: string;
  metrics: CenterAdminHeatmapMetric[];
  trend: CenterAdminHeatmapTrendPoint[];
}

export function clampHealth(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function getHeatmapTone(score: number): CenterAdminHeatmapTone {
  if (score >= 85) return 'stable';
  if (score >= 70) return 'good';
  if (score >= 50) return 'watch';
  return 'risk';
}

export function getHeatmapLabel(score: number) {
  if (score >= 85) return '안정';
  if (score >= 70) return '양호';
  if (score >= 50) return '주의';
  return '위험';
}

export function scoreGrowthHealth(growthRate: number) {
  return clampHealth(70 + Number(growthRate || 0) * 200);
}

export function scoreAwayHealth(avgAwayMinutes: number) {
  return clampHealth(100 - Math.max(0, Number(avgAwayMinutes || 0)) * 2.5);
}

export function scoreParentVisitHealth(avgVisitsPerStudent30d: number) {
  return clampHealth(Math.max(0, Number(avgVisitsPerStudent30d || 0)) * 20);
}

export function scoreBreakevenHealth(activeStudentCount: number, breakevenStudents?: number | null) {
  const safeBreakeven = Number(breakevenStudents || 0);
  if (!Number.isFinite(safeBreakeven) || safeBreakeven <= 0) return 75;
  return clampHealth((Math.max(0, Number(activeStudentCount || 0)) / safeBreakeven) * 100);
}

export function averageHealth(values: number[]) {
  const safeValues = values.filter((value) => Number.isFinite(value));
  if (safeValues.length === 0) return 0;
  return clampHealth(safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length);
}

export function formatPercent(value: number) {
  return `${clampHealth(value)}%`;
}

export function formatCount(value: number, suffix = '명') {
  return `${Math.max(0, Math.round(Number(value || 0)))}${suffix}`;
}

export function formatMinutes(value: number) {
  return `${Math.max(0, Math.round(Number(value || 0)))}분`;
}

export function formatCurrency(value: number) {
  return `₩${Math.max(0, Math.round(Number(value || 0))).toLocaleString()}`;
}

export function formatRatio(numerator: number, denominator?: number | null) {
  const safeDenominator = Number(denominator || 0);
  if (!Number.isFinite(safeDenominator) || safeDenominator <= 0) return `${Math.max(0, Math.round(Number(numerator || 0)))}명 / -`;
  return `${Math.max(0, Math.round(Number(numerator || 0)))}명 / ${Math.round(safeDenominator)}명`;
}

export function createHeatmapMetric(input: CenterAdminHeatmapMetric): CenterAdminHeatmapMetric {
  return {
    ...input,
    score: clampHealth(input.score),
  };
}

export function createHeatmapRow(
  input: Omit<CenterAdminHeatmapRow, 'summaryScore' | 'summaryLabel'> & { summaryScore?: number }
): CenterAdminHeatmapRow {
  const summaryScore = input.summaryScore ?? averageHealth(input.metrics.map((metric) => metric.score));
  return {
    ...input,
    summaryScore,
    summaryLabel: getHeatmapLabel(summaryScore),
  };
}

export function calculateCenterFocusScore(
  studyMinutes: number,
  completionRate: number,
  growthRate: number,
  focusStat: number,
  penaltyPoints: number
) {
  const studyScore = clampHealth((Math.max(0, studyMinutes) / 180) * 100);
  const growthScore = scoreGrowthHealth(growthRate);
  const penaltyScore = clampHealth(100 - Math.max(0, penaltyPoints) * 2);
  const raw =
    clampHealth(focusStat) * 0.3 +
    clampHealth(completionRate) * 0.25 +
    studyScore * 0.2 +
    growthScore * 0.15 +
    penaltyScore * 0.1;

  return clampHealth(raw);
}
