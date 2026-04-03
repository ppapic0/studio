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
import { Loader2, ArrowLeft, Building2, Zap, Settings2, Activity, Target, RefreshCw, CheckCircle2, ShieldCheck, LayoutGrid, Save, Trash2, CalendarDays, BarChart3, MessageSquare, Clock3, PlusCircle, UserRound, AlertTriangle, Sparkles, ClipboardList, Timer, CalendarCheck2, TrendingUp, BookOpen, MessageSquareMore, PenTool } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StudentProfile, StudyLogDay, GrowthProgress, CenterMembership, CounselingLog, CounselingReservation, StudyPlanItem, WithId, AttendanceCurrent, StudentNotification, DailyReport, AttendanceRequest, PenaltyLog, ParentActivityEvent, Invoice } from '@/lib/types';
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
import { StudentOperationsGraphBoard, type StudentOperationsTimelinePoint } from '@/components/dashboard/student-operations-graph-board';
import { useStudentDetailPresentationMode, type DetailPresentationMode } from '@/components/dashboard/student-detail-presentation-mode';

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
type SmsDeliveryLogLite = {
  id: string;
  studentId?: string;
  eventType?: string;
  status?: string;
  createdAt?: Timestamp;
  sentAt?: Timestamp;
  failedAt?: Timestamp;
  renderedMessage?: string;
  phoneNumber?: string;
  parentName?: string;
  parentUid?: string;
};
type PlanBucket = { studyTotal: number; studyDone: number; routineCount: number; personalCount: number };
type MobileInsightView = 'studyTrend' | 'completion' | 'rhythm' | 'coaching' | 'risk';
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

function timestampToDateKey(value?: Timestamp | null): string | null {
  if (!value) return null;
  try {
    return format(value.toDate(), 'yyyy-MM-dd');
  } catch {
    return null;
  }
}

