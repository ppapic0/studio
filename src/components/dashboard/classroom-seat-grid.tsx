'use client';

import {
  AlertTriangle,
  Armchair,
  BookOpen,
  CalendarClock,
  Flame,
  ShieldAlert,
} from 'lucide-react';

import type {
  AttendanceCurrent,
  ClassroomOverlayMode,
  ClassroomQuickFilter,
  ClassroomSeatSignal,
} from '@/lib/types';
import type {
  ClassroomIncidentFilter,
  ClassroomLegendItem,
  ClassroomSeatOverlayState,
} from '@/lib/teacher-classroom-model';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export interface ClassroomSeatGridSeat {
  seat: AttendanceCurrent;
  overlayState: ClassroomSeatOverlayState;
  seatSignal?: ClassroomSeatSignal;
  studentName?: string;
  className?: string;
  seatZone?: string;
  sessionText?: string;
  totalText?: string;
  highlighted?: boolean;
}

export interface ClassroomSeatGridProps {
  title: string;
  rows: number;
  cols: number;
  seats: ClassroomSeatGridSeat[];
  overlayMode: ClassroomOverlayMode;
  onOverlayModeChange: (mode: ClassroomOverlayMode) => void;
  activeFilter: ClassroomQuickFilter;
  filters: ClassroomIncidentFilter[];
  onFilterChange: (filter: ClassroomQuickFilter) => void;
  legend: ClassroomLegendItem[];
  selectedSeatId?: string | null;
  onSeatSelect: (seatId: string) => void;
}

const overlayModes: Array<{ value: ClassroomOverlayMode; label: string }> = [
  { value: 'status', label: '상태' },
  { value: 'risk', label: '리스크' },
  { value: 'penalty', label: '벌점' },
  { value: 'minutes', label: '학습량' },
  { value: 'counseling', label: '상담' },
  { value: 'report', label: '리포트' },
];

function seatAccent(mode: ClassroomOverlayMode, seat: ClassroomSeatGridSeat) {
  if (!seat.seat.studentId) return 'bg-white border-slate-200 text-slate-400';
  if (mode === 'status' && seat.seat.status === 'studying') return 'bg-blue-600 border-blue-700 text-white';
  if (mode === 'status' && (seat.seat.status === 'away' || seat.seat.status === 'break')) {
    return 'bg-amber-50 border-amber-300 text-amber-800';
  }
  return `${seat.overlayState.overlayTone} border-transparent`;
}

function seatSignalIcons(seat: ClassroomSeatGridSeat) {
  const icons = [];
  if (seat.seatSignal?.overlayFlags.includes('risk')) icons.push(<Flame key="risk" className="h-3 w-3" />);
  if (seat.seatSignal?.hasUnreadReport) icons.push(<BookOpen key="report" className="h-3 w-3" />);
  if (seat.seatSignal?.hasCounselingToday) icons.push(<CalendarClock key="counseling" className="h-3 w-3" />);
  if (seat.seatSignal?.effectivePenaltyPoints && seat.seatSignal.effectivePenaltyPoints >= 7) {
    icons.push(<ShieldAlert key="penalty" className="h-3 w-3" />);
  }
  if (seat.seatSignal?.overlayFlags.includes('late_or_absent')) {
    icons.push(<AlertTriangle key="late" className="h-3 w-3" />);
  }
  return icons.slice(0, 3);
}

export function ClassroomSeatGrid({
  title,
  rows,
  cols,
  seats,
  overlayMode,
  onOverlayModeChange,
  activeFilter,
  filters,
  onFilterChange,
  legend,
  selectedSeatId,
  onSeatSelect,
}: ClassroomSeatGridProps) {
  const seatMap = new Map(seats.map((item) => [item.seat.id, item]));

  return (
    <Card className="rounded-[2.5rem] border-none bg-white shadow-[0_20px_42px_-26px_rgba(15,23,42,0.35)]">
      <CardHeader className="space-y-4 border-b bg-slate-50/80 px-6 py-5 sm:px-8">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-600">Seat Overlay</p>
            <CardTitle className="text-xl font-black tracking-tight text-slate-900">{title}</CardTitle>
          </div>
          <div className="flex flex-wrap gap-2">
            {overlayModes.map((mode) => (
              <Button
                key={mode.value}
                type="button"
                size="sm"
                variant={overlayMode === mode.value ? 'default' : 'outline'}
                className="rounded-xl"
                onClick={() => onOverlayModeChange(mode.value)}
              >
                {mode.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <Button
              key={filter.key}
              type="button"
              size="sm"
              variant={activeFilter === filter.key ? 'default' : 'outline'}
              className="rounded-full"
              onClick={() => onFilterChange(filter.key)}
            >
              {filter.label} {filter.count}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {legend.map((item) => (
            <Badge key={item.key} variant="outline" className={cn('border-none', item.tone)}>
              {item.label}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        <ScrollArea className="w-full max-w-full">
          <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-4 sm:p-6">
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(64px, 1fr))` }}>
              {Array.from({ length: cols }).map((_, colIndex) => (
                <div key={colIndex} className="flex flex-col gap-2">
                  {Array.from({ length: rows }).map((__, rowIndex) => {
                    const seatNo = colIndex * rows + rowIndex + 1;
                    const seatId = `seat_${seatNo.toString().padStart(3, '0')}`;
                    const item = seatMap.get(seatId);

                    if (!item) {
                      return (
                        <div
                          key={seatId}
                          className="aspect-square min-w-[64px] rounded-2xl border border-dashed border-slate-200 bg-white"
                        />
                      );
                    }

                    const icons = seatSignalIcons(item);
                    const selected = selectedSeatId === item.seat.id || item.highlighted;

                    return (
                      <button
                        key={seatId}
                        type="button"
                        onClick={() => onSeatSelect(item.seat.id)}
                        className={cn(
                          'aspect-square min-w-[64px] rounded-2xl border p-1 text-left shadow-sm transition-all',
                          seatAccent(overlayMode, item),
                          item.overlayState.dimmed && 'opacity-35',
                          selected && 'ring-2 ring-slate-900/20',
                          item.overlayState.ringTone,
                        )}
                      >
                        <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-[0.9rem] p-1.5">
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-[9px] font-black opacity-70">{seatNo}</span>
                            {item.seatZone && (
                              <Badge className="h-4 border-none bg-white/20 px-1.5 text-[8px] font-black">
                                {item.seatZone.charAt(0)}
                              </Badge>
                            )}
                          </div>

                          {!item.seat.studentId ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
                              <Armchair className="h-4 w-4 opacity-40" />
                              <span className="text-[10px] font-black opacity-60">빈 좌석</span>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="truncate text-[10px] font-black">{item.studentName || '학생'}</p>
                              <div className="space-y-0.5 text-[8px] font-bold opacity-80">
                                {item.className && <p className="truncate">{item.className}</p>}
                                <p className="truncate">{item.sessionText}</p>
                                <p className="truncate">{item.totalText}</p>
                              </div>
                              {item.overlayState.overlayLabel && (
                                <Badge className="h-4 border-none bg-white/20 px-1.5 text-[8px] font-black">
                                  {item.overlayState.overlayLabel}
                                </Badge>
                              )}
                              {icons.length > 0 && <div className="flex items-center gap-1 opacity-80">{icons}</div>}
                            </div>
                          )}
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
      </CardContent>
    </Card>
  );
}
