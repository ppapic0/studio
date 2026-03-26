'use client';

import { useEffect, useMemo, useState } from 'react';
import { subDays, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  Clock3,
  Flame,
  Loader2,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useAppContext } from '@/contexts/app-context';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { cn } from '@/lib/utils';
import { buildWeeklyStudyInsight } from '@/lib/learning-insights';
import { StudyLogDay } from '@/lib/types';
import { StudentTrackSubnav } from '@/components/dashboard/student-track-subnav';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StudentDetailPage from '../teacher/students/[id]/page';
import { StudentDetailPresentationProvider } from '@/components/dashboard/student-detail-presentation-mode';

type ToneKey = 'blue' | 'emerald' | 'violet' | 'amber' | 'rose';

const TONE_STYLES: Record<ToneKey, { chip: string; text: string; bar: string; ring: string; soft: string }> = {
  blue: {
    chip: 'border-[#d9e6ff] bg-[#eef4ff] text-[#2554d4]',
    text: 'text-[#2554d4]',
    bar: 'from-[#2554d4] via-[#4f7cff] to-[#87aaff]',
    ring: '#3564f0',
    soft: 'from-[#edf3ff] to-white',
  },
  emerald: {
    chip: 'border-[#d5f2e7] bg-[#effcf6] text-[#0f8f65]',
    text: 'text-[#0f8f65]',
    bar: 'from-[#0f8f65] via-[#1cb980] to-[#6ce0b0]',
    ring: '#16a36f',
    soft: 'from-[#effcf6] to-white',
  },
  violet: {
    chip: 'border-[#eadfff] bg-[#f6f0ff] text-[#7d4ed8]',
    text: 'text-[#7d4ed8]',
    bar: 'from-[#7d4ed8] via-[#9d6bff] to-[#c6abff]',
    ring: '#8b5cf6',
    soft: 'from-[#f6f0ff] to-white',
  },
  amber: {
    chip: 'border-[#ffe1c5] bg-[#fff3e8] text-[#d86a11]',
    text: 'text-[#d86a11]',
    bar: 'from-[#ff7a16] via-[#ff9438] to-[#ffc58b]',
    ring: '#ff7a16',
    soft: 'from-[#fff3e8] to-white',
  },
  rose: {
    chip: 'border-[#ffdbe2] bg-[#fff2f5] text-[#dc4b74]',
    text: 'text-[#dc4b74]',
    bar: 'from-[#dc4b74] via-[#f1668f] to-[#f8a3b8]',
    ring: '#dc4b74',
    soft: 'from-[#fff2f5] to-white',
  },
};

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

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function compactSessionLabel(minutes: number) {
  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}h`;
  }
  return `${Math.max(0, Math.round(minutes))}m`;
}

function AnalysisTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const focusMinutes = Number(payload.find((item) => item.name === '집중 시간')?.value || 0);
  const rhythmMinutes = Number(payload.find((item) => item.name === '리듬선')?.value || 0);

  return (
    <div className="analysis-card rounded-[1.15rem] px-3 py-2.5 shadow-[0_22px_36px_-28px_rgba(20,41,95,0.46)]">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5c6e97]">{label}</p>
      <div className="mt-2 flex items-end gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2554d4]">집중 시간</p>
          <p className="text-lg font-black text-[#14295F]">{minutesToLabel(focusMinutes)}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff7a16]">리듬선</p>
          <p className="text-sm font-black text-[#14295F]">{minutesToLabel(rhythmMinutes)}</p>
        </div>
      </div>
    </div>
  );
}

function AnalysisKpiCard({
  title,
  value,
  meta,
  progress,
  icon: Icon,
  tone,
  delta,
}: {
  title: string;
  value: string;
  meta: string;
  progress: number;
  icon: LucideIcon;
  tone: ToneKey;
  delta?: string;
}) {
  const toneStyles = TONE_STYLES[tone];

  return (
    <div className={cn('analysis-kpi-card rounded-[1.5rem] p-4 md:p-5 bg-gradient-to-br', toneStyles.soft)}>
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#6478a5]">{title}</p>
          <p className="mt-3 break-keep text-[clamp(1.15rem,1.7vw,1.85rem)] font-black tracking-tight text-[#14295F]">
            {value}
          </p>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-[#55698f]">{meta}</p>
        </div>
        <div className={cn('rounded-[1rem] border px-3 py-2 shadow-[0_16px_26px_-22px_rgba(20,41,95,0.32)]', toneStyles.chip)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="relative z-10 mt-4 space-y-2">
        <div className="analysis-kpi-track">
          <span className={cn('bg-gradient-to-r', toneStyles.bar)} style={{ width: `${clampPercent(progress)}%` }} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8090b4]">Track Pulse</span>
          {delta ? (
            <span className={cn('text-[10px] font-black', delta.startsWith('-') ? 'text-rose-500' : toneStyles.text)}>
              {delta}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SessionMetricCard({
  label,
  value,
  meta,
  progress,
  tone,
  icon: Icon,
  variant = 'track',
  ringDisplay,
}: {
  label: string;
  value: string;
  meta: string;
  progress: number;
  tone: ToneKey;
  icon: LucideIcon;
  variant?: 'track' | 'ring';
  ringDisplay?: string;
}) {
  const toneStyles = TONE_STYLES[tone];
  const ringValue = clampPercent(progress);

  return (
    <div className={cn('analysis-health-card rounded-[1.35rem] p-4 bg-gradient-to-br', toneStyles.soft)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#6a7ea8]">{label}</p>
          <p className="mt-2 break-keep text-[clamp(1rem,1.5vw,1.7rem)] font-black tracking-tight text-[#14295F]">
            {value}
          </p>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-[#55698f]">{meta}</p>
        </div>

        {variant === 'ring' ? (
          <div
            className="analysis-ring-shell h-[4.8rem] w-[4.8rem] shrink-0 p-[0.36rem]"
            style={{ background: `conic-gradient(${toneStyles.ring} ${ringValue}%, rgba(20,41,95,0.09) 0)` }}
          >
            <div className="analysis-ring-core h-full w-full">
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8190b0]">Live</p>
                <p className={cn('text-sm font-black', toneStyles.text)}>
                  {ringDisplay || (value.includes('%') ? value.replace('%', '') : compactSessionLabel(progress))}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className={cn('rounded-[1rem] border px-3 py-2 shadow-[0_16px_26px_-22px_rgba(20,41,95,0.3)]', toneStyles.chip)}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      {variant === 'track' ? (
        <div className="mt-4 space-y-2">
          <div className="analysis-kpi-track">
            <span className={cn('bg-gradient-to-r', toneStyles.bar)} style={{ width: `${ringValue}%` }} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8090b4]">Health Rail</span>
            <span className={cn('text-[10px] font-black', toneStyles.text)}>{ringValue}%</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AnalysisTrackPage() {
  const { viewMode, activeMembership } = useAppContext();
  const { user } = useUser();
  const firestore = useFirestore();
  const selfParams = useMemo(() => Promise.resolve({ id: user?.uid ?? '' }), [user?.uid]);
  const isMobile = viewMode === 'mobile';

  const studyLogsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days'),
      orderBy('dateKey', 'desc'),
      limit(14)
    );
  }, [firestore, user?.uid, activeMembership?.id]);

  const { data: logs } = useCollection<StudyLogDay>(studyLogsQuery);

  const chartData = useMemo(() => {
    const today = new Date();
    const logMap: Record<string, number> = {};
    (logs || []).forEach((log) => {
      logMap[log.dateKey] = Math.max(0, Math.round(Number(log.totalMinutes || 0)));
    });

    const base = Array.from({ length: 14 }, (_, idx) => {
      const day = subDays(today, 13 - idx);
      const dateKey = format(day, 'yyyy-MM-dd');
      return {
        dateKey,
        label: format(day, 'M/d', { locale: ko }),
        totalMinutes: logMap[dateKey] || 0,
      };
    });

    return base.map((item, idx) => {
      const window = base.slice(Math.max(0, idx - 2), idx + 1);
      const avgMinutes = Math.round(window.reduce((sum, current) => sum + current.totalMinutes, 0) / window.length);
      return {
        ...item,
        avgMinutes,
      };
    });
  }, [logs]);

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
      if (d.totalMinutes > 0) {
        streak += 1;
        maxStreak = Math.max(maxStreak, streak);
      } else {
        streak = 0;
      }
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
    const centerId = activeMembership.id;
    const userId = user.uid;

    async function loadSessions() {
      const today = new Date();
      const days = Array.from({ length: 7 }, (_, i) => format(subDays(today, i), 'yyyy-MM-dd'));

      const snaps = await Promise.all(
        days.map((dateKey) =>
          getDocs(
            collection(
              firestore,
              'centers', centerId,
              'studyLogs', userId,
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
        snap.docs.forEach((sessionDoc) => {
          const data = sessionDoc.data();
          total += 1;
          if (data.closedReason) autoClosed += 1;
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
      if (!cancelled) {
        setSessionMetrics((prev) => ({ ...prev, loading: false }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [firestore, user?.uid, activeMembership?.id]);

  const kpiCards = useMemo(
    () => [
      {
        title: '이번 주',
        value: minutesToLabel(kpi.thisWeekMin),
        meta: '주간 누적 집중 시간',
        progress: kpi.thisWeekMin > 0 ? (kpi.thisWeekMin / (14 * 60)) * 100 : 0,
        icon: TrendingUp,
        tone: 'blue' as const,
        delta: `${signedPercent(kpi.weekDiffPct)} 지난 주 대비`,
      },
      {
        title: '일관성',
        value: `${kpi.consistencyScore}점`,
        meta: `14일 중 ${kpi.studyDays}일 기록`,
        progress: kpi.consistencyScore,
        icon: Activity,
        tone: 'emerald' as const,
      },
      {
        title: '최장 연속',
        value: `${kpi.maxStreak}일`,
        meta: '루틴 유지 최고 기록',
        progress: (kpi.maxStreak / 7) * 100,
        icon: Flame,
        tone: 'violet' as const,
      },
      {
        title: '일 평균',
        value: minutesToLabel(kpi.avgMin14),
        meta: '최근 14일 평균 몰입',
        progress: (kpi.avgMin14 / 180) * 100,
        icon: Clock3,
        tone: 'amber' as const,
      },
    ],
    [kpi]
  );

  const sessionCards = useMemo(
    () => [
      {
        label: '완료율',
        value: `${sessionMetrics.completionRate}%`,
        meta: `${Math.max(0, sessionMetrics.total - sessionMetrics.autoClosedCount)}/${sessionMetrics.total || 0} 세션`,
        progress: sessionMetrics.completionRate,
        tone: sessionMetrics.completionRate >= 90 ? 'emerald' as const : sessionMetrics.completionRate >= 70 ? 'amber' as const : 'rose' as const,
        icon: ShieldCheck,
        variant: 'ring' as const,
        ringDisplay: `${sessionMetrics.completionRate}`,
      },
      {
        label: '총 세션',
        value: `${sessionMetrics.total}`,
        meta: '최근 7일 누적 세션',
        progress: (sessionMetrics.total / 14) * 100,
        tone: 'blue' as const,
        icon: Activity,
        variant: 'track' as const,
      },
      {
        label: '평균 길이',
        value: minutesToLabel(sessionMetrics.avgDurationMinutes),
        meta: '한 세션당 평균 몰입',
        progress: (sessionMetrics.avgDurationMinutes / 120) * 100,
        tone: 'amber' as const,
        icon: Clock3,
        variant: 'ring' as const,
        ringDisplay: compactSessionLabel(sessionMetrics.avgDurationMinutes),
      },
    ],
    [sessionMetrics]
  );

  if (!user) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn('analysis-shell', isMobile ? 'flex flex-col gap-3' : 'space-y-5')}>
      {isMobile && <StudentTrackSubnav />}

      <Tabs defaultValue="focus" className="space-y-4">
        <TabsList className={cn('analysis-tab-rail grid w-full grid-cols-2 rounded-[1.5rem] p-1.5', isMobile ? 'gap-1' : 'gap-2')}>
          <TabsTrigger
            value="focus"
            className="analysis-tab-trigger rounded-[1.1rem] font-black text-xs gap-1.5 px-3 py-2.5"
          >
            <TrendingUp className="h-3.5 w-3.5 shrink-0" /> 집중 시간
          </TabsTrigger>
          <TabsTrigger
            value="full"
            className="analysis-tab-trigger rounded-[1.1rem] font-black text-xs gap-1.5 px-3 py-2.5"
          >
            <BarChart3 className="h-3.5 w-3.5 shrink-0" /> 전체 분석
          </TabsTrigger>
        </TabsList>

        <TabsContent value="focus" className="mt-0 space-y-4">
          <section className={cn('grid gap-3', isMobile ? 'grid-cols-1 min-[360px]:grid-cols-2' : 'grid-cols-4')}>
            {kpiCards.map((item) => (
              <AnalysisKpiCard key={item.title} {...item} />
            ))}
          </section>

          <Card className="analysis-chart-stage rounded-[1.75rem] border-none">
            <CardHeader className={cn('relative z-10', isMobile ? 'pb-3 px-4 pt-4' : 'pb-4 px-6 pt-6')}>
              <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-start justify-between')}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-none bg-[#14295F]/8 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#14295F]">
                      집중 시간 보드
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-white/80 text-[10px] font-black text-[#2554d4]">
                      최근 14일
                    </Badge>
                  </div>
                  <CardTitle className="mt-3 break-keep text-[clamp(1.05rem,1.6vw,1.45rem)] font-black tracking-tight text-[#14295F]">
                    최근 14일 집중 시간 추이
                  </CardTitle>
                  <p className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">
                    막대는 일별 집중 시간, 얇은 리듬선은 3일 평균 흐름이에요.
                  </p>
                </div>

                <div className={cn('grid gap-2', isMobile ? 'grid-cols-2' : 'grid-cols-1 min-w-[12rem]')}>
                  <div className="rounded-[1rem] border border-[#dbe7ff] bg-white/80 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7a8dae]">이번 주</p>
                    <p className="mt-1 font-black text-[#14295F]">{minutesToLabel(kpi.thisWeekMin)}</p>
                  </div>
                  <div className="rounded-[1rem] border border-[#ffe1c5] bg-white/80 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#c46a24]">지난 주</p>
                    <p className="mt-1 font-black text-[#14295F]">{minutesToLabel(kpi.lastWeekMin)}</p>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className={cn('relative z-10 pt-0', isMobile ? 'px-4 pb-4' : 'px-6 pb-6')}>
              <div className={cn('rounded-[1.35rem] border border-[#e4ebff]/80 bg-white/70 p-3 md:p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]')}>
                <ResponsiveContainer width="100%" height={isMobile ? 220 : 268}>
                  <ComposedChart data={chartData} margin={{ top: 8, right: isMobile ? 4 : 8, left: isMobile ? -24 : -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="analysisBarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2f65ff" />
                        <stop offset="70%" stopColor="#5b84ff" />
                        <stop offset="100%" stopColor="#a9beff" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }}
                      tickLine={false}
                      axisLine={false}
                      interval={isMobile ? 1 : 0}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${Math.round(Number(value) / 60)}h`}
                    />
                    <Tooltip content={<AnalysisTooltip />} />
                    <Bar
                      dataKey="totalMinutes"
                      name="집중 시간"
                      radius={[10, 10, 4, 4]}
                      maxBarSize={isMobile ? 18 : 28}
                      fill="url(#analysisBarGradient)"
                    />
                    <Line
                      type="monotone"
                      dataKey="avgMinutes"
                      name="리듬선"
                      stroke="#ff7a16"
                      strokeWidth={2.4}
                      dot={false}
                      activeDot={{ r: 4, fill: '#ff7a16', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="analysis-signal-band mt-4 rounded-[1.35rem] px-4 py-3.5">
                <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-start justify-between')}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="analysis-pulse-dot h-2.5 w-2.5 rounded-full bg-[#ff7a16]" />
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#2554d4]">AI 코치 시그널</p>
                    </div>
                    <p className="mt-2 break-keep text-sm font-black leading-6 text-[#14295F]">
                      {insight.trend}
                    </p>
                  </div>
                  <div className="rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#ff7a16] shadow-[0_14px_26px_-24px_rgba(20,41,95,0.36)]">
                    Track Dynamic
                  </div>
                </div>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#5c6e97]">{insight.improve}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="analysis-card rounded-[1.75rem] border-none">
            <CardHeader className={cn('relative z-10', isMobile ? 'pb-3 px-4 pt-4' : 'pb-4 px-6 pt-6')}>
              <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-start justify-between')}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#14295F]" />
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5e739d]">Session Monitor</p>
                  </div>
                  <CardTitle className="mt-3 text-[clamp(1rem,1.5vw,1.3rem)] font-black tracking-tight text-[#14295F]">
                    세션 건강도
                  </CardTitle>
                  <p className="mt-1 text-sm font-semibold text-[#5c6e97]">최근 7일 세션 흐름을 자동 종료까지 포함해 정리했어요.</p>
                </div>
                <Badge variant="outline" className="w-fit rounded-full border-[#dbe7ff] bg-white/75 text-[10px] font-black text-[#2554d4]">
                  최근 7일
                </Badge>
              </div>
            </CardHeader>

            <CardContent className={cn('relative z-10 pt-0', isMobile ? 'px-4 pb-4' : 'px-6 pb-6')}>
              {sessionMetrics.loading ? (
                <div className="flex items-center gap-2 rounded-[1.25rem] border border-dashed border-[#dbe7ff] bg-white/75 px-4 py-4 text-sm font-semibold text-[#5c6e97]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#2554d4]" /> 세션 보드를 불러오는 중이에요.
                </div>
              ) : sessionMetrics.total === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed border-[#dbe7ff] bg-white/80 px-4 py-5 text-sm font-semibold leading-6 text-[#5c6e97]">
                  아직 세션 데이터가 없어요. 집중 시작 버튼으로 첫 세션을 열면 여기부터 건강 보드가 채워집니다.
                </div>
              ) : (
                <>
                  <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
                    {sessionCards.map((card) => (
                      <SessionMetricCard key={card.label} {...card} />
                    ))}
                  </div>
                  {sessionMetrics.autoClosedCount > 0 ? (
                    <div className="analysis-risk-chip mt-4 rounded-[1.2rem] px-4 py-3 text-sm font-semibold leading-6">
                      자동 종료 세션 {sessionMetrics.autoClosedCount}건이 감지됐어요. 집중 종료 버튼을 직접 눌러 마무리하면 기록 신뢰도가 더 높아집니다.
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="full" className="mt-0">
          <div className="analysis-shell">
            <StudentDetailPresentationProvider value="student-analysis">
              <StudentDetailPage params={selfParams} />
            </StudentDetailPresentationProvider>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
