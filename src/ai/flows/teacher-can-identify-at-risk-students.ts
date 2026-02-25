'use server';
/**
 * @fileOverview An AI agent that identifies students who are at risk of disengagement or underperformance.
 *
 * - identifyAtRiskStudents - A function that handles the risk detection process.
 * - IdentifyAtRiskStudentInput - The input type for the identifyAtRiskStudents function.
 * - IdentifyAtRiskStudentOutput - The return type for the identifyAtRiskStudents function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const IdentifyAtRiskStudentInputSchema = z.object({
  centerId: z.string().describe('스터디 센터의 ID.'),
  studentId: z.string().describe('평가할 학생의 ID.'),
  planCompletionRateLast2Weeks: z
    .number()
    .describe('지난 2주간의 계획 완수율 (0-100).'),
  absenceDaysLastPeriod: z
    .number()
    .describe('최근 기간(예: 지난 30일) 동안의 결석 일수.'),
  studyTimeGrowthRate: z
    .number()
    .describe('학습 시간의 백분율 변화 (예: -0.30은 -30% 감소).'),
  daysSinceLastPlan: z
    .number()
    .describe('학생이 마지막으로 계획을 제출한 후 경과한 일수.'),
});
export type IdentifyAtRiskStudentInput = z.infer<
  typeof IdentifyAtRiskStudentInputSchema
>;

const IdentifyAtRiskStudentOutputSchema = z.object({
  isAtRisk: z.boolean().describe('학생이 위험에 처해 있다고 식별되면 True.'),
  riskReasons: z
    .array(z.string())
    .describe('학생이 위험에 처한 구체적이고 객관적인 이유 목록.'),
  interventionSuggestions: z
    .array(z.string())
    .describe('일반적이고 사전 예방적인 개입 제안.'),
  basedOnMetrics: IdentifyAtRiskStudentInputSchema.partial().describe(
    '위험 평가에 사용된 주요 지표의 스냅샷.'
  ),
});
export type IdentifyAtRiskStudentOutput = z.infer<
  typeof IdentifyAtRiskStudentOutputSchema
>;

export async function identifyAtRiskStudents(
  input: IdentifyAtRiskStudentInput
): Promise<IdentifyAtRiskStudentOutput> {
  return identifyAtRiskStudentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'identifyAtRiskStudentPrompt',
  input: {schema: IdentifyAtRiskStudentInputSchema},
  output: {schema: IdentifyAtRiskStudentOutputSchema},
  prompt: `당신은 스터디 센터의 AI 기반 위험 감지 시스템입니다. 당신의 목표는 학업 지표를 기반으로 학업 이탈 또는 성과 부진의 위험이 있는 학생들을 객관적으로 식별하는 것입니다. 사실적 관찰과 건설적인 제안을 제공하는 데 중점을 두십시오.

학생의 다음 데이터를 분석하십시오:
- 계획 완수율 (지난 2주): {{{planCompletionRateLast2Weeks}}}%
- 결석 일수 (최근 기간): {{{absenceDaysLastPeriod}}}일
- 학습 시간 성장률 (이전 기간 대비 최근 기간): {{{studyTimeGrowthRate}}} (-0.30 값은 30% 감소를 의미)
- 마지막 계획 제출 후 경과 일수: {{{daysSinceLastPlan}}}일

다음과 같은 경우 학생을 '위험' 상태로 간주하십시오:
- 지난 2주 동안 계획 완수율이 지속적으로 50% 미만인 경우.
- 최근 기간에 3일 이상 결석한 경우.
- 학습 시간 성장률이 -0.30(30% 감소) 이하로 현저하게 감소한 경우.
- 3일 이상 학습 계획을 제출하지 않은 경우.

이러한 지표를 바탕으로 학생이 위험에 처했는지 판단하십시오. 그렇다면, 학생이 위험에 처한 이유에 대한 명확하고 객관적이며 관찰에 기반한 목록을 제공하고, 사전 예방적이고 일반적인 개입 전략을 제안하십시오. 의학적 진단, 의학적 조언 또는 비난을 피하십시오. 관찰 가능한 행동과 데이터 동향에만 집중하십시오.

출력의 'basedOnMetrics' 필드가 평가에 사용한 입력 지표를 정확하게 반영하는지 확인하십시오.

JSON 형식으로 출력하십시오.`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE',
      },
    ],
  },
});

const identifyAtRiskStudentFlow = ai.defineFlow(
  {
    name: 'identifyAtRiskStudentFlow',
    inputSchema: IdentifyAtRiskStudentInputSchema,
    outputSchema: IdentifyAtRiskStudentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('AI 프롬프트가 출력을 반환하지 않았습니다.');
    }
    return {
      ...output,
      basedOnMetrics: {
        planCompletionRateLast2Weeks: input.planCompletionRateLast2Weeks,
        absenceDaysLastPeriod: input.absenceDaysLastPeriod,
        studyTimeGrowthRate: input.studyTimeGrowthRate,
        daysSinceLastPlan: input.daysSinceLastPlan,
      },
    };
  }
);
