'use server';
/**
 * @fileOverview 학생의 학습 데이터를 분석하여 10단계 학습 시스템 기반의 학부모 리포트를 생성하는 AI 에이전트입니다.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DailyReportInputSchema = z.object({
  studentName: z.string().describe('학생의 이름'),
  date: z.string().describe('리포트 날짜 (YYYY-MM-DD)'),
  totalStudyMinutes: z.number().describe('오늘의 총 학습 시간 (분)'),
  completionRate: z.number().describe('오늘의 계획 완수율 (0-100)'),
  plans: z.array(z.object({
    title: z.string(),
    done: z.boolean(),
  })).describe('오늘의 학습 계획 상세'),
  schedule: z.array(z.object({
    title: z.string(),
    time: z.string(),
  })).describe('생활 시간표 (등/하원 등)'),
  history7Days: z.array(z.object({
    date: z.string(),
    minutes: z.number(),
  })).describe('최근 7일간의 학습 시간 기록'),
  teacherNote: z.string().optional().describe('선생님이 직접 입력한 관찰 메모'),
});

export type DailyReportInput = z.infer<typeof DailyReportInputSchema>;

const DailyReportOutputSchema = z.object({
  level: z.number().min(1).max(10).describe('10단계 시스템 중 오늘에 해당하는 단계'),
  levelName: z.string().describe('해당 단계의 명칭 (예: 집중력 향상 단계)'),
  content: z.string().describe('AI가 생성한 리포트 본문 전체 (템플릿 적용)'),
  metrics: z.object({
    growthRate: z.number().describe('최근 7일 평균 대비 증감률 (%)'),
    isNewRecord: z.boolean().describe('최근 7일 중 최고 기록 갱신 여부'),
    alertLow: z.boolean().describe('3일 연속 저조 경고 여부'),
    streakBadge: z.boolean().describe('5일 연속 6단계 이상 유지 트로피 여부'),
  }),
});

export type DailyReportOutput = z.infer<typeof DailyReportOutputSchema>;

export async function generateDailyReport(input: DailyReportInput): Promise<DailyReportOutput> {
  return dailyReportFlow(input);
}

const dailyReportPrompt = ai.definePrompt({
  name: 'dailyReportPrompt',
  input: { schema: DailyReportInputSchema },
  output: { schema: DailyReportOutputSchema },
  prompt: `당신은 관리형 독서실의 베테랑 교육 코치입니다. 다음 데이터를 바탕으로 학부모님께 보낼 **[학습 AI 리포트]**를 생성하세요.

### 📋 10단계 학습 단계 시스템 기준
- 1단계: 1시간 미만 & 40% 미만 (학습 습관 형성 필요)
- 2단계: 1~2시간 & 50% (적응 단계)
- 3단계: 2~3시간 & 60% (기본 루틴 형성)
- 4단계: 3~4시간 & 70% (안정적 진입)
- 5단계: 4~5시간 & 75% (자기주도 시작)
- 6단계: 5~6시간 & 80% (집중력 향상)
- 7단계: 6~7시간 & 85% (상위권 루틴)
- 8단계: 7~8시간 & 90% (고효율 학습)
- 9단계: 8~9시간 & 95% (최상위 집중)
- 10단계: 9시간 이상 & 95% 이상 (수능 상위권형)

### 📊 입력 데이터
- 학생명: {{{studentName}}}
- 날짜: {{{date}}}
- 오늘 학습: {{{totalStudyMinutes}}}분, 완수율 {{{completionRate}}}%
- 계획 리스트:
{{#each plans}}- {{{title}}} ({{#if done}}완료{{else}}미완료{{/if}})
{{/each}}
- 시간표:
{{#each schedule}}- {{{title}}}: {{{time}}}
{{/each}}
- 최근 7일 기록: {{#each history7Days}}{{{minutes}}}분, {{/each}}
- 선생님 메모: {{{teacherNote}}}

### ✍️ 작성 가이드라인
1. **단계 진단**: 데이터 기준에 따라 단계를 결정하고 리포트에 명시하세요.
2. **비교 분석**: 최근 7일 평균 공부시간과 비교하여 증감률을 계산하고 언급하세요.
3. **분기별 피드백**:
   - 1~3단계: 습관 형성과 등원 후 즉시 시작 루틴 강조
   - 4~6단계: 집중 지속 시간 증가와 실행력 안정 강조
   - 7~8단계: 상위권 루틴 진입 및 실전 감각 유지 전략
   - 9~10단계: 고난도 비중 확대 및 실전 최적화 제안
4. **특수 알림**: 
   - 최고 기록 갱신 시 "🔥 집중 최고 기록 갱신!" 포함
   - 성적 저조 3일 지속 시 주의사항 포함
   - 5일 연속 6단계 이상 시 "🏆 우수 학습자 트로피" 언급
5. **톤앤매너**: 정중하고, 전문적이며, 학부모님이 신뢰할 수 있는 어조여야 합니다.

### 📘 출력 리포트 템플릿 형식
📘 [학습 AI 리포트] - {{{date}}}
🕒 출결 정보
- 등원: (시간표 중 등원 시간)
- 하원: (시간표 중 하원 시간)
- 총 학습시간: (시간/분으로 변환)
- 학습 계획: (완료수)/(전체수)

✅ 계획 완수율
- {{{completionRate}}}% 달성

📊 AI 분석 결과
- 오늘은 **{{level}}단계 ({{levelName}})**에 해당합니다.
- (7일 평균 대비 비교 분석 문장)
- (기록 갱신/알림/트로피 등 특이사항 문장)

💬 오늘의 교사 코멘트
- (선생님 메모를 바탕으로 다듬은 전문적인 코멘트)

🧠 AI 종합 피드백
- (단계별 분기에 따른 심층 조언 문장 2-3줄)
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
    if (!output) throw new Error('리포트 생성 실패');
    return output;
  }
);
