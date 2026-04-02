'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { subDays, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
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
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const metrics = payload
    .filter((item) => typeof item.value === 'number' && Number.isFinite(item.value))
    .map((item) => ({
      name: item.name ?? item.dataKey ?? '지표',
      value: Number(item.value ?? 0),
      color:
        item.color ??
        (item.name?.includes('밀도')
          ? '#FF7A16'
          : item.name?.includes('리듬') || item.name?.includes('평균')
            ? '#FFB347'
            : '#2554D4'),
    }));

  const formatMetricValue = (name: string, value: number) => {
    if (name.includes('밀도') || name.includes('상승') || name.includes('완수율')) return `${Math.round(value)}%`;
    if (name.includes('점수')) return `${Math.round(value)}점`;
    return minutesToLabel(value);
  };

  return (
    <div className="analysis-card rounded-[1.15rem] px-3 py-2.5 shadow-[0_22px_36px_-28px_rgba(20,41,95,0.46)]">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5c6e97]">{label}</p>
      <div className={cn('mt-2 grid gap-3', metrics.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
        {metrics.map((metric) => (
          <div key={metric.name}>
            <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: metric.color }}>
              {metric.name}
            </p>
            <p className="text-lg font-black text-[#14295F]">{formatMetricValue(metric.name, metric.value)}</p>
          </div>
        ))}
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
        <span className="text-[var(--text-on-dark-soft)]">{label}</span>
        <span>{clampPercent(value)}%</span>
      </div>
      <div className="rounded-full bg-[rgba(255,255,255,0.1)] p-1 ring-1 ring-white/8">
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

