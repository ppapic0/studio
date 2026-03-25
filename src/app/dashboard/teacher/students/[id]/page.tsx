'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useCollection, useDoc, useFirestore, useFunctions, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { addDays, format, isBefore, startOfDay, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, Timestamp, where, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, BarChart, Bar, ComposedChart, Line, LineChart as RechartsLineChart } from 'recharts';
import { Loader2, ArrowLeft, Building2, Zap, Settings2, Activity, Target, RefreshCw, CheckCircle2, ShieldCheck, LayoutGrid, Save, Trash2, CalendarDays, BarChart3, MessageSquare, Clock3, PlusCircle, UserRound, AlertTriangle, Sparkles, ClipboardList, Timer, CalendarCheck2, TrendingUp, BookOpen, MessageSquareMore } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StudentProfile, StudyLogDay, GrowthProgress, CenterMembership, CounselingLog, CounselingReservation, StudyPlanItem, WithId, AttendanceCurrent, StudentNotification } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatSeatLabel } from '@/lib/seat-layout';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  buildAwayTimeInsight,
  buildDailyStudyInsight,
  buildRhythmInsight,
  buildStartEndInsight,
  buildWeeklyStudyInsight,
} from '@/lib/learning-insights';

const STAT_CONFIG = {
  focus: { label: '집중력', sub: '집중', icon: Target, color: 'text-blue-500', accent: 'bg-blue-50', guide: '몰입 시간을 안정적으로 확보하면 상승합니다.' },
  consistency: { label: '꾸준함', sub: '꾸준', icon: RefreshCw, color: 'text-emerald-500', accent: 'bg-emerald-50', guide: '매일 비슷한 시간대 루틴이 핵심입니다.' },
  achievement: { label: '목표달성', sub: '달성', icon: CheckCircle2, color: 'text-amber-500', accent: 'bg-amber-50', guide: '계획 완료율이 높을수록 빠르게 성장합니다.' },
  resilience: { label: '회복력', sub: '회복', icon: ShieldCheck, color: 'text-rose-500', accent: 'bg-rose-50', guide: '흔들린 날 이후 빠른 회복 능력입니다.' },
} as const;

const RANGE_MAP = { today: 7, weekly: 14, monthly: 28 } as const;
type ChartRangeKey = keyof typeof RANGE_MAP;
type DailyStatSnapshot = {
  totalStudyMinutes: number;
  todayPlanCompletionRate?: number;
  studyTimeGrowthRate?: number;
  startHour?: number;
  endHour?: number;
  awayMinutes?: number;
};
type PlanBucket = { studyTotal: number; studyDone: number; routineCount: number; personalCount: number };
type MobileInsightView = 'studyTrend' | 'completion' | 'rhythm' | 'coaching' | 'risk';
type DetailPresentationMode = 'default' | 'student-analysis';

const STATUS_LABEL: Record<CounselingReservation['status'], string> = {
  requested: '요청',
  confirmed: '확정',
  done: '완료',
  canceled: '취소',
};

function minutesToLabel(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

function calculateRhythmScore(minutes: number[]): number {
  if (!minutes.length) return 0;
  const avg = minutes.reduce((a, b) => a + b, 0) / minutes.length;
  if (avg <= 0) return 0;
  const variance = minutes.reduce((a, b) => a + (b - avg) ** 2, 0) / minutes.length;
  const std = Math.sqrt(variance);
  return Math.max(0, Math.min(100, Math.round(100 - (std / avg) * 100)));
}

function calculateDayCompareScore(minutes: number[]): { score: number; dayDiffPercent: number } {
  if (minutes.length <= 1) return { score: minutes.length ? 100 : 0, dayDiffPercent: 0 };

  const dailyChangeRates: number[] = [];
  for (let idx = 1; idx < minutes.length; idx += 1) {
    const prev = Math.max(0, minutes[idx - 1] || 0);
    const curr = Math.max(0, minutes[idx] || 0);
    if (prev === 0 && curr === 0) continue;
    const base = Math.max(prev, 60);
    dailyChangeRates.push(Math.abs(curr - prev) / base);
  }

  if (!dailyChangeRates.length) return { score: 0, dayDiffPercent: 0 };

  const averageRate = dailyChangeRates.reduce((acc, value) => acc + value, 0) / dailyChangeRates.length;
  const dayDiffPercent = averageRate * 100;
  return {
    score: Math.max(0, Math.min(100, Math.round(100 - dayDiffPercent))),
    dayDiffPercent: Math.round(dayDiffPercent),
  };
}

function normalizeRhythmMinutes(series: Array<{ studyMinutes: number; hasActualStudyLog: boolean }>): number[] {
  let previousKnownMinutes = 0;
  return series.map((item, index) => {
    const roundedMinutes = Math.max(0, Math.round(item.studyMinutes || 0));
    if (item.hasActualStudyLog || roundedMinutes > 0) {
      previousKnownMinutes = roundedMinutes;
      return roundedMinutes;
    }
    if (index === 0) return roundedMinutes;
    return previousKnownMinutes;
  });
}

function hourTickFormatter(value: number): string {
  if (!Number.isFinite(value)) return '0h';
  return `${Math.max(0, Math.round(value))}h`;
}

function hourToClockLabel(value: number): string {
  if (!Number.isFinite(value)) return '-';
  const normalized = Math.max(0, Math.min(24, value));
  const totalMinutes = Math.round(normalized * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function hourNumberToDate(dateKey: string, hourValue: number | null): Date | null {
  if (typeof hourValue !== 'number' || !Number.isFinite(hourValue)) return null;
  const hours = Math.floor(hourValue);
  const minutes = Math.round((hourValue - hours) * 60);
  const target = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  target.setHours(hours, minutes, 0, 0);
  return target;
}

function dateToHourNumber(date: Date | null): number {
  if (!date) return 0;
  return Number((date.getHours() + date.getMinutes() / 60).toFixed(2));
}

function toTime(value?: Timestamp): number {
  if (!value) return 0;
  try {
    return value.toDate().getTime();
  } catch {
    return 0;
  }
}
function normalizeParentLinkCode(value: unknown): string {
  if (typeof value === 'string') {
    return value.replace(/\D/g, '').slice(0, 6);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value)).replace(/\D/g, '').slice(0, 6);
  }
  return '';
}

function resolveCallableErrorMessage(error: any, fallback: string): string {
  const detailMessage =
    typeof error?.details === 'string'
      ? error.details
      : typeof error?.details?.userMessage === 'string'
        ? error.details.userMessage
        : typeof error?.details?.message === 'string'
          ? error.details.message
          : '';

  const rawMessage = String(error?.message || '').replace(/^FirebaseError:\s*/i, '').trim();
  const cleanedRaw = rawMessage
    .replace(/^\d+\s+FAILED_PRECONDITION:\s*/i, '')
    .replace(/^\d+\s+INVALID_ARGUMENT:\s*/i, '')
    .replace(/^\d+\s+ALREADY_EXISTS:\s*/i, '')
    .replace(/^\d+\s+PERMISSION_DENIED:\s*/i, '')
    .replace(/^\d+\s+INTERNAL:\s*/i, '')
    .trim();

  const code = String(error?.code || '').toLowerCase();
  const isInternal = code.includes('internal') || /\b(functions\/internal|internal)\b/i.test(cleanedRaw);

  if (detailMessage) return detailMessage;
  if (!isInternal && cleanedRaw) return cleanedRaw;

  if (code.includes('failed-precondition')) {
    return '사전 조건이 맞지 않습니다. 학생 코드 또는 연동 상태를 확인해 주세요.';
  }
  if (code.includes('invalid-argument')) {
    return '입력값이 올바르지 않습니다. 필수 항목을 확인해 주세요.';
  }
  if (code.includes('permission-denied')) {
    return '수정 권한이 없습니다. 관리자 권한을 확인해 주세요.';
  }
  if (code.includes('already-exists')) {
    return '이미 존재하는 데이터입니다. 값을 확인해 주세요.';
  }

  return fallback;
}

function getPresentationTone(colorClass: string) {
  if (colorClass.includes('emerald')) {
    return {
      chip: 'border-[#d5f2e7] bg-[#effcf6] text-[#0f8f65]',
      text: 'text-[#0f8f65]',
      bar: 'from-[#0f8f65] via-[#1cb980] to-[#6ce0b0]',
    };
  }
  if (colorClass.includes('amber')) {
    return {
      chip: 'border-[#ffe1c5] bg-[#fff3e8] text-[#d86a11]',
      text: 'text-[#d86a11]',
      bar: 'from-[#ff7a16] via-[#ff9438] to-[#ffc58b]',
    };
  }
  if (colorClass.includes('violet')) {
    return {
      chip: 'border-[#eadfff] bg-[#f6f0ff] text-[#7d4ed8]',
      text: 'text-[#7d4ed8]',
      bar: 'from-[#7d4ed8] via-[#9d6bff] to-[#c6abff]',
    };
  }
  if (colorClass.includes('rose')) {
    return {
      chip: 'border-[#ffdbe2] bg-[#fff2f5] text-[#dc4b74]',
      text: 'text-[#dc4b74]',
      bar: 'from-[#dc4b74] via-[#f1668f] to-[#f8a3b8]',
    };
  }
  return {
    chip: 'border-[#d9e6ff] bg-[#eef4ff] text-[#2554d4]',
    text: 'text-[#2554d4]',
    bar: 'from-[#2554d4] via-[#4f7cff] to-[#87aaff]',
  };
}

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}%`;
}

const CustomTooltip = ({ active, payload, label, unit = '분', presentationMode = 'default' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={cn(
        presentationMode === 'student-analysis'
          ? 'analysis-card rounded-[1.15rem] border-none px-4 py-3 shadow-[0_22px_36px_-28px_rgba(20,41,95,0.46)]'
          : 'bg-white/95 backdrop-blur-xl border-2 border-primary/10 p-4 rounded-2xl shadow-xl ring-1 ring-black/5'
      )}>
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">{label}</p>
        <div className="flex items-baseline gap-1.5"><span className="text-2xl font-black text-primary">{payload[0].value}</span><span className="text-xs font-black text-primary/60">{unit}</span></div>
      </div>
    );
  }
  return null;
};

const AnalysisTrendTooltip = ({
  active,
  payload,
  label,
  presentationMode = 'default',
  series,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; name?: string; value?: number }>;
  label?: string;
  presentationMode?: DetailPresentationMode;
  series: Array<{
    dataKey: string;
    label: string;
    color: string;
    formatter: (value: number) => string;
  }>;
}) => {
  if (!active || !payload?.length) return null;

  const items = series
    .map((item) => {
      const target = payload.find((payloadItem) => payloadItem?.dataKey === item.dataKey || payloadItem?.name === item.dataKey);
      if (!target || typeof target.value !== 'number') return null;
      return {
        ...item,
        value: target.value,
      };
    })
    .filter((item): item is { dataKey: string; label: string; color: string; formatter: (value: number) => string; value: number } => Boolean(item));

  if (!items.length) return null;

  return (
    <div
      className={cn(
        presentationMode === 'student-analysis'
          ? 'analysis-card rounded-[1.15rem] border-none px-3.5 py-3 shadow-[0_22px_36px_-28px_rgba(20,41,95,0.46)]'
          : 'bg-white/95 backdrop-blur-xl border border-primary/10 px-4 py-3 rounded-2xl shadow-xl ring-1 ring-black/5'
      )}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5c6e97]">{label}</p>
      <div className="mt-2 space-y-1.5">
        {items.map((item) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_3px_rgba(255,255,255,0.82)]" style={{ backgroundColor: item.color }} />
              <span className="truncate text-[11px] font-black tracking-[0.12em] text-[#6a7da6]">{item.label}</span>
            </div>
            <span className="shrink-0 text-sm font-black text-[#14295F]">{item.formatter(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

function StatAnalysisCard({
  title,
  value,
  subValue,
  icon: Icon,
  colorClass,
  isMobile,
  onClick,
  presentationMode = 'default',
  progress = 0,
}: {
  title: string;
  value: string;
  subValue: string;
  icon: any;
  colorClass: string;
  isMobile: boolean;
  onClick?: () => void;
  presentationMode?: DetailPresentationMode;
  progress?: number;
}) {
  const tone = getPresentationTone(colorClass);

  if (presentationMode === 'student-analysis') {
    return (
      <Card
        className={cn(
          'analysis-kpi-card min-w-0 overflow-hidden rounded-[1.5rem] border-none bg-white transition-all',
          onClick && 'cursor-pointer active:scale-[0.985]'
        )}
        onClick={onClick}
      >
        <CardHeader className={cn('pb-2 flex flex-row items-start justify-between', isMobile ? 'px-4 pt-4' : 'px-5 pt-5')}>
          <div className="min-w-0">
            <CardTitle className={cn('min-w-0 font-black uppercase break-keep text-[#64789f]', isMobile ? 'text-[9px] leading-tight tracking-[0.2em]' : 'text-[10px] tracking-[0.22em]')}>
              {title}
            </CardTitle>
            <div className={cn('mt-3 font-black tracking-tight break-keep text-[#14295F]', isMobile ? 'text-[1.3rem] leading-tight' : 'text-[1.7rem]')}>
              {value}
            </div>
            <p className={cn('font-semibold mt-1 break-keep text-[#5c6f96]', isMobile ? 'text-[10px] leading-5' : 'text-[11px] leading-5')}>
              {subValue}
            </p>
          </div>
          <div className={cn('rounded-[1rem] border px-3 py-2 shadow-[0_16px_26px_-22px_rgba(20,41,95,0.32)]', tone.chip)}>
            <Icon className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', tone.text)} />
          </div>
        </CardHeader>
        <CardContent className={cn(isMobile ? 'px-4 pb-4' : 'px-5 pb-5')}>
          <div className="analysis-kpi-track">
            <span className={cn('bg-gradient-to-r', tone.bar)} style={{ width: `${Math.max(0, Math.min(100, Math.round(progress)))}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8290b0]">Insight Rail</span>
            <span className={cn('text-[10px] font-black', tone.text)}>{Math.max(0, Math.min(100, Math.round(progress)))}%</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('min-w-0 border-none shadow-md overflow-hidden relative bg-white rounded-[1.5rem] sm:rounded-[2rem] transition-all', onClick && 'hover:shadow-xl active:scale-[0.98] cursor-pointer')} onClick={onClick}>
      <div className={cn('absolute top-0 left-0 w-1 h-full', colorClass.replace('text-', 'bg-'))} />
      <CardHeader className={cn('pb-1 flex flex-row items-center justify-between', isMobile ? 'px-3 pt-3' : 'px-6 pt-6')}>
        <CardTitle className={cn('min-w-0 font-black text-muted-foreground uppercase break-keep', isMobile ? 'text-[8px] leading-tight' : 'text-[10px]')}>{title}</CardTitle>
        <div className={cn('rounded-lg bg-opacity-10', isMobile ? 'p-1.5' : 'p-2', colorClass.replace('text-', 'bg-'))}><Icon className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', colorClass)} /></div>
      </CardHeader>
      <CardContent className={cn(isMobile ? 'px-3 pb-3' : 'px-6 pb-6')}><div className={cn('font-black tracking-tighter break-keep', isMobile ? 'text-lg leading-tight' : 'text-2xl')}>{value}</div><p className={cn('font-bold text-muted-foreground mt-0.5 break-keep', isMobile ? 'text-[8px] leading-tight' : 'text-[9px]')}>{subValue}</p></CardContent>
    </Card>
  );
}

