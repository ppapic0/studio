'use client';

import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, LineChart as RechartsLineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Student360Domain = 'learning' | 'attendance' | 'risk' | 'guardian' | 'reports' | 'sms' | 'billing';

export type Student360OverviewDashboardProps = {
  canViewBilling: boolean;
  isMobile: boolean;
  presentationMode?: 'default' | 'student-analysis';
  selectedDomain: Student360Domain;
  onSelectDomain: (domain: Student360Domain) => void;
  selectedDomainTitle: string;
  selectedDomainBody: string;
  selectedDomainAction: string;
  riskHeadline: string;
  guardianLinkLabel: string;
  guardianVisitCount30d: number;
  reportReadCount30d: number;
  latestCounselingLabel: string;
  latestReservationLabel: string;
  smsStatusLabel: string;
  latestReportLabel: string;
  invoiceStatusSummary: string;
  latestInvoicePaymentLabel: string;
  studentRiskScore: number;
  penaltyPoints: number;
  routineMissingCount30d: number;
  overviewQuickPoints: string[];
  overviewStudyTrend30d: Array<{ dateLabel: string; studyMinutes: number }>;
  hasOverviewStudyTrend: boolean;
  todayStudyLabel: string;
  recent7AverageLabel: string;
  latestWeeklyGrowthLabel: string;
  overviewAttendanceStrip30d: Array<{ dateKey: string; dateLabel: string; status?: string; statusLabel: string; stripClass: string; lateMinutes: number; awayCount: number; studyMinutes: number; hasCheckOut: boolean }>;
  hasOverviewAttendanceTrend: boolean;
  hasStartEndTimeData: boolean;
  startEndTimeTrendData: Array<{ dateLabel: string; startHour: number; endHour: number }>;
  latestStartLabel: string;
  latestEndLabel: string;
  averageRhythmScore: number;
  hasOverviewAwayTrend: boolean;
  overviewAwayTrend14d: Array<{ dateLabel: string; awayMinutes: number; awayCount: number }>;
  avgAwayMinutesLabel: string;
  attendanceAwayCount30d: number;
  checkOutStability30d: number;
  hasOverviewPlanTrend: boolean;
  overviewPlanTrend30d: Array<{ dateLabel: string; completionRate: number; routineDone: number; routineExpected: number }>;
  avgCompletionRate: number;
  todayRoutineCount: number;
  rhythmScore: number;
  hasOverviewCommunicationTrend: boolean;
  overviewCommunicationTrend30d: Array<{ dateLabel: string; counseling: number; reports: number; sms: number }>;
  counselingCount: number;
  reportCount: number;
  smsCount: number;
  hasOverviewRiskTrend: boolean;
  overviewRiskTrend30d: Array<{ dateLabel: string; riskScore: number; cumulativePenalty: number }>;
  resilience: number;
  hasOverviewGuardianBillingTrend: boolean;
  overviewGuardianBillingTrend30d: Array<{ dateLabel: string; guardianActivity: number; reportReads: number; billing: number }>;
};

