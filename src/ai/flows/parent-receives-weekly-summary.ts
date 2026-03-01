'use server';
/**
 * @fileOverview A Genkit flow for generating personalized weekly performance summaries for parents.
 *
 * - generateParentSummary - A function that generates a weekly summary for a parent.
 * - ParentSummaryInput - The input type for the generateParentSummary function.
 * - ParentSummaryOutput - The return type for the generateParentSummary function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ParentSummaryInputSchema = z.object({
  studentName: z.string().describe('학생의 이름.'),
  completionRate: z.number().min(0).max(100).describe('주간 가중 평균 계획 완수율 (0-100%).'),
  completionRateTrend: z.number().min(-100).max(100).describe('이전 주 대비 계획 완수율 변화 (-100 ~ 100%).'),
  attendanceRate: z.number().min(0).max(100).describe('주간 전체 출석률 (0-100%).'),
  attendanceTrend: z.number().min(-100).max(100).describe('이전 주 대비 출석률 변화 (-100 ~ 100%).'),
  studyTimeGrowth: z.number().min(-0.8).max(3.0).describe('이전 7일 대비 최근 7일간의 학습 시간 성장률 (-0.8 ~ 3.0).'),
  recentAchievements: z.array(z.string()).describe('학생의 최근 긍정적인 성취 또는 관찰 사항 목록.'),
  potentialRisks: z.array(z.string()).describe('학생의 잠재적 위험 또는 주의가 필요한 영역 목록.'),
  parentFeedbackContext: z.string().optional().describe('요약에 포함할 학부모 또는 교사가 제공한 특정 피드백 또는 맥락.'),
});
export type ParentSummaryInput = z.infer<typeof ParentSummaryInputSchema>;

const ParentSummaryOutputSchema = z.object({
  message: z.string().describe('학부모를 위한 AI 생성 주간 요약 메시지. 간결하고 격려적이어야 합니다.'),
  keyMetrics: z.array(
    z.object({
      name: z.string().describe('지표 이름 (예: "계획 완수율").'),
      value: z.string().describe('지표의 형식화된 값 (예: "85%").'),
      trend: z.string().optional().describe('추세에 대한 간략한 설명 (예: "지난주보다 5% 상승").'),
    })
  ).describe('빠른 검토에 적합한 3-5개의 주요 성과 지표와 그 값 및 추세.'),
  recommendations: z.array(z.string()).describe('학부모가 자녀를 지원하기 위한 실행 가능한 권장 사항 또는 통찰력, 긍정적 강화와 참여에 중점.'),
  safetyScore: z.number().min(0).max(100).describe('생성된 콘텐츠의 안전성과 적절성을 나타내는 내부 점수 (0-100, 100은 완벽하게 안전함을 의미).'),
});
export type ParentSummaryOutput = z.infer<typeof ParentSummaryOutputSchema>;

export async function generateParentSummary(input: ParentSummaryInput): Promise<ParentSummaryOutput> {
  return parentSummaryFlow(input);
}

const parentSummaryPrompt = ai.definePrompt({
  name: 'parentSummaryPrompt',
  input: { schema: ParentSummaryInputSchema },
  output: { schema: ParentSummaryOutputSchema },
  prompt: `당신은 학부모에게 주간 학업 성취도 요약을 제공하도록 설계된 공감하고 지지하는 AI 조수입니다.
당신의 목표는 학부모에게 자녀의 성과 동향을 명확하고 건설적이며 격려하는 방식으로 알리는 것입니다.
비난, 학생 능력에 대한 단정적인 진술, 또는 의료/진단/치료 조언을 피하고 관찰과 사실적 경향에 초점을 맞추세요.

다음 학생 데이터를 기반으로 주간 요약을 생성하세요:

학생 이름: {{{studentName}}}

주간 성과 지표:
- 계획 완수율: {{{completionRate}}}% (지난주 대비 변화: {{{completionRateTrend}}}%)
- 출석률: {{{attendanceRate}}}% (지난주 대비 변화: {{{attendanceTrend}}}%)
- 학습 시간 성장률 (이전 기간 대비): x{{{studyTimeGrowth}}}

최근 성취/긍정적 관찰:
{{#if recentAchievements}}
{{#each recentAchievements}}- {{{this}}}
{{/each}}
{{else}}- 이번 주에 특별히 기록된 성취가 없습니다.
{{/if}}

잠재적 위험/주의 영역:
{{#if potentialRisks}}
{{#each potentialRisks}}- {{{this}}}
{{/each}}
{{else}}- 이번 주에 확인된 중요한 위험이 없습니다.
{{/if}}

{{#if parentFeedbackContext}}
추가 맥락/피드백: {{{parentFeedbackContext}}}
{{/if}}

위의 데이터를 바탕으로 학부모를 위한 요약을 생성해 주세요. 요약에는 다음이 포함되어야 합니다:
1. 주요 '메시지' (간결하고 격려적인 단락).
2. 'name', 'value', 'trend' 필드를 포함하는 3-5개의 'keyMetrics' 객체 배열로, 가장 중요한 통계를 강조합니다.
3. 'recommendations' 배열 (학부모를 위한 1-3개의 실행 가능하고 긍정적인 제안).
4. 'safetyScore' (0에서 100까지의 정수, 100은 콘텐츠가 학부모에게 완벽하게 안전하고 적절함을 나타냄).

어조는 따뜻하고 지지적이며 데이터에 기반해야 합니다. 발전과 개선 가능성에 초점을 맞추세요.
`,
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_UNSPECIFIED', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_TOXICITY', threshold: 'BLOCK_ONLY_HIGH' }
    ],
  }
});

const parentSummaryFlow = ai.defineFlow(
  {
    name: 'parentSummaryFlow',
    inputSchema: ParentSummaryInputSchema,
    outputSchema: ParentSummaryOutputSchema,
  },
  async (input) => {
    const { output } = await parentSummaryPrompt(input);
    return output!;
  }
);
