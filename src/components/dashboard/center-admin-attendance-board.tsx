'use client';

import Link from 'next/link';
import { ClipboardCheck, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  shellMode?: 'standalone' | 'embedded';
  showHeader?: boolean;
  isLoading: boolean;
  summary: CenterAdminAttendanceBoardSummary;
  seatSignalsBySeatId: Map<string, CenterAdminAttendanceSeatSignal>;
  studentsById: Map<string, StudentProfile>;
  studentMembersById: Map<string, CenterMembership>;
  getSeatForRoom: (room: LayoutRoomConfig, roomSeatNo: number) => ResolvedAttendanceSeat;
  onSeatClick: (seat: AttendanceCurrent) => void;
};

type SummaryItem = {
  label: string;
  value: number;
  cardClass: string;
  dotClass: string;
  valueClass: string;
};

export function CenterAdminAttendanceBoard({
  roomConfigs,
  selectedRoomView,
  selectedClass,
  isMobile,
  seatDetailLevel = 'default',
  variant = 'default',
  shellMode = 'standalone',
  showHeader = true,
  isLoading,
  summary,
  seatSignalsBySeatId,
  studentsById,
  studentMembersById,
  getSeatForRoom,
  onSeatClick,
}: CenterAdminAttendanceBoardProps) {
  const isTeacherEditorial = variant === 'teacherEditorial';
  const isEmbedded = shellMode === 'embedded';
  const scopeLabel = selectedClass === 'all' ? '센터 전체' : selectedClass;
  const summaryItems: SummaryItem[] = [
    {
      label: '미입실/지각',
      value: summary.lateOrAbsentCount,
      cardClass: 'border-rose-200 bg-rose-50/90',
      dotClass: 'bg-rose-500',
      valueClass: 'text-rose-700',
    },
    {
      label: '장기외출',
      value: summary.longAwayCount,
      cardClass: 'border-amber-200 bg-amber-50/90',
      dotClass: 'bg-amber-500',
      valueClass: 'text-amber-700',
    },
    {
      label: '루틴 누락',
      value: summary.routineMissingCount,
      cardClass: 'border-[#FFD7B0] bg-[#FFF7EE]',
      dotClass: 'bg-[#FF7A16]',
      valueClass: 'text-[#C95A08]',
    },
    {
      label: '외출 중',
      value: summary.awayCount,
      cardClass: 'border-amber-100 bg-[#FFF8EE]',
      dotClass: 'bg-amber-400',
      valueClass: 'text-amber-700',
    },
    {
      label: '공부 중',
      value: summary.normalPresentCount,
      cardClass: 'border-[#D7E4FF] bg-[#F7FAFF]',
      dotClass: 'bg-[#2554D7]',
      valueClass: 'text-[#2554D7]',
    },
    {
      label: '복귀 후 공부',
      value: summary.returnedCount,
      cardClass: 'border-cyan-100 bg-cyan-50/90',
      dotClass: 'bg-cyan-500',
      valueClass: 'text-cyan-700',
    },
    {
      label: '퇴실',
      value: summary.checkedOutCount,
      cardClass: 'border-slate-200 bg-slate-50/90',
      dotClass: 'bg-slate-400',
      valueClass: 'text-slate-700',
    },
  ];

  const roomSignals = roomConfigs.map((room) => {
    let focusedCount = 0;
    let awayCount = 0;
    let checkedOutCount = 0;
    let assignedCount = 0;

    for (let roomSeatNo = 1; roomSeatNo <= room.rows * room.cols; roomSeatNo += 1) {
      const seat = getSeatForRoom(room, roomSeatNo);
      if (seat.type === 'aisle') continue;
      if (seat.studentId) assignedCount += 1;
      if (!seat.studentId) continue;
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
      assignedCount,
      totalSeats: room.rows * room.cols,
    };
  });

  const renderGrid = (room: LayoutRoomConfig, compact = false) => (
    <ScrollArea className="w-full max-w-full">
      <div
        className={cn(
          'mx-auto w-fit rounded-[2.25rem] border border-[#DCE7FF] bg-[radial-gradient(circle_at_top,rgba(37,84,215,0.08),transparent_48%),linear-gradient(180deg,#FFFFFF_0%,#F5F8FF_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]',
          compact ? 'p-3 sm:p-4' : isMobile ? 'p-4' : 'p-5 sm:p-6'
        )}
      >
        <div
          className="grid gap-2.5"
          style={{
            gridTemplateColumns: `repeat(${room.cols}, minmax(${compact ? (isTeacherEditorial ? 60 : 58) : isTeacherEditorial ? 84 : 80}px, 1fr))`,
          }}
        >
          {Array.from({ length: room.cols }).map((_, colIndex) => (
            <div key={`${room.id}_${colIndex}`} className="flex flex-col gap-2.5">
              {Array.from({ length: room.rows }).map((_, rowIndex) => {
                const roomSeatNo = colIndex * room.rows + rowIndex + 1;
                const seat = getSeatForRoom(room, roomSeatNo);
                const studentId = typeof seat.studentId === 'string' ? seat.studentId : '';
                const student = studentId ? studentsById.get(studentId) : undefined;
                const member = studentId ? studentMembersById.get(studentId) : undefined;
                const signal = studentId ? seatSignalsBySeatId.get(seat.id) || null : null;
                const presentation = signal ? getAttendanceBoardPresentation(signal) : null;
                const resolvedPresentation = presentation || {
                  surfaceClass: 'border-[#DCE7FF] bg-white text-[#14295F]',
                  chipClass: 'bg-slate-100 text-slate-700',
                  chipLabel: '확인중',
                  flagClass: 'bg-slate-100 text-slate-600',
                  isDark: false,
                };
                const isAisle = seat.type === 'aisle';
                const isFilteredOut = selectedClass !== 'all' && member?.className !== selectedClass;
                const displayName = signal?.studentName || student?.name || member?.displayName || '학생';
                const isNameOnly = seatDetailLevel === 'nameOnly';
                const studyTimeLabel = signal?.todayStudyLabel || '0h 0m';
                const compactStudyTimeLabel = studyTimeLabel.replace(/\s+/g, '');
                const showStatusChip = !compact && !isNameOnly;

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
                      'relative aspect-square overflow-hidden border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2554D7]/45',
                      compact ? 'rounded-[1.35rem] p-1.5' : 'rounded-[1.65rem] p-1.5',
                      isAisle
                        ? 'cursor-default border-transparent bg-transparent shadow-none'
                        : seat.studentId
                          ? cn(
                              'cursor-pointer shadow-[0_20px_30px_-24px_rgba(20,41,95,0.42)] hover:-translate-y-0.5 hover:shadow-[0_28px_36px_-24px_rgba(20,41,95,0.48)]',
                              resolvedPresentation.surfaceClass
                            )
                          : 'cursor-default border-dashed border-[#D7E4FF] bg-white/88 text-[#A2B1D1] shadow-[0_18px_26px_-26px_rgba(20,41,95,0.28)]',
                      isFilteredOut && 'border-transparent bg-slate-100/70 opacity-25 grayscale'
                    )}
                  >
                    {!isAisle && (
                      <span
                        className={cn(
                          'absolute left-2 top-1.5 font-black tracking-tight text-[#14295F]/38',
                          compact ? 'text-[7px]' : 'text-[8px]'
                        )}
                      >
                        {roomSeatNo}
                      </span>
                    )}

                    {isAisle ? null : seat.studentId ? (
                      <div
                        className={cn(
                          'flex h-full w-full flex-col items-center justify-center text-center',
                          compact ? 'gap-1 px-1 pt-3.5' : showStatusChip ? 'gap-1.5 px-1.5 pt-4' : 'gap-1 px-1.5 pt-4'
                        )}
                      >
                        <span
                          className={cn(
                            'w-full font-black tracking-tight break-keep text-[#14295F]',
                            compact ? 'line-clamp-2 text-[10px] leading-[1.15]' : 'line-clamp-2 text-[12px] leading-[1.18]'
                          )}
                        >
                          {displayName}
                        </span>

                        {showStatusChip ? (
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={cn(
                                'inline-flex max-w-full items-center justify-center rounded-full px-2.5 py-0.5 text-[8px] font-black shadow-sm',
                                resolvedPresentation.chipClass
                              )}
                            >
                              {signal?.boardLabel || resolvedPresentation.chipLabel}
                            </span>
                            <span className="inline-flex max-w-full items-center justify-center rounded-full border border-black/5 bg-white/85 px-2.5 py-0.5 text-[8px] font-black text-[#14295F] shadow-sm">
                              {compactStudyTimeLabel}
                            </span>
                          </div>
                        ) : (
                          <span
                            className={cn(
                              'inline-flex max-w-full items-center justify-center rounded-full border border-black/5 bg-white/85 font-black text-[#14295F] shadow-sm',
                              compact ? 'px-1.5 py-0.5 text-[7px]' : 'px-2 py-0.5 text-[8px]'
                            )}
                          >
                            {compactStudyTimeLabel}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span
                          className={cn(
                            'font-black tracking-tight text-[#9AACD3]',
                            compact ? 'text-[8px]' : 'text-[9px]'
                          )}
                        >
                          빈 좌석
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

  const renderHeader = () =>
    showHeader ? (
      <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-start justify-between')}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={cn(
                'h-6 rounded-full border-none px-2.5 text-[10px] font-black uppercase tracking-[0.16em]',
                isTeacherEditorial ? 'bg-[#14295F] text-white' : 'bg-[#EEF4FF] text-[#2554D7]'
              )}
            >
              출석 관제 도면
            </Badge>
            {selectedClass !== 'all' && (
              <Badge className="h-6 rounded-full border-none bg-white px-2.5 text-[10px] font-black text-[#14295F] shadow-[0_18px_28px_-24px_rgba(20,41,95,0.28)]">
                {selectedClass}
              </Badge>
            )}
          </div>
          <h2 className="mt-3 text-xl font-black tracking-tight text-[#14295F] sm:text-[1.55rem]">
            {isTeacherEditorial ? '좌석 한 판으로 출석 흐름을 읽는 캔버스' : '실시간 좌석 관제 캔버스'}
          </h2>
          <p className="mt-2 max-w-[46rem] text-xs font-bold leading-6 text-[#5c6e97] sm:text-sm">
            좌석 색으로 현재 출석 흐름을 먼저 읽고, 학생 이름과 오늘 공부시간으로 현장 상태를 바로 확인합니다.
            위험 신호는 앞쪽으로 정리해 지금 개입이 필요한 학생이 먼저 보이도록 맞췄습니다.
          </p>
        </div>
        <Button asChild variant="outline" className="h-11 rounded-2xl border-2 bg-white font-black text-[#14295F]">
          <Link href="/dashboard/attendance">출결관리 상세</Link>
        </Button>
      </div>
    ) : null;

  const renderSummaryRail = () => (
    <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'sm:grid-cols-3 xl:grid-cols-7')}>
      {summaryItems.map((item) => (
        <div
          key={item.label}
          className={cn(
            'rounded-[1.55rem] border px-4 py-3 shadow-[0_20px_30px_-30px_rgba(20,41,95,0.4)]',
            item.cardClass
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <span className={cn('mt-1 inline-flex h-2.5 w-2.5 rounded-full', item.dotClass)} />
            <span className={cn('dashboard-number text-[1.55rem] leading-none', item.valueClass)}>{item.value}</span>
          </div>
          <p className="mt-3 text-[11px] font-black tracking-tight text-[#14295F]">{item.label}</p>
          <p className="mt-1 text-[10px] font-bold text-[#5c6e97]">현재 좌석 기준</p>
        </div>
      ))}
    </div>
  );

  const renderRoomMetrics = (roomMeta?: (typeof roomSignals)[number]) => (
    <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
      <div className="rounded-[1.45rem] border border-[#D7E4FF] bg-[#F7FAFF] p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">학습 중</p>
        <p className="dashboard-number mt-2 text-2xl text-[#2554D7]">{roomMeta?.focusedCount || 0}</p>
      </div>
      <div className="rounded-[1.45rem] border border-[#FFE2BC] bg-[#FFF7EE] p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C95A08]">외출</p>
        <p className="dashboard-number mt-2 text-2xl text-[#C95A08]">{roomMeta?.awayCount || 0}</p>
      </div>
      <div className="rounded-[1.45rem] border border-emerald-100 bg-emerald-50/80 p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">배정 좌석</p>
        <p className="dashboard-number mt-2 text-2xl text-emerald-700">{roomMeta?.assignedCount || 0}</p>
      </div>
      <div className="rounded-[1.45rem] border border-slate-200 bg-slate-50/90 p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">퇴실</p>
        <p className="dashboard-number mt-2 text-2xl text-slate-700">{roomMeta?.checkedOutCount || 0}</p>
      </div>
    </div>
  );

  const renderRoomOverviewCard = (room: LayoutRoomConfig) => {
    const roomMeta = roomSignals.find((item) => item.id === room.id);

    return (
      <div
        key={room.id}
        className="overflow-hidden rounded-[2.2rem] border border-[#D7E4FF] bg-white shadow-[0_24px_50px_-38px_rgba(20,41,95,0.35)]"
      >
        <div className="border-b border-[#E4ECFF] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5c6e97]">실시간 호실</p>
              <h3 className="mt-1 text-[1.7rem] font-black tracking-tight text-[#14295F]">{room.name}</h3>
              <p className="mt-1 text-xs font-bold leading-5 text-[#5c6e97]">
                좌석을 눌러 학생 상세를 열고, 공부중과 외출 흐름을 한 장에서 빠르게 읽습니다.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="h-8 rounded-full border-none bg-[#EEF4FF] px-3.5 text-[10px] font-black text-[#2554D7]">
                {room.cols} x {room.rows}
              </Badge>
              <Badge className="h-8 rounded-full border-none bg-white px-3.5 text-[10px] font-black text-[#14295F] shadow-[0_18px_28px_-24px_rgba(20,41,95,0.22)]">
                좌석 {roomMeta?.totalSeats || room.rows * room.cols}
              </Badge>
            </div>
          </div>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          {renderRoomMetrics(roomMeta)}
          {renderGrid(room, true)}
        </div>
      </div>
    );
  };

  const renderAllRoomsCanvas = () => (
    <div className="overflow-hidden rounded-[2.55rem] border border-[#D7E4FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F3F8FF_100%)] shadow-[0_28px_70px_-54px_rgba(20,41,95,0.34)]">
      <div className="border-b border-[#DCE7FF] px-5 py-5 sm:px-6">
        <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-start justify-between')}>
          <div className="min-w-0">
            <Badge className="h-6 rounded-full border-none bg-[#EEF4FF] px-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#2554D7]">
              전체보기 캔버스
            </Badge>
            <h3 className="mt-3 text-[1.65rem] font-black tracking-tight text-[#14295F] sm:text-[1.8rem]">
              두 호실 흐름을 한 화면에서 비교
            </h3>
            <p className="mt-2 max-w-[42rem] text-xs font-bold leading-5 text-[#5c6e97] sm:text-sm">
              호실별 좌석 흐름과 배정 밀도를 같은 기준으로 읽고, 위험 학생을 발견하면 바로 좌석 단위로 상세를 열 수 있습니다.
            </p>
          </div>
          <div className={cn('grid gap-2', isMobile ? 'grid-cols-2' : 'min-w-[220px] grid-cols-1')}>
            <div className="rounded-[1.35rem] border border-[#D7E4FF] bg-white px-4 py-3 shadow-[0_18px_28px_-24px_rgba(20,41,95,0.22)]">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5c6e97]">관제 범위</p>
              <p className="mt-1 text-sm font-black text-[#14295F]">{scopeLabel}</p>
            </div>
            <div className="rounded-[1.35rem] border border-[#D7E4FF] bg-white px-4 py-3 shadow-[0_18px_28px_-24px_rgba(20,41,95,0.22)]">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5c6e97]">활성 호실</p>
              <p className="mt-1 text-sm font-black text-[#14295F]">{roomConfigs.length}개</p>
            </div>
          </div>
        </div>
      </div>
      <div className={cn('grid gap-4 p-4 sm:p-5', isMobile ? 'grid-cols-1' : 'xl:grid-cols-2')}>
        {roomConfigs.map(renderRoomOverviewCard)}
      </div>
    </div>
  );

  const renderSingleRoomCanvas = () => {
    const room = roomConfigs.find((item) => item.id === selectedRoomView);
    if (!room) return null;
    const roomMeta = roomSignals.find((item) => item.id === room.id);

    return (
      <div className="overflow-hidden rounded-[2.55rem] border border-[#D7E4FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F3F8FF_100%)] shadow-[0_28px_70px_-54px_rgba(20,41,95,0.34)]">
        <div className="border-b border-[#DCE7FF] px-5 py-5 sm:px-6">
          <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-start justify-between')}>
            <div className="min-w-0">
              <Badge className="h-6 rounded-full border-none bg-[#EEF4FF] px-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#2554D7]">
                {room.name} 집중 보기
              </Badge>
              <h3 className="mt-3 text-[1.65rem] font-black tracking-tight text-[#14295F] sm:text-[1.8rem]">
                {room.name} 좌석 흐름과 현재 출석 상태
              </h3>
              <p className="mt-2 max-w-[42rem] text-xs font-bold leading-5 text-[#5c6e97] sm:text-sm">
                선택한 호실의 출석 상태와 좌석 배정을 크게 확인하면서, 필요한 학생을 바로 눌러 상세 운영 화면으로 이어집니다.
              </p>
            </div>
            <div className={cn('grid gap-2', isMobile ? 'grid-cols-2' : 'min-w-[220px] grid-cols-1')}>
              <div className="rounded-[1.35rem] border border-[#D7E4FF] bg-white px-4 py-3 shadow-[0_18px_28px_-24px_rgba(20,41,95,0.22)]">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5c6e97]">호실 배치</p>
                <p className="mt-1 text-sm font-black text-[#14295F]">
                  {room.cols} x {room.rows}
                </p>
              </div>
              <div className="rounded-[1.35rem] border border-[#D7E4FF] bg-white px-4 py-3 shadow-[0_18px_28px_-24px_rgba(20,41,95,0.22)]">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5c6e97]">관제 범위</p>
                <p className="mt-1 text-sm font-black text-[#14295F]">{scopeLabel}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-4 p-4 sm:p-5 sm:pb-6">
          {renderRoomMetrics(roomMeta)}
          {renderGrid(room)}
        </div>
      </div>
    );
  };

  const content = (
    <div className="space-y-5">
      {renderHeader()}
      {renderSummaryRail()}

      {isLoading ? (
        <div className="flex items-center justify-center rounded-[2.25rem] border border-dashed border-[#D7E4FF] bg-[#F7FAFF] py-20">
          <Loader2 className="h-7 w-7 animate-spin text-[#2554D7]/50" />
        </div>
      ) : selectedRoomView === 'all' ? (
        renderAllRoomsCanvas()
      ) : (
        renderSingleRoomCanvas()
      )}
    </div>
  );

  if (isEmbedded) {
    return content;
  }

  return (
    <section className="px-4">
      <Card
        className={cn(
          'overflow-hidden rounded-[2.75rem] border-none shadow-[0_24px_70px_-52px_rgba(20,41,95,0.4)]',
          isTeacherEditorial
            ? 'marketing-card'
            : 'bg-[linear-gradient(180deg,#FFFFFF_0%,#F6FAFF_100%)] ring-1 ring-[#D7E4FF]'
        )}
      >
        <CardContent className={cn(isMobile ? 'p-4' : 'p-5 sm:p-6')}>{content}</CardContent>
      </Card>
    </section>
  );
}
