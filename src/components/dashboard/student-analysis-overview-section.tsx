'use client';

import { AlertTriangle, Sparkles } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ChartInsight, StudentFullAnalysisSummary } from '@/lib/learning-insights';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type WeeklyGrowthPoint = {
  label: string;
  totalMinutes: number;
  growth: number;
};

type DailyGrowthPoint = {
  dateLabel: string;
  minutes: number;
  growth: number;
};

type CompletionPoint = {
  dateLabel: string;
  completionRate: number;
  hasCompletion?: boolean;
};

type RhythmPoint = {
  dateLabel: string;
  score: number;
};

type StartEndPoint = {
  dateLabel: string;
  startHour: number;
  endHour: number;
};

type AwayPoint = {
  dateLabel: string;
  awayMinutes: number;
};

type StudySessionPoint = {
  dateKey: string;
  dateLabel: string;
  minutes: number;
  hasActualStudyLog: boolean;
};

type StudentAnalysisOverviewSectionProps = {
  isMobile: boolean;
  summary: StudentFullAnalysisSummary;
  chartInsights: {
    weekly: ChartInsight;
    daily: ChartInsight;
    rhythm: ChartInsight;
    startEnd: ChartInsight;
    away: ChartInsight;
  };
  hasWeeklyGrowthData: boolean;
  hasDailyGrowthData: boolean;
  hasCompletionTrendData: boolean;
  hasRhythmScoreOnlyTrend: boolean;
  hasStartEndTimeData: boolean;
  hasAwayTimeData: boolean;
  latestWeeklyLearningGrowthPercent: number;
  latestDailyLearningGrowthPercent: number;
  weeklyGrowthData: WeeklyGrowthPoint[];
  dailyGrowthWindowData: DailyGrowthPoint[];
  dailyGrowthWindowLabel: string;
  focusedChartDays: number;
  canGoPrevDailyWindow: boolean;
  canGoNextDailyWindow: boolean;
  onPrevDailyWindow: () => void;
  onNextDailyWindow: () => void;
  completionTrendData: CompletionPoint[];
  recentStudySessions: StudySessionPoint[];
  avgCompletionRate: number;
  avgStudyMinutes: number;
  todayStudyMinutes: number;
  studyStreakDays: number;
  rhythmScore: number;
  averageRhythmScore: number;
  latestRhythmScore: number;
  rhythmScoreOnlyTrend: RhythmPoint[];
  startEndTimeTrendData: StartEndPoint[];
  latestStartEndSnapshot: { start: string; end: string };
  awayTimeData: AwayPoint[];
  averageAwayMinutes: number;
  riskSignals: string[];
};

