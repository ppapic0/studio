'use client';

import { useState, useMemo, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs,
  addDoc, 
  serverTimestamp, 
  doc, 
  getDoc,
  updateDoc, 
  deleteDoc, 
  writeBatch,
  increment,
  setDoc,
  limit,
} from 'firebase/firestore';
import { StudyLogDay, StudyPlanItem, WithId, GrowthProgress, LeaderboardEntry, DailyReport } from '@/lib/types';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  startOfWeek, 
  endOfWeek, 
  addMonths, 
  subMonths,
  subDays,
  getDay,
  isAfter,
  isBefore,
  startOfDay
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Zap, 
  Plus, 
  Trash2, 
  Clock, 
  MapPin, 
  Coffee, 
  School, 
  ClipboardList,
  Copy,
  Info,
  CalendarX,
  CalendarDays,
  Sparkles,
  Activity,
  PlusCircle,
  CalendarCheck,
  CircleDot,
  Trophy,
  Crown,
  FileText,
  CheckCircle2,
  MessageCircle,
  BrainCircuit,
  TrendingUp,
  Target,
  Lock,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { applyPenaltyEventSecure } from '@/lib/penalty-actions';
import { getSafeErrorMessage } from '@/lib/exposed-error';
import { VisualReportViewer } from '@/components/dashboard/visual-report-viewer';
import { StudentTrackSubnav } from '@/components/dashboard/student-track-subnav';
import {
  ROUTINE_TEMPLATE_OPTIONS,
  type StudyAmountUnit,
  type StudyPlanMode,
} from '@/components/dashboard/student-planner/planner-constants';
import { RoutineComposerCard } from '@/components/dashboard/student-planner/routine-composer-card';
import { StudyComposerCard } from '@/components/dashboard/student-planner/study-composer-card';
import { PlanItemCard } from '@/components/dashboard/student-planner/plan-item-card';
import { ScheduleItemCard } from '@/components/dashboard/student-planner/schedule-item-card';

type LinkedStudentOption = {
  id: string;
  name: string;
};

const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

