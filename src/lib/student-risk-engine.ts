/**
 * Student risk engine v2
 *
 * Goals:
 * - Keep the existing 4 dimensions
 * - Produce explainable factor breakdowns
 * - Generate action queues and confidence signals
 * - Support executive summaries and revenue exposure
 */

export interface RiskInput {
  growthRate: number;
  lowStudyStreak: number;
  completionRate: number;
  penalty: number;
  focusStat: number;
  consistency: number;
  studyVariance: number;
  todayMinutes: number;
  achievement: number;
  resilience: number;
  avgStudyMinutes7d?: number;
  trend14d?: number;
  todayVsAverageDeltaRate?: number;
  consecutiveLowPerformanceDays?: number;
  observedDays?: number;
  lastActivityDaysAgo?: number;
  hasTodayStat?: boolean;
  hasGrowthProgress?: boolean;
  hasRecentStudyLogs?: boolean;
}

export interface RiskDimensions {
  dropout: number;
  focus: number;
  pattern: number;
  stagnation: number;
  overall: number;
}

export type RiskDimensionKey = keyof Omit<RiskDimensions, 'overall'>;
export type RiskLevel = '안정' | '주의' | '위험' | '긴급';
export type RiskConfidenceLevel = '낮음' | '보통' | '높음';
export type RevenueExposureLevel = 'low' | 'medium' | 'high' | 'critical';
export type RiskActionPriority = 'today' | 'week' | 'observe';
export type RiskActionOwner = 'teacher' | 'operator' | 'manager';

export interface RiskLevelMeta {
  level: RiskLevel;
  color: string;
  bg: string;
  border: string;
  badge: string;
  scoreMin: number;
  scoreMax: number;
}

export interface RiskFactorBreakdown {
  dimension: RiskDimensionKey;
  key: string;
  label: string;
  rawValue: number;
  displayValue: string;
  normalizedScore: number;
  weight: number;
  dimensionContribution: number;
  overallContribution: number;
  level: RiskLevel;
  reason: string;
  recommendedAction: string;
}

export interface RiskDimensionExplanation {
  dimension: RiskDimensionKey;
  label: string;
  score: number;
  level: RiskLevel;
  overallWeight: number;
  overallContribution: number;
  summary: string;
  factors: RiskFactorBreakdown[];
}

export interface RevenueRiskExposure {
  monthlyRevenueBasis: number;
  basisSource: 'invoice' | 'membership' | 'none';
  outstandingAmount: number;
  revenueAtRisk: number;
  exposureLevel: RevenueExposureLevel;
}

export interface RiskActionItem {
  priority: RiskActionPriority;
  owner: RiskActionOwner;
  title: string;
  description: string;
  dimension: RiskDimensionKey;
  factorKey?: string;
}

export interface StudentRiskIdentity {
  studentId: string;
  studentName: string;
  className?: string;
}

export interface StudentRiskAnalysis {
  identity: StudentRiskIdentity;
  dimensions: RiskDimensions;
  overallLevel: RiskLevel;
  dominantDimension: RiskDimensionKey;
  confidenceScore: number;
  confidenceLevel: RiskConfidenceLevel;
  confidenceReasons: string[];
  topFactors: RiskFactorBreakdown[];
  explanations: Record<RiskDimensionKey, RiskDimensionExplanation>;
  immediateActions: RiskActionItem[];
  weeklyActions: RiskActionItem[];
  observationNotes: string[];
  metricsSnapshot: {
    growthRate: number;
    completionRate: number;
    todayMinutes: number;
    avgStudyMinutes7d: number;
    todayVsAverageDeltaRate: number;
    trend14d: number;
    penalty: number;
    lowStudyStreak: number;
    consecutiveLowPerformanceDays: number;
    studyVariance: number;
    observedDays: number;
    lastActivityDaysAgo: number;
  };
  revenue: RevenueRiskExposure;
}

export interface ExecutiveRiskSummary {
  population: {
    total: number;
    stable: number;
    warning: number;
    high: number;
    critical: number;
    averageScore: number;
    averageConfidence: number;
  };
  ceo: {
    highRiskStudents: number;
    criticalStudents: number;
    revenueAtRisk: number;
    topSegments: Array<{ dimension: RiskDimensionKey; label: string; count: number }>;
    topStudents: StudentRiskAnalysis[];
  };
  cto: {
    lowConfidenceStudents: number;
    missingTodayStatStudents: number;
    missingGrowthDataStudents: number;
    staleStudents: number;
    dataCoverageRate: number;
    explainabilityHealthyRate: number;
    lowConfidenceList: StudentRiskAnalysis[];
  };
  cfo: {
    revenueAtRisk: number;
    outstandingAtRisk: number;
    criticalExposureStudents: number;
    highExposureList: StudentRiskAnalysis[];
  };
  coo: {
    todayActionCount: number;
    weekActionCount: number;
    dominantDimensions: Array<{ dimension: RiskDimensionKey; label: string; count: number }>;
    actionQueue: RiskActionItem[];
    topOperationsList: StudentRiskAnalysis[];
  };
}

