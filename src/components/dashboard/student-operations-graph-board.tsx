'use client';

import { useState, type KeyboardEvent } from 'react';

import {
  Area,
  Bar,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  Activity,
  BadgeCheck,
  BellRing,
  Expand,
  MessageCircleMore,
  ShieldAlert,
  Users,
  WalletCards,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type StudentOperationsTimelinePoint = {
  dateKey: string;
  dateLabel: string;
  studyMinutes: number;
  completionRate: number;
  attendanceStatus:
    | 'confirmed_present'
    | 'confirmed_present_missing_routine'
    | 'confirmed_late'
    | 'confirmed_absent'
    | 'excused_absent'
    | 'requested';
  attendanceLabel: string;
  appVisits: number;
  reportReads: number;
  counselingCount: number;
  smsCount: number;
  reportCount: number;
  penaltyCount: number;
  penaltyPoints: number;
  requestCount: number;
  invoiceCount: number;
  invoiceAmount: number;
  guardianTouchCount: number;
  managementTouchCount: number;
  riskPulse: number;
};

type StudentOperationsGraphBoardProps = {
  timeline: StudentOperationsTimelinePoint[];
  isAdmin: boolean;
  isMobile: boolean;
  className?: string;
};

type ExpandedGraphKey = 'attendance' | 'study' | 'contact' | 'guardian' | 'risk' | 'billing';

type TooltipRow = {
  label: string;
  value: string;
  color: string;
};

const ATTENDANCE_STYLE = {
  confirmed_present: {
    label: '정상 등원',
    chip: 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
    block: 'bg-emerald-500',
  },
  confirmed_present_missing_routine: {
    label: '루틴 누락 등원',
    chip: 'bg-sky-500/15 text-sky-700 border-sky-200',
    block: 'bg-sky-500',
  },
  confirmed_late: {
    label: '지각',
    chip: 'bg-amber-500/15 text-amber-700 border-amber-200',
    block: 'bg-amber-500',
  },
  confirmed_absent: {
    label: '미출석',
    chip: 'bg-rose-500/15 text-rose-700 border-rose-200',
    block: 'bg-rose-500',
  },
  excused_absent: {
    label: '사유 결석',
    chip: 'bg-slate-500/15 text-slate-700 border-slate-200',
    block: 'bg-slate-500',
  },
  requested: {
    label: '기록 없음',
    chip: 'bg-slate-100 text-slate-600 border-slate-200',
    block: 'bg-slate-300',
  },
} as const;

function minutesToCompactLabel(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

function currencyLabel(amount: number): string {
  return `${Math.round(amount).toLocaleString()}원`;
}

function studyAxisTickLabel(value: number): string {
  const safe = Math.max(0, Math.round(Number(value) || 0));
  if (safe === 0) return '0';
  if (safe < 60) return `${safe}m`;
  const hours = safe / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function percentAxisTickLabel(value: number): string {
  return `${Math.round(Number(value) || 0)}%`;
}

function compactDateLabel(value: string): string {
  return value.replace('/', '.');
}

function CustomOperationsTooltip({
  active,
  label,
  rows,
}: {
  active?: boolean;
  label?: string;
  rows?: TooltipRow[];
}) {
  if (!active || !rows?.length) return null;

  return (
    <div className="rounded-[1rem] border border-[#dbe7ff] bg-white/95 px-3.5 py-3 shadow-[0_18px_40px_-28px_rgba(20,41,95,0.45)] backdrop-blur-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">{label}</p>
      <div className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
              <span className="text-[11px] font-black text-[#5c6e97]">{row.label}</span>
            </div>
            <span className="text-[11px] font-black text-[#14295F]">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StudentOperationsGraphBoard({
  timeline,
  isAdmin,
  isMobile,
  className,
}: StudentOperationsGraphBoardProps) {
  const [expandedGraph, setExpandedGraph] = useState<ExpandedGraphKey | null>(null);
  const safeTimeline = timeline.slice(-28);
  const hasTimeline = safeTimeline.length > 0;
  const attendanceRollup = safeTimeline.reduce(
    (acc, item) => {
      acc[item.attendanceStatus] += 1;
      return acc;
    },
    {
      confirmed_present: 0,
      confirmed_present_missing_routine: 0,
      confirmed_late: 0,
      confirmed_absent: 0,
      excused_absent: 0,
      requested: 0,
    } as Record<StudentOperationsTimelinePoint['attendanceStatus'], number>
  );
  const totalGuardianTouches = safeTimeline.reduce((sum, item) => sum + item.guardianTouchCount, 0);
  const totalManagementTouches = safeTimeline.reduce((sum, item) => sum + item.managementTouchCount, 0);
  const averageStudyMinutes = safeTimeline.length
    ? Math.round(safeTimeline.reduce((sum, item) => sum + item.studyMinutes, 0) / safeTimeline.length)
    : 0;
  const averageCompletionRate = safeTimeline.length
    ? Math.round(safeTimeline.reduce((sum, item) => sum + item.completionRate, 0) / safeTimeline.length)
    : 0;
  const totalSmsCount = safeTimeline.reduce((sum, item) => sum + item.smsCount, 0);
  const totalInvoiceAmount = safeTimeline.reduce((sum, item) => sum + item.invoiceAmount, 0);
  const peakRiskPulse = safeTimeline.reduce((max, item) => Math.max(max, item.riskPulse), 0);
  const latestPoint = safeTimeline[safeTimeline.length - 1];
  const latestStudyMinutes = latestPoint ? Math.round(latestPoint.studyMinutes) : 0;
  const latestCompletionRate = latestPoint ? Math.round(latestPoint.completionRate) : 0;
  const highestStudyMinutes = safeTimeline.reduce((max, item) => Math.max(max, item.studyMinutes), 0);
  const totalContactFlow = safeTimeline.reduce(
    (sum, item) => sum + item.counselingCount + item.reportCount + item.smsCount,
    0
  );
  const attendanceFocus = [
    {
      key: 'present',
      label: '정상',
      value: attendanceRollup.confirmed_present + attendanceRollup.confirmed_present_missing_routine,
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      key: 'late',
      label: '지각',
      value: attendanceRollup.confirmed_late,
      tone: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      key: 'absent',
      label: '미출석',
      value: attendanceRollup.confirmed_absent,
      tone: 'bg-rose-50 text-rose-700 border-rose-200',
    },
  ] as const;
  const headerMetrics = [
    { key: 'study', label: '평균 학습', value: minutesToCompactLabel(averageStudyMinutes) },
    { key: 'completion', label: '평균 완료율', value: `${averageCompletionRate}%` },
    { key: 'touch', label: '운영 접촉', value: `${totalManagementTouches}건` },
    { key: 'guardian', label: '보호자 반응', value: `${totalGuardianTouches}회` },
  ] as const;
  const headerSignals = [
    {
      key: 'present',
      label: '정상 등원',
      value: attendanceRollup.confirmed_present + attendanceRollup.confirmed_present_missing_routine,
      suffix: '건',
      tone: 'border-emerald-300/40 bg-emerald-400/12 text-emerald-50',
    },
    {
      key: 'late',
      label: '지각',
      value: attendanceRollup.confirmed_late,
      suffix: '건',
      tone: 'border-amber-300/40 bg-amber-300/12 text-amber-50',
    },
    {
      key: 'absent',
      label: '미출석',
      value: attendanceRollup.confirmed_absent,
      suffix: '건',
      tone: 'border-rose-300/40 bg-rose-300/12 text-rose-50',
    },
    {
      key: 'sms',
      label: '문자 접수',
      value: totalSmsCount,
      suffix: '건',
      tone: 'border-sky-300/40 bg-sky-300/12 text-sky-50',
    },
    {
      key: 'risk',
      label: '최고 위험도',
      value: peakRiskPulse,
      suffix: '점',
      tone: 'border-violet-300/40 bg-violet-300/12 text-violet-50',
    },
  ] as const;
  const panelCardClass =
    'group rounded-[1.9rem] border border-[#dbe7ff] bg-white/96 shadow-[0_24px_60px_-42px_rgba(20,41,95,0.34)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#c2d7ff] hover:shadow-[0_28px_68px_-42px_rgba(20,41,95,0.4)] motion-reduce:transform-none motion-reduce:transition-none';
  const chartFrameClass =
    'rounded-[1.45rem] border border-[#edf2fb] bg-[linear-gradient(180deg,#fbfdff_0%,#f5f8ff_100%)] p-3';
  const iconWrapClass =
    'flex h-8 w-8 items-center justify-center rounded-full border border-[#dbe7ff] bg-[#f5f8ff]';
  const clickableCardClass =
    'cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2554d4]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white';
  const compactChartMargin = { top: 8, right: 12, left: 8, bottom: 4 };
  const compactChartMarginWide = { top: 8, right: 14, left: 10, bottom: 4 };
  const expandedChartMargin = { top: 12, right: 18, left: 18, bottom: 8 };
  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>, key: ExpandedGraphKey) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setExpandedGraph(key);
    }
  };
  const expandedGraphMeta: Record<ExpandedGraphKey, { title: string; description: string }> = {
    attendance: {
      title: '출결 관리 스트립',
      description: '28일 출결 판단을 더 큰 레일로 읽고 날짜별 상태를 편하게 확인합니다.',
    },
    study: {
      title: '학습시간 · 계획 이행 동시 추적',
      description: '공부시간과 완료율 흐름을 큰 화면에서 함께 비교합니다.',
    },
    contact: {
      title: '운영 접촉 추이',
      description: '상담, 리포트, 문자를 날짜축에서 더 넓게 비교합니다.',
    },
    guardian: {
      title: '보호자 반응 추이',
      description: '앱 방문과 리포트 열람 흐름을 크게 보고 반응 온도를 읽습니다.',
    },
    risk: {
      title: '리스크 · 벌점 추이',
      description: '벌점, 출결 요청, 위험 펄스를 더 넓은 축에서 확인합니다.',
    },
    billing: {
      title: isAdmin ? '수납 · 보호자 반응' : '보호자 반응 · 문자 접수',
      description: isAdmin
        ? '청구 흐름과 보호자 반응을 큰 시간축에서 함께 읽습니다.'
        : '문자 접수와 보호자 반응을 큰 화면에서 같이 비교합니다.',
    },
  };
  const currentExpandedMeta = expandedGraph ? expandedGraphMeta[expandedGraph] : null;

  return (
    <div className={cn('space-y-4', className)}>
      <Card className="overflow-hidden rounded-[2rem] border-none bg-[linear-gradient(135deg,#14295F_0%,#173D8B_62%,#2554D4_100%)] shadow-[0_28px_70px_-42px_rgba(20,41,95,0.62)]">
        <CardContent className={cn('relative', isMobile ? 'p-4' : 'p-5')}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,122,22,0.22),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_28%)]" />
          <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                  운영 그래프 보드
                </Badge>
                <Badge className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black text-white/80">
                  최근 4주 기준
                </Badge>
              </div>
              <CardTitle className="text-[clamp(1.08rem,1.8vw,1.5rem)] font-black tracking-tight text-white">
                최근 4주 출결과 학습 흐름을 중심으로 운영 개입과 보호자 반응까지 함께 읽습니다.
              </CardTitle>
              <CardDescription className="max-w-3xl text-sm font-semibold leading-6 text-white/72">
                설명할 때는 한 장으로, 판단할 때는 출결과 학습을 먼저 볼 수 있게 위계를 다시 세웠습니다.
              </CardDescription>
            </div>

            <div className={cn('grid gap-2.5 xl:flex-none', isMobile ? 'grid-cols-2' : 'grid-cols-2 2xl:grid-cols-4')}>
              {headerMetrics.map((metric) => (
                <div
                  key={metric.key}
                  className="flex min-h-[5.5rem] min-w-0 flex-col justify-between rounded-[1rem] border border-white/12 bg-white/10 px-3.5 py-3 backdrop-blur-sm transition-colors duration-300 hover:bg-white/14 motion-reduce:transition-none"
                >
                  <p className="break-keep text-[10px] font-black leading-4 tracking-[0.14em] text-white/58">{metric.label}</p>
                  <p className="mt-2 break-keep text-[1.05rem] font-black leading-tight tracking-tight text-white sm:text-[1.15rem]">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-4 flex flex-wrap gap-2 border-t border-white/12 pt-4">
            {headerSignals.map((signal) => (
              <div
                key={signal.key}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[11px] font-black backdrop-blur-sm transition-colors duration-300 hover:bg-white/14 motion-reduce:transition-none',
                  signal.tone
                )}
              >
                <span className="opacity-78">{signal.label}</span>
                <span className="ml-2 text-white">{signal.value}{signal.suffix}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {!hasTimeline ? (
        <Card className="rounded-[1.75rem] border border-dashed border-[#dbe7ff] bg-white/80 shadow-sm">
          <CardContent className="px-5 py-8 text-center text-sm font-bold text-[#5c6e97]">
            최근 운영 그래프를 만들 데이터가 아직 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'lg:grid-cols-12')}>
            <Card
              className={cn(panelCardClass, clickableCardClass, !isMobile && 'lg:col-span-4')}
              role="button"
              tabIndex={0}
              aria-label="출결 관리 스트립 전체화면 보기"
              onClick={() => setExpandedGraph('attendance')}
              onKeyDown={(event) => handleCardKeyDown(event, 'attendance')}
            >
              <CardHeader className={cn(isMobile ? 'px-4 pt-4 pb-3' : 'px-5 pt-5 pb-3')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-[#14295F]">
                      <span className={iconWrapClass}>
                        <BadgeCheck className="h-4.5 w-4.5 text-emerald-500" />
                      </span>
                      출결 관리 스트립
                    </CardTitle>
                    <CardDescription className="text-[11px] font-semibold leading-5 text-[#5c6e97]">
                      28일 출결 판단을 색 레일로 압축해 빠르게 읽습니다.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-[#f8fbff] text-[10px] font-black text-[#2554d4]">
                    4주
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className={cn('space-y-4 pt-0', isMobile ? 'px-4 pb-4' : 'px-5 pb-5')}>
                <div className="grid grid-cols-3 gap-2">
                  {attendanceFocus.map((item) => (
                    <div key={item.key} className={cn('rounded-[1rem] border px-3 py-2.5', item.tone)}>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em]">{item.label}</p>
                      <p className="mt-1 text-sm font-black">{item.value}건</p>
                    </div>
                  ))}
                </div>

                <div className={chartFrameClass}>
                  <div className="grid grid-cols-7 gap-1.5">
                    {safeTimeline.map((item) => {
                      const tone = ATTENDANCE_STYLE[item.attendanceStatus];
                      return (
                        <div
                          key={item.dateKey}
                          className="rounded-[0.95rem] border border-[#e8eefb] bg-white px-1.5 py-2 text-center shadow-[0_10px_24px_-20px_rgba(20,41,95,0.28)]"
                        >
                          <div className={cn('mx-auto h-2 w-full rounded-full', tone.block)} />
                          <p className="mt-2 whitespace-nowrap text-[8px] font-black leading-none tracking-tight text-[#14295F]">{compactDateLabel(item.dateLabel)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(Object.entries(ATTENDANCE_STYLE) as Array<
                    [keyof typeof ATTENDANCE_STYLE, (typeof ATTENDANCE_STYLE)[keyof typeof ATTENDANCE_STYLE]]
                  >).map(([key, style]) => (
                    <Badge key={key} variant="outline" className={cn('rounded-full px-2.5 py-1 text-[10px] font-black', style.chip)}>
                      {style.label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(panelCardClass, clickableCardClass, !isMobile && 'lg:col-span-8')}
              role="button"
              tabIndex={0}
              aria-label="학습시간과 계획 이행 그래프 전체화면 보기"
              onClick={() => setExpandedGraph('study')}
              onKeyDown={(event) => handleCardKeyDown(event, 'study')}
            >
              <CardHeader className={cn(isMobile ? 'px-4 pt-4 pb-3' : 'px-5 pt-5 pb-3')}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1.5">
                    <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-[#14295F]">
                      <span className={iconWrapClass}>
                        <Activity className="h-4.5 w-4.5 text-[#2554d4]" />
                      </span>
                      학습시간 · 계획 이행 동시 추적
                    </CardTitle>
                    <CardDescription className="text-[11px] font-semibold leading-5 text-[#5c6e97]">
                      출결 다음으로 먼저 보는 메인 차트로 공부시간과 완료율을 함께 읽습니다.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-[#f8fbff] px-3 py-1 text-[10px] font-black text-[#2554d4]">
                      최근 학습 {minutesToCompactLabel(latestStudyMinutes)}
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-[#eadcff] bg-[#faf5ff] px-3 py-1 text-[10px] font-black text-[#7d4ed8]">
                      최근 완료율 {latestCompletionRate}%
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-white px-3 py-1 text-[10px] font-black text-[#14295F]">
                      최고 학습 {minutesToCompactLabel(highestStudyMinutes)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className={cn('pt-0', isMobile ? 'px-4 pb-4' : 'px-5 pb-5')}>
                <div className={cn(chartFrameClass, isMobile ? 'h-[240px]' : 'h-[320px]')}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={safeTimeline} margin={compactChartMarginWide}>
                      <defs>
                        <linearGradient id="operationsStudyGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f7cff" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#4f7cff" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#edf2fb" />
                      <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} />
                      <YAxis yAxisId="study" tickLine={false} axisLine={false} tickMargin={8} width={44} tickFormatter={studyAxisTickLabel} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} />
                      <YAxis yAxisId="completion" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} tickMargin={8} width={42} tickFormatter={percentAxisTickLabel} tick={{ fontSize: 10, fontWeight: 800, fill: '#7d4ed8' }} />
                      <Tooltip
                        content={({ active, label, payload }) => (
                          <CustomOperationsTooltip
                            active={active}
                            label={String(label || '')}
                            rows={[
                              {
                                label: '학습시간',
                                value: minutesToCompactLabel(Number(payload?.find((item) => item.dataKey === 'studyMinutes')?.value || 0)),
                                color: '#4f7cff',
                              },
                              {
                                label: '완료율',
                                value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'completionRate')?.value || 0))}%`,
                                color: '#7d4ed8',
                              },
                            ]}
                          />
                        )}
                      />
                      <Area yAxisId="study" type="monotone" dataKey="studyMinutes" stroke="#4f7cff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" fill="url(#operationsStudyGradient)" />
                      <Line yAxisId="completion" type="monotone" dataKey="completionRate" stroke="#7d4ed8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" dot={false} activeDot={{ r: 4, fill: '#7d4ed8', stroke: '#ffffff', strokeWidth: 2 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

          </div>

          <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'lg:grid-cols-3')}>
            <Card
              className={cn(panelCardClass, clickableCardClass)}
              role="button"
              tabIndex={0}
              aria-label="운영 접촉 추이 전체화면 보기"
              onClick={() => setExpandedGraph('contact')}
              onKeyDown={(event) => handleCardKeyDown(event, 'contact')}
            >
              <CardHeader className={cn(isMobile ? 'px-4 pt-4 pb-3' : 'px-5 pt-5 pb-3')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-[#14295F]">
                      <span className={iconWrapClass}>
                        <MessageCircleMore className="h-4.5 w-4.5 text-[#ff7a16]" />
                      </span>
                      운영 접촉 추이
                    </CardTitle>
                    <CardDescription className="text-[11px] font-semibold leading-5 text-[#5c6e97]">
                      상담, 리포트, 문자를 날짜축에서 함께 봅니다.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="rounded-full border-[#ffe0ca] bg-[#fff5ec] text-[10px] font-black text-[#c95a08]">
                    총 {totalContactFlow}건
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className={cn('pt-0', isMobile ? 'px-4 pb-4' : 'px-5 pb-5')}>
                <div className={cn(chartFrameClass, isMobile ? 'h-[210px]' : 'h-[220px]')}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={safeTimeline} margin={compactChartMargin}>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#edf2fb" />
                      <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} />
                      <YAxis tickLine={false} axisLine={false} tickMargin={8} width={36} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} />
                      <Tooltip
                        content={({ active, label, payload }) => (
                          <CustomOperationsTooltip
                            active={active}
                            label={String(label || '')}
                            rows={[
                              { label: '상담', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'counselingCount')?.value || 0))}건`, color: '#ff7a16' },
                              { label: '리포트', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'reportCount')?.value || 0))}건`, color: '#7d4ed8' },
                              { label: '문자', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'smsCount')?.value || 0))}건`, color: '#23a8ff' },
                            ]}
                          />
                        )}
                      />
                      <Line type="monotone" dataKey="counselingCount" stroke="#ff7a16" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" dot={false} />
                      <Line type="monotone" dataKey="reportCount" stroke="#7d4ed8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" dot={false} />
                      <Line type="monotone" dataKey="smsCount" stroke="#23a8ff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(panelCardClass, clickableCardClass)}
              role="button"
              tabIndex={0}
              aria-label="보호자 반응 추이 전체화면 보기"
              onClick={() => setExpandedGraph('guardian')}
              onKeyDown={(event) => handleCardKeyDown(event, 'guardian')}
            >
              <CardHeader className={cn(isMobile ? 'px-4 pt-4 pb-3' : 'px-5 pt-5 pb-3')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-[#14295F]">
                      <span className={iconWrapClass}>
                        <Users className="h-4.5 w-4.5 text-emerald-500" />
                      </span>
                      보호자 반응 추이
                    </CardTitle>
                    <CardDescription className="text-[11px] font-semibold leading-5 text-[#5c6e97]">
                      앱 방문과 리포트 열람으로 보호자 반응 온도를 봅니다.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="rounded-full border-[#d9f4ec] bg-[#effcf7] text-[10px] font-black text-emerald-700">
                    총 {totalGuardianTouches}회
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className={cn('pt-0', isMobile ? 'px-4 pb-4' : 'px-5 pb-5')}>
                <div className={cn(chartFrameClass, isMobile ? 'h-[210px]' : 'h-[220px]')}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={safeTimeline} margin={compactChartMargin}>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#edf2fb" />
                      <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} />
                      <YAxis tickLine={false} axisLine={false} tickMargin={8} width={36} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} />
                      <Tooltip
                        content={({ active, label, payload }) => (
                          <CustomOperationsTooltip
                            active={active}
                            label={String(label || '')}
                            rows={[
                              { label: '앱 방문', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'appVisits')?.value || 0))}회`, color: '#10b981' },
                              { label: '리포트 열람', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'reportReads')?.value || 0))}회`, color: '#4f7cff' },
                            ]}
                          />
                        )}
                      />
                      <Line type="monotone" dataKey="appVisits" stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" dot={false} />
                      <Line type="monotone" dataKey="reportReads" stroke="#4f7cff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(panelCardClass, clickableCardClass)}
              role="button"
              tabIndex={0}
              aria-label="리스크와 벌점 추이 전체화면 보기"
              onClick={() => setExpandedGraph('risk')}
              onKeyDown={(event) => handleCardKeyDown(event, 'risk')}
            >
              <CardHeader className={cn(isMobile ? 'px-4 pt-4 pb-3' : 'px-5 pt-5 pb-3')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-[#14295F]">
                      <span className={iconWrapClass}>
                        <ShieldAlert className="h-4.5 w-4.5 text-rose-500" />
                      </span>
                      리스크 · 벌점 추이
                    </CardTitle>
                    <CardDescription className="text-[11px] font-semibold leading-5 text-[#5c6e97]">
                      벌점, 출결 요청, 위험 펄스를 같은 레일에서 확인합니다.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="rounded-full border-[#f9d9e1] bg-[#fff5f8] text-[10px] font-black text-rose-700">
                    최고 {peakRiskPulse}점
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className={cn('pt-0', isMobile ? 'px-4 pb-4' : 'px-5 pb-5')}>
                <div className={cn(chartFrameClass, isMobile ? 'h-[210px]' : 'h-[220px]')}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={safeTimeline} margin={compactChartMargin}>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#edf2fb" />
                      <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} />
                      <YAxis yAxisId="count" tickLine={false} axisLine={false} tickMargin={8} width={36} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} />
                      <YAxis yAxisId="risk" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} tickMargin={8} width={40} tickFormatter={percentAxisTickLabel} tick={{ fontSize: 10, fontWeight: 800, fill: '#ef476f' }} />
                      <Tooltip
                        content={({ active, label, payload }) => (
                          <CustomOperationsTooltip
                            active={active}
                            label={String(label || '')}
                            rows={[
                              { label: '벌점 건수', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'penaltyCount')?.value || 0))}건`, color: '#ef476f' },
                              { label: '출결 요청', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'requestCount')?.value || 0))}건`, color: '#ff9b24' },
                              { label: '위험 펄스', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'riskPulse')?.value || 0))}점`, color: '#7d4ed8' },
                            ]}
                          />
                        )}
                      />
                      <Bar yAxisId="count" dataKey="penaltyCount" fill="#fda4af" radius={[8, 8, 2, 2]} maxBarSize={16} />
                      <Bar yAxisId="count" dataKey="requestCount" fill="#fdba74" radius={[8, 8, 2, 2]} maxBarSize={16} />
                      <Line yAxisId="risk" type="monotone" dataKey="riskPulse" stroke="#7d4ed8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card
            className={cn(panelCardClass, clickableCardClass)}
            role="button"
            tabIndex={0}
            aria-label={isAdmin ? '수납과 보호자 반응 그래프 전체화면 보기' : '보호자 반응과 문자 접수 그래프 전체화면 보기'}
            onClick={() => setExpandedGraph('billing')}
            onKeyDown={(event) => handleCardKeyDown(event, 'billing')}
          >
            <CardHeader className={cn(isMobile ? 'px-4 pt-4 pb-3' : 'px-5 pt-5 pb-3')}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-[#14295F]">
                    <span className={iconWrapClass}>
                      {isAdmin ? (
                        <WalletCards className="h-4.5 w-4.5 text-emerald-500" />
                      ) : (
                        <BellRing className="h-4.5 w-4.5 text-[#2554d4]" />
                      )}
                    </span>
                    {isAdmin ? '수납 · 보호자 반응' : '보호자 반응 · 문자 접수'}
                  </CardTitle>
                  <CardDescription className="text-[11px] font-semibold leading-5 text-[#5c6e97]">
                    {isAdmin
                      ? '청구 흐름과 보호자 반응을 같은 시간축에서 보며 운영 설명력을 높입니다.'
                      : '문자 접수와 보호자 반응을 같은 시간축으로 두고 관리 흐름을 설명합니다.'}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isAdmin ? (
                    <>
                      <Badge variant="outline" className="rounded-full border-[#d9f4ec] bg-[#effcf7] px-3 py-1 text-[10px] font-black text-emerald-700">
                        총 청구액 {currencyLabel(totalInvoiceAmount)}
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-[#f8fbff] px-3 py-1 text-[10px] font-black text-[#2554d4]">
                        보호자 반응 {totalGuardianTouches}회
                      </Badge>
                    </>
                  ) : (
                    <>
                      <Badge variant="outline" className="rounded-full border-[#d9ecff] bg-[#f3f8ff] px-3 py-1 text-[10px] font-black text-sky-700">
                        문자 접수 {totalSmsCount}건
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-[#f8fbff] px-3 py-1 text-[10px] font-black text-[#2554d4]">
                        보호자 반응 {totalGuardianTouches}회
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className={cn('pt-0', isMobile ? 'px-4 pb-4' : 'px-5 pb-5')}>
              <div className={cn(chartFrameClass, isMobile ? 'h-[220px]' : 'h-[260px]')}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={safeTimeline} margin={compactChartMarginWide}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#edf2fb" />
                    <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} />
                    {isAdmin ? (
                      <>
                        <YAxis yAxisId="billing" tickLine={false} axisLine={false} tickMargin={8} width={50} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                        <YAxis yAxisId="touch" orientation="right" tickLine={false} axisLine={false} tickMargin={8} width={40} tick={{ fontSize: 10, fontWeight: 800, fill: '#10b981' }} />
                        <Tooltip
                          content={({ active, label, payload }) => (
                            <CustomOperationsTooltip
                              active={active}
                              label={String(label || '')}
                              rows={[
                                { label: '청구 금액', value: currencyLabel(Number(payload?.find((item) => item.dataKey === 'invoiceAmount')?.value || 0)), color: '#10b981' },
                                { label: '청구 건수', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'invoiceCount')?.value || 0))}건`, color: '#22c55e' },
                                { label: '보호자 반응', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'guardianTouchCount')?.value || 0))}회`, color: '#4f7cff' },
                              ]}
                          />
                        )}
                      />
                      <Bar yAxisId="billing" dataKey="invoiceAmount" fill="#86efac" radius={[8, 8, 2, 2]} maxBarSize={24} />
                        <Line yAxisId="touch" type="monotone" dataKey="guardianTouchCount" stroke="#4f7cff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" dot={false} />
                      </>
                    ) : (
                      <>
                        <YAxis yAxisId="sms" tickLine={false} axisLine={false} tickMargin={8} width={36} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} />
                        <Tooltip
                          content={({ active, label, payload }) => (
                            <CustomOperationsTooltip
                              active={active}
                              label={String(label || '')}
                              rows={[
                                { label: '문자 접수', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'smsCount')?.value || 0))}건`, color: '#23a8ff' },
                                { label: '보호자 반응', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'guardianTouchCount')?.value || 0))}회`, color: '#4f7cff' },
                              ]}
                          />
                        )}
                      />
                        <Bar yAxisId="sms" dataKey="smsCount" fill="#7dd3fc" radius={[8, 8, 2, 2]} maxBarSize={22} />
                        <Line yAxisId="sms" type="monotone" dataKey="guardianTouchCount" stroke="#4f7cff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" dot={false} />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={expandedGraph !== null} onOpenChange={(open) => !open && setExpandedGraph(null)}>
        <DialogContent className="!left-0 !top-0 h-dvh w-screen max-w-none !translate-x-0 !translate-y-0 rounded-none border-none bg-[linear-gradient(180deg,#F7FAFF_0%,#FFFFFF_100%)] p-0 shadow-none">
          <div className="flex h-full flex-col">
            <div className="border-b border-[#dbe7ff] bg-[linear-gradient(135deg,#14295F_0%,#173D8B_62%,#2554D4_100%)] px-5 py-5 text-white sm:px-7 sm:py-6">
              <DialogHeader className="space-y-3 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                    <Expand className="mr-1 h-3.5 w-3.5" />
                    그래프 확대
                  </Badge>
                  <Badge className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black text-white/82">
                    최근 4주 기준
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  <DialogTitle className="text-[1.4rem] font-black tracking-tight text-white sm:text-[1.8rem]">
                    {currentExpandedMeta?.title}
                  </DialogTitle>
                  <DialogDescription className="max-w-4xl text-sm font-semibold leading-6 text-white/78">
                    {currentExpandedMeta?.description}
                  </DialogDescription>
                </div>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              {expandedGraph === 'attendance' && (
                <Card className="rounded-[2rem] border border-[#dbe7ff] bg-white/96 shadow-[0_28px_68px_-42px_rgba(20,41,95,0.28)]">
                  <CardContent className="space-y-5 p-5 sm:p-6">
                    <div className="grid grid-cols-3 gap-3 sm:max-w-md">
                      {attendanceFocus.map((item) => (
                        <div key={item.key} className={cn('rounded-[1rem] border px-3 py-3', item.tone)}>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em]">{item.label}</p>
                          <p className="mt-1.5 text-base font-black">{item.value}건</p>
                        </div>
                      ))}
                    </div>

                    <div className={cn(chartFrameClass, 'p-4')}>
                      <div className="grid grid-cols-7 gap-2.5">
                        {safeTimeline.map((item) => {
                          const tone = ATTENDANCE_STYLE[item.attendanceStatus];
                          return (
                            <div
                              key={item.dateKey}
                              className="rounded-[1rem] border border-[#e8eefb] bg-white px-2 py-3 text-center shadow-[0_14px_28px_-24px_rgba(20,41,95,0.28)]"
                            >
                              <div className={cn('mx-auto h-2.5 w-full rounded-full', tone.block)} />
                              <p className="mt-3 whitespace-nowrap text-[10px] font-black tracking-tight text-[#14295F]">
                                {compactDateLabel(item.dateLabel)}
                              </p>
                              <p className="mt-1 text-[10px] font-bold text-[#5c6e97]">{tone.label}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(Object.entries(ATTENDANCE_STYLE) as Array<
                        [keyof typeof ATTENDANCE_STYLE, (typeof ATTENDANCE_STYLE)[keyof typeof ATTENDANCE_STYLE]]
                      >).map(([key, style]) => (
                        <Badge key={key} variant="outline" className={cn('rounded-full px-2.5 py-1 text-[10px] font-black', style.chip)}>
                          {style.label}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {expandedGraph === 'study' && (
                <Card className="rounded-[2rem] border border-[#dbe7ff] bg-white/96 shadow-[0_28px_68px_-42px_rgba(20,41,95,0.28)]">
                  <CardContent className="space-y-4 p-5 sm:p-6">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-[#f8fbff] px-3 py-1 text-[10px] font-black text-[#2554d4]">
                        최근 학습 {minutesToCompactLabel(latestStudyMinutes)}
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-[#eadcff] bg-[#faf5ff] px-3 py-1 text-[10px] font-black text-[#7d4ed8]">
                        최근 완료율 {latestCompletionRate}%
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-white px-3 py-1 text-[10px] font-black text-[#14295F]">
                        최고 학습 {minutesToCompactLabel(highestStudyMinutes)}
                      </Badge>
                    </div>
                    <div className={cn(chartFrameClass, 'h-[min(72vh,42rem)] p-4')}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={safeTimeline} margin={expandedChartMargin}>
                          <defs>
                            <linearGradient id="operationsStudyGradientExpanded" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#4f7cff" stopOpacity={0.35} />
                              <stop offset="100%" stopColor="#4f7cff" stopOpacity={0.04} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#edf2fb" />
                          <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} tickMargin={10} minTickGap={14} tick={{ fontSize: 11, fontWeight: 800, fill: '#6a7da6' }} />
                          <YAxis yAxisId="study" tickLine={false} axisLine={false} tickMargin={10} width={56} tickFormatter={studyAxisTickLabel} tick={{ fontSize: 11, fontWeight: 800, fill: '#6a7da6' }} />
                          <YAxis yAxisId="completion" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} tickMargin={10} width={54} tickFormatter={percentAxisTickLabel} tick={{ fontSize: 11, fontWeight: 800, fill: '#7d4ed8' }} />
                          <Tooltip
                            content={({ active, label, payload }) => (
                              <CustomOperationsTooltip
                                active={active}
                                label={String(label || '')}
                                rows={[
                                  {
                                    label: '학습시간',
                                    value: minutesToCompactLabel(Number(payload?.find((item) => item.dataKey === 'studyMinutes')?.value || 0)),
                                    color: '#4f7cff',
                                  },
                                  {
                                    label: '완료율',
                                    value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'completionRate')?.value || 0))}%`,
                                    color: '#7d4ed8',
                                  },
                                ]}
                              />
                            )}
                          />
                          <Area yAxisId="study" type="monotone" dataKey="studyMinutes" stroke="#4f7cff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="url(#operationsStudyGradientExpanded)" />
                          <Line yAxisId="completion" type="monotone" dataKey="completionRate" stroke="#7d4ed8" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" dot={false} activeDot={{ r: 5, fill: '#7d4ed8', stroke: '#ffffff', strokeWidth: 2 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {expandedGraph === 'contact' && (
                <Card className="rounded-[2rem] border border-[#dbe7ff] bg-white/96 shadow-[0_28px_68px_-42px_rgba(20,41,95,0.28)]">
                  <CardContent className="space-y-4 p-5 sm:p-6">
                    <Badge variant="outline" className="w-fit rounded-full border-[#ffe0ca] bg-[#fff5ec] px-3 py-1 text-[10px] font-black text-[#c95a08]">
                      총 {totalContactFlow}건
                    </Badge>
                    <div className={cn(chartFrameClass, 'h-[min(72vh,38rem)] p-4')}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={safeTimeline} margin={expandedChartMargin}>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#edf2fb" />
                          <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} tickMargin={10} minTickGap={14} tick={{ fontSize: 11, fontWeight: 800, fill: '#6a7da6' }} />
                          <YAxis tickLine={false} axisLine={false} tickMargin={10} width={44} tick={{ fontSize: 11, fontWeight: 800, fill: '#6a7da6' }} />
                          <Tooltip
                            content={({ active, label, payload }) => (
                              <CustomOperationsTooltip
                                active={active}
                                label={String(label || '')}
                                rows={[
                                  { label: '상담', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'counselingCount')?.value || 0))}건`, color: '#ff7a16' },
                                  { label: '리포트', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'reportCount')?.value || 0))}건`, color: '#7d4ed8' },
                                  { label: '문자', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'smsCount')?.value || 0))}건`, color: '#23a8ff' },
                                ]}
                              />
                            )}
                          />
                          <Line type="monotone" dataKey="counselingCount" stroke="#ff7a16" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" dot={false} />
                          <Line type="monotone" dataKey="reportCount" stroke="#7d4ed8" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" dot={false} />
                          <Line type="monotone" dataKey="smsCount" stroke="#23a8ff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {expandedGraph === 'guardian' && (
                <Card className="rounded-[2rem] border border-[#dbe7ff] bg-white/96 shadow-[0_28px_68px_-42px_rgba(20,41,95,0.28)]">
                  <CardContent className="space-y-4 p-5 sm:p-6">
                    <Badge variant="outline" className="w-fit rounded-full border-[#d9f4ec] bg-[#effcf7] px-3 py-1 text-[10px] font-black text-emerald-700">
                      총 {totalGuardianTouches}회
                    </Badge>
                    <div className={cn(chartFrameClass, 'h-[min(72vh,38rem)] p-4')}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={safeTimeline} margin={expandedChartMargin}>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#edf2fb" />
                          <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} tickMargin={10} minTickGap={14} tick={{ fontSize: 11, fontWeight: 800, fill: '#6a7da6' }} />
                          <YAxis tickLine={false} axisLine={false} tickMargin={10} width={44} tick={{ fontSize: 11, fontWeight: 800, fill: '#6a7da6' }} />
                          <Tooltip
                            content={({ active, label, payload }) => (
                              <CustomOperationsTooltip
                                active={active}
                                label={String(label || '')}
                                rows={[
                                  { label: '앱 방문', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'appVisits')?.value || 0))}회`, color: '#10b981' },
                                  { label: '리포트 열람', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'reportReads')?.value || 0))}회`, color: '#4f7cff' },
                                ]}
                              />
                            )}
                          />
                          <Line type="monotone" dataKey="appVisits" stroke="#10b981" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" dot={false} />
                          <Line type="monotone" dataKey="reportReads" stroke="#4f7cff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {expandedGraph === 'risk' && (
                <Card className="rounded-[2rem] border border-[#dbe7ff] bg-white/96 shadow-[0_28px_68px_-42px_rgba(20,41,95,0.28)]">
                  <CardContent className="space-y-4 p-5 sm:p-6">
                    <Badge variant="outline" className="w-fit rounded-full border-[#f9d9e1] bg-[#fff5f8] px-3 py-1 text-[10px] font-black text-rose-700">
                      최고 {peakRiskPulse}점
                    </Badge>
                    <div className={cn(chartFrameClass, 'h-[min(72vh,38rem)] p-4')}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={safeTimeline} margin={expandedChartMargin}>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#edf2fb" />
                          <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} tickMargin={10} minTickGap={14} tick={{ fontSize: 11, fontWeight: 800, fill: '#6a7da6' }} />
                          <YAxis yAxisId="count" tickLine={false} axisLine={false} tickMargin={10} width={44} tick={{ fontSize: 11, fontWeight: 800, fill: '#6a7da6' }} />
                          <YAxis yAxisId="risk" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} tickMargin={10} width={52} tickFormatter={percentAxisTickLabel} tick={{ fontSize: 11, fontWeight: 800, fill: '#ef476f' }} />
                          <Tooltip
                            content={({ active, label, payload }) => (
                              <CustomOperationsTooltip
                                active={active}
                                label={String(label || '')}
                                rows={[
                                  { label: '벌점 건수', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'penaltyCount')?.value || 0))}건`, color: '#ef476f' },
                                  { label: '출결 요청', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'requestCount')?.value || 0))}건`, color: '#ff9b24' },
                                  { label: '위험 펄스', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'riskPulse')?.value || 0))}점`, color: '#7d4ed8' },
                                ]}
                              />
                            )}
                          />
                          <Bar yAxisId="count" dataKey="penaltyCount" fill="#fda4af" radius={[8, 8, 2, 2]} maxBarSize={20} />
                          <Bar yAxisId="count" dataKey="requestCount" fill="#fdba74" radius={[8, 8, 2, 2]} maxBarSize={20} />
                          <Line yAxisId="risk" type="monotone" dataKey="riskPulse" stroke="#7d4ed8" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" dot={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {expandedGraph === 'billing' && (
                <Card className="rounded-[2rem] border border-[#dbe7ff] bg-white/96 shadow-[0_28px_68px_-42px_rgba(20,41,95,0.28)]">
                  <CardContent className="space-y-4 p-5 sm:p-6">
                    <div className="flex flex-wrap gap-2">
                      {isAdmin ? (
                        <>
                          <Badge variant="outline" className="rounded-full border-[#d9f4ec] bg-[#effcf7] px-3 py-1 text-[10px] font-black text-emerald-700">
                            총 청구액 {currencyLabel(totalInvoiceAmount)}
                          </Badge>
                          <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-[#f8fbff] px-3 py-1 text-[10px] font-black text-[#2554d4]">
                            보호자 반응 {totalGuardianTouches}회
                          </Badge>
                        </>
                      ) : (
                        <>
                          <Badge variant="outline" className="rounded-full border-[#d9ecff] bg-[#f3f8ff] px-3 py-1 text-[10px] font-black text-sky-700">
                            문자 접수 {totalSmsCount}건
                          </Badge>
                          <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-[#f8fbff] px-3 py-1 text-[10px] font-black text-[#2554d4]">
                            보호자 반응 {totalGuardianTouches}회
                          </Badge>
                        </>
                      )}
                    </div>
                    <div className={cn(chartFrameClass, 'h-[min(72vh,40rem)] p-4')}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={safeTimeline} margin={expandedChartMargin}>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#edf2fb" />
                          <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} tickMargin={10} minTickGap={14} tick={{ fontSize: 11, fontWeight: 800, fill: '#6a7da6' }} />
                          {isAdmin ? (
                            <>
                              <YAxis yAxisId="billing" tickLine={false} axisLine={false} tickMargin={10} width={64} tick={{ fontSize: 11, fontWeight: 800, fill: '#6a7da6' }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                              <YAxis yAxisId="touch" orientation="right" tickLine={false} axisLine={false} tickMargin={10} width={48} tick={{ fontSize: 11, fontWeight: 800, fill: '#10b981' }} />
                              <Tooltip
                                content={({ active, label, payload }) => (
                                  <CustomOperationsTooltip
                                    active={active}
                                    label={String(label || '')}
                                    rows={[
                                      { label: '청구 금액', value: currencyLabel(Number(payload?.find((item) => item.dataKey === 'invoiceAmount')?.value || 0)), color: '#10b981' },
                                      { label: '청구 건수', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'invoiceCount')?.value || 0))}건`, color: '#22c55e' },
                                      { label: '보호자 반응', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'guardianTouchCount')?.value || 0))}회`, color: '#4f7cff' },
                                    ]}
                                  />
                                )}
                              />
                              <Bar yAxisId="billing" dataKey="invoiceAmount" fill="#86efac" radius={[8, 8, 2, 2]} maxBarSize={28} />
                              <Line yAxisId="touch" type="monotone" dataKey="guardianTouchCount" stroke="#4f7cff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" dot={false} />
                            </>
                          ) : (
                            <>
                              <YAxis yAxisId="sms" tickLine={false} axisLine={false} tickMargin={10} width={44} tick={{ fontSize: 11, fontWeight: 800, fill: '#6a7da6' }} />
                              <Tooltip
                                content={({ active, label, payload }) => (
                                  <CustomOperationsTooltip
                                    active={active}
                                    label={String(label || '')}
                                    rows={[
                                      { label: '문자 접수', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'smsCount')?.value || 0))}건`, color: '#23a8ff' },
                                      { label: '보호자 반응', value: `${Math.round(Number(payload?.find((item) => item.dataKey === 'guardianTouchCount')?.value || 0))}회`, color: '#4f7cff' },
                                    ]}
                                  />
                                )}
                              />
                              <Bar yAxisId="sms" dataKey="smsCount" fill="#7dd3fc" radius={[8, 8, 2, 2]} maxBarSize={24} />
                              <Line yAxisId="sms" type="monotone" dataKey="guardianTouchCount" stroke="#4f7cff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" dot={false} />
                            </>
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
