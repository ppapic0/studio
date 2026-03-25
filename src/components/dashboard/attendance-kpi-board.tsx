import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, CalendarClock, Clock3, DoorClosed, Loader2, Search, TriangleAlert, Users } from 'lucide-react';
import { Firestore } from 'firebase/firestore';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
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

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_18px_38px_-30px_rgba(15,23,42,0.45)]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
          <p className="text-2xl font-black tracking-tight text-[#14295F]">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#14295F]">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-xs font-bold text-slate-500">{hint}</p>
    </div>
  );
}

function TimelineStrip({ row }: { row: AttendanceStudentKpiRow }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">최근 출결 스트립</p>
        <p className="text-[11px] font-bold text-slate-500">기본 {row.timeline.length}일</p>
      </div>
      <div className="grid grid-cols-7 gap-2 sm:grid-cols-10 lg:grid-cols-6 xl:grid-cols-10">
        {row.timeline.map((day) => (
          <div
            key={`${row.studentId}-${day.dateKey}`}
            title={`${day.dateKey} · ${ATTENDANCE_STATUS_LABELS[day.status]} · 공부 ${formatMinutesAsLabel(day.studyMinutes)}`}
            className={cn(
              'rounded-2xl border p-2 shadow-sm',
              getAttendanceStatusTone(day.status),
              day.isOffDay && 'opacity-65'
            )}
          >
            <p className="text-[10px] font-black">{day.dateLabel}</p>
            <p className="mt-1 truncate text-[10px] font-bold">
              {day.status === 'confirmed_late'
                ? `지각 ${day.lateMinutes}분`
                : day.status === 'confirmed_absent'
                  ? '무단결석'
                  : ATTENDANCE_STATUS_LABELS[day.status]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailPanel({ row }: { row: AttendanceStudentKpiRow | null }) {
  if (!row) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white/80 p-8 text-center text-sm font-bold text-slate-400">
        학생을 선택하면 개인 출결 KPI와 조치 권장안을 볼 수 있습니다.
      </div>
    );
  }

  const riskMeta = getAttendanceRiskMeta(row.stabilityScore);
  const recentArrivalTrend = row.timeline
    .filter((day) => day.isScheduledDay && day.expectedArrivalAt && day.checkedAt)
    .slice(-7)
    .reverse();

  return (
    <div className="space-y-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.34)]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">학생 개인 KPI</p>
            <h3 className="mt-1 text-2xl font-black tracking-tight text-[#14295F]">{row.studentName}</h3>
            <p className="mt-1 text-sm font-bold text-slate-500">{buildAttendanceStudentSubtitle(row)}</p>
          </div>
          <Badge className={cn('rounded-full border px-3 py-1 text-xs font-black', riskMeta.tone)}>
            {riskMeta.label} · 안정도 {row.stabilityScore}
          </Badge>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-sm font-black text-[#14295F]">{row.topIssue}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600">
              출석률 {row.attendanceRate}%
            </Badge>
            <Badge variant="outline" className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600">
              지각 {row.lateCount}회
            </Badge>
            <Badge variant="outline" className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600">
              무단결석 {row.absenceCount}회
            </Badge>
            <Badge variant="outline" className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600">
              평균 외출 {formatMinutesAsLabel(row.averageAwayMinutes)}
            </Badge>
          </div>
        </div>
      </div>

      <TimelineStrip row={row} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">등원 시각 추이</p>
          <div className="mt-3 space-y-2">
            {recentArrivalTrend.length === 0 ? (
              <p className="text-sm font-bold text-slate-400">등원 기록이 아직 충분하지 않습니다.</p>
            ) : (
              recentArrivalTrend.map((day) => (
                <div key={day.dateKey} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
                  <span className="text-sm font-black text-[#14295F]">{day.dateLabel}</span>
                  <span className={cn('text-xs font-black', day.lateMinutes > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                    {formatSignedMinutes(day.lateMinutes)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">운영 조치 추천</p>
          <div className="mt-3 space-y-2">
            {row.suggestions.length === 0 ? (
              <p className="text-sm font-bold text-slate-400">추가 조치 없이도 안정적으로 운영 중입니다.</p>
            ) : (
              row.suggestions.map((suggestion) => (
                <div key={suggestion} className="rounded-2xl bg-white px-3 py-3 text-sm font-bold text-slate-700">
                  {suggestion}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">평균 등원 오차</p>
          <p className="mt-2 text-lg font-black text-[#14295F]">{formatSignedMinutes(row.averageArrivalOffsetMinutes)}</p>
        </div>
        <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">하원 기록 완료율</p>
          <p className="mt-2 text-lg font-black text-[#14295F]">{row.checkoutCompletionRate}%</p>
        </div>
        <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">외출 빈도</p>
          <p className="mt-2 text-lg font-black text-[#14295F]">{row.awayDayCount}일 / {row.awayCount}회</p>
        </div>
        <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">최근 하원</p>
          <p className="mt-2 text-lg font-black text-[#14295F]">{row.latestCheckOutLabel}</p>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">출결 신청 이력</p>
            <p className="mt-1 text-sm font-bold text-slate-500">최근 {row.requestHistory.length}건</p>
          </div>
          <Badge variant="outline" className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600">
            최근 상태 {row.recentRequestStatus === 'none' ? '없음' : row.recentRequestStatus}
          </Badge>
        </div>
        <div className="mt-3 space-y-2">
          {row.requestHistory.length === 0 ? (
            <p className="text-sm font-bold text-slate-400">최근 기간 내 신청 내역이 없습니다.</p>
          ) : (
            row.requestHistory.slice(0, 5).map((request) => (
              <div key={request.id} className="rounded-2xl bg-white px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[#14295F]">
                      {request.type === 'late' ? '지각 신청' : '결석 신청'} · {request.date}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{request.reason || '사유 없음'}</p>
                  </div>
                  <Badge variant="outline" className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600">
                    {request.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
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

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    if (!isDesktop) {
      setMobileDetailOpen(true);
    }
  };

  return (
    <Card className="rounded-[2.5rem] border-none bg-white shadow-xl ring-1 ring-border/50">
      <CardHeader className="space-y-5 border-b bg-muted/5 p-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="grid gap-1">
            <CardTitle className="text-xl font-black tracking-tight">출결 KPI 보드</CardTitle>
            <CardDescription className="text-xs font-bold text-muted-foreground">
              누적 출석, 지각, 외출, 하원 기록과 신청 처리 속도를 한 화면에서 관리합니다.
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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <SummaryCard label="출석률" value={`${summary.attendanceRate}%`} hint="루틴 기준 실제 출석 비율" icon={Users} />
          <SummaryCard label="지각률" value={`${summary.lateRate}%`} hint="반복 지각 위험 확인" icon={Clock3} />
          <SummaryCard label="무단결석률" value={`${summary.unexcusedAbsenceRate}%`} hint="즉시 상담 우선순위" icon={TriangleAlert} />
          <SummaryCard label="평균 외출시간" value={formatMinutesAsLabel(summary.averageAwayMinutes)} hint="학습 흐름 이탈 평균" icon={ArrowRight} />
          <SummaryCard label="하원 기록 완료율" value={`${summary.checkoutCompletionRate}%`} hint="보호자 커뮤니케이션 안정도" icon={DoorClosed} />
          <SummaryCard label="SLA 준수율" value={`${summary.requestSlaComplianceRate}%`} hint="신청 처리 마감 준수" icon={CalendarClock} />
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,1fr))]">
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
              <SelectItem value="all" className="font-bold">전체 신청 상태</SelectItem>
              <SelectItem value="requested" className="font-bold">대기</SelectItem>
              <SelectItem value="approved" className="font-bold">승인</SelectItem>
              <SelectItem value="rejected" className="font-bold">반려</SelectItem>
              <SelectItem value="none" className="font-bold">신청 없음</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">오늘 대기 신청</p>
            <p className="mt-2 text-2xl font-black tracking-tight text-[#14295F]">{requestOperations.pendingTodayCount}</p>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">24시간 초과 미처리</p>
            <p className="mt-2 text-2xl font-black tracking-tight text-[#14295F]">{requestOperations.overduePendingCount}</p>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">평균 처리시간</p>
            <p className="mt-2 text-2xl font-black tracking-tight text-[#14295F]">{requestOperations.averageProcessingHours}h</p>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">반복 신청 학생</p>
            <p className="mt-2 text-2xl font-black tracking-tight text-[#14295F]">{requestOperations.repeatRequesterCount}</p>
          </div>
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
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.9fr)]">
            <div className="space-y-3">
              {filteredRows.length === 0 ? (
                <div className="rounded-[2rem] border border-dashed border-slate-200 bg-slate-50/70 px-6 py-16 text-center">
                  <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-black text-slate-500">조건에 맞는 학생이 없습니다.</p>
                </div>
              ) : (
                filteredRows.map((row) => {
                  const riskMeta = getAttendanceRiskMeta(row.stabilityScore);
                  const isSelected = selectedRow?.studentId === row.studentId;
                  return (
                    <button
                      key={row.studentId}
                      type="button"
                      onClick={() => handleSelectStudent(row.studentId)}
                      className={cn(
                        'w-full rounded-[2rem] border p-5 text-left transition-all',
                        isSelected
                          ? 'border-[#14295F] bg-[linear-gradient(180deg,#ffffff_0%,#f5f8ff_100%)] shadow-[0_20px_50px_-34px_rgba(20,41,95,0.45)]'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-black tracking-tight text-[#14295F]">{row.studentName}</p>
                            <Badge variant="outline" className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600">
                              {row.className}
                            </Badge>
                            <Badge variant="outline" className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600">
                              {row.roomLabel}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm font-bold text-slate-500">{row.topIssue}</p>
                        </div>
                        <div className="text-right">
                          <Badge className={cn('rounded-full border px-3 py-1 text-xs font-black', riskMeta.tone)}>
                            {riskMeta.label}
                          </Badge>
                          <p className="mt-2 text-2xl font-black tracking-tight text-[#14295F]">{row.stabilityScore}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">출석률</p>
                          <p className="mt-1 text-base font-black text-[#14295F]">{row.attendanceRate}%</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">지각</p>
                          <p className="mt-1 text-base font-black text-[#14295F]">{row.lateCount}회</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">무단결석</p>
                          <p className="mt-1 text-base font-black text-[#14295F]">{row.absenceCount}회</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">평균 외출</p>
                          <p className="mt-1 text-base font-black text-[#14295F]">{formatMinutesAsLabel(row.averageAwayMinutes)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">최근 하원</p>
                          <p className="mt-1 text-base font-black text-[#14295F]">{row.latestCheckOutLabel}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">신청 상태</p>
                          <p className="mt-1 text-base font-black text-[#14295F]">
                            {row.recentRequestStatus === 'none' ? '없음' : row.recentRequestStatus}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
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
