'use server';
/**
 * @fileOverview 학생의 하루 학습 데이터를 기반으로 학부모님께 보낼 데일리 리포트를 생성하는 AI 에이전트입니다.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DailyReportInputSchema = z.object({
  studentName: z.string().describe('학생의 이름'),
  date: z.string().describe('리포트 날짜 (YYYY-MM-DD)'),
  totalStudyMinutes: z.number().describe('오늘의 총 학습 시간 (분)'),
  plans: z.array(z.object({
    title: z.string(),
    done: z.boolean(),
    category: z.string().optional(),
  })).describe('오늘의 학습 계획 및 완료 여부'),
  schedule: z.array(z.object({
    title: z.string(),
    time: z.string(),
  })).describe('오늘의 생활 시간표 (등원, 하원 등)'),
  teacherNote: z.string().optional().describe('선생님이 추가로 전달하고 싶은 메모'),
});

export type DailyReportInput = z.infer<typeof DailyReportInputSchema>;

const DailyReportOutputSchema = z.object({
  content: z.string().describe('AI가 생성한 리포트 본문 (줄바꿈 포함된 친절한 텍스트)'),
  summary: z.string().describe('한 줄 요약'),
  sentiment: z.enum(['positive', 'neutral', 'needs_encouragement']).describe('오늘의 전반적인 학습 분위기'),
});

export type DailyReportOutput = z.infer<typeof DailyReportOutputSchema>;

export async function generateDailyReport(input: DailyReportInput): Promise<DailyReportOutput> {
  return dailyReportFlow(input);
}

const dailyReportPrompt = ai.definePrompt({
  name: 'dailyReportPrompt',
  input: { schema: DailyReportInputSchema },
  output: { schema: DailyReportOutputSchema },
  prompt: `당신은 관리형 독서실의 베테랑 선생님입니다. 오늘 학생의 학습 데이터를 보고 학부모님께 보낼 따뜻하고 전문적인 데일리 리포트를 작성해 주세요.

학생 정보:
- 이름: {{{studentName}}}
- 날짜: {{{date}}}
- 총 학습 시간: {{#if totalStudyMinutes}}{{{totalStudyMinutes}}}분{{else}}0분{{/if}}

오늘의 학습 계획 수행 상세:
{{#each plans}}
- [{{#if done}}V{{else}} {{/if}}] {{{title}}}
{{/each}}

오늘의 생활 흐름 (등/하원 및 휴식):
{{#each schedule}}
- {{{title}}}: {{{time}}}
{{/each}}

{{#if teacherNote}}
선생님 전달 사항:
{{{teacherNote}}}
{{/if}}

작성 가이드라인:
1. **전문성과 따뜻함**: 어조는 정중하고 신뢰감이 느껴지며, 학부모님의 걱정을 덜어드리는 따뜻한 말투여야 합니다.
2. **구체적 분석**: 단순히 시간만 나열하지 말고, "오늘 세운 계획 중 X%를 완수하며 집중력 있는 모습을 보였습니다"와 같이 구체적인 성과를 언급해 주세요.
3. **긍정적 강화**: 계획을 다 채우지 못했더라도 실망시키기보다 "어려운 과제가 있었음에도 끝까지 자리를 지킨 점이 고무적입니다"와 같이 격려 위주로 써주세요.
4. **생활 패턴 언급**: 등원 시간의 규칙성이나 하원까지의 흐름이 좋았다면 그 부분을 칭찬해 주세요.
5. **구조**:
   - 인사 ("안녕하세요, {{{studentName}}} 학생의 오늘 학습 리포트를 전달드립니다.")
   - 학습 몰입도 분석 (공부 시간 및 계획 완수율 기반)
   - 생활 태도 및 칭찬할 점
   - 내일의 기대 및 마무리 인사
6. **형식**: 결과는 JSON 형식으로 리포트 본문(content), 한 줄 요약(summary), 학습 분위기(sentiment)를 포함해야 합니다.
`,
});

const dailyReportFlow = ai.defineFlow(
  {
    name: 'dailyReportFlow',
    inputSchema: DailyReportInputSchema,
    outputSchema: DailyReportOutputSchema,
  },
  async (input) => {
    const { output } = await dailyReportPrompt(input);
    if (!output) throw new Error('AI 리포트 생성에 실패했습니다.');
    return output;
  }
);
