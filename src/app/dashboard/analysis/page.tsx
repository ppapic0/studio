'use client';

import { useEffect, useMemo, useState } from 'react';
import { subDays, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { BarChart3, Loader2, ShieldCheck, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { useAppContext } from '@/contexts/app-context';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { cn } from '@/lib/utils';
import { buildWeeklyStudyInsight } from '@/lib/learning-insights';
import { StudyLogDay } from '@/lib/types';
import { StudentTrackSubnav } from '@/components/dashboard/student-track-subnav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StudentDetailPage from '../teacher/students/[id]/page';

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function minutesToLabel(min: number) {
  const safe = Math.max(0, Math.round(min));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

function signedPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value}%`;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function AnalysisTrackPage() {
  const { viewMode, activeMembership } = useAppContext();
  const { user } = useUser();
  const firestore = useFirestore();
  const selfParams = useMemo(() => Promise.resolve({ id: user?.uid ?? '' }), [user?.uid]);
  const isMobile = viewMode === 'mobile';

  // ── 14일 studyLogs ──────────────────────────────────────────────────────────
  const studyLogsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days'),
      orderBy('dateKey', 'desc'),
      limit(14)
    );
  }, [firestore, user?.uid, activeMembership?.id]);

  const { data: logs } = useCollection<StudyLogDay>(studyLogsQuery);

  // ── 14일 차트 데이터 ──────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const today = new Date();
    const logMap: Record<string, number> = {};
    (logs || []).forEach((log) => {
      logMap[log.dateKey] = Math.max(0, Math.round(Number(log.totalMinutes || 0)));
    });
    return Array.from({ length: 14 }, (_, idx) => {
      const day = subDays(today, 13 - idx);
      const dateKey = format(day, 'yyyy-MM-dd');
      return {
        dateKey,
        label: format(day, 'M/d', { locale: ko }),
        totalMinutes: logMap[dateKey] || 0,
      };
    });
  }, [logs]);

  // ── KPI 요약 ─────────────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const thisWeek = chartData.slice(7);
    const lastWeek = chartData.slice(0, 7);
    const thisWeekMin = thisWeek.reduce((s, d) => s + d.totalMinutes, 0);
    const lastWeekMin = lastWeek.reduce((s, d) => s + d.totalMinutes, 0);
    const weekDiffPct = lastWeekMin > 0 ? Math.round(((thisWeekMin - lastWeekMin) / lastWeekMin) * 100) : 0;

    const studyDays = chartData.filter((d) => d.totalMinutes > 0).length;
    const consistencyScore = Math.round((studyDays / 14) * 100);

    let maxStreak = 0;
    let streak = 0;
    for (const d of chartData) {
      if (d.totalMinutes > 0) { streak++; maxStreak = Math.max(maxStreak, streak); }
      else { streak = 0; }
    }

    return {
      thisWeekMin,
      lastWeekMin,
      weekDiffPct,
      studyDays,
      consistencyScore,
      maxStreak,
      avgMin14: Math.round(chartData.reduce((s, d) => s + d.totalMinutes, 0) / 14),
    };
  }, [chartData]);

  const insight = useMemo(() => buildWeeklyStudyInsight(chartData), [chartData]);

  // ── 세션 완료율 (Day 5 모니터링) ───────────────────────────────────────────────
  const [sessionMetrics, setSessionMetrics] = useState<{
    total: number;
    autoClosedCount: number;
    completionRate: number;
    avgDurationMinutes: number;
    loading: boolean;
  }>({ total: 0, autoClosedCount: 0, completionRate: 0, avgDurationMinutes: 0, loading: true });

  useEffect(() => {
    if (!firestore || !user?.uid || !activeMembership) return;
    let cancelled = false;

    async function loadSessions() {
      const today = new Date();
      const days = Array.from({ length: 7 }, (_, i) =>
        format(subDays(today, i), 'yyyy-MM-dd')
      );

      const snaps = await Promise.all(
        days.map((dateKey) =>
          getDocs(
            collection(
              firestore!,
              'centers', activeMembership!.id,
              'studyLogs', user!.uid,
              'days', dateKey,
              'sessions'
            )
          )
        )
      );

      let total = 0;
      let autoClosed = 0;
      let durationSum = 0;

      snaps.forEach((snap) => {
        snap.docs.forEach((d) => {
          const data = d.data();
          total++;
          if (data.closedReason) autoClosed++;
          durationSum += Number(data.durationMinutes || 0);
        });
      });

      if (!cancelled) {
        setSessionMetrics({
          total,
          autoClosedCount: autoClosed,
          completionRate: total > 0 ? Math.round(((total - autoClosed) / total) * 100) : 0,
          avgDurationMinutes: total > 0 ? Math.round(durationSum / total) : 0,
          loading: false,
        });
      }
    }

    loadSessions().catch(() => {
      if (!cancelled) setSessionMetrics((prev) => ({ ...prev, loading: false }));
    });

    return () => { cancelled = true; };
  }, [firestore, user?.uid, activeMembership?.id]);

  // ── 렌더 ──────────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn(isMobile && 'flex flex-col gap-3')}>
      {isMobile && <StudentTrackSubnav />}

      <Tabs defaultValue="focus" className="space-y-4">
        <TabsList className="bg-slate-100 rounded-2xl p-1 w-full grid grid-cols-2">
          <TabsTrigger
            value="focus"
            className="rounded-xl font-black text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5"
          >
            <TrendingUp className="h-3.5 w-3.5 shrink-0" /> 집중 시간
          </TabsTrigger>
          <TabsTrigger
            value="full"
            className="rounded-xl font-black text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5"
          >
            <BarChart3 className="h-3.5 w-3.5 shrink-0" /> 전체 분석
          </TabsTrigger>
        </TabsList>

        {/* ── 집중 시간 탭 ─────────────────────────────────────────────────────── */}
        <TabsContent value="focus" className="space-y-4 mt-0">

          {/* KPI 요약 row */}
          <div className={cn('grid gap-2', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 px-3 py-2.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">이번 주</p>
              <p className="mt-1 text-lg font-black text-blue-700">{minutesToLabel(kpi.thisWeekMin)}</p>
              <p className={cn('text-[10px] font-bold', kpi.weekDiffPct >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
                {signedPercent(kpi.weekDiffPct)} 지난 주 대비
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">일관성</p>
              <p className="mt-1 text-lg font-black text-emerald-700">{kpi.consistencyScore}점</p>
              <p className="text-[10px] font-bold text-emerald-700/70">14일 중 {kpi.studyDays}일</p>
            </div>
            <div className="rounded-2xl border border-violet-100 bg-violet-50/50 px-3 py-2.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">최장 연속</p>
              <p className="mt-1 text-lg font-black text-violet-700">{kpi.maxStreak}일</p>
              <p className="text-[10px] font-bold text-violet-700/70">연속 기록</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/50 px-3 py-2.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">일 평균</p>
              <p className="mt-1 text-lg font-black text-amber-700">{minutesToLabel(kpi.avgMin14)}</p>
              <p className="text-[10px] font-bold text-amber-700/70">최근 14일</p>
            </div>
          </div>

          {/* 14일 바 차트 */}
          <Card className="rounded-[1.5rem] border-none shadow-lg bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-black tracking-tight">최근 14일 집중 시간 추이</CardTitle>
              <CardDescription className="font-bold text-[11px]">
                이번 주 {minutesToLabel(kpi.thisWeekMin)} · 지난 주 {minutesToLabel(kpi.lastWeekMin)}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fontWeight: 700 }}
                    tickLine={false}
                    axisLine={false}
                    interval={isMobile ? 1 : 0}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fontWeight: 700 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${Math.round(v / 60)}h`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-white border border-primary/10 rounded-xl px-3 py-2 shadow-lg">
                          <p className="text-[10px] font-black text-muted-foreground">{label}</p>
                          <p className="text-base font-black text-primary">
                            {minutesToLabel(payload[0].value as number)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="totalMinutes"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={32}
                    fill="#3b6ef6"
                  />
                </BarChart>
              </ResponsiveContainer>

              {/* AI 인사이트 */}
              <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2.5 space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">AI 인사이트</p>
                <p className="text-xs font-bold text-slate-700">{insight.trend}</p>
                <p className="text-xs font-semibold text-slate-600">{insight.improve}</p>
              </div>
            </CardContent>
          </Card>

          {/* 세션 완료율 모니터링 (Day 5) */}
          <Card className="rounded-[1.5rem] border-none shadow-md bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black tracking-tight flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-500" />
                세션 건강도 <span className="text-[10px] font-bold text-muted-foreground">(최근 7일)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {sessionMetrics.loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> 불러오는 중...
                </div>
              ) : sessionMetrics.total === 0 ? (
                <p className="text-xs text-muted-foreground font-semibold">아직 세션 데이터가 없습니다. 집중 시작 버튼을 눌러 기록을 시작하세요.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">완료율</p>
                    <p className={cn(
                      'mt-1 text-xl font-black tabular-nums',
                      sessionMetrics.completionRate >= 90 ? 'text-emerald-600'
                        : sessionMetrics.completionRate >= 70 ? 'text-amber-600'
                        : 'text-rose-600'
                    )}>
                      {sessionMetrics.completionRate}%
                    </p>
                    <p className="text-[10px] font-semibold text-slate-400">
                      {sessionMetrics.total - sessionMetrics.autoClosedCount}/{sessionMetrics.total}건
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">총 세션</p>
                    <p className="mt-1 text-xl font-black text-slate-700 tabular-nums">{sessionMetrics.total}</p>
                    <p className="text-[10px] font-semibold text-slate-400">7일 합계</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">평균 길이</p>
                    <p className="mt-1 text-xl font-black text-slate-700">{minutesToLabel(sessionMetrics.avgDurationMinutes)}</p>
                    <p className="text-[10px] font-semibold text-slate-400">세션당</p>
                  </div>
                </div>
              )}
              {!sessionMetrics.loading && sessionMetrics.autoClosedCount > 0 && (
                <p className="mt-2 text-[11px] font-semibold text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5">
                  ⚠ 자동 종료 세션 {sessionMetrics.autoClosedCount}건 — 집중 종료 버튼을 눌러 세션을 직접 마무리하세요.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 전체 분석 탭 ─────────────────────────────────────────────────────── */}
        <TabsContent value="full" className="mt-0">
          <StudentDetailPage params={selfParams} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
