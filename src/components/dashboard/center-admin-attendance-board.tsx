'use client';

import { useMemo } from 'react';
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
import { toStudyRoomTrackScheduleName } from '@/lib/study-room-class-schedule';
import type { AttendanceCurrent, CenterMembership, LayoutRoomConfig, StudentProfile } from '@/lib/types';
import { cn } from '@/lib/utils';

type ResolvedAttendanceSeat = AttendanceCurrent & {
  roomId: string;
  roomSeatNo: number;
};

type CenterAdminAttendanceBoardProps = {
  roomConfigs: LayoutRoomConfig[];
  selectedRoomView: 'all' | string;
  onRoomViewChange?: (roomId: 'all' | string) => void;
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
  note: string;
  toneClass: string;
  valueClass: string;
  dotClass: string;
};

type RoomSnapshot = {
  id: string;
  name: string;
  rows: number;
  cols: number;
  totalSeats: number;
  assignedCount: number;
  studyingCount: number;
  attentionCount: number;
  awayCount: number;
  exitCount: number;
};

const DEFAULT_PRESENTATION = {
  surfaceClass: 'border-[#DCE7FF] bg-white text-[#14295F]',
  chipClass: 'bg-slate-100 text-slate-700',
  chipLabel: '확인중',
  flagClass: 'bg-slate-100 text-slate-600',
  isDark: false,
};

function isAttentionSignal(signal: CenterAdminAttendanceSeatSignal) {
  return (
    signal.attendanceDisplayStatus === 'confirmed_late' ||
    signal.boardStatus === 'absent' ||
    signal.attendanceDisplayStatus === 'missing_routine' ||
    signal.attendanceDisplayStatus === 'confirmed_present_missing_routine'
  );
}

function getSeatDisplayLabel(seat: AttendanceCurrent, fallbackRoomSeatNo: number) {
  const customLabel = typeof seat.seatLabel === 'string' ? seat.seatLabel.trim() : '';
  return customLabel || String(fallbackRoomSeatNo);
}

function getOperationalSignalPriority(signal: CenterAdminAttendanceSeatSignal) {
  switch (signal.operationalExceptionKind) {
    case 'midday_leave':
      return 0;
    case 'early_checkout':
      return 1;
    case 'returned':
      return 2;
    default:
      return 99;
  }
}

