'use client';

import { type ClassroomCommandSummary, type ClassroomFocusFilter } from '@/components/dashboard/classroom-command-bar';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export interface ClassroomClassHealthSummary {
  className: string;
  occupancyRate: number;
  avgMinutes: number;
  riskCount: number;
  awayLongCount: number;
  pendingCounselingCount: number;
}

export interface ClassroomClassHealthStripProps {
  classSummaries: ClassroomClassHealthSummary[];
  activeClassName?: string | null;
  onClassSelect?: (className: string | null) => void;
  activeFilter?: ClassroomFocusFilter;
  totalSummary?: ClassroomCommandSummary;
  title?: string;
  subtitle?: string;
}

function formatMinutes(value: number) {
  const safeValue = Math.max(0, Math.round(value));
  return `${Math.floor(safeValue / 60)}h ${safeValue % 60}m`;
}

function MetricLine({ label, value, tone }: { label: string; value: string; tone?: 'default' | 'warning' | 'danger' }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5c6e88]">{label}</span>
      <span
        className={cn(
          'text-xs font-black tabular-nums',
          tone === 'warning' && 'text-amber-700',
          tone === 'danger' && 'text-rose-700',
          !tone && 'text-[#14295F]'
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function ClassroomClassHealthStrip({
  classSummaries,
  activeClassName,
  onClassSelect,
  activeFilter = 'all',
  title = '반/구역 건강도',
  subtitle = '어느 반이 조용하고, 어느 반이 먼저 봐야 하는지 한 번에 읽습니다.',
}: ClassroomClassHealthStripProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#ff7a16]">class health</p>
          <h3 className="text-lg font-black tracking-[-0.04em] text-[#14295F]">{title}</h3>
          <p className="mt-1 text-sm font-medium leading-[1.7] text-[#5c6e88]">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-[rgba(20,41,95,0.14)] bg-white text-[10px] font-black uppercase tracking-[0.16em] text-[#14295F]">
            필터 {activeFilter}
          </Badge>
          {onClassSelect && activeClassName && (
            <button
              type="button"
              onClick={() => onClassSelect(null)}
              className="text-xs font-black uppercase tracking-[0.16em] text-[#14295F]/60 transition-colors hover:text-[#14295F]"
            >
              전체 반 보기
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {classSummaries.map((summary) => {
          const isActive = activeClassName === summary.className;
          return (
            <Card
              key={summary.className}
              className={cn(
                'cursor-pointer rounded-[1.4rem] border-none transition-all duration-150',
                isActive
                  ? 'bg-[linear-gradient(180deg,#14295f_0%,#1b367c_100%)] text-white shadow-[0_16px_32px_-16px_rgba(20,41,95,0.65)]'
                  : 'bg-white shadow-sm hover:-translate-y-[1px]'
              )}
              onClick={() => onClassSelect?.(summary.className)}
            >
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={cn('text-[11px] font-black uppercase tracking-[0.18em]', isActive ? 'text-white/65' : 'text-[#5c6e88]')}>
                      {summary.className}
                    </p>
                    <h4 className={cn('mt-1 text-2xl font-black tracking-[-0.05em]', isActive ? 'text-white' : 'text-[#14295F]')}>
                      {Math.round(summary.occupancyRate)}%
                    </h4>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'border-none text-[10px] font-black uppercase tracking-[0.16em]',
                      isActive ? 'bg-white/15 text-white' : 'bg-[rgba(20,41,95,0.05)] text-[#14295F]'
                    )}
                  >
                    점유율
                  </Badge>
                </div>

                <div className="space-y-2">
                  <MetricLine label="평균 학습" value={formatMinutes(summary.avgMinutes)} tone={isActive ? 'default' : undefined} />
                  <MetricLine label="리스크 학생" value={`${summary.riskCount}명`} tone="danger" />
                  <MetricLine label="장기 외출" value={`${summary.awayLongCount}명`} tone="warning" />
                  <MetricLine label="상담 대기" value={`${summary.pendingCounselingCount}건`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
