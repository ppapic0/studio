'use client';

import Link from 'next/link';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Loader2,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  type CenterAdminHeatmapRow,
  getHeatmapTone,
} from '@/lib/center-admin-heatmap';

type CenterAdminHeatmapChartsProps = {
  title: string;
  description: string;
  rows: CenterAdminHeatmapRow[];
  isLoading?: boolean;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
};

function getTonePalette(score: number) {
  const tone = getHeatmapTone(score);
  if (tone === 'stable') {
    return {
      fill: '#10b981',
      stroke: '#059669',
      light: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      glow: 'shadow-[0_14px_32px_rgba(16,185,129,0.18)]',
    };
  }
  if (tone === 'good') {
    return {
      fill: '#06b6d4',
      stroke: '#0891b2',
      light: 'bg-cyan-50 text-cyan-800 border-cyan-200',
      glow: 'shadow-[0_14px_32px_rgba(6,182,212,0.18)]',
    };
  }
  if (tone === 'watch') {
    return {
      fill: '#f59e0b',
      stroke: '#d97706',
      light: 'bg-amber-50 text-amber-800 border-amber-200',
      glow: 'shadow-[0_14px_32px_rgba(245,158,11,0.16)]',
    };
  }
  return {
    fill: '#f43f5e',
    stroke: '#e11d48',
    light: 'bg-rose-50 text-rose-800 border-rose-200',
    glow: 'shadow-[0_14px_32px_rgba(244,63,94,0.18)]',
  };
}

function SummaryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { label: string; score: number; summaryLabel: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{point.label}</p>
      <p className="mt-1 text-lg font-black tracking-tight text-slate-900">{point.score}점</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{point.summaryLabel}</p>
    </div>
  );
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black tracking-tight text-slate-900">{Math.round(Number(payload[0]?.value || 0))}점</p>
    </div>
  );
}

export function CenterAdminHeatmapCharts({
  title,
  description,
  rows,
  isLoading = false,
  actionHref,
  actionLabel,
  className,
}: CenterAdminHeatmapChartsProps) {
  if (isLoading) {
    return (
      <Card className={cn('overflow-hidden rounded-[2.5rem] border-none bg-white shadow-xl', className)}>
        <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-4 p-8">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-25" />
          <p className="text-sm font-black uppercase tracking-[0.24em] text-muted-foreground">운영 그래프 동기화 중</p>
        </CardContent>
      </Card>
    );
  }

  const summaryChartData = rows.map((row) => ({
    id: row.id,
    label: row.label,
    score: row.summaryScore,
    summaryLabel: row.summaryLabel,
  }));

  return (
    <Card className={cn('overflow-hidden rounded-[2.5rem] border-none bg-white shadow-xl', className)}>
      <CardHeader className="border-b bg-muted/5 px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2 text-primary/70">
              <Sparkles className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.28em]">Center Graph View</span>
            </div>
            <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl">
              <BarChart3 className="h-5 w-5 text-primary/60" />
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

      <CardContent className="space-y-5 p-5 sm:p-8">
        {rows.length === 0 ? (
          <div className="rounded-[2rem] border-2 border-dashed border-muted-foreground/15 px-6 py-12 text-center">
            <p className="text-sm font-black text-muted-foreground/50">표시할 운영 그래프 데이터가 없습니다.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
              <Card className="rounded-[2rem] border border-primary/10 bg-[#fafcff] shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-primary">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                    영역별 운영 건강도
                  </CardTitle>
                  <CardDescription className="text-xs font-bold text-muted-foreground">
                    센터관리자가 바로 우선순위를 정할 수 있게 5개 축을 같은 100점 체계로 비교합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart
                      data={summaryChartData}
                      layout="vertical"
                      margin={{ top: 8, right: 16, left: 12, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={92}
                        tick={{ fontSize: 11, fontWeight: 900, fill: '#1e3a8a' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip cursor={{ fill: 'rgba(15,23,42,0.04)' }} content={<SummaryTooltip />} />
                      <Bar dataKey="score" radius={[0, 14, 14, 0]} barSize={26}>
                        {summaryChartData.map((entry) => (
                          <Cell key={entry.id} fill={getTonePalette(entry.score).fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid gap-3">
                {rows.map((row) => {
                  const palette = getTonePalette(row.summaryScore);
                  const leadMetric = row.metrics[0];

                  return (
                    <div
                      key={row.id}
                      className={cn(
                        'rounded-[1.8rem] border bg-white p-4',
                        palette.light,
                        palette.glow
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="grid gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-black tracking-tight">{row.label}</p>
                            <Badge className={cn('h-6 border-none px-2.5 text-[10px] font-black', palette.light)}>
                              {row.summaryScore}
                            </Badge>
                          </div>
                          <p className="text-xs font-bold opacity-80">{row.description}</p>
                        </div>
                        <Activity className="h-4 w-4 shrink-0 opacity-55" />
                      </div>
                      <div className="mt-3 rounded-2xl bg-white/80 px-3 py-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] opacity-55">대표 지표</p>
                        <p className="mt-1 text-base font-black tracking-tight">{leadMetric?.label || '지표 준비중'}</p>
                        <p className="text-xs font-bold opacity-80">{leadMetric?.value || '-'} · {leadMetric?.hint || '데이터를 확인해주세요.'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {rows.map((row) => {
                const palette = getTonePalette(row.summaryScore);
                const trendData = row.trend.map((point) => ({
                  label: point.label,
                  score: point.score,
                }));

                return (
                  <Card key={row.id} className="rounded-[2rem] border border-primary/10 bg-white shadow-sm">
                    <CardHeader className="space-y-3 pb-2">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="grid gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-lg font-black tracking-tight text-primary">{row.label}</CardTitle>
                            <Badge className={cn('h-6 border-none px-2.5 text-[10px] font-black', palette.light)}>
                              {row.summaryLabel} {row.summaryScore}
                            </Badge>
                          </div>
                          <CardDescription className="text-xs font-bold text-muted-foreground">
                            {row.description}
                          </CardDescription>
                        </div>
                        {row.href && (
                          <Button asChild variant="ghost" className="h-9 rounded-xl px-3 text-[11px] font-black text-primary">
                            <Link href={row.href}>
                              관련 화면
                              <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {row.metrics.map((metric) => (
                          <span
                            key={metric.id}
                            className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black', getTonePalette(metric.score).light)}
                          >
                            {metric.label} {metric.value}
                          </span>
                        ))}
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <ResponsiveContainer width="100%" height={188}>
                        <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`heatmap_${row.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={palette.fill} stopOpacity={0.32} />
                              <stop offset="100%" stopColor={palette.fill} stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" vertical={false} />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            domain={[0, 100]}
                            tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                            tickLine={false}
                            axisLine={false}
                            width={28}
                          />
                          <Tooltip content={<TrendTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="score"
                            stroke={palette.stroke}
                            strokeWidth={2.5}
                            fill={`url(#heatmap_${row.id})`}
                            dot={{ r: 3, fill: palette.stroke, strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: palette.stroke, strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                      <p className="mt-2 text-[11px] font-bold leading-relaxed text-slate-500">
                        최근 7일 추이를 기준으로 안정도 흐름을 바로 읽고, 아래 관련 화면으로 세부 조치를 이어갈 수 있습니다.
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
