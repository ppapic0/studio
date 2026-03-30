'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { subDays, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Brain,
  Clock3,
  Flame,
  Gift,
  Lock,
  Loader2,
  Sparkles,
  Target,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
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
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StudentDetailPage from '../teacher/students/[id]/page';
import { StudentDetailPresentationProvider } from '@/components/dashboard/student-detail-presentation-mode';

type ToneKey = 'blue' | 'emerald' | 'violet' | 'amber' | 'rose';
type RewardBurst = { id: number; title: string; points: number };

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

function minutesToCompactLabel(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function shortDateLabel(dateKey: string) {
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey.slice(5).replace('-', '/');
  return format(parsed, 'M/d', { locale: ko });
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

function QuestStatBar({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: 'orange' | 'blue' | 'emerald';
}) {
  const gradient =
    accent === 'blue'
      ? 'from-[#69CBFF] via-[#4E8CFF] to-[#28478F]'
      : accent === 'emerald'
        ? 'from-[#8EF0C9] via-[#39C084] to-[#1A7B61]'
        : 'from-[#FFD36D] via-[#FFB347] to-[#FF7A00]';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm font-black text-white">
        <span className="text-white/68">{label}</span>
        <span>{clampPercent(value)}%</span>
      </div>
      <div className="rounded-full bg-white/8 p-1">
        <div
          className={cn('relative h-3 rounded-full bg-gradient-to-r', gradient)}
          style={{ width: `${clampPercent(value)}%`, transition: 'width 700ms ease-out' }}
        >
          <div className="absolute inset-y-0 w-10 animate-pulse bg-white/25 blur-sm" />
        </div>
      </div>
    </div>
  );
}

function RewardToast({
  reward,
}: {
  reward: { id: number; title: string; points: number } | null;
}) {
  if (!reward) return null;
  return (
    <div className="fixed inset-x-4 top-20 z-50 mx-auto max-w-sm rounded-[1.4rem] border border-[#FFB347]/18 bg-[linear-gradient(135deg,#173A82_0%,#22479B_58%,#FF7A16_170%)] px-4 py-3 text-white shadow-[0_22px_42px_-26px_rgba(255,122,22,0.46)] transition-all duration-300">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-white/14 p-2">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/68">{reward.title}</p>
          <p className="mt-1 text-lg font-black">+{reward.points}P 획득</p>
        </div>
      </div>
    </div>
  );
}

function MiniGrowthBars({
  data,
}: {
  data: Array<{ label: string; totalMinutes: number }>;
}) {
  const max = Math.max(...data.map((item) => item.totalMinutes), 1);

  return (
    <div className="grid grid-cols-7 gap-2">
      {data.map((day, index) => (
        <div
          key={day.label}
          className="flex flex-col items-center gap-2 transition-all duration-300"
          style={{ transitionDelay: `${index * 50}ms` }}
        >
          <div className="flex h-[5.8rem] items-end">
            <div
              className="w-9 rounded-t-[1rem] rounded-b-[0.95rem] bg-[linear-gradient(180deg,#FFD36D_0%,#FFB347_45%,#FF7A00_100%)] shadow-[0_14px_24px_-18px_rgba(255,122,0,0.38)]"
              style={{ height: `${Math.max(24, (day.totalMinutes / max) * 78)}px` }}
            />
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black text-white/40">{day.label}</p>
            <p className="mt-1 text-[11px] font-black text-white/82">
              {day.totalMinutes > 0 ? `${Math.round(day.totalMinutes / 60)}h` : '--'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function GraphDungeonCard({
  title,
  eyebrow,
  insight,
  reward,
  unlocked,
  preview,
  previewHint,
  children,
}: {
  title: string;
  eyebrow: string;
  insight: string;
  reward: number;
  unlocked: boolean;
  preview: React.ReactNode;
  previewHint: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'rounded-[1.85rem] border p-4 shadow-[0_24px_46px_-34px_rgba(0,0,0,0.52)] transition-transform duration-200',
        unlocked && 'hover:-translate-y-0.5 hover:scale-[1.01]',
        unlocked ? 'border-white/10 bg-[#13285A]/82' : 'border-white/6 bg-[#10224D]/72'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-[#FFB347]/18 bg-[#FF9626]/10 px-2.5 py-1 text-[10px] font-black text-[#FFD79F] shadow-none">
              {eyebrow}
            </Badge>
            <span className={cn('text-[10px] font-black uppercase tracking-[0.18em]', unlocked ? 'text-white/42' : 'inline-flex items-center gap-1 text-white/35')}>
              {unlocked ? '🔓 unlocked' : <><Lock className="h-3 w-3" /> locked</>}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-black tracking-tight text-white">{title}</h3>
          <p className="mt-1 text-sm font-semibold text-white/58">{insight}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">Reward</p>
          <p className="mt-1 text-lg font-black text-[#FFD79F]">+{reward}P</p>
        </div>
      </div>

      <div className="mt-4 rounded-[1.35rem] border border-white/8 bg-white/5 px-3 py-3">
        {preview}
        <p className="mt-3 text-right text-[11px] font-semibold text-white/58">{previewHint}</p>
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">{children}</div>
    </section>
  );
}

export default function AnalysisTrackPage() {
  const router = useRouter();
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

  const displayName = useMemo(() => {
    const raw = user?.displayName?.trim();
    return raw ? raw.replace(/님$/, '') : '학생';
  }, [user?.displayName]);

  const weeklyData = useMemo(
    () => chartData.slice(7).map((item) => ({ ...item, shortLabel: shortDateLabel(item.dateKey) })),
    [chartData]
  );

  const level = Math.max(1, Math.round(kpi.thisWeekMin / 180) + 8);
  const focusHp = clampPercent((kpi.avgMin14 / 240) * 100);
  const consistencyHp = clampPercent(kpi.consistencyScore);
  const completionHp = clampPercent(sessionMetrics.completionRate);
  const playerTitle = focusHp >= 85 ? '집중 마스터' : consistencyHp >= 70 ? '루틴 빌더' : '성장 플레이어';
  const dailyBuff = kpi.weekDiffPct >= 10 ? '+10% 집중 지속' : kpi.maxStreak >= 4 ? '+8% 루틴 유지' : '+6% 회복 보정';
  const todayMinutes = chartData[13]?.totalMinutes || 0;
  const heroGoalMinutes = 600;
  const heroProgress = clampPercent((todayMinutes / heroGoalMinutes) * 100);
  const bestDay = weeklyData.reduce(
    (best, item) => (item.totalMinutes > best.totalMinutes ? item : best),
    weeklyData[0] || { dateKey: format(new Date(), 'yyyy-MM-dd'), label: '오늘', shortLabel: '오늘', totalMinutes: 0, avgMinutes: 0 }
  );
  const densityData = useMemo(
    () => [
      { label: '완료율', value: clampPercent(sessionMetrics.completionRate) },
      { label: '세션량', value: clampPercent(sessionMetrics.total * 9) },
      { label: '평균 길이', value: clampPercent((sessionMetrics.avgDurationMinutes / 90) * 100) },
    ],
    [sessionMetrics]
  );
  const [analysisRewardPoints, setAnalysisRewardPoints] = useState(0);
  const [rewardBurst, setRewardBurst] = useState<RewardBurst | null>(null);

  useEffect(() => {
    if (!rewardBurst) return;
    const timeout = window.setTimeout(() => setRewardBurst(null), 1900);
    return () => window.clearTimeout(timeout);
  }, [rewardBurst]);

  const grantReward = (title: string, points: number) => {
    setAnalysisRewardPoints((prev) => prev + points);
    setRewardBurst({ id: Date.now(), title, points });
  };

  const dungeonCards = useMemo(
    () => [
      {
        id: 'focus' as const,
        eyebrow: 'FOCUS TREND',
        title: '집중 시간 추이',
        insight: kpi.weekDiffPct >= 0 ? `${signedPercent(kpi.weekDiffPct)} 상승 흐름` : `${signedPercent(kpi.weekDiffPct)} 하락 감지`,
        reward: 10,
        unlocked: true,
        previewHint: '최근 14일 누적 추이',
      },
      {
        id: 'density' as const,
        eyebrow: 'DENSITY LAB',
        title: '공부 밀도 분석',
        insight: sessionMetrics.total > 0 ? `평균 ${minutesToLabel(sessionMetrics.avgDurationMinutes)} 세션` : '세션 데이터 수집 중',
        reward: 15,
        unlocked: sessionMetrics.total > 0,
        previewHint: '세션 건강도 확인',
      },
      {
        id: 'rhythm' as const,
        eyebrow: 'RHYTHM MAP',
        title: '리듬 패턴',
        insight: insight.trend,
        reward: 20,
        unlocked: kpi.studyDays >= 4,
        previewHint: '주간 리듬 흐름',
      },
      {
        id: 'slot' as const,
        eyebrow: 'TIME SLOT',
        title: '시간대 효율',
        insight: '세션 10회 이상이면 해금',
        reward: 25,
        unlocked: sessionMetrics.total >= 10,
        previewHint: sessionMetrics.total >= 10 ? '효율 분석 가능' : `${Math.max(0, 10 - sessionMetrics.total)}회 더 필요`,
      },
    ],
    [insight.trend, kpi.studyDays, kpi.weekDiffPct, sessionMetrics]
  );
  const visibleDungeonCards = useMemo(
    () => (isMobile ? dungeonCards.filter((card) => card.unlocked) : dungeonCards),
    [dungeonCards, isMobile]
  );

  const handleApplyStrategy = (title: string, points: number) => {
    grantReward(title, points);
    window.setTimeout(() => router.push('/dashboard/plan'), 260);
  };

  if (!user) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn('student-night-page pb-24', isMobile ? 'space-y-4' : 'space-y-6')}>
      {isMobile && <StudentTrackSubnav />}
      <RewardToast reward={rewardBurst} />

      <Tabs defaultValue="growth" className="space-y-4">
        <TabsList className={cn('grid w-full grid-cols-2 rounded-[1.5rem] border border-white/10 bg-white/6 p-1.5', isMobile ? 'gap-1.5' : 'gap-2')}>
          <TabsTrigger value="growth" className="rounded-[1.1rem] px-3 py-2.5 text-xs font-black text-white data-[state=active]:bg-[#FF9626] data-[state=active]:text-white">
            <TrendingUp className="mr-1.5 h-3.5 w-3.5" /> 성장 맵
          </TabsTrigger>
          <TabsTrigger value="full" className="rounded-[1.1rem] px-3 py-2.5 text-xs font-black text-white data-[state=active]:bg-[#FF9626] data-[state=active]:text-white">
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> 전체 분석
          </TabsTrigger>
        </TabsList>

        <TabsContent value="growth" className="mt-0 space-y-4">
          <section className="overflow-hidden rounded-[2.2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,170,70,0.16),transparent_26%),linear-gradient(135deg,#17326B_0%,#22478C_60%,#152E63_100%)] px-5 py-5 shadow-[0_28px_62px_-36px_rgba(0,0,0,0.58)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge className="border-white/10 bg-white/8 px-3 py-1 text-[10px] font-black text-white/78 shadow-none">GROWTH TRACK</Badge>
                <span className="text-[11px] font-black text-[#FFD79F]">{format(new Date(), 'M월 d일 EEEE', { locale: ko })}</span>
              </div>
              <Badge className="border-[#FFB347]/18 bg-[#FF9626]/12 px-3 py-1 text-[10px] font-black text-[#FFD79F] shadow-none">오늘 버프 {dailyBuff}</Badge>
            </div>

            <div className={cn('mt-5 grid gap-5', isMobile ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]')}>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-[clamp(1.35rem,2.4vw,2.2rem)] font-black tracking-tight text-white">{displayName} Lv.{level}</p>
                  <Badge className="border-[#FFB347]/18 bg-[#FF9626]/14 px-3 py-1 text-[10px] font-black text-[#FFD79F] shadow-none">🔥 {playerTitle}</Badge>
                </div>
                <p className="mt-2 text-sm font-semibold text-white/82">오늘도 성장한 하루를 만드는 중이에요.</p>

                <div className={cn('mt-5 grid gap-3', isMobile ? 'grid-cols-2' : 'sm:grid-cols-3')}>
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/8 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">오늘 상태</p>
                    <p className="mt-2 text-2xl font-black text-white">{minutesToCompactLabel(todayMinutes)}</p>
                    <p className="mt-1 text-[11px] font-semibold text-white/58">{minutesToCompactLabel(heroGoalMinutes)} 목표</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/8 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">상승 폭</p>
                    <p className="mt-2 text-2xl font-black text-[#FFD79F]">{signedPercent(kpi.weekDiffPct)}</p>
                    <p className="mt-1 text-[11px] font-semibold text-white/58">지난 주 대비</p>
                  </div>
                  <div className={cn('rounded-[1.2rem] border border-white/10 bg-white/8 px-4 py-4', isMobile && 'col-span-2')}>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">분석 보상</p>
                    <p className="mt-2 text-2xl font-black text-white">+{analysisRewardPoints}P</p>
                    <p className="mt-1 text-[11px] font-semibold text-white/58">탐험 완료 보상</p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <QuestStatBar label="집중력 HP" value={focusHp} accent="orange" />
                  <QuestStatBar label="루틴 유지력" value={consistencyHp} accent="blue" />
                  <QuestStatBar label="계획 완수율" value={completionHp} accent="emerald" />
                </div>

                <div className="mt-5 rounded-[1.4rem] border border-white/10 bg-white/8 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">오늘 상태</p>
                      <p className="mt-2 text-lg font-black text-white">🔥 집중 중 (LIVE)</p>
                    </div>
                    <p className="text-sm font-black text-[#FFD79F]">{heroProgress}% 성장</p>
                  </div>
                  <div className="mt-3 rounded-full bg-white/10 p-1">
                    <div
                      className="relative h-3 rounded-full bg-[linear-gradient(90deg,#FFD36D_0%,#FFB347_34%,#FF7A00_64%,#69CBFF_100%)]"
                      style={{ width: `${heroProgress}%`, transition: 'width 800ms ease-out' }}
                    >
                      <div className="absolute inset-y-0 w-12 animate-pulse bg-white/30 blur-sm" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm font-semibold text-white/58">
                    <span>{minutesToCompactLabel(todayMinutes)} / {minutesToCompactLabel(heroGoalMinutes)}</span>
                    <span>{heroProgress >= 100 ? '오늘 목표 도달' : `${Math.max(0, heroGoalMinutes - todayMinutes)}분 남음`}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-white/10 bg-white/6 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">AI COACH</p>
                  <Badge className="border-emerald-400/18 bg-emerald-500/10 px-3 py-1 text-[10px] font-black text-emerald-200 shadow-none">전략 적용 가능</Badge>
                </div>
                <h2 className="mt-3 text-[1.35rem] font-black tracking-tight text-white">이번 주 성장 요약</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-white/58">{insight.trend}</p>

                {isMobile ? (
                  <div className="mt-5 space-y-3">
                    <div className="rounded-[1.35rem] border border-white/10 bg-white/6 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-white">미션. 오전 루틴 3일 연속</p>
                        <span className="rounded-full bg-[#FF9626]/14 px-2.5 py-1 text-[10px] font-black text-[#FFD79F]">+20P</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-6 text-white/58">오전 고정 루틴만 먼저 잡아도 리듬이 훨씬 안정됩니다.</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    <div className="rounded-[1.35rem] border border-white/10 bg-white/6 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-white">미션 1. 오전 루틴 3일 연속</p>
                        <span className="rounded-full bg-[#FF9626]/14 px-2.5 py-1 text-[10px] font-black text-[#FFD79F]">+20P</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-6 text-white/58">집중 흐름이 좋은 시간대를 루틴으로 고정해 보세요.</p>
                    </div>
                    <div className="rounded-[1.35rem] border border-white/10 bg-white/6 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-white">미션 2. 50분+ 세션 3회</p>
                        <span className="rounded-full bg-[#FF9626]/14 px-2.5 py-1 text-[10px] font-black text-[#FFD79F]">+25P</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-6 text-white/58">짧은 세션 비중을 줄이고 몰입 밀도를 높여보세요.</p>
                    </div>
                    <div className="rounded-[1.35rem] border border-emerald-400/18 bg-emerald-500/10 p-4">
                      <div className="flex items-center gap-2 text-emerald-200">
                        <Brain className="h-4 w-4" />
                        <p className="text-sm font-black">코치 전략 적용 보상 +15P</p>
                      </div>
                    </div>
                  </div>
                )}

                <Button type="button" onClick={() => handleApplyStrategy('코치 전략 적용', 15)} className="mt-5 h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#173A82_0%,#22479B_55%,#FF7A16_170%)] font-black text-white shadow-[0_20px_38px_-26px_rgba(255,122,22,0.44)]">
                  오늘 전략 자동 적용
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>

          <section className="student-night-panel rounded-[2rem] p-5 shadow-[0_24px_52px_-34px_rgba(0,0,0,0.56)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Badge className="border-[#FFB347]/18 bg-[#FF9626]/10 px-3 py-1 text-[10px] font-black text-[#FFD79F] shadow-none">GROWTH MAP</Badge>
                <h2 className="mt-3 text-[1.35rem] font-black tracking-tight text-white">이번 주 성장 맵</h2>
              </div>
              <div className="rounded-[1.2rem] border border-[#FFB347]/18 bg-[#FF9626]/10 px-4 py-3 text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFD79F]">최고 성장</p>
                <p className="mt-1 text-lg font-black text-white">{shortDateLabel(bestDay.dateKey)}</p>
                <p className="mt-1 text-sm font-semibold text-white/58">{minutesToLabel(bestDay.totalMinutes)}</p>
              </div>
            </div>
            <div className="mt-5">
              <MiniGrowthBars data={weeklyData.map((item) => ({ label: item.shortLabel, totalMinutes: item.totalMinutes }))} />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Badge className="border-white/10 bg-white/8 px-3 py-1 text-[10px] font-black text-white/72 shadow-none">GRAPH DUNGEON</Badge>
                <h2 className="mt-3 text-[1.35rem] font-black tracking-tight text-white">그래프 던전들</h2>
              </div>
              {!isMobile ? <p className="text-sm font-semibold text-white/58">핵심 그래프를 한 번에 보고, 해석하고, 전략으로 연결하세요.</p> : null}
            </div>

            {visibleDungeonCards.map((card) => (
              <GraphDungeonCard
                key={card.id}
                title={card.title}
                eyebrow={card.eyebrow}
                insight={card.insight}
                reward={card.reward}
                unlocked={card.unlocked}
                previewHint={card.previewHint}
                preview={
                  card.id === 'density' ? (
                    <ResponsiveContainer width="100%" height={88}>
                      <BarChart data={densityData}>
                        <Bar dataKey="value" radius={[8, 8, 4, 4]} fill="#FF9626" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : card.id === 'slot' && !card.unlocked ? (
                    <div className="grid h-[5.5rem] grid-cols-7 gap-2 opacity-65">
                      {Array.from({ length: 7 }).map((_, index) => (
                        <div key={index} className="flex items-end">
                          <div className="w-full rounded-t-2xl rounded-b-xl bg-white/10" style={{ height: `${26 + (index % 3) * 10}px` }} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={88}>
                      <ComposedChart data={weeklyData}>
                        <Bar dataKey={card.id === 'rhythm' ? 'avgMinutes' : 'totalMinutes'} radius={[8, 8, 4, 4]} fill={card.id === 'rhythm' ? '#18B67A' : '#2E6BFF'} />
                        <Line type="monotone" dataKey="avgMinutes" stroke={card.id === 'rhythm' ? '#8EF0C9' : '#FFB347'} strokeWidth={2.2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )
                }
              >
                {card.id === 'focus' ? (
                  <div className="space-y-4">
                    <div className="rounded-[1.35rem] border border-white/10 bg-white/6 p-4">
                      <ResponsiveContainer width="100%" height={isMobile ? 180 : 260}>
                        <ComposedChart data={chartData} margin={{ top: 12, right: 8, left: isMobile ? -28 : -18, bottom: 0 }}>
                          <defs>
                            <linearGradient id="analysis-focus-gradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#2E6BFF" />
                              <stop offset="100%" stopColor="#7AB6FF" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 800, fill: 'rgba(255,255,255,0.45)' }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: 'rgba(255,255,255,0.45)' }} tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(Number(value) / 60)}h`} />
                          <Tooltip content={<AnalysisTooltip />} />
                          <Bar dataKey="totalMinutes" name="집중 시간" radius={[10, 10, 4, 4]} fill="url(#analysis-focus-gradient)" />
                          <Line type="monotone" dataKey="avgMinutes" name="리듬선" stroke="#FFB347" strokeWidth={2.6} dot={false} />
                          <ReferenceDot x={bestDay.label} y={bestDay.totalMinutes} r={6} fill="#FFD36D" stroke="#fff" strokeWidth={2} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    {isMobile ? (
                      <div className="grid gap-3">
                        <div className="rounded-[1.2rem] border border-white/10 bg-white/6 p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">최고 몰입일</p><p className="mt-2 text-lg font-black text-white">{shortDateLabel(bestDay.dateKey)}</p><p className="mt-1 text-sm font-semibold text-white/58">{minutesToLabel(bestDay.totalMinutes)}</p></div>
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-[1.2rem] border border-white/10 bg-white/6 p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">최고 몰입일</p><p className="mt-2 text-lg font-black text-white">{shortDateLabel(bestDay.dateKey)}</p><p className="mt-1 text-sm font-semibold text-white/58">{minutesToLabel(bestDay.totalMinutes)}</p></div>
                        <div className="rounded-[1.2rem] border border-white/10 bg-white/6 p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">위험 구간</p><p className="mt-2 text-lg font-black text-white">{chartData.some((item) => item.totalMinutes === 0) ? '공백일 존재' : '안정 흐름'}</p><p className="mt-1 text-sm font-semibold text-white/58">{insight.improve}</p></div>
                        <div className="rounded-[1.2rem] border border-[#FFB347]/18 bg-[#FF9626]/10 p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFD79F]">추천 전략</p><p className="mt-2 text-lg font-black text-white">오전 루틴 강화</p><p className="mt-1 text-sm font-semibold text-white/58">계획트랙으로 연결</p></div>
                      </div>
                    )}
                    <Button type="button" onClick={() => handleApplyStrategy('집중 시간 추이 적용', 10)} className="h-11 rounded-2xl bg-[linear-gradient(135deg,#173A82_0%,#22479B_55%,#FF7A16_170%)] px-5 font-black text-white">이 전략 적용하기</Button>
                  </div>
                ) : card.id === 'density' ? (
                  <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'md:grid-cols-3')}>
                    {sessionCards.map((item) => (
                      <div key={item.label} className={cn('rounded-[1.2rem] border border-white/10 bg-white/6 p-4', isMobile && item.label === '평균 길이' && 'col-span-2')}>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">{item.label}</p>
                        <p className="mt-2 text-lg font-black text-white">{item.value}</p>
                        <p className="mt-1 text-sm font-semibold text-white/58">{item.meta}</p>
                      </div>
                    ))}
                    <div className={cn(!isMobile && 'md:col-span-3', isMobile && 'col-span-2')}>
                      <Button type="button" onClick={() => handleApplyStrategy('공부 밀도 전략 적용', 15)} className="h-11 rounded-2xl bg-[linear-gradient(135deg,#173A82_0%,#22479B_55%,#FF7A16_170%)] px-5 font-black text-white">밀도 회복 전략 적용</Button>
                    </div>
                  </div>
                ) : card.id === 'rhythm' ? (
                  <div className="space-y-4">
                    <div className="rounded-[1.35rem] border border-white/10 bg-white/6 p-4">
                      <MiniGrowthBars data={weeklyData.map((item) => ({ label: item.shortLabel, totalMinutes: item.totalMinutes }))} />
                    </div>
                    {isMobile ? (
                      <div className="rounded-[1.2rem] border border-emerald-400/18 bg-emerald-500/10 p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">추천 액션</p><p className="mt-2 text-lg font-black text-white">오전 8시 루틴</p><p className="mt-1 text-sm font-semibold text-white/58">3일 연속 도전</p></div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-[1.2rem] border border-white/10 bg-white/6 p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">연속 유지</p><p className="mt-2 text-lg font-black text-white">{kpi.maxStreak}일</p><p className="mt-1 text-sm font-semibold text-white/58">루틴 최고 기록</p></div>
                        <div className="rounded-[1.2rem] border border-white/10 bg-white/6 p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">코치 해석</p><p className="mt-2 text-lg font-black text-white">{chartData.some((item) => item.totalMinutes === 0) ? '공백 복구 필요' : '리듬 안정화'}</p><p className="mt-1 text-sm font-semibold text-white/58">{insight.improve}</p></div>
                        <div className="rounded-[1.2rem] border border-emerald-400/18 bg-emerald-500/10 p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">추천 액션</p><p className="mt-2 text-lg font-black text-white">오전 8시 루틴</p><p className="mt-1 text-sm font-semibold text-white/58">3일 연속 도전</p></div>
                      </div>
                    )}
                    <Button type="button" onClick={() => handleApplyStrategy('리듬 패턴 전략 적용', 20)} className="h-11 rounded-2xl bg-[linear-gradient(135deg,#173A82_0%,#22479B_55%,#FF7A16_170%)] px-5 font-black text-white">리듬 복구 전략 적용</Button>
                  </div>
                ) : (
                  <div className="rounded-[1.35rem] border border-dashed border-white/10 bg-white/5 px-4 py-5 text-center">
                    <Lock className="mx-auto h-8 w-8 text-white/35" />
                    <p className="mt-3 text-lg font-black text-white">시간대 효율은 아직 잠겨 있어요</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-white/58">세션 {Math.max(0, 10 - sessionMetrics.total)}회만 더 쌓이면 오전/오후 효율 카드가 열립니다.</p>
                  </div>
                )}
              </GraphDungeonCard>
            ))}
          </section>

          {!isMobile ? (
          <section className="student-night-panel rounded-[2rem] p-5 shadow-[0_24px_52px_-34px_rgba(0,0,0,0.56)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <Badge className="border-emerald-400/18 bg-emerald-500/10 px-3 py-1 text-[10px] font-black text-emerald-200 shadow-none">NEXT ACTION</Badge>
                <h2 className="mt-3 text-[1.35rem] font-black tracking-tight text-white">분석 결과를 바로 행동으로 연결</h2>
                <p className="mt-1 text-sm font-semibold text-white/58">보고 끝나는 것이 아니라, 지금 바로 계획트랙에 이어 붙이도록 설계했어요.</p>
              </div>
              <Button type="button" onClick={() => handleApplyStrategy('다음 목표 연결', 20)} className="h-12 rounded-2xl bg-[linear-gradient(135deg,#173A82_0%,#22479B_55%,#FF7A16_170%)] px-5 font-black text-white shadow-[0_20px_38px_-26px_rgba(255,122,22,0.44)]">
                오늘 전략 자동 적용
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </section>
          ) : null}
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