function addNumberMapValue(map: Map<string, number>, key: string | null | undefined, amount = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
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
          'analysis-premium-card surface-card surface-card--secondary on-dark min-w-0 h-full overflow-hidden rounded-[1.5rem] border-none transition-all',
          onClick && 'cursor-pointer active:scale-[0.985]'
        )}
        onClick={onClick}
      >
        <CardHeader className={cn('pb-2 flex flex-row items-start justify-between', isMobile ? 'gap-2 px-4 pt-4' : 'px-5 pt-5')}>
          <div className="min-w-0">
            <CardTitle
              className={cn(
                'min-w-0 break-keep',
                isMobile
                  ? 'font-sans text-[13px] font-black leading-[1.2] tracking-[-0.02em] text-[#17326B]'
                  : 'font-black uppercase text-[10px] tracking-[0.22em] text-[#4B6397]'
              )}
            >
              {title}
            </CardTitle>
            <div className={cn('mt-3 font-black tracking-tight break-keep text-[#17326B]', isMobile ? 'text-[1.3rem] leading-tight' : 'text-[1.7rem]')}>
              {value}
            </div>
            <p className={cn('mt-1 font-semibold break-keep text-[#3E5488]', isMobile ? 'text-[10px] leading-5' : 'text-[11px] leading-5')}>
              {subValue}
            </p>
          </div>
          <div className="surface-chip surface-chip--dark rounded-[1rem] px-3 py-2 shadow-none">
            <Icon className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', tone.text)} />
          </div>
        </CardHeader>
        <CardContent className={cn(isMobile ? 'px-4 pb-4' : 'px-5 pb-5')}>
          <div className="analysis-kpi-track">
            <span className={cn('bg-gradient-to-r', tone.bar)} style={{ width: `${Math.max(0, Math.min(100, Math.round(progress)))}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#4B6397]">Insight Rail</span>
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
export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studentId } = use(params);
  const presentationMode = useStudentDetailPresentationMode();
  const { user: currentUser } = useUser();
  const { activeMembership, viewMode } = useAppContext();
  const firestore = useFirestore();
  const functions = useFunctions();
  const { toast } = useToast();
  const router = useRouter();

  const isAnalysisPresentation = presentationMode === 'student-analysis';
  const isMobile = viewMode === 'mobile';
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

  const dailyReportsQuery = useMemoFirebase(
    () => (!firestore || !centerId ? null : query(collection(firestore, 'centers', centerId, 'dailyReports'), where('studentId', '==', studentId), limit(120))),
    [firestore, centerId, studentId]
  );
  const { data: dailyReportsRaw } = useCollection<DailyReport>(dailyReportsQuery, { enabled: !!centerId });

  const parentActivityQuery = useMemoFirebase(
    () => (!firestore || !centerId ? null : query(collection(firestore, 'centers', centerId, 'parentActivityEvents'), where('studentId', '==', studentId), limit(240))),
    [firestore, centerId, studentId]
  );
  const { data: parentActivityRaw } = useCollection<ParentActivityEvent>(parentActivityQuery, { enabled: !!centerId });

  const smsDeliveryLogsQuery = useMemoFirebase(
    () => (!firestore || !centerId ? null : query(collection(firestore, 'centers', centerId, 'smsDeliveryLogs'), where('studentId', '==', studentId), limit(240))),
    [firestore, centerId, studentId]
  );
  const { data: smsDeliveryLogsRaw } = useCollection<SmsDeliveryLogLite>(smsDeliveryLogsQuery, { enabled: !!centerId });

  const penaltyLogsQuery = useMemoFirebase(
    () => (!firestore || !centerId ? null : query(collection(firestore, 'centers', centerId, 'penaltyLogs'), where('studentId', '==', studentId), limit(120))),
    [firestore, centerId, studentId]
  );
  const { data: penaltyLogsRaw } = useCollection<PenaltyLog>(penaltyLogsQuery, { enabled: !!centerId });

  const attendanceRequestsQuery = useMemoFirebase(
    () => (!firestore || !centerId ? null : query(collection(firestore, 'centers', centerId, 'attendanceRequests'), where('studentId', '==', studentId), limit(120))),
    [firestore, centerId, studentId]
  );
  const { data: attendanceRequestsRaw } = useCollection<AttendanceRequest>(attendanceRequestsQuery, { enabled: !!centerId });

  const invoicesQuery = useMemoFirebase(
    () => (!firestore || !centerId || !isAdmin ? null : query(collection(firestore, 'centers', centerId, 'invoices'), where('studentId', '==', studentId), limit(120))),
    [firestore, centerId, studentId, isAdmin]
  );
  const { data: invoicesRaw } = useCollection<Invoice>(invoicesQuery, { enabled: !!centerId && isAdmin });

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

  const days30AgoMs = subDays(today, 30).getTime();
  const studentDailyReports = useMemo(
    () => [...(dailyReportsRaw || [])].sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt)),
    [dailyReportsRaw]
  );
  const smsDeliveryLogs = useMemo(
    () =>
      [...(smsDeliveryLogsRaw || [])].sort((a, b) => {
        const bTime = toTime((b.sentAt || b.createdAt) as Timestamp | undefined);
        const aTime = toTime((a.sentAt || a.createdAt) as Timestamp | undefined);
        return bTime - aTime;
      }),
    [smsDeliveryLogsRaw]
  );
  const attendanceRequests = useMemo(
    () => [...(attendanceRequestsRaw || [])].sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt)),
    [attendanceRequestsRaw]
  );
  const penaltyLogs = useMemo(
    () => [...(penaltyLogsRaw || [])].sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt)),
    [penaltyLogsRaw]
  );
  const invoices = useMemo(
    () => [...(invoicesRaw || [])].sort((a, b) => toTime(b.updatedAt) - toTime(a.updatedAt)),
    [invoicesRaw]
  );
  const latestCounselDate = studentCounselingLogs[0]?.createdAt?.toDate() || null;
  const latestReportSent = studentDailyReports.find((report) => report.status === 'sent');
  const latestReportSentLabel = latestReportSent?.createdAt?.toDate
    ? format(latestReportSent.createdAt.toDate(), 'M월 d일')
    : '없음';
  const parentVisitCount30d = (parentActivityRaw || []).filter(
    (event) => event.eventType === 'app_visit' && toTime(event.createdAt) >= days30AgoMs
  ).length;
  const reportReadCount30d = (parentActivityRaw || []).filter(
    (event) => event.eventType === 'report_read' && toTime(event.createdAt) >= days30AgoMs
  ).length;
  const counselingCount30d = studentCounselingLogs.filter((log) => toTime(log.createdAt) >= days30AgoMs).length;
  const reportSentCount30d = studentDailyReports.filter(
    (report) => report.status === 'sent' && toTime(report.createdAt) >= days30AgoMs
  ).length;
  const smsAcceptedCount30d = smsDeliveryLogs.filter((log) => {
    const status = String(log.status || '').toLowerCase();
    return toTime((log.sentAt || log.createdAt) as Timestamp | undefined) >= days30AgoMs
      && !['failed', 'cancelled', 'suppressed_opt_out', '번호없음'].includes(status);
  }).length;
  const smsCost30d = Math.round(smsAcceptedCount30d * 8.7);
  const pendingAttendanceRequestsCount = attendanceRequests.filter((item) => item.status === 'requested').length;
  const attendanceInstabilityScore = Math.min(
    100,
    attendanceRequests.filter((item) => item.status !== 'approved').length * 18
      + riskSignals.filter((signal) => /공부시간|리듬|상담/.test(signal)).length * 14
  );
  const recentPenaltyCount30d = penaltyLogs.filter((log) => toTime(log.createdAt) >= days30AgoMs).length;
  const latestInvoice = invoices[0];
  const latestInvoiceStatusLabel = latestInvoice
    ? latestInvoice.status === 'paid'
      ? '수납완료'
      : latestInvoice.status === 'issued'
        ? '청구됨'
        : latestInvoice.status === 'overdue'
          ? '미납/연체'
          : latestInvoice.status === 'refunded'
            ? '환불'
            : '무효'
    : '미청구';
  const outstandingAmount = invoices
    .filter((invoice) => invoice.status === 'issued' || invoice.status === 'overdue')
    .reduce((sum, invoice) => sum + Number(invoice.finalPrice || 0), 0);
  const todayActionChecklist = [
    attendanceCurrent?.status !== 'studying'
      ? {
          key: 'attendance',
          title: '오늘 출결 상태 다시 확인',
          detail: '공부중이 아니면 등원·외출·하원 상태를 먼저 맞춰 주세요.',
          href: '/dashboard/attendance',
          accent: 'bg-rose-100 text-rose-700',
        }
      : null,
    avgCompletionRate < 65
      ? {
          key: 'plan',
          title: '내일 계획 볼륨 조정',
          detail: '완수율이 낮아 핵심 과제 3~4개 중심으로 줄이는 것이 좋습니다.',
          href: '/dashboard/teacher/students',
          accent: 'bg-amber-100 text-amber-700',
        }
      : null,
    latestReportSent && reportReadCount30d === 0
      ? {
          key: 'guardian',
          title: '리포트 미열람 보호자 후속 연락',
          detail: '최근 발송 리포트가 읽히지 않았습니다. 문자나 상담 연결이 필요합니다.',
          href: '/dashboard/settings/notifications',
          accent: 'bg-violet-100 text-violet-700',
        }
      : null,
    pendingAttendanceRequestsCount > 0
      ? {
          key: 'request',
          title: '미처리 출결 요청 검토',
          detail: `처리 대기 요청 ${pendingAttendanceRequestsCount}건이 남아 있습니다.`,
          href: '/dashboard/attendance',
          accent: 'bg-sky-100 text-sky-700',
        }
      : null,
    isAdmin && outstandingAmount > 0
      ? {
          key: 'billing',
          title: '수납 상태 점검',
          detail: `미정리 금액 ${outstandingAmount.toLocaleString()}원이 남아 있습니다.`,
          href: '/dashboard/revenue',
          accent: 'bg-emerald-100 text-emerald-700',
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; title: string; detail: string; href: string; accent: string }>;

  const operatingCostSignals = [
    {
      key: 'sms',
      title: '문자 발송량',
      value: `${smsAcceptedCount30d}건`,
      helper: `최근 30일 비용 약 ${smsCost30d.toLocaleString()}원`,
      tone: 'border-sky-100 bg-sky-50/70 text-sky-700',
    },
    {
      key: 'counseling',
      title: '상담 빈도',
      value: `${counselingCount30d}건`,
      helper: latestCounselDate ? `최근 상담 ${format(latestCounselDate, 'M월 d일')}` : '최근 상담 기록 없음',
      tone: 'border-amber-100 bg-amber-50/70 text-amber-700',
    },
    {
      key: 'report',
      title: '리포트 발송',
      value: `${reportSentCount30d}건`,
      helper: `최근 발송 ${latestReportSentLabel} · 열람 ${reportReadCount30d}회`,
      tone: 'border-violet-100 bg-violet-50/70 text-violet-700',
    },
    {
      key: 'attendance',
      title: '출결 불안정도',
      value: `${attendanceInstabilityScore}점`,
      helper: `요청 ${pendingAttendanceRequestsCount}건 · 벌점로그 ${recentPenaltyCount30d}건`,
      tone: 'border-rose-100 bg-rose-50/70 text-rose-700',
    },
    ...(isAdmin
      ? [
          {
            key: 'billing',
            title: '수납 상태',
            value: latestInvoiceStatusLabel,
            helper: outstandingAmount > 0 ? `미정리 ${outstandingAmount.toLocaleString()}원` : '현재 미정리 금액 없음',
            tone: 'border-emerald-100 bg-emerald-50/70 text-emerald-700',
          },
        ]
      : [
          {
            key: 'guardian',
            title: '보호자 반응',
            value: `${parentVisitCount30d}회`,
            helper: `최근 30일 앱 방문 ${parentVisitCount30d}회 · 리포트 열람 ${reportReadCount30d}회`,
            tone: 'border-emerald-100 bg-emerald-50/70 text-emerald-700',
          },
        ]),
  ];

  const operationsTimeline = useMemo<StudentOperationsTimelinePoint[]>(() => {
    const appVisitsByDate = new Map<string, number>();
    const reportReadsByDate = new Map<string, number>();
    const counselingByDate = new Map<string, number>();
    const smsByDate = new Map<string, number>();
    const reportsByDate = new Map<string, number>();
    const penaltyCountByDate = new Map<string, number>();
    const penaltyPointsByDate = new Map<string, number>();
    const requestCountByDate = new Map<string, number>();
    const approvedLateByDate = new Map<string, number>();
    const approvedAbsenceByDate = new Map<string, number>();
    const invoiceCountByDate = new Map<string, number>();
    const invoiceAmountByDate = new Map<string, number>();

    (parentActivityRaw || []).forEach((event) => {
      const dateKey = timestampToDateKey(event.createdAt);
      if (event.eventType === 'app_visit') addNumberMapValue(appVisitsByDate, dateKey);
      if (event.eventType === 'report_read') addNumberMapValue(reportReadsByDate, dateKey);
    });

    studentCounselingLogs.forEach((log) => {
      addNumberMapValue(counselingByDate, timestampToDateKey(log.createdAt));
    });

    smsDeliveryLogs.forEach((log) => {
      const status = String(log.status || '').toLowerCase();
      if (['failed', 'cancelled', 'suppressed_opt_out', '번호없음'].includes(status)) return;
      addNumberMapValue(
        smsByDate,
        timestampToDateKey((log.sentAt || log.createdAt) as Timestamp | undefined)
      );
    });

    studentDailyReports.forEach((report) => {
      if (report.status !== 'sent') return;
      addNumberMapValue(reportsByDate, timestampToDateKey(report.createdAt));
    });

    penaltyLogs.forEach((log) => {
      const dateKey = timestampToDateKey(log.createdAt);
      addNumberMapValue(penaltyCountByDate, dateKey);
      addNumberMapValue(penaltyPointsByDate, dateKey, Math.abs(Number(log.pointsDelta || 0)));
    });

    attendanceRequests.forEach((request) => {
      const dateKey = request.date || timestampToDateKey(request.createdAt) || todayKey;
      addNumberMapValue(requestCountByDate, dateKey);
      if (request.type === 'late' && request.status === 'approved') addNumberMapValue(approvedLateByDate, dateKey);
      if (request.type === 'absence' && request.status === 'approved') addNumberMapValue(approvedAbsenceByDate, dateKey);
    });

    if (isAdmin) {
      invoices.forEach((invoice) => {
        const dateKey =
          timestampToDateKey(invoice.updatedAt)
          || timestampToDateKey(invoice.paidAt)
          || timestampToDateKey(invoice.issuedAt);
        addNumberMapValue(invoiceCountByDate, dateKey);
        addNumberMapValue(invoiceAmountByDate, dateKey, Math.max(0, Number(invoice.finalPrice || 0)));
      });
    }

    return fullSeries.slice(-28).map((item) => {
      const appVisits = appVisitsByDate.get(item.dateKey) || 0;
      const reportReads = reportReadsByDate.get(item.dateKey) || 0;
      const counselingCount = counselingByDate.get(item.dateKey) || 0;
      const smsCount = smsByDate.get(item.dateKey) || 0;
      const reportCount = reportsByDate.get(item.dateKey) || 0;
      const penaltyCount = penaltyCountByDate.get(item.dateKey) || 0;
      const penaltyPoints = penaltyPointsByDate.get(item.dateKey) || 0;
      const requestCount = requestCountByDate.get(item.dateKey) || 0;
      const invoiceCount = invoiceCountByDate.get(item.dateKey) || 0;
      const invoiceAmount = invoiceAmountByDate.get(item.dateKey) || 0;
      const guardianTouchCount = appVisits + reportReads;
      const managementTouchCount = counselingCount + smsCount + reportCount;

      let attendanceStatus: StudentOperationsTimelinePoint['attendanceStatus'] = 'requested';
      if ((approvedAbsenceByDate.get(item.dateKey) || 0) > 0) {
        attendanceStatus = 'excused_absent';
      } else if (item.studyMinutes > 0) {
        attendanceStatus = (approvedLateByDate.get(item.dateKey) || 0) > 0 ? 'confirmed_late' : 'confirmed_present';
      } else if (item.dateKey === todayKey && ['studying', 'away', 'break'].includes(attendanceCurrent?.status || '')) {
        attendanceStatus = attendanceCurrent?.status === 'studying' ? 'confirmed_present' : 'confirmed_present_missing_routine';
      } else if (requestCount > 0) {
        attendanceStatus = 'confirmed_absent';
      }

      const attendanceLabel =
        attendanceStatus === 'confirmed_present'
          ? '정상 등원'
          : attendanceStatus === 'confirmed_present_missing_routine'
            ? '루틴 누락 등원'
            : attendanceStatus === 'confirmed_late'
              ? '지각'
              : attendanceStatus === 'confirmed_absent'
                ? '미출석'
                : attendanceStatus === 'excused_absent'
                  ? '사유 결석'
                  : '기록 없음';

      const riskPulse = Math.min(
        100,
        Math.round(
          (attendanceStatus === 'confirmed_absent' ? 34 : attendanceStatus === 'confirmed_late' ? 16 : 0)
          + (attendanceStatus === 'confirmed_present_missing_routine' ? 12 : 0)
          + (item.completionRate > 0 && item.completionRate < 60 ? 22 : item.completionRate < 75 ? 10 : 0)
          + (item.studyMinutes < 90 ? 16 : item.studyMinutes < 150 ? 6 : 0)
          + penaltyCount * 12
          + penaltyPoints
          + requestCount * 9
        )
      );

      return {
        dateKey: item.dateKey,
        dateLabel: item.dateLabel,
        studyMinutes: item.studyMinutes,
        completionRate: item.completionRate,
        attendanceStatus,
        attendanceLabel,
        appVisits,
        reportReads,
        counselingCount,
        smsCount,
        reportCount,
        penaltyCount,
        penaltyPoints,
        requestCount,
        invoiceCount,
        invoiceAmount,
        guardianTouchCount,
        managementTouchCount,
        riskPulse,
      };
    });
  }, [
    parentActivityRaw,
    studentCounselingLogs,
    smsDeliveryLogs,
    studentDailyReports,
    penaltyLogs,
    attendanceRequests,
    invoices,
    isAdmin,
    fullSeries,
    todayKey,
    attendanceCurrent?.status,
  ]);

  const todayStudyMinutes = focusKpi.todayMinutes;
  const attendanceRate30d = useMemo(() => {
    const trackedDays = operationsTimeline.filter((item) => item.attendanceStatus !== 'requested');
    if (!trackedDays.length) return 0;
    const presentDays = trackedDays.filter((item) =>
      ['confirmed_present', 'confirmed_present_missing_routine', 'confirmed_late'].includes(item.attendanceStatus)
    ).length;
    return Math.round((presentDays / trackedDays.length) * 100);
  }, [operationsTimeline]);

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
      const message = resolveCallableErrorMessage(error, '학생 계정 삭제 중 오류가 발생했습니다.');
      toast({ variant: 'destructive', title: '삭제 실패', description: message });
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
  const detailChartCardClass = cn('overflow-hidden rounded-[1.65rem] border border-slate-200 bg-white', isAnalysisPresentation && 'analysis-chart-stage analysis-chart-stage--warm border-none');
  const detailChartHeaderClass = cn('relative z-10', isMobile ? 'px-4 pt-4 pb-3' : 'px-5 pt-5 pb-4');
  const detailChartContentClass = cn('relative z-10 pt-0', isMobile ? 'px-4 pb-4' : 'px-5 pb-5');
  const detailChartPanelClass = cn(
    'relative rounded-[1.3rem] border bg-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]',
    isMobile ? 'p-3' : 'p-4',
    isAnalysisPresentation ? 'analysis-detail-panel border-none' : 'border-slate-100'
  );
  const detailMetricChipClass = isAnalysisPresentation
    ? 'analysis-metric-chip'
    : 'rounded-[1rem] border border-[#dbe7ff] bg-white/82 px-3 py-2 shadow-[0_14px_30px_-28px_rgba(20,41,95,0.42)]';
  const detailBadgeClass = isAnalysisPresentation
    ? 'analysis-detail-badge'
    : 'rounded-full border-[#dbe7ff] bg-white/84 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#2554d4]';
  const detailInsightBandClass = cn(
    'mt-3 rounded-[1.15rem] px-3.5 py-3',
    isAnalysisPresentation ? 'analysis-signal-band' : 'border border-slate-200 bg-slate-50/85'
  );
  const detailPrimaryTextClass = isAnalysisPresentation ? 'text-[#17326B]' : 'text-[#14295F]';
  const detailSecondaryTextClass = isAnalysisPresentation ? 'text-[#5F7299]' : 'text-[#5c6e97]';
  const analysisWarmBadgeClass = isAnalysisPresentation ? 'analysis-warm-badge' : '';
  const analysisSoftBadgeClass = isAnalysisPresentation ? 'analysis-soft-badge' : '';
  const analysisSubChipClass = isAnalysisPresentation ? 'analysis-subchip' : '';
  const analysisIconBubbleClass = isAnalysisPresentation ? 'analysis-icon-bubble' : '';
  const analysisMeterTrackClass = isAnalysisPresentation ? 'analysis-meter-track' : '';
  const focusKpiCards = [
    {
      key: 'growth',
      label: '오늘 학습 성장률',
      value: formatSignedPercent(focusKpi.todayGrowthPercent),
      helper: '최근 7일 평균 대비',
      note: focusKpi.todayGrowthPercent >= 0 ? '상승 흐름 유지' : '리듬 회복 필요',
      Icon: focusKpi.todayGrowthPercent >= 0 ? TrendingUp : Activity,
      iconClass: focusKpi.todayGrowthPercent >= 0 ? 'text-emerald-600' : 'text-rose-500',
      panelClass: 'border-emerald-100/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.96)_0%,rgba(255,255,255,0.88)_100%)]',
      chipClass: 'text-emerald-700 bg-emerald-100/80',
      meterClass: focusKpi.todayGrowthPercent >= 0 ? 'from-emerald-400 via-emerald-500 to-teal-500' : 'from-rose-300 via-rose-400 to-rose-500',
      meterValue: Math.max(14, Math.min(100, 50 + focusKpi.todayGrowthPercent)),
    },
    {
      key: 'recent',
      label: '최근 7일 평균',
      value: minutesToLabel(focusKpi.recent7AvgMinutes),
      helper: '일 평균 공부시간',
      note: '기준 페이스',
      Icon: Clock3,
      iconClass: 'text-[#2554d4]',
      panelClass: 'border-[#dbe7ff] bg-[linear-gradient(180deg,rgba(241,246,255,0.98)_0%,rgba(255,255,255,0.9)_100%)]',
      chipClass: 'text-[#2554d4] bg-[#e8f0ff]',
      meterClass: 'from-[#8fb6ff] via-[#4f7cff] to-[#2554d4]',
      meterValue: Math.max(12, Math.min(100, Math.round((focusKpi.recent7AvgMinutes / 240) * 100))),
    },
    {
      key: 'completion',
      label: '계획 완수율',
      value: `${focusKpi.completionRate}%`,
      helper: '최근 기간 평균',
      note: focusKpi.completionRate >= 70 ? '실행 안정권' : '실행 루틴 점검',
      Icon: CheckCircle2,
      iconClass: 'text-amber-500',
      panelClass: 'border-amber-100/80 bg-[linear-gradient(180deg,rgba(255,247,237,0.98)_0%,rgba(255,255,255,0.92)_100%)]',
      chipClass: 'text-amber-700 bg-amber-100/80',
      meterClass: 'from-amber-300 via-amber-400 to-[#ff7a16]',
      meterValue: Math.max(12, Math.min(100, focusKpi.completionRate)),
    },
    {
      key: 'rhythm',
      label: '학습 리듬 점수',
      value: `${focusKpi.rhythmScore}점`,
      helper: '공부시간 분산 기반',
      note: focusKpi.rhythmScore >= 70 ? '리듬 안정적' : '흔들림 관리 필요',
      Icon: Activity,
      iconClass: 'text-violet-600',
      panelClass: 'border-violet-100/80 bg-[linear-gradient(180deg,rgba(247,245,255,0.98)_0%,rgba(255,255,255,0.92)_100%)]',
      chipClass: 'text-violet-700 bg-violet-100/80',
      meterClass: 'from-violet-300 via-violet-400 to-violet-500',
      meterValue: Math.max(12, Math.min(100, focusKpi.rhythmScore)),
    },
  ] as const;
  const chartInsightHeadline = chartInsights.weekly.trend;
  const chartInsightSummary = chartInsights.daily.improve;
  const insightHighlights = [
    {
      key: 'weekly',
      label: '주간 학습시간 성장률',
      badge: '대표 인사이트',
      value: chartInsights.weekly.trend,
      detail: chartInsights.weekly.improve,
      accentClass: 'from-[#2f65ff] via-[#4f7cff] to-[#7c9dff]',
      badgeClass: 'border-[#dbe7ff] bg-white/90 text-[#2554d4]',
    },
    {
      key: 'daily',
      label: '일자별 학습시간',
      badge: '오늘 코칭',
      value: chartInsights.daily.trend,
      detail: chartInsights.daily.improve,
      accentClass: 'from-[#ffb36a] via-[#ff9b24] to-[#ff7a16]',
      badgeClass: 'border-[#ffe1c5] bg-white/90 text-[#d86a11]',
    },
  ] as const;
  const insightSupportCards = [
    {
      key: 'rhythm',
      label: '리듬 점수',
      value: chartInsights.rhythm.trend,
      toneClass: 'text-emerald-700',
      bgClass: 'border-emerald-100/80 bg-white/85',
    },
    {
      key: 'startEnd',
      label: '시작/종료 시각',
      value: chartInsights.startEnd.trend,
      toneClass: 'text-[#2554d4]',
      bgClass: 'border-[#dbe7ff] bg-white/85',
    },
    {
      key: 'away',
      label: '외출시간',
      value: chartInsights.away.trend,
      toneClass: 'text-rose-600',
      bgClass: 'border-rose-100/80 bg-white/85',
    },
  ] as const;

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
            <Button variant={isAnalysisPresentation ? 'outline' : 'ghost'} size="icon" className={cn("rounded-full h-10 w-10 shrink-0 mt-1", isAnalysisPresentation && detailActionButtonClass)} asChild>
              <Link href={backHref}><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
          )}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className={cn("font-black tracking-tighter truncate text-3xl sm:text-4xl", isAnalysisPresentation && "text-[#17326B]")}>{student?.name || '학생'}</h1>
              <Badge variant={isAnalysisPresentation ? 'outline' : 'default'} className={cn("px-2 py-0.5 rounded-full font-black text-[10px]", isAnalysisPresentation ? analysisWarmBadgeClass : "bg-primary text-white")}>{formatSeatLabel(student)}</Badge>
              {!isStudentSelfView && (
                <Badge variant={isAnalysisPresentation ? 'outline' : 'outline'} className={cn("font-black text-[10px] rounded-full", isAnalysisPresentation && analysisSoftBadgeClass)}><UserRound className="h-3 w-3 mr-1" /> 학부모/선생님 공유용</Badge>
              )}
            </div>
            <div className={cn("flex flex-wrap items-center gap-2 text-xs font-bold", isAnalysisPresentation ? "text-[#6A7EAA]" : "text-muted-foreground")}>
              <span className={cn("flex items-center gap-1", isAnalysisPresentation ? "text-[#D86A11]" : "text-primary")}><Building2 className="h-3.5 w-3.5" /> {student?.schoolName}</span>
              <span className="opacity-30">|</span><span>{student?.grade}</span><span className="opacity-30">|</span>
              <span className={cn("flex items-center gap-1", isAnalysisPresentation ? "text-[#2E9B73]" : "text-emerald-600")}><LayoutGrid className="h-3 w-3" /> {student?.className || '반 미지정'}</span>
              <span className="opacity-30">|</span><span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> 연속 공부 {studyStreakDays}일</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isStudentSelfView && (
            <Button variant="outline" className={cn("rounded-2xl font-black h-11 px-5 text-xs gap-2", detailActionButtonClass)} asChild>
              <Link href="/dashboard/attendance"><CalendarDays className="h-4 w-4" /> 출결 상태</Link>
            </Button>
          )}
          {canWriteCounseling && <Button variant="outline" className={cn("rounded-2xl font-black h-11 px-5 text-xs gap-2", detailActionButtonClass)} onClick={() => setIsReservationModalOpen(true)}><CalendarCheck2 className="h-4 w-4" /> 상담 예약</Button>}
          {canWriteCounseling && <Button variant="outline" className={cn("rounded-2xl font-black h-11 px-5 text-xs gap-2", detailActionButtonClass)} onClick={() => setIsLogModalOpen(true)}><ClipboardList className="h-4 w-4" /> 상담 일지 작성</Button>}
          {canWriteCounseling && <Button variant="outline" className={cn("rounded-2xl font-black h-11 px-5 text-xs gap-2", detailActionButtonClass)} onClick={() => setIsQuickFeedbackModalOpen(true)}><MessageSquareMore className="h-4 w-4" /> 한 줄 피드백</Button>}
          {!isStudentSelfView && (
            <Button variant="outline" className={cn("rounded-2xl font-black h-11 px-5 text-xs gap-2", detailActionButtonClass)} asChild>
              <Link href="/dashboard/reports"><PenTool className="h-4 w-4" /> 리포트 생성/확인</Link>
            </Button>
          )}
          {!isStudentSelfView && (
            <Button variant="outline" className={cn("rounded-2xl font-black h-11 px-5 text-xs gap-2", detailActionButtonClass)} asChild>
              <Link href="/dashboard/settings/notifications"><MessageSquare className="h-4 w-4" /> 문자 보내기</Link>
            </Button>
          )}
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

      {!isStudentSelfView ? (
        <section className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[1.15fr_0.95fr]')}>
          <Card className={cn('rounded-[2rem] border-none shadow-lg bg-white', isAnalysisPresentation && 'analysis-premium-card surface-card surface-card--secondary on-dark rounded-[2rem] shadow-none')}>
            <CardHeader className={cn(isMobile ? 'px-4 pt-4 pb-3' : 'px-5 pt-5 pb-4')}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className={cn("text-xl font-black tracking-tight", detailPrimaryTextClass)}>오늘 액션 체크리스트</CardTitle>
                  <CardDescription className={cn("mt-1 text-[11px] font-semibold leading-5", detailSecondaryTextClass)}>
                    COO 관점에서 지금 바로 처리할 행동만 먼저 모았습니다.
                  </CardDescription>
                </div>
                <Badge variant={isAnalysisPresentation ? 'outline' : 'default'} className={cn("rounded-full px-3 py-1 text-[10px] font-black", isAnalysisPresentation ? analysisWarmBadgeClass : "bg-[#14295F] text-white")}>
                  {todayActionChecklist.length}개 액션
                </Badge>
              </div>
            </CardHeader>
            <CardContent className={cn('space-y-3', isMobile ? 'px-4 pb-4' : 'px-5 pb-5')}>
              {todayActionChecklist.length === 0 ? (
                <div className={cn(
                  "rounded-[1.2rem] border px-4 py-4 text-sm font-bold",
                  isAnalysisPresentation
                    ? "surface-card surface-card--ghost on-dark border-emerald-400/18 text-emerald-200 shadow-none"
                    : "border-emerald-100 bg-emerald-50/70 text-emerald-700"
                )}>
                  오늘 바로 처리해야 할 주요 액션은 없습니다. 유지 전략 중심으로 운영해도 좋습니다.
                </div>
              ) : (
                todayActionChecklist.map((item, index) => (
                  <div
                    key={item.key}
                    className={cn(
                      "rounded-[1.25rem] border px-4 py-4",
                      isAnalysisPresentation
                        ? "surface-card surface-card--ghost on-dark border-white/10 shadow-none"
                        : "border-slate-100 bg-slate-50/70"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge className={cn('rounded-full px-2.5 py-1 text-[10px] font-black', isAnalysisPresentation ? analysisWarmBadgeClass : item.accent)}>
                            액션 {index + 1}
                          </Badge>
                          <p className={cn("text-sm font-black", detailPrimaryTextClass)}>{item.title}</p>
                        </div>
                        <p className={cn("mt-2 text-[12px] font-semibold leading-5", isAnalysisPresentation ? "text-[var(--text-on-dark-soft)]" : "text-slate-600")}>{item.detail}</p>
                      </div>
                      <Button asChild size="sm" variant={isAnalysisPresentation ? 'outline' : 'outline'} className={cn("h-8 rounded-lg px-3 text-[11px] font-black", isAnalysisPresentation && detailActionButtonClass)}>
                        <Link href={item.href}>바로 이동</Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {isAdmin ? (
            <Card className={cn('rounded-[2rem] border-none shadow-lg bg-white', isAnalysisPresentation && 'analysis-premium-card surface-card surface-card--secondary on-dark rounded-[2rem] shadow-none')}>
              <CardHeader className={cn(isMobile ? 'px-4 pt-4 pb-3' : 'px-5 pt-5 pb-4')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className={cn("text-xl font-black tracking-tight", detailPrimaryTextClass)}>운영 비용 신호</CardTitle>
                    <CardDescription className={cn("mt-1 text-[11px] font-semibold leading-5", detailSecondaryTextClass)}>
                      문자, 상담, 리포트, 출결, 수납까지 운영 투입 신호를 한 번에 봅니다.
                    </CardDescription>
                  </div>
                  <Badge variant={isAnalysisPresentation ? 'outline' : 'outline'} className={cn("rounded-full px-3 py-1 text-[10px] font-black", isAnalysisPresentation && analysisSoftBadgeClass)}>
                    최근 30일
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className={cn('grid gap-3', isMobile ? 'px-4 pb-4' : 'px-5 pb-5')}>
                {operatingCostSignals.map((signal) => (
                  <div
                    key={signal.key}
                    className={cn(
                      'rounded-[1.2rem] border px-4 py-3',
                      isAnalysisPresentation
                        ? 'surface-card surface-card--ghost on-dark border-white/10 shadow-none'
                        : signal.tone
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className={cn("text-[11px] font-black tracking-[0.12em] uppercase", isAnalysisPresentation && "text-[var(--text-on-dark-muted)]")}>{signal.title}</p>
                      <p className={cn(
                        "text-lg font-black tracking-tight",
                        isAnalysisPresentation && (signal.key === 'sms'
                          ? 'text-sky-300'
                          : signal.key === 'counseling'
                            ? 'text-[#ffd7b4]'
                            : signal.key === 'report'
                              ? 'text-violet-300'
                              : signal.key === 'attendance'
                                ? 'text-rose-300'
                                : 'text-emerald-300')
                      )}>{signal.value}</p>
                    </div>
                    <p className={cn("mt-1 text-[12px] font-semibold leading-5", isAnalysisPresentation ? "text-[var(--text-on-dark-soft)]" : "text-slate-600")}>{signal.helper}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="space-y-6 min-w-0">
        <TabsList className={detailTabListClass}>
          <TabsTrigger value="overview" className={detailTabTriggerClass}><BarChart3 className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{isAnalysisPresentation ? '학습 분석' : '운영 그래프'}</span></TabsTrigger>
          <TabsTrigger value="counseling" className={detailTabTriggerClass}><MessageSquare className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">상담 기록</span></TabsTrigger>
          <TabsTrigger value="plans" className={cn(detailTabTriggerClass, isMobile && "col-span-2")}><BookOpen className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">계획/루틴</span></TabsTrigger>
        </TabsList>

        <TabsContent
          value="overview"
          className={cn(
            "space-y-6 mt-0",
            isAnalysisPresentation && "analysis-overview-canvas rounded-[2rem] px-4 py-4 sm:px-5 sm:py-5"
          )}
        >
          {isAnalysisPresentation ? (
            <>
              <Card className="analysis-premium-card surface-card surface-card--secondary on-dark overflow-hidden rounded-[1.85rem] border-none shadow-none">
                <CardHeader className={cn("relative z-10", isMobile ? "px-4 pt-4 pb-3" : "px-5 pt-5 pb-4")}>
                  <div className={cn(isMobile ? "flex flex-col items-stretch gap-3" : "flex items-start justify-between gap-3")}>
                    <div className="min-w-0">
                      <Badge variant={isAnalysisPresentation ? 'outline' : 'dark'} className={cn("px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] shadow-none", isAnalysisPresentation && analysisSoftBadgeClass)}>
                        Focus Board
                      </Badge>
                      <CardTitle className={cn(
                        "mt-3 break-keep text-[clamp(1rem,1.5vw,1.18rem)] font-black tracking-tight",
                        isAnalysisPresentation ? "text-[#17326B]" : "text-[var(--text-on-dark)]"
                      )}>
                        개인 집중도 KPI
                      </CardTitle>
                      <CardDescription className={cn(
                        "mt-1 text-[11px] font-semibold leading-5",
                        isAnalysisPresentation ? "text-[#5F7299]" : "text-[var(--text-on-dark-soft)]"
                      )}>
                        학생 분석트랙에서 개인 집중 지표를 빠르게 확인합니다.
                      </CardDescription>
                    </div>
                    <div className={cn(
                      "surface-card surface-card--ghost on-dark rounded-[1.15rem] border border-white/10 shadow-none",
                      isMobile ? "flex items-center justify-between gap-3 px-3.5 py-2.5 text-left" : "px-3 py-2 text-right"
                    )}>
                      <p className={cn(
                        "text-[10px] font-black uppercase tracking-[0.2em]",
                        isAnalysisPresentation ? "text-[#6A7EA7]" : "text-[var(--text-on-dark-muted)]"
                      )}>
                        오늘 포커스
                      </p>
                      <p className={cn("font-black text-[#D86A11]", isMobile ? "text-base whitespace-nowrap" : "mt-1 text-sm")}>
                        {focusKpi.todayGrowthPercent >= 0 ? '상승세' : '리듬 조정'}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className={cn("relative z-10 pt-0", isMobile ? "px-4 pb-4" : "px-5 pb-5")}>
                  <div
                    className={cn(
                      isMobile && "overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    )}
                  >
                    <div className={cn("gap-3", isMobile ? "flex min-w-max" : "grid sm:grid-cols-2 xl:grid-cols-4")}>
                      {focusKpiCards.map(({ key, label, value, helper, note, Icon, iconClass, panelClass, chipClass, meterClass, meterValue }) => (
                        <div
                          key={key}
                          className={cn(
                            "min-w-0 overflow-hidden rounded-[1.35rem] border px-4 py-4",
                            isMobile && "w-[13.5rem] shrink-0",
                            isAnalysisPresentation ? "surface-card surface-card--ghost on-dark border-white/10 shadow-none" : panelClass
                          )}
                        >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <span className={cn(
                              "inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]",
                              isAnalysisPresentation ? analysisSubChipClass : chipClass,
                              isMobile && "max-w-[calc(100%-3.5rem)] whitespace-normal leading-4"
                            )}>
                              {label}
                            </span>
                            <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] shadow-none", isAnalysisPresentation ? analysisIconBubbleClass : "border border-white/12 bg-white/10")}>
                              <Icon className={cn("h-5 w-5", iconClass)} />
                            </div>
                          </div>
                        </div>
                        <p className={cn(
                          "mt-3 break-keep font-black tracking-tight",
                          isAnalysisPresentation ? "text-[#17326B]" : "text-[var(--text-on-dark)]",
                          isMobile ? "text-[clamp(2rem,8vw,2.55rem)] leading-[0.95] whitespace-nowrap" : "text-[clamp(1.25rem,3.2vw,1.8rem)]"
                        )}>
                          {value}
                        </p>
                        <div className="mt-3 space-y-1.5">
                          <p className={cn(
                            "text-[11px] font-semibold leading-5 break-keep",
                            isAnalysisPresentation ? "text-[#5F7299]" : "text-[var(--text-on-dark-soft)]"
                          )}>
                            {helper}
                          </p>
                          <p className="text-[11px] font-black break-keep text-[var(--accent-orange-soft)]">{note}</p>
                        </div>
                        <div className={cn("mt-4 h-1.5 overflow-hidden rounded-full", isAnalysisPresentation ? analysisMeterTrackClass : "bg-white/12")}>
                          <div className={cn("h-full rounded-full bg-gradient-to-r", meterClass)} style={{ width: `${meterValue}%` }} />
                        </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="analysis-premium-card surface-card surface-card--primary on-dark overflow-hidden rounded-[1.85rem] border-none shadow-none">
                <CardHeader className={cn("relative z-10", isMobile ? "px-4 pt-4 pb-3" : "px-5 pt-5 pb-4")}>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[var(--accent-orange)]" />
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--accent-orange-soft)]">AI 그래프 인사이트 요약</p>
                    </div>
                    <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-[minmax(0,1.25fr)_auto] items-start")}>
                      <div className="min-w-0">
                        <CardTitle className={cn(
                          "break-keep text-[clamp(1rem,1.5vw,1.2rem)] font-black tracking-tight",
                          isAnalysisPresentation ? "text-[#17326B]" : "text-[var(--text-on-dark)]"
                        )}>
                          {chartInsightHeadline}
                        </CardTitle>
                        <CardDescription className={cn(
                          "mt-2 text-[11px] font-semibold leading-5",
                          isAnalysisPresentation ? "text-[#5F7299]" : "text-[var(--text-on-dark-soft)]"
                        )}>
                          {chartInsightSummary}
                        </CardDescription>
                      </div>
                      <Badge variant={isAnalysisPresentation ? 'outline' : 'secondary'} className={cn("w-fit px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] shadow-none", isAnalysisPresentation && analysisWarmBadgeClass)}>
                        Coach Board
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className={cn("relative z-10 space-y-3 pt-0", isMobile ? "px-4 pb-4" : "px-5 pb-5")}>
                  <div
                    className={cn(
                      isMobile && "overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    )}
                  >
                    <div className={cn("gap-3", isMobile ? "flex min-w-max" : "grid lg:grid-cols-2")}>
                      {insightHighlights.map(({ key, label, badge, value, detail, accentClass }) => (
                        <div
                          key={key}
                          className={cn(
                            "surface-card surface-card--ghost on-dark overflow-hidden rounded-[1.35rem] border border-white/10 p-4 shadow-none",
                            isMobile && "w-[14rem] shrink-0"
                          )}
                        >
                        <div className="flex items-center justify-between gap-3">
                          <Badge variant="outline" className={cn("px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] shadow-none", key === 'daily' ? analysisWarmBadgeClass : analysisSoftBadgeClass)}>
                            {badge}
                          </Badge>
                          <div className={cn("h-2 w-14 rounded-full bg-gradient-to-r", accentClass)} />
                        </div>
                        <p className={cn(
                          "mt-3 text-[10px] font-black uppercase tracking-[0.18em]",
                          isAnalysisPresentation ? "text-[#6A7EA7]" : "text-[var(--text-on-dark-muted)]"
                        )}>
                          {label}
                        </p>
                        <p className={cn(
                          "mt-2 break-keep text-sm font-black leading-6",
                          isAnalysisPresentation ? "text-[#17326B]" : "text-[var(--text-on-dark)]"
                        )}>
                          {value}
                        </p>
                        <p className={cn(
                          "mt-2 text-[12px] font-semibold leading-5",
                          isAnalysisPresentation ? "text-[#5F7299]" : "text-[var(--text-on-dark-soft)]"
                        )}>
                          {detail}
                        </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "md:grid-cols-3")}>
                    {insightSupportCards.map(({ key, label, value, toneClass }) => (
                      <div key={key} className="surface-card surface-card--ghost on-dark rounded-[1.2rem] border border-white/10 px-3.5 py-3 shadow-none">
                        <p className={cn(
                          "text-[10px] font-black uppercase tracking-[0.18em]",
                          isAnalysisPresentation ? "text-[#6A7EA7]" : "text-[var(--text-on-dark-muted)]"
                        )}>
                          {label}
                        </p>
                        <p className={cn("mt-2 break-keep text-[12px] font-black leading-5", toneClass)}>{value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
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

              <Card className="rounded-[1.5rem] border border-[#dbe7ff] bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)]">
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
            </>
          )}

          {isAdmin ? (
            <>
              <Card className={cn(
                "rounded-[1.5rem] border border-[#dbe7ff] bg-[linear-gradient(180deg,#ffffff_0%,#f6f9ff_100%)] shadow-lg",
                isAnalysisPresentation && "analysis-premium-card surface-card surface-card--secondary on-dark border-none shadow-none"
              )}>
                <CardHeader className="pb-3">
                  <CardTitle className={cn("flex items-center gap-2 text-base font-black tracking-tight", detailPrimaryTextClass)}>
                    <ClipboardList className={cn("h-4 w-4", isAnalysisPresentation ? "text-[var(--accent-orange)]" : "text-[#2554d4]")} />
                    관리 증빙 요약
                  </CardTitle>
                  <CardDescription className={cn("font-bold text-[11px]", detailSecondaryTextClass)}>
                    보호자 상담 시 바로 보여줄 수 있도록, 최근 30일 관리 흐름을 한 문장과 핵심 수치로 먼저 정리했습니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
                    <div className={cn("rounded-xl border p-4", isAnalysisPresentation ? "surface-card surface-card--ghost on-dark border-white/10 shadow-none" : "border-[#dbe7ff] bg-white/90")}>
                      <p className={cn("text-[10px] font-black uppercase tracking-[0.22em]", isAnalysisPresentation ? "text-[var(--text-on-dark-muted)]" : "text-[#2554d4]")}>학습 관리</p>
                      <p className={cn("mt-2 text-lg font-black", detailPrimaryTextClass)}>{minutesToLabel(todayStudyMinutes)}</p>
                      <p className={cn("mt-1 text-xs font-bold", detailSecondaryTextClass)}>최근 7일 평균 {minutesToLabel(avgStudyMinutes)} · 완료율 {avgCompletionRate}%</p>
                    </div>
                    <div className={cn("rounded-xl border p-4", isAnalysisPresentation ? "surface-card surface-card--ghost on-dark border-white/10 shadow-none" : "border-[#dbe7ff] bg-white/90")}>
                      <p className={cn("text-[10px] font-black uppercase tracking-[0.22em]", isAnalysisPresentation ? "text-[var(--text-on-dark-muted)]" : "text-[#2554d4]")}>출결 관리</p>
                      <p className={cn("mt-2 text-lg font-black", detailPrimaryTextClass)}>{attendanceRate30d}%</p>
                      <p className={cn("mt-1 text-xs font-bold", detailSecondaryTextClass)}>
                        최근 30일 출석률 · 벌점 {Math.max(0, Math.round(Number(progress?.penaltyPoints || 0)))}점 · 외출 {awayTimeData.filter((item) => item.awayMinutes > 0).length}회
                      </p>
                    </div>
                    <div className={cn("rounded-xl border p-4", isAnalysisPresentation ? "surface-card surface-card--ghost on-dark border-white/10 shadow-none" : "border-[#dbe7ff] bg-white/90")}>
                      <p className={cn("text-[10px] font-black uppercase tracking-[0.22em]", isAnalysisPresentation ? "text-[var(--text-on-dark-muted)]" : "text-[#2554d4]")}>소통 관리</p>
                      <p className={cn("mt-2 text-lg font-black", detailPrimaryTextClass)}>{counselingCount30d + reportSentCount30d + smsAcceptedCount30d}회</p>
                      <p className={cn("mt-1 text-xs font-bold", detailSecondaryTextClass)}>상담 {counselingCount30d} · 리포트 {reportSentCount30d} · 문자 {smsAcceptedCount30d}</p>
                    </div>
                  </div>
                  <div className={cn("rounded-xl border px-4 py-3", isAnalysisPresentation ? "surface-card surface-card--ghost on-dark border-white/10 shadow-none" : "border-[#dbe7ff] bg-[#eef4ff]")}>
                    <p className={cn("text-sm font-black leading-6", detailPrimaryTextClass)}>
                      최근 30일 동안 학습, 출결, 상담/문자/리포트 기록을 함께 관리하고 있으며, 보호자 반응은 앱 방문 {parentVisitCount30d}회 · 리포트 열람 {reportReadCount30d}회로 추적 중입니다.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <StudentOperationsGraphBoard
                timeline={operationsTimeline}
                isAdmin={isAdmin}
                isMobile={isMobile}
                className={isAnalysisPresentation ? 'analysis-chart-stage' : undefined}
              />
            </>
          ) : null}

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

                <Card className={cn("rounded-[1.5rem] overflow-hidden border-none shadow-lg bg-white", isAnalysisPresentation && "analysis-chart-stage")}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-black tracking-tight flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-500" /> 위험 신호 및 지원 우선순위</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className={cn(
                      "rounded-xl border px-4 py-3",
                      isAnalysisPresentation ? "border-[#dbe7ff] bg-white/92 shadow-[0_16px_28px_-24px_rgba(20,41,95,0.16)]" : "border-slate-200 bg-slate-50"
                    )}>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2554d4]">전체분석 요약</p>
                      <p className="mt-1 text-sm font-black leading-6 text-[#14295F]">{chartInsightHeadline}</p>
                      <p className="mt-1 text-[12px] font-semibold leading-5 text-[#5c6e97]">
                        최근 {RANGE_MAP[focusedChartView]}일 평균 {minutesToLabel(avgStudyMinutes)} · 완료율 {avgCompletionRate}% · 리듬 점수 {rhythmScore}점
                      </p>
                    </div>
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

              <Card className={cn("rounded-[2rem] overflow-hidden border-none shadow-lg bg-white", isAnalysisPresentation && "analysis-chart-stage")}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-500" /> 위험 신호 및 지원 우선순위</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2554d4]">전체분석 요약</p>
                    <p className="mt-1 text-sm font-black leading-6 text-[#14295F]">{chartInsightHeadline}</p>
                    <p className="mt-1 text-[12px] font-semibold leading-5 text-[#5c6e97]">
                      최근 {RANGE_MAP[focusedChartView]}일 평균 {minutesToLabel(avgStudyMinutes)} · 완료율 {avgCompletionRate}% · 리듬 점수 {rhythmScore}점
                    </p>
                  </div>
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
                        <Badge className={cn(
                          "font-black text-[10px] rounded-full",
                          isAnalysisPresentation
                            ? "border border-[#F1DDC7] bg-[#FFF4E5] text-[#17326B] shadow-none"
                            : "bg-primary text-white"
                        )}>{log.type === 'academic' ? '학습 상담' : log.type === 'life' ? '생활 상담' : '진로 상담'}</Badge>
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
          <div className={cn(
            "px-6 py-5",
            isAnalysisPresentation
              ? "bg-[linear-gradient(135deg,#FFF8EE_0%,#FFEBCF_100%)] text-[#17326B]"
              : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
          )}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">과거 7일 학습세션</DialogTitle>
              <DialogDescription className={cn("font-semibold", isAnalysisPresentation ? "text-[#5F7299]" : "text-white/80")}>
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
          <div className={cn(
            "px-6 py-5",
            isAnalysisPresentation
              ? "bg-[linear-gradient(135deg,#FFF8EE_0%,#FFE5C4_100%)] text-[#17326B]"
              : "bg-gradient-to-r from-[#0f2359] to-[#1d3f8c] text-white"
          )}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">평균 공부 리듬 그래프</DialogTitle>
              <DialogDescription className={cn("font-semibold", isAnalysisPresentation ? "text-[#5F7299]" : "text-white/80")}>
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
          <div className={cn(
            "p-10 relative shrink-0",
            isAnalysisPresentation
              ? "bg-[linear-gradient(135deg,#FFF8EE_0%,#FFE3BF_100%)] text-[#17326B]"
              : "bg-purple-600 text-white"
          )}>
            <Zap className="absolute top-0 right-0 p-8 h-32 w-32 opacity-20 rotate-12" />
            <DialogHeader>
              <div className="flex justify-between items-center">
                <Badge className={cn(
                  "border-none font-black text-[10px] px-2.5 py-0.5 uppercase tracking-widest whitespace-nowrap",
                  isAnalysisPresentation ? "bg-[#FFF1DE] text-[#17326B]" : "bg-white/20 text-white"
                )}>성장 지표 관리</Badge>
                {!isEditStats && canEditGrowthData && <Button variant="ghost" size="sm" onClick={() => setIsEditStats(true)} className={cn(
                  "gap-2 h-8 rounded-lg font-black text-xs",
                  isAnalysisPresentation ? "text-[#17326B] hover:bg-[#17326B]/5" : "text-white hover:bg-white/10"
                )}><Settings2 className="h-3.5 w-3.5" /> 수동 보정</Button>}
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
          <div className={cn(
            "p-10",
            isAnalysisPresentation
              ? "bg-[linear-gradient(135deg,#FFF8EE_0%,#FFE7CB_100%)] text-[#17326B]"
              : "bg-primary text-white"
          )}><DialogTitle className="text-3xl font-black tracking-tighter">프로필 수정</DialogTitle></div>
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

    </div>
  );
}

