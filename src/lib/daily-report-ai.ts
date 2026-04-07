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

export interface DailyReportStageProfile {
  focus: string;
  coachingPoint: string;
  homePoint: string;
}

export interface DailyReportVariationPhraseIndexes {
  observation: number;
  interpretation: number;
  coaching: number;
  homeConnection: number;
}

export interface DailyReportVariationSelection {
  variationSignature: string;
  variationStyle: DailyReportVariationStyle;
  variationGuide: string;
  phraseIndexes: DailyReportVariationPhraseIndexes;
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
  internalStage: number;
  stageFocus: string;
  stageCoachingPoint: string;
  stageHomePoint: string;
  variationSignature: string;
  variationStyle: DailyReportVariationStyle;
  variationGuide: string;
  phraseIndexes: DailyReportVariationPhraseIndexes;
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
  generationAttempt?: number;
  excludedVariationSignatures?: string[];
  excludedContentFingerprints?: string[];
};

type SelectDailyReportVariationInput = {
  studentId: string;
  dateKey: string;
  stateBucket: string;
  pedagogyLens: PedagogyLens;
  internalStage: number;
  generationAttempt?: number;
  excludedVariationSignatures?: string[];
  excludedContentFingerprints?: string[];
};

const VARIATION_STYLE_BY_INDEX: DailyReportVariationStyle[] = [
  '차분한 관찰형',
  '격려형',
  '전략 코칭형',
  '균형 피드백형',
  '가정 대화형',
  '회복 지원형',
];

const SECTION_VARIANT_COUNT = 4;
const TOTAL_VARIATION_SIGNATURES =
  VARIATION_STYLE_BY_INDEX.length *
  SECTION_VARIANT_COUNT *
  SECTION_VARIANT_COUNT *
  SECTION_VARIANT_COUNT *
  SECTION_VARIANT_COUNT;