function MiniGrowthBars({
  data,
}: {
  data: Array<{ label: string; totalMinutes: number }>;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const max = Math.max(...data.map((item) => item.totalMinutes), 1);
  const yTicks = Array.from(new Set([max, Math.round(max / 2), 0])).sort((a, b) => b - a);
  const chartHeight = 92;
  const chartWidth = Math.max(220, data.length * 38);
  const paddingX = 14;
  const stepX = data.length > 1 ? (chartWidth - paddingX * 2) / (data.length - 1) : 0;
  const baseLineY = chartHeight - 12;
  const points = data.map((day, index) => {
    const x = paddingX + stepX * index;
    const progress = max > 0 ? day.totalMinutes / max : 0;
    const y = baseLineY - progress * (chartHeight - 28);
    return { ...day, x, y: Number.isFinite(y) ? y : baseLineY };
  });
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const activePoint = activeIndex != null ? points[activeIndex] : null;

  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3">
      <div className="flex h-[7.85rem] flex-col justify-between pb-[2rem] pt-1 text-right">
        {yTicks.map((tick) => (
          <span key={tick} className="text-[10px] font-black text-[var(--text-on-dark-soft)]">
            {compactSessionLabel(tick)}
          </span>
        ))}
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute bottom-[2rem] top-1 left-0 w-px rounded-full bg-white/20" />
        <div className="pl-3">
          <div className="relative h-[5.8rem]">
            {activePoint ? (
              <div className="pointer-events-none absolute right-0 top-0 z-20 rounded-[1rem] border border-[#F0DDC8] bg-white/95 px-3 py-2 shadow-[0_18px_32px_-24px_rgba(20,41,95,0.35)]">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#64779C]">{activePoint.label}</p>
                <p className="mt-1 text-sm font-black text-[#14295F]">{minutesToLabel(activePoint.totalMinutes)}</p>
              </div>
            ) : null}
            <svg
              className="h-full w-full overflow-visible"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="mini-growth-line" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="#FFD36D" />
                  <stop offset="55%" stopColor="#FFB347" />
                  <stop offset="100%" stopColor="#FF7A00" />
                </linearGradient>
                <filter id="mini-growth-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {yTicks.map((tick) => {
                const tickProgress = max > 0 ? tick / max : 0;
                const y = baseLineY - tickProgress * (chartHeight - 28);
                return (
                  <line
                    key={tick}
                    x1={paddingX}
                    x2={chartWidth - paddingX}
                    y1={y}
                    y2={y}
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="1"
                    strokeDasharray={tick === 0 ? '0' : '4 5'}
                  />
                );
              })}

              <path
                d={linePath}
                fill="none"
                stroke="url(#mini-growth-line)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#mini-growth-glow)"
              />

              {points.map((point, index) => (
                <g
                  key={point.label}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer"
                  aria-label={`${point.label} ${minutesToLabel(point.totalMinutes)}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onClick={() => setActiveIndex(index)}
                >
                  <circle cx={point.x} cy={point.y} fill="rgba(255,122,0,0.22)" r={activeIndex === index ? 11 : 8.5} />
                  <circle cx={point.x} cy={point.y} fill="#FFB347" r={activeIndex === index ? 6.2 : 5.5} />
                  <circle cx={point.x} cy={point.y} fill="#FFF4D8" r={activeIndex === index ? 2.8 : 2.2} />
                </g>
              ))}
            </svg>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
          {data.map((day, index) => (
            <button
              key={day.label}
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onClick={() => setActiveIndex(index)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-[0.8rem] px-1 py-1 text-center transition-all duration-300',
                activeIndex === index ? 'bg-white/12' : 'bg-transparent'
              )}
              style={{ transitionDelay: `${index * 50}ms` }}
            >
              <p className="text-[10px] font-black text-[var(--text-on-dark-soft)]">{day.label}</p>
              <p className="text-[11px] font-black text-[var(--text-on-dark)]">
                {day.totalMinutes > 0 ? `${Math.round(day.totalMinutes / 60)}h` : '--'}
              </p>
            </button>
          ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GraphDungeonCard({
  title,
  eyebrow,
  insight,
  unlocked,
  preview,
  previewHint,
  children,
  lightMode = false,
}: {
  title: string;
  eyebrow: string;
  insight: string;
  unlocked: boolean;
  preview: React.ReactNode;
  previewHint: string;
  children: ReactNode;
  lightMode?: boolean;
}) {
  return (
    <section
      className={cn(
        'rounded-[1.85rem] border p-4 transition-transform duration-200',
        unlocked && 'hover:-translate-y-0.5 hover:scale-[1.01]',
        lightMode
          ? unlocked
            ? 'border border-[#F1DEC9] bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(255,247,239,0.96)_100%)] shadow-[0_20px_40px_-34px_rgba(190,112,28,0.18)]'
            : 'border border-[#F3E3D1] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,248,241,0.94)_100%)] opacity-95 shadow-[0_18px_36px_-34px_rgba(191,115,31,0.14)]'
          : unlocked
            ? 'surface-card surface-card--secondary on-dark border-[color:var(--border-subtle)] shadow-[0_24px_46px_-34px_rgba(0,0,0,0.52)]'
            : 'surface-card surface-card--ghost on-dark border-dashed border-white/12 opacity-90 shadow-[0_24px_46px_-34px_rgba(0,0,0,0.52)]'
      )}
    >
      <div className="min-w-0">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="px-2.5 py-1 text-[10px] shadow-none">
              {eyebrow}
            </Badge>
            <span className={cn(
              'text-[10px] font-black uppercase tracking-[0.18em]',
              lightMode
                ? unlocked
                  ? 'text-[#C97416]'
                  : 'inline-flex items-center gap-1 text-[#9C7C5B]'
                : unlocked
                  ? 'text-[var(--text-on-dark-soft)]'
                  : 'inline-flex items-center gap-1 text-[var(--text-on-dark-muted)]'
            )}>
              {unlocked ? '🔓 unlocked' : <><Lock className="h-3 w-3" /> locked</>}
            </span>
          </div>
          <h3 className={cn('mt-3 text-lg font-black tracking-tight', lightMode ? 'text-[#17326B]' : 'text-white')}>{title}</h3>
          <p className={cn('mt-1 text-sm font-semibold', lightMode ? 'text-[#526B93]' : 'text-[var(--text-on-dark-soft)]')}>{insight}</p>
        </div>
      </div>

      <div className={cn(
        'mt-4 rounded-[1.35rem] px-3 py-3',
        lightMode
          ? 'border border-[#F2E2D1] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,248,240,0.9)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]'
          : 'border border-white/12 bg-white/[0.08]'
      )}>
        {preview}
        <p className={cn('mt-3 text-right text-[11px] font-semibold', lightMode ? 'text-[#7A6B5A]' : 'text-[var(--text-on-dark-soft)]')}>{previewHint}</p>
      </div>

      <div className={cn('mt-4 pt-4', lightMode ? '' : 'border-t border-white/12')}>{children}</div>
    </section>
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

  const displayName = useMemo(() => {
    const raw = user?.displayName?.trim();
    return raw ? raw.replace(/님$/, '') : '학생';
  }, [user?.displayName]);

  const weeklyData = useMemo(
    () => chartData.slice(7).map((item) => ({ ...item, shortLabel: shortDateLabel(item.dateKey) })),
    [chartData]
  );

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
  const weeklySummaryLines = useMemo(() => {
    const blankDays = weeklyData.filter((item) => item.totalMinutes === 0).length;
    return [
      kpi.weekDiffPct >= 0
        ? `최근 7일 누적 공부시간은 지난 주보다 ${Math.abs(kpi.weekDiffPct)}% 올라갔어요.`
        : `최근 7일 누적 공부시간은 지난 주보다 ${Math.abs(kpi.weekDiffPct)}% 줄었어요.`,
      `${shortDateLabel(bestDay.dateKey)}에 ${minutesToLabel(bestDay.totalMinutes)}으로 가장 길게 공부했어요.`,
      blankDays > 0
        ? `최근 7일 중 기록이 없는 날이 ${blankDays}일 있어서 흐름이 조금 끊겼어요.`
        : '최근 7일은 매일 기록이 이어져서 흐름이 안정적이에요.',
    ];
  }, [bestDay.dateKey, bestDay.totalMinutes, kpi.weekDiffPct, weeklyData]);
  const densityData = useMemo(
    () => [
      { label: '완료율', value: clampPercent(sessionMetrics.completionRate) },
      { label: '세션량', value: clampPercent(sessionMetrics.total * 9) },
      { label: '평균 길이', value: clampPercent((sessionMetrics.avgDurationMinutes / 90) * 100) },
    ],
    [sessionMetrics]
  );
  const dungeonCards = useMemo(
    () => [
      {
        id: 'focus' as const,
        eyebrow: 'FOCUS TREND',
        title: '집중 시간 추이',
        insight: kpi.weekDiffPct >= 0 ? `${signedPercent(kpi.weekDiffPct)} 상승 흐름` : `${signedPercent(kpi.weekDiffPct)} 하락 감지`,
        unlocked: true,
        previewHint: '최근 14일 누적 추이',
      },
      {
        id: 'density' as const,
        eyebrow: 'DENSITY LAB',
        title: '공부 밀도 분석',
        insight: sessionMetrics.total > 0 ? `평균 ${minutesToLabel(sessionMetrics.avgDurationMinutes)} 세션` : '세션 데이터 수집 중',
        unlocked: sessionMetrics.total > 0,
        previewHint: '세션 건강도 확인',
      },
      {
        id: 'rhythm' as const,
        eyebrow: 'RHYTHM MAP',
        title: '리듬 패턴',
        insight: insight.trend,
        unlocked: kpi.studyDays >= 4,
        previewHint: '주간 리듬 흐름',
      },
      {
        id: 'slot' as const,
        eyebrow: 'TIME SLOT',
        title: '시간대 효율',
        insight: sessionMetrics.total >= 10 ? '오전/오후 흐름을 비교해볼 수 있어요' : '세션이 적어도 기본 흐름부터 먼저 볼 수 있어요',
        unlocked: true,
        previewHint: sessionMetrics.total >= 10 ? '효율 분석 가능' : '기본 흐름 먼저 보기',
      },
    ],
    [insight.trend, kpi.studyDays, kpi.weekDiffPct, sessionMetrics]
  );
  const visibleDungeonCards = useMemo(
    () => (isMobile ? dungeonCards.filter((card) => card.unlocked) : dungeonCards),
    [dungeonCards, isMobile]
  );

  if (!user) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const mobilePanelClass = 'rounded-[1.35rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,246,236,0.93)_100%)] shadow-[0_18px_38px_-34px_rgba(191,115,31,0.16)]';
  const mobileMiniCardClass = 'rounded-[1.2rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.76)_0%,rgba(255,248,240,0.72)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]';
  const mobileHeroStatCardClass = 'rounded-[1.28rem] border border-[#F0DDC9] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,246,237,0.94)_100%)] p-4 shadow-[0_18px_34px_-30px_rgba(191,115,31,0.18)]';
  const mobileSummaryPanelClass = 'rounded-[1.45rem] border border-[#F0DDC9] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,244,232,0.95)_100%)] p-4 shadow-[0_18px_36px_-32px_rgba(191,115,31,0.18)]';
  const mobileMiniLabelClass = 'text-[10px] font-black uppercase tracking-[0.18em] text-[#9C7C5B]';
  const mobileMiniValueClass = 'mt-2 text-lg font-black text-[#17326B]';
  const mobileMiniMetaClass = 'mt-1 text-sm font-semibold text-[#526B93]';

  return (
    <div className={cn(isMobile ? 'bg-[linear-gradient(180deg,#FFFDF9_0%,#FFF4E8_100%)] pb-24 space-y-4' : 'student-night-page pb-24 space-y-6')}>
      {isMobile && <StudentTrackSubnav />}

      <Tabs defaultValue="growth" className="space-y-4">
        <TabsList className={cn(
          'grid w-full grid-cols-2 rounded-[1.5rem] p-1.5',
          isMobile
            ? 'gap-1.5 border border-[#F0DDC9] bg-[linear-gradient(180deg,#FFF9F1_0%,#FFF2E5_100%)] shadow-[0_16px_34px_-28px_rgba(191,115,31,0.18)]'
            : 'gap-2 border border-white/12 bg-white/[0.08] shadow-[0_18px_42px_-32px_rgba(0,0,0,0.42)]'
        )}>
          <TabsTrigger value="growth" className={cn(
            'rounded-[1.1rem] px-3 py-2.5 text-xs font-black data-[state=active]:bg-[#FF9626] data-[state=active]:text-white',
            isMobile ? 'text-[#6B5676] hover:text-[#17326B]' : 'text-[var(--text-on-dark-soft)] hover:text-white'
          )}>
            <TrendingUp className="mr-1.5 h-3.5 w-3.5" /> 성장 맵
          </TabsTrigger>
          <TabsTrigger value="full" className={cn(
            'rounded-[1.1rem] px-3 py-2.5 text-xs font-black data-[state=active]:bg-[#FF9626] data-[state=active]:text-white',
            isMobile ? 'text-[#6B5676] hover:text-[#17326B]' : 'text-[var(--text-on-dark-soft)] hover:text-white'
          )}>
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> 전체 분석
          </TabsTrigger>
        </TabsList>

        <TabsContent value="growth" className="mt-0 space-y-4">
          <section className={cn(
            'overflow-hidden rounded-[2.2rem] px-5 py-5',
            isMobile
              ? 'border border-[#F0DDC7] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,245,234,0.96)_100%)] shadow-[0_26px_54px_-36px_rgba(191,115,31,0.24)]'
              : 'surface-card surface-card--primary on-dark'
          )}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="dark" className="px-3 py-1 text-[10px] shadow-none">GROWTH TRACK</Badge>
                <span className="text-[11px] font-black text-[var(--accent-orange-soft)]">{format(new Date(), 'M월 d일 EEEE', { locale: ko })}</span>
              </div>
              <Badge variant="secondary" className="px-3 py-1 text-[10px] shadow-none">오늘 버프 {dailyBuff}</Badge>
            </div>

            <div className={cn('mt-5 grid gap-5', isMobile ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]')}>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className={cn('text-[clamp(1.35rem,2.4vw,2.2rem)] font-black tracking-tight', isMobile ? 'text-[#17326B]' : 'text-white')}>{displayName}</p>
                  <Badge variant="secondary" className="px-3 py-1 text-[10px] shadow-none">🔥 {playerTitle}</Badge>
                </div>
                <p className={cn('mt-2 text-sm font-semibold', isMobile ? 'text-[#526B93]' : 'surface-caption')}>오늘도 성장한 하루를 만드는 중이에요.</p>

                <div className={cn('mt-5 grid gap-3', isMobile ? 'grid-cols-2' : 'sm:grid-cols-2')}>
                  <div className={cn(isMobile ? mobileHeroStatCardClass : 'surface-card surface-card--light rounded-[1.2rem] px-4 py-4')}>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-secondary)]">오늘 상태</p>
                    <p className="mt-2 text-2xl font-black text-[var(--text-primary)]">{minutesToCompactLabel(todayMinutes)}</p>
                    <p className="mt-1 text-[11px] font-semibold text-[var(--text-secondary)]">{minutesToCompactLabel(heroGoalMinutes)} 목표</p>
                  </div>
                  <div className={cn(isMobile ? mobileHeroStatCardClass : 'surface-card surface-card--ivory rounded-[1.2rem] px-4 py-4')}>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-secondary)]">상승 폭</p>
                    <p className="mt-2 text-2xl font-black text-[var(--accent-orange)]">{signedPercent(kpi.weekDiffPct)}</p>
                    <p className="mt-1 text-[11px] font-semibold text-[var(--text-secondary)]">지난 주 대비</p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <QuestStatBar label="집중력 HP" value={focusHp} accent="orange" />
                  <QuestStatBar label="루틴 유지력" value={consistencyHp} accent="blue" />
                  <QuestStatBar label="계획 완수율" value={completionHp} accent="emerald" />
                </div>

                <div className={cn('mt-5 rounded-[1.4rem] p-4', isMobile ? mobileSummaryPanelClass : 'surface-card surface-card--ghost on-dark')}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={cn('text-[10px] font-black uppercase tracking-[0.18em]', isMobile ? 'text-[#9C7C5B]' : 'text-[var(--text-on-dark-muted)]')}>오늘 상태</p>
                      <p className={cn('mt-2 text-lg font-black', isMobile ? 'text-[#17326B]' : 'text-white')}>🔥 집중 중 (LIVE)</p>
                    </div>
                    <p className="text-sm font-black text-[var(--accent-orange-soft)]">{heroProgress}% 성장</p>
                  </div>
                  <div className={cn('mt-3 rounded-full p-1', isMobile ? 'bg-[#F6E7D4]' : 'bg-white/10')}>
                    <div
                      className="relative h-3 rounded-full bg-[linear-gradient(90deg,#FFD36D_0%,#FFB347_34%,#FF7A00_64%,#69CBFF_100%)]"
                      style={{ width: `${heroProgress}%`, transition: 'width 800ms ease-out' }}
                    >
                      <div className="absolute inset-y-0 w-12 animate-pulse bg-white/30 blur-sm" />
                    </div>
                  </div>
                  <div className={cn('mt-3 flex items-center justify-between gap-3 text-sm font-semibold', isMobile ? 'text-[#6B5676]' : 'text-[var(--text-on-dark-soft)]')}>
                    <span>{minutesToCompactLabel(todayMinutes)} / {minutesToCompactLabel(heroGoalMinutes)}</span>
                    <span>{heroProgress >= 100 ? '오늘 목표 도달' : `${Math.max(0, heroGoalMinutes - todayMinutes)}분 남음`}</span>
                  </div>
                </div>
              </div>

              <div className={cn('rounded-[1.8rem] p-4', isMobile ? mobileSummaryPanelClass : 'surface-card surface-card--secondary on-dark')}>
                <p className="surface-kicker text-[10px]">WEEKLY SUMMARY</p>
                <h2 className={cn('mt-3 text-[1.35rem] font-black tracking-tight', isMobile ? 'text-[#17326B]' : 'text-white')}>이번 주 성장 요약</h2>
                <div className="mt-4 space-y-2.5">
                  {weeklySummaryLines.map((line) => (
                    <p key={line} className={cn('text-sm font-semibold leading-6', isMobile ? 'text-[#526B93]' : 'surface-caption')}>
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className={cn('rounded-[2rem] p-5', isMobile ? mobilePanelClass : 'surface-card surface-card--secondary on-dark')}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Badge variant="secondary" className="px-3 py-1 text-[10px] shadow-none">GROWTH MAP</Badge>
                <h2 className={cn('mt-3 text-[1.35rem] font-black tracking-tight', isMobile ? 'text-[#17326B]' : 'text-white')}>이번 주 성장 맵</h2>
              </div>
              <div className={cn(isMobile ? `${mobileMiniCardClass} text-right` : 'surface-card surface-card--ivory rounded-[1.2rem] px-4 py-3 text-right')}>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-secondary)]">최고 성장</p>
                <p className="mt-1 text-lg font-black text-[var(--text-primary)]">{shortDateLabel(bestDay.dateKey)}</p>
                <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">{minutesToLabel(bestDay.totalMinutes)}</p>
              </div>
            </div>
            <div className="mt-5">
              <MiniGrowthBars data={weeklyData.map((item) => ({ label: item.shortLabel, totalMinutes: item.totalMinutes }))} />
            </div>
          </section>

          <section className="space-y-4">
            {visibleDungeonCards.map((card) => (
              <GraphDungeonCard
                key={card.id}
                title={card.title}
                eyebrow={card.eyebrow}
                insight={card.insight}
                unlocked={card.unlocked}
                lightMode={isMobile}
                previewHint={card.previewHint}
                preview={
                  card.id === 'density' ? (
                    <ResponsiveContainer width="100%" height={88}>
                      <BarChart data={densityData} margin={{ top: 8, right: 10, left: 14, bottom: 2 }}>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--chart-grid)" />
                        <YAxis
                          width={38}
                          tick={{ fontSize: 9, fontWeight: 800, fill: 'var(--chart-axis)' }}
                          tickLine={{ stroke: 'var(--chart-grid)' }}
                          axisLine={{ stroke: 'var(--chart-grid)' }}
                          tickFormatter={(value) => `${Number(value)}%`}
                          tickMargin={8}
                        />
                        <Tooltip content={<AnalysisTooltip />} cursor={{ fill: 'rgba(255,150,38,0.08)' }} />
                        <Bar name="집중 밀도" dataKey="value" radius={[8, 8, 4, 4]} fill="#FF9626" activeBar={{ fill: '#FFAE4F' }} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height={88}>
                      <ComposedChart data={weeklyData} margin={{ top: 8, right: 10, left: 14, bottom: 2 }}>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--chart-grid)" />
                        <YAxis
                          width={38}
                          tick={{ fontSize: 9, fontWeight: 800, fill: 'var(--chart-axis)' }}
                          tickLine={{ stroke: 'var(--chart-grid)' }}
                          axisLine={{ stroke: 'var(--chart-grid)' }}
                          tickFormatter={(value) => `${Math.round(Number(value) / 60)}h`}
                          tickMargin={8}
                        />
                        <Tooltip content={<AnalysisTooltip />} cursor={{ fill: 'rgba(46,107,255,0.06)' }} />
                        <Bar
                          name={card.id === 'rhythm' ? '평균 공부시간' : '집중 시간'}
                          dataKey={card.id === 'rhythm' ? 'avgMinutes' : 'totalMinutes'}
                          radius={[8, 8, 4, 4]}
                          fill={card.id === 'rhythm' ? '#18B67A' : '#2E6BFF'}
                          activeBar={{ fill: card.id === 'rhythm' ? '#29C58D' : '#4B84FF' }}
                        />
                        <Line
                          type="monotone"
                          name={card.id === 'rhythm' ? '리듬선' : '평균 흐름'}
                          dataKey="avgMinutes"
                          stroke={card.id === 'rhythm' ? '#8EF0C9' : '#FFB347'}
                          strokeWidth={2.2}
                          dot={false}
                          activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )
                }
              >
                {card.id === 'focus' ? (
                    <div className="space-y-4">
                    <div className={cn('rounded-[1.35rem] p-4', isMobile ? mobilePanelClass : 'surface-card surface-card--ghost on-dark')}>
                      <ResponsiveContainer width="100%" height={isMobile ? 180 : 260}>
                        <ComposedChart data={chartData} margin={{ top: 12, right: 14, left: isMobile ? 18 : 12, bottom: 4 }}>
                          <defs>
                            <linearGradient id="analysis-focus-gradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#2E6BFF" />
                              <stop offset="100%" stopColor="#7AB6FF" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--chart-grid)" />
                          <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 800, fill: 'var(--chart-axis)' }} tickLine={false} axisLine={false} />
                          <YAxis
                            width={isMobile ? 46 : 40}
                            tick={{ fontSize: 10, fontWeight: 800, fill: 'var(--chart-axis)' }}
                            tickLine={{ stroke: 'var(--chart-grid)' }}
                            axisLine={{ stroke: 'var(--chart-grid)' }}
                            tickFormatter={(value) => `${Math.round(Number(value) / 60)}h`}
                            tickMargin={8}
                          />
                          <Tooltip content={<AnalysisTooltip />} cursor={{ fill: 'rgba(46,107,255,0.08)' }} />
                          <Bar dataKey="totalMinutes" name="집중 시간" radius={[10, 10, 4, 4]} fill="url(#analysis-focus-gradient)" activeBar={{ fill: '#5A90FF' }} />
                          <Line type="monotone" dataKey="avgMinutes" name="리듬선" stroke="#FFB347" strokeWidth={2.6} dot={false} activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} />
                          <ReferenceDot x={bestDay.label} y={bestDay.totalMinutes} r={6} fill="#FFD36D" stroke="#fff" strokeWidth={2} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    {isMobile ? (
                      <div className="grid gap-3">
                        <div className={mobileMiniCardClass}><p className={mobileMiniLabelClass}>최고 몰입일</p><p className={mobileMiniValueClass}>{shortDateLabel(bestDay.dateKey)}</p><p className={mobileMiniMetaClass}>{minutesToLabel(bestDay.totalMinutes)}</p></div>
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="surface-card surface-card--ghost on-dark rounded-[1.2rem] p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]">최고 몰입일</p><p className="mt-2 text-lg font-black text-white">{shortDateLabel(bestDay.dateKey)}</p><p className="mt-1 text-sm font-semibold text-[var(--text-on-dark-soft)]">{minutesToLabel(bestDay.totalMinutes)}</p></div>
                        <div className="surface-card surface-card--ghost on-dark rounded-[1.2rem] p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]">위험 구간</p><p className="mt-2 text-lg font-black text-white">{chartData.some((item) => item.totalMinutes === 0) ? '공백일 존재' : '안정 흐름'}</p><p className="mt-1 text-sm font-semibold text-[var(--text-on-dark-soft)]">{insight.improve}</p></div>
                        <div className="rounded-[1.2rem] border border-[#FFD7B4] bg-[#FFF1DE] p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C86A10]">추천 전략</p><p className="mt-2 text-lg font-black text-[#17326B]">오전 루틴 강화</p><p className="mt-1 text-sm font-semibold text-[#28478F]">계획트랙으로 연결</p></div>
                      </div>
                    )}
                  </div>
                ) : card.id === 'density' ? (
                  <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'md:grid-cols-3')}>
                    {sessionCards.map((item) => (
                      <div key={item.label} className={cn(isMobile ? mobileMiniCardClass : 'surface-card surface-card--ghost on-dark rounded-[1.2rem] p-4', isMobile && item.label === '평균 길이' && 'col-span-2')}>
                        <p className={isMobile ? mobileMiniLabelClass : 'text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]'}>{item.label}</p>
                        <p className={isMobile ? mobileMiniValueClass : 'mt-2 text-lg font-black text-white'}>{item.value}</p>
                        <p className={isMobile ? mobileMiniMetaClass : 'mt-1 text-sm font-semibold text-[var(--text-on-dark-soft)]'}>{item.meta}</p>
                      </div>
                    ))}
                  </div>
                ) : card.id === 'rhythm' ? (
                  <div className="space-y-4">
                    <div className={cn('rounded-[1.35rem] p-4', isMobile ? mobilePanelClass : 'surface-card surface-card--ghost on-dark')}>
                      <MiniGrowthBars data={weeklyData.map((item) => ({ label: item.shortLabel, totalMinutes: item.totalMinutes }))} />
                    </div>
                    {isMobile ? (
                      <div className="rounded-[1.2rem] border border-emerald-200 bg-[#EAF9F2] p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0F8A5F]">추천 액션</p><p className="mt-2 text-lg font-black text-[#17326B]">오전 8시 루틴</p><p className="mt-1 text-sm font-semibold text-[#2C5B7E]">3일 연속 도전</p></div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="surface-card surface-card--ghost on-dark rounded-[1.2rem] p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]">연속 유지</p><p className="mt-2 text-lg font-black text-white">{kpi.maxStreak}일</p><p className="mt-1 text-sm font-semibold text-[var(--text-on-dark-soft)]">루틴 최고 기록</p></div>
                        <div className="surface-card surface-card--ghost on-dark rounded-[1.2rem] p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]">코치 해석</p><p className="mt-2 text-lg font-black text-white">{chartData.some((item) => item.totalMinutes === 0) ? '공백 복구 필요' : '리듬 안정화'}</p><p className="mt-1 text-sm font-semibold text-[var(--text-on-dark-soft)]">{insight.improve}</p></div>
                        <div className="rounded-[1.2rem] border border-emerald-200 bg-[#EAF9F2] p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0F8A5F]">추천 액션</p><p className="mt-2 text-lg font-black text-[#17326B]">오전 8시 루틴</p><p className="mt-1 text-sm font-semibold text-[#2C5B7E]">3일 연속 도전</p></div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'md:grid-cols-3')}>
                    <div className={cn(isMobile ? mobileMiniCardClass : 'surface-card surface-card--ghost on-dark rounded-[1.2rem] p-4', isMobile && 'col-span-2')}>
                      <p className={isMobile ? mobileMiniLabelClass : 'text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]'}>현재 상태</p>
                      <p className={isMobile ? mobileMiniValueClass : 'mt-2 text-lg font-black text-white'}>{sessionMetrics.total >= 10 ? '시간대 비교 가능' : '기본 흐름 확인 중'}</p>
                      <p className={isMobile ? mobileMiniMetaClass : 'mt-1 text-sm font-semibold text-[var(--text-on-dark-soft)]'}>
                        {sessionMetrics.total >= 10
                          ? '오전과 오후 중 어디서 더 오래 버티는지 함께 보고 있어요.'
                          : '세션이 더 쌓일수록 오전/오후 효율 판단이 더 선명해져요.'}
                      </p>
                    </div>
                    <div className={isMobile ? mobileMiniCardClass : 'surface-card surface-card--ghost on-dark rounded-[1.2rem] p-4'}>
                      <p className={isMobile ? mobileMiniLabelClass : 'text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]'}>수집된 세션</p>
                      <p className={isMobile ? mobileMiniValueClass : 'mt-2 text-lg font-black text-white'}>{sessionMetrics.total}회</p>
                      <p className={isMobile ? mobileMiniMetaClass : 'mt-1 text-sm font-semibold text-[var(--text-on-dark-soft)]'}>
                        최근 14일 기준 평균 {minutesToLabel(sessionMetrics.avgDurationMinutes)} 세션
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-[#FFD7B4] bg-[#FFF1DE] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C86A10]">코치 메모</p>
                      <p className="mt-2 text-lg font-black text-[#17326B]">
                        {sessionMetrics.total >= 10 ? '집중 잘 되는 시간대를 붙잡아보세요' : '지금은 꾸준히 기록을 쌓는 게 먼저예요'}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#28478F]">
                        {sessionMetrics.total >= 10
                          ? '잘 되는 시간대를 계획트랙 첫 블록에 고정하면 흐름이 더 안정돼요.'
                          : '시간대 판단은 나중에 더 정확해지니, 우선 공부 시작 시간을 일정하게 맞춰보세요.'}
                      </p>
                    </div>
                  </div>
                )}
              </GraphDungeonCard>
            ))}
          </section>

          {!isMobile ? (
          <section className="surface-card surface-card--secondary on-dark rounded-[2rem] p-5 shadow-[0_24px_52px_-34px_rgba(0,0,0,0.56)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <Badge className="border-emerald-400/22 bg-emerald-500/16 px-3 py-1 text-[10px] font-black text-emerald-100 shadow-none">NEXT ACTION</Badge>
                <h2 className="mt-3 text-[1.35rem] font-black tracking-tight text-white">분석 결과를 바로 행동으로 연결</h2>
                <p className="mt-1 text-sm font-semibold text-[var(--text-on-dark-soft)]">보고 끝나는 것이 아니라, 지금 바로 계획트랙에 이어 붙이도록 설계했어요.</p>
              </div>
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
