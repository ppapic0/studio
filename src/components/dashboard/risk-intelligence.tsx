'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { format, subDays } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  Building2,
  ChevronRight,
  Clock,
  DollarSign,
  Gauge,
  History,
  Loader2,
  ShieldAlert,
  Siren,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import type { BillingProfile, CenterMembership, DailyStudentStat, GrowthProgress, Invoice, PaymentRecord } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getStudyDayDate, getStudyDayKey } from '@/lib/study-day';
import {
  analyzeStudentRisk,
  buildExecutiveRiskSummary,
  DIMENSION_BG,
  DIMENSION_COLORS,
  DIMENSION_LABELS,
  getRiskLevelMeta,
  type RevenueExposureLevel,
  type RiskActionItem,
  type RiskActionPriority,
  type RiskDimensionKey,
  type RiskLevel,
  type StudentRiskAnalysis,
} from '@/lib/student-risk-engine';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type TimestampLike = { toDate?: () => Date } | Date | string | null | undefined;

const LEVEL_SCORE_CLASS: Record<RiskLevel, string> = {
  긴급: 'bg-rose-600 text-white',
  위험: 'bg-orange-500 text-white',
  주의: 'bg-amber-400 text-white',
  안정: 'bg-emerald-500 text-white',
};

const PRIORITY_META: Record<RiskActionPriority, { label: string; className: string }> = {
  today: { label: '오늘 조치', className: 'bg-rose-100 text-rose-700' },
  week: { label: '이번 주', className: 'bg-orange-100 text-orange-700' },
  observe: { label: '관찰', className: 'bg-slate-100 text-slate-700' },
};

const EXPOSURE_META: Record<RevenueExposureLevel, { label: string; className: string }> = {
  critical: { label: '매출 위험 높음', className: 'bg-rose-100 text-rose-700' },
  high: { label: '매출 위험 큼', className: 'bg-orange-100 text-orange-700' },
  medium: { label: '매출 위험 보통', className: 'bg-amber-100 text-amber-700' },
  low: { label: '매출 위험 낮음', className: 'bg-emerald-100 text-emerald-700' },
};

const DIMENSION_SURFACE_META: Record<
  RiskDimensionKey,
  {
    icon: LucideIcon;
    shell: string;
    iconWrap: string;
    iconColor: string;
    scorePanel: string;
    scoreText: string;
    scoreSubtle: string;
    meter: string;
    reasonPanel: string;
  }
