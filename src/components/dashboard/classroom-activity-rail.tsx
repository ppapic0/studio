'use client';

import { type ReactNode } from 'react';
import { AlertTriangle, ArrowUpRight, BellRing, BookOpen, ChevronRight, Clock3, Flame, MapPin, Users } from 'lucide-react';

import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { ClassroomFocusFilter } from '@/components/dashboard/classroom-command-bar';

export type ClassroomIncidentType =
  | 'awayLong'
  | 'lateOrAbsent'
  | 'atRisk'
  | 'unreadReport'
  | 'counselingPending'
  | 'penaltyThreshold'
  | 'statusChange';

export type ClassroomIncidentPriority = 'critical' | 'high' | 'medium' | 'low';

export interface ClassroomIncident {
  id: string;
  type: ClassroomIncidentType;
  priority: ClassroomIncidentPriority;
  studentId?: string;
  studentName: string;
  seatId?: string;
  className?: string;
  reason: string;
  occurredAt: string | Date;
  actionTarget?: ClassroomFocusFilter | 'student' | 'seat';
}

export interface ClassroomActivityRailProps {
  incidents: ClassroomIncident[];
  activeIncidentId?: string | null;
  onIncidentSelect?: (incident: ClassroomIncident) => void;
  onStudentSelect?: (studentId: string) => void;
  onSeatSelect?: (seatId: string) => void;
  title?: string;
  subtitle?: string;
}

const priorityStyles: Record<ClassroomIncidentPriority, string> = {
  critical: 'border-rose-200 bg-rose-50 text-rose-700',
  high: 'border-orange-200 bg-orange-50 text-orange-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  low: 'border-slate-200 bg-slate-50 text-slate-700',
};

const incidentIcons: Record<ClassroomIncidentType, ReactNode> = {
  awayLong: <BellRing className="h-4 w-4" />,
  lateOrAbsent: <AlertTriangle className="h-4 w-4" />,
  atRisk: <Flame className="h-4 w-4" />,
  unreadReport: <BookOpen className="h-4 w-4" />,
  counselingPending: <ArrowUpRight className="h-4 w-4" />,
  penaltyThreshold: <Clock3 className="h-4 w-4" />,
  statusChange: <Users className="h-4 w-4" />,
};

const incidentLabels: Record<ClassroomIncidentType, string> = {
  awayLong: '장기 외출',
  lateOrAbsent: '미입실/지각',
  atRisk: '리스크',
  unreadReport: '미열람 리포트',
  counselingPending: '상담 대기',
  penaltyThreshold: '벌점 임계',
  statusChange: '상태 변경',
};

function formatTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function ClassroomActivityRail({
  incidents,
  activeIncidentId,
  onIncidentSelect,
  onStudentSelect,
  onSeatSelect,
  title = '실시간 이벤트 레일',
  subtitle = '최근 사건 흐름을 따라가며 바로 개입할 대상을 고릅니다.',
}: ClassroomActivityRailProps) {
  return (
    <Card className="rounded-[2rem] border-none bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] shadow-[0_12px_30px_-20px_rgba(20,41,95,0.28)]">
      <CardHeader className="space-y-2 p-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#14295F]/6 text-[#14295F]">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base font-black tracking-[-0.04em] text-[#14295F]">{title}</CardTitle>
            <p className="text-[13px] font-medium leading-[1.7] text-[#5c6e88]">{subtitle}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="max-h-[32rem]">
          <div className="space-y-3 px-5 pb-5">
            {incidents.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-[rgba(20,41,95,0.12)] bg-[#f8fbff] px-4 py-6 text-center">
                <p className="text-sm font-bold text-[#5c6e88]">현재는 즉시 개입이 필요한 사건이 없습니다.</p>
              </div>
            ) : (
              incidents.map((incident) => {
                const isActive = activeIncidentId === incident.id;
                return (
                  <button
                    key={incident.id}
                    type="button"
                    onClick={() => {
                      onIncidentSelect?.(incident);
                      if (incident.studentId) onStudentSelect?.(incident.studentId);
                      if (incident.seatId) onSeatSelect?.(incident.seatId);
                    }}
                    className={cn(
                      'group w-full rounded-[1.25rem] border p-4 text-left transition-all duration-150',
                      isActive
                        ? 'border-[#14295F]/18 bg-[linear-gradient(180deg,#14295F_0%,#1b367c_100%)] text-white shadow-[0_18px_32px_-18px_rgba(20,41,95,0.65)]'
                        : 'border-[rgba(20,41,95,0.1)] bg-white hover:border-[rgba(20,41,95,0.18)] hover:shadow-sm'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-sm',
                          isActive ? 'border-white/15 bg-white/10 text-white' : priorityStyles[incident.priority]
                        )}
                      >
                        {incidentIcons[incident.type]}
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            className={cn(
                              'border-none text-[10px] font-black uppercase tracking-[0.18em]',
                              isActive ? 'bg-white/15 text-white' : priorityStyles[incident.priority]
                            )}
                          >
                            {incidentLabels[incident.type]}
                          </Badge>
                          <span className={cn('text-[11px] font-bold uppercase tracking-[0.18em]', isActive ? 'text-white/65' : 'text-[#5c6e88]')}>
                            {formatTime(incident.occurredAt)}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <p className="text-sm font-black tracking-[-0.02em]">{incident.studentName}</p>
                          <p className={cn('text-[13px] font-medium leading-[1.7]', isActive ? 'text-white/80' : 'text-[#5c6e88]')}>
                            {incident.reason}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-bold uppercase tracking-[0.16em]">
                          {incident.className && (
                            <span className={cn('rounded-full px-2.5 py-1', isActive ? 'bg-white/10 text-white/80' : 'bg-[#14295F]/6 text-[#14295F]')}>
                              {incident.className}
                            </span>
                          )}
                          {incident.seatId && (
                            <span className={cn('rounded-full px-2.5 py-1', isActive ? 'bg-white/10 text-white/80' : 'bg-[#14295F]/6 text-[#14295F]')}>
                              {incident.seatId}
                            </span>
                          )}
                          {incident.actionTarget && (
                            <span className={cn('rounded-full px-2.5 py-1', isActive ? 'bg-white/10 text-white/80' : 'bg-[#14295F]/6 text-[#14295F]')}>
                              {incident.actionTarget}
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight className={cn('mt-1 h-4 w-4 shrink-0', isActive ? 'text-white/70' : 'text-[#14295F]/30')} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
