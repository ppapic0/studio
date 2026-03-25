'use client';

import { formatDistanceToNowStrict } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  BookOpen,
  ChevronRight,
  Clock3,
  Flame,
  LogIn,
  LogOut,
} from 'lucide-react';

import type { ClassroomSignalIncident } from '@/lib/types';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ClassroomActivityRailProps {
  incidents: ClassroomSignalIncident[];
  activeIncidentKey?: string | null;
  onIncidentSelect?: (incident: ClassroomSignalIncident) => void;
  onStudentSelect?: (studentId: string) => void;
  onSeatSelect?: (seatId: string) => void;
}

function getIncidentMeta(type: ClassroomSignalIncident['type']) {
  switch (type) {
    case 'away_long':
      return { label: '장기 외출', icon: BellRing };
    case 'late_or_absent':
      return { label: '미입실/지각', icon: AlertTriangle };
    case 'risk':
      return { label: '리스크', icon: Flame };
    case 'unread_report':
      return { label: '리포트 미열람', icon: BookOpen };
    case 'counseling_pending':
      return { label: '상담 대기', icon: ArrowUpRight };
    case 'penalty_threshold':
      return { label: '벌점 임계', icon: Clock3 };
    case 'check_in':
      return { label: '입실', icon: LogIn };
    case 'check_out':
      return { label: '퇴실', icon: LogOut };
    default:
      return { label: type, icon: AlertTriangle };
  }
}

function priorityClasses(priority: ClassroomSignalIncident['priority']) {
  switch (priority) {
    case 'critical':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'high':
      return 'border-orange-200 bg-orange-50 text-orange-700';
    case 'medium':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

function incidentKey(incident: ClassroomSignalIncident) {
  return `${incident.studentId}:${incident.type}:${incident.occurredAt?.toMillis?.() || 0}`;
}

function formatSeatId(seatId?: string) {
  if (!seatId) return null;
  const number = seatId.replace('seat_', '').replace(/^0+/, '');
  return `좌석 ${number || '0'}`;
}

export function ClassroomActivityRail({
  incidents,
  activeIncidentKey,
  onIncidentSelect,
  onStudentSelect,
  onSeatSelect,
}: ClassroomActivityRailProps) {
  return (
    <Card className="rounded-[2rem] border-none bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] shadow-[0_18px_38px_-22px_rgba(15,23,42,0.28)]">
      <CardHeader className="space-y-2 p-5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-600">Activity Rail</p>
          <CardTitle className="text-lg font-black tracking-tight text-slate-900">최근 사건 타임라인</CardTitle>
          <p className="text-sm font-medium leading-6 text-slate-500">
            최근 30~60분 안의 주요 이상 신호를 시간순으로 정리해 바로 개입할 수 있게 했습니다.
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[34rem]">
          <div className="space-y-3 px-5 pb-5">
            {incidents.length === 0 ? (
              <div className="rounded-[1.4rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">
                지금은 즉시 개입이 필요한 사건이 없습니다.
              </div>
            ) : (
              incidents.map((incident) => {
                const key = incidentKey(incident);
                const meta = getIncidentMeta(incident.type);
                const Icon = meta.icon;
                const active = activeIncidentKey === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      onIncidentSelect?.(incident);
                      if (incident.studentId) onStudentSelect?.(incident.studentId);
                      if (incident.seatId) onSeatSelect?.(incident.seatId);
                    }}
                    className={cn(
                      'w-full rounded-[1.3rem] border p-4 text-left transition-all active:scale-[0.99]',
                      active
                        ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border',
                          active ? 'border-white/15 bg-white/10 text-white' : priorityClasses(incident.priority),
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            className={cn(
                              'border-none',
                              active ? 'bg-white/10 text-white' : priorityClasses(incident.priority),
                            )}
                          >
                            {meta.label}
                          </Badge>
                          <span className={cn('text-[11px] font-bold', active ? 'text-white/70' : 'text-slate-500')}>
                            {incident.occurredAt?.toDate
                              ? formatDistanceToNowStrict(incident.occurredAt.toDate(), { addSuffix: true, locale: ko })
                              : '방금 전'}
                          </span>
                        </div>

                        <div>
                          <p className="text-sm font-black">{incident.studentName}</p>
                          <p className={cn('mt-1 text-sm leading-6', active ? 'text-white/80' : 'text-slate-500')}>
                            {incident.reason}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {incident.className && (
                            <Badge
                              variant="outline"
                              className={cn(
                                active ? 'border-white/20 text-white/80' : 'border-slate-200 text-slate-600',
                              )}
                            >
                              {incident.className}
                            </Badge>
                          )}
                          {formatSeatId(incident.seatId) && (
                            <Badge
                              variant="outline"
                              className={cn(
                                active ? 'border-white/20 text-white/80' : 'border-slate-200 text-slate-600',
                              )}
                            >
                              {formatSeatId(incident.seatId)}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <ChevronRight
                        className={cn('mt-1 h-4 w-4 shrink-0', active ? 'text-white/70' : 'text-slate-300')}
                      />
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