export function CenterAdminAttendanceBoard({
  roomConfigs,
  selectedRoomView,
  onRoomViewChange,
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
  const selectedRoom =
    selectedRoomView === 'all' ? null : roomConfigs.find((room) => room.id === selectedRoomView) || null;
  const roomById = useMemo(() => new Map(roomConfigs.map((room) => [room.id, room])), [roomConfigs]);
  const operationalSignals = useMemo(() => {
    return Array.from(seatSignalsBySeatId.values())
      .filter(
        (signal) =>
          Boolean(signal.operationalExceptionKind) &&
          (selectedRoomView === 'all' || !selectedRoom || signal.roomId === selectedRoom.id)
      )
      .sort((left, right) => {
        const priorityDiff = getOperationalSignalPriority(left) - getOperationalSignalPriority(right);
        if (priorityDiff !== 0) return priorityDiff;
        if ((left.roomId || '') !== (right.roomId || '')) {
          return (left.roomId || '').localeCompare(right.roomId || '');
        }
        if ((left.roomSeatNo || 0) !== (right.roomSeatNo || 0)) {
          return Number(left.roomSeatNo || 0) - Number(right.roomSeatNo || 0);
        }
        return left.studentName.localeCompare(right.studentName, 'ko');
      });
  }, [seatSignalsBySeatId, selectedRoom, selectedRoomView]);
  const operationalSummary = useMemo(
    () => ({
      total: operationalSignals.length,
      away: operationalSignals.filter((signal) => signal.operationalExceptionKind === 'midday_leave').length,
      returned: operationalSignals.filter((signal) => signal.operationalExceptionKind === 'returned').length,
      earlyCheckout: operationalSignals.filter((signal) => signal.operationalExceptionKind === 'early_checkout').length,
    }),
    [operationalSignals]
  );

  const summaryItems: SummaryItem[] = [
    {
      label: '공부중',
      value: summary.studyingFamilyCount,
      note: summary.returnedCount > 0 ? `복귀 후 공부 ${summary.returnedCount}` : '현재 좌석 기준',
      toneClass: 'border-[#D7E6FF] bg-[#F5F9FF]',
      valueClass: 'text-[#2554D7]',
      dotClass: 'bg-[#2554D7]',
    },
    {
      label: '미입실/지각',
      value: summary.attentionFamilyCount,
      note: summary.routineMissingCount > 0 ? `루틴 누락 ${summary.routineMissingCount}` : '현재 좌석 기준',
      toneClass: 'border-[#FFDAB7] bg-[#FFF6EE]',
      valueClass: 'text-[#C95A08]',
      dotClass: 'bg-[#FF7A16]',
    },
    {
      label: '휴식/외출',
      value: summary.restFamilyCount,
      note: summary.longAwayCount > 0 ? `장기 외출 ${summary.longAwayCount}` : '현재 좌석 기준',
      toneClass: 'border-[#CFEFDF] bg-[#F2FCF8]',
      valueClass: 'text-[#1F9E7A]',
      dotClass: 'bg-[#1F9E7A]',
    },
    {
      label: '퇴실',
      value: summary.exitFamilyCount,
      note:
        summary.excusedAbsentCount + summary.plannedCount > 0
          ? `예정/대기 ${summary.excusedAbsentCount + summary.plannedCount}`
          : '현재 좌석 기준',
      toneClass: 'border-[#DFE7F2] bg-[#F8FAFD]',
      valueClass: 'text-slate-700',
      dotClass: 'bg-slate-400',
    },
  ];

  const roomSnapshots: RoomSnapshot[] = roomConfigs.map((room) => {
    let assignedCount = 0;
    let studyingCount = 0;
    let attentionCount = 0;
    let awayCount = 0;
    let exitCount = 0;

    for (let roomSeatNo = 1; roomSeatNo <= room.rows * room.cols; roomSeatNo += 1) {
      const seat = getSeatForRoom(room, roomSeatNo);
      if (seat.type === 'aisle' || !seat.studentId) continue;

      const member = studentMembersById.get(seat.studentId);
      const isFilteredOut = selectedClass !== 'all' && member?.className !== selectedClass;
      if (isFilteredOut) continue;

      assignedCount += 1;
      const signal = seatSignalsBySeatId.get(seat.id);
      if (!signal) continue;

      if (signal.boardStatus === 'present' || signal.boardStatus === 'returned') {
        studyingCount += 1;
      } else if (signal.boardStatus === 'away') {
        awayCount += 1;
      } else if (
        signal.boardStatus === 'checked_out' ||
        signal.boardStatus === 'excused_absent' ||
        signal.boardStatus === 'planned'
      ) {
        exitCount += 1;
      }

      if (isAttentionSignal(signal)) {
        attentionCount += 1;
      }
    }

    return {
      id: room.id,
      name: room.name,
      rows: room.rows,
      cols: room.cols,
      totalSeats: room.rows * room.cols,
      assignedCount,
      studyingCount,
      attentionCount,
      awayCount,
      exitCount,
    };
  });

  const activeRoomSnapshot =
    selectedRoom ? roomSnapshots.find((room) => room.id === selectedRoom.id) || null : null;

  const renderFocusedGrid = (room: LayoutRoomConfig) => {
    const isNameOnly = seatDetailLevel === 'nameOnly';

    return (
      <ScrollArea className="w-full max-w-full">
        <div className="rounded-[2rem] border border-[#DCE7FF] bg-[linear-gradient(180deg,#FCFDFF_0%,#F6F9FF_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] sm:p-4">
          <div
            className="grid gap-2.5"
            style={{
              gridTemplateColumns: `repeat(${room.cols}, minmax(${isMobile ? 82 : 98}px, 1fr))`,
            }}
          >
            {Array.from({ length: room.cols }).map((_, colIndex) => (
              <div key={`${room.id}_${colIndex}`} className="flex flex-col gap-2.5">
                {Array.from({ length: room.rows }).map((_, rowIndex) => {
                  const roomSeatNo = colIndex * room.rows + rowIndex + 1;
                  const seat = getSeatForRoom(room, roomSeatNo);
                  const seatDisplayLabel = getSeatDisplayLabel(seat, roomSeatNo);
                  const studentId = typeof seat.studentId === 'string' ? seat.studentId : '';
                  const student = studentId ? studentsById.get(studentId) : undefined;
                  const member = studentId ? studentMembersById.get(studentId) : undefined;
                  const signal = studentId ? seatSignalsBySeatId.get(seat.id) || null : null;
                  const presentation = signal ? getAttendanceBoardPresentation(signal) : DEFAULT_PRESENTATION;
                  const isAisle = seat.type === 'aisle';
                  const isFilteredOut = selectedClass !== 'all' && member?.className !== selectedClass;
                  const displayName = signal?.studentName || student?.name || member?.displayName || '학생';
                  const scheduleMovementLabel = signal?.scheduleMovementSummary || null;
                  const isNoAttendanceDay = Boolean(signal?.isNoAttendanceDay || signal?.boardStatus === 'excused_absent');
                  const isCheckedOutLate = Boolean(signal?.boardStatus === 'checked_out' && signal.wasLateToday);
                  const checkoutMetaChips =
                    signal?.boardStatus === 'checked_out'
                      ? [
                          {
                            key: 'late',
                            label: signal.wasLateToday ? '오늘 지각O' : '오늘 지각X',
                            className: signal.wasLateToday
                              ? 'border-[#FFD0A6] bg-[#FFF1E2] text-[#C95A08]'
                              : 'border-white/85 bg-white/92 text-slate-700',
                          },
                          {
                            key: 'firstCheckIn',
                            label: `최초 등원 ${signal.firstCheckInLabel || '-'}`,
                            className: 'border-white/85 bg-white/92 text-[#14295F]',
                          },
                          {
                            key: 'lastCheckOut',
                            label: `하원 ${signal.lastCheckOutLabel || '-'}`,
                            className: 'border-white/85 bg-white/92 text-[#14295F]',
                          },
                        ]
                      : [];
                  const attendanceTimeLabel = signal
                    ? isNoAttendanceDay
                      ? '미등원'
                      : signal.boardStatus === 'checked_out'
                      ? signal.wasLateToday
                        ? '퇴실 · 지각'
                        : '퇴실'
                      : signal.attendanceDisplayStatus === 'confirmed_late' && signal.checkedAtLabel
                      ? `지각 ${signal.checkedAtLabel}`
                      : signal.checkedAtLabel
                        ? `입실 ${signal.checkedAtLabel}`
                        : signal.routineExpectedArrivalTime
                          ? `예정 ${signal.routineExpectedArrivalTime}`
                          : signal.boardLabel
                    : '확인중';
                  const shouldShowSeatMeta = !isNameOnly || isNoAttendanceDay || Boolean(scheduleMovementLabel) || checkoutMetaChips.length > 0;

                  if (isAisle) {
                    return <div key={`${room.id}_${roomSeatNo}`} className="aspect-square rounded-[1.35rem] bg-transparent" />;
                  }

                  if (!seat.studentId) {
                    return (
                      <div
                        key={`${room.id}_${roomSeatNo}`}
                        className="relative aspect-square rounded-[1.45rem] border border-dashed border-[#E2EAF8] bg-white/60"
                      >
                        <span className="absolute left-2.5 top-2 text-[9px] font-black tracking-tight text-[#BCD0F0]">
                          {seatDisplayLabel}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={`${room.id}_${roomSeatNo}`}
                      type="button"
                      onClick={() => onSeatClick(seat)}
                      disabled={isFilteredOut}
                      className={cn(
                        'relative aspect-square rounded-[1.45rem] border-2 p-2.5 text-left shadow-[0_18px_30px_-26px_rgba(20,41,95,0.34)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2554D7]/35 hover:-translate-y-0.5 hover:shadow-[0_22px_34px_-24px_rgba(20,41,95,0.38)]',
                        presentation.surfaceClass,
                        isCheckedOutLate && 'border-[#FF9A42] bg-[#FFF2E6]',
                        isFilteredOut && 'opacity-20 grayscale hover:translate-y-0 hover:shadow-none'
                      )}
                    >
                      <span className="absolute left-2.5 top-2 text-[9px] font-black tracking-tight text-[#14295F]/46">
                        {seatDisplayLabel}
                      </span>
                      <div className="flex h-full flex-col justify-end gap-1.5 pt-5">
                        <p
                          className={cn(
                            'line-clamp-2 break-keep font-black leading-[1.1] tracking-tight text-[#14295F]',
                            isMobile ? 'text-[12px]' : 'text-[13px]'
                          )}
                        >
                          {displayName}
                        </p>
                        {shouldShowSeatMeta && (
                          <span
                            className={cn(
                              'inline-flex max-w-full items-center rounded-full border border-white/85 bg-white/88 px-2.5 py-1 font-black tracking-tight text-[#14295F] shadow-[0_10px_18px_-16px_rgba(20,41,95,0.35)]',
                              isNoAttendanceDay && 'bg-rose-50 text-rose-700',
                              signal?.boardStatus === 'checked_out' &&
                                !isCheckedOutLate &&
                                'border-slate-600 bg-slate-800 text-white',
                              isCheckedOutLate &&
                                'border-[#FF9A42] bg-[#FF7A16] text-white shadow-[0_10px_18px_-16px_rgba(255,122,22,0.55)]',
                              isMobile ? 'text-[9px]' : 'text-[10px]'
                            )}
                          >
                            <span className="truncate">{attendanceTimeLabel}</span>
                          </span>
                        )}
                        {checkoutMetaChips.length > 0 ? (
                          <div className="flex max-w-full flex-wrap gap-1">
                            {checkoutMetaChips.map((chip) => (
                              <span
                                key={chip.key}
                                className={cn(
                                  'inline-flex min-w-0 max-w-full items-center rounded-full border px-1.5 py-0.5 font-black tracking-tight shadow-[0_10px_18px_-16px_rgba(20,41,95,0.35)]',
                                  chip.className,
                                  isMobile ? 'text-[6.8px]' : 'text-[7.6px]'
                                )}
                              >
                                <span className="truncate">{chip.label}</span>
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {scheduleMovementLabel && !isNoAttendanceDay ? (
                          <span
                            className={cn(
                              'inline-flex max-w-full items-center rounded-full border border-[#FFD9B6] bg-[#FFF6EC] px-2.5 py-1 font-black tracking-tight text-[#C95A08] shadow-[0_10px_18px_-16px_rgba(255,122,22,0.28)]',
                              isMobile ? 'text-[8.5px]' : 'text-[9.5px]'
                            )}
                          >
                            <span className="truncate">{scheduleMovementLabel}</span>
                          </span>
                        ) : null}
                      </div>
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
  };

  const renderMiniSeatMosaic = (room: LayoutRoomConfig) => (
    <div className="rounded-[1.6rem] border border-[#E6EDFA] bg-[#F8FBFF] p-3">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${room.cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: room.rows * room.cols }).map((_, index) => {
          const roomSeatNo = index + 1;
          const seat = getSeatForRoom(room, roomSeatNo);
          const studentId = typeof seat.studentId === 'string' ? seat.studentId : '';
          const member = studentId ? studentMembersById.get(studentId) : undefined;
          const signal = studentId ? seatSignalsBySeatId.get(seat.id) || null : null;
          const isFilteredOut = selectedClass !== 'all' && member?.className !== selectedClass;
          const presentation = signal ? getAttendanceBoardPresentation(signal) : DEFAULT_PRESENTATION;

          if (seat.type === 'aisle') {
            return <div key={`${room.id}_${roomSeatNo}`} className="aspect-square rounded-[0.8rem] bg-transparent" />;
          }

          if (!seat.studentId || isFilteredOut) {
            return (
              <div
                key={`${room.id}_${roomSeatNo}`}
                className="aspect-square rounded-[0.8rem] border border-dashed border-[#E3EBF9] bg-white/65"
              />
            );
          }

          return (
            <div
              key={`${room.id}_${roomSeatNo}`}
              className={cn('aspect-square rounded-[0.8rem] border', presentation.surfaceClass)}
            />
          );
        })}
      </div>
    </div>
  );

  const renderHeader = () =>
    showHeader ? (
      <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-start justify-between')}>
        <div className="min-w-0 space-y-3 text-[#14295F]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={cn(
                'h-6 rounded-full border-none px-2.5 text-[10px] font-black uppercase tracking-[0.16em]',
                isTeacherEditorial ? 'bg-[#14295F] text-white' : 'bg-[#EEF4FF] text-[#2554D7]'
              )}
            >
              출석 관제
            </Badge>
            <Badge className="h-6 rounded-full border border-[#DCE7FF] bg-white px-2.5 text-[10px] font-black text-[#14295F]">
              {selectedRoom ? `${selectedRoom.name} 집중` : '전체 호실'}
            </Badge>
            <Badge className="h-6 rounded-full border border-[#DCE7FF] bg-white px-2.5 text-[10px] font-black text-[#14295F]">
              {scopeLabel}
            </Badge>
          </div>
          {roomConfigs.length > 0 && onRoomViewChange ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={selectedRoomView === 'all' ? 'default' : 'outline'}
                onClick={() => onRoomViewChange('all')}
                className={cn(
                  'h-8 rounded-full px-3 text-[11px] font-black',
                  selectedRoomView === 'all'
                    ? 'border-[#14295F] bg-[#14295F] text-white hover:bg-[#10214B]'
                    : 'border-[#DCE7FF] bg-white text-[#14295F] hover:border-[#BFD1F8] hover:bg-[#F7FAFF]'
                )}
              >
                전체 보기
              </Button>
              {roomConfigs.map((room) => (
                <Button
                  key={room.id}
                  type="button"
                  variant={selectedRoomView === room.id ? 'default' : 'outline'}
                  onClick={() => onRoomViewChange(room.id)}
                  className={cn(
                    'h-8 rounded-full px-3 text-[11px] font-black',
                    selectedRoomView === room.id
                      ? 'border-[#FF7A16] bg-[#FF7A16] text-white hover:bg-[#E56D12]'
                      : 'border-[#DCE7FF] bg-white text-[#14295F] hover:border-[#FFD2AF] hover:bg-[#FFF8F2]'
                  )}
                >
                  {room.name}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="space-y-2">
            <h2 className="text-xl font-black tracking-tight text-[#14295F] sm:text-[1.55rem]">
              {selectedRoom ? `${selectedRoom.name} 출석 흐름` : '좌석별 출석 흐름 스냅샷'}
            </h2>
            <p className="max-w-[44rem] text-xs font-bold leading-5 text-slate-500 sm:text-sm">
              공부중, 미입실, 휴식 흐름만 먼저 읽고 필요한 좌석만 눌러 상세를 확인합니다.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="h-11 rounded-2xl border-2 bg-white font-black text-[#14295F]">
          <Link href="/dashboard/attendance">출결관리 상세</Link>
        </Button>
      </div>
    ) : null;

  const renderSummaryRail = () => (
    <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
      {summaryItems.map((item) => (
        <div
          key={item.label}
          className={cn(
            'rounded-[1.45rem] border px-4 py-3 text-[#14295F] shadow-[0_20px_30px_-30px_rgba(20,41,95,0.28)]',
            item.toneClass
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <span className={cn('inline-flex h-2.5 w-2.5 rounded-full', item.dotClass)} />
              <p className="text-[11px] font-black tracking-tight text-[#14295F]">{item.label}</p>
            </div>
            <span className={cn('dashboard-number text-[1.55rem] leading-none', item.valueClass)}>{item.value}</span>
          </div>
          <p className="mt-3 text-[10px] font-bold text-slate-500">{item.note}</p>
        </div>
      ))}
    </div>
  );

  const renderRoomMetricRail = (snapshot: RoomSnapshot | null) => {
    const items = [
      {
        label: '공부중',
        value: snapshot?.studyingCount ?? 0,
        note: '현재 좌석 기준',
        toneClass: 'border-[#D7E6FF] bg-[#F5F9FF]',
        valueClass: 'text-[#2554D7]',
      },
      {
        label: '미입실/지각',
        value: snapshot?.attentionCount ?? 0,
        note: '즉시 확인 우선',
        toneClass: 'border-[#FFDAB7] bg-[#FFF6EE]',
        valueClass: 'text-[#C95A08]',
      },
      {
        label: '휴식/외출',
        value: snapshot?.awayCount ?? 0,
        note: '복귀 체크',
        toneClass: 'border-[#CFEFDF] bg-[#F2FCF8]',
        valueClass: 'text-[#1F9E7A]',
      },
      {
        label: '퇴실',
        value: snapshot?.exitCount ?? 0,
        note: '예정 포함',
        toneClass: 'border-[#DFE7F2] bg-[#F8FAFD]',
        valueClass: 'text-slate-700',
      },
    ];

    return (
      <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
        {items.map((item) => (
          <div key={item.label} className={cn('rounded-[1.35rem] border px-3.5 py-3 text-[#14295F]', item.toneClass)}>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
            <p className={cn('dashboard-number mt-2 text-[1.7rem] leading-none', item.valueClass)}>{item.value}</p>
            <p className="mt-2 text-[10px] font-bold text-slate-500">{item.note}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderOperationalQueue = () => (
    <div className="overflow-hidden rounded-[2.15rem] border border-[#D7E4FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)] shadow-[0_24px_54px_-46px_rgba(20,41,95,0.28)]">
      <div className="border-b border-[#E5ECFA] px-5 py-5 text-[#14295F] sm:px-6">
        <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-start justify-between')}>
          <div className="space-y-2">
            <Badge className="h-6 rounded-full border-none bg-[#FFF1E4] px-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#C95A08]">
              트랙제 예외 관리
            </Badge>
            <h3 className="text-[1.35rem] font-black tracking-tight text-[#14295F] sm:text-[1.55rem]">
              중간 하원과 재등원 학생만 따로 봅니다
            </h3>
            <p className="max-w-[46rem] text-xs font-bold leading-5 text-slate-500 sm:text-sm">
              미입실·지각은 위 출석 카드에서 보고, 여기서는 트랙제 중간 이동이 생긴 학생만 빠르게 확인하면 됩니다.
            </p>
          </div>
          <div className={cn('grid gap-2', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
            <div className="rounded-[1.2rem] border border-[#DCE7FF] bg-white px-3.5 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">이동 관리</p>
              <p className="dashboard-number mt-1.5 text-[1.45rem] leading-none text-[#14295F]">{operationalSummary.total}</p>
            </div>
            <div className="rounded-[1.2rem] border border-[#D9F2E7] bg-[#F3FCF8] px-3.5 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#2D8C6B]">외출 중</p>
              <p className="dashboard-number mt-1.5 text-[1.45rem] leading-none text-[#1F9E7A]">{operationalSummary.away}</p>
            </div>
            <div className="rounded-[1.2rem] border border-[#DCE7FF] bg-[#F5F9FF] px-3.5 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#2554D7]">재등원</p>
              <p className="dashboard-number mt-1.5 text-[1.45rem] leading-none text-[#2554D7]">{operationalSummary.returned}</p>
            </div>
            <div className="rounded-[1.2rem] border border-[#FFE0CF] bg-[#FFF6F0] px-3.5 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#D7652C]">중간 하원</p>
              <p className="dashboard-number mt-1.5 text-[1.45rem] leading-none text-[#D7652C]">{operationalSummary.earlyCheckout}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {operationalSignals.length === 0 ? (
          <div className="rounded-[1.6rem] border border-dashed border-[#DCE7FF] bg-[#F8FBFF] px-5 py-8 text-center text-[#14295F]">
            <p className="text-sm font-black">현재 중간 이동 관리 대상이 없습니다.</p>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-500 sm:text-sm">
              미입실·지각 신호 외에는 나머지 학생을 트랙제 기준 흐름으로 보면 됩니다.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {operationalSignals.map((signal) => {
              const room = signal.roomId ? roomById.get(signal.roomId) || null : null;
              const seat =
                room && signal.roomSeatNo
                  ? getSeatForRoom(room, signal.roomSeatNo)
                  : null;
              const scheduleRange =
                signal.routineExpectedArrivalTime && signal.plannedDepartureTime
                  ? `${signal.routineExpectedArrivalTime} ~ ${signal.plannedDepartureTime}`
                  : null;
              const excursionRange = signal.scheduleMovementSummary || null;

              return (
                <button
                  key={`${signal.seatId}_${signal.operationalExceptionKind}`}
                  type="button"
                  onClick={() => {
                    if (seat) onSeatClick(seat);
                  }}
                  disabled={!seat}
                  className={cn(
                    'rounded-[1.4rem] border border-[#E3EBF9] bg-white p-4 text-left shadow-[0_18px_36px_-34px_rgba(20,41,95,0.28)] transition-[transform,border-color,box-shadow] duration-200',
                    seat
                      ? 'hover:-translate-y-0.5 hover:border-[#FFB67B] hover:shadow-[0_24px_42px_-30px_rgba(20,41,95,0.24)]'
                      : 'cursor-default'
                  )}
                >
                  <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-start justify-between')}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-black tracking-tight text-[#14295F]">{signal.studentName}</p>
                        {signal.className ? (
                          <Badge className="h-6 rounded-full border border-[#DCE7FF] bg-[#F7FAFF] px-2.5 text-[10px] font-black text-[#5F739F]">
                            {signal.className}
                          </Badge>
                        ) : null}
                        <Badge className="h-6 rounded-full border-none bg-[#14295F] px-2.5 text-[10px] font-black text-white">
                          {signal.operationalExceptionLabel}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm font-bold leading-6 text-[#4C618F]">
                        {signal.operationalExceptionNote || signal.note}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {room && signal.roomSeatNo ? (
                          <Badge className="h-6 rounded-full border border-[#DCE7FF] bg-white px-2.5 text-[10px] font-black text-[#14295F]">
                            {room.name} · {signal.roomSeatNo}번
                          </Badge>
                        ) : null}
                        {signal.classScheduleName?.trim() ? (
                          <Badge className="h-6 rounded-full border border-[#DCE7FF] bg-white px-2.5 text-[10px] font-black text-[#5F739F]">
                            {toStudyRoomTrackScheduleName(signal.classScheduleName)}
                          </Badge>
                        ) : null}
                        {scheduleRange ? (
                          <Badge className="h-6 rounded-full border border-[#DCE7FF] bg-white px-2.5 text-[10px] font-black text-[#5F739F]">
                            등하원 {scheduleRange}
                          </Badge>
                        ) : null}
                        {excursionRange ? (
                          <Badge className="h-6 rounded-full border border-[#DCE7FF] bg-[#FFF8F2] px-2.5 text-[10px] font-black text-[#C95A08]">
                            {excursionRange}
                          </Badge>
                        ) : null}
                        {signal.currentAwayMinutes > 0 && signal.operationalExceptionKind === 'midday_leave' ? (
                          <Badge className="h-6 rounded-full border border-[#D9F2E7] bg-[#F3FCF8] px-2.5 text-[10px] font-black text-[#1F9E7A]">
                            이탈 {signal.currentAwayMinutes}분
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    {seat ? (
                      <span className="inline-flex h-9 items-center rounded-full border border-[#DCE7FF] bg-[#F7FAFF] px-3 text-[11px] font-black text-[#14295F]">
                        좌석 열기
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderAllRoomsCanvas = () => (
    <div className="overflow-hidden rounded-[2.35rem] border border-[#D7E4FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F6FAFF_100%)] shadow-[0_28px_70px_-54px_rgba(20,41,95,0.3)]">
      <div className="border-b border-[#E5ECFA] px-5 py-5 text-[#14295F] sm:px-6">
        <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-start justify-between')}>
          <div className="space-y-2">
            <Badge className="h-6 rounded-full border-none bg-[#EEF4FF] px-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#2554D7]">
              전체 호실 스냅샷
            </Badge>
            <h3 className="text-[1.45rem] font-black tracking-tight text-[#14295F] sm:text-[1.7rem]">
              방마다 핵심 상태만 먼저 봅니다
            </h3>
            <p className="max-w-[40rem] text-xs font-bold leading-5 text-slate-500 sm:text-sm">
              각 호실은 4개 숫자와 미니 좌석 분포만 보여주고, 확대 전환은 기존 호실 선택 버튼으로 이어집니다.
            </p>
          </div>
          <div className="rounded-[1.35rem] border border-[#DCE7FF] bg-white px-4 py-3 text-[#14295F] shadow-[0_18px_28px_-24px_rgba(20,41,95,0.18)]">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">관제 범위</p>
            <p className="mt-1 text-sm font-black">{scopeLabel}</p>
          </div>
        </div>
      </div>

      <div className={cn('grid gap-4 p-4 sm:p-5', isMobile ? 'grid-cols-1' : 'xl:grid-cols-2')}>
        {roomConfigs.map((room) => {
          const snapshot = roomSnapshots.find((item) => item.id === room.id);

          return (
            <button
              key={room.id}
              type="button"
              onClick={() => onRoomViewChange?.(room.id)}
              disabled={!onRoomViewChange}
              className={cn(
                'rounded-[1.85rem] border border-[#E2EAF8] bg-white p-4 text-left text-[#14295F] shadow-[0_22px_40px_-34px_rgba(20,41,95,0.24)] transition-[transform,border-color,box-shadow] duration-200',
                onRoomViewChange
                  ? 'hover:-translate-y-0.5 hover:border-[#FFB67B] hover:shadow-[0_28px_42px_-30px_rgba(20,41,95,0.24)]'
                  : 'cursor-default'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-black tracking-tight text-[#14295F]">{room.name}</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-500">
                    배정 {snapshot?.assignedCount ?? 0} / 좌석 {snapshot?.totalSeats ?? room.rows * room.cols}
                  </p>
                </div>
                <Badge className="h-7 rounded-full border border-[#DCE7FF] bg-[#F7FAFF] px-3 text-[10px] font-black text-[#14295F]">
                  {room.cols} x {room.rows}
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2">
                {[
                  { label: '공부', value: snapshot?.studyingCount ?? 0, valueClass: 'text-[#2554D7]' },
                  { label: '미입실', value: snapshot?.attentionCount ?? 0, valueClass: 'text-[#C95A08]' },
                  { label: '휴식', value: snapshot?.awayCount ?? 0, valueClass: 'text-[#1F9E7A]' },
                  { label: '퇴실', value: snapshot?.exitCount ?? 0, valueClass: 'text-slate-700' },
                ].map((item) => (
                  <div key={item.label} className="rounded-[1rem] border border-[#EDF2FC] bg-[#FAFCFF] px-2.5 py-2 text-center">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                    <p className={cn('dashboard-number mt-1 text-lg leading-none', item.valueClass)}>{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4">{renderMiniSeatMosaic(room)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderSingleRoomCanvas = () => {
    if (!selectedRoom) return null;

    return (
      <div className="overflow-hidden rounded-[2.35rem] border border-[#D7E4FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F6FAFF_100%)] shadow-[0_28px_70px_-54px_rgba(20,41,95,0.3)]">
        <div className="border-b border-[#E5ECFA] px-5 py-5 text-[#14295F] sm:px-6">
          <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-start justify-between')}>
            <div className="space-y-2">
              <Badge className="h-6 rounded-full border-none bg-[#EEF4FF] px-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#2554D7]">
                {selectedRoom.name}
              </Badge>
              <h3 className="text-[1.45rem] font-black tracking-tight text-[#14295F] sm:text-[1.7rem]">
                {selectedRoom.name} 집중 관제
              </h3>
              <p className="max-w-[40rem] text-xs font-bold leading-5 text-slate-500 sm:text-sm">
                현재 호실에서 공부중, 미입실, 휴식 흐름만 먼저 읽고 필요한 학생만 바로 선택합니다.
              </p>
            </div>
            <div className={cn('grid gap-2', isMobile ? 'grid-cols-2' : 'grid-cols-3')}>
              <div className="rounded-[1.2rem] border border-[#DCE7FF] bg-white px-3.5 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">관제 범위</p>
                <p className="mt-1 text-sm font-black text-[#14295F]">{scopeLabel}</p>
              </div>
              <div className="rounded-[1.2rem] border border-[#DCE7FF] bg-white px-3.5 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">좌석 수</p>
                <p className="mt-1 text-sm font-black text-[#14295F]">
                  {activeRoomSnapshot?.assignedCount ?? 0}/{activeRoomSnapshot?.totalSeats ?? selectedRoom.rows * selectedRoom.cols}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-[#DCE7FF] bg-white px-3.5 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">배치</p>
                <p className="mt-1 text-sm font-black text-[#14295F]">
                  {selectedRoom.cols} x {selectedRoom.rows}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          {renderRoomMetricRail(activeRoomSnapshot)}
          {renderFocusedGrid(selectedRoom)}
        </div>
      </div>
    );
  };

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center rounded-[2.1rem] border border-dashed border-[#DCE7FF] bg-[#F8FBFF] px-6 py-16 text-center text-[#14295F]">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_18px_30px_-26px_rgba(20,41,95,0.22)]">
        <ClipboardCheck className="h-6 w-6 text-[#2554D7]" />
      </div>
      <p className="mt-4 text-lg font-black tracking-tight">표시할 호실이 아직 없습니다.</p>
      <p className="mt-2 max-w-md text-sm font-bold leading-6 text-slate-500">
        좌석 배치를 먼저 저장하면 이 캔버스에서 출석 흐름을 바로 읽을 수 있습니다.
      </p>
    </div>
  );

  const content = (
    <div className="space-y-5 text-[#14295F]">
      {renderHeader()}
      {renderSummaryRail()}
      {renderOperationalQueue()}

      {isLoading ? (
        <div className="flex items-center justify-center rounded-[2.1rem] border border-dashed border-[#D7E4FF] bg-[#F7FAFF] py-20">
          <Loader2 className="h-7 w-7 animate-spin text-[#2554D7]/50" />
        </div>
      ) : roomConfigs.length === 0 ? (
        renderEmptyState()
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
