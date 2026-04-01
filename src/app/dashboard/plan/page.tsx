
'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Loader2, 
  Plus, 
  Clock, 
  MapPin,
  School,
  Coffee,
  Trash2,
  CalendarDays,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  AlertCircle,
  Zap,
  PencilLine,
  BrainCircuit,
  ArrowRight,
} from 'lucide-react';
import { useCollection, useFirestore, useUser, useDoc } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp,
  writeBatch,
  setDoc,
  increment,
  limit,
  arrayUnion,
} from 'firebase/firestore';
import { 
  format, 
  addDays, 
  startOfWeek, 
  isSameDay, 
  getDay,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  isBefore,
  startOfDay
} from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  type GeneratedStudyPlan,
  type GrowthProgress,
  type StudyPlanItem,
  type StudyPlannerDiagnosticRecord,
  type StudentProfile,
  type StudentScheduleDoc,
  type StudentScheduleTemplate,
  type UserStudyProfile,
  type WithId,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  EMPTY_ATTENDANCE_SCHEDULE_DRAFT,
  ROUTINE_TEMPLATE_OPTIONS,
  type AttendanceScheduleDraft,
  type AttendanceAwaySlot,
  type RecentStudyOption,
  type SavedAttendanceRoutine,
  type StudyAmountUnit,
  type StudyPlanMode,
} from '@/components/dashboard/student-planner/planner-constants';
import { RoutineComposerCard } from '@/components/dashboard/student-planner/routine-composer-card';
import { StudyComposerCard } from '@/components/dashboard/student-planner/study-composer-card';
import { RecentStudySheet } from '@/components/dashboard/student-planner/recent-study-sheet';
import { StudyPlanSheet } from '@/components/dashboard/student-planner/study-plan-sheet';
import { RoutineOnboardingFlow } from '@/components/dashboard/student-planner/routine-onboarding-flow';
import { AttendanceScheduleSheet } from '@/components/dashboard/student-planner/attendance-schedule-sheet';
import {
  BUILTIN_PLANNER_TEMPLATES,
  PLAN_DEFAULT_START_TIME,
  PLAN_TRACK_DAILY_POINT_CAP,
  PLANNER_QUICK_TASK_SUGGESTIONS,
  assignAutoWindowsToTasks,
  buildPlannerTemplateRecentKey,
  buildPlannerTemplateStorageKey,
  computePlannerStreak,
  formatClockRange,
  formatDurationLabel,
  getNextAutoWindow,
  type PlannerTaskDraft,
  type PlannerTemplateRecord,
} from '@/lib/plan-track';
import {
  addMinutesToTime,
  buildDraftFromScheduleDoc,
  buildLegacyScheduleTitles,
  buildScheduleDocFromDraft,
  parseTimeToMinutes,
  validateScheduleDraft,
} from '@/features/schedules/lib/scheduleModel';
import { buildMainPlanRecommendations, type MainPlanRecommendation } from '@/features/planner/lib/buildMainPlanRecommendations';

const SAME_DAY_ROUTINE_PENALTY_POINTS = 1;

const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));
const WEEKDAY_OPTIONS = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 0, label: '일' },
];

const PLAN_TRACK_ONBOARDING_VERSION = 1;
const DAILY_STUDY_MINUTES_MAP: Record<string, number> = {
  '4h': 240,
  '6h': 360,
  '8h': 480,
  '10h': 600,
  '12h-plus': 720,
};
const RECOMMENDATION_BADGE_TONE: Record<MainPlanRecommendation['badge'], string> = {
  계획: 'border-[#DCE6F5] bg-white text-[#17326B]',
  복습: 'border-[#FFE2C5] bg-[#FFF4E8] text-[#D86A11]',
  과목배분: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  학습방법: 'border-sky-100 bg-sky-50 text-sky-700',
  동기: 'border-rose-100 bg-rose-50 text-rose-700',
};

