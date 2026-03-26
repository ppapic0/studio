import type { DisplayAttendanceStatus } from '@/lib/attendance-auto';
import type { AttendanceCurrent } from '@/lib/types';

export type StudyBand = '저학습' | '기준학습' | '고학습' | '고집중';
export type GrowthBand = '급하락' | '하락' | '유지' | '상승' | '급상승';
export type CompletionBand = '낮음' | '보통' | '양호' | '높음';
export type VolatilityBand = '안정' | '출렁임' | '불안정';
export type RoutineBand = '정상' | '지각' | '루틴누락' | '미입실' | '퇴실불안정';
export type ContinuityBand = '회복중' | '유지중' | '연속호조' | '연속저하';
export type PedagogyLens = '습관 형성' | '자기조절' | '집중 회복' | '성장 가속';
export type DailyReportVariationStyle =
  | '차분한 관찰형'
  | '격려형'
  | '전략 코칭형'
  | '균형 피드백형'
  | '가정 대화형'
  | '회복 지원형';

export interface DailyReportAiMetrics {
  growthRate: number;
  deltaMinutesFromAvg: number;
  avg7StudyMinutes: number;
  isNewRecord: boolean;
  alertLow: boolean;
  streakBadge: boolean;
  trendSummary: string;
}

export interface DailyReportAiSignals {
  attendanceLabel: string;
  studyBand: StudyBand;
  growthBand: GrowthBand;
  completionBand: CompletionBand;
  volatilityBand: VolatilityBand;
  routineBand: RoutineBand;
  continuityBand: ContinuityBand;
  pedagogyLens: PedagogyLens;
  secondaryLens: PedagogyLens;
  stateBucket: string;
  variationKey: string;
  variationStyle: DailyReportVariationStyle;
  variationGuide: string;
  coachingFocus: string;
  homeTip: string;
  metrics: DailyReportAiMetrics;
}

type DeriveDailyReportSignalsInput = {
  studentId: string;
  dateKey: string;
  totalStudyMinutes: number;
  completionRate: number;
  history7Days: Array<{ date: string; minutes: number }>;
  growthRateOverridePercent?: number | null;
  attendanceDisplayStatus?: DisplayAttendanceStatus | 'checked_out' | 'planned' | null;
  currentSeatStatus?: AttendanceCurrent['status'];
  isTodayTarget?: boolean;
  hasAttendanceEvidence?: boolean;
  recentVariationKeys?: string[];
  preferredVariationKey?: string | null;
};

const VARIATION_STYLE_BY_INDEX: DailyReportVariationStyle[] = [
  '차분한 관찰형',
  '격려형',
  '전략 코칭형',
  '균형 피드백형',
  '가정 대화형',
  '회복 지원형',
];

