'use client';

import { useEffect, useId, useMemo, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import {
  Bell,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Send,
  Sparkles,
  TrendingUp,
  Activity,
  History,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  PieChart as PieChartIcon,
  BarChart3,
  Flame,
  Info,
  Maximize2,
  FileText,
  Clock,
  Zap,
  Coffee,
  AlertTriangle,
  UserCheck,
  Home,
  AlertCircle,
  CalendarX,
  MapPin,
  CalendarDays,
  Loader2,
  CreditCard,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  ComposedChart,
  Area,
} from 'recharts';
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { 
  format, 
  subDays, 
  isAfter, 
  parse, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths 
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { useAppContext } from '@/contexts/app-context';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  type ParentPortalTab,
  type ParentQuickRequestKey,
  type ParentNotificationItem,
} from '@/lib/parent-dashboard-model';
import {
  type AttendanceCurrent,
  type AttendanceRequest,
  type DailyReport,
  type GrowthProgress,
  type Invoice,
  type PenaltyLog,
  type ParentActivityEvent,
  type StudyLogDay,
  type StudySession,
  type StudyPlanItem,
  type StudentProfile,
} from '@/lib/types';
import { ROUTINE_MISSING_PENALTY_POINTS } from '@/lib/attendance-auto';
import {
  buildAwayTimeInsight,
  buildRhythmInsight,
  buildStartEndInsight,
  buildWeeklyStudyInsight,
} from '@/lib/learning-insights';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent } from '../ui/tabs';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { VisualReportViewer } from './visual-report-viewer';

function toHm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간\u00A0${m}분`;
}

function toClockLabel(totalMinutes: number) {
  const safe = Math.max(0, Math.min(24 * 60, Math.round(totalMinutes)));
  const hours = Math.floor(safe / 60).toString().padStart(2, '0');
  const minutes = (safe % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function calculateRhythmScore(minutes: number[]): number {
  if (!minutes.length) return 0;
  const safeMinutes = minutes.map((value) => Math.max(0, Math.round(value)));
  const avg = safeMinutes.reduce((acc, value) => acc + value, 0) / safeMinutes.length;
  if (avg <= 0) return 0;
  const variance = safeMinutes.reduce((acc, value) => acc + (value - avg) ** 2, 0) / safeMinutes.length;
  const std = Math.sqrt(variance);
  return Math.max(0, Math.min(100, Math.round(100 - (std / avg) * 100)));
}

function toKoreanSubjectLabel(raw: string): string {
  const source = (raw || '').trim();
  if (!source) return '기타';
  const key = source.toLowerCase();

  if (key === 'math' || key.includes('수학')) return '수학';
  if (key === 'english' || key.includes('영어')) return '영어';
  if (key === 'korean' || key.includes('국어')) return '국어';
  if (key === 'science' || key.includes('과학')) return '과학';
  if (key === 'social' || key.includes('사회')) return '사회';
  if (key === 'history' || key.includes('한국사') || key.includes('역사')) return '한국사';
  if (key === 'essay' || key.includes('논술')) return '논술';
  if (key === 'coding' || key.includes('코딩')) return '코딩';
  if (key === 'etc' || key.includes('기타')) return '기타';

  return source;
}

type ParentCommunicationRecord = {
  id: string;
  studentId: string;
  parentUid?: string;
  parentName?: string;
  senderRole?: 'parent' | 'student';
  senderUid?: string;
  senderName?: string;
  type: 'consultation' | 'request' | 'suggestion';
  requestCategory?: 'question' | 'request' | 'suggestion';
  title?: string;
  body?: string;
  channel?: 'visit' | 'phone' | 'online' | null;
  status?: string;
  createdAt?: { toDate?: () => Date; toMillis?: () => number };
  updatedAt?: { toDate?: () => Date; toMillis?: () => number };
  replyBody?: string;
  repliedAt?: { toDate?: () => Date };
  repliedByName?: string;
};

type GrowthCelebrationState = {
  increaseRate: number;
  todayMinutes: number;
  previous7DayAverage: number;
};

type LinkedStudentOption = {
  id: string;
  name: string;
};

type ParentMetricTone = 'study' | 'plan' | 'attendance' | 'penalty';
type ParentAnalyticsTone = 'growth' | 'rhythm' | 'window' | 'away';

type ParentSparklinePoint = {
  label: string;
  value: number | null;
};

type ParentMetricToneStyle = {
  card: string;
  orb: string;
  panel: string;
  eyebrow: string;
  badge: string;
  stroke: string;
  fillStart: string;
  fillEnd: string;
  dot: string;
  mutedDot: string;
};

type ParentAnalyticsToneStyle = {
  card: string;
  iconWrap: string;
  icon: string;
  eyebrow: string;
  badge: string;
  chartShell: string;
  insight: string;
};

const PARENT_METRIC_TONE_STYLES: Record<ParentMetricTone, ParentMetricToneStyle> = {
  study: {
    card: 'border-[#d6e3ff] bg-[linear-gradient(180deg,#f7fbff_0%,#ffffff_58%,#eef5ff_100%)] shadow-[0_18px_34px_-24px_rgba(20,41,95,0.30)] ring-1 ring-[#dce8ff]/80',
    orb: 'bg-[#9bbcff]/34',
    panel: 'border-[#d9e6ff] bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(239,245,255,0.92)_100%)]',
    eyebrow: 'text-[#56739f]',
    badge: 'border-[#d4e3ff] bg-white/92 text-[#14295F]',
    stroke: '#204ca3',
    fillStart: 'rgba(44, 102, 210, 0.26)',
    fillEnd: 'rgba(44, 102, 210, 0.02)',
    dot: '#204ca3',
    mutedDot: '#b9cae7',
  },
  plan: {
    card: 'border-[#ffe0bb] bg-[linear-gradient(180deg,#fffaf3_0%,#ffffff_58%,#fff3e7_100%)] shadow-[0_18px_34px_-24px_rgba(210,109,18,0.25)] ring-1 ring-[#ffe3bf]/85',
    orb: 'bg-[#ffc990]/34',
    panel: 'border-[#ffe0bf] bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(255,247,236,0.95)_100%)]',
    eyebrow: 'text-[#c66a13]',
    badge: 'border-[#ffd8ab] bg-white/92 text-[#b45f0d]',
    stroke: '#e27d18',
    fillStart: 'rgba(226, 125, 24, 0.24)',
    fillEnd: 'rgba(226, 125, 24, 0.02)',
    dot: '#e27d18',
    mutedDot: '#e7c49e',
  },
  attendance: {
    card: 'border-[#d8ebf0] bg-[linear-gradient(180deg,#f8fdff_0%,#ffffff_60%,#eef8fb_100%)] shadow-[0_16px_30px_-24px_rgba(26,94,120,0.18)] ring-1 ring-[#d9eef2]/80',
    orb: 'bg-[#8ed3e4]/24',
    panel: 'border-[#d6eaef] bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(239,249,252,0.94)_100%)]',
    eyebrow: 'text-[#477281]',
    badge: 'border-[#d4eaef] bg-white/90 text-[#245565]',
    stroke: '#1b728d',
    fillStart: 'rgba(27, 114, 141, 0.18)',
    fillEnd: 'rgba(27, 114, 141, 0.02)',
    dot: '#1b728d',
    mutedDot: '#b9d7df',
  },
  penalty: {
    card: 'border-[#ffd9df] bg-[linear-gradient(180deg,#fff9fa_0%,#ffffff_58%,#fff0f3_100%)] shadow-[0_18px_34px_-24px_rgba(225,29,72,0.18)] ring-1 ring-[#ffe3e7]/85',
    orb: 'bg-[#ffb0bf]/26',
    panel: 'border-[#ffd8df] bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(255,242,245,0.95)_100%)]',
    eyebrow: 'text-[#d24664]',
    badge: 'border-[#ffd4dc] bg-white/92 text-[#c33453]',
    stroke: '#d24664',
    fillStart: 'rgba(210, 70, 100, 0.18)',
    fillEnd: 'rgba(210, 70, 100, 0.02)',
    dot: '#d24664',
    mutedDot: '#e7bbc7',
  },
};

const PARENT_ANALYTICS_TONE_STYLES: Record<ParentAnalyticsTone, ParentAnalyticsToneStyle> = {
  growth: {
    card: 'border-[#d9e6ff] bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_55%,#edf5ff_100%)] shadow-[0_20px_40px_-28px_rgba(20,41,95,0.30)]',
    iconWrap: 'border-[#d6e4ff] bg-white/90',
    icon: 'text-[#204ca3]',
    eyebrow: 'text-[#5d79a5]',
    badge: 'border-[#cae4df] bg-[#ecfbf6] text-[#0f8a72]',
    chartShell: 'border-[#dbe7ff] bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(237,245,255,0.94)_100%)]',
    insight: 'border-[#dce8ff] bg-white/86 text-[#39537d]',
  },
  rhythm: {
    card: 'border-[#d8f1eb] bg-[linear-gradient(180deg,#f7fffc_0%,#ffffff_56%,#eefcf7_100%)] shadow-[0_20px_40px_-28px_rgba(16,185,129,0.22)]',
    iconWrap: 'border-[#d6f0e6] bg-white/90',
    icon: 'text-[#11967a]',
    eyebrow: 'text-[#4b7b70]',
    badge: 'border-[#caefe3] bg-[#ecfbf5] text-[#15836b]',
    chartShell: 'border-[#d6f0e6] bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(236,251,245,0.96)_100%)]',
    insight: 'border-[#d7f0e7] bg-white/86 text-[#35695e]',
  },
  window: {
    card: 'border-[#dce4ff] bg-[linear-gradient(180deg,#fafbff_0%,#ffffff_56%,#f1f4ff_100%)] shadow-[0_20px_40px_-28px_rgba(85,99,255,0.20)]',
    iconWrap: 'border-[#dce5ff] bg-white/90',
    icon: 'text-[#5363ff]',
    eyebrow: 'text-[#66719a]',
    badge: 'border-[#e1ddff] bg-[#f5f2ff] text-[#6c52d9]',
    chartShell: 'border-[#dde4ff] bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(241,244,255,0.96)_100%)]',
    insight: 'border-[#e1e6ff] bg-white/86 text-[#475587]',
  },
  away: {
    card: 'border-[#ffdbe2] bg-[linear-gradient(180deg,#fffafc_0%,#ffffff_56%,#fff1f4_100%)] shadow-[0_20px_40px_-28px_rgba(225,29,72,0.18)]',
    iconWrap: 'border-[#ffdbe2] bg-white/90',
    icon: 'text-[#d53f64]',
    eyebrow: 'text-[#b45a6f]',
    badge: 'border-[#ffd5de] bg-[#fff1f4] text-[#c73a5d]',
    chartShell: 'border-[#ffe0e7] bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(255,241,244,0.96)_100%)]',
    insight: 'border-[#ffe2e8] bg-white/86 text-[#8a4b5a]',
  },
};

const PARENT_PORTAL_TABS: ParentPortalTab[] = ['home', 'studyDetail', 'data', 'communication', 'billing'];
const PARENT_POST_LOGIN_ENTRY_MOTION_KEY = 'track-parent-dashboard-entry';
const PARENT_POST_LOGIN_ENTRY_MAX_AGE_MS = 15000;

function normalizeParentPortalTab(value: string | null): ParentPortalTab {
  if (value === 'life') return 'data';
  if (value === 'reports') return 'home';
  if (value && PARENT_PORTAL_TABS.includes(value as ParentPortalTab)) {
    return value as ParentPortalTab;
  }
  return 'home';
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setPrefersReducedMotion(mediaQuery.matches);
    sync();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', sync);
      return () => mediaQuery.removeEventListener('change', sync);
    }

    mediaQuery.addListener(sync);
    return () => mediaQuery.removeListener(sync);
  }, []);

  return prefersReducedMotion;
}

function formatSignedMinutes(deltaMinutes: number) {
  if (deltaMinutes === 0) return '변동 없음';
  return `${deltaMinutes > 0 ? '+' : '-'}${toHm(Math.abs(deltaMinutes))}`;
}

function buildParentSparklineGeometry(values: Array<number | null>, width: number, height: number) {
  const paddingX = 8;
  const paddingY = 8;
  const validValues = values.filter((value): value is number => typeof value === 'number');
  const stepX = values.length > 1 ? (width - paddingX * 2) / (values.length - 1) : 0;

  if (validValues.length === 0) {
    return {
      hasValue: false,
      linePath: '',
      areaPaths: [] as string[],
      pathLength: 0,
      points: values.map((value, index) => ({
        x: paddingX + stepX * index,
        y: height / 2,
        value,
      })),
    };
  }

  const minValue = Math.min(...validValues);
  const maxValue = Math.max(...validValues);
  const normalizedMin = minValue === maxValue ? Math.max(0, minValue - 1) : minValue;
  const normalizedMax = minValue === maxValue ? maxValue + 1 : maxValue;
  const innerHeight = height - paddingY * 2;

  const points = values.map((value, index) => {
    const x = paddingX + stepX * index;
    if (value === null) {
      return { x, y: height - paddingY, value };
    }

    const progress = (value - normalizedMin) / Math.max(normalizedMax - normalizedMin, 1);
    return {
      x,
      y: height - paddingY - progress * innerHeight,
      value,
    };
  });

  const lineSegments: string[] = [];
  const areaPaths: string[] = [];
  let currentSegment: Array<{ x: number; y: number }> = [];
  let pathLength = 0;

  const flushSegment = () => {
    if (currentSegment.length === 0) return;

    const linePath = currentSegment
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');
    lineSegments.push(linePath);

    if (currentSegment.length >= 2) {
      const firstPoint = currentSegment[0];
      const lastPoint = currentSegment[currentSegment.length - 1];
      areaPaths.push(
        `${linePath} L ${lastPoint.x.toFixed(2)} ${(height - paddingY).toFixed(2)} L ${firstPoint.x.toFixed(2)} ${(height - paddingY).toFixed(2)} Z`
      );
    }

    currentSegment = [];
  };

  points.forEach((point) => {
    if (point.value === null) {
      flushSegment();
      return;
    }

    if (currentSegment.length > 0) {
      const previousPoint = currentSegment[currentSegment.length - 1];
      pathLength += Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y);
    }

    currentSegment.push({ x: point.x, y: point.y });
  });
  flushSegment();

  return {
    hasValue: true,
    linePath: lineSegments.join(' '),
    areaPaths,
    pathLength: Math.max(pathLength, 1),
    points,
  };
}

function ParentMetricCardShell({
  tone,
  className,
  children,
  interactive = false,
  ...props
}: ComponentPropsWithoutRef<typeof Card> & {
  tone: ParentMetricTone;
  children: ReactNode;
  interactive?: boolean;
}) {
  const toneStyle = PARENT_METRIC_TONE_STYLES[tone];

  return (
    <Card
      {...props}
      className={cn(
        'group relative min-w-0 overflow-hidden rounded-[1.65rem] border p-4 transition-[transform,box-shadow,background] duration-200 active:scale-[0.985] md:hover:-translate-y-0.5 sm:p-5',
        toneStyle.card,
        interactive && 'cursor-pointer',
        className
      )}
    >
      <div className={cn('pointer-events-none absolute -right-10 top-0 h-24 w-24 rounded-full blur-3xl', toneStyle.orb)} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.52)_0%,rgba(255,255,255,0)_44%)]" />
      <div className="relative z-10 h-full">{children}</div>
    </Card>
  );
}

function ParentAnalyticsCard({
  tone,
  icon,
  title,
  description,
  badge,
  insight,
  className,
  children,
}: {
  tone: ParentAnalyticsTone;
  icon: ReactNode;
  title: string;
  description: string;
  badge: string;
  insight: string;
  className?: string;
  children: ReactNode;
}) {
  const toneStyle = PARENT_ANALYTICS_TONE_STYLES[tone];

  return (
    <Card className={cn('relative min-w-0 overflow-hidden rounded-[2rem] border p-5 shadow-sm transition-[transform,box-shadow] duration-200 active:scale-[0.992] sm:p-6', toneStyle.card, className)}>
      <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-white/50 blur-3xl" />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]', toneStyle.iconWrap, toneStyle.icon)}>
              {icon}
            </div>
            <div className="min-w-0">
              <p className={cn('text-[10px] font-black uppercase tracking-[0.18em]', toneStyle.eyebrow)}>Parent Analytics</p>
              <h3 className="mt-1 text-[1.02rem] font-black tracking-tight text-[#14295F]">{title}</h3>
              <p className="mt-1 break-keep text-[12px] font-bold leading-[1.6] text-slate-500 sm:text-[12.5px]">
                {description}
              </p>
            </div>
          </div>
          <span className={cn('shrink-0 rounded-full border px-3 py-1 text-[10px] font-black tracking-tight shadow-sm', toneStyle.badge)}>
            {badge}
          </span>
        </div>
        <div className={cn('mt-4 overflow-hidden rounded-[1.45rem] border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] sm:p-4', toneStyle.chartShell)}>
          {children}
        </div>
        <div className={cn('mt-4 rounded-[1.2rem] border px-3.5 py-3 text-[11px] font-bold leading-relaxed sm:text-[11.5px]', toneStyle.insight)}>
          {insight}
        </div>
      </div>
    </Card>
  );
}

function ParentMetricSparkline({
  tone,
  points,
  label,
  valueLabel,
  className,
  showArea = true,
}: {
  tone: ParentMetricTone;
  points: ParentSparklinePoint[];
  label: string;
  valueLabel: string;
  className?: string;
  showArea?: boolean;
}) {
  const toneStyle = PARENT_METRIC_TONE_STYLES[tone];
  const gradientId = useId().replace(/:/g, '');
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isDrawn, setIsDrawn] = useState(prefersReducedMotion);
  const width = 126;
  const height = 70;
  const valuesKey = useMemo(
    () => points.map((point) => `${point.label}:${point.value ?? 'null'}`).join('|'),
    [points]
  );
  const geometry = useMemo(
    () => buildParentSparklineGeometry(points.map((point) => point.value), width, height),
    [points]
  );

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsDrawn(true);
      return;
    }

    setIsDrawn(false);
    const frameId = window.requestAnimationFrame(() => setIsDrawn(true));
    return () => window.cancelAnimationFrame(frameId);
  }, [prefersReducedMotion, valuesKey]);

  return (
    <div className={cn('rounded-[1.15rem] border p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)] sm:p-2.5', toneStyle.panel, className)}>
      <div className="mb-1.5 flex flex-col items-start gap-0.5 sm:mb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <span className={cn('text-[8px] font-black uppercase tracking-[0.16em] sm:text-[9px] sm:tracking-[0.18em]', toneStyle.eyebrow)}>{label}</span>
        <span className="text-[9px] font-black text-slate-500 sm:text-[10px]">{valueLabel}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-[3.6rem] w-full overflow-visible sm:h-[4.25rem]">
        <defs>
          <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={toneStyle.fillStart} />
            <stop offset="100%" stopColor={toneStyle.fillEnd} />
          </linearGradient>
        </defs>

        <path d={`M 8 ${(height - 9).toFixed(2)} L ${(width - 8).toFixed(2)} ${(height - 9).toFixed(2)}`} stroke="rgba(148,163,184,0.18)" strokeWidth="1" strokeDasharray="3 4" fill="none" />
        <path d={`M 8 ${(height / 2).toFixed(2)} L ${(width - 8).toFixed(2)} ${(height / 2).toFixed(2)}`} stroke="rgba(148,163,184,0.10)" strokeWidth="1" strokeDasharray="2 5" fill="none" />

        {geometry.hasValue && showArea
          ? geometry.areaPaths.map((pathValue, index) => (
              <path
                key={`${gradientId}-area-${index}`}
                d={pathValue}
                fill={`url(#${gradientId}-fill)`}
                opacity={isDrawn ? 1 : 0}
                style={{
                  transition: prefersReducedMotion ? 'none' : 'opacity 500ms ease 140ms',
                }}
              />
            ))
          : null}

        {geometry.hasValue ? (
          <path
            d={geometry.linePath}
            fill="none"
            stroke={toneStyle.stroke}
              strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: geometry.pathLength,
              strokeDashoffset: isDrawn ? 0 : geometry.pathLength,
              opacity: isDrawn ? 1 : 0.7,
              transition: prefersReducedMotion
                ? 'none'
                : 'stroke-dashoffset 720ms cubic-bezier(0.2, 0.85, 0.24, 1), opacity 220ms ease',
            }}
          />
        ) : (
          <path d={`M 8 ${(height * 0.63).toFixed(2)} C 32 ${(height * 0.54).toFixed(2)}, 54 ${(height * 0.66).toFixed(2)}, 76 ${(height * 0.58).toFixed(2)} S 104 ${(height * 0.56).toFixed(2)}, ${(width - 8).toFixed(2)} ${(height * 0.61).toFixed(2)}`} stroke="rgba(148,163,184,0.34)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 5" fill="none" />
        )}

        {geometry.points.map((point, index) => (
          <circle
            key={`${gradientId}-point-${index}`}
            cx={point.x}
            cy={point.value === null ? height - 9 : point.y}
            r={point.value === null ? 2.4 : 2.8}
            fill={point.value === null ? toneStyle.mutedDot : toneStyle.dot}
            opacity={point.value === null ? 0.65 : 0.95}
          />
        ))}
      </svg>
    </div>
  );
}

function ParentDurationValue({
  minutes,
  className,
  unitClassName,
}: {
  minutes: number;
  className?: string;
  unitClassName?: string;
}) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainMinutes = safeMinutes % 60;

  return (
    <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
      {hours > 0 && (
        <span className="inline-flex items-end gap-1 whitespace-nowrap">
          <span className={cn('dashboard-number text-[1.85rem] leading-none tracking-[-0.04em] text-[#14295F]', className)}>
            {hours}
          </span>
          <span className={cn('pb-0.5 text-[10px] font-black text-slate-400 sm:pb-1 sm:text-[11px]', unitClassName)}>시간</span>
        </span>
      )}
      {(remainMinutes > 0 || hours === 0) && (
        <span className="inline-flex items-end gap-1 whitespace-nowrap">
          <span className={cn('dashboard-number text-[1.85rem] leading-none tracking-[-0.04em] text-[#14295F]', className)}>
            {remainMinutes}
          </span>
          <span className={cn('pb-0.5 text-[10px] font-black text-slate-400 sm:pb-1 sm:text-[11px]', unitClassName)}>분</span>
        </span>
      )}
    </div>
  );
}

function ParentStatValue({
  value,
  unit,
  className,
  unitClassName,
}: {
  value: string | number;
  unit?: string;
  className?: string;
  unitClassName?: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-1.5">
      <span className={cn('dashboard-number text-[1.9rem] leading-none tracking-[-0.04em] text-[#14295F]', className)}>
        {value}
      </span>
      {unit ? <span className={cn('pb-0.5 text-[10px] font-black text-slate-400 sm:pb-1 sm:text-[11px]', unitClassName)}>{unit}</span> : null}
    </div>
  );
}

