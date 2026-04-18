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
import { Loader2, ArrowLeft, Building2, Zap, Settings2, Activity, CheckCircle2, ShieldCheck, LayoutGrid, Save, Trash2, CalendarDays, BarChart3, MessageSquare, Clock3, PlusCircle, UserRound, AlertTriangle, Sparkles, ClipboardList, Timer, CalendarCheck2, TrendingUp, BookOpen, MessageSquareMore, PenTool } from 'lucide-react';
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
import StudentAnalysisOverviewSection from '@/components/dashboard/student-analysis-overview-section';
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
  buildStudentFullAnalysisSummary,
  buildRhythmInsight,
  buildStartEndInsight,
  buildWeeklyStudyInsight,
} from '@/lib/learning-insights';
import { EMPTY_STUDENT_RANKING_SNAPSHOT, fetchStudentRankingSnapshot, type StudentRankEntry, type StudentRankingSnapshot } from '@/lib/student-ranking-client';
import { canManageSettings, canManageStaff, canReadFinance } from '@/lib/dashboard-access';
import { type StudentOperationsTimelinePoint } from '@/components/dashboard/student-operations-graph-board';
import { useStudentDetailPresentationMode, type DetailPresentationMode } from '@/components/dashboard/student-detail-presentation-mode';
import { motion, useReducedMotion } from 'framer-motion';

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

function normalizePhoneNumber(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).replace(/\D/g, '').slice(0, 11);
}

