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
  Lock,
  Loader2,
  ShieldCheck,
  TrendingUp,
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
import { buildStudentGrowthSummary, buildWeeklyStudyInsight } from '@/lib/learning-insights';
import { StudyLogDay } from '@/lib/types';
import { StudentTrackSubnav } from '@/components/dashboard/student-track-subnav';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StudentDetailPage from '../teacher/students/[id]/page';
import { StudentDetailPresentationProvider } from '@/components/dashboard/student-detail-presentation-mode';

type ToneKey = 'blue' | 'emerald' | 'amber' | 'rose';
type AnalysisTab = 'growth' | 'full';
type GrowthSummaryTone = 'good' | 'steady' | 'recovery';

const TONE_STYLES: Record<ToneKey, { chip: string; text: string; bar: string; ring: string; soft: string }> = {
  blue: {
    chip: 'border-[#d7e4ff] bg-[#edf4ff] text-[#2554d4]',
    text: 'text-[#2554d4]',
    bar: 'from-[#2554d4] via-[#4f7cff] to-[#9cbcff]',
    ring: '#3564f0',
    soft: 'from-[#f8fbff] to-[#edf4ff]',
  },
  emerald: {
    chip: 'border-[#d4f1e4] bg-[#eefaf4] text-[#0f8f65]',
    text: 'text-[#0f8f65]',
    bar: 'from-[#0f8f65] via-[#22b982] to-[#83dfba]',
    ring: '#16a36f',
    soft: 'from-[#f7fdf9] to-[#eefaf4]',
  },
  amber: {
    chip: 'border-[color:var(--accent-orange-border)] bg-[var(--accent-orange-surface)] text-[var(--text-accent-fixed)]',
    text: 'text-[var(--text-accent-fixed)]',
    bar: 'from-[var(--accent-orange)] via-[var(--accent-orange-soft)] to-[#fff1d7]',
    ring: 'var(--accent-orange)',
    soft: 'from-[#fffaf4] to-[var(--accent-orange-surface)]',
  },
  rose: {
    chip: 'border-[#ffdbe2] bg-[#fff2f5] text-[#dc4b74]',
    text: 'text-[#dc4b74]',
    bar: 'from-[#dc4b74] via-[#f1668f] to-[#f8a3b8]',
    ring: '#dc4b74',
    soft: 'from-[#fff7f8] to-[#fff2f5]',
  },
};

const SUMMARY_TONE_STYLES: Record<
  GrowthSummaryTone,
  { badge: string; accent: string; glow: string }
