'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowUpRight,
  BarChart3,
  Loader2,
  Sparkles,
  UserRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  type CenterAdminHeatmapRow,
  getHeatmapTone,
} from '@/lib/center-admin-heatmap';
import {
  CENTER_ADMIN_SEAT_DOMAIN_LABELS,
  getCenterAdminDomainInsight,
  type CenterAdminSeatDomainKey,
  type CenterAdminStudentSeatSignal,
} from '@/lib/center-admin-seat-heatmap';

type CenterAdminHeatmapChartsProps = {
  title: string;
  description: string;
  rows: CenterAdminHeatmapRow[];
  interventionSignals: CenterAdminStudentSeatSignal[];
  scopeLabel?: string;
  isLoading?: boolean;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
  activeRowId?: string | null;
  onActiveRowChange?: (rowId: string) => void;
};

function getTonePalette(score: number, options?: { brandOrange?: boolean }) {
  if (options?.brandOrange) {
    return {
      fill: '#FF7A16',
      stroke: '#E56D10',
      badgeClass: 'bg-[#FFF2E8] text-[#C95A08]',
      chipClass: 'border-[#FFD7BA] bg-[linear-gradient(180deg,#FFF7F1_0%,#FFFFFF_100%)] text-[#C95A08]',
      surfaceClass: 'bg-[#FFF8F2]',
      textClass: 'text-[#C95A08]',
      glowClass: 'shadow-[0_24px_48px_-38px_rgba(255,122,22,0.26)]',
    };
  }
  const tone = getHeatmapTone(score);
  if (tone === 'stable') {
    return {
      fill: '#14295F',
      stroke: '#17326B',
      badgeClass: 'bg-[#14295F] text-white',
      chipClass: 'border-[#dbe7ff] bg-[#eef4ff] text-[#14295F]',
      surfaceClass: 'bg-[#f6f8ff]',
      textClass: 'text-[#14295F]',
      glowClass: 'shadow-[0_24px_48px_-38px_rgba(20,41,95,0.34)]',
    };
  }
  if (tone === 'good') {
    return {
      fill: '#2554D7',
      stroke: '#2554D7',
      badgeClass: 'bg-[#eef4ff] text-[#2554D7]',
      chipClass: 'border-[#dbe7ff] bg-[#f7f9ff] text-[#2554D7]',
      surfaceClass: 'bg-[#f7f9ff]',
      textClass: 'text-[#2554D7]',
      glowClass: 'shadow-[0_24px_48px_-38px_rgba(37,84,215,0.22)]',
    };
  }
  if (tone === 'watch') {
    return {
      fill: '#FF7A16',
      stroke: '#FF7A16',
      badgeClass: 'bg-[#FFF2E8] text-[#C95A08]',
      chipClass: 'border-[#FFD7BA] bg-[#FFF7F1] text-[#C95A08]',
      surfaceClass: 'bg-[#FFF8F2]',
      textClass: 'text-[#C95A08]',
      glowClass: 'shadow-[0_24px_48px_-38px_rgba(255,122,22,0.26)]',
    };
  }
  return {
    fill: '#E24C4B',
    stroke: '#D13E3D',
    badgeClass: 'bg-rose-100 text-rose-700',
    chipClass: 'border-rose-200 bg-rose-50 text-rose-700',
    surfaceClass: 'bg-rose-50/70',
    textClass: 'text-rose-700',
    glowClass: 'shadow-[0_24px_48px_-38px_rgba(226,76,75,0.24)]',
  };
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
    <div className="rounded-2xl border border-[#dbe7ff] bg-white/95 p-4 shadow-xl backdrop-blur">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black tracking-tight text-[#14295F]">
        {Math.round(Number(payload[0]?.value || 0))}점
      </p>
    </div>
  );
}