function isValidKoreanMobilePhone(value: string): boolean {
  return /^01\d{8,9}$/.test(value);
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

function buildRelativeRanking(entries: StudentRankEntry[], studentId: string) {
  if (!entries.length) return null;
  const sortedEntries = [...entries].sort((left, right) => {
    if (right.value !== left.value) return right.value - left.value;
    return left.displayNameSnapshot.localeCompare(right.displayNameSnapshot, 'ko');
  });
  const targetIndex = sortedEntries.findIndex((entry) => entry.studentId === studentId);
  if (targetIndex < 0) return null;

  return {
    rank: targetIndex + 1,
    total: sortedEntries.length,
    value: Math.max(0, Math.round(sortedEntries[targetIndex]?.value || 0)),
  };
}

function toTopPercent(rank: number | null, total: number | null): number | null {
  if (typeof rank !== 'number' || typeof total !== 'number' || total <= 0) return null;
  return Math.max(1, Math.round((rank / total) * 100));
}

const CustomTooltip = ({ active, payload, label, unit = '분', presentationMode = 'default' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={cn(
        presentationMode === 'student-analysis'
          ? 'analysis-card rounded-[1.15rem] border-none px-4 py-3 shadow-[0_22px_36px_-28px_rgba(20,41,95,0.46)]'
          : 'bg-white/95 backdrop-blur-xl border-2 border-primary/10 p-4 rounded-2xl shadow-xl ring-1 ring-black/5'
      )}>
        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#5c6e97]">{label}</p>
        <div className="flex items-baseline gap-1.5"><span className="text-2xl font-black text-[#14295F]">{payload[0].value}</span><span className="text-xs font-black text-[#7b8db3]">{unit}</span></div>
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
  compactTitle,
  compactSubValue,
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
  compactTitle?: string;
  compactSubValue?: string;
  icon: any;
  colorClass: string;
  isMobile: boolean;
  onClick?: () => void;
  presentationMode?: DetailPresentationMode;
  progress?: number;
}) {
  const tone = getPresentationTone(colorClass);
  const isCompactAnalysisKpi = presentationMode === 'student-analysis' && isMobile;
  const displayedTitle = isCompactAnalysisKpi ? compactTitle ?? title : title;
  const displayedSubValue = isCompactAnalysisKpi ? compactSubValue ?? subValue : subValue;
  const displayedValue = isCompactAnalysisKpi ? value.replace(/\s+/g, '\n') : value;

  if (presentationMode === 'student-analysis') {
    return (
      <Card
        className={cn(
          'analysis-premium-card analysis-full-kpi-card surface-card surface-card--secondary on-dark min-w-0 h-full overflow-hidden border-none font-aggro-display transition-all',
          isCompactAnalysisKpi ? 'analysis-full-kpi-card--compact rounded-[1.2rem]' : 'rounded-[1.5rem]',
          onClick && 'cursor-pointer active:scale-[0.985]'
        )}
        onClick={onClick}
      >
        <div className={cn('analysis-kpi-card-glow-primary pointer-events-none absolute inset-x-0 top-0 bg-[radial-gradient(circle_at_top_left,rgba(126,164,255,0.18),transparent_68%)]', isCompactAnalysisKpi ? 'h-14' : 'h-20')} />
        <div className={cn('analysis-kpi-card-glow-secondary pointer-events-none absolute rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.8)_0%,rgba(255,255,255,0)_72%)] opacity-70 blur-2xl', isCompactAnalysisKpi ? 'right-2 top-2 h-10 w-10' : 'right-3 top-3 h-16 w-16')} />
        <CardHeader className={cn('analysis-kpi-card-header relative z-10 pb-2 flex items-start justify-between', isCompactAnalysisKpi ? 'gap-1.5 px-2.5 pt-2.5' : isMobile ? 'gap-2 px-4 pt-4 flex-row' : 'px-5 pt-5 flex-row')}>
          <div className="min-w-0">
            <div
              className={cn(
                'analysis-kpi-card-label inline-flex max-w-full items-center rounded-full border px-2.5 py-1 font-black break-keep',
                tone.chip,
                isCompactAnalysisKpi
                  ? 'font-aggro-display px-1.5 py-0.5 text-[8px] leading-[1.1] tracking-[-0.03em]'
                  : isMobile
                    ? 'text-[10px] leading-4 tracking-[0.08em]'
                    : 'text-[10px] uppercase tracking-[0.18em]'
              )}
            >
              {displayedTitle}
            </div>
            <div className={cn('analysis-kpi-card-value dashboard-number font-aggro-display font-black tracking-tight break-keep text-[#17326B]', isCompactAnalysisKpi ? 'mt-2 whitespace-pre-line text-[0.95rem] leading-[0.95]' : isMobile ? 'mt-3 text-[1.9rem] leading-[0.92]' : 'mt-3 text-[1.85rem]')}>
              {displayedValue}
            </div>
            <p className={cn('analysis-kpi-card-subvalue font-aggro-display break-keep text-[#3E5488]', isCompactAnalysisKpi ? 'mt-1 text-[8px] font-bold leading-[1.28] tracking-[-0.02em]' : isMobile ? 'mt-1 text-[10px] font-semibold leading-5' : 'mt-1 text-[11px] font-semibold leading-5')}>
              {displayedSubValue}
            </p>
          </div>
          <div className={cn('analysis-kpi-card-icon flex shrink-0 items-center justify-center shadow-none', isCompactAnalysisKpi ? 'h-8 w-8 rounded-[0.9rem]' : 'rounded-[1rem] px-3 py-2')}>
            <Icon className={cn(isCompactAnalysisKpi ? 'h-3 w-3' : isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', tone.text)} />
          </div>
        </CardHeader>
        <CardContent className={cn('analysis-kpi-card-content relative z-10', isCompactAnalysisKpi ? 'px-2.5 pb-2.5 pt-0' : isMobile ? 'px-4 pb-4 pt-0' : 'px-5 pb-5 pt-0')}>
          <div className="analysis-kpi-track">
            <span className={cn('bg-gradient-to-r', tone.bar)} style={{ width: `${Math.max(0, Math.min(100, Math.round(progress)))}%` }} />
          </div>
          <div className={cn('analysis-kpi-card-meta-row flex items-center gap-2', isCompactAnalysisKpi ? 'mt-1 justify-end' : 'mt-2 justify-between')}>
            {!isCompactAnalysisKpi ? <span className="analysis-kpi-card-meta analysis-kpi-card-meta-label text-[10px] font-black uppercase tracking-[0.16em] text-[#4B6397]">Insight Rail</span> : null}
            <span className={cn('analysis-kpi-card-progress font-black', isCompactAnalysisKpi ? 'font-aggro-display text-[8px] tracking-[-0.03em]' : 'text-[10px]', tone.text)}>{Math.max(0, Math.min(100, Math.round(progress)))}%</span>
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
  const prefersReducedMotion = useReducedMotion();
  const centerId = activeMembership?.id;
  const today = new Date();
  const todayKey = format(today, 'yyyy-MM-dd');
  const periodKey = format(today, 'yyyy-MM');

  const isStudentSelfView = activeMembership?.role === 'student';
  const canManageStudentAccounts = !isStudentSelfView && canManageStaff(activeMembership?.role);
  const canViewFinance = !isStudentSelfView && canReadFinance(activeMembership?.role);
  const canOpenSettings = !isStudentSelfView && canManageSettings(activeMembership?.role);
  const canEditStudentInfo = !isStudentSelfView && (canManageStudentAccounts || activeMembership?.role === 'teacher');
  const canEditGrowthData = canManageStudentAccounts;
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
  const [rankingSnapshot, setRankingSnapshot] = useState<StudentRankingSnapshot>(EMPTY_STUDENT_RANKING_SNAPSHOT);
  const [rankingLoading, setRankingLoading] = useState(false);

  const hasInitializedForm = useRef(false);
  const [editForm, setEditForm] = useState({
    name: '',
    schoolName: '',
    grade: '',
    password: '',
    phoneNumber: '',
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
    () => (!firestore || !centerId || !canViewFinance ? null : query(collection(firestore, 'centers', centerId, 'invoices'), where('studentId', '==', studentId), limit(120))),
    [firestore, centerId, studentId, canViewFinance]
  );
  const { data: invoicesRaw } = useCollection<Invoice>(invoicesQuery, { enabled: !!centerId && canViewFinance });

  const availableClasses = useMemo(() => {
    const classes = new Set<string>();
    centerStudents?.forEach((member) => {
      if (member.className) classes.add(member.className);
    });
    if (student?.className) classes.add(student.className);
    return Array.from(classes).sort();
  }, [centerStudents, student?.className]);

  const currentStudentMember = useMemo(
    () => centerStudents?.find((member) => member.id === studentId) || null,
    [centerStudents, studentId]
  );

  const currentStudentMemberStatus = useMemo<'active' | 'onHold' | 'withdrawn'>(() => {
    const raw = currentStudentMember?.status;
    if (raw === 'onHold') return 'onHold';
    if (raw === 'withdrawn') return 'withdrawn';
    return 'active';
  }, [currentStudentMember?.status]);

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
        phoneNumber: normalizePhoneNumber(student.phoneNumber || currentStudentMember?.phoneNumber || ''),
        parentLinkCode: normalizeParentLinkCode(student.parentLinkCode),
        className: student.className || '',
        memberStatus: currentStudentMemberStatus,
      });
      hasInitializedForm.current = true;
    }
  }, [student, currentStudentMember?.phoneNumber, currentStudentMemberStatus]);

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

  useEffect(() => {
    let cancelled = false;

    const fetchRankingSnapshot = async () => {
      if (!isAnalysisPresentation || !centerId || !currentUser) {
        setRankingSnapshot(EMPTY_STUDENT_RANKING_SNAPSHOT);
        setRankingLoading(false);
        return;
      }

      setRankingLoading(true);
      try {
        const snapshot = await fetchStudentRankingSnapshot({ centerId, user: currentUser });
        if (cancelled) return;
        setRankingSnapshot(snapshot);
      } catch (error) {
        console.error('[Student Detail] Failed to load ranking snapshot:', error);
        if (!cancelled) {
          setRankingSnapshot(EMPTY_STUDENT_RANKING_SNAPSHOT);
        }
      } finally {
        if (!cancelled) setRankingLoading(false);
      }
    };

    fetchRankingSnapshot();
    return () => {
      cancelled = true;
    };
  }, [centerId, currentUser, isAnalysisPresentation]);

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

  const currentClassName = useMemo(() => {
    const membershipClass = centerStudents?.find((member) => member.id === studentId)?.className;
    return student?.className || membershipClass || null;
  }, [centerStudents, student?.className, studentId]);

  const recent14Series = useMemo(() => fullSeries.slice(-14), [fullSeries]);
  const recent14BlankDays = useMemo(
    () => recent14Series.filter((item) => Math.max(0, Math.round(item.studyMinutes || 0)) === 0).length,
    [recent14Series]
  );
  const recent14StudyDays = useMemo(
    () => recent14Series.filter((item) => Math.max(0, Math.round(item.studyMinutes || 0)) > 0).length,
    [recent14Series]
  );

  const centerRankingSummary = useMemo(
    () => buildRelativeRanking(rankingSnapshot.weekly, studentId),
    [rankingSnapshot.weekly, studentId]
  );
  const classRankingSummary = useMemo(() => {
    if (!currentClassName) return null;
    const sameClassEntries = rankingSnapshot.weekly.filter((entry) => entry.classNameSnapshot === currentClassName);
    if (sameClassEntries.length < 5) return null;
    return buildRelativeRanking(sameClassEntries, studentId);
  }, [rankingSnapshot.weekly, currentClassName, studentId]);
  const studentFullAnalysisSummary = useMemo(() => {
    const weeklyMinutes = centerRankingSummary?.value ?? weeklyGrowthData[weeklyGrowthData.length - 1]?.totalMinutes ?? 0;
    const hasEnoughComparisonData =
      !rankingLoading &&
      (centerRankingSummary?.total || 0) >= 5 &&
      recent14StudyDays >= 3 &&
      weeklyMinutes > 0;

    return buildStudentFullAnalysisSummary({
      centerTopPercent: toTopPercent(centerRankingSummary?.rank ?? null, centerRankingSummary?.total ?? null),
      centerRank: centerRankingSummary?.rank ?? null,
      centerTotal: centerRankingSummary?.total ?? 0,
      classTopPercent: toTopPercent(classRankingSummary?.rank ?? null, classRankingSummary?.total ?? null),
      classRank: classRankingSummary?.rank ?? null,
      classTotal: classRankingSummary?.total ?? 0,
      weeklyMinutes,
      blankDays: recent14BlankDays,
      weekDiffPct: latestWeeklyLearningGrowthPercent,
      completionRate: avgCompletionRate,
      maxStreak: studyStreakDays,
      avgMinutes: avgStudyMinutes,
      studyDays: recent14StudyDays,
      hasEnoughData: hasEnoughComparisonData,
    });
  }, [
    avgCompletionRate,
    avgStudyMinutes,
    centerRankingSummary,
    classRankingSummary,
    latestWeeklyLearningGrowthPercent,
    rankingLoading,
    recent14BlankDays,
    recent14StudyDays,
    studyStreakDays,
    weeklyGrowthData,
  ]);

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
          href: canOpenSettings ? '/dashboard/settings/notifications' : '/dashboard/appointments',
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
    canViewFinance && outstandingAmount > 0
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
    ...(canViewFinance
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

    if (canViewFinance) {
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
    canViewFinance,
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
    const normalizedPhoneNumber = normalizePhoneNumber(editForm.phoneNumber);
    const existingParentLinkCode = normalizeParentLinkCode(student?.parentLinkCode);
    if (normalizedParentLinkCode && !/^\d{6}$/.test(normalizedParentLinkCode)) {
      toast({
        variant: 'destructive',
        title: '입력값 확인 필요',
        description: '부모 연동코드는 6자리 숫자로 입력해 주세요.',
      });
      return;
    }
    if (canManageStudentAccounts && normalizedPhoneNumber && !isValidKoreanMobilePhone(normalizedPhoneNumber)) {
      toast({
        variant: 'destructive',
        title: '입력값 확인 필요',
        description: '학생 전화번호는 01012345678 형식으로 입력해 주세요.',
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

      if (canManageStudentAccounts) {
        payload.memberStatus = editForm.memberStatus;
        payload.phoneNumber = normalizedPhoneNumber || null;
      }

      if (normalizedParentLinkCode !== existingParentLinkCode) {
        payload.parentLinkCode = normalizedParentLinkCode || null;
      }

      if (canManageStudentAccounts && editForm.password.length >= 6) {
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
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-[#2554D4]" /></div>;
  }

  if (isStudentSelfView && currentUser && studentId !== currentUser.uid) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-3 px-4 py-24 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <h2 className="text-2xl font-black tracking-tight text-[#14295F]">본인 분석만 확인할 수 있어요</h2>
        <p className="text-sm font-semibold text-[#5c6e97]">다른 학생 계정 분석 화면에는 접근할 수 없습니다.</p>
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
  const detailWindowNavButtonClass = isAnalysisPresentation ? 'analysis-action-button analysis-window-nav-button' : '';
  const detailTabListClass = isAnalysisPresentation
    ? cn('analysis-tab-rail rounded-[1.5rem] grid p-1.5 gap-1.5', isMobile ? 'h-auto grid-cols-2' : 'h-14 grid-cols-3')
    : cn('rounded-[1.6rem] border border-[#dbe7ff] bg-white p-1.5 gap-1 shadow-[0_20px_48px_-42px_rgba(20,41,95,0.32)] grid', isMobile ? 'h-auto grid-cols-2' : 'h-14 grid-cols-3');
  const detailTabTriggerClass = isAnalysisPresentation
    ? 'analysis-tab-trigger min-w-0 rounded-[1rem] font-aggro-display font-black text-xs gap-1.5 px-3 py-2.5'
    : 'min-w-0 rounded-[1.1rem] font-black text-xs gap-1.5 px-3 text-[#5c6e97] data-[state=active]:bg-[#14295F] data-[state=active]:text-white data-[state=active]:shadow-[0_20px_48px_-36px_rgba(20,41,95,0.58)]';
  const detailChartCardClass = cn(
    'min-w-0 overflow-hidden rounded-[1.8rem] border border-[#dbe7ff] bg-white shadow-[0_28px_70px_-56px_rgba(20,41,95,0.38)]',
    isAnalysisPresentation && 'analysis-chart-stage analysis-chart-stage--warm analysis-full-chart-card border-none'
  );
  const detailGrowthChartCardClass = cn(detailChartCardClass, isAnalysisPresentation && 'analysis-growth-card analysis-full-chart-card--feature');
  const detailChartHeaderClass = cn('relative z-10', isMobile ? 'px-4 pt-4 pb-3' : 'px-5 pt-5 pb-4');
  const detailChartContentClass = cn('relative z-10 pt-0', isMobile ? 'px-4 pb-4' : 'px-5 pb-5');
  const detailChartPanelClass = cn(
    'relative overflow-hidden rounded-[1.3rem] border bg-[#f8fbff] shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]',
    isMobile ? 'p-3' : 'p-4',
    isAnalysisPresentation ? 'analysis-detail-panel border-none' : 'border-[#dbe7ff]'
  );
  const detailMetricHeaderClass = isMobile
    ? 'flex flex-col items-stretch gap-2.5'
    : 'flex items-start justify-between gap-3';
  const detailMetricChipClass = isAnalysisPresentation
    ? cn(
        'analysis-metric-chip flex flex-col items-center justify-center gap-1 text-center',
        isMobile ? 'min-h-[4.25rem] min-w-0 w-full max-w-[7.5rem] self-start px-3 py-2.5' : 'min-h-[4.9rem] min-w-[5.8rem] px-3 py-3'
      )
    : 'rounded-[1rem] border border-[#dbe7ff] bg-[#f8fbff] px-3 py-2 shadow-[0_14px_30px_-28px_rgba(20,41,95,0.42)]';
  const detailBadgeClass = isAnalysisPresentation
    ? 'analysis-detail-badge'
    : 'rounded-full border-[#dbe7ff] bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]';
  const detailGrowthPeriodBadgeClass = cn(
    'rounded-full text-[10px] font-black',
    isAnalysisPresentation
      ? 'analysis-growth-period-badge'
      : 'border-[#dbe7ff] bg-white/82 text-[#5c6e97]'
  );
  const detailGrowthAccentPeriodBadgeClass = cn(
    'rounded-full text-[10px] font-black',
    isAnalysisPresentation
      ? 'analysis-growth-period-badge analysis-growth-period-badge--accent'
      : 'border-[#ffe1c5] bg-white/82 text-[#d86a11]'
  );
  const detailGrowthTitleClass = cn(
    'break-keep font-black tracking-tight',
    isAnalysisPresentation ? 'text-[var(--text-on-dark)]' : 'text-[#14295F]'
  );
  const analysisRequestedTitleClass = isAnalysisPresentation ? 'text-white' : 'text-[#14295F]';
  const detailGrowthDescriptionClass = cn(
    'mt-1 font-semibold',
    isAnalysisPresentation ? 'text-[var(--text-on-dark-soft)]' : 'text-[#5c6e97]'
  );
  const analysisReadableMutedTextClass = isAnalysisPresentation ? 'text-[#f4f8ff]' : 'text-[#6a7da6]';
  const analysisReadableSoftTextClass = isAnalysisPresentation ? 'text-[#5F7299]' : 'text-[#5c6e97]';
  const analysisChartTickColor = '#14295F';
  const analysisChartTickSoftColor = '#14295F';
  const analysisChartAxisLine = { stroke: '#14295F', strokeOpacity: 0.24, strokeWidth: 1 };
  const mobileAnalysisDualAxisMargin = { top: 8, right: 12, left: 8, bottom: 0 };
  const mobileAnalysisSingleAxisMargin = { top: 8, right: 10, left: 10, bottom: 0 };
  const mobileAnalysisMinutesAxisWidth = 42;
  const mobileAnalysisGrowthAxisWidth = 40;
  const mobileAnalysisScoreAxisWidth = 36;
  const mobileAnalysisClockAxisWidth = 48;
  const mobileAnalysisAwayAxisWidth = 36;
  const analysisChartGridColor = isAnalysisPresentation ? 'rgba(244, 248, 255, 0.34)' : '#f2f2f2';
  const analysisStudyTrendStrokeColor = isAnalysisPresentation ? '#f4f8ff' : 'hsl(var(--primary))';
  const analysisChipPrimaryTextClass = isAnalysisPresentation ? 'text-[#f4f8ff]' : 'text-[#14295F]';
  const analysisChipSecondaryTextClass = isAnalysisPresentation ? 'text-white/80' : 'text-[#5c6e97]';
  const analysisChipLabelClass = cn('text-[10px] font-black uppercase leading-[1.2] tracking-[0.18em]', analysisReadableMutedTextClass);
  const analysisChipSubLabelClass = cn('text-[11px] font-semibold leading-[1.2]', analysisChipSecondaryTextClass);
  const detailInsightBandClass = cn(
    'mt-3 rounded-[1.15rem] px-3.5 py-3',
    isAnalysisPresentation ? 'analysis-signal-band' : 'border border-[#dbe7ff] bg-[#f8fbff]'
  );
  const detailPrimaryTextClass = isAnalysisPresentation ? 'text-[#17326B]' : 'text-[#14295F]';
  const detailSecondaryTextClass = isAnalysisPresentation ? 'text-[#5F7299]' : 'text-[#5c6e97]';
  const analysisWarmBadgeClass = isAnalysisPresentation ? 'analysis-warm-badge' : '';
  const analysisSoftBadgeClass = isAnalysisPresentation ? 'analysis-soft-badge' : '';
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
  const hasCompletionTrendData = displaySeries.some((item) => item.hasCompletion || item.completionRate > 0);
  const defaultSectionMotion = (delay = 0) => (prefersReducedMotion ? {} : {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.42, delay, ease: 'easeOut' as const },
  });
  const currentAttendanceLabel = attendanceCurrent?.status === 'studying'
    ? '공부중'
    : attendanceCurrent?.status === 'away'
      ? '외출중'
      : attendanceCurrent?.status === 'break'
        ? '휴식중'
        : '미입실';
  const currentAttendanceToneClass = attendanceCurrent?.status === 'studying'
    ? 'border-emerald-200/30 bg-emerald-400/12 text-white'
    : attendanceCurrent?.status === 'away'
      ? 'border-[#ffd7b4]/30 bg-[#ff9b24]/12 text-white'
      : attendanceCurrent?.status === 'break'
        ? 'border-sky-200/30 bg-sky-300/12 text-white'
        : 'border-white/20 bg-white/10 text-white';
  const currentMemberStatusLabel = currentStudentMemberStatus === 'active'
    ? '재원생'
    : currentStudentMemberStatus === 'onHold'
      ? '휴원생'
      : '퇴원생';
  const analysisAttendanceBadgeClass = attendanceCurrent?.status === 'studying'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : attendanceCurrent?.status === 'away'
      ? 'border-rose-200 bg-rose-50 text-rose-600'
      : attendanceCurrent?.status === 'break'
        ? 'border-sky-200 bg-sky-50 text-sky-700'
        : 'border-[#dbe7ff] bg-[#f8fbff] text-[#17326B]';
  const analysisMemberBadgeClass = currentStudentMemberStatus === 'active'
    ? 'border-[#dbe7ff] bg-white text-[#17326B]'
    : currentStudentMemberStatus === 'onHold'
      ? 'border-[#ffe1c5] bg-[#fff8ef] text-[#d86a11]'
      : 'border-[#ffdbe2] bg-[#fff2f5] text-[#dc4b74]';
  const studentBriefMeta = [student?.schoolName, student?.grade, student?.className || '반 미지정']
    .filter(Boolean)
    .join(' · ');
  const teacherSnapshotCards = [
    {
      key: 'today',
      label: '오늘 누적 공부',
      value: minutesToLabel(todayStudyMinutes),
      helper: `실시간 세션 ${attendanceCurrent?.status === 'studying' ? `${minutesToLabel(activeSessionMinutes)} 진행 중` : '대기 중'}`,
      accentClass: 'border-[#dbe7ff] bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)]',
      valueClass: 'text-[#2554d4]',
    },
    {
      key: 'rhythm',
      label: '학습 리듬',
      value: `${rhythmScore}점`,
      helper: rhythmScore >= 70 ? '리듬이 안정권입니다.' : '리듬 점검이 필요합니다.',
      accentClass: 'border-emerald-100 bg-[linear-gradient(180deg,#f2fcf8_0%,#ffffff_100%)]',
      valueClass: 'text-emerald-600',
    },
    {
      key: 'completion',
      label: '계획 완수율',
      value: `${avgCompletionRate}%`,
      helper: avgCompletionRate >= 70 ? '실행 안정권입니다.' : '핵심 과제 압축이 필요합니다.',
      accentClass: 'border-amber-100 bg-[linear-gradient(180deg,#fff8ef_0%,#ffffff_100%)]',
      valueClass: 'text-[#d86a11]',
    },
    {
      key: 'counseling',
      label: '상담 진행도',
      value: `${studentReservations.filter((item) => item.status === 'done').length}/${studentReservations.length}`,
      helper: latestCounselDate ? `최근 상담 ${format(latestCounselDate, 'M월 d일', { locale: ko })}` : '최근 상담 기록 없음',
      accentClass: 'border-violet-100 bg-[linear-gradient(180deg,#f7f4ff_0%,#ffffff_100%)]',
      valueClass: 'text-violet-600',
    },
  ] as const;
  const teacherOperatingNotes = [
    {
      key: 'evidence',
      label: '운영 증빙',
      value: `${counselingCount30d + reportSentCount30d + smsAcceptedCount30d}회`,
      helper: `상담 ${counselingCount30d} · 리포트 ${reportSentCount30d} · 문자 ${smsAcceptedCount30d}`,
    },
    {
      key: 'attendance',
      label: '출결 흐름',
      value: `${attendanceRate30d}%`,
      helper: `최근 30일 출석률 · 벌점 ${Math.max(0, Math.round(Number(progress?.penaltyPoints || 0)))}점`,
    },
    {
      key: 'guardian',
      label: '보호자 반응',
      value: `${parentVisitCount30d}회`,
      helper: `앱 방문 ${parentVisitCount30d} · 리포트 열람 ${reportReadCount30d}`,
    },
  ] as const;
  const overviewIntroCards = [
    {
      key: 'growth',
      label: '오늘 성장',
      value: formatSignedPercent(focusKpi.todayGrowthPercent),
      helper: '최근 7일 평균 대비',
      toneClass: focusKpi.todayGrowthPercent >= 0 ? 'text-emerald-600' : 'text-rose-500',
      shellClass: focusKpi.todayGrowthPercent >= 0 ? 'border-emerald-100 bg-emerald-50/70' : 'border-rose-100 bg-rose-50/70',
    },
    {
      key: 'avg',
      label: '최근 7일 평균',
      value: minutesToLabel(focusKpi.recent7AvgMinutes),
      helper: '일 평균 공부시간',
      toneClass: 'text-[#2554d4]',
      shellClass: 'border-[#dbe7ff] bg-[#f8fbff]',
    },
    {
      key: 'completion',
      label: '실행 안정성',
      value: `${focusKpi.completionRate}%`,
      helper: focusKpi.completionRate >= 70 ? '완수 리듬이 유지됩니다.' : '실행 볼륨 점검이 필요합니다.',
      toneClass: 'text-[#d86a11]',
      shellClass: 'border-amber-100 bg-[#fff8ef]',
    },
  ] as const;
  const graphWorkbenchMetrics = [
    {
      key: 'range',
      label: '현재 관찰 범위',
      value: `최근 ${RANGE_MAP[focusedChartView]}일`,
      helper: `${displaySeries.length}개 기록 기준`,
    },
    {
      key: 'study',
      label: '평균 공부시간',
      value: minutesToLabel(avgStudyMinutes),
      helper: '그래프 전체 기준선',
    },
    {
      key: 'completion',
      label: '평균 완수율',
      value: `${avgCompletionRate}%`,
      helper: avgCompletionRate >= 70 ? '실행 흐름 안정권' : '실행 밀도 재정비 필요',
    },
    {
      key: 'rhythm',
      label: '리듬 점수',
      value: `${rhythmScore}점`,
      helper: rhythmScore >= 70 ? '시간대 패턴 안정적' : '리듬 흔들림 점검 필요',
    },
  ] as const;
  const graphWorkbenchSteps = [
    {
      key: 'growth',
      label: '성장 비교',
      detail: '주간 성장과 일자별 변동을 먼저 읽고 학습 볼륨의 방향을 확인합니다.',
    },
    {
      key: 'rhythm',
      label: '리듬 진단',
      detail: '리듬 점수와 시작·종료 시각을 함께 보며 생활 패턴의 안정성을 봅니다.',
    },
    {
      key: 'risk',
      label: '즉시 개입',
      detail: '외출 흐름과 위험 요약 카드로 지금 바로 손봐야 할 포인트를 잡습니다.',
    },
  ] as const;
  const counselingSummaryCards = [
    {
      key: 'reservation',
      label: '상담 예약',
      value: `${studentReservations.filter((item) => item.status === 'confirmed').length}건`,
      helper: `${studentReservations.length}건 중 확정 일정`,
      accentClass: 'border-[#dbe7ff] bg-[#f8fbff]',
      valueClass: 'text-[#2554d4]',
    },
    {
      key: 'feedback',
      label: '최근 피드백',
      value: `${studentQuickFeedbacks.length}건`,
      helper: studentQuickFeedbacks[0]?.createdAt ? `최근 작성 ${format(studentQuickFeedbacks[0].createdAt.toDate(), 'M월 d일 HH:mm', { locale: ko })}` : '전달 기록 없음',
      accentClass: 'border-[#ffe1c5] bg-[#fff8f2]',
      valueClass: 'text-[#d86a11]',
    },
    {
      key: 'logs',
      label: '상담 일지',
      value: `${studentCounselingLogs.length}건`,
      helper: latestCounselDate ? `최근 상담 ${format(latestCounselDate, 'M월 d일', { locale: ko })}` : '최근 상담 기록 없음',
      accentClass: 'border-emerald-100 bg-emerald-50/70',
      valueClass: 'text-emerald-600',
    },
  ] as const;
  const planSummaryCards = [
    {
      key: 'study',
      label: '오늘 학습 계획',
      value: `${todayPlanSummary.studyDone}/${todayPlanSummary.studyTotal}`,
      helper: '완료 / 전체 학습 할 일',
      accentClass: 'border-[#dbe7ff] bg-[#f8fbff]',
      valueClass: 'text-[#2554d4]',
    },
    {
      key: 'routine',
      label: '오늘 루틴 수',
      value: `${todayPlanSummary.routineCount}`,
      helper: '등원·식사·학원 등 시간 루틴',
      accentClass: 'border-emerald-100 bg-emerald-50/70',
      valueClass: 'text-emerald-600',
    },
    {
      key: 'personal',
      label: '개인 할 일',
      value: `${todayPlanSummary.personalCount}`,
      helper: '생활/기타 개인 체크 항목',
      accentClass: 'border-amber-100 bg-[#fff8ef]',
      valueClass: 'text-[#d86a11]',
    },
  ] as const;

  return (
    <div className={cn(
      'flex flex-col max-w-7xl mx-auto px-4 w-full min-w-0 overflow-x-hidden',
      isMobile ? 'gap-4 pb-32' : 'gap-6 pb-24',
      isAnalysisPresentation && 'analysis-shell student-analysis-shell analysis-full-shell'
    )}>
      {isAnalysisPresentation ? (
        <div className={cn(
          'analysis-profile-shell grid gap-4',
          isMobile ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.14fr)_minmax(20rem,0.86fr)]'
        )}>
          <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,1.24fr)_minmax(17rem,0.92fr)]')}>
            <div className={cn('analysis-profile-card relative flex items-center', isMobile ? 'min-h-[7.5rem] px-4 py-5' : 'min-h-[9rem] px-5 py-6')}>
              {!isStudentSelfView ? (
                <Button variant="outline" size="icon" className={cn("absolute left-4 top-4 h-10 w-10 shrink-0 rounded-full", detailActionButtonClass)} asChild>
                  <Link href={backHref}><ArrowLeft className="h-5 w-5" /></Link>
                </Button>
              ) : null}
              <h1 className={cn(
                'min-w-0 break-keep font-aggro-display font-black tracking-[-0.06em] text-[#17326B]',
                !isStudentSelfView && 'pr-2',
                isMobile
                  ? (!isStudentSelfView ? 'pl-12 text-[2rem] leading-[1.02]' : 'text-[2rem] leading-[1.02]')
                  : (!isStudentSelfView ? 'pl-14 text-[clamp(2.35rem,4vw,3.3rem)] leading-[1.01]' : 'text-[clamp(2.35rem,4vw,3.3rem)] leading-[1.01]')
              )}>
                {student?.name || '학생'}
              </h1>
            </div>

            <div className={cn('analysis-profile-meta-card', isMobile ? 'px-4 py-4' : 'px-5 py-5')}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6A7DA6]">운영 브리프</p>
                  <h2 className="mt-2 break-keep font-aggro-display text-[1.35rem] font-black tracking-[-0.04em] text-[#14295F]">
                    학생 상태 요약
                  </h2>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Badge variant="outline" className={cn('rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]', analysisAttendanceBadgeClass)}>
                    {currentAttendanceLabel}
                  </Badge>
                  <Badge variant="outline" className={cn('rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]', analysisMemberBadgeClass)}>
                    {currentMemberStatusLabel}
                  </Badge>
                  <Badge variant="outline" className={cn('rounded-full px-2.5 py-1 text-[10px] font-black', analysisWarmBadgeClass)}>
                    {formatSeatLabel(student)}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="analysis-profile-mini-card px-4 py-4">
                  <p className="font-aggro-display text-[10px] font-black uppercase tracking-[0.18em] text-[#6A7DA6]">소속 브리프</p>
                  <p className="mt-3 break-keep font-aggro-display text-[1.15rem] font-black leading-6 tracking-[-0.03em] text-[#14295F]">
                    {studentBriefMeta}
                  </p>
                  {!isStudentSelfView ? (
                    <Badge variant="outline" className={cn('mt-3 rounded-full text-[10px] font-black', analysisSoftBadgeClass)}>
                      <UserRound className="mr-1 h-3 w-3" /> 학부모/선생님 공유용
                    </Badge>
                  ) : null}
                  <p className="mt-2 text-xs font-semibold leading-5 text-[#5F7299]">학교, 학년, 반 기준으로 학생 위치를 빠르게 확인합니다.</p>
                </div>
                <div className="analysis-profile-mini-card analysis-profile-mini-card--warm px-4 py-4">
                  <p className="font-aggro-display text-[10px] font-black uppercase tracking-[0.18em] text-[#D86A11]">실시간 세션</p>
                  <p className="mt-3 break-keep font-aggro-display text-[1.15rem] font-black leading-6 tracking-[-0.03em] text-[#14295F]">
                    {attendanceCurrent?.status === 'studying' ? minutesToLabel(activeSessionMinutes) : currentAttendanceLabel}
                  </p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[#5F7299]">오늘 누적 {minutesToLabel(todayStudyMinutes)} · 연속 공부 {studyStreakDays}일</p>
                </div>
              </div>
            </div>
          </div>

          <div className={cn('analysis-profile-action-card', isMobile ? 'px-4 py-4' : 'px-5 py-5')}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D86A11]">운영 액션</p>
                <h2 className="mt-2 break-keep font-aggro-display text-[1.4rem] font-black tracking-[-0.04em] text-[#14295F]">
                  지금 바로 쓰는 액션
                </h2>
              </div>
              <Badge variant="outline" className={cn('rounded-full px-3 py-1 text-[10px] font-black', analysisWarmBadgeClass)}>
                홈 카드 구조
              </Badge>
            </div>
            <p className="mt-2 text-xs font-semibold leading-5 text-[#5F7299]">
              출결, 상담, 리포트, 문자, 보정 흐름을 한 덱에서 바로 실행할 수 있게 정리했습니다.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {!isStudentSelfView && (
                <Button variant="outline" className={cn("h-12 justify-start rounded-[1.15rem] px-4 text-xs font-black gap-2", detailActionButtonClass)} asChild>
                  <Link href="/dashboard/attendance"><CalendarDays className="h-4 w-4" /> 출결 상태</Link>
                </Button>
              )}
              {canWriteCounseling && <Button variant="outline" className={cn("h-12 justify-start rounded-[1.15rem] px-4 text-xs font-black gap-2", detailActionButtonClass)} onClick={() => setIsReservationModalOpen(true)}><CalendarCheck2 className="h-4 w-4" /> 상담 예약</Button>}
              {canWriteCounseling && <Button variant="outline" className={cn("h-12 justify-start rounded-[1.15rem] px-4 text-xs font-black gap-2", detailActionButtonClass)} onClick={() => setIsLogModalOpen(true)}><ClipboardList className="h-4 w-4" /> 상담 일지 작성</Button>}
              {canWriteCounseling && <Button variant="outline" className={cn("h-12 justify-start rounded-[1.15rem] px-4 text-xs font-black gap-2", detailActionButtonClass)} onClick={() => setIsQuickFeedbackModalOpen(true)}><MessageSquareMore className="h-4 w-4" /> 한 줄 피드백</Button>}
              {!isStudentSelfView && (
                <Button variant="outline" className={cn("h-12 justify-start rounded-[1.15rem] px-4 text-xs font-black gap-2", detailActionButtonClass)} asChild>
                  <Link href="/dashboard/reports"><PenTool className="h-4 w-4" /> 리포트 생성/확인</Link>
                </Button>
              )}
              {!isStudentSelfView && (
                <Button variant="outline" className={cn("h-12 justify-start rounded-[1.15rem] px-4 text-xs font-black gap-2", detailActionButtonClass)} asChild>
                  <Link href={canOpenSettings ? '/dashboard/settings/notifications' : '/dashboard/appointments'}>
                    <MessageSquare className="h-4 w-4" /> {canOpenSettings ? '문자 보내기' : '상담/소통'}
                  </Link>
                </Button>
              )}
              {canEditStudentInfo && <Button variant="outline" className={cn("h-12 justify-start rounded-[1.15rem] px-4 text-xs font-black gap-2", detailActionButtonClass)} onClick={() => setIsEditModalOpen(true)}><Settings2 className="h-4 w-4" /> 정보 수정</Button>}
              {canEditGrowthData && (
                <Button
                  variant="outline"
                  className={cn("analysis-action-button--accent h-12 justify-start rounded-[1.15rem] px-4 text-xs font-black gap-2", detailActionButtonClass)}
                  onClick={() => {
                    setIsMasteryModalOpen(true);
                    setIsEditStats(true);
                  }}
                >
                  <Sparkles className="h-4 w-4" /> 지표/세션 보정
                </Button>
              )}
              {canManageStudentAccounts && <Button variant="destructive" className="h-12 justify-start rounded-[1.15rem] px-4 text-xs font-black gap-2 sm:col-span-2" onClick={() => { if (confirm('영구 삭제하시겠습니까?')) handleDeleteAccount(); }}><Trash2 className="h-4 w-4" /> 계정 삭제</Button>}
            </div>
          </div>
        </div>
      ) : (
        <motion.section
          {...defaultSectionMotion(0)}
          className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]')}
        >
          <div className="rounded-[2.4rem] bg-[linear-gradient(135deg,#14295F_0%,#173D8B_58%,#2554D4_100%)] px-5 py-5 shadow-[0_36px_80px_-48px_rgba(20,41,95,0.7)] sm:px-7 sm:py-6">
            <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-start justify-between')}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {!isStudentSelfView ? (
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-white/18 bg-white/8 text-white hover:bg-white/12 hover:text-white" asChild>
                      <Link href={backHref}><ArrowLeft className="h-5 w-5" /></Link>
                    </Button>
                  ) : null}
                  <Badge className={cn('rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]', currentAttendanceToneClass)}>
                    {currentAttendanceLabel}
                  </Badge>
                  <Badge className="rounded-full border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                    {currentMemberStatusLabel}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <h1 className="min-w-0 break-keep font-aggro-display text-[clamp(2.15rem,4.4vw,3.6rem)] font-black leading-[0.94] tracking-[-0.06em] text-white">
                    {student?.name || '학생'}
                  </h1>
                  <Badge className="rounded-full border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white">
                    {formatSeatLabel(student)}
                  </Badge>
                  {!isStudentSelfView ? (
                    <Badge className="rounded-full border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white/80">
                      <UserRound className="mr-1 h-3 w-3" /> 선생님 운영 뷰
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-white/80">
                  실시간 상태와 최근 30일 운영 증빙을 한 번에 보는 학생 360 운영 브리프입니다.
                </p>
              </div>
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                <div className="rounded-[1.4rem] border border-white/10 bg-white/8 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">소속 브리프</p>
                  <p className="mt-2 text-base font-black text-white">{studentBriefMeta}</p>
                  <p className="mt-1 text-xs font-semibold text-white/80">연속 공부 {studyStreakDays}일</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-white/8 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">실시간 세션</p>
                  <p className="mt-2 text-base font-black text-white">{attendanceCurrent?.status === 'studying' ? minutesToLabel(activeSessionMinutes) : '진행 세션 없음'}</p>
                  <p className="mt-1 text-xs font-semibold text-white/80">오늘 누적 {minutesToLabel(todayStudyMinutes)}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="rounded-[1.7rem] border border-white/10 bg-white/8 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">오늘 개입 포인트</p>
                <p className="mt-3 text-xl font-black leading-[1.2] text-white">{chartInsightHeadline}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-white/80">{chartInsightSummary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {riskSignals.length === 0 ? (
                    <Badge className="rounded-full border border-emerald-200/25 bg-emerald-300/12 px-3 py-1 text-[10px] font-black text-white">
                      뚜렷한 위험 신호 없음
                    </Badge>
                  ) : (
                    riskSignals.slice(0, 3).map((signal) => (
                      <Badge key={signal} className="rounded-full border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white">
                        {signal}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {teacherOperatingNotes.map((item) => (
                  <div key={item.key} className="rounded-[1.35rem] border border-white/10 bg-white/8 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">{item.label}</p>
                    <p className="mt-3 text-xl font-black tracking-tight text-white">{item.value}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-white/80">{item.helper}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[2.15rem] border border-[#dbe7ff] bg-white px-4 py-4 shadow-[0_28px_72px_-52px_rgba(20,41,95,0.42)] sm:px-5 sm:py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5c6e97]">운영 액션 덱</p>
                <h2 className="mt-2 break-keep font-aggro-display text-[1.5rem] font-black tracking-[-0.04em] text-[#14295F]">
                  지금 바로 쓰는 액션
                </h2>
              </div>
              <Badge className="rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-3 py-1 text-[10px] font-black text-[#14295F]">
                홈 상단 고정
              </Badge>
            </div>
            <p className="mt-2 text-xs font-semibold leading-5 text-[#5c6e97]">
              출결, 상담, 리포트, 문자, 보정 흐름을 이 카드 하나에서 바로 실행합니다.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {!isStudentSelfView ? (
                <Button asChild variant="outline" className="h-12 justify-start rounded-[1.1rem] border-[#dbe7ff] bg-white px-4 text-[#14295F] hover:bg-[#f4f7ff]">
                  <Link href="/dashboard/attendance"><CalendarDays className="mr-2 h-4 w-4" /> 출결 상태</Link>
                </Button>
              ) : null}
              {canWriteCounseling ? (
                <Button variant="outline" className="h-12 justify-start rounded-[1.1rem] border-[#dbe7ff] bg-white px-4 text-[#14295F] hover:bg-[#f4f7ff]" onClick={() => setIsReservationModalOpen(true)}>
                  <CalendarCheck2 className="mr-2 h-4 w-4" /> 상담 예약
                </Button>
              ) : null}
              {canWriteCounseling ? (
                <Button variant="outline" className="h-12 justify-start rounded-[1.1rem] border-[#dbe7ff] bg-white px-4 text-[#14295F] hover:bg-[#f4f7ff]" onClick={() => setIsLogModalOpen(true)}>
                  <ClipboardList className="mr-2 h-4 w-4" /> 상담 일지 작성
                </Button>
              ) : null}
              {canWriteCounseling ? (
                <Button variant="outline" className="h-12 justify-start rounded-[1.1rem] border-[#dbe7ff] bg-white px-4 text-[#14295F] hover:bg-[#f4f7ff]" onClick={() => setIsQuickFeedbackModalOpen(true)}>
                  <MessageSquareMore className="mr-2 h-4 w-4" /> 한 줄 피드백
                </Button>
              ) : null}
              {!isStudentSelfView ? (
                <Button asChild variant="outline" className="h-12 justify-start rounded-[1.1rem] border-[#dbe7ff] bg-white px-4 text-[#14295F] hover:bg-[#f4f7ff]">
                  <Link href="/dashboard/reports"><PenTool className="mr-2 h-4 w-4" /> 리포트 생성/확인</Link>
                </Button>
              ) : null}
              {!isStudentSelfView ? (
                <Button asChild variant="outline" className="h-12 justify-start rounded-[1.1rem] border-[#dbe7ff] bg-white px-4 text-[#14295F] hover:bg-[#f4f7ff]">
                  <Link href={canOpenSettings ? '/dashboard/settings/notifications' : '/dashboard/appointments'}>
                    <MessageSquare className="mr-2 h-4 w-4" /> {canOpenSettings ? '문자 보내기' : '상담/소통'}
                  </Link>
                </Button>
              ) : null}
              {canEditStudentInfo ? (
                <Button variant="outline" className="h-12 justify-start rounded-[1.1rem] border-[#dbe7ff] bg-white px-4 text-[#14295F] hover:bg-[#f4f7ff]" onClick={() => setIsEditModalOpen(true)}>
                  <Settings2 className="mr-2 h-4 w-4" /> 정보 수정
                </Button>
              ) : null}
              {canEditGrowthData ? (
                <Button
                  className="h-12 justify-start rounded-[1.1rem] bg-[#FF7A16] px-4 text-white hover:bg-[#f06d06]"
                  onClick={() => {
                    setIsMasteryModalOpen(true);
                    setIsEditStats(true);
                  }}
                >
                  <Sparkles className="mr-2 h-4 w-4" /> 지표/세션 보정
                </Button>
              ) : null}
              {canManageStudentAccounts ? (
                <Button variant="destructive" className="h-12 justify-start rounded-[1.1rem] px-4 sm:col-span-2" onClick={() => { if (confirm('영구 삭제하시겠습니까?')) handleDeleteAccount(); }}>
                  <Trash2 className="mr-2 h-4 w-4" /> 계정 삭제
                </Button>
              ) : null}
            </div>
          </div>
        </motion.section>
      )}

      {isAnalysisPresentation ? (
        <>
          <section className={cn(
            'grid gap-3',
            isAnalysisPresentation
              ? (isMobile ? 'grid-cols-1 min-[380px]:grid-cols-2 gap-2.5' : 'grid-cols-4 gap-4')
              : (isMobile ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'),
            isAnalysisPresentation && 'analysis-summary-rail'
          )}>
            <StatAnalysisCard
              title="평균 공부시간"
              value={minutesToLabel(avgStudyMinutes)}
              subValue={`최근 ${RANGE_MAP[focusedChartView]}일 기준`}
              compactTitle="공부시간"
              compactSubValue={`${RANGE_MAP[focusedChartView]}일 기준`}
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
              compactTitle="공부리듬"
              compactSubValue="분산 안정성"
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
              compactTitle="완수율"
              compactSubValue="할 일 완료율"
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
              compactTitle="상담"
              compactSubValue="완료/전체 상담"
              icon={MessageSquare}
              colorClass="text-rose-500"
              isMobile={isMobile}
              presentationMode={presentationMode}
              progress={counselingProgress}
            />
          </section>

          {!isStudentSelfView ? (
            <section className={cn('grid gap-4', isAnalysisPresentation ? (isMobile ? 'grid-cols-1' : 'grid-cols-2') : (isMobile ? 'grid-cols-1' : 'xl:grid-cols-[1.15fr_0.95fr]'))}>
              <Card className={cn('rounded-[2rem] border border-[#dbe7ff] bg-white shadow-[0_28px_70px_-56px_rgba(20,41,95,0.38)]', isAnalysisPresentation && 'analysis-premium-card analysis-full-section-card surface-card surface-card--secondary on-dark rounded-[2rem] shadow-none border-none')}>
                <CardHeader className={cn(isMobile ? 'px-4 pt-4 pb-3' : 'px-5 pt-5 pb-4')}>
                  <div className={cn(isMobile ? "flex flex-col items-stretch gap-2.5" : "flex items-start justify-between gap-3")}>
                    <div>
                      <CardTitle className={cn("text-xl font-aggro-display font-black tracking-tight", isAnalysisPresentation ? 'text-[var(--text-on-dark)]' : detailPrimaryTextClass)}>오늘 액션 체크리스트</CardTitle>
                      <CardDescription className={cn("mt-1 text-[11px] font-semibold leading-5", isAnalysisPresentation ? 'text-[var(--text-on-dark-soft)]' : detailSecondaryTextClass)}>
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
                            : "border-[#dbe7ff] bg-[#f8fbff]"
                        )}
                      >
                        <div className={cn(isMobile ? "flex flex-col items-stretch gap-2.5" : "flex items-start justify-between gap-3")}>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge className={cn('rounded-full px-2.5 py-1 text-[10px] font-black', isAnalysisPresentation ? analysisWarmBadgeClass : item.accent)}>
                                액션 {index + 1}
                              </Badge>
                              <p className={cn("text-sm font-black", detailPrimaryTextClass)}>{item.title}</p>
                            </div>
                            <p className={cn("mt-2 text-[12px] font-semibold leading-5", isAnalysisPresentation ? "text-[var(--text-on-dark-soft)]" : detailSecondaryTextClass)}>{item.detail}</p>
                          </div>
                          <Button asChild size="sm" variant={isAnalysisPresentation ? 'outline' : 'outline'} className={cn("h-8 rounded-lg px-3 text-[11px] font-black", isMobile && "h-9 w-full justify-center", isAnalysisPresentation && detailActionButtonClass)}>
                            <Link href={item.href}>바로 이동</Link>
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {canViewFinance ? (
                <Card className={cn('rounded-[2rem] border border-[#dbe7ff] bg-white shadow-[0_28px_70px_-56px_rgba(20,41,95,0.38)]', isAnalysisPresentation && 'analysis-premium-card analysis-full-section-card surface-card surface-card--secondary on-dark rounded-[2rem] shadow-none border-none')}>
                  <CardHeader className={cn(isMobile ? 'px-4 pt-4 pb-3' : 'px-5 pt-5 pb-4')}>
                    <div className={cn(isMobile ? "flex flex-col items-stretch gap-2.5" : "flex items-start justify-between gap-3")}>
                      <div>
                        <CardTitle className={cn("text-xl font-aggro-display font-black tracking-tight", isAnalysisPresentation ? 'text-[var(--text-on-dark)]' : detailPrimaryTextClass)}>운영 비용 신호</CardTitle>
                        <CardDescription className={cn("mt-1 text-[11px] font-semibold leading-5", isAnalysisPresentation ? 'text-[var(--text-on-dark-soft)]' : detailSecondaryTextClass)}>
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
                          <p className={cn("text-[11px] font-black tracking-[0.12em] uppercase", analysisReadableSoftTextClass)}>{signal.title}</p>
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
                        <p className={cn("mt-1 text-[12px] font-semibold leading-5", isAnalysisPresentation ? "text-[var(--text-on-dark-soft)]" : detailSecondaryTextClass)}>{signal.helper}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </section>
          ) : null}
        </>
      ) : (
        <motion.section {...defaultSectionMotion(0.08)} className="grid gap-4">
          <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-4')}>
            {teacherSnapshotCards.map((item) => (
              <div key={item.key} className={cn('rounded-[1.8rem] border px-4 py-4 shadow-[0_22px_56px_-52px_rgba(20,41,95,0.45)]', item.accentClass)}>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">{item.label}</p>
                <p className={cn('mt-3 font-aggro-display text-[2rem] font-black tracking-[-0.05em]', item.valueClass)}>{item.value}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-[#5c6e97]">{item.helper}</p>
              </div>
            ))}
          </div>

          {!isStudentSelfView ? (
            <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]')}>
              <div className="rounded-[2.15rem] border border-[#dbe7ff] bg-white px-4 py-4 shadow-[0_28px_72px_-56px_rgba(20,41,95,0.42)] sm:px-5 sm:py-5">
                <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-start justify-between')}>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5c6e97]">오늘 액션 체크리스트</p>
                    <h2 className="mt-2 break-keep font-aggro-display text-[1.45rem] font-black tracking-[-0.04em] text-[#14295F]">
                      우선순위가 높은 액션부터
                    </h2>
                    <p className="mt-2 text-xs font-semibold leading-5 text-[#5c6e97]">
                      바로 처리해야 하는 항목만 상단 운영 캔버스에 모았습니다.
                    </p>
                  </div>
                  <Badge className="rounded-full bg-[#14295F] px-3 py-1 text-[10px] font-black text-white">
                    {todayActionChecklist.length}개 액션
                  </Badge>
                </div>

                <div className="mt-4 space-y-3">
                  {todayActionChecklist.length === 0 ? (
                    <div className="rounded-[1.35rem] border border-emerald-100 bg-emerald-50/80 px-4 py-4 text-sm font-bold text-emerald-700">
                      오늘 바로 처리해야 할 액션은 없습니다. 현재 운영 흐름을 유지해도 좋습니다.
                    </div>
                  ) : (
                    todayActionChecklist.map((item, index) => (
                      <div key={item.key} className="rounded-[1.35rem] border border-[#dbe7ff] bg-[#f8fbff] px-4 py-4">
                        <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-start justify-between')}>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={cn('rounded-full px-2.5 py-1 text-[10px] font-black', item.accent)}>
                                액션 {index + 1}
                              </Badge>
                              <p className="text-sm font-black text-[#14295F]">{item.title}</p>
                            </div>
                            <p className="mt-2 text-[12px] font-semibold leading-5 text-[#5c6e97]">{item.detail}</p>
                          </div>
                          <Button asChild variant="outline" size="sm" className={cn('h-9 rounded-xl border-[#dbe7ff] bg-white px-4 text-[#14295F] hover:bg-[#f4f7ff]', isMobile && 'w-full justify-center')}>
                            <Link href={item.href}>바로 이동</Link>
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[2.15rem] bg-[linear-gradient(135deg,#14295F_0%,#173D8B_100%)] px-4 py-4 shadow-[0_28px_72px_-56px_rgba(20,41,95,0.7)] sm:px-5 sm:py-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">운영 리스크 보드</p>
                    <h2 className="mt-2 break-keep font-aggro-display text-[1.45rem] font-black tracking-[-0.04em] text-white">
                      금융 포함 운영 신호
                    </h2>
                  </div>
                  <Badge className="rounded-full border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white">
                    최근 30일
                  </Badge>
                </div>
                <p className="mt-2 text-xs font-semibold leading-5 text-white/80">
                  문자, 상담, 리포트, 출결, 수납 흐름을 한 패널에서 빠르게 읽습니다.
                </p>

                <div className="mt-4 space-y-3">
                  {operatingCostSignals.map((signal) => (
                    <div key={signal.key} className="rounded-[1.35rem] border border-white/10 bg-white/8 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">{signal.title}</p>
                        <p className="text-lg font-black tracking-tight text-white">{signal.value}</p>
                      </div>
                      <p className="mt-2 text-xs font-semibold leading-5 text-white/80">{signal.helper}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </motion.section>
      )}

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
            isAnalysisPresentation && cn('analysis-overview-canvas rounded-[2rem]', isMobile ? 'px-4 py-4' : 'px-5 py-5')
          )}
        >
          {isAnalysisPresentation ? (
            <StudentAnalysisOverviewSection
              isMobile={isMobile}
              rankingLoading={rankingLoading}
              summary={studentFullAnalysisSummary}
              chartInsights={chartInsights}
              hasWeeklyGrowthData={hasWeeklyGrowthData}
              hasDailyGrowthData={hasDailyGrowthData}
              hasCompletionTrendData={hasCompletionTrendData}
              hasRhythmScoreOnlyTrend={hasRhythmScoreOnlyTrend}
              hasStartEndTimeData={hasStartEndTimeData}
              hasAwayTimeData={hasAwayTimeData}
              latestWeeklyLearningGrowthPercent={latestWeeklyLearningGrowthPercent}
              latestDailyLearningGrowthPercent={latestDailyLearningGrowthPercent}
              weeklyGrowthData={weeklyGrowthData}
              dailyGrowthWindowData={dailyGrowthWindowData}
              dailyGrowthWindowLabel={dailyGrowthWindowLabel}
              focusedChartDays={RANGE_MAP[focusedChartView]}
              canGoPrevDailyWindow={boundedDailyGrowthWindowIndex < dailyGrowthWindowCount - 1}
              canGoNextDailyWindow={boundedDailyGrowthWindowIndex > 0}
              onPrevDailyWindow={() => setDailyGrowthWindowIndex((prev) => Math.min(dailyGrowthWindowCount - 1, prev + 1))}
              onNextDailyWindow={() => setDailyGrowthWindowIndex((prev) => Math.max(0, prev - 1))}
              completionTrendData={displaySeries}
              recentStudySessions={recentStudySessions}
              avgCompletionRate={avgCompletionRate}
              avgStudyMinutes={avgStudyMinutes}
              todayStudyMinutes={todayStudyMinutes}
              studyStreakDays={studyStreakDays}
              rhythmScore={rhythmScore}
              averageRhythmScore={averageRhythmScore}
              latestRhythmScore={latestRhythmScore}
              rhythmScoreOnlyTrend={rhythmScoreOnlyTrend}
              startEndTimeTrendData={startEndTimeTrendData}
              latestStartEndSnapshot={latestStartEndSnapshot}
              awayTimeData={awayTimeData}
              averageAwayMinutes={averageAwayMinutes}
              riskSignals={riskSignals}
            />
          ) : (
            <motion.section
              {...defaultSectionMotion(0.12)}
              className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]')}
            >
              <Card className="rounded-[2rem] border border-[#dbe7ff] bg-white shadow-[0_28px_70px_-56px_rgba(20,41,95,0.38)]">
                <CardHeader className="pb-3">
                  <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-start justify-between')}>
                    <div>
                      <Badge className="rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-3 py-1 text-[10px] font-black text-[#14295F]">운영 그래프 브리프</Badge>
                      <CardTitle className="mt-3 font-aggro-display text-[1.45rem] font-black tracking-[-0.04em] text-[#14295F]">
                        학습 흐름을 먼저 읽는 KPI
                      </CardTitle>
                      <CardDescription className="mt-2 text-[12px] font-semibold leading-5 text-[#5c6e97]">
                        첫 화면과 겹치지 않게, 그래프 해석에 바로 연결되는 핵심 수치만 다시 정리했습니다.
                      </CardDescription>
                    </div>
                    <Button variant="outline" className="h-10 rounded-xl border-[#dbe7ff] bg-white px-4 text-[#14295F] hover:bg-[#f4f7ff]" onClick={() => setIsAvgStudyModalOpen(true)}>
                      <Clock3 className="mr-2 h-4 w-4" /> 최근 7일 세션
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 pt-0 md:grid-cols-3">
                  {overviewIntroCards.map((item) => (
                    <div key={item.key} className={cn('rounded-[1.35rem] border px-4 py-4', item.shellClass)}>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">{item.label}</p>
                      <p className={cn('mt-3 text-2xl font-black tracking-tight', item.toneClass)}>{item.value}</p>
                      <p className="mt-2 text-xs font-semibold leading-5 text-[#5c6e97]">{item.helper}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-[2rem] border-none bg-[linear-gradient(135deg,#14295F_0%,#173D8B_100%)] shadow-[0_32px_80px_-58px_rgba(20,41,95,0.8)]">
                <CardHeader className="pb-3">
                  <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-start justify-between')}>
                    <div>
                      <Badge className="rounded-full border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white">AI 코칭 인사이트</Badge>
                      <CardTitle className="mt-3 font-aggro-display text-[1.45rem] font-black tracking-[-0.04em] text-white">
                        {chartInsightHeadline}
                      </CardTitle>
                      <CardDescription className="mt-2 text-[12px] font-semibold leading-5 text-white/80">
                        최근 그래프를 기반으로 코칭 포인트를 짧고 빠르게 읽을 수 있게 다시 묶었습니다.
                      </CardDescription>
                    </div>
                    <Button variant="outline" className="h-10 rounded-xl border-white/14 bg-white/8 px-4 text-white hover:bg-white/12 hover:text-white" onClick={() => setIsRhythmGuideModalOpen(true)}>
                      <TrendingUp className="mr-2 h-4 w-4" /> 리듬 보기
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {insightHighlights.map((item) => (
                    <div key={item.key} className="rounded-[1.35rem] border border-white/10 bg-white/8 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <Badge className="rounded-full border border-white/14 bg-white/8 px-2.5 py-1 text-[10px] font-black text-white">{item.badge}</Badge>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">{item.label}</p>
                      </div>
                      <p className="mt-3 text-base font-black leading-6 text-white">{item.value}</p>
                      <p className="mt-2 text-xs font-semibold leading-5 text-white/80">{item.detail}</p>
                    </div>
                  ))}
                  <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
                    {insightSupportCards.map((item) => (
                      <div key={item.key} className="rounded-[1.2rem] border border-white/10 bg-white/8 px-3.5 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">{item.label}</p>
                        <p className="mt-2 text-sm font-black leading-5 text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.section>
          )}

          {!isStudentSelfView ? (
            <section className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]')}>
              <Card className={cn(
                "rounded-[1.5rem] border border-[#dbe7ff] bg-[linear-gradient(180deg,#ffffff_0%,#f6f9ff_100%)] shadow-lg",
                isAnalysisPresentation && "analysis-premium-card analysis-full-section-card surface-card surface-card--secondary on-dark border-none shadow-none"
              )}>
                <CardHeader className={cn(isMobile ? 'pb-3' : 'pb-2')}>
                  <CardTitle className={cn("font-aggro-display flex items-center gap-2 text-base font-black tracking-tight", isAnalysisPresentation ? 'text-[var(--text-on-dark)]' : detailPrimaryTextClass)}>
                    <ClipboardList className={cn("h-4 w-4", isAnalysisPresentation ? "text-[var(--accent-orange)]" : "text-[#2554d4]")} />
                    관리 증빙 요약
                  </CardTitle>
                  <CardDescription className={cn("font-bold", isMobile ? 'text-[11px]' : 'text-[10px] leading-4', isAnalysisPresentation ? 'text-[var(--text-on-dark-soft)]' : detailSecondaryTextClass)}>
                    보호자 상담 시 바로 보여줄 수 있도록, 최근 30일 관리 흐름을 한 문장과 핵심 수치로 먼저 정리했습니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className={cn('pt-0', isMobile ? 'space-y-4' : 'space-y-3')}>
                  <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
                    <div className={cn("rounded-xl border", isMobile ? 'p-4' : 'px-3.5 py-3', isAnalysisPresentation ? "surface-card surface-card--ghost on-dark border-white/10 shadow-none" : "border-[#dbe7ff] bg-white/90")}>
                      <p className={cn("text-[10px] font-black uppercase tracking-[0.22em]", isAnalysisPresentation ? "text-[var(--text-on-dark-muted)]" : "text-[#2554d4]")}>학습 관리</p>
                      <p className={cn(isMobile ? 'mt-2 text-lg' : 'mt-1.5 text-[1.05rem]', "font-black", detailPrimaryTextClass)}>{minutesToLabel(todayStudyMinutes)}</p>
                      <p className={cn(isMobile ? 'mt-1 text-xs' : 'mt-1 text-[11px] leading-4', "font-bold", detailSecondaryTextClass)}>최근 7일 평균 {minutesToLabel(avgStudyMinutes)} · 완료율 {avgCompletionRate}%</p>
                    </div>
                    <div className={cn("rounded-xl border", isMobile ? 'p-4' : 'px-3.5 py-3', isAnalysisPresentation ? "surface-card surface-card--ghost on-dark border-white/10 shadow-none" : "border-[#dbe7ff] bg-white/90")}>
                      <p className={cn("text-[10px] font-black uppercase tracking-[0.22em]", isAnalysisPresentation ? "text-[var(--text-on-dark-muted)]" : "text-[#2554d4]")}>출결 관리</p>
                      <p className={cn(isMobile ? 'mt-2 text-lg' : 'mt-1.5 text-[1.05rem]', "font-black", detailPrimaryTextClass)}>{attendanceRate30d}%</p>
                      <p className={cn(isMobile ? 'mt-1 text-xs' : 'mt-1 text-[11px] leading-4', "font-bold", detailSecondaryTextClass)}>
                        최근 30일 출석률 · 벌점 {Math.max(0, Math.round(Number(progress?.penaltyPoints || 0)))}점 · 외출 {awayTimeData.filter((item) => item.awayMinutes > 0).length}회
                      </p>
                    </div>
                    <div className={cn("rounded-xl border", isMobile ? 'p-4' : 'px-3.5 py-3', isAnalysisPresentation ? "surface-card surface-card--ghost on-dark border-white/10 shadow-none" : "border-[#dbe7ff] bg-white/90")}>
                      <p className={cn("text-[10px] font-black uppercase tracking-[0.22em]", isAnalysisPresentation ? "text-[var(--text-on-dark-muted)]" : "text-[#2554d4]")}>소통 관리</p>
                      <p className={cn(isMobile ? 'mt-2 text-lg' : 'mt-1.5 text-[1.05rem]', "font-black", detailPrimaryTextClass)}>{counselingCount30d + reportSentCount30d + smsAcceptedCount30d}회</p>
                      <p className={cn(isMobile ? 'mt-1 text-xs' : 'mt-1 text-[11px] leading-4', "font-bold", detailSecondaryTextClass)}>상담 {counselingCount30d} · 리포트 {reportSentCount30d} · 문자 {smsAcceptedCount30d}</p>
                    </div>
                  </div>
                  <div className={cn("rounded-xl border", isMobile ? 'px-4 py-3' : 'px-3.5 py-2.5', isAnalysisPresentation ? "surface-card surface-card--ghost on-dark border-white/10 shadow-none" : "border-[#dbe7ff] bg-[#eef4ff]")}>
                    <p className={cn(isMobile ? 'text-sm leading-6' : 'text-[12px] leading-5', "font-black", detailPrimaryTextClass)}>
                      최근 30일 동안 학습, 출결, 상담/문자/리포트 기록을 함께 관리하고 있으며, 보호자 반응은 앱 방문 {parentVisitCount30d}회 · 리포트 열람 {reportReadCount30d}회로 추적 중입니다.
                    </p>
                  </div>
                </CardContent>
              </Card>

            </section>
          ) : null}

          {!isAnalysisPresentation ? (
            <motion.section
              {...defaultSectionMotion(0.14)}
              className="grid gap-4"
            >
              <div className="rounded-[2.15rem] bg-[linear-gradient(135deg,#14295F_0%,#173D8B_58%,#2554D4_100%)] px-5 py-5 shadow-[0_34px_78px_-50px_rgba(20,41,95,0.74)] sm:px-6 sm:py-6">
                <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]')}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white">
                        그래프 워크벤치
                      </Badge>
                      <Badge className="rounded-full border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white/80">
                        학생 360
                      </Badge>
                      <Badge className="rounded-full border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white/80">
                        최근 {RANGE_MAP[focusedChartView]}일 기준
                      </Badge>
                    </div>
                    <h3 className="mt-4 font-aggro-display text-[1.6rem] font-black tracking-[-0.04em] text-white">
                      그래프를 한 번에 읽지 않고, 성장에서 리듬과 위험까지 순서대로 보이게 다시 묶었습니다.
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-white/80">
                      기존 그래프는 그대로 유지하면서도, 좁은 화면이나 중간 폭 데스크톱에서 흐름이 깨져 보이지 않도록 그래프 구역을 워크벤치 형태로 재배열했습니다.
                    </p>
                    <div className={cn('mt-4 grid gap-3', isMobile ? 'grid-cols-1' : 'md:grid-cols-3')}>
                      {graphWorkbenchSteps.map((item, index) => (
                        <div key={item.key} className="rounded-[1.4rem] border border-white/10 bg-white/8 px-4 py-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">Step {index + 1}</p>
                          <p className="mt-2 text-sm font-black tracking-tight text-white">{item.label}</p>
                          <p className="mt-2 text-xs font-semibold leading-5 text-white/80">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-2')}>
                    {graphWorkbenchMetrics.map((item) => (
                      <div key={item.key} className="rounded-[1.4rem] border border-white/10 bg-white/8 px-4 py-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">{item.label}</p>
                        <p className="mt-3 text-[1.35rem] font-black tracking-tight text-white">{item.value}</p>
                        <p className="mt-2 text-xs font-semibold leading-5 text-white/80">{item.helper}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>
          ) : null}

          {!isAnalysisPresentation && !isMobile && (
          <motion.section {...defaultSectionMotion(0.16)} className="analysis-full-chart-stack space-y-5">
            {!isAnalysisPresentation ? (
              <div className="rounded-[1.9rem] border border-[#dbe7ff] bg-[linear-gradient(180deg,#ffffff_0%,#f6f9ff_100%)] px-5 py-5 shadow-[0_28px_70px_-56px_rgba(20,41,95,0.36)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full border border-[#dbe7ff] bg-white px-2.5 py-1 text-[10px] font-black text-[#14295F]">
                        심화 그래프 데크
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-[#f8fbff] px-2.5 py-1 text-[10px] font-black text-[#2554d4]">
                        데스크톱 집중 보기
                      </Badge>
                    </div>
                    <h3 className="mt-3 font-aggro-display text-[1.24rem] font-black tracking-[-0.03em] text-[#14295F]">
                      메인 비교 그래프와 진단 그래프를 분리해, 좁은 3열 구간 없이 읽히도록 정리했습니다.
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5c6e97]">
                      상단에서는 성장과 일간 변화를 비교하고, 아래에서는 리듬, 시간대, 외출, 위험 신호를 넓은 카드 폭으로 이어서 볼 수 있습니다.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-white px-3 py-1 text-[10px] font-black text-[#2554d4]">성장 비교 2장</Badge>
                    <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-white px-3 py-1 text-[10px] font-black text-[#2554d4]">리듬 진단 3장</Badge>
                    <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-white px-3 py-1 text-[10px] font-black text-[#2554d4]">위험 요약 1장</Badge>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
            <Card className={detailGrowthChartCardClass}>
              <CardHeader className={detailChartHeaderClass}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={detailBadgeClass}>주간 성장</Badge>
                      <Badge variant="outline" className={detailGrowthPeriodBadgeClass}>최근 6주</Badge>
                    </div>
                    <CardTitle className={cn('mt-3 text-[clamp(1rem,1.45vw,1.28rem)]', detailGrowthTitleClass)}>주간 학습시간 성장률</CardTitle>
                    <CardDescription className={cn('text-sm leading-6', detailGrowthDescriptionClass)}>주간 누적 학습시간과 전주 대비 변화를 함께 읽습니다.</CardDescription>
                  </div>
                  <div className={detailMetricChipClass}>
                    <p className={analysisChipLabelClass}>이번 주 성장</p>
                    <p className={cn('mt-1 text-lg font-black leading-none tracking-tight', latestWeeklyLearningGrowthPercent >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
                      {formatSignedPercent(latestWeeklyLearningGrowthPercent)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className={detailChartContentClass}>
                {hasWeeklyGrowthData ? (
                  <>
                    <div className={detailChartPanelClass}>
                      <ResponsiveContainer width="100%" height={282}>
                        <ComposedChart data={weeklyGrowthData} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                          <defs>
                            <linearGradient id="detailWeeklyGrowthBarGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#2f65ff" />
                              <stop offset="70%" stopColor="#6f8fff" />
                              <stop offset="100%" stopColor="#bdd0ff" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} tickMargin={8} />
                      <YAxis yAxisId="mins" tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} width={38} tickFormatter={(value) => hourTickFormatter(Number(value) / 60)} />
                      <YAxis yAxisId="growth" orientation="right" tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickSoftColor }} tickLine={false} axisLine={analysisChartAxisLine} width={34} domain={[-20, 20]} tickFormatter={(value) => `${value}%`} />
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

            <Card className={detailGrowthChartCardClass}>
              <CardHeader className={detailChartHeaderClass}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={detailBadgeClass}>일간 흐름</Badge>
                      <Badge variant="outline" className={detailGrowthAccentPeriodBadgeClass}>{dailyGrowthWindowLabel}</Badge>
                    </div>
                    <CardTitle className={cn('mt-3 text-[clamp(1rem,1.45vw,1.28rem)]', detailGrowthTitleClass)}>일자별 학습시간 성장률</CardTitle>
                    <CardDescription className={cn('text-sm leading-6', detailGrowthDescriptionClass)}>선택한 7일 구간의 평균 공부시간과 변화 폭을 같이 봅니다.</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={detailMetricChipClass}>
                      <p className={analysisChipLabelClass}>최근 7일</p>
                      <p className={cn('mt-1 text-lg font-black tracking-tight', latestDailyLearningGrowthPercent >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
                        {formatSignedPercent(latestDailyLearningGrowthPercent)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className={cn('h-8 rounded-full px-3 text-[11px] font-black', isAnalysisPresentation && detailWindowNavButtonClass)} onClick={() => setDailyGrowthWindowIndex((prev) => Math.min(dailyGrowthWindowCount - 1, prev + 1))} disabled={boundedDailyGrowthWindowIndex >= dailyGrowthWindowCount - 1}>이전 7일</Button>
                      <Button variant="outline" size="sm" className={cn('h-8 rounded-full px-3 text-[11px] font-black', isAnalysisPresentation && detailWindowNavButtonClass)} onClick={() => setDailyGrowthWindowIndex((prev) => Math.max(0, prev - 1))} disabled={boundedDailyGrowthWindowIndex <= 0}>다음 7일</Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className={detailChartContentClass}>
                {hasDailyGrowthData ? (
                  <>
                    <div className={detailChartPanelClass}>
                      <ResponsiveContainer width="100%" height={282}>
                        <ComposedChart data={dailyGrowthWindowData} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                          <defs>
                            <linearGradient id="detailDailyGrowthBarGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#76d0ff" />
                              <stop offset="70%" stopColor="#8ed7ff" />
                              <stop offset="100%" stopColor="#d4f1ff" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} tickMargin={8} interval={0} />
                      <YAxis yAxisId="mins" tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} width={38} tickFormatter={(value) => hourTickFormatter(Number(value) / 60)} />
                      <YAxis yAxisId="growth" orientation="right" tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickSoftColor }} tickLine={false} axisLine={analysisChartAxisLine} width={36} domain={[-100, 100]} tickFormatter={(value) => `${value}%`} />
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
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
            <div className="grid gap-4">
            <Card className={detailChartCardClass}>
              <CardHeader className={detailChartHeaderClass}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={detailBadgeClass}>리듬 분석</Badge>
                      <Badge variant="outline" className="rounded-full border-[#d5f2e7] bg-white/82 text-[10px] font-black text-[#0f8f65]">최근 14일</Badge>
                    </div>
                    <CardTitle className={cn('font-aggro-display mt-3 break-keep text-[clamp(1rem,1.45vw,1.28rem)] font-black tracking-tight', detailGrowthTitleClass)}>리듬 점수 그래프</CardTitle>
                    <CardDescription className={cn('mt-1 text-sm font-semibold leading-6', detailGrowthDescriptionClass)}>시작 시간 흔들림을 점수로 바꿔 리듬 안정성을 봅니다.</CardDescription>
                  </div>
                  <div className={detailMetricChipClass}>
                    <p className={analysisChipLabelClass}>평균 / 최신</p>
                    <p className="mt-1 text-lg font-black tracking-tight text-[#0f8f65]">{averageRhythmScore}점</p>
                    <p className={analysisChipSubLabelClass}>최신 {latestRhythmScore}점</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className={detailChartContentClass}>
                <div className={detailChartPanelClass}>
                  <ResponsiveContainer width="100%" height={268}>
                    <AreaChart data={rhythmScoreOnlyTrend} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="detailRhythmGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#17b777" stopOpacity={0.34} />
                          <stop offset="100%" stopColor="#17b777" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} axisLine={analysisChartAxisLine} tickLine={false} tickMargin={8} interval={1} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} axisLine={analysisChartAxisLine} tickLine={false} width={30} domain={[0, 100]} />
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
                      <Badge className={detailBadgeClass}>시간대 흐름</Badge>
                      <Badge variant="outline" className="rounded-full border-[#eadfff] bg-white/82 text-[10px] font-black text-[#7d4ed8]">최근 14일</Badge>
                    </div>
                    <CardTitle className={cn('font-aggro-display mt-3 break-keep text-[clamp(1rem,1.45vw,1.28rem)] font-black tracking-tight', detailGrowthTitleClass)}>공부 시작/종료 시각 추이</CardTitle>
                    <CardDescription className={cn('mt-1 text-sm font-semibold leading-6', detailGrowthDescriptionClass)}>시작과 종료 시각으로 생활 리듬을 비교합니다.</CardDescription>
                  </div>
                  <div className={detailMetricChipClass}>
                    <p className={analysisChipLabelClass}>마지막 기록</p>
                    <p className={cn("mt-1 text-sm font-black tracking-tight", analysisChipPrimaryTextClass)}>{latestStartEndSnapshot.start} 시작</p>
                    <p className="text-sm font-black tracking-tight text-[#7d4ed8]">{latestStartEndSnapshot.end} 종료</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className={detailChartContentClass}>
                <div className={detailChartPanelClass}>
                  <ResponsiveContainer width="100%" height={268}>
                    <RechartsLineChart data={startEndTimeTrendData} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} tickMargin={8} interval={1} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} width={42} domain={[0, 24]} tickFormatter={(value) => hourToClockLabel(Number(value))} />
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

            </div>

            <div className="grid gap-4">
            <Card className={detailChartCardClass}>
              <CardHeader className={detailChartHeaderClass}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={detailBadgeClass}>외출 흐름</Badge>
                      <Badge variant="outline" className="rounded-full border-[#ffdbe2] bg-white/82 text-[10px] font-black text-[#dc4b74]">최근 14일</Badge>
                    </div>
                    <CardTitle className={cn('font-aggro-display mt-3 break-keep text-[clamp(1rem,1.45vw,1.28rem)] font-black tracking-tight', detailGrowthTitleClass)}>학습 중간 외출시간 추이</CardTitle>
                    <CardDescription className={cn('mt-1 text-sm font-semibold leading-6', detailGrowthDescriptionClass)}>외출이 집중 흐름을 얼마나 끊는지 확인합니다.</CardDescription>
                  </div>
                  <div className={detailMetricChipClass}>
                    <p className={analysisChipLabelClass}>평균 외출</p>
                    <p className="mt-1 text-lg font-black tracking-tight text-[#dc4b74]">{averageAwayMinutes}분</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className={detailChartContentClass}>
                <div className={detailChartPanelClass}>
                  <ResponsiveContainer width="100%" height={268}>
                    <ComposedChart data={awayTimeData} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="detailAwayBarGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ff8aa6" />
                          <stop offset="70%" stopColor="#ffb0bc" />
                          <stop offset="100%" stopColor="#ffe2e8" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} tickMargin={8} interval={1} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} width={34} tickFormatter={(value) => `${value}m`} />
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

            </div>
          </motion.section>
          )}

          {!isAnalysisPresentation && isMobile ? (
            <motion.section {...defaultSectionMotion(0.18)} className="space-y-4">
              {!isAnalysisPresentation ? (
                <div className="rounded-[1.75rem] border border-[#dbe7ff] bg-[linear-gradient(180deg,#ffffff_0%,#f7faff_100%)] px-4 py-4 shadow-[0_24px_60px_-52px_rgba(20,41,95,0.34)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="rounded-full border border-[#dbe7ff] bg-white px-2.5 py-1 text-[10px] font-black text-[#14295F]">
                      모바일 그래프 레일
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-[#f8fbff] px-2.5 py-1 text-[10px] font-black text-[#2554d4]">
                      세로 스택 보기
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm font-black leading-6 text-[#14295F]">
                    작은 화면에서는 같은 그래프를 순서대로 끊어 읽을 수 있게 성장, 리듬, 시간대, 외출 흐름으로 정렬했습니다.
                  </p>
                </div>
              ) : null}
              <div className="grid gap-4">
                <Card className={detailGrowthChartCardClass}>
                  <CardHeader className={detailChartHeaderClass}>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={detailBadgeClass}>주간 성장</Badge>
                        <Badge variant="outline" className={detailGrowthPeriodBadgeClass}>최근 6주</Badge>
                      </div>
                      <div className={detailMetricHeaderClass}>
                        <div className="min-w-0">
                          <CardTitle className={cn('font-aggro-display text-[1rem]', detailGrowthTitleClass)}>주간 학습시간 성장률</CardTitle>
                          <CardDescription className={cn('text-[12px] leading-5', detailGrowthDescriptionClass)}>주간 누적 학습시간과 전주 대비 변화를 함께 읽습니다.</CardDescription>
                        </div>
                        <div className={detailMetricChipClass}>
                          <p className={analysisChipLabelClass}>이번 주 성장</p>
                          <p className={cn('mt-1 text-base font-black leading-none tracking-tight', latestWeeklyLearningGrowthPercent >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
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
                          <ResponsiveContainer width="100%" height={236}>
                            <ComposedChart data={weeklyGrowthData} margin={mobileAnalysisDualAxisMargin}>
                              <defs>
                                <linearGradient id="detailWeeklyGrowthBarGradientMobile" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#2f65ff" />
                                  <stop offset="70%" stopColor="#6f8fff" />
                                  <stop offset="100%" stopColor="#bdd0ff" />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} tickMargin={8} />
                      <YAxis yAxisId="mins" tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} width={mobileAnalysisMinutesAxisWidth} tickFormatter={(value) => hourTickFormatter(Number(value) / 60)} />
                      <YAxis yAxisId="growth" orientation="right" tick={{ fontSize: 9, fontWeight: 800, fill: analysisChartTickSoftColor }} tickLine={false} axisLine={analysisChartAxisLine} width={mobileAnalysisGrowthAxisWidth} domain={[-20, 20]} tickFormatter={(value) => `${value}%`} />
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

                <Card className={detailGrowthChartCardClass}>
                  <CardHeader className={detailChartHeaderClass}>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={detailBadgeClass}>일간 흐름</Badge>
                        <Badge variant="outline" className={detailGrowthAccentPeriodBadgeClass}>{dailyGrowthWindowLabel}</Badge>
                      </div>
                      <div className={detailMetricHeaderClass}>
                        <div className="min-w-0">
                          <CardTitle className={cn('font-aggro-display text-[1rem]', detailGrowthTitleClass)}>일자별 학습시간 성장률</CardTitle>
                          <CardDescription className={cn('text-[12px] leading-5', detailGrowthDescriptionClass)}>선택한 7일 구간의 평균 공부시간과 변화 폭을 같이 봅니다.</CardDescription>
                        </div>
                        <div className={detailMetricChipClass}>
                          <p className={analysisChipLabelClass}>최근 7일</p>
                          <p className={cn('mt-1 text-base font-black tracking-tight', latestDailyLearningGrowthPercent >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
                            {formatSignedPercent(latestDailyLearningGrowthPercent)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className={cn(detailChartContentClass, 'space-y-3')}>
                    <div className={cn(isMobile ? "flex flex-col items-stretch gap-2.5" : "flex items-center justify-between gap-2")}>
                      <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-white/82 text-[10px] font-black text-[#2554d4]">
                        {dailyGrowthWindowCount - boundedDailyGrowthWindowIndex}/{dailyGrowthWindowCount} 구간
                      </Badge>
                      <div className={cn(isMobile ? "grid grid-cols-2 gap-2" : "flex items-center gap-2")}>
                        <Button variant="outline" size="sm" className={cn('h-8 rounded-full px-3 text-[11px] font-black', isMobile && 'w-full justify-center', isAnalysisPresentation && detailWindowNavButtonClass)} onClick={() => setDailyGrowthWindowIndex((prev) => Math.min(dailyGrowthWindowCount - 1, prev + 1))} disabled={boundedDailyGrowthWindowIndex >= dailyGrowthWindowCount - 1}>이전 7일</Button>
                        <Button variant="outline" size="sm" className={cn('h-8 rounded-full px-3 text-[11px] font-black', isMobile && 'w-full justify-center', isAnalysisPresentation && detailWindowNavButtonClass)} onClick={() => setDailyGrowthWindowIndex((prev) => Math.max(0, prev - 1))} disabled={boundedDailyGrowthWindowIndex <= 0}>다음 7일</Button>
                      </div>
                    </div>
                    {hasDailyGrowthData ? (
                      <>
                        <div className={detailChartPanelClass}>
                          <ResponsiveContainer width="100%" height={236}>
                            <ComposedChart data={dailyGrowthWindowData} margin={mobileAnalysisDualAxisMargin}>
                              <defs>
                                <linearGradient id="detailDailyGrowthBarGradientMobile" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#76d0ff" />
                                  <stop offset="70%" stopColor="#8ed7ff" />
                                  <stop offset="100%" stopColor="#d4f1ff" />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} tickMargin={8} interval={1} />
                      <YAxis yAxisId="mins" tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} width={mobileAnalysisMinutesAxisWidth} tickFormatter={(value) => hourTickFormatter(Number(value) / 60)} />
                      <YAxis yAxisId="growth" orientation="right" tick={{ fontSize: 9, fontWeight: 800, fill: analysisChartTickSoftColor }} tickLine={false} axisLine={analysisChartAxisLine} width={mobileAnalysisGrowthAxisWidth} domain={[-100, 100]} tickFormatter={(value) => `${value}%`} />
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
                        <Badge className={detailBadgeClass}>리듬 분석</Badge>
                        <Badge variant="outline" className="rounded-full border-[#d5f2e7] bg-white/82 text-[10px] font-black text-[#0f8f65]">최근 14일</Badge>
                      </div>
                      <div className={detailMetricHeaderClass}>
                        <div className="min-w-0">
                          <CardTitle className={cn('font-aggro-display break-keep text-[1rem] font-black tracking-tight', detailGrowthTitleClass)}>리듬 점수 그래프</CardTitle>
                          <CardDescription className={cn('mt-1 text-[12px] font-semibold leading-5', detailGrowthDescriptionClass)}>시작 시간 흔들림을 점수로 바꿔 리듬 안정성을 봅니다.</CardDescription>
                        </div>
                        <div className={detailMetricChipClass}>
                          <p className={analysisChipLabelClass}>평균 / 최신</p>
                          <p className="mt-1 text-base font-black tracking-tight text-[#0f8f65]">{averageRhythmScore}점</p>
                          <p className={analysisChipSubLabelClass}>최신 {latestRhythmScore}점</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className={detailChartContentClass}>
                    <div className={detailChartPanelClass}>
                      <ResponsiveContainer width="100%" height={236}>
                        <AreaChart data={rhythmScoreOnlyTrend} margin={mobileAnalysisSingleAxisMargin}>
                          <defs>
                            <linearGradient id="detailRhythmGradientMobile" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#17b777" stopOpacity={0.34} />
                              <stop offset="100%" stopColor="#17b777" stopOpacity={0.04} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} axisLine={analysisChartAxisLine} tickLine={false} tickMargin={8} interval={1} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} axisLine={analysisChartAxisLine} tickLine={false} width={mobileAnalysisScoreAxisWidth} domain={[0, 100]} />
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
                        <Badge className={detailBadgeClass}>시간대 흐름</Badge>
                        <Badge variant="outline" className="rounded-full border-[#eadfff] bg-white/82 text-[10px] font-black text-[#7d4ed8]">최근 14일</Badge>
                      </div>
                      <div className={detailMetricHeaderClass}>
                        <div className="min-w-0">
                          <CardTitle className={cn('font-aggro-display break-keep text-[1rem] font-black tracking-tight', detailGrowthTitleClass)}>공부 시작/종료 시각 추이</CardTitle>
                          <CardDescription className={cn('mt-1 text-[12px] font-semibold leading-5', detailGrowthDescriptionClass)}>시작과 종료 시각으로 생활 리듬을 비교합니다.</CardDescription>
                        </div>
                        <div className={detailMetricChipClass}>
                          <p className={analysisChipLabelClass}>마지막 기록</p>
                          <p className={cn("mt-1 text-[11px] font-black tracking-tight", analysisChipPrimaryTextClass)}>{latestStartEndSnapshot.start} 시작</p>
                          <p className="text-[11px] font-black tracking-tight text-[#7d4ed8]">{latestStartEndSnapshot.end} 종료</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className={detailChartContentClass}>
                    <div className={detailChartPanelClass}>
                      <ResponsiveContainer width="100%" height={236}>
                        <RechartsLineChart data={startEndTimeTrendData} margin={mobileAnalysisSingleAxisMargin}>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} tickMargin={8} interval={1} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} width={mobileAnalysisClockAxisWidth} domain={[0, 24]} tickFormatter={(value) => hourToClockLabel(Number(value))} />
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
                        <Badge className={detailBadgeClass}>외출 흐름</Badge>
                        <Badge variant="outline" className="rounded-full border-[#ffdbe2] bg-white/82 text-[10px] font-black text-[#dc4b74]">최근 14일</Badge>
                      </div>
                      <div className={detailMetricHeaderClass}>
                        <div className="min-w-0">
                          <CardTitle className={cn('font-aggro-display break-keep text-[1rem] font-black tracking-tight', detailGrowthTitleClass)}>학습 중간 외출시간 추이</CardTitle>
                          <CardDescription className={cn('mt-1 text-[12px] font-semibold leading-5', detailGrowthDescriptionClass)}>외출이 집중 흐름을 얼마나 끊는지 확인합니다.</CardDescription>
                        </div>
                        <div className={detailMetricChipClass}>
                          <p className={analysisChipLabelClass}>평균 외출</p>
                          <p className="mt-1 text-base font-black tracking-tight text-[#dc4b74]">{averageAwayMinutes}분</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className={detailChartContentClass}>
                    <div className={detailChartPanelClass}>
                      <ResponsiveContainer width="100%" height={236}>
                        <ComposedChart data={awayTimeData} margin={mobileAnalysisSingleAxisMargin}>
                          <defs>
                            <linearGradient id="detailAwayBarGradientMobile" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#ff8aa6" />
                              <stop offset="70%" stopColor="#ffb0bc" />
                              <stop offset="100%" stopColor="#ffe2e8" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e7eefb" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} tickMargin={8} interval={1} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} width={mobileAnalysisAwayAxisWidth} tickFormatter={(value) => `${value}m`} />
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

                <Card className={cn(detailChartCardClass, isAnalysisPresentation && "analysis-full-conclusion-card")}>
                  <CardHeader className={cn(detailChartHeaderClass, "pb-2")}>
                    <div className="space-y-2">
                      <Badge className={cn("w-fit rounded-full px-2.5 py-1 text-[10px] font-black", isAnalysisPresentation ? "bg-[#FFF1DE] text-[#17326B]" : "border border-[#dbe7ff] bg-[#f8fbff] text-[#14295F]")}>
                        우선순위 결론
                      </Badge>
                      <CardTitle className={cn("font-aggro-display text-base font-black tracking-tight flex items-center gap-2", analysisRequestedTitleClass)}><AlertTriangle className="h-4 w-4 text-rose-500" /> 위험 신호 및 지원 우선순위</CardTitle>
                      <CardDescription className={cn("text-[12px] font-semibold leading-5", detailGrowthDescriptionClass)}>
                        지원이 필요한 포인트를 한 문장과 대응 신호로 정리했습니다.
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className={cn(
                      "rounded-xl border px-4 py-3",
                      isAnalysisPresentation ? "analysis-full-conclusion-panel" : "border-[#dbe7ff] bg-[#f8fbff]"
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
            </motion.section>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-12">
                <Card className={cn("lg:col-span-8", detailChartCardClass, isAnalysisPresentation && "analysis-chart-stage")}>
                  <CardHeader className="pb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge className={detailBadgeClass}>운영 그래프</Badge>
                        <Badge variant="outline" className={detailGrowthPeriodBadgeClass}>{RANGE_MAP[focusedChartView]}일 관찰</Badge>
                      </div>
                      <CardTitle className={cn("text-xl font-black tracking-tight flex items-center gap-2", isAnalysisPresentation ? "text-[var(--text-on-dark)]" : "text-[#14295F]")}><Activity className={cn("h-5 w-5 text-primary", isAnalysisPresentation && "text-white")} /> 공부시간 추이</CardTitle>
                      <CardDescription className={cn("font-bold text-[11px]", isAnalysisPresentation ? "text-white/85" : "text-[#5c6e97]")}>집중 시간이 흔들리는 구간을 먼저 읽고 리듬 변화 해석까지 연결합니다.</CardDescription>
                    </div>
                    <div className={cn("flex gap-1 rounded-xl p-1 w-fit", isAnalysisPresentation ? "bg-white/8" : "border border-[#dbe7ff] bg-[#f8fbff]")}>
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
                            <linearGradient id="studyMinutesGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={analysisStudyTrendStrokeColor} stopOpacity={isAnalysisPresentation ? 0.28 : 0.35} /><stop offset="95%" stopColor={analysisStudyTrendStrokeColor} stopOpacity={isAnalysisPresentation ? 0.04 : 0.02} /></linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={analysisChartGridColor} />
                          <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} />
                          <YAxis tick={{ fontSize: 11, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} width={38} />
                          <Tooltip content={<CustomTooltip unit="분" presentationMode={presentationMode} />} />
                          <Area type="monotone" dataKey="studyMinutes" stroke={analysisStudyTrendStrokeColor} strokeWidth={3} fill="url(#studyMinutesGradient)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className={cn("lg:col-span-4", detailChartCardClass, isAnalysisPresentation && "analysis-chart-stage")}>
                  <CardHeader className="pb-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge className={detailBadgeClass}>실행력 점검</Badge>
                    </div>
                    <CardTitle className={cn("text-xl font-black tracking-tight flex items-center gap-2", analysisRequestedTitleClass)}><CheckCircle2 className="h-5 w-5 text-amber-500" /> 계획 완수율</CardTitle>
                    <CardDescription className={cn("font-bold text-[11px]", isAnalysisPresentation ? "text-white/85" : "text-[#5c6e97]")}>일별 완료율로 실행력의 안정성과 흔들리는 날짜를 점검합니다.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={displaySeries} margin={{ top: 12, right: 0, left: -16, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f2f2f2" />
                          <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} />
                          <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} width={32} domain={[0, 100]} />
                          <Tooltip content={<CustomTooltip unit="%" presentationMode={presentationMode} />} />
                          <Bar dataKey="completionRate" radius={[8, 8, 0, 0]} fill="#f59e0b" barSize={14} />
                          <Line type="monotone" dataKey="completionRate" stroke="#b45309" strokeWidth={2.5} dot={{ r: 3, fill: '#fff7ed', stroke: '#b45309', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#fff7ed', stroke: '#b45309', strokeWidth: 2 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

                <Card className={cn(detailChartCardClass, isAnalysisPresentation && "analysis-chart-stage")}>
                  <CardHeader className={cn(detailChartHeaderClass, "pb-2")}>
                    <div className="space-y-2">
                      <Badge className={cn("w-fit rounded-full px-2.5 py-1 text-[10px] font-black", isAnalysisPresentation ? "bg-[#FFF1DE] text-[#17326B]" : "border border-[#dbe7ff] bg-[#f8fbff] text-[#14295F]")}>
                        위험 리포트
                      </Badge>
                      <CardTitle className={cn("text-lg font-black tracking-tight flex items-center gap-2", analysisRequestedTitleClass)}><AlertTriangle className="h-4 w-4 text-rose-500" /> 위험 신호 및 지원 우선순위</CardTitle>
                      <CardDescription className={cn("text-[12px] font-semibold leading-5", detailGrowthDescriptionClass)}>
                        최근 흐름에서 지금 개입해야 할 포인트만 짧게 압축했습니다.
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                  <div className="rounded-xl border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3">
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

        <TabsContent value="counseling" className={cn("space-y-6 mt-0", isAnalysisPresentation && "analysis-full-tab-panel")}>
          {!isAnalysisPresentation ? (
            <motion.section
              {...defaultSectionMotion(0.16)}
              className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'md:grid-cols-3')}
            >
              {counselingSummaryCards.map((item) => (
                <div key={item.key} className={cn('rounded-[1.8rem] border px-4 py-4 shadow-[0_22px_56px_-52px_rgba(20,41,95,0.42)]', item.accentClass)}>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">{item.label}</p>
                  <p className={cn('mt-3 text-2xl font-black tracking-tight', item.valueClass)}>{item.value}</p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[#5c6e97]">{item.helper}</p>
                </div>
              ))}
            </motion.section>
          ) : null}
          <div className={cn('grid gap-6', isAnalysisPresentation ? (isMobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]') : 'lg:grid-cols-12')}>
            <Card className={cn("rounded-[2rem] border border-[#dbe7ff] bg-white shadow-[0_28px_70px_-56px_rgba(20,41,95,0.38)]", !isAnalysisPresentation && "lg:col-span-5", isAnalysisPresentation && "analysis-full-section-card border-none shadow-lg")}>
              <CardHeader className="space-y-2">
                {!isAnalysisPresentation ? (
                  <Badge className="w-fit rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-2.5 py-1 text-[10px] font-black text-[#14295F]">
                    상담 예약 상태
                  </Badge>
                ) : null}
                <CardTitle className={cn("font-aggro-display text-xl font-black tracking-tight flex items-center gap-2", isAnalysisPresentation ? "text-[var(--text-on-dark)]" : "text-[#14295F]")}><CalendarCheck2 className="h-5 w-5 text-indigo-500" /> 상담 예약 일정</CardTitle>
                <CardDescription className={cn("text-[12px] font-semibold leading-5", isAnalysisPresentation ? "text-[var(--text-on-dark-soft)]" : "text-[#5c6e97]")}>
                  예정, 완료, 지난 일정을 구분해 다음 상담 운영 흐름을 바로 읽습니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {reservationLoading ? (
                  <div className="flex items-center justify-center h-36 text-[#5c6e97]"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : studentReservations.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#dbe7ff] py-8 text-center text-sm font-bold text-[#5c6e97]">등록된 상담 예약이 없습니다.</div>
                ) : (
                  studentReservations.slice(0, 8).map((reservation) => {
                    const scheduledAt = reservation.scheduledAt?.toDate();
                    const isPast = scheduledAt ? isBefore(scheduledAt, startOfDay(today)) : false;
                    return (
                    <div key={reservation.id} className={cn("rounded-xl border border-[#dbe7ff] bg-[#f8fbff] px-3 py-3", isAnalysisPresentation && "analysis-record-card")}>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="text-sm font-black text-[#14295F]">{scheduledAt ? format(scheduledAt, 'M월 d일 (EEE) HH:mm', { locale: ko }) : '일정 미기입'}</p>
                          <Badge className={cn('rounded-full px-2.5 text-[10px] font-black', reservation.status === 'done' && 'bg-emerald-50 text-emerald-700', reservation.status === 'confirmed' && 'bg-[#EEF4FF] text-[#2554D4]', reservation.status === 'requested' && 'bg-amber-50 text-amber-700', reservation.status === 'canceled' && 'bg-[#F1F6FF] text-[#14295F]')}>{STATUS_LABEL[reservation.status]}</Badge>
                        </div>
                        <p className="text-xs font-bold text-[#5c6e97]">담당: {reservation.teacherName || '담당 선생님'}{isPast ? ' · 지난 일정' : ' · 예정 일정'}</p>
                        {reservation.teacherNote && <p className="mt-1 text-xs font-semibold text-[#5c6e97]">메모: {reservation.teacherNote}</p>}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

              <Card className={cn("rounded-[2rem] border border-[#dbe7ff] bg-white shadow-[0_28px_70px_-56px_rgba(20,41,95,0.38)]", !isAnalysisPresentation && "lg:col-span-7", isAnalysisPresentation && "analysis-full-section-card border-none shadow-lg")}>
                <CardHeader className="space-y-2">
                  {!isAnalysisPresentation ? (
                    <Badge className="w-fit rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-2.5 py-1 text-[10px] font-black text-[#14295F]">
                      상담 기록 캔버스
                    </Badge>
                  ) : null}
                  <CardTitle className={cn("font-aggro-display text-xl font-black tracking-tight flex items-center gap-2", isAnalysisPresentation ? "text-[var(--text-on-dark)]" : "text-[#14295F]")}><MessageSquare className="h-5 w-5 text-rose-500" /> 개인 상담 일지</CardTitle>
                  <CardDescription className={cn("text-[12px] font-semibold leading-5", isAnalysisPresentation ? "text-[var(--text-on-dark-soft)]" : "text-[#5c6e97]")}>
                    최근 피드백과 상담 일지를 연결해 다음 대화 포인트를 바로 확인합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className={cn("rounded-2xl border border-[#ffd9b7] bg-[#fff8f2] p-3.5 shadow-sm", isAnalysisPresentation && "analysis-full-highlight-panel")}>
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
                      <div className="rounded-xl border border-dashed border-[#ffd7b6] bg-white px-3 py-4 text-center text-xs font-bold text-[#5c6e97]">
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
                              <span className="text-[10px] font-bold text-[#5c6e97]">
                                {feedback.createdAt ? format(feedback.createdAt.toDate(), 'yyyy.MM.dd HH:mm', { locale: ko }) : '작성 시각 없음'}
                              </span>
                            </div>
                            <p className="text-sm font-bold leading-relaxed text-[#14295F]">{feedback.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {counselingLoading ? (
                    <div className="flex items-center justify-center h-36 text-[#5c6e97]"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : studentCounselingLogs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#dbe7ff] py-8 text-center text-sm font-bold text-[#5c6e97]">작성된 상담 일지가 없습니다.</div>
                ) : (
                  studentCounselingLogs.slice(0, 10).map((log) => {
                    const studentQuestion =
                      log.studentQuestion?.trim() ||
                      (log.reservationId ? reservationQuestionById.get(log.reservationId)?.trim() : '') ||
                      '';
                    return (
                    <div key={log.id} className={cn("rounded-xl border border-[#dbe7ff] bg-white px-3 py-3 shadow-sm", isAnalysisPresentation && "analysis-record-card")}>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <Badge className={cn(
                          "font-black text-[10px] rounded-full",
                          isAnalysisPresentation
                            ? "border border-[#F1DDC7] bg-[#FFF4E5] text-[#17326B] shadow-none"
                            : "border border-[#dbe7ff] bg-[#eef4ff] text-[#14295F]"
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
                        <span className="text-xs font-bold text-[#5c6e97]">{log.createdAt ? format(log.createdAt.toDate(), 'yyyy.MM.dd HH:mm', { locale: ko }) : '작성 시각 없음'}</span>
                        <span className="text-xs font-bold text-[#5c6e97]">· {log.teacherName || '담당 선생님'}</span>
                      </div>
                      {studentQuestion && (
                        <div className="mb-2 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-2">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-sky-700">학생 질문</p>
                          <p className="text-sm font-bold leading-relaxed text-sky-900 whitespace-pre-wrap">{studentQuestion}</p>
                        </div>
                      )}
                      <p className="text-sm font-bold leading-relaxed text-[#14295F]">{log.content}</p>
                      {log.improvement && <div className="mt-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-700">개선 포인트: {log.improvement}</div>}
                    </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plans" className={cn("space-y-6 mt-0", isAnalysisPresentation && "analysis-full-tab-panel")}>
          {isAnalysisPresentation ? (
            <div className={cn('grid gap-4', isAnalysisPresentation ? (isMobile ? 'grid-cols-1' : 'grid-cols-3') : 'md:grid-cols-3')}>
              <Card className={cn("rounded-[2rem] border-none shadow-lg bg-white", isAnalysisPresentation && "analysis-full-mini-stat-card")}><CardHeader className="pb-2"><CardTitle className={cn("font-aggro-display text-lg font-black tracking-tight flex items-center gap-2", isAnalysisPresentation && "text-[var(--text-on-dark)]")}><CalendarDays className="h-4 w-4 text-primary" /> 오늘 학습 계획</CardTitle></CardHeader><CardContent><p className={cn("font-aggro-display text-3xl font-black tracking-tight text-primary", isAnalysisPresentation && "text-[var(--text-on-dark)]")}>{todayPlanSummary.studyDone}/{todayPlanSummary.studyTotal}</p><p className={cn("text-xs font-bold text-muted-foreground mt-1", isAnalysisPresentation && "text-[var(--text-on-dark-soft)]")}>완료 / 전체 학습 할 일</p></CardContent></Card>
              <Card className={cn("rounded-[2rem] border-none shadow-lg bg-white", isAnalysisPresentation && "analysis-full-mini-stat-card")}><CardHeader className="pb-2"><CardTitle className={cn("font-aggro-display text-lg font-black tracking-tight flex items-center gap-2", isAnalysisPresentation && "text-[var(--text-on-dark)]")}><Timer className="h-4 w-4 text-blue-500" /> 오늘 루틴 수</CardTitle></CardHeader><CardContent><p className={cn("font-aggro-display text-3xl font-black tracking-tight text-blue-600", isAnalysisPresentation && "text-[var(--text-on-dark)]")}>{todayPlanSummary.routineCount}</p><p className={cn("text-xs font-bold text-muted-foreground mt-1", isAnalysisPresentation && "text-[var(--text-on-dark-soft)]")}>등원/식사/학원 등 시간 루틴</p></CardContent></Card>
              <Card className={cn("rounded-[2rem] border-none shadow-lg bg-white", isAnalysisPresentation && "analysis-full-mini-stat-card")}><CardHeader className="pb-2"><CardTitle className={cn("font-aggro-display text-lg font-black tracking-tight flex items-center gap-2", isAnalysisPresentation && "text-[var(--text-on-dark)]")}><PlusCircle className="h-4 w-4 text-amber-500" /> 개인 할 일</CardTitle></CardHeader><CardContent><p className={cn("font-aggro-display text-3xl font-black tracking-tight text-amber-600", isAnalysisPresentation && "text-[var(--text-on-dark)]")}>{todayPlanSummary.personalCount}</p><p className={cn("text-xs font-bold text-muted-foreground mt-1", isAnalysisPresentation && "text-[var(--text-on-dark-soft)]")}>생활/기타 개인 체크 항목</p></CardContent></Card>
            </div>
          ) : (
            <motion.section
              {...defaultSectionMotion(0.18)}
              className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'md:grid-cols-3')}
            >
              {planSummaryCards.map((item) => (
                <div key={item.key} className={cn('rounded-[1.8rem] border px-4 py-4 shadow-[0_22px_56px_-52px_rgba(20,41,95,0.42)]', item.accentClass)}>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">{item.label}</p>
                  <p className={cn('mt-3 font-aggro-display text-[2rem] font-black tracking-[-0.05em]', item.valueClass)}>{item.value}</p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[#5c6e97]">{item.helper}</p>
                </div>
              ))}
            </motion.section>
          )}

          {!isAnalysisPresentation ? (
            <motion.section
              {...defaultSectionMotion(0.2)}
              className="grid"
            >
              <Card className="rounded-[2rem] border border-[#dbe7ff] bg-white shadow-[0_28px_70px_-56px_rgba(20,41,95,0.38)]">
                <CardHeader className={cn(isMobile ? "px-4 pt-4 pb-3" : "px-5 pt-5 pb-4")}>
                  <div className={cn(isMobile ? "flex flex-col gap-3" : "flex items-start justify-between gap-4")}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-2.5 py-1 text-[10px] font-black text-[#14295F]">
                          오늘 계획 브리프
                        </Badge>
                        <Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-white px-2.5 py-1 text-[10px] font-black text-[#2554d4]">
                          오늘 기준
                        </Badge>
                      </div>
                      <CardTitle className="mt-3 font-aggro-display text-[1.15rem] font-black tracking-tight text-[#14295F]">
                        오늘 계획과 루틴을 먼저 점검하세요
                      </CardTitle>
                      <CardDescription className="mt-1 text-[12px] font-semibold leading-5 text-[#5c6e97]">
                        학습 할 일, 루틴, 개인 체크를 한 번에 읽고 오늘 보완이 필요한 지점을 먼저 확인합니다.
                      </CardDescription>
                    </div>
                    <div className="rounded-[1rem] border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">오늘 완료율</p>
                      <p className="mt-2 font-aggro-display text-[1.9rem] font-black tracking-[-0.05em] text-[#14295F]">
                        {todayPlanSummary.studyTotal > 0 ? Math.round((todayPlanSummary.studyDone / todayPlanSummary.studyTotal) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className={cn('grid gap-3', isMobile ? 'px-4 pb-4' : 'px-5 pb-5 md:grid-cols-4')}>
                  <div className="rounded-[1.2rem] border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">학습 할 일</p>
                    <p className="mt-2 text-xl font-black text-[#14295F]">{todayPlanSummary.studyDone}/{todayPlanSummary.studyTotal}</p>
                    <p className="mt-1 text-xs font-semibold text-[#5c6e97]">완료 / 전체 학습 계획</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">루틴 수</p>
                    <p className="mt-2 text-xl font-black text-[#14295F]">{todayPlanSummary.routineCount}개</p>
                    <p className="mt-1 text-xs font-semibold text-[#5c6e97]">등원, 식사, 학원 등 시간 루틴</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">개인 체크</p>
                    <p className="mt-2 text-xl font-black text-[#14295F]">{todayPlanSummary.personalCount}개</p>
                    <p className="mt-1 text-xs font-semibold text-[#5c6e97]">생활/기타 개인 항목</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-[#ffe1c5] bg-[#fff8f2] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d86a11]">운영 해석</p>
                    <p className="mt-2 text-sm font-black leading-6 text-[#14295F]">
                      {todayPlanSummary.studyTotal === 0
                        ? '오늘 등록된 학습 계획이 없어 계획 입력부터 확인이 필요합니다.'
                        : todayPlanSummary.studyDone >= todayPlanSummary.studyTotal
                          ? '오늘 계획은 모두 완료되어 유지 피드백 중심으로 운영하면 좋습니다.'
                          : '아직 남은 학습 계획이 있어 오늘 마감 전 보완 액션이 필요합니다.'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.section>
          ) : null}

          <Card className={cn("rounded-[2rem] border border-[#dbe7ff] bg-white shadow-[0_28px_70px_-56px_rgba(20,41,95,0.38)]", isAnalysisPresentation && "analysis-full-section-card border-none shadow-lg")}>
            <CardHeader className="space-y-2">
              {!isAnalysisPresentation ? (
                <Badge className="w-fit rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-2.5 py-1 text-[10px] font-black text-[#14295F]">
                  최근 실행 흐름
                </Badge>
              ) : null}
              <CardTitle className={cn("font-aggro-display text-xl font-black tracking-tight flex items-center gap-2", isAnalysisPresentation ? "text-[var(--text-on-dark)]" : "text-[#14295F]")}><BookOpen className="h-5 w-5 text-emerald-500" /> 과거 7일 계획/루틴</CardTitle>
              <CardDescription className={cn("text-[12px] font-semibold leading-5", isAnalysisPresentation ? "text-[var(--text-on-dark-soft)]" : "text-[#5c6e97]")}>
                오늘 계획 이후에는 최근 7일의 실행 흔적을 보고 루틴 안정성을 비교합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isDataLoading ? (
                <div className="flex items-center justify-center h-36 text-[#5c6e97]"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : pastPlanGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#dbe7ff] py-8 text-center text-sm font-bold text-[#5c6e97]">과거 7일 계획 데이터가 없습니다.</div>
              ) : (
                pastPlanGroups.map((group) => {
                  const date = new Date(`${group.dateKey}T00:00:00`);
                  return (
                    <div key={group.dateKey} className={cn("rounded-xl border border-[#dbe7ff] p-3.5 bg-[#f8fbff]", isAnalysisPresentation && "analysis-dual-lane-card")}>
                      <div className="mb-2 flex items-center justify-between"><p className="text-sm font-black text-[#14295F]">{format(date, 'M월 d일 (EEE)', { locale: ko })}</p><Badge variant="outline" className="rounded-full border-[#dbe7ff] bg-white font-black text-[10px] text-[#14295F]">학습 {group.studies.length} · 루틴 {group.routines.length}</Badge></div>
                      <div className={cn('grid gap-2', isAnalysisPresentation ? (isMobile ? 'grid-cols-1' : 'grid-cols-2') : 'md:grid-cols-2')}>
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
              : "bg-[linear-gradient(135deg,#14295F_0%,#173D8B_58%,#2554D4_100%)] text-white"
          )}>
            <DialogHeader>
              {!isAnalysisPresentation ? (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white">
                    {student?.name || '학생'}
                  </Badge>
                  <Badge className="rounded-full border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white/80">
                    {formatSeatLabel(student)}
                  </Badge>
                </div>
              ) : null}
              <DialogTitle className="text-2xl font-black tracking-tight">과거 7일 학습세션</DialogTitle>
              <DialogDescription className={cn("font-semibold", isAnalysisPresentation ? "text-[#5F7299]" : "text-white/80")}>
                날짜별 공부시간 세션을 확인하고 필요 시 수동 보정할 수 있습니다.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-4 bg-white">
            {recentStudySessions.length === 0 ? (
              <div className="rounded-[1.35rem] border border-dashed border-[#dbe7ff] py-8 text-center text-sm font-bold text-[#5c6e97]">
                표시할 학습세션이 없습니다.
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {recentStudySessions.map((session) => {
                  const adjustedMinutes = sessionAdjustments[session.dateKey] ?? session.minutes;
                  const isChanged = Math.max(0, Math.round(adjustedMinutes)) !== session.minutes;
                  return (
                    <div key={session.dateKey} className="rounded-[1.35rem] border border-[#dbe7ff] bg-[#f8fbff] px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-[#14295F]">{session.dateLabel}</p>
                          <p className="text-[11px] font-bold text-[#5c6e97]">
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
                              className="h-9 w-24 rounded-lg border-2 border-[#dbe7ff] text-right font-black text-[#14295F]"
                            />
                            <span className="text-xs font-black text-[#5c6e97]">분</span>
                          </div>
                        ) : (
                          <Badge className="border-none bg-[#eaf1ff] text-[#2554d4] font-black">
                            {minutesToLabel(session.minutes)}
                          </Badge>
                        )}
                      </div>
                      {isChanged && (
                        <p className="mt-2 text-[11px] font-black text-[#2554d4]">
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
                  <Button variant="outline" className="flex-1 rounded-xl border-[#dbe7ff] bg-white font-black text-[#14295F] hover:bg-[#f4f7ff]" onClick={() => setIsAvgStudyModalOpen(false)}>
                    닫기
                  </Button>
                  <Button
                    className="flex-1 rounded-xl bg-[#14295F] font-black text-white hover:bg-[#173D8B]"
                    onClick={handleSaveSessionAdjustments}
                    disabled={isSessionSaving || !hasSessionAdjustmentChanges}
                  >
                    {isSessionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : '세션 보정 저장'}
                  </Button>
                </div>
              ) : (
                <DialogClose asChild>
                  <Button className="rounded-xl bg-[#14295F] font-black text-white hover:bg-[#173D8B]">확인</Button>
                </DialogClose>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isRhythmGuideModalOpen} onOpenChange={setIsRhythmGuideModalOpen}>
        <DialogContent className="rounded-[2.25rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-2xl">
          <div className={cn(
            "px-6 py-5",
            isAnalysisPresentation
              ? "bg-[linear-gradient(135deg,#FFF8EE_0%,#FFE5C4_100%)] text-[#17326B]"
              : "bg-[linear-gradient(135deg,#14295F_0%,#173D8B_58%,#2554D4_100%)] text-white"
          )}>
            <DialogHeader>
              {!isAnalysisPresentation ? (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white">
                    {student?.name || '학생'}
                  </Badge>
                  <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white/80">
                    {formatSeatLabel(student)}
                  </Badge>
                  <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white/80">
                    리듬 안내
                  </Badge>
                </div>
              ) : null}
              <DialogTitle className="text-2xl font-black tracking-tight">평균 공부 리듬 그래프</DialogTitle>
              <DialogDescription className={cn("font-semibold", isAnalysisPresentation ? "text-[#5F7299]" : "text-white/80")}>
                최근 {RANGE_MAP[focusedChartView]}일 공부시간 흐름을 보고, 리듬 점수가 어떤 기준으로 계산되는지 함께 확인합니다.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 bg-white px-6 py-5">
            <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]")}>
              <div className="rounded-[1.6rem] border border-[#dbe7ff] bg-white p-4 shadow-[0_24px_56px_-44px_rgba(20,41,95,0.24)]">
                <div className={cn("mb-3 flex gap-1 rounded-xl p-1 w-fit", isAnalysisPresentation ? "bg-[#17326B]/8" : "border border-[#dbe7ff] bg-[#f8fbff]")}>
                  {(['today', 'weekly', 'monthly'] as ChartRangeKey[]).map((key) => (
                    <Button
                      key={key}
                      variant={focusedChartView === key ? 'default' : 'ghost'}
                      className={cn(
                        "h-8 px-3 rounded-lg text-[10px] font-black",
                        !isAnalysisPresentation && focusedChartView !== key && "text-[#14295F] hover:bg-white hover:text-[#14295F]"
                      )}
                      onClick={() => setFocusedChartView(key)}
                    >
                      {RANGE_MAP[key]}일
                    </Button>
                  ))}
                </div>
                <div className="h-[240px] w-full rounded-[1.2rem] border border-[#dbe7ff] bg-[#f8fbff] p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={displaySeries} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="rhythmStudyMinutesGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe7ff" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} />
                      <YAxis tick={{ fontSize: 11, fontWeight: 800, fill: analysisChartTickColor }} tickLine={false} axisLine={analysisChartAxisLine} width={36} />
                      <Tooltip content={<CustomTooltip unit="분" presentationMode={presentationMode} />} />
                      <Area type="monotone" dataKey="studyMinutes" stroke="#10b981" strokeWidth={3} fill="url(#rhythmStudyMinutesGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-[#dbe7ff] bg-white p-4 shadow-[0_24px_56px_-44px_rgba(20,41,95,0.24)]">
                <div className="rounded-[1.2rem] border border-[#dbe7ff] bg-[#f8fbff] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">리듬 해석 브리프</p>
                  <p className="mt-2 text-sm font-black leading-6 text-[#14295F]">
                    평균 공부시간, 흔들림 폭, 전일 변동률을 함께 봐서 공부 리듬의 안정성을 점수화합니다.
                  </p>
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#5c6e97]">계산식</p>
                  <div className="mt-2 rounded-[1.2rem] bg-[#14295F] px-4 py-3 text-white">
                    <p className="text-[11px] font-black uppercase tracking-widest text-white/60">
                      {rhythmGuideMeta.mode === 'dayCompare' ? '전일 비교 보정식' : '표준편차 기반 수식'}
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold text-white">{rhythmGuideMeta.formulaExpression}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded-xl border border-[#dbe7ff] bg-[#f8fbff] px-3 py-2.5">
                    <p className="font-black text-[#5c6e97]">평균 공부시간</p>
                    <p className="text-base font-black text-[#14295F]">{rhythmGuideMeta.averageMinutes}분</p>
                  </div>
                  <div className="rounded-xl border border-[#dbe7ff] bg-[#f8fbff] px-3 py-2.5">
                    <p className="font-black text-[#5c6e97]">표준편차</p>
                    <p className="text-base font-black text-[#14295F]">{rhythmGuideMeta.stdDevMinutes}분</p>
                  </div>
                  <div className="rounded-xl border border-[#dbe7ff] bg-[#f8fbff] px-3 py-2.5">
                    <p className="font-black text-[#5c6e97]">변동계수</p>
                    <p className="text-base font-black text-[#14295F]">{rhythmGuideMeta.variationPercent}%</p>
                  </div>
                  <div className="rounded-xl border border-[#dbe7ff] bg-[#f8fbff] px-3 py-2.5">
                    <p className="font-black text-[#5c6e97]">전일 변동률</p>
                    <p className="text-base font-black text-[#14295F]">{rhythmGuideMeta.dayDiffPercent}%</p>
                  </div>
                  <div className="sm:col-span-2 rounded-xl border border-[#d5f2e7] bg-[#f2fff8] px-3 py-3">
                    <p className="font-black text-[#0f8f65]">최종 리듬 점수</p>
                    <p className="mt-1 text-lg font-black text-[#14295F]">{rhythmScore}점</p>
                    <p className="mt-1 text-[11px] font-semibold text-[#5c6e97]">지금 창에서 선택한 기간을 기준으로 계산됩니다.</p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-1">
              <DialogClose asChild>
                <Button className="rounded-xl bg-[#14295F] font-black text-white hover:bg-[#173D8B]">확인</Button>
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
              : "bg-[linear-gradient(135deg,#14295F_0%,#173D8B_58%,#2554D4_100%)] text-white"
          )}>
            <Zap className="absolute top-0 right-0 p-8 h-32 w-32 opacity-20 rotate-12" />
            <DialogHeader>
              {!isAnalysisPresentation ? (
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white">
                    {student?.name || '학생'}
                  </Badge>
                  <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white/80">
                    {formatSeatLabel(student)}
                  </Badge>
                </div>
              ) : null}
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
              <DialogTitle className="text-3xl font-black tracking-tighter">성장 지표 관리</DialogTitle>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto bg-white p-10 space-y-10 custom-scrollbar">
            <section className="space-y-4">
              <h4 className="text-xs font-black uppercase text-[#5c6e97] flex items-center gap-2 whitespace-nowrap"><Zap className="h-4 w-4 text-[#2554d4]" /> 시즌 보유 포인트</h4>
              <Card className="rounded-[1.5rem] border-2 border-[#dbe7ff] bg-[#f8fbff] p-6 flex flex-col items-center text-center gap-4">
                {isEditStats && canEditGrowthData ? (
                  <div className="w-full space-y-4">
                    <Slider value={[editLp]} max={50000} step={100} onValueChange={([value]) => setEditLp(value)} />
                    <Input type="number" value={editLp} onChange={(event) => setEditLp(Number(event.target.value))} className="h-12 rounded-xl border-2 border-[#dbe7ff] text-center font-black text-xl text-[#14295F]" />
                  </div>
                ) : (
                  <div className="text-5xl font-black text-[#14295F]">{(progress?.seasonLp || 0).toLocaleString()}<span className="ml-1 text-xl opacity-20">점</span></div>
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

          </div>

          <DialogFooter className="p-8 bg-[#f8fbff] border-t border-[#dbe7ff] shrink-0">
            {isEditStats && canEditGrowthData ? (
              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={() => setIsEditStats(false)} className="flex-1 h-14 rounded-2xl font-black border-2 border-[#dbe7ff] bg-white text-[#14295F] hover:bg-[#f4f7ff]">취소</Button>
                <Button onClick={handleUpdateGrowthData} disabled={isUpdating} className="h-14 px-10 rounded-2xl bg-[#14295F] font-black text-lg text-white shadow-xl gap-2 hover:bg-[#173D8B]">{isUpdating ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />} 저장</Button>
              </div>
            ) : (
              <DialogClose asChild><Button className="w-full h-14 rounded-2xl bg-[#14295F] font-black text-lg text-white hover:bg-[#173D8B]">닫기</Button></DialogClose>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-2xl p-0 overflow-hidden border-none shadow-2xl">
          <div className={cn(
            "px-6 py-5",
            isAnalysisPresentation
              ? "bg-[linear-gradient(135deg,#FFF8EE_0%,#FFE7CB_100%)] text-[#17326B]"
              : "bg-[linear-gradient(135deg,#14295F_0%,#173D8B_58%,#2554D4_100%)] text-white"
          )}>
            <DialogHeader>
              {!isAnalysisPresentation ? (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white">
                    {student?.name || '학생'}
                  </Badge>
                  <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white/80">
                    {formatSeatLabel(student)}
                  </Badge>
                  <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white/80">
                    정보 수정
                  </Badge>
                </div>
              ) : null}
              <DialogTitle className="text-3xl font-black tracking-tighter">정보 수정</DialogTitle>
              <DialogDescription className={cn("font-semibold", isAnalysisPresentation ? "text-[#5F7299]" : "text-white/80")}>
                기본 정보, 학교/학년, 연락/연동 정보를 한 번에 정리합니다.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-4 bg-white px-6 py-5">
            <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-2")}>
              <div className="rounded-[1.6rem] border border-[#dbe7ff] bg-white p-4 shadow-[0_24px_56px_-44px_rgba(20,41,95,0.24)]">
                <div className="mb-4 flex items-center gap-2">
                  <div className="rounded-xl bg-[#eef4ff] p-2">
                    <UserRound className="h-4 w-4 text-[#2554d4]" />
                  </div>
                  <div>
                    <p className="text-sm font-black tracking-tight text-[#14295F]">기본 정보</p>
                    <p className="text-[11px] font-semibold text-[#5c6e97]">학생 식별과 소속 정보를 먼저 정리합니다.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-[#5c6e97]">이름</Label>
                    <Input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} className="h-12 rounded-xl border-2 border-[#dbe7ff] font-bold text-[#14295F]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-[#5c6e97]">소속 반</Label>
                    <Select value={editForm.className || 'none'} onValueChange={(value) => setEditForm({ ...editForm, className: value === 'none' ? '' : value })}>
                      <SelectTrigger className="h-12 rounded-xl border-2 border-[#dbe7ff] font-bold text-[#14295F]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="none" className="font-bold">미배정</SelectItem>
                        {availableClasses.map((className) => <SelectItem key={className} value={className} className="font-bold">{className}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-[#dbe7ff] bg-white p-4 shadow-[0_24px_56px_-44px_rgba(20,41,95,0.24)]">
                <div className="mb-4 flex items-center gap-2">
                  <div className="rounded-xl bg-[#eef4ff] p-2">
                    <Building2 className="h-4 w-4 text-[#2554d4]" />
                  </div>
                  <div>
                    <p className="text-sm font-black tracking-tight text-[#14295F]">학교 / 학년</p>
                    <p className="text-[11px] font-semibold text-[#5c6e97]">학습 맥락과 재원 상태를 함께 확인합니다.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-[#5c6e97]">학교</Label>
                    <Input value={editForm.schoolName} onChange={(event) => setEditForm({ ...editForm, schoolName: event.target.value })} className="h-12 rounded-xl border-2 border-[#dbe7ff] font-bold text-[#14295F]" />
                  </div>
                  <div className={cn("grid gap-3", canManageStudentAccounts ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-[#5c6e97]">학년</Label>
                      <Select value={editForm.grade} onValueChange={(value) => setEditForm({ ...editForm, grade: value })}>
                        <SelectTrigger className="h-12 rounded-xl border-2 border-[#dbe7ff] font-bold text-[#14295F]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1학년">1학년</SelectItem>
                          <SelectItem value="2학년">2학년</SelectItem>
                          <SelectItem value="3학년">3학년</SelectItem>
                          <SelectItem value="N수생">N수생</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {canManageStudentAccounts ? (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-[#5c6e97]">학생 상태</Label>
                        <Select value={editForm.memberStatus} onValueChange={(value: 'active' | 'onHold' | 'withdrawn') => setEditForm({ ...editForm, memberStatus: value })}>
                          <SelectTrigger className="h-12 rounded-xl border-2 border-[#dbe7ff] font-bold text-[#14295F]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">재원생</SelectItem>
                            <SelectItem value="onHold">휴원생</SelectItem>
                            <SelectItem value="withdrawn">퇴원생</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-[#dbe7ff] bg-white p-4 shadow-[0_24px_56px_-44px_rgba(20,41,95,0.24)]">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-xl bg-[#eef4ff] p-2">
                  <ShieldCheck className="h-4 w-4 text-[#2554d4]" />
                </div>
                <div>
                    <p className="text-sm font-black tracking-tight text-[#14295F]">연락 / 연동</p>
                    <p className="text-[11px] font-semibold text-[#5c6e97]">학부모 연동코드와 계정 접근 정보는 여기서 함께 관리합니다.</p>
                  </div>
                </div>
              <div className={cn("grid gap-3", canManageStudentAccounts ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
                {canManageStudentAccounts ? (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-[#5c6e97]">학생 전화번호</Label>
                    <Input
                      value={editForm.phoneNumber}
                      onChange={(event) => setEditForm({ ...editForm, phoneNumber: event.target.value.replace(/\D/g, '').slice(0, 11) })}
                      inputMode="tel"
                      maxLength={11}
                      className="h-12 rounded-xl border-2 border-[#dbe7ff] font-bold text-[#14295F]"
                      placeholder="01012345678"
                    />
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-[#5c6e97]">부모 연동코드 (6자리)</Label>
                  <Input value={editForm.parentLinkCode} onChange={(event) => setEditForm({ ...editForm, parentLinkCode: event.target.value.replace(/\D/g, '').slice(0, 6) })} inputMode="numeric" maxLength={6} className="h-12 rounded-xl border-2 border-[#dbe7ff] font-bold tracking-[0.2em] text-[#14295F]" placeholder="123456" />
                </div>
                {canManageStudentAccounts ? (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-[#5c6e97]">비밀번호 (변경 시에만)</Label>
                    <Input type="password" value={editForm.password} onChange={(event) => setEditForm({ ...editForm, password: event.target.value })} className="h-12 rounded-xl border-2 border-[#dbe7ff] font-bold text-[#14295F]" placeholder="6자 이상 입력 시 변경" />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-[#dbe7ff] bg-[#f8fbff] p-6">
            <div className="flex w-full gap-3">
              <DialogClose asChild>
                <Button variant="outline" className="flex-1 h-12 rounded-xl border-[#dbe7ff] bg-white font-black text-[#14295F] hover:bg-[#f4f7ff]">
                  취소
                </Button>
              </DialogClose>
              <Button onClick={handleUpdateInfo} disabled={isUpdating} className="flex-1 h-12 rounded-xl bg-[#14295F] font-black text-white shadow-xl hover:bg-[#173D8B]">
                {isUpdating ? <Loader2 className="h-5 w-5 animate-spin" /> : '정보 저장'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReservationModalOpen} onOpenChange={setIsReservationModalOpen}>
        <DialogContent className="rounded-[2rem] border-none p-0 overflow-hidden shadow-2xl sm:max-w-md">
          <div className="bg-[linear-gradient(135deg,#14295F_0%,#173D8B_58%,#2554D4_100%)] px-6 py-5 text-white">
            <DialogHeader>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white">
                  {student?.name || '학생'}
                </Badge>
                <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white/80">
                  {formatSeatLabel(student)}
                </Badge>
                <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white/80">
                  상담 예약
                </Badge>
              </div>
              <DialogTitle className="text-2xl font-black tracking-tight">상담 예약 생성</DialogTitle>
              <DialogDescription className="font-semibold text-white/80">
                학생 브리프를 기준으로 상담 시간을 바로 등록합니다.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-4 bg-white px-6 py-5">
            <div className="rounded-[1.35rem] border border-[#D7E4FF] bg-[#F8FBFF] px-4 py-3 text-sm font-semibold leading-6 text-[#14295F]">
              오늘 운영 메모와 최근 상담 흐름을 같이 보면서, 다음 상담 시간을 먼저 고정하는 용도의 빠른 예약 카드입니다.
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-[#5c6e97]">날짜</Label><Input type="date" value={aptDate} onChange={(event) => setAptDate(event.target.value)} className="h-11 rounded-xl border-[#dbe7ff] text-[#14295F]" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-[#5c6e97]">시간</Label><Input type="time" value={aptTime} onChange={(event) => setAptTime(event.target.value)} className="h-11 rounded-xl border-[#dbe7ff] text-[#14295F]" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-[#5c6e97]">메모 (선택)</Label><Textarea value={aptNote} onChange={(event) => setAptNote(event.target.value)} placeholder="상담 전 확인할 이슈나 목표" className="min-h-[92px] rounded-xl border-[#dbe7ff] text-[#14295F]" /></div>
          </div>
          <DialogFooter className="border-t border-[#dbe7ff] bg-[#f8fbff] p-6">
            <div className="flex w-full gap-3">
              <DialogClose asChild>
                <Button variant="outline" className="h-12 flex-1 rounded-xl border-[#dbe7ff] bg-white font-black text-[#14295F] hover:bg-[#f4f7ff]">취소</Button>
              </DialogClose>
              <Button onClick={handleCreateReservation} disabled={isSubmitting} className="h-12 flex-1 rounded-xl bg-[#14295F] font-black text-white hover:bg-[#173D8B]">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : '상담 예약 저장'}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        <Dialog open={isLogModalOpen} onOpenChange={setIsLogModalOpen}>
          <DialogContent className="rounded-[2rem] border-none p-0 overflow-hidden shadow-2xl sm:max-w-lg">
            <div className="bg-[linear-gradient(135deg,#14295F_0%,#173D8B_58%,#2554D4_100%)] px-6 py-5 text-white">
              <DialogHeader>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white">
                    {student?.name || '학생'}
                  </Badge>
                  <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white/80">
                    상담 기록
                  </Badge>
                  <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white/80">
                    상담 일지
                  </Badge>
                </div>
                <DialogTitle className="text-2xl font-black tracking-tight">상담 일지 작성</DialogTitle>
                <DialogDescription className="font-semibold text-white/80">
                  예약, 최근 피드백, 다음 실행 포인트를 연결해 기록을 남깁니다.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="space-y-4 bg-white px-6 py-5">
              <div className="rounded-[1.35rem] border border-[#D7E4FF] bg-[#F8FBFF] px-4 py-3 text-sm font-semibold leading-6 text-[#14295F]">
                학생 질문, 오늘 반응, 다음 실행 포인트를 한 흐름으로 남기면 학생 360 상담 기록과 같은 맥락으로 이어집니다.
              </div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-[#5c6e97]">상담 유형</Label><Select value={logType} onValueChange={(value) => setLogType(value as typeof logType)}><SelectTrigger className="h-11 rounded-xl border-[#dbe7ff] text-[#14295F]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="academic">학습 상담</SelectItem><SelectItem value="life">생활 상담</SelectItem><SelectItem value="career">진로 상담</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-[#5c6e97]">상담 내용</Label><Textarea value={logContent} onChange={(event) => setLogContent(event.target.value)} placeholder="핵심 상담 내용을 입력하세요." className="min-h-[120px] rounded-xl border-[#dbe7ff] text-[#14295F]" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-[#5c6e97]">개선 포인트</Label><Textarea value={logImprovement} onChange={(event) => setLogImprovement(event.target.value)} placeholder="향후 실행 포인트를 기록하세요." className="min-h-[90px] rounded-xl border-[#dbe7ff] text-[#14295F]" /></div>
            </div>
            <DialogFooter className="border-t border-[#dbe7ff] bg-[#f8fbff] p-6">
              <div className="flex w-full gap-3">
                <DialogClose asChild>
                  <Button variant="outline" className="h-12 flex-1 rounded-xl border-[#dbe7ff] bg-white font-black text-[#14295F] hover:bg-[#f4f7ff]">취소</Button>
                </DialogClose>
                <Button onClick={handleCreateCounselingLog} disabled={isSubmitting} className="h-12 flex-1 rounded-xl bg-[#14295F] font-black text-white hover:bg-[#173D8B]">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : '상담 일지 저장'}</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isQuickFeedbackModalOpen} onOpenChange={setIsQuickFeedbackModalOpen}>
          <DialogContent className="rounded-[2rem] border-none p-0 overflow-hidden shadow-2xl sm:max-w-lg">
            <div className="bg-[linear-gradient(135deg,#14295F_0%,#173D8B_58%,#2554D4_100%)] px-6 py-5 text-white">
              <DialogHeader>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white">
                    {student?.name || '학생'}
                  </Badge>
                  <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white/80">
                    즉시 피드백
                  </Badge>
                  <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white/80">
                    학생 팝업 전달
                  </Badge>
                </div>
                <DialogTitle className="text-2xl font-black tracking-tight">한 줄 피드백 전송</DialogTitle>
                <DialogDescription className="font-semibold text-white/80">
                  학생 알림창과 팝업으로 바로 확인되는 짧은 피드백입니다.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="space-y-4 bg-white px-6 py-5">
              <div className="rounded-[1.35rem] border border-[#ffe1c5] bg-[#fff8f2] px-4 py-3 text-sm font-bold leading-relaxed text-[#14295F]">
                예시: 오늘은 독서 지문에서 근거 표시를 더 또렷하게 해봅시다.
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-[#5c6e97]">피드백 내용</Label>
                <Textarea
                  value={quickFeedbackMessage}
                  onChange={(event) => setQuickFeedbackMessage(event.target.value)}
                  placeholder="학생에게 바로 전달할 한 줄 피드백을 입력하세요."
                  className="min-h-[110px] rounded-xl border-[#dbe7ff] text-[#14295F]"
                  maxLength={160}
                />
                <p className="text-right text-[10px] font-bold text-[#5c6e97]">
                  {quickFeedbackMessage.trim().length}/160
                </p>
              </div>
            </div>
            <DialogFooter className="border-t border-[#dbe7ff] bg-[#f8fbff] p-6">
              <div className="flex w-full gap-3">
                <DialogClose asChild>
                  <Button variant="outline" className="h-12 flex-1 rounded-xl border-[#dbe7ff] bg-white font-black text-[#14295F] hover:bg-[#f4f7ff]">취소</Button>
                </DialogClose>
                <Button onClick={handleCreateQuickFeedback} disabled={isQuickFeedbackSubmitting} className="h-12 flex-1 rounded-xl bg-[#14295F] font-black text-white hover:bg-[#173D8B]">
                  {isQuickFeedbackSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : '한 줄 피드백 보내기'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

    </div>
  );
}

