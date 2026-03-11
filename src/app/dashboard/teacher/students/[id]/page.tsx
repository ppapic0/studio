'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useCollection, useDoc, useFirestore, useFunctions, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { addDays, format, isBefore, startOfDay, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, Timestamp, where, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, BarChart, Bar } from 'recharts';
import { Loader2, ArrowLeft, Building2, Zap, Settings2, Activity, Target, RefreshCw, CheckCircle2, ShieldCheck, LayoutGrid, Save, Trash2, CalendarDays, BarChart3, MessageSquare, Clock3, PlusCircle, UserRound, AlertTriangle, Sparkles, ClipboardList, Timer, CalendarCheck2, TrendingUp, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StudentProfile, StudyLogDay, GrowthProgress, CenterMembership, CounselingLog, CounselingReservation, StudyPlanItem, WithId } from '@/lib/types';
import { cn } from '@/lib/utils';
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

const STAT_CONFIG = {
  focus: { label: '집중력', sub: 'FOCUS', icon: Target, color: 'text-blue-500', accent: 'bg-blue-50', guide: '몰입 시간을 안정적으로 확보하면 상승합니다.' },
  consistency: { label: '꾸준함', sub: 'CONSISTENCY', icon: RefreshCw, color: 'text-emerald-500', accent: 'bg-emerald-50', guide: '매일 비슷한 시간대 루틴이 핵심입니다.' },
  achievement: { label: '목표달성', sub: 'ACHIEVEMENT', icon: CheckCircle2, color: 'text-amber-500', accent: 'bg-amber-50', guide: '계획 완료율이 높을수록 빠르게 성장합니다.' },
  resilience: { label: '회복력', sub: 'RESILIENCE', icon: ShieldCheck, color: 'text-rose-500', accent: 'bg-rose-50', guide: '흔들린 날 이후 빠른 회복 능력입니다.' },
} as const;

const RANGE_MAP = { today: 7, weekly: 14, monthly: 28 } as const;
type ChartRangeKey = keyof typeof RANGE_MAP;
type DailyStatSnapshot = { totalStudyMinutes: number; todayPlanCompletionRate?: number; studyTimeGrowthRate?: number };
type PlanBucket = { studyTotal: number; studyDone: number; routineCount: number; personalCount: number };

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

const CustomTooltip = ({ active, payload, label, unit = '분' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-xl border-2 border-primary/10 p-4 rounded-2xl shadow-xl ring-1 ring-black/5">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">{label}</p>
        <div className="flex items-baseline gap-1.5"><span className="text-2xl font-black text-primary">{payload[0].value}</span><span className="text-xs font-black text-primary/60">{unit}</span></div>
      </div>
    );
  }
  return null;
};

