/**
 * 학생 위험도 분석 엔진 (4차원 리스크 스코어링)
 *
 * 설계 문서 기반:
 *  이탈 리스크 = growthRisk×35% + streakRisk×30% + completionRisk×20% + penaltyRisk×15%
 *  몰입 리스크 = focusRisk×40%  + consistencyRisk×25% + growthRisk×20% + todayMinRisk×15%
 *  패턴 리스크 = consistencyRisk×45% + varianceRisk×35% + growthRisk×20%
 *  정체 리스크 = growthRisk×40% + achievementRisk×30% + completionRisk×20% + resilienceRisk×10%
 *  종합 위험도 = 이탈×35% + 몰입×30% + 패턴×20% + 정체×15%
 *
 *  레벨: 0~29 안정 | 30~54 주의 | 55~74 위험 | 75~100 긴급
 */

export interface RiskInput {
  growthRate: number;      // decimal (-0.2 = -20%)
  lowStudyStreak: number;  // 연속 저학습일 (3시간 미만 기준)
  completionRate: number;  // 계획 완료율 0-100
  penalty: number;         // 벌점
  focusStat: number;       // 집중 스탯 0-100
  consistency: number;     // 꾸준함 스탯 0-100
  studyVariance: number;   // 7일 학습 분 표준편차
  todayMinutes: number;    // 오늘 학습 분
  achievement: number;     // 목표달성 스탯 0-100
  resilience: number;      // 회복력 스탯 0-100
}

export interface RiskDimensions {
  dropout: number;     // 이탈 리스크 0-100
  focus: number;       // 몰입 리스크 0-100
  pattern: number;     // 패턴 리스크 0-100
  stagnation: number;  // 정체 리스크 0-100
  overall: number;     // 종합 위험도 0-100
}

export type RiskLevel = '안정' | '주의' | '위험' | '긴급';

export interface RiskLevelMeta {
  level: RiskLevel;
  color: string;       // tailwind text-* class
  bg: string;          // tailwind bg-* class
  border: string;      // tailwind border-* class
  badge: string;       // tailwind badge bg class
  scoreMin: number;
  scoreMax: number;
}

export const RISK_LEVEL_META: Record<RiskLevel, RiskLevelMeta> = {
  긴급: { level: '긴급', color: 'text-rose-600', bg: 'bg-rose-600', border: 'border-rose-200', badge: 'bg-rose-600', scoreMin: 75, scoreMax: 100 },
  위험: { level: '위험', color: 'text-orange-500', bg: 'bg-orange-500', border: 'border-orange-200', badge: 'bg-orange-500', scoreMin: 55, scoreMax: 74 },
  주의: { level: '주의', color: 'text-amber-500', bg: 'bg-amber-500', border: 'border-amber-200', badge: 'bg-amber-500', scoreMin: 30, scoreMax: 54 },
  안정: { level: '안정', color: 'text-emerald-600', bg: 'bg-emerald-500', border: 'border-emerald-200', badge: 'bg-emerald-500', scoreMin: 0, scoreMax: 29 },
};

export function getRiskLevel(score: number): RiskLevel {
  if (score >= 75) return '긴급';
  if (score >= 55) return '위험';
  if (score >= 30) return '주의';
  return '안정';
}

export function getRiskLevelMeta(score: number): RiskLevelMeta {
  return RISK_LEVEL_META[getRiskLevel(score)];
}

// ─── KPI → 위험 점수 변환 (0-100 구간 테이블 기반) ──────────────────────────

function toRisk_growthRate(rate: number): number {
  if (rate >= 0.10) return 7;   // 안전: 0-15
  if (rate >= 0.00) return 33;  // 주의: 16-50
  if (rate > -0.20) return 63;  // 위험: 51-75
  return 88;                     // 긴급: 76-100
}

function toRisk_streak(days: number): number {
  if (days === 0) return 7;
  if (days === 1) return 33;
  if (days === 2) return 63;
  return 88;
}

function toRisk_completionRate(rate: number): number {
  if (rate >= 80) return 7;
  if (rate >= 65) return 33;
  if (rate >= 50) return 63;
  return 88;
}

function toRisk_penalty(points: number): number {
  if (points === 0) return 7;
  if (points <= 4) return 33;
  if (points <= 9) return 63;
  return 88;
}

function toRisk_focusStat(stat: number): number {
  if (stat >= 80) return 7;
  if (stat >= 60) return 33;
  if (stat >= 40) return 63;
  return 88;
}

function toRisk_consistency(stat: number): number {
  if (stat >= 70) return 7;
  if (stat >= 50) return 33;
  if (stat >= 30) return 63;
  return 88;
}

function toRisk_variance(stddev: number): number {
  if (stddev < 30) return 7;
  if (stddev < 60) return 33;
  if (stddev < 90) return 63;
  return 88;
}

function toRisk_todayMinutes(mins: number): number {
  if (mins >= 240) return 7;
  if (mins >= 180) return 33;
  if (mins >= 120) return 63;
  return 88;
}

function toRisk_achievement(stat: number): number {
  if (stat >= 70) return 7;
  if (stat >= 50) return 33;
  if (stat >= 30) return 63;
  return 88;
}

function toRisk_resilience(stat: number): number {
  if (stat >= 70) return 7;
  if (stat >= 50) return 33;
  if (stat >= 30) return 63;
  return 88;
}