function ParentGrowthCelebration({
  celebration,
  studentName,
  onClose,
}: {
  celebration: GrowthCelebrationState;
  studentName: string;
  onClose: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[70] flex justify-center px-4 sm:px-6">
      <div className="fade-up-pop pointer-events-auto relative w-full max-w-md overflow-hidden rounded-[1.85rem] border border-[#ffd5a7] bg-[linear-gradient(145deg,rgba(255,255,255,0.98)_0%,rgba(255,244,231,0.98)_55%,rgba(238,244,255,0.98)_100%)] p-4 shadow-[0_18px_36px_rgba(20,41,95,0.18)] backdrop-blur-xl">
        <div className="soft-glow absolute -right-6 top-2 h-24 w-24 rounded-full bg-[#FFB46D]/40 blur-3xl" />
        <div className="soft-glow absolute -left-8 bottom-0 h-20 w-20 rounded-full bg-[#9fc0ff]/35 blur-3xl" />
        <Sparkles className="float-spark absolute right-5 top-5 h-4 w-4 text-[#FF7A16]" />

        <div className="relative z-10 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#14295F] text-white shadow-[0_10px_20px_rgba(20,41,95,0.22)]">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FF7A16]">Growth Update</p>
                <h3 className="mt-1 text-lg font-black tracking-tight text-[#14295F]">
                  {studentName} 학생의 오늘 흐름이 좋아졌어요
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[#14295F]/10 bg-white/85 p-1.5 text-[#14295F] shadow-sm transition-colors hover:bg-white"
                aria-label="성장 알림 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-sm font-bold leading-relaxed text-slate-600">
              우리 아이 공부가 최근 7일 평균보다{' '}
              <span className="font-black text-[#FF7A16]">{celebration.increaseRate}%</span> 증가했어요.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline" className="h-7 rounded-full border border-[#ffd4aa] bg-white/90 px-3 text-[11px] font-black text-[#14295F]">
                오늘 {toHm(celebration.todayMinutes)}
              </Badge>
              <Badge variant="outline" className="h-7 rounded-full border border-[#d5e3ff] bg-[#eef4ff] px-3 text-[11px] font-black text-[#14295F]">
                최근 평균 {toHm(celebration.previous7DayAverage)}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RhythmTimeChartDialog({
  trend,
  hasTrend,
  yAxisDomain,
  rhythmScoreTrend,
  rhythmScore,
}: {
  trend: Array<{ date: string; rhythmMinutes: number | null }>;
  hasTrend: boolean;
  yAxisDomain: [number, number];
  rhythmScoreTrend: Array<{ date: string; score: number }>;
  rhythmScore: number;
}) {
  const latestRhythm = trend.slice().reverse().find((item) => typeof item.rhythmMinutes === 'number');
  const rhythmPreviewBars = rhythmScoreTrend.slice(-6);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="group relative overflow-hidden rounded-[1.9rem] border border-[#dce6f8] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_46%,#eef4ff_100%)] p-5 shadow-[0_24px_48px_-34px_rgba(20,41,95,0.24)] transition-[transform,box-shadow] duration-200 cursor-pointer active:scale-[0.99] md:hover:-translate-y-0.5 md:hover:shadow-[0_28px_60px_-34px_rgba(20,41,95,0.28)] sm:p-6">
          <div className="pointer-events-none absolute -right-10 top-0 h-28 w-28 rounded-full bg-[#ffd3a8]/35 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0)_42%)]" />
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.15rem] border border-[#e4edff] bg-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_12px_24px_-20px_rgba(20,41,95,0.18)]">
                  <TrendingUp className="h-4.5 w-4.5 text-[#FF7A16]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6d7fa5]">Rhythm Insight</p>
                  <CardTitle className="mt-1 text-[1.02rem] font-black tracking-tight text-[#14295F]">학습 리듬 시간</CardTitle>
                  <p className="mt-1 text-[12px] font-bold leading-[1.55] text-slate-500">
                    시작 흐름과 리듬 점수를 리포트처럼 정리해 빠르게 읽을 수 있어요.
                  </p>
                </div>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d9e4fb] bg-white/92 text-[#7c8fb6] shadow-sm">
                <Maximize2 className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="mt-4 rounded-[1.35rem] border border-[#dfe9fb] bg-white/88 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6d7fa5]">오늘 학습 리듬 점수</p>
                  <div className="mt-2 flex items-end gap-1.5">
                    <span className="dashboard-number text-[2.25rem] leading-none tracking-[-0.05em] text-[#14295F]">
                      {rhythmScore}
                    </span>
                    <span className="pb-1 text-[12px] font-black text-[#6d7fa5]">점</span>
                  </div>
                </div>
                <Badge variant="outline" className="h-7 rounded-full border border-[#d8e5ff] bg-[#eef4ff] px-3 text-[10px] font-black text-[#14295F]">
                  최근 시작 {latestRhythm?.rhythmMinutes ? toClockLabel(latestRhythm.rhythmMinutes) : '기록 대기'}
                </Badge>
              </div>

              <div className="mt-4 flex items-end gap-1.5">
                {(rhythmPreviewBars.length > 0 ? rhythmPreviewBars : [{ date: '대기', score: 0 }]).map((point, index, array) => {
                  const safeScore = Math.max(6, Math.round((Number(point.score || 0) / 100) * 44));
                  const isLatest = index === array.length - 1;
                  return (
                    <div key={`${point.date}-${index}`} className="flex-1">
                      <div
                        className={cn(
                          'w-full rounded-full transition-all duration-200',
                          isLatest
                            ? 'bg-[linear-gradient(180deg,#14295F_0%,#FF7A16_100%)] shadow-[0_14px_20px_-16px_rgba(20,41,95,0.4)]'
                            : 'bg-[linear-gradient(180deg,#d8e5ff_0%,#b8c9ef_100%)]'
                        )}
                        style={{ height: `${safeScore}px` }}
                      />
                    </div>
                  );
                })}
              </div>

              <p className="mt-4 text-[11px] font-bold leading-5 text-slate-500">
                카드를 누르면 최근 14일 리듬 그래프와 점수 추이를 자세히 볼 수 있어요.
              </p>
            </div>
          </div>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] rounded-[2rem] border border-slate-200 p-0 overflow-hidden sm:max-w-3xl">
        <div className="bg-[#14295F] p-6 text-white sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">학습 리듬 시간</DialogTitle>
            <DialogDescription className="text-white/70 font-bold">
              최근 14일 기준 첫 공부 세션 시작 시각입니다.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-5 bg-white p-5 sm:p-8">
          <div className="h-[320px] w-full">
            {hasTrend ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={trend} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf5" />
                  <XAxis dataKey="date" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    domain={yAxisDomain}
                    tickFormatter={(value) => toClockLabel(Number(value))}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '1rem', border: '1px solid #e5e7eb' }}
                    formatter={(value) =>
                      typeof value === 'number'
                        ? [toClockLabel(value), '학습 시작']
                        : ['기록 없음', '학습 시작']
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="rhythmMinutes"
                    stroke="#14295F"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#FF7A16', stroke: '#14295F', strokeWidth: 1 }}
                    activeDot={{ r: 6, fill: '#FF7A16', stroke: '#14295F', strokeWidth: 2 }}
                    connectNulls={false}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm font-bold text-slate-400">
                최근 학습 시작 기록이 없습니다.
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-[#14295F]">리듬 점수 그래프</h4>
              <Badge variant="outline" className="font-black text-[10px]">
                평균 {rhythmScore}점
              </Badge>
            </div>
            <div className="h-[220px] w-full rounded-2xl border border-slate-100 bg-slate-50/40 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={rhythmScoreTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf5" />
                  <XAxis dataKey="date" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis fontSize={11} axisLine={false} tickLine={false} width={30} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ borderRadius: '1rem', border: '1px solid #e5e7eb' }}
                    formatter={(value) => [`${Number(value || 0)}점`, '리듬 점수']}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#FF7A16"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#14295F' }}
                    activeDot={{ r: 5, fill: '#14295F' }}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {trend.map((point) => (
              <div key={point.date} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{point.date}</p>
                <p className="mt-1 text-base font-black text-slate-800">
                  {typeof point.rhythmMinutes === 'number' ? toClockLabel(point.rhythmMinutes) : '기록 없음'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SubjectStudyChartDialog({
  subjects,
  subjectTotalMinutes,
}: {
  subjects: Array<{ subject: string; minutes: number; color: string }>;
  subjectTotalMinutes: number;
}) {
  const previewData = subjects.slice(0, 5);
  const topSubject = subjects[0];
  const topSubjectRatio = topSubject ? Math.round((topSubject.minutes / Math.max(subjectTotalMinutes, 1)) * 100) : 0;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="group relative overflow-hidden rounded-[1.9rem] border border-[#dbe7fb] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_46%,#eef4ff_100%)] p-5 shadow-[0_24px_48px_-34px_rgba(20,41,95,0.22)] transition-[transform,box-shadow] duration-200 cursor-pointer active:scale-[0.99] md:hover:-translate-y-0.5 md:hover:shadow-[0_28px_60px_-34px_rgba(20,41,95,0.28)] sm:p-6">
          <div className="pointer-events-none absolute -right-10 top-0 h-28 w-28 rounded-full bg-[#bad3ff]/30 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0)_42%)]" />
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.15rem] border border-[#dfe9ff] bg-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_12px_24px_-20px_rgba(20,41,95,0.18)]">
                  <BarChart3 className="h-4.5 w-4.5 text-[#14295F]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6d7fa5]">Subject Insight</p>
                  <CardTitle className="mt-1 text-[1.02rem] font-black tracking-tight text-[#14295F]">과목별 학습시간</CardTitle>
                  <p className="mt-1 text-[12px] font-bold leading-[1.55] text-slate-500">
                    어떤 과목에 시간이 가장 많이 배분됐는지 핵심 KPI 중심으로 보여드립니다.
                  </p>
                </div>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d9e4fb] bg-white/92 text-[#7c8fb6] shadow-sm">
                <Maximize2 className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="mt-4 rounded-[1.35rem] border border-[#dfe8fb] bg-white/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6d7fa5]">현재 1위 과목</p>
                  <p className="mt-2 break-keep text-[1.3rem] font-black tracking-tight text-[#14295F]">
                    {topSubject?.subject || '기록 대기'}
                  </p>
                </div>
                <Badge variant="outline" className="h-7 rounded-full border border-[#d8e5ff] bg-[#eef4ff] px-3 text-[10px] font-black text-[#14295F]">
                  총 {toHm(subjectTotalMinutes)}
                </Badge>
              </div>

              <div className="mt-4 grid gap-2.5">
                {previewData.slice(0, 3).map((item) => {
                  const ratio = Math.round((item.minutes / Math.max(subjectTotalMinutes, 1)) * 100);
                  return (
                    <div key={item.subject} className="grid gap-1">
                      <div className="flex items-center justify-between gap-2 text-[10px] font-black text-slate-500">
                        <span className="flex min-w-0 items-center gap-2 text-[#14295F]">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="truncate">{item.subject}</span>
                        </span>
                        <span>{ratio}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#e8eefb]">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#14295F_0%,#7ba7ff_100%)]"
                          style={{ width: `${Math.max(8, ratio)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-4 text-[11px] font-bold leading-5 text-slate-500">
                {topSubject
                  ? `${topSubject.subject} 비중이 현재 ${topSubjectRatio}%로 가장 높습니다.`
                  : '카드를 누르면 과목별 학습 그래프를 확인할 수 있어요.'}
              </p>
            </div>
          </div>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] rounded-[2rem] border border-slate-200 p-0 overflow-hidden sm:max-w-3xl">
        <div className="bg-[#FF7A16] p-6 text-white sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">과목별 학습시간</DialogTitle>
            <DialogDescription className="text-white/80 font-bold">
              이번 주 계획 기준 과목별 학습 배분입니다.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-5 bg-white p-5 sm:p-8">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">총 공부시간</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{toHm(subjectTotalMinutes)}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">과목 수</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{subjects.length}개</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">최다 비중</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{subjects[0]?.subject || '-'}</p>
            </div>
          </div>
          <div className="h-[320px] w-full">
            {previewData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={previewData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf5" />
                  <XAxis dataKey="subject" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis fontSize={11} axisLine={false} tickLine={false} width={36} />
                  <Tooltip
                    contentStyle={{ borderRadius: '1rem', border: '1px solid #e5e7eb' }}
                    formatter={(value) => [`${Number(value || 0)}분`, '학습시간']}
                  />
                  <Bar dataKey="minutes" radius={[10, 10, 0, 0]} fill="#FF7A16" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm font-bold text-slate-400">
                과목별 학습 계획이 없습니다.
              </div>
            )}
          </div>
          <div className="grid gap-2">
            {subjects.map((item) => {
              const ratio = Math.round((item.minutes / Math.max(subjectTotalMinutes, 1)) * 100);
              return (
                <div key={item.subject} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm font-black text-slate-800">{item.subject}</span>
                    </div>
                    <span className="text-sm font-black text-slate-500">{item.minutes}분</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(6, ratio)}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

function formatAttendanceTimeLabel(value: Date | null, emptyLabel = '미기록') {
  if (!value || Number.isNaN(value.getTime())) return emptyLabel;
  return format(value, 'HH:mm');
}

const PARENT_CALENDAR_LEGEND = [
  { label: '기록 없음', swatch: 'from-white via-slate-50 to-slate-100 ring-slate-200/90' },
  { label: '짧은 몰입', swatch: 'from-white via-emerald-100 to-emerald-200 ring-emerald-300/90' },
  { label: '집중 흐름', swatch: 'from-white via-teal-100 to-cyan-200 ring-teal-300/90' },
  { label: '깊은 몰입', swatch: 'from-white via-sky-100 to-indigo-200 ring-blue-300/90' },
] as const;

function formatWon(value: number) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  return `₩${safe.toLocaleString()}`;
}

function minutesToAxisLabel(value: number) {
  const safeMinutes = Math.max(0, Math.round(Number(value || 0)));
  if (safeMinutes >= 60) {
    const hourValue = safeMinutes / 60;
    return `${Number.isInteger(hourValue) ? hourValue : hourValue.toFixed(1)}h`;
  }
  return `${safeMinutes}m`;
}

function dateToHourNumber(date: Date | null) {
  if (!date) return null;
  return Number((date.getHours() + date.getMinutes() / 60).toFixed(2));
}

function hourToClockLabel(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '00:00';
  return toClockLabel(Math.round(value * 60));
}

function toSignedPercentLabel(value: number) {
  const safeValue = Math.round(Number(value || 0));
  return `${safeValue > 0 ? '+' : ''}${safeValue}%`;
}

type InvoiceStatusMeta = {
  label: string;
  mobileLabel: string;
  className: string;
};

function getInvoiceStatusMeta(status: Invoice['status']): InvoiceStatusMeta | null {
  if (status === 'paid') {
    return {
      label: '수납 완료',
      mobileLabel: '완납',
      className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    };
  }
  if (status === 'overdue') {
    return {
      label: '미납',
      mobileLabel: '미납',
      className: 'bg-rose-100 text-rose-700 border-rose-200',
    };
  }
  if (status === 'issued') {
    return {
      label: '청구',
      mobileLabel: '미납',
      className: 'bg-amber-100 text-amber-700 border-amber-200',
    };
  }
  return null;
}

function getInvoiceTrackLabel(category?: Invoice['trackCategory']) {
  if (category === 'academy') return '학원 수납';
  if (category === 'studyRoom') return '독서실 수납';
  return '센터 수납';
}

const QUICK_REQUEST_TEMPLATES: Record<ParentQuickRequestKey, string> = {
  math_support: '수학 집중 관리 요청',
  english_support: '영어 보완 요청',
  habit_coaching: '학습 습관 코칭 요청',
  career_consulting: '진로/진학 상담 요청',
};

const SUBJECT_COLORS = ['#FF7A16', '#14295F', '#10B981', '#0EA5E9', '#A855F7'];
const REQUEST_PENALTY_POINTS: Record<'late' | 'absence', number> = { late: 1, absence: 2 };
const PENALTY_RECOVERY_INTERVAL_DAYS = 7;

type TimestampLike = { toDate?: () => Date } | Date | string | null | undefined;

function toDateSafe(value: TimestampLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function toRelativeLabel(value: TimestampLike, now = new Date()) {
  const date = toDateSafe(value);
  if (!date) return '최근';
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return '방금 전';
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}일 전`;
  return format(date, 'MM/dd', { locale: ko });
}

function formatDateLabel(dateText?: string, fallbackTimestamp?: TimestampLike) {
  if (dateText && /^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    const parsed = parse(dateText, 'yyyy-MM-dd', new Date());
    if (!Number.isNaN(parsed.getTime())) {
      return format(parsed, 'MM/dd', { locale: ko });
    }
  }
  const fallbackDate = toDateSafe(fallbackTimestamp);
  if (fallbackDate) {
    return format(fallbackDate, 'MM/dd', { locale: ko });
  }
  return '최근';
}
export function ParentDashboard({ isActive }: { isActive: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { memberships, activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const prefersReducedMotion = usePrefersReducedMotion();

  const isMobile = activeMembership?.role === 'parent' || viewMode === 'mobile';
  const [today, setToday] = useState<Date | null>(null);
  const [tab, setTab] = useState<ParentPortalTab>('home');
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(new Date());

  const [channel, setChannel] = useState<'visit' | 'phone' | 'online'>('visit');
  const [quickType, setQuickType] = useState<ParentQuickRequestKey>('math_support');
  const [requestText, setRequestText] = useState('');
  const [suggestionText, setSuggestionText] = useState('');
  const [parentInquiryType, setParentInquiryType] = useState<'question' | 'request' | 'suggestion'>('question');
  const [parentInquiryTitle, setParentInquiryTitle] = useState('');
  const [parentInquiryBody, setParentInquiryBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [readMap, setReadMap] = useState<Record<string, boolean>>({});
  const [selectedNotification, setSelectedNotification] = useState<ParentNotificationItem | null>(null);
  const [isReportArchiveOpen, setIsReportArchiveOpen] = useState(false);
  const [selectedChildReport, setSelectedChildReport] = useState<DailyReport | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [isPenaltyGuideOpen, setIsPenaltyGuideOpen] = useState(false);
  const [checkInByDateKey, setCheckInByDateKey] = useState<Record<string, Date | null>>({});
  const [checkOutByDateKey, setCheckOutByDateKey] = useState<Record<string, Date | null>>({});
  const [studyStartByDateKey, setStudyStartByDateKey] = useState<Record<string, Date | null>>({});
  const [studyEndByDateKey, setStudyEndByDateKey] = useState<Record<string, Date | null>>({});
  const [awayMinutesByDateKey, setAwayMinutesByDateKey] = useState<Record<string, number>>({});
  const [growthCelebration, setGrowthCelebration] = useState<GrowthCelebrationState | null>(null);
  const [showEntryMotion, setShowEntryMotion] = useState(false);
  const [linkedStudents, setLinkedStudents] = useState<LinkedStudentOption[]>([]);
  const visitLoggedRef = useRef(false);
  const reportReadLoggedRef = useRef<Record<string, boolean>>({});
  const growthCelebrationTimerRef = useRef<number | null>(null);
  const growthCelebrationDismissTimerRef = useRef<number | null>(null);
  const entryMotionTimerRef = useRef<number | null>(null);
  const clearEntryFlagTimerRef = useRef<number | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => setToday(new Date()), []);

  const active센터Membership = useMemo(() => {
    if (activeMembership) {
      return memberships.find((membership) => membership.id === activeMembership.id) || activeMembership;
    }
    return memberships.find((membership) => membership.status === 'active') || memberships[0] || null;
  }, [activeMembership, memberships]);

  const centerId = active센터Membership?.id;
  const linkedStudentIds = useMemo(
    () =>
      (active센터Membership?.linkedStudentIds || []).filter(
        (value): value is string => typeof value === 'string' && value.trim().length > 0
      ),
    [active센터Membership?.linkedStudentIds]
  );
  const linkedStudentIdsKey = linkedStudentIds.join(',');
  const requestedStudentId = searchParams.get('parentStudentId');
  const studentId = useMemo(() => {
    if (linkedStudentIds.length === 0) return undefined;
    if (requestedStudentId && linkedStudentIds.includes(requestedStudentId)) {
      return requestedStudentId;
    }
    return linkedStudentIds[0];
  }, [linkedStudentIds, requestedStudentId]);
  const todayKey = today ? format(today, 'yyyy-MM-dd') : '';
  const yesterdayKey = today ? format(subDays(today, 1), 'yyyy-MM-dd') : '';
  const weekKey = today ? format(today, "yyyy-'W'II") : '';
  const previousRecentWeekKey = useMemo(() => {
    if (!today || !weekKey) return '';
    const recentWeekKeys = Array.from(
      new Set(
        Array.from({ length: 7 }, (_, index) => format(subDays(today, 6 - index), "yyyy-'W'II"))
      )
    );
    return recentWeekKeys.find((candidate) => candidate !== weekKey) || '';
  }, [today, weekKey]);

  useEffect(() => {
    const requestedTab = searchParams.get('parentTab');
    const normalizedTab = normalizeParentPortalTab(requestedTab);
    if (tab !== normalizedTab) {
      setTab(normalizedTab);
    }

    const params = new URLSearchParams(searchParams.toString());
    let shouldReplace = false;

    if (requestedTab !== normalizedTab) {
      params.set('parentTab', normalizedTab);
      shouldReplace = true;
      if (requestedTab === 'reports') {
        setIsReportArchiveOpen(true);
      }
    }

    if (linkedStudentIds.length > 1 && studentId) {
      if (requestedStudentId !== studentId) {
        params.set('parentStudentId', studentId);
        shouldReplace = true;
      }
    } else if (requestedStudentId) {
      params.delete('parentStudentId');
      shouldReplace = true;
    }

    if (shouldReplace) {
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [searchParams, pathname, router, linkedStudentIds.length, requestedStudentId, studentId, tab]);

  useEffect(() => {
    if (!isActive || !firestore || !centerId || linkedStudentIds.length === 0) {
      setLinkedStudents([]);
      return;
    }

    let cancelled = false;

    const loadLinkedStudents = async () => {
      try {
        const records = await Promise.all(
          linkedStudentIds.map(async (id, index) => {
            const snap = await getDoc(doc(firestore, 'centers', centerId, 'students', id));
            const data = snap.data() as StudentProfile | undefined;
            return {
              id,
              name: data?.name?.trim() || `자녀 ${index + 1}`,
            };
          })
        );

        if (!cancelled) {
          setLinkedStudents(records);
        }
      } catch (error) {
        console.warn('[parent-dashboard] failed to load linked students', error);
        if (!cancelled) {
          setLinkedStudents(
            linkedStudentIds.map((id, index) => ({
              id,
              name: `자녀 ${index + 1}`,
            }))
          );
        }
      }
    };

    void loadLinkedStudents();

    return () => {
      cancelled = true;
    };
  }, [isActive, firestore, centerId, linkedStudentIdsKey]);
  const logParentActivity = async (
    eventType: ParentActivityEvent['eventType'],
    metadata?: Record<string, any>
  ) => {
    if (!firestore || !centerId || !studentId || !user) return;

    try {
      await addDoc(collection(firestore, 'centers', centerId, 'parentActivityEvents'), {
        centerId,
        studentId,
        parentUid: user.uid,
        eventType,
        createdAt: serverTimestamp(),
        metadata: metadata || {},
      });
    } catch (error) {
      console.warn('[parent-activity] failed to log event', eventType, error);
    }
  };

  useEffect(() => {
    if (!isActive || !centerId || !studentId || !user || visitLoggedRef.current) return;

    visitLoggedRef.current = true;
    void logParentActivity('app_visit', { source: 'dashboard_open', tab });
  }, [isActive, centerId, studentId, user, tab]);

  useEffect(() => {
    visitLoggedRef.current = false;
    reportReadLoggedRef.current = {};
    setReadMap({});
    setSelectedNotification(null);
    setSelectedChildReport(null);
    setSelectedCalendarDate(null);
    setCheckInByDateKey({});
    setCheckOutByDateKey({});
    setStudyStartByDateKey({});
    setStudyEndByDateKey({});
    setAwayMinutesByDateKey({});
    setGrowthCelebration(null);
    setShowEntryMotion(false);
  }, [studentId]);

  useEffect(() => {
    if (!isActive || typeof window === 'undefined') return;

    if (entryMotionTimerRef.current) {
      window.clearTimeout(entryMotionTimerRef.current);
      entryMotionTimerRef.current = null;
    }
    if (clearEntryFlagTimerRef.current) {
      window.clearTimeout(clearEntryFlagTimerRef.current);
      clearEntryFlagTimerRef.current = null;
    }

    const raw = window.sessionStorage.getItem(PARENT_POST_LOGIN_ENTRY_MOTION_KEY);
    const timestamp = Number(raw);
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > PARENT_POST_LOGIN_ENTRY_MAX_AGE_MS) {
      window.sessionStorage.removeItem(PARENT_POST_LOGIN_ENTRY_MOTION_KEY);
      return;
    }

    setShowEntryMotion(true);
    entryMotionTimerRef.current = window.setTimeout(() => {
      setShowEntryMotion(false);
      entryMotionTimerRef.current = null;
    }, 1800);
    clearEntryFlagTimerRef.current = window.setTimeout(() => {
      window.sessionStorage.removeItem(PARENT_POST_LOGIN_ENTRY_MOTION_KEY);
      clearEntryFlagTimerRef.current = null;
    }, 2300);

    return () => {
      if (entryMotionTimerRef.current) {
        window.clearTimeout(entryMotionTimerRef.current);
        entryMotionTimerRef.current = null;
      }
      if (clearEntryFlagTimerRef.current) {
        window.clearTimeout(clearEntryFlagTimerRef.current);
        clearEntryFlagTimerRef.current = null;
      }
    };
  }, [isActive, studentId]);

  const studentRef = useMemoFirebase(() => (!firestore || !centerId || !studentId ? null : doc(firestore, 'centers', centerId, 'students', studentId)), [firestore, centerId, studentId]);
  const { data: student } = useDoc<StudentProfile>(studentRef, { enabled: isActive && !!studentId });
  const activeStudentLabel = useMemo(
    () =>
      linkedStudents.find((item) => item.id === studentId)?.name ||
      student?.name ||
      (linkedStudentIds.length > 1 ? '자녀 선택' : '자녀'),
    [linkedStudents, student?.name, studentId, linkedStudentIds.length]
  );
  const shouldLoadStudyAnalytics = isActive && !!centerId && !!studentId && tab !== 'communication' && tab !== 'billing';
  const shouldLoadNotifications = isActive && !!centerId && !!studentId && !!user && tab === 'home';
  const shouldLoadReportArchive = isActive && !!studentId && isReportArchiveOpen;
  const shouldLoadParentCommunications = isActive && !!centerId && !!user && tab === 'communication';
  const shouldLoadInvoices = isActive && !!studentId && tab === 'billing';

  const todayLogRef = useMemoFirebase(() => (!firestore || !centerId || !studentId || !todayKey ? null : doc(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', todayKey)), [firestore, centerId, studentId, todayKey]);
  const { data: todayLog } = useDoc<StudyLogDay>(todayLogRef, { enabled: isActive && !!studentId });

  const analyticsLookbackDays = tab === 'data' ? 42 : 35;
  const recentAnalyticsStartKey = today ? format(subDays(today, analyticsLookbackDays - 1), 'yyyy-MM-dd') : '';
  const calendarRangeStartKey = format(startOfWeek(startOfMonth(currentCalendarDate), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const calendarRangeEndKey = format(endOfWeek(endOfMonth(currentCalendarDate), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  // 홈/학습/데이터용 최근 로그 또는 캘린더 범위만 조회
  const allLogsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId) return null;

    const baseRef = collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days');
    if (tab === 'studyDetail') {
      return query(
        baseRef,
        where('dateKey', '>=', calendarRangeStartKey),
        where('dateKey', '<=', calendarRangeEndKey),
        orderBy('dateKey', 'desc')
      );
    }

    if (!recentAnalyticsStartKey || !todayKey) return null;

    return query(
      baseRef,
      where('dateKey', '>=', recentAnalyticsStartKey),
      where('dateKey', '<=', todayKey),
      orderBy('dateKey', 'desc')
    );
  }, [firestore, centerId, studentId, tab, calendarRangeStartKey, calendarRangeEndKey, recentAnalyticsStartKey, todayKey]);
  const { data: allLogs, isLoading: logsLoading } = useCollection<StudyLogDay>(allLogsQuery, { enabled: shouldLoadStudyAnalytics });

  const plansQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId || !todayKey || !weekKey) return null;
    return query(collection(firestore, 'centers', centerId, 'plans', studentId, 'weeks', weekKey, 'items'), where('dateKey', '==', todayKey));
  }, [firestore, centerId, studentId, todayKey, weekKey]);
  const { data: todayPlans } = useCollection<StudyPlanItem>(plansQuery, { enabled: shouldLoadStudyAnalytics });

  const weeklyPlansQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId || !weekKey) return null;
    return query(collection(firestore, 'centers', centerId, 'plans', studentId, 'weeks', weekKey, 'items'));
  }, [firestore, centerId, studentId, weekKey]);
  const { data: weeklyPlans } = useCollection<StudyPlanItem>(weeklyPlansQuery, { enabled: shouldLoadStudyAnalytics });

  const previousWeekPlansQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId || !previousRecentWeekKey) return null;
    return query(collection(firestore, 'centers', centerId, 'plans', studentId, 'weeks', previousRecentWeekKey, 'items'));
  }, [firestore, centerId, studentId, previousRecentWeekKey]);
  const { data: previousWeekPlans } = useCollection<StudyPlanItem>(previousWeekPlansQuery, {
    enabled: shouldLoadStudyAnalytics && !!previousRecentWeekKey,
  });

  const selectedDateKey = selectedCalendarDate ? format(selectedCalendarDate, 'yyyy-MM-dd') : '';
  const selectedDateWeekKey = selectedCalendarDate ? format(selectedCalendarDate, "yyyy-'W'II") : '';
  const selectedDatePlansQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId || !selectedDateKey || !selectedDateWeekKey) return null;
    return query(
      collection(firestore, 'centers', centerId, 'plans', studentId, 'weeks', selectedDateWeekKey, 'items'),
      where('dateKey', '==', selectedDateKey),
    );
  }, [firestore, centerId, studentId, selectedDateKey, selectedDateWeekKey]);
  const { data: selectedDatePlans, isLoading: isSelectedDatePlansLoading } = useCollection<StudyPlanItem>(selectedDatePlansQuery, {
    enabled: isActive && !!studentId && !!selectedDateKey,
  });

  const attendanceCurrentQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'attendanceCurrent'),
      where('studentId', '==', studentId),
      limit(1)
    );
  }, [firestore, centerId, studentId]);
  const { data: attendanceCurrentDocs } = useCollection<AttendanceCurrent>(attendanceCurrentQuery, { enabled: isActive && !!studentId });
  const attendanceCurrent = attendanceCurrentDocs?.[0];

  useEffect(() => {
    if (!isActive || !firestore || !centerId || !studentId || !today) {
      setCheckInByDateKey({});
      setCheckOutByDateKey({});
      return;
    }

    let cancelled = false;
    const targetDateKeys = Array.from({ length: 7 }, (_, index) => {
      const day = subDays(today, 6 - index);
      return format(day, 'yyyy-MM-dd');
    });

    const loadCheckInRecords = async () => {
      try {
        const pairs = await Promise.all(
          targetDateKeys.map(async (dateKey) => {
            const recordRef = doc(firestore, 'centers', centerId, 'attendanceRecords', dateKey, 'students', studentId);
            const snap = await getDoc(recordRef);
            if (!snap.exists()) {
              return [dateKey, { checkInAt: null, checkOutAt: null }] as const;
            }
            const payload = snap.data() as Record<string, unknown>;
            const checkInAt = toDateSafe((payload?.checkInAt as TimestampLike) || (payload?.updatedAt as TimestampLike));
            const checkOutAt = toDateSafe(payload?.checkOutAt as TimestampLike);
            return [dateKey, { checkInAt, checkOutAt }] as const;
          })
        );

        if (!cancelled) {
          const nextCheckIn = Object.fromEntries(
            pairs.map(([dateKey, value]) => [dateKey, value.checkInAt])
          ) as Record<string, Date | null>;
          const nextCheckOut = Object.fromEntries(
            pairs.map(([dateKey, value]) => [dateKey, value.checkOutAt])
          ) as Record<string, Date | null>;
          setCheckInByDateKey(nextCheckIn);
          setCheckOutByDateKey(nextCheckOut);
        }
      } catch (error) {
        console.warn('[parent-dashboard] failed to load check-in trend', error);
        if (!cancelled) {
          setCheckInByDateKey({});
          setCheckOutByDateKey({});
        }
      }
    };

    void loadCheckInRecords();
    return () => {
      cancelled = true;
    };
  }, [isActive, firestore, centerId, studentId, today]);

  useEffect(() => {
    if (!shouldLoadStudyAnalytics || !firestore || !centerId || !studentId || !today) {
      setStudyStartByDateKey({});
      setStudyEndByDateKey({});
      setAwayMinutesByDateKey({});
      return;
    }

    let cancelled = false;
    const targetDateCount = tab === 'data' ? 14 : 7;
    const targetDateKeys = Array.from({ length: targetDateCount }, (_, index) => {
      const day = subDays(today, targetDateCount - 1 - index);
      return format(day, 'yyyy-MM-dd');
    });

    const loadStudySessionTrend = async () => {
      try {
        const results = await Promise.all(
          targetDateKeys.map(async (dateKey) => {
            const todayFallback =
              dateKey === todayKey && attendanceCurrent?.status === 'studying' && attendanceCurrent?.lastCheckInAt
                ? toDateSafe(attendanceCurrent.lastCheckInAt as TimestampLike)
                : null;

            try {
              const sessionsRef = collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', dateKey, 'sessions');
              const sessionsSnap = await getDocs(query(sessionsRef, orderBy('startTime', 'asc')));
              const sessions = sessionsSnap.docs
                .map((snapshot) => snapshot.data() as Partial<StudySession>)
                .filter((session) => !!session.startTime)
                .map((session) => ({
                  startTime: toDateSafe(session.startTime as TimestampLike),
                  endTime: toDateSafe(session.endTime as TimestampLike),
                }))
                .filter((session): session is { startTime: Date; endTime: Date | null } => !!session.startTime);

              if (!sessions.length) {
                return {
                  dateKey,
                  startAt: todayFallback,
                  endAt: todayFallback,
                  awayMinutes: 0,
                };
              }

              const firstSession = sessions[0];
              const lastSession = sessions[sessions.length - 1];
              let awayMinutes = 0;

              for (let index = 1; index < sessions.length; index += 1) {
                const previousEnd = sessions[index - 1].endTime;
                const currentStart = sessions[index].startTime;
                if (!previousEnd || !currentStart) continue;
                const gapMinutes = Math.round((currentStart.getTime() - previousEnd.getTime()) / 60000);
                if (gapMinutes > 0 && gapMinutes < 180) {
                  awayMinutes += gapMinutes;
                }
              }

              return {
                dateKey,
                startAt: firstSession.startTime,
                endAt: lastSession.endTime || lastSession.startTime || todayFallback,
                awayMinutes,
              };
            } catch {
              return {
                dateKey,
                startAt: todayFallback,
                endAt: todayFallback,
                awayMinutes: 0,
              };
            }
          })
        );

        if (!cancelled) {
          setStudyStartByDateKey(
            Object.fromEntries(results.map((item) => [item.dateKey, item.startAt ?? null])) as Record<string, Date | null>
          );
          setStudyEndByDateKey(
            Object.fromEntries(results.map((item) => [item.dateKey, item.endAt ?? null])) as Record<string, Date | null>
          );
          setAwayMinutesByDateKey(
            Object.fromEntries(results.map((item) => [item.dateKey, Math.max(0, Math.round(item.awayMinutes || 0))])) as Record<string, number>
          );
        }
      } catch (error) {
        console.warn('[parent-dashboard] failed to load study rhythm trend', error);
        if (!cancelled) {
          setStudyStartByDateKey({});
          setStudyEndByDateKey({});
          setAwayMinutesByDateKey({});
        }
      }
    };

    void loadStudySessionTrend();
    return () => {
      cancelled = true;
    };
  }, [
    attendanceCurrent?.lastCheckInAt,
    attendanceCurrent?.status,
    centerId,
    firestore,
    isActive,
    shouldLoadStudyAnalytics,
    studentId,
    tab,
    today,
    todayKey,
  ]);

  const reportRef = useMemoFirebase(() => (!firestore || !centerId || !studentId || !yesterdayKey ? null : doc(firestore, 'centers', centerId, 'dailyReports', `${yesterdayKey}_${studentId}`)), [firestore, centerId, studentId, yesterdayKey]);
  const { data: report } = useDoc<DailyReport>(reportRef, { enabled: isActive && !!studentId });
  useEffect(() => {
    if (!isActive || !firestore || !centerId || !studentId || !report?.content) return;

    const reportDocId = report.id || `${yesterdayKey}_${studentId}`;
    if (reportReadLoggedRef.current[reportDocId]) return;
    reportReadLoggedRef.current[reportDocId] = true;

    if (!(report as any).viewedAt) {
      const targetRef = doc(firestore, 'centers', centerId, 'dailyReports', reportDocId);
      updateDoc(targetRef, {
        viewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch((error) => {
        console.warn('[parent-report] viewedAt update failed', error);
      });
    }

    void logParentActivity('report_read', {
      reportId: reportDocId,
      dateKey: report.dateKey || yesterdayKey,
    });
  }, [isActive, firestore, centerId, studentId, report, yesterdayKey]);

  const reportsArchiveQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'dailyReports'),
      where('studentId', '==', studentId),
      where('status', '==', 'sent'),
      limit(50),
    );
  }, [firestore, centerId, studentId]);
  const { data: rawReportsArchive } = useCollection<DailyReport>(reportsArchiveQuery, { enabled: shouldLoadReportArchive });
  const reportsArchive = useMemo(
    () => [...(rawReportsArchive || [])].sort((a, b) => String(b.dateKey || '').localeCompare(String(a.dateKey || ''))),
    [rawReportsArchive]
  );

  const growthRef = useMemoFirebase(() => (!firestore || !centerId || !studentId ? null : doc(firestore, 'centers', centerId, 'growthProgress', studentId)), [firestore, centerId, studentId]);
  const { data: growth } = useDoc<GrowthProgress>(growthRef, { enabled: isActive && !!studentId });

  const remoteNotificationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId || !user) return null;
    return query(
      collection(firestore, 'centers', centerId, 'parentNotifications'),
      where('parentUid', '==', user.uid),
      where('studentId', '==', studentId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
  }, [firestore, centerId, studentId, user?.uid]);
  const { data: remoteNotifications } = useCollection<any>(remoteNotificationsQuery, { enabled: shouldLoadNotifications });

  const attendance요청Query = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId) return null;
    return query(collection(firestore, 'centers', centerId, 'attendance요청'), where('studentId', '==', studentId), limit(30));
  }, [firestore, centerId, studentId]);
  const { data: attendance요청 } = useCollection<AttendanceRequest>(attendance요청Query, { enabled: shouldLoadStudyAnalytics });

  const parentCommunicationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !user) return null;
    return query(
      collection(firestore, 'centers', centerId, 'parentCommunications'),
      where('parentUid', '==', user.uid),
      limit(30),
    );
  }, [firestore, centerId, user]);
  const { data: rawParentCommunications, isLoading: parentCommunicationsLoading } = useCollection<ParentCommunicationRecord>(parentCommunicationsQuery, {
    enabled: shouldLoadParentCommunications,
  });

  const penaltyLogsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId) return null;
    return query(collection(firestore, 'centers', centerId, 'penaltyLogs'), where('studentId', '==', studentId), limit(120));
  }, [firestore, centerId, studentId]);
  const { data: penaltyLogs } = useCollection<PenaltyLog>(penaltyLogsQuery, { enabled: shouldLoadStudyAnalytics });

  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'invoices'),
      where('studentId', '==', studentId),
      limit(120)
    );
  }, [firestore, centerId, studentId]);
  const { data: studentInvoices } = useCollection<Invoice>(invoicesQuery, { enabled: shouldLoadInvoices });

  const sortedInvoices = useMemo(() => {
    return [...(studentInvoices || [])].sort((a, b) => {
      const aDate =
        toDateSafe((a as any).cycleEndDate)?.getTime() ??
        toDateSafe((a as any).createdAt)?.getTime() ??
        0;
      const bDate =
        toDateSafe((b as any).cycleEndDate)?.getTime() ??
        toDateSafe((b as any).createdAt)?.getTime() ??
        0;
      return bDate - aDate;
    });
  }, [studentInvoices]);

  const displayInvoices = useMemo(
    () => sortedInvoices.filter((invoice) => invoice.status !== 'void' && invoice.status !== 'refunded'),
    [sortedInvoices]
  );
  const latestInvoice = displayInvoices[0];

  const billingSummary = useMemo(() => {
    return displayInvoices.reduce(
      (acc, invoice) => {
        const amount = Number(invoice.finalPrice || 0);
        if (!Number.isFinite(amount) || amount <= 0) return acc;

        acc.billed += amount;
        if (invoice.status === 'paid') {
          acc.paid += amount;
        }
        if (invoice.status === 'overdue') {
          acc.overdue += amount;
        }
        return acc;
      },
      { billed: 0, paid: 0, overdue: 0 }
    );
  }, [displayInvoices]);

  const mobileBillingStatusMeta = useMemo(() => {
    if (displayInvoices.length === 0) return null;
    const hasUnpaidInvoice = displayInvoices.some(
      (invoice) => invoice.status === 'issued' || invoice.status === 'overdue'
    );
    if (!hasUnpaidInvoice) {
      return {
        label: '완납',
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      };
    }
    return {
      label: '미납',
      className: 'bg-rose-100 text-rose-700 border-rose-200',
    };
  }, [displayInvoices]);

  const studyPlans = (todayPlans || []).filter((item) => item.category === 'study' || !item.category);
  const totalMinutes = todayLog?.totalMinutes || 0;
  
  const planTotal = studyPlans.length;
  const planDone = studyPlans.filter((item) => item.done).length;
  const planRate = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0;

  const logMinutesByDateKey = useMemo(() => {
    const map = new Map<string, number>();
    (allLogs || []).forEach((log) => {
      map.set(log.dateKey, log.totalMinutes || 0);
    });
    return map;
  }, [allLogs]);

  const dailyStudyTrend = useMemo(() => {
    if (!today) return [] as { date: string; minutes: number }[];
    return Array.from({ length: 7 }, (_, index) => {
      const day = subDays(today, 6 - index);
      const dateKey = format(day, 'yyyy-MM-dd');
      return {
        date: format(day, 'MM/dd', { locale: ko }),
        minutes: logMinutesByDateKey.get(dateKey) || 0,
      };
    });
  }, [today, logMinutesByDateKey]);

  const dailyRhythmTrend = useMemo(() => {
    if (!today) return [] as { date: string; rhythmMinutes: number | null }[];

    return Array.from({ length: 14 }, (_, index) => {
      const day = subDays(today, 13 - index);
      const dateKey = format(day, 'yyyy-MM-dd');
      const studyStart = studyStartByDateKey[dateKey] || null;

      return {
        date: format(day, 'MM/dd', { locale: ko }),
        rhythmMinutes: studyStart ? studyStart.getHours() * 60 + studyStart.getMinutes() : null,
      };
    });
  }, [today, studyStartByDateKey]);

  const hasRhythmTrend = useMemo(
    () => dailyRhythmTrend.some((point) => typeof point.rhythmMinutes === 'number'),
    [dailyRhythmTrend]
  );

  const rhythmScoreTrend = useMemo(() => {
    const values = dailyRhythmTrend.map((point) => point.rhythmMinutes);
    return dailyRhythmTrend.map((point, index) => {
      const windowValues = values
        .slice(0, index + 1)
        .filter((value): value is number => typeof value === 'number');
      const score = windowValues.length >= 2 ? calculateRhythmScore(windowValues) : windowValues.length === 1 ? 100 : 0;
      return { date: point.date, score };
    });
  }, [dailyRhythmTrend]);

  const rhythmScore = useMemo(() => {
    const validScores = rhythmScoreTrend.filter((item) => item.score > 0);
    if (!validScores.length) return 0;
    return Math.round(validScores.reduce((sum, item) => sum + item.score, 0) / validScores.length);
  }, [rhythmScoreTrend]);

  const rhythmYAxisDomain = useMemo(() => {
    const values = dailyRhythmTrend
      .map((point) => point.rhythmMinutes)
      .filter((value): value is number => typeof value === 'number');

    if (values.length === 0) return [420, 1320] as [number, number];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max(30, Math.round((max - min) * 0.25));
    const lower = Math.max(0, Math.floor((min - padding) / 30) * 30);
    const upper = Math.min(24 * 60, Math.ceil((max + padding) / 30) * 30);
    if (lower === upper) return [Math.max(0, lower - 60), Math.min(24 * 60, upper + 60)] as [number, number];
    return [lower, upper] as [number, number];
  }, [dailyRhythmTrend]);

  const weeklyTotalStudyMinutes = useMemo(
    () => dailyStudyTrend.reduce((sum, day) => sum + day.minutes, 0),
    [dailyStudyTrend]
  );

  const previous7DayMinutes = useMemo(() => {
    if (!today) return [] as number[];

    return Array.from({ length: 7 }, (_, index) => {
      const day = subDays(today, index + 1);
      const dateKey = format(day, 'yyyy-MM-dd');
      return logMinutesByDateKey.get(dateKey) || 0;
    });
  }, [today, logMinutesByDateKey]);

  const previous7DayStudyDaysCount = useMemo(
    () => previous7DayMinutes.filter((minutes) => minutes > 0).length,
    [previous7DayMinutes]
  );

  const previous7DayAverageMinutes = useMemo(() => {
    if (previous7DayMinutes.length === 0) return 0;
    return Math.round(
      previous7DayMinutes.reduce((sum, minutes) => sum + minutes, 0) / previous7DayMinutes.length
    );
  }, [previous7DayMinutes]);

  const growthCelebrationCandidate = useMemo<GrowthCelebrationState | null>(() => {
    if (totalMinutes <= 0) return null;
    if (previous7DayAverageMinutes <= 0) return null;
    if (previous7DayStudyDaysCount < 3) return null;
    if (totalMinutes <= previous7DayAverageMinutes) return null;

    const increaseRate = Math.round(
      ((totalMinutes - previous7DayAverageMinutes) / previous7DayAverageMinutes) * 100
    );

    if (increaseRate <= 0) return null;

    return {
      increaseRate,
      todayMinutes: totalMinutes,
      previous7DayAverage: previous7DayAverageMinutes,
    };
  }, [totalMinutes, previous7DayAverageMinutes, previous7DayStudyDaysCount]);

  const weeklyStudyPlans = (weeklyPlans || []).filter((item) => item.category === 'study' || !item.category);
  const weeklyPlanTotal = weeklyStudyPlans.length;
  const weeklyPlanDone = weeklyStudyPlans.filter((item) => item.done).length;
  const weeklyPlanCompletionRate = weeklyPlanTotal > 0 ? Math.round((weeklyPlanDone / weeklyPlanTotal) * 100) : 0;
  const recentTrendPlans = useMemo(() => {
    const deduped = new Map<string, StudyPlanItem>();
    [...(weeklyPlans || []), ...(previousWeekPlans || [])].forEach((item) => {
      if (item.category && item.category !== 'study') return;
      deduped.set(item.id || `${item.dateKey}-${item.title}`, item);
    });
    return Array.from(deduped.values());
  }, [weeklyPlans, previousWeekPlans]);

  const dailyPlanTrend = useMemo(() => {
    if (!today) {
      return [] as Array<{ date: string; dateKey: string; rate: number | null; total: number; done: number }>;
    }

    const plansByDateKey = new Map<string, StudyPlanItem[]>();
    recentTrendPlans.forEach((item) => {
      const current = plansByDateKey.get(item.dateKey) || [];
      current.push(item);
      plansByDateKey.set(item.dateKey, current);
    });

    return Array.from({ length: 7 }, (_, index) => {
      const day = subDays(today, 6 - index);
      const dateKey = format(day, 'yyyy-MM-dd');
      const items = plansByDateKey.get(dateKey) || [];
      const total = items.length;
      const done = items.filter((item) => item.done).length;

      return {
        date: format(day, 'MM/dd', { locale: ko }),
        dateKey,
        rate: total > 0 ? Math.round((done / total) * 100) : null,
        total,
        done,
      };
    });
  }, [today, recentTrendPlans]);

  const studyTrendHasActivity = useMemo(
    () => dailyStudyTrend.some((item) => item.minutes > 0),
    [dailyStudyTrend]
  );
  const studyTrendPeakMinutes = useMemo(
    () => dailyStudyTrend.reduce((max, item) => Math.max(max, item.minutes), 0),
    [dailyStudyTrend]
  );
  const yesterdayStudyMinutes = dailyStudyTrend.length > 1 ? dailyStudyTrend[dailyStudyTrend.length - 2]?.minutes || 0 : 0;
  const studyDeltaFromYesterday = totalMinutes - yesterdayStudyMinutes;

  const planTrendActiveDays = useMemo(
    () => dailyPlanTrend.filter((item) => item.total > 0).length,
    [dailyPlanTrend]
  );
  const planTrendCompletedDays = useMemo(
    () => dailyPlanTrend.filter((item) => item.total > 0 && item.done === item.total).length,
    [dailyPlanTrend]
  );
  const planTrendAverageRate = useMemo(() => {
    const availableRates = dailyPlanTrend
      .map((item) => item.rate)
      .filter((rate): rate is number => typeof rate === 'number');
    if (availableRates.length === 0) return 0;
    return Math.round(availableRates.reduce((sum, rate) => sum + rate, 0) / availableRates.length);
  }, [dailyPlanTrend]);

  const subjectsData = useMemo(() => {
    const source = weeklyStudyPlans.length > 0 ? weeklyStudyPlans : studyPlans;
    const minutesBySubject = new Map<string, number>();

    source.forEach((item) => {
      const inferredSubject = item.subject?.trim() || (item.title.match(/수학|영어|국어|과학|사회|한국사|논술|코딩/)?.[0] ?? '기타');
      const weight = item.targetMinutes && item.targetMinutes > 0 ? item.targetMinutes : item.done ? 50 : 30;
      minutesBySubject.set(inferredSubject, (minutesBySubject.get(inferredSubject) || 0) + weight);
    });

    if (minutesBySubject.size === 0 && weeklyTotalStudyMinutes > 0) {
      minutesBySubject.set('전체 학습', weeklyTotalStudyMinutes);
    }

    return Array.from(minutesBySubject.entries())
      .map(([subject, minutes], index) => ({
        subject: toKoreanSubjectLabel(subject),
        minutes,
        color: SUBJECT_COLORS[index % SUBJECT_COLORS.length],
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [studyPlans, weeklyStudyPlans, weeklyTotalStudyMinutes]);

  const subjectTotalMinutes = subjectsData.reduce((sum, subject) => sum + subject.minutes, 0);

  const studyTrend42 = useMemo(() => {
    if (!today) return [] as Array<{ dateKey: string; dateLabel: string; minutes: number }>;

    return Array.from({ length: 42 }, (_, index) => {
      const day = subDays(today, 41 - index);
      const dateKey = format(day, 'yyyy-MM-dd');
      return {
        dateKey,
        dateLabel: format(day, 'M/d', { locale: ko }),
        minutes: logMinutesByDateKey.get(dateKey) || 0,
      };
    });
  }, [today, logMinutesByDateKey]);

  const weeklyGrowthData = useMemo(() => {
    if (studyTrend42.length === 0) return [] as Array<{ label: string; totalMinutes: number; growth: number }>;

    const buckets = Array.from({ length: 6 }, (_, index) => {
      const chunk = studyTrend42.slice(index * 7, index * 7 + 7);
      return {
        label: chunk[0]?.dateLabel || '',
        totalMinutes: chunk.reduce((sum, item) => sum + item.minutes, 0),
      };
    });

    return buckets.map((bucket, index, source) => {
      if (index === 0) return { ...bucket, growth: 0 };
      const previousTotal = source[index - 1].totalMinutes;
      return {
        ...bucket,
        growth: previousTotal > 0 ? Math.round(((bucket.totalMinutes - previousTotal) / previousTotal) * 100) : 0,
      };
    });
  }, [studyTrend42]);

  const latestWeeklyLearningGrowthPercent = weeklyGrowthData[weeklyGrowthData.length - 1]?.growth ?? 0;
  const hasWeeklyGrowthData = weeklyGrowthData.some((week) => week.totalMinutes > 0);

  const rhythmScoreOnlyTrend = useMemo(() => {
    return dailyRhythmTrend.map((point, index, source) => {
      const values = source
        .slice(Math.max(0, index - 2), index + 1)
        .map((item) => item.rhythmMinutes)
        .filter((item): item is number => typeof item === 'number');
      const score = values.length >= 2 ? calculateRhythmScore(values) : values.length === 1 ? 100 : 0;
      return { date: point.date, score };
    });
  }, [dailyRhythmTrend]);

  const averageRhythmScore = useMemo(() => {
    const validScores = rhythmScoreOnlyTrend.filter((item) => item.score > 0);
    if (!validScores.length) return 0;
    return Math.round(validScores.reduce((sum, item) => sum + item.score, 0) / validScores.length);
  }, [rhythmScoreOnlyTrend]);

  const startEndTimeTrendData = useMemo(() => {
    if (!today) return [] as Array<{ date: string; startHour: number | null; endHour: number | null }>;

    return Array.from({ length: 14 }, (_, index) => {
      const day = subDays(today, 13 - index);
      const dateKey = format(day, 'yyyy-MM-dd');
      return {
        date: format(day, 'M/d', { locale: ko }),
        startHour: dateToHourNumber(studyStartByDateKey[dateKey] || null),
        endHour: dateToHourNumber(studyEndByDateKey[dateKey] || null),
      };
    });
  }, [today, studyStartByDateKey, studyEndByDateKey]);

  const startEndYAxisDomain = useMemo(() => {
    const values = startEndTimeTrendData
      .flatMap((point) => [point.startHour, point.endHour])
      .filter((value): value is number => typeof value === 'number');

    if (!values.length) return [8, 24] as [number, number];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const lower = Math.max(0, Math.floor((min - 1) * 2) / 2);
    const upper = Math.min(24, Math.ceil((max + 1) * 2) / 2);
    return lower === upper ? [Math.max(0, lower - 1), Math.min(24, upper + 1)] as [number, number] : [lower, upper] as [number, number];
  }, [startEndTimeTrendData]);

  const awayTimeTrendData = useMemo(() => {
    if (!today) return [] as Array<{ date: string; awayMinutes: number }>;

    return Array.from({ length: 14 }, (_, index) => {
      const day = subDays(today, 13 - index);
      const dateKey = format(day, 'yyyy-MM-dd');
      return {
        date: format(day, 'M/d', { locale: ko }),
        awayMinutes: Math.max(0, Math.round(Number(awayMinutesByDateKey[dateKey] || 0))),
      };
    });
  }, [today, awayMinutesByDateKey]);

  const hasRhythmScoreOnlyTrend = rhythmScoreOnlyTrend.some((item) => item.score > 0);
  const hasStartEndTimeData = startEndTimeTrendData.some((item) => item.startHour !== null || item.endHour !== null);
  const hasAwayTimeData = awayTimeTrendData.some((item) => item.awayMinutes > 0);

  const weeklyGrowthInsight = useMemo(() => buildWeeklyStudyInsight(weeklyGrowthData), [weeklyGrowthData]);
  const rhythmInsight = useMemo(() => buildRhythmInsight(rhythmScoreOnlyTrend), [rhythmScoreOnlyTrend]);
  const startEndInsight = useMemo(
    () =>
      buildStartEndInsight(
        startEndTimeTrendData.map((item) => ({
          startMinutes: item.startHour ? Math.round(item.startHour * 60) : 0,
          endMinutes: item.endHour ? Math.round(item.endHour * 60) : 0,
        }))
      ),
    [startEndTimeTrendData]
  );
  const awayTimeInsight = useMemo(() => buildAwayTimeInsight(awayTimeTrendData), [awayTimeTrendData]);

  const analyticsAverageStartLabel = useMemo(() => {
    const validStarts = startEndTimeTrendData
      .map((item) => item.startHour)
      .filter((value): value is number => typeof value === 'number');
    if (!validStarts.length) return '기록 대기';
    const average = validStarts.reduce((sum, value) => sum + value, 0) / validStarts.length;
    return hourToClockLabel(average);
  }, [startEndTimeTrendData]);

  const analyticsAverageAwayMinutes = useMemo(() => {
    if (!awayTimeTrendData.length) return 0;
    return Math.round(awayTimeTrendData.reduce((sum, item) => sum + item.awayMinutes, 0) / awayTimeTrendData.length);
  }, [awayTimeTrendData]);

  const recentPenaltyReasons = useMemo(() => {
    const sorted요청 = [...(attendance요청 || [])].sort((a, b) => {
      const aDate = toDateSafe((a as any).createdAt)?.getTime() ?? 0;
      const bDate = toDateSafe((b as any).createdAt)?.getTime() ?? 0;
      return bDate - aDate;
    });

    return sorted요청
      .filter((request) => request.penaltyApplied)
      .slice(0, 5)
      .map((request) => ({
        id: request.id,
        reason: request.reason || (request.type === 'late' ? '지각 신청 처리' : '결석 신청 처리'),
        points: request.type === 'absence' ? REQUEST_PENALTY_POINTS.absence : REQUEST_PENALTY_POINTS.late,
        dateLabel: formatDateLabel(request.date, (request as any).createdAt),
      }));
  }, [attendance요청]);

  const penaltyRecovery = useMemo(() => {
    const basePoints = Math.max(0, Math.round(Number(growth?.penaltyPoints || 0)));
    const nowMs = Date.now();
    const latestPositiveLog = [...(penaltyLogs || [])]
      .filter((log) => Number(log.pointsDelta || 0) > 0)
      .sort((a, b) => {
        const aMs = toDateSafe((a as any).createdAt)?.getTime() || 0;
        const bMs = toDateSafe((b as any).createdAt)?.getTime() || 0;
        return bMs - aMs;
      })[0];

    const latestPositiveMs = latestPositiveLog ? toDateSafe((latestPositiveLog as any).createdAt)?.getTime() || 0 : 0;
    const daysSinceLatestPositive = latestPositiveMs > 0 ? Math.max(0, Math.floor((nowMs - latestPositiveMs) / (24 * 60 * 60 * 1000))) : 0;
    const recoveredPoints = latestPositiveMs > 0 ? Math.min(basePoints, Math.floor(daysSinceLatestPositive / PENALTY_RECOVERY_INTERVAL_DAYS)) : 0;
    const effectivePoints = Math.max(0, basePoints - recoveredPoints);

    return {
      basePoints,
      recoveredPoints,
      effectivePoints,
      daysSinceLatestPositive,
      latestPositiveDateLabel: latestPositiveMs > 0 ? format(new Date(latestPositiveMs), 'yyyy.MM.dd', { locale: ko }) : '-',
    };
  }, [growth?.penaltyPoints, penaltyLogs]);
  const latestPenaltyHighlight = useMemo(() => {
    const latestPenaltyLog = [...(penaltyLogs || [])]
      .filter((log) => Number(log.pointsDelta || 0) > 0)
      .sort((a, b) => {
        const aMs = toDateSafe((a as any).createdAt)?.getTime() || 0;
        const bMs = toDateSafe((b as any).createdAt)?.getTime() || 0;
        return bMs - aMs;
      })[0];

    if (latestPenaltyLog) {
      const createdAt = toDateSafe((latestPenaltyLog as any).createdAt);
      return {
        reason: latestPenaltyLog.reason || '생활 기록',
        points: Math.max(0, Number(latestPenaltyLog.pointsDelta || 0)),
        dateLabel: createdAt ? format(createdAt, 'yyyy.MM.dd', { locale: ko }) : '-',
      };
    }

    const recentPenalty = recentPenaltyReasons[0];
    if (!recentPenalty) return null;

    return {
      reason: recentPenalty.reason,
      points: recentPenalty.points,
      dateLabel: recentPenalty.dateLabel,
    };
  }, [penaltyLogs, recentPenaltyReasons]);

  const aiInsights = useMemo(() => {
    const insights: string[] = [];
    const targetWeeklyMinutes = (student?.targetDailyMinutes || 360) * 5;

    if (weeklyTotalStudyMinutes > 0) {
      const progressRate = Math.round((weeklyTotalStudyMinutes / Math.max(targetWeeklyMinutes, 1)) * 100);
      if (progressRate >= 100) {
        insights.push(`이번 주 목표 학습시간을 달성했습니다. (${toHm(weeklyTotalStudyMinutes)})`);
      } else {
        insights.push(`이번 주 누적 학습은 ${toHm(weeklyTotalStudyMinutes)}으로 목표 대비 ${progressRate}%입니다.`);
      }
    } else {
      insights.push('학습 로그가 쌓이면 인공지능 인사이트가 자동으로 정교해집니다.');
    }

    insights.push(
      weeklyPlanTotal > 0
        ? `주간 계획 달성률은 ${weeklyPlanCompletionRate}%입니다. ${weeklyPlanCompletionRate >= 80 ? '아주 안정적입니다.' : '완료율을 조금만 더 끌어올려 보세요.'}`
        : '이번 주 계획 데이터가 아직 등록되지 않았습니다.'
    );

    if (subjectsData.length > 0) {
      const topSubject = subjectsData[0];
      insights.push(`가장 많이 투자한 과목은 ${topSubject.subject} (${topSubject.minutes}분)입니다.`);
    }

    if (penaltyRecovery.effectivePoints > 0) {
      insights.push(`생활 벌점이 ${penaltyRecovery.effectivePoints}점(회복 반영) 누적되어 있어 생활 관리가 필요합니다.`);
    }

    return insights.slice(0, 4);
  }, [student?.targetDailyMinutes, weeklyTotalStudyMinutes, weeklyPlanTotal, weeklyPlanCompletionRate, subjectsData, penaltyRecovery.effectivePoints]);

  const weeklyFeedback = report?.content?.trim() || aiInsights[0] || '선생님 피드백이 등록되면 이 영역에서 확인할 수 있습니다.';

  const attendanceStatus = useMemo(() => {
    if (!attendanceCurrent) return { label: '상태 미확인', color: 'bg-slate-100 text-slate-400', icon: Clock };

    const status = attendanceCurrent.status;
    const isStudying = ['studying', 'away', 'break'].includes(status);
    const hasRecord = (todayLog?.totalMinutes || 0) > 0;

    if (isStudying) {
      return { label: '등원 (학습 중)', color: 'bg-[#eaf2ff] text-[#14295F] border-blue-100', icon: UserCheck };
    }

    if (!isStudying && hasRecord) {
      return { label: '하원', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: Home };
    }

    const routineItems = todayPlans?.filter(p => p.category === 'schedule') || [];
    const isAbsentDay = routineItems.some(p => p.title.includes('등원하지 않습니다'));
    
    if (isAbsentDay) {
      return { label: '결석 (휴무)', color: 'bg-rose-50 text-rose-600 border-rose-100', icon: CalendarX };
    }

    const inTimePlan = routineItems.find(p => p.title.includes('등원 예정'));
    if (inTimePlan) {
      const timeStr = inTimePlan.title.split(': ')[1];
      if (timeStr) {
        try {
          const now = new Date();
          const scheduledTime = parse(timeStr, 'HH:mm', now);
          if (isAfter(now, scheduledTime)) {
            return { label: '지각 주의', color: 'bg-orange-50 text-[#FF7A16] border-orange-100', icon: AlertCircle };
          }
        } catch (e) {}
      }
    }

    return { label: '미입실 (입실 전)', color: 'bg-slate-100 text-slate-400 border-slate-200', icon: Clock };
  }, [attendanceCurrent, todayLog, todayPlans]);

  // 캘린더 데이터 생성
  const calendarData = useMemo(() => {
    const start = startOfMonth(currentCalendarDate);
    const end = endOfMonth(currentCalendarDate);
    const calendarStart = startOfWeek(start, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(end, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentCalendarDate]);

  const getHeatmapColor = (minutes: number) => {
    if (minutes === 0) return 'bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] ring-1 ring-inset ring-slate-200/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_16px_30px_-28px_rgba(15,23,42,0.12)]';
    if (minutes < 60) return 'bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(240,253,246,0.98)_60%,rgba(225,248,238,0.98)_100%)] ring-1 ring-inset ring-emerald-200/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_18px_32px_-28px_rgba(16,185,129,0.18)]';
    if (minutes < 180) return 'bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(229,252,242,0.98)_56%,rgba(214,247,233,0.98)_100%)] ring-1 ring-inset ring-emerald-300/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_18px_34px_-28px_rgba(13,148,136,0.22)]';
    if (minutes < 300) return 'bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(223,250,246,0.98)_52%,rgba(210,243,246,0.98)_100%)] ring-1 ring-inset ring-teal-300/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_20px_36px_-28px_rgba(14,165,233,0.22)]';
    if (minutes < 480) return 'bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(227,244,255,0.98)_50%,rgba(213,231,255,0.98)_100%)] ring-1 ring-inset ring-sky-300/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_22px_38px_-28px_rgba(37,99,235,0.22)]';
    return 'bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(220,236,255,0.98)_46%,rgba(205,221,255,0.98)_100%)] ring-1 ring-inset ring-blue-300/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_24px_42px_-28px_rgba(20,41,95,0.24)]';
  };

  const getCalendarAccentClass = (minutes: number) => {
    if (minutes === 0) return 'from-slate-200 via-slate-300 to-slate-200';
    if (minutes < 60) return 'from-emerald-300 via-emerald-400 to-teal-400';
    if (minutes < 180) return 'from-emerald-400 via-teal-400 to-cyan-400';
    if (minutes < 300) return 'from-teal-400 via-cyan-400 to-sky-400';
    if (minutes < 480) return 'from-sky-400 via-blue-400 to-indigo-400';
    return 'from-sky-500 via-blue-500 to-indigo-600';
  };

  const getCalendarTimeCapsuleClass = (minutes: number, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return 'border-slate-200 text-slate-400';
    if (minutes === 0) return 'border-slate-200 text-slate-500';
    if (minutes < 60) return 'border-emerald-300/95 text-slate-900';
    if (minutes < 180) return 'border-emerald-400/95 text-slate-950';
    if (minutes < 300) return 'border-teal-400/95 text-slate-950';
    if (minutes < 480) return 'border-sky-400/95 text-slate-950';
    return 'border-indigo-400/95 text-slate-950';
  };

  const notifications: ParentNotificationItem[] = useMemo(() => {
    if (remoteNotifications && remoteNotifications.length > 0) {
      return remoteNotifications.map((item: any) => ({
        id: item.id,
        type: item.type || 'weekly_report',
        title: item.title || '새 알림',
        body: item.body || '',
        createdAtLabel: item.createdAtLabel || toRelativeLabel(item.createdAt),
        createdAtMs: toDateSafe(item.createdAt)?.getTime() || 0,
        isRead: !!item.isRead,
        isImportant: !!item.isImportant,
      }));
    }

    const fallback: ParentNotificationItem[] = [];

    if (attendanceCurrent) {
      fallback.push({
        id: `attendance-${attendanceCurrent.id || 'current'}`,
        type: attendanceCurrent.status === 'studying' ? 'check_in' : 'check_out',
        title: attendanceCurrent.status === 'studying' ? '등원 상태 확인' : '출결 상태 업데이트',
        body: attendanceStatus.label,
        createdAtLabel: toRelativeLabel((attendanceCurrent as any).updatedAt),
        createdAtMs: toDateSafe((attendanceCurrent as any).updatedAt)?.getTime() || 0,
        isRead: false,
        isImportant: attendanceCurrent.status !== 'studying',
      });
    }

    if (report?.content) {
      fallback.push({
        id: report.id || `${yesterdayKey}-${studentId}`,
        type: 'weekly_report',
        title: '학습 리포트 도착',
        body: report.content,
        createdAtLabel: toRelativeLabel((report as any).updatedAt || (report as any).createdAt),
        createdAtMs: toDateSafe((report as any).updatedAt || (report as any).createdAt)?.getTime() || 0,
        isRead: !!report.viewedAt,
        isImportant: true,
      });
    }

    if (recentPenaltyReasons.length > 0) {
      const latest = recentPenaltyReasons[0];
      fallback.push({
        id: `penalty-${latest.id}`,
        type: 'penalty',
        title: '생활 기록 알림',
        body: `${latest.reason} (+${latest.points}점)`,
        createdAtLabel: latest.dateLabel,
        createdAtMs: 0,
        isRead: false,
        isImportant: true,
      });
    }

    return fallback;
  }, [remoteNotifications, attendanceCurrent, attendanceStatus.label, report, recentPenaltyReasons, studentId, yesterdayKey]);

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  }, [notifications]);

  const recentNotifications = useMemo(() => sortedNotifications.slice(0, 3), [sortedNotifications]);
  const unreadRecentCount = useMemo(
    () => recentNotifications.filter((notification) => !(notification.isRead || !!readMap[notification.id])).length,
    [recentNotifications, readMap]
  );

  const latestStudySnapshot = useMemo(() => {
    const sorted = [...(allLogs || [])]
      .filter((log) => (log.totalMinutes || 0) > 0)
      .sort((a, b) => (b.dateKey || '').localeCompare(a.dateKey || ''));
    const latest = sorted[0];
    if (!latest) return null;

    const parsed = parse(latest.dateKey, 'yyyy-MM-dd', new Date());
    const studyDateLabel = Number.isNaN(parsed.getTime())
      ? latest.dateKey
      : format(parsed, 'MM/dd (EEE)', { locale: ko });
    const studyStartAt = studyStartByDateKey[latest.dateKey] || null;
    const studyStartLabel = studyStartAt ? format(studyStartAt, 'HH:mm') : '기록 없음';

    return {
      dateKey: latest.dateKey,
      studyDateLabel,
      studyStartLabel,
    };
  }, [allLogs, studyStartByDateKey]);

  const latestAwayNotification = useMemo(
    () => sortedNotifications.find((notification) => notification.type === 'away_long' || notification.type === 'unauthorized_exit') || null,
    [sortedNotifications]
  );

  const latestCheckOutNotification = useMemo(
    () => sortedNotifications.find((notification) => notification.type === 'check_out') || null,
    [sortedNotifications]
  );

  const todayCheckInAt = useMemo(() => {
    const recordCheckInAt = todayKey ? checkInByDateKey[todayKey] || null : null;
    if (recordCheckInAt) return recordCheckInAt;

    const liveCheckInAt = toDateSafe(attendanceCurrent?.lastCheckInAt as TimestampLike);
    if (liveCheckInAt && today && isSameDay(liveCheckInAt, today)) {
      return liveCheckInAt;
    }

    return null;
  }, [attendanceCurrent?.lastCheckInAt, checkInByDateKey, today, todayKey]);

  const todayCheckOutAt = useMemo(() => {
    const recordCheckOutAt = todayKey ? checkOutByDateKey[todayKey] || null : null;
    if (recordCheckOutAt) return recordCheckOutAt;

    if (!latestCheckOutNotification?.createdAtMs || !today) return null;
    const notificationCheckOutAt = new Date(latestCheckOutNotification.createdAtMs);
    if (Number.isNaN(notificationCheckOutAt.getTime()) || !isSameDay(notificationCheckOutAt, today)) {
      return null;
    }

    return notificationCheckOutAt;
  }, [checkOutByDateKey, latestCheckOutNotification?.createdAtMs, today, todayKey]);

  const todayAttendanceTimeSummary = useMemo(() => {
    const isCurrentlyInside = ['studying', 'away', 'break'].includes(attendanceCurrent?.status || '');

    return {
      dateLabel: today ? format(today, 'MM/dd (EEE)', { locale: ko }) : '오늘',
      checkInLabel: formatAttendanceTimeLabel(todayCheckInAt, '미기록'),
      checkOutLabel: isCurrentlyInside
        ? todayCheckOutAt
          ? formatAttendanceTimeLabel(todayCheckOutAt)
          : '학습 중'
        : todayCheckOutAt
          ? formatAttendanceTimeLabel(todayCheckOutAt)
          : todayCheckInAt
            ? '기록 대기'
            : '미기록',
    };
  }, [attendanceCurrent?.status, today, todayCheckInAt, todayCheckOutAt]);

  const recentLifeAttendanceSummary = useMemo(() => {
    const isAwayNow = attendanceCurrent?.status === 'away' || attendanceCurrent?.status === 'break';
    const hasAwayRecord = isAwayNow || !!latestAwayNotification;
    const hasCheckOutRecord =
      !!latestCheckOutNotification ||
      (attendanceCurrent?.status !== 'studying' && (todayLog?.totalMinutes || 0) > 0);

    return {
      recentStudyDate: latestStudySnapshot?.studyDateLabel || '기록 없음',
      recentStudyStart: latestStudySnapshot?.studyStartLabel || '기록 없음',
      awayStatus: isAwayNow
        ? '현재 외출/휴식 중'
        : hasAwayRecord
          ? `최근 외출 기록 (${latestAwayNotification?.createdAtLabel || '확인됨'})`
          : '외출 기록 없음',
      checkOutStatus: hasCheckOutRecord
        ? `퇴실 기록 있음 (${latestCheckOutNotification?.createdAtLabel || '확인됨'})`
        : '퇴실 기록 없음',
    };
  }, [
    attendanceCurrent?.status,
    latestAwayNotification?.createdAtLabel,
    latestCheckOutNotification?.createdAtLabel,
    latestStudySnapshot?.studyDateLabel,
    latestStudySnapshot?.studyStartLabel,
    todayLog?.totalMinutes,
  ]);

  const penaltyMeta = useMemo(() => {
    const points = penaltyRecovery.effectivePoints;
    if (points >= 20) return { label: '퇴원', badge: 'bg-rose-200 text-rose-800 border-rose-300' };
    if (points >= 12) return { label: '학부모 상담', badge: 'bg-amber-100 text-amber-800 border-amber-300' };
    if (points >= 7) return { label: '선생님과 상담', badge: 'bg-orange-100 text-orange-800 border-orange-300' };
    return { label: '정상', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  }, [penaltyRecovery.effectivePoints]);
  const latestPenaltyReason = recentPenaltyReasons[0] || null;
  const penaltySeverityPercent = useMemo(
    () => Math.max(10, Math.min(100, Math.round((penaltyRecovery.effectivePoints / 20) * 100))),
    [penaltyRecovery.effectivePoints]
  );
  const heroTone = useMemo(() => {
    if (growthCelebrationCandidate) {
      return {
        badgeLabel: '성장 상승',
        badgeClassName: 'border-[#ffd2a2] bg-[#fff3e6] text-[#FF7A16]',
        title: '평균보다 더 좋은 흐름을 보이고 있어요',
        description: `오늘 공부 시간이 직전 7일 평균보다 ${growthCelebrationCandidate.increaseRate}% 높습니다. 학습 리듬이 점점 안정되고 있어요.`,
      };
    }

    if (weeklyPlanCompletionRate >= 85 && penaltyRecovery.effectivePoints === 0) {
      return {
        badgeLabel: '안정 성장',
        badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        title: '루틴이 안정적으로 유지되고 있어요',
        description: '계획 이행과 생활 리듬이 모두 차분하게 이어지고 있습니다. 부모님이 보시기에도 안심되는 흐름이에요.',
      };
    }

    if (attendanceStatus.label.includes('학습') || attendanceStatus.label.includes('귀가')) {
      return {
        badgeLabel: '실시간 확인',
        badgeClassName: 'border-[#d8e5ff] bg-[#eef4ff] text-[#14295F]',
        title: '오늘의 학습 흐름을 앱에서 바로 확인할 수 있어요',
        description: '등원 상태, 공부 시간, 계획 달성률을 한 화면에서 빠르게 보실 수 있도록 정리했습니다.',
      };
    }

    return {
      badgeLabel: '안심 체크',
      badgeClassName: 'border-slate-200 bg-white text-slate-600',
      title: '자녀의 오늘 흐름을 차분하게 확인해 보세요',
      description: '학습 리듬과 생활 상태를 복잡하지 않게, 앱 기준으로 보기 쉽게 모았습니다.',
    };
  }, [
    growthCelebrationCandidate,
    weeklyPlanCompletionRate,
    penaltyRecovery.effectivePoints,
    attendanceStatus.label,
  ]);

  const selectedDateLog = useMemo(() => {
    if (!selectedDateKey) return null;
    return (allLogs || []).find((log) => log.dateKey === selectedDateKey) || null;
  }, [allLogs, selectedDateKey]);

  const parentCommunications = useMemo(() => {
    if (!rawParentCommunications) return [];
    return [...rawParentCommunications].sort((a, b) => {
      const aMs = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
      const bMs = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
      return bMs - aMs;
    });
  }, [rawParentCommunications]);

  const selectedDateStudyPlans = useMemo(
    () => (selectedDatePlans || []).filter((item) => item.category === 'study' || !item.category),
    [selectedDatePlans]
  );
  const selectedDatePlanTotal = selectedDateStudyPlans.length;
  const selectedDatePlanDone = selectedDateStudyPlans.filter((item) => item.done).length;
  const selectedDatePlanRate = selectedDatePlanTotal > 0 ? Math.round((selectedDatePlanDone / selectedDatePlanTotal) * 100) : 0;
  const selectedDateLp = Number(growth?.dailyLpStatus?.[selectedDateKey]?.dailyLpAmount || 0);
  const selectedDateRequest = useMemo(
    () => (attendance요청 || []).find((request) => request.date === selectedDateKey),
    [attendance요청, selectedDateKey]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (growthCelebrationTimerRef.current) {
      window.clearTimeout(growthCelebrationTimerRef.current);
      growthCelebrationTimerRef.current = null;
    }
    if (growthCelebrationDismissTimerRef.current) {
      window.clearTimeout(growthCelebrationDismissTimerRef.current);
      growthCelebrationDismissTimerRef.current = null;
    }

    if (!isActive || tab !== 'home' || !centerId || !studentId || !todayKey || !growthCelebrationCandidate) {
      setGrowthCelebration(null);
      return;
    }

    const storageKey = `parent-growth-celebration:${centerId}:${studentId}:${todayKey}`;

    try {
      if (window.localStorage.getItem(storageKey)) {
        setGrowthCelebration(null);
        return;
      }
      window.localStorage.setItem(storageKey, 'shown');
    } catch {
      // Ignore storage issues and still show once during this render cycle.
    }

    const revealDelay = showEntryMotion ? 1500 : 0;
    growthCelebrationTimerRef.current = window.setTimeout(() => {
      setGrowthCelebration(growthCelebrationCandidate);
      growthCelebrationTimerRef.current = null;
      growthCelebrationDismissTimerRef.current = window.setTimeout(() => {
        setGrowthCelebration(null);
        growthCelebrationDismissTimerRef.current = null;
      }, 3200);
    }, revealDelay);

    return () => {
      if (growthCelebrationTimerRef.current) {
        window.clearTimeout(growthCelebrationTimerRef.current);
        growthCelebrationTimerRef.current = null;
      }
      if (growthCelebrationDismissTimerRef.current) {
        window.clearTimeout(growthCelebrationDismissTimerRef.current);
        growthCelebrationDismissTimerRef.current = null;
      }
    };
  }, [isActive, tab, centerId, studentId, todayKey, growthCelebrationCandidate, showEntryMotion]);

  useEffect(() => {
    if (!isReportArchiveOpen) return;

    if (selectedChildReport) {
      const hasSelectedReport = reportsArchive.some((item) => item.id === selectedChildReport.id);
      if (!hasSelectedReport) {
        setSelectedChildReport(reportsArchive[0] || null);
      }
      return;
    }

    if (reportsArchive.length > 0) {
      setSelectedChildReport(reportsArchive[0]);
    }
  }, [isReportArchiveOpen, reportsArchive, selectedChildReport]);

  const readNotification = async (notification: ParentNotificationItem) => {
    setReadMap((prev) => ({ ...prev, [notification.id]: true }));
    void logParentActivity('app_visit', { source: 'notification_read', notificationId: notification.id, notificationType: notification.type });
  };

  const openNotificationDetail = async (notification: ParentNotificationItem) => {
    await readNotification(notification);
    setSelectedNotification(notification);
  };

  const handleTabChange = (value: string) => {
    const nextTab = normalizeParentPortalTab(value);
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('parentTab', nextTab);
    router.replace(`${pathname}?${params.toString()}`);
    void logParentActivity('app_visit', { source: 'tab_change', tab: nextTab });
  };

  const handleStudentChange = (nextStudentId: string) => {
    if (nextStudentId === studentId) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set('parentTab', tab);
    if (linkedStudentIds.length > 1) {
      params.set('parentStudentId', nextStudentId);
    } else {
      params.delete('parentStudentId');
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleOpenReportsArchive = () => {
    setSelectedChildReport(reportsArchive[0] || null);
    setIsReportArchiveOpen(true);
  };

  const handleSelectChildReport = async (target: DailyReport) => {
    setSelectedChildReport(target);
    if (!firestore || !centerId || !target?.id || target.viewedAt) return;
    updateDoc(doc(firestore, 'centers', centerId, 'dailyReports', target.id), {
      viewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch((error) => {
      console.warn('[parent-dashboard] report viewed update failed', error);
    });
  };

  async function submit(type: 'consultation' | 'request' | 'suggestion') {
    if (!firestore || !centerId || !studentId || !user) return;
    let title = '';
    let body = '';
    if (type === 'consultation') {
      title = `상담 신청 (${channel === 'visit' ? '방문' : channel === 'phone' ? '전화' : '온라인'})`;
      body = requestText.trim();
      if (!body) { toast({ variant: 'destructive', title: '입력 확인', description: '상담 요청 내용을 입력해주세요.' }); return; }
    }
    if (type === 'request') {
      title = QUICK_REQUEST_TEMPLATES[quickType];
      body = requestText.trim() || title;
    }
    if (type === 'suggestion') {
      title = '건의사항';
      body = suggestionText.trim();
      if (!body) { toast({ variant: 'destructive', title: '입력 확인', description: '건의사항을 입력해주세요.' }); return; }
    }
    setSubmitting(true);
    try {
      await addDoc(collection(firestore, 'centers', centerId, 'parentCommunications'), {
        studentId, parentUid: user.uid, parentName: user.displayName || '학부모',
        senderRole: 'parent', senderUid: user.uid, senderName: user.displayName || '학부모',
        type, title, body, channel: type === 'consultation' ? channel : null,
        requestCategory: type === 'suggestion' ? 'suggestion' : 'request',
        status: 'requested', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });

      const eventType: ParentActivityEvent['eventType'] =
        type === 'consultation' ? 'consultation_request' : type;
      await logParentActivity(eventType, {
        title,
        channel: type === 'consultation' ? channel : null,
        quickType: type === 'request' ? quickType : null,
      });

      toast({ title: '전송 완료', description: '선생님께 요청이 정상적으로 전달되었습니다.' });
      setRequestText(''); setSuggestionText('');
    } catch (error) {
      toast({ variant: 'destructive', title: '전송 실패', description: '통신 오류가 발생했습니다.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitParentInquiry() {
    if (!firestore || !centerId || !studentId || !user) return;
    const body = parentInquiryBody.trim();
    if (!body) {
      toast({ variant: 'destructive', title: '입력 확인', description: '문의 내용을 입력해 주세요.' });
      return;
    }

    const type: ParentCommunicationRecord['type'] = parentInquiryType === 'suggestion' ? 'suggestion' : 'request';
    const fallbackTitle =
      parentInquiryType === 'question'
        ? '학부모 질의'
        : parentInquiryType === 'request'
          ? '학부모 요청사항'
          : '학부모 건의사항';

    setSubmitting(true);
    try {
      await addDoc(collection(firestore, 'centers', centerId, 'parentCommunications'), {
        studentId,
        parentUid: user.uid,
        parentName: user.displayName || '학부모',
        senderRole: 'parent',
        senderUid: user.uid,
        senderName: user.displayName || '학부모',
        type,
        requestCategory: parentInquiryType,
        title: parentInquiryTitle.trim() || fallbackTitle,
        body,
        status: 'requested',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      void logParentActivity(parentInquiryType === 'suggestion' ? 'suggestion' : 'request', {
        title: parentInquiryTitle.trim() || fallbackTitle,
        requestCategory: parentInquiryType,
      });

      toast({ title: '등록 완료', description: '선생님 또는 센터관리자에게 전달되었습니다.' });
      setParentInquiryType('question');
      setParentInquiryTitle('');
      setParentInquiryBody('');
    } catch (error) {
      toast({ variant: 'destructive', title: '등록 실패', description: '통신 오류가 발생했습니다.' });
    } finally {
      setSubmitting(false);
    }
  }

  const getParentCommunicationTypeBadge = (item: ParentCommunicationRecord) => {
    if (item.type === 'consultation') {
      return <Badge variant="outline" className="border-none bg-blue-100 text-blue-700 font-black text-[10px]">상담 요청</Badge>;
    }
    if (item.requestCategory === 'question') {
      return <Badge variant="outline" className="border-none bg-sky-100 text-sky-700 font-black text-[10px]">질의사항</Badge>;
    }
    if (item.type === 'suggestion' || item.requestCategory === 'suggestion') {
      return <Badge variant="outline" className="border-none bg-violet-100 text-violet-700 font-black text-[10px]">건의사항</Badge>;
    }
    return <Badge variant="outline" className="border-none bg-amber-100 text-amber-700 font-black text-[10px]">요청사항</Badge>;
  };

  const getParentCommunicationStatusBadge = (status?: string) => {
    if (status === 'done') {
      return <Badge variant="outline" className="border-none bg-emerald-100 text-emerald-700 font-black text-[10px]">답변 완료</Badge>;
    }
    if (status === 'in_progress') {
      return <Badge variant="outline" className="border-none bg-blue-100 text-blue-700 font-black text-[10px]">처리 중</Badge>;
    }
    if (status === 'in_review') {
      return <Badge variant="outline" className="border-none bg-amber-100 text-amber-700 font-black text-[10px]">검토 중</Badge>;
    }
    return <Badge variant="secondary" className="font-black text-[10px]">접수됨</Badge>;
  };

  if (!isActive) return null;

  return (
    <div className={cn("relative space-y-4 pb-[calc(6.2rem+env(safe-area-inset-bottom))] md:space-y-5", isMobile ? "px-0" : "mx-auto max-w-5xl px-4")}>
      {growthCelebration && (
        <ParentGrowthCelebration
          celebration={growthCelebration}
          studentName={student?.name || '자녀'}
          onClose={() => setGrowthCelebration(null)}
        />
      )}

      {linkedStudents.length > 1 && (
        <section
          className={cn(
            'rounded-[1.7rem] border border-[#d7e4ff] bg-[linear-gradient(145deg,#ffffff_0%,#f7fbff_100%)] p-4 shadow-sm sm:p-5',
            showEntryMotion && 'parent-card-enter parent-entry-delay-1'
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Parent Profile</p>
              <h3 className="mt-1 text-lg font-black tracking-tight text-[#14295F]">{activeStudentLabel} 학생 화면</h3>
              <p className="mt-1 text-sm font-bold text-slate-500">여러 자녀가 연결된 경우, 확인할 학생을 빠르게 전환할 수 있어요.</p>
            </div>
            <Select value={studentId || linkedStudents[0]?.id || ''} onValueChange={handleStudentChange}>
              <SelectTrigger className="h-12 w-full rounded-[1.1rem] border border-[#d7e4ff] bg-white px-4 text-left font-black text-[#14295F] shadow-sm sm:w-[220px]">
                <SelectValue placeholder="자녀 선택" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border border-slate-200 bg-white">
                {linkedStudents.map((item) => (
                  <SelectItem key={item.id} value={item.id} className="font-bold">
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>
      )}

      <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
        <TabsContent value="home" className="parent-tab-panel mt-0 space-y-4 sm:space-y-5">
          <section
            className={cn(
              'relative overflow-hidden rounded-[2.25rem] border border-[#d7e5ff] bg-[linear-gradient(145deg,#ffffff_0%,#edf4ff_56%,#fff5e8_100%)] p-5 shadow-[0_12px_26px_rgba(20,41,95,0.10)] sm:p-6',
              showEntryMotion && 'parent-hero-enter parent-entry-delay-2'
            )}
          >
            <div className="soft-glow absolute -right-8 top-2 h-24 w-24 rounded-full bg-[#ffb979]/35 blur-3xl" />
            <div className="soft-glow absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-[#9bbcff]/30 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,41,95,0.08),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,122,22,0.10),transparent_32%)]" />

            <div className="relative z-10 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline" className="h-7 rounded-full border border-white/80 bg-white/85 px-3 text-[11px] font-black text-[#14295F] shadow-sm">
                  {today ? format(today, 'yyyy. MM. dd (EEE)', { locale: ko }) : '오늘'}
                </Badge>
                <div className="flex items-center gap-2 rounded-full border border-[#d8e6ff] bg-white/85 px-3 py-1.5 shadow-sm">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]">실시간 앱 모니터링</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#7081a1]">Parent App Summary</p>
                <div className="space-y-2">
                  <p className="text-[12px] font-black tracking-tight text-[#14295F]/70">{student?.name || '자녀'} 학생 현황</p>
                  <h2 className="max-w-[18ch] break-keep text-[1.38rem] font-black leading-[1.16] tracking-[-0.045em] text-[#14295F] sm:text-[1.82rem] md:max-w-none md:text-[2.15rem]">
                    {heroTone.title}
                  </h2>
                  <p className="max-w-2xl break-keep text-[13.5px] font-bold leading-[1.72] text-slate-600 sm:text-sm md:text-[15px]">
                    {heroTone.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={cn('h-7 rounded-full border px-3 text-[11px] font-black shadow-sm', heroTone.badgeClassName)}>
                  {heroTone.badgeLabel}
                </Badge>
                {growthCelebrationCandidate && (
                  <Badge variant="outline" className="h-7 rounded-full border border-[#ffd6ac] bg-[#fff6ec] px-3 text-[11px] font-black text-[#FF7A16] shadow-sm">
                    평균 대비 +{growthCelebrationCandidate.increaseRate}%
                  </Badge>
                )}
                <Badge variant="outline" className="h-7 rounded-full border border-[#d8e6ff] bg-[#eef4ff] px-3 text-[11px] font-black text-[#14295F] shadow-sm">
                  출결 {attendanceStatus.label.split('(')[0].trim()}
                </Badge>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-[minmax(0,1.16fr)_minmax(0,1.16fr)_minmax(0,0.92fr)_minmax(0,0.92fr)] xl:gap-4">
            <ParentMetricCardShell
              tone="study"
              className={cn(
                'md:min-h-[12.2rem] lg:min-h-[13rem]',
                showEntryMotion && 'parent-card-enter parent-entry-delay-3'
              )}
            >
              <div className="relative flex h-full flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_6.2rem] lg:grid-cols-[minmax(0,1fr)_8.4rem] lg:gap-4">
                <div className="min-w-0 space-y-2.5 pr-[5.7rem] sm:pr-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#56739f]">오늘 공부</span>
                    {growthCelebrationCandidate ? (
                      <Badge variant="outline" className="h-6 rounded-full border border-[#d4e3ff] bg-white/90 px-2.5 text-[10px] font-black text-[#204ca3]">
                        +{growthCelebrationCandidate.increaseRate}%
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="h-6 rounded-full border border-[#d4e3ff] bg-white/90 px-2.5 text-[10px] font-black text-[#204ca3]">
                        7일 흐름
                      </Badge>
                    )}
                  </div>
                  <ParentDurationValue minutes={totalMinutes} className="text-[1.4rem] sm:text-[1.72rem] lg:text-[1.92rem]" />
                  <p className="text-[11px] font-bold leading-5 text-slate-500">
                    최근 평균 {previous7DayAverageMinutes > 0 ? toHm(previous7DayAverageMinutes) : '기록 대기'}
                  </p>
                  <div className="flex items-center justify-between gap-2 rounded-[1rem] border border-white/80 bg-white/84 px-3 py-2 shadow-[0_10px_18px_-18px_rgba(20,41,95,0.24)]">
                    <p className="whitespace-nowrap break-keep text-[9px] font-black uppercase tracking-[0.08em] text-[#56739f]">전일 대비</p>
                    <p className="whitespace-nowrap text-right text-[12px] font-black text-[#14295F]">
                      {studyTrendHasActivity ? formatSignedMinutes(studyDeltaFromYesterday) : '기록 대기'}
                    </p>
                  </div>
                </div>
                <div className="absolute right-0 -top-1 w-[4.8rem] sm:static sm:flex sm:min-w-0 sm:items-center sm:justify-end sm:w-auto">
                  <ParentMetricSparkline
                    tone="study"
                    points={dailyStudyTrend.map((point) => ({
                      label: point.date,
                      value: studyTrendHasActivity ? point.minutes : null,
                    }))}
                    label="7일 흐름"
                    valueLabel={studyTrendHasActivity ? `최고 ${toHm(studyTrendPeakMinutes)}` : '기록 대기'}
                    className="w-full"
                  />
                </div>
              </div>
            </ParentMetricCardShell>

            <ParentMetricCardShell
              tone="plan"
              className={cn(
                'md:min-h-[12.2rem] lg:min-h-[13rem]',
                showEntryMotion && 'parent-card-enter parent-entry-delay-3'
              )}
            >
              <div className="relative flex h-full flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_6.2rem] lg:grid-cols-[minmax(0,1fr)_8.4rem] lg:gap-4">
                <div className="min-w-0 space-y-2.5 pr-[5.7rem] sm:pr-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#c66a13]">계획 달성</span>
                    <Badge variant="outline" className="h-6 rounded-full border border-[#ffd8ab] bg-white/90 px-2.5 text-[10px] font-black text-[#b45f0d]">
                      {planTotal > 0 ? `오늘 ${planDone}/${planTotal}` : '계획 대기'}
                    </Badge>
                  </div>
                  <ParentStatValue value={planRate} unit="%" className="text-[1.44rem] sm:text-[1.76rem] lg:text-[1.96rem]" unitClassName="text-[#d09248]" />
                  <p className="text-[11px] font-bold leading-5 text-slate-500">
                    주간 평균 {planTrendActiveDays > 0 ? `${planTrendAverageRate}%` : '계획 대기'}
                  </p>
                  <div className="flex items-center justify-between gap-2 rounded-[1rem] border border-white/80 bg-white/84 px-3 py-2 shadow-[0_10px_18px_-18px_rgba(210,109,18,0.24)]">
                    <p className="whitespace-nowrap break-keep text-[9px] font-black uppercase tracking-[0.08em] text-[#c66a13]">완료일</p>
                    <p className="whitespace-nowrap text-right text-[12px] font-black text-[#9b5910]">
                      {planTrendActiveDays > 0 ? `${planTrendCompletedDays}/${planTrendActiveDays}일` : '최근 7일 대기'}
                    </p>
                  </div>
                </div>
                <div className="absolute right-0 -top-1 w-[4.8rem] sm:static sm:flex sm:min-w-0 sm:items-center sm:justify-end sm:w-auto">
                  <ParentMetricSparkline
                    tone="plan"
                    points={dailyPlanTrend.map((point) => ({
                      label: point.date,
                      value: point.rate,
                    }))}
                    label="7일 달성률"
                    valueLabel={planTrendActiveDays > 0 ? `평균 ${planTrendAverageRate}%` : '계획 대기'}
                    className="w-full"
                  />
                </div>
              </div>
            </ParentMetricCardShell>

            <ParentMetricCardShell
              tone="attendance"
              className={cn(
                'md:min-h-[11rem] lg:min-h-[11.4rem]',
                showEntryMotion && 'parent-card-enter parent-entry-delay-4'
              )}
            >
              <div className="flex h-full flex-col justify-between gap-3">
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#477281]">출결 상태</span>
                    <Badge variant="outline" className="h-6 rounded-full border border-[#d4eaef] bg-white/90 px-2.5 text-[10px] font-black text-[#245565]">
                      실시간
                    </Badge>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[1.2rem] border border-white/80 bg-white/88 shadow-[0_10px_16px_-16px_rgba(27,114,141,0.36)]">
                      <attendanceStatus.icon className="h-[1.125rem] w-[1.125rem] text-[#1b728d]" />
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#245565]">앱 연동 중</span>
                      </div>
                      <p className="break-keep text-[1rem] font-black leading-[1.18] tracking-[-0.03em] text-[#14295F] sm:text-[1.08rem]">
                        {attendanceStatus.label}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[1rem] border border-white/80 bg-white/84 px-3 py-2.5 shadow-[0_10px_16px_-16px_rgba(27,114,141,0.22)]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#477281]">오늘 출결 기록</p>
                    <p className="text-[10px] font-black text-[#245565]">{todayAttendanceTimeSummary.dateLabel}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-[0.9rem] border border-[#d6eaef] bg-white/92 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#5b7d88]">등원</p>
                      <p className="mt-1 text-[13px] font-black tracking-tight text-[#14295F]">
                        {todayAttendanceTimeSummary.checkInLabel}
                      </p>
                    </div>
                    <div className="rounded-[0.9rem] border border-[#d6eaef] bg-white/92 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#5b7d88]">하원</p>
                      <p className="mt-1 text-[13px] font-black tracking-tight text-[#14295F]">
                        {todayAttendanceTimeSummary.checkOutLabel}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] font-bold leading-5 text-slate-500">앱에서 실시간 출결 시각 기준</p>
                </div>
              </div>
            </ParentMetricCardShell>

            <ParentMetricCardShell
              tone="penalty"
              interactive
              role="button"
              onClick={() => setIsPenaltyGuideOpen(true)}
              className={cn(
                'md:min-h-[11rem] lg:min-h-[11.4rem]',
                showEntryMotion && 'parent-card-enter parent-entry-delay-4'
              )}
            >
              <div className="flex h-full flex-col justify-between gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d24664]">벌점 지수</span>
                    <ParentStatValue
                      value={penaltyRecovery.effectivePoints}
                      unit="점"
                      className="text-[1.52rem] text-rose-700 sm:text-[1.78rem] lg:text-[1.96rem]"
                      unitClassName="text-rose-400"
                    />
                  </div>
                  <Badge variant="outline" className={cn('h-6 rounded-full border px-2.5 text-[10px] font-black', penaltyMeta.badge)}>
                    {penaltyMeta.label}
                  </Badge>
                </div>
                <div className="rounded-[1rem] border border-white/80 bg-white/84 px-3 py-2 shadow-[0_10px_16px_-16px_rgba(210,70,100,0.22)]">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#d24664]">최근 벌점 사유</p>
                    <p className="text-[11px] font-black text-rose-500">
                      {latestPenaltyHighlight ? `+${latestPenaltyHighlight.points}점` : '기록 없음'}
                    </p>
                  </div>
                  {latestPenaltyHighlight ? (
                    <>
                      <p className="line-clamp-2 break-keep text-[12px] font-black leading-5 text-[#7a1d35]">
                        {latestPenaltyHighlight.reason}
                      </p>
                      <p className="mt-2 text-[11px] font-bold leading-5 text-slate-500">
                        {latestPenaltyHighlight.dateLabel} · 원점수 {penaltyRecovery.basePoints}점
                        {penaltyRecovery.recoveredPoints > 0 ? ` · 회복 -${penaltyRecovery.recoveredPoints}점` : ''}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[12px] font-black text-[#7a1d35]">최근 벌점 기록 없음</p>
                      <p className="mt-2 text-[11px] font-bold leading-5 text-slate-500">
                        원점수 {penaltyRecovery.basePoints}점
                        {penaltyRecovery.recoveredPoints > 0 ? ` · 회복 -${penaltyRecovery.recoveredPoints}점` : ' · 회복 기록 대기'}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </ParentMetricCardShell>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.06fr_0.94fr]">
            <Card
              role="button"
              tabIndex={0}
              onClick={handleOpenReportsArchive}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleOpenReportsArchive();
                }
              }}
              className={cn(
                'group relative overflow-hidden rounded-[2rem] border border-[#d7e4ff] bg-[linear-gradient(145deg,#ffffff_0%,#eef4ff_60%,#fff4e8_100%)] p-5 shadow-sm ring-1 ring-[#d7e4ff]/70 transition-[transform,box-shadow] active:scale-[0.99] md:hover:-translate-y-0.5 md:hover:shadow-[0_20px_36px_-24px_rgba(20,41,95,0.32)] sm:p-6',
                showEntryMotion && 'parent-card-enter parent-entry-delay-4'
              )}
            >
              <div className="absolute right-0 top-0 p-4 opacity-[0.04] transition-transform duration-700 group-hover:rotate-12">
                <MessageCircle className="h-20 w-20 text-[#14295F]" />
              </div>
              <div className="relative z-10 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#FF7A16]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#14295F]">우리 아이 리포트</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {report?.viewedAt ? (
                      <Badge variant="outline" className="h-6 rounded-full border-none bg-emerald-100 px-2.5 text-[10px] font-black text-emerald-700">
                        읽음
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="h-6 rounded-full border-none bg-[#FF7A16]/12 px-2.5 text-[10px] font-black text-[#FF7A16]">
                        새 리포트
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </div>
                </div>
                <div className="space-y-2 rounded-[1.6rem] border border-white/80 bg-white/80 p-4 shadow-[0_8px_18px_rgba(20,41,95,0.06)]">
                  <p className="text-sm font-black tracking-tight text-[#14295F]">
                    오늘 부모님이 가장 먼저 보셔야 할 내용
                  </p>
                  <p className="line-clamp-4 break-keep text-sm font-bold leading-relaxed text-slate-700">
                    {report?.content || '카드를 누르면 자녀의 최근 학습 리포트와 선생님 피드백을 바로 확인할 수 있습니다.'}
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className={cn(
                'rounded-[2rem] border border-[#d7e4ff] bg-[linear-gradient(145deg,#f8fbff_0%,#ffffff_72%,#fff8f0_100%)] p-5 shadow-sm sm:p-6',
                showEntryMotion && 'parent-card-enter parent-entry-delay-5'
              )}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-[#14295F]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">최근 알림 3개</span>
                </div>
                <div className="flex items-center gap-2">
                  {unreadRecentCount > 0 && (
                    <Badge variant="outline" className="h-6 rounded-full border-none bg-[#FF7A16]/15 px-2.5 text-[10px] font-black text-[#FF7A16]">
                      미읽음 {unreadRecentCount}
                    </Badge>
                  )}
                  <Badge variant="outline" className="h-6 rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-black text-slate-500">
                    {recentNotifications.length}건
                  </Badge>
                </div>
              </div>
              <p className="mb-3 text-[11px] font-bold text-slate-500">터치하면 상세 내용을 바로 확인할 수 있어요.</p>

              {recentNotifications.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-[11px] font-bold text-slate-400">
                  최근 알림이 없습니다.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentNotifications.map((notification) => {
                    const isRead = notification.isRead || !!readMap[notification.id];

                    return (
                      <button
                        type="button"
                        key={notification.id}
                        className={cn(
                          'relative w-full overflow-hidden rounded-[1.45rem] border p-4 text-left transition-all',
                          isRead
                            ? 'border-[#dde6f9] bg-white'
                            : 'border-[#ffcf9e] bg-[linear-gradient(135deg,#fff7ef_0%,#eef4ff_100%)] shadow-sm ring-1 ring-[#ffd29f]/70 md:hover:shadow-md'
                        )}
                        onClick={() => void openNotificationDetail(notification)}
                      >
                        {!isRead && (
                          <>
                            <div className="pointer-events-none absolute -right-5 -top-5 h-16 w-16 rounded-full bg-[#FF7A16]/20 blur-xl" />
                            <Sparkles className="pointer-events-none absolute right-3 top-3 h-3.5 w-3.5 text-[#FF7A16]" />
                          </>
                        )}
                        <div className="relative z-10 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black tracking-tight text-[#14295F]">{notification.title}</p>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                              {notification.createdAtLabel} · {isRead ? '읽음' : '미확인'}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {!isRead && (
                              <span className="relative inline-flex h-2.5 w-2.5">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-[#FF7A16] opacity-70 animate-ping" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#FF7A16]" />
                              </span>
                            )}
                            {notification.isImportant && (
                              <Badge variant="outline" className="h-5 rounded-full border-none bg-orange-100 px-2 text-[10px] font-black text-[#FF7A16]">
                                중요
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                className={cn(
                  'h-14 w-full rounded-[1.7rem] bg-[#14295F] text-base font-black text-white shadow-[0_14px_28px_rgba(20,41,95,0.20)] transition-all active:scale-[0.98] hover:bg-[#10224f]',
                  showEntryMotion && 'parent-card-enter parent-entry-delay-5'
                )}
              >
                <TrendingUp className="mr-2 h-5 w-5" />
                인공지능 학습 인사이트 보기
                <ChevronRight className="ml-auto h-4 w-4 opacity-40" />
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[3rem] border-none p-0 shadow-2xl overflow-hidden sm:max-w-md">
              <div className="relative bg-[#14295F] p-10 text-white">
                <Sparkles className="absolute right-0 top-0 h-32 w-32 p-8 opacity-20" />
                <DialogTitle className="text-2xl font-black tracking-tighter text-white">인공지능 학습 인사이트</DialogTitle>
                <DialogDescription className="mt-1 text-xs font-bold text-white/70">
                  자녀의 학습 패턴을 차분하고 보기 쉽게 정리했습니다.
                </DialogDescription>
              </div>
              <div className="space-y-3 bg-[#fafafa] p-6">
                {aiInsights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:border-orange-200">
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#FF7A16]" />
                    <p className="text-sm font-bold leading-relaxed text-slate-700">{insight}</p>
                  </div>
                ))}
              </div>
              <DialogFooter className="border-t bg-white p-6">
                <DialogClose asChild>
                  <Button className="h-14 w-full rounded-2xl bg-[#14295F] text-lg font-black text-white">확인했습니다</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

            <TabsContent value="studyDetail" className="parent-tab-panel mt-0 space-y-4 sm:space-y-5">
              {/* 주간 성과 요약 (기존 리포트 내용 통합) */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Card className="rounded-[1.5rem] border-none bg-white p-4 ring-1 ring-slate-100 text-center shadow-sm">
                  <span className="text-[10px] font-black text-slate-500 block mb-2 uppercase tracking-widest">주간 누적 트랙</span>
                  <div className="flex items-baseline justify-center gap-0.5 flex-wrap leading-tight">
                    {Math.floor(weeklyTotalStudyMinutes / 60) > 0 && (
                      <>
                        <span className="dashboard-number text-2xl text-[#14295F] tabular-nums leading-none">{Math.floor(weeklyTotalStudyMinutes / 60)}</span>
                        <span className="text-[11px] font-black text-[#14295F]/50 mr-0.5">시간</span>
                      </>
                    )}
                    <span className="dashboard-number text-2xl text-[#14295F] tabular-nums leading-none">{(weeklyTotalStudyMinutes % 60).toString().padStart(2, '0')}</span>
                    <span className="text-[11px] font-black text-[#14295F]/50">분</span>
                  </div>
                </Card>
                <Card className="rounded-[1.5rem] border-none bg-white p-6 ring-1 ring-slate-100 text-center shadow-sm">
                  <span className="text-[10px] font-black text-slate-500 block mb-2 uppercase tracking-widest">평균 목표 달성</span>
                  <p className="dashboard-number text-2xl text-[#FF7A16]">{weeklyPlanCompletionRate}%</p>
                </Card>
              </div>

              <div className="flex flex-col gap-3 px-1 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col">
                  <h3 className="text-xl font-black tracking-tighter text-[#14295F]">기록트랙</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">학습 일관성 맵</p>
                </div>
                <div className="relative flex items-center gap-2 overflow-hidden rounded-[1.15rem] border border-[#14295F]/10 bg-[linear-gradient(180deg,#ffffff_0%,#f5f8ff_100%)] p-1.5 shadow-[0_18px_36px_-28px_rgba(20,41,95,0.24)] ring-1 ring-white/70">
                  <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-white/85" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[0.9rem] bg-white/75 text-[#14295F] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] hover:bg-[#14295F]/5" onClick={() => setCurrentCalendarDate(subMonths(currentCalendarDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                  <div className="flex min-w-[86px] items-center justify-center rounded-[0.95rem] border border-white/80 bg-white/92 px-4 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_14px_28px_-24px_rgba(20,41,95,0.24)]">
                    <span className="text-[11px] font-black text-[#14295F]">{format(currentCalendarDate, 'yyyy년 M월')}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[0.9rem] bg-white/75 text-[#14295F] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] hover:bg-[#14295F]/5" onClick={() => setCurrentCalendarDate(addMonths(currentCalendarDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>

              <Card className="relative overflow-hidden rounded-[2.5rem] border border-[#14295F]/8 bg-[radial-gradient(circle_at_top_left,rgba(20,41,95,0.06),transparent_26%),linear-gradient(180deg,#ffffff_0%,#f7f9ff_100%)] shadow-[0_28px_70px_-52px_rgba(20,41,95,0.28)] ring-1 ring-white/70">
                <div className={cn("flex flex-wrap items-center justify-between gap-2 border-b border-[#14295F]/10", isMobile ? "px-3 py-3" : "px-5 py-4")}>
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#14295F]/50">학습 흐름</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PARENT_CALENDAR_LEGEND.map((item) => (
                      <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/75 bg-white/92 px-2.5 py-1 text-[8px] font-black text-slate-500 shadow-[0_10px_22px_-20px_rgba(20,41,95,0.14)] sm:text-[9px]">
                        <span className={cn("h-2.5 w-2.5 rounded-full bg-gradient-to-br ring-1", item.swatch)} />
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className={cn(
                  "grid grid-cols-7 border-b border-[#14295F]/10",
                  isMobile ? "gap-1 px-1.5 py-1.5" : "gap-1.5 px-4 py-3"
                )}>
                  {['월', '화', '수', '목', '금', '토', '일'].map((day, i) => (
                    <div key={day} className={cn(
                      isMobile ? "py-1.5 text-[8px]" : "py-3 text-[11px]",
                      "rounded-2xl border border-white/80 bg-white/90 text-center font-black uppercase tracking-widest shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]",
                      i === 5 ? "text-blue-600" : i === 6 ? "text-rose-600" : "text-[#14295F]/75"
                    )}>{day}</div>
                  ))}
                </div>
                <div className={cn("grid grid-cols-7 auto-rows-fr bg-[radial-gradient(circle_at_top_left,rgba(20,41,95,0.02),transparent_45%)]", isMobile ? "gap-1 p-1.5" : "gap-2.5 p-3")}>
                  {logsLoading ? (
                    <div className="col-span-7 h-[300px] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-[#14295F] opacity-20" /></div>
                  ) : calendarData.map((day, idx) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const log = allLogs?.find(l => l.dateKey === dateKey);
                    const minutes = log?.totalMinutes || 0;
                    const isCurrentMonth = isSameMonth(day, currentCalendarDate);
                    const isTodayCalendar = isSameDay(day, new Date());
                    const hasPlans = (weeklyPlans || []).some((plan) => plan.dateKey === dateKey);
                    const hasDeepFocus = isCurrentMonth && minutes >= 180;
                    const hasStatusCluster = isCurrentMonth && (hasPlans || hasDeepFocus);
                    const timeLabel = isCurrentMonth ? formatMinutes(minutes) : '--';

                    return (
                      <button
                        type="button"
                        key={dateKey}
                        onClick={() => setSelectedCalendarDate(day)}
                        className={cn(
                          "group relative overflow-hidden rounded-[1.15rem] text-left transition-all duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A16]/30",
                          isMobile ? "aspect-square min-h-0 p-1" : "min-h-[150px] p-3",
                          !isCurrentMonth ? "bg-[linear-gradient(180deg,rgba(248,250,252,0.9)_0%,rgba(255,255,255,0.96)_100%)] opacity-[0.38] grayscale-[0.05] ring-1 ring-slate-200/75" : getHeatmapColor(minutes),
                          isCurrentMonth && "hover:-translate-y-[1px] hover:shadow-[0_18px_36px_-24px_rgba(20,41,95,0.32)] active:translate-y-0",
                          isTodayCalendar && "z-10 -translate-y-[1px] ring-2 ring-inset ring-[#FF7A16]/35 shadow-[0_20px_40px_-22px_rgba(20,41,95,0.22)]"
                        )}
                      >
                        {isTodayCalendar && <div className="pointer-events-none absolute -inset-0.5 rounded-[1.3rem] border border-[#FF7A16]/20" />}
                        <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-white/90" />
                        {isCurrentMonth && (
                          <div className={cn("pointer-events-none absolute", isMobile ? "inset-x-2 bottom-7" : "inset-x-3 bottom-[4.1rem]")}>
                            <div className={cn("h-[4px] rounded-full bg-gradient-to-r opacity-100", getCalendarAccentClass(minutes))} />
                          </div>
                        )}
                        <div className={cn("relative z-10 flex justify-between items-start gap-1.5", isMobile ? "mb-0.5" : "mb-2.5")}>
                          <span
                            className={cn(
                              "inline-flex items-center justify-center rounded-full border font-black tracking-tighter tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
                              isMobile ? "text-[9px] min-w-[1.35rem] px-1 py-[0.2rem]" : "text-xs min-w-[2rem] px-2 py-1",
                              idx % 7 === 5 && isCurrentMonth ? "border-blue-100 bg-blue-50 text-blue-700" : idx % 7 === 6 && isCurrentMonth ? "border-rose-100 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-700",
                              isTodayCalendar && "border-[#FFD1A9] text-[#14295F]"
                            )}
                          >
                            {format(day, 'd')}
                          </span>
                          {hasStatusCluster ? (
                            <div className={cn("inline-flex items-center gap-1 rounded-full border border-slate-200/85 bg-white/96 shadow-[0_10px_20px_-18px_rgba(20,41,95,0.24)]", isMobile ? "px-1 py-[0.2rem]" : "px-2 py-1")}>
                              {hasPlans && <span className={cn("rounded-full bg-[#14295F]", isMobile ? "h-1.5 w-1.5" : "h-2 w-2")} />}
                              {hasDeepFocus && <Zap className={cn("text-orange-500 fill-orange-500", isMobile ? "h-2 w-2" : "h-3 w-3")} />}
                            </div>
                          ) : (
                            <span className={cn(isMobile ? "h-4 w-4" : "h-6 w-6")} aria-hidden="true" />
                          )}
                        </div>
                        <div className={cn("absolute left-0 right-0", isMobile ? "bottom-1 px-0.5" : "bottom-2 px-2")}>
                          <div
                            className={cn(
                              "overflow-hidden rounded-[0.95rem] border bg-white text-center whitespace-nowrap shadow-[0_16px_26px_-22px_rgba(20,41,95,0.26)]",
                              isMobile ? "px-1.5 py-1" : "px-2.5 py-2",
                              getCalendarTimeCapsuleClass(minutes, isCurrentMonth)
                            )}
                          >
                            {isMobile ? (
                              <span className="dashboard-number block tabular-nums text-[0.78rem] leading-none tracking-[-0.05em]">
                                {timeLabel}
                              </span>
                            ) : (
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="min-w-0 truncate text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                                  공부시간
                                </span>
                                <span className="dashboard-number ml-auto shrink-0 tabular-nums text-[1rem] leading-none tracking-[-0.05em]">
                                  {timeLabel}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        {!isMobile && isCurrentMonth && (
                          <div className="pointer-events-none absolute inset-x-3 bottom-12">
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                              {minutes > 0 ? '오늘 학습 기록' : '기록 대기'}
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Card>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Card className="rounded-[1.5rem] border-none shadow-sm bg-white p-5 ring-1 ring-slate-100">
                  <CardTitle className="text-[10px] font-black tracking-tight mb-4 flex items-center gap-2 text-slate-500 uppercase">
                    <PieChartIcon className="h-3.5 w-3.5 text-[#FF7A16]" /> 과목별 학습 비중
                  </CardTitle>
                  <div className="space-y-4">
                    {subjectsData.slice(0, 2).map((s) => {
                      const ratio = Math.min(100, Math.round((s.minutes / (subjectTotalMinutes || 1)) * 100));
                      return (
                        <div key={s.subject} className="space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                            <span>{s.subject}</span>
                            <span className="font-black">{ratio}%</span>
                          </div>
                          <Progress value={ratio} className="h-1 bg-slate-100" />
                        </div>
                      );
                    })}
                  </div>
                </Card>

                <Dialog>
                  <DialogTrigger asChild>
                    <Card className="rounded-[1.5rem] border border-orange-200 bg-orange-50 p-5 flex flex-col justify-center items-center text-center gap-2 cursor-pointer active:scale-95 transition-all">
                      <BarChart3 className="h-6 w-6 text-[#FF7A16]" />
                      <div className="grid gap-0.5 text-[#14295F]">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#B85A00]">주간 상세</span>
                        <span className="text-xs font-black">성과 상세 분석</span>
                      </div>
                    </Card>
                  </DialogTrigger>
                  <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-lg">
                    <div className="bg-[#14295F] p-10 text-white relative">
                      <DialogTitle className="text-3xl font-black tracking-tighter text-left text-white">주간 성과 데이터</DialogTitle>
                      <DialogDescription className="text-white/70 font-bold mt-1 text-sm">최근 7일간의 학습 지표 및 피드백입니다.</DialogDescription>
                    </div>
                    <div className="p-8 space-y-10 bg-white overflow-y-auto max-h-[60vh] custom-scrollbar">
                      <div className="space-y-4">
                        <h4 className="text-xs font-black uppercase text-[#14295F] tracking-[0.2em] ml-1">일별 집중 시간 (분)</h4>
                        <div className="h-48 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsLineChart data={dailyStudyTrend}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                              <XAxis dataKey="date" fontSize={10} fontWeight="800" axisLine={false} tickLine={false} />
                              <YAxis fontSize={10} fontWeight="800" axisLine={false} tickLine={false} width={30} />
                              <Tooltip contentStyle={{borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)'}} />
                              <Line type="monotone" dataKey="minutes" stroke="#FF7A16" strokeWidth={4} dot={{ r: 4, fill: '#fff', stroke: '#FF7A16', strokeWidth: 2 }} />
                            </RechartsLineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="p-6 rounded-[2rem] bg-orange-50/50 border border-orange-100">
                        <p className="text-[10px] font-black text-[#FF7A16] uppercase mb-2 tracking-widest">선생님 종합 피드백</p>
                        <p className="text-base font-bold text-slate-700 leading-relaxed">"{weeklyFeedback}"</p>
                      </div>
                    </div>
                    <DialogFooter className="p-6 bg-white border-t">
                      <DialogClose asChild><Button className="w-full h-14 rounded-2xl font-black text-lg bg-[#14295F] text-white">확인 완료</Button></DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>

            <TabsContent value="data" className="parent-tab-panel mt-0 space-y-4 sm:space-y-5">
              <Card
                className={cn(
                  'overflow-hidden rounded-[2.15rem] border border-[#dfe7fb] bg-[linear-gradient(180deg,#fbfdff_0%,#ffffff_58%,#f5f8ff_100%)] p-5 shadow-[0_24px_54px_-42px_rgba(20,41,95,0.28)] sm:p-6',
                  showEntryMotion && 'parent-card-enter parent-entry-delay-2'
                )}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#d8e4ff] bg-white/92 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#5472a4] shadow-sm">
                      <FileText className="h-3.5 w-3.5 text-[#14295F]" />
                      학습 분석 리포트
                    </div>
                    <h3 className="mt-3 break-keep text-[1.28rem] font-black tracking-tight text-[#14295F] sm:text-[1.42rem]">
                      {activeStudentLabel} 학생의 최근 학습 흐름을
                      <br className="hidden sm:block" />
                      차분하게 읽을 수 있게 정리했어요
                    </h3>
                    <p className="mt-2 break-keep text-[12.5px] font-bold leading-[1.7] text-slate-500 sm:text-[13px]">
                      최근 42일 학습시간과 최근 14일 리듬 데이터를 바탕으로, 학부모님이 핵심 변화만 빠르게 파악할 수 있게 구성했습니다.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                    <Badge variant="outline" className="h-8 justify-center rounded-full border border-[#d9e6ff] bg-white/92 px-4 text-[10px] font-black text-[#14295F] shadow-sm">
                      최근 6주 학습시간
                    </Badge>
                    <Badge variant="outline" className="h-8 justify-center rounded-full border border-[#d7f0e6] bg-white/92 px-4 text-[10px] font-black text-[#15836b] shadow-sm">
                      최근 14일 리듬
                    </Badge>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <ParentAnalyticsCard
                  tone="growth"
                  icon={<BarChart3 className="h-[18px] w-[18px]" />}
                  title="주간 학습시간 성장률"
                  description="주간 누적 학습시간과 전주 대비 성장률을 함께 봐서 실제 개선 속도를 읽습니다."
                  badge={hasWeeklyGrowthData ? `이번 주 ${toSignedPercentLabel(latestWeeklyLearningGrowthPercent)}` : '데이터 대기'}
                  insight={weeklyGrowthInsight.trend}
                  className={showEntryMotion ? 'parent-card-enter parent-entry-delay-3' : undefined}
                >
                  {hasWeeklyGrowthData ? (
                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={weeklyGrowthData} margin={{ top: 8, right: 6, left: -12, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7eefb" />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} />
                          <YAxis yAxisId="mins" tickLine={false} axisLine={false} width={34} tickFormatter={(value) => minutesToAxisLabel(Number(value))} />
                          <YAxis yAxisId="growth" orientation="right" tickLine={false} axisLine={false} width={32} domain={[-100, 100]} tickFormatter={(value) => `${value}%`} />
                          <Tooltip
                            contentStyle={{ borderRadius: '1rem', border: '1px solid #d7e3fb', boxShadow: '0 18px 36px rgba(20,41,95,0.12)' }}
                            formatter={(value: number, name: string) => {
                              if (name === 'totalMinutes') return [toHm(Math.round(Number(value || 0))), '주간 학습시간'];
                              return [`${Math.round(Number(value || 0))}%`, '전주 대비 성장률'];
                            }}
                          />
                          <Bar yAxisId="mins" dataKey="totalMinutes" fill="#cadeff" radius={[8, 8, 0, 0]} barSize={22} isAnimationActive={!prefersReducedMotion} />
                          <Line yAxisId="growth" type="monotone" dataKey="growth" stroke="#10b981" strokeWidth={2.8} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 4, fill: '#10b981' }} isAnimationActive={!prefersReducedMotion} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex h-[220px] items-center justify-center rounded-[1.2rem] border border-dashed border-[#d8e5ff] bg-white/80 text-center text-sm font-bold text-slate-400">
                      최근 6주 학습 데이터가 아직 충분하지 않습니다.
                    </div>
                  )}
                </ParentAnalyticsCard>

                <ParentAnalyticsCard
                  tone="rhythm"
                  icon={<Activity className="h-[18px] w-[18px]" />}
                  title="학습 리듬 추이"
                  description="비슷한 흐름으로 공부를 시작하고 유지하는 안정감을 점수로 확인합니다."
                  badge={hasRhythmScoreOnlyTrend ? `평균 ${averageRhythmScore}점` : '기록 대기'}
                  insight={rhythmInsight.trend}
                  className={showEntryMotion ? 'parent-card-enter parent-entry-delay-3' : undefined}
                >
                  {hasRhythmScoreOnlyTrend ? (
                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={rhythmScoreOnlyTrend} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
                          <defs>
                            <linearGradient id="parent-rhythm-area" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#8BE4C7" stopOpacity={0.38} />
                              <stop offset="100%" stopColor="#8BE4C7" stopOpacity={0.04} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dff1ea" />
                          <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={10} />
                          <YAxis tickLine={false} axisLine={false} width={28} domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{ borderRadius: '1rem', border: '1px solid #d7f0e7', boxShadow: '0 18px 36px rgba(16,185,129,0.12)' }}
                            formatter={(value: number) => [`${Math.round(Number(value || 0))}점`, '리듬 점수']}
                          />
                          <Area type="monotone" dataKey="score" stroke="none" fill="url(#parent-rhythm-area)" isAnimationActive={!prefersReducedMotion} />
                          <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} dot={{ r: 2.5, fill: '#0f766e' }} activeDot={{ r: 4, fill: '#0f766e' }} isAnimationActive={!prefersReducedMotion} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex h-[220px] items-center justify-center rounded-[1.2rem] border border-dashed border-[#d7f0e7] bg-white/80 text-center text-sm font-bold text-slate-400">
                      최근 14일 리듬 점수를 계산할 기록이 부족합니다.
                    </div>
                  )}
                </ParentAnalyticsCard>

                <ParentAnalyticsCard
                  tone="window"
                  icon={<Clock3 className="h-[18px] w-[18px]" />}
                  title="공부 시작/종료 시간 추이"
                  description="시작 시간은 일정하게, 종료 시간은 무리 없이 유지되는지를 함께 확인합니다."
                  badge={hasStartEndTimeData ? `평균 시작 ${analyticsAverageStartLabel}` : '기록 대기'}
                  insight={startEndInsight.trend}
                  className={showEntryMotion ? 'parent-card-enter parent-entry-delay-4' : undefined}
                >
                  {hasStartEndTimeData ? (
                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsLineChart data={startEndTimeTrendData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaedff" />
                          <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={10} />
                          <YAxis tickLine={false} axisLine={false} width={40} domain={startEndYAxisDomain} tickFormatter={(value) => hourToClockLabel(Number(value))} />
                          <Tooltip
                            contentStyle={{ borderRadius: '1rem', border: '1px solid #dde4ff', boxShadow: '0 18px 36px rgba(83,99,255,0.10)' }}
                            formatter={(value: number, name: string) => {
                              if (name === 'startHour') return [hourToClockLabel(Number(value || 0)), '공부 시작'];
                              return [hourToClockLabel(Number(value || 0)), '공부 종료'];
                            }}
                          />
                          <Line type="monotone" dataKey="startHour" stroke="#0ea5e9" strokeWidth={2.8} dot={{ r: 2.5, fill: '#0ea5e9' }} activeDot={{ r: 4, fill: '#0ea5e9' }} connectNulls={false} isAnimationActive={!prefersReducedMotion} />
                          <Line type="monotone" dataKey="endHour" stroke="#8b5cf6" strokeWidth={2.8} dot={{ r: 2.5, fill: '#8b5cf6' }} activeDot={{ r: 4, fill: '#8b5cf6' }} connectNulls={false} isAnimationActive={!prefersReducedMotion} />
                        </RechartsLineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex h-[220px] items-center justify-center rounded-[1.2rem] border border-dashed border-[#dce5ff] bg-white/80 text-center text-sm font-bold text-slate-400">
                      시작·종료 시각 기록이 아직 충분하지 않습니다.
                    </div>
                  )}
                </ParentAnalyticsCard>

                <ParentAnalyticsCard
                  tone="away"
                  icon={<AlertTriangle className="h-[18px] w-[18px]" />}
                  title="학습 중간 이탈시간 추이"
                  description="학습 흐름을 끊는 중간 이탈시간이 짧고 빠르게 회복되는지 확인합니다."
                  badge={hasStartEndTimeData ? (hasAwayTimeData ? `평균 ${analyticsAverageAwayMinutes}분` : '안정적') : '기록 대기'}
                  insight={hasStartEndTimeData ? awayTimeInsight.trend : '학습 세션 기록이 더 쌓이면 이탈시간 흐름을 함께 볼 수 있습니다.'}
                  className={showEntryMotion ? 'parent-card-enter parent-entry-delay-4' : undefined}
                >
                  {hasStartEndTimeData ? (
                    <div className="h-[220px] w-full">
                      {hasAwayTimeData ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={awayTimeTrendData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#fde5eb" />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={10} />
                            <YAxis tickLine={false} axisLine={false} width={30} tickFormatter={(value) => `${value}m`} />
                            <Tooltip
                              contentStyle={{ borderRadius: '1rem', border: '1px solid #ffe0e7', boxShadow: '0 18px 36px rgba(225,29,72,0.10)' }}
                              formatter={(value: number) => [`${Math.round(Number(value || 0))}분`, '이탈시간']}
                            />
                            <Bar dataKey="awayMinutes" fill="#fecdd7" radius={[8, 8, 0, 0]} barSize={16} isAnimationActive={!prefersReducedMotion} />
                            <Line type="monotone" dataKey="awayMinutes" stroke="#fb7185" strokeWidth={2.8} dot={{ r: 2.5, fill: '#fb7185' }} activeDot={{ r: 4, fill: '#fb7185' }} isAnimationActive={!prefersReducedMotion} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center rounded-[1.2rem] border border-dashed border-[#ffe0e7] bg-white/80 text-center text-sm font-bold text-slate-400">
                          최근 14일 기준 눈에 띄는 이탈시간은 없었습니다.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-[220px] items-center justify-center rounded-[1.2rem] border border-dashed border-[#ffe0e7] bg-white/80 text-center text-sm font-bold text-slate-400">
                      학습 세션 기록이 더 쌓이면 이탈시간 흐름을 확인할 수 있습니다.
                    </div>
                  )}
                </ParentAnalyticsCard>
              </div>

              <section className="space-y-4 pt-2">
                <div className="rounded-[1.8rem] border border-[#dce6f8] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_48%,#f0f5ff_100%)] px-4 py-4 shadow-[0_22px_44px_-34px_rgba(20,41,95,0.18)] sm:px-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1.05rem] border border-[#e1e9fb] bg-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_20px_-18px_rgba(20,41,95,0.18)]">
                      <Sparkles className="h-4 w-4 text-[#14295F]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6d7fa5]">Supplement Report</p>
                      <h3 className="mt-1 text-[1.05rem] font-black tracking-tight text-[#14295F]">추가 데이터</h3>
                      <p className="mt-1 text-[12px] font-bold leading-[1.55] text-slate-500">
                        학습 분석 외에 벌점, 리듬, 과목, 생활 흐름을 리포트형 카드로 한 번에 확인할 수 있어요.
                      </p>
                    </div>
                  </div>
                </div>

                <ParentMetricCardShell
                  tone="penalty"
                  interactive
                  role="button"
                  onClick={() => setIsPenaltyGuideOpen(true)}
                  className="overflow-hidden rounded-[2rem] p-5 sm:p-6"
                >
                  <div className="flex h-full flex-col gap-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d24664]">Penalty Report</p>
                        <h3 className="mt-1 text-[1.12rem] font-black tracking-tight text-[#14295F]">누적 벌점 지수</h3>
                        <p className="mt-1 text-[12px] font-bold leading-[1.6] text-slate-500">
                          생활·출결 기록을 기준으로 회복 반영 후 현재 상태를 리포트처럼 보여드립니다.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('h-8 rounded-full border px-4 text-[11px] font-black shadow-sm', penaltyMeta.badge)}>
                          {penaltyMeta.label}
                        </Badge>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#ffd9df] bg-white/90 text-[#d24664] shadow-sm">
                          <Maximize2 className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)]">
                      <div className="rounded-[1.4rem] border border-[#ffd8df] bg-white/92 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d24664]">회복 반영 점수</p>
                        <div className="mt-3 flex items-end gap-2">
                          <span className="dashboard-number text-[2.6rem] leading-none tracking-[-0.06em] text-[#8f1534]">
                            {penaltyRecovery.effectivePoints}
                          </span>
                          <span className="pb-1.5 text-[14px] font-black text-[#d24664]">점</span>
                        </div>
                        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#ffe7ec]">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#ff9bb0_0%,#d24664_55%,#8f1534_100%)]"
                            style={{ width: `${penaltySeverityPercent}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid gap-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-[1.15rem] border border-[#ffdbe3] bg-white/88 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#b95a71]">원점수</p>
                            <p className="mt-2 text-[1.15rem] font-black tracking-tight text-[#14295F]">
                              {penaltyRecovery.basePoints}점
                            </p>
                          </div>
                          <div className="rounded-[1.15rem] border border-[#ffdbe3] bg-white/88 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#b95a71]">회복 반영</p>
                            <p className="mt-2 text-[1.15rem] font-black tracking-tight text-[#14295F]">
                              -{penaltyRecovery.recoveredPoints}점
                            </p>
                          </div>
                        </div>
                        <div className="rounded-[1.15rem] border border-[#ffdbe3] bg-white/88 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#b95a71]">최근 생활 기록</p>
                          <p className="mt-2 text-[13px] font-black leading-5 text-[#14295F]">
                            {latestPenaltyReason ? latestPenaltyReason.reason : '최근 벌점 기록 없음'}
                          </p>
                          <p className="mt-1 text-[11px] font-bold leading-5 text-slate-500">
                            {latestPenaltyReason ? `${latestPenaltyReason.dateLabel} · +${latestPenaltyReason.points}점` : '카드를 눌러 벌점 기준을 자세히 확인할 수 있어요.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-[#ffd7df] bg-white/82 px-4 py-3">
                      <p className="text-[11px] font-bold leading-5 text-[#a04a63]">
                        최근 벌점 흐름과 현재 상태를 함께 보고, 필요하면 기준 안내를 바로 열어볼 수 있어요.
                      </p>
                      <span className="inline-flex items-center rounded-full bg-[#fff1f4] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#d24664]">
                        기준 보기
                      </span>
                    </div>
                  </div>
                </ParentMetricCardShell>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <RhythmTimeChartDialog
                  trend={dailyRhythmTrend}
                  hasTrend={hasRhythmTrend}
                  yAxisDomain={rhythmYAxisDomain}
                  rhythmScoreTrend={rhythmScoreTrend}
                  rhythmScore={rhythmScore}
                />

                <SubjectStudyChartDialog
                  subjects={subjectsData}
                  subjectTotalMinutes={subjectTotalMinutes}
                />
                </div>

                <Card className="relative overflow-hidden rounded-[2rem] border border-[#dbe5f2] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_48%,#f2f6fd_100%)] p-5 shadow-[0_24px_48px_-34px_rgba(20,41,95,0.18)] sm:p-6">
                  <div className="pointer-events-none absolute -right-12 top-0 h-28 w-28 rounded-full bg-[#d6e7ff]/35 blur-3xl" />
                  <div className="relative z-10 space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.15rem] border border-[#e1e8f5] bg-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_20px_-18px_rgba(20,41,95,0.18)]">
                          <Activity className="h-4.5 w-4.5 text-[#14295F]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6d7fa5]">Life Report</p>
                          <h3 className="mt-1 text-[1.02rem] font-black tracking-tight text-[#14295F]">최근 생활/출결 이슈</h3>
                          <p className="mt-1 text-[12px] font-bold leading-[1.55] text-slate-500">
                            최근 학습일, 출결 흐름, 생활 기록을 한 보드에서 차분하게 정리했습니다.
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="h-7 w-fit rounded-full border border-[#d7e2f1] bg-white/92 px-3 text-[10px] font-black text-[#14295F]">
                        최근 {recentPenaltyReasons.length}건
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div className="rounded-[1.2rem] border border-white/90 bg-white/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7385a8]">최근 공부일자</p>
                        <p className="mt-2 text-[1rem] font-black tracking-tight text-[#14295F]">{recentLifeAttendanceSummary.recentStudyDate}</p>
                      </div>
                      <div className="rounded-[1.2rem] border border-white/90 bg-white/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7385a8]">공부 시작 시각</p>
                        <p className="mt-2 text-[1rem] font-black tracking-tight text-[#14295F]">{recentLifeAttendanceSummary.recentStudyStart}</p>
                      </div>
                      <div className="rounded-[1.2rem] border border-white/90 bg-white/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7385a8]">외출 여부</p>
                        <p className="mt-2 text-[1rem] font-black tracking-tight text-[#14295F]">{recentLifeAttendanceSummary.awayStatus}</p>
                      </div>
                      <div className="rounded-[1.2rem] border border-white/90 bg-white/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7385a8]">퇴실 여부</p>
                        <p className="mt-2 text-[1rem] font-black tracking-tight text-[#14295F]">{recentLifeAttendanceSummary.checkOutStatus}</p>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7385a8]">최근 생활 기록</p>
                        {latestPenaltyReason ? (
                          <Badge variant="outline" className="h-6 rounded-full border border-rose-200 bg-rose-50 px-2.5 text-[10px] font-black text-rose-700">
                            최신 {latestPenaltyReason.dateLabel}
                          </Badge>
                        ) : null}
                      </div>

                      {recentPenaltyReasons.length === 0 ? (
                        <div className="rounded-[1.25rem] border border-[#dde7f4] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-4 py-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_12px_24px_-22px_rgba(20,41,95,0.16)]">
                          <p className="text-sm font-black text-[#14295F]">기록된 특이사항이 없습니다.</p>
                          <p className="mt-1 text-[11px] font-bold text-slate-500">현재는 안정적인 생활 흐름을 유지하고 있어요.</p>
                        </div>
                      ) : (
                        <div className="grid gap-2.5">
                          {recentPenaltyReasons.map((r) => (
                            <div key={r.id} className="flex flex-col gap-3 rounded-[1.25rem] border border-white/90 bg-white/92 px-4 py-3 shadow-[0_14px_28px_-24px_rgba(20,41,95,0.18)] sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex min-w-0 items-start gap-3">
                                <div className="mt-0.5 h-9 w-1.5 shrink-0 rounded-full bg-[linear-gradient(180deg,#ffafbf_0%,#d24664_100%)]" />
                                <div className="min-w-0">
                                  <p className="text-sm font-black leading-5 text-[#14295F]">{r.reason}</p>
                                  <p className="mt-1 text-[10px] font-black text-slate-400">{r.dateLabel} · 규정 준수 안내</p>
                                </div>
                              </div>
                              <Badge variant="outline" className="w-fit rounded-full border-none bg-rose-100 px-3 py-1 text-[11px] font-black text-rose-700">
                                <span className="font-numeric">+{r.points}</span>점
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </section>
            </TabsContent>

            <TabsContent value="communication" className="parent-tab-panel mt-0 space-y-4 sm:space-y-5">
              <Card className="rounded-[2.5rem] border-none bg-white p-5 shadow-xl ring-1 ring-slate-100 sm:p-8">
                <CardTitle className="text-lg font-black tracking-tighter mb-6 flex items-center gap-2 text-[#14295F]"><Send className="h-5 w-5 text-[#14295F]" /> 상담 및 지원 요청</CardTitle>
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">상담 채널</Label>
                    <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                      <SelectTrigger className="h-12 rounded-xl border-2 font-bold text-sm shadow-sm"><SelectValue placeholder="상담 채널 선택" /></SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="visit" className="font-bold py-3 text-sm">🏫 센터 방문 상담</SelectItem>
                        <SelectItem value="phone" className="font-bold py-3 text-sm">📞 전화 상담</SelectItem>
                        <SelectItem value="online" className="font-bold py-3 text-sm">💻 온라인 상담</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">상담 내용</Label>
                    <Textarea className="min-h-[120px] rounded-[1.5rem] border-2 font-bold p-4 text-sm shadow-inner" value={requestText} onChange={(e) => setRequestText(e.target.value)} placeholder="자녀의 학습이나 생활에 대해 궁금하신 점을 자유롭게 입력해 주세요." />
                  </div>
                  <Button className="w-full h-16 rounded-[1.5rem] bg-[#14295F] text-white font-black text-lg shadow-xl shadow-[#14295F]/20 active:scale-[0.98] transition-all" onClick={() => submit('consultation')} disabled={submitting}>요청 보내기</Button>
                </div>
              </Card>

              <Card className="rounded-[2.5rem] border-none bg-white p-5 shadow-xl ring-1 ring-slate-100 sm:p-8">
                <CardTitle className="text-lg font-black tracking-tighter mb-2 flex items-center gap-2 text-[#14295F]">
                  <MessageCircle className="h-5 w-5 text-[#FF7A16]" />
                  건의사항 · 질의 · 요청사항
                </CardTitle>
                <CardDescription className="mb-6 font-bold text-sm text-slate-500">
                  학부모님이 남긴 내용을 선생님 또는 센터관리자가 확인하고 답변드립니다.
                </CardDescription>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">유형 선택</Label>
                      <Select value={parentInquiryType} onValueChange={(value: 'question' | 'request' | 'suggestion') => setParentInquiryType(value)}>
                        <SelectTrigger className="h-12 rounded-xl border-2 font-bold text-sm shadow-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                          <SelectItem value="question" className="font-bold py-3 text-sm">질의사항</SelectItem>
                          <SelectItem value="request" className="font-bold py-3 text-sm">요청사항</SelectItem>
                          <SelectItem value="suggestion" className="font-bold py-3 text-sm">건의사항</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid min-w-0 gap-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">제목</Label>
                      <Input
                        className="h-12 w-full rounded-xl border-2 font-bold text-sm shadow-sm"
                        value={parentInquiryTitle}
                        onChange={(e) => setParentInquiryTitle(e.target.value)}
                        placeholder={
                          parentInquiryType === 'question'
                            ? '예: 아이 숙제 진행 방식이 궁금합니다'
                            : parentInquiryType === 'request'
                              ? '예: 상담 일정 조정 요청'
                              : '예: 앱 알림 방식 개선 건의'
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">내용</Label>
                    <Textarea
                      className="min-h-[140px] rounded-[1.5rem] border-2 font-bold p-4 text-sm shadow-inner"
                      value={parentInquiryBody}
                      onChange={(e) => setParentInquiryBody(e.target.value)}
                      placeholder={
                        parentInquiryType === 'question'
                          ? '궁금하신 점을 자세히 남겨 주세요.'
                          : parentInquiryType === 'request'
                            ? '필요한 요청 내용을 구체적으로 적어 주세요.'
                            : '개선되면 좋을 점이나 건의사항을 남겨 주세요.'
                      }
                    />
                  </div>
                  <Button
                    className="w-full h-14 rounded-[1.5rem] bg-[#FF7A16] text-white font-black text-base shadow-xl shadow-[#FF7A16]/20 active:scale-[0.98] transition-all"
                    onClick={submitParentInquiry}
                    disabled={submitting || !parentInquiryBody.trim()}
                  >
                    전달하기
                  </Button>
                </div>
              </Card>

              <Card className="rounded-[2.5rem] border-none bg-white p-5 shadow-xl ring-1 ring-slate-100 sm:p-8">
                <CardTitle className="text-lg font-black tracking-tighter mb-2 flex items-center gap-2 text-[#14295F]">
                  <Bell className="h-5 w-5 text-[#14295F]" />
                  문의 내역과 답변
                </CardTitle>
                <CardDescription className="mb-6 font-bold text-sm text-slate-500">
                  최근 문의 내역과 선생님/센터관리자의 답변을 여기서 바로 확인할 수 있어요.
                </CardDescription>

                {parentCommunicationsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                  </div>
                ) : parentCommunications.length === 0 ? (
                  <div className="rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50/60 py-16 text-center">
                    <p className="text-sm font-black text-slate-400">등록된 문의 내역이 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {parentCommunications.map((item) => {
                      const createdAt = item.createdAt?.toDate?.() || item.updatedAt?.toDate?.();
                      const repliedAt = item.repliedAt?.toDate?.();
                      return (
                        <div key={item.id} className="rounded-[1.75rem] border border-slate-100 bg-slate-50/50 p-5 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                {getParentCommunicationTypeBadge(item)}
                                {getParentCommunicationStatusBadge(item.status)}
                              </div>
                              <h3 className="text-base font-black text-[#14295F]">{item.title || '학부모 문의'}</h3>
                              <p className="text-[11px] font-bold text-slate-400">
                                {createdAt ? format(createdAt, 'yyyy.MM.dd HH:mm') : '시간 정보 없음'}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4">
                            <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-slate-700">
                              {item.body?.trim() || '내용이 없습니다.'}
                            </p>
                          </div>

                          {item.replyBody ? (
                            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                              <p className="mb-1 text-[10px] font-black text-emerald-700">
                                답변{item.repliedByName ? ` · ${item.repliedByName}` : ''}{repliedAt ? ` · ${format(repliedAt, 'yyyy.MM.dd HH:mm')}` : ''}
                              </p>
                              <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-emerald-900">
                                {item.replyBody}
                              </p>
                            </div>
                          ) : (
                            <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-[11px] font-bold text-slate-400">
                              아직 답변이 등록되지 않았습니다.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="parent-tab-panel mt-0 space-y-4 sm:space-y-5">
              <Card className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h3 className="text-4xl font-black tracking-tight text-[#14295F] leading-none">수납</h3>
                      <p className="text-[15px] font-bold text-slate-700 leading-snug">
                        <span className="block">센터수납요청건을 비대면으로</span>
                        <span className="block">결제할 수 있어요!</span>
                      </p>
                    </div>
                    <span className="shrink-0 text-[14px] font-black text-[#14295F]">실시간 연동</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-black text-[#14295F]">청구금액</p>
                        {mobileBillingStatusMeta && (
                          <Badge variant="outline" className={cn('h-6 border px-2 text-[11px] font-black', mobileBillingStatusMeta.className)}>
                            {mobileBillingStatusMeta.label}
                          </Badge>
                        )}
                      </div>
                      <p className="dashboard-number mt-2 text-[1.15rem] leading-none text-[#14295F] whitespace-nowrap">
                        {formatWon(billingSummary.billed)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 px-4 py-3.5 shadow-sm sm:text-center">
                      <p className="text-[12px] font-black text-emerald-700">수납</p>
                      <p className="dashboard-number mt-2 text-[1.15rem] leading-none text-emerald-700 whitespace-nowrap">
                        {formatWon(billingSummary.paid)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/40 px-4 py-3.5 shadow-sm sm:text-center">
                      <p className="text-[12px] font-black text-rose-700">미납</p>
                      <p className="dashboard-number mt-2 text-[1.15rem] leading-none text-rose-700 whitespace-nowrap">
                        {formatWon(billingSummary.overdue)}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {latestInvoice ? (
                <div className="space-y-3">
                  {displayInvoices.map((invoice) => {
                    const invoiceDueDate = toDateSafe((invoice as any).cycleEndDate);
                    const statusMeta = getInvoiceStatusMeta(invoice.status);

                    return (
                      <Card key={invoice.id} className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-2 min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <p className="min-w-0 truncate whitespace-nowrap text-[1.45rem] font-black leading-none tracking-tight text-[#14295F] md:text-[20px]">
                                {invoice.studentName || student?.name || '학생'}
                              </p>
                              <Badge variant="outline" className="h-6 border border-slate-200 bg-slate-50 px-2 text-[10px] font-black text-slate-600">
                                {getInvoiceTrackLabel(invoice.trackCategory)}
                              </Badge>
                              {statusMeta && (
                                <Badge variant="outline" className={cn('h-6 border px-2 text-[10px] font-black shrink-0', statusMeta.className)}>
                                  <span className="md:hidden">{statusMeta.mobileLabel}</span>
                                  <span className="hidden md:inline">{statusMeta.label}</span>
                                </Badge>
                              )}
                            </div>
                            <p className="text-[15px] font-bold text-slate-600">
                              결제 마감일 {invoiceDueDate ? format(invoiceDueDate, 'yyyy.MM.dd', { locale: ko }) : '-'}
                            </p>
                          </div>
                          <p className="dashboard-number shrink-0 whitespace-nowrap text-[1.9rem] leading-none text-[#14295F] md:text-[2.05rem]">
                            {formatWon(Number(invoice.finalPrice || 0))}
                          </p>
                        </div>

                        {(invoice.status === 'issued' || invoice.status === 'overdue') && (
                          <Link
                            href={`/payment/checkout/${invoice.id}`}
                            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#14295F] text-[15px] font-black text-white shadow-sm transition-colors hover:bg-[#10224f]"
                          >
                            <CreditCard className="h-4 w-4" />
                            결제하기
                          </Link>
                        )}
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[14px] font-bold text-slate-500">현재 발행된 인보이스가 없습니다.</p>
                </Card>
              )}

              <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50/50 px-4 py-3">
                <p className="text-[15px] font-black text-emerald-700">감사합니다! 최선을 다해 관리하겠습니다!</p>
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="parent-tab-panel mt-0 space-y-3">
              {notifications.length === 0 ? (
                <div className="py-32 text-center opacity-20 italic font-black text-slate-400 flex flex-col items-center gap-4">
                  <Bell className="h-16 w-16" /> <span className="text-sm uppercase tracking-widest">새로운 알림이 없습니다.</span>
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={cn(
                      'w-full rounded-2xl border bg-white p-5 text-left transition-all active:scale-[0.98]',
                      !(n.isRead || readMap[n.id]) ? 'border-[#14295F]/20 shadow-lg ring-1 ring-[#14295F]/5' : 'border-slate-100 opacity-60'
                    )}
                    onClick={() => void openNotificationDetail(n)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{n.createdAtLabel}</span>
                      {n.isImportant && <Badge variant="outline" className="bg-orange-100 text-[#FF7A16] border-none font-black text-[10px] h-5 px-2">중요</Badge>}
                    </div>
                    <p className="text-base font-black text-[#14295F] tracking-tight">{n.title}</p>
                  </button>
                ))
              )}
            </TabsContent>
      </Tabs>

      <Dialog open={isReportArchiveOpen} onOpenChange={setIsReportArchiveOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl md:max-w-4xl">
          <div className="bg-[#14295F] p-6 text-white">
            <DialogTitle className="text-xl font-black tracking-tight">우리 아이 학습 리포트</DialogTitle>
            <DialogDescription className="mt-1 text-xs font-bold text-white/70">받은 리포트를 날짜별로 확인할 수 있어요.</DialogDescription>
          </div>
          <div className="bg-white p-4 md:grid md:grid-cols-[260px_minmax(0,1fr)] md:gap-4 md:p-6">
            <div className="space-y-2 max-h-[220px] overflow-y-auto md:max-h-[62vh] md:pr-1">
              {reportsArchive.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-xs font-bold text-slate-400">
                  아직 받은 리포트가 없습니다.
                </div>
              ) : (
                reportsArchive.map((item) => {
                  const isActiveItem = selectedChildReport?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void handleSelectChildReport(item)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-2.5 text-left transition-all",
                        isActiveItem ? "border-[#14295F] bg-[#EEF4FF]" : "border-slate-200 bg-white hover:bg-slate-50"
                      )}
                    >
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.dateKey || '-'}</p>
                      <p className="mt-1 line-clamp-2 text-xs font-bold text-slate-700">{item.content || '리포트 내용 없음'}</p>
                    </button>
                  );
                })
              )}
            </div>
            <div className="mt-3 max-h-[42vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 md:mt-0 md:max-h-[62vh] md:p-5">
              {selectedChildReport ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black uppercase tracking-widest text-[#14295F]/60">{selectedChildReport.dateKey}</p>
                    <Badge variant="outline" className="h-5 border-slate-200 bg-white px-2 text-[10px] font-black text-slate-600">
                      {selectedChildReport.viewedAt ? '읽음' : '새 리포트'}
                    </Badge>
                  </div>
                  {selectedChildReport.content ? (
                    <VisualReportViewer
                      content={selectedChildReport.content}
                      aiMeta={selectedChildReport.aiMeta}
                      dateKey={selectedChildReport.dateKey}
                      studentName={selectedChildReport.studentName}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-slate-800">
                      리포트 내용이 없습니다.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex h-full min-h-[180px] items-center justify-center text-center text-sm font-bold text-slate-400">
                  왼쪽에서 리포트를 선택해 주세요.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPenaltyGuideOpen} onOpenChange={setIsPenaltyGuideOpen}>
        <DialogContent className="overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-lg">
          <div className="bg-gradient-to-r from-rose-600 to-rose-500 p-6 text-white">
            <DialogTitle className="text-xl font-black tracking-tight">벌점 현황 안내</DialogTitle>
            <DialogDescription className="mt-1 text-xs font-bold text-white/80">
              벌점 부여 기준, 누적 단계, 자동 회복 규칙
            </DialogDescription>
          </div>

          <div className="space-y-3 bg-white p-6">
            <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-rose-600">벌점 부여 기준</p>
              <div className="mt-2 space-y-1.5 text-sm font-bold text-slate-700">
                <p>지각 출석: +{REQUEST_PENALTY_POINTS.late}점</p>
                <p>결석: +{REQUEST_PENALTY_POINTS.absence}점</p>
                <p>루틴 미작성: +{ROUTINE_MISSING_PENALTY_POINTS}점</p>
                <p>센터 수동 부여: 관리자가 설정한 점수</p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-amber-700">누적 단계 기준</p>
              <div className="mt-2 space-y-1.5 text-sm font-bold text-slate-700">
                <p>7점 이상: 선생님과 상담</p>
                <p>12점 이상: 학부모 상담</p>
                <p>20점 이상: 퇴원</p>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700">자동 회복 규칙</p>
              <div className="mt-2 space-y-1.5 text-sm font-bold text-slate-700">
                <p>최근 벌점 이후 {PENALTY_RECOVERY_INTERVAL_DAYS}일 동안 신규 벌점이 없으면 1점 회복</p>
                <p>현재 원점수 {penaltyRecovery.basePoints}점 · 회복 {penaltyRecovery.recoveredPoints}점 · 적용 {penaltyRecovery.effectivePoints}점</p>
                <p>최근 벌점 반영일: {penaltyRecovery.latestPositiveDateLabel}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">현재 조치 단계</p>
              <Badge variant="outline" className={cn('mt-2 h-7 rounded-full border px-3 text-xs font-black', penaltyMeta.badge)}>{penaltyMeta.label}</Badge>
            </div>
          </div>

          <DialogFooter className="border-t bg-white p-4">
            <DialogClose asChild>
              <Button className="h-11 w-full rounded-xl bg-[#14295F] text-sm font-black text-white hover:text-white">확인</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedNotification} onOpenChange={(open) => { if (!open) setSelectedNotification(null); }}>
        <DialogContent className="overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-md">
          <div className="bg-[#14295F] p-6 text-white">
            <DialogTitle className="text-xl font-black tracking-tight">알림 상세</DialogTitle>
            <DialogDescription className="mt-1 text-xs font-bold text-white/70">
              {selectedNotification?.createdAtLabel || '최근'} · 읽음 확인 가능
            </DialogDescription>
          </div>
          <div className="space-y-4 bg-white p-6">
            <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-base font-black tracking-tight text-[#14295F]">{selectedNotification?.title}</p>
                {selectedNotification?.isImportant && (
                  <Badge variant="outline" className="h-5 border-none bg-orange-100 px-2 text-[10px] font-black text-[#FF7A16]">중요</Badge>
                )}
              </div>
              <p className="whitespace-pre-line text-sm font-bold leading-relaxed text-slate-700">{selectedNotification?.body}</p>
            </div>
            {selectedNotification && (
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-600">
                {(selectedNotification.isRead || readMap[selectedNotification.id]) ? '읽음 확인됨' : '미확인 알림'}
              </p>
            )}
          </div>
          <DialogFooter className="border-t bg-white p-4">
            <DialogClose asChild>
              <Button className="h-11 w-full rounded-xl bg-[#14295F] text-sm font-black text-white hover:text-white">닫기</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedCalendarDate} onOpenChange={(open) => { if (!open) setSelectedCalendarDate(null); }}>
        <DialogContent className="overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-lg">
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,#14295F_0%,#1f3e87_55%,#2d5db0_100%)] p-6 text-white">
            <div className="absolute inset-x-0 top-0 h-px bg-white/70" />
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/12 blur-2xl" />
            <div className="relative z-10 space-y-3">
              <Badge className="w-fit border border-white/18 bg-white/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white">학습 브리핑</Badge>
              <div>
                <DialogTitle className="text-xl font-black tracking-tight">
                  {selectedCalendarDate ? format(selectedCalendarDate, 'yyyy.MM.dd (EEE)', { locale: ko }) : '날짜 상세'}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs font-bold text-white/72">해당 날짜의 학습 흐름과 계획 요약입니다.</DialogDescription>
              </div>
            </div>
          </div>
          <div className="space-y-4 bg-white p-6">
            <div className="grid grid-cols-2 gap-2">
              <Card className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">공부 시간</p>
                <p className="dashboard-number mt-1 text-xl text-[#14295F]">{toHm(selectedDateLog?.totalMinutes || 0)}</p>
              </Card>
              <Card className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">계획 달성</p>
                <p className="dashboard-number mt-1 text-xl text-[#FF7A16]">{selectedDatePlanRate}%</p>
              </Card>
              <Card className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">획득 포인트</p>
                <p className="dashboard-number mt-1 text-xl text-emerald-600">{selectedDateLp.toLocaleString()}점</p>
              </Card>
              <Card className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">출결 요청</p>
                <p className="mt-1 text-sm font-black text-[#14295F]">
                  {selectedDateRequest ? (selectedDateRequest.type === 'late' ? '지각 신청' : '결석 신청') : '기록 없음'}
                </p>
              </Card>
            </div>

            <Card className="rounded-xl border border-slate-100 p-4 shadow-none">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">학습 계획 내역</p>
                <Badge variant="outline" className="h-5 border border-slate-200 bg-slate-50 px-2 text-[10px] font-black text-slate-500">
                  {selectedDatePlanDone}/{selectedDatePlanTotal}
                </Badge>
              </div>
              {isSelectedDatePlansLoading ? (
                <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-300" /></div>
              ) : selectedDateStudyPlans.length === 0 ? (
                <p className="py-6 text-center text-xs font-bold text-slate-400">등록된 학습 계획이 없습니다.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedDateStudyPlans.slice(0, 6).map((plan) => (
                    <div key={plan.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <p className="line-clamp-1 text-xs font-bold text-slate-700">{plan.title}</p>
                      <Badge variant="outline" className={cn('h-5 border-none px-2 text-[10px] font-black', plan.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600')}>
                        {plan.done ? '완료' : '진행중'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
          <DialogFooter className="border-t bg-white p-4">
            <DialogClose asChild>
              <Button className="h-11 w-full rounded-xl bg-[#14295F] text-sm font-black text-white hover:text-white">확인</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50/50 px-6 py-4 flex items-start gap-3 mx-1">
        <Info className="h-4 w-4 text-[#14295F] mt-0.5 shrink-0" />
        <p className="text-[10px] font-bold text-[#14295F]/70 leading-relaxed break-keep">
          학부모 모드는 실시간 조회 전용입니다. 정보 수정이나 상세 설정 변경은 센터 관리자 또는 자녀 계정을 통해 가능합니다.
        </p>
      </div>
    </div>
  );
}