function minutesToLabel(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

function hourTickFormatter(value: number): string {
  if (!Number.isFinite(value)) return '0h';
  return `${Math.max(0, Math.round(value))}h`;
}

function hourToClockLabel(value: number): string {
  if (!Number.isFinite(value)) return '-';
  const normalized = Math.max(0, Math.min(24, value));
  const totalMinutes = Math.round(normalized * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatSignedPercent(value: number): string {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? '+' : ''}${rounded}%`;
}

function SectionStateBadge({ ready }: { ready: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
        ready
          ? 'border-[#F1DDC7] bg-[#FFF4E5] text-[#17326B]'
          : 'border-[#dbe7ff] bg-white text-[#5F7299]'
      )}
    >
      {ready ? '데이터 충분' : '기록 대기'}
    </Badge>
  );
}

export default function StudentAnalysisOverviewSection(props: StudentAnalysisOverviewSectionProps) {
  const {
    isMobile,
    summary,
    chartInsights,
    hasWeeklyGrowthData,
    hasDailyGrowthData,
    hasCompletionTrendData,
    hasRhythmScoreOnlyTrend,
    hasStartEndTimeData,
    hasAwayTimeData,
    latestWeeklyLearningGrowthPercent,
    latestDailyLearningGrowthPercent,
    weeklyGrowthData,
    dailyGrowthWindowData,
    dailyGrowthWindowLabel,
    focusedChartDays,
    canGoPrevDailyWindow,
    canGoNextDailyWindow,
    onPrevDailyWindow,
    onNextDailyWindow,
    completionTrendData,
    recentStudySessions,
    avgCompletionRate,
    avgStudyMinutes,
    todayStudyMinutes,
    studyStreakDays,
    rhythmScore,
    averageRhythmScore,
    latestRhythmScore,
    rhythmScoreOnlyTrend,
    startEndTimeTrendData,
    latestStartEndSnapshot,
    awayTimeData,
    averageAwayMinutes,
    riskSignals,
  } = props;

  const chartMargin = isMobile ? { top: 10, right: 6, left: -10, bottom: 0 } : { top: 10, right: 10, left: -14, bottom: 0 };
  const tooltipStyle = {
    borderRadius: 18,
    border: '1px solid #dbe7ff',
    boxShadow: '0 20px 40px -28px rgba(20, 41, 95, 0.38)',
    fontWeight: 700,
  } as const;

  return (
    <section className="space-y-5">
      <div className="analysis-overview-shell analysis-premium-card analysis-full-board-card surface-card surface-card--primary on-dark">
        <div className={cn(isMobile ? 'space-y-4' : 'space-y-5')}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#FF7A16]" />
              <p className="font-aggro-display text-[10px] font-black uppercase tracking-[0.22em] text-[#D86A11]">펼쳐서 보는 그래프</p>
            </div>
            <h2 className="font-aggro-display mt-3 break-keep text-[clamp(1.04rem,1.5vw,1.22rem)] font-black tracking-[-0.03em] text-[#17326B]">
              필요한 카드만 펼쳐서 확인해보세요
            </h2>
            <p className="mt-2 text-[12px] font-semibold leading-5 text-[#5F7299]">
              제목과 한 줄 해석을 먼저 보고, 필요한 섹션만 펼치면 됩니다.
            </p>
          </div>

          <Accordion type="multiple" className="space-y-3">
            <AccordionItem value="study-volume" className="analysis-accordion-card overflow-hidden rounded-[1.45rem] px-4">
              <AccordionTrigger className="gap-4 py-4 text-left hover:no-underline">
                <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-aggro-display text-[1rem] font-black tracking-[-0.03em] text-[#14295F]">공부량 추이</p>
                    <p className="mt-1 text-[12px] font-semibold leading-5 text-[#5F7299]">{chartInsights.weekly.trend}</p>
                  </div>
                  <SectionStateBadge ready={hasWeeklyGrowthData || hasDailyGrowthData} />
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-0 pt-1">
                <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]')}>
                  <Card className="rounded-[1.6rem] border border-[#dbe7ff] bg-white shadow-[0_28px_70px_-56px_rgba(20,41,95,0.38)]">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="border border-[#dbe7ff] bg-[#f8fbff] text-[#14295F]">주간 성장</Badge>
                            <Badge variant="outline" className="border-[#dbe7ff] bg-white text-[#2554d4]">최근 6주</Badge>
                          </div>
                          <CardTitle className="font-aggro-display mt-3 text-[clamp(1rem,1.45vw,1.22rem)] font-black tracking-tight text-[#14295F]">주간 학습시간 성장률</CardTitle>
                          <CardDescription className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">주간 누적 학습시간과 전주 대비 변화를 함께 읽습니다.</CardDescription>
                        </div>
                        <div className="rounded-[1rem] border border-[#dbe7ff] bg-[#f8fbff] px-3 py-2 text-right">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2554d4]">이번 주 성장</p>
                          <p className={cn('mt-1 text-lg font-black tracking-tight', latestWeeklyLearningGrowthPercent >= 0 ? 'text-emerald-600' : 'text-rose-500')}>{formatSignedPercent(latestWeeklyLearningGrowthPercent)}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {hasWeeklyGrowthData ? (
                        <div className="space-y-3">
                          <div className="rounded-[1.25rem] border border-[#eef3ff] bg-white/90 p-2">
                            <div className="h-[276px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={weeklyGrowthData} margin={chartMargin}>
                                  <defs>
                                    <linearGradient id="studentAnalysisWeeklyBarGradient" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#2f65ff" />
                                      <stop offset="70%" stopColor="#6f8fff" />
                                      <stop offset="100%" stopColor="#bdd0ff" />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                                  <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 800, fill: '#6b7ea6' }} tickLine={false} axisLine={false} tickMargin={8} />
                                  <YAxis yAxisId="mins" tick={{ fontSize: 10, fontWeight: 800, fill: '#6b7ea6' }} tickLine={false} axisLine={false} width={38} tickFormatter={(value) => hourTickFormatter(Number(value) / 60)} />
                                  <YAxis yAxisId="growth" orientation="right" tick={{ fontSize: 9, fontWeight: 800, fill: '#9aaac8' }} tickLine={false} axisLine={false} width={34} domain={[-20, 20]} tickFormatter={(value) => `${value}%`} />
                                  <Tooltip contentStyle={tooltipStyle} />
                                  <Bar yAxisId="mins" dataKey="totalMinutes" radius={[10, 10, 4, 4]} maxBarSize={isMobile ? 20 : 32} fill="url(#studentAnalysisWeeklyBarGradient)" />
                                  <Line yAxisId="growth" type="monotone" dataKey="growth" stroke="#15b87b" strokeWidth={2.6} dot={false} activeDot={{ r: 4.5, fill: '#15b87b', stroke: '#ffffff', strokeWidth: 2 }} />
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                          <div className="rounded-[1.1rem] border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2554d4]">주간 해석</p>
                            <p className="mt-2 text-sm font-black leading-6 text-[#14295F]">{chartInsights.weekly.trend}</p>
                            <p className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">{chartInsights.weekly.improve}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-[1.25rem] border border-dashed border-[#dbe7ff] bg-white/80 px-4 py-8 text-center text-sm font-bold text-[#5c6e97]">최근 주간 학습 데이터가 없습니다.</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="rounded-[1.6rem] border border-[#dbe7ff] bg-white shadow-[0_28px_70px_-56px_rgba(20,41,95,0.38)]">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="border border-[#dbe7ff] bg-[#f8fbff] text-[#14295F]">일간 흐름</Badge>
                            <Badge variant="outline" className="border-[#ffe1c5] bg-white text-[#d86a11]">{dailyGrowthWindowLabel}</Badge>
                          </div>
                          <CardTitle className="font-aggro-display mt-3 text-[clamp(1rem,1.45vw,1.22rem)] font-black tracking-tight text-[#14295F]">일자별 학습시간 성장률</CardTitle>
                          <CardDescription className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">선택한 7일 구간의 평균 공부시간과 변화 폭을 같이 봅니다.</CardDescription>
                        </div>
                        <div className="space-y-2">
                          <div className="rounded-[1rem] border border-[#ffe1c5] bg-[#fff8ef] px-3 py-2 text-right">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d86a11]">최근 7일</p>
                            <p className={cn('mt-1 text-lg font-black tracking-tight', latestDailyLearningGrowthPercent >= 0 ? 'text-emerald-600' : 'text-rose-500')}>{formatSignedPercent(latestDailyLearningGrowthPercent)}</p>
                          </div>
                          <div className={cn('grid gap-2', isMobile ? 'grid-cols-2' : 'grid-cols-2')}>
                            <Button variant="outline" size="sm" className="h-8 rounded-full px-3 text-[11px] font-black" onClick={onPrevDailyWindow} disabled={!canGoPrevDailyWindow}>이전 7일</Button>
                            <Button variant="outline" size="sm" className="h-8 rounded-full px-3 text-[11px] font-black" onClick={onNextDailyWindow} disabled={!canGoNextDailyWindow}>다음 7일</Button>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {hasDailyGrowthData ? (
                        <div className="space-y-3">
                          <div className="rounded-[1.25rem] border border-[#eef3ff] bg-white/90 p-2">
                            <div className="h-[276px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={dailyGrowthWindowData} margin={chartMargin}>
                                  <defs>
                                    <linearGradient id="studentAnalysisDailyBarGradient" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#76d0ff" />
                                      <stop offset="70%" stopColor="#8ed7ff" />
                                      <stop offset="100%" stopColor="#d4f1ff" />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                                  <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: '#6b7ea6' }} tickLine={false} axisLine={false} tickMargin={8} interval={isMobile ? 1 : 0} />
                                  <YAxis yAxisId="mins" tick={{ fontSize: 10, fontWeight: 800, fill: '#6b7ea6' }} tickLine={false} axisLine={false} width={38} tickFormatter={(value) => hourTickFormatter(Number(value) / 60)} />
                                  <YAxis yAxisId="growth" orientation="right" tick={{ fontSize: 9, fontWeight: 800, fill: '#9aaac8' }} tickLine={false} axisLine={false} width={36} domain={[-100, 100]} tickFormatter={(value) => `${value}%`} />
                                  <Tooltip contentStyle={tooltipStyle} />
                                  <Bar yAxisId="mins" dataKey="minutes" radius={[10, 10, 4, 4]} maxBarSize={isMobile ? 16 : 24} fill="url(#studentAnalysisDailyBarGradient)" />
                                  <Line yAxisId="growth" type="monotone" dataKey="growth" stroke="#ff9b24" strokeWidth={2.6} dot={false} activeDot={{ r: 4.5, fill: '#ff9b24', stroke: '#ffffff', strokeWidth: 2 }} />
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                          <div className="rounded-[1.1rem] border border-[#ffe1c5] bg-[#fff8ef] px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d86a11]">일자 해석</p>
                            <p className="mt-2 text-sm font-black leading-6 text-[#14295F]">{chartInsights.daily.trend}</p>
                            <p className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">{chartInsights.daily.improve}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-[1.25rem] border border-dashed border-[#dbe7ff] bg-white/80 px-4 py-8 text-center text-sm font-bold text-[#5c6e97]">일자별 학습 데이터가 없습니다.</div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="execution" className="analysis-accordion-card overflow-hidden rounded-[1.45rem] px-4">
              <AccordionTrigger className="gap-4 py-4 text-left hover:no-underline">
                <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-aggro-display text-[1rem] font-black tracking-[-0.03em] text-[#14295F]">완수·집중 밀도</p>
                    <p className="mt-1 text-[12px] font-semibold leading-5 text-[#5F7299]">
                      최근 {focusedChartDays}일 완료율 {avgCompletionRate}% · 연속 공부 {studyStreakDays}일
                    </p>
                  </div>
                  <SectionStateBadge ready={hasCompletionTrendData} />
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-0 pt-1">
                <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]')}>
                  <Card className="rounded-[1.6rem] border border-[#dbe7ff] bg-white shadow-[0_28px_70px_-56px_rgba(20,41,95,0.38)]">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="border border-[#dbe7ff] bg-[#f8fbff] text-[#14295F]">실행력 점검</Badge>
                            <Badge variant="outline" className="border-[#ffe1c5] bg-white text-[#d86a11]">최근 {focusedChartDays}일</Badge>
                          </div>
                          <CardTitle className="font-aggro-display mt-3 text-[clamp(1rem,1.45vw,1.22rem)] font-black tracking-tight text-[#14295F]">계획 완수율 흐름</CardTitle>
                          <CardDescription className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">일별 완료율로 실행력이 흔들리는 구간을 확인합니다.</CardDescription>
                        </div>
                        <div className="rounded-[1rem] border border-[#ffe1c5] bg-[#fff8ef] px-3 py-2 text-right">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d86a11]">평균 완료율</p>
                          <p className="mt-1 text-lg font-black tracking-tight text-[#d86a11]">{avgCompletionRate}%</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {hasCompletionTrendData ? (
                        <div className="rounded-[1.25rem] border border-[#eef3ff] bg-white/90 p-2">
                          <div className="h-[276px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={completionTrendData} margin={chartMargin}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f2f2f2" />
                                <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: '#6b7ea6' }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: '#6b7ea6' }} tickLine={false} axisLine={false} width={32} domain={[0, 100]} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="completionRate" radius={[8, 8, 0, 0]} fill="#f59e0b" barSize={isMobile ? 12 : 14} />
                                <Line type="monotone" dataKey="completionRate" stroke="#b45309" strokeWidth={2.5} dot={{ r: 3, fill: '#fff7ed', stroke: '#b45309', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#fff7ed', stroke: '#b45309', strokeWidth: 2 }} />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-[1.25rem] border border-dashed border-[#dbe7ff] bg-white/80 px-4 py-8 text-center text-sm font-bold text-[#5c6e97]">완수율 데이터가 더 쌓이면 실행력을 더 정확하게 볼 수 있어요.</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="rounded-[1.6rem] border border-[#dbe7ff] bg-white shadow-[0_28px_70px_-56px_rgba(20,41,95,0.38)]">
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border border-[#dbe7ff] bg-[#f8fbff] text-[#14295F]">최근 기록</Badge>
                        <Badge variant="outline" className="border-[#dbe7ff] bg-white text-[#2554d4]">최근 7일</Badge>
                      </div>
                      <CardTitle className="font-aggro-display mt-3 text-[clamp(1rem,1.45vw,1.22rem)] font-black tracking-tight text-[#14295F]">짧게 읽는 실행 요약</CardTitle>
                      <CardDescription className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">오늘 공부량과 최근 기록을 함께 보면 실행 패턴이 더 선명하게 보여요.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
                        <div className="rounded-[1.1rem] border border-[#dbe7ff] bg-white/90 px-3.5 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2554d4]">오늘 공부</p>
                          <p className="font-aggro-display mt-2 text-lg font-black tracking-tight text-[#14295F]">{minutesToLabel(todayStudyMinutes)}</p>
                        </div>
                        <div className="rounded-[1.1rem] border border-[#ffe1c5] bg-[#fff8ef] px-3.5 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d86a11]">평균 완료율</p>
                          <p className="font-aggro-display mt-2 text-lg font-black tracking-tight text-[#d86a11]">{avgCompletionRate}%</p>
                        </div>
                        <div className="rounded-[1.1rem] border border-[#d5f2e7] bg-[#effcf6] px-3.5 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0f8f65]">연속 공부</p>
                          <p className="font-aggro-display mt-2 text-lg font-black tracking-tight text-[#0f8f65]">{studyStreakDays}일</p>
                        </div>
                      </div>
                      <div className="rounded-[1.2rem] border border-[#dbe7ff] bg-white/90 p-3.5">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2554d4]">최근 7일 기록</p>
                        <div className="mt-3 space-y-2.5">
                          {recentStudySessions.slice(0, 7).map((session) => (
                            <div key={session.dateKey} className="flex items-center justify-between gap-3 rounded-[1rem] border border-[#edf3ff] bg-[#f8fbff] px-3 py-2.5">
                              <div className="min-w-0">
                                <p className="text-[12px] font-black text-[#14295F]">{session.dateLabel}</p>
                                <p className="mt-1 text-[11px] font-semibold text-[#5c6e97]">{session.hasActualStudyLog ? '실제 공부 기록 반영' : '보정 기록 포함'}</p>
                              </div>
                              <p className="shrink-0 text-sm font-black text-[#17326B]">{minutesToLabel(session.minutes)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="rhythm" className="analysis-accordion-card overflow-hidden rounded-[1.45rem] px-4">
              <AccordionTrigger className="gap-4 py-4 text-left hover:no-underline">
                <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-aggro-display text-[1rem] font-black tracking-[-0.03em] text-[#14295F]">공부 리듬</p>
                    <p className="mt-1 text-[12px] font-semibold leading-5 text-[#5F7299]">{chartInsights.rhythm.trend}</p>
                  </div>
                  <SectionStateBadge ready={hasRhythmScoreOnlyTrend || hasStartEndTimeData} />
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-0 pt-1">
                <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]')}>
                  <Card className="rounded-[1.6rem] border border-[#dbe7ff] bg-white shadow-[0_28px_70px_-56px_rgba(20,41,95,0.38)]">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="border border-[#dbe7ff] bg-[#f8fbff] text-[#14295F]">리듬 분석</Badge>
                            <Badge variant="outline" className="border-[#d5f2e7] bg-white text-[#0f8f65]">최근 14일</Badge>
                          </div>
                          <CardTitle className="font-aggro-display mt-3 text-[clamp(1rem,1.45vw,1.22rem)] font-black tracking-tight text-[#14295F]">리듬 점수 그래프</CardTitle>
                          <CardDescription className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">시작 시간 흔들림을 점수로 바꿔 리듬 안정성을 봅니다.</CardDescription>
                        </div>
                        <div className="rounded-[1rem] border border-[#d5f2e7] bg-[#effcf6] px-3 py-2 text-right">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0f8f65]">평균 / 최신</p>
                          <p className="mt-1 text-lg font-black tracking-tight text-[#0f8f65]">{averageRhythmScore}점</p>
                          <p className="mt-1 text-[11px] font-semibold text-[#5c6e97]">최신 {latestRhythmScore}점</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div className="rounded-[1.25rem] border border-[#eef3ff] bg-white/90 p-2">
                          <div className="h-[276px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={rhythmScoreOnlyTrend} margin={chartMargin}>
                                <defs>
                                  <linearGradient id="studentAnalysisRhythmGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#17b777" stopOpacity={0.34} />
                                    <stop offset="100%" stopColor="#17b777" stopOpacity={0.04} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                                <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: '#6b7ea6' }} axisLine={false} tickLine={false} tickMargin={8} interval={1} />
                                <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: '#6b7ea6' }} axisLine={false} tickLine={false} width={30} domain={[0, 100]} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Area type="monotone" dataKey="score" stroke="#17b777" strokeWidth={2.6} fill="url(#studentAnalysisRhythmGradient)" dot={false} activeDot={{ r: 4.5, fill: '#17b777', stroke: '#ffffff', strokeWidth: 2 }} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        <div className="rounded-[1.1rem] border border-[#d5f2e7] bg-[#effcf6] px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0f8f65]">리듬 해석</p>
                          <p className="mt-2 text-sm font-black leading-6 text-[#14295F]">{chartInsights.rhythm.trend}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[1.6rem] border border-[#dbe7ff] bg-white shadow-[0_28px_70px_-56px_rgba(20,41,95,0.38)]">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="border border-[#dbe7ff] bg-[#f8fbff] text-[#14295F]">시간대 흐름</Badge>
                            <Badge variant="outline" className="border-[#eadfff] bg-white text-[#7d4ed8]">최근 14일</Badge>
                          </div>
                          <CardTitle className="font-aggro-display mt-3 text-[clamp(1rem,1.45vw,1.22rem)] font-black tracking-tight text-[#14295F]">공부 시작/종료 시각 추이</CardTitle>
                          <CardDescription className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">시작과 종료 시각으로 생활 리듬을 비교합니다.</CardDescription>
                        </div>
                        <div className="rounded-[1rem] border border-[#eadfff] bg-[#f6f0ff] px-3 py-2 text-right">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7d4ed8]">마지막 기록</p>
                          <p className="mt-1 text-sm font-black tracking-tight text-[#17326B]">{latestStartEndSnapshot.start} 시작</p>
                          <p className="mt-1 text-sm font-black tracking-tight text-[#7d4ed8]">{latestStartEndSnapshot.end} 종료</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div className="rounded-[1.25rem] border border-[#eef3ff] bg-white/90 p-2">
                          <div className="h-[276px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <RechartsLineChart data={startEndTimeTrendData} margin={chartMargin}>
                                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                                <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: '#6b7ea6' }} tickLine={false} axisLine={false} tickMargin={8} interval={1} />
                                <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: '#6b7ea6' }} tickLine={false} axisLine={false} width={40} domain={[0, 24]} tickFormatter={(value) => hourToClockLabel(Number(value))} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Line type="monotone" dataKey="startHour" stroke="#23a8ff" strokeWidth={2.6} dot={false} activeDot={{ r: 4.5, fill: '#23a8ff', stroke: '#ffffff', strokeWidth: 2 }} />
                                <Line type="monotone" dataKey="endHour" stroke="#8b5cf6" strokeWidth={2.6} dot={false} activeDot={{ r: 4.5, fill: '#8b5cf6', stroke: '#ffffff', strokeWidth: 2 }} />
                              </RechartsLineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        <div className="rounded-[1.1rem] border border-[#eadfff] bg-[#f6f0ff] px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7d4ed8]">시간대 해석</p>
                          <p className="mt-2 text-sm font-black leading-6 text-[#14295F]">{chartInsights.startEnd.trend}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="risk" className="analysis-accordion-card overflow-hidden rounded-[1.45rem] px-4">
              <AccordionTrigger className="gap-4 py-4 text-left hover:no-underline">
                <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-aggro-display text-[1rem] font-black tracking-[-0.03em] text-[#14295F]">생활 리스크</p>
                    <p className="mt-1 text-[12px] font-semibold leading-5 text-[#5F7299]">
                      {riskSignals.length === 0 ? '뚜렷한 위험 신호 없이 유지 중이에요.' : riskSignals[0]}
                    </p>
                  </div>
                  <SectionStateBadge ready={hasAwayTimeData || riskSignals.length > 0} />
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-0 pt-1">
                <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]')}>
                  <Card className="rounded-[1.6rem] border border-[#dbe7ff] bg-white shadow-[0_28px_70px_-56px_rgba(20,41,95,0.38)]">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="border border-[#dbe7ff] bg-[#f8fbff] text-[#14295F]">외출 흐름</Badge>
                            <Badge variant="outline" className="border-[#ffdbe2] bg-white text-[#dc4b74]">최근 14일</Badge>
                          </div>
                          <CardTitle className="font-aggro-display mt-3 text-[clamp(1rem,1.45vw,1.22rem)] font-black tracking-tight text-[#14295F]">학습 중간 외출시간 추이</CardTitle>
                          <CardDescription className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">외출이 집중 흐름을 얼마나 끊는지 확인합니다.</CardDescription>
                        </div>
                        <div className="rounded-[1rem] border border-[#ffdbe2] bg-[#fff2f5] px-3 py-2 text-right">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#dc4b74]">평균 외출</p>
                          <p className="mt-1 text-lg font-black tracking-tight text-[#dc4b74]">{averageAwayMinutes}분</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div className="rounded-[1.25rem] border border-[#eef3ff] bg-white/90 p-2">
                          <div className="h-[276px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={awayTimeData} margin={chartMargin}>
                                <defs>
                                  <linearGradient id="studentAnalysisAwayGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#ff8aa6" />
                                    <stop offset="70%" stopColor="#ffb0bc" />
                                    <stop offset="100%" stopColor="#ffe2e8" />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                                <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: '#6b7ea6' }} tickLine={false} axisLine={false} tickMargin={8} interval={1} />
                                <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: '#6b7ea6' }} tickLine={false} axisLine={false} width={32} tickFormatter={(value) => `${value}m`} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="awayMinutes" fill="url(#studentAnalysisAwayGradient)" radius={[10, 10, 4, 4]} maxBarSize={isMobile ? 14 : 18} />
                                <Line type="monotone" dataKey="awayMinutes" stroke="#ef476f" strokeWidth={2.6} dot={false} activeDot={{ r: 4.5, fill: '#ef476f', stroke: '#ffffff', strokeWidth: 2 }} />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        <div className="rounded-[1.1rem] border border-[#ffdbe2] bg-[#fff2f5] px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#dc4b74]">외출 해석</p>
                          <p className="mt-2 text-sm font-black leading-6 text-[#14295F]">{chartInsights.away.trend}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[1.6rem] border border-[#dbe7ff] bg-white shadow-[0_28px_70px_-56px_rgba(20,41,95,0.38)]">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-rose-500" />
                        <Badge className="border border-[#ffd7b6] bg-[#fff3e9] text-[#ff7a16]">지금 고치면 좋아요</Badge>
                      </div>
                      <CardTitle className="font-aggro-display mt-3 text-[clamp(1rem,1.45vw,1.22rem)] font-black tracking-tight text-[#14295F]">이번 주 우선 보완 포인트</CardTitle>
                      <CardDescription className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">위험 신호는 길게 보기보다, 지금 바로 고치면 좋은 것 한 가지로 압축해서 보는 편이 좋아요.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      <div className="rounded-xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2554d4]">보완 요약</p>
                        <p className="mt-1 text-sm font-black leading-6 text-[#14295F]">{summary.improvementDetail}</p>
                        <p className="mt-1 text-[12px] font-semibold leading-5 text-[#5c6e97]">최근 {focusedChartDays}일 평균 {minutesToLabel(avgStudyMinutes)} · 완료율 {avgCompletionRate}% · 리듬 점수 {rhythmScore}점</p>
                      </div>
                      {riskSignals.length === 0 ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                          현재 뚜렷한 위험 신호는 없습니다. 지금은 잘되는 패턴을 유지하는 전략이 더 중요해요.
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {riskSignals.map((signal) => (
                            <Badge key={signal} variant="outline" className="border-rose-200 bg-rose-50 font-black text-rose-600">
                              {signal}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </section>
  );
}