> = {
  dropout: {
    icon: AlertTriangle,
    shell: 'border-rose-200/80 bg-[linear-gradient(180deg,#fff7f7_0%,#ffffff_44%,#fff6f6_100%)] shadow-[0_24px_48px_-38px_rgba(225,29,72,0.38)]',
    iconWrap: 'bg-rose-500/12 ring-1 ring-rose-200/70',
    iconColor: 'text-rose-600',
    scorePanel: 'bg-[linear-gradient(180deg,#fff1f3_0%,#ffe4e8_100%)] ring-1 ring-rose-200/70',
    scoreText: 'text-rose-700',
    scoreSubtle: 'text-rose-500',
    meter: 'bg-[linear-gradient(90deg,#fb7185_0%,#f43f5e_100%)]',
    reasonPanel: 'border-rose-100 bg-white/80',
  },
  focus: {
    icon: BrainCircuit,
    shell: 'border-violet-200/80 bg-[linear-gradient(180deg,#fbf8ff_0%,#ffffff_44%,#f9f5ff_100%)] shadow-[0_24px_48px_-38px_rgba(124,58,237,0.34)]',
    iconWrap: 'bg-violet-500/12 ring-1 ring-violet-200/70',
    iconColor: 'text-violet-600',
    scorePanel: 'bg-[linear-gradient(180deg,#f5f0ff_0%,#ede4ff_100%)] ring-1 ring-violet-200/70',
    scoreText: 'text-violet-700',
    scoreSubtle: 'text-violet-500',
    meter: 'bg-[linear-gradient(90deg,#a78bfa_0%,#7c3aed_100%)]',
    reasonPanel: 'border-violet-100 bg-white/80',
  },
  pattern: {
    icon: Activity,
    shell: 'border-amber-200/80 bg-[linear-gradient(180deg,#fffaf2_0%,#ffffff_44%,#fff8ef_100%)] shadow-[0_24px_48px_-38px_rgba(245,158,11,0.34)]',
    iconWrap: 'bg-amber-500/12 ring-1 ring-amber-200/70',
    iconColor: 'text-amber-600',
    scorePanel: 'bg-[linear-gradient(180deg,#fff4dd_0%,#ffebbf_100%)] ring-1 ring-amber-200/70',
    scoreText: 'text-amber-700',
    scoreSubtle: 'text-amber-600',
    meter: 'bg-[linear-gradient(90deg,#fbbf24_0%,#f59e0b_100%)]',
    reasonPanel: 'border-amber-100 bg-white/80',
  },
  stagnation: {
    icon: TrendingDown,
    shell: 'border-sky-200/80 bg-[linear-gradient(180deg,#f5fbff_0%,#ffffff_44%,#f2f8ff_100%)] shadow-[0_24px_48px_-38px_rgba(14,165,233,0.32)]',
    iconWrap: 'bg-sky-500/12 ring-1 ring-sky-200/70',
    iconColor: 'text-sky-600',
    scorePanel: 'bg-[linear-gradient(180deg,#eaf6ff_0%,#d7eeff_100%)] ring-1 ring-sky-200/70',
    scoreText: 'text-sky-700',
    scoreSubtle: 'text-sky-500',
    meter: 'bg-[linear-gradient(90deg,#38bdf8_0%,#0ea5e9_100%)]',
    reasonPanel: 'border-sky-100 bg-white/80',
  },
};

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toDateSafe(value: TimestampLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function toMs(value: TimestampLike): number {
  const date = toDateSafe(value);
  return date ? date.getTime() : 0;
}

function formatWon(value: number): string {
  return `₩${Math.round(value || 0).toLocaleString('ko-KR')}`;
}

function buildDateKeys(days: number, referenceDate: Date): string[] {
  return Array.from({ length: days }, (_, index) => format(subDays(referenceDate, index), 'yyyy-MM-dd'));
}

function summarizePayment30d(payments: PaymentRecord[] | undefined) {
  const from = subDays(new Date(), 29).getTime();
  return (payments || []).reduce((sum, payment) => {
    if (payment.status !== 'success') return sum;
    return toMs(payment.processedAt) >= from ? sum + Number(payment.amount || 0) : sum;
  }, 0);
}

function buildInvoiceSummary(invoices: Invoice[] | undefined) {
  const grouped = new Map<string, { latestInvoiceAmount: number; outstandingAmount: number }>();
  for (const invoice of invoices || []) {
    const current = grouped.get(invoice.studentId) || { latestInvoiceAmount: 0, outstandingAmount: 0 };
    const amount = Number(invoice.finalPrice || 0);
    if (!current.latestInvoiceAmount && invoice.status !== 'refunded' && invoice.status !== 'void') {
      current.latestInvoiceAmount = amount;
    }
    if (invoice.status === 'issued' || invoice.status === 'overdue') {
      current.outstandingAmount += amount;
    }
    grouped.set(invoice.studentId, current);
  }
  return grouped;
}

function confidenceBadge(score: number) {
  if (score >= 75) return 'bg-emerald-100 text-emerald-700';
  if (score >= 45) return 'bg-amber-100 text-amber-700';
  return 'bg-rose-100 text-rose-700';
}

function priorityWeight(priority: RiskActionPriority) {
  return priority === 'today' ? 0 : priority === 'week' ? 1 : 2;
}

function keyMetrics(student: StudentRiskAnalysis) {
  return [
    { label: '성장률', value: `${Math.round(student.metricsSnapshot.growthRate * 100)}%`, icon: TrendingDown },
    { label: '오늘 학습', value: `${Math.round(student.metricsSnapshot.todayMinutes)}분`, icon: Clock },
    { label: '계획 완료율', value: `${Math.round(student.metricsSnapshot.completionRate)}%`, icon: Target },
    { label: '벌점', value: `${Math.round(student.metricsSnapshot.penalty)}점`, icon: ShieldAlert },
    { label: '저학습 연속', value: `${Math.round(student.metricsSnapshot.lowStudyStreak)}일`, icon: History },
    { label: '14일 추세', value: `${Math.round(student.metricsSnapshot.trend14d * 100)}%`, icon: BarChart3 },
  ];
}

function StudentDetailDialog({
  student,
  open,
  onOpenChange,
  showExecutiveData,
}: {
  student: StudentRiskAnalysis | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showExecutiveData: boolean;
}) {
  if (!student) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden rounded-[2rem] p-0">
        <div className={cn('p-8 text-white', LEVEL_SCORE_CLASS[student.overallLevel].split(' ')[0])}>
          <DialogHeader>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="border-none bg-white/15 text-white">학생 리스크 설명</Badge>
              <Badge className="border-none bg-white/15 text-white">{student.overallLevel}</Badge>
              <Badge className="border-none bg-white/15 text-white">신뢰도 {student.confidenceScore}</Badge>
            </div>
            <DialogTitle className="text-4xl font-black tracking-tight">
              {student.identity.studentName}
            </DialogTitle>
            <DialogDescription className="text-white/80">
              {student.identity.className || '반 정보 없음'} · 종합 위험도 {student.dimensions.overall}/100
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[65vh]">
          <div className="space-y-6 bg-slate-50 p-8">
            <section className="grid gap-4 md:grid-cols-3">
              {student.topFactors.map((factor) => (
                <Card key={`${factor.dimension}-${factor.key}`} className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge className={cn('border-none', getRiskLevelMeta(factor.normalizedScore).badge, 'text-white')}>
                        {DIMENSION_LABELS[factor.dimension]}
                      </Badge>
                      <span className="text-sm font-black text-slate-500">기여 {factor.overallContribution.toFixed(1)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">{factor.label}</p>
                      <p className="text-xs font-bold text-slate-500">{factor.displayValue}</p>
                    </div>
                    <p className="text-xs font-semibold leading-relaxed text-slate-600">{factor.reason}</p>
                  </CardContent>
                </Card>
              ))}
            </section>

            <section className="space-y-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">dimension breakdown</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">차원별 리스크 해석</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">각 차원 점수, 가중치, 주요 원인과 바로 적용할 행동을 한 카드 안에서 확인합니다.</p>
                </div>
                <Badge className="w-fit border-none bg-slate-900 text-white">
                  상위 3개 원인 중심
                </Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
              {(Object.keys(student.explanations) as RiskDimensionKey[]).map((dimension) => {
                const explanation = student.explanations[dimension];
                const surfaceMeta = DIMENSION_SURFACE_META[dimension];
                const Icon = surfaceMeta.icon;
                const strongestFactor = explanation.factors[0];
                return (
                  <Card key={dimension} className={cn('overflow-hidden rounded-[2rem] border shadow-none', surfaceMeta.shell)}>
                    <CardContent className="space-y-5 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', surfaceMeta.iconWrap)}>
                              <Icon className={cn('h-5 w-5', surfaceMeta.iconColor)} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={cn('border-none text-white', DIMENSION_BG[dimension])}>{explanation.label}</Badge>
                                <Badge variant="outline" className="border-slate-200 bg-white/80 text-[11px] font-black text-slate-600">
                                  {explanation.level}
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm font-black leading-snug text-slate-900">{explanation.summary}</p>
                            </div>
                          </div>
                        </div>
                        <div className={cn('shrink-0 rounded-[1.4rem] px-4 py-3 text-right', surfaceMeta.scorePanel)}>
                          <p className={cn('text-4xl font-black leading-none tracking-tight', surfaceMeta.scoreText)}>{explanation.score}</p>
                          <p className={cn('mt-1 text-[11px] font-black', surfaceMeta.scoreSubtle)}>가중치 {Math.round(explanation.overallWeight * 100)}%</p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">전체 기여도</p>
                          <p className="mt-2 text-lg font-black text-slate-900">{explanation.overallContribution.toFixed(1)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">주요 요인</p>
                          <p className="mt-2 text-sm font-black text-slate-900">{strongestFactor?.label || '-'}</p>
                        </div>
                        <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">상태</p>
                          <p className={cn('mt-2 text-sm font-black', DIMENSION_COLORS[dimension])}>{explanation.level}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {explanation.factors.slice(0, 3).map((factor) => (
                          <div key={factor.key} className={cn('rounded-[1.35rem] border px-4 py-4', surfaceMeta.reasonPanel)}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-black text-slate-900">{factor.label}</span>
                                  <Badge variant="outline" className="border-slate-200 bg-white/80 text-[10px] font-black text-slate-500">
                                    {factor.displayValue}
                                  </Badge>
                                </div>
                                <p className="mt-2 text-[12px] font-semibold leading-5 text-slate-600">{factor.reason}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-lg font-black text-slate-900">{factor.normalizedScore}</p>
                                <p className="text-[10px] font-bold text-slate-400">리스크</p>
                              </div>
                            </div>
                            <Progress
                              value={factor.normalizedScore}
                              className="mt-3 h-2.5 bg-slate-200/70"
                              indicatorClassName={surfaceMeta.meter}
                            />
                            <div className="mt-3 rounded-xl bg-white/90 px-3 py-2">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">바로 할 행동</p>
                              <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-600">{factor.recommendedAction}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50 md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-black">실행 권장 액션</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[...student.immediateActions, ...student.weeklyActions].map((action, index) => (
                    <div key={`${action.title}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge className={cn('border-none', PRIORITY_META[action.priority].className)}>
                          {PRIORITY_META[action.priority].label}
                        </Badge>
                        <span className="text-sm font-black text-slate-900">{action.title}</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-600">{action.description}</p>
                    </div>
                  ))}
                  {student.observationNotes.length > 0 && (
                    <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">관찰 포인트</p>
                      <div className="mt-2 space-y-1">
                        {student.observationNotes.map((note) => (
                          <p key={note} className="text-xs font-semibold text-slate-600">{note}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-black">핵심 지표</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {keyMetrics(student).map(({ label, value, icon: Icon }) => (
                    <div key={label} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                      <Icon className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-[11px] font-bold text-slate-500">{label}</p>
                        <p className="text-sm font-black text-slate-900">{value}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-black">분석 신뢰도</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className={cn('border-none', confidenceBadge(student.confidenceScore))}>
                      {student.confidenceLevel}
                    </Badge>
                    <span className="text-2xl font-black text-slate-900">{student.confidenceScore}</span>
                  </div>
                  {student.confidenceReasons.map((reason) => (
                    <p key={reason} className="text-xs font-semibold text-slate-600">{reason}</p>
                  ))}
                </CardContent>
              </Card>

              {showExecutiveData && (
                <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-black">재무 영향</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Badge className={cn('border-none', EXPOSURE_META[student.revenue.exposureLevel].className)}>
                      {EXPOSURE_META[student.revenue.exposureLevel].label}
                    </Badge>
                    <div className="grid gap-2 text-sm font-semibold text-slate-700">
                      <div className="flex items-center justify-between">
                        <span>월 매출 기준</span>
                        <span className="font-black">{formatWon(student.revenue.monthlyRevenueBasis)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>이탈 위험 매출</span>
                        <span className="font-black text-rose-600">{formatWon(student.revenue.revenueAtRisk)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>미수금 위험</span>
                        <span className="font-black text-orange-600">{formatWon(student.revenue.outstandingAmount)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t bg-white p-6">
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="rounded-xl font-black">
              <Link href={`/dashboard/teacher/students/${student.identity.studentId}`}>학생 상세 열기</Link>
            </Button>
            <Button asChild className="rounded-xl font-black">
              <Link href="/dashboard/appointments/reservations">상담 예약으로 이동</Link>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StudentListTab({
  students,
  onSelect,
  isMobile,
  showExecutiveData,
}: {
  students: StudentRiskAnalysis[];
  onSelect: (student: StudentRiskAnalysis) => void;
  isMobile: boolean;
  showExecutiveData: boolean;
}) {
  const urgent = students.filter((student) => student.dimensions.overall >= 75).slice(0, 5);
  const lowConfidence = students.filter((student) => student.confidenceScore < 45).slice(0, 5);
  const revenueHotspots = [...students]
    .sort((a, b) => (b.revenue.revenueAtRisk + b.revenue.outstandingAmount) - (a.revenue.revenueAtRisk + a.revenue.outstandingAmount))
    .slice(0, 5);

  return (
    <div className={cn('grid gap-6', isMobile ? 'grid-cols-1' : 'md:grid-cols-12')}>
      <div className="space-y-4 md:col-span-8">
        <Card className="rounded-[2rem] border-none shadow-lg ring-1 ring-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black">
              <Gauge className="h-5 w-5 text-rose-600" />
              학생별 설명 가능한 리스크 분석
            </CardTitle>
            <CardDescription>점수 근거, 상위 요인, 즉시 조치까지 한 번에 확인합니다.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[620px]">
              <div className="divide-y divide-slate-100">
                {students.map((student) => {
                  const topDimensions = (Object.keys(student.explanations) as RiskDimensionKey[])
                    .sort((a, b) => student.explanations[b].overallContribution - student.explanations[a].overallContribution)
                    .slice(0, 2);
                  return (
                    <button
                      key={student.identity.studentId}
                      type="button"
                      onClick={() => onSelect(student)}
                      className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left transition hover:bg-slate-50"
                    >
                      <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black shadow-sm', LEVEL_SCORE_CLASS[student.overallLevel])}>
                            {student.dimensions.overall}
                          </div>
                          <div>
                            <p className="text-lg font-black tracking-tight text-slate-900">{student.identity.studentName}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-[10px] font-black">{student.identity.className || '반 정보 없음'}</Badge>
                              <Badge className={cn('border-none text-white', getRiskLevelMeta(student.dimensions.overall).badge)}>
                                {student.overallLevel}
                              </Badge>
                              <Badge className={cn('border-none', confidenceBadge(student.confidenceScore))}>
                                신뢰도 {student.confidenceScore}
                              </Badge>
                              {showExecutiveData && student.revenue.monthlyRevenueBasis > 0 && (
                                <Badge className={cn('border-none', EXPOSURE_META[student.revenue.exposureLevel].className)}>
                                  {formatWon(student.revenue.revenueAtRisk)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {student.topFactors.map((factor) => (
                            <Badge key={`${student.identity.studentId}-${factor.key}`} variant="outline" className="rounded-full text-[10px] font-black">
                              {factor.label} · {factor.displayValue}
                            </Badge>
                          ))}
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                          {topDimensions.map((dimension) => (
                            <div key={dimension} className="rounded-xl bg-slate-50 px-3 py-2">
                              <div className="flex items-center justify-between">
                                <span className={cn('text-[11px] font-black', DIMENSION_COLORS[dimension])}>{DIMENSION_LABELS[dimension]}</span>
                                <span className="text-[11px] font-bold text-slate-500">{student.explanations[dimension].score}</span>
                              </div>
                              <Progress value={student.explanations[dimension].score} className="mt-2 h-2" />
                            </div>
                          ))}
                        </div>
                      </div>

                      <ChevronRight className="mt-5 h-5 w-5 shrink-0 text-slate-300" />
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 md:col-span-4">
        <Card className="rounded-[2rem] border-none shadow-lg ring-1 ring-rose-100">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-black">
              <Siren className="h-4 w-4 text-rose-600" />
              긴급 개입 학생
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {urgent.length === 0 ? (
              <p className="text-sm font-semibold text-slate-500">긴급 단계 학생이 없습니다.</p>
            ) : urgent.map((student) => (
              <button key={student.identity.studentId} type="button" onClick={() => onSelect(student)} className="w-full rounded-xl border border-rose-100 bg-rose-50 px-3 py-3 text-left">
                <p className="text-sm font-black text-slate-900">{student.identity.studentName}</p>
                <p className="mt-1 text-[11px] font-semibold text-rose-700">
                  주요 리스크: {DIMENSION_LABELS[student.dominantDimension]} · {student.dimensions.overall}점
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-lg ring-1 ring-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-black">
              <BrainCircuit className="h-4 w-4 text-amber-500" />
              데이터 신뢰도 낮음
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowConfidence.length === 0 ? (
              <p className="text-sm font-semibold text-slate-500">신뢰도 낮은 학생이 없습니다.</p>
            ) : lowConfidence.map((student) => (
              <button key={student.identity.studentId} type="button" onClick={() => onSelect(student)} className="w-full rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-left">
                <p className="text-sm font-black text-slate-900">{student.identity.studentName}</p>
                <p className="mt-1 text-[11px] font-semibold text-amber-700">신뢰도 {student.confidenceScore} · 데이터 점검 필요</p>
              </button>
            ))}
          </CardContent>
        </Card>

        {showExecutiveData && (
          <Card className="rounded-[2rem] border-none shadow-lg ring-1 ring-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-black">
                <Wallet className="h-4 w-4 text-emerald-600" />
                재무 영향 상위
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {revenueHotspots.map((student) => (
                <button key={student.identity.studentId} type="button" onClick={() => onSelect(student)} className="w-full rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-left">
                  <p className="text-sm font-black text-slate-900">{student.identity.studentName}</p>
                  <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                    이탈 위험 {formatWon(student.revenue.revenueAtRisk)} · 미수 {formatWon(student.revenue.outstandingAmount)}
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ExecutiveTab({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-[2rem] border-none shadow-lg ring-1 ring-border/50">
      <CardHeader>
        <CardTitle className="text-xl font-black">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function RiskIntelligence() {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;
  const role = activeMembership?.role;
  const isExecutiveViewer = role === 'centerAdmin' || role === 'owner';
  const operationalToday = useMemo(() => getStudyDayDate(new Date()), []);
  const todayKey = getStudyDayKey(operationalToday);

  const [selectedStudent, setSelectedStudent] = useState<StudentRiskAnalysis | null>(null);
  const [recentStudyByStudent, setRecentStudyByStudent] = useState<Record<string, Record<string, number>>>({});
  const [studyLogsLoading, setStudyLogsLoading] = useState(false);

  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'),
      where('role', '==', 'student'),
      where('status', '==', 'active'),
    );
  }, [firestore, centerId]);
  const { data: members, isLoading: membersLoading } = useCollection<CenterMembership>(membersQuery);

  const progressQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'growthProgress');
  }, [firestore, centerId]);
  const { data: progressList } = useCollection<GrowthProgress>(progressQuery);

  const statsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'dailyStudentStats', todayKey, 'students');
  }, [firestore, centerId, todayKey]);
  const { data: todayStats } = useCollection<DailyStudentStat>(statsQuery);

  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isExecutiveViewer) return null;
    return query(collection(firestore, 'centers', centerId, 'invoices'), orderBy('cycleEndDate', 'desc'), limit(1000));
  }, [firestore, centerId, isExecutiveViewer]);
  const { data: invoices } = useCollection<Invoice>(invoicesQuery, { enabled: isExecutiveViewer });

  const paymentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isExecutiveViewer) return null;
    return query(collection(firestore, 'centers', centerId, 'payments'), orderBy('processedAt', 'desc'), limit(500));
  }, [firestore, centerId, isExecutiveViewer]);
  const { data: payments } = useCollection<PaymentRecord>(paymentsQuery, { enabled: isExecutiveViewer });

  const billingProfilesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isExecutiveViewer) return null;
    return collection(firestore, 'centers', centerId, 'billingProfiles');
  }, [firestore, centerId, isExecutiveViewer]);
  const { data: billingProfiles } = useCollection<BillingProfile>(billingProfilesQuery, { enabled: isExecutiveViewer });

  useEffect(() => {
    let disposed = false;
    if (!firestore || !centerId || !members || members.length === 0) {
      setRecentStudyByStudent({});
      return;
    }

    const load = async () => {
      setStudyLogsLoading(true);
      try {
        const fromKey = format(subDays(operationalToday, 13), 'yyyy-MM-dd');
        const buckets: Record<string, Record<string, number>> = {};

        await Promise.all(
          members.map(async (member) => {
            const daysRef = collection(firestore, 'centers', centerId, 'studyLogs', member.id, 'days');
            const snapshot = await getDocs(query(daysRef, where('dateKey', '>=', fromKey)));
            const dayMap: Record<string, number> = {};
            snapshot.forEach((docSnap) => {
              const raw = docSnap.data() as Partial<{ dateKey: string; totalMinutes: number }>;
              const dateKey = typeof raw.dateKey === 'string' ? raw.dateKey : docSnap.id;
              const minutes = Number(raw.totalMinutes || 0);
              if (!Number.isFinite(minutes) || minutes < 0) return;
              dayMap[dateKey] = minutes;
            });
            buckets[member.id] = dayMap;
          }),
        );

        if (!disposed) setRecentStudyByStudent(buckets);
      } catch (error) {
        console.error('[risk] failed to load study logs', error);
        if (!disposed) setRecentStudyByStudent({});
      } finally {
        if (!disposed) setStudyLogsLoading(false);
      }
    };

    void load();
    return () => {
      disposed = true;
    };
  }, [firestore, centerId, members]);

  const invoiceSummaryByStudent = useMemo(() => buildInvoiceSummary(invoices ?? undefined), [invoices]);
  const recentCollectedAmount30d = useMemo(() => summarizePayment30d(payments ?? undefined), [payments]);
  const billingProfilesByStudent = useMemo(
    () => new Map((billingProfiles || []).map((profile) => [profile.studentId || profile.id, profile])),
    [billingProfiles]
  );

  const riskAnalyses = useMemo(() => {
    if (!members) return [];
    const keys7 = buildDateKeys(7, operationalToday);
    const keys14 = buildDateKeys(14, operationalToday);

    return members
      .map((member) => {
        const progress = progressList?.find((item) => item.id === member.id);
        const stat = todayStats?.find((item) => item.studentId === member.id);
        const dayMap = recentStudyByStudent[member.id] || {};
        const todayMinutes = Math.max(Number(stat?.totalStudyMinutes || 0), Number(dayMap[todayKey] || 0));
        const observedDays = Math.min(
          14,
          Math.max(1, Math.floor((Date.now() - toMs(member.joinedAt)) / 86400000) + 1),
        );
        const avg7 = average(keys7.map((key) => Number(key === todayKey ? todayMinutes : dayMap[key] || 0)));
        const recent7 = average(keys7.map((key) => Number(key === todayKey ? todayMinutes : dayMap[key] || 0)));
        const older7Keys = keys14.slice(7);
        const older7 = average(older7Keys.map((key) => Number(dayMap[key] || 0)));
        const trend14d = older7 > 0 ? (recent7 - older7) / older7 : recent7 > 0 ? 0.08 : 0;
        const todayVsAverageDeltaRate = avg7 > 0 ? (todayMinutes - avg7) / avg7 : todayMinutes > 0 ? 0 : -1;

        let lowStudyStreak = 0;
        let consecutiveLowPerformanceDays = 0;
        let lastActivityDaysAgo = observedDays;
        const lowPerformanceThreshold = Math.max(150, avg7 * 0.75);

        for (let index = 0; index < observedDays; index += 1) {
          const key = format(subDays(operationalToday, index), 'yyyy-MM-dd');
          const minutes = Number(key === todayKey ? todayMinutes : dayMap[key] || 0);
          if (minutes > 0 && lastActivityDaysAgo === observedDays) lastActivityDaysAgo = index;
          if (minutes < 180) lowStudyStreak += 1;
          else break;
        }

        for (let index = 0; index < observedDays; index += 1) {
          const key = format(subDays(operationalToday, index), 'yyyy-MM-dd');
          const minutes = Number(key === todayKey ? todayMinutes : dayMap[key] || 0);
          if (minutes < lowPerformanceThreshold) consecutiveLowPerformanceDays += 1;
          else break;
        }

        const invoiceSummary = invoiceSummaryByStudent.get(member.id);
        const billingProfile = billingProfilesByStudent.get(member.id);

        return analyzeStudentRisk(
          {
            growthRate: stat?.studyTimeGrowthRate ?? 0,
            completionRate: stat?.todayPlanCompletionRate ?? 0,
            todayMinutes,
            penalty: progress?.penaltyPoints ?? 0,
            focusStat: progress?.stats?.focus ?? 50,
            consistency: progress?.stats?.consistency ?? 50,
            achievement: progress?.stats?.achievement ?? 50,
            resilience: progress?.stats?.resilience ?? 50,
            studyVariance: average(keys7.map((key) => Math.abs((dayMap[key] || 0) - avg7))),
            lowStudyStreak,
            avgStudyMinutes7d: avg7,
            trend14d,
            todayVsAverageDeltaRate,
            consecutiveLowPerformanceDays,
            observedDays,
            lastActivityDaysAgo,
            hasTodayStat: !!stat,
            hasGrowthProgress: !!progress,
            hasRecentStudyLogs: Object.keys(dayMap).length > 0,
          },
          {
            studentId: member.id,
            studentName: member.displayName || '이름 미입력',
            className: member.className,
          },
          {
            latestInvoiceAmount: invoiceSummary?.latestInvoiceAmount,
            monthlyFee: isExecutiveViewer ? (billingProfile?.monthlyFee ?? member.monthlyFee) : undefined,
            outstandingAmount: invoiceSummary?.outstandingAmount,
          },
        );
      })
      .sort((a, b) => b.dimensions.overall - a.dimensions.overall);
  }, [billingProfilesByStudent, invoiceSummaryByStudent, isExecutiveViewer, members, operationalToday, progressList, recentStudyByStudent, todayKey, todayStats]);

  const summary = useMemo(() => buildExecutiveRiskSummary(riskAnalyses), [riskAnalyses]);

  if (membersLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {studyLogsLoading && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
          최근 학습 로그를 보강 분석 중입니다. 현재 점수는 먼저 보여주고 있습니다.
        </div>
      )}

      <section className={cn('grid gap-4', isMobile ? 'grid-cols-2' : 'md:grid-cols-4')}>
        <Card className="rounded-[2rem] border-none shadow-lg ring-1 ring-border/50">
          <CardContent className="p-5">
            <p className="text-[11px] font-black text-slate-500">전체 학생</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{summary.population.total}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[2rem] border-none shadow-lg ring-1 ring-border/50">
          <CardContent className="p-5">
            <p className="text-[11px] font-black text-slate-500">위험 이상</p>
            <p className="mt-2 text-3xl font-black text-orange-600">{summary.ceo.highRiskStudents}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[2rem] border-none shadow-lg ring-1 ring-border/50">
          <CardContent className="p-5">
            <p className="text-[11px] font-black text-slate-500">평균 위험도</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{summary.population.averageScore}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[2rem] border-none shadow-lg ring-1 ring-border/50">
          <CardContent className="p-5">
            <p className="text-[11px] font-black text-slate-500">평균 신뢰도</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{summary.population.averageConfidence}</p>
          </CardContent>
        </Card>
      </section>

      {isExecutiveViewer ? (
        <Tabs defaultValue="students" className="space-y-5">
          <TabsList className="grid h-12 grid-cols-5 rounded-2xl bg-slate-100 p-1">
            <TabsTrigger value="students" className="rounded-xl font-black">학생</TabsTrigger>
            <TabsTrigger value="ceo" className="rounded-xl font-black">CEO</TabsTrigger>
            <TabsTrigger value="cto" className="rounded-xl font-black">CTO</TabsTrigger>
            <TabsTrigger value="cfo" className="rounded-xl font-black">CFO</TabsTrigger>
            <TabsTrigger value="coo" className="rounded-xl font-black">COO</TabsTrigger>
          </TabsList>

          <TabsContent value="students">
            <StudentListTab students={riskAnalyses} onSelect={setSelectedStudent} isMobile={isMobile} showExecutiveData />
          </TabsContent>

          <TabsContent value="ceo">
            <ExecutiveTab title="CEO 리스크 보드" description="센터 전체 위험 분포와 매출 영향, 우선 관리 학생을 확인합니다.">
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="rounded-2xl border-none bg-rose-50 shadow-none"><CardContent className="p-4"><p className="text-xs font-black text-rose-700">긴급 학생</p><p className="mt-2 text-2xl font-black text-rose-700">{summary.ceo.criticalStudents}</p></CardContent></Card>
                <Card className="rounded-2xl border-none bg-orange-50 shadow-none"><CardContent className="p-4"><p className="text-xs font-black text-orange-700">위험 이상</p><p className="mt-2 text-2xl font-black text-orange-700">{summary.ceo.highRiskStudents}</p></CardContent></Card>
                <Card className="rounded-2xl border-none bg-emerald-50 shadow-none"><CardContent className="p-4"><p className="text-xs font-black text-emerald-700">이탈 위험 매출</p><p className="mt-2 text-2xl font-black text-emerald-700">{formatWon(summary.ceo.revenueAtRisk)}</p></CardContent></Card>
                <Card className="rounded-2xl border-none bg-slate-50 shadow-none"><CardContent className="p-4"><p className="text-xs font-black text-slate-700">평균 위험도</p><p className="mt-2 text-2xl font-black text-slate-900">{summary.population.averageScore}</p></CardContent></Card>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Card className="rounded-2xl border-none shadow-none ring-1 ring-border/50"><CardHeader><CardTitle className="text-base font-black">상위 위험 세그먼트</CardTitle></CardHeader><CardContent className="space-y-2">{summary.ceo.topSegments.map((segment) => <div key={segment.dimension} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span className="font-semibold text-slate-700">{segment.label}</span><span className="font-black text-slate-900">{segment.count}명</span></div>)}</CardContent></Card>
                <Card className="rounded-2xl border-none shadow-none ring-1 ring-border/50"><CardHeader><CardTitle className="text-base font-black">우선 관리 학생</CardTitle></CardHeader><CardContent className="space-y-2">{summary.ceo.topStudents.map((student) => <button type="button" key={student.identity.studentId} onClick={() => setSelectedStudent(student)} className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-left"><div><p className="font-black text-slate-900">{student.identity.studentName}</p><p className="text-xs font-semibold text-slate-500">{DIMENSION_LABELS[student.dominantDimension]} · {student.dimensions.overall}점</p></div><ChevronRight className="h-4 w-4 text-slate-300" /></button>)}</CardContent></Card>
              </div>
            </ExecutiveTab>
          </TabsContent>

          <TabsContent value="cto">
            <ExecutiveTab title="CTO 데이터 신뢰도" description="리스크 설명 품질과 데이터 커버리지 상태를 확인합니다.">
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="rounded-2xl border-none bg-slate-50 shadow-none"><CardContent className="p-4"><p className="text-xs font-black text-slate-600">데이터 커버리지</p><p className="mt-2 text-2xl font-black text-slate-900">{summary.cto.dataCoverageRate}%</p></CardContent></Card>
                <Card className="rounded-2xl border-none bg-amber-50 shadow-none"><CardContent className="p-4"><p className="text-xs font-black text-amber-700">신뢰도 낮음</p><p className="mt-2 text-2xl font-black text-amber-700">{summary.cto.lowConfidenceStudents}</p></CardContent></Card>
                <Card className="rounded-2xl border-none bg-rose-50 shadow-none"><CardContent className="p-4"><p className="text-xs font-black text-rose-700">오늘 통계 누락</p><p className="mt-2 text-2xl font-black text-rose-700">{summary.cto.missingTodayStatStudents}</p></CardContent></Card>
                <Card className="rounded-2xl border-none bg-blue-50 shadow-none"><CardContent className="p-4"><p className="text-xs font-black text-blue-700">설명 가능성 정상</p><p className="mt-2 text-2xl font-black text-blue-700">{summary.cto.explainabilityHealthyRate}%</p></CardContent></Card>
              </div>
              <div className="mt-4 space-y-2">
                {summary.cto.lowConfidenceList.map((student) => (
                  <button type="button" key={student.identity.studentId} onClick={() => setSelectedStudent(student)} className="flex w-full items-start justify-between rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-left">
                    <div>
                      <p className="font-black text-slate-900">{student.identity.studentName}</p>
                      <p className="mt-1 text-xs font-semibold text-amber-700">{student.confidenceReasons[0] || '데이터 점검 필요'}</p>
                    </div>
                    <Badge className="border-none bg-white text-amber-700">신뢰도 {student.confidenceScore}</Badge>
                  </button>
                ))}
              </div>
            </ExecutiveTab>
          </TabsContent>

          <TabsContent value="cfo">
            <ExecutiveTab title="CFO 재무 영향" description="실제 청구/수납 기반으로 이탈 위험 매출과 미수 위험을 봅니다.">
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="rounded-2xl border-none bg-emerald-50 shadow-none"><CardContent className="p-4"><p className="text-xs font-black text-emerald-700">최근 30일 수납</p><p className="mt-2 text-2xl font-black text-emerald-700">{formatWon(recentCollectedAmount30d)}</p></CardContent></Card>
                <Card className="rounded-2xl border-none bg-rose-50 shadow-none"><CardContent className="p-4"><p className="text-xs font-black text-rose-700">이탈 위험 매출</p><p className="mt-2 text-2xl font-black text-rose-700">{formatWon(summary.cfo.revenueAtRisk)}</p></CardContent></Card>
                <Card className="rounded-2xl border-none bg-orange-50 shadow-none"><CardContent className="p-4"><p className="text-xs font-black text-orange-700">미수 위험</p><p className="mt-2 text-2xl font-black text-orange-700">{formatWon(summary.cfo.outstandingAtRisk)}</p></CardContent></Card>
                <Card className="rounded-2xl border-none bg-slate-50 shadow-none"><CardContent className="p-4"><p className="text-xs font-black text-slate-700">고위험 노출 학생</p><p className="mt-2 text-2xl font-black text-slate-900">{summary.cfo.criticalExposureStudents}</p></CardContent></Card>
              </div>
              <div className="mt-4 space-y-2">
                {summary.cfo.highExposureList.map((student) => (
                  <button type="button" key={student.identity.studentId} onClick={() => setSelectedStudent(student)} className="flex w-full items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-left">
                    <div>
                      <p className="font-black text-slate-900">{student.identity.studentName}</p>
                      <p className="mt-1 text-xs font-semibold text-emerald-700">기준 {formatWon(student.revenue.monthlyRevenueBasis)} · {student.revenue.basisSource === 'invoice' ? '인보이스 기준' : student.revenue.basisSource === 'membership' ? '월회비 기준' : '기준 없음'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-rose-600">{formatWon(student.revenue.revenueAtRisk)}</p>
                      <p className="text-xs font-semibold text-orange-600">미수 {formatWon(student.revenue.outstandingAmount)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </ExecutiveTab>
          </TabsContent>

          <TabsContent value="coo">
            <ExecutiveTab title="COO 운영 액션 큐" description="지금 바로 움직여야 할 학생과 운영 병목을 우선순위로 봅니다.">
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="rounded-2xl border-none bg-rose-50 shadow-none"><CardContent className="p-4"><p className="text-xs font-black text-rose-700">오늘 조치</p><p className="mt-2 text-2xl font-black text-rose-700">{summary.coo.todayActionCount}</p></CardContent></Card>
                <Card className="rounded-2xl border-none bg-orange-50 shadow-none"><CardContent className="p-4"><p className="text-xs font-black text-orange-700">이번 주 액션</p><p className="mt-2 text-2xl font-black text-orange-700">{summary.coo.weekActionCount}</p></CardContent></Card>
                <Card className="rounded-2xl border-none bg-slate-50 shadow-none"><CardContent className="p-4"><p className="text-xs font-black text-slate-700">최다 병목 차원</p><p className="mt-2 text-2xl font-black text-slate-900">{summary.coo.dominantDimensions[0]?.label || '-'}</p></CardContent></Card>
                <Card className="rounded-2xl border-none bg-blue-50 shadow-none"><CardContent className="p-4"><p className="text-xs font-black text-blue-700">운영 우선 학생</p><p className="mt-2 text-2xl font-black text-blue-700">{summary.coo.topOperationsList.length}</p></CardContent></Card>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Card className="rounded-2xl border-none shadow-none ring-1 ring-border/50"><CardHeader><CardTitle className="text-base font-black">액션 큐</CardTitle></CardHeader><CardContent className="space-y-2">{summary.coo.actionQueue.map((action, index) => <div key={`${action.title}-${index}`} className="rounded-xl bg-slate-50 px-3 py-3"><div className="flex items-center gap-2"><Badge className={cn('border-none', PRIORITY_META[action.priority].className)}>{PRIORITY_META[action.priority].label}</Badge><span className="text-sm font-black text-slate-900">{action.title}</span></div><p className="mt-1 text-xs font-semibold text-slate-600">{action.description}</p></div>)}</CardContent></Card>
                <Card className="rounded-2xl border-none shadow-none ring-1 ring-border/50"><CardHeader><CardTitle className="text-base font-black">운영 우선 학생</CardTitle></CardHeader><CardContent className="space-y-2">{summary.coo.topOperationsList.map((student) => <button type="button" key={student.identity.studentId} onClick={() => setSelectedStudent(student)} className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-left"><div><p className="font-black text-slate-900">{student.identity.studentName}</p><p className="text-xs font-semibold text-slate-500">{student.immediateActions[0]?.title || '이번 주 조치 필요'}</p></div><ChevronRight className="h-4 w-4 text-slate-300" /></button>)}</CardContent></Card>
              </div>
            </ExecutiveTab>
          </TabsContent>
        </Tabs>
      ) : (
        <StudentListTab students={riskAnalyses} onSelect={setSelectedStudent} isMobile={isMobile} showExecutiveData={false} />
      )}

      <StudentDetailDialog
        student={selectedStudent}
        open={!!selectedStudent}
        onOpenChange={(open) => !open && setSelectedStudent(null)}
        showExecutiveData={isExecutiveViewer}
      />
    </div>
  );
}
