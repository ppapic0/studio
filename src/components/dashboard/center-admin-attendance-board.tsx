'use client';

import Link from 'next/link';
import { ClipboardCheck, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  getAttendanceBoardPresentation,
  type CenterAdminAttendanceBoardSummary,
  type CenterAdminAttendanceSeatSignal,
} from '@/lib/center-admin-attendance-board';
import type { AttendanceCurrent, CenterMembership, LayoutRoomConfig, StudentProfile } from '@/lib/types';
import { cn } from '@/lib/utils';

type ResolvedAttendanceSeat = AttendanceCurrent & {
  roomId: string;
  roomSeatNo: number;
};

type CenterAdminAttendanceBoardProps = {
  roomConfigs: LayoutRoomConfig[];
  selectedRoomView: 'all' | string;
  selectedClass: string;
  isMobile: boolean;
  seatDetailLevel?: 'default' | 'nameOnly';
  variant?: 'default' | 'teacherEditorial';
  isLoading: boolean;
  summary: CenterAdminAttendanceBoardSummary;
  seatSignalsBySeatId: Map<string, CenterAdminAttendanceSeatSignal>;
  studentsById: Map<string, StudentProfile>;
  studentMembersById: Map<string, CenterMembership>;
  getSeatForRoom: (room: LayoutRoomConfig, roomSeatNo: number) => ResolvedAttendanceSeat;
  onSeatClick: (seat: AttendanceCurrent) => void;
};