> = {
  good: {
    badge: 'border-[#78e3b9]/30 bg-[#0f8f65]/18 text-[#a6f3d5]',
    accent: 'text-[#a6f3d5]',
    glow: 'from-[#173b72] via-[#133864] to-[#0f5f48]',
  },
  steady: {
    badge: 'border-[#8db4ff]/28 bg-[#2856b8]/18 text-[#d9e7ff]',
    accent: 'text-[#d9e7ff]',
    glow: 'from-[#18305f] via-[#173d7b] to-[#1c4e86]',
  },
  recovery: {
    badge: 'border-[#ffc8d5]/28 bg-[#9b3154]/18 text-[#ffd9e2]',
    accent: 'text-[#ffd9e2]',
    glow: 'from-[#3e264f] via-[#572b5f] to-[#7b304f]',
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
          ? 'var(--accent-orange)'
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

function GrowthSummaryCard({
  title,
  detail,
  metricLabel,
  metricValue,
  tone,
}: {
  title: string;
  detail: string;
  metricLabel: string;
  metricValue: string;
  tone: GrowthSummaryTone;
}) {
  const toneStyles = SUMMARY_TONE_STYLES[tone];

  return (
    <div className={cn('analysis-growth-signal-card rounded-[1.5rem] p-4 bg-gradient-to-br', toneStyles.glow)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[rgba(240,247,255,0.72)]">{title}</p>
          <p className="mt-3 text-sm font-semibold leading-6 text-white">{detail}</p>
        </div>
        <div className={cn('rounded-full border px-3 py-1.5 text-[10px] font-black tracking-[0.14em]', toneStyles.badge)}>
          {metricLabel}
        </div>
      </div>
      <p className={cn('font-aggro-display mt-4 break-keep text-[1.18rem] font-black tracking-[-0.04em]', toneStyles.accent)}>
        {metricValue}
      </p>
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
          <p className="font-aggro-display text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7ea8]">{label}</p>
          <p className="font-aggro-display mt-2 break-keep text-[clamp(0.98rem,1.4vw,1.55rem)] font-black tracking-[-0.03em] text-[#14295F]">
            {value}
          </p>
          <p className="mt-1 text-[12px] font-semibold leading-5 text-[#5c6e97]">{meta}</p>
        </div>

        {variant === 'ring' ? (
          <div
            className="analysis-ring-shell h-[4.8rem] w-[4.8rem] shrink-0 p-[0.36rem]"
            style={{ background: `conic-gradient(${toneStyles.ring} ${ringValue}%, rgba(20,41,95,0.09) 0)` }}
          >
            <div className="analysis-ring-core h-full w-full">
              <div className="text-center">
                <Icon className={cn('mx-auto h-3.5 w-3.5', toneStyles.text)} />
                <p className={cn('font-aggro-display text-sm font-black tracking-[-0.03em]', toneStyles.text)}>
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
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8090b4]">진행도</span>
            <span className={cn('font-aggro-display text-[10px] font-black', toneStyles.text)}>{ringValue}%</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MiniGrowthBars({
  data,
  compact = false,
}: {
  data: Array<{ label: string; totalMinutes: number }>;
  compact?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const mixGrowthTone = (progress: number) => {
    const clamped = Math.max(0, Math.min(1, progress));
    const cool = [115, 164, 255] as const;
    const warm = [255, 179, 71] as const;
    const mixed = cool.map((channel, index) => Math.round(channel + (warm[index] - channel) * clamped));
    return {
      solid: `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`,
      glow: `rgba(${mixed[0]}, ${mixed[1]}, ${mixed[2]}, ${0.1 + clamped * 0.1})`,
      chip: `linear-gradient(135deg, rgba(${mixed[0]}, ${mixed[1]}, ${mixed[2]}, 0.12) 0%, rgba(${mixed[0]}, ${mixed[1]}, ${mixed[2]}, 0.2) 100%)`,
      border: `rgba(${mixed[0]}, ${mixed[1]}, ${mixed[2]}, ${0.3 + clamped * 0.2})`,
      shadow: `rgba(${mixed[0]}, ${mixed[1]}, ${mixed[2]}, ${0.12 + clamped * 0.12})`,
    };
  };
  const max = Math.max(...data.map((item) => item.totalMinutes), 1);
  const yTicks = Array.from(new Set([max, Math.round(max / 2), 0])).sort((a, b) => b - a);
  const chartHeight = compact ? 88 : 92;
  const chartWidth = Math.max(compact ? 204 : 220, data.length * (compact ? 34 : 38));
  const paddingX = 14;
  const stepX = data.length > 1 ? (chartWidth - paddingX * 2) / (data.length - 1) : 0;
  const baseLineY = chartHeight - 12;
  const points = data.map((day, index) => {
    const x = paddingX + stepX * index;
    const progress = max > 0 ? day.totalMinutes / max : 0;
    const y = baseLineY - progress * (chartHeight - 28);
    return {
      ...day,
      x,
      y: Number.isFinite(y) ? y : baseLineY,
      progress,
      tone: mixGrowthTone(progress),
    };
  });
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const activePoint = activeIndex != null ? points[activeIndex] : null;

  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3">
      <div className={cn('flex flex-col justify-between pt-1 text-right', compact ? 'h-[7.1rem] pb-[1.15rem]' : 'h-[7.85rem] pb-[1.4rem]')}>
        {yTicks.map((tick) => (
          <span key={tick} className={cn('font-aggro-display font-black text-[var(--text-on-dark-soft)]', compact ? 'text-[9px]' : 'text-[10px]')}>
            {tick === 0 ? '0h' : compactSessionLabel(tick)}
          </span>
        ))}
      </div>

      <div className="relative">
        <div
          className={cn('pointer-events-none absolute top-1 left-0 w-px rounded-full', compact ? 'bottom-[1.15rem]' : 'bottom-[1.4rem]')}
          style={{ background: 'var(--chart-grid)' }}
        />
        <div className="pl-3">
          <div className={cn('relative', compact ? 'h-[5.35rem]' : 'h-[5.8rem]')}>
            {activePoint ? (
              <div
                className="pointer-events-none absolute right-0 top-0 z-20 rounded-[1rem] border bg-white/95 px-3 py-2"
                style={{
                  borderColor: activePoint.tone.border,
                  boxShadow: `0 18px 32px -24px ${activePoint.tone.shadow}`,
                }}
              >
                <p className="font-aggro-display text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: activePoint.tone.solid }}>{activePoint.label}</p>
                <p className={cn('font-aggro-display mt-1 font-black tracking-[-0.03em] text-[#14295F]', compact ? 'text-[12px]' : 'text-sm')}>{minutesToLabel(activePoint.totalMinutes)}</p>
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
                  <stop offset="0%" stopColor="#5A88FF" />
                  <stop offset="58%" stopColor="#7CB3FF" />
                  <stop offset="100%" stopColor="#FFB347" />
                </linearGradient>
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
                    stroke="var(--chart-grid)"
                    strokeWidth="1"
                    strokeDasharray={tick === 0 ? '0' : '4 5'}
                  />
                );
              })}

              <path
                d={linePath}
                fill="none"
                stroke="url(#mini-growth-line)"
                strokeWidth="3.25"
                strokeLinecap="round"
                strokeLinejoin="round"
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
                  <circle cx={point.x} cy={point.y} fill={point.tone.glow} r={activeIndex === index ? 10 : 7.5} />
                  <circle cx={point.x} cy={point.y} fill={point.tone.solid} r={activeIndex === index ? 5.6 : 4.8} />
                  <circle cx={point.x} cy={point.y} fill="#F8FBFF" r={activeIndex === index ? 2.4 : 1.9} />
                </g>
              ))}
            </svg>
          </div>

          <div className={cn('grid grid-cols-7', compact ? 'mt-1 gap-1' : 'mt-2 gap-2')}>
            {points.map((day, index) => (
              <button
                key={day.label}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  'flex items-center justify-center rounded-[0.8rem] text-center transition-colors duration-200',
                  compact ? 'px-0.5 py-0.5' : 'px-1 py-1',
                  activeIndex === index ? 'bg-white/10' : 'bg-transparent'
                )}
                style={{ transitionDelay: `${index * 40}ms` }}
              >
                <p className={cn('font-aggro-display font-black text-[var(--text-on-dark-soft)]', compact ? 'text-[9px]' : 'text-[10px]')}>{day.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GrowthDetailAccordionItem({
  value,
  title,
  eyebrow,
  insight,
  unlocked,
  previewHint,
  children,
  className,
}: {
  value: string;
  title: string;
  eyebrow: string;
  insight: string;
  unlocked: boolean;
  previewHint: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AccordionItem
      value={value}
      className={cn(
        'analysis-growth-module-shell rounded-[1.9rem] border-b-0 px-4 py-2',
        !unlocked && 'analysis-growth-module-shell--pending',
        className
      )}
    >
      <AccordionTrigger className="analysis-growth-detail-trigger min-w-0 py-3 text-left hover:no-underline">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="analysis-growth-kicker">{eyebrow}</span>
            <span
              className={cn(
                'analysis-growth-state-chip',
                unlocked ? 'analysis-growth-state-chip--ready' : 'analysis-growth-state-chip--pending'
              )}
            >
              {unlocked ? '데이터 충분' : <><Lock className="h-3 w-3" /> 기록 대기</>}
            </span>
          </div>
          <h3 className="font-aggro-display mt-3 break-keep text-[1.1rem] font-black tracking-[-0.03em] text-white">
            {title}
          </h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-[var(--text-on-dark-soft)]">{insight}</p>
          <p className="mt-2 text-[11px] font-semibold text-[var(--text-on-dark-muted)]">
            {previewHint} · 보고 싶을 때만 펼쳐보세요
          </p>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-3 pt-1">
        <div className="border-t border-white/10 pt-4">{children}</div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default function AnalysisTrackPage() {
  const { viewMode, activeMembership } = useAppContext();
  const { user } = useUser();
  const firestore = useFirestore();
  const selfParams = useMemo(() => Promise.resolve({ id: user?.uid ?? '' }), [user?.uid]);
  const isMobile = viewMode === 'mobile';
  const [activeTab, setActiveTab] = useState<AnalysisTab>('growth');
  const growthTabMatchesDesktop = !isMobile || activeTab === 'growth';

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

  const todayMinutes = chartData[13]?.totalMinutes || 0;
  const heroGoalMinutes = 600;
  const heroProgress = clampPercent((todayMinutes / heroGoalMinutes) * 100);
  const bestDay = weeklyData.reduce(
    (best, item) => (item.totalMinutes > best.totalMinutes ? item : best),
    weeklyData[0] || { dateKey: format(new Date(), 'yyyy-MM-dd'), label: '오늘', shortLabel: '오늘', totalMinutes: 0, avgMinutes: 0 }
  );
  const blankDayCount = useMemo(() => chartData.filter((item) => item.totalMinutes === 0).length, [chartData]);
  const hasBlankDays = useMemo(() => chartData.some((item) => item.totalMinutes === 0), [chartData]);
  const remainingGoalMinutes = Math.max(0, heroGoalMinutes - todayMinutes);
  const growthSummary = useMemo(
    () =>
      buildStudentGrowthSummary({
        data: chartData,
        weekDiffPct: kpi.weekDiffPct,
        maxStreak: kpi.maxStreak,
        completionRate: sessionMetrics.completionRate,
        avgMinutes: kpi.avgMin14,
        studyDays: kpi.studyDays,
      }),
    [chartData, kpi.avgMin14, kpi.maxStreak, kpi.studyDays, kpi.weekDiffPct, sessionMetrics.completionRate]
  );
  const summaryToneStyles = SUMMARY_TONE_STYLES[growthSummary.tone];
  const summaryCards = useMemo(
    () => [
      {
        title: growthSummary.strengthTitle,
        detail: growthSummary.strengthDetail,
        metricLabel:
          sessionMetrics.completionRate >= 85
            ? '완료율'
            : kpi.maxStreak >= 4
              ? '연속 기록'
              : kpi.weekDiffPct >= 10
                ? '주간 변화'
                : '14일 평균',
        metricValue:
          sessionMetrics.completionRate >= 85
            ? `${sessionMetrics.completionRate}%`
            : kpi.maxStreak >= 4
              ? `${kpi.maxStreak}일`
              : kpi.weekDiffPct >= 10
                ? signedPercent(kpi.weekDiffPct)
                : minutesToCompactLabel(kpi.avgMin14),
        tone: 'good' as const,
      },
      {
        title: growthSummary.weaknessTitle,
        detail: growthSummary.weaknessDetail,
        metricLabel:
          blankDayCount > 0
            ? '공백일'
            : kpi.weekDiffPct < 0
              ? '주간 변화'
              : sessionMetrics.completionRate < 70
                ? '완료율'
                : '14일 평균',
        metricValue:
          blankDayCount > 0
            ? `${blankDayCount}일`
            : kpi.weekDiffPct < 0
              ? signedPercent(kpi.weekDiffPct)
              : sessionMetrics.completionRate < 70
                ? `${sessionMetrics.completionRate}%`
                : minutesToCompactLabel(kpi.avgMin14),
        tone: blankDayCount > 0 || kpi.weekDiffPct < 0 || sessionMetrics.completionRate < 70 ? ('recovery' as const) : ('steady' as const),
      },
      {
        title: growthSummary.growthTitle,
        detail: growthSummary.growthDetail,
        metricLabel: '이번 주',
        metricValue: minutesToCompactLabel(kpi.thisWeekMin),
        tone: growthSummary.tone,
      },
    ],
    [
      blankDayCount,
      growthSummary.growthDetail,
      growthSummary.growthTitle,
      growthSummary.strengthDetail,
      growthSummary.strengthTitle,
      growthSummary.tone,
      growthSummary.weaknessDetail,
      growthSummary.weaknessTitle,
      kpi.avgMin14,
      kpi.maxStreak,
      kpi.thisWeekMin,
      kpi.weekDiffPct,
      sessionMetrics.completionRate,
    ]
  );
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
        eyebrow: '핵심 흐름',
        title: '집중 시간 추이',
        insight: kpi.weekDiffPct >= 0 ? `${signedPercent(kpi.weekDiffPct)} 지난 주 대비 상승` : `${signedPercent(kpi.weekDiffPct)} 지난 주 대비 하락`,
        unlocked: true,
        previewHint: '최근 14일 집중 시간',
      },
      {
        id: 'density' as const,
        eyebrow: '세션 분석',
        title: '공부 밀도 분석',
        insight: sessionMetrics.total > 0 ? `평균 ${minutesToLabel(sessionMetrics.avgDurationMinutes)} 세션` : '세션 데이터 수집 중',
        unlocked: sessionMetrics.total > 0,
        previewHint: '완료율과 세션량 확인',
      },
      {
        id: 'rhythm' as const,
        eyebrow: '루틴 분석',
        title: '리듬 패턴',
        insight: insight.trend,
        unlocked: kpi.studyDays >= 4,
        previewHint: '주간 리듬 흐름',
      },
      {
        id: 'slot' as const,
        eyebrow: '시간대 분석',
        title: '시간대 효율',
        insight: sessionMetrics.total >= 10 ? '오전/오후 흐름을 비교해볼 수 있어요' : '세션이 적어도 기본 흐름부터 먼저 볼 수 있어요',
        unlocked: true,
        previewHint: sessionMetrics.total >= 10 ? '시간대 비교 가능' : '기록이 더 쌓이면 정확해져요',
      },
    ],
    [insight.trend, kpi.studyDays, kpi.weekDiffPct, sessionMetrics]
  );

  if (!user) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn(
      growthTabMatchesDesktop ? 'student-night-page pb-24' : 'bg-[linear-gradient(180deg,#FFFDF9_0%,#FFF4E8_100%)] pb-24',
      isMobile ? 'space-y-4' : 'space-y-6'
    )}>
      {isMobile && <StudentTrackSubnav />}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AnalysisTab)} className="space-y-4">
        <TabsList className={cn(
          'grid w-full grid-cols-2 rounded-[1.5rem] p-1.5',
          growthTabMatchesDesktop
            ? 'gap-2 border border-white/12 bg-white/[0.08] shadow-[0_18px_42px_-32px_rgba(0,0,0,0.42)]'
            : 'gap-1.5 border border-[#F0DDC9] bg-[linear-gradient(180deg,#FFF9F1_0%,#FFF2E5_100%)] shadow-[0_16px_34px_-28px_rgba(191,115,31,0.18)]'
        )}>
          <TabsTrigger value="growth" className={cn(
            'font-aggro-display rounded-[1.1rem] px-3 py-2.5 text-xs font-black data-[state=active]:bg-[var(--accent-orange)]',
            growthTabMatchesDesktop
              ? 'data-[state=active]:text-white text-[var(--text-on-dark-soft)] hover:text-white data-[state=inactive]:bg-white/[0.04]'
              : 'data-[state=active]:text-[#17326B] text-[#7A5830] hover:text-[#17326B] data-[state=inactive]:bg-white/55 data-[state=inactive]:shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]'
          )}>
            <TrendingUp className="mr-1.5 h-3.5 w-3.5" /> 성장 맵
          </TabsTrigger>
          <TabsTrigger value="full" className={cn(
            'font-aggro-display rounded-[1.1rem] px-3 py-2.5 text-xs font-black data-[state=active]:bg-[var(--accent-orange)]',
            growthTabMatchesDesktop
              ? 'data-[state=active]:text-white text-[var(--text-on-dark-soft)] hover:text-white data-[state=inactive]:bg-white/[0.04]'
              : 'data-[state=active]:text-[#17326B] text-[#7A5830] hover:text-[#17326B] data-[state=inactive]:bg-white/55 data-[state=inactive]:shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]'
          )}>
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> 전체 분석
          </TabsTrigger>
        </TabsList>

        <TabsContent value="growth" className="mt-0 space-y-4">
          <section className={cn('analysis-growth-overview rounded-[2.25rem]', isMobile ? 'px-5 py-5' : 'px-6 py-6')}>
            <div className={cn('grid gap-5', isMobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]')}>
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="analysis-growth-kicker">성장 리포트</span>
                  <span className="analysis-growth-date">{format(new Date(), 'M월 d일 EEEE', { locale: ko })}</span>
                </div>

                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('analysis-growth-hero-badge rounded-full border px-3 py-1.5 text-[11px] font-black tracking-[0.14em]', summaryToneStyles.badge)}>
                      {growthSummary.statusLabel}
                    </span>
                    <span className="analysis-growth-date">{displayName} 학생 기준</span>
                  </div>
                  <h1 className={cn('font-aggro-display mt-3 break-keep font-black tracking-[-0.04em] text-white', isMobile ? 'text-[1.65rem] leading-[1.08]' : 'text-[clamp(1.65rem,2.6vw,2.48rem)] leading-[1.04]')}>
                    지금 흐름을 쉽게 읽어보세요
                  </h1>
                </div>

                <div className={cn('analysis-growth-summary-card analysis-growth-summary-card--soft rounded-[1.55rem]', isMobile ? 'p-4' : 'p-5')}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]">지금 상태 한 줄</p>
                      <p className={cn('font-aggro-display mt-2 break-keep font-black tracking-[-0.03em] text-white', isMobile ? 'text-[1.02rem] leading-6' : 'text-lg leading-7')}>
                        {growthSummary.coachNote}
                      </p>
                    </div>
                    <span className={cn('font-aggro-display text-sm font-black tracking-[-0.03em]', summaryToneStyles.accent)}>
                      {kpi.weekDiffPct >= 0 ? `${signedPercent(kpi.weekDiffPct)} 상승` : `${signedPercent(kpi.weekDiffPct)} 조정`}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-[var(--text-on-dark-soft)]">
                    {todayMinutes > 0
                      ? `오늘은 ${minutesToCompactLabel(todayMinutes)}을 기록했고, 최근 14일 평균은 ${minutesToLabel(kpi.avgMin14)}이에요.`
                      : `오늘 기록은 아직 없지만, 최근 14일 평균은 ${minutesToLabel(kpi.avgMin14)}으로 집계되고 있어요.`}
                  </p>
                </div>

                <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
                  {summaryCards.map((card) => (
                    <GrowthSummaryCard
                      key={`${card.title}-${card.metricLabel}`}
                      title={card.title}
                      detail={card.detail}
                      metricLabel={card.metricLabel}
                      metricValue={card.metricValue}
                      tone={card.tone}
                    />
                  ))}
                </div>
              </div>

              <div className="analysis-growth-summary-card rounded-[1.85rem] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="analysis-growth-kicker">오늘 목표 진행</p>
                    <h2 className={cn('font-aggro-display mt-3 break-keep font-black tracking-[-0.04em] text-white', isMobile ? 'text-[1.18rem] leading-7' : 'text-[1.35rem] leading-[1.1]')}>
                      오늘 얼마나 채웠는지 먼저 보세요
                    </h2>
                  </div>
                  <span className={cn('analysis-growth-hero-badge rounded-full border px-3 py-1.5 text-[11px] font-black tracking-[0.14em]', heroProgress >= 100 ? SUMMARY_TONE_STYLES.good.badge : SUMMARY_TONE_STYLES.steady.badge)}>
                    {heroProgress >= 100 ? '목표 달성' : `${heroProgress}% 진행`}
                  </span>
                </div>

                <div className="mt-5 analysis-growth-highlight-card rounded-[1.35rem] px-4 py-4">
                  <p className="font-aggro-display text-[10px] font-black uppercase tracking-[0.16em] text-[#6a7da6]">오늘 학습</p>
                  <p className={cn('font-aggro-display mt-3 break-keep font-black tracking-[-0.04em] text-[#14295F]', isMobile ? 'text-[1.35rem] leading-[1.08]' : 'text-[clamp(1.35rem,2vw,2rem)] leading-[1.04]')}>
                    {minutesToCompactLabel(todayMinutes)}
                  </p>
                  <p className="mt-1 text-[12px] font-semibold leading-5 text-[#5c6e97]">
                    {heroProgress >= 100 ? '오늘 목표를 이미 채웠어요.' : `${remainingGoalMinutes}분 더 채우면 오늘 목표예요.`}
                  </p>
                </div>

                <div className="analysis-growth-rail-track mt-4">
                  <div className="analysis-growth-progress-bar" style={{ width: `${heroProgress}%` }} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="analysis-growth-light-card rounded-[1.2rem] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">연속 기록</p>
                    <p className="font-aggro-display mt-2 text-lg font-black tracking-[-0.03em] text-[#14295F]">{kpi.maxStreak}일</p>
                    <p className="mt-1 text-sm font-semibold text-[#5c6e97]">가장 길게 이어진 흐름</p>
                  </div>
                  <div className="analysis-growth-light-card rounded-[1.2rem] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">완료율</p>
                    <p className="font-aggro-display mt-2 text-lg font-black tracking-[-0.03em] text-[#14295F]">{sessionMetrics.completionRate}%</p>
                    <p className="mt-1 text-sm font-semibold text-[#5c6e97]">시작한 세션 마무리 힘</p>
                  </div>
                </div>

                <div className="mt-4 analysis-growth-light-card analysis-growth-light-card--accent rounded-[1.25rem] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C86A10]">이번 주 최고 집중일</p>
                  <p className={cn('font-aggro-display mt-2 break-keep font-black tracking-[-0.03em] text-[#14295F]', isMobile ? 'text-[1rem] leading-6' : 'text-lg leading-7')}>
                    {shortDateLabel(bestDay.dateKey)}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-[#37507F]">{minutesToLabel(bestDay.totalMinutes)}으로 가장 길게 공부했어요.</p>
                </div>
              </div>
            </div>
          </section>

          <section className={cn('analysis-growth-map rounded-[2rem]', isMobile ? 'p-5' : 'p-6')}>
            <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'flex-row items-start justify-between')}>
              <div>
                <span className="analysis-growth-kicker">자세히 보기</span>
                <h2 className={cn('font-aggro-display mt-3 break-keep font-black tracking-[-0.04em] text-white', isMobile ? 'text-[1.18rem] leading-7' : 'text-[1.35rem] leading-[1.1]')}>
                  보고 싶을 때만 그래프를 펼쳐보세요
                </h2>
                <p className="mt-1 text-sm font-semibold text-[var(--text-on-dark-soft)]">지금은 핵심만 먼저 보여주고, 아래에서 필요한 분석만 골라서 볼 수 있어요.</p>
              </div>
              <div className="analysis-growth-light-card rounded-[1.2rem] px-4 py-3 text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">빠른 체크</p>
                <p className="font-aggro-display mt-1 text-lg font-black tracking-[-0.03em] text-[#14295F]">
                  {blankDayCount > 0 ? `${blankDayCount}일 공백` : '흐름 안정'}
                </p>
                <p className="mt-1 text-[12px] font-semibold text-[#5c6e97]">
                  {blankDayCount > 0 ? '빈 날부터 줄이면 성장 그래프가 더 선명해져요.' : '최근 흐름이 매끄럽게 이어지고 있어요.'}
                </p>
              </div>
            </div>
            <div className="student-analysis-shell mt-5">
              <Accordion type="multiple" className="flex flex-col gap-4">
                {dungeonCards.map((card) => (
                <GrowthDetailAccordionItem
                  key={card.id}
                  value={card.id}
                  title={card.title}
                  eyebrow={card.eyebrow}
                  insight={card.insight}
                  unlocked={card.unlocked}
                  previewHint={card.previewHint}
                >
                  {card.id === 'focus' ? (
                    <div className="space-y-4">
                      <div className="analysis-growth-canvas rounded-[1.45rem] p-4">
                        <ResponsiveContainer width="100%" height={isMobile ? 180 : 260}>
                          <ComposedChart data={chartData} margin={{ top: 12, right: 14, left: isMobile ? 18 : 12, bottom: 4 }}>
                            <defs>
                              <linearGradient id="analysis-focus-gradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#2E6BFF" />
                                <stop offset="100%" stopColor="#8CB8FF" />
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
                            <Tooltip content={<AnalysisTooltip />} cursor={{ fill: 'rgba(90,136,255,0.12)' }} />
                            <Bar dataKey="totalMinutes" name="집중 시간" radius={[10, 10, 4, 4]} fill="url(#analysis-focus-gradient)" activeBar={{ fill: '#5A90FF' }} />
                            <Line type="monotone" dataKey="avgMinutes" name="리듬선" stroke="#FFB347" strokeWidth={2.6} dot={false} activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} />
                            <ReferenceDot x={bestDay.label} y={bestDay.totalMinutes} r={6} fill="#FFD36D" stroke="#fff" strokeWidth={2} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                      <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
                        <div className="analysis-growth-light-card rounded-[1.2rem] p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">최고 집중일</p>
                          <p className="font-aggro-display mt-2 text-lg font-black tracking-[-0.03em] text-[#14295F]">{shortDateLabel(bestDay.dateKey)}</p>
                          <p className="mt-1 text-sm font-semibold text-[#5c6e97]">{minutesToLabel(bestDay.totalMinutes)}</p>
                        </div>
                        <div className="analysis-growth-light-card rounded-[1.2rem] p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">주의 구간</p>
                          <p className={cn('font-aggro-display mt-2 break-keep font-black tracking-[-0.03em] text-[#14295F]', isMobile ? 'text-[1rem] leading-6' : 'text-lg leading-7')}>{hasBlankDays ? '공백일이 있어요' : '흐름이 안정적이에요'}</p>
                          <p className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">{isMobile ? (hasBlankDays ? '공백일을 먼저 줄여보세요.' : '지금 흐름을 유지해보세요.') : insight.improve}</p>
                        </div>
                        <div className="analysis-growth-light-card analysis-growth-light-card--accent rounded-[1.2rem] p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C86A10]">추천 연결</p>
                          <p className={cn('font-aggro-display mt-2 break-keep font-black tracking-[-0.03em] text-[#14295F]', isMobile ? 'text-[1rem] leading-6' : 'text-lg leading-7')}>오전 루틴 강화</p>
                          <p className="mt-1 text-sm font-semibold text-[#37507F]">계획트랙 첫 블록에 잘되는 시간을 고정해보세요.</p>
                        </div>
                      </div>
                    </div>
                  ) : card.id === 'density' ? (
                    <div className="space-y-4">
                      <div className="analysis-growth-canvas rounded-[1.45rem] p-4">
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
                            <Tooltip content={<AnalysisTooltip />} cursor={{ fill: 'rgba(255,150,38,0.12)' }} />
                            <Bar name="집중 밀도" dataKey="value" radius={[8, 8, 4, 4]} fill="var(--accent-orange)" activeBar={{ fill: 'var(--accent-orange-soft)' }} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
                        {sessionCards.map((item) => (
                          <SessionMetricCard
                            key={item.label}
                            label={item.label}
                            value={item.value}
                            meta={item.meta}
                            progress={item.progress}
                            tone={item.tone}
                            icon={item.icon}
                            variant={item.variant}
                            ringDisplay={item.ringDisplay}
                          />
                        ))}
                      </div>
                    </div>
                  ) : card.id === 'rhythm' ? (
                    <div className="space-y-4">
                      <div className="analysis-growth-canvas rounded-[1.45rem] p-4">
                        <MiniGrowthBars data={weeklyData.map((item) => ({ label: item.shortLabel, totalMinutes: item.totalMinutes }))} compact={isMobile} />
                      </div>
                      <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                        <div className="analysis-growth-light-card rounded-[1.2rem] p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">연속 기록</p>
                          <p className="font-aggro-display mt-2 text-lg font-black tracking-[-0.03em] text-[#14295F]">{kpi.maxStreak}일</p>
                          <p className="mt-1 text-sm font-semibold text-[#5c6e97]">루틴 유지 최고 기록</p>
                        </div>
                        <div className="analysis-growth-light-card analysis-growth-light-card--accent rounded-[1.2rem] p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C86A10]">추천 루틴</p>
                          <p className="font-aggro-display mt-2 text-lg font-black tracking-[-0.03em] text-[#14295F]">오전 8시 루틴</p>
                          <p className="mt-1 text-sm font-semibold text-[#37507F]">잘 이어지는 시간대를 3일 연속 고정해보세요.</p>
                        </div>
                        <div className={cn('analysis-growth-light-card rounded-[1.2rem] p-4', !isMobile && 'col-span-2')}>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">코치 해석</p>
                          <p className={cn('font-aggro-display mt-2 break-keep font-black tracking-[-0.03em] text-[#14295F]', isMobile ? 'text-[1rem] leading-6' : 'text-lg leading-7')}>{chartData.some((item) => item.totalMinutes === 0) ? '공백 복구가 먼저예요' : '리듬이 안정되고 있어요'}</p>
                          <p className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">{insight.improve}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
                      <div className="analysis-growth-light-card rounded-[1.2rem] p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">현재 상태</p>
                        <p className={cn('font-aggro-display mt-2 break-keep font-black tracking-[-0.03em] text-[#14295F]', isMobile ? 'text-[1rem] leading-6' : 'text-lg leading-7')}>{sessionMetrics.total >= 10 ? '시간대 비교가 가능해요' : '기본 흐름을 먼저 보는 단계예요'}</p>
                        <p className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">
                          {sessionMetrics.total >= 10
                            ? '오전과 오후 중 어디서 더 오래 버티는지 함께 보고 있어요.'
                            : '세션이 더 쌓일수록 오전/오후 효율 판단이 더 선명해져요.'}
                        </p>
                      </div>
                      <div className="analysis-growth-light-card rounded-[1.2rem] p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">수집된 세션</p>
                        <p className="font-aggro-display mt-2 text-lg font-black tracking-[-0.03em] text-[#14295F]">{sessionMetrics.total}회</p>
                        <p className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">최근 14일 기준 평균 {minutesToLabel(sessionMetrics.avgDurationMinutes)} 세션</p>
                      </div>
                      <div className="analysis-growth-light-card analysis-growth-light-card--accent rounded-[1.2rem] p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C86A10]">코치 메모</p>
                        <p className={cn('font-aggro-display mt-2 break-keep font-black tracking-[-0.03em] text-[#14295F]', isMobile ? 'text-[1rem] leading-6' : 'text-lg leading-7')}>
                          {sessionMetrics.total >= 10 ? '집중이 잘 되는 시간대를 붙잡아보세요' : '지금은 꾸준히 기록을 쌓는 게 먼저예요'}
                        </p>
                        <p className="mt-1 text-sm font-semibold leading-6 text-[#37507F]">
                          {sessionMetrics.total >= 10
                            ? '잘 되는 시간대를 계획트랙 첫 블록에 고정하면 흐름이 더 안정돼요.'
                            : '시간대 판단은 나중에 더 정확해지니, 우선 공부 시작 시간을 일정하게 맞춰보세요.'}
                        </p>
                      </div>
                    </div>
                  )}
                </GrowthDetailAccordionItem>
              ))}
              </Accordion>
            </div>
          </section>

        </TabsContent>

        <TabsContent value="full" className="mt-0">
          <div className={cn(
            'analysis-shell analysis-full-frame overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(20,40,92,0.98)_0%,rgba(10,23,56,0.98)_100%)] shadow-[0_28px_60px_-40px_rgba(2,8,24,0.68)]',
            isMobile ? 'px-3 py-3' : 'px-4 py-4'
          )}>
            <StudentDetailPresentationProvider value="student-analysis">
              <StudentDetailPage params={selfParams} />
            </StudentDetailPresentationProvider>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