function createAwaySlot(overrides?: Partial<AttendanceAwaySlot>): AttendanceAwaySlot {
  return {
    id: `away-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startTime: '',
    endTime: '',
    reason: '',
    ...overrides,
  };
}

function parseAwayScheduleTitle(title: string): AttendanceAwaySlot | null {
  const matched = title.match(/^외출 예정(?: · (.*?))?: (\d{2}:\d{2}) ~ (\d{2}:\d{2})$/);
  if (!matched) return null;
  return createAwaySlot({
    reason: matched[1]?.trim() || '',
    startTime: matched[2] || '',
    endTime: matched[3] || '',
  });
}

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

function normalizeStudyTitle(title: string) {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

function getPlanTimestampMs(task: Pick<StudyPlanItem, 'updatedAt' | 'createdAt'>) {
  const updatedAtMs = task.updatedAt?.toDate?.().getTime?.() ?? 0;
  const createdAtMs = task.createdAt?.toDate?.().getTime?.() ?? 0;
  return Math.max(updatedAtMs, createdAtMs);
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function timeToClockProgress(time?: string | null) {
  if (!time || !time.includes(':')) return 0;
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return clampPercent(((hour * 60) + minute) / (24 * 60) * 100);
}

function formatMinutesSummary(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}


function ScheduleItemRow({ item, onUpdateRange, onDelete, isPast, isToday, isMobile }: any) {
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
    if (isPast) return;
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
      isPast && "opacity-60 pointer-events-none"
    )}>
      <Select value={p} onValueChange={(v) => handleValueChange(type, 'p', v)} disabled={isPast}>
        <SelectTrigger className={cn("border-none bg-transparent font-black px-1 focus:ring-0 h-6 shadow-none", isMobile ? "w-[48px] text-[10px]" : "w-[55px] text-xs")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-none shadow-2xl">
          <SelectItem value="오전">오전</SelectItem>
          <SelectItem value="오후">오후</SelectItem>
        </SelectContent>
      </Select>
      <div className="w-px h-2 bg-border/50 mx-0.5" />
      <Select value={h} onValueChange={(v) => handleValueChange(type, 'h', v)} disabled={isPast}>
        <SelectTrigger className={cn("border-none bg-transparent font-mono font-black px-1 focus:ring-0 h-6 shadow-none", isMobile ? "w-[36px] text-[11px]" : "w-[45px] text-sm")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[200px]">{HOURS.map(hour => <SelectItem key={hour} value={hour}>{hour}</SelectItem>)}</SelectContent>
      </Select>
      <span className="text-[9px] font-black opacity-30 px-0.5">:</span>
      <Select value={m} onValueChange={(v) => handleValueChange(type, 'm', v)} disabled={isPast}>
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
            <Icon className={cn(isMobile ? "h-3.5 w-3.5 text-primary" : "h-4 w-4")} />
          </div>
          <Label className={cn("font-black tracking-tight block truncate", isMobile ? "text-xs" : "text-sm")}>{titlePart}</Label>
        </div>
        {!isPast && (
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
        {isToday && <Badge variant="outline" className="h-5 px-1.5 text-[8px] font-black border-amber-200 text-amber-700">당일 수정 +1</Badge>}
      </div>

      <div className="flex items-center gap-1.5 w-full justify-start sm:justify-start">
        {isPast ? (
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

export default function StudyPlanPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const isMobile = viewMode === 'mobile';
  const rewardGradient = 'from-[#14295F] via-[#1B326D] to-[#233E86]';
  const [planTrackEntryMode, setPlanTrackEntryMode] = useState<'auto' | 'onboarding' | 'planner'>('auto');
  const [hasDismissedRoutineOnboardingLocally, setHasDismissedRoutineOnboardingLocally] = useState(false);
  const onboardingPresentationRef = useRef(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
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
  const [isTaskCopyDialogOpen, setIsTaskCopyDialogOpen] = useState(false);
  const [isRoutineCopyDialogOpen, setIsRoutineCopyDialogOpen] = useState(false);
  const [isRecentStudySheetOpen, setIsRecentStudySheetOpen] = useState(false);
  const [isStudyPlanSheetOpen, setIsStudyPlanSheetOpen] = useState(false);
  const [isTemplateSheetOpen, setIsTemplateSheetOpen] = useState(false);
  const [isRoutineSectionOpen, setIsRoutineSectionOpen] = useState(false);
  const [isMemoSectionOpen, setIsMemoSectionOpen] = useState(false);
  const [showQuickAddCard, setShowQuickAddCard] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [customTemplates, setCustomTemplates] = useState<PlannerTemplateRecord[]>([]);
  const [recentTemplateIds, setRecentTemplateIds] = useState<string[]>([]);
  const [floatingPointBursts, setFloatingPointBursts] = useState<Array<{ id: number; label: string }>>([]);
  const [taskCopyWeeks, setTaskCopyWeeks] = useState('4');
  const [routineCopyWeeks, setRoutineCopyWeeks] = useState('4');
  const [taskCopyDays, setTaskCopyDays] = useState<number[]>([]);
  const [routineCopyDays, setRoutineCopyDays] = useState<number[]>([]);
  const [taskCopyItemIds, setTaskCopyItemIds] = useState<string[]>([]);
  const [routineCopyItemIds, setRoutineCopyItemIds] = useState<string[]>([]);
  const [recentStudyOptions, setRecentStudyOptions] = useState<RecentStudyOption[]>([]);
  const [recentStudyHistory, setRecentStudyHistory] = useState<StudyPlanItem[]>([]);
  const [isRecentStudyLoading, setIsRecentStudyLoading] = useState(false);
  const [activeRecentStudyKey, setActiveRecentStudyKey] = useState<string | null>(null);

  const [inTime, setInTime] = useState('09:00');
  const [outTime, setOutTime] = useState('22:00');
  const [awayStartTime, setAwayStartTime] = useState('');
  const [awayEndTime, setAwayEndTime] = useState('');
  const [awayReason, setAwayReason] = useState('');
  const [extraAwayPlans, setExtraAwayPlans] = useState<AttendanceAwaySlot[]>([]);
  const [isScheduleAbsent, setIsScheduleAbsent] = useState(false);
  const [scheduleNote, setScheduleNote] = useState('');
  const [isAttendanceScheduleSheetOpen, setIsAttendanceScheduleSheetOpen] = useState(false);
  const [attendanceSheetInitialTab, setAttendanceSheetInitialTab] = useState<'today' | 'weekday' | 'saved'>('today');
  const [expandedRecommendationIds, setExpandedRecommendationIds] = useState<string[]>([]);
  const [weekdayDraft, setWeekdayDraft] = useState<AttendanceScheduleDraft>(EMPTY_ATTENDANCE_SCHEDULE_DRAFT);
  const [selectedRecurringWeekdays, setSelectedRecurringWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [presetName, setPresetName] = useState('');
  const [scheduleRecommendationPrefill, setScheduleRecommendationPrefill] = useState<null | {
    recommendedWeeklyDays: number;
    recommendedDailyStudyMinutes: number;
    recommendedArrivalTime: string;
    recommendedDepartureTime: string;
    repeatWeekdays: number[];
    weeklyBalance: Record<string, number>;
    source?: string;
    createdAtISO?: string;
  }>(null);

  useEffect(() => {
    const requestedDate = searchParams.get('date');
    if (!requestedDate) {
      setSelectedDate(new Date());
      return;
    }

    const [year, month, day] = requestedDate.split('-').map(Number);
    if (!year || !month || !day) {
      setSelectedDate(new Date());
      return;
    }

    const nextDate = new Date(year, month - 1, day);
    if (Number.isNaN(nextDate.getTime())) {
      setSelectedDate(new Date());
      return;
    }

    setSelectedDate(nextDate);
  }, [searchParams]);

  useEffect(() => {
    if (!user || !searchParams.get('schedulePrefill')) return;
    try {
      const raw = window.localStorage.getItem(`planner-schedule-prefill:${user.uid}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as typeof scheduleRecommendationPrefill;
      if (!parsed) return;
      setScheduleRecommendationPrefill(parsed);
      setSelectedRecurringWeekdays(parsed.repeatWeekdays || [1, 2, 3, 4, 5]);
      setWeekdayDraft((previous) => ({
        ...previous,
        inTime: parsed.recommendedArrivalTime || previous.inTime,
        outTime: parsed.recommendedDepartureTime || previous.outTime,
      }));
      setInTime(parsed.recommendedArrivalTime || '09:00');
      setOutTime(parsed.recommendedDepartureTime || '22:00');
      setAttendanceSheetInitialTab('weekday');
      setIsAttendanceScheduleSheetOpen(true);
    } catch {
      window.localStorage.removeItem(`planner-schedule-prefill:${user.uid}`);
    }
  }, [searchParams, user]);

  const clearSchedulePrefillCache = useCallback(() => {
    if (!user) return;
    window.localStorage.removeItem(`planner-schedule-prefill:${user.uid}`);
    setScheduleRecommendationPrefill(null);
  }, [user]);

  useEffect(() => {
    if (!selectedDate) return;
    const day = getDay(selectedDate);
    setTaskCopyDays(prev => prev.length > 0 ? prev : [day]);
    setRoutineCopyDays(prev => prev.length > 0 ? prev : [day]);
  }, [selectedDate]);

  const isStudent = activeMembership?.role === 'student';
  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const weekKey = selectedDate ? format(selectedDate, "yyyy-'W'II") : '';

  const isPast = selectedDate ? isBefore(startOfDay(selectedDate), startOfDay(new Date())) : false;
  const isToday = selectedDate ? isSameDay(selectedDate, new Date()) : false;

  const weekDays = useMemo(() => {
    if (!selectedDate) return [];
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return [...Array(7)].map((_, i) => addDays(start, i));
  }, [selectedDate]);

  const weekRangeLabel = useMemo(() => {
    if (weekDays.length !== 7) return '';
    const start = weekDays[0];
    const end = weekDays[6];
    const sameMonth = format(start, 'yyyy-MM') === format(end, 'yyyy-MM');
    if (sameMonth) {
      return `${format(start, 'yyyy.MM.dd')} - ${format(end, 'dd')}`;
    }
    return `${format(start, 'yyyy.MM.dd')} - ${format(end, 'yyyy.MM.dd')}`;
  }, [weekDays]);

  const templateStorageKey = useMemo(
    () => (activeMembership?.id && user?.uid ? buildPlannerTemplateStorageKey(activeMembership.id, user.uid) : ''),
    [activeMembership?.id, user?.uid]
  );
  const templateRecentStorageKey = useMemo(
    () => (activeMembership?.id && user?.uid ? buildPlannerTemplateRecentKey(activeMembership.id, user.uid) : ''),
    [activeMembership?.id, user?.uid]
  );

  useEffect(() => {
    if (!templateStorageKey) {
      setCustomTemplates([]);
      return;
    }

    try {
      const raw = window.localStorage.getItem(templateStorageKey);
      if (!raw) {
        setCustomTemplates([]);
        return;
      }
      const parsed = JSON.parse(raw) as PlannerTemplateRecord[];
      setCustomTemplates(Array.isArray(parsed) ? parsed : []);
    } catch {
      window.localStorage.removeItem(templateStorageKey);
      setCustomTemplates([]);
    }
  }, [templateStorageKey]);

  useEffect(() => {
    if (!templateRecentStorageKey) {
      setRecentTemplateIds([]);
      return;
    }

    try {
      const raw = window.localStorage.getItem(templateRecentStorageKey);
      if (!raw) {
        setRecentTemplateIds([]);
        return;
      }
      const parsed = JSON.parse(raw) as string[];
      setRecentTemplateIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      window.localStorage.removeItem(templateRecentStorageKey);
      setRecentTemplateIds([]);
    }
  }, [templateRecentStorageKey]);

  useEffect(() => {
    if (!templateStorageKey) return;
    window.localStorage.setItem(templateStorageKey, JSON.stringify(customTemplates));
  }, [customTemplates, templateStorageKey]);

  useEffect(() => {
    if (!templateRecentStorageKey) return;
    window.localStorage.setItem(templateRecentStorageKey, JSON.stringify(recentTemplateIds));
  }, [recentTemplateIds, templateRecentStorageKey]);

  const moveWeek = (direction: -1 | 1) => {
    if (!selectedDate) return;
    setSelectedDate(addDays(selectedDate, direction * 7));
  };

  const recentStudyWeekKeys = useMemo(() => {
    if (!selectedDate) return [];
    return Array.from(
      new Set(
        [0, 7, 14].map((offset) =>
          format(addDays(selectedDate, -offset), "yyyy-'W'II")
        )
      )
    );
  }, [selectedDate]);

  const buildRecentStudyOption = useCallback(
    (task: WithId<StudyPlanItem>, sourceWeekKey: string): RecentStudyOption => {
      const subjectValue = task.subject || 'etc';
      const subject = SUBJECTS.find((item) => item.id === subjectValue);
      const studyModeValue = resolveStudyPlanMode(task);
      const amountUnitValue = (task.amountUnit || '문제') as StudyAmountUnit;
      const customAmountUnitValue = task.amountUnit === '직접입력' ? task.amountUnitLabel?.trim() || '' : '';
      const updatedAtMs = getPlanTimestampMs(task);
      const usedDate = updatedAtMs ? format(new Date(updatedAtMs), 'M/d') : task.dateKey.slice(5).replace('-', '/');

      return {
        key: [
          subjectValue,
          studyModeValue,
          studyModeValue === 'volume'
            ? `${Math.max(0, task.targetAmount || 0)}:${resolveAmountUnitLabel(task)}`
            : `${Math.max(0, task.targetMinutes || 0)}`,
          normalizeStudyTitle(task.title),
        ].join('::'),
        sourceId: task.id,
        sourceDateKey: task.dateKey,
        sourceWeekKey,
        title: task.title,
        subjectValue,
        subjectLabel: subject?.label || '기타',
        studyModeValue,
        studyModeLabel: studyModeValue === 'volume' ? '분량형' : '시간형',
        minuteValue: String(task.targetMinutes || ''),
        amountValue: String(task.targetAmount || ''),
        amountUnitValue,
        customAmountUnitValue,
        enableVolumeMinutes: studyModeValue === 'volume' && Number(task.targetMinutes || 0) > 0,
        metaLabel: buildStudyTaskMeta(task),
        updatedLabel: `${usedDate} 사용`,
      };
    },
    []
  );

  const planItemsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !activeMembership || !weekKey || !selectedDateKey) return null;
    return query(
      collection(
        firestore,
        'centers',
        activeMembership.id,
        'plans',
        user.uid,
        'weeks',
        weekKey,
        'items'
      ),
      where('dateKey', '==', selectedDateKey)
    );
  }, [firestore, user, activeMembership, weekKey, selectedDateKey]);

  const { data: dailyPlans, isLoading } = useCollection<StudyPlanItem>(planItemsQuery, { enabled: isStudent });

  const progressRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
  }, [firestore, activeMembership, user]);
  const { data: progress } = useDoc<GrowthProgress>(progressRef, { enabled: isStudent });

  const studentProfileRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'students', user.uid);
  }, [firestore, activeMembership, user]);
  const { data: studentProfile, isLoading: isStudentProfileLoading } = useDoc<StudentProfile>(studentProfileRef, {
    enabled: isStudent,
  });
  const currentStudyPlanRef = useMemoFirebase(() => {
    if (!firestore || !user || !weekKey) return null;
    return doc(firestore, 'users', user.uid, 'studyPlans', weekKey);
  }, [firestore, user, weekKey]);
  const { data: currentStudyPlan } = useDoc<{
    weekKey?: string;
    weeklyBalance?: GeneratedStudyPlan['weekly_balance'];
    dailyTodos?: GeneratedStudyPlan['daily_todos'];
    coachingMessage?: string | null;
  }>(currentStudyPlanRef, { enabled: isStudent });
  const selectedScheduleRef = useMemoFirebase(() => {
    if (!firestore || !user || !selectedDateKey) return null;
    return doc(firestore, 'users', user.uid, 'schedules', selectedDateKey);
  }, [firestore, selectedDateKey, user]);
  const { data: selectedScheduleDoc } = useDoc<StudentScheduleDoc>(selectedScheduleRef, { enabled: isStudent });
  const weekSchedulesQuery = useMemoFirebase(() => {
    if (!firestore || !user || weekDays.length === 0) return null;
    return query(
      collection(firestore, 'users', user.uid, 'schedules'),
      where('dateKey', '>=', format(weekDays[0], 'yyyy-MM-dd')),
      where('dateKey', '<=', format(weekDays[6], 'yyyy-MM-dd'))
    );
  }, [firestore, user, weekDays]);
  const { data: weekSchedules } = useCollection<StudentScheduleDoc>(weekSchedulesQuery, { enabled: isStudent });

  const scheduleTemplatesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'scheduleTemplates'));
  }, [firestore, user]);
  const { data: scheduleTemplates } = useCollection<StudentScheduleTemplate>(scheduleTemplatesQuery, {
    enabled: isStudent,
  });
  const hasRoutineProfile = Boolean(studentProfile?.studyRoutineProfile);
  const routineOnboardingState = studentProfile?.studyRoutineOnboarding;
  const hasSeenRoutineOnboarding =
    hasDismissedRoutineOnboardingLocally ||
    hasRoutineProfile ||
    Boolean(
      routineOnboardingState?.presentedAt ||
      routineOnboardingState?.completedAt ||
      routineOnboardingState?.dismissedAt ||
      routineOnboardingState?.status
    );
  const routineGuideTitle = '저장된 학습 기준';
  const routineGuideSummary =
    '처음 한 번 답한 설문 기준이에요. 이제는 이 기준을 바탕으로 학생이 직접 쓴 오늘 계획을 읽고 부족한 점과 보강 포인트를 보여줍니다.';
  const selectedWeekdayValue = selectedDate ? getDay(selectedDate) : 1;
  const activeScheduleTemplates = useMemo(
    () => (scheduleTemplates || []).filter((template) => template.active !== false),
    [scheduleTemplates]
  );
  const matchingWeekdayTemplate = useMemo(
    () =>
      activeScheduleTemplates.find((template) =>
        Array.isArray(template.weekdays) && template.weekdays.includes(selectedWeekdayValue)
      ),
    [activeScheduleTemplates, selectedWeekdayValue]
  );
  const hasSelectedWeekdayTemplate = Boolean(matchingWeekdayTemplate);
  const selectedRecurringWeekdayLabel = useMemo(() => {
    const labels = WEEKDAY_OPTIONS.filter((option) => selectedRecurringWeekdays.includes(option.value)).map((option) => option.label);
    if (labels.length === 0) return '요일 미선택';
    return labels.join(', ');
  }, [selectedRecurringWeekdays]);
  const matchingWeekdayLabel = useMemo(
    () => WEEKDAY_OPTIONS.find((option) => option.value === selectedWeekdayValue)?.label || '해당 요일',
    [selectedWeekdayValue]
  );
  const savedAttendanceRoutines = useMemo<SavedAttendanceRoutine[]>(
    () =>
      activeScheduleTemplates.map((template) => ({
        id: template.id || `template-${template.name}`,
        name: template.name,
        inTime: template.arrivalPlannedAt,
        outTime: template.departurePlannedAt,
        awayStartTime: template.defaultExcursionStartAt || '',
        awayEndTime: template.defaultExcursionEndAt || '',
        awayReason: template.defaultExcursionReason || '',
        awaySlots: [],
        isAbsent: false,
        active: template.active !== false,
        weekdays: template.weekdays,
      })),
    [activeScheduleTemplates]
  );
  const weekScheduleMap = useMemo(
    () =>
      Object.fromEntries(
        (weekSchedules || []).map((schedule) => [schedule.dateKey, schedule])
      ) as Record<string, StudentScheduleDoc>,
    [weekSchedules]
  );
  const attendanceCalendarDays = useMemo(
    () =>
      weekDays.map((day) => ({
        key: format(day, 'yyyy-MM-dd'),
        weekdayLabel: format(day, 'EEE', { locale: ko }),
        dateLabel: format(day, 'd'),
        isToday: isSameDay(day, new Date()),
        isSelected: selectedDate ? isSameDay(day, selectedDate) : false,
        date: day,
        hasSchedule: Boolean(weekScheduleMap[format(day, 'yyyy-MM-dd')]),
        isAbsent: Boolean(weekScheduleMap[format(day, 'yyyy-MM-dd')]?.isAbsent),
      })),
    [selectedDate, weekDays, weekScheduleMap]
  );

  useEffect(() => {
    if (!isStudent || planTrackEntryMode !== 'auto' || isStudentProfileLoading) return;
    if (hasSeenRoutineOnboarding) {
      setPlanTrackEntryMode('planner');
      return;
    }
    setPlanTrackEntryMode('onboarding');
    if (studentProfileRef && !onboardingPresentationRef.current) {
      onboardingPresentationRef.current = true;
      void setDoc(
        studentProfileRef,
        {
          studyRoutineOnboarding: {
            presentedAt: serverTimestamp(),
            version: PLAN_TRACK_ONBOARDING_VERSION,
            updatedAt: serverTimestamp(),
          },
        },
        { merge: true }
      );
    }
  }, [
    hasSeenRoutineOnboarding,
    isStudent,
    isStudentProfileLoading,
    planTrackEntryMode,
    studentProfileRef,
  ]);

  const fetchRecentStudyOptions = useCallback(async () => {
    if (!firestore || !user || !activeMembership || !isStudent || recentStudyWeekKeys.length === 0) {
      setRecentStudyOptions([]);
      setRecentStudyHistory([]);
      return;
    }

    setIsRecentStudyLoading(true);

    try {
      const snapshots = await Promise.all(
        recentStudyWeekKeys.map((targetWeekKey) =>
          getDocs(
            collection(
              firestore,
              'centers',
              activeMembership.id,
              'plans',
              user.uid,
              'weeks',
              targetWeekKey,
              'items'
            )
          ).then((snapshot) => ({ targetWeekKey, snapshot }))
        )
      );

      const recentItems = snapshots
        .flatMap(({ targetWeekKey, snapshot }) =>
          snapshot.docs.map((snap) => ({
            ...((snap.data() || {}) as StudyPlanItem),
            id: snap.id,
            targetWeekKey,
          }))
        )
        .filter((item) => item.category === 'study' || !item.category)
        .filter((item) => item.title?.trim());

      recentItems.sort((left, right) => getPlanTimestampMs(right) - getPlanTimestampMs(left));
      setRecentStudyHistory(recentItems);

      const uniqueItems = new Map<string, RecentStudyOption>();

      for (const item of recentItems) {
        const option = buildRecentStudyOption(item as WithId<StudyPlanItem>, item.targetWeekKey);
        if (!uniqueItems.has(option.key)) {
          uniqueItems.set(option.key, option);
        }
      }

      setRecentStudyOptions(Array.from(uniqueItems.values()));
    } catch {
      setRecentStudyOptions([]);
      setRecentStudyHistory([]);
    } finally {
      setIsRecentStudyLoading(false);
    }
  }, [activeMembership, buildRecentStudyOption, firestore, isStudent, recentStudyWeekKeys, user]);

  useEffect(() => {
    void fetchRecentStudyOptions();
  }, [fetchRecentStudyOptions]);

  const scheduleItems = useMemo(() => dailyPlans?.filter(p => p.category === 'schedule') || [], [dailyPlans]);
  const personalTasks = useMemo(() => dailyPlans?.filter(p => p.category === 'personal') || [], [dailyPlans]);
  const studyTasks = useMemo(() => dailyPlans?.filter(p => p.category === 'study' || !p.category) || [], [dailyPlans]);
  const copyableTaskItems = useMemo(() => dailyPlans?.filter(p => p.category !== 'schedule') || [], [dailyPlans]);
  const copyableRoutineItems = useMemo(() => dailyPlans?.filter(p => p.category === 'schedule') || [], [dailyPlans]);
  const hasCopyableTasks = copyableTaskItems.length > 0;
  const hasCopyableRoutines = copyableRoutineItems.length > 0;

  const hasInPlan = useMemo(
    () => Boolean(selectedScheduleDoc ? !selectedScheduleDoc.isAbsent && selectedScheduleDoc.arrivalPlannedAt : scheduleItems.some(i => i.title.includes('등원 예정'))),
    [scheduleItems, selectedScheduleDoc]
  );
  const hasOutPlan = useMemo(
    () => Boolean(selectedScheduleDoc ? !selectedScheduleDoc.isAbsent && selectedScheduleDoc.departurePlannedAt : scheduleItems.some(i => i.title.includes('하원 예정'))),
    [scheduleItems, selectedScheduleDoc]
  );
  const hasAwayPlan = Boolean(awayStartTime && awayEndTime) || extraAwayPlans.some((slot) => Boolean(slot.startTime && slot.endTime));
  const isAbsentMode = useMemo(() => isScheduleAbsent || scheduleItems.some(i => i.title.includes('등원하지 않습니다')), [isScheduleAbsent, scheduleItems]);

  const handleSaveRoutineProfile = useCallback(async (profile: UserStudyProfile) => {
    if (!firestore || !user || !activeMembership || !studentProfileRef) return;

    await setDoc(
      studentProfileRef,
      {
        id: user.uid,
        name: studentProfile?.name || activeMembership.displayName || user.displayName || '학생',
        schoolName: studentProfile?.schoolName || '학교 미정',
        grade: studentProfile?.grade || '학년 미정',
        seatNo: studentProfile?.seatNo || 0,
        targetDailyMinutes: studentProfile?.targetDailyMinutes || 240,
        parentUids: studentProfile?.parentUids || [],
        createdAt: studentProfile?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
        studyRoutineOnboarding: {
          presentedAt: studentProfile?.studyRoutineOnboarding?.presentedAt || serverTimestamp(),
          status: 'completed',
          completedAt: serverTimestamp(),
          version: PLAN_TRACK_ONBOARDING_VERSION,
          updatedAt: serverTimestamp(),
        },
        studyRoutineProfile: {
          ...profile,
          createdAt: studentProfile?.studyRoutineProfile?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        studyRoutineWorkspace: null,
      },
      { merge: true }
    );

    toast({
      title: '학습 기준 저장 완료',
      description: '이제 직접 쓴 오늘 계획을 기준으로 부족한 점과 보강 포인트를 함께 보여드릴게요.',
    });
  }, [activeMembership, firestore, studentProfile, studentProfileRef, toast, user]);

  const handleDismissRoutineOnboarding = useCallback(async () => {
      setHasDismissedRoutineOnboardingLocally(true);
      setPlanTrackEntryMode('planner');

      try {
        if (studentProfileRef) {
        await setDoc(
          studentProfileRef,
          {
            studyRoutineOnboarding: {
              presentedAt: studentProfile?.studyRoutineOnboarding?.presentedAt || serverTimestamp(),
              status: 'dismissed',
              dismissedAt: serverTimestamp(),
              version: PLAN_TRACK_ONBOARDING_VERSION,
              updatedAt: serverTimestamp(),
            },
          },
          { merge: true }
        );
      }
    } catch (error) {
      console.error('[plan-track] dismiss routine onboarding failed', error);
      toast({
        title: '바로 계획 화면으로 이동했어요',
        description: '루틴 설문 저장이 잠시 늦어졌어요. 필요하면 나중에 다시 열 수 있어요.',
      });
      return;
    }
    toast({
      title: '루틴 추천은 나중에 해도 괜찮아요',
      description: '이제부터는 계획트랙에서 출입 일정과 오늘 공부를 바로 적을 수 있어요.',
    });
  }, [studentProfile?.studyRoutineOnboarding?.presentedAt, studentProfileRef, toast]);

  useEffect(() => {
    const fallbackArrival = scheduleItems.find((item) => item.title.startsWith('등원 예정: '));
    const fallbackDismissal = scheduleItems.find((item) => item.title.startsWith('하원 예정: '));
    const fallbackAwayItems = scheduleItems
      .filter((item) => item.title.startsWith('외출 예정'))
      .map((item) => parseAwayScheduleTitle(item.title))
      .filter((item): item is AttendanceAwaySlot => Boolean(item))
      .sort((left, right) => left.startTime.localeCompare(right.startTime));

    const scheduleSource = selectedScheduleDoc
      ? buildDraftFromScheduleDoc(selectedScheduleDoc)
      : matchingWeekdayTemplate
        ? buildDraftFromScheduleDoc({
            inTime: matchingWeekdayTemplate.arrivalPlannedAt,
            outTime: matchingWeekdayTemplate.departurePlannedAt,
            isAbsent: false,
            outings:
              matchingWeekdayTemplate.hasExcursionDefault &&
              matchingWeekdayTemplate.defaultExcursionStartAt &&
              matchingWeekdayTemplate.defaultExcursionEndAt
                ? [
                    {
                      id: 'weekday-template',
                      startTime: matchingWeekdayTemplate.defaultExcursionStartAt,
                      endTime: matchingWeekdayTemplate.defaultExcursionEndAt,
                      reason: matchingWeekdayTemplate.defaultExcursionReason || '',
                    },
                  ]
                : [],
          })
        : null;

    const draft = scheduleSource || {
      inTime: fallbackArrival?.title.split(': ')[1] || '09:00',
      outTime: fallbackDismissal?.title.split(': ')[1] || '22:00',
      awayStartTime: fallbackAwayItems[0]?.startTime || '',
      awayEndTime: fallbackAwayItems[0]?.endTime || '',
      awayReason: fallbackAwayItems[0]?.reason || '',
      awaySlots: fallbackAwayItems.slice(1),
      isAbsent: scheduleItems.some((item) => item.title.includes('등원하지 않습니다')),
    };

    setInTime(draft.inTime || '09:00');
    setOutTime(draft.outTime || '22:00');
    setAwayStartTime(draft.awayStartTime || '');
    setAwayEndTime(draft.awayEndTime || '');
    setAwayReason(draft.awayReason || '');
    setExtraAwayPlans(draft.awaySlots || []);
    setIsScheduleAbsent(Boolean(draft.isAbsent));
    setScheduleNote((selectedScheduleDoc as any)?.note || '');
  }, [matchingWeekdayTemplate, scheduleItems, selectedScheduleDoc]);

  useEffect(() => {
    if (matchingWeekdayTemplate) {
      setWeekdayDraft(
        buildDraftFromScheduleDoc({
          inTime: matchingWeekdayTemplate.arrivalPlannedAt,
          outTime: matchingWeekdayTemplate.departurePlannedAt,
          isAbsent: false,
          outings:
            matchingWeekdayTemplate.hasExcursionDefault &&
            matchingWeekdayTemplate.defaultExcursionStartAt &&
            matchingWeekdayTemplate.defaultExcursionEndAt
              ? [
                  {
                    id: matchingWeekdayTemplate.id || 'weekday-template',
                    startTime: matchingWeekdayTemplate.defaultExcursionStartAt,
                    endTime: matchingWeekdayTemplate.defaultExcursionEndAt,
                    reason: matchingWeekdayTemplate.defaultExcursionReason || '',
                  },
                ]
              : [],
        })
      );
      return;
    }
    setWeekdayDraft(EMPTY_ATTENDANCE_SCHEDULE_DRAFT);
  }, [matchingWeekdayTemplate]);

  const studyTimeSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    let total = 0;
    studyTasks.forEach(task => {
      const subject = task.subject || 'etc';
      const mins = task.targetMinutes || 0;
      summary[subject] = (summary[subject] || 0) + mins;
      total += mins;
    });
    return { breakdown: summary, total };
  }, [studyTasks]);
  const volumeStudyTasks = useMemo(
    () => studyTasks.filter((task) => resolveStudyPlanMode(task) === 'volume'),
    [studyTasks]
  );
  const studyGoalSummaryLabel = useMemo(() => {
    const timeTaskCount = studyTasks.length - volumeStudyTasks.length;
    if (volumeStudyTasks.length > 0 && studyTimeSummary.total > 0) {
      return `시간형 ${timeTaskCount}개 · 분량형 ${volumeStudyTasks.length}개`;
    }
    if (volumeStudyTasks.length > 0) {
      return `분량형 목표 ${volumeStudyTasks.length}개`;
    }
    return `목표 ${Math.floor(studyTimeSummary.total / 60)}시간 ${studyTimeSummary.total % 60}분`;
  }, [studyTasks.length, volumeStudyTasks.length, studyTimeSummary.total]);
  const remainingStudyTasks = useMemo(
    () => studyTasks.filter((task) => !task.done),
    [studyTasks]
  );
  const remainingPersonalTasks = useMemo(
    () => personalTasks.filter((task) => !task.done),
    [personalTasks]
  );
  const planRewardMultiplier = useMemo(() => {
    const raw = progress?.stats || { focus: 0, consistency: 0, achievement: 0, resilience: 0 };
    return 1
      + (Math.min(100, raw.focus || 0) / 100) * 0.05
      + (Math.min(100, raw.consistency || 0) / 100) * 0.05
      + (Math.min(100, raw.achievement || 0) / 100) * 0.05
      + (Math.min(100, raw.resilience || 0) / 100) * 0.05;
  }, [progress?.stats]);
  const routineCountLabel = `${scheduleItems.length}개`;
  const studyCountLabel = `${studyTasks.length}개`;
  const personalCountLabel = `${personalTasks.length}개`;
  const completedStudyCount = useMemo(
    () => studyTasks.filter((task) => task.done).length,
    [studyTasks]
  );
  const completedPersonalCount = useMemo(
    () => personalTasks.filter((task) => task.done).length,
    [personalTasks]
  );
  const taskCopyOptions = useMemo(() => (
    copyableTaskItems.map((item) => {
      const subject = SUBJECTS.find((entry) => entry.id === (item.subject || 'etc'));
      const isStudyItem = item.category === 'study' || !item.category;
      const planMetaLabel = buildStudyTaskMeta(item);
      return {
        id: item.id,
        title: item.title,
        meta: isStudyItem
          ? `${subject?.label ?? '기타'} · ${planMetaLabel}`
          : '기타 일정',
        badgeLabel: isStudyItem ? '학습' : '기타',
        badgeClassName: isStudyItem
          ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
          : 'border-amber-100 bg-amber-50 text-amber-700',
      };
    })
  ), [copyableTaskItems]);
  const routineCopyOptions = useMemo(() => (
    copyableRoutineItems.map((item) => ({
      id: item.id,
      title: item.title,
      meta: '생활 루틴',
      badgeLabel: '루틴',
      badgeClassName: 'border-sky-100 bg-sky-50 text-sky-700',
    }))
  ), [copyableRoutineItems]);
  const visibleRecentStudyOptions = useMemo(
    () => recentStudyOptions.slice(0, isMobile ? 3 : 5),
    [isMobile, recentStudyOptions]
  );
  const activeRecentStudyOption = useMemo(
    () => recentStudyOptions.find((item) => item.key === activeRecentStudyKey) || null,
    [activeRecentStudyKey, recentStudyOptions]
  );
  const allTemplates = useMemo(
    () => [...BUILTIN_PLANNER_TEMPLATES, ...customTemplates],
    [customTemplates]
  );
  const recentTemplates = useMemo(
    () => recentTemplateIds
      .map((id) => allTemplates.find((template) => template.id === id))
      .filter((template): template is PlannerTemplateRecord => Boolean(template))
      .slice(0, 4),
    [allTemplates, recentTemplateIds]
  );
  const latestRecentTemplate = recentTemplates[0] || null;
  const checklistTasks = useMemo(
    () => [...studyTasks, ...personalTasks],
    [personalTasks, studyTasks]
  );
  const completedChecklistCount = useMemo(
    () => checklistTasks.filter((task) => task.done).length,
    [checklistTasks]
  );
  const completionRate = checklistTasks.length > 0
    ? Math.round((completedChecklistCount / checklistTasks.length) * 100)
    : 0;
  const selectedDayPointStatus = useMemo(
    () => ((progress?.dailyPointStatus?.[selectedDateKey] || {}) as Record<string, any>),
    [progress?.dailyPointStatus, selectedDateKey]
  );
  const todayPointTotal = Math.min(
    PLAN_TRACK_DAILY_POINT_CAP,
    Number(selectedDayPointStatus.dailyPointAmount || 0)
  );
  const planTrackPointTotal = Math.max(0, Number(selectedDayPointStatus.planTrackPointAmount || 0));
  const todayStreakDays = useMemo(
    () => computePlannerStreak(progress?.dailyPointStatus, selectedDateKey),
    [progress?.dailyPointStatus, selectedDateKey]
  );
  const todayPointGaugeLabel = `${todayPointTotal} / ${PLAN_TRACK_DAILY_POINT_CAP}`;
  const todayCompletionLabel = checklistTasks.length > 0 ? `${completedChecklistCount}/${checklistTasks.length}` : '0/0';
  const autoSchedulePreview = useMemo(
    () => getNextAutoWindow(studyTasks, Number(newStudyMinutes) || 30, PLAN_DEFAULT_START_TIME),
    [newStudyMinutes, studyTasks]
  );
  const orderedChecklistTasks = useMemo(
    () => [...checklistTasks].sort((left, right) => {
      const leftProgress = timeToClockProgress(left.startTime);
      const rightProgress = timeToClockProgress(right.startTime);
      if (leftProgress !== rightProgress) return leftProgress - rightProgress;
      return getPlanTimestampMs(right) - getPlanTimestampMs(left);
    }),
    [checklistTasks]
  );
  const recommendedDailyMinutes = useMemo(() => {
    const mapped = studentProfile?.studyRoutineProfile?.answers?.dailyStudyHours
      ? DAILY_STUDY_MINUTES_MAP[studentProfile.studyRoutineProfile.answers.dailyStudyHours]
      : 0;
    return mapped || studentProfile?.targetDailyMinutes || 240;
  }, [studentProfile?.studyRoutineProfile?.answers?.dailyStudyHours, studentProfile?.targetDailyMinutes]);
  const planProgressPercent = recommendedDailyMinutes > 0
    ? Math.min(100, Math.round((studyTimeSummary.total / recommendedDailyMinutes) * 100))
    : 0;
  const subjectBalanceEntries = useMemo(
    () =>
      Object.entries(studyTimeSummary.breakdown)
        .map(([subjectId, minutes]) => ({
          subjectId,
          subjectLabel: SUBJECTS.find((item) => item.id === subjectId)?.label || '기타',
          minutes,
        }))
        .sort((left, right) => right.minutes - left.minutes),
    [studyTimeSummary.breakdown]
  );
  const visibleStudyTasks = useMemo(() => orderedChecklistTasks.filter((task) => task.category === 'study' || !task.category).slice(0, 5), [orderedChecklistTasks]);
  const hiddenStudyTaskCount = Math.max(0, studyTasks.length - visibleStudyTasks.length);
  const latestDiagnostic = studentProfile?.studyPlannerDiagnostic || null;
  const mainRecommendations = useMemo(
    () =>
      buildMainPlanRecommendations({
        profile: studentProfile?.studyRoutineProfile,
        diagnostic: latestDiagnostic,
        latestStudyPlan: currentStudyPlan,
        todayStudyTasks: studyTasks,
        recentStudyTasks: recentStudyHistory,
      }),
    [currentStudyPlan, latestDiagnostic, recentStudyHistory, studentProfile?.studyRoutineProfile, studyTasks]
  );
  const prioritySubjectLabels = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...(studentProfile?.studyRoutineProfile?.answers?.subjectPriority || []),
            ...(studentProfile?.studyRoutineProfile?.answers?.weakSubjects || []),
          ]
            .map((subject) => SUBJECTS.find((item) => item.id === subject)?.label || subject)
            .filter((subject) => subject && subject !== 'none')
        )
      ),
    [studentProfile?.studyRoutineProfile?.answers?.subjectPriority, studentProfile?.studyRoutineProfile?.answers?.weakSubjects]
  );
  const weeklyScheduleOverview = useMemo(() => {
    return weekDays.map((day) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const directSchedule = weekScheduleMap[dateKey];
      const template = activeScheduleTemplates.find((item) => Array.isArray(item.weekdays) && item.weekdays.includes(getDay(day)));
      const plannedArrival = directSchedule?.arrivalPlannedAt || template?.arrivalPlannedAt || null;
      const plannedDeparture = directSchedule?.departurePlannedAt || template?.departurePlannedAt || null;
      const hasExcursion = Boolean(
        directSchedule?.hasExcursion ||
        directSchedule?.excursionStartAt ||
        directSchedule?.excursionEndAt ||
        template?.hasExcursionDefault
      );
      const isRestDay = Boolean(directSchedule?.isAbsent);
      const status = isRestDay
        ? '휴식'
        : plannedArrival && plannedDeparture
          ? '등원 예정'
          : '미정';
      const timeLabel = plannedArrival && plannedDeparture
        ? `${plannedArrival} · ${plannedDeparture}`
        : isRestDay
          ? '휴식'
          : '미정';

      return {
        date: day,
        dateKey,
        weekdayLabel: format(day, 'EEE', { locale: ko }),
        dateLabel: format(day, 'd'),
        isSelected: selectedDate ? isSameDay(day, selectedDate) : false,
        isToday: isSameDay(day, new Date()),
        status,
        timeLabel,
        hasExcursion,
      };
    });
  }, [activeScheduleTemplates, selectedDate, weekDays, weekScheduleMap]);
  const tomorrowDate = useMemo(() => addDays(new Date(), 1), []);
  const tomorrowScheduleOverview = useMemo(
    () => weeklyScheduleOverview.find((item) => item.dateKey === format(tomorrowDate, 'yyyy-MM-dd')) || null,
    [tomorrowDate, weeklyScheduleOverview]
  );
  const selectedScheduleOverview = useMemo(
    () => weeklyScheduleOverview.find((item) => item.dateKey === selectedDateKey) || null,
    [selectedDateKey, weeklyScheduleOverview]
  );
  const needsTomorrowSchedule = Boolean(
    tomorrowScheduleOverview &&
    tomorrowScheduleOverview.status === '미정'
  );

  const openStudyPlanSheet = useCallback((preset?: MainPlanRecommendation['applyPreset']) => {
    if (preset) {
      const matchedSubject = preset.subject
        ? SUBJECTS.find((item) => item.label === preset.subject || item.id === preset.subject)
        : null;
      if (matchedSubject) {
        setNewStudySubject(matchedSubject.id);
      }
      setNewStudyMode(preset.studyMode || 'time');
      setNewStudyMinutes(String(preset.targetMinutes || 40));
      setNewStudyTargetAmount('');
      setNewStudyAmountUnit('문제');
      setNewStudyCustomAmountUnit('');
      setEnableVolumeStudyMinutes(false);
      setNewStudyTask(preset.title);
    }
    setIsStudyPlanSheetOpen(true);
  }, []);

  const openAttendanceSheetForDate = useCallback((date: Date, tab: 'today' | 'weekday' | 'saved' = 'today') => {
    setSelectedDate(date);
    setAttendanceSheetInitialTab(tab);
    setIsAttendanceScheduleSheetOpen(true);
  }, []);

  useEffect(() => {
    if (!activeRecentStudyKey) return;
    if (!recentStudyOptions.some((item) => item.key === activeRecentStudyKey)) {
      setActiveRecentStudyKey(null);
    }
  }, [activeRecentStudyKey, recentStudyOptions]);

  useEffect(() => {
    if (!isTaskCopyDialogOpen) return;
    setTaskCopyItemIds((prev) => {
      const validIds = prev.filter((id) => copyableTaskItems.some((item) => item.id === id));
      return validIds.length > 0 ? validIds : copyableTaskItems.map((item) => item.id);
    });
  }, [isTaskCopyDialogOpen, copyableTaskItems]);

  useEffect(() => {
    if (!isRoutineCopyDialogOpen) return;
    setRoutineCopyItemIds((prev) => {
      const validIds = prev.filter((id) => copyableRoutineItems.some((item) => item.id === id));
      return validIds.length > 0 ? validIds : copyableRoutineItems.map((item) => item.id);
    });
  }, [isRoutineCopyDialogOpen, copyableRoutineItems]);

  const handleRoutineTemplateSelect = (template: (typeof ROUTINE_TEMPLATE_OPTIONS)[number]) => {
    setSelectedRoutineTemplateKey(template.key);
    setNewRoutineTitle(template.title);
  };

  const resetStudyComposerPrefill = () => {
    setActiveRecentStudyKey(null);
    setNewStudyTask('');
    setNewStudyMinutes('60');
    setNewStudyTargetAmount('');
    setNewStudyAmountUnit('문제');
    setNewStudyCustomAmountUnit('');
    setEnableVolumeStudyMinutes(false);
    setNewStudyMode('volume');
  };

  const handlePrefillRecentStudy = (item: RecentStudyOption) => {
    setNewStudySubject(item.subjectValue);
    setNewStudyMode(item.studyModeValue);
    setNewStudyMinutes(item.minuteValue || '60');
    setNewStudyTargetAmount(item.amountValue);
    setNewStudyAmountUnit(item.amountUnitValue);
    setNewStudyCustomAmountUnit(item.customAmountUnitValue);
    setEnableVolumeStudyMinutes(item.enableVolumeMinutes);
    setNewStudyTask(item.title);
    setActiveRecentStudyKey(item.key);
    setIsRecentStudySheetOpen(false);
  };

  const pushFloatingPointBurst = useCallback((label: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setFloatingPointBursts((prev) => [...prev, { id, label }]);
    window.setTimeout(() => {
      setFloatingPointBursts((prev) => prev.filter((item) => item.id !== id));
    }, 950);
  }, []);

  const markTemplateAsRecent = useCallback((templateId: string) => {
    setRecentTemplateIds((prev) => [templateId, ...prev.filter((id) => id !== templateId)].slice(0, 6));
  }, []);

  const buildTemplateDraftFromTask = useCallback((task: WithId<StudyPlanItem>): PlannerTaskDraft => ({
    category: (task.category === 'personal' ? 'personal' : 'study'),
    title: task.title,
    subject: task.subject || 'etc',
    studyPlanMode: resolveStudyPlanMode(task),
    targetMinutes: task.targetMinutes || undefined,
    targetAmount: task.targetAmount || undefined,
    amountUnit: task.amountUnit as StudyAmountUnit | undefined,
    amountUnitLabel: task.amountUnitLabel || undefined,
    startTime: task.startTime || undefined,
    endTime: task.endTime || undefined,
    priority: task.priority || 'medium',
    tag: task.tag || undefined,
  }), []);

  const saveCurrentPlanTemplate = useCallback(() => {
    const tasksToSave = checklistTasks.map((task) => buildTemplateDraftFromTask(task));
    if (tasksToSave.length === 0) {
      toast({
        variant: 'destructive',
        title: '저장할 계획이 없어요',
        description: '오늘 계획을 한 개 이상 만든 뒤 템플릿으로 저장해보세요.',
      });
      return;
    }
    const templateId = editingTemplateId || `custom-${Date.now()}`;
    const nextTemplate: PlannerTemplateRecord = {
      id: templateId,
      name: templateNameDraft.trim(),
      description: `${tasksToSave.length}개 항목 · 오늘 계획에서 저장`,
      kind: 'custom',
      icon: 'custom',
      tasks: tasksToSave,
      updatedAt: Date.now(),
    };

    setCustomTemplates((prev) => {
      const existing = prev.some((template) => template.id === templateId);
      if (existing) {
        return prev.map((template) => (template.id === templateId ? nextTemplate : template));
      }
      return [nextTemplate, ...prev];
    });
    markTemplateAsRecent(templateId);
    setTemplateNameDraft('');
    setEditingTemplateId(null);
    toast({
      title: editingTemplateId ? '템플릿을 수정했어요' : '템플릿으로 저장했어요',
      description: `${nextTemplate.name}을(를) 빠른 시작에서 다시 불러올 수 있어요.`,
    });
  }, [buildTemplateDraftFromTask, checklistTasks, editingTemplateId, markTemplateAsRecent, templateNameDraft, toast]);

  const startEditingTemplate = useCallback((template: PlannerTemplateRecord) => {
    setEditingTemplateId(template.id);
    setTemplateNameDraft(template.name);
    setIsTemplateSheetOpen(true);
  }, []);

  const deleteTemplate = useCallback((template: PlannerTemplateRecord) => {
    setCustomTemplates((prev) => prev.filter((item) => item.id !== template.id));
    setRecentTemplateIds((prev) => prev.filter((id) => id !== template.id));
    if (editingTemplateId === template.id) {
      setEditingTemplateId(null);
      setTemplateNameDraft('');
    }
    toast({
      title: '템플릿을 삭제했어요',
      description: `${template.name}은(는) 보관함에서 제거되었습니다.`,
    });
  }, [editingTemplateId, toast]);

  const replaceTodayPlansFromDrafts = useCallback(async (drafts: PlannerTaskDraft[], sourceLabel: string) => {
    if (isPast || !firestore || !user || !activeMembership || !weekKey || !selectedDateKey) return false;

    setIsSubmitting(true);
    const itemsCollectionRef = collection(
      firestore,
      'centers',
      activeMembership.id,
      'plans',
      user.uid,
      'weeks',
      weekKey,
      'items'
    );

    try {
      const batch = writeBatch(firestore);
      dailyPlans?.filter((plan) => plan.category !== 'schedule').forEach((plan) => {
        batch.delete(doc(itemsCollectionRef, plan.id));
      });

      const normalizedDrafts = assignAutoWindowsToTasks(drafts, PLAN_DEFAULT_START_TIME);

      normalizedDrafts.forEach((task) => {
        const nextRef = doc(itemsCollectionRef);
        batch.set(nextRef, {
          title: task.title.trim(),
          done: false,
          weight: task.category === 'personal' ? 0 : 1,
          dateKey: selectedDateKey,
          category: task.category,
          subject: task.category === 'study' ? task.subject || 'etc' : null,
          studyPlanMode: task.category === 'study' ? task.studyPlanMode || 'time' : null,
          targetMinutes: task.category === 'study' ? task.targetMinutes || 0 : 0,
          targetAmount: task.category === 'study' ? task.targetAmount || 0 : 0,
          actualAmount: task.category === 'study' && task.studyPlanMode === 'volume' ? 0 : 0,
          amountUnit: task.category === 'study' ? task.amountUnit || null : null,
          amountUnitLabel: task.category === 'study' ? task.amountUnitLabel || null : null,
          startTime: task.startTime || null,
          endTime: task.endTime || null,
          priority: task.priority || 'medium',
          tag: task.tag || null,
          studyPlanWeekId: weekKey,
          centerId: activeMembership.id,
          studentId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      setExpandedTaskId(null);
      setShowQuickAddCard(false);
      toast({
        title: '오늘 계획을 준비했어요',
        description: sourceLabel,
      });
      return true;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '오늘 계획을 만들지 못했어요',
        description: typeof error?.message === 'string' ? error.message : '다시 한 번 시도해주세요.',
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [activeMembership, dailyPlans, firestore, isPast, selectedDateKey, toast, user, weekKey]);

  const applyTemplateToToday = useCallback(async (template: PlannerTemplateRecord) => {
    const applied = await replaceTodayPlansFromDrafts(template.tasks, `${template.name} 템플릿을 오늘 계획에 적용했어요.`);
    if (applied) {
      markTemplateAsRecent(template.id);
      setIsTemplateSheetOpen(false);
    }
  }, [markTemplateAsRecent, replaceTodayPlansFromDrafts]);

  const handleCopyYesterdayPlan = useCallback(async () => {
    if (isPast || !selectedDate || !firestore || !user || !activeMembership) return;

    const yesterday = addDays(selectedDate, -1);
    const yesterdayWeekKey = format(yesterday, "yyyy-'W'II");
    const yesterdayDateKey = format(yesterday, 'yyyy-MM-dd');

    setIsSubmitting(true);
    try {
      const snapshot = await getDocs(
        query(
          collection(
            firestore,
            'centers',
            activeMembership.id,
            'plans',
            user.uid,
            'weeks',
            yesterdayWeekKey,
            'items'
          ),
          where('dateKey', '==', yesterdayDateKey)
        )
      );

      const drafts = snapshot.docs
        .map((docSnap) => ({ ...(docSnap.data() as StudyPlanItem), id: docSnap.id }))
        .filter((item) => item.category !== 'schedule')
        .map((item) => buildTemplateDraftFromTask(item as WithId<StudyPlanItem>));

      if (drafts.length === 0) {
        toast({
          variant: 'destructive',
          title: '어제 계획이 비어 있어요',
          description: '복사할 계획이 없어서 오늘 계획을 바로 만들 수 없었어요.',
        });
        return;
      }

      await replaceTodayPlansFromDrafts(drafts, '어제 계획을 오늘 플래너로 그대로 가져왔어요.');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '어제 계획을 불러오지 못했어요',
        description: typeof error?.message === 'string' ? error.message : '다시 시도해주세요.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [activeMembership, buildTemplateDraftFromTask, firestore, isPast, replaceTodayPlansFromDrafts, selectedDate, toast, user]);

  const clearTodayPlans = useCallback(async () => {
    if (checklistTasks.length > 0) {
      const shouldClear = window.confirm('오늘 계획을 비우고 새로 시작할까요?');
      if (!shouldClear) return;
    }
    await replaceTodayPlansFromDrafts([], '오늘 계획을 비우고 새로 시작할 준비를 했어요.');
  }, [checklistTasks.length, replaceTodayPlansFromDrafts]);

  const handleMoveUnfinishedToTomorrow = useCallback(async () => {
    if (!firestore || !user || !activeMembership || !selectedDate) return;
    const drafts = remainingStudyTasks
      .map((task) => buildTemplateDraftFromTask(task as WithId<StudyPlanItem>));
    if (drafts.length === 0) return;

    const tomorrow = addDays(selectedDate, 1);
    const tomorrowDateKey = format(tomorrow, 'yyyy-MM-dd');
    const tomorrowWeekKey = format(tomorrow, "yyyy-'W'II");
    const tomorrowItemsRef = collection(
      firestore,
      'centers',
      activeMembership.id,
      'plans',
      user.uid,
      'weeks',
      tomorrowWeekKey,
      'items'
    );

    setIsSubmitting(true);
    try {
      const batch = writeBatch(firestore);
      assignAutoWindowsToTasks(drafts, PLAN_DEFAULT_START_TIME).forEach((task) => {
        batch.set(doc(tomorrowItemsRef), {
          title: task.title,
          done: false,
          weight: 1,
          dateKey: tomorrowDateKey,
          category: task.category,
          subject: task.subject || 'etc',
          studyPlanMode: task.studyPlanMode || 'time',
          targetMinutes: task.targetMinutes || 0,
          targetAmount: task.targetAmount || 0,
          actualAmount: 0,
          amountUnit: task.amountUnit || null,
          amountUnitLabel: task.amountUnitLabel || null,
          startTime: task.startTime || null,
          endTime: task.endTime || null,
          priority: task.priority || 'medium',
          tag: task.tag || null,
          studyPlanWeekId: tomorrowWeekKey,
          centerId: activeMembership.id,
          studentId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      remainingStudyTasks.forEach((task) => {
        batch.delete(doc(
          firestore,
          'centers',
          activeMembership.id,
          'plans',
          user.uid,
          'weeks',
          weekKey,
          'items',
          task.id
        ));
      });
      await batch.commit();
      toast({
        title: '미완료 계획을 내일로 옮겼어요',
        description: '남은 항목을 그대로 이어서 다시 시작할 수 있어요.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '내일로 미루지 못했어요',
        description: typeof error?.message === 'string' ? error.message : '다시 시도해주세요.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [activeMembership, buildTemplateDraftFromTask, firestore, remainingStudyTasks, selectedDate, toast, user, weekKey]);

  const handleSaveUnfinishedAsTemplate = useCallback(() => {
    if (remainingStudyTasks.length === 0) return;
    const weekdayLabel = selectedDate ? format(selectedDate, 'EEEE', { locale: ko }) : '이번 주';
    const nextTemplate: PlannerTemplateRecord = {
      id: `custom-${Date.now()}`,
      name: `${weekdayLabel} 미완료 정리`,
      description: '남은 계획을 다시 쓰기 쉽게 템플릿으로 저장',
      kind: 'custom',
      icon: 'custom',
      tasks: remainingStudyTasks.map((task) => buildTemplateDraftFromTask(task as WithId<StudyPlanItem>)),
      updatedAt: Date.now(),
    };
    setCustomTemplates((prev) => [nextTemplate, ...prev]);
    markTemplateAsRecent(nextTemplate.id);
    toast({
      title: '미완료 항목을 템플릿으로 저장했어요',
      description: `${nextTemplate.name} 템플릿에서 다시 불러올 수 있어요.`,
    });
  }, [buildTemplateDraftFromTask, markTemplateAsRecent, remainingStudyTasks, selectedDate, toast]);

  const handleDeleteUnfinished = useCallback(async () => {
    if (!firestore || !user || !activeMembership || remainingStudyTasks.length === 0) return;
    const shouldDelete = window.confirm('남은 항목을 오늘 계획에서 삭제할까요?');
    if (!shouldDelete) return;
    setIsSubmitting(true);
    try {
      const batch = writeBatch(firestore);
      remainingStudyTasks.forEach((task) => {
        batch.delete(doc(
          firestore,
          'centers',
          activeMembership.id,
          'plans',
          user.uid,
          'weeks',
          weekKey,
          'items',
          task.id
        ));
      });
      await batch.commit();
      toast({
        title: '미완료 항목을 정리했어요',
        description: '오늘 계획에서 남은 항목을 삭제했습니다.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '미완료 항목을 삭제하지 못했어요',
        description: typeof error?.message === 'string' ? error.message : '다시 시도해주세요.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [activeMembership, firestore, remainingStudyTasks, toast, user, weekKey]);

  const awardPlannerCompletionPoints = useCallback(async (
    item: WithId<StudyPlanItem>,
    nextCompletedCount: number,
    totalTaskCount: number
  ) => {
    if (!progressRef || !selectedDateKey) return 0;

    const existingDayStatus = (progress?.dailyPointStatus?.[selectedDateKey] || {}) as Record<string, any>;
    const requestedRewards: number[] = [];
    const nextDayStatus: Record<string, any> = {
      ...existingDayStatus,
    };

    const completedTaskIds = Array.isArray(existingDayStatus.planTrackCompletedTaskIds)
      ? existingDayStatus.planTrackCompletedTaskIds
      : [];
    const hourRewardTaskIds = Array.isArray(existingDayStatus.planTrackHourTaskIds)
      ? existingDayStatus.planTrackHourTaskIds
      : [];

    if (!completedTaskIds.includes(item.id)) {
      requestedRewards.push(3);
      nextDayStatus.planTrackCompletedTaskIds = arrayUnion(item.id);
    }

    if ((item.targetMinutes || 0) >= 60 && !hourRewardTaskIds.includes(item.id)) {
      requestedRewards.push(5);
      nextDayStatus.planTrackHourTaskIds = arrayUnion(item.id);
    }

    const completionRatio = totalTaskCount > 0 ? nextCompletedCount / totalTaskCount : 0;

    if (completionRatio >= 0.5 && !existingDayStatus.planTrackHalfBonus) {
      requestedRewards.push(10);
      nextDayStatus.planTrackHalfBonus = true;
    }

    let nextStreak = 0;
    if (totalTaskCount > 0 && nextCompletedCount === totalTaskCount && !existingDayStatus.planTrackFullBonus) {
      requestedRewards.push(30);
      nextDayStatus.planTrackFullBonus = true;
      nextDayStatus.planTrackCompleted = true;
      nextStreak = computePlannerStreak(
        {
          ...(progress?.dailyPointStatus || {}),
          [selectedDateKey]: {
            ...existingDayStatus,
            planTrackCompleted: true,
          },
        },
        selectedDateKey
      );

      if (nextStreak >= 3 && !existingDayStatus.planTrackStreakBonus) {
        const streakBonus = nextStreak >= 7 ? 7 : 5;
        requestedRewards.push(streakBonus);
        nextDayStatus.planTrackStreakBonus = true;
        nextDayStatus.planTrackStreakDays = nextStreak;
      }
    }

    const requestedTotal = requestedRewards.reduce((sum, reward) => sum + reward, 0);
    const remainingAllowance = Math.max(
      0,
      PLAN_TRACK_DAILY_POINT_CAP - Number(existingDayStatus.dailyPointAmount || 0)
    );
    const awarded = Math.min(requestedTotal, remainingAllowance);

    if (awarded > 0) {
      await setDoc(progressRef, {
        pointsBalance: increment(awarded),
        totalPointsEarned: increment(awarded),
        dailyPointStatus: {
          [selectedDateKey]: {
            ...nextDayStatus,
            dailyPointAmount: increment(awarded),
            planTrackPointAmount: increment(awarded),
            updatedAt: serverTimestamp(),
          },
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } else if (Object.keys(nextDayStatus).length > Object.keys(existingDayStatus).length) {
      await setDoc(progressRef, {
        dailyPointStatus: {
          [selectedDateKey]: {
            ...nextDayStatus,
            updatedAt: serverTimestamp(),
          },
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    return awarded;
  }, [progress?.dailyPointStatus, progressRef, selectedDateKey]);

  const applySameDayRoutinePenalty = async (reason: string) => {
    if (!firestore || !activeMembership || !user || !progressRef || !selectedDateKey) return false;

    const penaltyKey = `same_day_routine:${selectedDateKey}`;
    const existingPenaltySnap = await getDocs(
      query(
        collection(firestore, 'centers', activeMembership.id, 'penaltyLogs'),
        where('studentId', '==', user.uid),
        where('source', '==', 'manual'),
        limit(50)
      )
    );
    const hasSameDayPenalty = existingPenaltySnap.docs.some((snap) => {
      const data = snap.data() as any;
      const createdAtDateKey = data?.createdAt?.toDate ? format(data.createdAt.toDate(), 'yyyy-MM-dd') : null;
      const reasonText = String(data?.reason || '');
      return data?.penaltyKey === penaltyKey || ((data?.penaltyDateKey === selectedDateKey || createdAtDateKey === selectedDateKey) && reasonText.includes('출석 루틴'));
    });
    if (hasSameDayPenalty) {
      return false;
    }

    const penaltyLogRef = doc(collection(firestore, 'centers', activeMembership.id, 'penaltyLogs'));
    const batch = writeBatch(firestore);

    batch.set(
      progressRef,
      {
        penaltyPoints: increment(SAME_DAY_ROUTINE_PENALTY_POINTS),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    batch.set(penaltyLogRef, {
      centerId: activeMembership.id,
      studentId: user.uid,
      studentName: user.displayName || '학생',
      pointsDelta: SAME_DAY_ROUTINE_PENALTY_POINTS,
      reason,
      source: 'manual',
      penaltyKey,
      penaltyDateKey: selectedDateKey,
      createdByUserId: user.uid,
      createdByName: user.displayName || '학생',
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    return true;
  };

  const to24h = (time12h: string, period: '오전' | '오후') => {
    if (!time12h || !time12h.includes(':')) return time12h;
    let [hours, mins] = time12h.split(':').map(Number);
    if (isNaN(hours) || isNaN(mins)) return time12h;
    if (period === '오후' && hours < 12) hours += 12;
    if (period === '오전' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const handleAddTask = async (
    title: string,
    category: 'study' | 'personal' | 'schedule',
    options?: {
      studyPrefill?: RecentStudyOption;
      preserveStudyComposer?: boolean;
      taskBlueprint?: PlannerTaskDraft;
    }
  ) => {
    if (isPast || !firestore || !user || !activeMembership || !title.trim() || !isStudent || !weekKey || !selectedDateKey) {
      return false;
    }

    setIsSubmitting(true);
    const itemsCollectionRef = collection(
      firestore,
      'centers',
      activeMembership.id,
      'plans',
      user.uid,
      'weeks',
      weekKey,
      'items'
    );

    try {
      const recentStudy = options?.studyPrefill;
      const taskBlueprint = options?.taskBlueprint;
      const data: any = {
        title: taskBlueprint?.title?.trim() || title.trim(),
        done: false,
        weight: category === 'schedule' ? 0 : 1,
        dateKey: selectedDateKey,
        category,
        studyPlanWeekId: weekKey,
        centerId: activeMembership.id,
        studentId: user.uid,
        startTime: taskBlueprint?.startTime || null,
        endTime: taskBlueprint?.endTime || null,
        priority: taskBlueprint?.priority || 'medium',
        tag: taskBlueprint?.tag || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (category === 'schedule' && !title.includes('등원하지 않습니다')) {
        data.title = `${title.trim()}: 09:00 ~ 10:00`;
      } else if (category === 'study') {
        const studyMode = taskBlueprint?.studyPlanMode || recentStudy?.studyModeValue || newStudyMode;
        const studyMinutes = taskBlueprint?.targetMinutes
          ? String(taskBlueprint.targetMinutes)
          : (recentStudy?.minuteValue ?? newStudyMinutes);
        const studyAmount = taskBlueprint?.targetAmount
          ? String(taskBlueprint.targetAmount)
          : (recentStudy?.amountValue ?? newStudyTargetAmount);
        const studyAmountUnit = taskBlueprint?.amountUnit || recentStudy?.amountUnitValue || newStudyAmountUnit;
        const customUnitLabel = (taskBlueprint?.amountUnitLabel ?? recentStudy?.customAmountUnitValue ?? newStudyCustomAmountUnit).trim();
        const subjectValue = taskBlueprint?.subject || recentStudy?.subjectValue || newStudySubject;
        const shouldKeepMinutes = taskBlueprint
          ? Boolean(taskBlueprint.targetMinutes && studyMode === 'volume')
          : recentStudy ? recentStudy.enableVolumeMinutes : enableVolumeStudyMinutes;

        data.subject = subjectValue;
        data.studyPlanMode = studyMode;

        if (studyMode === 'time') {
          data.targetMinutes = Number(studyMinutes) || 0;
          if (!data.startTime && Number(studyMinutes) > 0) {
            const nextWindow = getNextAutoWindow(studyTasks, Number(studyMinutes) || 0, PLAN_DEFAULT_START_TIME);
            data.startTime = nextWindow.startTime;
            data.endTime = nextWindow.endTime;
          }
        } else {
          data.targetAmount = Number(studyAmount) || 0;
          data.actualAmount = 0;
          data.amountUnit = studyAmountUnit;
          if (studyAmountUnit === '직접입력') {
            data.amountUnitLabel = customUnitLabel || '단위';
          }
          if (shouldKeepMinutes && Number(studyMinutes) > 0) {
            data.targetMinutes = Number(studyMinutes) || 0;
            if (!data.startTime) {
              const nextWindow = getNextAutoWindow(studyTasks, Number(studyMinutes) || 0, PLAN_DEFAULT_START_TIME);
              data.startTime = nextWindow.startTime;
              data.endTime = nextWindow.endTime;
            }
          }
        }
      }

      await addDoc(itemsCollectionRef, data);

      if (category === 'schedule' && isToday) {
        await applySameDayRoutinePenalty('당일 출석 루틴 작성');
        toast({
          title: `당일 루틴 작성으로 벌점 ${SAME_DAY_ROUTINE_PENALTY_POINTS}점 반영`,
          description: '당일 출석 루틴은 작성/수정 가능하지만 벌점이 자동 반영됩니다.',
        });
      }

      if (category === 'study') {
        if (!options?.preserveStudyComposer) {
          setNewStudyTask('');
          setNewStudyTargetAmount('');
          setNewStudyAmountUnit('문제');
          setNewStudyCustomAmountUnit('');
          setEnableVolumeStudyMinutes(false);
          setActiveRecentStudyKey(null);
        }
        await fetchRecentStudyOptions();
      } else if (category === 'personal') {
        setNewPersonalTask('');
      } else {
        setNewRoutineTitle('');
        setIsRoutineModalOpen(false);
      }

      return true;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '할 일 추가 실패',
        description: typeof error?.message === 'string' ? error.message : '할 일을 저장하지 못했습니다.',
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAddRecentStudy = async (item: RecentStudyOption) => {
    const added = await handleAddTask(item.title, 'study', {
      studyPrefill: item,
      preserveStudyComposer: true,
    });

    if (added) {
      setIsRecentStudySheetOpen(false);
      toast({
        title: '최근 계획을 그대로 추가했어요.',
        description: '제목과 목표는 유지하고, 완료 상태는 새로 시작하도록 초기화했어요.',
      });
    }
  };

  const handleQuickAddSuggestion = async (suggestionId: string) => {
    const suggestion = PLANNER_QUICK_TASK_SUGGESTIONS.find((item) => item.id === suggestionId);
    if (!suggestion) return;
    const nextWindow = getNextAutoWindow(studyTasks, suggestion.targetMinutes, PLAN_DEFAULT_START_TIME);
    const added = await handleAddTask(suggestion.title, 'study', {
      taskBlueprint: {
        category: 'study',
        title: suggestion.title,
        subject: suggestion.subject,
        studyPlanMode: 'time',
        targetMinutes: suggestion.targetMinutes,
        startTime: nextWindow.startTime,
        endTime: nextWindow.endTime,
        priority: suggestion.priority || 'medium',
        tag: suggestion.tag,
      },
    });
    if (added) {
      setShowQuickAddCard(false);
      toast({
        title: '할 일을 빠르게 추가했어요',
        description: `${suggestion.title}을(를) 오늘 계획에 넣었습니다.`,
      });
    }
  };

  const handleSubmitInlineStudyTask = async () => {
    const added = await handleAddTask(newStudyTask, 'study');
    if (added) {
      setShowQuickAddCard(false);
    }
  };

  const buildCurrentAttendanceDraft = useCallback((): AttendanceScheduleDraft => ({
    inTime,
    outTime,
    awayStartTime,
    awayEndTime,
    awayReason,
    awaySlots: extraAwayPlans,
    isAbsent: isScheduleAbsent,
  }), [awayEndTime, awayReason, awayStartTime, extraAwayPlans, inTime, isScheduleAbsent, outTime]);

  const syncLegacyScheduleItems = useCallback(async (dateKey: string, scheduleDoc: StudentScheduleDoc | null) => {
    if (!firestore || !user || !activeMembership) return;

    const targetWeekKey = format(new Date(`${dateKey}T00:00:00`), "yyyy-'W'II");
    const itemsRef = collection(
      firestore,
      'centers',
      activeMembership.id,
      'plans',
      user.uid,
      'weeks',
      targetWeekKey,
      'items'
    );
    const currentSnapshot = await getDocs(
      query(itemsRef, where('dateKey', '==', dateKey), where('category', '==', 'schedule'))
    );
    const batch = writeBatch(firestore);
    currentSnapshot.docs.forEach((docSnap) => batch.delete(doc(itemsRef, docSnap.id)));

    if (scheduleDoc) {
      buildLegacyScheduleTitles(scheduleDoc).forEach((title) => {
        batch.set(doc(itemsRef), {
          title,
          done: false,
          weight: 0,
          dateKey,
          category: 'schedule',
          studyPlanWeekId: targetWeekKey,
          centerId: activeMembership.id,
          studentId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    }

    await batch.commit();
  }, [activeMembership, firestore, user]);

  const persistStudentSchedule = useCallback(async (params: {
    dateKey: string;
    draft: AttendanceScheduleDraft;
    awaySlots?: AttendanceAwaySlot[];
    note?: string | null;
    recurrenceSourceId?: string | null;
    source?: StudentScheduleDoc['source'];
    recommendedStudyMinutes?: number | null;
    recommendedWeeklyDays?: number | null;
  }) => {
    if (!firestore || !user) return;

    const validationMessage = validateScheduleDraft(params.draft, params.awaySlots || []);
    if (validationMessage) {
      throw new Error(validationMessage);
    }

    const scheduleRef = doc(firestore, 'users', user.uid, 'schedules', params.dateKey);
    const scheduleDoc = buildScheduleDocFromDraft({
      uid: user.uid,
      studentName: studentProfile?.name || activeMembership?.displayName || user.displayName || '학생',
      centerId: activeMembership?.id || null,
      dateKey: params.dateKey,
      draft: params.draft,
      extraAwaySlots: params.awaySlots || [],
      note: params.note || null,
      recurrenceSourceId: params.recurrenceSourceId || null,
      recommendedStudyMinutes: params.recommendedStudyMinutes || null,
      recommendedWeeklyDays: params.recommendedWeeklyDays || null,
      source: params.source,
    });

    await setDoc(scheduleRef, {
      ...scheduleDoc,
      createdAt: (selectedScheduleDoc as any)?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    await syncLegacyScheduleItems(params.dateKey, scheduleDoc as StudentScheduleDoc);
  }, [activeMembership, firestore, selectedScheduleDoc, studentProfile?.name, syncLegacyScheduleItems, user]);

  const handleSetAttendance = async (type: 'attend' | 'absent') => {
    if (isPast || !firestore || !user || !activeMembership || !weekKey || !selectedDateKey) return;
    setIsSubmitting(true);

    try {
      if (type === 'attend') {
        await persistStudentSchedule({
          dateKey: selectedDateKey,
          draft: buildCurrentAttendanceDraft(),
          awaySlots: extraAwayPlans,
          note: scheduleNote,
          source: scheduleRecommendationPrefill ? 'planner-diagnostic' : 'manual',
          recommendedStudyMinutes: scheduleRecommendationPrefill?.recommendedDailyStudyMinutes || null,
          recommendedWeeklyDays: scheduleRecommendationPrefill?.recommendedWeeklyDays || null,
        });
      } else {
        await persistStudentSchedule({
          dateKey: selectedDateKey,
          draft: {
            ...buildCurrentAttendanceDraft(),
            isAbsent: true,
          },
          note: scheduleNote,
        });
      }
      const existingDayStatus = (progress?.dailyPointStatus?.[selectedDateKey] || {}) as Record<string, any>;
      if (type === 'attend' && progressRef && !existingDayStatus.attendance) {
        await setDoc(progressRef, {
          pointsBalance: increment(10),
          totalPointsEarned: increment(10),
          dailyPointStatus: {
            [selectedDateKey]: {
              ...existingDayStatus,
              attendance: true,
              dailyPointAmount: increment(10),
            },
          },
          updatedAt: serverTimestamp(),
        }, { merge: true });
        toast({
          title: '출석/루틴 완료 보상',
          description: '오늘 출석 정보 저장으로 +10포인트가 반영되었습니다.',
        });
      }
      if (isToday) {
        await applySameDayRoutinePenalty(type === 'attend' ? '당일 출석 루틴 수정(출석 설정)' : '당일 출석 루틴 수정(미등원 설정)');
        toast({
          title: `당일 루틴 수정으로 벌점 ${SAME_DAY_ROUTINE_PENALTY_POINTS}점 반영`,
          description: '당일 출석 루틴은 수정 가능하지만 벌점이 자동 반영됩니다.',
        });
      }
      toast({ title: type === 'attend' ? "출석 일정이 등록되었습니다." : "미등원 처리가 완료되었습니다." });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: '출석 설정 실패',
        description: typeof e?.message === 'string' ? e.message : '출석 설정을 저장하지 못했습니다.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyAttendanceDraftToState = useCallback((draft: AttendanceScheduleDraft) => {
    setInTime(draft.inTime || '09:00');
    setOutTime(draft.outTime || '22:00');
    setAwayStartTime(draft.awayStartTime || '');
    setAwayEndTime(draft.awayEndTime || '');
    setAwayReason(draft.awayReason || '');
    setExtraAwayPlans(draft.awaySlots || []);
    setIsScheduleAbsent(Boolean(draft.isAbsent));
  }, []);

  const handleTodayScheduleChange = useCallback((patch: Partial<AttendanceScheduleDraft>) => {
    applyAttendanceDraftToState({
      ...buildCurrentAttendanceDraft(),
      ...patch,
      awaySlots: patch.awaySlots ?? extraAwayPlans,
    });
  }, [applyAttendanceDraftToState, buildCurrentAttendanceDraft, extraAwayPlans]);

  const handleWeekdayDraftChange = useCallback((patch: Partial<AttendanceScheduleDraft>) => {
    setWeekdayDraft((previous) => ({
      ...previous,
      ...patch,
      awaySlots: patch.awaySlots ?? previous.awaySlots,
    }));
  }, []);

  const handleSaveTodaySchedule = useCallback(async () => {
    if (!selectedDateKey) return;
    setIsSubmitting(true);
    try {
      await persistStudentSchedule({
        dateKey: selectedDateKey,
        draft: buildCurrentAttendanceDraft(),
        awaySlots: extraAwayPlans,
        note: scheduleNote,
        source: scheduleRecommendationPrefill ? 'planner-diagnostic' : 'manual',
        recommendedStudyMinutes: scheduleRecommendationPrefill?.recommendedDailyStudyMinutes || null,
        recommendedWeeklyDays: scheduleRecommendationPrefill?.recommendedWeeklyDays || null,
      });
      toast({
        title: '날짜별 일정 저장 완료',
        description: '선택한 날짜의 등하원·외출 일정을 저장했어요.',
      });
      clearSchedulePrefillCache();
      setIsAttendanceScheduleSheetOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '일정 저장 실패',
        description: typeof error?.message === 'string' ? error.message : '일정을 저장하지 못했어요.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [buildCurrentAttendanceDraft, clearSchedulePrefillCache, extraAwayPlans, persistStudentSchedule, scheduleNote, scheduleRecommendationPrefill, selectedDateKey, toast]);

  const handleSetTodayAbsent = useCallback(async () => {
    if (!selectedDateKey) return;
    setIsSubmitting(true);
    try {
      await persistStudentSchedule({
        dateKey: selectedDateKey,
        draft: {
          ...buildCurrentAttendanceDraft(),
          isAbsent: true,
        },
        note: scheduleNote,
      });
      toast({
        title: '미등원 일정 저장 완료',
        description: '선택한 날짜를 미등원 일정으로 저장했어요.',
      });
      clearSchedulePrefillCache();
      setIsAttendanceScheduleSheetOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '일정 저장 실패',
        description: typeof error?.message === 'string' ? error.message : '일정을 저장하지 못했어요.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [buildCurrentAttendanceDraft, clearSchedulePrefillCache, persistStudentSchedule, scheduleNote, selectedDateKey, toast]);

  const handleResetTodaySchedule = useCallback(async () => {
    if (!firestore || !user || !selectedDateKey) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(firestore, 'users', user.uid, 'schedules', selectedDateKey));
      await syncLegacyScheduleItems(selectedDateKey, null);
      applyAttendanceDraftToState(EMPTY_ATTENDANCE_SCHEDULE_DRAFT);
      setScheduleNote('');
      clearSchedulePrefillCache();
      toast({
        title: '이 날짜 일정 초기화',
        description: '저장된 날짜별 일정을 비웠어요.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: '초기화 실패',
        description: '일정을 초기화하지 못했어요.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [applyAttendanceDraftToState, clearSchedulePrefillCache, firestore, selectedDateKey, syncLegacyScheduleItems, toast, user]);

  const handleToggleRecurringWeekday = useCallback((weekday: number) => {
    setSelectedRecurringWeekdays((previous) =>
      previous.includes(weekday)
        ? previous.filter((value) => value !== weekday)
        : [...previous, weekday].sort()
    );
  }, []);

  const handleCopyTodayToWeekday = useCallback(() => {
    setWeekdayDraft(buildCurrentAttendanceDraft());
  }, [buildCurrentAttendanceDraft]);

  const handleSaveWeekdayTemplate = useCallback(async () => {
    if (!firestore || !user) return;
    if (selectedRecurringWeekdays.length === 0) {
      toast({
        variant: 'destructive',
        title: '반복 요일을 선택해 주세요',
        description: '최소 1개 이상의 요일을 선택해야 저장할 수 있어요.',
      });
      return;
    }

    const validationMessage = validateScheduleDraft(weekdayDraft, weekdayDraft.awaySlots || []);
    if (validationMessage) {
      toast({
        variant: 'destructive',
        title: '반복 루틴 저장 실패',
        description: validationMessage,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const templateId = matchingWeekdayTemplate?.id || `template-${selectedRecurringWeekdays.join('-')}`;
      await setDoc(doc(firestore, 'users', user.uid, 'scheduleTemplates', templateId), {
        name: presetName.trim() || `${selectedRecurringWeekdayLabel} 기본 루틴`,
        weekdays: selectedRecurringWeekdays,
        arrivalPlannedAt: weekdayDraft.inTime,
        departurePlannedAt: weekdayDraft.outTime,
        hasExcursionDefault: Boolean(weekdayDraft.awayStartTime && weekdayDraft.awayEndTime),
        defaultExcursionStartAt: weekdayDraft.awayStartTime || null,
        defaultExcursionEndAt: weekdayDraft.awayEndTime || null,
        defaultExcursionReason: weekdayDraft.awayReason?.trim() || null,
        active: true,
        timezone: 'Asia/Seoul',
        createdAt: matchingWeekdayTemplate?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      toast({
        title: '정기 루틴 저장 완료',
        description: `매주 ${selectedRecurringWeekdayLabel}에 적용할 기본값을 저장했어요.`,
      });
    } catch {
      toast({
        variant: 'destructive',
        title: '정기 루틴 저장 실패',
        description: '반복 루틴을 저장하지 못했어요.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [firestore, matchingWeekdayTemplate, presetName, selectedRecurringWeekdayLabel, selectedRecurringWeekdays, toast, user, weekdayDraft]);

  const handleSaveSchedulePreset = useCallback(async () => {
    if (!firestore || !user) return;
    if (!presetName.trim()) {
      toast({
        variant: 'destructive',
        title: '루틴 이름을 적어주세요',
        description: '저장한 루틴 목록에서 구분할 이름이 필요해요.',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, 'users', user.uid, 'scheduleTemplates'), {
        name: presetName.trim(),
        weekdays: selectedRecurringWeekdays.length > 0 ? selectedRecurringWeekdays : [selectedWeekdayValue],
        arrivalPlannedAt: inTime,
        departurePlannedAt: outTime,
        hasExcursionDefault: Boolean(awayStartTime && awayEndTime),
        defaultExcursionStartAt: awayStartTime || null,
        defaultExcursionEndAt: awayEndTime || null,
        defaultExcursionReason: awayReason.trim() || null,
        active: true,
        timezone: 'Asia/Seoul',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setPresetName('');
      toast({
        title: '루틴 저장 완료',
        description: '다음부터 날짜 입력이나 정기 루틴에 바로 복사할 수 있어요.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: '루틴 저장 실패',
        description: '루틴을 저장하지 못했어요.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [awayEndTime, awayReason, awayStartTime, firestore, inTime, outTime, presetName, selectedRecurringWeekdays, selectedWeekdayValue, toast, user]);

  const handleDeleteScheduleTemplate = useCallback(async (templateId: string) => {
    if (!firestore || !user) return;
    await deleteDoc(doc(firestore, 'users', user.uid, 'scheduleTemplates', templateId));
  }, [firestore, user]);

  const handleApplyPresetToToday = useCallback((preset: SavedAttendanceRoutine) => {
    applyAttendanceDraftToState(preset);
  }, [applyAttendanceDraftToState]);

  const handleApplyPresetToWeekday = useCallback((preset: SavedAttendanceRoutine) => {
    setWeekdayDraft(preset);
  }, []);

  const handleApplySelectedWeekdayTemplateToToday = useCallback(() => {
    if (!matchingWeekdayTemplate) return;
    applyAttendanceDraftToState({
      inTime: matchingWeekdayTemplate.arrivalPlannedAt,
      outTime: matchingWeekdayTemplate.departurePlannedAt,
      awayStartTime: matchingWeekdayTemplate.defaultExcursionStartAt || '',
      awayEndTime: matchingWeekdayTemplate.defaultExcursionEndAt || '',
      awayReason: matchingWeekdayTemplate.defaultExcursionReason || '',
      awaySlots: [],
      isAbsent: false,
    });
    setScheduleNote((matchingWeekdayTemplate as any)?.note || '');
  }, [applyAttendanceDraftToState, matchingWeekdayTemplate]);

  const handleToggleScheduleTemplateActive = useCallback(async (templateId: string, active: boolean) => {
    if (!firestore || !user) return;
    try {
      await updateDoc(doc(firestore, 'users', user.uid, 'scheduleTemplates', templateId), {
        active,
        updatedAt: serverTimestamp(),
      });
      toast({
        title: active ? '반복 루틴을 다시 사용해요' : '반복 루틴을 잠시 껐어요',
        description: active
          ? '다음부터는 이 루틴을 날짜 기본값으로 다시 불러와요.'
          : '저장해둔 내용은 남겨두고 자동 프리필만 잠시 멈춰둘게요.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: '루틴 상태 변경 실패',
        description: '반복 루틴 활성 상태를 바꾸지 못했어요.',
      });
    }
  }, [firestore, toast, user]);

  const handleUpdateScheduleRange = async (itemId: string, baseTitle: string, start: {h: string, m: string, p: '오전' | '오후'}, end: {h: string, m: string, p: '오전' | '오후'}) => {
    if (isPast || !firestore || !user || !activeMembership || !weekKey) return;
    const formattedStart = to24h(`${start.h}:${start.m}`, start.p);
    const formattedEnd = to24h(`${end.h}:${end.m}`, end.p);
    const rangeStr = `${formattedStart} ~ ${formattedEnd}`;
    const docRef = doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', itemId);
    await updateDoc(docRef, { title: `${baseTitle}: ${rangeStr}`, updatedAt: serverTimestamp() });
    if (isToday) {
      await applySameDayRoutinePenalty('당일 출석 루틴 시간 수정');
      toast({
        title: `당일 루틴 수정으로 벌점 ${SAME_DAY_ROUTINE_PENALTY_POINTS}점 반영`,
        description: '당일 출석 루틴은 수정 가능하지만 벌점이 자동 반영됩니다.',
      });
    }
  };

  const handleToggleTask = async (item: WithId<StudyPlanItem>) => {
    if (isPast || !firestore || !user || !activeMembership || !isStudent || !weekKey || !selectedDateKey) return;
    if (resolveStudyPlanMode(item) === 'volume') return;
    const itemRef = doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id);
    const nextState = !item.done;
    
    await updateDoc(itemRef, { done: nextState, updatedAt: serverTimestamp() });
    
    if (nextState) {
      const nextCompletedCount = checklistTasks.filter((task) => task.id !== item.id && task.done).length + 1;
      const awarded = await awardPlannerCompletionPoints(item, nextCompletedCount, checklistTasks.length);
      if (awarded > 0) {
        pushFloatingPointBurst(`+${awarded}`);
        toast({
          title: `+${awarded} 포인트`,
          description: nextCompletedCount === checklistTasks.length
            ? '오늘 계획을 끝까지 밀어붙였어요.'
            : '체크와 동시에 포인트가 반영됐어요.',
        });
      }
    }
  };

  const handleCommitStudyActualAmount = async (item: WithId<StudyPlanItem>, nextActualAmount: number) => {
    if (isPast || !firestore || !user || !activeMembership || !isStudent || !weekKey) return;
    const itemRef = doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id);
    const safeActualAmount = Math.max(0, Math.round(nextActualAmount));
    const targetAmount = Math.max(0, item.targetAmount || 0);
    const willBeDone = targetAmount > 0 && safeActualAmount >= targetAmount;
    await updateDoc(itemRef, {
      actualAmount: safeActualAmount,
      done: willBeDone,
      updatedAt: serverTimestamp(),
    });
    if (!item.done && willBeDone) {
      const nextCompletedCount = checklistTasks.filter((task) => task.id !== item.id && task.done).length + 1;
      const awarded = await awardPlannerCompletionPoints(item, nextCompletedCount, checklistTasks.length);
      if (awarded > 0) {
        pushFloatingPointBurst(`+${awarded}`);
        toast({
          title: `+${awarded} 포인트`,
          description: '분량 목표를 채워서 즉시 포인트가 반영됐어요.',
        });
      }
    }
  };

  const handleUpdateStudyWindow = async (item: WithId<StudyPlanItem>, startTime: string, endTime: string) => {
    if (isPast || !firestore || !user || !activeMembership || !weekKey) return;
    const itemRef = doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id);
    await updateDoc(itemRef, {
      startTime,
      endTime,
      updatedAt: serverTimestamp(),
    });
  };

  const handleDeleteTask = async (item: WithId<StudyPlanItem>) => {
    if (isPast || !firestore || !user || !activeMembership || !isStudent || !weekKey) return;

    await deleteDoc(doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id));
    if (item.category === 'schedule' && isToday) {
      await applySameDayRoutinePenalty('당일 출석 루틴 삭제');
      toast({
        title: `당일 루틴 수정으로 벌점 ${SAME_DAY_ROUTINE_PENALTY_POINTS}점 반영`,
        description: '당일 출석 루틴은 수정 가능하지만 벌점이 자동 반영됩니다.',
      });
    }
    toast({ title: "항목이 삭제되었습니다." });
  };

  const handleApplyTasksToAllWeekdaysLegacy = async () => {
    if (isPast || !selectedDate || !firestore || !user || !activeMembership || !dailyPlans || dailyPlans.length === 0) return;
    const tasksToCopy = dailyPlans.filter(p => p.category !== 'schedule');
    if (tasksToCopy.length === 0) {
      toast({ variant: "destructive", title: "복사할 학습 계획이 없습니다." });
      return;
    }

    setIsSubmitting(true);
    const weekday = getDay(selectedDate);
    const monthDates = eachDayOfInterval({ start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) });
    const targetDates = monthDates.filter(d => getDay(d) === weekday && !isSameDay(d, selectedDate) && !isBefore(startOfDay(d), startOfDay(new Date())));
    
    const batch = writeBatch(firestore);
    try {
      for (const targetDate of targetDates) {
        const targetDateKey = format(targetDate, 'yyyy-MM-dd');
        const targetWeekKey = format(targetDate, "yyyy-'W'II");
        const itemsCollectionRef = collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', targetWeekKey, 'items');
        
        tasksToCopy.forEach(plan => {
          batch.set(doc(itemsCollectionRef), {
            title: plan.title, done: false, weight: plan.weight, dateKey: targetDateKey, category: plan.category || 'study',
            subject: plan.subject || null, targetMinutes: plan.targetMinutes || 0,
            studyPlanWeekId: targetWeekKey, centerId: activeMembership.id, studentId: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
        });
      }
      await batch.commit();
      toast({ title: "계획 복사 완료", description: `이번 달의 남은 ${format(selectedDate, 'EEEE', { locale: ko })}에 학습 계획이 복사되었습니다.` });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '계획 복사 실패',
        description: typeof error?.message === 'string' ? error.message : '학습 계획을 복사하지 못했습니다.',
      });
    } finally { setIsSubmitting(false); }
  };

  const handleApplyRoutineToAllWeekdaysLegacy = async () => {
    if (isPast || !selectedDate || !firestore || !user || !activeMembership || !dailyPlans || dailyPlans.length === 0) return;
    const routinesToCopy = dailyPlans.filter(p => p.category === 'schedule');
    if (routinesToCopy.length === 0) {
      toast({ variant: "destructive", title: "복사할 생활 루틴이 없습니다." });
      return;
    }

    setIsSubmitting(true);
    const weekday = getDay(selectedDate);
    const monthDates = eachDayOfInterval({ start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) });
    const targetDates = monthDates.filter(d => getDay(d) === weekday && !isSameDay(d, selectedDate) && !isBefore(startOfDay(d), startOfDay(new Date())));
    
    const batch = writeBatch(firestore);
    try {
      for (const targetDate of targetDates) {
        const targetDateKey = format(targetDate, 'yyyy-MM-dd');
        const targetWeekKey = format(targetDate, "yyyy-'W'II");
        const itemsCollectionRef = collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', targetWeekKey, 'items');
        
        routinesToCopy.forEach(plan => {
          batch.set(doc(itemsCollectionRef), {
            title: plan.title, done: false, weight: 0, dateKey: targetDateKey, category: 'schedule',
            studyPlanWeekId: targetWeekKey, centerId: activeMembership.id, studentId: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
        });
      }
      await batch.commit();
      toast({ title: "루틴 복사 완료", description: `이번 달의 남은 ${format(selectedDate, 'EEEE', { locale: ko })}에 생활 루틴이 복사되었습니다.` });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '루틴 복사 실패',
        description: typeof error?.message === 'string' ? error.message : '생활 루틴을 복사하지 못했습니다.',
      });
    } finally { setIsSubmitting(false); }
  };
  void handleApplyTasksToAllWeekdaysLegacy;
  void handleApplyRoutineToAllWeekdaysLegacy;

  const toggleCopyDay = (target: 'task' | 'routine', day: number, checked: boolean) => {
    if (target === 'task') {
      setTaskCopyDays(prev => checked ? Array.from(new Set([...prev, day])) : prev.filter(d => d !== day));
      return;
    }
    setRoutineCopyDays(prev => checked ? Array.from(new Set([...prev, day])) : prev.filter(d => d !== day));
  };

  const toggleCopyItem = (target: 'task' | 'routine', id: string, checked: boolean) => {
    if (target === 'task') {
      setTaskCopyItemIds((prev) => checked ? Array.from(new Set([...prev, id])) : prev.filter((itemId) => itemId !== id));
      return;
    }
    setRoutineCopyItemIds((prev) => checked ? Array.from(new Set([...prev, id])) : prev.filter((itemId) => itemId !== id));
  };

  const copyPlansWithOptions = async (
    kind: 'task' | 'routine',
    options: { weeks: number; weekdays: number[]; itemIds: string[] }
  ) => {
    if (isPast || !selectedDate || !firestore || !user || !activeMembership || !dailyPlans || dailyPlans.length === 0) return false;

    const sourcePlans = (kind === 'task'
      ? dailyPlans.filter(p => p.category !== 'schedule')
      : dailyPlans.filter(p => p.category === 'schedule'))
      .filter((plan) => options.itemIds.includes(plan.id));

    if (sourcePlans.length === 0) {
      toast({
        variant: 'destructive',
        title: kind === 'task' ? '복사할 학습/기타 계획을 선택해 주세요.' : '복사할 생활 루틴을 선택해 주세요.',
      });
      return false;
    }

    if (options.weekdays.length === 0) {
      toast({ variant: 'destructive', title: '복사할 요일을 하나 이상 선택해 주세요.' });
      return false;
    }

    const normalizedWeeks = Number.isFinite(options.weeks) ? Math.max(1, Math.min(12, options.weeks)) : 1;
    const intervalStart = addDays(startOfDay(selectedDate), 1);
    const intervalEnd = addDays(startOfDay(selectedDate), normalizedWeeks * 7);
    const weekdaySet = new Set(options.weekdays);
    const todayStart = startOfDay(new Date());
    const targetDates = eachDayOfInterval({ start: intervalStart, end: intervalEnd }).filter(targetDate => {
      if (isBefore(startOfDay(targetDate), todayStart)) return false;
      return weekdaySet.has(getDay(targetDate));
    });

    if (targetDates.length === 0) {
      toast({ variant: 'destructive', title: '선택한 조건에 맞는 복사 대상 날짜가 없습니다.' });
      return false;
    }

    setIsSubmitting(true);
    const batch = writeBatch(firestore);

    try {
      for (const targetDate of targetDates) {
        const targetDateKey = format(targetDate, 'yyyy-MM-dd');
        const targetWeekKey = format(targetDate, "yyyy-'W'II");
        const itemsCollectionRef = collection(
          firestore,
          'centers',
          activeMembership.id,
          'plans',
          user.uid,
          'weeks',
          targetWeekKey,
          'items'
        );

        sourcePlans.forEach(plan => {
          batch.set(doc(itemsCollectionRef), {
            title: plan.title,
            done: false,
            weight: kind === 'routine' ? 0 : plan.weight,
            dateKey: targetDateKey,
            category: kind === 'routine' ? 'schedule' : (plan.category || 'study'),
            subject: kind === 'task' ? (plan.subject || null) : null,
            targetMinutes: kind === 'task' ? (plan.targetMinutes || 0) : 0,
            studyPlanMode: kind === 'task' ? (plan.studyPlanMode || resolveStudyPlanMode(plan)) : undefined,
            targetAmount: kind === 'task' ? (plan.targetAmount || 0) : 0,
            actualAmount: kind === 'task' ? 0 : 0,
            amountUnit: kind === 'task' ? (plan.amountUnit || null) : null,
            amountUnitLabel: kind === 'task' ? (plan.amountUnitLabel || null) : null,
            studyPlanWeekId: targetWeekKey,
            centerId: activeMembership.id,
            studentId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      }
      await batch.commit();
      toast({
        title: kind === 'task' ? '계획 복사를 완료했어요.' : '루틴 복사를 완료했어요.',
        description: `${normalizedWeeks}주 동안 선택한 요일로 복사했어요.`,
      });
      return true;
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '복사 중 오류가 발생했습니다.' });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyTasksToAllWeekdays = async () => {
    const copied = await copyPlansWithOptions('task', {
      weeks: Number(taskCopyWeeks),
      weekdays: taskCopyDays,
      itemIds: taskCopyItemIds,
    });
    if (copied) setIsTaskCopyDialogOpen(false);
  };

  const handleApplyRoutineToAllWeekdays = async () => {
    const copied = await copyPlansWithOptions('routine', {
      weeks: Number(routineCopyWeeks),
      weekdays: routineCopyDays,
      itemIds: routineCopyItemIds,
    });
    if (copied) setIsRoutineCopyDialogOpen(false);
  };

  const weekdayTemplate = BUILTIN_PLANNER_TEMPLATES.find((template) => template.id === 'builtin-weekday') || BUILTIN_PLANNER_TEMPLATES[0];
  const examTemplate = BUILTIN_PLANNER_TEMPLATES.find((template) => template.id === 'builtin-exam') || BUILTIN_PLANNER_TEMPLATES[0];
  const selectedDateTitle = format(selectedDate || new Date(), 'M월 d일 EEEE', { locale: ko });
  const selectedDateSheetLabel = format(selectedDate || new Date(), 'yyyy. MM. dd', { locale: ko });

  if (!isStudent) {
    return <div className="flex items-center justify-center h-[400px] px-4"><Card className="max-w-md w-full rounded-[2.5rem] border-none shadow-2xl"><CardHeader className="text-center"><CardTitle className="font-black text-2xl tracking-tighter">학생 전용 페이지</CardTitle><CardDescription className="font-bold">학생 계정으로 로그인해야 학습 계획을 관리할 수 있습니다.</CardDescription></CardHeader></Card></div>;
  }

  if (!selectedDate) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  if (planTrackEntryMode === 'auto' || isStudentProfileLoading) {
    return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;
  }

  if (planTrackEntryMode === 'onboarding') {
    return (
      <RoutineOnboardingFlow
        studentName={studentProfile?.name || activeMembership.displayName || user?.displayName || '학생'}
        onSaveRoutineProfile={handleSaveRoutineProfile}
        onContinueToPlanner={() => setPlanTrackEntryMode('planner')}
        onSkipForNow={handleDismissRoutineOnboarding}
      />
    );
  }

  return (
    <div className={cn("flex flex-col w-full max-w-5xl mx-auto pb-24", isMobile ? "gap-4 px-0" : "gap-6")}>
      <header className={cn("flex flex-col", isMobile ? "gap-2 px-1" : "gap-3")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={cn("font-black uppercase tracking-[0.24em] text-primary/55", isMobile ? "text-[9px]" : "text-[11px]")}>
              Plan Track
            </p>
            <h1 className={cn("mt-1 font-black tracking-tight text-primary", isMobile ? "text-[1.65rem]" : "text-[2.4rem]")}>
              오늘 계획부터 차분하게 정리해요
            </h1>
            <p className={cn("mt-2 break-keep font-semibold text-[#5A6F95]", isMobile ? "text-[12px] leading-5" : "text-sm leading-6")}>
              복잡한 허브 대신 오늘 할 일, 짧은 추천, 이번 주 독서실 일정만 먼저 보여드릴게요.
            </p>
          </div>
          {isPast ? (
            <Badge variant="destructive" className={cn("rounded-full font-black px-3 py-1 shadow-sm", isMobile ? "text-[8px] h-6" : "text-[10px]")}>
              기록 모드
            </Badge>
          ) : (
            <Badge className={cn("rounded-full border-none font-black text-white shadow-lg bg-gradient-to-r", isMobile ? "text-[8px] h-7 px-3" : "text-[10px] h-9 px-4", rewardGradient)}>
              <Zap className={cn(isMobile ? "mr-1 h-3 w-3" : "mr-1.5 h-4 w-4")} />
              오늘 기준 {formatMinutesSummary(recommendedDailyMinutes)}
            </Badge>
          )}
        </div>
      </header>

      <section className={cn("overflow-hidden rounded-[1.7rem] bg-[linear-gradient(180deg,#17326B_0%,#21448D_100%)] text-white shadow-[0_24px_56px_-34px_rgba(20,41,95,0.48)]", isMobile ? "rounded-[1.35rem]" : "rounded-[2rem]")}>
        <div className={cn("space-y-5", isMobile ? "p-4" : "p-6")}>
          <div className={cn("flex gap-4", isMobile ? "flex-col" : "items-start justify-between")}>
            <div className="min-w-0">
              <Badge className="border-none bg-white/12 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-white shadow-none">
                오늘의 투두리스트
              </Badge>
              <h2 className={cn("mt-3 font-black tracking-tight text-white", isMobile ? "text-[1.45rem]" : "text-[2rem]")}>
                {selectedDateTitle}
              </h2>
              <p className={cn("mt-2 break-keep font-semibold text-white/72", isMobile ? "text-[12px] leading-5" : "text-sm leading-6")}>
                오늘 해야 할 공부를 먼저 적고, 끝낸 블록부터 가볍게 체크해보세요.
              </p>
            </div>
            <div className={cn("grid gap-3", isMobile ? "grid-cols-2" : "grid-cols-3")}>
              <div className="rounded-[1.15rem] border border-white/10 bg-white/8 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/65">총 계획 시간</p>
                <p className="mt-2 text-xl font-black tracking-tight text-white">{formatMinutesSummary(studyTimeSummary.total)}</p>
              </div>
              <div className="rounded-[1.15rem] border border-white/10 bg-white/8 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/65">등록 투두</p>
                <p className="mt-2 text-xl font-black tracking-tight text-white">{studyTasks.length}개</p>
              </div>
              <div className={cn("rounded-[1.15rem] border border-white/10 bg-white/8 px-4 py-3", isMobile && "col-span-2")}>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/65">오늘 목표 대비</p>
                <p className="mt-2 text-xl font-black tracking-tight text-white">{planProgressPercent}%</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-white/10 bg-white/8 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/65">오늘 목표시간 진행</p>
                <p className="mt-2 break-keep text-sm font-black text-white">{studyGoalSummaryLabel}</p>
              </div>
              <Badge className="rounded-full border-none bg-white/12 px-3 py-1 text-[10px] font-black text-white shadow-none">
                목표 {formatMinutesSummary(recommendedDailyMinutes)}
              </Badge>
            </div>
            <Progress value={planProgressPercent} className="mt-4 h-2.5 bg-white/10" indicatorClassName={cn("bg-gradient-to-r", rewardGradient)} />
          </div>

          <div className="flex flex-wrap gap-2">
            {(subjectBalanceEntries.length > 0 ? subjectBalanceEntries.slice(0, 4).map((entry) => (
              <Badge key={entry.subjectId} className="rounded-full border-none bg-white px-3 py-1 text-[10px] font-black text-[#17326B] shadow-none">
                {entry.subjectLabel} {formatMinutesSummary(entry.minutes)}
              </Badge>
            )) : prioritySubjectLabels.slice(0, 4).map((label) => (
              <Badge key={label} className="rounded-full border-none bg-white px-3 py-1 text-[10px] font-black text-[#17326B] shadow-none">
                {label}
              </Badge>
            )))}
            {subjectBalanceEntries.length === 0 && prioritySubjectLabels.length === 0 ? (
              <Badge className="rounded-full border-none bg-white/12 px-3 py-1 text-[10px] font-black text-white shadow-none">
                우선 과목을 아직 정하지 않았어요
              </Badge>
            ) : null}
          </div>

          <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_auto]")}>
            <div className="space-y-3">
              {visibleStudyTasks.length === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed border-white/20 bg-white/6 px-4 py-6 text-center">
                  <p className="text-base font-black text-white">오늘 계획이 아직 비어 있어요</p>
                  <p className="mt-2 break-keep text-[12px] font-semibold leading-5 text-white/70">
                    첫 블록만 적어도 충분해요. 예를 들어 수학 60분, 영어 단어 30분처럼 오늘 바로 시작할 수 있는 것부터 넣어보세요.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-4 h-10 rounded-[1rem] px-5 font-black"
                    onClick={() => openStudyPlanSheet()}
                    disabled={isPast}
                  >
                    첫 블록 추가
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleStudyTasks.map((task) => {
                    const subject = SUBJECTS.find((item) => item.id === (task.subject || 'etc'));
                    const isVolumeTask = resolveStudyPlanMode(task) === 'volume';
                    const metaLabel = isVolumeTask
                      ? `${task.targetAmount || 0}${resolveAmountUnitLabel(task)}`
                      : `${task.targetMinutes || 0}분`;
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-[1.15rem] border px-4 py-3 transition-colors",
                          task.done ? "border-emerald-300 bg-emerald-50/15" : "border-white/10 bg-white/8"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="rounded-full border-none bg-white px-2.5 py-1 text-[9px] font-black text-[#17326B] shadow-none">
                              {subject?.label || '기타'}
                            </Badge>
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">
                              {isVolumeTask ? '분량형' : '시간형'}
                            </span>
                          </div>
                          <p className={cn("mt-2 break-keep text-sm font-black", task.done ? "text-white/70 line-through" : "text-white")}>
                            {task.title}
                          </p>
                          <p className="mt-1 text-[11px] font-semibold text-white/68">{metaLabel} · {buildStudyTaskMeta(task)}</p>
                        </div>
                        <Button
                          type="button"
                          variant={task.done ? 'outline' : 'secondary'}
                          className={cn("shrink-0 rounded-full px-4 font-black", isMobile ? "h-9 text-[11px]" : "h-10 text-xs")}
                          onClick={() => void handleToggleTask(task as WithId<StudyPlanItem>)}
                          disabled={isPast}
                        >
                          {task.done ? '완료됨' : '완료'}
                        </Button>
                      </div>
                    );
                  })}
                  {hiddenStudyTaskCount > 0 ? (
                    <p className="text-[11px] font-semibold text-white/70">
                      나머지 {hiddenStudyTaskCount}개는 계획 수정에서 이어서 볼 수 있어요.
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            <div className={cn("flex gap-2", isMobile ? "grid grid-cols-2" : "flex-col justify-start")}>
              <Button
                type="button"
                className={cn("rounded-[1rem] font-black text-white bg-gradient-to-r shadow-lg", isMobile ? "h-11 text-[12px]" : "h-11 min-w-[132px] text-xs", rewardGradient)}
                onClick={() => openStudyPlanSheet()}
                disabled={isPast}
              >
                <Plus className="mr-2 h-4 w-4" />
                계획 추가
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn("rounded-[1rem] border-white/25 bg-white/8 font-black text-white hover:bg-white/12", isMobile ? "h-11 text-[12px]" : "h-11 min-w-[132px] text-xs")}
                onClick={() => setIsStudyPlanSheetOpen(true)}
              >
                <PencilLine className="mr-2 h-4 w-4" />
                계획 수정
              </Button>
            </div>
          </div>

          <div className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/65">빠른 추가</p>
              {PLANNER_QUICK_TASK_SUGGESTIONS.slice(0, 4).map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => void handleQuickAddSuggestion(suggestion.id)}
                  className="rounded-full border border-white/18 bg-white/10 px-3 py-1.5 text-[10px] font-black text-white transition hover:bg-white/16"
                  disabled={isPast}
                >
                  {suggestion.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={cn("overflow-hidden rounded-[1.7rem] border border-[#DCE6F5] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] shadow-[0_22px_54px_-38px_rgba(20,41,95,0.18)]", isMobile ? "rounded-[1.35rem]" : "rounded-[2rem]")}>
        <div className={cn("space-y-4", isMobile ? "p-4" : "p-5")}>
          <div className={cn("flex gap-3", isMobile ? "flex-col" : "items-start justify-between")}>
            <div className="min-w-0">
              <Badge className="border-none bg-primary/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-primary shadow-none">
                오늘의 학습 추천
              </Badge>
              <h2 className={cn("mt-3 font-black tracking-tight text-[#17326B]", isMobile ? "text-lg" : "text-[1.35rem]")}>
                최근 계획과 학습 기준을 바탕으로, 오늘은 이 정도만 바꿔보세요.
              </h2>
              <p className={cn("mt-2 break-keep font-semibold text-[#5A6F95]", isMobile ? "text-[12px] leading-5" : "text-sm leading-6")}>
                긴 리포트 대신 오늘 바로 반영할 수 있는 제안만 1~2개로 정리했어요.
              </p>
            </div>
            <div className={cn("flex gap-2", isMobile ? "flex-col" : "flex-wrap justify-end")}>
              <Button
                type="button"
                variant="outline"
                className={cn("rounded-xl border-2 bg-white font-black", isMobile ? "h-10 w-full text-[11px]" : "h-11 px-4 text-xs")}
                onClick={() => setPlanTrackEntryMode('onboarding')}
              >
                {hasRoutineProfile ? '학습 기준 다시 진단하기' : '학습 기준 진단하기'}
              </Button>
              <Button asChild variant="secondary" className={cn("rounded-xl font-black", isMobile ? "h-10 w-full text-[11px]" : "h-11 px-4 text-xs")}>
                <Link href="/dashboard/plan/diagnosis">{latestDiagnostic ? '전체 진단 결과 보기' : '학습 플래너 진단하기'}</Link>
              </Button>
            </div>
          </div>

          {hasRoutineProfile ? (
            <div className="rounded-[1.1rem] border border-[#E6EDF8] bg-white px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8AA0C7]">저장된 학습 기준</p>
              <p className="mt-1 text-sm font-black text-[#17326B]">{routineGuideSummary}</p>
            </div>
          ) : (
            <div className="rounded-[1.1rem] border border-[#FFE2C5] bg-[#FFF7EF] px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D86A11]">기준이 아직 없어요</p>
              <p className="mt-1 text-sm font-black text-[#17326B]">처음 한 번만 답해두면 이후엔 자동으로 뜨지 않고, 계획을 읽는 기준으로만 사용돼요.</p>
            </div>
          )}

          <div className="grid gap-3">
            {mainRecommendations.map((recommendation) => {
              const isExpanded = expandedRecommendationIds.includes(recommendation.id);
              return (
                <Collapsible
                  key={recommendation.id}
                  open={isExpanded}
                  onOpenChange={(open) =>
                    setExpandedRecommendationIds((previous) =>
                      open ? [...new Set([...previous, recommendation.id])] : previous.filter((item) => item !== recommendation.id)
                    )
                  }
                >
                  <div className="rounded-[1.25rem] border border-[#E1EAF7] bg-white px-4 py-4 shadow-[0_14px_32px_-28px_rgba(20,41,95,0.16)]">
                    <div className={cn("flex gap-3", isMobile ? "flex-col" : "items-start justify-between")}>
                      <div className="min-w-0">
                        <Badge className={cn("rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] shadow-none", RECOMMENDATION_BADGE_TONE[recommendation.badge])}>
                          {recommendation.badge}
                        </Badge>
                        <p className="mt-3 text-base font-black tracking-tight text-[#17326B]">{recommendation.title}</p>
                        <p className="mt-2 break-keep text-[13px] font-semibold leading-6 text-[#27416C]">{recommendation.action}</p>
                        <p className="mt-2 break-keep text-[12px] font-semibold leading-5 text-[#5A6F95]">{recommendation.reason}</p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className={cn("rounded-[0.95rem] font-black", isMobile ? "h-10 w-full text-[11px]" : "h-10 px-4 text-xs")}
                        onClick={() => openStudyPlanSheet(recommendation.applyPreset)}
                        disabled={isPast}
                      >
                        오늘 계획에 반영하기
                      </Button>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="mt-3 h-9 rounded-[0.95rem] px-3 text-[11px] font-black text-[#17326B] hover:bg-[#F4F7FC]"
                      >
                        왜 이렇게 추천했나요?
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 rounded-[1rem] border border-[#EEF3FB] bg-[#F8FBFF] px-3 py-3">
                        <p className="break-keep text-[12px] font-semibold leading-5 text-[#5A6F95]">{recommendation.explainWhy}</p>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </div>
      </section>

      <section className={cn("overflow-hidden rounded-[1.7rem] border border-[#DCE6F5] bg-white shadow-[0_20px_48px_-34px_rgba(20,41,95,0.18)]", isMobile ? "rounded-[1.35rem]" : "rounded-[2rem]")}>
        <div className={cn("space-y-4", isMobile ? "p-4" : "p-5")}>
          <div className={cn("flex gap-3", isMobile ? "flex-col" : "items-start justify-between")}>
            <div className="min-w-0">
              <Badge className="border-none bg-primary/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-primary shadow-none">
                이번 주 독서실 일정
              </Badge>
              <h2 className={cn("mt-3 font-black tracking-tight text-[#17326B]", isMobile ? "text-lg" : "text-[1.35rem]")}>
                월요일부터 일요일까지, 이번 주 출입 계획을 한눈에 확인해요
              </h2>
              <p className={cn("mt-2 break-keep font-semibold text-[#5A6F95]", isMobile ? "text-[12px] leading-5" : "text-sm leading-6")}>
                주간 overview만 먼저 보고, 자세한 수정은 시트에서 가볍게 이어가면 됩니다.
              </p>
            </div>
            <div className={cn("flex gap-2", isMobile ? "flex-col" : "flex-wrap justify-end")}>
              <Button
                type="button"
                className={cn("rounded-xl font-black text-white bg-gradient-to-r", isMobile ? "h-10 w-full text-[11px]" : "h-11 px-4 text-xs", rewardGradient)}
                onClick={() => openAttendanceSheetForDate(tomorrowDate, 'today')}
              >
                내일 일정 수정하기
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn("rounded-xl border-2 bg-white font-black", isMobile ? "h-10 w-full text-[11px]" : "h-11 px-4 text-xs")}
                onClick={() => {
                  setAttendanceSheetInitialTab('weekday');
                  setIsAttendanceScheduleSheetOpen(true);
                }}
              >
                이번 주 한 번에 설정
              </Button>
            </div>
          </div>

          {scheduleRecommendationPrefill ? (
            <div className="rounded-[1.15rem] border border-[#FFE2C5] bg-[#FFF7EF] px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D86A11]">플래너 연동 추천</p>
              <p className="mt-2 break-keep text-sm font-black text-[#17326B]">
                이번 주 권장 등원 {scheduleRecommendationPrefill.recommendedWeeklyDays}일 · 하루 권장 공부 {formatMinutesSummary(scheduleRecommendationPrefill.recommendedDailyStudyMinutes)}
              </p>
              <p className="mt-1 break-keep text-[12px] font-semibold leading-5 text-[#6C5A49]">
                추천 등원 {scheduleRecommendationPrefill.recommendedArrivalTime} · 추천 하원 {scheduleRecommendationPrefill.recommendedDepartureTime}
              </p>
            </div>
          ) : null}

          {needsTomorrowSchedule ? (
            <div className="rounded-[1.15rem] border border-[#FFD7B5] bg-[#FFF4E8] px-4 py-4">
              <p className="text-sm font-black text-[#17326B]">내일 독서실 일정이 아직 없어요. 오늘 미리 정해두면 좋아요.</p>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => moveWeek(-1)}
              className={cn("rounded-xl border-2 bg-white text-primary hover:bg-primary hover:text-white", isMobile ? "h-9 w-9" : "h-10 w-10")}
              aria-label="지난 주 보기"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-center text-[11px] font-black uppercase tracking-[0.18em] text-[#8AA0C7]">{weekRangeLabel}</p>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => moveWeek(1)}
              className={cn("rounded-xl border-2 bg-white text-primary hover:bg-primary hover:text-white", isMobile ? "h-9 w-9" : "h-10 w-10")}
              aria-label="다음 주 보기"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {weeklyScheduleOverview.map((day) => (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => openAttendanceSheetForDate(day.date, 'today')}
                className={cn(
                  "rounded-[1rem] border px-2 py-3 text-left transition-all",
                  day.isSelected ? "border-primary bg-[#F2F6FF] shadow-sm" : "border-[#E5ECF7] bg-white hover:border-primary/30",
                  day.isToday && !day.isSelected && "border-primary/30"
                )}
              >
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#8AA0C7]">{day.weekdayLabel}</p>
                <p className="mt-2 text-base font-black tracking-tight text-[#17326B]">{day.dateLabel}</p>
                <p className="mt-3 break-keep text-[10px] font-black text-[#17326B]">{day.status}</p>
                <p className="mt-1 break-keep text-[10px] font-semibold leading-4 text-[#5A6F95]">{day.timeLabel}</p>
                {day.hasExcursion ? (
                  <Badge className="mt-2 rounded-full border border-[#FFE2C5] bg-[#FFF4E8] px-2 py-0.5 text-[8px] font-black text-[#D86A11] shadow-none">
                    외출
                  </Badge>
                ) : null}
              </button>
            ))}
          </div>

          <div className="rounded-[1.15rem] border border-[#E6EDF8] bg-[#F8FBFF] px-4 py-4">
            <div className={cn("flex gap-3", isMobile ? "flex-col" : "items-center justify-between")}>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8AA0C7]">선택한 날짜</p>
                <p className="mt-2 text-sm font-black text-[#17326B]">
                  {selectedDateTitle} · {selectedScheduleOverview?.status || '미정'}
                </p>
                <p className="mt-1 break-keep text-[12px] font-semibold leading-5 text-[#5A6F95]">
                  {selectedScheduleOverview?.timeLabel || '아직 정해진 시간이 없어요.'}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className={cn("rounded-xl font-black", isMobile ? "h-10 w-full text-[11px]" : "h-10 px-4 text-xs")}
                onClick={() => openAttendanceSheetForDate(selectedDate, 'today')}
              >
                이 날짜만 수정
              </Button>
            </div>
          </div>
        </div>
      </section>

      <RecentStudySheet
        open={isRecentStudySheetOpen}
        onOpenChange={setIsRecentStudySheetOpen}
        items={recentStudyOptions}
        onPrefill={handlePrefillRecentStudy}
        onQuickAdd={handleQuickAddRecentStudy}
        isSubmitting={isSubmitting}
        isMobile={isMobile}
      />

      <StudyPlanSheet
        open={isStudyPlanSheetOpen}
        onOpenChange={setIsStudyPlanSheetOpen}
        isMobile={isMobile}
        isSubmitting={isSubmitting}
        isPast={isPast}
        selectedDateLabel={selectedDateSheetLabel}
        totalCount={studyTasks.length}
        completedCount={completedStudyCount}
        remainingCount={remainingStudyTasks.length}
        goalSummaryLabel={studyGoalSummaryLabel}
        subjectOptions={SUBJECTS}
        subjectValue={newStudySubject}
        onSubjectChange={setNewStudySubject}
        minuteValue={newStudyMinutes}
        onMinuteChange={setNewStudyMinutes}
        taskValue={newStudyTask}
        onTaskChange={setNewStudyTask}
        studyModeValue={newStudyMode}
        onStudyModeChange={setNewStudyMode}
        amountValue={newStudyTargetAmount}
        onAmountChange={setNewStudyTargetAmount}
        amountUnitValue={newStudyAmountUnit}
        onAmountUnitChange={setNewStudyAmountUnit}
        customAmountUnitValue={newStudyCustomAmountUnit}
        onCustomAmountUnitChange={setNewStudyCustomAmountUnit}
        enableVolumeMinutes={enableVolumeStudyMinutes}
        onEnableVolumeMinutesChange={setEnableVolumeStudyMinutes}
        onSubmit={() => void handleAddTask(newStudyTask, 'study')}
        isRecentLoading={isRecentStudyLoading}
        recentOptions={recentStudyOptions}
        onPrefillRecent={handlePrefillRecentStudy}
        onOpenRecentSheet={() => setIsRecentStudySheetOpen(true)}
        activeRecentTitle={activeRecentStudyOption?.title || null}
        onResetRecentPrefill={resetStudyComposerPrefill}
        studyTasks={studyTasks as Array<WithId<StudyPlanItem>>}
        onToggleTask={(task) => void handleToggleTask(task)}
        onDeleteTask={(task) => void handleDeleteTask(task)}
        onCommitActual={(task, value) => void handleCommitStudyActualAmount(task, value)}
        personalTasks={personalTasks as Array<WithId<StudyPlanItem>>}
        personalTaskValue={newPersonalTask}
        onPersonalTaskChange={setNewPersonalTask}
        onAddPersonalTask={() => void handleAddTask(newPersonalTask, 'personal')}
        onTogglePersonalTask={(task) => void handleToggleTask(task)}
        onDeletePersonalTask={(task) => void handleDeleteTask(task)}
      />

      <AttendanceScheduleSheet
        open={isAttendanceScheduleSheetOpen}
        onOpenChange={setIsAttendanceScheduleSheetOpen}
        initialTab={attendanceSheetInitialTab}
        isMobile={isMobile}
        isSubmitting={isSubmitting}
        selectedDateLabel={format(selectedDate, 'yyyy. MM. dd', { locale: ko })}
        isToday={isToday}
        sameDayPenaltyPoints={SAME_DAY_ROUTINE_PENALTY_POINTS}
        weekRangeLabel={weekRangeLabel}
        calendarDays={attendanceCalendarDays}
        onMoveWeek={moveWeek}
        onSelectDate={setSelectedDate}
        todayDraft={buildCurrentAttendanceDraft()}
        onTodayChange={handleTodayScheduleChange}
        onSaveToday={handleSaveTodaySchedule}
        onSetTodayAbsent={handleSetTodayAbsent}
        onResetToday={() => void handleResetTodaySchedule()}
        hasSelectedWeekdayTemplate={hasSelectedWeekdayTemplate}
        selectedWeekdayLabel={matchingWeekdayLabel}
        onApplySelectedWeekdayTemplateToToday={handleApplySelectedWeekdayTemplateToToday}
        selectedWeekdays={selectedRecurringWeekdays}
        onToggleWeekday={handleToggleRecurringWeekday}
        weekdayOptions={WEEKDAY_OPTIONS}
        weekdayDraft={weekdayDraft}
        onWeekdayChange={handleWeekdayDraftChange}
        onCopyTodayToWeekday={handleCopyTodayToWeekday}
        onSaveWeekday={handleSaveWeekdayTemplate}
        presetName={presetName}
        onPresetNameChange={setPresetName}
        onSavePreset={handleSaveSchedulePreset}
        savedRoutines={savedAttendanceRoutines}
        onApplyPresetToToday={handleApplyPresetToToday}
        onApplyPresetToWeekday={handleApplyPresetToWeekday}
        onDeletePreset={(presetId) => void handleDeleteScheduleTemplate(presetId)}
        onTogglePresetActive={(presetId, active) => void handleToggleScheduleTemplateActive(presetId, active)}
        note={scheduleNote}
        onNoteChange={setScheduleNote}
        recommendationPrefillSummary={scheduleRecommendationPrefill}
        personalTasks={personalTasks as Array<WithId<StudyPlanItem>>}
        personalTaskDraft={newPersonalTask}
        onPersonalTaskDraftChange={setNewPersonalTask}
        onAddPersonalTask={() => void handleAddTask(newPersonalTask, 'personal')}
        onTogglePersonalTask={(task) => void handleToggleTask(task)}
        onDeletePersonalTask={(task) => void handleDeleteTask(task)}
      />
    </div>
  );
}