function clampMinutes(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function safePercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function hashSeed(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function resolveDailyReportLevel(totalStudyMinutes: number, completionRate: number) {
  const minutes = clampMinutes(totalStudyMinutes);
  const safeCompletionRate = Math.max(0, Math.min(100, Math.round(completionRate)));

  const minuteLevel =
    minutes < 60 ? 1
      : minutes < 120 ? 2
      : minutes < 180 ? 3
      : minutes < 240 ? 4
      : minutes < 300 ? 5
      : minutes < 360 ? 6
      : minutes < 420 ? 7
      : minutes < 480 ? 8
      : minutes < 540 ? 9
      : 10;

  const completionLevel =
    safeCompletionRate < 40 ? 1
      : safeCompletionRate < 50 ? 2
      : safeCompletionRate < 60 ? 3
      : safeCompletionRate < 70 ? 4
      : safeCompletionRate < 75 ? 5
      : safeCompletionRate < 80 ? 6
      : safeCompletionRate < 85 ? 7
      : safeCompletionRate < 90 ? 8
      : safeCompletionRate < 95 ? 9
      : 10;

  const level = Math.max(1, Math.min(minuteLevel, completionLevel));
  const names: Record<number, string> = {
    1: '학습 습관 형성 단계',
    2: '적응 단계',
    3: '기본 루틴 형성 단계',
    4: '안정적 진입 단계',
    5: '자기주도 시작 단계',
    6: '집중도 향상 단계',
    7: '상위권 루틴 단계',
    8: '고효율 학습 단계',
    9: '최상위 집중 단계',
    10: '수능 상위권 완성 단계',
  };

  return {
    level,
    levelName: names[level] ?? '학습 성장 단계',
  };
}

export function formatDailyReportStudyTime(totalMinutes: number) {
  const minutes = clampMinutes(totalMinutes);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

function resolveStudyBand(totalStudyMinutes: number): StudyBand {
  if (totalStudyMinutes < 120) return '저학습';
  if (totalStudyMinutes < 240) return '기준학습';
  if (totalStudyMinutes < 360) return '고학습';
  return '고집중';
}

function resolveGrowthBand(growthRate: number): GrowthBand {
  if (growthRate <= -20) return '급하락';
  if (growthRate <= -8) return '하락';
  if (growthRate < 8) return '유지';
  if (growthRate < 20) return '상승';
  return '급상승';
}

function resolveCompletionBand(completionRate: number): CompletionBand {
  if (completionRate < 60) return '낮음';
  if (completionRate < 75) return '보통';
  if (completionRate < 90) return '양호';
  return '높음';
}

function resolveVolatilityBand(historyMinutes: number[], todayMinutes: number): VolatilityBand {
  const series = [...historyMinutes, todayMinutes].filter((value) => Number.isFinite(value));
  if (series.length < 3) return '안정';

  const maxValue = Math.max(...series);
  const minValue = Math.min(...series);
  const swing = maxValue - minValue;
  const averageMinutes = Math.max(1, average(series));
  const swingRatio = swing / averageMinutes;

  if (swing >= 140 || swingRatio >= 0.65) return '불안정';
  if (swing >= 70 || swingRatio >= 0.35) return '출렁임';
  return '안정';
}

function resolveRoutineBand(params: {
  attendanceDisplayStatus?: DisplayAttendanceStatus | 'checked_out' | 'planned' | null;
  currentSeatStatus?: AttendanceCurrent['status'];
  isTodayTarget: boolean;
  hasAttendanceEvidence: boolean;
}): RoutineBand {
  const { attendanceDisplayStatus, currentSeatStatus, isTodayTarget, hasAttendanceEvidence } = params;

  if (attendanceDisplayStatus === 'confirmed_late') return '지각';
  if (
    attendanceDisplayStatus === 'missing_routine' ||
    attendanceDisplayStatus === 'confirmed_present_missing_routine'
  ) {
    return '루틴누락';
  }
  if (attendanceDisplayStatus === 'confirmed_absent') return '미입실';
  if (
    isTodayTarget &&
    currentSeatStatus === 'absent' &&
    hasAttendanceEvidence
  ) {
    return '퇴실불안정';
  }
  return '정상';
}

function resolveAttendanceLabel(params: {
  attendanceDisplayStatus?: DisplayAttendanceStatus | 'checked_out' | 'planned' | null;
  currentSeatStatus?: AttendanceCurrent['status'];
  isTodayTarget: boolean;
  hasAttendanceEvidence: boolean;
}): string {
  const { attendanceDisplayStatus, currentSeatStatus, isTodayTarget, hasAttendanceEvidence } = params;

  if (currentSeatStatus === 'away' || currentSeatStatus === 'break') return '외출 또는 휴식 흐름';
  if (attendanceDisplayStatus === 'confirmed_late') return '지각 후 입실';
  if (attendanceDisplayStatus === 'missing_routine') return '루틴 기록 누락';
  if (attendanceDisplayStatus === 'confirmed_present_missing_routine') return '입실은 했지만 루틴 기록 누락';
  if (attendanceDisplayStatus === 'confirmed_absent') return '미입실';
  if (
    isTodayTarget &&
    currentSeatStatus === 'absent' &&
    hasAttendanceEvidence
  ) {
    return '퇴실 후 흐름 점검 필요';
  }
  if (currentSeatStatus === 'studying' || attendanceDisplayStatus === 'confirmed_present') return '정상 입실';
  return '출결 정보 확인 중';
}

function resolveContinuityBand(historyMinutes: number[], todayMinutes: number, avg7StudyMinutes: number): ContinuityBand {
  const recent = [...historyMinutes, todayMinutes].filter((value) => Number.isFinite(value));
  if (recent.length < 3) return '유지중';

  const recentThree = recent.slice(-3);
  const previousThree = recent.slice(-4, -1);
  const thresholdHigh = Math.max(240, avg7StudyMinutes * 1.05);
  const thresholdLow = Math.max(120, avg7StudyMinutes * 0.8);

  const isIncreasing = recentThree[0] <= recentThree[1] && recentThree[1] <= recentThree[2];
  const isDecreasing = recentThree[0] >= recentThree[1] && recentThree[1] >= recentThree[2];
  const wasLow = previousThree.length === 3 && previousThree.every((value) => value < thresholdLow);
  const nowRecovered = todayMinutes >= Math.max(thresholdLow, avg7StudyMinutes + 20);

  if (recentThree.every((value) => value >= thresholdHigh) && isIncreasing) return '연속호조';
  if (recentThree.every((value) => value < thresholdLow) && isDecreasing) return '연속저하';
  if (wasLow && nowRecovered) return '회복중';
  return '유지중';
}

function resolvePedagogyLens(params: {
  studyBand: StudyBand;
  growthBand: GrowthBand;
  completionBand: CompletionBand;
  volatilityBand: VolatilityBand;
  routineBand: RoutineBand;
  continuityBand: ContinuityBand;
}) {
  const { studyBand, growthBand, completionBand, volatilityBand, routineBand, continuityBand } = params;

  let pedagogyLens: PedagogyLens = '자기조절';
  if (routineBand !== '정상' || studyBand === '저학습') {
    pedagogyLens = '습관 형성';
  } else if (continuityBand === '연속저하' || growthBand === '급하락' || growthBand === '하락') {
    pedagogyLens = '집중 회복';
  } else if (
    (studyBand === '고학습' || studyBand === '고집중') &&
    (growthBand === '상승' || growthBand === '급상승') &&
    (completionBand === '양호' || completionBand === '높음')
  ) {
    pedagogyLens = '성장 가속';
  }

  let secondaryLens: PedagogyLens = '자기조절';
  if (pedagogyLens === '습관 형성') {
    secondaryLens = completionBand === '높음' ? '자기조절' : '집중 회복';
  } else if (pedagogyLens === '집중 회복') {
    secondaryLens = routineBand !== '정상' ? '습관 형성' : '자기조절';
  } else if (pedagogyLens === '성장 가속') {
    secondaryLens = volatilityBand === '안정' ? '자기조절' : '집중 회복';
  } else {
    secondaryLens = routineBand !== '정상' ? '습관 형성' : continuityBand === '연속호조' ? '성장 가속' : '집중 회복';
  }

  return { pedagogyLens, secondaryLens };
}

function buildVariationGuide(variationStyle: DailyReportVariationStyle) {
  switch (variationStyle) {
    case '차분한 관찰형':
      return '차분하고 객관적인 관찰형 문장으로 쓰고, 과장된 감탄 표현은 피합니다.';
    case '격려형':
      return '학생의 자존감을 지키는 따뜻한 격려형 문체를 사용하되, 수치 근거는 분명히 남깁니다.';
    case '전략 코칭형':
      return '행동 제안을 구체적으로 쓰고, 내일 바로 실행할 수 있는 전략형 문장으로 씁니다.';
    case '균형 피드백형':
      return '성과와 과제를 균형 있게 다루고, 칭찬과 보완을 5:5 정도로 배치합니다.';
    case '가정 대화형':
      return '가정에서 어떻게 말을 건네면 좋을지 자연스럽게 연결되는 관계형 문체로 씁니다.';
    default:
      return '부담을 낮추는 회복 지원형 문체로 쓰고, 실패 평가보다 회복 경로를 강조합니다.';
  }
}

function selectCoachingFocus(mainLens: PedagogyLens, routineBand: RoutineBand, volatilityBand: VolatilityBand, continuityBand: ContinuityBand) {
  if (mainLens === '습관 형성') {
    if (routineBand !== '정상') return '등원 직후 30분 착수 루틴을 고정하고 첫 과목 시작 시간을 매일 같게 맞추기';
    return '첫 과제 시작 시간을 고정하고 완료 체크를 당일에 마감하기';
  }
  if (mainLens === '집중 회복') {
    if (continuityBand === '연속저하') return '첫 60분 단일 과목 집중 블록으로 리듬을 회복하기';
    return '오늘보다 한 단계 쉬운 목표로 성공 경험을 먼저 확보하기';
  }
  if (mainLens === '성장 가속') {
    return '고난도 과제를 초반 집중 시간에 배치하고 오답 복기를 짧게 바로 연결하기';
  }
  if (volatilityBand !== '안정') {
    return '과목 전환 전에 완료 체크와 10분 복기를 넣어 흐름 손실을 줄이기';
  }
  return '계획-실행-점검의 자기조절 루프를 하루 안에 닫도록 마감 루틴을 유지하기';
}

function selectHomeTip(mainLens: PedagogyLens, routineBand: RoutineBand, continuityBand: ContinuityBand) {
  if (mainLens === '습관 형성') {
    return routineBand !== '정상'
      ? '결과를 묻기보다 오늘 몇 시에 시작했는지부터 짧게 확인해 주세요.'
      : '학습량 평가보다 시작 시간을 지킨 점을 먼저 인정해 주세요.';
  }
  if (mainLens === '집중 회복') {
    return continuityBand === '연속저하'
      ? '비교나 질책보다 오늘 회복된 한 지점을 먼저 짚어 주는 질문이 좋습니다.'
      : '왜 못했는지보다 오늘 다시 붙잡은 구간이 어디였는지 묻는 대화가 도움이 됩니다.';
  }
  if (mainLens === '성장 가속') {
    return '칭찬 뒤에 다음 도전 목표를 한 문장으로 함께 정리해 주면 성장 속도가 유지됩니다.';
  }
  return '공부량 자체보다 어떤 전략이 잘 먹혔는지 질문해 주면 자기조절력이 더 빨리 자랍니다.';
}

function buildTrendSummary(growthBand: GrowthBand, volatilityBand: VolatilityBand, avg7StudyMinutes: number, todayMinutes: number) {
  if (avg7StudyMinutes <= 0) {
    return '비교 데이터가 충분하지 않아 오늘의 흐름을 기준으로 해석했습니다.';
  }
  if ((growthBand === '급상승' || growthBand === '상승') && volatilityBand === '안정') {
    return '최근 7일 평균보다 학습량이 분명히 올라왔고, 흐름도 비교적 안정적으로 유지되었습니다.';
  }
  if ((growthBand === '급상승' || growthBand === '상승') && volatilityBand !== '안정') {
    return '학습량은 올라왔지만 일별 편차가 있어 좋은 날과 흔들리는 날이 함께 나타났습니다.';
  }
  if ((growthBand === '급하락' || growthBand === '하락') && volatilityBand === '안정') {
    return '최근 며칠 비슷한 수준의 낮은 페이스가 이어져 전체 흐름이 아래로 이동했습니다.';
  }
  if ((growthBand === '급하락' || growthBand === '하락') && volatilityBand !== '안정') {
    return '최근 흐름이 내려가면서 동시에 변동성도 커져 리듬 회복이 우선인 상태입니다.';
  }
  if (volatilityBand === '불안정') {
    return '평균 학습량은 유지되지만 날마다 편차가 커서 안정적인 루틴 설계가 필요합니다.';
  }
  return `최근 7일 평균 ${formatDailyReportStudyTime(avg7StudyMinutes)} 대비 오늘 ${formatDailyReportStudyTime(todayMinutes)}으로 큰 흔들림 없이 유지되고 있습니다.`;
}

export function deriveDailyReportSignals({
  studentId,
  dateKey,
  totalStudyMinutes,
  completionRate,
  history7Days,
  growthRateOverridePercent,
  attendanceDisplayStatus,
  currentSeatStatus,
  isTodayTarget = false,
  hasAttendanceEvidence = false,
  recentVariationKeys = [],
  preferredVariationKey,
}: DeriveDailyReportSignalsInput): DailyReportAiSignals {
  const safeMinutes = clampMinutes(totalStudyMinutes);
  const safeCompletionRate = Math.max(0, Math.min(100, Math.round(completionRate)));
  const sortedHistory = [...history7Days]
    .map((item) => ({
      date: item.date,
      minutes: clampMinutes(item.minutes),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const historyMinutes = sortedHistory.map((item) => item.minutes);
  const avg7StudyMinutes = Math.round(average(historyMinutes));
  const deltaMinutesFromAvg = Math.round(safeMinutes - avg7StudyMinutes);
  const fallbackGrowthRate = avg7StudyMinutes > 0 ? safePercent((deltaMinutesFromAvg / avg7StudyMinutes) * 100) : 0;
  const growthRate =
    typeof growthRateOverridePercent === 'number' && Number.isFinite(growthRateOverridePercent)
      ? safePercent(growthRateOverridePercent)
      : fallbackGrowthRate;
  const isNewRecord = historyMinutes.length > 0 && safeMinutes > Math.max(...historyMinutes);
  const last3History = historyMinutes.slice(-3);
  const alertLow = last3History.length === 3 && last3History.every((value) => value < 120) && safeMinutes < 120;
  const streakSource = [...historyMinutes.slice(-4), safeMinutes];
  const streakBadge = streakSource.length >= 5 && streakSource.every((value) => value >= 300);

  const studyBand = resolveStudyBand(safeMinutes);
  const growthBand = resolveGrowthBand(growthRate);
  const completionBand = resolveCompletionBand(safeCompletionRate);
  const volatilityBand = resolveVolatilityBand(historyMinutes, safeMinutes);
  const routineBand = resolveRoutineBand({
    attendanceDisplayStatus,
    currentSeatStatus,
    isTodayTarget,
    hasAttendanceEvidence,
  });
  const continuityBand = resolveContinuityBand(historyMinutes, safeMinutes, avg7StudyMinutes);
  const { pedagogyLens, secondaryLens } = resolvePedagogyLens({
    studyBand,
    growthBand,
    completionBand,
    volatilityBand,
    routineBand,
    continuityBand,
  });

  const stateBucket = [
    studyBand,
    growthBand,
    completionBand,
    volatilityBand,
    routineBand,
    continuityBand,
  ].join('|');
  const baseIndex = hashSeed(`${studentId}:${dateKey}:${stateBucket}`) % VARIATION_STYLE_BY_INDEX.length;
  const candidateKeys = VARIATION_STYLE_BY_INDEX.map(
    (_, index) => `${pedagogyLens}:${stateBucket}:v${index + 1}`
  );
  const recentSet = new Set(recentVariationKeys);
  const preferredIndex =
    preferredVariationKey && candidateKeys.includes(preferredVariationKey)
      ? candidateKeys.indexOf(preferredVariationKey)
      : -1;
  const variationIndex =
    preferredIndex >= 0
      ? preferredIndex
      : candidateKeys.findIndex((_, index) => {
            const targetIndex = (baseIndex + index) % candidateKeys.length;
            return !recentSet.has(candidateKeys[targetIndex]);
          }) >= 0
        ? (() => {
            for (let offset = 0; offset < candidateKeys.length; offset += 1) {
              const nextIndex = (baseIndex + offset) % candidateKeys.length;
              if (!recentSet.has(candidateKeys[nextIndex])) {
                return nextIndex;
              }
            }
            return baseIndex;
          })()
        : baseIndex;
  const variationKey = candidateKeys[variationIndex];
  const variationStyle = VARIATION_STYLE_BY_INDEX[variationIndex];
  const variationGuide = buildVariationGuide(variationStyle);

  return {
    attendanceLabel: resolveAttendanceLabel({
      attendanceDisplayStatus,
      currentSeatStatus,
      isTodayTarget,
      hasAttendanceEvidence,
    }),
    studyBand,
    growthBand,
    completionBand,
    volatilityBand,
    routineBand,
    continuityBand,
    pedagogyLens,
    secondaryLens,
    stateBucket,
    variationKey,
    variationStyle,
    variationGuide,
    coachingFocus: selectCoachingFocus(pedagogyLens, routineBand, volatilityBand, continuityBand),
    homeTip: selectHomeTip(pedagogyLens, routineBand, continuityBand),
    metrics: {
      growthRate,
      deltaMinutesFromAvg,
      avg7StudyMinutes,
      isNewRecord,
      alertLow,
      streakBadge,
      trendSummary: buildTrendSummary(growthBand, volatilityBand, avg7StudyMinutes, safeMinutes),
    },
  };
}