function hourTickFormatter(value: number): string {
  if (!Number.isFinite(value)) return '0h';
  const safeMinutes = Math.max(0, Math.round(value * 60));
  if (safeMinutes < 60) return `${safeMinutes}m`;
  const hours = safeMinutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

function hourToClockLabel(value: number): string {
  if (!Number.isFinite(value)) return '-';
  const normalized = Math.max(0, Math.min(24, value));
  const totalMinutes = Math.round(normalized * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function SingleValueTooltip({ active, payload, label, unit = '분', presentationMode = 'default' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className={cn(
        presentationMode === 'student-analysis'
          ? 'rounded-[1.15rem] border-none bg-white px-3.5 py-3 shadow-[0_22px_36px_-28px_rgba(20,41,95,0.46)]'
          : 'rounded-2xl border border-primary/10 bg-white/95 px-4 py-3 shadow-xl ring-1 ring-black/5'
      )}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6a7da6]">{label}</p>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-black text-[#14295F]">{payload[0].value}</span>
        <span className="text-xs font-black text-[#5c6e97]">{unit}</span>
      </div>
    </div>
  );
}

function MultiSeriesTooltip({
  active,
  payload,
  label,
  presentationMode = 'default',
  series,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; name?: string; value?: number }>;
  label?: string;
  presentationMode?: 'default' | 'student-analysis';
  series: Array<{ dataKey: string; label: string; color: string; formatter: (value: number) => string }>;
}) {
  if (!active || !payload?.length) return null;
  const items = series
    .map((item) => {
      const target = payload.find((payloadItem) => payloadItem?.dataKey === item.dataKey || payloadItem?.name === item.dataKey);
      if (!target || typeof target.value !== 'number') return null;
      return { ...item, value: target.value };
    })
    .filter((item): item is { dataKey: string; label: string; color: string; formatter: (value: number) => string; value: number } => Boolean(item));

  if (!items.length) return null;

  return (
    <div
      className={cn(
        presentationMode === 'student-analysis'
          ? 'rounded-[1.15rem] border-none bg-white px-3.5 py-3 shadow-[0_22px_36px_-28px_rgba(20,41,95,0.46)]'
          : 'rounded-2xl border border-primary/10 bg-white/95 px-4 py-3 shadow-xl ring-1 ring-black/5'
      )}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6a7da6]">{label}</p>
      <div className="mt-2 space-y-1.5">
        {items.map((item) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="truncate text-[11px] font-black tracking-[0.12em] text-[#6a7da6]">{item.label}</span>
            </div>
            <span className="shrink-0 text-sm font-black text-[#14295F]">{item.formatter(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Student360OverviewDashboard(props: Student360OverviewDashboardProps) {
  const isHighlighted = (...domains: Student360Domain[]) => domains.includes(props.selectedDomain);
  const cardClass = (highlighted: boolean) =>
    cn(
      'overflow-hidden rounded-[1.65rem] border bg-white shadow-lg transition-all',
      highlighted ? 'border-primary/35 ring-2 ring-primary/10 shadow-[0_24px_60px_-46px_rgba(37,84,212,0.35)]' : 'border-slate-200/80'
    );
  const metricPanelClass = 'relative rounded-[1.3rem] border border-slate-100 bg-white/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]';
  const chartHeaderClass = cn('relative z-10', props.isMobile ? 'px-4 pt-4 pb-3' : 'px-5 pt-5 pb-4');
  const chartContentClass = cn('relative z-10 pt-0', props.isMobile ? 'px-4 pb-4' : 'px-5 pb-5');
  const guardianBillingSeries = [
    { dataKey: 'guardianActivity', label: '보호자 반응', color: '#7c3aed', formatter: (value: number) => `${Math.round(value)}회` },
    { dataKey: 'reportReads', label: '리포트 열람', color: '#10b981', formatter: (value: number) => `${Math.round(value)}회` },
    ...(props.canViewBilling
      ? [{ dataKey: 'billing', label: '청구/결제', color: '#0ea5e9', formatter: (value: number) => `${Math.round(value)}건` }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
        <Card className="rounded-[1.8rem] border-none shadow-lg bg-[linear-gradient(180deg,#ffffff_0%,#f6f9ff_100%)]">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base font-black tracking-tight">학생 360 운영 브리프</CardTitle>
                <CardDescription className="mt-1 text-[11px] font-bold">개요 탭에서 학습, 출결, 상담, 문자, 리스크{props.canViewBilling ? ', 수납' : ''} 흐름을 먼저 읽습니다.</CardDescription>
              </div>
              <Badge className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-black text-white">{props.selectedDomainTitle} 포커스</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-primary/10 bg-white px-4 py-4">
              <p className="text-sm font-black text-slate-900">{props.riskHeadline}</p>
              <p className="mt-2 text-xs font-semibold leading-6 text-slate-700">{props.selectedDomainBody}</p>
              <div className="mt-3 rounded-xl bg-muted/30 px-3 py-3 text-xs font-bold leading-6 text-slate-700">{props.selectedDomainAction}</div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {props.overviewQuickPoints.length > 0 ? props.overviewQuickPoints.map((item) => (
                <div key={item} className="rounded-2xl border border-border/60 bg-white px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary/60">즉시 개입</p>
                  <p className="mt-2 text-xs font-semibold leading-6 text-slate-700">{item}</p>
                </div>
              )) : (
                <div className="rounded-2xl border border-border/60 bg-white px-4 py-3 md:col-span-3">
                  <p className="text-xs font-semibold leading-6 text-slate-700">오늘은 큰 경고보다 루틴 유지와 학습 페이스 점검이 우선입니다.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.8rem] border-none shadow-lg bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-black tracking-tight">운영 체크 포인트</CardTitle>
            <CardDescription className="mt-1 text-[11px] font-bold">보호자, 상담, 문자, 리포트, 수납 상태를 지금 기준으로 빠르게 봅니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary/60">학부모 연결</p>
                <p className="mt-2 text-sm font-black text-slate-900">{props.guardianLinkLabel}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">방문 {props.guardianVisitCount30d}회 · 열람 {props.reportReadCount30d}회</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary/60">문자/리포트</p>
                <p className="mt-2 text-sm font-black text-slate-900">{props.smsStatusLabel}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{props.latestReportLabel}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary/60">최근 상담</p>
                <p className="mt-2 text-sm font-black text-slate-900">{props.latestCounselingLabel}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{props.latestReservationLabel}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary/60">{props.canViewBilling ? '수납 상태' : '리스크 상태'}</p>
                <p className="mt-2 text-sm font-black text-slate-900">{props.canViewBilling ? props.invoiceStatusSummary : `${props.studentRiskScore}점`}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{props.canViewBilling ? props.latestInvoicePaymentLabel : `벌점 ${props.penaltyPoints}점 · 루틴누락 ${props.routineMissingCount30d}회`}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/10 px-4 py-3 text-xs font-semibold leading-6 text-slate-700">
              개요 탭은 오늘 의사결정용 압축 보드이고, 상세 로그는 아래 도메인 탭과 <span className="font-black">원본 로그</span> 탭에서 이어서 볼 수 있습니다.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className={cn('grid gap-4', props.isMobile ? 'grid-cols-1' : 'xl:grid-cols-2')}>
        <Card className={cn(cardClass(isHighlighted('learning')), 'cursor-pointer')} onClick={() => props.onSelectDomain('learning')}>
          <CardHeader className={chartHeaderClass}><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg font-black tracking-tight">최근 30일 학습시간 추이</CardTitle><CardDescription className="mt-1 text-[11px] font-bold">오늘, 최근 7일 평균, 최근 30일 페이스를 함께 봅니다.</CardDescription></div><Badge variant="outline" className="rounded-full font-black text-[10px]">학습</Badge></div></CardHeader>
          <CardContent className={chartContentClass}>{props.hasOverviewStudyTrend ? <><div className="h-[220px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={props.overviewStudyTrend30d} margin={{ top: 10, right: 14, left: 8, bottom: 0 }}><defs><linearGradient id="overviewStudyGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2554d4" stopOpacity={0.28} /><stop offset="95%" stopColor="#2554d4" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e8edf7" /><XAxis dataKey="dateLabel" tickLine={false} axisLine={false} fontSize={10} fontWeight={800} /><YAxis tickLine={false} axisLine={false} fontSize={10} fontWeight={800} width={48} /><Tooltip content={<SingleValueTooltip unit="분" presentationMode={props.presentationMode} />} /><Area type="monotone" dataKey="studyMinutes" stroke="#2554d4" strokeWidth={3} fill="url(#overviewStudyGradient)" /></AreaChart></ResponsiveContainer></div><div className={metricPanelClass}><div className="grid gap-3 sm:grid-cols-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">오늘</p><p className="mt-2 text-sm font-black text-[#14295F]">{props.todayStudyLabel}</p></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">7일 평균</p><p className="mt-2 text-sm font-black text-[#14295F]">{props.recent7AverageLabel}</p></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">주간 성장</p><p className={cn('mt-2 text-sm font-black', props.latestWeeklyGrowthLabel.startsWith('+') ? 'text-emerald-600' : 'text-rose-500')}>{props.latestWeeklyGrowthLabel}</p></div></div></div></> : <div className="rounded-2xl border border-dashed py-16 text-center text-sm font-bold text-muted-foreground">최근 30일 학습시간 데이터가 없습니다.</div>}</CardContent>
        </Card>

        <Card className={cn(cardClass(isHighlighted('attendance')), 'cursor-pointer')} onClick={() => props.onSelectDomain('attendance')}>
          <CardHeader className={chartHeaderClass}><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg font-black tracking-tight">최근 30일 출결 스트립</CardTitle><CardDescription className="mt-1 text-[11px] font-bold">출석, 지각, 결석, 루틴 누락, 외출 흐름을 색으로 압축합니다.</CardDescription></div><Badge variant="outline" className="rounded-full font-black text-[10px]">출결</Badge></div></CardHeader>
          <CardContent className={chartContentClass}>{props.hasOverviewAttendanceTrend ? <><div className="grid grid-cols-6 gap-2 sm:grid-cols-10">{props.overviewAttendanceStrip30d.map((item) => <div key={item.dateKey} title={`${item.dateLabel} · ${item.statusLabel} · ${item.studyMinutes}분 · 외출 ${item.awayCount}회`} className={cn('rounded-2xl border px-2 py-3 text-center shadow-sm', item.stripClass)}><p className="text-[10px] font-black text-slate-500">{item.dateLabel}</p><p className="mt-2 text-[10px] font-black text-slate-900">{item.statusLabel}</p></div>)}</div><div className={metricPanelClass}><div className="grid gap-3 sm:grid-cols-4"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">출석</p><p className="mt-2 text-sm font-black text-[#14295F]">{props.overviewAttendanceStrip30d.filter((item) => String(item.status || '').toLowerCase().includes('present') || String(item.status || '').toLowerCase().includes('study')).length}일</p></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">지각</p><p className="mt-2 text-sm font-black text-amber-600">{props.overviewAttendanceStrip30d.filter((item) => String(item.status || '').toLowerCase().includes('late')).length}일</p></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">결석</p><p className="mt-2 text-sm font-black text-rose-500">{props.overviewAttendanceStrip30d.filter((item) => String(item.status || '').toLowerCase().includes('absent')).length}일</p></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">하원기록</p><p className="mt-2 text-sm font-black text-[#14295F]">{props.overviewAttendanceStrip30d.filter((item) => item.hasCheckOut).length}일</p></div></div></div></> : <div className="rounded-2xl border border-dashed py-16 text-center text-sm font-bold text-muted-foreground">최근 30일 출결 기록이 없습니다.</div>}</CardContent>
        </Card>

        <Card className={cn(cardClass(isHighlighted('attendance')), 'cursor-pointer')} onClick={() => props.onSelectDomain('attendance')}>
          <CardHeader className={chartHeaderClass}><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg font-black tracking-tight">등원/하원 시각 추이</CardTitle><CardDescription className="mt-1 text-[11px] font-bold">입실과 하원 시간이 얼마나 안정적으로 유지되는지 봅니다.</CardDescription></div><Badge variant="outline" className="rounded-full font-black text-[10px]">출결 리듬</Badge></div></CardHeader>
          <CardContent className={chartContentClass}>{props.hasStartEndTimeData ? <><div className="h-[220px] w-full"><ResponsiveContainer width="100%" height="100%"><RechartsLineChart data={props.startEndTimeTrendData} margin={{ top: 10, right: 14, left: 8, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e8edf7" /><XAxis dataKey="dateLabel" tickLine={false} axisLine={false} fontSize={10} fontWeight={800} /><YAxis tickLine={false} axisLine={false} fontSize={10} fontWeight={800} width={46} domain={[0, 24]} tickFormatter={hourTickFormatter} /><Tooltip content={<MultiSeriesTooltip presentationMode={props.presentationMode} series={[{ dataKey: 'startHour', label: '등원', color: '#2554d4', formatter: (value) => hourToClockLabel(value) }, { dataKey: 'endHour', label: '하원', color: '#10b981', formatter: (value) => hourToClockLabel(value) }]} />} /><Line type="monotone" dataKey="startHour" stroke="#2554d4" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="endHour" stroke="#10b981" strokeWidth={3} dot={false} /></RechartsLineChart></ResponsiveContainer></div><div className={metricPanelClass}><div className="grid gap-3 sm:grid-cols-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">최근 등원</p><p className="mt-2 text-sm font-black text-[#14295F]">{props.latestStartLabel}</p></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">최근 하원</p><p className="mt-2 text-sm font-black text-[#14295F]">{props.latestEndLabel}</p></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">리듬 안정성</p><p className="mt-2 text-sm font-black text-[#14295F]">{props.averageRhythmScore}점</p></div></div></div></> : <div className="rounded-2xl border border-dashed py-16 text-center text-sm font-bold text-muted-foreground">등원/하원 시각 기록이 없습니다.</div>}</CardContent>
        </Card>

        <Card className={cn(cardClass(isHighlighted('attendance')), 'cursor-pointer')} onClick={() => props.onSelectDomain('attendance')}>
          <CardHeader className={chartHeaderClass}><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg font-black tracking-tight">외출시간/외출횟수 추이</CardTitle><CardDescription className="mt-1 text-[11px] font-bold">최근 14일 외출 시간이 길어지는지, 외출 빈도가 늘어나는지 확인합니다.</CardDescription></div><Badge variant="outline" className="rounded-full font-black text-[10px]">외출 관리</Badge></div></CardHeader>
          <CardContent className={chartContentClass}>{props.hasOverviewAwayTrend ? <><div className="h-[220px] w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={props.overviewAwayTrend14d} margin={{ top: 10, right: 14, left: 8, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e8edf7" /><XAxis dataKey="dateLabel" tickLine={false} axisLine={false} fontSize={10} fontWeight={800} /><YAxis yAxisId="left" tickLine={false} axisLine={false} fontSize={10} fontWeight={800} width={46} /><YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} fontSize={10} fontWeight={800} width={34} /><Tooltip content={<MultiSeriesTooltip presentationMode={props.presentationMode} series={[{ dataKey: 'awayMinutes', label: '외출시간', color: '#f97316', formatter: (value) => `${Math.round(value)}분` }, { dataKey: 'awayCount', label: '외출횟수', color: '#2554d4', formatter: (value) => `${Math.round(value)}회` }]} />} /><Bar yAxisId="left" dataKey="awayMinutes" fill="#f97316" radius={[8, 8, 0, 0]} maxBarSize={20} /><Line yAxisId="right" type="monotone" dataKey="awayCount" stroke="#2554d4" strokeWidth={3} dot={false} /></ComposedChart></ResponsiveContainer></div><div className={metricPanelClass}><div className="grid gap-3 sm:grid-cols-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">30일 평균 외출</p><p className="mt-2 text-sm font-black text-[#14295F]">{props.avgAwayMinutesLabel}</p></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">30일 외출횟수</p><p className="mt-2 text-sm font-black text-[#14295F]">{props.attendanceAwayCount30d}회</p></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">하원 안정도</p><p className="mt-2 text-sm font-black text-[#14295F]">{props.checkOutStability30d}%</p></div></div></div></> : <div className="rounded-2xl border border-dashed py-16 text-center text-sm font-bold text-muted-foreground">외출 관련 데이터가 없습니다.</div>}</CardContent>
        </Card>

        <Card className={cn(cardClass(isHighlighted('learning')), 'cursor-pointer')} onClick={() => props.onSelectDomain('learning')}>
          <CardHeader className={chartHeaderClass}><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg font-black tracking-tight">계획 완료율/루틴 이행</CardTitle><CardDescription className="mt-1 text-[11px] font-bold">완료율 변화와 루틴 수행 여부를 함께 봅니다.</CardDescription></div><Badge variant="outline" className="rounded-full font-black text-[10px]">학습 설계</Badge></div></CardHeader>
          <CardContent className={chartContentClass}>{props.hasOverviewPlanTrend ? <><div className="h-[220px] w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={props.overviewPlanTrend30d} margin={{ top: 10, right: 14, left: 8, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e8edf7" /><XAxis dataKey="dateLabel" tickLine={false} axisLine={false} fontSize={10} fontWeight={800} /><YAxis yAxisId="left" tickLine={false} axisLine={false} fontSize={10} fontWeight={800} width={46} domain={[0, 100]} /><YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} fontSize={10} fontWeight={800} width={34} /><Tooltip content={<MultiSeriesTooltip presentationMode={props.presentationMode} series={[{ dataKey: 'completionRate', label: '완료율', color: '#10b981', formatter: (value) => `${Math.round(value)}%` }, { dataKey: 'routineDone', label: '루틴수행', color: '#6366f1', formatter: (value) => `${Math.round(value)}개` }]} />} /><Bar yAxisId="right" dataKey="routineDone" fill="#6366f1" radius={[8, 8, 0, 0]} maxBarSize={20} /><Line yAxisId="left" type="monotone" dataKey="completionRate" stroke="#10b981" strokeWidth={3} dot={false} /></ComposedChart></ResponsiveContainer></div><div className={metricPanelClass}><div className="grid gap-3 sm:grid-cols-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">평균 완료율</p><p className="mt-2 text-sm font-black text-[#14295F]">{props.avgCompletionRate}%</p></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">오늘 루틴</p><p className="mt-2 text-sm font-black text-[#14295F]">{props.todayRoutineCount}개</p></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">리듬 점수</p><p className="mt-2 text-sm font-black text-[#14295F]">{props.rhythmScore}점</p></div></div></div></> : <div className="rounded-2xl border border-dashed py-16 text-center text-sm font-bold text-muted-foreground">계획 완료율 또는 루틴 이행 데이터가 없습니다.</div>}</CardContent>
        </Card>

        <Card className={cn(cardClass(isHighlighted('guardian', 'reports', 'sms')), 'cursor-pointer')} onClick={() => props.onSelectDomain('guardian')}>
          <CardHeader className={chartHeaderClass}><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg font-black tracking-tight">상담/리포트/문자 활동 추이</CardTitle><CardDescription className="mt-1 text-[11px] font-bold">최근 30일 운영 접점을 날짜축으로 겹쳐 봅니다.</CardDescription></div><Badge variant="outline" className="rounded-full font-black text-[10px]">상담·리포트·문자</Badge></div></CardHeader>
          <CardContent className={chartContentClass}>{props.hasOverviewCommunicationTrend ? <><div className="h-[220px] w-full"><ResponsiveContainer width="100%" height="100%"><RechartsLineChart data={props.overviewCommunicationTrend30d} margin={{ top: 10, right: 14, left: 8, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e8edf7" /><XAxis dataKey="dateLabel" tickLine={false} axisLine={false} fontSize={10} fontWeight={800} /><YAxis tickLine={false} axisLine={false} fontSize={10} fontWeight={800} width={40} /><Tooltip content={<MultiSeriesTooltip presentationMode={props.presentationMode} series={[{ dataKey: 'counseling', label: '상담', color: '#7c3aed', formatter: (value) => `${Math.round(value)}건` }, { dataKey: 'reports', label: '리포트', color: '#f59e0b', formatter: (value) => `${Math.round(value)}건` }, { dataKey: 'sms', label: '문자', color: '#0ea5e9', formatter: (value) => `${Math.round(value)}건` }]} />} /><Line type="monotone" dataKey="counseling" stroke="#7c3aed" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="reports" stroke="#f59e0b" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="sms" stroke="#0ea5e9" strokeWidth={3} dot={false} /></RechartsLineChart></ResponsiveContainer></div><div className={metricPanelClass}><div className="grid gap-3 sm:grid-cols-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">상담</p><p className="mt-2 text-sm font-black text-[#14295F]">{props.counselingCount}건</p></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">리포트</p><p className="mt-2 text-sm font-black text-[#14295F]">{props.reportCount}건</p></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">문자 접수</p><p className="mt-2 text-sm font-black text-[#14295F]">{props.smsCount}건</p></div></div></div></> : <div className="rounded-2xl border border-dashed py-16 text-center text-sm font-bold text-muted-foreground">상담, 리포트, 문자 활동 데이터가 없습니다.</div>}</CardContent>
        </Card>

        <Card className={cn(cardClass(isHighlighted('risk')), 'cursor-pointer')} onClick={() => props.onSelectDomain('risk')}>
          <CardHeader className={chartHeaderClass}><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg font-black tracking-tight">리스크/벌점 추이</CardTitle><CardDescription className="mt-1 text-[11px] font-bold">최근 30일 위험 점수와 누적 벌점이 같이 오르는지 확인합니다.</CardDescription></div><Badge variant="outline" className="rounded-full font-black text-[10px]">리스크</Badge></div></CardHeader>
          <CardContent className={chartContentClass}>{props.hasOverviewRiskTrend ? <><div className="h-[220px] w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={props.overviewRiskTrend30d} margin={{ top: 10, right: 14, left: 8, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e8edf7" /><XAxis dataKey="dateLabel" tickLine={false} axisLine={false} fontSize={10} fontWeight={800} /><YAxis yAxisId="left" tickLine={false} axisLine={false} fontSize={10} fontWeight={800} width={40} domain={[0, 100]} /><YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} fontSize={10} fontWeight={800} width={34} /><Tooltip content={<MultiSeriesTooltip presentationMode={props.presentationMode} series={[{ dataKey: 'riskScore', label: '위험점수', color: '#f43f5e', formatter: (value) => `${Math.round(value)}점` }, { dataKey: 'cumulativePenalty', label: '누적벌점', color: '#f59e0b', formatter: (value) => `${Math.round(value)}점` }]} />} /><Bar yAxisId="right" dataKey="cumulativePenalty" fill="#f59e0b" radius={[8, 8, 0, 0]} maxBarSize={20} /><Line yAxisId="left" type="monotone" dataKey="riskScore" stroke="#f43f5e" strokeWidth={3} dot={false} /></ComposedChart></ResponsiveContainer></div><div className={metricPanelClass}><div className="grid gap-3 sm:grid-cols-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">현재 리스크</p><p className="mt-2 text-sm font-black text-rose-500">{props.studentRiskScore}점</p></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">현재 벌점</p><p className="mt-2 text-sm font-black text-[#14295F]">{props.penaltyPoints}점</p></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">회복력</p><p className="mt-2 text-sm font-black text-[#14295F]">{props.resilience}점</p></div></div></div></> : <div className="rounded-2xl border border-dashed py-16 text-center text-sm font-bold text-muted-foreground">리스크/벌점 데이터가 없습니다.</div>}</CardContent>
        </Card>

        <Card className={cn(cardClass(isHighlighted('guardian', 'billing')), 'cursor-pointer')} onClick={() => props.onSelectDomain(props.canViewBilling ? 'billing' : 'guardian')}>
          <CardHeader className={chartHeaderClass}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-black tracking-tight">{props.canViewBilling ? '수납/보호자 반응' : '보호자 반응 추이'}</CardTitle>
                <CardDescription className="mt-1 text-[11px] font-bold">
                  {props.canViewBilling ? '청구 흐름과 보호자 활동을 같은 축에서 같이 봅니다.' : '앱 방문, 리포트 열람, 보호자 반응 흐름을 봅니다.'}
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full font-black text-[10px]">{props.canViewBilling ? '수납·학부모' : '학부모'}</Badge>
            </div>
          </CardHeader>
          <CardContent className={chartContentClass}>
            {props.hasOverviewGuardianBillingTrend ? (
              <>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={props.overviewGuardianBillingTrend30d} margin={{ top: 10, right: 14, left: 8, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e8edf7" />
                      <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} fontSize={10} fontWeight={800} />
                      <YAxis yAxisId="left" tickLine={false} axisLine={false} fontSize={10} fontWeight={800} width={40} />
                      <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} fontSize={10} fontWeight={800} width={34} />
                      <Tooltip
                        content={
                          <MultiSeriesTooltip
                            presentationMode={props.presentationMode}
                            series={guardianBillingSeries}
                          />
                        }
                      />
                      {props.canViewBilling ? <Bar yAxisId="right" dataKey="billing" fill="#0ea5e9" radius={[8, 8, 0, 0]} maxBarSize={20} /> : null}
                      <Line yAxisId="left" type="monotone" dataKey="guardianActivity" stroke="#7c3aed" strokeWidth={3} dot={false} />
                      <Line yAxisId="left" type="monotone" dataKey="reportReads" stroke="#10b981" strokeWidth={3} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className={metricPanelClass}>
                  <div className={cn('grid gap-3', props.canViewBilling ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">앱 방문</p>
                      <p className="mt-2 text-sm font-black text-[#14295F]">{props.guardianVisitCount30d}회</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">리포트 열람</p>
                      <p className="mt-2 text-sm font-black text-[#14295F]">{props.reportReadCount30d}회</p>
                    </div>
                    {props.canViewBilling ? (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">수납 상태</p>
                        <p className="mt-2 text-sm font-black text-[#14295F]">{props.invoiceStatusSummary}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed py-16 text-center text-sm font-bold text-muted-foreground">
                {props.canViewBilling ? '수납 또는 보호자 활동 데이터가 없습니다.' : '보호자 반응 데이터가 없습니다.'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
