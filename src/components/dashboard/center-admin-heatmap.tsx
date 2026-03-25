'use client';

import Link from 'next/link';
import { ArrowUpRight, Loader2, Sparkles, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  type CenterAdminHeatmapMetric,
  type CenterAdminHeatmapRow,
  getHeatmapTone,
} from '@/lib/center-admin-heatmap';

type CenterAdminHeatmapProps = {
  title: string;
  description: string;
  rows: CenterAdminHeatmapRow[];
  variant?: 'full' | 'compact';
  isLoading?: boolean;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
};

function getToneClass(score: number) {
  const tone = getHeatmapTone(score);
  if (tone === 'stable') return 'border-emerald-200 bg-emerald-50/80 text-emerald-900';
  if (tone === 'good') return 'border-cyan-200 bg-cyan-50/80 text-cyan-900';
  if (tone === 'watch') return 'border-amber-200 bg-amber-50/90 text-amber-900';
  return 'border-rose-200 bg-rose-50/90 text-rose-900';
}

function MetricCard({ metric }: { metric: CenterAdminHeatmapMetric }) {
  const content = (
    <div
      className={cn(
        'rounded-[1.4rem] border p-4 shadow-sm transition-all hover:shadow-md',
        getToneClass(metric.score),
        metric.href ? 'cursor-pointer' : ''
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] opacity-65">{metric.label}</p>
          <p className="text-lg font-black tracking-tight">{metric.value}</p>
        </div>
        <Badge className={cn('h-6 border-none px-2.5 text-[10px] font-black', getToneClass(metric.score))}>
          {metric.score}
        </Badge>
      </div>
      <p className="mt-2 text-[11px] font-bold leading-relaxed opacity-80">{metric.hint}</p>
    </div>
  );

  if (!metric.href) return content;
  return (
    <Link href={metric.href} className="block">
      {content}
    </Link>
  );
}

function TrendStrip({ row }: { row: CenterAdminHeatmapRow }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">최근 7일</p>
      <div className="flex flex-wrap gap-1.5">
        {row.trend.map((point) => (
          <div
            key={`${row.id}_${point.label}`}
            title={`${row.label} ${point.label} ${point.score}점`}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-xl border text-[10px] font-black shadow-sm sm:h-9 sm:w-9',
              getToneClass(point.score)
            )}
          >
            {point.label.replace('/', '.')}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CenterAdminHeatmap({
  title,
  description,
  rows,
  variant = 'full',
  isLoading = false,
  actionHref,
  actionLabel,
  className,
}: CenterAdminHeatmapProps) {
  if (isLoading) {
    return (
      <Card className={cn('overflow-hidden rounded-[2.5rem] border-none bg-white shadow-xl', className)}>
        <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-4 p-8">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-25" />
          <p className="text-sm font-black uppercase tracking-[0.24em] text-muted-foreground">운영 히트맵 동기화 중</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden rounded-[2.5rem] border-none bg-white shadow-xl', className)}>
      <CardHeader className="border-b bg-muted/5 px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2 text-primary/70">
              <Sparkles className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.28em]">Center Heatmap</span>
            </div>
            <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              {title}
            </CardTitle>
            <CardDescription className="text-xs font-bold text-muted-foreground">{description}</CardDescription>
          </div>
          {actionHref && actionLabel && (
            <Button asChild variant="outline" className="h-10 rounded-xl border-2 font-black">
              <Link href={actionHref}>
                {actionLabel}
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className={cn('space-y-4', variant === 'compact' ? 'p-4 sm:p-5' : 'p-5 sm:p-8')}>
        {rows.map((row) => (
          <div
            key={row.id}
            className={cn(
              'rounded-[2rem] border p-4 shadow-sm sm:p-5',
              row.summaryScore >= 70 ? 'border-primary/10 bg-[#fafafa]' : 'border-amber-200 bg-amber-50/30'
            )}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-black tracking-tight text-primary sm:text-lg">{row.label}</h3>
                  <Badge className={cn('h-6 border-none px-2.5 text-[10px] font-black', getToneClass(row.summaryScore))}>
                    {row.summaryLabel} {row.summaryScore}
                  </Badge>
                </div>
                <p className="text-xs font-bold leading-relaxed text-muted-foreground">{row.description}</p>
              </div>
              {row.href && variant === 'full' && (
                <Button asChild variant="ghost" className="h-9 justify-start rounded-xl px-3 text-[11px] font-black text-primary sm:justify-center">
                  <Link href={row.href}>
                    관련 화면
                    <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </div>

            {variant === 'full' ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {row.metrics.map((metric) => (
                  <MetricCard key={metric.id} metric={metric} />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[1.4rem] border border-dashed border-primary/10 bg-white px-4 py-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {row.metrics.map((metric) => (
                    <span
                      key={metric.id}
                      className={cn('rounded-full border px-2.5 py-1 text-[10px] font-black', getToneClass(metric.score))}
                    >
                      {metric.label} {metric.value}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <TrendStrip row={row} />
            </div>

            {row.href && variant === 'compact' && (
              <div className="mt-4">
                <Button asChild variant="outline" className="h-10 rounded-xl border-2 font-black">
                  <Link href={row.href}>
                    상세 보기
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        ))}

        {rows.length === 0 && (
          <div className="rounded-[2rem] border-2 border-dashed border-muted-foreground/15 px-6 py-12 text-center">
            <p className="text-sm font-black text-muted-foreground/50">표시할 운영 히트맵 데이터가 없습니다.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
