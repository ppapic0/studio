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
import { logHandledClientIssue } from '@/lib/handled-client-log';
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

  if (key === 'math' || key === 'mat' || key.includes('수학')) return '수학';
  if (key === 'english' || key === 'eng' || key.includes('영어')) return '영어';
  if (key === 'korean' || key === 'kor' || key.includes('국어')) return '국어';
  if (key === 'science' || key === 'sci' || key.includes('과학')) return '과학';
  if (key === 'social' || key === 'soc' || key.includes('사회')) return '사회';
  if (key === 'history' || key === 'hist' || key.includes('한국사') || key.includes('역사')) return '한국사';
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

type CenterAnnouncementRecord = {
  id: string;
  title?: string;
  body?: string;
  audience?: 'student' | 'parent' | 'all';
  isPublished?: boolean;
  status?: string;
  createdAt?: { toDate?: () => Date; toMillis?: () => number };
  updatedAt?: { toDate?: () => Date; toMillis?: () => number };
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
  glow: string;
  ribbon: string;
  iconWrap: string;
  icon: string;
  eyebrow: string;
  badge: string;
  chartShell: string;
  insight: string;
};

type ParentHomeMetricToneStyle = {
  glow: string;
  ribbon: string;
  eyebrow: string;
  pill: string;
  rail: string;
  railLabel: string;
  railValue: string;
  accentText: string;
};

const PARENT_METRIC_TONE_STYLES: Record<ParentMetricTone, ParentMetricToneStyle> = {
  study: {
    card: 'border-[#ffd8ad] bg-[linear-gradient(180deg,#fffdf9_0%,#ffffff_54%,#fff4e8_100%)] shadow-[0_22px_40px_-28px_rgba(255,122,22,0.18)] ring-1 ring-[#ffe3c5]/90',
    orb: 'bg-[#ffb870]/34',
    panel: 'border-[#ffe1c2] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,243,232,0.94)_100%)]',
    eyebrow: 'text-[#c86a14]',
    badge: 'border-[#ffd2a0] bg-white/96 text-[#b55d0d]',
    stroke: '#FF7A16',
    fillStart: 'rgba(255, 122, 22, 0.24)',
    fillEnd: 'rgba(255, 122, 22, 0.03)',
    dot: '#FF7A16',
    mutedDot: '#f0c69c',
  },
  plan: {
    card: 'border-[#ffd1a0] bg-[linear-gradient(180deg,#fffbf6_0%,#ffffff_54%,#fff1e0_100%)] shadow-[0_22px_40px_-28px_rgba(255,122,22,0.2)] ring-1 ring-[#ffe0bf]/90',
    orb: 'bg-[#ffb05c]/34',
    panel: 'border-[#ffd8ad] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,240,224,0.95)_100%)]',
    eyebrow: 'text-[#c35c07]',
    badge: 'border-[#ffc98f] bg-white/96 text-[#b24f05]',
    stroke: '#e56e0b',
    fillStart: 'rgba(229, 110, 11, 0.25)',
    fillEnd: 'rgba(229, 110, 11, 0.03)',
    dot: '#e56e0b',
    mutedDot: '#ebc08f',
  },
  attendance: {
    card: 'border-[#ffe0c2] bg-[linear-gradient(180deg,#fffdf9_0%,#ffffff_58%,#fff4ea_100%)] shadow-[0_22px_40px_-28px_rgba(255,122,22,0.16)] ring-1 ring-[#ffe6cb]/90',
    orb: 'bg-[#ffbb7f]/28',
    panel: 'border-[#ffe4ca] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,245,236,0.95)_100%)]',
    eyebrow: 'text-[#b46217]',
    badge: 'border-[#d4eaef] bg-white/96 text-[#245565]',
    stroke: '#2b8ba4',
    fillStart: 'rgba(43, 139, 164, 0.16)',
    fillEnd: 'rgba(43, 139, 164, 0.02)',
    dot: '#2b8ba4',
    mutedDot: '#c9d6db',
  },
  penalty: {
    card: 'border-[#ffd8c9] bg-[linear-gradient(180deg,#fffaf8_0%,#ffffff_56%,#fff2ea_100%)] shadow-[0_22px_40px_-28px_rgba(255,122,22,0.16)] ring-1 ring-[#ffe4d7]/88',
    orb: 'bg-[#ffb28b]/26',
    panel: 'border-[#ffd8cf] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,242,237,0.96)_100%)]',
    eyebrow: 'text-[#d35b2b]',
    badge: 'border-[#ffd2c2] bg-white/96 text-[#c64e1f]',
    stroke: '#cf4b5d',
    fillStart: 'rgba(207, 75, 93, 0.18)',
    fillEnd: 'rgba(207, 75, 93, 0.02)',
    dot: '#cf4b5d',
    mutedDot: '#e5bfba',
  },
};

const PARENT_ANALYTICS_TONE_STYLES: Record<ParentAnalyticsTone, ParentAnalyticsToneStyle> = {
  growth: {
    card: 'border-[#ffd8ae] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf4_58%,#fff2e6_100%)] shadow-[0_24px_44px_-30px_rgba(255,122,22,0.18)]',
    glow: 'bg-[#ffbb74]/24',
    ribbon: 'from-[#ffb55b] via-[#FF7A16] to-[#d35d08]',
    iconWrap: 'border-[#ffdcb8] bg-white/96',
    icon: 'text-[#FF7A16]',
    eyebrow: 'text-[#c5762e]',
    badge: 'border-[#ffd6ad] bg-[#fff4e8] text-[#c35f0a]',
    chartShell: 'border-[#ffe2c4] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,244,233,0.96)_100%)]',
    insight: 'border-[#ffe0bf] bg-[#fffaf4] text-[#7a4d25]',
  },
  rhythm: {
    card: 'border-[#ffd8b5] bg-[linear-gradient(180deg,#ffffff_0%,#fffbf7_58%,#fff4ea_100%)] shadow-[0_24px_44px_-30px_rgba(255,122,22,0.14)]',
    glow: 'bg-[#ffbf87]/20',
    ribbon: 'from-[#ffd18c] via-[#ff9b4f] to-[#FF7A16]',
    iconWrap: 'border-[#ffe0c1] bg-white/96',
    icon: 'text-[#ff8d3a]',
    eyebrow: 'text-[#b87c46]',
    badge: 'border-[#d4efe5] bg-[#f2faf7] text-[#16846c]',
    chartShell: 'border-[#ffe2ca] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,246,237,0.96)_100%)]',
    insight: 'border-[#ffe3cc] bg-[#fffaf5] text-[#82562a]',
  },
  window: {
    card: 'border-[#ffd9ba] bg-[linear-gradient(180deg,#ffffff_0%,#fffcf8_58%,#fff5eb_100%)] shadow-[0_24px_44px_-30px_rgba(255,122,22,0.14)]',
    glow: 'bg-[#ffc18a]/18',
    ribbon: 'from-[#ffd8a4] via-[#ffad67] to-[#ff7a16]',
    iconWrap: 'border-[#ffe2c7] bg-white/96',
    icon: 'text-[#f28a30]',
    eyebrow: 'text-[#ad7a4c]',
    badge: 'border-[#e5e2ff] bg-[#f4f3ff] text-[#6a54db]',
    chartShell: 'border-[#ffe4ce] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,239,0.96)_100%)]',
    insight: 'border-[#ffe6d2] bg-[#fffbf7] text-[#7f552a]',
  },
  away: {
    card: 'border-[#ffd9c8] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf8_58%,#fff2ec_100%)] shadow-[0_24px_44px_-30px_rgba(255,122,22,0.12)]',
    glow: 'bg-[#ffb08f]/18',
    ribbon: 'from-[#ffc59a] via-[#ff8a52] to-[#df5a1f]',
    iconWrap: 'border-[#ffe0d1] bg-white/96',
    icon: 'text-[#e0612b]',
    eyebrow: 'text-[#b26d55]',
    badge: 'border-[#ffd9cf] bg-[#fff4ef] text-[#d35a2a]',
    chartShell: 'border-[#ffe2d6] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,245,241,0.96)_100%)]',
    insight: 'border-[#ffe4d9] bg-[#fffaf7] text-[#835037]',
  },
};

const PARENT_HOME_METRIC_TONE_STYLES: Record<ParentMetricTone, ParentHomeMetricToneStyle> = {
  study: {
    glow: 'bg-[#ffbc77]/26',
    ribbon: 'from-[#ffd08d] via-[#FF7A16] to-[#d35b08]',
    eyebrow: 'text-[#c46a14]',
    pill: 'border-[#ffd6ab] bg-[#fff4e9] text-[#bc5c08]',
    rail: 'border-[#ffe1c0] bg-[linear-gradient(180deg,#fffaf4_0%,#fff2e6_100%)]',
    railLabel: 'text-[#b77a45]',
    railValue: 'text-[#14295F]',
    accentText: 'text-[#FF7A16]',
  },
  plan: {
    glow: 'bg-[#ffb86e]/26',
    ribbon: 'from-[#ffcc88] via-[#ff9b3e] to-[#ff6e0b]',
    eyebrow: 'text-[#c55d04]',
    pill: 'border-[#ffd19b] bg-[#fff3e5] text-[#c55d04]',
    rail: 'border-[#ffdcbb] bg-[linear-gradient(180deg,#fff9f1_0%,#fff0df_100%)]',
    railLabel: 'text-[#bd7333]',
    railValue: 'text-[#8f4a09]',
    accentText: 'text-[#c55d04]',
  },
  attendance: {
    glow: 'bg-[#ffbb82]/24',
    ribbon: 'from-[#ffe2b8] via-[#ffb25d] to-[#ff7a16]',
    eyebrow: 'text-[#bc6c1d]',
    pill: 'border-[#d7edf3] bg-[#f3fafc] text-[#2a7f96]',
    rail: 'border-[#ffe3ca] bg-[linear-gradient(180deg,#fffdf9_0%,#fff4eb_100%)]',
    railLabel: 'text-[#aa7342]',
    railValue: 'text-[#173f4a]',
    accentText: 'text-[#FF7A16]',
  },
  penalty: {
    glow: 'bg-[#ffb08c]/22',
    ribbon: 'from-[#ffd2b1] via-[#ff9160] to-[#d44f1f]',
    eyebrow: 'text-[#cf5222]',
    pill: 'border-[#ffd9cb] bg-[#fff3ee] text-[#cf5222]',
    rail: 'border-[#ffe0d5] bg-[linear-gradient(180deg,#fffaf8_0%,#fff1ea_100%)]',
    railLabel: 'text-[#b16a4c]',
    railValue: 'text-[#9b2f33]',
    accentText: 'text-[#cf5222]',
  },
};

const PARENT_PORTAL_TABS: ParentPortalTab[] = ['home', 'studyDetail', 'data', 'communication', 'billing'];
const PARENT_POST_LOGIN_ENTRY_MOTION_KEY = 'track-parent-dashboard-entry';
const PARENT_POST_LOGIN_ENTRY_MAX_AGE_MS = 15000;
const PARENT_ACTIVE_STUDY_STATUSES: AttendanceCurrent['status'][] = ['studying', 'away', 'break'];

const PARENT_DASHBOARD_TAB_META = {
  home: {
    label: '오늘 흐름',
    shortLabel: '홈',
    description: '오늘 공부, 출결, 벌점, 알림을 가장 먼저 보는 탭입니다.',
    icon: Home,
  },
  studyDetail: {
    label: '학습 흐름',
    shortLabel: '학습',
    description: '월간 캘린더와 날짜별 학습 기록을 차분하게 확인합니다.',
    icon: History,
  },
  data: {
    label: '학습 분석',
    shortLabel: '데이터',
    description: '최근 성장, 리듬, 생활 흐름을 그래프로 읽는 탭입니다.',
    icon: FileText,
  },
  communication: {
    label: '소통 센터',
    shortLabel: '소통',
    description: '센터 공지, 알림, 상담과 문의를 한 흐름으로 확인합니다.',
    icon: MessageCircle,
  },
  billing: {
    label: '수납 센터',
    shortLabel: '수납',
    description: '대표 청구서와 결제 현황을 가장 빠르게 확인하는 탭입니다.',
    icon: CreditCard,
  },
} as const;

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

function ParentHomeMetricCardShell({
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
  const toneStyle = PARENT_HOME_METRIC_TONE_STYLES[tone];

  return (
    <Card
      {...props}
      className={cn(
        'group relative min-w-0 overflow-hidden rounded-[1.85rem] border border-[#ffd7ad] bg-[linear-gradient(180deg,#fffefc_0%,#ffffff_42%,#fff7ef_100%)] p-4 shadow-[0_24px_44px_-30px_rgba(255,122,22,0.16)] ring-1 ring-[#fff3e5] transition-[transform,box-shadow,border-color,filter] duration-300 active:scale-[0.985] md:hover:-translate-y-1.5 md:hover:border-[#ffbf7d] md:hover:shadow-[0_34px_52px_-26px_rgba(255,122,22,0.24)] md:hover:brightness-[1.01] sm:p-5',
        interactive && 'cursor-pointer',
        className
      )}
    >
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r', toneStyle.ribbon)} />
      <div className={cn('pointer-events-none absolute -right-8 top-0 h-24 w-24 rounded-full blur-3xl transition-transform duration-500 group-hover:scale-110', toneStyle.glow)} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.12)_38%,rgba(255,255,255,0)_100%)]" />
      <div className="pointer-events-none absolute inset-x-5 bottom-0 h-px bg-[#fff1df]" />
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
    <Card
      className={cn(
        'group relative min-w-0 overflow-hidden rounded-[2.1rem] border p-4 shadow-sm transition-[transform,box-shadow,border-color,filter] duration-300 active:scale-[0.992] md:hover:-translate-y-1.5 md:hover:shadow-[0_32px_52px_-30px_rgba(255,122,22,0.18)] md:hover:brightness-[1.01] sm:p-5',
        toneStyle.card,
        className
      )}
    >
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r', toneStyle.ribbon)} />
      <div className={cn('pointer-events-none absolute -right-8 top-0 h-24 w-24 rounded-full blur-3xl', toneStyle.glow)} />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-[1.1rem] border shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_16px_26px_-22px_rgba(255,122,22,0.16)]', toneStyle.iconWrap, toneStyle.icon)}>
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
        <div className={cn('mt-4 overflow-hidden rounded-[1.45rem] border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.96)] sm:p-4', toneStyle.chartShell)}>
          {children}
        </div>
        <div className={cn('mt-4 rounded-[1.2rem] border px-3.5 py-3 text-[11px] font-bold leading-relaxed sm:text-[11.5px]', toneStyle.insight)}>
          {insight}
        </div>
      </div>
    </Card>
  );
}

