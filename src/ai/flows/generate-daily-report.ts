'use server';
/**
 * @fileOverview 학생 학습 데이터를 분석해 학부모 발송용 데일리 리포트를 생성합니다.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

import {
  formatDailyReportStudyTime,
  isDailyReportFingerprintBlocked,
  normalizeDailyReportContentFingerprint,
  parseDailyReportVariationSignature,
  selectDailyReportVariation,
} from '@/lib/daily-report-ai';

const StudyBandSchema = z.enum(['저학습', '기준학습', '고학습', '고집중']);
const GrowthBandSchema = z.enum(['급하락', '하락', '유지', '상승', '급상승']);
const CompletionBandSchema = z.enum(['낮음', '보통', '양호', '높음']);
const VolatilityBandSchema = z.enum(['안정', '출렁임', '불안정']);
const RoutineBandSchema = z.enum(['정상', '지각', '루틴누락', '미입실', '퇴실불안정']);
const ContinuityBandSchema = z.enum(['회복중', '유지중', '연속호조', '연속저하']);
const PedagogyLensSchema = z.enum(['습관 형성', '자기조절', '집중 회복', '성장 가속']);
const VariationStyleSchema = z.enum([
  '차분한 관찰형',
  '격려형',
  '전략 코칭형',
  '균형 피드백형',
  '가정 대화형',
  '회복 지원형',
]);

const DailyReportMetricsSchema = z.object({
  growthRate: z.number().describe('최근 7일 평균 대비 증감률(%)'),
  deltaMinutesFromAvg: z.number().describe('최근 7일 평균 대비 증감 분'),
  avg7StudyMinutes: z.number().describe('최근 7일 평균 학습 분'),
  isNewRecord: z.boolean().describe('최근 7일 기준 최고 기록 갱신'),
  alertLow: z.boolean().describe('저학습 경고'),
  streakBadge: z.boolean().describe('연속 고집중 여부'),
  trendSummary: z.string().describe('그래프 변동 요약'),
});

const DailyReportInputSchema = z.object({
  studentId: z.string().describe('학생 ID'),
  studentName: z.string().describe('학생 이름'),
  date: z.string().describe('리포트 날짜 (YYYY-MM-DD)'),
  totalStudyMinutes: z.number().describe('오늘 총 학습 시간(분)'),
  completionRate: z.number().describe('오늘 계획 완료율(0-100)'),
  plans: z.array(z.object({
    title: z.string(),
    done: z.boolean(),
  })).describe('오늘 학습 계획 상세'),
  schedule: z.array(z.object({
    title: z.string(),
    time: z.string(),
  })).describe('생활 시간표(등원/학원 등)'),
  history7Days: z.array(z.object({
    date: z.string(),
    minutes: z.number(),
  })).describe('오늘 이전 최근 7일 학습 시간 기록'),
  teacherNote: z.string().optional().describe('선생님 직접 관찰 메모'),
  attendanceLabel: z.string().describe('오늘 출결 흐름 요약'),
  studyBand: StudyBandSchema.describe('학습량 구간'),
  growthBand: GrowthBandSchema.describe('성장률 구간'),
  completionBand: CompletionBandSchema.describe('완료율 구간'),
  volatilityBand: VolatilityBandSchema.describe('변동성 구간'),
  routineBand: RoutineBandSchema.describe('루틴/출결 구간'),
  continuityBand: ContinuityBandSchema.describe('연속성 구간'),
  pedagogyLens: PedagogyLensSchema.describe('주 교육 렌즈'),
  secondaryLens: PedagogyLensSchema.describe('보조 교육 렌즈'),
  stateBucket: z.string().describe('6축 상태 버킷 요약 키'),
  internalStage: z.number().min(1).max(20).describe('내부 20단계 성장 스테이지'),
  stageFocus: z.string().describe('현재 단계의 핵심 초점'),
  stageCoachingPoint: z.string().describe('현재 단계의 교실 코칭 포인트'),
  stageHomePoint: z.string().describe('현재 단계의 가정 대화 포인트'),
  generationAttempt: z.number().min(1).describe('같은 데이터에 대한 생성 시도 횟수'),
  variationSignature: z.string().describe('이번 생성 variation 시그니처'),
  variationStyle: VariationStyleSchema.describe('문체 변주 스타일'),
  variationGuide: z.string().describe('문체 변주 지침'),
  coachingFocus: z.string().describe('내일 코칭 핵심 포인트'),
  homeTip: z.string().describe('가정 연계 팁'),
  avoidExpressions: z.array(z.string()).default([]).describe('이번 생성에서 피해야 할 최근 표현'),
  excludedVariationSignatures: z.array(z.string()).default([]).describe('이미 사용된 variation 시그니처'),
  excludedContentFingerprints: z.array(z.string()).default([]).describe('중복 회피 대상 본문 fingerprint'),
  metrics: DailyReportMetricsSchema,
});

export type DailyReportInput = z.infer<typeof DailyReportInputSchema>;

const DailyReportDraftSchema = z.object({
  observation: z.string().describe('오늘 관찰 블록용 짧은 1문장'),
  interpretation: z.string().describe('교육학적 해석 블록용 짧은 1문장'),
  coaching: z.string().describe('내일 코칭 블록용 짧은 1문장'),
  homeConnection: z.string().describe('가정 연계 팁 블록용 짧은 1문장'),
  teacherOneLiner: z.string().describe('선생님 한 줄 코칭'),
  strengths: z.array(z.string()).describe('오늘 잘한 점'),
  improvements: z.array(z.string()).describe('보완할 점'),
});

const DailyReportOutputSchema = z.object({
  internalStage: z.number().min(1).max(20).describe('내부 20단계 성장 스테이지'),
  generationAttempt: z.number().min(1).describe('이번 생성 시도 횟수'),
  content: z.string().describe('발송용 리포트 본문'),
  teacherOneLiner: z.string().describe('선생님 한 줄 코칭'),
  strengths: z.array(z.string()).describe('오늘 잘한 점'),
  improvements: z.array(z.string()).describe('보완할 점'),
  pedagogyLens: PedagogyLensSchema.describe('주 교육 렌즈'),
  secondaryLens: PedagogyLensSchema.describe('보조 교육 렌즈'),
  stateBucket: z.string().describe('6축 분기 요약 키'),
  variationSignature: z.string().describe('이번 생성 variation 시그니처'),
  variationStyle: VariationStyleSchema.describe('문체 변주 스타일'),
  coachingFocus: z.string().describe('내일 코칭의 핵심 포인트'),
  homeTip: z.string().describe('가정 연계 팁'),
  studyBand: StudyBandSchema.describe('학습량 구간'),
  growthBand: GrowthBandSchema.describe('성장률 구간'),
  completionBand: CompletionBandSchema.describe('완료율 구간'),
  routineBand: RoutineBandSchema.describe('루틴/출결 구간'),
  volatilityBand: VolatilityBandSchema.describe('변동성 구간'),
  continuityBand: ContinuityBandSchema.describe('연속성 구간'),
  metrics: DailyReportMetricsSchema,
});

export type DailyReportOutput = z.infer<typeof DailyReportOutputSchema>;

type DailyReportDraft = z.infer<typeof DailyReportDraftSchema>;

function formatSignedMinutes(value: number) {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? '+' : ''}${rounded}분`;
}

function formatSignedPercent(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded >= 0 ? '+' : ''}${rounded}%`;
}

function normalizeWhitespace(text?: string | null) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function toCompactSentence(text?: string | null, maxLength = 84) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return '';

  const sentence = normalized
    .split(/(?<=[.!?])\s+|(?<=다\.)\s+|(?<=요\.)\s+/)
    .map((item) => item.trim())
    .filter(Boolean)[0] || normalized;

  return sentence.length > maxLength ? `${sentence.slice(0, maxLength - 1).trimEnd()}…` : sentence;
}

function sanitizeCompactLabel(text?: string | null, maxLength = 34) {
  return toCompactSentence(text, maxLength).replace(/[.!?]$/u, '').trim();
}

function sanitizeShortList(items: string[] | undefined, fallback: string[], maxLength = 34) {
  const normalized = (items || [])
    .map((item) => sanitizeCompactLabel(item, maxLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, 3);

  if (normalized.length > 0) return normalized;

  return fallback
    .map((item) => sanitizeCompactLabel(item, maxLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, 3);
}

function ensureCompactSentence(text: string | undefined | null, fallback: string, maxLength = 84) {
  return toCompactSentence(text, maxLength) || toCompactSentence(fallback, maxLength);
}

function uniqueStrings(items: Array<string | undefined | null>) {
  return Array.from(
    new Set(
      items
        .map((item) => item?.trim())
        .filter((item): item is string => Boolean(item))
    )
  );
}

function getPlanSnapshot(input: DailyReportInput) {
  const total = input.plans.length;
  const completed = input.plans.filter((plan) => plan.done).length;
  const firstPending = input.plans.find((plan) => !plan.done)?.title?.trim();
  const firstCompleted = input.plans.find((plan) => plan.done)?.title?.trim();

  return {
    total,
    completed,
    firstPending,
    firstCompleted,
  };
}

function getScheduleSnapshot(input: DailyReportInput) {
  const firstTimedSchedule = input.schedule.find((item) => item.time && item.time !== '-');
  return firstTimedSchedule
    ? `${firstTimedSchedule.title} ${firstTimedSchedule.time}`.trim()
    : null;
}

function resolvePhraseIndexes(input: DailyReportInput) {
  return parseDailyReportVariationSignature(input.variationSignature)?.phraseIndexes ?? {
    observation: 0,
    interpretation: 0,
    coaching: 0,
    homeConnection: 0,
  };
}

function buildStrengthFallback(input: DailyReportInput) {
  const strengths: string[] = [];

  if (input.growthBand === '상승' || input.growthBand === '급상승') {
    strengths.push(`평균보다 학습시간이 ${formatSignedPercent(input.metrics.growthRate)} 늘었습니다.`);
  }
  if (input.completionBand === '양호' || input.completionBand === '높음') {
    strengths.push(`완료율 ${Math.round(input.completionRate)}%로 마무리가 안정적이었습니다.`);
  }
  if (input.metrics.isNewRecord) {
    strengths.push('최근 최고 학습시간을 기록했습니다.');
  }
  if (input.routineBand === '정상') {
    strengths.push('시작 루틴이 안정적이었습니다.');
  }
  if (input.continuityBand === '연속호조') {
    strengths.push('좋은 흐름이 며칠째 이어졌습니다.');
  }
  if (input.internalStage >= 15) {
    strengths.push('자기관리 단서가 더 선명해졌습니다.');
  }

  return strengths.slice(0, 3);
}

function buildImprovementFallback(input: DailyReportInput) {
  const improvements: string[] = [];

  if (input.routineBand === '지각') {
    improvements.push('첫 과제 시작 시간을 더 고정해 주세요.');
  }
  if (input.routineBand === '루틴누락') {
    improvements.push('루틴 기록을 함께 남겨 주세요.');
  }
  if (input.routineBand === '미입실' || input.routineBand === '퇴실불안정') {
    improvements.push('출결 리듬부터 다시 안정화해 주세요.');
  }
  if (input.completionBand === '낮음' || input.completionBand === '보통') {
    improvements.push('과제 수를 줄여 완료율을 올려 주세요.');
  }
  if (input.volatilityBand !== '안정') {
    improvements.push('좋은 날과 흔들리는 날의 편차를 줄여야 합니다.');
  }
  if (input.growthBand === '하락' || input.growthBand === '급하락') {
    improvements.push('작은 성공으로 학습량 회복이 필요합니다.');
  }
  if (input.internalStage <= 4) {
    improvements.push('시작 문턱을 낮추는 루틴이 먼저입니다.');
  }

  return improvements.slice(0, 3);
}

const OBSERVATION_VARIANTS = [
  (input: DailyReportInput) =>
    `오늘은 ${input.stageFocus}이 먼저 보인 하루였습니다.`,
  (input: DailyReportInput) =>
    `학습시간 ${formatDailyReportStudyTime(input.totalStudyMinutes)}와 완료율 ${Math.round(input.completionRate)}%에서 ${input.stageFocus}이 드러났습니다.`,
  (input: DailyReportInput) =>
    `평균 대비 ${formatSignedMinutes(input.metrics.deltaMinutesFromAvg)} 변화보다 ${input.stageFocus} 관리가 더 중요했습니다.`,
  (input: DailyReportInput) =>
    `오늘 기록의 핵심은 ${input.stageFocus}입니다.`,
];

const INTERPRETATION_VARIANTS = [
  (input: DailyReportInput) =>
    `${input.pedagogyLens} 관점에서 ${input.stageFocus} 보정이 필요한 날입니다.`,
  (input: DailyReportInput) =>
    `오늘 데이터는 ${input.stageFocus}이 결과를 좌우한 흐름입니다.`,
  (input: DailyReportInput) =>
    `지금은 ${input.stageFocus}을 고정해야 다음 흐름이 살아납니다.`,
  (input: DailyReportInput) =>
    `${input.secondaryLens}까지 보면 ${input.stageFocus}이 다음 변화를 결정합니다.`,
];

const COACHING_VARIANTS = [
  (input: DailyReportInput) =>
    `내일은 ${input.stageCoachingPoint}부터 ${input.coachingFocus}으로 잇겠습니다.`,
  (input: DailyReportInput) =>
    `첫 코칭은 ${input.stageCoachingPoint}, 실행 목표는 ${input.coachingFocus}입니다.`,
  (input: DailyReportInput) =>
    `내일은 ${input.coachingFocus} 하나만 선명하게 잡겠습니다.`,
  (input: DailyReportInput) =>
    `${input.stageCoachingPoint}을 먼저 고정해 ${input.coachingFocus}까지 연결하겠습니다.`,
];

const HOME_CONNECTION_VARIANTS = [
  (input: DailyReportInput) =>
    `${input.stageHomePoint}을 중심으로 ${input.homeTip}`,
  (input: DailyReportInput) =>
    `집에서는 ${input.stageHomePoint}부터 짧게 확인해 주세요. ${input.homeTip}`,
  (input: DailyReportInput) =>
    `가정 대화는 ${input.stageHomePoint}에 맞춰 주세요. ${input.homeTip}`,
  (input: DailyReportInput) =>
    `${input.homeTip}`,
];

function buildFallbackObservation(input: DailyReportInput) {
  const toneLead: Record<DailyReportInput['variationStyle'], string> = {
    '차분한 관찰형': '오늘 흐름은 차분하게 읽혔습니다.',
    '격려형': '오늘도 이어진 학습 흔적이 분명했습니다.',
    '전략 코칭형': '내일 코칭 포인트가 선명했습니다.',
    '균형 피드백형': '강점과 과제가 함께 보였습니다.',
    '가정 대화형': '가정과 교실이 같은 방향을 잡기 좋은 날이었습니다.',
    '회복 지원형': '회복 단서가 남아 있었습니다.',
  };
  const phraseIndexes = resolvePhraseIndexes(input);
  const scheduleLead = getScheduleSnapshot(input);

  return [
    toneLead[input.variationStyle],
    OBSERVATION_VARIANTS[phraseIndexes.observation](input),
    scheduleLead ? `${scheduleLead} 일정 영향도 보였습니다.` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

function buildFallbackInterpretation(input: DailyReportInput) {
  const continuityText =
    input.continuityBand === '연속호조'
      ? '좋은 패턴을 그대로 고정하는 것이 중요합니다.'
      : input.continuityBand === '연속저하'
        ? '빠른 회복 루틴이 필요합니다.'
        : input.continuityBand === '회복중'
          ? '작은 성공 경험을 이어가는 것이 중요합니다.'
          : '한 단계 더 끌어올릴 운영 포인트가 남아 있습니다.';
  const phraseIndexes = resolvePhraseIndexes(input);

  return `${INTERPRETATION_VARIANTS[phraseIndexes.interpretation](input)} ${continuityText}`;
}

function buildFallbackCoaching(input: DailyReportInput) {
  const actionTone: Record<DailyReportInput['variationStyle'], string> = {
    '차분한 관찰형': '내일은 한 가지 행동만 먼저 고정하면 좋겠습니다.',
    '격려형': '내일은 성공 가능성이 높은 행동부터 다시 잇겠습니다.',
    '전략 코칭형': '내일은 바로 실행할 행동으로 좁히겠습니다.',
    '균형 피드백형': '내일은 강점은 유지하고 약한 지점만 짧게 보정하겠습니다.',
    '가정 대화형': '내일은 교실과 가정이 같은 메시지를 쓰면 좋겠습니다.',
    '회복 지원형': '내일은 회복 경험을 쌓는 행동 하나가 중요합니다.',
  };
  const phraseIndexes = resolvePhraseIndexes(input);
  const { firstPending, firstCompleted } = getPlanSnapshot(input);
  const planBridge = firstPending
    ? `'${firstPending}'를 첫 실행으로 당겨 시작 문턱을 낮추겠습니다.`
    : firstCompleted
      ? `오늘 해낸 '${firstCompleted}' 흐름을 첫 과제로 잇겠습니다.`
      : '첫 과제 시작 시점을 짧게 고정하겠습니다.';

  return `${actionTone[input.variationStyle]} ${COACHING_VARIANTS[phraseIndexes.coaching](input)} ${planBridge}`;
}

function buildFallbackHomeConnection(input: DailyReportInput) {
  const phraseIndexes = resolvePhraseIndexes(input);
  const { firstPending, firstCompleted } = getPlanSnapshot(input);
  const planBridge = firstPending
    ? `'${firstPending}'는 결과보다 시작 시간을 먼저 물어봐 주세요.`
    : firstCompleted
      ? `오늘 해낸 '${firstCompleted}'를 어떻게 다시 이어갈지 짧게 확인해 주세요.`
      : '오늘 가장 잘 풀렸던 순간을 먼저 인정해 주세요.';

  return `${HOME_CONNECTION_VARIANTS[phraseIndexes.homeConnection](input).trim()} ${planBridge}`.trim();
}

function buildFallbackTeacherOneLiner(input: DailyReportInput) {
  const variants = [
    `${input.studentName} 학생은 오늘 ${formatDailyReportStudyTime(input.totalStudyMinutes)}, 완료율 ${Math.round(input.completionRate)}%, 평균 대비 ${formatSignedMinutes(input.metrics.deltaMinutesFromAvg)} 흐름이었습니다.`,
    `${input.studentName} 학생은 오늘 ${formatDailyReportStudyTime(input.totalStudyMinutes)} 학습했고 완료율은 ${Math.round(input.completionRate)}%로, 최근 7일 대비 ${formatSignedPercent(input.metrics.growthRate)} 변화였습니다.`,
    `${input.studentName} 학생은 오늘 ${formatDailyReportStudyTime(input.totalStudyMinutes)}, 완료율 ${Math.round(input.completionRate)}%, 핵심 포인트는 ${input.stageFocus}입니다.`,
    `${input.studentName} 학생은 오늘 ${formatDailyReportStudyTime(input.totalStudyMinutes)}을 확보했고 평균 대비 ${formatSignedMinutes(input.metrics.deltaMinutesFromAvg)}, 완료율 ${Math.round(input.completionRate)}%를 기록했습니다.`,
  ];
  const phraseIndexes = resolvePhraseIndexes(input);
  return variants[phraseIndexes.observation];
}

function composeReportContent(input: DailyReportInput, draft: DailyReportDraft) {
  const compactCoachingFocus = sanitizeCompactLabel(input.coachingFocus, 46) || input.coachingFocus;
  const numericObservation = [
    `${input.studentName} 학생은 오늘 ${formatDailyReportStudyTime(input.totalStudyMinutes)}, 완료율 ${Math.round(input.completionRate)}%, 평균 대비 ${formatSignedMinutes(input.metrics.deltaMinutesFromAvg)} 흐름이었습니다.`,
    `출결은 ${input.attendanceLabel}입니다.`,
  ]
    .filter(Boolean)
    .join(' ');

  return [
    '🕒 오늘 관찰',
    `${numericObservation} ${draft.observation}`.trim(),
    '',
    '📊 교육학적 해석',
    `${input.pedagogyLens} 중심 해석입니다. ${draft.interpretation}`.trim(),
    '',
    '💬 내일 코칭',
    `내일 코칭은 ${compactCoachingFocus}입니다. ${draft.coaching}`.trim(),
    '',
    '🧠 가정 연계 팁',
    `${draft.homeConnection}`.trim(),
  ].join('\n');
}

function buildDeterministicDailyReport(input: DailyReportInput): DailyReportOutput {
  const observation = ensureCompactSentence(buildFallbackObservation(input), '오늘 흐름을 짧게 정리했습니다.', 82);
  const interpretation = ensureCompactSentence(buildFallbackInterpretation(input), '오늘 데이터를 바탕으로 핵심 해석을 정리했습니다.', 82);
  const coaching = ensureCompactSentence(buildFallbackCoaching(input), '내일 첫 행동을 짧고 선명하게 잡겠습니다.', 82);
  const homeConnection = ensureCompactSentence(buildFallbackHomeConnection(input), input.homeTip || '오늘 흐름을 짧고 편안하게 확인해 주세요.', 74);
  const strengths = sanitizeShortList(buildStrengthFallback(input), [
    '기본 학습량은 지켰습니다.',
    '계획을 끝까지 잇는 흔적이 있었습니다.',
  ]);
  const improvements = sanitizeShortList(buildImprovementFallback(input), [
    '시작 루틴을 더 고정해 주세요.',
    '과제 수를 조금 더 가볍게 조정해 주세요.',
  ]);
  const teacherOneLiner = ensureCompactSentence(
    buildFallbackTeacherOneLiner(input),
    `${input.studentName} 학생은 오늘 ${formatDailyReportStudyTime(input.totalStudyMinutes)}, 완료율 ${Math.round(input.completionRate)}%였습니다.`,
    90
  );

  return {
    internalStage: input.internalStage,
    generationAttempt: input.generationAttempt,
    content: composeReportContent(input, {
      observation,
      interpretation,
      coaching,
      homeConnection,
      teacherOneLiner,
      strengths,
      improvements,
    }),
    teacherOneLiner,
    strengths,
    improvements,
    pedagogyLens: input.pedagogyLens,
    secondaryLens: input.secondaryLens,
    stateBucket: input.stateBucket,
    variationSignature: input.variationSignature,
    variationStyle: input.variationStyle,
    coachingFocus: sanitizeCompactLabel(input.coachingFocus, 46) || input.coachingFocus,
    homeTip: ensureCompactSentence(homeConnection, input.homeTip, 68),
    studyBand: input.studyBand,
    growthBand: input.growthBand,
    completionBand: input.completionBand,
    routineBand: input.routineBand,
    volatilityBand: input.volatilityBand,
    continuityBand: input.continuityBand,
    metrics: input.metrics,
  };
}

const dailyReportPrompt = ai.definePrompt({
  name: 'dailyReportPrompt',
  input: { schema: DailyReportInputSchema },
  output: { schema: DailyReportDraftSchema },
  prompt: `당신은 관리형 독서실의 수석 학습코치이자 교육공학 컨설턴트입니다.
주어진 데이터를 바탕으로 학생과 학부모가 한눈에 읽고, 교사가 바로 다음 행동을 정할 수 있는 "한눈형 교육코칭 데일리 리포트" 초안을 작성하세요.
문장은 짧고 압축적으로 쓰고, 모바일 화면에서도 부담 없이 읽히도록 만드세요.

### 학생 기본 정보
- 학생명: {{{studentName}}}
- 날짜: {{{date}}}
- 오늘 총 학습시간: {{{totalStudyMinutes}}}분
- 계획 완료율: {{{completionRate}}}%
- 최근 7일 평균 학습시간: {{{metrics.avg7StudyMinutes}}}분
- 최근 7일 평균 대비 증감: {{{metrics.deltaMinutesFromAvg}}}분 / {{{metrics.growthRate}}}%
- 출결 흐름: {{{attendanceLabel}}}

### 교육 판단 신호
- 학습량 구간: {{{studyBand}}}
- 성장률 구간: {{{growthBand}}}
- 완료율 구간: {{{completionBand}}}
- 변동성 구간: {{{volatilityBand}}}
- 루틴/출결 구간: {{{routineBand}}}
- 연속성 구간: {{{continuityBand}}}
- 주 교육 렌즈: {{{pedagogyLens}}}
- 보조 교육 렌즈: {{{secondaryLens}}}
- 내부 스테이지: {{{internalStage}}}
- 현재 단계 초점: {{{stageFocus}}}
- 단계별 교실 코칭 포인트: {{{stageCoachingPoint}}}
- 단계별 가정 대화 포인트: {{{stageHomePoint}}}
- 코칭 포인트: {{{coachingFocus}}}
- 가정 연계 팁 핵심: {{{homeTip}}}
- 문체 변주 스타일: {{{variationStyle}}}
- variation 시그니처: {{{variationSignature}}}
- 문체 지침: {{{variationGuide}}}

### 이번 생성에서 피해야 할 표현
{{#each avoidExpressions}}- {{{this}}}
{{/each}}

### 참고 데이터
- 오늘 계획 목록:
{{#each plans}}- {{{title}}} ({{#if done}}완료{{else}}미완료{{/if}})
{{/each}}
- 생활 루틴:
{{#each schedule}}- {{{title}}}: {{{time}}}
{{/each}}
- 최근 7일 학습시간 기록:
{{#each history7Days}}- {{{date}}}: {{{minutes}}}분
{{/each}}
- 선생님 메모: {{{teacherNote}}}

### 작성 규칙
1. 학생을 평가하거나 단정하지 말고, 관찰 가능한 학습행동과 루틴 관점으로 해석하세요.
2. "공부를 못했다" 같은 표현 대신 자기조절학습, 습관 형성, 집중 리듬, 과제 난이도-성취 균형 관점으로 설명하세요.
3. observation, interpretation, coaching, homeConnection은 각각 정확히 1문장으로 작성하세요.
4. teacherOneLiner는 정확히 1문장으로 쓰고, 학습시간/완료율/평균 대비 변화 중 최소 2개의 수치를 포함하세요.
5. strengths와 improvements는 각각 2개 이내의 짧은 항목으로 작성하고, 가능하면 명사구나 짧은 행동 구문으로 마무리하세요.
6. 문체는 부드럽지만 실무적으로, 과장 칭찬 없이 관찰 -> 해석 -> 행동 흐름을 유지하세요.
7. 전체 텍스트는 "길게 설명"보다 "짧게 판독"에 가깝게 쓰세요.
8. 오늘 상태가 좋더라도 매일 같은 표현을 반복하지 말고, 제공된 문체 변주 스타일과 지침을 반영하세요.
9. avoidExpressions에 담긴 표현과 문장 뼈대는 그대로 재사용하지 마세요.
10. 루틴누락/지각/미입실/퇴실불안정이면 반드시 생활리듬이나 시작 루틴 관점을 한 번 이상 포함하세요.
11. homeConnection은 압박형 지시 대신 질문형, 인정형, 관계형 피드백으로 작성하세요.
12. 내부 스테이지는 절대 학생/학부모에게 직접 드러내지 말고, 코칭 깊이를 조절하는 참고 정보로만 사용하세요.
13. 계획 목록이나 생활 루틴에 구체적인 단서가 있으면 observation, coaching, homeConnection 중 최소 한 곳에는 실제 과제/루틴 요소를 한 번 반영하세요.
14. homeConnection은 학부모가 오늘 바로 써볼 수 있는 자연스러운 말투로 작성하세요.
15. JSON만 반환하세요.`,
  config: {
    temperature: 0.8,
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    ],
  },
});

function buildOutputFromDraft(input: DailyReportInput, output: DailyReportDraft | null) {
  const deterministic = buildDeterministicDailyReport(input);
  if (!output) {
    return deterministic;
  }

  const observation = ensureCompactSentence(output.observation, buildFallbackObservation(input), 82);
  const interpretation = ensureCompactSentence(output.interpretation, buildFallbackInterpretation(input), 82);
  const coaching = ensureCompactSentence(output.coaching, buildFallbackCoaching(input), 82);
  const homeConnection = ensureCompactSentence(output.homeConnection, buildFallbackHomeConnection(input), 74);
  const teacherOneLiner = ensureCompactSentence(output.teacherOneLiner, deterministic.teacherOneLiner, 90);
  const strengths = sanitizeShortList(output.strengths, deterministic.strengths);
  const improvements = sanitizeShortList(output.improvements, deterministic.improvements);

  return {
    ...deterministic,
    content: composeReportContent(input, {
      observation,
      interpretation,
      coaching,
      homeConnection,
      teacherOneLiner,
      strengths,
      improvements,
    }),
    teacherOneLiner,
    strengths,
    improvements,
    coachingFocus: sanitizeCompactLabel(input.coachingFocus, 46) || input.coachingFocus,
    homeTip: ensureCompactSentence(
      homeConnection
        .replace(/^가정에서는\s*/u, '')
        .replace(/^집에서는\s*/u, '')
        .replace(/^오늘은 가정에서도\s*/u, '')
        .trim(),
      input.homeTip,
      68
    ),
  };
}

