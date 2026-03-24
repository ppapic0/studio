'use client';

import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BellRing,
  BookOpen,
  Flame,
  RefreshCw,
  UserCheck,
  Users,
} from 'lucide-react';

import type { ClassroomQuickFilter, ClassroomSignalsSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export type ClassroomCommandBarAction = {
  key: ClassroomQuickFilter;
  label: string;
  value: number;
  description: string;
  tone?: 'default' | 'accent' | 'warning' | 'danger';
  icon?: LucideIcon;
};

export interface ClassroomCommandBarProps {
  summary: ClassroomSignalsSummary;
  totalStudents: number;
  activeFilter: ClassroomQuickFilter;
  onFilterChange: (filter: ClassroomQuickFilter) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const toneClasses: Record<NonNullable<ClassroomCommandBarAction['tone']>, string> = {
  default: 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
  accent: 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300',
  danger: 'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300',
};

function buildActions(summary: ClassroomSignalsSummary): ClassroomCommandBarAction[] {
  return [
    {
      key: 'studying',
      label: '학습 중',
      value: summary.studying,
      description: '지금 좌석에서 학습을 이어가고 있는 학생 수입니다.',
      tone: 'accent',
      icon: UserCheck,
    },
    {
      key: 'awayLong',
      label: '장기 외출',
      value: summary.awayLong,
      description: '외출 또는 휴식 상태가 길어져 확인이 필요한 학생입니다.',
      tone: 'warning',
      icon: BellRing,
    },
    {
      key: 'lateOrAbsent',
      label: '미입실/지각',
      value: summary.lateOrAbsent,
      description: '입실 확인이 아직 되지 않아 바로 확인해야 하는 학생입니다.',
      tone: 'warning',
      icon: AlertTriangle,
    },
    {
      key: 'atRisk',
      label: '리스크',
      value: summary.atRisk,
      description: '리스크 신호가 높아 우선 개입이 필요한 학생입니다.',
      tone: 'danger',
      icon: Flame,
    },
    {
      key: 'unreadReports',
      label: '미열람 리포트',
      value: summary.unreadReports,
      description: '최근 발송한 리포트가 아직 확인되지 않은 학생입니다.',
      tone: 'default',
      icon: BookOpen,
    },
    {
      key: 'counselingPending',
      label: '상담 대기',
      value: summary.counselingPending,
      description: '오늘 상담 일정이 있거나 바로 연결이 필요한 학생입니다.',
      tone: 'default',
      icon: Users,
    },
  ];
}

export function ClassroomCommandBar({
  summary,
  totalStudents,
  activeFilter,
  onFilterChange,
  onRefresh,
  isRefreshing = false,
}: ClassroomCommandBarProps) {
  const actions = buildActions(summary);
  const totalSignals =
    summary.awayLong +
    summary.lateOrAbsent +
    summary.atRisk +
    summary.unreadReports +
    summary.counselingPending;

  return (
    <Card className="rounded-[2.25rem] border-none bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.08),transparent_24%),linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_18px_42px_-24px_rgba(15,23,42,0.35)]">
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-none bg-slate-900 text-white">실시간 관제</Badge>
              <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                즉시 확인 {totalSignals}
              </Badge>
              <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                전체 학생 {totalStudents}
              </Badge>
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                지금 먼저 봐야 할 학생과 상황
              </h2>
              <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
                교실 전체를 놓치지 않도록 우선순위 신호를 한 줄로 묶었습니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={activeFilter === 'all' ? 'default' : 'outline'}
              className="rounded-xl"
              onClick={() => onFilterChange('all')}
            >
              전체 보기
            </Button>
            {onRefresh && (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn('mr-2 h-4 w-4', isRefreshing && 'animate-spin')} />
                새로고침
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {actions.map((action) => {
            const Icon = action.icon ?? Users;
            const active = activeFilter === action.key;

            return (
              <button
                key={action.key}
                type="button"
                onClick={() => onFilterChange(action.key)}
                className={cn(
                  'rounded-[1.35rem] border px-4 py-4 text-left transition-all active:scale-[0.99]',
                  toneClasses[action.tone ?? 'default'],
                  active && 'ring-2 ring-slate-900/10 shadow-sm',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black tracking-wide">{action.label}</p>
                      <p className="mt-1 text-2xl font-black tabular-nums">{action.value}</p>
                    </div>
                  </div>
                  {active && <Badge className="border-none bg-slate-900 text-white">선택됨</Badge>}
                </div>
                <p className="mt-3 text-xs font-medium leading-5 opacity-80">{action.description}</p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
