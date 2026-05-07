import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  type LucideIcon,
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DoorOpen,
  Loader2,
  MapPinned,
  Search,
  ShieldAlert,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { Firestore } from 'firebase/firestore';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/contexts/app-context';
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
import {
  buildAttendanceStudentSubtitle,
  useAttendanceKpi,
  type AttendanceKpiSourceDiagnostic,
} from '@/hooks/use-attendance-kpi';
import { AttendanceCurrent, AttendanceRequest, CenterMembership } from '@/lib/types';

type RiskFilter = 'all' | 'critical' | 'risk' | 'watch' | 'stable';
type RequestFilter = 'all' | 'requested' | 'approved' | 'rejected' | 'none';

interface AttendanceKpiBoardProps {
  firestore: Firestore | null;
  centerId: string | null | undefined;
  students: CenterMembership[] | undefined;
  requests: AttendanceRequest[] | undefined;
  attendanceCurrentDocs: AttendanceCurrent[] | undefined;
  anchorDate?: Date | null;
}

const REQUEST_STATUS_LABELS: Record<RequestFilter, string> = {
  all: '전체',
  requested: '대기',
  approved: '승인',
  rejected: '반려',
  none: '없음',
};

function MetricSummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  accentClass,
  iconClass,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  accentClass: string;
  iconClass: string;
}) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[1.9rem] border px-5 py-5 shadow-[0_20px_45px_-36px_rgba(20,41,95,0.38)] transition-all duration-300 motion-reduce:transition-none',
        accentClass
      )}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#FF7A16] via-[#FF9D52] to-transparent opacity-80" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <p className="mt-3 text-[2rem] font-black tracking-[-0.04em] text-[#14295F]">{value}</p>
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border', iconClass)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-xs font-bold leading-relaxed text-slate-500">{hint}</p>
    </div>
  );
}

function OpsSummaryCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-[1.5rem] border border-[#14295F]/10 bg-white/92 px-4 py-4 shadow-[0_16px_30px_-34px_rgba(20,41,95,0.45)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-[#14295F]">{value}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[#14295F]/10 bg-[#F4F7FF] text-[#14295F]">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-[11px] font-bold leading-relaxed text-slate-500">{hint}</p>
    </div>
  );
}

