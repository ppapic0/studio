'use client';

import { type ReactNode } from 'react';
import { AlertTriangle, ArrowUpRight, BellRing, BookOpen, Filter, Flame, Users } from 'lucide-react';

import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export type ClassroomFocusFilter =
  | 'all'
  | 'students'
  | 'risk'
  | 'awayLong'
  | 'lateOrAbsent'
  | 'unreadReports'
  | 'counselingPending';

export interface ClassroomCommandSummary {
  studying: number;
  awayLong: number;
  lateOrAbsent: number;
  atRisk: number;
  unreadReports: number;
  counselingPending: number;
  totalStudents: number;
}

export interface ClassroomCommandBarAction {
  key: ClassroomFocusFilter;
  label: string;
  value: number;
  tone?: 'default' | 'warning' | 'danger' | 'accent';
  icon?: ReactNode;
}

export interface ClassroomCommandBarProps {
  summary: ClassroomCommandSummary;
  activeFilter: ClassroomFocusFilter;
  onFilterChange: (filter: ClassroomFocusFilter) => void;
  onClearFilter?: () => void;
  title?: string;
  subtitle?: string;
  actions?: ClassroomCommandBarAction[];
  extraSlot?: ReactNode;
}

const defaultActions = (summary: ClassroomCommandSummary): ClassroomCommandBarAction[] => [
  { key: 'students', label: '현재 재실', value: summary.studying, tone: 'accent', icon: <Users className="h-4 w-4" /> },
  { key: 'risk', label: '리스크', value: summary.atRisk, tone: 'danger', icon: <Flame className="h-4 w-4" /> },
  { key: 'awayLong', label: '장기 외출', value: summary.awayLong, tone: 'warning', icon: <BellRing className="h-4 w-4" /> },
  { key: 'lateOrAbsent', label: '미입실/지각', value: summary.lateOrAbsent, tone: 'warning', icon: <AlertTriangle className="h-4 w-4" /> },
  { key: 'unreadReports', label: '미열람 리포트', value: summary.unreadReports, tone: 'default', icon: <BookOpen className="h-4 w-4" /> },
  { key: 'counselingPending', label: '상담 대기', value: summary.counselingPending, tone: 'default', icon: <ArrowUpRight className="h-4 w-4" /> },
];

const toneClasses: Record<NonNullable<ClassroomCommandBarAction['tone']>, string> = {
  default: 'border-[rgba(20,41,95,0.12)] bg-white text-[#14295F] hover:border-[rgba(20,41,95,0.2)]',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300',
  danger: 'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300',
  accent: 'border-[#cdd8ff] bg-[linear-gradient(180deg,#f8fbff,#eef4ff)] text-[#14295F] hover:border-[#a8baf5]',
};

function StatChip({
  action,
  active,
  onClick,
}: {
  action: ClassroomCommandBarAction;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex min-w-[11rem] items-center justify-between gap-4 rounded-[1.15rem] border px-4 py-3 text-left transition-all duration-150 active:scale-[0.98]',
        active ? 'shadow-[0_12px_24px_-12px_rgba(20,41,95,0.35)] ring-2 ring-[#14295F]/8' : 'shadow-sm',
        toneClasses[action.tone ?? 'default']
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/80 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]">
          {action.icon ?? <Filter className="h-4 w-4" />}
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] opacity-70">{action.label}</p>
          <p className="mt-1 text-2xl font-black tracking-[-0.04em] tabular-nums">{action.value}</p>
        </div>
      </div>
      <Badge variant="outline" className="border-transparent bg-white/75 text-[10px] font-black uppercase tracking-[0.18em]">
        필터
      </Badge>
    </button>
  );
}

export function ClassroomCommandBar({
  summary,
  activeFilter,
  onFilterChange,
  onClearFilter,
  title = '실시간 관제 바',
  subtitle = '지금 바로 확인해야 할 교실 신호를 한 줄로 정리합니다.',
  actions,
  extraSlot,
}: ClassroomCommandBarProps) {
  const visibleActions = actions ?? defaultActions(summary);
  const totalSignalCount =
    summary.awayLong + summary.lateOrAbsent + summary.atRisk + summary.unreadReports + summary.counselingPending;

  return (
    <Card className="rounded-[2rem] border-none bg-[radial-gradient(circle_at_top_left,rgba(255,122,22,0.14),transparent_30%),linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)] shadow-[0_16px_40px_-20px_rgba(20,41,95,0.25)]">
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-none bg-[#14295F] text-white">교실 관제</Badge>
              <Badge variant="outline" className="border-[rgba(20,41,95,0.14)] bg-white text-[#14295F]">
                지금 알림 {totalSignalCount}
              </Badge>
            </div>
            <div>
              <h2 className="text-xl font-black tracking-[-0.04em] text-[#14295F] sm:text-[1.55rem]">{title}</h2>
              <p className="mt-1 text-sm font-medium leading-[1.7] text-[#5c6e88]">{subtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={activeFilter === 'all' ? 'secondary' : 'outline'}
              onClick={() => onFilterChange('all')}
              className="h-10 rounded-xl px-4"
            >
              전체 보기
            </Button>
            {onClearFilter && activeFilter !== 'all' && (
              <Button type="button" variant="ghost" onClick={onClearFilter} className="h-10 rounded-xl px-4">
                필터 초기화
              </Button>
            )}
            {extraSlot}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleActions.map((action) => (
            <StatChip
              key={action.key}
              action={action}
              active={activeFilter === action.key}
              onClick={() => onFilterChange(action.key)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