// ─── 4차원 리스크 점수 계산 ────────────────────────────────────────────────

export function calcRiskDimensions(input: RiskInput): RiskDimensions {
  const growthRisk = toRisk_growthRate(input.growthRate);
  const streakRisk = toRisk_streak(input.lowStudyStreak);
  const completionRisk = toRisk_completionRate(input.completionRate);
  const penaltyRisk = toRisk_penalty(input.penalty);
  const focusRisk = toRisk_focusStat(input.focusStat);
  const consistencyRisk = toRisk_consistency(input.consistency);
  const varianceRisk = toRisk_variance(input.studyVariance);
  const todayMinRisk = toRisk_todayMinutes(input.todayMinutes);
  const achievementRisk = toRisk_achievement(input.achievement);
  const resilienceRisk = toRisk_resilience(input.resilience);

  const dropout = growthRisk * 0.35 + streakRisk * 0.30 + completionRisk * 0.20 + penaltyRisk * 0.15;
  const focus   = focusRisk * 0.40 + consistencyRisk * 0.25 + growthRisk * 0.20 + todayMinRisk * 0.15;
  const pattern = consistencyRisk * 0.45 + varianceRisk * 0.35 + growthRisk * 0.20;
  const stagnation = growthRisk * 0.40 + achievementRisk * 0.30 + completionRisk * 0.20 + resilienceRisk * 0.10;
  const overall = dropout * 0.35 + focus * 0.30 + pattern * 0.20 + stagnation * 0.15;

  return {
    dropout:    Math.round(dropout),
    focus:      Math.round(focus),
    pattern:    Math.round(pattern),
    stagnation: Math.round(stagnation),
    overall:    Math.round(Math.min(100, overall)),
  };
}

/** 7일 학습 분 배열에서 표준편차(분) 계산 */
export function calcStudyVariance(dayMap: Record<string, number>, dateKeys: string[]): number {
  if (dateKeys.length === 0) return 0;
  const values = dateKeys.map((k) => dayMap[k] ?? 0);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** 지배적 리스크 차원 반환 */
export function dominantDimension(dims: RiskDimensions): keyof Omit<RiskDimensions, 'overall'> {
  const candidates: Array<[keyof Omit<RiskDimensions, 'overall'>, number]> = [
    ['dropout', dims.dropout],
    ['focus', dims.focus],
    ['pattern', dims.pattern],
    ['stagnation', dims.stagnation],
  ];
  return candidates.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

export const DIMENSION_LABELS: Record<keyof Omit<RiskDimensions, 'overall'>, string> = {
  dropout: '이탈',
  focus: '몰입',
  pattern: '패턴',
  stagnation: '정체',
};

export const DIMENSION_COLORS: Record<keyof Omit<RiskDimensions, 'overall'>, string> = {
  dropout: 'text-rose-600',
  focus: 'text-violet-600',
  pattern: 'text-amber-600',
  stagnation: 'text-sky-600',
};

export const DIMENSION_BG: Record<keyof Omit<RiskDimensions, 'overall'>, string> = {
  dropout: 'bg-rose-500',
  focus: 'bg-violet-500',
  pattern: 'bg-amber-500',
  stagnation: 'bg-sky-500',
};

export const DIMENSION_LIGHT_BG: Record<keyof Omit<RiskDimensions, 'overall'>, string> = {
  dropout: 'bg-rose-50',
  focus: 'bg-violet-50',
  pattern: 'bg-amber-50',
  stagnation: 'bg-sky-50',
};

/** 개입 가이드 (지배적 리스크 차원 기반) */
export function getInterventionGuide(dims: RiskDimensions, overall: number): string {
  if (overall < 30) {
    return '✅ 안정적입니다. 현재의 학습 리듬을 유지할 수 있도록 긍정적인 피드백을 계속 제공해 주세요.';
  }
  const dom = dominantDimension(dims);
  const level = getRiskLevel(overall);
  const urgencyPrefix = level === '긴급' ? '🚨 즉각 조치 필요 — ' : level === '위험' ? '⚠️ 조속 개입 권장 — ' : '💛 주의 관찰 — ';
  const guides: Record<keyof Omit<RiskDimensions, 'overall'>, string> = {
    dropout: `${urgencyPrefix}이탈 위험: 출석 및 학습 흐름이 무너지고 있습니다. 즉시 1:1 면담으로 센터 적응도를 확인하고, 필요 시 부모님께 상황을 공유하세요.`,
    focus:   `${urgencyPrefix}몰입 저하: 집중 세션이 짧아지고 있습니다. 학습 환경(자리·소음)을 점검하고, 집중 루틴(포모도로 등)을 함께 설계해 보세요.`,
    pattern: `${urgencyPrefix}패턴 붕괴: 학습 시작 시간과 양이 불규칙합니다. 고정된 시작 시간과 최소 학습 목표를 재설정해 자기관리 루틴을 회복하도록 도와주세요.`,
    stagnation: `${urgencyPrefix}정체 감지: 성장 지표가 1-4주째 정체 중입니다. 달성 가능한 소목표를 제시하고 작은 성공 경험을 쌓을 수 있도록 과제 난이도를 조절해 주세요.`,
  };
  return guides[dom];
}