export function CenterAdminHeatmapCharts({
  title,
  description,
  rows,
  interventionSignals,
  scopeLabel = '센터 전체',
  isLoading = false,
  actionHref,
  actionLabel,
  className,
  activeRowId: controlledActiveRowId,
  onActiveRowChange,
}: CenterAdminHeatmapChartsProps) {
  const [internalActiveRowId, setInternalActiveRowId] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  const lowestRowId = useMemo(() => {
    if (rows.length === 0) return null;

    return rows.reduce((lowest, current) => {
      if (current.summaryScore < lowest.summaryScore) return current;
      if (current.summaryScore === lowest.summaryScore && current.label.localeCompare(lowest.label, 'ko') < 0) {
        return current;
      }
      return lowest;
    }).id;
  }, [rows]);

  useEffect(() => {
    if (controlledActiveRowId !== undefined) return;
    setInternalActiveRowId(lowestRowId);
  }, [scopeLabel, lowestRowId, controlledActiveRowId]);

  useEffect(() => {
    if (controlledActiveRowId !== undefined) return;
    if (!internalActiveRowId) return;
    if (rows.some((row) => row.id === internalActiveRowId)) return;
    setInternalActiveRowId(lowestRowId);
  }, [rows, internalActiveRowId, lowestRowId, controlledActiveRowId]);

  useEffect(() => {
    if (controlledActiveRowId !== undefined) return;
    if (!lowestRowId) return;
    onActiveRowChange?.(lowestRowId);
  }, [controlledActiveRowId, lowestRowId, onActiveRowChange]);

  const resolvedActiveRowId = controlledActiveRowId ?? internalActiveRowId;
  const handleActiveRowChange = (rowId: string) => {
    if (controlledActiveRowId === undefined) {
      setInternalActiveRowId(rowId);
    }
    onActiveRowChange?.(rowId);
  };

  const activeRow = rows.find((row) => row.id === resolvedActiveRowId) || rows.find((row) => row.id === lowestRowId) || null;
  const activeRowUsesBrandOrange = activeRow?.id === 'operational';
  const activePalette = getTonePalette(activeRow?.summaryScore ?? 75, { brandOrange: activeRowUsesBrandOrange });
  const activeMetricPreview = activeRow?.metrics.slice(0, 3) || [];
  const activeTrendData = activeRow?.trend.map((point) => ({
    label: point.label,
    score: point.score,
  })) || [];
  const activeLeadMetric = activeMetricPreview[0] || null;
  const activeLastTrendScore = activeTrendData.length > 0
    ? activeTrendData[activeTrendData.length - 1]?.score ?? 0
    : null;
  const activeTrendStartScore = activeTrendData.length > 0
    ? activeTrendData[0]?.score ?? 0
    : null;
  const activeTrendDelta = activeLastTrendScore !== null && activeTrendStartScore !== null
    ? Math.round(activeLastTrendScore - activeTrendStartScore)
    : null;

  const selectedRow = rows.find((row) => row.id === selectedRowId) || null;
  const selectedDomainKey = (selectedRow?.id || null) as CenterAdminSeatDomainKey | null;

  const topStudents = useMemo(() => {
    if (!selectedDomainKey) return [];

    return interventionSignals
      .map((signal) => ({
        signal,
        insight: getCenterAdminDomainInsight(signal, selectedDomainKey),
      }))
      .sort((a, b) => {
        if (a.insight.score !== b.insight.score) return a.insight.score - b.insight.score;
        if (a.signal.compositeHealth !== b.signal.compositeHealth) {
          return a.signal.compositeHealth - b.signal.compositeHealth;
        }
        return a.signal.todayMinutes - b.signal.todayMinutes;
      })
      .slice(0, 5);
  }, [interventionSignals, selectedDomainKey]);

  if (isLoading) {
    return (
      <Card className={cn('overflow-hidden rounded-[2.1rem] border border-[#DCE7FF] bg-white text-[#14295F] shadow-[0_20px_40px_-34px_rgba(20,41,95,0.22)]', className)}>
        <CardContent className="flex min-h-[240px] flex-col items-center justify-center gap-4 p-7">
          <Loader2 className="h-10 w-10 animate-spin text-[#14295F] opacity-25" />
          <p className="text-sm font-black uppercase tracking-[0.24em] text-slate-500">운영 그래프 동기화 중</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card
        className={cn(
          'overflow-hidden rounded-[2.1rem] border border-[#DCE7FF] bg-white text-[#14295F] shadow-[0_20px_44px_-36px_rgba(20,41,95,0.22)]',
          className
        )}
      >
        <CardHeader className="border-b border-[#DCE7FF] bg-[linear-gradient(180deg,#FBFDFF_0%,#F4F8FF_100%)] px-4 py-4 sm:px-5 sm:py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-1.5">
              <div className="flex items-center gap-2 text-[#5c6e97]">
                <Sparkles className="h-4 w-4 text-[#2554D7]" />
                <span className="text-[10px] font-black uppercase tracking-[0.24em]">대표 차트</span>
              </div>
              <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight text-[#14295F] sm:text-[1.55rem]">
                <BarChart3 className="h-5 w-5 text-[#2554D7]" />
                {title}
              </CardTitle>
              <CardDescription className="text-xs font-bold leading-5 text-[#5c6e97]">{description}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="h-7 rounded-full border-none bg-[#EEF4FF] px-3 text-[10px] font-black text-[#2554D7]">
                기본 선택: 가장 약한 축
              </Badge>
              <Badge className="h-7 rounded-full border-none bg-white px-3 text-[10px] font-black text-[#14295F] shadow-sm">
                {scopeLabel}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 p-3 sm:p-4">
          {rows.length === 0 ? (
            <div className="rounded-[1.7rem] border-2 border-dashed border-[#DCE7FF] bg-[#FBFDFF] px-6 py-10 text-center">
              <p className="text-sm font-black text-slate-500">표시할 운영 그래프 데이터가 없습니다.</p>
            </div>
          ) : (
            <>
              <div className="-mx-1 overflow-x-auto px-1 pb-1">
                <div className="inline-flex min-w-max gap-2 rounded-[1.2rem] bg-[#F4F8FF] p-1">
                  {rows.map((row) => {
                    const rowPalette = getTonePalette(row.summaryScore);
                    const isActive = activeRow?.id === row.id;

                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => handleActiveRowChange(row.id)}
                        className={cn(
                          'group flex min-w-[122px] items-center justify-between gap-3 rounded-[1rem] border px-3 py-2 text-left transition-[transform,box-shadow,border-color,background-color,color] duration-200 hover:-translate-y-0.5',
                          isActive
                            ? 'border-[#FF7A16]/25 bg-white text-[#14295F] shadow-[0_16px_32px_-26px_rgba(20,41,95,0.24)] ring-1 ring-[#FF7A16]/20'
                            : 'border-transparent bg-transparent text-slate-500 hover:border-[#DCE7FF] hover:bg-white hover:text-[#14295F]'
                        )}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-black tracking-tight">{row.label}</p>
                          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">
                            {row.summaryLabel}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[11px] font-black',
                            isActive ? rowPalette.badgeClass : 'bg-slate-100 text-slate-500'
                          )}
                        >
                          {row.summaryScore}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeRow ? (
                <div className="grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)_280px]">
                  <section
                    className={cn(
                      'rounded-[1.55rem] border p-4 text-[#14295F]',
                      activeRowUsesBrandOrange
                        ? 'border-[#FFD7BA] bg-[linear-gradient(180deg,#FFF8F2_0%,#FFFFFF_100%)] shadow-[0_18px_36px_-32px_rgba(255,122,22,0.18)]'
                        : 'border-[#DCE7FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] shadow-[0_18px_36px_-32px_rgba(20,41,95,0.16)]'
                    )}
                  >
                    <div className={cn('flex items-center gap-2', activePalette.textClass)}>
                      <BarChart3 className="h-4 w-4" />
                      <span className="text-[10px] font-black uppercase tracking-[0.22em]">선택 축</span>
                    </div>
                    <h3 className="mt-3 text-[1.65rem] font-black tracking-tight text-[#14295F]">{activeRow.label}</h3>
                    <p className="mt-1 text-sm font-bold leading-6 text-slate-500">{activeRow.description}</p>

                    <div className={cn('mt-4 rounded-[1.35rem] border p-4', activePalette.chipClass, activePalette.glowClass)}>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">현재 점수</p>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <p className="dashboard-number text-4xl tracking-tight">{activeRow.summaryScore}</p>
                        <Badge className={cn('h-7 rounded-full border-none px-3 text-[10px] font-black', activePalette.badgeClass)}>
                          {activeRow.summaryLabel}
                        </Badge>
                      </div>
                      <p className="mt-2 text-[11px] font-bold leading-5 opacity-85">
                        {activeLeadMetric ? `${activeLeadMetric.label} ${activeLeadMetric.value}` : `${activeRow.summaryLabel} 상태를 먼저 확인합니다.`}
                      </p>
                    </div>
                  </section>

                  <section
                    className={cn(
                      'rounded-[1.55rem] border p-4 text-[#14295F]',
                      activeRowUsesBrandOrange
                        ? 'border-[#FFD7BA] bg-[linear-gradient(180deg,#FFF8F2_0%,#FFFFFF_100%)]'
                        : 'border-[#DCE7FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)]'
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">최근 추이</p>
                        <p className="mt-1 text-sm font-black text-[#14295F]">최근 7일 운영 변화</p>
                      </div>
                      <div className="text-right">
                        {activeLastTrendScore !== null ? (
                          <p className={cn('text-sm font-black', activePalette.textClass)}>
                            최근 {Math.round(activeLastTrendScore)}점
                          </p>
                        ) : null}
                        {activeTrendDelta !== null ? (
                          <p className={cn('mt-1 text-[11px] font-black', activeTrendDelta <= 0 ? activePalette.textClass : 'text-emerald-600')}>
                            {activeTrendDelta > 0 ? '+' : ''}{activeTrendDelta}p
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div
                      className={cn(
                        'mt-3 rounded-[1.35rem] border p-2.5',
                        activeRowUsesBrandOrange
                          ? 'border-[#FFE2CD] bg-[#FFF7F1]'
                          : 'border-[#E5EDFF] bg-[#F8FBFF]'
                      )}
                    >
                      {activeTrendData.length === 0 ? (
                        <div className="flex h-[158px] items-center justify-center rounded-[1rem] bg-white text-sm font-black text-slate-400">
                          추이 데이터가 없습니다.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={158}>
                          <AreaChart data={activeTrendData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                            <defs>
                              <linearGradient id={`heatmap_active_${activeRow.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={activePalette.fill} stopOpacity={0.32} />
                                <stop offset="100%" stopColor={activePalette.fill} stopOpacity={0.03} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e6edf9" vertical={false} />
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
                              stroke={activePalette.stroke}
                              strokeWidth={2.5}
                              fill={`url(#heatmap_active_${activeRow.id})`}
                              dot={{ r: 3, fill: activePalette.stroke, strokeWidth: 0 }}
                              activeDot={{ r: 5, fill: activePalette.stroke, strokeWidth: 0 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activeMetricPreview.slice(0, 2).map((metric) => (
                        <div
                          key={metric.id}
                          className="rounded-full border border-[#DCE7FF] bg-white px-3 py-1.5 text-[11px] font-black text-[#14295F]"
                        >
                          {metric.label} {metric.value}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section
                    className={cn(
                      'rounded-[1.55rem] border p-4 text-[#14295F]',
                      activeRowUsesBrandOrange
                        ? 'border-[#FFD7BA] bg-[linear-gradient(180deg,#FFF8F2_0%,#FFFFFF_100%)] shadow-[0_16px_30px_-28px_rgba(255,122,22,0.16)]'
                        : 'border-[#DCE7FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] shadow-[0_16px_30px_-28px_rgba(20,41,95,0.16)]'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">대표 지표</p>
                        <p className="mt-1 text-sm font-black text-[#14295F]">바로 읽을 수치</p>
                      </div>
                      <Badge className="h-6 rounded-full border-none bg-[#14295F] px-2.5 text-[10px] font-black text-white">
                        {activeMetricPreview.length}개
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      {activeMetricPreview.length === 0 ? (
                        <div className="rounded-[1.1rem] border border-dashed border-[#DCE7FF] bg-white px-3 py-6 text-center text-[11px] font-bold text-slate-400">
                          대표 지표를 불러오는 중입니다.
                        </div>
                      ) : (
                        activeMetricPreview.map((metric) => {
                          const metricPalette = getTonePalette(metric.score, { brandOrange: activeRowUsesBrandOrange });
                          return (
                            <div
                              key={metric.id}
                              className={cn(
                                'rounded-[1.1rem] border px-3 py-2.5 text-[#14295F] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5',
                                metricPalette.chipClass
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-[11px] font-black">{metric.label}</p>
                                <span className="text-sm font-black">{metric.value}</span>
                              </div>
                              <p className="mt-1 text-[11px] font-bold leading-5 opacity-80">{metric.hint}</p>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="mt-3 border-t border-[#DCE7FF] pt-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5c6e97]">바로 조치</p>
                      <p className="mt-1 text-sm font-black tracking-tight text-[#14295F]">필요한 화면만 바로 엽니다.</p>
                      <div className="mt-3 grid gap-2">
                        {activeRow.href ? (
                          <Button
                            asChild
                            type="button"
                            className="h-10 rounded-xl bg-[#FF7A16] text-sm font-black text-white transition-colors hover:bg-[#E56D10]"
                          >
                            <Link href={activeRow.href}>
                              관련 화면 이동
                              <ArrowUpRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        ) : actionHref && actionLabel ? (
                          <Button
                            asChild
                            type="button"
                            className="h-10 rounded-xl bg-[#FF7A16] text-sm font-black text-white transition-colors hover:bg-[#E56D10]"
                          >
                            <Link href={actionHref}>
                              {actionLabel}
                              <ArrowUpRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 rounded-xl border-[#DCE7FF] bg-white text-sm font-black text-[#14295F] transition-[transform,background-color,border-color] hover:-translate-y-0.5 hover:border-[#FF7A16]/24 hover:bg-[#FFF8F2]"
                          onClick={() => setSelectedRowId(activeRow.id)}
                        >
                          개입 우선 학생 보기
                        </Button>
                      </div>
                    </div>
                  </section>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRow} onOpenChange={(open) => !open && setSelectedRowId(null)}>
        <DialogContent
          motionPreset="dashboard-premium"
          className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl"
        >
          {selectedRow && (
            <>
              <div className="shrink-0 bg-gradient-to-r from-[#14295F] to-[#1d3f89] p-6 text-white sm:p-8">
                <DialogHeader className="relative z-10 text-left">
                  <DialogTitle className="text-2xl font-black tracking-tight">
                    {selectedRow.label} 개입 우선 학생
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-sm font-bold text-white/75">
                    {scopeLabel} 기준으로 지금 먼저 개입해야 할 학생 5명입니다. 왜 그런지와 바로 할 개입을 함께 보여줍니다.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge className="border-none bg-white/15 text-white">
                    {selectedRow.summaryLabel} {selectedRow.summaryScore}
                  </Badge>
                  <Badge className="border-none bg-white/15 text-white">
                    대표 지표 {selectedRow.metrics[0]?.label || '-'}
                  </Badge>
                  <Badge className="border-none bg-white/15 text-white">{scopeLabel}</Badge>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-white p-5 sm:p-6">
                {topStudents.length === 0 ? (
                  <div className="rounded-[1.75rem] border-2 border-dashed border-slate-200 px-6 py-14 text-center">
                    <p className="text-sm font-black text-slate-500">개입 우선 학생 데이터가 아직 충분하지 않습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {topStudents.map(({ signal, insight }, index) => (
                      <div key={`${selectedRow.id}_${signal.studentId}`} className="rounded-[1.75rem] border border-slate-200 bg-slate-50/60 p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 font-black text-primary">
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-black text-slate-900">{signal.studentName}</p>
                                {signal.className && (
                                  <Badge className="border-none bg-slate-200 text-slate-700">{signal.className}</Badge>
                                )}
                                {signal.roomSeatNo && (
                                  <Badge className="border-none bg-sky-100 text-sky-700">
                                    {signal.roomId || '교실'} {signal.roomSeatNo}번
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 text-xs font-bold text-slate-500">
                                주간 공부시간 {signal.weeklyStudyLabel.replace('주간 ', '')} · 오늘 {signal.todayMinutes}분
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={cn('border-none font-black', insight.badgeClass)}>
                              {CENTER_ADMIN_SEAT_DOMAIN_LABELS[selectedDomainKey!]} {insight.score}
                            </Badge>
                            <UserRound className="h-4 w-4 text-slate-400" />
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3">
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">왜 개입이 필요한가</p>
                            <p className="mt-2 text-sm font-bold leading-relaxed text-slate-800">{insight.analysis}</p>
                          </div>
                          <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/55">바로 할 개입</p>
                            <p className="mt-2 text-sm font-bold leading-relaxed text-slate-800">{insight.action}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
