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
  isLoading,
  summary,
  seatSignalsBySeatId,
  studentsById,
  studentMembersById,
  getSeatForRoom,
  onSeatClick,
}: CenterAdminAttendanceBoardProps) {
  const summaryItems = [
    { label: '정상 입실', value: summary.normalPresentCount, tone: 'bg-sky-100 text-sky-700' },
    { label: '미입실/지각', value: summary.lateOrAbsentCount, tone: 'bg-rose-100 text-rose-700' },
    { label: '루틴 누락', value: summary.routineMissingCount, tone: 'bg-orange-100 text-orange-700' },
    { label: '외출 중', value: summary.awayCount, tone: 'bg-amber-100 text-amber-700' },
    { label: '복귀/재입실', value: summary.returnedCount, tone: 'bg-cyan-100 text-cyan-700' },
    { label: '퇴실', value: summary.checkedOutCount, tone: 'bg-slate-200 text-slate-700' },
    { label: '장기외출', value: summary.longAwayCount, tone: 'bg-amber-200 text-amber-800' },
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
                const visibleFlags = (signal?.flags || []).slice(0, compact || isMobile ? 1 : 2);
                const displayName =
                  signal?.studentName ||
                  student?.name ||
                  member?.displayName ||
                  '학생';
                const isNameOnly = seatDetailLevel === 'nameOnly';
                const studyTimeLabel = signal?.todayStudyLabel || '0h 0m';

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
                      compact ? 'min-w-[52px] rounded-[1rem] p-1' : 'min-w-[64px] rounded-2xl p-1.5',
                      isAisle
                        ? 'cursor-default border-transparent bg-transparent'
                        : seat.studentId
                          ? 'cursor-pointer'
                          : 'cursor-default border-primary/30 bg-white',
                      seat.studentId ? resolvedPresentation.surfaceClass : '',
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
                          isNameOnly
                            ? compact
                              ? 'items-center justify-center px-1 pb-1 pt-3'
                              : 'items-center justify-center px-1.5 py-1'
                            : compact
                              ? 'justify-between px-0.5 pb-0.5 pt-3'
                              : 'items-center justify-center gap-1 px-0.5'
                        )}
                      >
                        <span
                          className={cn(
                            'w-full text-center font-black tracking-tight whitespace-normal break-keep',
                            isNameOnly
                              ? compact
                                ? 'line-clamp-2 text-[10px] leading-[1.15] text-slate-950'
                                : 'line-clamp-2 text-[11px] leading-[1.2] text-slate-950'
                              : compact
                                ? 'min-h-[18px] text-[9px] leading-[1.08]'
                                : 'truncate leading-none text-[10px]'
                          )}
                        >
                          {displayName}
                        </span>
                        {isNameOnly && (
                          <span
                            className={cn(
                              'inline-flex items-center justify-center rounded-full border border-black/5 bg-white/78 px-1.5 py-0.5 font-black tracking-tight text-slate-700 shadow-sm',
                              compact ? 'mt-1 text-[7px] leading-none' : 'mt-1.5 text-[8px] leading-none'
                            )}
                          >
                            공부 {studyTimeLabel}
                          </span>
                        )}
                        {!isNameOnly && (
                          <span
                            className={cn(
                              'inline-flex max-w-full items-center rounded-full px-1.5 py-0.5 font-black shadow-sm',
                              compact ? 'text-[5px]' : 'text-[7px]',
                              resolvedPresentation.chipClass
                            )}
                          >
                            {resolvedPresentation.chipLabel}
                          </span>
                        )}
                        {!isNameOnly && !compact && (
                          <span
                            className={cn(
                              'font-black opacity-80',
                              compact ? 'text-[5px]' : 'text-[7px]'
                            )}
                          >
                            공부 {signal?.todayStudyLabel || '확인중'}
                          </span>
                        )}
                        {!isNameOnly && !compact && visibleFlags.length > 0 && (
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            {visibleFlags.map((flag) => (
                              <span
                                key={`${seat.id}_${flag}`}
                                className={cn(
                                  'inline-flex items-center rounded-full px-1 py-0.5 font-black shadow-sm',
                                  compact ? 'text-[4px]' : 'text-[5px]',
                                  resolvedPresentation.flagClass
                                )}
                              >
                                {flag}
                              </span>
                            ))}
                          </div>
                        )}
                        {!isNameOnly && compact && (
                          <div className="flex min-h-[10px] items-center justify-center gap-1">
                            {visibleFlags.length > 0 ? (
                              visibleFlags.map((flag) => (
                                <span
                                  key={`${seat.id}_${flag}`}
                                  className={cn(
                                    'inline-flex items-center rounded-full px-1 py-0.5 font-black text-[4px] shadow-sm',
                                    resolvedPresentation.flagClass
                                  )}
                                >
                                  {flag}
                                </span>
                              ))
                            ) : (
                              <span className="text-[5px] font-black opacity-80">
                                {signal?.todayStudyLabel || '확인중'}
                              </span>
                            )}
                          </div>
                        )}
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
      <Card className="overflow-hidden rounded-[2.5rem] border-none bg-white shadow-sm ring-1 ring-black/5">
        <CardContent className={cn('space-y-5', isMobile ? 'p-4' : 'p-5 sm:p-6')}>
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
                루틴 기반 출석 여부, 최근 7일 출결 주의, 외출 중 복귀 여부를 좌석 기준으로 바로 확인합니다.
              </p>
            </div>
            <Button asChild variant="outline" className="h-10 rounded-xl border-2 font-black">
              <Link href="/dashboard/attendance">출결관리 상세</Link>
            </Button>
          </div>

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
            <div className="flex items-center justify-center rounded-[2rem] border border-dashed border-muted/20 bg-muted/10 py-16">
              <Loader2 className="h-7 w-7 animate-spin text-primary/40" />
            </div>
          ) : selectedRoomView === 'all' ? (
            <Card className="overflow-hidden rounded-[2.5rem] border border-primary/10 bg-[#fafafa] shadow-sm">
              <CardHeader className="border-b bg-white/70 px-5 py-5 sm:px-6">
                <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-center justify-between')}>
                  <div className="grid gap-1">
                    <CardTitle className={cn('flex items-center gap-2 font-black tracking-tight', isMobile ? 'text-lg' : 'text-xl')}>
                      <ClipboardCheck className={cn(isMobile ? 'h-4 w-4' : 'h-5 w-5', 'text-primary/50')} />
                      전체보기 출석 관제
                    </CardTitle>
                    <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
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
                    <Card key={room.id} className="overflow-hidden rounded-[2rem] border border-primary/10 bg-white shadow-sm">
                      <CardContent className="space-y-4 p-4 sm:p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="grid gap-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary/50">Attendance Board</p>
                            <h3 className="text-2xl font-black tracking-tight text-primary">{room.name}</h3>
                            <p className="text-xs font-bold text-muted-foreground">
                              정상 입실 {roomMeta?.focusedCount || 0}명, 외출 {roomMeta?.awayCount || 0}명, 퇴실 {roomMeta?.checkedOutCount || 0}명
                            </p>
                          </div>
                          <Badge className="border-none bg-primary/10 font-black text-primary">
                            {room.cols} x {room.rows}
                          </Badge>
                        </div>
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
                <Card className="overflow-hidden rounded-[2.5rem] border border-primary/10 bg-[#fafafa] shadow-sm">
                  <CardHeader className="border-b bg-white/70 px-5 py-5 sm:px-6">
                    <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-center justify-between')}>
                      <div className="grid gap-1">
                        <CardTitle className={cn('flex items-center gap-2 font-black tracking-tight', isMobile ? 'text-lg' : 'text-xl')}>
                          <ClipboardCheck className={cn(isMobile ? 'h-4 w-4' : 'h-5 w-5', 'text-primary/50')} />
                          {room.name} 출석 관제
                        </CardTitle>
                        <CardDescription className="text-xs font-bold text-muted-foreground">
                          정상 입실 {roomMeta?.focusedCount || 0}명, 외출 {roomMeta?.awayCount || 0}명, 퇴실 {roomMeta?.checkedOutCount || 0}명
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="h-6 border-primary/40 px-3 text-[10px] font-black uppercase">
                        {room.cols}x{room.rows}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className={cn(isMobile ? 'p-4' : 'p-6 sm:p-8')}>
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
