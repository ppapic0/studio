import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Search, Sparkles } from 'lucide-react';
import { Firestore } from 'firebase/firestore';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  ATTENDANCE_STATUS_LABELS,
  formatMinutesAsLabel,
  formatSignedMinutes,
  getAttendanceRiskMeta,
  getAttendanceStatusTone,
  type AttendanceKpiDay,
  type AttendanceKpiPeriod,
  type AttendanceStudentKpiRow,
} from '@/lib/attendance-kpi';
import { buildAttendanceStudentSubtitle, useAttendanceKpi } from '@/hooks/use-attendance-kpi';
import { AttendanceCurrent, AttendanceRequest, CenterMembership } from '@/lib/types';

type RiskFilter = 'all' | 'critical' | 'risk' | 'watch' | 'stable';
type RequestFilter = 'all' | 'requested' | 'approved' | 'rejected' | 'none';

interface AttendanceKpiBoardProps {
  firestore: Firestore | null;
  centerId: string | null | undefined;
  students: CenterMembership[] | undefined;
  requests: AttendanceRequest[] | undefined;
  attendanceCurrentDocs: AttendanceCurrent[] | undefined;
}

const REQUEST_STATUS_LABELS: Record<RequestFilter, string> = {
  all: '전체',
  requested: '대기',
  approved: '승인',
  rejected: '반려',
  none: '없음',
};

function useDesktopLayout() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktop(mediaQuery.matches);
    sync();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', sync);
      return () => mediaQuery.removeEventListener('change', sync);
    }
    mediaQuery.addListener(sync);
    return () => mediaQuery.removeListener(sync);
  }, []);

  return isDesktop;
}

function SummaryMetricCard({
  label,
  value,
  hint,
  accentClass,
}: {
  label: string;
  value: string;
  hint: string;
  accentClass: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white px-5 py-4 shadow-[0_16px_35px_-32px_rgba(15,23,42,0.45)]">
      <div className={cn('absolute inset-y-0 left-0 w-1.5', accentClass)} />
      <p className="pl-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 pl-2 text-[1.75rem] font-black tracking-tight text-[#14295F]">{value}</p>
      <p className="mt-2 pl-2 text-xs font-bold leading-relaxed text-slate-500">{hint}</p>
    </div>
  );
}

function OpsSummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 px-4 py-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-[#14295F]">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{hint}</p>
    </div>
  );
}

function DenseHeaderCell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('text-[10px] font-black uppercase tracking-[0.16em] text-slate-400', className)}>
      {children}
    </div>
  );
}

function DenseValueCell({
  value,
  tone = 'text-[#14295F]',
  align = 'text-left',
}: {
  value: string;
  tone?: string;
  align?: string;
}) {
  return <div className={cn('text-sm font-black', tone, align)}>{value}</div>;
}

function getRequestStatusLabel(status: AttendanceStudentKpiRow['recentRequestStatus']) {
  return REQUEST_STATUS_LABELS[status] || '없음';
}

