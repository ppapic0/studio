'use server';
/**
 * @fileOverview 학생 학습 데이터를 분석해 학부모 발송용 데일리 리포트를 생성합니다.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DailyReportInputSchema = z.object({
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
});

export type DailyReportInput = z.infer<typeof DailyReportInputSchema>;

const DailyReportOutputSchema = z.object({
  level: z.number().min(1).max(10).describe('10단계 시스템 기준 단계'),
  levelName: z.string().describe('단계명'),
  content: z.string().describe('발송용 리포트 본문'),
  teacherOneLiner: z.string().describe('선생님 한 줄 코칭'),
  strengths: z.array(z.string()).describe('오늘 잘한 점'),
  improvements: z.array(z.string()).describe('보완할 점'),
  metrics: z.object({
    growthRate: z.number().describe('최근 7일 평균 대비 증감률(%)'),
    deltaMinutesFromAvg: z.number().describe('최근 7일 평균 대비 증감 분'),
    avg7StudyMinutes: z.number().describe('최근 7일 평균 학습 분'),
    isNewRecord: z.boolean().describe('최근 7일 기준 최고 기록 갱신'),
    alertLow: z.boolean().describe('저학습 경고'),
    streakBadge: z.boolean().describe('연속 고집중 여부'),
    trendSummary: z.string().describe('그래프 변동 요약'),
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
  return names[level] ?? '학습 성장 단계';
}

function toHm(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
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

function getTrendSummary(history7: number[], todayMinutes: number): string {
  const recent = [...history7].reverse().slice(-2);
  const series = [...recent, todayMinutes];
  if (series.length < 3) return '최근 데이터가 적어 추세를 단정하기 어렵습니다.';

  const earliest = series[0];
  const latest = series[2];
  const diff3d = latest - earliest;
  const maxVal = Math.max(...series);
  const minVal = Math.min(...series);
  const swing = maxVal - minVal;

  if (diff3d >= 60) return `최근 3일 그래프가 상승세입니다(약 +${diff3d}분).`;
  if (diff3d <= -60) return `최근 3일 그래프가 하락세입니다(약 ${diff3d}분).`;
  if (swing >= 90) return `최근 3일 변동폭이 큽니다(최대 ${swing}분 차). 리듬 안정화가 필요합니다.`;
  return '최근 3일 그래프가 비교적 안정적으로 유지되고 있습니다.';
}

function buildDeterministicDailyReport(input: DailyReportInput): DailyReportOutput {
  const minutes = Math.max(0, Number(input.totalStudyMinutes || 0));
  const completionRate = Math.max(0, Math.min(100, Number(input.completionRate || 0)));
  const minuteLevel = minuteToLevel(minutes);
  const completionLevel = completionToLevel(completionRate);
  const level = Math.max(1, Math.min(minuteLevel, completionLevel));
  const levelLabel = levelName(level);

  const history = (input.history7Days || [])
    .map((h) => Number(h.minutes || 0))
    .filter((m) => Number.isFinite(m));
  const avg7 = history.length > 0 ? history.reduce((sum, m) => sum + m, 0) / history.length : 0;
  const growthRate = avg7 > 0 ? safePercent(((minutes - avg7) / avg7) * 100) : 0;
  const deltaMinutesFromAvg = Math.round(minutes - avg7);
  const maxPrev = history.length > 0 ? Math.max(...history) : 0;
  const isNewRecord = history.length > 0 && minutes > maxPrev;
  const last3 = history.slice(0, 3);
  const alertLow = last3.length === 3 && last3.every((m) => m < 120) && minutes < 120;
  const streakSource = [...history.slice(0, 4), minutes];
  const streakBadge = streakSource.length >= 5 && streakSource.every((m) => m >= 300);
  const trendSummary = getTrendSummary(history, minutes);

  const studyPlanCount = input.plans?.length ?? 0;
  const studyDoneCount = input.plans?.filter((p) => p.done).length ?? 0;
  const attendanceText = input.schedule?.find((s) => s.title.includes('등원'))?.time ?? '-';
  const leaveText = input.schedule?.find((s) => s.title.includes('하원'))?.time ?? '-';

  const teacherMemo = input.teacherNote?.trim()
    ? input.teacherNote.trim()
    : '오늘은 기본 루틴 유지와 집중 시간 확보를 우선 목표로 지도했습니다.';
  const teacherOneLiner = `${input.studentName} 학생은 오늘 ${toHm(minutes)} 학습, 7일 평균 대비 ${deltaMinutesFromAvg >= 0 ? '+' : ''}${deltaMinutesFromAvg}분(${growthRate >= 0 ? '+' : ''}${growthRate}%) ${deltaMinutesFromAvg >= 0 ? '상승' : '하락'}했습니다.`;

  const strengths: string[] = [];
  if (growthRate >= 10) strengths.push(`7일 평균 대비 학습시간 ${growthRate >= 0 ? '+' : ''}${growthRate}% 상승`);
  if (completionRate >= 80) strengths.push(`계획 완료율 ${completionRate}%로 실행력이 안정적`);
  if (isNewRecord) strengths.push('최근 7일 기준 최고 학습시간을 갱신');
  if (strengths.length === 0) strengths.push('학습 루틴을 유지하며 기본 학습량을 확보');

  const improvements: string[] = [];
  if (growthRate <= -10) improvements.push(`7일 평균 대비 학습시간 ${growthRate}% 하락 구간 보완 필요`);
  if (completionRate < 70) improvements.push(`계획 완료율 ${completionRate}%로 마무리 비율 개선 필요`);
  if (alertLow) improvements.push('저학습 구간이 연속되어 등원 직후 집중 블록 강화 필요');
  if (improvements.length === 0) improvements.push('과목 전환 간격을 줄여 집중 효율 추가 개선 가능');

  const phaseAdvice =
    level <= 3
      ? '학습 루틴을 작게라도 매일 고정하고, 등원 후 30분 집중 블록부터 확실히 지키는 것이 핵심입니다.'
      : level <= 6
        ? '현재 루틴은 안정적입니다. 집중 블록을 20~30분 늘리고 완료 체크를 당일 마감하면 다음 단계 진입이 가능합니다.'
        : level <= 8
          ? '상위권 루틴으로 진입 중입니다. 과목 전환 손실을 줄이고 고난도 과목을 초반 집중 시간에 배치해 효율을 높이세요.'
          : '최상위권 페이스입니다. 실전형 문제 비중과 오답 복기 정확도를 유지해 성과를 고정하는 전략이 필요합니다.';

  const growthText =
    avg7 > 0
      ? `최근 7일 평균(${toHm(Math.round(avg7))}) 대비 ${growthRate >= 0 ? '+' : ''}${growthRate}% 변동이 있었습니다.`
      : '최근 7일 비교 데이터가 충분하지 않아 오늘 데이터를 기준으로 진단했습니다.';

  const badgeText = [
    isNewRecord ? '오늘 최고 기록을 갱신했습니다.' : '',
    streakBadge ? '5일 연속 고집중 학습 루틴을 유지 중입니다.' : '',
    alertLow ? '최근 학습시간이 낮아 다음 3일 집중 관리가 필요합니다.' : '',
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
    '🧠 AI 분석 결과',
    `- 오늘은 **${level}단계 (${levelLabel})**입니다.`,
    `- ${growthText}`,
    `- 최근 7일 평균: ${toHm(Math.round(avg7 || 0))} / 오늘: ${toHm(minutes)}`,
    `- 증감: ${deltaMinutesFromAvg >= 0 ? '+' : ''}${deltaMinutesFromAvg}분 (${growthRate >= 0 ? '+' : ''}${growthRate}%)`,
    `- 그래프 변동 해석: ${trendSummary}`,
    badgeText ? `- ${badgeText}` : '- 오늘 데이터를 기준으로 안정적인 학습 흐름을 확인했습니다.',
    '',
    '🧑‍🏫 오늘의 교사 코멘트',
    `- 선생님 메모: ${teacherMemo}`,
    `- 한 줄 코칭: ${teacherOneLiner}`,
    '',
    '✅ 오늘 잘한 점',
    ...strengths.map((item) => `- ${item}`),
    '',
    '⚠️ 보완할 점',
    ...improvements.map((item) => `- ${item}`),
    '',
    '🎯 AI 종합 피드백',
    `- ${phaseAdvice}`,
  ].join('\n');

  return {
    level,
    levelName: levelLabel,
    content,
    teacherOneLiner,
    strengths,
    improvements,
    metrics: {
      growthRate,
      deltaMinutesFromAvg,
      avg7StudyMinutes: Math.round(avg7 || 0),
      isNewRecord,
      alertLow,
      streakBadge,
      trendSummary,
    },
  };
}

const dailyReportPrompt = ai.definePrompt({
  name: 'dailyReportPrompt',
  input: { schema: DailyReportInputSchema },
  output: { schema: DailyReportOutputSchema },
  prompt: `당신은 관리형 독서실의 베테랑 교육 코치입니다.
학부모님이 바로 이해할 수 있도록 "숫자 기반" 데일리 리포트를 작성하세요.

### 입력 데이터
- 학생명: {{{studentName}}}
- 날짜: {{{date}}}
- 오늘 총 학습시간: {{{totalStudyMinutes}}}분
- 계획 완료율: {{{completionRate}}}%
- 계획 목록:
{{#each plans}}- {{{title}}} ({{#if done}}완료{{else}}미완료{{/if}})
{{/each}}
- 일정:
{{#each schedule}}- {{{title}}}: {{{time}}}
{{/each}}
- 최근 7일 기록: {{#each history7Days}}{{{minutes}}}분 {{/each}}
- 선생님 메모: {{{teacherNote}}}

### 필수 작성 규칙
1. 오늘의 단계(1~10)를 데이터 기준으로 판단하고 level, levelName에 반영.
2. 최근 7일 평균 대비 오늘 증감(분, %)을 반드시 숫자로 제시.
3. 그래프 변동 해석(trendSummary)을 한 문장으로 작성:
   - 상승 / 하락 / 변동성 중 하나로 명확하게 표현.
4. strengths(2~3개): 오늘 잘한 점을 구체 수치 중심으로 작성.
5. improvements(2~3개): 오늘 부족했던 점과 보완 포인트 작성.
6. teacherOneLiner는 선생님 메모를 반영하되, 반드시 학습시간/증감률 숫자를 포함한 1문장.
7. content는 아래 템플릿 구조를 유지하고, 학부모가 읽기 쉽게 간결하고 전문적으로 작성.

### content 템플릿
📘 [학습 AI 리포트] - {{{date}}}

📍 출결 정보
- 등원: ...
- 하원: ...
- 총 학습시간: ...
- 학습 계획: .../... 완료

✅ 계획 수행률
- ...% 달성

🧠 AI 분석 결과
- 오늘은 **...단계 (...단계명)**입니다.
- 최근 7일 평균 대비 ...%
- 최근 7일 평균: ... / 오늘: ...
- 증감: ...분 (...%)
- 그래프 변동 해석: ...
- 특이사항: ...

🧑‍🏫 오늘의 교사 코멘트
- 선생님 메모: ...
- 한 줄 코칭: ...

✅ 오늘 잘한 점
- ...
- ...

⚠️ 보완할 점
- ...
- ...

🎯 AI 종합 피드백
- ...`,
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