function SourceDiagnosticsStrip({
  diagnostics,
}: {
  diagnostics: AttendanceKpiSourceDiagnostic[];
}) {
  const fallbackCount = diagnostics.filter((item) => item.usedFallback).length;
  const errorCount = diagnostics.filter((item) => item.errorMessage && !item.usedFallback).length;
  const totalCount = diagnostics.reduce((sum, item) => sum + item.count, 0);
  const headline = errorCount > 0
    ? `일부 소스 ${errorCount}개 점검 필요`
    : fallbackCount > 0
      ? `보정 조회 ${fallbackCount}개 적용`
      : '전체 소스 정상 조회';

  return (
    <div className="rounded-[1.6rem] border border-[#14295F]/10 bg-white px-4 py-4 shadow-[0_18px_36px_-34px_rgba(20,41,95,0.3)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border',
            errorCount > 0
              ? 'border-rose-200 bg-rose-50 text-rose-600'
              : fallbackCount > 0
                ? 'border-orange-200 bg-orange-50 text-[#FF7A16]'
                : 'border-emerald-200 bg-emerald-50 text-emerald-600'
          )}>
            {errorCount > 0 ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black tracking-tight text-[#14295F]">{headline}</p>
            <p className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
              학습일, 세션, 일정 소스가 인덱스 상황과 관계없이 실제 경로 기준으로 보정됩니다.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-[#F8FAFF] px-3 py-1 text-[11px] font-black text-[#14295F]">
            수집 {totalCount.toLocaleString('ko-KR')}건
          </Badge>
          {fallbackCount > 0 ? (
            <Badge className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-black text-[#C95A08]">
              보정 조회됨
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {diagnostics.map((source) => (
          <div
            key={source.key}
            className={cn(
              'min-h-[58px] rounded-[1.1rem] border px-3 py-2.5',
              source.usedFallback
                ? 'border-orange-200 bg-orange-50'
                : source.errorMessage
                  ? 'border-rose-200 bg-rose-50'
                  : 'border-slate-200 bg-[#F8FAFF]'
            )}
            title={source.errorMessage || undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{source.label}</p>
              <span className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black',
                source.usedFallback
                  ? 'bg-orange-100 text-orange-700'
                  : source.errorMessage
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-emerald-100 text-emerald-700'
              )}>
                {source.usedFallback ? '보정' : source.errorMessage ? '확인' : '정상'}
              </span>
            </div>
            <p className="mt-2 text-sm font-black text-[#14295F]">{source.count.toLocaleString('ko-KR')}건</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StudentMetricPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-slate-200 bg-white/90 px-3 py-3 shadow-[0_12px_24px_-28px_rgba(20,41,95,0.36)]">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={cn('mt-2 text-sm font-black tracking-tight text-[#14295F]', tone)}>{value}</p>
    </div>
  );
}

function StudentPriorityCard({
  row,
  index,
  isSelected,
  onSelect,
}: {
  row: AttendanceStudentKpiRow;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const riskMeta = getAttendanceRiskMeta(row.stabilityScore);
  const accentClass =
    row.riskLevel === 'critical'
      ? 'bg-rose-500'
      : row.riskLevel === 'risk'
        ? 'bg-[#FF7A16]'
        : row.riskLevel === 'watch'
          ? 'bg-sky-500'
          : 'bg-emerald-500';

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.28, delay: Math.min(index * 0.035, 0.18) }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.995 }}
      className={cn(
        'group relative w-full overflow-hidden rounded-[2rem] border text-left transition-all duration-300 motion-reduce:transition-none',
        isSelected
          ? 'border-[#14295F]/30 bg-[linear-gradient(135deg,#FFFFFF_0%,#F3F7FF_100%)] shadow-[0_28px_60px_-38px_rgba(20,41,95,0.42)] ring-2 ring-[#14295F]/10'
          : 'border-slate-200 bg-white hover:border-[#14295F]/20 hover:shadow-[0_24px_48px_-38px_rgba(20,41,95,0.3)]'
      )}
    >
      <div className={cn('absolute inset-y-5 left-0 w-1.5 rounded-r-full', accentClass)} />
      <div className="p-5 pl-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-[#14295F]/10 bg-[#F4F7FF] px-2.5 py-1 text-[10px] font-black text-[#14295F]">
                TOP {index + 1}
              </Badge>
              <p className="text-lg font-black tracking-tight text-[#14295F]">{row.studentName}</p>
              <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-[#F7F9FF] px-2.5 py-1 text-[10px] font-black text-[#14295F]">
                {row.className}
              </Badge>
              <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-white px-2.5 py-1 text-[10px] font-black text-slate-600">
                {row.roomLabel}
              </Badge>
            </div>
            <p className="mt-3 line-clamp-1 text-sm font-bold leading-relaxed text-slate-600">{row.topIssue}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badge className={cn('rounded-full border px-3 py-1 text-[10px] font-black', riskMeta.tone)}>
              {riskMeta.label}
            </Badge>
            <Badge className={cn('rounded-full border px-3 py-1 text-[10px] font-black', getRequestStatusTone(row.recentRequestStatus))}>
              {getRequestStatusLabel(row.recentRequestStatus)}
            </Badge>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <StudentMetricPill label="출석률" value={`${row.attendanceRate}%`} />
          <StudentMetricPill label="지각" value={`${row.lateCount}회`} tone={row.lateCount > 0 ? 'text-amber-700' : 'text-emerald-700'} />
          <StudentMetricPill label="무단결석" value={`${row.absenceCount}회`} tone={row.absenceCount > 0 ? 'text-rose-700' : 'text-emerald-700'} />
          <StudentMetricPill
            label="하원 누락"
            value={row.checkoutCompletionRate < 100 ? `${100 - row.checkoutCompletionRate}%` : '없음'}
            tone={row.checkoutCompletionRate < 100 ? 'text-rose-700' : 'text-emerald-700'}
          />
          <StudentMetricPill
            label="루틴/신청"
            value={`${row.routineMissingCount}일 / ${row.recentRequestCount}건`}
            tone={row.routineMissingCount > 0 || row.recentRequestCount > 0 ? 'text-[#14295F]' : 'text-emerald-700'}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            안정도 {row.stabilityScore} · 최근 신청 {row.recentRequestCount}건
          </p>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#14295F]">
            상세 보기
            <ChevronRight
              className={cn(
                'h-4 w-4 transition-transform duration-300 motion-reduce:transition-none',
                isSelected ? 'translate-x-0.5' : 'group-hover:translate-x-0.5'
              )}
            />
          </div>
        </div>
      </div>
    </motion.button>
  );
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
    <div className="space-y-3 rounded-[1.7rem] border border-[#14295F]/10 bg-white/92 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">최근 출결 스트립</p>
          <p className="mt-1 text-xs font-bold text-slate-500">최근 {row.timeline.length}일 흐름을 압축해 비교합니다.</p>
        </div>
        <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-[#F7F9FF] px-3 py-1 text-[11px] font-black text-[#14295F]">
          최근 {row.timeline.length}일
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
                  'min-w-[74px] rounded-[1.2rem] border px-3 py-3 text-left shadow-sm transition-all duration-200 motion-reduce:transition-none',
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
  toneClass,
}: {
  label: string;
  value: string;
  hint: string;
  toneClass?: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-[#14295F]/10 bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFF_100%)] px-4 py-4 shadow-[0_16px_34px_-34px_rgba(20,41,95,0.3)]">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={cn('mt-2 text-lg font-black tracking-tight text-[#14295F]', toneClass)}>{value}</p>
      <p className="mt-1 text-[11px] font-bold text-slate-500">{hint}</p>
    </div>
  );
}

function formatClockLabel(value: Date | null) {
  if (!value) return '-';
  return value.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function ActionRailItem({
  order,
  suggestion,
}: {
  order: number;
  suggestion: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-white/10 bg-white/10 px-3.5 py-3.5">
      <div className="flex items-start gap-3">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[11px] font-black text-[#FFB980]">
          {order}
        </div>
        <p className="text-sm font-bold leading-relaxed text-white/92">{suggestion}</p>
      </div>
    </div>
  );
}

function FocusedDayCard({
  day,
}: {
  day: AttendanceKpiDay | null;
}) {
  return (
    <div className="rounded-[1.7rem] border border-[#14295F]/10 bg-white/95 p-4 shadow-[0_22px_44px_-38px_rgba(20,41,95,0.34)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">선택 날짜 상세</p>
          <p className="mt-1 text-xs font-bold text-slate-500">현재 선택한 날짜의 실제 운영 기록을 바로 확인합니다.</p>
        </div>
        {day ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-black',
                getAttendanceStatusTone(day.status)
              )}
            >
              {ATTENDANCE_STATUS_LABELS[day.status]}
            </Badge>
            <Badge
              variant="outline"
              className="rounded-full border-[#14295F]/10 bg-[#F7F9FF] px-3 py-1 text-[11px] font-black text-[#14295F]"
            >
              {day.dateKey}
            </Badge>
          </div>
        ) : null}
      </div>
      {day ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-white px-3 py-1 text-[11px] font-black text-slate-600">
              {day.isScheduledDay ? '등원 예정일' : day.isOffDay ? '등원 없음' : '루틴 확인 필요'}
            </Badge>
            <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-white px-3 py-1 text-[11px] font-black text-slate-600">
              공부 {formatMinutesAsLabel(day.studyMinutes)}
            </Badge>
            <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-white px-3 py-1 text-[11px] font-black text-slate-600">
              외출 {day.awayCount > 0 ? `${day.awayCount}회` : '없음'}
            </Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DetailStat label="공부 시간" value={formatMinutesAsLabel(day.studyMinutes)} hint={day.dateLabel} />
            <DetailStat
              label="등원 오차"
              value={formatSignedMinutes(day.lateMinutes)}
              hint={day.expectedArrivalTime || '예정 시각 없음'}
              toneClass={day.lateMinutes > 0 ? 'text-amber-700' : 'text-emerald-700'}
            />
            <DetailStat
              label="외출"
              value={day.awayCount > 0 ? `${day.awayCount}회` : '없음'}
              hint={formatMinutesAsLabel(day.awayMinutes)}
              toneClass="text-sky-700"
            />
            <DetailStat
              label="하원"
              value={formatClockLabel(day.checkOutAt)}
              hint={day.hasCheckoutRecord ? '기록 완료' : '기록 없음'}
            />
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-[1.4rem] border border-dashed border-[#14295F]/10 bg-[#F8FAFF] px-4 py-6 text-sm font-bold text-slate-400">
          선택 가능한 출결 기록이 없습니다.
        </div>
      )}
    </div>
  );
}

function DetailPanel({
  row,
  onClose,
}: {
  row: AttendanceStudentKpiRow | null;
  onClose?: () => void;
}) {
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
  const prioritySuggestions = row.suggestions.slice(0, 2);

  return (
    <div className="space-y-4 rounded-[2.2rem] border border-[#14295F]/10 bg-white p-5 shadow-[0_30px_70px_-44px_rgba(20,41,95,0.35)]">
      <div className="overflow-hidden rounded-[1.95rem] border border-[#14295F]/10 bg-[linear-gradient(135deg,#F5F8FF_0%,#FFFFFF_58%,#FFF4EA_100%)] p-4 shadow-[0_26px_60px_-42px_rgba(20,41,95,0.32)] sm:p-5">
        <div className="grid gap-4">
          <div className="rounded-[1.75rem] border border-white/70 bg-white/95 p-5 shadow-[0_22px_44px_-38px_rgba(20,41,95,0.28)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#14295F]/45">선택 학생 브리프</p>
                <h3 className="text-[1.9rem] font-black tracking-[-0.05em] text-[#14295F]">{row.studentName}</h3>
                <p className="text-sm font-bold text-slate-500">{buildAttendanceStudentSubtitle(row)}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {onClose ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full border-[#14295F]/10 bg-white/90 font-black text-[#14295F]"
                    onClick={onClose}
                  >
                    상세 닫기
                  </Button>
                ) : null}
                <Badge className={cn('rounded-full border px-3 py-1 text-xs font-black', riskMeta.tone)}>{riskMeta.label}</Badge>
                <Badge className={cn('rounded-full border px-3 py-1 text-xs font-black', getRequestStatusTone(row.recentRequestStatus))}>
                  신청 {getRequestStatusLabel(row.recentRequestStatus)}
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-full border-[#14295F]/10 bg-[#F7F9FF] px-3 py-1 text-[10px] font-black text-[#14295F]"
                >
                  안정도 {row.stabilityScore}
                </Badge>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-[1.55rem] border border-[#14295F]/10 bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">오늘 핵심 이슈</p>
                <p className="mt-3 text-[1.2rem] font-black leading-relaxed tracking-[-0.03em] text-[#14295F]">{row.topIssue}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-[#F4F7FF] px-3 py-1 text-[11px] font-black text-[#14295F]">
                    출석 {row.presentDays}/{row.scheduledDays}일
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-white px-3 py-1 text-[11px] font-black text-slate-600">
                    지각 {row.lateCount}회
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-white px-3 py-1 text-[11px] font-black text-slate-600">
                    결석 {row.absenceCount}회
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-white px-3 py-1 text-[11px] font-black text-slate-600">
                    신청 {row.recentRequestCount}건
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <DetailStat label="출석률" value={`${row.attendanceRate}%`} hint={`지각 ${row.lateCount}회 · 결석 ${row.absenceCount}회`} />
                <DetailStat label="평균 외출" value={formatMinutesAsLabel(row.averageAwayMinutes)} hint={`${row.awayDayCount}일 · ${row.awayCount}회`} toneClass="text-sky-700" />
              </div>
            </div>
          </div>

          <div className="self-start rounded-[1.75rem] border border-[#14295F]/10 bg-[#14295F] p-5 text-white shadow-[0_28px_54px_-38px_rgba(20,41,95,0.55)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/60">바로 할 일</p>
                <p className="mt-2 text-sm font-bold leading-relaxed text-white/84">지금 이 학생에게 필요한 운영 후속 조치만 짧게 정리합니다.</p>
              </div>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                <CheckCircle2 className="size-4 text-[#FFB980]" />
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {prioritySuggestions.length === 0 ? (
                <div className="rounded-[1.25rem] border border-white/10 bg-white/10 px-4 py-4 text-sm font-bold leading-relaxed text-white/92">
                  추가 조치 없이 현재 흐름을 유지하면 됩니다. 오늘은 기록 누락만 가볍게 점검해 주세요.
                </div>
              ) : (
                prioritySuggestions.map((suggestion, index) => (
                  <ActionRailItem key={suggestion} order={index + 1} suggestion={suggestion} />
                ))
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
              <Badge className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-black text-white/86">
                최근 신청 {row.recentRequestCount}건
              </Badge>
              <Badge className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-black text-white/86">
                루틴 누락 {row.routineMissingCount}일
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          <FocusedDayCard day={focusedDay} />
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailStat label="최근 하원" value={row.latestCheckOutLabel} hint={`하원 기록 완료율 ${row.checkoutCompletionRate}%`} />
            <DetailStat label="신청 상태" value={getRequestStatusLabel(row.recentRequestStatus)} hint={`최근 신청 ${row.recentRequestCount}건`} />
            <DetailStat label="외출 빈도" value={`${row.awayCount}회`} hint={`${row.awayDayCount}일 동안 발생`} toneClass="text-sky-700" />
            <DetailStat label="등원 추세" value={formatSignedMinutes(row.averageArrivalOffsetMinutes)} hint="최근 유효 등원 평균" toneClass={row.averageArrivalOffsetMinutes > 0 ? 'text-amber-700' : 'text-emerald-700'} />
          </div>
        </div>
      </div>

      <AttendanceTimelineStrip row={row} focusedDateKey={focusedDateKey} onFocusDateKey={setFocusedDateKey} />

      <div className="rounded-[1.7rem] border border-[#14295F]/10 bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFF_100%)] p-4 shadow-[0_22px_44px_-38px_rgba(20,41,95,0.28)]">
        <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">등원 시각 추이</p>
              <p className="mt-1 text-xs font-bold text-slate-500">최근 5개 유효 등원 기록만 간결하게 보여줍니다.</p>
            </div>
            <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-[#F7F9FF] px-3 py-1 text-[11px] font-black text-[#14295F]">
              평균 {formatSignedMinutes(row.averageArrivalOffsetMinutes)}
            </Badge>
          </div>
          <div className="mt-4 space-y-2">
            {recentArrivalTrend.length === 0 ? (
              <div className="rounded-[1.4rem] border border-dashed border-[#14295F]/10 bg-[#F8FAFF] px-4 py-6 text-sm font-bold text-slate-400">
                등원 기록이 아직 충분하지 않습니다.
              </div>
            ) : (
              recentArrivalTrend.map((day) => (
                <div key={day.dateKey} className="flex items-center justify-between rounded-[1.25rem] border border-[#14295F]/10 bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFF_100%)] px-3 py-3">
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

      <div className="rounded-[1.7rem] border border-[#14295F]/10 bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFF_100%)] p-4 shadow-[0_22px_44px_-38px_rgba(20,41,95,0.28)]">
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
            <div className="rounded-[1.4rem] border border-dashed border-[#14295F]/10 bg-[#F8FAFF] px-4 py-6 text-sm font-bold text-slate-400">
              최근 기간 내 신청 내역이 없습니다.
            </div>
          ) : (
            requestPreview.map((request) => (
              <div key={request.id} className="rounded-[1.25rem] border border-[#14295F]/10 bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFF_100%)] px-3 py-3">
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
  anchorDate,
}: AttendanceKpiBoardProps) {
  const [periodDays, setPeriodDays] = useState<AttendanceKpiPeriod>(30);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [classFilter, setClassFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [requestFilter, setRequestFilter] = useState<RequestFilter>('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [showSupplementalMetrics, setShowSupplementalMetrics] = useState(false);
  const [isDesktopDetailOpen, setIsDesktopDetailOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const { viewMode } = useAppContext();
  const isMobile = viewMode === 'mobile';
  const isDesktop = !isMobile;
  const reduceMotion = useReducedMotion();

  const { isLoading, error, rows, summary, requestOperations, availableRooms, periodOptions, sourceDiagnostics, rangeEndKey } = useAttendanceKpi({
    firestore,
    centerId,
    students,
    requests,
    attendanceCurrentDocs,
    periodDays,
    anchorDate,
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
      if (deferredSearch && !row.studentName.toLowerCase().includes(deferredSearch.toLowerCase())) return false;
      if (classFilter !== 'all' && row.className !== classFilter) return false;
      if (roomFilter !== 'all' && row.roomId !== roomFilter) return false;
      if (riskFilter !== 'all' && row.riskLevel !== riskFilter) return false;
      if (requestFilter !== 'all' && row.recentRequestStatus !== requestFilter) return false;
      return true;
    });
  }, [classFilter, deferredSearch, requestFilter, riskFilter, roomFilter, rows]);

  useEffect(() => {
    if (!filteredRows.length) {
      setSelectedStudentId(null);
      setIsDesktopDetailOpen(false);
      setMobileDetailOpen(false);
      return;
    }
    if (!selectedStudentId || !filteredRows.some((row) => row.studentId === selectedStudentId)) {
      setSelectedStudentId(filteredRows[0]!.studentId);
      setIsDesktopDetailOpen(isDesktop);
      setMobileDetailOpen(false);
    }
  }, [filteredRows, isDesktop, selectedStudentId]);

  useEffect(() => {
    setShowAllStudents(false);
    if (!filteredRows.length) return;
    if (isDesktop) {
      setIsDesktopDetailOpen(true);
      setMobileDetailOpen(false);
      return;
    }
    setIsDesktopDetailOpen(false);
    setMobileDetailOpen(false);
  }, [deferredSearch, classFilter, filteredRows.length, isDesktop, periodDays, requestFilter, riskFilter, roomFilter]);

  const selectedRow = filteredRows.find((row) => row.studentId === selectedStudentId) || filteredRows[0] || null;
  const visibleRows = showAllStudents ? filteredRows : filteredRows.slice(0, 5);
  const hasMoreRows = filteredRows.length > 5;
  const periodLabel = periodOptions.find((option) => option.value === periodDays)?.label ?? `${periodDays}일`;
  const activeFilterCount =
    Number(Boolean(search.trim())) +
    Number(classFilter !== 'all') +
    Number(roomFilter !== 'all') +
    Number(riskFilter !== 'all') +
    Number(requestFilter !== 'all');
  const summaryHighlight = useMemo(() => {
    if (summary.criticalCount > 0) {
      return `긴급 ${summary.criticalCount}명부터 먼저 확인해야 합니다. 무단결석과 하원 누락 우선 점검이 필요합니다.`;
    }
    if (summary.riskCount > 0) {
      return `위험 ${summary.riskCount}명을 중심으로 지각과 외출 패턴부터 정리하면 운영 리듬이 빨리 안정됩니다.`;
    }
    return '전체 흐름은 비교적 안정적입니다. 반복 지각과 외출 시간만 미세 조정하면 됩니다.';
  }, [summary.criticalCount, summary.riskCount]);
  const operationsHighlight =
    requestOperations.overduePendingCount > 0
      ? `24시간 초과 요청 ${requestOperations.overduePendingCount}건이 있어 먼저 닫아야 합니다.`
      : requestOperations.pendingTodayCount > 0
        ? `오늘 처리할 신청 ${requestOperations.pendingTodayCount}건을 우선 확인하면 됩니다.`
        : '신청 처리 흐름은 안정적입니다.';

  const primaryMetrics = [
    {
      label: '출석률',
      value: `${summary.attendanceRate}%`,
      hint: '기준 루틴 대비 실제 출석 비율',
      icon: UserCheck,
      accentClass: 'border-emerald-100 bg-[linear-gradient(180deg,#FFFFFF_0%,#F5FFF9_100%)]',
      iconClass: 'border-emerald-100 bg-emerald-50 text-emerald-600',
    },
    {
      label: '지각률',
      value: `${summary.lateRate}%`,
      hint: '반복 지각 패턴 우선 확인',
      icon: Clock3,
      accentClass: 'border-amber-100 bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF9F2_100%)]',
      iconClass: 'border-amber-100 bg-amber-50 text-amber-600',
    },
    {
      label: '무단결석률',
      value: `${summary.unexcusedAbsenceRate}%`,
      hint: '즉시 상담이 필요한 결석 비율',
      icon: ShieldAlert,
      accentClass: 'border-rose-100 bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF5F7_100%)]',
      iconClass: 'border-rose-100 bg-rose-50 text-rose-600',
    },
  ] as const;

  const secondaryMetrics = [
    {
      label: '평균 외출',
      value: formatMinutesAsLabel(summary.averageAwayMinutes),
      hint: '학습 흐름 이탈 평균 시간',
      icon: DoorOpen,
      accentClass: 'border-sky-100 bg-[linear-gradient(180deg,#FFFFFF_0%,#F4FAFF_100%)]',
      iconClass: 'border-sky-100 bg-sky-50 text-sky-600',
    },
    {
      label: '하원 완료율',
      value: `${summary.checkoutCompletionRate}%`,
      hint: '보호자 안내까지 닫힌 기록 비율',
      icon: MapPinned,
      accentClass: 'border-[#14295F]/10 bg-[linear-gradient(180deg,#FFFFFF_0%,#F5F8FF_100%)]',
      iconClass: 'border-[#14295F]/10 bg-[#F4F7FF] text-[#14295F]',
    },
    {
      label: '신청 SLA',
      value: `${summary.requestSlaComplianceRate}%`,
      hint: '신청을 제때 처리한 운영 비율',
      icon: CalendarClock,
      accentClass: 'border-violet-100 bg-[linear-gradient(180deg,#FFFFFF_0%,#FAF6FF_100%)]',
      iconClass: 'border-violet-100 bg-violet-50 text-violet-600',
    },
  ] as const;

  const operationsMetrics = [
    {
      label: '오늘 대기 신청',
      value: `${requestOperations.pendingTodayCount}`,
      hint: '당일 처리 필요한 요청',
      icon: Sparkles,
    },
    {
      label: '24시간 초과 미처리',
      value: `${requestOperations.overduePendingCount}`,
      hint: '운영 후속 지연 요청',
      icon: ShieldAlert,
    },
    {
      label: '평균 처리시간',
      value: `${requestOperations.averageProcessingHours}h`,
      hint: '신청 응답 속도',
      icon: Clock3,
    },
    {
      label: '반복 신청 학생',
      value: `${requestOperations.repeatRequesterCount}`,
      hint: '반복 보호자 커뮤니케이션 대상',
      icon: UserCheck,
    },
  ] as const;

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    if (isDesktop) {
      setIsDesktopDetailOpen(true);
      return;
    }
    setMobileDetailOpen(true);
  };

  return (
    <Card className="overflow-hidden rounded-[2.8rem] border border-[#14295F]/10 bg-[linear-gradient(180deg,#F8FAFF_0%,#FFFFFF_32%,#FFFFFF_100%)] shadow-[0_30px_90px_-54px_rgba(20,41,95,0.35)]">
      <CardHeader className="space-y-4 p-5 sm:p-6">
        <div className="rounded-[2rem] border border-[#14295F]/10 bg-white p-5 shadow-[0_20px_45px_-38px_rgba(20,41,95,0.26)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full border border-[#14295F]/10 bg-[#F4F7FF] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#14295F]">
                  출결 KPI 보드
                </Badge>
                <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-white px-3 py-1 text-[10px] font-black text-slate-600">
                  기간 {periodLabel}
                </Badge>
                <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-white px-3 py-1 text-[10px] font-black text-slate-600">
                  기준 {rangeEndKey}
                </Badge>
                <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-white px-3 py-1 text-[10px] font-black text-slate-600">
                  결과 {filteredRows.length}명
                </Badge>
                <Badge className="rounded-full border border-[#FFB980]/30 bg-[#FF7A16] px-3 py-1 text-[10px] font-black text-white">
                  필터 {activeFilterCount}개
                </Badge>
              </div>
              <div>
                <h2 className="text-[1.75rem] font-black tracking-[-0.05em] text-[#14295F]">출결 KPI 보드</h2>
                <p className="mt-2 max-w-3xl line-clamp-2 text-sm font-bold leading-relaxed text-slate-600">
                  {summaryHighlight}
                </p>
                <p className="mt-1 line-clamp-1 text-xs font-bold leading-relaxed text-slate-500">{operationsHighlight}</p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[270px]">
              <Badge className="justify-center rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-2.5 text-[11px] font-black text-rose-700">
                긴급 {summary.criticalCount}
              </Badge>
              <Badge className="justify-center rounded-[1rem] border border-orange-200 bg-orange-50 px-4 py-2.5 text-[11px] font-black text-orange-700">
                위험 {summary.riskCount}
              </Badge>
              <Badge className="justify-center rounded-[1rem] border border-sky-200 bg-sky-50 px-4 py-2.5 text-[11px] font-black text-sky-700">
                주의 {summary.watchCount}
              </Badge>
              <Badge className="justify-center rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[11px] font-black text-emerald-700">
                안정 {summary.stableCount}
              </Badge>
            </div>
          </div>
        </div>

        <SourceDiagnosticsStrip diagnostics={sourceDiagnostics} />

        <div className="grid gap-3 xl:grid-cols-3">
          {primaryMetrics.map((metric) => (
            <MetricSummaryCard key={metric.label} {...metric} />
          ))}
        </div>

        <div className="rounded-[1.8rem] border border-[#14295F]/10 bg-[#F8FAFF] p-4 shadow-[0_16px_34px_-36px_rgba(20,41,95,0.28)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">보조 지표</p>
              <p className="mt-1 text-xs font-bold text-slate-500">평균 외출, 하원 완료율, 신청 SLA와 운영 스트립은 필요할 때만 펼쳐 봅니다.</p>
            </div>
            <Button
              variant="outline"
              className="rounded-full border-[#14295F]/10 bg-white font-black text-[#14295F]"
              onClick={() => setShowSupplementalMetrics((prev) => !prev)}
            >
              {showSupplementalMetrics ? '보조 지표 접기' : '보조 지표 더 보기'}
            </Button>
          </div>
          <AnimatePresence initial={false}>
            {showSupplementalMetrics ? (
              <motion.div
                key="supplemental-metrics"
                initial={reduceMotion ? false : { opacity: 0, height: 0, y: -8 }}
                animate={reduceMotion ? undefined : { opacity: 1, height: 'auto', y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, height: 0, y: -8 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-4 border-t border-[#14295F]/8 pt-4">
                  <div className="grid gap-3 xl:grid-cols-3">
                    {secondaryMetrics.map((metric) => (
                      <MetricSummaryCard key={metric.label} {...metric} />
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {operationsMetrics.map((metric) => (
                      <OpsSummaryCard key={metric.label} {...metric} />
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.25, delay: 0.08 }}
          className="sticky top-0 z-10 rounded-[2rem] border border-[#14295F]/10 bg-white/96 p-4 shadow-[0_18px_36px_-30px_rgba(20,41,95,0.28)] backdrop-blur-md"
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_repeat(5,minmax(0,1fr))]">
            <div className="flex h-12 items-center gap-3 rounded-[1.25rem] border border-[#14295F]/10 bg-[#F8FAFF] px-4">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="학생명 검색"
                className="h-9 border-none bg-transparent px-0 font-bold text-[#14295F] shadow-none placeholder:text-slate-400 focus-visible:ring-0"
              />
            </div>
            <Select value={periodDays.toString()} onValueChange={(value) => setPeriodDays(Number(value) as AttendanceKpiPeriod)}>
              <SelectTrigger className="h-12 rounded-[1.25rem] border-[#14295F]/10 bg-[#F8FAFF] font-bold text-[#14295F]">
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
              <SelectTrigger className="h-12 rounded-[1.25rem] border-[#14295F]/10 bg-[#F8FAFF] font-bold text-[#14295F]">
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
              <SelectTrigger className="h-12 rounded-[1.25rem] border-[#14295F]/10 bg-[#F8FAFF] font-bold text-[#14295F]">
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
              <SelectTrigger className="h-12 rounded-[1.25rem] border-[#14295F]/10 bg-[#F8FAFF] font-bold text-[#14295F]">
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
              <SelectTrigger className="h-12 rounded-[1.25rem] border-[#14295F]/10 bg-[#F8FAFF] font-bold text-[#14295F]">
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
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#14295F]/8 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-white px-3 py-1 text-[11px] font-black text-[#14295F]">
                기간 {periodLabel}
              </Badge>
              <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-white px-3 py-1 text-[11px] font-black text-slate-600">
                기준 {rangeEndKey}
              </Badge>
              <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-white px-3 py-1 text-[11px] font-black text-slate-600">
                활성 필터 {activeFilterCount}개
              </Badge>
              <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-white px-3 py-1 text-[11px] font-black text-slate-600">
                결과 {filteredRows.length}명
              </Badge>
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
              현재 위험도 높은 순 정렬 · 기본 TOP 5 노출
            </p>
          </div>
        </motion.div>
      </CardHeader>

      <CardContent className="px-5 pb-5 sm:px-8 sm:pb-8">
        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-[#14295F] opacity-20" />
          </div>
        ) : error ? (
          <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
            {error}
          </div>
        ) : (
          <div className={cn('grid gap-6', isDesktopDetailOpen && selectedRow ? 'xl:grid-cols-[minmax(0,1.04fr)_minmax(420px,0.96fr)]' : 'grid-cols-1')}>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">학생 우선순위</p>
                  <h3 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#14295F]">지금 먼저 봐야 할 학생</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-[#F8FAFF] px-3 py-1 text-[11px] font-black text-[#14295F]">
                    위험도 · 출석 흐름 기준
                  </Badge>
                  {hasMoreRows && !showAllStudents ? (
                    <Badge variant="outline" className="rounded-full border-[#14295F]/10 bg-white px-3 py-1 text-[11px] font-black text-slate-600">
                      상위 5명만 표시중
                    </Badge>
                  ) : null}
                </div>
              </div>
              {filteredRows.length === 0 ? (
                <div className="rounded-[2rem] border border-dashed border-[#14295F]/15 bg-[#F8FAFF] px-6 py-16 text-center">
                  <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-black text-slate-500">조건에 맞는 학생이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleRows.map((row, index) => (
                    <StudentPriorityCard
                      key={row.studentId}
                      row={row}
                      index={index}
                      isSelected={Boolean(
                        isDesktop
                          ? isDesktopDetailOpen && selectedRow?.studentId === row.studentId
                          : mobileDetailOpen && selectedRow?.studentId === row.studentId
                      )}
                      onSelect={() => handleSelectStudent(row.studentId)}
                    />
                  ))}
                  {hasMoreRows ? (
                    <div className="flex justify-center pt-2">
                      <Button
                        variant="outline"
                        className="rounded-full border-[#14295F]/10 bg-white font-black text-[#14295F]"
                        onClick={() => setShowAllStudents((prev) => !prev)}
                      >
                        {showAllStudents ? 'TOP 5만 다시 보기' : `전체 학생 보기 (${filteredRows.length}명)`}
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className={cn('hidden xl:block', !isDesktopDetailOpen || !selectedRow ? 'xl:hidden' : '')}>
              <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={selectedRow?.studentId ?? 'empty'}
                    initial={reduceMotion ? false : { opacity: 0, x: 18 }}
                    animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.22 }}
                  >
                    <DetailPanel row={selectedRow} onClose={() => setIsDesktopDetailOpen(false)} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <Sheet open={!isDesktop && mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
        <SheetContent side="bottom" motionPreset="dashboard-premium" className="max-h-[88vh] overflow-y-auto rounded-t-[2rem] border-none px-0 pb-8 pt-12">
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