function getRequestStatusTone(status: AttendanceStudentKpiRow['recentRequestStatus']) {
  switch (status) {
    case 'requested':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'approved':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'rejected':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
}

function getTimelineShortLabel(day: AttendanceKpiDay) {
  switch (day.status) {
    case 'confirmed_present':
      return '출석';
    case 'confirmed_present_missing_routine':
      return '출석';
    case 'confirmed_late':
      return '지각';
    case 'confirmed_absent':
      return '결석';
    case 'excused_absent':
      return '사유';
    case 'missing_routine':
      return '누락';
    default:
      return '미확인';
  }
}

function AttendanceTimelineStrip({
  row,
  focusedDateKey,
  onFocusDateKey,
}: {
  row: AttendanceStudentKpiRow;
  focusedDateKey: string | null;
  onFocusDateKey: (dateKey: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">최근 출결 스트립</p>
          <p className="mt-1 text-xs font-bold text-slate-500">최근 {row.timeline.length}일 흐름을 짧게 비교합니다.</p>
        </div>
        <Badge variant="outline" className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600">
          기본 {row.timeline.length}일
        </Badge>
      </div>
      <div className="-mx-1 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2 px-1">
          {row.timeline.map((day) => {
            const isActive = focusedDateKey === day.dateKey;
            return (
              <button
                key={`${row.studentId}-${day.dateKey}`}
                type="button"
                title={`${day.dateKey} · ${ATTENDANCE_STATUS_LABELS[day.status]}`}
                onClick={() => onFocusDateKey(day.dateKey)}
                onMouseEnter={() => onFocusDateKey(day.dateKey)}
                onFocus={() => onFocusDateKey(day.dateKey)}
                className={cn(
                  'min-w-[72px] rounded-[1.2rem] border px-3 py-3 text-left shadow-sm transition-all',
                  getAttendanceStatusTone(day.status),
                  day.isOffDay && 'opacity-60',
                  isActive && 'ring-2 ring-[#14295F]/20'
                )}
              >
                <p className="text-[10px] font-black uppercase tracking-[0.12em] opacity-75">{day.dateLabel}</p>
                <p className="mt-2 text-sm font-black leading-none">{getTimelineShortLabel(day)}</p>
                <p className="mt-2 text-[10px] font-bold opacity-80">
                  {day.status === 'confirmed_late' ? `${day.lateMinutes}분` : formatMinutesAsLabel(day.studyMinutes)}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DetailStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50/70 px-4 py-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-black tracking-tight text-[#14295F]">{value}</p>
      <p className="mt-1 text-[11px] font-bold text-slate-500">{hint}</p>
    </div>
  );
}

function DetailPanel({ row }: { row: AttendanceStudentKpiRow | null }) {
  const [expandedRequests, setExpandedRequests] = useState(false);
  const [focusedDateKey, setFocusedDateKey] = useState<string | null>(row?.timeline[0]?.dateKey ?? null);

  useEffect(() => {
    setFocusedDateKey(row?.timeline[0]?.dateKey ?? null);
    setExpandedRequests(false);
  }, [row?.studentId, row?.timeline]);

  if (!row) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white/80 p-8 text-center text-sm font-bold text-slate-400">
        학생을 선택하면 개인 출결 KPI와 오늘 바로 할 일을 볼 수 있습니다.
      </div>
    );
  }

  const riskMeta = getAttendanceRiskMeta(row.stabilityScore);
  const focusedDay =
    row.timeline.find((day) => day.dateKey === focusedDateKey) ??
    row.timeline[0] ??
    null;
  const recentArrivalTrend = row.timeline
    .filter((day) => day.isScheduledDay && day.expectedArrivalAt && day.checkedAt)
    .slice(-5)
    .reverse();
  const requestPreview = expandedRequests ? row.requestHistory : row.requestHistory.slice(0, 4);

  return (
    <div className="space-y-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.34)]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">학생 개인 상세</p>
            <h3 className="text-2xl font-black tracking-tight text-[#14295F]">{row.studentName}</h3>
            <p className="text-sm font-bold text-slate-500">{buildAttendanceStudentSubtitle(row)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn('rounded-full border px-3 py-1 text-xs font-black', riskMeta.tone)}>
              {riskMeta.label}
            </Badge>
            <Badge variant="outline" className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600">
              안정도 {row.stabilityScore}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">오늘 핵심 이슈</p>
            <p className="mt-2 text-base font-black leading-relaxed text-[#14295F]">{row.topIssue}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600">
                출석률 {row.attendanceRate}%
              </Badge>
              <Badge variant="outline" className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600">
                지각 {row.lateCount}회
              </Badge>
              <Badge variant="outline" className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600">
                결석 {row.absenceCount}회
              </Badge>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">바로 할 일</p>
            <div className="mt-3 space-y-2">
              {row.suggestions.length === 0 ? (
                <div className="rounded-2xl bg-white px-3 py-3 text-sm font-bold text-slate-500">
                  추가 조치 없이 현재 흐름을 유지하면 됩니다.
                </div>
              ) : (
                row.suggestions.slice(0, 2).map((suggestion) => (
                  <div key={suggestion} className="rounded-2xl bg-white px-3 py-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="text-sm font-bold leading-relaxed text-slate-700">{suggestion}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DetailStat label="출석률" value={`${row.attendanceRate}%`} hint={`지각 ${row.lateCount}회 · 결석 ${row.absenceCount}회`} />
        <DetailStat label="평균 외출" value={formatMinutesAsLabel(row.averageAwayMinutes)} hint={`${row.awayDayCount}일 · ${row.awayCount}회`} />
        <DetailStat label="최근 하원" value={row.latestCheckOutLabel} hint={`하원 기록 완료율 ${row.checkoutCompletionRate}%`} />
        <DetailStat
          label="신청 상태"
          value={getRequestStatusLabel(row.recentRequestStatus)}
          hint={`최근 신청 ${row.recentRequestCount}건`}
        />
      </div>

      <AttendanceTimelineStrip row={row} focusedDateKey={focusedDateKey} onFocusDateKey={setFocusedDateKey} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">선택 날짜 상세</p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                짧은 상태 스트립에서 선택한 하루의 기록입니다.
              </p>
            </div>
            {focusedDay ? (
              <Badge className={cn('rounded-full border px-3 py-1 text-xs font-black', getAttendanceStatusTone(focusedDay.status))}>
                {ATTENDANCE_STATUS_LABELS[focusedDay.status]}
              </Badge>
            ) : null}
          </div>
          {focusedDay ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailStat label="공부 시간" value={formatMinutesAsLabel(focusedDay.studyMinutes)} hint={focusedDay.dateKey} />
              <DetailStat label="등원 오차" value={formatSignedMinutes(focusedDay.lateMinutes)} hint={focusedDay.expectedArrivalTime || '예정 시각 없음'} />
              <DetailStat label="외출" value={focusedDay.awayCount > 0 ? `${focusedDay.awayCount}회` : '없음'} hint={formatMinutesAsLabel(focusedDay.awayMinutes)} />
              <DetailStat label="하원" value={focusedDay.checkOutAt ? focusedDay.checkOutAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-'} hint={focusedDay.hasCheckoutRecord ? '기록 완료' : '기록 없음'} />
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-white px-4 py-6 text-sm font-bold text-slate-400">선택 가능한 출결 기록이 없습니다.</div>
          )}
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">등원 시각 추이</p>
              <p className="mt-1 text-xs font-bold text-slate-500">최근 5개 유효 등원 기록만 간결하게 보여줍니다.</p>
            </div>
            <Badge variant="outline" className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600">
              평균 {formatSignedMinutes(row.averageArrivalOffsetMinutes)}
            </Badge>
          </div>
          <div className="mt-4 space-y-2">
            {recentArrivalTrend.length === 0 ? (
              <div className="rounded-2xl bg-white px-4 py-6 text-sm font-bold text-slate-400">
                등원 기록이 아직 충분하지 않습니다.
              </div>
            ) : (
              recentArrivalTrend.map((day) => (
                <div key={day.dateKey} className="flex items-center justify-between rounded-2xl bg-white px-3 py-3">
                  <div>
                    <p className="text-sm font-black text-[#14295F]">{day.dateLabel}</p>
                    <p className="mt-1 text-[11px] font-bold text-slate-500">{day.expectedArrivalTime || '예정 없음'}</p>
                  </div>
                  <span className={cn('text-sm font-black', day.lateMinutes > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                    {day.lateMinutes > 0 ? `${day.lateMinutes}분 늦음` : '정시'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">신청 이력</p>
            <p className="mt-1 text-xs font-bold text-slate-500">최근 신청 흐름만 먼저 보여주고, 나머지는 확장합니다.</p>
          </div>
          <Badge className={cn('rounded-full border px-3 py-1 text-xs font-black', getRequestStatusTone(row.recentRequestStatus))}>
            최근 상태 {getRequestStatusLabel(row.recentRequestStatus)}
          </Badge>
        </div>
        <div className="mt-4 space-y-2">
          {requestPreview.length === 0 ? (
            <div className="rounded-2xl bg-white px-4 py-6 text-sm font-bold text-slate-400">
              최근 기간 내 신청 내역이 없습니다.
            </div>
          ) : (
            requestPreview.map((request) => (
              <div key={request.id} className="rounded-2xl bg-white px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#14295F]">
                      {request.type === 'late' ? '지각 신청' : '결석 신청'} · {request.date}
                    </p>
                    <p className="mt-1 truncate text-[11px] font-bold text-slate-500">{request.reason || '사유 없음'}</p>
                  </div>
                  <Badge className={cn('rounded-full border px-3 py-1 text-xs font-black', getRequestStatusTone(request.status))}>
                    {getRequestStatusLabel(request.status)}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
        {row.requestHistory.length > 4 ? (
          <div className="mt-3">
            <Button variant="outline" className="rounded-full font-black" onClick={() => setExpandedRequests((prev) => !prev)}>
              {expandedRequests ? '접기' : `나머지 ${row.requestHistory.length - 4}건 더 보기`}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AttendanceKpiBoard({
  firestore,
  centerId,
  students,
  requests,
  attendanceCurrentDocs,
}: AttendanceKpiBoardProps) {
  const [periodDays, setPeriodDays] = useState<AttendanceKpiPeriod>(30);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [requestFilter, setRequestFilter] = useState<RequestFilter>('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const isDesktop = useDesktopLayout();

  const { isLoading, error, rows, summary, requestOperations, availableRooms, periodOptions } = useAttendanceKpi({
    firestore,
    centerId,
    students,
    requests,
    attendanceCurrentDocs,
    periodDays,
    enabled: Boolean(centerId),
  });

  const classOptions = useMemo(() => {
    const seen = new Set<string>();
    return (students || [])
      .map((student) => student.className || '미분류')
      .filter((value) => {
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
      })
      .sort((a, b) => a.localeCompare(b, 'ko-KR'));
  }, [students]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (search && !row.studentName.toLowerCase().includes(search.toLowerCase())) return false;
      if (classFilter !== 'all' && row.className !== classFilter) return false;
      if (roomFilter !== 'all' && row.roomId !== roomFilter) return false;
      if (riskFilter !== 'all' && row.riskLevel !== riskFilter) return false;
      if (requestFilter !== 'all' && row.recentRequestStatus !== requestFilter) return false;
      return true;
    });
  }, [classFilter, requestFilter, riskFilter, roomFilter, rows, search]);

  useEffect(() => {
    if (!filteredRows.length) {
      setSelectedStudentId(null);
      return;
    }
    if (!selectedStudentId || !filteredRows.some((row) => row.studentId === selectedStudentId)) {
      setSelectedStudentId(filteredRows[0]!.studentId);
    }
  }, [filteredRows, selectedStudentId]);

  const selectedRow = filteredRows.find((row) => row.studentId === selectedStudentId) || filteredRows[0] || null;
  const summaryHighlight = useMemo(() => {
    if (summary.criticalCount > 0) {
      return `긴급 학생 ${summary.criticalCount}명이 있어 오늘은 무단결석, 장기 외출, 하원 누락부터 먼저 확인하는 것이 좋습니다.`;
    }
    if (summary.riskCount > 0) {
      return `위험 학생 ${summary.riskCount}명을 중심으로 지각과 외출 패턴을 먼저 정리하면 운영 리듬을 빠르게 안정화할 수 있습니다.`;
    }
    return '전체 출결 흐름은 비교적 안정적입니다. 반복 지각과 외출시간 위주로 미세 조정하면 됩니다.';
  }, [summary.criticalCount, summary.riskCount]);

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    if (!isDesktop) setMobileDetailOpen(true);
  };

  return (
    <Card className="rounded-[2.5rem] border-none bg-white shadow-xl ring-1 ring-border/50">
      <CardHeader className="space-y-5 border-b bg-muted/5 p-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="grid gap-1">
            <CardTitle className="text-xl font-black tracking-tight">출결 KPI 보드</CardTitle>
            <CardDescription className="text-xs font-bold text-muted-foreground">
              요약 → 학생 리스트 → 개인 상세 순서로 출결 리스크와 조치 우선순위를 빠르게 파악합니다.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="rounded-full border-none bg-rose-100 px-3 py-1 text-xs font-black text-rose-700">
              긴급 {summary.criticalCount}
            </Badge>
            <Badge className="rounded-full border-none bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">
              위험 {summary.riskCount}
            </Badge>
            <Badge className="rounded-full border-none bg-sky-100 px-3 py-1 text-xs font-black text-sky-700">
              주의 {summary.watchCount}
            </Badge>
            <Badge className="rounded-full border-none bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
              안정 {summary.stableCount}
            </Badge>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-[#14295F]/10 bg-[linear-gradient(135deg,#EEF4FF_0%,#FFFFFF_100%)] p-5 shadow-[0_20px_40px_-34px_rgba(20,41,95,0.35)]">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#14295F] text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#14295F]/45">운영 요약</p>
              <p className="mt-1 text-sm font-black leading-relaxed text-[#14295F]">{summaryHighlight}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          <SummaryMetricCard label="출석률" value={`${summary.attendanceRate}%`} hint="기준 루틴 대비 실제 출석 비율" accentClass="bg-emerald-500" />
          <SummaryMetricCard label="지각률" value={`${summary.lateRate}%`} hint="반복 지각 패턴 우선 확인" accentClass="bg-amber-500" />
          <SummaryMetricCard label="무단결석률" value={`${summary.unexcusedAbsenceRate}%`} hint="즉시 상담이 필요한 결석 비율" accentClass="bg-rose-500" />
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          <SummaryMetricCard label="평균 외출" value={formatMinutesAsLabel(summary.averageAwayMinutes)} hint="학습 흐름 이탈 평균 시간" accentClass="bg-sky-500" />
          <SummaryMetricCard label="하원 완료율" value={`${summary.checkoutCompletionRate}%`} hint="보호자 안내까지 닫힌 기록 비율" accentClass="bg-[#14295F]" />
          <SummaryMetricCard label="신청 SLA" value={`${summary.requestSlaComplianceRate}%`} hint="신청을 제때 처리한 운영 비율" accentClass="bg-violet-500" />
        </div>

        <div className="sticky top-0 z-10 -mx-2 rounded-[1.6rem] border border-slate-200 bg-white/95 px-2 py-2 shadow-sm backdrop-blur">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_repeat(5,minmax(0,1fr))]">
            <div className="flex h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="학생명 검색"
                className="h-9 border-none px-0 font-bold shadow-none focus-visible:ring-0"
              />
            </div>
            <Select value={periodDays.toString()} onValueChange={(value) => setPeriodDays(Number(value) as AttendanceKpiPeriod)}>
              <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white font-bold">
                <SelectValue placeholder="기간" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                {periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()} className="font-bold">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white font-bold">
                <SelectValue placeholder="반" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all" className="font-bold">전체 반</SelectItem>
                {classOptions.map((option) => (
                  <SelectItem key={option} value={option} className="font-bold">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={roomFilter} onValueChange={setRoomFilter}>
              <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white font-bold">
                <SelectValue placeholder="호실" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all" className="font-bold">전체 호실</SelectItem>
                {availableRooms.map((room) => (
                  <SelectItem key={room.value} value={room.value} className="font-bold">
                    {room.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={(value) => setRiskFilter(value as RiskFilter)}>
              <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white font-bold">
                <SelectValue placeholder="위험도" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all" className="font-bold">전체 위험도</SelectItem>
                <SelectItem value="critical" className="font-bold">긴급</SelectItem>
                <SelectItem value="risk" className="font-bold">위험</SelectItem>
                <SelectItem value="watch" className="font-bold">주의</SelectItem>
                <SelectItem value="stable" className="font-bold">안정</SelectItem>
              </SelectContent>
            </Select>
            <Select value={requestFilter} onValueChange={(value) => setRequestFilter(value as RequestFilter)}>
              <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white font-bold">
                <SelectValue placeholder="신청 상태" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                {(Object.keys(REQUEST_STATUS_LABELS) as RequestFilter[]).map((status) => (
                  <SelectItem key={status} value={status} className="font-bold">
                    {REQUEST_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-2">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
              현재 위험도 높은 순으로 정렬
            </p>
            <Badge variant="outline" className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600">
              기간 {periodOptions.find((option) => option.value === periodDays)?.label ?? `${periodDays}일`}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OpsSummaryCard label="오늘 대기 신청" value={`${requestOperations.pendingTodayCount}`} hint="당일 처리 필요한 요청" />
          <OpsSummaryCard label="24시간 초과 미처리" value={`${requestOperations.overduePendingCount}`} hint="운영 후속 지연 요청" />
          <OpsSummaryCard label="평균 처리시간" value={`${requestOperations.averageProcessingHours}h`} hint="신청 응답 속도" />
          <OpsSummaryCard label="반복 신청 학생" value={`${requestOperations.repeatRequesterCount}`} hint="반복 보호자 커뮤니케이션 대상" />
        </div>
      </CardHeader>

      <CardContent className="p-6 sm:p-8">
        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
          </div>
        ) : error ? (
          <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
            {error}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.95fr)]">
            <div className="space-y-3">
              {filteredRows.length === 0 ? (
                <div className="rounded-[2rem] border border-dashed border-slate-200 bg-slate-50/70 px-6 py-16 text-center">
                  <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-black text-slate-500">조건에 맞는 학생이 없습니다.</p>
                </div>
              ) : (
                <>
                  <div className="hidden rounded-[1.5rem] border border-slate-200 bg-slate-50/70 px-5 py-3 lg:grid lg:grid-cols-[minmax(0,2.2fr)_0.9fr_0.8fr_0.7fr_0.7fr_0.8fr_0.8fr_0.9fr] lg:gap-3">
                    <DenseHeaderCell>학생</DenseHeaderCell>
                    <DenseHeaderCell>위험도</DenseHeaderCell>
                    <DenseHeaderCell className="text-right">출석률</DenseHeaderCell>
                    <DenseHeaderCell className="text-right">지각</DenseHeaderCell>
                    <DenseHeaderCell className="text-right">결석</DenseHeaderCell>
                    <DenseHeaderCell className="text-right">평균 외출</DenseHeaderCell>
                    <DenseHeaderCell className="text-right">최근 하원</DenseHeaderCell>
                    <DenseHeaderCell className="text-right">신청 상태</DenseHeaderCell>
                  </div>

                  {filteredRows.map((row) => {
                    const riskMeta = getAttendanceRiskMeta(row.stabilityScore);
                    const isSelected = selectedRow?.studentId === row.studentId;
                    const accentClass =
                      row.riskLevel === 'critical'
                        ? 'bg-rose-500'
                        : row.riskLevel === 'risk'
                          ? 'bg-amber-500'
                          : row.riskLevel === 'watch'
                            ? 'bg-sky-500'
                            : 'bg-emerald-500';

                    return (
                      <button
                        key={row.studentId}
                        type="button"
                        onClick={() => handleSelectStudent(row.studentId)}
                        className={cn(
                          'w-full rounded-[1.8rem] border bg-white text-left transition-all',
                          isSelected
                            ? 'border-[#14295F] shadow-[0_18px_42px_-34px_rgba(20,41,95,0.45)]'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                        )}
                      >
                        <div className="lg:hidden">
                          <div className="flex items-start gap-4 px-4 py-4">
                            <div className={cn('mt-0.5 h-[82px] w-[5px] shrink-0 rounded-full', accentClass)} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-base font-black tracking-tight text-[#14295F]">{row.studentName}</p>
                                    <Badge variant="outline" className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-600">
                                      {row.className}
                                    </Badge>
                                  </div>
                                  <p className="mt-2 line-clamp-2 text-xs font-bold leading-relaxed text-slate-500">{row.topIssue}</p>
                                </div>
                                <Badge className={cn('rounded-full border px-3 py-1 text-[10px] font-black', riskMeta.tone)}>
                                  {riskMeta.label}
                                </Badge>
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <DetailStat label="출석률" value={`${row.attendanceRate}%`} hint="최근 기간" />
                                <DetailStat label="지각/결석" value={`${row.lateCount}/${row.absenceCount}`} hint="지각/결석" />
                                <DetailStat label="평균 외출" value={formatMinutesAsLabel(row.averageAwayMinutes)} hint="외출 평균" />
                                <DetailStat label="최근 하원" value={row.latestCheckOutLabel} hint={getRequestStatusLabel(row.recentRequestStatus)} />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="hidden lg:grid lg:grid-cols-[minmax(0,2.2fr)_0.9fr_0.8fr_0.7fr_0.7fr_0.8fr_0.8fr_0.9fr] lg:items-center lg:gap-3 lg:px-5 lg:py-4">
                          <div className="flex items-start gap-4">
                            <div className={cn('mt-0.5 h-[74px] w-[5px] shrink-0 rounded-full', accentClass)} />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-black tracking-tight text-[#14295F]">{row.studentName}</p>
                                <Badge variant="outline" className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-600">
                                  {row.className}
                                </Badge>
                                <Badge variant="outline" className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-600">
                                  {row.roomLabel}
                                </Badge>
                              </div>
                              <p className="mt-2 line-clamp-1 text-sm font-bold text-slate-500">{row.topIssue}</p>
                            </div>
                          </div>

                          <div className="flex justify-start">
                            <Badge className={cn('rounded-full border px-3 py-1 text-xs font-black', riskMeta.tone)}>
                              {riskMeta.label}
                            </Badge>
                          </div>
                          <DenseValueCell value={`${row.attendanceRate}%`} align="text-right" />
                          <DenseValueCell value={`${row.lateCount}회`} tone="text-amber-700" align="text-right" />
                          <DenseValueCell value={`${row.absenceCount}회`} tone="text-rose-700" align="text-right" />
                          <DenseValueCell value={formatMinutesAsLabel(row.averageAwayMinutes)} tone="text-sky-700" align="text-right" />
                          <DenseValueCell value={row.latestCheckOutLabel} tone="text-slate-700" align="text-right" />
                          <div className="flex justify-end">
                            <Badge className={cn('rounded-full border px-3 py-1 text-xs font-black', getRequestStatusTone(row.recentRequestStatus))}>
                              {getRequestStatusLabel(row.recentRequestStatus)}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            <div className="hidden lg:block">
              <DetailPanel row={selectedRow} />
            </div>
          </div>
        )}
      </CardContent>

      <Sheet open={!isDesktop && mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
        <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-[2rem] border-none px-0 pb-8 pt-12">
          <div className="px-6">
            <SheetHeader className="mb-4 text-left">
              <SheetTitle className="text-xl font-black tracking-tight text-[#14295F]">
                {selectedRow?.studentName || '학생 상세'}
              </SheetTitle>
              <SheetDescription className="text-sm font-bold text-slate-500">
                {selectedRow ? buildAttendanceStudentSubtitle(selectedRow) : '학생을 선택해 주세요.'}
              </SheetDescription>
            </SheetHeader>
            <DetailPanel row={selectedRow} />
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