function StatAnalysisCard({ title, value, subValue, icon: Icon, colorClass, isMobile, onClick }: { title: string; value: string; subValue: string; icon: any; colorClass: string; isMobile: boolean; onClick?: () => void; }) {
  return (
    <Card className={cn('border-none shadow-md overflow-hidden relative bg-white rounded-[1.5rem] sm:rounded-[2rem] transition-all', onClick && 'hover:shadow-xl active:scale-[0.98] cursor-pointer')} onClick={onClick}>
      <div className={cn('absolute top-0 left-0 w-1 h-full', colorClass.replace('text-', 'bg-'))} />
      <CardHeader className={cn('pb-1 flex flex-row items-center justify-between', isMobile ? 'px-3 pt-3' : 'px-6 pt-6')}>
        <CardTitle className={cn('font-black text-muted-foreground uppercase', isMobile ? 'text-[8px]' : 'text-[10px]')}>{title}</CardTitle>
        <div className={cn('rounded-lg bg-opacity-10', isMobile ? 'p-1.5' : 'p-2', colorClass.replace('text-', 'bg-'))}><Icon className={cn(isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4', colorClass)} /></div>
      </CardHeader>
      <CardContent className={cn(isMobile ? 'px-3 pb-3' : 'px-6 pb-6')}><div className={cn('font-black tracking-tighter', isMobile ? 'text-lg leading-tight' : 'text-2xl')}>{value}</div><p className={cn('font-bold text-muted-foreground mt-0.5', isMobile ? 'text-[8px]' : 'text-[9px]')}>{subValue}</p></CardContent>
    </Card>
  );
}

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studentId } = use(params);
  const { user: currentUser } = useUser();
  const { activeMembership, viewMode } = useAppContext();
  const firestore = useFirestore();
  const functions = useFunctions();
  const { toast } = useToast();
  const router = useRouter();

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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);

  const [logType, setLogType] = useState<'academic' | 'life' | 'career'>('academic');
  const [logContent, setLogContent] = useState('');
  const [logImprovement, setLogImprovement] = useState('');

  const [aptDate, setAptDate] = useState(format(today, 'yyyy-MM-dd'));
  const [aptTime, setAptTime] = useState('14:00');
  const [aptNote, setAptNote] = useState('');

  const [isUpdating, setIsUpdating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isEditStats, setIsEditStats] = useState(false);
  const [editLp, setEditLp] = useState(0);
  const [editStats, setEditStats] = useState({ focus: 0, consistency: 0, achievement: 0, resilience: 0 });
  const [editTodayMinutes, setEditTodayMinutes] = useState(0);

  const hasInitializedForm = useRef(false);
  const [editForm, setEditForm] = useState({ name: '', schoolName: '', grade: '', password: '', parentLinkCode: '', className: '' });

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

  const counselingLogsQuery = useMemoFirebase(() => (!firestore || !centerId ? null : query(collection(firestore, 'centers', centerId, 'counselingLogs'), orderBy('createdAt', 'desc'), limit(200))), [firestore, centerId]);
  const { data: counselingLogsRaw, isLoading: counselingLoading } = useCollection<CounselingLog>(counselingLogsQuery, { enabled: !!centerId });

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

  useEffect(() => {
    if (progress) {
      setEditLp(progress.seasonLp || 0);
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
      });
      hasInitializedForm.current = true;
    }
  }, [student]);

  useEffect(() => {
    if (isEditStats) return;
    setEditTodayMinutes(dailyStatsMap[todayKey]?.totalStudyMinutes || 0);
  }, [dailyStatsMap, todayKey, isEditStats]);

  useEffect(() => {
    let cancelled = false;
    const fetchDailyStats = async () => {
      if (!firestore || !centerId || !studentId) {
        setDailyStatsMap({});
        return;
      }
      setStatsLoading(true);
      try {
        const keys = Array.from({ length: 28 }, (_, idx) => format(subDays(today, idx), 'yyyy-MM-dd'));
        const snapshots = await Promise.all(keys.map((dateKey) => getDoc(doc(firestore, 'centers', centerId, 'dailyStudentStats', dateKey, 'students', studentId))));
        if (cancelled) return;
        const next: Record<string, DailyStatSnapshot> = {};
        snapshots.forEach((snap, index) => {
          if (!snap.exists()) return;
          const data = snap.data() as Partial<DailyStatSnapshot>;
          next[keys[index]] = {
            totalStudyMinutes: Number(data.totalStudyMinutes || 0),
            todayPlanCompletionRate: typeof data.todayPlanCompletionRate === 'number' ? data.todayPlanCompletionRate : undefined,
            studyTimeGrowthRate: typeof data.studyTimeGrowthRate === 'number' ? data.studyTimeGrowthRate : undefined,
          };
        });
        setDailyStatsMap(next);
      } catch (error) {
        console.error('[Student Detail] Failed to load daily stats:', error);
      } finally {
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

  const studentReservations = useMemo(() => {
    return (reservationsRaw || []).filter((reservation) => reservation.studentId === studentId).sort((a, b) => toTime(b.scheduledAt) - toTime(a.scheduledAt));
  }, [reservationsRaw, studentId]);

  const studyLogMap = useMemo(() => {
    const map: Record<string, StudyLogDay> = {};
    (studyLogs || []).forEach((log) => {
      if (log.dateKey) map[log.dateKey] = log;
    });
    return map;
  }, [studyLogs]);

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

      const studyMinutes = typeof stat?.totalStudyMinutes === 'number' ? stat.totalStudyMinutes : Number(log?.totalMinutes || 0);
      const completionFromPlans = plan && plan.studyTotal > 0 ? Math.round((plan.studyDone / plan.studyTotal) * 100) : undefined;
      const completionRate = typeof stat?.todayPlanCompletionRate === 'number' ? Math.round(stat.todayPlanCompletionRate) : completionFromPlans;

      return {
        dateKey,
        dateLabel: format(date, 'M/d', { locale: ko }),
        studyMinutes,
        completionRate: completionRate ?? 0,
        hasCompletion: completionRate !== undefined,
      };
    });
  }, [todayKey, dailyStatsMap, planByDate, studyLogMap]);

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

  const rhythmScore = useMemo(() => calculateRhythmScore(displaySeries.map((item) => item.studyMinutes)), [displaySeries]);

  const averageGrowthRate = useMemo(() => {
    const values = Object.values(dailyStatsMap).map((stat) => stat.studyTimeGrowthRate).filter((value): value is number => typeof value === 'number');
    if (!values.length) return 0;
    return Math.round((values.reduce((acc, value) => acc + value, 0) / values.length) * 100);
  }, [dailyStatsMap]);

  const studyStreakDays = useMemo(() => {
    let streak = 0;
    for (let idx = 0; idx < 28; idx += 1) {
      const dateKey = format(subDays(today, idx), 'yyyy-MM-dd');
      const statMinutes = dailyStatsMap[dateKey]?.totalStudyMinutes;
      const logMinutes = studyLogMap[dateKey]?.totalMinutes;
      const minutes = typeof statMinutes === 'number' ? statMinutes : Number(logMinutes || 0);
      if (minutes >= 60) streak += 1;
      else break;
    }
    return streak;
  }, [dailyStatsMap, studyLogMap, todayKey]);

  const todayPlanSummary = planByDate[todayKey] || { studyTotal: 0, studyDone: 0, routineCount: 0, personalCount: 0 };

  const upcomingPlanGroups = useMemo(() => {
    const endDateKey = format(addDays(today, 7), 'yyyy-MM-dd');
    const groups: Record<string, { dateKey: string; routines: WithId<StudyPlanItem>[]; studies: WithId<StudyPlanItem>[]; personals: WithId<StudyPlanItem>[]; }> = {};

    planItems.filter((item) => item.dateKey >= todayKey && item.dateKey <= endDateKey).forEach((item) => {
      if (!groups[item.dateKey]) groups[item.dateKey] = { dateKey: item.dateKey, routines: [], studies: [], personals: [] };
      if (item.category === 'schedule') groups[item.dateKey].routines.push(item);
      else if (item.category === 'personal') groups[item.dateKey].personals.push(item);
      else groups[item.dateKey].studies.push(item);
    });

    return Object.values(groups).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [planItems, todayKey]);

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
      const batch = writeBatch(firestore);
      const pRef = doc(firestore, 'centers', centerId, 'growthProgress', studentId);
      const rRef = doc(firestore, 'centers', centerId, 'leaderboards', `${periodKey}_lp`, 'entries', studentId);
      const sRef = doc(firestore, 'centers', centerId, 'dailyStudentStats', todayKey, 'students', studentId);

      batch.set(pRef, { seasonLp: editLp, stats: editStats, updatedAt: serverTimestamp() }, { merge: true });
      batch.set(sRef, { totalStudyMinutes: editTodayMinutes, updatedAt: serverTimestamp() }, { merge: true });
      batch.set(rRef, { studentId, displayNameSnapshot: student?.name || '학생', value: editLp, updatedAt: serverTimestamp() }, { merge: true });

      await batch.commit();
      toast({ title: '성장 지표 보정 완료' });
      setIsEditStats(false);
    } catch (error: any) {
      console.error(error);
      const message = resolveCallableErrorMessage(error, '학생 정보 수정 중 오류가 발생했습니다.');
      toast({ variant: 'destructive', title: '수정 실패', description: message });
    } finally {
      setIsUpdating(false);
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

  return (
    <div className={cn('flex flex-col gap-6 max-w-7xl mx-auto pb-24 px-4')}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          {!isStudentSelfView && (
            <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 shrink-0 mt-1" asChild>
              <Link href={backHref}><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
          )}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-black tracking-tighter truncate text-3xl sm:text-4xl">{student?.name || '학생'}</h1>
              <Badge className="bg-primary text-white px-2 py-0.5 rounded-full font-black text-[10px]">{student?.seatNo || '미배정'}번 좌석</Badge>
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
          {canWriteCounseling && <Button variant="outline" className="rounded-2xl font-black h-11 px-5 text-xs gap-2" onClick={() => setIsReservationModalOpen(true)}><CalendarCheck2 className="h-4 w-4" /> 상담 예약</Button>}
          {canWriteCounseling && <Button variant="outline" className="rounded-2xl font-black h-11 px-5 text-xs gap-2" onClick={() => setIsLogModalOpen(true)}><ClipboardList className="h-4 w-4" /> 상담 일지 작성</Button>}
          {canEditStudentInfo && <Button variant="outline" className="rounded-2xl font-black h-11 px-5 text-xs gap-2" onClick={() => setIsEditModalOpen(true)}><Settings2 className="h-4 w-4" /> 정보 수정</Button>}
          {isAdmin && <Button variant="destructive" className="rounded-2xl font-black h-11 px-5 text-xs gap-2" onClick={() => { if (confirm('영구 삭제하시겠습니까?')) handleDeleteAccount(); }}><Trash2 className="h-4 w-4" /> 계정 삭제</Button>}
        </div>
      </div>

      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatAnalysisCard title="평균 공부시간" value={minutesToLabel(avgStudyMinutes)} subValue={`최근 ${RANGE_MAP[focusedChartView]}일 기준`} icon={Clock3} colorClass="text-blue-500" isMobile={isMobile} />
        <StatAnalysisCard title="평균 공부 리듬" value={`${rhythmScore}점`} subValue="시간 분산 기반 안정성" icon={TrendingUp} colorClass="text-emerald-500" isMobile={isMobile} />
        <StatAnalysisCard title="계획 완수율" value={`${avgCompletionRate}%`} subValue="학습 To-do 완료율" icon={CheckCircle2} colorClass="text-amber-500" isMobile={isMobile} />
        <StatAnalysisCard title="상담 진행도" value={`${studentReservations.filter((item) => item.status === 'done').length}/${studentReservations.length}`} subValue="완료 상담 / 전체 상담" icon={MessageSquare} colorClass="text-rose-500" isMobile={isMobile} />
      </section>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="space-y-6">
        <TabsList className="rounded-2xl h-12 bg-muted/30 grid grid-cols-3 p-1">
          <TabsTrigger value="overview" className="rounded-xl font-black text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> 학습 분석</TabsTrigger>
          <TabsTrigger value="counseling" className="rounded-xl font-black text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> 상담 기록</TabsTrigger>
          <TabsTrigger value="plans" className="rounded-xl font-black text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5"><BookOpen className="h-3.5 w-3.5" /> 계획/루틴</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-0">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-8 rounded-[2rem] border-none shadow-lg bg-white overflow-hidden">
              <CardHeader className="pb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> 공부시간 추이</CardTitle>
                  <CardDescription className="font-bold text-[11px]">집중 시간을 시계열로 확인해 리듬 변화를 파악합니다.</CardDescription>
                </div>
                <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-fit">
                  {(['today', 'weekly', 'monthly'] as ChartRangeKey[]).map((key) => (
                    <Button key={key} variant={focusedChartView === key ? 'default' : 'ghost'} className="h-8 px-3 rounded-lg text-[10px] font-black" onClick={() => setFocusedChartView(key)}>{RANGE_MAP[key]}일</Button>
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
                      <Tooltip content={<CustomTooltip unit="분" />} />
                      <Area type="monotone" dataKey="studyMinutes" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#studyMinutesGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-4 rounded-[2rem] border-none shadow-lg bg-white overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-amber-500" /> 계획 완수율</CardTitle>
                <CardDescription className="font-bold text-[11px]">일별 완료율로 실행력의 안정성을 점검합니다.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={displaySeries} margin={{ top: 12, right: 0, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f2f2f2" />
                      <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} fontSize={10} fontWeight={800} />
                      <YAxis tickLine={false} axisLine={false} fontSize={10} fontWeight={800} width={32} domain={[0, 100]} />
                      <Tooltip content={<CustomTooltip unit="%" />} />
                      <Bar dataKey="completionRate" radius={[8, 8, 0, 0]} fill="#f59e0b" barSize={14} />
                    </BarChart>
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
                <div className="space-y-2"><div className="flex items-center justify-between text-xs font-black"><span>리듬 안정성</span><span>{rhythmScore}점</span></div><Progress value={rhythmScore} className="h-2" /></div>
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
                      <div key={reservation.id} className="rounded-xl border border-border/60 bg-muted/10 px-3 py-3">
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
                {counselingLoading ? (
                  <div className="flex items-center justify-center h-36 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : studentCounselingLogs.length === 0 ? (
                  <div className="rounded-xl border border-dashed py-8 text-center text-sm font-bold text-muted-foreground">작성된 상담 일지가 없습니다.</div>
                ) : (
                  studentCounselingLogs.slice(0, 10).map((log) => (
                    <div key={log.id} className="rounded-xl border border-border/60 bg-white px-3 py-3 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <Badge className="font-black text-[10px] rounded-full bg-primary">{log.type === 'academic' ? '학습 상담' : log.type === 'life' ? '생활 상담' : '진로 상담'}</Badge>
                        <span className="text-xs font-bold text-muted-foreground">{log.createdAt ? format(log.createdAt.toDate(), 'yyyy.MM.dd HH:mm', { locale: ko }) : '작성 시각 없음'}</span>
                        <span className="text-xs font-bold text-muted-foreground">· {log.teacherName || '담당 선생님'}</span>
                      </div>
                      <p className="text-sm font-bold leading-relaxed text-slate-800">{log.content}</p>
                      {log.improvement && <div className="mt-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-700">개선 포인트: {log.improvement}</div>}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plans" className="space-y-6 mt-0">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-[2rem] border-none shadow-lg bg-white"><CardHeader className="pb-2"><CardTitle className="text-lg font-black tracking-tight flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> 오늘 학습 계획</CardTitle></CardHeader><CardContent><p className="text-3xl font-black tracking-tight text-primary">{todayPlanSummary.studyDone}/{todayPlanSummary.studyTotal}</p><p className="text-xs font-bold text-muted-foreground mt-1">완료 / 전체 학습 To-do</p></CardContent></Card>
            <Card className="rounded-[2rem] border-none shadow-lg bg-white"><CardHeader className="pb-2"><CardTitle className="text-lg font-black tracking-tight flex items-center gap-2"><Timer className="h-4 w-4 text-blue-500" /> 오늘 루틴 수</CardTitle></CardHeader><CardContent><p className="text-3xl font-black tracking-tight text-blue-600">{todayPlanSummary.routineCount}</p><p className="text-xs font-bold text-muted-foreground mt-1">등원/식사/학원 등 시간 루틴</p></CardContent></Card>
            <Card className="rounded-[2rem] border-none shadow-lg bg-white"><CardHeader className="pb-2"><CardTitle className="text-lg font-black tracking-tight flex items-center gap-2"><PlusCircle className="h-4 w-4 text-amber-500" /> 개인 할 일</CardTitle></CardHeader><CardContent><p className="text-3xl font-black tracking-tight text-amber-600">{todayPlanSummary.personalCount}</p><p className="text-xs font-bold text-muted-foreground mt-1">생활/기타 개인 체크 항목</p></CardContent></Card>
          </div>

          <Card className="rounded-[2rem] border-none shadow-lg bg-white">
            <CardHeader><CardTitle className="text-xl font-black tracking-tight flex items-center gap-2"><BookOpen className="h-5 w-5 text-emerald-500" /> 향후 7일 계획/루틴</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {isDataLoading ? (
                <div className="flex items-center justify-center h-36 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : upcomingPlanGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed py-8 text-center text-sm font-bold text-muted-foreground">향후 7일 계획 데이터가 없습니다.</div>
              ) : (
                upcomingPlanGroups.map((group) => {
                  const date = new Date(`${group.dateKey}T00:00:00`);
                  return (
                    <div key={group.dateKey} className="rounded-xl border border-border/60 p-3.5 bg-muted/10">
                      <div className="flex items-center justify-between mb-2"><p className="text-sm font-black text-slate-800">{format(date, 'M월 d일 (EEE)', { locale: ko })}</p><Badge variant="outline" className="font-black text-[10px] rounded-full">학습 {group.studies.length} · 루틴 {group.routines.length}</Badge></div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-2.5"><p className="text-[11px] font-black text-emerald-700 mb-1.5">학습 To-do</p>{group.studies.length === 0 ? <p className="text-xs font-bold text-emerald-700/70">등록된 학습 계획 없음</p> : <div className="space-y-1">{group.studies.slice(0, 4).map((item) => <div key={item.id} className="flex items-center justify-between text-xs font-semibold text-emerald-800"><span className="truncate pr-2">{item.title}</span><span className="shrink-0 font-black">{item.done ? '완료' : '대기'}</span></div>)}</div>}</div>
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

      <Dialog open={isMasteryModalOpen} onOpenChange={setIsMasteryModalOpen}>
        <DialogContent className="rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col sm:max-w-xl max-h-[90vh]">
          <div className="bg-purple-600 p-10 text-white relative shrink-0">
            <Zap className="absolute top-0 right-0 p-8 h-32 w-32 opacity-20 rotate-12" />
            <DialogHeader>
              <div className="flex justify-between items-center">
                <Badge className="bg-white/20 text-white border-none font-black text-[10px] px-2.5 py-0.5 uppercase tracking-widest">Growth Management</Badge>
                {!isEditStats && canEditGrowthData && <Button variant="ghost" size="sm" onClick={() => setIsEditStats(true)} className="text-white hover:bg-white/10 gap-2 h-8 rounded-lg font-black text-xs"><Settings2 className="h-3.5 w-3.5" /> 수동 보정</Button>}
              </div>
              <DialogTitle className="text-3xl font-black tracking-tighter">성장 및 스킬 마스터 관리</DialogTitle>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto bg-white p-10 space-y-10 custom-scrollbar">
            <section className="space-y-4">
              <h4 className="text-xs font-black uppercase text-primary/60 flex items-center gap-2"><Zap className="h-4 w-4" /> 시즌 보유 LP</h4>
              <Card className="rounded-[1.5rem] border-2 border-primary/5 bg-muted/5 p-6 flex flex-col items-center text-center gap-4">
                {isEditStats && canEditGrowthData ? (
                  <div className="w-full space-y-4">
                    <Slider value={[editLp]} max={50000} step={100} onValueChange={([value]) => setEditLp(value)} />
                    <Input type="number" value={editLp} onChange={(event) => setEditLp(Number(event.target.value))} className="h-12 rounded-xl text-center font-black text-xl border-2" />
                  </div>
                ) : (
                  <div className="text-5xl font-black text-primary">{(progress?.seasonLp || 0).toLocaleString()}<span className="text-xl opacity-20 ml-1">LP</span></div>
                )}
              </Card>
            </section>

            {isEditStats && canEditGrowthData && (
              <section className="space-y-4">
                <h4 className="text-xs font-black uppercase text-blue-600 flex items-center gap-2"><Timer className="h-4 w-4" /> 오늘 공부시간 보정 (분)</h4>
                <Input type="number" value={editTodayMinutes} onChange={(event) => setEditTodayMinutes(Number(event.target.value))} className="h-14 rounded-2xl border-blue-200 font-black text-2xl text-center text-blue-600" />
              </section>
            )}

            <section className="space-y-6">
              <h4 className="text-xs font-black uppercase text-primary/60 flex items-center gap-2"><Activity className="h-4 w-4" /> 핵심 역량 분석 (Stats)</h4>
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

      <Card className="rounded-[2rem] border-none shadow-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white overflow-hidden">
        <CardContent className="p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Mastery Snapshot</p>
            <p className="text-xl sm:text-2xl font-black tracking-tight">LP {(progress?.seasonLp || 0).toLocaleString()} · 스킬 평균 {Math.round(((progress?.stats?.focus || 0) + (progress?.stats?.consistency || 0) + (progress?.stats?.achievement || 0) + (progress?.stats?.resilience || 0)) / 4)}점</p>
          </div>
          <Button className="rounded-xl font-black bg-white text-emerald-700 hover:bg-white/90" onClick={() => setIsMasteryModalOpen(true)}><Zap className="h-4 w-4 mr-1.5" /> 성장지표 상세 보기</Button>
        </CardContent>
      </Card>
    </div>
  );
}