function ParentSectionHeader({
  icon,
  eyebrow,
  title,
  description,
  badges,
  className,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  badges?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#ffd8ae] bg-[#fff3e5] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#c2610b] shadow-[0_14px_28px_-24px_rgba(255,122,22,0.2)]">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FF7A16] text-white shadow-sm">
            {icon}
          </span>
          {eyebrow}
        </div>
        <h3 className="mt-3 text-[1.42rem] font-black leading-none tracking-tight text-[#14295F] sm:text-[1.72rem]">
          {title}
        </h3>
        <p className="mt-2 max-w-[36rem] break-keep text-[13px] font-bold leading-[1.72] text-slate-500 sm:text-[13.5px]">
          {description}
        </p>
      </div>
      {badges ? <div className="flex flex-wrap items-center gap-2 self-start sm:max-w-[46%] sm:justify-end">{badges}</div> : null}
    </div>
  );
}

function ParentDashboardTabRail({
  tab,
  activeStudentLabel,
  todayLabel,
  linkedStudents,
  studentId,
  onStudentChange,
  onTabChange,
  totalMinutes,
  unreadRecentCount,
  reportsCount,
  hasOutstandingInvoice,
  showEntryMotion,
}: {
  tab: ParentPortalTab;
  activeStudentLabel: string;
  todayLabel: string;
  linkedStudents: LinkedStudentOption[];
  studentId: string | null | undefined;
  onStudentChange: (nextStudentId: string) => void;
  onTabChange: (value: string) => void;
  totalMinutes: number;
  unreadRecentCount: number;
  reportsCount: number;
  hasOutstandingInvoice: boolean;
  showEntryMotion: boolean;
}) {
  const currentTabMeta =
    PARENT_DASHBOARD_TAB_META[tab as keyof typeof PARENT_DASHBOARD_TAB_META] ?? PARENT_DASHBOARD_TAB_META.home;
  return (
    <section
      className={cn(
        'on-dark relative overflow-hidden rounded-[2.4rem] border border-[#24427e] bg-[linear-gradient(145deg,#1b3a76_0%,#14295F_54%,#0d1c45_100%)] p-5 shadow-[0_32px_72px_-46px_rgba(20,41,95,0.54)] sm:p-6',
        showEntryMotion && 'parent-shell-enter parent-entry-delay-1'
      )}
    >
      <div className="soft-glow absolute -right-10 top-0 h-28 w-28 rounded-full bg-[#ffba78]/26 blur-3xl" />
      <div className="soft-glow absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-[#ffd3a2]/18 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(255,122,22,0.22),transparent_34%)]" />

      <div className="relative z-10 space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="h-7 rounded-full border border-white/14 bg-white/10 px-3 text-[10px] font-black text-white shadow-[0_12px_24px_-22px_rgba(5,10,28,0.65)] backdrop-blur-sm">
                Parent Mode
              </Badge>
              <Badge variant="outline" className="h-7 rounded-full border border-white/14 bg-white/10 px-3 text-[10px] font-black text-white shadow-[0_12px_24px_-22px_rgba(5,10,28,0.65)] backdrop-blur-sm">
                {todayLabel}
              </Badge>
              <Badge variant="outline" className="h-7 rounded-full border border-[#ffb870]/28 bg-[#FF7A16]/14 px-3 text-[10px] font-black text-white shadow-[0_12px_24px_-22px_rgba(255,122,22,0.45)] backdrop-blur-sm">
                현재 탭 {currentTabMeta.label}
              </Badge>
            </div>

            {linkedStudents.length > 1 && (
              <div className="max-w-[250px]">
                <Label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.18em] text-white">
                  확인 중인 자녀
                </Label>
                <Select value={studentId || linkedStudents[0]?.id || ''} onValueChange={onStudentChange}>
                  <SelectTrigger className="h-12 rounded-[1.1rem] border border-white/14 bg-white/10 px-4 text-left font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_30px_-26px_rgba(10,20,52,0.42)] backdrop-blur-sm">
                    <SelectValue placeholder={activeStudentLabel} />
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
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[27rem]">
            <div className="rounded-[1.35rem] border border-[#ffd6ab]/28 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,244,230,0.10)_100%)] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white">오늘 공부</p>
              <p className="mt-2 text-[1rem] font-black text-white">{toHm(totalMinutes)}</p>
            </div>
            <div className="rounded-[1.35rem] border border-[#ffd6ab]/28 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,244,230,0.10)_100%)] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white">미확인 알림</p>
              <p className="mt-2 text-[1rem] font-black text-white">{unreadRecentCount}건</p>
            </div>
            <div className="rounded-[1.35rem] border border-[#ffd6ab]/28 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,244,230,0.10)_100%)] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white">리포트</p>
              <p className="mt-2 text-[1rem] font-black text-white">{reportsCount}건</p>
            </div>
            <div className="rounded-[1.35rem] border border-[#ffd6ab]/28 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,244,230,0.10)_100%)] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white">수납 상태</p>
              <p className="mt-2 text-[1rem] font-black text-white">{hasOutstandingInvoice ? '확인 필요' : '안정'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.7rem] border border-[#ffd1a0]/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,244,231,0.08)_100%)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {PARENT_PORTAL_TABS.map((item) => {
              const meta = PARENT_DASHBOARD_TAB_META[item as keyof typeof PARENT_DASHBOARD_TAB_META];
              const TabIcon = meta.icon;
              const isActive = tab === item;

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => onTabChange(item)}
                  className={cn(
                    'group relative flex items-center gap-2 rounded-[1.25rem] border px-3 py-3 text-left transition-[transform,background,box-shadow,border-color] duration-300 active:scale-[0.985]',
                    isActive
                      ? 'border-[#ffd4a8] bg-[linear-gradient(180deg,#fff5eb_0%,#ffe6ca_100%)] text-[#14295F] shadow-[0_18px_30px_-24px_rgba(255,122,22,0.32)]'
                      : 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,244,230,0.05)_100%)] text-white hover:border-[#ffd3a2]/24 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(255,244,230,0.08)_100%)]'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.95rem] transition-colors duration-300',
                      isActive ? 'bg-[linear-gradient(135deg,#ff973d_0%,#FF7A16_100%)] text-white shadow-[0_14px_24px_-18px_rgba(255,122,22,0.34)]' : 'bg-white/10 text-white'
                    )}
                  >
                    <TabIcon className="h-4 w-4" />
                  </div>
                  <p className={cn('min-w-0 text-[11px] font-black tracking-tight', isActive ? 'text-[#14295F]' : 'text-white')}>
                    {meta.shortLabel}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
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
      <DialogContent className="parent-font-dialog max-w-[95vw] rounded-[2rem] border border-slate-200 p-0 overflow-x-hidden overflow-y-auto sm:max-w-3xl">
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
      <DialogContent className="parent-font-dialog max-w-[95vw] rounded-[2rem] border border-slate-200 p-0 overflow-x-hidden overflow-y-auto sm:max-w-3xl">
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
  const safeMinutes = Math.max(0, Math.round(minutes));
  const h = Math.floor(safeMinutes / 60);
  const m = safeMinutes % 60;
  return `${h}h ${m}m`;
}

function formatCalendarMinutes(minutes: number, compact = false) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const h = Math.floor(safeMinutes / 60);
  const m = safeMinutes % 60;

  if (!compact) return `${h}h ${m}m`;
  if (safeMinutes <= 0) return '0m';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

function formatAttendanceTimeLabel(value: Date | null, emptyLabel = '미기록') {
  if (!value || Number.isNaN(value.getTime())) return emptyLabel;
  return format(value, 'HH:mm');
}

type ParentCalendarFlowLevel = 'none' | 'light' | 'medium' | 'high';

const PARENT_CALENDAR_THRESHOLDS = {
  light: 240,
  medium: 480,
} as const;

const PARENT_CALENDAR_LEGEND = [
  { level: 'none', label: '0h 0m', swatch: 'bg-white ring-[#D5E5DB]' },
  { level: 'light', label: '< 4h', swatch: 'bg-[#E8F8ED] ring-[#BEE3C9]' },
  { level: 'medium', label: '4h ~ 8h', swatch: 'bg-[#9DDBB0] ring-[#5DB97B]' },
  { level: 'high', label: '8h+', swatch: 'bg-[#1D8A4C] ring-[#116B38]' },
] as const;

function getParentCalendarFlowLevel(minutes: number): ParentCalendarFlowLevel {
  if (minutes <= 0) return 'none';
  if (minutes < PARENT_CALENDAR_THRESHOLDS.light) return 'light';
  if (minutes < PARENT_CALENDAR_THRESHOLDS.medium) return 'medium';
  return 'high';
}

function getParentCalendarCellClass(minutes: number, isCurrentMonth: boolean, isMobileView: boolean) {
  if (!isCurrentMonth) {
    return 'border border-[#E7EDF7] bg-[linear-gradient(180deg,#FAFBFE_0%,#F3F6FB_100%)] opacity-[0.54] shadow-none';
  }

  const level = getParentCalendarFlowLevel(minutes);
  if (isMobileView) {
    if (level === 'none') {
      return 'border border-[#D8E5DE] bg-[linear-gradient(180deg,rgba(255,255,255,0.998)_0%,rgba(248,251,249,0.996)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.98),0_14px_26px_-24px_rgba(61,96,72,0.08)]';
    }
    if (level === 'light') {
      return 'border border-[#BCE1C8] bg-[linear-gradient(180deg,rgba(250,255,251,0.998)_0%,rgba(232,248,237,0.996)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.97),0_16px_30px_-24px_rgba(45,124,74,0.12)]';
    }
    if (level === 'medium') {
      return 'border border-[#67BE82] bg-[linear-gradient(180deg,rgba(242,253,245,0.998)_0%,rgba(190,233,203,0.996)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_17px_30px_-24px_rgba(31,125,69,0.16)]';
    }
    return 'border border-[#0F6B37] bg-[linear-gradient(180deg,rgba(212,242,221,0.998)_0%,rgba(32,139,77,0.998)_100%)] shadow-[inset_0_1px_0_rgba(235,250,240,0.52),0_20px_34px_-22px_rgba(18,102,54,0.22)]';
  }

  if (level === 'none') {
    return 'border border-[#D8E5DE] bg-[linear-gradient(180deg,rgba(255,255,255,0.998)_0%,rgba(248,251,249,0.996)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.98),0_15px_28px_-24px_rgba(61,96,72,0.08)]';
  }
  if (level === 'light') {
    return 'border border-[#BCE1C8] bg-[linear-gradient(180deg,rgba(250,255,251,0.998)_0%,rgba(235,249,239,0.996)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.97),0_16px_30px_-24px_rgba(45,124,74,0.12)]';
  }
  if (level === 'medium') {
    return 'border border-[#67BE82] bg-[linear-gradient(180deg,rgba(244,253,247,0.998)_0%,rgba(197,235,209,0.996)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_17px_30px_-24px_rgba(31,125,69,0.16)]';
  }
  return 'border border-[#0F6B37] bg-[linear-gradient(180deg,rgba(214,243,222,0.998)_0%,rgba(32,139,77,0.998)_100%)] shadow-[inset_0_1px_0_rgba(235,250,240,0.56),0_20px_34px_-22px_rgba(18,102,54,0.24)]';
}

function getParentCalendarValueTone(minutes: number, isCurrentMonth: boolean, isMobileView: boolean) {
  if (!isCurrentMonth) return 'text-[#C6CFDD]';
  const level = getParentCalendarFlowLevel(minutes);
  if (level === 'none') return isMobileView ? 'text-[#6F8475]' : 'text-[#738779]';
  if (level === 'light') return 'text-[#2F6F48]';
  if (level === 'medium') return 'text-[#175336]';
  return 'text-white';
}

function getParentLegendChipClass(level: ParentCalendarFlowLevel) {
  if (level === 'none') return 'border-[#D8E5DE] bg-white text-[#708578]';
  if (level === 'light') return 'border-[#C6E4CF] bg-[#F4FCF6] text-[#3C7C54]';
  if (level === 'medium') return 'border-[#7BC694] bg-[#E7F7EC] text-[#205D3C]';
  return 'border-[#1D8A4C] bg-[#1D8A4C] text-white';
}

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

