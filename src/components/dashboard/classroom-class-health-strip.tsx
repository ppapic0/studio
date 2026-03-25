'use client';

import type { ClassroomQuickFilter, ClassroomSignalClassSummary, ClassroomSignalsSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export interface ClassroomClassHealthStripProps {
  classSummaries: ClassroomSignalClassSummary[];
  activeClassName?: string | null;
  onClassSelect?: (className: string | null) => void;
  activeFilter: ClassroomQuickFilter;
  totalSummary?: ClassroomSignalsSummary;
}

const FILTER_LABELS: Record<ClassroomQuickFilter, string> = {
  all: '전체',
  studying: '학습 중',
  awayLong: '장기 외출',
  lateOrAbsent: '미입실/지각',
  atRisk: '리스크',
  unreadReports: '미열람 리포트',
  counselingPending: '상담 대기',
};

function formatMinutes(value: number) {
  const safe = Math.max(0, Math.round(value || 0));
  return `${Math.floor(safe / 60)}h ${safe % 60}m`;
}

export function ClassroomClassHealthStrip({
  classSummaries,
  activeClassName,
  onClassSelect,
  activeFilter,
  totalSummary,
}: ClassroomClassHealthStripProps) {
  if (classSummaries.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-500">Class Health</p>
          <h3 className="text-lg font-black tracking-tight text-slate-900">반/구역 건강도</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">
            지금 어느 반을 먼저 볼지 출석률과 평균 학습, 리스크로 바로 판단합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
            현재 필터 {FILTER_LABELS[activeFilter]}
          </Badge>
          {typeof totalSummary?.atRisk === 'number' && (
            <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
              전체 리스크 {totalSummary.atRisk}
            </Badge>
          )}
          {onClassSelect && activeClassName && (
            <button
              type="button"
              className="text-xs font-black text-slate-500 transition-colors hover:text-slate-900"
              onClick={() => onClassSelect(null)}
            >
              전체 반 보기
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {classSummaries.map((summary) => {
          const active = activeClassName === summary.className;
          return (
            <Card
              key={summary.className}
              className={cn(
                'cursor-pointer rounded-[1.6rem] border-none transition-all',
                active
                  ? 'bg-slate-900 text-white shadow-[0_18px_36px_-18px_rgba(15,23,42,0.7)]'
                  : 'bg-white shadow-sm hover:-translate-y-[1px] hover:shadow-md',
              )}
              onClick={() => onClassSelect?.(summary.className)}
            >
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className={cn(
                        'text-xs font-black uppercase tracking-[0.18em]',
                        active ? 'text-white/60' : 'text-slate-500',
                      )}
                    >
                      {summary.className}
                    </p>
                    <p className="mt-1 text-3xl font-black tabular-nums">{Math.round(summary.occupancyRate)}%</p>
                  </div>
                  <Badge
                    className={cn(
                      'border-none',
                      active ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700',
                    )}
                  >
                    점유율
                  </Badge>
                </div>

                <div className="space-y-2 text-sm font-semibold">
                  <div className="flex items-center justify-between">
                    <span className={active ? 'text-white/70' : 'text-slate-500'}>평균 학습</span>
                    <span>{formatMinutes(summary.avgMinutes)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={active ? 'text-white/70' : 'text-slate-500'}>리스크 학생</span>
                    <span className={active ? 'text-white' : 'text-rose-600'}>{summary.riskCount}명</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={active ? 'text-white/70' : 'text-slate-500'}>장기 외출</span>
                    <span className={active ? 'text-white' : 'text-amber-600'}>{summary.awayLongCount}명</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={active ? 'text-white/70' : 'text-slate-500'}>상담 대기</span>
                    <span>{summary.pendingCounselingCount}건</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