const INTERNAL_STAGE_PROFILES: Record<number, DailyReportStageProfile> = {
  1: {
    focus: '학습 시작 문턱을 낮추는 단계',
    coachingPoint: '첫 10분 안에 가장 쉬운 과제로 착수하도록 돕는 것',
    homePoint: '결과보다 시작 시도 자체를 먼저 인정해 주는 대화',
  },
  2: {
    focus: '짧은 집중 블록을 끊기지 않게 붙이는 단계',
    coachingPoint: '한 번 시작한 블록을 최소 20분까지 유지하게 만드는 것',
    homePoint: '오늘 시작한 시간과 끝낸 블록을 함께 확인하는 대화',
  },
  3: {
    focus: '하루 기본 학습량의 바닥을 만드는 단계',
    coachingPoint: '매일 같은 순서로 첫 과목을 여는 루틴을 고정하는 것',
    homePoint: '학습량 평가보다 정해진 순서를 지킨 점을 짚어 주는 대화',
  },
  4: {
    focus: '등원 후 리듬을 빠르게 올리는 단계',
    coachingPoint: '등원 직후 지체 없이 첫 과제에 진입하게 관리하는 것',
    homePoint: '언제 시작했는지와 방해 요소가 무엇이었는지 가볍게 묻는 대화',
  },
  5: {
    focus: '기본 계획과 실제 실행을 맞추는 단계',
    coachingPoint: '작은 계획이라도 당일 안에 완료 체크까지 닫도록 만드는 것',
    homePoint: '계획한 것과 실제 한 것의 차이를 비난 없이 함께 보는 대화',
  },
  6: {
    focus: '과제 수를 현실적으로 조절하는 단계',
    coachingPoint: '욕심내기보다 끝낼 수 있는 양으로 재배치하는 것',
    homePoint: '많이 했는지보다 끝낸 경험이 있었는지 물어보는 대화',
  },
  7: {
    focus: '자기조절 루프를 하루 안에 완성하는 단계',
    coachingPoint: '중간 점검과 마감 점검을 같은 날에 닫아 주는 것',
    homePoint: '오늘 잘 먹힌 전략 하나를 함께 찾아보는 대화',
  },
  8: {
    focus: '과목 전환 손실을 줄이는 단계',
    coachingPoint: '전환 전에 짧은 복기와 다음 목표 확인을 넣는 것',
    homePoint: '무슨 과목을 했는지보다 어떻게 전환했는지 묻는 대화',
  },
  9: {
    focus: '완료율을 안정적으로 유지하는 단계',
    coachingPoint: '마감 직전 무너지는 과제를 줄이고 우선순위를 선명히 하는 것',
    homePoint: '끝까지 마친 일 하나를 구체적으로 칭찬하는 대화',
  },
  10: {
    focus: '집중 지속 시간을 한 단계 늘리는 단계',
    coachingPoint: '핵심 과목의 첫 집중 블록 길이를 조금 더 늘리는 것',
    homePoint: '힘들었던 구간을 버틴 방식을 함께 언어화하는 대화',
  },
  11: {
    focus: '학습량과 정확도를 함께 관리하는 단계',
    coachingPoint: '많이 하는 흐름 속에서도 오답 복기를 놓치지 않게 하는 것',
    homePoint: '많이 한 것과 남긴 실수를 같이 균형 있게 보는 대화',
  },
  12: {
    focus: '좋은 날의 패턴을 복제하는 단계',
    coachingPoint: '집중이 잘 된 시간대와 과제 구성을 다시 재현하는 것',
    homePoint: '오늘 잘된 이유를 함께 찾아 다음에도 반복하게 돕는 대화',
  },
  13: {
    focus: '학습 흐름의 편차를 줄이는 단계',
    coachingPoint: '좋은 날과 흔들리는 날의 차이를 줄이는 루틴을 고정하는 것',
    homePoint: '기복이 생긴 원인을 감정이 아닌 상황으로 돌아보는 대화',
  },
  14: {
    focus: '고난도 과제 진입을 안정화하는 단계',
    coachingPoint: '가장 어려운 과제를 집중력이 높은 초반에 배치하는 것',
    homePoint: '어려운 과제를 피하지 않은 점을 인정해 주는 대화',
  },
  15: {
    focus: '상위권 루틴의 밀도를 높이는 단계',
    coachingPoint: '핵심 과목에서 밀도 높은 블록을 반복적으로 확보하는 것',
    homePoint: '성과만이 아니라 유지한 루틴의 질을 칭찬하는 대화',
  },
  16: {
    focus: '성과를 재현 가능한 습관으로 고정하는 단계',
    coachingPoint: '잘된 하루를 우연으로 넘기지 않고 반복 규칙으로 만드는 것',
    homePoint: '잘된 이유를 운이 아닌 습관으로 연결해 주는 대화',
  },
  17: {
    focus: '고효율 루틴을 장기 지속 가능한 형태로 다듬는 단계',
    coachingPoint: '무리한 몰입보다 유지 가능한 고효율 패턴으로 정리하는 것',
    homePoint: '많이 했다는 평가보다 지속 가능성을 함께 점검하는 대화',
  },
  18: {
    focus: '고난도 수행 후 복기 품질을 끌어올리는 단계',
    coachingPoint: '문제풀이 뒤 즉시 오답과 복기를 연결하는 것',
    homePoint: '잘한 점 뒤에 다음 보완 한 가지를 차분히 나누는 대화',
  },
  19: {
    focus: '최상위권 페이스를 흔들림 없이 유지하는 단계',
    coachingPoint: '좋은 흐름 속에서도 루틴 이탈 신호를 빠르게 잡아내는 것',
    homePoint: '결과 압박보다 현재의 좋은 패턴을 유지하도록 응원하는 대화',
  },
  20: {
    focus: '완성된 루틴을 미세 조정하는 단계',
    coachingPoint: '높은 학습량 속에서도 피로 관리와 정교한 보완을 병행하는 것',
    homePoint: '높은 기준을 요구하기보다 지금의 완성도를 안정적으로 지키게 돕는 대화',
  },
};

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

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

function decodeVariationIndex(variationIndex: number) {
  const safeIndex = Math.abs(variationIndex) % TOTAL_VARIATION_SIGNATURES;
  const styleIndex = safeIndex % VARIATION_STYLE_BY_INDEX.length;
  const observationIndex =
    Math.floor(safeIndex / VARIATION_STYLE_BY_INDEX.length) % SECTION_VARIANT_COUNT;
  const interpretationIndex =
    Math.floor(safeIndex / (VARIATION_STYLE_BY_INDEX.length * SECTION_VARIANT_COUNT)) % SECTION_VARIANT_COUNT;
  const coachingIndex =
    Math.floor(
      safeIndex /
        (VARIATION_STYLE_BY_INDEX.length * SECTION_VARIANT_COUNT * SECTION_VARIANT_COUNT)
    ) % SECTION_VARIANT_COUNT;
  const homeConnectionIndex =
    Math.floor(
      safeIndex /
        (VARIATION_STYLE_BY_INDEX.length *
          SECTION_VARIANT_COUNT *
          SECTION_VARIANT_COUNT *
          SECTION_VARIANT_COUNT)
    ) % SECTION_VARIANT_COUNT;

  return {
    variationStyle: VARIATION_STYLE_BY_INDEX[styleIndex],
    phraseIndexes: {
      observation: observationIndex,
      interpretation: interpretationIndex,
      coaching: coachingIndex,
      homeConnection: homeConnectionIndex,
    } satisfies DailyReportVariationPhraseIndexes,
  };
}

