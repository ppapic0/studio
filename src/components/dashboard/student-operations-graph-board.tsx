'use client';

import {
  Area,
  AreaChart,
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
  MessageCircleMore,
  ShieldAlert,
  Users,
  WalletCards,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

  return (
    <div className={cn('space-y-4', className)}>
      <Card className="rounded-[1.85rem] border-none bg-[linear-gradient(180deg,#ffffff_0%,#f6f9ff_100%)] shadow-[0_22px_50px_-38px_rgba(20,41,95,0.38)]">
        <CardHeader className={cn(isMobile ? 'px-4 pt-4 pb-3' : 'px-5 pt-5 pb-4')}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full border-none bg-[#14295F] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                  운영 그래프 보드
                </Badge>
                <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-white/90 px-3 py-1 text-[10px] font-black text-[#2554d4]">
                  최근 4주 기준
                </Badge>
              </div>
              <CardTitle className="text-[clamp(1.05rem,1.7vw,1.45rem)] font-black tracking-tight text-[#14295F]">
                학습, 출결, 보호자 반응, 상담, 문자, 리스크를 한 번에 보여주는 관리 증빙 보드
              </CardTitle>
              <CardDescription className="max-w-4xl text-sm font-semibold leading-6 text-[#5c6e97]">
                부모님께 보여드릴 때도 바로 설명할 수 있도록, 공부시간만이 아니라 실제 운영 개입 흔적과 보호자 반응까지 함께 묶었습니다.
              </CardDescription>
            </div>
            <div className={cn('grid gap-2', isMobile ? 'grid-cols-2' : 'grid-cols-2 xl:grid-cols-4')}>
              <div className="rounded-[1rem] border border-[#dbe7ff] bg-white/90 px-3.5 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">평균 학습</p>
                <p className="mt-1 text-base font-black tracking-tight text-[#14295F]">{minutesToCompactLabel(averageStudyMinutes)}</p>
              </div>
              <div className="rounded-[1rem] border border-[#dbe7ff] bg-white/90 px-3.5 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">평균 완료율</p>
                <p className="mt-1 text-base font-black tracking-tight text-[#14295F]">{averageCompletionRate}%</p>
              </div>
              <div className="rounded-[1rem] border border-[#dbe7ff] bg-white/90 px-3.5 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">운영 접촉</p>
                <p className="mt-1 text-base font-black tracking-tight text-[#14295F]">{totalManagementTouches}건</p>
              </div>
              <div className="rounded-[1rem] border border-[#dbe7ff] bg-white/90 px-3.5 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">보호자 반응</p>
                <p className="mt-1 text-base font-black tracking-tight text-[#14295F]">{totalGuardianTouches}회</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn('grid gap-2.5', isMobile ? 'px-4 pb-4' : 'px-5 pb-5 md:grid-cols-2 xl:grid-cols-5')}>
          {(
            [
              { key: 'present', label: '정상 등원', value: attendanceRollup.confirmed_present + attendanceRollup.confirmed_present_missing_routine, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              { key: 'late', label: '지각', value: attendanceRollup.confirmed_late, className: 'bg-amber-50 text-amber-700 border-amber-200' },
              { key: 'absent', label: '미출석', value: attendanceRollup.confirmed_absent, className: 'bg-rose-50 text-rose-700 border-rose-200' },
              { key: 'guardian', label: '문자 접수', value: totalSmsCount, className: 'bg-sky-50 text-sky-700 border-sky-200' },
              { key: 'risk', label: '최고 위험도', value: peakRiskPulse, className: 'bg-violet-50 text-violet-700 border-violet-200' },
            ] as const
          ).map((chip) => (
            <div key={chip.key} className={cn('rounded-[1rem] border px-3 py-2.5', chip.className)}>
              <p className="text-[10px] font-black uppercase tracking-[0.16em]">{chip.label}</p>
              <p className="mt-1 text-sm font-black">{chip.value}{chip.key === 'risk' ? '점' : '건'}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {!hasTimeline ? (
        <Card className="rounded-[1.75rem] border border-dashed border-[#dbe7ff] bg-white/80 shadow-sm">
          <CardContent className="px-5 py-8 text-center text-sm font-bold text-[#5c6e97]">
            최근 운영 그래프를 만들 데이터가 아직 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'lg:grid-cols-12')}>
          <Card className="rounded-[1.75rem] border-none bg-white shadow-lg lg:col-span-5">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-[#14295F]">
                    <BadgeCheck className="h-4.5 w-4.5 text-emerald-500" />
                    출결 관리 스트립
                  </CardTitle>
                  <CardDescription className="mt-1 text-[11px] font-semibold leading-5 text-[#5c6e97]">
                    날짜별 출결 판단을 색으로 바로 읽게 구성했습니다.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-white/85 text-[10px] font-black text-[#2554d4]">
                  4주
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-7 gap-2 sm:grid-cols-14">
                {safeTimeline.map((item) => {
                  const tone = ATTENDANCE_STYLE[item.attendanceStatus];
                  return (
                    <div key={item.dateKey} className="space-y-1">
                      <div className="rounded-[0.9rem] border border-slate-100 bg-slate-50/70 px-2 py-2 text-center shadow-sm">
                        <div className={cn('mx-auto h-7 rounded-[0.7rem]', tone.block)} />
                        <p className="mt-2 text-[10px] font-black text-[#14295F]">{item.dateLabel}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(ATTENDANCE_STYLE) as Array<[keyof typeof ATTENDANCE_STYLE, (typeof ATTENDANCE_STYLE)[keyof typeof ATTENDANCE_STYLE]]>).map(([key, style]) => (
                  <Badge key={key} variant="outline" className={cn('rounded-full px-2.5 py-1 text-[10px] font-black', style.chip)}>
                    {style.label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-none bg-white shadow-lg lg:col-span-7">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-[#14295F]">
                    <Activity className="h-4.5 w-4.5 text-[#2554d4]" />
                    학습시간 · 계획 이행 동시 추적
                  </CardTitle>
                  <CardDescription className="mt-1 text-[11px] font-semibold leading-5 text-[#5c6e97]">
                    공부시간과 완료율을 함께 보면 실제 관리 밀도가 더 잘 드러납니다.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={safeTimeline} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="operationsStudyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f7cff" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#4f7cff" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#edf2fb" />
                    <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} />
                    <YAxis yAxisId="study" tickLine={false} axisLine={false} width={34} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} />
                    <YAxis yAxisId="completion" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} width={34} tick={{ fontSize: 10, fontWeight: 800, fill: '#7d4ed8' }} />
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
                    <Area yAxisId="study" type="monotone" dataKey="studyMinutes" stroke="#4f7cff" strokeWidth={2.8} fill="url(#operationsStudyGradient)" />
                    <Line yAxisId="completion" type="monotone" dataKey="completionRate" stroke="#7d4ed8" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#7d4ed8', stroke: '#ffffff', strokeWidth: 2 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-none bg-white shadow-lg lg:col-span-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-[#14295F]">
                <MessageCircleMore className="h-4.5 w-4.5 text-[#ff7a16]" />
                운영 접촉 추이
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] font-semibold leading-5 text-[#5c6e97]">
                상담, 리포트, 문자까지 실제 개입 흔적을 날짜별로 모았습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={safeTimeline} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#edf2fb" />
                    <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} />
                    <YAxis tickLine={false} axisLine={false} width={28} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} />
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
                    <Line type="monotone" dataKey="counselingCount" stroke="#ff7a16" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="reportCount" stroke="#7d4ed8" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="smsCount" stroke="#23a8ff" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-none bg-white shadow-lg lg:col-span-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-[#14295F]">
                <Users className="h-4.5 w-4.5 text-emerald-500" />
                보호자 반응 추이
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] font-semibold leading-5 text-[#5c6e97]">
                앱 방문과 리포트 열람 흐름으로 보호자 반응 온도를 보여줍니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={safeTimeline} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#edf2fb" />
                    <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} />
                    <YAxis tickLine={false} axisLine={false} width={28} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} />
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
                    <Line type="monotone" dataKey="appVisits" stroke="#10b981" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="reportReads" stroke="#4f7cff" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-none bg-white shadow-lg lg:col-span-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-[#14295F]">
                <ShieldAlert className="h-4.5 w-4.5 text-rose-500" />
                리스크 · 벌점 추이
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] font-semibold leading-5 text-[#5c6e97]">
                벌점, 출결 요청, 위험 펄스를 함께 봐서 관리 우선순위를 잡습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={safeTimeline} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#edf2fb" />
                    <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} />
                    <YAxis yAxisId="count" tickLine={false} axisLine={false} width={28} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} />
                    <YAxis yAxisId="risk" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} width={32} tick={{ fontSize: 10, fontWeight: 800, fill: '#ef476f' }} />
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
                    <Line yAxisId="risk" type="monotone" dataKey="riskPulse" stroke="#7d4ed8" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-none bg-white shadow-lg lg:col-span-12">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-[#14295F]">
                {isAdmin ? <WalletCards className="h-4.5 w-4.5 text-emerald-500" /> : <BellRing className="h-4.5 w-4.5 text-[#2554d4]" />}
                {isAdmin ? '수납 · 보호자 반응' : '보호자 반응 · 문자 접수'}
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] font-semibold leading-5 text-[#5c6e97]">
                {isAdmin
                  ? '청구 흐름과 보호자 반응을 같은 시간축으로 보면 운영 비용 대비 개입 효율을 설명하기 좋습니다.'
                  : '보호자 반응과 문자 접수 흐름을 같이 보여주면 관리 밀도를 전달하기 좋습니다.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={safeTimeline} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#edf2fb" />
                    <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} />
                    {isAdmin ? (
                      <>
                        <YAxis yAxisId="billing" tickLine={false} axisLine={false} width={48} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                        <YAxis yAxisId="touch" orientation="right" tickLine={false} axisLine={false} width={32} tick={{ fontSize: 10, fontWeight: 800, fill: '#10b981' }} />
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
                        <Line yAxisId="touch" type="monotone" dataKey="guardianTouchCount" stroke="#4f7cff" strokeWidth={2.5} dot={false} />
                      </>
                    ) : (
                      <>
                        <YAxis yAxisId="sms" tickLine={false} axisLine={false} width={32} tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} />
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
                        <Line yAxisId="sms" type="monotone" dataKey="guardianTouchCount" stroke="#4f7cff" strokeWidth={2.5} dot={false} />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