const SUBJECTS = [
  { id: 'kor', label: '국어', color: 'bg-red-500', light: 'bg-red-50', text: 'text-red-600' },
  { id: 'math', label: '수학', color: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-600' },
  { id: 'eng', label: '영어', color: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-600' },
  { id: 'social', label: '사탐', color: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-600' },
  { id: 'science', label: '과탐', color: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-600' },
  { id: 'history', label: '한국사', color: 'bg-slate-700', light: 'bg-slate-100', text: 'text-slate-700' },
  { id: 'etc', label: '기타', color: 'bg-slate-400', light: 'bg-slate-50', text: 'text-slate-500' },
];

function resolveStudyPlanMode(task: Pick<StudyPlanItem, 'studyPlanMode' | 'targetAmount' | 'targetMinutes'>): StudyPlanMode {
  if (task.studyPlanMode) return task.studyPlanMode;
  return typeof task.targetAmount === 'number' && task.targetAmount > 0 ? 'volume' : 'time';
}

function resolveAmountUnitLabel(task: Pick<StudyPlanItem, 'amountUnit' | 'amountUnitLabel'>) {
  if (task.amountUnit === '직접입력') return task.amountUnitLabel?.trim() || '단위';
  return task.amountUnit || '문제';
}

function buildStudyTaskMeta(task: Pick<StudyPlanItem, 'studyPlanMode' | 'targetMinutes' | 'targetAmount' | 'actualAmount' | 'amountUnit' | 'amountUnitLabel'>) {
  if (resolveStudyPlanMode(task) === 'volume') {
    const unitLabel = resolveAmountUnitLabel(task);
    const targetAmount = Math.max(0, task.targetAmount || 0);
    const actualAmount = Math.max(0, task.actualAmount || 0);
    const progressRate = targetAmount > 0 ? Math.round((actualAmount / targetAmount) * 100) : 0;
    return `목표 ${targetAmount}${unitLabel} · 실제 ${actualAmount}${unitLabel} · ${progressRate}%`;
  }
  return task.targetMinutes ? `${task.targetMinutes}분 목표` : '시간 자유';
}

const SAME_DAY_ROUTINE_PENALTY_POINTS = 1;

type StudyHistoryFlowLevel = 'none' | 'light' | 'medium' | 'high';

const STUDY_HISTORY_FLOW_THRESHOLDS = {
  light: 240,
  medium: 480,
} as const;

const STUDY_HISTORY_CALENDAR_LEGEND: Array<{
  level: StudyHistoryFlowLevel;
  label: string;
  rangeLabel: string;
  swatch: string;
}> = [
  { level: 'none', label: '0h 0m', rangeLabel: '0h 0m', swatch: 'bg-white ring-[#D5E5DB]' },
  { level: 'light', label: '< 4h', rangeLabel: '< 4h', swatch: 'bg-[#E8F8ED] ring-[#BEE3C9]' },
  { level: 'medium', label: '4h ~ 8h', rangeLabel: '4h ~ 8h', swatch: 'bg-[#9DDBB0] ring-[#5DB97B]' },
  { level: 'high', label: '8h+', rangeLabel: '8h+', swatch: 'bg-[#1D8A4C] ring-[#116B38]' },
] as const;

function getStudyHistoryFlowLevel(minutes: number): StudyHistoryFlowLevel {
  if (minutes <= 0) return 'none';
  if (minutes < STUDY_HISTORY_FLOW_THRESHOLDS.light) return 'light';
  if (minutes < STUDY_HISTORY_FLOW_THRESHOLDS.medium) return 'medium';
  return 'high';
}

function getStudyHistoryFlowLabel(minutes: number) {
  const level = getStudyHistoryFlowLevel(minutes);
  if (level === 'none') return '0h 0m';
  if (level === 'light') return '< 4h';
  if (level === 'medium') return '4h ~ 8h';
  return '8h+';
}

function toDateSafe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    try {
      const converted = (value as { toDate: () => Date }).toDate();
      return Number.isNaN(converted.getTime()) ? null : converted;
    } catch {
      return null;
    }
  }
  return null;
}

function formatAttendanceTimeLabel(value: Date | null, fallback = '미기록') {
  return value ? format(value, 'HH:mm') : fallback;
}

function ScheduleItemRow({ item, onUpdateRange, onDelete, isPast, isToday, isMobile, disabled }: any) {
  const [titlePart, timePart] = item.title.split(': ');
  
  const from24h = (t: string) => {
    if (!t || !t.includes(':')) return { hour: '09', minute: '00', period: '오전' as const };
    let [h, m] = t.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return { hour: '09', minute: '00', period: '오전' as const };
    const p = h >= 12 ? '오후' : '오전';
    let h12 = h % 12 || 12;
    return { hour: h12.toString().padStart(2, '0'), minute: m.toString().padStart(2, '0'), period: p };
  };

  const parseRange = (rangeStr: string) => {
    const parts = rangeStr?.split(' ~ ') || [];
    return {
      start: from24h(parts[0]),
      end: from24h(parts[1] || parts[0])
    };
  };

  const initialRange = parseRange(timePart);
  const [sHour, setSHour] = useState(initialRange.start.hour);
  const [sMin, setSMin] = useState(initialRange.start.minute);
  const [sPer, setSPer] = useState(initialRange.start.period);
  const [eHour, setEHour] = useState(initialRange.end.hour);
  const [eMin, setEMin] = useState(initialRange.end.minute);
  const [ePer, setEPer] = useState(initialRange.end.period);

  useEffect(() => {
    const remote = parseRange(timePart);
    setSHour(remote.start.hour);
    setSMin(remote.start.minute);
    setSPer(remote.start.period);
    setEHour(remote.end.hour);
    setEMin(remote.end.minute);
    setEPer(remote.end.period);
  }, [timePart]);

  const handleValueChange = (type: 's' | 'e', field: 'h' | 'm' | 'p', val: string) => {
    if (disabled || isPast) return;
    let nextSH = sHour, nextSM = sMin, nextSP = sPer;
    let nextEH = eHour, nextEM = eMin, nextEP = ePer;

    if (type === 's') {
      if (field === 'h') { nextSH = val; setSHour(val); }
      if (field === 'm') { nextSM = val; setSMin(val); }
      if (field === 'p') { nextSP = val as any; setSPer(val as any); }
    } else {
      if (field === 'h') { nextEH = val; setEHour(val); }
      if (field === 'm') { nextEM = val; setEMin(val); }
      if (field === 'p') { nextEP = val as any; setEPer(val as any); }
    }

    onUpdateRange(item.id, titlePart, { h: nextSH, m: nextSM, p: nextSP }, { h: nextEH, m: nextEM, p: nextEP });
  };

  const getIcon = (title: string) => {
    if (title.includes('등원')) return MapPin;
    if (title.includes('하원')) return School;
    if (title.includes('점심') || title.includes('저녁') || title.includes('식사')) return Coffee;
    return Clock;
  };

  const Icon = getIcon(titlePart);

  const TimePicker = ({ type, h, m, p }: any) => (
    <div className={cn(
      "flex items-center bg-muted/20 p-0.5 rounded-lg border border-border/30",
      (disabled || isPast) && "opacity-60 pointer-events-none"
    )}>
      <Select value={p} onValueChange={(v) => handleValueChange(type, 'p', v)} disabled={disabled || isPast}>
        <SelectTrigger className={cn("border-none bg-transparent font-black px-1 focus:ring-0 h-6 shadow-none", isMobile ? "w-[48px] text-[10px]" : "w-[55px] text-xs")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-none shadow-2xl">
          <SelectItem value="오전">오전</SelectItem>
          <SelectItem value="오후">오후</SelectItem>
        </SelectContent>
      </Select>
      <div className="w-px h-2 bg-border/50 mx-0.5" />
      <Select value={h} onValueChange={(v) => handleValueChange(type, 'h', v)} disabled={disabled || isPast}>
        <SelectTrigger className={cn("border-none bg-transparent font-mono font-black px-1 focus:ring-0 h-6 shadow-none", isMobile ? "w-[36px] text-[11px]" : "w-[45px] text-sm")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[200px]">{HOURS.map(hour => <SelectItem key={hour} value={hour}>{hour}</SelectItem>)}</SelectContent>
      </Select>
      <span className="text-[9px] font-black opacity-30 px-0.5">:</span>
      <Select value={m} onValueChange={(v) => handleValueChange(type, 'm', v)} disabled={disabled || isPast}>
        <SelectTrigger className={cn("border-none bg-transparent font-mono font-black px-1 focus:ring-0 h-6 shadow-none", isMobile ? "w-[36px] text-[11px]" : "w-[45px] text-sm")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[200px]">{MINUTES.map(min => <SelectItem key={min} value={min}>{min}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  return (
    <div className={cn(
      "flex flex-col transition-all border group relative bg-white shadow-sm hover:shadow-md w-full",
      isMobile ? "p-3 rounded-[1.25rem] border-border/40" : "p-5 rounded-2xl hover:border-primary/30"
    )}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("rounded-lg shrink-0 flex items-center justify-center", isMobile ? "bg-primary/5 p-1.5" : "bg-primary/10 p-2")}>
            <Icon className={cn(isMobile ? "h-3.5 w-3.5" : "h-4 w-4")} />
          </div>
          <Label className={cn("font-black tracking-tight block truncate", isMobile ? "text-xs" : "text-sm")}>{titlePart}</Label>
        </div>
        {!isPast && !disabled && (
          <Button 
            variant="ghost" 
            size="icon"
            className={cn(
              "h-7 w-7 rounded-full text-muted-foreground hover:text-destructive transition-all",
              isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )} 
            onClick={() => onDelete(item)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
        {isToday && <Lock className="h-3 w-3 text-muted-foreground/20" />}
      </div>

      <div className="flex items-center gap-1.5 w-full justify-start sm:justify-start">
        {(isPast || disabled || isToday) ? (
          <Badge variant="outline" className="font-mono font-black text-primary border-primary/10 bg-primary/5 text-[9px] px-2 py-1">
            {timePart || '--:--'}
          </Badge>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            <TimePicker type="s" h={sHour} m={sMin} p={sPer} />
            <span className="text-[10px] font-black text-muted-foreground/40">~</span>
            <TimePicker type="e" h={eHour} m={eMin} p={ePer} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudyHistoryPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const isMobile = viewMode === 'mobile';
  const isParent = activeMembership?.role === 'parent';
  const linkedStudentIds = useMemo(
    () =>
      (activeMembership?.linkedStudentIds || []).filter(
        (value): value is string => typeof value === 'string' && value.trim().length > 0
      ),
    [activeMembership?.linkedStudentIds]
  );
  const linkedStudentIdsKey = linkedStudentIds.join(',');
  const requestedParentStudentId = searchParams.get('parentStudentId');
  const targetUid = useMemo(() => {
    if (!isParent) return user?.uid;
    if (linkedStudentIds.length === 0) return undefined;
    if (requestedParentStudentId && linkedStudentIds.includes(requestedParentStudentId)) {
      return requestedParentStudentId;
    }
    return linkedStudentIds[0];
  }, [isParent, user?.uid, linkedStudentIds, requestedParentStudentId]);

  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [selectedDateForPlan, setSelectedDateForPlan] = useState<Date | null>(null);
  const [newStudyTask, setNewStudyTask] = useState('');
  const [newStudySubject, setNewStudySubject] = useState('math');
  const [newStudyMode, setNewStudyMode] = useState<StudyPlanMode>('volume');
  const [newStudyMinutes, setNewStudyMinutes] = useState('60');
  const [newStudyTargetAmount, setNewStudyTargetAmount] = useState('');
  const [newStudyAmountUnit, setNewStudyAmountUnit] = useState<StudyAmountUnit>('문제');
  const [newStudyCustomAmountUnit, setNewStudyCustomAmountUnit] = useState('');
  const [enableVolumeStudyMinutes, setEnableVolumeStudyMinutes] = useState(false);
  const [newPersonalTask, setNewPersonalTask] = useState('');
  const [newRoutineTitle, setNewRoutineTitle] = useState('');
  const [selectedRoutineTemplateKey, setSelectedRoutineTemplateKey] = useState('arrival');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [linkedStudents, setLinkedStudents] = useState<LinkedStudentOption[]>([]);

  useEffect(() => { setCurrentDate(new Date()); }, []);

  useEffect(() => {
    if (!isParent) return;

    const params = new URLSearchParams(searchParams.toString());
    let shouldReplace = false;

    if (linkedStudentIds.length > 1 && targetUid) {
      if (requestedParentStudentId !== targetUid) {
        params.set('parentStudentId', targetUid);
        shouldReplace = true;
      }
    } else if (requestedParentStudentId) {
      params.delete('parentStudentId');
      shouldReplace = true;
    }

    if (shouldReplace) {
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [isParent, searchParams, router, pathname, requestedParentStudentId, linkedStudentIds.length, targetUid]);

  useEffect(() => {
    if (!isParent || !firestore || !activeMembership?.id || linkedStudentIds.length === 0) {
      setLinkedStudents([]);
      return;
    }

    let cancelled = false;

    const loadLinkedStudents = async () => {
      try {
        const records = await Promise.all(
          linkedStudentIds.map(async (id, index) => {
            const snap = await getDoc(doc(firestore, 'centers', activeMembership.id, 'students', id));
            const data = snap.data() as { name?: string } | undefined;
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
        console.warn('[study-history] failed to load linked students', error);
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
  }, [isParent, firestore, activeMembership?.id, linkedStudentIdsKey]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const studyLogsQuery = useMemoFirebase(() => {
    if (!firestore || !targetUid || !activeMembership) return null;
    return query(collection(firestore, 'centers', activeMembership.id, 'studyLogs', targetUid, 'days'), orderBy('dateKey', 'desc'));
  }, [firestore, targetUid, activeMembership?.id]);
  const { data: logs, isLoading: logsLoading } = useCollection<StudyLogDay>(studyLogsQuery);

  const weekKey = selectedDateForPlan ? format(selectedDateForPlan, "yyyy-'W'II") : currentDate ? format(currentDate, "yyyy-'W'II") : '';
  const plansQuery = useMemoFirebase(() => {
    if (!firestore || !targetUid || !activeMembership || !weekKey) return null;
    return query(collection(firestore, 'centers', activeMembership.id, 'plans', targetUid, 'weeks', weekKey, 'items'));
  }, [firestore, targetUid, activeMembership?.id, weekKey]);
  const { data: allPlans } = useCollection<StudyPlanItem>(plansQuery);

  const selectedDateKey = selectedDateForPlan ? format(selectedDateForPlan, 'yyyy-MM-dd') : null;

  const selectedDateAttendanceRecordRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !targetUid || !selectedDateKey) return null;
    return doc(firestore, 'centers', activeMembership.id, 'attendanceRecords', selectedDateKey, 'students', targetUid);
  }, [firestore, activeMembership?.id, targetUid, selectedDateKey]);
  const { data: selectedDateAttendanceRecord } = useDoc<Record<string, unknown>>(selectedDateAttendanceRecordRef, {
    enabled: !!targetUid && !!selectedDateKey,
  });

  const reportRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !targetUid || !selectedDateKey) return null;
    return doc(firestore, 'centers', activeMembership.id, 'dailyReports', `${selectedDateKey}_${targetUid}`);
  }, [firestore, activeMembership?.id, targetUid, selectedDateKey]);
  const { data: dailyReport, isLoading: reportLoading } = useDoc<DailyReport>(reportRef);
  const legacyReportContent = dailyReport?.content ?? '';
  const legacyReportAiMeta = dailyReport?.aiMeta ?? undefined;
  const legacyReportDateKey = dailyReport?.dateKey ?? undefined;
  const legacyReportStudentName = dailyReport?.studentName ?? undefined;

  const progressRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !targetUid) return null;
    return doc(firestore, 'centers', activeMembership.id, 'growthProgress', targetUid);
  }, [firestore, activeMembership?.id, targetUid]);
  const { data: progress } = useDoc<GrowthProgress>(progressRef, { enabled: !!targetUid });

  const dailyPlans = useMemo(() => allPlans?.filter(p => p.dateKey === selectedDateKey) || [], [allPlans, selectedDateKey]);
  const scheduleItems = useMemo(() => dailyPlans.filter(p => p.category === 'schedule'), [dailyPlans]);
  const personalTasks = useMemo(() => dailyPlans.filter(p => p.category === 'personal'), [dailyPlans]);
  const studyTasks = useMemo(() => dailyPlans.filter(p => p.category === 'study' || !p.category), [dailyPlans]);
  const completedStudyCount = useMemo(() => studyTasks.filter((task) => task.done).length, [studyTasks]);
  const completedPersonalCount = useMemo(() => personalTasks.filter((task) => task.done).length, [personalTasks]);
  const totalQuickPlanCount = scheduleItems.length + studyTasks.length + personalTasks.length;
  const completedQuickPlanCount = completedStudyCount + completedPersonalCount;
  const quickPlanCompletionRate = totalQuickPlanCount > 0 ? Math.round((completedQuickPlanCount / totalQuickPlanCount) * 100) : 0;
  const selectedDateCheckInAt = useMemo(
    () => toDateSafe((selectedDateAttendanceRecord?.checkInAt as unknown) || (selectedDateAttendanceRecord?.updatedAt as unknown)),
    [selectedDateAttendanceRecord]
  );
  const selectedDateCheckOutAt = useMemo(
    () => toDateSafe(selectedDateAttendanceRecord?.checkOutAt as unknown),
    [selectedDateAttendanceRecord]
  );
  const selectedDateAttendanceSummary = useMemo(
    () => ({
      checkInLabel: formatAttendanceTimeLabel(selectedDateCheckInAt, '미기록'),
      checkOutLabel: selectedDateCheckOutAt
        ? formatAttendanceTimeLabel(selectedDateCheckOutAt)
        : selectedDateCheckInAt
          ? '기록 대기'
          : '미기록',
    }),
    [selectedDateCheckInAt, selectedDateCheckOutAt]
  );
  const todoPreviewItems = useMemo(() => {
    const schedulePreview = [...scheduleItems]
      .sort((a, b) => (a.title.split(': ')[1] || '00:00').localeCompare(b.title.split(': ')[1] || '00:00'))
      .map((item) => {
        const [title, rangeLabel] = item.title.split(': ');
        return {
          id: `schedule-${item.id}`,
          categoryLabel: '루틴',
          categoryClassName: 'border-[#FFD4B0] bg-[#FFF3E7] text-[#C95A00]',
          title: title || item.title,
          meta: rangeLabel || '시간 미정',
          stateLabel: '시간 루틴',
          stateClassName: 'border-[#FFE3CA] bg-white text-[#B75A0D]',
          done: false,
        };
      });

    const studyPreview = studyTasks.map((task) => ({
      id: `study-${task.id}`,
      categoryLabel: '학습',
      categoryClassName: 'border-[#FFE0C2] bg-[#FFF4E8] text-[#CC620E]',
      title: task.title,
      meta: buildStudyTaskMeta(task),
      stateLabel: task.done ? '완료' : '진행',
      stateClassName: task.done
        ? 'border-[#FFD6B1] bg-[#FFF1E2] text-[#C95A00]'
        : 'border-slate-200 bg-white text-slate-500',
      done: task.done,
    }));

    const personalPreview = personalTasks.map((task) => ({
      id: `personal-${task.id}`,
      categoryLabel: '기타',
      categoryClassName: 'border-[#FFE8D2] bg-[#FFF7EF] text-[#D26E18]',
      title: task.title,
      meta: '개인 일정',
      stateLabel: task.done ? '완료' : '진행',
      stateClassName: task.done
        ? 'border-[#FFD6B1] bg-[#FFF1E2] text-[#C95A00]'
        : 'border-slate-200 bg-white text-slate-500',
      done: task.done,
    }));

    return [...schedulePreview, ...studyPreview, ...personalPreview];
  }, [scheduleItems, studyTasks, personalTasks]);
  const shouldHideTodoDetailSections = isMobile && todoPreviewItems.length > 0;

  const handleRoutineTemplateSelect = (template: (typeof ROUTINE_TEMPLATE_OPTIONS)[number]) => {
    setSelectedRoutineTemplateKey(template.key);
    setNewRoutineTitle(template.title);
  };

  const calendarData = useMemo(() => {
    if (!currentDate) return { days: [], monthStart: null };
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const calendarStart = startOfWeek(start, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(end, { weekStartsOn: 1 });
    return { days: eachDayOfInterval({ start: calendarStart, end: calendarEnd }), monthStart: start };
  }, [currentDate]);

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const formatHourMinuteCompact = (minutes: number) => {
    const safeMinutes = Math.max(0, minutes);
    const hours = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatCalendarMinutesLabel = (minutes: number) => {
    return formatHourMinuteCompact(minutes);
  };

  const formatMobileCalendarMinutesLabel = (minutes: number) => {
    return formatHourMinuteCompact(minutes);
  };

  const getHeatmapColor = (minutes: number) => {
    const level = getStudyHistoryFlowLevel(minutes);
    if (level === 'none') return 'bg-[linear-gradient(180deg,rgba(255,255,255,0.998)_0%,rgba(248,251,249,0.996)_100%)] ring-1 ring-inset ring-[#D9E6DE]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.98),0_14px_28px_-26px_rgba(61,96,72,0.08)]';
    if (level === 'light') return 'bg-[linear-gradient(180deg,rgba(249,255,250,0.998)_0%,rgba(230,248,236,0.996)_100%)] ring-1 ring-inset ring-[#BDE1C8]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.97),0_16px_30px_-26px_rgba(45,124,74,0.12)]';
    if (level === 'medium') return 'bg-[linear-gradient(180deg,rgba(238,252,242,0.998)_0%,rgba(176,226,191,0.996)_100%)] ring-1 ring-inset ring-[#67BE82]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_18px_32px_-24px_rgba(31,125,69,0.16)]';
    return 'bg-[linear-gradient(180deg,rgba(205,240,216,0.998)_0%,rgba(32,139,77,0.998)_100%)] ring-1 ring-inset ring-[#0F6B37]/95 shadow-[inset_0_1px_0_rgba(235,250,240,0.52),0_20px_36px_-22px_rgba(18,102,54,0.24)]';
  };

  const getStudentCalendarCellClass = (minutes: number, isCurrentMonth: boolean, isMobileView: boolean) => {
    if (!isCurrentMonth) {
      return 'border border-[#E7EDF7] bg-[linear-gradient(180deg,#FAFBFE_0%,#F3F6FB_100%)] opacity-[0.54] shadow-none';
    }
    const level = getStudyHistoryFlowLevel(minutes);
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
  };

  const getStudentCalendarValueTone = (minutes: number, isCurrentMonth: boolean, isMobileView: boolean) => {
    if (!isCurrentMonth) return 'text-[#C6CFDD]';
    const level = getStudyHistoryFlowLevel(minutes);
    if (level === 'none') return isMobileView ? 'text-[#6F8475]' : 'text-[#738779]';
    if (level === 'light') return 'text-[#2F6F48]';
    if (level === 'medium') return 'text-[#175336]';
    return 'text-white';
  };

  const getStudentLegendChipClass = (level: StudyHistoryFlowLevel) => {
    if (level === 'none') return 'border-[#D8E5DE] bg-white text-[#708578]';
    if (level === 'light') return 'border-[#C6E4CF] bg-[#F4FCF6] text-[#3C7C54]';
    if (level === 'medium') return 'border-[#7BC694] bg-[#E7F7EC] text-[#205D3C]';
    return 'border-[#1D8A4C] bg-[#1D8A4C] text-white';
  };

  const monthTotalMinutes = useMemo(() => {
    if (!logs || !currentDate) return 0;
    return logs.filter(log => isSameMonth(new Date(log.dateKey), currentDate)).reduce((acc, log) => acc + log.totalMinutes, 0);
  }, [logs, currentDate]);

  const todayTotalMinutes = useMemo(() => {
    if (!logs) return 0;
    return logs.find((log) => log.dateKey === todayStr)?.totalMinutes || 0;
  }, [logs, todayStr]);

  const recent7DaysTotalMinutes = useMemo(() => {
    if (!logs) return 0;
    const windowStartKey = format(subDays(new Date(), 6), 'yyyy-MM-dd');
    return logs
      .filter((log) => log.dateKey >= windowStartKey && log.dateKey <= todayStr)
      .reduce((acc, log) => acc + log.totalMinutes, 0);
  }, [logs, todayStr]);

  const todayOpenedBoxCount = useMemo(() => {
    const claimedBoxes = (progress?.dailyPointStatus?.[todayStr] as Record<string, any> | undefined)?.claimedStudyBoxes;
    return Array.isArray(claimedBoxes) ? claimedBoxes.length : 0;
  }, [progress?.dailyPointStatus, todayStr]);

  const applySameDayRoutinePenalty = async (reason: string) => {
    if (!activeMembership || !user || !targetUid || !selectedDateKey) return false;

    const penaltyKey = `same_day_routine:${selectedDateKey}`;
    const result = await applyPenaltyEventSecure({
      centerId: activeMembership.id,
      studentId: targetUid,
      source: 'manual',
      reason,
      pointsDelta: SAME_DAY_ROUTINE_PENALTY_POINTS,
      penaltyKey,
      penaltyDateKey: selectedDateKey,
    });
    return Boolean(result.applied);
  };

  const handleAddTask = async (title: string, category: 'study' | 'personal' | 'schedule') => {
    if (isParent || !firestore || !user || !activeMembership || !selectedDateForPlan || !title.trim() || !targetUid) return;
    const isToday = isSameDay(selectedDateForPlan, new Date());

    setIsSubmitting(true);
    const dateKey = format(selectedDateForPlan, 'yyyy-MM-dd');
    const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
    const colRef = collection(firestore, 'centers', activeMembership.id, 'plans', targetUid, 'weeks', weekKey, 'items');
    try {
      const data: any = { 
        title: title.trim(), 
        done: false, 
        weight: category === 'schedule' ? 0 : 1, 
        dateKey, category, 
        studyPlanWeekId: weekKey, 
        centerId: activeMembership.id, 
        studentId: targetUid, 
        createdAt: serverTimestamp(), 
        updatedAt: serverTimestamp() 
      };

      if (category === 'schedule') {
        data.title = `${title.trim()}: 09:00 ~ 10:00`;
      } else if (category === 'study') {
        data.subject = newStudySubject;
        data.studyPlanMode = newStudyMode;
        if (newStudyMode === 'time') {
          data.targetMinutes = Number(newStudyMinutes) || 0;
        } else {
          data.targetAmount = Number(newStudyTargetAmount) || 0;
          data.actualAmount = 0;
          data.amountUnit = newStudyAmountUnit;
          if (newStudyAmountUnit === '직접입력') {
            data.amountUnitLabel = newStudyCustomAmountUnit.trim() || '단위';
          }
          if (enableVolumeStudyMinutes && Number(newStudyMinutes) > 0) {
            data.targetMinutes = Number(newStudyMinutes) || 0;
          }
        }
      }

      await addDoc(colRef, data);
      if (category === 'schedule' && isToday) {
        await applySameDayRoutinePenalty('당일 출석 루틴 작성');
        toast({
          title: `당일 루틴 작성으로 벌점 ${SAME_DAY_ROUTINE_PENALTY_POINTS}점 반영`,
          description: '당일 출석 루틴은 작성/수정 가능하지만 벌점이 자동 반영됩니다.',
        });
      }
      if (category === 'study') {
        setNewStudyTask('');
        setNewStudyTargetAmount('');
        setNewStudyAmountUnit('문제');
        setNewStudyCustomAmountUnit('');
        setEnableVolumeStudyMinutes(false);
      } else if (category === 'personal') {
        setNewPersonalTask('');
      } else {
        setNewRoutineTitle('');
        setIsRoutineModalOpen(false);
      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: '할 일 추가 실패',
        description: typeof e?.message === 'string' ? e.message : '할 일을 저장하지 못했습니다.',
      });
    } finally { setIsSubmitting(false); }
  };

  const to24h = (time12h: string, period: '오전' | '오후') => {
    if (!time12h || !time12h.includes(':')) return time12h;
    let [hours, mins] = time12h.split(':').map(Number);
    if (isNaN(hours) || isNaN(mins)) return time12h;
    if (period === '오후' && hours < 12) hours += 12;
    if (period === '오전' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const handleUpdateScheduleRange = async (itemId: string, baseTitle: string, start: {h: string, m: string, p: '오전' | '오후'}, end: {h: string, m: string, p: '오전' | '오후'}) => {
    if (isParent || !selectedDateForPlan || !firestore || !user || !activeMembership || !targetUid) return;
    const isToday = isSameDay(selectedDateForPlan, new Date());

    try {
      const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
      const formattedStart = to24h(`${start.h}:${start.m}`, start.p);
      const formattedEnd = to24h(`${end.h}:${end.m}`, end.p);
      const rangeStr = `${formattedStart} ~ ${formattedEnd}`;
      await updateDoc(doc(firestore, 'centers', activeMembership.id, 'plans', targetUid, 'weeks', weekKey, 'items', itemId), { title: `${baseTitle}: ${rangeStr}`, updatedAt: serverTimestamp() });
      if (isToday) {
        await applySameDayRoutinePenalty('당일 출석 루틴 시간 수정');
        toast({
          title: `당일 루틴 수정으로 벌점 ${SAME_DAY_ROUTINE_PENALTY_POINTS}점 반영`,
          description: '당일 출석 루틴은 수정 가능하지만 벌점이 자동 반영됩니다.',
        });
      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: '루틴 시간 수정 실패',
        description: typeof e?.message === 'string' ? e.message : '루틴 시간을 저장하지 못했습니다.',
      });
    }
  };

  const handleToggleTask = async (item: WithId<StudyPlanItem>) => {
    if (isParent || !firestore || !user || !activeMembership || !selectedDateForPlan || !targetUid || !progressRef) return;
    if (resolveStudyPlanMode(item) === 'volume') return;
    try {
      const dateKey = format(selectedDateForPlan, 'yyyy-MM-dd');
      const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
      const nextState = !item.done;

      await updateDoc(doc(firestore, 'centers', activeMembership.id, 'plans', targetUid, 'weeks', weekKey, 'items', item.id), { done: nextState, updatedAt: serverTimestamp() });

      if (nextState) {
        const batch = writeBatch(firestore);
        const achievementCount = progress?.dailyPointStatus?.[dateKey]?.achievementCount || 0;
        const existingDayStatus = (progress?.dailyPointStatus?.[dateKey] || {}) as Record<string, any>;
        const remainingStudyTasks = dailyPlans
          .filter((plan) => (plan.category === 'study' || !plan.category) && plan.id !== item.id && !plan.done);
        const shouldAwardPlanPoints = remainingStudyTasks.length === 0 && !existingDayStatus.plan;
        const progressUpdate: Record<string, any> = {
          dailyPointStatus: {
            [dateKey]: {
              ...existingDayStatus,
            },
          },
          updatedAt: serverTimestamp(),
        };
        if (shouldAwardPlanPoints) {
          progressUpdate.dailyPointStatus[dateKey].plan = true;
        }
        if (achievementCount < 5) {
          progressUpdate.dailyPointStatus[dateKey].achievementCount = increment(1);
        }
        batch.set(progressRef, progressUpdate, { merge: true });
        await batch.commit();
        if (shouldAwardPlanPoints) {
          toast({
            title: '오늘 학습 계획 완료',
            description: '계획 완료 기록이 저장되었습니다.',
          });
        }
      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: '계획 상태 변경 실패',
        description: typeof e?.message === 'string' ? e.message : '계획 상태를 저장하지 못했습니다.',
      });
    }
  };

  const handleCommitStudyActualAmount = async (item: WithId<StudyPlanItem>, nextActualAmount: number) => {
    if (isParent || !firestore || !user || !activeMembership || !selectedDateForPlan || !targetUid) return;
    const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
    const safeActualAmount = Math.max(0, Math.round(nextActualAmount));
    const targetAmount = Math.max(0, item.targetAmount || 0);
    await updateDoc(
      doc(firestore, 'centers', activeMembership.id, 'plans', targetUid, 'weeks', weekKey, 'items', item.id),
      {
        actualAmount: safeActualAmount,
        done: targetAmount > 0 && safeActualAmount >= targetAmount,
        updatedAt: serverTimestamp(),
      }
    );
  };

  const handleDeleteTask = async (item: WithId<StudyPlanItem>) => {
    if (isParent || !firestore || !user || !activeMembership || !selectedDateForPlan || !targetUid) return;
    try {
      const isToday = isSameDay(selectedDateForPlan, new Date());

      const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
      await deleteDoc(doc(firestore, 'centers', activeMembership.id, 'plans', targetUid, 'weeks', weekKey, 'items', item.id));
      if (item.category === 'schedule' && isToday) {
        await applySameDayRoutinePenalty('당일 출석 루틴 삭제');
        toast({
          title: `당일 루틴 수정으로 벌점 ${SAME_DAY_ROUTINE_PENALTY_POINTS}점 반영`,
          description: '당일 출석 루틴은 수정 가능하지만 벌점이 자동 반영됩니다.',
        });
      }
      toast({ title: "항목이 삭제되었습니다." });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: '항목 삭제 실패',
        description: typeof e?.message === 'string' ? e.message : '선택한 항목을 삭제하지 못했습니다.',
      });
    }
  };

  const activeStudentLabel =
    linkedStudents.find((item) => item.id === targetUid)?.name ||
    (linkedStudentIds.length > 1 ? '자녀 선택' : '자녀');

  const handleParentStudentChange = (nextStudentId: string) => {
    if (!isParent || nextStudentId === targetUid) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set('parentStudentId', nextStudentId);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const isActuallyPast = selectedDateForPlan ? isBefore(startOfDay(selectedDateForPlan), startOfDay(new Date())) : false;
  const isToday = selectedDateForPlan ? isSameDay(selectedDateForPlan, new Date()) : false;
  if (!currentDate) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  return (
    <div className={cn("flex flex-col w-full max-w-5xl mx-auto pb-20", isMobile ? "gap-4 px-1" : "gap-10")}>
      <header className={cn("flex justify-between items-center px-2", isMobile ? "flex-col gap-4" : "flex-row")}>
        <div className="flex flex-col gap-1">
          <h1 className={cn("font-black tracking-tighter text-primary", isMobile ? "text-2xl" : "text-4xl")}>기록트랙</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60 ml-1">학습 기록·히스토리</p>
          {isParent && linkedStudents.length > 1 && (
            <div className="mt-3 w-full max-w-[240px]">
              <Label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                확인 중인 자녀
              </Label>
              <Select value={targetUid || linkedStudents[0]?.id || ''} onValueChange={handleParentStudentChange}>
                <SelectTrigger className="h-11 rounded-2xl border bg-white/90 px-4 text-left font-black shadow-sm">
                  <SelectValue placeholder={activeStudentLabel} />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border bg-white">
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
        <div className={cn(
          "relative flex items-center gap-2 overflow-hidden rounded-[1.4rem] p-1.5",
          isParent
            ? "border border-primary/10 bg-[linear-gradient(180deg,#ffffff_0%,#f4fbff_100%)] shadow-[0_20px_40px_-30px_rgba(37,99,235,0.35)] ring-1 ring-white/70"
            : "border border-[#E5EAF4] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,246,236,0.95)_100%)] shadow-[0_18px_38px_-30px_rgba(15,23,42,0.18)] ring-1 ring-white/80"
        )}>
           <div className={cn("pointer-events-none absolute inset-x-5 top-0 h-px", isParent ? "bg-white/90" : "bg-white")} />
           <Button variant="ghost" size="icon" className={cn("h-9 w-9 rounded-[1rem] transition-all", isParent ? "bg-white/70 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] hover:bg-primary/5 hover:text-primary" : "bg-white/88 text-[#173A82] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_26px_-22px_rgba(15,23,42,0.16)] hover:bg-[#FFF5EA] hover:text-[#C86A10]")} onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft className="h-5 w-5" /></Button>
           <div className={cn("flex min-w-[120px] items-center justify-center rounded-[1rem] px-4 py-2", isParent ? "border border-white/80 bg-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_14px_30px_-24px_rgba(37,99,235,0.32)]" : "border border-[#F0DCC5] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF6EA_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_16px_28px_-24px_rgba(158,104,45,0.18)]")}>
             <span className={cn("font-black text-sm tracking-tight", isParent ? "text-primary" : "text-[#14295F]")}>{format(currentDate, 'yyyy년 M월')}</span>
           </div>
           <Button variant="ghost" size="icon" className={cn("h-9 w-9 rounded-[1rem] transition-all", isParent ? "bg-white/70 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] hover:bg-primary/5 hover:text-primary" : "bg-white/88 text-[#173A82] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_26px_-22px_rgba(15,23,42,0.16)] hover:bg-[#FFF5EA] hover:text-[#C86A10]")} onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight className="h-5 w-5" /></Button>
        </div>
      </header>

      {isMobile && <StudentTrackSubnav className="mx-1" />}

      <div className="w-full">
        <div className={cn("grid", isMobile ? "grid-cols-3 gap-3" : "md:grid-cols-3 gap-3")}>
            {[
              {
                label: '이번 달 총 공부시간',
                mobileLabel: '이번 달',
                value: formatMinutes(monthTotalMinutes),
                note: '이번 달 누적 기준',
                mobileNote: '누적',
              },
              {
                label: '오늘 공부시간',
                mobileLabel: '오늘',
                value: formatMinutes(todayTotalMinutes),
                note: isParent
                  ? '오늘 하루 기준'
                  : `오늘 열린 포인트 상자 ${todayOpenedBoxCount}개`,
                mobileNote: isParent
                  ? '하루 기준'
                  : `상자 ${todayOpenedBoxCount}개`,
              },
              {
                label: '최근 7일 누적',
                mobileLabel: '7일 누적',
                value: formatMinutes(recent7DaysTotalMinutes),
                note: '직전 7일 공부 누적',
                mobileNote: '직전 7일',
              },
            ].map((item) => (
              <div
                key={item.label}
                className={cn(
                  isMobile
                    ? "min-w-0 overflow-hidden rounded-[1.55rem] border border-[#2D4E92] bg-[linear-gradient(180deg,#102756_0%,#17326B_56%,#1D3D80_100%)] px-4 py-[1.05rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_20px_38px_-28px_rgba(9,18,46,0.52)]"
                    : "min-w-0 overflow-hidden rounded-[1.8rem] border border-[#274683] bg-[linear-gradient(180deg,#0F2350_0%,#17326B_54%,#1F468F_100%)] px-5 py-[1.15rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_22px_40px_-28px_rgba(9,18,46,0.54)]"
                )}
              >
                <p className={cn("font-black uppercase tracking-[0.18em] text-white", isMobile ? "text-[9px]" : "text-[11px]")}>
                  {isMobile ? item.mobileLabel : item.label}
                </p>
                <div className={cn("flex items-end gap-2", isMobile ? "mt-3.5" : "mt-3")}>
                  <span className={cn(
                    "dashboard-number min-w-0 font-black leading-none tracking-[-0.06em] text-white",
                    isMobile ? "text-[1.28rem]" : "text-[1.9rem] sm:text-[2.35rem]"
                  )}>
                    {item.value}
                  </span>
                </div>
                <p className={cn("break-keep font-semibold text-white", isMobile ? "mt-2.5 text-[10px] leading-[1.2rem]" : "mt-2.5 text-[13px] leading-5")}>
                  {isMobile ? item.mobileNote : item.note}
                </p>
              </div>
            ))}
        </div>
      </div>

      <Card className={cn(
        "student-utility-card relative mx-auto w-full overflow-hidden rounded-[3rem]",
        isParent
          ? "border border-[#D5E8DB] bg-[radial-gradient(circle_at_top_left,rgba(118,208,146,0.14),transparent_26%),linear-gradient(180deg,#ffffff_0%,#f7fcf8_100%)] ring-1 ring-white/70 shadow-[0_28px_70px_-52px_rgba(46,117,74,0.18)]"
          : "border border-[#D5E8DB] bg-[radial-gradient(circle_at_top_left,rgba(118,208,146,0.12),transparent_26%),linear-gradient(180deg,#FFFFFF_0%,#F7FCF8_100%)] ring-1 ring-white/85 shadow-[0_22px_52px_-44px_rgba(46,117,74,0.14)]"
      )}>
        <CardContent className="relative p-0">
          <div className={cn("border-b border-primary/10", isMobile ? "px-4 py-4" : "px-6 py-5")}>
            {isParent ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={cn("text-[10px] font-black uppercase tracking-[0.22em]", isMobile ? "text-[#24523B]/62" : "text-[#2D6D47]")}>학습 흐름</span>
                <div className="flex flex-wrap gap-1.5">
                  {STUDY_HISTORY_CALENDAR_LEGEND.map((item) => (
                    <span key={item.label} className={cn(
                      "inline-flex items-center gap-2 rounded-[1rem] px-2.5 py-1.5 font-black shadow-[0_12px_24px_-20px_rgba(15,23,42,0.16)]",
                      isMobile
                        ? "border border-[#D8E5DE] bg-white text-[#24523B] text-[8px]"
                        : "border border-[#D8E5DE] bg-white/92 text-[#2D6D47] text-[8px] sm:text-[9px]"
                    )}>
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full ring-1", item.swatch)} />
                      <span className="leading-none">{item.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className={cn(isMobile ? "space-y-3" : "flex items-end justify-between gap-6")}>
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#E5EBF5] bg-[#F7FAFF] px-3 py-1.5 text-[10px] font-black tracking-[0.18em] text-[#6D80A5]">
                    <CalendarDays className="h-3.5 w-3.5" />
                    STUDY CALENDAR
                  </div>
                  <div>
                    <h3 className={cn("font-black tracking-[-0.03em] text-[#14295F]", isMobile ? "text-[1.3rem]" : "text-[1.62rem]")}>학습 캘린더</h3>
                    <p className={cn("mt-1 font-semibold text-[#71819C]", isMobile ? "text-[12px] leading-5" : "text-sm leading-6")}>
                      {isMobile ? '공부시간 중심으로 빠르게 확인해요.' : '앱처럼 한 칸씩 공부시간을 바로 읽을 수 있게 정리했어요.'}
                    </p>
                  </div>
                </div>
                <div className={cn(
                  "rounded-[1.45rem] border border-[#D8E5DE] bg-[linear-gradient(180deg,#FBFEFC_0%,#F1FAF4_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_18px_34px_-26px_rgba(46,117,74,0.1)]",
                  isMobile ? "px-3 py-3" : "min-w-[24rem] px-4 py-3.5"
                )}>
                  <div className={cn("grid gap-1.5", isMobile ? "grid-cols-2" : "grid-cols-4")}>
                    {STUDY_HISTORY_CALENDAR_LEGEND.map((item) => (
                      <div key={item.label} className={cn("inline-flex items-center justify-center gap-2 rounded-[1rem] border px-2 py-2", getStudentLegendChipClass(item.level))}>
                        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full ring-1", item.swatch)} />
                        <span className={cn("text-center font-black tracking-tight", isMobile ? "text-[9px]" : "text-[10px]")}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className={cn("grid grid-cols-7 border-b border-primary/10", isMobile ? "gap-1.5 px-2 py-2" : "gap-2 px-5 py-3.5")}>
            {['월', '화', '수', '목', '금', '토', '일'].map((day, i) => (
              <div
                key={day}
                className={cn(
                    isMobile ? "py-1.5 text-[8px]" : "rounded-[1rem] border py-2.5 text-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]",
                    isParent
                      ? "rounded-2xl border border-white/80 bg-white/90 text-center font-black uppercase tracking-widest shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
                      : "border-[#EFDCC3] bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF6EA_100%)] text-center font-black uppercase tracking-[0.18em]",
                    isParent
                      ? i === 5 ? "text-blue-600" : i === 6 ? "text-rose-600" : "text-primary/60"
                      : i === 5 ? "text-blue-600" : i === 6 ? "text-rose-600" : "text-[#9B6C3D]"
                  )}
              >
                {day}
              </div>
            ))}
          </div>
          <div className={cn("grid grid-cols-7", isMobile ? "auto-rows-fr gap-2 px-3 pb-3 pt-4.5" : "auto-rows-fr gap-3.5 px-5 pb-5 pt-6")}>
            {logsLoading ? (
              <div className="col-span-7 h-[400px] flex items-center justify-center">
                <Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" />
              </div>
            ) : calendarData.days.map((day, idx) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const minutes = logs?.find(l => l.dateKey === dateKey)?.totalMinutes || 0;
              const isCurrentMonth = calendarData.monthStart ? isSameMonth(day, calendarData.monthStart) : false;
              const isTodayCalendar = isSameDay(day, new Date());
              const isFutureCalendar = isCurrentMonth && isAfter(startOfDay(day), startOfDay(new Date()));
              const exactTimeLabel = isCurrentMonth ? formatCalendarMinutesLabel(minutes) : '';
              const shouldRenderTime = isCurrentMonth && !isFutureCalendar;
              const isLongTimeLabel = exactTimeLabel.length >= 6;
              const isVeryLongTimeLabel = exactTimeLabel.length >= 7;
              const calendarAriaTimeLabel = isCurrentMonth
                ? isFutureCalendar
                  ? '아직 오지 않은 날짜'
                  : exactTimeLabel
                : '이번 달 아님';

              if (!isParent) {
                const studentCellClass = getStudentCalendarCellClass(minutes, isCurrentMonth, isMobile);
                const studentValueTone = getStudentCalendarValueTone(minutes, isCurrentMonth, isMobile);

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => setSelectedDateForPlan(day)}
                    aria-label={`${format(day, 'M월 d일 (EEEE)', { locale: ko })} · ${calendarAriaTimeLabel}${isCurrentMonth ? ' 학습' : ''}`}
                    className={cn(
                      'group relative overflow-hidden text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14295F]/28',
                      'aspect-square',
                      isMobile ? 'min-h-0 rounded-[0.95rem] p-1' : 'rounded-[1.45rem] p-3.5',
                      studentCellClass,
                      isCurrentMonth && 'hover:-translate-y-[1px] hover:shadow-[0_18px_30px_-22px_rgba(20,41,95,0.16)] active:translate-y-0',
                      isTodayCalendar && 'z-10 -translate-y-[1px] ring-2 ring-[#7FCB97]/55 shadow-[0_22px_36px_-24px_rgba(26,115,64,0.18)]'
                    )}
                  >
                    {isTodayCalendar ? (
                      <div
                        className={cn(
                          'pointer-events-none absolute inset-[1px] border border-white/88',
                          isMobile ? 'rounded-[0.8rem]' : 'rounded-[1.35rem]'
                        )}
                      />
                    ) : null}
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/92" />
                    {isCurrentMonth && minutes > 0 ? (
                      <div className="pointer-events-none absolute inset-x-4 top-0 h-12 rounded-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.52),rgba(255,255,255,0)_72%)] opacity-90" />
                    ) : null}

                    <div className={cn('relative z-10 h-full', isMobile ? 'grid place-items-center' : 'flex flex-col justify-between')}>
                      {!isMobile ? (
                        <div className="flex items-start justify-between">
                          <span
                            className={cn(
                              'dashboard-number inline-flex items-center justify-center rounded-full border font-black tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]',
                              'min-w-[2rem] px-2 py-1 text-xs',
                              idx % 7 === 5 && isCurrentMonth
                                ? 'border-blue-100 bg-blue-50 text-blue-700'
                                : idx % 7 === 6 && isCurrentMonth
                                  ? 'border-rose-100 bg-rose-50 text-rose-700'
                                  : 'border-slate-200 bg-white text-slate-700',
                              isTodayCalendar && 'border-[#9CD6B0] text-[#178244]'
                            )}
                          >
                            {format(day, 'd')}
                          </span>
                          <span className="h-6 w-6" aria-hidden="true" />
                        </div>
                      ) : null}

                      <div className={cn('flex items-center justify-center', isMobile ? 'h-full w-full px-0.5' : 'flex-1 px-1 pb-2 pt-4')}>
                        {shouldRenderTime ? (
                          <span
                            className={cn(
                              'dashboard-number block max-w-full whitespace-nowrap font-black leading-none tabular-nums text-center',
                              isMobile
                                ? isVeryLongTimeLabel
                                  ? 'text-[0.5rem] tracking-[-0.11em]'
                                  : isLongTimeLabel
                                    ? 'text-[0.56rem] tracking-[-0.1em]'
                                    : 'text-[0.66rem] tracking-[-0.08em]'
                                : isVeryLongTimeLabel
                                  ? 'text-[0.92rem] tracking-[-0.05em]'
                                  : isLongTimeLabel
                                    ? 'text-[1rem] tracking-[-0.045em]'
                                    : 'text-[1.12rem] tracking-[-0.05em]',
                              studentValueTone
                            )}
                          >
                            {exactTimeLabel}
                          </span>
                        ) : !isMobile && isCurrentMonth ? (
                          <span className="text-[0.76rem] font-black tracking-[0.18em] text-[#C2CBD9]">-</span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              }

              const parentValueTone = getStudentCalendarValueTone(minutes, isCurrentMonth, isMobile);

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => setSelectedDateForPlan(day)}
                  aria-label={`${format(day, 'M월 d일 (EEEE)', { locale: ko })} · ${calendarAriaTimeLabel}${isCurrentMonth ? ' 학습' : ''}`}
                  className={cn(
                    'group relative overflow-hidden text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35',
                    isMobile ? 'aspect-square min-h-0 rounded-[0.95rem] p-1' : 'aspect-square min-h-0 rounded-[1.35rem] p-3.5',
                    !isCurrentMonth
                      ? 'bg-[linear-gradient(180deg,rgba(248,250,252,0.9)_0%,rgba(255,255,255,0.96)_100%)] opacity-[0.38] grayscale-[0.05] ring-1 ring-slate-200/75'
                      : getHeatmapColor(minutes),
                    isCurrentMonth && 'hover:-translate-y-[1px] hover:shadow-[0_18px_36px_-24px_rgba(15,23,42,0.22)] active:translate-y-0',
                    isTodayCalendar && 'z-10 -translate-y-[1px] ring-2 ring-inset ring-[#1f9d57]/45 shadow-[0_20px_40px_-22px_rgba(34,197,94,0.24)]'
                  )}
                >
                  {isTodayCalendar && (
                    <div
                      className={cn(
                        'pointer-events-none absolute -inset-0.5 border border-primary/20',
                        isMobile ? 'rounded-[0.95rem]' : 'rounded-[1.35rem]'
                      )}
                    />
                  )}
                  <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-white/90" />
                  {isCurrentMonth && minutes > 0 && (
                    <div className="pointer-events-none absolute inset-x-4 top-0 h-14 rounded-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.55),rgba(255,255,255,0)_72%)] opacity-80" />
                  )}

                  {!isMobile ? (
                    <div className="relative z-10 mb-3 flex items-start justify-between gap-1.5">
                      <span
                        className={cn(
                          'inline-flex items-center justify-center rounded-full border font-black tracking-tighter tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]',
                          'min-w-[2rem] px-2 py-1 text-xs',
                          idx % 7 === 5 && isCurrentMonth ? 'border-blue-100 bg-blue-50 text-blue-700' : idx % 7 === 6 && isCurrentMonth ? 'border-rose-100 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-700',
                          isTodayCalendar && 'border-primary/20 text-primary'
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      <span className="h-6 w-6" aria-hidden="true" />
                    </div>
                  ) : null}

                  <div className={cn('flex items-center justify-center', isMobile ? 'h-full' : 'mt-auto px-1 pt-4')}>
                    {shouldRenderTime ? (
                      <span
                        className={cn(
                          'dashboard-number block max-w-full whitespace-nowrap tabular-nums leading-none text-center',
                          isMobile
                            ? isVeryLongTimeLabel
                              ? 'text-[0.5rem] tracking-[-0.1em]'
                              : isLongTimeLabel
                                ? 'text-[0.58rem] tracking-[-0.08em]'
                                : 'text-[0.68rem] tracking-[-0.06em]'
                            : isVeryLongTimeLabel
                              ? 'text-[0.86rem] tracking-[-0.04em]'
                              : isLongTimeLabel
                                ? 'text-[0.96rem] tracking-[-0.04em]'
                                : 'text-[1.06rem] tracking-[-0.05em]',
                          parentValueTone
                        )}
                      >
                        {exactTimeLabel}
                      </span>
                    ) : (
                      <span className={cn(isMobile ? 'h-[1.35rem]' : 'h-[2rem]')} aria-hidden="true" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {!selectedDateForPlan && (
        <div className="flex items-center justify-center gap-2 py-2.5 px-4 mx-1 rounded-2xl bg-muted/20 border border-dashed border-muted-foreground/10">
          <Info className="h-3.5 w-3.5 text-primary/30 shrink-0" />
          <p className="text-[11px] font-bold text-muted-foreground/50 text-center leading-relaxed">날짜를 누르면 그날의 기록을 확인할 수 있어요.</p>
        </div>
      )}

      <Dialog open={!!selectedDateForPlan} onOpenChange={(open) => !open && setSelectedDateForPlan(null)}>
        <DialogContent className={cn("border-none shadow-2xl p-0 overflow-hidden", isMobile ? "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-[380px] rounded-[2.5rem]" : "sm:max-w-xl rounded-[3rem]")}>
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#2563eb_42%,#10b981_100%)] p-8 text-white">
            <div className="absolute inset-x-0 top-0 h-px bg-white/75" />
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/12 blur-2xl" />
            <Sparkles className="absolute top-0 right-0 p-8 h-32 w-32 opacity-15" />
            <div className="relative z-10 space-y-3">
              <Badge className="w-fit border border-white/20 bg-white/12 text-white font-black text-[10px] uppercase tracking-[0.22em]">기록 상세</Badge>
              <DialogHeader><DialogTitle className="text-2xl sm:text-3xl font-black tracking-tighter flex items-center gap-3"><ClipboardList className="h-6 w-6 sm:h-7 sm:w-7 text-white/70" /> {selectedDateForPlan && format(selectedDateForPlan, 'M월 d일 (EEEE)', {locale: ko})}</DialogTitle><DialogDescription className="text-sm font-bold text-white/75">그날의 루틴과 학습 흐름을 한 번에 확인해요.</DialogDescription></DialogHeader>
            </div>
          </div>
          <div className={cn("bg-[#fafafa] overflow-y-auto custom-scrollbar", isMobile ? "max-h-[60vh]" : "max-h-[600px]")}>
            <Tabs defaultValue={dailyReport && dailyReport.status === 'sent' ? "ai-report" : "today-plan"} className="w-full">
              <TabsList className="grid w-full grid-cols-2 rounded-none h-16 bg-muted/20 p-0 border-b">
                <TabsTrigger value="ai-report" disabled={!dailyReport || dailyReport.status !== 'sent'} className="data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-amber-500 font-black text-[10px] uppercase tracking-widest flex flex-col gap-1 py-2">
                  <Sparkles className="h-3.5 w-3.5" /> 학습 리포트
                </TabsTrigger>
                <TabsTrigger value="today-plan" className="data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-primary font-black text-[10px] uppercase tracking-widest flex flex-col gap-1 py-2">
                  <ClipboardList className="h-3.5 w-3.5" /> 오늘 계획
                </TabsTrigger>
              </TabsList>
              <div className={cn("space-y-6", isMobile ? "p-5" : "p-8")}>
                <TabsContent value="ai-report" className="mt-0">
                  {reportLoading ? (
                    <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
                  ) : dailyReport && dailyReport.status === 'sent' ? (
                    <VisualReportViewer
                      content={dailyReport.content}
                      aiMeta={dailyReport.aiMeta}
                      dateKey={dailyReport.dateKey}
                      studentName={dailyReport.studentName}
                    />
                  ) : (
                    <div className="py-20 text-center flex flex-col items-center gap-4 opacity-20 italic">
                      <FileText className="h-12 w-12" />
                      <p className="font-black text-sm">이날의 학습 리포트가 없습니다.</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="today-plan" className="mt-0 space-y-4">
                  <section className="space-y-4 rounded-[1.9rem] border border-[#FFD7B5] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,239,0.98)_100%)] p-4 shadow-[0_24px_52px_-36px_rgba(201,90,0,0.22)] sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <Badge className="w-fit rounded-full border border-[#FFD3AC] bg-[#FFF3E6] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#C95A00] shadow-none">
                          그날 투두 요약
                        </Badge>
                        <div>
                          <h3 className="text-base font-black tracking-tight text-[#14295F] sm:text-lg">
                            {selectedDateForPlan ? format(selectedDateForPlan, 'M월 d일', { locale: ko }) : '선택 날짜'}에 진행한 할 일
                          </h3>
                          <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
                            {shouldHideTodoDetailSections
                              ? '루틴, 학습, 기타 일정을 한 번에 빠르게 확인할 수 있어요.'
                              : '루틴, 학습, 기타 일정을 먼저 한 번에 보고 아래에서 자세히 확인하세요.'}
                          </p>
                        </div>
                      </div>
                      <Badge className="rounded-full border border-[#FFD5B2] bg-white px-3 py-1 text-[10px] font-black text-[#C95A00] shadow-none">
                        완료율 {quickPlanCompletionRate}%
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge className="rounded-full border border-[#FFD5B2] bg-white px-3 py-1 text-[10px] font-black text-[#C95A00] shadow-none">
                        루틴 {scheduleItems.length}개
                      </Badge>
                      <Badge className="rounded-full border border-[#FFD8B8] bg-[#FFF6EC] px-3 py-1 text-[10px] font-black text-[#C95A00] shadow-none">
                        학습 {studyTasks.length}개
                      </Badge>
                      <Badge className="rounded-full border border-[#FFE4CF] bg-[#FFF9F3] px-3 py-1 text-[10px] font-black text-[#D97706] shadow-none">
                        기타 {personalTasks.length}개
                      </Badge>
                    </div>

                    {todoPreviewItems.length === 0 ? (
                      <div className="rounded-[1.45rem] border border-dashed border-[#FFD9BD] bg-white/90 p-5 text-center">
                        <p className="text-sm font-black text-[#C95A00]">그날 등록된 할 일이 없습니다.</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">등원 기록이 있으면 아래 시간 요약은 그대로 확인할 수 있어요.</p>
                      </div>
                    ) : (
                      <div className="grid gap-2.5">
                        {todoPreviewItems.map((item) => (
                          <div
                            key={item.id}
                            className={cn(
                              "flex items-center gap-3 rounded-[1.2rem] border px-3 py-3 shadow-[0_18px_34px_-30px_rgba(20,41,95,0.18)] transition-colors",
                              item.done ? "border-[#FFD6B3] bg-[#FFF6EC]" : "border-[#F3E4D4] bg-white"
                            )}
                          >
                            <div className={cn("rounded-full border px-2.5 py-1 text-[10px] font-black shadow-none", item.categoryClassName)}>
                              {item.categoryLabel}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black text-[#14295F]">{item.title}</p>
                              <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{item.meta}</p>
                            </div>
                            <Badge className={cn("rounded-full px-2.5 py-1 text-[10px] font-black shadow-none", item.stateClassName)}>
                              {item.stateLabel}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-[1.35rem] border border-[#FFD9BC] bg-white px-4 py-4 shadow-[0_18px_34px_-30px_rgba(201,90,0,0.18)]">
                        <div className="flex items-center gap-2 text-[#C95A00]">
                          <MapPin className="h-4 w-4" />
                          <p className="text-[10px] font-black uppercase tracking-[0.2em]">등원시간</p>
                        </div>
                        <p className="mt-3 text-2xl font-black tracking-tight text-[#14295F]">{selectedDateAttendanceSummary.checkInLabel}</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">실제 출결 기록 기준</p>
                      </div>
                      <div className="rounded-[1.35rem] border border-[#FFD9BC] bg-[#FFF9F3] px-4 py-4 shadow-[0_18px_34px_-30px_rgba(201,90,0,0.16)]">
                        <div className="flex items-center gap-2 text-[#C95A00]">
                          <School className="h-4 w-4" />
                          <p className="text-[10px] font-black uppercase tracking-[0.2em]">하원시간</p>
                        </div>
                        <p className="mt-3 text-2xl font-black tracking-tight text-[#14295F]">{selectedDateAttendanceSummary.checkOutLabel}</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">실제 출결 기록 기준</p>
                      </div>
                    </div>
                  </section>

                  {!shouldHideTodoDetailSections ? (
                    <>
                      {isToday ? (
                        <div className="rounded-[1.35rem] border border-amber-200 bg-amber-50/80 p-4">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
                            <div className="min-w-0">
                              <p className="text-[11px] font-black text-amber-900">오늘 루틴 수정 안내</p>
                              <p className="mt-1 break-keep text-[11px] font-semibold leading-5 text-amber-800/80">
                                기록트랙에서는 빠른 수정만 하고, 큰 루틴 편집은 계획트랙에서 마무리하는 흐름이 가장 안전해요.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <section className="space-y-3 rounded-[1.65rem] border border-primary/10 bg-white/92 p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/55">루틴</p>
                            <h3 className="mt-1 text-sm font-black text-primary">빠른 루틴 확인/수정</h3>
                          </div>
                          <Badge className="rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-[10px] font-black text-primary shadow-none">
                            {scheduleItems.length}개
                          </Badge>
                        </div>

                        {!isActuallyPast && !isParent ? (
                          <RoutineComposerCard
                            title="빠른 루틴 추가"
                            description="템플릿 하나 선택하고 필요한 이름만 수정하면 바로 저장돼요."
                            value={newRoutineTitle}
                            onValueChange={(value) => {
                              setNewRoutineTitle(value);
                              if (!value.trim()) {
                                setSelectedRoutineTemplateKey('custom');
                              }
                            }}
                            onSubmit={() => handleAddTask(newRoutineTitle, 'schedule')}
                            isSubmitting={isSubmitting}
                            isMobile={isMobile}
                            compact
                            selectedTemplateKey={selectedRoutineTemplateKey}
                            onTemplateSelect={handleRoutineTemplateSelect}
                            templateOptions={ROUTINE_TEMPLATE_OPTIONS}
                          />
                        ) : null}

                        {scheduleItems.length === 0 ? (
                          <div className="rounded-[1.35rem] border border-dashed border-primary/15 bg-slate-50/70 p-5 text-center">
                            <p className="text-sm font-black text-primary">등록된 루틴이 없습니다.</p>
                          </div>
                        ) : (
                          <div className="grid gap-3">
                            {[...scheduleItems]
                              .sort((a, b) => (a.title.split(': ')[1] || '00:00').localeCompare(b.title.split(': ')[1] || '00:00'))
                              .map((item) => (
                                <ScheduleItemCard
                                  key={item.id}
                                  item={{ id: item.id, title: item.title }}
                                  onUpdateRange={handleUpdateScheduleRange}
                                  onDelete={() => handleDeleteTask(item as WithId<StudyPlanItem>)}
                                  isPast={isActuallyPast}
                                  isToday={isToday}
                                  isMobile={isMobile}
                                  disabled={isParent}
                                />
                              ))}
                          </div>
                        )}
                      </section>

                      <section className="space-y-3 rounded-[1.65rem] border border-emerald-100 bg-white/92 p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600/70">학습</p>
                            <h3 className="mt-1 text-sm font-black text-slate-900">오늘 학습 계획</h3>
                          </div>
                          <Badge className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700 shadow-none">
                            완료 {completedStudyCount}/{studyTasks.length}
                          </Badge>
                        </div>

                        {!isActuallyPast && !isParent ? (
                          <StudyComposerCard
                            title="빠른 학습 추가"
                            description="시간을 못 정해도 괜찮아요. 분량형이나 시간형 중 편한 방식으로 바로 적어보세요."
                            subjectOptions={SUBJECTS}
                            subjectValue={newStudySubject}
                            onSubjectChange={setNewStudySubject}
                            studyModeValue={newStudyMode}
                            onStudyModeChange={setNewStudyMode}
                            minuteValue={newStudyMinutes}
                            onMinuteChange={setNewStudyMinutes}
                            amountValue={newStudyTargetAmount}
                            onAmountChange={setNewStudyTargetAmount}
                            amountUnitValue={newStudyAmountUnit}
                            onAmountUnitChange={setNewStudyAmountUnit}
                            customAmountUnitValue={newStudyCustomAmountUnit}
                            onCustomAmountUnitChange={setNewStudyCustomAmountUnit}
                            enableVolumeMinutes={enableVolumeStudyMinutes}
                            onEnableVolumeMinutesChange={setEnableVolumeStudyMinutes}
                            taskValue={newStudyTask}
                            onTaskChange={setNewStudyTask}
                            onSubmit={() => handleAddTask(newStudyTask, 'study')}
                            isSubmitting={isSubmitting}
                            isMobile={isMobile}
                            compact
                          />
                        ) : null}

                        {studyTasks.length === 0 ? (
                          <div className="rounded-[1.35rem] border border-dashed border-emerald-200 bg-emerald-50/40 p-5 text-center">
                            <p className="text-sm font-black text-emerald-700">등록된 학습 계획이 없습니다.</p>
                          </div>
                        ) : (
                          <div className="grid gap-3">
                            {studyTasks.map((task) => {
                              const subject = SUBJECTS.find((item) => item.id === (task.subject || 'etc'));
                              const isVolumeTask = resolveStudyPlanMode(task) === 'volume';
                              const unitLabel = resolveAmountUnitLabel(task);
                              return (
                                <PlanItemCard
                                  key={task.id}
                                  id={task.id}
                                  title={task.title}
                                  checked={task.done}
                                  onToggle={() => handleToggleTask(task as WithId<StudyPlanItem>)}
                                  onDelete={() => handleDeleteTask(task as WithId<StudyPlanItem>)}
                                  disabled={isActuallyPast || isParent}
                                  isMobile={isMobile}
                                  tone="emerald"
                                  badgeLabel={`${subject?.label || '기타'} · ${isVolumeTask ? '분량형' : '시간형'}`}
                                  metaLabel={buildStudyTaskMeta(task)}
                                  volumeMeta={isVolumeTask ? {
                                    targetAmount: Math.max(0, task.targetAmount || 0),
                                    actualAmount: Math.max(0, task.actualAmount || 0),
                                    unitLabel,
                                    onCommitActual: (value) => handleCommitStudyActualAmount(task as WithId<StudyPlanItem>, value),
                                  } : null}
                                  compact
                                />
                              );
                            })}
                          </div>
                        )}
                      </section>

                      <section className="space-y-3 rounded-[1.65rem] border border-amber-100 bg-white/92 p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-600/70">기타</p>
                            <h3 className="mt-1 text-sm font-black text-slate-900">기타 일정</h3>
                          </div>
                          <Badge className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[10px] font-black text-amber-700 shadow-none">
                            완료 {completedPersonalCount}/{personalTasks.length}
                          </Badge>
                        </div>

                        {!isActuallyPast && !isParent ? (
                          <div className="flex items-center gap-2 rounded-[1.15rem] border border-amber-100 bg-white/92 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                            <Input
                              placeholder="예: 병원, 상담, 준비물 챙기기"
                              value={newPersonalTask}
                              onChange={(e) => setNewPersonalTask(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newPersonalTask, 'personal')}
                              disabled={isSubmitting}
                              className="h-10 border-none bg-transparent text-sm font-bold shadow-none focus-visible:ring-0"
                            />
                            <Button
                              type="button"
                              onClick={() => handleAddTask(newPersonalTask, 'personal')}
                              disabled={isSubmitting || !newPersonalTask.trim()}
                              className={cn("rounded-xl bg-amber-500 font-black text-white hover:bg-amber-600", isMobile ? "h-10 px-3 text-[11px]" : "h-10 px-4 text-xs")}
                            >
                              추가
                            </Button>
                          </div>
                        ) : null}

                        {personalTasks.length === 0 ? (
                          <div className="rounded-[1.35rem] border border-dashed border-amber-200 bg-amber-50/40 p-5 text-center">
                            <p className="text-sm font-black text-amber-700">등록된 기타 일정이 없습니다.</p>
                          </div>
                        ) : (
                          <div className="grid gap-3">
                            {personalTasks.map((task) => (
                              <PlanItemCard
                                key={task.id}
                                id={task.id}
                                title={task.title}
                                checked={task.done}
                                onToggle={() => handleToggleTask(task as WithId<StudyPlanItem>)}
                                onDelete={() => handleDeleteTask(task as WithId<StudyPlanItem>)}
                                disabled={isActuallyPast || isParent}
                                isMobile={isMobile}
                                tone="amber"
                                badgeLabel="기타"
                                compact
                              />
                            ))}
                          </div>
                        )}
                      </section>
                    </>
                  ) : null}

                  {!isParent ? (
                    <Button asChild className="h-11 w-full rounded-2xl bg-primary font-black text-white shadow-[0_18px_36px_-24px_rgba(20,41,95,0.45)] hover:bg-primary/92">
                      <Link href={selectedDateKey ? `/dashboard/plan?date=${selectedDateKey}` : '/dashboard/plan'}>
                        계획트랙에서 전체 편집
                      </Link>
                    </Button>
                  ) : (
                    <div className="rounded-[1.15rem] border border-slate-200 bg-slate-50/70 px-4 py-3 text-center text-[11px] font-semibold text-slate-500">
                      학부모 모드에서는 계획 확인만 가능해요.
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>

            {false && (
            <Tabs defaultValue={dailyReport?.status === 'sent' ? "ai-report" : "schedule"} className="w-full">
              <TabsList className="grid w-full grid-cols-4 rounded-none h-16 bg-muted/20 p-0 border-b">
                <TabsTrigger value="ai-report" disabled={dailyReport?.status !== 'sent'} className="data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-amber-500 font-black text-[10px] uppercase tracking-widest flex flex-col gap-1 py-2">
                  <Sparkles className="h-3.5 w-3.5" /> 학습 리포트
                </TabsTrigger>
                <TabsTrigger value="schedule" className="data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-primary font-black text-[10px] uppercase tracking-widest flex flex-col gap-1 py-2">
                  <Clock className="h-3.5 w-3.5" /> 루틴
                </TabsTrigger>
                <TabsTrigger value="study" className="data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-emerald-500 font-black text-[10px] uppercase tracking-widest flex flex-col gap-1 py-2">
                  <Target className="h-3.5 w-3.5" /> 학습
                </TabsTrigger>
                <TabsTrigger value="personal" className="data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-rose-500 font-black text-[10px] uppercase tracking-widest flex flex-col gap-1 py-2">
                  <Activity className="h-3.5 w-3.5" /> 개인
                </TabsTrigger>
              </TabsList>
              <div className={cn("space-y-8", isMobile ? "p-5" : "p-8")}>
                <TabsContent value="ai-report" className="mt-0">
                  {reportLoading ? (
                    <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
                  ) : dailyReport?.status === 'sent' && dailyReport ? (
                    <VisualReportViewer
                      content={legacyReportContent}
                      aiMeta={legacyReportAiMeta}
                      dateKey={legacyReportDateKey}
                      studentName={legacyReportStudentName}
                    />
                  ) : (
                    <div className="py-20 text-center flex flex-col items-center gap-4 opacity-20 italic">
                      <FileText className="h-12 w-12" />
                      <p className="font-black text-sm">이날의 학습 리포트가 없습니다.</p>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="schedule" className="mt-0 space-y-4">
                  {isToday && (
                    <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 flex items-start gap-3 mb-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                      <p className="text-[10px] font-bold text-amber-900 leading-relaxed">당일 출석 루틴도 작성/수정할 수 있지만, 벌점은 하루 최대 1점만 자동 반영됩니다.</p>
                    </div>
                  )}
                  {!isActuallyPast && !isParent && (
                    <div className="flex justify-end">
                      <Dialog open={isRoutineModalOpen} onOpenChange={setIsRoutineModalOpen}>
                        <DialogTrigger asChild><Button variant="ghost" size="sm" className="h-8 text-[10px] font-black gap-1 bg-white shadow-sm border rounded-xl"><Plus className="h-3.5 w-3.5" /> 루틴 추가</Button></DialogTrigger>
                        <DialogContent className="rounded-3xl p-10 border-none shadow-2xl fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[380px]">
                          <DialogHeader><DialogTitle className="text-2xl font-black tracking-tighter">생활 루틴 추가</DialogTitle><DialogDescription className="sr-only">새로운 생활 루틴을 추가합니다</DialogDescription></DialogHeader>
                          <Input placeholder="루틴 이름 (예: 영어 학원, 점심 식사)" value={newRoutineTitle} onChange={(e) => setNewRoutineTitle(e.target.value)} className="h-14 border-2 rounded-2xl font-bold" />
                          <Button onClick={() => handleAddTask(newRoutineTitle, 'schedule')} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20">루틴 생성</Button>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                  {scheduleItems.length === 0 ? <div className="py-16 text-center opacity-20 italic font-black text-sm border-2 border-dashed rounded-3xl">등록된 루틴이 없습니다.</div> : scheduleItems.map(item => <ScheduleItemRow key={item.id} item={item} onUpdateRange={handleUpdateScheduleRange} onDelete={handleDeleteTask} isPast={isActuallyPast} isToday={isToday} isMobile={isMobile} disabled={isParent} />)}
                </TabsContent>
                <TabsContent value="study" className="mt-0 space-y-4">
                  <div className="grid gap-3">
                    {studyTasks.map(task => {
                      const subj = SUBJECTS.find(s => s.id === (task.subject || 'etc'));
                      return (
                        <div key={task.id} className={cn("flex items-start gap-4 p-5 rounded-[1.75rem] border-2 transition-all group", task.done ? "bg-emerald-50/20 border-emerald-100/50" : "bg-white shadow-sm hover:shadow-md")}>
                          <Checkbox checked={task.done} onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} disabled={isActuallyPast || isParent} className="mt-1 h-6 w-6 rounded-lg" />
                          <div className="flex-1 grid gap-1.5">
                            <div className="flex items-center gap-2">
                              <Badge className={cn("rounded-md font-black text-[9px] px-2 py-0 border-none shadow-sm", subj?.color, "text-white")}>{subj?.label}</Badge>
                              {task.targetMinutes && <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-tight flex items-center gap-1"><Clock className="h-3 w-3" /> {task.targetMinutes}분 목표</span>}
                            </div>
                            <Label className={cn("text-base font-bold tracking-tight transition-all leading-snug break-keep", task.done && "line-through text-muted-foreground/40 italic")}>{task.title}</Label>
                          </div>
                          {!isActuallyPast && !isParent && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={cn(
                                "h-8 w-8 text-muted-foreground hover:text-destructive transition-all shrink-0",
                                isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                              )} 
                              onClick={() => handleDeleteTask(task as WithId<StudyPlanItem>)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {!isActuallyPast && !isParent && (
                    <div className="flex flex-col gap-4 p-6 rounded-[2rem] bg-white border-2 border-emerald-100 shadow-sm mt-4">
                      <div className="grid grid-cols-2 gap-3">
                        <Select value={newStudySubject} onValueChange={setNewStudySubject}>
                          <SelectTrigger className="h-10 rounded-xl border-2 text-xs font-black"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">{SUBJECTS.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input type="number" value={newStudyMinutes} onChange={(e) => setNewStudyMinutes(e.target.value)} className="h-10 rounded-xl border-2 text-xs font-black text-center" />
                      </div>
                      <div className="relative flex items-center bg-muted/10 rounded-2xl p-1.5 gap-1.5">
                        <Input placeholder="공부 할 일 추가..." value={newStudyTask} onChange={(e) => setNewStudyTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newStudyTask, 'study')} className="flex-1 border-none shadow-none focus-visible:ring-0 font-bold h-10 text-sm" />
                        <Button size="icon" onClick={() => handleAddTask(newStudyTask, 'study')} className="h-10 w-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 shrink-0 relative z-10"><Plus className="h-5 w-5" /></Button>
                      </div>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="personal" className="mt-0 space-y-4">
                  <div className="grid gap-3">
                    {personalTasks.map(task => (
                      <div key={task.id} className={cn("flex items-center gap-4 p-5 rounded-[1.75rem] border-2 transition-all group", task.done ? "bg-rose-50/20 border-rose-100/50" : "bg-white shadow-sm")}>
                        <Checkbox checked={task.done} onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} disabled={isActuallyPast || isParent} className="h-6 w-6 rounded-lg" />
                        <Label className={cn("flex-1 text-base font-bold transition-all", task.done && "line-through opacity-40")}>{task.title}</Label>
                        {!isActuallyPast && !isParent && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={cn(
                              "h-8 w-8 text-muted-foreground hover:text-destructive transition-all shrink-0",
                              isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                            )} 
                            onClick={() => handleDeleteTask(task as WithId<StudyPlanItem>)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  {!isActuallyPast && !isParent && (
                    <div className="relative flex items-center bg-white border-2 border-rose-100 rounded-2xl p-1.5 shadow-sm mt-4 gap-1.5">
                      <Input placeholder="기타 일정 추가..." value={newPersonalTask} onChange={(e) => setNewPersonalTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newPersonalTask, 'personal')} className="flex-1 border-none shadow-none focus-visible:ring-0 font-bold h-11 text-sm" />
                      <Button variant="outline" size="icon" onClick={() => handleAddTask(newPersonalTask, 'personal')} className="h-10 w-10 rounded-xl border-2 border-rose-500 text-rose-600 shadow-lg shadow-rose-500/10 shrink-0 relative z-10"><Plus className="h-5 w-5" /></Button>
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
            )}
          </div>
          <div className="p-8 bg-white border-t shrink-0 flex justify-center">
            <Button variant="ghost" className="w-full h-12 rounded-2xl font-black text-muted-foreground/60 hover:bg-muted/50 transition-all" onClick={() => setSelectedDateForPlan(null)}>분석 창 닫기</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'requested': return <Badge variant="secondary" className="bg-amber-50 text-amber-600 border-amber-100 font-black text-[10px]">승인 대기</Badge>;
    case 'confirmed': return <Badge className="bg-emerald-500 text-white border-none font-black text-[10px] shadow-sm">예약 확정</Badge>;
    case 'done': return <Badge variant="outline" className="opacity-40 font-black text-[10px]">상담 완료</Badge>;
    case 'canceled': return <Badge variant="destructive" className="font-black text-[10px]">취소됨</Badge>;
    default: return <Badge variant="outline" className="font-black text-[10px]">{status}</Badge>;
  }
};

const UserMinus = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" x2="16" y1="11" y2="11"/></svg>;