async function runPromptWithInput(input: DailyReportInput) {
  const { output } = await dailyReportPrompt(input);
  return buildOutputFromDraft(input, output ?? null);
}

function buildRetryInput(
  input: DailyReportInput,
  blockedVariationSignatures: string[],
  blockedFingerprints: string[]
) {
  const nextGenerationAttempt = Math.max(1, input.generationAttempt) + 1;
  const nextVariation = selectDailyReportVariation({
    studentId: input.studentId,
    dateKey: input.date,
    stateBucket: input.stateBucket,
    pedagogyLens: input.pedagogyLens,
    internalStage: input.internalStage,
    generationAttempt: nextGenerationAttempt,
    excludedVariationSignatures: blockedVariationSignatures,
    excludedContentFingerprints: blockedFingerprints,
  });

  return {
    ...input,
    generationAttempt: nextGenerationAttempt,
    variationSignature: nextVariation.variationSignature,
    variationStyle: nextVariation.variationStyle,
    variationGuide: nextVariation.variationGuide,
    excludedVariationSignatures: blockedVariationSignatures,
    excludedContentFingerprints: blockedFingerprints,
  } satisfies DailyReportInput;
}

const dailyReportFlow = ai.defineFlow(
  {
    name: 'dailyReportFlow',
    inputSchema: DailyReportInputSchema,
    outputSchema: DailyReportOutputSchema,
  },
  async (input) => {
    const initialBlockedFingerprints = uniqueStrings(input.excludedContentFingerprints);
    const initialBlockedSignatures = uniqueStrings(input.excludedVariationSignatures);

    const firstResult = await runPromptWithInput(input);
    const firstFingerprint = normalizeDailyReportContentFingerprint(firstResult.content);
    if (!isDailyReportFingerprintBlocked(firstResult.content, initialBlockedFingerprints)) {
      return firstResult;
    }

    const retryBlockedFingerprints = uniqueStrings([
      ...initialBlockedFingerprints,
      firstFingerprint,
    ]);
    const retryBlockedSignatures = uniqueStrings([
      ...initialBlockedSignatures,
      input.variationSignature,
    ]);
    const retryInput = buildRetryInput(input, retryBlockedSignatures, retryBlockedFingerprints);
    retryInput.avoidExpressions = uniqueStrings([
      ...input.avoidExpressions,
      firstResult.teacherOneLiner,
      ...firstResult.strengths,
      ...firstResult.improvements,
    ]).slice(0, 12);

    const retryResult = await runPromptWithInput(retryInput);
    if (!isDailyReportFingerprintBlocked(retryResult.content, retryBlockedFingerprints)) {
      return retryResult;
    }

    const fallbackBlockedFingerprints = uniqueStrings([
      ...retryBlockedFingerprints,
      normalizeDailyReportContentFingerprint(retryResult.content),
    ]);
    const fallbackBlockedSignatures = uniqueStrings([
      ...retryBlockedSignatures,
      retryInput.variationSignature,
    ]);
    const fallbackInput = buildRetryInput(retryInput, fallbackBlockedSignatures, fallbackBlockedFingerprints);
    return buildDeterministicDailyReport(fallbackInput);
  }
);

export async function generateDailyReport(input: DailyReportInput): Promise<DailyReportOutput> {
  try {
    return await dailyReportFlow(input);
  } catch (error) {
    console.error('[generateDailyReport] AI flow failed, using deterministic fallback', error);
    return buildDeterministicDailyReport(input);
  }
}