export function CenterAdminAttendanceBoard({
  roomConfigs,
  selectedRoomView,
  selectedClass,
  isMobile,
  seatDetailLevel = 'default',
  variant = 'default',
  isLoading,
  summary,
  seatSignalsBySeatId,
  studentsById,
  studentMembersById,
  getSeatForRoom,
  onSeatClick,
}: CenterAdminAttendanceBoardProps) {
  const isTeacherEditorial = variant === 'teacherEditorial';
  const summaryItems = isTeacherEditorial
    ? [
        { label: '미입실/지각', value: summary.lateOrAbsentCount, tone: 'bg-rose-100 text-rose-700' },
        { label: '장기외출', value: summary.longAwayCount, tone: 'bg-amber-100 text-amber-700' },
        { label: '루틴 누락', value: summary.routineMissingCount, tone: 'bg-[#FFF2E8] text-[#C95A08]' },
        { label: '외출 중', value: summary.awayCount, tone: 'bg-amber-50 text-amber-700' },
        { label: '공부 중', value: summary.normalPresentCount, tone: 'bg-[#EEF4FF] text-[#2554D7]' },
        { label: '복귀 후 공부', value: summary.returnedCount, tone: 'bg-cyan-100 text-cyan-700' },
        { label: '퇴실', value: summary.checkedOutCount, tone: 'bg-slate-200 text-slate-700' },
      ]
    : [
        { label: '공부 중', value: summary.normalPresentCount, tone: 'bg-sky-200 text-sky-800' },
        { label: '미입실/지각', value: summary.lateOrAbsentCount, tone: 'bg-rose-200 text-rose-800' },
        { label: '루틴 누락', value: summary.routineMissingCount, tone: 'bg-orange-200 text-orange-800' },
        { label: '외출 중', value: summary.awayCount, tone: 'bg-amber-200 text-amber-800' },
        { label: '복귀 후 공부', value: summary.returnedCount, tone: 'bg-cyan-200 text-cyan-800' },
        { label: '퇴실', value: summary.checkedOutCount, tone: 'bg-slate-300 text-slate-800' },
        { label: '장기외출', value: summary.longAwayCount, tone: 'bg-amber-300 text-amber-900' },
      ];

  const roomSignals = roomConfigs.map((room) => {
    let focusedCount = 0;
    let awayCount = 0;
    let checkedOutCount = 0;

    for (let roomSeatNo = 1; roomSeatNo <= room.rows * room.cols; roomSeatNo += 1) {
      const seat = getSeatForRoom(room, roomSeatNo);
      if (!seat.studentId || seat.type === 'aisle') continue;
      const signal = seatSignalsBySeatId.get(seat.id);
      if (!signal) continue;
      if (signal.boardStatus === 'present' || signal.boardStatus === 'returned') focusedCount += 1;
      if (signal.boardStatus === 'away') awayCount += 1;
      if (signal.boardStatus === 'checked_out') checkedOutCount += 1;
    }

    return {
      id: room.id,
      name: room.name,
      rows: room.rows,
      cols: room.cols,
      focusedCount,
      awayCount,
      checkedOutCount,
    };
  });

  const renderGrid = (room: LayoutRoomConfig, compact = false) => (
    <ScrollArea className="w-full max-w-full">
      <div
        className={cn(
          'mx-auto w-fit rounded-[2.2rem] border border-muted/30 bg-[#fafafa]',
          compact ? 'p-3 sm:p-4' : isMobile ? 'p-4' : 'p-6 sm:p-8'
        )}
      >
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${room.cols}, minmax(${compact ? 52 : 64}px, 1fr))` }}
        >
          {Array.from({ length: room.cols }).map((_, colIndex) => (
            <div key={`${room.id}_${colIndex}`} className="flex flex-col gap-2">
              {Array.from({ length: room.rows }).map((_, rowIndex) => {
                const roomSeatNo = colIndex * room.rows + rowIndex + 1;
                const seat = getSeatForRoom(room, roomSeatNo);
                const studentId = typeof seat.studentId === 'string' ? seat.studentId : '';
                const student = studentId ? studentsById.get(studentId) : undefined;
                const member = studentId ? studentMembersById.get(studentId) : undefined;
                const signal = studentId ? seatSignalsBySeatId.get(seat.id) || null : null;
                const presentation = signal ? getAttendanceBoardPresentation(signal) : null;
                const resolvedPresentation = presentation || {
                  surfaceClass: 'border-primary/20 bg-white text-slate-700',
                  chipClass: 'bg-slate-100 text-slate-700',
                  chipLabel: '확인중',
                  flagClass: 'bg-slate-100 text-slate-600',
                  isDark: false,
                };
                const isAisle = seat.type === 'aisle';
                const isFilteredOut = selectedClass !== 'all' && member?.className !== selectedClass;
                const displayName =
                  signal?.studentName ||
                  student?.name ||
                  member?.displayName ||
                  '학생';
                const isNameOnly = seatDetailLevel === 'nameOnly';
                const studyTimeLabel = signal?.todayStudyLabel || '0h 0m';
                const compactStudyTimeLabel = studyTimeLabel.replace(/\s+/g, '');
                const seatShellClass = isTeacherEditorial
                  ? compact
                    ? 'min-w-[56px] rounded-[1.1rem] p-1'
                    : 'min-w-[70px] rounded-[1.3rem] p-1.5'
                  : compact
                    ? 'min-w-[52px] rounded-[1rem] p-1'
                    : 'min-w-[64px] rounded-2xl p-1.5';
                const seatToneClass = isTeacherEditorial && seat.studentId
                  ? 'shadow-[0_16px_28px_-24px_rgba(20,41,95,0.28)]'
                  : '';
                const emptySeatClass = isTeacherEditorial
                  ? 'cursor-default border-[#D9E6FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F6F9FF_100%)] text-primary/20'
                  : 'cursor-default border-primary/30 bg-white';
                const nameClass = cn(
                  'w-full text-center font-black tracking-tight whitespace-normal break-keep',
                  compact
                    ? isTeacherEditorial
                      ? 'min-h-[22px] line-clamp-2 text-[10px] leading-[1.12] text-slate-950'
                      : 'min-h-[22px] line-clamp-2 text-[10px] leading-[1.12] text-slate-950'
                    : isNameOnly
                      ? isTeacherEditorial
                        ? 'min-h-[30px] line-clamp-2 text-[11px] leading-[1.22] text-slate-950'
                        : 'min-h-[28px] line-clamp-2 text-[11px] leading-[1.2] text-slate-950'
                      : isTeacherEditorial
                        ? 'min-h-[32px] line-clamp-2 text-[11px] leading-[1.18] text-slate-950'
                        : 'min-h-[28px] line-clamp-2 text-[11px] leading-[1.15] text-slate-950'
                );
                const timeChipClass = isTeacherEditorial
                  ? compact
                    ? 'mt-1 px-1.5 py-0.5 text-[7px] leading-none'
                    : 'mt-1.5 px-2 py-0.5 text-[8px] leading-none'
                  : compact
                    ? 'mt-1 px-1 py-0.5 text-[7px] leading-none'
                    : 'mt-1.5 px-1.5 py-0.5 text-[8px] leading-none';

                return (
                  <button
                    key={`${room.id}_${roomSeatNo}`}
                    type="button"
                    onClick={() => {
                      if (!isAisle && seat.studentId) {
                        onSeatClick(seat);
                      }
                    }}
                    disabled={!seat.studentId || isAisle}
                    className={cn(
                      'relative aspect-square overflow-hidden border-2 text-left shadow-sm transition-all',
                      seatShellClass,
                      isAisle
                        ? 'cursor-default border-transparent bg-transparent'
                        : seat.studentId
                          ? 'cursor-pointer'
                          : emptySeatClass,
                      seat.studentId ? resolvedPresentation.surfaceClass : '',
                      seatToneClass,
                      isFilteredOut && 'border-transparent bg-muted/10 opacity-20 grayscale'
                    )}
                  >
                    {!isAisle && (
                      <span
                        className={cn(
                          'absolute left-1.5 top-1 font-black opacity-40',
                          compact ? 'text-[6px]' : 'text-[7px]'
                        )}
                      >
                        {roomSeatNo}
                      </span>
                    )}

                    {isAisle ? null : seat.studentId ? (
                      <div
                        className={cn(
                          'flex h-full w-full flex-col text-center',
                          compact
                            ? 'items-center justify-center px-1 pb-1 pt-3'
                            : isNameOnly
                              ? 'items-center justify-center px-1.5 py-1'
                              : 'items-center justify-center gap-1 px-1.5 py-1'
                        )}
                      >
                        <span
                          className={nameClass}
                        >
                          {displayName}
                        </span>
                        <span
                          className={cn(
                            'inline-flex max-w-full items-center justify-center rounded-full border border-black/5 bg-white/80 font-black tracking-tight whitespace-nowrap text-slate-700 shadow-sm',
                            timeChipClass
                          )}
                        >
                          {compactStudyTimeLabel}
                        </span>
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span
                          className={cn(
                            'font-black uppercase tracking-tighter text-primary/40',
                            compact ? 'text-[6px]' : 'text-[7px]'
                          )}
                        >
                          빈좌석
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );

  return (
    <section className="px-4">
      <Card
        className={cn(
          isTeacherEditorial
            ? 'marketing-card overflow-hidden rounded-[2.75rem] border-none'
            : 'overflow-hidden rounded-[2.5rem] border-none bg-white shadow-sm ring-1 ring-black/5'
        )}
      >
        <CardContent className={cn('space-y-5', isMobile ? 'p-4' : 'p-5 sm:p-6')}>
          {isTeacherEditorial ? (
            <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-start justify-between')}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="h-6 rounded-full border-none bg-[#14295F] px-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                    출석 관제 도면
                  </Badge>
                  {selectedClass !== 'all' && (
                    <Badge className="h-6 rounded-full border-none bg-[#EEF4FF] px-2.5 text-[10px] font-black text-[#2554D7]">
                      {selectedClass}
                    </Badge>
                  )}
                </div>
                <h2 className="mt-3 text-xl font-black tracking-tight text-[#14295F] sm:text-[1.45rem]">
                  출석 상태 전체를 빠르게 읽는 보드
                </h2>
                <p className="mt-2 max-w-[42rem] text-xs font-bold leading-6 text-slate-500 sm:text-sm">
                  좌석 색으로 출석 현황을 먼저 읽고, 좌석 안에서는 학생 이름과 현재 공부시간을 바로 확인합니다.
                  위험 신호를 앞쪽에 모아 지금 개입이 필요한 학생부터 보이게 정리했습니다.
                </p>
              </div>
              <Button asChild variant="outline" className="h-10 rounded-xl border-2 font-black">
                <Link href="/dashboard/attendance">출결관리 상세</Link>
              </Button>
            </div>
          ) : (
            <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-start justify-between')}>
              <div className="grid gap-1">
                <div className="flex items-center gap-2">
                  <Badge className="h-6 border-none bg-primary/10 px-2.5 text-[10px] font-black text-primary">
                    출석 관제 도면
                  </Badge>
                  {selectedClass !== 'all' && (
                    <Badge className="h-6 border-none bg-slate-100 px-2.5 text-[10px] font-black text-slate-700">
                      {selectedClass}
                    </Badge>
                  )}
                </div>
                <p className="text-xs font-bold text-muted-foreground">
                  좌석 색으로 출석 현황을 보고, 좌석 안에서는 학생 이름과 현재 공부시간을 바로 확인합니다.
                </p>
              </div>
              <Button asChild variant="outline" className="h-10 rounded-xl border-2 font-black">
                <Link href="/dashboard/attendance">출결관리 상세</Link>
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {summaryItems.map((item) => (
              <span
                key={item.label}
                className={cn('inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black', item.tone)}
              >
                {item.label} {item.value}
              </span>
            ))}
          </div>

          {isLoading ? (
            <div className={cn(
              'flex items-center justify-center rounded-[2rem] border border-dashed py-16',
              isTeacherEditorial ? 'border-[#D7E4FF] bg-[#F7FAFF]' : 'border-muted/20 bg-muted/10'
            )}>
              <Loader2 className="h-7 w-7 animate-spin text-primary/40" />
            </div>
          ) : selectedRoomView === 'all' ? (
            <Card className={cn(
              'overflow-hidden rounded-[2.5rem] border shadow-sm',
              isTeacherEditorial
                ? 'border-[#D7E4FF] bg-[linear-gradient(180deg,#F8FBFF_0%,#EEF4FF_100%)]'
                : 'border-primary/10 bg-[#fafafa]'
            )}>
              <CardHeader className={cn(
                'border-b px-5 py-5 sm:px-6',
                isTeacherEditorial ? 'bg-white/78' : 'bg-white/70'
              )}>
                <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-center justify-between')}>
                  <div className="grid gap-1">
                    <CardTitle className={cn('flex items-center gap-2 font-black tracking-tight', isMobile ? 'text-lg' : 'text-xl')}>
                      <ClipboardCheck className={cn(isMobile ? 'h-4 w-4' : 'h-5 w-5', 'text-primary/50')} />
                      전체보기 출석 관제
                    </CardTitle>
                    <CardDescription className={cn(
                      isTeacherEditorial ? 'text-xs font-bold text-muted-foreground' : 'text-xs font-bold uppercase tracking-widest text-muted-foreground'
                    )}>
                      두 호실을 동시에 보면서 출석, 외출, 복귀, 퇴실을 좌석 단위로 확인합니다.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="h-6 border-primary/40 px-3 text-[10px] font-black uppercase">
                    ATTENDANCE LIVE
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className={cn('grid gap-4', isMobile ? 'p-4' : 'p-6 md:grid-cols-2 md:p-6')}>
                {roomConfigs.map((room) => {
                  const roomMeta = roomSignals.find((item) => item.id === room.id);
                  return (
                    <Card
                      key={room.id}
                      className={cn(
                        'overflow-hidden rounded-[2rem] border shadow-sm',
                        isTeacherEditorial
                          ? 'border-[#D8E6FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F6F9FF_100%)]'
                          : 'border-primary/10 bg-white'
                      )}
                    >
                      <CardContent className="space-y-4 p-4 sm:p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="grid gap-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary/50">Attendance Board</p>
                            <h3 className="text-2xl font-black tracking-tight text-primary">{room.name}</h3>
                            <p className="text-xs font-bold text-muted-foreground">
                              공부 중 {roomMeta?.focusedCount || 0}명, 외출 {roomMeta?.awayCount || 0}명, 퇴실 {roomMeta?.checkedOutCount || 0}명
                            </p>
                          </div>
                          <Badge className="border-none bg-primary/10 font-black text-primary">
                            {room.cols} x {room.rows}
                          </Badge>
                        </div>
                        {isTeacherEditorial ? (
                          <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-2xl border border-[#D8E6FF] bg-white px-3 py-3 shadow-sm">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">공부 중</p>
                              <p className="dashboard-number mt-2 text-xl text-[#2554D7]">{roomMeta?.focusedCount || 0}</p>
                            </div>
                            <div className="rounded-2xl border border-[#FFE2BC] bg-[#FFF7EE] px-3 py-3 shadow-sm">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#C95A08]">외출</p>
                              <p className="dashboard-number mt-2 text-xl text-[#C95A08]">{roomMeta?.awayCount || 0}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 shadow-sm">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">퇴실</p>
                              <p className="dashboard-number mt-2 text-xl text-slate-700">{roomMeta?.checkedOutCount || 0}</p>
                            </div>
                          </div>
                        ) : null}
                        {renderGrid(room, true)}
                      </CardContent>
                    </Card>
                  );
                })}
              </CardContent>
            </Card>
          ) : (
            (() => {
              const room = roomConfigs.find((item) => item.id === selectedRoomView);
              if (!room) return null;
              const roomMeta = roomSignals.find((item) => item.id === room.id);

              return (
                <Card className={cn(
                  'overflow-hidden rounded-[2.5rem] border shadow-sm',
                  isTeacherEditorial
                    ? 'border-[#D7E4FF] bg-[linear-gradient(180deg,#F8FBFF_0%,#EEF4FF_100%)]'
                    : 'border-primary/10 bg-[#fafafa]'
                )}>
                  <CardHeader className={cn(
                    'border-b px-5 py-5 sm:px-6',
                    isTeacherEditorial ? 'bg-white/78' : 'bg-white/70'
                  )}>
                    <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-center justify-between')}>
                      <div className="grid gap-1">
                        <CardTitle className={cn('flex items-center gap-2 font-black tracking-tight', isMobile ? 'text-lg' : 'text-xl')}>
                          <ClipboardCheck className={cn(isMobile ? 'h-4 w-4' : 'h-5 w-5', 'text-primary/50')} />
                          {room.name} 출석 관제
                        </CardTitle>
                        <CardDescription className="text-xs font-bold text-muted-foreground">
                          공부 중 {roomMeta?.focusedCount || 0}명, 외출 {roomMeta?.awayCount || 0}명, 퇴실 {roomMeta?.checkedOutCount || 0}명
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="h-6 border-primary/40 px-3 text-[10px] font-black uppercase">
                        {room.cols}x{room.rows}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className={cn('space-y-4', isMobile ? 'p-4' : 'p-6 sm:p-8')}>
                    {isTeacherEditorial ? (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-2xl border border-[#D8E6FF] bg-white px-3 py-3 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">공부 중</p>
                          <p className="dashboard-number mt-2 text-xl text-[#2554D7]">{roomMeta?.focusedCount || 0}</p>
                        </div>
                        <div className="rounded-2xl border border-[#FFE2BC] bg-[#FFF7EE] px-3 py-3 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#C95A08]">외출</p>
                          <p className="dashboard-number mt-2 text-xl text-[#C95A08]">{roomMeta?.awayCount || 0}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">퇴실</p>
                          <p className="dashboard-number mt-2 text-xl text-slate-700">{roomMeta?.checkedOutCount || 0}</p>
                        </div>
                      </div>
                    ) : null}
                    {renderGrid(room)}
                  </CardContent>
                </Card>
              );
            })()
          )}
        </CardContent>
      </Card>
    </section>
  );
}