type FactorDefinition = {
  key: string;
  label: string;
  getRawValue: (input: RequiredRiskInput) => number;
  getDisplayValue: (input: RequiredRiskInput) => string;
  getScore: (input: RequiredRiskInput) => number;
  getReason: (input: RequiredRiskInput, score: number) => string;
  getAction: (input: RequiredRiskInput, score: number) => string;
};

type RequiredRiskInput = Required<
  Pick<
    RiskInput,
    | 'growthRate'
    | 'lowStudyStreak'
    | 'completionRate'
    | 'penalty'
    | 'focusStat'
    | 'consistency'
    | 'studyVariance'
    | 'todayMinutes'
    | 'achievement'
    | 'resilience'
    | 'avgStudyMinutes7d'
    | 'trend14d'
    | 'todayVsAverageDeltaRate'
    | 'consecutiveLowPerformanceDays'
    | 'observedDays'
    | 'lastActivityDaysAgo'
    | 'hasTodayStat'
    | 'hasGrowthProgress'
    | 'hasRecentStudyLogs'
  >
>;

type DimensionDefinition = {
  label: string;
  overallWeight: number;
  factors: Array<{ weight: number; definition: FactorDefinition }>;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function toSignedPercent(value: number): string {
  const pct = Math.round(value * 100);
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

function toMinutes(value: number): string {
  return `${Math.round(value)}분`;
}

function scoreWhenHigherIsWorse(value: number, safe: number, danger: number): number {
  if (danger <= safe) return value >= danger ? 100 : 0;
  return clamp(((value - safe) / (danger - safe)) * 100);
}

function scoreWhenLowerIsWorse(value: number, safe: number, danger: number): number {
  if (safe <= danger) return value <= danger ? 100 : 0;
  return clamp(((safe - value) / (safe - danger)) * 100);
}

export const RISK_LEVEL_META: Record<RiskLevel, RiskLevelMeta> = {
  긴급: { level: '긴급', color: 'text-rose-600', bg: 'bg-rose-600', border: 'border-rose-200', badge: 'bg-rose-600', scoreMin: 75, scoreMax: 100 },
  위험: { level: '위험', color: 'text-orange-500', bg: 'bg-orange-500', border: 'border-orange-200', badge: 'bg-orange-500', scoreMin: 55, scoreMax: 74 },
  주의: { level: '주의', color: 'text-amber-500', bg: 'bg-amber-500', border: 'border-amber-200', badge: 'bg-amber-500', scoreMin: 30, scoreMax: 54 },
  안정: { level: '안정', color: 'text-emerald-600', bg: 'bg-emerald-500', border: 'border-emerald-200', badge: 'bg-emerald-500', scoreMin: 0, scoreMax: 29 },
};

export const DIMENSION_LABELS: Record<RiskDimensionKey, string> = {
  dropout: '이탈',
  focus: '집중',
  pattern: '패턴',
  stagnation: '정체',
};

export const DIMENSION_COLORS: Record<RiskDimensionKey, string> = {
  dropout: 'text-rose-600',
  focus: 'text-violet-600',
  pattern: 'text-amber-600',
  stagnation: 'text-sky-600',
};

export const DIMENSION_BG: Record<RiskDimensionKey, string> = {
  dropout: 'bg-rose-500',
  focus: 'bg-violet-500',
  pattern: 'bg-amber-500',
  stagnation: 'bg-sky-500',
};

export const DIMENSION_LIGHT_BG: Record<RiskDimensionKey, string> = {
  dropout: 'bg-rose-50',
  focus: 'bg-violet-50',
  pattern: 'bg-amber-50',
  stagnation: 'bg-sky-50',
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

export function calcStudyVariance(dayMap: Record<string, number>, dateKeys: string[]): number {
  if (dateKeys.length === 0) return 0;
  const values = dateKeys.map((key) => dayMap[key] ?? 0);
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function withDefaults(input: RiskInput): RequiredRiskInput {
  return {
    growthRate: input.growthRate ?? 0,
    lowStudyStreak: input.lowStudyStreak ?? 0,
    completionRate: input.completionRate ?? 0,
    penalty: input.penalty ?? 0,
    focusStat: input.focusStat ?? 50,
    consistency: input.consistency ?? 50,
    studyVariance: input.studyVariance ?? 0,
    todayMinutes: input.todayMinutes ?? 0,
    achievement: input.achievement ?? 50,
    resilience: input.resilience ?? 50,
    avgStudyMinutes7d: input.avgStudyMinutes7d ?? 0,
    trend14d: input.trend14d ?? 0,
    todayVsAverageDeltaRate: input.todayVsAverageDeltaRate ?? 0,
    consecutiveLowPerformanceDays: input.consecutiveLowPerformanceDays ?? 0,
    observedDays: input.observedDays ?? 0,
    lastActivityDaysAgo: input.lastActivityDaysAgo ?? 0,
    hasTodayStat: input.hasTodayStat ?? false,
    hasGrowthProgress: input.hasGrowthProgress ?? false,
    hasRecentStudyLogs: input.hasRecentStudyLogs ?? false,
  };
}

const factorDefinitions: Record<string, FactorDefinition> = {
  growthRate: {
    key: 'growthRate',
    label: '성장률',
    getRawValue: (input) => input.growthRate,
    getDisplayValue: (input) => toSignedPercent(input.growthRate),
    getScore: (input) => scoreWhenLowerIsWorse(input.growthRate, 0.08, -0.25),
    getReason: (input, score) =>
      score >= 60
        ? `최근 학습 성장률이 ${toSignedPercent(input.growthRate)}로 하락해 성장 모멘텀이 약합니다.`
        : `최근 성장률 ${toSignedPercent(input.growthRate)}로 큰 문제는 아니지만 추세 관찰이 필요합니다.`,
    getAction: () => '이번 주 학습량과 계획 난이도를 함께 조정해 성장률 반등 구간을 만들어 주세요.',
  },
  completionRate: {
    key: 'completionRate',
    label: '계획 완료율',
    getRawValue: (input) => input.completionRate,
    getDisplayValue: (input) => toPercent(input.completionRate),
    getScore: (input) => scoreWhenLowerIsWorse(input.completionRate, 85, 45),
    getReason: (input, score) =>
      score >= 60
        ? `오늘 계획 완료율이 ${toPercent(input.completionRate)}로 낮아 실행력이 무너지고 있습니다.`
        : `완료율 ${toPercent(input.completionRate)}로 기준선 근처입니다.`,
    getAction: () => '계획 분량을 줄이거나 우선순위를 재설정해 당일 완주 경험을 다시 만들어 주세요.',
  },
  penalty: {
    key: 'penalty',
    label: '벌점',
    getRawValue: (input) => input.penalty,
    getDisplayValue: (input) => `${Math.round(input.penalty)}점`,
    getScore: (input) => scoreWhenHigherIsWorse(input.penalty, 1, 12),
    getReason: (input, score) =>
      score >= 60
        ? `누적 벌점 ${Math.round(input.penalty)}점으로 규율 리스크가 커졌습니다.`
        : `벌점 ${Math.round(input.penalty)}점으로 아직 관리 가능 구간입니다.`,
    getAction: () => '규율 이슈의 반복 원인을 확인하고 루틴, 좌석, 생활 지침을 다시 정리해 주세요.',
  },
  focusStat: {
    key: 'focusStat',
    label: '집중 지표',
    getRawValue: (input) => input.focusStat,
    getDisplayValue: (input) => toPercent(input.focusStat),
    getScore: (input) => scoreWhenLowerIsWorse(input.focusStat, 82, 38),
    getReason: (input, score) =>
      score >= 60
        ? `집중 지표가 ${toPercent(input.focusStat)}로 낮아 실제 수행 품질 저하가 의심됩니다.`
        : `집중 지표 ${toPercent(input.focusStat)}로 안정권에 가깝습니다.`,
    getAction: () => '좌석, 소음, 과목 배치, 시작 루틴을 조정해 집중 진입 장벽을 낮춰 주세요.',
  },
  consistency: {
    key: 'consistency',
    label: '꾸준함',
    getRawValue: (input) => input.consistency,
    getDisplayValue: (input) => toPercent(input.consistency),
    getScore: (input) => scoreWhenLowerIsWorse(input.consistency, 78, 30),
    getReason: (input, score) =>
      score >= 60
        ? `꾸준함 지표가 ${toPercent(input.consistency)}로 떨어져 습관 붕괴 가능성이 큽니다.`
        : `꾸준함 지표 ${toPercent(input.consistency)}로 관리 가능한 수준입니다.`,
    getAction: () => '고정 시작 시간과 최소 학습 기준을 다시 설정해 루틴을 복구해 주세요.',
  },
  studyVariance: {
    key: 'studyVariance',
    label: '학습 변동성',
    getRawValue: (input) => input.studyVariance,
    getDisplayValue: (input) => `${Math.round(input.studyVariance)}분`,
    getScore: (input) => scoreWhenHigherIsWorse(input.studyVariance, 40, 160),
    getReason: (input, score) =>
      score >= 60
        ? `최근 학습시간 변동성이 ${Math.round(input.studyVariance)}분으로 커서 패턴이 불안정합니다.`
        : `변동성 ${Math.round(input.studyVariance)}분으로 아직 통제 범위입니다.`,
    getAction: () => '요일별 편차를 줄이도록 최소 학습량과 종료 기준을 표준화해 주세요.',
  },
  todayMinutes: {
    key: 'todayMinutes',
    label: '오늘 학습시간',
    getRawValue: (input) => input.todayMinutes,
    getDisplayValue: (input) => toMinutes(input.todayMinutes),
    getScore: (input) => scoreWhenLowerIsWorse(input.todayMinutes, 240, 60),
    getReason: (input, score) =>
      score >= 60
        ? `오늘 학습시간이 ${toMinutes(input.todayMinutes)}로 기준 대비 부족합니다.`
        : `오늘 학습시간 ${toMinutes(input.todayMinutes)}로 큰 이슈는 아닙니다.`,
    getAction: () => '당일 학습시간 회복이 필요하면 남은 시간표를 재조정해 최소 목표치를 맞춰 주세요.',
  },
  achievement: {
    key: 'achievement',
    label: '성취 지표',
    getRawValue: (input) => input.achievement,
    getDisplayValue: (input) => toPercent(input.achievement),
    getScore: (input) => scoreWhenLowerIsWorse(input.achievement, 78, 30),
    getReason: (input, score) =>
      score >= 60
        ? `성취 지표가 ${toPercent(input.achievement)}로 낮아 성장 체감이 약합니다.`
        : `성취 지표 ${toPercent(input.achievement)}는 보통 수준입니다.`,
    getAction: () => '작게 성공할 수 있는 목표를 다시 배치해 성취 경험을 빠르게 회복해 주세요.',
  },
  resilience: {
    key: 'resilience',
    label: '회복 탄력성',
    getRawValue: (input) => input.resilience,
    getDisplayValue: (input) => toPercent(input.resilience),
    getScore: (input) => scoreWhenLowerIsWorse(input.resilience, 75, 28),
    getReason: (input, score) =>
      score >= 60
        ? `회복 탄력성 지표가 ${toPercent(input.resilience)}로 낮아 흔들린 뒤 회복이 더딥니다.`
        : `회복 탄력성 ${toPercent(input.resilience)}는 유지되고 있습니다.`,
    getAction: () => '실패 뒤 바로 다시 시작할 수 있는 짧은 복귀 루틴을 설계해 주세요.',
  },
  avgStudyMinutes7d: {
    key: 'avgStudyMinutes7d',
    label: '최근 7일 평균 학습시간',
    getRawValue: (input) => input.avgStudyMinutes7d,
    getDisplayValue: (input) => toMinutes(input.avgStudyMinutes7d),
    getScore: (input) => scoreWhenLowerIsWorse(input.avgStudyMinutes7d, 220, 90),
    getReason: (input, score) =>
      score >= 60
        ? `최근 7일 평균 학습시간이 ${toMinutes(input.avgStudyMinutes7d)}로 낮은 편입니다.`
        : `최근 7일 평균 ${toMinutes(input.avgStudyMinutes7d)}로 유지되고 있습니다.`,
    getAction: () => '최근 1주 기준선을 높이기 위해 하루 최소 학습량을 명확히 고정해 주세요.',
  },
  todayVsAverageDeltaRate: {
    key: 'todayVsAverageDeltaRate',
    label: '오늘 대비 최근 평균 편차',
    getRawValue: (input) => input.todayVsAverageDeltaRate,
    getDisplayValue: (input) => toSignedPercent(input.todayVsAverageDeltaRate),
    getScore: (input) => scoreWhenLowerIsWorse(input.todayVsAverageDeltaRate, -0.05, -0.6),
    getReason: (input, score) =>
      score >= 60
        ? `오늘 학습량이 최근 평균 대비 ${toSignedPercent(input.todayVsAverageDeltaRate)}로 크게 밀렸습니다.`
        : `오늘 편차 ${toSignedPercent(input.todayVsAverageDeltaRate)}는 관리 가능한 수준입니다.`,
    getAction: () => '오늘 편차가 큰 날은 남은 과목 수와 난이도를 줄여 회복 가능한 계획으로 바꿔 주세요.',
  },
  trend14d: {
    key: 'trend14d',
    label: '14일 추세',
    getRawValue: (input) => input.trend14d,
    getDisplayValue: (input) => toSignedPercent(input.trend14d),
    getScore: (input) => scoreWhenLowerIsWorse(input.trend14d, 0.04, -0.3),
    getReason: (input, score) =>
      score >= 60
        ? `최근 14일 추세가 ${toSignedPercent(input.trend14d)}로 하락 구간입니다.`
        : `14일 추세 ${toSignedPercent(input.trend14d)}로 급락은 아닙니다.`,
    getAction: () => '2주 추세 반전을 목표로 과목 구성과 공부 시작 시간을 동시에 손봐 주세요.',
  },
  lowStudyStreak: {
    key: 'lowStudyStreak',
    label: '저학습 연속일',
    getRawValue: (input) => input.lowStudyStreak,
    getDisplayValue: (input) => `${Math.round(input.lowStudyStreak)}일`,
    getScore: (input) => scoreWhenHigherIsWorse(input.lowStudyStreak, 0, 5),
    getReason: (input, score) =>
      score >= 60
        ? `${Math.round(input.lowStudyStreak)}일 연속 저학습 상태라 이탈 리스크가 커지고 있습니다.`
        : `저학습 연속 ${Math.round(input.lowStudyStreak)}일로 아직 회복 가능한 구간입니다.`,
    getAction: () => '연속 저학습을 끊는 것이 우선이므로 오늘 안에 최소 성공 경험을 만들어 주세요.',
  },
  consecutiveLowPerformanceDays: {
    key: 'consecutiveLowPerformanceDays',
    label: '연속 저성과 일수',
    getRawValue: (input) => input.consecutiveLowPerformanceDays,
    getDisplayValue: (input) => `${Math.round(input.consecutiveLowPerformanceDays)}일`,
    getScore: (input) => scoreWhenHigherIsWorse(input.consecutiveLowPerformanceDays, 0, 6),
    getReason: (input, score) =>
      score >= 60
        ? `${Math.round(input.consecutiveLowPerformanceDays)}일 연속 저성과가 이어져 패턴 회복이 필요합니다.`
        : `연속 저성과 ${Math.round(input.consecutiveLowPerformanceDays)}일로 단기 조정 수준입니다.`,
    getAction: () => '연속 저성과 구간에서는 계획을 축소하고 즉시 피드백 빈도를 높여 주세요.',
  },
  lastActivityDaysAgo: {
    key: 'lastActivityDaysAgo',
    label: '최근 활동 공백',
    getRawValue: (input) => input.lastActivityDaysAgo,
    getDisplayValue: (input) => `${Math.round(input.lastActivityDaysAgo)}일`,
    getScore: (input) => scoreWhenHigherIsWorse(input.lastActivityDaysAgo, 0, 4),
    getReason: (input, score) =>
      score >= 60
        ? `최근 활동 공백이 ${Math.round(input.lastActivityDaysAgo)}일로 길어 데이터상 disengagement 신호가 있습니다.`
        : `활동 공백 ${Math.round(input.lastActivityDaysAgo)}일로 큰 이탈 징후는 아닙니다.`,
    getAction: () => '활동 공백이 길어지면 보호자나 학생 접촉으로 현재 상태를 먼저 확인해 주세요.',
  },
};

const dimensionDefinitions: Record<RiskDimensionKey, DimensionDefinition> = {
  dropout: {
    label: DIMENSION_LABELS.dropout,
    overallWeight: 0.35,
    factors: [
      { weight: 0.24, definition: factorDefinitions.growthRate },
      { weight: 0.20, definition: factorDefinitions.lowStudyStreak },
      { weight: 0.18, definition: factorDefinitions.completionRate },
      { weight: 0.12, definition: factorDefinitions.penalty },
      { weight: 0.14, definition: factorDefinitions.trend14d },
      { weight: 0.12, definition: factorDefinitions.lastActivityDaysAgo },
    ],
  },
  focus: {
    label: DIMENSION_LABELS.focus,
    overallWeight: 0.30,
    factors: [
      { weight: 0.30, definition: factorDefinitions.focusStat },
      { weight: 0.22, definition: factorDefinitions.todayMinutes },
      { weight: 0.18, definition: factorDefinitions.todayVsAverageDeltaRate },
      { weight: 0.15, definition: factorDefinitions.consistency },
      { weight: 0.15, definition: factorDefinitions.lowStudyStreak },
    ],
  },
  pattern: {
    label: DIMENSION_LABELS.pattern,
    overallWeight: 0.20,
    factors: [
      { weight: 0.28, definition: factorDefinitions.studyVariance },
      { weight: 0.24, definition: factorDefinitions.consistency },
      { weight: 0.18, definition: factorDefinitions.trend14d },
      { weight: 0.16, definition: factorDefinitions.consecutiveLowPerformanceDays },
      { weight: 0.14, definition: factorDefinitions.avgStudyMinutes7d },
    ],
  },
  stagnation: {
    label: DIMENSION_LABELS.stagnation,
    overallWeight: 0.15,
    factors: [
      { weight: 0.28, definition: factorDefinitions.growthRate },
      { weight: 0.22, definition: factorDefinitions.achievement },
      { weight: 0.18, definition: factorDefinitions.completionRate },
      { weight: 0.14, definition: factorDefinitions.resilience },
      { weight: 0.18, definition: factorDefinitions.trend14d },
    ],
  },
};

function createDimensionExplanation(
  dimension: RiskDimensionKey,
  input: RequiredRiskInput,
): RiskDimensionExplanation {
  const definition = dimensionDefinitions[dimension];
  const factors = definition.factors.map(({ weight, definition: factorDefinition }) => {
    const normalizedScore = Math.round(clamp(factorDefinition.getScore(input)));
    const dimensionContribution = normalizedScore * weight;
    const overallContribution = dimensionContribution * definition.overallWeight;
    return {
      dimension,
      key: factorDefinition.key,
      label: factorDefinition.label,
      rawValue: factorDefinition.getRawValue(input),
      displayValue: factorDefinition.getDisplayValue(input),
      normalizedScore,
      weight,
      dimensionContribution: Math.round(dimensionContribution * 10) / 10,
      overallContribution: Math.round(overallContribution * 10) / 10,
      level: getRiskLevel(normalizedScore),
      reason: factorDefinition.getReason(input, normalizedScore),
      recommendedAction: factorDefinition.getAction(input, normalizedScore),
    } satisfies RiskFactorBreakdown;
  });

  const score = Math.round(
    factors.reduce((sum, factor) => sum + factor.normalizedScore * factor.weight, 0),
  );
  const sortedFactors = [...factors].sort((a, b) => b.dimensionContribution - a.dimensionContribution);
  const summary =
    sortedFactors.length >= 2
      ? `${sortedFactors[0].label}, ${sortedFactors[1].label} 영향이 가장 큽니다.`
      : `${definition.label} 리스크를 구성하는 요인을 점검하세요.`;

  return {
    dimension,
    label: definition.label,
    score,
    level: getRiskLevel(score),
    overallWeight: definition.overallWeight,
    overallContribution: Math.round(score * definition.overallWeight * 10) / 10,
    summary,
    factors: sortedFactors,
  };
}

export function dominantDimension(dims: RiskDimensions): RiskDimensionKey {
  const entries: Array<[RiskDimensionKey, number]> = [
    ['dropout', dims.dropout],
    ['focus', dims.focus],
    ['pattern', dims.pattern],
    ['stagnation', dims.stagnation],
  ];
  return entries.reduce((best, current) => (current[1] > best[1] ? current : best))[0];
}

function buildConfidence(input: RequiredRiskInput): {
  score: number;
  level: RiskConfidenceLevel;
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 20;

  score += clamp((input.observedDays / 14) * 35, 0, 35);
  if (input.hasRecentStudyLogs) score += 15;
  else reasons.push('최근 학습 로그가 부족합니다.');

  if (input.hasTodayStat) score += 10;
  else reasons.push('오늘 통계가 아직 집계되지 않았습니다.');

  if (input.hasGrowthProgress) score += 10;
  else reasons.push('성장/행동 지표가 부족합니다.');

  score += clamp((Math.max(0, 7 - input.lastActivityDaysAgo) / 7) * 5, 0, 5);

  if (input.observedDays < 7) reasons.push(`관측일이 ${input.observedDays}일이라 신입/초기 데이터 구간입니다.`);
  if (input.lastActivityDaysAgo >= 2) reasons.push(`최근 활동 공백이 ${input.lastActivityDaysAgo}일입니다.`);

  const rounded = Math.round(clamp(score));
  const level: RiskConfidenceLevel = rounded >= 75 ? '높음' : rounded >= 45 ? '보통' : '낮음';
  if (reasons.length === 0) reasons.push('최근 데이터가 충분해 해석 신뢰도가 높습니다.');

  return { score: rounded, level, reasons };
}

export function buildRevenueRiskExposure(input: {
  overallScore: number;
  latestInvoiceAmount?: number;
  monthlyFee?: number;
  outstandingAmount?: number;
}): RevenueRiskExposure {
  const monthlyRevenueBasis =
    input.latestInvoiceAmount && input.latestInvoiceAmount > 0
      ? input.latestInvoiceAmount
      : input.monthlyFee && input.monthlyFee > 0
        ? input.monthlyFee
        : 0;
  const basisSource: RevenueRiskExposure['basisSource'] =
    input.latestInvoiceAmount && input.latestInvoiceAmount > 0
      ? 'invoice'
      : input.monthlyFee && input.monthlyFee > 0
        ? 'membership'
        : 'none';
  const outstandingAmount = Math.max(0, Number(input.outstandingAmount || 0));

  const multiplier =
    input.overallScore >= 75 ? 0.7 :
    input.overallScore >= 55 ? 0.45 :
    input.overallScore >= 30 ? 0.2 : 0.08;
  const revenueAtRisk = Math.round(monthlyRevenueBasis * multiplier);
  const exposureMagnitude = Math.max(revenueAtRisk, outstandingAmount);
  const exposureLevel: RevenueExposureLevel =
    exposureMagnitude >= 500000 ? 'critical' :
    exposureMagnitude >= 250000 ? 'high' :
    exposureMagnitude >= 100000 ? 'medium' : 'low';

  return {
    monthlyRevenueBasis: Math.round(monthlyRevenueBasis),
    basisSource,
    outstandingAmount: Math.round(outstandingAmount),
    revenueAtRisk,
    exposureLevel,
  };
}

function dedupeActions(items: RiskActionItem[]): RiskActionItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.priority}:${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function actionFromFactor(factor: RiskFactorBreakdown): RiskActionItem {
  const highUrgency = factor.normalizedScore >= 75;
  const owner: RiskActionOwner =
    factor.dimension === 'dropout' ? 'manager' :
    factor.dimension === 'pattern' ? 'operator' :
    'teacher';
  return {
    priority: highUrgency ? 'today' : factor.normalizedScore >= 45 ? 'week' : 'observe',
    owner,
    title: `${factor.label} 대응`,
    description: factor.recommendedAction,
    dimension: factor.dimension,
    factorKey: factor.key,
  };
}

function buildObservationNotes(input: RequiredRiskInput, confidence: { level: RiskConfidenceLevel }): string[] {
  const notes: string[] = [];
  if (confidence.level === '낮음') notes.push('데이터가 충분하지 않아 해석에 보수적 접근이 필요합니다.');
  if (input.observedDays < 7) notes.push('입실 초기 학생일 수 있어 과도한 개입보다 추세 관찰이 우선입니다.');
  if (input.todayVsAverageDeltaRate < -0.35) notes.push('오늘 컨디션 이슈 가능성이 있어 단기 편차와 구조적 하락을 구분해서 봐야 합니다.');
  if (input.penalty === 0 && input.todayMinutes > 220 && input.completionRate > 75) {
    notes.push('현재 리스크 대비 실제 수행은 안정적이어서 과잉 경보 여부를 함께 점검하세요.');
  }
  return notes.slice(0, 3);
}

export function analyzeStudentRisk(
  input: RiskInput,
  identity: StudentRiskIdentity,
  revenueInput?: { latestInvoiceAmount?: number; monthlyFee?: number; outstandingAmount?: number },
): StudentRiskAnalysis {
  const normalizedInput = withDefaults(input);
  const explanations = {
    dropout: createDimensionExplanation('dropout', normalizedInput),
    focus: createDimensionExplanation('focus', normalizedInput),
    pattern: createDimensionExplanation('pattern', normalizedInput),
    stagnation: createDimensionExplanation('stagnation', normalizedInput),
  } satisfies Record<RiskDimensionKey, RiskDimensionExplanation>;

  const dimensions: RiskDimensions = {
    dropout: explanations.dropout.score,
    focus: explanations.focus.score,
    pattern: explanations.pattern.score,
    stagnation: explanations.stagnation.score,
    overall: Math.round(
      explanations.dropout.score * dimensionDefinitions.dropout.overallWeight +
      explanations.focus.score * dimensionDefinitions.focus.overallWeight +
      explanations.pattern.score * dimensionDefinitions.pattern.overallWeight +
      explanations.stagnation.score * dimensionDefinitions.stagnation.overallWeight,
    ),
  };

  const allFactors = Object.values(explanations)
    .flatMap((explanation) => explanation.factors)
    .sort((a, b) => b.overallContribution - a.overallContribution);
  const topFactors = allFactors.slice(0, 3);
  const confidence = buildConfidence(normalizedInput);
  const revenue = buildRevenueRiskExposure({
    overallScore: dimensions.overall,
    latestInvoiceAmount: revenueInput?.latestInvoiceAmount,
    monthlyFee: revenueInput?.monthlyFee,
    outstandingAmount: revenueInput?.outstandingAmount,
  });

  const factorActions = dedupeActions(topFactors.map(actionFromFactor));
  const immediateActions = factorActions.filter((item) => item.priority === 'today').slice(0, 3);
  const weeklyActions = factorActions.filter((item) => item.priority !== 'today').slice(0, 4);
  const observationNotes = buildObservationNotes(normalizedInput, confidence);

  return {
    identity,
    dimensions,
    overallLevel: getRiskLevel(dimensions.overall),
    dominantDimension: dominantDimension(dimensions),
    confidenceScore: confidence.score,
    confidenceLevel: confidence.level,
    confidenceReasons: confidence.reasons,
    topFactors,
    explanations,
    immediateActions,
    weeklyActions,
    observationNotes,
    metricsSnapshot: {
      growthRate: normalizedInput.growthRate,
      completionRate: normalizedInput.completionRate,
      todayMinutes: normalizedInput.todayMinutes,
      avgStudyMinutes7d: normalizedInput.avgStudyMinutes7d,
      todayVsAverageDeltaRate: normalizedInput.todayVsAverageDeltaRate,
      trend14d: normalizedInput.trend14d,
      penalty: normalizedInput.penalty,
      lowStudyStreak: normalizedInput.lowStudyStreak,
      consecutiveLowPerformanceDays: normalizedInput.consecutiveLowPerformanceDays,
      studyVariance: normalizedInput.studyVariance,
      observedDays: normalizedInput.observedDays,
      lastActivityDaysAgo: normalizedInput.lastActivityDaysAgo,
    },
    revenue,
  };
}

export function calcRiskDimensions(input: RiskInput): RiskDimensions {
  return analyzeStudentRisk(input, { studentId: 'derived', studentName: 'derived' }).dimensions;
}

export function getInterventionGuide(dims: RiskDimensions, overall: number): string {
  if (overall < 30) {
    return '현재는 안정 구간입니다. 좋은 루틴을 유지하도록 긍정 피드백과 주간 점검만 이어가면 됩니다.';
  }

  const dom = dominantDimension(dims);
  const prefix =
    overall >= 75 ? '즉시 개입이 필요합니다. ' :
    overall >= 55 ? '이번 주 안에 조치가 필요합니다. ' :
    '주의 관찰이 필요합니다. ';

  const guideMap: Record<RiskDimensionKey, string> = {
    dropout: '이탈이나 휴원 가능성이 커지고 있으니 학생 상태 확인과 보호자 커뮤니케이션을 먼저 잡아 주세요.',
    focus: '집중 진입이 깨지고 있으니 좌석, 과목 순서, 시작 루틴을 바로 손봐 주세요.',
    pattern: '루틴 변동성이 커지고 있으니 고정 시작 시간과 최소 학습 기준을 다시 세워 주세요.',
    stagnation: '성장 정체가 보이니 난이도와 목표 설계를 재조정해 작은 성취를 빠르게 만들 필요가 있습니다.',
  };
  return prefix + guideMap[dom];
}

export function buildExecutiveRiskSummary(analyses: StudentRiskAnalysis[]): ExecutiveRiskSummary {
  const total = analyses.length;
  const stable = analyses.filter((item) => item.overallLevel === '안정').length;
  const warning = analyses.filter((item) => item.overallLevel === '주의').length;
  const high = analyses.filter((item) => item.overallLevel === '위험').length;
  const critical = analyses.filter((item) => item.overallLevel === '긴급').length;
  const averageScore = total ? Math.round(average(analyses.map((item) => item.dimensions.overall))) : 0;
  const averageConfidence = total ? Math.round(average(analyses.map((item) => item.confidenceScore))) : 0;

  const dimensionCounts = (Object.keys(DIMENSION_LABELS) as RiskDimensionKey[]).map((dimension) => ({
    dimension,
    label: DIMENSION_LABELS[dimension],
    count: analyses.filter((item) => item.dominantDimension === dimension).length,
  })).sort((a, b) => b.count - a.count);

  const lowConfidenceList = analyses
    .filter((item) => item.confidenceScore < 45)
    .sort((a, b) => a.confidenceScore - b.confidenceScore)
    .slice(0, 5);

  const actionQueue = dedupeActions(
    analyses.flatMap((item) => [...item.immediateActions, ...item.weeklyActions]),
  ).sort((a, b) => {
    const priorityWeight = { today: 0, week: 1, observe: 2 } satisfies Record<RiskActionPriority, number>;
    return priorityWeight[a.priority] - priorityWeight[b.priority];
  });

  return {
    population: {
      total,
      stable,
      warning,
      high,
      critical,
      averageScore,
      averageConfidence,
    },
    ceo: {
      highRiskStudents: analyses.filter((item) => item.dimensions.overall >= 55).length,
      criticalStudents: critical,
      revenueAtRisk: analyses.reduce((sum, item) => sum + item.revenue.revenueAtRisk, 0),
      topSegments: dimensionCounts.slice(0, 4),
      topStudents: [...analyses].sort((a, b) => b.dimensions.overall - a.dimensions.overall).slice(0, 5),
    },
    cto: {
      lowConfidenceStudents: analyses.filter((item) => item.confidenceScore < 45).length,
      missingTodayStatStudents: analyses.filter((item) => item.confidenceReasons.some((reason) => reason.includes('오늘 통계'))).length,
      missingGrowthDataStudents: analyses.filter((item) => item.confidenceReasons.some((reason) => reason.includes('성장/행동'))).length,
      staleStudents: analyses.filter((item) => item.metricsSnapshot.lastActivityDaysAgo >= 2).length,
      dataCoverageRate: total ? Math.round((analyses.filter((item) => item.confidenceScore >= 45).length / total) * 100) : 0,
      explainabilityHealthyRate: total ? Math.round((analyses.filter((item) => item.topFactors.length >= 3).length / total) * 100) : 0,
      lowConfidenceList,
    },
    cfo: {
      revenueAtRisk: analyses.reduce((sum, item) => sum + item.revenue.revenueAtRisk, 0),
      outstandingAtRisk: analyses.reduce((sum, item) => sum + item.revenue.outstandingAmount, 0),
      criticalExposureStudents: analyses.filter((item) => item.revenue.exposureLevel === 'critical').length,
      highExposureList: [...analyses]
        .sort((a, b) => (b.revenue.revenueAtRisk + b.revenue.outstandingAmount) - (a.revenue.revenueAtRisk + a.revenue.outstandingAmount))
        .slice(0, 5),
    },
    coo: {
      todayActionCount: actionQueue.filter((item) => item.priority === 'today').length,
      weekActionCount: actionQueue.filter((item) => item.priority === 'week').length,
      dominantDimensions: dimensionCounts,
      actionQueue: actionQueue.slice(0, 10),
      topOperationsList: [...analyses]
        .sort((a, b) => {
          const scoreA = a.immediateActions.length * 100 + a.dimensions.overall;
          const scoreB = b.immediateActions.length * 100 + b.dimensions.overall;
          return scoreB - scoreA;
        })
        .slice(0, 5),
    },
  };
}
