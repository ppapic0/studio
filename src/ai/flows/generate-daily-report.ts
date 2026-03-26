'use server';
/**
 * @fileOverview 학생 학습 데이터를 분석해 학부모 발송용 데일리 리포트를 생성합니다.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

import {
  formatDailyReportStudyTime,
  resolveDailyReportLevel,
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
  variationKey: z.string().describe('이번 생성 variant 식별자'),
  variationStyle: VariationStyleSchema.describe('문체 변주 스타일'),
  variationGuide: z.string().describe('문체 변주 지침'),
  coachingFocus: z.string().describe('내일 코칭 핵심 포인트'),
  homeTip: z.string().describe('가정 연계 팁'),
  metrics: DailyReportMetricsSchema,
});

export type DailyReportInput = z.infer<typeof DailyReportInputSchema>;

const DailyReportDraftSchema = z.object({
  observation: z.string().describe('오늘 관찰 블록용 1~2문장'),
  interpretation: z.string().describe('교육학적 해석 블록용 1~2문장'),
  coaching: z.string().describe('내일 코칭 블록용 1~2문장'),
  homeConnection: z.string().describe('가정 연계 팁 블록용 1문장'),
  teacherOneLiner: z.string().describe('선생님 한 줄 코칭'),
  strengths: z.array(z.string()).describe('오늘 잘한 점'),
  improvements: z.array(z.string()).describe('보완할 점'),
});

const DailyReportOutputSchema = z.object({
  level: z.number().min(1).max(10).describe('10단계 시스템 기준 단계'),
  levelName: z.string().describe('단계명'),
  content: z.string().describe('발송용 리포트 본문'),
  teacherOneLiner: z.string().describe('선생님 한 줄 코칭'),
  strengths: z.array(z.string()).describe('오늘 잘한 점'),
  improvements: z.array(z.string()).describe('보완할 점'),
  pedagogyLens: PedagogyLensSchema.describe('주 교육 렌즈'),
  secondaryLens: PedagogyLensSchema.describe('보조 교육 렌즈'),
  stateBucket: z.string().describe('6축 분기 요약 키'),
  variationKey: z.string().describe('이번 생성 variant 식별자'),
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

function formatSignedMinutes(value: number) {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? '+' : ''}${rounded}분`;
}

function formatSignedPercent(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded >= 0 ? '+' : ''}${rounded}%`;
}

function sanitizeShortList(items: string[] | undefined, fallback: string[]) {
  const normalized = (items || [])
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item))
    .slice(0, 3);
  return normalized.length > 0 ? normalized : fallback;
}

function ensureSentence(text: string, fallback: string) {
  const normalized = text?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function buildStrengthFallback(input: DailyReportInput) {
  const strengths: string[] = [];

  if (input.growthBand === '상승' || input.growthBand === '급상승') {
    strengths.push(`최근 7일 평균 대비 학습시간이 ${formatSignedPercent(input.metrics.growthRate)} 개선되었습니다.`);
  }
  if (input.completionBand === '양호' || input.completionBand === '높음') {
    strengths.push(`계획 완료율 ${Math.round(input.completionRate)}%로 마무리 실행력이 안정적이었습니다.`);
  }
  if (input.metrics.isNewRecord) {
    strengths.push('최근 7일 기준 최고 학습시간을 갱신했습니다.');
  }
  if (input.routineBand === '정상') {
    strengths.push('등원 흐름이 안정적이라 학습 시작 리듬을 크게 잃지 않았습니다.');
  }
  if (input.continuityBand === '연속호조') {
    strengths.push('최근 며칠간 학습 페이스가 연속적으로 좋아지고 있습니다.');
  }

  return strengths.slice(0, 3);
}

function buildImprovementFallback(input: DailyReportInput) {
  const improvements: string[] = [];

  if (input.routineBand === '지각') {
    improvements.push('등원 직후 첫 과제 착수 시간을 더 일정하게 맞추는 관리가 필요합니다.');
  }
  if (input.routineBand === '루틴누락') {
    improvements.push('학습량과 별개로 생활 루틴 기록을 함께 남겨 자기조절 단서를 확보할 필요가 있습니다.');
  }
  if (input.routineBand === '미입실' || input.routineBand === '퇴실불안정') {
    improvements.push('출결 흐름이 흔들려 학습시간 대비 실제 리듬 안정성이 낮게 보입니다.');
  }
  if (input.completionBand === '낮음' || input.completionBand === '보통') {
    improvements.push('계획 완료율을 높이기 위해 과제 수를 줄이거나 우선순위를 더 분명히 잡아야 합니다.');
  }
  if (input.volatilityBand !== '안정') {
    improvements.push('좋은 날과 흔들리는 날의 편차를 줄이는 루틴 고정이 필요합니다.');
  }
  if (input.growthBand === '하락' || input.growthBand === '급하락') {
    improvements.push('최근 학습량이 내려오는 흐름이라 회복 가능한 작은 성공 구간을 다시 만들어야 합니다.');
  }

  return improvements.slice(0, 3);
}

function buildFallbackObservation(input: DailyReportInput) {
  const toneLead: Record<DailyReportInput['variationStyle'], string> = {
    '차분한 관찰형': `${input.studentName} 학생은 오늘 수치상으로 비교적 분명한 흐름을 보였습니다.`,
    '격려형': `${input.studentName} 학생은 오늘도 자신의 리듬 안에서 의미 있는 학습 흔적을 남겼습니다.`,
    '전략 코칭형': `${input.studentName} 학생의 오늘 기록은 내일의 운영 포인트를 비교적 선명하게 보여줍니다.`,
    '균형 피드백형': `${input.studentName} 학생은 오늘 성과와 과제가 함께 드러나는 하루를 보냈습니다.`,
    '가정 대화형': `${input.studentName} 학생의 오늘 데이터는 가정과 교실이 같은 방향으로 도와줄 힌트를 담고 있습니다.`,
    '회복 지원형': `${input.studentName} 학생은 오늘의 기록 안에서도 다시 회복할 수 있는 단서를 남겼습니다.`,
  };

  return [
    toneLead[input.variationStyle],
    `총 학습시간은 ${formatDailyReportStudyTime(input.totalStudyMinutes)}, 계획 완료율은 ${Math.round(input.completionRate)}%였고 최근 7일 평균 대비 ${formatSignedMinutes(input.metrics.deltaMinutesFromAvg)}(${formatSignedPercent(input.metrics.growthRate)}) 변화했습니다.`,
    `출결 흐름은 ${input.attendanceLabel}로 정리되며, 현재 학습 구간은 ${input.studyBand}/${input.completionBand} 범주에 가깝습니다.`,
  ].join(' ');
}

function buildFallbackInterpretation(input: DailyReportInput) {
  const lensInterpretation: Record<DailyReportInput['pedagogyLens'], string> = {
    '습관 형성': '오늘 결과는 절대량 자체보다 시작 시점과 루틴 고정이 성과를 좌우하는 전형적인 습관 형성 구간으로 해석됩니다.',
    '자기조절': '오늘 결과는 계획-실행-점검의 자기조절 루프가 어느 정도 작동하지만 마감 밀도를 더 높일 여지가 있는 상태로 보입니다.',
    '집중 회복': '오늘 결과는 학습 의지보다 집중 리듬 회복과 과제 난이도 조절이 먼저 필요한 구간으로 읽힙니다.',
    '성장 가속': '오늘 결과는 기본 루틴이 받쳐진 상태에서 더 높은 난이도와 정교한 피드백이 성장을 가속할 수 있는 구간으로 보입니다.',
  };

  const continuityText =
    input.continuityBand === '연속호조'
      ? '최근 며칠의 상승 흐름이 이어지고 있어 좋은 패턴을 고정하는 것이 중요합니다.'
      : input.continuityBand === '연속저하'
        ? '최근 며칠의 저하 흐름이 누적되고 있어 빠른 회복 루틴이 필요합니다.'
        : input.continuityBand === '회복중'
          ? '이전의 저하 흐름에서 회복 신호가 보여 작은 성공 경험을 이어가는 것이 중요합니다.'
          : '최근 흐름은 크게 무너지지 않았지만 한 단계 더 끌어올릴 운영 포인트가 남아 있습니다.';

  return `${lensInterpretation[input.pedagogyLens]} 보조 렌즈는 ${input.secondaryLens}이며, ${continuityText}`;
}

function buildFallbackCoaching(input: DailyReportInput) {
  const actionTone: Record<DailyReportInput['variationStyle'], string> = {
    '차분한 관찰형': '내일은 운영 포인트를 과하게 늘리지 않고 한 가지 행동부터 고정하면 좋겠습니다.',
    '격려형': '내일은 부담을 키우기보다 성공 가능성이 높은 행동부터 다시 이어가면 좋겠습니다.',
    '전략 코칭형': '내일은 바로 실행 가능한 행동으로 좁혀서 교실에서 관리하겠습니다.',
    '균형 피드백형': '내일은 강점은 유지하고 약한 지점만 짧게 보정하는 방향이 적절합니다.',
    '가정 대화형': '내일은 교실 코칭과 가정 대화가 같은 메시지를 쓰는 것이 도움이 됩니다.',
    '회복 지원형': '내일은 평가보다 회복 경험을 쌓는 행동 하나를 먼저 성공시키는 것이 중요합니다.',
  };

  return `${actionTone[input.variationStyle]} 핵심 코칭 포인트는 ${input.coachingFocus}입니다.`;
}

function buildFallbackHomeConnection(input: DailyReportInput) {
  return `가정에서는 ${input.homeTip}`;
}

function buildFallbackTeacherOneLiner(input: DailyReportInput) {
  return `${input.studentName} 학생은 오늘 ${formatDailyReportStudyTime(input.totalStudyMinutes)} 학습했고, 계획 완료율 ${Math.round(input.completionRate)}%, 최근 7일 평균 대비 ${formatSignedPercent(input.metrics.growthRate)} 흐름으로 ${input.pedagogyLens} 관점의 코칭이 필요한 상태입니다.`;
}

function composeReportContent(input: DailyReportInput, draft: z.infer<typeof DailyReportDraftSchema>) {
  const numericObservation = [
    `${input.studentName} 학생은 오늘 ${formatDailyReportStudyTime(input.totalStudyMinutes)} 학습했고 계획 완료율은 ${Math.round(input.completionRate)}%였습니다.`,
    `최근 7일 평균은 ${formatDailyReportStudyTime(input.metrics.avg7StudyMinutes)}이며 오늘은 ${formatSignedMinutes(input.metrics.deltaMinutesFromAvg)}(${formatSignedPercent(input.metrics.growthRate)}) 변화했습니다.`,
    `출결 흐름은 ${input.attendanceLabel}입니다.`,
  ].join(' ');

  return [
    '🕒 오늘 관찰',
    `${numericObservation} ${draft.observation}`.trim(),
    '',
    '📊 교육학적 해석',
    `주 렌즈는 ${input.pedagogyLens}, 보조 렌즈는 ${input.secondaryLens}입니다. ${draft.interpretation}`.trim(),
    '',
    '💬 내일 코칭',
    `교실 코칭 포인트는 ${input.coachingFocus}입니다. ${draft.coaching}`.trim(),
    '',
    '🧠 가정 연계 팁',
    `${draft.homeConnection}`.trim(),
  ].join('\n');
}

function buildDeterministicDailyReport(input: DailyReportInput): DailyReportOutput {
  const { level, levelName } = resolveDailyReportLevel(input.totalStudyMinutes, input.completionRate);
  const observation = buildFallbackObservation(input);
  const interpretation = buildFallbackInterpretation(input);
  const coaching = buildFallbackCoaching(input);
  const homeConnection = buildFallbackHomeConnection(input);
  const strengths = sanitizeShortList(buildStrengthFallback(input), [
    '오늘의 학습 흐름을 완전히 놓치지 않고 기본 학습량을 확보했습니다.',
    '계획과 실제 수행을 연결하려는 흔적이 남아 있었습니다.',
  ]);
  const improvements = sanitizeShortList(buildImprovementFallback(input), [
    '학습 리듬이 더 안정되도록 시작 루틴과 마감 점검을 함께 고정할 필요가 있습니다.',
    '과제 수와 난이도를 조금 더 현실적으로 조정하면 완료율이 좋아질 수 있습니다.',
  ]);
  const teacherOneLiner = buildFallbackTeacherOneLiner(input);

  return {
    level,
    levelName,
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
    variationKey: input.variationKey,
    variationStyle: input.variationStyle,
    coachingFocus: input.coachingFocus,
    homeTip: input.homeTip,
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
주어진 데이터를 바탕으로 학부모와 학생이 함께 읽어도 부담이 없고, 교사가 바로 다음 행동을 정할 수 있는 "교육코칭형 데일리 리포트" 초안을 작성하세요.

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
- 코칭 포인트: {{{coachingFocus}}}
- 가정 연계 팁 핵심: {{{homeTip}}}
- 문체 변주 스타일: {{{variationStyle}}}
- 문체 지침: {{{variationGuide}}}

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
3. observation, interpretation, coaching은 1~2문장으로, homeConnection은 1문장으로 작성하세요.
4. teacherOneLiner는 반드시 학습시간, 완료율 또는 최근 7일 대비 변화 중 최소 2개의 수치를 포함하세요.
5. strengths와 improvements는 각각 2~3개 짧은 항목으로 작성하세요.
6. 문체는 부드럽지만 실무적으로, 과장 칭찬 없이 관찰 -> 해석 -> 행동 흐름을 유지하세요.
7. 오늘 상태가 좋더라도 매일 같은 표현을 반복하지 말고, 제공된 문체 변주 스타일과 지침을 반영하세요.
8. 루틴누락/지각/미입실/퇴실불안정이면 반드시 생활리듬이나 시작 루틴 관점을 한 번 이상 포함하세요.
9. homeConnection은 압박형 지시 대신 질문형, 인정형, 관계형 피드백으로 작성하세요.
10. JSON만 반환하세요.`,
  config: {
    temperature: 0.6,
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    ],
  },
});

const dailyReportFlow = ai.defineFlow(
  {
    name: 'dailyReportFlow',
    inputSchema: DailyReportInputSchema,
    outputSchema: DailyReportOutputSchema,
  },
  async (input) => {
    const deterministic = buildDeterministicDailyReport(input);
    const { output } = await dailyReportPrompt(input);
    if (!output) {
      return deterministic;
    }

    const observation = ensureSentence(output.observation, buildFallbackObservation(input));
    const interpretation = ensureSentence(output.interpretation, buildFallbackInterpretation(input));
    const coaching = ensureSentence(output.coaching, buildFallbackCoaching(input));
    const homeConnection = ensureSentence(output.homeConnection, buildFallbackHomeConnection(input));
    const teacherOneLiner = ensureSentence(output.teacherOneLiner, deterministic.teacherOneLiner);
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
      homeTip: homeConnection.replace(/^가정에서는\s*/u, '').trim() || input.homeTip,
    };
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
