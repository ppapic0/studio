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
  try {
    return await dailyReportFlow(input);
  } catch (error) {
    console.error('[generateDailyReport] AI flow failed, using deterministic fallback', error);
    return buildDeterministicDailyReport(input);
  }
}

function minuteToLevel(minutes: number): number {
  if (minutes < 60) return 1;
  if (minutes < 120) return 2;
  if (minutes < 180) return 3;
  if (minutes < 240) return 4;
  if (minutes < 300) return 5;
  if (minutes < 360) return 6;
  if (minutes < 420) return 7;
  if (minutes < 480) return 8;
  if (minutes < 540) return 9;
  return 10;
}

function completionToLevel(completionRate: number): number {
  if (completionRate < 40) return 1;
  if (completionRate < 50) return 2;
  if (completionRate < 60) return 3;
  if (completionRate < 70) return 4;
  if (completionRate < 75) return 5;
  if (completionRate < 80) return 6;
  if (completionRate < 85) return 7;
  if (completionRate < 90) return 8;
  if (completionRate < 95) return 9;
  return 10;
}

function levelName(level: number): string {
  const names: Record<number, string> = {
    1: '학습 동기 형성 단계',
    2: '적응 단계',
    3: '기본 루틴 형성 단계',
    4: '안정적 진입 단계',
    5: '자기주도 시작 단계',
    6: '집중력 향상 단계',
    7: '상위권 루틴 단계',
    8: '고효율 학습 단계',
    9: '최상위 집중 단계',
    10: '수능 상위권 완성 단계',
  };
  return names[level] ?? '학습 성장 단계';
}

function toHm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

function safePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function buildDeterministicDailyReport(input: DailyReportInput): DailyReportOutput {
  const minutes = Math.max(0, Number(input.totalStudyMinutes || 0));
  const completionRate = Math.max(0, Math.min(100, Number(input.completionRate || 0)));
  const minuteLevel = minuteToLevel(minutes);
  const completionLevel = completionToLevel(completionRate);
  const level = Math.max(1, Math.min(minuteLevel, completionLevel));
  const levelLabel = levelName(level);

  const history = (input.history7Days || []).map((h) => Number(h.minutes || 0)).filter((m) => Number.isFinite(m));
  const avg7 = history.length > 0 ? history.reduce((sum, m) => sum + m, 0) / history.length : 0;
  const growthRate = avg7 > 0 ? safePercent(((minutes - avg7) / avg7) * 100) : 0;
  const maxPrev = history.length > 0 ? Math.max(...history) : 0;
  const isNewRecord = history.length > 0 && minutes > maxPrev;
  const last3 = history.slice(0, 3);
  const alertLow = last3.length === 3 && last3.every((m) => m < 120) && minutes < 120;
  const streakSource = [...history.slice(0, 4), minutes];
  const streakBadge = streakSource.length >= 5 && streakSource.every((m) => m >= 300);

  const studyPlanCount = input.plans?.length ?? 0;
  const studyDoneCount = input.plans?.filter((p) => p.done).length ?? 0;
  const attendanceText = input.schedule?.find((s) => s.title.includes('등원'))?.time ?? '-';
  const leaveText = input.schedule?.find((s) => s.title.includes('하원'))?.time ?? '-';

  const teacherMemo = input.teacherNote?.trim()
    ? input.teacherNote.trim()
    : '오늘은 기본 루틴 유지와 집중 시간 확보를 우선 목표로 삼았습니다.';

  const phaseAdvice =
    level <= 3
      ? '학습 루틴을 짧고 확실하게 지키는 습관부터 만들면 성장 속도가 빨라집니다.'
      : level <= 6
        ? '현재 루틴이 안정적입니다. 집중 시간 20~30분 추가 확보가 다음 단계의 핵심입니다.'
        : level <= 8
          ? '상위권 루틴에 진입했습니다. 과목별 난이도 편차를 줄이면 성과가 더 크게 올라옵니다.'
          : '최상위권 패턴입니다. 고난도 문제 대응력과 실전 감각 유지에 집중해 주세요.';

  const growthText =
    avg7 > 0
      ? `최근 7일 평균(${toHm(Math.round(avg7))}) 대비 ${growthRate >= 0 ? '+' : ''}${growthRate}% 변동이 있었습니다.`
      : '최근 7일 비교 데이터가 충분하지 않아 오늘 데이터를 기준으로 진단했습니다.';

  const badgeText = [
    isNewRecord ? '오늘 최고 기록을 갱신했습니다.' : '',
    streakBadge ? '5일 연속 고집중 학습 루틴을 유지했습니다.' : '',
    alertLow ? '최근 학습 시간이 낮아 다음 3일 집중 관리가 필요합니다.' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = [
    `📘 [학습 AI 리포트] - ${input.date}`,
    '',
    '📍 출결 정보',
    `- 등원: ${attendanceText}`,
    `- 하원: ${leaveText}`,
    `- 총 학습시간: ${toHm(minutes)}`,
    `- 학습 계획: ${studyDoneCount}/${studyPlanCount} 완료`,
    '',
    '✅ 계획 수행률',
    `- ${completionRate}% 달성`,
    '',
    '📊 AI 분석 결과',
    `- 오늘은 **${level}단계 (${levelLabel})**에 해당합니다.`,
    `- ${growthText}`,
    badgeText ? `- ${badgeText}` : '- 오늘 데이터 기준으로 안정적 학습 흐름이 확인됩니다.',
    '',
    '🧠 오늘의 교사 코멘트',
    `- ${teacherMemo}`,
    '',
    '🪬 AI 종합 피드백',
    `- ${phaseAdvice}`,
  ].join('\n');

  return {
    level,
    levelName: levelLabel,
    content,
    metrics: {
      growthRate,
      isNewRecord,
      alertLow,
      streakBadge,
    },
  };
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

### 📘 출력 리포트 템플릿 형식 (content 필드에 들어갈 내용)
📘 [학습 AI 리포트] - {{{date}}}
🕒 출결 정보
- 등원: (시간표 중 등원 시간)
- 하원: (시간표 중 하원 시간)
- 총 학습시간: (시간/분으로 변환)
- 학습 계획: (완료수)/(전체수)

✅ 계획 완수율
- {{{completionRate}}}% 달성

📊 AI 분석 결과
- 오늘은 **[AI가 판단한 단계]단계 ([AI가 판단한 명칭])**에 해당합니다.
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
    if (!output) throw new Error('리포트 생성 실패: AI가 유효한 출력을 반환하지 않았습니다.');
    return output;
  }
);