function buildVariationSignature(params: {
  internalStage: number;
  pedagogyLens: PedagogyLens;
  variationStyle: DailyReportVariationStyle;
  phraseIndexes: DailyReportVariationPhraseIndexes;
}) {
  const { internalStage, pedagogyLens, variationStyle, phraseIndexes } = params;
  return [
    `${internalStage}`,
    pedagogyLens,
    variationStyle,
    `o${phraseIndexes.observation + 1}`,
    `i${phraseIndexes.interpretation + 1}`,
    `c${phraseIndexes.coaching + 1}`,
    `h${phraseIndexes.homeConnection + 1}`,
  ].join(':');
}

export function parseDailyReportVariationSignature(
  signature: string | null | undefined
): DailyReportVariationSelection | null {
  if (!signature) return null;
  const [stageText, pedagogyLens, variationStyle, observation, interpretation, coaching, homeConnection] =
    signature.split(':');

  const internalStage = Number(stageText);
  if (!Number.isFinite(internalStage)) return null;
  if (!pedagogyLens || !variationStyle) return null;
  if (!VARIATION_STYLE_BY_INDEX.includes(variationStyle as DailyReportVariationStyle)) return null;

  const phraseIndexes = {
    observation: clampNumber(Number(observation?.replace(/^o/u, '')) - 1, 0, SECTION_VARIANT_COUNT - 1),
    interpretation: clampNumber(Number(interpretation?.replace(/^i/u, '')) - 1, 0, SECTION_VARIANT_COUNT - 1),
    coaching: clampNumber(Number(coaching?.replace(/^c/u, '')) - 1, 0, SECTION_VARIANT_COUNT - 1),
    homeConnection: clampNumber(Number(homeConnection?.replace(/^h/u, '')) - 1, 0, SECTION_VARIANT_COUNT - 1),
  };

  return {
    variationSignature: buildVariationSignature({
      internalStage,
      pedagogyLens: pedagogyLens as PedagogyLens,
      variationStyle: variationStyle as DailyReportVariationStyle,
      phraseIndexes,
    }),
    variationStyle: variationStyle as DailyReportVariationStyle,
    variationGuide: buildVariationGuide(variationStyle as DailyReportVariationStyle, phraseIndexes),
    phraseIndexes,
  };
}

function buildVariationGuide(
  variationStyle: DailyReportVariationStyle,
  phraseIndexes: DailyReportVariationPhraseIndexes
) {
  const styleGuide =
    variationStyle === '차분한 관찰형'
      ? '차분하고 객관적인 관찰형 문장으로 쓰고, 과장된 감탄 표현은 피합니다.'
      : variationStyle === '격려형'
        ? '학생의 자존감을 지키는 따뜻한 격려형 문체를 사용하되, 수치 근거는 분명히 남깁니다.'
        : variationStyle === '전략 코칭형'
          ? '행동 제안을 구체적으로 쓰고, 내일 바로 실행할 수 있는 전략형 문장으로 씁니다.'
          : variationStyle === '균형 피드백형'
            ? '성과와 과제를 균형 있게 다루고, 칭찬과 보완을 5:5 정도로 배치합니다.'
            : variationStyle === '가정 대화형'
              ? '가정에서 어떻게 말을 건네면 좋을지 자연스럽게 연결되는 관계형 문체로 씁니다.'
              : '부담을 낮추는 회복 지원형 문체로 쓰고, 실패 평가보다 회복 경로를 강조합니다.';

  const observationGuide = [
    '관찰 문장은 수치와 리듬을 먼저 보여 주세요.',
    '관찰 문장은 오늘의 변화를 비교형으로 풀어 주세요.',
    '관찰 문장은 행동 단서와 수치를 함께 엮어 주세요.',
    '관찰 문장은 출결 흐름까지 붙여 장면감 있게 써 주세요.',
  ][phraseIndexes.observation];
  const interpretationGuide = [
    '해석 문장은 습관과 자기조절 관점에서 풀어 주세요.',
    '해석 문장은 최근 연속 흐름을 강조해 주세요.',
    '해석 문장은 성과와 과제를 균형 있게 다뤄 주세요.',
    '해석 문장은 다음 코칭으로 자연스럽게 이어지게 해 주세요.',
  ][phraseIndexes.interpretation];
  const coachingGuide = [
    '코칭 문장은 내일 바로 실행할 한 가지 행동을 선명하게 적어 주세요.',
    '코칭 문장은 시작 루틴 또는 마감 루틴을 구체화해 주세요.',
    '코칭 문장은 과목 배치나 집중 블록 운영을 짚어 주세요.',
    '코칭 문장은 부담을 낮춘 실행형 문장으로 정리해 주세요.',
  ][phraseIndexes.coaching];
  const homeGuide = [
    '가정 팁은 인정형 질문으로 마무리해 주세요.',
    '가정 팁은 비교나 압박 없이 관계형 대화로 써 주세요.',
    '가정 팁은 시작 시간 또는 회복 포인트를 물어보게 해 주세요.',
    '가정 팁은 다음 행동을 짧게 함께 정리하도록 이끌어 주세요.',
  ][phraseIndexes.homeConnection];

  return `${styleGuide} ${observationGuide} ${interpretationGuide} ${coachingGuide} ${homeGuide}`;
}