export default function StudentDetailPage({
  params,
  presentationMode = 'default',
}: {
  params: Promise<{ id: string }>;
  presentationMode?: DetailPresentationMode;
}) {
  const { id: studentId } = use(params);
  const { user: currentUser } = useUser();
  const { activeMembership, viewMode } = useAppContext();
  const firestore = useFirestore();
  const functions = useFunctions();
  const { toast } = useToast();
  const router = useRouter();

  const isMobile = viewMode === 'mobile';
  const isAnalysisPresentation = presentationMode === 'student-analysis';
  const centerId = activeMembership?.id;
  const today = new Date();
  const todayKey = format(today, 'yyyy-MM-dd');
  const periodKey = format(today, 'yyyy-MM');

  const isAdmin = activeMembership?.role === 'centerAdmin' || activeMembership?.role === 'owner';
  const isStudentSelfView = activeMembership?.role === 'student';
  const canEditStudentInfo = !isStudentSelfView && (isAdmin || activeMembership?.role === 'teacher');
  const canEditGrowthData = !isStudentSelfView && isAdmin;
  const canWriteCounseling = !isStudentSelfView && canEditStudentInfo;
  const backHref = isStudentSelfView ? '/dashboard/analysis' : '/dashboard/teacher/students';

  const [activeTab, setActiveTab] = useState<'overview' | 'counseling' | 'plans'>('overview');
  const [focusedChartView, setFocusedChartView] = useState<ChartRangeKey>('weekly');

  const [isMasteryModalOpen, setIsMasteryModalOpen] = useState(false);
  const [isRhythmGuideModalOpen, setIsRhythmGuideModalOpen] = useState(false);
  const [isAvgStudyModalOpen, setIsAvgStudyModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isQuickFeedbackModalOpen, setIsQuickFeedbackModalOpen] = useState(false);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [mobileInsightDialog, setMobileInsightDialog] = useState<MobileInsightView | null>(null);

  const [logType, setLogType] = useState<'academic' | 'life' | 'career'>('academic');
  const [logContent, setLogContent] = useState('');
  const [logImprovement, setLogImprovement] = useState('');
  const [quickFeedbackMessage, setQuickFeedbackMessage] = useState('');

  const [aptDate, setAptDate] = useState(format(today, 'yyyy-MM-dd'));
  const [aptTime, setAptTime] = useState('14:00');
  const [aptNote, setAptNote] = useState('');

  const [isUpdating, setIsUpdating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuickFeedbackSubmitting, setIsQuickFeedbackSubmitting] = useState(false);

  const [isEditStats, setIsEditStats] = useState(false);
  const [editLp, setEditLp] = useState(0);
  const [editPenaltyPoints, setEditPenaltyPoints] = useState(0);
  const [editStats, setEditStats] = useState({ focus: 0, consistency: 0, achievement: 0, resilience: 0 });
  const [editTodayMinutes, setEditTodayMinutes] = useState(0);
  const [sessionAdjustments, setSessionAdjustments] = useState<Record<string, number>>({});
  const [isSessionSaving, setIsSessionSaving] = useState(false);
  const [dailyGrowthWindowIndex, setDailyGrowthWindowIndex] = useState(0);

  const hasInitializedForm = useRef(false);
  const [editForm, setEditForm] = useState({
    name: '',
    schoolName: '',
    grade: '',
    password: '',
    parentLinkCode: '',
    className: '',
    memberStatus: 'active' as 'active' | 'onHold' | 'withdrawn',
  });

  const [dailyStatsMap, setDailyStatsMap] = useState<Record<string, DailyStatSnapshot>>({});
  const [statsLoading, setStatsLoading] = useState(false);
  const [planItems, setPlanItems] = useState<WithId<StudyPlanItem>[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);

  const studentRef = useMemoFirebase(() => (!firestore || !centerId ? null : doc(firestore, 'centers', centerId, 'students', studentId)), [firestore, centerId, studentId]);
  const { data: student, isLoading: studentLoading } = useDoc<StudentProfile>(studentRef);

  const progressRef = useMemoFirebase(() => (!firestore || !centerId ? null : doc(firestore, 'centers', centerId, 'growthProgress', studentId)), [firestore, centerId, studentId]);
  const { data: progress } = useDoc<GrowthProgress>(progressRef);

  const centerMembersQuery = useMemoFirebase(() => (!firestore || !centerId ? null : query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'student'))), [firestore, centerId]);
  const { data: centerStudents } = useCollection<CenterMembership>(centerMembersQuery, { enabled: !!centerId });

  const studyLogsQuery = useMemoFirebase(() => (!firestore || !centerId ? null : query(collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days'), orderBy('dateKey', 'desc'), limit(45))), [firestore, centerId, studentId]);
  const { data: studyLogs, isLoading: studyLogLoading } = useCollection<StudyLogDay>(studyLogsQuery, { enabled: !!centerId });

  const attendanceCurrentQuery = useMemoFirebase(
    () =>
      !firestore || !centerId
        ? null
        : query(
            collection(firestore, 'centers', centerId, 'attendanceCurrent'),
            where('studentId', '==', studentId),
            limit(1)
          ),
    [firestore, centerId, studentId]
  );
  const { data: attendanceCurrentRows } = useCollection<AttendanceCurrent>(attendanceCurrentQuery, { enabled: !!centerId });

  const counselingLogsQuery = useMemoFirebase(() => (!firestore || !centerId ? null : query(collection(firestore, 'centers', centerId, 'counselingLogs'), orderBy('createdAt', 'desc'), limit(200))), [firestore, centerId]);
  const { data: counselingLogsRaw, isLoading: counselingLoading } = useCollection<CounselingLog>(counselingLogsQuery, { enabled: !!centerId });

  const studentNotificationsQuery = useMemoFirebase(() => (!firestore || !centerId ? null : query(collection(firestore, 'centers', centerId, 'studentNotifications'), where('studentId', '==', studentId))), [firestore, centerId, studentId]);
  const { data: studentNotificationsRaw } = useCollection<StudentNotification>(studentNotificationsQuery, { enabled: !!centerId });

  const reservationsQuery = useMemoFirebase(() => (!firestore || !centerId ? null : query(collection(firestore, 'centers', centerId, 'counselingReservations'), orderBy('scheduledAt', 'desc'), limit(200))), [firestore, centerId]);
  const { data: reservationsRaw, isLoading: reservationLoading } = useCollection<CounselingReservation>(reservationsQuery, { enabled: !!centerId });

  const availableClasses = useMemo(() => {
    const classes = new Set<string>();
    centerStudents?.forEach((member) => {
      if (member.className) classes.add(member.className);
    });
    if (student?.className) classes.add(student.className);
    return Array.from(classes).sort();
  }, [centerStudents, student?.className]);

  const currentStudentMemberStatus = useMemo<'active' | 'onHold' | 'withdrawn'>(() => {
    const raw = centerStudents?.find((member) => member.id === studentId)?.status;
    if (raw === 'onHold') return 'onHold';
    if (raw === 'withdrawn') return 'withdrawn';
    return 'active';
  }, [centerStudents, studentId]);

  useEffect(() => {
    if (progress) {
      setEditLp(progress.seasonLp || 0);
      setEditPenaltyPoints(progress.penaltyPoints || 0);
      setEditStats({ focus: progress.stats?.focus || 0, consistency: progress.stats?.consistency || 0, achievement: progress.stats?.achievement || 0, resilience: progress.stats?.resilience || 0 });
    }
  }, [progress]);

  useEffect(() => {
    if (student && !hasInitializedForm.current) {
      setEditForm({
        name: student.name,
        schoolName: student.schoolName,
        grade: student.grade,
        password: '',
        parentLinkCode: normalizeParentLinkCode(student.parentLinkCode),
        className: student.className || '',
        memberStatus: currentStudentMemberStatus,
      });
      hasInitializedForm.current = true;
    }
  }, [student, currentStudentMemberStatus]);

  useEffect(() => {
    if (isEditStats) return;
    setEditTodayMinutes(dailyStatsMap[todayKey]?.totalStudyMinutes || 0);
  }, [dailyStatsMap, todayKey, isEditStats]);

  useEffect(() => {
    let cancelled = false;
    const fetchDailyStats = async () => {
      if (!firestore || !centerId || !studentId) {
        setDailyStatsMap({});
        setStatsLoading(false);
        return;
      }
      setStatsLoading(true);
      try {
        const keys = Array.from({ length: 42 }, (_, idx) => format(subDays(today, idx), 'yyyy-MM-dd'));
        const snapshots = await Promise.all(keys.map((dateKey) => getDoc(doc(firestore, 'centers', centerId, 'dailyStudentStats', dateKey, 'students', studentId))));
        if (cancelled) return;
        const next: Record<string, DailyStatSnapshot> = {};
        snapshots.forEach((snap, index) => {
          if (!snap.exists()) return;
          const data = snap.data() as Record<string, unknown>;
          const startHourRaw = data.startHour ?? data.firstStudyHour;
          const endHourRaw = data.endHour ?? data.lastStudyHour;
          const awayMinutesRaw = data.awayMinutes ?? data.breakMinutes;
          next[keys[index]] = {
            totalStudyMinutes: Number(data.totalStudyMinutes || 0),
            todayPlanCompletionRate: typeof data.todayPlanCompletionRate === 'number' ? data.todayPlanCompletionRate : undefined,
            studyTimeGrowthRate: typeof data.studyTimeGrowthRate === 'number' ? data.studyTimeGrowthRate : undefined,
            startHour: typeof startHourRaw === 'number' ? startHourRaw : undefined,
            endHour: typeof endHourRaw === 'number' ? endHourRaw : undefined,
            awayMinutes: typeof awayMinutesRaw === 'number' ? awayMinutesRaw : undefined,
          };
        });

        const recentKeys = keys.slice(0, 14);
        setDailyStatsMap(next);
        setStatsLoading(false);

        const missingRecentKeys = recentKeys.filter((dateKey) => {
          const stat = next[dateKey];
          return !stat || stat.startHour === undefined || stat.endHour === undefined || stat.awayMinutes === undefined;
        });

        if (missingRecentKeys.length === 0) return;

        const sessionResults = await Promise.all(
          missingRecentKeys.map(async (dateKey) => {
            try {
              const sessionsRef = collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', dateKey, 'sessions');
              const sessionsSnap = await getDocs(query(sessionsRef, orderBy('startTime', 'asc')));
              const sessions = sessionsSnap.docs
                .map((d) => d.data())
                .filter((s) => !!s.startTime)
                .map((s) => ({
                  startTime: s.startTime?.toDate?.() as Date | undefined,
                  endTime: s.endTime?.toDate?.() as Date | undefined,
                }))
                .filter((s): s is { startTime: Date; endTime: Date | undefined } => !!s.startTime);

              if (!sessions.length) return { dateKey, startHour: undefined, endHour: undefined, awayMinutes: undefined };

              const first = sessions[0].startTime;
              const last = sessions[sessions.length - 1];
              const startH = first.getHours() + first.getMinutes() / 60;
              const endDate = last.endTime || last.startTime;
              const endH = endDate.getHours() + endDate.getMinutes() / 60;

              let awayMin = 0;
              for (let i = 1; i < sessions.length; i++) {
                const prevEnd = sessions[i - 1].endTime;
                const currStart = sessions[i].startTime;
                if (!prevEnd || !currStart) continue;
                const gap = Math.round((currStart.getTime() - prevEnd.getTime()) / 60000);
                if (gap > 0 && gap < 180) awayMin += gap;
              }

              return {
                dateKey,
                startHour: Number(startH.toFixed(2)),
                endHour: Number(endH.toFixed(2)),
                awayMinutes: awayMin,
              };
            } catch {
              return { dateKey, startHour: undefined, endHour: undefined, awayMinutes: undefined };
            }
          })
        );

        if (cancelled) return;

        setDailyStatsMap((prev) => {
          const merged = { ...prev };
          sessionResults.forEach(({ dateKey, startHour, endHour, awayMinutes }) => {
            const existing = merged[dateKey] || { totalStudyMinutes: 0 };
            merged[dateKey] = {
              ...existing,
              startHour: existing.startHour ?? startHour,
              endHour: existing.endHour ?? endHour,
              awayMinutes: existing.awayMinutes ?? awayMinutes,
            };
          });
          return merged;
        });
      } catch (error) {
        console.error('[Student Detail] Failed to load daily stats:', error);
        if (!cancelled) setStatsLoading(false);
      }
    };

    fetchDailyStats();
    return () => {
      cancelled = true;
    };
  }, [firestore, centerId, studentId, todayKey]);

  useEffect(() => {
    let cancelled = false;
    const fetchPlanItems = async () => {
      if (!firestore || !centerId || !studentId) {
        setPlanItems([]);
        return;
      }

      setPlansLoading(true);
      try {
        const start = subDays(today, 28);
        const end = addDays(today, 14);
        const weekKeys = new Set<string>();
        let cursor = start;
        while (!isBefore(end, cursor)) {
          weekKeys.add(format(cursor, "yyyy-'W'II"));
          cursor = addDays(cursor, 1);
        }

        const snapshots = await Promise.all(Array.from(weekKeys).map((weekKey) => getDocs(collection(firestore, 'centers', centerId, 'plans', studentId, 'weeks', weekKey, 'items'))));
        if (cancelled) return;

        const minDate = format(start, 'yyyy-MM-dd');
        const maxDate = format(end, 'yyyy-MM-dd');
        const merged: WithId<StudyPlanItem>[] = [];

        snapshots.forEach((snap) => {
          snap.docs.forEach((itemDoc) => {
            const data = itemDoc.data() as StudyPlanItem;
            if (!data.dateKey || data.dateKey < minDate || data.dateKey > maxDate) return;
            merged.push({ ...data, id: itemDoc.id });
          });
        });

        merged.sort((a, b) => {
          const dateDiff = a.dateKey.localeCompare(b.dateKey);
          if (dateDiff !== 0) return dateDiff;
          return a.title.localeCompare(b.title, 'ko');
        });

        setPlanItems(merged);
      } catch (error) {
        console.error('[Student Detail] Failed to load plan items:', error);
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    };

    fetchPlanItems();
    return () => {
      cancelled = true;
    };
  }, [firestore, centerId, studentId, todayKey]);

  const studentCounselingLogs = useMemo(() => {
    return (counselingLogsRaw || []).filter((log) => log.studentId === studentId).sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
  }, [counselingLogsRaw, studentId]);

  const studentQuickFeedbacks = useMemo(() => {
    return (studentNotificationsRaw || [])
      .filter((item) => item.type === 'one_line_feedback')
      .sort((a, b) => toTime(b.updatedAt || b.createdAt) - toTime(a.updatedAt || a.createdAt));
  }, [studentNotificationsRaw]);

  const studentReservations = useMemo(() => {
    return (reservationsRaw || []).filter((reservation) => reservation.studentId === studentId).sort((a, b) => toTime(b.scheduledAt) - toTime(a.scheduledAt));
  }, [reservationsRaw, studentId]);
  const reservationQuestionById = useMemo(() => {
    const map = new Map<string, string>();
    studentReservations.forEach((reservation) => {
      const question = reservation.studentNote?.trim();
      if (reservation.id && question) map.set(reservation.id, question);
    });
    return map;
  }, [studentReservations]);

  const studyLogMap = useMemo(() => {
    const map: Record<string, StudyLogDay> = {};
    (studyLogs || []).forEach((log) => {
      if (log.dateKey) map[log.dateKey] = log;
    });
    return map;
  }, [studyLogs]);

  const attendanceCurrent = attendanceCurrentRows?.[0];

  const activeSessionMinutes = useMemo(() => {
    if (!attendanceCurrent || attendanceCurrent.status !== 'studying' || !attendanceCurrent.lastCheckInAt) return 0;
    const startAt = attendanceCurrent.lastCheckInAt.toDate().getTime();
    const elapsedMs = Date.now() - startAt;
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
    return Math.ceil(elapsedMs / 60000);
  }, [attendanceCurrent]);

  const rhythmTrendMaps = useMemo(() => {
    const nextStart: Record<string, Date | null> = {};
    const nextEnd: Record<string, Date | null> = {};
    const nextAway: Record<string, number> = {};

    for (let index = 0; index < 14; index += 1) {
      const dateKey = format(subDays(today, 13 - index), 'yyyy-MM-dd');
      const stat = dailyStatsMap[dateKey];
      const todayFallback =
        dateKey === todayKey && attendanceCurrent?.status === 'studying' && attendanceCurrent?.lastCheckInAt
          ? attendanceCurrent.lastCheckInAt.toDate()
          : null;

      nextStart[dateKey] = hourNumberToDate(dateKey, stat?.startHour ?? null) || todayFallback;
      nextEnd[dateKey] = hourNumberToDate(dateKey, stat?.endHour ?? null) || todayFallback;
      nextAway[dateKey] = Math.max(0, Math.round(Number(stat?.awayMinutes || 0)));
    }

    return {
      studyStartByDateKey: nextStart,
      studyEndByDateKey: nextEnd,
      awayMinutesByDateKey: nextAway,
    };
  }, [dailyStatsMap, today, todayKey, attendanceCurrent]);

  const { studyStartByDateKey, studyEndByDateKey, awayMinutesByDateKey } = rhythmTrendMaps;

  const planByDate = useMemo(() => {
    const map: Record<string, PlanBucket> = {};
    planItems.forEach((item) => {
      if (!item.dateKey) return;
      if (!map[item.dateKey]) map[item.dateKey] = { studyTotal: 0, studyDone: 0, routineCount: 0, personalCount: 0 };
      const bucket = map[item.dateKey];
      if (item.category === 'schedule') {
        bucket.routineCount += 1;
      } else if (item.category === 'personal') {
        bucket.personalCount += 1;
      } else {
        bucket.studyTotal += 1;
        if (item.done) bucket.studyDone += 1;
      }
    });
    return map;
  }, [planItems]);

  const fullSeries = useMemo(() => {
    return Array.from({ length: 28 }, (_, idx) => {
      const date = subDays(today, 27 - idx);
      const dateKey = format(date, 'yyyy-MM-dd');
      const stat = dailyStatsMap[dateKey];
      const log = studyLogMap[dateKey];
      const plan = planByDate[dateKey];
      const hasActualStudyLog = Boolean(log);
      const loggedMinutes = Number(log?.totalMinutes || 0);
      const fallbackMinutes = Number(stat?.totalStudyMinutes || 0);
      const inProgressMinutes = dateKey === todayKey ? activeSessionMinutes : 0;
      const baseMinutes = hasActualStudyLog ? loggedMinutes : fallbackMinutes;
      const studyMinutes = Math.max(0, baseMinutes + inProgressMinutes);
      const completionFromPlans = plan && plan.studyTotal > 0 ? Math.round((plan.studyDone / plan.studyTotal) * 100) : undefined;
      const completionRate = typeof stat?.todayPlanCompletionRate === 'number' ? Math.round(stat.todayPlanCompletionRate) : completionFromPlans;

      return {
        dateKey,
        dateLabel: format(date, 'M/d', { locale: ko }),
        studyMinutes,
        hasActualStudyLog,
        completionRate: completionRate ?? 0,
        hasCompletion: completionRate !== undefined,
      };
    });
  }, [todayKey, activeSessionMinutes, dailyStatsMap, planByDate, studyLogMap]);

  const displaySeries = useMemo(() => fullSeries.slice(-RANGE_MAP[focusedChartView]), [focusedChartView, fullSeries]);

  const avgStudyMinutes = useMemo(() => {
    if (!displaySeries.length) return 0;
    return Math.round(displaySeries.reduce((acc, item) => acc + item.studyMinutes, 0) / displaySeries.length);
  }, [displaySeries]);

  const avgCompletionRate = useMemo(() => {
    const values = displaySeries.filter((item) => item.hasCompletion).map((item) => item.completionRate);
    if (!values.length) return 0;
    return Math.round(values.reduce((acc, value) => acc + value, 0) / values.length);
  }, [displaySeries]);

  const rhythmGuideMeta = useMemo(() => {
    const minutes = normalizeRhythmMinutes(displaySeries.map((item) => ({ studyMinutes: item.studyMinutes, hasActualStudyLog: item.hasActualStudyLog })));
    const sampleCount = minutes.length;
    if (!sampleCount) {
      return {
        score: 0,
        mode: 'std' as const,
        sampleCount: 0,
        averageMinutes: 0,
        stdDevMinutes: 0,
        variationPercent: 0,
        actualLogCount: 0,
        dayDiffPercent: 0,
        formulaExpression: '0 = 0점',
      };
    }

    const averageMinutes = minutes.reduce((acc, value) => acc + value, 0) / sampleCount;
    const variance = minutes.reduce((acc, value) => acc + (value - averageMinutes) ** 2, 0) / sampleCount;
    const stdDevMinutes = Math.sqrt(variance);
    const variationPercent = averageMinutes > 0 ? (stdDevMinutes / averageMinutes) * 100 : 0;
    const actualLogCount = displaySeries.filter((item) => item.hasActualStudyLog).length;
    const stdScore = calculateRhythmScore(minutes);
    const dayCompare = calculateDayCompareScore(minutes);
    const needDayCompareFallback = actualLogCount < Math.min(14, sampleCount);
    const score = needDayCompareFallback ? dayCompare.score : stdScore;

    return {
      score,
      mode: needDayCompareFallback ? ('dayCompare' as const) : ('std' as const),
      sampleCount,
      averageMinutes: Math.round(averageMinutes),
      stdDevMinutes: Math.round(stdDevMinutes),
      variationPercent: Math.round(variationPercent),
      actualLogCount,
      dayDiffPercent: dayCompare.dayDiffPercent,
      formulaExpression: needDayCompareFallback
        ? `100 - ${dayCompare.dayDiffPercent}% = ${score}점`
        : `100 - (${Math.round(stdDevMinutes)} / ${Math.round(averageMinutes)}) × 100 = ${score}점`,
    };
  }, [displaySeries]);

  const rhythmScore = rhythmGuideMeta.score;

  const averageGrowthRate = useMemo(() => {
    const values = Object.values(dailyStatsMap).map((stat) => stat.studyTimeGrowthRate).filter((value): value is number => typeof value === 'number');
    if (!values.length) return 0;
    return Math.round((values.reduce((acc, value) => acc + value, 0) / values.length) * 100);
  }, [dailyStatsMap]);

  const focusKpi = useMemo(() => {
    const todayRow = fullSeries.find((item) => item.dateKey === todayKey);
    const todayMinutes = Math.max(0, Math.round(todayRow?.studyMinutes || 0));
    const previous7Rows = fullSeries.filter((item) => item.dateKey < todayKey).slice(-7);
    const previous7AvgMinutes = previous7Rows.length
      ? Math.round(previous7Rows.reduce((sum, item) => sum + Math.max(0, Math.round(item.studyMinutes || 0)), 0) / previous7Rows.length)
      : 0;
    const recent7Rows = fullSeries.slice(-7);
    const recent7AvgMinutes = recent7Rows.length
      ? Math.round(recent7Rows.reduce((sum, item) => sum + Math.max(0, Math.round(item.studyMinutes || 0)), 0) / recent7Rows.length)
      : 0;

    const todayGrowthPercent =
      previous7AvgMinutes > 0
        ? Math.round(((todayMinutes - previous7AvgMinutes) / previous7AvgMinutes) * 100)
        : todayMinutes > 0
          ? 100
          : 0;

    return {
      todayMinutes,
      previous7AvgMinutes,
      recent7AvgMinutes,
      todayGrowthPercent,
      completionRate: avgCompletionRate,
      rhythmScore,
    };
  }, [fullSeries, todayKey, avgCompletionRate, rhythmScore]);

  const studentTrend42 = useMemo(() => {
    return Array.from({ length: 42 }, (_, idx) => {
      const day = subDays(today, 41 - idx);
      const dateKey = format(day, 'yyyy-MM-dd');
      const logMinutes = Number(studyLogMap[dateKey]?.totalMinutes || 0);
      const statMinutes = Number(dailyStatsMap[dateKey]?.totalStudyMinutes || 0);
      const inProgressMinutes = dateKey === todayKey ? activeSessionMinutes : 0;
      const minutes = Math.max(0, Math.round((logMinutes > 0 ? logMinutes : statMinutes) + inProgressMinutes));
      return {
        dateKey,
        dateLabel: format(day, 'M/d', { locale: ko }),
        minutes,
      };
    });
  }, [todayKey, activeSessionMinutes, studyLogMap, dailyStatsMap]);

  const weeklyGrowthData = useMemo(() => {
    const buckets = Array.from({ length: 6 }, (_, idx) => {
      const chunk = studentTrend42.slice(idx * 7, idx * 7 + 7);
      const totalMinutes = chunk.reduce((sum, item) => sum + item.minutes, 0);
      return {
        label: `${chunk[0]?.dateLabel || ''}~`,
        totalMinutes,
      };
    });
    return buckets.map((bucket, idx, arr) => {
      if (idx === 0) return { ...bucket, growth: 0 };
      const prev = arr[idx - 1].totalMinutes;
      const growth = prev > 0 ? Math.round(((bucket.totalMinutes - prev) / prev) * 100) : 0;
      return { ...bucket, growth };
    });
  }, [studentTrend42]);

  const dailyGrowthData = useMemo(() => {
    return studentTrend42.map((item, idx, arr) => {
      if (idx === 0) return { ...item, growth: 0 };
      const prev = arr[idx - 1].minutes;
      const growth = prev > 0 ? Math.round(((item.minutes - prev) / prev) * 100) : 0;
      return { ...item, growth };
    });
  }, [studentTrend42]);

  const dailyGrowthWindowCount = Math.max(1, Math.ceil(dailyGrowthData.length / 7));
  const boundedDailyGrowthWindowIndex = Math.min(Math.max(0, dailyGrowthWindowIndex), dailyGrowthWindowCount - 1);
  const dailyGrowthWindowData = useMemo(() => {
    if (dailyGrowthData.length === 0) return [];
    const end = dailyGrowthData.length - boundedDailyGrowthWindowIndex * 7;
    const start = Math.max(0, end - 7);
    return dailyGrowthData.slice(start, end);
  }, [dailyGrowthData, boundedDailyGrowthWindowIndex]);

  const startEndTimeTrendData = useMemo(() => {
    return Array.from({ length: 14 }, (_, idx) => {
      const day = subDays(today, 13 - idx);
      const dateKey = format(day, 'yyyy-MM-dd');
      const startDate = studyStartByDateKey[dateKey] || null;
      const endDate = studyEndByDateKey[dateKey] || null;
      return {
        dateLabel: format(day, 'M/d', { locale: ko }),
        startHour: dateToHourNumber(startDate),
        endHour: dateToHourNumber(endDate),
      };
    });
  }, [studyStartByDateKey, studyEndByDateKey]);

  const rhythmScoreOnlyTrend = useMemo(() => {
    const dailyRhythm = Array.from({ length: 14 }, (_, idx) => {
      const day = subDays(today, 13 - idx);
      const dateKey = format(day, 'yyyy-MM-dd');
      const startTime = studyStartByDateKey[dateKey];
      return {
        dateLabel: format(day, 'M/d', { locale: ko }),
        rhythmMinutes: startTime ? startTime.getHours() * 60 + startTime.getMinutes() : null as number | null,
      };
    });

    return dailyRhythm.map((point, index) => {
      const values = dailyRhythm
        .slice(Math.max(0, index - 2), index + 1)
        .map((item) => item.rhythmMinutes)
        .filter((item): item is number => typeof item === 'number');
      const score = values.length >= 2 ? calculateRhythmScore(values) : values.length === 1 ? 100 : 0;
      return { dateLabel: point.dateLabel, score };
    });
  }, [studyStartByDateKey]);

  const averageRhythmScore = useMemo(() => {
    const valid = rhythmScoreOnlyTrend.filter((item) => item.score > 0);
    if (!valid.length) return 0;
    return Math.round(valid.reduce((sum, item) => sum + item.score, 0) / valid.length);
  }, [rhythmScoreOnlyTrend]);

  const awayTimeData = useMemo(() => {
    return Array.from({ length: 14 }, (_, idx) => {
      const day = subDays(today, 13 - idx);
      const dateKey = format(day, 'yyyy-MM-dd');
      return {
        dateLabel: format(day, 'M/d', { locale: ko }),
        awayMinutes: Math.max(0, Math.round(Number(awayMinutesByDateKey[dateKey] || dailyStatsMap[dateKey]?.awayMinutes || 0))),
      };
    });
  }, [awayMinutesByDateKey, dailyStatsMap]);

  const latestWeeklyLearningGrowthPercent = weeklyGrowthData[weeklyGrowthData.length - 1]?.growth ?? 0;
  const latestDailyLearningGrowthPercent = dailyGrowthWindowData[dailyGrowthWindowData.length - 1]?.growth ?? 0;
  const hasWeeklyGrowthData = weeklyGrowthData.some((week) => week.totalMinutes > 0);
  const hasDailyGrowthData = dailyGrowthData.some((day) => day.minutes > 0);
  const hasAwayTimeData = awayTimeData.some((day) => day.awayMinutes > 0);
  const hasRhythmScoreOnlyTrend = rhythmScoreOnlyTrend.some((day) => day.score > 0);
  const hasStartEndTimeData = startEndTimeTrendData.some((day) => day.startHour > 0 || day.endHour > 0);
  const chartInsights = useMemo(
    () => ({
      weekly: buildWeeklyStudyInsight(weeklyGrowthData),
      daily: buildDailyStudyInsight(dailyGrowthWindowData),
      rhythm: buildRhythmInsight(rhythmScoreOnlyTrend),
      startEnd: buildStartEndInsight(
        startEndTimeTrendData.map((item) => ({
          startMinutes: Math.round(Number(item.startHour || 0) * 60),
          endMinutes: Math.round(Number(item.endHour || 0) * 60),
        }))
      ),
      away: buildAwayTimeInsight(awayTimeData),
    }),
    [weeklyGrowthData, dailyGrowthWindowData, rhythmScoreOnlyTrend, startEndTimeTrendData, awayTimeData]
  );
  const dailyGrowthWindowLabel = useMemo(() => {
    if (!dailyGrowthWindowData.length) return '최근 7일';
    return `${dailyGrowthWindowData[0]?.dateLabel} - ${dailyGrowthWindowData[dailyGrowthWindowData.length - 1]?.dateLabel}`;
  }, [dailyGrowthWindowData]);
  const latestRhythmScore = useMemo(() => {
    const recent = [...rhythmScoreOnlyTrend].reverse().find((item) => item.score > 0);
    return recent?.score ?? 0;
  }, [rhythmScoreOnlyTrend]);
  const latestStartEndSnapshot = useMemo(() => {
    const recent = [...startEndTimeTrendData].reverse().find((item) => item.startHour > 0 || item.endHour > 0);
    return {
      start: recent?.startHour ? hourToClockLabel(recent.startHour) : '미기록',
      end: recent?.endHour ? hourToClockLabel(recent.endHour) : '미기록',
    };
  }, [startEndTimeTrendData]);
  const averageAwayMinutes = useMemo(() => {
    const valid = awayTimeData.filter((item) => item.awayMinutes > 0);
    if (!valid.length) return 0;
    return Math.round(valid.reduce((sum, item) => sum + item.awayMinutes, 0) / valid.length);
  }, [awayTimeData]);

  const studyStreakDays = useMemo(() => {
    const seriesMinutesMap = Object.fromEntries(fullSeries.map((item) => [item.dateKey, item.studyMinutes]));
    let streak = 0;
    for (let idx = 0; idx < 28; idx += 1) {
      const dateKey = format(subDays(today, idx), 'yyyy-MM-dd');
      const minutes = Number(seriesMinutesMap[dateKey] || 0);
      if (minutes >= 60) streak += 1;
      else break;
    }
    return streak;
  }, [fullSeries, todayKey]);

  const todayPlanSummary = planByDate[todayKey] || { studyTotal: 0, studyDone: 0, routineCount: 0, personalCount: 0 };

  const pastPlanGroups = useMemo(() => {
    const startDateKey = format(subDays(today, 6), 'yyyy-MM-dd');
    const groups: Record<string, { dateKey: string; routines: WithId<StudyPlanItem>[]; studies: WithId<StudyPlanItem>[]; personals: WithId<StudyPlanItem>[]; }> = {};

    planItems.filter((item) => item.dateKey >= startDateKey && item.dateKey <= todayKey).forEach((item) => {
      if (!groups[item.dateKey]) groups[item.dateKey] = { dateKey: item.dateKey, routines: [], studies: [], personals: [] };
      if (item.category === 'schedule') groups[item.dateKey].routines.push(item);
      else if (item.category === 'personal') groups[item.dateKey].personals.push(item);
      else groups[item.dateKey].studies.push(item);
    });

    return Object.values(groups).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [planItems, todayKey]);

  const recentStudySessions = useMemo(() => {
    return fullSeries
      .slice(-7)
      .map((item) => ({
        dateKey: item.dateKey,
        dateLabel: format(new Date(`${item.dateKey}T00:00:00`), 'M월 d일 (EEE)', { locale: ko }),
        minutes: Math.max(0, Math.round(item.studyMinutes)),
        hasActualStudyLog: item.hasActualStudyLog,
      }))
      .reverse();
  }, [fullSeries]);

  const hasSessionAdjustmentChanges = useMemo(() => {
    return recentStudySessions.some((session) => {
      const adjusted = sessionAdjustments[session.dateKey];
      if (typeof adjusted !== 'number' || Number.isNaN(adjusted)) return false;
      return Math.max(0, Math.round(adjusted)) !== session.minutes;
    });
  }, [recentStudySessions, sessionAdjustments]);

  useEffect(() => {
    setDailyGrowthWindowIndex(0);
  }, [studentId]);

  useEffect(() => {
    if (!isAvgStudyModalOpen) return;
    const next: Record<string, number> = {};
    recentStudySessions.forEach((session) => {
      next[session.dateKey] = session.minutes;
    });
    setSessionAdjustments(next);
  }, [isAvgStudyModalOpen, recentStudySessions]);

  const riskSignals = useMemo(() => {
    const chips: string[] = [];
    if (avgCompletionRate > 0 && avgCompletionRate < 65) chips.push('계획 완수율 관리 필요');
    if (avgStudyMinutes < 120) chips.push('공부시간 보강 필요');
    if (rhythmScore < 55) chips.push('학습 리듬 불안정');
    const latestCounselDate = studentCounselingLogs[0]?.createdAt?.toDate();
    if (!latestCounselDate || isBefore(latestCounselDate, subDays(today, 30))) chips.push('최근 30일 상담 기록 부족');
    return chips;
  }, [avgCompletionRate, avgStudyMinutes, rhythmScore, studentCounselingLogs, todayKey]);

  const coachingHighlights = useMemo(() => {
    const result: string[] = [];
    result.push(`최근 ${RANGE_MAP[focusedChartView]}일 평균 공부시간은 ${minutesToLabel(avgStudyMinutes)}입니다.`);
    if (avgCompletionRate >= 80) result.push('완수율이 안정적입니다. 난이도 상승 과제를 단계적으로 추가해도 좋습니다.');
    else if (avgCompletionRate >= 60) result.push('완수율이 중간권입니다. 핵심 과목 1~2개 우선순위를 더 주면 성과가 빨라집니다.');
    else result.push('완수율이 낮아 계획 단위를 더 작게 나누는 재설계가 필요합니다.');
    if (rhythmScore >= 75) result.push('학습 리듬이 안정적입니다. 동일한 시작 루틴을 유지하는 것이 효과적입니다.');
    else result.push('학습 리듬 변동이 큽니다. 매일 같은 시작 시간을 고정하세요.');
    return result;
  }, [focusedChartView, avgStudyMinutes, avgCompletionRate, rhythmScore]);

  const handleUpdateInfo = async () => {
    if (!functions || !centerId || !studentId || !canEditStudentInfo) return;

    const normalizedParentLinkCode = normalizeParentLinkCode(editForm.parentLinkCode);
    const existingParentLinkCode = normalizeParentLinkCode(student?.parentLinkCode);
    if (normalizedParentLinkCode && !/^\d{6}$/.test(normalizedParentLinkCode)) {
      toast({
        variant: 'destructive',
        title: '입력값 확인 필요',
        description: '부모 연동코드는 6자리 숫자로 입력해 주세요.',
      });
      return;
    }

    setIsUpdating(true);
    try {
      const updateFn = httpsCallable(functions, 'updateStudentAccount', { timeout: 600000 });
      const payload: any = {
        studentId,
        centerId,
        displayName: editForm.name.trim(),
        schoolName: editForm.schoolName.trim(),
        grade: editForm.grade.trim(),
        className: editForm.className || null,
      };

      if (isAdmin) {
        payload.memberStatus = editForm.memberStatus;
      }

      if (normalizedParentLinkCode !== existingParentLinkCode) {
        payload.parentLinkCode = normalizedParentLinkCode || null;
      }

      if (isAdmin && editForm.password.length >= 6) {
        payload.password = editForm.password;
      }

      await updateFn(payload);
      toast({ title: '정보 수정 완료' });
      setIsEditModalOpen(false);
    } catch (error: any) {
      console.error(error);
      const message = resolveCallableErrorMessage(error, '학생 정보 수정 중 오류가 발생했습니다.');
      toast({ variant: 'destructive', title: '수정 실패', description: message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateGrowthData = async () => {
    if (!firestore || !centerId || !studentId || !canEditGrowthData) return;
    setIsUpdating(true);
    try {
      const normalizedLp = Math.max(0, Math.round(Number(editLp) || 0));
      const normalizedPenaltyPoints = Math.max(0, Math.round(Number(editPenaltyPoints) || 0));
      const normalizedTodayMinutes = Math.max(0, Math.round(Number(editTodayMinutes) || 0));
      const normalizedStats = {
        focus: Math.max(0, Math.min(100, Number(editStats.focus) || 0)),
        consistency: Math.max(0, Math.min(100, Number(editStats.consistency) || 0)),
        achievement: Math.max(0, Math.min(100, Number(editStats.achievement) || 0)),
        resilience: Math.max(0, Math.min(100, Number(editStats.resilience) || 0)),
      };

      const previousPenaltyPoints = Math.max(0, Math.round(Number(progress?.penaltyPoints || 0)));
      const penaltyDelta = normalizedPenaltyPoints - previousPenaltyPoints;

      const batch = writeBatch(firestore);
      const pRef = doc(firestore, 'centers', centerId, 'growthProgress', studentId);
      const rRef = doc(firestore, 'centers', centerId, 'leaderboards', `${periodKey}_lp`, 'entries', studentId);
      const sRef = doc(firestore, 'centers', centerId, 'dailyStudentStats', todayKey, 'students', studentId);

      batch.set(
        pRef,
        {
          seasonLp: normalizedLp,
          penaltyPoints: normalizedPenaltyPoints,
          stats: normalizedStats,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      batch.set(sRef, { totalStudyMinutes: normalizedTodayMinutes, updatedAt: serverTimestamp() }, { merge: true });
      batch.set(rRef, { studentId, displayNameSnapshot: student?.name || '학생', value: normalizedLp, updatedAt: serverTimestamp() }, { merge: true });

      if (penaltyDelta !== 0) {
        const penaltyLogRef = doc(collection(firestore, 'centers', centerId, 'penaltyLogs'));
        batch.set(penaltyLogRef, {
          centerId,
          studentId,
          studentName: student?.name || '학생',
          pointsDelta: penaltyDelta,
          reason: `상세 페이지 수동 보정 (${previousPenaltyPoints} → ${normalizedPenaltyPoints})`,
          source: 'manual',
          createdByUserId: currentUser?.uid || '',
          createdByName: currentUser?.displayName || '센터 관리자',
          createdAt: serverTimestamp(),
        });
      }

      await batch.commit();
      toast({ title: '성장 지표 보정 완료' });
      setIsEditStats(false);
    } catch (error: any) {
      console.error(error);
      const message = resolveCallableErrorMessage(error, '성장/세션 보정 중 오류가 발생했습니다.');
      toast({ variant: 'destructive', title: '수정 실패', description: message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveSessionAdjustments = async () => {
    if (!firestore || !centerId || !studentId || !canEditGrowthData) return;

    const changedSessions = recentStudySessions
      .map((session) => {
        const nextValue = sessionAdjustments[session.dateKey];
        if (typeof nextValue !== 'number' || Number.isNaN(nextValue)) return null;
        const normalizedNext = Math.max(0, Math.round(nextValue));
        if (normalizedNext === session.minutes) return null;
        return { dateKey: session.dateKey, minutes: normalizedNext };
      })
      .filter((item): item is { dateKey: string; minutes: number } => Boolean(item));

    if (changedSessions.length === 0) {
      toast({ title: '변경된 세션이 없습니다.' });
      return;
    }

    setIsSessionSaving(true);
    try {
      const batch = writeBatch(firestore);

      changedSessions.forEach(({ dateKey, minutes }) => {
        const dailyLogRef = doc(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', dateKey);
        const dailyStatRef = doc(firestore, 'centers', centerId, 'dailyStudentStats', dateKey, 'students', studentId);

        batch.set(
          dailyLogRef,
          {
            dateKey,
            totalMinutes: minutes,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        batch.set(
          dailyStatRef,
          {
            totalStudyMinutes: minutes,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      await batch.commit();

      setDailyStatsMap((prev) => {
        const next = { ...prev };
        changedSessions.forEach(({ dateKey, minutes }) => {
          next[dateKey] = {
            ...(next[dateKey] || { totalStudyMinutes: 0 }),
            totalStudyMinutes: minutes,
          };
        });
        return next;
      });

      toast({ title: '공부시간 세션 보정 완료' });
      setIsAvgStudyModalOpen(false);
    } catch (error: any) {
      console.error(error);
      const message = resolveCallableErrorMessage(error, '공부시간 세션 보정 중 오류가 발생했습니다.');
      toast({ variant: 'destructive', title: '보정 실패', description: message });
    } finally {
      setIsSessionSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!functions || !centerId || !studentId) return;
    setIsUpdating(true);
    try {
      const deleteFn = httpsCallable(functions, 'deleteStudentAccount', { timeout: 600000 });
      const result: any = await deleteFn({ studentId, centerId });
      if (result.data?.ok) {
        toast({ title: '영구 삭제 완료' });
        router.replace('/dashboard/teacher/students');
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '삭제 실패' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateCounselingLog = async () => {
    if (!firestore || !centerId || !student || !currentUser || !canWriteCounseling) return;
    if (!logContent.trim()) {
      toast({ variant: 'destructive', title: '상담 내용이 필요합니다.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, 'centers', centerId, 'counselingLogs'), {
        studentId,
        studentName: student.name,
        teacherId: currentUser.uid,
        teacherName: currentUser.displayName || '담당 선생님',
        type: logType,
        content: logContent.trim(),
        improvement: logImprovement.trim(),
        readAt: null,
        createdAt: serverTimestamp(),
      });
      toast({ title: '상담 일지 저장 완료' });
      setLogContent('');
      setLogImprovement('');
      setIsLogModalOpen(false);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '상담 일지 저장 실패' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateQuickFeedback = async () => {
    if (!firestore || !centerId || !student || !currentUser || !canWriteCounseling) return;
    if (!quickFeedbackMessage.trim()) {
      toast({ variant: 'destructive', title: '한 줄 피드백을 입력해 주세요.' });
      return;
    }

    setIsQuickFeedbackSubmitting(true);
    try {
      await addDoc(collection(firestore, 'centers', centerId, 'studentNotifications'), {
        centerId,
        studentId,
        teacherId: currentUser.uid,
        teacherName: currentUser.displayName || '담당 선생님',
        type: 'one_line_feedback',
        title: '한 줄 피드백',
        message: quickFeedbackMessage.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast({ title: '한 줄 피드백 전송 완료' });
      setQuickFeedbackMessage('');
      setIsQuickFeedbackModalOpen(false);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '한 줄 피드백 전송 실패' });
    } finally {
      setIsQuickFeedbackSubmitting(false);
    }
  };

  const handleCreateReservation = async () => {
    if (!firestore || !centerId || !student || !currentUser || !canWriteCounseling) return;

    setIsSubmitting(true);
    try {
      const scheduledAt = new Date(`${aptDate}T${aptTime}:00`);
      await addDoc(collection(firestore, 'centers', centerId, 'counselingReservations'), {
        studentId,
        studentName: student.name,
        teacherId: currentUser.uid,
        teacherName: currentUser.displayName || '담당 선생님',
        scheduledAt: Timestamp.fromDate(scheduledAt),
        status: 'confirmed',
        teacherNote: aptNote.trim() || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast({ title: '상담 예약 생성 완료' });
      setAptNote('');
      setIsReservationModalOpen(false);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '상담 예약 생성 실패' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (studentLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  }

  if (isStudentSelfView && currentUser && studentId !== currentUser.uid) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-3 px-4 py-24 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <h2 className="text-2xl font-black tracking-tight text-slate-900">본인 분석만 확인할 수 있어요</h2>
        <p className="text-sm font-semibold text-muted-foreground">다른 학생 계정 분석 화면에는 접근할 수 없습니다.</p>
        <Button asChild className="rounded-xl px-5 font-black">
          <Link href="/dashboard/analysis">분석트랙으로 돌아가기</Link>
        </Button>
      </div>
    );
  }

  const isDataLoading = statsLoading || plansLoading || studyLogLoading;
  const counselingProgress = studentReservations.length > 0
    ? Math.round((studentReservations.filter((item) => item.status === 'done').length / studentReservations.length) * 100)
    : 0;
  const detailActionButtonClass = isAnalysisPresentation ? 'analysis-action-button' : '';
  const detailTabListClass = isAnalysisPresentation
    ? cn('analysis-tab-rail rounded-[1.5rem] grid p-1.5 gap-1.5', isMobile ? 'h-auto grid-cols-2' : 'h-14 grid-cols-3')
    : cn('rounded-2xl bg-muted/30 grid p-1 gap-1', isMobile ? 'h-auto grid-cols-2' : 'h-12 grid-cols-3');
  const detailTabTriggerClass = isAnalysisPresentation
    ? 'analysis-tab-trigger min-w-0 rounded-[1rem] font-black text-xs gap-1.5 px-3 py-2.5'
    : 'min-w-0 rounded-xl font-black text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5 px-2';
  const detailChartCardClass = cn('overflow-hidden rounded-[1.65rem] border border-slate-200 bg-white', isAnalysisPresentation && 'analysis-chart-stage border-none');
  const detailChartHeaderClass = cn('relative z-10', isMobile ? 'px-4 pt-4 pb-3' : 'px-5 pt-5 pb-4');
  const detailChartContentClass = cn('relative z-10 pt-0', isMobile ? 'px-4 pb-4' : 'px-5 pb-5');
  const detailChartPanelClass = cn(
    'relative rounded-[1.3rem] border bg-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]',
    isMobile ? 'p-3' : 'p-4',
    isAnalysisPresentation ? 'border-[#e4ebff]/80' : 'border-slate-100'
  );
  const detailMetricChipClass = 'rounded-[1rem] border border-[#dbe7ff] bg-white/82 px-3 py-2 shadow-[0_14px_30px_-28px_rgba(20,41,95,0.42)]';
  const detailBadgeClass = 'rounded-full border-[#dbe7ff] bg-white/84 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#2554d4]';
  const detailInsightBandClass = cn(
    'mt-3 rounded-[1.15rem] px-3.5 py-3',
    isAnalysisPresentation ? 'analysis-signal-band' : 'border border-slate-200 bg-slate-50/85'
  );

  return (
    <div className={cn(
      'flex flex-col max-w-7xl mx-auto px-4 w-full min-w-0 overflow-x-hidden',
      isMobile ? 'gap-4 pb-32' : 'gap-6 pb-24',
      isAnalysisPresentation && 'analysis-shell student-analysis-shell'
    )}>
      <div className={cn(
        'flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between',
        isAnalysisPresentation && 'analysis-profile-shell'
      )}>
        <div className="flex items-start gap-4 min-w-0">
          {!isStudentSelfView && (
            <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 shrink-0 mt-1" asChild>
              <Link href={backHref}><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
          )}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-black tracking-tighter truncate text-3xl sm:text-4xl">{student?.name || '학생'}</h1>
              <Badge className="bg-primary text-white px-2 py-0.5 rounded-full font-black text-[10px]">{formatSeatLabel(student)}</Badge>
              {!isStudentSelfView && (
                <Badge variant="outline" className="font-black text-[10px] rounded-full"><UserRound className="h-3 w-3 mr-1" /> 학부모/선생님 공유용</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-bold">
              <span className="flex items-center gap-1 text-primary"><Building2 className="h-3.5 w-3.5" /> {student?.schoolName}</span>
              <span className="opacity-30">|</span><span>{student?.grade}</span><span className="opacity-30">|</span>
              <span className="flex items-center gap-1 text-emerald-600"><LayoutGrid className="h-3 w-3" /> {student?.className || '반 미지정'}</span>
              <span className="opacity-30">|</span><span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> 연속 공부 {studyStreakDays}일</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canWriteCounseling && <Button variant="outline" className={cn("rounded-2xl font-black h-11 px-5 text-xs gap-2", detailActionButtonClass)} onClick={() => setIsReservationModalOpen(true)}><CalendarCheck2 className="h-4 w-4" /> 상담 예약</Button>}
          {canWriteCounseling && <Button variant="outline" className={cn("rounded-2xl font-black h-11 px-5 text-xs gap-2", detailActionButtonClass)} onClick={() => setIsLogModalOpen(true)}><ClipboardList className="h-4 w-4" /> 상담 일지 작성</Button>}
          {canWriteCounseling && <Button variant="outline" className={cn("rounded-2xl font-black h-11 px-5 text-xs gap-2", detailActionButtonClass)} onClick={() => setIsQuickFeedbackModalOpen(true)}><MessageSquareMore className="h-4 w-4" /> 한 줄 피드백</Button>}
          {canEditStudentInfo && <Button variant="outline" className={cn("rounded-2xl font-black h-11 px-5 text-xs gap-2", detailActionButtonClass)} onClick={() => setIsEditModalOpen(true)}><Settings2 className="h-4 w-4" /> 정보 수정</Button>}
          {canEditGrowthData && (
            <Button
              variant="outline"
              className={cn("rounded-2xl font-black h-11 px-5 text-xs gap-2", detailActionButtonClass)}
              onClick={() => {
                setIsMasteryModalOpen(true);
                setIsEditStats(true);
              }}
            >
              <Sparkles className="h-4 w-4" /> 지표/세션 보정
            </Button>
          )}
          {isAdmin && <Button variant="destructive" className="rounded-2xl font-black h-11 px-5 text-xs gap-2" onClick={() => { if (confirm('영구 삭제하시겠습니까?')) handleDeleteAccount(); }}><Trash2 className="h-4 w-4" /> 계정 삭제</Button>}
        </div>
      </div>

      <section className={cn("grid gap-3 lg:gap-4", isMobile ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4", isAnalysisPresentation && 'analysis-summary-rail')}>
        <StatAnalysisCard
          title="평균 공부시간"
          value={minutesToLabel(avgStudyMinutes)}
          subValue={`최근 ${RANGE_MAP[focusedChartView]}일 기준`}
          icon={Clock3}
          colorClass="text-blue-500"
          isMobile={isMobile}
          onClick={() => setIsAvgStudyModalOpen(true)}
          presentationMode={presentationMode}
          progress={(avgStudyMinutes / 180) * 100}
        />
        <StatAnalysisCard
          title="평균 공부 리듬"
          value={`${rhythmScore}점`}
          subValue="실제 공부시간 분산 기반 안정성"
          icon={TrendingUp}
          colorClass="text-emerald-500"
          isMobile={isMobile}
          onClick={() => setIsRhythmGuideModalOpen(true)}
          presentationMode={presentationMode}
          progress={rhythmScore}
        />
        <StatAnalysisCard
          title="계획 완수율"
          value={`${avgCompletionRate}%`}
          subValue="학습 할 일 완료율"
          icon={CheckCircle2}
          colorClass="text-amber-500"
          isMobile={isMobile}
          presentationMode={presentationMode}
          progress={avgCompletionRate}
        />
        <StatAnalysisCard
          title="상담 진행도"
          value={`${studentReservations.filter((item) => item.status === 'done').length}/${studentReservations.length}`}
          subValue="완료 상담 / 전체 상담"
          icon={MessageSquare}
          colorClass="text-rose-500"
          isMobile={isMobile}
          presentationMode={presentationMode}
          progress={counselingProgress}
        />
      </section>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="space-y-6 min-w-0">
        <TabsList className={detailTabListClass}>
          <TabsTrigger value="overview" className={detailTabTriggerClass}><BarChart3 className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">학습 분석</span></TabsTrigger>
          <TabsTrigger value="counseling" className={detailTabTriggerClass}><MessageSquare className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">상담 기록</span></TabsTrigger>
          <TabsTrigger value="plans" className={cn(detailTabTriggerClass, isMobile && "col-span-2")}><BookOpen className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">계획/루틴</span></TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-0">
          <Card className="rounded-[1.5rem] border-none shadow-lg bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-black tracking-tight">개인 집중도 KPI</CardTitle>
              <CardDescription className="font-bold text-[11px]">학생 분석트랙에서 개인 집중 지표를 빠르게 확인합니다.</CardDescription>
            </CardHeader>
            <CardContent className={cn("grid gap-2", isMobile ? "grid-cols-1 min-[360px]:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-4")}>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">오늘 학습 성장률</p>
                <p className={cn('mt-1 text-xl font-black tabular-nums', focusKpi.todayGrowthPercent >= 0 ? 'text-emerald-700' : 'text-rose-600')}>
                  {focusKpi.todayGrowthPercent >= 0 ? '+' : ''}{focusKpi.todayGrowthPercent}%
                </p>
                <p className="text-[10px] font-semibold text-emerald-700/80">최근 7일 평균 대비</p>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">최근 7일 평균</p>
                <p className="mt-1 text-xl font-black text-blue-700">{minutesToLabel(focusKpi.recent7AvgMinutes)}</p>
                <p className="text-[10px] font-semibold text-blue-700/80">일 평균 공부시간</p>
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">계획 완수율</p>
                <p className="mt-1 text-xl font-black text-amber-700 tabular-nums">{focusKpi.completionRate}%</p>
                <p className="text-[10px] font-semibold text-amber-700/80">최근 기간 평균</p>
              </div>

              <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">학습 리듬 점수</p>
                <p className="mt-1 text-xl font-black text-violet-700 tabular-nums">{focusKpi.rhythmScore}점</p>
                <p className="text-[10px] font-semibold text-violet-700/80">공부시간 분산 기반</p>
              </div>
            </CardContent>
          </Card>

          <Card className={cn("rounded-[1.5rem] border border-[#dbe7ff] bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)]", isAnalysisPresentation && "analysis-signal-band border-none")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-black tracking-tight flex items-center gap-2 text-[#14295F]">
                <Sparkles className="h-4 w-4 text-[#1f4fbf]" />
                AI 그래프 인사이트 요약
              </CardTitle>
              <CardDescription className="font-bold text-[11px] text-[#31456f]">
                최근 그래프를 기반으로 성장 흐름과 보완 포인트를 자동 분석했습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-0">
              <div className="rounded-xl border border-[#dbe7ff] bg-white/80 px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#1f4fbf]">주간 학습시간 성장률</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{chartInsights.weekly.trend}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{chartInsights.weekly.improve}</p>
              </div>
              <div className="rounded-xl border border-[#dbe7ff] bg-white/80 px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#1f4fbf]">일자별 학습시간</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{chartInsights.daily.trend}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{chartInsights.daily.improve}</p>
              </div>
              <div className={cn("grid gap-2", isMobile ? "grid-cols-1" : "grid-cols-3")}>
                <div className="rounded-xl border border-[#dbe7ff] bg-white/80 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#1f4fbf]">리듬 점수</p>
                  <p className="mt-1 text-xs font-bold text-slate-700">{chartInsights.rhythm.trend}</p>
                </div>
                <div className="rounded-xl border border-[#dbe7ff] bg-white/80 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#1f4fbf]">시작/종료 시각</p>
                  <p className="mt-1 text-xs font-bold text-slate-700">{chartInsights.startEnd.trend}</p>
                </div>
                <div className="rounded-xl border border-[#dbe7ff] bg-white/80 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#1f4fbf]">외출시간</p>
                  <p className="mt-1 text-xs font-bold text-slate-700">{chartInsights.away.trend}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {!isMobile && (
          <div className="grid gap-4">
            <Card className={detailChartCardClass}>
              <CardHeader className={detailChartHeaderClass}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={detailBadgeClass}>Growth Radar</Badge>
                      <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-white/82 text-[10px] font-black text-[#5c6e97]">최근 6주</Badge>
                    </div>
                    <CardTitle className="mt-3 break-keep text-[clamp(1rem,1.45vw,1.28rem)] font-black tracking-tight text-[#14295F]">주간 학습시간 성장률</CardTitle>
                    <CardDescription className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">막대는 주간 누적 학습시간, 리듬선은 전주 대비 성장률이에요.</CardDescription>
                  </div>
                  <div className={detailMetricChipClass}>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">이번 주 성장</p>
                    <p className={cn('mt-1 text-lg font-black tracking-tight', latestWeeklyLearningGrowthPercent >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
                      {formatSignedPercent(latestWeeklyLearningGrowthPercent)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className={detailChartContentClass}>
                {hasWeeklyGrowthData ? (
                  <>
                    <div className={detailChartPanelClass}>
                      <ResponsiveContainer width="100%" height={262}>
                        <ComposedChart data={weeklyGrowthData} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                          <defs>
                            <linearGradient id="detailWeeklyGrowthBarGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#2f65ff" />
                              <stop offset="70%" stopColor="#6f8fff" />
                              <stop offset="100%" stopColor="#bdd0ff" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                          <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} tickLine={false} axisLine={false} tickMargin={8} />
                          <YAxis yAxisId="mins" tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} tickLine={false} axisLine={false} width={38} tickFormatter={(value) => hourTickFormatter(Number(value) / 60)} />
                          <YAxis yAxisId="growth" orientation="right" tick={{ fontSize: 10, fontWeight: 800, fill: '#7b8dab' }} tickLine={false} axisLine={false} width={34} domain={[-20, 20]} tickFormatter={(value) => `${value}%`} />
                          <Tooltip
                            content={(
                              <AnalysisTrendTooltip
                                presentationMode={presentationMode}
                                series={[
                                  { dataKey: 'totalMinutes', label: '누적 학습시간', color: '#4f7cff', formatter: (value) => minutesToLabel(Number(value || 0)) },
                                  { dataKey: 'growth', label: '성장률', color: '#15b87b', formatter: (value) => `${Math.round(Number(value || 0))}%` },
                                ]}
                              />
                            )}
                          />
                          <Bar yAxisId="mins" dataKey="totalMinutes" radius={[10, 10, 4, 4]} maxBarSize={34} fill="url(#detailWeeklyGrowthBarGradient)" />
                          <Line yAxisId="growth" type="monotone" dataKey="growth" stroke="#15b87b" strokeWidth={2.8} dot={false} activeDot={{ r: 4.5, fill: '#15b87b', stroke: '#ffffff', strokeWidth: 2 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <div className={detailInsightBandClass}>
                      <div className="flex items-center gap-2">
                        <div className="analysis-pulse-dot h-2.5 w-2.5 rounded-full bg-[#15b87b]" />
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#2554d4]">주간 해석</p>
                      </div>
                      <p className="mt-2 text-sm font-black leading-6 text-[#14295F]">{chartInsights.weekly.trend}</p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">{chartInsights.weekly.improve}</p>
                    </div>
                  </>
                ) : (
                  <div className="rounded-[1.25rem] border border-dashed border-[#dbe7ff] bg-white/80 px-4 py-8 text-center text-sm font-bold text-[#5c6e97]">최근 주간 학습 데이터가 없습니다.</div>
                )}
              </CardContent>
            </Card>

            <Card className={detailChartCardClass}>
              <CardHeader className={detailChartHeaderClass}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={detailBadgeClass}>Daily Pace</Badge>
                      <Badge variant="outline" className="rounded-full border-[#ffe1c5] bg-white/82 text-[10px] font-black text-[#d86a11]">{dailyGrowthWindowLabel}</Badge>
                    </div>
                    <CardTitle className="mt-3 break-keep text-[clamp(1rem,1.45vw,1.28rem)] font-black tracking-tight text-[#14295F]">일자별 학습시간 성장률</CardTitle>
                    <CardDescription className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">최근 42일 중 선택한 7일 구간의 평균 공부시간과 성장률을 같이 봅니다.</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={detailMetricChipClass}>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">최근 7일</p>
                      <p className={cn('mt-1 text-lg font-black tracking-tight', latestDailyLearningGrowthPercent >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
                        {formatSignedPercent(latestDailyLearningGrowthPercent)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className={cn('h-8 rounded-full px-3 text-[11px] font-black', isAnalysisPresentation && detailActionButtonClass)} onClick={() => setDailyGrowthWindowIndex((prev) => Math.min(dailyGrowthWindowCount - 1, prev + 1))} disabled={boundedDailyGrowthWindowIndex >= dailyGrowthWindowCount - 1}>이전 7일</Button>
                      <Button variant="outline" size="sm" className={cn('h-8 rounded-full px-3 text-[11px] font-black', isAnalysisPresentation && detailActionButtonClass)} onClick={() => setDailyGrowthWindowIndex((prev) => Math.max(0, prev - 1))} disabled={boundedDailyGrowthWindowIndex <= 0}>다음 7일</Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className={detailChartContentClass}>
                {hasDailyGrowthData ? (
                  <>
                    <div className={detailChartPanelClass}>
                      <ResponsiveContainer width="100%" height={262}>
                        <ComposedChart data={dailyGrowthWindowData} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                          <defs>
                            <linearGradient id="detailDailyGrowthBarGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#76d0ff" />
                              <stop offset="70%" stopColor="#8ed7ff" />
                              <stop offset="100%" stopColor="#d4f1ff" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                          <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} tickLine={false} axisLine={false} tickMargin={8} interval={0} />
                          <YAxis yAxisId="mins" tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} tickLine={false} axisLine={false} width={38} tickFormatter={(value) => hourTickFormatter(Number(value) / 60)} />
                          <YAxis yAxisId="growth" orientation="right" tick={{ fontSize: 10, fontWeight: 800, fill: '#7b8dab' }} tickLine={false} axisLine={false} width={36} domain={[-100, 100]} tickFormatter={(value) => `${value}%`} />
                          <Tooltip
                            content={(
                              <AnalysisTrendTooltip
                                presentationMode={presentationMode}
                                series={[
                                  { dataKey: 'minutes', label: '평균 공부시간', color: '#7ccdf5', formatter: (value) => minutesToLabel(Number(value || 0)) },
                                  { dataKey: 'growth', label: '성장률', color: '#ff9b24', formatter: (value) => `${Math.round(Number(value || 0))}%` },
                                ]}
                              />
                            )}
                          />
                          <Bar yAxisId="mins" dataKey="minutes" radius={[10, 10, 4, 4]} maxBarSize={24} fill="url(#detailDailyGrowthBarGradient)" />
                          <Line yAxisId="growth" type="monotone" dataKey="growth" stroke="#ff9b24" strokeWidth={2.8} dot={false} activeDot={{ r: 4.5, fill: '#ff9b24', stroke: '#ffffff', strokeWidth: 2 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <div className={detailInsightBandClass}>
                      <div className="flex items-center gap-2">
                        <div className="analysis-pulse-dot h-2.5 w-2.5 rounded-full bg-[#ff9b24]" />
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#2554d4]">일자 해석</p>
                      </div>
                      <p className="mt-2 text-sm font-black leading-6 text-[#14295F]">{chartInsights.daily.trend}</p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">{chartInsights.daily.improve}</p>
                    </div>
                  </>
                ) : (
                  <div className="rounded-[1.25rem] border border-dashed border-[#dbe7ff] bg-white/80 px-4 py-8 text-center text-sm font-bold text-[#5c6e97]">일자별 학습 데이터가 없습니다.</div>
                )}
              </CardContent>
            </Card>

            <Card className={detailChartCardClass}>
              <CardHeader className={detailChartHeaderClass}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={detailBadgeClass}>Rhythm Gauge</Badge>
                      <Badge variant="outline" className="rounded-full border-[#d5f2e7] bg-white/82 text-[10px] font-black text-[#0f8f65]">최근 14일</Badge>
                    </div>
                    <CardTitle className="mt-3 break-keep text-[clamp(1rem,1.45vw,1.28rem)] font-black tracking-tight text-[#14295F]">리듬 점수 그래프</CardTitle>
                    <CardDescription className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">시작 시간의 흔들림을 리듬 점수로 바꿔서 안정성을 부드럽게 추적합니다.</CardDescription>
                  </div>
                  <div className={detailMetricChipClass}>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">평균 / 최신</p>
                    <p className="mt-1 text-lg font-black tracking-tight text-[#0f8f65]">{averageRhythmScore}점</p>
                    <p className="text-[11px] font-semibold text-[#5c6e97]">최신 {latestRhythmScore}점</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className={detailChartContentClass}>
                <div className={detailChartPanelClass}>
                  <ResponsiveContainer width="100%" height={262}>
                    <AreaChart data={rhythmScoreOnlyTrend} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="detailRhythmGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#17b777" stopOpacity={0.34} />
                          <stop offset="100%" stopColor="#17b777" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} axisLine={false} tickLine={false} tickMargin={8} interval={1} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} axisLine={false} tickLine={false} width={30} domain={[0, 100]} />
                      <Tooltip
                        content={(
                          <AnalysisTrendTooltip
                            presentationMode={presentationMode}
                            series={[
                              { dataKey: 'score', label: '리듬 점수', color: '#17b777', formatter: (value) => `${Math.round(Number(value || 0))}점` },
                            ]}
                          />
                        )}
                      />
                      <Area type="monotone" dataKey="score" stroke="#17b777" strokeWidth={2.8} fill="url(#detailRhythmGradient)" dot={false} activeDot={{ r: 4.5, fill: '#17b777', stroke: '#ffffff', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                  {!hasRhythmScoreOnlyTrend && (
                    <div className="pointer-events-none absolute inset-x-6 bottom-5 rounded-[1rem] border border-dashed border-[#dbe7ff] bg-white/84 px-3 py-2 text-center text-xs font-bold text-[#5c6e97] backdrop-blur-sm">
                      리듬 점수 산출 데이터가 없어 기본 축으로 표시 중입니다.
                    </div>
                  )}
                </div>
                <div className={detailInsightBandClass}>
                  <div className="flex items-center gap-2">
                    <div className="analysis-pulse-dot h-2.5 w-2.5 rounded-full bg-[#17b777]" />
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#2554d4]">리듬 해석</p>
                  </div>
                  <p className="mt-2 text-sm font-black leading-6 text-[#14295F]">{chartInsights.rhythm.trend}</p>
                </div>
              </CardContent>
            </Card>

            <Card className={detailChartCardClass}>
              <CardHeader className={detailChartHeaderClass}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={detailBadgeClass}>Time Window</Badge>
                      <Badge variant="outline" className="rounded-full border-[#eadfff] bg-white/82 text-[10px] font-black text-[#7d4ed8]">최근 14일</Badge>
                    </div>
                    <CardTitle className="mt-3 break-keep text-[clamp(1rem,1.45vw,1.28rem)] font-black tracking-tight text-[#14295F]">공부 시작/종료 시각 추이</CardTitle>
                    <CardDescription className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">첫 시작과 마지막 종료 시각을 한 레일에서 비교해 생활 리듬을 읽습니다.</CardDescription>
                  </div>
                  <div className={detailMetricChipClass}>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">마지막 기록</p>
                    <p className="mt-1 text-sm font-black tracking-tight text-[#14295F]">{latestStartEndSnapshot.start} 시작</p>
                    <p className="text-sm font-black tracking-tight text-[#7d4ed8]">{latestStartEndSnapshot.end} 종료</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className={detailChartContentClass}>
                <div className={detailChartPanelClass}>
                  <ResponsiveContainer width="100%" height={248}>
                    <RechartsLineChart data={startEndTimeTrendData} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} tickLine={false} axisLine={false} tickMargin={8} interval={1} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} tickLine={false} axisLine={false} width={42} domain={[0, 24]} tickFormatter={(value) => hourToClockLabel(Number(value))} />
                      <Tooltip
                        content={(
                          <AnalysisTrendTooltip
                            presentationMode={presentationMode}
                            series={[
                              { dataKey: 'startHour', label: '공부 시작', color: '#23a8ff', formatter: (value) => hourToClockLabel(Number(value || 0)) },
                              { dataKey: 'endHour', label: '공부 종료', color: '#8b5cf6', formatter: (value) => hourToClockLabel(Number(value || 0)) },
                            ]}
                          />
                        )}
                      />
                      <Line type="monotone" dataKey="startHour" stroke="#23a8ff" strokeWidth={2.8} dot={false} activeDot={{ r: 4.5, fill: '#23a8ff', stroke: '#ffffff', strokeWidth: 2 }} />
                      <Line type="monotone" dataKey="endHour" stroke="#8b5cf6" strokeWidth={2.8} dot={false} activeDot={{ r: 4.5, fill: '#8b5cf6', stroke: '#ffffff', strokeWidth: 2 }} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                  {!hasStartEndTimeData && (
                    <div className="pointer-events-none absolute inset-x-6 bottom-5 rounded-[1rem] border border-dashed border-[#dbe7ff] bg-white/84 px-3 py-2 text-center text-xs font-bold text-[#5c6e97] backdrop-blur-sm">
                      시작/종료 시각 데이터가 없어 기본 축으로 표시 중입니다.
                    </div>
                  )}
                </div>
                <div className={detailInsightBandClass}>
                  <div className="flex items-center gap-2">
                    <div className="analysis-pulse-dot h-2.5 w-2.5 rounded-full bg-[#8b5cf6]" />
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#2554d4]">시간대 해석</p>
                  </div>
                  <p className="mt-2 text-sm font-black leading-6 text-[#14295F]">{chartInsights.startEnd.trend}</p>
                </div>
              </CardContent>
            </Card>

            <Card className={detailChartCardClass}>
              <CardHeader className={detailChartHeaderClass}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={detailBadgeClass}>Away Drift</Badge>
                      <Badge variant="outline" className="rounded-full border-[#ffdbe2] bg-white/82 text-[10px] font-black text-[#dc4b74]">최근 14일</Badge>
                    </div>
                    <CardTitle className="mt-3 break-keep text-[clamp(1rem,1.45vw,1.28rem)] font-black tracking-tight text-[#14295F]">학습 중간 외출시간 추이</CardTitle>
                    <CardDescription className="mt-1 text-sm font-semibold leading-6 text-[#5c6e97]">외출시간이 길어지는 날은 집중 흐름이 끊길 가능성이 높습니다.</CardDescription>
                  </div>
                  <div className={detailMetricChipClass}>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">평균 외출</p>
                    <p className="mt-1 text-lg font-black tracking-tight text-[#dc4b74]">{averageAwayMinutes}분</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className={detailChartContentClass}>
                <div className={detailChartPanelClass}>
                  <ResponsiveContainer width="100%" height={248}>
                    <ComposedChart data={awayTimeData} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="detailAwayBarGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ff8aa6" />
                          <stop offset="70%" stopColor="#ffb0bc" />
                          <stop offset="100%" stopColor="#ffe2e8" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} tickLine={false} axisLine={false} tickMargin={8} interval={1} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} tickLine={false} axisLine={false} width={34} tickFormatter={(value) => `${value}m`} />
                      <Tooltip
                        content={(
                          <AnalysisTrendTooltip
                            presentationMode={presentationMode}
                            series={[
                              { dataKey: 'awayMinutes', label: '외출시간', color: '#ef476f', formatter: (value) => `${Math.round(Number(value || 0))}분` },
                            ]}
                          />
                        )}
                      />
                      <Bar dataKey="awayMinutes" fill="url(#detailAwayBarGradient)" radius={[10, 10, 4, 4]} maxBarSize={18} />
                      <Line type="monotone" dataKey="awayMinutes" stroke="#ef476f" strokeWidth={2.8} dot={false} activeDot={{ r: 4.5, fill: '#ef476f', stroke: '#ffffff', strokeWidth: 2 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                  {!hasAwayTimeData && (
                    <div className="pointer-events-none absolute inset-x-6 bottom-5 rounded-[1rem] border border-dashed border-[#dbe7ff] bg-white/84 px-3 py-2 text-center text-xs font-bold text-[#5c6e97] backdrop-blur-sm">
                      외출시간 데이터가 없어 기본 축으로 표시 중입니다.
                    </div>
                  )}
                </div>
                <div className={detailInsightBandClass}>
                  <div className="flex items-center gap-2">
                    <div className="analysis-pulse-dot h-2.5 w-2.5 rounded-full bg-[#ef476f]" />
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#2554d4]">외출 해석</p>
                  </div>
                  <p className="mt-2 text-sm font-black leading-6 text-[#14295F]">{chartInsights.away.trend}</p>
                </div>
              </CardContent>
            </Card>
          </div>
          )}

          {isMobile ? (
            <>
              <div className="grid gap-4">
                <Card className={detailChartCardClass}>
                  <CardHeader className={detailChartHeaderClass}>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={detailBadgeClass}>Growth Radar</Badge>
                        <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-white/82 text-[10px] font-black text-[#5c6e97]">최근 6주</Badge>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="break-keep text-[1rem] font-black tracking-tight text-[#14295F]">주간 학습시간 성장률</CardTitle>
                          <CardDescription className="mt-1 text-[12px] font-semibold leading-5 text-[#5c6e97]">막대는 주간 누적 학습시간, 리듬선은 전주 대비 성장률이에요.</CardDescription>
                        </div>
                        <div className={detailMetricChipClass}>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">이번 주</p>
                          <p className={cn('mt-1 text-base font-black tracking-tight', latestWeeklyLearningGrowthPercent >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
                            {formatSignedPercent(latestWeeklyLearningGrowthPercent)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className={detailChartContentClass}>
                    {hasWeeklyGrowthData ? (
                      <>
                        <div className={detailChartPanelClass}>
                          <ResponsiveContainer width="100%" height={220}>
                            <ComposedChart data={weeklyGrowthData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id="detailWeeklyGrowthBarGradientMobile" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#2f65ff" />
                                  <stop offset="70%" stopColor="#6f8fff" />
                                  <stop offset="100%" stopColor="#bdd0ff" />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                              <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} tickLine={false} axisLine={false} tickMargin={8} />
                              <YAxis yAxisId="mins" tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} tickLine={false} axisLine={false} width={34} tickFormatter={(value) => hourTickFormatter(Number(value) / 60)} />
                              <YAxis yAxisId="growth" orientation="right" tick={{ fontSize: 9, fontWeight: 800, fill: '#7b8dab' }} tickLine={false} axisLine={false} width={30} domain={[-20, 20]} tickFormatter={(value) => `${value}%`} />
                              <Tooltip
                                content={(
                                  <AnalysisTrendTooltip
                                    presentationMode={presentationMode}
                                    series={[
                                      { dataKey: 'totalMinutes', label: '누적 학습시간', color: '#4f7cff', formatter: (value) => minutesToLabel(Number(value || 0)) },
                                      { dataKey: 'growth', label: '성장률', color: '#15b87b', formatter: (value) => `${Math.round(Number(value || 0))}%` },
                                    ]}
                                  />
                                )}
                              />
                              <Bar yAxisId="mins" dataKey="totalMinutes" radius={[8, 8, 4, 4]} maxBarSize={20} fill="url(#detailWeeklyGrowthBarGradientMobile)" />
                              <Line yAxisId="growth" type="monotone" dataKey="growth" stroke="#15b87b" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#15b87b', stroke: '#ffffff', strokeWidth: 2 }} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                        <div className={detailInsightBandClass}>
                          <div className="flex items-center gap-2">
                            <div className="analysis-pulse-dot h-2.5 w-2.5 rounded-full bg-[#15b87b]" />
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#2554d4]">주간 해석</p>
                          </div>
                          <p className="mt-2 text-sm font-black leading-6 text-[#14295F]">{chartInsights.weekly.trend}</p>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-[1.25rem] border border-dashed border-[#dbe7ff] bg-white/80 px-4 py-8 text-center text-sm font-bold text-[#5c6e97]">최근 주간 학습 데이터가 없습니다.</div>
                    )}
                  </CardContent>
                </Card>

                <Card className={detailChartCardClass}>
                  <CardHeader className={detailChartHeaderClass}>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={detailBadgeClass}>Daily Pace</Badge>
                        <Badge variant="outline" className="rounded-full border-[#ffe1c5] bg-white/82 text-[10px] font-black text-[#d86a11]">{dailyGrowthWindowLabel}</Badge>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="break-keep text-[1rem] font-black tracking-tight text-[#14295F]">일자별 학습시간 성장률</CardTitle>
                          <CardDescription className="mt-1 text-[12px] font-semibold leading-5 text-[#5c6e97]">선택한 7일 구간의 평균 공부시간과 성장률을 같이 봅니다.</CardDescription>
                        </div>
                        <div className={detailMetricChipClass}>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">최근 7일</p>
                          <p className={cn('mt-1 text-base font-black tracking-tight', latestDailyLearningGrowthPercent >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
                            {formatSignedPercent(latestDailyLearningGrowthPercent)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className={cn(detailChartContentClass, 'space-y-3')}>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-white/82 text-[10px] font-black text-[#2554d4]">
                        {dailyGrowthWindowCount - boundedDailyGrowthWindowIndex}/{dailyGrowthWindowCount} 구간
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className={cn('h-8 rounded-full px-3 text-[11px] font-black', isAnalysisPresentation && detailActionButtonClass)} onClick={() => setDailyGrowthWindowIndex((prev) => Math.min(dailyGrowthWindowCount - 1, prev + 1))} disabled={boundedDailyGrowthWindowIndex >= dailyGrowthWindowCount - 1}>이전 7일</Button>
                        <Button variant="outline" size="sm" className={cn('h-8 rounded-full px-3 text-[11px] font-black', isAnalysisPresentation && detailActionButtonClass)} onClick={() => setDailyGrowthWindowIndex((prev) => Math.max(0, prev - 1))} disabled={boundedDailyGrowthWindowIndex <= 0}>다음 7일</Button>
                      </div>
                    </div>
                    {hasDailyGrowthData ? (
                      <>
                        <div className={detailChartPanelClass}>
                          <ResponsiveContainer width="100%" height={220}>
                            <ComposedChart data={dailyGrowthWindowData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id="detailDailyGrowthBarGradientMobile" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#76d0ff" />
                                  <stop offset="70%" stopColor="#8ed7ff" />
                                  <stop offset="100%" stopColor="#d4f1ff" />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                              <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} tickLine={false} axisLine={false} tickMargin={8} interval={1} />
                              <YAxis yAxisId="mins" tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} tickLine={false} axisLine={false} width={34} tickFormatter={(value) => hourTickFormatter(Number(value) / 60)} />
                              <YAxis yAxisId="growth" orientation="right" tick={{ fontSize: 9, fontWeight: 800, fill: '#7b8dab' }} tickLine={false} axisLine={false} width={30} domain={[-100, 100]} tickFormatter={(value) => `${value}%`} />
                              <Tooltip
                                content={(
                                  <AnalysisTrendTooltip
                                    presentationMode={presentationMode}
                                    series={[
                                      { dataKey: 'minutes', label: '평균 공부시간', color: '#7ccdf5', formatter: (value) => minutesToLabel(Number(value || 0)) },
                                      { dataKey: 'growth', label: '성장률', color: '#ff9b24', formatter: (value) => `${Math.round(Number(value || 0))}%` },
                                    ]}
                                  />
                                )}
                              />
                              <Bar yAxisId="mins" dataKey="minutes" radius={[8, 8, 4, 4]} maxBarSize={16} fill="url(#detailDailyGrowthBarGradientMobile)" />
                              <Line yAxisId="growth" type="monotone" dataKey="growth" stroke="#ff9b24" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#ff9b24', stroke: '#ffffff', strokeWidth: 2 }} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                        <div className={detailInsightBandClass}>
                          <div className="flex items-center gap-2">
                            <div className="analysis-pulse-dot h-2.5 w-2.5 rounded-full bg-[#ff9b24]" />
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#2554d4]">일자 해석</p>
                          </div>
                          <p className="mt-2 text-sm font-black leading-6 text-[#14295F]">{chartInsights.daily.trend}</p>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-[1.25rem] border border-dashed border-[#dbe7ff] bg-white/80 px-4 py-8 text-center text-sm font-bold text-[#5c6e97]">일자별 학습 데이터가 없습니다.</div>
                    )}
                  </CardContent>
                </Card>

                <Card className={detailChartCardClass}>
                  <CardHeader className={detailChartHeaderClass}>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={detailBadgeClass}>Rhythm Gauge</Badge>
                        <Badge variant="outline" className="rounded-full border-[#d5f2e7] bg-white/82 text-[10px] font-black text-[#0f8f65]">최근 14일</Badge>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="break-keep text-[1rem] font-black tracking-tight text-[#14295F]">리듬 점수 그래프</CardTitle>
                          <CardDescription className="mt-1 text-[12px] font-semibold leading-5 text-[#5c6e97]">시작 시간의 흔들림을 리듬 점수로 바꿔서 안정성을 추적합니다.</CardDescription>
                        </div>
                        <div className={detailMetricChipClass}>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">평균 / 최신</p>
                          <p className="mt-1 text-base font-black tracking-tight text-[#0f8f65]">{averageRhythmScore}점</p>
                          <p className="text-[11px] font-semibold text-[#5c6e97]">최신 {latestRhythmScore}점</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className={detailChartContentClass}>
                    <div className={detailChartPanelClass}>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={rhythmScoreOnlyTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                          <defs>
                            <linearGradient id="detailRhythmGradientMobile" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#17b777" stopOpacity={0.34} />
                              <stop offset="100%" stopColor="#17b777" stopOpacity={0.04} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                          <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} axisLine={false} tickLine={false} tickMargin={8} interval={1} />
                          <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} axisLine={false} tickLine={false} width={26} domain={[0, 100]} />
                          <Tooltip
                            content={(
                              <AnalysisTrendTooltip
                                presentationMode={presentationMode}
                                series={[
                                  { dataKey: 'score', label: '리듬 점수', color: '#17b777', formatter: (value) => `${Math.round(Number(value || 0))}점` },
                                ]}
                              />
                            )}
                          />
                          <Area type="monotone" dataKey="score" stroke="#17b777" strokeWidth={2.5} fill="url(#detailRhythmGradientMobile)" dot={false} activeDot={{ r: 4, fill: '#17b777', stroke: '#ffffff', strokeWidth: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                      {!hasRhythmScoreOnlyTrend && (
                        <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-[1rem] border border-dashed border-[#dbe7ff] bg-white/84 px-3 py-2 text-center text-[11px] font-bold text-[#5c6e97] backdrop-blur-sm">
                          리듬 점수 산출 데이터가 없어 기본 축으로 표시 중입니다.
                        </div>
                      )}
                    </div>
                    <div className={detailInsightBandClass}>
                      <div className="flex items-center gap-2">
                        <div className="analysis-pulse-dot h-2.5 w-2.5 rounded-full bg-[#17b777]" />
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#2554d4]">리듬 해석</p>
                      </div>
                      <p className="mt-2 text-sm font-black leading-6 text-[#14295F]">{chartInsights.rhythm.trend}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className={detailChartCardClass}>
                  <CardHeader className={detailChartHeaderClass}>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={detailBadgeClass}>Time Window</Badge>
                        <Badge variant="outline" className="rounded-full border-[#eadfff] bg-white/82 text-[10px] font-black text-[#7d4ed8]">최근 14일</Badge>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="break-keep text-[1rem] font-black tracking-tight text-[#14295F]">공부 시작/종료 시각 추이</CardTitle>
                          <CardDescription className="mt-1 text-[12px] font-semibold leading-5 text-[#5c6e97]">첫 시작과 마지막 종료 시각을 한 레일에서 비교합니다.</CardDescription>
                        </div>
                        <div className={detailMetricChipClass}>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">마지막 기록</p>
                          <p className="mt-1 text-[11px] font-black tracking-tight text-[#14295F]">{latestStartEndSnapshot.start} 시작</p>
                          <p className="text-[11px] font-black tracking-tight text-[#7d4ed8]">{latestStartEndSnapshot.end} 종료</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className={detailChartContentClass}>
                    <div className={detailChartPanelClass}>
                      <ResponsiveContainer width="100%" height={220}>
                        <RechartsLineChart data={startEndTimeTrendData} margin={{ top: 8, right: 6, left: -12, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                          <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} tickLine={false} axisLine={false} tickMargin={8} interval={1} />
                          <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} tickLine={false} axisLine={false} width={40} domain={[0, 24]} tickFormatter={(value) => hourToClockLabel(Number(value))} />
                          <Tooltip
                            content={(
                              <AnalysisTrendTooltip
                                presentationMode={presentationMode}
                                series={[
                                  { dataKey: 'startHour', label: '공부 시작', color: '#23a8ff', formatter: (value) => hourToClockLabel(Number(value || 0)) },
                                  { dataKey: 'endHour', label: '공부 종료', color: '#8b5cf6', formatter: (value) => hourToClockLabel(Number(value || 0)) },
                                ]}
                              />
                            )}
                          />
                          <Line type="monotone" dataKey="startHour" stroke="#23a8ff" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#23a8ff', stroke: '#ffffff', strokeWidth: 2 }} />
                          <Line type="monotone" dataKey="endHour" stroke="#8b5cf6" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#8b5cf6', stroke: '#ffffff', strokeWidth: 2 }} />
                        </RechartsLineChart>
                      </ResponsiveContainer>
                      {!hasStartEndTimeData && (
                        <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-[1rem] border border-dashed border-[#dbe7ff] bg-white/84 px-3 py-2 text-center text-[11px] font-bold text-[#5c6e97] backdrop-blur-sm">
                          시작/종료 시각 데이터가 없어 기본 축으로 표시 중입니다.
                        </div>
                      )}
                    </div>
                    <div className={detailInsightBandClass}>
                      <div className="flex items-center gap-2">
                        <div className="analysis-pulse-dot h-2.5 w-2.5 rounded-full bg-[#8b5cf6]" />
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#2554d4]">시간대 해석</p>
                      </div>
                      <p className="mt-2 text-sm font-black leading-6 text-[#14295F]">{chartInsights.startEnd.trend}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className={detailChartCardClass}>
                  <CardHeader className={detailChartHeaderClass}>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={detailBadgeClass}>Away Drift</Badge>
                        <Badge variant="outline" className="rounded-full border-[#ffdbe2] bg-white/82 text-[10px] font-black text-[#dc4b74]">최근 14일</Badge>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="break-keep text-[1rem] font-black tracking-tight text-[#14295F]">학습 중간 외출시간 추이</CardTitle>
                          <CardDescription className="mt-1 text-[12px] font-semibold leading-5 text-[#5c6e97]">외출시간이 길어지는 날은 집중 흐름이 끊길 가능성이 높습니다.</CardDescription>
                        </div>
                        <div className={detailMetricChipClass}>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6a7da6]">평균 외출</p>
                          <p className="mt-1 text-base font-black tracking-tight text-[#dc4b74]">{averageAwayMinutes}분</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className={detailChartContentClass}>
                    <div className={detailChartPanelClass}>
                      <ResponsiveContainer width="100%" height={220}>
                        <ComposedChart data={awayTimeData} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
                          <defs>
                            <linearGradient id="detailAwayBarGradientMobile" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#ff8aa6" />
                              <stop offset="70%" stopColor="#ffb0bc" />
                              <stop offset="100%" stopColor="#ffe2e8" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                          <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} tickLine={false} axisLine={false} tickMargin={8} interval={1} />
                          <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: '#6a7da6' }} tickLine={false} axisLine={false} width={28} tickFormatter={(value) => `${value}m`} />
                          <Tooltip
                            content={(
                              <AnalysisTrendTooltip
                                presentationMode={presentationMode}
                                series={[
                                  { dataKey: 'awayMinutes', label: '외출시간', color: '#ef476f', formatter: (value) => `${Math.round(Number(value || 0))}분` },
                                ]}
                              />
                            )}
                          />
                          <Bar dataKey="awayMinutes" fill="url(#detailAwayBarGradientMobile)" radius={[8, 8, 4, 4]} maxBarSize={14} />
                          <Line type="monotone" dataKey="awayMinutes" stroke="#ef476f" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#ef476f', stroke: '#ffffff', strokeWidth: 2 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                      {!hasAwayTimeData && (
                        <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-[1rem] border border-dashed border-[#dbe7ff] bg-white/84 px-3 py-2 text-center text-[11px] font-bold text-[#5c6e97] backdrop-blur-sm">
                          외출시간 데이터가 없어 기본 축으로 표시 중입니다.
                        </div>
                      )}
                    </div>
                    <div className={detailInsightBandClass}>
                      <div className="flex items-center gap-2">
                        <div className="analysis-pulse-dot h-2.5 w-2.5 rounded-full bg-[#ef476f]" />
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#2554d4]">외출 해석</p>
                      </div>
                      <p className="mt-2 text-sm font-black leading-6 text-[#14295F]">{chartInsights.away.trend}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[1.5rem] border-none shadow-lg bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-black tracking-tight flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> 인지 리듬 지표</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2"><div className="flex items-center justify-between text-xs font-black"><span>리듬 안정성 점수</span><span>{focusKpi.rhythmScore}점</span></div><Progress value={focusKpi.rhythmScore} className="h-2" /></div>
                    <div className="space-y-2"><div className="flex items-center justify-between text-xs font-black"><span>집중 성장률(평균)</span><span className={cn(averageGrowthRate >= 0 ? 'text-emerald-600' : 'text-rose-500')}>{averageGrowthRate >= 0 ? '+' : ''}{averageGrowthRate}%</span></div><Progress value={Math.min(100, Math.max(0, 50 + averageGrowthRate))} className="h-2" /></div>
                    <Badge variant="secondary" className="font-black text-[10px] rounded-full px-3 py-1">연속 1시간+ 공부 {studyStreakDays}일</Badge>
                  </CardContent>
                </Card>

                <Card className="rounded-[1.5rem] border-none shadow-lg bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-black tracking-tight flex items-center gap-2"><Target className="h-4 w-4 text-blue-500" /> 인지과학 코칭 포인트</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {coachingHighlights.map((message, index) => (
                      <div key={message} className="flex items-start gap-2 rounded-xl border border-primary/10 bg-primary/5 px-3 py-2.5">
                        <Badge className="h-5 min-w-5 rounded-full p-0 flex items-center justify-center text-[10px] font-black">{index + 1}</Badge>
                        <p className="text-sm font-bold leading-relaxed text-slate-700">{message}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="rounded-[1.5rem] border-none shadow-lg bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-black tracking-tight flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-500" /> 위험 신호 및 지원 우선순위</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {riskSignals.length === 0 ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">현재 뚜렷한 위험 신호는 없습니다. 유지 전략 중심의 피드백이 적합합니다.</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">{riskSignals.map((signal) => <Badge key={signal} variant="outline" className="font-black border-rose-200 text-rose-600 bg-rose-50">{signal}</Badge>)}</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-12">
                <Card className={cn("lg:col-span-8 rounded-[2rem] border-none shadow-lg bg-white overflow-hidden", isAnalysisPresentation && "analysis-chart-stage")}>
                  <CardHeader className="pb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> 공부시간 추이</CardTitle>
                      <CardDescription className="font-bold text-[11px]">집중 시간을 시계열로 확인해 리듬 변화를 파악합니다.</CardDescription>
                    </div>
                    <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-fit">
                      {(['today', 'weekly', 'monthly'] as ChartRangeKey[]).map((key) => (
                        <Button key={key} variant={focusedChartView === key ? 'default' : 'ghost'} className={cn("h-8 px-3 rounded-lg text-[10px] font-black", isAnalysisPresentation && focusedChartView !== key && detailActionButtonClass)} onClick={() => setFocusedChartView(key)}>{RANGE_MAP[key]}일</Button>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={displaySeries} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
                          <defs>
                            <linearGradient id="studyMinutesGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} /></linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f2f2f2" />
                          <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} fontSize={11} fontWeight={800} />
                          <YAxis tickLine={false} axisLine={false} fontSize={11} fontWeight={800} width={38} />
                          <Tooltip content={<CustomTooltip unit="분" presentationMode={presentationMode} />} />
                          <Area type="monotone" dataKey="studyMinutes" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#studyMinutesGradient)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className={cn("lg:col-span-4 rounded-[2rem] border-none shadow-lg bg-white overflow-hidden", isAnalysisPresentation && "analysis-chart-stage")}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-amber-500" /> 계획 완수율</CardTitle>
                    <CardDescription className="font-bold text-[11px]">일별 완료율로 실행력의 안정성을 점검합니다.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={displaySeries} margin={{ top: 12, right: 0, left: -16, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f2f2f2" />
                          <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} fontSize={10} fontWeight={800} />
                          <YAxis tickLine={false} axisLine={false} fontSize={10} fontWeight={800} width={32} domain={[0, 100]} />
                          <Tooltip content={<CustomTooltip unit="%" presentationMode={presentationMode} />} />
                          <Bar dataKey="completionRate" radius={[8, 8, 0, 0]} fill="#f59e0b" barSize={14} />
                          <Line type="monotone" dataKey="completionRate" stroke="#b45309" strokeWidth={2.5} dot={{ r: 3, fill: '#fff7ed', stroke: '#b45309', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#fff7ed', stroke: '#b45309', strokeWidth: 2 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <Card className="rounded-[2rem] border-none shadow-lg bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> 인지 리듬 지표</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2"><div className="flex items-center justify-between text-xs font-black"><span>리듬 안정성 점수</span><span>{focusKpi.rhythmScore}점</span></div><Progress value={focusKpi.rhythmScore} className="h-2" /></div>
                    <div className="space-y-2"><div className="flex items-center justify-between text-xs font-black"><span>집중 성장률(평균)</span><span className={cn(averageGrowthRate >= 0 ? 'text-emerald-600' : 'text-rose-500')}>{averageGrowthRate >= 0 ? '+' : ''}{averageGrowthRate}%</span></div><Progress value={Math.min(100, Math.max(0, 50 + averageGrowthRate))} className="h-2" /></div>
                    <Badge variant="secondary" className="font-black text-[10px] rounded-full px-3 py-1">연속 1시간+ 공부 {studyStreakDays}일</Badge>
                  </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-none shadow-lg bg-white md:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2"><Target className="h-4 w-4 text-blue-500" /> 인지과학 코칭 포인트</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {coachingHighlights.map((message, index) => (
                      <div key={message} className="flex items-start gap-2 rounded-xl border border-primary/10 bg-primary/5 px-3 py-2.5">
                        <Badge className="h-5 min-w-5 rounded-full p-0 flex items-center justify-center text-[10px] font-black">{index + 1}</Badge>
                        <p className="text-sm font-bold leading-relaxed text-slate-700">{message}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-[2rem] border-none shadow-lg bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-500" /> 위험 신호 및 지원 우선순위</CardTitle>
                </CardHeader>
                <CardContent>
                  {riskSignals.length === 0 ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">현재 뚜렷한 위험 신호는 없습니다. 유지 전략 중심의 피드백이 적합합니다.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">{riskSignals.map((signal) => <Badge key={signal} variant="outline" className="font-black border-rose-200 text-rose-600 bg-rose-50">{signal}</Badge>)}</div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="counseling" className="space-y-6 mt-0">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-5 rounded-[2rem] border-none shadow-lg bg-white">
              <CardHeader><CardTitle className="text-xl font-black tracking-tight flex items-center gap-2"><CalendarCheck2 className="h-5 w-5 text-indigo-500" /> 상담 예약 일정</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {reservationLoading ? (
                  <div className="flex items-center justify-center h-36 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : studentReservations.length === 0 ? (
                  <div className="rounded-xl border border-dashed py-8 text-center text-sm font-bold text-muted-foreground">등록된 상담 예약이 없습니다.</div>
                ) : (
                  studentReservations.slice(0, 8).map((reservation) => {
                    const scheduledAt = reservation.scheduledAt?.toDate();
                    const isPast = scheduledAt ? isBefore(scheduledAt, startOfDay(today)) : false;
                    return (
                    <div key={reservation.id} className={cn("rounded-xl border border-border/60 bg-muted/10 px-3 py-3", isAnalysisPresentation && "analysis-record-card")}>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="text-sm font-black text-slate-800">{scheduledAt ? format(scheduledAt, 'M월 d일 (EEE) HH:mm', { locale: ko }) : '일정 미기입'}</p>
                          <Badge className={cn('font-black text-[10px] rounded-full px-2.5', reservation.status === 'done' && 'bg-emerald-500', reservation.status === 'confirmed' && 'bg-blue-500', reservation.status === 'requested' && 'bg-amber-500', reservation.status === 'canceled' && 'bg-slate-500')}>{STATUS_LABEL[reservation.status]}</Badge>
                        </div>
                        <p className="text-xs font-bold text-muted-foreground">담당: {reservation.teacherName || '담당 선생님'}{isPast ? ' · 지난 일정' : ' · 예정 일정'}</p>
                        {reservation.teacherNote && <p className="mt-1 text-xs font-semibold text-slate-600">메모: {reservation.teacherNote}</p>}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

              <Card className="lg:col-span-7 rounded-[2rem] border-none shadow-lg bg-white">
                <CardHeader><CardTitle className="text-xl font-black tracking-tight flex items-center gap-2"><MessageSquare className="h-5 w-5 text-rose-500" /> 개인 상담 일지</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-2xl border border-[#ffd9b7] bg-[#fff8f2] p-3.5 shadow-sm">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <MessageSquareMore className="h-4 w-4 text-[#ff7a16]" />
                        <p className="text-[11px] font-black uppercase tracking-widest text-[#ff7a16]">최근 한 줄 피드백</p>
                      </div>
                      {canWriteCounseling && (
                        <Button variant="ghost" className="h-8 rounded-xl px-3 text-[10px] font-black text-[#14295F]" onClick={() => setIsQuickFeedbackModalOpen(true)}>
                          바로 작성
                        </Button>
                      )}
                    </div>
                    {studentQuickFeedbacks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[#ffd7b6] bg-white px-3 py-4 text-center text-xs font-bold text-muted-foreground">
                        아직 전달한 한 줄 피드백이 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {studentQuickFeedbacks.slice(0, 4).map((feedback) => (
                          <div key={feedback.id} className={cn("rounded-xl border border-white bg-white px-3 py-3 shadow-sm", isAnalysisPresentation && "analysis-record-card")}>
                            <div className="mb-1 flex items-center gap-2">
                              <Badge className="border-none bg-[#fff3e9] text-[#ff7a16] font-black text-[9px] h-5 px-2">
                                한 줄 피드백
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "font-black text-[9px] h-5 px-1.5",
                                  feedback.readAt
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-amber-200 bg-amber-50 text-amber-700"
                                )}
                              >
                                {feedback.readAt ? '읽음' : '미확인'}
                              </Badge>
                              <span className="text-[10px] font-bold text-muted-foreground">
                                {feedback.createdAt ? format(feedback.createdAt.toDate(), 'yyyy.MM.dd HH:mm', { locale: ko }) : '작성 시각 없음'}
                              </span>
                            </div>
                            <p className="text-sm font-bold leading-relaxed text-slate-800">{feedback.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {counselingLoading ? (
                    <div className="flex items-center justify-center h-36 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : studentCounselingLogs.length === 0 ? (
                  <div className="rounded-xl border border-dashed py-8 text-center text-sm font-bold text-muted-foreground">작성된 상담 일지가 없습니다.</div>
                ) : (
                  studentCounselingLogs.slice(0, 10).map((log) => {
                    const studentQuestion =
                      log.studentQuestion?.trim() ||
                      (log.reservationId ? reservationQuestionById.get(log.reservationId)?.trim() : '') ||
                      '';
                    return (
                    <div key={log.id} className={cn("rounded-xl border border-border/60 bg-white px-3 py-3 shadow-sm", isAnalysisPresentation && "analysis-record-card")}>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <Badge className="font-black text-[10px] rounded-full bg-primary text-white">{log.type === 'academic' ? '학습 상담' : log.type === 'life' ? '생활 상담' : '진로 상담'}</Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-black text-[10px] h-5 px-1.5",
                            log.readAt
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          )}
                        >
                          {log.readAt ? '읽음' : '미확인'}
                        </Badge>
                        <span className="text-xs font-bold text-muted-foreground">{log.createdAt ? format(log.createdAt.toDate(), 'yyyy.MM.dd HH:mm', { locale: ko }) : '작성 시각 없음'}</span>
                        <span className="text-xs font-bold text-muted-foreground">· {log.teacherName || '담당 선생님'}</span>
                      </div>
                      {studentQuestion && (
                        <div className="mb-2 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-2">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-sky-700">학생 질문</p>
                          <p className="text-sm font-bold leading-relaxed text-sky-900 whitespace-pre-wrap">{studentQuestion}</p>
                        </div>
                      )}
                      <p className="text-sm font-bold leading-relaxed text-slate-800">{log.content}</p>
                      {log.improvement && <div className="mt-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-700">개선 포인트: {log.improvement}</div>}
                    </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plans" className="space-y-6 mt-0">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-[2rem] border-none shadow-lg bg-white"><CardHeader className="pb-2"><CardTitle className="text-lg font-black tracking-tight flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> 오늘 학습 계획</CardTitle></CardHeader><CardContent><p className="text-3xl font-black tracking-tight text-primary">{todayPlanSummary.studyDone}/{todayPlanSummary.studyTotal}</p><p className="text-xs font-bold text-muted-foreground mt-1">완료 / 전체 학습 할 일</p></CardContent></Card>
            <Card className="rounded-[2rem] border-none shadow-lg bg-white"><CardHeader className="pb-2"><CardTitle className="text-lg font-black tracking-tight flex items-center gap-2"><Timer className="h-4 w-4 text-blue-500" /> 오늘 루틴 수</CardTitle></CardHeader><CardContent><p className="text-3xl font-black tracking-tight text-blue-600">{todayPlanSummary.routineCount}</p><p className="text-xs font-bold text-muted-foreground mt-1">등원/식사/학원 등 시간 루틴</p></CardContent></Card>
            <Card className="rounded-[2rem] border-none shadow-lg bg-white"><CardHeader className="pb-2"><CardTitle className="text-lg font-black tracking-tight flex items-center gap-2"><PlusCircle className="h-4 w-4 text-amber-500" /> 개인 할 일</CardTitle></CardHeader><CardContent><p className="text-3xl font-black tracking-tight text-amber-600">{todayPlanSummary.personalCount}</p><p className="text-xs font-bold text-muted-foreground mt-1">생활/기타 개인 체크 항목</p></CardContent></Card>
          </div>

          <Card className="rounded-[2rem] border-none shadow-lg bg-white">
            <CardHeader><CardTitle className="text-xl font-black tracking-tight flex items-center gap-2"><BookOpen className="h-5 w-5 text-emerald-500" /> 과거 7일 계획/루틴</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {isDataLoading ? (
                <div className="flex items-center justify-center h-36 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : pastPlanGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed py-8 text-center text-sm font-bold text-muted-foreground">과거 7일 계획 데이터가 없습니다.</div>
              ) : (
                pastPlanGroups.map((group) => {
                  const date = new Date(`${group.dateKey}T00:00:00`);
                  return (
                    <div key={group.dateKey} className={cn("rounded-xl border border-border/60 p-3.5 bg-muted/10", isAnalysisPresentation && "analysis-dual-lane-card")}>
                      <div className="flex items-center justify-between mb-2"><p className="text-sm font-black text-slate-800">{format(date, 'M월 d일 (EEE)', { locale: ko })}</p><Badge variant="outline" className="font-black text-[10px] rounded-full">학습 {group.studies.length} · 루틴 {group.routines.length}</Badge></div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-2.5"><p className="text-[11px] font-black text-emerald-700 mb-1.5">학습 할 일</p>{group.studies.length === 0 ? <p className="text-xs font-bold text-emerald-700/70">등록된 학습 계획 없음</p> : <div className="space-y-1">{group.studies.slice(0, 4).map((item) => <div key={item.id} className="flex items-center justify-between text-xs font-semibold text-emerald-800"><span className="truncate pr-2">{item.title}</span><span className="shrink-0 font-black">{item.done ? '완료' : '대기'}</span></div>)}</div>}</div>
                        <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-2.5"><p className="text-[11px] font-black text-blue-700 mb-1.5">루틴/스케줄</p>{group.routines.length === 0 ? <p className="text-xs font-bold text-blue-700/70">등록된 루틴 없음</p> : <div className="space-y-1">{group.routines.slice(0, 4).map((item) => <div key={item.id} className="text-xs font-semibold text-blue-800 truncate">{item.title}</div>)}</div>}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isAvgStudyModalOpen} onOpenChange={setIsAvgStudyModalOpen}>
        <DialogContent className="rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-xl">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">과거 7일 학습세션</DialogTitle>
              <DialogDescription className="text-white/80 font-semibold">
                날짜별 공부시간 세션을 확인하고 필요 시 수동 보정할 수 있습니다.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-4 bg-white">
            {recentStudySessions.length === 0 ? (
              <div className="rounded-xl border border-dashed py-8 text-center text-sm font-bold text-muted-foreground">
                표시할 학습세션이 없습니다.
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {recentStudySessions.map((session) => {
                  const adjustedMinutes = sessionAdjustments[session.dateKey] ?? session.minutes;
                  const isChanged = Math.max(0, Math.round(adjustedMinutes)) !== session.minutes;
                  return (
                    <div key={session.dateKey} className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-800">{session.dateLabel}</p>
                          <p className="text-[11px] font-bold text-slate-500">
                            {session.hasActualStudyLog ? '실제 학습 로그 반영' : '통계 데이터 기반'}
                          </p>
                        </div>
                        {canEditGrowthData ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              step={5}
                              value={adjustedMinutes}
                              onChange={(event) => {
                                const parsed = Number.parseInt(event.target.value, 10);
                                setSessionAdjustments((prev) => ({
                                  ...prev,
                                  [session.dateKey]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
                                }));
                              }}
                              className="h-9 w-24 rounded-lg border-2 text-right font-black"
                            />
                            <span className="text-xs font-black text-slate-500">분</span>
                          </div>
                        ) : (
                          <Badge className="border-none bg-blue-50 text-blue-700 font-black">
                            {minutesToLabel(session.minutes)}
                          </Badge>
                        )}
                      </div>
                      {isChanged && (
                        <p className="mt-2 text-[11px] font-black text-indigo-600">
                          변경 예정: {minutesToLabel(session.minutes)} → {minutesToLabel(adjustedMinutes)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <DialogFooter>
              {canEditGrowthData ? (
                <div className="flex w-full gap-2">
                  <Button variant="outline" className="flex-1 rounded-xl font-black" onClick={() => setIsAvgStudyModalOpen(false)}>
                    닫기
                  </Button>
                  <Button
                    className="flex-1 rounded-xl font-black"
                    onClick={handleSaveSessionAdjustments}
                    disabled={isSessionSaving || !hasSessionAdjustmentChanges}
                  >
                    {isSessionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : '세션 보정 저장'}
                  </Button>
                </div>
              ) : (
                <DialogClose asChild>
                  <Button className="rounded-xl font-black">확인</Button>
                </DialogClose>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isRhythmGuideModalOpen} onOpenChange={setIsRhythmGuideModalOpen}>
        <DialogContent className="rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-xl">
          <div className="bg-gradient-to-r from-[#0f2359] to-[#1d3f8c] px-6 py-5 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">평균 공부 리듬 그래프</DialogTitle>
              <DialogDescription className="text-white/80 font-semibold">
                최근 {RANGE_MAP[focusedChartView]}일 공부시간 흐름과 리듬 점수 계산식을 함께 보여줍니다.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-4 bg-white">
            <div className="rounded-2xl border bg-white p-4">
              <div className="mb-3 flex gap-1 bg-muted/40 p-1 rounded-xl w-fit">
                {(['today', 'weekly', 'monthly'] as ChartRangeKey[]).map((key) => (
                  <Button
                    key={key}
                    variant={focusedChartView === key ? 'default' : 'ghost'}
                    className="h-8 px-3 rounded-lg text-[10px] font-black"
                    onClick={() => setFocusedChartView(key)}
                  >
                    {RANGE_MAP[key]}일
                  </Button>
                ))}
              </div>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={displaySeries} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rhythmStudyMinutesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f2f2f2" />
                    <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} fontSize={11} fontWeight={800} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} fontWeight={800} width={36} />
                          <Tooltip content={<CustomTooltip unit="분" presentationMode={presentationMode} />} />
                    <Area type="monotone" dataKey="studyMinutes" stroke="#10b981" strokeWidth={3} fill="url(#rhythmStudyMinutesGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-4">
              <p className="font-black text-[11px] uppercase tracking-widest text-slate-500">계산식</p>
              <div className="mt-2 rounded-xl bg-slate-900 text-slate-50 px-3.5 py-3">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-300">
                  {rhythmGuideMeta.mode === 'dayCompare' ? '전일 비교 보정식' : '표준편차 기반 수식'}
                </p>
                <p className="mt-1 font-mono text-sm font-semibold">{rhythmGuideMeta.formulaExpression}</p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="font-black text-slate-500">평균 공부시간</p>
                  <p className="font-black text-slate-900 text-base">{rhythmGuideMeta.averageMinutes}분</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="font-black text-slate-500">표준편차</p>
                  <p className="font-black text-slate-900 text-base">{rhythmGuideMeta.stdDevMinutes}분</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="font-black text-slate-500">변동계수</p>
                  <p className="font-black text-slate-900 text-base">{rhythmGuideMeta.variationPercent}%</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="font-black text-slate-500">전일 변동률</p>
                  <p className="font-black text-slate-900 text-base">{rhythmGuideMeta.dayDiffPercent}%</p>
                </div>
                <div className="col-span-2 rounded-xl bg-emerald-50 px-3 py-2.5 border border-emerald-100">
                  <p className="font-black text-emerald-700">최종 리듬 점수</p>
                  <p className="font-black text-emerald-700 text-base">{rhythmScore}점</p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button className="rounded-xl font-black">확인</Button>
              </DialogClose>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isMasteryModalOpen}
        onOpenChange={(open) => {
          setIsMasteryModalOpen(open);
          if (!open) setIsEditStats(false);
        }}
      >
        <DialogContent className="rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col sm:max-w-xl max-h-[90vh]">
          <div className="bg-purple-600 p-10 text-white relative shrink-0">
            <Zap className="absolute top-0 right-0 p-8 h-32 w-32 opacity-20 rotate-12" />
            <DialogHeader>
              <div className="flex justify-between items-center">
                <Badge className="bg-white/20 text-white border-none font-black text-[10px] px-2.5 py-0.5 uppercase tracking-widest whitespace-nowrap">성장 지표 관리</Badge>
                {!isEditStats && canEditGrowthData && <Button variant="ghost" size="sm" onClick={() => setIsEditStats(true)} className="text-white hover:bg-white/10 gap-2 h-8 rounded-lg font-black text-xs"><Settings2 className="h-3.5 w-3.5" /> 수동 보정</Button>}
              </div>
              <DialogTitle className="text-3xl font-black tracking-tighter">성장 및 스킬 마스터 관리</DialogTitle>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto bg-white p-10 space-y-10 custom-scrollbar">
            <section className="space-y-4">
              <h4 className="text-xs font-black uppercase text-primary/60 flex items-center gap-2 whitespace-nowrap"><Zap className="h-4 w-4" /> 시즌 보유 포인트</h4>
              <Card className="rounded-[1.5rem] border-2 border-primary/5 bg-muted/5 p-6 flex flex-col items-center text-center gap-4">
                {isEditStats && canEditGrowthData ? (
                  <div className="w-full space-y-4">
                    <Slider value={[editLp]} max={50000} step={100} onValueChange={([value]) => setEditLp(value)} />
                    <Input type="number" value={editLp} onChange={(event) => setEditLp(Number(event.target.value))} className="h-12 rounded-xl text-center font-black text-xl border-2" />
                  </div>
                ) : (
                  <div className="text-5xl font-black text-primary">{(progress?.seasonLp || 0).toLocaleString()}<span className="text-xl opacity-20 ml-1">점</span></div>
                )}
              </Card>
            </section>

            <section className="space-y-4">
              <h4 className="text-xs font-black uppercase text-rose-600 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> 누적 벌점 지수</h4>
              <Card className="rounded-[1.5rem] border-2 border-rose-100 bg-rose-50/30 p-6">
                {isEditStats && canEditGrowthData ? (
                  <Input
                    type="number"
                    min={0}
                    value={editPenaltyPoints}
                    onChange={(event) => setEditPenaltyPoints(Number(event.target.value))}
                    className="h-14 rounded-2xl border-rose-200 font-black text-2xl text-center text-rose-600"
                  />
                ) : (
                  <div className="text-center">
                    <p className="text-4xl font-black text-rose-600 tabular-nums">
                      {Math.max(0, Math.round(Number(progress?.penaltyPoints || 0)))}점
                    </p>
                    <p className="mt-2 text-xs font-semibold text-rose-700/80">생활/출결 벌점 누적값</p>
                  </div>
                )}
              </Card>
            </section>

            {isEditStats && canEditGrowthData && (
              <section className="space-y-4">
                <h4 className="text-xs font-black uppercase text-blue-600 flex items-center gap-2"><Timer className="h-4 w-4" /> 오늘 공부시간 보정 (분)</h4>
                <Input type="number" value={editTodayMinutes} onChange={(event) => setEditTodayMinutes(Number(event.target.value))} className="h-14 rounded-2xl border-blue-200 font-black text-2xl text-center text-blue-600" />
              </section>
            )}

            {isEditStats && canEditGrowthData && (
              <section className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                <p className="text-xs font-black text-blue-700">공부시간 세션 날짜별 보정</p>
                <p className="text-xs font-semibold text-blue-700/80">최근 7일 날짜별 학습세션은 아래 버튼에서 직접 수정할 수 있습니다.</p>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl font-black border-blue-200 text-blue-700 hover:bg-blue-100"
                  onClick={() => setIsAvgStudyModalOpen(true)}
                >
                  최근 7일 세션 보정 열기
                </Button>
              </section>
            )}

            <section className="space-y-6">
              <h4 className="text-xs font-black uppercase text-primary/60 flex items-center gap-2 whitespace-nowrap"><Activity className="h-4 w-4" /> 핵심 역량 분석</h4>
              <div className="grid gap-8">
                {Object.entries(STAT_CONFIG).map(([key, config]) => {
                  const statKey = key as keyof typeof editStats;
                  const value = isEditStats && canEditGrowthData ? (editStats[statKey] || 0) : (progress?.stats?.[statKey] || 0);
                  const Icon = config.icon;
                  return (
                    <div key={key} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3"><div className={cn('p-2 rounded-xl', config.accent)}><Icon className={cn('h-5 w-5', config.color)} /></div><div><p className="text-sm font-black tracking-tight">{config.label}</p><p className="text-[10px] font-bold text-muted-foreground uppercase">{config.sub}</p></div></div>
                        <div className="text-right flex items-baseline gap-1"><span className="text-2xl font-black tabular-nums">{value.toFixed(1)}</span><span className="text-[10px] font-bold text-muted-foreground/40">/ 100</span></div>
                      </div>
                      {isEditStats && canEditGrowthData ? <Slider value={[value]} max={100} step={0.5} onValueChange={([next]) => setEditStats({ ...editStats, [statKey]: next })} /> : <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden shadow-inner"><div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${value}%` }} /></div>}
                      <p className="text-[11px] font-semibold text-muted-foreground">{config.guide}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <DialogFooter className="p-8 bg-muted/20 border-t shrink-0">
            {isEditStats && canEditGrowthData ? (
              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={() => setIsEditStats(false)} className="flex-1 h-14 rounded-2xl font-black border-2">취소</Button>
                <Button onClick={handleUpdateGrowthData} disabled={isUpdating} className="h-14 px-10 rounded-2xl font-black text-lg shadow-xl gap-2">{isUpdating ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />} 저장</Button>
              </div>
            ) : (
              <DialogClose asChild><Button className="w-full h-14 rounded-2xl font-black text-lg">닫기</Button></DialogClose>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-md p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary p-10 text-white"><DialogTitle className="text-3xl font-black tracking-tighter">프로필 수정</DialogTitle></div>
          <div className="p-8 space-y-4 bg-white">
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">이름</Label><Input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} className="rounded-xl h-12 border-2 font-bold" /></div>
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">소속 반</Label><Select value={editForm.className || 'none'} onValueChange={(value) => setEditForm({ ...editForm, className: value === 'none' ? '' : value })}><SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="none" className="font-bold">미배정</SelectItem>{availableClasses.map((className) => <SelectItem key={className} value={className} className="font-bold">{className}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">학교</Label><Input value={editForm.schoolName} onChange={(event) => setEditForm({ ...editForm, schoolName: event.target.value })} className="rounded-xl h-12 border-2 font-bold" /></div>
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">학년</Label><Select value={editForm.grade} onValueChange={(value) => setEditForm({ ...editForm, grade: value })}><SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1학년">1학년</SelectItem><SelectItem value="2학년">2학년</SelectItem><SelectItem value="3학년">3학년</SelectItem><SelectItem value="N수생">N수생</SelectItem></SelectContent></Select></div>
            {isAdmin && <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">학생 상태</Label><Select value={editForm.memberStatus} onValueChange={(value: 'active' | 'onHold' | 'withdrawn') => setEditForm({ ...editForm, memberStatus: value })}><SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">재원생</SelectItem><SelectItem value="onHold">휴원생</SelectItem><SelectItem value="withdrawn">퇴원생</SelectItem></SelectContent></Select></div>}
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">부모 연동코드 (6자리)</Label><Input value={editForm.parentLinkCode} onChange={(event) => setEditForm({ ...editForm, parentLinkCode: event.target.value.replace(/\D/g, '').slice(0, 6) })} inputMode="numeric" maxLength={6} className="rounded-xl h-12 border-2 font-bold tracking-[0.2em]" placeholder="123456" /></div>
            {isAdmin && <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">비밀번호 (변경 시에만)</Label><Input type="password" value={editForm.password} onChange={(event) => setEditForm({ ...editForm, password: event.target.value })} className="rounded-xl h-12 border-2 font-bold" placeholder="6자 이상 입력 시 변경" /></div>}
          </div>
          <DialogFooter className="p-8 bg-muted/20 border-t"><Button onClick={handleUpdateInfo} disabled={isUpdating} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl">{isUpdating ? <Loader2 className="h-5 w-5 animate-spin" /> : '정보 저장'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReservationModalOpen} onOpenChange={setIsReservationModalOpen}>
        <DialogContent className="rounded-[2rem] sm:max-w-md border-none shadow-2xl">
          <DialogHeader><DialogTitle className="text-2xl font-black tracking-tight">상담 예약 생성</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">날짜</Label><Input type="date" value={aptDate} onChange={(event) => setAptDate(event.target.value)} className="rounded-xl h-11" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">시간</Label><Input type="time" value={aptTime} onChange={(event) => setAptTime(event.target.value)} className="rounded-xl h-11" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">메모 (선택)</Label><Textarea value={aptNote} onChange={(event) => setAptNote(event.target.value)} placeholder="상담 전 확인할 이슈나 목표" className="rounded-xl min-h-[92px]" /></div>
          </div>
          <DialogFooter><Button onClick={handleCreateReservation} disabled={isSubmitting} className="w-full h-12 rounded-xl font-black">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : '상담 예약 저장'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

        <Dialog open={isLogModalOpen} onOpenChange={setIsLogModalOpen}>
          <DialogContent className="rounded-[2rem] sm:max-w-lg border-none shadow-2xl">
            <DialogHeader><DialogTitle className="text-2xl font-black tracking-tight">상담 일지 작성</DialogTitle></DialogHeader>
            <div className="space-y-4 py-1">
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">상담 유형</Label><Select value={logType} onValueChange={(value) => setLogType(value as typeof logType)}><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="academic">학습 상담</SelectItem><SelectItem value="life">생활 상담</SelectItem><SelectItem value="career">진로 상담</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">상담 내용</Label><Textarea value={logContent} onChange={(event) => setLogContent(event.target.value)} placeholder="핵심 상담 내용을 입력하세요." className="rounded-xl min-h-[120px]" /></div>
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">개선 포인트</Label><Textarea value={logImprovement} onChange={(event) => setLogImprovement(event.target.value)} placeholder="향후 실행 포인트를 기록하세요." className="rounded-xl min-h-[90px]" /></div>
            </div>
            <DialogFooter><Button onClick={handleCreateCounselingLog} disabled={isSubmitting} className="w-full h-12 rounded-xl font-black">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : '상담 일지 저장'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isQuickFeedbackModalOpen} onOpenChange={setIsQuickFeedbackModalOpen}>
          <DialogContent className="rounded-[2rem] sm:max-w-lg border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">한 줄 피드백 전송</DialogTitle>
              <DialogDescription className="font-semibold">
                학생 알림창과 팝업으로 바로 확인되는 짧은 피드백입니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-1">
              <div className="rounded-2xl border border-[#ffd9b7] bg-[#fff8f2] px-4 py-3 text-sm font-bold leading-relaxed text-slate-700">
                예시: 오늘은 독서 지문에서 근거 표시를 더 또렷하게 해봅시다.
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">피드백 내용</Label>
                <Textarea
                  value={quickFeedbackMessage}
                  onChange={(event) => setQuickFeedbackMessage(event.target.value)}
                  placeholder="학생에게 바로 전달할 한 줄 피드백을 입력하세요."
                  className="rounded-xl min-h-[110px]"
                  maxLength={160}
                />
                <p className="text-right text-[10px] font-bold text-muted-foreground">
                  {quickFeedbackMessage.trim().length}/160
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateQuickFeedback} disabled={isQuickFeedbackSubmitting} className="w-full h-12 rounded-xl font-black">
                {isQuickFeedbackSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : '한 줄 피드백 보내기'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {!isMobile && (
        <Card className="rounded-[2rem] border-none shadow-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white overflow-hidden">
          <CardContent className="p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70 whitespace-nowrap">성장 요약</p>
              <p className="text-xl sm:text-2xl font-black tracking-tight whitespace-nowrap">포인트 {(progress?.seasonLp || 0).toLocaleString()} · 스킬 평균 {Math.round(((progress?.stats?.focus || 0) + (progress?.stats?.consistency || 0) + (progress?.stats?.achievement || 0) + (progress?.stats?.resilience || 0)) / 4)}점</p>
            </div>
            <Button className="rounded-xl font-black bg-white text-emerald-700 hover:bg-white/90" onClick={() => setIsMasteryModalOpen(true)}><Zap className="h-4 w-4 mr-1.5" /> 성장지표 상세 보기</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

