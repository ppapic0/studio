'use server';
/**
 * @fileOverview This file implements a Genkit flow that provides personalized study recommendations
 * and intervention strategies for students based on their performance metrics.
 *
 * - studentReceivesPersonalizedRecommendations - A function that generates personalized recommendations.
 * - InterventionInput - The input type for the studentReceivesPersonalizedRecommendations function.
 * - InterventionOutput - The return type for the studentReceivesPersonalizedRecommendations function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InterventionInputSchema = z.object({
  centerId: z.string().describe('스터디 센터의 ID.'),
  studentId: z.string().describe('학생의 ID.'),
  studentDisplayName: z.string().describe("개인화를 위한 학생의 표시 이름."),
  planCompletionRateLastTwoWeeks: z.number().min(0).max(1).describe('지난 2주간의 계획 완수율 (0-1).'),
  consecutiveDaysAbsent: z.number().min(0).describe('학생의 연속 결석 일수.'),
  studyTimeGrowthRate: z.number().describe('이전 기간 대비 학습 시간 성장률 (예: -0.30은 30% 감소).'),
  consecutiveDaysNoPlan: z.number().min(0).describe('학생이 계획을 제출하지 않은 연속 일수.'),
  weeklyCompletionRate: z.number().min(0).max(1).describe('주간 전체 계획 완수율 (0-1).'),
});
export type InterventionInput = z.infer<typeof InterventionInputSchema>;

const InterventionOutputSchema = z.object({
  type: z.literal('intervention').describe('AI 출력 유형, 항상 "intervention".'),
  message: z.string().describe('개인화된 개입 메시지 및 학습 권장 사항.'),
  basedOn: InterventionInputSchema.omit({ centerId: true, studentId: true, studentDisplayName: true }).describe('이 개입에 사용된 성과 지표의 스냅샷.'),
  model: z.string().describe('개입 생성에 사용된 AI 모델.'),
});
export type InterventionOutput = z.infer<typeof InterventionOutputSchema>;

export async function studentReceivesPersonalizedRecommendations(input: InterventionInput): Promise<InterventionOutput> {
  return interventionFlow(input);
}

const interventionPrompt = ai.definePrompt({
  name: 'interventionPrompt',
  input: { schema: InterventionInputSchema },
  output: { schema: InterventionOutputSchema },
  prompt: `당신은 학생들에게 개인화된 학습 권장 사항 및 개입 전략을 제공하는 AI 기반 학업 코치입니다.
당신의 목표는 학생들이 학습 습관을 개선하고 어려움을 극복하도록 지지적이고 행동 지향적인 방식으로 돕는 것입니다.
다음 가이드라인을 반드시 준수해야 합니다:
- 의료, 진단 또는 치료 조언을 제공하지 마십시오.
- 제공된 데이터를 기반으로 실행 가능한 제안과 관찰에 초점을 맞추십시오.
- 수면이나 정신 건강과 같은 민감한 주제는 피하십시오.
- 비난이나 단정적인 진술을 피하고 긍정적인 강화와 건설적인 조언에 중점을 두십시오.

학생 {{{studentDisplayName}}}의 다음 성과 지표를 기반으로 합니다:
- 계획 완수율 (지난 2주): {{planCompletionRateLastTwoWeeks}} (1.0은 100%)
- 연속 결석 일수: {{consecutiveDaysAbsent}}
- 학습 시간 성장률: {{studyTimeGrowthRate}} (예: -0.30은 30% 감소)
- 연속 무계획 일수: {{consecutiveDaysNoPlan}}
- 주간 전체 완수율: {{weeklyCompletionRate}} (1.0은 100%)

간결하고 개인화된 개입 메시지와 학습 권장 사항을 생성하십시오.
개선 영역을 식별하고 명확하고 실행 가능한 전략을 제공하십시오.

일반적인 시나리오에 따른 몇 가지 지침은 다음과 같습니다:
- 'planCompletionRateLastTwoWeeks'가 0.5 (50%) 미만인 경우, 계획이 현실적인지 검토하고 필요한 경우 단순화하도록 제안하십시오.
- 'studyTimeGrowthRate'가 음수(예: -0.30)인 경우, 학습 시간을 재분배하거나 방해 요소를 식별하도록 제안하십시오.
- 'consecutiveDaysAbsent'가 3일 이상인 경우, 어려움에 대해 부드럽게 질문하고 일관성의 중요성을 강조하십시오.
- 'consecutiveDaysNoPlan'이 3일 이상인 경우, 계획의 이점을 상기시키고 시작을 위한 팁을 제공하십시오.
- 'weeklyCompletionRate'가 높은 경우(예: 0.8 이상), 그들의 꾸준함과 노력에 대해 긍정적인 강화를 제공하십시오.

출력 메시지는 격려적이어야 하며 다음 단계에 초점을 맞춰야 합니다.
InterventionOutputSchema와 일치하는 JSON 객체 형식으로 응답을 작성하십시오.
'basedOn' 필드에는 제공된 성과 지표(planCompletionRateLastTwoWeeks, consecutiveDaysAbsent, studyTimeGrowthRate, consecutiveDaysNoPlan, weeklyCompletionRate)의 스냅샷만 포함하십시오.
'type'을 'intervention'으로, 'model'을 'googleai/gemini-2.5-flash'로 설정하십시오.

예시 출력 구조:
{
  "type": "intervention",
  "message": "[학생 이름]님, X는 잘하고 계신 것 같지만 Y는 좀 더 신경 써야 할 것 같아요. Z를 시도해 보세요.",
  "basedOn": {
    "planCompletionRateLastTwoWeeks": 0.45,
    "consecutiveDaysAbsent": 0,
    "studyTimeGrowthRate": -0.10,
    "consecutiveDaysNoPlan": 2,
    "weeklyCompletionRate": 0.55
  },
  "model": "googleai/gemini-2.5-flash"
}
`,
});

const interventionFlow = ai.defineFlow(
  {
    name: 'studentReceivesPersonalizedRecommendationsFlow',
    inputSchema: InterventionInputSchema,
    outputSchema: InterventionOutputSchema,
  },
  async (input) => {
    const { output } = await interventionPrompt(input);

    if (!output) {
      throw new Error('AI가 개입에 대한 출력을 반환하지 않았습니다.');
    }

    return output;
  },
);