export function resolveDailyReportLevel(totalStudyMinutes: number, completionRate: number) {
  const minutes = clampMinutes(totalStudyMinutes);
  const safeCompletionRate = clampNumber(Math.round(completionRate), 0, 100);
  const studyStage = clampNumber(Math.ceil(minutes / 30), 1, 20);
  const completionStage = clampNumber(Math.ceil(safeCompletionRate / 5), 1, 20);
  const internalStage = Math.min(studyStage, completionStage);

  return {
    studyStage,
    completionStage,
    internalStage,
    stageProfile: INTERNAL_STAGE_PROFILES[internalStage] ?? INTERNAL_STAGE_PROFILES[1],
  };
}

export function getDailyReportStageProfile(internalStage: number) {
  const safeStage = clampNumber(Math.round(internalStage), 1, 20);
  return INTERNAL_STAGE_PROFILES[safeStage] ?? INTERNAL_STAGE_PROFILES[1];
}

export function formatDailyReportStudyTime(totalMinutes: number) {
  const minutes = clampMinutes(totalMinutes);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

export function normalizeDailyReportContentFingerprint(content: string) {
  return (content || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\d+/g, '')
    .replace(/[^\p{L}]+/gu, '');
}

export function isDailyReportFingerprintBlocked(candidateContent: string, blockedFingerprints: string[]) {
  const fingerprint = normalizeDailyReportContentFingerprint(candidateContent);
  if (!fingerprint) return false;
  return blockedFingerprints.includes(fingerprint);
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
  if (isTodayTarget && currentSeatStatus === 'absent' && hasAttendanceEvidence) {
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
  if (isTodayTarget && currentSeatStatus === 'absent' && hasAttendanceEvidence) {
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
    secondaryLens =
      routineBand !== '정상'
        ? '습관 형성'
        : continuityBand === '연속호조'
          ? '성장 가속'
          : '집중 회복';
  }

  return { pedagogyLens, secondaryLens };
}

function selectCoachingFocus(
  mainLens: PedagogyLens,
  routineBand: RoutineBand,
  volatilityBand: VolatilityBand,
  continuityBand: ContinuityBand,
  stageProfile: DailyReportStageProfile
) {
  if (mainLens === '습관 형성') {
    if (routineBand !== '정상') {
      return `${stageProfile.coachingPoint}, 등원 직후 30분 안에 첫 과목을 시작하게 돕기`;
    }
    return `${stageProfile.coachingPoint}, 첫 과제 시작 시간과 완료 체크를 같은 날에 닫기`;
  }
  if (mainLens === '집중 회복') {
    if (continuityBand === '연속저하') {
      return `${stageProfile.coachingPoint}, 첫 60분 단일 과목 집중 블록으로 흐름을 회복하기`;
    }
    return `${stageProfile.coachingPoint}, 오늘보다 한 단계 쉬운 목표로 성공 경험을 먼저 만들기`;
  }
  if (mainLens === '성장 가속') {
    return `${stageProfile.coachingPoint}, 고난도 과제를 초반 집중 시간에 배치하고 짧은 복기를 바로 연결하기`;
  }
  if (volatilityBand !== '안정') {
    return `${stageProfile.coachingPoint}, 과목 전환 전에 완료 체크와 10분 복기를 넣기`;
  }
  return `${stageProfile.coachingPoint}, 계획-실행-점검 루프를 하루 안에 닫기`;
}

function selectHomeTip(
  mainLens: PedagogyLens,
  routineBand: RoutineBand,
  continuityBand: ContinuityBand,
  stageProfile: DailyReportStageProfile
) {
  if (mainLens === '습관 형성') {
    return routineBand !== '정상'
      ? `${stageProfile.homePoint}를 중심으로, 오늘 몇 시에 다시 흐름을 잡았는지 짧게 물어봐 주세요.`
      : `${stageProfile.homePoint}를 중심으로, 학습량 평가보다 시작 시간을 지킨 점을 먼저 인정해 주세요.`;
  }
  if (mainLens === '집중 회복') {
    return continuityBand === '연속저하'
      ? `${stageProfile.homePoint}를 중심으로, 비교나 질책보다 오늘 회복된 한 지점을 먼저 짚어 주세요.`
      : `${stageProfile.homePoint}를 중심으로, 왜 못했는지보다 다시 붙잡은 구간을 물어봐 주세요.`;
  }
  if (mainLens === '성장 가속') {
    return `${stageProfile.homePoint}를 중심으로, 칭찬 뒤에 다음 도전 목표를 한 문장으로 함께 정리해 주세요.`;
  }
  return `${stageProfile.homePoint}를 중심으로, 공부량보다 어떤 전략이 잘 먹혔는지 질문해 주세요.`;
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

export function selectDailyReportVariation({
  studentId,
  dateKey,
  stateBucket,
  pedagogyLens,
  internalStage,
  generationAttempt = 1,
  excludedVariationSignatures = [],
  excludedContentFingerprints = [],
}: SelectDailyReportVariationInput): DailyReportVariationSelection {
  const safeInternalStage = clampNumber(Math.round(internalStage), 1, 20);
  const safeAttempt = Math.max(1, Math.round(generationAttempt));
  const excludedSet = new Set(excludedVariationSignatures.filter(Boolean));
  const contentSalt =
    excludedContentFingerprints.length > 0
      ? hashSeed(excludedContentFingerprints.join('|')) % TOTAL_VARIATION_SIGNATURES
      : 0;
  const baseIndex =
    (
      hashSeed(`${studentId}:${dateKey}:${stateBucket}:${pedagogyLens}:${safeInternalStage}`) +
      contentSalt +
      (safeAttempt - 1) * 131
    ) %
    TOTAL_VARIATION_SIGNATURES;

  for (let offset = 0; offset < TOTAL_VARIATION_SIGNATURES; offset += 1) {
    const decoded = decodeVariationIndex((baseIndex + offset) % TOTAL_VARIATION_SIGNATURES);
    const variationSignature = buildVariationSignature({
      internalStage: safeInternalStage,
      pedagogyLens,
      variationStyle: decoded.variationStyle,
      phraseIndexes: decoded.phraseIndexes,
    });
    if (!excludedSet.has(variationSignature)) {
      return {
        variationSignature,
        variationStyle: decoded.variationStyle,
        variationGuide: buildVariationGuide(decoded.variationStyle, decoded.phraseIndexes),
        phraseIndexes: decoded.phraseIndexes,
      };
    }
  }

  const fallback = decodeVariationIndex(baseIndex);
  return {
    variationSignature: buildVariationSignature({
      internalStage: safeInternalStage,
      pedagogyLens,
      variationStyle: fallback.variationStyle,
      phraseIndexes: fallback.phraseIndexes,
    }),
    variationStyle: fallback.variationStyle,
    variationGuide: buildVariationGuide(fallback.variationStyle, fallback.phraseIndexes),
    phraseIndexes: fallback.phraseIndexes,
  };
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
  generationAttempt = 1,
  excludedVariationSignatures = [],
  excludedContentFingerprints = [],
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
  const { internalStage, stageProfile } = resolveDailyReportLevel(safeMinutes, safeCompletionRate);

  const stateBucket = [
    studyBand,
    growthBand,
    completionBand,
    volatilityBand,
    routineBand,
    continuityBand,
  ].join('|');
  const variation = selectDailyReportVariation({
    studentId,
    dateKey,
    stateBucket,
    pedagogyLens,
    internalStage,
    generationAttempt,
    excludedVariationSignatures,
    excludedContentFingerprints,
  });

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
    internalStage,
    stageFocus: stageProfile.focus,
    stageCoachingPoint: stageProfile.coachingPoint,
    stageHomePoint: stageProfile.homePoint,
    variationSignature: variation.variationSignature,
    variationStyle: variation.variationStyle,
    variationGuide: variation.variationGuide,
    phraseIndexes: variation.phraseIndexes,
    coachingFocus: selectCoachingFocus(
      pedagogyLens,
      routineBand,
      volatilityBand,
      continuityBand,
      stageProfile
    ),
    homeTip: selectHomeTip(pedagogyLens, routineBand, continuityBand, stageProfile),
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