function toRelativeLabel(value: TimestampLike, nowMs = 0) {
  const date = toDateSafe(value);
  if (!date) return '최근';
  if (!Number.isFinite(nowMs) || nowMs <= 0) {
    return format(date, 'MM/dd HH:mm', { locale: ko });
  }
  const diffMs = nowMs - date.getTime();
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
  const isAppMode = viewMode === 'mobile';
  const [today, setToday] = useState<Date | null>(null);
  const [liveNowMs, setLiveNowMs] = useState(0);
  const [tab, setTab] = useState<ParentPortalTab>('home');
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date | null>(null);

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

  useEffect(() => {
    const syncToday = () => {
      const next = new Date();
      setLiveNowMs(next.getTime());
      setToday((previous) => {
        if (previous && format(previous, 'yyyy-MM-dd') === format(next, 'yyyy-MM-dd')) {
          return previous;
        }
        return next;
      });
      setCurrentCalendarDate((previous) => previous ?? next);
    };

    syncToday();
    const intervalId = window.setInterval(syncToday, 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const active센터Membership = useMemo(() => {
    if (activeMembership) {
      return memberships.find((membership) => membership.id === activeMembership.id) || activeMembership;
    }
    return memberships.find((membership) => membership.status === 'active') || memberships[0] || null;
  }, [activeMembership, memberships]);

  const centerId = active센터Membership?.id;
  const calendarBaseDate = currentCalendarDate ?? today;
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
        logHandledClientIssue('[parent-dashboard] failed to load linked students', error);
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
      logHandledClientIssue(`[parent-activity] failed to log event (${eventType})`, error);
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
  const shouldLoadNotifications = isActive && !!centerId && !!studentId && !!user && (tab === 'home' || tab === 'communication');
  const shouldLoadReportArchive = isActive && !!studentId && isReportArchiveOpen;
  const shouldLoadParentCommunications = isActive && !!centerId && !!user && tab === 'communication';
  const shouldLoadInvoices = isActive && !!studentId && tab === 'billing';

  const todayLogRef = useMemoFirebase(() => (!firestore || !centerId || !studentId || !todayKey ? null : doc(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', todayKey)), [firestore, centerId, studentId, todayKey]);
  const { data: todayLog } = useDoc<StudyLogDay>(todayLogRef, { enabled: isActive && !!studentId });

  const analyticsLookbackDays = tab === 'data' ? 42 : 35;
  const recentAnalyticsStartKey = today ? format(subDays(today, analyticsLookbackDays - 1), 'yyyy-MM-dd') : '';
  const calendarRangeStartKey = calendarBaseDate
    ? format(startOfWeek(startOfMonth(calendarBaseDate), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    : '';
  const calendarRangeEndKey = calendarBaseDate
    ? format(endOfWeek(endOfMonth(calendarBaseDate), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    : '';

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
  const selectedDateAttendanceRecordRef = useMemoFirebase(
    () =>
      !firestore || !centerId || !studentId || !selectedDateKey
        ? null
        : doc(firestore, 'centers', centerId, 'attendanceRecords', selectedDateKey, 'students', studentId),
    [firestore, centerId, studentId, selectedDateKey]
  );
  const { data: selectedDateAttendanceRecord } = useDoc<Record<string, unknown>>(selectedDateAttendanceRecordRef, {
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
        logHandledClientIssue('[parent-dashboard] failed to load check-in trend', error);
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
        logHandledClientIssue('[parent-dashboard] failed to load study rhythm trend', error);
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
        logHandledClientIssue('[parent-report] viewedAt update failed', error);
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
  const centerAnnouncementsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'centerAnnouncements'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
  }, [firestore, centerId]);
  const { data: rawCenterAnnouncements } = useCollection<CenterAnnouncementRecord>(centerAnnouncementsQuery, {
    enabled: shouldLoadNotifications,
  });

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
  const hasOutstandingInvoice = useMemo(
    () => displayInvoices.some((invoice) => invoice.status === 'issued' || invoice.status === 'overdue'),
    [displayInvoices]
  );
  const primaryInvoice = useMemo(
    () => displayInvoices.find((invoice) => invoice.status === 'issued' || invoice.status === 'overdue') || displayInvoices[0] || null,
    [displayInvoices]
  );
  const secondaryInvoices = useMemo(
    () => (primaryInvoice ? displayInvoices.filter((invoice) => invoice.id !== primaryInvoice.id) : []),
    [displayInvoices, primaryInvoice]
  );

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
    if (!hasOutstandingInvoice) {
      return {
        label: '완납',
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      };
    }
    return {
      label: '미납',
      className: 'bg-rose-100 text-rose-700 border-rose-200',
    };
  }, [displayInvoices, hasOutstandingInvoice]);

  const studyPlans = (todayPlans || []).filter((item) => item.category === 'study' || !item.category);
  const persistedTodayMinutes = Math.max(0, Number(todayLog?.totalMinutes || 0));
  const liveStudySessionMinutes = useMemo(() => {
    if (!today || liveNowMs <= 0) return 0;
    if (!attendanceCurrent?.status || !PARENT_ACTIVE_STUDY_STATUSES.includes(attendanceCurrent.status)) return 0;

    const checkInAt = toDateSafe(attendanceCurrent.lastCheckInAt as TimestampLike);
    if (!checkInAt) return 0;

    const todayStartedAt = new Date(today);
    todayStartedAt.setHours(0, 0, 0, 0);
    const effectiveStartAt = checkInAt.getTime() < todayStartedAt.getTime() ? todayStartedAt : checkInAt;
    const elapsedMs = liveNowMs - effectiveStartAt.getTime();
    if (elapsedMs <= 0) return 0;

    return Math.max(1, Math.ceil(elapsedMs / 60000));
  }, [attendanceCurrent?.lastCheckInAt, attendanceCurrent?.status, liveNowMs, today]);
  const totalMinutes = persistedTodayMinutes + liveStudySessionMinutes;
  
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
  const calendarMinutesByDateKey = useMemo(() => {
    const map = new Map(logMinutesByDateKey);
    if (todayKey) {
      map.set(todayKey, totalMinutes);
    }
    return map;
  }, [logMinutesByDateKey, todayKey, totalMinutes]);

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
    const nowMs = liveNowMs;
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
  }, [growth?.penaltyPoints, liveNowMs, penaltyLogs]);
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
      insights.push('학습 로그가 쌓이면 트랙 러닝시스템 인사이트가 자동으로 정교해집니다.');
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
      return { label: '등원(학습중)', color: 'bg-[#eaf2ff] text-[#14295F] border-blue-100', icon: UserCheck };
    }

    if (!isStudying && hasRecord) {
      return { label: '하원', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: Home };
    }

    const routineItems = todayPlans?.filter(p => p.category === 'schedule') || [];
    const isAbsentDay = routineItems.some(p => p.title.includes('등원하지 않습니다'));
    
    if (isAbsentDay) {
      return { label: '결석(휴무)', color: 'bg-rose-50 text-rose-600 border-rose-100', icon: CalendarX };
    }

    const inTimePlan = routineItems.find(p => p.title.includes('등원 예정'));
    if (inTimePlan) {
      const timeStr = inTimePlan.title.split(': ')[1];
      if (timeStr) {
        try {
          const nowDate = liveNowMs > 0 ? new Date(liveNowMs) : null;
          if (!nowDate) {
            return { label: '미입실 (입실 전)', color: 'bg-slate-100 text-slate-400 border-slate-200', icon: Clock };
          }
          const scheduledTime = parse(timeStr, 'HH:mm', nowDate);
          if (isAfter(nowDate, scheduledTime)) {
            return { label: '지각 주의', color: 'bg-orange-50 text-[#FF7A16] border-orange-100', icon: AlertCircle };
          }
        } catch (e) {}
      }
    }

    return { label: '미입실 (입실 전)', color: 'bg-slate-100 text-slate-400 border-slate-200', icon: Clock };
  }, [attendanceCurrent, liveNowMs, todayLog, todayPlans]);

  // 캘린더 데이터 생성
  const calendarData = useMemo(() => {
    if (!calendarBaseDate) return [];
    const start = startOfMonth(calendarBaseDate);
    const end = endOfMonth(calendarBaseDate);
    const calendarStart = startOfWeek(start, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(end, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [calendarBaseDate]);

  const getHeatmapColor = (minutes: number) => {
    const level = getParentCalendarFlowLevel(minutes);
    if (level === 'none') return 'bg-[linear-gradient(180deg,rgba(255,255,255,0.998)_0%,rgba(244,248,245,0.996)_100%)] ring-1 ring-inset ring-[#D7E1DA]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.98),0_16px_30px_-28px_rgba(82,112,91,0.08)]';
    if (level === 'light') return 'bg-[linear-gradient(180deg,rgba(249,255,250,0.998)_0%,rgba(228,247,234,0.996)_100%)] ring-1 ring-inset ring-[#B6DFC2]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.97),0_18px_32px_-28px_rgba(52,138,87,0.12)]';
    if (level === 'medium') return 'bg-[linear-gradient(180deg,rgba(239,252,243,0.998)_0%,rgba(177,232,192,0.997)_100%)] ring-1 ring-inset ring-[#67C485]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_18px_34px_-28px_rgba(38,143,78,0.16)]';
    return 'bg-[linear-gradient(180deg,rgba(197,238,209,0.998)_0%,rgba(24,128,69,0.998)_100%)] ring-1 ring-inset ring-[#0F6B37]/95 shadow-[inset_0_1px_0_rgba(232,250,238,0.38),0_24px_42px_-26px_rgba(12,98,49,0.3)]';
  };

  const getParentCalendarTimeCapsuleClass = (minutes: number, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return 'border-slate-200/80 bg-white/70 text-slate-300 shadow-none';
    const level = getParentCalendarFlowLevel(minutes);
    if (level === 'none') return 'border-[#D7E1DA] bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(246,249,247,0.99))] text-[#7A8F80] shadow-[0_10px_18px_-18px_rgba(82,112,91,0.08)]';
    if (level === 'light') return 'border-[#B6DFC2] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(233,248,237,0.99))] text-[#3C7F56] shadow-[0_12px_20px_-18px_rgba(52,138,87,0.12)]';
    if (level === 'medium') return 'border-[#63BF7F] bg-[linear-gradient(180deg,rgba(247,255,249,0.98),rgba(205,241,215,0.995))] text-[#1D6E44] shadow-[0_12px_20px_-18px_rgba(38,143,78,0.16)]';
    return 'border-[#0F6B37] bg-[linear-gradient(180deg,rgba(58,158,96,0.98),rgba(15,107,55,0.998))] text-white shadow-[0_14px_24px_-18px_rgba(12,98,49,0.28)]';
  };

  const announcementNotifications = useMemo<ParentNotificationItem[]>(() => {
    return (rawCenterAnnouncements || [])
      .filter((item) => {
        const normalizedStatus = item?.status?.trim?.().toLowerCase();
        const isPublished = normalizedStatus ? normalizedStatus === 'published' : typeof item?.isPublished === 'boolean' ? item.isPublished : true;
        const audience = item?.audience || 'parent';
        return isPublished && (audience === 'parent' || audience === 'all');
      })
      .map((item, index) => {
        const timestamp = Math.max(item?.updatedAt?.toMillis?.() || 0, item?.createdAt?.toMillis?.() || 0);
        return {
          id: `announcement-${item?.id || index}`,
          type: 'announcement',
          title: item?.title || '센터 공지사항',
          body: item?.body || '센터 공지 내용을 확인해 주세요.',
          createdAtLabel: toRelativeLabel(item?.updatedAt || item?.createdAt, liveNowMs),
          createdAtMs: timestamp,
          isRead: liveNowMs > 0 ? liveNowMs - timestamp >= 3 * 24 * 60 * 60 * 1000 : false,
          isImportant: false,
          category: 'general',
        };
      });
  }, [liveNowMs, rawCenterAnnouncements]);

  const notifications: ParentNotificationItem[] = useMemo(() => {
    if (remoteNotifications && remoteNotifications.length > 0) {
      const personalNotifications = remoteNotifications.map((item: any) => ({
        id: item.id,
        type: item.type || 'weekly_report',
        title: item.title || '새 알림',
        body: item.body || '',
        createdAtLabel: item.createdAtLabel || toRelativeLabel(item.createdAt, liveNowMs),
        createdAtMs: toDateSafe(item.createdAt)?.getTime() || 0,
        isRead: !!item.isRead,
        isImportant: !!item.isImportant,
      }));
      return [...personalNotifications, ...announcementNotifications];
    }

    const fallback: ParentNotificationItem[] = [];

    if (attendanceCurrent) {
      fallback.push({
        id: `attendance-${attendanceCurrent.id || 'current'}`,
        type: attendanceCurrent.status === 'studying' ? 'check_in' : 'check_out',
        title: attendanceCurrent.status === 'studying' ? '등원 상태 확인' : '출결 상태 업데이트',
        body: attendanceStatus.label,
        createdAtLabel: toRelativeLabel((attendanceCurrent as any).updatedAt, liveNowMs),
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
        createdAtLabel: toRelativeLabel((report as any).updatedAt || (report as any).createdAt, liveNowMs),
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

    return [...fallback, ...announcementNotifications];
  }, [remoteNotifications, attendanceCurrent, attendanceStatus.label, report, recentPenaltyReasons, studentId, yesterdayKey, announcementNotifications, liveNowMs]);

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  }, [notifications]);

  const recentNotifications = useMemo(() => sortedNotifications.slice(0, 3), [sortedNotifications]);
  const recentAnnouncementNotifications = useMemo(
    () => sortedNotifications.filter((notification) => notification.type === 'announcement').slice(0, 3),
    [sortedNotifications]
  );
  const recentAlertNotifications = useMemo(
    () => sortedNotifications.filter((notification) => notification.type !== 'announcement').slice(0, 3),
    [sortedNotifications]
  );
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
      dateLabel: today ? format(today, 'MM/dd(EEE)', { locale: ko }) : '오늘',
      checkInLabel: formatAttendanceTimeLabel(todayCheckInAt, '미기록'),
      checkOutLabel: isCurrentlyInside
        ? todayCheckOutAt
          ? formatAttendanceTimeLabel(todayCheckOutAt)
          : '학습중'
        : todayCheckOutAt
          ? formatAttendanceTimeLabel(todayCheckOutAt)
          : todayCheckInAt
            ? '기록대기'
            : '미기록',
    };
  }, [attendanceCurrent?.status, today, todayCheckInAt, todayCheckOutAt]);

  const selectedDateCheckInAt = useMemo(() => {
    if (!selectedDateKey) return null;
    if (selectedDateKey === todayKey && todayCheckInAt) return todayCheckInAt;
    return toDateSafe(
      (selectedDateAttendanceRecord?.checkInAt as TimestampLike) || (selectedDateAttendanceRecord?.updatedAt as TimestampLike)
    );
  }, [selectedDateAttendanceRecord, selectedDateKey, todayCheckInAt, todayKey]);

  const selectedDateCheckOutAt = useMemo(() => {
    if (!selectedDateKey) return null;
    if (selectedDateKey === todayKey && todayCheckOutAt) return todayCheckOutAt;
    return toDateSafe(selectedDateAttendanceRecord?.checkOutAt as TimestampLike);
  }, [selectedDateAttendanceRecord, selectedDateKey, todayCheckOutAt, todayKey]);

  const selectedDateAttendanceSummary = useMemo(() => {
    const isSelectedToday = !!selectedDateKey && selectedDateKey === todayKey;
    const isCurrentlyInside = isSelectedToday && ['studying', 'away', 'break'].includes(attendanceCurrent?.status || '');

    return {
      checkInLabel: formatAttendanceTimeLabel(selectedDateCheckInAt, '미기록'),
      checkOutLabel: isCurrentlyInside
        ? selectedDateCheckOutAt
          ? formatAttendanceTimeLabel(selectedDateCheckOutAt)
          : '학습 중'
        : selectedDateCheckOutAt
          ? formatAttendanceTimeLabel(selectedDateCheckOutAt)
          : selectedDateCheckInAt
            ? '기록 대기'
            : '미기록',
    };
  }, [attendanceCurrent?.status, selectedDateCheckInAt, selectedDateCheckOutAt, selectedDateKey, todayKey]);

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
  const homeStudyTone = PARENT_HOME_METRIC_TONE_STYLES.study;
  const homePlanTone = PARENT_HOME_METRIC_TONE_STYLES.plan;
  const homeAttendanceTone = PARENT_HOME_METRIC_TONE_STYLES.attendance;
  const homePenaltyTone = PARENT_HOME_METRIC_TONE_STYLES.penalty;

  const selectedDateLog = useMemo(() => {
    if (!selectedDateKey) return null;
    return (allLogs || []).find((log) => log.dateKey === selectedDateKey) || null;
  }, [allLogs, selectedDateKey]);
  const selectedDateTotalMinutes = useMemo(() => {
    if (!selectedDateKey) return 0;
    if (selectedDateKey === todayKey) return totalMinutes;
    return Math.max(0, Number(selectedDateLog?.totalMinutes || 0));
  }, [selectedDateKey, selectedDateLog?.totalMinutes, todayKey, totalMinutes]);

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
      logHandledClientIssue('[parent-dashboard] report viewed update failed', error);
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
    <div className={cn("relative isolate space-y-4 pb-[calc(6.2rem+env(safe-area-inset-bottom))] md:space-y-5", isMobile ? "px-0" : "mx-auto max-w-5xl px-4")}>
      {growthCelebration && (
        <ParentGrowthCelebration
          celebration={growthCelebration}
          studentName={student?.name || '자녀'}
          onClose={() => setGrowthCelebration(null)}
        />
      )}

      <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
        {!isMobile ? (
          <ParentDashboardTabRail
            tab={tab}
            activeStudentLabel={activeStudentLabel}
            todayLabel={today ? format(today, 'yyyy. MM. dd (EEE)', { locale: ko }) : '오늘'}
            linkedStudents={linkedStudents}
            studentId={studentId}
            onStudentChange={handleStudentChange}
            onTabChange={handleTabChange}
            totalMinutes={totalMinutes}
            unreadRecentCount={unreadRecentCount}
            reportsCount={reportsArchive.length}
            hasOutstandingInvoice={Boolean(primaryInvoice && (primaryInvoice.status === 'issued' || primaryInvoice.status === 'overdue'))}
            showEntryMotion={showEntryMotion}
          />
        ) : null}

        <TabsContent value="home" className="parent-tab-panel mt-0 space-y-4 sm:space-y-5">
          <section
            className={cn(
              'on-dark relative overflow-hidden rounded-[2.45rem] border border-[#24437f] bg-[linear-gradient(155deg,#1d3d79_0%,#14295F_52%,#0d1c45_100%)] p-5 shadow-[0_30px_70px_-44px_rgba(20,41,95,0.58)] sm:p-6',
              showEntryMotion && 'parent-hero-enter parent-entry-delay-2'
            )}
          >
            <div className="soft-glow absolute -right-8 top-0 h-28 w-28 rounded-full bg-[#ffbf7d]/24 blur-3xl" />
            <div className="soft-glow absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-[#7aa6ff]/18 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(255,122,22,0.24),transparent_34%)]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.07)_100%)]" />

            <div className="relative z-10 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline" className="h-7 rounded-full border border-white/14 bg-white/10 px-3 text-[11px] font-black text-white shadow-[0_12px_28px_-22px_rgba(5,10,28,0.6)] backdrop-blur-sm">
                  {today ? format(today, 'yyyy. MM. dd (EEE)', { locale: ko }) : '오늘'}
                </Badge>
                <div className="flex items-center gap-2 rounded-full border border-white/14 bg-white/10 px-3 py-1.5 shadow-[0_12px_28px_-22px_rgba(5,10,28,0.6)] backdrop-blur-sm">
                  <span className="inline-flex h-2 w-2 rounded-full bg-[#FF7A16]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white">실시간 앱 모니터링</span>
                </div>
              </div>

              <div className="space-y-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white">Today Flow</p>
                <div className="space-y-2">
                  <p className="text-[12px] font-black tracking-tight text-white">{student?.name || '자녀'} 오늘 흐름</p>
                  <h2 className="max-w-[18ch] break-keep text-[1.42rem] font-black leading-[1.14] tracking-[-0.045em] text-white sm:text-[1.82rem] md:max-w-none md:text-[2rem]">
                    {heroTone.title}
                  </h2>
                  <p className="max-w-2xl break-keep text-[13px] font-bold leading-[1.72] text-white sm:text-sm md:text-[14px]">
                    {heroTone.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'h-7 rounded-full border px-3 text-[11px] font-black shadow-[0_12px_24px_-22px_rgba(5,10,28,0.7)] backdrop-blur-sm',
                    growthCelebrationCandidate ? 'border-[#ffb56c] bg-[#FF7A16] text-white' : 'border-white/14 bg-white/10 text-white'
                  )}
                >
                  {heroTone.badgeLabel}
                </Badge>
                {growthCelebrationCandidate && (
                  <Badge variant="outline" className="h-7 rounded-full border border-white/14 bg-white/10 px-3 text-[11px] font-black text-white shadow-[0_12px_24px_-22px_rgba(5,10,28,0.7)] backdrop-blur-sm">
                    평균 대비 +{growthCelebrationCandidate.increaseRate}%
                  </Badge>
                )}
                <Badge variant="outline" className="h-7 rounded-full border border-white/14 bg-white/10 px-3 text-[11px] font-black text-white shadow-[0_12px_24px_-22px_rgba(5,10,28,0.7)] backdrop-blur-sm">
                  출결 {attendanceStatus.label.split('(')[0].trim()}
                </Badge>
              </div>

              <div className="grid gap-3 rounded-[1.55rem] border border-white/12 bg-white/8 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">오늘 먼저 볼 포인트</p>
                  <p className="mt-1 break-keep text-[14px] font-black tracking-tight text-white">
                    출결 {attendanceStatus.label.split('(')[0].trim()} · 계획 {planRate}% · 벌점 {penaltyRecovery.effectivePoints}점
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-black text-white">
                  <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5">공부 {toHm(totalMinutes)}</span>
                  <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5">알림 {recentNotifications.length}건</span>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 xl:gap-4">
            <ParentHomeMetricCardShell
              tone="study"
              className={cn(
                'md:min-h-[12rem] lg:min-h-[12.6rem]',
                showEntryMotion && 'parent-card-enter parent-entry-delay-3'
              )}
            >
              <div className="flex h-full flex-col gap-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={cn('text-[10px] font-black uppercase tracking-[0.18em]', homeStudyTone.eyebrow)}>오늘 공부</p>
                    <div className="mt-2">
                      <ParentDurationValue minutes={totalMinutes} className="text-[1.54rem] sm:text-[1.84rem] lg:text-[2rem]" unitClassName={homeStudyTone.accentText} />
                    </div>
                  </div>
                  <Badge variant="outline" className={cn('h-6 rounded-full border px-2.5 text-[10px] font-black shadow-sm', homeStudyTone.pill)}>
                    {growthCelebrationCandidate ? `+${growthCelebrationCandidate.increaseRate}%` : '7일 흐름'}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[12px] font-bold leading-5 text-slate-600">
                    최근 7일 최고 {studyTrendHasActivity ? toHm(studyTrendPeakMinutes) : '기록 대기'}
                  </p>
                  <p className="text-[12px] font-bold leading-5 text-slate-500">
                    전일 대비 {studyTrendHasActivity ? formatSignedMinutes(studyDeltaFromYesterday) : '기록 대기'}
                  </p>
                </div>
                <div className={cn('mt-auto grid grid-cols-2 gap-2 rounded-[1.2rem] border px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]', homeStudyTone.rail)}>
                  <div className="min-w-0">
                    <p className={cn('text-[9px] font-black uppercase tracking-[0.1em]', homeStudyTone.railLabel)}>최근 평균</p>
                    <p className={cn('mt-1 text-[12px] font-black', homeStudyTone.railValue)}>
                      {previous7DayAverageMinutes > 0 ? toHm(previous7DayAverageMinutes) : '기록 대기'}
                    </p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className={cn('text-[9px] font-black uppercase tracking-[0.1em]', homeStudyTone.railLabel)}>기록 일수</p>
                    <p className={cn('mt-1 text-[12px] font-black', homeStudyTone.railValue)}>
                      {studyTrendHasActivity ? `${dailyStudyTrend.filter((point) => point.minutes > 0).length}일` : '대기'}
                    </p>
                  </div>
                </div>
              </div>
            </ParentHomeMetricCardShell>

            <ParentHomeMetricCardShell
              tone="plan"
              className={cn(
                'md:min-h-[12rem] lg:min-h-[12.6rem]',
                showEntryMotion && 'parent-card-enter parent-entry-delay-3'
              )}
            >
              <div className="flex h-full flex-col gap-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={cn('text-[10px] font-black uppercase tracking-[0.18em]', homePlanTone.eyebrow)}>계획 달성</p>
                    <div className="mt-2">
                      <ParentStatValue value={planRate} unit="%" className="text-[1.58rem] sm:text-[1.88rem] lg:text-[2.02rem]" unitClassName={homePlanTone.accentText} />
                    </div>
                  </div>
                  <Badge variant="outline" className={cn('h-6 rounded-full border px-2.5 text-[10px] font-black shadow-sm', homePlanTone.pill)}>
                    {planTotal > 0 ? `오늘 ${planDone}/${planTotal}` : '계획 대기'}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[12px] font-bold leading-5 text-slate-600">
                    최근 7일 완료 {planTrendActiveDays > 0 ? `${planTrendCompletedDays}일` : '기록 대기'}
                  </p>
                  <p className="text-[12px] font-bold leading-5 text-slate-500">
                    주간 평균 {planTrendActiveDays > 0 ? `${planTrendAverageRate}%` : '계획 대기'}
                  </p>
                </div>
                <div className={cn('mt-auto grid grid-cols-2 gap-2 rounded-[1.2rem] border px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]', homePlanTone.rail)}>
                  <div className="min-w-0">
                    <p className={cn('text-[9px] font-black uppercase tracking-[0.1em]', homePlanTone.railLabel)}>완료일</p>
                    <p className={cn('mt-1 text-[12px] font-black', homePlanTone.railValue)}>
                      {planTrendActiveDays > 0 ? `${planTrendCompletedDays}/${planTrendActiveDays}일` : '최근 7일 대기'}
                    </p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className={cn('text-[9px] font-black uppercase tracking-[0.1em]', homePlanTone.railLabel)}>활성일</p>
                    <p className={cn('mt-1 text-[12px] font-black', homePlanTone.railValue)}>
                      {planTrendActiveDays > 0 ? `${planTrendActiveDays}일` : '기록 대기'}
                    </p>
                  </div>
                </div>
              </div>
            </ParentHomeMetricCardShell>

            <ParentHomeMetricCardShell
              tone="attendance"
              className={cn(
                'md:min-h-[11rem] lg:min-h-[11.4rem]',
                showEntryMotion && 'parent-card-enter parent-entry-delay-4'
              )}
            >
              <div className="flex h-full flex-col gap-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.1rem] border border-[#d4eaef] bg-[#eff9fc] shadow-[0_12px_24px_-20px_rgba(27,114,141,0.36)]">
                      <attendanceStatus.icon className="h-[1.15rem] w-[1.15rem] text-[#1b728d]" />
                    </div>
                    <div className="min-w-0">
                      <p className={cn('text-[10px] font-black uppercase tracking-[0.18em]', homeAttendanceTone.eyebrow)}>출결 상태</p>
                      <p className="mt-2 break-keep text-[0.98rem] font-black leading-[1.3] tracking-[-0.03em] text-[#14295F] sm:text-[1.08rem]">
                        {attendanceStatus.label}
                      </p>
                      <p className="mt-1 text-[12px] font-bold leading-5 text-slate-500">앱에 연결된 실시간 출결 흐름입니다.</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn('h-6 rounded-full border px-2.5 text-[10px] font-black shadow-sm', homeAttendanceTone.pill)}>
                    실시간
                  </Badge>
                </div>
                <div className={cn('mt-auto grid grid-cols-2 gap-2 rounded-[1.2rem] border px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]', homeAttendanceTone.rail)}>
                  <div className="min-w-0">
                    <p className={cn('text-[9px] font-black uppercase tracking-[0.1em]', homeAttendanceTone.railLabel)}>등원시간</p>
                    <p className={cn('mt-1 text-[12px] font-black', homeAttendanceTone.railValue)}>{todayAttendanceTimeSummary.checkInLabel}</p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className={cn('text-[9px] font-black uppercase tracking-[0.1em]', homeAttendanceTone.railLabel)}>하원시간</p>
                    <p className={cn('mt-1 text-[12px] font-black', homeAttendanceTone.railValue)}>{todayAttendanceTimeSummary.checkOutLabel}</p>
                  </div>
                </div>
              </div>
            </ParentHomeMetricCardShell>

            <ParentHomeMetricCardShell
              tone="penalty"
              interactive
              role="button"
              onClick={() => setIsPenaltyGuideOpen(true)}
              className={cn(
                'md:min-h-[11rem] lg:min-h-[11.4rem]',
                showEntryMotion && 'parent-card-enter parent-entry-delay-4'
              )}
            >
              <div className="flex h-full flex-col gap-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={cn('text-[10px] font-black uppercase tracking-[0.18em]', homePenaltyTone.eyebrow)}>벌점 지수</p>
                    <div className="mt-2">
                      <ParentStatValue
                        value={penaltyRecovery.effectivePoints}
                        unit="점"
                        className="text-[1.6rem] text-[#8f1534] sm:text-[1.9rem] lg:text-[2.04rem]"
                        unitClassName="text-rose-400"
                      />
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'h-6 rounded-full border px-2.5 text-[10px] font-black shadow-sm',
                      penaltyRecovery.effectivePoints === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : homePenaltyTone.pill
                    )}
                  >
                    {penaltyMeta.label}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  {latestPenaltyHighlight ? (
                    <>
                      <p className="line-clamp-2 break-keep text-[12px] font-black leading-5 text-[#8f1534]">
                        {latestPenaltyHighlight.reason}
                      </p>
                      <p className="text-[12px] font-bold leading-5 text-slate-500">
                        {latestPenaltyHighlight.dateLabel} · 최근 +{latestPenaltyHighlight.points}점
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[12px] font-black leading-5 text-[#8f1534]">최근 벌점 기록 없음</p>
                      <p className="text-[12px] font-bold leading-5 text-slate-500">현재 생활 흐름이 안정적으로 유지되고 있어요.</p>
                    </>
                  )}
                </div>
                <div className={cn('mt-auto grid grid-cols-2 gap-2 rounded-[1.2rem] border px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]', homePenaltyTone.rail)}>
                  <div className="min-w-0">
                    <p className={cn('text-[9px] font-black uppercase tracking-[0.1em]', homePenaltyTone.railLabel)}>원점수</p>
                    <p className={cn('mt-1 text-[12px] font-black', homePenaltyTone.railValue)}>{penaltyRecovery.basePoints}점</p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className={cn('text-[9px] font-black uppercase tracking-[0.1em]', homePenaltyTone.railLabel)}>회복 반영</p>
                    <p className={cn('mt-1 text-[12px] font-black', homePenaltyTone.railValue)}>
                      {penaltyRecovery.recoveredPoints > 0 ? `-${penaltyRecovery.recoveredPoints}점` : '기록 대기'}
                    </p>
                  </div>
                </div>
              </div>
            </ParentHomeMetricCardShell>
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
                'group relative overflow-hidden rounded-[2.1rem] border border-[#ffd8b1] bg-[linear-gradient(180deg,#fffdf9_0%,#ffffff_42%,#fff3e7_100%)] p-5 shadow-[0_28px_48px_-34px_rgba(255,122,22,0.18)] ring-1 ring-[#fff1e0] transition-[transform,box-shadow,border-color,filter] duration-300 active:scale-[0.99] md:hover:-translate-y-1.5 md:hover:border-[#ffbf7a] md:hover:shadow-[0_36px_56px_-30px_rgba(255,122,22,0.24)] md:hover:brightness-[1.01] sm:p-6',
                showEntryMotion && 'parent-card-enter parent-entry-delay-4'
              )}
            >
              <div className="soft-glow absolute right-0 top-0 h-28 w-28 rounded-full bg-[#ffb56a]/22 blur-3xl" />
              <div className="absolute right-0 top-0 p-4 opacity-[0.05] transition-transform duration-700 group-hover:translate-x-1 group-hover:-translate-y-1">
                <MessageCircle className="h-20 w-20 text-[#FF7A16]" />
              </div>
              <div className="relative z-10 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff9339_0%,#FF7A16_100%)] text-white shadow-[0_14px_26px_-18px_rgba(255,122,22,0.42)]">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c56a14]">우리 아이 리포트</span>
                      <p className="mt-0.5 text-[13px] font-black tracking-tight text-[#14295F]">가장 먼저 읽을 요약</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {report?.viewedAt ? (
                      <Badge variant="outline" className="h-6 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 text-[10px] font-black text-emerald-700">
                        읽음
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="h-6 rounded-full border border-[#ffd1a2] bg-[#fff3e8] px-2.5 text-[10px] font-black text-[#FF7A16]">
                        새 리포트
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-[#FF7A16] transition-transform duration-300 group-hover:translate-x-0.5" />
                  </div>
                </div>
                <div className="overflow-hidden rounded-[1.7rem] border border-[#ffd7ab] bg-[linear-gradient(180deg,#fffaf4_0%,#ffffff_44%,#ffefe0_100%)] p-4 text-[#14295F] shadow-[0_24px_40px_-28px_rgba(255,122,22,0.18)]">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#ffd18d_0%,#FF7A16_55%,#d45c09_100%)]" />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c76810]">Today Summary</p>
                    <span className="rounded-full border border-[#ffd4a6] bg-white/92 px-2.5 py-1 text-[10px] font-black text-[#c25d08] shadow-sm">바로 보기</span>
                  </div>
                  <p className="mt-3 line-clamp-4 break-keep text-[13px] font-bold leading-relaxed text-[#173164]">
                    {report?.content || '카드를 누르면 자녀의 최근 학습 리포트와 선생님 피드백을 바로 확인할 수 있습니다.'}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[1.1rem] border border-[#ffe0bf] bg-[linear-gradient(180deg,#fffaf3_0%,#fff1e4_100%)] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]">
                  <p className="text-[12px] font-bold text-[#805227]">선생님 피드백과 오늘 흐름을 한 번에 확인합니다.</p>
                  <span className="shrink-0 text-[11px] font-black text-[#FF7A16]">열기</span>
                </div>
              </div>
            </Card>

            <Card
              className={cn(
                'rounded-[2.1rem] border border-[#ffd8af] bg-[linear-gradient(180deg,#fffdf9_0%,#ffffff_44%,#fff4e9_100%)] p-5 shadow-[0_28px_48px_-36px_rgba(255,122,22,0.16)] ring-1 ring-[#fff3e3] sm:p-6',
                showEntryMotion && 'parent-card-enter parent-entry-delay-5'
              )}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#fff3e6_0%,#ffd3aa_100%)] text-[#FF7A16] shadow-[0_14px_24px_-18px_rgba(255,122,22,0.28)]">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c56b15]">최근 알림 3개</span>
                    <p className="mt-0.5 text-[13px] font-black tracking-tight text-[#14295F]">센터 소식과 자녀 알림</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {unreadRecentCount > 0 && (
                    <Badge variant="outline" className="h-6 rounded-full border border-[#ffd1a2] bg-[#fff3e8] px-2.5 text-[10px] font-black text-[#FF7A16]">
                      미읽음 {unreadRecentCount}
                    </Badge>
                  )}
                  <Badge variant="outline" className="h-6 rounded-full border border-[#ffe0bf] bg-white px-2.5 text-[10px] font-black text-[#9f6a37]">
                    {recentNotifications.length}건
                  </Badge>
                </div>
              </div>
              <p className="mb-3 text-[11px] font-bold text-[#8a6744]">센터 공지와 자녀 알림을 홈에서 빠르게 훑어볼 수 있어요.</p>

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
                          'relative w-full overflow-hidden rounded-[1.45rem] border p-4 text-left transition-[transform,box-shadow,border-color] duration-300 md:hover:-translate-y-0.5',
                          isRead
                            ? 'border-[#ffe2c5] bg-[linear-gradient(180deg,#ffffff_0%,#fff8f0_100%)] md:hover:border-[#ffc98f] md:hover:shadow-[0_22px_34px_-24px_rgba(255,122,22,0.2)]'
                            : 'border-[#ffcc99] bg-[linear-gradient(135deg,#fff6ec_0%,#fff0df_100%)] shadow-sm ring-1 ring-[#ffd5a9]/80 md:hover:shadow-[0_20px_34px_-22px_rgba(255,122,22,0.22)]'
                        )}
                        onClick={() => void openNotificationDetail(notification)}
                      >
                        {!isRead && (
                          <>
                            <div className="pointer-events-none absolute -right-5 -top-5 h-16 w-16 rounded-full bg-[#FF7A16]/18 blur-xl" />
                          </>
                        )}
                        <div className="relative z-10 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black tracking-tight text-[#14295F]">{notification.title}</p>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#99724c]">
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
                  'group parent-home-cta-glow h-14 w-full rounded-[1.8rem] border border-[#ffbf81] bg-[linear-gradient(135deg,#ff9a3c_0%,#FF7A16_55%,#d45c08_100%)] text-base font-black text-white shadow-[0_22px_40px_-22px_rgba(255,122,22,0.38)] transition-[transform,box-shadow,filter] duration-300 active:scale-[0.98] hover:brightness-[1.04]',
                  showEntryMotion && 'parent-card-enter parent-entry-delay-5'
                )}
              >
                <TrendingUp className="mr-2 h-5 w-5" />
                트랙 러닝시스템 학습 인사이트 보기
                <ChevronRight className="ml-auto h-4 w-4 opacity-60 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="parent-font-dialog rounded-[3rem] border-none p-0 shadow-2xl overflow-x-hidden overflow-y-auto sm:max-w-md">
              <div className="relative overflow-hidden bg-[linear-gradient(155deg,#1d3d79_0%,#14295F_56%,#0f214d_100%)] p-10 text-white">
                <div className="soft-glow absolute -right-6 top-0 h-24 w-24 rounded-full bg-[#ffbf7d]/24 blur-3xl" />
                <Sparkles className="absolute right-0 top-0 h-32 w-32 p-8 opacity-20" />
                <DialogTitle className="text-2xl font-black tracking-tighter text-white">트랙 러닝시스템 학습 인사이트</DialogTitle>
                <DialogDescription className="mt-1 text-xs font-bold text-white/72">
                  자녀의 학습 패턴을 차분하고 보기 쉽게 정리했습니다.
                </DialogDescription>
              </div>
              <div className="space-y-3 bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] p-6">
                {aiInsights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-4 rounded-2xl border border-[#dbe6fb] bg-white p-5 shadow-[0_18px_28px_-24px_rgba(20,41,95,0.22)] transition-all hover:border-[#ffd2a2]">
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#FF7A16]" />
                    <p className="text-sm font-bold leading-relaxed text-slate-700">{insight}</p>
                  </div>
                ))}
              </div>
              <DialogFooter className="border-t bg-white p-6">
                <DialogClose asChild>
                  <Button className="h-14 w-full rounded-2xl bg-[#14295F] text-lg font-black text-white shadow-[0_18px_28px_-20px_rgba(20,41,95,0.34)]">확인했습니다</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

            <TabsContent value="studyDetail" className="parent-tab-panel mt-0 space-y-4 sm:space-y-5">
              {!isAppMode ? (
                <section
                  className={cn(
                    'overflow-hidden rounded-[2.2rem] border border-[#d9eadf] bg-[linear-gradient(145deg,#fbfffc_0%,#ffffff_58%,#eef9f1_100%)] p-4 shadow-[0_28px_56px_-40px_rgba(23,120,69,0.14)] sm:p-5',
                    showEntryMotion && 'parent-card-enter parent-entry-delay-2'
                  )}
                >
                  <div className={cn('grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end', isMobile && 'gap-3')}>
                    <ParentSectionHeader
                      icon={<History className="h-3.5 w-3.5" />}
                      eyebrow="Study Timeline"
                      title="학습 캘린더와 날짜별 기록"
                      description="달력에서 하루를 누르면 그날 공부시간과 흐름을 바로 읽을 수 있게 정리했습니다."
                      badges={
                        <>
                          <Badge variant="outline" className="h-7 rounded-full border border-[#d7eadc] bg-white px-3 text-[10px] font-black text-[#2b6b45] shadow-sm">
                            {activeStudentLabel}
                          </Badge>
                          <Badge variant="outline" className="h-7 rounded-full border border-[#cfe8d6] bg-[#eef9f1] px-3 text-[10px] font-black text-[#1e8b4d] shadow-sm">
                            월간 흐름
                          </Badge>
                        </>
                      }
                    />

                    <div className="relative flex items-center gap-2 overflow-hidden rounded-[1.35rem] border border-[#d8eadf] bg-[linear-gradient(180deg,#ffffff_0%,#f1faf4_100%)] p-1.5 shadow-[0_20px_34px_-28px_rgba(23,120,69,0.12)]">
                      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-white/90" />
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!calendarBaseDate}
                        className="h-9 w-9 rounded-[1rem] bg-[#edf8f0] text-[#1d8d4f] shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] transition-all hover:bg-[#dff3e5] hover:text-[#166e3d]"
                        onClick={() => {
                          if (!calendarBaseDate) return;
                          setCurrentCalendarDate(subMonths(calendarBaseDate, 1));
                        }}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <div className="flex min-w-[136px] items-center justify-center rounded-[1rem] border border-[#d8eadf] bg-white px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_16px_28px_-24px_rgba(23,120,69,0.12)]">
                        <span className="text-sm font-semibold tracking-tight text-[#154c34]">
                          {calendarBaseDate ? format(calendarBaseDate, 'yyyy년 M월') : '--'}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!calendarBaseDate}
                        className="h-9 w-9 rounded-[1rem] bg-[linear-gradient(180deg,#39b86c_0%,#178244_100%)] text-white shadow-[0_16px_28px_-22px_rgba(23,130,68,0.28)] transition-all hover:brightness-[1.03]"
                        onClick={() => {
                          if (!calendarBaseDate) return;
                          setCurrentCalendarDate(addMonths(calendarBaseDate, 1));
                        }}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </section>
              ) : null}

              <Card
                className={cn(
                  'relative mx-auto w-full overflow-hidden',
                  isAppMode
                    ? 'student-utility-card rounded-[3rem] border border-[#D5E8DB] bg-[radial-gradient(circle_at_top_left,rgba(118,208,146,0.12),transparent_26%),linear-gradient(180deg,#FFFFFF_0%,#F7FCF8_100%)] ring-1 ring-white/85 shadow-[0_22px_52px_-44px_rgba(46,117,74,0.14)]'
                    : 'rounded-[2.7rem] border border-[#d8eadf] bg-[radial-gradient(circle_at_top_left,rgba(91,199,126,0.16),transparent_24%),linear-gradient(180deg,#fcfffd_0%,#ffffff_64%,#eef8f1_100%)] shadow-[0_30px_70px_-48px_rgba(23,120,69,0.14)] ring-1 ring-[#edf6ef]'
                )}
              >
                <CardContent className="relative p-0">
                  <div className={cn('border-b border-primary/10', isAppMode ? 'px-4 py-4' : isMobile ? 'px-3 py-3' : 'px-5 py-4')}>
                    {isAppMode ? (
                      <div className={cn(isMobile ? 'space-y-3' : 'flex items-end justify-between gap-6')}>
                        <div className="space-y-2">
                          <div className="inline-flex items-center gap-2 rounded-full border border-[#E5EBF5] bg-[#F7FAFF] px-3 py-1.5 text-[10px] font-black tracking-[0.18em] text-[#6D80A5]">
                            <CalendarDays className="h-3.5 w-3.5" />
                            STUDY CALENDAR
                          </div>
                          <div>
                            <h3 className={cn('font-black tracking-[-0.03em] text-[#14295F]', isMobile ? 'text-[1.3rem]' : 'text-[1.62rem]')}>학습 캘린더</h3>
                            <p className={cn('mt-1 font-semibold text-[#71819C]', isMobile ? 'text-[12px] leading-5' : 'text-sm leading-6')}>
                              공부시간 중심으로 빠르게 확인해요.
                            </p>
                          </div>
                        </div>
                        <div
                          className={cn(
                            'rounded-[1.45rem] border border-[#D8E5DE] bg-[linear-gradient(180deg,#FBFEFC_0%,#F1FAF4_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_18px_34px_-26px_rgba(46,117,74,0.1)]',
                            isMobile ? 'px-3 py-3' : 'min-w-[24rem] px-4 py-3.5'
                          )}
                        >
                          <div className={cn('grid gap-1.5', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
                            {PARENT_CALENDAR_LEGEND.map((item) => (
                              <div
                                key={item.label}
                                className={cn('inline-flex items-center justify-center gap-2 rounded-[1rem] border px-2 py-2', getParentLegendChipClass(item.level))}
                              >
                                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full ring-1', item.swatch)} />
                                <span className={cn('text-center font-black tracking-tight', isMobile ? 'text-[9px]' : 'text-[10px]')}>{item.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className={cn("flex flex-wrap items-center justify-between gap-3", isMobile ? "px-0 py-0" : "")}>
                        <span className="font-aggro-display text-[10px] uppercase tracking-[0.22em] text-[#2d6d47]">월간 흐름 요약</span>
                        <div className={cn("grid gap-1.5", isMobile ? "grid-cols-2" : "grid-cols-4")}>
                          {PARENT_CALENDAR_LEGEND.map((item) => (
                            <div
                              key={item.level}
                              className="inline-flex items-center gap-2 rounded-full border border-[#d7e7dc] bg-white/96 px-3 py-1.5 shadow-[0_14px_24px_-22px_rgba(23,120,69,0.12)]"
                            >
                              <span className={cn("h-2.5 w-2.5 rounded-full ring-1", item.swatch)} />
                              <span className="text-[10px] font-semibold tracking-[0.02em] text-[#24513c]">
                                {item.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={cn("grid grid-cols-7 border-b border-primary/10", isAppMode ? "gap-1.5 px-2 py-2" : isMobile ? "gap-1 px-1.5 py-1.5" : "gap-2 px-5 py-3.5")}>
                    {['월', '화', '수', '목', '금', '토', '일'].map((day, i) => (
                      <div
                        key={day}
                        className={cn(
                          isAppMode
                            ? 'py-1.5 text-[8px] rounded-2xl border border-white/80 bg-white/90 text-center font-black uppercase tracking-widest shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]'
                            : isMobile
                              ? "py-1.5 text-[8px]"
                              : "rounded-[1rem] border py-2.5 text-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]",
                          isAppMode
                            ? i === 5
                              ? 'text-blue-600'
                              : i === 6
                                ? 'text-rose-600'
                                : 'text-primary/60'
                            : i === 5
                              ? "text-blue-600"
                              : i === 6
                                ? "text-rose-600"
                                : "text-[#5976a7]",
                          !isAppMode && "border-[#d8e7dc] bg-[linear-gradient(180deg,#ffffff_0%,#f3faf5_100%)] text-center font-semibold uppercase tracking-[0.18em]"
                        )}
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className={cn("grid grid-cols-7", isAppMode ? "auto-rows-fr gap-2 px-3 pb-3 pt-4.5" : isMobile ? "auto-rows-fr gap-1 px-1.5 pb-1.5 pt-3" : "auto-rows-fr gap-3.5 px-5 pb-5 pt-6")}>
                    {logsLoading ? (
                      <div className="col-span-7 h-[400px] flex items-center justify-center">
                        <Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" />
                      </div>
                    ) : calendarData.map((day, idx) => {
                      const dateKey = format(day, 'yyyy-MM-dd');
                      const minutes = calendarMinutesByDateKey.get(dateKey) || 0;
                      const isCurrentMonth = calendarBaseDate ? isSameMonth(day, calendarBaseDate) : false;
                      const isTodayCalendar = today ? isSameDay(day, today) : false;
                      const isFutureCalendar = isCurrentMonth && !!todayKey && dateKey > todayKey;
                      const exactTimeLabel = isCurrentMonth
                        ? formatCalendarMinutes(minutes)
                        : '';
                      const shouldRenderTime = isCurrentMonth && !isFutureCalendar;
                      const isLongTimeLabel = exactTimeLabel.length >= (isAppMode ? 6 : 6);
                      const isVeryLongTimeLabel = exactTimeLabel.length >= (isAppMode ? 7 : 7);
                      const calendarAriaTimeLabel = isCurrentMonth
                        ? isFutureCalendar
                          ? '아직 오지 않은 날짜'
                          : exactTimeLabel
                        : '이번 달 아님';

                      if (isAppMode) {
                        const appCalendarCellClass = getParentCalendarCellClass(minutes, isCurrentMonth, true);
                        const appCalendarValueTone = getParentCalendarValueTone(minutes, isCurrentMonth, true);

                        return (
                          <button
                            key={dateKey}
                            type="button"
                            onClick={() => setSelectedCalendarDate(day)}
                            aria-label={`${format(day, 'M월 d일 (EEEE)', { locale: ko })} · ${calendarAriaTimeLabel}${isCurrentMonth ? ' 학습' : ''}`}
                            className={cn(
                              'group relative overflow-hidden rounded-[1.45rem] text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14295F]/28',
                              'aspect-square min-h-0 p-1.5',
                              appCalendarCellClass,
                              isCurrentMonth && 'hover:-translate-y-[1px] hover:shadow-[0_18px_30px_-22px_rgba(20,41,95,0.16)] active:translate-y-0',
                              isTodayCalendar && 'z-10 -translate-y-[1px] ring-2 ring-[#7FCB97]/55 shadow-[0_22px_36px_-24px_rgba(26,115,64,0.18)]'
                            )}
                          >
                            {isTodayCalendar ? <div className="pointer-events-none absolute inset-[1px] rounded-[1.35rem] border border-white/88" /> : null}
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/92" />
                            {isCurrentMonth && minutes > 0 ? (
                              <div className="pointer-events-none absolute inset-x-4 top-0 h-12 rounded-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.52),rgba(255,255,255,0)_72%)] opacity-90" />
                            ) : null}

                            <div className="relative z-10 flex h-full flex-col justify-center">
                              <div className="flex flex-1 items-center justify-center px-0.5">
                                {shouldRenderTime ? (
                                  <span
                                    className={cn(
                                      'dashboard-number block max-w-full whitespace-nowrap font-black leading-none tabular-nums text-center',
                                      isVeryLongTimeLabel
                                        ? 'text-[0.5rem] tracking-[-0.11em]'
                                        : isLongTimeLabel
                                          ? 'text-[0.56rem] tracking-[-0.1em]'
                                          : 'text-[0.66rem] tracking-[-0.08em]',
                                      appCalendarValueTone
                                    )}
                                  >
                                    {exactTimeLabel}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </button>
                        );
                      }

                      return (
                        <button
                          key={dateKey}
                          type="button"
                          onClick={() => setSelectedCalendarDate(day)}
                          aria-label={`${format(day, 'M월 d일 (EEEE)', { locale: ko })} · ${calendarAriaTimeLabel}`}
                          className={cn(
                            "group relative flex flex-col overflow-hidden rounded-[1.35rem] text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35",
                            isMobile ? "aspect-square min-h-0 p-1" : "aspect-square min-h-0 p-3.5",
                            !isCurrentMonth ? "bg-[linear-gradient(180deg,rgba(248,250,252,0.9)_0%,rgba(255,255,255,0.96)_100%)] opacity-[0.38] grayscale-[0.05] ring-1 ring-slate-200/75" : getHeatmapColor(minutes),
                            isCurrentMonth && "hover:-translate-y-[1px] hover:shadow-[0_18px_36px_-24px_rgba(15,23,42,0.32)] active:translate-y-0",
                            isTodayCalendar && "z-10 -translate-y-[1px] ring-2 ring-inset ring-[#1f9d57]/45 shadow-[0_20px_40px_-22px_rgba(34,197,94,0.24)]"
                          )}
                        >
                          {isTodayCalendar && <div className="pointer-events-none absolute -inset-0.5 rounded-[1.35rem] border border-[#9cd6b0]" />}
                          <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-white/90" />

                          {!isAppMode ? (
                            <div className={cn("relative z-10 flex items-start justify-between gap-1.5", isMobile ? "mb-auto" : "mb-3")}>
                              <span
                                className={cn(
                                  "inline-flex items-center justify-center rounded-full border font-semibold tracking-tighter tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
                                  isMobile ? "min-w-[1.45rem] px-1.5 py-0.5 text-[9px]" : "min-w-[2rem] px-2 py-1 text-xs",
                                  idx % 7 === 5 && isCurrentMonth ? "border-blue-100 bg-blue-50 text-blue-700" : idx % 7 === 6 && isCurrentMonth ? "border-rose-100 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-700",
                                  isTodayCalendar && "border-[#9cd6b0] text-[#178244]"
                                )}
                              >
                                {format(day, 'd')}
                              </span>
                              <span className={cn(isMobile ? "h-5 w-5" : "h-6 w-6")} aria-hidden="true" />
                            </div>
                          ) : null}

                          <div className={cn(
                            "flex",
                            isAppMode
                              ? "relative z-10 h-full flex-1 items-center justify-center"
                              : isMobile
                                ? "mt-auto justify-center pb-1"
                                : "mt-auto justify-center px-1 pt-4"
                          )}>
                            {shouldRenderTime ? (
                              <div
                                className={cn(
                                  "inline-flex w-full max-w-full items-center justify-center rounded-[0.95rem] border text-center shadow-[0_14px_26px_-20px_rgba(15,23,42,0.2)]",
                                  isAppMode
                                    ? "min-h-[3.2rem] px-1.5 py-2.5"
                                    : isMobile
                                      ? "min-h-[2.15rem] px-1 py-2"
                                      : "min-h-[3.25rem] px-2.5 py-3",
                                  getParentCalendarTimeCapsuleClass(minutes, isCurrentMonth)
                                )}
                              >
                                <span
                                  className={cn(
                                    "dashboard-number block whitespace-nowrap tabular-nums leading-none",
                                    isAppMode
                                      ? isVeryLongTimeLabel
                                        ? "text-[0.68rem] tracking-[-0.08em]"
                                        : isLongTimeLabel
                                          ? "text-[0.8rem] tracking-[-0.06em]"
                                          : "text-[0.92rem] tracking-[-0.05em]"
                                      : isMobile
                                      ? isVeryLongTimeLabel
                                        ? "text-[0.48rem] tracking-[-0.1em]"
                                        : isLongTimeLabel
                                          ? "text-[0.56rem] tracking-[-0.08em]"
                                          : "text-[0.64rem] tracking-[-0.05em]"
                                      : isVeryLongTimeLabel
                                        ? "text-[0.82rem] tracking-[-0.04em]"
                                        : isLongTimeLabel
                                          ? "text-[0.9rem] tracking-[-0.04em]"
                                          : "text-[0.98rem] tracking-[-0.04em]"
                                  )}
                                >
                                  {exactTimeLabel}
                                </span>
                              </div>
                            ) : (
                              <span className={cn(isMobile ? "h-[1.35rem]" : "h-[2rem]")} aria-hidden="true" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {!selectedCalendarDate && (
                <div className="mx-1 flex items-center justify-center gap-2 rounded-[1.4rem] border border-dashed border-[#dbe6fb] bg-[#f7fbff] px-4 py-2.5 shadow-[0_16px_28px_-26px_rgba(20,41,95,0.12)]">
                  <Info className="h-3.5 w-3.5 shrink-0 text-[#6d86b4]" />
                  <p className="text-center text-[11px] font-bold leading-relaxed text-[#5874a4]">날짜를 누르면 그날의 핵심 기록만 볼 수 있어요.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="data" className="parent-tab-panel mt-0 space-y-4 sm:space-y-5">
              <Card
                className={cn(
                  'relative overflow-hidden rounded-[2.3rem] border border-[#d9eadf] bg-[linear-gradient(145deg,#fbfffc_0%,#ffffff_56%,#eef8f1_100%)] p-5 shadow-[0_30px_70px_-44px_rgba(20,41,95,0.14)] sm:p-6',
                  showEntryMotion && 'parent-card-enter parent-entry-delay-2'
                )}
              >
                <div className="soft-glow absolute -right-8 top-0 h-24 w-24 rounded-full bg-[#8bd3a3]/18 blur-3xl" />
                <div className="soft-glow absolute left-0 top-1/2 h-20 w-20 -translate-y-1/2 rounded-full bg-[#c5ecd2]/22 blur-3xl" />
                <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#d5e8db] bg-white/96 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#224f3c] shadow-[0_12px_24px_-22px_rgba(20,41,95,0.12)] backdrop-blur-sm">
                      <FileText className="h-3.5 w-3.5 text-[#178244]" />
                      학습 분석 리포트
                    </div>
                    <h3 className="mt-3 break-keep text-[1.32rem] font-black tracking-tight text-[#14295F] sm:text-[1.52rem]">
                      {activeStudentLabel} 학생의 최근 학습 흐름을
                      <br className="hidden sm:block" />
                      차분하게 읽을 수 있게 정리했어요
                    </h3>
                    <p className="mt-2 max-w-2xl break-keep text-[12.5px] font-bold leading-[1.7] text-[#284768] sm:text-[13px]">
                      최근 42일 학습시간과 최근 14일 리듬 데이터를 바탕으로, 학부모님이 핵심 변화만 빠르게 파악할 수 있게 구성했습니다.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                    <div className="rounded-[1.15rem] border border-[#d8eadf] bg-white/96 px-3 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm">
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#577763]">학습시간 창</p>
                      <p className="mt-1 text-[12px] font-black text-[#14295F]">최근 6주</p>
                    </div>
                    <div className="rounded-[1.15rem] border border-[#d8eadf] bg-white/96 px-3 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm">
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#577763]">리듬 창</p>
                      <p className="mt-1 text-[12px] font-black text-[#14295F]">최근 14일</p>
                    </div>
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
              <Card className={cn('rounded-[2.4rem] border border-[#ffd9b2] bg-[linear-gradient(145deg,#fffefb_0%,#ffffff_64%,#fff3e7_100%)] p-5 shadow-[0_28px_52px_-40px_rgba(255,122,22,0.16)] sm:p-6', showEntryMotion && 'parent-card-enter parent-entry-delay-2')}>
                <ParentSectionHeader
                  icon={<Bell className="h-3.5 w-3.5" />}
                  eyebrow="Communication"
                  title="센터 공지와 알림"
                  description="센터관리자 공지사항과 자녀 관련 알림을 한곳에 정리해 두었습니다."
                  badges={
                    <>
                      {unreadRecentCount > 0 && (
                        <Badge variant="outline" className="h-6 rounded-full border-none bg-[#FF7A16]/15 px-2.5 text-[10px] font-black text-[#FF7A16]">
                          미확인 {unreadRecentCount}
                        </Badge>
                      )}
                      <Badge variant="outline" className="h-6 rounded-full border border-[#ffe0bf] bg-white px-2.5 text-[10px] font-black text-[#9b6938]">
                        {recentNotifications.length}건
                      </Badge>
                    </>
                  }
                />

                {recentAnnouncementNotifications.length === 0 && recentAlertNotifications.length === 0 ? (
                  <div className="mt-4 rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-[11px] font-bold text-slate-400">
                    확인할 공지사항이 없습니다.
                  </div>
                ) : (
                  <div className="mt-4 space-y-5">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 px-1">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#a06a37]">센터 공지사항</p>
                        <Badge variant="outline" className="h-5 rounded-full border border-[#ffe0bf] bg-white px-2 text-[10px] font-black text-[#9b6837]">
                          {recentAnnouncementNotifications.length}건
                        </Badge>
                      </div>
                      {recentAnnouncementNotifications.length === 0 ? (
                        <div className="rounded-[1.35rem] border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-center text-[11px] font-bold text-slate-400">
                          현재 전달된 센터 공지사항이 없습니다.
                        </div>
                      ) : (
                        recentAnnouncementNotifications.map((notification) => {
                          const isRead = notification.isRead || !!readMap[notification.id];

                          return (
                            <button
                              type="button"
                              key={notification.id}
                              className={cn(
                                'relative w-full overflow-hidden rounded-[1.55rem] border p-4 text-left transition-all',
                                isRead
                                  ? 'border-[#ffe2c5] bg-[linear-gradient(180deg,#ffffff_0%,#fff8f0_100%)] shadow-[0_16px_30px_-28px_rgba(255,122,22,0.12)]'
                                  : 'border-[#ffcf9f] bg-[linear-gradient(135deg,#fff8ef_0%,#fff0df_100%)] shadow-[0_18px_32px_-26px_rgba(255,122,22,0.18)] ring-1 ring-[#ffd6ab]/75 md:hover:shadow-md'
                              )}
                              onClick={() => void openNotificationDetail(notification)}
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{notification.createdAtLabel}</span>
                                <div className="flex items-center gap-2">
                                  {!isRead && <span className="h-2 w-2 rounded-full bg-[#FF7A16]" />}
                                  <Badge variant="outline" className="h-5 border-none bg-[#fff0df] px-2 text-[10px] font-black text-[#c36008]">
                                    공지
                                  </Badge>
                                </div>
                              </div>
                              <p className="text-sm font-black leading-snug tracking-tight text-[#14295F] sm:text-base">{notification.title}</p>
                              {notification.body && (
                                <p className="mt-1 line-clamp-2 text-[12px] font-bold leading-relaxed text-slate-500">
                                  {notification.body}
                                </p>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 px-1">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#a06a37]">자녀 알림</p>
                        <Badge variant="outline" className="h-5 rounded-full border border-[#ffe0bf] bg-white px-2 text-[10px] font-black text-[#9b6837]">
                          {recentAlertNotifications.length}건
                        </Badge>
                      </div>
                      {recentAlertNotifications.length === 0 ? (
                        <div className="rounded-[1.35rem] border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-center text-[11px] font-bold text-slate-400">
                          아직 확인할 자녀 알림이 없습니다.
                        </div>
                      ) : (
                        recentAlertNotifications.map((notification) => {
                          const isRead = notification.isRead || !!readMap[notification.id];

                          return (
                            <button
                              type="button"
                              key={notification.id}
                              className={cn(
                                'relative w-full overflow-hidden rounded-[1.55rem] border p-4 text-left transition-all',
                                isRead
                                  ? 'border-[#ffe2c5] bg-[linear-gradient(180deg,#ffffff_0%,#fff8f0_100%)] shadow-[0_16px_30px_-28px_rgba(255,122,22,0.12)]'
                                  : 'border-[#ffcf9e] bg-[linear-gradient(135deg,#fff8ef_0%,#fff1e1_100%)] shadow-[0_18px_32px_-26px_rgba(255,122,22,0.2)] ring-1 ring-[#ffd29f]/75 md:hover:shadow-md'
                              )}
                              onClick={() => void openNotificationDetail(notification)}
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{notification.createdAtLabel}</span>
                                <div className="flex items-center gap-2">
                                  {!isRead && <span className="h-2 w-2 rounded-full bg-[#FF7A16]" />}
                                  {notification.isImportant && (
                                    <Badge variant="outline" className="h-5 border-none bg-orange-100 px-2 text-[10px] font-black text-[#FF7A16]">
                                      중요
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm font-black leading-snug tracking-tight text-[#14295F] sm:text-base">{notification.title}</p>
                              {notification.body && (
                                <p className="mt-1 line-clamp-2 text-[12px] font-bold leading-relaxed text-slate-500">
                                  {notification.body}
                                </p>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </Card>
              <Card className={cn('rounded-[2.5rem] border border-[#ffdabc] bg-[linear-gradient(180deg,#fffefb_0%,#ffffff_66%,#fff4ea_100%)] p-5 shadow-[0_24px_46px_-38px_rgba(255,122,22,0.14)] sm:p-8', showEntryMotion && 'parent-card-enter parent-entry-delay-3')}>
                <ParentSectionHeader
                  icon={<Send className="h-3.5 w-3.5" />}
                  eyebrow="Support"
                  title="상담 및 지원 요청"
                  description="센터 방문, 전화, 온라인 상담 중 원하는 채널을 선택해 바로 요청할 수 있어요."
                />
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label className="ml-1 text-[10px] font-black uppercase text-[#9b6b3b]">상담 채널</Label>
                    <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                      <SelectTrigger className="h-12 rounded-[1.1rem] border border-[#ffe1c3] bg-[linear-gradient(180deg,#ffffff_0%,#fff9f1_100%)] font-bold text-sm shadow-[0_16px_26px_-24px_rgba(255,122,22,0.14)]"><SelectValue placeholder="상담 채널 선택" /></SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="visit" className="font-bold py-3 text-sm">🏫 센터 방문 상담</SelectItem>
                        <SelectItem value="phone" className="font-bold py-3 text-sm">📞 전화 상담</SelectItem>
                        <SelectItem value="online" className="font-bold py-3 text-sm">💻 온라인 상담</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="ml-1 text-[10px] font-black uppercase text-[#9b6b3b]">상담 내용</Label>
                    <Textarea className="min-h-[120px] rounded-[1.5rem] border border-[#ffe1c3] bg-[linear-gradient(180deg,#ffffff_0%,#fff9f2_100%)] font-bold p-4 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_28px_-28px_rgba(255,122,22,0.14)]" value={requestText} onChange={(e) => setRequestText(e.target.value)} placeholder="자녀의 학습이나 생활에 대해 궁금하신 점을 자유롭게 입력해 주세요." />
                  </div>
                  <div className="rounded-[1.35rem] border border-[#ffe0c1] bg-white/92 p-3 shadow-[0_16px_30px_-26px_rgba(255,122,22,0.14)]">
                    <Button className="h-14 w-full rounded-[1.2rem] bg-[linear-gradient(180deg,#ff973d_0%,#FF7A16_100%)] text-white font-black text-base shadow-[0_18px_32px_-24px_rgba(255,122,22,0.3)] active:scale-[0.98] transition-all hover:brightness-[1.03]" onClick={() => submit('consultation')} disabled={submitting}>요청 보내기</Button>
                    <p className="mt-2 text-center text-[11px] font-bold text-slate-500">보내신 요청은 센터에서 확인 후 안내드립니다.</p>
                  </div>
                </div>
              </Card>

              <Card className={cn('rounded-[2.5rem] border border-[#ffdabc] bg-[linear-gradient(180deg,#fffefb_0%,#ffffff_66%,#fff5ec_100%)] p-5 shadow-[0_24px_46px_-38px_rgba(255,122,22,0.14)] sm:p-8', showEntryMotion && 'parent-card-enter parent-entry-delay-4')}>
                <ParentSectionHeader
                  icon={<MessageCircle className="h-3.5 w-3.5" />}
                  eyebrow="Inquiry"
                  title="건의사항 · 질의 · 요청사항"
                  description="남겨주신 내용은 선생님 또는 센터관리자가 확인하고 답변드립니다."
                />
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                    <div className="grid gap-2">
                      <Label className="ml-1 text-[10px] font-black uppercase text-[#9b6b3b]">유형 선택</Label>
                      <Select value={parentInquiryType} onValueChange={(value: 'question' | 'request' | 'suggestion') => setParentInquiryType(value)}>
                        <SelectTrigger className="h-12 rounded-[1.1rem] border border-[#ffe1c3] bg-[linear-gradient(180deg,#ffffff_0%,#fff9f1_100%)] font-bold text-sm shadow-[0_16px_26px_-24px_rgba(255,122,22,0.14)]">
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
                      <Label className="ml-1 text-[10px] font-black uppercase text-[#9b6b3b]">제목</Label>
                      <Input
                        className="h-12 w-full rounded-[1.1rem] border border-[#ffe1c3] bg-[linear-gradient(180deg,#ffffff_0%,#fff9f1_100%)] font-bold text-sm shadow-[0_16px_26px_-24px_rgba(255,122,22,0.14)]"
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
                    <Label className="ml-1 text-[10px] font-black uppercase text-[#9b6b3b]">내용</Label>
                    <Textarea
                      className="min-h-[140px] rounded-[1.5rem] border border-[#ffe1c3] bg-[linear-gradient(180deg,#ffffff_0%,#fff9f2_100%)] font-bold p-4 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_28px_-28px_rgba(255,122,22,0.14)]"
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
                  <div className="rounded-[1.35rem] border border-[#ffe0c5] bg-white/90 p-3 shadow-[0_16px_30px_-26px_rgba(255,122,22,0.18)]">
                    <Button
                      className="h-14 w-full rounded-[1.2rem] bg-[linear-gradient(180deg,#ff8d34_0%,#FF7A16_100%)] text-white font-black text-base shadow-[0_18px_32px_-24px_rgba(255,122,22,0.28)] active:scale-[0.98] transition-all"
                      onClick={submitParentInquiry}
                      disabled={submitting || !parentInquiryBody.trim()}
                    >
                      전달하기
                    </Button>
                    <p className="mt-2 text-center text-[11px] font-bold text-slate-500">필요한 내용만 간단히 남겨주셔도 됩니다.</p>
                  </div>
                </div>
              </Card>

              <Card className={cn('rounded-[2.5rem] border border-[#ffdabc] bg-[linear-gradient(180deg,#fffefb_0%,#ffffff_66%,#fff4eb_100%)] p-5 shadow-[0_24px_46px_-38px_rgba(255,122,22,0.14)] sm:p-8', showEntryMotion && 'parent-card-enter parent-entry-delay-4')}>
                <ParentSectionHeader
                  icon={<Bell className="h-3.5 w-3.5" />}
                  eyebrow="Replies"
                  title="문의 내역과 답변"
                  description="최근 문의 내역과 선생님 또는 센터관리자의 답변을 여기서 바로 확인할 수 있어요."
                />

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
                        <div key={item.id} className="rounded-[1.75rem] border border-[#ffe3c7] bg-[linear-gradient(180deg,#ffffff_0%,#fff8f0_100%)] p-5 shadow-[0_18px_30px_-24px_rgba(255,122,22,0.12)]">
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
              <Card className={cn('overflow-hidden rounded-[2.4rem] border border-[#ffdabc] bg-[linear-gradient(180deg,#fffefb_0%,#ffffff_58%,#fff3e8_100%)] p-5 shadow-[0_30px_60px_-42px_rgba(255,122,22,0.18)] sm:p-6', showEntryMotion && 'parent-card-enter parent-entry-delay-2')}>
                <div className="space-y-5">
                  <ParentSectionHeader
                    icon={<CreditCard className="h-3.5 w-3.5" />}
                    eyebrow="Billing"
                    title="수납"
                    description="결제 현황과 대표 청구서를 한 번에 확인할 수 있도록 안심형 청구서 센터로 정리했습니다."
                    badges={
                      <>
                        <Badge variant="outline" className="h-7 rounded-full border border-[#ffe0bf] bg-white px-3 text-[10px] font-black text-[#9f6b39] shadow-sm">
                          실시간 연동
                        </Badge>
                        {mobileBillingStatusMeta && (
                          <Badge variant="outline" className={cn('h-7 rounded-full border px-3 text-[10px] font-black shadow-sm', mobileBillingStatusMeta.className)}>
                            {mobileBillingStatusMeta.label}
                          </Badge>
                        )}
                      </>
                    }
                  />

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-[1.65rem] border border-[#ffe0c1] bg-[linear-gradient(180deg,#fffefb_0%,#fff5eb_100%)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_30px_-24px_rgba(255,122,22,0.14)]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#b86a1c]">청구금액</p>
                        <div className="h-2.5 w-2.5 rounded-full bg-[#FF7A16]" />
                      </div>
                      <p className="dashboard-number mt-3 whitespace-nowrap text-[1.45rem] leading-none text-[#14295F] sm:text-[1.6rem]">
                        {formatWon(billingSummary.billed)}
                      </p>
                    </div>
                    <div className="rounded-[1.65rem] border border-emerald-200 bg-[linear-gradient(180deg,#f9fffc_0%,#ecfff6_100%)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_30px_-24px_rgba(16,185,129,0.16)]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">수납 완료</p>
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      </div>
                      <p className="dashboard-number mt-3 whitespace-nowrap text-[1.45rem] leading-none text-emerald-700 sm:text-[1.6rem]">
                        {formatWon(billingSummary.paid)}
                      </p>
                    </div>
                    <div className="rounded-[1.65rem] border border-rose-200 bg-[linear-gradient(180deg,#fffdfd_0%,#fff4f4_100%)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_30px_-24px_rgba(244,63,94,0.15)]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-rose-700">미납 금액</p>
                        <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                      </div>
                      <p className="dashboard-number mt-3 whitespace-nowrap text-[1.45rem] leading-none text-rose-700 sm:text-[1.6rem]">
                        {formatWon(billingSummary.overdue)}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {primaryInvoice ? (
                <div className="space-y-4">
                  {(() => {
                    const invoice = primaryInvoice;
                    const invoiceDueDate = toDateSafe((invoice as any).cycleEndDate);
                    const statusMeta = getInvoiceStatusMeta(invoice.status);
                    const isActionable = invoice.status === 'issued' || invoice.status === 'overdue';

                    return (
                      <Card className="overflow-hidden rounded-[2.3rem] border border-[#ffdabc] bg-[linear-gradient(135deg,#fffefb_0%,#ffffff_58%,#fff3e8_100%)] p-5 shadow-[0_30px_62px_-42px_rgba(255,122,22,0.18)] sm:p-6">
                        <div className="space-y-5">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="h-7 rounded-full border border-[#ffe0bf] bg-white px-3 text-[10px] font-black text-[#9f6b39] shadow-sm">
                                  대표 청구서
                                </Badge>
                                <Badge variant="outline" className="h-7 rounded-full border border-slate-200 bg-slate-50 px-3 text-[10px] font-black text-slate-600 shadow-sm">
                                  {getInvoiceTrackLabel(invoice.trackCategory)}
                                </Badge>
                                {statusMeta && (
                                  <Badge variant="outline" className={cn('h-7 rounded-full border px-3 text-[10px] font-black shadow-sm', statusMeta.className)}>
                                    <span className="md:hidden">{statusMeta.mobileLabel}</span>
                                    <span className="hidden md:inline">{statusMeta.label}</span>
                                  </Badge>
                                )}
                              </div>

                              <div className="space-y-2">
                                <h3 className="min-w-0 truncate text-[1.55rem] font-black leading-none tracking-tight text-[#14295F] sm:text-[1.85rem]">
                                  {invoice.studentName || student?.name || '학생'}
                                </h3>
                                <p className="text-[14px] font-bold leading-relaxed text-slate-600">
                                  {isActionable ? '가장 먼저 확인하실 청구서를 상단에 정리했습니다.' : '최근 결제 완료된 청구서를 기준으로 정리했습니다.'}
                                </p>
                              </div>
                            </div>

                            <div className="rounded-[1.7rem] border border-[#ffe0bf] bg-white/94 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_22px_34px_-26px_rgba(255,122,22,0.14)]">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#b76a1d]">결제 금액</p>
                              <p className="dashboard-number mt-2 whitespace-nowrap text-[2rem] leading-none text-[#14295F] sm:text-[2.5rem]">
                                {formatWon(Number(invoice.finalPrice || 0))}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="rounded-[1.3rem] border border-[#ffe1c3] bg-white/92 px-4 py-3 shadow-[0_14px_26px_-22px_rgba(255,122,22,0.1)]">
                              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">청구 상태</p>
                              <p className="mt-2 text-sm font-black text-[#14295F]">{statusMeta?.label || '상태 확인중'}</p>
                            </div>
                            <div className="rounded-[1.3rem] border border-[#ffe1c3] bg-white/92 px-4 py-3 shadow-[0_14px_26px_-22px_rgba(255,122,22,0.1)]">
                              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">결제 마감일</p>
                              <p className="mt-2 text-sm font-black text-[#14295F]">
                                {invoiceDueDate ? format(invoiceDueDate, 'yyyy.MM.dd', { locale: ko }) : '미정'}
                              </p>
                            </div>
                            <div className="rounded-[1.3rem] border border-[#ffe1c3] bg-white/92 px-4 py-3 shadow-[0_14px_26px_-22px_rgba(255,122,22,0.1)]">
                              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">결제 방식</p>
                              <p className="mt-2 text-sm font-black text-[#14295F]">앱 내 결제 추후 오픈</p>
                            </div>
                          </div>

                          {isActionable ? (
                            <div className="space-y-2">
                              <div className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[1.25rem] border border-[#ffd4ad] bg-[linear-gradient(180deg,#fff4e7_0%,#ffe7ce_100%)] text-[15px] font-black text-[#b86a1c] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_18px_30px_-22px_rgba(255,122,22,0.16)]">
                                <CreditCard className="h-4 w-4" />
                                추후 오픈
                              </div>
                              <p className="text-center text-[11px] font-bold text-slate-500">
                                앱 내 결제 기능은 추후 오픈 예정입니다. 현재는 청구 내용만 먼저 확인할 수 있어요.
                              </p>
                            </div>
                          ) : (
                            <div className="rounded-[1.4rem] border border-emerald-200 bg-[linear-gradient(180deg,#f8fffb_0%,#effcf5_100%)] px-4 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">결제 완료</p>
                              <p className="mt-2 text-sm font-bold leading-relaxed text-emerald-900">
                                현재 대표 청구서는 수납이 완료되었습니다. 필요 시 아래 이력에서 이전 청구서를 확인할 수 있어요.
                              </p>
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })()}

                  {secondaryInvoices.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 px-1">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#a06b38]">청구 이력</p>
                          <p className="mt-1 text-sm font-bold text-slate-500">이전 또는 추가 청구서를 함께 확인할 수 있어요.</p>
                        </div>
                        <Badge variant="outline" className="h-7 rounded-full border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-500">
                          {secondaryInvoices.length}건
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {secondaryInvoices.map((invoice) => {
                          const invoiceDueDate = toDateSafe((invoice as any).cycleEndDate);
                          const statusMeta = getInvoiceStatusMeta(invoice.status);
                          const isActionable = invoice.status === 'issued' || invoice.status === 'overdue';

                          return (
                            <Card key={invoice.id} className="rounded-[1.75rem] border border-[#ffe2c5] bg-[linear-gradient(180deg,#ffffff_0%,#fff8f1_100%)] p-5 shadow-[0_20px_38px_-30px_rgba(255,122,22,0.12)]">
                              <div className="space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge variant="outline" className="h-6 border border-slate-200 bg-slate-50 px-2 text-[10px] font-black text-slate-600">
                                        {getInvoiceTrackLabel(invoice.trackCategory)}
                                      </Badge>
                                      {statusMeta && (
                                        <Badge variant="outline" className={cn('h-6 border px-2 text-[10px] font-black', statusMeta.className)}>
                                          {statusMeta.mobileLabel}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="min-w-0 truncate text-[1.1rem] font-black leading-none tracking-tight text-[#14295F]">
                                      {invoice.studentName || student?.name || '학생'}
                                    </p>
                                    <p className="text-[13px] font-bold text-slate-500">
                                      마감일 {invoiceDueDate ? format(invoiceDueDate, 'yyyy.MM.dd', { locale: ko }) : '미정'}
                                    </p>
                                  </div>
                                  <p className="dashboard-number shrink-0 whitespace-nowrap text-[1.6rem] leading-none text-[#14295F]">
                                    {formatWon(Number(invoice.finalPrice || 0))}
                                  </p>
                                </div>

                                {isActionable ? (
                                  <div className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[1rem] border border-[#ffd8b3] bg-[linear-gradient(180deg,#fff5ea_0%,#ffe9d4_100%)] text-[14px] font-black text-[#b86a1c] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_16px_26px_-22px_rgba(255,122,22,0.14)]">
                                    <CreditCard className="h-4 w-4" />
                                    추후 오픈
                                  </div>
                                ) : (
                                  <div className="rounded-[1rem] border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-center text-[12px] font-black text-emerald-700">
                                    결제 완료
                                  </div>
                                )}
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Card className="rounded-[2rem] border border-[#ffe2c5] bg-[linear-gradient(180deg,#ffffff_0%,#fff8f1_100%)] p-6 text-center shadow-[0_20px_40px_-32px_rgba(255,122,22,0.12)]">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.2rem] border border-[#ffd8ae] bg-[linear-gradient(135deg,#fff4e6_0%,#ffd8af_100%)] shadow-sm">
                    <CreditCard className="h-6 w-6 text-[#FF7A16]" />
                  </div>
                  <p className="mt-4 text-base font-black text-[#14295F]">현재 발행된 청구서가 없습니다.</p>
                  <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">
                    새 청구서가 발행되면 이 화면에서 바로 확인할 수 있어요. 결제 기능은 추후 오픈 예정입니다.
                  </p>
                </Card>
              )}

              <div className="rounded-[1.7rem] border border-emerald-200 bg-[linear-gradient(180deg,#fbfffd_0%,#f0fcf5_100%)] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_28px_-24px_rgba(16,185,129,0.14)]">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">안심 안내</p>
                <p className="mt-2 text-[14px] font-bold leading-relaxed text-emerald-900">
                  감사합니다. 결제와 수납 현황은 실시간으로 반영되며, 필요한 경우 센터에서 추가 안내를 드립니다.
                </p>
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
        <DialogContent className="parent-font-dialog w-[95vw] max-w-[95vw] max-h-[82dvh] overflow-x-hidden overflow-y-auto rounded-[2rem] border-none p-0 shadow-2xl sm:max-h-[calc(100dvh-1rem)] md:max-w-4xl">
          <div className="bg-[#14295F] p-6 text-white">
            <DialogTitle className="text-xl font-black tracking-tight">우리 아이 학습 리포트</DialogTitle>
            <DialogDescription className="mt-1 text-xs font-bold text-white/70">받은 리포트를 날짜별로 확인할 수 있어요.</DialogDescription>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white p-4 md:grid md:max-h-[70vh] md:grid-cols-[260px_minmax(0,1fr)] md:gap-4 md:p-6">
            <div className="max-h-[22vh] shrink-0 space-y-2 overflow-y-auto pb-2 md:max-h-[62vh] md:pr-1">
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
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 md:mt-0 md:max-h-[62vh] md:p-5">
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
                      displayHeadingsOnly
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
        <DialogContent className="parent-font-dialog overflow-x-hidden overflow-y-auto rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-lg">
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
        <DialogContent className="parent-font-dialog overflow-x-hidden overflow-y-auto rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-md">
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
        <DialogContent className="parent-font-dialog overflow-x-hidden overflow-y-auto rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-lg">
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,#14295F_0%,#1f3e87_55%,#2d5db0_100%)] p-6 text-white">
            <div className="absolute inset-x-0 top-0 h-px bg-white/70" />
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/12 blur-2xl" />
            <div className="relative z-10 space-y-3">
              <Badge className="w-fit border border-white/18 bg-white/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white">핵심 기록</Badge>
              <div>
                <DialogTitle className="text-xl font-black tracking-tight">
                  {selectedCalendarDate ? format(selectedCalendarDate, 'yyyy.MM.dd (EEE)', { locale: ko }) : '날짜 상세'}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs font-bold text-white/72">해당 날짜의 핵심 기록만 간단히 확인할 수 있어요.</DialogDescription>
              </div>
            </div>
          </div>
          <div className="space-y-4 bg-white p-6">
            <div className="grid grid-cols-2 gap-2">
              <Card className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">공부 시간</p>
                <p className="dashboard-number mt-1 text-xl text-[#14295F]">{toHm(selectedDateTotalMinutes)}</p>
              </Card>
              <Card className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">계획 달성</p>
                <p className="dashboard-number mt-1 text-xl text-[#FF7A16]">{isSelectedDatePlansLoading ? '...' : `${selectedDatePlanRate}%`}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">
                  {isSelectedDatePlansLoading ? '계획 확인 중' : selectedDatePlanTotal > 0 ? `${selectedDatePlanDone}/${selectedDatePlanTotal} 완료` : '등록된 계획 없음'}
                </p>
              </Card>
              <Card className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">등원 시간</p>
                <p className="dashboard-number mt-1 text-xl text-emerald-600">{selectedDateAttendanceSummary.checkInLabel}</p>
              </Card>
              <Card className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">하원 시간</p>
                <p className="dashboard-number mt-1 text-xl text-[#14295F]">{selectedDateAttendanceSummary.checkOutLabel}</p>
              </Card>
            </div>
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
